import {
  BadgeDollarSign,
  BadgePercent,
  Banknote,
  BriefcaseBusiness,
  CarFront,
  Dumbbell,
  FileText,
  Fuel,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  Landmark,
  Laptop,
  PartyPopper,
  PawPrint,
  Pill,
  Plane,
  ReceiptText,
  RotateCcw,
  Shapes,
  Shirt,
  Sparkles,
  Utensils,
  UtensilsCrossed,
  Wifi,
} from "lucide-react";

import type { PickerOption } from "../../../components/ui/searchable-picker";
import { formatDate } from "../../../lib/formatting/dates";
import type { CategoryKind } from "../../../types/domain";

export const kindOptions = [
  {
    value: "expense" as const,
    label: "Gasto",
    description: "Para compras, pagos y egresos del dia a dia.",
    tone: "warning" as const,
    defaultColor: "#C46A31",
  },
  {
    value: "income" as const,
    label: "Ingreso",
    description: "Para ventas, sueldos, reembolsos y entradas de dinero.",
    tone: "success" as const,
    defaultColor: "#1B6A58",
  },
  {
    value: "both" as const,
    label: "Mixta",
    description: "Sirve tanto para entradas como para salidas cuando te conviene una sola familia.",
    tone: "info" as const,
    defaultColor: "#4566D6",
  },
] as const;

export const iconOptions = [
  { value: "utensils", label: "Alimentacion", icon: Utensils },
  { value: "utensils-crossed", label: "Restaurantes", icon: UtensilsCrossed },
  { value: "car", label: "Transporte", icon: CarFront },
  { value: "fuel", label: "Combustible", icon: Fuel },
  { value: "receipt", label: "Servicios", icon: ReceiptText },
  { value: "wifi", label: "Internet", icon: Wifi },
  { value: "shirt", label: "Ropa", icon: Shirt },
  { value: "heart-pulse", label: "Salud", icon: HeartPulse },
  { value: "pill", label: "Farmacia", icon: Pill },
  { value: "party-popper", label: "Diversion", icon: PartyPopper },
  { value: "graduation-cap", label: "Educacion", icon: GraduationCap },
  { value: "home", label: "Hogar", icon: House },
  { value: "paw-print", label: "Mascotas", icon: PawPrint },
  { value: "plane", label: "Viajes", icon: Plane },
  { value: "gift", label: "Regalos", icon: Gift },
  { value: "file-text", label: "Impuestos", icon: FileText },
  { value: "landmark", label: "Banco", icon: Landmark },
  { value: "sparkles", label: "Suscripciones", icon: Sparkles },
  { value: "briefcase", label: "Trabajo", icon: BriefcaseBusiness },
  { value: "badge-dollar-sign", label: "Bonos", icon: BadgeDollarSign },
  { value: "laptop", label: "Freelance", icon: Laptop },
  { value: "banknote", label: "Ventas", icon: Banknote },
  { value: "badge-percent", label: "Intereses", icon: BadgePercent },
  { value: "rotate-ccw", label: "Reembolso", icon: RotateCcw },
  { value: "dumbbell", label: "Deporte", icon: Dumbbell },
  { value: "shapes", label: "General", icon: Shapes },
] as const;

export const colorOptions = [
  "#1B6A58",
  "#2A7D65",
  "#0F766E",
  "#4566D6",
  "#2563EB",
  "#7C3AED",
  "#8366F2",
  "#EC4899",
  "#C46A31",
  "#F59E0B",
  "#EF4444",
  "#64748B",
];

export function getKindDefinition(kind: CategoryKind) {
  return kindOptions.find((option) => option.value === kind) ?? kindOptions[0];
}

export function getIconDefinition(icon: string | null | undefined) {
  return iconOptions.find((option) => option.value === icon) ?? iconOptions[iconOptions.length - 1];
}

export function getLastActivityLabel(value?: string | null) {
  return value ? formatDate(value) : "Sin actividad aun";
}

export function buildCategoryMonogram(name: string) {
  const normalizedValue = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((chunk) => chunk.slice(0, 1).toUpperCase())
    .join("");

  return normalizedValue || "CT";
}

export const kindFilterPickerOptions: PickerOption[] = [
  {
    value: "all",
    label: "Todos los tipos",
    description: "Muestra cualquier tipo de categoria.",
    leadingLabel: "TO",
    leadingColor: "#64748B",
    searchText: "todos tipos categorias",
  },
  ...kindOptions.map((option) => ({
    value: option.value,
    label: option.label,
    description: option.description,
    leadingLabel: option.label.slice(0, 2).toUpperCase(),
    leadingColor: option.defaultColor,
    searchText: `${option.label} ${option.value}`,
  })),
];

export const statusFilterPickerOptions: PickerOption[] = [
  {
    value: "active",
    label: "Activas",
    description: "Categorias disponibles para usar.",
    leadingLabel: "AC",
    leadingColor: "#1B6A58",
    searchText: "activas active",
  },
  {
    value: "all",
    label: "Todas",
    description: "Incluye categorias activas e inactivas.",
    leadingLabel: "TO",
    leadingColor: "#64748B",
    searchText: "todas estados categorias",
  },
  {
    value: "inactive",
    label: "Inactivas",
    description: "Categorias conservadas para historial.",
    leadingLabel: "IN",
    leadingColor: "#8F3E3E",
    searchText: "inactivas inactive",
  },
];
