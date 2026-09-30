import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cache = new Map();
function compile(path) {
  if (cache.has(path)) return cache.get(path);
  let js = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  js = js.replace(/from "([^"]+)"/g, (match, specifier) => {
    if (!specifier.startsWith(".")) return `from "${import.meta.resolve(specifier)}"`;
    const candidate = resolve(dirname(path), specifier);
    const target = [candidate, `${candidate}.ts`, `${candidate}.tsx`].find(existsSync);
    return `from "${compile(target)}"`;
  });
  const url = `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`;
  cache.set(path, url); return url;
}
const money = await import(compile(resolve(root, "src/lib/analytics-money.ts")));
const contacts = await import(compile(resolve(root, "src/modules/contacts/lib/contact-parity.ts")));
const categories = await import(compile(resolve(root, "src/modules/categories/lib/category-parent.ts")));
const incoming = { movementType: "obligation_payment", sourceAmount: null, destinationAmount: 50, destinationAmountInBaseCurrency: 50, destinationCurrencyCode: "PEN" };
assert.deepEqual(money.movementAnalyticsAmount(incoming, "PEN"), { amount: 50, currencyCode: "PEN", amountInBaseCurrency: 50 });
assert.equal(money.comparableAmount(money.movementAnalyticsAmount({ ...incoming, sourceAmount: 20, destinationAmount: null, sourceCurrencyCode: "PEN" }, "PEN"), "PEN"), 20);
assert.deepEqual(money.currencyTotals([{ amount: 10, currencyCode: "USD" }, { amount: 50, currencyCode: "PEN" }], "PEN"), [{ amount: 10, currencyCode: "USD" }, { amount: 50, currencyCode: "PEN" }]);
assert.equal(money.comparableAmount({ amount: 10, currencyCode: "USD", amountInBaseCurrency: null }, "PEN"), null);
assert.deepEqual(money.currencyTotals([{ amount: 10, currencyCode: "USD", amountInBaseCurrency: 38 }, { amount: 50, currencyCode: "PEN" }], "PEN"), [{ amount: 88, currencyCode: "PEN" }]);
assert.equal(money.comparableAmount({ amount: 0, currencyCode: "USD", amountInBaseCurrency: 0 }, "PEN"), 0);
assert.equal(money.movementAnalyticsAmount({ ...incoming, destinationAmountInBaseCurrency: -50 }, "PEN").amountInBaseCurrency, 50);
assert.equal(money.movementAnalyticsAmount({ ...incoming, movementType: "transfer", sourceAmount: 0 }, "PEN").amount, 50);
assert.equal(money.analyticsMonthKey("2026-10-01T04:59:59Z"), "2026-09");
assert.equal(money.analyticsMonthKey("2026-10-01T05:00:00Z"), "2026-10");
assert.equal(money.analyticsMonthKey("2026-10-01"), "2026-10");
assert.deepEqual(money.analyticsMonthKeys(new Date("2026-10-01T04:30:00Z")), Array.from({ length: 12 }, (_, i) => `${i < 3 ? 2025 : 2026}-${String((i + 9) % 12 + 1).padStart(2, "0")}`));
const obligation = { counterpartyId: 7, status: "active", direction: "receivable", pendingAmount: 50, currencyCode: "PEN" };
assert.deepEqual(contacts.contactExposure([obligation, { ...obligation, status: "cancelled", pendingAmount: 900 }, { ...obligation, counterpartyId: 8 }], 7, "PEN").receivable, [{ amount: 50, currencyCode: "PEN" }]);
assert.deepEqual(contacts.contactExposure([{ ...obligation, currencyCode: "USD" }], 7, "PEN").receivable, [{ amount: 50, currencyCode: "USD" }]);
const person = { id: 1, type: "person", name: "Uno", isPinned: true };
const service = { id: 2, type: "service", name: "Dos", isPinned: false };
assert.equal(contacts.contactMatchesFilters(person, ["person", "service"], ""), true);
assert.equal(contacts.contactMatchesFilters(service, ["person", "service"], ""), true);
assert.equal(contacts.contactMatchesFilters(service, ["pinned", "service"], ""), false);
assert.equal(contacts.contactMatchesFilters(person, ["pinned", "person"], "person"), true);
assert.equal(contacts.contactWhatsAppUrl("+51 999-111-222"), "https://wa.me/51999111222");
assert.equal(contacts.contactWhatsAppUrl("---"), null);
const parents = [{ id: 1, kind: "expense", isSystem: false }, { id: 2, parentId: 1, kind: "expense", isSystem: false }, { id: 3, parentId: 2, kind: "expense", isSystem: false }, { id: 4, kind: "income", isSystem: false }, { id: 5, kind: "both", isSystem: false }, { id: 6, kind: "expense", isSystem: true }];
assert.deepEqual(categories.categoryParentCandidates(parents, "expense", 1).map((item) => item.id), [5]);
assert.deepEqual(categories.categoryParentCandidates(parents, "income").map((item) => item.id), [4, 5]);
assert.deepEqual(categories.categoryParentCandidates(parents, "both").map((item) => item.id), [1, 2, 3, 4, 5]);
console.log("catalog-parity: OK — cobros, monedas, cancelados, filtros, padres y doce meses en Lima");

const accounts = await import(compile(resolve(root, "src/modules/accounts/lib/account-validation.ts")));
const defaultAccount = accounts.createDefaultFormState("PEN");
assert.equal(defaultAccount.statementDay, "");
const card = { ...defaultAccount, name: "Tarjeta", type: "credit_card", statementDay: "25", paymentDay: "15", creditLimit: "2000.50" };
assert.deepEqual(accounts.validateAccountForm(card), {});
const input = accounts.toAccountInput(card);
assert.equal(input.statementDay, 25); assert.equal(input.paymentDay, 15); assert.equal(input.creditLimit, 2000.5);
const restored = accounts.buildFormStateFromAccount({ ...input, openingBalance: 0 });
assert.equal(restored.statementDay, "25"); assert.equal(restored.paymentDay, "15"); assert.equal(restored.creditLimit, "2000.5");
assert.equal(accounts.validateAccountForm({ ...card, statementDay: "32" }).statementDay, "Elige un día del 1 al 31.");
assert.equal(accounts.validateAccountForm({ ...card, paymentDay: "1.5" }).paymentDay, "Elige un día del 1 al 31.");
assert.ok(accounts.validateAccountForm({ ...card, creditLimit: "0" }).creditLimit);
assert.deepEqual(accounts.validateAccountForm({ ...card, statementDay: "", paymentDay: "", creditLimit: "" }), {});
assert.equal(accounts.toAccountInput({ ...card, type: "cash" }).statementDay, null);
assert.equal(accounts.toAccountInput({ ...card, type: "cash" }).paymentDay, null);
assert.equal(accounts.toAccountInput({ ...card, type: "cash" }).creditLimit, null);

// Exercise the actual mutation bodies with an in-memory client, never Supabase.
const servicePath = resolve(root, "src/services/queries/workspace-data.ts");
const serviceText = readFileSync(servicePath, "utf8");
const serviceAst = ts.createSourceFile(servicePath, serviceText, ts.ScriptTarget.Latest, true);
const overviewQuery = serviceAst.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "fetchCounterpartiesOverview").getText(serviceAst);
assert.match(overviewQuery, /\.select\("id, workspace_id, name, type, phone, email, document_number, notes, is_archived, is_pinned"\)/);
const selectedHooks = serviceAst.statements.filter((node) => ts.isFunctionDeclaration(node) && ["useCreateAccountMutation", "useUpdateAccountMutation"].includes(node.name?.text));
const hookJs = ts.transpileModule(selectedHooks.map((node) => node.getText(serviceAst).replace(/^export /, "")).join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
const payloads = [];
const client = { from(table) {
  assert.equal(table, "accounts");
  return { insert(payload) { payloads.push(payload); return Promise.resolve({ error: null }); }, update(payload) { payloads.push(payload); return { eq() { return this; }, then(resolve) { resolve({ error: null }); } }; } };
} };
const hooks = new Function("useQueryClient", "useMutation", "getClient", "invalidateWorkspaceSnapshot", `${hookJs}; return {useCreateAccountMutation,useUpdateAccountMutation};`)(() => ({}), (options) => options, () => client, async () => {});
await hooks.useCreateAccountMutation(1, "test").mutationFn({ ...input, workspaceId: 1, userId: "test", sortOrder: 1 });
await hooks.useUpdateAccountMutation(1, "test").mutationFn({ ...input, workspaceId: 1, userId: "test", accountId: 1 });
for (const payload of payloads) { assert.equal(payload.statement_day, 25); assert.equal(payload.payment_day, 15); assert.equal(payload.credit_limit, 2000.5); }
await hooks.useUpdateAccountMutation(1, "test").mutationFn({ ...input, type: "cash", workspaceId: 1, userId: "test", accountId: 1 });
assert.equal(payloads.at(-1).statement_day, null); assert.equal(payloads.at(-1).payment_day, null); assert.equal(payloads.at(-1).credit_limit, null);
console.log("account-cycle: OK — hydrate, validate, create/update payloads and clear on type change");
