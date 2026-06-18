import {
  ArrowLeftRight,
  Banknote,
  Bell,
  BellRing,
  CreditCard,
  Crown,
  Landmark,
  Mail,
  PiggyBank,
  RefreshCw,
  Scale,
  ShieldCheck,
  Sparkles,
  UserPlus,
} from "lucide-react";
import type { ComponentType } from "react";

import type { PickerOption } from "../../../components/ui/searchable-picker";

export function getNotificationKindIcon(kind: string): ComponentType<{ className?: string }> {
  switch (kind) {
    case "budget":
      return PiggyBank;
    case "subscription":
      return RefreshCw;
    case "recurring_income":
      return Banknote;
    case "obligation":
      return Scale;
    case "obligation_share_invite":
      return Mail;
    case "workspace_invite":
    case "invite":
      return UserPlus;
    case "quality":
      return ShieldCheck;
    case "account":
      return Landmark;
    case "movement":
      return ArrowLeftRight;
    case "billing":
      return CreditCard;
    case "plan":
      return Crown;
    default:
      return Sparkles;
  }
}

export function getNotificationChannelIcon(channel?: string | null): ComponentType<{ className?: string }> {
  switch ((channel ?? "").trim()) {
    case "email":
      return Mail;
    case "push":
      return BellRing;
    default:
      return Bell;
  }
}

export function buildFilterInitials(label: string) {
  return (
    label
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word.slice(0, 1).toUpperCase())
      .join("") || "FI"
  );
}

export function getToneClasses(tone: "info" | "success" | "warning" | "danger" | "neutral") {
  switch (tone) {
    case "success":
      return "border-pine/18 bg-pine/10";
    case "warning":
      return "border-gold/18 bg-gold/10";
    case "danger":
      return "border-ember/18 bg-ember/10";
    case "info":
    default:
      return "border-white/10 bg-white/[0.03]";
  }
}

export function getNotificationSourceLabel(source: "database" | "smart") {
  return source === "smart" ? "Inteligente" : "Guardada";
}

export const sourceFilterPickerOptions: PickerOption[] = [
  {
    value: "all",
    label: "Todo origen",
    description: "Incluye notificaciones guardadas e inteligentes.",
    leadingLabel: "TO",
    leadingColor: "#64748B",
    searchText: "todo todas origen",
  },
  {
    value: "smart",
    label: "Inteligente",
    description: "Alertas calculadas desde tus datos actuales.",
    leadingLabel: "IN",
    leadingColor: "#1B6A58",
    searchText: "inteligente smart",
  },
  {
    value: "database",
    label: "Guardada",
    description: "Notificaciones persistidas para tu cuenta.",
    leadingLabel: "GU",
    leadingColor: "#4566D6",
    searchText: "guardada database",
  },
];

export const statusFilterPickerOptions: PickerOption[] = [
  {
    value: "all",
    label: "Todos los estados",
    description: "Incluye pendientes, enviadas, leidas y fallidas.",
    leadingLabel: "TE",
    leadingColor: "#64748B",
    searchText: "todos estados",
  },
  {
    value: "pending",
    label: "Pendiente",
    description: "Aun requiere atencion o envio.",
    leadingLabel: "PE",
    leadingColor: "#B48B34",
    searchText: "pendiente pending",
  },
  {
    value: "sent",
    label: "Enviada",
    description: "Ya fue enviada al canal configurado.",
    leadingLabel: "EN",
    leadingColor: "#4566D6",
    searchText: "enviada sent",
  },
  {
    value: "read",
    label: "Leida",
    description: "Ya fue marcada como leida.",
    leadingLabel: "LE",
    leadingColor: "#64748B",
    searchText: "leida read",
  },
  {
    value: "failed",
    label: "Fallida",
    description: "No se pudo completar el envio.",
    leadingLabel: "FA",
    leadingColor: "#8F3E3E",
    searchText: "fallida failed",
  },
];
