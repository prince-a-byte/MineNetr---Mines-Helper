/**
 * Photos & Evidence (inspector reference page 7).
 *
 * Reads db.evidence from the centralized inspections repository — the SAME
 * records the inspection workflow and Findings & Observations read. Removing a
 * record here also unlinks it from checklist responses and findings, because
 * the repository performs that cleanup in one transaction.
 *
 * Filters (search + type + inspection + captured-date range) are AND-combined
 * and deep-linked via ?q=&type=&inspection=&from=&to=.
 */
'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Camera, Download, ExternalLink, FileText, Link2, Paperclip, Pencil, Plus,
  RotateCcw, Search, StickyNote, Trash2, Video,
} from 'lucide-react';
import { ConfirmDialog, EmptyState, Field, KpiCard, Modal, SectionCard } from '../operations/ui';
import { InlineError, InspectionsToolbar, Menu, NavBtn, PermBtn } from './ui';
import {
  actions, inspectorName, inspectionOf, itemsOf, rolePermissions, siteLabel, siteOf, useMockInspections,
} from '../../lib/inspections/store';
import { downloadEvidenceSheet } from '../../lib/inspections/export';
import {
  EVIDENCE_TYPES,
  type Evidence, type EvidenceType, type Inspection,
} from '../../lib/inspections/types';
import { fmtDate, fmtDateTime, fmtSize } from '../../lib/inspections/format';

const TYPE_TONE: Record<string, string> = {
  Photo: 'bg-blue-50 text-blue-600',
  Document: 'bg-emerald-50 text-emerald-600',
  'Video Reference': 'bg-purple-50 text-purple-600',
  'Inspector Note': 'bg-amber-50 text-amber-600',
};

function TypeIcon({ type, size = 18 }: { type: EvidenceType; size?: number }) {
  if (type === 'Photo') return <Camera size={size} />;
  if (type === 'Document') return <FileText size={size} />;
  if (type === 'Video Reference') return <Video size={size} />;
  return <StickyNote size={size} />;
}

/** Clearly-labelled synthetic assets — nothing is really uploaded in this demo. */
const SAMPLE_FILES = [
  { fileName: 'sample_photo_east_pit.jpg', sizeKb: 1840, label: 'Photo · sample_photo_east_pit.jpg · 1.8 MB' },
  { fileName: 'sample_permit_certificate.pdf', sizeKb: 640, label: 'Document · sample_permit_certificate.pdf · 640 KB' },
  { fileName: 'sample_inspector_note.txt', sizeKb: 24, label: 'Note · sample_inspector_note.txt · 24 KB' },
];

const PAGE_SIZE = 9;

interface Filters {
  q: string;
  type: string;
  inspection: string;
  from: string;
  to: string;
}

interface EvidenceLine {
  evidence: Evidence;
  inspection?: Inspection;
  mineId: string;
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : 'That action could not be completed.';
}

export function EvidencePage() {
  const db = useMockInspections();
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();

  const [filters, setFilters] = useState<Filters>(() => ({
    q: sp?.get('q') ?? '',
    type: sp?.get('type') ?? 'ALL',
    inspection: sp?.get('inspection') ?? 'ALL',
    from: sp?.get('from') ?? '',
    to: sp?.get('to') ?? '',
  }));
  const [term, setTerm] = useState(filters.q);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');

  const [viewId, setViewId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [linkId, setLinkId] = useState<string | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);

  function update(patch: Partial<Filters>) {
    const next = { ...filters, ...patch };
    setFilters(next);
    setPage(1);
    const params = new URLSearchParams();
    if (next.q.trim()) params.set('q', next.q.trim());
    if (next.type !== 'ALL') params.set('type', next.type);
    if (next.inspection !== 'ALL') params.set('inspection', next.inspection);
    if (next.from) params.set('from', next.from);
    if (next.to) params.set('to', next.to);
    const qs = params.toString();
    router.replace(qs ? `${path}?${qs}` : path, { scroll: false });
  }

  function clearFilters() {
    setTerm('');
    update({ q: '', type: 'ALL', inspection: 'ALL', from: '', to: '' });
  }

  const activeFilters = Boolean(
    filters.q || filters.type !== 'ALL' || filters.inspection !== 'ALL' || filters.from || filters.to,
  );

  const scoped = useMemo<EvidenceLine[]>(() => {
    const scope = db.selectedMineId;
    return db.evidence
      .map((evidence) => {
        const inspection = inspectionOf(db, evidence.inspectionId);
        return { evidence, inspection, mineId: inspection?.mineId ?? '' };
      })
      .filter((l) => scope === 'ALL' || l.mineId === scope)
      .sort((a, b) => b.evidence.capturedAt.localeCompare(a.evidence.capturedAt));
  }, [db]);

  const filtered = useMemo(() => {
    const needle = filters.q.trim().toLowerCase();
    return scoped.filter((l) => {
      const e = l.evidence;
      if (filters.type !== 'ALL' && e.type !== filters.type) return false;
      if (filters.inspection !== 'ALL' && e.inspectionId !== filters.inspection) return false;
      if (filters.from && e.capturedAt.slice(0, 10) < filters.from) return false;
      if (filters.to && e.capturedAt.slice(0, 10) > filters.to) return false;
      if (needle) {
        const hay = [e.id, e.title, e.description, e.fileName, e.location].join(' ').toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [scoped, filters]);

  const kpis = useMemo(() => {
    const list = scoped.map((l) => l.evidence);
    const count = (t: EvidenceType) => list.filter((e) => e.type === t).length;
    return {
      total: list.length,
      photo: count('Photo'),
      doc: count('Document'),
      video: count('Video Reference'),
      note: count('Inspector Note'),
      bytes: list.reduce((a, e) => a + e.sizeKb, 0),
    };
  }, [scoped]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const from = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const to = Math.min(safePage * PAGE_SIZE, total);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const scopeLabel = db.selectedMineId === 'ALL'
    ? 'All assigned mines' : siteLabel(db, db.selectedMineId);
  const inspections = useMemo(
    () => db.inspections
      .filter((i) => db.selectedMineId === 'ALL' || i.mineId === db.selectedMineId)
      .sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate)),
    [db],
  );

  function downloadSheet() {
    setError('');
    if (filtered.length === 0) {
      setError('There are no evidence records in the current view to export. Adjust or clear the filters first.');
      return;
    }
    try {
      const scopeId = filtered.every((l) => l.evidence.inspectionId === filtered[0].evidence.inspectionId)
        ? filtered[0].evidence.inspectionId
        : 'ALL-IN-SCOPE';
      downloadEvidenceSheet(scopeId, filtered.map((l) => l.evidence));
      actions.logDownload(filtered[0].evidence.inspectionId, 'evidence',
        `Evidence sheet — ${filtered.length} record${filtered.length === 1 ? '' : 's'}`);
    } catch (e) {
      setError(msg(e));
    }
  }

  function downloadOne(e: Evidence) {
    setError('');
    try {
      downloadEvidenceSheet(e.inspectionId, [e]);
      actions.logDownload(e.inspectionId, 'evidence', `${e.id} — ${e.title}`);
    } catch (err) {
      setError(msg(err));
    }
  }

  return (
    <div className="space-y-4">
      <InspectionsToolbar
        extra={(
          <PermBtn perm="canManageEvidence" onClick={() => { setError(''); setAttachOpen(true); }} className="btn-primary !py-2">
            <span className="flex items-center gap-1.5"><Plus size={14} /> Attach evidence</span>
          </PermBtn>
        )}
      />

      {/* KPI strip — derived from db.evidence inside the active mine scope */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard icon={<Paperclip size={22} />} label="Total records" value={kpis.total}
          context={scopeLabel} tileClass="bg-blue-50 text-blue-600" />
        <KpiCard icon={<Camera size={22} />} label="Photos" value={kpis.photo}
          context={`${kpis.total ? Math.round((kpis.photo / kpis.total) * 100) : 0}% of records`}
          dotColor="#1463D9" tileClass="bg-blue-50 text-blue-600" />
        <KpiCard icon={<FileText size={22} />} label="Documents" value={kpis.doc}
          context="permits, SOPs, layouts" dotColor="#159B72" tileClass="bg-emerald-50 text-emerald-600" />
        <KpiCard icon={<Video size={22} />} label="Video references" value={kpis.video}
          context="stored as references" dotColor="#7C5CFC" tileClass="bg-purple-50 text-purple-600" />
        <KpiCard icon={<StickyNote size={22} />} label="Inspector notes" value={kpis.note}
          context="typed on site" dotColor="#E8A02B" tileClass="bg-amber-50 text-amber-600" />
        <KpiCard icon={<Download size={22} />} label="Total size" value={fmtSize(kpis.bytes)}
          context="synthetic demo files" dotColor="#94a3b8" tileClass="bg-slate-100 text-slate-600" />
      </div>

      {/* Filters — every control narrows the same list (AND) */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') update({ q: term }); if (e.key === 'Escape') clearFilters(); }}
            placeholder="Search ID, title, file, location…"
            aria-label="Search evidence"
            className="input !w-80 !pl-9"
          />
        </div>
        <button className="btn-primary !py-2" onClick={() => update({ q: term })}>Search</button>

        <select className="input !w-44 !py-2 !text-[13px]" aria-label="Filter by evidence type"
          value={filters.type} onChange={(e) => update({ type: e.target.value })}>
          <option value="ALL">All evidence types</option>
          {EVIDENCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="input !w-64 !py-2 !text-[13px]" aria-label="Filter by inspection"
          value={filters.inspection} onChange={(e) => update({ inspection: e.target.value })}>
          <option value="ALL">All inspections</option>
          {inspections.map((i) => (
            <option key={i.id} value={i.id}>{i.id} · {siteLabel(db, i.mineId)}</option>
          ))}
        </select>
        <input type="date" className="input !w-40 !py-2 !text-[13px]" aria-label="Captured from"
          title="Captured from (inclusive)" value={filters.from} onChange={(e) => update({ from: e.target.value })} />
        <input type="date" className="input !w-40 !py-2 !text-[13px]" aria-label="Captured to"
          title="Captured to (inclusive)" value={filters.to} onChange={(e) => update({ to: e.target.value })} />

        {activeFilters && (
          <button className="btn-ghost !py-2" onClick={clearFilters}>
            <RotateCcw size={13} className="inline mr-1" /> Clear filters
          </button>
        )}
        <span className="text-[12px] text-slate-500 font-semibold">
          Showing {from}–{to} of {total} record{total === 1 ? '' : 's'}
        </span>

        <div className="ml-auto">
          <button className="btn-secondary !py-2 !text-[12px]" onClick={downloadSheet}
            title="Download the evidence records currently shown as a DEMO CSV sheet">
            <Download size={13} className="inline mr-1" /> Download sheet
          </button>
        </div>
      </div>

      <InlineError error={error} onDismiss={() => setError('')} />

      <SectionCard
        title="Evidence records"
        subtitle={`${total} matching ${total === 1 ? 'record' : 'records'} of ${scoped.length} in ${scopeLabel.toLowerCase()} · synthetic files, never real uploads`}
        action={activeFilters ? (
          <button className="text-xs font-bold text-blue-600 hover:underline" onClick={clearFilters}>Reset</button>
        ) : undefined}
      >
        {pageRows.length === 0 ? (
          scoped.length === 0 ? (
            <EmptyState
              title="No evidence has been captured for this mine yet."
              sub="Evidence is attached while working an inspection — use Attach evidence to add a synthetic demo record now."
              action={<PermBtn perm="canManageEvidence" onClick={() => setAttachOpen(true)} className="btn-primary !py-2">
                Attach evidence
              </PermBtn>}
            />
          ) : (
            <EmptyState
              title="No evidence matches your current filters."
              sub="Try another evidence type, inspection or date range — or clear the filters to see every record."
              action={<button className="btn-primary !py-2" onClick={clearFilters}>Clear filters</button>}
            />
          )
        ) : (
          <>
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {pageRows.map(({ evidence: e, inspection, mineId }) => (
                <EvidenceCard
                  key={e.id}
                  evidence={e}
                  inspection={inspection}
                  mineCode={mineId ? siteOf(db, mineId).code : '—'}
                  onView={() => { setError(''); setViewId(e.id); }}
                  onEdit={() => { setError(''); setEditId(e.id); }}
                  onLink={() => { setError(''); setLinkId(e.id); }}
                  onRemove={() => { setError(''); setRemoveId(e.id); }}
                  onDownload={() => downloadOne(e)}
                />
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-3 mt-1 border-t border-slate-100 text-[12px] text-slate-500">
              <span>Showing {from}–{to} of {total} record{total === 1 ? '' : 's'}</span>
              <div className="ml-auto flex items-center gap-2">
                <button className="btn-secondary !py-1.5 !px-3 !text-[12px]" disabled={safePage <= 1}
                  onClick={() => setPage(safePage - 1)} title="Previous page">Prev</button>
                <span className="font-semibold text-navy">Page {safePage} of {totalPages}</span>
                <button className="btn-secondary !py-1.5 !px-3 !text-[12px]" disabled={safePage >= totalPages}
                  onClick={() => setPage(safePage + 1)} title="Next page">Next</button>
              </div>
            </div>
          </>
        )}
      </SectionCard>

      {viewId && <EvidenceViewModal id={viewId} onClose={() => setViewId(null)} />}
      {editId && <EvidenceEditModal id={editId} onClose={() => setEditId(null)} onError={setError} />}
      {linkId && <EvidenceLinkModal id={linkId} onClose={() => setLinkId(null)} onError={setError} />}
      {removeId && (
        <ConfirmDialog
          title={`Remove ${removeId}?`}
          body="The record is deleted from the inspection and is also unlinked from every checklist response and finding that references it. The inspection stays open — this cannot be undone in the demo."
          confirmLabel="Remove evidence"
          onCancel={() => setRemoveId(null)}
          onConfirm={() => {
            setError('');
            try {
              actions.removeEvidence(removeId);
            } catch (e) {
              setError(msg(e));
            }
            setRemoveId(null);
          }}
        />
      )}
      {attachOpen && (
        <AttachEvidenceModal
          onClose={() => setAttachOpen(false)}
          onCreated={() => setAttachOpen(false)}
          onError={setError}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

function EvidenceCard({ evidence: e, inspection, mineCode, onView, onEdit, onLink, onRemove, onDownload }: {
  evidence: Evidence;
  inspection?: Inspection;
  mineCode: string;
  onView: () => void;
  onEdit: () => void;
  onLink: () => void;
  onRemove: () => void;
  onDownload: () => void;
}) {
  const db = useMockInspections();
  const perms = rolePermissions(db);
  const closed = inspection?.status === 'Completed' || inspection?.status === 'Cancelled';
  const closedReason = inspection?.status === 'Completed'
    ? 'This inspection is Completed and read-only — raise a reinspection to change its evidence.'
    : 'This inspection was cancelled — its evidence can no longer be changed.';
  const item = inspection && e.itemId
    ? itemsOf(db, inspection.templateId).find((i) => i.id === e.itemId)
    : undefined;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 flex flex-col gap-2 hover:border-blue-300 transition">
      <div className="flex items-start gap-2">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${TYPE_TONE[e.type] ?? 'bg-slate-100 text-slate-600'}`}>
          <TypeIcon type={e.type} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="badge bg-slate-100 text-slate-600 !text-[10px]">{e.id}</span>
            <span className="badge bg-blue-50 text-blue-700 !text-[10px]">{e.type}</span>
          </div>
          <div className="text-[13px] font-extrabold text-navy truncate mt-0.5" title={e.title}>{e.title}</div>
        </div>
        <span className="text-[10.5px] font-extrabold text-slate-400 shrink-0">{mineCode}</span>
      </div>

      <p className="text-[11.5px] text-slate-600 line-clamp-2 min-h-[2.4em]" title={e.description}>
        {e.description.trim() || '— no description recorded —'}
      </p>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
        <span className="font-semibold text-navy truncate" title={e.fileName}>📎 {e.fileName}</span>
        <span>{fmtSize(e.sizeKb)}</span>
        <span title="Captured at">{fmtDateTime(e.capturedAt)}</span>
      </div>
      <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
        <span className="truncate">{e.location}</span>
        <span className="text-slate-300">·</span>
        <span className="truncate">by {inspectorName(db, e.uploadedBy)}</span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
        {inspection ? (
          <Link href={`/inspector/inspections/${inspection.id}`}
            className="badge bg-slate-100 text-blue-700 hover:bg-blue-100"
            title={`Open ${inspection.id} — ${inspection.type}`}>
            {inspection.id}
          </Link>
        ) : (
          <span className="badge bg-slate-100 text-slate-400 !text-[10px]">Inspection removed</span>
        )}
        {e.itemId && (
          <span className="badge bg-emerald-50 text-emerald-700 !text-[10px]"
            title={item ? `${item.id} — ${item.requirement}` : `Linked checklist item ${e.itemId}`}>
            <Link2 size={10} /> {e.itemId}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <button onClick={onView}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-bold text-navy hover:border-blue-300 hover:bg-blue-50"
            title="View the full record, its inspection and its checklist requirement">
            View
          </button>
          <Menu label="" items={[
            { label: 'Edit description', icon: <Pencil size={13} />, onClick: onEdit, disabled: !perms.canManageEvidence || closed, title: !perms.canManageEvidence ? 'Your demo role cannot edit evidence.' : closed ? closedReason : undefined },
            { label: 'Link to checklist item', icon: <Link2 size={13} />, onClick: onLink, disabled: !perms.canManageEvidence || closed, title: !perms.canManageEvidence ? 'Your demo role cannot relink evidence.' : closed ? closedReason : undefined },
            { label: 'Download sheet', icon: <Download size={13} />, onClick: onDownload, title: 'Download this record as a DEMO evidence sheet.' },
            { label: 'Remove', icon: <Trash2 size={13} />, danger: true, onClick: onRemove, disabled: !perms.canManageEvidence || closed, title: !perms.canManageEvidence ? 'Your demo role cannot remove evidence.' : closed ? closedReason : 'Also unlinked from checklist responses and findings.' },
          ]} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// View / edit / link / attach
// ---------------------------------------------------------------------------

function EvidenceViewModal({ id, onClose }: { id: string; onClose: () => void }) {
  const db = useMockInspections();
  const e = db.evidence.find((x) => x.id === id);
  if (!e) return null;
  const inspection = inspectionOf(db, e.inspectionId);
  const site = inspection ? siteOf(db, inspection.mineId) : null;
  const item = inspection && e.itemId
    ? itemsOf(db, inspection.templateId).find((i) => i.id === e.itemId)
    : undefined;

  return (
    <Modal title={`Evidence ${e.id}`} onClose={onClose} wide>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`badge ${TYPE_TONE[e.type] ?? 'bg-slate-100 text-slate-600'}`}>{e.type}</span>
          <span className="badge bg-slate-100 text-slate-600 !text-[10px]">{e.fileName}</span>
          <span className="badge bg-slate-100 text-slate-600 !text-[10px]">{fmtSize(e.sizeKb)}</span>
          <span className="ml-auto text-[11px] text-slate-400">Synthetic demo asset — no real file is stored</span>
        </div>

        <div>
          <div className="text-[14px] font-extrabold text-navy">{e.title}</div>
          <p className="text-[12.5px] text-slate-600 mt-1 whitespace-pre-line">
            {e.description.trim() || '— no description recorded —'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
          <div className="text-[12.5px] font-extrabold text-navy mb-1.5">Inspection context</div>
          <dl className="grid sm:grid-cols-2 gap-x-4 gap-y-1.5 text-[12px]">
            <div className="flex gap-2"><dt className="text-slate-500 w-24 shrink-0">Inspection</dt>
              <dd className="font-semibold text-navy min-w-0 truncate">{e.inspectionId}</dd></div>
            <div className="flex gap-2"><dt className="text-slate-500 w-24 shrink-0">Status</dt>
              <dd className="font-semibold text-navy">{inspection ? inspection.status : '—'}</dd></div>
            <div className="flex gap-2"><dt className="text-slate-500 w-24 shrink-0">Mine</dt>
              <dd className="font-semibold text-navy min-w-0 truncate">{site ? `${site.code} · ${site.name}` : '—'}</dd></div>
            <div className="flex gap-2"><dt className="text-slate-500 w-24 shrink-0">Scheduled</dt>
              <dd className="font-semibold text-navy">{inspection ? fmtDate(inspection.scheduledDate) : '—'}</dd></div>
            <div className="flex gap-2"><dt className="text-slate-500 w-24 shrink-0">Location</dt>
              <dd className="font-semibold text-navy min-w-0 truncate">{e.location}</dd></div>
            <div className="flex gap-2"><dt className="text-slate-500 w-24 shrink-0">Captured</dt>
              <dd className="font-semibold text-navy">{fmtDateTime(e.capturedAt)}</dd></div>
            <div className="flex gap-2"><dt className="text-slate-500 w-24 shrink-0">Uploaded by</dt>
              <dd className="font-semibold text-navy">{inspectorName(db, e.uploadedBy)}</dd></div>
            <div className="flex gap-2"><dt className="text-slate-500 w-24 shrink-0">File ref</dt>
              <dd className="font-semibold text-navy min-w-0 truncate" title={e.fileRef}>{e.fileRef}</dd></div>
          </dl>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="text-[12.5px] font-extrabold text-navy mb-1">Linked checklist requirement</div>
          {item ? (
            <>
              <div className="text-[12.5px] font-semibold text-navy">{item.id} — {item.requirement}</div>
              <div className="text-[11.5px] text-slate-500 mt-0.5">{item.description}</div>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                <span className="badge bg-slate-100 text-slate-600 !text-[10px]">{item.section}</span>
                {item.mandatory && <span className="badge bg-amber-100 text-amber-700 !text-[10px]">Mandatory</span>}
                {item.evidenceRequired && <span className="badge bg-sky-100 text-sky-700 !text-[10px]">Evidence required</span>}
              </div>
            </>
          ) : (
            <p className="text-[12px] text-slate-500">
              {e.itemId
                ? `Linked to checklist item ${e.itemId}, which is not part of this inspection's template.`
                : 'Not linked to a checklist item — use “Link to checklist item” to attach it to a requirement.'}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <NavBtn href={`/inspector/inspections/${e.inspectionId}?tab=Evidence%20%26%20Observations`}
            icon={<ExternalLink size={13} />}>Open in inspection</NavBtn>
          <button className="btn-primary !py-2 !text-[12px]" onClick={onClose}>Close</button>
        </div>
      </div>
    </Modal>
  );
}

function EvidenceEditModal({ id, onClose, onError }: {
  id: string; onClose: () => void; onError: (m: string) => void;
}) {
  const db = useMockInspections();
  const e = db.evidence.find((x) => x.id === id);
  const [description, setDescription] = useState(e?.description ?? '');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState('');
  const descriptionError = touched && !description.trim()
    ? 'A description is required — it is what reviewers read in the evidence sheet.'
    : undefined;

  function submit() {
    setTouched(true);
    setError('');
    if (!description.trim()) return;
    try {
      actions.updateEvidence(id, { description });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the evidence record.');
      onError(err instanceof Error ? err.message : 'Could not update the evidence record.');
    }
  }

  if (!e) return null;
  return (
    <Modal title={`Edit description · ${e.id}`} onClose={onClose}>
      <div className="space-y-3">
        <InlineError error={error} onDismiss={() => setError('')} />
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-[12px]">
          <span className="font-bold text-navy">{e.title}</span>
          {' · '}{e.type} · {e.fileName} · {fmtSize(e.sizeKb)}
        </div>
        <Field label="Description" error={descriptionError}
          hint="Title, type and file stay as captured — only the description can be edited here.">
          <textarea className="input" rows={4} value={description} onChange={(ev) => setDescription(ev.target.value)}
            placeholder="What this evidence shows and why it matters…" autoFocus />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <button className="btn-secondary !py-2 !text-[12px]" onClick={onClose}>Cancel</button>
          <button className="btn-primary !py-2 !text-[12px]" onClick={submit}>Save description</button>
        </div>
      </div>
    </Modal>
  );
}

function EvidenceLinkModal({ id, onClose, onError }: {
  id: string; onClose: () => void; onError: (m: string) => void;
}) {
  const db = useMockInspections();
  const e = db.evidence.find((x) => x.id === id);
  const inspection = e ? inspectionOf(db, e.inspectionId) : undefined;
  const items = inspection ? itemsOf(db, inspection.templateId) : [];
  const [itemId, setItemId] = useState(e?.itemId ?? '');
  const [error, setError] = useState('');

  function submit() {
    setError('');
    try {
      actions.linkEvidence(id, itemId || null);
      onClose();
    } catch (err) {
      const m = err instanceof Error ? err.message : 'Could not link the evidence record.';
      setError(m);
      onError(m);
    }
  }

  if (!e) return null;
  return (
    <Modal title={`Link to checklist item · ${e.id}`} onClose={onClose}>
      <div className="space-y-3">
        <InlineError error={error} onDismiss={() => setError('')} />
        <p className="text-[12px] text-slate-600">
          The link drives which requirement shows this evidence inside <b>{e.inspectionId}</b>.
          Unlinking keeps the record, it only detaches it from the checklist item.
        </p>
        <Field label="Checklist item"
          hint={items.length === 0 ? 'This inspection has no checklist items yet — start it from My Inspections.' : undefined}>
          <select className="input" value={itemId} onChange={(ev) => setItemId(ev.target.value)}
            disabled={items.length === 0}
            title={items.length === 0 ? 'No checklist items are available for this inspection.' : undefined}>
            <option value="">{items.length === 0 ? 'No checklist items available' : 'Not linked to a checklist item'}</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>{i.id} — {i.requirement}{i.evidenceRequired ? ' (evidence required)' : ''}</option>
            ))}
          </select>
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <button className="btn-secondary !py-2 !text-[12px]" onClick={onClose}>Cancel</button>
          <button className="btn-primary !py-2 !text-[12px]" onClick={submit} disabled={items.length === 0}>
            <span className="flex items-center gap-1.5"><Link2 size={13} /> Save link</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}

function AttachEvidenceModal({ onClose, onCreated, onError }: {
  onClose: () => void; onCreated: () => void; onError: (m: string) => void;
}) {
  const db = useMockInspections();
  const candidates = useMemo(
    () => db.inspections
      .filter((i) => i.status !== 'Completed' && i.status !== 'Cancelled')
      .filter((i) => db.selectedMineId === 'ALL' || i.mineId === db.selectedMineId)
      .sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate)),
    [db],
  );
  const sensible = candidates.find((i) => i.status === 'In Progress' || i.status === 'Pending Submission')
    ?? candidates[0];

  const [inspectionId, setInspectionId] = useState(sensible?.id ?? '');
  const [type, setType] = useState<EvidenceType>('Photo');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [itemId, setItemId] = useState('');
  const [sample, setSample] = useState(SAMPLE_FILES[0].fileName);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState('');

  const inspection = candidates.find(
    (i) => i.id.toLowerCase() === inspectionId.trim().toLowerCase(),
  );
  const items = inspection ? itemsOf(db, inspection.templateId) : [];
  const inspectionError = touched && !inspection
    ? 'Choose one of the listed inspections — only open inspections accept evidence.'
    : undefined;
  const titleError = touched && !title.trim() ? 'An evidence title is required.' : undefined;

  function submit() {
    setTouched(true);
    setError('');
    if (!inspection || !title.trim()) return;
    const file = SAMPLE_FILES.find((f) => f.fileName === sample) ?? SAMPLE_FILES[0];
    try {
      actions.addEvidence({
        inspectionId: inspection.id,
        itemId: itemId || null,
        type,
        title,
        description,
        location: location.trim() || inspection.location,
        fileRef: `DEMO-FILE://inspections/${file.fileName}`,
        fileName: file.fileName,
        sizeKb: file.sizeKb,
      });
      onCreated();
    } catch (err) {
      const m = err instanceof Error ? err.message : 'Could not attach the evidence record.';
      setError(m);
      onError(m);
    }
  }

  if (candidates.length === 0) {
    return (
      <Modal title="Attach evidence" onClose={onClose}>
        <EmptyState
          title="No open inspections in this mine scope."
          sub="Completed and cancelled inspections are read-only. Switch the mine selector or start an inspection from My Inspections first."
          action={<button className="btn-primary !py-2" onClick={onClose}>Close</button>}
        />
      </Modal>
    );
  }

  return (
    <Modal title="Attach evidence" onClose={onClose}>
      <div className="space-y-1">
        <InlineError error={error} onDismiss={() => setError('')} />

        <Field label="Inspection" error={inspectionError}
          hint="Completed and cancelled inspections are excluded — they are read-only.">
          <input className="input" list="attach-evidence-inspections" value={inspectionId}
            onChange={(ev) => { setInspectionId(ev.target.value); setItemId(''); }}
            placeholder="Type an inspection ID, e.g. INS-2026-003" autoFocus />
          <datalist id="attach-evidence-inspections">
            {candidates.map((i) => (
              <option key={i.id} value={i.id}>
                {i.id} — {siteLabel(db, i.mineId)} · {i.type} · {fmtDate(i.scheduledDate)}
              </option>
            ))}
          </datalist>
        </Field>

        <div className="grid sm:grid-cols-2 gap-0 sm:gap-3">
          <Field label="Evidence type">
            <select className="input" value={type} onChange={(ev) => setType(ev.target.value as EvidenceType)}>
              {EVIDENCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Linked checklist item (optional)"
            hint={items.length === 0 ? 'Select an inspection first.' : undefined}>
            <select className="input" value={itemId} onChange={(ev) => setItemId(ev.target.value)}
              disabled={items.length === 0}
              title={items.length === 0 ? 'Select an inspection first to list its checklist items.' : undefined}>
              <option value="">{items.length === 0 ? 'No checklist items available' : 'Not linked to a checklist item'}</option>
              {items.map((i) => <option key={i.id} value={i.id}>{i.id} — {i.requirement}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Title" error={titleError}>
          <input className="input" value={title} onChange={(ev) => setTitle(ev.target.value)}
            placeholder="e.g. Ventilation fan guard missing at East Pit" />
        </Field>

        <Field label="Description">
          <textarea className="input" rows={2} value={description} onChange={(ev) => setDescription(ev.target.value)}
            placeholder="What the record shows…" />
        </Field>

        <Field label="Location" hint="Defaults to the inspection's location when left blank.">
          <input className="input" value={location} onChange={(ev) => setLocation(ev.target.value)}
            placeholder={inspection ? inspection.location : 'e.g. East Pit – Level 2'} />
        </Field>

        <Field label="Sample file (DEMO — nothing is uploaded)"
          hint="No browser upload happens: a synthetic placeholder reference is stored instead.">
          <select className="input" value={sample} onChange={(ev) => setSample(ev.target.value)}>
            {SAMPLE_FILES.map((f) => <option key={f.fileName} value={f.fileName}>{f.label}</option>)}
          </select>
        </Field>

        <div className="rounded-xl bg-blue-50 border border-blue-100 px-3 py-2 text-[11.5px] text-blue-800">
          The record is written to the shared repository: it appears here immediately, counts toward the
          inspection&apos;s evidence requirement and can be linked to findings or checklist responses.
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button className="btn-secondary !py-2 !text-[12px]" onClick={onClose}>Cancel</button>
          <button className="btn-primary !py-2 !text-[12px]" onClick={submit}>
            <span className="flex items-center gap-1.5"><Plus size={13} /> Attach evidence</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
