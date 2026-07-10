/**
 * Micro-benchmark (offline engine) — a quick, dependency-free sanity check on
 * hot-path throughput. Not a rigorous benchmark; a demo aid. Run: `npm run bench`.
 */
import { route, _resetRouteCache } from '../src/services/navigationService.js';
import { ask } from '../src/services/conciergeService.js';
import { snapshot } from '../src/services/crowdService.js';

function hrms(fn) {
  const start = process.hrtime.bigint();
  return Promise.resolve(fn()).then(() => Number(process.hrtime.bigint() - start) / 1e6);
}

async function bench(label, iterations, fn) {
  // warm-up
  await fn(0);
  const start = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) await fn(i);
  const ms = Number(process.hrtime.bigint() - start) / 1e6;
  console.log(
    `${label.padEnd(34)} ${iterations}x  ${ms.toFixed(1)} ms total  ` +
      `${(ms / iterations).toFixed(4)} ms/op  ${Math.round(iterations / (ms / 1000))} ops/s`,
  );
}

const N = 5000;

console.log(`\nStadiumIQ offline micro-benchmark (${N} iterations each)\n`);

await bench('concierge.ask', N, () => ask({ question: 'where can I recycle?' }));
await bench('crowd.snapshot', N, (i) => snapshot({ venueId: 'usa-metlife', timeBucket: `b${i}` }));

_resetRouteCache();
const cold = await hrms(() =>
  route({ venueId: 'usa-metlife', from: 'gate-a', to: 'sec-320', accessibleOnly: true }),
);
const warm = await hrms(() =>
  route({ venueId: 'usa-metlife', from: 'gate-a', to: 'sec-320', accessibleOnly: true }),
);
console.log(
  `\nroute cold ${cold.toFixed(4)} ms → warm ${warm.toFixed(4)} ms ` +
    `(cache ${(cold / Math.max(warm, 0.0001)).toFixed(1)}× faster)\n`,
);
