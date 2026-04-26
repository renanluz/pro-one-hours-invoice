const moneyFormatter = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD"
});

const numberFormatter = new Intl.NumberFormat("en-AU", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
});

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function roundHours(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function roundRate(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

export function formatMoney(value: number): string {
  return moneyFormatter.format(Number.isFinite(value) ? value : 0);
}

export function formatHours(value: number): string {
  return `${numberFormatter.format(Number.isFinite(value) ? value : 0)}h`;
}

export function formatUnitPrice(value: number): string {
  const rounded = roundRate(value);
  const hasExtraPrecision = Math.abs(rounded - roundMoney(rounded)) > 0.0001;
  return `$${rounded.toFixed(hasExtraPrecision ? 3 : 2)}`;
}

export function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function formatDate(value: string): string {
  const date = parseLocalDate(value);
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

export function formatShortDate(value: string): string {
  const date = parseLocalDate(value);
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "2-digit"
  }).format(date);
}

export function todayIso(): string {
  return toIsoDate(new Date());
}
