import { Archive, Check, Save, Trash2 } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "../../../components/ui/button";
import { FormFeedbackBanner } from "../../../components/ui/form-feedback-banner";
import { FormField } from "../../../components/ui/form-field";
import { Input, Textarea } from "../../../components/ui/fields";
import { Modal, ModalFooter } from "../../../components/ui/modal";
import { ModalBody } from "../../../components/ui/modal-body";
import { ResourceEditorDestination, ResourceEditorHeader, resourceEditorSurfaceClassName } from "../../../components/ui/resource-editor";
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
  getIconOption,
  getTypePreset,
} from "../lib/account-options";
import type { AccountFormErrors, AccountFormField, AccountFormState } from "../lib/account-validation";
import { buildAccountInstitutionPickerOptions } from "../lib/account-institutions";

type AccountEditorDialogProps = {
  baseCurrencyCode: string;
  errorMessage: string;
  formErrors: AccountFormErrors;
  formState: AccountFormState;
  isCreateMode: boolean;
  isSaving: boolean;
  saveBlocked?: boolean;
  onArchiveToggle: (account: AccountSummary) => void;
  onClose: () => void;
  onDelete: () => void;
  onFieldChange: <Field extends AccountFormField>(field: Field, value: AccountFormState[Field]) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onTypeChange: (type: string) => void;
  selectedAccount: AccountSummary | null;
};

const neutralFieldClassName = "account-editor-field";
const neutralRequiredClassName = "account-editor-required";

function ensureCurrencyOption(options: PickerOption[], currencyCode: string): PickerOption[] {
  if (!currencyCode || options.some((option) => option.value === currencyCode)) return options;
  const currency = buildCurrencyLabel(currencyCode);
  if (!currency) return options;
  return [...options, {
    value: currency.code,
    label: currency.code,
    description: `${currency.label} - ${currency.region}`,
    leadingLabel: currency.symbol,
    searchText: `${currency.code} ${currency.label} ${currency.region} ${currency.symbol}`,
  }];
}

export function AccountEditorDialog({
  baseCurrencyCode,
  errorMessage,
  formErrors,
  formState,
  isCreateMode,
  isSaving,
  saveBlocked = false,
  onArchiveToggle,
  onClose,
  onDelete,
  onFieldChange,
  onSubmit,
  onTypeChange,
  selectedAccount,
}: AccountEditorDialogProps) {
  const [activePanel, setActivePanel] = useState<"main" | "details">("main");
  const typeOptions = useMemo(() => buildAccountTypePickerOptions(), []);
  const currencyOptions = useMemo(
    () => ensureCurrencyOption(buildCurrencyPickerOptions(), formState.currencyCode),
    [formState.currencyCode],
  );
  const iconOptions = useMemo(() => buildIconPickerOptions(formState.color), [formState.color]);
  const institutionOptions = useMemo(() => buildAccountInstitutionPickerOptions(), []);
  const typePreset = getTypePreset(formState.type);
  const iconOption = getIconOption(formState.icon || typePreset.icon);
  const parsedOpeningBalance = Number(formState.openingBalance);
  const openingBalance = Number.isFinite(parsedOpeningBalance) ? parsedOpeningBalance : 0;
  const projectedBalance = selectedAccount
    ? selectedAccount.currentBalance - selectedAccount.openingBalance + openingBalance
    : openingBalance;

  useEffect(() => setActivePanel("main"), [isCreateMode, selectedAccount?.id]);

  return (
    <Modal
      className={resourceEditorSurfaceClassName}
      disableOutsideClose={isSaving}
      labelledBy="account-editor-title"
      onClose={onClose}
      size="md"
    >
      <form className="flex min-h-0 flex-1 flex-col" noValidate onSubmit={onSubmit}>
        <ResourceEditorHeader accessory={activePanel === "main" && selectedAccount?.isArchived ? <StatusBadge status="Archivada" tone="neutral" /> : null} disabled={isSaving} onBack={activePanel === "details" ? () => setActivePanel("main") : undefined} onClose={onClose} title={activePanel === "main" ? (isCreateMode ? "Nueva cuenta" : "Editar cuenta") : "Detalles"} titleId="account-editor-title" />

        <ModalBody className="!px-5 !py-5 sm:!px-6">
          {errorMessage ? (
            <FormFeedbackBanner className="mb-5" description={errorMessage} title="Revisa la cuenta antes de guardarla" tone="error" />
          ) : null}

          <fieldset className="min-w-0 border-0 p-0" disabled={isSaving || saveBlocked}>

          {activePanel === "main" ? (
            <div className="space-y-5">
              <FormField className={neutralRequiredClassName} error={formErrors.openingBalance} errorKey="openingBalance" label="Saldo inicial" required>
                <Input autoFocus className={`h-16 font-display text-[2rem] font-semibold ${neutralFieldClassName}`} data-modal-initial-focus inputMode="decimal" onChange={(event) => onFieldChange("openingBalance", event.target.value)} placeholder="0.00" type="number" value={formState.openingBalance} />
              </FormField>

              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[#141311] px-4 py-3 text-sm">
                <span className="text-storm">Saldo después</span>
                <span className="font-semibold text-ink">{formatCurrency(projectedBalance, formState.currencyCode || baseCurrencyCode)}</span>
              </div>

              <FormField className={neutralRequiredClassName} error={formErrors.name} errorKey="name" label="Nombre" required>
                <Input className={neutralFieldClassName} onChange={(event) => onFieldChange("name", event.target.value)} placeholder="Ej. Cuenta Principal" value={formState.name} />
              </FormField>

              <FormField className={neutralRequiredClassName} error={formErrors.type} errorKey="type" label="Tipo" required>
                <SearchablePicker appearance="compact" emptyMessage="No hay tipos disponibles." onChange={onTypeChange} options={typeOptions} placeholderDescription="Selecciona un tipo." placeholderLabel="Tipo de cuenta" queryPlaceholder="Buscar tipo..." value={formState.type} />
              </FormField>

              <ResourceEditorDestination onClick={() => setActivePanel("details")} summary={`${formState.currencyCode} · ${iconOption.label}`} />

              <p className="text-xs leading-5 text-storm/70">
                Con el saldo, el nombre y el tipo ya puedes guardar. La moneda usa {baseCurrencyCode} por defecto.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <FormField label="Institución">
                <SearchablePicker
                  appearance="compact"
                  emptyMessage="No hay instituciones disponibles."
                  onChange={(value) => onFieldChange("institutionCode", value === "none" ? "" : value)}
                  options={institutionOptions}
                  placeholderDescription="Banco, billetera o plataforma."
                  placeholderLabel="Sin institución"
                  queryPlaceholder="Buscar institución..."
                  value={formState.institutionCode || "none"}
                />
              </FormField>

              {formState.type === "credit_card" ? <section aria-label="Ciclo de la tarjeta" className="space-y-4 border-y border-white/10 py-4">
                <h3 className="text-sm font-semibold text-ink">Ciclo de la tarjeta</h3>
                <div className="grid grid-cols-2 gap-3">
                  {(["statementDay", "paymentDay"] as const).map((field) => <FormField error={formErrors[field]} errorKey={field} key={field} label={field === "statementDay" ? "Día de corte" : "Día de pago"}>
                    <SearchablePicker appearance="compact" emptyMessage="No hay días disponibles." onChange={(value) => onFieldChange(field, value === "none" ? "" : value)} options={[{ value: "none", label: "Sin definir", description: "", leadingLabel: "" }, ...Array.from({ length: 31 }, (_, index) => ({ value: String(index + 1), label: String(index + 1), description: "", leadingLabel: "" }))]} placeholderDescription="Día del mes" placeholderLabel="Sin definir" queryPlaceholder="Buscar día…" value={formState[field] || "none"} />
                  </FormField>)}
                </div>
                <FormField error={formErrors.creditLimit} errorKey="creditLimit" label={`Límite de crédito · ${formState.currencyCode}`}>
                  <Input className={neutralFieldClassName} inputMode="decimal" min="0.01" onChange={(event) => onFieldChange("creditLimit", event.target.value)} placeholder="Sin definir" step="0.01" type="number" value={formState.creditLimit} />
                </FormField>
                <p className="text-xs leading-5 text-storm">Opcional. Usa los días y el límite indicados por tu banco.</p>
              </section> : null}

              <FormField className={neutralRequiredClassName} error={formErrors.currencyCode} errorKey="currencyCode" label="Moneda" required>
                <SearchablePicker appearance="compact" emptyMessage="No hay monedas disponibles." onChange={(value) => onFieldChange("currencyCode", value)} options={currencyOptions} placeholderDescription="Selecciona una moneda." placeholderLabel="Moneda" queryPlaceholder="Buscar moneda..." value={formState.currencyCode} />
              </FormField>

              <FormField className={neutralRequiredClassName} error={formErrors.icon} errorKey="icon" label="Ícono" required>
                <SearchablePicker appearance="compact" emptyMessage="No hay íconos disponibles." onChange={(value) => onFieldChange("icon", value)} options={iconOptions} placeholderDescription="Selecciona un ícono." placeholderLabel="Ícono" queryPlaceholder="Buscar ícono..." value={formState.icon} />
              </FormField>

              <FormField className={neutralRequiredClassName} error={formErrors.color} errorKey="color" label="Color" required>
                <div className="grid grid-cols-6 gap-2 sm:grid-cols-12">
                  {editorColorSwatches.map((swatch) => {
                    const isSelected = swatch.toLowerCase() === formState.color.toLowerCase();
                    return (
                      <button aria-label={`Usar color ${swatch}`} aria-pressed={isSelected} className={`h-9 rounded-[9px] border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${isSelected ? "border-ink ring-1 ring-ink/25" : "border-white/10 hover:border-white/30"}`} key={swatch} onClick={() => onFieldChange("color", swatch)} style={{ backgroundColor: swatch }} type="button" />
                    );
                  })}
                </div>
              </FormField>

              <label className="flex min-h-[54px] cursor-pointer items-center justify-between border-y border-white/10 py-3">
                <span>
                  <span className="block text-sm font-semibold text-ink">Incluir en patrimonio</span>
                  <span className="mt-0.5 block text-xs text-storm">Suma este saldo al patrimonio del espacio.</span>
                </span>
                <span className="relative inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center">
                  <input checked={formState.includeInNetWorth} className="peer sr-only" onChange={(event) => onFieldChange("includeInNetWorth", event.target.checked)} type="checkbox" />
                  <span className="flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border border-white/20 text-transparent transition peer-checked:border-ink peer-checked:bg-ink peer-checked:text-void peer-focus-visible:ring-2 peer-focus-visible:ring-ink/25">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                </span>
              </label>

              <FormField error={formErrors.notes} errorKey="notes" label="Notas">
                <Textarea className={`min-h-[96px] ${neutralFieldClassName}`} onChange={(event) => onFieldChange("notes", event.target.value)} placeholder="Uso de la cuenta o recordatorios internos." value={formState.notes} />
              </FormField>

              <p className="text-xs leading-5 text-storm/70">
                Cambiar el saldo inicial ajusta el punto de partida; los movimientos registrados se conservan.
              </p>

              {!isCreateMode && selectedAccount ? (
                <div className="flex items-center gap-5 border-t border-white/10 pt-4 text-sm">
                  <button className="inline-flex items-center gap-2 text-storm transition hover:text-ink" disabled={isSaving} onClick={() => onArchiveToggle(selectedAccount)} type="button">
                    <Archive className="h-4 w-4" />{selectedAccount.isArchived ? "Reactivar" : "Archivar"}
                  </button>
                  {selectedAccount.isArchived ? (
                    <button className="inline-flex items-center gap-2 text-storm transition hover:text-rosewood" disabled={isSaving} onClick={onDelete} type="button">
                      <Trash2 className="h-4 w-4" />Eliminar permanentemente
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
          </fieldset>
        </ModalBody>

        <ModalFooter>
          <Button className="w-full" disabled={isSaving || saveBlocked} type="submit">
            <Save className="h-4 w-4" />
            {isSaving ? "Guardando..." : saveBlocked ? "Comprueba el resultado" : isCreateMode ? "Crear cuenta" : "Guardar cambios"}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
