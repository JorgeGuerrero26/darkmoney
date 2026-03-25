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
