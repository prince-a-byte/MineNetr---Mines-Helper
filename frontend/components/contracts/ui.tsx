'use client';
/**
 * Contractor "My Contracts" UI primitives — matches the MineNetr contractor
 * portal design (page 2 of the reference PDF). Reuses the shared operations
 * presentational kit where possible and adds contract-specific pieces:
 * mining banner, contract cards, work-type icons and a contracts-store toast.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle, ArrowUpRight, BadgeCheck, CalendarClock, CheckCircle2, ChevronDown,
  Construction, FileSignature, FileText, HardHat, Leaf, MoreVertical, Shield, Truck,
  Wrench, X, Compass, Target, Sparkles, Download, Eye, RotateCcw, Upload, Activity,
} from 'lucide-react';
import { ContractStatus, type Contract, type ContractMilestone } from '../../lib/contracts/types';
import { actions, isExpiringSoon, mineLabel, useMockContracts } from '../../lib/contracts/store';
import { dueLabel, dueTone, fmtDate, inr, pct, relTime } from '../../lib/contracts/format';

// ---------- Work-type → icon + tint ----------
const WORK_ICON: Record<string, { icon: any; tile: string }> = {
  'Overburden Removal': { icon: Construction, tile: 'bg-blue-50 text-blue-600' },
  'Coal Transportation': { icon: Truck, tile: 'bg-emerald-50 text-emerald-600' },
  'Equipment Maintenance': { icon: Wrench, tile: 'bg-purple-50 text-purple-600' },
  'Site Services': { icon: HardHat, tile: 'bg-amber-50 text-amber-600' },
  'Exploration Support': { icon: Compass, tile: 'bg-rose-50 text-rose-600' },
  'Coal Washery Maintenance': { icon: Sparkles, tile: 'bg-cyan-50 text-cyan-600' },
  'Security & Surveillance': { icon: Shield, tile: 'bg-indigo-50 text-indigo-600' },
  'Drill & Blast Support': { icon: Target, tile: 'bg-orange-50 text-orange-600' },
  'Vegetation & Reclamation': { icon: Leaf, tile: 'bg-green-50 text-green-600' },
};
export function workIcon(workType: string) {
  return WORK_ICON[workType] ?? { icon: FileText, tile: 'bg-slate-100 text-slate-600' };
}

// ---------- Contract status pill ----------
const CONTRACT_PILL: Record<string, string> = {
  [ContractStatus.Active]: 'bg-green-100 text-green-700',
  [ContractStatus.Upcoming]: 'bg-blue-100 text-blue-700',
  [ContractStatus.ExpiringSoon]: 'bg-amber-100 text-amber-700',
  [ContractStatus.Completed]: 'bg-green-100 text-green-700',
  [ContractStatus.Terminated]: 'bg-red-100 text-red-600',
};
export function ContractStatusPill({ c }: { c: Contract }) {
  const label = isExpiringSoon(c) ? 'Expiring Soon' : c.status;
  return <span className={`badge ${CONTRACT_PILL[label] || 'bg-slate-100 text-slate-600'}`}>● {label}</span>;
}

// ---------- Mining banner (page header) ----------
export function ContractsBanner({ onNewRequest, extra }: { onNewRequest: () => void; extra?: React.ReactNode }) {
  return (
    <div className="m-4 rounded-2xl overflow-hidden relative">
      <div className="absolute inset-0" style={{ background: 'linear-gradient(100deg,#e8f0fe 0%,#cfdef8 34%,#2f4d7a 34%,#1b3358 68%,#0a1730 100%)' }} />
      <svg className="absolute inset-y-0 right-0 h-full w-[62%]" viewBox="0 0 600 200" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
        <defs>
          <linearGradient id="cbSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#a9c3ea" /><stop offset="0.5" stopColor="#d9b48a" /><stop offset="1" stopColor="#5a3a22" /></linearGradient>
          <linearGradient id="cbBench" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6b5236" /><stop offset="1" stopColor="#241a10" /></linearGradient>
        </defs>
        <rect width="600" height="200" fill="url(#cbSky)" />
        <circle cx="470" cy="50" r="26" fill="#fff3cf" opacity="0.95" />
        <g fill="url(#cbBench)">
          <path d="M180 200 L270 118 L600 118 L600 200 Z" /><path d="M110 200 L215 152 L600 152 L600 200 Z" opacity="0.85" /><path d="M40 200 L160 176 L600 176 L600 200 Z" opacity="0.9" />
        </g>
        <g>
          <rect x="330" y="116" width="50" height="17" rx="2" fill="#e8a13a" /><rect x="338" y="103" width="22" height="13" rx="2" fill="#f0b558" />
          <circle cx="341" cy="135" r="5" /><circle cx="369" cy="135" r="5" />
          <rect x="446" y="146" width="56" height="18" rx="2" fill="#e8a13a" /><circle cx="458" cy="167" r="6" /><circle cx="490" cy="167" r="6" />
        </g>
      </svg>
      <div className="absolute inset-0" style={{ background: 'linear-gradient(100deg,rgba(232,240,254,0.96) 0%,rgba(207,222,248,0.78) 28%,rgba(10,7,3,0) 54%)' }} />
      <div className="relative p-6 md:p-7 max-w-3xl flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl md:text-[30px] font-extrabold leading-tight">
            <span className="text-navy">My </span><span className="text-blue-600">Contracts</span>
          </h1>
          <p className="text-indigo-700 text-sm mt-1 font-semibold">View and manage all your assigned contracts across mines</p>
          <p className="text-slate-500 text-[13px] mt-1 max-w-xl">Track contract details, timelines, milestones, work scope and compliance requirements.</p>
          {extra}
        </div>
        <button onClick={onNewRequest}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl px-5 py-3 text-sm shadow-lg shadow-blue-900/20 flex items-center gap-2 transition shrink-0">
          <span className="text-lg leading-none">+</span> New Contract Request
        </button>
      </div>
    </div>
  );
}

// ---------- Contract card (compact horizontal row) ----------
export function ContractCard({ c, onView, menuOpen, onToggleMenu, onAction }: {
  c: Contract;
  onView: () => void;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onAction: (action: string) => void;
}) {
  const { icon: Icon, tile } = workIcon(c.workType);
  const canRenew = c.renewalEligible;
  return (
    <div className="card !p-4 hover:border-blue-200 hover:shadow-md transition relative">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-col gap-2 w-full sm:w-auto">
          <ContractStatusPill c={c} />
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${tile}`}><Icon size={22} /></div>
        </div>
        <div className="min-w-[190px] flex-1">
          <div className="font-extrabold text-navy leading-tight">{c.name}</div>
          <div className="text-[12px] text-slate-500 mt-0.5">Contract ID: <span className="font-semibold text-slate-600">{c.id}</span></div>
          <div className="text-[12px] text-slate-500">{mineLabel(c.mineId)}</div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-5 gap-y-1 flex-[2] text-[12px]">
          <div>
            <div className="text-slate-500">Start Date</div>
            <div className="font-bold text-navy flex items-center gap-1"><CalendarClock size={13} className="text-blue-500" />{fmtDate(c.startDate)}</div>
          </div>
          <div>
            <div className="text-slate-500">End Date</div>
            <div className="font-bold text-navy flex items-center gap-1"><CalendarClock size={13} className="text-blue-500" />{fmtDate(c.endDate)}</div>
          </div>
          <div>
            <div className="text-slate-500">Contract Value</div>
            <div className="font-extrabold text-navy">{inr(c.contractValue)}</div>
          </div>
          <div className="min-w-[90px]">
            <div className="text-slate-500">Progress</div>
            <div className="font-bold text-navy">{pct(c.progress)}</div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
              <div className="h-full rounded-full transition-all" style={{ width: `${c.progress}%`, background: c.progress === 100 ? '#159B72' : '#1463D9' }} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={onView}
            className="border border-blue-200 text-blue-700 hover:bg-blue-50 font-bold rounded-lg px-3.5 py-2 text-[12px] transition flex items-center gap-1">
            <Eye size={14} /> View Details
          </button>
          <div className="relative">
            <button onClick={onToggleMenu} aria-label="Contract actions" aria-haspopup="menu" aria-expanded={menuOpen}
              className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500">
              <MoreVertical size={16} />
            </button>
            {menuOpen && (
              <div role="menu" className="absolute right-0 mt-1 w-48 bg-white rounded-xl border border-slate-200 shadow-xl p-1.5 z-30">
                <MenuItem icon={Eye} label="View Details" onClick={() => onAction('view')} />
                <MenuItem icon={FileText} label="View Milestones" onClick={() => onAction('milestones')} />
                <MenuItem icon={Download} label="Download Contract" onClick={() => onAction('download')} />
                <MenuItem icon={FileSignature} label="View Documents" onClick={() => onAction('documents')} />
                <MenuItem icon={Activity} label="View Activity" onClick={() => onAction('activity')} />
                <div className="my-1 border-t border-slate-100" />
                <MenuItem icon={RotateCcw} label="Request Renewal" onClick={() => onAction('renew')} disabled={!canRenew}
                  disabledHint={canRenew ? undefined : 'Not eligible for this status'} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MenuItem({ icon: Icon, label, onClick, disabled, disabledHint }: {
  icon: any; label: string; onClick: () => void; disabled?: boolean; disabledHint?: string;
}) {
  return (
    <button role="menuitem" onClick={onClick} disabled={disabled} title={disabledHint}
      className={`w-full text-left px-3 py-2 rounded-lg text-[13px] font-semibold flex items-center gap-2 transition ${disabled ? 'text-slate-300 cursor-not-allowed' : 'text-navy hover:bg-slate-50'}`}>
      <Icon size={14} /> {label}
    </button>
  );
}

// ---------- Upcoming milestone item ----------
export function MilestoneItem({ m, contractName, contractId, onClick }: {
  m: ContractMilestone; contractName: string; contractId: string; onClick: () => void;
}) {
  const tone = m.status === 'Completed' ? 'bg-green-100 text-green-700' : m.status === 'Overdue' ? 'bg-red-100 text-red-600' : dueTone(m.dueDate);
  return (
    <button onClick={onClick} className="w-full text-left flex gap-2.5 py-2.5 border-b border-slate-100 last:border-0 hover:bg-blue-50/40 rounded-lg px-1 -mx-1 transition">
      <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
        {m.status === 'Completed' ? <CheckCircle2 size={16} /> : m.status === 'Overdue' ? <AlertTriangle size={16} /> : <FileText size={16} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-bold text-navy truncate">{contractName} <span className="text-slate-400 font-semibold">({contractId})</span></span>
        <span className="block text-[12px] text-slate-600 truncate">{m.title}</span>
        <span className="block text-[11px] text-slate-400">{fmtDate(m.dueDate)}</span>
      </span>
      <span className={`badge ${tone} self-start whitespace-nowrap`}>{m.status === 'Completed' ? 'Submitted' : dueLabel(m.dueDate)}</span>
    </button>
  );
}

// ---------- Toasts (reads the contracts store; render once per page) ----------
export function ContractsToasts() {
  const { toasts } = useMockContracts();
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[60] space-y-2" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="bg-navy text-white text-[13px] font-semibold rounded-xl px-4 py-2.5 shadow-xl max-w-xs">{t.text}</div>
      ))}
    </div>
  );
}

// ---------- Demo badge ----------
export function ContractsDemoBadge() {
  return (
    <span title="All contract records on this page are fictional demonstration data. No live contracts, approvals or payments are connected."
      className="inline-flex items-center gap-1.5 text-[10px] font-extrabold tracking-wide text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />DEMO MODE · SYNTHETIC DATA
    </span>
  );
}

// ---------- Small select used inside chart panels ----------
export function InlineSelect({ value, onChange, options, label }: {
  value: string; onChange: (v: string) => void; options: { id: string; label: string }[]; label: string;
}) {
  return (
    <div className="relative">
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}
        className="appearance-none input !w-auto !py-1.5 !text-xs font-semibold pr-7 cursor-pointer">
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
      <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
    </div>
  );
}

// ---------- Reset-demo affordance ----------
export function ResetDemoBtn() {
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    if (!confirm) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setConfirm(false); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [confirm]);
  return (
    <>
      <button onClick={() => setConfirm(true)}
        className="text-[11px] font-semibold text-slate-400 hover:text-navy flex items-center gap-1 transition" title="Restore the original synthetic dataset">
        <RotateCcw size={12} /> Reset demo data
      </button>
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-label="Reset demo data">
          <div className="absolute inset-0 bg-navy/50" onClick={() => setConfirm(false)} />
          <div className="relative bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl">
            <h3 className="font-extrabold text-navy">Reset demo data?</h3>
            <p className="text-sm text-slate-600 mt-1">This clears all requests, renewals and milestone changes made in this demo and restores the original synthetic dataset.</p>
            <div className="flex gap-2 mt-4">
              <button className="btn-primary !bg-white !text-navy border border-slate-300 flex-1" onClick={() => setConfirm(false)}>Cancel</button>
              <button className="btn-primary flex-1 !bg-red-600 hover:!bg-red-700" onClick={() => { actions.resetDemo(); setConfirm(false); }}>Reset</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export { Link };
