import {
  Archive,
  Banknote,
  BarChart3,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  CreditCard,
  Download,
  Landmark,
  LoaderCircle,
  PiggyBank,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  TrendingUp,
  Wallet2,
  X,
} from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "../../../components/ui/button";
import { DataState } from "../../../components/ui/data-state";
import { DeleteConfirmDialog } from "../../../components/ui/delete-confirm-dialog";
import { FormFeedbackBanner } from "../../../components/ui/form-feedback-banner";
import { useUndoQueue } from "../../../components/ui/undo-queue";
import { PageHeader } from "../../../components/ui/page-header";
import { StatusBadge } from "../../../components/ui/status-badge";
import { UnsavedChangesDialog } from "../../../components/ui/unsaved-changes-dialog";
import { SurfaceCard } from "../../../components/ui/surface-card";
import { useSuccessToast } from "../../../components/ui/toast-provider";
import { useViewMode, ViewSelector } from "../../../components/ui/view-selector";
import { ColumnPicker, type ColumnDef, useColumnVisibility } from "../../../components/ui/column-picker";
import { BulkActionBar, SelectionCheckbox, useSelection, createLongPressHandlers, wasRecentLongPress } from "../../../components/ui/bulk-action-bar";
import { formatDateTime } from "../../../lib/formatting/dates";
import { formatWorkspaceKindLabel } from "../../../lib/formatting/labels";
import { formatCurrency, resolveAggregateBalanceDisplay } from "../../../lib/formatting/money";
import { useAuth } from "../../auth/auth-context";
import { useActiveWorkspace } from "../../workspaces/use-active-workspace";
import { AccountAnalyticsModal } from "../components/account-analytics-modal";
import type { AccountSummary } from "../../../types/domain";
import {
  getQueryErrorMessage,
  type AccountFormInput,
  useArchiveAccountMutation,
  useCreateAccountMutation,
  useDeleteAccountMutation,
  useWorkspaceSnapshotQuery,
  useUpdateAccountMutation,
} from "../../../services/queries/workspace-data";

type AccountEditorMode = "create" | "edit";

type AccountFormState = {
  name: string;
  type: string;
  currencyCode: string;
  openingBalance: string;
  includeInNetWorth: boolean;
  color: string;
  icon: string;
};

const accountTypeOptions = [
  {
    value: "cash",
    label: "Efectivo",
    icon: "wallet",
    color: "#1b6a58",
    description: "Billeteras, efectivo diario y caja chica.",
  },
  {
    value: "bank",
    label: "Cuenta bancaria",
    icon: "landmark",
    color: "#4566d6",
    description: "Cuenta corriente, bancaria o digital.",
  },
  {
    value: "savings",
    label: "Ahorros",
    icon: "piggy-bank",
    color: "#b48b34",
    description: "Fondos reservados y metas de ahorro.",
  },
  {
    value: "credit_card",
    label: "Tarjeta de credito",
    icon: "credit-card",
    color: "#8f3e3e",
    description: "Lineas de consumo y tarjetas activas.",
  },
  {
    value: "investment",
    label: "Inversion",
    icon: "trending-up",
    color: "#8366f2",
    description: "Brokers, portafolios y activos invertidos.",
  },
  {
    value: "loan_wallet",
    label: "Prestamos",
    icon: "briefcase",
    color: "#c46a31",
    description: "Creditos, deudas o cartera prestada.",
  },
  {
    value: "other",
    label: "Otro",
    icon: "banknote",
    color: "#6b7280",
    description: "Contenedores especiales o cuentas mixtas.",
  },
] as const;

const iconOptions = [
  { value: "wallet", label: "Wallet", description: "Billetera, cash o caja general." },
  { value: "landmark", label: "Landmark", description: "Banco, fintech o cuenta principal." },
  { value: "piggy-bank", label: "Piggy bank", description: "Ahorro, reserva o meta." },
  { value: "credit-card", label: "Credit card", description: "Tarjeta, consumo o linea." },
  { value: "trending-up", label: "Trending", description: "Inversiones y crecimiento." },
  { value: "briefcase", label: "Briefcase", description: "Prestamos y cartera financiera." },
  { value: "banknote", label: "Banknote", description: "Caja, fondos o categoria libre." },
] as const;

const editorColorSwatches = [
  "#1b6a58",
  "#2d9076",
  "#4566d6",
  "#6f82f1",
  "#b48b34",
  "#d39d3a",
  "#8f3e3e",
  "#c55f5f",
  "#8366f2",
  "#9c7dff",
  "#c46a31",
  "#6b7280",
] as const;

const currencyOptions = [
  { code: "PEN", label: "Sol peruano", region: "Peru", symbol: "S/" },
  { code: "USD", label: "Dolar estadounidense", region: "Estados Unidos", symbol: "$" },
  { code: "EUR", label: "Euro", region: "Union Europea", symbol: "EUR" },
  { code: "GBP", label: "Libra esterlina", region: "Reino Unido", symbol: "GBP" },
  { code: "JPY", label: "Yen japones", region: "Japon", symbol: "JPY" },
  { code: "CNY", label: "Yuan chino", region: "China", symbol: "CNY" },
  { code: "AUD", label: "Dolar australiano", region: "Australia", symbol: "AUD" },
  { code: "CAD", label: "Dolar canadiense", region: "Canada", symbol: "CAD" },
  { code: "CHF", label: "Franco suizo", region: "Suiza", symbol: "CHF" },
  { code: "BRL", label: "Real brasileno", region: "Brasil", symbol: "R$" },
  { code: "MXN", label: "Peso mexicano", region: "Mexico", symbol: "MXN" },
  { code: "CLP", label: "Peso chileno", region: "Chile", symbol: "CLP" },
  { code: "COP", label: "Peso colombiano", region: "Colombia", symbol: "COP" },
  { code: "ARS", label: "Peso argentino", region: "Argentina", symbol: "ARS" },
  { code: "BOB", label: "Boliviano", region: "Bolivia", symbol: "BOB" },
  { code: "UYU", label: "Peso uruguayo", region: "Uruguay", symbol: "UYU" },
  { code: "PYG", label: "Guarani", region: "Paraguay", symbol: "PYG" },
  { code: "VES", label: "Bolivar digital", region: "Venezuela", symbol: "VES" },
  { code: "CRC", label: "Colon costarricense", region: "Costa Rica", symbol: "CRC" },
  { code: "DOP", label: "Peso dominicano", region: "Republica Dominicana", symbol: "DOP" },
  { code: "GTQ", label: "Quetzal", region: "Guatemala", symbol: "GTQ" },
  { code: "HNL", label: "Lempira", region: "Honduras", symbol: "HNL" },
  { code: "NIO", label: "Cordoba oro", region: "Nicaragua", symbol: "NIO" },
  { code: "PAB", label: "Balboa", region: "Panama", symbol: "PAB" },
  { code: "SGD", label: "Dolar de Singapur", region: "Singapur", symbol: "SGD" },
  { code: "HKD", label: "Dolar de Hong Kong", region: "Hong Kong", symbol: "HKD" },
  { code: "NZD", label: "Dolar neozelandes", region: "Nueva Zelanda", symbol: "NZD" },
  { code: "SEK", label: "Corona sueca", region: "Suecia", symbol: "SEK" },
  { code: "NOK", label: "Corona noruega", region: "Noruega", symbol: "NOK" },
  { code: "DKK", label: "Corona danesa", region: "Dinamarca", symbol: "DKK" },
  { code: "ZAR", label: "Rand sudafricano", region: "Sudafrica", symbol: "ZAR" },
  { code: "AED", label: "Dirham de Emiratos", region: "Emiratos Arabes Unidos", symbol: "AED" },
  { code: "SAR", label: "Riyal saudita", region: "Arabia Saudita", symbol: "SAR" },
  { code: "INR", label: "Rupia india", region: "India", symbol: "INR" },
  { code: "KRW", label: "Won surcoreano", region: "Corea del Sur", symbol: "KRW" },
  { code: "TRY", label: "Lira turca", region: "Turquia", symbol: "TRY" },
] as const;

type CurrencyOption = (typeof currencyOptions)[number];
type IconOption = (typeof iconOptions)[number];

function getTypePreset(type: string) {
  return accountTypeOptions.find((option) => option.value === type) ?? accountTypeOptions[0];
}

function getIconOption(icon: string): IconOption {
  return iconOptions.find((option) => option.value === icon) ?? iconOptions[0];
}

function getCurrencyOption(currencyCode: string): CurrencyOption | null {
  return currencyOptions.find((option) => option.code === currencyCode.toUpperCase()) ?? null;
}

function buildCurrencyLabel(currencyCode: string) {
  const option = getCurrencyOption(currencyCode);

  if (option) {
    return option;
  }

  const normalizedCode = currencyCode.trim().toUpperCase();

  return normalizedCode
    ? {
        code: normalizedCode,
        label: "Moneda actual",
        region: "Configurada en la base",
        symbol: normalizedCode,
      }
    : null;
}

function createDefaultFormState(currencyCode: string): AccountFormState {
  const preset = accountTypeOptions[0];

  return {
    name: "",
    type: preset.value,
    currencyCode,
    openingBalance: "0",
    includeInNetWorth: true,
    color: preset.color,
    icon: preset.icon,
  };
}

function buildFormStateFromAccount(account: AccountSummary): AccountFormState {
  return {
    name: account.name,
    type: account.type,
    currencyCode: account.currencyCode,
    openingBalance: String(account.openingBalance),
    includeInNetWorth: account.includeInNetWorth,
    color: account.color,
    icon: account.icon || getTypePreset(account.type).icon,
  };
}

function toAccountInput(formState: AccountFormState): AccountFormInput {
  return {
    name: formState.name.trim(),
    type: formState.type,
    currencyCode: formState.currencyCode.trim().toUpperCase(),
    openingBalance: Number(formState.openingBalance || 0),
    includeInNetWorth: formState.includeInNetWorth,
    color: formState.color,
    icon: formState.icon,
  };
}

function getAccountIcon(icon: string, type: string) {
  const resolvedIcon = icon || getTypePreset(type).icon;

  switch (resolvedIcon) {
    case "landmark":
      return Landmark;
    case "piggy-bank":
      return PiggyBank;
    case "credit-card":
      return CreditCard;
    case "trending-up":
      return TrendingUp;
    case "briefcase":
      return BriefcaseBusiness;
    case "banknote":
      return Banknote;
    default:
      return Wallet2;
  }
}

function usePickerPanel(isOpen: boolean, onClose: () => void) {
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

function getPickerTriggerStyle(isOpen: boolean) {
  return {
    borderColor: isOpen ? "rgba(107, 228, 197, 0.18)" : "rgba(255, 255, 255, 0.08)",
    background: isOpen
      ? "linear-gradient(180deg, rgba(15, 22, 34, 0.98), rgba(10, 16, 27, 0.98))"
      : "linear-gradient(180deg, rgba(12, 18, 28, 0.96), rgba(9, 14, 22, 0.96))",
    boxShadow: isOpen
      ? "0 0 0 4px rgba(107, 228, 197, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.04)"
      : "inset 0 1px 0 rgba(255, 255, 255, 0.04)",
  };
}

const pickerPanelStyle = {
  borderColor: "rgba(255, 255, 255, 0.1)",
  background:
    "linear-gradient(180deg, rgba(10, 15, 24, 0.98) 0%, rgba(8, 12, 20, 0.98) 100%)",
};

const pickerSearchInputStyle = {
  borderColor: "rgba(255, 255, 255, 0.08)",
  background:
    "linear-gradient(180deg, rgba(17, 25, 39, 0.95), rgba(13, 20, 31, 0.95))",
};

function getPickerOptionStyle(isSelected: boolean) {
  return {
    borderColor: isSelected ? "rgba(107, 228, 197, 0.18)" : "rgba(255, 255, 255, 0.04)",
    background: isSelected
      ? "linear-gradient(180deg, rgba(18, 31, 41, 0.98), rgba(12, 22, 33, 0.98))"
      : "linear-gradient(180deg, rgba(14, 21, 32, 0.96), rgba(11, 17, 26, 0.96))",
    boxShadow: isSelected ? "0 12px 30px rgba(0, 0, 0, 0.18)" : "none",
  };
}

const pickerEmptyStateStyle = {
  borderColor: "rgba(255, 255, 255, 0.08)",
  background:
    "linear-gradient(180deg, rgba(14, 21, 32, 0.96), rgba(11, 17, 26, 0.96))",
};

const accountFieldClassName =
  "w-full rounded-[18px] sm:rounded-[24px] border border-white/10 bg-[#0d1420]/95 px-3 sm:px-4 text-xs sm:text-sm text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] outline-none transition duration-200 placeholder:text-storm/70 hover:border-white/14 hover:bg-[#101928] focus:border-pine/25 focus:bg-[#111b2a] focus:shadow-[0_0_0_4px_rgba(107,228,197,0.08)]";

const accountTextInputClassName = `${accountFieldClassName} h-14 sm:h-16`;
const accountPickerTriggerClassName = `${accountFieldClassName} flex h-14 sm:h-16 items-center justify-between gap-2 sm:gap-3 text-left`;
const accountPickerSearchInputClassName =
  "w-full rounded-[22px] border border-white/10 bg-[#101928] py-3.5 pl-11 pr-4 text-sm text-ink outline-none transition placeholder:text-storm/70 focus:border-pine/25 focus:shadow-[0_0_0_4px_rgba(107,228,197,0.08)]";
const editorPanelClassName =
  "glass-panel-soft relative min-w-0 overflow-visible rounded-[24px] sm:rounded-[32px] border border-white/10 bg-white/[0.04] p-3 sm:p-6";
const accountFieldLabelClassName =
  "text-[0.6rem] sm:text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/80";
const accountFieldHintClassName = "mt-1.5 sm:mt-2 break-words text-[0.65rem] sm:text-xs leading-5 sm:leading-6 text-storm/75";

const ACCOUNT_EDITOR_DRAFT_STORAGE_KEY = "darkmoney-account-editor-draft";
const ACCOUNT_EDITOR_DRAFT_MAX_AGE_MS = 10 * 60 * 1000;

type PersistedAccountEditorState = {
  editorMode: AccountEditorMode;
  formState: AccountFormState;
  isEditorOpen: boolean;
  savedAt: number;
  selectedAccountId: number | null;
  userId: string;
  workspaceId: number;
};

function readPersistedAccountEditorState() {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.sessionStorage.getItem(ACCOUNT_EDITOR_DRAFT_STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as PersistedAccountEditorState;
  } catch {
    window.sessionStorage.removeItem(ACCOUNT_EDITOR_DRAFT_STORAGE_KEY);
    return null;
  }
}

function clearPersistedAccountEditorState() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(ACCOUNT_EDITOR_DRAFT_STORAGE_KEY);
}

function persistAccountEditorState(value: PersistedAccountEditorState) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(ACCOUNT_EDITOR_DRAFT_STORAGE_KEY, JSON.stringify(value));
}

type CurrencySelectProps = {
  value: string;
  onChange: (currencyCode: string) => void;
};

function CurrencySelect({ onChange, value }: CurrencySelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = usePickerPanel(isOpen, () => setIsOpen(false));
  const selectedCurrency = useMemo(() => buildCurrencyLabel(value), [value]);
  const filteredCurrencies = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return currencyOptions;
    }

    return currencyOptions.filter((option) => {
      const searchableValue = `${option.code} ${option.label} ${option.region} ${option.symbol}`.toLowerCase();
      return searchableValue.includes(normalizedQuery);
    });
  }, [query]);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
    }
  }, [isOpen]);

  return (
    <div
      className={`relative ${isOpen ? "z-50" : "z-10"}`}
      ref={containerRef}
    >
      <button
        className={accountPickerTriggerClassName}
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        style={getPickerTriggerStyle(isOpen)}
        type="button"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 min-w-[2.5rem] shrink-0 items-center justify-center rounded-[14px] sm:h-10 sm:min-w-[3rem] sm:rounded-[18px] border border-white/10 bg-white/[0.04] px-2 sm:px-3 text-xs sm:text-sm font-semibold text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            {selectedCurrency?.symbol ?? "?"}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-ink">
              {selectedCurrency ? selectedCurrency.code : "Selecciona una moneda"}
            </span>
            <span className="mt-1 block truncate text-xs text-storm">
              {selectedCurrency
                ? `${selectedCurrency.label} · ${selectedCurrency.region}`
                : "Elige la divisa base de la cuenta"}
            </span>
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-storm transition ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen ? (
        <div
          className="animate-rise-in absolute left-0 right-0 top-[calc(100%+0.65rem)] z-50 rounded-[30px] border p-3 shadow-[0_30px_80px_rgba(0,0,0,0.58)]"
          style={pickerPanelStyle}
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-storm" />
            <input
              autoFocus
              className={accountPickerSearchInputClassName}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar PEN, USD, Euro..."
              style={pickerSearchInputStyle}
              type="text"
              value={query}
            />
          </div>

          <div className="mt-3 max-h-72 space-y-1 overflow-y-auto pr-1">
            {filteredCurrencies.length ? (
              filteredCurrencies.map((option) => {
                const isSelected = option.code === value.toUpperCase();

                return (
                  <button
                    className={`flex w-full items-center justify-between gap-3 rounded-[24px] border px-4 py-3.5 text-left transition duration-200 ${
                      isSelected
                        ? "text-ink"
                        : "text-storm hover:text-ink"
                    }`}
                    key={option.code}
                    onClick={() => {
                      onChange(option.code);
                      setIsOpen(false);
                    }}
                    style={getPickerOptionStyle(isSelected)}
                    type="button"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="flex h-11 min-w-[3rem] shrink-0 items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.04] px-3 text-sm font-semibold text-ink">
                        {option.symbol}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-medium text-ink">{option.code}</span>
                        <span className="mt-1 block truncate text-xs text-storm">
                          {option.label} · {option.region}
                        </span>
                      </span>
                    </span>
                    {isSelected ? <Check className="h-4 w-4 shrink-0 text-pine" /> : null}
                  </button>
                );
              })
            ) : (
              <div
                className="rounded-[22px] border px-4 py-5 text-sm text-storm"
                style={pickerEmptyStateStyle}
              >
                No encontramos una moneda con ese termino. Prueba con `PEN`, `USD`, `EUR` o el nombre del pais.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

type AccountTypeSelectProps = {
  value: string;
  onChange: (type: string) => void;
};

function AccountTypeSelect({ onChange, value }: AccountTypeSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = usePickerPanel(isOpen, () => setIsOpen(false));
  const selectedType = getTypePreset(value);
  const SelectedTypeIcon = getAccountIcon(selectedType.icon, selectedType.value);
  const filteredTypes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return accountTypeOptions;
    }

    return accountTypeOptions.filter((option) => {
      const searchableValue = `${option.label} ${option.description} ${option.value}`.toLowerCase();
      return searchableValue.includes(normalizedQuery);
    });
  }, [query]);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
    }
  }, [isOpen]);

  return (
    <div
      className={`relative ${isOpen ? "z-50" : "z-10"}`}
      ref={containerRef}
    >
      <button
        className={accountPickerTriggerClassName}
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        style={getPickerTriggerStyle(isOpen)}
        type="button"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] sm:h-10 sm:w-10 sm:rounded-[18px] text-white shadow-lg"
            style={{ backgroundColor: selectedType.color }}
          >
            <SelectedTypeIcon className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-ink">{selectedType.label}</span>
            <span className="mt-1 block truncate text-xs text-storm">{selectedType.description}</span>
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-storm transition ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen ? (
        <div
          className="animate-rise-in absolute left-0 right-0 top-[calc(100%+0.65rem)] z-50 rounded-[30px] border p-3 shadow-[0_30px_80px_rgba(0,0,0,0.58)]"
          style={pickerPanelStyle}
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-storm" />
            <input
              autoFocus
              className={accountPickerSearchInputClassName}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar tipo de cuenta..."
              style={pickerSearchInputStyle}
              type="text"
              value={query}
            />
          </div>

          <div className="mt-3 max-h-72 space-y-1 overflow-y-auto pr-1">
            {filteredTypes.length ? (
              filteredTypes.map((option) => {
                const isSelected = option.value === value;
                const TypeIcon = getAccountIcon(option.icon, option.value);

                return (
                  <button
                    className={`flex w-full items-center justify-between gap-3 rounded-[24px] border px-4 py-3.5 text-left transition duration-200 ${
                      isSelected ? "text-ink" : "text-storm hover:text-ink"
                    }`}
                    key={option.value}
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                    style={getPickerOptionStyle(isSelected)}
                    type="button"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] text-white shadow-lg"
                        style={{ backgroundColor: option.color }}
                      >
                        <TypeIcon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-medium text-ink">{option.label}</span>
                        <span className="mt-1 block truncate text-xs text-storm">{option.description}</span>
                      </span>
                    </span>
                    {isSelected ? <Check className="h-4 w-4 shrink-0 text-pine" /> : null}
                  </button>
                );
              })
            ) : (
              <div
                className="rounded-[22px] border px-4 py-5 text-sm text-storm"
                style={pickerEmptyStateStyle}
              >
                No encontramos un tipo con ese termino. Prueba con `ahorros`, `banco` o `credito`.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

type AccountIconSelectProps = {
  accountType: string;
  color: string;
  value: string;
  onChange: (icon: string) => void;
};

function AccountIconSelect({
  accountType,
  color,
  onChange,
  value,
}: AccountIconSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = usePickerPanel(isOpen, () => setIsOpen(false));
  const selectedIcon = getIconOption(value);
  const SelectedIcon = getAccountIcon(selectedIcon.value, accountType);
  const filteredIcons = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return iconOptions;
    }

    return iconOptions.filter((option) => {
      const searchableValue = `${option.label} ${option.description} ${option.value}`.toLowerCase();
      return searchableValue.includes(normalizedQuery);
    });
  }, [query]);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
    }
  }, [isOpen]);

  return (
    <div
      className={`relative ${isOpen ? "z-50" : "z-10"}`}
      ref={containerRef}
    >
      <button
        className={accountPickerTriggerClassName}
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        style={getPickerTriggerStyle(isOpen)}
        type="button"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[18px] text-white shadow-lg"
            style={{ backgroundColor: color }}
          >
            <SelectedIcon className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-ink">{selectedIcon.label}</span>
            <span className="mt-1 block truncate text-xs text-storm">{selectedIcon.description}</span>
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-storm transition ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen ? (
        <div
          className="animate-rise-in absolute left-0 right-0 top-[calc(100%+0.65rem)] z-50 rounded-[30px] border p-3 shadow-[0_30px_80px_rgba(0,0,0,0.58)]"
          style={pickerPanelStyle}
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-storm" />
            <input
              autoFocus
              className={accountPickerSearchInputClassName}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar icono..."
              style={pickerSearchInputStyle}
              type="text"
              value={query}
            />
          </div>

          <div className="mt-3 max-h-72 space-y-1 overflow-y-auto pr-1">
            {filteredIcons.length ? (
              filteredIcons.map((option) => {
                const isSelected = option.value === value;
                const IconPreview = getAccountIcon(option.value, accountType);

                return (
                  <button
                    className={`flex w-full items-center justify-between gap-3 rounded-[24px] border px-4 py-3.5 text-left transition duration-200 ${
                      isSelected ? "text-ink" : "text-storm hover:text-ink"
                    }`}
                    key={option.value}
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                    style={getPickerOptionStyle(isSelected)}
                    type="button"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] text-white shadow-lg"
                        style={{ backgroundColor: color }}
                      >
                        <IconPreview className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-medium text-ink">{option.label}</span>
                        <span className="mt-1 block truncate text-xs text-storm">{option.description}</span>
                      </span>
                    </span>
                    {isSelected ? <Check className="h-4 w-4 shrink-0 text-pine" /> : null}
                  </button>
                );
              })
            ) : (
              <div
                className="rounded-[22px] border px-4 py-5 text-sm text-storm"
                style={pickerEmptyStateStyle}
              >
                No encontramos un icono con ese termino. Prueba con `wallet`, `bank` o `trending`.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AccountsLoadingSkeleton() {
  return (
    <>
      <section className="grid gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            className="shimmer-surface h-[196px]"
            key={`metric-${index}`}
          />
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-3 2xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            className="shimmer-surface h-[298px]"
            key={`card-${index}`}
          />
        ))}
      </section>
    </>
  );
}

type AccountEditorDialogProps = {
  baseCurrencyCode: string;
  clearFieldError: (field: string) => void;
  closeEditor: () => void;
  errorMessage: string;
  formState: AccountFormState;
  handleAccountTypeChange: (type: string) => void;
  handleArchiveToggle: (account: AccountSummary) => Promise<void> | void;
  handleDeleteAccount: () => Promise<void> | void;
  handleSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void> | void;
  invalidFields: Set<string>;
  isCreateMode: boolean;
  isSaving: boolean;
  selectedAccount: AccountSummary | null;
  updateFormState: <Field extends keyof AccountFormState>(
    field: Field,
    value: AccountFormState[Field],
  ) => void;
};

function AccountEditorDialog({
  baseCurrencyCode,
  clearFieldError,
  closeEditor,
  errorMessage,
  formState,
  handleAccountTypeChange,
  handleArchiveToggle,
  handleDeleteAccount,
  handleSubmit,
  invalidFields,
  isCreateMode,
  isSaving,
  selectedAccount,
  updateFormState,
}: AccountEditorDialogProps) {
  const previewType = getTypePreset(formState.type);
  const previewCurrencyCode = formState.currencyCode || baseCurrencyCode;
  const previewCurrency = buildCurrencyLabel(previewCurrencyCode);
  const parsedPreviewOpeningBalance = Number(formState.openingBalance);
  const previewOpeningBalance = Number.isFinite(parsedPreviewOpeningBalance)
    ? parsedPreviewOpeningBalance
    : 0;
  const previewAccountName = formState.name.trim() || "Cuenta sin nombre";
  const previewIconOption = getIconOption(formState.icon || previewType.icon);
  const PreviewAccountIcon = getAccountIcon(previewIconOption.value, formState.type);

  useEffect(() => {
    if (invalidFields.size === 0) return;
    const firstField = [...invalidFields][0];
    const firstEl = document.querySelector<HTMLElement>(`[data-field="${firstField}"]`);
    if (firstEl) {
      firstEl.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => {
        firstEl.querySelector<HTMLElement>("input,button,[tabindex='0']")?.focus();
      }, 300);
    }
    invalidFields.forEach((field) => {
      const el = document.querySelector<HTMLElement>(`[data-field="${field}"]`);
      if (!el) return;
      el.classList.remove("field-error-shake");
      void el.offsetWidth;
      el.classList.add("field-error-shake");
    });
  }, [invalidFields]);

  return (
    <div
      aria-modal="true"
      className="animate-fade-in fixed inset-0 z-40 isolate bg-black/62 backdrop-blur-xl before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-32 before:bg-black/48 before:backdrop-blur-2xl before:content-['']"
      onMouseDown={(e) => { (e.currentTarget as HTMLDivElement).dataset.pressStart = String(Date.now()); }}
      onMouseUp={(e) => { const t0 = Number((e.currentTarget as HTMLDivElement).dataset.pressStart || "0"); delete (e.currentTarget as HTMLDivElement).dataset.pressStart; if (t0) closeEditor(); }}
      role="dialog"
    >
      <div className="flex min-h-full items-center justify-center p-3 sm:p-6">
        <div
          className="animate-rise-in relative max-h-[calc(100dvh-1.5rem)] w-full max-w-[1120px] overflow-hidden rounded-[38px] [transform:translateZ(0)] border border-white/10 bg-[#060b12]/95 shadow-[0_40px_130px_rgba(0,0,0,0.62)]"
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="pointer-events-none absolute inset-0">
            <div
              className="absolute -left-20 top-12 h-64 w-64 rounded-full blur-3xl animate-soft-pulse"
              style={{ backgroundColor: `${formState.color}2b` }}
            />
            <div
              className="absolute right-0 top-0 h-48 w-48 rounded-full blur-3xl animate-soft-pulse [animation-delay:240ms]"
              style={{ backgroundColor: "rgba(142, 165, 255, 0.14)" }}
            />
            <div
              className="absolute bottom-0 left-1/2 h-40 w-56 -translate-x-1/2 blur-3xl animate-soft-pulse [animation-delay:420ms]"
              style={{ backgroundColor: "rgba(215, 190, 123, 0.12)" }}
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent_22%,transparent_78%,rgba(255,255,255,0.03))]" />
          </div>

          <div className="relative flex max-h-[calc(100dvh-1.5rem)] flex-col overflow-y-auto px-4 pt-4 sm:px-6 sm:pt-6">
            <div className="flex items-start justify-between gap-4">
              <div className="max-w-2xl space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/90">
                    {isCreateMode ? "nueva cuenta" : "editar cuenta"}
                  </span>
                  <span className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1 text-xs text-storm/75">
                    Se refleja en el dashboard al guardar
                  </span>
                </div>
                <div>
                  <h2 className="font-display text-3xl font-semibold text-ink sm:text-[2.7rem]">
                    {isCreateMode ? "Crear cuenta" : selectedAccount?.name ?? "Cuenta"}
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-storm">
                    {isCreateMode
                      ? "Configura una cuenta real con una identidad visual clara, saldo inicial y moneda base para que se integre al workspace desde el primer momento."
                      : "Ajusta la presentacion y la configuracion financiera de esta cuenta sin perder el contexto de su saldo y actividad actual."}
                  </p>
                </div>
              </div>
              <button
                aria-label="Cerrar editor de cuenta"
                className="rounded-full border border-white/10 bg-white/[0.04] p-3 text-storm transition hover:-translate-y-0.5 hover:bg-white/[0.08] hover:text-ink"
                onClick={closeEditor}
                type="button"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              className="mt-6 flex flex-1 flex-col"
              noValidate
              onSubmit={(event) => void handleSubmit(event)}
            >
              <div className="space-y-6">
                {errorMessage ? (
                  <FormFeedbackBanner
                    description={errorMessage}
                    title="Revisa los datos antes de guardar"
                  />
                ) : null}
                <div className="space-y-6">
                  <section className="relative overflow-hidden rounded-[24px] sm:rounded-[34px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-3 sm:p-6 lg:p-7">
                    <div
                      className="absolute -right-10 top-0 h-32 w-32 rounded-full blur-3xl animate-soft-pulse"
                      style={{ backgroundColor: `${formState.color}3d` }}
                    />
                    <div className="relative">
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/85">
                          Live preview
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-storm/80">
                          {formState.includeInNetWorth
                            ? "Incluida en patrimonio"
                            : "Fuera de patrimonio"}
                        </span>
                      </div>

                      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)] lg:items-end">
                        <div className="flex items-start gap-5">
                          <div className="relative flex h-16 w-16 shrink-0 items-center justify-center sm:h-24 sm:w-24">
                            <div
                              className="absolute inset-0 rounded-[20px] sm:rounded-[30px] opacity-80 blur-2xl"
                              style={{ backgroundColor: `${formState.color}5f` }}
                            />
                            <div
                              className="relative flex h-full w-full items-center justify-center rounded-[20px] sm:rounded-[30px] border border-white/10 text-white shadow-[0_20px_45px_rgba(0,0,0,0.28)]"
                              style={{
                                background: `linear-gradient(160deg, ${formState.color}, rgba(8, 13, 20, 0.72))`,
                              }}
                            >
                              <PreviewAccountIcon className="h-6 w-6 sm:h-9 sm:w-9" />
                            </div>
                          </div>

                          <div className="min-w-0">
                            <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">
                              Vista previa
                            </p>
                            <h3 className="mt-2 break-words font-display text-2xl sm:text-4xl font-semibold text-ink">
                              {previewAccountName}
                            </h3>
                            <p className="mt-3 max-w-2xl text-sm leading-7 text-storm">
                              {previewType.description}
                            </p>
                            <div className="mt-5 flex flex-wrap gap-2">
                              <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-ink">
                                {previewType.label}
                              </span>
                              <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-ink">
                                {previewCurrency?.code ?? baseCurrencyCode}
                              </span>
                              <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-ink">
                                {previewIconOption.label}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                          <div className="rounded-[18px] sm:rounded-[24px] border border-white/10 bg-black/15 px-3 py-3 sm:px-4 sm:py-4 backdrop-blur">
                            <p className="text-[0.6rem] sm:text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">
                              Saldo inicial
                            </p>
                            <p className="mt-2 sm:mt-3 font-display text-xl sm:text-2xl font-semibold text-ink">
                              {formatCurrency(
                                previewOpeningBalance,
                                previewCurrency?.code ?? baseCurrencyCode,
                              )}
                            </p>
                          </div>

                          <div className="rounded-[18px] sm:rounded-[24px] border border-white/10 bg-black/15 px-3 py-3 sm:px-4 sm:py-4 backdrop-blur">
                            <p className="text-[0.6rem] sm:text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">
                              Moneda
                            </p>
                            <p className="mt-2 sm:mt-3 text-xs sm:text-sm font-medium text-ink">
                              {previewCurrency?.label ?? "Moneda configurada"}
                            </p>
                            <p className="mt-1.5 sm:mt-2 break-words text-[0.65rem] sm:text-xs leading-5 sm:leading-6 text-storm/75">
                              {previewCurrency
                                ? `${previewCurrency.code} - ${previewCurrency.region}`
                                : "Usaremos la moneda base del workspace."}
                            </p>
                          </div>

                          <div className="rounded-[18px] sm:rounded-[24px] border border-white/10 bg-black/15 px-3 py-3 sm:px-4 sm:py-4 backdrop-blur">
                            <p className="text-[0.6rem] sm:text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">
                              Estado patrimonio
                            </p>
                            <p className="mt-2 sm:mt-3 text-xs sm:text-sm font-medium text-ink">
                              {formState.includeInNetWorth
                                ? "Incluida en el net worth"
                                : "Excluida del net worth"}
                            </p>
                            <p className="mt-1.5 sm:mt-2 break-words text-[0.65rem] sm:text-xs leading-5 sm:leading-6 text-storm/75">
                              {formState.includeInNetWorth
                                ? "Aportara al resumen general del workspace."
                                : "Quedara fuera del calculo patrimonial."}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className={`${editorPanelClassName} z-40`}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/80">
                          Identidad
                        </p>
                        <h3 className="mt-2 font-display text-2xl font-semibold text-ink">
                          Base de la cuenta
                        </h3>
                        <p className="mt-2 max-w-xl text-sm leading-7 text-storm">
                          Define como se vera esta cuenta en tarjetas, filtros y reportes.
                        </p>
                      </div>
                      <div className="rounded-[24px] border border-white/8 bg-white/[0.03] px-4 py-3">
                        <p className="text-[0.65rem] uppercase tracking-[0.22em] text-storm/75">
                          Tipo sugerido
                        </p>
                        <p className="mt-2 text-sm font-medium text-ink">{previewType.label}</p>
                      </div>
                    </div>

                    <div className="mt-6 space-y-5">
                      <label className="block">
                        <div className="flex items-center justify-between gap-3">
                          <span className={accountFieldLabelClassName}>Nombre</span>
                          <span className="text-xs text-storm/65">
                            Visible en dashboard y movimientos
                          </span>
                        </div>
                        <div
                          className={`mt-3${invalidFields.has("name") ? " field-error-ring" : ""}`}
                          data-field="name"
                        >
                          <input
                            className={accountTextInputClassName}
                            onChange={(event) => { clearFieldError("name"); updateFormState("name", event.target.value); }}
                            placeholder="Ej. Cuenta principal"
                            type="text"
                            value={formState.name}
                          />
                        </div>
                        <p className={accountFieldHintClassName}>
                          Usa un nombre corto y facil de reconocer, por ejemplo "Cuenta principal"
                          o "Caja operativa".
                        </p>
                      </label>

                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="block space-y-3">
                          <span className={accountFieldLabelClassName}>Tipo</span>
                          <AccountTypeSelect
                            onChange={handleAccountTypeChange}
                            value={formState.type}
                          />
                          <p className="text-xs leading-6 text-storm/75">
                            El tipo propone un icono y color iniciales para acelerar el setup.
                          </p>
                        </label>

                        <label className="block space-y-3">
                          <span className={accountFieldLabelClassName}>Moneda</span>
                          <CurrencySelect
                            onChange={(currencyCode) =>
                              updateFormState("currencyCode", currencyCode)
                            }
                            value={formState.currencyCode}
                          />
                          <p className="text-xs leading-6 text-storm/75">
                            Se usara para el saldo inicial y para mostrar el balance principal.
                          </p>
                        </label>
                      </div>
                    </div>
                  </section>

                  <section className={`${editorPanelClassName} z-10`}>
                    <div>
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/80">
                        Finanzas
                      </p>
                      <h3 className="mt-2 font-display text-2xl font-semibold text-ink">
                        Saldo de arranque
                      </h3>
                      <p className="mt-2 max-w-xl text-sm leading-7 text-storm">
                        Este valor actua como punto de partida para el historial de movimientos.
                      </p>
                    </div>

                    <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,0.74fr)_minmax(0,1.26fr)]">
                      <label className="block">
                        <div className="flex items-center justify-between gap-3">
                          <span className={accountFieldLabelClassName}>Saldo inicial</span>
                          <span className="text-xs text-storm/65">
                            {previewCurrency?.code ?? baseCurrencyCode}
                          </span>
                        </div>
                        <div
                          className={`mt-3${invalidFields.has("openingBalance") ? " field-error-ring" : ""}`}
                          data-field="openingBalance"
                        >
                          <input
                            className={accountTextInputClassName}
                            inputMode="decimal"
                            onChange={(event) => { clearFieldError("openingBalance"); updateFormState("openingBalance", event.target.value); }}
                            placeholder="0.00"
                            type="text"
                            value={formState.openingBalance}
                          />
                        </div>
                        <p className={accountFieldHintClassName}>
                          Acepta decimales y puede ser 0 si la cuenta empieza vacia.
                        </p>
                      </label>

                      <div className="rounded-[28px] border border-white/8 bg-[#0c1320]/80 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                        <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">
                          Preview financiero
                        </p>
                        <p className="mt-4 font-display text-3xl font-semibold text-ink">
                          {formatCurrency(
                            previewOpeningBalance,
                            previewCurrency?.code ?? baseCurrencyCode,
                          )}
                        </p>
                        <p className="mt-2 text-sm text-storm">
                          {previewCurrency
                            ? `${previewCurrency.label} - ${previewCurrency.region}`
                            : "Sin moneda seleccionada"}
                        </p>
                        <div className="mt-4 h-px bg-white/8" />
                        <p className="mt-4 text-xs leading-6 text-storm/75">
                          El dashboard tomara este monto como base y luego le sumara o restara los
                          movimientos reales.
                        </p>
                      </div>
                    </div>
                  </section>
                </div>

                <div className="space-y-6">
                  <section className={`${editorPanelClassName} z-30`}>
                    <div>
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/80">
                        Visual
                      </p>
                      <h3 className="mt-2 font-display text-2xl font-semibold text-ink">
                        Icono y color
                      </h3>
                      <p className="mt-2 text-sm leading-7 text-storm">
                        Dale una identidad limpia para reconocerla mas rapido en toda la app.
                      </p>
                    </div>

                    <div className="mt-6 space-y-5">
                      <label className="block space-y-3">
                        <span className={accountFieldLabelClassName}>Icono</span>
                        <AccountIconSelect
                          accountType={formState.type}
                          color={formState.color}
                          onChange={(icon) => updateFormState("icon", icon)}
                          value={formState.icon}
                        />
                        <p className="text-xs leading-6 text-storm/75">
                          Puedes mantener el sugerido o elegir uno mas representativo.
                        </p>
                      </label>

                      <div>
                        <div className="flex items-center justify-between gap-3">
                          <span className={accountFieldLabelClassName}>Color principal</span>
                          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-storm/80">
                            {formState.color.toUpperCase()}
                          </span>
                        </div>

                        <div className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-6">
                          {editorColorSwatches.map((swatch) => {
                            const isSelected = swatch.toLowerCase() === formState.color.toLowerCase();

                            return (
                              <button
                                className={`group relative h-12 rounded-[18px] border transition duration-200 ${
                                  isSelected
                                    ? "scale-[1.02] border-white/30"
                                    : "border-white/10 hover:-translate-y-0.5 hover:border-white/20"
                                }`}
                                key={swatch}
                                onClick={() => updateFormState("color", swatch)}
                                style={{
                                  background: `linear-gradient(135deg, ${swatch}, ${swatch}88)`,
                                }}
                                type="button"
                              >
                                <span className="absolute inset-[3px] rounded-[14px] border border-white/15" />
                                {isSelected ? (
                                  <Check className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 text-white" />
                                ) : null}
                              </button>
                            );
                          })}
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
                          <div className="rounded-[24px] border border-white/8 bg-[#0c1320]/80 px-4 py-4">
                            <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">
                              Aplicacion
                            </p>
                            <div
                              className="mt-3 h-12 rounded-[18px] border border-white/10"
                              style={{
                                background: `linear-gradient(135deg, ${formState.color}, rgba(9, 13, 20, 0.7))`,
                              }}
                            />
                          </div>

                          <label className="block">
                            <span className="mb-3 block text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/80">
                              Custom
                            </span>
                            <input
                              className={`${accountFieldClassName} h-16 cursor-pointer p-2`}
                              onChange={(event) => updateFormState("color", event.target.value)}
                              type="color"
                              value={formState.color}
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className={`${editorPanelClassName} z-20`}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/80">
                          Patrimonio
                        </p>
                        <h3 className="mt-2 font-display text-2xl font-semibold text-ink">
                          Impacto en el resumen general
                        </h3>
                        <p className="mt-2 text-sm leading-7 text-storm">
                          Decide si esta cuenta suma al patrimonio neto del workspace.
                        </p>
                      </div>
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-medium ${
                          formState.includeInNetWorth
                            ? "border-pine/25 bg-pine/10 text-pine"
                            : "border-white/10 bg-white/[0.04] text-storm"
                        }`}
                      >
                        {formState.includeInNetWorth ? "Activa" : "Desactivada"}
                      </span>
                    </div>

                    <button
                      aria-checked={formState.includeInNetWorth}
                      className={`mt-6 flex w-full items-center justify-between gap-4 rounded-[28px] border px-5 py-5 text-left transition duration-200 ${
                        formState.includeInNetWorth
                          ? "border-pine/20 bg-pine/[0.08] hover:bg-pine/[0.1]"
                          : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"
                      }`}
                      onClick={() =>
                        updateFormState("includeInNetWorth", !formState.includeInNetWorth)
                      }
                      role="switch"
                      type="button"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink">
                          {formState.includeInNetWorth
                            ? "La cuenta se incluye en patrimonio"
                            : "La cuenta queda fuera de patrimonio"}
                        </p>
                        <p className="mt-2 text-sm leading-7 text-storm">
                          Activalo para que el balance de esta cuenta entre en el net worth del
                          workspace. Si es una cuenta auxiliar o temporal, puedes dejarla fuera.
                        </p>
                      </div>
                      <span
                        className={`relative h-7 w-14 shrink-0 rounded-full border transition ${
                          formState.includeInNetWorth
                            ? "border-pine/30 bg-pine/20"
                            : "border-white/12 bg-white/[0.05]"
                        }`}
                      >
                        <span
                          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-[0_6px_18px_rgba(0,0,0,0.28)] transition duration-200 ${
                            formState.includeInNetWorth ? "left-8" : "left-1"
                          }`}
                        />
                      </span>
                    </button>
                  </section>

                  {selectedAccount ? (
                    <section className={`${editorPanelClassName} z-10`}>
                      <div>
                        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/80">
                          Contexto actual
                        </p>
                        <h3 className="mt-2 font-display text-2xl font-semibold text-ink">
                          Datos de la cuenta
                        </h3>
                      </div>

                      <div className="mt-6 grid gap-3">
                        <div className="rounded-[24px] border border-white/8 bg-[#0c1320]/80 p-4">
                          <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">
                            Balance actual
                          </p>
                          <p className="mt-3 font-display text-3xl font-semibold text-ink">
                            {formatCurrency(
                              selectedAccount.currentBalance,
                              selectedAccount.currencyCode,
                            )}
                          </p>
                        </div>
                        <div className="rounded-[24px] border border-white/8 bg-[#0c1320]/80 p-4">
                          <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">
                            Ultima actividad
                          </p>
                          <p className="mt-3 text-sm font-medium text-ink">
                            {formatDateTime(selectedAccount.lastActivity)}
                          </p>
                        </div>
                      </div>
                    </section>
                  ) : null}
                </div>
              </div>

              <div className="sticky bottom-0 z-[60] -mx-4 sm:-mx-6 mt-8 rounded-b-[38px] border-t border-white/10 bg-[#060b12]/95 px-4 py-5 sm:px-6 backdrop-blur-md">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <p className="max-w-xl text-sm leading-7 text-storm">
                    {isCreateMode
                      ? "La cuenta se creara en este workspace y el dashboard se refrescara en segundo plano."
                      : "Los cambios visuales y financieros se aplicaran inmediatamente en esta cuenta real."}
                  </p>

                  <div className="flex flex-col-reverse gap-3 sm:flex-row">
                    <Button
                      className="min-w-[140px] justify-center"
                      disabled={isSaving}
                      onClick={closeEditor}
                      type="button"
                      variant="ghost"
                    >
                      Cancelar
                    </Button>
                    <Button
                      className="min-w-[180px] justify-center shadow-[0_18px_50px_rgba(245,247,251,0.12)]"
                      disabled={isSaving}
                      type="submit"
                    >
                      {isSaving ? (
                        <>
                          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                          Guardando...
                        </>
                      ) : isCreateMode ? (
                        "Crear cuenta"
                      ) : (
                        "Guardar cambios"
                      )}
                    </Button>
                  </div>
                </div>

                {selectedAccount ? (
                  <div className="mt-6 grid gap-3">
                    <div className="flex flex-wrap gap-3">
                      <Button
                        className="justify-center"
                        disabled={isSaving}
                        onClick={() => void handleArchiveToggle(selectedAccount)}
                        type="button"
                        variant="secondary"
                      >
                        {selectedAccount.isArchived ? (
                          <RotateCcw className="mr-2 h-4 w-4" />
                        ) : (
                          <Archive className="mr-2 h-4 w-4" />
                        )}
                        {selectedAccount.isArchived ? "Reactivar cuenta" : "Archivar cuenta"}
                      </Button>

                      <Button
                        className="justify-center bg-rosewood/14 text-rosewood ring-1 ring-rosewood/20 hover:bg-rosewood/20 hover:brightness-100"
                        disabled={isSaving || !selectedAccount.isArchived}
                        onClick={() => void handleDeleteAccount()}
                        type="button"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar permanente
                      </Button>
                    </div>

                    {!selectedAccount.isArchived ? (
                      <div className="rounded-[24px] border border-gold/18 bg-gold/10 p-4 text-sm leading-7 text-storm">
                        <Sparkles className="mb-3 h-4 w-4 text-gold" />
                        Para proteger el historial financiero, primero archiva la cuenta y luego
                        decide si necesitas eliminarla permanentemente.
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}


function AccountArchiveDialog({
  account,
  isSaving,
  onCancel,
  onConfirm,
}: {
  account: AccountSummary;
  isSaving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const nextArchivedValue = !account.isArchived;
  const AccountIcon = getAccountIcon(account.icon, account.type);
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onCancel(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#02060d]/78 p-4 backdrop-blur-xl" role="dialog" aria-modal="true" aria-labelledby="acc-archive-title">
      <div className="w-full max-w-[720px] rounded-[38px] border border-white/12 bg-[#090e16]/96 p-6 shadow-[0_40px_130px_rgba(0,0,0,0.62)] sm:p-7">
        <div className="flex items-start gap-4">
          <div
            className={`flex h-14 w-14 items-center justify-center rounded-[22px] border ${
              nextArchivedValue
                ? "border-gold/18 bg-gold/10 text-gold"
                : "border-pine/20 bg-pine/10 text-pine"
            }`}
          >
            {nextArchivedValue ? <Archive className="h-6 w-6" /> : <RotateCcw className="h-6 w-6" />}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap gap-2">
              <span
                className={`rounded-full border px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] ${
                  nextArchivedValue
                    ? "border-gold/25 bg-gold/10 text-gold"
                    : "border-pine/25 bg-pine/10 text-pine"
                }`}
              >
                {nextArchivedValue ? "Archivar cuenta" : "Reactivar cuenta"}
              </span>
            </div>
            <h3 className="mt-4 font-display text-4xl font-semibold text-ink" id="acc-archive-title">
              {nextArchivedValue ? "Confirma antes de archivarla" : "Confirma antes de reactivarla"}
            </h3>
            <p className="mt-4 max-w-2xl text-base leading-8 text-storm">
              {nextArchivedValue
                ? "La cuenta seguira existiendo con su historial, pero dejara de aparecer en la vista principal hasta que la reactives."
                : "La cuenta volvera a mostrarse como activa y quedara disponible otra vez en los paneles principales del workspace."}
            </p>
          </div>
        </div>

        <div className="mt-7 rounded-[30px] border border-white/10 bg-white/[0.04] p-5">
          <div className="flex items-start gap-4">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-[22px] text-white shadow-lg"
              style={{ backgroundColor: account.color }}
            >
              <AccountIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-semibold text-ink">{account.name}</p>
              <p className="mt-2 text-sm text-storm">
                {account.type} - {account.currencyCode}
              </p>
              <p className="mt-3 font-display text-3xl font-semibold text-ink">
                {formatCurrency(account.currentBalance, account.currencyCode)}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <StatusBadge
                  status={account.includeInNetWorth ? "Incluida en patrimonio" : "Fuera de patrimonio"}
                  tone={account.includeInNetWorth ? "success" : "warning"}
                />
                {account.isArchived ? <StatusBadge status="Archivada" tone="neutral" /> : null}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-end">
          <Button disabled={isSaving} onClick={onCancel} variant="ghost">
            Cancelar
          </Button>
          <Button
            className={
              nextArchivedValue
                ? "bg-gold text-[#0b0d12] hover:brightness-105 focus-visible:outline-gold"
                : "bg-pine text-[#07110e] hover:brightness-105 focus-visible:outline-pine"
            }
            disabled={isSaving}
            onClick={onConfirm}
          >
            {isSaving ? (
              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : nextArchivedValue ? (
              <Archive className="mr-2 h-4 w-4" />
            ) : (
              <RotateCcw className="mr-2 h-4 w-4" />
            )}
            {nextArchivedValue ? "Archivar cuenta" : "Reactivar cuenta"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function escape(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

function downloadAccountsCSV(accounts: AccountSummary[], filename: string) {
  const headers = ["Nombre", "Tipo", "Moneda", "Saldo actual", "Saldo inicial", "En patrimonio neto", "Archivada", "Ultima actividad"];
  const rows = accounts.map((a) => [
    escape(a.name),
    escape(a.type),
    escape(a.currencyCode),
    escape(a.currentBalance),
    escape(a.openingBalance),
    escape(a.includeInNetWorth ? "Si" : "No"),
    escape(a.isArchived ? "Si" : "No"),
    escape(a.lastActivity),
  ]);
  downloadCSV([headers.join(","), ...rows.map((r) => r.join(","))].join("\n"), filename);
}

export function AccountsPage() {
  const { profile, user } = useAuth();
  const { activeWorkspace, error: workspaceError, isLoading: isWorkspacesLoading } = useActiveWorkspace();
  const snapshotQuery = useWorkspaceSnapshotQuery(activeWorkspace, user?.id, profile);
  const snapshot = snapshotQuery.data;
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [invalidFields, setInvalidFields] = useState<Set<string>>(new Set());

  function clearFieldError(field: string) {
    setInvalidFields((prev) => {
      if (!prev.has(field)) return prev;
      const next = new Set(prev);
      next.delete(field);
      return next;
    });
  }
  const [editorMode, setEditorMode] = useState<AccountEditorMode>("create");
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [archiveTargetId, setArchiveTargetId] = useState<number | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(new Set());
  const [analyticsAccountId, setAnalyticsAccountId] = useState<number | null>(null);
  const { schedule } = useUndoQueue();
  const [showArchived, setShowArchived] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const accountColumns: ColumnDef[] = [
    { key: "tipo", label: "Tipo" },
    { key: "saldo", label: "Saldo actual" },
    { key: "moneda", label: "Moneda" },
    { key: "estado", label: "Estado" },
  ];
  const { visible: colVis, toggle: toggleCol, cv } = useColumnVisibility("columns-accounts", accountColumns);
  const [viewMode, setViewMode] = useViewMode("accounts");
  const [formState, setFormState] = useState<AccountFormState>(() =>
    createDefaultFormState(profile?.baseCurrencyCode ?? "USD"),
  );
  const hasHydratedEditorDraft = useRef(false);
  const isEditorDraftReady = useRef(false);
  const createAccountMutation = useCreateAccountMutation(activeWorkspace?.id, user?.id);
  const updateAccountMutation = useUpdateAccountMutation(activeWorkspace?.id, user?.id);
  const archiveAccountMutation = useArchiveAccountMutation(activeWorkspace?.id, user?.id);
  const deleteAccountMutation = useDeleteAccountMutation(activeWorkspace?.id, user?.id);
  useSuccessToast(feedbackMessage, {
    clear: () => setFeedbackMessage(""),
    title: "Cambios aplicados",
  });

  const selectedAccount =
    selectedAccountId !== null
      ? snapshot?.accounts.find((account) => account.id === selectedAccountId) ?? null
      : null;
  const archiveTarget =
    archiveTargetId !== null
      ? snapshot?.accounts.find((account) => account.id === archiveTargetId) ?? null
      : null;
  const visibleAccounts = showArchived
    ? snapshot?.accounts ?? []
    : (snapshot?.accounts.filter((account) => !account.isArchived) ?? []);
  const hasActiveFilters = searchQuery.trim() !== "" || typeFilter !== "all";
  const filteredAccounts = useMemo(() => {
    let result = visibleAccounts.filter((a) => !hiddenIds.has(a.id));
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.currencyCode.toLowerCase().includes(q) ||
          getTypePreset(a.type).label.toLowerCase().includes(q),
      );
    }
    if (typeFilter !== "all") {
      result = result.filter((a) => a.type === typeFilter);
    }
    return result;
  }, [visibleAccounts, hiddenIds, searchQuery, typeFilter]);
  const { selectedIds, toggle: toggleSelect, selectAll, clearAll, selectedCount, allSelected, someSelected, selectedItems } = useSelection(filteredAccounts);
  const activeAccounts = snapshot?.accounts.filter((account) => !account.isArchived) ?? [];
  const archivedAccounts = snapshot?.accounts.filter((account) => account.isArchived) ?? [];
  const netWorthAccounts = activeAccounts.filter((account) => account.includeInNetWorth);
  const netWorthDisplay = resolveAggregateBalanceDisplay(
    netWorthAccounts,
    snapshot?.workspace.baseCurrencyCode ?? activeWorkspace?.baseCurrencyCode ?? profile?.baseCurrencyCode ?? "USD",
  );
  const excludedAccounts = activeAccounts.filter((account) => !account.includeInNetWorth).length;
  const isSaving =
    createAccountMutation.isPending ||
    updateAccountMutation.isPending ||
    archiveAccountMutation.isPending ||
    deleteAccountMutation.isPending;

  useEffect(() => {
    if (!activeWorkspace) {
      if (!isWorkspacesLoading) {
        setIsEditorOpen(false);
        setSelectedAccountId(null);
      }
      return;
    }

    if (!isEditorOpen || editorMode !== "create") {
      return;
    }

    setFormState((currentState) => ({
      ...currentState,
      currencyCode: currentState.currencyCode || activeWorkspace.baseCurrencyCode,
    }));
  }, [activeWorkspace, editorMode, isEditorOpen, isWorkspacesLoading]);

  useEffect(() => {
    if (hasHydratedEditorDraft.current || !activeWorkspace || !user) {
      return;
    }

    hasHydratedEditorDraft.current = true;
    const persistedState = readPersistedAccountEditorState();

    if (!persistedState) {
      isEditorDraftReady.current = true;
      return;
    }

    const isExpired = Date.now() - persistedState.savedAt > ACCOUNT_EDITOR_DRAFT_MAX_AGE_MS;
    const isWrongScope =
      persistedState.userId !== user.id || persistedState.workspaceId !== activeWorkspace.id;

    if (isExpired || isWrongScope) {
      clearPersistedAccountEditorState();
      isEditorDraftReady.current = true;
      return;
    }

    setFeedbackMessage("");
    setErrorMessage("");
    setEditorMode(persistedState.editorMode);
    setSelectedAccountId(persistedState.selectedAccountId);
    setFormState(persistedState.formState);
    setIsEditorOpen(persistedState.isEditorOpen);
    isEditorDraftReady.current = true;
  }, [activeWorkspace, user]);

  useEffect(() => {
    if (!isEditorDraftReady.current || !activeWorkspace || !user) {
      return;
    }

    if (!isEditorOpen) {
      clearPersistedAccountEditorState();
      return;
    }

    persistAccountEditorState({
      editorMode,
      formState,
      isEditorOpen,
      savedAt: Date.now(),
      selectedAccountId,
      userId: user.id,
      workspaceId: activeWorkspace.id,
    });
  }, [activeWorkspace, editorMode, formState, isEditorOpen, selectedAccountId, user]);

  useEffect(() => {
    if (!isEditorOpen || editorMode !== "edit" || !selectedAccount) {
      return;
    }

    setFormState(buildFormStateFromAccount(selectedAccount));
  }, [editorMode, isEditorOpen, selectedAccount]);

  useEffect(() => {
    if (editorMode === "edit" && selectedAccountId !== null && !selectedAccount && !snapshotQuery.isFetching) {
      setIsEditorOpen(false);
      setSelectedAccountId(null);
    }
  }, [editorMode, selectedAccount, selectedAccountId, snapshotQuery.isFetching]);

  function openCreateEditor() {
    if (!activeWorkspace) {
      return;
    }

    setFeedbackMessage("");
    setErrorMessage("");
    setInvalidFields(new Set());
    setEditorMode("create");
    setSelectedAccountId(null);
    setFormState(createDefaultFormState(activeWorkspace.baseCurrencyCode));
    setIsDirty(false);
    setIsEditorOpen(true);
  }

  function openEditEditor(account: AccountSummary) {
    setFeedbackMessage("");
    setErrorMessage("");
    setInvalidFields(new Set());
    setEditorMode("edit");
    setSelectedAccountId(account.id);
    setFormState(buildFormStateFromAccount(account));
    setIsDirty(false);
    setIsEditorOpen(true);
  }

  function closeEditor() {
    if (isSaving) {
      return;
    }

    clearPersistedAccountEditorState();
    setIsEditorOpen(false);
    setSelectedAccountId(null);
    setErrorMessage("");
    setIsDirty(false);
  }

  function requestCloseEditor() {
    if (isSaving) return;
    if (isDirty) {
      setShowUnsavedDialog(true);
    } else {
      closeEditor();
    }
  }

  function updateFormState<Field extends keyof AccountFormState>(
    field: Field,
    value: AccountFormState[Field],
  ) {
    setIsDirty(true);
    setFormState((currentState) => ({
      ...currentState,
      [field]: value,
    }));
  }

  function handleAccountTypeChange(nextType: string) {
    const preset = getTypePreset(nextType);

    setIsDirty(true);
    setFormState((currentState) => ({
      ...currentState,
      type: nextType,
      color: currentState.color === getTypePreset(currentState.type).color ? preset.color : currentState.color,
      icon: currentState.icon === getTypePreset(currentState.type).icon ? preset.icon : currentState.icon,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeWorkspace || !user) {
      return;
    }

    setFeedbackMessage("");
    setErrorMessage("");

    const parsedOpeningBalance = Number(formState.openingBalance);
    const accountErrors: string[] = [];
    if (!formState.name.trim()) accountErrors.push("name");
    if (Number.isNaN(parsedOpeningBalance)) accountErrors.push("openingBalance");
    if (accountErrors.length > 0) {
      setInvalidFields(new Set(accountErrors));
      setErrorMessage(accountErrors.includes("name") ? "Ingresa un nombre para la cuenta." : "El saldo inicial debe ser un numero valido.");
      return;
    }

    try {
      if (editorMode === "create") {
        await createAccountMutation.mutateAsync({
          ...toAccountInput(formState),
          sortOrder: (snapshot?.accounts.length ?? 0) + 1,
          userId: user.id,
          workspaceId: activeWorkspace.id,
        });

        clearPersistedAccountEditorState();
        setFeedbackMessage("Cuenta creada correctamente.");
        setIsEditorOpen(false);
        return;
      }

      if (!selectedAccount) {
        setErrorMessage("No encontramos la cuenta que quieres editar.");
        return;
      }

      await updateAccountMutation.mutateAsync({
        ...toAccountInput(formState),
        accountId: selectedAccount.id,
        userId: user.id,
        workspaceId: activeWorkspace.id,
      });

      clearPersistedAccountEditorState();
      setFeedbackMessage("Cuenta actualizada correctamente.");
      setIsEditorOpen(false);
    } catch (error) {
      setErrorMessage(getQueryErrorMessage(error, "No pudimos guardar la cuenta."));
    }
  }

  async function handleConfirmArchiveToggle() {
    if (!activeWorkspace || !user || !archiveTarget) {
      return;
    }

    const nextArchivedValue = !archiveTarget.isArchived;

    setFeedbackMessage("");
    setErrorMessage("");

    try {
      await archiveAccountMutation.mutateAsync({
        accountId: archiveTarget.id,
        isArchived: nextArchivedValue,
        userId: user.id,
        workspaceId: activeWorkspace.id,
      });

      setArchiveTargetId(null);
      setFeedbackMessage(
        nextArchivedValue ? "Cuenta archivada correctamente." : "Cuenta reactivada correctamente.",
      );
    } catch (error) {
      setErrorMessage(getQueryErrorMessage(error, "No pudimos actualizar el estado de la cuenta."));
    }
  }

  function handleArchiveToggle(account: AccountSummary) {
    if (!activeWorkspace || !user) {
      return;
    }

    setFeedbackMessage("");
    setErrorMessage("");
    setArchiveTargetId(account.id);
  }

  function handleDeleteAccount() {
    if (!activeWorkspace || !selectedAccount) return;
    setShowDeleteDialog(true);
  }

  async function handleBulkDelete() {
    if (selectedCount === 0) return;
    setShowBulkDeleteConfirm(true);
  }

  async function confirmBulkDelete() {
    setIsBulkDeleting(true);
    try {
      for (const id of Array.from(selectedIds)) {
        await archiveAccountMutation.mutateAsync({ accountId: id, isArchived: true, userId: user!.id, workspaceId: activeWorkspace!.id });
      }
      clearAll();
    } catch (err) {
      setErrorMessage(getQueryErrorMessage(err));
    } finally {
      setIsBulkDeleting(false);
      setShowBulkDeleteConfirm(false);
    }
  }

  function handleConfirmDeleteAccount() {
    if (!activeWorkspace || !selectedAccount) return;
    const targetId = selectedAccount.id;
    setShowDeleteDialog(false);
    setIsEditorOpen(false);
    setSelectedAccountId(null);
    clearPersistedAccountEditorState();
    setHiddenIds((prev) => new Set([...prev, targetId]));
    schedule({
      label: "Cuenta eliminada permanentemente",
      onCommit: () =>
        deleteAccountMutation.mutateAsync({ accountId: targetId, workspaceId: activeWorkspace.id }),
      onUndo: () => {
        setHiddenIds((prev) => {
          const next = new Set(prev);
          next.delete(targetId);
          return next;
        });
      },
    });
  }

  if (workspaceError) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader
          description="Necesitamos permisos de lectura del workspace para mostrar y editar las cuentas."
          eyebrow="accounts"
          title="Cuentas no disponibles"
        />
        <DataState
          description={getQueryErrorMessage(workspaceError, "No pudimos leer tus workspaces reales.")}
          title="No hay acceso al workspace"
          tone="error"
        />
      </div>
    );
  }

  if (!activeWorkspace && !isWorkspacesLoading) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader
          description="Las cuentas viven dentro de un workspace real."
          eyebrow="accounts"
          title="Cuentas financieras"
        />
        <DataState
          description="Cuando exista un workspace personal o compartido, aqui veras solo las cuentas reales de la base."
          title="Sin cuentas para mostrar"
        />
      </div>
    );
  }

  if (!snapshot && (isWorkspacesLoading || snapshotQuery.isLoading)) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader
          actions={
            <>
              <Button disabled variant="ghost">
                Ver archivadas
              </Button>
              <Button disabled>
                <Plus className="mr-2 h-4 w-4" />
                Nueva cuenta
              </Button>
            </>
          }
          description="Inventario financiero del workspace con saldos, archivado y patrimonio."
          eyebrow="accounts"
          title="Cuentas financieras"
        />
        <AccountsLoadingSkeleton />
      </div>
    );
  }

  if (snapshotQuery.error || !snapshot) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader
          description="Intentamos leer la tabla accounts y calcular los saldos actuales."
          eyebrow="accounts"
          title="No fue posible cargar las cuentas"
        />
        <DataState
          description={getQueryErrorMessage(snapshotQuery.error, "No pudimos leer la informacion de cuentas.")}
          title="Error al consultar cuentas reales"
          tone="error"
        />
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader
          actions={
            <>
              <ViewSelector available={["grid", "list", "table"]} onChange={setViewMode} value={viewMode} />
              {viewMode === "table" ? (
                <ColumnPicker columns={accountColumns} visible={colVis} onToggle={toggleCol} />
              ) : null}
              <Button
                onClick={() =>
                  downloadAccountsCSV(
                    filteredAccounts,
                    `cuentas-${new Date().toISOString().slice(0, 10)}.csv`,
                  )
                }
                variant="ghost"
              >
                <Download className="mr-2 h-4 w-4" />
                Exportar CSV
              </Button>
              <Button
                onClick={() => setShowArchived((currentValue) => !currentValue)}
                variant="ghost"
              >
                {showArchived ? "Ocultar archivadas" : "Ver archivadas"}
              </Button>
              <Button onClick={openCreateEditor}>
                <Plus className="mr-2 h-4 w-4" />
                Nueva cuenta
              </Button>
            </>
          }
          description="Inventario real de cuentas por workspace, con saldo actual calculado desde opening_balance y movimientos aplicados."
          eyebrow="accounts"
          title="Cuentas financieras"
        >
          <div className="flex flex-wrap gap-3 text-sm text-storm">
            <StatusBadge status={`${snapshot.accounts.length} cuentas`} tone="neutral" />
            <StatusBadge status={`${archivedAccounts.length} archivadas`} tone="warning" />
            <StatusBadge status={formatWorkspaceKindLabel(snapshot.workspace.kind)} tone="info" />
            {snapshotQuery.isFetching ? (
              <StatusBadge
                className="animate-soft-pulse"
                status="Actualizando"
                tone="neutral"
              />
            ) : null}
          </div>
        </PageHeader>

        {errorMessage && !isEditorOpen ? (
          <DataState
            description={errorMessage}
            title="No pudimos completar la accion"
            tone="error"
          />
        ) : null}

        {visibleAccounts.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-storm" />
              <input
                className="w-full rounded-[18px] border border-white/10 bg-white/[0.04] py-2.5 pl-10 pr-4 text-sm text-ink outline-none transition placeholder:text-storm/70 focus:border-pine/25 focus:bg-[#111b2a] focus:shadow-[0_0_0_4px_rgba(107,228,197,0.08)]"
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar cuenta..."
                type="text"
                value={searchQuery}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {([{v:"all",l:"Todos"},{v:"cash",l:"Efectivo"},{v:"bank",l:"Banco"},{v:"savings",l:"Ahorros"},{v:"credit_card",l:"Tarjeta"},{v:"investment",l:"Inversion"},{v:"loan_wallet",l:"Prestamos"}] as const).map(({v, l}) => (
                <button
                  className={`rounded-full border px-3 py-2 text-xs font-medium transition ${typeFilter === v ? "border-pine/30 bg-pine/15 text-pine" : "border-white/10 bg-white/[0.04] text-storm hover:border-white/16 hover:text-ink"}`}
                  key={v}
                  onClick={() => setTypeFilter(v)}
                  type="button"
                >
                  {l}
                </button>
              ))}
            </div>
            {hasActiveFilters ? (
              <button
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-storm transition hover:border-white/16 hover:text-ink"
                onClick={() => { setSearchQuery(""); setTypeFilter("all"); }}
                type="button"
              >
                <X className="inline-block mr-1 h-3 w-3" />
                Limpiar
              </button>
            ) : null}
          </div>
        ) : null}

        {visibleAccounts.length === 0 ? (
          <DataState
            action={<Button onClick={openCreateEditor}>Crear primera cuenta</Button>}
            description={
              showArchived
                ? "No hay cuentas archivadas en este workspace."
                : "Todavia no se registraron cuentas en este workspace. Cuando exista la primera, aqui veras saldo, patrimonio y actividad real."
            }
            title={showArchived ? "No hay cuentas archivadas" : "No hay cuentas reales todavia"}
          />
        ) : filteredAccounts.length === 0 ? (
          <DataState description="Prueba cambiando los filtros o el texto de busqueda." title="Sin resultados" />
        ) : viewMode === "list" ? (
          <div className="space-y-3">
            {filteredAccounts.map((account) => {
              const AccountIcon = getAccountIcon(account.icon, account.type);
              const typeLabel = getTypePreset(account.type).label;

              return (
                <article
                  className="flex items-center gap-4 rounded-[22px] border border-white/10 bg-white/[0.03] px-5 py-4 transition hover:border-white/16"
                  key={account.id}
                >
                  <SelectionCheckbox
                    checked={selectedIds.has(account.id)}
                    onChange={() => toggleSelect(account.id)}
                  />
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-white/10 text-white"
                    style={{ backgroundColor: account.color }}
                  >
                    <AccountIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink">{account.name}</p>
                    <p className="text-xs text-storm">
                      {typeLabel} · {account.currencyCode}
                      {account.isArchived ? " · archivada" : ""}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-ink">
                    {formatCurrency(account.currentBalance, account.currencyCode)}
                  </p>
                  <Button
                    className="shrink-0 py-1.5 text-xs"
                    onClick={() => setAnalyticsAccountId(account.id)}
                    variant="ghost"
                  >
                    <BarChart3 className="mr-1.5 h-3.5 w-3.5" />
                    Análisis
                  </Button>
                  <Button
                    className="shrink-0 py-1.5 text-xs"
                    onClick={() => openEditEditor(account)}
                    variant="ghost"
                  >
                    Editar
                  </Button>
                </article>
              );
            })}
          </div>
        ) : viewMode === "table" ? (
          <div className="overflow-x-auto rounded-[22px] border border-white/10 bg-white/[0.03]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="w-10 px-4 py-3.5">
                    <SelectionCheckbox
                      ariaLabel="Seleccionar todas"
                      checked={allSelected}
                      indeterminate={someSelected}
                      onChange={() => (allSelected ? clearAll() : selectAll())}
                    />
                  </th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.18em] text-storm">Cuenta</th>
                  <th className={`px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.18em] text-storm ${cv("tipo")}`}>Tipo</th>
                  <th className={`px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-[0.18em] text-storm ${cv("saldo")}`}>Saldo actual</th>
                  <th className={`px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.18em] text-storm ${cv("moneda")}`}>Moneda</th>
                  <th className={`px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.18em] text-storm ${cv("estado")}`}>Estado</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-[0.18em] text-storm">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredAccounts.map((account) => {
                  const AccountIcon = getAccountIcon(account.icon, account.type);
                  const typeLabel = getTypePreset(account.type).label;

                  return (
                    <tr
                      className="border-b border-white/[0.06] transition last:border-0 hover:bg-white/[0.02]"
                      key={account.id}
                    >
                      <td className="w-10 px-4 py-4">
                        <SelectionCheckbox
                          ariaLabel={`Seleccionar ${account.name}`}
                          checked={selectedIds.has(account.id)}
                          onChange={() => toggleSelect(account.id)}
                        />
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-white"
                            style={{ backgroundColor: account.color }}
                          >
                            <AccountIcon className="h-3.5 w-3.5" />
                          </div>
                          <span className="font-medium text-ink">{account.name}</span>
                        </div>
                      </td>
                      <td className={`px-5 py-4 text-storm ${cv("tipo")}`}>{typeLabel}</td>
                      <td className={`px-5 py-4 text-right font-semibold text-ink ${cv("saldo")}`}>
                        {formatCurrency(account.currentBalance, account.currencyCode)}
                      </td>
                      <td className={`px-5 py-4 text-storm ${cv("moneda")}`}>{account.currencyCode}</td>
                      <td className={`px-5 py-4 ${cv("estado")}`}>
                        <div className="flex flex-wrap gap-1.5">
                          <StatusBadge
                            status={account.includeInNetWorth ? "incluida" : "fuera de patrimonio"}
                            tone={account.includeInNetWorth ? "success" : "warning"}
                          />
                          {account.isArchived ? <StatusBadge status="archivada" tone="neutral" /> : null}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            className="py-1.5 text-xs"
                            onClick={() => setAnalyticsAccountId(account.id)}
                            variant="ghost"
                          >
                            <BarChart3 className="mr-1.5 h-3.5 w-3.5" />
                            Análisis
                          </Button>
                          <Button
                            className="py-1.5 text-xs"
                            onClick={() => openEditEditor(account)}
                            variant="ghost"
                          >
                            Editar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <section className="grid gap-4 xl:grid-cols-3 2xl:grid-cols-4">
            {filteredAccounts.map((account) => {
              const AccountIcon = getAccountIcon(account.icon, account.type);
              const isSelected = selectedIds.has(account.id);
              const longPressHandlers = createLongPressHandlers(() => toggleSelect(account.id));

              return (
                <article
                  className={`relative glass-panel animate-rise-in rounded-[30px] p-6 transition duration-300 hover:-translate-y-0.5 hover:border-white/20 ${isSelected ? "ring-2 ring-pine/30 border-pine/25" : ""}`}
                  key={account.id}
                  onClick={(e) => {
                    if (wasRecentLongPress()) return;
                    if (selectedCount === 0) return;
                    if (e.target instanceof HTMLElement && e.target.closest('button, a, input, label, [role="button"]')) return;
                    toggleSelect(account.id);
                  }}
                  {...longPressHandlers}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-lg"
                        style={{ backgroundColor: account.color }}
                      >
                        <AccountIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-display text-2xl font-semibold text-ink">{account.name}</p>
                        <p className="mt-1 text-sm text-storm">
                          {account.type} - {account.currencyCode}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <StatusBadge
                        status={account.includeInNetWorth ? "incluida" : "fuera de patrimonio"}
                        tone={account.includeInNetWorth ? "success" : "warning"}
                      />
                      {account.isArchived ? <StatusBadge status="archivada" tone="neutral" /> : null}
                    </div>
                  </div>

                  <p className="mt-6 font-display text-4xl font-semibold text-ink">
                    {formatCurrency(account.currentBalance, account.currencyCode)}
                  </p>
                  <p className="mt-2 text-sm text-storm">
                    Saldo inicial {formatCurrency(account.openingBalance, account.currencyCode)}
                  </p>

                  <div className="mt-6 grid gap-3">
                    <div className="glass-panel-soft rounded-2xl px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-storm">Ultima actividad</p>
                      <p className="mt-2 text-sm font-medium text-ink">
                        {formatDateTime(account.lastActivity)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <Button
                        className="flex-1"
                        onClick={() => openEditEditor(account)}
                        variant="secondary"
                      >
                        Editar
                      </Button>
                      <Button
                        className="flex-1"
                        onClick={() => void handleArchiveToggle(account)}
                        variant="ghost"
                      >
                        {account.isArchived ? "Activar" : "Archivar"}
                      </Button>
                    </div>
                    <Button
                      className="w-full justify-center gap-2"
                      onClick={() => setAnalyticsAccountId(account.id)}
                      variant="ghost"
                    >
                      <BarChart3 className="h-4 w-4" />
                      Ver análisis
                    </Button>
                  </div>
                </article>
              );
            })}
          </section>
        )}

        <SurfaceCard
          action={<PiggyBank className="h-5 w-5 text-gold" />}
          description="Resumen calculado directamente desde los registros reales del workspace."
          title="Patrimonio del workspace"
        >
          <div className="grid gap-4 md:grid-cols-4">
            <div className="glass-panel-soft rounded-[26px] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-storm">Cuentas activas</p>
              <p className="mt-3 font-display text-3xl font-semibold text-ink">{activeAccounts.length}</p>
              <p className="mt-2 text-sm text-storm">No archivadas dentro del workspace.</p>
            </div>
            <div className="glass-panel-soft rounded-[26px] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-storm">Net worth</p>
              <p className="mt-3 font-display text-3xl font-semibold text-ink">
                {formatCurrency(netWorthDisplay.amount, netWorthDisplay.currencyCode)}
              </p>
              <p className="mt-2 text-sm text-storm">Solo cuentas incluidas en patrimonio.</p>
            </div>
            <div className="glass-panel-soft rounded-[26px] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-storm">Fuera de patrimonio</p>
              <p className="mt-3 font-display text-3xl font-semibold text-ink">{excludedAccounts}</p>
              <p className="mt-2 text-sm text-storm">Cuentas excluidas del calculo neto.</p>
            </div>
            <div className="glass-panel-soft rounded-[26px] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-storm">Archivadas</p>
              <p className="mt-3 font-display text-3xl font-semibold text-ink">{archivedAccounts.length}</p>
              <p className="mt-2 text-sm text-storm">Disponibles para reactivar o eliminar.</p>
            </div>
          </div>
        </SurfaceCard>
      </div>

      {isEditorOpen ? (
        <AccountEditorDialog
          baseCurrencyCode={snapshot.workspace.baseCurrencyCode}
          clearFieldError={clearFieldError}
          closeEditor={requestCloseEditor}
          errorMessage={errorMessage}
          formState={formState}
          handleAccountTypeChange={handleAccountTypeChange}
          handleArchiveToggle={handleArchiveToggle}
          handleDeleteAccount={handleDeleteAccount}
          handleSubmit={handleSubmit}
          invalidFields={invalidFields}
          isCreateMode={editorMode === "create"}
          isSaving={isSaving}
          selectedAccount={selectedAccount}
          updateFormState={updateFormState}
        />
      ) : null}

      {showUnsavedDialog ? (
        <UnsavedChangesDialog
          onDiscard={() => { setShowUnsavedDialog(false); closeEditor(); }}
          onKeepEditing={() => setShowUnsavedDialog(false)}
        />
      ) : null}

      {archiveTarget ? (
        <AccountArchiveDialog
          account={archiveTarget}
          isSaving={archiveAccountMutation.isPending}
          onCancel={() => {
            if (!archiveAccountMutation.isPending) {
              setArchiveTargetId(null);
            }
          }}
          onConfirm={() => {
            void handleConfirmArchiveToggle();
          }}
        />
      ) : null}

      {showDeleteDialog && selectedAccount ? (
        <DeleteConfirmDialog
          badge="Eliminar cuenta"
          description="Esto elimina la cuenta permanentemente. Si tiene movimientos vinculados, primero tendras que resolverlos."
          isDeleting={deleteAccountMutation.isPending}
          onCancel={() => {
            if (!deleteAccountMutation.isPending) {
              setShowDeleteDialog(false);
            }
          }}
          onConfirm={() => {
            void handleConfirmDeleteAccount();
          }}
        >
          {(() => {
            const AccountIcon = getAccountIcon(selectedAccount.icon, selectedAccount.type);
            return (
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] text-white" style={{ backgroundColor: selectedAccount.color }}>
                    <AccountIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{selectedAccount.name}</p>
                    <p className="text-sm text-storm">{getTypePreset(selectedAccount.type).label} · {selectedAccount.currencyCode}</p>
                  </div>
                </div>
                <p className="mt-4 font-display text-2xl font-semibold text-ink">{formatCurrency(selectedAccount.currentBalance, selectedAccount.currencyCode)}</p>
              </div>
            );
          })()}
        </DeleteConfirmDialog>
      ) : null}

      {analyticsAccountId !== null && snapshot ? (() => {
        const analyticsAccount = snapshot.accounts.find((a) => a.id === analyticsAccountId);
        return analyticsAccount ? (
          <AccountAnalyticsModal
            account={analyticsAccount}
            movements={snapshot.movements}
            onClose={() => setAnalyticsAccountId(null)}
          />
        ) : null;
      })() : null}

      <BulkActionBar
        deleteLabel="Archivar"
        deletingLabel="Archivando..."
        isDeleting={isBulkDeleting}
        onClearAll={clearAll}
        onDelete={handleBulkDelete}
        onExport={() => downloadAccountsCSV(selectedItems, `cuentas-seleccionadas-${new Date().toISOString().slice(0, 10)}.csv`)}
        onSelectAll={selectAll}
        selectedCount={selectedCount}
        totalCount={filteredAccounts.length}
      />
      {showBulkDeleteConfirm ? (
        <div className="fixed inset-0 z-[310] flex items-center justify-center bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="acc-bulk-title">
          <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-[#0d1520] p-6">
            <h2 className="font-display text-xl font-semibold text-ink" id="acc-bulk-title">
              Archivar {selectedCount} cuenta{selectedCount !== 1 ? "s" : ""}?
            </h2>
            <p className="mt-3 text-sm leading-7 text-storm">
              Las cuentas seleccionadas seran archivadas y dejaran de aparecer en el flujo principal. Podras reactivarlas despues.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button disabled={isBulkDeleting} onClick={() => void confirmBulkDelete()}>
                {isBulkDeleting ? "Archivando..." : `Archivar ${selectedCount}`}
              </Button>
              <Button disabled={isBulkDeleting} onClick={() => setShowBulkDeleteConfirm(false)} variant="ghost">
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
