type ScoreProgressCardProps = {
  title: string;
  value: number;
  caption: string;
  barColor?: string;
};

export function ScoreProgressCard({
  title,
  value,
  caption,
  barColor = "bg-sky-500",
}: ScoreProgressCardProps) {
  const safeValue = Math.min(100, Math.max(0, value));

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">
            {safeValue.toFixed(safeValue % 1 === 0 ? 0 : 1)}%
          </p>
        </div>
      </div>
      <div className="mt-5 h-3 overflow-hidden rounded-lg bg-slate-100">
        <div
          className={`h-full rounded-lg transition-all ${barColor}`}
          style={{ width: `${safeValue}%` }}
        />
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-500">{caption}</p>
    </article>
  );
}
