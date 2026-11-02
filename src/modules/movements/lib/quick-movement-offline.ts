import type { MovementFormInput } from "../../../services/queries/workspace-data";
import type { QueuedMovementInput } from "../../../lib/offline/movement-queue";

type Input = MovementFormInput & { userId: string; workspaceId: number };
export type QuickMovementResult = { kind: "queued" } | { kind: "saved"; id: number };

/** Never invent a server ID for a locally queued movement. */
export async function persistQuickMovement(input: Input, options: {
  online: boolean; customSubmit: boolean; hasSplit: boolean; hasReceipt: boolean;
  save: (input: Input) => Promise<number>; enqueue?: (input: QueuedMovementInput) => Promise<unknown>;
}): Promise<QuickMovementResult> {
  if (options.online) return { kind: "saved", id: await options.save(input) };
  if (options.customSubmit) throw new Error("Esta revisión necesita conexión. No se guardó ningún cambio.");
  if (options.hasSplit || options.hasReceipt) throw new Error("Los movimientos divididos o con comprobante necesitan conexión. Tus cambios siguen aquí.");
  if (!options.enqueue || !input.dedupeKey) throw new Error("No se puede guardar sin conexión en este momento. Tus cambios siguen aquí.");
  await options.enqueue({ ...input, dedupeKey: input.dedupeKey });
  return { kind: "queued" };
}
