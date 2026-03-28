import { BellDot, Briefcase, Camera, Check, ChevronDown, LoaderCircle, MailPlus, Plus, Search, ShieldCheck, Sparkles, Tag, X } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { Button } from "../../../components/ui/button";
import { DataState } from "../../../components/ui/data-state";
import { FormFeedbackBanner } from "../../../components/ui/form-feedback-banner";
import { PageHeader } from "../../../components/ui/page-header";
import { StatusBadge } from "../../../components/ui/status-badge";
import { SurfaceCard } from "../../../components/ui/surface-card";
import { useSuccessToast } from "../../../components/ui/toast-provider";
import { getPublicAppUrl } from "../../../lib/app-url";
import { getBillingProviderLabel } from "../../../lib/billing-provider";
import { formatDate } from "../../../lib/formatting/dates";
import { formatWorkspaceKindLabel, formatWorkspaceRoleLabel } from "../../../lib/formatting/labels";
import { isPaddleCheckoutConfigured, openPaddleProCheckout } from "../../../lib/paddle";
import { useAuth } from "../../auth/auth-context";
import { useProFeatureAccess } from "../../shared/use-pro-feature-access";
import { useActiveWorkspace } from "../../workspaces/use-active-workspace";
import {
  useCreateSharedWorkspaceMutation,
  useCreateWorkspaceInvitationMutation,
  useCancelPaddleSubscriptionMutation,
  useCancelProSubscriptionMutation,
  getQueryErrorMessage,
  useCurrentUserEntitlementQuery,
  useNotificationPreferencesQuery,
  useSaveNotificationPreferencesMutation,
  useWorkspaceCollaborationQuery,
  useWorkspaceSnapshotQuery,
} from "../../../services/queries/workspace-data";
import type { WorkspaceRole } from "../../../types/domain";

const profileCurrencyOptions = [
  { value: "PEN", label: "PEN", description: "Sol peruano" },
  { value: "USD", label: "USD", description: "Dolar estadounidense" },
  { value: "EUR", label: "EUR", description: "Euro" },
];

const timezoneCatalog = [
  { value: "America/Lima", label: "America/Lima", description: "Peru" },
  { value: "America/Bogota", label: "America/Bogota", description: "Colombia" },
  { value: "America/Santiago", label: "America/Santiago", description: "Chile" },
  {
    value: "America/Argentina/Buenos_Aires",
    label: "America/Argentina/Buenos_Aires",
    description: "Argentina",
  },
  { value: "America/Mexico_City", label: "America/Mexico_City", description: "Mexico" },
  { value: "America/New_York", label: "America/New_York", description: "Estados Unidos" },
  { value: "Europe/Madrid", label: "Europe/Madrid", description: "Espana" },
  { value: "UTC", label: "UTC", description: "Tiempo universal" },
];

const workspaceInviteRoleOptions: Array<{
  value: Exclude<WorkspaceRole, "owner">;
  label: string;
  description: string;
  leadingLabel: string;
  leadingColor: string;
}> = [
  {
    value: "admin",
    label: "Administrador",
    description: "Puede editar casi todo el workspace y también invitar a otros miembros.",
    leadingLabel: "AD",
    leadingColor: "#4566d6",
  },
  {
    value: "member",
    label: "Miembro",
    description: "Puede registrar y editar datos del workspace, sin administrar miembros.",
    leadingLabel: "MB",
    leadingColor: "#1b6a58",
  },
  {
    value: "viewer",
    label: "Solo lectura",
    description: "Puede revisar la información compartida sin editarla.",
    leadingLabel: "VR",
    leadingColor: "#b48b34",
  },
];

function getWorkspaceInvitationStatusLabel(status: "pending" | "accepted" | "declined" | "expired" | "revoked") {
  switch (status) {
    case "accepted":
      return "Aceptada";
    case "declined":
      return "Rechazada";
    case "expired":
      return "Expirada";
    case "revoked":
      return "Revocada";
    default:
      return "Pendiente";
  }
}

function getWorkspaceInvitationStatusTone(status: "pending" | "accepted" | "declined" | "expired" | "revoked") {
  switch (status) {
    case "accepted":
      return "success" as const;
    case "declined":
    case "revoked":
      return "warning" as const;
    case "expired":
      return "neutral" as const;
    default:
      return "info" as const;
  }
}

function startOfLocalDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function getDaysUntilDate(value?: string | null) {
  if (!value) {
    return null;
  }

  const today = startOfLocalDay(new Date()).getTime();
  const targetDate = startOfLocalDay(new Date(value)).getTime();
  return Math.round((targetDate - today) / 86400000);
}

function formatDaysRemainingLabel(daysRemaining: number | null) {
  if (daysRemaining === null) {
    return "Sin fecha reportada";
  }

  if (daysRemaining < 0) {
    const elapsedDays = Math.abs(daysRemaining);
    return elapsedDays === 1 ? "Venció hace 1 día" : `Venció hace ${elapsedDays} días`;
  }

  if (daysRemaining === 0) {
    return "Vence hoy";
  }

  if (daysRemaining === 1) {
    return "Queda 1 día";
  }

  return `Quedan ${daysRemaining} días`;
}

function getFriendlyBillingStatus(status?: string | null) {
  const normalizedStatus = status?.trim().toLowerCase() ?? null;

  switch (normalizedStatus) {
    case "checkout_created":
    case "checkout_opened":
      return {
        label: "Activacion pendiente",
        tone: "info" as const,
        description:
          "Ya abriste el proceso premium. Solo falta que el proveedor confirme el cobro para activar DarkMoney Pro.",
      };
    case "on_trial":
    case "trialing":
      return {
        label: "Prueba activa",
        tone: "success" as const,
        description:
          "Tu acceso premium esta corriendo correctamente en periodo de prueba.",
      };
    case "active":
      return {
        label: "Suscripcion activa",
        tone: "success" as const,
        description:
          "Tu acceso premium esta activo y la renovacion automatica sigue encendida.",
      };
    case "paused":
      return {
        label: "Suscripcion pausada",
        tone: "warning" as const,
        description:
          "La suscripcion esta pausada por ahora. Conviene revisar el estado del proveedor si quieres retomarla.",
      };
    case "past_due":
      return {
        label: "Pago pendiente",
        tone: "warning" as const,
        description:
          "El ultimo cobro no entro correctamente. Revisa tarjeta o fondos para no perder el acceso premium.",
      };
    case "unpaid":
      return {
        label: "Pago no completado",
        tone: "danger" as const,
        description:
          "La suscripcion quedo impaga. Si el cobro no se recupera, DarkMoney Pro terminara automaticamente.",
      };
    case "cancelled":
    case "canceled":
      return {
        label: "Renovacion cancelada",
        tone: "warning" as const,
        description:
          "La renovacion automatica ya esta apagada. Tu acceso seguira activo solo hasta el final del ciclo actual.",
      };
    case "expired":
      return {
        label: "Suscripcion vencida",
        tone: "danger" as const,
        description:
          "El acceso premium ya termino. Puedes activarlo otra vez cuando quieras desde este panel.",
      };
    default:
      return {
        label: "Sin suscripcion activa",
        tone: "neutral" as const,
        description:
          "Todavia no hay una suscripcion premium confirmada para esta cuenta.",
      };
  }
}

function NotificationPreferenceCard({
  checked,
  description,
  detail,
  isLive,
  onChange,
  title,
}: {
  checked: boolean;
  description: string;
  detail: string;
  isLive: boolean;
  onChange: (checked: boolean) => void;
  title: string;
}) {
  return (
    <label className="glass-panel-soft flex items-start justify-between gap-4 rounded-[24px] px-4 py-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-ink">{title}</span>
          <StatusBadge status={isLive ? "Disponible hoy" : "En preparación"} tone={isLive ? "success" : "warning"} />
          <StatusBadge status={checked ? "Activado" : "Desactivado"} tone={checked ? "info" : "neutral"} />
        </div>
        <p className="mt-2 text-sm leading-7 text-storm">{description}</p>
        <p className="mt-2 text-xs uppercase tracking-[0.18em] text-storm/75">{detail}</p>
      </div>
      <input
        checked={checked}
        className="mt-1 h-5 w-5 rounded border-ink/10 text-pine"
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
    </label>
  );
}

type SettingsPickerOption = {
  value: string;
  label: string;
  description: string;
  leadingLabel: string;
  leadingColor?: string;
  searchText?: string;
};

const settingsPickerFieldClassName =
  "w-full rounded-[24px] border border-white/10 bg-[#0d1420]/95 px-4 text-sm text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] outline-none transition duration-200 placeholder:text-storm/70 hover:border-white/14 hover:bg-[#101928] focus:border-pine/25 focus:bg-[#111b2a] focus:shadow-[0_0_0_4px_rgba(107,228,197,0.08)] disabled:cursor-not-allowed disabled:opacity-60";

function useSettingsPickerPanel(isOpen: boolean, onClose: () => void) {
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

function SettingsPicker({
  disabled = false,
  emptyMessage,
  onChange,
  options,
  placeholderDescription,
  placeholderLabel,
  queryPlaceholder,
  value,
}: {
  disabled?: boolean;
  emptyMessage?: string;
  onChange: (value: string) => void;
  options: SettingsPickerOption[];
  placeholderDescription: string;
  placeholderLabel: string;
  queryPlaceholder?: string;
  value: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useSettingsPickerPanel(isOpen, () => setIsOpen(false));
  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );
  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return options;
    }

    return options.filter((option) =>
      (option.searchText ?? `${option.label} ${option.description} ${option.leadingLabel}`)
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [options, query]);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
    }
  }, [isOpen]);

  return (
    <div className={`relative ${isOpen ? "z-50" : "z-10"}`} ref={containerRef}>
      <button
        className={`${settingsPickerFieldClassName} flex min-h-[5.25rem] items-start justify-between gap-3 py-3.5 text-left ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
        disabled={disabled}
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        type="button"
      >
        <span className="flex min-w-0 items-start gap-3">
          <span
            className="mt-0.5 flex h-10 min-w-[3.25rem] shrink-0 items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.04] px-3 text-sm font-semibold text-ink"
            style={{
              backgroundColor: selectedOption?.leadingColor ? `${selectedOption.leadingColor}22` : undefined,
              borderColor: selectedOption?.leadingColor ? `${selectedOption.leadingColor}55` : undefined,
              color: selectedOption?.leadingColor ? "#fff" : undefined,
            }}
          >
            {selectedOption?.leadingLabel ?? "?"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block whitespace-normal text-sm font-semibold leading-6 text-ink">
              {selectedOption ? selectedOption.label : placeholderLabel}
            </span>
            <span className="mt-1 block whitespace-normal text-xs leading-5 text-storm">
              {selectedOption ? selectedOption.description : placeholderDescription}
            </span>
          </span>
        </span>
        <ChevronDown className={`mt-2 h-4 w-4 shrink-0 text-storm transition ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen ? (
        <div className="animate-rise-in absolute left-0 right-0 top-[calc(100%+0.65rem)] z-50 rounded-[30px] border border-white/10 bg-[#09111c]/98 p-3 shadow-[0_30px_80px_rgba(0,0,0,0.58)]">
          {queryPlaceholder ? (
            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-storm" />
              <input
                autoFocus
                className="w-full rounded-[22px] border border-white/10 bg-[#101928] py-3.5 pl-11 pr-4 text-sm text-ink outline-none transition placeholder:text-storm/70 focus:border-pine/25 focus:shadow-[0_0_0_4px_rgba(107,228,197,0.08)]"
                onChange={(event) => setQuery(event.target.value)}
                placeholder={queryPlaceholder}
                type="text"
                value={query}
              />
            </div>
          ) : null}

          <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
            {filteredOptions.length ? (
              filteredOptions.map((option) => {
                const isSelected = option.value === value;

                return (
                  <button
                    className="flex w-full items-start justify-between gap-3 rounded-[24px] border border-white/5 bg-[#0d1623] px-4 py-3.5 text-left transition duration-200 hover:border-white/12"
                    key={option.value}
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                    type="button"
                  >
                    <span className="flex min-w-0 items-start gap-3">
                      <span
                        className="mt-0.5 flex h-11 min-w-[3.25rem] shrink-0 items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.04] px-3 text-sm font-semibold text-ink"
                        style={{
                          backgroundColor: option.leadingColor ? `${option.leadingColor}22` : undefined,
                          borderColor: option.leadingColor ? `${option.leadingColor}55` : undefined,
                          color: option.leadingColor ? "#fff" : undefined,
                        }}
                      >
                        {option.leadingLabel}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block whitespace-normal font-medium leading-6 text-ink">
                          {option.label}
                        </span>
                        <span className="mt-1 block whitespace-normal text-xs leading-5 text-storm">
                          {option.description}
                        </span>
                      </span>
                    </span>
                    {isSelected ? <Check className="h-4 w-4 shrink-0 text-pine" /> : null}
                  </button>
                );
              })
            ) : (
              <div className="rounded-[22px] border border-white/8 bg-[#0d1623] px-4 py-5 text-sm text-storm">
                {emptyMessage ?? "No encontramos resultados con ese filtro."}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function WorkspaceDialogShell({
  children,
  description,
  onClose,
  title,
}: {
  children: ReactNode;
  description: string;
  onClose: () => void;
  title: string;
}) {
  return (
    <div className="fixed inset-0 z-[80] isolate overflow-y-auto bg-[#02060d]/82 p-3 backdrop-blur-xl before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-32 before:bg-[#02060d]/68 before:backdrop-blur-2xl before:content-[''] sm:p-6">
      <div className="flex min-h-full items-center justify-center">
        <div className="animate-rise-in relative w-full max-w-[920px] overflow-hidden rounded-[38px] [transform:translateZ(0)] border border-white/10 bg-[#060b12]/95 shadow-[0_40px_130px_rgba(0,0,0,0.62)]">
          <div className="overflow-y-auto px-4 pb-6 pt-5 sm:px-6 sm:pb-7 sm:pt-6">
            <div className="flex items-start justify-between gap-4">
              <div className="max-w-3xl">
                <div className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/90">
                  Workspace colaborativo
                </div>
                <h2 className="mt-4 font-display text-3xl font-semibold text-ink sm:text-[2.5rem]">
                  {title}
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-9 text-storm">{description}</p>
              </div>

              <button
                className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-storm transition duration-200 hover:border-white/16 hover:bg-white/[0.08] hover:text-ink"
                onClick={onClose}
                type="button"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SettingsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, saveProfile, saveAvatar, user } = useAuth();
  const { canAccessProFeatures, isAdminOverride } = useProFeatureAccess();
  const {
    activeWorkspace,
    error: workspaceError,
    refetch: refetchWorkspaces,
    setActiveWorkspaceId,
    workspaces,
  } = useActiveWorkspace();
  const preferencesQuery = useNotificationPreferencesQuery(user?.id);
  const entitlementQuery = useCurrentUserEntitlementQuery(user?.id);
  const savePreferencesMutation = useSaveNotificationPreferencesMutation(user?.id);
  const cancelLegacyProSubscriptionMutation = useCancelProSubscriptionMutation(user?.id);
  const cancelPaddleSubscriptionMutation = useCancelPaddleSubscriptionMutation(user?.id);
  const createSharedWorkspaceMutation = useCreateSharedWorkspaceMutation(user?.id);
  const workspaceCollaborationQuery = useWorkspaceCollaborationQuery(activeWorkspace?.id);
  const createWorkspaceInvitationMutation = useCreateWorkspaceInvitationMutation(activeWorkspace?.id, user?.id);
  const snapshotQuery = useWorkspaceSnapshotQuery(activeWorkspace, user?.id, profile);
  const [fullName, setFullName] = useState(profile?.fullName ?? "");
  const [baseCurrencyCode, setBaseCurrencyCode] = useState(profile?.baseCurrencyCode ?? "PEN");
  const [timezone, setTimezone] = useState(profile?.timezone ?? "America/Lima");
  const [inAppEnabled, setInAppEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [billingFeedbackMessage, setBillingFeedbackMessage] = useState("");
  const [billingErrorMessage, setBillingErrorMessage] = useState("");
  const [isBillingAutoRefreshing, setIsBillingAutoRefreshing] = useState(false);
  const [workspaceFeedbackMessage, setWorkspaceFeedbackMessage] = useState("");
  const [workspaceErrorMessage, setWorkspaceErrorMessage] = useState("");
  const [isOpeningPaddleCheckout, setIsOpeningPaddleCheckout] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
  const [isCreateWorkspaceOpen, setIsCreateWorkspaceOpen] = useState(false);
  const [isInviteMemberOpen, setIsInviteMemberOpen] = useState(false);
  const [sharedWorkspaceName, setSharedWorkspaceName] = useState("");
  const [sharedWorkspaceDescription, setSharedWorkspaceDescription] = useState("");
  const [sharedWorkspaceCurrencyCode, setSharedWorkspaceCurrencyCode] = useState(
    activeWorkspace?.baseCurrencyCode ?? profile?.baseCurrencyCode ?? "PEN",
  );
  const [invitedEmail, setInvitedEmail] = useState("");
  const [invitedRole, setInvitedRole] = useState<Exclude<WorkspaceRole, "owner">>("member");
  const [invitationNote, setInvitationNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  useSuccessToast(feedbackMessage, {
    clear: () => setFeedbackMessage(""),
    title: "Configuración actualizada",
  });
  useSuccessToast(workspaceFeedbackMessage, {
    clear: () => setWorkspaceFeedbackMessage(""),
    title: "Workspace colaborativo actualizado",
  });
  const currencyOptions = useMemo(() => {
    if (!baseCurrencyCode.trim()) {
      return profileCurrencyOptions;
    }

    const hasCurrentCurrency = profileCurrencyOptions.some((option) => option.value === baseCurrencyCode);

    return hasCurrentCurrency
      ? profileCurrencyOptions
      : [
          { value: baseCurrencyCode, label: baseCurrencyCode, description: "Moneda actual" },
          ...profileCurrencyOptions,
        ];
  }, [baseCurrencyCode]);
  const timezoneOptions = useMemo(() => {
    if (!timezone.trim()) {
      return timezoneCatalog;
    }

    const hasCurrentTimezone = timezoneCatalog.some((option) => option.value === timezone);

    return hasCurrentTimezone
      ? timezoneCatalog
      : [
          { value: timezone, label: timezone, description: "Zona horaria actual" },
          ...timezoneCatalog,
        ];
  }, [timezone]);
  const currencyPickerOptions = useMemo<SettingsPickerOption[]>(
    () =>
      currencyOptions.map((option) => ({
        value: option.value,
        label: option.label,
        description: option.description,
        leadingLabel:
          option.value === "PEN" ? "S/" : option.value === "USD" ? "US$" : option.value === "EUR" ? "EUR" : option.value,
        leadingColor:
          option.value === "PEN" ? "#1b6a58" : option.value === "USD" ? "#4566d6" : option.value === "EUR" ? "#b48b34" : "#6b7280",
        searchText: `${option.value} ${option.label} ${option.description}`,
      })),
    [currencyOptions],
  );
  const timezonePickerOptions = useMemo<SettingsPickerOption[]>(
    () =>
      timezoneOptions.map((option) => ({
        value: option.value,
        label: option.label,
        description: option.description,
        leadingLabel: option.label.replace("America/", "").replace("Europe/", "").split("/")[0]?.slice(0, 3).toUpperCase() || "TZ",
        leadingColor: option.value === "America/Lima" ? "#1b6a58" : "#4566d6",
        searchText: `${option.value} ${option.label} ${option.description}`,
      })),
    [timezoneOptions],
  );
  const workspaceRolePickerOptions = useMemo<SettingsPickerOption[]>(
    () =>
      workspaceInviteRoleOptions.map((option) => ({
        value: option.value,
        label: option.label,
        description: option.description,
        leadingLabel: option.leadingLabel,
        leadingColor: option.leadingColor,
        searchText: `${option.value} ${option.label} ${option.description}`,
      })),
    [],
  );
  const collaboration = workspaceCollaborationQuery.data;
  const collaborationMembers = collaboration?.members ?? [];
  const collaborationInvitations = collaboration?.invitations ?? [];
  const canManageWorkspaceMembers =
    activeWorkspace?.kind === "shared" && Boolean(collaboration?.canManageMembers);

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

  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const billingStatus = query.get("billing");

    if (billingStatus === "paddle") {
      setBillingFeedbackMessage(
        "Volviste del checkout premium. Si Paddle ya confirmo el cobro, DarkMoney actualizara tu acceso automaticamente en cuanto llegue el webhook.",
      );
    } else if (billingStatus === "lemonsqueezy") {
      setBillingFeedbackMessage(
        "Volviste del checkout premium. Si ya completaste el pago, DarkMoney actualizara tu acceso automaticamente en cuanto Lemon Squeezy lo confirme.",
      );
    } else {
      setIsBillingAutoRefreshing(false);
      return;
    }

    let isCancelled = false;
    const timeoutHandles: number[] = [];
    const syncDelaysMs = [0, 1800, 4200, 8000, 12000];

    const stopAutoSync = (shouldCleanUrl: boolean) => {
      if (isCancelled) {
        return;
      }

      setIsBillingAutoRefreshing(false);

      if (shouldCleanUrl) {
        navigate(location.pathname, { replace: true });
      }
    };

    const runSync = async () => {
      if (isCancelled) {
        return;
      }

      setIsBillingAutoRefreshing(true);

      try {
        const result = await entitlementQuery.refetch();
        const latestEntitlement = result.data;
        const latestBillingStatus = latestEntitlement?.billingStatus?.trim().toLowerCase() ?? null;
        const hasReachedStableState =
          Boolean(latestEntitlement?.proAccessEnabled) ||
          ["expired", "cancelled", "canceled", "past_due", "unpaid"].includes(latestBillingStatus ?? "");

        if (latestEntitlement?.proAccessEnabled) {
          setBillingFeedbackMessage(
            "DarkMoney Pro ya quedo activo. Actualizamos tu acceso automaticamente en segundo plano.",
          );
        }

        if (hasReachedStableState) {
          stopAutoSync(true);
        }
      } catch {
        // Si falla un intento puntual, dejamos que los siguientes timeouts sigan intentando.
      }
    };

    for (const delay of syncDelaysMs) {
      timeoutHandles.push(window.setTimeout(() => void runSync(), delay));
    }

    const finalHandle = window.setTimeout(() => {
      stopAutoSync(true);
    }, syncDelaysMs[syncDelaysMs.length - 1] + 2000);

    timeoutHandles.push(finalHandle);

    return () => {
      isCancelled = true;
      setIsBillingAutoRefreshing(false);
      for (const handle of timeoutHandles) {
        window.clearTimeout(handle);
      }
    };
  }, [entitlementQuery.refetch, location.pathname, location.search, navigate]);

  useEffect(() => {
    if (isCreateWorkspaceOpen) {
      return;
    }

    setSharedWorkspaceCurrencyCode(activeWorkspace?.baseCurrencyCode ?? profile?.baseCurrencyCode ?? "PEN");
  }, [activeWorkspace?.baseCurrencyCode, isCreateWorkspaceOpen, profile?.baseCurrencyCode]);

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

      await refetchWorkspaces();
      if (activeWorkspace && user?.id) {
        await snapshotQuery.refetch();
      }

      setFeedbackMessage("Configuración actualizada correctamente.");
    } catch (error) {
      setErrorMessage(
        getQueryErrorMessage(error, "No pudimos guardar tu configuración. Intentá de nuevo."),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAvatarChange(file: File | null) {
    if (!file) return;
    setIsUploadingAvatar(true);
    try {
      await saveAvatar(file);
    } catch (error) {
      setErrorMessage(getQueryErrorMessage(error, "No pudimos actualizar tu foto de perfil."));
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  async function handleRemoveAvatar() {
    setIsUploadingAvatar(true);
    try {
      await saveAvatar(null);
    } catch (error) {
      setErrorMessage(getQueryErrorMessage(error, "No pudimos eliminar tu foto de perfil."));
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  async function handleStartProCheckout() {
    setBillingErrorMessage("");
    setBillingFeedbackMessage("");
    setShowCancelConfirmation(false);

    try {
      if (!user?.id || !user.email) {
        throw new Error("Necesitamos un usuario con email valido para abrir Paddle.");
      }

      if (!isPaddleCheckoutConfigured()) {
        throw new Error(
          "Falta configurar VITE_PADDLE_CLIENT_TOKEN y VITE_PADDLE_PRO_PRICE_ID para abrir Paddle.",
        );
      }

      setIsOpeningPaddleCheckout(true);
      await openPaddleProCheckout({
        appUrl: getPublicAppUrl(),
        payerEmail: user.email,
        userId: user.id,
        workspaceId: activeWorkspace?.id ?? null,
      });
    } catch (error) {
      setBillingErrorMessage(
        getQueryErrorMessage(
          error,
          "No pudimos abrir Paddle para activar DarkMoney Pro.",
        ),
      );
    } finally {
      setIsOpeningPaddleCheckout(false);
    }
  }

  async function handleCancelProSubscription() {
    setBillingErrorMessage("");
    setBillingFeedbackMessage("");

    try {
      const billingProvider = entitlement?.billingProvider?.trim().toLowerCase() ?? null;
      const mutation =
        billingProvider === "paddle"
          ? cancelPaddleSubscriptionMutation
          : cancelLegacyProSubscriptionMutation;
      const response = await mutation.mutateAsync();
      const friendlyStatus = getFriendlyBillingStatus(response.billingStatus);
      setShowCancelConfirmation(false);
      setBillingFeedbackMessage(
        response.billingStatus
          ? `${friendlyStatus.label}. DarkMoney ya ajusto tu acceso premium con la respuesta real del proveedor.`
          : "La suscripción de DarkMoney Pro fue cancelada correctamente.",
      );
    } catch (error) {
      setBillingErrorMessage(
        getQueryErrorMessage(
          error,
          "No pudimos cancelar la suscripción actual de DarkMoney Pro.",
        ),
      );
    }
  }

  async function handleCreateSharedWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorkspaceFeedbackMessage("");
    setWorkspaceErrorMessage("");

    try {
      const createdWorkspace = await createSharedWorkspaceMutation.mutateAsync({
        name: sharedWorkspaceName,
        description: sharedWorkspaceDescription,
        baseCurrencyCode: sharedWorkspaceCurrencyCode,
      });

      await refetchWorkspaces();
      setActiveWorkspaceId(createdWorkspace.id);
      setIsCreateWorkspaceOpen(false);
      setSharedWorkspaceName("");
      setSharedWorkspaceDescription("");
      setWorkspaceFeedbackMessage(
        `Creamos "${createdWorkspace.name}" y ya lo dejamos listo para empezar a invitar personas.`,
      );
    } catch (error) {
      setWorkspaceErrorMessage(
        getQueryErrorMessage(
          error,
          "No pudimos crear el workspace colaborativo.",
        ),
      );
    }
  }

  async function handleInviteMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorkspaceFeedbackMessage("");
    setWorkspaceErrorMessage("");

    if (!activeWorkspace) {
      setWorkspaceErrorMessage("Primero necesitamos un workspace activo para enviar invitaciones.");
      return;
    }

    try {
      const result = await createWorkspaceInvitationMutation.mutateAsync({
        workspaceId: activeWorkspace.id,
        invitedEmail,
        role: invitedRole,
        note: invitationNote,
        appUrl: getPublicAppUrl(),
      });

      if (!result.alreadyMember && !result.emailSent) {
        setWorkspaceErrorMessage(
          `La invitación quedó lista para ${result.invitedDisplayName ?? result.invitedEmail}, pero el correo automático aún no está configurado.`,
        );
        return;
      }

      setIsInviteMemberOpen(false);
      setInvitedEmail("");
      setInvitedRole("member");
      setInvitationNote("");
      setWorkspaceFeedbackMessage(
        result.alreadyMember
          ? `${result.invitedDisplayName ?? result.invitedEmail} ya pertenece a este workspace.`
          : `Le enviamos una invitación por correo a ${result.invitedDisplayName ?? result.invitedEmail}.`,
      );
    } catch (error) {
      setWorkspaceErrorMessage(
        getQueryErrorMessage(
          error,
          "No pudimos enviar la invitación de este workspace.",
        ),
      );
    }
  }

  const isSaving = isSubmitting || savePreferencesMutation.isPending;
  const isCreatingSharedWorkspace = createSharedWorkspaceMutation.isPending;
  const isInvitingMember = createWorkspaceInvitationMutation.isPending;
  const entitlement = entitlementQuery.data;
  const configuredCheckoutProviderLabel = isPaddleCheckoutConfigured() ? "Paddle" : "nuevo checkout";
  const providerLabel = getBillingProviderLabel(
    entitlement?.billingProvider ?? (isPaddleCheckoutConfigured() ? "paddle" : null),
  );
  const normalizedBillingProvider = entitlement?.billingProvider?.trim().toLowerCase() ?? null;
  const normalizedBillingStatus = entitlement?.billingStatus?.trim().toLowerCase() ?? null;
  const friendlyBillingStatus = getFriendlyBillingStatus(entitlement?.billingStatus);
  const daysRemaining = getDaysUntilDate(entitlement?.currentPeriodEnd);
  const activeCancelMutation =
    normalizedBillingProvider === "paddle"
      ? cancelPaddleSubscriptionMutation
      : cancelLegacyProSubscriptionMutation;
  const proStatusLabel = isAdminOverride
    ? "Admin con acceso total"
    : entitlement?.proAccessEnabled
      ? "DarkMoney Pro activo"
      : normalizedBillingStatus === "checkout_created" || normalizedBillingStatus === "checkout_opened"
        ? "Activacion en curso"
        : normalizedBillingStatus === "past_due"
          ? "Pago pendiente"
          : normalizedBillingStatus === "unpaid"
            ? "Cobro no completado"
            : (normalizedBillingStatus === "cancelled" || normalizedBillingStatus === "canceled") &&
                entitlement?.currentPeriodEnd &&
                (daysRemaining === null || daysRemaining >= 0)
              ? "Activo hasta fin de ciclo"
              : "Plan Free";
  const proStatusTone = isAdminOverride || entitlement?.proAccessEnabled
    ? "success"
    : normalizedBillingStatus === "checkout_created" || normalizedBillingStatus === "checkout_opened"
      ? "info"
      : normalizedBillingStatus === "past_due" ||
          normalizedBillingStatus === "cancelled" ||
          normalizedBillingStatus === "canceled"
        ? "warning"
        : normalizedBillingStatus === "unpaid" || normalizedBillingStatus === "expired"
          ? "danger"
          : "warning";
  const canCancelProPlan =
    !isAdminOverride &&
    Boolean(entitlement?.providerSubscriptionId) &&
    (
      (normalizedBillingProvider === "paddle" &&
        !entitlement?.cancelAtPeriodEnd &&
        ["trialing", "active", "paused"].includes(normalizedBillingStatus ?? "")) ||
      (normalizedBillingProvider === "lemon_squeezy" &&
        (entitlement?.proAccessEnabled ||
          ["on_trial", "active", "paused", "past_due", "unpaid", "cancelled"].includes(entitlement?.billingStatus ?? "")))
    );
  const currentPeriodBadge = isAdminOverride
    ? { status: "Acceso por override admin", tone: "success" as const }
    : normalizedBillingStatus === "checkout_created" || normalizedBillingStatus === "checkout_opened"
      ? { status: "Confirmacion pendiente", tone: "info" as const }
    : entitlement?.currentPeriodEnd
      ? normalizedBillingStatus === "expired" || (daysRemaining !== null && daysRemaining < 0)
        ? { status: `Vencio ${formatDate(entitlement.currentPeriodEnd)}`, tone: "warning" as const }
        : entitlement?.cancelAtPeriodEnd
          ? { status: `Termina ${formatDate(entitlement.currentPeriodEnd)}`, tone: "warning" as const }
          : { status: `Renueva ${formatDate(entitlement.currentPeriodEnd)}`, tone: "info" as const }
      : null;
  const remainingDaysBadge =
    !isAdminOverride &&
    entitlement?.currentPeriodEnd &&
    normalizedBillingStatus !== "checkout_created" &&
    normalizedBillingStatus !== "checkout_opened"
      ? {
          status: formatDaysRemainingLabel(daysRemaining),
          tone:
            normalizedBillingStatus === "expired" || (daysRemaining !== null && daysRemaining < 0)
              ? ("warning" as const)
              : daysRemaining !== null && daysRemaining <= 1
                ? ("warning" as const)
                : ("neutral" as const),
        }
      : null;
  const periodSummary = isAdminOverride
    ? "Esta cuenta entra por override administrativo y siempre mantiene acceso premium para pruebas internas."
    : normalizedBillingStatus === "checkout_created" || normalizedBillingStatus === "checkout_opened"
      ? "Tu activacion premium ya fue iniciada. Cuando el proveedor confirme el checkout, DarkMoney encendera el acceso Pro automaticamente."
    : entitlement?.currentPeriodEnd
      ? normalizedBillingStatus === "expired" || (daysRemaining !== null && daysRemaining < 0)
        ? `Tu ultimo periodo premium termino el ${formatDate(entitlement.currentPeriodEnd)}.`
        : entitlement?.cancelAtPeriodEnd
          ? `La suscripcion ya esta cancelada y seguira activa hasta el ${formatDate(entitlement.currentPeriodEnd)}.`
          : daysRemaining === 0
            ? `Tu suscripcion se renueva hoy, ${formatDate(entitlement.currentPeriodEnd)}.`
            : daysRemaining === 1
              ? `Tu suscripción se renueva mañana, ${formatDate(entitlement.currentPeriodEnd)}.`
              : `Tu suscripcion esta vigente y el siguiente corte es el ${formatDate(entitlement.currentPeriodEnd)}.`
      : "Todavia no hay un ciclo premium reportado para esta cuenta.";
  const statusSummary = isAdminOverride
    ? "Tu cuenta entra por acceso administrativo, asi que no depende del proveedor para mantener funciones premium."
    : friendlyBillingStatus.description;
  const nextStepSummary = isAdminOverride
    ? "No necesitas pagar ni reactivar nada mientras esta cuenta siga en modo administrador."
    : normalizedBillingStatus === "checkout_created" || normalizedBillingStatus === "checkout_opened"
      ? "Si ya pagaste, solo espera la confirmacion del proveedor o vuelve a actualizar en unos segundos. Si cerraste el checkout antes de terminar, puedes retomarlo desde este panel."
    : normalizedBillingStatus === "expired"
      ? "Como la suscripcion ya expiro, hoy el camino para volver a Pro es activarla de nuevo desde este panel."
      : entitlement?.cancelAtPeriodEnd && entitlement?.currentPeriodEnd
        ? `No se renovara automaticamente despues del ${formatDate(entitlement.currentPeriodEnd)}. Si luego quieres volver, podras activarla otra vez desde aqui.`
        : normalizedBillingStatus === "past_due" || normalizedBillingStatus === "unpaid"
          ? "Si el cobro se recupera, DarkMoney ajustara el acceso automaticamente cuando llegue el webhook de pago recuperado o exitoso."
          : entitlement?.providerSubscriptionId
            ? "Si el proveedor renueva, reanuda o recupera el pago, DarkMoney actualizara tu acceso automaticamente en segundo plano."
            : isPaddleCheckoutConfigured()
              ? `Si activas el plan, DarkMoney habilitara las funciones premium en cuanto ${configuredCheckoutProviderLabel} confirme la suscripcion.`
              : "Estamos preparando el nuevo checkout premium. En cuanto completes la configuracion de Paddle, el acceso Pro quedara listo desde este panel.";
  const primaryProActionLabel =
    normalizedBillingStatus === "checkout_created" || normalizedBillingStatus === "checkout_opened"
      ? "Continuar activacion Pro"
      : normalizedBillingStatus === "expired"
        ? "Reactivar DarkMoney Pro"
        : "Activar DarkMoney Pro";
  const coverageSummary = currentPeriodBadge?.status ?? friendlyBillingStatus.label;
  const cycleSummary = entitlement?.currentPeriodStart
    ? `Desde ${formatDate(entitlement.currentPeriodStart)}`
    : "Aun sin fecha de inicio";

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
        description="Administra tu perfil, preferencias de notificación, plan y la configuración del workspace activo."
        eyebrow="configuración"
        title="Configuración"
      />

      <form
        className="space-y-6"
        id="settings-form"
        noValidate
        onSubmit={(event) => void handleSubmit(event)}
      >
        <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <div className="relative z-20">
            <SurfaceCard
            action={<Briefcase className="h-5 w-5 text-gold" />}
            description="Tu nombre y los datos de acceso asociados a tu cuenta."
            title="Perfil"
          >
            <div className="grid gap-4">
              {canAccessProFeatures ? (
                <div className="flex items-center gap-4 rounded-[24px] border border-white/[0.07] bg-white/[0.025] p-4">
                  <div className="relative shrink-0">
                    {profile?.avatarUrl ? (
                      <img
                        alt={profile.fullName}
                        className="h-16 w-16 rounded-[20px] object-cover ring-1 ring-white/10"
                        src={profile.avatarUrl}
                      />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-gradient-to-br from-ember via-[#a8b9ff] to-pine font-display text-xl font-semibold text-void shadow-md">
                        {profile?.initials ?? "DM"}
                      </div>
                    )}
                    <label
                      className={`absolute -bottom-1.5 -right-1.5 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-[#0d1420] text-storm shadow-md transition hover:text-ink ${isUploadingAvatar ? "pointer-events-none opacity-60" : ""}`}
                    >
                      {isUploadingAvatar ? (
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Camera className="h-3.5 w-3.5" />
                      )}
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
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">Foto de perfil</p>
                    <p className="mt-1 text-xs leading-5 text-storm">
                      JPG, PNG o WebP hasta 2 MB. Se recorta al centro en cuadrado automaticamente.
                    </p>
                    {profile?.avatarUrl ? (
                      <button
                        className="mt-2 text-xs text-rosewood transition hover:opacity-75 disabled:opacity-50"
                        disabled={isUploadingAvatar}
                        onClick={() => void handleRemoveAvatar()}
                        type="button"
                      >
                        Eliminar foto
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-[24px] border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
                    <Camera className="h-4 w-4 text-storm/50" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-storm">Foto de perfil</p>
                    <p className="text-xs text-storm/55">Disponible con DarkMoney Pro.</p>
                  </div>
                </div>
              )}

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
                  <SettingsPicker
                    onChange={setBaseCurrencyCode}
                    options={currencyPickerOptions}
                    placeholderDescription="Usaremos esta moneda como lectura principal del workspace."
                    placeholderLabel="Selecciona una moneda"
                    queryPlaceholder="Buscar PEN, USD, EUR..."
                    value={baseCurrencyCode}
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-ink">Zona horaria</span>
                  <SettingsPicker
                    onChange={setTimezone}
                    options={timezonePickerOptions}
                    placeholderDescription="Afecta recordatorios, fechas y cortes visibles para ti."
                    placeholderLabel="Selecciona una zona horaria"
                    queryPlaceholder="Buscar zona horaria..."
                    value={timezone}
                  />
                </label>
              </div>
            </div>
            </SurfaceCard>
          </div>

          <SurfaceCard
            action={<BellDot className="h-5 w-5 text-ember" />}
            description="Elige cómo y cuándo recibir alertas de recordatorios, cobros y pagos del workspace."
            title="Preferencias de notificación"
          >
            {preferencesQuery.isLoading ? (
              <DataState
                description="Buscando tu configuración de alertas guardada."
                title="Cargando preferencias"
              />
            ) : preferencesQuery.error ? (
              <DataState
                description={getQueryErrorMessage(
                  preferencesQuery.error,
                  "No pudimos leer tus preferencias de notificación.",
                )}
                title="No fue posible cargar las preferencias"
                tone="error"
              />
            ) : (
              <div className="grid gap-3">
                <NotificationPreferenceCard
                  checked={inAppEnabled}
                  description="Muestra alertas dentro de DarkMoney, incluyendo el contador rojo, la bandeja de notificaciones y los recordatorios visibles en la app."
                  detail="Este canal ya funciona hoy dentro de la web."
                  isLive
                  onChange={setInAppEnabled}
                  title="Alertas dentro de la app"
                />
                <NotificationPreferenceCard
                  checked={emailEnabled}
                  description="Guarda si quieres recibir correos cuando venzan suscripciones, cobros esperados, pagos pendientes u otras alertas importantes."
                  detail="Por ahora guardamos tu preferencia. Los correos automáticos se están preparando."
                  isLive={false}
                  onChange={setEmailEnabled}
                  title="Recordatorios por correo"
                />
                <NotificationPreferenceCard
                  checked={pushEnabled}
                  description="Reserva tu preferencia para futuras notificaciones push en navegador o app móvil, sin depender de que tengas abierta la bandeja."
                  detail="Todavía no enviamos push reales. Esta opción queda guardada para activarla después."
                  isLive={false}
                  onChange={setPushEnabled}
                  title="Notificaciones push"
                />
                <div className="rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-4 text-sm leading-7 text-storm">
                  Hoy la funcionalidad activa es la bandeja dentro de la app. Correo y push ya se guardan en tu perfil para usarlos cuando se habiliten esos canales.
                </div>
              </div>
            )}
          </SurfaceCard>
        </section>

        {errorMessage ? (
          <FormFeedbackBanner
            description={errorMessage}
            title="No pudimos guardar los cambios"
          />
        ) : null}
        {workspaceErrorMessage ? (
          <FormFeedbackBanner
            description={workspaceErrorMessage}
            title="No pudimos completar el flujo colaborativo"
          />
        ) : null}
        <SurfaceCard
          action={<Sparkles className="h-5 w-5 text-gold" />}
          description="Accede a funciones premium como el dashboard avanzado y la gestión de comprobantes con DarkMoney Pro."
          title="DarkMoney Pro"
        >
          {entitlementQuery.isLoading ? (
            <DataState
              description="Verificando el estado de tu acceso premium."
              title="Cargando plan"
            />
          ) : entitlementQuery.error ? (
            <DataState
              description={getQueryErrorMessage(
                entitlementQuery.error,
                "No pudimos consultar el estado actual de tu plan.",
              )}
              title="No fue posible leer el plan"
              tone="error"
            />
          ) : (
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.18fr)_minmax(320px,0.82fr)]">
              <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(76,109,255,0.18),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(107,228,197,0.12),transparent_28%),linear-gradient(160deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02)_34%,rgba(5,9,16,0.78)_100%)] p-6">
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent_32%,rgba(255,255,255,0.01)_100%)]" />
                <div className="relative">
                <div className="flex flex-wrap items-center gap-3">
                  <StatusBadge status={proStatusLabel} tone={proStatusTone} />
                  {currentPeriodBadge ? (
                    <StatusBadge
                      status={currentPeriodBadge.status}
                      tone={currentPeriodBadge.tone}
                    />
                  ) : null}
                  {remainingDaysBadge ? (
                    <StatusBadge
                      status={remainingDaysBadge.status}
                      tone={remainingDaysBadge.tone}
                    />
                  ) : null}
                </div>
                <p className="mt-6 text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-storm/70">
                  Premium access
                </p>
                <h3 className="mt-3 max-w-3xl font-display text-4xl font-semibold leading-tight text-ink">
                  {isAdminOverride
                    ? "Tu cuenta administradora ya tiene acceso Pro"
                    : canAccessProFeatures
                      ? "Tu cuenta ya puede usar DarkMoney Pro"
                      : normalizedBillingStatus === "checkout_created" || normalizedBillingStatus === "checkout_opened"
                        ? "Tu activacion premium ya esta en marcha"
                        : "Activa DarkMoney Pro para desbloquear el nivel premium"}
                </h3>
                <p className="mt-4 max-w-3xl text-sm leading-8 text-storm">
                  {isAdminOverride
                    ? "Esta cuenta entra por override administrativo, asi que no necesita pasar por ningun checkout externo para probar funciones premium."
                    : canAccessProFeatures
                      ? "Tu acceso premium ya esta activo. DarkMoney seguira sincronizando renovaciones, cobros y cambios de estado automaticamente."
                      : normalizedBillingStatus === "checkout_created" || normalizedBillingStatus === "checkout_opened"
                        ? "Ya abriste el checkout premium. Cuando el proveedor confirme el proceso, DarkMoney activara tu acceso automaticamente."
                        : isPaddleCheckoutConfigured()
                          ? "Desbloquea dashboard avanzado, Aprendiendo de ti, comprobantes y alertas premium con una suscripcion conectada a Paddle."
                          : "El codigo de Lemon queda guardado, pero el nuevo flujo visible ahora se preparara desde Paddle."}
                </p>

                {billingErrorMessage ? (
                  <FormFeedbackBanner
                    className="mt-5"
                    description={billingErrorMessage}
                    title="No pudimos abrir Paddle"
                  />
                ) : null}
                {billingFeedbackMessage ? (
                  <FormFeedbackBanner
                    className="mt-5"
                    description={billingFeedbackMessage}
                    title="Seguimiento de tu suscripción"
                    tone="info"
                  />
                ) : null}
                {showCancelConfirmation ? (
                  <FormFeedbackBanner
                    action={
                      <div className="flex flex-wrap gap-3">
                        <Button
                          disabled={activeCancelMutation.isPending}
                          onClick={() => void handleCancelProSubscription()}
                        >
                          {activeCancelMutation.isPending
                            ? "Cancelando..."
                            : "Confirmar cancelación"}
                        </Button>
                        <Button
                          disabled={activeCancelMutation.isPending}
                          onClick={() => setShowCancelConfirmation(false)}
                          variant="ghost"
                        >
                          Mantener plan
                        </Button>
                      </div>
                    }
                    badgeLabel="Confirmación"
                    className="mt-5"
                    description={`La cancelacion se enviara a ${providerLabel} y DarkMoney actualizara tu acceso Pro con la respuesta real del proveedor.`}
                    title="Vas a cancelar la suscripción de DarkMoney Pro"
                  />
                ) : null}
                {!isAdminOverride && !canAccessProFeatures && !isPaddleCheckoutConfigured() ? (
                  <FormFeedbackBanner
                    badgeLabel="Paddle"
                    className="mt-5"
                    description="Completa VITE_PADDLE_CLIENT_TOKEN y VITE_PADDLE_PRO_PRICE_ID para habilitar el nuevo checkout premium desde el frontend."
                    title="Paddle todavia no esta configurado en esta build"
                    tone="info"
                  />
                ) : null}

                <div className="mt-5 flex flex-wrap gap-3">
                  {!isAdminOverride && !canAccessProFeatures && isPaddleCheckoutConfigured() ? (
                    <Button
                      disabled={isOpeningPaddleCheckout}
                      onClick={() => void handleStartProCheckout()}
                    >
                      {isOpeningPaddleCheckout
                        ? "Abriendo Paddle..."
                        : primaryProActionLabel}
                    </Button>
                  ) : null}
                  {canCancelProPlan ? (
                    <Button
                      disabled={activeCancelMutation.isPending}
                      onClick={() => setShowCancelConfirmation(true)}
                      variant="secondary"
                    >
                      Cancelar Pro
                    </Button>
                  ) : null}
                  <Button
                    disabled={entitlementQuery.isFetching}
                    onClick={() => void entitlementQuery.refetch()}
                    variant="ghost"
                  >
                    {isBillingAutoRefreshing
                      ? "Sincronizando..."
                      : entitlementQuery.isFetching
                        ? "Actualizando..."
                        : "Actualizar estado"}
                  </Button>
                </div>
                <div className="mt-6 flex flex-wrap gap-2">
                  {["Dashboard avanzado", "Aprendiendo de ti", "Comprobantes", "Alertas inteligentes"].map((feature) => (
                    <span
                      className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-semibold tracking-[0.18em] text-storm/90"
                      key={feature}
                    >
                      {feature}
                    </span>
                  ))}
                </div>
                <div className="mt-6 grid gap-3 md:grid-cols-2">
                  <article className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    <p className="text-xs uppercase tracking-[0.18em] text-storm">Estado</p>
                    <p className="mt-3 text-lg font-semibold text-ink">{friendlyBillingStatus.label}</p>
                    <p className="mt-2 text-sm leading-7 text-storm">{statusSummary}</p>
                  </article>
                  <article className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    <p className="text-xs uppercase tracking-[0.18em] text-storm">Vigencia</p>
                    <p className="mt-3 text-lg font-semibold text-ink">{coverageSummary}</p>
                    <p className="mt-2 text-sm leading-7 text-storm">{periodSummary}</p>
                  </article>
                </div>
                </div>
              </div>

              <div className="grid gap-3">
                <article className="glass-panel-soft rounded-[24px] p-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-storm">Ciclo activo</p>
                  <div className="mt-4 flex flex-col divide-y divide-white/[0.06]">
                    <div className="flex items-center justify-between gap-3 pb-3">
                      <p className="text-xs text-storm">Inicio</p>
                      <p className="text-sm font-medium text-ink">{cycleSummary}</p>
                    </div>
                    <div className="flex items-center justify-between gap-3 py-3">
                      <p className="text-xs text-storm">Siguiente corte</p>
                      <p className="text-sm font-medium text-ink">
                        {entitlement?.currentPeriodEnd ? formatDate(entitlement.currentPeriodEnd) : "—"}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-3 pt-3">
                      <p className="text-xs text-storm">Dias restantes</p>
                      <p className="text-sm font-medium text-ink">
                        {remainingDaysBadge?.status ?? "—"}
                      </p>
                    </div>
                  </div>
                </article>

                <article className="glass-panel-soft rounded-[24px] p-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-storm">Que incluye Pro</p>
                  <ul className="mt-4 flex flex-col gap-2.5">
                    {["Dashboard avanzado", "Aprendiendo de ti", "Gestion de comprobantes", "Alertas inteligentes", "Mejoras futuras incluidas"].map((feature) => (
                      <li className="flex items-center gap-2.5 text-sm text-storm" key={feature}>
                        <Check className="h-3.5 w-3.5 shrink-0 text-pine" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </article>

                {nextStepSummary ? (
                  <article className="glass-panel-soft rounded-[24px] p-5">
                    <p className="text-xs uppercase tracking-[0.2em] text-storm">Proximos pasos</p>
                    <p className="mt-3 text-sm leading-7 text-storm">{nextStepSummary}</p>
                  </article>
                ) : null}
              </div>
            </div>
          )}
        </SurfaceCard>

        <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <SurfaceCard
            action={<ShieldCheck className="h-5 w-5 text-pine" />}
            description="Detalles, moneda base y opciones del workspace que tenés seleccionado."
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
                    {activeWorkspace.description || "Sin descripción registrada."}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <StatusBadge status={formatWorkspaceKindLabel(activeWorkspace.kind)} tone="info" />
                    <StatusBadge status={formatWorkspaceRoleLabel(activeWorkspace.role)} tone="success" />
                    <StatusBadge status={`Base ${activeWorkspace.baseCurrencyCode}`} tone="neutral" />
                    <StatusBadge
                      status={`${workspaces.length} espacios`}
                      tone="neutral"
                    />
                    {activeWorkspace.kind === "shared" && collaboration ? (
                      <StatusBadge
                        status={`${collaborationMembers.length} miembros`}
                        tone="info"
                      />
                    ) : null}
                    {activeWorkspace.kind === "shared" && collaboration ? (
                      <StatusBadge
                        status={`${collaborationInvitations.length} invitaciones pendientes`}
                        tone="neutral"
                      />
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={() => {
                      setWorkspaceErrorMessage("");
                      setWorkspaceFeedbackMessage("");
                      setSharedWorkspaceName("");
                      setSharedWorkspaceDescription("");
                      setSharedWorkspaceCurrencyCode(activeWorkspace.baseCurrencyCode || profile?.baseCurrencyCode || "PEN");
                      setIsCreateWorkspaceOpen(true);
                    }}
                    variant="ghost"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Crear workspace compartido
                  </Button>
                  {activeWorkspace.kind === "shared" && canManageWorkspaceMembers ? (
                    <Button
                      onClick={() => {
                        setWorkspaceErrorMessage("");
                        setWorkspaceFeedbackMessage("");
                        setInvitedEmail("");
                        setInvitedRole("member");
                        setInvitationNote("");
                        setIsInviteMemberOpen(true);
                      }}
                    >
                      <MailPlus className="mr-2 h-4 w-4" />
                      Invitar miembro
                    </Button>
                  ) : null}
                </div>

                {activeWorkspace.kind === "shared" && !canManageWorkspaceMembers ? (
                  <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4 text-sm leading-7 text-storm">
                    Tu rol actual es {formatWorkspaceRoleLabel(activeWorkspace.role).toLowerCase()}.
                    Puedes ver este workspace y trabajar segun tus permisos, pero solo owner y
                    admin pueden invitar nuevos miembros.
                  </div>
                ) : null}

                {activeWorkspace.kind === "personal" ? (
                  <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4 text-sm leading-7 text-storm">
                    Este es tu workspace personal. Si quieres trabajar con otra persona, crea un
                    workspace compartido y mueve o registra ahi las cuentas, movimientos,
                    presupuestos, suscripciones y créditos/deudas que quieran ver juntos.
                  </div>
                ) : workspaceCollaborationQuery.isLoading ? (
                  <DataState
                    description="Buscando miembros activos e invitaciones del workspace."
                    title="Cargando colaboración"
                  />
                ) : workspaceCollaborationQuery.error ? (
                  <DataState
                    description={getQueryErrorMessage(
                      workspaceCollaborationQuery.error,
                      "No pudimos leer los miembros ni las invitaciones de este workspace.",
                    )}
                    title="No pudimos cargar la colaboración"
                    tone="error"
                  />
                ) : (
                  <div className="grid gap-4 xl:grid-cols-2">
                    <div className="glass-panel-soft rounded-[24px] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-storm">Miembros</p>
                        <StatusBadge status={`${collaborationMembers.length} activos`} tone="info" />
                      </div>
                      <div className="mt-4 space-y-3">
                        {collaborationMembers.length ? (
                          collaborationMembers.map((member) => (
                            <div
                              className="rounded-[20px] border border-white/10 bg-black/15 p-4"
                              key={member.userId}
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium text-ink">{member.fullName}</p>
                                {member.isCurrentUser ? (
                                  <StatusBadge status="Tu cuenta" tone="success" />
                                ) : null}
                                {member.isDefaultWorkspace ? (
                                  <StatusBadge status="Default" tone="neutral" />
                                ) : null}
                              </div>
                              <p className="mt-2 text-sm leading-7 text-storm">
                                {member.email ?? "Sin correo visible"}
                              </p>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <StatusBadge status={formatWorkspaceRoleLabel(member.role)} tone="info" />
                                <StatusBadge status={`Desde ${formatDate(member.joinedAt)}`} tone="neutral" />
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-[20px] border border-white/10 bg-black/15 p-4 text-sm leading-7 text-storm">
                            Aún no hay miembros cargados para este workspace.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="glass-panel-soft rounded-[24px] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-storm">Invitaciones pendientes</p>
                        <StatusBadge status={`${collaborationInvitations.length} abiertas`} tone="neutral" />
                      </div>
                      <div className="mt-4 space-y-3">
                        {collaborationInvitations.length ? (
                          collaborationInvitations.map((invitation) => (
                            <div
                              className="rounded-[20px] border border-white/10 bg-black/15 p-4"
                              key={invitation.id}
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium text-ink">
                                  {invitation.invitedDisplayName ?? invitation.invitedEmail}
                                </p>
                                <StatusBadge
                                  status={getWorkspaceInvitationStatusLabel(invitation.status)}
                                  tone={getWorkspaceInvitationStatusTone(invitation.status)}
                                />
                              </div>
                              <p className="mt-2 text-sm leading-7 text-storm">{invitation.invitedEmail}</p>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <StatusBadge status={formatWorkspaceRoleLabel(invitation.role)} tone="info" />
                                <StatusBadge status={`Enviada ${formatDate(invitation.lastSentAt ?? invitation.createdAt)}`} tone="neutral" />
                              </div>
                              {invitation.note ? (
                                <p className="mt-3 text-sm leading-7 text-storm">{invitation.note}</p>
                              ) : null}
                            </div>
                          ))
                        ) : (
                          <div className="rounded-[20px] border border-white/10 bg-black/15 p-4 text-sm leading-7 text-storm">
                            No hay invitaciones pendientes ahora mismo.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <DataState
                description="Todavía no existe un workspace activo para esta sesión."
                title="Sin workspace activo"
              />
            )}
          </SurfaceCard>

          <SurfaceCard
            action={<Tag className="h-5 w-5 text-gold" />}
            description="Resumen de categorías, cuentas, contactos y suscripciones del workspace activo."
            title="Catálogos del workspace"
          >
            {!activeWorkspace ? (
              <DataState
                description="Los catalogos se mostraran cuando exista un workspace seleccionado."
                title="Sin contexto de workspace"
              />
            ) : snapshotQuery.isLoading ? (
              <DataState
                description="Consultando categorías, contactos y cuentas del workspace."
                title="Cargando catálogos"
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

      {isCreateWorkspaceOpen ? (
        <WorkspaceDialogShell
          description="Crea un espacio aparte para llevar finanzas con otra persona, familia o equipo sin mezclarlo con tu workspace personal."
          onClose={() => {
            if (!isCreatingSharedWorkspace) {
              setIsCreateWorkspaceOpen(false);
            }
          }}
          title="Crear workspace compartido"
        >
          <form
            className="space-y-5"
            noValidate
            onSubmit={(event) => void handleCreateSharedWorkspace(event)}
          >
            <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="glass-panel-soft rounded-[28px] p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-storm">Identidad</p>
                <div className="mt-5 grid gap-5">
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-ink">Nombre del workspace</span>
                    <input
                      className="field-dark"
                      onChange={(event) => setSharedWorkspaceName(event.target.value)}
                      placeholder="Ej. Finanzas Kevin y Adrian"
                      type="text"
                      value={sharedWorkspaceName}
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-ink">Descripción</span>
                    <textarea
                      className="field-dark min-h-[140px] py-4"
                      onChange={(event) => setSharedWorkspaceDescription(event.target.value)}
                      placeholder="Ej. Workspace para llevar gastos, ingresos y metas del hogar."
                      value={sharedWorkspaceDescription}
                    />
                  </label>
                </div>
              </div>

              <div className="glass-panel-soft rounded-[28px] p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-storm">Base</p>
                <div className="mt-5 grid gap-5">
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-ink">Moneda base</span>
                    <SettingsPicker
                      onChange={setSharedWorkspaceCurrencyCode}
                      options={currencyPickerOptions}
                      placeholderDescription="Se usara para resúmenes y conversiones de este workspace."
                      placeholderLabel="Selecciona una moneda"
                      queryPlaceholder="Buscar PEN, USD, EUR..."
                      value={sharedWorkspaceCurrencyCode}
                    />
                  </label>
                  <div className="rounded-[24px] border border-white/10 bg-black/15 p-4 text-sm leading-7 text-storm">
                    DarkMoney lo creará como un workspace separado, con tu cuenta como
                    propietaria. Luego podrás invitar miembros y cambiar a ese espacio desde el
                    selector superior.
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-end">
              <Button
                disabled={isCreatingSharedWorkspace}
                onClick={() => setIsCreateWorkspaceOpen(false)}
                type="button"
                variant="ghost"
              >
                Cancelar
              </Button>
              <Button
                disabled={isCreatingSharedWorkspace}
                type="submit"
              >
                {isCreatingSharedWorkspace ? (
                  <>
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                    Creando...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Crear workspace
                  </>
                )}
              </Button>
            </div>
          </form>
        </WorkspaceDialogShell>
      ) : null}

      {isInviteMemberOpen && activeWorkspace ? (
        <WorkspaceDialogShell
          description={`Invita a una persona que ya exista en DarkMoney para que vea y trabaje dentro de ${activeWorkspace.name}.`}
          onClose={() => {
            if (!isInvitingMember) {
              setIsInviteMemberOpen(false);
            }
          }}
          title="Invitar miembro al workspace"
        >
          <form
            className="space-y-5"
            noValidate
            onSubmit={(event) => void handleInviteMember(event)}
          >
            <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="glass-panel-soft rounded-[28px] p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-storm">Invitación</p>
                <div className="mt-5 grid gap-5">
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-ink">Correo del usuario</span>
                    <input
                      autoComplete="email"
                      className="field-dark"
                      onChange={(event) => setInvitedEmail(event.target.value)}
                      placeholder="persona@correo.com"
                      type="email"
                      value={invitedEmail}
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-ink">Mensaje</span>
                    <textarea
                      className="field-dark min-h-[140px] py-4"
                      onChange={(event) => setInvitationNote(event.target.value)}
                      placeholder="Ej. Te invito para que revisemos juntos este espacio financiero."
                      value={invitationNote}
                    />
                  </label>
                </div>
              </div>

              <div className="glass-panel-soft rounded-[28px] p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-storm">Rol</p>
                <div className="mt-5 grid gap-5">
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-ink">Permiso sugerido</span>
                    <SettingsPicker
                      onChange={(value) => setInvitedRole(value as Exclude<WorkspaceRole, "owner">)}
                      options={workspaceRolePickerOptions}
                      placeholderDescription="Elige el nivel de acceso para esta persona."
                      placeholderLabel="Selecciona un rol"
                      queryPlaceholder="Buscar rol..."
                      value={invitedRole}
                    />
                  </label>
                  <div className="rounded-[24px] border border-white/10 bg-black/15 p-4 text-sm leading-7 text-storm">
                    La persona recibira un correo bonito para aceptar el acceso. Cuando confirme,
                    este workspace le aparecera en su selector sin necesidad de Modo Pro.
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-end">
              <Button
                disabled={isInvitingMember}
                onClick={() => setIsInviteMemberOpen(false)}
                type="button"
                variant="ghost"
              >
                Cancelar
              </Button>
              <Button
                disabled={isInvitingMember}
                type="submit"
              >
                {isInvitingMember ? (
                  <>
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <MailPlus className="mr-2 h-4 w-4" />
                    Enviar invitacion
                  </>
                )}
              </Button>
            </div>
          </form>
        </WorkspaceDialogShell>
      ) : null}
    </div>
  );
}
