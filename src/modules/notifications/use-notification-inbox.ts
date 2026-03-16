import { useEffect, useMemo, useState } from "react";

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

const SMART_NOTIFICATION_READS_STORAGE_KEY = "darkmoney.notifications.smartReads";

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

type SmartNotificationReadMap = Record<string, string>;

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

function readSmartNotificationReadMap(): SmartNotificationReadMap {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const rawValue = window.localStorage.getItem(SMART_NOTIFICATION_READS_STORAGE_KEY);

    if (!rawValue) {
      return {};
    }

    const parsedValue = JSON.parse(rawValue) as unknown;

    if (!parsedValue || typeof parsedValue !== "object" || Array.isArray(parsedValue)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsedValue as Record<string, unknown>).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    );
  } catch {
    return {};
  }
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

  return notifications;
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
  const [smartReadMap, setSmartReadMap] = useState<SmartNotificationReadMap>(
    readSmartNotificationReadMap,
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      SMART_NOTIFICATION_READS_STORAGE_KEY,
      JSON.stringify(smartReadMap),
    );
  }, [smartReadMap]);

  const smartNotifications = useMemo(
    () => buildSmartNotifications(snapshot, workspaceName),
    [snapshot, workspaceName],
  );

  const mergedNotifications = useMemo(() => {
    const databaseItems = buildDatabaseNotifications(databaseNotifications);
    const smartItems = smartNotifications.map<InboxNotification>((notification) => {
      const readAt = smartReadMap[notification.id] ?? null;

      return {
        ...notification,
        status: readAt ? "read" : "pending",
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
        : smartNotifications.map((notification) => notification.id);

    if (!targetIds.length) {
      return;
    }

    const now = new Date().toISOString();
    setSmartReadMap((currentValue) => {
      const nextValue = { ...currentValue };

      for (const id of targetIds) {
        nextValue[id] = now;
      }

      return nextValue;
    });
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
