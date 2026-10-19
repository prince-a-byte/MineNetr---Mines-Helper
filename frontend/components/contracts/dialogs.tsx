'use client';
/**
 * Contractor "My Contracts" dialogs — New Contract Request (3-step), Renewal
 * Request, Export and Filters. Every dialog validates, shows a submitting
 * state, prevents duplicate submissions and calls the centralized repository
 * (never local component state) so the new record appears everywhere at once.
 */
import { useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Check, CheckCircle2, Download, FileText, Filter, Paperclip,
  RotateCcw, Search, Upload, X,
} from 'lucide-react';
import { Field, Kv, Modal } from '../operations/ui';
import {
  Currency, RequestStatus, type Contract, type ContractFilters, type Mine,
  type NewContractRequestInput, type RequestAttachment,
} from '../../lib/contracts/types';
import { actions, allowedMines, mineLabel } from '../../lib/contracts/store';
import { fmtDate, fmtSize, inr } from '../../lib/contracts/format';
import { exportCsv } from '../../lib/contracts/export';

// Full work-type catalogue a contractor may request.
const WORK_TYPES = [
  'Overburden Removal', 'Coal Transportation', 'Equipment Maintenance', 'Site Services',
  'Exploration Support', 'Coal Washery Maintenance', 'Security & Surveillance',
  'Drill & Blast Support', 'Vegetation & Reclamation',
];

// ---------- Shared file-attachment picker (mock local reference) ----------
function AttachmentPicker({ files, onAdd, onRemove }: {
  files: RequestAttachment[]; onAdd: (f: RequestAttachment) => void; onRemove: (i: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState('Other Supporting Document');
  const CATEGORIES = ['Company Profile', 'Work Experience', 'Equipment List', 'Compliance Certificate', 'Other Supporting Document'];
  return (
    <div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="block flex-1 min-w-[160px]">
          <span className="block text-[12px] font-bold text-slate-600 mb-1">Document category</span>
          <select className="input !py-2 !text-[13px]" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <button type="button" onClick={() => inputRef.current?.click()}
          className="btn-primary !py-2 flex items-center gap-1.5"><Upload size={15} /> Attach file</button>
        <input ref={inputRef} type="file" className="hidden" multiple
          onChange={(e) => {
            const list = Array.from(e.target.files ?? []);
            list.forEach((f) => onAdd({
              name: f.name, sizeKb: Math.max(1, Math.round(f.size / 1024)), category,
              mockRef: `mock://att/${Date.now()}-${f.name}`,
            }));
            e.target.value = '';
          }} />
      </div>
      <p className="text-[11px] text-slate-400 mt-1.5">Demo mode stores local file metadata only — no server upload occurs.</p>
      {files.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 text-[12px]">
              <Paperclip size={14} className="text-slate-400 shrink-0" />
              <span className="min-w-0 flex-1 truncate font-semibold text-navy">{f.name}</span>
              <span className="text-slate-400 shrink-0">{f.category}</span>
              <span className="text-slate-400 shrink-0">{fmtSize(f.sizeKb)}</span>
              <button type="button" onClick={() => onRemove(i)} aria-label={`Remove ${f.name}`}
                className="text-slate-400 hover:text-red-600 shrink-0"><X size={14} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ================= New Contract Request (3-step) =================
type RequestForm = {
  mineId: string; workType: string; proposedTitle: string; scopeOfWork: string;
  proposedStartDate: string; proposedEndDate: string; estimatedValue: string;
  currency: Currency.INR; notes: string; attachments: RequestAttachment[];
};
const EMPTY_FORM: RequestForm = {
  mineId: '', workType: '', proposedTitle: '', scopeOfWork: '',
  proposedStartDate: '', proposedEndDate: '', estimatedValue: '', currency: Currency.INR,
  notes: '', attachments: [],
};

export function NewContractRequestDialog({ onClose, onSubmitted }: {
  onClose: () => void; onSubmitted: (id: string) => void;
}) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<RequestForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const mines = allowedMines();

  const set = <K extends keyof RequestForm>(k: K, v: RequestForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  function validateStep1(): boolean {
    const e: Record<string, string> = {};
    if (!form.mineId) e.mineId = 'Select a mine you are authorised for.';
    else if (!mines.some((m) => m.id === form.mineId)) e.mineId = 'You are not authorised for that mine.';
    if (!form.workType) e.workType = 'Select a work type.';
    if (!form.proposedTitle.trim()) e.proposedTitle = 'Enter a proposed contract title.';
    else if (form.proposedTitle.trim().length < 6) e.proposedTitle = 'Title must be at least 6 characters.';
    else if (form.proposedTitle.trim().length > 120) e.proposedTitle = 'Title must be under 120 characters.';
    if (!form.scopeOfWork.trim()) e.scopeOfWork = 'Describe the scope of work.';
    else if (form.scopeOfWork.trim().length < 20) e.scopeOfWork = 'Scope must be at least 20 characters.';
    if (!form.proposedStartDate) e.proposedStartDate = 'Select a proposed start date.';
    if (!form.proposedEndDate) e.proposedEndDate = 'Select a proposed end date.';
    if (form.proposedStartDate && form.proposedEndDate && form.proposedStartDate >= form.proposedEndDate)
      e.proposedEndDate = 'End date must be after the start date.';
    const val = Number(form.estimatedValue);
    if (!form.estimatedValue) e.estimatedValue = 'Enter an estimated contract value.';
    else if (!Number.isFinite(val) || val <= 0) e.estimatedValue = 'Estimated value must be a positive number.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit() {
    if (submitting) return; // duplicate-submission guard
    setSubmitError('');
    setSubmitting(true);
    try {
      const input: NewContractRequestInput = {
        mineId: form.mineId, workType: form.workType, proposedTitle: form.proposedTitle.trim(),
        scopeOfWork: form.scopeOfWork.trim(), proposedStartDate: form.proposedStartDate,
        proposedEndDate: form.proposedEndDate, estimatedValue: Number(form.estimatedValue),
        currency: Currency.INR, notes: form.notes.trim(), attachments: form.attachments,
      };
      const id = actions.createContractRequest(input);
      onSubmitted(id);
    } catch (err: any) {
      setSubmitError(err?.message || 'Could not submit the request.');
      setSubmitting(false);
    }
  }

  const STEPS = ['Contract Details', 'Supporting Documents', 'Review & Submit'];
  return (
    <Modal title="New Contract Request" onClose={onClose} wide>
      {/* Stepper */}
      <div className="flex items-center gap-2 mb-4">
        {STEPS.map((s, i) => {
          const n = i + 1; const done = step > n; const active = step === n;
          return (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0
                ${done ? 'bg-green-100 text-green-700' : active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                {done ? <Check size={14} /> : n}
              </div>
              <span className={`text-[12px] font-bold hidden sm:block ${active ? 'text-navy' : 'text-slate-400'}`}>{s}</span>
              {i < STEPS.length - 1 && <div className={`h-0.5 flex-1 rounded ${done ? 'bg-green-300' : 'bg-slate-100'}`} />}
            </div>
          );
        })}
      </div>

      {/* Step 1 — details */}
      {step === 1 && (
        <div>
          <div className="grid sm:grid-cols-2 gap-x-4">
            <Field label="Requested Mine" error={errors.mineId} hint="Only mines you are assigned to are listed.">
              <select className="input" value={form.mineId} onChange={(e) => set('mineId', e.target.value)}>
                <option value="">Select mine…</option>
                {mines.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.code})</option>)}
              </select>
            </Field>
            <Field label="Work Type" error={errors.workType}>
              <select className="input" value={form.workType} onChange={(e) => set('workType', e.target.value)}>
                <option value="">Select work type…</option>
                {WORK_TYPES.map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Proposed Contract Title" error={errors.proposedTitle}>
            <input className="input" maxLength={120} placeholder="e.g. Overburden Removal — North Pit Phase 2"
              value={form.proposedTitle} onChange={(e) => set('proposedTitle', e.target.value)} />
          </Field>
          <Field label="Scope of Work" error={errors.scopeOfWork} hint="Quantities, equipment, SLAs and any exclusions.">
            <textarea className="input min-h-[90px]" maxLength={2000} placeholder="Describe the work, volumes, equipment and responsibilities…"
              value={form.scopeOfWork} onChange={(e) => set('scopeOfWork', e.target.value)} />
          </Field>
          <div className="grid sm:grid-cols-2 gap-x-4">
            <Field label="Proposed Start Date" error={errors.proposedStartDate}>
              <input type="date" className="input" value={form.proposedStartDate} onChange={(e) => set('proposedStartDate', e.target.value)} />
            </Field>
            <Field label="Proposed End Date" error={errors.proposedEndDate}>
              <input type="date" className="input" value={form.proposedEndDate} onChange={(e) => set('proposedEndDate', e.target.value)} />
            </Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-x-4">
            <Field label="Estimated Contract Value (₹)" error={errors.estimatedValue} hint="Enter the rupee amount — e.g. 125000000 for ₹12.50 Crore.">
              <input type="number" min={1} className="input" placeholder="125000000"
                value={form.estimatedValue} onChange={(e) => set('estimatedValue', e.target.value)} />
            </Field>
            <Field label="Currency">
              <input className="input bg-slate-50" value="INR (₹)" disabled />
            </Field>
          </div>
          <Field label="Supporting Notes" hint="Optional — anything the mine commercial office should know.">
            <textarea className="input min-h-[70px]" maxLength={1000} placeholder="Optional notes…"
              value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </Field>
        </div>
      )}

      {/* Step 2 — attachments */}
      {step === 2 && (
        <div>
          <p className="text-[13px] text-slate-600 mb-3">Attach supporting documents to strengthen your request. In demo mode these are stored as local references only.</p>
          <AttachmentPicker files={form.attachments}
            onAdd={(f) => set('attachments', [...form.attachments, f])}
            onRemove={(i) => set('attachments', form.attachments.filter((_, x) => x !== i))} />
        </div>
      )}

      {/* Step 3 — review */}
      {step === 3 && (
        <div>
          <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50">
            <Kv k="Requested Mine" v={form.mineId ? mineLabel(form.mineId) : '—'} />
            <Kv k="Work Type" v={form.workType || '—'} />
            <Kv k="Proposed Title" v={form.proposedTitle || '—'} />
            <Kv k="Contract Period" v={form.proposedStartDate && form.proposedEndDate ? `${fmtDate(form.proposedStartDate)} → ${fmtDate(form.proposedEndDate)}` : '—'} />
            <Kv k="Estimated Value" v={form.estimatedValue && Number(form.estimatedValue) > 0 ? inr(Number(form.estimatedValue)) : '—'} />
            <Kv k="Scope of Work" v={<span className="whitespace-pre-wrap text-[12px] font-normal text-slate-600">{form.scopeOfWork || '—'}</span>} />
            {form.notes && <Kv k="Notes" v={<span className="whitespace-pre-wrap text-[12px] font-normal text-slate-600">{form.notes}</span>} />}
            <Kv k="Attachments" v={form.attachments.length ? (
              <ul className="text-[12px] font-normal space-y-0.5">
                {form.attachments.map((a, i) => <li key={i}>• {a.name} <span className="text-slate-400">({a.category}, {fmtSize(a.sizeKb)})</span></li>)}
              </ul>
            ) : 'None'} />
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-blue-50 border border-blue-100 p-3 text-[12px] text-blue-800">
            <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
            <span>On submit this is saved as a <b>request (Pending Review)</b>. It does <b>not</b> become an Active contract — the mine office must approve it first.</span>
          </div>
        </div>
      )}

      {submitError && <div className="mt-3 text-[12px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{submitError}</div>}

      {/* Footer */}
      <div className="flex items-center gap-2 mt-5">
        {step > 1 && (
          <button className="btn-primary !bg-white !text-navy border border-slate-300 flex items-center gap-1.5"
            disabled={submitting} onClick={() => setStep((s) => s - 1)}><ArrowLeft size={15} /> Back</button>
        )}
        <button className="btn-primary !bg-white !text-slate-500 border border-slate-200" onClick={onClose} disabled={submitting}>Cancel</button>
        <div className="ml-auto flex items-center gap-2">
          {step < 3 ? (
            <button className="btn-primary flex items-center gap-1.5" onClick={() => {
              if (step === 1 && !validateStep1()) return;
              setStep((s) => s + 1);
            }}>Next <ArrowRight size={15} /></button>
          ) : (
            <button className="btn-primary flex items-center gap-1.5 min-w-[150px] justify-center" onClick={submit} disabled={submitting}>
              {submitting ? 'Submitting…' : <><CheckCircle2 size={15} /> Submit Request</>}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ================= Renewal Request =================
export function ContractRenewalDialog({ contract, onClose, onSubmitted }: {
  contract: Contract; onClose: () => void; onSubmitted: (id: string) => void;
}) {
  const [months, setMonths] = useState('12');
  const [proposedEnd, setProposedEnd] = useState('');
  const [value, setValue] = useState(String(contract.contractValue));
  const [reason, setReason] = useState('');
  const [attachments, setAttachments] = useState<RequestAttachment[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Keep proposed end date in sync with the extension period unless overridden.
  function applyMonths(m: string) {
    setMonths(m);
    const n = Number(m);
    if (!Number.isFinite(n) || n <= 0) return;
    const start = new Date(`${contract.endDate}T00:00:00+05:30`);
    start.setMonth(start.getMonth() + n);
    setProposedEnd(start.toISOString().slice(0, 10));
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    const n = Number(months);
    if (!months || !Number.isFinite(n) || n <= 0) e.months = 'Enter a valid extension period in months.';
    else if (n > 60) e.months = 'Extension cannot exceed 60 months.';
    if (!proposedEnd) e.proposedEnd = 'Select the proposed revised end date.';
    else if (proposedEnd <= contract.endDate) e.proposedEnd = 'The revised end date must be after the current end date.';
    const v = Number(value);
    if (!value || !Number.isFinite(v) || v <= 0) e.value = 'Enter a positive revised value.';
    else if (v < contract.contractValue) e.value = 'Revised value cannot be lower than the current contract value.';
    if (!reason.trim()) e.reason = 'Provide a reason for the renewal.';
    else if (reason.trim().length < 15) e.reason = 'Reason must be at least 15 characters.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit() {
    if (submitting) return;
    if (!validate()) return;
    setSubmitError('');
    setSubmitting(true);
    try {
      const id = actions.requestRenewal(contract.id, {
        proposedEndDate: proposedEnd, proposedValue: Number(value),
        reason: reason.trim(), attachments,
      });
      onSubmitted(id);
    } catch (err: any) {
      setSubmitError(err?.message || 'Could not submit the renewal request.');
      setSubmitting(false);
    }
  }

  return (
    <Modal title={`Request Renewal — ${contract.name}`} onClose={onClose} wide>
      <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50 mb-4">
        <Kv k="Contract" v={`${contract.name} (${contract.id})`} />
        <Kv k="Mine" v={mineLabel(contract.mineId)} />
        <Kv k="Current End Date" v={fmtDate(contract.endDate)} />
        <Kv k="Current Value" v={inr(contract.contractValue)} />
      </div>
      <div className="grid sm:grid-cols-2 gap-x-4">
        <Field label="Extension Period (months)" error={errors.months}>
          <input type="number" min={1} max={60} className="input" value={months} onChange={(e) => applyMonths(e.target.value)} />
        </Field>
        <Field label="Proposed Revised End Date" error={errors.proposedEnd}>
          <input type="date" className="input" value={proposedEnd} onChange={(e) => { setProposedEnd(e.target.value); }} />
        </Field>
      </div>
      <Field label="Proposed Revised Value (₹)" error={errors.value} hint={`Current value is ${inr(contract.contractValue)}.`}>
        <input type="number" min={1} className="input" value={value} onChange={(e) => setValue(e.target.value)} />
      </Field>
      <Field label="Reason for Renewal" error={errors.reason}>
        <textarea className="input min-h-[80px]" maxLength={1200} placeholder="Why should this contract be extended?"
          value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      <AttachmentPicker files={attachments}
        onAdd={(f) => setAttachments((a) => [...a, f])}
        onRemove={(i) => setAttachments((a) => a.filter((_, x) => x !== i))} />
      <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3 text-[12px] text-amber-800">
        <RotateCcw size={16} className="shrink-0 mt-0.5" />
        <span>A renewal is a <b>request (Pending Review)</b>. The current contract end date and value stay unchanged until the mine office approves it.</span>
      </div>
      {submitError && <div className="mt-3 text-[12px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{submitError}</div>}
      <div className="flex items-center gap-2 mt-5">
        <button className="btn-primary !bg-white !text-slate-500 border border-slate-200" onClick={onClose} disabled={submitting}>Cancel</button>
        <button className="btn-primary ml-auto flex items-center gap-1.5 min-w-[160px] justify-center" onClick={submit} disabled={submitting}>
          {submitting ? 'Submitting…' : <><CheckCircle2 size={15} /> Submit Renewal Request</>}
        </button>
      </div>
    </Modal>
  );
}

// ================= Export dialog =================
export function ContractExportDialog({ rows, scopeLabel, onClose }: {
  rows: Contract[]; scopeLabel: string; onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');

  const COLUMNS: [string, (c: Contract) => unknown][] = useMemo(() => [
    ['Contract ID', (c) => c.id],
    ['Contract Name', (c) => c.name],
    ['Mine', (c) => mineLabel(c.mineId)],
    ['Work Type', (c) => c.workType],
    ['Start Date', (c) => c.startDate],
    ['End Date', (c) => c.endDate],
    ['Contract Value (INR)', (c) => c.contractValue],
    ['Status', (c) => c.status],
    ['Progress (%)', (c) => c.progress],
    ['Work Order', (c) => c.workOrderNumber],
    ['Renewal Eligible', (c) => (c.renewalEligible ? 'Yes' : 'No')],
  ], []);

  function run(kind: 'current' | 'all') {
    if (busy) return;
    setBusy(true);
    const target = kind === 'current' ? rows : rows;
    const name = `minenetr-contracts-${kind === 'current' ? scopeLabel.replace(/[^a-z0-9]+/gi, '-').toLowerCase() : 'all'}`;
    exportCsv(name, target, COLUMNS);
    setDone(`Exported ${target.length} contract${target.length === 1 ? '' : 's'} as CSV.`);
    setBusy(false);
  }

  return (
    <Modal title="Export Contracts" onClose={onClose}>
      <p className="text-[13px] text-slate-600 mb-1">Exports respect your contractor permissions, the selected mine, active tab, search and filters.</p>
      <p className="text-[12px] text-slate-500 mb-3">Currently in scope: <b className="text-navy">{rows.length} contract{rows.length === 1 ? '' : 's'}</b> — {scopeLabel}</p>
      <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50 mb-4 text-[12px] text-slate-600">
        <div className="font-bold text-navy mb-1">Columns</div>
        <div className="flex flex-wrap gap-1.5">
          {COLUMNS.map(([h]) => <span key={h} className="badge bg-white border border-slate-200 text-slate-600">{h}</span>)}
        </div>
      </div>
      {done && <div className="mb-3 text-[12px] font-semibold text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 flex items-center gap-2"><CheckCircle2 size={15} /> {done}</div>}
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary flex items-center gap-1.5" onClick={() => run('current')} disabled={busy}>
          <Download size={15} /> {busy ? 'Exporting…' : `Export ${rows.length} in-scope contract${rows.length === 1 ? '' : 's'}`}
        </button>
        <button className="btn-primary !bg-white !text-navy border border-slate-300" onClick={onClose} disabled={busy}>Close</button>
      </div>
      <p className="text-[11px] text-slate-400 mt-2">A CSV file downloads directly to your device. No data leaves the browser in demo mode.</p>
    </Modal>
  );
}

// ================= Filters popover =================
export function ContractFiltersPanel({ value, onApply, onReset, onClose }: {
  value: ContractFilters; onApply: (f: ContractFilters) => void; onReset: () => void; onClose: () => void;
}) {
  const [draft, setDraft] = useState<ContractFilters>(value);
  const mines = allowedMines();
  const set = <K extends keyof ContractFilters>(k: K, v: string) => setDraft((d) => ({ ...d, [k]: v }));
  return (
    <Modal title="Filters" onClose={onClose}>
      <div className="grid sm:grid-cols-2 gap-x-4">
        <Field label="Mine">
          <select className="input" value={draft.mineId} onChange={(e) => set('mineId', e.target.value)}>
            <option value="ALL">All Mines</option>
            {mines.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.code})</option>)}
          </select>
        </Field>
        <Field label="Contract Work Type / Category">
          <select className="input" value={draft.workType} onChange={(e) => set('workType', e.target.value)}>
            {['All Work Types', 'Overburden Removal', 'Coal Transportation', 'Equipment Maintenance', 'Site Services', 'Exploration Support']
              .map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </Field>
      </div>
      <div className="text-[12px] font-bold text-slate-600 mt-1 mb-1">Contract Start Date</div>
      <div className="grid sm:grid-cols-2 gap-x-4">
        <Field label="From"><input type="date" className="input" value={draft.startFrom} onChange={(e) => set('startFrom', e.target.value)} /></Field>
        <Field label="To"><input type="date" className="input" value={draft.startTo} onChange={(e) => set('startTo', e.target.value)} /></Field>
      </div>
      <div className="text-[12px] font-bold text-slate-600 mt-1 mb-1">Contract End Date</div>
      <div className="grid sm:grid-cols-2 gap-x-4">
        <Field label="From"><input type="date" className="input" value={draft.endFrom} onChange={(e) => set('endFrom', e.target.value)} /></Field>
        <Field label="To"><input type="date" className="input" value={draft.endTo} onChange={(e) => set('endTo', e.target.value)} /></Field>
      </div>
      <div className="text-[12px] font-bold text-slate-600 mt-1 mb-1">Contract Value Range (₹)</div>
      <div className="grid sm:grid-cols-2 gap-x-4">
        <Field label="Minimum"><input type="number" min={0} className="input" placeholder="e.g. 10000000" value={draft.minValue} onChange={(e) => set('minValue', e.target.value)} /></Field>
        <Field label="Maximum"><input type="number" min={0} className="input" placeholder="e.g. 100000000" value={draft.maxValue} onChange={(e) => set('maxValue', e.target.value)} /></Field>
      </div>
      <div className="flex items-center gap-2 mt-5">
        <button className="btn-primary !bg-white !text-slate-500 border border-slate-200" onClick={onClose}>Cancel</button>
        <button className="btn-primary !bg-white !text-blue-700 border border-blue-600" onClick={() => { onReset(); onClose(); }}>Reset Filters</button>
        <button className="btn-primary ml-auto" onClick={() => { onApply(draft); onClose(); }}>Apply Filters</button>
      </div>
    </Modal>
  );
}
