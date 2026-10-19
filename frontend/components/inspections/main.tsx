/**
 * My Inspections (reference page 2) — the inspector's workload hub.
 *
 * One table drives everything: the five KPI tiles, the tab badges, the row
 * actions and the Inspection Details panel all read the SAME centralized
 * inspection records (lib/inspections/store.ts), so starting, rescheduling,
 * reassigning, cancelling or editing a record here updates the schedule, the
 * checklist, the reports and the KPIs immediately — and vice versa.
 *
 * URL state: ?tab / ?q / ?status / ?type / ?priority / ?from / ?to / ?mine are
 * written with router.replace(..., { scroll: false }) and re-hydrated once on
 * mount, so a filtered view survives refresh and can be shared. "Overdue" is
 * never stored — it comes from the row's derived `effectiveStatus`.
 *
 * Every control performs a real store mutation, a navigation or an export;
 * permission-restricted controls stay visible but disabled with the reason.
 */
'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, CalendarDays, Camera, CheckCircle2,
  ChevronLeft, ChevronRight, ClipboardList, Clock, Download, ExternalLink, FileText,
  ListChecks, MousePointerClick, Pencil, Play, RotateCcw, UserCog, Users, X,
} from 'lucide-react';
import {
  ConfirmDialog, EmptyState, Field, KpiCard, Modal, SectionCard, SearchInput,
} from '../operations/ui';
import {
  ChecklistMeter, FilteredEmpty, InlineError, InspectionsToolbar, LocationPreview,
  Menu, NavBtn, NoAssignmentsEmpty, PermBtn, PriorityChip, StatusChip, type MenuItem,
} from './ui';
import {
  activityFor, actions, checklistFor, computeKpis, currentInspector, filterInspections,
  hasActiveFilters, inspectorName, rolePermissions, rowFor, siteLabel, tabCounts,
  useMockInspections, type FilterResult,
} from '../../lib/inspections/store';
import {
  DEFAULT_FILTERS, DEMO_TODAY, EFFECTIVE_STATUSES, INSPECTION_TABS, INSPECTION_TYPES, PRIORITIES,
  type Inspection, type InspectionDbState, type InspectionFilters, type InspectionKpis,
  type InspectionRow, type InspectionSortKey, type InspectionTab, type MineSite, type Priority,
  type SortDir,
} from '../../lib/inspections/types';
import {
  addDays, durationLabel, fmtDate, fmtDateTime, fmtTime, stepLabel, weekdayLong,
} from '../../lib/inspections/format';
import { downloadInspectionDetail, downloadInspectionsCsv } from '../../lib/inspections/export';

// ---------------------------------------------------------------------------
// Local constants / helpers
// ---------------------------------------------------------------------------

/** Rows-per-page choices. The demo starts at 10 so the select always has a match. */
const PAGE_SIZES: number[] = [10, 20, 50];
const BASE_PAGE_SIZE = 10;
const SORT_KEYS: InspectionSortKey[] = ['date', 'mine', 'type', 'priority', 'status', 'inspector', 'id'];
const MONTH_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DEMO_MONTH = MONTH_FULL[Number(DEMO_TODAY.slice(5, 7)) - 1] ?? 'October';

function errText(e: unknown): string {
  return e instanceof Error ? e.message : 'That action could not be completed.';
}

/** Filter state → query string (defaults omitted so the URL stays readable). */
function buildQuery(f: InspectionFilters): string {
  const p = new URLSearchParams();
  p.set('tab', f.tab);
  if (f.q) p.set('q', f.q);
  if (f.status !== 'ALL') p.set('status', f.status);
  if (f.type !== 'ALL') p.set('type', f.type);
  if (f.priority !== 'ALL') p.set('priority', f.priority);
  if (f.dateFrom) p.set('from', f.dateFrom);
  if (f.dateTo) p.set('to', f.dateTo);
  if (f.mineId !== 'ALL') p.set('mine', f.mineId);
  if (f.sort !== DEFAULT_FILTERS.sort) p.set('sort', f.sort);
  if (f.dir !== DEFAULT_FILTERS.dir) p.set('dir', f.dir);
  if (f.page > 1) p.set('page', String(f.page));
  if (f.pageSize !== BASE_PAGE_SIZE) p.set('size', String(f.pageSize));
  return p.toString();
}

/** Which primary action a row offers — derived from the effective/base status. */
type PrimaryKind = 'start' | 'continue' | 'report' | 'closed';
function primaryInfo(row: InspectionRow): { label: string; kind: PrimaryKind } {
  if (row.effectiveStatus === 'Completed') return { label: 'View Report', kind: 'report' };
  if (row.effectiveStatus === 'Cancelled') return { label: 'Cancelled', kind: 'closed' };
  // Overdue rows are still open: they read "Continue" whether they need a start
  // (base status Upcoming) or simply need to be resumed.
  if (row.inspection.status === 'Upcoming') {
    return { label: row.effectiveStatus === 'Overdue' ? 'Continue' : 'Start', kind: 'start' };
  }
  return { label: 'Continue', kind: 'continue' };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function MyInspectionsPage() {
  const db = useMockInspections();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<InspectionFilters>({ ...DEFAULT_FILTERS, pageSize: BASE_PAGE_SIZE });
  const [qDraft, setQDraft] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [ready, setReady] = useState(false);
  const [rowDialog, setRowDialog] = useState<{ kind: 'reschedule' | 'reassign' | 'cancel'; id: string } | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [bulk, setBulk] = useState<'assign' | 'cancel' | null>(null);
  const hydrated = useRef(false);
  const allRef = useRef<HTMLInputElement>(null);

  // ---- URL → state (once, so later router.replace calls cannot clobber edits)
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    const asTab = searchParams.get('tab');
    const asStatus = searchParams.get('status');
    const asType = searchParams.get('type');
    const asPriority = searchParams.get('priority');
    const asSort = searchParams.get('sort');
    const asSize = Number(searchParams.get('size'));
    const asPage = Number(searchParams.get('page'));
    const next: InspectionFilters = {
      ...DEFAULT_FILTERS,
      pageSize: PAGE_SIZES.includes(asSize) ? asSize : BASE_PAGE_SIZE,
      tab: asTab && (INSPECTION_TABS as readonly string[]).includes(asTab)
        ? asTab as InspectionTab
        : DEFAULT_FILTERS.tab,
      q: searchParams.get('q') ?? '',
      status: asStatus && (EFFECTIVE_STATUSES as readonly string[]).includes(asStatus) ? asStatus : 'ALL',
      type: asType && (INSPECTION_TYPES as readonly string[]).includes(asType) ? asType : 'ALL',
      priority: asPriority && (PRIORITIES as readonly string[]).includes(asPriority) ? asPriority : 'ALL',
      dateFrom: searchParams.get('from') ?? '',
      dateTo: searchParams.get('to') ?? '',
      mineId: searchParams.get('mine') ?? 'ALL',
      sort: asSort && SORT_KEYS.includes(asSort as InspectionSortKey) ? asSort as InspectionSortKey : 'date',
      dir: searchParams.get('dir') === 'desc' ? 'desc' : 'asc',
      page: Number.isFinite(asPage) && asPage > 1 ? Math.floor(asPage) : 1,
    };
    setFilters(next);
    setQDraft(next.q);
    setReady(true);
  }, [searchParams]);

  // ---- state → URL (shareable / refresh-safe, never scrolls the page)
  useEffect(() => {
    if (!ready) return;
    router.replace(`${pathname}?${buildQuery(filters)}`, { scroll: false });
  }, [filters, ready, pathname, router]);

  // ---- derived
  const result = useMemo(() => filterInspections(db, filters), [db, filters]);
  const kpis = useMemo(() => computeKpis(db), [db]);
  const counts = useMemo(() => tabCounts(db, filters), [db, filters]);
  const perms = useMemo(() => rolePermissions(db), [db]);
  const me = useMemo(() => currentInspector(db), [db]);
  const rows = result.rows;
  const activeFilters = hasActiveFilters(filters);
  const pageIds = useMemo(() => rows.map((r) => r.inspection.id), [rows]);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.includes(id));
  const someOnPage = pageIds.some((id) => selected.includes(id));
  // Header checkbox: indeterminate while only part of the page is selected.
  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = someOnPage && !allOnPage;
  }, [someOnPage, allOnPage]);
  const scopeCount = counts['All Inspections'] ?? 0;
  const activeRow = useMemo(
    () => rows.find((r) => r.inspection.id === activeId) ?? rows[0] ?? null,
    [rows, activeId],
  );
  const selectedRows = useMemo(() => {
    const out: InspectionRow[] = [];
    for (const id of selected) {
      const insp = db.inspections.find((x) => x.id === id);
      if (insp) out.push(rowFor(db, insp));
    }
    return out;
  }, [selected, db]);
  const nextRow = useMemo(() => {
    const scope = filters.mineId !== 'ALL' ? filters.mineId : db.selectedMineId;
    const upcoming = db.inspections
      .filter((i) => scope === 'ALL' || i.mineId === scope)
      .filter((i) => i.status !== 'Cancelled' && i.status !== 'Completed')
      .filter((i) => i.scheduledDate >= DEMO_TODAY)
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate) || a.startTime.localeCompare(b.startTime));
    return upcoming.length ? rowFor(db, upcoming[0]) : null;
  }, [db, filters.mineId]);

  // ---- actions ------------------------------------------------------------
  const updateFilters = useCallback((p: Partial<InspectionFilters>) => {
    setFilters((f) => ({ ...f, ...p, page: p.page ?? 1 }));
  }, []);

  const setTab = useCallback((tab: InspectionTab) => updateFilters({ tab }), [updateFilters]);

  const run = useCallback((fn: () => void) => {
    try {
      setError('');
      fn();
    } catch (e) {
      setError(errText(e));
    }
  }, []);

  const openInspection = useCallback((id: string, tab?: string) => {
    router.push(tab ? `/inspector/inspections/${id}?tab=${encodeURIComponent(tab)}` : `/inspector/inspections/${id}`);
  }, [router]);

  /** Start (Upcoming) then open; already-started inspections just open. */
  const startOrOpen = useCallback((row: InspectionRow) => {
    const i = row.inspection;
    if (i.status === 'Upcoming') {
      run(() => {
        actions.startInspection(i.id);
        openInspection(i.id);
      });
    } else {
      openInspection(i.id);
    }
  }, [run, openInspection]);

  const toggleSort = useCallback((key: InspectionSortKey) => {
    setFilters((f) => (f.sort === key
      ? { ...f, dir: f.dir === 'asc' ? 'desc' : 'asc', page: 1 }
      : { ...f, sort: key, dir: 'asc', page: 1 }));
  }, []);

  const toggleRow = useCallback((id: string) => {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((s) => (allOnPage
      ? s.filter((id) => !pageIds.includes(id))
      : [...new Set([...s, ...pageIds])]));
  }, [allOnPage, pageIds]);

  /** Clear filters but keep the active tab and the mine scope (per spec). */
  const clearFilters = useCallback(() => {
    setFilters((f) => ({ ...DEFAULT_FILTERS, tab: f.tab, mineId: f.mineId, pageSize: f.pageSize }));
    setQDraft('');
  }, []);

  /** Empty-state escape hatch: back to every inspection in scope. */
  const showAll = useCallback(() => {
    setFilters((f) => ({ ...DEFAULT_FILTERS, pageSize: f.pageSize }));
    setQDraft('');
  }, []);

  const applySearch = useCallback(() => updateFilters({ q: qDraft }), [qDraft, updateFilters]);

  const exportRow = useCallback((row: InspectionRow) => run(() => {
    const i = row.inspection;
    downloadInspectionDetail(row, checklistFor(db, i.id), {
      objective: i.objective,
      durationMins: i.durationMins,
      siteType: row.site.siteType,
      state: row.site.state,
      district: row.site.district,
    });
    actions.logDownload(i.id, 'checklist', `${i.id} inspection detail`);
  }), [db, run]);

  /** The single primary button used by the table, the panel and the next card. */
  const primary = useCallback((row: InspectionRow, dense: boolean): React.ReactNode => {
    const i = row.inspection;
    const cls = dense ? 'btn-primary !py-1.5 !px-3 !text-[12px]' : 'btn-primary !py-2.5 !px-4 !text-[13px]';
    const info = primaryInfo(row);
    if (info.kind === 'report') {
      return (
        <Link href={`/inspector/inspections/${i.id}?tab=Previous%20Reports`} className={cls}
          title={`Open the reports of ${i.id}`}>
          {info.label}
        </Link>
      );
    }
    if (info.kind === 'closed') {
      return (
        <button type="button" disabled className={`${cls} opacity-50 cursor-not-allowed`}
          title={i.cancelReason ? `Cancelled: ${i.cancelReason}` : 'This inspection was cancelled — it stays visible for the record.'}>
          {info.label}
        </button>
      );
    }
    if (info.kind === 'continue') {
      return (
        <button type="button" onClick={() => openInspection(i.id)} className={cls} title={`Open ${i.id}`}>
          {!dense && <Play size={14} className="inline mr-1.5 -mt-0.5" />}{info.label}
        </button>
      );
    }
    const assigned = i.assignedTo === me.id;
    return (
      <PermBtn perm="canStart" onClick={() => startOrOpen(row)} disabled={!assigned}
        title={assigned ? undefined : `Assigned to ${row.assignedToName} — only the assigned inspector can start it.`}
        className={cls}>
        {!dense && <Play size={14} className="inline mr-1.5 -mt-0.5" />}{info.label}
      </PermBtn>
    );
  }, [me.id, openInspection, startOrOpen]);

  /** "More Actions" menu for one row — every entry is a real action. */
  const rowMenuItems = useCallback((row: InspectionRow): MenuItem[] => {
    const i = row.inspection;
    const closed = i.status === 'Completed' || i.status === 'Cancelled';
    const blocked = !perms.canStart
      ? 'Your demo role cannot submit inspection requests.'
      : undefined;
    const closedTitle = i.status === 'Completed'
      ? 'A completed inspection is read-only — raise a reinspection instead.'
      : 'This inspection is already cancelled.';
    return [
      {
        label: 'Open Checklist', icon: <ListChecks size={13} />,
        title: `Open the Inspection Checklist tab of ${i.id}`,
        onClick: () => openInspection(i.id, 'Inspection Checklist'),
      },
      {
        label: 'View Evidence', icon: <Camera size={13} />,
        title: `Open the Evidence & Observations tab of ${i.id}`,
        onClick: () => openInspection(i.id, 'Evidence & Observations'),
      },
      {
        label: 'Request Reschedule', icon: <CalendarDays size={13} />,
        disabled: closed || !perms.canStart, title: closed ? closedTitle : blocked,
        onClick: () => setRowDialog({ kind: 'reschedule', id: i.id }),
      },
      {
        label: 'Request Reassignment', icon: <UserCog size={13} />,
        disabled: closed || !perms.canStart, title: closed ? closedTitle : blocked,
        onClick: () => setRowDialog({ kind: 'reassign', id: i.id }),
      },
      {
        label: 'Cancel inspection', icon: <X size={13} />, danger: true,
        disabled: closed || !perms.canStart, title: closed ? closedTitle : blocked,
        onClick: () => setRowDialog({ kind: 'cancel', id: i.id }),
      },
      {
        label: 'Export row', icon: <Download size={13} />,
        title: `Download ${i.id} (details + checklist) as a watermarked DEMO file`,
        onClick: () => exportRow(row),
      },
    ];
  }, [exportRow, openInspection, perms.canStart]);

  /** Bulk menu — gated by canStart / canReassign / canBulkCancel. */
  const bulkItems: MenuItem[] = [
    {
      label: 'Export selected', icon: <Download size={13} />,
      disabled: !perms.canStart,
      title: perms.canStart
        ? `Download ${selectedRows.length} selected row(s) as CSV`
        : 'Your demo role cannot export inspections.',
      onClick: () => run(() => {
        if (selectedRows.length === 0) throw new Error('None of the selected inspections are loaded in this view.');
        downloadInspectionsCsv(selectedRows);
      }),
    },
    {
      label: 'Assign inspector', icon: <UserCog size={13} />,
      disabled: !perms.canReassign,
      title: perms.canReassign
        ? `Reassign ${selectedRows.length} selected inspection(s)`
        : 'Reassigning requires a supervisory demo role (Senior Labour Officer / Mine Admin).',
      onClick: () => setBulk('assign'),
    },
    {
      label: 'Cancel selected', icon: <X size={13} />, danger: true,
      disabled: !perms.canBulkCancel,
      title: perms.canBulkCancel
        ? `Cancel ${selectedRows.length} selected inspection(s)`
        : 'Bulk cancellation requires a supervisory demo role (Senior Labour Officer / Mine Admin).',
      onClick: () => setBulk('cancel'),
    },
  ];

  const dialogRow = rowDialog
    ? (() => { const insp = db.inspections.find((x) => x.id === rowDialog.id); return insp ? rowFor(db, insp) : null; })()
    : null;
  const editRow = editId
    ? (() => { const insp = db.inspections.find((x) => x.id === editId); return insp ? rowFor(db, insp) : null; })()
    : null;

  // ---- initial mount gate (the repo is synchronous; this is a short skeleton)
  if (!ready) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading My Inspections">
        <div className="h-10 rounded-xl bg-slate-100 animate-pulse" />
        <div className="h-24 rounded-2xl bg-slate-100 animate-pulse" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {[0, 1, 2, 3, 4].map((n) => <div key={n} className="h-24 rounded-2xl bg-slate-100 animate-pulse" />)}
        </div>
        <div className="h-72 rounded-2xl bg-slate-100 animate-pulse" />
      </div>
    );
  }

  const countLabel = result.total === 0
    ? 'No inspections to show'
    : `Showing ${result.from}–${result.to} of ${result.total} inspections`;

  return (
    <div className="space-y-4">
      <InspectionsToolbar />
      <InlineError error={error} onDismiss={() => setError('')} />

      {notice && (
        <div role="status" className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-[12.5px] text-blue-800">
          <span className="font-bold shrink-0">Result:</span>
          <span className="flex-1">{notice}</span>
          <button type="button" onClick={() => setNotice('')} aria-label="Dismiss message"
            className="shrink-0 text-blue-400 hover:text-blue-700">
            <X size={14} />
          </button>
        </div>
      )}

      <NextInspectionCard row={nextRow} primary={primary} onBrowseAll={showAll} />

      <KpisStrip kpis={kpis} activeTab={filters.tab} onTab={setTab} />

      <div className="grid xl:grid-cols-3 gap-4 items-start">
        {/* ---------------- Left: tabs + filters + table ---------------- */}
        <div className="xl:col-span-2 min-w-0">
          <SectionCard title="Assigned inspections" subtitle={countLabel}>
            <TabsBar active={filters.tab} counts={counts} onChange={setTab} />

            <div className="mt-3">
              <FilterRow
                filters={filters}
                sites={db.sites}
                qDraft={qDraft}
                onQDraft={setQDraft}
                onSearch={applySearch}
                onPatch={updateFilters}
                onClear={clearFilters}
                countLabel={countLabel}
              />
            </div>

            {selected.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-blue-200 bg-blue-50/70 px-3 py-2">
                <span className="text-[12.5px] font-bold text-navy">{selected.length} selected</span>
                <button type="button" onClick={() => setSelected([])} title="Clear the current selection"
                  className="text-[12px] font-bold text-blue-600 hover:underline">
                  · Clear
                </button>
                <div className="ml-auto">
                  <Menu label={`Bulk actions (${selected.length})`} tone="primary" items={bulkItems} />
                </div>
              </div>
            )}

            <div className="mt-3">
              {rows.length === 0 ? (
                scopeCount === 0 ? (
                  <NoAssignmentsEmpty onClear={showAll} />
                ) : activeFilters ? (
                  <FilteredEmpty onClear={clearFilters}
                    scopeNote={`Current tab: ${filters.tab}. Clearing the filters keeps this tab and your mine scope.`} />
                ) : (
                  <EmptyState
                    title={`No inspections under “${filters.tab}” in this mine scope.`}
                    sub="Every assigned inspection is in another state right now. Switch tabs, or view the full list."
                    action={<button type="button" className="btn-primary !py-2" onClick={showAll}>View all inspections</button>}
                  />
                )
              ) : (
                <>
                  <InspectionTable
                    result={result}
                    filters={filters}
                    selected={selected}
                    activeId={activeRow?.inspection.id ?? null}
                    checkAllRef={allRef}
                    allOnPage={allOnPage}
                    onToggleRow={toggleRow}
                    onToggleAll={toggleAll}
                    onSelect={setActiveId}
                    onSort={toggleSort}
                    primary={primary}
                    menuItems={rowMenuItems}
                  />
                  <Pagination result={result} onPatch={updateFilters} />
                </>
              )}
            </div>
          </SectionCard>
        </div>

        {/* ---------------- Right: inspection details ---------------- */}
        <div className="xl:col-span-1 min-w-0">
          {activeRow ? (
            <DetailsPanel
              db={db}
              row={activeRow}
              primary={primary}
              onEdit={(r) => setEditId(r.inspection.id)}
            />
          ) : (
            <SectionCard title="Inspection Details" subtitle="Nothing selected">
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-4 py-7 text-center">
                <MousePointerClick size={22} className="mx-auto text-slate-400" />
                <div className="text-[13px] font-bold text-navy mt-2">No inspection selected</div>
                <p className="text-[12px] text-slate-500 mt-1 leading-relaxed">
                  Click a row in the table to open its details here — checklist progress, required evidence,
                  location preview, open findings, quick actions and the recent activity trail.
                </p>
              </div>
            </SectionCard>
          )}
        </div>
      </div>

      {/* ---------------- Dialogs ---------------- */}
      {rowDialog && dialogRow && (
        <RequestDialog
          row={dialogRow}
          kind={rowDialog.kind}
          onClose={() => setRowDialog(null)}
          onError={setError}
          onDone={(msg) => { setNotice(msg); setRowDialog(null); }}
        />
      )}
      {editRow && (
        <EditModal row={editRow} onClose={() => setEditId(null)} onError={setError} />
      )}
      {bulk === 'assign' && selected.length > 0 && (
        <BulkAssignModal
          ids={selected}
          onClose={() => setBulk(null)}
          onDone={(msg) => { setNotice(msg); setSelected([]); setBulk(null); }}
        />
      )}
      {bulk === 'cancel' && selected.length > 0 && (
        <BulkCancelModal
          ids={selected}
          onClose={() => setBulk(null)}
          onDone={(msg) => { setNotice(msg); setSelected([]); setBulk(null); }}
          onError={setError}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tabs — badge counts come from tabCounts(), never hard-coded
// ---------------------------------------------------------------------------

function TabsBar({ active, counts, onChange }: {
  active: InspectionTab; counts: Record<string, number>; onChange: (t: InspectionTab) => void;
}) {
  return (
    <div className="border-b border-slate-200 flex gap-1 overflow-x-auto" role="tablist" aria-label="Inspection status">
      {INSPECTION_TABS.map((t) => {
        const isActive = t === active;
        return (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t)}
            title={`Show ${t.toLowerCase()} only — other filters are kept`}
            className={`px-3.5 py-2.5 text-[13px] font-bold whitespace-nowrap border-b-2 -mb-px transition flex items-center gap-2
              ${isActive ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-navy'}`}
          >
            {t}
            <span className={`badge !text-[10px] !px-1.5 !py-0.5 ${isActive ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
              {counts[t] ?? 0}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI strip — five clickable cards, each switching the active tab
// ---------------------------------------------------------------------------

function KpisStrip({ kpis, activeTab, onTab }: {
  kpis: InspectionKpis; activeTab: InspectionTab; onTab: (t: InspectionTab) => void;
}) {
  const diff = kpis.completedThisMonth - kpis.completedLastMonth;
  const cards: {
    tab: InspectionTab; label: string; value: number; icon: React.ReactNode; tile: string;
    context: string; contextTone?: string; dotColor: string; trend?: string; trendTone?: 'up' | 'down';
  }[] = [
    {
      tab: 'All Inspections', label: 'Total Assigned', value: kpis.totalAssigned,
      icon: <Users size={22} />, tile: 'bg-blue-50 text-blue-600',
      context: `${kpis.scheduledThisMonth} scheduled in ${DEMO_MONTH}`, dotColor: '#1463D9',
    },
    {
      tab: 'Completed', label: 'Completed', value: kpis.completed,
      icon: <CheckCircle2 size={22} />, tile: 'bg-emerald-50 text-emerald-600',
      context: `${kpis.completionRate}% completion rate`, contextTone: 'text-emerald-600', dotColor: '#159B72',
      trend: `${Math.abs(diff)} vs last month`, trendTone: diff >= 0 ? 'up' : 'down',
    },
    {
      tab: 'Upcoming', label: 'Pending', value: kpis.pending,
      icon: <Clock size={22} />, tile: 'bg-amber-50 text-amber-600',
      context: `${kpis.dueThisWeek} due within 7 days`, dotColor: '#E8A02B',
    },
    {
      tab: 'Overdue', label: 'Overdue', value: kpis.overdue,
      icon: <AlertTriangle size={22} />, tile: 'bg-red-50 text-red-600',
      context: 'Past the scheduled date', contextTone: 'text-red-500', dotColor: '#DC4C58',
    },
    {
      tab: 'In Progress', label: 'In Progress', value: kpis.inProgress,
      icon: <ClipboardList size={22} />, tile: 'bg-sky-50 text-sky-600',
      context: `${kpis.openFindings} open findings in scope`, dotColor: '#0EA5E9',
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {cards.map((c) => {
        const isActive = c.tab === activeTab;
        return (
          <button
            key={c.label}
            type="button"
            onClick={() => onTab(c.tab)}
            title={`Switch to the ${c.tab} tab`}
            aria-pressed={isActive}
            className={`text-left rounded-2xl transition ${isActive ? 'ring-2 ring-blue-500 ring-offset-2' : 'hover:ring-2 hover:ring-slate-300'}`}
          >
            <KpiCard
              icon={c.icon}
              label={c.label}
              value={c.value}
              trend={c.trend}
              trendTone={c.trendTone}
              context={c.context}
              contextTone={c.contextTone}
              dotColor={c.dotColor}
              tileClass={c.tile}
            />
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Next inspection card (earliest open work at/after the demo clock)
// ---------------------------------------------------------------------------

function NextInspectionCard({ row, primary, onBrowseAll }: {
  row: InspectionRow | null;
  primary: (row: InspectionRow, dense: boolean) => React.ReactNode;
  onBrowseAll: () => void;
}) {
  if (!row) {
    return (
      <div className="card !p-4 flex flex-wrap items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
          <CalendarDays size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-semibold text-slate-600">Next Inspection</div>
          <div className="text-[14px] font-extrabold text-navy">
            Nothing scheduled from {fmtDate(DEMO_TODAY)} onward in this mine scope.
          </div>
          <div className="text-[11.5px] text-slate-500">
            Every assigned inspection in scope is already Completed or Cancelled — open the full list to review their reports.
          </div>
        </div>
        <button type="button" className="btn-secondary !py-2 !text-[12px]" onClick={onBrowseAll}>
          Browse all inspections
        </button>
      </div>
    );
  }

  const i = row.inspection;
  return (
    <div className="card !p-4 flex flex-wrap items-center gap-4">
      <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
        <CalendarDays size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] font-semibold text-slate-600">Next Inspection</span>
          <span className="text-[13.5px] font-extrabold text-navy">{i.id}</span>
          <StatusChip v={row.effectiveStatus} />
          <PriorityChip v={i.priority} />
        </div>
        <div className="text-[13.5px] font-bold text-navy mt-1">
          {row.site.code} · {row.site.name} — {i.location}
        </div>
        <div className="text-[11.5px] text-slate-500">
          {i.type} · {fmtDate(i.scheduledDate)} ({weekdayLong(i.scheduledDate)}) ·{' '}
          {fmtTime(i.startTime)}–{fmtTime(i.endTime)} · Assigned to {row.assignedToName}
        </div>
      </div>
      <div className="flex items-center gap-2">{primary(row, false)}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Search + combined filters (all combine with AND, all live in the URL)
// ---------------------------------------------------------------------------

function FilterRow({ filters, sites, qDraft, onQDraft, onSearch, onPatch, onClear, countLabel }: {
  filters: InspectionFilters;
  sites: MineSite[];
  qDraft: string;
  onQDraft: (v: string) => void;
  onSearch: () => void;
  onPatch: (p: Partial<InspectionFilters>) => void;
  onClear: () => void;
  countLabel: string;
}) {
  const statuses = [...EFFECTIVE_STATUSES];
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="block">
        <span className="block text-[11px] font-semibold text-slate-500 mb-1">Search</span>
        <SearchInput
          value={qDraft}
          onChange={onQDraft}
          onSearch={onSearch}
          ph="ID, mine, type, inspector, title…"
          width="!w-64"
        />
      </div>

      <label className="block">
        <span className="block text-[11px] font-semibold text-slate-500 mb-1">Mine</span>
        <select className="input !w-44 !py-2 !text-[13px]" value={filters.mineId}
          onChange={(e) => onPatch({ mineId: e.target.value })} aria-label="Filter by mine">
          <option value="ALL">All mines (header scope)</option>
          {sites.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}
        </select>
      </label>

      <label className="block">
        <span className="block text-[11px] font-semibold text-slate-500 mb-1">Inspection type</span>
        <select className="input !w-52 !py-2 !text-[13px]" value={filters.type}
          onChange={(e) => onPatch({ type: e.target.value })} aria-label="Filter by inspection type">
          <option value="ALL">All inspection types</option>
          {INSPECTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>

      <label className="block">
        <span className="block text-[11px] font-semibold text-slate-500 mb-1">Priority</span>
        <select className="input !w-32 !py-2 !text-[13px]" value={filters.priority}
          onChange={(e) => onPatch({ priority: e.target.value })} aria-label="Filter by priority">
          <option value="ALL">All priorities</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </label>

      <label className="block">
        <span className="block text-[11px] font-semibold text-slate-500 mb-1">Status</span>
        <select className="input !w-44 !py-2 !text-[13px]" value={filters.status}
          onChange={(e) => onPatch({ status: e.target.value })} aria-label="Filter by status">
          <option value="ALL">All statuses</option>
          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>

      <label className="block">
        <span className="block text-[11px] font-semibold text-slate-500 mb-1">Scheduled from</span>
        <input type="date" className="input !w-40 !py-2 !text-[13px]" value={filters.dateFrom}
          onChange={(e) => onPatch({ dateFrom: e.target.value })} aria-label="Scheduled from date" />
      </label>

      <label className="block">
        <span className="block text-[11px] font-semibold text-slate-500 mb-1">Scheduled to</span>
        <input type="date" className="input !w-40 !py-2 !text-[13px]" value={filters.dateTo}
          onChange={(e) => onPatch({ dateTo: e.target.value })} aria-label="Scheduled to date" />
      </label>

      <button type="button" className="btn-ghost !py-2 !text-[12px]" onClick={onClear}
        title="Reset the search, type, priority, status and date filters — the active tab and mine scope are kept.">
        <RotateCcw size={13} className="inline mr-1" /> Clear filters
      </button>

      <span className="ml-auto pb-2 text-[12px] font-semibold text-slate-500" aria-live="polite">
        {countLabel}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sortable table header cell
// ---------------------------------------------------------------------------

function SortTh({ label, k, sort, dir, onSort, title }: {
  label: string; k: InspectionSortKey; sort: InspectionSortKey; dir: SortDir;
  onSort: (k: InspectionSortKey) => void; title?: string;
}) {
  const active = sort === k;
  return (
    <th aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}>
      <button
        type="button"
        onClick={() => onSort(k)}
        title={title ?? `Sort by ${label}`}
        className={`flex items-center gap-1 uppercase tracking-wide transition hover:text-blue-700 ${active ? 'text-blue-700' : ''}`}
      >
        {label}
        {active
          ? (dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)
          : <ArrowUpDown size={11} className="opacity-40" />}
      </button>
    </th>
  );
}

// ---------------------------------------------------------------------------
// Inspection table (the page's single source of rows — panel follows selection)
// ---------------------------------------------------------------------------

function InspectionTable({ result, filters, selected, activeId, checkAllRef, allOnPage, onToggleRow, onToggleAll, onSelect, onSort, primary, menuItems }: {
  result: FilterResult;
  filters: InspectionFilters;
  selected: string[];
  activeId: string | null;
  checkAllRef: React.RefObject<HTMLInputElement>;
  allOnPage: boolean;
  onToggleRow: (id: string) => void;
  onToggleAll: () => void;
  onSelect: (id: string) => void;
  onSort: (k: InspectionSortKey) => void;
  primary: (row: InspectionRow, dense: boolean) => React.ReactNode;
  menuItems: (row: InspectionRow) => MenuItem[];
}) {
  return (
    <div className="overflow-x-auto -mx-2 px-2">
      <table className="dense w-full min-w-[1240px]">
        <thead>
          <tr>
            <th className="w-9">
              <input
                ref={checkAllRef}
                type="checkbox"
                checked={allOnPage}
                onChange={onToggleAll}
                aria-label="Select all inspections on this page"
                className="w-4 h-4 accent-blue-600 cursor-pointer"
              />
            </th>
            <SortTh label="#" k="id" sort={filters.sort} dir={filters.dir} onSort={onSort}
              title="Sort by inspection ID" />
            <SortTh label="ID" k="id" sort={filters.sort} dir={filters.dir} onSort={onSort}
              title="Sort by inspection ID" />
            <SortTh label="Date" k="date" sort={filters.sort} dir={filters.dir} onSort={onSort} />
            <SortTh label="Mine Name" k="mine" sort={filters.sort} dir={filters.dir} onSort={onSort} />
            <SortTh label="Inspection Type" k="type" sort={filters.sort} dir={filters.dir} onSort={onSort} />
            <SortTh label="Priority" k="priority" sort={filters.sort} dir={filters.dir} onSort={onSort} />
            <SortTh label="Status" k="status" sort={filters.sort} dir={filters.dir} onSort={onSort} />
            <SortTh label="Assigned Inspector" k="inspector" sort={filters.sort} dir={filters.dir} onSort={onSort} />
            <th>Assigned By</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row, idx) => {
            const i = row.inspection;
            const isActive = activeId === i.id;
            return (
              <tr key={i.id}
                onClick={() => onSelect(i.id)}
                className={`cursor-pointer transition ${isActive ? 'bg-blue-50/70' : 'hover:bg-blue-50/50'}`}>
                <td onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected.includes(i.id)}
                    onChange={() => onToggleRow(i.id)}
                    aria-label={`Select ${i.id}`}
                    className="w-4 h-4 accent-blue-600 cursor-pointer"
                  />
                </td>
                <td className="whitespace-nowrap align-top">
                  <span className={`flex items-center justify-center w-5 h-5 rounded-md text-[10px] font-extrabold
                    ${isActive ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {result.from + idx}
                  </span>
                </td>
                <td className="whitespace-nowrap">
                  <span className="font-mono text-[11.5px] font-semibold text-navy">{i.id}</span>
                  <span className="block text-[10.5px] text-slate-400 line-clamp-1">{i.title}</span>
                </td>
                <td className="whitespace-nowrap">
                  <div className="font-bold text-navy">{fmtDate(i.scheduledDate)}</div>
                  <div className="text-[11px] text-slate-500">
                    {weekdayLong(i.scheduledDate).slice(0, 3)} · {fmtTime(i.startTime)}–{fmtTime(i.endTime)}
                  </div>
                </td>
                <td>
                  <div className="font-bold text-navy whitespace-nowrap">{row.site.code} · {row.site.name}</div>
                  <div className="text-[11px] text-slate-500">{row.site.area}</div>
                </td>
                <td className="text-[12.5px] min-w-[160px]">{i.type}</td>
                <td><PriorityChip v={i.priority} /></td>
                <td>
                  <StatusChip v={row.effectiveStatus} />
                  <div className="mt-1 flex items-center gap-1.5"
                    title={`${row.progress.completed}/${row.progress.totalItems} checklist items answered`}>
                    <span className="block w-16 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                      <span className="block h-full rounded-full"
                        style={{ width: `${row.progress.percent}%`, background: row.progress.percent === 100 ? '#159B72' : '#1463D9' }} />
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500">{row.progress.percent}%</span>
                  </div>
                </td>
                <td className="text-[12.5px] whitespace-nowrap">{row.assignedToName}</td>
                <td className="text-[12.5px] whitespace-nowrap">{row.assignedByName}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1.5">
                    <Link href={`/inspector/inspections/${i.id}`}
                      className="btn-secondary !py-1.5 !px-2.5 !text-[12px]"
                      title={`View ${i.id}`}>
                      View
                    </Link>
                    {primary(row, true)}
                    <Menu label="" items={menuItems(row)} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pagination — prev/next, page numbers, rows-per-page and jump-to-page
// ---------------------------------------------------------------------------

function pageNumbers(page: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | '…')[] = [1];
  if (page > 3) out.push('…');
  for (let p = Math.max(2, page - 1); p <= Math.min(total - 1, page + 1); p++) out.push(p);
  if (page < total - 2) out.push('…');
  out.push(total);
  return out;
}

function Pagination({ result, onPatch }: {
  result: FilterResult; onPatch: (p: Partial<InspectionFilters>) => void;
}) {
  const [jump, setJump] = useState('');
  const jumpNum = Math.round(Number(jump));
  const jumpValid = jump.trim() !== '' && Number.isFinite(jumpNum) && jumpNum >= 1 && jumpNum <= result.totalPages;
  const atStart = result.page <= 1;
  const atEnd = result.page >= result.totalPages;

  function goJump() {
    if (!jumpValid) return;
    onPatch({ page: jumpNum });
    setJump('');
  }

  return (
    <div className="flex flex-wrap items-center gap-3 pt-3 mt-3 border-t border-slate-100">
      <label className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-600">
        Rows per page
        <select className="input !w-20 !py-1.5 !text-[12px]" value={result.pageSize}
          onChange={(e) => onPatch({ pageSize: Number(e.target.value), page: 1 })} aria-label="Rows per page">
          {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>

      <label className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-600">
        Jump to page
        <input type="number" min={1} max={result.totalPages} value={jump}
          onChange={(e) => setJump(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') goJump(); }}
          placeholder={String(result.page)}
          aria-label="Jump to page"
          className="input !w-16 !py-1.5 !text-[12px]" />
        <button type="button" className="btn-secondary !py-1.5 !px-2.5 !text-[12px]"
          onClick={goJump} disabled={!jumpValid}
          title={jumpValid ? `Go to page ${jumpNum}` : `Enter a page number between 1 and ${result.totalPages}.`}>
          Go
        </button>
      </label>

      <div className="ml-auto flex items-center gap-1">
        <button type="button" onClick={() => onPatch({ page: result.page - 1 })} disabled={atStart}
          title={atStart ? 'You are on the first page.' : `Go to page ${result.page - 1}`}
          className="btn-secondary !py-1.5 !px-2 !text-[12px] disabled:opacity-50"
          aria-label="Previous page">
          <ChevronLeft size={14} className="inline" />
        </button>
        {pageNumbers(result.page, result.totalPages).map((n, idx) => (n === '…' ? (
          <span key={`gap-${idx}`} className="px-1 text-[12px] text-slate-400" aria-hidden="true">…</span>
        ) : (
          <button key={n} type="button" onClick={() => onPatch({ page: n })}
            aria-current={n === result.page ? 'page' : undefined}
            title={`Go to page ${n}`}
            className={`min-w-[30px] !py-1.5 rounded-lg text-[12px] font-bold border transition
              ${n === result.page
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-white border-slate-200 text-navy hover:border-blue-300 hover:bg-blue-50'}`}>
            {n}
          </button>
        )))}
        <button type="button" onClick={() => onPatch({ page: result.page + 1 })} disabled={atEnd}
          title={atEnd ? 'You are on the last page.' : `Go to page ${result.page + 1}`}
          className="btn-secondary !py-1.5 !px-2 !text-[12px] disabled:opacity-50"
          aria-label="Next page">
          <ChevronRight size={14} className="inline" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inspection Details panel (right column on desktop, below the table on mobile)
// ---------------------------------------------------------------------------

function Info({ label, value, sub, span }: {
  label: string; value: React.ReactNode; sub?: string; span?: boolean;
}) {
  return (
    <div className={span ? 'col-span-2' : ''}>
      <div className="text-[10.5px] font-bold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-[12.5px] font-bold text-navy leading-tight">{value}</div>
      {sub && <div className="text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}

function DetailsPanel({ db, row, primary, onEdit }: {
  db: InspectionDbState;
  row: InspectionRow;
  primary: (row: InspectionRow, dense: boolean) => React.ReactNode;
  onEdit: (row: InspectionRow) => void;
}) {
  const i = row.inspection;
  const checklist = checklistFor(db, i.id);
  const activity = activityFor(db, i.id).slice(0, 5);
  const met = row.evidenceCount >= i.requiredEvidenceCount;
  const closed = i.status === 'Completed' || i.status === 'Cancelled';
  const href = `/inspector/inspections/${i.id}`;

  const tiles = [
    { label: 'Total items', value: checklist.totalItems, cls: 'bg-slate-100 text-slate-600' },
    { label: 'Completed', value: checklist.completed, cls: 'bg-emerald-50 text-emerald-700' },
    { label: 'Pending', value: checklist.pending, cls: 'bg-amber-50 text-amber-700' },
    { label: 'Flagged', value: checklist.flagged, cls: 'bg-red-50 text-red-600' },
  ];

  return (
    <SectionCard
      title="Inspection Details"
      subtitle={`${i.id} · step ${i.workflowStep + 1} of 4 · ${stepLabel(i.workflowStep)}`}
      action={<NavBtn href={href} icon={<ExternalLink size={13} />}>View Full Details</NavBtn>}
    >
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <ClipboardList size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-extrabold text-navy">{i.id}</div>
            <div className="text-[12px] text-slate-600 line-clamp-2">{i.title}</div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <StatusChip v={row.effectiveStatus} />
            <PriorityChip v={i.priority} />
          </div>
        </div>

        {/* Fields */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
          <Info label="Mine" value={siteLabel(db, i.mineId)} sub={row.site.area} span />
          <Info label="Inspection type" value={i.type} />
          <Info label="Scheduled date" value={fmtDate(i.scheduledDate)} sub={weekdayLong(i.scheduledDate)} />
          <Info label="Time slot" value={`${fmtTime(i.startTime)} – ${fmtTime(i.endTime)}`} sub={durationLabel(i.durationMins)} />
          <Info label="Assigned inspector" value={row.assignedToName} />
          <Info label="Assigned by" value={row.assignedByName} />
          <Info label="Mine location" value={i.location} />
          <Info label="Current step" value={stepLabel(i.workflowStep)} />
        </div>

        {/* Checklist progress */}
        <div className="rounded-xl border border-slate-200 p-3">
          <ChecklistMeter p={checklist} />
          <div className="grid grid-cols-4 gap-2 mt-2.5">
            {tiles.map((t) => (
              <div key={t.label} className={`rounded-xl border border-slate-200 px-1.5 py-1.5 text-center ${t.cls}`}>
                <div className="text-[15px] font-extrabold leading-tight">{t.value}</div>
                <div className="text-[9.5px] font-bold uppercase tracking-wide opacity-80">{t.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Required evidence status */}
        <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[12.5px]
          ${met ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}
          role="status">
          <span className="text-[15px] font-extrabold leading-none">{met ? '✓' : '⚠'}</span>
          <span className="font-bold">
            {row.evidenceCount} of {i.requiredEvidenceCount} evidence records — {met ? 'requirement met' : 'requirement not met'}
          </span>
        </div>

        {/* Related-record chips */}
        <div className="flex flex-wrap gap-1.5">
          <span className="badge bg-slate-100 text-slate-600">{row.evidenceCount} evidence</span>
          <span className={`badge ${row.openFindingCount ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'}`}>
            {row.openFindingCount} open finding{row.openFindingCount === 1 ? '' : 's'}
          </span>
          <span className="badge bg-slate-100 text-slate-600">{row.findingCount} finding{row.findingCount === 1 ? '' : 's'} total</span>
          <span className={`badge ${checklist.mandatoryRemaining ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
            {checklist.mandatoryRemaining} mandatory left
          </span>
        </div>

        <LocationPreview site={row.site} location={i.location} />

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {primary(row, false)}
          <PermBtn perm="canEditDetails" onClick={() => onEdit(row)} disabled={closed}
            title={closed
              ? (i.status === 'Completed'
                ? 'A completed inspection is read-only — its report is final.'
                : 'A cancelled inspection is read-only.')
              : undefined}
            className="btn-secondary !py-2.5 !text-[13px]">
            <span className="flex items-center gap-1.5"><Pencil size={13} /> Edit</span>
          </PermBtn>
        </div>
        <div className="flex flex-wrap gap-2">
          <NavBtn href={`${href}?tab=Inspection%20Checklist`} icon={<ListChecks size={13} />}>Open Checklist</NavBtn>
          <NavBtn href={`${href}?tab=Previous%20Reports`} icon={<FileText size={13} />}>View Reports</NavBtn>
          <NavBtn href={`${href}?tab=Evidence%20%26%20Observations`} icon={<Camera size={13} />}>View Evidence</NavBtn>
        </div>

        {/* Activity trail */}
        <div>
          <div className="text-[12px] font-bold text-navy mb-1.5">Recent activity</div>
          {activity.length === 0 ? (
            <p className="text-[11.5px] text-slate-400">
              No activity recorded yet — the trail starts as soon as this inspection is worked on.
            </p>
          ) : (
            <ol className="space-y-2">
              {activity.map((a) => (
                <li key={a.id} className="flex gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[11.5px] leading-snug">
                      <span className="font-bold text-navy">{a.action}</span>
                      <span className="text-slate-600"> — {a.detail}</span>
                    </div>
                    <div className="text-[10.5px] text-slate-400">{a.by} · {fmtDateTime(a.at)}</div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Edit inspection — title / objective / priority / location (permission gated)
// ---------------------------------------------------------------------------

function EditModal({ row, onClose, onError }: {
  row: InspectionRow; onClose: () => void; onError: (m: string) => void;
}) {
  const i = row.inspection;
  const [title, setTitle] = useState(i.title);
  const [objective, setObjective] = useState(i.objective);
  const [priority, setPriority] = useState<Priority>(i.priority);
  const [location, setLocation] = useState(i.location);
  const [touched, setTouched] = useState(false);

  const titleError = touched && !title.trim() ? 'Inspection title is required.' : undefined;
  const locationError = touched && !location.trim() ? 'Mine location is required.' : undefined;

  function save() {
    setTouched(true);
    if (!title.trim() || !location.trim()) return;
    try {
      actions.updateInspection(i.id, {
        title: title.trim(),
        objective: objective.trim(),
        priority,
        location: location.trim(),
      });
      onClose();
    } catch (e) {
      onError(errText(e));
      onClose();
    }
  }

  return (
    <Modal title={`Edit inspection · ${i.id}`} onClose={onClose}>
      <div>
        <p className="text-[12px] text-slate-500 mb-3">
          Edits update the shared record everywhere it appears — the table, this panel, the schedule and the report
          header. Dates, status and assignment are changed through their own actions.
        </p>
        <Field label="Inspection title" error={titleError}>
          <input className="input" value={title} autoFocus
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Quarterly safety audit — East Pit" />
        </Field>
        <Field label="Objective" hint="Shown in the details panel and on the exported DEMO file.">
          <textarea className="input" rows={3} value={objective}
            onChange={(e) => setObjective(e.target.value)}
            placeholder="What this inspection must verify…" />
        </Field>
        <Field label="Priority">
          <select className="input" value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Mine location" error={locationError} hint="Where on site the inspection is carried out.">
          <input className="input" value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. East Pit – Level 2" />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary !py-2 !text-[12px]" onClick={onClose}>Cancel</button>
          <PermBtn perm="canEditDetails" onClick={save} className="btn-primary !py-2 !text-[12px]">
            Save changes
          </PermBtn>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Reschedule / reassign / cancel — typed reason, applied or filed as a request
// ---------------------------------------------------------------------------

function RequestDialog({ row, kind, onClose, onError, onDone }: {
  row: InspectionRow;
  kind: 'reschedule' | 'reassign' | 'cancel';
  onClose: () => void;
  onError: (m: string) => void;
  onDone: (msg: string) => void;
}) {
  const db = useMockInspections();
  const i = row.inspection;
  const perms = rolePermissions(db);
  const [date, setDate] = useState(i.scheduledDate >= DEMO_TODAY ? addDays(i.scheduledDate, 7) : DEMO_TODAY);
  const [inspectorId, setInspectorId] = useState(
    (db.inspectors.find((x) => x.id !== i.assignedTo) ?? db.inspectors[0]).id,
  );
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);

  const direct = kind === 'reschedule' ? perms.canReschedule
    : kind === 'reassign' ? perms.canReassign
      : perms.canCancel;
  const dateError = touched && kind === 'reschedule' && !/^\d{4}-\d{2}-\d{2}$/.test(date)
    ? 'Choose a valid date.' : undefined;
  const reasonError = touched && !reason.trim() ? 'A reason is required.' : undefined;

  const heading = kind === 'reschedule' ? 'Reschedule inspection' : kind === 'reassign' ? 'Reassign inspection' : 'Cancel inspection';
  const submitLabel = direct
    ? (kind === 'reschedule' ? 'Reschedule now' : kind === 'reassign' ? 'Reassign now' : 'Cancel inspection')
    : (kind === 'reschedule' ? 'Request reschedule' : kind === 'reassign' ? 'Request reassignment' : 'Request cancellation');

  function submit() {
    setTouched(true);
    if (kind === 'reschedule' && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    if (!reason.trim()) return;
    try {
      if (kind === 'reschedule') {
        const r = actions.requestReschedule(i.id, date, reason);
        onDone(r.applied
          ? `Inspection ${i.id} rescheduled to ${fmtDate(date)}.`
          : `Reschedule request ${r.requestId} filed for ${i.id} — Pending Approval.`);
      } else if (kind === 'reassign') {
        const r = actions.requestReassign(i.id, inspectorId, reason);
        onDone(r.applied
          ? `Inspection ${i.id} reassigned to ${inspectorName(db, inspectorId)}.`
          : `Reassignment request ${r.requestId} filed for ${i.id} — Pending Approval.`);
      } else {
        const r = actions.requestCancel(i.id, reason);
        onDone(r.applied
          ? `Inspection ${i.id} cancelled — it stays visible for the audit trail.`
          : `Cancellation request ${r.requestId} filed for ${i.id} — Pending Approval.`);
      }
    } catch (e) {
      onError(errText(e));
      onClose();
    }
  }

  return (
    <Modal title={`${heading} · ${i.id}`} onClose={onClose}>
      <div className="space-y-1">
        <p className="text-[12px] text-slate-600 mb-2">
          {kind === 'cancel' && <b>This cannot be undone. </b>}
          <b>{i.id}</b> — {i.type} at {row.site.code} {row.site.name}, {i.location},{' '}
          {fmtDate(i.scheduledDate)} ({weekdayLong(i.scheduledDate)}) · {fmtTime(i.startTime)}–{fmtTime(i.endTime)},
          assigned to {row.assignedToName}.
        </p>

        {kind === 'reschedule' && (
          <Field label="New date" error={dateError}>
            <input type="date" className="input" value={date} min={DEMO_TODAY}
              onChange={(e) => setDate(e.target.value)} />
          </Field>
        )}

        {kind === 'reassign' && (
          <Field label="New inspector" hint="The current inspector loses the assignment once applied or approved.">
            <select className="input" value={inspectorId}
              onChange={(e) => setInspectorId(e.target.value)}>
              {db.inspectors.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name} · {x.designation}{x.id === i.assignedTo ? ' (current)' : ''}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label="Reason" error={reasonError} hint="Recorded on the inspection activity timeline.">
          <textarea className="input" rows={3} value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={kind === 'reschedule'
              ? 'e.g. Blasting programme moved to the 13th.'
              : kind === 'reassign'
                ? 'e.g. Original inspector on DGMS review duty.'
                : 'e.g. Mine under temporary production halt after rainfall.'} />
        </Field>

        <div className="rounded-xl bg-blue-50 border border-blue-100 px-3 py-2 text-[11.5px] text-blue-800">
          {direct
            ? `Your demo role applies this to the shared inspection record immediately.`
            : `Your demo role files a ${kind} request with status “Pending Approval” — the shared record only changes once a supervisory role approves it.`}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary !py-2 !text-[12px]" onClick={onClose}>
            {kind === 'cancel' ? 'Keep inspection' : 'Cancel'}
          </button>
          <PermBtn perm="canStart" onClick={submit}
            className={`!py-2 !text-[12px] ${kind === 'cancel' && direct ? 'bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl px-5 transition' : 'btn-primary'}`}>
            {submitLabel}
          </PermBtn>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Bulk: assign inspector (per-id successes and skips are reported)
// ---------------------------------------------------------------------------

function BulkAssignModal({ ids, onClose, onDone }: {
  ids: string[]; onClose: () => void; onDone: (msg: string) => void;
}) {
  const db = useMockInspections();
  const [inspectorId, setInspectorId] = useState(db.inspectors[0].id);
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const reasonError = touched && !reason.trim() ? 'A reason is required.' : undefined;

  function submit() {
    setTouched(true);
    if (!reason.trim()) return;
    let applied = 0;
    let requested = 0;
    let skippedCount = 0;
    const skipped: string[] = [];
    for (const id of ids) {
      try {
        const r = actions.requestReassign(id, inspectorId, reason);
        if (r.applied) applied += 1;
        else requested += 1;
      } catch (e) {
        skippedCount += 1;
        if (skipped.length < 3) skipped.push(`${id} — ${errText(e)}`);
      }
    }
    const parts = [
      `${applied} reassigned directly`,
      `${requested} filed as reassignment request(s)`,
    ];
    if (skippedCount > 0) parts.push(`${skippedCount} skipped: ${skipped.join(' · ')}`);
    onDone(`${parts.join('; ')}.`);
  }

  return (
    <Modal title={`Assign inspector · ${ids.length} selected`} onClose={onClose}>
      <div className="space-y-1">
        <p className="text-[12px] text-slate-600 mb-2">
          Reassign every selected inspection to one inspector. Each record is updated individually — completed or
          already-cancelled inspections are skipped and reported back.
        </p>
        <Field label="Inspector">
          <select className="input" value={inspectorId} onChange={(e) => setInspectorId(e.target.value)}>
            {db.inspectors.map((x) => (
              <option key={x.id} value={x.id}>{x.name} · {x.designation}</option>
            ))}
          </select>
        </Field>
        <Field label="Reason" error={reasonError} hint="Required for every request — recorded on the activity timeline.">
          <textarea className="input" rows={3} value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Workload rebalancing after the monsoon review." autoFocus />
        </Field>
        <div className="rounded-xl bg-blue-50 border border-blue-100 px-3 py-2 text-[11.5px] text-blue-800">
          Supervisory demo roles apply the reassignment directly; other roles file one request per inspection
          (status “Pending Approval”).
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary !py-2 !text-[12px]" onClick={onClose}>Cancel</button>
          <PermBtn perm="canReassign" onClick={submit} className="btn-primary !py-2 !text-[12px]">
            Apply to {ids.length} inspection{ids.length === 1 ? '' : 's'}
          </PermBtn>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Bulk: cancel (typed reason in a modal + a ConfirmDialog before it applies)
// ---------------------------------------------------------------------------

function BulkCancelModal({ ids, onClose, onDone, onError }: {
  ids: string[]; onClose: () => void; onDone: (msg: string) => void; onError: (m: string) => void;
}) {
  const db = useMockInspections();
  const perms = rolePermissions(db);
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const reasonError = touched && !reason.trim() ? 'A reason is required.' : undefined;

  function confirm() {
    setConfirming(false);
    try {
      actions.bulkCancel(ids, reason);
      onDone(`${ids.length} selected inspection(s) processed — every still-open record is now Cancelled, completed records were skipped.`);
    } catch (e) {
      onError(errText(e));
      onClose();
    }
  }

  return (
    <>
      <Modal title={`Cancel ${ids.length} inspection${ids.length === 1 ? '' : 's'}`} onClose={onClose}>
        <div className="space-y-1">
          <p className="text-[12px] text-slate-600 mb-2">
            Cancelled inspections are never deleted: they keep their status, reason and history for the audit trail,
            and completed records are skipped automatically.
          </p>
          <Field label="Reason" error={reasonError} hint="Stored as the cancellation reason on every affected record.">
            <textarea className="input" rows={3} value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Shaft maintenance window — inspection no longer required." autoFocus />
          </Field>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11.5px] text-amber-800">
            {perms.canBulkCancel
              ? 'Your supervisory demo role (Senior Labour Officer / Mine Admin) cancels directly once you confirm.'
              : 'Bulk cancellation needs a supervisory demo role. A supervisory role cancels directly; your current role cannot bulk-cancel — use the per-row “Cancel inspection” action instead, which files a cancellation request.'}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-secondary !py-2 !text-[12px]" onClick={onClose}>
              Keep inspections
            </button>
            <PermBtn perm="canBulkCancel" onClick={() => { setTouched(true); if (reason.trim()) setConfirming(true); }}
              className="btn-primary !py-2 !text-[12px]">
              Review cancellation
            </PermBtn>
          </div>
        </div>
      </Modal>

      {confirming && (
        <ConfirmDialog
          title={`Cancel ${ids.length} inspection${ids.length === 1 ? '' : 's'}?`}
          body={`Reason: ${reason.trim()}. Every selected inspection that is not Completed or already Cancelled will be marked Cancelled. This cannot be undone from this screen (reset the demo to restore the data).`}
          confirmLabel={`Cancel ${ids.length}`}
          onCancel={() => setConfirming(false)}
          onConfirm={confirm}
        />
      )}
    </>
  );
}
