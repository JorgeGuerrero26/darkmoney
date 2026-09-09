import {
  ArrowLeftRight,
  CreditCard,
  House,
  LayoutGrid,
  Scale,
} from "lucide-react";

const movements = [
  {
    amount: "− 45.00",
    label: "Yape a Lucía",
    meta: "Hoy · Cuenta Principal",
    positive: false,
  },
  {
    amount: "+ 2,630.50",
    label: "Sueldo AGV",
    meta: "Ayer · Cuenta Sueldo",
    positive: true,
  },
  {
    amount: "− 32.90",
    label: "Rappi",
    meta: "Ayer · Alimentación",
    positive: false,
  },
  {
    amount: "− 4.00",
    label: "Moto",
    meta: "Ayer · Transporte",
    positive: false,
  },
];

const navigation = [House, ArrowLeftRight, CreditCard, Scale, LayoutGrid];

export function DashboardPreview() {
  return (
    <div
      aria-label="Vista previa de la aplicación DarkMoney"
      className="mx-auto w-[min(100%,340px)] rounded-[46px] bg-[#080807] p-[10px] shadow-[0_30px_70px_rgba(0,0,0,0.5)]"
    >
      <div className="font-public-body relative h-[660px] overflow-hidden rounded-[37px] bg-[#141312] text-[#f4f1ec]">
        <div className="absolute left-1/2 top-2 z-20 h-[26px] w-[92px] -translate-x-1/2 rounded-full bg-[#080807]" />

        <div className="font-public-display flex h-11 items-center justify-between px-[22px] text-xs font-semibold tabular-nums">
          <span>9:41</span>
          <div className="flex items-end gap-1">
            <div className="flex items-end gap-[2px]" aria-hidden="true">
              <i className="block h-1 w-[3px] rounded-sm bg-[#f4f1ec]" />
              <i className="block h-1.5 w-[3px] rounded-sm bg-[#f4f1ec]" />
              <i className="block h-2 w-[3px] rounded-sm bg-[#f4f1ec]" />
            </div>
            <div className="h-[10px] w-5 rounded-[3px] border border-[#f4f1ec]/50 p-[2px]">
              <div className="h-full w-[62%] rounded-[1px] bg-[#f4f1ec]" />
            </div>
          </div>
        </div>

        <div className="flex h-10 items-center justify-between px-[18px]">
          <span className="font-public-display text-[15px] font-semibold tracking-[-0.015em]">
            Inicio
          </span>
          <span className="font-public-display flex h-[26px] w-[26px] items-center justify-center rounded-lg bg-[#f4f1ec] text-[10px] font-semibold text-[#141312]">
            AG
          </span>
        </div>

        <div className="flex flex-col gap-[5px] px-[18px] pt-[14px]">
          <span className="text-[10px] font-medium uppercase tracking-[0.11em] text-[#a39c90]">
            Disponible hoy
          </span>
          <strong className="font-public-display text-[34px] leading-none tracking-[-0.035em] tabular-nums">
            S/ 4,226.92
          </strong>
          <span className="text-[11.5px] leading-[1.4] text-[#a39c90]">
            En 3 cuentas. Comprometido este mes:{" "}
            <span className="text-[#f4f1ec] tabular-nums">S/ 1,180</span>.
          </span>
        </div>

        <div className="px-[18px] pt-4">
          <div className="flex items-baseline justify-between pb-0.5 text-[10px] uppercase tracking-[0.11em] text-[#a39c90]">
            <span className="font-medium">Movimientos</span>
            <span className="text-[11px] normal-case tracking-normal text-[#c4beb4]">
              Ver todos
            </span>
          </div>
          {movements.map((movement) => (
            <div
              className="flex h-[50px] items-center gap-2.5 border-b border-[#f4f1ec]/[0.07] last:border-b-0"
              key={movement.label}
            >
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[13px] font-medium leading-[1.2] text-[#f4f1ec]">
                  {movement.label}
                </span>
                <span className="text-[10.5px] leading-none text-[#8e877c]">
                  {movement.meta}
                </span>
              </div>
              <strong
                className={`font-public-display flex-none text-[13.5px] font-semibold tabular-nums ${
                  movement.positive ? "text-[#86ce96]" : "text-[#f4f1ec]"
                }`}
              >
                {movement.amount}
              </strong>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 px-[18px] pt-3">
          <span className="text-[10px] font-medium uppercase tracking-[0.11em] text-[#a39c90]">
            Alimentación · septiembre
          </span>
          <div className="flex items-baseline gap-[7px]">
            <strong className="font-public-display text-[17px] font-semibold tabular-nums">
              S/ 322.12
            </strong>
            <span className="text-[11.5px] text-[#a39c90]">de S/ 400.00</span>
          </div>
          <div className="relative h-[5px] overflow-hidden rounded-full bg-[#252320]">
            <div className="h-full w-[81%] bg-[#c4beb4]" />
            <i className="absolute -bottom-0.5 -top-0.5 left-[27%] block w-[1.5px] bg-[#f4f1ec]/45" />
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 z-10 flex h-[60px] items-start border-t border-[#f4f1ec]/[0.09] bg-[#141312]/95 px-3 pt-3">
          {navigation.map((Icon, index) => (
            <div
              className="flex flex-1 flex-col items-center gap-1 text-[#a39c90] first:text-[#f4f1ec]"
              key={Icon.displayName ?? index}
            >
              <Icon
                aria-hidden="true"
                className="h-[18px] w-[18px]"
                strokeWidth={1.8}
              />
              {index === 0 ? <i className="block h-[3.5px] w-[3.5px] rounded-full bg-current" /> : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
