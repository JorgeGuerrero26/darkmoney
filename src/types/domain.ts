export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";
export type WorkspaceKind = "personal" | "shared";
export type MovementStatus = "planned" | "pending" | "posted" | "voided";
export type MovementType =
  | "expense"
  | "income"
  | "transfer"
  | "subscription_payment"
  | "obligation_opening"
  | "obligation_payment"
  | "refund"
  | "adjustment";
export type ObligationDirection = "receivable" | "payable";
export type SubscriptionStatus = "active" | "paused" | "cancelled";

export type UserProfile = {
  id: string;
  fullName: string;
  email: string;
  initials: string;
  baseCurrencyCode: string;
  timezone: string;
};

export type Workspace = {
  id: number;
  name: string;
  kind: WorkspaceKind;
  role: WorkspaceRole;
  description: string;
  baseCurrencyCode: string;
  isDefaultWorkspace?: boolean;
  isArchived?: boolean;
  joinedAt?: string | null;
  ownerUserId?: string;
};

export type AccountSummary = {
  id: number;
  workspaceId: number;
  name: string;
  type: string;
  currencyCode: string;
  openingBalance: number;
  currentBalance: number;
  includeInNetWorth: boolean;
  lastActivity: string;
  color: string;
  icon: string;
  isArchived: boolean;
};

export type MovementRecord = {
  id: number;
  workspaceId: number;
  movementType: MovementType;
  status: MovementStatus;
  description: string;
  category: string;
  counterparty: string;
  occurredAt: string;
  sourceAccountId: number | null;
  sourceAccountName: string | null;
  sourceCurrencyCode?: string | null;
  sourceAmount: number | null;
  destinationAccountId: number | null;
  destinationAccountName: string | null;
  destinationCurrencyCode?: string | null;
  destinationAmount: number | null;
};

export type ObligationSummary = {
  id: number;
  workspaceId: number;
  title: string;
  direction: ObligationDirection;
  counterparty: string;
  status: string;
  currencyCode: string;
  principalAmount: number;
  pendingAmount: number;
  progressPercent: number;
  dueDate: string | null;
  installmentLabel: string;
};

export type SubscriptionSummary = {
  id: number;
  workspaceId: number;
  name: string;
  vendor: string;
  status: SubscriptionStatus;
  amount: number;
  currencyCode: string;
  frequency: string;
  nextDueDate: string;
  remindDaysBefore: number;
  accountName?: string | null;
  autoCreateMovement?: boolean;
};

export type NotificationItem = {
  id: number;
  title: string;
  body: string;
  status: "pending" | "sent" | "read" | "failed";
  scheduledFor: string;
  kind: string;
  channel?: string;
  readAt?: string | null;
};

export type ActivityItem = {
  id: number;
  workspaceId: number;
  actor: string;
  action: string;
  entity: string;
  description: string;
  createdAt: string;
};
