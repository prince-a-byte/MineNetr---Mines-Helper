'use client';
/**
 * MineNetr contractor portal — Documents & Compliance (design reference page 6).
 *
 * Every figure derives from the centralized repository in lib/workforce/store:
 * the KPI cards (computeKpis), the register table (documentsInTab), the status
 * donut, Upcoming Expirations and the statutory compliance section all read the
 * same 128 seeded document records, so a mine change, tab change, search,
 * filter or upload updates every view at once.
 *
 * Domain rules enforced here:
 *  - document status is ALWAYS derived from expiryDate vs the demo clock
 *    (03 Oct 2026): Expired if past, Expiring Soon within 60 days, else Valid.
 *    No stored flag is ever trusted (PortalDocument carries none),
 *  - documents are compliance evidence — Delete is deliberately not offered;
 *    Renew / Replace records a fresh document while the old record stays,
 *  - Upload / Renew create SIMULATED LOCAL REFERENCES (browser-only metadata),
 *    labelled as such in the modal; no server is involved in demo mode,
 *  - every visible control performs a real store action, a real file download,
 *    or is a PermBtn/PermIconBtn disabled with an explanatory tooltip.
 */
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  AlertTriangle, Building2, Download, Eye, FileText, Hourglass, RefreshCw, Scale,
  ShieldCheck, Truck, Upload, Users,
} from 'lucide-react';
import { ContractorShell } from './shell';
import { ComplianceRegister } from './compliance';
import {
  DataTable, DetailDrawer, Donut, EmptyState, Field, KpiCard, Modal, PageToolbar,
  PermBtn, PermIconBtn, Pill, ProgressRow, QuickActions, SearchInput, SectionCard,
  SoftPill, Kv, type Column,
} from './ui';
import { Tabs } from '../operations/ui';
import { CHART } from '../operations/hooks';
import {
  actions, can, canReason, computeKpis, contractorName, documentsInTab, mineCode,
  mineLabel, toast, useMockWorkforce, type WorkforceDbState,
} from '../../lib/workforce/store';
import {
  addDays, daysUntil, fmtDate, fmtSize, periodLabel, tone,
} from '../../lib/workforce/format';
import { exportCsv, exportText } from '../../lib/workforce/export';
import { mines } from '../../lib/workforce/seed';
import {
  DEMO_TODAY, DOCUMENT_CATEGORIES, DocumentStatus,
  type DocumentCategory, type PortalDocument,
} from '../../lib/workforce/types';

type RelatedType = PortalDocument['relatedType'];

// ---------- Static vocabularies (labels only — records always come from the store) ----------
const TABS: string[] = ['All Documents', ...DOCUMENT_CATEGORIES];

const RELATED_TYPES: { id: RelatedType; label: string }[] = [
  { id: 'contractor', label: 'Contractor' },
  { id: 'worker', label: 'Worker' },
  { id: 'equipment', label: 'Equipment' },
  { id: 'statutory', label: 'Statutory compliance' },
];

const CATEGORY_META: Record<DocumentCategory, { icon: ReactNode; tile: string; short: string }> = {
  'Contract Documents': { icon: <FileText size={14} />, tile: 'bg-blue-100 text-blue-600', short: 'Contract' },
  'Worker Documents': { icon: <Users size={14} />, tile: 'bg-emerald-100 text-emerald-600', short: 'Worker' },
  'Equipment Documents': { icon: <Truck size={14} />, tile: 'bg-amber-100 text-amber-600', short: 'Equipment' },
  'Statutory Compliance': { icon: <Scale size={14} />, tile: 'bg-violet-100 text-violet-600', short: 'Statutory' },
};

const STATUS_RANK: Record<DocumentStatus, number> = {
  [DocumentStatus.Valid]: 1, [DocumentStatus.ExpiringSoon]: 2, [DocumentStatus.Expired]: 3,
};

// ---------- Derived-status helpers (never a stored flag) ----------
/** Expiry-based status vs the demo clock: Expired > Expiring Soon (60d) > Valid. */
function docStatus(d: PortalDocument): DocumentStatus {
  if (d.expiryDate < DEMO_TODAY) return DocumentStatus.Expired;
  if (d.expiryDate <= addDays(DEMO_TODAY, 60)) return DocumentStatus.ExpiringSoon;
  return DocumentStatus.Valid;
}

/** Friendly "Related To" label resolved against the live registers. */
function relatedInfo(db: WorkforceDbState, d: PortalDocument): { label: string; sub: string } {
  if (d.relatedType === 'worker') {
    const w = db.workers.find((x) => x.id === d.relatedId);
    return { label: w?.name ?? d.relatedId, sub: `Worker · ${d.relatedId}` };
  }
  if (d.relatedType === 'equipment') {
    return { label: d.relatedId.replace(/^HEMM-/, ''), sub: `HEMM fleet · ${d.relatedId}` };
  }
  // Contractor and statutory filings both resolve against the contractor register.
  return { label: contractorName(d.relatedId), sub: `${d.relatedType === 'statutory' ? 'Statutory' : 'Contractor'} · ${d.relatedId}` };
}

/** Sort key: expired documents first (most recently expired), then soonest first. */
function expirySortKey(d: PortalDocument): number {
  const n = daysUntil(d.expiryDate) ?? 0;
  return n < 0 ? -n : n;
}

/** Equipment codes already referenced by the register (no free-text ids). */
function equipmentCodesOf(db: WorkforceDbState): { id: string; label: string }[] {
  const set = new Set<string>();
  for (const d of db.documents) if (d.relatedType === 'equipment') set.add(d.relatedId);
  return [...set].sort().map((code) => ({ id: code, label: `${code.replace(/^HEMM-/, '')} (HEMM ${code})` }));
}

/** Filing entities used by statutory documents (contractor register ids). */
function statutoryOptionsOf(db: WorkforceDbState): { id: string; label: string }[] {
  const set = new Set<string>();
  for (const d of db.documents) if (d.relatedType === 'statutory') set.add(d.relatedId);
  for (const c of db.contractors) if (c.isSelf) set.add(c.id);
  return [...set].sort().map((id) => ({ id, label: `${contractorName(id)} — filing entity (${id})` }));
}

/** Plain-text download describing a document (a genuine local file, DEMO watermarked). */
function documentText(db: WorkforceDbState, d: PortalDocument): string {
  const line = '='.repeat(72);
  const rel = relatedInfo(db, d);
  const st = docStatus(d);
  const n = daysUntil(d.expiryDate);
  return [
    line,
    '  M I N E N E T R  —  D E M O   D O C U M E N T   R E G I S T E R   E N T R Y',
    line,
    '',
    '*** DEMO ONLY — SIMULATED LOCAL REFERENCE, NOT A REAL DOCUMENT FILE ***',
    'The portal stores metadata references only; nothing was uploaded to a server.',
    'All data below is synthetic and fictional.',
    '',
    `  Document ID        : ${d.id}`,
    `  Document Name      : ${d.name}`,
    `  Category           : ${d.category}`,
    `  Related To         : ${rel.label} (${rel.sub})`,
    `  Mine               : ${mineLabel(d.mineId)}`,
    `  Issue Date         : ${fmtDate(d.issueDate)}`,
    `  Expiry Date        : ${fmtDate(d.expiryDate)}`,
    `  Days Left          : ${n === null ? '—' : n}`,
    `  Status (derived)   : ${st}`,
    `  Size               : ${fmtSize(d.sizeKb)}`,
    `  Uploaded By        : ${d.uploadedBy}`,
    `  Reference          : ${d.mockRef}`,
    '',
    `Status is derived from the expiry date against the ${fmtDate(DEMO_TODAY)} demo clock.`,
    'Documents are compliance evidence — the portal never deletes document records.',
    '',
    line,
    '  Issued by the MineNetr contractor workspace (frontend demo).',
    '  No regulator, inspector or external system has been notified.',
    line,
  ].join('\n');
}

// ---------- Small always-enabled icon button (View / Download have no perm gate) ----------
function RowBtn({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} title={label} aria-label={label}
      className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-[13px]
        bg-white hover:bg-blue-50 hover:border-blue-300 text-navy">
      {children}
    </button>
  );
}

// ---------- Upload / Renew modal ----------
function UploadModal({ mode, doc, onClose }: { mode: 'new' | 'renew'; doc?: PortalDocument; onClose: () => void }) {
  const db = useMockWorkforce();
  const defaultMine = doc?.mineId
    ?? (db.selectedMineId !== 'ALL' ? db.selectedMineId : db.contractors.find((c) => c.isSelf)?.mineId ?? mines[0].id);

  const [name, setName] = useState(doc?.name ?? '');
  const [category, setCategory] = useState<DocumentCategory>(doc?.category ?? 'Contract Documents');
  const [relatedType, setRelatedType] = useState<RelatedType>(doc?.relatedType ?? 'contractor');
  const [mineId, setMineId] = useState(defaultMine);
  const [relatedId, setRelatedId] = useState(doc?.relatedId ?? '');
  const [expiryDate, setExpiryDate] = useState(
    doc && doc.expiryDate > DEMO_TODAY ? doc.expiryDate : addDays(DEMO_TODAY, 365),
  );
  const [sizeKb, setSizeKb] = useState(doc ? String(doc.sizeKb) : '250');
  const [error, setError] = useState('');

  const relatedOptions: { id: string; label: string }[] =
    relatedType === 'contractor'
      ? db.contractors.map((c) => ({ id: c.id, label: `${c.name} (${c.id})` }))
      : relatedType === 'worker'
        ? db.workers
          .filter((w) => mineId === 'ALL' || w.mineId === mineId)
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((w) => ({ id: w.id, label: `${w.name} — ${w.designation} (${w.id})` }))
        : relatedType === 'equipment'
          ? equipmentCodesOf(db)
          : statutoryOptionsOf(db);

  // Keep the selected related id valid whenever its source list changes.
  if (relatedId && !relatedOptions.some((o) => o.id === relatedId)) setRelatedId('');

  const relatedHint = relatedType === 'worker'
    ? `Workers deployed at ${mineLabel(mineId)}`
    : relatedType === 'equipment'
      ? 'HEMM equipment codes already present in the document register'
      : relatedType === 'statutory'
        ? 'Contractor entity that files the statutory document'
        : 'Contractor company the document belongs to';

  function submit() {
    setError('');
    if (!name.trim()) { setError('Document name is required.'); return; }
    if (!relatedId) {
      setError(relatedOptions.length === 0
        ? `No ${RELATED_TYPES.find((t) => t.id === relatedType)?.label.toLowerCase()} options are available in the current mine scope — change the mine or related type.`
        : 'Select what this document relates to.');
      return;
    }
    if (!expiryDate) { setError('Expiry date is required for compliance tracking.'); return; }
    if (Number.isNaN(new Date(`${expiryDate}T00:00:00+05:30`).getTime())) {
      setError('Enter a valid expiry date (yyyy-mm-dd).'); return;
    }
    if (mode === 'renew' && expiryDate <= DEMO_TODAY) {
      setError(`A renewal must carry an expiry date after ${fmtDate(DEMO_TODAY)} (the demo clock).`); return;
    }
    const kb = Number(sizeKb);
    if (!Number.isFinite(kb) || kb <= 0) { setError('Size must be a positive number of kilobytes (KB).'); return; }
    try {
      actions.uploadDocument({
        name: name.trim(), category, relatedType, relatedId, mineId, expiryDate, sizeKb: kb,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <Modal title={mode === 'renew' ? `Renew / Replace — ${doc?.id ?? ''}` : 'Upload Document'} wide onClose={onClose}>
      <p className="text-[12px] text-slate-500 mb-3">
        {mode === 'renew'
          ? 'Recording a fresh document creates a NEW register entry with the new expiry date. The previous record is retained as compliance evidence — documents are never deleted.'
          : 'Register a compliance document against a contractor, worker, equipment code or statutory filing. Status is derived from the expiry date you provide.'}
      </p>

      {!can('document.upload') && (
        <div role="alert" className="rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[12px] font-semibold p-3 mb-3">
          {canReason('document.upload')}
        </div>
      )}
      {error && (
        <div role="alert" className="rounded-xl bg-red-50 border border-red-200 text-red-600 text-[12px] font-semibold p-3 mb-3">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <div className="sm:col-span-2">
          <Field label="Document name *" hint="e.g. Contract Labour Licence 2026">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Document name" />
          </Field>
        </div>
        <Field label="Category">
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value as DocumentCategory)}>
            {DOCUMENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Related type">
          <select className="input" value={relatedType} onChange={(e) => setRelatedType(e.target.value as RelatedType)}>
            {RELATED_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </Field>
        <Field label="Related to *" hint={relatedHint}>
          <select className="input" value={relatedId} onChange={(e) => setRelatedId(e.target.value)}>
            {relatedOptions.length === 0 && <option value="">No options in scope</option>}
            {relatedOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="Mine" hint="The mine this document is filed against">
          <select className="input" value={mineId} onChange={(e) => setMineId(e.target.value)}>
            {mines.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.code})</option>)}
          </select>
        </Field>
        <Field label="Expiry date *" hint="Required — compliance status is derived from this date">
          <input type="date" className="input" value={expiryDate} min={mode === 'renew' ? addDays(DEMO_TODAY, 1) : undefined}
            onChange={(e) => setExpiryDate(e.target.value)} />
        </Field>
        <Field label="Size (KB)">
          <input type="number" min={1} className="input" value={sizeKb} onChange={(e) => setSizeKb(e.target.value)} />
        </Field>
      </div>

      <div className="flex items-center gap-2 pt-3 border-t border-slate-100 mt-1 flex-wrap">
        <p className="text-[11px] text-slate-400 flex-1 min-w-[220px]">
          <b className="text-slate-500">Simulated local reference.</b> This demo records document metadata in your browser
          only — no file is uploaded to any server and no regulator is notified.
        </p>
        <button type="button" onClick={onClose} className="btn-primary !bg-white !text-navy border border-slate-300">Cancel</button>
        <PermBtn perm="document.upload" onClick={submit} className="btn-primary">
          {mode === 'renew' ? 'Save renewal' : 'Upload document'}
        </PermBtn>
      </div>
    </Modal>
  );
}

// ---------- Page ----------
export default function DocumentsCompliancePage() {
  const db = useMockWorkforce();
  const kpis = computeKpis(db);

  const [tab, setTab] = useState('All Documents');
  const [status, setStatus] = useState('ALL');
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [upload, setUpload] = useState<{ mode: 'new' | 'renew'; doc?: PortalDocument } | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  // Deep link from notifications: /contractor/documents?tab=Statutory%20Compliance
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('tab');
    if (p && TABS.includes(p)) setTab(p);
  }, []);

  // --- Derived (single store; recomputed every render — the store mutates in place) ---
  const inTab = documentsInTab(db, { mineId: db.selectedMineId, tab, status: 'ALL' });
  const scoped = status === 'ALL' ? inTab : documentsInTab(db, { mineId: db.selectedMineId, tab, status });

  const needle = appliedQuery.trim().toLowerCase();
  const rows = !needle ? scoped : scoped.filter((d) => {
    const rel = relatedInfo(db, d);
    return `${d.id} ${d.name} ${d.relatedId} ${rel.label}`.toLowerCase().includes(needle);
  });

  const totalDocs = kpis.totalDocs;
  const validShare = totalDocs ? Math.round((kpis.docsValid / totalDocs) * 100) : 100;

  const mineScope = (d: PortalDocument) => db.selectedMineId === 'ALL' || d.mineId === db.selectedMineId;

  const upcoming = db.documents.filter(mineScope)
    .slice()
    .sort((a, b) => expirySortKey(a) - expirySortKey(b))
    .slice(0, 6);

  const statutoryList = db.documents
    .filter((d) => d.category === 'Statutory Compliance' && mineScope(d))
    .slice()
    .sort((a, b) => (daysUntil(a.expiryDate) ?? 0) - (daysUntil(b.expiryDate) ?? 0))
    .slice(0, 6);

  const complianceRows = db.contractors
    .map((c) => {
      const docs = db.documents.filter((d) =>
        (d.relatedType === 'contractor' || d.relatedType === 'statutory') && d.relatedId === c.id && mineScope(d));
      if (docs.length === 0) return null;
      const expired = docs.filter((d) => docStatus(d) === DocumentStatus.Expired).length;
      const ok = docs.length - expired;
      return {
        id: c.id, name: c.name, total: docs.length, ok, expired,
        pct: Math.round((ok / docs.length) * 100),
      };
    })
    .filter((r): r is { id: string; name: string; total: number; ok: number; expired: number; pct: number } => r !== null)
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 5);

  const drawerDoc = drawerId ? db.documents.find((d) => d.id === drawerId) ?? null : null;

  const scopeLabel = [
    db.selectedMineId === 'ALL' ? 'All Mines' : mineCode(db.selectedMineId),
    tab,
    status !== 'ALL' && status,
    appliedQuery && `search "${appliedQuery}"`,
  ].filter(Boolean).join(' · ');

  // --- Actions ---
  function jumpTo(t: string, s: string) {
    setTab(t);
    setStatus(s);
    window.requestAnimationFrame(() => tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  function jumpToDoc(d: PortalDocument) {
    setQuery('');
    setAppliedQuery('');
    jumpTo(d.category, docStatus(d));
  }

  function clearFilters() {
    setQuery('');
    setAppliedQuery('');
    setTab('All Documents');
    setStatus('ALL');
  }

  function downloadDoc(d: PortalDocument) {
    exportText(`minenetr-${d.id.toLowerCase()}-demo.txt`, documentText(db, d));
    toast(`Downloaded ${d.id} as a demo text file.`);
  }

  function exportRegister(out: PortalDocument[]) {
    if (out.length === 0) { toast('No documents in the current view to export.'); return; }
    const n = exportCsv(`minenetr-documents-${DEMO_TODAY}`, out, [
      ['Document ID', (d: PortalDocument) => d.id],
      ['Name', (d: PortalDocument) => d.name],
      ['Category', (d: PortalDocument) => d.category],
      ['Related Type', (d: PortalDocument) => d.relatedType],
      ['Related To', (d: PortalDocument) => relatedInfo(db, d).label],
      ['Related Id', (d: PortalDocument) => d.relatedId],
      ['Mine Code', (d: PortalDocument) => mineCode(d.mineId)],
      ['Mine', (d: PortalDocument) => mineLabel(d.mineId)],
      ['Issue Date', (d: PortalDocument) => d.issueDate],
      ['Expiry Date', (d: PortalDocument) => d.expiryDate],
      ['Days Left', (d: PortalDocument) => daysUntil(d.expiryDate) ?? ''],
      ['Status (derived)', (d: PortalDocument) => docStatus(d)],
      ['Size (KB)', (d: PortalDocument) => d.sizeKb],
      ['Uploaded By', (d: PortalDocument) => d.uploadedBy],
      ['Mock Reference', (d: PortalDocument) => d.mockRef],
    ]);
    toast(`Exported ${n} document${n === 1 ? '' : 's'} — minenetr-documents-${DEMO_TODAY}.csv`);
  }

  function openRenew(d: PortalDocument) {
    setDrawerId(null);
    setUpload({ mode: 'renew', doc: d });
  }

  const hasFilters = appliedQuery !== '' || status !== 'ALL' || tab !== 'All Documents';

  // --- Table ---
  const columns: Column<PortalDocument>[] = [
    {
      key: 'id', header: 'Doc ID', sortValue: (d) => d.id,
      render: (d) => <span className="font-mono text-[12px] font-bold text-navy">{d.id}</span>,
    },
    {
      key: 'name', header: 'Document Name', sortValue: (d) => d.name,
      render: (d) => {
        const m = CATEGORY_META[d.category];
        return (
          <div className="flex items-center gap-2 min-w-[210px]">
            <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${m.tile}`}>{m.icon}</span>
            <span className="font-semibold text-navy">{d.name}</span>
          </div>
        );
      },
    },
    {
      key: 'category', header: 'Category', sortValue: (d) => d.category,
      render: (d) => <span className="text-[12px] font-semibold text-slate-600">{CATEGORY_META[d.category].short}</span>,
    },
    {
      key: 'related', header: 'Related To', sortValue: (d) => relatedInfo(db, d).label,
      render: (d) => {
        const r = relatedInfo(db, d);
        return (
          <div className="min-w-[150px]">
            <div className="font-semibold text-navy">{r.label}</div>
            <div className="text-[11px] text-slate-400">{r.sub}</div>
          </div>
        );
      },
    },
    {
      key: 'mine', header: 'Mine', sortValue: (d) => mineCode(d.mineId),
      render: (d) => <span className="badge bg-slate-100 text-slate-600" title={mineLabel(d.mineId)}>{mineCode(d.mineId)}</span>,
    },
    { key: 'issue', header: 'Issue Date', sortValue: (d) => d.issueDate, render: (d) => fmtDate(d.issueDate) },
    {
      key: 'expiry', header: 'Expiry Date', sortValue: (d) => d.expiryDate,
      render: (d) => {
        const st = docStatus(d);
        return (
          <span className={`font-semibold ${st === DocumentStatus.Expired ? 'text-red-600' : st === DocumentStatus.ExpiringSoon ? 'text-amber-600' : 'text-slate-700'}`}>
            {fmtDate(d.expiryDate)}
          </span>
        );
      },
    },
    {
      key: 'days', header: 'Days Left', sortValue: (d) => daysUntil(d.expiryDate) ?? -999999,
      render: (d) => {
        const n = daysUntil(d.expiryDate);
        const st = docStatus(d);
        return (
          <span title={`Days from the ${fmtDate(DEMO_TODAY)} demo clock`}
            className={`font-bold ${st === DocumentStatus.Expired ? 'text-red-600' : st === DocumentStatus.ExpiringSoon ? 'text-amber-600' : 'text-slate-600'}`}>
            {n === null ? '—' : `${n}d`}
          </span>
        );
      },
    },
    {
      key: 'status', header: 'Status', sortValue: (d) => STATUS_RANK[docStatus(d)],
      render: (d) => <Pill v={docStatus(d)} />,
    },
    {
      key: 'size', header: 'Size', sortValue: (d) => d.sizeKb,
      render: (d) => <span className="text-[12px] text-slate-600">{fmtSize(d.sizeKb)}</span>,
    },
  ];

  const quickItems = [
    {
      label: 'Upload Document', icon: <Upload size={15} />, tileClass: 'bg-blue-100 text-blue-600',
      onClick: () => setUpload({ mode: 'new' }),
    },
    {
      label: 'Renew Expiring', icon: <RefreshCw size={15} />, tileClass: 'bg-amber-100 text-amber-600',
      onClick: () => { setQuery(''); setAppliedQuery(''); jumpTo('All Documents', DocumentStatus.ExpiringSoon); },
    },
    {
      label: 'Export Register', icon: <Download size={15} />, tileClass: 'bg-emerald-100 text-emerald-600',
      onClick: () => {
        if (!can('export')) { toast(canReason('export')); return; }
        exportRegister(rows);
      },
    },
    {
      label: 'View Statutory Compliance', icon: <Scale size={15} />, tileClass: 'bg-violet-100 text-violet-600',
      onClick: () => jumpTo('Statutory Compliance', 'ALL'),
    },
  ];

  return (
    <ContractorShell
      title="Documents & Compliance"
      sub="Manage all required documents, certifications and compliance records for your contracts, workers and equipment."
    >
      <PageToolbar
        period={periodLabel(addDays(DEMO_TODAY, -365), DEMO_TODAY)}
        onExport={() => exportRegister(rows)}
        exportLabel="Export Register"
        extra={(
          <PermBtn perm="document.upload" onClick={() => setUpload({ mode: 'new' })} className="btn-primary !py-1.5 !px-3 !text-[12px]">
            <span className="flex items-center gap-1.5"><Upload size={14} /> Upload Document</span>
          </PermBtn>
        )}
      />

      {/* KPI cards — clicking one applies its status filter across all categories */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
        <button type="button" onClick={() => jumpTo('All Documents', 'ALL')}
          title="Show all documents"
          className={`text-left rounded-2xl transition ${tab === 'All Documents' && status === 'ALL' ? 'ring-2 ring-blue-500' : 'hover:ring-2 hover:ring-blue-200'}`}>
          <KpiCard icon={<FileText size={22} />} label="Total Documents" value={totalDocs}
            context="Across all categories" dotColor="#7C5CFC" tileClass="bg-violet-50 text-violet-600" />
        </button>
        <button type="button" onClick={() => jumpTo('All Documents', DocumentStatus.Valid)}
          title="Show valid documents"
          className={`text-left rounded-2xl transition ${status === DocumentStatus.Valid ? 'ring-2 ring-emerald-500' : 'hover:ring-2 hover:ring-emerald-200'}`}>
          <KpiCard icon={<ShieldCheck size={22} />} label="Valid Documents" value={kpis.docsValid}
            context={`${validShare}% of total`} dotColor={CHART.green} tileClass="bg-emerald-50 text-emerald-600" />
        </button>
        <button type="button" onClick={() => jumpTo('All Documents', DocumentStatus.ExpiringSoon)}
          title="Show documents expiring within 60 days"
          className={`text-left rounded-2xl transition ${status === DocumentStatus.ExpiringSoon ? 'ring-2 ring-amber-500' : 'hover:ring-2 hover:ring-amber-200'}`}>
          <KpiCard icon={<Hourglass size={22} />} label="Expiring Soon" value={kpis.docsExpiring}
            context="Within 60 days" dotColor={CHART.amber} tileClass="bg-amber-50 text-amber-600" />
        </button>
        <button type="button" onClick={() => jumpTo('All Documents', DocumentStatus.Expired)}
          title="Show expired documents"
          className={`text-left rounded-2xl transition ${status === DocumentStatus.Expired ? 'ring-2 ring-red-500' : 'hover:ring-2 hover:ring-red-200'}`}>
          <KpiCard icon={<AlertTriangle size={22} />} label="Expired Documents" value={kpis.docsExpired}
            context="Immediate action required" dotColor={CHART.red} tileClass="bg-rose-50 text-rose-600" />
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
        {/* LEFT — tabs, filters, register table */}
        <div className="xl:col-span-2 space-y-4">
          <div className="card !p-0 overflow-hidden" ref={tableRef}>
            <Tabs tabs={TABS} active={tab} onChange={(t) => setTab(t)} />
            <div className="p-3 flex flex-wrap items-center gap-2">
              <SearchInput value={query} onChange={setQuery} onSearch={() => setAppliedQuery(query)}
                ph="Search by document name or related ID..." width="!w-64" />
              <select className="input !w-auto !py-2 !text-[13px]" value={tab} aria-label="Document category"
                onChange={(e) => setTab(e.target.value)}>
                {TABS.map((t) => <option key={t} value={t}>{t === 'All Documents' ? 'All Categories' : t}</option>)}
              </select>
              <select className="input !w-auto !py-2 !text-[13px]" value={db.selectedMineId} aria-label="Mine scope"
                onChange={(e) => actions.setSelectedMine(e.target.value)}>
                <option value="ALL">All Assigned Mines</option>
                {mines.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.code})</option>)}
              </select>
              <select className="input !w-auto !py-2 !text-[13px]" value={status} aria-label="Status filter"
                onChange={(e) => setStatus(e.target.value)}>
                <option value="ALL">All Status</option>
                <option value={DocumentStatus.Valid}>Valid</option>
                <option value={DocumentStatus.ExpiringSoon}>Expiring Soon</option>
                <option value={DocumentStatus.Expired}>Expired</option>
              </select>
              {hasFilters && (
                <button onClick={clearFilters} className="text-[12px] font-semibold text-slate-500 hover:text-navy">✕ Clear filters</button>
              )}
              <span className="ml-auto text-[12px] font-semibold text-slate-500">
                {rows.length} of {inTab.length} in tab{appliedQuery ? ` · search "${appliedQuery}"` : ''}
              </span>
            </div>
          </div>

          <div className="card">
            <DataTable
              columns={columns}
              rows={rows}
              onRowClick={(d) => setDrawerId(d.id)}
              emptyTitle="No documents found"
              emptyText={`No documents match ${tab}${status !== 'ALL' ? ` / ${status}` : ''}${needle ? ` / search "${appliedQuery}"` : ''} in the current mine scope. Try clearing the filters or switching mine.`}
              actions={(d) => (
                <div className="flex items-center gap-1.5 justify-end">
                  <RowBtn label={`View details of ${d.id}`} onClick={() => setDrawerId(d.id)}><Eye size={14} /></RowBtn>
                  <RowBtn label={`Download ${d.id} as a demo text file`} onClick={() => downloadDoc(d)}><Download size={14} /></RowBtn>
                  <PermIconBtn perm="document.upload" label={`Renew or replace ${d.id}`} onClick={() => openRenew(d)}>
                    <RefreshCw size={14} />
                  </PermIconBtn>
                </div>
              )}
            />
          </div>
        </div>

        {/* RIGHT — status donut, upcoming expirations, quick actions, statutory compliance */}
        <div className="space-y-4">
          <SectionCard title="Document Status Overview"
            subtitle={`Derived from expiry dates · demo clock ${fmtDate(DEMO_TODAY)}`}>
            {totalDocs === 0 ? (
              <EmptyState title="No documents in scope" sub="Documents for the selected mine will appear here." />
            ) : (
              <>
                <Donut
                  data={[
                    { name: DocumentStatus.Valid, value: kpis.docsValid, color: CHART.green },
                    { name: DocumentStatus.ExpiringSoon, value: kpis.docsExpiring, color: CHART.amber },
                    { name: DocumentStatus.Expired, value: kpis.docsExpired, color: CHART.red },
                  ]}
                  centerValue={String(totalDocs)}
                  centerLabel="Total Documents"
                  onPick={(s) => jumpTo('All Documents', s.name)}
                  height={180}
                />
                <div className="text-[10px] text-slate-400 text-center mt-1">Click a slice or legend row to filter the register</div>
              </>
            )}
          </SectionCard>

          <SectionCard title="Upcoming Expirations"
            action={
              <button onClick={() => jumpTo('All Documents', 'ALL')}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline">View All ›</button>
            }>
            {upcoming.length === 0 ? (
              <EmptyState title="Nothing expiring" sub="No documents are tracked in the current mine scope." />
            ) : (
              <div>
                {upcoming.map((d) => {
                  const st = docStatus(d);
                  const n = daysUntil(d.expiryDate);
                  const rel = relatedInfo(db, d);
                  return (
                    <div key={d.id} className="flex items-center gap-2 py-1.5 border-b border-slate-100 last:border-0">
                      <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${CATEGORY_META[d.category].tile}`}>
                        {CATEGORY_META[d.category].icon}
                      </span>
                      <button onClick={() => jumpToDoc(d)} className="min-w-0 flex-1 text-left group"
                        title={`Filter the register to ${CATEGORY_META[d.category].short} · ${st}`}>
                        <span className="block text-[12px] font-bold text-navy truncate group-hover:text-blue-700">{d.name}</span>
                        <span className="block text-[11px] text-slate-500 truncate">{rel.label} · {fmtDate(d.expiryDate)}</span>
                      </button>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`badge ${tone(st)}`}>
                          {n !== null && n < 0 ? `Expired ${Math.abs(n)}d ago` : `In ${n ?? 0} days`}
                        </span>
                        <PermBtn perm="document.upload" onClick={() => openRenew(d)}
                          className="btn-primary !py-1 !px-2.5 !text-[11px]" title={`Renew ${d.name}`}>
                          Renew
                        </PermBtn>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Quick Actions">
            <QuickActions items={quickItems} />
          </SectionCard>

          <SectionCard title="Statutory Compliance"
            subtitle="Statutory filings + per-contractor document health, derived from each contractor's own records"
            action={
              <button onClick={() => jumpTo('Statutory Compliance', 'ALL')}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline">Open tab ›</button>
            }>
            {statutoryList.length === 0 ? (
              <EmptyState title="No statutory documents" sub="Statutory filings for the selected mine will appear here." />
            ) : (
              <div>
                {statutoryList.map((d) => {
                  const st = docStatus(d);
                  const n = daysUntil(d.expiryDate);
                  const m = CATEGORY_META[d.category];
                  return (
                    <button key={d.id} onClick={() => setDrawerId(d.id)} title={`View ${d.id}`}
                      className="w-full flex items-center gap-2 py-1.5 border-b border-slate-100 last:border-0 hover:bg-blue-50/40 rounded-lg px-1 text-left">
                      <span className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${m.tile}`}>{m.icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12px] font-bold text-navy truncate">{d.name.replace(/\.pdf$/i, '')}</span>
                        <span className="block text-[11px] text-slate-400 truncate">{mineCode(d.mineId)} · {relatedInfo(db, d).label}</span>
                      </span>
                      <span className={`badge ${tone(st)}`}>{st}</span>
                      <span className={`text-[11px] font-bold w-16 text-right ${st === DocumentStatus.Expired ? 'text-red-600' : st === DocumentStatus.ExpiringSoon ? 'text-amber-600' : 'text-slate-500'}`}>
                        {n === null ? '—' : n < 0 ? `${Math.abs(n)}d over` : `${n}d left`}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {complianceRows.length > 0 && (
              <>
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mt-4 mb-1">Compliance by contractor</div>
                {complianceRows.map((r) => (
                  <ProgressRow key={r.id} icon={<Building2 size={14} />} label={r.name}
                    sub={`${r.ok}/${r.total} compliant · ${r.expired} expired`} pct={r.pct}
                    color={r.pct === 100 ? CHART.green : r.pct >= 80 ? CHART.amber : CHART.red} />
                ))}
              </>
            )}

            <p className="text-[11px] text-slate-400 pt-2">
              Documents are compliance evidence — records are never deleted from the portal. Renew or replace instead;
              uploads here are simulated local references.
            </p>
          </SectionCard>
        </div>
      </div>

      {/* Detail drawer */}
      {drawerDoc && (() => {
        const d = drawerDoc;
        const st = docStatus(d);
        const n = daysUntil(d.expiryDate);
        const rel = relatedInfo(db, d);
        return (
          <DetailDrawer title={d.name} wide onClose={() => setDrawerId(null)}>
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <Pill v={st} />
              <SoftPill v={d.category} cls="bg-blue-50 text-blue-700" />
              <span className="font-mono text-[12px] text-slate-500">{d.id}</span>
            </div>
            <Kv k="Related To" v={<span>{rel.label} <span className="text-slate-400 font-normal">({rel.sub})</span></span>} />
            <Kv k="Mine" v={mineLabel(d.mineId)} />
            <Kv k="Issue Date" v={fmtDate(d.issueDate)} />
            <Kv k="Expiry Date" v={fmtDate(d.expiryDate)} />
            <Kv k="Days Left" v={n === null ? '—' : n < 0 ? `Expired ${Math.abs(n)} days ago` : `${n} days remaining`} />
            <Kv k="Status" v={<span>Derived: <b>{st}</b> — expiry vs the {fmtDate(DEMO_TODAY)} demo clock (never a stored flag)</span>} />
            <Kv k="Size" v={fmtSize(d.sizeKb)} />
            <Kv k="Uploaded By" v={d.uploadedBy} />
            <Kv k="Reference" v={<span className="font-mono text-[12px]">{d.mockRef}</span>} />

            {st === DocumentStatus.Expired && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-3 mt-3 text-[12px] font-semibold text-red-600">
                This document expired {Math.abs(n ?? 0)} days ago — renew it immediately to restore compliance.
              </div>
            )}
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 mt-3 text-[12px] text-amber-800">
              <b>Compliance evidence.</b> Document records are never deleted from the portal — use Renew / Replace to
              record a fresh document while the old record stays on file. This entry is a simulated local reference;
              no file is stored on any server.
            </div>

            <div className="flex gap-2 mt-4 flex-wrap">
              <PermBtn perm="document.upload" onClick={() => openRenew(d)} className="btn-primary flex-1 flex items-center justify-center gap-1.5">
                <RefreshCw size={14} /> Renew / Replace
              </PermBtn>
              <button onClick={() => downloadDoc(d)}
                className="btn-primary !bg-white !text-navy border border-slate-300 flex-1 flex items-center justify-center gap-1.5">
                <Download size={14} /> Download (.txt)
              </button>
            </div>
          </DetailDrawer>
        );
      })()}

      {/* Non-compliance register + corrective-action workflow */}
      <ComplianceRegister />

      {/* Upload / renew modal */}
      {upload && (
        <UploadModal mode={upload.mode} doc={upload.doc} onClose={() => setUpload(null)} />
      )}
    </ContractorShell>
  );
}
