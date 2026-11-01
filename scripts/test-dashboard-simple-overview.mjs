import assert from "node:assert/strict";
import { React, act, dom, load, createRoot, MemoryRouter } from "./lib/web-ui-harness.mjs";
const { DashboardSimpleOverview } = await import(load("src/modules/dashboard/components/dashboard-simple-overview.tsx"));
const account = (id, currencyCode, currentBalance, extra = {}) => ({ id, name: `Cuenta ${id}`, currencyCode, currentBalance, currentBalanceInBaseCurrency: null, includeInNetWorth: true, isArchived: false, ...extra });
const container = document.createElement("div"); document.body.append(container); const renderer = createRoot(container);
const props = { accounts: [account(1, "PEN", 100), account(2, "USD", 10), account(3, "PEN", 999, { isArchived: true })], currency: "PEN", baseCurrency: "PEN", rates: new Map([["USD:PEN", 3.7]]), month: { income: 1000, expense: 400, unconvertedCount: 0 }, detections: "DETECCIÓN" };
async function render(extra = {}) { await act(async () => renderer.render(React.createElement(MemoryRouter, null, React.createElement(DashboardSimpleOverview, { ...props, ...extra })))); }
await render(); assert.match(container.firstElementChild.className, /lg:grid-cols-2/); assert.match(container.textContent, /137[.,]00/); assert.doesNotMatch(container.textContent, /Cuenta 3/); assert.match(container.textContent, /Te quedaron/); assert.equal(container.querySelector('a[href="/app/accounts?resource=1"]').textContent.includes("Cuenta 1"), true); assert.match(container.textContent, /DETECCIÓN/);
await render({ rates: new Map(), month: { income: 1000, expense: 400, unconvertedCount: 1 } }); assert.match(container.textContent, /Saldo no disponible/); assert.match(container.textContent, /Sin conversión/); assert.match(container.textContent, /Faltan conversiones para calcular las entradas/); assert.doesNotMatch(container.textContent, /1,000[.,]00/);
await render({ accounts: [], detections: null }); assert.match(container.textContent, /Agrega una cuenta/); assert.match(container.textContent, /0[.,]00/);
await act(async () => renderer.unmount()); container.remove(); dom.window.close(); console.log("Dashboard simple: account totals, archived accounts, conversions and month data passed.");
