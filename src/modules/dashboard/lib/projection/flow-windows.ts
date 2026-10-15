import { addDays, parseISO } from "date-fns";
import type { ProjectedMonth, ProjectionLine } from "./cashflow-calendar";

export type ProjectionFlowItem = {
  source: "obligation" | "subscription" | "recurring-income" | "card" | "planned";
  id: number; title: string; date: Date; direction: "inflow" | "outflow"; amount: number | null;
};
function sourceOf(kind: ProjectionLine["kind"]): ProjectionFlowItem["source"] {
  switch (kind) {
    case "subscription": return "subscription";
    case "recurring_income": return "recurring-income";
    case "credit_card_payment": return "card";
    case "planned_movement": return "planned";
    default: return "obligation";
  }
}

/** Counterpart of mobile projectionFlowItems: dated commitments, not typical daily spend. */
export function projectionFlowItems(months: readonly ProjectedMonth[], fallbackDate: Date): ProjectionFlowItem[] {
  const items: ProjectionFlowItem[] = [];
  for (const month of months) {
    const push = (line: ProjectionLine, direction: "inflow" | "outflow") => {
      if (line.kind === "typical_spend") return;
      items.push({ source: sourceOf(line.kind), id: line.refId ?? 0, title: line.label,
        date: line.dueDate ? parseISO(line.dueDate) : fallbackDate, direction, amount: line.amount });
    };
    month.inflows.forEach(line => push(line, "inflow"));
    month.outflows.forEach(line => push(line, "outflow"));
  }
  return items.sort((a, b) => a.date.getTime() - b.date.getTime() || a.title.localeCompare(b.title));
}

/** Overdue installments remain due and enter all windows, exactly as in mobile. */
export function windowsFromFlowItems(items: readonly ProjectionFlowItem[], currentVisibleBalance: number, now = new Date()) {
  return [7, 15, 30].map(days => {
    const windowItems = items.filter(item => item.date <= addDays(now, days));
    const expectedInflow = windowItems.filter(item => item.direction === "inflow").reduce((sum, item) => sum + (item.amount ?? 0), 0);
    const expectedOutflow = windowItems.filter(item => item.direction === "outflow").reduce((sum, item) => sum + (item.amount ?? 0), 0);
    return {
      days, expectedInflow, expectedOutflow, estimatedBalance: currentVisibleBalance + expectedInflow - expectedOutflow,
      receivableCount: windowItems.filter(item => item.source === "obligation" && item.direction === "inflow").length,
      payableCount: windowItems.filter(item => item.source === "obligation" && item.direction === "outflow").length,
      scheduledCount: windowItems.length, unconvertedCount: windowItems.filter(item => item.amount === null).length,
    };
  });
}
