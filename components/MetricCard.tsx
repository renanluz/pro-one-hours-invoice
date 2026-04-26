interface MetricCardProps {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "green" | "amber" | "blue";
}

export function MetricCard({ label, value, hint, tone = "default" }: MetricCardProps) {
  return (
    <article className={`metric-card metric-card--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <small>{hint}</small> : null}
    </article>
  );
}
