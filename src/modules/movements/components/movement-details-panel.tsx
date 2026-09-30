import { AlertTriangle, Check, ChevronRight, Gauge, Repeat2, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

import { PendingAttachmentControl } from "../../attachments/components/compact-attachment-field";
import { DatePickerField } from "../../../components/ui/date-picker-field";

type MovementDetailsPanelProps = {
  categoryLabel?: string;
  counterpartyLabel?: string;
  description: string;
  destinationAmount?: string;
  destinationCurrencyCode?: string;
  helperText: string;
  navigationRows?: ReactNode;
  invalidFields: Set<string>;
  isTransfer: boolean;
  onDescriptionChange: (value: string) => void;
  onDestinationAmountChange?: (value: string) => void;
  onOccurredAtChange: (value: string) => void;
  onOpenCategory?: () => void;
  onOpenCounterparty?: () => void;
  onOpenType?: () => void;
  occurredAt: string;
  receiptRows: ReactNode;
  suggestionRows?: ReactNode;
  showDestinationAmount?: boolean;
  typeLabel?: string;
};

type MovementDetailOption = {
  label: string;
  value: string;
};

type MovementDetailOptionsPanelProps = {
  actionLabel?: string;
  onAction?: () => void;
  onChange: (value: string) => void;
  options: MovementDetailOption[];
  value: string;
};

export function MovementDetailsReceiptRow({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[54px] items-center justify-between gap-4 border-t border-white/10 px-4">
      <span className="shrink-0 text-sm font-medium text-ink">Comprobante</span>
      {children}
    </div>
  );
}

export function PendingMovementReceiptControl({
  canUpload,
  file,
  lockedMessage,
  onChange,
}: {
  canUpload: boolean;
  file: File | null;
  lockedMessage: string;
  onChange: (file: File | null) => void;
}) {
  return <PendingAttachmentControl canUpload={canUpload} file={file} lockedMessage={lockedMessage} onChange={onChange} />;
}

export function MovementDetailsNavigationRow({
  label,
  onClick,
  value,
}: {
  label: string;
  onClick: () => void;
  value: string;
}) {
  return (
    <button
      className="flex h-[54px] w-full items-center justify-between gap-4 border-t border-white/10 px-4 text-left first:border-t-0 hover:bg-white/[0.03]"
      onClick={onClick}
      type="button"
    >
      <span className="text-sm font-medium text-ink">{label}</span>
      <span className="flex min-w-0 items-center gap-2 text-sm text-storm">
        <span className="truncate">{value}</span>
        <ChevronRight className="h-4 w-4 shrink-0" />
      </span>
    </button>
  );
}

export function MovementDetailsPanel({
  categoryLabel,
  counterpartyLabel,
  description,
  destinationAmount = "",
  destinationCurrencyCode = "",
  helperText,
  invalidFields,
  isTransfer,
  navigationRows,
  onDescriptionChange,
  onDestinationAmountChange,
  onOccurredAtChange,
  onOpenCategory,
  onOpenCounterparty,
  onOpenType,
  occurredAt,
  receiptRows,
  suggestionRows,
  showDestinationAmount = false,
  typeLabel,
}: MovementDetailsPanelProps) {
  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-white/10 bg-[#141311]">
        {typeLabel && onOpenType ? (
          <MovementDetailsNavigationRow
            label="Tipo de movimiento"
            onClick={onOpenType}
            value={typeLabel}
          />
        ) : null}

        {navigationRows}

        {showDestinationAmount ? (
          <label
            className={`flex h-[54px] items-center justify-between gap-4 border-t border-white/10 px-4 first:border-t-0 ${
              invalidFields.has("destinationAmount") ? "field-error-ring" : ""
            }`}
            data-field="destinationAmount"
          >
            <span className="text-sm font-medium text-ink">Monto que llega</span>
            <span className="flex min-w-0 items-center gap-2 text-sm text-storm">
              <span>{destinationCurrencyCode}</span>
              <input
                className="w-28 bg-transparent text-right font-semibold text-ink outline-none placeholder:text-storm/55"
                inputMode="decimal"
                onChange={(event) => onDestinationAmountChange?.(event.target.value)}
                placeholder="0.00"
                value={destinationAmount}
              />
            </span>
          </label>
        ) : null}

        {!isTransfer && categoryLabel !== undefined && onOpenCategory ? (
          <MovementDetailsNavigationRow
            label="Categoría"
            onClick={onOpenCategory}
            value={categoryLabel}
          />
        ) : null}

        {!isTransfer && counterpartyLabel !== undefined && onOpenCounterparty ? (
          <MovementDetailsNavigationRow
            label="Contraparte"
            onClick={onOpenCounterparty}
            value={counterpartyLabel}
          />
        ) : null}

        <label
          className={`flex h-[54px] items-center justify-between gap-4 border-t border-white/10 px-4 first:border-t-0 ${
            invalidFields.has("description") ? "field-error-ring" : ""
          }`}
          data-field="description"
        >
          <span className="shrink-0 text-sm font-medium text-ink">Descripción</span>
          <input
            className="min-w-0 flex-1 bg-transparent text-right text-sm text-ink outline-none placeholder:text-storm/55"
            onChange={(event) => onDescriptionChange(event.target.value)}
            placeholder="Se genera automáticamente"
            value={description}
          />
        </label>

        {suggestionRows}

        <div
          className={`flex h-[54px] items-center justify-between gap-4 border-t border-white/10 px-4 ${
            invalidFields.has("occurredAt") ? "field-error-ring" : ""
          }`}
          data-field="occurredAt"
        >
          <span className="shrink-0 text-sm font-medium text-ink">Fecha</span>
          <div className="min-w-0 w-[min(62%,230px)]">
            <DatePickerField appearance="inline" mode="datetime-local" onChange={onOccurredAtChange} value={occurredAt} />
          </div>
        </div>

        {receiptRows}
      </div>

      <p className="mt-4 text-xs leading-5 text-storm/70">{helperText}</p>
    </div>
  );
}

export function MovementSuggestionRow({
  label,
  onAccept,
  reason,
  value,
}: {
  label: string;
  onAccept: () => void;
  reason?: string;
  value: string;
}) {
  return (
    <div className="flex min-h-[54px] items-center gap-3 border-t border-white/10 px-4">
      <Sparkles className="h-4 w-4 shrink-0 text-gold" />
      <div className="min-w-0 flex-1 py-2">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-storm/70">{label}</p>
        <p className="truncate text-sm text-ink">{value}</p>
        {reason ? <p className="truncate text-xs text-storm/65">{reason}</p> : null}
      </div>
      <button
        className="shrink-0 text-sm font-semibold text-ink underline-offset-4 hover:underline"
        onClick={onAccept}
        type="button"
      >
        Usar
      </button>
    </div>
  );
}

export function MovementInsightRow({
  actionDisabled,
  actionLabel,
  description,
  kind,
  label,
  onAction,
  title,
}: {
  actionDisabled?: boolean;
  actionLabel?: string;
  description: string;
  kind: "budget" | "recurring" | "risk";
  label: string;
  onAction?: () => void;
  title: string;
}) {
  const Icon = kind === "recurring" ? Repeat2 : kind === "budget" ? Gauge : AlertTriangle;
  const iconClassName = kind === "risk" ? "text-ember" : kind === "budget" ? "text-gold" : "text-pine";

  return (
    <div className="flex min-h-[54px] items-center gap-3 border-t border-white/10 px-4">
      <Icon className={`h-4 w-4 shrink-0 ${iconClassName}`} />
      <div className="min-w-0 flex-1 py-2">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-storm/70">{label}</p>
        <p className="text-sm font-medium text-ink">{title}</p>
        <p className="text-xs leading-5 text-storm/70">{description}</p>
      </div>
      {actionLabel && onAction ? (
        <button
          className="shrink-0 text-sm font-semibold text-ink underline-offset-4 hover:underline disabled:cursor-wait disabled:opacity-50"
          disabled={actionDisabled}
          onClick={onAction}
          type="button"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export function MovementDetailOptionsPanel({
  actionLabel,
  onAction,
  onChange,
  options,
  value,
}: MovementDetailOptionsPanelProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-[#141311]">
      {options.map((option) => (
        <button
          className="flex h-[54px] w-full items-center justify-between gap-4 border-t border-white/10 px-4 text-left text-sm first:border-t-0 hover:bg-white/[0.03]"
          key={option.value || "none"}
          onClick={() => onChange(option.value)}
          type="button"
        >
          <span className="truncate text-ink">{option.label}</span>
          {value === option.value ? <Check className="h-4 w-4 shrink-0 text-ink" /> : null}
        </button>
      ))}
      {actionLabel && onAction ? (
        <button
          className="flex h-[54px] w-full items-center justify-between gap-4 border-t border-white/10 px-4 text-left text-sm font-semibold text-ink hover:bg-white/[0.03]"
          onClick={onAction}
          type="button"
        >
          {actionLabel}
          <ChevronRight className="h-4 w-4 text-storm" />
        </button>
      ) : null}
    </div>
  );
}
