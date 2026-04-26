import type { WeeklySummary } from "@/types";
import { formatHours, formatMoney } from "@/lib/calculations/format";
import { MetricCard } from "./MetricCard";
import { WeeklySummaryPanel } from "./WeeklySummaryPanel";

interface DashboardProps {
  summary: WeeklySummary;
  onAddEntry: () => void;
  onOpenInvoice: () => void;
}

export function Dashboard({ summary, onAddEntry, onOpenInvoice }: DashboardProps) {
  return (
    <div className="stack">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Pro One hours</p>
          <h1>Real payroll and invoice control</h1>
          <p>{summary.week.label}</p>
        </div>
        <div className="hero-actions">
          <button className="primary-button" type="button" onClick={onAddEntry}>
            Add entry
          </button>
          <button className="secondary-button" type="button" onClick={onOpenInvoice}>
            Open invoice
          </button>
        </div>
      </section>

      <div className="metric-grid metric-grid--top">
        <MetricCard label="Real week" value={formatHours(summary.totalHours)} hint="Logged hours" />
        <MetricCard label="Real amount" value={formatMoney(summary.realAmount)} hint="With overtime" tone="green" />
        <MetricCard label="Invoice hours" value={formatHours(summary.suggestedDeclaredHours)} hint="Declared" tone="blue" />
        <MetricCard label="Invoice total" value={formatMoney(summary.realAmount)} hint="Target total" tone="green" />
      </div>

      <WeeklySummaryPanel summary={summary} />
    </div>
  );
}
