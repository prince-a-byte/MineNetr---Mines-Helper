/**
 * CSV download helper for the contractor portal.
 * Downloads are client-side exports of the records currently in scope —
 * no server involved, and the caller decides which rows to pass.
 */

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Export rows as CSV. `columns` = [header, value-getter] pairs. */
export function exportCsv<T>(
  filename: string,
  rows: T[],
  columns: [string, (row: T) => unknown][],
): number {
  const head = columns.map(([h]) => csvEscape(h)).join(',');
  const body = rows.map((r) => columns.map(([, get]) => csvEscape(get(r))).join(',')).join('\n');
  const csv = `﻿${head}\n${body}`; // BOM so Excel opens UTF-8 correctly
  download(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${filename}.csv`);
  return rows.length;
}

/** Export any structure as pretty JSON (used by the export dialog's JSON option). */
export function exportJson(filename: string, data: unknown): void {
  download(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `${filename}.json`);
}
