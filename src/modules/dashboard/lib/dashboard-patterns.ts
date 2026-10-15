import { isoToDateStr } from "@darkmoney/shared/dates";
import { isExpense, isIncome, isCategorizedCashflow } from "@darkmoney/shared/aggregations";
import { movementActsAsIncome, movementDisplayAccountId, movementDisplayAmount } from "@darkmoney/shared/movement-amounts";
import { normalizeAnalyticsText } from "@darkmoney/shared/movement-features";
import { convertParityAmount } from "@darkmoney/shared/currency";
import type { ParityConversionCtx } from "@darkmoney/shared/types";
import type { WorkspaceSnapshot } from "../../../services/queries/workspace-data";
import { isHistoryBalanceCorrection } from "./dashboard-health";
import { detectMovementAnomalies } from "./anomaly-detection";
import { buildPatternClusters } from "./pattern-clustering";

export function buildDashboardPatterns(snapshot: WorkspaceSnapshot, ctx: ParityConversionCtx, now = new Date()) {
  const today = isoToDateStr(now.toISOString()), day = (ago: number) => isoToDateStr(new Date(now.getTime() - ago * 86400000).toISOString());
  const rows = snapshot.movements.filter(row => row.status === "posted" && new Date(row.occurredAt) <= now && new Date(row.occurredAt).getTime() >= now.getTime() - 90 * 86400000 && !isHistoryBalanceCorrection(row))
    .map(row => ({ ...row, categoryId: row.categoryId ?? null, counterpartyId: row.counterpartyId ?? null }));
  const amounts = new Map<number, number>(); let unconvertedCount = 0;
  for (const row of rows) {
    if (!isExpense(row) && !isIncome(row)) continue;
    const amount = convertParityAmount({ amount: movementDisplayAmount(row), currencyCode: ctx.accountCurrencyMap.get(movementDisplayAccountId(row) ?? 0), baseCurrencyCode: ctx.baseCurrency, targetCurrencyCode: ctx.displayCurrency, exchangeRateMap: ctx.exchangeRateMap });
    if (amount === null) unconvertedCount++; else amounts.set(row.id, amount);
  }
  const movements = unconvertedCount === 0 ? rows : [];
  const names = new Map(snapshot.catalogs.categories.map(row => [row.id, row.name])), accounts = new Map(snapshot.accounts.map(row => [row.id, row.name]));
  const amountOf = (row: typeof rows[number]) => amounts.get(row.id) ?? 0;
  const anomalies = detectMovementAnomalies({ movements: movements.filter(isExpense), getAmount: amountOf, limit: 4 }).map(finding => {
    const movement = movements.find(row => row.id === finding.movementId)!;
    const account = accounts.get(movementDisplayAccountId(movement) ?? 0), description = movement.description.trim();
    const title = !description || account && normalizeAnalyticsText(description) === normalizeAnalyticsText(account) ? "Gasto sin descripción" : description;
    return { ...finding, movement, title };
  });
  const habits = buildPatternClusters({ movements, isCashflow: isCategorizedCashflow, isIncomeLike: movementActsAsIncome, getAmount: amountOf, categoryNames: names, now, sinceDays: 90, limit: movements.length }).map(cluster => {
    const counts = new Map<string, number>();
    for (const id of cluster.movementIds) { const row = movements.find(item => item.id === id); if (!row) continue; const name = accounts.get(movementDisplayAccountId(row) ?? 0); if (name) counts.set(name, (counts.get(name) ?? 0) + 1); }
    const accountName = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const label = cluster.label.replace(/: movimientos parecidos$/i, "").trim();
    return { ...cluster, title: !label || accountName && normalizeAnalyticsText(label) === normalizeAnalyticsText(accountName) ? `${cluster.type} sin descripción` : label };
  }).sort((a, b) => b.total - a.total).slice(0, 4);
  const current = new Map<number | null, number>(), previous = new Map<number | null, number>(), ids = new Map<number | null, number[]>(), categories = new Map<number | null, number>();
  const weekdays = Array.from({ length: 7 }, (_, index) => ({ index, total: 0, average: 0, count: 0, occurrences: 0, movementIds: [] as number[] }));
  const weekday = (date: string) => (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
  for (let i = 0; i < 90; i++) weekdays[weekday(day(i))].occurrences++;
  for (const row of movements.filter(isExpense)) {
    const date = isoToDateStr(row.occurredAt), amount = amountOf(row), key = row.categoryId;
    if (date >= day(13)) { current.set(key, (current.get(key) ?? 0) + amount); ids.set(key, [...(ids.get(key) ?? []), row.id]); }
    else if (date >= day(27) && date <= day(14)) previous.set(key, (previous.get(key) ?? 0) + amount);
    if (date >= today.slice(0, 7) + "-01") categories.set(key, (categories.get(key) ?? 0) + amount);
    if (date >= day(89) && amount > 0) { const week = weekdays[weekday(date)]; week.total += amount; week.count++; week.movementIds.push(row.id); }
  }
  const rises = [...current].map(([categoryId, value]) => ({ categoryId, name: categoryId === null ? "Sin categoría" : names.get(categoryId) ?? "Categoría", current: value, previous: previous.get(categoryId) ?? 0, delta: value - (previous.get(categoryId) ?? 0), movementIds: ids.get(categoryId) ?? [] }))
    .filter(row => row.delta > Math.max(10, row.previous * 0.18) && row.current >= 12).sort((a, b) => b.delta - a.delta).slice(0, 4);
  for (const week of weekdays) week.average = week.total / Math.max(week.occurrences, 1);
  return { from: day(90), to: today, riseFrom: day(13), previousFrom: day(27), previousTo: day(14), unconvertedCount, complete: unconvertedCount === 0, anomalies, habits, rises, weekdays,
    categories: [...categories].map(([id, amount]) => ({ id, name: id === null ? "Sin categoría" : names.get(id) ?? "Categoría", amount })).filter(row => row.amount > 0).sort((a, b) => b.amount - a.amount),
    movements: movements.map(row => ({ id: row.id, title: row.description.trim() || (isIncome(row) ? "Ingreso" : "Gasto"), income: isIncome(row), amount: amountOf(row), occurredAt: row.occurredAt })) };
}
