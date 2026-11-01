import assert from "node:assert/strict";
import { React, act, dom, load, mock, createRoot, QueryClient, QueryClientProvider, settle } from "./lib/web-ui-harness.mjs";
mock("src/modules/auth/auth-context.tsx", "export const useAuth=()=>({user:globalThis.queueUser});");
mock("src/stores/workspace-store.ts", "export const useWorkspaceStore=selector=>selector({activeWorkspaceId:globalThis.queueWorkspace});");
mock("src/services/supabase/client.ts", "export const supabase={auth:{getSession:()=>globalThis.queueGetSession()}};");
mock("src/services/queries/workspace-data.ts", "export const useCreateMovementMutation=()=>({mutateAsync:value=>globalThis.queueSend(value)});");
mock("src/lib/offline/movement-queue.ts", `export const listQueuedMovements=async(u,w)=>globalThis.queueRows.filter(r=>r.userId===u&&r.workspaceId===w);export const acknowledgeQueuedMovement=async(r)=>{globalThis.queueAck.push(r);return true};export const markQueuedMovementForReview=async(r)=>{globalThis.queueReview.push(r);return true};export const validateQueuedMovement=()=>{};export const enqueueMovement=async(r)=>r;export const retryReviewedMovement=async()=>true;`);
Object.defineProperty(globalThis, "navigator", { configurable: true, value: { onLine: true, locks: { request: async (_name, _options, callback) => callback({}) } } });
const { useOfflineMovementQueue } = await import(load("src/modules/offline/use-offline-movement-queue.ts"));
const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } } });
const container = document.createElement("div"); document.body.append(container); const renderer = createRoot(container);
globalThis.queueUser = { id: "u" }; globalThis.queueWorkspace = 8; globalThis.queueAck = []; globalThis.queueReview = []; let sent = 0, release;
globalThis.queueRows = [{ userId: "u", workspaceId: 8, dedupeKey: "key", state: "pending", revision: 1, input: { userId: "u", workspaceId: 8, dedupeKey: "key" } }];
globalThis.queueSend = async () => { sent++; return 12; }; globalThis.queueGetSession = async () => ({ data: { session: { user: { id: "other" } } }, error: null });
let hook; function Probe() { hook = useOfflineMovementQueue(); return null; }
async function render() { await act(async () => renderer.render(React.createElement(QueryClientProvider, { client }, React.createElement(Probe)))); await settle(); }
await render(); let result; await act(async () => { result = await hook.sync.mutateAsync(); }); assert.equal(sent, 0); assert.equal(result.interrupted, true); assert.equal(globalThis.queueReview.length, 0);
globalThis.queueGetSession = async () => { throw new Error("session unavailable"); }; await act(async () => { result = await hook.sync.mutateAsync(); }); assert.equal(sent, 0); assert.equal(result.interrupted, true); assert.equal(globalThis.queueReview.length, 0);
globalThis.queueGetSession = () => new Promise(resolve => { release = resolve; }); let waiting; await act(async () => { waiting = hook.sync.mutateAsync(); }); globalThis.queueWorkspace = 9; await render(); await act(async () => { release({ data: { session: { user: { id: "u" } } }, error: null }); result = await waiting; }); assert.equal(sent, 0); assert.equal(result.interrupted, true);
globalThis.queueWorkspace = 8; globalThis.queueGetSession = async () => ({ data: { session: { user: { id: "u" } } }, error: null }); await render(); await act(async () => { result = await hook.sync.mutateAsync(); }); assert.equal(sent, 1); assert.equal(result.sent, 1); assert.equal(globalThis.queueAck.length, 1);
await act(async () => renderer.unmount()); client.clear(); container.remove(); delete globalThis.navigator; dom.window.close(); console.log("Offline queue hook: authenticated scope and workspace changes passed.");
