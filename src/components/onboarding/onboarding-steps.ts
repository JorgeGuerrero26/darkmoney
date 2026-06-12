export type TourCounts = {
  accounts: number;
  movements: number;
  categories: number;
  counterparties: number;
};

export type OnboardingStep = {
  id: string;
  title: string;
  description: string;
  /** Ruta a la que navegar al entrar al paso. */
  route?: string;
  /** Valor de data-tour del elemento a destacar (clickeable: el spotlight nunca bloquea). */
  target?: string;
  /**
   * Avance reactivo: el paso se completa solo cuando el dato crece respecto a la
   * línea base tomada al entrar al paso (ej. el usuario creó su primera cuenta).
   */
  advanceWhen?: (counts: TourCounts, baseline: TourCounts) => boolean;
  ctaLabel?: string;
};

export const onboardingSteps: OnboardingStep[] = [
  {
    id: "welcome",
    title: "Bienvenido a DarkMoney",
    description:
      "Te damos un tour rápido por lo esencial: cuentas, movimientos, categorías y contactos. Puedes saltarlo cuando quieras y relanzarlo desde Configuración.",
    ctaLabel: "Empezar tour",
  },
  {
    id: "workspace",
    title: "Tu workspace",
    description:
      "Aquí vive todo tu dinero. Puedes tener espacios personales y compartidos (pareja, familia o negocio) y cambiar entre ellos desde este selector.",
    target: "workspace-picker",
    ctaLabel: "Siguiente",
  },
  {
    id: "accounts",
    title: "Crea tu primera cuenta",
    description:
      "Una cuenta es donde está tu dinero: banco, billetera digital o efectivo. Toca «Nueva cuenta» y créala — te esperamos aquí.",
    route: "/app/accounts",
    target: "create-account",
    advanceWhen: (counts, baseline) => counts.accounts > baseline.accounts,
    ctaLabel: "Ya tengo cuentas, seguir",
  },
  {
    id: "movements",
    title: "Registra un movimiento",
    description:
      "Cada gasto, ingreso o transferencia es un movimiento. Toca «Nuevo movimiento» y registra uno real o de prueba.",
    route: "/app/movements",
    target: "create-movement",
    advanceWhen: (counts, baseline) => counts.movements > baseline.movements,
    ctaLabel: "Seguir sin registrar",
  },
  {
    id: "categories",
    title: "Categorías",
    description:
      "Las categorías (comida, transporte, hogar…) le dan contexto a tus gastos y alimentan las gráficas del dashboard. Crea las tuyas o usa las existentes.",
    route: "/app/categories",
    target: "create-category",
    advanceWhen: (counts, baseline) => counts.categories > baseline.categories,
    ctaLabel: "Siguiente",
  },
  {
    id: "contacts",
    title: "Contactos",
    description:
      "Personas, comercios o bancos con los que se mueve tu dinero. Sirven para saber quién te debe y a quién le debes.",
    route: "/app/contacts",
    target: "create-contact",
    ctaLabel: "Siguiente",
  },
  {
    id: "dashboard",
    title: "Tu dinero, de un vistazo",
    description:
      "El dashboard resume todo: cuánto tienes, cuánto ahorras y a dónde se va tu dinero. Mientras más registres, más inteligente se vuelve.",
    route: "/app",
    target: "dashboard-hero",
    ctaLabel: "Finalizar",
  },
  {
    id: "done",
    title: "¡Listo! 🎉",
    description:
      "Ya conoces lo esencial. Tip: usa los botones Gasto/Ingreso/Transferencia de arriba para registrar en segundos, o Ctrl+K para moverte rápido.",
    ctaLabel: "Cerrar",
  },
];
