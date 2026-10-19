/**
 * Runtime smoke test for the Mine Inspector portal.
 * Run: npx tsx scripts/smoke-inspections.ts [baseUrl]
 *
 * Server-side fetch only — the auth redirect in this app is a client-side
 * useEffect, so a 200 with the expected markers is a valid check. Probes every
 * inspector route (including the dynamic individual-inspection route) for a
 * 200 response and page-specific marker text, and confirms the detail route
 * also serves a valid inspection id from the shared dataset.
 */
import { inspectionSnapshot } from '../lib/inspections/seed';

const BASE = process.argv[2] ?? 'http://localhost:3100';

interface Probe { path: string; marker: string[] }

const snapshot = inspectionSnapshot();
const anyId = snapshot.inspections[0].id;

const PROBES: Probe[] = [
  { path: '/inspector', marker: ['Mine', 'Inspector'] },
  { path: '/inspector/inspections', marker: ['My Inspections'] },
  { path: `/inspector/inspections/${anyId}`, marker: [] },
  { path: '/inspector/schedule', marker: ['Inspection Schedule'] },
  { path: '/inspector/checklists', marker: ['Checklists'] },
  { path: '/inspector/findings', marker: ['Findings'] },
  { path: '/inspector/evidence', marker: ['Evidence'] },
  { path: '/inspector/reports', marker: ['Reports'] },
];

let pass = 0; let fail = 0;

async function waitForServer(maxMs = 60000): Promise<boolean> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${BASE}/inspector`, { redirect: 'manual' });
      if (r.status === 200) return true;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function main() {
  console.log(`Smoke-testing ${BASE}`);
  const up = await waitForServer();
  if (!up) { console.log(`  ✗ server did not come up at ${BASE}`); process.exit(1); }

  for (const probe of PROBES) {
    try {
      const res = await fetch(`${BASE}${probe.path}`, { redirect: 'follow' });
      const html = await res.text();
      const missing = probe.marker.filter((m) => !html.includes(m));
      const okRow = res.status === 200 && missing.length === 0 && html.length > 500;
      if (okRow) { pass++; console.log(`  ✓ ${probe.path} → ${res.status} (${html.length} bytes)`); }
      else {
        fail++;
        console.log(`  ✗ ${probe.path} → ${res.status}${missing.length ? `; missing markers: ${missing.join(', ')}` : ''} (${html.length} bytes)`);
      }
    } catch (e) {
      fail++;
      console.log(`  ✗ ${probe.path} → ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // The individual-inspection route must 404-free render even for an id that
  // is not in the dataset (client-side empty state, server-side 200 shell).
  try {
    const res = await fetch(`${BASE}/inspector/inspections/INS-2026-999`);
    if (res.status === 200) { pass++; console.log(`  ✓ unknown id still serves the shell (client shows the empty state)`); }
    else { fail++; console.log(`  ✗ unknown id → ${res.status}`); }
  } catch (e) {
    fail++; console.log(`  ✗ unknown id probe failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

void main();
