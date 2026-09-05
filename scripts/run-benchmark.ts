import { writeFileSync } from "node:fs";
import { runBenchmark } from "../src/lib/benchmark";
const result = runBenchmark();
writeFileSync("evaluation/results.json", `${JSON.stringify({ ...result, status: "offline synthetic evaluation", notes: "Same fixed buyer population and seed are used for baseline and Karatsuba treatment." }, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
