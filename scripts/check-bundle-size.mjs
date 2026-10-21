// Fails when the gzipped JS bundle exceeds the v2 budget (SC-009: v1 baseline 172.0 kB + 25%).
import { readdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const BUDGET_KB = 215;
const dir = 'dist/assets';

let files;
try {
  files = readdirSync(dir).filter((f) => f.endsWith('.js'));
} catch {
  console.error(`No ${dir} — run "npm run build" first.`);
  process.exit(2);
}

let total = 0;
for (const f of files) {
  const kb = gzipSync(readFileSync(join(dir, f))).length / 1000;
  total += kb;
  console.log(`${f}: ${kb.toFixed(1)} kB gzip`);
}
console.log(`Total JS: ${total.toFixed(1)} kB gzip (budget ${BUDGET_KB} kB)`);
if (total > BUDGET_KB) {
  console.error('Bundle is over budget.');
  process.exit(1);
}
