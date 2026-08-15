"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import type { AppSettings, WorkEntry } from "@/types";
import { AuthScreen } from "./AuthScreen";
import { Dashboard } from "./Dashboard";
import { EntryForm } from "./EntryForm";
import { EntriesList } from "./EntriesList";
import { InvoiceBuilder } from "./InvoiceBuilder";
import { SettingsPanel } from "./SettingsPanel";
import { buildWeeklySummary, getAvailableWeeks, getEntriesForWeek, getWorkWeekStart } from "@/lib/calculations/week";
import { todayIso } from "@/lib/calculations/format";
import { defaultSettings, mockEntries } from "@/lib/storage/defaults";
import {
  getRecentLocations,
  loadEntries,
  loadSettings,
  resetDemoData,
  saveEntries,
  saveSettings
} from "@/lib/storage/localStorage";
import { getSupabaseBrowserClient, isSupabaseEnabled } from "@/lib/supabase/client";
import {
  deleteRemoteEntry,
  fetchRemoteAppData,
  replaceRemoteEntries,
  upsertRemoteEntry,
  upsertRemoteSettings
} from "@/lib/supabase/repository";

type AppTab = "dashboard" | "entries" | "invoice" | "settings";
type StorageMode = "local" | "supabase";
type ThemeMode = "light" | "dark";
const ALLOWED_EMAIL = "ren4n@live.com";
const THEME_KEY = "pro-one.theme";

function loadThemePreference(): ThemeMode {
  if (typeof window === "undefined") {
    return "light";
  }

  const saved = window.localStorage.getItem(THEME_KEY);
  return saved === "dark" ? "dark" : "light";
}

export function HoursInvoiceApp() {
  const supabase = getSupabaseBrowserClient();
  const cloudEnabled = isSupabaseEnabled();
  const [hydrated, setHydrated] = useState(false);
  const [entries, setEntries] = useState<WorkEntry[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [selectedWeekStart, setSelectedWeekStart] = useState(getWorkWeekStart(todayIso()));
  const [editingEntry, setEditingEntry] = useState<WorkEntry | undefined>();
  const [activeTab, setActiveTab] = useState<AppTab>("dashboard");
  const [storageMode, setStorageMode] = useState<StorageMode>("local");
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeMode>("light");
  const settingsInitializedRef = useRef(false);

  useEffect(() => {
    const nextTheme = loadThemePreference();
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(THEME_KEY, theme);
    }
  }, [theme]);

  useEffect(() => {
    if (!cloudEnabled || !supabase) {
      const loadedEntries = loadEntries();
      setEntries(loadedEntries);
      setSettings(loadSettings());
      setSelectedWeekStart(getWorkWeekStart(todayIso()));
      setStorageMode("local");
      setAuthReady(true);
      setHydrated(true);
      settingsInitializedRef.current = false;
      return;
    }

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        setAuthError(error.message);
      }

      setSession(data.session);
      setAuthReady(true);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthReady(true);
      setAuthError(null);
    });

    return () => subscription.unsubscribe();
  }, [cloudEnabled, supabase]);

  useEffect(() => {
    if (!cloudEnabled || !supabase || !authReady) {
      return;
    }

    if (!session) {
      setHydrated(false);
      setEntries([]);
      setSettings(null);
      setStorageMode("supabase");
      settingsInitializedRef.current = false;
      return;
    }

    const client = supabase;
    let cancelled = false;

    async function loadCloudData() {
      try {
        setSyncError(null);
        setHydrated(false);
        const remote = await fetchRemoteAppData(client);
        if (cancelled) {
          return;
        }

        setEntries(remote.entries);
        setSettings(remote.settings);
        setSelectedWeekStart(getWorkWeekStart(todayIso()));
        setStorageMode("supabase");
        settingsInitializedRef.current = false;
        setHydrated(true);
      } catch (error) {
        if (!cancelled) {
          setSyncError(error instanceof Error ? error.message : "Failed to load cloud data.");
          setSettings(defaultSettings);
          setEntries([]);
          setHydrated(true);
        }
      }
    }

    void loadCloudData();

    return () => {
      cancelled = true;
    };
  }, [authReady, cloudEnabled, session, supabase]);

  useEffect(() => {
    if (hydrated && storageMode === "local") {
      saveEntries(entries);
    }
  }, [entries, hydrated, storageMode]);

  useEffect(() => {
    if (!hydrated || !settings) {
      return;
    }

    if (storageMode === "local") {
      saveSettings(settings);
      return;
    }

    if (!cloudEnabled || !supabase || !session?.user.id) {
      return;
    }

    if (!settingsInitializedRef.current) {
      settingsInitializedRef.current = true;
      return;
    }

    const timeout = window.setTimeout(() => {
      void upsertRemoteSettings(supabase, session.user.id, settings).catch((error) => {
        setSyncError(error instanceof Error ? error.message : "Failed to save settings.");
      });
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [cloudEnabled, hydrated, session, settings, storageMode, supabase]);

  const weeks = useMemo(() => getAvailableWeeks(entries), [entries]);
  const selectedWeekEntries = useMemo(
    () => getEntriesForWeek(entries, selectedWeekStart),
    [entries, selectedWeekStart]
  );
  const summary = useMemo(
    () =>
      settings
        ? buildWeeklySummary(entries, selectedWeekStart, settings)
        : null,
    [entries, selectedWeekStart, settings]
  );
  const recentLocations = useMemo(() => getRecentLocations(entries), [entries]);

  async function saveEntry(entry: WorkEntry) {
    if (storageMode === "supabase" && supabase && session?.user.id) {
      try {
        await upsertRemoteEntry(supabase, session.user.id, entry);
        setSyncError(null);
      } catch (error) {
        setSyncError(error instanceof Error ? error.message : "Failed to save entry.");
        return;
      }
    }

    setEntries((current) => {
      const exists = current.some((item) => item.id === entry.id);
      const next = exists
        ? current.map((item) => (item.id === entry.id ? entry : item))
        : [...current, entry];
      return next.sort((a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime));
    });
    setSelectedWeekStart(getWorkWeekStart(entry.date));
    setEditingEntry(undefined);
    setActiveTab("entries");
  }

  async function deleteEntry(entryId: string) {
    if (storageMode === "supabase" && supabase) {
      try {
        await deleteRemoteEntry(supabase, entryId);
        setSyncError(null);
      } catch (error) {
        setSyncError(error instanceof Error ? error.message : "Failed to delete entry.");
        return;
      }
    }

    setEntries((current) => current.filter((entry) => entry.id !== entryId));
    if (editingEntry?.id === entryId) {
      setEditingEntry(undefined);
    }
  }

  function editEntry(entry: WorkEntry) {
    setEditingEntry(entry);
    setActiveTab("entries");
    window.setTimeout(() => {
      document.getElementById("entry-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  async function resetDemo() {
    if (!window.confirm("Reset entries and settings to demo data?")) {
      return;
    }

    if (storageMode === "supabase" && supabase && session?.user.id) {
      try {
        await Promise.all([
          upsertRemoteSettings(supabase, session.user.id, defaultSettings),
          replaceRemoteEntries(supabase, session.user.id, mockEntries)
        ]);
        setSyncError(null);
      } catch (error) {
        setSyncError(error instanceof Error ? error.message : "Failed to reset demo data.");
        return;
      }
    } else {
      resetDemoData();
    }

    setEntries(mockEntries);
    setSettings(defaultSettings);
    setSelectedWeekStart("2026-04-09");
    setEditingEntry(undefined);
    setActiveTab("dashboard");
    settingsInitializedRef.current = false;
  }

  async function signInWithPassword(email: string, password: string) {
    if (!supabase) {
      return;
    }

    try {
      setAuthLoading(true);
      setAuthError(null);
      if (email.trim().toLowerCase() !== ALLOWED_EMAIL) {
        throw new Error("Invalid email or password.");
      }
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Failed to sign in.");
      throw error;
    } finally {
      setAuthLoading(false);
    }
  }

  async function signOut() {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    setEntries([]);
    setSettings(null);
    setHydrated(false);
    setActiveTab("dashboard");
  }

  if (cloudEnabled && authReady && !session) {
    return (
      <AuthScreen
        onSignIn={signInWithPassword}
        loading={authLoading}
        error={authError}
      />
    );
  }

  if (!hydrated || !settings || !summary) {
    return <main className="app-shell app-shell--loading">Loading...</main>;
  }

  const week = summary.week;

  return (
    <main className="app-shell">
      <div className="app-frame">
        <header className="top-bar">
          <div className="brand">
            <img
              src={theme === "dark" ? "/logo/rl-mark-reverse.svg" : "/logo/rl-mark-reverse.svg"}
              alt="Renan Luz"
              className="brand__mark"
            />
            <div className="brand__copy">
              <strong>Renan Luz</strong>
              <span>Hours · Invoice</span>
            </div>
          </div>

          <nav className="top-nav" aria-label="Primary navigation">
            <button className={activeTab === "dashboard" ? "is-active" : ""} onClick={() => setActiveTab("dashboard")}>
              Dashboard
            </button>
            <button className={activeTab === "entries" ? "is-active" : ""} onClick={() => setActiveTab("entries")}>
              Entries
            </button>
            <button className={activeTab === "invoice" ? "is-active" : ""} onClick={() => setActiveTab("invoice")}>
              Invoice
            </button>
            <button className={activeTab === "settings" ? "is-active" : ""} onClick={() => setActiveTab("settings")}>
              Settings
            </button>
          </nav>
        </header>

        <section className="app-content">
          {syncError ? <p className="sync-banner">{syncError}</p> : null}

          {activeTab === "dashboard" ? (
            <Dashboard
              settings={settings}
              summary={summary}
              recentLocations={recentLocations}
              onSaveEntry={(entry) => void saveEntry(entry)}
              onAddEntry={() => setActiveTab("entries")}
              onOpenEntries={() => setActiveTab("entries")}
              onOpenInvoice={() => setActiveTab("invoice")}
            />
          ) : null}

          {activeTab === "entries" ? (
            <div className="two-column-layout">
              <EntryForm
                settings={settings}
                recentLocations={recentLocations}
                editingEntry={editingEntry}
                onSave={(entry) => void saveEntry(entry)}
                onCancelEdit={() => setEditingEntry(undefined)}
                shortcutLabel="Today"
                shortcutDate={todayIso()}
              />
              <EntriesList
                entries={selectedWeekEntries}
                weeks={weeks}
                weekStart={selectedWeekStart}
                settings={settings}
                onWeekChange={setSelectedWeekStart}
                onEdit={editEntry}
                onDelete={(entryId) => void deleteEntry(entryId)}
              />
            </div>
          ) : null}

          {activeTab === "invoice" ? (
            <InvoiceBuilder
              entries={selectedWeekEntries}
              settings={settings}
              weeks={weeks}
              week={week}
              weekStart={selectedWeekStart}
              onWeekChange={setSelectedWeekStart}
            />
          ) : null}

          {activeTab === "settings" ? (
            <SettingsPanel
              settings={settings}
              onChange={setSettings}
              onResetDemo={() => void resetDemo()}
              storageLabel={storageMode === "supabase" ? "Supabase cloud" : "Local browser"}
              onSignOut={storageMode === "supabase" ? () => void signOut() : undefined}
              theme={theme}
              onThemeChange={setTheme}
            />
          ) : null}
        </section>
      </div>
    </main>
  );
}
