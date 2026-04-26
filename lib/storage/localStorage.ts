"use client";

import type { AppSettings, WorkEntry } from "@/types";
import { defaultSettings, mockEntries } from "./defaults";

const ENTRIES_KEY = "pro-one.work-entries";
const SETTINGS_KEY = "pro-one.settings";

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

export function loadEntries(): WorkEntry[] {
  return readJson<WorkEntry[]>(ENTRIES_KEY, mockEntries);
}

export function saveEntries(entries: WorkEntry[]): void {
  writeJson(ENTRIES_KEY, entries);
}

export function loadSettings(): AppSettings {
  return {
    ...defaultSettings,
    ...readJson<Partial<AppSettings>>(SETTINGS_KEY, defaultSettings)
  };
}

export function saveSettings(settings: AppSettings): void {
  writeJson(SETTINGS_KEY, settings);
}

export function resetDemoData(): void {
  saveEntries(mockEntries);
  saveSettings(defaultSettings);
}

export function getRecentLocations(entries: WorkEntry[]): string[] {
  return Array.from(new Set(entries.map((entry) => entry.location).filter(Boolean))).slice(0, 8);
}
