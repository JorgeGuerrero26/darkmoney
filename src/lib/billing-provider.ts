export function getBillingProviderLabel(provider?: string | null) {
  const normalizedProvider = provider?.trim().toLowerCase() ?? "";

  switch (normalizedProvider) {
    case "paddle":
      return "Paddle";
    case "lemon_squeezy":
      return "Lemon Squeezy";
    case "mercado_pago":
      return "Mercado Pago";
    default:
      return provider?.trim() || "Sin proveedor";
  }
}
