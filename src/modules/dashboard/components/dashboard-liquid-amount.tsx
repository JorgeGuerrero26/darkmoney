import { formatCurrency } from "../../../lib/formatting/money";

/** No presenta un saldo parcial como el total disponible. */
export function DashboardLiquidAmount({ amount, currency, unconvertedCount }: {
  amount: number; currency: string; unconvertedCount: number;
}) {
  if (unconvertedCount > 0) return <span>Saldo no disponible <span className="block pt-2 text-sm font-normal tracking-normal text-storm" role="status">Faltan conversiones para {unconvertedCount} {unconvertedCount === 1 ? "cuenta" : "cuentas"}.</span></span>;
  return <>{formatCurrency(amount, currency)}</>;
}
