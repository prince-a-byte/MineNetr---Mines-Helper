/**
 * Shared formatters for the contractor "My Contracts" portal.
 * Currency is shown in the Indian Crore/Lakh convention used by the reference.
 * All dates are derived from the fixed demo clock — never implied as live.
 */
import { DEMO_TODAY } from './types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** ₹ value → "₹ 12.50 Crore" / "₹ 42.00 Lakh" (matches the reference cards). */
export function inr(value: number): string {
  if (value >= 1e7) return `₹ ${(value / 1e7).toFixed(2)} Crore`;
  if (value >= 1e5) return `₹ ${(value / 1e5).toFixed(2)} Lakh`;
  return `₹ ${Math.round(value).toLocaleString('en-IN')}`;
}

/** Center-of-donut style "₹ 34.85" (Crore figure only, no suffix). */
export function inrCroreFigure(value: number): string {
  return `₹ ${(value / 1e7).toFixed(2)}`;
}

/** '2026-10-15' → '15 Oct 2026' */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(`${iso.slice(0, 10)}T00:00:00+05:30`);
  if (Number.isNaN(d.getTime())) return iso;
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Full timestamp → '15 Oct 2026 · 3:20 PM' */
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${fmtDate(iso)} · ${time}`;
}

/** Days from the fixed demo clock to a date (negative = past). */
export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(`${iso.slice(0, 10)}T00:00:00+05:30`).getTime();
  const now = new Date(`${DEMO_TODAY}T00:00:00+05:30`).getTime();
  return Math.round((d - now) / 86_400_000);
}

/** "Due in 12 days" / "Overdue by 3 days" / "Due today" label for milestones. */
export function dueLabel(iso: string): string {
  const d = daysUntil(iso);
  if (d === null) return '—';
  if (d < 0) return `Overdue by ${Math.abs(d)} day${Math.abs(d) === 1 ? '' : 's'}`;
  if (d === 0) return 'Due today';
  return `Due in ${d} day${d === 1 ? '' : 's'}`;
}

/** Tone for the due label (used by the milestone chips). */
export function dueTone(iso: string): string {
  const d = daysUntil(iso);
  if (d === null) return 'bg-slate-100 text-slate-600';
  if (d < 0) return 'bg-red-100 text-red-600';
  if (d <= 14) return 'bg-amber-100 text-amber-700';
  return 'bg-slate-100 text-slate-600';
}

export const pct = (n: number): string => `${Math.round(n)}%`;

/** Short relative label for activity/notification timestamps. */
export function relTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = new Date(`${DEMO_TODAY}T11:20:00+05:30`).getTime();
  const mins = Math.round((now - then) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  return `${months}mo ago`;
}

export const fmtSize = (kb: number): string => (kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`);
