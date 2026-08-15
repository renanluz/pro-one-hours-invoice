interface MetricCardProps {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "green" | "amber" | "blue";
}

export function MetricCard({ label, value, hint, tone = "default" }: MetricCardProps) {
  return (
    <article className={`metric-card metric-card--${tone}`}>
      <span className="metric-card__label">{label}</span>
      <strong className="metric-card__value">{value}</strong>
      {hint ? <small>{hint}</small> : null}
    </article>
  );
}
