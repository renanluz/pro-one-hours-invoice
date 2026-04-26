import { roundHours } from "./format";

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function calculateWorkedHours(
  startTime: string,
  endTime: string,
  breakMinutes = 0
): number {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);

  if (!startTime || !endTime || end <= start) {
    return 0;
  }

  const minutes = Math.max(0, end - start - Math.max(0, breakMinutes));
  return roundHours(minutes / 60);
}

export function isValidTimeRange(
  startTime: string,
  endTime: string,
  breakMinutes = 0
): boolean {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  return Boolean(startTime && endTime && end > start && end - start > breakMinutes);
}
