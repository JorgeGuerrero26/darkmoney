import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { AppProfile } from "../../modules/auth/auth-context";
import type {
  AccountSummary,
  AttachmentEntityType,
  AttachmentSummary,
  ActivityItem,
  BudgetOverview,
  CategoryOverview,
  CategorySummary,
  CounterpartyOverview,
  CounterpartyRoleType,
  CounterpartySummary,
  ExchangeRateSummary,
  JsonValue,
  MovementRecord,
  NotificationItem,
  ObligationShareInviteDetails,
  ObligationShareSummary,
  ObligationEventSummary,
  ObligationOriginType,
  SharedObligationSummary,
  ObligationStatus,
  ObligationSummary,
  SubscriptionFrequency,
  SubscriptionSummary,
  UserEntitlementSummary,
  WorkspaceCollaborationSummary,
  WorkspaceInvitationDetails,
  WorkspaceInvitationStatus,
  WorkspaceInvitationSummary,
  Workspace,
  WorkspaceKind,
  WorkspaceMemberSummary,
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
  workspace_id: number;
  name: string;
  kind: CategorySummary["kind"];
  parent_id: number | null;
  color: string | null;
  icon: string | null;
  sort_order: number;
  is_system: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type BudgetProgressRow = {
  id: number;
  workspace_id: number;
  created_by_user_id: string | null;
  updated_by_user_id: string | null;
  name: string;
  period_start: string;
  period_end: string;
  currency_code: string;
  category_id: number | null;
  category_name: string | null;
  account_id: number | null;
  account_name: string | null;
  scope_kind: BudgetOverview["scopeKind"];
  scope_label: string;
  limit_amount: NumericLike;
  spent_amount: NumericLike;
  remaining_amount: NumericLike;
  used_percent: NumericLike;
  alert_percent: NumericLike;
  movement_count: number | null;
  rollover_enabled: boolean;
  notes: string | null;
  is_active: boolean;
  is_near_limit: boolean;
  is_over_limit: boolean;
  created_at: string;
  updated_at: string;
};

type CounterpartyRow = {
  id: number;
  workspace_id: number;
  name: string;
  type: CounterpartySummary["type"];
  phone: string | null;
  email: string | null;
  document_number: string | null;
  notes: string | null;
  is_archived: boolean;
};

type CounterpartyRoleRow = {
  id: number;
  workspace_id: number;
  counterparty_id: number;
  role_type: CounterpartyRoleType;
  notes: string | null;
};

type CounterpartySummaryRow = {
  workspace_id: number;
  counterparty_id: number;
  name: string;
  type: CounterpartySummary["type"];
  phone: string | null;
  email: string | null;
  document_number: string | null;
  notes: string | null;
  is_archived: boolean;
  roles: string[] | null;
  receivable_count: number | null;
  receivable_principal_total: NumericLike;
  receivable_pending_total: NumericLike;
  payable_count: number | null;
  payable_principal_total: NumericLike;
  payable_pending_total: NumericLike;
  net_pending_amount: NumericLike;
  movement_count: number | null;
  inflow_total: NumericLike;
  outflow_total: NumericLike;
  net_flow_amount: NumericLike;
  last_activity_at: string | null;
};

type MovementRow = {
  id: number;
  workspace_id: number;
  movement_type: MovementRecord["movementType"];
  status: MovementRecord["status"];
  occurred_at: string;
  description: string;
  notes: string | null;
  source_account_id: number | null;
  source_amount: NumericLike;
  destination_account_id: number | null;
  destination_amount: NumericLike;
  fx_rate: NumericLike;
  category_id: number | null;
  counterparty_id: number | null;
  obligation_id: number | null;
  subscription_id: number | null;
  metadata: JsonValue | null;
};

type ObligationRow = {
  id: number;
  workspace_id: number;
  direction: ObligationSummary["direction"];
  origin_type: ObligationOriginType;
  status: ObligationStatus;
  title: string;
  counterparty_id: number | null;
  settlement_account_id: number | null;
  currency_code: string;
  principal_amount: NumericLike;
  start_date: string;
  due_date: string | null;
  installment_amount: NumericLike;
  installment_count: number | null;
  interest_rate: NumericLike;
  description: string | null;
  notes: string | null;
};

type ObligationEventRow = {
  id: number;
  obligation_id: number;
  event_type: ObligationEventSummary["eventType"];
  event_date: string;
  amount: NumericLike;
  installment_no: number | null;
  reason: string | null;
  description: string | null;
  notes: string | null;
  movement_id: number | null;
  created_by_user_id: string | null;
  metadata: JsonValue | null;
};

type ObligationShareRow = {
  id: number;
  workspace_id: number;
  obligation_id: number;
  owner_user_id: string;
  invited_by_user_id: string;
  invited_user_id: string;
  owner_display_name: string | null;
  invited_display_name: string | null;
  invited_email: string;
  status: ObligationShareSummary["status"];
  token: string;
  message: string | null;
  accepted_at: string | null;
  responded_at: string | null;
  last_sent_at: string | null;
  created_at: string;
  updated_at: string;
};

type SubscriptionRow = {
  id: number;
  workspace_id: number;
  name: string;
  vendor_party_id: number | null;
  account_id: number | null;
  category_id: number | null;
  currency_code: string;
  amount: NumericLike;
  frequency: SubscriptionFrequency;
  interval_count: number;
  day_of_month: number | null;
  day_of_week: number | null;
  start_date: string;
  next_due_date: string;
  end_date: string | null;
  status: SubscriptionSummary["status"];
  remind_days_before: number;
  auto_create_movement: boolean;
  description: string | null;
  notes: string | null;
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

type AttachmentRow = {
  id: number;
  workspace_id: number;
  entity_type: AttachmentEntityType;
  entity_id: number;
  bucket_name: string;
  file_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  uploaded_by_user_id: string;
  created_at: string;
};

type ObligationShareInviteFunctionResponse = {
  ok: boolean;
  error?: string | null;
  alreadyAccepted?: boolean;
  shareId?: number | null;
  status?: ObligationShareSummary["status"] | null;
  shareUrl?: string | null;
  emailSent?: boolean;
  emailError?: string | null;
  invitedEmail?: string | null;
  invitedDisplayName?: string | null;
};

type ObligationShareInviteDetailsFunctionResponse = {
  ok: boolean;
  error?: string | null;
  invite?: ObligationShareInviteDetails;
};

type CreateSharedWorkspaceFunctionResponse = {
  ok: boolean;
  error?: string | null;
  workspace?: Workspace;
};

type WorkspaceCollaborationFunctionResponse = {
  ok: boolean;
  error?: string | null;
  collaboration?: WorkspaceCollaborationSummary;
};

type WorkspaceInvitationFunctionResponse = {
  ok: boolean;
  error?: string | null;
  alreadyMember?: boolean;
  invitationId?: number | null;
  status?: WorkspaceInvitationStatus | null;
  role?: Exclude<WorkspaceRole, "owner"> | null;
  inviteUrl?: string | null;
  emailSent?: boolean;
  emailError?: string | null;
  invitedEmail?: string | null;
  invitedDisplayName?: string | null;
};

type WorkspaceInvitationDetailsFunctionResponse = {
  ok: boolean;
  error?: string | null;
  invite?: WorkspaceInvitationDetails;
};

type AcceptWorkspaceInvitationFunctionResponse = {
  ok: boolean;
  error?: string | null;
  accepted?: boolean;
  alreadyAccepted?: boolean;
  workspaceId?: number | null;
};

type ListSharedObligationsFunctionResponse = {
  ok: boolean;
  error?: string | null;
  obligations?: SharedObligationSummary[];
};

type AcceptObligationShareFunctionResponse = {
  ok: boolean;
  error?: string | null;
  accepted?: boolean;
  alreadyAccepted?: boolean;
};

type UserEntitlementRow = {
  user_id: string;
  plan_code: UserEntitlementSummary["planCode"];
  pro_access_enabled: boolean;
  billing_status: string | null;
  billing_provider: string | null;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  manual_override: boolean;
};

type ExchangeRateRow = {
  from_currency_code: string;
  to_currency_code: string;
  rate: NumericLike;
  effective_at: string;
};

type UiPrefsRow = {
  view_modes?: Record<string, string>;
  column_visibility?: Record<string, Record<string, boolean>>;
};

type NotificationPreferencesRow = {
  in_app_enabled: boolean;
  push_enabled: boolean;
  email_enabled: boolean;
  smart_reads: Record<string, string> | null;
  ui_prefs: UiPrefsRow | null;
};

type CategoryMovementUsageRow = {
  category_id: number | null;
  occurred_at: string;
};

type CategorySubscriptionUsageRow = {
  category_id: number | null;
  updated_at: string;
};

export type CashflowPoint = {
  label: string;
  income: number;
  expense: number;
};

export type UiPrefs = {
  view_modes: Record<string, string>;
  column_visibility: Record<string, Record<string, boolean>>;
};

export type NotificationPreferences = {
  inAppEnabled: boolean;
  pushEnabled: boolean;
  emailEnabled: boolean;
  smartReads: Record<string, string>;
  uiPrefs: UiPrefs | null;
};

export type SharedWorkspaceFormInput = {
  name: string;
  description?: string | null;
  baseCurrencyCode?: string | null;
};

export type WorkspaceInvitationFormInput = {
  workspaceId: number;
  invitedEmail: string;
  role: Exclude<WorkspaceRole, "owner">;
  note?: string | null;
  appUrl?: string | null;
};

export type WorkspaceInvitationResult = {
  invitationId?: number | null;
  status?: WorkspaceInvitationStatus | null;
  role: Exclude<WorkspaceRole, "owner">;
  inviteUrl?: string | null;
  emailSent: boolean;
  emailError?: string | null;
  invitedEmail: string;
  invitedDisplayName?: string | null;
  alreadyMember: boolean;
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

export type MovementFormInput = {
  movementType: MovementRecord["movementType"];
  status: MovementRecord["status"];
  occurredAt: string;
  description: string;
  notes?: string | null;
  sourceAccountId: number | null;
  sourceAmount: number | null;
  destinationAccountId: number | null;
  destinationAmount: number | null;
  fxRate?: number | null;
  categoryId?: number | null;
  counterpartyId?: number | null;
  obligationId?: number | null;
  subscriptionId?: number | null;
  metadata?: JsonValue | null;
};

export type ObligationFormInput = {
  direction: ObligationSummary["direction"];
  originType: ObligationOriginType;
  status: ObligationStatus;
  title: string;
  counterpartyId: number;
  settlementAccountId?: number | null;
  openingAccountId?: number | null;
  openingImpact?: "none" | "inflow" | "outflow";
  currencyCode: string;
  principalAmount: number;
  startDate: string;
  dueDate?: string | null;
  installmentAmount?: number | null;
  installmentCount?: number | null;
  interestRate?: number | null;
  description?: string | null;
  notes?: string | null;
};

export type ObligationPaymentFormInput = {
  obligationId: number;
  eventDate: string;
  amount: number;
  installmentNo?: number | null;
  description?: string | null;
  notes?: string | null;
  movementId?: number | null;
  nextStatus?: ObligationStatus;
};

export type ObligationPrincipalAdjustmentFormInput = {
  obligationId: number;
  eventType: "principal_increase" | "principal_decrease";
  eventDate: string;
  amount: number;
  reason: string;
  notes?: string | null;
  registerAccountMovement?: boolean;
  accountId?: number | null;
  currentPrincipalAmount: number;
  currentPendingAmount: number;
  nextStatus?: ObligationStatus;
};

export type ObligationShareInviteInput = {
  workspaceId: number;
  obligationId: number;
  invitedEmail: string;
  message?: string | null;
  appUrl?: string | null;
};

export type ObligationShareInviteResult = {
  shareId: number;
  status: ObligationShareSummary["status"];
  shareUrl?: string | null;
  alreadyAccepted: boolean;
  emailSent: boolean;
  emailError?: string | null;
  invitedEmail: string;
  invitedDisplayName?: string | null;
};

export type SubscriptionFormInput = {
  name: string;
  vendorPartyId?: number | null;
  accountId?: number | null;
  categoryId?: number | null;
  currencyCode: string;
  amount: number;
  frequency: SubscriptionFrequency;
  intervalCount: number;
  dayOfMonth?: number | null;
  dayOfWeek?: number | null;
  startDate: string;
  nextDueDate: string;
  endDate?: string | null;
  status: SubscriptionSummary["status"];
  autoCreateMovement: boolean;
  remindDaysBefore: number;
  description?: string | null;
  notes?: string | null;
};

export type CounterpartyFormInput = {
  name: string;
  type: CounterpartySummary["type"];
  phone?: string | null;
  email?: string | null;
  documentNumber?: string | null;
  notes?: string | null;
  roles: CounterpartyRoleType[];
};

export type CategoryFormInput = {
  name: string;
  kind: CategorySummary["kind"];
  parentId?: number | null;
  color?: string | null;
  icon?: string | null;
  sortOrder: number;
  isActive: boolean;
};

export type BudgetFormInput = {
  name: string;
  periodStart: string;
  periodEnd: string;
  currencyCode: string;
  categoryId?: number | null;
  accountId?: number | null;
  limitAmount: number;
  rolloverEnabled: boolean;
  alertPercent: number;
  notes?: string | null;
  isActive: boolean;
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

type MovementMutationInput = MovementFormInput & {
  workspaceId: number;
  userId: string;
};

type MovementUpdateInput = MovementFormInput & {
  movementId: number;
  workspaceId: number;
  userId: string;
};

type MovementDeleteInput = {
  movementId: number;
  workspaceId: number;
};

type ObligationMutationInput = ObligationFormInput & {
  workspaceId: number;
  userId: string;
};

type ObligationUpdateInput = ObligationFormInput & {
  obligationId: number;
  workspaceId: number;
  userId: string;
};

type ObligationDeleteInput = {
  obligationId: number;
  workspaceId: number;
};

type ObligationPaymentMutationInput = ObligationPaymentFormInput & {
  workspaceId: number;
  userId: string;
};

type ObligationPrincipalAdjustmentMutationInput = ObligationPrincipalAdjustmentFormInput & {
  workspaceId: number;
  userId: string;
};

type SubscriptionMutationInput = SubscriptionFormInput & {
  workspaceId: number;
  userId: string;
};

type SubscriptionUpdateInput = SubscriptionFormInput & {
  subscriptionId: number;
  workspaceId: number;
  userId: string;
};

type SubscriptionDeleteInput = {
  subscriptionId: number;
  workspaceId: number;
};

type CounterpartyMutationInput = CounterpartyFormInput & {
  workspaceId: number;
  userId: string;
};

type CategoryMutationInput = CategoryFormInput & {
  workspaceId: number;
  userId: string;
};

type CategoryUpdateInput = CategoryFormInput & {
  categoryId: number;
  workspaceId: number;
  userId: string;
};

type CategoryToggleInput = {
  categoryId: number;
  workspaceId: number;
  userId: string;
  isActive: boolean;
};

type CategoryDeleteInput = {
  categoryId: number;
  workspaceId: number;
};

type BudgetMutationInput = BudgetFormInput & {
  workspaceId: number;
  userId: string;
};

type BudgetUpdateInput = BudgetFormInput & {
  budgetId: number;
  workspaceId: number;
  userId: string;
};

type BudgetToggleInput = {
  budgetId: number;
  workspaceId: number;
  userId: string;
  isActive: boolean;
};

type BudgetDeleteInput = {
  budgetId: number;
  workspaceId: number;
};

type SharedWorkspaceMutationInput = SharedWorkspaceFormInput;

type WorkspaceInvitationMutationInput = WorkspaceInvitationFormInput;

type CounterpartyUpdateInput = CounterpartyFormInput & {
  counterpartyId: number;
  workspaceId: number;
  userId: string;
};

type CounterpartyArchiveInput = {
  counterpartyId: number;
  workspaceId: number;
  userId: string;
  isArchived: boolean;
};

type CounterpartyDeleteInput = {
  counterpartyId: number;
  workspaceId: number;
};

type AttachmentCreateInput = {
  workspaceId: number;
  entityType: AttachmentEntityType;
  entityId: number;
  bucketName: string;
  filePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  width?: number | null;
  height?: number | null;
  uploadedByUserId: string;
};

type AttachmentDeleteInput = {
  attachmentId: number;
  workspaceId: number;
};

export type WorkspaceSnapshot = {
  workspace: Workspace;
  exchangeRates: ExchangeRateSummary[];
  accounts: AccountSummary[];
  movements: MovementRecord[];
  budgets: BudgetOverview[];
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
    categories: CategorySummary[];
    counterparties: CounterpartySummary[];
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

async function invokeAuthenticatedFunction<T>(functionName: string, body: Record<string, unknown> = {}) {
  const client = getClient();
  const {
    data: { session },
  } = await client.auth.getSession();

  if (!session?.access_token) {
    throw new Error("No hay una sesion activa para continuar con esta accion.");
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase no esta configurado correctamente en el frontend.");
  }

  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  });

  const responseBody = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMessage =
      responseBody && typeof responseBody === "object" && "error" in responseBody
        ? String((responseBody as { error?: unknown }).error ?? "")
        : "";

    throw new Error(
      errorMessage || `La Edge Function ${functionName} respondio ${response.status}.`,
    );
  }

  return responseBody as T;
}

async function invokePublicFunction<T>(functionName: string, body: Record<string, unknown> = {}) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase no esta configurado correctamente en el frontend.");
  }

  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify(body),
  });

  const responseBody = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMessage =
      responseBody && typeof responseBody === "object"
        ? "error" in responseBody
          ? String((responseBody as { error?: unknown }).error ?? "")
          : "message" in responseBody
            ? String((responseBody as { message?: unknown }).message ?? "")
            : ""
        : "";

    throw new Error(
      errorMessage || `La Edge Function ${functionName} respondio ${response.status}.`,
    );
  }

  return responseBody as T;
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

function normalizeCurrencyCode(currencyCode: string) {
  return currencyCode.trim().toUpperCase();
}

function isMissingRelationError(error: unknown, relationName: string) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const postgresError = error as { code?: string; message?: string; details?: string };
  const haystack = `${postgresError.message ?? ""} ${postgresError.details ?? ""}`.toLowerCase();

  return (
    postgresError.code === "42P01" ||
    postgresError.code === "42703" ||
    haystack.includes(relationName.toLowerCase())
  );
}

function buildEntityAttachmentsQueryKey(
  workspaceId?: number,
  entityType?: AttachmentEntityType,
  entityId?: number | null,
) {
  return ["attachments", workspaceId ?? null, entityType ?? null, entityId ?? null] as const;
}

function buildExchangeRateKey(fromCurrencyCode: string, toCurrencyCode: string) {
  return `${normalizeCurrencyCode(fromCurrencyCode)}:${normalizeCurrencyCode(toCurrencyCode)}`;
}

function buildExchangeRateMap(exchangeRateRows: ExchangeRateRow[]) {
  const exchangeRateMap = new Map<string, number>();

  for (const row of exchangeRateRows) {
    const key = buildExchangeRateKey(row.from_currency_code, row.to_currency_code);

    if (exchangeRateMap.has(key)) {
      continue;
    }

    const rate = toNumber(row.rate);

    if (rate > 0) {
      exchangeRateMap.set(key, rate);
    }
  }

  return exchangeRateMap;
}

function resolveExchangeRate(
  exchangeRateMap: Map<string, number>,
  fromCurrencyCode: string,
  toCurrencyCode: string,
) {
  const normalizedFromCurrencyCode = normalizeCurrencyCode(fromCurrencyCode);
  const normalizedToCurrencyCode = normalizeCurrencyCode(toCurrencyCode);

  if (normalizedFromCurrencyCode === normalizedToCurrencyCode) {
    return 1;
  }

  const directRate = exchangeRateMap.get(
    buildExchangeRateKey(normalizedFromCurrencyCode, normalizedToCurrencyCode),
  );

  if (directRate && directRate > 0) {
    return directRate;
  }

  const inverseRate = exchangeRateMap.get(
    buildExchangeRateKey(normalizedToCurrencyCode, normalizedFromCurrencyCode),
  );

  if (inverseRate && inverseRate > 0) {
    return 1 / inverseRate;
  }

  return null;
}

function convertAmountToCurrency(
  amount: number,
  fromCurrencyCode: string,
  toCurrencyCode: string,
  exchangeRateMap: Map<string, number>,
) {
  const rate = resolveExchangeRate(exchangeRateMap, fromCurrencyCode, toCurrencyCode);

  return rate === null ? null : amount * rate;
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
    baseCurrencyCode: row.base_currency_code ?? profile?.baseCurrencyCode ?? "PEN",
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
      base_currency_code: profile?.baseCurrencyCode ?? "PEN",
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

async function createSharedWorkspace(input: SharedWorkspaceMutationInput) {
  const response = (await invokeAuthenticatedFunction<CreateSharedWorkspaceFunctionResponse>(
    "create-shared-workspace",
    {
      name: input.name,
      description: input.description ?? null,
      baseCurrencyCode: input.baseCurrencyCode ?? null,
    },
  )) as CreateSharedWorkspaceFunctionResponse;

  if (!response.ok || !response.workspace) {
    throw new Error(response.error ?? "No pudimos crear el workspace colaborativo.");
  }

  return response.workspace;
}

async function fetchWorkspaceCollaboration(workspaceId: number) {
  const response = (await invokeAuthenticatedFunction<WorkspaceCollaborationFunctionResponse>(
    "get-workspace-collaboration",
    { workspaceId },
  )) as WorkspaceCollaborationFunctionResponse;

  if (!response.ok || !response.collaboration) {
    throw new Error(response.error ?? "No pudimos leer miembros e invitaciones de este workspace.");
  }

  return {
    workspace: response.collaboration.workspace,
    requesterRole: response.collaboration.requesterRole,
    canManageMembers: response.collaboration.canManageMembers,
    members: (response.collaboration.members ?? []) as WorkspaceMemberSummary[],
    invitations: (response.collaboration.invitations ?? []) as WorkspaceInvitationSummary[],
  } satisfies WorkspaceCollaborationSummary;
}

async function createWorkspaceInvitation(input: WorkspaceInvitationMutationInput) {
  const response = (await invokeAuthenticatedFunction<WorkspaceInvitationFunctionResponse>(
    "create-workspace-invitation",
    {
      workspaceId: input.workspaceId,
      invitedEmail: input.invitedEmail,
      role: input.role,
      note: input.note ?? null,
      appUrl: input.appUrl ?? null,
    },
  )) as WorkspaceInvitationFunctionResponse;

  if (!response.ok || !response.invitedEmail || !response.role) {
    throw new Error(response.error ?? "No pudimos crear la invitacion del workspace.");
  }

  return {
    invitationId: response.invitationId ?? null,
    status: response.status ?? null,
    role: response.role,
    inviteUrl: response.inviteUrl ?? null,
    emailSent: Boolean(response.emailSent),
    emailError: response.emailError ?? null,
    invitedEmail: response.invitedEmail,
    invitedDisplayName: response.invitedDisplayName ?? null,
    alreadyMember: Boolean(response.alreadyMember),
  } satisfies WorkspaceInvitationResult;
}

async function fetchWorkspaceInvitationDetails(token: string) {
  const data = await invokePublicFunction<WorkspaceInvitationDetailsFunctionResponse>(
    "get-workspace-invite",
    { token },
  );

  const response = (data ?? {}) as WorkspaceInvitationDetailsFunctionResponse;

  if (!response.ok || !response.invite) {
    throw new Error(response.error ?? "No pudimos leer esta invitacion de workspace.");
  }

  return response.invite;
}

async function acceptWorkspaceInvitation(token: string) {
  const response = (await invokeAuthenticatedFunction<AcceptWorkspaceInvitationFunctionResponse>(
    "accept-workspace-invite",
    { token },
  )) as AcceptWorkspaceInvitationFunctionResponse;

  if (!response.ok || !response.accepted || !response.workspaceId) {
    throw new Error(response.error ?? "No pudimos aceptar esta invitacion de workspace.");
  }

  return {
    accepted: true,
    alreadyAccepted: Boolean(response.alreadyAccepted),
    workspaceId: response.workspaceId,
  };
}

async function fetchWorkspaceSnapshot(workspace: Workspace, userId: string, profile?: AppProfile | null) {
  const client = getClient();

  const [
    accountsResult,
    categoriesResult,
    counterpartiesResult,
    movementsResult,
    budgetsResult,
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
    client
      .from("categories")
      .select(
        "id, workspace_id, name, kind, parent_id, color, icon, sort_order, is_system, is_active, created_at, updated_at",
      )
      .eq("workspace_id", workspace.id)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    client
      .from("counterparties")
      .select("id, workspace_id, name, type, phone, email, document_number, notes, is_archived")
      .eq("workspace_id", workspace.id)
      .order("name", { ascending: true }),
    client
      .from("movements")
      .select(
        "id, workspace_id, movement_type, status, occurred_at, description, notes, source_account_id, source_amount, destination_account_id, destination_amount, fx_rate, category_id, counterparty_id, obligation_id, subscription_id, metadata",
      )
      .eq("workspace_id", workspace.id)
      .order("occurred_at", { ascending: false }),
    client
      .from("v_budget_progress")
      .select(
        "id, workspace_id, created_by_user_id, updated_by_user_id, name, period_start, period_end, currency_code, category_id, category_name, account_id, account_name, scope_kind, scope_label, limit_amount, spent_amount, remaining_amount, used_percent, alert_percent, movement_count, rollover_enabled, notes, is_active, is_near_limit, is_over_limit, created_at, updated_at",
      )
      .eq("workspace_id", workspace.id)
      .order("period_end", { ascending: true })
      .order("name", { ascending: true }),
    client
      .from("obligations")
      .select(
        "id, workspace_id, direction, origin_type, status, title, counterparty_id, settlement_account_id, currency_code, principal_amount, start_date, due_date, installment_amount, installment_count, interest_rate, description, notes",
      )
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false }),
    client
      .from("subscriptions")
      .select(
        "id, workspace_id, name, vendor_party_id, account_id, category_id, currency_code, amount, frequency, interval_count, day_of_month, day_of_week, start_date, next_due_date, end_date, status, remind_days_before, auto_create_movement, description, notes",
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
    budgetsResult.error ||
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
  const budgetRows = (budgetsResult.data ?? []) as BudgetProgressRow[];
  const obligationRows = (obligationsResult.data ?? []) as ObligationRow[];
  const subscriptionRows = (subscriptionsResult.data ?? []) as SubscriptionRow[];
  const activityRows = (activityResult.data ?? []) as ActivityRow[];

  let obligationEventRows: ObligationEventRow[] = [];

  if (obligationRows.length > 0) {
    const obligationIds = obligationRows.map((row) => row.id);
    const { data: obligationEventData, error: obligationEventError } = await client
      .from("obligation_events")
      .select(
        "id, obligation_id, event_type, event_date, amount, installment_no, reason, description, notes, movement_id, created_by_user_id, metadata",
      )
      .in("obligation_id", obligationIds);

    if (obligationEventError) {
      throw obligationEventError;
    }

    obligationEventRows = (obligationEventData ?? []) as ObligationEventRow[];
  }

  const baseCurrencyCode = normalizeCurrencyCode(workspace.baseCurrencyCode);
  const exchangeRateLookupCodes = Array.from(
    new Set(
      accountRows
        .map((row) => normalizeCurrencyCode(row.currency_code))
        .concat(obligationRows.map((row) => normalizeCurrencyCode(row.currency_code)))
        .concat(subscriptionRows.map((row) => normalizeCurrencyCode(row.currency_code)))
        .concat(baseCurrencyCode),
    ),
  );
  let exchangeRateRows: ExchangeRateRow[] = [];

  if (exchangeRateLookupCodes.length > 1) {
    const { data: exchangeRateData, error: exchangeRateError } = await client
      .from("exchange_rates")
      .select("from_currency_code, to_currency_code, rate, effective_at")
      .in("from_currency_code", exchangeRateLookupCodes)
      .in("to_currency_code", exchangeRateLookupCodes)
      .order("effective_at", { ascending: false });

    if (exchangeRateError) {
      const message = String(exchangeRateError.message ?? "").toLowerCase();

      if (!message.includes("exchange_rates")) {
        throw exchangeRateError;
      }
    } else {
      exchangeRateRows = (exchangeRateData ?? []) as ExchangeRateRow[];
    }
  }

  const categories = categoryRows.map<CategorySummary>((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind,
    isActive: row.is_active,
  }));
  const counterparties = counterpartyRows.map<CounterpartySummary>((row) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    isArchived: row.is_archived,
  }));
  const accountRowMap = new Map(accountRows.map((row) => [row.id, row]));
  const categoryNameMap = new Map(categoryRows.map((row) => [row.id, row.name]));
  const counterpartyNameMap = new Map(counterpartyRows.map((row) => [row.id, row.name]));
  const accountBalanceMap = new Map(accountRows.map((row) => [row.id, toNumber(row.opening_balance)]));
  const accountActivityMap = new Map<number, string>();
  const exchangeRateMap = buildExchangeRateMap(exchangeRateRows);

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
    .map<AccountSummary>((row) => {
      const currentBalance = accountBalanceMap.get(row.id) ?? toNumber(row.opening_balance);

      return {
        id: row.id,
        workspaceId: row.workspace_id,
        name: row.name,
        type: row.type,
        currencyCode: row.currency_code,
        openingBalance: toNumber(row.opening_balance),
        currentBalance,
        currentBalanceInBaseCurrency: convertAmountToCurrency(
          currentBalance,
          row.currency_code,
          baseCurrencyCode,
          exchangeRateMap,
        ),
        includeInNetWorth: row.include_in_net_worth,
        lastActivity: accountActivityMap.get(row.id) ?? row.updated_at ?? row.created_at,
        color: row.color ?? defaultAccountColors[row.type] ?? defaultAccountColors.other,
        icon: row.icon ?? row.type,
        isArchived: row.is_archived,
      };
    });

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
      notes: row.notes,
      category: row.category_id ? categoryNameMap.get(row.category_id) ?? "Sin categoria" : "Sin categoria",
      categoryId: row.category_id,
      counterparty: row.counterparty_id
        ? counterpartyNameMap.get(row.counterparty_id) ?? "Sin contraparte"
        : row.movement_type === "transfer"
          ? "Transferencia interna"
          : "Sin contraparte",
      counterpartyId: row.counterparty_id,
      occurredAt: row.occurred_at,
      sourceAccountId: row.source_account_id,
      sourceAccountName: sourceAccount?.name ?? null,
      sourceCurrencyCode: sourceAccount?.currency_code ?? null,
      sourceAmount: row.source_amount === null ? null : toNumber(row.source_amount),
      sourceAmountInBaseCurrency:
        row.source_amount === null || !sourceAccount?.currency_code
          ? null
          : convertAmountToCurrency(
              toNumber(row.source_amount),
              sourceAccount.currency_code,
              baseCurrencyCode,
              exchangeRateMap,
            ),
      destinationAccountId: row.destination_account_id,
      destinationAccountName: destinationAccount?.name ?? null,
      destinationCurrencyCode: destinationAccount?.currency_code ?? null,
      destinationAmount: row.destination_amount === null ? null : toNumber(row.destination_amount),
      destinationAmountInBaseCurrency:
        row.destination_amount === null || !destinationAccount?.currency_code
          ? null
          : convertAmountToCurrency(
              toNumber(row.destination_amount),
              destinationAccount.currency_code,
              baseCurrencyCode,
              exchangeRateMap,
            ),
      fxRate: row.fx_rate === null ? null : toNumber(row.fx_rate),
      obligationId: row.obligation_id,
      subscriptionId: row.subscription_id,
      metadata: row.metadata,
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
    let principalIncreaseAmount = 0;
    let principalDecreaseAmount = 0;
    let reductionAmount = 0;
    let additionalAmount = 0;
    let paymentCount = 0;
    let lastInstallmentNo = 0;
    let lastPaymentDate: string | null = null;

    for (const event of obligationEvents) {
      const amount = toNumber(event.amount);

      if (event.event_type === "principal_increase") {
        principalIncreaseAmount += amount;
        continue;
      }

      if (event.event_type === "principal_decrease") {
        principalDecreaseAmount += amount;
        continue;
      }

      if (event.event_type === "payment") {
        reductionAmount += amount;
        paymentCount += 1;
        lastInstallmentNo = Math.max(lastInstallmentNo, event.installment_no ?? 0);
        lastPaymentDate = getLatestTimestamp(lastPaymentDate ?? undefined, event.event_date);
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
    const currentPrincipalAmount = Math.max(
      0,
      principalAmount + principalIncreaseAmount - principalDecreaseAmount,
    );
    const pendingAmount = Math.max(0, currentPrincipalAmount + additionalAmount - reductionAmount);
    const progressBase = Math.max(currentPrincipalAmount + additionalAmount, 0);
    const progressPercent =
      progressBase > 0 ? Math.min(100, Math.round(((progressBase - pendingAmount) / progressBase) * 100)) : 0;
    const installmentLabel =
      row.installment_count && row.installment_count > 0
        ? `${Math.min(lastInstallmentNo || paymentCount, row.installment_count)} de ${row.installment_count} cuotas`
        : paymentCount > 0
          ? `${paymentCount} pagos registrados`
          : "Sin pagos registrados";
    const events = [...obligationEvents]
      .sort((left, right) => new Date(right.event_date).getTime() - new Date(left.event_date).getTime())
      .map<ObligationEventSummary>((event) => ({
        id: event.id,
        eventType: event.event_type,
        eventDate: event.event_date,
        amount: toNumber(event.amount),
        installmentNo: event.installment_no,
        reason: event.reason,
        description: event.description,
        notes: event.notes,
        movementId: event.movement_id,
        createdByUserId: event.created_by_user_id,
        metadata: event.metadata,
      }));

    return {
      id: row.id,
      workspaceId: row.workspace_id,
      title: row.title,
      direction: row.direction,
      originType: row.origin_type,
      counterparty: row.counterparty_id
        ? counterpartyNameMap.get(row.counterparty_id) ?? "Sin contraparte"
        : "Sin contraparte",
      counterpartyId: row.counterparty_id,
      settlementAccountId: row.settlement_account_id,
      settlementAccountName: row.settlement_account_id
        ? accountRowMap.get(row.settlement_account_id)?.name ?? null
        : null,
      status: row.status,
      currencyCode: row.currency_code,
      principalAmount,
      principalAmountInBaseCurrency: convertAmountToCurrency(
        principalAmount,
        row.currency_code,
        baseCurrencyCode,
        exchangeRateMap,
      ),
      currentPrincipalAmount,
      currentPrincipalAmountInBaseCurrency: convertAmountToCurrency(
        currentPrincipalAmount,
        row.currency_code,
        baseCurrencyCode,
        exchangeRateMap,
      ),
      pendingAmount,
      pendingAmountInBaseCurrency: convertAmountToCurrency(
        pendingAmount,
        row.currency_code,
        baseCurrencyCode,
        exchangeRateMap,
      ),
      progressPercent,
      startDate: row.start_date,
      dueDate: row.due_date,
      installmentAmount: row.installment_amount === null ? null : toNumber(row.installment_amount),
      installmentCount: row.installment_count,
      interestRate: row.interest_rate === null ? null : toNumber(row.interest_rate),
      description: row.description,
      notes: row.notes,
      paymentCount,
      lastPaymentDate,
      installmentLabel,
      events,
    };
  });

  const subscriptions = subscriptionRows.map<SubscriptionSummary>((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    vendorPartyId: row.vendor_party_id,
    vendor: row.vendor_party_id
      ? counterpartyNameMap.get(row.vendor_party_id) ?? "Sin proveedor"
      : "Sin proveedor",
    accountId: row.account_id,
    categoryId: row.category_id,
    categoryName: row.category_id ? categoryNameMap.get(row.category_id) ?? null : null,
    status: row.status,
    amount: toNumber(row.amount),
    amountInBaseCurrency: convertAmountToCurrency(
      toNumber(row.amount),
      row.currency_code,
      baseCurrencyCode,
      exchangeRateMap,
    ),
    currencyCode: row.currency_code,
    frequency: row.frequency,
    frequencyLabel: row.interval_count > 1 ? `${row.interval_count} x ${row.frequency}` : row.frequency,
    intervalCount: row.interval_count,
    dayOfMonth: row.day_of_month,
    dayOfWeek: row.day_of_week,
    startDate: row.start_date,
    nextDueDate: row.next_due_date,
    endDate: row.end_date,
    remindDaysBefore: row.remind_days_before,
    accountName: row.account_id ? accountRowMap.get(row.account_id)?.name ?? null : null,
    autoCreateMovement: row.auto_create_movement,
    description: row.description,
    notes: row.notes,
  }));

  const budgets = budgetRows.map<BudgetOverview>((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    createdByUserId: row.created_by_user_id,
    updatedByUserId: row.updated_by_user_id,
    name: row.name,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    currencyCode: normalizeCurrencyCode(row.currency_code),
    categoryId: row.category_id,
    categoryName: row.category_name,
    accountId: row.account_id,
    accountName: row.account_name,
    scopeKind: row.scope_kind,
    scopeLabel: row.scope_label,
    limitAmount: toNumber(row.limit_amount),
    spentAmount: toNumber(row.spent_amount),
    remainingAmount: toNumber(row.remaining_amount),
    usedPercent: toNumber(row.used_percent),
    alertPercent: toNumber(row.alert_percent),
    movementCount: row.movement_count ?? 0,
    rolloverEnabled: row.rollover_enabled,
    notes: row.notes,
    isActive: row.is_active,
    isNearLimit: row.is_near_limit,
    isOverLimit: row.is_over_limit,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
    .reduce((total, account) => total + (account.currentBalanceInBaseCurrency ?? account.currentBalance), 0);

  return {
    workspace,
    exchangeRates: exchangeRateRows.map<ExchangeRateSummary>((row) => ({
      fromCurrencyCode: normalizeCurrencyCode(row.from_currency_code),
      toCurrencyCode: normalizeCurrencyCode(row.to_currency_code),
      rate: toNumber(row.rate),
      effectiveAt: row.effective_at,
    })),
    accounts,
    movements,
    budgets,
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
      categoriesCount: categories.length,
      counterpartiesCount: counterparties.length,
      categories,
      counterparties,
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

async function fetchEntityAttachments(
  workspaceId: number,
  entityType: AttachmentEntityType,
  entityId: number,
) {
  const client = getClient();
  const { data, error } = await client
    .from("attachments")
    .select(
      "id, workspace_id, entity_type, entity_id, bucket_name, file_path, file_name, mime_type, size_bytes, width, height, uploaded_by_user_id, created_at",
    )
    .eq("workspace_id", workspaceId)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingRelationError(error, "attachments")) {
      return [] satisfies AttachmentSummary[];
    }

    throw error;
  }

  return ((data ?? []) as AttachmentRow[]).map<AttachmentSummary>((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    bucketName: row.bucket_name,
    filePath: row.file_path,
    fileName: row.file_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    width: row.width,
    height: row.height,
    uploadedByUserId: row.uploaded_by_user_id,
    createdAt: row.created_at,
  }));
}

function mapObligationShareRow(row: ObligationShareRow) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    obligationId: row.obligation_id,
    ownerUserId: row.owner_user_id,
    invitedByUserId: row.invited_by_user_id,
    invitedUserId: row.invited_user_id,
    ownerDisplayName: row.owner_display_name,
    invitedDisplayName: row.invited_display_name,
    invitedEmail: row.invited_email,
    status: row.status,
    token: row.token,
    message: row.message,
    acceptedAt: row.accepted_at,
    respondedAt: row.responded_at,
    lastSentAt: row.last_sent_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  } satisfies ObligationShareSummary;
}

async function fetchObligationShares(workspaceId: number) {
  const client = getClient();
  const { data, error } = await client
    .from("obligation_shares")
    .select(
      "id, workspace_id, obligation_id, owner_user_id, invited_by_user_id, invited_user_id, owner_display_name, invited_display_name, invited_email, status, token, message, accepted_at, responded_at, last_sent_at, created_at, updated_at",
    )
    .eq("workspace_id", workspaceId)
    .in("status", ["pending", "accepted"])
    .order("updated_at", { ascending: false });

  if (error) {
    if (isMissingRelationError(error, "obligation_shares")) {
      return [] satisfies ObligationShareSummary[];
    }

    throw error;
  }

  return ((data ?? []) as ObligationShareRow[]).map(mapObligationShareRow);
}

async function fetchObligationShareInviteDetails(token: string) {
  const data = await invokePublicFunction<ObligationShareInviteDetailsFunctionResponse>(
    "get-obligation-share-invite",
    { token },
  );

  const response = (data ?? {}) as ObligationShareInviteDetailsFunctionResponse;

  if (!response.ok || !response.invite) {
    throw new Error(response.error ?? "No pudimos leer esta invitacion compartida.");
  }

  return response.invite;
}

async function fetchSharedObligations() {
  const response = (await invokeAuthenticatedFunction<ListSharedObligationsFunctionResponse>(
    "list-shared-obligations",
    {},
  )) as ListSharedObligationsFunctionResponse;

  if (!response.ok) {
    throw new Error(response.error ?? "No pudimos cargar los registros compartidos contigo.");
  }

  return response.obligations ?? [];
}

async function fetchUserEntitlement(userId: string) {
  const client = getClient();
  const { data, error } = await client
    .from("user_entitlements")
    .select(
      "user_id, plan_code, pro_access_enabled, billing_status, billing_provider, provider_customer_id, provider_subscription_id, current_period_start, current_period_end, cancel_at_period_end, manual_override",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (isMissingRelationError(error, "user_entitlements")) {
      return null;
    }

    throw error;
  }

  if (!data) {
    return null;
  }

  const row = data as UserEntitlementRow;

  return {
    userId: row.user_id,
    planCode: row.plan_code,
    proAccessEnabled: row.pro_access_enabled,
    billingStatus: row.billing_status,
    billingProvider: row.billing_provider,
    providerCustomerId: row.provider_customer_id,
    providerSubscriptionId: row.provider_subscription_id,
    currentPeriodStart: row.current_period_start,
    currentPeriodEnd: row.current_period_end,
    cancelAtPeriodEnd: row.cancel_at_period_end,
    manualOverride: row.manual_override,
  } satisfies UserEntitlementSummary;
}

type StartProCheckoutInput = {
  appUrl?: string;
  workspaceId?: number | null;
};

type StartProCheckoutResult = {
  checkoutUrl: string;
  provider: string;
  subscriptionId?: string | null;
  billingStatus?: string | null;
};

type CancelProSubscriptionResult = {
  provider: string;
  billingStatus?: string | null;
  proAccessEnabled: boolean;
};

async function fetchNotificationPreferences(userId: string) {
  const client = getClient();

  const { data, error } = await client
    .from("notification_preferences")
    .select("in_app_enabled, push_enabled, email_enabled, smart_reads, ui_prefs")
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
    smartReads: (row.smart_reads as Record<string, string>) ?? {},
    uiPrefs: row.ui_prefs
      ? {
          view_modes: row.ui_prefs.view_modes ?? {},
          column_visibility: row.ui_prefs.column_visibility ?? {},
        }
      : null,
  };
}

async function fetchCounterpartiesOverview(workspaceId: number) {
  const client = getClient();
  const [counterpartiesResult, rolesResult, summaryResult] = await Promise.all([
    client
      .from("counterparties")
      .select("id, workspace_id, name, type, phone, email, document_number, notes, is_archived")
      .eq("workspace_id", workspaceId)
      .order("name", { ascending: true }),
    client
      .from("counterparty_roles")
      .select("id, workspace_id, counterparty_id, role_type, notes")
      .eq("workspace_id", workspaceId)
      .order("role_type", { ascending: true }),
    client
      .from("v_counterparty_summary")
      .select(
        "workspace_id, counterparty_id, name, type, phone, email, document_number, notes, is_archived, roles, receivable_count, receivable_principal_total, receivable_pending_total, payable_count, payable_principal_total, payable_pending_total, net_pending_amount, movement_count, inflow_total, outflow_total, net_flow_amount, last_activity_at",
      )
      .eq("workspace_id", workspaceId)
      .order("name", { ascending: true }),
  ]);

  if (counterpartiesResult.error) {
    throw counterpartiesResult.error;
  }

  if (rolesResult.error) {
    throw rolesResult.error;
  }

  if (summaryResult.error) {
    throw summaryResult.error;
  }

  const counterpartyRows = (counterpartiesResult.data ?? []) as CounterpartyRow[];
  const roleRows = (rolesResult.data ?? []) as CounterpartyRoleRow[];
  const summaryRows = (summaryResult.data ?? []) as CounterpartySummaryRow[];
  const rolesByCounterpartyId = new Map<number, CounterpartyRoleType[]>();
  const summaryByCounterpartyId = new Map(summaryRows.map((row) => [row.counterparty_id, row]));

  for (const roleRow of roleRows) {
    const currentRoles = rolesByCounterpartyId.get(roleRow.counterparty_id) ?? [];
    currentRoles.push(roleRow.role_type);
    rolesByCounterpartyId.set(roleRow.counterparty_id, currentRoles);
  }

  return counterpartyRows.map<CounterpartyOverview>((row) => {
    const summaryRow = summaryByCounterpartyId.get(row.id);
    const roles = summaryRow?.roles?.length
      ? summaryRow.roles.filter(Boolean).map((role) => role as CounterpartyRoleType)
      : normalizeCounterpartyRoles(rolesByCounterpartyId.get(row.id) ?? []);

    return {
      id: row.id,
      workspaceId: row.workspace_id,
      name: row.name,
      type: row.type,
      phone: row.phone,
      email: row.email,
      documentNumber: row.document_number,
      notes: row.notes,
      isArchived: row.is_archived,
      roles,
      receivableCount: summaryRow?.receivable_count ?? 0,
      receivablePrincipalTotal: toNumber(summaryRow?.receivable_principal_total ?? 0),
      receivablePendingTotal: toNumber(summaryRow?.receivable_pending_total ?? 0),
      payableCount: summaryRow?.payable_count ?? 0,
      payablePrincipalTotal: toNumber(summaryRow?.payable_principal_total ?? 0),
      payablePendingTotal: toNumber(summaryRow?.payable_pending_total ?? 0),
      netPendingAmount: toNumber(summaryRow?.net_pending_amount ?? 0),
      movementCount: summaryRow?.movement_count ?? 0,
      inflowTotal: toNumber(summaryRow?.inflow_total ?? 0),
      outflowTotal: toNumber(summaryRow?.outflow_total ?? 0),
      netFlowAmount: toNumber(summaryRow?.net_flow_amount ?? 0),
      lastActivityAt: summaryRow?.last_activity_at ?? null,
    };
  });
}

async function fetchCategoriesOverview(workspaceId: number) {
  const client = getClient();
  const [categoriesResult, movementsResult, subscriptionsResult] = await Promise.all([
    client
      .from("categories")
      .select(
        "id, workspace_id, name, kind, parent_id, color, icon, sort_order, is_system, is_active, created_at, updated_at",
      )
      .eq("workspace_id", workspaceId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    client
      .from("movements")
      .select("category_id, occurred_at")
      .eq("workspace_id", workspaceId)
      .not("category_id", "is", null),
    client
      .from("subscriptions")
      .select("category_id, updated_at")
      .eq("workspace_id", workspaceId)
      .not("category_id", "is", null),
  ]);

  if (categoriesResult.error) {
    throw categoriesResult.error;
  }

  if (movementsResult.error) {
    throw movementsResult.error;
  }

  if (subscriptionsResult.error) {
    throw subscriptionsResult.error;
  }

  const categoryRows = (categoriesResult.data ?? []) as CategoryRow[];
  const movementRows = (movementsResult.data ?? []) as CategoryMovementUsageRow[];
  const subscriptionRows = (subscriptionsResult.data ?? []) as CategorySubscriptionUsageRow[];
  const categoryNameMap = new Map(categoryRows.map((row) => [row.id, row.name]));
  const usageByCategoryId = new Map<
    number,
    {
      movementCount: number;
      subscriptionCount: number;
      lastActivityAt: string | null;
    }
  >();

  for (const movementRow of movementRows) {
    if (!movementRow.category_id) {
      continue;
    }

    const currentUsage = usageByCategoryId.get(movementRow.category_id) ?? {
      movementCount: 0,
      subscriptionCount: 0,
      lastActivityAt: null,
    };

    currentUsage.movementCount += 1;
    currentUsage.lastActivityAt = getLatestTimestamp(
      currentUsage.lastActivityAt ?? undefined,
      movementRow.occurred_at,
    );
    usageByCategoryId.set(movementRow.category_id, currentUsage);
  }

  for (const subscriptionRow of subscriptionRows) {
    if (!subscriptionRow.category_id) {
      continue;
    }

    const currentUsage = usageByCategoryId.get(subscriptionRow.category_id) ?? {
      movementCount: 0,
      subscriptionCount: 0,
      lastActivityAt: null,
    };

    currentUsage.subscriptionCount += 1;
    currentUsage.lastActivityAt = getLatestTimestamp(
      currentUsage.lastActivityAt ?? undefined,
      subscriptionRow.updated_at,
    );
    usageByCategoryId.set(subscriptionRow.category_id, currentUsage);
  }

  return categoryRows.map<CategoryOverview>((row) => {
    const usage = usageByCategoryId.get(row.id);

    return {
      id: row.id,
      workspaceId: row.workspace_id,
      name: row.name,
      kind: row.kind,
      isActive: row.is_active,
      parentId: row.parent_id,
      parentName: row.parent_id ? categoryNameMap.get(row.parent_id) ?? null : null,
      color: row.color,
      icon: row.icon,
      sortOrder: row.sort_order,
      isSystem: row.is_system,
      movementCount: usage?.movementCount ?? 0,
      subscriptionCount: usage?.subscriptionCount ?? 0,
      lastActivityAt: usage?.lastActivityAt ?? row.updated_at ?? row.created_at,
    };
  });
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

type OptimisticSnapshotContext = { previousSnapshot?: WorkspaceSnapshot };

function snapshotKey(workspaceId: number, userId?: string) {
  return ["workspace-snapshot", workspaceId, userId] as const;
}

function optimisticDelete<TInput>(
  queryClient: ReturnType<typeof useQueryClient>,
  workspaceId: number | undefined,
  userId: string | undefined,
  apply: (snapshot: WorkspaceSnapshot, input: TInput) => WorkspaceSnapshot,
) {
  return {
    onMutate: async (input: TInput): Promise<OptimisticSnapshotContext> => {
      if (!workspaceId) return {};
      const key = snapshotKey(workspaceId, userId);
      await queryClient.cancelQueries({ queryKey: ["workspace-snapshot", workspaceId], exact: false });
      const previousSnapshot = queryClient.getQueryData<WorkspaceSnapshot>(key);
      if (previousSnapshot) {
        queryClient.setQueryData<WorkspaceSnapshot>(key, apply(previousSnapshot, input));
      }
      return { previousSnapshot };
    },
    onError: (_err: unknown, _input: TInput, context: OptimisticSnapshotContext | undefined) => {
      if (context?.previousSnapshot && workspaceId) {
        queryClient.setQueryData(snapshotKey(workspaceId, userId), context.previousSnapshot);
      }
    },
    onSettled: async () => {
      if (workspaceId) await invalidateWorkspaceSnapshot(queryClient, workspaceId, userId);
    },
  };
}

async function invalidateCounterpartiesOverview(
  queryClient: ReturnType<typeof useQueryClient>,
  workspaceId: number,
) {
  await queryClient.invalidateQueries({
    queryKey: ["counterparties-overview", workspaceId],
  });
}

async function invalidateCategoriesOverview(
  queryClient: ReturnType<typeof useQueryClient>,
  workspaceId: number,
) {
  await queryClient.invalidateQueries({
    queryKey: ["categories-overview", workspaceId],
  });
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

export function useCreateSharedWorkspaceMutation(userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSharedWorkspace,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["workspaces", userId ?? null],
      });
    },
  });
}

export function useWorkspaceCollaborationQuery(workspaceId?: number) {
  return useQuery({
    queryKey: ["workspace-collaboration", workspaceId ?? null],
    queryFn: () => fetchWorkspaceCollaboration(workspaceId as number),
    enabled: Boolean(workspaceId),
    placeholderData: (previousData) => previousData,
  });
}

export function useCreateWorkspaceInvitationMutation(workspaceId?: number, userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createWorkspaceInvitation,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["workspace-collaboration", workspaceId ?? null],
        }),
        queryClient.invalidateQueries({
          queryKey: ["workspaces", userId ?? null],
        }),
      ]);
    },
  });
}

export function useWorkspaceInvitationDetailsQuery(token?: string) {
  return useQuery({
    queryKey: ["workspace-invitation", token ?? null],
    queryFn: () => fetchWorkspaceInvitationDetails(token as string),
    enabled: Boolean(token),
  });
}

export function useAcceptWorkspaceInvitationMutation(userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: acceptWorkspaceInvitation,
    onSuccess: async (_result, token) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["workspaces", userId ?? null],
        }),
        queryClient.invalidateQueries({
          queryKey: ["workspace-invitation", token],
        }),
        queryClient.invalidateQueries({
          queryKey: ["workspace-collaboration"],
          exact: false,
        }),
      ]);
    },
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

export function useCounterpartiesOverviewQuery(workspaceId?: number) {
  return useQuery({
    queryKey: ["counterparties-overview", workspaceId ?? null],
    queryFn: () => fetchCounterpartiesOverview(workspaceId as number),
    enabled: Boolean(workspaceId),
    placeholderData: (previousData) => previousData,
  });
}

export function useCategoriesOverviewQuery(workspaceId?: number) {
  return useQuery({
    queryKey: ["categories-overview", workspaceId ?? null],
    queryFn: () => fetchCategoriesOverview(workspaceId as number),
    enabled: Boolean(workspaceId),
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

export function useEntityAttachmentsQuery(
  workspaceId?: number,
  entityType?: AttachmentEntityType,
  entityId?: number | null,
) {
  return useQuery({
    queryKey: buildEntityAttachmentsQueryKey(workspaceId, entityType, entityId),
    queryFn: () => fetchEntityAttachments(workspaceId as number, entityType as AttachmentEntityType, entityId as number),
    enabled: Boolean(workspaceId && entityType && entityId),
    placeholderData: (previousData) => previousData,
  });
}

export function useObligationSharesQuery(workspaceId?: number) {
  return useQuery({
    queryKey: ["obligation-shares", workspaceId ?? null],
    queryFn: () => fetchObligationShares(workspaceId as number),
    enabled: Boolean(workspaceId),
    placeholderData: (previousData) => previousData,
  });
}

export function useObligationShareInviteDetailsQuery(token?: string) {
  return useQuery({
    queryKey: ["obligation-share-invite", token ?? null],
    queryFn: () => fetchObligationShareInviteDetails(token as string),
    enabled: Boolean(token),
  });
}

export function useSharedObligationsQuery(userId?: string) {
  return useQuery({
    queryKey: ["shared-obligations", userId ?? null],
    queryFn: () => fetchSharedObligations(),
    enabled: Boolean(userId),
    placeholderData: (previousData) => previousData,
  });
}

export function useCurrentUserEntitlementQuery(userId?: string) {
  return useQuery({
    queryKey: ["user-entitlement", userId ?? null],
    queryFn: () => fetchUserEntitlement(userId as string),
    enabled: Boolean(userId),
    placeholderData: (previousData) => previousData,
  });
}

export function useStartProCheckoutMutation(userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: StartProCheckoutInput) => {
      const data = await invokeAuthenticatedFunction<Record<string, unknown>>(
        "create-pro-checkout",
        {
          provider: "mercado_pago",
          appUrl: input.appUrl,
          workspaceId: input.workspaceId ?? null,
        },
      );

      const checkoutUrl =
        typeof data?.checkoutUrl === "string"
          ? data.checkoutUrl
          : typeof data?.initPoint === "string"
            ? data.initPoint
            : null;

      if (!checkoutUrl) {
        throw new Error("Mercado Pago no devolvio una URL valida para continuar el checkout.");
      }

      return {
        checkoutUrl,
        provider: typeof data?.provider === "string" ? data.provider : "mercado_pago",
        subscriptionId: typeof data?.subscriptionId === "string" ? data.subscriptionId : null,
        billingStatus: typeof data?.billingStatus === "string" ? data.billingStatus : null,
      } satisfies StartProCheckoutResult;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["user-entitlement", userId ?? null],
      });
    },
  });
}

export function useCancelProSubscriptionMutation(userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const data = await invokeAuthenticatedFunction<Record<string, unknown>>(
        "cancel-pro-subscription",
        {
          provider: "mercado_pago",
        },
      );

      return {
        provider: typeof data?.provider === "string" ? data.provider : "mercado_pago",
        billingStatus: typeof data?.billingStatus === "string" ? data.billingStatus : null,
        proAccessEnabled: Boolean(data?.proAccessEnabled),
      } satisfies CancelProSubscriptionResult;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["user-entitlement", userId ?? null],
      });
    },
  });
}

export function useCreateObligationShareInviteMutation(workspaceId?: number, userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ObligationShareInviteInput) => {
      const response = (await invokeAuthenticatedFunction<ObligationShareInviteFunctionResponse>(
        "create-obligation-share-invite",
        {
          workspaceId: input.workspaceId,
          obligationId: input.obligationId,
          invitedEmail: input.invitedEmail,
          message: input.message ?? null,
          appUrl: input.appUrl ?? null,
        },
      )) as ObligationShareInviteFunctionResponse;

      if (!response.ok || !response.shareId || !response.status || !response.invitedEmail) {
        throw new Error(
          response.error ?? "No pudimos crear la invitacion para compartir este registro.",
        );
      }

      return {
        shareId: response.shareId,
        status: response.status,
        shareUrl: response.shareUrl ?? null,
        alreadyAccepted: Boolean(response.alreadyAccepted),
        emailSent: Boolean(response.emailSent),
        emailError: response.emailError ?? null,
        invitedEmail: response.invitedEmail,
        invitedDisplayName: response.invitedDisplayName ?? null,
      } satisfies ObligationShareInviteResult;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["obligation-shares", workspaceId ?? null],
        }),
        queryClient.invalidateQueries({
          queryKey: ["shared-obligations"],
          exact: false,
        }),
      ]);

      if (workspaceId) {
        await invalidateWorkspaceSnapshot(queryClient, workspaceId, userId);
      }
    },
  });
}

export function useAcceptObligationShareMutation(userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (token: string) => {
      const response = (await invokeAuthenticatedFunction<AcceptObligationShareFunctionResponse>(
        "accept-obligation-share",
        { token },
      )) as AcceptObligationShareFunctionResponse;

      if (!response.ok || !response.accepted) {
        throw new Error(response.error ?? "No pudimos aceptar esta invitacion.");
      }

      return {
        accepted: true,
        alreadyAccepted: Boolean(response.alreadyAccepted),
      };
    },
    onSuccess: async (_result, token) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["shared-obligations", userId ?? null],
        }),
        queryClient.invalidateQueries({
          queryKey: ["obligation-share-invite", token],
        }),
      ]);
    },
  });
}

export function useCreateAttachmentRecordMutation(workspaceId?: number, userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AttachmentCreateInput) => {
      const client = getClient();
      const { data, error } = await client
        .from("attachments")
        .insert({
          workspace_id: input.workspaceId,
          entity_type: input.entityType,
          entity_id: input.entityId,
          bucket_name: input.bucketName,
          file_path: input.filePath,
          file_name: input.fileName,
          mime_type: input.mimeType,
          size_bytes: input.sizeBytes,
          width: input.width ?? null,
          height: input.height ?? null,
          uploaded_by_user_id: input.uploadedByUserId,
        })
        .select(
          "id, workspace_id, entity_type, entity_id, bucket_name, file_path, file_name, mime_type, size_bytes, width, height, uploaded_by_user_id, created_at",
        )
        .single();

      if (error) {
        throw error;
      }

      const row = data as AttachmentRow;

      return {
        id: row.id,
        workspaceId: row.workspace_id,
        entityType: row.entity_type,
        entityId: row.entity_id,
        bucketName: row.bucket_name,
        filePath: row.file_path,
        fileName: row.file_name,
        mimeType: row.mime_type,
        sizeBytes: row.size_bytes,
        width: row.width,
        height: row.height,
        uploadedByUserId: row.uploaded_by_user_id,
        createdAt: row.created_at,
      } satisfies AttachmentSummary;
    },
    onSuccess: async (_attachment, input) => {
      await queryClient.invalidateQueries({
        queryKey: buildEntityAttachmentsQueryKey(input.workspaceId, input.entityType, input.entityId),
      });

      if (workspaceId) {
        await invalidateWorkspaceSnapshot(queryClient, workspaceId, userId);
      }
    },
  });
}

export function useDeleteAttachmentRecordMutation(workspaceId?: number, userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AttachmentDeleteInput) => {
      const client = getClient();
      const { error } = await client
        .from("attachments")
        .delete()
        .eq("id", input.attachmentId)
        .eq("workspace_id", input.workspaceId);

      if (error) {
        throw error;
      }
    },
    onSuccess: async (_result, input) => {
      await queryClient.invalidateQueries({
        queryKey: ["attachments", input.workspaceId],
        exact: false,
      });

      if (workspaceId) {
        await invalidateWorkspaceSnapshot(queryClient, workspaceId, userId);
      }
    },
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
    mutationFn: async (input: Pick<NotificationPreferences, "inAppEnabled" | "emailEnabled" | "pushEnabled">) => {
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

export function useSaveSmartNotificationReadsMutation(userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (smartReads: Record<string, string>) => {
      if (!userId) return;
      const client = getClient();
      const { error } = await client.from("notification_preferences").upsert({
        user_id: userId,
        smart_reads: smartReads,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notification-preferences", userId] });
    },
  });
}

export function useSaveUiPrefsMutation(userId?: string) {
  return useMutation({
    mutationFn: async (uiPrefs: UiPrefs) => {
      if (!userId) return;
      const client = getClient();
      const { error } = await client.from("notification_preferences").upsert({
        user_id: userId,
        ui_prefs: uiPrefs,
      });
      if (error) throw error;
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
    ...optimisticDelete<AccountArchiveInput>(queryClient, workspaceId, userId, (snap, input) => ({
      ...snap,
      accounts: snap.accounts.map((a) =>
        a.id === input.accountId ? { ...a, isArchived: input.isArchived } : a,
      ),
    })),
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
    ...optimisticDelete<AccountDeleteInput>(queryClient, workspaceId, userId, (snap, input) => ({
      ...snap,
      accounts: snap.accounts.filter((a) => a.id !== input.accountId),
    })),
  });
}

export function useCreateCategoryMutation(workspaceId?: number, userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CategoryMutationInput) => {
      const client = getClient();
      const { data: categoryOrderRow, error: categoryOrderError } = await client
        .from("categories")
        .select("sort_order")
        .eq("workspace_id", input.workspaceId)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (categoryOrderError) {
        throw categoryOrderError;
      }

      const nextSortOrder =
        Number.isFinite(input.sortOrder) && input.sortOrder > 0
          ? input.sortOrder
          : toNumber(categoryOrderRow?.sort_order ?? 0) + 10;

      const { error } = await client.from("categories").insert({
        workspace_id: input.workspaceId,
        created_by_user_id: input.userId,
        is_system: false,
        ...buildCategoryMutationPayload(
          {
            ...input,
            sortOrder: nextSortOrder,
          },
          input.userId,
        ),
      });

      if (error) {
        throw error;
      }
    },
    onSuccess: async () => {
      if (workspaceId) {
        await Promise.all([
          invalidateWorkspaceSnapshot(queryClient, workspaceId, userId),
          invalidateCategoriesOverview(queryClient, workspaceId),
        ]);
      }
    },
  });
}

export function useUpdateCategoryMutation(workspaceId?: number, userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CategoryUpdateInput) => {
      if (input.parentId === input.categoryId) {
        throw new Error("Una categoria no puede ser su propia categoria padre.");
      }

      const client = getClient();
      const { error } = await client
        .from("categories")
        .update(buildCategoryMutationPayload(input, input.userId))
        .eq("id", input.categoryId)
        .eq("workspace_id", input.workspaceId);

      if (error) {
        throw error;
      }
    },
    onSuccess: async () => {
      if (workspaceId) {
        await Promise.all([
          invalidateWorkspaceSnapshot(queryClient, workspaceId, userId),
          invalidateCategoriesOverview(queryClient, workspaceId),
        ]);
      }
    },
  });
}

export function useToggleCategoryMutation(workspaceId?: number, userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CategoryToggleInput) => {
      const client = getClient();
      const { error } = await client
        .from("categories")
        .update({
          updated_by_user_id: input.userId,
          is_active: input.isActive,
        })
        .eq("id", input.categoryId)
        .eq("workspace_id", input.workspaceId);

      if (error) {
        throw error;
      }
    },
    ...optimisticDelete<CategoryToggleInput>(queryClient, workspaceId, userId, (snap, input) => ({
      ...snap,
      catalogs: {
        ...snap.catalogs,
        categories: snap.catalogs.categories.map((c) =>
          c.id === input.categoryId ? { ...c, isActive: input.isActive } : c,
        ),
      },
    })),
    onSettled: async () => {
      if (workspaceId) {
        await Promise.all([
          invalidateWorkspaceSnapshot(queryClient, workspaceId, userId),
          invalidateCategoriesOverview(queryClient, workspaceId),
        ]);
      }
    },
  });
}

export function useDeleteCategoryMutation(workspaceId?: number, userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CategoryDeleteInput) => {
      const client = getClient();
      const { data: categoryData, error: categoryError } = await client
        .from("categories")
        .select("is_system")
        .eq("id", input.categoryId)
        .eq("workspace_id", input.workspaceId)
        .maybeSingle();

      if (categoryError) {
        throw categoryError;
      }

      if (categoryData?.is_system) {
        throw new Error(
          "Esta categoria pertenece a la base inicial del sistema. Puedes desactivarla, pero no eliminarla.",
        );
      }

      const [movementResult, subscriptionResult, childResult] = await Promise.all([
        client
          .from("movements")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", input.workspaceId)
          .eq("category_id", input.categoryId),
        client
          .from("subscriptions")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", input.workspaceId)
          .eq("category_id", input.categoryId),
        client
          .from("categories")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", input.workspaceId)
          .eq("parent_id", input.categoryId),
      ]);

      if (movementResult.error) {
        throw movementResult.error;
      }

      if (subscriptionResult.error) {
        throw subscriptionResult.error;
      }

      if (childResult.error) {
        throw childResult.error;
      }

      if ((movementResult.count ?? 0) > 0 || (subscriptionResult.count ?? 0) > 0) {
        throw new Error(
          "Esta categoria ya tiene movimientos o suscripciones asociadas. Desactivarla suele ser la mejor opcion.",
        );
      }

      if ((childResult.count ?? 0) > 0) {
        throw new Error(
          "Esta categoria tiene subcategorias vinculadas. Reubicalas o quitales la categoria padre antes de eliminar.",
        );
      }

      const { error } = await client
        .from("categories")
        .delete()
        .eq("id", input.categoryId)
        .eq("workspace_id", input.workspaceId);

      if (error) {
        throw error;
      }
    },
    ...optimisticDelete<CategoryDeleteInput>(queryClient, workspaceId, userId, (snap, input) => ({
      ...snap,
      catalogs: {
        ...snap.catalogs,
        categories: snap.catalogs.categories.filter((c) => c.id !== input.categoryId),
        categoriesCount: Math.max(0, snap.catalogs.categoriesCount - 1),
      },
    })),
    onSettled: async () => {
      if (workspaceId) {
        await Promise.all([
          invalidateWorkspaceSnapshot(queryClient, workspaceId, userId),
          invalidateCategoriesOverview(queryClient, workspaceId),
        ]);
      }
    },
  });
}

export function useCreateBudgetMutation(workspaceId?: number, userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: BudgetMutationInput) => {
      const client = getClient();
      const { error } = await client.from("budgets").insert({
        workspace_id: input.workspaceId,
        created_by_user_id: input.userId,
        ...buildBudgetMutationPayload(input, input.userId),
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

export function useUpdateBudgetMutation(workspaceId?: number, userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: BudgetUpdateInput) => {
      const client = getClient();
      const { error } = await client
        .from("budgets")
        .update(buildBudgetMutationPayload(input, input.userId))
        .eq("id", input.budgetId)
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

export function useToggleBudgetMutation(workspaceId?: number, userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: BudgetToggleInput) => {
      const client = getClient();
      const { error } = await client
        .from("budgets")
        .update({
          updated_by_user_id: input.userId,
          is_active: input.isActive,
        })
        .eq("id", input.budgetId)
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

export function useDeleteBudgetMutation(workspaceId?: number, userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: BudgetDeleteInput) => {
      const client = getClient();
      const { error } = await client
        .from("budgets")
        .delete()
        .eq("id", input.budgetId)
        .eq("workspace_id", input.workspaceId);

      if (error) {
        throw error;
      }
    },
    ...optimisticDelete<BudgetDeleteInput>(queryClient, workspaceId, userId, (snap, input) => ({
      ...snap,
      budgets: snap.budgets.filter((b) => b.id !== input.budgetId),
    })),
  });
}

export function useCreateCounterpartyMutation(workspaceId?: number, userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CounterpartyMutationInput) => {
      const client = getClient();
      const normalizedRoles = normalizeCounterpartyRoles(input.roles);

      const { data: counterpartyData, error: counterpartyError } = await client
        .from("counterparties")
        .insert({
          workspace_id: input.workspaceId,
          created_by_user_id: input.userId,
          ...buildCounterpartyMutationPayload(input, input.userId),
          is_archived: false,
        })
        .select("id")
        .single();

      if (counterpartyError) {
        throw counterpartyError;
      }

      if (normalizedRoles.length > 0) {
        const { error: rolesError } = await client.from("counterparty_roles").insert(
          normalizedRoles.map((role) => ({
            workspace_id: input.workspaceId,
            counterparty_id: counterpartyData.id,
            role_type: role,
          })),
        );

        if (rolesError) {
          await client
            .from("counterparties")
            .delete()
            .eq("id", counterpartyData.id)
            .eq("workspace_id", input.workspaceId);
          throw rolesError;
        }
      }

      return {
        id: counterpartyData.id as number,
      };
    },
    onSuccess: async () => {
      if (workspaceId) {
        await Promise.all([
          invalidateWorkspaceSnapshot(queryClient, workspaceId, userId),
          invalidateCounterpartiesOverview(queryClient, workspaceId),
        ]);
      }
    },
  });
}

export function useUpdateCounterpartyMutation(workspaceId?: number, userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CounterpartyUpdateInput) => {
      const client = getClient();
      const normalizedRoles = normalizeCounterpartyRoles(input.roles);
      const { error: updateError } = await client
        .from("counterparties")
        .update(buildCounterpartyMutationPayload(input, input.userId))
        .eq("id", input.counterpartyId)
        .eq("workspace_id", input.workspaceId);

      if (updateError) {
        throw updateError;
      }

      const { error: deleteRolesError } = await client
        .from("counterparty_roles")
        .delete()
        .eq("counterparty_id", input.counterpartyId)
        .eq("workspace_id", input.workspaceId);

      if (deleteRolesError) {
        throw deleteRolesError;
      }

      if (normalizedRoles.length > 0) {
        const { error: insertRolesError } = await client.from("counterparty_roles").insert(
          normalizedRoles.map((role) => ({
            workspace_id: input.workspaceId,
            counterparty_id: input.counterpartyId,
            role_type: role,
          })),
        );

        if (insertRolesError) {
          throw insertRolesError;
        }
      }
    },
    onSuccess: async () => {
      if (workspaceId) {
        await Promise.all([
          invalidateWorkspaceSnapshot(queryClient, workspaceId, userId),
          invalidateCounterpartiesOverview(queryClient, workspaceId),
        ]);
      }
    },
  });
}

export function useArchiveCounterpartyMutation(workspaceId?: number, userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CounterpartyArchiveInput) => {
      const client = getClient();
      const { error } = await client
        .from("counterparties")
        .update({
          updated_by_user_id: input.userId,
          is_archived: input.isArchived,
        })
        .eq("id", input.counterpartyId)
        .eq("workspace_id", input.workspaceId);

      if (error) {
        throw error;
      }
    },
    ...optimisticDelete<CounterpartyArchiveInput>(queryClient, workspaceId, userId, (snap, input) => ({
      ...snap,
      catalogs: {
        ...snap.catalogs,
        counterparties: snap.catalogs.counterparties.map((c) =>
          c.id === input.counterpartyId ? { ...c, isArchived: input.isArchived } : c,
        ),
      },
    })),
    onSettled: async () => {
      if (workspaceId) {
        await Promise.all([
          invalidateWorkspaceSnapshot(queryClient, workspaceId, userId),
          invalidateCounterpartiesOverview(queryClient, workspaceId),
        ]);
      }
    },
  });
}

export function useDeleteCounterpartyMutation(workspaceId?: number, userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CounterpartyDeleteInput) => {
      const client = getClient();
      const [movementResult, obligationResult, subscriptionResult] = await Promise.all([
        client
          .from("movements")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", input.workspaceId)
          .eq("counterparty_id", input.counterpartyId),
        client
          .from("obligations")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", input.workspaceId)
          .eq("counterparty_id", input.counterpartyId),
        client
          .from("subscriptions")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", input.workspaceId)
          .eq("vendor_party_id", input.counterpartyId),
      ]);

      if (movementResult.error) {
        throw movementResult.error;
      }

      if (obligationResult.error) {
        throw obligationResult.error;
      }

      if (subscriptionResult.error) {
        throw subscriptionResult.error;
      }

      if (
        (movementResult.count ?? 0) > 0 ||
        (obligationResult.count ?? 0) > 0 ||
        (subscriptionResult.count ?? 0) > 0
      ) {
        throw new Error(
          "Este contacto ya tiene movimientos, creditos, deudas o suscripciones asociadas. Archivarlo suele ser la mejor opcion.",
        );
      }

      const { error: deleteRolesError } = await client
        .from("counterparty_roles")
        .delete()
        .eq("counterparty_id", input.counterpartyId)
        .eq("workspace_id", input.workspaceId);

      if (deleteRolesError) {
        throw deleteRolesError;
      }

      const { error } = await client
        .from("counterparties")
        .delete()
        .eq("id", input.counterpartyId)
        .eq("workspace_id", input.workspaceId);

      if (error) {
        throw error;
      }
    },
    ...optimisticDelete<CounterpartyDeleteInput>(queryClient, workspaceId, userId, (snap, input) => ({
      ...snap,
      catalogs: {
        ...snap.catalogs,
        counterparties: snap.catalogs.counterparties.filter((c) => c.id !== input.counterpartyId),
        counterpartiesCount: Math.max(0, snap.catalogs.counterpartiesCount - 1),
      },
    })),
    onSettled: async () => {
      if (workspaceId) {
        await Promise.all([
          invalidateWorkspaceSnapshot(queryClient, workspaceId, userId),
          invalidateCounterpartiesOverview(queryClient, workspaceId),
        ]);
      }
    },
  });
}

function normalizeOptionalText(value?: string | null) {
  const normalizedValue = value?.trim();
  return normalizedValue ? normalizedValue : null;
}

function buildMiddayTimestampFromDate(date: string) {
  return new Date(`${date}T12:00:00`).toISOString();
}

function getObligationOpeningMovementDescription(input: ObligationFormInput) {
  const normalizedTitle = input.title.trim();

  if (input.originType === "cash_loan") {
    return input.direction === "receivable"
      ? `Prestamo entregado: ${normalizedTitle}`
      : `Dinero recibido: ${normalizedTitle}`;
  }

  return input.openingImpact === "outflow"
    ? `Salida inicial: ${normalizedTitle}`
    : `Entrada inicial: ${normalizedTitle}`;
}

function getObligationPrincipalAdjustmentDescription(
  title: string,
  eventType: ObligationPrincipalAdjustmentFormInput["eventType"],
) {
  return eventType === "principal_increase"
    ? `Aumento de principal: ${title.trim()}`
    : `Reduccion de principal: ${title.trim()}`;
}

function buildObligationPrincipalAdjustmentMovement(
  input: ObligationPrincipalAdjustmentFormInput,
  obligation: Pick<ObligationRow, "direction" | "title" | "counterparty_id">,
): MovementFormInput {
  const isReceivable = obligation.direction === "receivable";
  const isIncrease = input.eventType === "principal_increase";
  const isOutflow = isIncrease ? isReceivable : !isReceivable;
  const accountId = input.accountId ?? null;

  return {
    movementType: "adjustment",
    status: "posted",
    occurredAt: buildMiddayTimestampFromDate(input.eventDate),
    description: getObligationPrincipalAdjustmentDescription(obligation.title, input.eventType),
    notes: input.notes ?? null,
    sourceAccountId: isOutflow ? accountId : null,
    sourceAmount: isOutflow ? input.amount : null,
    destinationAccountId: isOutflow ? null : accountId,
    destinationAmount: isOutflow ? null : input.amount,
    fxRate: null,
    categoryId: null,
    counterpartyId: obligation.counterparty_id,
    obligationId: input.obligationId,
    subscriptionId: null,
    metadata: {
      obligationAdjustmentType: input.eventType,
      obligationReason: input.reason,
    },
  };
}

function buildMovementMutationPayload(input: MovementFormInput, userId: string) {
  return {
    updated_by_user_id: userId,
    movement_type: input.movementType,
    status: input.status,
    occurred_at: input.occurredAt,
    description: input.description.trim(),
    notes: normalizeOptionalText(input.notes),
    source_account_id: input.sourceAccountId,
    source_amount: input.sourceAmount,
    destination_account_id: input.destinationAccountId,
    destination_amount: input.destinationAmount,
    fx_rate: input.fxRate ?? null,
    category_id: input.categoryId ?? null,
    counterparty_id: input.counterpartyId ?? null,
    obligation_id: input.obligationId ?? null,
    subscription_id: input.subscriptionId ?? null,
    metadata: input.metadata ?? {},
  };
}

function buildObligationMutationPayload(input: ObligationFormInput, userId: string) {
  return {
    updated_by_user_id: userId,
    direction: input.direction,
    origin_type: input.originType,
    status: input.status,
    title: input.title.trim(),
    counterparty_id: input.counterpartyId,
    settlement_account_id: input.settlementAccountId ?? null,
    currency_code: input.currencyCode.trim().toUpperCase(),
    principal_amount: input.principalAmount,
    start_date: input.startDate,
    due_date: normalizeOptionalText(input.dueDate) ?? null,
    installment_amount: input.installmentAmount ?? null,
    installment_count: input.installmentCount ?? null,
    interest_rate: input.interestRate ?? null,
    description: normalizeOptionalText(input.description),
    notes: normalizeOptionalText(input.notes),
  };
}

function buildSubscriptionMutationPayload(input: SubscriptionFormInput, userId: string) {
  return {
    updated_by_user_id: userId,
    name: input.name.trim(),
    vendor_party_id: input.vendorPartyId ?? null,
    account_id: input.accountId ?? null,
    category_id: input.categoryId ?? null,
    currency_code: input.currencyCode.trim().toUpperCase(),
    amount: input.amount,
    frequency: input.frequency,
    interval_count: input.intervalCount,
    day_of_month: input.dayOfMonth ?? null,
    day_of_week: input.dayOfWeek ?? null,
    start_date: input.startDate,
    next_due_date: input.nextDueDate,
    end_date: normalizeOptionalText(input.endDate) ?? null,
    status: input.status,
    auto_create_movement: input.autoCreateMovement,
    remind_days_before: input.remindDaysBefore,
    description: normalizeOptionalText(input.description),
    notes: normalizeOptionalText(input.notes),
  };
}

function buildBudgetMutationPayload(input: BudgetFormInput, userId: string) {
  return {
    updated_by_user_id: userId,
    name: input.name.trim(),
    period_start: input.periodStart,
    period_end: input.periodEnd,
    currency_code: input.currencyCode.trim().toUpperCase(),
    category_id: input.categoryId ?? null,
    account_id: input.accountId ?? null,
    limit_amount: input.limitAmount,
    rollover_enabled: input.rolloverEnabled,
    alert_percent: input.alertPercent,
    notes: normalizeOptionalText(input.notes),
    is_active: input.isActive,
  };
}

function normalizeCounterpartyRoles(roles: CounterpartyRoleType[]) {
  return [...new Set(roles)].sort();
}

function buildCategoryMutationPayload(input: CategoryFormInput, userId: string) {
  return {
    updated_by_user_id: userId,
    name: input.name.trim(),
    kind: input.kind,
    parent_id: input.parentId ?? null,
    color: normalizeOptionalText(input.color),
    icon: normalizeOptionalText(input.icon),
    sort_order: input.sortOrder,
    is_active: input.isActive,
  };
}

function buildCounterpartyMutationPayload(input: CounterpartyFormInput, userId: string) {
  return {
    updated_by_user_id: userId,
    name: input.name.trim(),
    type: input.type,
    phone: normalizeOptionalText(input.phone),
    email: normalizeOptionalText(input.email),
    document_number: normalizeOptionalText(input.documentNumber),
    notes: normalizeOptionalText(input.notes),
  };
}

export function useCreateMovementMutation(workspaceId?: number, userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: MovementMutationInput) => {
      const client = getClient();
      const { data, error } = await client
        .from("movements")
        .insert({
          workspace_id: input.workspaceId,
          created_by_user_id: input.userId,
          ...buildMovementMutationPayload(input, input.userId),
        })
        .select("id")
        .single();

      if (error) {
        throw error;
      }

      return data.id as number;
    },
    onSuccess: async () => {
      if (workspaceId) {
        await invalidateWorkspaceSnapshot(queryClient, workspaceId, userId);
      }
    },
  });
}

export function useUpdateMovementMutation(workspaceId?: number, userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: MovementUpdateInput) => {
      const client = getClient();
      const { error } = await client
        .from("movements")
        .update(buildMovementMutationPayload(input, input.userId))
        .eq("id", input.movementId)
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

export function useDeleteMovementMutation(workspaceId?: number, userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: MovementDeleteInput) => {
      const client = getClient();
      const { error } = await client
        .from("movements")
        .delete()
        .eq("id", input.movementId)
        .eq("workspace_id", input.workspaceId);

      if (error) {
        throw error;
      }
    },
    ...optimisticDelete<MovementDeleteInput>(queryClient, workspaceId, userId, (snap, input) => ({
      ...snap,
      movements: snap.movements.filter((m) => m.id !== input.movementId),
    })),
  });
}

export function useCreateObligationMutation(workspaceId?: number, userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ObligationMutationInput) => {
      const client = getClient();
      const normalizedOpeningImpact = input.openingImpact ?? "none";
      let createdObligationId: number | null = null;
      let createdMovementId: number | null = null;

      try {
        const { data: obligationData, error: obligationError } = await client
          .from("obligations")
          .insert({
            workspace_id: input.workspaceId,
            created_by_user_id: input.userId,
            ...buildObligationMutationPayload(input, input.userId),
          })
          .select("id")
          .single();

        if (obligationError) {
          throw obligationError;
        }

        createdObligationId = obligationData.id as number;

        if (normalizedOpeningImpact !== "none") {
          if (!input.openingAccountId) {
            throw new Error("Necesitamos una cuenta inicial para registrar la apertura.");
          }

          const openingMovement: MovementFormInput = {
            movementType: "obligation_opening",
            status: "posted",
            occurredAt: buildMiddayTimestampFromDate(input.startDate),
            description: getObligationOpeningMovementDescription(input),
            notes: null,
            sourceAccountId: normalizedOpeningImpact === "outflow" ? input.openingAccountId : null,
            sourceAmount: normalizedOpeningImpact === "outflow" ? input.principalAmount : null,
            destinationAccountId: normalizedOpeningImpact === "inflow" ? input.openingAccountId : null,
            destinationAmount: normalizedOpeningImpact === "inflow" ? input.principalAmount : null,
            fxRate: null,
            categoryId: null,
            counterpartyId: input.counterpartyId,
            obligationId: createdObligationId,
            subscriptionId: null,
            metadata: {
              openingImpact: normalizedOpeningImpact,
              originType: input.originType,
            },
          };

          const { data: movementData, error: movementError } = await client
            .from("movements")
            .insert({
              workspace_id: input.workspaceId,
              created_by_user_id: input.userId,
              ...buildMovementMutationPayload(openingMovement, input.userId),
            })
            .select("id")
            .single();

          if (movementError) {
            throw movementError;
          }

          createdMovementId = movementData.id as number;
        }

        const { error: openingEventError } = await client.from("obligation_events").insert({
          obligation_id: createdObligationId,
          event_type: "opening",
          event_date: input.startDate,
          amount: input.principalAmount,
          reason: null,
          description: "Apertura del registro",
          notes: null,
          movement_id: createdMovementId,
          created_by_user_id: input.userId,
          metadata: {
            openingImpact: normalizedOpeningImpact,
            openingAccountId: input.openingAccountId ?? null,
            originType: input.originType,
          },
        });

        if (openingEventError) {
          throw openingEventError;
        }

        return createdObligationId;
      } catch (error) {
        if (createdMovementId !== null) {
          await client
            .from("movements")
            .delete()
            .eq("id", createdMovementId)
            .eq("workspace_id", input.workspaceId);
        }

        if (createdObligationId !== null) {
          await client
            .from("obligations")
            .delete()
            .eq("id", createdObligationId)
            .eq("workspace_id", input.workspaceId);
        }

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

export function useUpdateObligationMutation(workspaceId?: number, userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ObligationUpdateInput) => {
      const client = getClient();
      const { error } = await client
        .from("obligations")
        .update(buildObligationMutationPayload(input, input.userId))
        .eq("id", input.obligationId)
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

export function useDeleteObligationMutation(workspaceId?: number, userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ObligationDeleteInput) => {
      const client = getClient();
      const relatedMovementsResult = await client
        .from("movements")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", input.workspaceId)
        .eq("obligation_id", input.obligationId);

      if (relatedMovementsResult.error) {
        throw relatedMovementsResult.error;
      }

      if ((relatedMovementsResult.count ?? 0) > 0) {
        throw new Error(
          "Esta deuda o credito tiene movimientos asociados. Desvinculalos o eliminalos antes de borrarlo.",
        );
      }

      const { error: eventDeleteError } = await client
        .from("obligation_events")
        .delete()
        .eq("obligation_id", input.obligationId);

      if (eventDeleteError) {
        throw eventDeleteError;
      }

      const { error } = await client
        .from("obligations")
        .delete()
        .eq("id", input.obligationId)
        .eq("workspace_id", input.workspaceId);

      if (error) {
        throw error;
      }
    },
    ...optimisticDelete<ObligationDeleteInput>(queryClient, workspaceId, userId, (snap, input) => ({
      ...snap,
      obligations: snap.obligations.filter((o) => o.id !== input.obligationId),
    })),
  });
}

export function useRegisterObligationPaymentMutation(workspaceId?: number, userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ObligationPaymentMutationInput) => {
      const client = getClient();
      const { error: insertError } = await client.from("obligation_events").insert({
        obligation_id: input.obligationId,
        event_type: "payment",
        event_date: input.eventDate,
        amount: input.amount,
        installment_no: input.installmentNo ?? null,
        reason: null,
        description: normalizeOptionalText(input.description),
        notes: normalizeOptionalText(input.notes),
        movement_id: input.movementId ?? null,
        created_by_user_id: input.userId,
        metadata: {},
      });

      if (insertError) {
        throw insertError;
      }

      if (input.nextStatus) {
        const { error: updateError } = await client
          .from("obligations")
          .update({
            updated_by_user_id: input.userId,
            status: input.nextStatus,
          })
          .eq("id", input.obligationId)
          .eq("workspace_id", input.workspaceId);

        if (updateError) {
          throw updateError;
        }
      }
    },
    onSuccess: async () => {
      if (workspaceId) {
        await invalidateWorkspaceSnapshot(queryClient, workspaceId, userId);
      }
    },
  });
}

export function useAdjustObligationPrincipalMutation(workspaceId?: number, userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ObligationPrincipalAdjustmentMutationInput) => {
      const client = getClient();
      let createdMovementId: number | null = null;
      let createdEventId: number | null = null;

      try {
        const { data: obligationData, error: obligationError } = await client
          .from("obligations")
          .select(
            "id, workspace_id, direction, origin_type, status, title, counterparty_id, settlement_account_id, currency_code, principal_amount, start_date, due_date, installment_amount, installment_count, interest_rate, description, notes",
          )
          .eq("id", input.obligationId)
          .eq("workspace_id", input.workspaceId)
          .single();

        if (obligationError) {
          throw obligationError;
        }

        const obligationRow = obligationData as ObligationRow;
        const shouldRegisterMovement = Boolean(input.registerAccountMovement);

        if (shouldRegisterMovement) {
          if (!input.accountId) {
            throw new Error("Necesitamos una cuenta para registrar el movimiento asociado.");
          }

          const { data: accountData, error: accountError } = await client
            .from("accounts")
            .select("id, workspace_id, currency_code")
            .eq("id", input.accountId)
            .eq("workspace_id", input.workspaceId)
            .single();

          if (accountError) {
            throw accountError;
          }

          if ((accountData?.currency_code ?? "").trim().toUpperCase() !== obligationRow.currency_code) {
            throw new Error(
              `La cuenta elegida debe estar en ${obligationRow.currency_code} para registrar este ajuste sin conversion.`,
            );
          }

          const adjustmentMovement = buildObligationPrincipalAdjustmentMovement(input, obligationRow);
          const { data: movementData, error: movementError } = await client
            .from("movements")
            .insert({
              workspace_id: input.workspaceId,
              created_by_user_id: input.userId,
              ...buildMovementMutationPayload(adjustmentMovement, input.userId),
            })
            .select("id")
            .single();

          if (movementError) {
            throw movementError;
          }

          createdMovementId = movementData.id as number;
        }

        const eventDescription =
          input.eventType === "principal_increase" ? "Aumento de principal" : "Reduccion de principal";
        const { data: eventData, error: eventError } = await client
          .from("obligation_events")
          .insert({
            obligation_id: input.obligationId,
            event_type: input.eventType,
            event_date: input.eventDate,
            amount: input.amount,
            installment_no: null,
            reason: input.reason.trim(),
            description: eventDescription,
            notes: normalizeOptionalText(input.notes),
            movement_id: createdMovementId,
            created_by_user_id: input.userId,
            metadata: {
              registerAccountMovement: shouldRegisterMovement,
              accountId: input.accountId ?? null,
            },
          })
          .select("id")
          .single();

        if (eventError) {
          throw eventError;
        }

        createdEventId = eventData.id as number;

        const delta = input.eventType === "principal_increase" ? input.amount : input.amount * -1;
        const nextPrincipalAmount = Math.max(0, input.currentPrincipalAmount + delta);
        const nextPendingAmount = Math.max(0, input.currentPendingAmount + delta);
        const nextStatus = input.nextStatus ?? obligationRow.status;

        const { error: historyError } = await client.from("obligation_change_history").insert({
          workspace_id: input.workspaceId,
          obligation_id: input.obligationId,
          change_type: input.eventType,
          reason: input.reason.trim(),
          changed_by_user_id: input.userId,
          before_data: {
            principal_initial_amount: toNumber(obligationRow.principal_amount),
            principal_current_amount: input.currentPrincipalAmount,
            pending_amount: input.currentPendingAmount,
            status: obligationRow.status,
          },
          after_data: {
            principal_initial_amount: toNumber(obligationRow.principal_amount),
            principal_current_amount: nextPrincipalAmount,
            pending_amount: nextPendingAmount,
            status: nextStatus,
          },
          metadata: {
            event_id: createdEventId,
            movement_id: createdMovementId,
            registerAccountMovement: shouldRegisterMovement,
          },
        });

        if (historyError) {
          throw historyError;
        }

        if (nextStatus !== obligationRow.status) {
          const { error: statusError } = await client
            .from("obligations")
            .update({
              updated_by_user_id: input.userId,
              status: nextStatus,
            })
            .eq("id", input.obligationId)
            .eq("workspace_id", input.workspaceId);

          if (statusError) {
            throw statusError;
          }
        }
      } catch (error) {
        if (createdEventId !== null) {
          await client.from("obligation_events").delete().eq("id", createdEventId);
        }

        if (createdMovementId !== null) {
          await client
            .from("movements")
            .delete()
            .eq("id", createdMovementId)
            .eq("workspace_id", input.workspaceId);
        }

        throw error;
      }
    },
    onSuccess: async () => {
      if (workspaceId) {
        await Promise.all([
          invalidateWorkspaceSnapshot(queryClient, workspaceId, userId),
          invalidateCounterpartiesOverview(queryClient, workspaceId),
        ]);
      }
    },
  });
}

export function useCreateSubscriptionMutation(workspaceId?: number, userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SubscriptionMutationInput) => {
      const client = getClient();
      const { error } = await client.from("subscriptions").insert({
        workspace_id: input.workspaceId,
        created_by_user_id: input.userId,
        ...buildSubscriptionMutationPayload(input, input.userId),
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

export function useUpdateSubscriptionMutation(workspaceId?: number, userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SubscriptionUpdateInput) => {
      const client = getClient();
      const { error } = await client
        .from("subscriptions")
        .update(buildSubscriptionMutationPayload(input, input.userId))
        .eq("id", input.subscriptionId)
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

export function useDeleteSubscriptionMutation(workspaceId?: number, userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SubscriptionDeleteInput) => {
      const client = getClient();
      const relatedMovementsResult = await client
        .from("movements")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", input.workspaceId)
        .eq("subscription_id", input.subscriptionId);

      if (relatedMovementsResult.error) {
        throw relatedMovementsResult.error;
      }

      if ((relatedMovementsResult.count ?? 0) > 0) {
        throw new Error(
          "Esta suscripcion tiene movimientos asociados. Desvinculalos o eliminalos antes de borrarla.",
        );
      }

      const { error: occurrenceDeleteError } = await client
        .from("subscription_occurrences")
        .delete()
        .eq("subscription_id", input.subscriptionId);

      if (occurrenceDeleteError) {
        const message = String(occurrenceDeleteError.message ?? "").toLowerCase();

        if (!message.includes("subscription_occurrences")) {
          throw occurrenceDeleteError;
        }
      }

      const { error } = await client
        .from("subscriptions")
        .delete()
        .eq("id", input.subscriptionId)
        .eq("workspace_id", input.workspaceId);

      if (error) {
        throw error;
      }
    },
    ...optimisticDelete<SubscriptionDeleteInput>(queryClient, workspaceId, userId, (snap, input) => ({
      ...snap,
      subscriptions: snap.subscriptions.filter((s) => s.id !== input.subscriptionId),
    })),
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

export function useMarkNotificationReadMutation(userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: number) => {
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
        .eq("id", notificationId);

      if (error) {
        throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
    },
  });
}
