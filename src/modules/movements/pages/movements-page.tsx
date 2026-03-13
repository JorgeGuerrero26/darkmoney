import { Filter, Repeat, Sparkles } from "lucide-react";

import { Button } from "../../../components/ui/button";
import { DataState } from "../../../components/ui/data-state";
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

export function MovementsPage() {
  const { profile, user } = useAuth();
  const { activeWorkspace, error: workspaceError, isLoading: isWorkspacesLoading } = useActiveWorkspace();
  const snapshotQuery = useWorkspaceSnapshotQuery(activeWorkspace, user?.id, profile);
  const snapshot = snapshotQuery.data;

  if (!activeWorkspace && (isWorkspacesLoading || snapshotQuery.isLoading)) {
    return (
      <div className="space-y-6 pb-8">
        <PageHeader
          description="Estamos consultando el libro mayor real del workspace."
          eyebrow="movements"
          title="Cargando movimientos"
        />
        <DataState
          description="Buscando el workspace activo y leyendo la tabla movements."
          title="Sincronizando movimientos reales"
        />
      </div>
    );
  }

  if (workspaceError) {
    return (
      <div className="space-y-6 pb-8">
        <PageHeader
          description="Los movimientos dependen del acceso correcto al workspace seleccionado."
          eyebrow="movements"
          title="Movimientos no disponibles"
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
          description="Para mostrar movimientos necesitamos un workspace real."
          eyebrow="movements"
          title="Aun no hay un workspace activo"
        />
        <DataState
          description="Cuando exista un workspace con datos, aqui veras solo el ledger real de la base de datos."
          title="Sin movimientos para mostrar"
        />
      </div>
    );
  }

  if (snapshotQuery.isLoading || !snapshot) {
    return (
      <div className="space-y-6 pb-8">
        <PageHeader
          description="Estamos cargando las operaciones reales del workspace."
          eyebrow="movements"
          title="Cargando movimientos"
        />
        <DataState
          description="Consultando montos, cuentas origen y destino desde Supabase."
          title="Leyendo libro mayor"
        />
      </div>
    );
  }

  if (snapshotQuery.error) {
    return (
      <div className="space-y-6 pb-8">
        <PageHeader
          description="Intentamos leer la tabla movements y resolver cuentas, categorias y contrapartes."
          eyebrow="movements"
          title="No fue posible cargar los movimientos"
        />
        <DataState
          description={getQueryErrorMessage(snapshotQuery.error, "No pudimos leer la informacion de movimientos.")}
          title="Error al consultar movimientos reales"
          tone="error"
        />
      </div>
    );
  }

  const transferCount = snapshot.movements.filter((movement) => movement.movementType === "transfer").length;
  const latestMovement = snapshot.movements[0] ?? null;

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        actions={
          <>
            <Button disabled variant="ghost">
              <Filter className="mr-2 h-4 w-4" />
              Filtros
            </Button>
            <Button disabled>
              <Repeat className="mr-2 h-4 w-4" />
              Nuevo movimiento
            </Button>
          </>
        }
        description="Libro de movimientos real, con estado operativo, cuentas involucradas y trazabilidad temporal."
        eyebrow="movements"
        title="Libro de movimientos"
      />

      <SurfaceCard
        action={<StatusBadge status={`${snapshot.movements.length} visibles`} tone="neutral" />}
        description="Todos los registros listados aqui salen directamente de la tabla movements del workspace activo."
        title="Actividad financiera"
      >
        {snapshot.movements.length === 0 ? (
          <DataState
            description="Todavia no hay operaciones financieras registradas para este workspace."
            title="Sin movimientos reales"
          />
        ) : (
          <div className="space-y-3">
            {snapshot.movements.map((movement) => (
              <article
                className="glass-panel-soft rounded-[28px] p-5"
                key={movement.id}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="font-medium text-ink">{movement.description}</p>
                      <StatusBadge
                        status={movement.movementType}
                        tone={movement.movementType === "expense" ? "danger" : "success"}
                      />
                      <StatusBadge
                        status={movement.status}
                        tone={movement.status === "posted" ? "success" : "warning"}
                      />
                    </div>
                    <p className="text-sm text-storm">
                      {movement.category} - {movement.counterparty}
                    </p>
                    <p className="text-xs uppercase tracking-[0.18em] text-storm">
                      {formatDateTime(movement.occurredAt)}
                    </p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-storm">Origen</p>
                      <p className="mt-2 text-sm font-medium text-ink">
                        {movement.sourceAccountName ?? "Sin salida"}
                      </p>
                      <p className="mt-1 text-sm text-storm">
                        {movement.sourceAmount
                          ? formatCurrency(
                              movement.sourceAmount,
                              movement.sourceCurrencyCode ?? snapshot.workspace.baseCurrencyCode,
                            )
                          : "-"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-storm">Destino</p>
                      <p className="mt-2 text-sm font-medium text-ink">
                        {movement.destinationAccountName ?? "Sin destino"}
                      </p>
                      <p className="mt-1 text-sm text-storm">
                        {movement.destinationAmount
                          ? formatCurrency(
                              movement.destinationAmount,
                              movement.destinationCurrencyCode ?? snapshot.workspace.baseCurrencyCode,
                            )
                          : "-"}
                      </p>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </SurfaceCard>

      <SurfaceCard
        action={<Sparkles className="h-5 w-5 text-gold" />}
        description="Resumen operativo armado a partir de los movimientos reales del workspace."
        title="Resumen del ledger"
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div className="glass-panel-soft rounded-[26px] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-storm">Movimientos posted</p>
            <p className="mt-3 font-display text-3xl font-semibold text-ink">
              {snapshot.metrics.postedCount}
            </p>
            <p className="mt-2 text-sm text-storm">Ya impactan balances y reportes.</p>
          </div>
          <div className="glass-panel-soft rounded-[26px] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-storm">Transferencias</p>
            <p className="mt-3 font-display text-3xl font-semibold text-ink">{transferCount}</p>
            <p className="mt-2 text-sm text-storm">Movimientos internos entre cuentas.</p>
          </div>
          <div className="glass-panel-soft rounded-[26px] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-storm">Ultimo registro</p>
            <p className="mt-3 text-lg font-medium text-ink">
              {latestMovement ? formatDateTime(latestMovement.occurredAt) : "Sin actividad"}
            </p>
            <p className="mt-2 text-sm text-storm">
              {latestMovement ? latestMovement.description : "Aun no hay movimientos registrados."}
            </p>
          </div>
        </div>
      </SurfaceCard>
    </div>
  );
}
