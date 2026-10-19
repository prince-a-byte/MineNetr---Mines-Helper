/**
 * Checklist item editor used by the individual inspection workflow
 * (components/inspections/detail.tsx → "Inspection Checklist" tab).
 *
 * One card per checklist line: item id + requirement + description, the
 * Mandatory / Evidence-required badges, the four-response segmented radio
 * group, a remarks draft, the linked-evidence chips and the per-item actions
 * (save, add note, add evidence, create finding, view evidence).
 *
 * The response/remarks draft is OWNED BY THE PARENT, keyed by checklist item
 * id — switching items, sections or tabs never discards it. Nothing is written
 * to the store until "Save response" is pressed, because marking an
 * evidence-required item Non-Compliant can be rejected and that validation
 * must surface as a deliberate, inline action.
 */
'use client';
import { Eye, Paperclip, Plus, Save, StickyNote, TriangleAlert, Undo2 } from 'lucide-react';
import { PermBtn } from './ui';
import {
  CHECKLIST_RESPONSES,
  type ChecklistResponseValue, type ChecklistRow, type Evidence,
} from '../../lib/inspections/types';
import { fmtDateTime } from '../../lib/inspections/format';

export interface ChecklistItemDraft { response: ChecklistResponseValue; remarks: string }

const SELECTED_TONE: Record<ChecklistResponseValue, string> = {
  Compliant: 'bg-emerald-100 text-emerald-700 border-emerald-400',
  'Non-Compliant': 'bg-red-100 text-red-600 border-red-400',
  'Not Applicable': 'bg-slate-200 text-slate-700 border-slate-400',
  'Not Checked': 'bg-amber-100 text-amber-700 border-amber-400',
};

export function ChecklistItemCard({
  row, draft, dirty, linkedEvidence, canEdit, closed,
  onDraft, onDiscard, onSave, onAddNote, onAddEvidence, onCreateFinding, onViewEvidence, onViewLinked,
}: {
  row: ChecklistRow;
  draft: ChecklistItemDraft;
  dirty: boolean;
  linkedEvidence: Evidence[];
  canEdit: boolean;
  closed: boolean;
  onDraft: (d: ChecklistItemDraft) => void;
  onDiscard: () => void;
  onSave: () => void;
  onAddNote: () => void;
  onAddEvidence: () => void;
  onCreateFinding: () => void;
  onViewEvidence: (evidenceId: string) => void;
  onViewLinked: () => void;
}) {
  const editTitle = closed
    ? 'This inspection is Completed and read-only in this demo — responses cannot be changed.'
    : 'Your demo role cannot record checklist responses. Switch role to continue.';
  const needsEvidence = draft.response === 'Non-Compliant'
    && row.item.evidenceRequired && linkedEvidence.length === 0;

  return (
    <div id={`item-${row.item.id}`} className="rounded-xl border border-slate-200 bg-white p-3.5">
      <div className="flex items-start gap-2 flex-wrap">
        <span className="font-mono text-[11px] font-extrabold text-blue-700 bg-blue-50 rounded-lg px-1.5 py-0.5 mt-0.5">
          {row.item.id}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-bold text-navy leading-snug">{row.item.requirement}</div>
          <div className="text-[11.5px] text-slate-500 mt-0.5">{row.item.description}</div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {row.item.mandatory && <span className="badge bg-amber-100 text-amber-700 !text-[10px]">Mandatory</span>}
          {row.item.evidenceRequired && <span className="badge bg-sky-100 text-sky-700 !text-[10px]">Evidence required</span>}
          {dirty && <span className="badge bg-orange-100 text-orange-700 !text-[10px]">Unsaved changes</span>}
        </div>
      </div>

      {/* Four-response segmented radio group */}
      <div role="radiogroup" aria-label={`Response for ${row.item.id}`}
        className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-3">
        {CHECKLIST_RESPONSES.map((r) => {
          const selected = draft.response === r;
          return (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={!canEdit}
              title={canEdit ? undefined : editTitle}
              onClick={() => onDraft({ ...draft, response: r })}
              className={`rounded-xl border px-2 py-2 text-[12px] font-bold transition
                ${selected ? SELECTED_TONE[r] : 'border-slate-200 bg-white text-slate-500 hover:border-blue-300 hover:text-navy'}
                ${!canEdit ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              {selected ? '● ' : ''}{r}
            </button>
          );
        })}
      </div>

      {needsEvidence && (
        <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11.5px] text-amber-800">
          <TriangleAlert size={12} className="inline mr-1 -mt-0.5" />
          This item is flagged <b>evidence-required</b> — attach at least one evidence record before saving a
          Non-Compliant answer.
        </div>
      )}

      <label className="block mt-2.5">
        <span className="block text-[11.5px] font-bold text-slate-600 mb-1">Remarks</span>
        <textarea
          className="input !text-[12.5px]"
          rows={2}
          disabled={!canEdit}
          title={canEdit ? undefined : editTitle}
          value={draft.remarks}
          onChange={(e) => onDraft({ ...draft, remarks: e.target.value })}
          placeholder="Observation notes for this item…"
        />
      </label>

      {linkedEvidence.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {linkedEvidence.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => onViewEvidence(e.id)}
              title={`View ${e.id} — ${e.title}`}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1
                text-[11px] font-bold text-navy hover:border-blue-300 hover:bg-blue-50 transition"
            >
              <Paperclip size={11} className="text-blue-600" />
              <span className="font-mono">{e.id}</span>
              <span className="text-slate-500 font-semibold">{e.type}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-2 text-[11px] text-slate-400">No evidence linked to this item yet.</div>
      )}

      {/* Per-item actions */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={onSave}
          disabled={!canEdit || !dirty}
          title={!canEdit ? editTitle : !dirty ? 'No unsaved changes — your selection already matches the stored response.' : undefined}
          className={`btn-primary !py-1.5 !px-3 !text-[12px] ${(!canEdit || !dirty) ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <Save size={13} className="inline mr-1" />Save response
        </button>
        <PermBtn perm="canManageEvidence" onClick={onAddNote} className="btn-secondary !py-1.5 !px-3 !text-[12px]"
          disabled={closed} title={closed ? 'This inspection is read-only — no new records can be captured.' : undefined}>
          <StickyNote size={13} className="inline mr-1" />Add Note
        </PermBtn>
        <PermBtn perm="canManageEvidence" onClick={onAddEvidence} className="btn-secondary !py-1.5 !px-3 !text-[12px]"
          disabled={closed} title={closed ? 'This inspection is read-only — no new records can be captured.' : undefined}>
          <Plus size={13} className="inline mr-1" />Add Evidence
        </PermBtn>
        <PermBtn perm="canCreateFinding" onClick={onCreateFinding} className="btn-secondary !py-1.5 !px-3 !text-[12px]"
          disabled={draft.response !== 'Non-Compliant' || closed}
          title={closed
            ? 'This inspection was cancelled — no new findings can be raised on it.'
            : draft.response !== 'Non-Compliant'
              ? 'Mark this item Non-Compliant to raise a finding against it.'
              : undefined}>
          <TriangleAlert size={13} className="inline mr-1" />Create finding
        </PermBtn>
        <button
          type="button"
          onClick={onViewLinked}
          disabled={linkedEvidence.length === 0}
          title={linkedEvidence.length === 0
            ? 'No evidence is linked to this item yet — use Add Evidence to attach one.'
            : `View the ${linkedEvidence.length} evidence record(s) linked to this item.`}
          className={`btn-secondary !py-1.5 !px-3 !text-[12px] ${linkedEvidence.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <Eye size={13} className="inline mr-1" />View evidence
        </button>
        {dirty && (
          <button
            type="button"
            onClick={onDiscard}
            className="btn-ghost !py-1.5 !px-2 !text-[12px] ml-auto"
            title="Discard the unsaved changes on this item and restore the stored response."
          >
            <Undo2 size={13} className="inline mr-1" />Discard changes
          </button>
        )}
        {row.updatedAt && !dirty && (
          <span className="ml-auto text-[10.5px] text-slate-400">Updated {fmtDateTime(row.updatedAt)}</span>
        )}
      </div>
    </div>
  );
}

/** Small helper reused by the detail page's "View evidence" affordances. */
export function EvidenceChipButton({ evidence, onClick }: { evidence: Evidence; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`View ${evidence.id} — ${evidence.title}`}
      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1
        text-[11px] font-bold text-navy hover:border-blue-300 hover:bg-blue-50 transition"
    >
      <Paperclip size={11} className="text-blue-600" />
      <span className="font-mono">{evidence.id}</span>
      <span className="text-slate-500 font-semibold">{evidence.type}</span>
    </button>
  );
}
