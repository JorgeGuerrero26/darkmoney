import type { ObligationDirection, ObligationOriginType, ObligationStatus } from "../../../types/domain";
import type { PaymentPlan } from "./payment-plan";

export type OpeningImpact = "none" | "outflow" | "inflow";

export type ObligationFormState = {
  direction: ObligationDirection;
  originType: ObligationOriginType;
  manualOpeningImpact: OpeningImpact;
  status: ObligationStatus;
  title: string;
  counterpartyId: string;
  openingAccountId: string;
  settlementAccountId: string;
  currencyCode: string;
  principalAmount: string;
  startDate: string;
  dueDate: string;
  installmentAmount: string;
  installmentCount: string;
  paymentPlan: PaymentPlan | null;
  interestRate: string;
  description: string;
  notes: string;
};

export type ShareInviteFormState = {
  invitedEmail: string;
  message: string;
};

export type FeedbackState = {
  tone: "success" | "error";
  title: string;
  description: string;
};

export const receivableOriginTypeOptions = [
  {
    value: "cash_loan" as const,
    label: "Preste dinero",
    description: "Tu entregaste dinero y nacio una cuenta por cobrar.",
    leadingLabel: "PD",
    leadingColor: "#4566d6",
  },
  {
    value: "sale_financed" as const,
    label: "Vendi a cuotas",
    description: "Te deben dinero, pero no salio efectivo de tu cuenta al inicio.",
    leadingLabel: "VF",
    leadingColor: "#1b6a58",
  },
  {
    value: "manual" as const,
    label: "Manual",
    description: "Define el caso manualmente si no encaja en los escenarios comunes.",
    leadingLabel: "MN",
    leadingColor: "#6b7280",
  },
] as const;

export const payableOriginTypeOptions = [
  {
    value: "cash_loan" as const,
    label: "Me prestaron dinero",
    description: "Recibiste dinero y nacio una deuda a pagar.",
    leadingLabel: "MP",
    leadingColor: "#4566d6",
  },
  {
    value: "purchase_financed" as const,
    label: "Compre a cuotas",
    description: "La deuda nace sin entrada de efectivo a tu cuenta.",
    leadingLabel: "CQ",
    leadingColor: "#c46a31",
  },
  {
    value: "manual" as const,
    label: "Manual",
    description: "Define el caso manualmente si no encaja en los escenarios comunes.",
    leadingLabel: "MN",
    leadingColor: "#6b7280",
  },
] as const;

export const manualOpeningImpactOptions = [
  {
    value: "none" as const,
    label: "Sin impacto inicial",
    description: "El saldo nace sin mover dinero de una cuenta al crear el registro.",
    leadingLabel: "SI",
    leadingColor: "#6b7280",
  },
  {
    value: "outflow" as const,
    label: "Sale dinero de mi cuenta",
    description: "Se registrara una salida inicial desde una cuenta tuya.",
    leadingLabel: "SA",
    leadingColor: "#8f3e3e",
  },
  {
    value: "inflow" as const,
    label: "Entra dinero a mi cuenta",
    description: "Se registrara un ingreso inicial hacia una cuenta tuya.",
    leadingLabel: "EN",
    leadingColor: "#1b6a58",
  },
] as const;

export const statusOptions = [
  {
    value: "draft" as const,
    label: "Borrador",
    description: "Aun no esta en seguimiento activo.",
    leadingLabel: "BD",
    leadingColor: "#6b7280",
  },
  {
    value: "active" as const,
    label: "Activa",
    description: "Sigue pendiente de resolverse.",
    leadingLabel: "AC",
    leadingColor: "#4566d6",
  },
  {
    value: "paid" as const,
    label: "Liquidada",
    description: "Ya quedo saldada por completo.",
    leadingLabel: "LD",
    leadingColor: "#1b6a58",
  },
  {
    value: "cancelled" as const,
    label: "Cancelada",
    description: "Se cerro sin continuar.",
    leadingLabel: "CA",
    leadingColor: "#64748b",
  },
  {
    value: "defaulted" as const,
    label: "Atrasada",
    description: "Necesita atencion por mora o retraso.",
    leadingLabel: "AT",
    leadingColor: "#b48b34",
  },
] as const;

export const currencyOptions = [
  { code: "PEN", label: "Sol peruano", region: "Peru", symbol: "S/" },
  { code: "USD", label: "Dolar estadounidense", region: "Estados Unidos", symbol: "$" },
  { code: "EUR", label: "Euro", region: "Union Europea", symbol: "EUR" },
  { code: "BRL", label: "Real brasileno", region: "Brasil", symbol: "R$" },
  { code: "MXN", label: "Peso mexicano", region: "Mexico", symbol: "MXN" },
  { code: "CLP", label: "Peso chileno", region: "Chile", symbol: "CLP" },
] as const;

export function getOriginTypeOptions(direction: ObligationDirection) {
  return direction === "receivable" ? receivableOriginTypeOptions : payableOriginTypeOptions;
}

export function normalizeOriginTypeForDirection(
  direction: ObligationDirection,
  originType: ObligationOriginType,
): ObligationOriginType {
  if (direction === "receivable" && originType === "purchase_financed") {
    return "sale_financed";
  }

  if (direction === "payable" && originType === "sale_financed") {
    return "purchase_financed";
  }

  return originType;
}

export function getOpeningImpact(
  direction: ObligationDirection,
  originType: ObligationOriginType,
  manualOpeningImpact: OpeningImpact,
): OpeningImpact {
  if (originType === "cash_loan") {
    return direction === "receivable" ? "outflow" : "inflow";
  }

  if (originType === "sale_financed" || originType === "purchase_financed") {
    return "none";
  }

  return manualOpeningImpact;
}

export function getOpeningImpactMeta(
  direction: ObligationDirection,
  originType: ObligationOriginType,
  manualOpeningImpact: OpeningImpact,
) {
  const openingImpact = getOpeningImpact(direction, originType, manualOpeningImpact);

  if (originType === "cash_loan") {
    return direction === "receivable"
      ? {
          impact: openingImpact,
          label: "Sale dinero al crear",
          description: "Se registrara una salida inicial desde tu cuenta en la fecha de inicio.",
          requiresAccount: true,
        }
      : {
          impact: openingImpact,
          label: "Entra dinero al crear",
          description: "Se registrara un ingreso inicial hacia tu cuenta en la fecha de inicio.",
          requiresAccount: true,
        };
  }

  if (originType === "sale_financed") {
    return {
      impact: openingImpact,
      label: "Sin impacto inicial",
      description: "El dinero entrara recien cuando registres los abonos posteriores.",
      requiresAccount: false,
    };
  }

  if (originType === "purchase_financed") {
    return {
      impact: openingImpact,
      label: "Sin impacto inicial",
      description: "La deuda se crea sin mover saldo en una cuenta al inicio.",
      requiresAccount: false,
    };
  }

  const selectedOption =
    manualOpeningImpactOptions.find((option) => option.value === openingImpact) ??
    manualOpeningImpactOptions[0];

  return {
    impact: openingImpact,
    label: selectedOption.label,
    description: selectedOption.description,
    requiresAccount: openingImpact !== "none",
  };
}

export function applyObligationFormRules(formState: ObligationFormState): ObligationFormState {
  const normalizedOriginType = normalizeOriginTypeForDirection(formState.direction, formState.originType);
  const openingImpact = getOpeningImpact(
    formState.direction,
    normalizedOriginType,
    formState.manualOpeningImpact,
  );

  return {
    ...formState,
    originType: normalizedOriginType,
    openingAccountId: openingImpact === "none" ? "" : formState.openingAccountId,
  };
}

export function getCurrencyLabel(currencyCode: string) {
  return (
    currencyOptions.find((option) => option.code === currencyCode.toUpperCase()) ?? {
      code: currencyCode.toUpperCase(),
      label: "Moneda registrada",
      region: "Configurada en tu base",
      symbol: currencyCode.toUpperCase(),
    }
  );
}
