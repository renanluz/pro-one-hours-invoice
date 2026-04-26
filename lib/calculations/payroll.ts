import type { AppSettings, DailyCalculation, WorkEntry } from "@/types";
import { roundHours, roundMoney } from "./format";
import { calculateWorkedHours } from "./time";

export function calculateDailyPayroll(
  entry: Pick<WorkEntry, "startTime" | "endTime" | "breakMinutes">,
  settings: AppSettings
): DailyCalculation {
  const totalHours = calculateWorkedHours(
    entry.startTime,
    entry.endTime,
    entry.breakMinutes
  );
  const regularHours = roundHours(
    Math.min(totalHours, settings.dailyRegularLimitHours)
  );
  const overtimeHours = roundHours(Math.max(0, totalHours - regularHours));
  const overtimeRate = settings.standardHourlyRate * settings.overtimeMultiplier;
  const regularAmount = roundMoney(regularHours * settings.standardHourlyRate);
  const overtimeAmount = roundMoney(overtimeHours * overtimeRate);

  return {
    totalHours,
    regularHours,
    overtimeHours,
    regularAmount,
    overtimeAmount,
    totalAmount: roundMoney(regularAmount + overtimeAmount)
  };
}

export function calculateEntriesTotal(
  entries: WorkEntry[],
  settings: AppSettings
): DailyCalculation {
  return entries.reduce<DailyCalculation>(
    (total, entry) => {
      const day = calculateDailyPayroll(entry, settings);
      return {
        totalHours: roundHours(total.totalHours + day.totalHours),
        regularHours: roundHours(total.regularHours + day.regularHours),
        overtimeHours: roundHours(total.overtimeHours + day.overtimeHours),
        regularAmount: roundMoney(total.regularAmount + day.regularAmount),
        overtimeAmount: roundMoney(total.overtimeAmount + day.overtimeAmount),
        totalAmount: roundMoney(total.totalAmount + day.totalAmount)
      };
    },
    {
      totalHours: 0,
      regularHours: 0,
      overtimeHours: 0,
      regularAmount: 0,
      overtimeAmount: 0,
      totalAmount: 0
    }
  );
}
