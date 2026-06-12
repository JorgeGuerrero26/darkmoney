import type {
  MovementStatus,
  NotificationItem,
  WorkspaceKind,
  WorkspaceRole,
} from "../../types/domain";

function titleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((chunk) => chunk.slice(0, 1).toUpperCase() + chunk.slice(1).toLowerCase())
    .join(" ");
}

function humanizeCode(value: string) {
  return titleCase(value.replace(/[_-]+/g, " "));
}

export function formatWorkspaceKindLabel(kind: WorkspaceKind) {
  switch (kind) {
    case "personal":
      return "Personal";
    case "shared":
      return "Compartido";
    default:
      return humanizeCode(kind);
  }
}

export function formatWorkspaceRoleLabel(role: WorkspaceRole) {
  switch (role) {
    case "owner":
      return "Propietario";
    case "admin":
      return "Administrador";
    case "member":
      return "Miembro";
    case "viewer":
      return "Solo lectura";
    default:
      return humanizeCode(role);
  }
}

export function formatMovementStatusLabel(status: MovementStatus) {
  switch (status) {
    case "planned":
      return "Planeado";
    case "pending":
      return "Pendiente";
    case "posted":
      return "Aplicado";
    case "voided":
      return "Anulado";
    default:
      return humanizeCode(status);
  }
}

export function formatNotificationStatusLabel(status: NotificationItem["status"]) {
  switch (status) {
    case "pending":
      return "Pendiente";
    case "sent":
      return "Enviada";
    case "read":
      return "Leida";
    case "failed":
      return "Fallida";
    default:
      return humanizeCode(status);
  }
}

export function formatNotificationKindLabel(kind: string) {
  const normalizedKind = kind.trim().toLowerCase();

  switch (normalizedKind) {
    case "daily_workspace_summary":
      return "Resumen diario";
    case "daily_cashflow_check":
      return "Chequeo de flujo";
    case "daily_budget_review":
      return "Revision diaria";
    case "budget_alert":
      return "Alerta de presupuesto";
    case "budget_period_ending":
      return "Presupuesto por cerrar";
    case "subscription_reminder":
      return "Recordatorio de suscripcion";
    case "subscription_overdue":
      return "Suscripcion vencida";
    case "multiple_subscriptions_due":
      return "Suscripciones proximas";
    case "obligation_due":
      return "Obligacion por vencer";
    case "obligation_overdue":
      return "Obligacion vencida";
    case "multiple_obligations_overdue":
      return "Obligaciones vencidas";
    case "obligation_no_payment":
      return "Obligacion sin pago";
    case "high_interest_obligation":
      return "Obligacion con interes alto";
    case "low_balance":
      return "Saldo bajo";
    case "negative_balance":
      return "Saldo negativo";
    case "account_dormant":
      return "Cuenta inactiva";
    case "no_income_month":
      return "Mes sin ingresos";
    case "high_expense_month":
      return "Gastos elevados";
    case "category_spending_spike":
      return "Pico por categoria";
    case "expense_income_imbalance":
      return "Desbalance ingreso/gasto";
    case "net_worth_negative":
      return "Patrimonio negativo";
    case "savings_rate_low":
      return "Ahorro bajo";
    case "subscription_cost_heavy":
      return "Suscripciones pesadas";
    case "upcoming_annual_subscription":
      return "Suscripcion anual proxima";
    case "no_movements_week":
      return "Semana sin movimientos";
    case "daily_ai_digest":
      return "Resumen IA diario";
    case "daily_digest":
      return "Resumen diario";
    case "detected_movement_suggestion":
      return "Movimiento detectado";
    case "movement_detection":
      return "Deteccion Android";
    case "obligation_reminder":
      return "Recordatorio de obligacion";
    case "recurring_income_reminder":
      return "Recordatorio de ingreso fijo";
    case "obligation_share_invite":
      return "Invitacion de obligacion";
    case "workspace_invite":
      return "Invitacion de workspace";
    case "invite":
      return "Invitacion";
    case "obligation_payment_request":
      return "Solicitud de pago/cobro";
    case "obligation_request_accepted":
      return "Solicitud aceptada";
    case "obligation_request_rejected":
      return "Solicitud rechazada";
    case "obligation_event_unlinked":
      return "Evento por asociar";
    case "obligation_event_updated":
      return "Evento actualizado";
    case "obligation_event_deleted":
      return "Evento eliminado";
    case "obligation_event_delete_request":
      return "Solicitud de eliminacion";
    case "obligation_event_delete_pending":
      return "Eliminacion pendiente";
    case "obligation_event_delete_accepted":
      return "Eliminacion aceptada";
    case "obligation_event_delete_rejected":
      return "Eliminacion rechazada";
    case "obligation_event_edit_request":
      return "Solicitud de edicion";
    case "obligation_event_edit_pending":
      return "Edicion pendiente";
    case "obligation_event_edit_accepted":
      return "Edicion aceptada";
    case "obligation_event_edit_rejected":
      return "Edicion rechazada";
    case "movement":
      return "Movimiento";
    case "subscription":
      return "Suscripcion";
    case "workspace":
      return "Espacio de trabajo";
    case "obligation":
      return "Credito o deuda";
    case "account":
      return "Cuenta";
    case "category":
      return "Categoria";
    case "budget":
      return "Presupuesto";
    case "quality":
      return "Calidad del dato";
    case "cashflow":
      return "Flujo futuro";
    case "alert":
      return "Alerta";
    case "billing":
      return "Facturacion Pro";
    case "plan":
      return "Suscripcion Pro";
    case "counterparty":
      return "Contacto";
    case "system":
      return "Sistema";
    default:
      return humanizeCode(kind);
  }
}

export function formatNotificationChannelLabel(channel?: string | null) {
  if (!channel) {
    return "En la app";
  }

  const normalizedChannel = channel.trim().toLowerCase();

  switch (normalizedChannel) {
    case "in_app":
    case "app":
      return "En la app";
    case "email":
      return "Correo";
    case "push":
      return "Push";
    case "sms":
      return "SMS";
    default:
      return humanizeCode(channel);
  }
}
