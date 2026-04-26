"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppSettings, WorkEntry } from "@/types";
import { defaultSettings } from "@/lib/storage/defaults";

interface AppSettingsRow {
  user_id: string;
  user_name: string;
  abn: string;
  address: string;
  bank_name: string;
  bsb: string;
  account_number: string;
  client_name: string;
  client_address: string;
  standard_hourly_rate: number;
  daily_regular_limit_hours: number;
  overtime_multiplier: number;
  declared_weekly_limit_hours: number;
  created_at?: string;
  updated_at?: string;
}

interface WorkEntryRow {
  id: string;
  user_id: string;
  date: string;
  location: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function mapSettingsRow(row: AppSettingsRow | null): AppSettings {
  if (!row) {
    return defaultSettings;
  }

  return {
    userName: row.user_name,
    abn: row.abn,
    address: row.address,
    bankName: row.bank_name,
    bsb: row.bsb,
    accountNumber: row.account_number,
    clientName: row.client_name,
    clientAddress: row.client_address,
    standardHourlyRate: row.standard_hourly_rate,
    dailyRegularLimitHours: row.daily_regular_limit_hours,
    overtimeMultiplier: row.overtime_multiplier,
    declaredWeeklyLimitHours: row.declared_weekly_limit_hours
  };
}

function mapSettingsToRow(userId: string, settings: AppSettings): AppSettingsRow {
  return {
    user_id: userId,
    user_name: settings.userName,
    abn: settings.abn,
    address: settings.address,
    bank_name: settings.bankName,
    bsb: settings.bsb,
    account_number: settings.accountNumber,
    client_name: settings.clientName,
    client_address: settings.clientAddress,
    standard_hourly_rate: settings.standardHourlyRate,
    daily_regular_limit_hours: settings.dailyRegularLimitHours,
    overtime_multiplier: settings.overtimeMultiplier,
    declared_weekly_limit_hours: settings.declaredWeeklyLimitHours
  };
}

function mapEntryRow(row: WorkEntryRow): WorkEntry {
  return {
    id: row.id,
    date: row.date,
    location: row.location,
    startTime: row.start_time.slice(0, 5),
    endTime: row.end_time.slice(0, 5),
    breakMinutes: row.break_minutes,
    notes: row.notes ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapEntryToRow(userId: string, entry: WorkEntry): WorkEntryRow {
  return {
    id: entry.id,
    user_id: userId,
    date: entry.date,
    location: entry.location,
    start_time: entry.startTime,
    end_time: entry.endTime,
    break_minutes: entry.breakMinutes,
    notes: entry.notes?.trim() || null,
    created_at: entry.createdAt,
    updated_at: entry.updatedAt
  };
}

export async function fetchRemoteAppData(
  supabase: SupabaseClient
): Promise<{ entries: WorkEntry[]; settings: AppSettings }> {
  const [{ data: entryRows, error: entriesError }, { data: settingsRow, error: settingsError }] =
    await Promise.all([
      supabase
        .from("work_entries")
        .select("*")
        .order("date", { ascending: false })
        .order("start_time", { ascending: false }),
      supabase.from("app_settings").select("*").maybeSingle()
    ]);

  if (entriesError) {
    throw entriesError;
  }

  if (settingsError) {
    throw settingsError;
  }

  return {
    entries: (entryRows as WorkEntryRow[] | null)?.map(mapEntryRow) ?? [],
    settings: mapSettingsRow(settingsRow as AppSettingsRow | null)
  };
}

export async function upsertRemoteSettings(
  supabase: SupabaseClient,
  userId: string,
  settings: AppSettings
): Promise<void> {
  const { error } = await supabase
    .from("app_settings")
    .upsert(mapSettingsToRow(userId, settings), { onConflict: "user_id" });

  if (error) {
    throw error;
  }
}

export async function upsertRemoteEntry(
  supabase: SupabaseClient,
  userId: string,
  entry: WorkEntry
): Promise<void> {
  const { error } = await supabase
    .from("work_entries")
    .upsert(mapEntryToRow(userId, entry), { onConflict: "id" });

  if (error) {
    throw error;
  }
}

export async function deleteRemoteEntry(
  supabase: SupabaseClient,
  entryId: string
): Promise<void> {
  const { error } = await supabase.from("work_entries").delete().eq("id", entryId);

  if (error) {
    throw error;
  }
}

export async function replaceRemoteEntries(
  supabase: SupabaseClient,
  userId: string,
  entries: WorkEntry[]
): Promise<void> {
  const { error: deleteError } = await supabase
    .from("work_entries")
    .delete()
    .not("id", "is", null);

  if (deleteError) {
    throw deleteError;
  }

  if (entries.length === 0) {
    return;
  }

  const rows = entries.map((entry) => mapEntryToRow(userId, entry));
  const { error: insertError } = await supabase.from("work_entries").insert(rows);

  if (insertError) {
    throw insertError;
  }
}
