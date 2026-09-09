import type { PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from "react";
import { useState } from "react";

import { DataState } from "../../../components/ui/data-state";
import { formatCurrency } from "../../../lib/formatting/money";
import { useInView } from "../../../hooks/use-in-view";
import type { MovementRecord } from "../../../types/domain";
import {
  classifyMovement,
  getExpenseAmount,
  getIncomeAmount,
  getTransferLineAmount,
} from "../lib/dashboard-classify";
import { fullDateFormatter } from "../lib/dashboard-format";
import type { DailyFlowPoint, DailySavingsPoint } from "../lib/dashboard-types";
const CHART_VIEW_WIDTH = 760;
const CHART_VIEW_HEIGHT = 232;
const CHART_PADDING_X = 22;
const CHART_PADDING_Y = 24;

type ChartPointBase = {
  key: string;
  label: string;
  fullLabel: string;
  cumulative: number;
  previousCumulative: number;
};

type ChartTooltipRow = { label: string; value: string; accentClassName?: string };

/**
 * SVG de líneas responsive (mobile-first: escala con el contenedor, sin scroll
 * horizontal) con hover/tap para inspeccionar el punto más cercano.
 */
function LineChartSvg<P extends ChartPointBase>({
  points,
  selectedIndex,
  onSelect,
  lineColor,
  gradientId,
  fillTop,
  fillBottom,
  buildTooltipRows,
}: {
  points: P[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  lineColor: string;
  gradientId: string;
  fillTop: string;
  fillBottom: string;
  buildTooltipRows: (point: P) => ChartTooltipRow[];
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const { ref: inViewRef, isInView } = useInView<HTMLDivElement>();

  const width = CHART_VIEW_WIDTH;
  const height = CHART_VIEW_HEIGHT;
  const paddingX = CHART_PADDING_X;
  const paddingY = CHART_PADDING_Y;
  const values = points.flatMap((point) => [point.cumulative, point.previousCumulative, 0]);
  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);
  const range = Math.max(1, maxValue - minValue);
  const stepX = points.length > 1 ? (width - paddingX * 2) / (points.length - 1) : 0;
  const getY = (value: number) =>
    paddingY + ((maxValue - value) / range) * (height - paddingY * 2);
  const currentPath = points
    .map((point, index) => `${paddingX + stepX * index},${getY(point.cumulative)}`)
    .join(" ");
  const previousPath = points
    .map((point, index) => `${paddingX + stepX * index},${getY(point.previousCumulative)}`)
    .join(" ");
  const areaPath = `${paddingX},${height - paddingY} ${currentPath} ${
    paddingX + stepX * (points.length - 1)
  },${height - paddingY}`;

  function resolveIndexFromClientX(clientX: number, target: SVGSVGElement) {
    const rect = target.getBoundingClientRect();
    if (rect.width === 0) {
      return 0;
    }
    const xView = ((clientX - rect.left) / rect.width) * width;
    const rawIndex = stepX > 0 ? Math.round((xView - paddingX) / stepX) : 0;
    return Math.min(Math.max(rawIndex, 0), points.length - 1);
  }

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    setHoverIndex(resolveIndexFromClientX(event.clientX, event.currentTarget));
  }

  function handleClick(event: ReactMouseEvent<SVGSVGElement>) {
    onSelect(resolveIndexFromClientX(event.clientX, event.currentTarget));
  }

  const hoverPoint = hoverIndex !== null ? points[hoverIndex] : null;
  const hoverX = hoverIndex !== null ? paddingX + stepX * hoverIndex : 0;

  return (
    <div className="relative" ref={inViewRef}>
      {hoverPoint ? (
        <div
          className="pointer-events-none absolute top-2 z-10 w-max max-w-[220px] -translate-x-1/2 rounded-[6px] border border-white/[0.12] bg-[#11110f] px-3 py-2 shadow-xl"
          style={{ left: `${Math.min(Math.max((hoverX / width) * 100, 16), 84)}%` }}
        >
          <p className="text-[0.65rem] font-semibold text-ink">{hoverPoint.fullLabel}</p>
          {buildTooltipRows(hoverPoint).map((row) => (
            <p
              className="mt-0.5 flex items-baseline justify-between gap-3 text-[0.65rem] text-storm"
              key={row.label}
            >
              <span>{row.label}</span>
              <span className={`font-semibold ${row.accentClassName ?? "text-ink"}`}>
                {row.value}
              </span>
            </p>
          ))}
        </div>
      ) : null}

      <svg
        className="h-auto w-full cursor-pointer touch-pan-y"
        onClick={handleClick}
        onPointerLeave={() => setHoverIndex(null)}
        onPointerMove={handlePointerMove}
        role="img"
        viewBox={`0 0 ${width} ${height}`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={fillTop} />
            <stop offset="100%" stopColor={fillBottom} />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((step) => (
          <line
            key={`grid-${step}`}
            stroke="rgba(255,255,255,0.07)"
            x1={paddingX}
            x2={width - paddingX}
            y1={paddingY + (height - paddingY * 2) * step}
            y2={paddingY + (height - paddingY * 2) * step}
          />
        ))}
        <polygon
          className={isInView ? "chart-area-fade" : "opacity-0"}
          fill={`url(#${gradientId})`}
          points={areaPath}
        />
        <polyline
          className={isInView ? "animate-fade-in" : "opacity-0"}
          fill="none"
          points={previousPath}
          stroke="rgba(255,255,255,0.48)"
          strokeDasharray="4 6"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
        <polyline
          className={isInView ? "chart-line-draw" : "opacity-0"}
          fill="none"
          pathLength={1}
          points={currentPath}
          stroke={lineColor}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.5"
        />
        {hoverPoint ? (
          <g pointerEvents="none">
            <line
              stroke="rgba(255,255,255,0.18)"
              strokeWidth="1.5"
              x1={hoverX}
              x2={hoverX}
              y1={paddingY}
              y2={height - paddingY}
            />
            <circle
              cx={hoverX}
              cy={getY(hoverPoint.cumulative)}
              fill="none"
              r="8"
              stroke={lineColor}
              strokeWidth="2"
            />
          </g>
        ) : null}
        {points[selectedIndex] ? (
          <g pointerEvents="none">
            <circle
              cx={paddingX + stepX * selectedIndex}
              cy={getY(points[selectedIndex].cumulative)}
              fill="#171715"
              r="6"
              stroke={lineColor}
              strokeWidth="2"
            />
            <circle
              cx={paddingX + stepX * selectedIndex}
              cy={getY(points[selectedIndex].cumulative)}
              fill={lineColor}
              r="2"
            />
          </g>
        ) : null}
      </svg>
    </div>
  );
}

export const FLOW_CHART_THEME = {
  expense: {
    line: "rgba(244, 241, 236, 0.9)",
    fillTop: "rgba(244, 241, 236, 0.1)",
    fillBottom: "rgba(244, 241, 236, 0.01)",
    gradientId: "dashboard-flow-expense-fill",
    accentClass: "text-ink",
  },
  income: {
    line: "rgba(79, 196, 132, 0.95)",
    fillTop: "rgba(79, 196, 132, 0.16)",
    fillBottom: "rgba(79, 196, 132, 0.01)",
    gradientId: "dashboard-flow-income-fill",
    accentClass: "text-pine",
  },
  transfer: {
    line: "rgba(155, 157, 153, 0.9)",
    fillTop: "rgba(155, 157, 153, 0.1)",
    fillBottom: "rgba(155, 157, 153, 0.01)",
    gradientId: "dashboard-flow-transfer-fill",
    accentClass: "text-storm",
  },
} as const;

export function ChronologicalMovementList({
  title,
  emptyHint,
  movements,
  currencyCode,
  resolveAmount,
}: {
  title: string;
  emptyHint: string;
  movements: MovementRecord[];
  currencyCode: string;
  resolveAmount: (movement: MovementRecord) => number;
}) {
  if (!movements.length) {
    return (
      <div>
        <p className="font-public-mono text-[10px] uppercase tracking-[0.18em] text-storm">{title}</p>
        <p className="mt-3 text-sm text-storm">{emptyHint}</p>
      </div>
    );
  }

  return (
    <div>
      <p className="font-public-mono text-[10px] uppercase tracking-[0.18em] text-storm">{title}</p>
      <ul className="mt-3 max-h-52 divide-y divide-white/[0.07] overflow-y-auto border-y border-white/[0.07]">
        {movements.map((movement) => (
          <li
            className="flex flex-wrap items-start justify-between gap-3 py-3"
            key={movement.id}
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-ink">
                {movement.description || movement.counterparty || "Sin descripción"}
              </p>
              <p className="mt-0.5 text-xs text-storm">
                {[movement.category, movement.counterparty].filter(Boolean).join(" · ") ||
                  movement.movementType}
              </p>
            </div>
            <p className="shrink-0 font-public-mono text-xs font-medium text-ink">
              {formatCurrency(resolveAmount(movement), currencyCode)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DayMovementsBreakdown({
  movements,
  currencyCode,
  withTopDivider = true,
}: {
  movements: MovementRecord[];
  currencyCode: string;
  withTopDivider?: boolean;
}) {
  const income: MovementRecord[] = [];
  const expense: MovementRecord[] = [];
  const transfers: MovementRecord[] = [];

  for (const movement of movements) {
    if (movement.movementType === "transfer") {
      transfers.push(movement);
      continue;
    }

    const classified = classifyMovement(movement);

    if (classified?.kind === "income") {
      income.push(movement);
    } else if (classified?.kind === "expense") {
      expense.push(movement);
    }
  }

  return (
    <div
      className={
        withTopDivider ? "space-y-5 border-t border-white/[0.07] pt-5" : "space-y-5"
      }
    >
      <p className="font-display text-base font-semibold text-ink">Movimientos del día seleccionado</p>
      <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,15rem),1fr))]">
        <ChronologicalMovementList
          currencyCode={currencyCode}
          emptyHint="Sin ingresos este día."
          movements={income}
          resolveAmount={getIncomeAmount}
          title="Ingresos"
        />
        <ChronologicalMovementList
          currencyCode={currencyCode}
          emptyHint="Sin gastos este día."
          movements={expense}
          resolveAmount={getExpenseAmount}
          title="Gastos"
        />
        <ChronologicalMovementList
          currencyCode={currencyCode}
          emptyHint="Sin transferencias este día."
          movements={transfers}
          resolveAmount={getTransferLineAmount}
          title="Transferencias"
        />
      </div>
    </div>
  );
}

export function FlowLineChart({
  variant,
  points,
  selectedIndex,
  onSelect,
  currencyCode,
  movementsForDay,
  chartTitle,
  dailyLabel,
  comparisonDailyLabel,
}: {
  variant: keyof typeof FLOW_CHART_THEME;
  points: DailyFlowPoint[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  currencyCode: string;
  movementsForDay: MovementRecord[];
  chartTitle: string;
  dailyLabel: string;
  comparisonDailyLabel: string;
}) {
  const theme = FLOW_CHART_THEME[variant];

  if (!points.length) {
    return (
      <DataState
        description="Necesitamos movimientos aplicados dentro del período para dibujar la evolución diaria."
        title="Aún no hay trazo para este período"
      />
    );
  }
  const values = points.flatMap((point) => [point.cumulative, point.previousCumulative, 0]);
  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);
  const axisSteps = [maxValue, (maxValue + minValue) / 2, minValue];
  const selected = points[selectedIndex];
  const selectedDelta = selected ? selected.daily - selected.previousDaily : 0;

  return (
    <div>
      <div className="flex flex-col gap-4 border-b border-white/[0.07] pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-public-mono text-[10px] uppercase tracking-[0.2em] text-storm">{chartTitle}</p>
          <p className="mt-2 text-sm text-storm">Selecciona un punto para comparar ese día.</p>
        </div>
        <div className="flex flex-wrap gap-5 text-xs text-storm" aria-label="Leyenda del gráfico">
          <span className="inline-flex items-center gap-2"><i className="h-0.5 w-5" style={{ backgroundColor: theme.line }} />Período actual</span>
          <span className="inline-flex items-center gap-2"><i className="w-5 border-t border-dashed border-white/40" />Comparación</span>
        </div>
      </div>

      <div className="grid gap-3 py-5 lg:grid-cols-[auto_1fr]">
        <div className="hidden gap-2 font-public-mono text-[10px] text-storm lg:flex lg:flex-col lg:justify-between">
          {axisSteps.map((value, index) => <span key={`flow-axis-${index}`}>{formatCurrency(value, currencyCode)}</span>)}
        </div>
        <LineChartSvg
          buildTooltipRows={(point) => [
            { label: dailyLabel, value: formatCurrency(point.daily, currencyCode), accentClassName: theme.accentClass },
            { label: "Acumulado", value: formatCurrency(point.cumulative, currencyCode) },
            { label: "Comparativo", value: formatCurrency(point.previousCumulative, currencyCode) },
          ]}
          fillBottom={theme.fillBottom}
          fillTop={theme.fillTop}
          gradientId={theme.gradientId}
          lineColor={theme.line}
          onSelect={onSelect}
          points={points}
          selectedIndex={selectedIndex}
        />
      </div>

      <div className="flex flex-wrap justify-between gap-3 border-t border-white/[0.07] pt-3 font-public-mono text-[10px] text-storm">
        {points
          .filter((_, index) => {
            if (points.length <= 5) return true;
            const step = Math.max(1, Math.floor((points.length - 1) / 4));
            return index === 0 || index === points.length - 1 || index % step === 0;
          })
          .map((point) => <span key={`flow-tick-${point.key}`}>{point.label}</span>)}
      </div>

      {selected ? (
        <>
          <section className="mt-6 grid border-y border-white/[0.07] sm:grid-cols-4">
            <div className="py-4 sm:pr-5">
              <p className="font-public-mono text-[10px] uppercase tracking-[0.18em] text-storm">Detalle del día</p>
              <p className="mt-2 font-display text-lg font-semibold text-ink">{selected.fullLabel}</p>
              <p className="mt-1 text-xs text-storm">vs. {fullDateFormatter.format(selected.previousDate)}</p>
            </div>
            <div className="border-t border-white/[0.07] py-4 sm:border-l sm:border-t-0 sm:px-5">
              <p className={`font-public-mono text-[10px] uppercase tracking-[0.18em] ${theme.accentClass}`}>{dailyLabel}</p>
              <p className="mt-2 font-display text-xl font-semibold text-ink">{formatCurrency(selected.daily, currencyCode)}</p>
              <p className="mt-1 text-xs text-storm">Acumulado {formatCurrency(selected.cumulative, currencyCode)}</p>
            </div>
            <div className="border-t border-white/[0.07] py-4 sm:border-l sm:border-t-0 sm:px-5">
              <p className="font-public-mono text-[10px] uppercase tracking-[0.18em] text-storm">{comparisonDailyLabel}</p>
              <p className="mt-2 font-display text-xl font-semibold text-ink">{formatCurrency(selected.previousDaily, currencyCode)}</p>
              <p className="mt-1 text-xs text-storm">Acumulado {formatCurrency(selected.previousCumulative, currencyCode)}</p>
            </div>
            <div className="border-t border-white/[0.07] py-4 sm:border-l sm:border-t-0 sm:pl-5">
              <p className="font-public-mono text-[10px] uppercase tracking-[0.18em] text-storm">Variación del día</p>
              <p className="mt-2 font-public-mono text-base font-medium text-ink">
                {selectedDelta > 0 ? "+" : ""}{formatCurrency(selectedDelta, currencyCode)}
              </p>
            </div>
          </section>
          <div className="mt-6">
          <ChronologicalMovementList
            currencyCode={currencyCode}
            emptyHint="No hubo movimientos de este tipo ese día."
            movements={movementsForDay}
            resolveAmount={
              variant === "income"
                ? getIncomeAmount
                : variant === "expense"
                  ? getExpenseAmount
                  : getTransferLineAmount
            }
            title="Movimientos ese día"
          />
          </div>
        </>
      ) : null}
    </div>
  );
}

export function SavingsLineChart({
  points,
  selectedIndex,
  onSelect,
  currencyCode,
  dayMovements,
}: {
  points: DailySavingsPoint[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  currencyCode: string;
  dayMovements: MovementRecord[];
}) {
  if (!points.length) {
    return (
      <DataState
        description="Necesitamos movimientos aplicados dentro del período para dibujar la evolución diaria."
        title="Aún no hay trazo para este período"
      />
    );
  }

  const values = points.flatMap((point) => [point.cumulative, point.previousCumulative, 0]);
  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);
  const axisSteps = [maxValue, (maxValue + minValue) / 2, minValue];
  const selected = points[selectedIndex];
  const selectedDelta = selected ? selected.net - selected.previousNet : 0;

  return (
    <div>
      <div className="flex flex-col gap-4 border-b border-white/[0.07] pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-public-mono text-[10px] uppercase tracking-[0.2em] text-storm">Ahorro acumulado</p>
          <p className="mt-2 text-sm text-storm">Selecciona un punto para comparar ese día.</p>
        </div>
        <div className="flex flex-wrap gap-5 text-xs text-storm" aria-label="Leyenda del gráfico">
          <span className="inline-flex items-center gap-2"><i className="h-0.5 w-5 bg-[#f4f1ec]" />Período actual</span>
          <span className="inline-flex items-center gap-2"><i className="w-5 border-t border-dashed border-white/40" />Comparación</span>
        </div>
      </div>

      <div className="grid gap-3 py-5 lg:grid-cols-[auto_1fr]">
        <div className="hidden gap-2 font-public-mono text-[10px] text-storm lg:flex lg:flex-col lg:justify-between">
          {axisSteps.map((value, index) => <span key={`axis-${index}`}>{formatCurrency(value, currencyCode)}</span>)}
        </div>
        <LineChartSvg
          buildTooltipRows={(point) => [
            { label: "Ahorro del día", value: formatCurrency(point.net, currencyCode), accentClassName: "text-ink" },
            { label: "Acumulado", value: formatCurrency(point.cumulative, currencyCode) },
            { label: "Comparativo", value: formatCurrency(point.previousCumulative, currencyCode) },
          ]}
          fillBottom="rgba(244, 241, 236, 0.01)"
          fillTop="rgba(244, 241, 236, 0.1)"
          gradientId="dashboard-savings-fill"
          lineColor="rgba(244, 241, 236, 0.9)"
          onSelect={onSelect}
          points={points}
          selectedIndex={selectedIndex}
        />
      </div>

      <div className="flex flex-wrap justify-between gap-3 border-t border-white/[0.07] pt-3 font-public-mono text-[10px] text-storm">
        {points
          .filter((_, index) => {
            if (points.length <= 5) return true;
            const step = Math.max(1, Math.floor((points.length - 1) / 4));
            return index === 0 || index === points.length - 1 || index % step === 0;
          })
          .map((point) => <span key={`tick-${point.key}`}>{point.label}</span>)}
      </div>

      {selected ? (
        <>
          <section className="mt-6 grid border-y border-white/[0.07] sm:grid-cols-4">
            <div className="py-4 sm:pr-5">
              <p className="font-public-mono text-[10px] uppercase tracking-[0.18em] text-storm">Detalle del ritmo</p>
              <p className="mt-2 font-display text-lg font-semibold text-ink">{selected.fullLabel}</p>
              <p className="mt-1 text-xs text-storm">vs. {fullDateFormatter.format(selected.previousDate)}</p>
            </div>
            <div className="border-t border-white/[0.07] py-4 sm:border-l sm:border-t-0 sm:px-5">
              <p className="font-public-mono text-[10px] uppercase tracking-[0.18em] text-storm">Ahorro del día</p>
              <p className="mt-2 font-display text-xl font-semibold text-ink">{formatCurrency(selected.net, currencyCode)}</p>
              <p className="mt-1 text-xs text-storm">Entradas {formatCurrency(selected.income, currencyCode)} · salidas {formatCurrency(selected.expense, currencyCode)}</p>
            </div>
            <div className="border-t border-white/[0.07] py-4 sm:border-l sm:border-t-0 sm:px-5">
              <p className="font-public-mono text-[10px] uppercase tracking-[0.18em] text-storm">Comparación</p>
              <p className="mt-2 font-display text-xl font-semibold text-ink">{formatCurrency(selected.previousNet, currencyCode)}</p>
              <p className="mt-1 text-xs text-storm">Acumulado {formatCurrency(selected.cumulative, currencyCode)}</p>
            </div>
            <div className="border-t border-white/[0.07] py-4 sm:border-l sm:border-t-0 sm:pl-5">
              <p className="font-public-mono text-[10px] uppercase tracking-[0.18em] text-storm">Variación del día</p>
              <p className="mt-2 font-public-mono text-base font-medium text-ink">{selectedDelta > 0 ? "+" : ""}{formatCurrency(selectedDelta, currencyCode)}</p>
              <p className="mt-1 text-xs text-storm">Frente al período anterior</p>
            </div>
          </section>
          <div className="mt-6">
          <DayMovementsBreakdown
            currencyCode={currencyCode}
            movements={dayMovements}
            withTopDivider={false}
          />
          </div>
        </>
      ) : null}
    </div>
  );
}
