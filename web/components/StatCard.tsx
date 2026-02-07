import type { ReactNode } from "react";

export default function StatCard({
  title,
  value,
  subtitle,
  accent
}: {
  title: string;
  value: ReactNode;
  subtitle?: ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-panel-border bg-panel p-5 shadow-lg ${
        accent ? "ring-1 ring-accent/40" : ""
      }`}
    >
      <p className="text-sm uppercase tracking-wide text-slate-400">{title}</p>
      <div className="mt-2 text-3xl font-semibold text-slate-50">{value}</div>
      {subtitle ? <div className="mt-2 text-sm text-slate-400">{subtitle}</div> : null}
    </div>
  );
}
