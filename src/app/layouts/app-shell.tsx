import {
  ArrowLeftRight,
  Bell,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Gauge,
  HandCoins,
  LayoutGrid,
  LoaderCircle,
  LogOut,
  Menu,
  Minus,
  PiggyBank,
  Plus,
  Search,
  Settings,
  Shapes,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { useOutsidePointerClose } from "../../hooks/use-outside-pointer-close";
import { CommandPalette, type CommandAction } from "../../components/command-palette/command-palette";
import { OnboardingTour } from "../../components/onboarding/onboarding-tour";
import { useOnboardingTour } from "../../components/onboarding/use-onboarding-tour";
import { BrandLogo } from "../../components/ui/brand-logo";
import { DataState } from "../../components/ui/data-state";
import { InfoTip } from "../../components/ui/info-tip";
import { StatusBadge } from "../../components/ui/status-badge";
import { useToast } from "../../components/ui/toast-provider";
import { useAuth } from "../../modules/auth/auth-context";
import {
  QuickMovementDialog,
  type QuickMovementKind,
} from "../../modules/movements/components/quick-movement-dialog";
import { useNotificationInbox } from "../../modules/notifications/use-notification-inbox";
import { NotificationReadsProvider } from "../../modules/notifications/notification-reads-context";
import { UserPreferencesProvider } from "../../modules/notifications/user-preferences-context";
import { useActiveWorkspace } from "../../modules/workspaces/use-active-workspace";
import {
  getQueryErrorMessage,
  useNotificationPreferencesQuery,
  useNotificationsQuery,
  usePendingNotificationInvitesQuery,
  useCurrentUserEntitlementQuery,
  useWorkspaceSnapshotQuery,
} from "../../services/queries/workspace-data";
import { getPublicAppUrl } from "../../lib/app-url";
import { isPaddleCheckoutConfigured, openPaddleProCheckout } from "../../lib/paddle";
import { isSupabaseConfigured } from "../../services/supabase/client";
import { useWorkspaceStore } from "../../stores/workspace-store";
import type { Workspace } from "../../types/domain";
import { PRO_ADMIN_EMAIL } from "../../modules/shared/use-pro-feature-access";

const compactNavigation = [
  { to: "/app", label: "Dashboard", icon: LayoutGrid, end: true },
  { to: "/app/accounts", label: "Cuentas", icon: Wallet },
  { to: "/app/movements", label: "Movimientos", icon: Gauge },
  { to: "/app/categories", label: "Categorías", icon: Shapes },
  { to: "/app/budgets", label: "Presupuestos", icon: PiggyBank },
  { to: "/app/contacts", label: "Contactos", icon: Users },
  { to: "/app/obligations", label: "Créditos y deudas", icon: HandCoins },
  { to: "/app/subscriptions", label: "Suscripciones", icon: CreditCard },
  { to: "/app/recurring-income", label: "Ingresos fijos", icon: TrendingUp },
  { to: "/app/notifications", label: "Notificaciones", icon: Bell },
  { to: "/app/settings", label: "Configuración", icon: Settings },
];

type NavigationItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
};

type NavigationGroupId = "operations" | "planning" | "catalogs" | "relations" | "system";

type NavigationGroup = {
  id: NavigationGroupId;
  title: string;
  summary: string;
  items: NavigationItem[];
};

const dashboardNavigationItem: NavigationItem = {
  to: "/app",
  label: "Dashboard",
  icon: LayoutGrid,
  end: true,
};

const navigationGroups: NavigationGroup[] = [
  {
    id: "operations",
    title: "Operacion",
    summary: "Cuentas, flujo y cobros",
    items: [
      { to: "/app/accounts", label: "Cuentas", icon: Wallet },
      { to: "/app/movements", label: "Movimientos", icon: Gauge },
      { to: "/app/recurring-income", label: "Ingresos fijos", icon: TrendingUp },
      { to: "/app/subscriptions", label: "Suscripciones", icon: CreditCard },
    ],
  },
  {
    id: "planning",
    title: "Planeacion",
    summary: "Presupuestos y seguimiento",
    items: [{ to: "/app/budgets", label: "Presupuestos", icon: PiggyBank }],
  },
  {
    id: "catalogs",
    title: "Catalogos",
    summary: "Base y clasificacion",
    items: [
      { to: "/app/categories", label: "Categorias", icon: Shapes },
      { to: "/app/contacts", label: "Contactos", icon: Users },
    ],
  },
  {
    id: "relations",
    title: "Relaciones",
    summary: "Creditos y terceros",
    items: [{ to: "/app/obligations", label: "Creditos y deudas", icon: HandCoins }],
  },
  {
    id: "system",
    title: "Sistema",
    summary: "Alertas y ajustes",
    items: [
      { to: "/app/notifications", label: "Notificaciones", icon: Bell },
      { to: "/app/settings", label: "Configuracion", icon: Settings },
    ],
  },
];

const PRO_BANNER_DISMISS_PREFIX = "darkmoney.pro-banner.dismissed-until";
const PRO_BANNER_SNOOZE_DAYS = 7;

function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() ?? "";
}

function getProBannerDismissKey(userId?: string) {
  return `${PRO_BANNER_DISMISS_PREFIX}:${userId ?? "anonymous"}`;
}

function readDismissedProBannerUntil(userId?: string) {
  if (!userId) {
    return null;
  }

  try {
    return window.localStorage.getItem(getProBannerDismissKey(userId));
  } catch {
    return null;
  }
}

function writeDismissedProBannerUntil(userId?: string, value?: string | null) {
  if (!userId) {
    return;
  }

  try {
    const storageKey = getProBannerDismissKey(userId);

    if (!value) {
      window.localStorage.removeItem(storageKey);
      return;
    }

    window.localStorage.setItem(storageKey, value);
  } catch {
    // ignore
  }
}

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
  imageUrl?: string | null;
  size?: "compact" | "regular";
  title?: string;
};

function IdentityAvatar({
  initials,
  imageUrl,
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
      {imageUrl ? (
        <img
          alt={title ?? initials}
          className={`relative z-10 h-full w-full object-cover ${shellClassName}`}
          src={imageUrl}
        />
      ) : (
        <span
          className={`relative z-10 font-display font-semibold tracking-[-0.04em] text-void drop-shadow-[0_1px_0_rgba(255,255,255,0.14)] transition duration-300 ease-out group-hover:scale-[1.05] ${textClassName}`}
        >
          {initials}
        </span>
      )}
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
  const containerRef = useOutsidePointerClose(isOpen, () => setIsOpen(false), true);
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
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label="Seleccionar workspace activo"
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

          <div aria-label="Lista de workspaces" className="mt-3 max-h-72 space-y-1 overflow-y-auto pr-1" role="listbox">
            {filteredWorkspaces.length ? (
              filteredWorkspaces.map((workspace) => {
                const isSelected = workspace.id === activeWorkspaceId;
                const accentColor = getWorkspaceAccentColor(workspace.kind);

                return (
                  <button
                    aria-selected={isSelected}
                    className="flex w-full items-center justify-between gap-3 rounded-[16px] border border-white/5 bg-white/[0.03] px-3.5 py-2.5 text-left transition duration-200 hover:border-white/10 hover:bg-white/[0.06]"
                    key={workspace.id}
                    onClick={() => {
                      onChange(workspace.id);
                      setIsOpen(false);
                    }}
                    role="option"
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
  const { user } = useAuth();
  const notificationPreferencesQuery = useNotificationPreferencesQuery(user?.id);

  return (
    <NotificationReadsProvider
      initialSmartReads={notificationPreferencesQuery.data?.smartReads}
      userId={user?.id}
    >
      <UserPreferencesProvider
        initialUiPrefs={notificationPreferencesQuery.data?.uiPrefs}
        userId={user?.id}
      >
        <AppShellContent />
      </UserPreferencesProvider>
    </NotificationReadsProvider>
  );
}

function AppShellContent() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isQuickMovementOpen, setIsQuickMovementOpen] = useState(false);
  const [quickMovementKind, setQuickMovementKind] = useState<QuickMovementKind>("expense");
  const [isProBannerDismissed, setIsProBannerDismissed] = useState(false);
  const [isOpeningProCheckout, setIsOpeningProCheckout] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [openNavigationGroup, setOpenNavigationGroup] = useState<NavigationGroupId | null>("operations");
  const { showToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, saveAvatar, signOut, user } = useAuth();
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
  const pendingNotificationInvitesQuery = usePendingNotificationInvitesQuery(user?.id);
  const notificationPreferencesQuery = useNotificationPreferencesQuery(user?.id);
  const entitlementQuery = useCurrentUserEntitlementQuery(user?.id);
  const notificationInbox = useNotificationInbox({
    databaseNotifications: notificationsQuery.data ?? [],
    entitlement: entitlementQuery.data,
    pendingObligationShares: pendingNotificationInvitesQuery.data?.obligationShares,
    pendingWorkspaceInvitations: pendingNotificationInvitesQuery.data?.workspaceInvitations,
    snapshot: workspaceSnapshotQuery.data,
    workspaceName: activeWorkspace?.name,
  });
  const unreadNotificationsCount =
    notificationPreferencesQuery.data?.inAppEnabled === false ? 0 : notificationInbox.unreadCount;
  const currentUserName = profile?.fullName ?? user?.email?.split("@")[0] ?? "Usuario";
  const currentUserEmail = profile?.email ?? user?.email ?? "";
  const isAdminOverride = normalizeEmail(currentUserEmail) === normalizeEmail(PRO_ADMIN_EMAIL);
  const hasProAccess = isAdminOverride || Boolean(entitlementQuery.data?.proAccessEnabled);
  const normalizedBillingStatus = entitlementQuery.data?.billingStatus?.trim().toLowerCase() ?? null;
  const currentUserInitials = profile?.initials ?? buildInitials(currentUserName, "DM");
  const workspaceInitials = buildInitials(activeWorkspace?.name, "WS");
  const activeNavigationGroup = useMemo(
    () =>
      navigationGroups.find((group) =>
        group.items.some((item) => location.pathname === item.to),
      )?.id ?? null,
    [location.pathname],
  );
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

  async function handleOpenProCheckout() {
    if (!isPaddleCheckoutConfigured() || !user?.id || !user.email) {
      navigate("/app/settings");
      return;
    }
    try {
      setIsOpeningProCheckout(true);
      await openPaddleProCheckout({
        appUrl: getPublicAppUrl(),
        payerEmail: user.email,
        userId: user.id,
        workspaceId: activeWorkspace?.id ?? null,
      });
    } catch {
      navigate("/app/settings");
    } finally {
      setIsOpeningProCheckout(false);
    }
  }

  async function handleAvatarChange(file: File | null) {
    if (!file || !hasProAccess) {
      return;
    }

    try {
      setIsUploadingAvatar(true);
      await saveAvatar(file);
      showToast({
        title: "Foto actualizada",
        description: "Tu foto de perfil ya se actualizo tambien desde el menu movil.",
        tone: "success",
      });
    } catch (error) {
      showToast({
        title: "No pudimos actualizar la foto",
        description: getQueryErrorMessage(error, "Intenta de nuevo con otra imagen."),
        tone: "error",
      });
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  async function handleRemoveAvatar() {
    if (!hasProAccess || !profile?.avatarUrl) {
      return;
    }

    try {
      setIsUploadingAvatar(true);
      await saveAvatar(null);
      showToast({
        title: "Foto eliminada",
        description: "Tu perfil vuelve a mostrar las iniciales de la cuenta.",
        tone: "success",
      });
    } catch (error) {
      showToast({
        title: "No pudimos eliminar la foto",
        description: getQueryErrorMessage(error, "Intenta nuevamente en unos segundos."),
        tone: "error",
      });
    } finally {
      setIsUploadingAvatar(false);
    }
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

  const tourSnapshot = workspaceSnapshotQuery.data;
  const tourCounts = useMemo(
    () => ({
      accounts: tourSnapshot?.accounts.length ?? 0,
      movements: tourSnapshot?.movements.length ?? 0,
      categories: tourSnapshot?.catalogs.categories.length ?? 0,
      counterparties: tourSnapshot?.catalogs.counterparties.length ?? 0,
    }),
    [tourSnapshot],
  );
  const onboardingTour = useOnboardingTour({
    isWorkspaceEmpty: tourSnapshot
      ? tourSnapshot.accounts.length === 0 && tourSnapshot.movements.length === 0
      : null,
  });

  // Atajo global Ctrl/Cmd+K para la paleta de comandos.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        const target = event.target as HTMLElement | null;
        if (
          target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable)
        ) {
          return;
        }

        event.preventDefault();
        setIsPaletteOpen((open) => !open);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const paletteActions = useMemo<CommandAction[]>(() => {
    const navigationActions: CommandAction[] = compactNavigation.map((item) => ({
      id: `nav-${item.to}`,
      label: `Ir a ${item.label}`,
      keywords: item.label,
      group: "Navegación",
      icon: item.icon,
      run: () => navigate(item.to),
    }));

    const quickActions: CommandAction[] = [
      {
        id: "quick-expense",
        label: "Registrar gasto",
        keywords: "gasto salida pago expense",
        group: "Acciones rápidas",
        icon: Minus,
        disabled: !canUseQuickMovement,
        run: () => openQuickMovement("expense"),
      },
      {
        id: "quick-income",
        label: "Registrar ingreso",
        keywords: "ingreso entrada cobro income",
        group: "Acciones rápidas",
        icon: Plus,
        disabled: !canUseQuickMovement,
        run: () => openQuickMovement("income"),
      },
      {
        id: "quick-transfer",
        label: "Registrar transferencia",
        keywords: "transferencia mover dinero transfer",
        group: "Acciones rápidas",
        icon: ArrowLeftRight,
        disabled: !canUseQuickMovement,
        run: () => openQuickMovement("transfer"),
      },
    ];

    const systemActions: CommandAction[] = [
      {
        id: "start-tour",
        label: "Ver tutorial interactivo",
        keywords: "tour tutorial onboarding ayuda guia",
        group: "Sistema",
        icon: Sparkles,
        run: () => {
          navigate("/app");
          onboardingTour.start();
        },
      },
      {
        id: "toggle-sidebar",
        label: isSidebarCollapsed ? "Expandir menú lateral" : "Colapsar menú lateral",
        keywords: "sidebar menu colapsar",
        group: "Sistema",
        icon: isSidebarCollapsed ? ChevronRight : ChevronLeft,
        run: () => toggleSidebarCollapsed(),
      },
      {
        id: "sign-out",
        label: "Cerrar sesión",
        keywords: "logout salir sesion",
        group: "Sistema",
        icon: LogOut,
        run: () => void handleSignOut(),
      },
    ];

    return [...quickActions, ...navigationActions, ...systemActions];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUseQuickMovement, isSidebarCollapsed, navigate, onboardingTour.start, toggleSidebarCollapsed]);
  const proBannerContent = useMemo(() => {
    if (normalizedBillingStatus === "expired") {
      return {
        badge: "PRO VENCIDO",
        title: "Tu acceso premium ya se puede recuperar",
        description:
          "Vuelve a DarkMoney Pro para reactivar el dashboard avanzado, comprobantes y alertas premium sin perder tu contexto.",
        ctaLabel: "Reactivar Pro",
      };
    }

    return {
      badge: "MODO FREE",
      title: "Lleva DarkMoney un nivel más arriba",
      description:
        "Activa DarkMoney Pro para desbloquear dashboard avanzado, Aprendiendo de ti, comprobantes y más señales inteligentes.",
      ctaLabel: "Ver DarkMoney Pro",
    };
  }, [normalizedBillingStatus]);
  const shouldShowProBanner =
    !entitlementQuery.isLoading &&
    !hasProAccess &&
    !isProBannerDismissed;

  useEffect(() => {
    const EDGE_ZONE = 32;
    const MIN_SWIPE_X = 48;
    const MAX_SWIPE_Y = 80;
    let startX = 0;
    let startY = 0;

    function onTouchStart(e: TouchEvent) {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }

    function onTouchEnd(e: TouchEvent) {
      if (window.innerWidth >= 1024) return;
      const dx = e.changedTouches[0].clientX - startX;
      const dy = Math.abs(e.changedTouches[0].clientY - startY);
      if (dy > MAX_SWIPE_Y) return;
      if (dx > MIN_SWIPE_X && startX < EDGE_ZONE) {
        setSidebarOpen(true);
      } else if (dx < -MIN_SWIPE_X) {
        setSidebarOpen(false);
      }
    }

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setIsProBannerDismissed(false);
      return;
    }

    if (hasProAccess) {
      writeDismissedProBannerUntil(user.id, null);
      setIsProBannerDismissed(true);
      return;
    }

    const dismissedUntil = readDismissedProBannerUntil(user.id);
    const dismissedUntilTimestamp = dismissedUntil ? new Date(dismissedUntil).getTime() : NaN;
    setIsProBannerDismissed(Boolean(dismissedUntil && dismissedUntilTimestamp > Date.now()));
  }, [hasProAccess, user?.id]);

  useEffect(() => {
    if (activeNavigationGroup) {
      setOpenNavigationGroup(activeNavigationGroup);
    }
  }, [activeNavigationGroup]);

  function handleDismissProBanner() {
    if (!user?.id) {
      setIsProBannerDismissed(true);
      return;
    }

    const dismissedUntil = new Date();
    dismissedUntil.setDate(dismissedUntil.getDate() + PRO_BANNER_SNOOZE_DAYS);
    writeDismissedProBannerUntil(user.id, dismissedUntil.toISOString());
    setIsProBannerDismissed(true);
  }

  return (
    <div className="min-h-screen bg-glow text-ink lg:h-screen lg:overflow-hidden">
      <a className="skip-to-content" href="#main-content">
        Saltar al contenido principal
      </a>
      {sidebarOpen ? (
        <button
          aria-label="Cerrar menú"
          className="fixed inset-0 z-20 bg-void/55 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
          type="button"
        />
      ) : null}

      <div className="flex min-h-screen w-full gap-4 px-2 py-2 sm:px-3 sm:py-3 lg:h-full lg:min-h-0 lg:gap-5 lg:px-4 lg:py-4">
        <aside
          aria-label="Menú principal"
          className={`fixed inset-y-3 left-3 z-30 w-[296px] overflow-y-auto overscroll-contain rounded-[30px] border border-white/10 bg-shell/95 px-5 py-5 text-ink shadow-haze backdrop-blur-2xl transition-[transform,width,padding] duration-300 lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:self-start lg:overflow-hidden lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-[120%]"
          } ${
            isSidebarCollapsed ? "lg:w-[118px] lg:px-4" : "lg:w-[296px] lg:px-5"
          }`}
        >
          <div className="flex h-full min-h-0 flex-col">
            <div
              className={`flex ${
                isSidebarCollapsed ? "items-center gap-3 lg:flex-col lg:justify-start" : "items-start justify-between gap-3"
              }`}
            >
              <div
                className={`min-w-0 ${isSidebarCollapsed ? "hidden lg:flex lg:flex-col lg:items-center lg:gap-3" : "flex flex-1 items-center gap-3"}`}
              >
                {isSidebarCollapsed ? (
                  <BrandLogo
                    className="h-12 w-12 rounded-2xl"
                    imageClassName="scale-[1.02] object-[center_48%]"
                  />
                ) : (
                  <div className="flex w-full items-center gap-3">
                    <BrandLogo
                      className="h-12 w-12 rounded-2xl"
                      imageClassName="scale-[1.02] object-[center_48%]"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-base font-semibold tracking-tight text-ink">
                        DarkMoney
                      </p>
                      <p className="text-[0.62rem] uppercase tracking-[0.22em] text-pine/70">
                        Finanzas claras
                      </p>
                    </div>
                    <button
                      aria-label="Colapsar menú lateral"
                      className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-storm transition hover:bg-white/[0.09] hover:text-ink lg:inline-flex"
                      onClick={() => toggleSidebarCollapsed()}
                      title="Colapsar menú"
                      type="button"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                  </div>
                )}
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

            <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1">
            <div className={`mt-4 ${isSidebarCollapsed ? "lg:hidden" : ""}`} data-tour="workspace-picker">
              <p className="mb-1.5 text-[0.58rem] font-semibold uppercase tracking-[0.24em] text-storm/55">
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
              className={`${isSidebarCollapsed ? "hidden lg:flex" : "hidden"} glass-panel-soft mt-6 flex-col items-center gap-3 rounded-[30px] px-3 py-4 text-center`}
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

            <nav aria-label="Navegación principal" className={isSidebarCollapsed ? "mt-8 space-y-2" : "hidden"}>
              {compactNavigation.map((item) => {
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
                    end={"end" in item ? item.end : undefined}
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

            {!isSidebarCollapsed ? (
              <nav aria-label="Navegacion principal agrupada" className="mt-7 space-y-1">
                <NavLink
                  className={({ isActive }) =>
                    `group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition duration-200 ${
                      isActive
                        ? "bg-white/[0.06] text-ink"
                        : "text-storm hover:translate-x-0.5 hover:bg-white/[0.03] hover:text-ink"
                    }`
                  }
                  end={dashboardNavigationItem.end}
                  onClick={() => setSidebarOpen(false)}
                  to={dashboardNavigationItem.to}
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={`absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full transition ${
                          isActive ? "bg-pine" : "bg-transparent"
                        }`}
                      />
                      <LayoutGrid className="h-4 w-4" />
                      <span>{dashboardNavigationItem.label}</span>
                    </>
                  )}
                </NavLink>

                {navigationGroups.map((group) => {
                  const isGroupActive = group.items.some((item) => location.pathname === item.to);
                  const isOpen = openNavigationGroup === group.id;

                  return (
                    <div className="pt-4 first:pt-0" key={group.id}>
                      <button
                        className="flex w-full items-center justify-between gap-2 rounded-lg px-3.5 py-1 text-left transition duration-200 hover:text-ink"
                        onClick={() =>
                          setOpenNavigationGroup((current) => (current === group.id ? null : group.id))
                        }
                        title={group.summary}
                        type="button"
                      >
                        <span
                          className={`text-[0.6rem] font-semibold uppercase tracking-[0.24em] transition ${
                            isGroupActive || isOpen ? "text-storm/80" : "text-storm/50"
                          }`}
                        >
                          {group.title}
                        </span>
                        <ChevronDown
                          className={`h-3.5 w-3.5 shrink-0 transition ${
                            isOpen ? "rotate-180 text-storm/70" : "text-storm/40"
                          }`}
                        />
                      </button>

                      {isOpen ? (
                        <div className="mt-1 space-y-0.5">
                          {group.items.map((item) => {
                            const Icon = item.icon;
                            const isNotificationsItem = item.to === "/app/notifications";

                            return (
                              <NavLink
                                className={({ isActive }) =>
                                  `group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm transition duration-200 ${
                                    isActive
                                      ? "bg-white/[0.06] font-medium text-ink"
                                      : "text-storm hover:translate-x-0.5 hover:bg-white/[0.03] hover:text-ink"
                                  }`
                                }
                                key={item.to}
                                onClick={() => setSidebarOpen(false)}
                                to={item.to}
                              >
                                {({ isActive }) => (
                                  <>
                                    <span
                                      className={`absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full transition ${
                                        isActive ? "bg-pine" : "bg-transparent"
                                      }`}
                                    />
                                    <span className="relative inline-flex">
                                      <Icon className="h-4 w-4" />
                                      {isNotificationsItem && unreadNotificationsCount > 0 ? (
                                        <span className="absolute -right-2 -top-2 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-[#ff6b7a] px-1 text-[9px] font-bold text-white shadow-[0_8px_22px_rgba(255,107,122,0.35)]">
                                          {unreadNotificationsCount > 99 ? "99+" : unreadNotificationsCount}
                                        </span>
                                      ) : null}
                                    </span>
                                    <span>{item.label}</span>
                                  </>
                                )}
                              </NavLink>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </nav>
            ) : null}
            </div>

            <div className={`mt-6 rounded-[28px] border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.03] p-4 backdrop-blur-2xl ${isSidebarCollapsed ? "lg:hidden" : ""}`}>
              <div className="flex items-center gap-3">
                <IdentityAvatar
                  imageUrl={profile?.avatarUrl}
                  initials={currentUserInitials}
                  size="compact"
                  title={currentUserName}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{currentUserName}</p>
                  <p className="truncate text-xs text-storm">{currentUserEmail}</p>
                </div>
                <StatusBadge
                  status={hasProAccess ? "Pro" : "Free"}
                  tone={hasProAccess ? "success" : "neutral"}
                />
              </div>
              <div className="mt-4 flex items-center justify-between gap-2">
                <button
                  className="inline-flex items-center gap-2 text-sm text-storm transition hover:text-ink"
                  onClick={() => void handleSignOut()}
                  type="button"
                >
                  <LogOut className="h-4 w-4" />
                  Cerrar sesion
                </button>
                {!hasProAccess && !entitlementQuery.isLoading ? (
                  <button
                    className="inline-flex items-center gap-1.5 rounded-full border border-pine/25 bg-pine/10 px-3 py-1.5 text-xs font-semibold text-pine transition hover:border-pine/35 hover:bg-pine/15 disabled:opacity-60"
                    disabled={isOpeningProCheckout}
                    onClick={() => void handleOpenProCheckout()}
                    type="button"
                  >
                    <Sparkles className="h-3 w-3" />
                    {isOpeningProCheckout ? "Abriendo..." : "Activar Pro"}
                  </button>
                ) : null}
              </div>
              {hasProAccess ? (
                <div className="mt-4 border-t border-white/10 pt-4 lg:hidden">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-storm/70">
                    Foto de perfil Pro
                  </p>
                  <p className="mt-2 text-xs leading-5 text-storm">
                    Puedes cambiarla desde aqui con JPG, PNG o WebP. La app la recorta al centro automaticamente.
                  </p>
                  <div className="mt-3 grid gap-2">
                    <label
                      className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-[16px] border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm font-medium text-ink transition hover:bg-white/[0.08] ${isUploadingAvatar ? "pointer-events-none opacity-60" : ""}`}
                    >
                      {isUploadingAvatar ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <Camera className="h-4 w-4" />
                      )}
                      {profile?.avatarUrl ? "Cambiar foto" : "Subir foto"}
                      <input
                        accept="image/jpeg,image/png,image/webp"
                        className="sr-only"
                        disabled={isUploadingAvatar}
                        onChange={(event) => {
                          void handleAvatarChange(event.target.files?.[0] ?? null);
                          event.currentTarget.value = "";
                        }}
                        type="file"
                      />
                    </label>
                    {profile?.avatarUrl ? (
                      <button
                        className="inline-flex items-center justify-center rounded-[16px] border border-white/10 bg-transparent px-3 py-2.5 text-sm text-storm transition hover:border-white/15 hover:text-ink disabled:opacity-60"
                        disabled={isUploadingAvatar}
                        onClick={() => void handleRemoveAvatar()}
                        type="button"
                      >
                        Eliminar foto
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            <div className={`${isSidebarCollapsed ? "hidden lg:flex" : "hidden"} mt-6 flex-col items-center gap-3 rounded-[28px] border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.03] px-3 py-4 backdrop-blur-2xl`}>
              <IdentityAvatar
                imageUrl={profile?.avatarUrl}
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

        <main className="flex min-w-0 flex-1 flex-col gap-6 lg:ml-0 lg:min-h-0 lg:overflow-y-auto lg:pr-1" id="main-content" tabIndex={-1}>
          <header aria-label="Encabezado del workspace" className="glass-panel-strong rounded-[30px] px-4 py-3.5 sm:px-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  aria-label="Abrir menú"
                  className="shrink-0 rounded-2xl border border-white/10 bg-white/[0.05] p-2.5 text-ink lg:hidden"
                  onClick={() => setSidebarOpen(true)}
                  type="button"
                >
                  <Menu className="h-5 w-5" />
                </button>

                <div className="min-w-0">
                  <p className="text-[0.62rem] uppercase tracking-[0.26em] text-storm/70">
                    Workspace activo
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2.5">
                    <h1 className="truncate font-display text-2xl font-semibold tracking-[-0.02em]">
                      {activeWorkspace?.name ?? (isLoading ? "Tu workspace" : "Sin workspace")}
                    </h1>
                    <StatusBadge
                      className={shellStatus.label === "Actualizando" ? "animate-soft-pulse" : ""}
                      status={shellStatus.label}
                      tone={shellStatus.tone}
                    />
                    <InfoTip ariaLabel="Acerca de este workspace">{shellDescription}</InfoTip>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
                <button
                  aria-label="Abrir paleta de comandos"
                  className="hidden h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3.5 text-xs text-storm transition duration-200 hover:border-white/16 hover:text-ink lg:inline-flex"
                  onClick={() => setIsPaletteOpen(true)}
                  title="Paleta de comandos (Ctrl+K)"
                  type="button"
                >
                  <Search className="h-3.5 w-3.5" />
                  <kbd className="rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px]">
                    Ctrl K
                  </kbd>
                </button>
                <button
                  aria-label="Ver alertas"
                  className="relative col-span-2 inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3.5 text-sm font-semibold text-storm transition duration-200 hover:border-white/16 hover:text-ink sm:col-span-1 sm:w-11 sm:gap-0 sm:px-0"
                  onClick={() => navigate("/app/notifications")}
                  title="Alertas"
                  type="button"
                >
                  <Bell className="h-4 w-4" />
                  <span className="sm:sr-only">Alertas</span>
                  {unreadNotificationsCount > 0 ? (
                    <span className="absolute -right-1.5 -top-1.5 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[#ff6b7a] px-1.5 text-[10px] font-bold text-white shadow-[0_8px_22px_rgba(255,107,122,0.4)]">
                      {unreadNotificationsCount > 99 ? "99+" : unreadNotificationsCount}
                    </span>
                  ) : null}
                </button>
                <button
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-rosewood/20 bg-rosewood/[0.08] px-3.5 text-sm font-semibold text-rosewood transition duration-200 hover:border-rosewood/35 hover:bg-rosewood/[0.14] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!canUseQuickMovement}
                  onClick={() => openQuickMovement("expense")}
                  type="button"
                >
                  <Minus className="h-4 w-4" />
                  Gasto
                </button>
                <button
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-pine/20 bg-pine/[0.08] px-3.5 text-sm font-semibold text-pine transition duration-200 hover:border-pine/35 hover:bg-pine/[0.14] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!canUseQuickMovement}
                  onClick={() => openQuickMovement("income")}
                  type="button"
                >
                  <Plus className="h-4 w-4" />
                  Ingreso
                </button>
                <button
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-ember/20 bg-ember/[0.08] px-3.5 text-sm font-semibold text-ember transition duration-200 hover:border-ember/35 hover:bg-ember/[0.14] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!canUseQuickMovement}
                  onClick={() => openQuickMovement("transfer")}
                  type="button"
                >
                  <ArrowLeftRight className="h-4 w-4" />
                  Transferencia
                </button>
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

          {shouldShowProBanner ? (
            <section className="animate-rise-in flex flex-wrap items-center gap-3 rounded-2xl border border-pine/15 bg-[linear-gradient(135deg,rgba(10,18,30,0.96),rgba(16,46,40,0.94))] px-4 py-2.5">
              <Sparkles className="h-4 w-4 shrink-0 text-pine" />
              <p className="min-w-0 flex-1 text-sm text-storm">
                <span className="font-semibold text-ink">{proBannerContent.title}.</span>{" "}
                <span className="hidden xl:inline">{proBannerContent.description}</span>
              </p>
              <button
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-pine/25 bg-pine/10 px-3.5 py-1.5 text-xs font-semibold text-pine transition hover:border-pine/35 hover:bg-pine/15 disabled:opacity-60"
                disabled={isOpeningProCheckout}
                onClick={() => void handleOpenProCheckout()}
                type="button"
              >
                <Sparkles className="h-3 w-3" />
                {isOpeningProCheckout ? "Abriendo..." : proBannerContent.ctaLabel}
              </button>
              <button
                aria-label="Ocultar aviso de Pro"
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-storm/60 transition hover:bg-white/[0.06] hover:text-ink"
                onClick={handleDismissProBanner}
                type="button"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </section>
          ) : null}

          <Outlet />
        </main>
      </div>

      {isPaletteOpen ? (
        <CommandPalette
          actions={paletteActions}
          onClose={() => setIsPaletteOpen(false)}
        />
      ) : null}

      {onboardingTour.isActive && tourSnapshot ? (
        <OnboardingTour
          counts={tourCounts}
          onComplete={onboardingTour.complete}
          onDismiss={onboardingTour.dismiss}
          onNavigate={(route) => navigate(route)}
          onSetStep={onboardingTour.setStep}
          step={onboardingTour.step}
        />
      ) : null}

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
