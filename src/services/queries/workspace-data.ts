import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { AppProfile } from "../../modules/auth/auth-context";
import type {
  AccountSummary,
  ActivityItem,
  MovementRecord,
  NotificationItem,
  ObligationSummary,
  SubscriptionSummary,
  Workspace,
  WorkspaceKind,
  WorkspaceRole,
} from "../../types/domain";
import { supabase } from "../supabase/client";

type NumericLike = number | string | null;

type WorkspaceMemberRow = {
  workspace_id: number;
  role: WorkspaceRole;
  is_default_workspace: boolean;
  joined_at: string;
};

type WorkspaceRow = {
  id: number;
  owner_user_id: string;
  name: string;
  kind: WorkspaceKind;
  base_currency_code: string | null;
  description: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

type AccountRow = {
  id: number;
  workspace_id: number;
  name: string;
  type: string;
  currency_code: string;
  opening_balance: NumericLike;
  include_in_net_worth: boolean;
  color: string | null;
  icon: string | null;
  is_archived: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type CategoryRow = {
  id: number;
  name: string;
};

type CounterpartyRow = {
  id: number;
  name: string;
};

type MovementRow = {
  id: number;
  workspace_id: number;
  movement_type: MovementRecord["movementType"];
  status: MovementRecord["status"];
  occurred_at: string;
  description: string;
  source_account_id: number | null;
  source_amount: NumericLike;
  destination_account_id: number | null;
  destination_amount: NumericLike;
  category_id: number | null;
  counterparty_id: number | null;
  obligation_id: number | null;
  subscription_id: number | null;
};

type ObligationRow = {
  id: number;
  workspace_id: number;
  direction: ObligationSummary["direction"];
  status: string;
  title: string;
  counterparty_id: number | null;
  currency_code: string;
  principal_amount: NumericLike;
  due_date: string | null;
  installment_count: number | null;
};

type ObligationEventRow = {
  obligation_id: number;
  event_type: string;
  amount: NumericLike;
  installment_no: number | null;
};

type SubscriptionRow = {
  id: number;
  workspace_id: number;
  name: string;
  vendor_party_id: number | null;
  account_id: number | null;
  currency_code: string;
  amount: NumericLike;
  frequency: string;
  interval_count: number;
  next_due_date: string;
  status: SubscriptionSummary["status"];
  remind_days_before: number;
  auto_create_movement: boolean;
};

type ActivityRow = {
  id: number;
  workspace_id: number;
  actor_user_id: string | null;
  entity_type: string;
  action: string;
  description: string;
  created_at: string;
};

type NotificationRow = {
  id: number;
  channel: string;
  status: NotificationItem["status"];
  title: string;
  body: string;
  scheduled_for: string;
  related_entity_type: string | null;
  read_at: string | null;
};

type NotificationPreferencesRow = {
  in_app_enabled: boolean;
  push_enabled: boolean;
  email_enabled: boolean;
};

export type CashflowPoint = {
  label: string;
  income: number;
  expense: number;
};

export type NotificationPreferences = {
  inAppEnabled: boolean;
  pushEnabled: boolean;
  emailEnabled: boolean;
};

export type AccountFormInput = {
  name: string;
  type: string;
  currencyCode: string;
  openingBalance: number;
  includeInNetWorth: boolean;
  color: string;
  icon: string;
};

type AccountMutationInput = AccountFormInput & {
  workspaceId: number;
  userId: string;
  sortOrder: number;
};

type AccountUpdateInput = AccountFormInput & {
  accountId: number;
  workspaceId: number;
  userId: string;
};

type AccountArchiveInput = {
  accountId: number;
  workspaceId: number;
  userId: string;
  isArchived: boolean;
};

type AccountDeleteInput = {
  accountId: number;
  workspaceId: number;
};

export type WorkspaceSnapshot = {
  workspace: Workspace;
  accounts: AccountSummary[];
  movements: MovementRecord[];
  obligations: ObligationSummary[];
  subscriptions: SubscriptionSummary[];
  activity: ActivityItem[];
  cashflow: CashflowPoint[];
  metrics: {
    balance: number;
    archivedCount: number;
    postedCount: number;
    pendingCount: number;
  };
  catalogs: {
    categoriesCount: number;
    counterpartiesCount: number;
  };
};

const defaultAccountColors: Record<string, string> = {
  cash: "#1b6a58",
  bank: "#4566d6",
  savings: "#b48b34",
  credit_card: "#8f3e3e",
  investment: "#8366f2",
  loan_wallet: "#c46a31",
  other: "#6b7280",
};

function getClient() {
  if (!supabase) {
    throw new Error("Supabase no esta configurado.");
  }

  return supabase;
}

function toNumber(value: NumericLike) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function buildDefaultWorkspaceName(profile?: AppProfile | null) {
  const firstName = profile?.fullName
    .trim()
    .split(/\s+/)
    .find(Boolean);

  return firstName ? `${firstName} Personal` : "Mi espacio personal";
}

function buildWorkspace(
  row: WorkspaceRow,
  membership: WorkspaceMemberRow | null,
  userId: string,
  profile?: AppProfile | null,
): Workspace {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    role: membership?.role ?? (row.owner_user_id === userId ? "owner" : "member"),
    description: row.description ?? "",
    baseCurrencyCode: row.base_currency_code ?? profile?.baseCurrencyCode ?? "USD",
    isDefaultWorkspace: membership?.is_default_workspace ?? row.owner_user_id === userId,
    isArchived: row.is_archived,
    joinedAt: membership?.joined_at ?? row.created_at,
    ownerUserId: row.owner_user_id,
  };
}

function getLatestTimestamp(currentValue: string | undefined, nextValue: string) {
  if (!currentValue) {
    return nextValue;
  }

  return new Date(nextValue).getTime() > new Date(currentValue).getTime() ? nextValue : currentValue;
}

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}`;
}

function getMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("es-PE", { month: "short" })
    .format(date)
    .replace(".", "")
    .slice(0, 3)
    .toUpperCase();
}

function buildCashflow(movements: MovementRow[]) {
  const today = new Date();
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth() - (5 - index), 1);
    return {
      key: getMonthKey(date),
      label: getMonthLabel(date),
    };
  });

  const totals = new Map(
    months.map((month) => [
      month.key,
      {
        income: 0,
        expense: 0,
      },
    ]),
  );

  for (const movement of movements) {
    if (movement.status !== "posted") {
      continue;
    }

    const bucket = totals.get(getMonthKey(new Date(movement.occurred_at)));

    if (!bucket) {
      continue;
    }

    const sourceAmount = toNumber(movement.source_amount);
    const destinationAmount = toNumber(movement.destination_amount);

    if (movement.movement_type === "income" || movement.movement_type === "refund") {
      bucket.income += destinationAmount || sourceAmount;
      continue;
    }

    if (
      movement.movement_type === "expense" ||
      movement.movement_type === "subscription_payment" ||
      movement.movement_type === "obligation_payment"
    ) {
      bucket.expense += sourceAmount || destinationAmount;
      continue;
    }

    if (movement.movement_type === "adjustment") {
      if (destinationAmount >= sourceAmount) {
        bucket.income += destinationAmount || sourceAmount;
      } else {
        bucket.expense += sourceAmount || destinationAmount;
      }
    }
  }

  return months.map((month) => {
    const values = totals.get(month.key);

    return {
      label: month.label,
      income: values?.income ?? 0,
      expense: values?.expense ?? 0,
    };
  });
}

async function bootstrapPersonalWorkspace(userId: string, profile?: AppProfile | null) {
  const client = getClient();

  const { data: workspaceRow, error: workspaceError } = await client
    .from("workspaces")
    .insert({
      owner_user_id: userId,
      name: buildDefaultWorkspaceName(profile),
      kind: "personal" as WorkspaceKind,
      base_currency_code: profile?.baseCurrencyCode ?? "USD",
      description: "Workspace personal generado automaticamente por DarkMoney.",
    })
    .select(
      "id, owner_user_id, name, kind, base_currency_code, description, is_archived, created_at, updated_at",
    )
    .single();

  if (workspaceError) {
    throw workspaceError;
  }

  const { error: memberError } = await client.from("workspace_members").insert({
    workspace_id: workspaceRow.id,
    user_id: userId,
    role: "owner" as WorkspaceRole,
    is_default_workspace: true,
  });

  if (memberError) {
    throw memberError;
  }

  return workspaceRow as WorkspaceRow;
}

async function fetchWorkspaces(userId: string, profile?: AppProfile | null) {
  const client = getClient();

  const { data: membershipData, error: membershipError } = await client
    .from("workspace_members")
    .select("workspace_id, role, is_default_workspace, joined_at")
    .eq("user_id", userId)
    .order("is_default_workspace", { ascending: false })
    .order("joined_at", { ascending: true });

  if (membershipError) {
    throw membershipError;
  }

  let memberRows = (membershipData ?? []) as WorkspaceMemberRow[];
  let workspaceRows: WorkspaceRow[] = [];

  if (memberRows.length > 0) {
    const workspaceIds = memberRows.map((row) => row.workspace_id);
    const { data: workspaceData, error: workspaceError } = await client
      .from("workspaces")
      .select("id, owner_user_id, name, kind, base_currency_code, description, is_archived, created_at, updated_at")
      .in("id", workspaceIds)
      .eq("is_archived", false)
      .order("created_at", { ascending: true });

    if (workspaceError) {
      throw workspaceError;
    }

    workspaceRows = (workspaceData ?? []) as WorkspaceRow[];
  } else {
    const { data: ownedWorkspaceData, error: ownedWorkspaceError } = await client
      .from("workspaces")
      .select("id, owner_user_id, name, kind, base_currency_code, description, is_archived, created_at, updated_at")
      .eq("owner_user_id", userId)
      .eq("is_archived", false)
      .order("created_at", { ascending: true });

    if (ownedWorkspaceError) {
      throw ownedWorkspaceError;
    }

    workspaceRows = (ownedWorkspaceData ?? []) as WorkspaceRow[];

    if (workspaceRows.length === 0) {
      const bootstrappedWorkspace = await bootstrapPersonalWorkspace(userId, profile);
      workspaceRows = [bootstrappedWorkspace];
      memberRows = [
        {
          workspace_id: bootstrappedWorkspace.id,
          role: "owner",
          is_default_workspace: true,
          joined_at: bootstrappedWorkspace.created_at,
        },
      ];
    } else {
      memberRows = workspaceRows.map((workspaceRow, index) => ({
        workspace_id: workspaceRow.id,
        role: "owner",
        is_default_workspace: index === 0,
        joined_at: workspaceRow.created_at,
      }));
    }
  }

  return workspaceRows
    .map((workspaceRow) => {
      const membership = memberRows.find((item) => item.workspace_id === workspaceRow.id) ?? null;
      return buildWorkspace(workspaceRow, membership, userId, profile);
    })
    .sort((left, right) => {
      if (left.isDefaultWorkspace && !right.isDefaultWorkspace) {
        return -1;
      }

      if (!left.isDefaultWorkspace && right.isDefaultWorkspace) {
        return 1;
      }

      return left.name.localeCompare(right.name);
    });
}

async function fetchWorkspaceSnapshot(workspace: Workspace, userId: string, profile?: AppProfile | null) {
  const client = getClient();

  const [
    accountsResult,
    categoriesResult,
    counterpartiesResult,
    movementsResult,
    obligationsResult,
    subscriptionsResult,
    activityResult,
  ] = await Promise.all([
    client
      .from("accounts")
      .select(
        "id, workspace_id, name, type, currency_code, opening_balance, include_in_net_worth, color, icon, is_archived, sort_order, created_at, updated_at",
      )
      .eq("workspace_id", workspace.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    client.from("categories").select("id, name").eq("workspace_id", workspace.id),
    client.from("counterparties").select("id, name").eq("workspace_id", workspace.id),
    client
      .from("movements")
      .select(
        "id, workspace_id, movement_type, status, occurred_at, description, source_account_id, source_amount, destination_account_id, destination_amount, category_id, counterparty_id, obligation_id, subscription_id",
      )
      .eq("workspace_id", workspace.id)
      .order("occurred_at", { ascending: false }),
    client
      .from("obligations")
      .select(
        "id, workspace_id, direction, status, title, counterparty_id, currency_code, principal_amount, due_date, installment_count",
      )
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false }),
    client
      .from("subscriptions")
      .select(
        "id, workspace_id, name, vendor_party_id, account_id, currency_code, amount, frequency, interval_count, next_due_date, status, remind_days_before, auto_create_movement",
      )
      .eq("workspace_id", workspace.id)
      .order("next_due_date", { ascending: true }),
    client
      .from("activity_log")
      .select("id, workspace_id, actor_user_id, entity_type, action, description, created_at")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  const resultError =
    accountsResult.error ||
    categoriesResult.error ||
    counterpartiesResult.error ||
    movementsResult.error ||
    obligationsResult.error ||
    subscriptionsResult.error ||
    activityResult.error;

  if (resultError) {
    throw resultError;
  }

  const accountRows = (accountsResult.data ?? []) as AccountRow[];
  const categoryRows = (categoriesResult.data ?? []) as CategoryRow[];
  const counterpartyRows = (counterpartiesResult.data ?? []) as CounterpartyRow[];
  const movementRows = (movementsResult.data ?? []) as MovementRow[];
  const obligationRows = (obligationsResult.data ?? []) as ObligationRow[];
  const subscriptionRows = (subscriptionsResult.data ?? []) as SubscriptionRow[];
  const activityRows = (activityResult.data ?? []) as ActivityRow[];

  let obligationEventRows: ObligationEventRow[] = [];

  if (obligationRows.length > 0) {
    const obligationIds = obligationRows.map((row) => row.id);
    const { data: obligationEventData, error: obligationEventError } = await client
      .from("obligation_events")
      .select("obligation_id, event_type, amount, installment_no")
      .in("obligation_id", obligationIds);

    if (obligationEventError) {
      throw obligationEventError;
    }

    obligationEventRows = (obligationEventData ?? []) as ObligationEventRow[];
  }

  const accountRowMap = new Map(accountRows.map((row) => [row.id, row]));
  const categoryNameMap = new Map(categoryRows.map((row) => [row.id, row.name]));
  const counterpartyNameMap = new Map(counterpartyRows.map((row) => [row.id, row.name]));
  const accountBalanceMap = new Map(accountRows.map((row) => [row.id, toNumber(row.opening_balance)]));
  const accountActivityMap = new Map<number, string>();

  for (const movement of movementRows) {
    if (movement.source_account_id) {
      accountActivityMap.set(
        movement.source_account_id,
        getLatestTimestamp(accountActivityMap.get(movement.source_account_id), movement.occurred_at),
      );
    }

    if (movement.destination_account_id) {
      accountActivityMap.set(
        movement.destination_account_id,
        getLatestTimestamp(
          accountActivityMap.get(movement.destination_account_id),
          movement.occurred_at,
        ),
      );
    }

    if (movement.status !== "posted") {
      continue;
    }

    if (movement.source_account_id) {
      accountBalanceMap.set(
        movement.source_account_id,
        (accountBalanceMap.get(movement.source_account_id) ?? 0) - toNumber(movement.source_amount),
      );
    }

    if (movement.destination_account_id) {
      accountBalanceMap.set(
        movement.destination_account_id,
        (accountBalanceMap.get(movement.destination_account_id) ?? 0) +
          toNumber(movement.destination_amount),
      );
    }
  }

  const accounts = [...accountRows]
    .sort((left, right) => {
      if (left.is_archived !== right.is_archived) {
        return Number(left.is_archived) - Number(right.is_archived);
      }

      if (left.sort_order !== right.sort_order) {
        return left.sort_order - right.sort_order;
      }

      return left.name.localeCompare(right.name);
    })
    .map<AccountSummary>((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      name: row.name,
      type: row.type,
      currencyCode: row.currency_code,
      openingBalance: toNumber(row.opening_balance),
      currentBalance: accountBalanceMap.get(row.id) ?? toNumber(row.opening_balance),
      includeInNetWorth: row.include_in_net_worth,
      lastActivity: accountActivityMap.get(row.id) ?? row.updated_at ?? row.created_at,
      color: row.color ?? defaultAccountColors[row.type] ?? defaultAccountColors.other,
      icon: row.icon ?? row.type,
      isArchived: row.is_archived,
    }));

  const movements = movementRows.map<MovementRecord>((row) => {
    const sourceAccount = row.source_account_id ? accountRowMap.get(row.source_account_id) : null;
    const destinationAccount = row.destination_account_id
      ? accountRowMap.get(row.destination_account_id)
      : null;

    return {
      id: row.id,
      workspaceId: row.workspace_id,
      movementType: row.movement_type,
      status: row.status,
      description: row.description,
      category: row.category_id ? categoryNameMap.get(row.category_id) ?? "Sin categoria" : "Sin categoria",
      counterparty: row.counterparty_id
        ? counterpartyNameMap.get(row.counterparty_id) ?? "Sin contraparte"
        : row.movement_type === "transfer"
          ? "Transferencia interna"
          : "Sin contraparte",
      occurredAt: row.occurred_at,
      sourceAccountId: row.source_account_id,
      sourceAccountName: sourceAccount?.name ?? null,
      sourceCurrencyCode: sourceAccount?.currency_code ?? null,
      sourceAmount: row.source_amount === null ? null : toNumber(row.source_amount),
      destinationAccountId: row.destination_account_id,
      destinationAccountName: destinationAccount?.name ?? null,
      destinationCurrencyCode: destinationAccount?.currency_code ?? null,
      destinationAmount: row.destination_amount === null ? null : toNumber(row.destination_amount),
    };
  });

  const eventsByObligation = new Map<number, ObligationEventRow[]>();

  for (const event of obligationEventRows) {
    const currentEvents = eventsByObligation.get(event.obligation_id) ?? [];
    currentEvents.push(event);
    eventsByObligation.set(event.obligation_id, currentEvents);
  }

  const obligations = obligationRows.map<ObligationSummary>((row) => {
    const obligationEvents = eventsByObligation.get(row.id) ?? [];
    let reductionAmount = 0;
    let additionalAmount = 0;
    let paymentCount = 0;
    let lastInstallmentNo = 0;

    for (const event of obligationEvents) {
      const amount = toNumber(event.amount);

      if (event.event_type === "payment") {
        reductionAmount += amount;
        paymentCount += 1;
        lastInstallmentNo = Math.max(lastInstallmentNo, event.installment_no ?? 0);
        continue;
      }

      if (event.event_type === "discount" || event.event_type === "writeoff") {
        reductionAmount += amount;
        continue;
      }

      if (
        event.event_type === "interest" ||
        event.event_type === "fee" ||
        event.event_type === "adjustment"
      ) {
        additionalAmount += amount;
      }
    }

    const principalAmount = toNumber(row.principal_amount);
    const pendingAmount = Math.max(0, principalAmount + additionalAmount - reductionAmount);
    const progressBase = Math.max(principalAmount + additionalAmount, 0);
    const progressPercent =
      progressBase > 0 ? Math.min(100, Math.round(((progressBase - pendingAmount) / progressBase) * 100)) : 0;
    const installmentLabel =
      row.installment_count && row.installment_count > 0
        ? `${Math.min(lastInstallmentNo || paymentCount, row.installment_count)} de ${row.installment_count} cuotas`
        : paymentCount > 0
          ? `${paymentCount} pagos registrados`
          : "Sin pagos registrados";

    return {
      id: row.id,
      workspaceId: row.workspace_id,
      title: row.title,
      direction: row.direction,
      counterparty: row.counterparty_id
        ? counterpartyNameMap.get(row.counterparty_id) ?? "Sin contraparte"
        : "Sin contraparte",
      status: row.status,
      currencyCode: row.currency_code,
      principalAmount,
      pendingAmount,
      progressPercent,
      dueDate: row.due_date,
      installmentLabel,
    };
  });

  const subscriptions = subscriptionRows.map<SubscriptionSummary>((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    vendor: row.vendor_party_id
      ? counterpartyNameMap.get(row.vendor_party_id) ?? "Sin proveedor"
      : "Sin proveedor",
    status: row.status,
    amount: toNumber(row.amount),
    currencyCode: row.currency_code,
    frequency: row.interval_count > 1 ? `${row.interval_count} x ${row.frequency}` : row.frequency,
    nextDueDate: row.next_due_date,
    remindDaysBefore: row.remind_days_before,
    accountName: row.account_id ? accountRowMap.get(row.account_id)?.name ?? null : null,
    autoCreateMovement: row.auto_create_movement,
  }));

  const activity = activityRows.map<ActivityItem>((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    actor:
      row.actor_user_id === userId
        ? profile?.fullName ?? "Tu"
        : row.actor_user_id
          ? "Miembro"
          : "Sistema",
    action: row.action,
    entity: row.entity_type,
    description: row.description,
    createdAt: row.created_at,
  }));

  const balance = accounts
    .filter((account) => !account.isArchived)
    .reduce((total, account) => total + account.currentBalance, 0);

  return {
    workspace,
    accounts,
    movements,
    obligations,
    subscriptions,
    activity,
    cashflow: buildCashflow(movementRows),
    metrics: {
      balance,
      archivedCount: accounts.filter((account) => account.isArchived).length,
      postedCount: movements.filter((movement) => movement.status === "posted").length,
      pendingCount: movements.filter((movement) => movement.status === "pending").length,
    },
    catalogs: {
      categoriesCount: categoryRows.length,
      counterpartiesCount: counterpartyRows.length,
    },
  };
}

async function fetchNotifications(userId: string) {
  const client = getClient();

  const { data, error } = await client
    .from("notifications")
    .select("id, channel, status, title, body, scheduled_for, related_entity_type, read_at")
    .eq("user_id", userId)
    .order("scheduled_for", { ascending: false })
    .limit(50);

  if (error) {
    throw error;
  }

  return ((data ?? []) as NotificationRow[]).map<NotificationItem>((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    status: row.status,
    scheduledFor: row.scheduled_for,
    kind: row.related_entity_type ?? row.channel,
    channel: row.channel,
    readAt: row.read_at,
  }));
}

async function fetchNotificationPreferences(userId: string) {
  const client = getClient();

  const { data, error } = await client
    .from("notification_preferences")
    .select("in_app_enabled, push_enabled, email_enabled")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const row = data as NotificationPreferencesRow;

  return {
    inAppEnabled: row.in_app_enabled,
    pushEnabled: row.push_enabled,
    emailEnabled: row.email_enabled,
  };
}

async function invalidateWorkspaceSnapshot(
  queryClient: ReturnType<typeof useQueryClient>,
  workspaceId: number,
  userId?: string,
) {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: ["workspace-snapshot", workspaceId, userId],
    }),
    queryClient.invalidateQueries({
      queryKey: ["workspace-snapshot", workspaceId],
      exact: false,
    }),
  ]);
}

export function getQueryErrorMessage(
  error: unknown,
  fallback = "No se pudo cargar la informacion real.",
) {
  if (error instanceof Error) {
    const loweredMessage = error.message.toLowerCase();

    if (
      loweredMessage.includes("row-level security") ||
      loweredMessage.includes("permission denied") ||
      loweredMessage.includes("not authorized")
    ) {
      return `${fallback} Revisa las politicas RLS de Supabase para este usuario.`;
    }

    return error.message;
  }

  return fallback;
}

export function useWorkspacesQuery(userId?: string, profile?: AppProfile | null) {
  return useQuery({
    queryKey: ["workspaces", userId],
    queryFn: () => fetchWorkspaces(userId as string, profile),
    enabled: Boolean(userId),
    placeholderData: (previousData) => previousData,
  });
}

export function useWorkspaceSnapshotQuery(
  workspace: Workspace | null,
  userId?: string,
  profile?: AppProfile | null,
) {
  return useQuery({
    queryKey: ["workspace-snapshot", workspace?.id ?? null, userId],
    queryFn: () => fetchWorkspaceSnapshot(workspace as Workspace, userId as string, profile),
    enabled: Boolean(workspace && userId),
    placeholderData: (previousData) => previousData,
  });
}

export function useNotificationsQuery(userId?: string) {
  return useQuery({
    queryKey: ["notifications", userId],
    queryFn: () => fetchNotifications(userId as string),
    enabled: Boolean(userId),
    placeholderData: (previousData) => previousData,
  });
}

export function useNotificationPreferencesQuery(userId?: string) {
  return useQuery({
    queryKey: ["notification-preferences", userId],
    queryFn: () => fetchNotificationPreferences(userId as string),
    enabled: Boolean(userId),
    placeholderData: (previousData) => previousData,
  });
}

export function useSaveNotificationPreferencesMutation(userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: NotificationPreferences) => {
      if (!userId) {
        throw new Error("No hay sesion activa.");
      }

      const client = getClient();
      const { error } = await client.from("notification_preferences").upsert({
        user_id: userId,
        in_app_enabled: input.inAppEnabled,
        push_enabled: input.pushEnabled,
        email_enabled: input.emailEnabled,
      });

      if (error) {
        throw error;
      }

      return input;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notification-preferences", userId] });
    },
  });
}

export function useCreateAccountMutation(workspaceId?: number, userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AccountMutationInput) => {
      const client = getClient();
      const { error } = await client.from("accounts").insert({
        workspace_id: input.workspaceId,
        created_by_user_id: input.userId,
        updated_by_user_id: input.userId,
        name: input.name.trim(),
        type: input.type,
        currency_code: input.currencyCode.trim().toUpperCase(),
        opening_balance: input.openingBalance,
        include_in_net_worth: input.includeInNetWorth,
        color: input.color,
        icon: input.icon,
        sort_order: input.sortOrder,
        is_archived: false,
      });

      if (error) {
        throw error;
      }
    },
    onSuccess: async () => {
      if (workspaceId) {
        await invalidateWorkspaceSnapshot(queryClient, workspaceId, userId);
      }
    },
  });
}

export function useUpdateAccountMutation(workspaceId?: number, userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AccountUpdateInput) => {
      const client = getClient();
      const { error } = await client
        .from("accounts")
        .update({
          updated_by_user_id: input.userId,
          name: input.name.trim(),
          type: input.type,
          currency_code: input.currencyCode.trim().toUpperCase(),
          opening_balance: input.openingBalance,
          include_in_net_worth: input.includeInNetWorth,
          color: input.color,
          icon: input.icon,
        })
        .eq("id", input.accountId)
        .eq("workspace_id", input.workspaceId);

      if (error) {
        throw error;
      }
    },
    onSuccess: async () => {
      if (workspaceId) {
        await invalidateWorkspaceSnapshot(queryClient, workspaceId, userId);
      }
    },
  });
}

export function useArchiveAccountMutation(workspaceId?: number, userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AccountArchiveInput) => {
      const client = getClient();
      const { error } = await client
        .from("accounts")
        .update({
          updated_by_user_id: input.userId,
          is_archived: input.isArchived,
        })
        .eq("id", input.accountId)
        .eq("workspace_id", input.workspaceId);

      if (error) {
        throw error;
      }
    },
    onSuccess: async () => {
      if (workspaceId) {
        await invalidateWorkspaceSnapshot(queryClient, workspaceId, userId);
      }
    },
  });
}

export function useDeleteAccountMutation(workspaceId?: number, userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AccountDeleteInput) => {
      const client = getClient();
      const { error } = await client
        .from("accounts")
        .delete()
        .eq("id", input.accountId)
        .eq("workspace_id", input.workspaceId);

      if (error) {
        throw error;
      }
    },
    onSuccess: async () => {
      if (workspaceId) {
        await invalidateWorkspaceSnapshot(queryClient, workspaceId, userId);
      }
    },
  });
}

export function useMarkAllNotificationsReadMutation(userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!userId) {
        throw new Error("No hay sesion activa.");
      }

      const client = getClient();
      const { error } = await client
        .from("notifications")
        .update({
          status: "read" as NotificationItem["status"],
          read_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .in("status", ["pending", "sent", "failed"]);

      if (error) {
        throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
    },
  });
}
