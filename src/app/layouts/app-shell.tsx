import {
  Bell,
  BriefcaseBusiness,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Gauge,
  HandCoins,
  LayoutGrid,
  LogOut,
  Menu,
  Settings,
  Wallet,
  X,
} from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { Button } from "../../components/ui/button";
import { DataState } from "../../components/ui/data-state";
import { StatusBadge } from "../../components/ui/status-badge";
import { useAuth } from "../../modules/auth/auth-context";
import { useActiveWorkspace } from "../../modules/workspaces/use-active-workspace";
import {
  getQueryErrorMessage,
  useNotificationPreferencesQuery,
  useNotificationsQuery,
  useWorkspaceSnapshotQuery,
} from "../../services/queries/workspace-data";
import { isSupabaseConfigured } from "../../services/supabase/client";
import { useWorkspaceStore } from "../../stores/workspace-store";

const navigation = [
  { to: "/app", label: "Dashboard", icon: LayoutGrid },
  { to: "/app/accounts", label: "Cuentas", icon: Wallet },
  { to: "/app/movements", label: "Movimientos", icon: Gauge },
  { to: "/app/obligations", label: "Creditos y deudas", icon: HandCoins },
  { to: "/app/subscriptions", label: "Suscripciones", icon: CreditCard },
  { to: "/app/notifications", label: "Notificaciones", icon: Bell },
  { to: "/app/settings", label: "Configuracion", icon: Settings },
];

function buildInitials(value: string | null | undefined, fallback: string) {
  const initials = value
    ?.split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase() ?? "")
    .join("");

  return initials || fallback;
}

type IdentityAvatarProps = {
  initials: string;
  size?: "compact" | "regular";
  title?: string;
};

function IdentityAvatar({
  initials,
  size = "regular",
  title,
}: IdentityAvatarProps) {
  const shellClassName =
    size === "compact" ? "h-12 w-12 rounded-2xl" : "h-16 w-16 rounded-[24px]";
  const innerClassName =
    size === "compact" ? "rounded-[15px]" : "rounded-[19px]";
  const textClassName =
    size === "compact" ? "text-[1.05rem]" : "text-[1.12rem]";

  return (
    <div
      className={`group relative isolate flex shrink-0 items-center justify-center ${shellClassName}`}
      title={title}
    >
      <span
        className={`absolute inset-0 ${shellClassName} bg-gradient-to-br from-ember via-[#a8b9ff] to-pine shadow-[0_18px_42px_rgba(6,10,18,0.52),0_0_24px_rgba(107,228,197,0.16)] transition duration-300 ease-out group-hover:-translate-y-0.5 group-hover:scale-[1.035] group-hover:shadow-[0_28px_56px_rgba(6,10,18,0.66),0_0_34px_rgba(107,228,197,0.22)]`}
      />
      <span
        className={`absolute inset-[1px] ${shellClassName} bg-[radial-gradient(circle_at_26%_24%,rgba(255,255,255,0.42),transparent_36%),linear-gradient(160deg,rgba(255,255,255,0.18),rgba(255,255,255,0.02)_42%,rgba(5,9,16,0.16)_100%)] opacity-95`}
      />
      <span
        className={`absolute inset-[4px] ${innerClassName} border border-white/18 bg-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.24)]`}
      />
      <span
        className={`relative z-10 font-display font-semibold tracking-[-0.04em] text-void drop-shadow-[0_1px_0_rgba(255,255,255,0.14)] transition duration-300 ease-out group-hover:scale-[1.05] ${textClassName}`}
      >
        {initials}
      </span>
    </div>
  );
}

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const { profile, signOut, user } = useAuth();
  const isSidebarCollapsed = useWorkspaceStore((state) => state.isSidebarCollapsed);
  const toggleSidebarCollapsed = useWorkspaceStore((state) => state.toggleSidebarCollapsed);
  const {
    activeWorkspace,
    error,
    isFetching: isWorkspacesFetching,
    isLoading,
    setActiveWorkspaceId,
    workspaces,
  } = useActiveWorkspace();
  const workspaceSnapshotQuery = useWorkspaceSnapshotQuery(activeWorkspace, user?.id, profile);
  useNotificationsQuery(user?.id);
  useNotificationPreferencesQuery(user?.id);
  const currentUserName = profile?.fullName ?? user?.email?.split("@")[0] ?? "Usuario";
  const currentUserEmail = profile?.email ?? user?.email ?? "";
  const currentUserInitials = profile?.initials ?? buildInitials(currentUserName, "DM");
  const workspaceInitials = buildInitials(activeWorkspace?.name, "WS");
  const workspaceErrorMessage = error
    ? getQueryErrorMessage(error, "No se pudieron cargar tus workspaces.")
    : "";
  const shellStatus = !isSupabaseConfigured
    ? { label: "Supabase pendiente", tone: "warning" as const }
    : error
      ? { label: "Revision RLS", tone: "danger" as const }
      : activeWorkspace && (isWorkspacesFetching || workspaceSnapshotQuery.isFetching)
        ? { label: "Actualizando", tone: "info" as const }
      : activeWorkspace
        ? { label: "Datos en vivo", tone: "success" as const }
        : { label: "Sin workspace", tone: "warning" as const };
  const shellDescription = error
    ? workspaceErrorMessage
    : activeWorkspace
      ? activeWorkspace.description ||
        "Este workspace ya esta leyendo datos reales desde Supabase."
      : isLoading
        ? "Tu entorno financiero se esta preparando en segundo plano."
        : "No encontramos workspaces activos para esta cuenta todavia.";

  async function handleSignOut() {
    await signOut();
    navigate("/auth/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-glow text-ink">
      {sidebarOpen ? (
        <button
          aria-label="Cerrar menu"
          className="fixed inset-0 z-20 bg-void/55 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
          type="button"
        />
      ) : null}

      <div className="flex min-h-screen w-full gap-4 px-2 py-2 sm:px-3 sm:py-3 lg:gap-5 lg:px-4 lg:py-4">
        <aside
          className={`fixed inset-y-3 left-3 z-30 w-[296px] rounded-[30px] border border-white/10 bg-shell/95 px-5 py-6 text-ink shadow-haze backdrop-blur-2xl transition-[transform,width,padding] duration-300 lg:static lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-[120%]"
          } ${
            isSidebarCollapsed ? "lg:w-[118px] lg:px-4" : "lg:w-[296px] lg:px-5"
          }`}
        >
          <div className="flex h-full flex-col">
            <div
              className={`flex ${
                isSidebarCollapsed ? "items-center gap-3 lg:flex-col lg:justify-start" : "items-center justify-between gap-3"
              }`}
            >
              <div
                className={`${isSidebarCollapsed ? "hidden lg:flex" : "hidden"} h-14 w-14 items-center justify-center rounded-[22px] border border-white/10 bg-white/[0.04] font-display text-lg font-semibold tracking-[0.24em] text-ink`}
              >
                DM
              </div>

              <div className={isSidebarCollapsed ? "min-w-0 lg:hidden" : "min-w-0"}>
                <p className="text-xs uppercase tracking-[0.26em] text-storm/80">DarkMoney</p>
                <p className="mt-2 font-display text-3xl font-semibold">Workspace OS</p>
              </div>

              <button
                aria-label={isSidebarCollapsed ? "Expandir menu lateral" : "Colapsar menu lateral"}
                className="hidden h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-storm transition hover:bg-white/[0.09] hover:text-ink lg:inline-flex"
                onClick={() => toggleSidebarCollapsed()}
                title={isSidebarCollapsed ? "Expandir menu" : "Colapsar menu"}
                type="button"
              >
                {isSidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </button>

              <button
                aria-label="Cerrar menu"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-storm transition hover:bg-white/[0.06] hover:text-ink lg:hidden"
                onClick={() => setSidebarOpen(false)}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className={`glass-panel-soft mt-8 rounded-[28px] p-5 ${isSidebarCollapsed ? "lg:hidden" : ""}`}>
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-white/[0.06] p-3 ring-1 ring-white/10">
                  <BriefcaseBusiness className="h-5 w-5" />
                </div>
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.22em] text-storm/80">workspace activo</p>
                  <p className="font-display text-2xl font-semibold">
                    {activeWorkspace?.name ?? (isLoading ? "Tu workspace" : "Sin workspace")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {activeWorkspace ? (
                      <>
                        <StatusBadge status={activeWorkspace.kind} tone="neutral" />
                        <StatusBadge status={activeWorkspace.role} tone="info" />
                      </>
                    ) : null}
                  </div>
                </div>
              </div>

              <label className="mt-5 block text-xs uppercase tracking-[0.22em] text-storm/80">
                Cambiar workspace
              </label>
              <select
                className="field-dark mt-2"
                disabled={!workspaces.length}
                onChange={(event) => setActiveWorkspaceId(Number(event.target.value))}
                value={activeWorkspace?.id ?? ""}
              >
                {!workspaces.length ? (
                  <option
                    className="bg-shell text-ink"
                    value=""
                  >
                    {isLoading ? "Preparando..." : "Sin workspaces"}
                  </option>
                ) : (
                  workspaces.map((workspace) => (
                    <option
                      className="bg-shell text-ink"
                      key={workspace.id}
                      value={workspace.id}
                    >
                      {workspace.name}
                    </option>
                  ))
                )}
              </select>
              {error ? (
                <p className="mt-3 text-sm leading-6 text-rosewood">{workspaceErrorMessage}</p>
              ) : null}
            </div>

            <div
              className={`${isSidebarCollapsed ? "hidden lg:flex" : "hidden"} glass-panel-soft mt-8 flex-col items-center gap-3 rounded-[30px] px-3 py-4 text-center`}
              title={
                activeWorkspace
                  ? `${activeWorkspace.name} · ${activeWorkspace.kind} · ${activeWorkspace.role}`
                  : "Sin workspace activo"
              }
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-gradient-to-br from-ember to-pine font-display text-xl font-semibold text-void shadow-lg">
                {workspaceInitials}
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-storm/80">
                {activeWorkspace?.kind ?? "workspace"}
              </p>
              <div className="flex items-center justify-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    activeWorkspace ? "bg-pine shadow-[0_0_16px_rgba(107,228,197,0.45)]" : "bg-storm/45"
                  }`}
                />
                <span className="text-[10px] uppercase tracking-[0.18em] text-storm/70">
                  {activeWorkspace?.role ?? "ready"}
                </span>
              </div>
            </div>

            <nav className="mt-8 space-y-2">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    className={({ isActive }) =>
                      `group flex items-center gap-3 text-sm font-medium transition ${
                        isActive
                          ? "bg-white/[0.08] text-ink ring-1 ring-white/12"
                          : "text-storm hover:bg-white/[0.04] hover:text-ink"
                      } ${
                        isSidebarCollapsed
                          ? "rounded-[20px] px-4 py-3 lg:mx-auto lg:h-14 lg:w-14 lg:justify-center lg:gap-0 lg:px-0 lg:py-0"
                          : "rounded-2xl px-4 py-3"
                      }`
                    }
                    aria-label={isSidebarCollapsed ? item.label : undefined}
                    key={item.to}
                    onClick={() => setSidebarOpen(false)}
                    to={item.to}
                    title={isSidebarCollapsed ? item.label : undefined}
                  >
                    <Icon className={isSidebarCollapsed ? "h-5 w-5" : "h-4 w-4"} />
                    <span className={isSidebarCollapsed ? "lg:sr-only" : ""}>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>

            <div className={`mt-auto rounded-[28px] border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.03] p-5 backdrop-blur-2xl ${isSidebarCollapsed ? "lg:hidden" : ""}`}>
              <p className="text-xs uppercase tracking-[0.22em] text-storm/80">usuario activo</p>
              <div className="mt-4 flex items-center gap-3">
                <IdentityAvatar
                  initials={currentUserInitials}
                  size="compact"
                  title={currentUserName}
                />
                <div>
                  <p className="font-medium">{currentUserName}</p>
                  <p className="text-sm text-storm">{currentUserEmail}</p>
                </div>
              </div>
              <button
                className="mt-5 inline-flex items-center gap-2 text-sm text-storm underline decoration-white/18 underline-offset-4 transition hover:text-ink"
                onClick={() => void handleSignOut()}
                type="button"
              >
                <LogOut className="h-4 w-4" />
                Cerrar sesion
              </button>
            </div>

            <div className={`${isSidebarCollapsed ? "hidden lg:flex" : "hidden"} mt-auto flex-col items-center gap-3 rounded-[28px] border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.03] px-3 py-4 backdrop-blur-2xl`}>
              <IdentityAvatar
                initials={currentUserInitials}
                size="regular"
                title={currentUserName}
              />
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-storm/70">
                perfil
              </p>
              <button
                aria-label="Cerrar sesion"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-storm transition hover:bg-white/[0.08] hover:text-ink"
                onClick={() => void handleSignOut()}
                title="Cerrar sesion"
                type="button"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-6 lg:ml-0">
          <header className="glass-panel-strong rounded-[30px] p-4">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <button
                  aria-label="Abrir menu"
                  className="rounded-2xl border border-white/10 bg-white/[0.05] p-3 text-ink lg:hidden"
                  onClick={() => setSidebarOpen(true)}
                  type="button"
                >
                  <Menu className="h-5 w-5" />
                </button>

                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-storm/90">workspace activo</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <h1 className="font-display text-3xl font-semibold">
                      {activeWorkspace?.name ?? (isLoading ? "Tu workspace" : "Sin workspace")}
                    </h1>
                    <StatusBadge
                      className={shellStatus.label === "Actualizando" ? "animate-soft-pulse" : ""}
                      status={shellStatus.label}
                      tone={shellStatus.tone}
                    />
                  </div>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-storm">
                    {shellDescription}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  disabled={!activeWorkspace}
                  variant="ghost"
                >
                  Nuevo gasto
                </Button>
                <Button
                  disabled={!activeWorkspace}
                  variant="secondary"
                >
                  Nuevo ingreso
                </Button>
                <Button disabled={!activeWorkspace}>Transferencia</Button>
              </div>
            </div>
            {!activeWorkspace && !isLoading ? (
              <div className="mt-5">
                <DataState
                  description={
                    error
                      ? workspaceErrorMessage
                      : "Cuando existan workspaces o se complete el bootstrap automatico del perfil, el resto de modulos cargara informacion real aqui."
                  }
                  title={error ? "No pudimos leer tu acceso real" : "No hay un workspace activo todavia"}
                  tone={error ? "error" : "neutral"}
                />
              </div>
            ) : null}
          </header>

          <Outlet />
        </div>
      </div>
    </div>
  );
}
