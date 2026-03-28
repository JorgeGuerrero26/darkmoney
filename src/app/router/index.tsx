import type { ComponentType } from "react";
import { createBrowserRouter } from "react-router-dom";

import { AppShell } from "../layouts/app-shell";
import { AuthShell } from "../layouts/auth-shell";
import { PublicShell } from "../layouts/public-shell";
import { RouteErrorPage } from "../../modules/shared/pages/route-error-page";
import { HomeRedirect } from "../guards/home-redirect";
import { PublicOnly } from "../guards/public-only";
import { RequireAuth } from "../guards/require-auth";

function lazyRoute<TModule extends Record<string, unknown>, TKey extends keyof TModule>(
  importer: () => Promise<TModule>,
  exportName: TKey,
) {
  return async () => {
    const module = await importer();

    return {
      Component: module[exportName] as ComponentType,
    };
  };
}

function lazyProtectedRoute<TModule extends Record<string, unknown>, TKey extends keyof TModule>(
  importer: () => Promise<TModule>,
  exportName: TKey,
) {
  return async () => {
    const module = await importer();
    const Component = module[exportName] as ComponentType;

    return {
      Component: () => (
        <RequireAuth>
          <Component />
        </RequireAuth>
      ),
    };
  };
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <HomeRedirect />,
    errorElement: <RouteErrorPage />,
  },
  {
    element: <PublicShell />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        path: "pricing",
        lazy: lazyRoute(() => import("../../modules/public/pages/pricing-page"), "PricingPage"),
      },
      {
        path: "terms",
        lazy: lazyRoute(() => import("../../modules/public/pages/terms-page"), "TermsPage"),
      },
      {
        path: "privacy",
        lazy: lazyRoute(() => import("../../modules/public/pages/privacy-page"), "PrivacyPage"),
      },
      {
        path: "refunds",
        lazy: lazyRoute(() => import("../../modules/public/pages/refunds-page"), "RefundsPage"),
      },
      {
        path: "libro-reclamaciones",
        lazy: lazyRoute(
          () => import("../../modules/public/pages/claim-book-page"),
          "ClaimBookPage",
        ),
      },
    ],
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
        lazy: lazyRoute(() => import("../../modules/auth/pages/login-page"), "LoginPage"),
      },
      {
        path: "register",
        lazy: lazyRoute(() => import("../../modules/auth/pages/register-page"), "RegisterPage"),
      },
      {
        path: "recovery",
        lazy: lazyRoute(() => import("../../modules/auth/pages/recovery-page"), "RecoveryPage"),
      },
    ],
  },
  {
    path: "/share/obligations/:token",
    lazy: lazyRoute(
      () => import("../../modules/obligations/pages/obligation-share-invite-page"),
      "ObligationShareInvitePage",
    ),
    errorElement: <RouteErrorPage />,
  },
  {
    path: "/share/workspaces/:token",
    lazy: lazyRoute(
      () => import("../../modules/workspaces/pages/workspace-invite-page"),
      "WorkspaceInvitePage",
    ),
    errorElement: <RouteErrorPage />,
  },
  {
    path: "/auth/reset-password",
    element: <AuthShell />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        index: true,
        lazy: lazyRoute(
          () => import("../../modules/auth/pages/reset-password-page"),
          "ResetPasswordPage",
        ),
      },
    ],
  },
  {
    path: "/onboarding",
    lazy: lazyProtectedRoute(
      () => import("../../modules/auth/pages/onboarding-page"),
      "OnboardingPage",
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
        lazy: lazyRoute(() => import("../../modules/dashboard/pages/dashboard-page"), "DashboardPage"),
      },
      {
        path: "accounts",
        lazy: lazyRoute(() => import("../../modules/accounts/pages/accounts-page"), "AccountsPage"),
      },
      {
        path: "movements",
        lazy: lazyRoute(() => import("../../modules/movements/pages/movements-page"), "MovementsPage"),
      },
      {
        path: "contacts",
        lazy: lazyRoute(() => import("../../modules/contacts/pages/contacts-page"), "ContactsPage"),
      },
      {
        path: "categories",
        lazy: lazyRoute(() => import("../../modules/categories/pages/categories-page"), "CategoriesPage"),
      },
      {
        path: "budgets",
        lazy: lazyRoute(() => import("../../modules/budgets/pages/budgets-page"), "BudgetsPage"),
      },
      {
        path: "obligations",
        lazy: lazyRoute(() => import("../../modules/obligations/pages/obligations-page"), "ObligationsPage"),
      },
      {
        path: "subscriptions",
        lazy: lazyRoute(
          () => import("../../modules/subscriptions/pages/subscriptions-page"),
          "SubscriptionsPage",
        ),
      },
      {
        path: "notifications",
        lazy: lazyRoute(
          () => import("../../modules/notifications/pages/notifications-page"),
          "NotificationsPage",
        ),
      },
      {
        path: "settings",
        lazy: lazyRoute(() => import("../../modules/settings/pages/settings-page"), "SettingsPage"),
      },
    ],
  },
  {
    path: "*",
    lazy: lazyRoute(() => import("../../modules/shared/pages/not-found-page"), "NotFoundPage"),
  },
]);
