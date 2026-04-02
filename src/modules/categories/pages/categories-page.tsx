import {
  BadgeDollarSign,
  BadgePercent,
  Banknote,
  BarChart3,
  BriefcaseBusiness,
  CarFront,
  Download,
  Dumbbell,
  FileText,
  Fuel,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  Landmark,
  Laptop,
  LoaderCircle,
  PartyPopper,
  PawPrint,
  PencilLine,
  Pill,
  Plane,
  Plus,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  Shapes,
  Shirt,
  Sparkles,
  Trash2,
  Utensils,
  UtensilsCrossed,
  Wifi,
  X,
} from "lucide-react";
import type { FormEvent, InputHTMLAttributes, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "../../../components/ui/button";
import { DataState } from "../../../components/ui/data-state";
import { DeleteConfirmDialog } from "../../../components/ui/delete-confirm-dialog";
import { FormFeedbackBanner } from "../../../components/ui/form-feedback-banner";
import { PageHeader } from "../../../components/ui/page-header";
import { StatusBadge } from "../../../components/ui/status-badge";
import { SurfaceCard } from "../../../components/ui/surface-card";
import { useSuccessToast } from "../../../components/ui/toast-provider";
import { useUndoQueue } from "../../../components/ui/undo-queue";
import { useViewMode, ViewSelector } from "../../../components/ui/view-selector";
import { ColumnPicker, type ColumnDef, useColumnVisibility } from "../../../components/ui/column-picker";
import { BulkActionBar, SelectionCheckbox, useSelection, createLongPressHandlers, wasRecentLongPress } from "../../../components/ui/bulk-action-bar";
import { formatDate } from "../../../lib/formatting/dates";
import { UnsavedChangesDialog } from "../../../components/ui/unsaved-changes-dialog";
import type { CategoryKind, CategoryOverview } from "../../../types/domain";
import { useAuth } from "../../auth/auth-context";
import { useActiveWorkspace } from "../../workspaces/use-active-workspace";
import { CategoryAnalyticsModal } from "../components/category-analytics-modal";
import {
  getQueryErrorMessage,
  type CategoryFormInput,
  useCategoriesOverviewQuery,
  useWorkspaceSnapshotQuery,
  useCreateCategoryMutation,
  useDeleteCategoryMutation,
  useToggleCategoryMutation,
  useUpdateCategoryMutation,
} from "../../../services/queries/workspace-data";

type EditorMode = "create" | "edit";
type KindFilter = "all" | CategoryKind;
type CategoryStatusFilter = "all" | "active" | "inactive";

type CategoryFormState = {
  name: string;
  kind: CategoryKind;
  parentId: number | null;
  color: string;
  icon: string;
  sortOrder: string;
  isActive: boolean;
};

type FeedbackState = {
  tone: "success" | "error";
  title: string;
  description: string;
};

type CategoryTableFilters = {
  name: string;
  kind: KindFilter;
  status: CategoryStatusFilter;
  parent: string;
  movements: string;
  subscriptions: string;
};

const fieldClassName =
  "w-full rounded-[24px] border border-white/10 bg-[#0d1420]/95 px-4 text-sm text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] outline-none transition duration-200 placeholder:text-storm/70 hover:border-white/14 hover:bg-[#101928] focus:border-pine/25 focus:bg-[#111b2a] focus:shadow-[0_0_0_4px_rgba(107,228,197,0.08)] disabled:cursor-not-allowed disabled:opacity-60";
const inputClassName = `${fieldClassName} h-14`;

const kindOptions = [
  {
    value: "expense" as const,
    label: "Gasto",
    description: "Para compras, pagos y egresos del dia a dia.",
    tone: "warning" as const,
    defaultColor: "#C46A31",
  },
  {
    value: "income" as const,
    label: "Ingreso",
    description: "Para ventas, sueldos, reembolsos y entradas de dinero.",
    tone: "success" as const,
    defaultColor: "#1B6A58",
  },
  {
    value: "both" as const,
    label: "Mixta",
    description: "Sirve tanto para entradas como para salidas cuando te conviene una sola familia.",
    tone: "info" as const,
    defaultColor: "#4566D6",
  },
] as const;

const iconOptions = [
  { value: "utensils", label: "Alimentacion", icon: Utensils },
  { value: "utensils-crossed", label: "Restaurantes", icon: UtensilsCrossed },
  { value: "car", label: "Transporte", icon: CarFront },
  { value: "fuel", label: "Combustible", icon: Fuel },
  { value: "receipt", label: "Servicios", icon: ReceiptText },
  { value: "wifi", label: "Internet", icon: Wifi },
  { value: "shirt", label: "Ropa", icon: Shirt },
  { value: "heart-pulse", label: "Salud", icon: HeartPulse },
  { value: "pill", label: "Farmacia", icon: Pill },
  { value: "party-popper", label: "Diversion", icon: PartyPopper },
  { value: "graduation-cap", label: "Educacion", icon: GraduationCap },
  { value: "home", label: "Hogar", icon: House },
  { value: "paw-print", label: "Mascotas", icon: PawPrint },
  { value: "plane", label: "Viajes", icon: Plane },
  { value: "gift", label: "Regalos", icon: Gift },
  { value: "file-text", label: "Impuestos", icon: FileText },
  { value: "landmark", label: "Banco", icon: Landmark },
  { value: "sparkles", label: "Suscripciones", icon: Sparkles },
  { value: "briefcase", label: "Trabajo", icon: BriefcaseBusiness },
  { value: "badge-dollar-sign", label: "Bonos", icon: BadgeDollarSign },
  { value: "laptop", label: "Freelance", icon: Laptop },
  { value: "banknote", label: "Ventas", icon: Banknote },
  { value: "badge-percent", label: "Intereses", icon: BadgePercent },
  { value: "rotate-ccw", label: "Reembolso", icon: RotateCcw },
  { value: "dumbbell", label: "Deporte", icon: Dumbbell },
  { value: "shapes", label: "General", icon: Shapes },
] as const;

const colorOptions = [
  "#1B6A58",
  "#2A7D65",
  "#0F766E",
  "#4566D6",
  "#2563EB",
  "#7C3AED",
  "#8366F2",
  "#EC4899",
  "#C46A31",
  "#F59E0B",
  "#EF4444",
  "#64748B",
];

function createDefaultFormState(categories: CategoryOverview[]): CategoryFormState {
  const nextSortOrder =
    categories.reduce((highestValue, category) => Math.max(highestValue, category.sortOrder), 0) + 10;

  return {
    name: "",
    kind: "expense",
    parentId: null,
    color: kindOptions[0].defaultColor,
    icon: "shapes",
    sortOrder: String(nextSortOrder),
    isActive: true,
  };
}

function buildFormStateFromCategory(category: CategoryOverview): CategoryFormState {
  return {
    name: category.name,
    kind: category.kind,
    parentId: category.parentId ?? null,
    color: category.color ?? getKindDefinition(category.kind).defaultColor,
    icon: category.icon ?? "shapes",
    sortOrder: String(category.sortOrder),
    isActive: category.isActive,
  };
}

function Input({
  className = "",
  max,
  min,
  step,
  type,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  const resolvedType = type === "number" ? "text" : type;

  return (
    <input
      className={`${inputClassName} ${className}`}
      max={resolvedType === "text" ? undefined : max}
      min={resolvedType === "text" ? undefined : min}
      step={resolvedType === "text" ? undefined : step}
      type={resolvedType}
      {...props}
    />
  );
}

function getKindDefinition(kind: CategoryKind) {
  return kindOptions.find((option) => option.value === kind) ?? kindOptions[0];
}

function getIconDefinition(icon: string | null | undefined) {
  return iconOptions.find((option) => option.value === icon) ?? iconOptions[iconOptions.length - 1];
}

function getLastActivityLabel(value?: string | null) {
  return value ? formatDate(value) : "Sin actividad aun";
}

function buildCategoryMonogram(name: string) {
  const normalizedValue = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((chunk) => chunk.slice(0, 1).toUpperCase())
    .join("");

  return normalizedValue || "CT";
}

function CategoryEditorDialog({
  categories,
  clearFieldError,
  closeEditor,
  feedback,
  formState,
  invalidFields,
  isCreateMode,
  isSaving,
  onSubmit,
  selectedCategoryId,
  updateFormState,
}: {
  categories: CategoryOverview[];
  clearFieldError: (field: string) => void;
  closeEditor: () => void;
  feedback: FeedbackState | null;
  formState: CategoryFormState;
  invalidFields: Set<string>;
  isCreateMode: boolean;
  isSaving: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  selectedCategoryId: number | null;
  updateFormState: <Field extends keyof CategoryFormState>(
    field: Field,
    value: CategoryFormState[Field],
  ) => void;
}) {
  const kindDefinition = getKindDefinition(formState.kind);
  const iconDefinition = getIconDefinition(formState.icon);
  const PreviewIcon = iconDefinition.icon;
  const title = formState.name.trim() || "Nueva categoria";
  const availableParentOptions = categories.filter((category) => category.id !== selectedCategoryId);

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

  function handleKindChange(nextKind: CategoryKind) {
    updateFormState("kind", nextKind);

    if (!formState.color || formState.color === getKindDefinition(formState.kind).defaultColor) {
      updateFormState("color", getKindDefinition(nextKind).defaultColor);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] isolate overflow-y-auto bg-[#02060d]/82 p-3 backdrop-blur-xl before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-32 before:bg-[#02060d]/68 before:backdrop-blur-2xl before:content-[''] sm:p-6" onMouseDown={(e) => { (e.currentTarget as HTMLDivElement).dataset.pressStart = String(Date.now()); }} onMouseUp={(e) => { const t0 = Number((e.currentTarget as HTMLDivElement).dataset.pressStart || "0"); delete (e.currentTarget as HTMLDivElement).dataset.pressStart; if (t0) closeEditor(); }}>
      <div className="flex min-h-full items-center justify-center">
        <div className="animate-rise-in relative w-full max-w-[1120px] overflow-hidden rounded-[38px] [transform:translateZ(0)] border border-white/10 bg-[#060b12]/95 shadow-[0_40px_130px_rgba(0,0,0,0.62)]" onMouseDown={(e) => e.stopPropagation()} onMouseUp={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
          <form className="flex max-h-[calc(100dvh-1.5rem)] flex-col overflow-hidden" noValidate onSubmit={onSubmit}>
            <div className="overflow-y-auto px-4 pb-6 pt-5 sm:px-6 sm:pb-7 sm:pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="max-w-3xl">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/90">
                      {isCreateMode ? "Nueva categoria" : "Editar categoria"}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-sm text-storm">
                      Organiza movimientos, suscripciones y filtros
                    </span>
                  </div>
                  <h2 className="mt-4 font-display text-3xl font-semibold text-ink sm:text-[2.7rem]">
                    {isCreateMode ? "Crear categoria" : "Actualizar categoria"}
                  </h2>
                  <p className="mt-4 max-w-2xl text-base leading-9 text-storm">
                    Dale una identidad visual clara y una estructura ordenada para que el resto de la app
                    se entienda mejor a simple vista.
                  </p>
                </div>
                <button
                  className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-storm transition duration-200 hover:border-white/16 hover:bg-white/[0.08] hover:text-ink"
                  onClick={closeEditor}
                  type="button"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {feedback?.tone === "error" ? (
                <FormFeedbackBanner
                  className="mt-6"
                  description={feedback.description}
                  title={feedback.title}
                />
              ) : null}

              <div className="mt-7 rounded-[34px] border border-white/10 bg-[linear-gradient(135deg,rgba(16,24,36,0.96),rgba(8,12,20,0.92))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.34)] sm:p-6">
                <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
                  <div className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5">
                    <div className="flex items-start gap-4">
                      <div
                        className="flex h-16 w-16 items-center justify-center rounded-[24px] border border-white/10 text-white"
                        style={{ background: `linear-gradient(160deg, ${formState.color || kindDefinition.defaultColor}, rgba(8,13,20,0.72))` }}
                      >
                        <PreviewIcon className="h-7 w-7" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">Vista previa</p>
                        <h3 className="mt-2 break-words font-display text-4xl font-semibold text-ink">{title}</h3>
                        <p className="mt-3 text-base leading-8 text-storm">{kindDefinition.description}</p>
                        <div className="mt-5 flex flex-wrap gap-2">
                          <StatusBadge status={kindDefinition.label} tone={kindDefinition.tone} />
                          <StatusBadge
                            status={formState.isActive ? "Activa" : "Inactiva"}
                            tone={formState.isActive ? "success" : "neutral"}
                          />
                          {formState.parentId ? (
                            <StatusBadge
                              status={
                                availableParentOptions.find((category) => category.id === formState.parentId)
                                  ?.name ?? "Con padre"
                              }
                              tone="neutral"
                            />
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4">
                    <div className="rounded-[28px] border border-white/10 bg-black/15 p-5">
                      <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">Icono</p>
                      <p className="mt-3 font-display text-2xl font-semibold text-ink">{iconDefinition.label}</p>
                      <p className="mt-2 text-sm text-storm">Te ayuda a reconocer la categoria mucho mas rapido.</p>
                    </div>
                    <div className="rounded-[28px] border border-white/10 bg-black/15 p-5">
                      <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">Orden visual</p>
                      <p className="mt-3 font-display text-2xl font-semibold text-ink">{formState.sortOrder || "10"}</p>
                      <p className="mt-2 text-sm text-storm">
                        Mientras mas bajo sea el valor, mas arriba aparecera en los listados.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-7 grid gap-5 lg:grid-cols-2">
                <div className="glass-panel-soft rounded-[32px] border border-white/10 bg-white/[0.04] p-5 sm:p-6">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/80">
                    Identidad
                  </p>
                  <h3 className="mt-2 font-display text-2xl font-semibold text-ink">Base de la categoria</h3>
                  <div className="mt-6 space-y-5">
                    <label className="block">
                      <span className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/80">
                        Nombre
                      </span>
                      <div
                        className={`mt-3${invalidFields.has("name") ? " field-error-ring" : ""}`}
                        data-field="name"
                      >
                        <Input
                          maxLength={80}
                          onChange={(event) => { clearFieldError("name"); updateFormState("name", event.target.value); }}
                          placeholder="Ej. Alimentacion"
                          type="text"
                          value={formState.name}
                        />
                      </div>
                    </label>

                    <div>
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/80">
                        Tipo
                      </p>
                      <div className="mt-3 grid gap-3">
                        {kindOptions.map((option) => (
                          <button
                            className={`rounded-[24px] border p-4 text-left transition duration-200 ${
                              formState.kind === option.value
                                ? "border-white/20 bg-white/[0.07] shadow-[0_0_0_3px_rgba(107,228,197,0.08)]"
                                : "border-white/8 bg-[#0d1623] hover:border-white/12"
                            }`}
                            key={option.value}
                            onClick={() => handleKindChange(option.value)}
                            type="button"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-medium text-ink">{option.label}</p>
                                <p className="mt-1 text-xs leading-5 text-storm">{option.description}</p>
                              </div>
                              {formState.kind === option.value ? (
                                <StatusBadge status="Activo" tone={option.tone} />
                              ) : null}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="glass-panel-soft rounded-[32px] border border-white/10 bg-white/[0.04] p-5 sm:p-6">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/80">
                    Visual
                  </p>
                  <h3 className="mt-2 font-display text-2xl font-semibold text-ink">Color e icono</h3>
                  <div className="mt-6 space-y-5">
                    <div>
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/80">
                        Color principal
                      </p>
                      <div className="mt-3 flex flex-wrap gap-3">
                        {colorOptions.map((color) => {
                          const isSelected = formState.color === color;

                          return (
                            <button
                              aria-label={`Color ${color}`}
                              className={`h-12 w-12 rounded-2xl border transition duration-200 ${
                                isSelected
                                  ? "scale-[1.03] border-white/30 shadow-[0_0_0_3px_rgba(107,228,197,0.08)]"
                                  : "border-white/10 hover:border-white/18"
                              }`}
                              key={color}
                              onClick={() => updateFormState("color", color)}
                              style={{ background: `linear-gradient(160deg, ${color}, rgba(8,13,20,0.82))` }}
                              type="button"
                            />
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/80">
                        Icono
                      </p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        {iconOptions.map((option) => {
                          const OptionIcon = option.icon;
                          const isSelected = formState.icon === option.value;

                          return (
                            <button
                              className={`rounded-[22px] border p-3 text-left transition duration-200 ${
                                isSelected
                                  ? "border-white/20 bg-white/[0.07]"
                                  : "border-white/8 bg-[#0d1623] hover:border-white/12"
                              }`}
                              key={option.value}
                              onClick={() => updateFormState("icon", option.value)}
                              type="button"
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className="flex h-10 w-10 items-center justify-center rounded-[16px] border border-white/10 text-white"
                                  style={{
                                    background: `linear-gradient(160deg, ${formState.color || kindDefinition.defaultColor}, rgba(8,13,20,0.72))`,
                                  }}
                                >
                                  <OptionIcon className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium text-ink">{option.label}</p>
                                  <p className="truncate text-xs text-storm">{option.value}</p>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="glass-panel-soft rounded-[32px] border border-white/10 bg-white/[0.04] p-5 sm:p-6">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/80">
                    Organizacion
                  </p>
                  <h3 className="mt-2 font-display text-2xl font-semibold text-ink">Orden y estructura</h3>
                  <div className="mt-6 grid gap-5 lg:grid-cols-2">
                    <label className="block">
                      <span className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/80">
                        Orden
                      </span>
                      <div
                        className={`mt-3${invalidFields.has("sortOrder") ? " field-error-ring" : ""}`}
                        data-field="sortOrder"
                      >
                        <Input
                          min="0"
                          onChange={(event) => { clearFieldError("sortOrder"); updateFormState("sortOrder", event.target.value); }}
                          placeholder="10"
                          step="10"
                          type="number"
                          value={formState.sortOrder}
                        />
                      </div>
                    </label>

                    <label className="block">
                      <span className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/80">
                        Categoria padre
                      </span>
                      <div className="mt-3">
                        <select
                          className="field-dark h-14 w-full"
                          onChange={(event) =>
                            updateFormState(
                              "parentId",
                              event.target.value ? Number(event.target.value) : null,
                            )
                          }
                          value={formState.parentId ?? ""}
                        >
                          <option className="bg-shell text-ink" value="">
                            Sin categoria padre
                          </option>
                          {availableParentOptions.map((category) => (
                            <option className="bg-shell text-ink" key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="glass-panel-soft rounded-[32px] border border-white/10 bg-white/[0.04] p-5 sm:p-6">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/80">
                    Estado
                  </p>
                  <h3 className="mt-2 font-display text-2xl font-semibold text-ink">Disponibilidad</h3>
                  <button
                    className={`mt-6 flex w-full items-center justify-between gap-4 rounded-[28px] border p-5 text-left transition duration-200 ${
                      formState.isActive
                        ? "border-pine/25 bg-pine/10"
                        : "border-white/10 bg-black/15"
                    }`}
                    onClick={() => updateFormState("isActive", !formState.isActive)}
                    type="button"
                  >
                    <div>
                      <p className="font-medium text-ink">
                        {formState.isActive ? "Categoria activa" : "Categoria inactiva"}
                      </p>
                      <p className="mt-2 text-sm leading-7 text-storm">
                        {formState.isActive
                          ? "Seguira apareciendo para nuevos movimientos, filtros y formularios."
                          : "Se conserva en el historial, pero deja de aparecer como sugerencia activa."}
                      </p>
                    </div>
                    <StatusBadge
                      status={formState.isActive ? "Activa" : "Inactiva"}
                      tone={formState.isActive ? "success" : "neutral"}
                    />
                  </button>
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 bg-black/10 px-4 py-4 sm:px-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm leading-7 text-storm">
                  {isCreateMode
                    ? "Esta categoria quedara disponible de inmediato en movimientos, suscripciones y filtros del workspace."
                    : "Los cambios se reflejaran al instante en todo el sistema donde ya se use esta categoria."}
                </p>
                <div className="flex flex-col-reverse gap-3 sm:flex-row">
                  <Button disabled={isSaving} onClick={closeEditor} variant="ghost">
                    Cancelar
                  </Button>
                  <Button disabled={isSaving} type="submit">
                    {isSaving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {isCreateMode ? "Crear categoria" : "Guardar cambios"}
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}


function CategoriesSummaryChip({
  label,
  tone = "neutral",
  value,
}: {
  label: string;
  tone?: "neutral" | "info" | "warning";
  value: ReactNode;
}) {
  const toneClasses = {
    neutral: "border-white/10 bg-white/[0.04] text-ink",
    info: "border-electric/25 bg-electric/10 text-electric",
    warning: "border-gold/30 bg-gold/10 text-gold",
  } as const;

  return (
    <div className={`inline-flex items-center gap-3 rounded-full border px-4 py-2.5 ${toneClasses[tone]}`}>
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-storm/90">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}

function CategoriesLoadingSkeleton() {
  return (
    <>
      <div className="shimmer-surface h-[248px] rounded-[32px]" />
      <div className="shimmer-surface h-[520px] rounded-[32px]" />
    </>
  );
}

const defaultCategoryTableFilters = (): CategoryTableFilters => ({
  name: "",
  kind: "all",
  status: "active",
  parent: "",
  movements: "",
  subscriptions: "",
});

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeCSV(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

function downloadCategoriesCSV(categories: CategoryOverview[], filename: string) {
  const headers = ["Nombre", "Tipo", "Categoria padre", "Activa", "Movimientos", "Suscripciones", "Ultima actividad"];
  const rows = categories.map((c) => [
    escapeCSV(c.name),
    escapeCSV(c.kind),
    escapeCSV(c.parentName ?? ""),
    escapeCSV(c.isActive ? "Si" : "No"),
    escapeCSV(c.movementCount),
    escapeCSV(c.subscriptionCount),
    escapeCSV(c.lastActivityAt ?? ""),
  ]);
  downloadCSV([headers.join(","), ...rows.map((r) => r.join(","))].join("\n"), filename);
}

export function CategoriesPage() {
  const { user, profile } = useAuth();
  const {
    activeWorkspace,
    error: workspaceError,
    isLoading: isWorkspacesLoading,
  } = useActiveWorkspace();
  const categoriesQuery = useCategoriesOverviewQuery(activeWorkspace?.id);
  const snapshotQuery = useWorkspaceSnapshotQuery(activeWorkspace, user?.id, profile);
  const createMutation = useCreateCategoryMutation(activeWorkspace?.id, user?.id);
  const updateMutation = useUpdateCategoryMutation(activeWorkspace?.id, user?.id);
  const toggleMutation = useToggleCategoryMutation(activeWorkspace?.id, user?.id);
  const deleteMutation = useDeleteCategoryMutation(activeWorkspace?.id, user?.id);

  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  useSuccessToast(feedback, {
    clear: () => setFeedback(null),
  });
  const categoryColumns: ColumnDef[] = [
    { key: "tipo", label: "Tipo" },
    { key: "padre", label: "Categoria padre" },
    { key: "movimientos", label: "Movimientos" },
    { key: "suscripciones", label: "Suscripciones" },
  ];
  const { visible: colVis, toggle: toggleCol, cv } = useColumnVisibility("columns-categories", categoryColumns);
  const [viewMode, setViewMode] = useViewMode("categories", "table");
  const [categoryFilters, setCategoryFilters] = useState<CategoryTableFilters>(() =>
    defaultCategoryTableFilters(),
  );
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
  const [editorMode, setEditorMode] = useState<EditorMode>("create");
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [analyticsCategoryId, setAnalyticsCategoryId] = useState<number | null>(null);
  const categories = categoriesQuery.data ?? [];
  const [formState, setFormState] = useState<CategoryFormState>(() => createDefaultFormState(categories));
  const selectedCategory = categories.find((category) => category.id === selectedCategoryId) ?? null;
  const deleteTarget = categories.find((category) => category.id === deleteTargetId) ?? null;
  const isSavingEditor = createMutation.isPending || updateMutation.isPending;
  const isDeleting = deleteMutation.isPending;
  const isToggling = toggleMutation.isPending;
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(new Set());
  const { schedule } = useUndoQueue();

  const filteredCategories = useMemo(() => {
    const normalizedName = categoryFilters.name.trim().toLowerCase();
    const normalizedParent = categoryFilters.parent.trim().toLowerCase();
    const normalizedMovements = categoryFilters.movements.trim();
    const normalizedSubscriptions = categoryFilters.subscriptions.trim();

    return categories.filter((category) => {
      if (hiddenIds.has(category.id)) {
        return false;
      }

      if (categoryFilters.status === "active" && !category.isActive) {
        return false;
      }

      if (categoryFilters.status === "inactive" && category.isActive) {
        return false;
      }

      if (categoryFilters.kind !== "all" && category.kind !== categoryFilters.kind) {
        return false;
      }

      if (
        normalizedName &&
        !(
          category.name.toLowerCase().includes(normalizedName) ||
          getKindDefinition(category.kind).label.toLowerCase().includes(normalizedName) ||
          (category.parentName ?? "").toLowerCase().includes(normalizedName) ||
          (category.icon ?? "").toLowerCase().includes(normalizedName)
        )
      ) {
        return false;
      }

      if (
        normalizedParent &&
        !(category.parentName ?? "").toLowerCase().includes(normalizedParent)
      ) {
        return false;
      }

      if (
        normalizedMovements &&
        !String(category.movementCount).includes(normalizedMovements)
      ) {
        return false;
      }

      if (
        normalizedSubscriptions &&
        !String(category.subscriptionCount).includes(normalizedSubscriptions)
      ) {
        return false;
      }

      return true;
    });
  }, [categories, categoryFilters, hiddenIds]);
  const { selectedIds, toggle: toggleSelect, selectAll, clearAll, selectedCount, allSelected, someSelected, selectedItems } = useSelection(filteredCategories);

  const totalActive = categories.filter((category) => category.isActive).length;
  const totalInactive = categories.length - totalActive;
  const totalExpense = categories.filter((category) => category.kind === "expense").length;
  const totalIncome = categories.filter((category) => category.kind === "income").length;
  const totalMixed = categories.filter((category) => category.kind === "both").length;
  const totalLinkedToMovements = categories.filter((category) => category.movementCount > 0).length;
  const totalLinkedToSubscriptions = categories.filter((category) => category.subscriptionCount > 0).length;

  useEffect(() => {
    if (viewMode === "table") {
      return;
    }

    setCategoryFilters((currentValue) => {
      if (!currentValue.parent && !currentValue.movements && !currentValue.subscriptions) {
        return currentValue;
      }

      return {
        ...currentValue,
        parent: "",
        movements: "",
        subscriptions: "",
      };
    });
  }, [viewMode]);

  const hasActiveCategoryFilters =
    categoryFilters.name.trim() ||
    categoryFilters.parent.trim() ||
    categoryFilters.movements.trim() ||
    categoryFilters.subscriptions.trim() ||
    categoryFilters.kind !== "all" ||
    categoryFilters.status !== "active";

  function updateCategoryFilter<Field extends keyof CategoryTableFilters>(
    field: Field,
    value: CategoryTableFilters[Field],
  ) {
    setCategoryFilters((currentValue) => ({ ...currentValue, [field]: value }));
  }

  function clearCategoryFilters() {
    setCategoryFilters(defaultCategoryTableFilters());
  }

  function updateFormState<Field extends keyof CategoryFormState>(
    field: Field,
    value: CategoryFormState[Field],
  ) {
    setIsDirty(true);
    setFormState((currentValue) => ({ ...currentValue, [field]: value }));
  }

  function closeEditor() {
    if (isSavingEditor) return;
    setIsEditorOpen(false);
    setSelectedCategoryId(null);
    setIsDirty(false);
  }

  function requestCloseEditor() {
    if (isSavingEditor) return;
    if (isDirty) {
      setShowUnsavedDialog(true);
    } else {
      closeEditor();
    }
  }

  function openCreateEditor() {
    setFeedback(null);
    setInvalidFields(new Set());
    setEditorMode("create");
    setSelectedCategoryId(null);
    setFormState(createDefaultFormState(categories));
    setIsDirty(false);
    setIsEditorOpen(true);
  }

  function openEditEditor(category: CategoryOverview) {
    setFeedback(null);
    setInvalidFields(new Set());
    setEditorMode("edit");
    setSelectedCategoryId(category.id);
    setFormState(buildFormStateFromCategory(category));
    setIsDirty(false);
    setIsEditorOpen(true);
  }

  async function handleSubmitEditor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeWorkspace || !user?.id) {
      setFeedback({
        tone: "error",
        title: "No encontramos el workspace activo",
        description: "Recarga la pagina e intenta nuevamente.",
      });
      return;
    }

    const name = formState.name.trim();
    const sortOrder = Number(formState.sortOrder);

    const errors: string[] = [];
    if (!name) errors.push("name");
    if (!Number.isFinite(sortOrder) || sortOrder < 0) errors.push("sortOrder");

    if (errors.length > 0) {
      setInvalidFields(new Set(errors));
      setFeedback({
        tone: "error",
        title: "Revisa los campos requeridos",
        description: errors.includes("name")
          ? "Dale un nombre claro para que luego sea facil encontrarla."
          : "El orden debe ser un numero positivo o cero.",
      });
      return;
    }

    const payload: CategoryFormInput = {
      name,
      kind: formState.kind,
      parentId: formState.parentId,
      color: formState.color,
      icon: formState.icon,
      sortOrder,
      isActive: formState.isActive,
    };

    try {
      if (editorMode === "create") {
        await createMutation.mutateAsync({
          workspaceId: activeWorkspace.id,
          userId: user.id,
          ...payload,
        });
        setFeedback({
          tone: "success",
          title: "Categoria creada",
          description: "Ya esta lista para usarse en movimientos, suscripciones y filtros.",
        });
      } else if (selectedCategory) {
        await updateMutation.mutateAsync({
          categoryId: selectedCategory.id,
          workspaceId: activeWorkspace.id,
          userId: user.id,
          ...payload,
        });
        setFeedback({
          tone: "success",
          title: "Categoria actualizada",
          description: "Los cambios ya se reflejan en el resto del sistema.",
        });
      }

      setIsEditorOpen(false);
      setSelectedCategoryId(null);
    } catch (error) {
      setFeedback({
        tone: "error",
        title: "No pudimos guardar la categoria",
        description: getQueryErrorMessage(error, "Intenta nuevamente en unos segundos."),
      });
    }
  }

  async function handleToggleCategory(category: CategoryOverview) {
    if (!activeWorkspace || !user?.id) {
      return;
    }

    try {
      await toggleMutation.mutateAsync({
        categoryId: category.id,
        workspaceId: activeWorkspace.id,
        userId: user.id,
        isActive: !category.isActive,
      });
      setFeedback({
        tone: "success",
        title: category.isActive ? "Categoria desactivada" : "Categoria reactivada",
        description: category.isActive
          ? "Seguiras viendo su historial, pero ya no aparecera como sugerencia activa."
          : "Volvio a estar disponible para nuevos registros.",
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        title: "No pudimos cambiar el estado",
        description: getQueryErrorMessage(error, "Intenta nuevamente en unos segundos."),
      });
    }
  }

  function handleDelete() {
    if (!activeWorkspace || !deleteTarget) return;
    const targetId = deleteTarget.id;
    setDeleteTargetId(null);
    setHiddenIds((prev) => new Set([...prev, targetId]));
    schedule({
      label: "Categoría eliminada",
      onCommit: () =>
        deleteMutation.mutateAsync({ categoryId: targetId, workspaceId: activeWorkspace.id }),
      onUndo: () => {
        setHiddenIds((prev) => {
          const next = new Set(prev);
          next.delete(targetId);
          return next;
        });
      },
    });
  }

  async function handleBulkDelete() {
    if (selectedCount === 0) return;
    setShowBulkDeleteConfirm(true);
  }

  async function confirmBulkDelete() {
    setIsBulkDeleting(true);
    try {
      for (const id of Array.from(selectedIds)) {
        await toggleMutation.mutateAsync({ categoryId: id, workspaceId: activeWorkspace!.id, userId: user!.id, isActive: false });
      }
      clearAll();
    } catch (err) {
      setFeedback({ tone: "error", title: "Error", description: getQueryErrorMessage(err) });
    } finally {
      setIsBulkDeleting(false);
      setShowBulkDeleteConfirm(false);
    }
  }

  if (!activeWorkspace && isWorkspacesLoading) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader
          description="Estamos preparando las categorias del workspace activo."
          eyebrow="categorias"
          title="Cargando categorias"
        />
        <CategoriesLoadingSkeleton />
      </div>
    );
  }

  if (workspaceError) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader
          description="Necesitamos acceder correctamente al workspace activo."
          eyebrow="categorias"
          title="Categorias no disponibles"
        />
        <DataState
          description={getQueryErrorMessage(workspaceError, "No pudimos abrir tu workspace actual.")}
          title="No hay acceso al workspace"
          tone="error"
        />
      </div>
    );
  }

  if (!activeWorkspace) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader
          description="Cuando tengas un workspace activo, aqui podras ordenar todo con tus propias categorias."
          eyebrow="categorias"
          title="Aun no hay un workspace activo"
        />
        <DataState
          description="Activa o crea un workspace para comenzar a estructurar tus categorias."
          title="Sin categorias para mostrar"
        />
      </div>
    );
  }

  if (categoriesQuery.isLoading) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader
          description="Estamos cargando la estructura visual y funcional de tus categorias."
          eyebrow="categorias"
          title="Cargando categorias"
        />
        <CategoriesLoadingSkeleton />
      </div>
    );
  }

  if (categoriesQuery.error) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader
          description="Intentamos abrir el mantenedor y resumen de categorias del workspace."
          eyebrow="categorias"
          title="No fue posible cargar las categorias"
        />
        <DataState
          description={getQueryErrorMessage(categoriesQuery.error, "Revisa permisos y vuelve a intentarlo.")}
          title="No pudimos leer las categorias"
          tone="error"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-8">
      <section className="glass-panel-strong rounded-[32px] p-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,430px)] xl:items-start">
          <div className="space-y-5">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.28em] text-storm/90">categorias</p>
              <h2 className="font-display text-4xl font-semibold text-ink">Categorias del workspace</h2>
              <p className="max-w-3xl text-sm leading-7 text-storm">
                Mantén la estructura limpia desde la tabla. Cuando trabajes en vista tabla, los filtros viven
                dentro de cada columna; en el resto de vistas reaparece el panel para explorar y ajustar con
                rapidez.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <CategoriesSummaryChip label="categorias" value={String(categories.length)} />
              <CategoriesSummaryChip label="activas" tone="info" value={String(totalActive)} />
              {totalInactive > 0 ? (
                <CategoriesSummaryChip label="inactivas" tone="warning" value={String(totalInactive)} />
              ) : null}
              <CategoriesSummaryChip
                label="con movimientos"
                tone="info"
                value={String(totalLinkedToMovements)}
              />
              <CategoriesSummaryChip
                label="con suscripciones"
                tone="info"
                value={String(totalLinkedToSubscriptions)}
              />
              {snapshotQuery.isFetching ? <CategoriesSummaryChip label="estado" value="Actualizando" /> : null}
            </div>
          </div>

          <aside className="glass-panel-soft rounded-[28px] border border-white/10 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.22em] text-storm">Control del modulo</p>
                <p className="text-sm leading-7 text-storm">
                  Crea categorias, cambia de vista y exporta. En tabla filtras por columna; en otras vistas
                  vuelves al explorador compacto.
                </p>
              </div>
              <button
                className="flex shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] p-2.5 text-storm transition hover:border-white/16 hover:text-ink disabled:opacity-50"
                disabled={snapshotQuery.isFetching}
                onClick={() => snapshotQuery.refetch()}
                title="Actualizar"
                type="button"
              >
                <RefreshCw className={`h-4 w-4${snapshotQuery.isFetching ? " animate-spin" : ""}`} />
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={openCreateEditor}>
                <Plus className="mr-2 h-4 w-4" />
                Nueva categoria
              </Button>
              <Button
                onClick={() =>
                  downloadCategoriesCSV(
                    filteredCategories,
                    `categorias-${new Date().toISOString().slice(0, 10)}.csv`,
                  )
                }
                variant="ghost"
              >
                <Download className="mr-2 h-4 w-4" />
                Exportar CSV
              </Button>
              {hasActiveCategoryFilters ? (
                <Button onClick={clearCategoryFilters} variant="ghost">
                  <X className="mr-2 h-4 w-4" />
                  Limpiar filtros
                </Button>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <ViewSelector available={["grid", "list", "table"]} onChange={setViewMode} value={viewMode} />
              {viewMode === "table" ? (
                <ColumnPicker columns={categoryColumns} visible={colVis} onToggle={toggleCol} />
              ) : null}
              <StatusBadge status={`${filteredCategories.length} visibles`} tone="neutral" />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-storm">Gasto</p>
                <p className="mt-2 text-sm font-semibold text-ink">{totalExpense}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-storm">Ingreso</p>
                <p className="mt-2 text-sm font-semibold text-ink">{totalIncome}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-storm">Mixta</p>
                <p className="mt-2 text-sm font-semibold text-ink">{totalMixed}</p>
              </div>
            </div>
          </aside>
        </div>
      </section>

      {feedback && feedback.tone !== "error" && !isEditorOpen ? (
        <DataState
          description={feedback.description}
          title={feedback.title}
          tone={feedback.tone}
        />
      ) : null}

      {categories.length > 0 && viewMode !== "table" ? (
      <SurfaceCard
        description="Filtra por nombre, tipo o estado para encontrar rapido la categoria que quieres ajustar."
        title="Explorar categorias"
      >
        <div className="grid gap-4 lg:grid-cols-[1.5fr_0.95fr_0.55fr]">
          <div className="flex items-center gap-2">
            <button
              className="flex shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] p-2.5 text-storm transition hover:border-white/16 hover:text-ink disabled:opacity-50"
              disabled={snapshotQuery.isFetching}
              onClick={() => snapshotQuery.refetch()}
              title="Actualizar"
              type="button"
            >
              <RefreshCw className={`h-4 w-4${snapshotQuery.isFetching ? " animate-spin" : ""}`} />
            </button>
            <div className="flex-1">
              <Input
                onChange={(event) => updateCategoryFilter("name", event.target.value)}
                placeholder="Buscar por nombre, tipo o categoria padre..."
                type="text"
                value={categoryFilters.name}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => updateCategoryFilter("kind", "all")}
              variant={categoryFilters.kind === "all" ? "primary" : "ghost"}
            >
              Todas
            </Button>
            {kindOptions.map((option) => (
              <Button
                key={option.value}
                onClick={() => updateCategoryFilter("kind", option.value)}
                variant={categoryFilters.kind === option.value ? "primary" : "ghost"}
              >
                {option.label}
              </Button>
            ))}
          </div>
          <Button
            onClick={() =>
              updateCategoryFilter(
                "status",
                categoryFilters.status === "active" ? "all" : "active",
              )
            }
            variant={categoryFilters.status !== "active" ? "secondary" : "ghost"}
          >
            {categoryFilters.status === "active"
              ? `Ver inactivas (${totalInactive})`
              : `Ocultar inactivas (${totalInactive})`}
          </Button>
        </div>
      </SurfaceCard>
      ) : null}

      {filteredCategories.length === 0 ? (
        <DataState
          action={
            categories.length === 0 ? (
              <Button onClick={openCreateEditor}>
                <Plus className="mr-2 h-4 w-4" />
                Crear primera categoria
              </Button>
            ) : hasActiveCategoryFilters ? (
              <Button onClick={clearCategoryFilters} variant="secondary">
                Quitar filtros
              </Button>
            ) : undefined
          }
          description={
            categories.length === 0
              ? "Todavia no hay categorias registradas en este workspace."
              : "Prueba cambiando los filtros activos o vuelve a la vista tabla para revisar cada columna."
          }
          title={categories.length === 0 ? "Sin categorias todavia" : "Sin resultados"}
        />
      ) : (
        viewMode === "list" ? (
          <div className="space-y-3">
            {filteredCategories.map((category) => {
              const kindDefinition = getKindDefinition(category.kind);
              const iconDefinition = getIconDefinition(category.icon);
              const CategoryIcon = iconDefinition.icon;
              return (
                <article className="flex items-center gap-4 rounded-[22px] border border-white/10 bg-white/[0.03] px-5 py-4 transition hover:border-white/16" key={category.id}>
                  <SelectionCheckbox
                    checked={selectedIds.has(category.id)}
                    onChange={() => toggleSelect(category.id)}
                  />
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-white/10 text-white" style={{ background: `linear-gradient(160deg, ${category.color ?? "#64748B"}, rgba(8,13,20,0.72))` }}>
                    <CategoryIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink">{category.name}</p>
                    <p className="text-xs text-storm">{kindDefinition.label} · {category.movementCount} movimientos · {category.subscriptionCount} suscripciones</p>
                  </div>
                  <div className="hidden sm:flex flex-wrap gap-2">
                    <StatusBadge status={category.isActive ? "Activa" : "Inactiva"} tone={category.isActive ? "success" : "neutral"} />
                  </div>
                  <Button className="py-1.5 text-xs shrink-0" onClick={() => setAnalyticsCategoryId(category.id)} variant="ghost">
                    <BarChart3 className="mr-1.5 h-3.5 w-3.5" />
                    Análisis
                  </Button>
                  <Button className="py-1.5 text-xs shrink-0" onClick={() => openEditEditor(category)} variant="ghost">Editar</Button>
                </article>
              );
            })}
          </div>
        ) : viewMode === "table" ? (
          <div className="overflow-x-auto rounded-[24px] border border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02]">
                  <th className="w-10 px-4 py-3.5">
                    <SelectionCheckbox
                      ariaLabel="Seleccionar todas"
                      checked={allSelected}
                      indeterminate={someSelected}
                      onChange={() => (allSelected ? clearAll() : selectAll())}
                    />
                  </th>
                  <th className="px-5 py-3 text-left text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80">Categoria</th>
                  <th className={`px-5 py-3 text-left text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80 ${cv("tipo", "hidden sm:table-cell")}`}>Tipo</th>
                  <th className="px-5 py-3 text-left text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80">Estado</th>
                  <th className={`px-5 py-3 text-left text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80 ${cv("padre", "hidden lg:table-cell")}`}>Padre</th>
                  <th className={`px-5 py-3 text-right text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80 ${cv("movimientos", "hidden md:table-cell")}`}>Movimientos</th>
                  <th className={`px-5 py-3 text-right text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80 ${cv("suscripciones", "hidden xl:table-cell")}`}>Suscripciones</th>
                  <th className="px-5 py-3 text-right text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80">Acciones</th>
                </tr>
                <tr className="border-b border-white/10 bg-[#0c1522]">
                  <th className="px-4 py-3" />
                  <th className="px-5 py-3">
                    <input
                      className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-ink outline-none transition placeholder:text-storm/70 focus:border-pine/25 focus:bg-[#111b2a]"
                      onChange={(event) => updateCategoryFilter("name", event.target.value)}
                      placeholder="Filtrar categoria"
                      type="text"
                      value={categoryFilters.name}
                    />
                  </th>
                  <th className={`px-5 py-3 ${cv("tipo", "hidden sm:table-cell")}`}>
                    <select
                      className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-ink outline-none transition focus:border-pine/25 focus:bg-[#111b2a]"
                      onChange={(event) => updateCategoryFilter("kind", event.target.value as KindFilter)}
                      value={categoryFilters.kind}
                    >
                      <option value="all">Todos</option>
                      {kindOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </th>
                  <th className="px-5 py-3">
                    <select
                      className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-ink outline-none transition focus:border-pine/25 focus:bg-[#111b2a]"
                      onChange={(event) => updateCategoryFilter("status", event.target.value as CategoryStatusFilter)}
                      value={categoryFilters.status}
                    >
                      <option value="active">Activas</option>
                      <option value="all">Todas</option>
                      <option value="inactive">Inactivas</option>
                    </select>
                  </th>
                  <th className={`px-5 py-3 ${cv("padre", "hidden lg:table-cell")}`}>
                    <input
                      className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-ink outline-none transition placeholder:text-storm/70 focus:border-pine/25 focus:bg-[#111b2a]"
                      onChange={(event) => updateCategoryFilter("parent", event.target.value)}
                      placeholder="Filtrar padre"
                      type="text"
                      value={categoryFilters.parent}
                    />
                  </th>
                  <th className={`px-5 py-3 ${cv("movimientos", "hidden md:table-cell")}`}>
                    <input
                      className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-right text-xs text-ink outline-none transition placeholder:text-storm/70 focus:border-pine/25 focus:bg-[#111b2a]"
                      onChange={(event) => updateCategoryFilter("movements", event.target.value)}
                      placeholder="Mov."
                      type="text"
                      value={categoryFilters.movements}
                    />
                  </th>
                  <th className={`px-5 py-3 ${cv("suscripciones", "hidden xl:table-cell")}`}>
                    <input
                      className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-right text-xs text-ink outline-none transition placeholder:text-storm/70 focus:border-pine/25 focus:bg-[#111b2a]"
                      onChange={(event) => updateCategoryFilter("subscriptions", event.target.value)}
                      placeholder="Subs."
                      type="text"
                      value={categoryFilters.subscriptions}
                    />
                  </th>
                  <th className="px-5 py-3 text-right">
                    {hasActiveCategoryFilters ? (
                      <button
                        className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-storm transition hover:border-white/16 hover:text-ink"
                        onClick={clearCategoryFilters}
                        type="button"
                      >
                        Limpiar
                      </button>
                    ) : null}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredCategories.map((category, index) => {
                  const kindDefinition = getKindDefinition(category.kind);
                  const iconDefinition = getIconDefinition(category.icon);
                  const CategoryIcon = iconDefinition.icon;
                  return (
                    <tr className={`border-b border-white/[0.05] transition hover:bg-white/[0.02] ${index === filteredCategories.length - 1 ? "border-b-0" : ""}`} key={category.id}>
                      <td className="w-10 px-4 py-4">
                        <SelectionCheckbox
                          ariaLabel={`Seleccionar ${category.name}`}
                          checked={selectedIds.has(category.id)}
                          onChange={() => toggleSelect(category.id)}
                        />
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-white/10 text-white" style={{ background: `linear-gradient(160deg, ${category.color ?? "#64748B"}, rgba(8,13,20,0.72))` }}>
                            <CategoryIcon className="h-3.5 w-3.5" />
                          </div>
                          <div>
                            <p className="font-medium text-ink">{category.name}</p>
                            {category.parentName ? <p className="text-xs text-storm">{category.parentName}</p> : null}
                          </div>
                        </div>
                      </td>
                      <td className={`px-5 py-3.5 ${cv("tipo", "hidden sm:table-cell")}`}><StatusBadge status={kindDefinition.label} tone={kindDefinition.tone} /></td>
                      <td className="px-5 py-3.5"><StatusBadge status={category.isActive ? "Activa" : "Inactiva"} tone={category.isActive ? "success" : "neutral"} /></td>
                      <td className={`px-5 py-3.5 text-storm ${cv("padre", "hidden lg:table-cell")}`}>{category.parentName ?? "-"}</td>
                      <td className={`px-5 py-3.5 text-right text-storm ${cv("movimientos", "hidden md:table-cell")}`}>{category.movementCount}</td>
                      <td className={`px-5 py-3.5 text-right text-storm ${cv("suscripciones", "hidden xl:table-cell")}`}>{category.subscriptionCount}</td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex justify-end gap-2">
                          <Button className="py-1.5 text-xs" onClick={() => setAnalyticsCategoryId(category.id)} variant="ghost">
                            <BarChart3 className="mr-1.5 h-3.5 w-3.5" />
                            Análisis
                          </Button>
                          <Button className="py-1.5 text-xs" onClick={() => openEditEditor(category)} variant="ghost">Editar</Button>
                          <Button className="py-1.5 text-xs" disabled={isToggling} onClick={() => void handleToggleCategory(category)} variant="ghost">{category.isActive ? "Desactivar" : "Reactivar"}</Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
        <section className="grid gap-6 xl:grid-cols-2">
          {filteredCategories.map((category) => {
            const kindDefinition = getKindDefinition(category.kind);
            const iconDefinition = getIconDefinition(category.icon);
            const CategoryIcon = iconDefinition.icon;
            const isSelected = selectedIds.has(category.id);
            const longPressHandlers = createLongPressHandlers(() => toggleSelect(category.id));

            return (
              <div
                className={`relative ${isSelected ? "ring-2 ring-pine/30 rounded-[32px]" : ""}`}
                key={category.id}
                onClick={(e) => {
                  if (wasRecentLongPress()) return;
                  if (selectedCount === 0) return;
                  if (e.target instanceof HTMLElement && e.target.closest('button, a, input, label, [role="button"]')) return;
                  toggleSelect(category.id);
                }}
                {...longPressHandlers}
              >
              <SurfaceCard
                action={
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge status={kindDefinition.label} tone={kindDefinition.tone} />
                    <StatusBadge
                      status={category.isActive ? "Activa" : "Inactiva"}
                      tone={category.isActive ? "success" : "neutral"}
                    />
                    {category.isSystem ? <StatusBadge status="Base" tone="warning" /> : null}
                  </div>
                }
                className="glass-panel animate-rise-in rounded-[32px] p-6 transition duration-300 hover:-translate-y-0.5 hover:border-white/20"
                description={
                  category.parentName
                    ? `Depende de ${category.parentName}`
                    : "Categoria principal lista para organizar el workspace"
                }
                title={category.name}
              >
                <div className="space-y-5">
                  <div className="flex items-start gap-4">
                    <div
                      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] border border-white/10 text-white"
                      style={{
                        background: `linear-gradient(160deg, ${category.color ?? "#64748B"}, rgba(8,13,20,0.72))`,
                      }}
                    >
                      <CategoryIcon className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap gap-2">
                        <StatusBadge status={iconDefinition.label} tone="neutral" />
                        {category.parentName ? <StatusBadge status={category.parentName} tone="info" /> : null}
                      </div>
                      <div className="mt-4 grid gap-3 text-sm text-storm sm:grid-cols-3">
                        <div>
                          <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">
                            Orden
                          </p>
                          <p className="mt-2 font-medium text-ink">{category.sortOrder}</p>
                        </div>
                        <div>
                          <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">
                            Nombre corto
                          </p>
                          <p className="mt-2 font-medium text-ink">{buildCategoryMonogram(category.name)}</p>
                        </div>
                        <div>
                          <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">
                            Ultima actividad
                          </p>
                          <p className="mt-2 font-medium text-ink">{getLastActivityLabel(category.lastActivityAt)}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="glass-panel-soft rounded-[26px] p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-storm">Movimientos</p>
                      <p className="mt-2 font-display text-3xl font-semibold text-ink">{category.movementCount}</p>
                      <p className="mt-2 text-sm text-storm">Registros que ya usan esta categoria.</p>
                    </div>
                    <div className="glass-panel-soft rounded-[26px] p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-storm">Suscripciones</p>
                      <p className="mt-2 font-display text-3xl font-semibold text-ink">
                        {category.subscriptionCount}
                      </p>
                      <p className="mt-2 text-sm text-storm">Automatizaciones o pagos recurrentes asociados.</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 border-t border-white/10 pt-4">
                    <Button onClick={() => setAnalyticsCategoryId(category.id)} variant="ghost">
                      <BarChart3 className="mr-2 h-4 w-4" />
                      Ver análisis
                    </Button>
                    <Button onClick={() => openEditEditor(category)} variant="secondary">
                      <PencilLine className="mr-2 h-4 w-4" />
                      Editar
                    </Button>
                    <Button
                      disabled={isToggling}
                      onClick={() => {
                        void handleToggleCategory(category);
                      }}
                      variant="ghost"
                    >
                      {category.isActive ? "Desactivar" : "Reactivar"}
                    </Button>
                    <Button
                      className="text-[#ffb4bc] hover:text-white"
                      onClick={() => setDeleteTargetId(category.id)}
                      variant="ghost"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Eliminar
                    </Button>
                  </div>
                </div>
              </SurfaceCard>
              </div>
            );
          })}
        </section>
        )
      )}

      {isEditorOpen ? (
        <CategoryEditorDialog
          categories={categories}
          clearFieldError={clearFieldError}
          closeEditor={requestCloseEditor}
          feedback={feedback}
          formState={formState}
          invalidFields={invalidFields}
          isCreateMode={editorMode === "create"}
          isSaving={isSavingEditor}
          onSubmit={handleSubmitEditor}
          selectedCategoryId={selectedCategoryId}
          updateFormState={updateFormState}
        />
      ) : null}

      {showUnsavedDialog ? (
        <UnsavedChangesDialog
          onDiscard={() => { setShowUnsavedDialog(false); closeEditor(); }}
          onKeepEditing={() => setShowUnsavedDialog(false)}
        />
      ) : null}

      {deleteTarget ? (
        <DeleteConfirmDialog
          badge="Eliminar categoría"
          description="Si esta categoria ya se usa para ordenar movimientos o suscripciones, lo mas sano suele ser desactivarla en lugar de borrarla."
          isDeleting={isDeleting}
          onCancel={() => {
            if (!isDeleting) {
              setDeleteTargetId(null);
            }
          }}
          onConfirm={() => {
            void handleDelete();
          }}
        >
          {(() => {
            const iconDefinition = getIconDefinition(deleteTarget.icon);
            const PreviewIcon = iconDefinition.icon;
            return (
              <div className="flex items-start gap-4">
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-[22px] border border-white/10 text-white"
                  style={{ background: `linear-gradient(160deg, ${deleteTarget.color ?? "#64748B"}, rgba(8,13,20,0.72))` }}
                >
                  <PreviewIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-semibold text-ink">{deleteTarget.name}</p>
                  <p className="mt-2 text-sm text-storm">
                    {getKindDefinition(deleteTarget.kind).label} - {deleteTarget.movementCount} movimientos -{" "}
                    {deleteTarget.subscriptionCount} suscripciones
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <StatusBadge
                      status={deleteTarget.isActive ? "Activa" : "Inactiva"}
                      tone={deleteTarget.isActive ? "success" : "neutral"}
                    />
                    {deleteTarget.isSystem ? <StatusBadge status="Base" tone="warning" /> : null}
                  </div>
                </div>
              </div>
            );
          })()}
        </DeleteConfirmDialog>
      ) : null}

      {analyticsCategoryId !== null && snapshotQuery.data ? (() => {
        const cat = categories.find((c) => c.id === analyticsCategoryId);
        return cat ? (
          <CategoryAnalyticsModal
            baseCurrencyCode={snapshotQuery.data.workspace.baseCurrencyCode}
            category={cat}
            movements={snapshotQuery.data.movements}
            onClose={() => setAnalyticsCategoryId(null)}
          />
        ) : null;
      })() : null}

      <BulkActionBar
        deleteLabel="Desactivar"
        deletingLabel="Desactivando..."
        isDeleting={isBulkDeleting}
        onClearAll={clearAll}
        onDelete={handleBulkDelete}
        onExport={() => downloadCategoriesCSV(selectedItems, `categorias-seleccionadas-${new Date().toISOString().slice(0, 10)}.csv`)}
        onSelectAll={selectAll}
        selectedCount={selectedCount}
        totalCount={filteredCategories.length}
      />
      {showBulkDeleteConfirm ? (
        <div className="fixed inset-0 z-[310] flex items-center justify-center bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="cat-bulk-confirm-title">
          <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-[#0d1520] p-6">
            <h2 className="font-display text-xl font-semibold text-ink" id="cat-bulk-confirm-title">
              Desactivar {selectedCount} categoria{selectedCount !== 1 ? "s" : ""}?
            </h2>
            <p className="mt-3 text-sm leading-7 text-storm">
              Las categorias seleccionadas seran desactivadas y no apareceran en nuevos registros. Podras reactivarlas despues.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button disabled={isBulkDeleting} onClick={() => void confirmBulkDelete()}>
                {isBulkDeleting ? "Desactivando..." : `Desactivar ${selectedCount}`}
              </Button>
              <Button disabled={isBulkDeleting} onClick={() => setShowBulkDeleteConfirm(false)} variant="ghost">
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
