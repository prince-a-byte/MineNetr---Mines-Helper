/**
 * Shared UI primitives for the Mine Inspector "My Inspections" module.
 *
 * Reuses the existing MineNetr design system (operations/ui.tsx for cards,
 * tables, tabs, dialogs and workforce/ui.tsx for layout/avatars) and adds only
 * the inspector-specific pieces: permission-aware buttons, status/priority/
 * response chips, checklist meters, the workflow stepper, the demo location
 * preview, the module toast host and the role/reset controls.
 *
 * Every primitive here is wired to a real action — no dead callbacks.
 */
'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Check, ChevronDown, ChevronRight, MapPin, RefreshCw, ShieldCheck, UserCog, X,
} from 'lucide-react';
import {
  CardGrid, KpiGrid, Pill, SoftPill, Stat,
} from '../workforce/ui';
import { ConfirmDialog, DemoBadge, SectionCard } from '../operations/ui';
import RoleShell, { LightBanner } from '../RoleShell';
import { useInspectorNav } from '../../app/inspector/nav';
import { INSPECTOR_ROLES, permissionsFor, type InspectorDemoRole, type ChecklistProgress, type InspectorPermissions, type MineSite, type Priority } from '../../lib/inspections/types';
import { actions, rolePermissions, useMockInspections } from '../../lib/inspections/store';
import { statusTone, priorityTone, responseTone, conditionTone, fmtDate, weekdayLong } from '../../lib/inspections/format';

export { CardGrid, KpiGrid, Pill, SoftPill, Stat };

// ---------------------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------------------

/** Live toasts from the inspections store (mirrors the workforce/ops hosts). */
export function InspectionsToasts() {
  const { toasts } = useMockInspections();
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

// ---------------------------------------------------------------------------
// Chips
// ---------------------------------------------------------------------------

export function StatusChip({ v, dot = true }: { v: string; dot?: boolean }) {
  return (
    <span className={`badge ${statusTone(v)}`}>
      {dot ? '● ' : ''}{v}
    </span>
  );
}

export function PriorityChip({ v }: { v: Priority | string }) {
  return <span className={`badge ${priorityTone(v)}`}>{v === 'High' ? '▲ ' : v === 'Low' ? '▽ ' : ''}{v}</span>;
}

export function ResponseChip({ v, size = 'sm' }: { v: string; size?: 'sm' | 'xs' }) {
  return (
    <span className={`badge ${responseTone(v)} ${size === 'xs' ? '!text-[10px] !px-1.5 !py-0.5' : ''}`}>{v}</span>
  );
}

export function ConditionChip({ v }: { v: string }) {
  if (!v) return <span className="text-slate-400 text-xs">—</span>;
  return <span className={`badge ${conditionTone(v)}`}>{v}</span>;
}

// ---------------------------------------------------------------------------
// Permission-aware controls
// ---------------------------------------------------------------------------

type PermKey = keyof InspectorPermissions;

const PERM_REASON: Record<PermKey, string> = {
  readOnly: 'The Read-Only Viewer demo role cannot change records.',
  canStart: 'Your demo role cannot start inspections.',
  canWorkChecklist: 'Your demo role cannot record checklist responses.',
  canSubmit: 'Your demo role cannot submit inspections.',
  canEditDetails: 'Your demo role cannot edit inspection details.',
  canManageEvidence: 'Your demo role cannot add or edit evidence.',
  canManageNotes: 'Your demo role cannot edit notes.',
  canCreateFinding: 'Your demo role cannot raise findings.',
  canAttachDocument: 'Your demo role cannot attach documents.',
  canCancel: 'Cancelling requires a supervisory demo role (Senior Labour Officer / Mine Admin).',
  canReschedule: 'Rescheduling directly requires a supervisory demo role — otherwise submit a request.',
  canReassign: 'Reassigning directly requires a supervisory demo role — otherwise submit a request.',
  canApproveRequests: 'Approving requests requires a supervisory demo role.',
  canBulkCancel: 'Bulk cancellation requires a supervisory demo role.',
};

/** Disables itself with an explanatory tooltip when the demo role lacks the permission. */
export function PermBtn({
  perm, onClick, children, className = 'btn-primary', title, disabled, type = 'button',
}: {
  perm: PermKey; onClick: () => void; children: React.ReactNode;
  className?: string; title?: string; disabled?: boolean; type?: 'button' | 'submit';
}) {
  const allowed = rolePermissions()[perm];
  const reason = PERM_REASON[perm];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={!allowed || disabled}
      title={title || reason}
      aria-disabled={!allowed || disabled}
      className={`${className} ${(!allowed || disabled) ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {children}
    </button>
  );
}

export function PermIconButton({
  perm, onClick, label, children, danger,
}: { perm: PermKey; onClick: () => void; label: string; children: React.ReactNode; danger?: boolean }) {
  const allowed = rolePermissions()[perm];
  return (
    <button
      onClick={onClick}
      disabled={!allowed}
      title={allowed ? label : PERM_REASON[perm]}
      aria-label={label}
      className={`w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-[13px] transition
        ${allowed
          ? danger ? 'bg-white hover:bg-red-50 hover:border-red-300 text-red-600' : 'bg-white hover:bg-blue-50 hover:border-blue-300 text-navy'
          : 'bg-slate-50 text-slate-300 cursor-not-allowed'}`}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Demo role / reset / toolbar
// ---------------------------------------------------------------------------

export function InspectorRoleSwitcher() {
  const { role } = useMockInspections();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('click', close);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('click', close); window.removeEventListener('keydown', onKey); };
  }, [open]);
  return (
    <div className="relative" ref={ref} onClick={(e) => e.stopPropagation()}>
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
        <div role="menu" className="absolute right-0 mt-2 w-64 bg-white rounded-xl border border-slate-200 shadow-xl p-1.5 z-50">
          <div className="px-3 py-2 border-b border-slate-100">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Demo role</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Controls which actions are enabled. Client-side only.</div>
          </div>
          {INSPECTOR_ROLES.map((r) => (
            <button key={r} role="menuitemradio" aria-checked={r === role}
              onClick={() => { actions.setRole(r as InspectorDemoRole); setOpen(false); }}
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

export function ResetInspectionsBtn() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-2.5 py-1.5 text-[12px] font-bold text-navy bg-white hover:border-red-300 hover:text-red-600"
        title="Restore the original synthetic inspections, checklist answers, evidence, findings and schedules."
      >
        <RefreshCw size={14} /> <span className="hidden sm:inline">Reset demo</span>
      </button>
      {open && (
        <ConfirmDialog
          title="Reset demo data?"
          body="This restores the original synthetic inspections, checklist responses, evidence, findings, notes, documents and schedule. Everything you changed in this browser is discarded."
          confirmLabel="Reset demo data"
          onCancel={() => setOpen(false)}
          onConfirm={() => { actions.resetDemo(); setOpen(false); }}
        />
      )}
    </>
  );
}

/** Reporting-date chip + mine scope + DEMO badge + role + reset. */
export function InspectionsToolbar({ extra }: { extra?: React.ReactNode }) {
  const { selectedMineId, sites } = useMockInspections();
  const mine = selectedMineId === 'ALL'
    ? 'All assigned mines'
    : (() => { const s = sites.find((x) => x.id === selectedMineId); return s ? `${s.name} (${s.code})` : selectedMineId; })();

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 rounded-lg px-2.5 py-1.5 text-[12px] font-bold">
        ⛏ {mine}
      </span>
      <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-600 rounded-lg px-2.5 py-1.5 text-[12px] font-bold"
        title="Fixed demo clock for this module.">
        📅 {fmtDate('2026-10-03')} · {weekdayLong('2026-10-03')}
      </span>
      <span className="hidden sm:inline"><DemoBadge label="DEMO · SYNTHETIC INSPECTIONS" /></span>
      <div className="ml-auto flex items-center gap-2 flex-wrap">
        {extra}
        <ResetInspectionsBtn />
        <InspectorRoleSwitcher />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Checklist meters
// ---------------------------------------------------------------------------

export function ChecklistMeter({ p, compact }: { p: ChecklistProgress; compact?: boolean }) {
  const pctValue = p.percent;
  return (
    <div className={compact ? '' : 'space-y-2'}>
      <div className="flex items-center justify-between text-[12px]">
        <span className="font-bold text-navy">Checklist progress</span>
        <span className="font-extrabold text-navy">{p.completed}/{p.totalItems} · {pctValue}%</span>
      </div>
      <div className="h-2 rounded-full bg-slate-200 overflow-hidden" role="progressbar"
        aria-valuenow={pctValue} aria-valuemin={0} aria-valuemax={100}
        aria-label="Checklist completion">
        <div className="h-full rounded-full transition-all"
          style={{ width: `${pctValue}%`, background: pctValue === 100 ? '#159B72' : '#1463D9' }} />
      </div>
      {!compact && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600">
          <span>✔ {p.completed} completed</span>
          <span>… {p.pending} pending</span>
          <span className={p.flagged ? 'text-red-600 font-bold' : ''}>⚑ {p.flagged} flagged</span>
          <span>{p.compliant} compliant</span>
          <span>{p.nonCompliant} non-compliant</span>
          <span>{p.notApplicable} n/a</span>
        </div>
      )}
    </div>
  );
}

export function SectionProgressList({
  sections, activeName, onPick,
}: {
  sections: ChecklistProgress['sections'];
  activeName?: string;
  onPick?: (name: string) => void;
}) {
  return (
    <ol className="space-y-1.5">
      {sections.map((s, idx) => {
        const isActive = activeName === s.name;
        const pct = s.total === 0 ? 0 : Math.round((s.completed / s.total) * 100);
        const content = (
          <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition text-left w-full
            ${isActive ? 'border-blue-400 bg-blue-50/60' : 'border-slate-200 bg-white hover:border-blue-200'}`}>
            <span className={`w-6 h-6 shrink-0 rounded-lg text-[11px] font-extrabold flex items-center justify-center
              ${s.complete ? 'bg-emerald-100 text-emerald-700' : isActive ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
              {s.complete ? <Check size={13} /> : idx + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12.5px] font-bold text-navy truncate">{s.name}</span>
              <span className="block text-[11px] text-slate-500">{s.completed}/{s.total} completed</span>
            </span>
            {s.flagged > 0 && <span className="badge bg-red-100 text-red-600 !text-[10px]">⚑ {s.flagged}</span>}
            {!s.complete && s.notChecked > 0 && (
              <span className="badge bg-amber-100 text-amber-700 !text-[10px]">{s.notChecked} left</span>
            )}
            <span className="w-16 h-1.5 rounded-full bg-slate-200 overflow-hidden shrink-0">
              <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: s.complete ? '#159B72' : '#1463D9' }} />
            </span>
            <ChevronRight size={14} className="text-slate-400 shrink-0" />
          </div>
        );
        return (
          <li key={s.name}>
            {onPick
              ? <button type="button" onClick={() => onPick(s.name)} className="block w-full text-left">{content}</button>
              : content}
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Workflow stepper (individual inspection page)
// ---------------------------------------------------------------------------

export function WorkflowStepper({
  steps, active, onJump, canEdit,
}: {
  steps: readonly string[]; active: number; onJump?: (i: number) => void; canEdit?: boolean;
}) {
  return (
    <ol className="flex flex-wrap gap-2" aria-label="Inspection workflow">
      {steps.map((s, i) => {
        const done = i < active;
        const current = i === active;
        const clickable = Boolean(onJump) && (canEdit !== false || i <= active);
        const cls = current
          ? 'border-blue-600 bg-blue-600 text-white'
          : done ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500';
        const inner = (
          <span className="flex items-center gap-2">
            <span className={`w-6 h-6 rounded-full text-[11px] font-extrabold flex items-center justify-center
              ${current ? 'bg-white text-blue-700' : done ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
              {done ? <Check size={12} /> : i + 1}
            </span>
            <span className="text-[12.5px] font-bold whitespace-nowrap">{s}</span>
          </span>
        );
        return (
          <li key={s}>
            {clickable
              ? <button type="button" onClick={() => onJump?.(i)} className={`rounded-xl border px-3 py-2 transition hover:opacity-90 ${cls}`}>{inner}</button>
              : <span className={`rounded-xl border px-3 py-2 inline-block ${cls}`} title="Complete the current step before moving on." >{inner}</span>}
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Demo location preview (no external map provider)
// ---------------------------------------------------------------------------

export function LocationPreview({ site, location }: { site: MineSite; location: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
      <div className="relative h-32" style={{ background: 'linear-gradient(160deg,#e8f0fe 0%,#cfe0f8 55%,#d9c3a4 100%)' }}>
        <svg viewBox="0 0 400 130" className="absolute inset-0 w-full h-full" aria-hidden="true">
          <g stroke="#9db8dc" strokeWidth="1" fill="none">
            <path d="M0 96 L120 62 L260 78 L400 44" />
            <path d="M0 116 L140 86 L280 100 L400 74" />
            <path d="M60 0 L92 130" /><path d="M240 0 L268 130" />
          </g>
          <path d="M0 130 L0 96 L120 62 L260 78 L400 44 L400 130 Z" fill="#c8b294" opacity="0.75" />
          <circle cx="200" cy="66" r="18" fill="#1463D9" opacity="0.18" />
          <path d="M200 44 a14 14 0 0 1 14 14 c0 11 -14 26 -14 26 s-14 -15 -14 -26 a14 14 0 0 1 14 -14 z" fill="#DC4C58" />
          <circle cx="200" cy="58" r="5" fill="#fff" />
        </svg>
        <span className="absolute top-2 left-2 badge bg-white/90 text-slate-600 !text-[10px]">DEMO LOCATION · not a real mine coordinate</span>
      </div>
      <div className="p-3 flex items-start gap-2">
        <MapPin size={15} className="text-blue-600 mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-bold text-navy truncate">{site.code} · {site.name}</div>
          <div className="text-[11px] text-slate-500">{site.area} — {location}</div>
          <div className="text-[11px] text-slate-400">{site.district}, {site.state} · {site.lat.toFixed(3)}°N, {site.lng.toFixed(3)}°E (demo)</div>
        </div>
        <button
          type="button"
          onClick={() => {
            const text = `${site.code} ${site.name} — ${location} (${site.district}, ${site.state})`;
            if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).catch(() => undefined);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          }}
          className="text-[11px] font-bold text-blue-600 hover:underline shrink-0"
        >
          {copied ? 'Copied' : 'Copy address'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty / error states (exact copy from the module spec)
// ---------------------------------------------------------------------------

export function FilteredEmpty({ onClear, scopeNote }: { onClear?: () => void; scopeNote?: string }) {
  return (
    <div className="py-12 text-center">
      <div className="text-sm font-bold text-navy">
        No inspections match your current filters. Try adjusting or clearing your filters.
      </div>
      {scopeNote && <div className="text-xs text-slate-500 mt-1">{scopeNote}</div>}
      {onClear && (
        <button onClick={onClear} className="btn-primary mt-3 !py-2">Clear filters</button>
      )}
    </div>
  );
}

export function NoAssignmentsEmpty({ onClear }: { onClear?: () => void }) {
  return (
    <div className="py-12 text-center">
      <div className="text-sm font-bold text-navy">
        No inspections are assigned to you for the selected mine.
      </div>
      <div className="text-xs text-slate-500 mt-1">Switch the mine selector or clear filters to see the rest of your workload.</div>
      {onClear && <button onClick={onClear} className="btn-primary mt-3 !py-2">Clear filters</button>}
    </div>
  );
}

export function InlineError({ error, onDismiss }: { error: string; onDismiss?: () => void }) {
  if (!error) return null;
  return (
    <div role="alert" className="mb-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[12.5px] text-red-700">
      <span className="font-bold shrink-0">Couldn&apos;t complete that action:</span>
      <span className="flex-1">{error}</span>
      {onDismiss && (
        <button onClick={onDismiss} aria-label="Dismiss error" className="shrink-0 text-red-400 hover:text-red-700">
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export function SaveHint({ at, label = 'Last saved' }: { at?: string | null; label?: string }) {
  if (!at) return <span className="text-[11px] text-slate-400">Not saved yet</span>;
  return <span className="text-[11px] text-slate-500">✔ {label}: {new Date(at).toLocaleString()}</span>;
}

// ---------------------------------------------------------------------------
// Menus
// ---------------------------------------------------------------------------

export interface MenuItem {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  danger?: boolean;
  icon?: React.ReactNode;
}

/** Accessible dropdown used for "More Actions" and row action overflow menus. */
export function Menu({ label = 'More', items, align = 'right', tone = 'default' }: {
  label?: string; items: MenuItem[]; align?: 'left' | 'right'; tone?: 'default' | 'primary';
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('click', close);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('click', close); window.removeEventListener('keydown', onKey); };
  }, [open]);
  const visible = items.filter((i) => !i.disabled || i.title);
  return (
    <div className="relative" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu" aria-expanded={open}
        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-bold border transition
          ${tone === 'primary'
            ? 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700'
            : 'bg-white border-slate-200 text-navy hover:border-blue-300 hover:bg-blue-50/50'}`}
      >
        {label} <ChevronDown size={13} className={`transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && visible.length > 0 && (
        <div role="menu" className={`absolute mt-2 w-60 bg-white rounded-xl border border-slate-200 shadow-xl p-1.5 z-50 ${align === 'right' ? 'right-0' : 'left-0'}`}>
          {visible.map((it) => (
            <button
              key={it.label}
              role="menuitem"
              disabled={it.disabled}
              title={it.title}
              onClick={() => { if (it.disabled) return; setOpen(false); it.onClick(); }}
              className={`w-full text-left px-3 py-2 rounded-lg text-[13px] font-semibold flex items-center gap-2
                ${it.disabled ? 'text-slate-300 cursor-not-allowed' : it.danger ? 'text-red-600 hover:bg-red-50' : 'text-navy hover:bg-slate-50'}`}
            >
              {it.icon}{it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

/** In-page nav link styled as a secondary button (never href="#"). */
export function NavBtn({ href, children, icon }: { href: string; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-bold text-navy hover:border-blue-300 hover:bg-blue-50/50">
      {icon}{children}
    </Link>
  );
}

/** Permission summary used in the details panel footer / review step. */
export function PermissionHint() {
  const { role } = useMockInspections();
  const perms = permissionsFor(role);
  const locked = (Object.keys(perms) as PermKey[]).filter((k) => !perms[k]);
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11.5px] text-slate-600">
      <div className="flex items-center gap-1.5 font-bold text-navy">
        <ShieldCheck size={13} className="text-blue-600" /> Acting as <span className="text-blue-700">{role}</span>
      </div>
      <div className="mt-0.5">
        {locked.length === 0
          ? 'All inspection actions are enabled for this demo role.'
          : `Restricted: ${locked.map((k) => k.replace(/^can/, '').replace(/([A-Z])/g, ' $1').toLowerCase()).join(', ')}.`}
      </div>
    </div>
  );
}

export { SectionCard };

/**
 * Shared shell for every inspector route: the existing RoleShell sidebar and
 * header (never duplicated), the mine selector bound to the centralized store,
 * the live nav badges, the banner and the toast layer. Pages pass only their
 * banner copy and their content.
 */
export function InspectorShell({ title, sub, children }: {
  title: React.ReactNode; sub: string; children: React.ReactNode;
}) {
  const db = useMockInspections();
  const nav = useInspectorNav();
  const mineOptions = [
    { id: 'ALL', label: 'All Assigned Mines' },
    ...db.sites.map((s) => ({ id: s.id, label: `${s.name} (${s.code})` })),
  ];
  return (
    <RoleShell
      role="inspector"
      nav={nav}
      orgTitle="Mine Inspector (DGMS)"
      orgSub="Directorate General of Mines Safety"
      mineOptions={mineOptions}
      mineValue={db.selectedMineId}
      onMineChange={(id) => actions.setSelectedMine(id)}
      profileSub="Mine Inspector (DGMS)"
      banner={<LightBanner title={title} sub={sub} />}
    >
      <InspectionsToasts />
      {children}
    </RoleShell>
  );
}
