import type { FormEvent } from "react";
import { useState } from "react";
import { NavLink } from "react-router-dom";

import { Button } from "../../../components/ui/button";
import { FormFeedbackBanner } from "../../../components/ui/form-feedback-banner";
import { useSuccessToast } from "../../../components/ui/toast-provider";
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
        "Te enviamos un correo con un enlace seguro para cambiar tu contrasena.",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo enviar el correo.";
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.24em] text-storm">recuperacion</p>
        <h2 className="font-display text-4xl font-semibold text-ink">Recupera tu acceso.</h2>
        <p className="text-sm leading-7 text-storm">
          Escribe tu correo y te enviaremos un enlace para crear una nueva contrasena.
        </p>
      </div>

      <form
        className="glass-panel space-y-4 rounded-[28px] p-6"
        noValidate
        onSubmit={handleSubmit}
      >
        <label className="block space-y-2">
          <span className="text-sm font-medium text-ink">Correo de recuperacion</span>
          <input
            className="field-dark"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="tu@correo.com"
            type="email"
            value={email}
          />
        </label>
        {errorMessage ? (
          <FormFeedbackBanner
            description={errorMessage}
            title="No pudimos enviar el enlace"
          />
        ) : null}
        <Button
          className="w-full"
          disabled={!isConfigured || isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Enviando..." : "Enviar enlace"}
        </Button>
      </form>

      <NavLink
        className="text-sm underline decoration-white/20 underline-offset-4 transition hover:text-ink"
        to="/auth/login"
      >
        Regresar al login
      </NavLink>
    </section>
  );
}
