import { Navigate } from "react-router-dom";

import { useAuth } from "../../modules/auth/auth-context";
import { AuthLoadingScreen } from "./auth-loading-screen";

export function HomeRedirect() {
  const { isLoading, user } = useAuth();

  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  return (
    <Navigate
      replace
      to={user ? "/app" : "/auth/login"}
    />
  );
}
