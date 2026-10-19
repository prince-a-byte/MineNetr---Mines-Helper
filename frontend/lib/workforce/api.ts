/**
 * HTTP adapter boundary for the contractor workforce portal.
 *
 * - `NEXT_PUBLIC_WORKFORCE_DATA_MODE=mock` (default) → centralized repository
 *   in lib/workforce/store.ts (visible DEMO labelling).
 * - `NEXT_PUBLIC_WORKFORCE_DATA_MODE=http` → the typed HTTP adapters below.
 *   HTTP mode NEVER falls back to mock data after a failure: errors surface to
 *   the page with a retry action.
 *
 * Endpoint contract status:
 *   CONFIRMED = only the platform routes that exist on the FastAPI backend
 *               today (auth, notifications, role overview).
 *   TODO      = every contractor workforce route below is PROPOSED
 *               (`confirmed: false`) and MUST be agreed with the backend
 *               before http mode is enabled. Do not treat as a contract.
 *
 * See docs/contractor-workforce-api.md for the full proposed contract.
 */
import { apiUrl, getToken } from '../api';

export type WorkforceDataMode = 'mock' | 'http';

export const WORKFORCE_DATA_MODE: WorkforceDataMode =
  process.env.NEXT_PUBLIC_WORKFORCE_DATA_MODE === 'http' ? 'http' : 'mock';

/** Central endpoint map — the ONLY place workforce URLs are declared. */
export const WORKFORCE_ENDPOINTS = {
  // ---- CONFIRMED (present in the backend today) ----
  login: { path: '/auth/login', method: 'POST', confirmed: true },
  notifications: { path: '/notifications', method: 'GET', confirmed: true },
  roleOverview: { path: '/role/overview', method: 'GET', confirmed: true },

  // ---- TODO: proposed contractor workforce endpoints (unconfirmed) ----
  mines: { path: '/contractor/mines', method: 'GET', confirmed: false },
  contractors: { path: '/contractor/contractors', method: 'GET', confirmed: false },
  contractorById: { path: '/contractor/contractors/{id}', method: 'GET', confirmed: false },
  createContractor: { path: '/contractor/contractors', method: 'POST', confirmed: false },
  updateContractor: { path: '/contractor/contractors/{id}', method: 'PATCH', confirmed: false },
  setContractorStatus: { path: '/contractor/contractors/{id}/status', method: 'PATCH', confirmed: false },

  workers: { path: '/contractor/workers', method: 'GET', confirmed: false },
  workerById: { path: '/contractor/workers/{id}', method: 'GET', confirmed: false },
  createWorker: { path: '/contractor/workers', method: 'POST', confirmed: false },
  updateWorker: { path: '/contractor/workers/{id}', method: 'PATCH', confirmed: false },
  setWorkerStatus: { path: '/contractor/workers/{id}/status', method: 'PATCH', confirmed: false },
  deployWorker: { path: '/contractor/workers/{id}/deployment', method: 'PATCH', confirmed: false },

  training: { path: '/contractor/training', method: 'GET', confirmed: false },
  createTraining: { path: '/contractor/training', method: 'POST', confirmed: false },
  updateTraining: { path: '/contractor/training/{id}', method: 'PATCH', confirmed: false },
  verifyTraining: { path: '/contractor/training/{id}/verify', method: 'POST', confirmed: false },
  renewTraining: { path: '/contractor/training/{id}/renew', method: 'POST', confirmed: false },

  attendance: { path: '/contractor/attendance', method: 'GET', confirmed: false },
  attendanceTrend: { path: '/contractor/attendance/trend', method: 'GET', confirmed: false },
  markAttendance: { path: '/contractor/attendance/{workerId}', method: 'PATCH', confirmed: false },
  accessLogs: { path: '/contractor/access', method: 'GET', confirmed: false },
  decideAccess: { path: '/contractor/access/{id}/decision', method: 'POST', confirmed: false },
  leaves: { path: '/contractor/leaves', method: 'GET', confirmed: false },
  decideLeave: { path: '/contractor/leaves/{id}/decision', method: 'POST', confirmed: false },
  gatePasses: { path: '/contractor/gate-passes', method: 'GET', confirmed: false },
  issueGatePass: { path: '/contractor/gate-passes', method: 'POST', confirmed: false },
  setGatePassStatus: { path: '/contractor/gate-passes/{id}/status', method: 'PATCH', confirmed: false },

  bills: { path: '/contractor/bills', method: 'GET', confirmed: false },
  submitBill: { path: '/contractor/bills', method: 'POST', confirmed: false },
  withdrawBill: { path: '/contractor/bills/{id}/withdraw', method: 'POST', confirmed: false },
  acknowledgeBill: { path: '/contractor/bills/{id}/acknowledge', method: 'POST', confirmed: false },
  payments: { path: '/contractor/payments', method: 'GET', confirmed: false },

  documents: { path: '/contractor/documents', method: 'GET', confirmed: false },
  uploadDocument: { path: '/contractor/documents', method: 'POST', confirmed: false },
  downloadDocument: { path: '/contractor/documents/{id}/download', method: 'GET', confirmed: false },

  transfers: { path: '/contractor/transfers', method: 'GET', confirmed: false },
  createTransfer: { path: '/contractor/transfers', method: 'POST', confirmed: false },
  decideTransfer: { path: '/contractor/transfers/{id}/decision', method: 'POST', confirmed: false },

  incidents: { path: '/contractor/incidents', method: 'GET', confirmed: false },
  createIncident: { path: '/contractor/incidents', method: 'POST', confirmed: false },
  commentIncident: { path: '/contractor/incidents/{id}/comments', method: 'POST', confirmed: false },
  setIncidentStatus: { path: '/contractor/incidents/{id}/status', method: 'PATCH', confirmed: false },
  assignInspector: { path: '/contractor/incidents/{id}/assign', method: 'POST', confirmed: false },
  correctiveActions: { path: '/contractor/corrective-actions', method: 'GET', confirmed: false },
  createCorrectiveAction: { path: '/contractor/corrective-actions', method: 'POST', confirmed: false },
  updateCorrectiveAction: { path: '/contractor/corrective-actions/{id}', method: 'PATCH', confirmed: false },
  reviewCorrectiveAction: { path: '/contractor/corrective-actions/{id}/review', method: 'POST', confirmed: false },

  reports: { path: '/contractor/reports', method: 'GET', confirmed: false },
  generateReport: { path: '/contractor/reports/generate', method: 'POST', confirmed: false },
  downloadReport: { path: '/contractor/reports/{id}/download', method: 'GET', confirmed: false },
  portalNotifications: { path: '/contractor/notifications', method: 'GET', confirmed: false },
  markNotificationsRead: { path: '/contractor/notifications/read-all', method: 'POST', confirmed: false },
  kpis: { path: '/contractor/kpis', method: 'GET', confirmed: false },
} as const;

export type WorkforceEndpointKey = keyof typeof WORKFORCE_ENDPOINTS;

export class WorkforceHttpError extends Error {
  constructor(message: string, readonly status: number, readonly endpoint: string) {
    super(message);
    this.name = 'WorkforceHttpError';
  }
}

/** Build a URL from the central map, substituting path params. */
export function workforceUrl(key: WorkforceEndpointKey, params?: Record<string, string | number>): string {
  let path: string = WORKFORCE_ENDPOINTS[key].path;
  if (params) for (const [k, v] of Object.entries(params)) path = path.replace(`{${k}}`, String(v));
  return apiUrl(path);
}

/**
 * Authenticated JSON request against the API base.
 * Throws WorkforceHttpError on any failure — callers surface it (no mock fallback).
 */
export async function workforceFetch<T>(key: WorkforceEndpointKey, opts: {
  params?: Record<string, string | number>;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  signal?: AbortSignal;
} = {}): Promise<T> {
  const endpoint = WORKFORCE_ENDPOINTS[key];
  if (!endpoint.confirmed) {
    // Guard: never guess an endpoint. Surface exactly what is missing.
    throw new WorkforceHttpError(
      `TODO: endpoint ${endpoint.method} ${endpoint.path} is not yet confirmed with the backend. ` +
      `Set NEXT_PUBLIC_WORKFORCE_DATA_MODE=mock until the contract exists.`,
      0, endpoint.path,
    );
  }
  let url = workforceUrl(key, opts.params);
  if (opts.query) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(opts.query)) if (v !== undefined && v !== '') qs.set(k, String(v));
    const s = qs.toString();
    if (s) url += `?${s}`;
  }
  const token = getToken();
  const res = await fetch(url, {
    method: endpoint.method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new WorkforceHttpError(
      (data as { detail?: string }).detail || `Request failed (${res.status})`,
      res.status, endpoint.path,
    );
  }
  return data as T;
}

/** Multipart upload support (document upload path once the backend confirms it). */
export async function workforceUpload<T>(key: WorkforceEndpointKey, form: FormData, params?: Record<string, string>): Promise<T> {
  const endpoint = WORKFORCE_ENDPOINTS[key];
  if (!endpoint.confirmed) {
    throw new WorkforceHttpError(`TODO: upload endpoint ${endpoint.path} is not confirmed with the backend.`, 0, endpoint.path);
  }
  const token = getToken();
  const res = await fetch(workforceUrl(key, params), {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new WorkforceHttpError((data as { detail?: string }).detail || 'Upload failed', res.status, endpoint.path);
  return data as T;
}
