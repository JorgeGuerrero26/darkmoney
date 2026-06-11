import { Reveal } from "../reveal";

const chartBars = [38, 56, 44, 70, 52, 84, 64, 92, 58, 76, 68, 88];

const fakeMovements = [
  { dot: "bg-pine/70", w1: "w-28", w2: "w-16", amount: "text-pine", amountW: "w-14" },
  { dot: "bg-ember/70", w1: "w-36", w2: "w-20", amount: "text-rosewood", amountW: "w-12" },
  { dot: "bg-gold/70", w1: "w-24", w2: "w-14", amount: "text-pine", amountW: "w-16" },
];

const fakeStats = [
  { label: "Balance total", value: "S/ 12,480", delta: "+8.2%", deltaColor: "text-pine" },
  { label: "Gastos del mes", value: "S/ 2,140", delta: "-3.1%", deltaColor: "text-pine" },
  { label: "Suscripciones", value: "S/ 186", delta: "4 activas", deltaColor: "text-storm" },
];

export function DashboardPreview() {
  return (
    <Reveal className="mx-auto w-full max-w-4xl">
      <div
        aria-hidden="true"
        className="rounded-[30px] bg-[linear-gradient(180deg,rgba(107,228,197,0.18),rgba(255,255,255,0.04)_40%,transparent)] p-px"
      >
        <div className="glass-panel-strong overflow-hidden rounded-[29px] bg-canvas/80">
          <div className="flex items-center gap-1.5 border-b border-white/[0.06] px-5 py-3.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rosewood/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-gold/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-pine/60" />
            <span className="ml-4 h-2 w-40 rounded-full bg-white/[0.06]" />
          </div>

          <div className="flex">
            <div className="hidden w-44 shrink-0 flex-col gap-3 border-r border-white/[0.06] p-5 sm:flex">
              <span className="h-2.5 w-24 rounded-full bg-pine/30" />
              <span className="mt-3 h-2 w-28 rounded-full bg-white/[0.08]" />
              <span className="h-2 w-20 rounded-full bg-white/[0.06]" />
              <span className="h-2 w-24 rounded-full bg-white/[0.06]" />
              <span className="h-2 w-16 rounded-full bg-white/[0.06]" />
              <span className="h-2 w-24 rounded-full bg-white/[0.06]" />
              <span className="h-2 w-20 rounded-full bg-white/[0.06]" />
            </div>

            <div className="flex flex-1 flex-col gap-4 p-5">
              <div className="grid gap-3 sm:grid-cols-3">
                {fakeStats.map((stat) => (
                  <div
                    className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4"
                    key={stat.label}
                  >
                    <p className="text-[10px] uppercase tracking-[0.16em] text-storm/70">
                      {stat.label}
                    </p>
                    <p className="mt-1.5 font-display text-lg font-semibold text-ink">
                      {stat.value}
                    </p>
                    <p className={`mt-0.5 text-[11px] font-medium ${stat.deltaColor}`}>
                      {stat.delta}
                    </p>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
                <div className="flex items-center justify-between">
                  <span className="h-2 w-24 rounded-full bg-white/[0.1]" />
                  <span className="h-2 w-12 rounded-full bg-white/[0.06]" />
                </div>
                <div className="mt-4 flex h-24 items-end gap-1.5">
                  {chartBars.map((height, index) => (
                    <div
                      className="flex-1 rounded-t bg-gradient-to-t from-pine/25 to-pine/70"
                      key={index}
                      style={{ height: `${height}%` }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                {fakeMovements.map((movement, index) => (
                  <div
                    className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
                    key={index}
                  >
                    <span className={`h-7 w-7 shrink-0 rounded-full ${movement.dot} opacity-60`} />
                    <div className="flex flex-1 flex-col gap-1.5">
                      <span className={`h-2 ${movement.w1} rounded-full bg-white/[0.1]`} />
                      <span className={`h-1.5 ${movement.w2} rounded-full bg-white/[0.05]`} />
                    </div>
                    <span
                      className={`h-2 ${movement.amountW} rounded-full bg-current opacity-50 ${movement.amount}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Reveal>
  );
}
