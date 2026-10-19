/**
 * Shared formatters + pure date/status helpers for the My Inspections module.
 *
 * Everything here is side-effect free and driven by the injectable demo clock
 * (03 Oct 2026) so the Overdue dataset — and any test that asserts on it —
 * stays stable regardless of the machine's real date.
 */
import {
  DEMO_TODAY,
  type EffectiveInspectionStatus,
  type Inspection,
  type InspectionStatus,
  type Priority,
  type WorkflowStep,
} from './types';

export { fmtDate, fmtDateTime, daysUntil, pct, relTime, fmtSize } from '../contracts/format';
import { fmtDate } from '../contracts/format';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Whole days from `a` to `b` (positive when b is later). */
export function daysBetween(a: string, b: string): number {
  const da = new Date(`${a}T00:00:00Z`).getTime();
  const db = new Date(`${b}T00:00:00Z`).getTime();
  return Math.round((db - da) / 86400000);
}

export function monthKey(iso: string): string {
  return (iso || '').slice(0, 7);
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-');
  const idx = Number(m) - 1;
  return Number.isFinite(idx) && MONTHS[idx] ? `${MONTHS[idx]} ${y}` : key;
}

export function weekdayLong(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return WEEKDAYS[d.getUTCDay()] || '';
}

export function fmtTime(hhmm: string | null | undefined): string {
  if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return '—';
  const [hRaw, m] = hhmm.split(':');
  const h = Number(hRaw);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${suffix}`;
}

export function minsBetween(a: string, b: string): number {
  const toMins = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  return toMins(b) - toMins(a);
}

export function durationLabel(mins: number): string {
  if (mins <= 0) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** `14 Oct 2026 · 09:30–11:00` — the slot label used across the table and panel. */
export function slotLabel(i: Pick<Inspection, 'scheduledDate' | 'startTime' | 'endTime'>): string {
  return `${fmtDate(i.scheduledDate)} · ${fmtTime(i.startTime)}–${fmtTime(i.endTime)}`;
}

/**
 * Timestamps for records created during the demo. Uses the shared demo calendar
 * (03 Oct 2026) with the running clock's time-of-day, so a freshly created note
 * never appears to be dated weeks away from the inspection it belongs to.
 */
export function demoNow(): string {
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${DEMO_TODAY}T${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}+05:30`;
}

export function demoDate(): string {
  return DEMO_TODAY;
}

// ---------------------------------------------------------------------------
// Status derivation (single source of truth)
// ---------------------------------------------------------------------------

/**
 * Overdue is DERIVED, never stored: a base status of Completed/Cancelled can
 * never present as Overdue, and anything still open past its scheduled date does.
 */
export function effectiveStatusOf(
  i: Pick<Inspection, 'status' | 'scheduledDate'>,
  today: string = DEMO_TODAY,
): EffectiveInspectionStatus {
  if (i.status === 'Completed' || i.status === 'Cancelled') return i.status;
  if (i.scheduledDate && i.scheduledDate < today) return 'Overdue';
  return i.status;
}

export function isOverdue(
  i: Pick<Inspection, 'status' | 'scheduledDate'>,
  today: string = DEMO_TODAY,
): boolean {
  return effectiveStatusOf(i, today) === 'Overdue';
}

export function isStarted(status: InspectionStatus): boolean {
  return status === 'In Progress' || status === 'Pending Submission';
}

/** Which My Inspections tab a given record belongs to (Cancelled → All only). */
export function tabForStatus(s: EffectiveInspectionStatus): string[] {
  switch (s) {
    case 'Upcoming': return ['Upcoming'];
    case 'In Progress':
    case 'Pending Submission': return ['In Progress'];
    case 'Completed': return ['Completed'];
    case 'Overdue': return ['Overdue'];
    default: return [];
  }
}

export function stepLabel(index: number): WorkflowStep {
  const steps: WorkflowStep[] = ['Pre-Inspection', 'On-Site Verification', 'Evidence & Observations', 'Review & Submit'];
  return steps[Math.max(0, Math.min(steps.length - 1, index))];
}

// ---------------------------------------------------------------------------
// Calendar helpers (Inspection Schedule)
// ---------------------------------------------------------------------------

export interface MonthCell {
  date: string;      // yyyy-mm-dd
  day: number;
  inMonth: boolean;
}

/** 6×7 grid so a month always renders as the same number of rows. */
export function monthMatrix(year: number, monthIndex: number): MonthCell[] {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const offset = first.getUTCDay(); // 0 = Sunday
  const cells: MonthCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(Date.UTC(year, monthIndex, 1 - offset + i));
    const iso = d.toISOString().slice(0, 10);
    cells.push({ date: iso, day: d.getUTCDate(), inMonth: d.getUTCMonth() === monthIndex });
  }
  return cells;
}

export function monthOptions(count = 4): { key: string; label: string; year: number; month: number }[] {
  const [y, m] = DEMO_TODAY.split('-').map(Number);
  const out: { key: string; label: string; year: number; month: number }[] = [];
  for (let i = -1; i < count; i++) {
    const dt = new Date(Date.UTC(y, m - 1 + i, 1));
    const key = dt.toISOString().slice(0, 7);
    out.push({ key, label: monthLabel(key), year: dt.getUTCFullYear(), month: dt.getUTCMonth() });
  }
  return out;
}

/** Mon–Sun window containing the given date, for the schedule's week strip. */
export function weekOf(iso: string): { from: string; to: string; days: string[] } {
  const d = new Date(`${iso}T00:00:00Z`);
  const dow = d.getUTCDay();
  const from = addDays(iso, dow === 0 ? -6 : 1 - dow);
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  return { from, to: days[6], days };
}

// ---------------------------------------------------------------------------
// Colours (single source of truth for status/priority/response chips)
// ---------------------------------------------------------------------------

const INSPECTION_TONE: Record<string, string> = {
  Upcoming: 'bg-blue-100 text-blue-700',
  'In Progress': 'bg-sky-100 text-sky-700',
  'Pending Submission': 'bg-amber-100 text-amber-700',
  Completed: 'bg-emerald-100 text-emerald-700',
  Overdue: 'bg-red-100 text-red-600',
  Cancelled: 'bg-slate-200 text-slate-500',
  // priority
  High: 'bg-red-100 text-red-600',
  Normal: 'bg-blue-50 text-blue-700',
  Low: 'bg-slate-200 text-slate-600',
  // checklist responses
  Compliant: 'bg-emerald-100 text-emerald-700',
  'Non-Compliant': 'bg-red-100 text-red-600',
  'Not Applicable': 'bg-slate-200 text-slate-600',
  'Not Checked': 'bg-amber-100 text-amber-700',
  // findings / reports
  'Corrective Action Required': 'bg-orange-100 text-orange-700',
  'Under Review': 'bg-blue-100 text-blue-700',
  'Changes Requested': 'bg-orange-100 text-orange-700',
  'Pending Approval': 'bg-amber-100 text-amber-700',
  Approved: 'bg-emerald-100 text-emerald-700',
  Rejected: 'bg-red-100 text-red-600',
  Draft: 'bg-slate-200 text-slate-600',
  Submitted: 'bg-blue-100 text-blue-700',
  Resolved: 'bg-emerald-100 text-emerald-700',
};

/** Site Details "safety conditions" chip colours (separate from priority). */
const CONDITION_TONE: Record<string, string> = {
  Normal: 'bg-emerald-100 text-emerald-700',
  Caution: 'bg-amber-100 text-amber-700',
  Hazardous: 'bg-red-100 text-red-600',
};

export const conditionTone = (v: string): string => CONDITION_TONE[v] ?? 'bg-slate-200 text-slate-700';

export const statusTone = (v: string): string => INSPECTION_TONE[v] ?? 'bg-slate-200 text-slate-700';

export const priorityTone = (v: Priority | string): string =>
  v === 'High' ? INSPECTION_TONE.High : v === 'Low' ? INSPECTION_TONE.Low : INSPECTION_TONE.Normal;

export const responseTone = (v: string): string => statusTone(v);

/** Dot colour used by KPI tiles and chart legends. */
export const statusDot: Record<string, string> = {
  Upcoming: '#1463D9',
  'In Progress': '#0EA5E9',
  'Pending Submission': '#E8A02B',
  Completed: '#159B72',
  Overdue: '#DC4C58',
  Cancelled: '#94A3B8',
};

// ---------------------------------------------------------------------------
// Deterministic pseudo-random helpers (seed generation)
// ---------------------------------------------------------------------------

/** Stable 32-bit hash — same input always yields the same value. */
export function hashOf(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic index into an array for a given key. */
export function pickIndex(key: string, length: number): number {
  if (length <= 0) return 0;
  return hashOf(key) % length;
}

/** Deterministic item from an array for a given key. */
export function pickBy<T>(arr: readonly T[], key: string): T {
  return arr[pickIndex(key, arr.length)];
}
