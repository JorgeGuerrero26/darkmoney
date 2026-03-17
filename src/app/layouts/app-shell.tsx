import {
  ArrowLeftRight,
  Bell,
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
  Minus,
  PiggyBank,
  Plus,
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
import { useToast } from "../../components/ui/toast-provider";
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
  { to: "/app/categories", label: "Categorías", icon: Shapes },
  { to: "/app/budgets", label: "Presupuestos", icon: PiggyBank },
  { to: "/app/contacts", label: "Contactos", icon: Users },
  { to: "/app/obligations", label: "Créditos y deudas", icon: HandCoins },
  { to: "/app/subscriptions", label: "Suscripciones", icon: CreditCard },
  { to: "/app/notifications", label: "Notificaciones", icon: Bell },
  { to: "/app/settings", label: "Configuración", icon: Settings },
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

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
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
        className={`flex w-full items-center justify-between gap-3 rounded-[18px] border border-white/10 bg-white/[0.04] px-3.5 py-3 text-left text-ink transition duration-200 hover:border-white/16 hover:bg-white/[0.06] ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
        disabled={disabled}
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        type="button"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-white/10 text-xs font-semibold text-ink"
            style={{
              backgroundColor: selectedWorkspace ? `${getWorkspaceAccentColor(selectedWorkspace.kind)}22` : "rgba(255,255,255,0.04)",
              borderColor: selectedWorkspace ? `${getWorkspaceAccentColor(selectedWorkspace.kind)}55` : undefined,
            }}
          >
            {selectedWorkspace ? buildInitials(selectedWorkspace.name, "WS") : "WS"}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-ink">
              {selectedWorkspace?.name ?? (isLoading ? "Preparando..." : "Sin workspace")}
            </span>
            <span className="block truncate text-[0.65rem] text-storm">
              {selectedWorkspace
                ? `${getWorkspaceKindLabel(selectedWorkspace.kind)} · ${getWorkspaceRoleLabel(selectedWorkspace.role)}`
                : "Sin workspace activo"}
            </span>
          </span>
        </span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-storm/60 transition ${isOpen ? "rotate-180" : ""}`} />
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
                    className="flex w-full items-center justify-between gap-3 rounded-[16px] border border-white/5 bg-white/[0.03] px-3.5 py-2.5 text-left transition duration-200 hover:border-white/10 hover:bg-white/[0.06]"
                    key={workspace.id}
                    onClick={() => {
                      onChange(workspace.id);
                      setIsOpen(false);
                    }}
                    type="button"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] border border-white/10 text-xs font-semibold text-ink"
                        style={{
                          backgroundColor: `${accentColor}22`,
                          borderColor: `${accentColor}55`,
                        }}
                      >
                        {buildInitials(workspace.name, "WS")}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-ink">
                          {workspace.name}
                        </span>
                        <span className="block truncate text-[0.65rem] text-storm">
                          {getWorkspaceKindLabel(workspace.kind)} · {getWorkspaceRoleLabel(workspace.role)} · {workspace.baseCurrencyCode}
                        </span>
                      </span>
                    </span>
                    {isSelected ? <Check className="h-3.5 w-3.5 shrink-0 text-pine" /> : null}
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
  const { showToast } = useToast();
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
        "Todos tus movimientos, cuentas y datos financieros están disponibles."
      : isLoading
        ? "Preparando tu espacio financiero, solo toma un momento."
        : "No encontramos workspaces activos para esta cuenta todavía.";

  async function handleSignOut() {
    await signOut();
    navigate("/auth/login", { replace: true });
  }

  function openQuickMovement(kind: QuickMovementKind) {
    if (!activeWorkspace || !user?.id || !workspaceSnapshotQuery.data) {
      return;
    }

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
          aria-label="Cerrar menú"
          className="fixed inset-0 z-20 bg-void/55 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
          type="button"
        />
      ) : null}

      <div className="flex min-h-screen w-full gap-4 px-2 py-2 sm:px-3 sm:py-3 lg:gap-5 lg:px-4 lg:py-4">
        <aside
          className={`fixed inset-y-3 left-3 z-30 w-[296px] overflow-y-auto overscroll-contain rounded-[30px] border border-white/10 bg-shell/95 px-5 py-6 text-ink shadow-haze backdrop-blur-2xl transition-[transform,width,padding] duration-300 lg:static lg:overflow-visible lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-[120%]"
          } ${
            isSidebarCollapsed ? "lg:w-[118px] lg:px-4" : "lg:w-[296px] lg:px-5"
          }`}
        >
          <div className="flex min-h-full flex-col">
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
                      aria-label="Colapsar menú lateral"
                      className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-storm transition hover:bg-white/[0.09] hover:text-ink lg:inline-flex"
                      onClick={() => toggleSidebarCollapsed()}
                      title="Colapsar menú"
                      type="button"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                  </div>
                )}
                <div className={isSidebarCollapsed ? "hidden" : "min-w-0 max-w-[13rem]"}>
                  <p className="text-[0.68rem] uppercase tracking-[0.28em] text-storm/72">
                    Dark Money
                  </p>
                  <p className="mt-2 text-sm leading-7 text-storm">
                    Finanzas personales y compartidas en un solo sistema.
                  </p>
                </div>
              </div>

              {isSidebarCollapsed ? (
                <button
                  aria-label="Expandir menú lateral"
                  className="hidden h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-storm transition hover:bg-white/[0.09] hover:text-ink lg:inline-flex"
                  onClick={() => toggleSidebarCollapsed()}
                  title="Expandir menú"
                  type="button"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : null}

              <button
                aria-label="Cerrar menú"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-storm transition hover:bg-white/[0.06] hover:text-ink lg:hidden"
                onClick={() => setSidebarOpen(false)}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className={`mt-6 ${isSidebarCollapsed ? "lg:hidden" : ""}`}>
              <p className="mb-2 text-[0.6rem] font-semibold uppercase tracking-[0.24em] text-storm/55">
                Workspace
              </p>
              <WorkspacePicker
                activeWorkspaceId={activeWorkspace?.id ?? null}
                disabled={!workspaces.length}
                isLoading={isLoading}
                onChange={(workspaceId) => setActiveWorkspaceId(workspaceId)}
                workspaces={workspaces}
              />
              {error ? (
                <p className="mt-2 text-xs text-rosewood">{workspaceErrorMessage}</p>
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
                aria-label="Cerrar sesión"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-storm transition hover:bg-white/[0.08] hover:text-ink"
                onClick={() => void handleSignOut()}
                title="Cerrar sesión"
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
                  aria-label="Abrir menú"
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

              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
                <Button
                  className="relative col-span-2 sm:col-span-1"
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
                  <Minus className="h-4 w-4" />
                  Gasto
                </Button>
                <Button
                  disabled={!canUseQuickMovement}
                  onClick={() => openQuickMovement("income")}
                  variant="secondary"
                >
                  <Plus className="h-4 w-4" />
                  Ingreso
                </Button>
                <Button
                  disabled={!canUseQuickMovement}
                  onClick={() => openQuickMovement("transfer")}
                >
                  <ArrowLeftRight className="h-4 w-4" />
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
                      : "Ve a Configuración para crear tu primer workspace y empezar a registrar tus finanzas."
                  }
                  title={error ? "No se pudo cargar tu workspace" : "No hay un workspace activo todavía"}
                  tone={error ? "error" : "neutral"}
                />
              </div>
            ) : null}
          </header>

          <Outlet />
        </div>
      </div>

      {isQuickMovementOpen && activeWorkspace && user?.id && workspaceSnapshotQuery.data ? (
        <QuickMovementDialog
          initialKind={quickMovementKind}
          onClose={() => setIsQuickMovementOpen(false)}
          onCreated={(message) => {
            setIsQuickMovementOpen(false);
            showToast({ title: "Movimiento registrado", description: message, tone: "success" });
          }}
          snapshot={workspaceSnapshotQuery.data}
          userId={user.id}
          workspaceId={activeWorkspace.id}
        />
      ) : null}
    </div>
  );
}
