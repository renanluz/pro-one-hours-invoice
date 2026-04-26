import type { AppSettings, WeekRange, WeeklySummary, WorkEntry } from "@/types";
import {
  addDays,
  formatDate,
  parseLocalDate,
  roundHours,
  roundMoney,
  roundRate,
  toIsoDate
} from "./format";
import { calculateEntriesTotal } from "./payroll";

const THURSDAY = 4;

export function getWorkWeekStart(dateInput: string | Date): string {
  const date =
    typeof dateInput === "string" ? parseLocalDate(dateInput) : new Date(dateInput);
  const day = date.getDay();
  const daysSinceThursday = (day - THURSDAY + 7) % 7;
  return toIsoDate(addDays(date, -daysSinceThursday));
}

export function getWeekRange(dateInput: string | Date): WeekRange {
  const start = getWorkWeekStart(dateInput);
  const end = toIsoDate(addDays(parseLocalDate(start), 6));
  return {
    start,
    end,
    label: `${formatDate(start)} - ${formatDate(end)}`
  };
}

export function isEntryInWeek(entry: WorkEntry, weekStart: string): boolean {
  const start = parseLocalDate(weekStart).getTime();
  const end = addDays(parseLocalDate(weekStart), 6).getTime();
  const current = parseLocalDate(entry.date).getTime();
  return current >= start && current <= end;
}

export function getEntriesForWeek(
  entries: WorkEntry[],
  weekStart: string
): WorkEntry[] {
  return entries
    .filter((entry) => isEntryInWeek(entry, weekStart))
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
}

export function getAvailableWeeks(entries: WorkEntry[]): WeekRange[] {
  const starts = new Set(entries.map((entry) => getWorkWeekStart(entry.date)));
  starts.add(getWorkWeekStart(new Date()));

  return Array.from(starts)
    .sort((a, b) => b.localeCompare(a))
    .map((start) => getWeekRange(start));
}

export function buildWeeklySummary(
  entries: WorkEntry[],
  weekStart: string,
  settings: AppSettings
): WeeklySummary {
  const weekEntries = getEntriesForWeek(entries, weekStart);
  const totals = calculateEntriesTotal(weekEntries, settings);
  const suggestedDeclaredHours = roundHours(
    totals.totalHours > settings.declaredWeeklyLimitHours
      ? settings.declaredWeeklyLimitHours
      : totals.totalHours
  );

  return {
    week: getWeekRange(weekStart),
    entries: weekEntries,
    totalHours: totals.totalHours,
    regularHours: totals.regularHours,
    overtimeHours: totals.overtimeHours,
    realAmount: totals.totalAmount,
    suggestedDeclaredHours,
    suggestedInvoiceRate:
      suggestedDeclaredHours > 0
        ? roundRate(roundMoney(totals.totalAmount) / suggestedDeclaredHours)
        : settings.standardHourlyRate
  };
}
