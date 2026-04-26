interface MetricCardProps {
  label: string;
  value: string;
  detail?: string;
  tone?: "neutral" | "positive" | "negative";
}

export default function MetricCard({
  label,
  value,
  detail,
  tone = "neutral"
}: MetricCardProps) {
  const toneClass =
    tone === "positive"
      ? "text-positive"
      : tone === "negative"
        ? "text-negative"
        : "text-ink";

  return (
    <div className="surface-panel-soft rounded-[24px] p-5">
      <p className="section-title text-mist">{label}</p>
      <p className={`headline mt-4 text-3xl leading-none ${toneClass}`}>{value}</p>
      {detail ? <p className="mt-3 text-sm text-mist">{detail}</p> : null}
    </div>
  );
}
