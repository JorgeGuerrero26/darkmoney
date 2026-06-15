import {
  ArrowDownCircle,
  ArrowUpCircle,
  BarChart3,
  TrendingUp,
} from "lucide-react";
import { useMemo } from "react";

import { Button } from "../../../components/ui/button";
import { Modal, ModalFooter, ModalHeader } from "../../../components/ui/modal";
import { ModalBody } from "../../../components/ui/modal-body";
import { formatDate } from "../../../lib/formatting/dates";
import { formatCurrency } from "../../../lib/formatting/money";
import type { AccountSummary, MovementRecord } from "../../../types/domain";
import { getTypePreset } from "../lib/account-options";

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthLabel(key: string) {
  const [year, month] = key.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("es", { month: "short", year: "2-digit" });
}

function getLast6MonthKeys() {
  const keys: string[] = [];
  const now = new Date();

  for (let index = 5; index >= 0; index -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    keys.push(getMonthKey(date));
  }

  return keys;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function BalanceLineChart({
  color,
  currencyCode,
  points,
}: {
  color: string;
  currencyCode: string;
  points: Array<{ label: string; balance: number }>;
}) {
  if (points.length < 2) {
    return (
      <p className="py-8 text-center text-sm text-storm">
        Necesitas al menos 2 movimientos para ver la evolucion.
      </p>
    );
  }

  const width = 580;
  const height = 180;
  const paddingX = 16;
  const paddingY = 20;
  const balances = points.map((point) => point.balance);
  const maxBalance = Math.max(...balances);
  const minBalance = Math.min(...balances);
  const range = Math.max(1, maxBalance - minBalance);
  const stepX = (width - paddingX * 2) / (points.length - 1);
  const getY = (value: number) =>
    paddingY + ((maxBalance - value) / range) * (height - paddingY * 2);
  const coordinates = points.map((point, index) => ({
    ...point,
    x: paddingX + stepX * index,
    y: getY(point.balance),
  }));
  const linePath = coordinates.map((coord) => `${coord.x},${coord.y}`).join(" ");
  const areaPath = `${paddingX},${height - paddingY} ${linePath} ${
    paddingX + stepX * (points.length - 1)
  },${height - paddingY}`;
  const chartColor = color || "#6be4c5";
  const gradientId = `acct-fill-${chartColor.replace("#", "")}`;

  return (
    <div className="overflow-x-auto">
      <svg
        className="min-w-[380px] w-full"
        height={height}
        preserveAspectRatio="none"
        viewBox={`0 0 ${width} ${height}`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={`${chartColor}44`} />
            <stop offset="100%" stopColor={`${chartColor}04`} />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((step) => (
          <line
            key={step}
            stroke="rgba(255,255,255,0.07)"
            strokeDasharray="4 6"
            x1={paddingX}
            x2={width - paddingX}
            y1={paddingY + (height - paddingY * 2) * step}
            y2={paddingY + (height - paddingY * 2) * step}
          />
        ))}
        <polygon fill={`url(#${gradientId})`} points={areaPath} />
        <polyline
          fill="none"
          points={linePath}
          stroke={chartColor}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.5"
        />
        {coordinates.map((coord) => (
          <g key={`${coord.label}-${coord.x}`}>
            <title>{`${coord.label}: ${formatCurrency(coord.balance, currencyCode)}`}</title>
            <circle cx={coord.x} cy={coord.y} fill={chartColor} opacity="0.9" r="4" />
          </g>
        ))}
      </svg>
      <div className="mt-2 flex justify-between gap-3 px-2">
        <span className="text-[0.62rem] text-storm">{points[0].label}</span>
        <span className="text-[0.62rem] text-storm">{points[points.length - 1].label}</span>
      </div>
      <div className="mt-1 flex justify-between gap-3 px-2">
        <span className="text-xs font-medium text-storm">
          {formatCurrency(balances[0], currencyCode)}
        </span>
        <span className="text-xs font-medium text-storm">
          {formatCurrency(balances[balances.length - 1], currencyCode)}
        </span>
      </div>
    </div>
  );
}

function MonthlyFlowChart({
  currencyCode,
  months,
}: {
  currencyCode: string;
  months: Array<{ key: string; income: number; expense: number }>;
}) {
  const maxValue = Math.max(1, ...months.flatMap((month) => [month.income, month.expense]));

  return (
    <div className="mt-4 flex h-36 items-end gap-2">
      {months.map((month) => {
        const incomeHeight = clamp((month.income / maxValue) * 120, 0, 120);
        const expenseHeight = clamp((month.expense / maxValue) * 120, 0, 120);

        return (
          <div className="flex min-w-0 flex-1 flex-col items-center gap-1" key={month.key}>
            <div className="flex w-full items-end gap-0.5" style={{ height: 120 }}>
              <div
                className="flex-1 rounded-t-[4px] bg-pine/70"
                style={{ height: incomeHeight || 2, minHeight: 2 }}
                title={`Ingresos: ${formatCurrency(month.income, currencyCode)}`}
              />
              <div
                className="flex-1 rounded-t-[4px] bg-ember/70"
                style={{ height: expenseHeight || 2, minHeight: 2 }}
                title={`Gastos: ${formatCurrency(month.expense, currencyCode)}`}
              />
            </div>
            <span className="truncate text-[0.58rem] text-storm">{getMonthLabel(month.key)}</span>
          </div>
        );
      })}
    </div>
  );
}

function CategoryBars({
  currencyCode,
  items,
}: {
  currencyCode: string;
  items: Array<{ name: string; amount: number }>;
}) {
  const maxValue = Math.max(1, ...items.map((item) => item.amount));

  return (
    <div className="mt-4 space-y-3">
      {items.map((item) => (
        <div key={item.name}>
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-xs text-storm">{item.name}</span>
            <span className="shrink-0 text-xs font-medium text-ink">
              {formatCurrency(item.amount, currencyCode)}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-white/[0.07]">
            <div
              className="h-full rounded-full bg-ember/70"
              style={{ width: `${(item.amount / maxValue) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

type AccountAnalyticsModalProps = {
  account: AccountSummary;
  movements: MovementRecord[];
  onClose: () => void;
};

export function AccountAnalyticsModal({
  account,
  movements,
  onClose,
}: AccountAnalyticsModalProps) {
  const accountMovements = useMemo(
    () =>
      movements.filter(
        (movement) =>
          movement.status !== "voided" &&
          (movement.sourceAccountId === account.id ||
            movement.destinationAccountId === account.id),
      ),
    [account.id, movements],
  );
  const postedMovements = useMemo(
    () => accountMovements.filter((movement) => movement.status === "posted"),
    [accountMovements],
  );
  const { totalIn, totalOut } = useMemo(() => {
    let incoming = 0;
    let outgoing = 0;

    for (const movement of postedMovements) {
      if (movement.destinationAccountId === account.id && movement.destinationAmount !== null) {
        incoming += movement.destinationAmount;
      }
      if (movement.sourceAccountId === account.id && movement.sourceAmount !== null) {
        outgoing += movement.sourceAmount;
      }
    }

    return { totalIn: incoming, totalOut: outgoing };
  }, [account.id, postedMovements]);
  const netFlow = totalIn - totalOut;
  const balancePoints = useMemo(() => {
    const monthDeltas = new Map<string, number>();
    const sortedMovements = [...postedMovements].sort(
      (left, right) =>
        new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime(),
    );

    for (const movement of sortedMovements) {
      const key = getMonthKey(new Date(movement.occurredAt));
      const inflow =
        movement.destinationAccountId === account.id ? movement.destinationAmount ?? 0 : 0;
      const outflow = movement.sourceAccountId === account.id ? movement.sourceAmount ?? 0 : 0;
      monthDeltas.set(key, (monthDeltas.get(key) ?? 0) + inflow - outflow);
    }

    if (monthDeltas.size === 0) {
      return [];
    }

    let runningBalance = account.openingBalance;
    return [...monthDeltas.keys()].sort().map((key) => {
      runningBalance += monthDeltas.get(key) ?? 0;
      return { label: getMonthLabel(key), balance: runningBalance };
    });
  }, [account.id, account.openingBalance, postedMovements]);
  const monthlyFlow = useMemo(() => {
    const result = getLast6MonthKeys().map((key) => ({ key, income: 0, expense: 0 }));

    for (const movement of postedMovements) {
      const slot = result.find((item) => item.key === getMonthKey(new Date(movement.occurredAt)));

      if (!slot) {
        continue;
      }

      const isExpense = ["expense", "subscription_payment"].includes(movement.movementType);
      const isIncome = ["income", "refund"].includes(movement.movementType);

      if (movement.destinationAccountId === account.id && isIncome) {
        slot.income += movement.destinationAmount ?? 0;
      }
      if (movement.sourceAccountId === account.id && isExpense) {
        slot.expense += movement.sourceAmount ?? 0;
      }
    }

    return result;
  }, [account.id, postedMovements]);
  const topCategories = useMemo(() => {
    const categoryMap = new Map<string, number>();

    for (const movement of postedMovements) {
      if (movement.sourceAccountId !== account.id) {
        continue;
      }
      if (!["expense", "subscription_payment"].includes(movement.movementType)) {
        continue;
      }

      const name = movement.category || "Sin categoria";
      categoryMap.set(name, (categoryMap.get(name) ?? 0) + (movement.sourceAmount ?? 0));
    }

    return [...categoryMap.entries()]
      .map(([name, amount]) => ({ name, amount }))
      .sort((left, right) => right.amount - left.amount)
      .slice(0, 5);
  }, [account.id, postedMovements]);
  const recentMovements = useMemo(
    () =>
      [...accountMovements]
        .sort(
          (left, right) =>
            new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime(),
        )
        .slice(0, 8),
    [accountMovements],
  );
  const metricCards = [
    {
      icon: ArrowUpCircle,
      label: "Entradas",
      tone: "success" as const,
      value: formatCurrency(totalIn, account.currencyCode),
    },
    {
      icon: ArrowDownCircle,
      label: "Salidas",
      tone: "danger" as const,
      value: formatCurrency(totalOut, account.currencyCode),
    },
    {
      icon: TrendingUp,
      label: "Flujo neto",
      tone: netFlow >= 0 ? ("success" as const) : ("danger" as const),
      value: formatCurrency(netFlow, account.currencyCode),
    },
    {
      icon: BarChart3,
      label: "Movimientos",
      tone: "neutral" as const,
      value: String(accountMovements.length),
    },
  ];

  return (
    <Modal labelledBy="account-analytics-title" onClose={onClose} size="xl">
      <ModalHeader
        accessory={
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-ink">
            {formatCurrency(account.currentBalance, account.currencyCode)}
          </span>
        }
        description={`${getTypePreset(account.type).label} - ${account.currencyCode}`}
        onClose={onClose}
        title={account.name}
        titleId="account-analytics-title"
      />
      <ModalBody className="space-y-5">
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr))]">
          {metricCards.map(({ icon: Icon, label, tone, value }) => (
            <article
              className="rounded-[20px] border border-white/10 bg-[#0b111b]/96 px-4 py-4"
              key={label}
            >
              <div className="mb-3 flex items-center gap-2">
                <Icon
                  className={`h-4 w-4 ${
                    tone === "success"
                      ? "text-pine"
                      : tone === "danger"
                        ? "text-ember"
                        : "text-storm"
                  }`}
                />
                <span className="text-[0.62rem] uppercase tracking-[0.2em] text-storm">
                  {label}
                </span>
              </div>
              <p
                className={`break-words font-display text-xl font-semibold ${
                  tone === "success"
                    ? "text-pine"
                    : tone === "danger"
                      ? "text-ember"
                      : "text-ink"
                }`}
              >
                {value}
              </p>
            </article>
          ))}
        </div>

        <section className="rounded-[24px] border border-white/10 bg-white/[0.025] p-4 sm:p-5">
          <h3 className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-storm">
            Saldo en el tiempo
          </h3>
          <p className="mt-1 text-xs leading-5 text-storm">
            Evolucion mensual del saldo partiendo del saldo inicial.
          </p>
          <div className="mt-4">
            <BalanceLineChart
              color={account.color}
              currencyCode={account.currencyCode}
              points={balancePoints}
            />
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-[24px] border border-white/10 bg-white/[0.025] p-4 sm:p-5">
            <h3 className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-storm">
              Flujo mensual
            </h3>
            <p className="mt-1 text-xs leading-5 text-storm">Ultimos 6 meses, entradas vs salidas.</p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-[0.65rem] text-storm">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-pine/70" />
                Entradas
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-ember/70" />
                Salidas
              </span>
            </div>
            <MonthlyFlowChart currencyCode={account.currencyCode} months={monthlyFlow} />
          </section>

          <section className="rounded-[24px] border border-white/10 bg-white/[0.025] p-4 sm:p-5">
            <h3 className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-storm">
              Top categorias de gasto
            </h3>
            <p className="mt-1 text-xs leading-5 text-storm">
              Categorias con mayor volumen de salidas.
            </p>
            {topCategories.length > 0 ? (
              <CategoryBars currencyCode={account.currencyCode} items={topCategories} />
            ) : (
              <p className="mt-6 text-center text-sm text-storm">Sin gastos categorizados aun.</p>
            )}
          </section>
        </div>

        <section className="rounded-[24px] border border-white/10 bg-white/[0.025] p-4 sm:p-5">
          <h3 className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-storm">
            Movimientos recientes
          </h3>
          {recentMovements.length === 0 ? (
            <p className="py-4 text-center text-sm text-storm">
              No hay movimientos registrados para esta cuenta.
            </p>
          ) : (
            <div className="mt-4 space-y-2">
              {recentMovements.map((movement) => {
                const isIn = movement.destinationAccountId === account.id;
                const amount = isIn
                  ? movement.destinationAmount ?? 0
                  : movement.sourceAmount ?? 0;
                const currency = isIn
                  ? movement.destinationCurrencyCode ?? account.currencyCode
                  : movement.sourceCurrencyCode ?? account.currencyCode;

                return (
                  <div
                    className="grid gap-3 rounded-[16px] border border-white/[0.06] bg-black/10 px-3 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
                    key={movement.id}
                  >
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                        isIn ? "bg-pine/16 text-pine" : "bg-ember/16 text-ember"
                      }`}
                    >
                      {isIn ? (
                        <ArrowUpCircle className="h-4 w-4" />
                      ) : (
                        <ArrowDownCircle className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="break-words text-sm font-medium text-ink">
                        {movement.description}
                      </p>
                      <p className="mt-0.5 text-xs text-storm">
                        {movement.category !== "Sin categoria" ? `${movement.category} - ` : ""}
                        {formatDate(new Date(movement.occurredAt).toISOString())}
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className={`text-sm font-semibold ${isIn ? "text-pine" : "text-ember"}`}>
                        {isIn ? "+" : "-"}
                        {formatCurrency(amount, currency)}
                      </p>
                      <p className="text-[0.6rem] uppercase tracking-[0.15em] text-storm">
                        {movement.status}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </ModalBody>
      <ModalFooter>
        <Button onClick={onClose} variant="ghost">
          Cerrar
        </Button>
      </ModalFooter>
    </Modal>
  );
}
