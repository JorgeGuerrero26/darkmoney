import assert from "node:assert/strict";
import { React, act, dom, load, mock, createRoot, button } from "./lib/web-ui-harness.mjs";
mock("src/modules/offline/use-offline-movement-queue.ts", "export const useOfflineMovementQueue=()=>globalThis.pendingHook;");
const { PendingMovementNotice } = await import(load("src/modules/offline/pending-movement-notice.tsx"));
const row = { userId: "u", workspaceId: 8, dedupeKey: "abc", createdAt: "2026-10-20T13:40:50Z", state: "pending", input: { description: "Café" } };
let calls = 0; globalThis.pendingHook = { userId: "u", workspaceId: 8, query: { data: [], isError: false }, retry: { isPending: false, mutateAsync: async () => {} }, sync: { isPending: false, mutateAsync: async () => { calls++; return { locked: true, sent: 1, needsReview: 0, interrupted: false }; } } };
const container = document.createElement("div"); document.body.append(container); const renderer = createRoot(container);
async function render() { await act(async () => renderer.render(React.createElement(PendingMovementNotice))); }
await render(); assert.equal(container.innerHTML, "");
globalThis.pendingHook.query.data = [row]; await render(); await act(async () => button(container, "1 movimiento por enviar ›").click()); assert.match(container.querySelector('[role="dialog"]').textContent, /Café/); await act(async () => button(container, "Intentar enviar ahora").click()); assert.equal(calls, 1); assert.match(container.textContent, /1 cambio enviado/);
globalThis.pendingHook.query.data = [{ ...row, state: "needs_review", error: "Revisa el cambio" }]; await render(); assert.match(container.textContent, /1 cambio necesita revisión/); assert.equal(button(container, "Intentar enviar ahora").disabled, true); await act(async () => button(container, "Preparar reintento").click()); assert.match(container.textContent, /listo para intentar/);
globalThis.pendingHook.userId = undefined; await render(); assert.equal(container.innerHTML, "");
await act(async () => renderer.unmount()); container.remove(); dom.window.close(); console.log("Offline notice: scoped visibility, manual send and review state passed.");
