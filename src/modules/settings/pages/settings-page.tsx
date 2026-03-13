import { BellDot, Briefcase, ShieldCheck, Tag } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";

import { Button } from "../../../components/ui/button";
import { DataState } from "../../../components/ui/data-state";
import { PageHeader } from "../../../components/ui/page-header";
import { StatusBadge } from "../../../components/ui/status-badge";
import { SurfaceCard } from "../../../components/ui/surface-card";
import { useAuth } from "../../auth/auth-context";
import { useActiveWorkspace } from "../../workspaces/use-active-workspace";
import {
  getQueryErrorMessage,
  useNotificationPreferencesQuery,
  useSaveNotificationPreferencesMutation,
  useWorkspaceSnapshotQuery,
} from "../../../services/queries/workspace-data";

export function SettingsPage() {
  const { profile, saveProfile, user } = useAuth();
  const { activeWorkspace, error: workspaceError, workspaces } = useActiveWorkspace();
  const preferencesQuery = useNotificationPreferencesQuery(user?.id);
  const savePreferencesMutation = useSaveNotificationPreferencesMutation(user?.id);
  const snapshotQuery = useWorkspaceSnapshotQuery(activeWorkspace, user?.id, profile);
  const [fullName, setFullName] = useState(profile?.fullName ?? "");
  const [baseCurrencyCode, setBaseCurrencyCode] = useState(profile?.baseCurrencyCode ?? "USD");
  const [timezone, setTimezone] = useState(profile?.timezone ?? "America/Lima");
  const [inAppEnabled, setInAppEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!profile) {
      return;
    }

    setFullName(profile.fullName);
    setBaseCurrencyCode(profile.baseCurrencyCode);
    setTimezone(profile.timezone);
  }, [profile]);

  useEffect(() => {
    if (!preferencesQuery.data) {
      return;
    }

    setInAppEnabled(preferencesQuery.data.inAppEnabled);
    setEmailEnabled(preferencesQuery.data.emailEnabled);
    setPushEnabled(preferencesQuery.data.pushEnabled);
  }, [preferencesQuery.data]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedbackMessage("");
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      await saveProfile({
        fullName,
        baseCurrencyCode,
        timezone,
      });

      await savePreferencesMutation.mutateAsync({
        inAppEnabled,
        emailEnabled,
        pushEnabled,
      });

      setFeedbackMessage("Configuracion actualizada correctamente.");
    } catch (error) {
      setErrorMessage(
        getQueryErrorMessage(error, "No pudimos guardar la configuracion real del usuario."),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const isSaving = isSubmitting || savePreferencesMutation.isPending;

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        actions={
          <Button
            form="settings-form"
            disabled={isSaving}
            type="submit"
          >
            {isSaving ? "Guardando..." : "Guardar cambios"}
          </Button>
        }
        description="Configuracion real del usuario y del contexto financiero activo."
        eyebrow="settings"
        title="Configuracion"
      />

      <form
        className="space-y-6"
        id="settings-form"
        onSubmit={(event) => void handleSubmit(event)}
      >
        <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <SurfaceCard
            action={<Briefcase className="h-5 w-5 text-gold" />}
            description="Datos reales del perfil autenticado."
            title="Perfil"
          >
            <div className="grid gap-4">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-ink">Nombre completo</span>
                <input
                  className="field-dark"
                  onChange={(event) => setFullName(event.target.value)}
                  type="text"
                  value={fullName}
                />
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-ink">Moneda base</span>
                  <input
                    className="field-dark"
                    onChange={(event) => setBaseCurrencyCode(event.target.value.toUpperCase())}
                    type="text"
                    value={baseCurrencyCode}
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-ink">Zona horaria</span>
                  <input
                    className="field-dark"
                    onChange={(event) => setTimezone(event.target.value)}
                    type="text"
                    value={timezone}
                  />
                </label>
              </div>
            </div>
          </SurfaceCard>

          <SurfaceCard
            action={<BellDot className="h-5 w-5 text-ember" />}
            description="Preferencias reales almacenadas en notification_preferences."
            title="Preferencias"
          >
            {preferencesQuery.isLoading ? (
              <DataState
                description="Consultando las preferencias reales del usuario."
                title="Cargando preferencias"
              />
            ) : preferencesQuery.error ? (
              <DataState
                description={getQueryErrorMessage(
                  preferencesQuery.error,
                  "No pudimos leer tus preferencias de notificacion.",
                )}
                title="No fue posible cargar las preferencias"
                tone="error"
              />
            ) : (
              <div className="grid gap-3">
                <label className="glass-panel-soft flex items-center justify-between gap-3 rounded-[24px] px-4 py-4">
                  <span className="text-sm text-ink">Notificaciones in-app</span>
                  <input
                    checked={inAppEnabled}
                    className="h-5 w-5 rounded border-ink/10 text-pine"
                    onChange={(event) => setInAppEnabled(event.target.checked)}
                    type="checkbox"
                  />
                </label>
                <label className="glass-panel-soft flex items-center justify-between gap-3 rounded-[24px] px-4 py-4">
                  <span className="text-sm text-ink">Recordatorios por email</span>
                  <input
                    checked={emailEnabled}
                    className="h-5 w-5 rounded border-ink/10 text-pine"
                    onChange={(event) => setEmailEnabled(event.target.checked)}
                    type="checkbox"
                  />
                </label>
                <label className="glass-panel-soft flex items-center justify-between gap-3 rounded-[24px] px-4 py-4">
                  <span className="text-sm text-ink">Push</span>
                  <input
                    checked={pushEnabled}
                    className="h-5 w-5 rounded border-ink/10 text-pine"
                    onChange={(event) => setPushEnabled(event.target.checked)}
                    type="checkbox"
                  />
                </label>
              </div>
            )}
          </SurfaceCard>
        </section>

        {errorMessage ? (
          <DataState
            description={errorMessage}
            title="No pudimos guardar los cambios"
            tone="error"
          />
        ) : null}
        {feedbackMessage ? (
          <DataState
            description={feedbackMessage}
            title="Configuracion actualizada"
            tone="success"
          />
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <SurfaceCard
            action={<ShieldCheck className="h-5 w-5 text-pine" />}
            description="Informacion real del workspace actualmente seleccionado."
            title="Workspace activo"
          >
            {workspaceError ? (
              <DataState
                description={getQueryErrorMessage(
                  workspaceError,
                  "No pudimos leer el workspace activo del usuario.",
                )}
                title="No fue posible cargar el workspace"
                tone="error"
              />
            ) : activeWorkspace ? (
              <div className="space-y-4">
                <div className="glass-panel-soft rounded-[26px] p-4">
                  <p className="font-medium text-ink">{activeWorkspace.name}</p>
                  <p className="mt-1 text-sm text-storm">
                    {activeWorkspace.description || "Sin descripcion registrada."}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <StatusBadge status={activeWorkspace.kind} tone="info" />
                    <StatusBadge status={activeWorkspace.role} tone="success" />
                    <StatusBadge
                      status={`${workspaces.length} workspaces`}
                      tone="neutral"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button disabled variant="ghost">
                    Editar workspace
                  </Button>
                  <Button disabled>Invitar miembro</Button>
                </div>
              </div>
            ) : (
              <DataState
                description="Todavia no existe un workspace activo para esta sesion."
                title="Sin workspace activo"
              />
            )}
          </SurfaceCard>

          <SurfaceCard
            action={<Tag className="h-5 w-5 text-gold" />}
            description="Conteos reales de catalogos y soporte del workspace."
            title="Catalogos del workspace"
          >
            {!activeWorkspace ? (
              <DataState
                description="Los catalogos se mostraran cuando exista un workspace seleccionado."
                title="Sin contexto de workspace"
              />
            ) : snapshotQuery.isLoading ? (
              <DataState
                description="Consultando categorias y contrapartes reales del workspace."
                title="Cargando catalogos"
              />
            ) : snapshotQuery.error ? (
              <DataState
                description={getQueryErrorMessage(
                  snapshotQuery.error,
                  "No pudimos leer los catalogos del workspace.",
                )}
                title="No fue posible cargar los catalogos"
                tone="error"
              />
            ) : (
              <div className="grid gap-4">
                <div className="glass-panel-soft rounded-[24px] p-4 text-sm leading-7 text-storm">
                  Categorias registradas:{" "}
                  <span className="font-medium text-ink">
                    {snapshotQuery.data?.catalogs.categoriesCount ?? 0}
                  </span>
                </div>
                <div className="glass-panel-soft rounded-[24px] p-4 text-sm leading-7 text-storm">
                  Contrapartes registradas:{" "}
                  <span className="font-medium text-ink">
                    {snapshotQuery.data?.catalogs.counterpartiesCount ?? 0}
                  </span>
                </div>
                <div className="glass-panel-soft rounded-[24px] p-4 text-sm leading-7 text-storm">
                  Cuentas del workspace:{" "}
                  <span className="font-medium text-ink">
                    {snapshotQuery.data?.accounts.length ?? 0}
                  </span>
                </div>
              </div>
            )}
          </SurfaceCard>
        </section>
      </form>
    </div>
  );
}
