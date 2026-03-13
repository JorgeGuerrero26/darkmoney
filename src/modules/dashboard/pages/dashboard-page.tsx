import {
  ArrowDownCircle,
  ArrowUpCircle,
  Landmark,
  Sparkles,
  WalletCards,
} from "lucide-react";

import { DataState } from "../../../components/ui/data-state";
import { MetricCard } from "../../../components/ui/metric-card";
import { PageHeader } from "../../../components/ui/page-header";
import { StatusBadge } from "../../../components/ui/status-badge";
import { SurfaceCard } from "../../../components/ui/surface-card";
import { formatDateTime } from "../../../lib/formatting/dates";
import { formatCurrency } from "../../../lib/formatting/money";
import { useAuth } from "../../auth/auth-context";
import { useActiveWorkspace } from "../../workspaces/use-active-workspace";
import {
  getQueryErrorMessage,
  useWorkspaceSnapshotQuery,
} from "../../../services/queries/workspace-data";

function DashboardLoadingSkeleton() {
  return (
    <>
      <section className="grid gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            className="shimmer-surface h-[180px]"
            key={`dashboard-metric-${index}`}
          />
        ))}
      </section>
      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="shimmer-surface h-[360px]" />
        <div className="shimmer-surface h-[360px]" />
      </section>
    </>
  );
}

export function DashboardPage() {
  const { profile, user } = useAuth();
  const { activeWorkspace, error: workspaceError, isLoading: isWorkspacesLoading } = useActiveWorkspace();
  const snapshotQuery = useWorkspaceSnapshotQuery(activeWorkspace, user?.id, profile);
  const snapshot = snapshotQuery.data;

  if (!activeWorkspace && (isWorkspacesLoading || snapshotQuery.isLoading)) {
    return (
      <div className="space-y-6 pb-8">
        <PageHeader
          description="Tu resumen ejecutivo aparecera aqui apenas termine la conexion inicial."
          eyebrow="overview"
          title="Dashboard"
        />
        <DashboardLoadingSkeleton />
      </div>
    );
  }

  if (workspaceError) {
    return (
      <div className="space-y-6 pb-8">
        <PageHeader
          description="El dashboard depende del workspace activo y sus permisos de lectura."
          eyebrow="overview"
          title="Dashboard no disponible"
        />
        <DataState
          description={getQueryErrorMessage(workspaceError, "No pudimos cargar tus workspaces reales.")}
          title="Acceso bloqueado al workspace"
          tone="error"
        />
      </div>
    );
  }

  if (!activeWorkspace) {
    return (
      <div className="space-y-6 pb-8">
        <PageHeader
          description="Necesitamos un workspace real para mostrar balances, movimientos y actividad."
          eyebrow="overview"
          title="Aun no hay un workspace activo"
        />
        <DataState
          description="Si acabas de registrarte, revisa que el trigger del perfil haya creado tu workspace personal o que existan politicas RLS para leerlo."
          title="Todavia no encontramos datos financieros"
        />
      </div>
    );
  }

  if (snapshotQuery.isLoading || !snapshot) {
    return (
      <div className="space-y-6 pb-8">
        <PageHeader
          description="Los datos reales se actualizaran aqui en segundo plano."
          eyebrow="overview"
          title={`${activeWorkspace.name}, en una sola mirada`}
        />
        <DashboardLoadingSkeleton />
      </div>
    );
  }

  if (snapshotQuery.error) {
    return (
      <div className="space-y-6 pb-8">
        <PageHeader
          description="Intentamos leer cuentas, movimientos, obligaciones y actividad de este workspace."
          eyebrow="overview"
          title={`${activeWorkspace.name}, con problemas de lectura`}
        />
        <DataState
          description={getQueryErrorMessage(snapshotQuery.error, "No pudimos leer la informacion del dashboard.")}
          title="No fue posible cargar el dashboard real"
          tone="error"
        />
      </div>
    );
  }

  const visibleAccounts = snapshot.accounts.filter((account) => !account.isArchived);
  const incomeMax = Math.max(
    1,
    ...snapshot.cashflow.map((item) => Math.max(item.income, item.expense)),
  );

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        description="Resumen ejecutivo en tiempo real del workspace activo. Si una seccion aparece vacia, significa que todavia no hay registros reales en esa tabla."
        eyebrow="overview"
        title={`${snapshot.workspace.name}, en una sola mirada`}
      />

      <section className="grid gap-4 xl:grid-cols-4">
        <MetricCard
          accent="pine"
          hint="Balance combinado de las cuentas activas visibles dentro del workspace."
          icon={<WalletCards className="h-5 w-5" />}
          label="Balance actual"
          value={formatCurrency(snapshot.metrics.balance, snapshot.workspace.baseCurrencyCode)}
        />
        <MetricCard
          accent="ember"
          hint="Movimientos confirmados que ya impactan saldos y reportes."
          icon={<ArrowUpCircle className="h-5 w-5" />}
          label="Movimientos posted"
          value={String(snapshot.metrics.postedCount)}
        />
        <MetricCard
          accent="gold"
          hint="Operaciones pendientes que todavia no consolidan el balance."
          icon={<ArrowDownCircle className="h-5 w-5" />}
          label="Movimientos pending"
          value={String(snapshot.metrics.pendingCount)}
        />
        <MetricCard
          accent="ink"
          hint="Obligaciones y suscripciones activas con seguimiento en este workspace."
          icon={<Landmark className="h-5 w-5" />}
          label="Compromisos activos"
          value={String(snapshot.obligations.length + snapshot.subscriptions.length)}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SurfaceCard
          description="Ingresos y gastos posted de los ultimos seis meses calculados desde la tabla de movimientos."
          title="Pulso financiero"
        >
          {snapshot.movements.length === 0 ? (
            <DataState
              description="Todavia no existen movimientos reales para construir la tendencia mensual."
              title="Sin historial suficiente"
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
              {snapshot.cashflow.map((item) => (
                <div
                  className="glass-panel-soft rounded-[28px] p-4"
                  key={item.label}
                >
                  <p className="text-xs uppercase tracking-[0.2em] text-storm">{item.label}</p>
                  <div className="mt-4 flex h-44 items-end gap-3">
                    <div className="flex flex-1 flex-col items-center gap-3">
                      <div className="flex h-32 w-full items-end rounded-full bg-pine/8 p-1">
                        <div
                          className="w-full rounded-full bg-pine"
                          style={{ height: `${(item.income / incomeMax) * 100}%` }}
                        />
                      </div>
                      <p className="text-xs text-storm">
                        {formatCurrency(item.income, snapshot.workspace.baseCurrencyCode)}
                      </p>
                    </div>
                    <div className="flex flex-1 flex-col items-center gap-3">
                      <div className="flex h-32 w-full items-end rounded-full bg-ember/8 p-1">
                        <div
                          className="w-full rounded-full bg-ember"
                          style={{ height: `${(item.expense / incomeMax) * 100}%` }}
                        />
                      </div>
                      <p className="text-xs text-storm">
                        {formatCurrency(item.expense, snapshot.workspace.baseCurrencyCode)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SurfaceCard>

        <SurfaceCard
          action={<StatusBadge status={snapshot.workspace.kind} tone="info" />}
          description="Cuentas activas calculadas desde opening_balance y movimientos posted."
          title="Mapa de cuentas"
        >
          {visibleAccounts.length === 0 ? (
            <DataState
              description="Cuando registres tu primera cuenta, aqui veras su saldo real y ultima actividad."
              title="No hay cuentas activas"
            />
          ) : (
            <div className="space-y-3">
              {visibleAccounts.map((account) => (
                <article
                  className="glass-panel-soft rounded-[26px] p-4"
                  key={account.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-ink">{account.name}</p>
                      <p className="mt-1 text-sm text-storm">
                        {account.type} - {account.currencyCode}
                      </p>
                    </div>
                    <StatusBadge
                      status={account.includeInNetWorth ? "net worth" : "excluded"}
                      tone={account.includeInNetWorth ? "success" : "warning"}
                    />
                  </div>
                  <p className="mt-4 font-display text-3xl font-semibold text-ink">
                    {formatCurrency(account.currentBalance, account.currencyCode)}
                  </p>
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-storm">
                    Ultima actividad - {formatDateTime(account.lastActivity)}
                  </p>
                </article>
              ))}
            </div>
          )}
        </SurfaceCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr_0.9fr]">
        <SurfaceCard
          description="Ultimos movimientos reales del workspace activo."
          title="Ultimos movimientos"
        >
          {snapshot.movements.length === 0 ? (
            <DataState
              description="Todavia no hay movimientos registrados en la base de datos para este workspace."
              title="Sin movimientos reales"
            />
          ) : (
            <div className="space-y-3">
              {snapshot.movements.slice(0, 6).map((movement) => (
                <article
                  className="glass-panel-soft rounded-[26px] p-4"
                  key={movement.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-ink">{movement.description}</p>
                      <p className="mt-1 text-sm text-storm">
                        {movement.category} - {movement.counterparty}
                      </p>
                    </div>
                    <StatusBadge
                      status={movement.status}
                      tone={movement.status === "posted" ? "success" : "warning"}
                    />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3 text-sm text-storm">
                    {movement.sourceAmount ? (
                      <span>
                        Sale{" "}
                        {formatCurrency(
                          movement.sourceAmount,
                          movement.sourceCurrencyCode ?? snapshot.workspace.baseCurrencyCode,
                        )}
                      </span>
                    ) : null}
                    {movement.destinationAmount ? (
                      <span>
                        Entra{" "}
                        {formatCurrency(
                          movement.destinationAmount,
                          movement.destinationCurrencyCode ?? snapshot.workspace.baseCurrencyCode,
                        )}
                      </span>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </SurfaceCard>

        <SurfaceCard
          description="Obligaciones y deudas vivas calculadas desde obligations y obligation_events."
          title="Compromisos"
        >
          {snapshot.obligations.length === 0 ? (
            <DataState
              description="Cuando existan creditos o deudas, aqui veras el pendiente real y su avance."
              title="Sin obligaciones registradas"
            />
          ) : (
            <div className="space-y-3">
              {snapshot.obligations.slice(0, 6).map((obligation) => (
                <article
                  className="glass-panel-soft rounded-[26px] p-4"
                  key={obligation.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-ink">{obligation.title}</p>
                      <p className="mt-1 text-sm text-storm">{obligation.counterparty}</p>
                    </div>
                    <StatusBadge
                      status={obligation.direction}
                      tone={obligation.direction === "receivable" ? "success" : "danger"}
                    />
                  </div>
                  <p className="mt-4 text-sm text-storm">
                    Pendiente {formatCurrency(obligation.pendingAmount, obligation.currencyCode)}
                  </p>
                  <div className="mt-3 h-2 rounded-full bg-white/[0.08]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-pine via-ember to-gold"
                      style={{ width: `${obligation.progressPercent}%` }}
                    />
                  </div>
                </article>
              ))}
            </div>
          )}
        </SurfaceCard>

        <SurfaceCard
          action={<Sparkles className="h-5 w-5 text-gold" />}
          description="Actividad compartida reciente desde el log del workspace."
          title="Feed de actividad"
        >
          {snapshot.activity.length === 0 ? (
            <DataState
              description="Aun no hay eventos en activity_log para este workspace."
              title="Sin actividad compartida"
            />
          ) : (
            <div className="space-y-3">
              {snapshot.activity.map((item) => (
                <article
                  className="glass-panel-soft rounded-[26px] p-4"
                  key={item.id}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.08] text-sm font-semibold text-ink">
                      {item.actor.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-ink">{item.actor}</p>
                      <p className="text-xs uppercase tracking-[0.18em] text-storm">
                        {item.entity} - {item.action}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-storm">{item.description}</p>
                  <p className="mt-3 text-xs uppercase tracking-[0.18em] text-storm">
                    {formatDateTime(item.createdAt)}
                  </p>
                </article>
              ))}
            </div>
          )}
        </SurfaceCard>
      </section>
    </div>
  );
}
