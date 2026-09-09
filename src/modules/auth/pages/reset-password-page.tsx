import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";

import { Button } from "../../../components/ui/button";
import { FormFeedbackBanner } from "../../../components/ui/form-feedback-banner";
import { InlineFormError } from "../../../components/ui/inline-form-error";
import { translateAuthError } from "../auth-errors";
import { useAuth } from "../auth-context";

const MIN_PASSWORD_LENGTH = 8;

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const { isConfigured, isLoading, updatePassword, user } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (password.length < MIN_PASSWORD_LENGTH) {
      setErrorMessage(`La nueva contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Las contraseñas no coinciden. Revisa ambos campos.");
      return;
    }

    setIsSubmitting(true);

    try {
      await updatePassword(password);
      setPassword("");
      setConfirmPassword("");
      setSuccessMessage("Tu contraseña fue actualizada. Ya puedes seguir usando Dark Money.");
    } catch (error) {
      setErrorMessage(
        translateAuthError(error, "No se pudo actualizar la contraseña. Inténtalo de nuevo."),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="space-y-7">
      <div className="space-y-3">
        <p className="font-public-mono text-[11px] font-medium uppercase tracking-[0.14em] text-[#a39c90]">Nueva contraseña</p>
        <h2 className="font-public-display text-[38px] font-semibold leading-[1.05] tracking-[-0.03em] text-[#f4f1ec]">Elige una nueva clave</h2>
        <p className="max-w-[42ch] text-sm leading-[1.6] text-[#a39c90]">
          Si abriste el enlace que te enviamos por correo, aquí puedes guardar una nueva contraseña
          para tu cuenta.
        </p>
      </div>

      {!isConfigured ? (
        <FormFeedbackBanner
          description="Falta configurar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY para poder cambiar la contraseña."
          title="Configuración incompleta"
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
          description="Este formulario necesita un enlace de recuperación válido. Vuelve a pedir el correo y abre el enlace más reciente."
          title="Tu enlace ya no está activo"
          tone="info"
        />
      ) : null}

      <form
        className="public-form-card space-y-5"
        noValidate
        onSubmit={handleSubmit}
      >
        <label className="block space-y-2">
          <span className="text-sm font-medium text-[#f4f1ec]">Nueva contraseña</span>
          <div className="relative">
            <input
              autoComplete="new-password"
              className="public-field pr-12"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Mínimo 8 caracteres"
              type={showPassword ? "text" : "password"}
              value={password}
            />
            <button
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8e877c] transition hover:text-[#f4f1ec]"
              onClick={() => setShowPassword((v) => !v)}
              type="button"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-[#f4f1ec]">Confirmar contraseña</span>
          <div className="relative">
            <input
              autoComplete="new-password"
              className="public-field pr-12"
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Vuelve a escribirla"
              type={showConfirm ? "text" : "password"}
              value={confirmPassword}
            />
            <button
              aria-label={showConfirm ? "Ocultar contraseña" : "Mostrar contraseña"}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8e877c] transition hover:text-[#f4f1ec]"
              onClick={() => setShowConfirm((v) => !v)}
              type="button"
            >
              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </label>

        {errorMessage ? <InlineFormError message={errorMessage} /> : null}

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
            title="Contraseña actualizada"
            tone="success"
          />
        ) : null}

        <Button
          className="public-auth-submit w-full"
          disabled={!isConfigured || !user || isSubmitting || isLoading}
          type="submit"
        >
          {isSubmitting ? (
            <>
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Guardando...
            </>
          ) : (
            "Guardar nueva contraseña"
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
