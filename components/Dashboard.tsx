import type { AppSettings, WeeklySummary, WorkEntry } from "@/types";
import { calculateDailyPayroll } from "@/lib/calculations/payroll";
import { formatDate, formatHours, formatMoney, formatUnitPrice, toIsoDate } from "@/lib/calculations/format";
import { MetricCard } from "./MetricCard";
import { WeeklySummaryPanel } from "./WeeklySummaryPanel";
import { EntryForm } from "./EntryForm";

interface DashboardProps {
  settings: AppSettings;
  summary: WeeklySummary;
  recentLocations: string[];
  onSaveEntry: (entry: WorkEntry) => void | Promise<void>;
  onAddEntry: () => void;
  onOpenInvoice: () => void;
  onOpenEntries: () => void;
}

function getYesterdayIso() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return toIsoDate(date);
}

function formatCompactWeekLabel(label: string) {
  const [start, end] = label.split(" - ");
  const endYear = end.split("/").pop();
  const endWithoutYear = endYear ? end.replace(`/${endYear}`, "") : end;
  return `${start} - ${endWithoutYear}`;
}

export function Dashboard({
  settings,
  summary,
  recentLocations,
  onSaveEntry,
  onAddEntry,
  onOpenInvoice,
  onOpenEntries
}: DashboardProps) {
  const weekBadge = formatCompactWeekLabel(summary.week.label);
  const recentEntries = [...summary.entries]
    .sort((a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime))
    .slice(0, 4);
  const yesterdayIso = getYesterdayIso();

  return (
    <div className="dashboard-stack">
      <div className="dashboard-top-grid">
        <section className="hero-panel hero-panel--dashboard">
          <div className="hero-panel__head">
            <p className="eyebrow eyebrow--inverse">This week · Thu to Wed</p>
            <span className="hero-pill">{weekBadge}</span>
          </div>

          <div className="hero-copy">
            <div className="hero-metric hero-metric--primary">
              <span>Real amount</span>
              <strong>{formatMoney(summary.realAmount)}</strong>
            </div>
            <div className="hero-metric">
              <span>Hours logged</span>
              <strong>{formatHours(summary.totalHours)}</strong>
            </div>
            <div className="hero-metric">
              <span>Overtime</span>
              <strong>{formatHours(summary.overtimeHours)}</strong>
            </div>
          </div>

          <div className="hero-actions">
            <button className="primary-button primary-button--light" type="button" onClick={onOpenInvoice}>
              Open invoice
            </button>
            <button className="secondary-button secondary-button--hero" type="button" onClick={onOpenEntries}>
              See all entries
            </button>
          </div>
        </section>

        <EntryForm
          settings={settings}
          recentLocations={recentLocations}
          onSave={onSaveEntry}
          onCancelEdit={() => undefined}
          variant="compact"
          defaultDate={yesterdayIso}
          shortcutLabel="Yesterday"
          shortcutDate={yesterdayIso}
          showNotes={false}
          title="Log hours"
          eyebrow="Quick entry"
        />
      </div>

      <div className="metric-grid metric-grid--top">
        <MetricCard label="Normal hours" value={formatHours(summary.regularHours)} hint="Up to 9h/day" />
        <MetricCard label="Overtime" value={formatHours(summary.overtimeHours)} hint="After 9h/day" tone="amber" />
        <MetricCard label="Invoice hours" value={formatHours(summary.suggestedDeclaredHours)} hint="Declared" />
        <MetricCard label="Invoice rate" value={formatUnitPrice(summary.suggestedInvoiceRate)} hint="Average unit price" tone="blue" />
      </div>

      <div className="dashboard-bottom-grid">
        <WeeklySummaryPanel summary={summary} />

        <section className="panel recent-entries-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Recent work</p>
              <h2>Latest entries</h2>
            </div>
            <button className="ghost-button" type="button" onClick={onAddEntry}>
              Add entry
            </button>
          </div>

          <div className="recent-entry-list">
            {recentEntries.length === 0 ? (
              <p className="empty-state">No entries in this week yet.</p>
            ) : (
              recentEntries.map((entry) => {
                const payroll = calculateDailyPayroll(entry, settings);
                return (
                  <article className="recent-entry-card" key={entry.id}>
                    <div>
                      <strong>{entry.location}</strong>
                      <span>{formatDate(entry.date)}</span>
                    </div>
                    <div>
                      <strong>{formatMoney(payroll.totalAmount)}</strong>
                      <span>
                        {formatHours(payroll.totalHours)} · {formatHours(payroll.overtimeHours)} OT
                      </span>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
