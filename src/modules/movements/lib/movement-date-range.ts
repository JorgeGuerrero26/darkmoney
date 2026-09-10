export type MovementDateRange = {
  from: string;
  to: string;
};

export type MovementDatePreset = MovementDateRange & {
  key: string;
  label: string;
};

const PERU_OFFSET_MS = 5 * 60 * 60 * 1000;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function formatUtcDate(date: Date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function monthRange(referenceDate: Date, monthOffset: number): MovementDateRange {
  const peruDate = new Date(referenceDate.getTime() - PERU_OFFSET_MS);
  const year = peruDate.getUTCFullYear();
  const month = peruDate.getUTCMonth() + monthOffset;

  return {
    from: formatUtcDate(new Date(Date.UTC(year, month, 1))),
    to: formatUtcDate(new Date(Date.UTC(year, month + 1, 0))),
  };
}

export function buildMovementDatePresets(referenceDate = new Date()): MovementDatePreset[] {
  const currentMonth = monthRange(referenceDate, 0);
  const previousMonth = monthRange(referenceDate, -1);
  const threeMonthsAgo = monthRange(referenceDate, -2);
  const sixMonthsAgo = monthRange(referenceDate, -5);

  return [
    { key: "current-month", label: "Este mes", ...currentMonth },
    { key: "previous-month", label: "Mes anterior", ...previousMonth },
    {
      key: "last-three-months",
      label: "Últimos 3 meses",
      from: threeMonthsAgo.from,
      to: currentMonth.to,
    },
    {
      key: "last-six-months",
      label: "Últimos 6 meses",
      from: sixMonthsAgo.from,
      to: currentMonth.to,
    },
    {
      key: "current-year",
      label: "Este año",
      from: `${currentMonth.from.slice(0, 4)}-01-01`,
      to: currentMonth.to,
    },
  ];
}

export function getCurrentMonthDateRange(referenceDate = new Date()): MovementDateRange {
  const preset = buildMovementDatePresets(referenceDate)[0];
  return { from: preset.from, to: preset.to };
}

export function getMovementDateRangeLabel(
  from: string,
  to: string,
  presets = buildMovementDatePresets(),
) {
  if (!from && !to) return "Todo";
  return presets.find((preset) => preset.from === from && preset.to === to)?.label ?? "Rango personalizado";
}

export function movementDateInPeru(occurredAt: string) {
  if (DATE_ONLY_PATTERN.test(occurredAt)) return occurredAt;
  const timestamp = new Date(occurredAt).getTime();
  if (!Number.isFinite(timestamp)) return "";
  return new Date(timestamp - PERU_OFFSET_MS).toISOString().slice(0, 10);
}
