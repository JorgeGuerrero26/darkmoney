import type { MovementFormInput } from "../../services/queries/workspace-data";

export type QueuedMovementInput = MovementFormInput & { userId: string; workspaceId: number; dedupeKey: string };
export type QueuedMovement = {
  userId: string; workspaceId: number; dedupeKey: string; createdAt: string;
  state: "pending" | "needs_review"; revision: number; error: string | null; input: QueuedMovementInput;
};

/** Only independent, idempotent manual movements may enter this first queue. */
export function validateQueuedMovement(input: QueuedMovementInput) {
  if (!input.userId || !Number.isSafeInteger(input.workspaceId) || input.workspaceId <= 0 ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.dedupeKey))
    throw new Error("No se puede conservar el movimiento sin una identidad y una clave únicas válidas.");
  if (!["income", "expense", "transfer"].includes(input.movementType) || !["posted", "planned"].includes(input.status) ||
      !input.description.trim() || !Number.isFinite(Date.parse(input.occurredAt)))
    throw new Error("Revisa el tipo, la descripción y la fecha del movimiento.");
  const positive = (value: number | null) => value !== null && Number.isFinite(value) && value > 0;
  const validId = (value: number | null) => value !== null && Number.isSafeInteger(value) && value > 0;
  if (input.movementType !== "income" && (!validId(input.sourceAccountId) || !positive(input.sourceAmount)) ||
      input.movementType !== "expense" && (!validId(input.destinationAccountId) || !positive(input.destinationAmount)))
    throw new Error("Revisa la cuenta y el importe antes de guardar sin conexión.");
  if (input.movementType === "transfer" && input.sourceAccountId === input.destinationAccountId)
    throw new Error("El origen y destino deben ser diferentes.");
  if (input.obligationId || input.subscriptionId) throw new Error("Este movimiento vinculado necesita conexión.");
  const meta = input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata) ? input.metadata : {};
  if ("suggestionId" in meta || "detectedSplitRequest" in meta || "split_group" in meta || meta.source === "notification_detection" || "recurring_income_id" in meta && meta.recurring_income_id != null)
    throw new Error("Las detecciones, divisiones y movimientos vinculados necesitan conexión.");
}

const DB_NAME = "darkmoney-pending-writes";
const STORE = "movements";
let databasePromise: Promise<IDBDatabase> | undefined;
function openQueue(): Promise<IDBDatabase> {
  if (!databasePromise) databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("El navegador no permite guardar cambios sin conexión.")); return; }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => { const store = request.result.createObjectStore(STORE, { keyPath: ["userId", "workspaceId", "dedupeKey"] }); store.createIndex("scope", ["userId", "workspaceId"]); };
    request.onerror = () => reject(request.error ?? new Error("No se pudo abrir la cola sin conexión."));
    request.onblocked = () => reject(new Error("Cierra las otras pestañas de DarkMoney y vuelve a intentarlo."));
    request.onsuccess = () => { const db = request.result; db.onversionchange = () => { db.close(); databasePromise = undefined; }; resolve(db); };
  }).catch(error => { databasePromise = undefined; throw error; });
  return databasePromise;
}
function transact<T>(db: IDBDatabase, mode: IDBTransactionMode, run: (store: IDBObjectStore, set: (value: T) => void, fail: (error: Error) => void) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode); let value: T; let failure: Error | undefined;
    transaction.oncomplete = () => resolve(value);
    transaction.onabort = transaction.onerror = () => reject(failure ?? transaction.error ?? new Error("No se pudo completar la operación local."));
    try { run(transaction.objectStore(STORE), result => { value = result; }, error => { failure = error; transaction.abort(); }); }
    catch (error) { failure = error instanceof Error ? error : new Error("No se pudo completar la operación local."); transaction.abort(); }
  });
}

export async function enqueueMovement(input: QueuedMovementInput): Promise<QueuedMovement> {
  const captured = structuredClone(input);
  validateQueuedMovement(captured); const db = await openQueue();
  const row: QueuedMovement = { userId: captured.userId, workspaceId: captured.workspaceId, dedupeKey: captured.dedupeKey, createdAt: new Date().toISOString(), state: "pending", revision: 1, error: null, input: captured };
  return transact(db, "readwrite", (store, set, fail) => {
    const request = store.get([captured.userId, captured.workspaceId, captured.dedupeKey]);
    request.onsuccess = () => {
      const existing = request.result as QueuedMovement | undefined;
      if (existing) { if (JSON.stringify(existing.input) !== JSON.stringify(captured)) fail(new Error("La clave ya pertenece a otro movimiento. Revisa antes de volver a intentar.")); else set(existing); return; }
      store.add(row); set(row);
    };
  });
}
export async function listQueuedMovements(userId: string, workspaceId: number): Promise<QueuedMovement[]> {
  const db = await openQueue(); return transact(db, "readonly", (store, set) => {
    const request = store.index("scope").getAll(IDBKeyRange.only([userId, workspaceId]));
    request.onsuccess = () => set((request.result as QueuedMovement[]).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.dedupeKey.localeCompare(b.dedupeKey)));
  });
}
/** The revision check prevents acknowledging a row changed while a request was in flight. */
export async function acknowledgeQueuedMovement(row: QueuedMovement): Promise<boolean> {
  const db = await openQueue(); return transact(db, "readwrite", (store, set) => {
    const key: IDBValidKey = [row.userId, row.workspaceId, row.dedupeKey], request = store.get(key);
    request.onsuccess = () => { const current = request.result as QueuedMovement | undefined; if (!current || current.revision !== row.revision || current.state !== "pending") { set(false); return; } store.delete(key); set(true); };
  });
}
export async function markQueuedMovementForReview(row: QueuedMovement, message: string): Promise<boolean> {
  const db = await openQueue(); return transact(db, "readwrite", (store, set) => {
    const request = store.get([row.userId, row.workspaceId, row.dedupeKey]);
    request.onsuccess = () => { const current = request.result as QueuedMovement | undefined; if (!current || current.revision !== row.revision || current.state !== "pending") { set(false); return; } store.put({ ...current, state: "needs_review", revision: current.revision + 1, error: message.slice(0, 300) }); set(true); };
  });
}

/** A review can only be requeued explicitly and with the revision the user saw. */
export async function retryReviewedMovement(row: QueuedMovement): Promise<boolean> {
  const db = await openQueue(); return transact(db, "readwrite", (store, set) => {
    const request = store.get([row.userId, row.workspaceId, row.dedupeKey]);
    request.onsuccess = () => {
      const current = request.result as QueuedMovement | undefined;
      if (!current || current.revision !== row.revision || current.state !== "needs_review") { set(false); return; }
      store.put({ ...current, state: "pending", revision: current.revision + 1, error: null }); set(true);
    };
  });
}
