import type { PropsWithChildren } from "react";
import { Navigate } from "react-router-dom";

import { useAuth } from "../../modules/auth/auth-context";
import { AuthLoadingScreen } from "./auth-loading-screen";

export function RequireAuth({ children }: PropsWithChildren) {
  const { isConfigured, isLoading, user } = useAuth();

  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  if (!isConfigured) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-glow px-6 text-ink">
        <div className="glass-panel-strong max-w-2xl rounded-[32px] p-8 text-center">
          <p className="text-xs uppercase tracking-[0.28em] text-storm">Configuracion requerida</p>
          <h1 className="mt-4 font-display text-3xl font-semibold">Faltan las credenciales de Supabase</h1>
          <p className="mt-3 text-sm leading-7 text-storm">
            Completa `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en `.env` y reinicia la app.
          </p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/auth/login"
        replace
      />
    );
  }

  return children;
}
