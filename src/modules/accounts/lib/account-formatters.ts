import type { AccountSummary } from "../../../types/domain";

function escapeCsv(value: string | number | boolean | null | undefined): string {
  const rawValue = value ?? "";
  const stringValue = String(rawValue);
  return /[",\n\r;]/.test(stringValue) ? `"${stringValue.replace(/"/g, '""')}"` : stringValue;
}

export function buildAccountsCsv(accounts: AccountSummary[]) {
  const header = [
    "Nombre",
    "Tipo",
    "Moneda",
    "Saldo inicial",
    "Saldo actual",
    "Incluida en patrimonio",
    "Archivada",
    "Ultima actividad",
  ];
  const rows = accounts.map((account) => [
    account.name,
    account.type,
    account.currencyCode,
    account.openingBalance,
    account.currentBalance,
    account.includeInNetWorth ? "Si" : "No",
    account.isArchived ? "Si" : "No",
    account.lastActivity,
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
