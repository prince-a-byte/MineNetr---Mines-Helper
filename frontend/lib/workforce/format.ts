/**
 * Shared formatters for the contractor workforce portal.
 * Generic date/INR helpers are re-exported from the contracts module so both
 * contractor features render identical values for identical data.
 */
import { DEMO_TODAY, EXPIRY_WINDOW_DAYS, type TrainingRecord } from './types';

export {
  inr, inrCroreFigure, fmtDate, fmtDateTime, daysUntil, dueLabel, dueTone, pct, relTime, fmtSize,
} from '../contracts/format';
import { daysUntil } from '../contracts/format';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Certification status is DERIVED, never stored: an expiry date in the past can
 * never present as Valid, and a record that has not been verified is surfaced as
 * Pending Verification regardless of its dates.
 */
export function trainingStatusOf(r: Pick<TrainingRecord, 'expiryDate' | 'verified'>): string {
  const d = daysUntil(r.expiryDate);
  if (d === null) return 'Expired';
  if (!r.verified) return 'Pending Verification';
  if (d < 0) return 'Expired';
  if (d <= EXPIRY_WINDOW_DAYS) return 'Expiring Soon';
  return 'Valid';
}

/** Uniform status → tailwind class map (single source of truth for colours). */
export const TONE: Record<string, string> = {
  // generic
  Valid: 'bg-emerald-100 text-emerald-700',
  'Expiring Soon': 'bg-amber-100 text-amber-700',
  Expired: 'bg-red-100 text-red-600',
  'Pending Verification': 'bg-slate-200 text-slate-700',
  // workers
  Active: 'bg-emerald-100 text-emerald-700',
  Inactive: 'bg-slate-200 text-slate-600',
  Blocked: 'bg-red-100 text-red-600',
  Suspended: 'bg-red-100 text-red-600',
  Completed: 'bg-emerald-100 text-emerald-700',
  Pending: 'bg-amber-100 text-amber-700',
  // attendance
  Present: 'bg-emerald-100 text-emerald-700',
  Absent: 'bg-red-100 text-red-600',
  'On Leave': 'bg-sky-100 text-sky-700',
  'Not Marked': 'bg-slate-200 text-slate-600',
  // access
  Allowed: 'bg-emerald-100 text-emerald-700',
  Denied: 'bg-amber-100 text-amber-700',
  Revoked: 'bg-red-100 text-red-600',
  // bills
  Approved: 'bg-emerald-100 text-emerald-700',
  Rejected: 'bg-red-100 text-red-600',
  Received: 'bg-emerald-100 text-emerald-700',
  // incidents
  Open: 'bg-red-100 text-red-600',
  'Under Review': 'bg-amber-100 text-amber-700',
  'Action Required': 'bg-orange-100 text-orange-700',
  Dismissed: 'bg-slate-200 text-slate-600',
  // severity
  Low: 'bg-slate-200 text-slate-700',
  Medium: 'bg-sky-100 text-sky-700',
  High: 'bg-amber-100 text-amber-700',
  Critical: 'bg-red-100 text-red-600',
  // misc
  Ready: 'bg-emerald-100 text-emerald-700',
  Generating: 'bg-amber-100 text-amber-700',
  Archived: 'bg-slate-200 text-slate-600',
  Issued: 'bg-sky-100 text-sky-700',
  Used: 'bg-emerald-100 text-emerald-700',
  Revoked2: 'bg-red-100 text-red-600',
  'In Progress': 'bg-sky-100 text-sky-700',
  'Not Started': 'bg-slate-200 text-slate-600',
  Submitted: 'bg-amber-100 text-amber-700',
  'Action Required2': 'bg-orange-100 text-orange-700',
  'Action Required ': 'bg-orange-100 text-orange-700',
};

export const tone = (v: string): string => TONE[v] ?? 'bg-slate-200 text-slate-700';

/** Deterministic accent index (0-5) for worker avatars — stable per worker id. */
export function avatarIndex(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 6;
}

export const AVATAR_BG = ['bg-blue-600', 'bg-emerald-600', 'bg-violet-600', 'bg-amber-600', 'bg-rose-600', 'bg-cyan-600'];

/** '9876543210' → '+91 98765 43210' */
export function fmtPhone(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (d.length !== 10) return raw;
  return `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
}

/** '06:45' + '08:00' → '1h 15m' (worked duration) — '—' when incomplete. */
export function workedLabel(inTime: string, outTime: string): string {
  if (!inTime || !outTime || inTime === '—' || outTime === '—') return '—';
  const [ih, im] = inTime.split(':').map(Number);
  const [oh, om] = outTime.split(':').map(Number);
  if (!Number.isFinite(ih) || !Number.isFinite(oh)) return '—';
  const mins = (oh * 60 + om) - (ih * 60 + im);
  if (mins <= 0) return '—';
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

/** '2026-10-03' → 'Fri' (short weekday). */
export function weekdayShort(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00+05:30`);
  if (Number.isNaN(d.getTime())) return '';
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
}

/** ISO date offset by n days from the demo clock (or an ISO anchor). */
export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00+05:30`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Last n demo dates ending today (inclusive), oldest first. */
export function lastNDates(n: number): string[] {
  return Array.from({ length: n }, (_, i) => addDays(DEMO_TODAY, i - (n - 1)));
}

/** '15 Sep 2026 – 30 Sep 2026' style period label for a date range. */
export function periodLabel(from: string, to: string): string {
  const f = new Date(`${from}T00:00:00+05:30`);
  const t = new Date(`${to}T00:00:00+05:30`);
  if (Number.isNaN(f.getTime()) || Number.isNaN(t.getTime())) return `${from} – ${to}`;
  const short = (d: Date) => `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  return `${short(f)} – ${short(t)}`;
}
