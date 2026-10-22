/**
 * Corrección o borrado de un gasto/ingreso ya registrado que propone el Asistente (contrato
 * `movementChanges` de assistant-chat, igual que móvil). El servidor ya validó el movimiento y
 * resolvió nombres a ids; aquí se muestra el antes y el después, y solo se aplica si la persona
 * confirma. Antes de escribir se vuelve a leer la fila y se exige que siga como el servidor la vio.
 */
export type AssistantMovementChange = {
  action: "update" | "delete";
  movementId: number;
  movementType: "expense" | "income";
  currency: string;
  before: { amount: number; description: string | null; categoryName: string | null; accountName: string | null; counterpartyName: string | null; date: string };
  after: {
    amount?: number; description?: string; notes?: string;
    categoryId?: number; categoryName?: string;
    accountId?: number; accountName?: string;
    counterpartyId?: number; counterpartyName?: string;
    date?: string; occurredAt?: string;
  };
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const str = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
const pos = (value: unknown) => (typeof value === "number" || typeof value === "string") && Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : undefined;
const id = (value: unknown) => { const n = pos(value); return n !== undefined && Number.isSafeInteger(n) ? n : undefined; };

/** Misma lectura que parseMovementChange móvil: un cambio sin campos válidos no se ofrece. */
export function parseMovementChange(raw: unknown): AssistantMovementChange | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const d = raw as Record<string, unknown>;
  const movementId = Number(d.movementId);
  if (d.action !== "update" && d.action !== "delete") return null;
  if (d.movementType !== "expense" && d.movementType !== "income") return null;
  if (!Number.isSafeInteger(movementId) || movementId <= 0) return null;
  const before = (d.before && typeof d.before === "object" ? d.before : {}) as Record<string, unknown>;
  const after = (d.after && typeof d.after === "object" ? d.after : {}) as Record<string, unknown>;
  const parsed: AssistantMovementChange["after"] = {};
  if (pos(after.amount) !== undefined) parsed.amount = pos(after.amount);
  if (str(after.description)) parsed.description = str(after.description)!;
  if (str(after.notes)) parsed.notes = str(after.notes)!;
  if (id(after.categoryId) !== undefined && str(after.categoryName)) { parsed.categoryId = id(after.categoryId); parsed.categoryName = str(after.categoryName)!; }
  if (id(after.accountId) !== undefined && str(after.accountName)) { parsed.accountId = id(after.accountId); parsed.accountName = str(after.accountName)!; }
  if (id(after.counterpartyId) !== undefined && str(after.counterpartyName)) { parsed.counterpartyId = id(after.counterpartyId); parsed.counterpartyName = str(after.counterpartyName)!; }
  if (typeof after.date === "string" && DATE_RE.test(after.date) && str(after.occurredAt) && Number.isFinite(Date.parse(str(after.occurredAt)!))) { parsed.date = after.date; parsed.occurredAt = str(after.occurredAt)!; }
  if (d.action === "update" && Object.keys(parsed).length === 0) return null;
  const currency = str(d.currency)?.toUpperCase();
  return {
    action: d.action,
    movementId,
    movementType: d.movementType,
    currency: currency && /^[A-Z]{3}$/.test(currency) ? currency : "PEN",
    before: {
      amount: Number(before.amount) || 0,
      description: str(before.description),
      categoryName: str(before.categoryName),
      accountName: str(before.accountName),
      counterpartyName: str(before.counterpartyName),
      date: typeof before.date === "string" ? before.date : "",
    },
    after: parsed,
  };
}

/** Filas de la tarjeta: al corregir, "antes → ahora"; al borrar, lo que identifica al movimiento. */
export function movementChangeLines(change: AssistantMovementChange, money: (amount: number) => string) {
  const { before, after } = change;
  const or = (value: string | null) => value ?? "—";
  if (change.action === "delete") {
    const lines = [{ label: "Fecha", value: before.date }];
    if (before.description) lines.push({ label: "Detalle", value: before.description });
    if (before.categoryName) lines.push({ label: "Categoría", value: before.categoryName });
    if (before.accountName) lines.push({ label: "Cuenta", value: before.accountName });
    return lines;
  }
  const lines: Array<{ label: string; value: string }> = [];
  if (after.amount !== undefined) lines.push({ label: "Monto", value: `${money(before.amount)} → ${money(after.amount)}` });
  if (after.description !== undefined) lines.push({ label: "Detalle", value: `${or(before.description)} → ${after.description}` });
  if (after.categoryName !== undefined) lines.push({ label: "Categoría", value: `${or(before.categoryName)} → ${after.categoryName}` });
  if (after.accountName !== undefined) lines.push({ label: "Cuenta", value: `${or(before.accountName)} → ${after.accountName}` });
  if (after.counterpartyName !== undefined) lines.push({ label: "Contacto", value: `${or(before.counterpartyName)} → ${after.counterpartyName}` });
  if (after.date !== undefined) lines.push({ label: "Fecha", value: `${before.date} → ${after.date}` });
  if (after.notes !== undefined) lines.push({ label: "Nota", value: after.notes });
  if (after.description === undefined && before.description) lines.push({ label: "Movimiento", value: before.description });
  if (after.date === undefined) lines.push({ label: "Del", value: before.date });
  return lines;
}

type MovementRow = {
  id: number; workspace_id: number; movement_type: string; status: string;
  source_account_id: number | null; source_amount: number | string | null;
  destination_account_id: number | null; destination_amount: number | string | null;
  obligation_id: number | null; subscription_id: number | null; metadata: unknown;
};

/** Mismas exclusiones que el servidor (movementChangeBlockReason): solo gastos e ingresos sueltos. */
export function movementChangeBlockReason(row: Pick<MovementRow, "movement_type" | "status" | "obligation_id" | "subscription_id" | "metadata">): string | null {
  if (row.status === "voided") return "Ese movimiento está anulado.";
  if (row.obligation_id != null) return "Ese movimiento está ligado a una deuda o crédito: corrígelo desde Movimientos o la deuda.";
  if (row.subscription_id != null) return "Ese movimiento es el pago de una suscripción: corrígelo desde Movimientos.";
  const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata as Record<string, unknown> : {};
  if (metadata.obligation_event_id != null) return "Ese movimiento está ligado a un pago de deuda: corrígelo desde Movimientos.";
  if (row.movement_type !== "expense" && row.movement_type !== "income") return "Solo se corrigen o borran gastos e ingresos sueltos desde el Asistente.";
  return null;
}

/** Columnas que cambian: el monto y la cuenta van del lado del dinero (origen en gastos, destino en ingresos). */
export function movementChangePatch(change: AssistantMovementChange): Record<string, unknown> {
  const side = change.movementType === "expense" ? "source" : "destination";
  const patch: Record<string, unknown> = {};
  if (change.after.amount !== undefined) patch[`${side}_amount`] = change.after.amount;
  if (change.after.accountId !== undefined) patch[`${side}_account_id`] = change.after.accountId;
  if (change.after.description !== undefined) patch.description = change.after.description;
  if (change.after.notes !== undefined) patch.notes = change.after.notes;
  if (change.after.categoryId !== undefined) patch.category_id = change.after.categoryId;
  if (change.after.counterpartyId !== undefined) patch.counterparty_id = change.after.counterpartyId;
  if (change.after.occurredAt !== undefined) patch.occurred_at = change.after.occurredAt;
  return patch;
}

type Client = { from: (table: string) => any };

/**
 * Aplica el cambio confirmado con escrituras condicionadas y comprobadas. No reintenta: si la
 * respuesta no confirma la fila, el resultado queda "por comprobar" y no se vuelve a enviar.
 */
export async function applyMovementChange(client: Client, change: AssistantMovementChange, workspaceId: number, isCurrent: () => boolean) {
  const { data: row, error: readError } = await client.from("movements")
    .select("id, workspace_id, movement_type, status, source_account_id, source_amount, destination_account_id, destination_amount, obligation_id, subscription_id, metadata")
    .eq("id", change.movementId).eq("workspace_id", workspaceId).maybeSingle();
  if (readError) throw readError;
  const current = row as MovementRow | null;
  if (!current || current.id !== change.movementId || current.workspace_id !== workspaceId) throw Object.assign(new Error("Ese movimiento ya no está en este espacio. No se cambió nada."), { definite: true });
  const blocked = movementChangeBlockReason(current);
  if (blocked) throw Object.assign(new Error(`${blocked} No se cambió nada.`), { definite: true });
  if (current.movement_type !== change.movementType) throw Object.assign(new Error("El movimiento cambió de tipo desde la propuesta. No se cambió nada."), { definite: true });
  const side = change.movementType === "expense" ? "source" : "destination";
  const amountNow = Number(current[`${side}_amount`]);
  // La propuesta mostró un "antes": si el monto ya no coincide, alguien lo cambió y no se pisa.
  if (Math.round(amountNow * 100) !== Math.round(change.before.amount * 100)) throw Object.assign(new Error("El movimiento cambió desde la propuesta. Pide al Asistente que lo revise de nuevo; no se cambió nada."), { definite: true });
  if (!isCurrent()) throw Object.assign(new Error("El contexto cambió antes de aplicar. No se cambió nada."), { definite: true });

  if (change.action === "delete") {
    const { data, error } = await client.from("movements").delete()
      .eq("id", change.movementId).eq("workspace_id", workspaceId).eq("movement_type", change.movementType)
      .eq(`${side}_amount`, current[`${side}_amount`]).is("obligation_id", null).is("subscription_id", null)
      .select("id");
    if (error) throw error;
    if (!Array.isArray(data) || data.length !== 1 || data[0]?.id !== change.movementId) throw new Error("No se confirmó el borrado. Revisa Movimientos antes de repetirlo.");
    return { movementId: change.movementId, action: "delete" as const };
  }

  const patch = movementChangePatch(change);
  const { data, error } = await client.from("movements").update(patch)
    .eq("id", change.movementId).eq("workspace_id", workspaceId).eq("movement_type", change.movementType)
    .eq(`${side}_amount`, current[`${side}_amount`]).is("obligation_id", null).is("subscription_id", null)
    .select(`id, workspace_id, ${Object.keys(patch).join(", ")}`).maybeSingle();
  if (error) throw error;
  const saved = data as Record<string, unknown> | null;
  const same = (key: string, value: unknown) => key === "occurred_at" ? Date.parse(String(saved?.[key])) === Date.parse(String(value)) : key.endsWith("_amount") ? Math.round(Number(saved?.[key]) * 100) === Math.round(Number(value) * 100) : saved?.[key] === value;
  if (!saved || saved.id !== change.movementId || saved.workspace_id !== workspaceId || !Object.entries(patch).every(([key, value]) => same(key, value))) {
    throw new Error("No se confirmó la corrección. Revisa el movimiento antes de repetirla.");
  }
  return { movementId: change.movementId, action: "update" as const };
}
