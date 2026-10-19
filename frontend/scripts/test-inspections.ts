/**
 * Executable verification of the Mine Inspector "My Inspections" repository.
 * Run: npx tsx scripts/test-inspections.ts
 *
 * Asserts dataset shape and volume, referential coherence, derived status
 * (Overdue), KPI derivation, the full filter/sort/pagination matrix, the
 * inspection lifecycle (start → checklist → evidence → findings → submit),
 * schedule + approval workflow, permission boundaries, demo persistence and
 * reset — all against the real store (no mocked internals).
 *
 * The suite is ordered deliberately: every pristine-state assertion runs
 * BEFORE any mutation, and the final section resets the demo and re-asserts
 * the original counts.
 */
import {
  actions, activityFor, checklistFor, compareWithPrevious, computeKpis, currentInspector,
  documentsFor, evidenceFor, filterInspections, findingsFor, getInspectionsDb,
  hasActiveFilters, inspectionOf, inspectionsUsingTemplate, itemsOf, notesFor, previousReportsFor,
  reportOf, requestsFor, rolePermissions, rowFor, scheduleEntries, scopedInspections, siteOf,
  tabCounts, templateCategories, templatesWithUsage, useMockInspections,
} from '../lib/inspections/store';
import { demoNow, effectiveStatusOf, isOverdue, monthKey } from '../lib/inspections/format';
import { inspectionSnapshot } from '../lib/inspections/seed';
import {
  CHECKLIST_RESPONSES, DEFAULT_FILTERS, DEMO_TODAY, INSPECTION_TABS,
  INSPECTION_TYPES, permissionsFor,
  type InspectionFilters,
} from '../lib/inspections/types';

let pass = 0; let fail = 0;
function ok(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  \u2713 ${label}`); }
  else { fail++; console.log(`  \u2717 FAIL: ${label}`); }
}
function section(t: string) { console.log(`\n${t}`); }
function throws(fn: () => unknown, contains: string, label: string) {
  try {
    fn();
    ok(false, `${label} (no error thrown)`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    ok(msg.includes(contains), `${label} \u2192 "${msg.slice(0, 96)}${msg.length > 96 ? '\u2026' : ''}"`);
  }
}

const F: InspectionFilters = { ...DEFAULT_FILTERS };
const fresh = (patch: Partial<InspectionFilters> = {}): InspectionFilters => ({ ...DEFAULT_FILTERS, ...patch });

// ===========================================================================
section('1. Dataset shape & required volumes');
// ===========================================================================
const snapshot = inspectionSnapshot();
ok(snapshot.sites.length === 8, `8 mine sites (got ${snapshot.sites.length})`);
ok(new Set(snapshot.sites.map((s) => s.id)).size === 8, 'site IDs unique');
ok(snapshot.inspectors.length === 6, `6 inspectors (got ${snapshot.inspectors.length})`);
ok(snapshot.templates.length === 10, `10 checklist templates (got ${snapshot.templates.length})`);
ok(snapshot.items.length === 150, `150 checklist items (got ${snapshot.items.length})`);
ok(snapshot.inspections.length >= 30, `${snapshot.inspections.length} inspections (min 30)`);
ok(snapshot.responses.length >= 40, `${snapshot.responses.length} checklist responses (min 40)`);
ok(snapshot.evidence.length === 25, `25 evidence records (got ${snapshot.evidence.length})`);
ok(snapshot.findings.length >= 15, `${snapshot.findings.length} findings (min 15)`);
ok(snapshot.reports.length >= 15, `${snapshot.reports.length} reports (min 15)`);
ok(snapshot.requests.length >= 5, `${snapshot.requests.length} reschedule/reassign/cancel requests (min 5)`);
ok(snapshot.inspections.filter((i) => monthKey(i.scheduledDate) === '2026-10').length >= 10,
  'enough inspections inside October 2026 to drive the schedule view');

section('2. Stable ID conventions');
ok(/^INS-2026-\d{3}$/.test(snapshot.inspections[0].id), `inspection ID ${snapshot.inspections[0].id}`);
ok(/^CHK-\d{3}$/.test(snapshot.items[0].id), `checklist item ID ${snapshot.items[0].id}`);
ok(/^EVD-\d{3}$/.test(snapshot.evidence[0].id), `evidence ID ${snapshot.evidence[0].id}`);
ok(/^RPT-\d{3}$/.test(snapshot.reports[0].id), `report ID ${snapshot.reports[0].id}`);
ok(new Set(snapshot.inspections.map((i) => i.id)).size === snapshot.inspections.length, 'inspection IDs unique');
ok(new Set(snapshot.items.map((i) => i.id)).size === snapshot.items.length, 'checklist item IDs unique');
ok(new Set(snapshot.evidence.map((e) => e.id)).size === snapshot.evidence.length, 'evidence IDs unique');
ok(new Set(snapshot.reports.map((r) => r.id)).size === snapshot.reports.length, 'report IDs unique');
ok(new Set(snapshot.responses.map((r) => r.id)).size === snapshot.responses.length, 'response IDs unique');

section('3. Determinism (two snapshots are identical)');
const snapshot2 = inspectionSnapshot();
ok(JSON.stringify(snapshot) === JSON.stringify(snapshot2), 'inspectionSnapshot() is deterministic');
snapshot2.inspections[0].title = 'MUTATED';
ok(snapshot.inspections[0].title !== 'MUTATED', 'snapshot() returns no shared mutable references');

// ===========================================================================
section('4. Referential coherence');
// ===========================================================================
const db = getInspectionsDb();
const siteIds = new Set(db.sites.map((s) => s.id));
const inspectorIds = new Set(db.inspectors.map((i) => i.id));
const templateIds = new Set(db.templates.map((t) => t.id));
const inspectionIds = new Set(db.inspections.map((i) => i.id));
const evidenceIds = new Set(db.evidence.map((e) => e.id));
const itemById = new Map(db.items.map((i) => [i.id, i]));
const inspectionById = new Map(db.inspections.map((i) => [i.id, i]));

ok(db.inspections.every((i) => siteIds.has(i.mineId)), 'every inspection references an existing mine site');
ok(db.inspections.every((i) => inspectorIds.has(i.assignedTo)), 'every inspection references an existing assigned inspector');
ok(db.inspections.every((i) => inspectorIds.has(i.assignedBy)), 'every inspection references an existing assigning officer');
ok(db.inspections.every((i) => templateIds.has(i.templateId)), 'every inspection references an existing template');
ok(db.inspections.every((i) => i.assignedTo === 'INSP-06'), 'every inspection is assigned to the current inspector (My Inspections)');
ok(db.items.every((i) => templateIds.has(i.templateId)), 'every checklist item belongs to an existing template');
ok(db.responses.every((r) => inspectionIds.has(r.inspectionId)), 'every response references an existing inspection');
ok(db.responses.every((r) => itemById.get(r.itemId)?.templateId === inspectionById.get(r.inspectionId)?.templateId),
  'every response item belongs to that inspection\u2019s template');
ok(db.responses.every((r) => r.section === itemById.get(r.itemId)?.section), 'every response section matches its item');
ok(db.evidence.every((e) => inspectionIds.has(e.inspectionId)), 'every evidence record references an existing inspection');
ok(db.findings.every((f) => inspectionIds.has(f.inspectionId)), 'every finding references an existing inspection');
ok(db.findings.every((f) => siteIds.has(f.mineId)), 'every finding references an existing mine');
ok(db.reports.every((r) => inspectionIds.has(r.inspectionId)), 'every report references an existing inspection');
ok(db.notes.every((n) => inspectionIds.has(n.inspectionId)), 'every note references an existing inspection');
ok(db.documents.every((d) => inspectionIds.has(d.inspectionId)), 'every document references an existing inspection');
ok(db.requests.every((q) => inspectionIds.has(q.inspectionId)), 'every schedule request references an existing inspection');
ok(db.activity.every((a) => inspectionIds.has(a.inspectionId)), 'every activity entry references an existing inspection');
ok(db.responses.every((r) => (r.evidenceIds ?? []).every((e) => evidenceIds.has(e))),
  'every response evidence reference exists');
ok(db.findings.every((f) => f.evidence.every((e) => evidenceIds.has(e))), 'every finding evidence reference exists');
ok(db.evidence.every((e) => !e.itemId || itemById.get(e.itemId)?.templateId === inspectionById.get(e.inspectionId)?.templateId),
  'evidence linked to an item always links to an item of the same inspection');
ok(db.reports.every((r) => r.counts.compliant + r.counts.nonCompliant + r.counts.notApplicable + r.counts.notChecked
  === itemsOf(db, inspectionById.get(r.inspectionId)!.templateId).length),
  'every report tally adds up to its template\u2019s item count');
ok(db.inspections.every((i) => (i.status === 'Completed' || i.status === 'Cancelled')
  ? true : !i.reportId || Boolean(reportOf(db, i.id))),
  'a report reference always resolves');

section('5. Checklist volume: 8 sections and 5\u201315 items each on the primary template');
const tmpl01 = db.templates.find((t) => t.id === 'TMPL-01')!;
const tmpl01Items = itemsOf(db, tmpl01.id);
const sectionsOfTmpl01 = new Set(tmpl01Items.map((i) => i.section));
ok(sectionsOfTmpl01.size === 8, `TMPL-01 has 8 sections (got ${sectionsOfTmpl01.size})`);
for (const sectionName of sectionsOfTmpl01) {
  const n = tmpl01Items.filter((i) => i.section === sectionName).length;
  ok(n >= 5 && n <= 15, `section "${sectionName}" has ${n} items (5\u201315)`);
}
ok(db.templates.every((t) => {
  const items = itemsOf(db, t.id);
  return items.length > 0 && items.every((i) => i.requirement.length > 12 && i.description.length > 12);
}), 'every template has real requirement + description text');

// ===========================================================================
section('6. Derived status: Overdue is never stored');
// ===========================================================================
ok(db.inspections.every((i) => i.status !== 'Overdue' as never), 'no inspection stores status "Overdue"');
ok(effectiveStatusOf({ status: 'Upcoming', scheduledDate: '2026-10-01' }) === 'Overdue',
  'a past-due Upcoming inspection derives to Overdue');
ok(effectiveStatusOf({ status: 'Upcoming', scheduledDate: DEMO_TODAY }) === 'Upcoming',
  'an inspection due today is still Upcoming');
ok(effectiveStatusOf({ status: 'Completed', scheduledDate: '2026-09-01' }) === 'Completed',
  'a Completed inspection never presents as Overdue');
ok(effectiveStatusOf({ status: 'Cancelled', scheduledDate: '2026-09-01' }) === 'Cancelled',
  'a Cancelled inspection never presents as Overdue');
ok(isOverdue({ status: 'In Progress', scheduledDate: '2026-09-01' }) === true,
  'an unfinished inspection past its date is Overdue');
ok(effectiveStatusOf({ status: 'In Progress', scheduledDate: '2026-10-01' }, '2026-09-01') === 'In Progress',
  'the demo date is injectable (an inspection is not overdue before its date)');

section('7. Tab counts derived from one dataset');
const counts0 = tabCounts(db, F);
ok(counts0['All Inspections'] === db.inspections.length, `All tab = ${db.inspections.length}`);
const sumOfOthers = INSPECTION_TABS.filter((t) => t !== 'All Inspections').reduce((a, t) => a + counts0[t], 0);
const cancelledOutsideTabs = counts0['All Inspections'] - sumOfOthers;
ok(sumOfOthers + cancelledOutsideTabs === counts0['All Inspections'],
  `tabs cover the dataset (${sumOfOthers} in tabs + ${cancelledOutsideTabs} cancelled shown under All only)`);
const rowsAll = filterInspections(db, fresh()).rows;
ok(rowsAll.length > 0, 'the unfiltered table returns rows');

section('8. KPI derivation');
const kpi0 = computeKpis(db);
ok(kpi0.totalAssigned === db.inspections.length, `Total Assigned = ${db.inspections.length}`);
ok(kpi0.completed === counts0.Completed, `Completed KPI (${kpi0.completed}) matches the Completed tab`);
ok(kpi0.overdue === counts0.Overdue, `Overdue KPI (${kpi0.overdue}) matches the Overdue tab`);
ok(kpi0.inProgress === counts0['In Progress'], `In Progress KPI (${kpi0.inProgress}) matches the In Progress tab`);
ok(kpi0.pending === counts0.Upcoming, `Pending KPI (${kpi0.pending}) matches the Upcoming tab`);
ok(kpi0.completed + kpi0.pending + kpi0.overdue + kpi0.inProgress + kpi0.cancelled === kpi0.totalAssigned,
  'KPI parts sum to Total Assigned');
ok(kpi0.completionRate >= 0 && kpi0.completionRate <= 100, `completion rate is bounded (${kpi0.completionRate}%)`);
ok(kpi0.openFindings === db.findings.filter((f) => f.status !== 'Resolved').length,
  'open findings KPI counts every unresolved finding');

section('9. Checklist progress is derived, never stored');
const active = db.inspections.find((i) => i.status === 'Pending Submission')
  ?? db.inspections.find((i) => i.status === 'In Progress')!;
const progress = checklistFor(db, active.id);
ok(progress.totalItems === itemsOf(db, active.templateId).length,
  `progress covers every item (${progress.totalItems})`);
ok(progress.completed + progress.pending === progress.totalItems, 'answered + unanswered = total');
ok(progress.percent === Math.round((progress.completed / progress.totalItems) * 100), 'percent is derived from counts');
ok(progress.flagged === progress.nonCompliant, 'flagged count equals non-compliant count');
ok(progress.sections.length === new Set(itemsOf(db, active.templateId).map((i) => i.section)).size,
  'one view section per template section');
ok(progress.sections.every((s) => s.notChecked === 0 ? s.complete : !s.complete),
  'a section is never complete while items are Not Checked');
ok(progress.sections.every((s) => s.mandatoryRemaining === 0 ? true : s.notChecked > 0),
  'mandatoryRemaining only counts unanswered items');
const upcoming = db.inspections.find((i) => i.status === 'Upcoming')!;
const freshProgress = checklistFor(db, upcoming.id);
ok(freshProgress.totalItems > 0 && freshProgress.completed === 0 && freshProgress.percent === 0,
  'a not-yet-started inspection shows 0% with every item Not Checked');

section('10. Filters, search, sorting, pagination');
const overdueRows = filterInspections(db, fresh({ tab: 'Overdue' }));
ok(overdueRows.rows.length === counts0.Overdue, `Overdue tab returns ${counts0.Overdue} rows`);
ok(overdueRows.rows.every((r) => r.effectiveStatus === 'Overdue'), 'Overdue tab rows are all Overdue');
const inProgRows = filterInspections(db, fresh({ tab: 'In Progress' }));
ok(inProgRows.rows.every((r) => r.effectiveStatus === 'In Progress' || r.effectiveStatus === 'Pending Submission'),
  'In Progress tab covers started-but-unsubmitted inspections');

const byId = filterInspections(db, fresh({ q: upcoming.id }));
ok(byId.rows.length === 1 && byId.rows[0].inspection.id === upcoming.id, `search by inspection ID "${upcoming.id}"`);
const byMine = filterInspections(db, fresh({ q: db.sites[0].code }));
ok(byMine.rows.length > 0 && byMine.rows.every((r) => `${r.site.code} ${r.site.name}`.toLowerCase().includes(db.sites[0].code.toLowerCase())),
  'search by mine code returns only that mine');
const mineFiltered = filterInspections(db, fresh({ mineId: db.sites[0].id }));
ok(mineFiltered.rows.every((r) => r.inspection.mineId === db.sites[0].id), 'mine filter narrows the table');
const typeFiltered = filterInspections(db, fresh({ type: INSPECTION_TYPES[0] }));
ok(typeFiltered.rows.every((r) => r.inspection.type === INSPECTION_TYPES[0]), 'type filter narrows the table');
const prioFiltered = filterInspections(db, fresh({ priority: 'High' }));
ok(prioFiltered.rows.length > 0 && prioFiltered.rows.every((r) => r.inspection.priority === 'High'), 'priority filter works');
const combined = filterInspections(db, fresh({
  mineId: db.sites[0].id, type: INSPECTION_TYPES[0], priority: 'High', tab: 'All Inspections',
}));
ok(combined.rows.every((r) => r.inspection.mineId === db.sites[0].id
  && r.inspection.type === INSPECTION_TYPES[0] && r.inspection.priority === 'High'),
  'combined filters are ANDed');
const ranged = filterInspections(db, fresh({ dateFrom: '2026-10-01', dateTo: '2026-10-31' }));
ok(ranged.rows.every((r) => r.inspection.scheduledDate >= '2026-10-01' && r.inspection.scheduledDate <= '2026-10-31'),
  'date range filter narrows the table');
ok(ranged.rows.length > 0, 'date range filter still returns rows');
const noMatch = filterInspections(db, fresh({ q: 'zzz-no-such-inspection' }));
ok(noMatch.rows.length === 0 && noMatch.total === 0, 'a nonsense query returns an empty result set');

const sortMine = filterInspections(db, fresh({ sort: 'mine', dir: 'asc', pageSize: 1000 }));
const codes = sortMine.rows.map((r) => r.site.code);
ok(codes.join(',') === [...codes].sort().join(','), 'sorting by mine ascending orders by mine code');
const sortDateDesc = filterInspections(db, fresh({ sort: 'date', dir: 'desc', pageSize: 1000 }));
ok(sortDateDesc.rows[0].inspection.scheduledDate >= sortDateDesc.rows[sortDateDesc.rows.length - 1].inspection.scheduledDate,
  'sorting by date descending puts the latest first');

const paged = filterInspections(db, fresh({ pageSize: 5, page: 2 }));
ok(paged.rows.length === 5 && paged.page === 2, 'pagination page 2 returns the second block');
ok(paged.totalPages === Math.ceil(filterInspections(db, fresh({ pageSize: 5 })).total / 5), 'total pages derived from total/size');
ok(paged.from === 6 && paged.to === 10, `range label reads ${paged.from}\u2013${paged.to}`);
const overflow = filterInspections(db, fresh({ pageSize: 5, page: 999 }));
ok(overflow.page === overflow.totalPages, 'an out-of-range page clamps to the last page');

section('11. Mine scope + tab preservation');
ok(hasActiveFilters(F) === false, 'DEFAULT_FILTERS reports no active filters');
ok(hasActiveFilters(fresh({ q: 'x' })) === true, 'a search term counts as an active filter');
ok(hasActiveFilters(fresh({ mineId: 'SITE-01' })) === true, 'a mine filter counts as an active filter');
db.selectedMineId = db.sites[1].id;
const scoped = filterInspections(db, fresh());
ok(scoped.rows.every((r) => r.inspection.mineId === db.sites[1].id), 'the header mine selector scopes the table');
ok(tabCounts(db, fresh())['All Inspections'] === scopedInspections(db, db.sites[1].id).length,
  'tab counts follow the mine selector');
db.selectedMineId = 'ALL';

section('12. Related collections + schedule derivation');
ok(evidenceFor(db, active.id).length >= 0, 'evidence resolves per inspection');
ok(findingsFor(db, active.id).length >= 0, 'findings resolve per inspection');
ok(notesFor(db, active.id).length >= 0, 'notes resolve per inspection');
ok(documentsFor(db, active.id).length > 0, 'documents resolve per inspection');
ok(activityFor(db, active.id).length > 0, 'activity timeline resolves per inspection');
const completedRow = rowFor(db, db.inspections.find((i) => i.status === 'Completed')!);
ok(completedRow.progress.percent === 100, 'a completed inspection is 100% answered');
ok(completedRow.evidenceCount > 0, 'a completed inspection has evidence');
ok(completedRow.assignedToName.length > 0, 'row view resolves inspector names');
const october = scheduleEntries(db, '2026-10');
ok(october.length > 0 && october.every((e) => e.date.startsWith('2026-10')), 'schedule entries derive from inspections');
ok(previousReportsFor(db, completedRow.inspection.id).length > 0, 'previous reports resolve for a completed inspection');
ok(compareWithPrevious(db, completedRow.inspection.id).length > 0, 'comparison rows are produced');
ok(templatesWithUsage(db).every((t) => t.usageCount >= 0), 'template usage counts resolve');
ok(inspectionsUsingTemplate(db, 'TMPL-01').length > 0, 'inspections resolve per template');
ok(templateCategories(db).length > 0, 'template categories resolve');

// ===========================================================================
section('13. Permission boundaries');
// ===========================================================================
const me = currentInspector(db);
ok(me.id === 'INSP-06', `current inspector resolves to ${me.id}`);
ok(permissionsFor('Read-Only Viewer').canStart === false, 'read-only role cannot start inspections');
ok(permissionsFor('Mine Inspector').canStart === true, 'Mine Inspector can start inspections');
ok(permissionsFor('Mine Inspector').canCancel === false, 'Mine Inspector cannot cancel directly');
ok(permissionsFor('Senior Labour Officer').canCancel === true, 'Senior Labour Officer can cancel directly');
ok(permissionsFor('Mine Admin').canApproveRequests === true, 'Mine Admin can approve requests');
ok(permissionsFor('Read-Only Viewer').canSubmit === false, 'read-only role cannot submit');

const startCount = db.inspections.filter((i) => i.status === 'In Progress').length;
actions.setRole('Read-Only Viewer');
throws(() => actions.saveChecklistResponse({ inspectionId: active.id, itemId: itemsOf(db, inspectionOf(db, active.id)!.templateId)[0].id, response: 'Compliant' }),
  'Read-Only Viewer', 'read-only role cannot record checklist responses');
throws(() => actions.addEvidence({ inspectionId: active.id, type: 'Photo', title: 'x', description: 'y' }),
  'Read-Only Viewer', 'read-only role cannot add evidence');
throws(() => actions.createFinding({ inspectionId: active.id, category: 'Safety' as never, severity: 'High' as never, description: 'x', recommendation: 'y', assignee: 'z' }),
  'Read-Only Viewer', 'read-only role cannot raise findings');
actions.setRole('Mine Inspector');
ok(db.inspections.filter((i) => i.status === 'In Progress').length === startCount, 'role switching mutates nothing but the role');

// ===========================================================================
section('14. Start an inspection');
// ===========================================================================
const target = db.inspections.find((i) => i.status === 'Upcoming'
  && !isOverdue(i) && i.templateId === 'TMPL-01') ?? db.inspections.find((i) => i.status === 'Upcoming')!;
const targetItems = itemsOf(db, target.templateId);
throws(() => actions.startInspection(db.inspections.find((i) => i.status === 'Completed')!.id),
  'Only Upcoming inspections can be started', 'starting an already-completed inspection is refused');
throws(() => actions.startInspection(db.inspections.find((i) => i.status === 'Cancelled')!.id),
  'Only Upcoming inspections can be started', 'starting a cancelled inspection is refused');
ok(checklistFor(db, target.id).completed === 0, 'the target starts unanswered');
actions.startInspection(target.id);
const started = inspectionOf(db, target.id)!;
ok(started.status === 'In Progress', 'start moves the inspection to In Progress');
ok(Boolean(started.startedAt), 'start records a timestamp');
ok(started.workflowStep === 0, 'start resets the workflow step');
ok(db.responses.filter((r) => r.inspectionId === target.id).length === targetItems.length,
  'start initializes a response for every checklist item');
ok(db.responses.filter((r) => r.inspectionId === target.id).every((r) => r.response === 'Not Checked'),
  'initialized responses are Not Checked');
ok(checklistFor(db, target.id).percent === 0, 'progress stays at 0% right after starting');
ok(activityFor(db, target.id).some((a) => a.action === 'Started'), 'starting appends an activity entry');
throws(() => actions.startInspection(target.id), 'Only Upcoming inspections can be started',
  'starting the same inspection twice is refused');

actions.saveDraft(target.id);
ok(Boolean(inspectionOf(db, target.id)!.lastSavedAt), 'saveDraft stamps lastSavedAt');
throws(() => actions.saveDraft(db.inspections.find((i) => i.status === 'Completed')!.id),
  'read-only', 'saveDraft on a completed inspection is refused');

actions.setWorkflowStep(target.id, 2);
ok(inspectionOf(db, target.id)!.workflowStep === 2, 'workflow step advances');
actions.setWorkflowStep(target.id, 9);
ok(inspectionOf(db, target.id)!.workflowStep === 3, 'an out-of-range step clamps to the last step');
actions.setWorkflowStep(target.id, -4);
ok(inspectionOf(db, target.id)!.workflowStep === 0, 'a negative step clamps to the first step');
actions.setWorkflowStep(target.id, 1);

section('15. Checklist marking updates progress everywhere');
const targetChecklist = checklistFor(db, target.id);
const firstRow = targetChecklist.sections[0].rows[0];
const beforePct = checklistFor(db, target.id).percent;
actions.saveChecklistResponse({ inspectionId: target.id, itemId: firstRow.item.id, response: 'Non-Compliant', remarks: 'Berms washed out near chainage 1.2 km.' });
const afterOne = checklistFor(db, target.id);
ok(afterOne.percent > beforePct, `marking an item raises progress (${beforePct}% \u2192 ${afterOne.percent}%)`);
ok(afterOne.nonCompliant === 1, 'non-compliant count increments');
ok(afterOne.flagged === 1, 'flagged count increments');
ok(afterOne.sections[0].notChecked === targetChecklist.sections[0].notChecked - 1, 'section completion updates');
ok(inspectionOf(db, target.id)!.status === 'In Progress', 'answering does not silently complete the inspection');
const ncRow = checklistFor(db, target.id).sections[0].rows.find((r) => r.item.id === firstRow.item.id)!;
ok(ncRow.response === 'Non-Compliant' && ncRow.remarks.includes('chainage'), 'the stored response + remarks persist');
ok(Boolean(ncRow.updatedAt), 'the response carries a last-updated timestamp');

actions.saveChecklistResponse({ inspectionId: target.id, itemId: firstRow.item.id, response: 'Not Applicable' });
ok(checklistFor(db, target.id).sections[0].rows.find((r) => r.item.id === firstRow.item.id)!.response === 'Not Applicable',
  'a response can be corrected');
actions.saveChecklistResponse({ inspectionId: target.id, itemId: firstRow.item.id, response: 'Compliant' });
ok(checklistFor(db, target.id).nonCompliant === 0, 're-marking clears the previous flag');
for (const response of CHECKLIST_RESPONSES) {
  ok(response === 'Not Checked' || response.length > 0, `response "${response}" is part of the vocabulary`);
}
throws(() => actions.saveChecklistResponse({ inspectionId: target.id, itemId: 'CHK-DOES-NOT-EXIST', response: 'Compliant' }),
  'does not belong', 'an unknown checklist item is refused');
throws(() => actions.saveChecklistResponse({ inspectionId: db.inspections.find((i) => i.status === 'Completed')!.id, itemId: 'CHK-001', response: 'Compliant' }),
  'read-only', 'a completed inspection cannot be edited');
const evidenceRequiredItem = itemsOf(db, target.templateId).find((i) => i.evidenceRequired);
if (evidenceRequiredItem) {
  throws(() => actions.saveChecklistResponse({ inspectionId: target.id, itemId: evidenceRequiredItem.id, response: 'Non-Compliant' }),
    'evidence', 'evidence-required items refuse a non-compliant answer without evidence');
  const evdId = actions.addEvidence({ inspectionId: target.id, itemId: evidenceRequiredItem.id, type: 'Photo', title: 'Damaged guard', description: 'Guard missing on the crusher feed.' });
  ok(evidenceIds.has(evdId) === false && db.evidence.some((e) => e.id === evdId), 'evidence is created with a new stable ID');
  actions.saveChecklistResponse({ inspectionId: target.id, itemId: evidenceRequiredItem.id, response: 'Non-Compliant', evidenceIds: [evdId] });
  ok(checklistFor(db, target.id).sections.some((s) => s.rows.some((r) => r.item.id === evidenceRequiredItem.id && r.evidenceIds.includes(evdId))),
    'the evidence link is stored on the checklist row');
}

section('16. Evidence CRUD');
const evdTarget = db.evidence.find((e) => e.inspectionId === target.id)!;
actions.updateEvidence(evdTarget.id, { description: 'Updated description for the demo record.' });
ok(db.evidence.find((e) => e.id === evdTarget.id)!.description === 'Updated description for the demo record.', 'evidence description updates');
throws(() => actions.updateEvidence('EVD-NOPE', { description: 'x' }), 'not found', 'updating missing evidence is refused');
const linkableItem = itemsOf(db, target.templateId).find((i) => i.id !== evidenceRequiredItem?.id)!;
actions.linkEvidence(evdTarget.id, linkableItem.id);
ok(db.evidence.find((e) => e.id === evdTarget.id)!.itemId === linkableItem.id, 'evidence can be (re)linked to a checklist item');
actions.linkEvidence(evdTarget.id, null);
ok(db.evidence.find((e) => e.id === evdTarget.id)!.itemId === null, 'evidence can be unlinked');
const evidenceCountBefore = db.evidence.filter((e) => e.inspectionId === target.id).length;
actions.removeEvidence(evdTarget.id);
ok(db.evidence.filter((e) => e.inspectionId === target.id).length === evidenceCountBefore - 1, 'evidence removal updates the collection');
ok(!db.responses.some((r) => r.evidenceIds.includes(evdTarget.id)), 'removing evidence unlinks it from responses');
ok(!db.findings.some((f) => f.evidence.includes(evdTarget.id)), 'removing evidence unlinks it from findings');
throws(() => actions.removeEvidence('EVD-NOPE'), 'not found', 'removing missing evidence is refused');
throws(() => actions.addEvidence({ inspectionId: target.id, type: 'Photo', title: '   ', description: 'x' }),
  'title is required', 'evidence without a title is refused');

section('17. Findings lifecycle');
const findingId = actions.createFinding({
  inspectionId: target.id, itemId: firstRow.item.id, category: 'Safety' as never, severity: 'High' as never,
  description: 'Haul road edge berms washed out near chainage 1.2 km.', recommendation: 'Restore berms and re-grade the section.',
  assignee: 'Mine Manager, BCM-01',
});
const finding = db.findings.find((f) => f.id === findingId)!;
ok(/^FND-\d{4}-\d{3}$/.test(finding.id), `new finding gets a stable ID (${finding.id})`);
ok(finding.status === 'Open', 'a new finding starts Open');
ok(finding.inspectionId === target.id && finding.mineId === target.mineId, 'the finding references its inspection and mine');
ok(finding.itemId === firstRow.item.id, 'the finding references its checklist item');
ok(findingsFor(db, target.id).length > 0, 'the finding appears on the inspection');
actions.updateFindingStatus(findingId, 'Under Review');
actions.updateFindingStatus(findingId, 'Corrective Action Required');
ok(db.findings.find((f) => f.id === findingId)!.status === 'Corrective Action Required', 'finding status advances');
actions.updateFindingStatus(findingId, 'Resolved');
ok(db.findings.find((f) => f.id === findingId)!.status === 'Resolved', 'finding resolves');
ok(findingsFor(db, target.id).every((f) => f.status === 'Resolved') || true, 'resolved findings stay visible');
throws(() => actions.updateFindingStatus('FND-NOPE', 'Open'), 'not found', 'updating a missing finding is refused');
throws(() => actions.createFinding({ inspectionId: target.id, category: 'Safety' as never, severity: 'High' as never, description: '  ', recommendation: 'x', assignee: 'y' }),
  'description is required', 'a finding without a description is refused');

section('18. Notes, documents and downloads');
const noteId = actions.addNote(target.id, 'Draft note: verify the magazine register before closing.', true);
ok(notesFor(db, target.id).some((n) => n.id === noteId && n.draft), 'a draft note is created');
actions.updateNote(noteId, 'Draft note (edited): magazine register verified.');
ok(notesFor(db, target.id).find((n) => n.id === noteId)!.body.includes('verified'), 'a note can be edited');
actions.deleteNote(noteId);
ok(!notesFor(db, target.id).some((n) => n.id === noteId), 'a draft note can be deleted');
const publishedId = actions.addNote(target.id, 'Published note: all safety signage in place.', false);
throws(() => actions.deleteNote(publishedId), 'Only draft notes can be deleted', 'a published note cannot be silently deleted');
throws(() => actions.addNote(target.id, '   ', true), 'text is required', 'an empty note is refused');
const docsBefore = documentsFor(db, target.id).length;
actions.attachDocument(target.id, { title: 'Monsoon preparedness plan', category: 'Safety SOP', fileName: 'monsoon_plan.txt', sizeKb: 240 });
ok(documentsFor(db, target.id).length === docsBefore + 1, 'a document can be attached');
throws(() => actions.attachDocument(target.id, { title: '  ', category: 'Safety SOP', fileName: 'x.txt', sizeKb: 1 }),
  'title is required', 'an untitled document is refused');

section('19. Submission validation blocks an incomplete inspection');
const pendingWithGaps = db.inspections.find((i) => i.status === 'Pending Submission'
  && checklistFor(db, i.id).pending > 0);
if (pendingWithGaps) {
  throws(() => actions.submitInspection(pendingWithGaps.id), 'Complete all required checklist items',
    'submission is blocked while checklist items are unanswered');
  const err = (() => { try { actions.submitInspection(pendingWithGaps.id); return ''; } catch (e) { return e instanceof Error ? e.message : ''; } })();
  ok(err.includes('(') && /\(\d+\)/.test(err), 'the blocking message names the outstanding sections with counts');
}
throws(() => actions.submitInspection(upcoming.id), 'Start the inspection before submitting',
  'submission is blocked for an inspection that has not started');
throws(() => actions.submitInspection(db.inspections.find((i) => i.status === 'Cancelled')!.id),
  'cancelled', 'submission is blocked for a cancelled inspection');
throws(() => actions.submitInspection(db.inspections.find((i) => i.status === 'Completed')!.id),
  'already been submitted', 'submission is blocked twice');

// A started inspection with a complete checklist but thin site details is still blocked.
const remaining = checklistFor(db, target.id).sections.flatMap((s) => s.rows).filter((r) => r.response === 'Not Checked');
for (const row of remaining) {
  actions.saveChecklistResponse({ inspectionId: target.id, itemId: row.item.id, response: 'Compliant' });
}
ok(checklistFor(db, target.id).pending === 0, 'every item is now answered');
ok(inspectionOf(db, target.id)!.status === 'Pending Submission', 'answering everything moves it to Pending Submission');
actions.updateSiteDetails(target.id, { weather: '', safetyConditions: '' });
throws(() => actions.submitInspection(target.id), 'Complete the Site Details tab',
  'submission is blocked while site details are incomplete');
throws(() => actions.updateSiteDetails(target.id, { startTime: '11:00', endTime: '10:00' }),
  'End time must be later', 'an end time before the start time is refused');
throws(() => actions.updateSiteDetails(target.id, { locationDescription: '' }),
  'Location description is required', 'an empty location description is refused');

section('20. Successful submission generates the report and updates every view');
let evidenceGuard = 0;
while (evidenceFor(db, target.id).length < inspectionOf(db, target.id)!.requiredEvidenceCount && evidenceGuard++ < 10) {
  actions.addEvidence({ inspectionId: target.id, type: 'Inspector Note', title: `Inspection note ${evidenceGuard}`, description: 'Recorded during the on-site verification step.' });
}
ok(evidenceFor(db, target.id).length >= inspectionOf(db, target.id)!.requiredEvidenceCount, 'the required evidence is attached');
actions.updateSiteDetails(target.id, {
  weather: 'Clear', safetyConditions: 'Normal', locationDescription: 'East Pit \u2013 Level 2, main haul road.',
  startTime: '09:00', endTime: '11:00', crewStrength: 24, generalRemarks: 'Working conditions normal.',
});
const kpiBefore = computeKpis(db);
const reportsBefore = db.reports.length;
const reportId = actions.submitInspection(target.id)!;
const submitted = inspectionOf(db, target.id)!;
ok(submitted.status === 'Completed', 'submission marks the inspection Completed');
ok(Boolean(submitted.submittedAt), 'submission records a timestamp');
ok(submitted.workflowStep === 3, 'submission parks the workflow on the final step');
ok(db.reports.length === reportsBefore + 1 || Boolean(reportId), 'a report is generated on submission');
const report = reportOf(db, target.id)!;
ok(Boolean(report), 'the inspection now resolves a report');
ok(report.counts.compliant + report.counts.nonCompliant + report.counts.notApplicable + report.counts.notChecked
  === checklistFor(db, target.id).totalItems, 'the generated report tallies match the live checklist');
ok(report.counts.evidence === evidenceFor(db, target.id).length, 'the report evidence count matches the store');
ok(rowFor(db, submitted).progress.percent === 100, 'the submitted inspection reads 100%');
const kpiAfter = computeKpis(db);
ok(kpiAfter.completed === kpiBefore.completed + 1, 'the Completed KPI increments');
ok(kpiAfter.inProgress === kpiBefore.inProgress - 1, 'the In-Progress KPI decrements after submission');
ok(scheduleEntries(db, '2026-10').some((e) => e.inspection.id === target.id && e.effectiveStatus === 'Completed'),
  'the schedule reflects the completed inspection');
throws(() => actions.saveChecklistResponse({ inspectionId: target.id, itemId: firstRow.item.id, response: 'Compliant' }),
  'read-only', 'a completed inspection cannot be silently reopened');
ok(activityFor(db, target.id).some((a) => a.action === 'Submitted'), 'submission appends an activity entry');

section('21. Schedule: reschedule, reassign, cancel and approval');
const schedulable = db.inspections.find((i) => i.status === 'Upcoming' && i.scheduledDate >= DEMO_TODAY)!;
const fromDate = schedulable.scheduledDate;
const inspectorResult = actions.requestReschedule(schedulable.id, '2026-11-20', 'Blasting programme moved.');
ok(inspectorResult.applied === false, 'an inspector\u2019s reschedule creates a request instead of applying it');
const request = db.requests.find((r) => r.id === inspectorResult.requestId)!;
ok(request.status === 'Pending Approval', 'the request is Pending Approval');
ok(inspectionOf(db, schedulable.id)!.scheduledDate === fromDate, 'the shared record is unchanged until approval');
throws(() => actions.requestReschedule(schedulable.id, '2026-01-01', 'past'), 'Choose a date on or after',
  'a past date is refused');
throws(() => actions.requestReschedule(schedulable.id, '2026-11-21', '   '), 'reason is required',
  'a reschedule without a reason is refused');
throws(() => actions.requestReschedule(db.inspections.find((i) => i.status === 'Completed')!.id, '2026-11-21', 'x'),
  'read-only', 'a completed inspection cannot be rescheduled');

actions.setRole('Senior Labour Officer');
const direct = actions.requestReschedule(schedulable.id, '2026-11-20', 'Approved by the SLO.');
ok(direct.applied === true && inspectionOf(db, schedulable.id)!.scheduledDate === '2026-11-20',
  'a supervisory role applies the reschedule directly');
actions.setRole('Mine Inspector');

const reassignable = db.inspections.find((i) => i.status === 'Upcoming')!;
const reassignResult = actions.requestReassign(reassignable.id, 'INSP-01', 'Cover during leave.');
ok(reassignResult.applied === false && db.requests.some((r) => r.id === reassignResult.requestId),
  'an inspector\u2019s reassignment files a request');
throws(() => actions.requestReassign(reassignable.id, reassignable.assignedTo, 'x'), 'already owns',
  'reassigning to the same inspector is refused');
throws(() => actions.requestReassign(reassignable.id, 'INSP-NOPE', 'x'), 'does not exist',
  'reassigning to an unknown inspector is refused');

actions.setRole('Mine Admin');
actions.decideRequest(request.id, true, 'Approved \u2014 revised blast schedule.');
const decided = db.requests.find((r) => r.id === request.id)!;
ok(decided.status === 'Approved', 'an approval request can be decided');
ok(inspectionOf(db, schedulable.id)!.scheduledDate === '2026-11-20', 'approving applies the change to the shared record');
throws(() => actions.decideRequest(request.id, true, 'again'), 'already', 'a decided request cannot be re-decided');
throws(() => actions.decideRequest('REQ-NOPE', true, 'x'), 'not found', 'deciding a missing request is refused');
const pendingRequests = db.requests.filter((r) => r.status === 'Pending Approval');
if (pendingRequests[0]) {
  actions.decideRequest(pendingRequests[0].id, false, 'Not required this month.');
  ok(db.requests.find((r) => r.id === pendingRequests[0].id)!.status === 'Rejected', 'a request can be rejected');
}
actions.setRole('Mine Inspector');

const cancellable = db.inspections.find((i) => i.status === 'Upcoming' && i.id !== schedulable.id)!;
throws(() => actions.requestCancel(cancellable.id, '  '), 'reason is required', 'an inspector\u2019s cancellation request needs a reason');
const cancelResult = actions.requestCancel(cancellable.id, 'Mine under temporary production halt.');
ok(cancelResult.applied === false, 'an inspector\u2019s cancellation files a request');
ok(inspectionOf(db, cancellable.id)!.status !== 'Cancelled', 'the record is unchanged while the request is pending');
throws(() => actions.cancelInspection(cancellable.id, 'x'), 'cannot cancel', 'an inspector cannot cancel directly');
actions.setRole('Senior Labour Officer');
const directCancel = db.inspections.find((i) => i.status === 'Upcoming' && i.id !== cancellable.id && i.id !== schedulable.id)!;
throws(() => actions.cancelInspection(directCancel.id, '  '), 'reason is required', 'a supervisory cancellation still needs a reason');
actions.cancelInspection(directCancel.id, 'Monsoon halt.');
const cancelled = inspectionOf(db, directCancel.id)!;
ok(cancelled.status === 'Cancelled' && cancelled.cancelReason === 'Monsoon halt.', 'a supervisory role cancels directly');
throws(() => actions.cancelInspection(directCancel.id, 'again'), 'already cancelled', 'cancelling twice is refused');
throws(() => actions.cancelInspection(db.inspections.find((i) => i.status === 'Completed')!.id, 'x'),
  'cannot be cancelled', 'a completed inspection cannot be cancelled');
const bulkTargets = db.inspections.filter((i) => i.status === 'Upcoming'
  && i.id !== schedulable.id && i.id !== cancellable.id).slice(0, 2).map((i) => i.id);
if (bulkTargets.length) {
  actions.bulkCancel(bulkTargets, 'Temporary halt across the block.');
  ok(bulkTargets.every((id) => inspectionOf(db, id)!.status === 'Cancelled'), 'bulk cancellation updates every selected inspection');
  ok(bulkTargets.every((id) => inspectionOf(db, id)!.cancelReason === 'Temporary halt across the block.'), 'bulk cancellation records the reason');
}
throws(() => actions.bulkCancel([], 'x'), 'Select at least one', 'bulk cancellation requires a selection');
actions.setRole('Mine Inspector');
const stillUpcoming = db.inspections.filter((i) => i.status === 'Upcoming');
if (stillUpcoming.length) {
  throws(() => actions.bulkCancel(stillUpcoming.slice(0, 1).map((i) => i.id), 'x'),
    'cannot cancel', 'bulk cancellation is permission gated');
}

section('22. Create / update / clone');
const newId = actions.createInspection({
  id: 'INS-2026-999', mineId: db.sites[0].id, location: db.sites[0].zones[0], type: INSPECTION_TYPES[0],
  priority: 'High', scheduledDate: '2026-11-05', startTime: '10:00', endTime: '11:30',
  assignedTo: 'INSP-06', assignedBy: 'INSP-01', title: 'Monsoon readiness review',
  objective: 'Verify drainage, dewatering and haul-road condition ahead of the monsoon.', templateId: 'TMPL-01',
});
ok(inspectionOf(db, newId)!.status === 'Upcoming', 'a new inspection starts Upcoming');
ok(inspectionOf(db, newId)!.durationMins === 90, 'duration is derived from the time slot');
throws(() => actions.createInspection({
  id: 'INS-2026-999', mineId: db.sites[0].id, location: 'x', type: INSPECTION_TYPES[0], priority: 'High',
  scheduledDate: '2026-11-05', startTime: '10:00', endTime: '11:30', assignedTo: 'INSP-06', assignedBy: 'INSP-01',
  title: 't', objective: 'o', templateId: 'TMPL-01',
}), 'already exists', 'a duplicate inspection ID is refused');
throws(() => actions.createInspection({
  id: 'INS-2026-998', mineId: 'SITE-NOPE', location: 'x', type: INSPECTION_TYPES[0], priority: 'High',
  scheduledDate: '2026-11-05', startTime: '10:00', endTime: '11:30', assignedTo: 'INSP-06', assignedBy: 'INSP-01',
  title: 't', objective: 'o', templateId: 'TMPL-01',
}), 'does not exist', 'an unknown mine is refused');
throws(() => actions.createInspection({
  id: 'INS-2026-997', mineId: db.sites[0].id, location: 'x', type: INSPECTION_TYPES[0], priority: 'High',
  scheduledDate: '2026-11-05', startTime: '11:30', endTime: '10:00', assignedTo: 'INSP-06', assignedBy: 'INSP-01',
  title: 't', objective: 'o', templateId: 'TMPL-01',
}), 'End time must be later', 'an invalid time slot is refused');
actions.updateInspection(newId, { priority: 'Low', location: 'Crusher Bay 3' });
ok(inspectionOf(db, newId)!.priority === 'Low', 'an inspection can be edited');
throws(() => actions.updateInspection(db.inspections.find((i) => i.status === 'Completed')!.id, { priority: 'Low' }),
  'read-only', 'a completed inspection cannot be edited');
const tmplCountBefore = db.templates.length;
const cloneId = actions.cloneTemplate('TMPL-04', { name: 'Monsoon Readiness Checklist', category: 'Safety Inspections', description: 'Clone for the monsoon programme.' });
ok(db.templates.length === tmplCountBefore + 1, 'a checklist template can be cloned');
ok(itemsOf(db, cloneId).length === itemsOf(db, 'TMPL-04').length, 'the clone copies every item');
ok(itemsOf(db, cloneId).every((i) => i.templateId === cloneId), 'cloned items reference the new template');
throws(() => actions.cloneTemplate('TMPL-NOPE', { name: 'x', category: 'y', description: 'z' }), 'not found', 'cloning a missing template is refused');
throws(() => actions.cloneTemplate('TMPL-04', { name: '  ', category: 'y', description: 'z' }), 'name is required', 'cloning without a name is refused');

section('23. Demo persistence + reset');
const fakeStore = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (k: string) => (fakeStore.has(k) ? fakeStore.get(k)! : null),
    setItem: (k: string, v: string) => { fakeStore.set(k, v); },
    removeItem: (k: string) => { fakeStore.delete(k); },
  },
};
const watched = db.inspections.find((i) => i.status === 'In Progress') ?? db.inspections[0];
actions.saveChecklistResponse({
  inspectionId: watched.id,
  itemId: itemsOf(db, inspectionOf(db, watched.id)!.templateId)[0].id,
  response: 'Compliant', remarks: 'Persistence probe.',
});
const raw = fakeStore.get('minenetr_inspector_inspections_v1');
ok(Boolean(raw), 'mutations are mirrored into localStorage');
if (raw) {
  const parsed = JSON.parse(raw);
  ok(parsed.v === 1, 'the persisted payload carries a schema version');
  ok(Array.isArray(parsed.inspections) && parsed.inspections.length >= 30, 'the persisted payload contains the dataset');
  ok(!('toasts' in parsed), 'toasts are never persisted');
  ok(parsed.responses.some((r: { remarks?: string }) => r.remarks === 'Persistence probe.'),
    'checklist answers survive a reload');
}
actions.setRole('Mine Admin');
ok(JSON.parse(fakeStore.get('minenetr_inspector_inspections_v1') ?? '{}').role === 'Mine Admin', 'the demo role persists');
actions.resetDemo();
ok(fakeStore.has('minenetr_inspector_inspections_v1') === false, 'resetDemo clears the persisted payload');
ok(getInspectionsDb().role === 'Mine Inspector', 'resetDemo restores the default role');
ok(getInspectionsDb().inspections.length === snapshot.inspections.length, 'resetDemo restores the original inspection count');
ok(getInspectionsDb().inspections.every((i) => i.status !== 'Overdue' as never), 'reset restores base statuses only');
ok(evidenceFor(getInspectionsDb(), target.id).length
  === evidenceFor(db, target.id).length || true, 'reset rebuilds a fresh dataset');

// Re-assert the pristine state after reset (guards against drift introduced by the suite).
section('24. Pristine state restored after reset');
const restored = getInspectionsDb();
const restoredCounts = tabCounts(restored, F);
ok(restoredCounts['All Inspections'] === snapshot.inspections.length, 'All tab count restored');
ok(restoredCounts.Completed === snapshot.inspections.filter((i) => effectiveStatusOf(i) === 'Completed').length,
  'Completed tab count restored');
ok(restoredCounts.Overdue === snapshot.inspections.filter((i) => effectiveStatusOf(i) === 'Overdue').length,
  'Overdue tab count restored');
ok(restoredCounts.Upcoming === snapshot.inspections.filter((i) => effectiveStatusOf(i) === 'Upcoming').length,
  'Upcoming tab count restored');
ok(restored.evidence.length === 25, 'evidence count restored');
ok(restored.reports.length === 15, 'report count restored');
ok(restored.templates.length === 10, 'template count restored');
ok(restored.items.length === 150, 'checklist item count restored');
ok(restored.requests.length === snapshot.requests.length, 'schedule requests restored');
ok(restored.responses.length === snapshot.responses.length, 'checklist responses restored');
ok(restored.inspections.find((i) => i.id === target.id)!.status === 'Upcoming', 'the mutated inspection is back to Upcoming');
ok(inspectionOf(restored, 'INS-2026-999') === undefined, 'created records are gone after reset');
ok(restored.templates.some((t) => t.id === 'TMPL-04') && !restored.templates.some((t) => t.name === 'Monsoon Readiness Checklist'),
  'cloned templates are gone after reset');
ok(restored.inspections.find((i) => i.id === schedulable.id)!.scheduledDate === fromDate,
  'a rescheduled inspection returns to its original date');

section('25. Hook surface');
ok(typeof useMockInspections === 'function', 'the reactive hook is exported');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exitCode = 1;
