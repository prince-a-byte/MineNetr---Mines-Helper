'use client';
/**
 * Contract details drawer — Overview, Scope, Milestones, Documents and
 * Activity History. Milestone actions (submit / upload / clarify) call the
 * centralized store; the contractor can never mark a milestone Approved.
 */
import { useMemo, useRef, useState } from 'react';
import {
  Activity, AlertTriangle, Building2, CalendarRange, CheckCircle2, Download, Eye, FileText,
  Paperclip, RefreshCw, ShieldCheck, Upload,
} from 'lucide-react';
import { DetailDrawer, Kv } from '../operations/ui';
import { ContractStatus, MilestoneStatus, type Contract, type ContractMilestone } from '../../lib/contracts/types';
import { actions, isExpiringSoon, mineLabel, useMockContracts } from '../../lib/contracts/store';
import { dueLabel, dueTone, fmtDate, fmtDateTime, fmtSize, inr, pct, relTime } from '../../lib/contracts/format';
import { ContractStatusPill, workIcon } from './ui';

const TABS = ['Overview', 'Scope of Work', 'Milestones', 'Documents', 'Activity History'] as const;
type Tab = typeof TABS[number];

export function ContractDetailsDrawer({ contract, initialTab = 'Overview', onClose, onRenew }: {
  contract: Contract; initialTab?: Tab; onClose: () => void; onRenew?: () => void;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const db = useMockContracts();
  const { icon: Icon, tile } = workIcon(contract.workType);

  const milestones = useMemo(() => db.milestones.filter((m) => m.contractId === contract.id)
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1)), [db.milestones, contract.id]);
  const documents = useMemo(() => db.documents.filter((d) => d.contractId === contract.id), [db.documents, contract.id]);
  const activity = useMemo(() => db.activity.filter((a) => a.contractId === contract.id), [db.activity, contract.id]);

  return (
    <DetailDrawer title={`${contract.name}`} onClose={onClose} wide>
      {/* Header block */}
      <div className="flex items-start gap-3 mb-3">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${tile}`}><Icon size={22} /></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap"><ContractStatusPill c={contract} /></div>
          <div className="text-[12px] text-slate-500 mt-1">Contract ID: <span className="font-semibold text-slate-600">{contract.id}</span></div>
        </div>
        {contract.renewalEligible && onRenew && (
          <button onClick={onRenew} className="btn-primary !py-2 flex items-center gap-1.5 shrink-0"><RefreshCw size={14} /> Renew</button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 flex gap-1 overflow-x-auto mb-3" role="tablist">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={t === tab} onClick={() => setTab(t)}
            className={`px-3 py-2 text-[12px] font-bold whitespace-nowrap border-b-2 -mb-px transition ${t === tab ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-navy'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'Overview' && (
        <div>
          <p className="text-[13px] text-slate-600 mb-3">{contract.description}</p>
          <Kv k="Contractor" v={<span className="flex items-center gap-1.5"><Building2 size={14} className="text-slate-400" />{db.contractor.name}</span>} />
          <Kv k="Mine" v={mineLabel(contract.mineId)} />
          <Kv k="Work Type" v={contract.workType} />
          <Kv k="Contract Period" v={<span className="flex items-center gap-1.5"><CalendarRange size={14} className="text-slate-400" />{fmtDate(contract.startDate)} → {fmtDate(contract.endDate)}</span>} />
          <Kv k="Contract Value" v={inr(contract.contractValue)} />
          <Kv k="Progress" v={
            <span className="flex items-center gap-2">
              <span className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden"><span className="block h-full rounded-full" style={{ width: `${contract.progress}%`, background: contract.progress === 100 ? '#159B72' : '#1463D9' }} /></span>
              {pct(contract.progress)}
            </span>} />
          <Kv k="Work Order" v={contract.workOrderNumber} />
          <Kv k="Compliance" v={<span className="inline-flex items-center gap-1.5"><ShieldCheck size={14} className={contract.complianceStatus === 'Compliant' ? 'text-green-600' : contract.complianceStatus === 'Partially Compliant' ? 'text-amber-600' : 'text-red-600'} />{contract.complianceStatus}</span>} />
          <Kv k="Renewal Eligible" v={contract.renewalEligible ? 'Yes' : 'No'} />
          <Kv k="Status" v={isExpiringSoon(contract) ? 'Expiring Soon' : contract.status} />
          <Kv k="Last Updated" v={fmtDateTime(contract.updatedAt)} />
        </div>
      )}

      {/* Scope */}
      {tab === 'Scope of Work' && (
        <div>
          <div className="text-[13px] text-slate-700 leading-relaxed whitespace-pre-wrap">{contract.scope}</div>
          <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200 p-3 text-[12px] text-slate-600">
            <div className="font-bold text-navy mb-1">Compliance status</div>
            {contract.complianceStatus === 'Compliant'
              ? 'All statutory and safety requirements for this contract are up to date.'
              : contract.complianceStatus === 'Partially Compliant'
                ? 'Some compliance items are pending renewal or verification. Check the Documents tab.'
                : 'This contract has outstanding compliance gaps that require attention.'}
          </div>
        </div>
      )}

      {/* Milestones */}
      {tab === 'Milestones' && (
        <MilestoneList contract={contract} milestones={milestones} />
      )}

      {/* Documents */}
      {tab === 'Documents' && (
        <DocumentList contractId={contract.id} documents={documents} />
      )}

      {/* Activity */}
      {tab === 'Activity History' && (
        <div>
          {activity.length === 0 ? (
            <div className="py-8 text-center text-[13px] text-slate-500">No activity recorded for this contract yet.</div>
          ) : (
            <ul className="space-y-2.5">
              {activity.map((a) => (
                <li key={a.id} className="flex gap-2.5">
                  <span className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5"><Activity size={14} /></span>
                  <span className="min-w-0">
                    <span className="block text-[12px] font-bold text-navy">{a.kind}</span>
                    <span className="block text-[12px] text-slate-600">{a.description}</span>
                    <span className="block text-[11px] text-slate-400">{fmtDateTime(a.timestamp)} · {a.user}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </DetailDrawer>
  );
}

// ---------- Milestones sub-list with contractor actions ----------
function MilestoneList({ contract, milestones }: { contract: Contract; milestones: ContractMilestone[] }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadFor, setUploadFor] = useState<string | null>(null);

  if (milestones.length === 0) {
    return <div className="py-8 text-center text-[13px] text-slate-500">No milestones are linked to this contract.</div>;
  }
  return (
    <div>
      <p className="text-[11px] text-slate-400 mb-2">You can submit, attach documents or request clarification. Approval is a mine-office action.</p>
      <ul className="space-y-2">
        {milestones.map((m) => {
          const done = m.status === MilestoneStatus.Completed;
          return (
            <li key={m.id} className="border border-slate-200 rounded-xl p-3">
              <div className="flex items-start gap-2">
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${done ? 'bg-green-50 text-green-600' : m.status === MilestoneStatus.Overdue ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                  {done ? <CheckCircle2 size={15} /> : m.status === MilestoneStatus.Overdue ? <AlertTriangle size={15} /> : <FileText size={15} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-bold text-navy">{m.title}</div>
                  <div className="text-[12px] text-slate-500">{m.description}</div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap text-[11px]">
                    <span className="text-slate-400">Due {fmtDate(m.dueDate)}</span>
                    <span className={`badge ${done ? 'bg-green-100 text-green-700' : m.status === MilestoneStatus.Overdue ? 'bg-red-100 text-red-600' : dueTone(m.dueDate)}`}>
                      {done ? 'Submitted' : m.status === MilestoneStatus.Overdue ? 'Overdue' : dueLabel(m.dueDate)}
                    </span>
                    {m.documentRef && <span className="text-slate-400 flex items-center gap-1"><Paperclip size={11} />{m.documentRef}</span>}
                    {m.clarificationRequested && <span className="badge bg-amber-100 text-amber-700">Clarification requested</span>}
                  </div>
                  {m.submittedAt && <div className="text-[11px] text-green-600 mt-0.5">Submitted {fmtDateTime(m.submittedAt)} (awaiting operator approval)</div>}
                </div>
              </div>
              {!done && (
                <div className="flex flex-wrap gap-2 mt-2 pl-9">
                  <button disabled={busyId === m.id} onClick={() => { setBusyId(m.id); try { actions.updateMilestone(m.id, { submit: true }); } finally { setBusyId(null); } }}
                    className="text-[11px] font-bold text-blue-700 hover:bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1">
                    <CheckCircle2 size={12} /> {busyId === m.id ? 'Submitting…' : 'Mark as Submitted'}
                  </button>
                  <button onClick={() => { setUploadFor(m.id); setTimeout(() => fileRef.current?.click(), 0); }}
                    className="text-[11px] font-bold text-navy hover:bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1">
                    <Upload size={12} /> Upload Document
                  </button>
                  {!m.clarificationRequested && (
                    <button onClick={() => actions.updateMilestone(m.id, { clarify: true })}
                      className="text-[11px] font-bold text-amber-700 hover:bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1">
                      <AlertTriangle size={12} /> Request Clarification
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <input ref={fileRef} type="file" className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f && uploadFor) actions.updateMilestone(uploadFor, { documentRef: f.name });
          setUploadFor(null); e.target.value = '';
        }} />
    </div>
  );
}

// ---------- Documents sub-list ----------
function DocumentList({ contractId, documents }: { contractId: string; documents: { id: string; name: string; category: string; sizeKb: number; uploadedAt: string; uploadedBy: string; mockRef: string }[] }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState('Other Supporting Document');
  const CATEGORIES = ['Contract Agreement', 'Work Order', 'Compliance Certificate', 'Other Supporting Document'];
  return (
    <div>
      <div className="flex flex-wrap items-end gap-2 mb-3">
        <label className="block flex-1 min-w-[150px]">
          <span className="block text-[12px] font-bold text-slate-600 mb-1">Category</span>
          <select className="input !py-2 !text-[13px]" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <button className="btn-primary !py-2 flex items-center gap-1.5" onClick={() => fileRef.current?.click()}><Upload size={15} /> Upload</button>
        <input ref={fileRef} type="file" className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) actions.uploadDocument(contractId, { name: f.name, sizeKb: Math.max(1, Math.round(f.size / 1024)) }, category);
            e.target.value = '';
          }} />
      </div>
      {documents.length === 0 ? (
        <div className="py-8 text-center text-[13px] text-slate-500">No documents uploaded for this contract yet.</div>
      ) : (
        <ul className="space-y-2">
          {documents.map((d) => (
            <li key={d.id} className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2.5">
              <FileText size={16} className="text-slate-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-bold text-navy truncate">{d.name}</div>
                <div className="text-[11px] text-slate-400">{d.category} · {fmtSize(d.sizeKb)} · {fmtDateTime(d.uploadedAt)} · {d.uploadedBy}</div>
              </div>
              <button onClick={() => alert(`Demo mode — this is a simulated document reference (${d.mockRef}). No file is served.`)}
                className="text-[11px] font-bold text-blue-700 hover:bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1 shrink-0">
                <Eye size={12} /> View
              </button>
              <button onClick={() => alert(`Demo mode — download is simulated (${d.mockRef}). Connect the FastAPI endpoint to serve real files.`)}
                className="text-[11px] font-bold text-navy hover:bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1 shrink-0">
                <Download size={12} /> Download
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
