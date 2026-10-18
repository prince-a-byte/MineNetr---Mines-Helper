'use client';
/**
 * Shared client hooks for the Operations pages:
 * - usePageReady(): real first-paint loading state (skeletons on initial
 *   mount only — no artificial delays).
 * - useTab(): tab state with optional deep-link preset (?tab=...).
 * - useMineFilter(): current mine scope from the central store.
 * - CHART palette matching the reference design.
 */
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMockOps } from '../../lib/ops/store';

export function usePageReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);
  return ready;
}

export function useTab(defaultTab: string, paramKey = 'tab'): [string, (t: string) => void] {
  const sp = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const initial = sp?.get(paramKey) || defaultTab;
  const [tab, setTabState] = useState(initial);
  function setTab(t: string) {
    setTabState(t);
    const qs = sp?.toString() ?? '';
    const params = new URLSearchParams(qs);
    params.set(paramKey, t);
    router.replace(`${path}?${params.toString()}`, { scroll: false });
  }
  useEffect(() => { setTabState(initial); }, [initial]);
  return [tab, setTab];
}

/** Current mine scope ('ALL' | id) — every page derives data from this. */
export function useMineScope(): string {
  const db = useMockOps();
  return db.selectedMineId;
}

export const CHART = {
  blue: '#1463D9', green: '#159B72', amber: '#E8A02B', red: '#DC4C58',
  purple: '#7C5CFC', cyan: '#0EA5E9', slate: '#64748B', navy: '#0B3154',
  lightBlue: '#93C5FD', orange: '#F59E0B', pink: '#EC4899',
};
export const AXIS = { stroke: '#94a3b8', fontSize: 11 };
export const TOOLTIP_STYLE = { borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12, boxShadow: '0 4px 14px rgba(15,23,42,0.08)' };

/** Filter rows by selected mine ('ALL' passes everything). */
export function byMine<T extends { mineId: string }>(rows: T[], mineId: string): T[] {
  return mineId === 'ALL' ? rows : rows.filter((r) => r.mineId === mineId);
}

/** Deterministic CSV builder for report generation + table exports. */
export function buildCsv(headers: string[], rows: (string | number)[][]): string {
  const esc = (v: string | number) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  return [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
}

/** ISO date (yyyy-mm-dd) for today's demo clock. */
export const TODAY = '2026-10-03';

/** Group-by helper used by charts across pages. */
export function groupSum<T>(rows: T[], keyFn: (r: T) => string, valFn: (r: T) => number): { name: string; value: number }[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = keyFn(r);
    m.set(k, (m.get(k) ?? 0) + valFn(r));
  }
  return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

/** Last N days (inclusive) ending at TODAY, as yyyy-mm-dd strings. */
export function lastDays(n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date('2026-10-03T00:00:00+05:30');
    d.setDate(d.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export function fmtDayShort(iso: string): string {
  const d = new Date(`${iso}T00:00:00+05:30`);
  return `${String(d.getDate()).padStart(2, '0')} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]}`;
}

/** Deep-link helper: navigate to a page with a preset tab. */
export function hrefWithTab(href: string, tab: string): string {
  return `${href}?tab=${encodeURIComponent(tab)}`;
}

/** Reads ?focus= style presets used by "View" actions across pages. */
export function usePreset(key: string): string | null {
  const sp = useSearchParams();
  return sp?.get(key) ?? null;
}

export function useDeferred<T>(value: T, ms = 150): T {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}
