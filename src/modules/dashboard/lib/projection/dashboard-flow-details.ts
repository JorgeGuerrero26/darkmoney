import { addDays, endOfDay, format, parseISO, startOfDay } from "date-fns";
import { convertParityAmount } from "@darkmoney/shared/currency";
import { isoToDateStr } from "@darkmoney/shared/dates";
import type { ParityConversionCtx } from "@darkmoney/shared/types";
import type { WorkspaceSnapshot } from "../../../../services/queries/workspace-data";
import type { MovementRecord, SharedObligationSummary } from "../../../../types/domain";
import { buildCashflowCalendar, type ProjectedMonth } from "./cashflow-calendar";
import type { buildDashboardCashflow } from "./build-dashboard-cashflow";
import { projectionFlowItems } from "./flow-windows";
import { limaCalendarDay, limaClock } from "./lima-calendar";
import { obligationViewerDirection } from "./projection-perspective";

/** Mobile flow-view selector: include today and the whole 30th calendar day. */
export function upcomingSubscriptionCharges(months: readonly ProjectedMonth[], now: Date) {
  const end = endOfDay(addDays(now, 30));
  return projectionFlowItems(months, now).filter(item => item.source === "subscription" && item.direction === "outflow" && item.date >= startOfDay(now) && item.date <= end);
}

type Transfer = { movement: MovementRecord; amount: number | null; sourceCurrency: string | null; destinationCurrency: string | null };
type Route = { key: string; srcName: string; dstName: string; sourceId: number; targetId: number; transfers: Transfer[]; total: number | null };
const isMoney = (amount: number | null | undefined): amount is number => typeof amount === "number" && Number.isFinite(amount) && amount >= 0;
const currency = (value?: string | null) => value && /^[A-Z]{3}$/.test(value.trim().toUpperCase()) ? value.trim().toUpperCase() : null;

export function buildDashboardFlowDetails(snapshot: WorkspaceSnapshot, shared: SharedObligationSummary[], cashflow: ReturnType<typeof buildDashboardCashflow>, ctx: ParityConversionCtx, now = new Date()) {
  const localNow = limaClock(now), today = format(localNow, "yyyy-MM-dd"), endDay = format(addDays(localNow, 30), "yyyy-MM-dd");
  const convert = (amount: number | null | undefined, code?: string | null) => {
    if (!isMoney(amount) || !currency(code)) return null;
    const result = convertParityAmount({ amount, currencyCode: code!, baseCurrencyCode: ctx.baseCurrency, targetCurrencyCode: ctx.displayCurrency, exchangeRateMap: ctx.exchangeRateMap });
    return isMoney(result) ? result : null;
  };
  const byId = new Map(snapshot.obligations.filter(row => row.workspaceId === snapshot.workspace.id).map(row => [row.id, row]));
  for (const row of shared) if (!byId.has(row.id)) byId.set(row.id, row);
  const receivables = [...byId.values()].filter(row => row.status === "active" && obligationViewerDirection(row) === "receivable").map(row => ({
    id: row.id, title: row.title, counterparty: row.counterparty, nativeAmount: row.pendingAmount, currency: currency(row.currencyCode),
    dueDay: limaCalendarDay(row.dueDate), invalidDate: Boolean(row.dueDate && !limaCalendarDay(row.dueDate)), amount: convert(row.pendingAmount, row.currencyCode),
  })).sort((a, b) => (a.dueDay ?? "9999").localeCompare(b.dueDay ?? "9999"));
  const receivablesMissing = receivables.filter(row => row.amount === null).length;

  // The monetary calendar intentionally drops lines without FX. A presence-only run of the SAME
  // cadence engine recovers their dates (1 means one occurrence, never one unit of money).
  // Its balances/totals are not consumed. Displayed monetary amounts still come from cashflow.
  let invalidSubscriptions = 0;
  const subscriptions = snapshot.subscriptions.filter(row => row.workspaceId === snapshot.workspace.id && row.status === "active").flatMap(row => {
    const nextDueDate = limaCalendarDay(row.nextDueDate), endDate = limaCalendarDay(row.endDate);
    if (!nextDueDate || row.endDate && !endDate || !isMoney(row.amount) || !currency(row.currencyCode)
      || !["daily", "weekly", "monthly", "quarterly", "yearly", "custom"].includes(row.frequency)
      || row.intervalCount != null && (!Number.isSafeInteger(row.intervalCount) || row.intervalCount <= 0)) { invalidSubscriptions++; return []; }
    return [{ ...row, nextDueDate, endDate }];
  });
  const manifest = buildCashflowCalendar({ startingBalance: 0, fromDate: today, months: 3, subscriptions,
    recurringIncome: [], obligations: [], plannedMovements: [], creditCards: [], typicalDiscretionarySpend: 0, convert: amount => amount > 0 ? 1 : 0 });
  const monetaryCharges = upcomingSubscriptionCharges(cashflow.projection.months, localNow);
  const charges = upcomingSubscriptionCharges(manifest.months, localNow).flatMap(item => {
    const subscription = subscriptions.find(row => row.id === item.id)!;
    const converted = convert(subscription.amount, subscription.currencyCode);
    if (converted !== null && converted <= 0.009) return []; // Same monetary epsilon as the calendar.
    const matches = monetaryCharges.filter(row => row.id === item.id && row.date.getTime() === item.date.getTime());
    const amount = converted !== null && matches.length === 1 && matches[0].amount !== null && Math.abs(matches[0].amount - converted) < 1e-8 ? matches[0].amount : null;
    return [{ id: item.id, title: subscription.name, day: format(item.date, "yyyy-MM-dd"), amount,
      nativeAmount: subscription.amount, currency: currency(subscription.currencyCode), missingConversion: converted === null }];
  });
  const chargesMissing = invalidSubscriptions + charges.filter(row => row.amount === null).length;
  const names = new Map(snapshot.accounts.filter(row => row.workspaceId === snapshot.workspace.id).map(row => [row.id, row.name.replace(/^Cuenta\s+(?=\D)/i, "")]));
  const routesByKey = new Map<string, Route>();
  const fromTime = now.getTime() - 90 * 86400000;
  for (const movement of snapshot.movements) {
    const occurred = new Date(movement.occurredAt).getTime(), sourceId = movement.sourceAccountId, targetId = movement.destinationAccountId;
    if (movement.workspaceId !== snapshot.workspace.id || movement.movementType !== "transfer" || movement.status !== "posted" || !sourceId || !targetId
      || !Number.isSafeInteger(sourceId) || !Number.isSafeInteger(targetId) || sourceId <= 0 || targetId <= 0 || !Number.isFinite(occurred) || occurred < fromTime || occurred > now.getTime()) continue;
    const key = `${sourceId}-${targetId}`, sourceCurrency = currency(ctx.accountCurrencyMap.get(sourceId) ?? movement.sourceCurrencyCode), destinationCurrency = currency(ctx.accountCurrencyMap.get(targetId) ?? movement.destinationCurrencyCode);
    const transfer = { movement, amount: convert(movement.sourceAmount, sourceCurrency), sourceCurrency, destinationCurrency };
    const route = routesByKey.get(key) ?? { key, sourceId, targetId, srcName: names.get(sourceId) ?? `Cuenta ${sourceId}`, dstName: names.get(targetId) ?? `Cuenta ${targetId}`, transfers: [], total: 0 };
    route.transfers.push(transfer); route.total = route.total === null || transfer.amount === null ? null : route.total + transfer.amount;
    routesByKey.set(key, route);
  }
  const allRoutes = [...routesByKey.values()];
  const routesMissing = allRoutes.reduce((sum, row) => sum + row.transfers.filter(item => item.amount === null).length, 0);
  const routesRanked = routesMissing === 0;
  // Missing currencies can change the top three: never rank the known subset as the whole ledger.
  const routes = routesRanked ? allRoutes.sort((a, b) => b.total! - a.total!).slice(0, 3) : allRoutes;
  const commitments = cashflow.projection.months.flatMap(month => [
    ...month.inflows.filter(line => line.kind !== "typical_spend").map(line => ({ ...line, direction: "inflow" as const })),
    ...month.outflows.filter(line => line.kind !== "typical_spend").map(line => ({ ...line, direction: "outflow" as const })),
  ]).sort((a, b) => (a.dueDate ?? today).localeCompare(b.dueDate ?? today));
  // Missing-FX metadata is per month, not per dated line. Withhold totals for affected months
  // conservatively, but do not let an unknown commitment six months away invalidate this week.
  const windowsBaseComplete = cashflow.liquid.unconvertedCount === 0 && invalidSubscriptions === 0 && Number.isFinite(cashflow.liquid.total);
  const windows = cashflow.windows.map(window => {
    const endDay = format(addDays(localNow, window.days), "yyyy-MM-dd");
    const missingMonth = cashflow.projection.months.some(month => month.monthKey <= endDay.slice(0, 7) && month.unconvertedCount > 0);
    const missingCharge = charges.some(row => row.day <= endDay && row.amount === null);
    return { ...window, endDay, complete: windowsBaseComplete && !missingMonth && !missingCharge && [window.estimatedBalance, window.expectedInflow, window.expectedOutflow].every(Number.isFinite),
      commitments: commitments.filter(line => parseISO(line.dueDate ?? today) <= endOfDay(addDays(localNow, window.days))),
    };
  });
  return { today, endDay, routeFrom: isoToDateStr(new Date(fromTime).toISOString()), receivables, receivablesMissing,
    receivablesTotal: receivablesMissing ? null : receivables.reduce((sum, row) => sum + row.amount!, 0),
    charges, chargesMissing, invalidSubscriptions, chargesTotal: chargesMissing ? null : charges.reduce((sum, row) => sum + row.amount!, 0),
    routes, routesRanked, routesMissing, windows };
}
