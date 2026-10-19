/**
 * Reports (inspector reference page 8).
 *
 * Reads db.reports from the centralized inspections repository — a report is
 * generated automatically when an inspection is submitted, from the live
 * checklist/evidence/finding counts. Nothing here is a second, hand-typed
 * copy: submitting (or re-submitting) an inspection updates these rows.
 *
 * Filters (search + status + inspection type + submitted-date range) are
 * AND-combined and deep-linked via ?q=&status=&type=&from=&to=.
 */
'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  BarChart3, CheckCircle2, Download, ExternalLink, Eye, FileText, Info,
  ListChecks, RefreshCw, RotateCcw, Search,
} from 'lucide-react';
import { EmptyState, Field, KpiCard, Modal, SectionCard } from '../operations/ui';
import { InlineError, InspectionsToolbar, NavBtn, Stat, StatusChip } from './ui';
import { actions, inspectorName, inspectionOf, siteLabel, useMockInspections } from '../../lib/inspections/store';
import { downloadReport } from '../../lib/inspections/export';
import {
  INSPECTION_TYPES, REPORT_STATUSES,
  type InspectionReport, type ReportStatusValue,
} from '../../lib/inspections/types';
import { fmtDate, fmtDateTime } from '../../lib/inspections/format';

const PAGE_SIZE = 10;

interface Filters {
  q: string;
  status: string;
  type: string;
  from: string;
  to: string;
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : 'That action could not be completed.';
}

/** Checklist completion implied by a report's stored counts (never invented). */
function completionOf(counts: InspectionReport['counts']): number {
  const total = counts.compliant + counts.nonCompliant + counts.notApplicable + counts.notChecked;
  return total === 0 ? 0 : Math.round(((total - counts.notChecked) / total) * 100);
}

function CountChip({ tone, symbol, value, title }: {
  tone: string; symbol: string; value: number; title: string;
}) {
  return (
    <span className={`badge !text-[10px] !px-1.5 !py-0.5 ${tone}`} title={title}>
      {symbol} {value}
    </span>
  );
}

export function ReportsPage() {
  const db = useMockInspections();
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();

  const [filters, setFilters] = useState<Filters>(() => ({
    q: sp?.get('q') ?? '',
    status: sp?.get('status') ?? 'ALL',
    type: sp?.get('type') ?? 'ALL',
    from: sp?.get('from') ?? '',
    to: sp?.get('to') ?? '',
  }));
  const [term, setTerm] = useState(filters.q);
  const [page, setPage] = useState(1);
  const [viewId, setViewId] = useState<string | null>(null);
  const [error, setError] = useState('');

  function update(patch: Partial<Filters>) {
    const next = { ...filters, ...patch };
    setFilters(next);
    setPage(1);
    const params = new URLSearchParams();
    if (next.q.trim()) params.set('q', next.q.trim());
    if (next.status !== 'ALL') params.set('status', next.status);
    if (next.type !== 'ALL') params.set('type', next.type);
    if (next.from) params.set('from', next.from);
    if (next.to) params.set('to', next.to);
    const qs = params.toString();
    router.replace(qs ? `${path}?${qs}` : path, { scroll: false });
  }

  function clearFilters() {
    setTerm('');
    update({ q: '', status: 'ALL', type: 'ALL', from: '', to: '' });
  }

  const activeFilters = Boolean(
    filters.q || filters.status !== 'ALL' || filters.type !== 'ALL' || filters.from || filters.to,
  );

  const scoped = useMemo(
    () => db.reports
      .filter((r) => db.selectedMineId === 'ALL' || r.mineId === db.selectedMineId)
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)),
    [db],
  );

  const filtered = useMemo(() => {
    const needle = filters.q.trim().toLowerCase();
    return scoped.filter((r) => {
      if (filters.status !== 'ALL' && r.status !== filters.status) return false;
      if (filters.type !== 'ALL' && r.type !== filters.type) return false;
      if (filters.from && r.submittedAt.slice(0, 10) < filters.from) return false;
      if (filters.to && r.submittedAt.slice(0, 10) > filters.to) return false;
      if (needle) {
        const mine = siteLabel(db, r.mineId);
        const hay = [r.id, r.title, r.inspectionId, mine].join(' ').toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [scoped, filters, db]);

  const kpis = useMemo(() => {
    const list = scoped;
    const count = (s: ReportStatusValue) => list.filter((r) => r.status === s).length;
    const avg = list.length
      ? Math.round(list.reduce((a, r) => a + completionOf(r.counts), 0) / list.length)
      : 0;
    return {
      total: list.length,
      submitted: count('Submitted'),
      review: count('Under Review'),
      approved: count('Approved'),
      changes: count('Changes Requested'),
      avg,
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
  const viewReport = viewId ? db.reports.find((r) => r.id === viewId) ?? null : null;

  function download(r: InspectionReport) {
    setError('');
    const inspection = inspectionOf(db, r.inspectionId);
    try {
      downloadReport(r, {
        mineLabel: siteLabel(db, r.mineId),
        inspector: inspectorName(db, r.inspectorId),
        scheduledDate: inspection?.scheduledDate ?? r.submittedAt.slice(0, 10),
        type: r.type,
        title: r.title,
      });
      actions.logDownload(r.inspectionId, 'report', `${r.id} — ${r.title}`);
    } catch (e) {
      setError(msg(e));
    }
  }

  return (
    <div className="space-y-4">
      <InspectionsToolbar />

      {/* KPI strip — derived from db.reports inside the active mine scope */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard icon={<BarChart3 size={22} />} label="Total reports" value={kpis.total}
          context={scopeLabel} tileClass="bg-blue-50 text-blue-600" />
        <KpiCard icon={<FileText size={22} />} label="Submitted" value={kpis.submitted}
          context="awaiting review" dotColor="#1463D9" tileClass="bg-blue-50 text-blue-600" />
        <KpiCard icon={<Eye size={22} />} label="Under review" value={kpis.review}
          context="operator reviewing" dotColor="#7C5CFC" tileClass="bg-purple-50 text-purple-600" />
        <KpiCard icon={<CheckCircle2 size={22} />} label="Approved" value={kpis.approved}
          context="closed out" dotColor="#159B72" tileClass="bg-emerald-50 text-emerald-600" />
        <KpiCard icon={<RefreshCw size={22} />} label="Changes requested" value={kpis.changes}
          context="needs revision" dotColor="#E8A02B" tileClass="bg-amber-50 text-amber-600" />
        <KpiCard icon={<ListChecks size={22} />} label="Avg. checklist completion" value={`${kpis.avg}%`}
          context="across generated reports" dotColor="#159B72" tileClass="bg-emerald-50 text-emerald-600" />
      </div>

      {/* Filters — every control narrows the same list (AND) */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') update({ q: term }); if (e.key === 'Escape') clearFilters(); }}
            placeholder="Search report, inspection or mine…"
            aria-label="Search reports"
            className="input !w-80 !pl-9"
          />
        </div>
        <button className="btn-primary !py-2" onClick={() => update({ q: term })}>Search</button>

        <select className="input !w-48 !py-2 !text-[13px]" aria-label="Filter by report status"
          value={filters.status} onChange={(e) => update({ status: e.target.value })}>
          <option value="ALL">All report statuses</option>
          {REPORT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="input !w-60 !py-2 !text-[13px]" aria-label="Filter by inspection type"
          value={filters.type} onChange={(e) => update({ type: e.target.value })}>
          <option value="ALL">All inspection types</option>
          {INSPECTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input type="date" className="input !w-40 !py-2 !text-[13px]" aria-label="Submitted from"
          title="Submitted from (inclusive)" value={filters.from} onChange={(e) => update({ from: e.target.value })} />
        <input type="date" className="input !w-40 !py-2 !text-[13px]" aria-label="Submitted to"
          title="Submitted to (inclusive)" value={filters.to} onChange={(e) => update({ to: e.target.value })} />

        {activeFilters && (
          <button className="btn-ghost !py-2" onClick={clearFilters}>
            <RotateCcw size={13} className="inline mr-1" /> Clear filters
          </button>
        )}
        <span className="text-[12px] text-slate-500 font-semibold">
          Showing {from}–{to} of {total} report{total === 1 ? '' : 's'}
        </span>
      </div>

      <InlineError error={error} onDismiss={() => setError('')} />

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[11.5px] text-slate-600 flex items-start gap-2">
        <Info size={14} className="text-blue-600 mt-0.5 shrink-0" />
        <span>
          <b className="text-navy">Synthetic DEMO exports.</b> Every report below is generated in the
          browser from fictional demonstration data when an inspection is submitted. The downloadable
          file is a watermarked text sample — it is <b>not</b> a DGMS submission and must not be used
          as a statutory record.
        </span>
      </div>

      <SectionCard
        title="Inspection reports"
        subtitle={`${total} matching ${total === 1 ? 'report' : 'reports'} of ${scoped.length} in ${scopeLabel.toLowerCase()} · generated automatically on submission`}
        action={activeFilters ? (
          <button className="text-xs font-bold text-blue-600 hover:underline" onClick={clearFilters}>Reset</button>
        ) : undefined}
      >
        {pageRows.length === 0 ? (
          scoped.length === 0 ? (
            <EmptyState
              title="No reports yet"
              sub="Reports are generated automatically when you submit an inspection."
              action={<NavBtn href="/inspector/inspections" icon={<ExternalLink size={13} />}>
                Go to My Inspections
              </NavBtn>}
            />
          ) : (
            <EmptyState
              title="No reports match your current filters."
              sub="Try another status, inspection type or submission date range — or clear the filters."
              action={<button className="btn-primary !py-2" onClick={clearFilters}>Clear filters</button>}
            />
          )
        ) : (
          <div className="overflow-x-auto -mx-2 px-2">
            <table className="dense w-full min-w-[1240px]">
              <thead>
                <tr>
                  <th>Report ID</th><th>Title</th><th>Inspection</th><th>Mine</th><th>Type</th>
                  <th>Inspector</th><th>Submitted</th><th>Status</th><th>Counts</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r) => (
                  <tr key={r.id} className="cursor-pointer hover:bg-blue-50/50"
                    onClick={() => { setError(''); setViewId(r.id); }}>
                    <td className="font-bold text-navy whitespace-nowrap">{r.id}</td>
                    <td className="text-[12.5px] max-w-[240px]">
                      <span className="line-clamp-2" title={r.title}>{r.title}</span>
                    </td>
                    <td className="whitespace-nowrap">
                      <Link href={`/inspector/inspections/${r.inspectionId}?tab=Documents`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-semibold text-blue-700 hover:underline"
                        title="Open the source inspection's documents tab">
                        {r.inspectionId}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap font-semibold text-navy">{siteLabel(db, r.mineId).split(' · ')[0]}</td>
                    <td className="text-[12.5px] whitespace-nowrap">{r.type}</td>
                    <td className="text-[12.5px] whitespace-nowrap">{inspectorName(db, r.inspectorId)}</td>
                    <td className="whitespace-nowrap text-slate-600">
                      {fmtDate(r.submittedAt)}
                      <span className="badge bg-slate-100 text-slate-600 !text-[10px] ml-1.5">v{r.version}</span>
                    </td>
                    <td><StatusChip v={r.status} /></td>
                    <td>
                      <div className="flex items-center gap-1">
                        <CountChip tone="bg-emerald-100 text-emerald-700" symbol="✔" value={r.counts.compliant} title={`${r.counts.compliant} compliant checks`} />
                        <CountChip tone="bg-red-100 text-red-600" symbol="✖" value={r.counts.nonCompliant} title={`${r.counts.nonCompliant} non-compliant checks`} />
                        <CountChip tone="bg-blue-100 text-blue-700" symbol="📎" value={r.counts.evidence} title={`${r.counts.evidence} evidence records`} />
                        <CountChip tone="bg-amber-100 text-amber-700" symbol="⚑" value={r.counts.findings} title={`${r.counts.findings} findings raised`} />
                      </div>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => { setError(''); setViewId(r.id); }}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-bold text-navy hover:border-blue-300 hover:bg-blue-50"
                          title="Open the report, its summary and counts">
                          View
                        </button>
                        <Link href={`/inspector/inspections/${r.inspectionId}?tab=Documents`}
                          className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-navy hover:border-blue-300 hover:bg-blue-50"
                          title="Open the source inspection" aria-label={`Open ${r.inspectionId}`}>
                          <ExternalLink size={14} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex flex-wrap items-center gap-2 pt-3 mt-1 border-t border-slate-100 text-[12px] text-slate-500">
              <span>Showing {from}–{to} of {total} report{total === 1 ? '' : 's'}</span>
              <div className="ml-auto flex items-center gap-2">
                <button className="btn-secondary !py-1.5 !px-3 !text-[12px]" disabled={safePage <= 1}
                  onClick={() => setPage(safePage - 1)} title="Previous page">Prev</button>
                <span className="font-semibold text-navy">Page {safePage} of {totalPages}</span>
                <button className="btn-secondary !py-1.5 !px-3 !text-[12px]" disabled={safePage >= totalPages}
                  onClick={() => setPage(safePage + 1)} title="Next page">Next</button>
              </div>
            </div>
          </div>
        )}
      </SectionCard>

      {viewReport && (
        <ReportViewModal reportId={viewReport.id} onClose={() => setViewId(null)} onError={setError} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Report view modal
// ---------------------------------------------------------------------------

function ReportViewModal({ reportId, onClose, onError }: {
  reportId: string; onClose: () => void; onError: (m: string) => void;
}) {
  const db = useMockInspections();
  const report = db.reports.find((r) => r.id === reportId);
  if (!report) return null;
  const inspection = inspectionOf(db, report.inspectionId);
  const site = siteOfSafe(db, report.mineId);

  function download() {
    try {
      downloadReport(report, {
        mineLabel: siteLabel(db, report.mineId),
        inspector: inspectorName(db, report.inspectorId),
        scheduledDate: inspection?.scheduledDate ?? report.submittedAt.slice(0, 10),
        type: report.type,
        title: report.title,
      });
      actions.logDownload(report.inspectionId, 'report', `${report.id} — ${report.title}`);
    } catch (e) {
      onError(msg(e));
    }
  }

  return (
    <Modal title={`${report.id} · ${report.title}`} onClose={onClose} wide>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip v={report.status} />
          <span className="badge bg-slate-100 text-slate-600 !text-[10px]">Version {report.version}</span>
          <span className="badge bg-slate-100 text-slate-600 !text-[10px]">{report.type}</span>
          <span className="ml-auto text-[11px] text-slate-400">Generated on submission · DEMO</span>
        </div>

        <dl className="grid sm:grid-cols-2 gap-x-4 gap-y-1.5 text-[12.5px] rounded-xl border border-slate-200 bg-slate-50/60 p-3">
          <div className="flex gap-2"><dt className="text-slate-500 w-28 shrink-0">Report ID</dt>
            <dd className="font-semibold text-navy">{report.id}</dd></div>
          <div className="flex gap-2"><dt className="text-slate-500 w-28 shrink-0">Status</dt>
            <dd className="font-semibold text-navy">{report.status}</dd></div>
          <div className="flex gap-2"><dt className="text-slate-500 w-28 shrink-0">Inspection</dt>
            <dd className="font-semibold text-navy min-w-0 truncate">{report.inspectionId}</dd></div>
          <div className="flex gap-2"><dt className="text-slate-500 w-28 shrink-0">Mine</dt>
            <dd className="font-semibold text-navy min-w-0 truncate">{site ? `${site.code} · ${site.name}` : siteLabel(db, report.mineId)}</dd></div>
          <div className="flex gap-2"><dt className="text-slate-500 w-28 shrink-0">Type</dt>
            <dd className="font-semibold text-navy">{report.type}</dd></div>
          <div className="flex gap-2"><dt className="text-slate-500 w-28 shrink-0">Inspector</dt>
            <dd className="font-semibold text-navy">{inspectorName(db, report.inspectorId)}</dd></div>
          <div className="flex gap-2"><dt className="text-slate-500 w-28 shrink-0">Scheduled</dt>
            <dd className="font-semibold text-navy">{inspection ? fmtDate(inspection.scheduledDate) : '—'}</dd></div>
          <div className="flex gap-2"><dt className="text-slate-500 w-28 shrink-0">Submitted</dt>
            <dd className="font-semibold text-navy">{fmtDateTime(report.submittedAt)}</dd></div>
          <div className="flex gap-2"><dt className="text-slate-500 w-28 shrink-0">Reviewed</dt>
            <dd className="font-semibold text-navy">{report.reviewedAt ? fmtDateTime(report.reviewedAt) : 'Not reviewed yet'}</dd></div>
        </dl>

        <div>
          <div className="text-[12.5px] font-extrabold text-navy mb-1">Summary</div>
          <p className="text-[12.5px] text-slate-700 leading-relaxed whitespace-pre-line">{report.summary}</p>
        </div>

        <div>
          <div className="text-[12.5px] font-extrabold text-navy mb-1.5">Checklist counts</div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            <div className="rounded-xl border border-slate-200 bg-white p-2">
              <Stat label="Compliant" value={report.counts.compliant} cls="text-emerald-600" />
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-2">
              <Stat label="Non-compliant" value={report.counts.nonCompliant} cls="text-red-600" />
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-2">
              <Stat label="Not applicable" value={report.counts.notApplicable} />
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-2">
              <Stat label="Not checked" value={report.counts.notChecked} cls="text-amber-600" />
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-2">
              <Stat label="Evidence" value={report.counts.evidence} cls="text-blue-600" />
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-2">
              <Stat label="Findings" value={report.counts.findings} cls="text-orange-600" />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-1.5">
            Checklist completion: <b>{completionOf(report.counts)}%</b> — derived from the stored counts
            above, exactly as they were when the inspection was submitted.
          </p>
        </div>

        <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-[11.5px] text-slate-600">
          This report is a synthetic DEMO export generated in the browser. It is <b>not</b> a DGMS
          submission and carries no statutory value.
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
          <NavBtn href={`/inspector/inspections/${report.inspectionId}?tab=Documents`}
            icon={<ExternalLink size={13} />}>
            Open inspection
          </NavBtn>
          <div className="ml-auto flex gap-2">
            <button className="btn-secondary !py-2 !text-[12px]" onClick={onClose}>Close</button>
            <button className="btn-primary !py-2 !text-[12px]" onClick={download}>
              <Download size={13} className="inline mr-1" /> Download report
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/** siteOf() falls back to the first site — reports keep their own mine label. */
function siteOfSafe(db: ReturnType<typeof useMockInspections>, mineId: string) {
  return db.sites.find((s) => s.id === mineId);
}
