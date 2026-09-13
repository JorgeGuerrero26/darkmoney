import type { PickerOption } from "../../../components/ui/searchable-picker";

export type AccountInstitution = {
  code: string;
  label: string;
  countries: readonly string[];
};

export const accountInstitutions: readonly AccountInstitution[] = [
  { code: "bcp", label: "BCP", countries: ["PE"] },
  { code: "interbank", label: "Interbank", countries: ["PE"] },
  { code: "bbva-pe", label: "BBVA Perú", countries: ["PE"] },
  { code: "scotiabank", label: "Scotiabank", countries: ["PE", "CL", "MX"] },
  { code: "banbif", label: "BanBif", countries: ["PE"] },
  { code: "pichincha", label: "Pichincha", countries: ["PE", "EC"] },
  { code: "yape", label: "Yape", countries: ["PE"] },
  { code: "plin", label: "Plin", countries: ["PE"] },
  { code: "tunki", label: "Tunki", countries: ["PE"] },
  { code: "bbva", label: "BBVA", countries: ["MX", "ES", "AR"] },
  { code: "santander", label: "Santander", countries: ["MX", "AR", "CL", "BR"] },
  { code: "banamex", label: "Banamex", countries: ["MX"] },
  { code: "mercadopago", label: "Mercado Pago", countries: ["AR", "MX", "BR"] },
  { code: "nubank", label: "Nubank", countries: ["BR", "MX", "CO"] },
  { code: "rappi", label: "RappiPay", countries: ["CO", "MX", "BR"] },
  { code: "paypal", label: "PayPal", countries: ["GLOBAL"] },
  { code: "wise", label: "Wise", countries: ["GLOBAL"] },
  { code: "revolut", label: "Revolut", countries: ["GLOBAL"] },
  { code: "binance", label: "Binance", countries: ["GLOBAL"] },
  { code: "other-bank", label: "Otro banco", countries: ["GLOBAL"] },
];

export function findAccountInstitution(code?: string | null) {
  return accountInstitutions.find((institution) => institution.code === code) ?? null;
}

export function buildAccountInstitutionPickerOptions(): PickerOption[] {
  return [
    { value: "none", label: "Sin institución", description: "No asociar un banco o billetera.", leadingLabel: "SI" },
    ...accountInstitutions.map((institution) => ({
      value: institution.code,
      label: institution.label,
      description: institution.countries.includes("PE") ? "Perú" : institution.countries.includes("GLOBAL") ? "Global" : "Internacional",
      leadingLabel: institution.label.slice(0, 2).toUpperCase(),
      searchText: `${institution.code} ${institution.label} ${institution.countries.join(" ")}`,
    })),
  ];
}
