/**
 * Client-side CSV export + JSON backup/restore for demo data.
 * Exports always reflect the CURRENT filters (callers pass filtered rows).
 */

/** Download currently-filtered rows as CSV with a consistent filename. */
export function exportCSV(filename: string, columns: string[], rows: (string | number)[][]): void {
  const esc = (v: string | number) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [columns.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Download any JSON-serializable payload (report file, full backup). */
export function downloadJSON(filename: string, payload: unknown): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.json') ? filename : `${filename}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Validate a backup file before restore: must contain the store's top-level collections. */
export function validateBackup(data: unknown): { ok: boolean; error?: string } {
  if (!data || typeof data !== 'object') return { ok: false, error: 'Not a JSON object.' };
  const required = ['mines', 'inspections', 'findings', 'notifications', 'audit', 'settings', 'seq'];
  const d = data as Record<string, unknown>;
  for (const k of required) {
    if (!(k in d)) return { ok: false, error: `Missing collection: ${k}.` };
  }
  if (!Array.isArray(d.mines) || !Array.isArray(d.findings)) {
    return { ok: false, error: 'Collections mines/findings must be arrays.' };
  }
  return { ok: true };
}
