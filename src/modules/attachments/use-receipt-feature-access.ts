import { useMemo } from "react";

import { useProFeatureAccess } from "../shared/use-pro-feature-access";

export function useReceiptFeatureAccess() {
  const { canAccessProFeatures, isAdminOverride, isLoadingEntitlement } = useProFeatureAccess();

  return useMemo(
    () => ({
      canUploadReceipts: canAccessProFeatures,
      isAdminOverride,
      isLoadingEntitlement,
      accessMessage: isAdminOverride
        ? "Tu cuenta administradora tiene acceso total a comprobantes."
        : "Los comprobantes forman parte de DarkMoney Pro. Cuando el usuario tenga acceso Pro, aqui podra subir y gestionar archivos.",
    }),
    [canAccessProFeatures, isAdminOverride, isLoadingEntitlement],
  );
}
