import type { PropsWithChildren } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../../modules/auth/auth-context";
import { resolvePostAuthPath } from "../../modules/auth/invite-resume";
import { AuthLoadingScreen } from "./auth-loading-screen";

export function PublicOnly({ children }: PropsWithChildren) {
  const { isLoading, user } = useAuth();
  const location = useLocation();
  const redirectTarget = resolvePostAuthPath(
    new URLSearchParams(location.search).get("next"),
  );

  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  if (user) {
    return (
      <Navigate
        to={redirectTarget}
        replace
      />
    );
  }

  return children;
}
