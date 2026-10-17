import assert from "node:assert/strict";
import { React, act, createRoot, dom, load, mock, h, settle, change, MemoryRouter } from "./lib/web-ui-harness.mjs";
import { useLocation } from "react-router-dom";

const originalDate = Date, originalTz = process.env.TZ;
process.env.TZ = "America/Lima";
const instant = originalDate.parse("2026-10-17T16:00:00Z"), today = "2026-10-17";
globalThis.Date = class extends originalDate { constructor(...args) { super(...(args.length ? args : [instant])); } static now() { return instant; } };
const model = await import(load("src/modules/recurring-income/lib/recurring-income-filters.ts"));
const native = await import(load("../DarkMoneyApp/features/recurring-income/lib/recurringIncomeFilters.ts"));
const { useRecurringIncomeFilters } = await import(load("src/modules/recurring-income/hooks/use-recurring-income-filters.ts"));
const { IncomeFiltersToolbar } = await import(load("src/modules/recurring-income/components/income-filters-toolbar.tsx"));
const defaults = model.defaultRecurringIncomeTableFilters;
const rows = Array.from({ length: 36 }, (_, i) => ({
  id: i + 1, workspaceId: 8, name: i % 2 ? "Sueldo" : "Otros", payer: "Empresa", payerPartyId: i % 3 + 10,
  categoryName: "Ingresos", categoryId: i % 4 + 20, accountName: "Principal", accountId: i % 2 + 30,
  amount: 100, amountInBaseCurrency: 100, currencyCode: "PEN", frequency: model.incomeFrequencyValues[i % 6], intervalCount: 1,
  status: model.incomeStatusValues[Math.floor(i / 6) % 3], isPinned: i % 2 === 0,
  nextExpectedDate: ["2026-10-16", today, "2026-11-16", "2026-11-17"][i % 4], description: "Descripción especial", notes: "Nota final",
}));
let comparisons = 0;
for (const statuses of [[], ["active"], ["paused", "cancelled"], ["active", "paused"]])
  for (const frequencies of [[], ["monthly"], ["daily", "weekly"], ["quarterly", "yearly", "custom"]])
    for (const pinnedOnly of [false, true]) for (const name of ["", "sueldo", "empresa", "especial nota", "no existe"])
      for (const advanced of [{}, { payerId: 10 }, { categoryId: 21 }, { accountId: 31 }, { payerId: 12, accountId: 30, categoryId: 22 }, { payerId: 999 }])
        for (const upcomingOnly of [false, true]) {
          const web = model.filterRecurringIncome(rows, { ...defaults(), selectedStatuses: statuses, selectedFrequencies: frequencies, pinnedOnly, name, upcomingOnly, ...advanced }, today);
          const mobile = native.filterRecurringIncome(rows, [...statuses, ...frequencies, ...(pinnedOnly ? ["pinned"] : [])], name, { payerId: null, accountId: null, categoryId: null, upcomingOnly, ...advanced });
          assert.deepEqual(web.map(row => row.id), mobile.map(row => row.id)); comparisons++;
        }
for (const field of ["payer", "category", "account"]) {
  const options = model.incomeReferenceOptions(rows, field, 999);
  assert.equal(new Set(options.map(option => option.value)).size, options.length);
  assert.equal(new Set(options.map(option => option.label)).size, options.length, "Homonyms must be distinguishable");
  assert.ok(options.some(option => option.value === "999"));
}
assert.deepEqual(model.filterRecurringIncome(rows, { ...defaults(), frequency: "monthly", status: "active", payer: "emp", amount: "100", nextExpectedDateFrom: today, nextExpectedDateTo: "2026-11-16" }, today).map(row => row.id), [3]);
assert.equal(model.filterRecurringIncome(rows, { ...defaults(), nextExpectedDateFrom: "2027-01-01", nextExpectedDateTo: today }, today).length, 0);
assert.equal(model.filterRecurringIncome(rows, { ...defaults(), payerId: 10, payer: "otro pagador" }, today).length, 0, "A legacy text filter remains explicit even beside an ID");
process.env.TZ = "Pacific/Auckland";
assert.deepEqual(model.filterRecurringIncome(rows, { ...defaults(), upcomingOnly: true }, today).map(row => row.id), rows.filter(row => row.nextExpectedDate >= today && row.nextExpectedDate <= "2026-11-16").sort((a,b) => a.nextExpectedDate.localeCompare(b.nextExpectedDate)).map(row => row.id));
process.env.TZ = "America/Lima";

let state, location;
function Probe() {
  state = useRecurringIncomeFilters(); location = useLocation();
  return React.createElement(React.Fragment, null, React.createElement(IncomeFiltersToolbar, { items: rows, filters: state.filters, onChange: state.updateFilters, onClear: state.clearFilters }), React.createElement("output", null, model.filterRecurringIncome(rows, state.filters, today).map(row => row.id).join(",")));
}
const container = document.createElement("div"); document.body.append(container); let renderer = createRoot(container);
async function click(label) { const button = [...document.querySelectorAll("button")].find(node => node.textContent.trim() === label); assert.ok(button, label); await act(async () => button.click()); await settle(); }
async function check(fieldset, label) { const group = [...container.querySelectorAll("fieldset")].find(node => node.querySelector("legend")?.textContent === fieldset); const node = [...group.querySelectorAll("label")].find(node => node.textContent.trim() === label)?.querySelector("input"); assert.ok(node, label); await act(async () => node.click()); await settle(); }
await act(async () => renderer.render(React.createElement(MemoryRouter, { initialEntries: ["/app/recurring-income?freq=monthly,weekly&freq=monthly&status=active&status=paused&account_id=31&page=3&resource=42"] }, React.createElement(Probe)))); await settle();
assert.deepEqual(state.filters.selectedFrequencies, ["monthly", "weekly"]); assert.deepEqual(state.filters.selectedStatuses, ["active", "paused"]); assert.equal(state.currentPage, 3); assert.equal(state.filters.accountId, 31);
assert.match(container.textContent, /Varias frecuencias \(2\)/); await click("Más filtros"); await check("Frecuencias combinadas", "Diaria");
assert.deepEqual(state.filters.selectedFrequencies, ["monthly", "weekly", "daily"]); assert.equal(state.currentPage, 1); assert.equal(new URLSearchParams(location.search).get("resource"), "42"); assert.equal(state.filters.accountId, 31);
await check("Estados combinados", "Pausado"); assert.equal(state.filters.status, "active"); assert.deepEqual(state.filters.selectedStatuses, []);
await click("Principal · #31"); await click("Principal · #30"); assert.equal(state.filters.accountId, 30); assert.equal(state.filters.account, "");
const options = document.querySelectorAll('[role="option"]'); assert.equal(options.length, 0, "Choosing ID closes picker");
await change(container.querySelector('input[aria-label="Buscar ingresos fijos"]'), "sueldo"); assert.equal(state.filters.accountId, 30); assert.equal(state.filters.selectedFrequencies.length, 3);
await act(async () => state.updateFilters({ frequency: "yearly", selectedFrequencies: [], status: "all", selectedStatuses: [], accountId: 999 })); await settle();
assert.equal(state.filters.frequency, "yearly"); assert.equal(container.querySelector("output").textContent, ""); assert.match(container.textContent, /Referencia #999/);
await act(async () => state.updateFilters({ payer: "Emp", category: "Ingresos", account: "Principal", payerId: null, categoryId: null, accountId: null })); await settle(); assert.match(container.textContent, /Filtro anterior por texto de pagador/);
await click("Quitar filtro de texto"); assert.equal(state.filters.payer, ""); assert.equal(state.filters.category, "Ingresos");
await click("Limpiar filtros"); assert.deepEqual(state.filters, defaults()); assert.equal(location.search, "?resource=42");
await act(async () => renderer.unmount()); renderer = createRoot(container);
await act(async () => renderer.render(React.createElement(MemoryRouter, { initialEntries: ["/app/recurring-income?freq=bogus,monthly,monthly&status=invalid,active&payer_id=-1&account_id=12oops&category_id=9007199254740992&page=-3"] }, React.createElement(Probe)))); await settle();
assert.equal(state.filters.frequency, "monthly"); assert.equal(state.filters.status, "active"); assert.equal(state.filters.payerId, null); assert.equal(state.filters.accountId, null); assert.equal(state.filters.categoryId, null); assert.equal(state.currentPage, 1);
await act(async () => renderer.unmount());

// Real page uses this same toolbar/model for all filtered rows, subtotal and export, not just 50 displayed rows.
const pageRows = Array.from({ length: 65 }, (_, i) => ({ ...rows[0], id: i + 1, name: `Ingreso ${i + 1}`, status: "active", frequency: i % 2 ? "weekly" : "monthly", nextExpectedDate: "2026-11-01", isPinned: false, accountId: i < 60 ? 30 : 31, payerPartyId: 10, categoryId: 20, grossAmount: null, deductions: [], remindDaysBefore: 1, startDate: today, dayOfMonth: 1, dayOfWeek: null }));
const snapshot = { workspace: { id: 8, baseCurrencyCode: "PEN" }, recurringIncome: [...pageRows, { ...pageRows[0], id: 99, workspaceId: 9, name: "Foreign" }], accounts: [], movements: [], exchangeRates: [], catalogs: { categories: [], counterparties: [] } };
globalThis.incomeFilterSnapshot = snapshot;
mock("src/modules/auth/auth-context.tsx", "export const useAuth=()=>({user:{id:'filter-test'},profile:null});");
mock("src/modules/workspaces/use-active-workspace.ts", "export const useActiveWorkspace=()=>({activeWorkspace:{id:8,baseCurrencyCode:'PEN',role:'viewer',isArchived:false},isLoading:false,isFetching:false});");
mock("src/components/ui/toast-provider.tsx", "export const useSuccessToast=()=>{};");
mock("src/components/ui/undo-queue.tsx", "export const useUndoQueue=()=>({schedule:()=>{throw Error('Unexpected write')},cancel:()=>{}});");
mock("src/services/queries/workspace-data.ts", `export const useWorkspaceSnapshotQuery=()=>({data:globalThis.incomeFilterSnapshot,isSuccess:true,isFetching:false,isPlaceholderData:false});
const mutation=()=>({isPending:false,mutateAsync:()=>{throw Error('Unexpected write')}});export const useCreateRecurringIncomeMutation=mutation,useUpdateRecurringIncomeMutation=mutation,useDeleteRecurringIncomeMutation=mutation,useSetRecurringIncomeFlagsMutation=mutation,useConfirmRecurringIncomeArrivalMutation=mutation;export const useRecurringIncomeOccurrencesQuery=()=>({data:[],isSuccess:true});export const getQueryErrorMessage=()=>'';`);
const listUrl = load("src/modules/recurring-income/components/recurring-income-list.tsx");
mock("src/modules/recurring-income/components/recurring-income-list.tsx", `${h} import {RecurringIncomeList as Real} from '${listUrl}';export const RecurringIncomeList=p=>{globalThis.incomeFilteredList=p;return h(Real,p);};`);
const { RecurringIncomePage } = await import(load("src/modules/recurring-income/pages/recurring-income-page.tsx"));
renderer = createRoot(container); let csv = "";
const oldClick = dom.window.HTMLAnchorElement.prototype.click, oldUrl = URL.createObjectURL, oldRevoke = URL.revokeObjectURL;
dom.window.HTMLAnchorElement.prototype.click = () => {}; URL.createObjectURL = blob => { blob.text().then(text => { csv = text; }); return "blob:filters"; }; URL.revokeObjectURL = () => {};
await act(async () => renderer.render(React.createElement(MemoryRouter, { initialEntries: ["/app/recurring-income?freq=monthly,weekly&account_id=30"] }, React.createElement(RecurringIncomePage)))); await settle();
assert.equal(globalThis.incomeFilteredList.income.length, 50); assert.doesNotMatch(container.textContent, /Foreign/);
assert.match(container.querySelector('[aria-label="Resumen de ingresos filtrados"]').textContent, /60 ingresos/);
const expectedMonthly = 30 * 100 + 30 * 100 * 52 / 12;
assert.equal(expectedMonthly, 16000); assert.match(container.querySelector('[aria-label="Resumen de ingresos filtrados"]').textContent, /16,000\.00/);
await act(async () => container.querySelector('button[aria-label="Más acciones"]').click()); await click("Exportar los 60"); await settle(); assert.equal(csv.trim().split(/\r?\n/).length, 61); assert.doesNotMatch(csv, /Foreign|Ingreso 61/);
await act(async () => renderer.unmount()); container.remove(); dom.window.close();
globalThis.Date = originalDate; if (originalTz === undefined) delete process.env.TZ; else process.env.TZ = originalTz;
dom.window.HTMLAnchorElement.prototype.click = oldClick; URL.createObjectURL = oldUrl; URL.revokeObjectURL = oldRevoke;
console.log(`recurring-income-filters: OK (${comparisons} original mobile filter comparisons; combined status/frequency, exact ID homonyms, legacy/repeated/invalid URL, Lima inclusive 30 days, real toolbar/hook/page, pagination, whole-filter subtotal/CSV and foreign scope; local only)`);
