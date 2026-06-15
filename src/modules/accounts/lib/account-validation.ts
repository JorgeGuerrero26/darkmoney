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
    notes: "",
  };
}

export function buildFormStateFromAccount(account: AccountSummary): AccountFormState {
  return {
    name: account.name,
    type: account.type,
    currencyCode: account.currencyCode,
    openingBalance: String(account.openingBalance),
    includeInNetWorth: account.includeInNetWorth,
    color: account.color,
    icon: account.icon || getTypePreset(account.type).icon,
    notes: account.notes ?? "",
  };
}

export function validateAccountForm(formState: AccountFormState): AccountFormErrors {
  const errors: AccountFormErrors = {};
  const openingBalance = Number(formState.openingBalance);
  const normalizedCurrency = formState.currencyCode.trim().toUpperCase();

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
    notes: formState.notes.trim() || null,
  };
}
