import { Check, ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "../../../components/ui/button";
import { Modal, ModalFooter, ModalHeader } from "../../../components/ui/modal";
import { ModalBody } from "../../../components/ui/modal-body";

/** Local filter destination: each explicit selection applies immediately, never writes catalog data. */
export function AccountMultiFilter({ title, allLabel, options, values, onChange }: {
  title: string; allLabel: string; options: { value: string; label: string }[]; values: string[]; onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const currentOptions = [...options, ...values.filter(value => !options.some(option => option.value === value)).map(value => ({ value, label: value || "Sin institución" }))];
  const label = values.length === 0 ? allLabel : values.length === 1 ? currentOptions.find(option => option.value === values[0])?.label ?? values[0] : `${title} (${values.length})`;
  return <>
    <button aria-expanded={open} aria-haspopup="dialog" aria-label={title} className="field-dark flex items-center justify-between gap-3 text-left text-sm font-semibold" onClick={() => setOpen(true)} type="button">
      <span className="truncate">{label}</span><ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-storm" />
    </button>
    {open ? <Modal labelledBy={titleId} onClose={() => setOpen(false)} size="sm">
      <ModalHeader description="Puedes elegir más de una opción. Se muestran las cuentas que coincidan con cualquiera de ellas." onClose={() => setOpen(false)} title={title} titleId={titleId} />
      <ModalBody className="!py-2">
        <button aria-pressed={!values.length} className="flex min-h-[48px] w-full items-center justify-between gap-3 border-b border-white/10 text-left text-sm text-ink" onClick={() => onChange([])} type="button">{allLabel}{!values.length ? <Check className="h-4 w-4" /> : null}</button>
        {currentOptions.map(option => <label className="flex min-h-[48px] cursor-pointer items-center justify-between gap-3 border-b border-white/[0.07] text-sm text-ink last:border-0" key={option.value}>
          {option.label}
          <input checked={values.includes(option.value)} className="h-4 w-4 accent-[#f4f1eb]" onChange={() => onChange(values.includes(option.value) ? values.filter(value => value !== option.value) : [...values, option.value])} type="checkbox" />
        </label>)}
      </ModalBody>
      <ModalFooter><Button className="w-full" onClick={() => setOpen(false)}>Listo</Button></ModalFooter>
    </Modal> : null}
  </>;
}
