import { Archive, Save, Trash2, WalletCards } from "lucide-react";
import type { FormEvent } from "react";
import { useMemo } from "react";

import { Button } from "../../../components/ui/button";
import { FormFeedbackBanner } from "../../../components/ui/form-feedback-banner";
import { FormField } from "../../../components/ui/form-field";
import { Input, Textarea } from "../../../components/ui/fields";
import { Modal, ModalFooter, ModalHeader } from "../../../components/ui/modal";
import { ModalBody } from "../../../components/ui/modal-body";
import { SearchablePicker, type PickerOption } from "../../../components/ui/searchable-picker";
import { StatusBadge } from "../../../components/ui/status-badge";
import { formatCurrency } from "../../../lib/formatting/money";
import type { AccountSummary } from "../../../types/domain";
import {
  buildAccountTypePickerOptions,
  buildCurrencyLabel,
  buildCurrencyPickerOptions,
  buildIconPickerOptions,
  editorColorSwatches,
  getAccountIcon,
  getIconOption,
  getTypePreset,
} from "../lib/account-options";
import type {
  AccountFormErrors,
  AccountFormField,
  AccountFormState,
} from "../lib/account-validation";

type AccountEditorDialogProps = {
  baseCurrencyCode: string;
  errorMessage: string;
  formErrors: AccountFormErrors;
  formState: AccountFormState;
  isCreateMode: boolean;
  isSaving: boolean;
  onArchiveToggle: (account: AccountSummary) => void;
  onClose: () => void;
  onDelete: () => void;
  onFieldChange: <Field extends AccountFormField>(
    field: Field,
    value: AccountFormState[Field],
  ) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onTypeChange: (type: string) => void;
  selectedAccount: AccountSummary | null;
};

function ensureCurrencyOption(options: PickerOption[], currencyCode: string): PickerOption[] {
  if (!currencyCode || options.some((option) => option.value === currencyCode)) {
    return options;
  }

  const currency = buildCurrencyLabel(currencyCode);

  if (!currency) {
    return options;
  }

  return [
    ...options,
    {
      value: currency.code,
      label: currency.code,
      description: `${currency.label} - ${currency.region}`,
      leadingLabel: currency.symbol,
      searchText: `${currency.code} ${currency.label} ${currency.region} ${currency.symbol}`,
    },
  ];
}

export function AccountEditorDialog({
  baseCurrencyCode,
  errorMessage,
  formErrors,
  formState,
  isCreateMode,
  isSaving,
  onArchiveToggle,
  onClose,
  onDelete,
  onFieldChange,
  onSubmit,
  onTypeChange,
  selectedAccount,
}: AccountEditorDialogProps) {
  const typeOptions = useMemo(() => buildAccountTypePickerOptions(), []);
  const currencyOptions = useMemo(
    () => ensureCurrencyOption(buildCurrencyPickerOptions(), formState.currencyCode),
    [formState.currencyCode],
  );
  const iconOptions = useMemo(
    () => buildIconPickerOptions(formState.color),
    [formState.color],
  );
  const typePreset = getTypePreset(formState.type);
  const iconOption = getIconOption(formState.icon || typePreset.icon);
  const PreviewIcon = getAccountIcon(iconOption.value, formState.type);
  const parsedOpeningBalance = Number(formState.openingBalance);
  const previewOpeningBalance = Number.isFinite(parsedOpeningBalance) ? parsedOpeningBalance : 0;
  const previewName = formState.name.trim() || "Cuenta sin nombre";

  return (
    <Modal
      disableOutsideClose={isSaving}
      labelledBy="account-editor-title"
      onClose={onClose}
      size="xl"
    >
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={onSubmit}>
        <ModalHeader
          accessory={
            selectedAccount?.isArchived ? <StatusBadge status="Archivada" tone="neutral" /> : null
          }
          description={
            isCreateMode
              ? "Registra una cuenta real para movimientos, presupuesto y patrimonio."
              : "Actualiza identidad, moneda, saldo inicial e impacto patrimonial."
          }
          onClose={isSaving ? undefined : onClose}
          title={isCreateMode ? "Nueva cuenta" : "Editar cuenta"}
          titleId="account-editor-title"
        />

        <ModalBody className="space-y-5">
          {errorMessage ? (
            <FormFeedbackBanner
              description={errorMessage}
              title="No pudimos guardar la cuenta"
              tone="error"
            />
          ) : null}

          <section className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  className="sm:col-span-2"
                  error={formErrors.name}
                  errorKey="name"
                  label="Nombre"
                  required
                >
                  <Input
                    autoFocus
                    onChange={(event) => onFieldChange("name", event.target.value)}
                    placeholder="Ej. Cuenta Principal"
                    value={formState.name}
                  />
                </FormField>

                <FormField
                  error={formErrors.type}
                  errorKey="type"
                  hint="Define como se agrupa y reconoce esta cuenta."
                  label="Tipo"
                  required
                >
                  <SearchablePicker
                    emptyMessage="No hay tipos disponibles."
                    onChange={onTypeChange}
                    options={typeOptions}
                    placeholderDescription="Selecciona un tipo."
                    placeholderLabel="Tipo de cuenta"
                    queryPlaceholder="Buscar tipo..."
                    value={formState.type}
                  />
                </FormField>

                <FormField
                  error={formErrors.currencyCode}
                  errorKey="currencyCode"
                  hint={`Moneda base del workspace: ${baseCurrencyCode}.`}
                  label="Moneda"
                  required
                >
                  <SearchablePicker
                    emptyMessage="No hay monedas disponibles."
                    onChange={(value) => onFieldChange("currencyCode", value)}
                    options={currencyOptions}
                    placeholderDescription="Selecciona una moneda."
                    placeholderLabel="Moneda"
                    queryPlaceholder="Buscar moneda..."
                    value={formState.currencyCode}
                  />
                </FormField>

                <FormField
                  error={formErrors.openingBalance}
                  errorKey="openingBalance"
                  hint="Saldo con el que empieza el historial de esta cuenta."
                  label="Saldo inicial"
                  required
                >
                  <Input
                    inputMode="decimal"
                    onChange={(event) => onFieldChange("openingBalance", event.target.value)}
                    placeholder="0.00"
                    type="number"
                    value={formState.openingBalance}
                  />
                </FormField>

                <FormField
                  error={formErrors.icon}
                  errorKey="icon"
                  hint="Icono visible en listados, cards y selectores."
                  label="Icono"
                  required
                >
                  <SearchablePicker
                    emptyMessage="No hay iconos disponibles."
                    onChange={(value) => onFieldChange("icon", value)}
                    options={iconOptions}
                    placeholderDescription="Selecciona un icono."
                    placeholderLabel="Icono"
                    queryPlaceholder="Buscar icono..."
                    value={formState.icon}
                  />
                </FormField>
              </div>

              <FormField
                error={formErrors.color}
                errorKey="color"
                hint="Usa colores con significado estable para reconocer la cuenta rapido."
                label="Color"
                required
              >
                <div className="grid grid-cols-6 gap-2 sm:grid-cols-12">
                  {editorColorSwatches.map((swatch) => {
                    const isSelected = swatch.toLowerCase() === formState.color.toLowerCase();

                    return (
                      <button
                        aria-label={`Usar color ${swatch}`}
                        aria-pressed={isSelected}
                        className={`h-11 rounded-2xl border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pine ${
                          isSelected
                            ? "border-white/70 ring-2 ring-pine/30"
                            : "border-white/10 hover:border-white/30"
                        }`}
                        key={swatch}
                        onClick={() => onFieldChange("color", swatch)}
                        style={{ backgroundColor: swatch }}
                        type="button"
                      />
                    );
                  })}
                </div>
              </FormField>

              <label className="flex min-h-14 items-start gap-3 rounded-[22px] border border-white/10 bg-[#0d1420]/95 p-4">
                <input
                  checked={formState.includeInNetWorth}
                  className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded accent-pine"
                  onChange={(event) => onFieldChange("includeInNetWorth", event.target.checked)}
                  type="checkbox"
                />
                <span>
                  <span className="block text-sm font-semibold text-ink">
                    Incluir en patrimonio
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-storm">
                    Si esta activo, el saldo suma al resumen patrimonial del workspace.
                  </span>
                </span>
              </label>

              <details className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                <summary className="cursor-pointer text-sm font-semibold text-ink">
                  Opciones avanzadas
                </summary>
                <div className="mt-4 space-y-4">
                  <FormField
                    error={formErrors.notes}
                    errorKey="notes"
                    hint="Notas internas visibles solo dentro del workspace."
                    label="Notas"
                  >
                    <Textarea
                      onChange={(event) => onFieldChange("notes", event.target.value)}
                      placeholder="Ej. Cuenta para pagos recurrentes o fondo de emergencia."
                      value={formState.notes}
                    />
                  </FormField>
                  <div className="rounded-[20px] border border-white/10 bg-[#0b111b]/90 p-4">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm">
                      Impacto
                    </p>
                    <p className="mt-2 text-sm leading-6 text-storm">
                      Cambiar el saldo inicial ajusta el punto de partida del historial. Los movimientos
                      registrados siguen calculando el saldo actual desde ese inicio.
                    </p>
                  </div>
                </div>
              </details>
            </div>

            <aside className="space-y-4">
              <div className="rounded-[28px] border border-white/10 bg-[#0b111b]/96 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] border border-white/10 text-white"
                    style={{ backgroundColor: formState.color }}
                  >
                    <PreviewIcon className="h-6 w-6" />
                  </div>
                  <StatusBadge
                    status={formState.includeInNetWorth ? "Patrimonio" : "Fuera"}
                    tone={formState.includeInNetWorth ? "success" : "warning"}
                  />
                </div>
                <p className="mt-5 break-words font-display text-3xl font-semibold leading-tight text-ink">
                  {previewName}
                </p>
                <p className="mt-2 text-sm text-storm">
                  {typePreset.label} - {formState.currencyCode || baseCurrencyCode}
                </p>
                <div className="mt-5 rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-[0.65rem] uppercase tracking-[0.18em] text-storm">
                    Saldo inicial
                  </p>
                  <p className="mt-2 break-words font-display text-3xl font-semibold leading-tight text-ink">
                    {formatCurrency(previewOpeningBalance, formState.currencyCode || baseCurrencyCode)}
                  </p>
                </div>
              </div>

              {!isCreateMode && selectedAccount ? (
                <div className="rounded-[28px] border border-rosewood/18 bg-rosewood/8 p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-rosewood/20 bg-rosewood/12 text-rosewood">
                      <WalletCards className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-ink">Zona sensible</p>
                      <p className="mt-1 text-sm leading-6 text-storm">
                        Archivar es reversible. Eliminar intenta borrar la cuenta de forma permanente.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      disabled={isSaving}
                      onClick={() => onArchiveToggle(selectedAccount)}
                      variant="ghost"
                    >
                      <Archive className="h-4 w-4" />
                      {selectedAccount.isArchived ? "Reactivar" : "Archivar"}
                    </Button>
                    <Button disabled={isSaving} onClick={onDelete} variant="ghost">
                      <Trash2 className="h-4 w-4" />
                      Eliminar
                    </Button>
                  </div>
                </div>
              ) : null}
            </aside>
          </section>
        </ModalBody>

        <ModalFooter>
          <Button disabled={isSaving} onClick={onClose} variant="ghost">
            Cancelar
          </Button>
          <Button disabled={isSaving} type="submit">
            <Save className="h-4 w-4" />
            {isSaving ? "Guardando..." : isCreateMode ? "Crear cuenta" : "Guardar cambios"}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
