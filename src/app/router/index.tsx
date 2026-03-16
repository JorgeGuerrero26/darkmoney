import { createBrowserRouter } from "react-router-dom";

import { AppShell } from "../layouts/app-shell";
import { AuthShell } from "../layouts/auth-shell";
import { DashboardPage } from "../../modules/dashboard/pages/dashboard-page";
import { AccountsPage } from "../../modules/accounts/pages/accounts-page";
import { MovementsPage } from "../../modules/movements/pages/movements-page";
import { ObligationsPage } from "../../modules/obligations/pages/obligations-page";
import { ObligationShareInvitePage } from "../../modules/obligations/pages/obligation-share-invite-page";
import { ContactsPage } from "../../modules/contacts/pages/contacts-page";
import { CategoriesPage } from "../../modules/categories/pages/categories-page";
import { BudgetsPage } from "../../modules/budgets/pages/budgets-page";
import { SubscriptionsPage } from "../../modules/subscriptions/pages/subscriptions-page";
import { NotificationsPage } from "../../modules/notifications/pages/notifications-page";
import { SettingsPage } from "../../modules/settings/pages/settings-page";
import { LoginPage } from "../../modules/auth/pages/login-page";
import { RegisterPage } from "../../modules/auth/pages/register-page";
import { RecoveryPage } from "../../modules/auth/pages/recovery-page";
import { OnboardingPage } from "../../modules/auth/pages/onboarding-page";
import { WorkspaceInvitePage } from "../../modules/workspaces/pages/workspace-invite-page";
import { NotFoundPage } from "../../modules/shared/pages/not-found-page";
import { RouteErrorPage } from "../../modules/shared/pages/route-error-page";
import { HomeRedirect } from "../guards/home-redirect";
import { PublicOnly } from "../guards/public-only";
import { RequireAuth } from "../guards/require-auth";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <HomeRedirect />,
    errorElement: <RouteErrorPage />,
  },
  {
    path: "/auth",
    element: (
      <PublicOnly>
        <AuthShell />
      </PublicOnly>
    ),
    errorElement: <RouteErrorPage />,
    children: [
      {
        path: "login",
        element: <LoginPage />,
      },
      {
        path: "register",
        element: <RegisterPage />,
      },
      {
        path: "recovery",
        element: <RecoveryPage />,
      },
    ],
  },
  {
    path: "/share/obligations/:token",
    element: <ObligationShareInvitePage />,
    errorElement: <RouteErrorPage />,
  },
  {
    path: "/share/workspaces/:token",
    element: <WorkspaceInvitePage />,
    errorElement: <RouteErrorPage />,
  },
  {
    path: "/onboarding",
    element: (
      <RequireAuth>
        <OnboardingPage />
      </RequireAuth>
    ),
    errorElement: <RouteErrorPage />,
  },
  {
    path: "/app",
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    errorElement: <RouteErrorPage />,
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: "accounts",
        element: <AccountsPage />,
      },
      {
        path: "movements",
        element: <MovementsPage />,
      },
      {
        path: "contacts",
        element: <ContactsPage />,
      },
      {
        path: "categories",
        element: <CategoriesPage />,
      },
      {
        path: "budgets",
        element: <BudgetsPage />,
      },
      {
        path: "obligations",
        element: <ObligationsPage />,
      },
      {
        path: "subscriptions",
        element: <SubscriptionsPage />,
      },
      {
        path: "notifications",
        element: <NotificationsPage />,
      },
      {
        path: "settings",
        element: <SettingsPage />,
      },
    ],
  },
  {
    path: "*",
    element: <NotFoundPage />,
  },
]);
