import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { React, act, createRoot, dom, load, root, settle, change, MemoryRouter } from "./lib/web-ui-harness.mjs";

const { filterAccounts, getAvailableAccountInstitutions, getAvailableAccountTypes, getAvailableCurrencyCodes } = await import(load("src/modules/accounts/lib/account-filters.ts"));
const { useAccountFilters } = await import(load("src/modules/accounts/hooks/use-account-filters.ts"));
const { AccountsToolbar } = await import(load("src/modules/accounts/components/accounts-toolbar.tsx"));
const { useLocation } = await import("react-router-dom");
const source = readFileSync(resolve(root, "../DarkMoneyApp/features/accounts/lib/filters.ts"), "utf8"), ast = ts.createSourceFile("filters.ts", source, ts.ScriptTarget.Latest, true);
const fn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "applyAccountFilter"); assert.ok(fn);
const js = ts.transpileModule(fn.getText(ast).replace(/^export /, ""), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
const mobileFilter = new Function(`${js};return applyAccountFilter;`)();
const rows = [
  { id: 1, name: "Sueldo", type: "bank", currencyCode: "PEN", isArchived: false, institutionCode: "bcp", includeInNetWorth: true },
  { id: 2, name: "Efectivo", type: "cash", currencyCode: "PEN", isArchived: false, institutionCode: null, includeInNetWorth: true },
  { id: 3, name: "Ahorro", type: "savings", currencyCode: "USD", isArchived: true, institutionCode: "bcp", includeInNetWorth: true },
  { id: 4, name: "Viajes", type: "bank", currencyCode: "USD", isArchived: false, institutionCode: "banco-nuevo", includeInNetWorth: false },
  { id: 5, name: "Tarjeta", type: "credit_card", currencyCode: "PEN", isArchived: true, institutionCode: "", includeInNetWorth: true },
];
let comparisons = 0;
for (const status of ["active", "archived", "all"]) for (const types of [[], ["bank"], ["bank", "cash"], ["savings", "credit_card"]]) for (const institutions of [[], [null], ["bcp"], [null, "bcp"], ["banco-nuevo"]]) for (const q of ["", "sueldo", "USD", "no existe"]) {
  const mobile = mobileFilter(rows, { searchText: q, typeFilters: types, status, institutions });
  const web = filterAccounts(rows, { q, types, type: "", institutions, currency: "", status, page: 1, view: "table" });
  assert.deepEqual(web.map(row => row.id), mobile.map(row => row.id)); comparisons++;
}
assert.deepEqual(filterAccounts(rows, { type: "bank", q: "", currency: "", status: "all" }).map(row => row.id), [1, 4]);
assert.deepEqual(getAvailableAccountInstitutions(rows), [{ value: "banco-nuevo", label: "banco-nuevo" }, { value: "bcp", label: "BCP" }, { value: null, label: "Sin institución" }]);

// Actual URL hook, toolbar, multi-select destination and filter model; no server/provider mocks.
let state, location;
function Probe() {
  state = useAccountFilters(); location = useLocation();
  const result = filterAccounts(rows, state.filters);
  return React.createElement(React.Fragment, null,
    React.createElement(AccountsToolbar, { availableCurrencyCodes: getAvailableCurrencyCodes(rows), availableTypes: getAvailableAccountTypes(rows), institutions: getAvailableAccountInstitutions(rows), filters: state.filters, onUpdateFilters: state.writeFilters }),
    React.createElement("output", null, result.map(row => row.id).join(",")));
}
const container = document.createElement("div"); document.body.append(container); const renderer = createRoot(container);
await act(async () => renderer.render(React.createElement(MemoryRouter, { initialEntries: ["/app/accounts?type=bank&type=cash&type=bank&institution=bcp&institution=&status=all&currency=PEN&page=3"] }, React.createElement(Probe)))); await settle();
assert.deepEqual(state.filters.types, ["bank", "cash"]); assert.deepEqual(state.filters.institutions, ["bcp", null]); assert.equal(container.querySelector("output").textContent, "1,2");
const aria = label => { const node = container.querySelector(`button[aria-label="${label}"]`); assert.ok(node, label); return node; };
async function click(label) { const node = [...container.querySelectorAll("button")].find(node => node.textContent.trim() === label); assert.ok(node, label); await act(async () => node.click()); await settle(); }
await act(async () => aria("Instituciones").click());
const dialog = container.querySelector('[role="dialog"]'); assert.ok(document.getElementById(dialog.getAttribute("aria-labelledby")));
const bcp = [...container.querySelectorAll("label")].find(label => label.textContent.trim() === "BCP").querySelector("input"); assert.equal(bcp.checked, true); await act(async () => bcp.click()); await settle();
assert.deepEqual(state.filters.institutions, [null]); assert.equal(state.filters.page, 1); assert.deepEqual(new URLSearchParams(location.search).getAll("type"), ["bank", "cash"]); assert.deepEqual(new URLSearchParams(location.search).getAll("institution"), [""]); assert.equal(container.querySelector("output").textContent, "2");
await click("Listo"); assert.equal(aria("Instituciones").textContent.trim(), "Sin institución");
await act(async () => aria("Tipos de cuenta").click()); await click("Todos los tipos"); assert.deepEqual(state.filters.types, []); assert.equal(new URLSearchParams(location.search).has("type"), false); await click("Listo");
await change(container.querySelector('input[aria-label="Buscar cuenta"]'), "USD"); assert.equal(state.filters.currency, "PEN"); assert.deepEqual(state.filters.institutions, [null]); assert.equal(container.querySelector("output").textContent, "");
await act(async () => state.resetFilters()); await settle(); assert.equal(location.search, ""); assert.equal(state.filters.status, "active"); assert.deepEqual(state.filters.types, []); assert.deepEqual(state.filters.institutions, []); assert.equal(container.querySelector("output").textContent, "1,2,4");
await act(async () => state.writeFilters({ type: "bank", page: 2 })); await settle(); assert.deepEqual(state.filters.types, ["bank"]); assert.equal(state.filters.page, 2);
await act(async () => state.writeFilters({ types: ["cash", "bank"], institutions: ["banco-nuevo", null] }, { resetPage: true })); await settle();
assert.deepEqual(state.filters.types, ["cash", "bank"]); assert.deepEqual(state.filters.institutions, ["banco-nuevo", null]); assert.equal(state.filters.page, 1); assert.equal(container.querySelector("output").textContent, "2,4");
// Options retained by bookmarked filters can still be cleared when no matching account remains.
await act(async () => state.writeFilters({ institutions: ["removed-code"] })); await settle(); await act(async () => aria("Instituciones").click()); assert.match(container.querySelector('[role="dialog"]').textContent, /removed-code/); await click("Todas las instituciones"); assert.deepEqual(state.filters.institutions, []); await click("Listo");
await act(async () => renderer.unmount()); container.remove(); dom.window.close();
console.log(`account-filters: OK (${comparisons} original mobile filter comparisons; multi-type/institution OR and cross-filter AND, no institution, unknown bank, legacy URL, actual hook/toolbar/modal/checkboxes, repeated URL params, clearing and pagination; local only)`);
