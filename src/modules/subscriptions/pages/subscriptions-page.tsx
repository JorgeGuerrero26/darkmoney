import { CalendarClock, CheckCircle2, Plus } from "lucide-react";

import { Button } from "../../../components/ui/button";
import { DataState } from "../../../components/ui/data-state";
import { PageHeader } from "../../../components/ui/page-header";
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

export function SubscriptionsPage() {
  const { profile, user } = useAuth();
  const { activeWorkspace, error: workspaceError, isLoading: isWorkspacesLoading } = useActiveWorkspace();
  const snapshotQuery = useWorkspaceSnapshotQuery(activeWorkspace, user?.id, profile);
  const snapshot = snapshotQuery.data;

  if (!activeWorkspace && (isWorkspacesLoading || snapshotQuery.isLoading)) {
    return (
      <div className="space-y-6 pb-8">
        <PageHeader
          description="Estamos consultando las suscripciones reales del workspace."
          eyebrow="subscriptions"
          title="Cargando suscripciones"
        />
        <DataState
          description="Buscando el workspace activo y leyendo la tabla subscriptions."
          title="Sincronizando pagos recurrentes"
        />
      </div>
    );
  }

  if (workspaceError) {
    return (
      <div className="space-y-6 pb-8">
        <PageHeader
          description="Las suscripciones dependen del acceso correcto al workspace activo."
          eyebrow="subscriptions"
          title="Suscripciones no disponibles"
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
          description="Para mostrar pagos recurrentes necesitamos un workspace real."
          eyebrow="subscriptions"
          title="Aun no hay un workspace activo"
        />
        <DataState
          description="Cuando exista un workspace con suscripciones, aqui veras solo informacion real de la base."
          title="Sin suscripciones para mostrar"
        />
      </div>
    );
  }

  if (snapshotQuery.isLoading || !snapshot) {
    return (
      <div className="space-y-6 pb-8">
        <PageHeader
          description="Estamos leyendo los pagos recurrentes y sus proximos vencimientos."
          eyebrow="subscriptions"
          title="Cargando suscripciones"
        />
        <DataState
          description="Consultando proveedor, cuenta asociada, monto y proximo pago desde Supabase."
          title="Leyendo suscripciones reales"
        />
      </div>
    );
  }

  if (snapshotQuery.error) {
    return (
      <div className="space-y-6 pb-8">
        <PageHeader
          description="Intentamos leer la tabla subscriptions del workspace activo."
          eyebrow="subscriptions"
          title="No fue posible cargar las suscripciones"
        />
        <DataState
          description={getQueryErrorMessage(snapshotQuery.error, "No pudimos leer la informacion de suscripciones.")}
          title="Error al consultar suscripciones reales"
          tone="error"
        />
      </div>
    );
  }

  const dueSoonCount = snapshot.subscriptions.filter((subscription) => {
    const differenceInMs =
      new Date(subscription.nextDueDate).getTime() - new Date().setHours(0, 0, 0, 0);
    const differenceInDays = differenceInMs / 86_400_000;

    return differenceInDays >= 0 && differenceInDays <= 7;
  }).length;
  const autoCreatedCount = snapshot.subscriptions.filter(
    (subscription) => subscription.autoCreateMovement,
  ).length;
  const nextSubscription = snapshot.subscriptions[0] ?? null;

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        actions={
          <>
            <Button disabled variant="ghost">
              Calendario
            </Button>
            <Button disabled>
              <Plus className="mr-2 h-4 w-4" />
              Nueva suscripcion
            </Button>
          </>
        }
        description="Vista real de pagos recurrentes con proveedor, cuenta asociada, monto y proximo vencimiento."
        eyebrow="subscriptions"
        title="Suscripciones"
      />

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SurfaceCard
          action={<StatusBadge status={`${snapshot.subscriptions.length} registradas`} tone="success" />}
          description="Cada tarjeta representa una suscripcion real de la tabla subscriptions."
          title="Pagos recurrentes"
        >
          {snapshot.subscriptions.length === 0 ? (
            <DataState
              description="Todavia no hay pagos recurrentes registrados para este workspace."
              title="Sin suscripciones reales"
            />
          ) : (
            <div className="space-y-3">
              {snapshot.subscriptions.map((subscription) => (
                <article
                  className="glass-panel-soft rounded-[28px] p-5"
                  key={subscription.id}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium text-ink">{subscription.name}</p>
                      <p className="mt-1 text-sm text-storm">
                        {subscription.vendor}
                        {subscription.accountName ? ` - ${subscription.accountName}` : ""}
                      </p>
                    </div>
                    <StatusBadge
                      status={subscription.status}
                      tone={subscription.status === "active" ? "success" : "warning"}
                    />
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-storm">Monto</p>
                      <p className="mt-2 text-sm font-medium text-ink">
                        {formatCurrency(subscription.amount, subscription.currencyCode)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-storm">Proximo pago</p>
                      <p className="mt-2 text-sm font-medium text-ink">
                        {formatDate(subscription.nextDueDate)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-storm">Recordatorio</p>
                      <p className="mt-2 text-sm font-medium text-ink">
                        {subscription.remindDaysBefore} dias antes
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </SurfaceCard>

        <SurfaceCard
          action={<CalendarClock className="h-5 w-5 text-gold" />}
          description="Calendario simplificado con los proximos vencimientos reales del workspace."
          title="Radar de vencimientos"
        >
          {snapshot.subscriptions.length === 0 ? (
            <DataState
              description="Cuando registres una suscripcion, aqui veras el siguiente cobro en orden cronologico."
              title="Sin calendario todavia"
            />
          ) : (
            <>
              <div className="space-y-3">
                {snapshot.subscriptions.map((subscription) => (
                  <div
                    className="glass-panel-soft flex items-center justify-between gap-3 rounded-[26px] p-4"
                    key={subscription.id}
                  >
                    <div>
                      <p className="font-medium text-ink">{subscription.name}</p>
                      <p className="mt-1 text-sm text-storm">{formatDate(subscription.nextDueDate)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-ink">
                        {formatCurrency(subscription.amount, subscription.currencyCode)}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-storm">
                        {subscription.frequency}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-[26px] border border-pine/15 bg-pine/10 p-5">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-1 h-5 w-5 text-pine" />
                  <div>
                    <p className="font-medium text-ink">Resumen real del modulo</p>
                    <p className="mt-2 text-sm leading-7 text-storm">
                      {dueSoonCount} vencen en los proximos 7 dias, {autoCreatedCount} tienen
                      auto-creacion habilitada y el siguiente cargo es{" "}
                      {nextSubscription
                        ? `${nextSubscription.name} el ${formatDate(nextSubscription.nextDueDate)}`
                        : "sin fecha registrada"}
                      .
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </SurfaceCard>
      </section>
    </div>
  );
}
