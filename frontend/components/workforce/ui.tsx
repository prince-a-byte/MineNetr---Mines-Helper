/**
 * Shared contractor-portal UI kit.
 *
 * Reuses the operations presentational primitives (KpiCard, SectionCard,
 * DataTable, DetailDrawer, Modal, Field, SearchInput, ConfirmDialog,
 * EmptyState…) and the Recharts chart set, and adds the contractor-specific
 * shell pieces: live toasts, permission-aware buttons, the demo-role switcher,
 * the mine/period/export toolbar and the worker avatar/pill helpers.
 *
 * Nothing here owns data — every component reads the centralized store via
 * useMockWorkforce()/actions, so all pages stay consistent by construction.
 */
'use client';
import { useEffect, useState } from 'react';
import { Download, RotateCcw, ShieldCheck, UserCog, ChevronDown, Check } from 'lucide-react';
import {
  actions, can, canReason, useMockWorkforce,
} from '../../lib/workforce/store';
import { avatarIndex, AVATAR_BG, tone } from '../../lib/workforce/format';
import { DEMO_ROLES, type DemoRole } from '../../lib/workforce/types';
import { ConfirmDialog, KpiCard, SectionCard } from '../operations/ui';
import { mines } from '../../lib/workforce/seed';

export { KpiCard, SectionCard };
export { Donut, VBars, HBarRows, TrendBars, StackedBars, TrendLine } from '../operations/charts';
export {
  DataTable, DetailDrawer, Modal, Field, SearchInput, EmptyState, Kv, MiniBar,
  LegendDot, ProgressRow, ErrorState, QuickActions, PeriodSelect,
  ConfirmDialog, Tabs, FilterBar, DemoBadge, SimulatedNote, LinkBtn,
  type Column, type FilterDef,
} from '../operations/ui';

// ---------- Status pill (single source of truth for colours) ----------
export function Pill({ v }: { v: string }) {
  return <span className={`badge ${tone(v)}`}>● {v}</span>;
}

/** Neutral pill for values with no semantic colour (e.g. "No Record"). */
export function SoftPill({ v, cls = 'bg-slate-100 text-slate-600' }: { v: string; cls?: string }) {
  return <span className={`badge ${cls}`}>● {v}</span>;
}

// ---------- Worker avatar ----------
const INITIAL_BG = ['#2563eb', '#059669', '#7c3aed', '#d97706', '#e11d48', '#0891b2'];
export function Avatar({ name, id, size = 8 }: { name: string; id: string; size?: number }) {
  const initials = name.split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase();
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full text-white font-bold shrink-0`}
      style={{ width: size * 4, height: size * 4, background: INITIAL_BG[avatarIndex(id)], fontSize: size * 1.4 }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}
void AVATAR_BG;

// ---------- Permission-aware controls ----------
/**
 * Button that disables itself (with an explanatory tooltip) when the active
 * demo role lacks the permission. Never renders a control with an empty action.
 */
export function PermBtn({
  perm, onClick, children, className = 'btn-primary', title, disabled, type = 'button',
}: {
  perm: Parameters<typeof can>[0]; onClick: () => void; children: React.ReactNode;
  className?: string; title?: string; disabled?: boolean; type?: 'button' | 'submit';
}) {
  const allowed = can(perm);
  const reason = allowed ? '' : canReason(perm);
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={!allowed || disabled}
      title={title || reason || undefined}
      aria-disabled={!allowed || disabled}
      className={`${className} ${(!allowed || disabled) ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {children}
    </button>
  );
}

/** Small icon-button variant used inside table action menus. */
export function PermIconBtn({
  perm, onClick, label, children,
}: { perm: Parameters<typeof can>[0]; onClick: () => void; label: string; children: React.ReactNode }) {
  const allowed = can(perm);
  return (
    <button
      onClick={onClick}
      disabled={!allowed}
      title={allowed ? label : canReason(perm)}
      aria-label={label}
      className={`w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-[13px]
        ${allowed ? 'bg-white hover:bg-blue-50 hover:border-blue-300 text-navy' : 'bg-slate-50 text-slate-300 cursor-not-allowed'}`}
    >
      {children}
    </button>
  );
}

// ---------- Live toasts (reads the workforce store) ----------
export function WorkforceToasts() {
  const { toasts } = useMockWorkforce();
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[60] space-y-2" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="bg-navy text-white text-[13px] font-semibold rounded-xl px-4 py-2.5 shadow-xl max-w-xs">
          {t.text}
        </div>
      ))}
    </div>
  );
}

// ---------- Demo role switcher ----------
export function DemoRoleSwitcher() {
  const { role } = useMockWorkforce();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [open]);
  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-2.5 py-1.5 text-[12px] font-bold text-navy bg-white hover:border-blue-300"
        aria-haspopup="menu" aria-expanded={open}
        title="Switch the demo role to see permission-aware controls. Frontend demo only — not production security."
      >
        <UserCog size={14} className="text-blue-600" />
        <span className="hidden sm:inline">{role}</span>
        <ChevronDown size={13} className={`text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-60 bg-white rounded-xl border border-slate-200 shadow-xl p-1.5 z-50">
          <div className="px-3 py-2 border-b border-slate-100 mb-1">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Demo role</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Controls which actions are enabled.</div>
          </div>
          {DEMO_ROLES.map((r) => (
            <button key={r} role="menuitemradio" aria-checked={r === role}
              onClick={() => { actions.setRole(r as DemoRole); setOpen(false); }}
              className={`w-full text-left px-3 py-2 rounded-lg text-[13px] font-semibold flex items-center gap-2
                ${r === role ? 'bg-blue-50 text-blue-700' : 'text-navy hover:bg-slate-50'}`}>
              {r === role ? <Check size={14} /> : <span className="w-3.5" />}
              {r}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Reset demo ----------
export function ResetDemoBtn() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-2.5 py-1.5 text-[12px] font-bold text-navy bg-white hover:border-red-300 hover:text-red-600"
        title="Restore the original synthetic dataset"
      >
        <RotateCcw size={14} />
        <span className="hidden md:inline">Reset demo data</span>
      </button>
      {open && (
        <ConfirmDialog
          title="Reset demo data?"
          body="Every worker, attendance, bill, document and compliance change you made in this demo will be discarded and the original synthetic dataset restored. This cannot be undone."
          confirmLabel="Reset data"
          onCancel={() => setOpen(false)}
          onConfirm={() => { actions.resetDemo(); setOpen(false); }}
        />
      )}
    </>
  );
}

// ---------- Page toolbar (mine + period + export + role + reset) ----------
export function PageToolbar({
  period, onExport, exportLabel = 'Export Report', extra,
}: {
  period: string; onExport?: () => void; exportLabel?: string; extra?: React.ReactNode;
}) {
  const { selectedMineId } = useMockWorkforce();
  const mine = selectedMineId === 'ALL'
    ? 'All assigned mines'
    : (mines.find((m) => m.id === selectedMineId) ? `${mines.find((m) => m.id === selectedMineId)!.name} (${mines.find((m) => m.id === selectedMineId)!.code})` : selectedMineId);

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 rounded-lg px-2.5 py-1.5 text-[12px] font-bold">
        ⛏ {mine}
      </span>
      <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-600 rounded-lg px-2.5 py-1.5 text-[12px] font-bold">
        📅 {period}
      </span>
      <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 rounded-lg px-2.5 py-1.5 text-[12px] font-bold" title="All records are synthetic. The fixed demo clock is 03 Oct 2026.">
        <ShieldCheck size={13} /> DEMO · synthetic data
      </span>
      <div className="ml-auto flex items-center gap-2 flex-wrap">
        {extra}
        <ResetDemoBtn />
        <DemoRoleSwitcher />
        {onExport && (
          <PermBtn perm="export" onClick={onExport} className="btn-primary !py-1.5 !px-3 !text-[12px]">
            <span className="flex items-center gap-1.5"><Download size={14} /> {exportLabel}</span>
          </PermBtn>
        )}
      </div>
    </div>
  );
}

// ---------- Small layout helpers ----------
export function KpiGrid({ children, cols = 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6' }: { children: React.ReactNode; cols?: string }) {
  return <div className={`grid grid-cols-1 ${cols} gap-3 mb-4`}>{children}</div>;
}

export function CardGrid({ children, className = 'lg:grid-cols-3' }: { children: React.ReactNode; className?: string }) {
  return <div className={`grid grid-cols-1 gap-4 ${className}`}>{children}</div>;
}

/** Two-line "label / value" stat used inside cards. */
export function Stat({ label, value, sub, cls = 'text-navy' }: { label: string; value: React.ReactNode; sub?: string; cls?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="text-[11px] font-semibold text-slate-500">{label}</div>
      <div className={`text-lg font-extrabold ${cls}`}>{value}</div>
      {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}
