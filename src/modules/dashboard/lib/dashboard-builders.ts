import { formatCurrency } from "../../../lib/formatting/money";
import type {
  AccountSummary,
  MovementRecord,
  ObligationSummary,
  RecurringIncomeSummary,
  SubscriptionSummary,
} from "../../../types/domain";
import { classifyMovement } from "./dashboard-classify";
import {
  addDays,
  getDateDiffInclusive,
  startOfDay,
  startOfMonth,
  toLocalDateKey,
} from "./dashboard-dates";
import {
  convertDashboardAmount,
  fullDateFormatter,
  monthLabelFormatter,
  normalizeCurrencyCode,
  shortDateFormatter,
} from "./dashboard-format";
import {
  learningPhaseDefinitions,
  weekdayLabelsFull,
  weekdayLabelsShort,
} from "./dashboard-types";
import type {
  AccountBreakdownItem,
  CategoryComparisonItem,
  ComparisonDefinition,
  CurrencyExposureItem,
  DailyFlowPoint,
  DailySavingsPoint,
  ExposureItem,
  LearningInsight,
  LearningPhaseStatus,
  LearningSnapshot,
  MonthPulseItem,
  SubscriptionHighlightItem,
  TransferRouteItem,
  WeekdayItem,
} from "./dashboard-types";

export function buildSavingsSeries(
  movements: MovementRecord[],
  comparison: ComparisonDefinition,
) {
  const length = getDateDiffInclusive(comparison.current.start, comparison.current.end);
  const series = Array.from({ length }, (_, index) => {
    const currentDate = addDays(comparison.current.start, index);
    const previousDate = addDays(comparison.previous.start, index);

    return {
      key: toLocalDateKey(currentDate),
      label:
        length <= 10
          ? weekdayLabelsShort[(currentDate.getDay() + 6) % 7]
          : shortDateFormatter.format(currentDate),
      fullLabel: fullDateFormatter.format(currentDate),
      currentDate,
      previousDate,
      income: 0,
      expense: 0,
      net: 0,
      cumulative: 0,
      previousIncome: 0,
      previousExpense: 0,
      previousNet: 0,
      previousCumulative: 0,
    } satisfies DailySavingsPoint;
  });

  const currentIndexByDate = new Map(series.map((item, index) => [toLocalDateKey(item.currentDate), index]));
  const previousIndexByDate = new Map(series.map((item, index) => [toLocalDateKey(item.previousDate), index]));

  for (const movement of movements) {
    const classified = classifyMovement(movement);

    if (!classified) {
      continue;
    }

    const movementDate = new Date(movement.occurredAt);
    const currentIndex = currentIndexByDate.get(toLocalDateKey(movementDate));

    if (currentIndex !== undefined) {
      if (classified.kind === "income") {
        series[currentIndex].income += classified.amount;
      } else {
        series[currentIndex].expense += classified.amount;
      }
    }

    const previousIndex = previousIndexByDate.get(toLocalDateKey(movementDate));

    if (previousIndex !== undefined) {
      if (classified.kind === "income") {
        series[previousIndex].previousIncome += classified.amount;
      } else {
        series[previousIndex].previousExpense += classified.amount;
      }
    }
  }

  let runningCurrent = 0;
  let runningPrevious = 0;

  return series.map((item) => {
    const net = item.income - item.expense;
    const previousNet = item.previousIncome - item.previousExpense;
    runningCurrent += net;
    runningPrevious += previousNet;

    return {
      ...item,
      net,
      cumulative: runningCurrent,
      previousNet,
      previousCumulative: runningPrevious,
    };
  });
}

export function buildDailyFlowSeries(
  movements: MovementRecord[],
  comparison: ComparisonDefinition,
  pickDaily: (movement: MovementRecord) => number | null,
): DailyFlowPoint[] {
  const length = getDateDiffInclusive(comparison.current.start, comparison.current.end);
  const series = Array.from({ length }, (_, index) => {
    const currentDate = addDays(comparison.current.start, index);
    const previousDate = addDays(comparison.previous.start, index);

    return {
      key: toLocalDateKey(currentDate),
      label:
        length <= 10
          ? weekdayLabelsShort[(currentDate.getDay() + 6) % 7]
          : shortDateFormatter.format(currentDate),
      fullLabel: fullDateFormatter.format(currentDate),
      currentDate,
      previousDate,
      daily: 0,
      cumulative: 0,
      previousDaily: 0,
      previousCumulative: 0,
    } satisfies DailyFlowPoint;
  });

  const currentIndexByDate = new Map(series.map((item, index) => [toLocalDateKey(item.currentDate), index]));
  const previousIndexByDate = new Map(series.map((item, index) => [toLocalDateKey(item.previousDate), index]));

  for (const movement of movements) {
    const amount = pickDaily(movement);

    if (amount === null || amount <= 0) {
      continue;
    }

    const movementDate = new Date(movement.occurredAt);
    const currentIndex = currentIndexByDate.get(toLocalDateKey(movementDate));

    if (currentIndex !== undefined) {
      series[currentIndex].daily += amount;
    }

    const previousIndex = previousIndexByDate.get(toLocalDateKey(movementDate));

    if (previousIndex !== undefined) {
      series[previousIndex].previousDaily += amount;
    }
  }

  let runningCurrent = 0;
  let runningPrevious = 0;

  return series.map((item) => {
    runningCurrent += item.daily;
    runningPrevious += item.previousDaily;

    return {
      ...item,
      cumulative: runningCurrent,
      previousCumulative: runningPrevious,
    };
  });
}


export function buildCategoryComparison(
  currentMovements: MovementRecord[],
  previousMovements: MovementRecord[],
) {
  const categories = new Map<string, CategoryComparisonItem>();
  let currentExpenseTotal = 0;

  const pushExpense = (movement: MovementRecord, bucket: "current" | "previous") => {
    const classified = classifyMovement(movement);

    if (!classified || classified.kind !== "expense") {
      return;
    }

    const key = movement.category || "Sin categoria";
    const existing = categories.get(key) ?? {
      key,
      name: key,
      current: 0,
      previous: 0,
      delta: 0,
      currentCount: 0,
      previousCount: 0,
      share: 0,
    };

    if (bucket === "current") {
      existing.current += classified.amount;
      existing.currentCount += 1;
      currentExpenseTotal += classified.amount;
    } else {
      existing.previous += classified.amount;
      existing.previousCount += 1;
    }

    categories.set(key, existing);
  };

  currentMovements.forEach((movement) => pushExpense(movement, "current"));
  previousMovements.forEach((movement) => pushExpense(movement, "previous"));

  return [...categories.values()]
    .map((item) => ({
      ...item,
      delta: item.current - item.previous,
      share: currentExpenseTotal > 0 ? item.current / currentExpenseTotal : 0,
    }))
    .filter((item) => item.current > 0 || item.previous > 0)
    .sort((left, right) => Math.max(right.current, right.previous) - Math.max(left.current, left.previous));
}

export function buildAccountBreakdown(
  accounts: AccountSummary[],
  periodMovements: MovementRecord[],
) {
  const movementCountByAccountId = new Map<number, number>();
  const totalBalance = accounts.reduce(
    (total, account) => total + (account.currentBalanceInBaseCurrency ?? account.currentBalance),
    0,
  );

  for (const movement of periodMovements) {
    if (movement.sourceAccountId) {
      movementCountByAccountId.set(
        movement.sourceAccountId,
        (movementCountByAccountId.get(movement.sourceAccountId) ?? 0) + 1,
      );
    }

    if (movement.destinationAccountId) {
      movementCountByAccountId.set(
        movement.destinationAccountId,
        (movementCountByAccountId.get(movement.destinationAccountId) ?? 0) + 1,
      );
    }
  }

  return [...accounts]
    .map<AccountBreakdownItem>((account) => {
      const amount = account.currentBalanceInBaseCurrency ?? account.currentBalance;

      return {
        account,
        amount,
        share: totalBalance > 0 ? amount / totalBalance : 0,
        periodMovementCount: movementCountByAccountId.get(account.id) ?? 0,
      };
    })
    .sort((left, right) => right.amount - left.amount);
}

export function buildExposureLeaders(
  obligations: ObligationSummary[],
  direction: ObligationSummary["direction"],
) {
  const grouped = new Map<string, ExposureItem>();

  for (const obligation of obligations) {
    if (obligation.direction !== direction) {
      continue;
    }

    const amount = obligation.pendingAmountInBaseCurrency ?? obligation.pendingAmount;

    if (amount <= 0) {
      continue;
    }

    const key = `${obligation.counterpartyId ?? "none"}-${obligation.counterparty}`;
    const current = grouped.get(key) ?? {
      key,
      counterpartyId: obligation.counterpartyId,
      counterparty: obligation.counterparty,
      amount: 0,
      obligationCount: 0,
      latestDate: null,
      titles: [],
    };

    current.amount += amount;
    current.obligationCount += 1;
    current.latestDate =
      current.latestDate && obligation.dueDate
        ? new Date(current.latestDate).getTime() > new Date(obligation.dueDate).getTime()
          ? current.latestDate
          : obligation.dueDate
        : current.latestDate ?? obligation.dueDate ?? obligation.startDate;

    if (!current.titles.includes(obligation.title)) {
      current.titles.push(obligation.title);
    }

    grouped.set(key, current);
  }

  return [...grouped.values()].sort((left, right) => right.amount - left.amount);
}

export function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}`;
}

export function getMonthLabel(date: Date) {
  return monthLabelFormatter
    .format(date)
    .replace(".", "")
    .slice(0, 3)
    .toUpperCase();
}

export function buildMonthlyPulse(movements: MovementRecord[]) {
  const today = new Date();
  const months = Array.from({ length: 6 }, (_, index) => {
    const startDate = new Date(today.getFullYear(), today.getMonth() - (5 - index), 1);

    return {
      key: getMonthKey(startDate),
      label: getMonthLabel(startDate),
      income: 0,
      expense: 0,
      net: 0,
      movementCount: 0,
      startDate,
    } satisfies MonthPulseItem;
  });

  const lookup = new Map(months.map((month) => [month.key, month]));

  for (const movement of movements) {
    const classified = classifyMovement(movement);

    if (!classified) {
      continue;
    }

    const bucket = lookup.get(getMonthKey(new Date(movement.occurredAt)));

    if (!bucket) {
      continue;
    }

    if (classified.kind === "income") {
      bucket.income += classified.amount;
    } else {
      bucket.expense += classified.amount;
    }

    bucket.net = bucket.income - bucket.expense;
    bucket.movementCount += 1;
  }

  return months;
}

export function buildWeekdayPattern(movements: MovementRecord[]) {
  const weekdays = weekdayLabelsFull.map(
    (label, index) =>
      ({
        key: `${index}`,
        label,
        income: 0,
        expense: 0,
        net: 0,
        movementCount: 0,
      }) satisfies WeekdayItem,
  );

  for (const movement of movements) {
    const classified = classifyMovement(movement);

    if (!classified) {
      continue;
    }

    const date = new Date(movement.occurredAt);
    const weekdayIndex = (date.getDay() + 6) % 7;
    const bucket = weekdays[weekdayIndex];

    if (classified.kind === "income") {
      bucket.income += classified.amount;
    } else {
      bucket.expense += classified.amount;
    }

    bucket.net = bucket.income - bucket.expense;
    bucket.movementCount += 1;
  }

  return weekdays;
}

export function buildUpcomingCommitments(
  obligations: ObligationSummary[],
  subscriptions: SubscriptionSummary[],
  recurringIncome: RecurringIncomeSummary[],
) {
  const today = startOfDay(new Date());
  const limit = addDays(today, 30);

  const obligationItems = obligations
    .filter((obligation) => {
      if (!obligation.dueDate || obligation.pendingAmount <= 0) {
        return false;
      }

      const dueDate = new Date(obligation.dueDate);
      return dueDate >= today && dueDate <= limit;
    })
    .map((obligation) => ({
      key: `obligation-${obligation.id}`,
      kind: obligation.direction === "receivable" ? "Por cobrar" : "Por pagar",
      title: obligation.title,
      counterpart: obligation.counterparty,
      amount: obligation.pendingAmountInBaseCurrency ?? obligation.pendingAmount,
      date: obligation.dueDate as string,
    }));

  const subscriptionItems = subscriptions
    .filter((subscription) => {
      const dueDate = new Date(subscription.nextDueDate);
      return dueDate >= today && dueDate <= limit && subscription.status === "active";
    })
    .map((subscription) => ({
      key: `subscription-${subscription.id}`,
      kind: "Suscripción",
      title: subscription.name,
      counterpart: subscription.vendor,
      amount: subscription.amountInBaseCurrency ?? subscription.amount,
      date: subscription.nextDueDate,
    }));

  const recurringIncomeItems = recurringIncome
    .filter((income) => {
      const expectedDate = new Date(income.nextExpectedDate);
      return expectedDate >= today && expectedDate <= limit && income.status === "active";
    })
    .map((income) => ({
      key: `recurring-income-${income.id}`,
      kind: "Ingreso fijo",
      title: income.name,
      counterpart: income.payer,
      amount: income.amountInBaseCurrency ?? income.amount,
      date: income.nextExpectedDate,
    }));

  return [...obligationItems, ...subscriptionItems, ...recurringIncomeItems].sort(
    (left, right) => new Date(left.date).getTime() - new Date(right.date).getTime(),
  );
}

export function getMonthlySubscriptionAmount(
  subscription: Pick<SubscriptionSummary, "amount" | "intervalCount" | "frequency"> |
    Pick<RecurringIncomeSummary, "amount" | "intervalCount" | "frequency">,
) {
  const intervalCount = Math.max(1, subscription.intervalCount || 1);

  switch (subscription.frequency) {
    case "daily":
      return subscription.amount * (30 / intervalCount);
    case "weekly":
      return subscription.amount * (4.345 / intervalCount);
    case "monthly":
      return subscription.amount / intervalCount;
    case "quarterly":
      return subscription.amount / (3 * intervalCount);
    case "yearly":
      return subscription.amount / (12 * intervalCount);
    default:
      return subscription.amount / intervalCount;
  }
}

export function buildSubscriptionHighlights(subscriptions: SubscriptionSummary[]) {
  return subscriptions
    .filter((subscription) => subscription.status === "active")
    .map<SubscriptionHighlightItem>((subscription) => ({
      id: subscription.id,
      name: subscription.name,
      vendor: subscription.vendor,
      amount: subscription.amount,
      monthlyAmount: getMonthlySubscriptionAmount(subscription),
      nextDueDate: subscription.nextDueDate,
      status: subscription.status,
      categoryName: subscription.categoryName ?? null,
    }))
    .sort((left, right) => right.monthlyAmount - left.monthlyAmount);
}

export function buildTransferRoutes(movements: MovementRecord[]) {
  const groupedRoutes = new Map<string, TransferRouteItem>();

  for (const movement of movements) {
    if (movement.movementType !== "transfer" || movement.status !== "posted") {
      continue;
    }

    const source = movement.sourceAccountName ?? "Sin origen";
    const destination = movement.destinationAccountName ?? "Sin destino";
    const amount = Math.max(
      movement.sourceAmountInBaseCurrency ?? movement.sourceAmount ?? 0,
      movement.destinationAmountInBaseCurrency ?? movement.destinationAmount ?? 0,
    );

    const key = `${source}->${destination}`;
    const currentRoute = groupedRoutes.get(key) ?? {
      key,
      label: `${source} -> ${destination}`,
      source,
      destination,
      amount: 0,
      count: 0,
    };

    currentRoute.amount += amount;
    currentRoute.count += 1;
    groupedRoutes.set(key, currentRoute);
  }

  return [...groupedRoutes.values()].sort((left, right) => right.amount - left.amount);
}

export function buildCurrencyExposure(
  accounts: AccountSummary[],
  displayCurrencyCode: string,
  baseCurrencyCode: string,
  exchangeRateMap: Map<string, number>,
) {
  const totalsByCurrency = new Map<string, CurrencyExposureItem>();
  let grandTotal = 0;

  for (const account of accounts.filter((item) => !item.isArchived)) {
    const convertedAmount = convertDashboardAmount({
      amount: account.currentBalance,
      currencyCode: account.currencyCode,
      amountInBaseCurrency: account.currentBalanceInBaseCurrency,
      baseCurrencyCode,
      targetCurrencyCode: displayCurrencyCode,
      exchangeRateMap,
    });

    const amount = convertedAmount ?? account.currentBalance;
    const currencyCode = normalizeCurrencyCode(account.currencyCode);
    const currentItem = totalsByCurrency.get(currencyCode) ?? {
      currencyCode,
      amount: 0,
      share: 0,
      accountCount: 0,
    };

    currentItem.amount += amount;
    currentItem.accountCount += 1;
    totalsByCurrency.set(currencyCode, currentItem);
    grandTotal += amount;
  }

  return [...totalsByCurrency.values()]
    .map((item) => ({
      ...item,
      share: grandTotal > 0 ? item.amount / grandTotal : 0,
    }))
    .sort((left, right) => right.amount - left.amount);
}

export function buildLearningSnapshot(movements: MovementRecord[], currencyCode: string): LearningSnapshot {
  if (movements.length === 0) {
    return {
      currentPhase: 0,
      readinessScore: 0,
      totalPostedMovements: 0,
      categorizedRate: 0,
      historyDays: 0,
      distinctMonths: 0,
      distinctCategories: 0,
      phases: learningPhaseDefinitions.map((phase) => ({
        step: phase.step,
        title: phase.title,
        description: phase.description,
        unlocked: false,
        progress: 0,
        remainingRequirements: [
          `Necesitas al menos ${phase.minMovements} movimientos aplicados.`,
          `Necesitas ${phase.minHistoryDays} dias de historial como minimo.`,
        ],
      })),
      insights: [],
      pendingActions: [
        "Empieza registrando ingresos, gastos y transferencias reales.",
        "Usa categorías desde el inicio para que el sistema pueda aprender más rápido.",
      ],
    };
  }

  const sortedMovements = [...movements].sort(
    (left, right) => new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime(),
  );
  const classifiedMovements = sortedMovements
    .map((movement) => ({ movement, classified: classifyMovement(movement) }))
    .filter(
      (item): item is { movement: MovementRecord; classified: { kind: "income" | "expense"; amount: number } } =>
        item.classified !== null,
    );
  const categorizableMovements = classifiedMovements.filter(
    (item) => item.movement.movementType !== "transfer",
  );
  const categorizedMovements = categorizableMovements.filter(
    (item) => item.movement.categoryId || item.movement.category !== "Sin categoria",
  );
  const oldestMovementDate = new Date(sortedMovements[0].occurredAt);
  const newestMovementDate = new Date(sortedMovements[sortedMovements.length - 1].occurredAt);
  const historyDays = getDateDiffInclusive(oldestMovementDate, newestMovementDate);
  const distinctMonths = new Set(
    sortedMovements.map((movement) => {
      const date = new Date(movement.occurredAt);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    }),
  ).size;
  const distinctCategories = new Set(
    categorizedMovements.map((item) => item.movement.categoryId ?? item.movement.category),
  ).size;
  const categorizedRate =
    categorizableMovements.length > 0 ? categorizedMovements.length / categorizableMovements.length : 0;

  const phases = learningPhaseDefinitions.map<LearningPhaseStatus>((phase) => {
    const requirements = [
      Math.min(1, sortedMovements.length / phase.minMovements),
      Math.min(1, historyDays / phase.minHistoryDays),
      Math.min(1, categorizedRate / phase.minCategorizedRate),
      Math.min(1, distinctMonths / phase.minDistinctMonths),
      Math.min(1, distinctCategories / phase.minDistinctCategories),
    ];
    const remainingRequirements: string[] = [];

    if (sortedMovements.length < phase.minMovements) {
      remainingRequirements.push(`Te faltan ${phase.minMovements - sortedMovements.length} movimientos aplicados.`);
    }

    if (historyDays < phase.minHistoryDays) {
      remainingRequirements.push(`Te faltan ${phase.minHistoryDays - historyDays} dias de historial.`);
    }

    if (categorizedRate < phase.minCategorizedRate) {
      remainingRequirements.push(
        `Sube tu categoría útil al ${Math.round(phase.minCategorizedRate * 100)}% para desbloquear esta fase.`,
      );
    }

    if (distinctMonths < phase.minDistinctMonths) {
      remainingRequirements.push(`Necesitamos ${phase.minDistinctMonths - distinctMonths} meses más con actividad.`);
    }

    if (distinctCategories < phase.minDistinctCategories) {
      remainingRequirements.push(`Activa ${phase.minDistinctCategories - distinctCategories} categorías adicionales.`);
    }

    return {
      step: phase.step,
      title: phase.title,
      description: phase.description,
      unlocked: remainingRequirements.length === 0,
      progress: requirements.reduce((total, value) => total + value, 0) / requirements.length,
      remainingRequirements,
    };
  });

  const currentPhase = (phases.filter((phase) => phase.unlocked).pop()?.step ?? 0) as 0 | 1 | 2 | 3 | 4;
  const readinessScore =
    phases.length > 0
      ? Math.round((phases.reduce((total, phase) => total + phase.progress, 0) / phases.length) * 100)
      : 0;

  const expenseEntries = classifiedMovements.filter((item) => item.classified.kind === "expense");
  const weekdayExpenseMap = new Map<number, number>();
  const categoryTotals = new Map<string, { amount: number; count: number }>();
  const counterpartyTotals = new Map<string, { amount: number; count: number }>();

  for (const item of expenseEntries) {
    const date = new Date(item.movement.occurredAt);
    const weekday = date.getDay();
    weekdayExpenseMap.set(weekday, (weekdayExpenseMap.get(weekday) ?? 0) + item.classified.amount);

    const categoryKey = item.movement.category || "Sin categoria";
    const currentCategory = categoryTotals.get(categoryKey) ?? { amount: 0, count: 0 };
    currentCategory.amount += item.classified.amount;
    currentCategory.count += 1;
    categoryTotals.set(categoryKey, currentCategory);

    if (item.movement.counterparty && item.movement.counterparty !== "Sin contraparte") {
      const currentCounterparty = counterpartyTotals.get(item.movement.counterparty) ?? { amount: 0, count: 0 };
      currentCounterparty.amount += item.classified.amount;
      currentCounterparty.count += 1;
      counterpartyTotals.set(item.movement.counterparty, currentCounterparty);
    }
  }

  const topWeekdayEntry = [...weekdayExpenseMap.entries()].sort((left, right) => right[1] - left[1])[0] ?? null;
  const topCategoryEntry = [...categoryTotals.entries()].sort((left, right) => right[1].amount - left[1].amount)[0] ?? null;
  const topCounterpartyEntry =
    [...counterpartyTotals.entries()].sort((left, right) => right[1].amount - left[1].amount)[0] ?? null;
  const weekendExpense =
    (weekdayExpenseMap.get(0) ?? 0) + (weekdayExpenseMap.get(6) ?? 0);
  const totalExpense = expenseEntries.reduce((total, item) => total + item.classified.amount, 0);
  const weekendShare = totalExpense > 0 ? weekendExpense / totalExpense : 0;

  const today = new Date();
  const currentMonthStart = startOfMonth(today);
  const currentMonthExpenseEntries = expenseEntries.filter(
    (item) =>
      new Date(item.movement.occurredAt).getTime() >= currentMonthStart.getTime() &&
      new Date(item.movement.occurredAt).getTime() <= today.getTime(),
  );
  const currentMonthExpense = currentMonthExpenseEntries.reduce(
    (total, item) => total + item.classified.amount,
    0,
  );
  const daysElapsedThisMonth = getDateDiffInclusive(currentMonthStart, today);
  const daysInCurrentMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const projectedMonthExpense =
    currentMonthExpenseEntries.length > 0 ? (currentMonthExpense / daysElapsedThisMonth) * daysInCurrentMonth : null;

  const previousMonthExpenseMap = new Map<string, number>();
  for (const item of expenseEntries) {
    const date = new Date(item.movement.occurredAt);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    previousMonthExpenseMap.set(monthKey, (previousMonthExpenseMap.get(monthKey) ?? 0) + item.classified.amount);
  }
  const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const previousFullMonthExpenses = [...previousMonthExpenseMap.entries()]
    .filter(([monthKey]) => monthKey !== currentMonthKey)
    .sort((left, right) => right[0].localeCompare(left[0]))
    .slice(0, 3)
    .map(([, amount]) => amount);
  const trailingAverageExpense =
    previousFullMonthExpenses.length > 0
      ? previousFullMonthExpenses.reduce((total, amount) => total + amount, 0) / previousFullMonthExpenses.length
      : null;

  const last30Start = addDays(today, -29);
  const previous30Start = addDays(today, -59);
  const previous30End = addDays(today, -30);
  const recentCategoryMap = new Map<string, number>();
  const previousCategoryMap = new Map<string, number>();

  for (const item of expenseEntries) {
    const occurredAt = new Date(item.movement.occurredAt);
    const categoryKey = item.movement.category || "Sin categoria";

    if (occurredAt >= last30Start && occurredAt <= today) {
      recentCategoryMap.set(categoryKey, (recentCategoryMap.get(categoryKey) ?? 0) + item.classified.amount);
    } else if (occurredAt >= previous30Start && occurredAt <= previous30End) {
      previousCategoryMap.set(categoryKey, (previousCategoryMap.get(categoryKey) ?? 0) + item.classified.amount);
    }
  }

  const growthCategoryEntry = [...recentCategoryMap.entries()]
    .map(([category, amount]) => ({
      category,
      current: amount,
      previous: previousCategoryMap.get(category) ?? 0,
      delta: amount - (previousCategoryMap.get(category) ?? 0),
    }))
    .filter((item) => item.delta > 0)
    .sort((left, right) => right.delta - left.delta)[0] ?? null;

  const insights: LearningInsight[] = [];

  if (currentPhase >= 1 && topWeekdayEntry) {
    const weekdayLabel = weekdayLabelsFull[(topWeekdayEntry[0] + 6) % 7];
    insights.push({
      title: `Tu día más cargado hoy parece ser ${weekdayLabel}`,
      description: `Ese día concentra ${Math.round((topWeekdayEntry[1] / Math.max(totalExpense, 1)) * 100)}% del gasto histórico aplicable.`,
      tone: "info",
    });
  }

  if (currentPhase >= 1 && topCategoryEntry) {
    insights.push({
      title: `La categoría que más pesa es ${topCategoryEntry[0]}`,
      description: `${topCategoryEntry[1].count} movimientos y ${formatCurrency(topCategoryEntry[1].amount, currencyCode)} de salida acumulada la vuelven tu foco principal.`,
      tone: "warning",
    });
  }

  if (currentPhase >= 2 && topCounterpartyEntry) {
    insights.push({
      title: `Tienes una contraparte muy repetida: ${topCounterpartyEntry[0]}`,
      description: `Ya aparece en ${topCounterpartyEntry[1].count} movimientos y absorbe ${formatCurrency(topCounterpartyEntry[1].amount, currencyCode)} del gasto relacionado.`,
      tone: "neutral",
    });
  }

  if (currentPhase >= 2 && weekendShare >= 0.4) {
    insights.push({
      title: "Tus fines de semana concentran mucho gasto",
      description: `${Math.round(weekendShare * 100)}% de tus salidas históricas cae entre sábado y domingo.`,
      tone: "warning",
    });
  }

  if (currentPhase >= 3 && projectedMonthExpense !== null) {
    const projectedDelta =
      trailingAverageExpense !== null ? projectedMonthExpense - trailingAverageExpense : null;
    insights.push({
      title: "Ya podemos proyectar tu cierre del mes",
      description:
        projectedDelta !== null
          ? `Si sigues al ritmo actual cerrarías cerca de ${formatCurrency(projectedMonthExpense, currencyCode)}, ${projectedDelta >= 0 ? "por encima" : "por debajo"} de tu promedio reciente.`
          : `Con el ritmo actual cerrarías cerca de ${formatCurrency(projectedMonthExpense, currencyCode)} este mes.`,
      tone:
        projectedDelta !== null
          ? projectedDelta > 0
            ? "warning"
            : "success"
          : "info",
    });
  }

  if (currentPhase >= 3 && growthCategoryEntry) {
    insights.push({
      title: `La categoría con más presión ahora es ${growthCategoryEntry.category}`,
      description: `En los últimos 30 días subió ${formatCurrency(growthCategoryEntry.delta, currencyCode)} frente al bloque anterior, así que es la candidata más clara a dominar tu gasto cercano.`,
      tone: "warning",
    });
  }

  if (currentPhase >= 4 && projectedMonthExpense !== null && trailingAverageExpense !== null) {
    const overAverageRatio = trailingAverageExpense > 0 ? projectedMonthExpense / trailingAverageExpense : null;

    if (overAverageRatio !== null && overAverageRatio >= 1.15) {
      insights.push({
        title: "Alerta temprana de gasto alto",
        description: `Tu proyección del mes ya va ${Math.round((overAverageRatio - 1) * 100)}% por encima de tu promedio de los últimos meses.`,
        tone: "danger",
      });
    } else {
      insights.push({
        title: "Tu proyección luce controlada",
        description: "El gasto proyectado del mes se mantiene dentro de un rango saludable frente a tu historial reciente.",
        tone: "success",
      });
    }
  }

  const nextLockedPhase = phases.find((phase) => !phase.unlocked);
  const pendingActions =
    nextLockedPhase?.remainingRequirements.length
      ? nextLockedPhase.remainingRequirements
      : [
          "Sigue registrando con disciplina para reforzar las predicciones.",
          "Mantener categorías consistentes mejora la precisión del panel.",
        ];

  return {
    currentPhase,
    readinessScore,
    totalPostedMovements: sortedMovements.length,
    categorizedRate,
    historyDays,
    distinctMonths,
    distinctCategories,
    phases,
    insights: insights.slice(0, 6),
    pendingActions,
  };
}
