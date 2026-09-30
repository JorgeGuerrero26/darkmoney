import type { AccountSummary } from "../../../types/domain";
import { findAccountInstitution } from "./account-institutions";

export function describeAccountCycle(account: AccountSummary) {
  if (account.type !== "credit_card") return null;
  if (account.statementDay != null && account.paymentDay != null) return `Corte ${account.statementDay} · pagas ${account.paymentDay}`;
  if (account.paymentDay != null) return `Pagas el ${account.paymentDay}`;
  return account.statementDay == null ? null : `Corte ${account.statementDay}`;
}

function escapeCsv(value: string | number | boolean | null | undefined): string {
  const rawValue = value ?? "";
  const stringValue = String(rawValue);
  return /[",\n\r;]/.test(stringValue) ? `"${stringValue.replace(/"/g, '""')}"` : stringValue;
}

export function buildAccountsCsv(accounts: AccountSummary[]) {
  const header = [
    "Nombre",
    "Tipo",
    "Institución",
    "Moneda",
    "Saldo inicial",
    "Saldo actual",
    "Incluida en patrimonio",
    "Archivada",
    "Ultima actividad",
    "Día de corte",
    "Día de pago",
    "Límite de crédito",
  ];
  const rows = accounts.map((account) => [
    account.name,
    account.type,
    findAccountInstitution(account.institutionCode)?.label ?? "",
    account.currencyCode,
    account.openingBalance,
    account.currentBalance,
    account.includeInNetWorth ? "Si" : "No",
    account.isArchived ? "Si" : "No",
    account.lastActivity,
    account.statementDay,
    account.paymentDay,
    account.creditLimit,
  ]);

  return [header, ...rows].map((row) => row.map(escapeCsv).join(";")).join("\n");
}

export function downloadAccountsCSV(accounts: AccountSummary[], filename: string) {
  const blob = new Blob([buildAccountsCsv(accounts)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function getAccountStatusLabel(account: AccountSummary) {
  if (account.isArchived) {
    return "Archivada";
  }

  return account.includeInNetWorth ? "Incluida" : "Fuera de patrimonio";
}
