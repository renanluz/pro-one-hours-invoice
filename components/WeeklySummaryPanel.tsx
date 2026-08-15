import type { WeeklySummary } from "@/types";
import { formatHours, formatMoney, formatUnitPrice } from "@/lib/calculations/format";
import { MetricCard } from "./MetricCard";

interface WeeklySummaryPanelProps {
  summary: WeeklySummary;
}

export function WeeklySummaryPanel({ summary }: WeeklySummaryPanelProps) {
  const overLimit = summary.totalHours > summary.suggestedDeclaredHours;
  const regularShare = summary.totalHours > 0 ? (summary.regularHours / summary.totalHours) * 100 : 0;
  const overtimeShare = summary.totalHours > 0 ? (summary.overtimeHours / summary.totalHours) * 100 : 0;

  return (
    <section className="panel weekly-summary-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Thursday to Wednesday</p>
          <h2>{summary.week.label}</h2>
        </div>
        <span className={overLimit ? "status-pill status-pill--amber" : "status-pill"}>
          {overLimit ? "Invoice capped" : "Real hours"}
        </span>
      </div>

      <div className="hours-breakdown">
        <div className="hours-breakdown__bar" aria-hidden="true">
          <span className="hours-breakdown__regular" style={{ width: `${regularShare}%` }} />
          <span className="hours-breakdown__overtime" style={{ width: `${overtimeShare}%` }} />
        </div>
        <div className="hours-breakdown__legend">
          <span>Regular {formatHours(summary.regularHours)}</span>
          <span>Overtime {formatHours(summary.overtimeHours)}</span>
        </div>
      </div>

      <div className="metric-grid">
        <MetricCard label="Real hours" value={formatHours(summary.totalHours)} hint="Actual work" />
        <MetricCard label="Normal hours" value={formatHours(summary.regularHours)} hint="Up to 9h/day" />
        <MetricCard label="Overtime" value={formatHours(summary.overtimeHours)} hint="After 9h/day" tone="amber" />
        <MetricCard label="Real payroll" value={formatMoney(summary.realAmount)} hint="Expected pay" tone="green" />
        <MetricCard
          label="Invoice hours"
          value={formatHours(summary.suggestedDeclaredHours)}
          hint={overLimit ? "Suggested cap" : "Suggested real hours"}
          tone="blue"
        />
        <MetricCard
          label="Invoice rate"
          value={formatUnitPrice(summary.suggestedInvoiceRate)}
          hint="Average unit price"
          tone="blue"
        />
      </div>
    </section>
  );
}
