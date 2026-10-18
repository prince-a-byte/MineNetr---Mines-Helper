'use client';
/**
 * Page 8 — Documents & Compliance.
 * Document status transitions (submit/approve/reject/replace) mutate the shared
 * store, so the dashboard compliance KPI, the compliance timeline and every
 * category tab stay consistent. 7 tabs covering statutory, safety, equipment,
 * contractor and worker document sets plus the submission queue.
 */
import { useMemo, useState } from 'react';
import {
  AlertOctagon, BadgeCheck, CalendarClock, CheckCircle2, Clock, FileCheck2, FileText,
  Plus, ShieldCheck, Upload, XCircle,
} from 'lucide-react';
import OperationsShell from '../../../components/operations/OperationsShell';
import { operatorNav } from '../nav';
import {
  Column, ConfirmDialog, DataTable, DetailDrawer, EmptyState, Field, KpiCard, Kv,
  Modal, OpsBanner, QuickActions, SearchInput, SectionCard, StatusPill, Tabs, Toasts,
} from '../../../components/operations/ui';
import { Donut, VBars } from '../../../components/operations/charts';
import { TODAY, byMine, useMineScope, usePageReady, useTab } from '../../../components/operations/hooks';
import { UploadDocModal } from '../../../components/operations/modals';
import { actions, getMine, useMockOps } from '../../../lib/ops/store';
import { daysUntil, fmtDate, num, pct } from '../../../lib/ops/format';
import { exportCsv } from '../../../lib/ops/export';
import { DocumentStatus, type OpsDocument } from '../../../lib/ops/types';

const TABS = ['Overview', 'Statutory Licences', 'Safety & Environment', 'Equipment & Machinery', 'Contractor Documents', 'Worker Documents', 'Submissions & Approvals'];

const DOC_TONE: Record<string, string> = {
  [DocumentStatus.Valid]: 'bg-green-100 text-green-700',
  [DocumentStatus.ExpiringSoon]: 'bg-amber-100 text-amber-700',
  [DocumentStatus.Expired]: 'bg-red-100 text-red-600',
  [DocumentStatus.Pending]: 'bg-blue-100 text-blue-700',
  [DocumentStatus.Draft]: 'bg-slate-100 text-slate-600',
  [DocumentStatus.Rejected]: 'bg-red-100 text-red-600',
};

/** Tab → categories shown. */
const TAB_CATS: Record<string, string[] | null> = {
  'Statutory Licences': ['Statutory Licence', 'Compliance'],
  'Safety & Environment': ['Safety', 'Environment'],
  'Equipment & Machinery': ['Equipment'],
  'Contractor Documents': ['Contractor'],
  'Worker Documents': ['Worker'],
};

export default function DocumentsPage() {
  const ready = usePageReady();
  const db = useMockOps();
  const mineId = useMineScope();
  const [tab, setTab] = useTab(TABS[0]);

  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');
  const [fCat, setFCat] = useState('All Categories');
  const [fStatus, setFStatus] = useState('All Status');
  const [selected, setSelected] = useState<string[]>([]);
  const [detail, setDetail] = useState<OpsDocument | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [rejectFor, setRejectFor] = useState<OpsDocument | null>(null);

  const scopedDocs = useMemo(() => byMine(db.documents, mineId), [db.documents, mineId]);

  // ---- KPIs ----
  const k = useMemo(() => {
    const total = scopedDocs.length;
    const c = (s: DocumentStatus) => scopedDocs.filter((d) => d.status === s).length;
    return {
      total,
      valid: c(DocumentStatus.Valid),
      expiring: c(DocumentStatus.ExpiringSoon),
      expired: c(DocumentStatus.Expired),
      pending: c(DocumentStatus.Pending) + c(DocumentStatus.Draft),
      validPct: pct(c(DocumentStatus.Valid), total),
    };
  }, [scopedDocs]);

  // ---- Charts ----
  const statusDonut = useMemo(() => {
    const c = (s: DocumentStatus) => scopedDocs.filter((d) => d.status === s).length;
    return [
      { name: 'Valid', value: c(DocumentStatus.Valid), color: '#159B72' },
      { name: 'Expiring Soon', value: c(DocumentStatus.ExpiringSoon), color: '#E8A02B' },
      { name: 'Expired', value: c(DocumentStatus.Expired), color: '#DC4C58' },
      { name: 'Pending', value: c(DocumentStatus.Pending), color: '#1463D9' },
      { name: 'Draft', value: c(DocumentStatus.Draft), color: '#68788D' },
    ].filter((s) => s.value > 0);
  }, [scopedDocs]);

  const catBars = useMemo(() => {
    const m = new Map<string, number>();
    scopedDocs.forEach((d) => m.set(d.category, (m.get(d.category) ?? 0) + 1));
    return [...m.entries()].map(([name, value]) => ({ name: name.replace('Statutory Licence', 'Statutory'), value })).sort((a, b) => b.value - a.value);
  }, [scopedDocs]);

  // ---- Compliance timeline: next 6 months of expiries + pending submissions ----
  const timeline = useMemo(() => {
    const events: { date: string; label: string; status: string }[] = [];
    scopedDocs.forEach((d) => {
      const days = daysUntil(d.expiryDate);
      if (days !== null && days >= 0 && days <= 180 && (d.status === DocumentStatus.Valid || d.status === DocumentStatus.ExpiringSoon)) {
        events.push({ date: d.expiryDate!, label: `${d.name} Renewal`, status: days <= 30 ? DocumentStatus.ExpiringSoon : DocumentStatus.Valid });
      }
      if (d.status === DocumentStatus.Pending) {
        events.push({ date: d.issueDate, label: `${d.name} Review`, status: DocumentStatus.Pending });
      }
    });
    return events.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8);
  }, [scopedDocs]);

  // ---- Filtering (shared) ----
  const filtered = useMemo(() => {
    const term = dq.trim().toLowerCase();
    return scopedDocs.filter((d) =>
      (!term || `${d.name} ${d.category} ${d.refNo}`.toLowerCase().includes(term)) &&
      (fCat === 'All Categories' || d.category === fCat) &&
      (fStatus === 'All Status' || d.status === fStatus));
  }, [scopedDocs, dq, fCat, fStatus]);

  const catList = useMemo(() => ['All Categories', ...new Set(scopedDocs.map((d) => d.category))], [scopedDocs]);
  const statusList = ['All Status', DocumentStatus.Valid, DocumentStatus.ExpiringSoon, DocumentStatus.Expired, DocumentStatus.Pending, DocumentStatus.Draft, DocumentStatus.Rejected];

  function exportDocs(rows: OpsDocument[], name: string) {
    exportCsv(`${name}-${mineId === 'ALL' ? 'all-mines' : getMine(mineId)?.code ?? mineId}-${TODAY}`, rows,
      [['Name', (d: OpsDocument) => d.name], ['Category', (d) => d.category], ['Ref No.', (d) => d.refNo],
      ['Issued', (d) => d.issueDate], ['Expires', (d) => d.expiryDate ?? 'N/A'], ['Status', (d) => d.status], ['Uploaded By', (d) => d.submittedBy]]);
  }

  const docCols: Column<OpsDocument>[] = [
    { key: 'name', header: 'Document', render: (d) => (
      <span className="flex items-center gap-2">
        <span className="w-8 h-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center shrink-0"><FileText size={15} /></span>
        <span><span className="block font-bold text-navy text-[13px]">{d.name}</span><span className="block text-[11px] text-slate-400">{d.file?.name ?? 'No file'}</span></span>
      </span> ), sortValue: (d) => d.name },
    { key: 'cat', header: 'Category', render: (d) => <span className="text-slate-600">{d.category}</span>, sortValue: (d) => d.category },
    { key: 'ref', header: 'Doc No.', render: (d) => <span className="font-mono text-[12px] font-bold">{d.refNo}</span>, sortValue: (d) => d.refNo },
    { key: 'issue', header: 'Issued', render: (d) => <span className="text-[12px]">{fmtDate(d.issueDate)}</span>, sortValue: (d) => d.issueDate },
    { key: 'exp', header: 'Expires', render: (d) => { const days = daysUntil(d.expiryDate); return d.expiryDate ? <span className={`text-[12px] ${days !== null && days <= 30 ? 'font-bold text-amber-600' : ''}`}>{fmtDate(d.expiryDate)}</span> : <span className="text-slate-400">N/A</span>; }, sortValue: (d) => d.expiryDate ?? '9999' },
    { key: 'status', header: 'Status', render: (d) => <span className={`badge ${DOC_TONE[d.status]}`}>● {d.status}</span>, sortValue: (d) => d.status },
    { key: 'by', header: 'Uploaded By', render: (d) => <span className="text-[12px] text-slate-500">{d.submittedBy}</span> },
  ];

  const docActions = (d: OpsDocument) => (
    <span className="space-x-2">
      <button className="text-xs font-bold text-blue-600 hover:underline" onClick={() => setDetail(d)}>View</button>
      {d.status === DocumentStatus.Draft && (
        <button className="text-xs font-bold text-green-600 hover:underline" onClick={() => actions.submitDocument(d.id)}>Submit</button>
      )}
      {d.status === DocumentStatus.Pending && (
        <>
          <button className="text-xs font-bold text-green-600 hover:underline" onClick={() => actions.approveDocument(d.id)}>Approve</button>
          <button className="text-xs font-bold text-red-500 hover:underline" onClick={() => setRejectFor(d)}>Reject</button>
        </>
      )}
    </span>
  );

  /** Standard toolbar used by every tab. */
  const toolbar = (
    <div className="flex gap-2 flex-wrap items-center">
      <SearchInput value={q} onChange={setQ} onSearch={() => setDq(q)} ph="Search by name, category, number..." width="!w-52" />
      <select className="input !w-44 !py-2 !text-[13px]" value={fCat} onChange={(e) => setFCat(e.target.value)} aria-label="Category filter">{catList.map((c) => <option key={c}>{c}</option>)}</select>
      <select className="input !w-36 !py-2 !text-[13px]" value={fStatus} onChange={(e) => setFStatus(e.target.value)} aria-label="Status filter">{statusList.map((s) => <option key={s}>{s}</option>)}</select>
      <button className="btn-primary !py-2 !bg-white !text-blue-700 border border-blue-600" onClick={() => { setDq(''); setQ(''); setFCat('All Categories'); setFStatus('All Status'); }}>Reset</button>
      <button className="btn-primary !py-2" onClick={() => exportDocs(filtered, 'documents')}>Export</button>
      <button className="btn-primary !py-2" onClick={() => setUploadOpen(true)}><span className="inline-flex items-center gap-1"><Plus size={14} /> Upload Document</span></button>
    </div>
  );

  const filteredForTab = useMemo(() => {
    const cats = TAB_CATS[tab];
    if (!cats) return filtered;
    return filtered.filter((d) => cats.includes(d.category));
  }, [filtered, tab]);

  return (
    <OperationsShell nav={operatorNav} title="Documents & Compliance" sub="Statutory documents and compliance">
      <OpsBanner title="Documents & Compliance" sub="Manage statutory documents, licences, approvals and ensure compliance with mine regulations and DGMS requirements." />
      <div className="px-4 space-y-4">
        {!ready ? (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">{[...Array(5)].map((_, i) => <div key={i} className="card !p-4 animate-pulse"><div className="h-16 bg-slate-100 rounded-xl" /></div>)}</div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <KpiCard icon={<FileText size={22} />} label="Total Documents" value={num(k.total)} trend="+5%" context="Across all categories" tileClass="bg-blue-50 text-blue-600" />
              <KpiCard icon={<CheckCircle2 size={22} />} label="Valid Documents" value={num(k.valid)} context={`${k.validPct}% of total`} dotColor="#159B72" tileClass="bg-green-50 text-green-600" />
              <KpiCard icon={<CalendarClock size={22} />} label="Expiring Soon" value={num(k.expiring)} context={`${pct(k.expiring, k.total)}% of total`} dotColor="#E8A02B" tileClass="bg-amber-50 text-amber-600" />
              <KpiCard icon={<AlertOctagon size={22} />} label="Expired Documents" value={num(k.expired)} context={`${pct(k.expired, k.total)}% of total`} dotColor={k.expired > 0 ? '#DC4C58' : '#94a3b8'} tileClass="bg-red-50 text-red-500" />
              <KpiCard icon={<Upload size={22} />} label="Pending Submission" value={num(k.pending)} context="Require action" dotColor="#7C5CFC" tileClass="bg-purple-50 text-purple-600" />
            </div>

            <SectionCard className="!p-0 !pb-4" title="" action={null}>
              <div className="px-4 -mt-1"><Tabs tabs={TABS} active={tab} onChange={setTab} /></div>
            </SectionCard>

            {tab === 'Overview' && (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <SectionCard title="Document Status Distribution">
                  <Donut data={statusDonut} centerValue={num(k.total)} centerLabel="Total Documents" height={200} />
                </SectionCard>
                <SectionCard title="Documents by Category">
                  <VBars data={catBars} height={230} onPick={(d) => { const full = scopedDocs.find((x) => x.category.startsWith(d.name) || x.category === d.name)?.category; if (full) setFCat(full); }} />
                </SectionCard>
                <SectionCard title="Compliance Timeline" subtitle="Upcoming expiries and pending submissions">
                  {timeline.length === 0 ? <EmptyState title="No upcoming events" /> : (
                    <div className="space-y-2">
                      {timeline.map((e, i) => (
                        <div key={i} className="flex items-center gap-2 text-[12px] py-1.5 border-b border-slate-50 last:border-0">
                          <span className="font-bold text-navy w-16 shrink-0">{fmtDate(e.date).slice(0, 6)}</span>
                          <span className="flex-1 min-w-0 truncate">{e.label}</span>
                          <StatusPill v={e.status} />
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>

                <div className="xl:col-span-3">
                  <SectionCard title={`Recent Documents (${filtered.length})`} action={toolbar}>
                    <DataTable<OpsDocument> columns={docCols} rows={filtered} selectable onSelected={setSelected} onRowClick={setDetail} actions={docActions}
                      emptyTitle="No documents match" emptyText="Adjust filters or upload a document." />
                  </SectionCard>
                </div>
              </div>
            )}

            {tab === 'Submissions & Approvals' && (
              <SectionCard title="Submissions & Approvals" subtitle="Documents in draft or awaiting compliance review" action={toolbar}>
                {(() => {
                  const queue = filteredForTab.filter((d) => d.status === DocumentStatus.Draft || d.status === DocumentStatus.Pending || d.status === DocumentStatus.Rejected);
                  return queue.length === 0 ? <EmptyState title="Nothing awaiting review" sub="All documents have been processed." /> : (
                    <DataTable<OpsDocument> columns={docCols} rows={queue} selectable onSelected={setSelected} onRowClick={setDetail} actions={docActions} />
                  );
                })()}
              </SectionCard>
            )}

            {tab !== 'Overview' && tab !== 'Submissions & Approvals' && (
              <SectionCard title={`${tab} (${filteredForTab.length})`} action={toolbar}>
                <DataTable<OpsDocument> columns={docCols} rows={filteredForTab} selectable onSelected={setSelected} onRowClick={setDetail} actions={docActions}
                  emptyTitle="No documents" emptyText="No documents in this category match the filters." />
              </SectionCard>
            )}
          </>
        )}
      </div>

      {/* ---- Detail Drawer ---- */}
      {detail && (
        <DetailDrawer title={detail.name} onClose={() => setDetail(null)}>
          <Kv k="Status" v={<span className={`badge ${DOC_TONE[detail.status]}`}>● {detail.status}</span>} />
          <Kv k="Category" v={detail.category} />
          <Kv k="Reference No." v={<span className="font-mono">{detail.refNo}</span>} />
          <Kv k="Issued" v={fmtDate(detail.issueDate)} />
          <Kv k="Expires" v={detail.expiryDate ? fmtDate(detail.expiryDate) : 'N/A'} />
          <Kv k="Days to expiry" v={(() => { const d = daysUntil(detail.expiryDate); return d === null ? '—' : d < 0 ? 'Expired' : `${d} days`; })()} />
          <Kv k="Related" v={`${detail.relatedKind}: ${detail.relatedId}`} />
          <Kv k="Uploaded by" v={detail.submittedBy} />
          <Kv k="File" v={detail.file ? `${detail.file.name} (${detail.file.sizeKb} KB)` : <span className="text-slate-400">No file</span>} />
          <Kv k="Description" v={detail.description || <span className="text-slate-400">—</span>} />
          <h4 className="font-extrabold text-navy mt-4 mb-1 text-sm">History</h4>
          {detail.history.map((h, i) => (
            <div key={i} className="text-[12px] py-1 border-b border-slate-50 last:border-0">
              <span className="font-bold">{h.action}</span> — {h.note} <span className="text-slate-400">({fmtDate(h.at.slice(0, 10))} by {h.by})</span>
            </div>
          ))}
          <div className="flex gap-2 mt-4 flex-wrap">
            {detail.status === DocumentStatus.Draft && (
              <button className="btn-primary !py-2 !text-xs" onClick={() => { actions.submitDocument(detail.id); setDetail(null); }}>Submit for Review</button>
            )}
            {detail.status === DocumentStatus.Pending && (
              <>
                <button className="btn-primary !py-2 !text-xs" onClick={() => { actions.approveDocument(detail.id); setDetail(null); }}>Approve</button>
                <button className="btn-primary !py-2 !text-xs !bg-white !text-red-500 border border-red-300" onClick={() => setRejectFor(detail)}>Reject</button>
              </>
            )}
            <button className="btn-primary !py-2 !text-xs !bg-white !text-blue-700 border border-blue-600" onClick={() => actions.replaceDocumentFile(detail.id, { name: `${detail.refNo}-v2.pdf`, sizeKb: 512, uploadedAt: new Date().toISOString() })}>Replace File (demo)</button>
          </div>
          <p className="text-[11px] text-slate-400 mt-3">Files are simulated demo placeholders — no documents are uploaded to any server.</p>
        </DetailDrawer>
      )}

      {/* ---- Modals ---- */}
      {uploadOpen && <UploadDocModal mineId={mineId} onClose={() => setUploadOpen(false)} />}
      {rejectFor && <RejectDocModal doc={rejectFor} onClose={() => setRejectFor(null)} />}
      <Toasts />
    </OperationsShell>
  );
}

function RejectDocModal({ doc, onClose }: { doc: OpsDocument; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');
  return (
    <Modal title={`Reject ${doc.refNo}?`} onClose={onClose}>
      <p className="text-[12px] text-slate-600 mb-3">{doc.name} will be marked as Rejected. The uploader will need to fix and re-submit.</p>
      <Field label="Rejection reason *" error={err}>
        <textarea className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Scanned copy is unreadable" />
      </Field>
      <div className="flex gap-2 justify-end">
        <button className="btn-primary !bg-white !text-navy border border-slate-300" onClick={onClose}>Cancel</button>
        <button className="btn-primary !bg-red-600 hover:!bg-red-700" onClick={() => {
          if (!reason.trim()) { setErr('A rejection reason is required.'); return; }
          actions.rejectDocument(doc.id, reason.trim());
          onClose();
        }}>Reject Document</button>
      </div>
    </Modal>
  );
}
