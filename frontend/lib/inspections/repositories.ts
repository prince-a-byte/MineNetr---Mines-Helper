/**
 * Typed repository contracts for the Mine Inspector "My Inspections" module.
 *
 * Pages and hooks consume this interface — never raw fetch or store internals —
 * so switching mock ↔ HTTP requires no page rewrites.
 *   - mockInspectionRepository: delegates to the centralized store (demo mode).
 *   - httpInspectionRepository: typed adapter in api.ts; every inspector
 *     endpoint is PROPOSED and unconfirmed, so it throws a named TODO error
 *     instead of silently pretending the backend exists.
 *
 * Today the interactive pages read reactively via useMockInspections() (one
 * store subscription) and mutate via `actions`, which implement exactly the
 * semantics below. The async surface exists so HTTP mode drops in cleanly.
 */
import { INSPECTIONS_DATA_MODE, InspectionsHttpError, inspectionsFetch, type InspectionsEndpointKey } from './api';
import {
  actions, checklistFor, evidenceFor, filterInspections, findingsFor,
  getInspectionsDb, inspectionOf, notesFor, previousReportsFor, reportOf,
} from './store';
import type {
  ChecklistResponse, CreateEvidenceInput, CreateFindingInput, CreateInspectionInput,
  Evidence, Inspection, InspectionDraft, InspectionFinding, InspectionFilters,
  InspectionReport, SaveChecklistInput, UpdateInspectionInput,
} from './types';
import { DEFAULT_FILTERS } from './types';

export interface InspectionRepository {
  getInspections(filters?: Partial<InspectionFilters>): Promise<Inspection[]>;
  getInspectionById(id: string): Promise<Inspection | null>;

  createInspection(input: CreateInspectionInput): Promise<Inspection>;
  updateInspection(id: string, input: UpdateInspectionInput): Promise<Inspection>;

  startInspection(id: string): Promise<Inspection>;
  saveInspectionDraft(id: string, draft: InspectionDraft): Promise<Inspection>;
  submitInspection(id: string): Promise<Inspection>;

  getChecklistResponses(id: string): Promise<ChecklistResponse[]>;
  saveChecklistResponse(input: SaveChecklistInput): Promise<ChecklistResponse>;

  addEvidence(input: CreateEvidenceInput): Promise<Evidence>;
  removeEvidence(id: string): Promise<void>;

  getFindings(id: string): Promise<InspectionFinding[]>;
  createFinding(input: CreateFindingInput): Promise<InspectionFinding>;

  getReports(id: string): Promise<InspectionReport[]>;
}

function findResponse(id: string, itemId: string): ChecklistResponse {
  const db = getInspectionsDb();
  const hit = db.responses.find((r) => r.inspectionId === id && r.itemId === itemId);
  if (!hit) throw new Error('Checklist response was not saved.');
  return hit;
}

function mustInspect(id: string): Inspection {
  const i = inspectionOf(getInspectionsDb(), id);
  if (!i) throw new Error('Inspection not found.');
  return i;
}

/** Demo mode — every method maps 1:1 onto a store action/selector. */
export const mockInspectionRepository: InspectionRepository = {
  async getInspections(filters = {}) {
    const db = getInspectionsDb();
    const merged = { ...DEFAULT_FILTERS, ...filters, pageSize: filters.pageSize ?? Number.MAX_SAFE_INTEGER, page: 1 };
    return filterInspections(db, merged).rows.map((r) => r.inspection);
  },

  async getInspectionById(id) {
    return inspectionOf(getInspectionsDb(), id) ?? null;
  },

  async createInspection(input) {
    actions.createInspection(input);
    return mustInspect(input.id);
  },

  async updateInspection(id, input) {
    actions.updateInspection(id, input);
    return mustInspect(id);
  },

  async startInspection(id) {
    actions.startInspection(id);
    return mustInspect(id);
  },

  async saveInspectionDraft(id, draft) {
    if (draft.workflowStep !== undefined) actions.setWorkflowStep(id, draft.workflowStep);
    if (draft.siteDetails && Object.keys(draft.siteDetails).length > 0) actions.updateSiteDetails(id, draft.siteDetails);
    if (draft.notes && draft.notes.trim()) actions.addNote(id, draft.notes, true);
    actions.saveDraft(id);
    return mustInspect(id);
  },

  async submitInspection(id) {
    actions.submitInspection(id);
    return mustInspect(id);
  },

  async getChecklistResponses(id) {
    return getInspectionsDb().responses.filter((r) => r.inspectionId === id);
  },

  async saveChecklistResponse(input) {
    actions.saveChecklistResponse(input);
    return findResponse(input.inspectionId, input.itemId);
  },

  async addEvidence(input) {
    const id = actions.addEvidence(input);
    const hit = getInspectionsDb().evidence.find((e) => e.id === id);
    if (!hit) throw new Error('Evidence was not saved.');
    return hit;
  },

  async removeEvidence(id) {
    actions.removeEvidence(id);
  },

  async getFindings(id) {
    return findingsFor(getInspectionsDb(), id);
  },

  async createFinding(input) {
    const id = actions.createFinding(input);
    const hit = getInspectionsDb().findings.find((f) => f.id === id);
    if (!hit) throw new Error('Finding was not saved.');
    return hit;
  },

  async getReports(id) {
    const db = getInspectionsDb();
    const own = reportOf(db, id);
    return own ? [own] : previousReportsFor(db, id);
  },
};

/**
 * Future FastAPI adapter. Every inspector endpoint is currently
 * `confirmed: false`, so each call throws a descriptive TODO error rather than
 * inventing a backend contract. Once the routes exist, only this object and the
 * endpoint map in api.ts need updating — no page changes.
 */
export const httpInspectionRepository: InspectionRepository = {
  async getInspections(filters = {}) {
    return inspectionsFetch<Inspection[]>('inspections', {
      query: {
        q: filters.q, tab: filters.tab, mine_id: filters.mineId, type: filters.type,
        priority: filters.priority, status: filters.status, date_from: filters.dateFrom,
        date_to: filters.dateTo, sort: filters.sort, dir: filters.dir, page: filters.page, size: filters.pageSize,
      },
    });
  },
  getInspectionById: (id) => inspectionsFetch<Inspection | null>('inspectionById', { pathParams: { id } }),
  createInspection: (input) => inspectionsFetch<Inspection>('createInspection', { body: input }),
  updateInspection: (id, input) => inspectionsFetch<Inspection>('updateInspection', { pathParams: { id }, body: input }),
  startInspection: (id) => inspectionsFetch<Inspection>('startInspection', { pathParams: { id }, body: {} }),
  saveInspectionDraft: (id, draft) => inspectionsFetch<Inspection>('saveDraft', { pathParams: { id }, body: draft }),
  submitInspection: (id) => inspectionsFetch<Inspection>('submitInspection', { pathParams: { id }, body: {} }),
  getChecklistResponses: (id) => inspectionsFetch<ChecklistResponse[]>('checklist', { pathParams: { id } }),
  saveChecklistResponse: (input) => inspectionsFetch<ChecklistResponse>('checklistResponse',
    { pathParams: { id: input.inspectionId, itemId: input.itemId }, body: input }),
  addEvidence: (input) => inspectionsFetch<Evidence>('addEvidence', { pathParams: { id: input.inspectionId }, body: input }),
  removeEvidence: (id) => inspectionsFetch<void>('removeEvidence', { pathParams: { evidenceId: id } }),
  getFindings: (id) => inspectionsFetch<InspectionFinding[]>('findings', { pathParams: { id } }),
  createFinding: (input) => inspectionsFetch<InspectionFinding>('createFinding', { pathParams: { id: input.inspectionId }, body: input }),
  getReports: (id) => inspectionsFetch<InspectionReport[]>('previousReports', { pathParams: { id } }),
};

/** Active repository — mock by default, http only when explicitly enabled. */
export const inspectionRepository: InspectionRepository =
  INSPECTIONS_DATA_MODE === 'http' ? httpInspectionRepository : mockInspectionRepository;

export { INSPECTIONS_DATA_MODE, InspectionsHttpError, inspectionsFetch };
export type { InspectionsEndpointKey };

/** Convenience read helpers used by the dashboard/report widgets. */
export const inspectionReaders = {
  checklist: (id: string) => checklistFor(getInspectionsDb(), id),
  evidence: (id: string) => evidenceFor(getInspectionsDb(), id),
  findings: (id: string) => findingsFor(getInspectionsDb(), id),
  notes: (id: string) => notesFor(getInspectionsDb(), id),
  report: (id: string) => reportOf(getInspectionsDb(), id),
};
