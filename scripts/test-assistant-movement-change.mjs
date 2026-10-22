import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { load } from "./lib/web-ui-harness.mjs";

const web = await import(load("src/modules/assistant/lib/movement-change.ts"));
const { parseAssistantReply } = await import(load("src/modules/assistant/lib/assistant-contract.ts"));
const text = await import(load("src/modules/assistant/lib/assistant-text.ts"));

// Funciones reales del checkout móvil (sin escribir en ese repositorio).
function extract(path, names) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8"), tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  return ts.transpileModule(tree.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text)).map(node => node.getText(tree).replace(/^export /, "")).join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
}
const phoneParse = new Function(`${extract("../../DarkMoneyApp/services/queries/assistant.ts", ["parseMovementChange"])};return parseMovementChange;`)();
const phoneLines = new Function(`${extract("../../DarkMoneyApp/features/assistant/lib/change-to-input.ts", ["movementChangeLines"])};return movementChangeLines;`)();
const phoneText = new Function(`${extract("../../DarkMoneyApp/lib/assistant-text.ts", ["parseBoldSegments", "textForClipboard"])};return { parseBoldSegments, textForClipboard };`)();

const base = { action: "update", movementId: 77, movementType: "expense", currency: "PEN", before: { amount: 20, description: "Taxi", categoryName: "Transporte", accountName: "BCP", counterpartyName: null, date: "2026-10-20" } };
const raws = [
  { ...base, after: { amount: 25 } },
  { ...base, after: { amount: "25", description: "Taxi aeropuerto", notes: "con peaje", categoryId: 4, categoryName: "Viajes", accountId: 2, accountName: "Interbank", counterpartyId: 9, counterpartyName: "Uber", date: "2026-10-19", occurredAt: "2026-10-19T17:00:00.000Z" } },
  { ...base, movementType: "income", after: { amount: 300 } },
  { ...base, action: "delete", after: {} },
  { ...base, after: {} },
  { ...base, after: { categoryId: 4 } },
  { ...base, after: { date: "2026-10-19" } },
  { ...base, action: "edit", after: { amount: 5 } },
  { ...base, movementType: "transfer", after: { amount: 5 } },
  { ...base, movementId: 0, after: { amount: 5 } },
  null, "x", [],
];
const money = amount => `S/ ${amount.toFixed(2)}`;
for (const raw of raws) {
  const mine = web.parseMovementChange(raw), theirs = phoneParse(raw);
  assert.deepEqual(mine, theirs, JSON.stringify(raw));
  if (mine) assert.deepEqual(web.movementChangeLines(mine, money), phoneLines(theirs, money));
}
for (const sample of ["**S/ 25** en total", "sin negritas", "**a** y **b**", "* suelto"]) {
  assert.deepEqual(text.parseBoldSegments(sample), phoneText.parseBoldSegments(sample));
  assert.equal(text.textForClipboard(sample), phoneText.textForClipboard(sample));
}

// Contrato: cada cambio es una tarjeta; las sugerencias llegan como máximo tres.
const reply = parseAssistantReply({ ok: true, reply: "Listo", movementChanges: [raws[0], raws[3], raws[4]], suggestions: ["¿Y este mes?", "", 3, "b", "c", "d"] });
assert.equal(reply.proposals.length, 2);
assert.equal(reply.proposals[0].movementChange.after.amount, 25);
assert.match(reply.proposals[1].label, /^Borrar gasto #77/);
assert.deepEqual(reply.suggestions, ["¿Y este mes?", "b", "c"]);

// Escritura: relee la fila, exige el mismo "antes", escribe solo lo que cambia y verifica la respuesta.
function fakeClient(row, behavior = {}) {
  const calls = [];
  const client = {
    calls,
    from(table) {
      const call = { table, filters: [], op: "select" }; calls.push(call);
      const chain = {
        select() { return chain; }, update(patch) { call.op = "update"; call.patch = patch; return chain; }, delete() { call.op = "delete"; return chain; },
        eq(column, value) { call.filters.push(["eq", column, value]); return chain; }, is(column, value) { call.filters.push(["is", column, value]); return chain; },
        async maybeSingle() {
          if (call.op === "select") return { data: row, error: null };
          if (behavior.updateError) return { data: null, error: behavior.updateError };
          return { data: behavior.updateReply ?? { id: row.id, workspace_id: row.workspace_id, ...call.patch }, error: null };
        },
        then(resolve) { return Promise.resolve(behavior.deleteReply ?? { data: [{ id: row.id }], error: null }).then(resolve); },
      };
      return chain;
    },
  };
  return client;
}
const row = { id: 77, workspace_id: 8, movement_type: "expense", status: "posted", source_account_id: 1, source_amount: "20.00", destination_account_id: null, destination_amount: null, obligation_id: null, subscription_id: null, metadata: {} };
const update = web.parseMovementChange(raws[1]);
{
  const client = fakeClient(row);
  await web.applyMovementChange(client, update, 8, () => true);
  const write = client.calls[1];
  assert.equal(write.op, "update");
  assert.deepEqual(write.patch, { source_amount: 25, source_account_id: 2, description: "Taxi aeropuerto", notes: "con peaje", category_id: 4, counterparty_id: 9, occurred_at: "2026-10-19T17:00:00.000Z" });
  assert.ok(write.filters.some(([op, column, value]) => op === "eq" && column === "source_amount" && value === "20.00"));
  assert.ok(write.filters.some(([op, column]) => op === "is" && column === "obligation_id"));
}
{
  const income = web.parseMovementChange(raws[2]);
  const client = fakeClient({ ...row, movement_type: "income", source_amount: null, source_account_id: null, destination_account_id: 3, destination_amount: 20 });
  await web.applyMovementChange(client, income, 8, () => true);
  assert.deepEqual(client.calls[1].patch, { destination_amount: 300 });
}
for (const [patch, pattern] of [[{ amount: undefined, source_amount: "21.00" }, /cambió desde la propuesta/], [{ obligation_id: 4 }, /deuda/], [{ subscription_id: 2 }, /suscripción/], [{ status: "voided" }, /anulado/], [{ metadata: { obligation_event_id: 1 } }, /pago de deuda/], [{ movement_type: "transfer" }, /gastos e ingresos/], [{ workspace_id: 9 }, /ya no está/]]) {
  const client = fakeClient({ ...row, ...patch });
  await assert.rejects(web.applyMovementChange(client, update, 8, () => true), error => pattern.test(error.message) && error.definite === true);
  assert.equal(client.calls.length, 1, "no write after a failed preflight");
}
{
  const client = fakeClient(row);
  await assert.rejects(web.applyMovementChange(client, update, 8, () => false), /contexto cambió/);
  assert.equal(client.calls.length, 1);
}
{
  const client = fakeClient(row, { updateReply: { id: 77, workspace_id: 8, source_amount: 24 } });
  await assert.rejects(web.applyMovementChange(client, update, 8, () => true), error => /No se confirmó la corrección/.test(error.message) && !error.definite);
}
{
  const remove = web.parseMovementChange(raws[3]);
  const client = fakeClient(row);
  assert.deepEqual(await web.applyMovementChange(client, remove, 8, () => true), { movementId: 77, action: "delete" });
  assert.equal(client.calls[1].op, "delete");
  const empty = fakeClient(row, { deleteReply: { data: [], error: null } });
  await assert.rejects(web.applyMovementChange(empty, remove, 8, () => true), /No se confirmó el borrado/);
}
console.log("assistant-movement-change: OK (actual mobile parser/lines/text helpers, contract cards and suggestions, scoped preflight, same-before CAS, changed columns only, verified update/delete, uncertain replies; fake transport)");
