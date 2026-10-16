import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { React, act, createRoot, dom, load, root, settle } from "./lib/web-ui-harness.mjs";

const { computeAccountWorth, accountDisplayRate } = await import(load("src/modules/accounts/lib/account-worth.ts"));
const { AccountComposition } = await import(load("src/modules/accounts/components/account-composition.tsx"));
const { buildRateMap, resolveConversion } = await import(load("../DarkMoneyApp/lib/exchange-rate-map.ts"));
function mobileFunction(path, name, bindings) {
  const source = readFileSync(resolve(root, "../DarkMoneyApp", path), "utf8"), ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  const fn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name); assert.ok(fn);
  const js = ts.transpileModule(fn.getText(ast).replace(/^export /, ""), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  return new Function(...Object.keys(bindings), `${js};return ${name};`)(...Object.values(bindings));
}
const mobileComposition = mobileFunction("features/accounts/lib/composition.ts", "computeComposition", { resolveConversion, TYPE_LABELS: {}, TYPE_COLORS: {} });
const mobileNetWorth = mobileFunction("features/accounts/lib/net-worth.ts", "computeNetWorth", { resolveConversion });
const account = (id, type, amount, extra = {}) => ({ id, workspaceId: 8, name: `Cuenta ${id}`, type, currencyCode: "PEN", currentBalance: amount, currentBalanceInBaseCurrency: amount, isArchived: false, includeInNetWorth: true, ...extra });
const rates = [{ fromCurrencyCode: "PEN", toCurrencyCode: "USD", rate: 0.25 }];
let comparisons = 0;
for (const currency of ["PEN", "USD"]) for (const left of [-500, 0, 700]) for (const right of [-300, 0, 200]) for (const type of ["bank", "loan", "loan_wallet", "credit_card"]) {
  const accounts = [account(1, type, left), account(2, type, right), account(3, "cash", 40), account(4, "bank", 99999, { isArchived: true }), account(5, "bank", 99999, { includeInNetWorth: false })];
  const mobileInput = { accounts, baseCurrency: "PEN", displayCurrency: currency, exchangeRateMap: buildRateMap(rates) };
  const expected = mobileComposition(mobileInput), actual = computeAccountWorth(accounts, "PEN", currency, rates);
  assert.equal(actual.available, true); assert.equal(actual.netWorth, expected.netWorth); assert.equal(actual.totalAssets, expected.totalAssets); assert.equal(actual.debts, expected.debts);
  assert.deepEqual(actual.assets, expected.assets.map(({ type, value, pct }) => ({ type, value, pct })));
  assert.equal(actual.signedNetWorth, mobileNetWorth(mobileInput)); comparisons++;
}
const mixed = [account(1, "bank", 100), account(2, "bank", -30)];
assert.equal(computeAccountWorth(mixed, "PEN", "PEN", []).totalAssets, 70); assert.equal(computeAccountWorth(mixed, "PEN", "PEN", []).debts, 0);
const positiveLoan = computeAccountWorth([account(1, "loan", 100)], "PEN", "PEN", []); assert.equal(positiveLoan.signedNetWorth, 100); assert.equal(positiveLoan.netWorth, -100); assert.equal(positiveLoan.hasLoanSignDifference, true);
assert.equal(accountDisplayRate([{ fromCurrencyCode: "USD", toCurrencyCode: "PEN", rate: 4 }], "PEN", "usd"), 0.25);
for (const invalid of [0, -1, NaN, Infinity]) assert.equal(accountDisplayRate([{ fromCurrencyCode: "PEN", toCurrencyCode: "USD", rate: invalid }], "PEN", "USD"), null);
assert.equal(accountDisplayRate([{ fromCurrencyCode: "PEN", toCurrencyCode: "USD", rate: 0 }, ...rates], "PEN", "USD"), 0.25);
const missing = computeAccountWorth([account(1, "bank", 100), account(2, "cash", 20, { currencyCode: "USD", currentBalanceInBaseCurrency: null })], "PEN", "PEN", []);
assert.equal(missing.available, false); assert.deepEqual(missing.missingAccountIds, [2]); assert.equal(missing.netWorth, null); assert.equal(missing.signedNetWorth, null); assert.deepEqual(missing.assets, []);
assert.equal(computeAccountWorth([account(2, "cash", 20, { currencyCode: "USD", currentBalanceInBaseCurrency: null })], "PEN", "PEN", rates).signedNetWorth, 80);
assert.equal(computeAccountWorth([account(2, "cash", 20, { currencyCode: "USD", currentBalanceInBaseCurrency: 90 })], "PEN", "PEN", rates).signedNetWorth, 90);
assert.equal(computeAccountWorth([account(2, "cash", NaN)], "PEN", "PEN", []).available, false);
assert.equal(computeAccountWorth([account(2, "cash", 0, { currencyCode: "USD", currentBalanceInBaseCurrency: null })], "PEN", "PEN", []).signedNetWorth, 0);
assert.equal(computeAccountWorth([account(1, "bank", 100)], "PEN", "USD", []).available, false);

// Actual component, no HTTP. Check declared scope/unknown totals/loan discrepancy and scoped preference.
const container = document.createElement("div"); document.body.append(container); const renderer = createRoot(container);
async function render(accounts, exchangeRates = rates, preferenceKey = "account-worth-test.A.8") { await act(async () => renderer.render(React.createElement(AccountComposition, { accounts, exchangeRates, baseCurrencyCode: "PEN", preferenceKey, key: preferenceKey }))); await settle(); }
const button = text => { const node = [...container.querySelectorAll("button")].find(node => node.textContent.includes(text)); assert.ok(node, text); return node; };
await render(mixed); assert.match(container.textContent, /70\.00/); await act(async () => button("Composición del patrimonio").click()); assert.match(container.textContent, /los filtros de la lista no cambian/);
await act(async () => button("USD").click()); assert.equal(dom.window.localStorage.getItem("account-worth-test.A.8"), "USD"); assert.match(container.textContent, /17\.50/);
await render([account(1, "loan", 100)]); assert.match(container.textContent, /carteras de préstamos se clasifican como deuda/);
await render([account(2, "cash", 20, { currencyCode: "USD", currentBalanceInBaseCurrency: null })], []); assert.match(container.textContent, /Por comprobar/); assert.match(container.textContent, /No se muestra un total parcial/); assert.doesNotMatch(container.textContent, /No hay saldos positivos/);
await render(mixed, rates, "account-worth-test.B.8"); assert.doesNotMatch(container.textContent, /17\.50/); assert.equal(dom.window.localStorage.getItem("account-worth-test.B.8"), null);
await act(async () => renderer.unmount()); container.remove(); dom.window.close();
console.log(`account-worth: OK (${comparisons} actual mobile composition/net-worth comparisons; signed per-type grouping, loan-sign discrepancy disclosed, direct/inverse/invalid/missing FX, no partial total, real component and scoped preference; local only)`);
