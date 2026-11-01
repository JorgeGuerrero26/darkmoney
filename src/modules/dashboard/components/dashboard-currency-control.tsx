import { SegmentedControl, type SegmentedControlOption } from "../../../components/ui/segmented-control";

/** Ofrece solo monedas de cuentas patrimoniales y conversiones disponibles. */
export function DashboardCurrencyControl({ accountCurrencies, options, value, onChange }: {
  accountCurrencies: string[]; options: SegmentedControlOption<string>[]; value: string; onChange: (currency: string) => void;
}) {
  const currencies = new Set(accountCurrencies.map(code => code.trim().toUpperCase()));
  if (currencies.size < 2) return null;
  const available = options.filter(option => currencies.has(option.value) || option.value === value);
  if (available.length < 2) return null;
  return <SegmentedControl ariaLabel="Moneda de visualización" options={available} value={value} onChange={onChange} />;
}
