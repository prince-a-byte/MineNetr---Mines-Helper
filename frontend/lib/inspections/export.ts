/**
 * Demo file exports for the My Inspections module.
 *
 * The project has no PDF library, so inspection reports, checklists and
 * attachments download as clearly-watermarked plain-text/CSV demo files. The
 * UI must label them as samples — never imply a real DGMS submission.
 *
 * Client-only helpers: they create a Blob and click a temporary anchor.
 */
import type { InspectionReport, InspectionRow } from './types';
import { DEMO_TODAY } from './types';
import { fmtDate, fmtDateTime, fmtTime } from './format';

const WATERMARK = [
  '================================================================',
  '  DEMO EXPORT — SYNTHETIC DATA — NOT AN OFFICIAL RECORD',
  '  MineNetr Mine Inspector · generated from the local demo dataset',
  `  Demo date: ${fmtDate(DEMO_TODAY)}`,
  '================================================================',
  '',
].join('\n');

function saveText(fileName: string, content: string, mime = 'text/plain;charset=utf-8') {
  if (typeof window === 'undefined') return;
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(headers: string[], rows: (string | number)[][]): string {
  return [headers.map(csvCell).join(','), ...rows.map((r) => r.map(csvCell).join(','))].join('\r\n');
}

// ---------------------------------------------------------------------------
// Inspection list exports
// ---------------------------------------------------------------------------

export function downloadInspectionsCsv(rows: InspectionRow[], fileName = `my-inspections-${DEMO_TODAY}.csv`) {
  const csv = toCsv(
    ['Inspection ID', 'Date', 'Start', 'End', 'Mine Code', 'Mine', 'Location', 'Inspection Type',
      'Priority', 'Status', 'Assigned Inspector', 'Assigned By', 'Checklist %', 'Completed Items',
      'Total Items', 'Flagged', 'Evidence', 'Findings'],
    rows.map((r) => [
      r.inspection.id, r.inspection.scheduledDate, r.inspection.startTime, r.inspection.endTime,
      r.site.code, r.site.name, r.inspection.location, r.inspection.type, r.inspection.priority,
      r.effectiveStatus, r.assignedToName, r.assignedByName, r.progress.percent,
      r.progress.completed, r.progress.totalItems, r.progress.flagged, r.evidenceCount, r.findingCount,
    ]),
  );
  saveText(fileName, `${WATERMARK}${csv}\r\n`, 'text/csv;charset=utf-8');
}

export function downloadInspectionDetail(
  row: InspectionRow,
  checklist: { sections: { name: string; rows: { item: { id: string; requirement: string; mandatory: boolean }; response: string; remarks: string }[] }[]; percent: number; completed: number; totalItems: number },
  extra: { objective: string; durationMins: number; siteType: string; state: string; district: string },
) {
  const i = row.inspection;
  const lines: string[] = [
    WATERMARK,
    `INSPECTION ${i.id}`,
    `${i.title}`,
    '',
    `Mine                : ${row.site.code} — ${row.site.name} (${row.site.area})`,
    `Location            : ${i.location}`,
    `State / District    : ${extra.state} / ${extra.district} (${extra.siteType})`,
    `Inspection type     : ${i.type}`,
    `Priority            : ${i.priority}`,
    `Status              : ${row.effectiveStatus}${row.overdue ? ' (derived from scheduled date)' : ''}`,
    `Scheduled           : ${fmtDate(i.scheduledDate)} · ${fmtTime(i.startTime)}–${fmtTime(i.endTime)} (${extra.durationMins} min)`,
    `Assigned inspector  : ${row.assignedToName}`,
    `Assigned by         : ${row.assignedByName}`,
    `Objective           : ${extra.objective}`,
    '',
    `Checklist progress  : ${row.progress.completed}/${row.progress.totalItems} answered (${row.progress.percent}%)`,
    `Flagged (non-comp.) : ${row.progress.flagged}`,
    `Evidence records    : ${row.evidenceCount}`,
    `Findings raised     : ${row.findingCount} (${row.openFindingCount} open)`,
    '',
    'CHECKLIST',
    '--------',
  ];
  for (const section of checklist.sections) {
    lines.push('', `[${section.name}]`);
    for (const r of section.rows) {
      lines.push(`  ${r.item.id}  ${r.response.padEnd(15)} ${r.item.requirement}`);
      if (r.remarks) lines.push(`                 Remarks: ${r.remarks}`);
    }
  }
  lines.push('', 'End of demo export.', '');
  saveText(`${i.id}-${row.site.code}.txt`, lines.join('\n'));
}

// ---------------------------------------------------------------------------
// Report / checklist / document exports
// ---------------------------------------------------------------------------

export function downloadReport(
  report: InspectionReport,
  ctx: { mineLabel: string; inspector: string; scheduledDate: string; type: string; title: string },
) {
  const lines = [
    WATERMARK,
    `INSPECTION REPORT ${report.id} (version ${report.version})`,
    report.title,
    '',
    `Inspection ID   : ${report.inspectionId}`,
    `Mine            : ${ctx.mineLabel}`,
    `Inspection type : ${ctx.type}`,
    `Scheduled date  : ${fmtDate(ctx.scheduledDate)}`,
    `Inspector       : ${ctx.inspector}`,
    `Submitted       : ${fmtDateTime(report.submittedAt)}`,
    `Report status   : ${report.status}`,
    '',
    'SUMMARY',
    '-------',
    report.summary,
    '',
    'COUNTS',
    '------',
    `Compliant          : ${report.counts.compliant}`,
    `Non-compliant      : ${report.counts.nonCompliant}`,
    `Not applicable     : ${report.counts.notApplicable}`,
    `Not checked        : ${report.counts.notChecked}`,
    `Evidence records   : ${report.counts.evidence}`,
    `Findings raised    : ${report.counts.findings}`,
    '',
    'This file is a synthetic demonstration export. It is NOT a DGMS submission',
    'and must not be used as a statutory record.',
    '',
  ];
  saveText(`${report.id}-${report.inspectionId}.txt`, lines.join('\n'));
}

export function downloadChecklist(
  inspectionId: string,
  mineLabel: string,
  checklist: {
    percent: number; completed: number; totalItems: number;
    sections: { name: string; rows: { item: { id: string; requirement: string; description: string; mandatory: boolean }; response: string; remarks: string; evidenceIds: string[]; updatedAt: string | null }[] }[];
  },
) {
  const lines = [
    WATERMARK,
    `CHECKLIST — ${inspectionId} (${mineLabel})`,
    `Completion: ${checklist.completed}/${checklist.totalItems} answered (${checklist.percent}%)`,
    '',
  ];
  for (const s of checklist.sections) {
    lines.push(`[${s.name}]`);
    for (const r of s.rows) {
      lines.push(`  ${r.item.id}${r.item.mandatory ? '*' : ' '} ${r.response.padEnd(15)} ${r.item.requirement}`);
      lines.push(`        ${r.item.description}`);
      if (r.remarks) lines.push(`        Remarks: ${r.remarks}`);
      if (r.evidenceIds.length) lines.push(`        Evidence: ${r.evidenceIds.join(', ')}`);
      if (r.updatedAt) lines.push(`        Last updated: ${fmtDateTime(r.updatedAt)}`);
    }
    lines.push('');
  }
  lines.push('(* = mandatory item)', 'End of demo export.', '');
  saveText(`${inspectionId}-checklist.txt`, lines.join('\n'));
}

export function downloadDocument(title: string, fileName: string, body: string) {
  saveText(fileName.replace(/\.[a-z0-9]+$/i, '') + '.txt',
    `${WATERMARK}SAMPLE DOCUMENT: ${title}\nOriginal reference: ${fileName}\n\n${body}\n`);
}

/** Checklists & Forms page — downloads a blank template (no answers). */
export function downloadTemplate(
  template: { id: string; name: string; category: string; description: string; version: string; sectionNames: string[] },
  items: { id: string; section: string; requirement: string; description: string; mandatory: boolean; evidenceRequired: boolean }[],
) {
  const lines = [
    WATERMARK,
    `CHECKLIST TEMPLATE ${template.id} (${template.version})`,
    template.name,
    `Category : ${template.category}`,
    `Sections : ${template.sectionNames.join(' · ')}`,
    `Items    : ${items.length}`,
    '',
    template.description,
    '',
    'BLANK CHECKLIST — mark one response per item:',
    '  [ ] Compliant   [ ] Non-Compliant   [ ] Not Applicable   [ ] Not Checked',
    '',
  ];
  for (const section of template.sectionNames) {
    lines.push(`[${section}]`);
    for (const item of items.filter((i) => i.section === section)) {
      lines.push(`  ${item.id}${item.mandatory ? '*' : ' '} ${item.requirement}`);
      lines.push(`        ${item.description}`);
      if (item.evidenceRequired) lines.push('        Evidence required for a non-compliant answer.');
      lines.push('        Response: ______________  Remarks: ______________________________');
      lines.push('');
    }
  }
  lines.push('(* = mandatory item)', 'This is a synthetic DEMO form — not a statutory register.', '');
  saveText(`${template.id}-${template.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.txt`, lines.join('\n'));
}

export function downloadEvidenceSheet(
  inspectionId: string,
  evidence: { id: string; type: string; title: string; description: string; fileName: string; capturedAt: string; location: string; uploadedBy: string }[],
) {
  const csv = toCsv(
    ['Evidence ID', 'Inspection', 'Type', 'Title', 'Description', 'File', 'Captured At', 'Location', 'Uploaded By'],
    evidence.map((e) => [e.id, inspectionId, e.type, e.title, e.description, e.fileName, e.capturedAt, e.location, e.uploadedBy]),
  );
  saveText(`${inspectionId}-evidence.csv`, `${WATERMARK}${csv}\r\n`, 'text/csv;charset=utf-8');
}

export function downloadFindingsCsv(
  rows: { id: string; inspectionId: string; mineId: string; category: string; severity: string; status: string; location: string; description: string; assignee: string; detectedAt: string; dueDate: string }[],
  fileName = `findings-${DEMO_TODAY}.csv`,
) {
  const csv = toCsv(
    ['Finding ID', 'Inspection', 'Mine', 'Category', 'Severity', 'Status', 'Location', 'Description', 'Recommendation/Assignee', 'Detected', 'Due'],
    rows.map((f) => [f.id, f.inspectionId, f.mineId, f.category, f.severity, f.status, f.location, f.description, f.assignee, f.detectedAt, f.dueDate]),
  );
  saveText(fileName, `${WATERMARK}${csv}\r\n`, 'text/csv;charset=utf-8');
}

/** Plain-text "schedule" export used by the Inspection Schedule page. */
export function downloadScheduleCsv(
  entries: { date: string; inspection: { id: string; type: string; priority: string; startTime: string; endTime: string; location: string }; effectiveStatus: string; site: { code: string; name: string }; inspectorName: string }[],
  fileName = `inspection-schedule-${DEMO_TODAY}.csv`,
) {
  const csv = toCsv(
    ['Date', 'Inspection ID', 'Time', 'Mine', 'Location', 'Inspection Type', 'Priority', 'Status', 'Inspector'],
    entries.map((e) => [
      e.date, e.inspection.id, `${e.inspection.startTime}-${e.inspection.endTime}`,
      `${e.site.code} ${e.site.name}`, e.inspection.location, e.inspection.type,
      e.inspection.priority, e.effectiveStatus, e.inspectorName,
    ]),
  );
  saveText(fileName, `${WATERMARK}${csv}\r\n`, 'text/csv;charset=utf-8');
}
