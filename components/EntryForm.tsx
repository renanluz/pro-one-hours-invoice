"use client";

import { FormEvent, useEffect, useState } from "react";
import type { AppSettings, WorkEntry } from "@/types";
import { calculateDailyPayroll } from "@/lib/calculations/payroll";
import { formatHours, formatMoney, todayIso } from "@/lib/calculations/format";
import { isValidTimeRange } from "@/lib/calculations/time";

type EntryDraft = Omit<WorkEntry, "id" | "createdAt" | "updatedAt">;

function createEmptyDraft(date = todayIso()): EntryDraft {
  return {
    date,
    location: "",
    startTime: "07:00",
    endTime: "15:00",
    breakMinutes: 0,
    notes: ""
  };
}

interface EntryFormProps {
  settings: AppSettings;
  recentLocations: string[];
  editingEntry?: WorkEntry;
  onSave: (entry: WorkEntry) => void;
  onCancelEdit: () => void;
  variant?: "full" | "compact";
  defaultDate?: string;
  shortcutLabel?: string;
  shortcutDate?: string;
  showNotes?: boolean;
  title?: string;
  eyebrow?: string;
}

export function EntryForm({
  settings,
  recentLocations,
  editingEntry,
  onSave,
  onCancelEdit,
  variant = "full",
  defaultDate,
  shortcutLabel = "Today",
  shortcutDate,
  showNotes = true,
  title,
  eyebrow = "Daily log"
}: EntryFormProps) {
  const fallbackDate = defaultDate ?? todayIso();
  const [draft, setDraft] = useState<EntryDraft>(editingEntry ?? createEmptyDraft(fallbackDate));

  useEffect(() => {
    setDraft(editingEntry ?? createEmptyDraft(fallbackDate));
  }, [editingEntry, fallbackDate]);

  const calculated = calculateDailyPayroll(draft, settings);
  const isValid =
    draft.date &&
    draft.location.trim().length > 1 &&
    isValidTimeRange(draft.startTime, draft.endTime, draft.breakMinutes);

  function update<K extends keyof EntryDraft>(key: K, value: EntryDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValid) {
      return;
    }

    const now = new Date().toISOString();
    onSave({
      ...draft,
      location: draft.location.trim(),
      notes: draft.notes?.trim(),
      id: editingEntry?.id ?? crypto.randomUUID(),
      createdAt: editingEntry?.createdAt ?? now,
      updatedAt: now
    });

    if (!editingEntry) {
      setDraft({
        ...createEmptyDraft(fallbackDate),
        date: fallbackDate,
        location: draft.location
      });
    }
  }

  return (
    <section className={`panel entry-panel entry-panel--${variant}`} id="entry-form">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title ?? (editingEntry ? "Edit work entry" : "Add work entry")}</h2>
        </div>
        {shortcutDate ? (
          <button className="ghost-button" type="button" onClick={() => update("date", shortcutDate)}>
            {shortcutLabel}
          </button>
        ) : null}
      </div>

      <form className="entry-form" onSubmit={submit}>
        <label>
          Date
          <input type="date" value={draft.date} onChange={(event) => update("date", event.target.value)} />
        </label>

        <label>
          Location
          <input
            list="recent-locations"
            placeholder="Cockatoo Hill Park"
            value={draft.location}
            onChange={(event) => update("location", event.target.value)}
          />
          <datalist id="recent-locations">
            {recentLocations.map((location) => (
              <option key={location} value={location} />
            ))}
          </datalist>
        </label>

        <div className="form-grid form-grid--three">
          <label>
            Start
            <input type="time" value={draft.startTime} onChange={(event) => update("startTime", event.target.value)} />
          </label>
          <label>
            Finish
            <input type="time" value={draft.endTime} onChange={(event) => update("endTime", event.target.value)} />
          </label>
          <label>
            Break min
            <input
              type="number"
              min="0"
              step="5"
              value={draft.breakMinutes}
              onChange={(event) => update("breakMinutes", Number(event.target.value))}
            />
          </label>
        </div>

        {showNotes ? (
          <label>
            Notes
            <textarea value={draft.notes ?? ""} onChange={(event) => update("notes", event.target.value)} />
          </label>
        ) : null}

        {variant === "compact" ? (
          <div className="calc-strip calc-strip--compact">
            <div>
              <span>
                {formatHours(calculated.totalHours)} total · {formatHours(calculated.overtimeHours)} overtime
              </span>
            </div>
            <strong>{formatMoney(calculated.totalAmount)}</strong>
          </div>
        ) : (
          <div className="calc-strip">
            <span>{formatHours(calculated.totalHours)} total</span>
            <span>{formatHours(calculated.regularHours)} normal</span>
            <span>{formatHours(calculated.overtimeHours)} overtime</span>
            <strong>{formatMoney(calculated.totalAmount)}</strong>
          </div>
        )}

        {!isValid ? (
          <p className="form-error">Check location, start/finish time, and break duration.</p>
        ) : null}

        <div className="form-actions">
          {editingEntry ? (
            <button className="ghost-button" type="button" onClick={onCancelEdit}>
              Cancel
            </button>
          ) : null}
          <button className="primary-button" type="submit" disabled={!isValid}>
            {editingEntry ? "Save changes" : "Save entry"}
          </button>
        </div>
      </form>
    </section>
  );
}
