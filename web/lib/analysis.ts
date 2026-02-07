export type BatteryPayload = {
  system: {
    product?: string | null;
    bios?: string | null;
    os_build?: string | null;
    report_time?: string | null;
  };
  battery: {
    name?: string | null;
    manufacturer?: string | null;
    chemistry?: string | null;
    design_capacity_mwh?: number | null;
    full_charge_capacity_mwh?: number | null;
    cycle_count?: number | null;
  };
  health?: {
    health_percentage?: number | null;
    degradation_percentage?: number | null;
    cycle_penalty?: number | null;
    estimated_remaining_life?: string | null;
  };
  history: Array<{
    date: string;
    full_charge_capacity_mwh?: number | null;
    design_capacity_mwh?: number | null;
  }>;
  generated_at?: string;
};

export type DerivedInsights = {
  healthScore: number | null;
  status: "Healthy" | "Warning" | "Critical" | "Unknown";
  degradation: number | null;
  cyclePenalty: number;
  rapidDrainDetected: boolean;
  recommendations: string[];
  usageInsights: string[];
};

export function computeInsights(payload: BatteryPayload): DerivedInsights {
  const design = payload.battery.design_capacity_mwh ?? null;
  const full = payload.battery.full_charge_capacity_mwh ?? null;
  const cycleCount = payload.battery.cycle_count ?? 0;

  const healthScore = design && full ? Number(((full / design) * 100).toFixed(2)) : null;
  const degradation = healthScore !== null ? Number((100 - healthScore).toFixed(2)) : null;

  let status: DerivedInsights["status"] = "Unknown";
  if (healthScore !== null) {
    if (healthScore < 60) {
      status = "Critical";
    } else if (healthScore < 70) {
      status = "Warning";
    } else {
      status = "Healthy";
    }
  }

  const cyclePenalty = cycleCount > 500 ? Math.min(15, Math.floor((cycleCount - 500) / 50)) : 0;

  const recentHistory = [...payload.history].slice(-3);
  let rapidDrainDetected = false;
  if (recentHistory.length >= 2) {
    const drops = recentHistory
      .map((entry) => entry.full_charge_capacity_mwh ?? null)
      .filter((value): value is number => value !== null);
    if (drops.length >= 2) {
      const lastDrop = drops[drops.length - 2] - drops[drops.length - 1];
      rapidDrainDetected = lastDrop > 1200;
    }
  }

  const recommendations: string[] = [];
  if (status === "Critical") {
    recommendations.push("Plan for battery replacement within the next 3-6 months.");
  } else if (status === "Warning") {
    recommendations.push("Calibrate the battery monthly and avoid deep discharges.");
  } else if (status === "Healthy") {
    recommendations.push("Keep optimized charging enabled to slow aging.");
  }

  if (cycleCount > 500) {
    recommendations.push("High cycle count detected. Reduce full 100% charge time.");
  }
  if (rapidDrainDetected) {
    recommendations.push("Recent rapid drain detected. Audit background apps.");
  }

  const usageInsights: string[] = [];
  if (rapidDrainDetected) {
    usageInsights.push("Capacity drop between recent reports exceeds 1.2 Wh.");
  }
  if (cycleCount > 500) {
    usageInsights.push("Cycle-heavy usage profile (500+ cycles). Expect faster aging.");
  }
  if (healthScore !== null && healthScore >= 85) {
    usageInsights.push("Battery retains strong capacity relative to design specs.");
  }

  return {
    healthScore,
    status,
    degradation,
    cyclePenalty,
    rapidDrainDetected,
    recommendations,
    usageInsights
  };
}
