import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

// Load pure TypeScript modules without depending on the browser or writing generated files.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const featuresUrl = pathToFileURL(resolve(root, "node_modules/@darkmoney/shared/dist/movement-features.js")).href;
function compile(path, imports = {}) {
  let js = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  for (const [specifier, url] of Object.entries(imports)) js = js.replaceAll(`from "${specifier}"`, `from "${url}"`);
  return `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`;
}
const candidatesUrl = compile(resolve(root, "src/modules/movements/lib/category-suggestion-candidates.ts"), { "@darkmoney/shared/movement-features": featuresUrl });
const { suggestCategoryLocally, deriveLearnedCategoryMatch } = await import(compile(resolve(root, "src/modules/movements/lib/local-category-suggestion.ts"), {
  "@darkmoney/shared/movement-features": featuresUrl, "./category-suggestion-candidates": candidatesUrl,
}));
const now = new Date("2026-09-30T17:00:00-05:00").getTime();
Date.now = () => now;
const categories = [
  { id: 1, name: "Alimentación", kind: "expense", isActive: true },
  { id: 2, name: "Transporte", kind: "expense", isActive: true },
  { id: 3, name: "Sueldo", kind: "income", isActive: true },
  { id: 4, name: "Archivada", kind: "expense", isActive: false },
];
function movement(id, categoryId, extra = {}) {
  return { id, movementType: "expense", status: "posted", occurredAt: "2026-09-23T12:00:00-05:00", description: "Almuerzo menú", sourceAccountId: 10, destinationAccountId: null, sourceAmount: 20, destinationAmount: null, categoryId, counterpartyId: null, ...extra };
}
const input = { description: "Almuerzo menú", movementType: "expense", accountId: 10, amount: 20, occurredAt: "2026-09-30T12:00:00-05:00", categories, counterpartyId: null, movements: [movement(1, 1), movement(2, 1)] };
const feedback = (id, text, date = "2026-09-29T12:00:00-05:00") => ({ acceptedCategoryId: id, normalizedDescription: text, createdAt: date, feedbackKind: "manual_category_change" });
const cases = [
  input,
  { ...input, movements: [movement(1, 1), movement(2, 2)] }, // Ambiguous categories: no local suggestion.
  { ...input, description: "Algo nuevo", movements: [movement(1, 1)] }, // Amount/account alone are not semantic evidence.
  { ...input, excludedMovementId: 1, movements: [movement(1, 1), movement(2, 2, { status: "voided" })] },
  { ...input, movements: [movement(1, 1, { status: "pending" })] },
  { ...input, movementType: "income", movements: [movement(1, 1), movement(2, 3, { movementType: "income", sourceAmount: null, destinationAmount: 20, sourceAccountId: null, destinationAccountId: 10 })] },
  { ...input, movementType: "transfer" },
  { ...input, description: "Menú almuerzo 2026", learningFeedback: [feedback(2, "menu almuerzo")] }, // Correction takes priority over history.
  { ...input, learningFeedback: [feedback(1, "almuerzo menu", "2026-09-28T12:00:00-05:00"), feedback(2, "almuerzo menu")] },
  { ...input, learningFeedback: [feedback(4, "almuerzo menu"), feedback(1, "almuerzo menu", "2026-09-28T12:00:00-05:00")] },
  { ...input, description: "Taxi", learningFeedback: [feedback(2, "taxi")] },
  { ...input, description: "Taxi", learningFeedback: [feedback(2, "taxi casa")] },
  { ...input, movements: [movement(1, 1, { occurredAt: "2025-09-01T12:00:00-05:00" }), ...Array.from({ length: 300 }, (_, i) => movement(i + 2, null, { description: "Otro" }))] },
];
assert.equal(suggestCategoryLocally(cases[0]).categoryId, 1);
for (const index of [1, 2, 3, 4, 6, 12]) assert.equal(suggestCategoryLocally(cases[index]), null, `case ${index}`);
assert.equal(suggestCategoryLocally(cases[5]).categoryId, 3);
assert.equal(suggestCategoryLocally(cases[7]).categoryId, 2);
assert.deepEqual(suggestCategoryLocally(cases[7]).reasons, ["porque corregiste esto antes"]);
assert.equal(suggestCategoryLocally(cases[8]).categoryId, 2);
assert.equal(deriveLearnedCategoryMatch("Almuerzo menú", cases[9].learningFeedback, categories.filter((c) => c.isActive)), null);
assert.equal(suggestCategoryLocally(cases[10]).confidence, 0.68);
assert.equal(deriveLearnedCategoryMatch("Taxi", cases[11].learningFeedback, categories), null);

// Optional independent reference: execute the actual mobile pure functions on the same inputs.
const referenceIndex = process.argv.indexOf("--mobile-reference");
if (referenceIndex !== -1) {
  const mobile = resolve(process.argv[referenceIndex + 1]);
  assert.ok(existsSync(resolve(mobile, "services/analytics/category-suggestions.ts")), "Mobile reference source is required");
  const mobileFeatures = compile(resolve(mobile, "services/analytics/movement-features.ts"));
  const mobileCandidates = await import(compile(resolve(mobile, "services/analytics/category-suggestions.ts"), { "./movement-features": mobileFeatures }));
  const heuristics = compile(resolve(mobile, "features/movements/lib/pattern-heuristics.ts"), { "../../../services/analytics/movement-features": mobileFeatures });
  const threshold = "data:text/javascript,export const LOCAL_CATEGORY_AI_CONFIDENCE_THRESHOLD=0.6";
  const mobileLearned = await import(compile(resolve(mobile, "features/movements/lib/category-suggestion-derivation.ts"), {
    "../../../services/analytics/movement-features": mobileFeatures,
    "../../../lib/movement-ai-orchestrator": threshold,
    "./pattern-heuristics": heuristics,
  }));
  for (const [index, current] of cases.entries()) {
    let expected = null;
    const validCategories = categories.filter((c) => c.isActive && c.kind === (current.movementType === "income" ? "income" : "expense"));
    const learned = mobileLearned.deriveLearnedCategoryMatch({ description: current.description, categories: validCategories, learningFeedback: current.learningFeedback });
    if (current.movementType !== "transfer") {
      if (learned) expected = { categoryId: learned.categoryId, categoryName: learned.categoryName, confidence: learned.confidence, reasons: ["porque corregiste esto antes"] };
      else {
        const history = current.movements.filter((m) => m.status === "posted").sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt)).slice(0, 300).filter((m) => m.id !== current.excludedMovementId && m.categoryId != null);
        const mapped = history.map((m) => ({ ...m, amount: (m.movementType === "income" || m.movementType === "refund") ? Math.abs(m.destinationAmount ?? 0) || Math.abs(m.sourceAmount ?? 0) : Math.abs(m.sourceAmount ?? 0) || Math.abs(m.destinationAmount ?? 0) }));
        const target = { ...movement(current.excludedMovementId ? -current.excludedMovementId : -1, null), ...current, sourceAccountId: current.movementType === "income" ? null : current.accountId, destinationAccountId: current.movementType === "income" ? current.accountId : null };
        const [candidate] = mobileCandidates.buildCategorySuggestionCandidates({ movements: [...mapped, target], categories: validCategories, isCashflow: (m) => ["income", "refund", "expense", "subscription_payment", "obligation_payment"].includes(m.movementType), isIncomeLike: (m) => ["income", "refund"].includes(m.movementType), getAmount: (m) => m.amount ?? 0, limit: 1, targetLimit: 1 });
        if (candidate) expected = { categoryId: candidate.suggestedCategoryId, categoryName: candidate.suggestedCategoryName, confidence: candidate.confidence, reasons: candidate.reasons };
      }
    }
    const actual = suggestCategoryLocally(current);
    assert.deepEqual(actual ? { categoryId: actual.categoryId, categoryName: actual.categoryName, confidence: actual.confidence, reasons: actual.reasons } : null, expected, `mobile parity case ${index}`);
  }
  console.log(`movement-category: ${cases.length} cases match the actual mobile implementation`);
}
console.log("movement-category: OK — learned priority, ambiguity, direction, status, history window");
