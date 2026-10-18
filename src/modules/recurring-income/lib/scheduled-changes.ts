import { IncomeWritePreflightError } from "./income-write-result";

export type IncomeScheduledChange = { effectiveDate: string; amount: number };
export type IncomeScheduledChangeDraft = { key: string; date: string; amount: string };

const validDay = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
const validMoney = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value > 0 &&
  Number.isSafeInteger(Math.round(value * 100)) && Math.abs(value * 100 - Math.round(value * 100)) <= 1e-6;
const invalid = () => new IncomeWritePreflightError("Revisa los cambios de monto: cada fila necesita una fecha real y un neto positivo con máximo dos decimales. Completa o quita las filas pendientes.");

/** Native rule: chronological order, one amount per date; the last entered wins. Never discard a financial row silently. */
export function normalizeIncomeScheduledChanges(changes: readonly IncomeScheduledChange[] | null | undefined): IncomeScheduledChange[] {
  if (changes == null) return [];
  if (!Array.isArray(changes)) throw invalid();
  const byDate = new Map<string, IncomeScheduledChange>();
  for (const change of changes) {
    if (!change || !validDay(change.effectiveDate) || !validMoney(change.amount)) throw invalid();
    byDate.set(change.effectiveDate, { effectiveDate: change.effectiveDate, amount: change.amount });
  }
  return [...byDate.values()].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
}

/** Database JSONB, not user-entered grouping. Malformed data blocks editing/projection instead of being overwritten as []. */
export function readIncomeScheduledChanges(raw: unknown): IncomeScheduledChange[] {
  if (raw === null) return [];
  if (!Array.isArray(raw)) throw invalid();
  return normalizeIncomeScheduledChanges(raw.map(row => {
    if (!row || typeof row !== "object" || Array.isArray(row)) throw invalid();
    const amount = row.amount;
    if (!["number", "string"].includes(typeof amount) || (typeof amount === "string" && !/^\d+(?:\.\d+)?$/.test(amount))) throw invalid();
    return { effectiveDate: row.effective_date, amount: Number(amount) };
  }));
}

export function incomeScheduledChangeRows(changes: readonly IncomeScheduledChange[] | null | undefined) {
  return normalizeIncomeScheduledChanges(changes).map(change => ({ effective_date: change.effectiveDate, amount: change.amount }));
}

export function incomeScheduledChangeDrafts(changes: readonly IncomeScheduledChange[] | null | undefined): IncomeScheduledChangeDraft[] {
  return normalizeIncomeScheduledChanges(changes).map((change, index) => ({ key: `sc-${index}`, date: change.effectiveDate, amount: String(change.amount) }));
}

/** Matches native form grouping: 1,200.50 / 1.200,50 / 1200,50; letters and invalid grouping never disappear. */
export function parseScheduledAmountInput(raw: string): number | null {
  if (typeof raw !== "string" || !/^[\d.,\s]+$/.test(raw.trim())) return null;
  const value = raw.replace(/\s/g, "");
  if (!/\d/.test(value)) return null;
  const dot = value.lastIndexOf("."), comma = value.lastIndexOf(",");
  let normalized = value;
  if (dot >= 0 && comma >= 0) {
    const decimal = dot > comma ? "." : ",", thousands = decimal === "." ? "," : ".";
    const index = value.lastIndexOf(decimal), groups = value.slice(0, index).split(thousands), fraction = value.slice(index + 1);
    if (!/^\d{1,2}$/.test(fraction) || !/^\d{1,3}$/.test(groups[0]) || groups.slice(1).some(group => !/^\d{3}$/.test(group))) return null;
    normalized = `${groups.join("")}.${fraction}`;
  } else if (dot >= 0 || comma >= 0) {
    const groups = value.split(dot >= 0 ? "." : ",");
    if (groups.length > 2 || (groups[1].length === 3 && groups[0].length >= 1 && groups[0].length <= 3)) {
      if (!/^\d{1,3}$/.test(groups[0]) || groups.slice(1).some(group => !/^\d{3}$/.test(group))) return null;
      normalized = groups.join("");
    } else normalized = groups.join(".");
  }
  const amount = Number(normalized);
  return validMoney(amount) ? amount : null;
}

export function collectIncomeScheduledChanges(drafts: readonly IncomeScheduledChangeDraft[] | undefined): IncomeScheduledChange[] {
  if (drafts === undefined) return [];
  if (!Array.isArray(drafts)) throw invalid();
  return normalizeIncomeScheduledChanges(drafts.map(row => {
    if (!row || typeof row.date !== "string" || typeof row.amount !== "string") throw invalid();
    const amount = parseScheduledAmountInput(row.amount);
    if (amount === null) throw invalid();
    return { effectiveDate: row.date.trim(), amount };
  }));
}
