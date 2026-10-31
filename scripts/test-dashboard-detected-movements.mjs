import assert from "node:assert/strict";
import { React, act, dom, load, mock, createRoot, MemoryRouter, button } from "./lib/web-ui-harness.mjs";
mock("src/services/queries/detected-movements.ts", "export const useDetectedMovements=()=>globalThis.dashboardDetectionApi;");
mock("src/modules/dashboard/components/dashboard-detection-quick-action.tsx", "export const DashboardDetectionQuickAction=()=>null;");
const { DashboardDetectedMovements } = await import(load("src/modules/dashboard/components/dashboard-detected-movements.tsx"));
const container = document.createElement("div"); document.body.append(container); const renderer = createRoot(container);
const row = { id: 12, description: "Compra real", movementType: "expense", amount: 15, currencyCode: "PEN", occurredAt: "2026-10-15T12:00:00Z", appLabel: "BCP" };
let retries = 0;
async function render(pending) { globalThis.dashboardDetectionApi = { pending: { isPending: false, isError: false, data: [], refetch: () => retries++, ...pending } }; await act(async () => renderer.render(React.createElement(MemoryRouter, null, React.createElement(DashboardDetectedMovements, { userId: "u", workspaceId: 1 })))); }
await render({}); assert.equal(container.innerHTML, "");
await render({ isPending: true }); assert.equal(container.innerHTML, "");
await render({ data: [row, { ...row, id: 13, description: "Segunda" }] }); assert.match(container.textContent, /Por revisar · 2/); assert.match(container.textContent, /Compra real/); assert.doesNotMatch(container.textContent, /Segunda/); assert.equal([...container.querySelectorAll("a")].find(a => a.textContent === "Revisar y guardar").getAttribute("href"), "/app/notifications?detected=12&detectedOrigin=pending");
await render({ isError: true }); assert.match(container.textContent, /No pudimos consultar/); await act(async () => button(container, "Reintentar").click()); assert.equal(retries, 1);
await act(async () => renderer.unmount()); container.remove(); dom.window.close(); console.log("Dashboard detection: empty, first item, review link and retry passed.");
