import type { AccountFormInput } from "../../../services/queries/workspace-data";
import type { AccountSummary } from "../../../types/domain";
import {
  buildCurrencyLabel,
  getTypePreset,
  isKnownAccountColor,
  isKnownAccountIcon,
  isKnownAccountType,
} from "./account-options";

export type AccountFormState = {
  name: string;
  type: string;
  currencyCode: string;
  openingBalance: string;
  includeInNetWorth: boolean;
  color: string;
  icon: string;
  institutionCode: string;
  statementDay: string;
  paymentDay: string;
  creditLimit: string;
  notes: string;
};

export type AccountFormField = keyof AccountFormState;

export type AccountFormErrors = Partial<Record<AccountFormField, string>>;

export function createDefaultFormState(currencyCode: string): AccountFormState {
  const preset = getTypePreset("cash");

  return {
    name: "",
    type: preset.value,
    currencyCode,
    openingBalance: "0",
    includeInNetWorth: true,
    color: preset.color,
    icon: preset.icon,
    institutionCode: "",
    statementDay: "",
    paymentDay: "",
    creditLimit: "",
    notes: "",
  };
}

export function buildFormStateFromAccount(account: AccountSummary): AccountFormState {
  return {
    name: account.name,
    type: account.type === "loan_wallet" ? "loan" : account.type,
    currencyCode: account.currencyCode,
    openingBalance: String(account.openingBalance),
    includeInNetWorth: account.includeInNetWorth,
    color: account.color,
    icon: account.icon || getTypePreset(account.type).icon,
    institutionCode: account.institutionCode ?? "",
    statementDay: account.statementDay == null ? "" : String(account.statementDay),
    paymentDay: account.paymentDay == null ? "" : String(account.paymentDay),
    creditLimit: account.creditLimit == null ? "" : String(account.creditLimit),
    notes: account.notes ?? "",
  };
}

export function validateAccountForm(formState: AccountFormState): AccountFormErrors {
  const errors: AccountFormErrors = {};
  const openingBalance = Number(formState.openingBalance);
  const normalizedCurrency = formState.currencyCode.trim().toUpperCase();
  if (formState.type === "credit_card") {
    for (const field of ["statementDay", "paymentDay"] as const) {
      const text = formState[field].trim();
      const day = Number(text);
      if (text && (!Number.isInteger(day) || day < 1 || day > 31)) errors[field] = "Elige un día del 1 al 31.";
    }
    if (formState.creditLimit.trim() && (!Number.isFinite(Number(formState.creditLimit)) || Number(formState.creditLimit) <= 0)) errors.creditLimit = "El límite debe ser mayor que cero.";
  }

  if (!formState.name.trim()) {
    errors.name = "Ingresa un nombre para la cuenta.";
  }

  if (!isKnownAccountType(formState.type)) {
    errors.type = "Selecciona un tipo de cuenta valido.";
  }

  if (!/^[A-Z]{3}$/.test(normalizedCurrency) || !buildCurrencyLabel(normalizedCurrency)) {
    errors.currencyCode = "Selecciona una moneda valida.";
  }

  if (!Number.isFinite(openingBalance)) {
    errors.openingBalance = "El saldo inicial debe ser un numero valido.";
  }

  if (!isKnownAccountColor(formState.color)) {
    errors.color = "Selecciona un color disponible.";
  }

  if (!isKnownAccountIcon(formState.icon)) {
    errors.icon = "Selecciona un icono disponible.";
  }

  return errors;
}

export function getFirstAccountFormError(errors: AccountFormErrors) {
  const firstKey = Object.keys(errors)[0] as AccountFormField | undefined;
  return firstKey ? errors[firstKey] ?? "" : "";
}

export function toAccountInput(formState: AccountFormState): AccountFormInput {
  return {
    name: formState.name.trim(),
    type: formState.type,
    currencyCode: formState.currencyCode.trim().toUpperCase(),
    openingBalance: Number(formState.openingBalance || 0),
    includeInNetWorth: formState.includeInNetWorth,
    color: formState.color,
    icon: formState.icon,
    institutionCode: formState.institutionCode.trim() || null,
    statementDay: formState.type === "credit_card" && formState.statementDay.trim() ? Number(formState.statementDay) : null,
    paymentDay: formState.type === "credit_card" && formState.paymentDay.trim() ? Number(formState.paymentDay) : null,
    creditLimit: formState.type === "credit_card" && formState.creditLimit.trim() ? Number(formState.creditLimit) : null,
    notes: formState.notes.trim() || null,
  };
}
