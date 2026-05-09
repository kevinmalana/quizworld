type MetricCardProps = {
  label: string;
  value: string | number;
  tone?: string;
};

export function MetricCard({ label, value, tone = "var(--accent)" }: MetricCardProps) {
  return (
    <div className="card metric-card">
      <div className="metric-card-label">{label}</div>
      <div className="font-display metric-card-value" style={{ color: tone }}>{value}</div>
    </div>
  );
}
