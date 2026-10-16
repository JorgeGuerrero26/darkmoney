import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";

import { formatCurrency } from "../../../lib/formatting/money";
import type { AccountSummary, ExchangeRateSummary } from "../../../types/domain";
import { getTypePreset } from "../lib/account-options";

type Props = {
  accounts: AccountSummary[];
  baseCurrencyCode: string;
  exchangeRates: ExchangeRateSummary[];
  preferenceKey?: string;
};

function conversionRate(rates: ExchangeRateSummary[], from: string, to: string) {
  if (from === to) return 1;
  const direct = rates.find((rate) => rate.fromCurrencyCode === from && rate.toCurrencyCode === to);
  if (direct?.rate) return direct.rate;
  const inverse = rates.find((rate) => rate.fromCurrencyCode === to && rate.toCurrencyCode === from);
  return inverse?.rate ? 1 / inverse.rate : null;
}

export function AccountComposition({ accounts, baseCurrencyCode, exchangeRates, preferenceKey }: Props) {
  const [expanded, setExpanded] = useState(false);
  const availableCurrencies = useMemo(() => {
    const currencies = new Set([baseCurrencyCode]);
    for (const rate of exchangeRates) {
      if (conversionRate(exchangeRates, baseCurrencyCode, rate.toCurrencyCode)) currencies.add(rate.toCurrencyCode);
      if (conversionRate(exchangeRates, baseCurrencyCode, rate.fromCurrencyCode)) currencies.add(rate.fromCurrencyCode);
    }
    return [...currencies].slice(0, 4);
  }, [baseCurrencyCode, exchangeRates]);
  const [displayCurrency, setDisplayCurrency] = useState(() => { try { return preferenceKey ? window.localStorage.getItem(preferenceKey) || baseCurrencyCode : baseCurrencyCode; } catch { return baseCurrencyCode; } });
  const effectiveCurrency = availableCurrencies.includes(displayCurrency) ? displayCurrency : baseCurrencyCode;
  const factor = conversionRate(exchangeRates, baseCurrencyCode, effectiveCurrency) ?? 1;
  const composition = useMemo(() => {
    const groups = new Map<string, number>();
    let debts = 0;
    for (const account of accounts) {
      if (account.isArchived || !account.includeInNetWorth) continue;
      const value = (account.currentBalanceInBaseCurrency ?? account.currentBalance) * factor;
      const debtType = account.type === "loan" || account.type === "loan_wallet";
      if (debtType || value < 0) debts += Math.abs(value);
      else groups.set(account.type, (groups.get(account.type) ?? 0) + value);
    }
    const assets = [...groups.entries()]
      .map(([type, value]) => ({ type, value }))
      .sort((left, right) => right.value - left.value);
    const totalAssets = assets.reduce((sum, item) => sum + item.value, 0);
    return { assets, debts, totalAssets, netWorth: totalAssets - debts };
  }, [accounts, factor]);

  return (
    <section className="border-y border-white/[0.08]">
      <button className="flex min-h-[58px] w-full items-center justify-between gap-4 py-3 text-left" onClick={() => setExpanded((current) => !current)} type="button">
        <span>
          <span className="block text-sm font-semibold text-ink">Composición del patrimonio</span>
          <span className="mt-0.5 block text-xs text-storm">Activos {formatCurrency(composition.totalAssets, effectiveCurrency)} · Deudas {formatCurrency(composition.debts, effectiveCurrency)}</span>
        </span>
        <span className="flex items-center gap-3">
          <span className="text-sm font-semibold text-ink">{formatCurrency(composition.netWorth, effectiveCurrency)}</span>
          <ChevronDown className={`h-4 w-4 text-storm transition ${expanded ? "rotate-180" : ""}`} />
        </span>
      </button>
      {expanded ? (
        <div className="border-t border-white/[0.07] pb-5 pt-4">
          {availableCurrencies.length > 1 ? (
            <div className="mb-4 flex flex-wrap gap-2" aria-label="Moneda de visualización">
              {availableCurrencies.map((currency) => (
                <button aria-pressed={effectiveCurrency === currency} className={`rounded-[7px] border px-3 py-1.5 text-xs font-semibold ${effectiveCurrency === currency ? "border-ink/40 bg-ink text-void" : "border-white/10 text-storm hover:text-ink"}`} key={currency} onClick={() => { setDisplayCurrency(currency); try { if (preferenceKey) window.localStorage.setItem(preferenceKey, currency); } catch { /* Keep the selection in memory. */ } }} type="button">{currency}</button>
              ))}
            </div>
          ) : null}
          <div className="space-y-3">
            {composition.assets.map((item) => (
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1" key={item.type}>
                <span className="text-sm text-storm">{getTypePreset(item.type).label}</span>
                <span className="text-sm font-medium text-ink">{formatCurrency(item.value, effectiveCurrency)}</span>
                <span className="col-span-2 h-1 overflow-hidden rounded-full bg-white/[0.07]"><span className="block h-full rounded-full bg-[#d6b69b]" style={{ width: `${composition.totalAssets ? Math.max(2, item.value / composition.totalAssets * 100) : 0}%` }} /></span>
              </div>
            ))}
            {composition.assets.length === 0 ? <p className="text-sm text-storm">No hay saldos positivos incluidos.</p> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
