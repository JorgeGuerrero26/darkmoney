import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { React, act, dom, createRoot, load, mock, MemoryRouter, settle } from "./lib/web-ui-harness.mjs";

const model = await import(load("src/modules/recurring-income/lib/recurring-income-parity.ts"));
function original(path, names) {
  const text = readFileSync(new URL(path, import.meta.url), "utf8"), ast = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const nodes = ast.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text)); assert.equal(nodes.length, names.length);
  return ts.transpileModule(nodes.map(node => node.getText(ast).replace(/^export /, "")).join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
}
const require = createRequire(new URL("../../DarkMoneyApp/package.json", import.meta.url)), dates = require("date-fns");
const nativeNext = new Function("addDays", "addWeeks", "addMonths", "addYears", `${original("../../DarkMoneyApp/lib/subscription-helpers.ts", ["computeNextRecurringDate", "parseLocalYmd", "toLocalYmd", "clampDayOfMonth", "daysInMonthOf"])};return computeNextRecurringDate;`)(dates.addDays, dates.addWeeks, dates.addMonths, dates.addYears);
const nativePending = new Function("computeNextRecurringDate", `${original("../../DarkMoneyApp/features/recurring-income/lib/recurringIncomeStanding.ts", ["parseYmd", "daysBetween", "missedArrivalDates"])};return missedArrivalDates;`)(nativeNext);
const income = { id: 9, workspaceId: 8, name: "Ingreso de prueba", status: "active", amount: 100, currencyCode: "PEN", amountInBaseCurrency: 100, accountId: 1, frequency: "monthly", intervalCount: 1, nextExpectedDate: "2026-01-31", dayOfMonth: 31, remindDaysBefore: 1, startDate: "2026-01-01" };
let comparisons = 0;
for (const nextExpectedDate of ["2024-01-31", "2024-02-29", "2025-02-28", "2026-01-31", "2026-04-30", "2026-12-31"])
  for (const frequency of ["daily", "weekly", "monthly", "quarterly", "yearly", "custom"])
    for (const intervalCount of [1, 2, 7, 12]) for (const dayOfMonth of [null, 1, 28, 29, 30, 31]) {
      const item = { ...income, nextExpectedDate, frequency, intervalCount, dayOfMonth };
      assert.equal(model.advanceNextExpectedDate(item), nativeNext(nextExpectedDate, frequency, intervalCount, dayOfMonth));
      assert.deepEqual(model.pendingArrivalDates(item, "2027-03-01"), nativePending(item, "2027-03-01")); comparisons += 2;
    }
assert.equal(model.advanceNextExpectedDate({ ...income, nextExpectedDate: "2026-02-28" }), "2026-03-31");
const daily = { ...income, frequency: "daily", dayOfMonth: null, nextExpectedDate: "2025-01-01" }, dayAfter = count => new Date(Date.parse("2025-01-01T12:00:00Z") + count * 86400000).toISOString().slice(0, 10);
for (const count of [0, 1, 399, 400, 401, 10000]) {
  const schedule = model.pendingArrivalCalendar(daily, dayAfter(count)); assert.equal(schedule.dates.length, Math.min(count, 400)); assert.equal(schedule.hasMore, count > 400); assert.equal(schedule.unavailable, false);
}
for (const status of ["paused", "cancelled"]) assert.deepEqual(model.pendingArrivalCalendar({ ...daily, status }, dayAfter(401)), { dates: [], hasMore: false, unavailable: false });
for (const patch of [{ nextExpectedDate: "bad" }, { nextExpectedDate: "2026-02-30" }, { intervalCount: 0 }, { intervalCount: -1 }, { intervalCount: 1.5 }, { intervalCount: NaN }, { intervalCount: Infinity }, { intervalCount: Number.MAX_SAFE_INTEGER }, { dayOfMonth: 32 }, { dayOfMonth: 0 }, { frequency: "unknown" }, { status: "unknown" }]) {
  const schedule = model.pendingArrivalCalendar({ ...daily, ...patch }, "2026-10-18"); assert.equal(schedule.unavailable, true, JSON.stringify(patch)); assert.deepEqual(schedule.dates, []); assert.equal(schedule.hasMore, false);
}
for (const patch of [{ intervalCount: 0 }, { nextExpectedDate: "2026-02-30" }, { frequency: "unknown" }, { dayOfMonth: 32 }]) assert.throws(() => model.advanceNextExpectedDate({ ...income, ...patch }), /calendario/);
assert.equal(model.pendingArrivalCalendar(daily, "bad").unavailable, true);
assert.throws(() => model.advanceNextExpectedDate({ ...income, frequency: "yearly", nextExpectedDate: "9999-12-31" }), /fecha válida/);
assert.deepEqual(model.summarizePendingIncome([daily, { ...income, nextExpectedDate: "2025-01-01", intervalCount: 0 }, { ...income, status: "paused" }], dayAfter(401)), { count: 400, incomeCount: 1, hasMore: true, unavailableCount: 1 });
assert.equal(model.pendingArrivalCalendar({ ...daily, nextExpectedDate: "2026-10-18" }, "2026-10-18").dates.length, 0, "Today is not overdue");
// The mobile *helper* honors the anchor, but the actual arrival caller still omits it. Document, don't copy that drift.
const nativeCode = original("../../DarkMoneyApp/services/queries/workspace-data.ts", ["useConfirmRecurringIncomeArrivalMutation", "joinNotes", "formatAmountWithCurrency"]) + ";" + original("../../DarkMoneyApp/features/recurring-income/lib/buildIncomeArrival.ts", ["buildIncomeArrival"]);
const nativeClient = { from: () => ({ insert: () => Promise.resolve({ error: null }), update() { return this; }, eq() { return this; }, then(resolve) { resolve({ error: null }); } }) };
const mobileHook = new Function("useQueryClient", "useOfflineFlag", "useMutation", "supabase", "offlineRuntime", "computeNextRecurringDate", "createMovement", "dateStrToISO", `${nativeCode};return useConfirmRecurringIncomeArrivalMutation(8);`)(() => ({}), () => ({ enabled: false }), options => options, nativeClient, { assertCompoundOnline() {}, async confirmArrival() { return null; } }, nativeNext, async () => ({ id: 400 }), day => `${day}T12:00:00-05:00`);
const mobileResult = await mobileHook.mutationFn({ recurringIncomeId: 9, expectedDate: "2026-02-28", actualDate: "2026-02-28", amount: 100, currencyCode: "PEN", accountId: 1, currentAccountId: 1, currentBaseAmount: 100, newBaseAmount: null, recurringIncomeName: income.name, notes: "", frequency: "monthly", intervalCount: 1, dayOfMonth: 31, baseChangeKind: null });
assert.equal(mobileResult.nextExpectedDate, "2026-03-28"); assert.notEqual(mobileResult.nextExpectedDate, model.advanceNextExpectedDate({ ...income, nextExpectedDate: "2026-02-28" }));

// Actual page, list, history and arrival dialog with fixture reads; every financial write is forbidden.
const originalNow = Date.now; Date.now = () => Date.parse(`${dayAfter(401)}T16:00:00Z`);
globalThis.calendarRows = [daily];
mock("src/modules/auth/auth-context.tsx", "export const useAuth=()=>({user:{id:'A'},profile:null});");
mock("src/modules/workspaces/use-active-workspace.ts", "export const useActiveWorkspace=()=>({activeWorkspace:{id:8,role:'owner',baseCurrencyCode:'PEN'},isLoading:false,isFetching:false});");
mock("src/components/ui/toast-provider.tsx", "export const useSuccessToast=()=>{};");
mock("src/components/ui/undo-queue.tsx", "export const useUndoQueue=()=>({cancel:()=>{},schedule:()=>{throw Error('Unexpected delete')}});");
mock("src/services/queries/workspace-data.ts", `export const useWorkspaceSnapshotQuery=()=>({data:{workspace:{id:8,baseCurrencyCode:'PEN'},recurringIncome:globalThis.calendarRows,accounts:[{id:1,workspaceId:8,currencyCode:'PEN',isArchived:false,name:'Prueba'}],catalogs:{categories:[],counterparties:[]},movements:[],exchangeRates:[]},isSuccess:true,isFetching:false,isPlaceholderData:false}); const mutation=()=>({isPending:false,mutateAsync:async()=>{throw Error('Unexpected financial write')}});export const useCreateRecurringIncomeMutation=mutation,useUpdateRecurringIncomeMutation=mutation,useDeleteRecurringIncomeMutation=mutation,useSetRecurringIncomeFlagsMutation=mutation,useConfirmRecurringIncomeArrivalMutation=mutation;export const useRecurringIncomeOccurrencesQuery=()=>({data:[],isSuccess:true,isFetching:false,isPlaceholderData:false});export const getQueryErrorMessage=error=>error?.message??'';`);
const { RecurringIncomePage } = await import(load("src/modules/recurring-income/pages/recurring-income-page.tsx"));
const container = document.createElement("div"); document.body.append(container); const renderer = createRoot(container);
async function render() { await act(async () => renderer.render(React.createElement(MemoryRouter, null, React.createElement(RecurringIncomePage)))); await settle(); }
const button = label => [...container.querySelectorAll("button")].find(node => node.textContent.trim() === label);
async function click(label) { const node = button(label); assert.ok(node, label); await act(async () => node.click()); await settle(); }
async function menu() { await act(async () => container.querySelector(`button[aria-label="Acciones de ${income.name}"]`).click()); }
await render(); assert.match(container.querySelector("h1").parentElement.textContent, /al menos 400 llegadas sin confirmar/);
await menu(); await click("Ver historial"); assert.match(container.textContent, /al menos 400 pendientes/); assert.match(container.textContent, /primeras 400 fechas/);
await act(async () => container.querySelector('button[aria-label="Cerrar"]').click());
globalThis.calendarRows = [{ ...daily, nextExpectedDate: dayAfter(1) }]; await render(); assert.match(container.querySelector("h1").parentElement.textContent, /400 llegadas sin confirmar/); assert.doesNotMatch(container.querySelector("h1").parentElement.textContent, /al menos/);
globalThis.calendarRows = [{ ...daily, intervalCount: 0 }]; await render(); assert.match(container.textContent, /llegadas pendientes por comprobar/); await menu(); await click("Confirmar llegada"); assert.equal(container.querySelector("form"), null); assert.match(container.textContent, /No se registró dinero/);
await menu(); await click("Ver historial"); assert.match(container.textContent, /pendientes por comprobar/); assert.equal(button("Anotar llegada"), undefined); await act(async () => container.querySelector('button[aria-label="Cerrar"]').click());
globalThis.calendarRows = [{ ...daily, nextExpectedDate: "bad" }]; await render(); assert.match(container.textContent, /Fecha por comprobar/); await menu(); await click("Ver historial"); assert.match(container.textContent, /fecha por comprobar/); await act(async () => container.querySelector('button[aria-label="Cerrar"]').click());
globalThis.calendarRows = [daily]; await render(); await menu(); await click("Confirmar llegada"); assert.ok(container.querySelector("form")); globalThis.calendarRows = [{ ...daily, nextExpectedDate: "bad" }]; await render(); assert.ok(button("Revisa la próxima llegada").disabled); assert.match(container.textContent, /fecha por comprobar/);
await act(async () => renderer.unmount()); container.remove(); Date.now = originalNow; dom.window.close();
console.log(`recurring-income-calendar: OK (${comparisons} actual mobile next-date/pending comparisons incl anchors, leap/custom/interval; exact400 vs401, lower-bound/invalid states, real header/history/list/arrival no-write guards; mobile arrival anchor omission remains documented, not changed)`);
