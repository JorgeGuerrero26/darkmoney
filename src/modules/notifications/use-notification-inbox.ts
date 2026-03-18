import { useMemo } from "react";

import { formatCurrency } from "../../lib/formatting/money";
import type { WorkspaceSnapshot } from "../../services/queries/workspace-data";
import type {
  AccountSummary,
  BudgetOverview,
  MovementRecord,
  NotificationItem,
  ObligationSummary,
  SubscriptionSummary,
} from "../../types/domain";
import type { PendingInvite } from "../auth/invite-resume";
import { usePendingInvite } from "../auth/invite-resume";
import { useNotificationReads } from "./notification-reads-context";

type SmartNotificationTone = "info" | "success" | "warning" | "danger" | "neutral";

export type InboxNotification = {
  id: string;
  source: "database" | "smart";
  databaseId?: number;
  title: string;
  body: string;
  status: NotificationItem["status"];
  scheduledFor: string;
  kind: string;
  channel?: string;
  readAt?: string | null;
  tone: SmartNotificationTone;
  href: string;
};

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function getDaysDifference(targetDate: string) {
  const today = startOfDay(new Date()).getTime();
  const target = startOfDay(new Date(targetDate)).getTime();
  return Math.round((target - today) / 86400000);
}

function toTimestamp(date: string, hour = 9) {
  const next = new Date(`${date}T00:00:00`);
  next.setHours(hour, 0, 0, 0);
  return next.toISOString();
}

function sortNotifications(notifications: InboxNotification[]) {
  return [...notifications].sort((left, right) => {
    const leftUnread = left.status !== "read";
    const rightUnread = right.status !== "read";

    if (leftUnread !== rightUnread) {
      return leftUnread ? -1 : 1;
    }

    if (leftUnread) {
      return new Date(left.scheduledFor).getTime() - new Date(right.scheduledFor).getTime();
    }

    return new Date(right.scheduledFor).getTime() - new Date(left.scheduledFor).getTime();
  });
}

function buildDatabaseNotifications(notifications: NotificationItem[]): InboxNotification[] {
  return notifications.map((notification) => ({
    id: `db:${notification.id}`,
    source: "database",
    databaseId: notification.id,
    title: notification.title,
    body: notification.body,
    status: notification.status,
    scheduledFor: notification.scheduledFor,
    kind: notification.kind,
    channel: notification.channel,
    readAt: notification.readAt,
    tone:
      notification.status === "failed"
        ? "danger"
        : notification.status === "read"
          ? "neutral"
          : "info",
    href: "/app/notifications",
  }));
}

function buildSmartNotifications(
  snapshot: WorkspaceSnapshot | null | undefined,
  workspaceName?: string | null,
): InboxNotification[] {
  if (!snapshot) {
    return [];
  }

  const notifications: InboxNotification[] = [];
  const today = startOfDay(new Date());
  const inThreeDays = endOfDay(addDays(today, 3)).getTime();
  const workspaceLabel = workspaceName ?? snapshot.workspace.name;

  const currentBudgets = snapshot.budgets.filter(
    (budget: BudgetOverview) =>
      budget.isActive &&
      budget.periodStart <= today.toISOString().slice(0, 10) &&
      budget.periodEnd >= today.toISOString().slice(0, 10),
  );

  for (const budget of currentBudgets) {
    if (!budget.isNearLimit && !budget.isOverLimit) {
      continue;
    }

    const statusLabel = budget.isOverLimit ? "ya se excedio" : "esta por tocar el limite";
    const description = budget.isOverLimit
      ? `${budget.name} ya supero el tope por ${formatCurrency(Math.abs(budget.remainingAmount), budget.currencyCode)}.`
      : `${budget.name} lleva ${Math.round(budget.usedPercent)}% del limite y ${statusLabel}.`;

    notifications.push({
      id: `smart:budget:${budget.id}:${budget.periodEnd}:${budget.isOverLimit ? "over" : "near"}`,
      source: "smart",
      title: budget.isOverLimit ? "Presupuesto excedido" : "Presupuesto en riesgo",
      body: description,
      status: "pending",
      scheduledFor: toTimestamp(budget.periodEnd, 9),
      kind: "budget",
      channel: "in_app",
      readAt: null,
      tone: budget.isOverLimit ? "danger" : "warning",
      href: "/app/budgets",
    });
  }

  for (const subscription of snapshot.subscriptions.filter(
    (item: SubscriptionSummary) => item.status === "active",
  )) {
    const diffDays = getDaysDifference(subscription.nextDueDate);
    const remindWindow = Math.max(1, subscription.remindDaysBefore);

    if (diffDays > remindWindow || diffDays < -1) {
      continue;
    }

    const title =
      diffDays < 0
        ? "Suscripcion vencida"
        : diffDays === 0
          ? "Suscripcion vence hoy"
          : `Suscripcion vence en ${diffDays} dia${diffDays === 1 ? "" : "s"}`;
    const body =
      diffDays < 0
        ? `${subscription.name} debio cobrarse el ${subscription.nextDueDate} y sigue activa en ${workspaceLabel}.`
        : `${subscription.name} por ${formatCurrency(subscription.amount, subscription.currencyCode)} vence el ${subscription.nextDueDate}.`;

    notifications.push({
      id: `smart:subscription:${subscription.id}:${subscription.nextDueDate}:${Math.max(diffDays, -1)}`,
      source: "smart",
      title,
      body,
      status: "pending",
      scheduledFor: toTimestamp(subscription.nextDueDate, 8),
      kind: "subscription",
      channel: "in_app",
      readAt: null,
      tone: diffDays < 0 ? "danger" : diffDays === 0 ? "warning" : "info",
      href: "/app/subscriptions",
    });
  }

  for (const obligation of snapshot.obligations.filter(
    (item: ObligationSummary) => item.pendingAmount > 0 && item.status !== "paid",
  )) {
    if (!obligation.dueDate) {
      continue;
    }

    const diffDays = getDaysDifference(obligation.dueDate);

    if (diffDays > 3 || diffDays < -1) {
      continue;
    }

    const isReceivable = obligation.direction === "receivable";
    const counterparty = obligation.counterparty || "la contraparte";
    const title =
      diffDays < 0
        ? isReceivable
          ? "Cobro vencido"
          : "Pago vencido"
        : diffDays === 0
          ? isReceivable
            ? "Te deben pagar hoy"
            : "Debes pagar hoy"
          : isReceivable
            ? `Te deben pagar en ${diffDays} dia${diffDays === 1 ? "" : "s"}`
            : `Debes pagar en ${diffDays} dia${diffDays === 1 ? "" : "s"}`;
    const body = isReceivable
      ? `${counterparty} deberia pagarte ${formatCurrency(obligation.pendingAmount, obligation.currencyCode)} por ${obligation.title}.`
      : `Debes pagar ${formatCurrency(obligation.pendingAmount, obligation.currencyCode)} a ${counterparty} por ${obligation.title}.`;

    notifications.push({
      id: `smart:obligation:${obligation.id}:${obligation.dueDate}:${Math.max(diffDays, -1)}`,
      source: "smart",
      title,
      body,
      status: "pending",
      scheduledFor: toTimestamp(obligation.dueDate, 8),
      kind: "obligation",
      channel: "in_app",
      readAt: null,
      tone: diffDays < 0 ? "danger" : diffDays === 0 ? "warning" : "info",
      href: "/app/obligations",
    });
  }

  const uncategorizedMovements = snapshot.movements.filter((movement: MovementRecord) => {
    if (movement.status === "voided" || movement.movementType === "transfer") {
      return false;
    }

    return !movement.categoryId || movement.category === "Sin categoria";
  });

  if (uncategorizedMovements.length >= 3) {
    notifications.push({
      id: `smart:data-quality:uncategorized:${uncategorizedMovements.length}`,
      source: "smart",
      title: "Tienes movimientos sin categoria",
      body: `${uncategorizedMovements.length} registros aun no tienen categoria y eso reduce la calidad de tus comparativos y alertas.`,
      status: "pending",
      scheduledFor: new Date().toISOString(),
      kind: "quality",
      channel: "in_app",
      readAt: null,
      tone: "warning",
      href: "/app/movements",
    });
  }

  const lowBalanceAccounts = snapshot.accounts.filter((account: AccountSummary) => {
    if (account.isArchived || !["cash", "bank", "savings"].includes(account.type)) {
      return false;
    }

    return account.currentBalance <= 50;
  });

  if (lowBalanceAccounts.length > 0) {
    const account = lowBalanceAccounts[0];
    notifications.push({
      id: `smart:account-low:${account.id}:${Math.round(account.currentBalance * 100)}`,
      source: "smart",
      title: "Cuenta con saldo bajo",
      body: `${account.name} esta en ${formatCurrency(account.currentBalance, account.currencyCode)} y podria quedarse corta para los proximos dias.`,
      status: "pending",
      scheduledFor: new Date().toISOString(),
      kind: "account",
      channel: "in_app",
      readAt: null,
      tone: "warning",
      href: "/app/accounts",
    });
  }

  const scheduledMovements = snapshot.movements.filter((movement: MovementRecord) => {
    if (movement.status === "posted" || movement.status === "voided") {
      return false;
    }

    const occurredAt = new Date(movement.occurredAt).getTime();
    return occurredAt >= today.getTime() && occurredAt <= inThreeDays;
  });

  for (const movement of scheduledMovements.slice(0, 3)) {
    const isIncome = movement.movementType === "income" || movement.movementType === "refund";
    const amount = Math.max(
      movement.destinationAmount ?? 0,
      movement.sourceAmount ?? 0,
    );

    notifications.push({
      id: `smart:scheduled-movement:${movement.id}:${movement.occurredAt}:${movement.status}`,
      source: "smart",
      title: isIncome ? "Ingreso pendiente cercano" : "Movimiento pendiente cercano",
      body: `${movement.description} por ${formatCurrency(amount, movement.destinationCurrencyCode ?? movement.sourceCurrencyCode ?? "PEN")} esta programado para los proximos dias.`,
      status: "pending",
      scheduledFor: movement.occurredAt,
      kind: "movement",
      channel: "in_app",
      readAt: null,
      tone: "info",
      href: "/app/movements",
    });
  }

  // ── Cuenta en saldo negativo ───────────────────────────────────────────────
  const negativeAccounts = snapshot.accounts.filter(
    (a: AccountSummary) => !a.isArchived && a.currentBalance < 0,
  );
  for (const account of negativeAccounts) {
    notifications.push({
      id: `smart:account-negative:${account.id}:${Math.round(account.currentBalance * 100)}`,
      source: "smart",
      title: "Cuenta en saldo negativo",
      body: `${account.name} tiene un saldo de ${formatCurrency(account.currentBalance, account.currencyCode)}. Revisa si hay movimientos sin registrar.`,
      status: "pending",
      scheduledFor: new Date().toISOString(),
      kind: "account",
      channel: "in_app",
      readAt: null,
      tone: "danger",
      href: "/app/accounts",
    });
  }

  // ── Sin movimientos en los últimos 30 días ────────────────────────────────
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentMovements = snapshot.movements.filter(
    (m: MovementRecord) =>
      m.status !== "voided" && new Date(m.occurredAt) >= thirtyDaysAgo,
  );
  if (snapshot.movements.length > 0 && recentMovements.length === 0) {
    notifications.push({
      id: `smart:no-recent-movements:${thirtyDaysAgo.toISOString().slice(0, 10)}`,
      source: "smart",
      title: "Sin movimientos recientes",
      body: "No hay movimientos registrados en los ultimos 30 dias. Puede que tus datos esten desactualizados.",
      status: "pending",
      scheduledFor: new Date().toISOString(),
      kind: "movement",
      channel: "in_app",
      readAt: null,
      tone: "warning",
      href: "/app/movements",
    });
  }

  // ── Gastos superan ingresos este mes ──────────────────────────────────────
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const thisMonthMovements = snapshot.movements.filter(
    (m: MovementRecord) =>
      m.status === "posted" && new Date(m.occurredAt) >= startOfMonth,
  );
  const monthlyIncome = thisMonthMovements
    .filter((m: MovementRecord) => m.movementType === "income" || m.movementType === "refund")
    .reduce((sum: number, m: MovementRecord) => sum + (m.destinationAmount ?? m.sourceAmount ?? 0), 0);
  const monthlyExpense = thisMonthMovements
    .filter((m: MovementRecord) => m.movementType === "expense")
    .reduce((sum: number, m: MovementRecord) => sum + (m.sourceAmount ?? 0), 0);
  if (monthlyExpense > 0 && monthlyIncome > 0 && monthlyExpense > monthlyIncome * 1.2) {
    const baseCurrency = snapshot.workspace.baseCurrencyCode;
    notifications.push({
      id: `smart:expense-over-income:${startOfMonth.toISOString().slice(0, 7)}`,
      source: "smart",
      title: "Gastos superan ingresos este mes",
      body: `Este mes gastaste ${formatCurrency(monthlyExpense, baseCurrency)} y recibiste ${formatCurrency(monthlyIncome, baseCurrency)}. Tu balance mensual es negativo.`,
      status: "pending",
      scheduledFor: new Date().toISOString(),
      kind: "movement",
      channel: "in_app",
      readAt: null,
      tone: "warning",
      href: "/app/movements",
    });
  }

  // ── Movimientos en borrador sin confirmar (> 7 días) ─────────────────────
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const staleDraftMovements = snapshot.movements.filter(
    (m: MovementRecord) =>
      (m.status === "planned" || m.status === "pending") &&
      new Date(m.occurredAt) < sevenDaysAgo,
  );
  if (staleDraftMovements.length > 0) {
    notifications.push({
      id: `smart:stale-drafts:${staleDraftMovements.length}:${sevenDaysAgo.toISOString().slice(0, 10)}`,
      source: "smart",
      title: `${staleDraftMovements.length} movimiento${staleDraftMovements.length > 1 ? "s" : ""} sin confirmar`,
      body: `Tenes movimientos en borrador o pendientes de hace mas de una semana que aun no se aplicaron al historial.`,
      status: "pending",
      scheduledFor: new Date().toISOString(),
      kind: "movement",
      channel: "in_app",
      readAt: null,
      tone: "warning",
      href: "/app/movements",
    });
  }

  // ── Obligación en draft (nunca activada) ──────────────────────────────────
  const draftObligations = snapshot.obligations.filter(
    (o: ObligationSummary) => o.status === "draft",
  );
  if (draftObligations.length > 0) {
    notifications.push({
      id: `smart:draft-obligations:${draftObligations.length}`,
      source: "smart",
      title: `${draftObligations.length} credito${draftObligations.length > 1 ? "s/deudas" : "/deuda"} sin activar`,
      body: `Tenes registros en borrador que aun no se activaron. Activalos para que aparezcan en tu seguimiento.`,
      status: "pending",
      scheduledFor: new Date().toISOString(),
      kind: "obligation",
      channel: "in_app",
      readAt: null,
      tone: "info",
      href: "/app/obligations",
    });
  }

  // ── Obligación vencida hace más de 30 días sin acción ────────────────────
  const overdueObligations = snapshot.obligations.filter((o: ObligationSummary) => {
    if (o.status === "paid" || o.status === "cancelled" || !o.dueDate) return false;
    const diffDays = getDaysDifference(o.dueDate);
    return diffDays < -30;
  });
  if (overdueObligations.length > 0) {
    const first = overdueObligations[0];
    notifications.push({
      id: `smart:overdue-obligations:${overdueObligations.length}:${startOfMonth.toISOString().slice(0, 7)}`,
      source: "smart",
      title: overdueObligations.length === 1 ? "Credito/Deuda muy vencido" : `${overdueObligations.length} creditos/deudas muy vencidos`,
      body: overdueObligations.length === 1
        ? `${first.title} lleva mas de 30 dias vencido sin que se registre ningun movimiento.`
        : `Tenes ${overdueObligations.length} registros vencidos hace mas de un mes sin actividad reciente.`,
      status: "pending",
      scheduledFor: new Date().toISOString(),
      kind: "obligation",
      channel: "in_app",
      readAt: null,
      tone: "danger",
      href: "/app/obligations",
    });
  }

  // ── Suscripción sin renovar hace más de 15 días ───────────────────────────
  const staleSubs = snapshot.subscriptions.filter((s: SubscriptionSummary) => {
    if (s.status !== "active") return false;
    return getDaysDifference(s.nextDueDate) < -15;
  });
  if (staleSubs.length > 0) {
    notifications.push({
      id: `smart:stale-subscriptions:${staleSubs.length}`,
      source: "smart",
      title: `${staleSubs.length} suscripcion${staleSubs.length > 1 ? "es" : ""} sin renovar`,
      body: `${staleSubs.length > 1 ? "Varias suscripciones activas llevan" : `${staleSubs[0].name} lleva`} mas de 15 dias vencidas sin que se registre su renovacion.`,
      status: "pending",
      scheduledFor: new Date().toISOString(),
      kind: "subscription",
      channel: "in_app",
      readAt: null,
      tone: "warning",
      href: "/app/subscriptions",
    });
  }

  // ── Presupuesto activo sin uso a mitad del periodo ────────────────────────
  const unusedBudgets = snapshot.budgets.filter((b: BudgetOverview) => {
    if (!b.isActive || b.movementCount > 0) return false;
    const periodStart = new Date(b.periodStart).getTime();
    const periodEnd = new Date(b.periodEnd).getTime();
    const midpoint = periodStart + (periodEnd - periodStart) / 2;
    return today.getTime() > midpoint;
  });
  if (unusedBudgets.length > 0) {
    notifications.push({
      id: `smart:unused-budgets:${unusedBudgets.map((b: BudgetOverview) => b.id).join("-")}`,
      source: "smart",
      title: `${unusedBudgets.length} presupuesto${unusedBudgets.length > 1 ? "s" : ""} sin movimientos`,
      body: `Ya pasaste la mitad del periodo y ${unusedBudgets.length > 1 ? "algunos presupuestos no tienen" : `"${unusedBudgets[0].name}" no tiene`} ningun gasto registrado. Puede que no este bien configurado.`,
      status: "pending",
      scheduledFor: new Date().toISOString(),
      kind: "budget",
      channel: "in_app",
      readAt: null,
      tone: "info",
      href: "/app/budgets",
    });
  }

  // ── Movimientos sin contraparte (≥ 5) ────────────────────────────────────
  const noCounterpartyMovements = snapshot.movements.filter(
    (m: MovementRecord) =>
      m.status !== "voided" &&
      m.movementType !== "transfer" &&
      !m.counterpartyId,
  );
  if (noCounterpartyMovements.length >= 5) {
    notifications.push({
      id: `smart:no-counterparty:${noCounterpartyMovements.length}`,
      source: "smart",
      title: "Movimientos sin contraparte",
      body: `${noCounterpartyMovements.length} movimientos no tienen contraparte asignada. Asignarla mejora tus reportes y filtros.`,
      status: "pending",
      scheduledFor: new Date().toISOString(),
      kind: "quality",
      channel: "in_app",
      readAt: null,
      tone: "info",
      href: "/app/movements",
    });
  }

  return notifications;
}

function buildPendingInviteNotifications(
  pendingInvite: PendingInvite | null,
): InboxNotification[] {
  if (!pendingInvite) {
    return [];
  }

  const isWorkspaceInvite = pendingInvite.kind === "workspace";

  return [
    {
      id: `smart:invite:${pendingInvite.kind}:${pendingInvite.token}`,
      source: "smart",
      title: isWorkspaceInvite
        ? "Tienes un workspace pendiente por aceptar"
        : "Tienes una invitacion pendiente por aceptar",
      body: isWorkspaceInvite
        ? "Retoma la invitacion compartida y confirma tu acceso al workspace sin volver al correo."
        : "Retoma el credito o deuda compartido y confirma el acceso desde la invitacion que dejaste pendiente.",
      status: "pending",
      scheduledFor: pendingInvite.savedAt,
      kind: "invite",
      channel: "in_app",
      readAt: null,
      tone: "info",
      href: pendingInvite.path,
    },
  ];
}

export function useNotificationInbox({
  databaseNotifications,
  snapshot,
  workspaceName,
}: {
  databaseNotifications: NotificationItem[];
  snapshot?: WorkspaceSnapshot | null;
  workspaceName?: string | null;
}) {
  const { smartReadMap, markSmartAsRead } = useNotificationReads();
  const pendingInvite = usePendingInvite();

  const smartNotifications = useMemo(
    () => [
      ...buildPendingInviteNotifications(pendingInvite),
      ...buildSmartNotifications(snapshot, workspaceName),
    ],
    [pendingInvite, snapshot, workspaceName],
  );

  const mergedNotifications = useMemo(() => {
    const databaseItems = buildDatabaseNotifications(databaseNotifications);
    const smartItems = smartNotifications.map<InboxNotification>((notification) => {
      const isInviteNotification = notification.kind === "invite";
      const readAt = isInviteNotification ? null : smartReadMap[notification.id] ?? null;

      return {
        ...notification,
        status: isInviteNotification ? "pending" : readAt ? "read" : "pending",
        readAt,
      };
    });

    return sortNotifications([...smartItems, ...databaseItems]);
  }, [databaseNotifications, smartNotifications, smartReadMap]);

  const unreadCount = mergedNotifications.filter((notification) => notification.status !== "read").length;
  const unreadSmartCount = mergedNotifications.filter(
    (notification) => notification.source === "smart" && notification.status !== "read",
  ).length;
  const unreadDatabaseCount = mergedNotifications.filter(
    (notification) => notification.source === "database" && notification.status !== "read",
  ).length;

  function markSmartNotificationsAsRead(ids?: string[]) {
    const targetIds =
      ids?.length
        ? ids
        : smartNotifications
            .filter((notification) => notification.kind !== "invite")
            .map((notification) => notification.id);

    markSmartAsRead(targetIds);
  }

  return {
    notifications: mergedNotifications,
    smartNotifications,
    unreadCount,
    unreadSmartCount,
    unreadDatabaseCount,
    markSmartNotificationsAsRead,
  };
}
