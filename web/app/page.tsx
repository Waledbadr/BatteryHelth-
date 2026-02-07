"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid
} from "recharts";
import SectionCard from "../components/SectionCard";
import StatCard from "../components/StatCard";
import { type BatteryPayload, computeInsights } from "../lib/analysis";

const emptyPayload: BatteryPayload = {
  system: {},
  battery: {},
  history: []
};

export default function HomePage() {
  const [payload, setPayload] = useState<BatteryPayload>(emptyPayload);
  const [fileName, setFileName] = useState<string>("Loading sample data...");
  const [loadError, setLoadError] = useState<string | null>(null);

  const applyPayload = (parsed: BatteryPayload, source: string) => {
    setPayload(parsed);
    setFileName(source);
    setLoadError(null);
  };

  useEffect(() => {
    const loadSample = async () => {
      try {
        const response = await fetch("/battery-data.json");
        if (!response.ok) {
          throw new Error("Unable to load local sample data.");
        }
        const parsed = (await response.json()) as BatteryPayload;
        applyPayload(parsed, "battery-data.json (local)");
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Failed to load local data.");
        setFileName("No data available");
      }
    };

    loadSample();
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        if (typeof reader.result !== "string") {
          throw new Error("Unsupported file format.");
        }
        const parsed = JSON.parse(reader.result) as BatteryPayload;
        applyPayload(parsed, `${file.name} (uploaded)`);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Invalid JSON file.");
      }
    };
    reader.readAsText(file);
  };

  const insights = useMemo(() => computeInsights(payload), [payload]);

  const chartData = payload.history.map((entry) => ({
    date: entry.date,
    full: entry.full_charge_capacity_mwh ?? 0,
    design: entry.design_capacity_mwh ?? 0
  }));

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Windows Battery Analytics</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Battery Health Intelligence Center</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              The dashboard reads a local JSON payload from the Windows agent to deliver offline,
              production-ready assessment of battery health, degradation, and usage patterns.
            </p>
          </div>
          <div className="rounded-2xl border border-panel-border bg-panel p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Data Source</p>
            <p className="mt-2 text-sm text-slate-200">{fileName}</p>
            <p className="mt-2 text-xs text-slate-400">
              The dashboard loads a local JSON payload automatically. Replace
              <span className="text-slate-200"> /public/battery-data.json </span>
              with your latest agent output to refresh insights.
            </p>
            <div className="mt-4">
              <label className="text-xs uppercase tracking-wide text-slate-500">
                Optional: Upload JSON
              </label>
              <input
                className="input-file mt-2 w-full text-sm text-slate-300 file:border-0 file:bg-transparent"
                type="file"
                accept="application/json"
                onChange={handleFileChange}
              />
            </div>
            {loadError ? <p className="mt-2 text-xs text-red-400">{loadError}</p> : null}
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Battery Health Score"
            value={insights.healthScore ? `${insights.healthScore}%` : "--"}
            subtitle={`Status: ${insights.status}`}
            accent
          />
          <StatCard
            title="Design vs Full Charge"
            value={
              payload.battery.design_capacity_mwh && payload.battery.full_charge_capacity_mwh
                ? `${payload.battery.full_charge_capacity_mwh.toLocaleString()} / ${payload.battery.design_capacity_mwh.toLocaleString()} mWh`
                : "--"
            }
            subtitle={
              insights.degradation !== null
                ? `Degradation: ${insights.degradation}%`
                : "Degradation: --"
            }
          />
          <StatCard
            title="Charge Cycles"
            value={payload.battery.cycle_count ?? "--"}
            subtitle={`Cycle penalty: ${insights.cyclePenalty}`}
          />
          <StatCard
            title="Remaining Useful Life"
            value={payload.health?.estimated_remaining_life ?? "--"}
            subtitle={payload.generated_at ? `Generated: ${payload.generated_at}` : ""}
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <SectionCard title="Capacity Degradation Timeline">
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 24, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="date" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{ background: "#0f172a", borderColor: "#1f2937" }} />
                  <Line type="monotone" dataKey="full" stroke="#38bdf8" strokeWidth={2} />
                  <Line type="monotone" dataKey="design" stroke="#a78bfa" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
          <SectionCard title="System & Battery Details">
            <div className="grid gap-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Device</span>
                <span>{payload.system.product ?? "--"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Battery</span>
                <span>{payload.battery.name ?? "--"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Manufacturer</span>
                <span>{payload.battery.manufacturer ?? "--"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Chemistry</span>
                <span>{payload.battery.chemistry ?? "--"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">OS Build</span>
                <span>{payload.system.os_build ?? "--"}</span>
              </div>
            </div>
          </SectionCard>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <SectionCard title="Charge Cycle Indicator">
            <p>
              Current cycle count: <span className="font-semibold text-white">{payload.battery.cycle_count ?? "--"}</span>.
              The warning threshold begins after 500 cycles to reflect accelerated wear.
            </p>
            <p>
              Cycle penalty applied: <span className="font-semibold text-white">{insights.cyclePenalty}</span> points.
            </p>
          </SectionCard>
          <SectionCard title="Usage Pattern Insights">
            {insights.usageInsights.length ? (
              <ul className="list-disc space-y-2 pl-4">
                {insights.usageInsights.map((insight) => (
                  <li key={insight}>{insight}</li>
                ))}
              </ul>
            ) : (
              <p>Replace the local JSON to unlock usage insights.</p>
            )}
          </SectionCard>
          <SectionCard title="Smart Recommendations">
            {insights.recommendations.length ? (
              <ul className="list-disc space-y-2 pl-4">
                {insights.recommendations.map((recommendation) => (
                  <li key={recommendation}>{recommendation}</li>
                ))}
              </ul>
            ) : (
              <p>Recommendations will populate after data analysis.</p>
            )}
          </SectionCard>
        </section>
      </div>
    </main>
  );
}
