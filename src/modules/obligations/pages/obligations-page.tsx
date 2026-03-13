import { ArrowRightLeft, Landmark, Plus } from "lucide-react";

import { Button } from "../../../components/ui/button";
import { DataState } from "../../../components/ui/data-state";
import { PageHeader } from "../../../components/ui/page-header";
import { ProgressBar } from "../../../components/ui/progress-bar";
import { StatusBadge } from "../../../components/ui/status-badge";
import { SurfaceCard } from "../../../components/ui/surface-card";
import { formatDate } from "../../../lib/formatting/dates";
import { formatCurrency } from "../../../lib/formatting/money";
import { useAuth } from "../../auth/auth-context";
import { useActiveWorkspace } from "../../workspaces/use-active-workspace";
import {
  getQueryErrorMessage,
  useWorkspaceSnapshotQuery,
} from "../../../services/queries/workspace-data";

export function ObligationsPage() {
  const { profile, user } = useAuth();
  const { activeWorkspace, error: workspaceError, isLoading: isWorkspacesLoading } = useActiveWorkspace();
  const snapshotQuery = useWorkspaceSnapshotQuery(activeWorkspace, user?.id, profile);
  const snapshot = snapshotQuery.data;

  if (!activeWorkspace && (isWorkspacesLoading || snapshotQuery.isLoading)) {
    return (
      <div className="space-y-6 pb-8">
        <PageHeader
          description="Estamos consultando tus creditos y deudas reales."
          eyebrow="obligations"
          title="Cargando obligaciones"
        />
        <DataState
          description="Buscando el workspace activo y leyendo obligations y obligation_events."
          title="Sincronizando cartera real"
        />
      </div>
    );
  }

  if (workspaceError) {
    return (
      <div className="space-y-6 pb-8">
        <PageHeader
          description="Este modulo depende del acceso correcto al workspace activo."
          eyebrow="obligations"
          title="Creditos y deudas no disponibles"
        />
        <DataState
          description={getQueryErrorMessage(workspaceError, "No pudimos leer tus workspaces reales.")}
          title="No hay acceso al workspace"
          tone="error"
        />
      </div>
    );
  }

  if (!activeWorkspace) {
    return (
      <div className="space-y-6 pb-8">
        <PageHeader
          description="Las obligaciones viven dentro de un workspace real."
          eyebrow="obligations"
          title="Aun no hay un workspace activo"
        />
        <DataState
          description="Cuando exista un workspace con creditos o deudas, aqui veras solo los datos reales de la base."
          title="Sin obligaciones para mostrar"
        />
      </div>
    );
  }

  if (snapshotQuery.isLoading || !snapshot) {
    return (
      <div className="space-y-6 pb-8">
        <PageHeader
          description="Estamos reconstruyendo la cartera real desde obligations y obligation_events."
          eyebrow="obligations"
          title="Cargando obligaciones"
        />
        <DataState
          description="Consultando principales, pagos y pendientes desde Supabase."
          title="Leyendo cartera real"
        />
      </div>
    );
  }

  if (snapshotQuery.error) {
    return (
      <div className="space-y-6 pb-8">
        <PageHeader
          description="Intentamos leer las obligaciones y calcular el saldo pendiente real."
          eyebrow="obligations"
          title="No fue posible cargar la cartera"
        />
        <DataState
          description={getQueryErrorMessage(snapshotQuery.error, "No pudimos leer la informacion de obligaciones.")}
          title="Error al consultar obligaciones reales"
          tone="error"
        />
      </div>
    );
  }

  const totalPrincipal = snapshot.obligations.reduce(
    (total, obligation) => total + obligation.principalAmount,
    0,
  );
  const totalPending = snapshot.obligations.reduce(
    (total, obligation) => total + obligation.pendingAmount,
    0,
  );
  const receivables = snapshot.obligations.filter(
    (obligation) => obligation.direction === "receivable",
  ).length;
  const payables = snapshot.obligations.filter(
    (obligation) => obligation.direction === "payable",
  ).length;

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        actions={
          <>
            <Button disabled variant="ghost">
              Registrar pago
            </Button>
            <Button disabled>
              <Plus className="mr-2 h-4 w-4" />
              Nueva obligacion
            </Button>
          </>
        }
        description="Cartera real de creditos y deudas, con saldo pendiente y avance calculado a partir de los eventos registrados."
        eyebrow="obligations"
        title="Creditos y deudas"
      />

      {snapshot.obligations.length === 0 ? (
        <DataState
          description="Todavia no se registraron creditos o deudas en este workspace."
          title="No hay obligaciones reales"
        />
      ) : (
        <section className="grid gap-6 xl:grid-cols-2">
          {snapshot.obligations.map((obligation) => (
            <SurfaceCard
              action={
                <StatusBadge
                  status={obligation.direction}
                  tone={obligation.direction === "receivable" ? "success" : "danger"}
                />
              }
              description={obligation.counterparty}
              key={obligation.id}
              title={obligation.title}
            >
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="glass-panel-soft rounded-[26px] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-storm">Principal</p>
                    <p className="mt-2 font-display text-3xl font-semibold text-ink">
                      {formatCurrency(obligation.principalAmount, obligation.currencyCode)}
                    </p>
                  </div>
                  <div className="glass-panel-soft rounded-[26px] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-storm">Pendiente</p>
                    <p className="mt-2 font-display text-3xl font-semibold text-ink">
                      {formatCurrency(obligation.pendingAmount, obligation.currencyCode)}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3 text-sm text-storm">
                    <span>{obligation.installmentLabel}</span>
                    <span>{obligation.progressPercent}% completado</span>
                  </div>
                  <ProgressBar value={obligation.progressPercent} />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-storm">
                    Fecha objetivo - {obligation.dueDate ? formatDate(obligation.dueDate) : "Sin fecha"}
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-storm">
                    Estado - {obligation.status}
                  </div>
                </div>
              </div>
            </SurfaceCard>
          ))}
        </section>
      )}

      <SurfaceCard
        action={<Landmark className="h-5 w-5 text-gold" />}
        description="Resumen real de la cartera activa del workspace."
        title="Balance de obligaciones"
      >
        <div className="grid gap-4 md:grid-cols-4">
          <div className="glass-panel-soft rounded-[26px] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-storm">Principal total</p>
            <p className="mt-3 font-display text-3xl font-semibold text-ink">
              {formatCurrency(totalPrincipal, snapshot.workspace.baseCurrencyCode)}
            </p>
            <p className="mt-2 text-sm text-storm">Monto original acumulado.</p>
          </div>
          <div className="glass-panel-soft rounded-[26px] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-storm">Pendiente total</p>
            <p className="mt-3 font-display text-3xl font-semibold text-ink">
              {formatCurrency(totalPending, snapshot.workspace.baseCurrencyCode)}
            </p>
            <p className="mt-2 text-sm text-storm">Saldo aun no liquidado.</p>
          </div>
          <div className="glass-panel-soft rounded-[26px] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-storm">Me deben</p>
            <p className="mt-3 font-display text-3xl font-semibold text-ink">{receivables}</p>
            <p className="mt-2 text-sm text-storm">Obligaciones por cobrar.</p>
          </div>
          <div className="glass-panel-soft rounded-[26px] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-storm">Yo debo</p>
            <p className="mt-3 font-display text-3xl font-semibold text-ink">{payables}</p>
            <p className="mt-2 text-sm text-storm">Obligaciones por pagar.</p>
          </div>
        </div>

        <div className="mt-4 rounded-[26px] border border-white/10 bg-white/[0.03] p-4 text-sm leading-7 text-storm">
          <ArrowRightLeft className="mb-3 h-4 w-4 text-ember" />
          El pendiente y el porcentaje de avance se calculan en frontend usando los eventos reales
          de `obligation_events` hasta que conectemos una vista SQL agregada.
        </div>
      </SurfaceCard>
    </div>
  );
}
