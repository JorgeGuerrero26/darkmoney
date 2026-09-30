import type { MovementType } from "../../../types/domain";

/** The same fallback used by the mobile movement form. */
export function buildMovementDescription(input: {
  description: string;
  movementType: MovementType;
  categoryName?: string | null;
  counterpartyName?: string | null;
  accountName?: string | null;
}) {
  const description = input.description.trim();
  if (description) return description;
  const parts = [input.categoryName, input.counterpartyName, input.accountName].filter(Boolean);
  if (parts.length > 0) return parts.join(" · ");
  const labels: Record<MovementType, string> = {
    expense: "Gasto",
    income: "Ingreso",
    transfer: "Transferencia",
    obligation_opening: "Apertura de obligación",
    obligation_payment: "Pago de obligación",
    subscription_payment: "Pago de suscripción",
    refund: "Reembolso",
    adjustment: "Ajuste",
  };
  return labels[input.movementType];
}
