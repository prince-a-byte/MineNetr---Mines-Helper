'use client';
/**
 * Shared operations form modals. The dashboard quick actions and the
 * dedicated pages use these same components, so a workflow behaves
 * identically wherever it is started. All saves go through the central
 * store actions (validation + audit + cross-page updates).
 */
import { useState } from 'react';
import { Field, Modal } from './ui';
import { TODAY } from './hooks';
import { actions, allowedMines, stockCurrent, useMockOps } from '../../lib/ops/store';
import { AccessStatus, TrainingStatus } from '../../lib/ops/types';

function FormError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <div className="text-[12px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-2" role="alert">{msg}</div>;
}

// ---------- Add Worker (workflow 1) ----------
export function AddWorkerModal({ mineId, onClose }: { mineId: string; onClose: () => void }) {
  const db = useMockOps();
  const scope = mineId === 'ALL' ? allowedMines()[0].id : mineId;
  const [f, setF] = useState({ name: '', code: `WK-${String(db.workers.length + 1).padStart(3, '0')}`, contractorId: db.contractors[0]?.id ?? '', role: 'Helper', joinedOn: TODAY, phone: '', trainingStatus: TrainingStatus.Valid });
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const ctrs = db.contractors.filter((c) => (mineId === 'ALL' || c.mineIds.includes(mineId)) && c.status !== 'Inactive');

  function submit() {
    const e: Record<string, string> = {};
    if (!f.name.trim()) e.name = 'Worker name is required.';
    if (!/^WK-\d{3,4}$/i.test(f.code.trim())) e.code = 'Format: WK-000.';
    if (db.workers.some((w) => w.code.toLowerCase() === f.code.trim().toLowerCase())) e.code = 'This Worker ID already exists.';
    if (!f.phone.trim() || f.phone.trim().length < 10) e.phone = 'Enter a valid phone number.';
    setErr(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      actions.createWorker({
        name: f.name.trim(), code: f.code.trim().toUpperCase(), contractorId: f.contractorId || null,
        mineId: scope, role: f.role, skill: f.role, joinedOn: f.joinedOn,
        trainingStatus: f.trainingStatus,
        accessStatus: f.trainingStatus === TrainingStatus.Valid || f.trainingStatus === TrainingStatus.ExpiringSoon ? AccessStatus.Allowed : AccessStatus.Blocked,
        phone: f.phone.trim(),
      });
      onClose();
    } catch (ex: any) { setErr({ form: ex.message }); } finally { setBusy(false); }
  }

  return (
    <Modal title="Add Worker" onClose={onClose}>
      <p className="text-[11px] text-slate-400 mb-3">Synthetic identifiers only. Saving updates the worker registry, contractor manpower and dashboard KPIs immediately.</p>
      <FormError msg={err.form} />
      <div className="grid sm:grid-cols-2 gap-x-3">
        <Field label="Worker name *" error={err.name}>
          <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Ravi Kumar" />
        </Field>
        <Field label="Worker ID *" error={err.code} hint="Format: WK-000 (unique)">
          <input className="input" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} />
        </Field>
        <Field label="Contractor">
          <select className="input" value={f.contractorId} onChange={(e) => setF({ ...f, contractorId: e.target.value })}>
            <option value="">Direct (mine workforce)</option>
            {ctrs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Role / trade">
          <select className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
            {['Helper', 'Driller', 'Blaster', 'Dumper Driver', 'Loader Operator', 'Excavator Operator', 'Electrician', 'Fitter', 'Welder', 'Mechanic', 'Supervisor', 'Surveyor'].map((r) => <option key={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="Joining date">
          <input type="date" className="input" value={f.joinedOn} onChange={(e) => setF({ ...f, joinedOn: e.target.value })} />
        </Field>
        <Field label="Phone *" error={err.phone}>
          <input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="+91-9xxxx-xxxxx" />
        </Field>
        <Field label="Training status" hint="Expired / Not trained blocks access automatically">
          <select className="input" value={f.trainingStatus} onChange={(e) => setF({ ...f, trainingStatus: e.target.value as TrainingStatus })}>
            {Object.values(TrainingStatus).map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
      </div>
      <div className="flex gap-2 justify-end">
        <button className="btn-primary !bg-white !text-navy border border-slate-300" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={submit} disabled={busy}>{busy ? 'Saving…' : 'Add Worker'}</button>
      </div>
    </Modal>
  );
}

// ---------- Record Production ----------
export function RecordProductionModal({ mineId, onClose }: { mineId: string; onClose: () => void }) {
  const db = useMockOps();
  const scope = mineId === 'ALL' ? allowedMines()[0].id : mineId;
  const sps = db.stockpiles.filter((s) => s.mineId === scope);
  const [f, setF] = useState({ stockpileId: sps[0]?.id ?? '', quantityMt: '', shift: 'Morning', source: 'Pit I — Dumper Fleet', remarks: '' });
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  function submit() {
    const e: Record<string, string> = {};
    const q = Number(f.quantityMt);
    if (!f.quantityMt || !(q > 0)) e.quantityMt = 'Enter a quantity greater than 0.';
    if (!f.stockpileId) e.stockpileId = 'Choose a stockpile.';
    setErr(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      actions.createProduction({
        date: TODAY, mineId: scope, stockpileId: f.stockpileId, quantityMt: q,
        grade: db.stockpiles.find((s) => s.id === f.stockpileId)?.grade ?? 'Mixed',
        shift: f.shift, source: f.source, remarks: f.remarks,
      });
      onClose();
    } catch (ex: any) { setErr({ form: ex.message }); } finally { setBusy(false); }
  }

  return (
    <Modal title="Record Production" onClose={onClose}>
      <p className="text-[11px] text-slate-400 mb-3">Adds a production entry and stockpile in-flow. Updates production KPIs, charts and Stockpile Management.</p>
      <FormError msg={err.form} />
      <Field label="Stockpile *" error={err.stockpileId}>
        <select className="input" value={f.stockpileId} onChange={(e) => setF({ ...f, stockpileId: e.target.value })}>
          {sps.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code}) — available {stockCurrent(s.id, db)} MT</option>)}
        </select>
      </Field>
      <div className="grid sm:grid-cols-2 gap-x-3">
        <Field label="Quantity (MT) *" error={err.quantityMt}>
          <input className="input" type="number" min={0} value={f.quantityMt} onChange={(e) => setF({ ...f, quantityMt: e.target.value })} placeholder="e.g. 850" />
        </Field>
        <Field label="Shift">
          <select className="input" value={f.shift} onChange={(e) => setF({ ...f, shift: e.target.value })}>{['Morning', 'Afternoon', 'Night'].map((s) => <option key={s}>{s}</option>)}</select>
        </Field>
        <Field label="Production source">
          <select className="input" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })}>{['Pit I — Dumper Fleet', 'Pit II — Dragline', 'Pit III — Loader Fleet', 'UG Section A'].map((s) => <option key={s}>{s}</option>)}</select>
        </Field>
        <Field label="Date">
          <input className="input bg-slate-50" value="03 Oct 2026 (demo today)" readOnly />
        </Field>
      </div>
      <Field label="Remarks">
        <textarea className="input" rows={2} value={f.remarks} onChange={(e) => setF({ ...f, remarks: e.target.value })} />
      </Field>
      <div className="flex gap-2 justify-end">
        <button className="btn-primary !bg-white !text-navy border border-slate-300" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={submit} disabled={busy}>{busy ? 'Saving…' : 'Record Production'}</button>
      </div>
    </Modal>
  );
}

// ---------- Upload Document ----------
export function UploadDocModal({ mineId, onClose, presetCategory }: { mineId: string; onClose: () => void; presetCategory?: string }) {
  const [f, setF] = useState({ name: '', category: presetCategory ?? 'Statutory Licence', refNo: '', issueDate: TODAY, expiryDate: '', description: '', fileName: '' });
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const scope = mineId === 'ALL' ? 'M-01' : mineId;

  function submit() {
    const e: Record<string, string> = {};
    if (!f.name.trim()) e.name = 'Title is required.';
    if (!f.refNo.trim()) e.refNo = 'Reference number is required.';
    if (f.expiryDate && f.expiryDate < f.issueDate) e.expiryDate = 'Expiry cannot be before issue date.';
    setErr(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      actions.createDocument({
        name: f.name.trim(), category: f.category, mineId: scope, relatedKind: 'Mine', relatedId: scope,
        refNo: f.refNo.trim(), issueDate: f.issueDate, expiryDate: f.expiryDate || null, description: f.description,
        file: f.fileName ? { name: f.fileName, sizeKb: 48, uploadedAt: new Date().toISOString() } : null,
      });
      onClose();
    } catch (ex: any) { setErr({ form: ex.message }); } finally { setBusy(false); }
  }

  return (
    <Modal title="Upload Document" onClose={onClose}>
      <p className="text-[11px] text-slate-400 mb-3">Files stay in browser demo storage — nothing is uploaded to any server.</p>
      <FormError msg={err.form} />
      <div className="grid sm:grid-cols-2 gap-x-3">
        <Field label="Document title *" error={err.name}>
          <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="Category">
          <select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
            {['Statutory Licence', 'Safety', 'Environment', 'Equipment', 'Contractor', 'Worker', 'Compliance', 'Other'].map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Reference no. *" error={err.refNo}>
          <input className="input" value={f.refNo} onChange={(e) => setF({ ...f, refNo: e.target.value })} placeholder="e.g. ML/BCM/2026" />
        </Field>
        <Field label="Expiry date" error={err.expiryDate}>
          <input type="date" className="input" value={f.expiryDate} onChange={(e) => setF({ ...f, expiryDate: e.target.value })} />
        </Field>
        <Field label="Issue date">
          <input type="date" className="input" value={f.issueDate} onChange={(e) => setF({ ...f, issueDate: e.target.value })} />
        </Field>
        <Field label="File (demo)">
          <input type="file" className="input !py-1.5 !text-[12px]" onChange={(e) => setF({ ...f, fileName: e.target.files?.[0]?.name ?? '' })} />
        </Field>
      </div>
      <Field label="Description">
        <textarea className="input" rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
      </Field>
      <div className="flex gap-2 justify-end">
        <button className="btn-primary !bg-white !text-navy border border-slate-300" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={submit} disabled={busy}>{busy ? 'Saving…' : 'Upload Document'}</button>
      </div>
    </Modal>
  );
}
