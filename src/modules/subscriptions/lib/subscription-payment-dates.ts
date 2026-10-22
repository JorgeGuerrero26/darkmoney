type Occurrence = { dueDate: string; status: string };

/**
 * Qué cobro se paga: el más antiguo que sigue sin pagar, igual que móvil (oldestUnpaidDueDate).
 * Nunca propone una fecha posterior a la guardada; sin historial usa la fecha guardada.
 */
export function oldestUnpaidDueDate(nextDueDate: string, occurrences: readonly Occurrence[] | null | undefined): string {
  const pending = (occurrences ?? []).filter((occurrence) => occurrence.status === "scheduled").map((occurrence) => occurrence.dueDate).sort();
  const oldest = pending[0];
  return oldest && oldest < nextDueDate ? oldest : nextDueDate;
}

/** Fecha del movimiento: la del cobro si aún no vence; hoy si ya venció (cuándo salió el dinero). */
export function defaultPaymentDate(dueDate: string, today: string): string {
  return dueDate < today ? today : dueDate;
}
