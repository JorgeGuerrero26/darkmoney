import {
  mockAccounts,
  mockActivity,
  mockCashflow,
  mockMovements,
  mockNotifications,
  mockObligations,
  mockSubscriptions,
  mockWorkspaces,
} from "./mock-data";

export function getWorkspaceSnapshot(workspaceId: number) {
  const workspace = mockWorkspaces.find((item) => item.id === workspaceId) ?? mockWorkspaces[0];
  const accounts = mockAccounts.filter((item) => item.workspaceId === workspace.id);
  const movements = mockMovements.filter((item) => item.workspaceId === workspace.id);
  const obligations = mockObligations.filter((item) => item.workspaceId === workspace.id);
  const subscriptions = mockSubscriptions.filter((item) => item.workspaceId === workspace.id);
  const activity = mockActivity.filter((item) => item.workspaceId === workspace.id);
  const notifications = mockNotifications;

  const balance = accounts.reduce((total, account) => total + account.currentBalance, 0);
  const archivedCount = accounts.filter((account) => account.isArchived).length;
  const postedCount = movements.filter((movement) => movement.status === "posted").length;
  const pendingCount = movements.filter((movement) => movement.status === "pending").length;

  return {
    workspace,
    accounts,
    movements,
    obligations,
    subscriptions,
    activity,
    notifications,
    cashflow: mockCashflow,
    metrics: {
      balance,
      archivedCount,
      postedCount,
      pendingCount,
    },
  };
}
