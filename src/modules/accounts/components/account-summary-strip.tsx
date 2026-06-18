import { useMemo } from "react";

import { formatCurrency, resolveAggregateBalanceDisplay } from "../../../lib/formatting/money";
import type { AccountSummary } from "../../../types/domain";

type AccountSummaryStripProps = {
  accounts: AccountSummary[];
  baseCurrencyCode: string;
};

function SummaryChip({
  label,
  tone = "neutral",
  value,
}: {
  label: string;
  tone?: "neutral" | "info" | "warning" | "success";
  value: string;
}) {
  const valueTone = {
    neutral: "text-ink",
    info: "text-ember",
    warning: "text-gold",
    success: "text-pine",
  } as const;

  return (
    <article className="glass-panel-soft min-w-0 rounded-[24px] p-4 transition duration-300 hover:border-white/15">
      <p className="truncate text-xs font-semibold uppercase tracking-[0.22em] text-storm/80">{label}</p>
      <p className={`mt-2 truncate font-display text-2xl font-semibold leading-tight ${valueTone[tone]}`}>{value}</p>
    </article>
  );
}

export function AccountSummaryStrip({ accounts, baseCurrencyCode }: AccountSummaryStripProps) {
  const metrics = useMemo(() => {
    const activeAccounts = accounts.filter((account) => !account.isArchived);
    const archivedAccounts = accounts.filter((account) => account.isArchived);
    const netWorthAccounts = activeAccounts.filter((account) => account.includeInNetWorth);
    const excludedAccounts = activeAccounts.filter((account) => !account.includeInNetWorth);
    const currencyCount = new Set(
      activeAccounts.map((account) => account.currencyCode.trim().toUpperCase()).filter(Boolean),
    ).size;
    const netWorth = resolveAggregateBalanceDisplay(netWorthAccounts, baseCurrencyCode);
    const topAccount = [...activeAccounts].sort((left, right) => {
      const rightBalance = right.currentBalanceInBaseCurrency ?? right.currentBalance;
      const leftBalance = left.currentBalanceInBaseCurrency ?? left.currentBalance;
      return rightBalance - leftBalance;
    })[0];

    return {
      activeAccounts,
      archivedAccounts,
      currencyCount,
      excludedAccounts,
      netWorth,
      topAccount,
    };
  }, [accounts, baseCurrencyCode]);

  return (
    <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,11rem),1fr))]">
      <SummaryChip label="patrimonio" tone="success" value={formatCurrency(metrics.netWorth.amount, metrics.netWorth.currencyCode)} />
      <SummaryChip label="activas" tone="info" value={String(metrics.activeAccounts.length)} />
      <SummaryChip
        label="fuera de patrimonio"
        tone={metrics.excludedAccounts.length ? "warning" : "neutral"}
        value={String(metrics.excludedAccounts.length)}
      />
      <SummaryChip
        label="archivadas"
        tone={metrics.archivedAccounts.length ? "warning" : "neutral"}
        value={String(metrics.archivedAccounts.length)}
      />
      <SummaryChip label="monedas" tone="info" value={String(metrics.currencyCount)} />
      <SummaryChip
        label="mayor saldo"
        tone="info"
        value={metrics.topAccount ? formatCurrency(metrics.topAccount.currentBalance, metrics.topAccount.currencyCode) : "-"}
      />
    </div>
  );
}
