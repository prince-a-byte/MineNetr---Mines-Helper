/**
 * Shared formatters for the Operations portal. Display preferences from
 * settings are applied where practical; values are always demo data.
 */
import { DEMO_TODAY, type DisplayPrefs } from './types';

export const inr = (n: number): string => `₹ ${Math.round(n).toLocaleString('en-IN')}`;
export const inrShort = (n: number): string => {
  if (n >= 1e7) return `₹ ${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹ ${(n / 1e5).toFixed(2)} L`;
  return inr(n);
};
export const mt = (n: number): string => `${n.toLocaleString('en-IN')} MT`;
export const num = (n: number): string => n.toLocaleString('en-IN');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** '2026-10-03' → '03 Oct 2026' (or the user's preferred format). */
export function fmtDate(iso: string | null | undefined, prefs?: DisplayPrefs): string {
  if (!iso) return '—';
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00+05:30` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const mon = MONTHS[d.getMonth()];
  const yyyy = d.getFullYear();
  const fmt = prefs?.dateFormat;
  if (fmt?.includes('YYYY-MM-DD')) return `${yyyy}-${mm}-${dd}`;
  if (fmt?.includes('MM/DD')) return `${mm}/${dd}/${yyyy}`;
  return `${dd} ${mon} ${yyyy}`;
}

export function fmtDateTime(iso: string | null | undefined, prefs?: DisplayPrefs): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const time = prefs?.timeFormat?.includes('24')
    ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    : d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${fmtDate(iso, prefs)} · ${time}`;
}

export function fmtTime12(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

/** Relative label from the fixed demo clock (never implies live data). */
export function relTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = new Date(DEMO_TODAY + 'T10:45:32+05:30').getTime();
  const mins = Math.round((now - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return days === 1 ? 'yesterday' : `${days}d ago`;
}

export function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(`${iso.slice(0, 10)}T00:00:00+05:30`).getTime();
  const now = new Date(`${DEMO_TODAY}T00:00:00+05:30`).getTime();
  return Math.round((d - now) / 86400000);
}

export function pct(a: number, b: number): number {
  if (!b) return 0;
  return Math.round((a / b) * 100);
}

export const trendArrow = (v: number) => (v >= 0 ? '▲' : '▼');
export const trendClass = (v: number) => (v >= 0 ? 'text-green-600' : 'text-red-500');
