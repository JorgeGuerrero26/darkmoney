import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { React, act, createRoot, dom, load, mock, h, settle, change, MemoryRouter } from "./lib/web-ui-harness.mjs";

const model = await import(load("src/modules/recurring-income/lib/scheduled-changes.ts"));
const native = await import(load("../DarkMoneyApp/features/recurring-income/lib/scheduledChanges.ts"));
const { parseFormAmountInput } = await import(load("../DarkMoneyApp/lib/form-field-rules.ts"));
const { buildRecurringIncomeEditorInput } = await import(load("src/modules/shared/recurring-editor-input.ts"));
const { buildCashflowCalendar } = await import(load("src/modules/dashboard/lib/projection/cashflow-calendar.ts"));
const { buildCashflowCalendar: nativeCalendar } = await import(load("../DarkMoneyApp/features/projection/lib/cashflow-calendar.ts"));
const { summarizeRecurringIncomeMonthly } = await import(load("src/modules/recurring-income/lib/recurring-income-parity.ts"));
mock("src/services/supabase/client.ts", "export const supabase=null;");
const { readProjectionSupplement } = await import(load("src/services/queries/dashboard-projection.ts"));
const originalDate = Date, instant = Date.parse("2026-10-18T16:00:00Z"), today = "2026-10-18";
globalThis.Date = class extends originalDate { constructor(...args) { super(...(args.length ? args : [instant])); } static now() { return instant; } };
const changes = [{ effectiveDate: "2027-01-01", amount: 150.5 }, { effectiveDate: "2026-09-01", amount: 120 }, { effectiveDate: "2027-01-01", amount: 170 }];
let comparisons = 0;
for (const input of [undefined, null, [], changes, [...changes].reverse(), [{ effectiveDate: "2028-02-29", amount: 0.01 }]]) {
  assert.deepEqual(model.normalizeIncomeScheduledChanges(input), native.normalizeScheduledChanges(input));
  assert.deepEqual(model.incomeScheduledChangeRows(input), native.toScheduledChangesRows(input));
  assert.deepEqual(model.incomeScheduledChangeDrafts(input), native.toChangeDrafts(input)); comparisons += 3;
}
for (const amount of ["4500,50", "1,200.50", "1.200,50", "1,500", "1.500", "1 200,50", "1234.5", "0.01", "100", "1,234,567", "1.234.567", "12,345.67"]) {
  assert.equal(model.parseScheduledAmountInput(amount), parseFormAmountInput(amount)); comparisons++;
  const drafts = [{ key: "1", date: "2027-01-01", amount }]; assert.deepEqual(model.collectIncomeScheduledChanges(drafts), native.collectChanges(drafts)); comparisons++;
}
assert.deepEqual(model.readIncomeScheduledChanges([{ effective_date: "2027-01-01", amount: "150.50" }]), native.parseScheduledChanges([{ effective_date: "2027-01-01", amount: "150.50" }])); comparisons++;
for (const amount of ["S/ 100", "100abc", "true", "Infinity", "-1", "0", "1.23.4,5", "1234.567", "1e3", "", "1,20,30"]) assert.equal(model.parseScheduledAmountInput(amount), null, amount);
for (const raw of [undefined, {}, [null], [true], [{ effective_date: "2027-02-30", amount: 100 }], [{ effective_date: "2027-01-01", amount: true }], [{ effective_date: "2027-01-01", amount: null }], [{ effective_date: "2027-01-01", amount: "1e3" }], [{ effective_date: "2027-01-01", amount: -1 }], [{ effective_date: "2027-01-01", amount: 1.001 }]]) assert.throws(() => model.readIncomeScheduledChanges(raw), /cambios de monto/);
for (const row of [{ date: "", amount: "" }, { date: "2027-01-01", amount: "" }, { date: "", amount: "100" }, { date: "2027-02-30", amount: "100" }, { date: "2027-01-01", amount: "100x" }]) assert.throws(() => model.collectIncomeScheduledChanges([{ key: "bad", ...row }]), /Completa o quita/);

function original(path, name, env) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  const node = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name); assert.ok(node, name);
  const code = ts.transpileModule(node.getText(ast).replace(/^export /, ""), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(env), `${code};return ${name};`)(...Object.values(env));
}
const income = { id: 9, workspaceId: 8, name: "Ingreso de prueba", amount: 100, amountInBaseCurrency: 100, currencyCode: "PEN", accountId: 1, payerPartyId: null, categoryId: null, status: "active", frequency: "monthly", intervalCount: 1, dayOfMonth: 18, dayOfWeek: null, startDate: "2026-01-01", nextExpectedDate: today, endDate: null, remindDaysBefore: 3, grossAmount: null, deductions: [], isPinned: false, scheduledChanges: model.normalizeIncomeScheduledChanges(changes) };
const snapshot = { workspace: { id: 8, baseCurrencyCode: "PEN" }, accounts: [{ id: 1, workspaceId: 8, currencyCode: "PEN", name: "Prueba", isArchived: false }], catalogs: { categories: [], counterparties: [] }, movements: [], recurringIncome: [income], exchangeRates: [] };
const path = "src/modules/recurring-income/pages/recurring-income-page.tsx";
const createForm = original(path, "createDefaultFormState", {}), hydrate = original(path, "buildFormStateFromRecurringIncome", { incomeScheduledChangeDrafts: model.incomeScheduledChangeDrafts, toDateInputValue: value => value.slice(0, 10) });
assert.deepEqual(createForm("PEN").scheduledChanges, []);
const value = hydrate(income), input = buildRecurringIncomeEditorInput(value, snapshot, false);
assert.deepEqual(input.scheduledChanges, income.scheduledChanges); assert.equal(input.amount, 100);
assert.deepEqual(buildRecurringIncomeEditorInput({ ...value, name: "Nombre cambiado" }, snapshot, false).scheduledChanges, income.scheduledChanges);
assert.deepEqual(buildRecurringIncomeEditorInput({ ...value, scheduledChanges: [] }, snapshot, false).scheduledChanges, []);
assert.throws(() => buildRecurringIncomeEditorInput({ ...value, scheduledChanges: [{ key: "bad", date: "", amount: "100" }] }, snapshot, false), /cambios de monto/);

// Actual snapshot select and mapper, including schema failures; no silent lost changes in an unrelated edit.
let rawChanges = model.incomeScheduledChangeRows(changes), readError = null, selects = [];
const row = { id: 9, workspace_id: 8, name: income.name, currency_code: "PEN", amount: "100", gross_amount: null, deductions: [], status: "active", interval_count: 1, frequency: "monthly", next_expected_date: today };
const client = { from(table) { return {
  select(columns) { selects.push({ table, columns }); return this; }, eq() { return this; }, order() { return this; }, limit() { return this; }, range() { return this; }, in() { return this; }, abortSignal() { return this; }, maybeSingle() { return Promise.resolve({ data: null, error: null }); }, then(resolve) { resolve({ data: table === "recurring_income" ? [{ ...row, scheduled_changes: rawChanges }] : [], error: table === "recurring_income" ? readError : null }); },
}; } };
const readSnapshot = original("src/services/queries/workspace-data.ts", "fetchWorkspaceSnapshot", { getClient: () => client, normalizeCurrencyCode: value => value, toNumber: Number, convertAmountToCurrency: amount => amount, buildExchangeRateMap: () => new Map(), buildCashflow: () => [], readIncomeScheduledChanges: model.readIncomeScheduledChanges, isMissingRelationError: error => error?.code === "42P01" });
assert.deepEqual((await readSnapshot(snapshot.workspace, "A")).recurringIncome[0].scheduledChanges, income.scheduledChanges);
assert.deepEqual((await readProjectionSupplement(client, 8, new AbortController().signal)).scheduledChanges[0].changes, income.scheduledChanges);
assert.ok(selects.some(call => call.table === "recurring_income" && call.columns.includes("scheduled_changes")));
rawChanges = [{ effective_date: "bad", amount: 100 }]; await assert.rejects(readSnapshot(snapshot.workspace, "A"), /cambios de monto/);
await assert.rejects(readProjectionSupplement(client, 8, new AbortController().signal), /cambios de monto/);
for (const error of [{ code: "42703", message: "column recurring_income.scheduled_changes missing" }, { code: "42501", message: "permission denied recurring_income" }, { message: "recurring_income network failed" }]) { readError = error; await assert.rejects(readSnapshot(snapshot.workspace, "A"), found => found === error); }
readError = null;
const invalidations = [], invalidate = original("src/services/queries/workspace-data.ts", "invalidateWorkspaceSnapshot", {});
await invalidate({ invalidateQueries: async value => invalidations.push(value) }, 8, "A"); assert.ok(invalidations.some(value => JSON.stringify(value.queryKey) === '["dashboard-projection-inputs",8]'));

// Native projection applies changes on/after their dates, never mutates base, standing, or received rows.
for (const frequency of ["daily", "weekly", "monthly", "quarterly", "yearly"]) for (const fromDate of ["2026-10-18", "2027-01-01", "2028-02-29"]) {
  const args = { startingBalance: 0, fromDate, months: 3, convert: amount => amount, typicalDiscretionarySpend: 0, subscriptions: [], recurringIncome: [{ ...income, frequency, nextExpectedDate: fromDate }], obligations: [], plannedMovements: [], creditCards: [] };
  assert.deepEqual(buildCashflowCalendar(args), nativeCalendar(args)); comparisons++;
}
const calendarArgs = { startingBalance: 0, fromDate: "2026-12-01", months: 2, convert: amount => amount, typicalDiscretionarySpend: 0, subscriptions: [], recurringIncome: [{ ...income, nextExpectedDate: "2026-12-18" }], obligations: [], plannedMovements: [], creditCards: [] };
const projected = buildCashflowCalendar(calendarArgs); assert.equal(projected.months[0].inflows[0].amount, 120); assert.equal(projected.months[1].inflows[0].amount, 170); assert.equal(income.amount, 100);
assert.equal(summarizeRecurringIncomeMonthly([income], "PEN").monthlyTotal, 100, "Same as native: monthly headline uses current base, not a future projected raise");

// Real page/shared create+edit editor. Fake writes only record the schedule, never a movement or arrival.
globalThis.changesSnapshot = snapshot; globalThis.changesWrites = []; globalThis.changesQuery = { data: snapshot, isSuccess: true, isFetching: false, isPlaceholderData: false };
mock("src/modules/auth/auth-context.tsx", "export const useAuth=()=>({user:{id:'A'},profile:null});");
mock("src/modules/workspaces/use-active-workspace.ts", "export const useActiveWorkspace=()=>({activeWorkspace:{id:8,baseCurrencyCode:'PEN',role:'owner'},isLoading:false,isFetching:false});");
mock("src/components/ui/toast-provider.tsx", "export const useSuccessToast=()=>{};");
mock("src/components/ui/undo-queue.tsx", "export const useUndoQueue=()=>({schedule:()=>{throw Error('Unexpected deletion')},cancel:()=>{}});");
mock("src/services/queries/workspace-data.ts", `export const useWorkspaceSnapshotQuery=()=>globalThis.changesQuery;const mutation=kind=>({isPending:false,mutateAsync:async value=>{if(!['create','update'].includes(kind))throw Error('Unexpected financial write');globalThis.changesWrites.push({kind,value});return {id:value.recurringIncomeId??88,workspaceId:8};}});export const useCreateRecurringIncomeMutation=()=>mutation('create'),useUpdateRecurringIncomeMutation=()=>mutation('update'),useDeleteRecurringIncomeMutation=()=>mutation('delete'),useSetRecurringIncomeFlagsMutation=()=>mutation('flags'),useConfirmRecurringIncomeArrivalMutation=()=>mutation('arrival');export const useRecurringIncomeOccurrencesQuery=()=>({data:[],isSuccess:true,isFetching:false});export const getQueryErrorMessage=error=>error?.message??'';`);
const editorUrl = load("src/modules/recurring-income/components/recurring-income-editor-dialog.tsx");
mock("src/modules/recurring-income/components/recurring-income-editor-dialog.tsx", `${h} export * from '${editorUrl}';import {RecurringIncomeEditorDialog as Real} from '${editorUrl}';export const RecurringIncomeEditorDialog=p=>{globalThis.changesEditor=p;return h(Real,p);};`);
const { RecurringIncomePage } = await import(load(path));
const container = document.createElement("div"); document.body.append(container); const renderer = createRoot(container);
const button = label => [...document.querySelectorAll("button")].find(node => node.textContent.trim() === label);
async function click(label) { const target = button(label); assert.ok(target, label); await act(async () => target.click()); await settle(); }
async function render() { await act(async () => renderer.render(React.createElement(MemoryRouter, null, React.createElement(RecurringIncomePage)))); await settle(); }
async function openEdit() { await act(async () => container.querySelector('button[aria-label="Acciones de Ingreso de prueba"]').click()); await click("Editar"); }
async function destination(label) { const target = [...container.querySelectorAll("button")].find(node => node.firstElementChild?.textContent === label); assert.ok(target, label); await act(async () => target.click()); await settle(); }
const back = async () => { await act(async () => container.querySelector('button[aria-label="Volver"]').click()); await settle(); };
await render(); await openEdit(); assert.deepEqual(globalThis.changesEditor.formState.scheduledChanges, model.incomeScheduledChangeDrafts(changes));
await destination("Detalles"); await destination("Cambios de monto"); assert.equal(container.querySelector("h2").textContent, "Cambios de monto"); assert.match(container.textContent, /No confirma llegadas/);
await change(container.querySelector('input[aria-label="Monto del cambio 2"]'), "1,200.50"); await back(); await back(); assert.equal(container.querySelector("h2").textContent, "Editar ingreso fijo");
globalThis.changesQuery = { ...globalThis.changesQuery, data: { ...snapshot, recurringIncome: [{ ...income, description: "Read refresh" }] } }; await render(); assert.equal(globalThis.changesEditor.formState.scheduledChanges[1].amount, "1,200.50");
await click("Guardar cambios"); assert.equal(globalThis.changesWrites.length, 1); assert.equal(globalThis.changesWrites[0].value.scheduledChanges[1].amount, 1200.5); assert.equal(globalThis.changesWrites[0].value.amount, 100); assert.equal(container.querySelector("form"), null);
await openEdit(); await destination("Detalles"); await destination("Cambios de monto"); await click("Añadir cambio de monto"); await click("Guardar cambios"); assert.equal(globalThis.changesWrites.length, 1); assert.match(container.textContent, /Completa o quita/); assert.equal(container.querySelector("h2").textContent, "Cambios de monto");
await act(async () => container.querySelector('button[aria-label="Quitar cambio 3"]').click()); await act(async () => container.querySelector('button[aria-label="Quitar cambio 2"]').click()); await act(async () => container.querySelector('button[aria-label="Quitar cambio 1"]').click()); await click("Guardar cambios"); assert.deepEqual(globalThis.changesWrites.at(-1).value.scheduledChanges, []);
await act(async () => container.querySelector('[data-tour="create-recurring-income"]').click()); await change(container.querySelector('input[placeholder="Ej. Sueldo mensual"]'), "Nuevo con aumento"); await change(container.querySelector('input[placeholder="0.00"]'), "100");
await act(async () => globalThis.changesEditor.updateFormState("nextExpectedDate", today)); await destination("Detalles"); await destination("Cambios de monto"); await click("Añadir cambio de monto"); await change(container.querySelector('input[aria-label="Monto del cambio 1"]'), "150,50");
await click("Elegir fecha del cambio"); const dayLabel = new Intl.DateTimeFormat("es-PE", { dateStyle: "full" }).format(new Date());
await act(async () => { const day = [...document.querySelectorAll("button[aria-label]")].find(node => node.getAttribute("aria-label") === dayLabel); assert.ok(day, dayLabel); day.click(); }); await settle(); assert.equal(globalThis.changesEditor.formState.scheduledChanges[0].date, today);
await click("Crear ingreso fijo"); assert.equal(globalThis.changesWrites.at(-1).kind, "create"); assert.deepEqual(globalThis.changesWrites.at(-1).value.scheduledChanges, [{ effectiveDate: today, amount: 150.5 }]); assert.equal(globalThis.changesWrites.at(-1).value.amount, 100);
await openEdit(); const beforeConflict = globalThis.changesWrites.length; globalThis.changesQuery = { ...globalThis.changesQuery, data: { ...snapshot, recurringIncome: [{ ...income, scheduledChanges: [{ effectiveDate: "2027-01-01", amount: 999 }] }] } }; await render(); await click("Guardar cambios"); assert.equal(globalThis.changesWrites.length, beforeConflict); assert.match(container.textContent, /no se envió esta edición/);
await act(async () => renderer.unmount()); container.remove(); dom.window.close(); globalThis.Date = originalDate;
console.log(`recurring-income-changes: OK (${comparisons} actual mobile model/amount/calendar comparisons; strict dates/money/incomplete rows, preserved old+future changes, actual snapshot/payload/editor/create/edit/calendar, explicit removal, refresh and projection invalidation; fake IO, not server/RLS)`);
