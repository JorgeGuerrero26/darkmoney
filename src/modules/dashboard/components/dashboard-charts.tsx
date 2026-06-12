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
import { DeltaBadge } from "./dashboard-bits";

const CHART_VIEW_WIDTH = 760;
const CHART_VIEW_HEIGHT = 260;
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
          className="pointer-events-none absolute top-2 z-10 w-max max-w-[220px] -translate-x-1/2 rounded-xl border border-white/12 bg-shell/95 px-3 py-2 shadow-haze backdrop-blur-xl"
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
            stroke="rgba(255,255,255,0.08)"
            strokeDasharray="4 6"
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
          strokeDasharray="7 7"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3"
        />
        <polyline
          className={isInView ? "chart-line-draw" : "opacity-0"}
          fill="none"
          pathLength={1}
          points={currentPath}
          stroke={lineColor}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="4"
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
        {points.map((point, index) => {
          const x = paddingX + stepX * index;
          const isSelected = index === selectedIndex;

          return (
            <g key={point.key}>
              <circle
                cx={x}
                cy={getY(point.previousCumulative)}
                fill="rgba(255,255,255,0.3)"
                r="4"
              />
              <circle
                cx={x}
                cy={getY(point.cumulative)}
                fill={isSelected ? "rgba(255,255,255,1)" : lineColor}
                r={isSelected ? 7 : 5}
                stroke={isSelected ? lineColor : "rgba(255,255,255,0.12)"}
                strokeWidth="2"
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export const FLOW_CHART_THEME = {
  expense: {
    line: "rgba(225, 112, 85, 0.95)",
    fillTop: "rgba(225, 112, 85, 0.26)",
    fillBottom: "rgba(225, 112, 85, 0.02)",
    gradientId: "dashboard-flow-expense-fill",
    accentClass: "text-ember",
    panelClass: "border-ember/18 bg-ember/10",
  },
  income: {
    line: "rgba(56, 161, 105, 0.95)",
    fillTop: "rgba(56, 161, 105, 0.28)",
    fillBottom: "rgba(56, 161, 105, 0.02)",
    gradientId: "dashboard-flow-income-fill",
    accentClass: "text-pine",
    panelClass: "border-pine/18 bg-pine/10",
  },
  transfer: {
    line: "rgba(212, 175, 55, 0.95)",
    fillTop: "rgba(212, 175, 55, 0.24)",
    fillBottom: "rgba(212, 175, 55, 0.02)",
    gradientId: "dashboard-flow-transfer-fill",
    accentClass: "text-gold",
    panelClass: "border-gold/18 bg-gold/10",
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
        <p className="text-xs uppercase tracking-[0.18em] text-storm">{title}</p>
        <p className="mt-2 text-sm text-storm">{emptyHint}</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.18em] text-storm">{title}</p>
      <ul className="mt-3 max-h-52 space-y-2 overflow-y-auto pr-1">
        {movements.map((movement) => (
          <li
            className="flex items-start justify-between gap-3 rounded-[18px] border border-white/10 bg-white/[0.03] px-3 py-2"
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
            <p className="shrink-0 font-display text-sm font-semibold text-ink">
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
        withTopDivider ? "space-y-5 border-t border-white/8 pt-5" : "space-y-5"
      }
    >
      <p className="text-sm font-semibold text-ink">Movimientos del día seleccionado</p>
      <div className="grid gap-5 md:grid-cols-3">
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

  return (
    <>
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="glass-panel-soft rounded-[28px] p-3 sm:p-4">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-storm">{chartTitle}</p>
              <p className="mt-2 text-sm text-storm">
                Toca un punto para ver el detalle de ese día frente al período anterior.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-storm">
              <span className="inline-flex items-center gap-2 rounded-full border border-pine/20 bg-pine/10 px-3 py-1">
                <span className="h-2 w-2 rounded-full bg-pine" style={{ backgroundColor: theme.line }} />
                Periodo actual
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                <span className="h-2 w-2 rounded-full bg-white/60" />
                Comparación
              </span>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[auto_1fr]">
            <div className="hidden gap-2 lg:flex lg:flex-col lg:justify-between">
              {axisSteps.map((value, index) => (
                <span className="text-xs text-storm" key={`flow-axis-${index}`}>
                  {formatCurrency(value, currencyCode)}
                </span>
              ))}
            </div>
            <LineChartSvg
              buildTooltipRows={(point) => [
                {
                  label: dailyLabel,
                  value: formatCurrency(point.daily, currencyCode),
                  accentClassName: theme.accentClass,
                },
                { label: "Acumulado", value: formatCurrency(point.cumulative, currencyCode) },
                {
                  label: "Comparativo",
                  value: formatCurrency(point.previousCumulative, currencyCode),
                },
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

          <div className="mt-4 flex flex-wrap justify-between gap-3 border-t border-white/8 pt-4 text-xs text-storm">
            {points
              .filter((_, index) => {
                if (points.length <= 5) {
                  return true;
                }

                const step = Math.max(1, Math.floor((points.length - 1) / 4));
                return index === 0 || index === points.length - 1 || index % step === 0;
              })
              .map((point) => (
                <span key={`flow-tick-${point.key}`}>{point.label}</span>
              ))}
          </div>
        </div>

        <div className="glass-panel-soft rounded-[28px] p-5">
          {selected ? (
            <>
              <p className="text-xs uppercase tracking-[0.22em] text-storm">Detalle del día</p>
              <h4 className="mt-3 font-display text-3xl font-semibold text-ink">{selected.fullLabel}</h4>
              <p className="mt-2 text-sm text-storm">
                Frente a {fullDateFormatter.format(selected.previousDate)}
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className={`rounded-[22px] border p-4 ${theme.panelClass}`}>
                  <p className={`text-xs uppercase tracking-[0.18em] ${theme.accentClass}`}>{dailyLabel}</p>
                  <p className="mt-3 font-display text-3xl font-semibold text-ink">
                    {formatCurrency(selected.daily, currencyCode)}
                  </p>
                  <p className="mt-2 text-sm text-storm">
                    Acumulado en el período {formatCurrency(selected.cumulative, currencyCode)}.
                  </p>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-storm">{comparisonDailyLabel}</p>
                  <p className="mt-3 font-display text-3xl font-semibold text-ink">
                    {formatCurrency(selected.previousDaily, currencyCode)}
                  </p>
                  <p className="mt-2 text-sm text-storm">
                    Acumulado comparativo {formatCurrency(selected.previousCumulative, currencyCode)}.
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-ink">Cambio frente al comparativo (día)</p>
                  <DeltaBadge currencyCode={currencyCode} inverse={false} value={selected.daily - selected.previousDaily} />
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {selected ? (
        <div className="glass-panel-soft mt-6 rounded-[28px] p-5">
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
      ) : null}
    </>
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

  return (
    <>
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <div className="glass-panel-soft rounded-[28px] p-3 sm:p-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-storm">Ahorro acumulado</p>
            <p className="mt-2 text-sm text-storm">
              Toca un punto para ver el detalle de ese día frente al período anterior.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-storm">
            <span className="inline-flex items-center gap-2 rounded-full border border-pine/20 bg-pine/10 px-3 py-1">
              <span className="h-2 w-2 rounded-full bg-pine" />
              Periodo actual
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
              <span className="h-2 w-2 rounded-full bg-white/60" />
              Comparación
            </span>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[auto_1fr]">
          <div className="hidden gap-2 lg:flex lg:flex-col lg:justify-between">
            {axisSteps.map((value, index) => (
              <span className="text-xs text-storm" key={`axis-${index}`}>
                {formatCurrency(value, currencyCode)}
              </span>
            ))}
          </div>
          <LineChartSvg
            buildTooltipRows={(point) => [
              {
                label: "Ahorro del día",
                value: formatCurrency(point.net, currencyCode),
                accentClassName: "text-pine",
              },
              { label: "Acumulado", value: formatCurrency(point.cumulative, currencyCode) },
              {
                label: "Comparativo",
                value: formatCurrency(point.previousCumulative, currencyCode),
              },
            ]}
            fillBottom="rgba(56, 161, 105, 0.02)"
            fillTop="rgba(56, 161, 105, 0.28)"
            gradientId="dashboard-savings-fill"
            lineColor="rgba(56, 161, 105, 0.95)"
            onSelect={onSelect}
            points={points}
            selectedIndex={selectedIndex}
          />
        </div>

        <div className="mt-4 flex flex-wrap justify-between gap-3 border-t border-white/8 pt-4 text-xs text-storm">
          {points
            .filter((_, index) => {
              if (points.length <= 5) {
                return true;
              }

              const step = Math.max(1, Math.floor((points.length - 1) / 4));
              return index === 0 || index === points.length - 1 || index % step === 0;
            })
            .map((point) => (
              <span key={`tick-${point.key}`}>{point.label}</span>
            ))}
        </div>
      </div>

      <div className="glass-panel-soft rounded-[28px] p-5">
        {points[selectedIndex] ? (
          <>
            <p className="text-xs uppercase tracking-[0.22em] text-storm">Detalle del ritmo</p>
            <h4 className="mt-3 font-display text-3xl font-semibold text-ink">
              {points[selectedIndex].fullLabel}
            </h4>
            <p className="mt-2 text-sm text-storm">
              Frente a {fullDateFormatter.format(points[selectedIndex].previousDate)}
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[22px] border border-pine/18 bg-pine/10 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-pine">Ahorro del dia</p>
                <p className="mt-3 font-display text-3xl font-semibold text-ink">
                  {formatCurrency(points[selectedIndex].net, currencyCode)}
                </p>
                <p className="mt-2 text-sm text-storm">
                  Ingresos {formatCurrency(points[selectedIndex].income, currencyCode)} y gastos{" "}
                  {formatCurrency(points[selectedIndex].expense, currencyCode)}.
                </p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-storm">Comparación</p>
                <p className="mt-3 font-display text-3xl font-semibold text-ink">
                  {formatCurrency(points[selectedIndex].previousNet, currencyCode)}
                </p>
                <p className="mt-2 text-sm text-storm">
                  Acumulado actual {formatCurrency(points[selectedIndex].cumulative, currencyCode)}.
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-ink">Cambio frente al comparativo</p>
                <DeltaBadge
                  currencyCode={currencyCode}
                  inverse={false}
                  value={points[selectedIndex].net - points[selectedIndex].previousNet}
                />
              </div>
              <p className="mt-3 text-sm leading-7 text-storm">
                Si mantienes este ritmo, el acumulado del período seguiría en{" "}
                <span className="font-semibold text-ink">
                  {formatCurrency(points[selectedIndex].cumulative, currencyCode)}
                </span>
                .
              </p>
            </div>
          </>
        ) : null}
      </div>
    </div>
      {points[selectedIndex] ? (
        <div className="glass-panel-soft mt-6 rounded-[28px] p-5">
          <DayMovementsBreakdown
            currencyCode={currencyCode}
            movements={dayMovements}
            withTopDivider={false}
          />
        </div>
      ) : null}
    </>
  );
}
