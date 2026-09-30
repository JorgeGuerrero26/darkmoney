import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const lib = "src/modules/movements/lib/";
const dataUrl = (js) => `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`;
function compile(path, imports = {}) {
  let js = ts.transpileModule(readFileSync(resolve(root, path), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  for (const [specifier, url] of Object.entries(imports)) js = js.replaceAll(`from "${specifier}"`, `from "${url}"`);
  return dataUrl(js);
}
const featuresUrl = pathToFileURL(resolve(root, "node_modules/@darkmoney/shared/dist/movement-features.js")).href;
const imports = { "@darkmoney/shared/movement-features": featuresUrl };
const modules = {};
for (const name of ["counterparty-suggestions", "description-cleanup", "recurring-suggestions", "risk-analysis"]) {
  const url = compile(`${lib}movement-${name}.ts`, imports);
  modules[name] = { url, exports: await import(url) };
}
const suggestionsUrl = compile(`${lib}movement-suggestions.ts`, {
  "./movement-counterparty-suggestions": modules["counterparty-suggestions"].url,
  "./movement-description-cleanup": modules["description-cleanup"].url,
  "./local-category-suggestion": dataUrl("export const suggestCategoryLocally = () => null;"),
});
const suggestions = await import(suggestionsUrl);
const fakeIcons = dataUrl("export const ArrowDownCircle=()=>null, ArrowLeftRight=()=>null, ArrowUpCircle=()=>null, BriefcaseBusiness=()=>null, CalendarClock=()=>null, ReceiptText=()=>null;");
const formUrl = compile(`${lib}movement-form.ts`, { "lucide-react": fakeIcons });
const insights = await import(compile(`${lib}movement-insights.ts`, {
  "./movement-form": formUrl,
  "./movement-recurring-suggestions": modules["recurring-suggestions"].url,
  "./movement-risk-analysis": modules["risk-analysis"].url,
}));

const contacts = [
  { id: 1, name: "Botica Salud", type: "merchant", isArchived: false },
  { id: 2, name: "Lucía María", type: "person", isArchived: false },
  { id: 3, name: "Restaurante Cerrado", type: "merchant", isArchived: true },
];
const cpCases = [
  "Compra en Botica Salud", "Lucía", "LUCIA MARIA 129284", "Restaurante Los Pinos",
  "Pago para Tienda Nueva", "Restaurante Cerrado", "Grifo Norte", "Pago de servicio", "123", "",
].map((description) => ({ description, counterparties: contacts }));
const cp = modules["counterparty-suggestions"].exports;
assert.equal(cp.suggestCounterpartyLocally(cpCases[0]).counterpartyId, 1);
assert.equal(cp.suggestCounterpartyLocally(cpCases[1]).confidence, 0.71);
assert.equal(cp.suggestCounterpartyLocally(cpCases[3]).type, "new_counterparty");
assert.equal(cp.suggestCounterpartyLocally(cpCases[5]).counterpartyId, null);
assert.equal(cp.suggestCounterpartyLocally(cpCases[8]), null);
for (const input of cpCases) {
  const expected = cp.suggestCounterpartyLocally(input);
  assert.deepEqual(suggestions.suggestCounterpartyLocally(input), expected && {
    ...expected, counterpartyName: expected.counterpartyName ?? expected.newCounterpartyName,
  });
}

const cleanup = modules["description-cleanup"].exports;
const cleanupCases = [
  "BCP OPERACION 122399 Pago Inkafarma 20/09/2026 PEN 50.00",
  "BBVA REF 987654 Compra en Restaurante Norte", "Primax", "Uber", "Plaza Vea", "Sedapal",
  "Rappi", "Netflix", "Cineplanet", "Smartfit", "Clinica Auna", "Udemy", "Ripley", "ChatGPT",
  "Metropolitano", "Yape OP 993939 para tienda Laura", "Pago de movilidad", "Compra en botica",
  "  Pago  de movilidad  ", "Taxi", "abc", "", "Mi almuerzo",
].map((rawDescription) => ({ rawDescription }));
assert.equal(cleanup.cleanupMovementDescriptionLocally(cleanupCases[0]).confidence, 0.88);
assert.equal(cleanup.cleanupMovementDescriptionLocally(cleanupCases[4]).cleanedDescription, "Compra en supermercado");
assert.equal(suggestions.suggestDescriptionCleanupLocally("Compra en botica"), null);
for (const input of cleanupCases) {
  const expected = cleanup.cleanupMovementDescriptionLocally(input);
  assert.deepEqual(suggestions.suggestDescriptionCleanupLocally(input.rawDescription),
    expected && cleanup.shouldShowDescriptionCleanup(input.rawDescription, expected.cleanedDescription) ? expected : null);
}

const record = (id, extra = {}) => ({
  id, movementType: "expense", status: "posted", occurredAt: "2026-09-28T12:00:00-05:00",
  description: "Almuerzo", categoryId: 1, category: "Comida", counterpartyId: 1, counterparty: "Botica Salud",
  sourceAccountId: 10, destinationAccountId: null, sourceAmount: 20, destinationAmount: null, ...extra,
});
const accounts = [{ id: 10, name: "Principal", isArchived: false }, { id: 20, name: "Sueldo", isArchived: false }];
const accountBase = { accountId: 20, movementType: "expense", actsAsIncome: false, accounts, counterpartyId: 1, movements: [record(1), record(2)] };
const accountCases = [
  accountBase,
  { ...accountBase, accountId: 10 },
  { ...accountBase, accountId: null },
  { ...accountBase, excludedMovementId: 1 }, // Pattern maps still include edited records.
  { ...accountBase, movements: [record(1)] },
  { ...accountBase, movements: [record(1), record(2, { status: "pending" })] },
  { ...accountBase, movementType: "income", actsAsIncome: true }, // Learned account is not direction-specific.
  { ...accountBase, movementType: "transfer" },
  { ...accountBase, accounts: accounts.map((a) => ({ ...a, isArchived: true })) },
  { ...accountBase, counterpartyId: null },
  { ...accountBase, movements: [record(1, { movementType: "income", sourceAccountId: null, destinationAccountId: 10 }), record(2)] },
  { ...accountBase, movements: [record(1, { occurredAt: "2025-09-28" }), record(2, { occurredAt: "2025-09-27" }), ...Array.from({ length: 300 }, (_, i) => record(i + 3, { counterpartyId: 2 }))] },
];
const accountExpected = [10, null, 10, 10, null, null, 10, null, null, null, 10, null];
accountCases.forEach((input, i) => assert.equal(suggestions.suggestAccountLocally(input)?.accountId ?? null, accountExpected[i], `account ${i}`));
assert.equal(suggestions.recentPatternMovements([record(1), record(2, { status: "voided" }), record(3, { status: "pending" })], 1).length, 0);
const cutoff = [record(1, { occurredAt: "2025-01-01" }), ...Array.from({ length: 300 }, (_, i) => record(i + 2))];
assert.equal(suggestions.recentPatternMovements(cutoff, 2).length, 299);
assert.equal(suggestions.recentPatternMovements(cutoff, 2).some((m) => m.id === 1), false);

const current = { id: -1, movementType: "expense", actsAsIncome: false, occurredAt: "2026-09-30T12:00:00-05:00", description: "Netflix", amount: 100, currencyCode: "PEN", categoryId: 1, categoryName: "Entretenimiento", counterpartyId: 1, counterpartyName: "Netflix", accountId: 10, accountName: "Principal" };
const recurringInput = (c, history = [], extra = {}) => ({
  movementType: c.movementType, description: c.description, amount: c.amount, currencyCode: c.currencyCode,
  occurredAt: c.occurredAt, category: c.categoryId == null ? null : { id: c.categoryId, name: c.categoryName },
  counterparty: c.counterpartyId == null ? null : { id: c.counterpartyId, name: c.counterpartyName },
  recentMovements: history, subscriptions: [], recurringIncome: [], ...extra,
});
const recurringCases = [
  recurringInput(current),
  recurringInput({ ...current, description: "Pensión", movementType: "income", amount: 0 }),
  recurringInput({ ...current, description: "iCloud", counterpartyId: null, counterpartyName: null }),
  recurringInput(current, [], { subscriptions: [{ name: "Otro servicio", amount: 104, currencyCode: "pen", status: "active", categoryId: 1, vendorPartyId: null }] }),
  recurringInput(current, [], { subscriptions: [{ name: "Netflix", amount: 100, currencyCode: "USD", status: "active", categoryId: 1 }] }),
  recurringInput({ ...current, description: "Pago general", counterpartyId: null, counterpartyName: null }, [{ ...current, id: 2, description: "Otro", amount: 110, occurredAt: "2026-09-03T00:00:00-05:00" }]),
  recurringInput(current, [{ ...current, id: 2, occurredAt: "2026-09-16T12:00:00-05:00" }, { ...current, id: 3, occurredAt: "2026-09-02T12:00:00-05:00" }]),
  recurringInput({ ...current, description: "Cargo", amount: 0 }),
  ...[6, 8, 13, 16, 27, 33, 84, 96, 350, 380, 9, 26].map((days) => recurringInput(
    { ...current, description: "Cargo" }, [{ ...current, id: 2, occurredAt: new Date(new Date(current.occurredAt).getTime() - days * 86400000).toISOString() }],
  )),
];
const recur = modules["recurring-suggestions"].exports;
assert.equal(recur.suggestRecurringLocally(recurringCases[0]).confidence, 0.6);
assert.equal(recur.suggestRecurringLocally(recurringCases[1]).type, "recurring_income");
assert.equal(recur.suggestRecurringLocally(recurringCases[3]), null);
assert.equal(recur.suggestRecurringLocally(recurringCases[5]).frequency, "monthly"); // 27.5 days rounds to 28.
assert.equal(recur.suggestRecurringLocally(recurringCases[6]).intervalCount, 2);
for (const input of recurringCases) {
  const c = { ...current, movementType: input.movementType, description: input.description, amount: input.amount, currencyCode: input.currencyCode, categoryId: input.category?.id ?? null, categoryName: input.category?.name ?? null, counterpartyId: input.counterparty?.id ?? null, counterpartyName: input.counterparty?.name ?? null };
  assert.deepEqual(insights.suggestRecurringLocally({ current: c, history: input.recentMovements, subscriptions: input.subscriptions, recurringIncome: input.recurringIncome }), recur.suggestRecurringLocally(input));
}

const risk = modules["risk-analysis"].exports;
const riskCases = [
  [current, [{ ...current, id: 2 }]],
  [{ ...current, description: "Operación 999777 Netflix" }, [{ ...current, id: 2, description: "Operación 111222 Netflix" }]],
  [{ ...current, description: "Taxi", counterpartyId: 2 }, [{ ...current, id: 2, description: "Otro texto", counterpartyId: 2 }]],
  [{ ...current, amount: 500 }, Array.from({ length: 5 }, (_, i) => ({ ...current, id: i + 1, occurredAt: "2026-08-01T12:00:00-05:00", amount: 50 + i }))],
  [current, [{ ...current, id: 2, amount: NaN }]],
  [current, [{ ...current, id: 2, occurredAt: "invalid" }]],
  [current, [{ ...current, id: 2, occurredAt: "2026-09-27T12:00:00-05:00" }]],
  [{ ...current, movementType: "transfer" }, [{ ...current, id: 2 }]],
  [{ ...current, amount: 500 }, Array.from({ length: 4 }, (_, i) => ({ ...current, id: i + 1, occurredAt: "2026-08-01", amount: 50 }))],
];
assert.equal(risk.analyzeMovementRiskLocally(...riskCases[0]).severity, "high");
assert.equal(risk.analyzeMovementRiskLocally(...riskCases[1]).confidence, 1);
assert.ok(risk.analyzeMovementRiskLocally(...riskCases[2]).reasons.includes("misma contraparte"));
assert.equal(risk.analyzeMovementRiskLocally(...riskCases[3]).explanation, "Este monto es bastante mayor que tu valor habitual cercano a 52.");
for (const i of [4, 5, 6, 7, 8]) assert.equal(risk.analyzeMovementRiskLocally(...riskCases[i]), null);

// AI boundaries and payloads, stubbed locally: no network or writes.
const invoked = [];
globalThis.__movementAi = { response: null, invoked };
const ai = await import(compile("src/services/queries/movement-ai.ts", {
  "./workspace-data": dataUrl("export async function invokeAuthenticatedFunction(name, input) { globalThis.__movementAi.invoked.push({name, input}); return globalThis.__movementAi.response; }"),
  "../../modules/movements/lib/movement-description-cleanup": modules["description-cleanup"].url,
}));
globalThis.__movementAi.response = { ok: true, cleanedDescription: "  Compra   simple  ", confidence: 0.4, reasons: [] };
assert.equal((await ai.requestDescriptionSuggestion({ workspaceId: 1, rawDescription: "Texto bancario largo", amount: 20, currencyCode: "PEN", localSuggestion: null })).confidence, 0.4);
globalThis.__movementAi.response.cleanedDescription = "  Texto  bancario largo ";
assert.equal(await ai.requestDescriptionSuggestion({ workspaceId: 1, rawDescription: "Texto bancario largo", localSuggestion: null }), null);
globalThis.__movementAi.response = { ok: true, recommendation: null };
await ai.requestCounterpartySuggestion({ workspaceId: 1, description: "Restaurante Nuevo", counterparties: [], localSuggestion: suggestions.suggestCounterpartyLocally(cpCases[3]) });
assert.equal(invoked.at(-1).input.localSuggestion.type, "new_counterparty");
assert.equal(invoked.at(-1).input.localSuggestion.counterpartyName, null);

// Exercise the actual React hooks with a tiny deterministic hook/timer runtime.
// This catches wiring errors (raw vs cleaned text, stale AI results, editing, history limits).
function hookRuntime(hook, initialInput) {
  const slots = [];
  let index = 0, dirty = false, input = initialInput, output;
  const effects = [], timers = new Map();
  let nextTimer = 0;
  const same = (a, b) => a?.length === b?.length && a.every((v, i) => Object.is(v, b[i]));
  const runtime = {
    useState(initial) {
      const i = index++;
      slots[i] ??= { value: typeof initial === "function" ? initial() : initial };
      return [slots[i].value, (value) => {
        const next = typeof value === "function" ? value(slots[i].value) : value;
        if (!Object.is(next, slots[i].value)) { slots[i].value = next; dirty = true; }
      }];
    },
    useMemo(factory, deps) {
      const i = index++;
      if (!slots[i] || !same(slots[i].deps, deps)) slots[i] = { deps, value: factory() };
      return slots[i].value;
    },
    useEffect(effect, deps) {
      const i = index++;
      if (!slots[i] || !same(slots[i].deps, deps)) {
        effects.push(() => { slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: effect() }; });
      }
    },
  };
  function render(next = input) {
    input = next;
    let count = 0;
    do {
      assert.ok(count++ < 25, "hook must settle without render loops");
      dirty = false; index = 0;
      globalThis.__hooks = runtime;
      globalThis.window = {
        setTimeout(callback) { const id = ++nextTimer; timers.set(id, callback); return id; },
        clearTimeout(id) { timers.delete(id); },
      };
      output = hook(input);
      for (const effect of effects.splice(0)) effect();
    } while (dirty);
    return output;
  }
  return {
    render,
    async settle() {
      for (let i = 0; i < 10; i++) {
        if (!timers.size && !dirty) return output;
        const batch = [...timers.values()]; timers.clear();
        for (const timer of batch) timer();
        await new Promise((done) => setImmediate(done));
        render();
      }
      assert.fail("hook timers did not settle");
    },
    dispose() { for (const slot of slots) slot?.cleanup?.(); },
  };
}
const reactUrl = dataUrl("export const useState=(...args)=>globalThis.__hooks.useState(...args), useMemo=(...args)=>globalThis.__hooks.useMemo(...args), useEffect=(...args)=>globalThis.__hooks.useEffect(...args);");
globalThis.__hookAi = { calls: [], description: "Lucía", recurring: null, risk: null };
const hookAiUrl = dataUrl(`
  const call = (name, input, result) => { globalThis.__hookAi.calls.push({name, input}); return Promise.resolve(result); };
  export const requestCategorySuggestion = input => call("category", input, null);
  export const requestCounterpartySuggestion = input => call("counterparty", input, null);
  export const requestDescriptionSuggestion = input => call("description", input, { cleanedDescription: globalThis.__hookAi.description, confidence: .5, reasons: [], source: "deepseek" });
  export const requestRecurringInsight = input => call("recurring", input, globalThis.__hookAi.recurring);
  export const requestRiskInsight = input => call("risk", input, globalThis.__hookAi.risk);
  export const requestBudgetInsight = input => call("budget", input, null);
`);
const { useMovementSuggestions } = await import(compile("src/modules/movements/hooks/use-movement-suggestions.ts", {
  "react": reactUrl,
  "../../../services/queries/movement-ai": hookAiUrl,
  "../lib/movement-suggestions": suggestionsUrl,
  "../lib/movement-description-cleanup": modules["description-cleanup"].url,
  "../lib/local-category-suggestion": dataUrl("export const LOCAL_CATEGORY_AI_CONFIDENCE_THRESHOLD = .6;"),
  "../../../services/queries/movement-learning": dataUrl("export const useMovementLearningQuery=()=>({data:undefined, isError:false});"),
}));
const hookInput = { ...accountBase, enabled: true, workspaceId: 91, proAccessEnabled: true, amount: 100, currencyCode: "PEN", description: "Pago para tienda Laura", occurredAt: current.occurredAt, categoryId: null, counterpartyId: null, categories: [], counterparties: contacts };
const suggestionsHarness = hookRuntime(useMovementSuggestions, hookInput);
suggestionsHarness.render();
const cleanedOutput = await suggestionsHarness.settle();
assert.equal(cleanedOutput.description.cleanedDescription, "Lucía");
assert.equal(cleanedOutput.counterparty.counterpartyId, 2); // Cleanup cascades into contact suggestions.
assert.equal(globalThis.__hookAi.calls.find((c) => c.name === "category").input.description, hookInput.description); // Category still uses RAW text.
assert.notEqual(suggestionsHarness.render({ ...hookInput, proAccessEnabled: false }).description.cleanedDescription, "Lucía");
const changed = suggestionsHarness.render({ ...hookInput, description: "Grifo Norte" });
assert.equal(changed.description.cleanedDescription, "Compra de combustible");
assert.notEqual(changed.counterparty?.counterpartyId, 2); // No stale contact from the previous description.
const callsBefore = globalThis.__hookAi.calls.filter((c) => c.name === "description").length;
await suggestionsHarness.settle();
assert.equal(globalThis.__hookAi.calls.filter((c) => c.name === "description").length, callsBefore); // Strong local cleanup blocks AI.
suggestionsHarness.dispose();

const { useMovementInsights } = await import(compile("src/modules/movements/hooks/use-movement-insights.ts", {
  "react": reactUrl,
  "../../../services/queries/movement-ai": hookAiUrl,
  "../lib/movement-suggestions": suggestionsUrl,
  "../lib/movement-insights": compile(`${lib}movement-insights.ts`, {
    "./movement-form": formUrl, "./movement-recurring-suggestions": modules["recurring-suggestions"].url,
    "./movement-risk-analysis": modules["risk-analysis"].url,
  }),
}));
const insightInput = { workspaceId: 92, enabled: true, proAccessEnabled: true, account: {id: 10, name: "Principal"}, actsAsIncome: false, amount: 100, baseCurrencyCode: "PEN", budgets: [], category: {id: 1, name: "Entretenimiento"}, counterparty: null, currencyCode: "PEN", description: "Texto bancario", cleanedDescription: "Netflix", exchangeRates: [], movementType: "expense", movements: [], occurredAt: current.occurredAt, recurringIncome: [], subscriptions: [] };
globalThis.__hookAi.recurring = { type: "subscription", name: "Sugerencia IA", frequency: "monthly", confidence: .8, reasons: [], source: "deepseek" };
const insightsHarness = hookRuntime(useMovementInsights, insightInput);
assert.equal(insightsHarness.render().recurring.name, "Netflix");
await insightsHarness.settle();
assert.equal(insightsHarness.render().recurring.name, "Sugerencia IA");
assert.equal(globalThis.__hookAi.calls.find((c) => c.name === "recurring").input.description, "Netflix");
const recurrenceCalls = globalThis.__hookAi.calls.filter((c) => c.name === "recurring").length;
assert.equal(insightsHarness.render({ ...insightInput, editingMovementId: 8 }).recurring, null);
await insightsHarness.settle();
assert.equal(globalThis.__hookAi.calls.filter((c) => c.name === "recurring").length, recurrenceCalls);

// Duplicate detection can use a relevant record beyond the 30-row AI recurrence window.
const oldDuplicate = record(888, { description: "Texto bancario", sourceAmount: 100, occurredAt: current.occurredAt });
const unrelated = Array.from({length: 35}, (_, i) => record(i + 1, { sourceAmount: 2, description: "Otro", occurredAt: "2026-10-01T12:00:00-05:00" }));
const riskInput = { ...insightInput, editingMovementId: 8, movements: [...unrelated, oldDuplicate] };
globalThis.__hookAi.risk = { ...risk.analyzeMovementRiskLocally(current, [{ ...current, id: 888 }]), source: "deepseek" };
assert.equal(insightsHarness.render(riskInput).risk.kind, "duplicate");
await insightsHarness.settle();
const riskRequest = globalThis.__hookAi.calls.find((c) => c.name === "risk");
assert.equal(riskRequest.input.currentMovement.description, "Texto bancario");
assert.equal(riskRequest.input.relatedMovements[0].id, 888);
assert.equal(insightsHarness.render({ ...riskInput, amount: 1, movements: [] }).risk, null);
insightsHarness.dispose();

const referenceIndex = process.argv.indexOf("--mobile-reference");
if (referenceIndex >= 0) {
  const mobileRoot = resolve(process.argv[referenceIndex + 1]);
  const mobileFeatures = compile(resolve(mobileRoot, "services/analytics/movement-features.ts"));
  const mobileImports = { "../services/analytics/movement-features": mobileFeatures };
  const mobileCp = await import(compile(resolve(mobileRoot, "lib/movement-counterparty-suggestions.ts"), mobileImports));
  const mobileCleanup = await import(compile(resolve(mobileRoot, "lib/movement-description-cleanup.ts")));
  const mobileRecurring = await import(compile(resolve(mobileRoot, "lib/movement-recurring-suggestions.ts"), mobileImports));
  const mobileRisk = await import(compile(resolve(mobileRoot, "lib/movement-risk-analysis.ts"), mobileImports));
  for (const input of cpCases) assert.deepEqual(cp.suggestCounterpartyLocally(input), mobileCp.suggestCounterpartyLocally(input));
  for (const input of cleanupCases) assert.deepEqual(cleanup.cleanupMovementDescriptionLocally(input), mobileCleanup.cleanupMovementDescriptionLocally(input));
  for (const input of recurringCases) assert.deepEqual(recur.suggestRecurringLocally(input), mobileRecurring.suggestRecurringLocally(input));
  for (const input of riskCases) assert.deepEqual(risk.analyzeMovementRiskLocally(...input), mobileRisk.analyzeMovementRiskLocally(...input));
  const patterns = await import(compile(resolve(mobileRoot, "lib/movement-patterns.ts")));
  for (const input of accountCases) {
    const recent = suggestions.recentPatternMovements(input.movements);
    const maps = patterns.buildPatternMaps(recent.map((m) => ({ id: m.id, movement_type: m.movementType, category_id: m.categoryId, counterparty_id: m.counterpartyId, source_account_id: m.sourceAccountId, destination_account_id: m.destinationAccountId, description: m.description })));
    const id = input.counterpartyId == null || input.movementType === "transfer" ? null : patterns.suggestAccountFromCounterparty(input.counterpartyId, maps);
    const expected = id === input.accountId || !input.accounts.some((a) => a.id === id && !a.isArchived) ? null : id;
    assert.equal(suggestions.suggestAccountLocally(input)?.accountId ?? null, expected);
  }
  const heuristics = await import(compile(resolve(mobileRoot, "features/movements/lib/pattern-heuristics.ts"), { "../../../services/analytics/movement-features": mobileFeatures }));
  for (const movementType of ["income", "expense", "refund", "obligation_payment"]) {
    for (const [sourceAmount, destinationAmount] of [[0, 40], [-30, 0], [null, -50], [30, 60]]) {
      const m = record(1, { movementType, sourceAmount, destinationAmount, destinationAccountId: 20 });
      assert.equal(insights.movementRecordToInsight(m, "PEN").amount, heuristics.patternMovementAmount({ movement_type: movementType, source_amount: sourceAmount, destination_amount: destinationAmount }));
      assert.equal(insights.movementRecordToInsight(m, "PEN").accountId, 20);
    }
  }
  console.log("movement-suggestions: compared against actual mobile source");
}
console.log(`movement-suggestions: OK (${cpCases.length + cleanupCases.length + accountCases.length + recurringCases.length + riskCases.length} comparative cases + adapters/AI boundaries)`);
