export const PRO_CHECKOUT_PATH = "/app/settings?section=billing&checkout=pro";
export const PRO_REGISTER_PATH = `/auth/register?next=${encodeURIComponent(PRO_CHECKOUT_PATH)}`;

export const freeFeatures = [
  "Cuentas, movimientos y categorias",
  "Presupuestos, contactos y suscripciones",
  "Creditos, deudas y workspaces compartidos",
  "Notificaciones dentro de la app",
];

export const proFeatures = [
  "Todo lo incluido en Free",
  "Dashboard avanzado y widgets premium",
  "Aprendizaje inteligente y alertas automaticas",
  "Gestion de comprobantes e imagenes",
  "Sincronizacion de estados premium",
  "Mejoras y funciones futuras incluidas",
];

export type PlanComparisonRow = {
  label: string;
  free: boolean;
  pro: boolean;
};

export const planComparison: PlanComparisonRow[] = [
  { label: "Cuentas, movimientos y categorias", free: true, pro: true },
  { label: "Presupuestos, contactos y suscripciones", free: true, pro: true },
  { label: "Creditos, deudas y workspaces compartidos", free: true, pro: true },
  { label: "Notificaciones dentro de la app", free: true, pro: true },
  { label: "Dashboard avanzado y widgets premium", free: false, pro: true },
  { label: "Aprendizaje inteligente y alertas automaticas", free: false, pro: true },
  { label: "Gestion de comprobantes e imagenes", free: false, pro: true },
  { label: "Sincronizacion de estados premium", free: false, pro: true },
  { label: "Mejoras y funciones futuras incluidas", free: false, pro: true },
];

export type FaqItem = {
  q: string;
  a: string;
};

export const faqs: FaqItem[] = [
  {
    q: "¿Puedo cancelar cuando quiera?",
    a: "Si. Podes cancelar tu suscripcion Pro desde tu cuenta en cualquier momento. Mantenes el acceso hasta el fin del periodo ya pagado.",
  },
  {
    q: "¿Hay cargos ocultos?",
    a: "No. El checkout muestra claramente el importe exacto, la moneda, los impuestos aplicables y la periodicidad antes de confirmar.",
  },
  {
    q: "¿Que pasa si paso de Pro a Free?",
    a: "Tu historial y datos se conservan. Perdes acceso a las funciones premium al vencer el periodo pagado, sin perdida de informacion.",
  },
];

export const productFaqs: FaqItem[] = [
  {
    q: "¿Necesito tarjeta para empezar?",
    a: "No. El plan Free es gratuito para siempre y no pide ningun metodo de pago. Solo necesitas un correo para crear tu cuenta.",
  },
  {
    q: "¿Puedo compartir mis finanzas con otra persona?",
    a: "Si. Los espacios compartidos te permiten gestionar finanzas en pareja, familia o equipo, con cuentas y movimientos visibles para todos los miembros.",
  },
  ...faqs,
];
