import assert from "node:assert/strict";
import { isAmbiguousWriteError, runIdempotentInsert } from "../src/lib/idempotent-write.ts";

const noWait = async () => {};
assert.equal(isAmbiguousWriteError({ message: "Failed to fetch" }), true);
assert.equal(isAmbiguousWriteError({ code: "42501", message: "permission denied" }), false);
assert.equal(isAmbiguousWriteError({ code: "23514", message: "invalid amount" }), false);

let lookups = 0;
const confirmed = await runIdempotentInsert({
  dedupeKey: "same-operation",
  insert: async () => ({ data: null, error: { message: "Failed to fetch" } }),
  lookup: async () => ({ data: ++lookups === 1 ? null : { id: 17 }, error: null }),
  sleep: noWait,
});
assert.deepEqual(confirmed, { data: { id: 17 }, created: false });
assert.equal(lookups, 2, "an empty lookup must not end confirmation before the server commits");

for (const [dedupeKey, error] of [
  [null, { message: "Failed to fetch" }],
  ["a-key", { code: "42501", message: "permission denied" }],
  ["a-key", { code: "23514", message: "invalid amount" }],
]) {
  await assert.rejects(runIdempotentInsert({
    dedupeKey,
    insert: async () => ({ data: null, error }),
    lookup: async () => { assert.fail("unsafe write must not be confirmed or retried"); },
    sleep: noWait,
  }), (caught) => caught === error);
}

const rows = new Map();
let nextId = 1;
let failSecondPart = true;
async function savePart(key) {
  return runIdempotentInsert({
    dedupeKey: key,
    insert: async () => {
      if (rows.has(key)) return { data: null, error: { code: "23505", message: "duplicate key" } };
      if (key.endsWith("split-2") && failSecondPart) {
        failSecondPart = false;
        return { data: null, error: { code: "PGRST002", message: "schema unavailable" } };
      }
      const data = { id: nextId++ };
      rows.set(key, data);
      return { data, error: null };
    },
    lookup: async () => ({ data: rows.get(key) ?? null, error: null }),
    sleep: noWait,
  });
}
async function saveSplit() {
  const results = [];
  for (let index = 1; index <= 3; index++) results.push(await savePart(`draft:split-${index}`));
  return results;
}
await assert.rejects(saveSplit(), (error) => error.code === "PGRST002");
assert.equal(rows.size, 1);
const resumed = await saveSplit();
assert.equal(rows.size, 3, "resuming a partial split must not duplicate the first part");
assert.deepEqual(resumed.map((result) => result.data.id), [1, 2, 3]);
assert.equal(resumed[0].created, false, "existing rows must not be owned by rollback compensation");
await saveSplit();
assert.equal(rows.size, 3);

const lookupFailure = { code: "42501", message: "permission denied" };
let deniedLookups = 0;
await assert.rejects(runIdempotentInsert({
  dedupeKey: "a-key",
  insert: async () => ({ data: null, error: { message: "timeout" } }),
  lookup: async () => { deniedLookups++; return { data: null, error: lookupFailure }; },
  sleep: noWait,
}));
assert.equal(deniedLookups, 1);
console.log("movement-idempotency: OK — partial retries, lost responses and SQL failures");
