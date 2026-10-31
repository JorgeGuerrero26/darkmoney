import assert from "node:assert/strict";
import { React, act, dom, load, createRoot, MemoryRouter } from "./lib/web-ui-harness.mjs";
const { DashboardSimpleBudgets } = await import(load("src/modules/dashboard/components/dashboard-simple-budgets.tsx"));
const budget = (id, spentAmount, extra = {}) => ({ id, name: `Presupuesto ${id}`, isActive: true, currencyCode: "PEN", periodStart: "2026-10-01", periodEnd: "2026-10-31", limitAmount: 100, spentAmount, usedPercent: spentAmount, ...extra });
const budgets = [budget(1, 120), budget(2, 85), budget(3, 40), budget(4, 200, { periodEnd: "2026-09-30" })];
const metrics = new Map(budgets.map(row => [row.id, { contributions: [] }]));
const container = document.createElement("div"); document.body.append(container); const renderer = createRoot(container);
const props = { budgets, metrics, baseCurrency: "PEN", rates: new Map(), now: new Date("2026-10-15T17:00:00Z") };
async function render(extra = {}) { await act(async () => renderer.render(React.createElement(MemoryRouter, null, React.createElement(DashboardSimpleBudgets, { ...props, ...extra })))); }
await render(); assert.match(container.textContent, /Presupuesto 1/); assert.match(container.textContent, /20[.,]00 de más/); assert.match(container.textContent, /Quedan.*15[.,]00/); assert.doesNotMatch(container.textContent, /Presupuesto 3|Presupuesto 4/); assert.ok(container.querySelector('a[href="/app/budgets?resource=1"]'));
const incomplete = new Map(metrics); incomplete.set(3, { contributions: [{ nativeAmount: 4, nativeCurrencyCode: "USD" }] }); await render({ metrics: incomplete }); assert.match(container.textContent, /Presupuesto 3/); assert.match(container.textContent, /Consumo por comprobar/);
await render({ budgets: [budget(3, 40)] }); assert.equal(container.innerHTML, "");
await act(async () => renderer.unmount()); container.remove(); dom.window.close(); console.log("Dashboard simple budgets: thresholds, periods, amounts and missing conversions passed.");
