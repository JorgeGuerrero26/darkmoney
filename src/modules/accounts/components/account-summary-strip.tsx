import { Archive, Coins, Landmark, PiggyBank, WalletCards } from "lucide-react";
import { useMemo } from "react";

import { InfoTip } from "../../../components/ui/info-tip";
import { StatusBadge } from "../../../components/ui/status-badge";
import { formatWorkspaceKindLabel } from "../../../lib/formatting/labels";
import { formatCurrency, resolveAggregateBalanceDisplay } from "../../../lib/formatting/money";
import type { AccountSummary, WorkspaceKind } from "../../../types/domain";

type AccountSummaryStripProps = {
  accounts: AccountSummary[];
  baseCurrencyCode: string;
  workspaceKind: WorkspaceKind;
  isFetching?: boolean;
};

function MetricCard({
  description,
  icon: Icon,
  label,
  tone = "neutral",
  value,
}: {
  description: string;
  icon: typeof WalletCards;
  label: string;
  tone?: "neutral" | "success" | "warning" | "info";
  value: string;
}) {
  const toneClassName = {
    neutral: "bg-white/[0.04] text-ink ring-white/10",
    success: "bg-pine/10 text-pine ring-pine/20",
    warning: "bg-gold/10 text-gold ring-gold/20",
    info: "bg-ember/10 text-ember ring-ember/20",
  }[tone];

  return (
    <article className="glass-panel-soft min-w-0 rounded-[24px] p-4 transition duration-300 hover:border-white/15">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase tracking-[0.22em] text-storm/80">
            {label}
          </p>
          <p className="mt-2 break-words font-display text-2xl font-semibold leading-tight text-ink">
            {value}
          </p>
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px] ring-1 ${toneClassName}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 text-xs leading-5 text-storm">{description}</p>
    </article>
  );
}

export function AccountSummaryStrip({
  accounts,
  baseCurrencyCode,
  isFetching = false,
  workspaceKind,
}: AccountSummaryStripProps) {
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
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <div className="sm:col-span-2 xl:col-span-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={formatWorkspaceKindLabel(workspaceKind)} tone="info" />
          {isFetching ? <StatusBadge status="Actualizando" tone="neutral" /> : null}
          <InfoTip title="Como leer el resumen">
            El total patrimonial suma las cuentas activas incluidas en patrimonio. Si hay varias
            monedas, se usa la moneda base del workspace cuando exista conversion disponible.
          </InfoTip>
        </div>
      </div>

      <MetricCard
        description="Suma de cuentas activas marcadas como parte del patrimonio."
        icon={WalletCards}
        label="Patrimonio"
        tone="success"
        value={formatCurrency(metrics.netWorth.amount, metrics.netWorth.currencyCode)}
      />
      <MetricCard
        description="Cuentas disponibles para movimientos, presupuestos y seguimiento diario."
        icon={Landmark}
        label="Activas"
        value={String(metrics.activeAccounts.length)}
      />
      <MetricCard
        description="Operativas, pero excluidas del calculo patrimonial."
        icon={Archive}
        label="Fuera de patrimonio"
        tone={metrics.excludedAccounts.length ? "warning" : "neutral"}
        value={String(metrics.excludedAccounts.length)}
      />
      <MetricCard
        description="Retiradas del flujo principal, reversibles desde este modulo."
        icon={PiggyBank}
        label="Archivadas"
        tone={metrics.archivedAccounts.length ? "warning" : "neutral"}
        value={String(metrics.archivedAccounts.length)}
      />
      <MetricCard
        description="Monedas activas en uso dentro del inventario actual."
        icon={Coins}
        label="Monedas"
        value={String(metrics.currencyCount)}
      />
      <MetricCard
        description={
          metrics.topAccount
            ? `Mayor saldo: ${metrics.topAccount.name}`
            : "Aparecera cuando registres tu primera cuenta."
        }
        icon={WalletCards}
        label="Mayor saldo"
        tone="info"
        value={
          metrics.topAccount
            ? formatCurrency(metrics.topAccount.currentBalance, metrics.topAccount.currencyCode)
            : "-"
        }
      />
    </section>
  );
}
