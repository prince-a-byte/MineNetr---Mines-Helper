/**
 * CSV / JSON / certificate downloads for the contractor portal.
 * Every export is a real client-side file generated from the records currently
 * in scope — never a toast-only affordance. No server is involved in demo mode.
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

/** Export rows as CSV with a UTF-8 BOM (so Excel renders ₹ correctly). */
export function exportCsv<T>(filename: string, rows: T[], columns: [string, (row: T) => unknown][]): number {
  const head = columns.map(([h]) => csvEscape(h)).join(',');
  const body = rows.map((r) => columns.map(([, get]) => csvEscape(get(r))).join(',')).join('\n');
  const csv = `﻿${head}\n${body}`;
  download(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${filename}.csv`);
  return rows.length;
}

/** Export any structure as pretty JSON (used by the export dialog's JSON option). */
export function exportJson(filename: string, data: unknown): void {
  download(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `${filename}.json`);
}

/** Plain-text download (used by the demo certificate). */
export function exportText(filename: string, text: string, mime = 'text/plain;charset=utf-8'): void {
  download(new Blob([text], { type: mime }), filename);
}

/**
 * A demo training certificate. Deliberately a plain-text document (no PDF
 * library in the project) carrying a DEMO watermark so it can never be mistaken
 * for a real statutory certificate.
 */
export function certificateText(c: {
  workerName: string; workerId: string; contractor: string; trainingType: string;
  completionDate: string; expiryDate: string; certificateNumber: string; provider: string;
}): string {
  const line = '='.repeat(72);
  const centre = (s: string, w = 72) => {
    const pad = Math.max(0, Math.floor((w - s.length) / 2));
    return ' '.repeat(pad) + s;
  };
  return [
    line,
    centre('M I N E N E T R   —   D E M O   C E R T I F I C A T E'),
    line,
    '',
    centre('*** DEMO ONLY — NOT A STATUTORY CERTIFICATE ***'),
    centre('All data below is synthetic and fictional.'),
    '',
    `  Certificate ID      : ${c.certificateNumber}`,
    `  Training Type       : ${c.trainingType}`,
    `  Worker Name         : ${c.workerName}`,
    `  Worker ID           : ${c.workerId}`,
    `  Contractor          : ${c.contractor}`,
    `  Training Provider   : ${c.provider}`,
    `  Completion Date     : ${c.completionDate}`,
    `  Expiry Date         : ${c.expiryDate}`,
    '',
    line,
    centre('Issued by the MineNetr contractor workspace (frontend demo).'),
    centre('No regulator, inspector or external system has been notified.'),
    line,
  ].join('\n');
}
