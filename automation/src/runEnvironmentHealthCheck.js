import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';
import { runEnvironmentHealthCheck } from './checks/environmentHealth.js';

const report = await runEnvironmentHealthCheck(config);

for (const result of report.results) {
  const icon = result.ok ? '✅' : '❌';
  const detail = result.error ?? `HTTP ${result.status}`;
  console.log(`${icon} ${result.name} — ${detail} (${result.durationMs}ms)`);
}

const reportsDir = path.resolve(import.meta.dirname, '..', 'reports');
await mkdir(reportsDir, { recursive: true });
const reportPath = path.join(reportsDir, `env-health-${Date.now()}.json`);
await writeFile(reportPath, JSON.stringify(report, null, 2));
console.log(`\nReporte guardado en ${reportPath}`);

process.exit(report.allOk ? 0 : 1);
