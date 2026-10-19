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
  hasActiveFilters, rolePermissions, rowFor, tabCounts, useMockInspections, type FilterResult,
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

  /* __MAIN_JSX__ */

  return null;
}
