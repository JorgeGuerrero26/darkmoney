import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "../../../components/ui/button";
import { InlineFormError } from "../../../components/ui/inline-form-error";
import { supabasePublicConfig } from "../../../services/supabase/client";
import { translateAuthError } from "../auth-errors";
import { useAuth } from "../auth-context";
import { isGoogleSignInEnabled } from "../google-sign-in";

/**
 * «Continuar con Google» con su separador. Solo aparece si Google está activado en Supabase. Al tocarlo el navegador se va
 * a Google; si no se pudo ni salir, se avisa aquí.
 */
export function GoogleSignInButton({ nextPath, disabled }: { nextPath?: string | null; disabled?: boolean }) {
  const { signInWithGoogle } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [opening, setOpening] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    void isGoogleSignInEnabled(supabasePublicConfig.url, supabasePublicConfig.anonKey).then((value) => {
      if (!cancelled) setEnabled(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!enabled) return null;

  async function handleClick() {
    setErrorMessage("");
    setOpening(true);
    try {
      await signInWithGoogle(nextPath);
    } catch (error) {
      setErrorMessage(translateAuthError(error, "No se pudo abrir Google. Inténtalo de nuevo."));
      setOpening(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-xs text-[#8e877c]">
        <span className="h-px flex-1 bg-white/10" />
        <span>o</span>
        <span className="h-px flex-1 bg-white/10" />
      </div>
      <Button
        className="w-full"
        disabled={disabled || opening}
        onClick={() => void handleClick()}
        type="button"
        variant="secondary"
      >
        {opening ? (
          <>
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Abriendo Google...
          </>
        ) : (
          "Continuar con Google"
        )}
      </Button>
      {errorMessage ? <InlineFormError message={errorMessage} /> : null}
    </div>
  );
}
