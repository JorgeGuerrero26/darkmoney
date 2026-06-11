type ErrorRule = {
  match: (message: string) => boolean;
  translation: string;
};

const errorRules: ErrorRule[] = [
  {
    match: (m) => m.includes("invalid login credentials"),
    translation: "Correo o contraseña incorrectos. Revisa tus datos e inténtalo de nuevo.",
  },
  {
    match: (m) => m.includes("email not confirmed"),
    translation:
      "Tu correo aún no está confirmado. Revisa tu bandeja de entrada y haz clic en el enlace de confirmación.",
  },
  {
    match: (m) => m.includes("user already registered") || m.includes("already been registered"),
    translation: "Ya existe una cuenta con este correo. Prueba iniciar sesión o recuperar tu contraseña.",
  },
  {
    match: (m) => m.includes("password should be at least"),
    translation: "La contraseña es muy corta. Usa al menos 8 caracteres.",
  },
  {
    match: (m) =>
      m.includes("new password should be different"),
    translation: "La nueva contraseña debe ser distinta a la anterior.",
  },
  {
    match: (m) =>
      m.includes("rate limit") || m.includes("for security purposes, you can only request this"),
    translation: "Hiciste demasiados intentos seguidos. Espera un minuto y vuelve a intentarlo.",
  },
  {
    match: (m) => m.includes("invalid format") || m.includes("unable to validate email"),
    translation: "El correo no tiene un formato válido. Revísalo e inténtalo de nuevo.",
  },
  {
    match: (m) => m.includes("signup") && m.includes("disabled"),
    translation: "El registro está deshabilitado temporalmente. Inténtalo más tarde.",
  },
  {
    match: (m) =>
      m.includes("token has expired") ||
      m.includes("link is invalid") ||
      m.includes("otp_expired"),
    translation: "El enlace expiró o ya fue usado. Solicita uno nuevo.",
  },
  {
    match: (m) => m.includes("auth session missing"),
    translation: "Tu sesión expiró. Vuelve a iniciar sesión.",
  },
  {
    match: (m) => m.includes("failed to fetch") || m.includes("network"),
    translation: "No pudimos conectar con el servidor. Revisa tu conexión a internet.",
  },
];

export function translateAuthError(error: unknown, fallback: string): string {
  if (!(error instanceof Error) || !error.message) {
    return fallback;
  }

  const normalized = error.message.toLowerCase();
  const rule = errorRules.find((candidate) => candidate.match(normalized));

  return rule ? rule.translation : fallback;
}
