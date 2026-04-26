import type { AppSettings, WorkEntry } from "@/types";

export const defaultSettings: AppSettings = {
  userName: "Your Name",
  abn: "12 345 678 901",
  address: "Brisbane QLD",
  bankName: "Your Bank",
  bsb: "000-000",
  accountNumber: "123456789",
  clientName: "Pro One",
  clientAddress: "Brisbane QLD",
  standardHourlyRate: 35,
  dailyRegularLimitHours: 9,
  overtimeMultiplier: 1.5,
  declaredWeeklyLimitHours: 24
};

export const mockEntries: WorkEntry[] = [
  {
    id: "mock-2026-04-09",
    date: "2026-04-09",
    location: "Cockatoo Hill Park",
    startTime: "07:00",
    endTime: "15:00",
    breakMinutes: 0,
    notes: "Example 8h normal day.",
    createdAt: "2026-04-09T06:00:00.000Z",
    updatedAt: "2026-04-09T06:00:00.000Z"
  },
  {
    id: "mock-2026-04-10",
    date: "2026-04-10",
    location: "Cockatoo Hill Park",
    startTime: "07:00",
    endTime: "17:00",
    breakMinutes: 0,
    notes: "Example 10h day with 1h overtime.",
    createdAt: "2026-04-10T06:00:00.000Z",
    updatedAt: "2026-04-10T06:00:00.000Z"
  },
  {
    id: "mock-2026-04-14",
    date: "2026-04-14",
    location: "Cockatoo Hill Park",
    startTime: "07:00",
    endTime: "17:30",
    breakMinutes: 30,
    notes: "Long day for weekly invoice cap demo.",
    createdAt: "2026-04-14T06:00:00.000Z",
    updatedAt: "2026-04-14T06:00:00.000Z"
  },
  {
    id: "mock-2026-04-15",
    date: "2026-04-15",
    location: "Walton Bridge Reserve",
    startTime: "07:00",
    endTime: "15:30",
    breakMinutes: 30,
    notes: "Completes a Thu-Wed week above 24 real hours.",
    createdAt: "2026-04-15T06:00:00.000Z",
    updatedAt: "2026-04-15T06:00:00.000Z"
  }
];
