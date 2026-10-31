import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { AccountSummary } from "../../../types/domain";
import { formatCurrency } from "../../../lib/formatting/money";
import { convertDashboardAmount } from "../lib/dashboard-format";

export function DashboardSimpleOverview({ accounts, currency, baseCurrency, rates, month, detections, agenda }: {
  accounts: AccountSummary[]; currency: string; baseCurrency: string; rates: Map<string, number>;
  month: { income: number; expense: number; unconvertedCount: number }; detections: ReactNode; agenda?: ReactNode;
}) {
  const visible = accounts.filter(account => !account.isArchived && account.includeInNetWorth).map(account => ({
    account, amount: convertDashboardAmount({ amount: account.currentBalance, currencyCode: account.currencyCode,
      amountInBaseCurrency: account.currentBalanceInBaseCurrency, baseCurrencyCode: baseCurrency, targetCurrencyCode: currency, exchangeRateMap: rates }),
  }));
  const complete = visible.every(row => row.amount !== null && Number.isFinite(row.amount));
  const total = visible.reduce((sum, row) => sum + (row.amount ?? 0), 0);
  const monthComplete = month.unconvertedCount === 0;
  return <div className="grid items-start gap-8 lg:grid-cols-2 lg:gap-x-10">
    <div>
      <h2 className="text-sm text-storm">Tienes en tus cuentas</h2>
      <p className="mt-3 font-display text-4xl font-semibold tabular-nums text-ink">{complete ? formatCurrency(total, currency) : "Saldo no disponible"}</p>
      {!complete ? <p role="status" className="mt-2 text-sm text-storm">Faltan conversiones para calcular el total de tus cuentas.</p> : null}
      <div className="mt-4 divide-y divide-white/[0.07]">{visible.map(({ account, amount }) => <Link key={account.id} to={`/app/accounts?resource=${account.id}`} className="flex min-h-14 items-center justify-between gap-4 py-3 text-sm"><span className="text-ink">{account.name}</span><span className="tabular-nums text-ink">{amount === null || !Number.isFinite(amount) ? `${formatCurrency(account.currentBalance, account.currencyCode)} · Sin conversión` : formatCurrency(amount, currency)} ›</span></Link>)}</div>
      {!visible.length ? <p className="mt-3 text-sm text-storm">Agrega una cuenta para ver tu saldo aquí.</p> : null}
      <div className="mt-6 empty:hidden">{detections}</div>
    </div>
    <section aria-label="Este mes">
      <h2 className="font-display text-lg font-semibold text-ink">Este mes</h2>
      {monthComplete ? <><dl className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-lg border border-white/[0.07] p-4"><dt className="text-sm text-storm">Entró</dt><dd className="mt-2 font-display text-xl font-semibold tabular-nums text-ink">{formatCurrency(month.income, currency)}</dd></div><div className="rounded-lg border border-white/[0.07] p-4"><dt className="text-sm text-storm">Salió</dt><dd className="mt-2 font-display text-xl font-semibold tabular-nums text-ink">{formatCurrency(month.expense, currency)}</dd></div></dl><p className="mt-4 text-sm text-storm">{month.income >= month.expense ? "Te quedaron" : "Te faltaron"} <span className="font-semibold text-ink">{formatCurrency(Math.abs(month.income - month.expense), currency)}</span> este mes.</p></> : <p role="status" className="mt-4 text-sm text-storm">Faltan conversiones para calcular las entradas y salidas del mes.</p>}
      {agenda}
    </section>
  </div>;
}
