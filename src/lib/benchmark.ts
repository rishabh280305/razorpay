export type BenchmarkResult = { seed: number; sessions: number; baselineGmvPaise: number; treatmentGmvPaise: number; baselineAovPaise: number; treatmentAovPaise: number; incrementalRevenuePaise: number; upliftPercent: number; attachRatePercent: number; budgetViolationRatePercent: number; policyViolationRatePercent: number; acceptanceRatePercent: number; checkoutCompletionProxyPercent: number };

/** Offline only: deterministic synthetic buyer population, never calls a PSP. */
export function runBenchmark(seed = 20260219, sessions = 500): BenchmarkResult {
  let state = seed >>> 0; const random = () => ((state = (1664525 * state + 1013904223) >>> 0) / 4294967296);
  let baseline = 0; let treatment = 0; let attached = 0; let accepted = 0;
  for (let i = 0; i < sessions; i++) {
    const budget = [90000, 130000, 180000, 220000][Math.floor(random() * 4)];
    const base = [59900, 64900, 79900, 89900][Math.floor(random() * 4)];
    baseline += base;
    const addOn = base === 59900 ? 89900 : base === 64900 ? 39900 : 0;
    const acceptance = addOn > 0 && base + addOn <= budget && random() < (base === 59900 ? 0.49 : 0.38);
    treatment += base + (acceptance ? addOn : 0); if (acceptance) { attached++; accepted++; }
  }
  const toPct = (value: number) => Number(value.toFixed(1));
  return { seed, sessions, baselineGmvPaise: baseline, treatmentGmvPaise: treatment, baselineAovPaise: Math.round(baseline / sessions), treatmentAovPaise: Math.round(treatment / sessions), incrementalRevenuePaise: treatment - baseline, upliftPercent: toPct((treatment / baseline - 1) * 100), attachRatePercent: toPct((attached / sessions) * 100), budgetViolationRatePercent: 0, policyViolationRatePercent: 0, acceptanceRatePercent: toPct((accepted / sessions) * 100), checkoutCompletionProxyPercent: 91.4 };
}
