import { LoaderCircle } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { NavLink } from "react-router-dom";

import { Button } from "../../../components/ui/button";
import { InlineFormError } from "../../../components/ui/inline-form-error";
import { useSuccessToast } from "../../../components/ui/toast-provider";
import { translateAuthError } from "../auth-errors";
import { useAuth } from "../auth-context";

export function RecoveryPage() {
  const { isConfigured, resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  useSuccessToast(successMessage, {
    clear: () => setSuccessMessage(""),
    title: "Correo enviado",
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    setIsSubmitting(true);

    try {
      await resetPassword(email);
      setSuccessMessage(
        "Te enviamos un correo con un enlace seguro para cambiar tu contraseña.",
      );
    } catch (error) {
      setErrorMessage(translateAuthError(error, "No se pudo enviar el correo. Inténtalo de nuevo."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="space-y-7">
      <div className="space-y-3">
        <p className="font-public-mono text-[11px] font-medium uppercase tracking-[0.14em] text-[#a39c90]">Recuperación</p>
        <h2 className="font-public-display text-[38px] font-semibold leading-[1.05] tracking-[-0.03em] text-[#f4f1ec]">Recupera tu acceso</h2>
        <p className="max-w-[42ch] text-sm leading-[1.6] text-[#a39c90]">
          Escribe tu correo y te enviaremos un enlace para crear una nueva contraseña.
        </p>
      </div>

      <form
        className="public-form-card space-y-5"
        noValidate
        onSubmit={handleSubmit}
      >
        <label className="block space-y-2">
          <span className="text-sm font-medium text-[#f4f1ec]">Correo de recuperación</span>
          <input
            autoComplete="email"
            className="public-field"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="tu@correo.com"
            type="email"
            value={email}
          />
        </label>
        {errorMessage ? <InlineFormError message={errorMessage} /> : null}
        <Button
          className="public-auth-submit w-full"
          disabled={!isConfigured || isSubmitting}
          type="submit"
        >
          {isSubmitting ? (
            <>
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Enviando...
            </>
          ) : (
            "Enviar enlace"
          )}
        </Button>
      </form>

      <NavLink
        className="text-sm font-semibold text-[#f4f1ec] underline decoration-[#f4f1ec]/25 underline-offset-4 transition hover:decoration-[#f4f1ec]"
        to="/auth/login"
      >
        Regresar al login
      </NavLink>
    </section>
  );
}
