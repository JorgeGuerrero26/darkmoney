import { createBrowserRouter } from "react-router-dom";

import { AppShell } from "../layouts/app-shell";
import { AuthShell } from "../layouts/auth-shell";
import { DashboardPage } from "../../modules/dashboard/pages/dashboard-page";
import { AccountsPage } from "../../modules/accounts/pages/accounts-page";
import { MovementsPage } from "../../modules/movements/pages/movements-page";
import { ObligationsPage } from "../../modules/obligations/pages/obligations-page";
import { SubscriptionsPage } from "../../modules/subscriptions/pages/subscriptions-page";
import { NotificationsPage } from "../../modules/notifications/pages/notifications-page";
import { SettingsPage } from "../../modules/settings/pages/settings-page";
import { LoginPage } from "../../modules/auth/pages/login-page";
import { RegisterPage } from "../../modules/auth/pages/register-page";
import { RecoveryPage } from "../../modules/auth/pages/recovery-page";
import { OnboardingPage } from "../../modules/auth/pages/onboarding-page";
import { NotFoundPage } from "../../modules/shared/pages/not-found-page";
import { HomeRedirect } from "../guards/home-redirect";
import { PublicOnly } from "../guards/public-only";
import { RequireAuth } from "../guards/require-auth";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <HomeRedirect />,
  },
  {
    path: "/auth",
    element: (
      <PublicOnly>
        <AuthShell />
      </PublicOnly>
    ),
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
    path: "/onboarding",
    element: (
      <RequireAuth>
        <OnboardingPage />
      </RequireAuth>
    ),
  },
  {
    path: "/app",
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
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
