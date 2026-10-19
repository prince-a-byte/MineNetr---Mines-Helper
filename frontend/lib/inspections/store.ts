/**
 * MineNetr Mine Inspector — centralized synthetic repository for the
 * "My Inspections" module.
 *
 * This is the ONLY source of truth for /inspector/inspections,
 * /inspector/inspections/[id], /inspector/schedule, /inspector/checklists,
 * /inspector/findings, /inspector/evidence and /inspector/reports. Every page
 * subscribes via useMockInspections(); every mutation goes through `actions`,
 * which:
 *   1. validates input and enforces the demo-role permission boundary,
 *   2. updates EVERY affected record (row, panel, checklist progress, KPIs,
 *      schedule entry, report) so nothing can drift between pages,
 *   3. appends an activity entry,
 *   4. emits a toast and notifies subscribers.
 *
 * Demo persistence: the seed loads deterministically; runtime mutations are
 * mirrored into localStorage so the demo survives reloads; a schema version
 * guards against stale data; resetDemo() restores the original dataset.
 *
 * HTTP mode: lib/inspections/api.ts + repositories.ts define the adapter
 * boundary (every endpoint is PROPOSED and marked unconfirmed). Nothing in
 * this file silently falls back to mock data over HTTP.
 */
'use client';
import { useSyncExternalStore } from 'react';
import { getUser } from '../api';
import {
  CHECKLIST_RESPONSES, EFFECTIVE_STATUSES, FindingSource, INSPECTION_TABS,
  SAFETY_CONDITIONS, WEATHER_OPTIONS, WORKFLOW_STEPS,
  permissionsFor,
  type ChecklistProgress, type ChecklistProgressLite, type ChecklistResponseValue,
  type CreateEvidenceInput, type CreateFindingInput, type CreateInspectionInput,
  type EffectiveInspectionStatus, type Evidence, type FindingStatusValue,
  type InspectorDemoRole, type Inspection, type InspectionDbState, type InspectionFilters,
  type InspectionFinding, type InspectionKpis, type InspectionRow, type InspectionSeedSnapshot,
  type InspectorPermissions, type Priority, type ReportComparisonRow, type SaveChecklistInput,
  type ScheduleEntry, type SiteDetails, type UpdateInspectionInput,
} from './types';
import { DEMO_TODAY } from '../contracts/types';
import { inspectionSnapshot } from './seed';
import {
  addDays, daysBetween, demoNow, effectiveStatusOf, fmtDate, monthKey,
} from './format';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'minenetr_inspector_inspections_v1';
const SCHEMA_VERSION = 1;

function initial(): InspectionDbState {
  const snap: InspectionSeedSnapshot = inspectionSnapshot();
  return {
    rev: 0,
    role: 'Mine Inspector',
    selectedMineId: 'ALL',
    sites: snap.sites,
    inspectors: snap.inspectors,
    templates: snap.templates,
    items: snap.items,
    inspections: snap.inspections,
    responses: snap.responses,
    evidence: snap.evidence,
    findings: snap.findings,
    reports: snap.reports,
    notes: snap.notes,
    documents: snap.documents,
    requests: snap.requests,
    activity: snap.activity,
    toasts: [],
    seq: {
      resp: snap.responses.length + 1,
      evd: snap.evidence.length + 1,
      fnd: snap.findings.length + 1,
      rpt: snap.reports.length + 1,
      note: snap.notes.length + 1,
      doc: snap.documents.length + 1,
      req: snap.requests.length + 1,
      act: snap.activity.length + 1,
      insp: snap.inspections.length + 1,
    },
  };
}

let state: InspectionDbState = load() ?? initial();
let toastSeq = 1;
const listeners = new Set<() => void>();
function emit() { listeners.forEach((l) => l()); }
function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
function snapshot() { return state; }

export function useMockInspections(): InspectionDbState {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
export function getInspectionsDb(): InspectionDbState { return state; }

function persist() {
  if (typeof window === 'undefined') return;
  try {
    const { toasts, ...rest } = state;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: SCHEMA_VERSION, ...rest }));
  } catch { /* storage full/blocked — the demo still works in memory */ }
}

function load(): InspectionDbState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.v !== SCHEMA_VERSION) return null; // schema changed → reseed
    return { ...initial(), ...parsed, toasts: [] } as InspectionDbState;
  } catch { return null; }
}

export function toast(text: string) {
  state.toasts = [...state.toasts.slice(-2), { id: toastSeq++, text }];
  emit();
}

// ---------------------------------------------------------------------------
// Actor / activity / audit helpers
// ---------------------------------------------------------------------------

function actorName(): string {
  try {
    const u = getUser();
    if (u?.name) return String(u.name);
  } catch { /* demo fallback */ }
  return 'Amit Verma';
}

/** The signed-in inspector, resolved from auth and falling back to INSP-06. */
export function currentInspector(db: InspectionDbState = state) {
  const name = actorName();
  return db.inspectors.find((i) => i.name === name) ?? db.inspectors.find((i) => i.id === 'INSP-06') ?? db.inspectors[0];
}

export function rolePermissions(db: InspectionDbState = state): InspectorPermissions {
  return permissionsFor(db.role);
}

function logActivity(inspectionId: string, action: string, detail: string, by?: string) {
  state.activity.unshift({
    id: `IACT-${String(state.seq.act++).padStart(3, '0')}`,
    inspectionId, at: demoNow(), by: by ?? actorName(), action, detail,
  });
}

function bump() { state.rev += 1; }

function commit(action: string, resource: string, detail: string, message?: string) {
  // Activity entries only make sense against a real inspection record; the
  // two non-inspection resources (demo role, mine scope) stay out of the timeline.
  if (resource.startsWith('INS-')) logActivity(resource, action, detail);
  bump(); persist(); emit();
  if (message) toast(message);
}

function nextId(kind: string, prefix: string, width = 3) {
  return `${prefix}${String(state.seq[kind]++).padStart(width, '0')}`;
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

export function siteOf(db: InspectionDbState, id: string) {
  return db.sites.find((s) => s.id === id) ?? db.sites[0];
}
export function inspectorOf(db: InspectionDbState, id: string) {
  return db.inspectors.find((i) => i.id === id);
}
export function inspectorName(db: InspectionDbState, id: string): string {
  return inspectorOf(db, id)?.name ?? '—';
}
export function siteLabel(db: InspectionDbState, id: string): string {
  const s = siteOf(db, id);
  return `${s.code} · ${s.name}`;
}
export function templateOf(db: InspectionDbState, id: string) {
  return db.templates.find((t) => t.id === id) ?? db.templates[0];
}
export function itemsOf(db: InspectionDbState, templateId: string) {
  return db.items.filter((i) => i.templateId === templateId);
}
export function inspectionOf(db: InspectionDbState, id: string): Inspection | undefined {
  return db.inspections.find((i) => i.id === id);
}

export function requireInspection(db: InspectionDbState, id: string): Inspection {
  const i = inspectionOf(db, id);
  if (!i) throw new Error('Inspection not found.');
  return i;
}

function requirePerm(key: keyof InspectorPermissions, phrase: string) {
  const perms = permissionsFor(state.role);
  if (!perms[key]) {
    throw new Error(`Your demo role (${state.role}) cannot ${phrase}. Switch role to continue.`);
  }
}

// ---------------------------------------------------------------------------
// Checklist derivation
// ---------------------------------------------------------------------------

function responseKey(inspectionId: string, itemId: string) { return `${inspectionId}|${itemId}`; }

function responseMap(db: InspectionDbState) {
  const m = new Map<string, { response: ChecklistResponseValue; remarks: string; evidenceIds: string[]; updatedAt: string }>();
  for (const r of db.responses) {
    m.set(responseKey(r.inspectionId, r.itemId), {
      response: r.response, remarks: r.remarks, evidenceIds: r.evidenceIds, updatedAt: r.updatedAt,
    });
  }
  return m;
}

/**
 * Full checklist view for an inspection: template items merged with stored
 * responses. A missing response is always "Not Checked" — progress is derived,
 * never stored, so a section can never read complete while items are unanswered.
 */
export function checklistFor(db: InspectionDbState, inspectionId: string): ChecklistProgress {
  const insp = inspectionOf(db, inspectionId);
  const map = responseMap(db);
  const items = insp ? itemsOf(db, insp.templateId) : [];

  const sectionOrder: string[] = [];
  const rowsBySection = new Map<string, { item: typeof items[number]; response: ChecklistResponseValue; remarks: string; evidenceIds: string[]; updatedAt: string | null }[]>();
  for (const item of items) {
    if (!sectionOrder.includes(item.section)) { sectionOrder.push(item.section); rowsBySection.set(item.section, []); }
    const stored = map.get(responseKey(inspectionId, item.id));
    rowsBySection.get(item.section)!.push({
      item,
      response: stored?.response ?? 'Not Checked',
      remarks: stored?.remarks ?? '',
      evidenceIds: stored?.evidenceIds ?? [],
      updatedAt: stored?.updatedAt ?? null,
    });
  }

  const sections = sectionOrder.map((name, index) => {
    const rows = rowsBySection.get(name)!;
    let completed = 0, compliant = 0, nonCompliant = 0, na = 0, notChecked = 0, mandatoryRemaining = 0;
    for (const r of rows) {
      if (r.response === 'Not Checked') {
        notChecked++;
        if (r.item.mandatory) mandatoryRemaining++;
      } else {
        completed++;
        if (r.response === 'Compliant') compliant++;
        else if (r.response === 'Non-Compliant') nonCompliant++;
        else if (r.response === 'Not Applicable') na++;
      }
    }
    return {
      name, index, rows,
      total: rows.length, completed, compliant, nonCompliant,
      notApplicable: na, notChecked, flagged: nonCompliant, mandatoryRemaining,
      complete: notChecked === 0 && rows.length > 0,
    };
  });

  const totalItems = sections.reduce((a, s) => a + s.total, 0);
  const completed = sections.reduce((a, s) => a + s.completed, 0);
  const pending = sections.reduce((a, s) => a + s.notChecked, 0);
  const flagged = sections.reduce((a, s) => a + s.flagged, 0);
  return {
    totalItems, completed, pending, flagged,
    percent: totalItems === 0 ? 0 : Math.round((completed / totalItems) * 100),
    compliant: sections.reduce((a, s) => a + s.compliant, 0),
    nonCompliant: sections.reduce((a, s) => a + s.nonCompliant, 0),
    notApplicable: sections.reduce((a, s) => a + s.notApplicable, 0),
    mandatoryRemaining: sections.reduce((a, s) => a + s.mandatoryRemaining, 0),
    sections,
  };
}

function liteProgress(p: ChecklistProgress): ChecklistProgressLite {
  return { totalItems: p.totalItems, completed: p.completed, pending: p.pending, flagged: p.flagged, percent: p.percent };
}

// ---------------------------------------------------------------------------
// Rows / KPIs
// ---------------------------------------------------------------------------

export function rowFor(db: InspectionDbState, inspection: Inspection): InspectionRow {
  const p = checklistFor(db, inspection.id);
  const mineFindings = db.findings.filter((f) => f.inspectionId === inspection.id);
  const eff = effectiveStatusOf(inspection);
  return {
    inspection,
    effectiveStatus: eff,
    overdue: eff === 'Overdue',
    site: siteOf(db, inspection.mineId),
    assignedToName: inspectorName(db, inspection.assignedTo),
    assignedByName: inspectorName(db, inspection.assignedBy),
    progress: liteProgress(p),
    evidenceCount: db.evidence.filter((e) => e.inspectionId === inspection.id).length,
    findingCount: mineFindings.length,
    openFindingCount: mineFindings.filter((f) => f.status !== 'Resolved').length,
  };
}

/** Inspections inside the active mine scope (header mine selector). */
export function scopedInspections(db: InspectionDbState, mineId?: string): Inspection[] {
  const scope = mineId !== undefined ? mineId : db.selectedMineId;
  return db.inspections.filter((i) => scope === 'ALL' || i.mineId === scope);
}

export function computeKpis(db: InspectionDbState, mineId?: string): InspectionKpis {
  const list = scopedInspections(db, mineId);
  const eff = list.map((i) => effectiveStatusOf(i));
  const thisMonth = monthKey(DEMO_TODAY);
  const [y, m] = thisMonth.split('-').map(Number);
  const lastMonth = m === 1 ? `${y - 1}-12` : `${y - 1}-${String(m - 1).padStart(2, '0')}`;
  const inMonth = (iso: string, key: string) => monthKey(iso) === key;

  const completed = list.filter((_, idx) => eff[idx] === 'Completed');
  const openCount = list.filter((_, idx) => eff[idx] !== 'Cancelled').length;

  return {
    totalAssigned: list.length,
    completed: completed.length,
    pending: eff.filter((s) => s === 'Upcoming').length,
    overdue: eff.filter((s) => s === 'Overdue').length,
    inProgress: eff.filter((s) => s === 'In Progress' || s === 'Pending Submission').length,
    cancelled: eff.filter((s) => s === 'Cancelled').length,
    scheduledThisMonth: list.filter((i) => inMonth(i.scheduledDate, thisMonth)).length,
    completedThisMonth: completed.filter((i) => inMonth(i.scheduledDate, thisMonth)).length,
    completedLastMonth: completed.filter((i) => inMonth(i.scheduledDate, lastMonth)).length,
    dueThisWeek: list.filter((i) => {
      const s = effectiveStatusOf(i);
      if (s !== 'Upcoming' && s !== 'Overdue') return false;
      const d = daysBetween(DEMO_TODAY, i.scheduledDate);
      return d >= -7 && d <= 7;
    }).length,
    completionRate: openCount === 0 ? 100 : Math.round((completed.length / openCount) * 100),
    openFindings: db.findings.filter((f) => {
      if (f.status === 'Resolved') return false;
      const insp = inspectionOf(db, f.inspectionId);
      return insp ? (mineId ?? db.selectedMineId) === 'ALL' || insp.mineId === (mineId ?? db.selectedMineId) : false;
    }).length,
  };
}

// ---------------------------------------------------------------------------
// Filtering / sorting / pagination
// ---------------------------------------------------------------------------

const TAB_PREDICATE: Record<string, EffectiveInspectionStatus[]> = {
  'All Inspections': ['Upcoming', 'In Progress', 'Pending Submission', 'Completed', 'Overdue', 'Cancelled'],
  Upcoming: ['Upcoming'],
  'In Progress': ['In Progress', 'Pending Submission'],
  Completed: ['Completed'],
  Overdue: ['Overdue'],
};

export interface FilterResult {
  rows: InspectionRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  from: number;
  to: number;
}

/** Search + combined filters + sorting + pagination, all derived from one dataset. */
export function filterInspections(db: InspectionDbState, f: InspectionFilters): FilterResult {
  const q = f.q.trim().toLowerCase();
  const mineScope = f.mineId !== 'ALL' ? f.mineId : db.selectedMineId;
  const allowed = TAB_PREDICATE[f.tab] ?? TAB_PREDICATE['All Inspections'];

  let rows = db.inspections
    .filter((i) => mineScope === 'ALL' || i.mineId === mineScope)
    .map((i) => rowFor(db, i))
    .filter((r) => allowed.includes(r.effectiveStatus));

  if (f.status !== 'ALL') rows = rows.filter((r) => r.effectiveStatus === f.status);
  if (f.type !== 'ALL') rows = rows.filter((r) => r.inspection.type === f.type);
  if (f.priority !== 'ALL') rows = rows.filter((r) => r.inspection.priority === f.priority);
  if (f.dateFrom) rows = rows.filter((r) => r.inspection.scheduledDate >= f.dateFrom);
  if (f.dateTo) rows = rows.filter((r) => r.inspection.scheduledDate <= f.dateTo);
  if (q) {
    rows = rows.filter((r) => {
      const hay = [
        r.inspection.id, r.inspection.title, r.inspection.location, r.site.code, r.site.name,
        r.site.area, r.inspection.type, r.assignedToName, r.assignedByName,
      ].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }

  const dir = f.dir === 'asc' ? 1 : -1;
  const priorityRank: Record<Priority, number> = { High: 0, Normal: 1, Low: 2 };
  const statusRank = (s: EffectiveInspectionStatus) => EFFECTIVE_STATUSES.indexOf(s);
  const cmp: Record<string, (a: InspectionRow, b: InspectionRow) => number> = {
    date: (a, b) => a.inspection.scheduledDate.localeCompare(b.inspection.scheduledDate)
      || a.inspection.startTime.localeCompare(b.inspection.startTime),
    mine: (a, b) => a.site.code.localeCompare(b.site.code),
    type: (a, b) => a.inspection.type.localeCompare(b.inspection.type),
    priority: (a, b) => priorityRank[a.inspection.priority] - priorityRank[b.inspection.priority],
    status: (a, b) => statusRank(a.effectiveStatus) - statusRank(b.effectiveStatus),
    inspector: (a, b) => a.assignedToName.localeCompare(b.assignedToName),
    id: (a, b) => a.inspection.id.localeCompare(b.inspection.id),
  };
  const sorter = cmp[f.sort] ?? cmp.date;
  rows = [...rows].sort((a, b) => dir * sorter(a, b) || a.inspection.id.localeCompare(b.inspection.id));

  const total = rows.length;
  const pageSize = Math.max(1, f.pageSize);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, f.page), totalPages);
  const start = (page - 1) * pageSize;
  const slice = rows.slice(start, start + pageSize);

  return { rows: slice, total, page, pageSize, totalPages, from: total === 0 ? 0 : start + 1, to: Math.min(start + pageSize, total) };
}

/** Tab badge counts — computed, never hard-coded. */
export function tabCounts(db: InspectionDbState, f: InspectionFilters): Record<string, number> {
  const base: Record<string, number> = {};
  for (const tab of INSPECTION_TABS) base[tab] = 0;
  const mineScope = f.mineId !== 'ALL' ? f.mineId : db.selectedMineId;
  for (const i of db.inspections) {
    if (mineScope !== 'ALL' && i.mineId !== mineScope) continue;
    const eff = effectiveStatusOf(i);
    base['All Inspections'] += 1;
    for (const tab of INSPECTION_TABS) {
      if (tab === 'All Inspections') continue;
      if ((TAB_PREDICATE[tab] ?? []).includes(eff)) base[tab] += 1;
    }
  }
  return base;
}

export function hasActiveFilters(f: InspectionFilters): boolean {
  return Boolean(
    f.q || f.type !== 'ALL' || f.priority !== 'ALL' || f.status !== 'ALL'
    || f.dateFrom || f.dateTo || f.mineId !== 'ALL',
  );
}

// ---------------------------------------------------------------------------
// Related collections
// ---------------------------------------------------------------------------

export function evidenceFor(db: InspectionDbState, inspectionId: string): Evidence[] {
  return db.evidence.filter((e) => e.inspectionId === inspectionId)
    .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
}
export function findingsFor(db: InspectionDbState, inspectionId: string): InspectionFinding[] {
  return db.findings.filter((f) => f.inspectionId === inspectionId)
    .sort((a, b) => b.detectedAt.localeCompare(a.detectedAt));
}
export function notesFor(db: InspectionDbState, inspectionId: string) {
  return db.notes.filter((n) => n.inspectionId === inspectionId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export function documentsFor(db: InspectionDbState, inspectionId: string) {
  return db.documents.filter((d) => d.inspectionId === inspectionId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export function requestsFor(db: InspectionDbState, inspectionId: string) {
  return db.requests.filter((r) => r.inspectionId === inspectionId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export function activityFor(db: InspectionDbState, inspectionId: string) {
  return db.activity.filter((a) => a.inspectionId === inspectionId)
    .sort((a, b) => b.at.localeCompare(a.at));
}
export function reportOf(db: InspectionDbState, inspectionId: string) {
  return db.reports.find((r) => r.inspectionId === inspectionId);
}

/** Checklist templates enriched with how many live inspections instantiate them. */
export function templatesWithUsage(db: InspectionDbState) {
  return db.templates.map((t) => ({
    ...t,
    usageCount: db.inspections.filter((i) => i.templateId === t.id).length,
  }));
}

export function templateUsage(db: InspectionDbState, templateId: string): number {
  return db.inspections.filter((i) => i.templateId === templateId).length;
}

export function inspectionsUsingTemplate(db: InspectionDbState, templateId: string): Inspection[] {
  return db.inspections.filter((i) => i.templateId === templateId)
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
}

/** Checklist template groups for the Checklists & Forms page. */
export function templateCategories(db: InspectionDbState): { name: string; templates: number; items: number }[] {
  const map = new Map<string, { templates: number; items: number }>();
  for (const t of db.templates) {
    const cur = map.get(t.category) ?? { templates: 0, items: 0 };
    cur.templates += 1;
    cur.items += t.itemCount;
    map.set(t.category, cur);
  }
  return [...map.entries()].map(([name, v]) => ({ name, ...v }));
}

/** Previous reports for the same mine + inspection category (Documents tab). */
export function previousReportsFor(db: InspectionDbState, inspectionId: string) {
  const insp = inspectionOf(db, inspectionId);
  if (!insp) return [];
  const exact = db.reports.filter((r) => r.inspectionId !== inspectionId
    && r.mineId === insp.mineId && r.type === insp.type);
  if (exact.length) return exact.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  return db.reports.filter((r) => r.inspectionId !== inspectionId && r.type === insp.type)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

/** Derived schedule entries — the schedule page reads these, never a second copy. */
export function scheduleEntries(db: InspectionDbState, monthKeyValue?: string): ScheduleEntry[] {
  return db.inspections
    .filter((i) => (monthKeyValue ? monthKey(i.scheduledDate) === monthKeyValue : true))
    .filter((i) => db.selectedMineId === 'ALL' || i.mineId === db.selectedMineId)
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate) || a.startTime.localeCompare(b.startTime))
    .map((i) => ({
      date: i.scheduledDate,
      inspection: i,
      effectiveStatus: effectiveStatusOf(i),
      site: siteOf(db, i.mineId),
      inspectorName: inspectorName(db, i.assignedTo),
    }));
}

/** Simple demo comparison: previous finding vs current finding per requirement. */
export function compareWithPrevious(db: InspectionDbState, inspectionId: string): ReportComparisonRow[] {
  const insp = inspectionOf(db, inspectionId);
  if (!insp) return [];
  const current = checklistFor(db, inspectionId);
  const previous = db.inspections
    .filter((i) => i.id !== inspectionId && i.mineId === insp.mineId && i.type === insp.type && i.status === 'Completed')
    .sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate))[0];
  const prevMap = previous
    ? new Map(db.responses.filter((r) => r.inspectionId === previous.id).map((r) => [r.itemId, r.response] as const))
    : null;

  const rows: ReportComparisonRow[] = [];
  for (const section of current.sections) {
    for (const row of section.rows) {
      let prevResponse: string | undefined;
      if (previous) {
        // Match across templates by requirement text so differing forms still compare.
        const prevItem = db.items.find((it) => it.templateId === previous.templateId && it.requirement === row.item.requirement);
        prevResponse = prevItem ? prevMap?.get(prevItem.id) : undefined;
      }
      const change: ReportComparisonRow['change'] = !prevResponse
        ? (previous ? 'New Check' : 'Not Compared')
        : prevResponse === row.response ? 'Unchanged'
          : row.response === 'Compliant' ? 'Improved'
            : row.response === 'Not Checked' ? 'Declined'
              : prevResponse === 'Not Checked' ? 'Improved' : 'Declined';
      rows.push({
        requirement: row.item.requirement,
        previous: prevResponse ?? '—',
        current: row.response,
        change,
      });
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

function assertOpen(insp: Inspection, verb: string) {
  if (insp.status === 'Completed') throw new Error(`This inspection is Completed and is read-only. Create a separate reinspection to ${verb}.`);
  if (insp.status === 'Cancelled') throw new Error(`This inspection was cancelled and can no longer be ${verb}.`);
}

function validateTimeRange(start: string, end: string) {
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) throw new Error('Start time and end time are required (HH:MM).');
  const toMins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  if (toMins(end) <= toMins(start)) throw new Error('End time must be later than the start time.');
}

function siteDetailsComplete(s: SiteDetails): boolean {
  // Required per the Site Details tab: weather, safety conditions, location
  // description, date, start time and end time. Remarks/crew strength are optional.
  return Boolean(
    s.weather && s.safetyConditions && s.locationDescription.trim()
    && s.inspectionDate && s.startTime && s.endTime,
  );
}

export const actions = {
  /** Demo role switch — changes which controls are enabled. */
  setRole(role: InspectorDemoRole) {
    state.role = role;
    commit('Switched', 'demo-role', `Active demo role changed to ${role}.`, `Acting as ${role}.`);
  },

  /** Permission-scoped mine selection — persists across navigation + reload. */
  setSelectedMine(id: string) {
    state.selectedMineId = id;
    commit('Changed', 'mine-scope', `Reporting mine scope changed to ${id === 'ALL' ? 'All mines' : siteLabel(state, id)}.`);
  },

  // ----- lifecycle ---------------------------------------------------------

  /** Upcoming → In Progress. Initializes every checklist response as Not Checked. */
  startInspection(id: string): string {
    requirePerm('canStart', 'start inspections');
    const insp = requireInspection(state, id);
    const me = currentInspector();
    if (insp.assignedTo !== me.id) throw new Error(`This inspection is assigned to ${inspectorName(state, insp.assignedTo)}, not to you.`);
    if (insp.status !== 'Upcoming') {
      throw new Error(`Only Upcoming inspections can be started — this one is ${effectiveStatusOf(insp)}.`);
    }
    const items = itemsOf(state, insp.templateId);
    if (items.length === 0) throw new Error('The checklist template for this inspection has no items.');

    const now = demoNow();
    for (const item of items) {
      if (state.responses.some((r) => r.inspectionId === id && r.itemId === item.id)) continue;
      state.responses.push({
        id: nextId('resp', 'RESP-', 4),
        inspectionId: id, itemId: item.id, section: item.section,
        response: 'Not Checked', remarks: '', evidenceIds: [],
        updatedAt: now, updatedBy: me.id,
      });
    }
    insp.status = 'In Progress';
    insp.startedAt = now;
    insp.workflowStep = 0;
    insp.lastSavedAt = now;
    insp.siteDetails.inspectorId = me.id;
    if (!insp.siteDetails.inspectionDate) insp.siteDetails.inspectionDate = insp.scheduledDate;
    logActivity(id, 'Started', `${insp.id} started on site at ${siteLabel(state, insp.mineId)} — ${items.length} checklist items initialized.`);
    bump(); persist(); emit();
    toast(`Inspection ${insp.id} started — checklist ready.`);
    return insp.id;
  },

  /** Explicit "Save draft" — stamps progress without changing status. */
  saveDraft(id: string) {
    const insp = requireInspection(state, id);
    assertOpen(insp, 'resume it');
    if (insp.status === 'Upcoming') throw new Error('Start the inspection before saving progress.');
    insp.lastSavedAt = demoNow();
    logActivity(id, 'Draft Saved', `Progress saved at ${checklistFor(state, id).percent}% completion.`);
    bump(); persist(); emit();
    toast(`Draft saved — ${insp.id} progress is stored locally.`);
  },

  setWorkflowStep(id: string, step: number) {
    const insp = requireInspection(state, id);
    assertOpen(insp, 'change its workflow step');
    const clamped = Math.max(0, Math.min(WORKFLOW_STEPS.length - 1, step));
    if (clamped > 0 && insp.status === 'Upcoming') throw new Error('Start the inspection before moving to the next step.');
    insp.workflowStep = clamped;
    bump(); persist(); emit();
  },

  updateSiteDetails(id: string, patch: Partial<SiteDetails>) {
    requirePerm('canEditDetails', 'edit site details');
    const insp = requireInspection(state, id);
    assertOpen(insp, 'edit site details');
    const next: SiteDetails = { ...insp.siteDetails, ...patch };

    if (next.weather && !WEATHER_OPTIONS.includes(next.weather as typeof WEATHER_OPTIONS[number])) throw new Error('Select a valid weather condition.');
    if (next.safetyConditions && !SAFETY_CONDITIONS.includes(next.safetyConditions as typeof SAFETY_CONDITIONS[number])) throw new Error('Select a valid safety condition.');
    // Only validate fields the caller is actually changing: a form patches one
    // field at a time, and completeness is enforced at submission instead.
    if (patch.locationDescription !== undefined && !String(next.locationDescription).trim()) throw new Error('Location description is required.');
    if (next.startTime && next.endTime) validateTimeRange(next.startTime, next.endTime);
    if (next.crewStrength !== null && next.crewStrength !== undefined && (next.crewStrength < 0 || !Number.isFinite(next.crewStrength))) {
      throw new Error('Crew strength must be a positive number.');
    }
    if (next.inspectionDate && !/^\d{4}-\d{2}-\d{2}$/.test(next.inspectionDate)) throw new Error('A valid inspection date is required.');
    next.completedAt = siteDetailsComplete(next) ? demoNow() : null;
    insp.siteDetails = next;
    if (next.startTime && next.endTime) { insp.startTime = next.startTime; insp.endTime = next.endTime; insp.durationMins = minutesBetween(next.startTime, next.endTime); }
    commit('Updated', id, `Site details updated for ${insp.id}.`, 'Site details saved.');
  },

  createInspection(input: CreateInspectionInput): string {
    requirePerm('canEditDetails', 'schedule inspections');
    if (state.inspections.some((i) => i.id === input.id)) throw new Error(`Inspection ID ${input.id} already exists.`);
    if (!state.sites.some((s) => s.id === input.mineId)) throw new Error('Selected mine does not exist.');
    if (!state.inspectors.some((i) => i.id === input.assignedTo)) throw new Error('Selected inspector does not exist.');
    if (!state.templates.some((t) => t.id === input.templateId)) throw new Error('Selected checklist template does not exist.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.scheduledDate)) throw new Error('A valid scheduled date is required.');
    validateTimeRange(input.startTime, input.endTime);
    if (!input.title.trim()) throw new Error('Inspection title is required.');

    const insp: Inspection = {
      id: input.id, title: input.title.trim(), mineId: input.mineId, location: input.location,
      type: input.type, priority: input.priority, status: 'Upcoming',
      scheduledDate: input.scheduledDate, startTime: input.startTime, endTime: input.endTime,
      durationMins: minutesBetween(input.startTime, input.endTime),
      assignedTo: input.assignedTo, assignedBy: input.assignedBy,
      objective: input.objective, templateId: input.templateId, workflowStep: 0,
      requiredEvidenceCount: 4, createdAt: demoNow(),
      siteDetails: {
        weather: '', safetyConditions: '', locationDescription: '',
        inspectionDate: input.scheduledDate, startTime: '', endTime: '',
        inspectorId: input.assignedTo, crewStrength: null, generalRemarks: '', completedAt: null,
      },
    };
    state.inspections.unshift(insp);
    commit('Created', insp.id, `New inspection ${insp.id} scheduled at ${siteLabel(state, insp.mineId)} for ${fmtDate(input.scheduledDate)}.`,
      `Inspection ${insp.id} scheduled.`);
    return insp.id;
  },

  updateInspection(id: string, patch: UpdateInspectionInput) {
    requirePerm('canEditDetails', 'edit inspections');
    const insp = requireInspection(state, id);
    assertOpen(insp, 'edit it');
    if (patch.location !== undefined && !patch.location.trim()) throw new Error('Mine location is required.');
    if (patch.title !== undefined && !patch.title.trim()) throw new Error('Inspection title is required.');
    Object.assign(insp, patch);
    commit('Updated', id, `${id} edited (${Object.keys(patch).join(', ')}).`, `Inspection ${id} updated.`);
  },

  /**
   * Checklists & Forms: clone an existing template (name + category + items)
   * so the "New Checklist" action produces a real, previewable template rather
   * than an empty shell. New items get fresh stable CHK-### ids.
   */
  cloneTemplate(sourceId: string, input: { name: string; category: string; description: string }): string {
    requirePerm('canEditDetails', 'create checklist templates');
    const src = state.templates.find((t) => t.id === sourceId);
    if (!src) throw new Error('Source checklist template not found.');
    if (!input.name.trim()) throw new Error('Checklist name is required.');
    if (!input.category.trim()) throw new Error('Checklist category is required.');

    const maxOf = (ids: string[]) => ids.reduce((max, id) => {
      const n = Number(id.replace(/\D/g, ''));
      return Number.isFinite(n) && n > max ? n : max;
    }, 0);
    const id = `TMPL-${String(maxOf(state.templates.map((t) => t.id)) + 1).padStart(2, '0')}`;
    if (state.templates.some((t) => t.id === id)) throw new Error(`Checklist template ${id} already exists.`);

    const sourceItems = itemsOf(state, sourceId);
    const firstItemNo = maxOf(state.items.map((i) => i.id)) + 1;
    const copies = sourceItems.map((it, idx) => ({
      ...it,
      id: `CHK-${String(firstItemNo + idx).padStart(3, '0')}`,
      templateId: id,
    }));

    state.templates.push({
      id, name: input.name.trim(), category: input.category.trim(),
      description: input.description.trim() || `Cloned from ${src.name}.`,
      version: 'v1.0', sectionNames: [...src.sectionNames], itemCount: copies.length,
    });
    state.items.push(...copies);

    commit('Created', id,
      `Checklist template ${id} ("${input.name.trim()}") cloned from ${sourceId} — ${copies.length} items, category ${input.category.trim()}.`,
      `Checklist "${input.name.trim()}" created with ${copies.length} items.`);
    return id;
  },

  // ----- checklist ---------------------------------------------------------

  /** Saves one checklist answer and immediately recomputes progress everywhere. */
  saveChecklistResponse(input: SaveChecklistInput) {
    requirePerm('canWorkChecklist', 'record checklist responses');
    const insp = requireInspection(state, input.inspectionId);
    assertOpen(insp, 'resume it');
    if (insp.status === 'Upcoming') throw new Error('Start the inspection before answering checklist items.');
    if (!CHECKLIST_RESPONSES.includes(input.response)) throw new Error('Unknown checklist response.');
    const item = itemsOf(state, insp.templateId).find((i) => i.id === input.itemId);
    if (!item) throw new Error('Checklist item does not belong to this inspection.');
    if (input.response === 'Non-Compliant' && item.evidenceRequired) {
      const linked = input.evidenceIds?.length
        ?? state.responses.find((r) => r.inspectionId === input.inspectionId && r.itemId === input.itemId)?.evidenceIds.length
        ?? 0;
      if (linked === 0) {
        throw new Error('Attach at least one evidence record to this item — it is flagged as evidence-required and is being marked Non-Compliant.');
      }
    }

    const existing = state.responses.find((r) => r.inspectionId === input.inspectionId && r.itemId === input.itemId);
    const now = demoNow();
    if (existing) {
      existing.response = input.response;
      if (input.remarks !== undefined) existing.remarks = input.remarks;
      if (input.evidenceIds !== undefined) existing.evidenceIds = input.evidenceIds;
      existing.updatedAt = now;
      existing.updatedBy = currentInspector().id;
    } else {
      state.responses.push({
        id: nextId('resp', 'RESP-', 4), inspectionId: input.inspectionId, itemId: input.itemId,
        section: item.section, response: input.response, remarks: input.remarks ?? '',
        evidenceIds: input.evidenceIds ?? [], updatedAt: now, updatedBy: currentInspector().id,
      });
    }
    insp.lastSavedAt = now;
    const progress = checklistFor(state, input.inspectionId);
    if (insp.status === 'In Progress' && progress.totalItems > 0 && progress.pending === 0) {
      insp.status = 'Pending Submission';
    } else if (insp.status === 'Pending Submission' && progress.pending > 0) {
      insp.status = 'In Progress';
    }
    logActivity(input.inspectionId, 'Checklist Updated',
      `${item.id} marked ${input.response} — ${progress.completed}/${progress.totalItems} answered (${progress.percent}%).`);
    bump(); persist(); emit();
  },

  // ----- evidence ----------------------------------------------------------

  addEvidence(input: CreateEvidenceInput): string {
    requirePerm('canManageEvidence', 'add evidence');
    const insp = requireInspection(state, input.inspectionId);
    assertOpen(insp, 'add evidence to it');
    if (!input.title.trim()) throw new Error('Evidence title is required.');
    if (input.itemId && !itemsOf(state, insp.templateId).some((i) => i.id === input.itemId)) {
      throw new Error('The linked checklist item does not belong to this inspection.');
    }
    const evidence: Evidence = {
      id: nextId('evd', 'EVD-'),
      inspectionId: input.inspectionId,
      itemId: input.itemId ?? null,
      type: input.type,
      title: input.title.trim(),
      description: input.description.trim(),
      capturedAt: demoNow(),
      location: input.location?.trim() || insp.location,
      fileRef: input.fileRef || 'DEMO-FILE://inspections/capture.txt',
      fileName: input.fileName || `capture_${state.seq.evd}.txt`,
      sizeKb: input.sizeKb ?? 128,
      uploadedBy: currentInspector().id,
    };
    state.evidence.unshift(evidence);
    logActivity(input.inspectionId, 'Evidence Added', `${evidence.id} "${evidence.title}" (${evidence.type}) attached${evidence.itemId ? ` to ${evidence.itemId}` : ''}.`);
    bump(); persist(); emit();
    toast(`Evidence ${evidence.id} added to ${input.inspectionId}.`);
    return evidence.id;
  },

  updateEvidence(id: string, patch: { title?: string; description?: string }) {
    requirePerm('canManageEvidence', 'edit evidence');
    const e = state.evidence.find((x) => x.id === id);
    if (!e) throw new Error('Evidence not found.');
    const insp = requireInspection(state, e.inspectionId);
    assertOpen(insp, 'edit evidence on it');
    if (patch.title !== undefined && !patch.title.trim()) throw new Error('Evidence title is required.');
    Object.assign(e, patch);
    commit('Updated', e.inspectionId, `Evidence ${e.id} details updated.`, `Evidence ${e.id} updated.`);
  },

  removeEvidence(id: string) {
    requirePerm('canManageEvidence', 'remove evidence');
    const idx = state.evidence.findIndex((x) => x.id === id);
    if (idx === -1) throw new Error('Evidence not found.');
    const e = state.evidence[idx];
    const insp = requireInspection(state, e.inspectionId);
    assertOpen(insp, 'remove evidence from it');
    state.evidence.splice(idx, 1);
    for (const r of state.responses) {
      if (r.inspectionId === e.inspectionId && r.evidenceIds.includes(id)) {
        r.evidenceIds = r.evidenceIds.filter((x) => x !== id);
      }
    }
    for (const f of state.findings) {
      if (f.inspectionId === e.inspectionId && f.evidence.includes(id)) {
        f.evidence = f.evidence.filter((x) => x !== id);
      }
    }
    commit('Removed', e.inspectionId, `Evidence ${e.id} removed and unlinked from responses/findings.`, `Evidence ${e.id} removed.`);
  },

  linkEvidence(evidenceId: string, itemId: string | null) {
    requirePerm('canManageEvidence', 'link evidence');
    const e = state.evidence.find((x) => x.id === evidenceId);
    if (!e) throw new Error('Evidence not found.');
    const insp = requireInspection(state, e.inspectionId);
    assertOpen(insp, 'relink evidence on it');
    if (itemId && !itemsOf(state, insp.templateId).some((i) => i.id === itemId)) {
      throw new Error('The selected checklist item does not belong to this inspection.');
    }
    e.itemId = itemId;
    commit('Linked', e.inspectionId, `Evidence ${e.id} ${itemId ? `linked to checklist item ${itemId}` : 'unlinked from its checklist item'}.`,
      itemId ? `Evidence linked to ${itemId}.` : 'Evidence link removed.');
  },

  // ----- findings ----------------------------------------------------------

  createFinding(input: CreateFindingInput): string {
    requirePerm('canCreateFinding', 'raise findings');
    const insp = requireInspection(state, input.inspectionId);
    // Findings are additive records, so they can still be raised while a report is
    // under review — only a cancelled inspection refuses new observations.
    if (insp.status === 'Cancelled') throw new Error('A cancelled inspection cannot carry new findings.');
    if (!input.description.trim()) throw new Error('Finding description is required.');
    if (input.itemId && !itemsOf(state, insp.templateId).some((i) => i.id === input.itemId)) {
      throw new Error('The linked checklist item does not belong to this inspection.');
    }
    const seq = String(state.seq.fnd++).padStart(3, '0');
    const finding: InspectionFinding = {
      id: `FND-${DEMO_TODAY.slice(0, 4)}-${seq}`,
      mineId: insp.mineId, inspectionId: insp.id, inspectorId: currentInspector().id,
      category: input.category, severity: input.severity, status: 'Open',
      source: FindingSource.Inspector, location: insp.location,
      description: input.description.trim(),
      recommendation: input.recommendation.trim(),
      assignee: input.assignee.trim() || 'Mine Manager',
      detectedAt: demoNow(),
      dueDate: addDays(DEMO_TODAY, input.severity === 'Critical' ? 3 : input.severity === 'High' ? 7 : 15),
      evidence: input.evidence ?? [],
      itemId: input.itemId ?? null,
      verifiedHuman: true,
    };
    state.findings.unshift(finding);
    logActivity(insp.id, 'Finding Raised', `${finding.id} (${finding.severity}) raised against ${finding.itemId ?? insp.location}.`);
    bump(); persist(); emit();
    toast(`Finding ${finding.id} recorded on ${insp.id}.`);
    return finding.id;
  },

  updateFindingStatus(id: string, status: FindingStatusValue) {
    requirePerm('canCreateFinding', 'update finding status');
    const f = state.findings.find((x) => x.id === id);
    if (!f) throw new Error('Finding not found.');
    if (status === 'Resolved' && f.recommendation.trim().length === 0) {
      throw new Error('A corrective recommendation is required before a finding can be resolved.');
    }
    const before = f.status;
    f.status = status;
    commit('Updated', f.inspectionId, `Finding ${f.id} moved from ${before} to ${status}.`, `Finding ${f.id} → ${status}.`);
  },

  // ----- notes -------------------------------------------------------------

  addNote(inspectionId: string, body: string, draft: boolean): string {
    requirePerm('canManageNotes', 'add notes');
    const insp = requireInspection(state, inspectionId);
    if (!body.trim()) throw new Error('Note text is required.');
    const now = demoNow();
    const note = {
      id: nextId('note', 'NOTE-'), inspectionId, body: body.trim(),
      authorId: currentInspector().id, createdAt: now, updatedAt: now, draft,
    };
    state.notes.unshift(note);
    commit('Added', inspectionId, `Note ${note.id} ${draft ? 'saved as draft' : 'published'}.`,
      draft ? 'Note saved as draft.' : 'Note added.');
    return note.id;
  },

  updateNote(id: string, body: string) {
    requirePerm('canManageNotes', 'edit notes');
    const n = state.notes.find((x) => x.id === id);
    if (!n) throw new Error('Note not found.');
    if (!body.trim()) throw new Error('Note text is required.');
    n.body = body.trim();
    n.updatedAt = demoNow();
    commit('Updated', n.inspectionId, `Note ${n.id} edited.`, 'Note updated.');
  },

  deleteNote(id: string) {
    requirePerm('canManageNotes', 'delete notes');
    const idx = state.notes.findIndex((x) => x.id === id);
    if (idx === -1) throw new Error('Note not found.');
    const n = state.notes[idx];
    if (!n.draft) throw new Error('Only draft notes can be deleted. Published notes stay in the inspection history.');
    state.notes.splice(idx, 1);
    commit('Deleted', n.inspectionId, `Draft note ${n.id} deleted.`, 'Draft note deleted.');
  },

  // ----- documents ---------------------------------------------------------

  attachDocument(inspectionId: string, input: { title: string; category: string; fileName: string; sizeKb: number }) {
    requirePerm('canAttachDocument', 'attach documents');
    const insp = requireInspection(state, inspectionId);
    if (!input.title.trim()) throw new Error('Document title is required.');
    const doc = {
      id: nextId('doc', 'DOC-'), inspectionId, title: input.title.trim(),
      category: input.category as never, fileRef: `DEMO-FILE://documents/${input.fileName}`,
      fileName: input.fileName, sizeKb: input.sizeKb, updatedAt: demoNow(),
      owner: currentInspector().id, sample: true as const,
    };
    state.documents.unshift(doc);
    commit('Attached', inspectionId, `Sample document ${doc.id} (${doc.fileName}) attached to ${inspectionId}.`,
      `Sample document attached to ${inspectionId}.`);
  },

  /** Records a demo download against the inspection timeline (the file itself is produced by export.ts). */
  logDownload(inspectionId: string, kind: 'report' | 'document' | 'checklist' | 'evidence', title: string) {
    requireInspection(state, inspectionId);
    logActivity(inspectionId, 'Downloaded', `${kind} "${title}" downloaded as a watermarked DEMO text file.`);
    bump(); persist(); emit();
  },

  // ----- schedule / approval workflow --------------------------------------

  requestReschedule(id: string, toDate: string, reason: string) {
    const insp = requireInspection(state, id);
    assertOpen(insp, 'reschedule it');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(toDate)) throw new Error('A valid new date is required.');
    if (toDate < DEMO_TODAY) throw new Error(`Choose a date on or after ${fmtDate(DEMO_TODAY)}.`);
    if (!reason.trim()) throw new Error('A reason is required for a reschedule request.');
    const perms = permissionsFor(state.role);
    const from = insp.scheduledDate;
    if (perms.canReschedule) {
      insp.scheduledDate = toDate;
      insp.siteDetails.inspectionDate = toDate;
      commit('Rescheduled', id, `${id} moved from ${fmtDate(from)} to ${fmtDate(toDate)} — ${reason.trim()}`,
        `Inspection rescheduled to ${fmtDate(toDate)}.`);
      return { applied: true, requestId: '' };
    }
    const requestId = actions.createRequest(id, 'Reschedule', reason, { toDate });
    return { applied: false, requestId };
  },

  requestReassign(id: string, inspectorId: string, reason: string) {
    const insp = requireInspection(state, id);
    assertOpen(insp, 'reassign it');
    const target = inspectorOf(state, inspectorId);
    if (!target) throw new Error('Selected inspector does not exist.');
    if (target.id === insp.assignedTo) throw new Error('That inspector already owns this inspection.');
    if (!reason.trim()) throw new Error('A reason is required for a reassignment request.');
    const perms = permissionsFor(state.role);
    if (perms.canReassign) {
      const from = inspectorName(state, insp.assignedTo);
      insp.assignedTo = target.id;
      commit('Reassigned', id, `${id} moved from ${from} to ${target.name} — ${reason.trim()}`,
        `Inspection reassigned to ${target.name}.`);
      return { applied: true, requestId: '' };
    }
    const requestId = actions.createRequest(id, 'Reassign', reason, { toInspector: inspectorId });
    return { applied: false, requestId };
  },

  cancelInspection(id: string, reason: string) {
    requirePerm('canCancel', 'cancel inspections');
    const insp = requireInspection(state, id);
    if (insp.status === 'Completed') throw new Error('A completed inspection cannot be cancelled — raise a reinspection instead.');
    if (insp.status === 'Cancelled') throw new Error('This inspection is already cancelled.');
    if (!reason.trim()) throw new Error('A cancellation reason is required.');
    insp.status = 'Cancelled';
    insp.cancelledAt = demoNow();
    insp.cancelReason = reason.trim();
    commit('Cancelled', id, `${id} cancelled — ${reason.trim()}`, `Inspection ${id} cancelled.`);
  },

  requestCancel(id: string, reason: string) {
    requirePerm('canStart', 'request a cancellation');
    const perms = permissionsFor(state.role);
    if (perms.canCancel) { actions.cancelInspection(id, reason); return { applied: true, requestId: '' }; }
    const requestId = actions.createRequest(id, 'Cancel', reason);
    return { applied: false, requestId };
  },

  createRequest(
    inspectionId: string,
    kind: 'Reschedule' | 'Reassign' | 'Cancel',
    reason: string,
    extra: { toDate?: string; toInspector?: string } = {},
  ): string {
    requirePerm('canStart', 'submit approval requests');
    const insp = requireInspection(state, inspectionId);
    if (!reason.trim()) throw new Error('A reason is required for this request.');
    const id = nextId('req', 'REQ-');
    state.requests.unshift({
      id, inspectionId, kind, requestedBy: currentInspector().id,
      fromDate: insp.scheduledDate, toDate: extra.toDate, toInspector: extra.toInspector,
      reason: reason.trim(), status: 'Pending Approval', createdAt: demoNow(),
    });
    logActivity(inspectionId, `${kind} Requested`, `${id} submitted for ${insp.id} — ${reason.trim()}`);
    bump(); persist(); emit();
    toast(`${kind} request ${id} submitted — Pending Approval.`);
    return id;
  },

  decideRequest(requestId: string, approve: boolean, note: string) {
    requirePerm('canApproveRequests', 'decide reschedule/reassignment requests');
    const req = state.requests.find((r) => r.id === requestId);
    if (!req) throw new Error('Request not found.');
    if (req.status !== 'Pending Approval') throw new Error(`This request was already ${req.status.toLowerCase()}.`);
    const insp = requireInspection(state, req.inspectionId);
    req.status = approve ? 'Approved' : 'Rejected';
    req.decidedBy = currentInspector().id;
    req.decidedAt = demoNow();
    req.decisionNote = note.trim();

    if (approve) {
      if (req.kind === 'Reschedule' && req.toDate) {
        insp.scheduledDate = req.toDate;
        insp.siteDetails.inspectionDate = req.toDate;
      } else if (req.kind === 'Reassign' && req.toInspector) {
        insp.assignedTo = req.toInspector;
      } else if (req.kind === 'Cancel') {
        insp.status = 'Cancelled';
        insp.cancelledAt = demoNow();
        insp.cancelReason = req.reason;
      }
    }
    commit(approve ? 'Approved' : 'Rejected', req.inspectionId,
      `${req.id} (${req.kind} for ${req.inspectionId}) ${req.status}${note.trim() ? ` — ${note.trim()}` : ''}.`,
      `${req.id} ${req.status}.`);
  },

  // ----- bulk ---------------------------------------------------------------

  bulkCancel(ids: string[], reason: string) {
    requirePerm('canBulkCancel', 'cancel inspections in bulk');
    if (ids.length === 0) throw new Error('Select at least one inspection.');
    if (!reason.trim()) throw new Error('A cancellation reason is required for bulk cancellation.');
    const eligible = ids.filter((id) => {
      const i = inspectionOf(state, id);
      return i && i.status !== 'Completed' && i.status !== 'Cancelled';
    });
    if (eligible.length === 0) throw new Error('None of the selected inspections can be cancelled (completed or already cancelled).');
    for (const id of eligible) {
      const i = inspectionOf(state, id)!;
      i.status = 'Cancelled';
      i.cancelledAt = demoNow();
      i.cancelReason = reason.trim();
    }
    const skipped = ids.length - eligible.length;
    commit('Bulk Cancelled', 'inspections',
      `${eligible.length} inspection(s) cancelled in bulk — ${reason.trim()}${skipped ? `; ${skipped} skipped (not cancellable)` : ''}.`,
      `${eligible.length} inspection(s) cancelled${skipped ? `, ${skipped} skipped` : ''}.`);
  },

  // ----- submission ---------------------------------------------------------

  /**
   * Validation-first submission: incomplete checklists are refused with the
   * exact sections that still need work, and only a confirmed save flips the
   * status to Completed, records the timestamp and generates the report.
   */
  submitInspection(id: string) {
    requirePerm('canSubmit', 'submit inspections');
    const insp = requireInspection(state, id);
    if (insp.status === 'Completed') throw new Error('This inspection has already been submitted.');
    if (insp.status === 'Cancelled') throw new Error('A cancelled inspection cannot be submitted.');
    if (insp.status === 'Upcoming') throw new Error('Start the inspection before submitting it.');

    const progress = checklistFor(state, id);
    if (progress.totalItems === 0) throw new Error('This inspection has no checklist items — cannot submit.');
    if (progress.pending > 0) {
      const parts = progress.sections.filter((s) => s.notChecked > 0)
        .map((s) => `${s.name} (${s.notChecked})`);
      throw new Error(`Complete all required checklist items before submitting this inspection — still unanswered: ${parts.join(', ')}.`);
    }
    if (!siteDetailsComplete(insp.siteDetails)) {
      const missing: string[] = [];
      const s = insp.siteDetails;
      if (!s.weather) missing.push('weather');
      if (!s.safetyConditions) missing.push('safety conditions');
      if (!s.locationDescription.trim()) missing.push('location description');
      if (!s.startTime || !s.endTime) missing.push('start/end time');
      throw new Error(`Complete the Site Details tab before submitting — missing: ${missing.join(', ')}.`);
    }
    const evidenceCount = evidenceFor(state, id).length;
    if (evidenceCount < insp.requiredEvidenceCount) {
      throw new Error(`Attach at least ${insp.requiredEvidenceCount} evidence records before submitting (currently ${evidenceCount}).`);
    }

    const now = demoNow();
    insp.status = 'Completed';
    insp.submittedAt = now;
    insp.lastSavedAt = now;
    insp.workflowStep = WORKFLOW_STEPS.length - 1;
    insp.siteDetails.completedAt = insp.siteDetails.completedAt ?? now;

    // Generate / refresh the synthetic report from live counts — never invented.
    const findingCount = findingsFor(state, id).length;
    const summaryBits = [
      `${progress.compliant} compliant, ${progress.nonCompliant} non-compliant, ${progress.notApplicable} not applicable checks`,
      `${evidenceCount} evidence records`,
      `${findingCount} finding${findingCount === 1 ? '' : 's'} raised`,
    ];
    const existing = reportOf(state, id);
    if (existing) {
      existing.status = 'Submitted';
      existing.submittedAt = now;
      existing.version += 1;
      existing.counts = {
        compliant: progress.compliant, nonCompliant: progress.nonCompliant,
        notApplicable: progress.notApplicable, notChecked: progress.pending,
        evidence: evidenceCount, findings: findingCount,
      };
      existing.summary = `Revision ${existing.version}: ${summaryBits.join('; ')}.`;
    } else {
      const report = {
        id: nextId('rpt', 'RPT-'),
        inspectionId: id, mineId: insp.mineId, type: insp.type,
        title: `Inspection Report — ${siteOf(state, insp.mineId).name} · ${fmtDate(insp.scheduledDate)}`,
        status: 'Submitted' as const, version: 1, inspectorId: insp.assignedTo,
        submittedAt: now, reviewedAt: null,
        summary: `${summaryBits.join('; ')}. Generated automatically on submission of ${insp.id}.`,
        counts: {
          compliant: progress.compliant, nonCompliant: progress.nonCompliant,
          notApplicable: progress.notApplicable, notChecked: progress.pending,
          evidence: evidenceCount, findings: findingCount,
        },
      };
      state.reports.unshift(report);
      insp.reportId = report.id;
    }

    logActivity(id, 'Submitted', `${id} submitted at ${progress.percent}% checklist completion — report ${insp.reportId ?? 'updated'} generated.`);
    bump(); persist(); emit();
    toast(`Inspection ${id} submitted — report generated.`);
    return insp.reportId;
  },

  resetDemo() {
    if (typeof window !== 'undefined') {
      try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    }
    state = initial();
    toast('Demo data reset — original synthetic inspections restored.');
    emit();
  },
};

function minutesBetween(a: string, b: string): number {
  const toMins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  return Math.max(0, toMins(b) - toMins(a));
}
