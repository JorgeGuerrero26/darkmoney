import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { dom, load, root } from "./lib/web-ui-harness.mjs";
const rootRequire = createRequire(resolve(root, "package.json"));
let fake;
try { fake = rootRequire("fake-indexeddb"); } catch { fake = createRequire(resolve(root, ".tmp/offline-test-deps/package.json"))("fake-indexeddb"); }
globalThis.indexedDB = fake.indexedDB; globalThis.IDBKeyRange = fake.IDBKeyRange;
const { enqueueMovement, listQueuedMovements, acknowledgeQueuedMovement, markQueuedMovementForReview } = await import(load("src/lib/offline/movement-queue.ts"));
const input = { userId: "u", workspaceId: 8, dedupeKey: "cf342b8d-7711-4b24-93a8-cc436d883246", movementType: "expense", status: "posted", description: "Compra", occurredAt: "2026-10-20T13:40:50Z", sourceAccountId: 1, sourceAmount: 10, destinationAccountId: null, destinationAmount: null, metadata: { channel: "quick-entry" } };
const source = structuredClone(input); const request = enqueueMovement(source); source.sourceAmount = 999; source.metadata.channel = "changed";
const row = await request; assert.equal(row.input.sourceAmount, 10); assert.equal(row.input.metadata.channel, "quick-entry");
const duplicate = await Promise.all([enqueueMovement(input), enqueueMovement(input)]); assert.equal(duplicate[0].createdAt, row.createdAt); assert.equal((await listQueuedMovements("u", 8)).length, 1);
await assert.rejects(enqueueMovement({ ...input, sourceAmount: 20 }), /clave ya pertenece/);
await enqueueMovement({ ...input, userId: "other" }); await enqueueMovement({ ...input, workspaceId: 9 }); assert.equal((await listQueuedMovements("u", 8)).length, 1); assert.equal((await listQueuedMovements("other", 8)).length, 1); assert.equal((await listQueuedMovements("u", 9)).length, 1);
assert.equal(await markQueuedMovementForReview(row, "Revisar"), true); assert.equal(await acknowledgeQueuedMovement(row), false); assert.equal(await markQueuedMovementForReview(row, "otra"), false);
const reviewed = (await listQueuedMovements("u", 8))[0]; assert.equal(reviewed.state, "needs_review"); assert.equal(reviewed.revision, 2); assert.equal(await acknowledgeQueuedMovement(reviewed), false);
const other = (await listQueuedMovements("other", 8))[0]; assert.equal(await acknowledgeQueuedMovement(other), true); assert.equal((await listQueuedMovements("other", 8)).length, 0); assert.equal((await listQueuedMovements("u", 8)).length, 1);
dom.window.close(); console.log("Offline IndexedDB: atomic key, captured payload, user/space isolation and revision guards passed.");
