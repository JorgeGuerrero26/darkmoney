import assert from "node:assert/strict";
import { React, act, dom, load, createRoot, MemoryRouter, button } from "./lib/web-ui-harness.mjs";
const { DashboardSimpleAgenda } = await import(load("src/modules/dashboard/components/dashboard-simple-agenda.tsx"));
const line = (kind, refId, dueDate, amount, label, extra = {}) => ({ kind, refId, dueDate, amount, label, source: "scheduled", ...extra });
const cashflow = { projection: { months: [
  { monthKey: "2026-10", unconvertedCount: 0, inflows: [line("recurring_income", 7, "2026-10-18", 500, "Sueldo")], outflows: [line("subscription", 5, "2026-10-16", 10, "Servicio"), line("subscription", 6, "2026-10-14", 11, "Pasado"), line("typical_spend", 0, "2026-10-19", 99, "Estimación general")] },
  { monthKey: "2026-11", unconvertedCount: 0, inflows: [], outflows: [line("subscription", 8, "2026-11-14", 22, "Último día"), line("subscription", 9, "2026-11-15", 23, "Fuera de plazo")] },
] } };
const container = document.createElement("div"); document.body.append(container); const renderer = createRoot(container); let retries = 0;
const props = { cashflow, currency: "PEN", now: new Date("2026-10-15T17:00:00Z"), ready: true, failed: false, onRetry: () => retries++ };
async function render(extra = {}) { await act(async () => renderer.render(React.createElement(MemoryRouter, null, React.createElement(DashboardSimpleAgenda, { ...props, ...extra })))); }
await render(); assert.match(container.textContent, /Servicio/); assert.match(container.textContent, /Sueldo/); assert.match(container.textContent, /Último día/); assert.doesNotMatch(container.textContent, /Pasado|Fuera de plazo|Estimación general/); assert.equal(container.querySelector('a[href="/app/subscriptions?resource=5"]').textContent.includes("Servicio"), true);
await render({ cashflow: { projection: { months: [{ ...cashflow.projection.months[0], unconvertedCount: 1 }, cashflow.projection.months[1]] } } }); assert.match(container.textContent, /No se pudieron comprobar todos/); assert.doesNotMatch(container.textContent, /Servicio/);
await render({ cashflow: { projection: { months: [cashflow.projection.months[0]] } } }); assert.match(container.textContent, /No se pudieron comprobar todos/); assert.doesNotMatch(container.textContent, /Servicio/);
await render({ ready: false, failed: true }); assert.match(container.textContent, /No se pudieron comprobar/); await act(async () => button(container, "Reintentar").click()); assert.equal(retries, 1);
await render({ cashflow: { projection: { months: cashflow.projection.months.map(month => ({ ...month, inflows: [], outflows: [] })) } } }); assert.equal(container.innerHTML, "");
await act(async () => renderer.unmount()); container.remove(); dom.window.close(); console.log("Dashboard simple agenda: calendar bounds, source links and incomplete data passed.");
