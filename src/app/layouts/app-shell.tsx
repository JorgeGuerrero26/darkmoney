import {
  Bell,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Gauge,
  HandCoins,
  LayoutGrid,
  LogOut,
  Menu,
  PiggyBank,
  Search,
  Settings,
  Shapes,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { BrandLogo } from "../../components/ui/brand-logo";
import { Button } from "../../components/ui/button";
import { DataState } from "../../components/ui/data-state";
import { StatusBadge } from "../../components/ui/status-badge";
import { useAuth } from "../../modules/auth/auth-context";
import {
  QuickMovementDialog,
  type QuickMovementKind,
} from "../../modules/movements/components/quick-movement-dialog";
import { useNotificationInbox } from "../../modules/notifications/use-notification-inbox";
import { useActiveWorkspace } from "../../modules/workspaces/use-active-workspace";
import {
  getQueryErrorMessage,
  useNotificationPreferencesQuery,
  useNotificationsQuery,
  useWorkspaceSnapshotQuery,
} from "../../services/queries/workspace-data";
import { isSupabaseConfigured } from "../../services/supabase/client";
import { useWorkspaceStore } from "../../stores/workspace-store";
import type { Workspace } from "../../types/domain";

const navigation = [
  { to: "/app", label: "Dashboard", icon: LayoutGrid },
  { to: "/app/accounts", label: "Cuentas", icon: Wallet },
  { to: "/app/movements", label: "Movimientos", icon: Gauge },
  { to: "/app/categories", label: "Categorias", icon: Shapes },
  { to: "/app/budgets", label: "Presupuestos", icon: PiggyBank },
  { to: "/app/contacts", label: "Contactos", icon: Users },
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

function getWorkspaceKindLabel(kind: Workspace["kind"]) {
  return kind === "shared" ? "Compartido" : "Personal";
}

function getWorkspaceRoleLabel(role: Workspace["role"]) {
  switch (role) {
    case "owner":
      return "Propietario";
    case "admin":
      return "Administrador";
    case "viewer":
      return "Solo lectura";
    default:
      return "Miembro";
  }
}

function getWorkspaceAccentColor(kind: Workspace["kind"]) {
  return kind === "shared" ? "#4566d6" : "#1b6a58";
}

function useWorkspacePickerPanel(isOpen: boolean, onClose: () => void) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        onClose();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen, onClose]);

  return containerRef;
}

function WorkspacePicker({
  activeWorkspaceId,
  disabled = false,
  isLoading,
  onChange,
  workspaces,
}: {
  activeWorkspaceId: number | null;
  disabled?: boolean;
  isLoading: boolean;
  onChange: (workspaceId: number) => void;
  workspaces: Workspace[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useWorkspacePickerPanel(isOpen, () => setIsOpen(false));
  const selectedWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null,
    [activeWorkspaceId, workspaces],
  );
  const filteredWorkspaces = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return workspaces;
    }

    return workspaces.filter((workspace) =>
      `${workspace.name} ${workspace.kind} ${workspace.role} ${workspace.baseCurrencyCode}`
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [query, workspaces]);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
    }
  }, [isOpen]);

  return (
    <div className={`relative ${isOpen ? "z-50" : "z-10"}`} ref={containerRef}>
      <button
        className={`flex min-h-[5.1rem] w-full items-start justify-between gap-3 rounded-[24px] border border-white/10 bg-[#101725] px-4 py-3.5 text-left text-ink shadow-[0_20px_45px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.03)] transition duration-200 hover:border-white/14 hover:bg-[#131c2b] ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
        disabled={disabled}
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        type="button"
      >
        <span className="flex min-w-0 items-start gap-3">
          <span
            className="mt-0.5 flex h-10 min-w-[3rem] shrink-0 items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.04] px-3 text-sm font-semibold text-ink"
            style={{
              backgroundColor: selectedWorkspace ? `${getWorkspaceAccentColor(selectedWorkspace.kind)}22` : undefined,
              borderColor: selectedWorkspace ? `${getWorkspaceAccentColor(selectedWorkspace.kind)}55` : undefined,
              color: selectedWorkspace ? "#fff" : undefined,
            }}
          >
            {selectedWorkspace ? buildInitials(selectedWorkspace.name, "WS") : "WS"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block whitespace-normal text-sm font-semibold leading-6 text-ink">
              {selectedWorkspace?.name ?? (isLoading ? "Preparando..." : "Sin workspace")}
            </span>
            <span className="mt-1 block whitespace-normal text-xs leading-5 text-storm">
              {selectedWorkspace
                ? `${getWorkspaceKindLabel(selectedWorkspace.kind)} · ${getWorkspaceRoleLabel(selectedWorkspace.role)} · Base ${selectedWorkspace.baseCurrencyCode}`
                : "Cambia rapido entre espacios personales y compartidos."}
            </span>
          </span>
        </span>
        <ChevronDown className={`mt-2 h-4 w-4 shrink-0 text-storm transition ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen ? (
        <div className="animate-rise-in absolute left-0 right-0 top-[calc(100%+0.65rem)] z-50 rounded-[30px] border border-white/10 bg-[#0a111b] p-3 shadow-[0_30px_80px_rgba(0,0,0,0.62)]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-storm" />
            <input
              autoFocus
              className="w-full rounded-[22px] border border-white/10 bg-[#111a28] py-3.5 pl-11 pr-4 text-sm text-ink outline-none transition placeholder:text-storm/70 focus:border-pine/25 focus:shadow-[0_0_0_4px_rgba(107,228,197,0.08)]"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar workspace..."
              type="text"
              value={query}
            />
          </div>

          <div className="mt-3 max-h-72 space-y-1 overflow-y-auto pr-1">
            {filteredWorkspaces.length ? (
              filteredWorkspaces.map((workspace) => {
                const isSelected = workspace.id === activeWorkspaceId;
                const accentColor = getWorkspaceAccentColor(workspace.kind);

                return (
                  <button
                    className="flex w-full items-start justify-between gap-3 rounded-[24px] border border-white/5 bg-[#0f1826] px-4 py-3.5 text-left transition duration-200 hover:border-white/12 hover:bg-[#122032]"
                    key={workspace.id}
                    onClick={() => {
                      onChange(workspace.id);
                      setIsOpen(false);
                    }}
                    type="button"
                  >
                    <span className="flex min-w-0 items-start gap-3">
                      <span
                        className="mt-0.5 flex h-11 min-w-[3rem] shrink-0 items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.04] px-3 text-sm font-semibold text-ink"
                        style={{
                          backgroundColor: `${accentColor}22`,
                          borderColor: `${accentColor}55`,
                          color: "#fff",
                        }}
                      >
                        {buildInitials(workspace.name, "WS")}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block whitespace-normal font-medium leading-6 text-ink">
                          {workspace.name}
                        </span>
                        <span className="mt-1 block whitespace-normal text-xs leading-5 text-storm">
                          {getWorkspaceKindLabel(workspace.kind)} · {getWorkspaceRoleLabel(workspace.role)} · Base {workspace.baseCurrencyCode}
                        </span>
                      </span>
                    </span>
                    {isSelected ? <Check className="h-4 w-4 shrink-0 text-pine" /> : null}
                  </button>
                );
              })
            ) : (
              <div className="rounded-[22px] border border-white/8 bg-[#0f1826] px-4 py-5 text-sm text-storm">
                No encontramos workspaces con ese nombre.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isQuickMovementOpen, setIsQuickMovementOpen] = useState(false);
  const [quickMovementKind, setQuickMovementKind] = useState<QuickMovementKind>("expense");
  const [quickMovementFeedback, setQuickMovementFeedback] = useState("");
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
  const notificationsQuery = useNotificationsQuery(user?.id);
  const notificationPreferencesQuery = useNotificationPreferencesQuery(user?.id);
  const notificationInbox = useNotificationInbox({
    databaseNotifications: notificationsQuery.data ?? [],
    snapshot: workspaceSnapshotQuery.data,
    workspaceName: activeWorkspace?.name,
  });
  const unreadNotificationsCount =
    notificationPreferencesQuery.data?.inAppEnabled === false ? 0 : notificationInbox.unreadCount;
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

  function openQuickMovement(kind: QuickMovementKind) {
    if (!activeWorkspace || !user?.id || !workspaceSnapshotQuery.data) {
      return;
    }

    setQuickMovementFeedback("");
    setQuickMovementKind(kind);
    setIsQuickMovementOpen(true);
  }

  const canUseQuickMovement =
    Boolean(activeWorkspace && user?.id && workspaceSnapshotQuery.data) &&
    !workspaceSnapshotQuery.isLoading;

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
                isSidebarCollapsed ? "items-center gap-3 lg:flex-col lg:justify-start" : "items-start justify-between gap-4"
              }`}
            >
              <div
                className={`min-w-0 ${isSidebarCollapsed ? "hidden lg:flex lg:flex-col lg:items-center lg:gap-3" : "flex flex-1 flex-col items-start gap-4"}`}
              >
                {isSidebarCollapsed ? (
                  <BrandLogo
                    className="h-14 w-14 rounded-[18px]"
                    imageClassName="scale-[1.02] object-[center_48%]"
                  />
                ) : (
                  <div className="flex w-full items-start justify-between gap-4">
                    <BrandLogo
                      className="h-28 w-28 rounded-[28px]"
                      imageClassName="scale-[1.02] object-[center_48%]"
                    />
                    <button
                      aria-label="Colapsar menu lateral"
                      className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-storm transition hover:bg-white/[0.09] hover:text-ink lg:inline-flex"
                      onClick={() => toggleSidebarCollapsed()}
                      title="Colapsar menu"
                      type="button"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                  </div>
                )}
                <div className={isSidebarCollapsed ? "hidden" : "min-w-0 max-w-[13rem]"}>
                  <p className="text-[0.68rem] uppercase tracking-[0.28em] text-storm/72">
                    Workspace OS
                  </p>
                  <p className="mt-2 text-sm leading-7 text-storm">
                    Finanzas personales y compartidas en un solo sistema.
                  </p>
                </div>
              </div>

              {isSidebarCollapsed ? (
                <button
                  aria-label="Expandir menu lateral"
                  className="hidden h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-storm transition hover:bg-white/[0.09] hover:text-ink lg:inline-flex"
                  onClick={() => toggleSidebarCollapsed()}
                  title="Expandir menu"
                  type="button"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : null}

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
              <div className="mt-2">
                <WorkspacePicker
                  activeWorkspaceId={activeWorkspace?.id ?? null}
                  disabled={!workspaces.length}
                  isLoading={isLoading}
                  onChange={(workspaceId) => setActiveWorkspaceId(workspaceId)}
                  workspaces={workspaces}
                />
              </div>
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
                const isNotificationsItem = item.to === "/app/notifications";
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
                    <span className="relative inline-flex">
                      <Icon className={isSidebarCollapsed ? "h-5 w-5" : "h-4 w-4"} />
                      {isNotificationsItem && unreadNotificationsCount > 0 ? (
                        <span className="absolute -right-2 -top-2 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[#ff6b7a] px-1.5 text-[10px] font-bold text-white shadow-[0_8px_22px_rgba(255,107,122,0.4)]">
                          {unreadNotificationsCount > 99 ? "99+" : unreadNotificationsCount}
                        </span>
                      ) : null}
                    </span>
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
                  className="relative"
                  onClick={() => navigate("/app/notifications")}
                  variant="ghost"
                >
                  <Bell className="h-4 w-4" />
                  Alertas
                  {unreadNotificationsCount > 0 ? (
                    <span className="absolute -right-2 -top-2 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[#ff6b7a] px-1.5 text-[10px] font-bold text-white shadow-[0_8px_22px_rgba(255,107,122,0.4)]">
                      {unreadNotificationsCount > 99 ? "99+" : unreadNotificationsCount}
                    </span>
                  ) : null}
                </Button>
                <Button
                  disabled={!canUseQuickMovement}
                  onClick={() => openQuickMovement("expense")}
                  variant="ghost"
                >
                  Nuevo gasto
                </Button>
                <Button
                  disabled={!canUseQuickMovement}
                  onClick={() => openQuickMovement("income")}
                  variant="secondary"
                >
                  Nuevo ingreso
                </Button>
                <Button
                  disabled={!canUseQuickMovement}
                  onClick={() => openQuickMovement("transfer")}
                >
                  Transferencia
                </Button>
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

          {quickMovementFeedback ? (
            <DataState
              description={quickMovementFeedback}
              title="Movimiento registrado"
              tone="success"
            />
          ) : null}

          <Outlet />
        </div>
      </div>

      {isQuickMovementOpen && activeWorkspace && user?.id && workspaceSnapshotQuery.data ? (
        <QuickMovementDialog
          initialKind={quickMovementKind}
          onClose={() => setIsQuickMovementOpen(false)}
          onCreated={(message) => {
            setQuickMovementFeedback(message);
            setIsQuickMovementOpen(false);
          }}
          snapshot={workspaceSnapshotQuery.data}
          userId={user.id}
          workspaceId={activeWorkspace.id}
        />
      ) : null}
    </div>
  );
}
