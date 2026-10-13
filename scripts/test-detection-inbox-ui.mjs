import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import ts from "typescript";
import React, { act } from "react";
import { createRoot } from "react-dom/client";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// The mobile reference already provides JSDOM via Jest; do not add runtime dependencies.
const mobileRequire = createRequire(resolve(root, "../DarkMoneyApp/package.json"));
const { JSDOM } = mobileRequire("jsdom");
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost", pretendToBeVisual: true });
for (const key of ["window", "document", "HTMLElement", "KeyboardEvent", "MutationObserver"]) globalThis[key] = dom.window[key];
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.inboxToasts = [];
globalThis.inboxUndo = [];
globalThis.inboxWorkspace = 8;
const virtual = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const mocked = new Map([
  [resolve(root, "src/services/queries/detected-movements.ts"), virtual("export const useDetectedMovements=()=>globalThis.inboxApi;")],
  [resolve(root, "src/services/queries/workspace-data.ts"), virtual("export const getQueryErrorMessage=(error,fallback)=>error?.message??fallback;")],
  [resolve(root, "src/components/ui/toast-provider.tsx"), virtual("export const useToast=()=>({showToast:(value)=>globalThis.inboxToasts.push(value)});")],
  [resolve(root, "src/components/ui/undo-queue.tsx"), virtual("export const useUndoQueue=()=>({schedule:(value)=>globalThis.inboxUndo.push(value)});")],
  [resolve(root, "src/stores/workspace-store.ts"), virtual("export const useWorkspaceStore={getState:()=>({activeWorkspaceId:globalThis.inboxWorkspace})};")],
]);
const webRequire = createRequire(resolve(root, "package.json"));
function load(file) {
  if (mocked.has(file)) return mocked.get(file);
  let js = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  js = js.replace(/from "([^"]+)"/g, (_, specifier) => {
    if (!specifier.startsWith(".")) return `from "${pathToFileURL(webRequire.resolve(specifier)).href}"`;
    const base = resolve(dirname(file), specifier);
    const dependency = [base, `${base}.tsx`, `${base}.ts`].find(existsSync);
    if (!dependency) throw new Error(`Missing UI test dependency: ${specifier}`);
    return `from "${load(dependency)}"`;
  });
  const url = virtual(js); mocked.set(file, url); return url;
}
const { DetectedMovementInbox } = await import(load(resolve(root, "src/modules/notifications/components/detected-movement-inbox.tsx")));
const receipt = (id) => ({ id, userId: "u", workspaceId: 8, status: "pending", description: `Pago ${id}`, appLabel: "BCP", amount: 12, currencyCode: "PEN", occurredAt: "2026-10-01T12:00:00Z", movementId: null });
function api(rows) {
  const value = { calls: [], gate: null, pending: { data: rows, isPending: false, isError: false, isFetching: false, refetch: async () => {} } };
  value.omissions = { mutateAsync: async (input) => {
    value.calls.push(input);
    if (value.gate) return value.gate;
    const changes = input.action === "omit"
      ? input.suggestions.map(before => ({ before, after: { ...before, status: "discarded", updatedAt: "2026-10-13T12:00:00Z" } }))
      : input.changes.map(({ before, after }) => ({ before: after, after: before }));
    return { changes, failed: 0, skipped: 0, readingUpdated: true };
  } };
  return value;
}
let renderer, container;
async function render(value) {
  globalThis.inboxApi = value;
  if (!renderer) { container = document.createElement("div"); document.body.append(container); renderer = createRoot(container); }
  await act(async () => renderer.render(React.createElement(DetectedMovementInbox, { key: String(globalThis.inboxWorkspace), userId: "u", workspaceId: globalThis.inboxWorkspace, onOpen: () => {} })));
}
function button(label, parent = container) {
  const found = [...parent.querySelectorAll("button")].find(node => node.textContent === label);
  assert.ok(found, `Missing button: ${label}`); return found;
}
async function close() { await act(async () => renderer.unmount()); renderer = null; container.remove(); }

// The actual component captures confirmation before a later query refresh.
{
  const value = api([receipt(1), receipt(2)]); await render(value);
  await act(async () => button("Omitir todos").click());
  value.pending.data = [...value.pending.data, receipt(3)]; await render(value);
  const dialog = document.querySelector('[role="dialog"]');
  assert.match(dialog.textContent, /las 2 detecciones/);
  assert.equal(value.calls.length, 0);
  await act(async () => button("Omitir todos", dialog).click());
  assert.deepEqual(value.calls[0].suggestions.map(row => row.id), [1, 2]);
  assert.equal(value.calls[0].markNotificationsRead, false);
  assert.equal(document.querySelector('[role="dialog"]'), null);
  const action = globalThis.inboxUndo.at(-1);
  await close(); // Undo must survive closing the list in the same workspace.
  await act(async () => action.onUndo());
  assert.equal(value.calls[1].action, "restore");
  assert.deepEqual(value.calls[1].changes.map(row => row.before.id), [1, 2]);
}
// Escape/cancel never changes the canonical rows.
{
  const value = api([receipt(1)]); await render(value);
  await act(async () => button("Omitir todos").click());
  await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  assert.equal(document.querySelector('[role="dialog"]'), null);
  assert.equal(value.calls.length, 0); await close();
}
// A second tap before React rerenders is locked, not just visually disabled.
{
  const value = api([receipt(1)]); let finish;
  value.gate = new Promise(resolve => { finish = resolve; }); await render(value);
  await act(async () => { button("Omitir").click(); button("Omitir").click(); });
  assert.equal(value.calls.length, 1);
  assert.equal(value.calls[0].markNotificationsRead, true);
  assert.equal(button("Omitir todos").disabled, true);
  await act(async () => finish({ changes: [], failed: 1, skipped: 0, readingUpdated: true }));
  assert.match(container.querySelector('[role="alert"]').textContent, /confirmar el resultado de 1/);
  assert.equal(button("Omitir").disabled, false); await close();
}
// Undo waits for another operation rather than silently dropping the action.
{
  const value = api([receipt(1), receipt(2)]); await render(value);
  await act(async () => button("Omitir").click());
  const action = globalThis.inboxUndo.at(-1);
  let finish, restoring;
  value.gate = new Promise(resolve => { finish = resolve; });
  await act(async () => container.querySelector('[aria-label="Omitir Pago 2"]').click());
  await act(async () => { restoring = action.onUndo(); });
  assert.equal(value.calls.length, 2, "Undo waits for the in-flight omission, without being lost");
  value.gate = null;
  await act(async () => { finish({ changes: [], failed: 0, skipped: 1, readingUpdated: true }); await restoring; });
  assert.equal(value.calls.length, 3);
  assert.equal(value.calls[2].action, "restore"); await close();
}
// A confirmation and an old Undo action cannot follow the active workspace.
{
  const value = api([receipt(1)]); await render(value);
  await act(async () => button("Omitir").click());
  const action = globalThis.inboxUndo.at(-1);
  await act(async () => button("Omitir todos").click());
  globalThis.inboxWorkspace = 9; await render(api([]));
  assert.equal(document.querySelector('[role="dialog"]'), null);
  await act(async () => action.onUndo());
  assert.equal(value.calls.length, 1);
  assert.match(globalThis.inboxToasts.at(-1).description, /espacio donde omitiste/);
  await close();
}
dom.window.close();
console.log("detection-inbox-ui: OK (actual React/Modal, frozen confirmation, Escape, repeated taps, undo after unmount, workspace guard; no network)");
