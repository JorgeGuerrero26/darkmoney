import { useMemo } from "react";

import { useCurrentUserEntitlementQuery } from "../../services/queries/workspace-data";
import { useAuth } from "../auth/auth-context";

export const PRO_ADMIN_EMAIL = "joradrianmori@gmail.com";

function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() ?? "";
}

export function useProFeatureAccess() {
  const { profile, user } = useAuth();
  const entitlementQuery = useCurrentUserEntitlementQuery(user?.id);
  const currentEmail = normalizeEmail(user?.email ?? profile?.email);
  const isAdminOverride = currentEmail === PRO_ADMIN_EMAIL;
  const canAccessProFeatures = isAdminOverride || Boolean(entitlementQuery.data?.proAccessEnabled);

  return useMemo(
    () => ({
      canAccessProFeatures,
      isAdminOverride,
      isLoadingEntitlement: entitlementQuery.isLoading && !isAdminOverride,
      genericAccessMessage: isAdminOverride
        ? "Tu cuenta administradora tiene acceso total a las funciones Pro."
        : "Esta funcion forma parte de DarkMoney Pro. Cuando el usuario tenga acceso Pro, aqui se desbloqueara automaticamente.",
    }),
    [canAccessProFeatures, entitlementQuery.isLoading, isAdminOverride],
  );
}
