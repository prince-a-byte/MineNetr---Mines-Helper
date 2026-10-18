/**
 * Shared Coal Mine Operations UI primitives — one visual language for all
 * 11 pages, matching the industrial reference (tinted KPI tiles, compact
 * tables, tab bars, pill statuses, drawers with Escape/focus handling).
 * Every interactive primitive wired here is functional (no dead controls).
 */
'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useMockOps } from '../../lib/ops/store';
import InlineLoader from '../ui/InlineLoader';

// ---------- KPI card (icon tile + label + value + trend + context dot) ----------
export function KpiCard({ icon, label, value, trend, trendTone, context, contextTone = 'text-slate-500', dotColor = '#94a3b8', tileClass = 'bg-blue-50 text-blue-600' }: {
  icon: React.ReactNode; label: string; value: string | number;
  trend?: string; trendTone?: 'up' | 'down'; context?: string; contextTone?: string; dotColor?: string; tileClass?: string;
}) {
  return (
    <div className="card !p-4 flex gap-3 items-start">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${tileClass}`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-[12px] font-semibold text-slate-600">{label}</div>
        <div className="text-2xl font-extrabold text-navy leading-tight">
          {value}
          {trend && <span className={`text-xs font-bold ml-1.5 ${trendTone === 'down' ? 'text-red-500' : 'text-green-600'}`}>{trendTone === 'down' ? '▼' : '▲'} {trend}</span>}
        </div>
        {context && (
          <div className={`text-[11px] mt-0.5 flex items-center gap-1 ${contextTone}`}>
            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: dotColor }} />
            {context}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Section card ----------
export function SectionCard({ title, subtitle, action, children, className = '' }: {
  title: React.ReactNode; subtitle?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`card ${className}`}>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="min-w-0">
          <h3 className="font-extrabold text-navy leading-tight">{title}</h3>
          {subtitle && <div className="text-[11px] text-slate-500">{subtitle}</div>}
        </div>
        <div className="ml-auto flex items-center gap-2">{action}</div>
      </div>
      {children}
    </div>
  );
}

// ---------- Link-style action (View All / View Details) ----------
export function LinkBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return <button onClick={onClick} className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline">{children} ›</button>;
}

// ---------- Tabs ----------
export function Tabs({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (t: string) => void }) {
  return (
    <div className="border-b border-slate-200 flex gap-1 overflow-x-auto" role="tablist">
      {tabs.map((t) => (
        <button key={t} role="tab" aria-selected={t === active} onClick={() => onChange(t)}
          className={`px-4 py-2.5 text-sm font-bold whitespace-nowrap border-b-2 -mb-px transition ${t === active ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-navy'}`}>
          {t}
        </button>
      ))}
    </div>
  );
}

// ---------- Period select (charts) ----------
export function PeriodSelect({ value, onChange, options = ['Last 7 Days', 'Last 30 Days', 'Last 6 Months', 'This Month'] }: {
  value: string; onChange: (v: string) => void; options?: string[];
}) {
  return (
    <select className="input !w-auto !py-1.5 !text-xs font-semibold" value={value} aria-label="Chart period"
      onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

// ---------- Demo badge ----------
export function DemoBadge({ label = 'DEMO MODE · SYNTHETIC DATA' }: { label?: string }) {
  return (
    <span title="All records on this page are fictional demonstration data. No live sensors, weighbridge, CCTV, challans or payments are connected."
      className="inline-flex items-center gap-1.5 text-[10px] font-extrabold tracking-wide text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />{label}
    </span>
  );
}

// ---------- Simulated-data notice ----------
export function SimulatedNote({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{children}</div>;
}

// ---------- Status pill ----------
const PILL: Record<string, string> = {
  // worker / contractor
  Active: 'bg-green-100 text-green-700', Blocked: 'bg-red-100 text-red-600', Inactive: 'bg-slate-200 text-slate-600',
  'Pending Approval': 'bg-blue-100 text-blue-700', Rejected: 'bg-red-100 text-red-600',
  'Expiring Soon': 'bg-amber-100 text-amber-700', Expired: 'bg-red-100 text-red-600', Valid: 'bg-green-100 text-green-700',
  'Not Trained': 'bg-red-100 text-red-600',
  // attendance / access
  Present: 'bg-green-100 text-green-700', Absent: 'bg-red-100 text-red-600', 'On Leave': 'bg-amber-100 text-amber-700',
  'Half Day': 'bg-amber-100 text-amber-700', NotScheduled: 'bg-slate-100 text-slate-500', 'Not Scheduled': 'bg-slate-100 text-slate-500',
  Allowed: 'bg-green-100 text-green-700',
  // dispatch / stock
  Dispatched: 'bg-green-100 text-green-700', 'In Transit': 'bg-amber-100 text-amber-700', Pending: 'bg-red-100 text-red-600',
  Cancelled: 'bg-slate-200 text-slate-600', Normal: 'bg-green-100 text-green-700', Low: 'bg-amber-100 text-amber-700',
  High: 'bg-red-100 text-red-600', Added: 'bg-green-100 text-green-700', Deducted: 'bg-red-100 text-red-600',
  Transferred: 'bg-blue-100 text-blue-700', Reconciled: 'bg-blue-100 text-blue-700',
  // bills
  Approved: 'bg-green-100 text-green-700', 'Under Review': 'bg-blue-100 text-blue-700', Paid: 'bg-green-100 text-green-700',
  'Partially Paid': 'bg-amber-100 text-amber-700', Unpaid: 'bg-red-100 text-red-600',
  // documents / inspections
  Draft: 'bg-slate-200 text-slate-600', Ready: 'bg-green-100 text-green-700', Scheduled: 'bg-blue-100 text-blue-700',
  'In Progress': 'bg-blue-100 text-blue-700', Completed: 'bg-green-100 text-green-700', Cancelled2: 'bg-slate-200 text-slate-600',
  Open: 'bg-red-100 text-red-600', 'Action Assigned': 'bg-blue-100 text-blue-700', Resolved: 'bg-green-100 text-green-700',
  Closed: 'bg-slate-200 text-slate-600', Overdue: 'bg-red-100 text-red-600', 'In Progress ': 'bg-blue-100 text-blue-700',
  Unread: 'bg-red-100 text-red-600', Read: 'bg-slate-100 text-slate-500', Acknowledged: 'bg-amber-100 text-amber-700',
  Critical: 'bg-red-100 text-red-600', High2: 'bg-red-100 text-red-600', Medium: 'bg-amber-100 text-amber-700', Low2: 'bg-green-100 text-green-700',
  // mine
  Maintenance: 'bg-amber-100 text-amber-700', 'Under Inspection': 'bg-blue-100 text-blue-700',
  Compliant: 'bg-green-100 text-green-700', 'Partial Compliance': 'bg-amber-100 text-amber-700', 'Non-Compliant': 'bg-red-100 text-red-600',
};
export function StatusPill({ v }: { v: string }) {
  return <span className={`badge ${PILL[v] || 'bg-slate-100 text-slate-600'}`}>● {v}</span>;
}

// ---------- Filter bar ----------
export interface FilterDef { key: string; label: string; options: string[]; width?: string }
export function FilterBar({ defs, values, onChange, onApply, onReset }: {
  defs: FilterDef[]; values: Record<string, string>;
  onChange: (key: string, v: string) => void; onApply: () => void; onReset: () => void;
}) {
  return (
    <div className="flex gap-2 flex-wrap items-end">
      {defs.map((d) => (
        <label key={d.key} className="block">
          <span className="block text-[11px] font-semibold text-slate-500 mb-1">{d.label}</span>
          <select className={`input ${d.width || '!w-44'} !py-2 !text-[13px]`} value={values[d.key] ?? ''} onChange={(e) => onChange(d.key, e.target.value)}>
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

// ---------- Search ----------
export function SearchInput({ value, onChange, onSearch, ph, width = '!w-72' }: {
  value: string; onChange: (v: string) => void; onSearch: () => void; ph: string; width?: string;
}) {
  return (
    <div className="flex gap-2">
      <input className={`input ${width} !py-2 !text-[13px]`} placeholder={ph} value={value}
        onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onSearch()} />
      <button className="btn-primary !py-2" onClick={onSearch}>Search</button>
    </div>
  );
}

// ---------- Data table ----------
export interface Column<T> {
  key: string; header: string; render: (row: T) => React.ReactNode;
  sortValue?: (row: T) => string | number; thClass?: string;
}
export function DataTable<T extends { id: string }>({ columns, rows, initialSize = 10, pageSizeOptions = [10, 20, 50], onRowClick, selectable, onSelected, actions, emptyTitle = 'No records', emptyText = 'No records match the current filters.' }: {
  columns: Column<T>[]; rows: T[]; initialSize?: number; pageSizeOptions?: number[];
  onRowClick?: (row: T) => void; selectable?: boolean; onSelected?: (ids: string[]) => void;
  actions?: (row: T) => React.ReactNode; emptyTitle?: string; emptyText?: string;
}) {
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(initialSize);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [dir, setDir] = useState<1 | -1>(1);
  const [sel, setSel] = useState<Set<string>>(new Set());

  useEffect(() => { setPage(1); }, [rows.length, size]);

  const sorted = useMemo(() => {
    const copy = [...rows];
    if (!sortKey) return copy;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return copy;
    return copy.sort((a, b) => {
      const va = col.sortValue!(a); const vb = col.sortValue!(b);
      return (va < vb ? -1 : va > vb ? 1 : 0) * dir;
    });
  }, [rows, sortKey, dir, columns]);

  const total = sorted.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const cur = Math.min(page, pages);
  const view = sorted.slice((cur - 1) * size, cur * size);

  function toggle(id: string) {
    const next = new Set(sel);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSel(next); onSelected?.([...next]);
  }
  function toggleAll() {
    const next = view.length > 0 && view.every((r) => sel.has(r.id)) ? new Set<string>() : new Set(view.map((r) => r.id));
    setSel(next); onSelected?.([...next]);
  }

  if (!total) return <EmptyState title={emptyTitle} sub={emptyText} />;

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="dense w-full min-w-[860px]">
          <thead><tr>
            {selectable && <th className="w-8"><input type="checkbox" aria-label="Select all rows" checked={view.length > 0 && view.every((r) => sel.has(r.id))} onChange={toggleAll} /></th>}
            {columns.map((c) => (
              <th key={c.key} className={c.thClass}>
                {c.sortValue ? (
                  <button className="font-bold uppercase tracking-wide hover:text-blue-700" onClick={() => {
                    if (sortKey === c.key) setDir(dir === 1 ? -1 : 1); else { setSortKey(c.key); setDir(1); }
                  }}>
                    {c.header} {sortKey === c.key ? (dir === 1 ? '▲' : '▼') : <span className="text-slate-300">▲</span>}
                  </button>
                ) : c.header}
              </th>
            ))}
            {actions && <th className="text-right">Actions</th>}
          </tr></thead>
          <tbody>{view.map((r) => (
            <tr key={r.id} className={onRowClick ? 'cursor-pointer hover:bg-blue-50/50' : 'hover:bg-slate-50/60'} onClick={() => onRowClick?.(r)}>
              {selectable && <td onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Select ${r.id}`} checked={sel.has(r.id)} onChange={() => toggle(r.id)} /></td>}
              {columns.map((c) => <td key={c.key}>{c.render(r)}</td>)}
              {actions && <td className="text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>{actions(r)}</td>}
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="flex items-center gap-2 mt-3 text-xs text-slate-500 flex-wrap">
        <span>Showing {(cur - 1) * size + 1}–{Math.min(cur * size, total)} of {total}</span>
        <div className="ml-auto flex items-center gap-1">
          <button className="w-8 h-8 rounded-lg bg-white border font-bold" disabled={cur <= 1} onClick={() => setPage(cur - 1)} aria-label="Previous page">‹</button>
          {pageNumbers(cur, pages).map((p, i) => (
            <button key={i} onClick={() => typeof p === 'number' && setPage(p)} aria-label={typeof p === 'number' ? `Page ${p}` : 'More pages'}
              className={`w-8 h-8 rounded-lg font-bold ${p === cur ? 'bg-blue-600 text-white' : 'bg-white border'}`}>{p}</button>
          ))}
          <button className="w-8 h-8 rounded-lg bg-white border font-bold" disabled={cur >= pages} onClick={() => setPage(cur + 1)} aria-label="Next page">›</button>
          <label className="ml-2 flex items-center gap-1">Show
            <select className="input !w-auto !py-1" value={size} onChange={(e) => setSize(Number(e.target.value))} aria-label="Rows per page">
              {pageSizeOptions.map((o) => <option key={o} value={o}>{o}</option>)}
            </select> per page
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
export function DetailDrawer({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    ref.current?.focus();
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-navy/50" onClick={onClose} />
      <aside ref={ref} tabIndex={-1} className={`absolute right-0 top-0 h-full bg-white shadow-2xl overflow-y-auto p-5 w-full outline-none ${wide ? 'max-w-2xl' : 'max-w-md'}`}>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="font-extrabold text-navy text-lg flex-1">{title}</h2>
          <button onClick={onClose} aria-label="Close panel" className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200"><X size={16} /></button>
        </div>
        {children}
      </aside>
    </div>
  );
}

export function Kv({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex gap-2 py-1.5 border-b border-slate-100 last:border-0 text-[13px]">
      <span className="text-slate-500 w-36 shrink-0">{k}</span>
      <span className="font-semibold text-navy flex-1 min-w-0">{v}</span>
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

// ---------- Modal (forms) ----------
export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    ref.current?.focus();
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-navy/50" onClick={onClose} />
      <div ref={ref} tabIndex={-1} className={`relative bg-white rounded-2xl p-5 mt-10 w-full outline-none shadow-2xl ${wide ? 'max-w-3xl' : 'max-w-lg'}`}>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="font-extrabold text-navy text-lg flex-1">{title}</h3>
          <button onClick={onClose} aria-label="Close dialog" className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---------- Form fields ----------
export function Field({ label, error, children, hint }: { label: string; error?: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block mb-3">
      <span className="block text-[12px] font-bold text-slate-600 mb-1">{label}</span>
      {children}
      {hint && !error && <span className="block text-[11px] text-slate-400 mt-0.5">{hint}</span>}
      {error && <span className="block text-[11px] font-semibold text-red-500 mt-0.5" role="alert">{error}</span>}
    </label>
  );
}

// ---------- Empty state ----------
export function EmptyState({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="py-10 text-center">
      <div className="text-sm font-bold text-navy">{title}</div>
      {sub && <div className="text-[13px] text-slate-500 mt-1 max-w-md mx-auto">{sub}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

// ---------- Toasts (central store) ----------
export function Toasts() {
  const { toasts } = useMockOps();
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[60] space-y-2" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="bg-navy text-white text-[13px] font-semibold rounded-xl px-4 py-2.5 shadow-xl">{t.text}</div>
      ))}
    </div>
  );
}

// ---------- Quick actions grid ----------
export function QuickActions({ items }: { items: { label: string; icon: React.ReactNode; onClick: () => void; tileClass?: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((q) => (
        <button key={q.label} onClick={q.onClick}
          className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2.5 text-[12px] font-bold text-navy hover:border-blue-300 hover:bg-blue-50/50 transition text-left">
          <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${q.tileClass || 'bg-blue-100 text-blue-600'}`}>{q.icon}</span>
          <span className="leading-tight">{q.label}</span>
        </button>
      ))}
    </div>
  );
}

// ---------- Banner (mining photo header + Today card) ----------
export function OpsBanner({ title, sub, children }: { title: React.ReactNode; sub: string; children?: React.ReactNode }) {
  return (
    <div className="m-4 rounded-2xl overflow-hidden relative">
      <div className="absolute inset-0" style={{ background: 'linear-gradient(100deg,#e8f0fe 0%,#cfdef8 34%,#3a2c1c 34%,#1c130a 68%,#0a0703 100%)' }} />
      <svg className="absolute inset-y-0 right-0 h-full w-[66%]" viewBox="0 0 600 200" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
        <defs>
          <linearGradient id="opsSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#a9c3ea" /><stop offset="0.5" stopColor="#d9b48a" /><stop offset="1" stopColor="#5a3a22" /></linearGradient>
          <linearGradient id="opsBench" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6b5236" /><stop offset="1" stopColor="#241a10" /></linearGradient>
        </defs>
        <rect width="600" height="200" fill="url(#opsSky)" />
        <circle cx="470" cy="50" r="26" fill="#fff3cf" opacity="0.95" />
        <g fill="url(#opsBench)">
          <path d="M180 200 L270 118 L600 118 L600 200 Z" /><path d="M110 200 L215 152 L600 152 L600 200 Z" opacity="0.85" /><path d="M40 200 L160 176 L600 176 L600 200 Z" opacity="0.9" />
        </g>
        <g>
          <rect x="330" y="116" width="50" height="17" rx="2" fill="#14100a" /><rect x="338" y="103" width="22" height="13" rx="2" fill="#1f1811" />
          <circle cx="341" cy="135" r="5" /><circle cx="369" cy="135" r="5" />
          <rect x="446" y="146" width="56" height="18" rx="2" fill="#14100a" /><circle cx="458" cy="167" r="6" /><circle cx="490" cy="167" r="6" />
        </g>
      </svg>
      <div className="absolute inset-0" style={{ background: 'linear-gradient(100deg,rgba(232,240,254,0.96) 0%,rgba(207,222,248,0.78) 28%,rgba(10,7,3,0) 54%)' }} />
      <div className="relative p-6 md:p-7 max-w-3xl">
        <h1 className="text-2xl md:text-[30px] font-extrabold text-navy leading-tight">{title}</h1>
        <p className="text-indigo-700 text-sm mt-1.5 max-w-2xl">{sub}</p>
        {children}
      </div>
      <div className="absolute right-4 top-4 hidden lg:flex items-center gap-3 bg-white rounded-xl px-4 py-3 shadow-md">
        <span className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center text-sm">📅</span>
        <div className="text-[12px] text-navy leading-tight"><div className="font-bold">Today</div><div>03 Oct 2026</div><div className="text-slate-500">Friday</div></div>
      </div>
      {children ? null : null}
    </div>
  );
}

// ---------- Small building blocks ----------
export function MiniBar({ pct, color = '#1463D9' }: { pct: number; color?: string }) {
  const w = Math.max(0, Math.min(100, pct));
  return (
    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden" role="img" aria-label={`${Math.round(w)}%`}>
      <div className="h-full rounded-full" style={{ width: `${w}%`, background: color }} />
    </div>
  );
}

export function LegendDot({ color, label, value }: { color: string; label: string; value?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[12px] text-slate-600">
      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
      <span className="flex-1 min-w-0 truncate">{label}</span>
      {value !== undefined && <span className="font-bold text-navy">{value}</span>}
    </div>
  );
}

/** Progress row with icon tile (used by contractor attendance, capacity, skills). */
export function ProgressRow({ icon, label, sub, pct, color, right }: {
  icon?: React.ReactNode; label: string; sub?: string; pct: number; color: string; right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      {icon && <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}1a`, color }}>{icon}</span>}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-bold text-navy truncate">{label}</span>
          <span className="ml-auto text-[11px] font-bold text-slate-600 whitespace-nowrap">{right ?? `${pct}%`}</span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <MiniBar pct={pct} color={color} />
          {sub && <span className="text-[10px] text-slate-400 whitespace-nowrap">{sub}</span>}
        </div>
      </div>
    </div>
  );
}

// ---------- Inline error with retry (HTTP mode) ----------
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card border-red-200 bg-red-50/50 text-center py-8">
      <div className="text-sm font-bold text-red-600">Data request failed</div>
      <div className="text-[13px] text-slate-600 mt-1 max-w-lg mx-auto">{message}</div>
      {onRetry && <button className="btn-primary mt-3" onClick={onRetry}>Retry</button>}
    </div>
  );
}
