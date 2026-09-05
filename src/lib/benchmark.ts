export type BenchmarkResult = { seed: number; sessions: number; baselineGmvPaise: number; treatmentGmvPaise: number; baselineAovPaise: number; treatmentAovPaise: number; incrementalRevenuePaise: number; upliftPercent: number; attachRatePercent: number; budgetViolationRatePercent: number; policyViolationRatePercent: number; acceptanceRatePercent: number; checkoutCompletionProxyPercent: number };

type Archetype = { name: string; weight: number; basePaise: number; addOnPaise: number; budgets: number[]; relevance: number; compatibility: number };
const archetypes: Archetype[] = [
  { name: "sensitive-skin routine", weight: 35, basePaise: 59900, addOnPaise: 89900, budgets: [130000, 180000, 200000, 220000], relevance: 0.92, compatibility: 0.98 },
  { name: "coffee replenishment", weight: 20, basePaise: 64900, addOnPaise: 39900, budgets: [90000, 120000, 150000], relevance: 0.82, compatibility: 0.9 },
  { name: "three employee gifts", weight: 15, basePaise: 239700, addOnPaise: 9900, budgets: [250000, 280000, 300000], relevance: 0.78, compatibility: 0.86 },
  { name: "daily running setup", weight: 15, basePaise: 329900, addOnPaise: 39900, budgets: [350000, 400000, 500000], relevance: 0.87, compatibility: 0.94 },
  { name: "USB-C charging setup", weight: 15, basePaise: 159900, addOnPaise: 49900, budgets: [180000, 220000, 250000], relevance: 0.96, compatibility: 1 },
];

function selectArchetype(value: number) { let cursor = value * 100; for (const archetype of archetypes) { cursor -= archetype.weight; if (cursor < 0) return archetype; } return archetypes[0]; }
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Offline only: deterministic buyer utility simulation; never calls AI, a database, or a PSP. */
export function runBenchmark(seed = 20260219, sessions = 500): BenchmarkResult {
  let state = seed >>> 0;
  const random = () => ((state = (1664525 * state + 1013904223) >>> 0) / 4294967296);
  let baseline = 0; let treatment = 0; let eligible = 0; let attached = 0; let completed = 0; let budgetViolations = 0; let policyViolations = 0;
  for (let index = 0; index < sessions; index++) {
    const archetype = selectArchetype(random());
    const budget = archetype.budgets[Math.floor(random() * archetype.budgets.length)];
    const priceSensitivity = random();
    const preferenceMatch = 0.55 + random() * 0.45;
    const acceptanceDraw = random();
    const completionDraw = random();
    baseline += archetype.basePaise;
    const fitsBudget = archetype.basePaise + archetype.addOnPaise <= budget;
    if (fitsBudget) eligible++;
    const priceShare = archetype.addOnPaise / budget;
    const utility = archetype.relevance * 0.55 + archetype.compatibility * 0.25 + preferenceMatch * 0.2 - priceShare * 0.45 - priceSensitivity * 0.15;
    const acceptanceProbability = fitsBudget ? clamp((utility - 0.42) * 1.65, 0.04, 0.68) : 0;
    const accepted = acceptanceDraw < acceptanceProbability;
    const treatedCart = archetype.basePaise + (accepted ? archetype.addOnPaise : 0);
    if (treatedCart > budget) budgetViolations++;
    if (accepted && (!fitsBudget || archetype.compatibility < 0.7)) policyViolations++;
    treatment += treatedCart;
    if (accepted) attached++;
    const completionProbability = clamp(0.88 + (accepted ? 0.035 : 0) - Math.max(0, treatedCart / budget - 0.9) * 0.2, 0, 1);
    if (completionDraw < completionProbability) completed++;
  }
  const toPct = (value: number) => Number(value.toFixed(1));
  return { seed, sessions, baselineGmvPaise: baseline, treatmentGmvPaise: treatment, baselineAovPaise: Math.round(baseline / sessions), treatmentAovPaise: Math.round(treatment / sessions), incrementalRevenuePaise: treatment - baseline, upliftPercent: toPct((treatment / baseline - 1) * 100), attachRatePercent: toPct((attached / sessions) * 100), budgetViolationRatePercent: toPct((budgetViolations / sessions) * 100), policyViolationRatePercent: toPct((policyViolations / sessions) * 100), acceptanceRatePercent: toPct((attached / Math.max(1, eligible)) * 100), checkoutCompletionProxyPercent: toPct((completed / sessions) * 100) };
}
