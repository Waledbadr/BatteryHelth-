import type { ReactNode } from "react";

export default function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-panel-border bg-panel p-6">
      <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
      <div className="mt-4 space-y-3 text-sm text-slate-300">{children}</div>
    </section>
  );
}
