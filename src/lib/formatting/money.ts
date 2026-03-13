export function formatCurrency(amount: number, currencyCode: string, locale = "es-PE") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 2,
  }).format(amount);
}
