import type { ReactNode } from "react";

type StatCardProps = {
  title: string;
  value: string | number;
  caption?: string;
  icon?: ReactNode;
  tone?: "blue" | "green" | "sky" | "slate";
};

const toneClasses = {
  blue: "bg-blue-50 text-blue-700 ring-blue-100",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  sky: "bg-sky-50 text-sky-700 ring-sky-100",
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
};

export function StatCard({
  title,
  value,
  caption,
  icon,
  tone = "blue",
}: StatCardProps) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-3 text-3xl font-semibold tracking-normal text-slate-950">
            {value}
          </p>
        </div>
        {icon ? (
          <div className={`rounded-lg p-3 ring-1 ${toneClasses[tone]}`}>
            {icon}
          </div>
        ) : null}
      </div>
      {caption ? <p className="mt-4 text-sm text-slate-500">{caption}</p> : null}
    </article>
  );
}
