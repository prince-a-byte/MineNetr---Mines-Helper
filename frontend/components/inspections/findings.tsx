/**
 * Findings & Observations (inspector reference page 6).
 *
 * Reads db.findings from the centralized inspections repository — the SAME
 * records My Inspections writes to. A finding raised inside an inspection
 * workflow appears here immediately, and advancing its status here updates that
 * inspection's open-finding count and the sidebar badge, because neither page
 * keeps its own copy.
 *
 * Filters (search + severity + status + category + detected-date range) are
 * AND-combined and deep-linked via ?q=&severity=&status=&category=&from=&to=.
 */
'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle, Camera, CheckCircle2, Download, ExternalLink, Eye, Paperclip,
  Plus, RotateCcw, Search, ShieldAlert, TriangleAlert, Wrench,
} from 'lucide-react';
import { DetailDrawer, EmptyState, Field, KpiCard, Kv, Modal, SectionCard } from '../operations/ui';
import { InlineError, InspectionsToolbar, NavBtn, PermBtn, StatusChip } from './ui';
import {
  actions, inspectorName, inspectionOf, itemsOf, siteLabel, siteOf, useMockInspections,
} from '../../lib/inspections/store';
import { downloadFindingsCsv } from '../../lib/inspections/export';
import {
  DEMO_TODAY, FindingCategory, FINDING_STATUSES, FindingSource, Severity,
  type Evidence, type FindingStatusValue, type Inspection, type InspectionFinding,
} from '../../lib/inspections/types';
import { fmtDate, fmtDateTime, fmtSize } from '../../lib/inspections/format';

/** Severity badge tones — red / orange / amber / slate per the design spec. */
const SEVERITY_TONE: Record<string, string> = {
  Critical: 'bg-red-100 text-red-600',
  High: 'bg-orange-100 text-orange-700',
  Medium: 'bg-amber-100 text-amber-700',
  Low: 'bg-slate-200 text-slate-600',
  Informational: 'bg-slate-100 text-slate-500',
};

const PAGE_SIZE = 10;

interface Filters {
  q: string;
  severity: string;
  status: string;
  category: string;
  from: string;
  to: string;
}

interface FindingLine {
  finding: InspectionFinding;
  inspection?: Inspection;
  mineId: string;
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : 'That action could not be completed.';
}

export function FindingsPage() {
  const db = useMockInspections();
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();

  const [filters, setFilters] = useState<Filters>(() => ({
    q: sp?.get('q') ?? '',
    severity: sp?.get('severity') ?? 'ALL',
    status: sp?.get('status') ?? 'ALL',
    category: sp?.get('category') ?? 'ALL',
    from: sp?.get('from') ?? '',
    to: sp?.get('to') ?? '',
  }));
  const [term, setTerm] = useState(filters.q);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [error, setError] = useState('');

  // ---- deep-linked filter state (URL is written on every change) -----------
  function update(patch: Partial<Filters>) {
    const next = { ...filters, ...patch };
    setFilters(next);
    setPage(1);
    const params = new URLSearchParams();
    if (next.q.trim()) params.set('q', next.q.trim());
    if (next.severity !== 'ALL') params.set('severity', next.severity);
    if (next.status !== 'ALL') params.set('status', next.status);
    if (next.category !== 'ALL') params.set('category', next.category);
    if (next.from) params.set('from', next.from);
    if (next.to) params.set('to', next.to);
    const qs = params.toString();
    router.replace(qs ? `${path}?${qs}` : path, { scroll: false });
  }

  function clearFilters() {
    setTerm('');
    update({ q: '', severity: 'ALL', status: 'ALL', category: 'ALL', from: '', to: '' });
  }

  const activeFilters = Boolean(
    filters.q || filters.severity !== 'ALL' || filters.status !== 'ALL'
    || filters.category !== 'ALL' || filters.from || filters.to,
  );

  // ---- dataset: mine scope first (findings resolve their mine via the inspection)
  const scoped = useMemo<FindingLine[]>(() => {
    const scope = db.selectedMineId;
    return db.findings
      .map((finding) => {
        const inspection = inspectionOf(db, finding.inspectionId);
        return { finding, inspection, mineId: inspection?.mineId ?? finding.mineId };
      })
      .filter((l) => scope === 'ALL' || l.mineId === scope)
      .sort((a, b) => b.finding.detectedAt.localeCompare(a.finding.detectedAt));
  }, [db]);

  const filtered = useMemo(() => {
    const term2 = filters.q.trim().toLowerCase();
    return scoped.filter((l) => {
      const f = l.finding;
      if (filters.severity !== 'ALL' && f.severity !== filters.severity) return false;
      if (filters.status !== 'ALL' && f.status !== filters.status) return false;
      if (filters.category !== 'ALL' && f.category !== filters.category) return false;
      if (filters.from && f.detectedAt.slice(0, 10) < filters.from) return false;
      if (filters.to && f.detectedAt.slice(0, 10) > filters.to) return false;
      if (term2) {
        const hay = [f.id, f.inspectionId, f.description, f.recommendation, f.location, f.assignee]
          .join(' ').toLowerCase();
        if (!hay.includes(term2)) return false;
      }
      return true;
    });
  }, [scoped, filters]);

  const kpis = useMemo(() => {
    const list = scoped.map((l) => l.finding);
    const unresolved = list.filter((f) => f.status !== 'Resolved');
    const critical = list.filter((f) => f.severity === 'Critical').length;
    const high = list.filter((f) => f.severity === 'High').length;
    return {
      total: list.length,
      open: list.filter((f) => f.status === 'Open').length,
      review: list.filter((f) => f.status === 'Under Review').length,
      corrective: list.filter((f) => f.status === 'Corrective Action Required').length,
      resolved: list.filter((f) => f.status === 'Resolved').length,
      critical, high,
      overdue: unresolved.filter((f) => f.dueDate < DEMO_TODAY).length,
    };
  }, [scoped]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const from = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const to = Math.min(safePage * PAGE_SIZE, total);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const selected = selectedId ? db.findings.find((f) => f.id === selectedId) ?? null : null;
  const scopeLabel = db.selectedMineId === 'ALL'
    ? 'All assigned mines' : siteLabel(db, db.selectedMineId);

  function exportCsv() {
    setError('');
    if (filtered.length === 0) {
      setError('There are no findings in the current view to export. Adjust or clear the filters first.');
      return;
    }
    try {
      downloadFindingsCsv(filtered.map((l) => l.finding));
    } catch (e) {
      setError(msg(e));
    }
  }

  return (
    <div className="space-y-4">
      <InspectionsToolbar
        extra={(
          <PermBtn perm="canCreateFinding" onClick={() => { setError(''); setCreateOpen(true); }} className="btn-primary !py-2">
            <span className="flex items-center gap-1.5"><Plus size={14} /> Create finding</span>
          </PermBtn>
        )}
      />

      {/* KPI strip — derived from db.findings inside the active mine scope */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard icon={<TriangleAlert size={22} />} label="Total findings" value={kpis.total}
          context={scopeLabel} tileClass="bg-blue-50 text-blue-600" />
        <KpiCard icon={<AlertCircle size={22} />} label="Open" value={kpis.open}
          context={kpis.overdue > 0 ? `${kpis.overdue} past due` : 'none past due'}
          contextTone={kpis.overdue > 0 ? 'text-red-500' : undefined} dotColor="#DC4C58"
          tileClass="bg-red-50 text-red-600" />
        <KpiCard icon={<Eye size={22} />} label="Under review" value={kpis.review}
          context="awaiting verification" dotColor="#1463D9" tileClass="bg-blue-50 text-blue-600" />
        <KpiCard icon={<Wrench size={22} />} label="Corrective action" value={kpis.corrective}
          context="fix assigned" dotColor="#E8A02B" tileClass="bg-amber-50 text-amber-600" />
        <KpiCard icon={<CheckCircle2 size={22} />} label="Resolved" value={kpis.resolved}
          context={`${kpis.total ? Math.round((kpis.resolved / kpis.total) * 100) : 0}% of all findings`}
          dotColor="#159B72" tileClass="bg-emerald-50 text-emerald-600" />
        <KpiCard icon={<ShieldAlert size={22} />} label="Critical + High" value={kpis.critical + kpis.high}
          context={`${kpis.critical} critical · ${kpis.high} high`} dotColor="#DC4C58"
          tileClass="bg-orange-50 text-orange-600" />
      </div>

      {/* Filters — every control narrows the same list (AND) */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') update({ q: term }); if (e.key === 'Escape') clearFilters(); }}
            placeholder="Search ID, inspection, description, location…"
            aria-label="Search findings"
            className="input !w-80 !pl-9"
          />
        </div>
        <button className="btn-primary !py-2" onClick={() => update({ q: term })}>Search</button>

        <select className="input !w-44 !py-2 !text-[13px]" aria-label="Filter by severity"
          value={filters.severity} onChange={(e) => update({ severity: e.target.value })}>
          <option value="ALL">All severities</option>
          {Object.values(Severity).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="input !w-52 !py-2 !text-[13px]" aria-label="Filter by status"
          value={filters.status} onChange={(e) => update({ status: e.target.value })}>
          <option value="ALL">All statuses</option>
          {FINDING_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="input !w-48 !py-2 !text-[13px]" aria-label="Filter by category"
          value={filters.category} onChange={(e) => update({ category: e.target.value })}>
          <option value="ALL">All categories</option>
          {Object.values(FindingCategory).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input type="date" className="input !w-40 !py-2 !text-[13px]" aria-label="Detected from"
          title="Detected from (inclusive)" value={filters.from} onChange={(e) => update({ from: e.target.value })} />
        <input type="date" className="input !w-40 !py-2 !text-[13px]" aria-label="Detected to"
          title="Detected to (inclusive)" value={filters.to} onChange={(e) => update({ to: e.target.value })} />

        {activeFilters && (
          <button className="btn-ghost !py-2" onClick={clearFilters}>
            <RotateCcw size={13} className="inline mr-1" /> Clear filters
          </button>
        )}
        <span className="text-[12px] text-slate-500 font-semibold">
          Showing {from}–{to} of {total} finding{total === 1 ? '' : 's'}
        </span>

        <div className="ml-auto">
          <button className="btn-secondary !py-2 !text-[12px]" onClick={exportCsv}
            title="Download the findings currently shown as a watermarked DEMO CSV">
            <Download size={13} className="inline mr-1" /> Export CSV
          </button>
        </div>
      </div>

      <InlineError error={error} onDismiss={() => setError('')} />

      <SectionCard
        title="Findings register"
        subtitle={`${total} matching ${total === 1 ? 'record' : 'records'} of ${scoped.length} in ${scopeLabel.toLowerCase()} · status changes here update the inspection record`}
        action={activeFilters ? (
          <button className="text-xs font-bold text-blue-600 hover:underline" onClick={clearFilters}>Reset</button>
        ) : undefined}
      >
        {pageRows.length === 0 ? (
          scoped.length === 0 ? (
            <EmptyState
              title="No findings have been recorded for this mine yet."
              sub="Findings are raised from an inspection's Evidence & Observations step, or with the Create finding button above."
              action={<button className="btn-primary !py-2" onClick={() => setCreateOpen(true)} disabled={db.role === 'Read-Only Viewer'}
                title={db.role === 'Read-Only Viewer' ? 'The Read-Only Viewer demo role cannot raise findings.' : 'Record a new observation against an inspection.'}>
                Create finding
              </button>}
            />
          ) : (
            <EmptyState
              title="No findings match your current filters."
              sub="Try adjusting the severity, status, category or date range — or clear the filters to see the full register."
              action={<button className="btn-primary !py-2" onClick={clearFilters}>Clear filters</button>}
            />
          )
        ) : (
          <div className="overflow-x-auto -mx-2 px-2">
            <table className="dense w-full min-w-[1320px]">
              <thead>
                <tr>
                  <th>Finding ID</th><th>Inspection</th><th>Mine</th><th>Category</th>
                  <th>Severity</th><th>Status</th><th>Location</th><th>Description</th>
                  <th>Assignee</th><th>Detected</th><th>Due</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map(({ finding, inspection, mineId }) => {
                  const overdue = finding.status !== 'Resolved' && finding.dueDate < DEMO_TODAY;
                  const site = siteOf(db, mineId);
                  return (
                    <tr key={finding.id}
                      className="cursor-pointer hover:bg-blue-50/50"
                      onClick={() => { setError(''); setSelectedId(finding.id); }}>
                      <td className="font-bold text-navy whitespace-nowrap">{finding.id}</td>
                      <td className="whitespace-nowrap">
                        <Link href={`/inspector/inspections/${finding.inspectionId}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-semibold text-blue-700 hover:underline"
                          title={inspection ? inspection.title : 'Open the source inspection'}>
                          {finding.inspectionId}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap font-semibold text-navy">{site.code}</td>
                      <td className="text-[12.5px] whitespace-nowrap">{finding.category}</td>
                      <td><span className={`badge ${SEVERITY_TONE[finding.severity] ?? 'bg-slate-200 text-slate-700'}`}>{finding.severity}</span></td>
                      <td><StatusChip v={finding.status} /></td>
                      <td className="text-[12.5px] whitespace-nowrap">{finding.location}</td>
                      <td className="text-[12.5px] max-w-[260px]">
                        <span className="line-clamp-2" title={finding.description}>{finding.description}</span>
                      </td>
                      <td className="text-[12.5px] whitespace-nowrap">{finding.assignee}</td>
                      <td className="whitespace-nowrap text-slate-600">{fmtDateTime(finding.detectedAt)}</td>
                      <td className={`whitespace-nowrap ${overdue ? 'text-red-600 font-bold' : ''}`}>
                        {fmtDate(finding.dueDate)}
                        {overdue && <span className="badge bg-red-100 text-red-600 !text-[10px] ml-1.5">Past due</span>}
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => { setError(''); setSelectedId(finding.id); }}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-bold text-navy hover:border-blue-300 hover:bg-blue-50"
                            title="Open the full finding, its evidence and the status workflow">
                            View
                          </button>
                          <Link href={`/inspector/inspections/${finding.inspectionId}`}
                            className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-navy hover:border-blue-300 hover:bg-blue-50"
                            title="Open the source inspection" aria-label={`Open ${finding.inspectionId}`}>
                            <ExternalLink size={14} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="flex flex-wrap items-center gap-2 pt-3 mt-1 border-t border-slate-100 text-[12px] text-slate-500">
              <span>Showing {from}–{to} of {total} finding{total === 1 ? '' : 's'}</span>
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

      {selected && (
        <FindingDrawer finding={selected} onClose={() => setSelectedId(null)} />
      )}

      {createOpen && (
        <CreateFindingModal
          onClose={() => setCreateOpen(false)}
          onCreated={(id) => { setCreateOpen(false); setSelectedId(id); }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail drawer — full record + evidence + the status workflow
// ---------------------------------------------------------------------------

function FindingDrawer({ finding, onClose }: { finding: InspectionFinding; onClose: () => void }) {
  const db = useMockInspections();
  const [err, setErr] = useState('');
  const [evidenceId, setEvidenceId] = useState<string | null>(null);

  const inspection = inspectionOf(db, finding.inspectionId);
  const site = siteOf(db, inspection?.mineId ?? finding.mineId);
  const overdue = finding.status !== 'Resolved' && finding.dueDate < DEMO_TODAY;
  const canAdvance = db.role !== 'Read-Only Viewer';

  const linkedEvidence = finding.evidence
    .map((id) => db.evidence.find((e) => e.id === id))
    .filter((e): e is Evidence => Boolean(e));
  const missingEvidence = finding.evidence.filter((id) => !db.evidence.some((e) => e.id === id));

  function advance(status: FindingStatusValue) {
    setErr('');
    try {
      actions.updateFindingStatus(finding.id, status);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not update the finding status.');
    }
  }

  return (
    <DetailDrawer title={`Finding ${finding.id}`} onClose={onClose} wide>
      <InlineError error={err} onDismiss={() => setErr('')} />

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className={`badge ${SEVERITY_TONE[finding.severity] ?? 'bg-slate-200 text-slate-700'}`}>{finding.severity}</span>
        <span className="badge bg-slate-100 text-slate-600">{finding.category}</span>
        <StatusChip v={finding.status} />
        <span className="badge bg-slate-100 text-slate-500 !text-[10px]">Source: {finding.source}</span>
        <span className="ml-auto text-[11px] text-slate-400">{finding.verifiedHuman ? 'Human verified' : 'Unverified'}</span>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 mb-3">
        <div className="text-[12.5px] font-extrabold text-navy">Description</div>
        <p className="text-[12.5px] text-slate-700 mt-1 whitespace-pre-line">{finding.description}</p>
        <div className="text-[12.5px] font-extrabold text-navy mt-3">Recommendation</div>
        <p className="text-[12.5px] text-slate-700 mt-1 whitespace-pre-line">
          {finding.recommendation.trim() || '— no corrective recommendation recorded yet —'}
        </p>
      </div>

      <Kv k="Inspection" v={
        <Link href={`/inspector/inspections/${finding.inspectionId}`} className="text-blue-700 hover:underline">
          {finding.inspectionId}{inspection ? ` · ${inspection.type}` : ''}
        </Link>
      } />
      <Kv k="Mine" v={`${site.code} · ${site.name}`} />
      <Kv k="Inspector" v={inspectorName(db, finding.inspectorId)} />
      <Kv k="Assignee" v={finding.assignee} />
      <Kv k="Location" v={finding.location} />
      <Kv k="Detected" v={fmtDateTime(finding.detectedAt)} />
      <Kv k="Due date" v={
        overdue
          ? <span className="text-red-600 font-bold">{fmtDate(finding.dueDate)} · past due</span>
          : fmtDate(finding.dueDate)
      } />
      <Kv k="Checklist item" v={
        finding.itemId ? (
          <Link href={`/inspector/inspections/${finding.inspectionId}?tab=Inspection%20Checklist`}
            className="text-blue-700 hover:underline">{finding.itemId}</Link>
        ) : 'Not raised from a checklist item'
      } />

      {/* Linked evidence */}
      <div className="font-extrabold text-navy text-[13px] mt-4 mb-1.5">
        Linked evidence ({linkedEvidence.length})
      </div>
      {linkedEvidence.length === 0 && missingEvidence.length === 0 ? (
        <p className="text-[12px] text-slate-500">
          No evidence records are linked to this finding yet. Attach them from Photos & Evidence —
          evidence removed there is automatically unlinked here.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {linkedEvidence.map((e) => (
            <button key={e.id} type="button" onClick={() => setEvidenceId(e.id)}
              className="badge bg-blue-50 text-blue-700 hover:bg-blue-100 hover:border-blue-200 border border-transparent"
              title={`View ${e.id} — ${e.title}`}>
              <Paperclip size={11} /> {e.id} · {e.type}
            </button>
          ))}
          {missingEvidence.map((id) => (
            <span key={id} className="badge bg-slate-100 text-slate-400" title="This evidence record was removed and unlinked.">
              {id} (removed)
            </span>
          ))}
          <NavBtn href="/inspector/evidence" icon={<Camera size={13} />}>Manage evidence</NavBtn>
        </div>
      )}

      {/* Status workflow */}
      <div className="rounded-xl border border-slate-200 bg-white p-3 mt-4">
        <div className="text-[12.5px] font-extrabold text-navy">Corrective workflow</div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {FINDING_STATUSES.map((status, index) => {
            const current = status === finding.status;
            if (current) {
              return <span key={status} className="badge bg-blue-600 text-white">● {status}</span>;
            }
            const needsRecommendation = status === 'Resolved' && !finding.recommendation.trim();
            const title = !canAdvance
              ? undefined
              : needsRecommendation
                ? 'Record a corrective recommendation first — the repository refuses to resolve a finding without one.'
                : index > FINDING_STATUSES.indexOf(finding.status)
                  ? `Advance to ${status}`
                  : `Move back to ${status}`;
            return (
              <PermBtn key={status} perm="canCreateFinding" onClick={() => advance(status)}
                className="btn-secondary !py-1.5 !text-[12px]" disabled={needsRecommendation} title={title}>
                {status}
              </PermBtn>
            );
          })}
        </div>
        <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
          Lifecycle: Open → Under Review → Corrective Action Required → Resolved. A corrective
          recommendation is required before a finding can be Resolved; every transition is written to
          the inspection&apos;s activity timeline and reflected in its open-finding count.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        <NavBtn href={`/inspector/inspections/${finding.inspectionId}`} icon={<ExternalLink size={13} />}>
          Open source inspection
        </NavBtn>
        <NavBtn href={`/inspector/inspections/${finding.inspectionId}?tab=Evidence%20%26%20Observations`}
          icon={<Camera size={13} />}>
          Open observations tab
        </NavBtn>
      </div>

      {evidenceId && <EvidenceViewModal id={evidenceId} onClose={() => setEvidenceId(null)} />}
    </DetailDrawer>
  );
}

// ---------------------------------------------------------------------------
// Evidence peek modal (read-only context for a linked chip)
// ---------------------------------------------------------------------------

function EvidenceViewModal({ id, onClose }: { id: string; onClose: () => void }) {
  const db = useMockInspections();
  const evidence = db.evidence.find((e) => e.id === id);
  if (!evidence) return null;
  const inspection = inspectionOf(db, evidence.inspectionId);
  const site = inspection ? siteOf(db, inspection.mineId) : null;
  const item = inspection && evidence.itemId
    ? itemsOf(db, inspection.templateId).find((i) => i.id === evidence.itemId)
    : undefined;

  return (
    <Modal title={`Evidence ${evidence.id}`} onClose={onClose}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="badge bg-blue-50 text-blue-700">{evidence.type}</span>
          <span className="badge bg-slate-100 text-slate-600 !text-[10px]">{evidence.fileName}</span>
          <span className="badge bg-slate-100 text-slate-600 !text-[10px]">{fmtSize(evidence.sizeKb)}</span>
        </div>
        <div>
          <div className="text-[13.5px] font-extrabold text-navy">{evidence.title}</div>
          <p className="text-[12.5px] text-slate-600 mt-1 whitespace-pre-line">
            {evidence.description.trim() || '— no description recorded —'}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-[12px] space-y-1">
          <div className="flex gap-2"><span className="text-slate-500 w-28 shrink-0">Inspection</span>
            <span className="font-semibold text-navy">{evidence.inspectionId}{inspection ? ` · ${inspection.type}` : ''}</span></div>
          <div className="flex gap-2"><span className="text-slate-500 w-28 shrink-0">Mine</span>
            <span className="font-semibold text-navy">{site ? `${site.code} · ${site.name}` : '—'}</span></div>
          <div className="flex gap-2"><span className="text-slate-500 w-28 shrink-0">Captured</span>
            <span className="font-semibold text-navy">{fmtDateTime(evidence.capturedAt)}</span></div>
          <div className="flex gap-2"><span className="text-slate-500 w-28 shrink-0">Location</span>
            <span className="font-semibold text-navy">{evidence.location}</span></div>
          <div className="flex gap-2"><span className="text-slate-500 w-28 shrink-0">Uploaded by</span>
            <span className="font-semibold text-navy">{inspectorName(db, evidence.uploadedBy)}</span></div>
          <div className="flex gap-2"><span className="text-slate-500 w-28 shrink-0">Checklist item</span>
            <span className="font-semibold text-navy">
              {item ? `${item.id} — ${item.requirement}` : evidence.itemId ? evidence.itemId : 'Not linked to a checklist item'}
            </span></div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <NavBtn href={`/inspector/inspections/${evidence.inspectionId}?tab=Evidence%20%26%20Observations`}
            icon={<ExternalLink size={13} />}>Open in inspection</NavBtn>
          <button className="btn-primary !py-2 !text-[12px]" onClick={onClose}>Close</button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Create finding
// ---------------------------------------------------------------------------

function CreateFindingModal({ onClose, onCreated }: {
  onClose: () => void; onCreated: (id: string) => void;
}) {
  const db = useMockInspections();
  const scope = db.selectedMineId;
  const candidates = useMemo(
    () => db.inspections.filter((i) => i.status !== 'Cancelled' && (scope === 'ALL' || i.mineId === scope)),
    [db, scope],
  );
  const sensible = candidates.find((i) => i.status === 'In Progress' || i.status === 'Pending Submission')
    ?? candidates[0];

  const [inspectionId, setInspectionId] = useState(sensible?.id ?? '');
  const [itemId, setItemId] = useState('');
  const [category, setCategory] = useState<FindingCategory>(FindingCategory.Safety);
  const [severity, setSeverity] = useState<Severity>(Severity.High);
  const [description, setDescription] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [assignee, setAssignee] = useState('Mine Manager');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState('');

  const inspection = candidates.find(
    (i) => i.id.toLowerCase() === inspectionId.trim().toLowerCase(),
  );
  const items = inspection ? itemsOf(db, inspection.templateId) : [];
  const inspectionError = touched && !inspection
    ? 'Choose one of the listed inspections — type an ID prefix and pick it from the suggestions.'
    : undefined;
  const descriptionError = touched && !description.trim()
    ? 'A description of the observation is required.'
    : undefined;

  function submit() {
    setTouched(true);
    setError('');
    if (!inspection || !description.trim()) return;
    try {
      const id = actions.createFinding({
        inspectionId: inspection.id,
        itemId: itemId || null,
        category,
        severity,
        description,
        recommendation,
        assignee,
      });
      onCreated(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the finding.');
    }
  }

  if (candidates.length === 0) {
    return (
      <Modal title="Create finding" onClose={onClose}>
        <EmptyState
          title="No active inspections in this mine scope."
          sub="Findings attach to an inspection record. Switch the mine selector or schedule an inspection first."
          action={<button className="btn-primary !py-2" onClick={onClose}>Close</button>}
        />
      </Modal>
    );
  }

  return (
    <Modal title="Create finding" onClose={onClose}>
      <div className="space-y-1">
        <InlineError error={error} onDismiss={() => setError('')} />

        <Field label="Inspection" error={inspectionError}
          hint="Cancelled inspections cannot carry findings — only inspections listed here are offered.">
          <input className="input" list="finding-inspections" value={inspectionId}
            onChange={(e) => { setInspectionId(e.target.value); setItemId(''); }}
            placeholder="Type an inspection ID, e.g. INS-2026-003" autoFocus />
          <datalist id="finding-inspections">
            {candidates.map((i) => (
              <option key={i.id} value={i.id}>
                {i.id} — {siteLabel(db, i.mineId)} · {i.type} · {fmtDate(i.scheduledDate)}
              </option>
            ))}
          </datalist>
        </Field>

        {inspection && (
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-[12px] -mt-1 mb-3">
            <span className="font-bold text-navy">{inspection.id}</span>
            {' · '}{siteLabel(db, inspection.mineId)} · {inspection.location} · {inspection.type}
            {' · '}scheduled {fmtDate(inspection.scheduledDate)}
          </div>
        )}

        <Field label="Linked checklist item (optional)"
          hint="Options come from the selected inspection's template — change the inspection above to refresh them.">
          <select className="input" value={itemId} onChange={(e) => setItemId(e.target.value)}
            disabled={items.length === 0}
            title={items.length === 0 ? 'Select an inspection first to list its checklist items.' : undefined}>
            <option value="">{items.length === 0 ? 'No checklist items available' : 'Not linked to a checklist item'}</option>
            {items.map((i) => <option key={i.id} value={i.id}>{i.id} — {i.requirement}</option>)}
          </select>
        </Field>

        <div className="grid sm:grid-cols-2 gap-0 sm:gap-3">
          <Field label="Category">
            <select className="input" value={category}
              onChange={(e) => setCategory(e.target.value as FindingCategory)}>
              {Object.values(FindingCategory).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Severity"
            hint="Drives the due date: Critical +3 days, High +7, otherwise +15.">
            <select className="input" value={severity}
              onChange={(e) => setSeverity(e.target.value as Severity)}>
              {Object.values(Severity).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Description" error={descriptionError}>
          <textarea className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="What was observed, where exactly, and why it matters…" />
        </Field>

        <Field label="Corrective recommendation"
          hint="Required before this finding can be moved to Resolved.">
          <textarea className="input" rows={2} value={recommendation} onChange={(e) => setRecommendation(e.target.value)}
            placeholder="e.g. Install guard railing along the conveyor walkway before the next shift." />
        </Field>

        <Field label="Assignee"
          hint="Free text — the demo repository stores it as written.">
          <input className="input" list="finding-assignees" value={assignee}
            onChange={(e) => setAssignee(e.target.value)} placeholder="Mine Manager" />
          <datalist id="finding-assignees">
            {['Mine Manager', 'Safety Officer', 'Overman', ...db.inspectors.map((i) => i.name)].map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </Field>

        <div className="rounded-xl bg-blue-50 border border-blue-100 px-3 py-2 text-[11.5px] text-blue-800">
          The finding is stored as <b>Open</b> on the shared repository: it immediately appears in this
          register, in the inspection&apos;s finding count and in the sidebar badge. The due date and
          inspector are derived automatically.
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button className="btn-secondary !py-2 !text-[12px]" onClick={onClose}>Cancel</button>
          <button className="btn-primary !py-2 !text-[12px]" onClick={submit}>
            <span className="flex items-center gap-1.5"><Plus size={13} /> Create finding</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
