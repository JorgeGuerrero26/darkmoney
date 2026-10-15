import type { MovementFormInput, WorkspaceSnapshot } from "../../../services/queries/workspace-data";
import { validateAssistantMovement } from "./movement-proposal";

type Input = MovementFormInput & { userId: string; workspaceId: number };
/** Stable per-turn identity. Uncertain retries cannot silently change the financial instruction. */
export function createAssistantMovementSaver(options: {
  userId: string; workspaceId: number; currency: string; intentKey: string;
  isCurrent: () => boolean; snapshot: () => WorkspaceSnapshot | null; insert: (input: Input) => Promise<number>;
}) {
  let fingerprint: string | null = null, attempted: Input | null = null, confirmed: { id: number; input: Input } | null = null, flight: Promise<number> | null = null;
  async function save(value: Input): Promise<number> {
    const snapshot = options.snapshot();
    if (!options.isCurrent() || !snapshot || value.workspaceId !== options.workspaceId) throw new Error("Espera la lectura del espacio actual antes de guardar.");
    validateAssistantMovement(value, snapshot, options.userId, options.currency);
    const metadata = value.metadata && typeof value.metadata === "object" && !Array.isArray(value.metadata) ? value.metadata : {};
    const key = JSON.stringify([value.movementType, value.status, value.occurredAt, value.description, value.notes ?? null,
      value.sourceAccountId, value.sourceAmount, value.destinationAccountId, value.destinationAmount,
      value.fxRate ?? null, value.categoryId ?? null, value.counterpartyId ?? null, value.spendTypeId ?? null,
      value.subscriptionId ?? null, value.obligationId ?? null, metadata.recurring_income_id ?? null]);
    if (fingerprint && fingerprint !== key) throw new Error("Hay un intento previo para este borrador. Confirma el mismo registro sin cambiar sus datos; no se envió otra operación.");
    if (confirmed) return confirmed.id;
    if (flight) return flight;
    fingerprint = key;
    const input: Input = { ...value, dedupeKey: options.intentKey, metadata: { ...metadata, source: "assistant_chat", assistant_intent_key: options.intentKey } };
    attempted = input;
    flight = Promise.resolve().then(async () => {
      let sent = false;
      try {
        if (!options.isCurrent()) throw new Error("El contexto cambió antes de enviar el registro.");
        sent = true;
        const id = await options.insert(input);
        if (!Number.isSafeInteger(id) || id <= 0) throw new Error("No pudimos confirmar el identificador del movimiento.");
        confirmed = { id, input }; return id;
      } catch (error) {
        // A definite SQL rejection did not insert. Network/unknown/duplicate outcomes keep identity.
        const code = error && typeof error === "object" && "code" in error ? String(error.code ?? "") : "";
        // Only explicit SQL data/constraint/permission rejections are safely editable.
        // AbortError.code and transport-specific codes do not prove the insert rolled back.
        const rejected = /^(22|23|42)[A-Z0-9]{3}$/.test(code) && code !== "23505";
        if (!sent || rejected) { fingerprint = null; attempted = null; }
        throw error;
      } finally { flight = null; }
    });
    return flight;
  }
  return { save, confirmed: () => confirmed, attempted: () => attempted };
}
