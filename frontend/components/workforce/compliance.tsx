'use client';
/**
 * Non-Compliance Register + corrective-action workflow
 * (shown on the Documents & Compliance page).
 *
 * Implements the split of duties from the compliance spec:
 *   - the contractor raises/acknowledges incidents, comments, creates corrective
 *     actions and submits evidence,
 *   - an inspector / mine admin assigns, reviews and resolves or dismisses.
 *
 * Every control calls a real store action (all wrapped in try/catch with the
 * store's human-readable error surfaced inline). Nothing is mocked locally.
 */
import { useMemo, useState } from 'react';
import {
  ArrowRight, CheckCircle2, FileWarning, Plus,
  ShieldAlert, UserCheck, XCircle,
} from 'lucide-react';
import {
  actions, contractorName, filterIncidents, mineCode, mineLabel,
  useMockWorkforce, type WorkforceDbState,
} from '../../lib/workforce/store';
import {
  DEMO_TODAY, INCIDENT_CATEGORIES, IncidentStatus, Severity,
} from '../../lib/workforce/types';
import { fmtDate, relTime } from '../../lib/workforce/format';
import {
  DetailDrawer, EmptyState, Field, Modal, Pill, PermBtn,
  SearchInput, SectionCard, Stat, DataTable, type Column,
} from './ui';

const INSPECTORS = ['K. Ravi (DGMS)', 'S. Chandra', 'Meena Bhagat', 'A. K. Singh'];

const SEV_TILE: Record<string, string> = {
  Low: 'bg-slate-100 text-slate-600',
  Medium: 'bg-sky-100 text-sky-700',
  High: 'bg-amber-100 text-amber-700',
  Critical: 'bg-red-100 text-red-600',
};

/** Every risky action is tried/catch'd; the store message is shown inline. */
function useActionError() {
  const [error, setError] = useState('');
  const run = (fn: () => void, okMessage?: string) => {
    try { fn(); setError(''); if (okMessage) setError(''); return true; }
    catch (e) { setError((e as Error).message); return false; }
  };
  return { error, setError, run };
}

// ---------- Raise incident ----------
function RaiseIncidentModal({ db, onClose }: { db: WorkforceDbState; onClose: () => void }) {
  const { error, run } = useActionError();
  const mine = db.selectedMineId === 'ALL' ? 'M-01' : db.selectedMineId;
  const [contractorId, setContractorId] = useState(db.contractors[0]?.id ?? '');
  const [workerId, setWorkerId] = useState('');
  const [category, setCategory] = useState<string>(INCIDENT_CATEGORIES[0]);
  const [severity, setSeverity] = useState<Severity>(Severity.Medium);
  const [description, setDescription] = useState('');
  const [inspector, setInspector] = useState(INSPECTORS[0]);
  const [local, setLocal] = useState('');

  const submit = () => {
    if (!description.trim()) { setLocal('A description of the non-compliance is required.'); return; }
    setLocal('');
    const ok = run(() => actions.createIncident({
      workerId: workerId || null, contractorId, mineId: mine,
      category, severity, description, inspector,
    }));
    if (ok) onClose();
  };

  return (
    <Modal title="Raise Non-Compliance Incident" onClose={onClose} wide>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Contractor">
          <select className="input" value={contractorId} onChange={(e) => setContractorId(e.target.value)}>
            {db.contractors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Worker (optional)" hint="Leave blank for contractor-level issues.">
          <select className="input" value={workerId} onChange={(e) => setWorkerId(e.target.value)}>
            <option value="">— Contractor-level —</option>
            {db.workers.filter((w) => w.contractorId === contractorId).slice(0, 120)
              .map((w) => <option key={w.id} value={w.id}>{w.id} · {w.name}</option>)}
          </select>
        </Field>
        <Field label="Category">
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
            {INCIDENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Severity">
          <select className="input" value={severity} onChange={(e) => setSeverity(e.target.value as Severity)}>
            {Object.values(Severity).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Assign to inspector">
          <select className="input" value={inspector} onChange={(e) => setInspector(e.target.value)}>
            {INSPECTORS.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </Field>
        <Field label="Mine">
          <input className="input" value={mineLabel(mine)} disabled />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Description" error={local}>
            <textarea className="input min-h-[84px]" value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What was found, where, and what evidence supports it." />
          </Field>
        </div>
      </div>
      {error && (
        <div role="alert" className="mt-3 text-[12px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}
      <div className="flex items-center justify-between gap-2 mt-4">
        <p className="text-[11px] text-slate-400 max-w-md">
          Raising an incident is recorded in the audit trail and notifies the assigned inspector.
        </p>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <PermBtn perm="incident.create" onClick={submit} className="btn-primary">
            <span className="flex items-center gap-1.5"><Plus size={14} /> Raise incident</span>
          </PermBtn>
        </div>
      </div>
    </Modal>
  );
}

// ---------- Corrective action editor ----------
function CorrectiveActionModal({ db, incidentId, ca, onClose }: {
  db: WorkforceDbState; incidentId: string; ca?: WorkforceDbState['correctiveActions'][number]; onClose: () => void;
}) {
  const { error, run } = useActionError();
  const [description, setDescription] = useState(ca?.description ?? '');
  const [assignedTo, setAssignedTo] = useState(ca?.assignedTo ?? contractorName(db.incidents.find((i) => i.id === incidentId)?.contractorId ?? ''));
  const [dueDate, setDueDate] = useState(ca?.dueDate ?? '2026-10-20');
  const [note, setNote] = useState('');
  const [evidenceRef, setEvidenceRef] = useState(ca?.evidenceRef ?? '');
  const [local, setLocal] = useState('');

  const submit = (asSubmitted: boolean) => {
    if (ca) {
      setLocal('');
      const ok = run(() => actions.updateCorrectiveAction(ca.id, {
        note: note.trim() || undefined,
        evidenceRef: evidenceRef.trim() || undefined,
        submit: asSubmitted,
      }));
      if (ok) onClose();
      return;
    }
    if (!description.trim()) { setLocal('Describe the corrective action.'); return; }
    if (!assignedTo.trim()) { setLocal('Assign the action to a responsible party.'); return; }
    if (dueDate < DEMO_TODAY) { setLocal('Due date cannot be in the past.'); return; }
    setLocal('');
    const ok = run(() => actions.createCorrectiveAction(incidentId, { description, assignedTo, dueDate }));
    if (ok) onClose();
  };

  return (
    <Modal title={ca ? `Corrective Action ${ca.id}` : 'Create Corrective Action'} onClose={onClose} wide>
      {ca && (
        <div className="mb-3 rounded-xl border border-slate-200 p-3">
          <div className="text-[12px] font-bold text-navy">{ca.description}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Assigned to {ca.assignedTo} · due {fmtDate(ca.dueDate)} · status <Pill v={ca.status} />
          </div>
        </div>
      )}
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <Field label="Description" error={local}>
            <textarea className="input min-h-[76px]" value={description} disabled={!!ca}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Re-induct the worker and upload the fresh induction certificate." />
          </Field>
        </div>
        <Field label="Responsible party">
          <input className="input" value={assignedTo} disabled={!!ca} onChange={(e) => setAssignedTo(e.target.value)} />
        </Field>
        <Field label="Due date">
          <input type="date" className="input" value={dueDate} disabled={!!ca} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
        <Field label="Progress note" hint="Appended to the incident timeline.">
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="What has been done so far?" />
        </Field>
        <Field label="Evidence reference" hint="Required before submitting for review.">
          <input className="input" value={evidenceRef} onChange={(e) => setEvidenceRef(e.target.value)}
            placeholder="e.g. re-induction-certificate-2026-10-03.pdf" />
        </Field>
      </div>
      {error && (
        <div role="alert" className="mt-3 text-[12px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}
      <div className="flex items-center justify-between gap-2 mt-4">
        <p className="text-[11px] text-slate-400 max-w-md">
          Submitting sends the action to the inspector for review — the contractor cannot mark it resolved itself.
        </p>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          {!ca && (
            <PermBtn perm="incident.action" onClick={() => submit(false)} className="btn-secondary">
              Create only
            </PermBtn>
          )}
          <PermBtn perm="incident.action" onClick={() => submit(true)} className="btn-primary">
            <span className="flex items-center gap-1.5"><CheckCircle2 size={14} /> {ca ? 'Submit for review' : 'Create & submit'}</span>
          </PermBtn>
        </div>
      </div>
    </Modal>
  );
}

// ---------- Incident drawer ----------
function IncidentDrawer({ db, id, onClose }: { db: WorkforceDbState; id: string; onClose: () => void }) {
  const inc = db.incidents.find((x) => x.id === id);
  const { error, setError, run } = useActionError();
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState<IncidentStatus | null>(null);
  const [resolution, setResolution] = useState('');
  const [assignTo, setAssignTo] = useState('');
  const [caEditor, setCaEditor] = useState<{ ca?: WorkforceDbState['correctiveActions'][number] } | null>(null);

  if (!inc) return null;
  const cas = db.correctiveActions.filter((c) => c.incidentId === inc.id);
  const worker = inc.workerId ? db.workers.find((w) => w.id === inc.workerId) : undefined;

  return (
    <>
      <DetailDrawer title={`${inc.id} · ${inc.category}`} onClose={onClose} wide>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Pill v={inc.status} />
          <Pill v={inc.severity} />
          <span className="text-[11px] text-slate-500">Detected {fmtDate(inc.dateDetected)} · {mineLabel(inc.mineId)}</span>
        </div>
        <p className="text-[13px] text-navy mb-3">{inc.description}</p>

        <div className="grid sm:grid-cols-2 gap-3 mb-4">
          <div className="rounded-xl border border-slate-200 p-3">
            <div className="text-[11px] font-semibold text-slate-500">Contractor</div>
            <div className="text-[13px] font-bold text-navy">{contractorName(inc.contractorId)}</div>
            <div className="text-[11px] text-slate-400 mt-1">
              {worker ? `Worker ${worker.id} · ${worker.name}` : 'Contractor-level issue (no single worker)'}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 p-3">
            <div className="text-[11px] font-semibold text-slate-500">Inspector</div>
            <div className="text-[13px] font-bold text-navy">{inc.inspector}</div>
            <div className="flex gap-1.5 mt-2">
              <select className="input !py-1 !text-[12px] !w-auto" value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
                <option value="">Reassign to…</option>
                {INSPECTORS.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
              <PermBtn perm="incident.decide" className="btn-secondary !py-1 !text-[12px]"
                onClick={() => run(() => actions.assignInspector(inc.id, assignTo || inc.inspector))}>
                Assign
              </PermBtn>
            </div>
          </div>
        </div>

        {/* Evidence */}
        <div className="mb-4">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Evidence</div>
          {inc.evidence.length === 0
            ? <p className="text-[12px] text-slate-400">No evidence attached yet.</p>
            : (
              <ul className="space-y-1">
                {inc.evidence.map((e) => (
                  <li key={e} className="text-[12px] text-navy flex items-center gap-1.5">
                    <FileWarning size={13} className="text-slate-400" /> {e}
                  </li>
                ))}
              </ul>
            )}
        </div>

        {/* Corrective actions */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Corrective actions</span>
            <PermBtn perm="incident.action" className="btn-secondary !py-1 !text-[12px]"
              onClick={() => setCaEditor({})}>
              <span className="flex items-center gap-1"><Plus size={13} /> Add</span>
            </PermBtn>
          </div>
          {cas.length === 0
            ? <p className="text-[12px] text-slate-400">No corrective action has been created for this incident.</p>
            : (
              <div className="space-y-2">
                {cas.map((c) => (
                  <div key={c.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-[12px] font-semibold text-navy">{c.description}</div>
                      <Pill v={c.status} />
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      {c.assignedTo} · due {fmtDate(c.dueDate)}
                      {c.evidenceRef ? ` · evidence: ${c.evidenceRef}` : ' · no evidence attached'}
                      {c.reviewerNote ? ` · reviewer: ${c.reviewerNote}` : ''}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <PermBtn perm="incident.action" className="btn-secondary !py-1 !text-[12px]"
                        onClick={() => setCaEditor({ ca: c })}>
                        Update / submit
                      </PermBtn>
                      <PermBtn perm="incident.decide" className="btn-secondary !py-1 !text-[12px]"
                        onClick={() => run(() => actions.reviewCorrectiveAction(c.id, true, 'Evidence verified in the contractor workspace (demo).'))}>
                        Approve
                      </PermBtn>
                      <PermBtn perm="incident.decide" className="btn-secondary !py-1 !text-[12px]"
                        onClick={() => run(() => actions.reviewCorrectiveAction(c.id, false, 'Evidence insufficient — please resubmit.'))}>
                        Send back
                      </PermBtn>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>

        {/* Timeline */}
        <div className="mb-4">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Timeline</div>
          <ol className="space-y-2">
            {inc.timeline.map((t, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1 w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                <span>
                  <span className="block text-[12px] text-navy">{t.note}</span>
                  <span className="block text-[11px] text-slate-400">{t.by} · {relTime(t.at)}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        {/* Comment */}
        <Field label="Add a comment">
          <div className="flex gap-2">
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="Add context or a response to the inspector." />
            <PermBtn perm="incident.comment" className="btn-secondary shrink-0"
              onClick={() => { if (note.trim() && run(() => actions.commentIncident(inc.id, note.trim()))) setNote(''); }}>
              Add
            </PermBtn>
          </div>
        </Field>

        {error && (
          <div role="alert" className="mt-3 text-[12px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-start justify-between gap-2">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-600" aria-label="Dismiss">✕</button>
          </div>
        )}

        {inc.resolution && (
          <div className="mt-3 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-[12px] text-emerald-800">
            <span className="font-bold">Resolution:</span> {inc.resolution}
          </div>
        )}

        <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-slate-200">
          <PermBtn perm="incident.decide" className="btn-secondary" disabled={inc.status === IncidentStatus.Resolved}
            onClick={() => run(() => actions.setIncidentStatus(inc.id, IncidentStatus.UnderReview))}>
            <span className="flex items-center gap-1.5"><ArrowRight size={14} /> Mark under review</span>
          </PermBtn>
          <PermBtn perm="incident.decide" className="btn-secondary" disabled={inc.status === IncidentStatus.Resolved}
            onClick={() => setConfirm(IncidentStatus.Resolved)}>
            <span className="flex items-center gap-1.5"><CheckCircle2 size={14} /> Resolve</span>
          </PermBtn>
          <PermBtn perm="incident.decide" className="btn-secondary" disabled={inc.status === IncidentStatus.Dismissed}
            onClick={() => setConfirm(IncidentStatus.Dismissed)}>
            <span className="flex items-center gap-1.5"><XCircle size={14} /> Dismiss</span>
          </PermBtn>
        </div>
        <p className="text-[11px] text-slate-400 mt-2">
          Resolve/Dismiss is an inspector or mine-admin action and requires a resolution note.
        </p>
      </DetailDrawer>

      {confirm && (
        <Modal
          title={confirm === IncidentStatus.Resolved ? 'Resolve this incident?' : 'Dismiss this incident?'}
          onClose={() => { setConfirm(null); setResolution(''); }}
        >
          <p className="text-[13px] text-navy mb-3">
            {confirm === IncidentStatus.Resolved
              ? 'Resolving records that the corrective action was verified against site records.'
              : 'Dismissing records that no substantive non-compliance was found after review.'}
          </p>
          <Field label="Resolution note" hint="Required.">
            <textarea className="input min-h-[64px]" value={resolution} onChange={(e) => setResolution(e.target.value)} />
          </Field>
          {error && (
            <div role="alert" className="mt-2 text-[12px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2 mt-4">
            <button className="btn-secondary" onClick={() => { setConfirm(null); setResolution(''); }}>Cancel</button>
            <PermBtn perm="incident.decide" className="btn-primary"
              onClick={() => {
                const ok = run(() => actions.setIncidentStatus(inc.id, confirm, resolution.trim() || undefined));
                if (ok) { setConfirm(null); setResolution(''); }
              }}>
              {confirm === IncidentStatus.Resolved ? 'Resolve incident' : 'Dismiss incident'}
            </PermBtn>
          </div>
        </Modal>
      )}

      {caEditor && (
        <CorrectiveActionModal db={db} incidentId={inc.id} ca={caEditor.ca} onClose={() => setCaEditor(null)} />
      )}
    </>
  );
}

// ---------- Section ----------
export function ComplianceRegister() {
  const db = useMockWorkforce();
  const [q, setQ] = useState('');
  const [applied, setApplied] = useState('');
  const [status, setStatus] = useState('ALL');
  const [category, setCategory] = useState('ALL');
  const [severity, setSeverity] = useState('ALL');
  const [contractorId, setContractorId] = useState('ALL');
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [raise, setRaise] = useState(false);

  const rows = useMemo(
    () => filterIncidents(db, db.incidents, {
      mineId: db.selectedMineId, tab: 'All', category, severity, status, contractorId, from: '', to: '',
    }, applied),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db, applied, status, category, severity, contractorId],
  );

  const counts = useMemo(() => {
    const scoped = db.incidents.filter((i) => db.selectedMineId === 'ALL' || i.mineId === db.selectedMineId);
    return {
      open: scoped.filter((i) => i.status === IncidentStatus.Open).length,
      review: scoped.filter((i) => i.status === IncidentStatus.UnderReview).length,
      action: scoped.filter((i) => i.status === IncidentStatus.ActionRequired).length,
      resolved: scoped.filter((i) => i.status === IncidentStatus.Resolved).length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db]);

  const columns: Column<WorkforceDbState['incidents'][number]>[] = [
    {
      key: 'id', header: 'Incident', render: (i) => (
        <div className="flex items-center gap-2">
          <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${SEV_TILE[i.severity]}`}>
            <ShieldAlert size={14} />
          </span>
          <span>
            <span className="block text-[12px] font-bold text-navy">{i.id}</span>
            <span className="block text-[11px] text-slate-400">{i.category}</span>
          </span>
        </div>
      ), sortValue: (i) => i.id,
    },
    { key: 'desc', header: 'Description', render: (i) => <span className="text-[12px] text-navy max-w-[260px] block truncate" title={i.description}>{i.description}</span>, sortValue: (i) => i.description },
    { key: 'contractor', header: 'Contractor', render: (i) => <span className="text-[12px]">{contractorName(i.contractorId)}</span>, sortValue: (i) => contractorName(i.contractorId) },
    { key: 'mine', header: 'Mine', render: (i) => <span className="text-[12px]">{mineCode(i.mineId)}</span>, sortValue: (i) => i.mineId },
    { key: 'severity', header: 'Severity', render: (i) => <Pill v={i.severity} />, sortValue: (i) => Object.values(Severity).indexOf(i.severity) },
    { key: 'status', header: 'Status', render: (i) => <Pill v={i.status} />, sortValue: (i) => i.status },
    { key: 'inspector', header: 'Inspector', render: (i) => <span className="text-[12px]">{i.inspector}</span>, sortValue: (i) => i.inspector },
    { key: 'date', header: 'Detected', render: (i) => <span className="text-[12px]">{fmtDate(i.dateDetected)}</span>, sortValue: (i) => i.dateDetected },
    {
      key: 'actions', header: '', thClass: '!text-right', render: (i) => (
        <button onClick={() => setDrawerId(i.id)} className="text-[12px] font-bold text-blue-600 hover:underline">Open</button>
      ),
    },
  ];

  return (
    <div className="mt-4">
      <SectionCard
        title="Non-Compliance Register"
        subtitle="Raise incidents, create corrective actions and track them to closure."
        action={
          <PermBtn perm="incident.create" onClick={() => setRaise(true)} className="btn-primary !py-1.5 !px-3 !text-[12px]">
            <span className="flex items-center gap-1.5"><Plus size={14} /> Raise incident</span>
          </PermBtn>
        }
      >
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
          <Stat label="Open" value={counts.open} cls={counts.open ? 'text-red-600' : 'text-slate-400'} />
          <Stat label="Under Review" value={counts.review} cls={counts.review ? 'text-amber-600' : 'text-slate-400'} />
          <Stat label="Action Required" value={counts.action} cls={counts.action ? 'text-orange-600' : 'text-slate-400'} />
          <Stat label="Resolved" value={counts.resolved} cls={counts.resolved ? 'text-emerald-600' : 'text-slate-400'} />
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <SearchInput value={q} onChange={setQ} onSearch={() => setApplied(q)} ph="Search id, category, contractor…" width="!w-64" />
          <select className="input !w-40 !py-2 !text-[13px]" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
            <option value="ALL">All statuses</option>
            {Object.values(IncidentStatus).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="input !w-44 !py-2 !text-[13px]" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
            <option value="ALL">All categories</option>
            {INCIDENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="input !w-36 !py-2 !text-[13px]" value={severity} onChange={(e) => setSeverity(e.target.value)} aria-label="Severity">
            <option value="ALL">All severities</option>
            {Object.values(Severity).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="input !w-52 !py-2 !text-[13px]" value={contractorId} onChange={(e) => setContractorId(e.target.value)} aria-label="Contractor">
            <option value="ALL">All contractors</option>
            {db.contractors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button className="btn-secondary !py-2 !text-[13px]"
            onClick={() => { setQ(''); setApplied(''); setStatus('ALL'); setCategory('ALL'); setSeverity('ALL'); setContractorId('ALL'); }}>
            Reset
          </button>
          <span className="text-[11px] text-slate-400 ml-auto">{rows.length} of {db.incidents.length} incidents</span>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            title="No incidents match these filters"
            sub="Try clearing the filters, or raise a new incident if a non-compliance was observed."
            action={<button className="btn-secondary" onClick={() => { setQ(''); setApplied(''); setStatus('ALL'); setCategory('ALL'); setSeverity('ALL'); setContractorId('ALL'); }}>Clear filters</button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <DataTable columns={columns} rows={rows} initialSize={10} onRowClick={(i) => setDrawerId(i.id)} />
          </div>
        )}

        <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1.5">
          <UserCheck size={13} />
          Split of duties: the contractor responds and submits evidence; resolving or dismissing is an inspector or mine-admin action.
          Acting as <span className="font-bold">{db.role}</span>.
        </p>
      </SectionCard>

      {drawerId && <IncidentDrawer db={db} id={drawerId} onClose={() => setDrawerId(null)} />}
      {raise && <RaiseIncidentModal db={db} onClose={() => setRaise(false)} />}
    </div>
  );
}
