import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { NavLink, useNavigate, useSearchParams } from "react-router-dom";

import { Button } from "../../../components/ui/button";
import { InlineFormError } from "../../../components/ui/inline-form-error";
import { useSuccessToast } from "../../../components/ui/toast-provider";
import { translateAuthError } from "../auth-errors";
import { useAuth } from "../auth-context";
import { resolvePostAuthPath } from "../invite-resume";

export function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isConfigured, signUp } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  useSuccessToast(successMessage, {
    clear: () => setSuccessMessage(""),
    title: "Cuenta creada",
  });
  const nextPath = searchParams.get("next");
  const resolvedNextPath = resolvePostAuthPath(nextPath);
  const loginSearchParams = new URLSearchParams();
  if (nextPath) {
    loginSearchParams.set("next", resolvedNextPath);
  }
  const loginQueryString = loginSearchParams.toString();
  const loginPath = loginQueryString ? `/auth/login?${loginQueryString}` : "/auth/login";

  function clearSubmittedCredentials() {
    setFullName("");
    setEmail("");
    setPassword("");
    setShowPassword(false);

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    setIsSubmitting(true);

    try {
      const result = await signUp({
        email,
        password,
        fullName,
      });

      clearSubmittedCredentials();

      if (result.needsEmailConfirmation) {
        setSuccessMessage(
          "Tu cuenta fue creada. Revisa tu correo para confirmar la cuenta antes de iniciar sesión.",
        );
        return;
      }

      navigate(resolvedNextPath, { replace: true });
    } catch (error) {
      setErrorMessage(translateAuthError(error, "No se pudo crear la cuenta. Inténtalo de nuevo."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="space-y-7">
      <div className="space-y-3">
        <p className="font-public-mono text-[11px] font-medium uppercase tracking-[0.14em] text-[#a39c90]">Registro</p>
        <h2 className="font-public-display text-[38px] font-semibold leading-[1.05] tracking-[-0.03em] text-[#f4f1ec]">Crea tu espacio financiero</h2>
        <p className="max-w-[42ch] text-sm leading-[1.6] text-[#a39c90]">
          Crea tu cuenta para organizar tus finanzas personales y abrir espacios compartidos cuando lo necesites.
        </p>
      </div>

      <form
        className="public-form-card space-y-5"
        noValidate
        onSubmit={handleSubmit}
      >
        <label className="block space-y-2">
          <span className="text-sm font-medium text-[#f4f1ec]">Nombre completo</span>
          <input
            autoComplete="name"
            className="public-field"
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Lucía Ramírez"
            type="text"
            value={fullName}
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-[#f4f1ec]">Correo</span>
          <input
            autoComplete="email"
            className="public-field"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="tu@correo.com"
            type="email"
            value={email}
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-[#f4f1ec]">Contraseña</span>
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
        {errorMessage ? <InlineFormError message={errorMessage} /> : null}
        {!isConfigured ? (
          <div className="rounded-2xl border border-gold/20 bg-gold/10 px-4 py-3 text-sm text-gold">
            Falta configurar <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code> en <code>.env</code>.
          </div>
        ) : null}
        <Button
          className="public-auth-submit w-full"
          disabled={!isConfigured || isSubmitting}
          type="submit"
        >
          {isSubmitting ? (
            <>
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Creando cuenta...
            </>
          ) : (
            "Crear cuenta"
          )}
        </Button>
      </form>

      <div className="text-sm text-[#a39c90]">
        <span>¿Ya tienes cuenta? </span>
        <NavLink
          className="font-semibold text-[#f4f1ec] underline decoration-[#f4f1ec]/25 underline-offset-4 transition hover:decoration-[#f4f1ec]"
          to={loginPath}
        >
          Volver al login
        </NavLink>
      </div>
    </section>
  );
}
