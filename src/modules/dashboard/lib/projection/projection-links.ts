import type { ProjectionLine } from "./cashflow-calendar";

/** Native destinations only. A calendar line never supplies an executable URL or confirms a payment. */
export function projectionLineHref(line: Pick<ProjectionLine, "kind" | "refId">) {
  if (!line.refId || !Number.isSafeInteger(line.refId) || line.refId <= 0 || line.kind === "typical_spend") return null;
  if (line.kind === "planned_movement") return `/app/movements?period=all&movement=${line.refId}`;
  const path = line.kind === "subscription" ? "subscriptions" : line.kind === "recurring_income" ? "recurring-income" : line.kind === "credit_card_payment" ? "accounts" : "obligations";
  return `/app/${path}?resource=${line.refId}`;
}
