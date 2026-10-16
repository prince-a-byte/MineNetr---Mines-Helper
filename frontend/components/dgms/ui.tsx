/**
 * Shared DGMS UI primitives. Every page uses these — one visual language,
 * one behavior contract (filters apply/reset, tables sort/paginate/export).
 */
'use client';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useMockDb } from '../../lib/dgms/mockDb';
import InlineLoader from '../ui/InlineLoader';

// ---------- KPI card ----------
export function KpiCard({ icon, label, value, sub, tone = 'text-green-600' }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; tone?: string;
}) {
  return (
    <div className="card !p-4 flex gap-3 items-start">
      <div className="kpi-icon bg-blue-50 text-blue-600">{icon}</div>
      <div className="min-w-0">
        <div className="text-[12px] font-semibold text-slate-600">{label}</div>
        <div className="text-2xl font-extrabold text-navy">{value} {sub && <span className={`text-xs font-bold ${tone}`}>{sub}</span>}</div>
      </div>
    </div>
  );
}

// ---------- Section card ----------
export function SectionCard({ title, action, children, className = '' }: {
  title: string; action?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`card ${className}`}>
      <div className="font-extrabold text-navy mb-2 flex items-center gap-2">
        <span className="flex-1">{title}</span>{action}
      </div>
      {children}
    </div>
  );
}

// ---------- Filter bar ----------
export interface FilterDef {
  key: string;
  label: string;
  options: readonly string[] | string[];
  width?: string;
}

export function FilterBar({ defs, values, onChange, onApply, onReset }: {
  defs: FilterDef[];
  values: Record<string, string>;
  onChange: (key: string, v: string) => void;
  onApply: () => void;
  onReset: () => void;
}) {
  return (
    <div className="flex gap-2 flex-wrap items-end">
      {defs.map((d) => (
        <label key={d.key} className="block">
          <span className="block text-[11px] font-semibold text-slate-500 mb-1">{d.label}</span>
          <select
            className={`input ${d.width || '!w-44'}`}
            value={values[d.key] ?? ''}
            onChange={(e) => onChange(d.key, e.target.value)}
          >
            {d.options.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
      ))}
      <div className="flex gap-2 pb-[1px]">
        <button className="btn-primary !py-2" onClick={onApply}>Apply</button>
        <button className="btn-primary !py-2 !bg-white !text-blue-700 border border-blue-600" onClick={onReset}>Reset</button>
      </div>
    </div>
  );
}

// ---------- Search input ----------
export function SearchInput({ value, onChange, onSearch, ph, width = '!w-80' }: {
  value: string; onChange: (v: string) => void; onSearch: () => void; ph: string; width?: string;
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      <input
        className={`input ${width}`} placeholder={ph} value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onSearch()}
      />
      <button className="btn-primary" onClick={onSearch}>Search</button>
    </div>
  );
}

// ---------- Data table ----------
export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  sortValue?: (row: T) => string | number;
}

export function DataTable<T extends { id: string }>({ columns, rows, pageSizeOptions = [10, 20, 50], onRowClick, selectable, onSelect, emptyText = 'No records match the current filters.' }: {
  columns: Column<T>[];
  rows: T[];
  pageSizeOptions?: number[];
  onRowClick?: (row: T) => void;
  selectable?: boolean;
  onSelect?: (ids: string[]) => void;
  emptyText?: string;
}) {
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(pageSizeOptions[0]);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [dir, setDir] = useState<1 | -1>(1);
  const [sel, setSel] = useState<Set<string>>(new Set());

  useEffect(() => { setPage(1); setSel(new Set()); onSelect?.([]); }, [rows.length, size]);

  const sorted = [...rows].sort((a, b) => {
    if (!sortKey) return 0;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return 0;
    const va = col.sortValue(a); const vb = col.sortValue(b);
    return (va < vb ? -1 : va > vb ? 1 : 0) * dir;
  });
  const total = sorted.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const cur = Math.min(page, pages);
  const view = sorted.slice((cur - 1) * size, cur * size);

  function toggle(id: string) {
    const next = new Set(sel);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSel(next);
    onSelect?.([...next]);
  }
  function toggleAll() {
    const next = view.length > 0 && view.every((r) => sel.has(r.id)) ? new Set<string>() : new Set(view.map((r) => r.id));
    setSel(next);
    onSelect?.([...next]);
  }

  if (!total) return <EmptyState title="No records" sub={emptyText} />;
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="dense w-full min-w-[860px]">
          <thead><tr>
            {selectable && <th><input type="checkbox" aria-label="Select all rows" checked={view.length > 0 && view.every((r) => sel.has(r.id))} onChange={toggleAll} /></th>}
            {columns.map((c) => (
              <th key={c.key}>
                {c.sortValue ? (
                  <button className="font-bold uppercase tracking-wide hover:text-blue-700" onClick={() => {
                    if (sortKey === c.key) setDir(dir === 1 ? -1 : 1);
                    else { setSortKey(c.key); setDir(1); }
                  }}>
                    {c.header} {sortKey === c.key ? (dir === 1 ? '▲' : '▼') : <span className="text-slate-300">▲</span>}
                  </button>
                ) : c.header}
              </th>
            ))}
          </tr></thead>
          <tbody>{view.map((r) => (
            <tr key={r.id} className={onRowClick ? 'cursor-pointer hover:bg-blue-50/50' : ''} onClick={() => onRowClick?.(r)}>
              {selectable && <td onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Select ${r.id}`} checked={sel.has(r.id)} onChange={() => toggle(r.id)} /></td>}
              {columns.map((c) => <td key={c.key}>{c.render(r)}</td>)}
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="flex items-center gap-2 mt-3 text-xs text-slate-500 flex-wrap">
        <span>Showing {(cur - 1) * size + 1}–{Math.min(cur * size, total)} of {total}</span>
        <div className="ml-auto flex items-center gap-1">
          <button className="w-8 h-8 rounded-lg bg-white border font-bold" disabled={cur <= 1} onClick={() => setPage(cur - 1)}>‹</button>
          {pageNumbers(cur, pages).map((p, i) => (
            <button key={i} onClick={() => typeof p === 'number' && setPage(p)}
              className={`w-8 h-8 rounded-lg font-bold ${p === cur ? 'bg-blue-600 text-white' : 'bg-white border'}`}>{p}</button>
          ))}
          <button className="w-8 h-8 rounded-lg bg-white border font-bold" disabled={cur >= pages} onClick={() => setPage(cur + 1)}>›</button>
          <label className="ml-2 flex items-center gap-1">Rows per page
            <select className="input !w-auto !py-1" value={size} onChange={(e) => setSize(Number(e.target.value))}>
              {pageSizeOptions.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>
        </div>
      </div>
    </div>
  );
}

function pageNumbers(cur: number, pages: number): (number | string)[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const set = new Set([1, 2, cur - 1, cur, cur + 1, pages - 1, pages].filter((p) => p >= 1 && p <= pages));
  const arr = [...set].sort((a, b) => a - b);
  const out: (number | string)[] = [];
  arr.forEach((p, i) => { if (i > 0 && p - (arr[i - 1] as number) > 1) out.push('…'); out.push(p); });
  return out;
}

// ---------- Detail drawer ----------
export function DetailDrawer({ title, onClose, children, wide }: {
  title: string; onClose: () => void; children: React.ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-navy/50" onClick={onClose} />
      <aside className={`absolute right-0 top-0 h-full bg-white shadow-2xl overflow-y-auto p-5 w-full ${wide ? 'max-w-2xl' : 'max-w-md'}`}>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="font-extrabold text-navy text-lg flex-1">{title}</h2>
          <button onClick={onClose} aria-label="Close panel" className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center"><X size={16} /></button>
        </div>
        {children}
      </aside>
    </div>
  );
}

export function Kv({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex gap-2 py-1.5 border-b border-slate-100 last:border-0 text-[13px]">
      <span className="text-slate-500 w-32 shrink-0">{k}</span>
      <span className="font-semibold text-navy flex-1">{v}</span>
    </div>
  );
}

// ---------- Confirm dialog ----------
export function ConfirmDialog({ title, body, confirmLabel = 'Confirm', onConfirm, onCancel, busy }: {
  title: string; body: string; confirmLabel?: string; onConfirm: () => void; onCancel: () => void; busy?: boolean;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onCancel]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-navy/50" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl">
        <h3 className="font-extrabold text-navy">{title}</h3>
        <p className="text-sm text-slate-600 mt-1">{body}</p>
        <div className="flex gap-2 mt-4">
          <button className="btn-primary !bg-white !text-navy border border-slate-300 flex-1" onClick={onCancel} disabled={!!busy}>Cancel</button>
          <button className="btn-primary flex-1" onClick={onConfirm} disabled={!!busy}>
            {busy ? <InlineLoader label={confirmLabel} light /> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Empty state ----------
export function EmptyState({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="py-10 text-center">
      <div className="text-sm font-bold text-navy">{title}</div>
      {sub && <div className="text-[13px] text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

// ---------- Toasts (reads the central store; render once per page) ----------
export function Toasts() {
  const { toasts } = useMockDb();
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[60] space-y-2" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="bg-navy text-white text-[13px] font-semibold rounded-xl px-4 py-2.5 shadow-xl">{t.text}</div>
      ))}
    </div>
  );
}

// ---------- Demo badge (no silent mock: mode is always visible) ----------
export function DemoBadge() {
  return (
    <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5 font-semibold" title="Synthetic demonstration data; HTTP backend integration pending (see docs below)">
      DEMO data · synthetic
    </span>
  );
}

// ---------- Status pill (shared severity/status coloring) ----------
export function StatusPill({ v }: { v: string }) {
  const m: Record<string, string> = {
    Active: 'bg-green-100 text-green-700', Completed: 'bg-green-100 text-green-700', Submitted: 'bg-green-100 text-green-700', Resolved: 'bg-green-100 text-green-700', Compliant: 'bg-green-100 text-green-700', Approved: 'bg-green-100 text-green-700',
    High: 'bg-red-100 text-red-600', Critical: 'bg-red-100 text-red-600', Open: 'bg-red-100 text-red-600', NonCompliant: 'bg-red-100 text-red-600', 'Non-Compliant': 'bg-red-100 text-red-600', Rejected: 'bg-red-100 text-red-600',
    Medium: 'bg-amber-100 text-amber-700', 'Partially Compliant': 'bg-amber-100 text-amber-700', 'Partial Compliance': 'bg-amber-100 text-amber-700',
    'In Progress': 'bg-blue-100 text-blue-700', Pending: 'bg-amber-100 text-amber-700', 'Pending Approval': 'bg-amber-100 text-amber-700', 'Pending Review': 'bg-amber-100 text-amber-700', Scheduled: 'bg-blue-100 text-blue-700',
    'Under Inspection': 'bg-amber-100 text-amber-700', Inactive: 'bg-slate-200 text-slate-600', Closed: 'bg-slate-200 text-slate-600', Suspended: 'bg-red-100 text-red-600',
    Low: 'bg-green-100 text-green-700', Informational: 'bg-slate-100 text-slate-600',
    Assigned: 'bg-blue-100 text-blue-700', 'Awaiting Verification': 'bg-amber-100 text-amber-700', Reopened: 'bg-red-100 text-red-600',
    Normal: 'bg-green-100 text-green-700', Warning: 'bg-amber-100 text-amber-700',
    'Within Limit': 'bg-green-100 text-green-700', 'Near Limit': 'bg-amber-100 text-amber-700', 'Over Limit': 'bg-red-100 text-red-600', 'No Recent Data': 'bg-slate-200 text-slate-600', 'No Data': 'bg-slate-200 text-slate-600',
    'In Transit': 'bg-blue-100 text-blue-700', Delivered: 'bg-green-100 text-green-700', Delayed: 'bg-amber-100 text-amber-700', Cancelled: 'bg-slate-200 text-slate-600',
    'On Leave': 'bg-amber-100 text-amber-700', Complete: 'bg-green-100 text-green-700', Valid: 'bg-green-100 text-green-700', Expired: 'bg-red-100 text-red-600', 'Expiring Soon': 'bg-amber-100 text-amber-700',
    Unread: 'bg-red-100 text-red-600', Read: 'bg-slate-100 text-slate-600', Acknowledged: 'bg-amber-100 text-amber-700',
    Enabled: 'bg-green-100 text-green-700',
  };
  return <span className={`badge ${m[v] || 'bg-slate-100 text-slate-600'}`}>● {v}</span>;
}
