/**
 * HTTP adapter boundary for the Mine Inspector "My Inspections" module.
 *
 * - `NEXT_PUBLIC_INSPECTIONS_DATA_MODE=mock` (default) → the centralized
 *   repository in lib/inspections/store.ts (visible DEMO labelling).
 * - `NEXT_PUBLIC_INSPECTIONS_DATA_MODE=http` → the typed HTTP adapter below.
 *   HTTP mode NEVER falls back to mock data after a failure: errors surface to
 *   the page with a retry action.
 *
 * Endpoint contract status:
 *   CONFIRMED = only the platform routes that exist on the FastAPI backend
 *               today (auth, notifications, role overview).
 *   TODO      = every inspector route below is PROPOSED (`confirmed: false`)
 *               and MUST be agreed with the backend before http mode is
 *               enabled. Do not treat any of these as a contract.
 *
 * See docs/inspector-inspections-api.md for the proposed request/response map.
 */
import { apiUrl, getToken } from '../api';

export type InspectionsDataMode = 'mock' | 'http';

export const INSPECTIONS_DATA_MODE: InspectionsDataMode =
  process.env.NEXT_PUBLIC_INSPECTIONS_DATA_MODE === 'http' ? 'http' : 'mock';

/** Central endpoint map — the ONLY place inspector URLs are declared. */
export const INSPECTIONS_ENDPOINTS = {
  // ---- CONFIRMED (present in the backend today) ----
  login: { path: '/auth/login', method: 'POST', confirmed: true },
  notifications: { path: '/notifications', method: 'GET', confirmed: true },
  roleOverview: { path: '/role/overview', method: 'GET', confirmed: true },

  // ---- TODO: proposed inspector endpoints (unconfirmed) ----
  inspector: { path: '/inspector/me', method: 'GET', confirmed: false },
  inspectorMines: { path: '/inspector/mines', method: 'GET', confirmed: false },

  inspections: { path: '/inspector/inspections', method: 'GET', confirmed: false },
  inspectionById: { path: '/inspector/inspections/{id}', method: 'GET', confirmed: false },
  createInspection: { path: '/inspector/inspections', method: 'POST', confirmed: false },
  updateInspection: { path: '/inspector/inspections/{id}', method: 'PATCH', confirmed: false },
  startInspection: { path: '/inspector/inspections/{id}/start', method: 'POST', confirmed: false },
  saveDraft: { path: '/inspector/inspections/{id}/draft', method: 'POST', confirmed: false },
  submitInspection: { path: '/inspector/inspections/{id}/submit', method: 'POST', confirmed: false },
  cancelInspection: { path: '/inspector/inspections/{id}/cancel', method: 'POST', confirmed: false },
  reschedule: { path: '/inspector/inspections/{id}/reschedule', method: 'POST', confirmed: false },
  reassign: { path: '/inspector/inspections/{id}/reassign', method: 'POST', confirmed: false },
  bulkCancel: { path: '/inspector/inspections/bulk-cancel', method: 'POST', confirmed: false },
  workflowStep: { path: '/inspector/inspections/{id}/workflow', method: 'PATCH', confirmed: false },

  checklist: { path: '/inspector/inspections/{id}/checklist', method: 'GET', confirmed: false },
  checklistResponse: { path: '/inspector/inspections/{id}/checklist/{itemId}', method: 'PUT', confirmed: false },
  siteDetails: { path: '/inspector/inspections/{id}/site-details', method: 'PUT', confirmed: false },

  evidence: { path: '/inspector/inspections/{id}/evidence', method: 'GET', confirmed: false },
  addEvidence: { path: '/inspector/inspections/{id}/evidence', method: 'POST', confirmed: false },
  updateEvidence: { path: '/inspector/evidence/{evidenceId}', method: 'PATCH', confirmed: false },
  removeEvidence: { path: '/inspector/evidence/{evidenceId}', method: 'DELETE', confirmed: false },
  linkEvidence: { path: '/inspector/evidence/{evidenceId}/link', method: 'POST', confirmed: false },

  findings: { path: '/inspector/inspections/{id}/findings', method: 'GET', confirmed: false },
  allFindings: { path: '/inspector/findings', method: 'GET', confirmed: false },
  createFinding: { path: '/inspector/inspections/{id}/findings', method: 'POST', confirmed: false },
  updateFinding: { path: '/inspector/findings/{findingId}/status', method: 'PATCH', confirmed: false },

  reports: { path: '/inspector/reports', method: 'GET', confirmed: false },
  reportById: { path: '/inspector/reports/{id}', method: 'GET', confirmed: false },
  previousReports: { path: '/inspector/inspections/{id}/previous-reports', method: 'GET', confirmed: false },
  reportDownload: { path: '/inspector/reports/{id}/download', method: 'GET', confirmed: false },

  notes: { path: '/inspector/inspections/{id}/notes', method: 'GET', confirmed: false },
  addNote: { path: '/inspector/inspections/{id}/notes', method: 'POST', confirmed: false },
  updateNote: { path: '/inspector/notes/{noteId}', method: 'PATCH', confirmed: false },
  deleteNote: { path: '/inspector/notes/{noteId}', method: 'DELETE', confirmed: false },

  documents: { path: '/inspector/inspections/{id}/documents', method: 'GET', confirmed: false },
  attachDocument: { path: '/inspector/inspections/{id}/documents', method: 'POST', confirmed: false },
  documentDownload: { path: '/inspector/documents/{docId}/download', method: 'GET', confirmed: false },

  checklistTemplates: { path: '/inspector/checklist-templates', method: 'GET', confirmed: false },
  templatePreview: { path: '/inspector/checklist-templates/{id}', method: 'GET', confirmed: false },

  schedule: { path: '/inspector/schedule', method: 'GET', confirmed: false },
  requests: { path: '/inspector/requests', method: 'GET', confirmed: false },
  decideRequest: { path: '/inspector/requests/{requestId}/decision', method: 'POST', confirmed: false },

  evidenceLibrary: { path: '/inspector/evidence', method: 'GET', confirmed: false },
} as const;

export type InspectionsEndpointKey = keyof typeof INSPECTIONS_ENDPOINTS;

/** Typed failure — pages render `.message` with a retry affordance. */
export class InspectionsHttpError extends Error {
  status: number;
  endpoint: InspectionsEndpointKey;
  constructor(message: string, status: number, endpoint: InspectionsEndpointKey) {
    super(message);
    this.name = 'InspectionsHttpError';
    this.status = status;
    this.endpoint = endpoint;
  }
}

function buildPath(path: string, params?: Record<string, string>): string {
  let out = path;
  if (params) {
    for (const [k, v] of Object.entries(params)) out = out.replace(`{${k}}`, encodeURIComponent(v));
  }
  return out;
}

/**
 * Fetch wrapper for inspector endpoints. Unconfirmed endpoints are refused
 * before any network call so a half-built backend can never be mistaken for a
 * working contract.
 */
export async function inspectionsFetch<T>(
  endpoint: InspectionsEndpointKey,
  opts: { pathParams?: Record<string, string>; query?: Record<string, string | number | undefined>; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const def = INSPECTIONS_ENDPOINTS[endpoint];
  if (!def.confirmed) {
    throw new InspectionsHttpError(
      `TODO endpoint "${endpoint}" (${def.method} ${def.path}) is still PROPOSED and unconfirmed. ` +
      'Agree it with the backend and set `confirmed: true` before enabling http mode.',
      0, endpoint,
    );
  }
  const path = buildPath(def.path, opts.pathParams);
  const qs = opts.query
    ? Object.entries(opts.query).filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&')
    : '';
  const token = typeof window !== 'undefined' ? getToken() : null;

  let res: Response;
  try {
    res = await fetch(apiUrl(qs ? `${path}?${qs}` : path), {
      method: def.method,
      signal: opts.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
  } catch {
    throw new InspectionsHttpError('Could not reach the MineNetr API. Check your connection and retry.', 0, endpoint);
  }

  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const payload = await res.json();
      if (payload?.detail) detail = String(payload.detail);
    } catch { /* keep status text */ }
    throw new InspectionsHttpError(detail, res.status, endpoint);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
