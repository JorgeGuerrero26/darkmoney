import { Building2, Landmark, ShieldCheck, UserRound, Users } from "lucide-react";

import type { PickerOption } from "../../../components/ui/searchable-picker";
import { formatDate } from "../../../lib/formatting/dates";
import type { CounterpartyOverview, CounterpartyRoleType, CounterpartySummary } from "../../../types/domain";

export type ContactWithExposure = CounterpartyOverview & {
  receivablePendingInBase: number;
  payablePendingInBase: number;
};

export const typeOptions = [
  { value: "person" as const, label: "Persona", description: "Amigos, familiares o personas individuales.", icon: UserRound, color: "#1b6a58" },
  { value: "company" as const, label: "Empresa", description: "Clientes, empleadores o companias formales.", icon: Building2, color: "#4566d6" },
  { value: "merchant" as const, label: "Comercio", description: "Tiendas o vendedores frecuentes.", icon: Building2, color: "#c46a31" },
  { value: "service" as const, label: "Servicio", description: "Servicios digitales, recurrentes o profesionales.", icon: ShieldCheck, color: "#8366f2" },
  { value: "bank" as const, label: "Banco", description: "Bancos, financieras o cajas.", icon: Landmark, color: "#0f766e" },
  { value: "other" as const, label: "Otro", description: "Cualquier caso que no encaje en las categorias anteriores.", icon: Users, color: "#64748b" },
] as const;

export const roleOptions = [
  { value: "client" as const, label: "Cliente", description: "Te compra, te paga o le facturas.", tone: "success" as const },
  { value: "supplier" as const, label: "Proveedor", description: "Le compras o te abastece.", tone: "info" as const },
  { value: "lender" as const, label: "Prestamista", description: "Te presta dinero o financia una deuda.", tone: "warning" as const },
  { value: "borrower" as const, label: "Deudor", description: "Te debe dinero o le financiaste algo.", tone: "danger" as const },
  { value: "bank" as const, label: "Banco", description: "Entidad financiera o cuenta institucional.", tone: "info" as const },
  { value: "service_provider" as const, label: "Servicio", description: "Proveedor recurrente o empresa de suscripcion.", tone: "neutral" as const },
  { value: "other" as const, label: "Otro", description: "Rol adicional o libre.", tone: "neutral" as const },
] as const;

export function getTypeDefinition(type: CounterpartySummary["type"]) {
  return typeOptions.find((option) => option.value === type) ?? typeOptions[typeOptions.length - 1];
}

export function getRoleDefinition(role: CounterpartyRoleType) {
  return roleOptions.find((option) => option.value === role) ?? roleOptions[roleOptions.length - 1];
}

export function buildInitials(name: string) {
  const value = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((chunk) => chunk.slice(0, 1).toUpperCase())
    .join("");
  return value || "CT";
}

export function getPickerToneColor(tone: (typeof roleOptions)[number]["tone"]) {
  switch (tone) {
    case "success":
      return "#1B6A58";
    case "info":
      return "#4566D6";
    case "warning":
      return "#B48B34";
    case "danger":
      return "#8F3E3E";
    case "neutral":
    default:
      return "#64748B";
  }
}

export function getLastActivityLabel(value?: string | null) {
  return value ? formatDate(value) : "Sin actividad aun";
}

export const typeFilterPickerOptions: PickerOption[] = [
  {
    value: "all",
    label: "Todos los tipos",
    description: "Incluye personas, empresas, comercios y bancos.",
    leadingLabel: "TT",
    leadingColor: "#64748B",
    searchText: "todos tipos contactos",
  },
  ...typeOptions.map((option) => ({
    value: option.value,
    label: option.label,
    description: option.description,
    leadingLabel: buildInitials(option.label),
    leadingColor: option.color,
    searchText: `${option.label} ${option.value}`,
  })),
];

export const roleFilterPickerOptions: PickerOption[] = [
  {
    value: "all",
    label: "Todos los roles",
    description: "Incluye cualquier rol asignado.",
    leadingLabel: "TR",
    leadingColor: "#64748B",
    searchText: "todos roles contactos",
  },
  ...roleOptions.map((option) => ({
    value: option.value,
    label: option.label,
    description: option.description,
    leadingLabel: buildInitials(option.label),
    leadingColor: getPickerToneColor(option.tone),
    searchText: `${option.label} ${option.value}`,
  })),
];

export const statusFilterPickerOptions: PickerOption[] = [
  {
    value: "active",
    label: "Activos",
    description: "Contactos disponibles para nuevos registros.",
    leadingLabel: "AC",
    leadingColor: "#1B6A58",
    searchText: "activos active",
  },
  {
    value: "all",
    label: "Todos los estados",
    description: "Incluye activos y archivados.",
    leadingLabel: "TE",
    leadingColor: "#64748B",
    searchText: "todos estados",
  },
  {
    value: "archived",
    label: "Archivados",
    description: "Contactos conservados para historial.",
    leadingLabel: "AR",
    leadingColor: "#B48B34",
    searchText: "archivados archived",
  },
];
