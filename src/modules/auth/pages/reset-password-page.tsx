import type { FormEvent } from "react";
import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";

import { Button } from "../../../components/ui/button";
import { FormFeedbackBanner } from "../../../components/ui/form-feedback-banner";
import { useAuth } from "../auth-context";

const MIN_PASSWORD_LENGTH = 8;

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const { isConfigured, isLoading, updatePassword, user } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (password.length < MIN_PASSWORD_LENGTH) {
      setErrorMessage(`La nueva contrasena debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Las contrasenas no coinciden. Revisa ambos campos.");
      return;
    }

    setIsSubmitting(true);

    try {
      await updatePassword(password);
      setPassword("");
      setConfirmPassword("");
      setSuccessMessage("Tu contrasena fue actualizada. Ya puedes seguir usando Dark Money.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo actualizar la contrasena.";
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.24em] text-storm">nueva contrasena</p>
        <h2 className="font-display text-4xl font-semibold text-ink">Elige una nueva clave.</h2>
        <p className="text-sm leading-7 text-storm">
          Si abriste el enlace que te enviamos por correo, aqui puedes guardar una nueva contrasena
          para tu cuenta.
        </p>
      </div>

      {!isConfigured ? (
        <FormFeedbackBanner
          description="Falta configurar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY para poder cambiar la contrasena."
          title="Configuracion incompleta"
          tone="info"
        />
      ) : null}

      {!isLoading && !user ? (
        <FormFeedbackBanner
          action={
            <div className="flex flex-wrap gap-3">
              <NavLink to="/auth/recovery">
                <Button variant="secondary">Pedir nuevo enlace</Button>
              </NavLink>
              <NavLink to="/auth/login">
                <Button variant="ghost">Volver al login</Button>
              </NavLink>
            </div>
          }
          description="Este formulario necesita un enlace de recuperacion valido. Vuelve a pedir el correo y abre el enlace mas reciente."
          title="Tu enlace ya no esta activo"
          tone="info"
        />
      ) : null}

      <form
        className="glass-panel space-y-4 rounded-[28px] p-6"
        noValidate
        onSubmit={handleSubmit}
      >
        <label className="block space-y-2">
          <span className="text-sm font-medium text-ink">Nueva contrasena</span>
          <input
            autoComplete="new-password"
            className="field-dark"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Minimo 8 caracteres"
            type="password"
            value={password}
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-ink">Confirmar contrasena</span>
          <input
            autoComplete="new-password"
            className="field-dark"
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Vuelve a escribirla"
            type="password"
            value={confirmPassword}
          />
        </label>

        {errorMessage ? (
          <FormFeedbackBanner
            description={errorMessage}
            title="No pudimos actualizar tu contrasena"
          />
        ) : null}

        {successMessage ? (
          <FormFeedbackBanner
            action={
              <Button
                onClick={() => navigate("/app", { replace: true })}
                variant="secondary"
              >
                Ir a la app
              </Button>
            }
            description={successMessage}
            title="Contrasena actualizada"
            tone="success"
          />
        ) : null}

        <Button
          className="w-full"
          disabled={!isConfigured || !user || isSubmitting || isLoading}
          type="submit"
        >
          {isSubmitting ? "Guardando..." : "Guardar nueva contrasena"}
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
