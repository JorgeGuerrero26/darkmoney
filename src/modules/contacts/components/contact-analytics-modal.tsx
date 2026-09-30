import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

import { Modal } from "../../../components/ui/modal";
import { ModalBody } from "../../../components/ui/modal-body";
import { ResourceEditorHeader, resourceEditorSurfaceClassName } from "../../../components/ui/resource-editor";
import { formatDate } from "../../../lib/formatting/dates";
import { formatCurrency } from "../../../lib/formatting/money";
import { analyticsMonthKey, analyticsMonthKeys, comparableAmount, currencyTotals, movementAnalyticsAmount, type CurrencyAmount } from "../../../lib/analytics-money";
import { movementActsAsIncome as isIncome } from "../../movements/lib/movement-form";
import type { CounterpartyOverview, MovementRecord } from "../../../types/domain";

type ContactWithExposure = CounterpartyOverview & { receivablePending: CurrencyAmount[]; payablePending: CurrencyAmount[] };

export function ContactAnalyticsModal({ contact, movements, baseCurrencyCode, onClose }: {
  contact: ContactWithExposure; movements: MovementRecord[]; baseCurrencyCode: string; onClose: () => void;
}) {
  const navigate = useNavigate();
  const amount = (item: MovementRecord) => comparableAmount(movementAnalyticsAmount(item, baseCurrencyCode), baseCurrencyCode) ?? 0;
  const total = (items: MovementRecord[]) => currencyTotals(items.map((item) => movementAnalyticsAmount(item, baseCurrencyCode)), baseCurrencyCode).map((item) => formatCurrency(item.amount, item.currencyCode)).join(" · ");
  const rows = useMemo(() => movements.filter((item) => item.counterpartyId === contact.id && item.status === "posted").sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)), [movements, contact.id]);
  const received = total(rows.filter(isIncome));
  const paid = total(rows.filter((item) => !isIncome(item)));
  const unconverted = rows.filter((item) => comparableAmount(movementAnalyticsAmount(item, baseCurrencyCode), baseCurrencyCode) == null).length;
  const grouped = useMemo(() => {
    const byCategory = new Map<string, number>();
    const byAccount = new Map<string, number>();
    for (const item of rows) {
      if (item.category) byCategory.set(item.category, (byCategory.get(item.category) ?? 0) + amount(item));
      const account = isIncome(item) ? item.destinationAccountName : item.sourceAccountName;
      if (account) byAccount.set(account, (byAccount.get(account) ?? 0) + amount(item));
    }
    return { categories: [...byCategory].sort((a, b) => b[1] - a[1]).slice(0, 5), accounts: [...byAccount].sort((a, b) => b[1] - a[1]).slice(0, 5) };
  }, [rows, baseCurrencyCode]);
  const months = useMemo(() => {
    return analyticsMonthKeys().map((key) => { const monthly = rows.filter((item) => analyticsMonthKey(item.occurredAt) === key); return { key, received: monthly.filter(isIncome).reduce((sum, item) => sum + amount(item), 0), paid: monthly.filter((item) => !isIncome(item)).reduce((sum, item) => sum + amount(item), 0) }; });
  }, [rows, baseCurrencyCode]);
  const maxMonth = Math.max(1, ...months.flatMap((item) => [item.received, item.paid]));
  const money = (value: number) => formatCurrency(value, baseCurrencyCode);
  const pending = (items: CurrencyAmount[]) => items.map((item) => formatCurrency(item.amount, item.currencyCode)).join(" · ");

  return <Modal className={`${resourceEditorSurfaceClassName} !max-w-[720px]`} labelledBy="contact-analytics-title" onClose={onClose}>
    <ResourceEditorHeader onClose={onClose} title={contact.name} titleId="contact-analytics-title" />
    <ModalBody className="!px-5 !py-5 sm:!px-6">
      <p className="text-sm text-storm">Actividad con este contacto · {contact.movementCount} movimientos registrados</p>
      <div className="mt-6 divide-y divide-white/10 border-y border-white/10">{[["Entró", received], ["Salió", paid], ["Por cobrar", pending(contact.receivablePending)], ["Por pagar", pending(contact.payablePending)]].map(([label, value]) => <div className="flex min-h-[54px] items-center justify-between gap-4 text-sm" key={label}><span className="text-storm">{label}</span><strong className="font-semibold text-ink">{value}</strong></div>)}</div>
      {unconverted ? <p className="mt-3 text-xs text-storm">{unconverted} movimientos sin conversión: sus importes se muestran en su moneda original y no se suman al gráfico ni a los subtotales por cuenta o categoría.</p> : null}
      {rows.length < contact.movementCount ? <p className="mt-3 text-xs text-storm">Entradas y salidas reflejan los movimientos cargados en esta sesión; el conteo total incluye el historial completo.</p> : null}
      <section className="mt-8"><h3 className="font-public-mono text-xs uppercase tracking-[0.14em] text-storm">Últimos doce meses</h3><p className="mt-1 text-xs text-storm">Hueso: entradas · gris: salidas</p><div className="mt-4 flex h-28 items-end gap-1 sm:gap-3 border-b border-white/10 pb-2">{months.map((month) => <div className="flex min-w-0 flex-1 flex-col items-center gap-2" key={month.key}><div className="flex h-[72px] w-full max-w-12 items-end justify-center gap-1"><div aria-label={`${month.key}, entradas ${money(month.received)}`} className="w-1/2 rounded-t-sm bg-[#e9e3d9]" style={{ height: `${month.received / maxMonth * 72}px` }} title={`Entradas: ${money(month.received)}`} /><div aria-label={`${month.key}, salidas ${money(month.paid)}`} className="w-1/2 rounded-t-sm bg-[#76716a]" style={{ height: `${month.paid / maxMonth * 72}px` }} title={`Salidas: ${money(month.paid)}`} /></div><span className="text-[11px] text-storm">{month.key.slice(5)}</span></div>)}</div></section>
      {([{ title: "Categorías frecuentes", data: grouped.categories }, { title: "Cuentas relacionadas", data: grouped.accounts }] as const).map((section) => section.data.length ? <section className="mt-8" key={section.title}><h3 className="mb-2 font-public-mono text-xs uppercase tracking-[0.14em] text-storm">{section.title}</h3>{section.data.map(([name, total]) => <div className="flex min-h-[48px] items-center justify-between gap-4 border-b border-white/[0.08] text-sm" key={name}><span className="text-ink">{name}</span><span className="text-storm">{money(total)}</span></div>)}</section> : null)}
      <section className="mt-8"><h3 className="mb-2 font-public-mono text-xs uppercase tracking-[0.14em] text-storm">Movimientos recientes</h3>{rows.length ? rows.slice(0, 8).map((item) => <button className="flex min-h-[54px] w-full items-center justify-between gap-3 border-b border-white/[0.08] text-left" key={item.id} onClick={() => { onClose(); navigate(`/app/movements?movement=${item.id}`); }} type="button"><span className="min-w-0"><span className="block truncate text-sm font-semibold text-ink">{item.description || "Sin descripción"}</span><span className="block text-xs text-storm">{formatDate(item.occurredAt)}</span></span><span className="shrink-0 text-sm text-ink">{total([item])}</span></button>) : <p className="py-4 text-sm text-storm">Aún no hay movimientos con este contacto.</p>}</section>
    </ModalBody>
  </Modal>;
}
