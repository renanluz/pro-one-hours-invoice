"use client";

import type { AppSettings } from "@/types";

interface SettingsPanelProps {
  settings: AppSettings;
  onChange: (settings: AppSettings) => void;
  onResetDemo: () => void;
  storageLabel?: string;
  onSignOut?: () => void;
  theme: "light" | "dark";
  onThemeChange: (theme: "light" | "dark") => void;
}

export function SettingsPanel({
  settings,
  onChange,
  onResetDemo,
  storageLabel,
  onSignOut,
  theme,
  onThemeChange
}: SettingsPanelProps) {
  function update<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    onChange({ ...settings, [key]: value });
  }

  return (
    <section className="panel settings-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Settings</p>
          <h2>Profile and rules</h2>
          {storageLabel ? <p className="settings-hint">Storage: {storageLabel}</p> : null}
        </div>
        <div className="toolbar">
          {onSignOut ? (
            <button className="ghost-button" type="button" onClick={onSignOut}>
              Sign out
            </button>
          ) : null}
          <button className="ghost-button" type="button" onClick={onResetDemo}>
            Reset demo
          </button>
        </div>
      </div>

      <div className="settings-hero">
        <div>
          <p className="eyebrow">Appearance</p>
          <h3>Theme mode</h3>
        </div>
        <div className="segmented-control segmented-control--compact" aria-label="Theme mode">
          <button type="button" className={theme === "light" ? "is-active" : ""} onClick={() => onThemeChange("light")}>
            Light
          </button>
          <button type="button" className={theme === "dark" ? "is-active" : ""} onClick={() => onThemeChange("dark")}>
            Dark
          </button>
        </div>
      </div>

      <div className="settings-grid">
        <label>
          Name
          <input value={settings.userName} onChange={(event) => update("userName", event.target.value)} />
        </label>
        <label>
          ABN
          <input value={settings.abn} onChange={(event) => update("abn", event.target.value)} />
        </label>
        <label className="wide-field">
          Address
          <textarea value={settings.address} onChange={(event) => update("address", event.target.value)} />
        </label>

        <label>
          Bank name
          <input value={settings.bankName} onChange={(event) => update("bankName", event.target.value)} />
        </label>
        <label>
          BSB
          <input value={settings.bsb} onChange={(event) => update("bsb", event.target.value)} />
        </label>
        <label>
          Account number
          <input value={settings.accountNumber} onChange={(event) => update("accountNumber", event.target.value)} />
        </label>

        <label>
          Client name
          <input value={settings.clientName} onChange={(event) => update("clientName", event.target.value)} />
        </label>
        <label className="wide-field">
          Client address
          <textarea value={settings.clientAddress} onChange={(event) => update("clientAddress", event.target.value)} />
        </label>

        <label>
          Normal hourly rate
          <input
            type="number"
            min="0"
            step="0.01"
            value={settings.standardHourlyRate}
            onChange={(event) => update("standardHourlyRate", Number(event.target.value))}
          />
        </label>
        <label>
          Daily limit before overtime
          <input
            type="number"
            min="0"
            step="0.25"
            value={settings.dailyRegularLimitHours}
            onChange={(event) => update("dailyRegularLimitHours", Number(event.target.value))}
          />
        </label>
        <label>
          Overtime multiplier
          <input
            type="number"
            min="1"
            step="0.1"
            value={settings.overtimeMultiplier}
            onChange={(event) => update("overtimeMultiplier", Number(event.target.value))}
          />
        </label>
        <label>
          Declared weekly hour limit
          <input
            type="number"
            min="0"
            step="0.25"
            value={settings.declaredWeeklyLimitHours}
            onChange={(event) => update("declaredWeeklyLimitHours", Number(event.target.value))}
          />
        </label>
      </div>
    </section>
  );
}
