/**
 * Iniciar sesión con Google en la web.
 *
 * El navegador va a Google y vuelve a `/auth/login` (con el `next` que hubiera, p. ej. una invitación); supabase-js recoge
 * la sesión de la URL al volver y `PublicOnly` lleva a donde tocaba. Igual que en la app móvil, el botón solo aparece si
 * Google está activado en Supabase (`/auth/v1/settings`).
 */

/** A dónde vuelve Google. Debe estar permitido en Supabase → Authentication → URL Configuration → Redirect URLs. */
export function buildGoogleRedirectUrl(origin: string, nextPath?: string | null): string {
  const url = new URL("/auth/login", origin);
  if (nextPath) url.searchParams.set("next", nextPath);
  return url.toString();
}

let enabledCheck: Promise<boolean> | null = null;

/**
 * ¿Está activado Google en Supabase? Un fallo (sin red) da false y no se recuerda: se vuelve a preguntar la próxima vez.
 */
export function isGoogleSignInEnabled(
  supabaseUrl: string | undefined,
  anonKey: string | undefined,
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  if (!supabaseUrl || !anonKey) return Promise.resolve(false);
  if (!enabledCheck) {
    const check = fetcher(`${supabaseUrl}/auth/v1/settings`, { headers: { apikey: anonKey } })
      .then((response) => (response.ok ? response.json() : null))
      .then((settings: { external?: { google?: boolean } } | null) => settings?.external?.google === true)
      .catch(() => false);
    enabledCheck = check;
    void check.then((enabled) => {
      if (!enabled && enabledCheck === check) enabledCheck = null;
    });
  }
  return enabledCheck;
}

/** Solo para pruebas. */
export function resetGoogleSignInCheck(): void {
  enabledCheck = null;
}
