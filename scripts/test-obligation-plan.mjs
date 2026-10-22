import assert from "node:assert/strict";

import {
  coverPlan,
  defaultFirstDueDate,
  expandPaymentPlan,
  normalizePaymentPlan,
  parsePaymentPlan,
  planDifference,
} from "../src/modules/obligations/lib/payment-plan.ts";

const equal = { mode: "equal", count: 6, firstDueDate: "2026-09-15" };
const equalRows = expandPaymentPlan(equal, 1000, "2026-03-15");
assert.equal(equalRows.length, 6);
assert.equal(equalRows[0].amount, 166.67);
assert.equal(equalRows.at(-1).amount, 166.65);
assert.equal(planDifference(1000, equalRows), 0);
assert.equal(equalRows[0].dueDate, "2026-09-15");
assert.equal(defaultFirstDueDate("2026-03-15", new Date("2026-09-18T12:00:00Z")), "2026-09-15");

const custom = {
  mode: "custom",
  agreed: [
    { amount: 540, dueDate: "2026-09-15" },
    { amount: 100, dueDate: "2026-09-15" },
  ],
  tail: 200,
  firstDueDate: "2026-09-15",
};
const saved = JSON.parse(JSON.stringify(normalizePaymentPlan(custom)));
assert.deepEqual(parsePaymentPlan(saved), custom);
const customRows = expandPaymentPlan(parsePaymentPlan(saved), 1000, "2026-03-15");
assert.deepEqual(customRows.map((row) => row.amount), [540, 100, 200, 160]);
assert.deepEqual(customRows.map((row) => row.dueDate), ["2026-09-15", "2026-10-15", "2026-11-15", "2026-12-15"]);
assert.equal(planDifference(1000, customRows), 0);
assert.deepEqual(parsePaymentPlan({ mode: "custom", agreed: [100, "150"], tail: null }), {
  mode: "custom", agreed: [{ amount: 100 }, { amount: 150 }], tail: null,
});

const covered = coverPlan(equal, 1000, 1000, "2026-03-15", [
  { amount: 30, date: "2026-09-16" },
  { amount: 200, date: "2026-09-17" },
]);
assert.equal(covered[0].status, "covered");
assert.equal(covered[1].status, "partial");
assert.equal(covered[1].covered, 63.33);
assert.equal(covered[1].remaining, 103.34);
assert.equal(covered[2].status, "pending");
assert.equal(covered[0].coveredAt, "2026-09-17");
assert.equal(covered[1].coveredAt, null);

const laterPlan = coverPlan({ mode: "equal", count: 2, firstDueDate: "2026-09-15" }, 1000, 1000, "2026-03-15", [
  { amount: 100, date: "2026-09-10" },
  { amount: 300, date: "2026-08-31" },
]);
assert.deepEqual(laterPlan.map(row => [row.amount, row.covered, row.remaining]), [[350, 100, 250], [350, 0, 350]]);
assert.equal(laterPlan.every(row => row.coveredAt === null), true);

const adjusted = coverPlan({ mode: "equal", count: 4, firstDueDate: "2026-09-15" }, 400, 500, "2026-03-15", [
  { amount: 100, date: "2026-09-16" },
]);
assert.deepEqual(adjusted.map((row) => row.amount), [100, 133.33, 133.33, 133.34]);
assert.equal(adjusted[0].status, "covered");

console.log("obligation-payment-plan: OK");

// Día de cobro (payDay): mismo contrato y mismas fechas que la implementación móvil actual.
{
  const { readFileSync } = await import("node:fs");
  const { createRequire } = await import("node:module");
  const ts = (await import("typescript")).default;
  const { applyPayDay } = await import("../src/modules/obligations/lib/payment-plan.ts");
  const { build } = await import("esbuild");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { pathToFileURL, fileURLToPath } = await import("node:url");
  const bundle = join(tmpdir(), `obligation-editor-input-${process.pid}.mjs`);
  await build({ entryPoints: [fileURLToPath(new URL("../src/modules/obligations/lib/obligation-editor-input.ts", import.meta.url))], bundle: true, format: "esm", platform: "node", outfile: bundle, logLevel: "silent" });
  const { validateObligationPlan } = await import(pathToFileURL(bundle).href);
  const mobileSource = readFileSync(new URL("../../DarkMoneyApp/features/obligations/lib/payment-plan.ts", import.meta.url), "utf8");
  const cjs = ts.transpileModule(mobileSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mobileRequire = createRequire(new URL("../../DarkMoneyApp/package.json", import.meta.url));
  const mobile = { exports: {} };
  new Function("exports", "require", "module", cjs)(mobile.exports, mobileRequire, mobile);
  const m = mobile.exports;

  assert.equal(applyPayDay("2027-04-10", 31), "2027-04-30");
  assert.equal(applyPayDay("2027-02-10", 30), "2027-02-28");
  assert.equal(applyPayDay("2028-02-10", "last"), "2028-02-29");
  assert.equal(applyPayDay("2027-03-10", 5), "2027-03-05");

  let compared = 0;
  const payDays = [undefined, "last", 1, 5, 15, 28, 29, 30, 31];
  const starts = ["2026-01-31", "2026-03-15", "2027-12-29", "2028-02-29"];
  const plans = [
    { mode: "equal", count: 7, firstDueDate: "2026-10-31" },
    { mode: "equal", count: 13 },
    { mode: "custom", agreed: [{ amount: 550, dueDate: "2026-10-15" }, { amount: 700, dueDate: "2026-10-20" }, { amount: 90 }], tail: 100, firstDueDate: "2026-10-15" },
    { mode: "custom", agreed: [], tail: 333.33, firstDueDate: "2027-01-31" },
  ];
  for (const payDay of payDays) for (const startDate of starts) for (const base of plans) {
    const raw = JSON.parse(JSON.stringify({ ...base, ...(payDay !== undefined ? { payDay } : {}) }));
    const webPlan = parsePaymentPlan(raw), mobilePlan = m.parsePaymentPlan(raw);
    assert.deepEqual(webPlan, mobilePlan);
    const web = expandPaymentPlan(webPlan, 2450, startDate);
    const native = m.expandPaymentPlan({ plan: mobilePlan, principal: 2450, startDate });
    assert.deepEqual(web.map(({ seq, dueDate, amount, source }) => ({ seq, dueDate, amount, source })), native.map(({ seq, dueDate, amount, source }) => ({ seq, dueDate, amount, source })), JSON.stringify({ payDay, startDate, base }));
    compared += 1;
  }
  for (const bad of [0, 32, 2.5, "otro", ""]) assert.equal(parsePaymentPlan({ mode: "equal", count: 3, payDay: bad }).payDay, m.parsePaymentPlan({ mode: "equal", count: 3, payDay: bad }).payDay);

  // Guardar desde web conserva el día elegido en móvil y rechaza uno inválido en lugar de borrarlo.
  const kept = validateObligationPlan({ mode: "equal", count: 3, firstDueDate: "2026-10-15", payDay: "last" }, 300, "2026-03-15");
  assert.equal(kept.plan.payDay, "last");
  assert.deepEqual(kept.rows.map((row) => row.dueDate), ["2026-10-31", "2026-11-30", "2026-12-31"]);
  assert.throws(() => validateObligationPlan({ mode: "equal", count: 3, payDay: 40 }, 300, "2026-03-15"), /día de cobro/);
  console.log(`obligation-payment-plan payDay: OK (${compared} comparaciones con la implementación móvil actual)`);
}

// Interés pactado ("Total a devolver"): misma cuenta que agreedInterest.ts móvil.
{
  const { readFileSync } = await import("node:fs");
  const ts = (await import("typescript")).default;
  const { agreedInterest } = await import("../src/modules/obligations/lib/agreed-interest.ts");
  const phone = {};
  new Function("exports", ts.transpileModule(readFileSync(new URL("../../DarkMoneyApp/features/obligations/lib/agreedInterest.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(phone);
  let compared = 0;
  for (const principal of [0, 0.01, 100, 1500, 7175.33]) for (const returnTotal of [0, 99.99, 100, 100.004, 1550, 1500, 9000.5]) {
    assert.deepEqual(agreedInterest({ principal, returnTotal }), phone.agreedInterest({ principal, returnTotal }));
    compared += 1;
  }
  assert.deepEqual(agreedInterest({ principal: 1500, returnTotal: 1550 }), { interestAmount: 50, interestPercent: 3.33, belowPrincipal: false });
  console.log(`obligation agreed interest: OK (${compared} comparaciones con móvil)`);
}

// Calendario efectivo al editar una deuda que creció: misma base y filas que effectivePlanSchedule móvil.
{
  const { readFileSync } = await import("node:fs");
  const { createRequire } = await import("node:module");
  const ts = (await import("typescript")).default;
  const { effectivePlanSchedule } = await import("../src/modules/obligations/lib/payment-plan.ts");
  const cjs = ts.transpileModule(readFileSync(new URL("../../DarkMoneyApp/features/obligations/lib/payment-plan.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mobile = { exports: {} };
  new Function("exports", "require", "module", cjs)(mobile.exports, createRequire(new URL("../../DarkMoneyApp/package.json", import.meta.url)), mobile);
  let compared = 0;
  const plans = [
    { mode: "equal", count: 12, firstDueDate: "2026-08-15" },
    { mode: "equal", count: 6, firstDueDate: "2026-09-30", payDay: "last" },
    { mode: "custom", agreed: [{ amount: 1000, dueDate: "2026-08-15" }], tail: 750, firstDueDate: "2026-08-15" },
  ];
  const contexts = [
    { openingPrincipal: 7175, currentDebt: 7175, payments: [] },
    { openingPrincipal: 7175, currentDebt: 25679, payments: [{ amount: 500, date: "2026-05-02" }, { amount: 900, date: "2026-08-20" }] },
    { openingPrincipal: 3000, currentDebt: 2500, payments: [{ amount: 3000, date: "2026-07-01" }] },
  ];
  for (const plan of plans) for (const context of contexts) {
    const web = effectivePlanSchedule(plan, context, "2026-03-15");
    const native = mobile.exports.effectivePlanSchedule({ plan, context, startDate: "2026-03-15" });
    assert.equal(web.basis, native.basis);
    assert.deepEqual(web.payments, native.payments.map(({ seq, dueDate, amount, source }) => ({ seq, dueDate, amount, source })));
    compared += 1;
  }
  console.log(`obligation effective plan: OK (${compared} comparaciones con móvil)`);
}
