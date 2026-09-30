import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

import { Modal } from "../../../components/ui/modal";
import { ModalBody } from "../../../components/ui/modal-body";
import { ResourceEditorHeader, resourceEditorSurfaceClassName } from "../../../components/ui/resource-editor";
import { formatDate } from "../../../lib/formatting/dates";
import { formatCurrency } from "../../../lib/formatting/money";
import { analyticsMonthKey, analyticsMonthKeys, comparableAmount, currencyTotals, movementAnalyticsAmount } from "../../../lib/analytics-money";
import { movementActsAsIncome as isIncome } from "../../movements/lib/movement-form";
import type { CategoryOverview, MovementRecord } from "../../../types/domain";

const isExpense = (movement: MovementRecord) => ["expense", "subscription_payment", "obligation_payment"].includes(movement.movementType) && !isIncome(movement);

export function CategoryAnalyticsModal({ category, movements, baseCurrencyCode, onClose }: {
  category: CategoryOverview; movements: MovementRecord[]; baseCurrencyCode: string; onClose: () => void;
}) {
  const navigate = useNavigate();
  const amount = (item: MovementRecord) => comparableAmount(movementAnalyticsAmount(item, baseCurrencyCode), baseCurrencyCode) ?? 0;
  const total = (items: MovementRecord[]) => currencyTotals(items.map((item) => movementAnalyticsAmount(item, baseCurrencyCode)), baseCurrencyCode).map((item) => formatCurrency(item.amount, item.currencyCode)).join(" · ");
  const rows = useMemo(() => movements.filter((item) => item.categoryId === category.id && item.status === "posted").sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)), [movements, category.id]);
  const spent = total(rows.filter(isExpense));
  const received = total(rows.filter(isIncome));
  const unconverted = rows.filter((item) => comparableAmount(movementAnalyticsAmount(item, baseCurrencyCode), baseCurrencyCode) == null).length;
  const byAccount = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    for (const item of rows) {
      const name = isIncome(item) ? item.destinationAccountName : item.sourceAccountName;
      if (!name) continue;
      const current = map.get(name) ?? { count: 0, total: 0 }; current.count++; current.total += amount(item); map.set(name, current);
    }
    return [...map].sort((a, b) => b[1].total - a[1].total).slice(0, 5);
  }, [rows, baseCurrencyCode]);
  const months = useMemo(() => {
    return analyticsMonthKeys().map((key) => ({ key, total: rows.filter((item) => analyticsMonthKey(item.occurredAt) === key).reduce((sum, item) => sum + amount(item), 0) }));
  }, [rows, baseCurrencyCode]);
  const maxMonth = Math.max(1, ...months.map((item) => item.total));
  const money = (value: number) => formatCurrency(value, baseCurrencyCode);

  return <Modal className={`${resourceEditorSurfaceClassName} !max-w-[720px]`} labelledBy="cat-analytics-title" onClose={onClose}>
    <ResourceEditorHeader onClose={onClose} title={category.name} titleId="cat-analytics-title" />
    <ModalBody className="!px-5 !py-5 sm:!px-6">
      <p className="text-sm text-storm">Actividad de la categoría · {category.movementCount} movimientos registrados</p>
      <div className="mt-6 divide-y divide-white/10 border-y border-white/10">{[["Gastos aplicados", spent], ["Ingresos aplicados", received], ["Suscripciones", category.subscriptionCount]].map(([label, value]) => <div className="flex min-h-[54px] items-center justify-between gap-4 text-sm" key={label}><span className="text-storm">{label}</span><strong className="font-semibold text-ink">{value}</strong></div>)}</div>
      {unconverted ? <p className="mt-3 text-xs text-storm">{unconverted} movimientos sin conversión: sus importes se muestran en su moneda original y no se suman al gráfico ni a los subtotales por cuenta.</p> : null}
      {rows.length < category.movementCount ? <p className="mt-3 text-xs text-storm">Los importes reflejan los movimientos cargados en esta sesión; el conteo total incluye el historial completo.</p> : null}
      <section className="mt-8"><h3 className="font-public-mono text-xs uppercase tracking-[0.14em] text-storm">Últimos doce meses</h3><div className="mt-4 flex h-28 items-end gap-1 sm:gap-3 border-b border-white/10 pb-2">{months.map((month) => <div className="flex min-w-0 flex-1 flex-col items-center gap-2" key={month.key}><div aria-label={`${month.key}: ${money(month.total)}`} className="w-full max-w-10 rounded-t-sm bg-[#e9e3d9]" style={{ height: `${Math.max(month.total ? 4 : 0, month.total / maxMonth * 72)}px` }} title={`${month.key}: ${money(month.total)}`} /><span className="text-[11px] text-storm">{month.key.slice(5)}</span></div>)}</div></section>
      {byAccount.length ? <section className="mt-8"><h3 className="mb-2 font-public-mono text-xs uppercase tracking-[0.14em] text-storm">Cuentas relacionadas</h3>{byAccount.map(([name, data]) => <div className="flex min-h-[48px] items-center justify-between gap-4 border-b border-white/[0.08] text-sm" key={name}><span className="text-ink">{name} <span className="text-storm">· {data.count}</span></span><span className="text-storm">{money(data.total)}</span></div>)}</section> : null}
      <section className="mt-8"><h3 className="mb-2 font-public-mono text-xs uppercase tracking-[0.14em] text-storm">Movimientos recientes</h3>{rows.length ? rows.slice(0, 8).map((item) => <button className="flex min-h-[54px] w-full items-center justify-between gap-3 border-b border-white/[0.08] text-left" key={item.id} onClick={() => { onClose(); navigate(`/app/movements?movement=${item.id}`); }} type="button"><span className="min-w-0"><span className="block truncate text-sm font-semibold text-ink">{item.description || "Sin descripción"}</span><span className="block text-xs text-storm">{formatDate(item.occurredAt)}</span></span><span className="shrink-0 text-sm text-ink">{total([item])}</span></button>) : <p className="py-4 text-sm text-storm">Aún no hay movimientos en esta categoría.</p>}</section>
    </ModalBody>
  </Modal>;
}
