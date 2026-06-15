import {
  BadgeDollarSign,
  Banknote,
  BriefcaseBusiness,
  Building2,
  CarFront,
  CircleDollarSign,
  Coins,
  CreditCard,
  Gem,
  HandCoins,
  House,
  Landmark,
  PiggyBank,
  Plane,
  ReceiptText,
  Shield,
  Smartphone,
  Store,
  TrendingUp,
  Vault,
  Wallet2,
} from "lucide-react";

import type { PickerOption } from "../../../components/ui/searchable-picker";

export const accountTypeOptions = [
  {
    value: "cash",
    label: "Efectivo",
    icon: "wallet",
    color: "#1b6a58",
    description: "Billeteras, efectivo diario y caja chica.",
  },
  {
    value: "bank",
    label: "Cuenta bancaria",
    icon: "landmark",
    color: "#4566d6",
    description: "Cuenta corriente, bancaria o digital.",
  },
  {
    value: "savings",
    label: "Ahorros",
    icon: "piggy-bank",
    color: "#b48b34",
    description: "Fondos reservados y metas de ahorro.",
  },
  {
    value: "credit_card",
    label: "Tarjeta de credito",
    icon: "credit-card",
    color: "#8f3e3e",
    description: "Lineas de consumo y tarjetas activas.",
  },
  {
    value: "investment",
    label: "Inversion",
    icon: "trending-up",
    color: "#8366f2",
    description: "Brokers, portafolios y activos invertidos.",
  },
  {
    value: "loan_wallet",
    label: "Prestamos",
    icon: "briefcase",
    color: "#c46a31",
    description: "Creditos, deudas o cartera prestada.",
  },
  {
    value: "other",
    label: "Otro",
    icon: "banknote",
    color: "#6b7280",
    description: "Contenedores especiales o cuentas mixtas.",
  },
] as const;

export const iconOptions = [
  { value: "wallet", label: "Billetera", description: "Billetera, cash o caja general." },
  { value: "landmark", label: "Banco", description: "Banco, fintech o cuenta principal." },
  { value: "piggy-bank", label: "Alcancia", description: "Ahorro, reserva o meta." },
  { value: "credit-card", label: "Tarjeta", description: "Tarjeta, consumo o linea." },
  { value: "trending-up", label: "Inversiones", description: "Portafolio, broker o crecimiento." },
  { value: "briefcase", label: "Cartera", description: "Prestamos y cartera financiera." },
  { value: "banknote", label: "Billetes", description: "Caja, fondos o categoria libre." },
  { value: "building-2", label: "Edificio", description: "Banco corporativo o institucion." },
  { value: "smartphone", label: "App movil", description: "Billetera digital, app o neobanco." },
  { value: "vault", label: "Caja fuerte", description: "Reserva protegida o fondo seguro." },
  { value: "coins", label: "Monedas", description: "Efectivo, monedas o saldo pequeno." },
  { value: "circle-dollar-sign", label: "Dolar", description: "Cuenta en dolares o saldo principal." },
  { value: "badge-dollar-sign", label: "Bono", description: "Bonos, recompensas o ingresos variables." },
  { value: "hand-coins", label: "Prestamo", description: "Dinero prestado, cobros o cartera por recibir." },
  { value: "receipt-text", label: "Recibos", description: "Gastos, comprobantes o pagos recurrentes." },
  { value: "store", label: "Negocio", description: "Caja de tienda, ventas o negocio propio." },
  { value: "house", label: "Casa", description: "Hogar, hipoteca o patrimonio inmobiliario." },
  { value: "car-front", label: "Auto", description: "Vehiculo, credito vehicular o movilidad." },
  { value: "plane", label: "Viajes", description: "Fondos para viajes o gastos en el exterior." },
  { value: "gem", label: "Activos", description: "Joyas, cripto, colecciones o valor especial." },
  { value: "shield", label: "Seguro", description: "Fondo de emergencia, seguro o respaldo." },
] as const;

export const editorColorSwatches = [
  "#1b6a58",
  "#2d9076",
  "#4566d6",
  "#6f82f1",
  "#b48b34",
  "#d39d3a",
  "#8f3e3e",
  "#c55f5f",
  "#8366f2",
  "#9c7dff",
  "#c46a31",
  "#6b7280",
] as const;

export const currencyOptions = [
  { code: "PEN", label: "Sol peruano", region: "Peru", symbol: "S/" },
  { code: "USD", label: "Dolar estadounidense", region: "Estados Unidos", symbol: "$" },
  { code: "EUR", label: "Euro", region: "Union Europea", symbol: "EUR" },
  { code: "GBP", label: "Libra esterlina", region: "Reino Unido", symbol: "GBP" },
  { code: "JPY", label: "Yen japones", region: "Japon", symbol: "JPY" },
  { code: "CNY", label: "Yuan chino", region: "China", symbol: "CNY" },
  { code: "AUD", label: "Dolar australiano", region: "Australia", symbol: "AUD" },
  { code: "CAD", label: "Dolar canadiense", region: "Canada", symbol: "CAD" },
  { code: "CHF", label: "Franco suizo", region: "Suiza", symbol: "CHF" },
  { code: "BRL", label: "Real brasileno", region: "Brasil", symbol: "R$" },
  { code: "MXN", label: "Peso mexicano", region: "Mexico", symbol: "MXN" },
  { code: "CLP", label: "Peso chileno", region: "Chile", symbol: "CLP" },
  { code: "COP", label: "Peso colombiano", region: "Colombia", symbol: "COP" },
  { code: "ARS", label: "Peso argentino", region: "Argentina", symbol: "ARS" },
  { code: "BOB", label: "Boliviano", region: "Bolivia", symbol: "BOB" },
  { code: "UYU", label: "Peso uruguayo", region: "Uruguay", symbol: "UYU" },
  { code: "PYG", label: "Guarani", region: "Paraguay", symbol: "PYG" },
  { code: "VES", label: "Bolivar digital", region: "Venezuela", symbol: "VES" },
  { code: "CRC", label: "Colon costarricense", region: "Costa Rica", symbol: "CRC" },
  { code: "DOP", label: "Peso dominicano", region: "Republica Dominicana", symbol: "DOP" },
  { code: "GTQ", label: "Quetzal", region: "Guatemala", symbol: "GTQ" },
  { code: "HNL", label: "Lempira", region: "Honduras", symbol: "HNL" },
  { code: "NIO", label: "Cordoba oro", region: "Nicaragua", symbol: "NIO" },
  { code: "PAB", label: "Balboa", region: "Panama", symbol: "PAB" },
  { code: "SGD", label: "Dolar de Singapur", region: "Singapur", symbol: "SGD" },
  { code: "HKD", label: "Dolar de Hong Kong", region: "Hong Kong", symbol: "HKD" },
  { code: "NZD", label: "Dolar neozelandes", region: "Nueva Zelanda", symbol: "NZD" },
  { code: "SEK", label: "Corona sueca", region: "Suecia", symbol: "SEK" },
  { code: "NOK", label: "Corona noruega", region: "Noruega", symbol: "NOK" },
  { code: "DKK", label: "Corona danesa", region: "Dinamarca", symbol: "DKK" },
  { code: "ZAR", label: "Rand sudafricano", region: "Sudafrica", symbol: "ZAR" },
  { code: "AED", label: "Dirham de Emiratos", region: "Emiratos Arabes Unidos", symbol: "AED" },
  { code: "SAR", label: "Riyal saudita", region: "Arabia Saudita", symbol: "SAR" },
  { code: "INR", label: "Rupia india", region: "India", symbol: "INR" },
  { code: "KRW", label: "Won surcoreano", region: "Corea del Sur", symbol: "KRW" },
  { code: "TRY", label: "Lira turca", region: "Turquia", symbol: "TRY" },
] as const;

export type CurrencyOption = (typeof currencyOptions)[number];
export type IconOption = (typeof iconOptions)[number];

export function isKnownAccountType(type: string) {
  return accountTypeOptions.some((option) => option.value === type);
}

export function isKnownAccountIcon(icon: string) {
  return iconOptions.some((option) => option.value === icon);
}

export function isKnownAccountColor(color: string) {
  return editorColorSwatches.some((swatch) => swatch.toLowerCase() === color.toLowerCase());
}

export function getTypePreset(type: string) {
  return accountTypeOptions.find((option) => option.value === type) ?? accountTypeOptions[0];
}

export function getIconOption(icon: string): IconOption {
  return iconOptions.find((option) => option.value === icon) ?? iconOptions[0];
}

export function getCurrencyOption(currencyCode: string): CurrencyOption | null {
  return currencyOptions.find((option) => option.code === currencyCode.trim().toUpperCase()) ?? null;
}

export function buildCurrencyLabel(currencyCode: string) {
  const option = getCurrencyOption(currencyCode);

  if (option) {
    return option;
  }

  const normalizedCode = currencyCode.trim().toUpperCase();

  return normalizedCode
    ? {
        code: normalizedCode,
        label: "Moneda actual",
        region: "Configurada en la base",
        symbol: normalizedCode,
      }
    : null;
}

export function getAccountIcon(icon: string, type: string) {
  const resolvedIcon = icon || getTypePreset(type).icon;

  switch (resolvedIcon) {
    case "landmark":
      return Landmark;
    case "piggy-bank":
      return PiggyBank;
    case "credit-card":
      return CreditCard;
    case "trending-up":
      return TrendingUp;
    case "briefcase":
      return BriefcaseBusiness;
    case "banknote":
      return Banknote;
    case "building-2":
      return Building2;
    case "smartphone":
      return Smartphone;
    case "vault":
      return Vault;
    case "coins":
      return Coins;
    case "circle-dollar-sign":
      return CircleDollarSign;
    case "badge-dollar-sign":
      return BadgeDollarSign;
    case "hand-coins":
      return HandCoins;
    case "receipt-text":
      return ReceiptText;
    case "store":
      return Store;
    case "house":
      return House;
    case "car-front":
      return CarFront;
    case "plane":
      return Plane;
    case "gem":
      return Gem;
    case "shield":
      return Shield;
    default:
      return Wallet2;
  }
}

export function buildAccountTypePickerOptions(): PickerOption[] {
  return accountTypeOptions.map((option) => ({
    value: option.value,
    label: option.label,
    description: option.description,
    leadingLabel: option.label.slice(0, 2).toUpperCase(),
    leadingColor: option.color,
    searchText: `${option.value} ${option.label} ${option.description}`,
  }));
}

export function buildIconPickerOptions(color: string): PickerOption[] {
  return iconOptions.map((option) => ({
    value: option.value,
    label: option.label,
    description: option.description,
    leadingLabel: option.label.slice(0, 2).toUpperCase(),
    leadingColor: color,
    searchText: `${option.value} ${option.label} ${option.description}`,
  }));
}

export function buildCurrencyPickerOptions(): PickerOption[] {
  return currencyOptions.map((option) => ({
    value: option.code,
    label: option.code,
    description: `${option.label} - ${option.region}`,
    leadingLabel: option.symbol,
    searchText: `${option.code} ${option.label} ${option.region} ${option.symbol}`,
  }));
}
