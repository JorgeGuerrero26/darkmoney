import {
  Archive,
  Banknote,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  CreditCard,
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
import { PageHeader } from "../../../components/ui/page-header";
import { StatusBadge } from "../../../components/ui/status-badge";
import { SurfaceCard } from "../../../components/ui/surface-card";
import { formatDateTime } from "../../../lib/formatting/dates";
import { formatCurrency } from "../../../lib/formatting/money";
import { useAuth } from "../../auth/auth-context";
import { useActiveWorkspace } from "../../workspaces/use-active-workspace";
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
    borderColor: "rgba(255, 255, 255, 0.12)",
    backgroundColor: isOpen ? "#1a202a" : "#161c25",
    boxShadow: isOpen ? "0 0 0 1px rgba(142, 165, 255, 0.16)" : "none",
  };
}

const pickerPanelStyle = {
  borderColor: "rgba(255, 255, 255, 0.12)",
  backgroundColor: "#141922",
};

const pickerSearchInputStyle = {
  borderColor: "rgba(255, 255, 255, 0.1)",
  backgroundColor: "#1a202a",
};

function getPickerOptionStyle(isSelected: boolean) {
  return {
    borderColor: isSelected ? "rgba(142, 165, 255, 0.34)" : "rgba(255, 255, 255, 0.04)",
    backgroundColor: isSelected ? "#1c2531" : "#161c25",
  };
}

const pickerEmptyStateStyle = {
  borderColor: "rgba(255, 255, 255, 0.08)",
  backgroundColor: "#161c25",
};

const accountFieldClassName =
  "w-full rounded-2xl border border-white/10 bg-[#161c25] px-4 text-sm text-ink outline-none transition placeholder:text-storm hover:border-white/14 focus:border-white/20 focus:bg-[#1a202a]";

const accountTextInputClassName = `${accountFieldClassName} h-16`;
const accountPickerTriggerClassName = `${accountFieldClassName} flex h-16 items-center justify-between gap-3 text-left`;
const accountPickerSearchInputClassName =
  "w-full rounded-2xl border border-white/10 bg-[#1a202a] py-3 pl-11 pr-4 text-sm text-ink outline-none transition placeholder:text-storm focus:border-white/20";

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
      className="relative"
      ref={containerRef}
    >
      <button
        className={accountPickerTriggerClassName}
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        style={getPickerTriggerStyle(isOpen)}
        type="button"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-ink">
            {selectedCurrency
              ? `${selectedCurrency.code} - ${selectedCurrency.label}`
              : "Selecciona una moneda"}
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-storm transition ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen ? (
        <div
          className="animate-fade-in absolute left-0 right-0 top-[calc(100%+0.65rem)] z-30 rounded-[28px] border p-3 shadow-[0_30px_80px_rgba(0,0,0,0.58)]"
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
                    className={`flex w-full items-center justify-between gap-3 rounded-[22px] border px-4 py-3 text-left transition ${
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
                    <div className="min-w-0">
                      <p className="font-medium text-ink">
                        {option.code} <span className="text-storm">- {option.symbol}</span>
                      </p>
                      <p className="mt-1 truncate text-xs text-storm">
                        {option.label} - {option.region}
                      </p>
                    </div>
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
      className="relative"
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
            style={{ backgroundColor: selectedType.color }}
          >
            <SelectedTypeIcon className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-ink">{selectedType.label}</span>
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-storm transition ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen ? (
        <div
          className="animate-fade-in absolute left-0 right-0 top-[calc(100%+0.65rem)] z-30 rounded-[28px] border p-3 shadow-[0_30px_80px_rgba(0,0,0,0.58)]"
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
                    className={`flex w-full items-center justify-between gap-3 rounded-[22px] border px-4 py-3 text-left transition ${
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
      className="relative"
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
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-storm transition ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen ? (
        <div
          className="animate-fade-in absolute left-0 right-0 top-[calc(100%+0.65rem)] z-30 rounded-[28px] border p-3 shadow-[0_30px_80px_rgba(0,0,0,0.58)]"
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
                    className={`flex w-full items-center justify-between gap-3 rounded-[22px] border px-4 py-3 text-left transition ${
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

export function AccountsPage() {
  const { profile, user } = useAuth();
  const { activeWorkspace, error: workspaceError, isLoading: isWorkspacesLoading } = useActiveWorkspace();
  const snapshotQuery = useWorkspaceSnapshotQuery(activeWorkspace, user?.id, profile);
  const snapshot = snapshotQuery.data;
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<AccountEditorMode>("create");
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [formState, setFormState] = useState<AccountFormState>(() =>
    createDefaultFormState(profile?.baseCurrencyCode ?? "USD"),
  );
  const hasHydratedEditorDraft = useRef(false);
  const isEditorDraftReady = useRef(false);
  const createAccountMutation = useCreateAccountMutation(activeWorkspace?.id, user?.id);
  const updateAccountMutation = useUpdateAccountMutation(activeWorkspace?.id, user?.id);
  const archiveAccountMutation = useArchiveAccountMutation(activeWorkspace?.id, user?.id);
  const deleteAccountMutation = useDeleteAccountMutation(activeWorkspace?.id, user?.id);

  const selectedAccount =
    selectedAccountId !== null
      ? snapshot?.accounts.find((account) => account.id === selectedAccountId) ?? null
      : null;
  const visibleAccounts = showArchived
    ? snapshot?.accounts ?? []
    : (snapshot?.accounts.filter((account) => !account.isArchived) ?? []);
  const activeAccounts = snapshot?.accounts.filter((account) => !account.isArchived) ?? [];
  const archivedAccounts = snapshot?.accounts.filter((account) => account.isArchived) ?? [];
  const netWorthBalance = activeAccounts
    .filter((account) => account.includeInNetWorth)
    .reduce((total, account) => total + account.currentBalance, 0);
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
    setEditorMode("create");
    setSelectedAccountId(null);
    setFormState(createDefaultFormState(activeWorkspace.baseCurrencyCode));
    setIsEditorOpen(true);
  }

  function openEditEditor(account: AccountSummary) {
    setFeedbackMessage("");
    setErrorMessage("");
    setEditorMode("edit");
    setSelectedAccountId(account.id);
    setFormState(buildFormStateFromAccount(account));
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
  }

  function updateFormState<Field extends keyof AccountFormState>(
    field: Field,
    value: AccountFormState[Field],
  ) {
    setFormState((currentState) => ({
      ...currentState,
      [field]: value,
    }));
  }

  function handleAccountTypeChange(nextType: string) {
    const preset = getTypePreset(nextType);

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

    if (!formState.name.trim()) {
      setErrorMessage("Ingresa un nombre para la cuenta.");
      return;
    }

    const parsedOpeningBalance = Number(formState.openingBalance);

    if (Number.isNaN(parsedOpeningBalance)) {
      setErrorMessage("El saldo inicial debe ser un numero valido.");
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

  async function handleArchiveToggle(account: AccountSummary) {
    if (!activeWorkspace || !user) {
      return;
    }

    const nextArchivedValue = !account.isArchived;
    const confirmed = window.confirm(
      nextArchivedValue
        ? `Vas a archivar "${account.name}". La cuenta seguira existiendo pero saldra de la vista principal.`
        : `Vas a reactivar "${account.name}".`,
    );

    if (!confirmed) {
      return;
    }

    setFeedbackMessage("");
    setErrorMessage("");

    try {
      await archiveAccountMutation.mutateAsync({
        accountId: account.id,
        isArchived: nextArchivedValue,
        userId: user.id,
        workspaceId: activeWorkspace.id,
      });

      setFeedbackMessage(
        nextArchivedValue ? "Cuenta archivada correctamente." : "Cuenta reactivada correctamente.",
      );
    } catch (error) {
      setErrorMessage(getQueryErrorMessage(error, "No pudimos actualizar el estado de la cuenta."));
    }
  }

  async function handleDeleteAccount() {
    if (!activeWorkspace || !selectedAccount) {
      return;
    }

    const confirmed = window.confirm(
      `Vas a eliminar permanentemente "${selectedAccount.name}". Esta accion no se puede deshacer.`,
    );

    if (!confirmed) {
      return;
    }

    setFeedbackMessage("");
    setErrorMessage("");

    try {
      await deleteAccountMutation.mutateAsync({
        accountId: selectedAccount.id,
        workspaceId: activeWorkspace.id,
      });

      clearPersistedAccountEditorState();
      setFeedbackMessage("Cuenta eliminada correctamente.");
      setIsEditorOpen(false);
      setSelectedAccountId(null);
    } catch (error) {
      setErrorMessage(
        getQueryErrorMessage(
          error,
          "No pudimos eliminar la cuenta. Si tiene movimientos asociados, primero conviene archivarla.",
        ),
      );
    }
  }

  if (workspaceError) {
    return (
      <div className="space-y-6 pb-8">
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
      <div className="space-y-6 pb-8">
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
      <div className="space-y-6 pb-8">
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
      <div className="space-y-6 pb-8">
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
      <div className="space-y-6 pb-8">
        <PageHeader
          actions={
            <>
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
          description="Inventario real de cuentas por workspace, con saldo actual calculado desde opening_balance y movimientos posted."
          eyebrow="accounts"
          title="Cuentas financieras"
        >
          <div className="flex flex-wrap gap-3 text-sm text-storm">
            <StatusBadge status={`${snapshot.accounts.length} cuentas`} tone="neutral" />
            <StatusBadge status={`${archivedAccounts.length} archivadas`} tone="warning" />
            <StatusBadge status={snapshot.workspace.kind} tone="info" />
            {snapshotQuery.isFetching ? (
              <StatusBadge
                className="animate-soft-pulse"
                status="Actualizando"
                tone="neutral"
              />
            ) : null}
          </div>
        </PageHeader>

        {errorMessage ? (
          <DataState
            description={errorMessage}
            title="No pudimos completar la accion"
            tone="error"
          />
        ) : null}
        {feedbackMessage ? (
          <DataState
            description={feedbackMessage}
            title="Cambios aplicados"
            tone="success"
          />
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
        ) : (
          <section className="grid gap-4 xl:grid-cols-3 2xl:grid-cols-4">
            {visibleAccounts.map((account) => {
              const AccountIcon = getAccountIcon(account.icon, account.type);

              return (
                <article
                  className="glass-panel animate-rise-in rounded-[30px] p-6 transition duration-300 hover:-translate-y-0.5 hover:border-white/20"
                  key={account.id}
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
                {formatCurrency(netWorthBalance, snapshot.workspace.baseCurrencyCode)}
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
        <div
          aria-modal="true"
          className="animate-fade-in fixed inset-0 z-40 bg-black/52 backdrop-blur-md"
          onClick={closeEditor}
          role="dialog"
        >
          <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
            <div
              className="glass-panel-strong relative max-h-[calc(100vh-2rem)] w-full max-w-[760px] overflow-hidden rounded-[34px]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex max-h-[calc(100vh-2rem)] flex-col overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-storm/80">
                    {editorMode === "create" ? "nueva cuenta" : "editar cuenta"}
                  </p>
                  <h2 className="mt-3 font-display text-3xl font-semibold text-ink">
                    {editorMode === "create" ? "Crear cuenta" : selectedAccount?.name ?? "Cuenta"}
                  </h2>
                  <p className="mt-2 text-sm leading-7 text-storm">
                    {editorMode === "create"
                      ? "Registra una cuenta real en este workspace. Al guardar se refrescara el dashboard en segundo plano."
                      : "Actualiza los datos visuales y financieros de la cuenta seleccionada."}
                  </p>
                </div>
                <button
                  className="rounded-full border border-white/10 bg-white/[0.04] p-3 text-storm transition hover:bg-white/[0.08] hover:text-ink"
                  onClick={closeEditor}
                  type="button"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form
                className="mt-8 flex flex-1 flex-col"
                onSubmit={(event) => void handleSubmit(event)}
              >
                <div className="space-y-5">
                  <div className="glass-panel-soft rounded-[28px] p-5">
                    <div className="flex items-center gap-4">
                      <div
                        className="flex h-14 w-14 items-center justify-center rounded-3xl text-white shadow-lg"
                        style={{ backgroundColor: formState.color }}
                      >
                        {(() => {
                          const PreviewIcon = getAccountIcon(formState.icon, formState.type);
                          return <PreviewIcon className="h-6 w-6" />;
                        })()}
                      </div>
                      <div>
                        <p className="font-medium text-ink">{formState.name || "Cuenta sin nombre"}</p>
                        <p className="mt-1 text-sm text-storm">
                          {formState.type} - {formState.currencyCode || snapshot.workspace.baseCurrencyCode}
                        </p>
                      </div>
                    </div>
                  </div>

                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-ink">Nombre</span>
                    <input
                      className={accountTextInputClassName}
                      onChange={(event) => updateFormState("name", event.target.value)}
                      placeholder="Ej. Cuenta principal"
                      type="text"
                      value={formState.name}
                    />
                  </label>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-ink">Tipo</span>
                      <AccountTypeSelect
                        onChange={handleAccountTypeChange}
                        value={formState.type}
                      />
                    </label>

                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-ink">Moneda</span>
                      <CurrencySelect
                        onChange={(currencyCode) => updateFormState("currencyCode", currencyCode)}
                        value={formState.currencyCode}
                      />
                    </label>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-ink">Saldo inicial</span>
                      <input
                        className={accountTextInputClassName}
                        inputMode="decimal"
                        onChange={(event) => updateFormState("openingBalance", event.target.value)}
                        placeholder="0.00"
                        type="text"
                        value={formState.openingBalance}
                      />
                    </label>

                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-ink">Icono</span>
                      <AccountIconSelect
                        accountType={formState.type}
                        color={formState.color}
                        onChange={(icon) => updateFormState("icon", icon)}
                        value={formState.icon}
                      />
                    </label>
                  </div>

                  <div className="grid gap-4 md:grid-cols-[0.7fr_1.3fr]">
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-ink">Color</span>
                      <input
                        className={`${accountFieldClassName} h-16 p-2`}
                        onChange={(event) => updateFormState("color", event.target.value)}
                        type="color"
                        value={formState.color}
                      />
                    </label>

                    <label className="glass-panel-soft flex items-center justify-between gap-3 rounded-[26px] px-4 py-4">
                      <div>
                        <p className="text-sm font-medium text-ink">Incluir en patrimonio</p>
                        <p className="mt-1 text-sm text-storm">
                          Si la activas, esta cuenta se suma al patrimonio neto general.
                        </p>
                      </div>
                      <input
                        checked={formState.includeInNetWorth}
                        className="h-5 w-5 rounded border-ink/10 text-pine"
                        onChange={(event) => updateFormState("includeInNetWorth", event.target.checked)}
                        type="checkbox"
                      />
                    </label>
                  </div>

                  {selectedAccount ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="glass-panel-soft rounded-[24px] p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-storm">Balance actual</p>
                        <p className="mt-3 font-display text-3xl font-semibold text-ink">
                          {formatCurrency(selectedAccount.currentBalance, selectedAccount.currencyCode)}
                        </p>
                      </div>
                      <div className="glass-panel-soft rounded-[24px] p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-storm">Ultima actividad</p>
                        <p className="mt-3 text-sm font-medium text-ink">
                          {formatDateTime(selectedAccount.lastActivity)}
                        </p>
                      </div>
                    </div>
                  ) : null}

                  {errorMessage ? (
                    <DataState
                      description={errorMessage}
                      title="No pudimos guardar la cuenta"
                      tone="error"
                    />
                  ) : null}
                </div>

                <div className="mt-8 space-y-4 border-t border-white/10 pt-5">
                  <div className="flex flex-wrap gap-3">
                    <Button
                      disabled={isSaving}
                      type="submit"
                    >
                      {isSaving ? (
                        <>
                          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                          Guardando...
                        </>
                      ) : editorMode === "create" ? (
                        "Crear cuenta"
                      ) : (
                        "Guardar cambios"
                      )}
                    </Button>
                    <Button
                      disabled={isSaving}
                      onClick={closeEditor}
                      type="button"
                      variant="ghost"
                    >
                      Cancelar
                    </Button>
                  </div>

                  {selectedAccount ? (
                    <div className="grid gap-3">
                      <Button
                        className="justify-start"
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
                        className="justify-start bg-rosewood/14 text-rosewood ring-1 ring-rosewood/20 hover:bg-rosewood/20 hover:brightness-100"
                        disabled={isSaving || !selectedAccount.isArchived}
                        onClick={() => void handleDeleteAccount()}
                        type="button"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar permanente
                      </Button>

                      {!selectedAccount.isArchived ? (
                        <div className="rounded-[22px] border border-gold/18 bg-gold/10 p-4 text-sm leading-7 text-storm">
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
      ) : null}
    </>
  );
}
