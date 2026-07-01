import type { PropsWithChildren } from "react";
import { Navigate } from "react-router-dom";

import { useAuth } from "../../modules/auth/auth-context";

export function PublicHomeGate({ children }: PropsWithChildren) {
  const { isLoading, user } = useAuth();

  // La home es pública: no bloqueamos su render con la pantalla de "validando
  // acceso" mientras se resuelve la sesión (se veía como una alerta encima de la
  // landing). Mostramos la landing de una vez y solo redirigimos a /app cuando
  // ya se confirmó que hay usuario.
  if (user && !isLoading) {
    return (
      <Navigate
        replace
        to="/app"
      />
    );
  }

  return <>{children}</>;
}
