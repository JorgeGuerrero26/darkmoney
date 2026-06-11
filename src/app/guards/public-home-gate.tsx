import type { PropsWithChildren } from "react";
import { Navigate } from "react-router-dom";

import { useAuth } from "../../modules/auth/auth-context";
import { AuthLoadingScreen } from "./auth-loading-screen";

export function PublicHomeGate({ children }: PropsWithChildren) {
  const { isLoading, user } = useAuth();

  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  if (user) {
    return (
      <Navigate
        replace
        to="/app"
      />
    );
  }

  return <>{children}</>;
}
