"use client";

import type { AppSettings, WeekRange, WorkEntry } from "@/types";
import { calculateDailyPayroll } from "@/lib/calculations/payroll";
import { formatDate, formatHours, formatMoney } from "@/lib/calculations/format";

interface EntriesListProps {
  entries: WorkEntry[];
  weeks: WeekRange[];
  weekStart: string;
  settings: AppSettings;
  onWeekChange: (weekStart: string) => void;
  onEdit: (entry: WorkEntry) => void;
  onDelete: (entryId: string) => void;
}

export function EntriesList({
  entries,
  weeks,
  weekStart,
  settings,
  onWeekChange,
  onEdit,
  onDelete
}: EntriesListProps) {
  return (
    <section className="panel entries-panel">
      <div className="section-heading section-heading--stack">
        <div>
          <p className="eyebrow">Timesheet</p>
          <h2>Work entries</h2>
        </div>
        <label className="compact-field">
          Week
          <select value={weekStart} onChange={(event) => onWeekChange(event.target.value)}>
            {weeks.map((week) => (
              <option key={week.start} value={week.start}>
                {week.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="entry-list">
        {entries.length === 0 ? (
          <p className="empty-state">No entries in this week.</p>
        ) : (
          entries.map((entry) => {
            const payroll = calculateDailyPayroll(entry, settings);
            return (
              <article className="entry-row" key={entry.id}>
                <div className="entry-row__main">
                  <strong>{formatDate(entry.date)}</strong>
                  <span>{entry.location}</span>
                  <small>
                    {entry.startTime} - {entry.endTime}
                    {entry.breakMinutes ? `, ${entry.breakMinutes}m break` : ""}
                  </small>
                </div>
                <div className="entry-row__numbers">
                  <strong>{formatMoney(payroll.totalAmount)}</strong>
                  <span>{formatHours(payroll.totalHours)}</span>
                  <small>{formatHours(payroll.overtimeHours)} OT</small>
                </div>
                <div className="entry-row__actions">
                  <button type="button" className="ghost-button ghost-button--small" onClick={() => onEdit(entry)} aria-label="Edit entry">
                    Edit
                  </button>
                  <button
                    type="button"
                    className="ghost-button ghost-button--small ghost-button--danger"
                    onClick={() => {
                      if (window.confirm("Delete this work entry?")) {
                        onDelete(entry.id);
                      }
                    }}
                    aria-label="Delete entry"
                  >
                    Delete
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
