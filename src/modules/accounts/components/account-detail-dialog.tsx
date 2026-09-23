import { ArrowDown, ArrowLeftRight, BarChart3, MoreHorizontal, PencilLine } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "../../../components/ui/button";
import { Modal, ModalFooter, ModalHeader } from "../../../components/ui/modal";
import { ModalBody } from "../../../components/ui/modal-body";
import { formatDate } from "../../../lib/formatting/dates";
import { formatCurrency } from "../../../lib/formatting/money";
import type { AccountSummary, MovementRecord } from "../../../types/domain";
import { requestQuickMovement } from "../../movements/lib/quick-movement-event";
import { findAccountInstitution } from "../lib/account-institutions";
import { buildAccountBalanceEvolution } from "../lib/account-balance-evolution";
import { getAccountIcon, getTypePreset } from "../lib/account-options";

type Props = {
  account: AccountSummary;
  movements: MovementRecord[];
  onAnalyze: () => void;
  onArchive: () => void;
  onClose: () => void;
  onEdit: () => void;
  onViewMovements: () => void;
};

function movementAmount(movement: MovementRecord, account: AccountSummary) {
  const incoming = movement.destinationAccountId === account.id;
  return {
    amount: incoming ? movement.destinationAmount ?? 0 : movement.sourceAmount ?? 0,
    currency: incoming ? movement.destinationCurrencyCode ?? account.currencyCode : movement.sourceCurrencyCode ?? account.currencyCode,
    incoming,
  };
}

export function AccountDetailDialog({ account, movements, onAnalyze, onArchive, onClose, onEdit, onViewMovements }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const AccountIcon = getAccountIcon(account.icon, account.type);
  const institution = findAccountInstitution(account.institutionCode);
  const accountMovements = useMemo(
    () => movements
      .filter((movement) => movement.sourceAccountId === account.id || movement.destinationAccountId === account.id)
      .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime()),
    [account.id, movements],
  );
  const balancePoints = useMemo(
    () => buildAccountBalanceEvolution({ accountId: account.id, currentBalance: account.currentBalance, movements: accountMovements }),
    [account.currentBalance, account.id, accountMovements],
  );
  const balanceChart = useMemo(() => {
    const width = 620;
    const height = 110;
    const values = balancePoints.map((point) => point.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = Math.max(1, max - min);
    const start = balancePoints[0]?.timestamp ?? Date.now();
    const end = balancePoints[balancePoints.length - 1]?.timestamp ?? start + 1;
    const duration = Math.max(1, end - start);
    return balancePoints.map((point) => ({
      x: 4 + ((point.timestamp - start) / duration) * (width - 8),
      y: 4 + ((max - point.value) / range) * (height - 8),
    }));
  }, [balancePoints]);
  const subtitle = [institution?.label, getTypePreset(account.type).label, account.currencyCode].filter(Boolean).join(" · ");

  function openMovement(kind: "expense" | "transfer") {
    onClose();
    window.setTimeout(() => requestQuickMovement({ kind, accountId: account.id }), 0);
  }

  return (
    <Modal className="!max-w-[720px] !rounded-[14px] !bg-[#1a1917] !shadow-none !backdrop-blur-none" labelledBy="account-detail-title" onClose={onClose} size="lg">
      <ModalHeader
        accessory={account.isArchived ? <span className="text-xs text-storm">Archivada</span> : null}
        description={subtitle}
        onClose={onClose}
        title={account.name}
        titleId="account-detail-title"
      />
      <ModalBody className="!px-5 !py-5 sm:!px-6">
        <section className="border-b border-white/[0.08] pb-5">
          <div className="flex items-start gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[10px] border border-white/10 text-white" style={{ backgroundColor: account.color }}>
              <AccountIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-storm">Saldo actual</p>
              <p className="mt-1 font-display text-3xl font-semibold tabular-nums tracking-[-0.03em] text-ink">{formatCurrency(account.currentBalance, account.currencyCode)}</p>
              {!account.includeInNetWorth ? <p className="mt-1 text-xs text-storm">No incluida en el patrimonio neto</p> : null}
            </div>
          </div>
          {!account.isArchived ? (
            <div className="mt-5 flex flex-wrap gap-2">
              <Button onClick={() => openMovement("expense")}><ArrowDown className="h-4 w-4" />Nuevo gasto</Button>
              <Button onClick={() => openMovement("transfer")} variant="secondary"><ArrowLeftRight className="h-4 w-4" />Transferir</Button>
            </div>
          ) : null}
        </section>

        <section className="border-b border-white/[0.08] py-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h3 className="font-semibold text-ink">Evolución del saldo</h3>
              <p className="mt-0.5 text-xs text-storm">Últimos 90 días · movimientos confirmados</p>
            </div>
            <button className="text-sm font-medium text-ink hover:text-white" onClick={onAnalyze} type="button">Analizar</button>
          </div>
          <svg aria-label="Evolución del saldo durante los últimos 90 días" className="mt-4 h-[110px] w-full" preserveAspectRatio="none" role="img" viewBox="0 0 620 110">
            <line stroke="rgba(255,255,255,0.08)" x1="4" x2="616" y1="106" y2="106" />
            <polyline fill="none" points={balanceChart.map((point) => `${point.x},${point.y}`).join(" ")} stroke="#d6b69b" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
          </svg>
          <div className="mt-2 flex justify-between text-xs text-storm">
            <span>{formatCurrency(balancePoints[0]?.value ?? account.currentBalance, account.currencyCode)}</span>
            <span>{formatCurrency(account.currentBalance, account.currencyCode)}</span>
          </div>
        </section>

        <section className="pt-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-ink">Movimientos</h3>
              <p className="mt-0.5 text-xs text-storm">{accountMovements.length} vinculados a esta cuenta</p>
            </div>
            <button className="text-sm font-medium text-ink hover:text-white" onClick={onViewMovements} type="button">Ver todos</button>
          </div>
          <div className="mt-3 border-t border-white/[0.08]">
            {accountMovements.length === 0 ? (
              <p className="py-8 text-center text-sm text-storm">Todavía no hay movimientos en esta cuenta.</p>
            ) : accountMovements.slice(0, 8).map((movement) => {
              const display = movementAmount(movement, account);
              return (
                <button className="grid min-h-[58px] w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-white/[0.07] px-1 text-left transition hover:bg-white/[0.025]" key={movement.id} onClick={onViewMovements} type="button">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">{movement.description}</span>
                    <span className="mt-0.5 block truncate text-xs text-storm">{movement.category === "Sin categoria" ? "Sin categoría" : movement.category || "Sin categoría"} · {formatDate(movement.occurredAt)}</span>
                  </span>
                  <span className="text-sm font-semibold text-ink">{display.incoming ? "+" : "−"}{formatCurrency(display.amount, display.currency)}</span>
                </button>
              );
            })}
          </div>
        </section>
      </ModalBody>
      <ModalFooter className="!justify-between">
        <div className="relative">
          <button aria-expanded={menuOpen} aria-label="Mas acciones" className="grid h-9 w-9 place-items-center rounded-[7px] border border-white/[0.08] text-storm hover:bg-white/[0.04] hover:text-ink" onClick={() => setMenuOpen((current) => !current)} type="button"><MoreHorizontal className="h-4 w-4" /></button>
          {menuOpen ? (
            <div className="absolute bottom-11 left-0 z-20 w-48 overflow-hidden rounded-[9px] border border-white/[0.1] bg-[#1a1917]">
              <button className="flex h-10 w-full items-center gap-3 px-4 text-sm text-ink hover:bg-white/[0.04]" onClick={onAnalyze} type="button"><BarChart3 className="h-4 w-4" />Analítica</button>
              <button className="flex h-10 w-full items-center gap-3 border-t border-white/[0.08] px-4 text-sm text-storm hover:bg-white/[0.04] hover:text-ink" onClick={onArchive} type="button">{account.isArchived ? "Reactivar" : "Archivar"}</button>
            </div>
          ) : null}
        </div>
        <Button onClick={onEdit} variant="secondary"><PencilLine className="h-4 w-4" />Editar cuenta</Button>
      </ModalFooter>
    </Modal>
  );
}
