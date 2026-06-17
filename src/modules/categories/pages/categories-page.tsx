import { Download, LoaderCircle, Plus, RefreshCw, ShieldCheck, X } from "lucide-react";
import type { FormEvent, InputHTMLAttributes } from "react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "../../../components/ui/button";
import { DataState } from "../../../components/ui/data-state";
import { DeleteConfirmDialog } from "../../../components/ui/delete-confirm-dialog";
import { FormFeedbackBanner } from "../../../components/ui/form-feedback-banner";
import { InfoTip } from "../../../components/ui/info-tip";
import { PageHeader } from "../../../components/ui/page-header";
import { Pagination } from "../../../components/ui/pagination";
import { SearchablePicker, type PickerOption } from "../../../components/ui/searchable-picker";
import { StatusBadge } from "../../../components/ui/status-badge";
import { useSuccessToast } from "../../../components/ui/toast-provider";
import { useUndoQueue } from "../../../components/ui/undo-queue";
import { useViewMode, ViewSelector } from "../../../components/ui/view-selector";
import { ColumnPicker, type ColumnDef, useColumnVisibility } from "../../../components/ui/column-picker";
import { BulkActionBar, useSelection } from "../../../components/ui/bulk-action-bar";
import { UnsavedChangesDialog } from "../../../components/ui/unsaved-changes-dialog";
import type { CategoryKind, CategoryOverview } from "../../../types/domain";
import { useAuth } from "../../auth/auth-context";
import { useActiveWorkspace } from "../../workspaces/use-active-workspace";
import { CategoryAnalyticsModal } from "../components/category-analytics-modal";
import { CategoryGrid } from "../components/category-grid";
import { CategoryList } from "../components/category-list";
import { CategoryTable } from "../components/category-table";
import { useCategoriesFilters } from "../hooks/use-categories-filters";
import type { CategoryStatusFilter, KindFilter } from "../lib/categories-filters";
import {
  buildCategoryMonogram,
  colorOptions,
  getIconDefinition,
  getKindDefinition,
  iconOptions,
  kindFilterPickerOptions,
  kindOptions,
  statusFilterPickerOptions,
} from "../lib/categories-presenters";
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

const CATEGORIES_PAGE_SIZE = 50;

type EditorMode = "create" | "edit";

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

const inputClassName = "field-dark";
const panelClassName = "glass-panel-soft relative min-w-0 overflow-visible rounded-[24px] p-4 sm:p-6";
const labelClassName = "text-xs font-semibold uppercase tracking-[0.22em] text-storm/80";

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

function Input({ className = "", max, min, step, type, ...props }: InputHTMLAttributes<HTMLInputElement>) {
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
  updateFormState: <Field extends keyof CategoryFormState>(field: Field, value: CategoryFormState[Field]) => void;
}) {
  const kindDefinition = getKindDefinition(formState.kind);
  const iconDefinition = getIconDefinition(formState.icon);
  const PreviewIcon = iconDefinition.icon;
  const title = formState.name.trim() || "Nueva categoria";
  // Divulgación progresiva: al crear, orden/estructura y disponibilidad arrancan
  // plegados; al editar se muestran todos para revisar de un vistazo.
  const [showAdvanced, setShowAdvanced] = useState(!isCreateMode);

  const availableParentOptions = useMemo(
    () => categories.filter((category) => category.id !== selectedCategoryId),
    [categories, selectedCategoryId],
  );
  const parentOptions = useMemo<PickerOption[]>(
    () => [
      {
        value: "",
        label: "Sin categoria padre",
        description: "Categoria principal sin dependencia.",
        leadingLabel: "SP",
        leadingColor: "#64748B",
        searchText: "sin categoria padre principal",
      },
      ...availableParentOptions.map((category) => {
        const categoryKind = getKindDefinition(category.kind);

        return {
          value: String(category.id),
          label: category.name,
          description: `${categoryKind.label} · ${category.parentName ? `Depende de ${category.parentName}` : "Categoria principal"}`,
          leadingLabel: buildCategoryMonogram(category.name),
          leadingColor: category.color ?? categoryKind.defaultColor,
          searchText: `${category.name} ${category.parentName ?? ""} ${category.kind}`,
        };
      }),
    ],
    [availableParentOptions],
  );

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
    <div
      className="fixed inset-0 z-[80] isolate overflow-y-auto bg-void/70 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(e) => {
        (e.currentTarget as HTMLDivElement).dataset.pressStart = String(Date.now());
      }}
      onMouseUp={(e) => {
        const t0 = Number((e.currentTarget as HTMLDivElement).dataset.pressStart || "0");
        delete (e.currentTarget as HTMLDivElement).dataset.pressStart;
        if (t0) closeEditor();
      }}
    >
      <div className="flex min-h-full items-center justify-center">
        <div
          className="animate-rise-in relative w-full max-w-[1120px] overflow-hidden rounded-[28px] border border-white/10 bg-shell/95 shadow-haze backdrop-blur-2xl [transform:translateZ(0)]"
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <form className="flex max-h-[calc(100dvh-1.5rem)] flex-col overflow-hidden" noValidate onSubmit={onSubmit}>
            <div className="overflow-y-auto px-4 pb-6 pt-5 sm:px-6 sm:pb-7 sm:pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="max-w-3xl">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-storm/90">
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
                    Dale una identidad visual clara y una estructura ordenada para que el resto de la app se
                    entienda mejor a simple vista.
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
                <FormFeedbackBanner className="mt-6" description={feedback.description} title={feedback.title} />
              ) : null}

              <div className="glass-panel-soft mt-7 rounded-[24px] p-5 sm:p-6">
                <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
                  <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-5">
                    <div className="flex items-start gap-4">
                      <div
                        className="flex h-16 w-16 items-center justify-center rounded-[24px] border border-white/10 text-white"
                        style={{ background: `linear-gradient(160deg, ${formState.color || kindDefinition.defaultColor}, rgba(8,13,20,0.72))` }}
                      >
                        <PreviewIcon className="h-7 w-7" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[0.68rem] uppercase tracking-[0.22em] text-storm/75">Vista previa</p>
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
                              status={availableParentOptions.find((category) => category.id === formState.parentId)?.name ?? "Con padre"}
                              tone="neutral"
                            />
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4">
                    <div className="rounded-[28px] border border-white/10 bg-black/15 p-5">
                      <p className="text-[0.68rem] uppercase tracking-[0.22em] text-storm/75">Icono</p>
                      <p className="mt-3 font-display text-2xl font-semibold text-ink">{iconDefinition.label}</p>
                    </div>
                    <div className="rounded-[28px] border border-white/10 bg-black/15 p-5">
                      <p className="text-[0.68rem] uppercase tracking-[0.22em] text-storm/75">Orden visual</p>
                      <p className="mt-3 font-display text-2xl font-semibold text-ink">{formState.sortOrder || "10"}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:mt-7 sm:gap-5 lg:grid-cols-2">
                <div className={panelClassName}>
                  <p className={labelClassName}>Identidad</p>
                  <h3 className="mt-1 font-display text-lg font-semibold text-ink sm:mt-2 sm:text-2xl">Base de la categoria</h3>
                  <div className="mt-3 space-y-5 sm:mt-6">
                    <label className="block">
                      <span className={labelClassName}>Nombre</span>
                      <div className={`mt-3${invalidFields.has("name") ? " field-error-ring" : ""}`} data-field="name">
                        <Input
                          maxLength={80}
                          onChange={(event) => {
                            clearFieldError("name");
                            updateFormState("name", event.target.value);
                          }}
                          placeholder="Ej. Alimentacion"
                          type="text"
                          value={formState.name}
                        />
                      </div>
                    </label>

                    <div>
                      <p className={labelClassName}>Tipo</p>
                      <div className="mt-3 grid gap-3">
                        {kindOptions.map((option) => (
                          <button
                            className={`rounded-[24px] border p-4 text-left transition duration-200 ${
                              formState.kind === option.value
                                ? "border-white/20 bg-white/[0.07] shadow-[0_0_0_3px_rgba(107,228,197,0.08)]"
                                : "border-white/8 bg-white/[0.03] hover:border-white/12"
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
                              {formState.kind === option.value ? <StatusBadge status="Activo" tone={option.tone} /> : null}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className={panelClassName}>
                  <p className={labelClassName}>Visual</p>
                  <h3 className="mt-1 font-display text-lg font-semibold text-ink sm:mt-2 sm:text-2xl">Color e icono</h3>
                  <div className="mt-3 space-y-5 sm:mt-6">
                    <div>
                      <p className={labelClassName}>Color principal</p>
                      <div className="mt-3 flex flex-wrap gap-3">
                        {colorOptions.map((color) => {
                          const isSelected = formState.color === color;

                          return (
                            <button
                              aria-label={`Color ${color}`}
                              className={`h-12 w-12 rounded-2xl border transition duration-200 ${
                                isSelected ? "scale-[1.03] border-white/30 shadow-[0_0_0_3px_rgba(107,228,197,0.08)]" : "border-white/10 hover:border-white/18"
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
                      <p className={labelClassName}>Icono</p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        {iconOptions.map((option) => {
                          const OptionIcon = option.icon;
                          const isSelected = formState.icon === option.value;

                          return (
                            <button
                              className={`rounded-[22px] border p-3 text-left transition duration-200 ${
                                isSelected ? "border-white/20 bg-white/[0.07]" : "border-white/8 bg-white/[0.03] hover:border-white/12"
                              }`}
                              key={option.value}
                              onClick={() => updateFormState("icon", option.value)}
                              type="button"
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className="flex h-10 w-10 items-center justify-center rounded-[16px] border border-white/10 text-white"
                                  style={{ background: `linear-gradient(160deg, ${formState.color || kindDefinition.defaultColor}, rgba(8,13,20,0.72))` }}
                                >
                                  <OptionIcon className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium text-ink">{option.label}</p>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {!showAdvanced ? (
                  <button
                    className="flex w-full items-center justify-center gap-2 rounded-[24px] border border-dashed border-white/15 bg-white/[0.02] px-4 py-3.5 text-sm font-medium text-storm transition hover:border-white/25 hover:text-ink lg:col-span-2"
                    onClick={() => setShowAdvanced(true)}
                    type="button"
                  >
                    Más opciones (orden, categoria padre, estado)
                  </button>
                ) : null}

                <div className={`${panelClassName} ${showAdvanced ? "" : "hidden"}`}>
                  <p className={labelClassName}>Organizacion</p>
                  <h3 className="mt-1 font-display text-lg font-semibold text-ink sm:mt-2 sm:text-2xl">Orden y estructura</h3>
                  <div className="mt-3 grid gap-5 sm:mt-6 lg:grid-cols-2">
                    <label className="block">
                      <span className={labelClassName}>Orden</span>
                      <div className={`mt-3${invalidFields.has("sortOrder") ? " field-error-ring" : ""}`} data-field="sortOrder">
                        <Input
                          min="0"
                          onChange={(event) => {
                            clearFieldError("sortOrder");
                            updateFormState("sortOrder", event.target.value);
                          }}
                          placeholder="10"
                          step="10"
                          type="number"
                          value={formState.sortOrder}
                        />
                      </div>
                    </label>

                    <label className="block">
                      <span className={labelClassName}>Categoria padre</span>
                      <div className="mt-3">
                        <SearchablePicker
                          emptyMessage="No encontramos una categoria padre con ese nombre."
                          onChange={(value) => updateFormState("parentId", value ? Number(value) : null)}
                          options={parentOptions}
                          placeholderDescription="Elige si esta categoria depende de otra."
                          placeholderLabel="Sin categoria padre"
                          queryPlaceholder="Buscar categoria padre..."
                          value={formState.parentId ? String(formState.parentId) : ""}
                        />
                      </div>
                    </label>
                  </div>
                </div>

                <div className={`${panelClassName} ${showAdvanced ? "" : "hidden"}`}>
                  <p className={labelClassName}>Estado</p>
                  <h3 className="mt-1 font-display text-lg font-semibold text-ink sm:mt-2 sm:text-2xl">Disponibilidad</h3>
                  <button
                    className={`mt-3 flex w-full items-center justify-between gap-4 rounded-[28px] border p-5 text-left transition duration-200 sm:mt-6 ${
                      formState.isActive ? "border-pine/25 bg-pine/10" : "border-white/10 bg-black/15"
                    }`}
                    onClick={() => updateFormState("isActive", !formState.isActive)}
                    type="button"
                  >
                    <div>
                      <p className="font-medium text-ink">{formState.isActive ? "Categoria activa" : "Categoria inactiva"}</p>
                      <p className="mt-2 text-sm leading-7 text-storm">
                        {formState.isActive
                          ? "Seguira apareciendo para nuevos movimientos, filtros y formularios."
                          : "Se conserva en el historial, pero deja de aparecer como sugerencia activa."}
                      </p>
                    </div>
                    <StatusBadge status={formState.isActive ? "Activa" : "Inactiva"} tone={formState.isActive ? "success" : "neutral"} />
                  </button>
                </div>
              </div>
            </div>

            <div className="relative z-[60] border-t border-white/10 bg-shell/95 px-4 py-4 backdrop-blur-md sm:px-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm leading-7 text-storm">
                  {isCreateMode
                    ? "Esta categoria quedara disponible de inmediato en movimientos, suscripciones y filtros del workspace."
                    : "Los cambios se reflejaran al instante en todo el sistema donde ya se use esta categoria."}
                </p>
                <div className="flex flex-col-reverse gap-3 sm:flex-row">
                  <Button disabled={isSaving} onClick={closeEditor} type="button" variant="ghost">
                    Cancelar
                  </Button>
                  <Button disabled={isSaving} type="submit">
                    {isSaving ? (
                      <>
                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                        Guardando...
                      </>
                    ) : isCreateMode ? (
                      <>
                        <Plus className="mr-2 h-4 w-4" />
                        Crear categoria
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="mr-2 h-4 w-4" />
                        Guardar cambios
                      </>
                    )}
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
  value: string;
}) {
  const valueTone = {
    neutral: "text-ink",
    info: "text-ember",
    warning: "text-gold",
  } as const;

  return (
    <article className="glass-panel-soft min-w-0 rounded-[24px] p-4 transition duration-300 hover:border-white/15">
      <p className="truncate text-xs font-semibold uppercase tracking-[0.22em] text-storm/80">{label}</p>
      <p className={`mt-2 truncate font-display text-2xl font-semibold leading-tight ${valueTone[tone]}`}>{value}</p>
    </article>
  );
}

function CategoriesLoadingSkeleton() {
  return (
    <>
      <div className="shimmer-surface h-[180px] rounded-[32px]" />
      <div className="shimmer-surface h-[520px] rounded-[32px]" />
    </>
  );
}

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
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
  return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
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
  const { activeWorkspace, error: workspaceError, isLoading: isWorkspacesLoading } = useActiveWorkspace();
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
  const {
    filters: categoryFilters,
    currentPage,
    setCurrentPage,
    openTableFilter,
    updateFilter: updateCategoryFilter,
    clearFilters: clearCategoryFilters,
    toggleTableFilterMenu,
    closeTableFilterMenu,
    clearSingleTableFilter,
    applyFilterAndClose: applyCategoryFilterAndClose,
  } = useCategoriesFilters(viewMode);
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

      if (normalizedParent && !(category.parentName ?? "").toLowerCase().includes(normalizedParent)) {
        return false;
      }

      if (normalizedMovements && !String(category.movementCount).includes(normalizedMovements)) {
        return false;
      }

      if (normalizedSubscriptions && !String(category.subscriptionCount).includes(normalizedSubscriptions)) {
        return false;
      }

      return true;
    });
  }, [categories, categoryFilters, hiddenIds]);

  const totalPages = Math.max(1, Math.ceil(filteredCategories.length / CATEGORIES_PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedCategories = useMemo(
    () => filteredCategories.slice((safePage - 1) * CATEGORIES_PAGE_SIZE, safePage * CATEGORIES_PAGE_SIZE),
    [filteredCategories, safePage],
  );

  const {
    selectedIds,
    toggle: toggleSelect,
    selectAll,
    clearAll,
    selectedCount,
    allSelected,
    someSelected,
    selectedItems,
  } = useSelection(filteredCategories);

  const totalActive = categories.filter((category) => category.isActive).length;
  const totalInactive = categories.length - totalActive;
  const totalLinkedToMovements = categories.filter((category) => category.movementCount > 0).length;
  const totalLinkedToSubscriptions = categories.filter((category) => category.subscriptionCount > 0).length;

  const hasActiveCategoryFilters =
    categoryFilters.name.trim() !== "" ||
    categoryFilters.parent.trim() !== "" ||
    categoryFilters.movements.trim() !== "" ||
    categoryFilters.subscriptions.trim() !== "" ||
    categoryFilters.kind !== "all" ||
    categoryFilters.status !== "active";

  function updateFormState<Field extends keyof CategoryFormState>(field: Field, value: CategoryFormState[Field]) {
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
        await createMutation.mutateAsync({ workspaceId: activeWorkspace.id, userId: user.id, ...payload });
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
      onCommit: () => deleteMutation.mutateAsync({ categoryId: targetId, workspaceId: activeWorkspace.id }),
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
        <PageHeader description="Estamos preparando las categorias del workspace activo." eyebrow="categorias" title="Cargando categorias" />
        <CategoriesLoadingSkeleton />
      </div>
    );
  }

  if (workspaceError) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader description="Necesitamos acceder correctamente al workspace activo." eyebrow="categorias" title="Categorias no disponibles" />
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
        <DataState description="Activa o crea un workspace para comenzar a estructurar tus categorias." title="Sin categorias para mostrar" />
      </div>
    );
  }

  if (categoriesQuery.isLoading) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader description="Estamos cargando la estructura visual y funcional de tus categorias." eyebrow="categorias" title="Cargando categorias" />
        <CategoriesLoadingSkeleton />
      </div>
    );
  }

  if (categoriesQuery.error) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader description="Intentamos abrir el mantenedor y resumen de categorias del workspace." eyebrow="categorias" title="No fue posible cargar las categorias" />
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
      {/* Header compacto (estándar) */}
      <section className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine/80">Categorias</p>
        <div className="mt-1 flex items-center gap-2.5">
          <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] text-ink">Categorias del workspace</h2>
          <InfoTip ariaLabel="Sobre las categorias">
            Estructura movimientos, suscripciones y filtros con tus propias categorias. Los filtros de la barra
            superior aplican a todas las vistas.
          </InfoTip>
        </div>
        <p className="mt-1 text-xs text-storm">Categorias del workspace para ordenar todo el sistema.</p>
      </section>

      {/* Métricas compactas */}
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,11rem),1fr))]">
        <CategoriesSummaryChip label="categorias" value={String(categories.length)} />
        <CategoriesSummaryChip label="activas" tone="info" value={String(totalActive)} />
        <CategoriesSummaryChip label="inactivas" tone="warning" value={String(totalInactive)} />
        <CategoriesSummaryChip label="con movimientos" tone="info" value={String(totalLinkedToMovements)} />
        <CategoriesSummaryChip label="con suscripciones" tone="info" value={String(totalLinkedToSubscriptions)} />
      </div>

      {/* Toolbar sticky (estándar) */}
      <section className="sticky top-3 z-30 rounded-[24px] border border-white/10 bg-canvas/85 p-4 backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-2">
          <ViewSelector available={["grid", "list", "table"]} onChange={setViewMode} value={viewMode} />
          {viewMode === "table" ? <ColumnPicker columns={categoryColumns} visible={colVis} onToggle={toggleCol} /> : null}
          <StatusBadge status={`${filteredCategories.length} visibles`} tone="neutral" />
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-storm transition hover:border-white/16 hover:text-ink disabled:opacity-50"
              disabled={snapshotQuery.isFetching}
              onClick={() => snapshotQuery.refetch()}
              title="Actualizar"
              type="button"
            >
              <RefreshCw className={`h-4 w-4${snapshotQuery.isFetching ? " animate-spin" : ""}`} />
            </button>
            {hasActiveCategoryFilters ? (
              <Button onClick={clearCategoryFilters} variant="ghost">
                <X className="mr-2 h-4 w-4" />
                Limpiar
              </Button>
            ) : null}
            <Button
              disabled={!filteredCategories.length}
              onClick={() => downloadCategoriesCSV(filteredCategories, `categorias-${new Date().toISOString().slice(0, 10)}.csv`)}
              variant="ghost"
            >
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
            <Button data-tour="create-category" onClick={openCreateEditor}>
              <Plus className="mr-2 h-4 w-4" />
              Nueva categoria
            </Button>
          </div>
        </div>

        {/* Filtros principales: siempre visibles (aplican a todas las vistas) */}
        <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <input
            className="field-dark"
            onChange={(event) => updateCategoryFilter("name", event.target.value)}
            placeholder="Buscar por nombre, tipo o categoria padre..."
            type="text"
            value={categoryFilters.name}
          />
          <SearchablePicker
            emptyMessage="No hay tipos para mostrar."
            onChange={(value) => updateCategoryFilter("kind", value as KindFilter)}
            options={kindFilterPickerOptions}
            placeholderDescription="Filtra por tipo."
            placeholderLabel="Tipo"
            queryPlaceholder="Buscar tipo..."
            value={categoryFilters.kind}
          />
          <SearchablePicker
            emptyMessage="No hay estados para mostrar."
            onChange={(value) => updateCategoryFilter("status", value as CategoryStatusFilter)}
            options={statusFilterPickerOptions}
            placeholderDescription="Filtra por estado."
            placeholderLabel="Estado"
            queryPlaceholder="Buscar estado..."
            value={categoryFilters.status}
          />
        </div>
      </section>

      {feedback && feedback.tone !== "error" && !isEditorOpen ? (
        <DataState description={feedback.description} title={feedback.title} tone={feedback.tone} />
      ) : null}

      {categories.length === 0 ? (
        <DataState
          action={
            <Button onClick={openCreateEditor}>
              <Plus className="mr-2 h-4 w-4" />
              Crear primera categoria
            </Button>
          }
          description="Todavia no hay categorias registradas en este workspace."
          title="Sin categorias todavia"
        />
      ) : filteredCategories.length === 0 ? (
        <DataState
          action={
            hasActiveCategoryFilters ? (
              <Button onClick={clearCategoryFilters} variant="secondary">
                Quitar filtros
              </Button>
            ) : undefined
          }
          description="Prueba cambiando los filtros activos o vuelve a la vista tabla para revisar cada columna."
          title="Sin resultados"
        />
      ) : viewMode === "list" ? (
        <CategoryList
          categories={paginatedCategories}
          onAnalytics={setAnalyticsCategoryId}
          onEdit={openEditEditor}
          onToggleSelect={toggleSelect}
          selectedIds={selectedIds}
        />
      ) : viewMode === "table" ? (
        <CategoryTable
          allSelected={allSelected}
          categories={paginatedCategories}
          cv={cv}
          filters={categoryFilters}
          isToggling={isToggling}
          onAnalytics={setAnalyticsCategoryId}
          onApplyFilterAndClose={applyCategoryFilterAndClose}
          onClearAll={clearAll}
          onClearSingleFilter={clearSingleTableFilter}
          onCloseFilterMenu={closeTableFilterMenu}
          onEdit={openEditEditor}
          onSelectAll={selectAll}
          onToggleCategory={(category) => void handleToggleCategory(category)}
          onToggleFilterMenu={toggleTableFilterMenu}
          onToggleSelect={toggleSelect}
          onUpdateFilter={updateCategoryFilter}
          openFilter={openTableFilter}
          selectedIds={selectedIds}
          someSelected={someSelected}
        />
      ) : (
        <CategoryGrid
          categories={paginatedCategories}
          isToggling={isToggling}
          onAnalytics={setAnalyticsCategoryId}
          onDelete={setDeleteTargetId}
          onEdit={openEditEditor}
          onToggleCategory={(category) => void handleToggleCategory(category)}
          onToggleSelect={toggleSelect}
          selectedCount={selectedCount}
          selectedIds={selectedIds}
        />
      )}

      {filteredCategories.length > 0 ? (
        <Pagination onPageChange={setCurrentPage} page={safePage} pageSize={CATEGORIES_PAGE_SIZE} totalItems={filteredCategories.length} />
      ) : null}

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
          onDiscard={() => {
            setShowUnsavedDialog(false);
            closeEditor();
          }}
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
                    <StatusBadge status={deleteTarget.isActive ? "Activa" : "Inactiva"} tone={deleteTarget.isActive ? "success" : "neutral"} />
                    {deleteTarget.isSystem ? <StatusBadge status="Base" tone="warning" /> : null}
                  </div>
                </div>
              </div>
            );
          })()}
        </DeleteConfirmDialog>
      ) : null}

      {analyticsCategoryId !== null && snapshotQuery.data
        ? (() => {
            const cat = categories.find((c) => c.id === analyticsCategoryId);
            return cat ? (
              <CategoryAnalyticsModal
                baseCurrencyCode={snapshotQuery.data.workspace.baseCurrencyCode}
                category={cat}
                movements={snapshotQuery.data.movements}
                onClose={() => setAnalyticsCategoryId(null)}
              />
            ) : null;
          })()
        : null}

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
        <div
          className="fixed inset-0 z-[310] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cat-bulk-confirm-title"
        >
          <div className="glass-panel-strong w-full max-w-md rounded-[28px] p-6">
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
