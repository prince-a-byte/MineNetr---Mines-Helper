/**
 * HTTP adapter boundary for the Operations portal (Phase 12 — API readiness).
 *
 * - `NEXT_PUBLIC_OPS_DATA_MODE=mock` (default) → centralized repository in
 *   lib/ops/store.ts (visible DEMO labelling).
 * - `NEXT_PUBLIC_OPS_DATA_MODE=http` → the typed HTTP adapters below.
 *   HTTP mode NEVER falls back to mock data after a failure: errors surface
 *   to the page with a retry action.
 *
 * Endpoint contract status:
 *   CONFIRMED = exists in backend/app/main.py today (auth + role overview).
 *   TODO      = proposed mapping; MUST be confirmed with the FastAPI backend
 *               before http mode is enabled. Do not treat as a contract.
 */
import { apiUrl, getToken } from '../api';

export type OpsDataMode = 'mock' | 'http';

export const OPS_DATA_MODE: OpsDataMode =
  process.env.NEXT_PUBLIC_OPS_DATA_MODE === 'http' ? 'http' : 'mock';

/** Central endpoint map — the ONLY place ops URLs are declared. */
export const OPS_ENDPOINTS = {
  // ---- CONFIRMED (present in backend today) ----
  login: { path: '/auth/login', method: 'POST', confirmed: true },
  notifications: { path: '/notifications', method: 'GET', confirmed: true },
  roleOverview: { path: '/role/overview', method: 'GET', confirmed: true },

  // ---- TODO: proposed operations endpoints (unconfirmed) ----
  mines: { path: '/ops/mines', method: 'GET', confirmed: false },
  workers: { path: '/ops/workers', method: 'GET', confirmed: false },
  createWorker: { path: '/ops/workers', method: 'POST', confirmed: false },
  updateWorker: { path: '/ops/workers/{id}', method: 'PATCH', confirmed: false },
  contractors: { path: '/ops/contractors', method: 'GET', confirmed: false },
  createContractor: { path: '/ops/contractors', method: 'POST', confirmed: false },
  attendance: { path: '/ops/attendance', method: 'GET', confirmed: false },
  checkIn: { path: '/ops/attendance/check-in', method: 'POST', confirmed: false },
  checkOut: { path: '/ops/attendance/check-out', method: 'POST', confirmed: false },
  accessRecords: { path: '/ops/access', method: 'GET', confirmed: false },
  grantAccess: { path: '/ops/access/{workerId}/grant', method: 'POST', confirmed: false },
  revokeAccess: { path: '/ops/access/{workerId}/revoke', method: 'POST', confirmed: false },
  production: { path: '/ops/production', method: 'GET', confirmed: false },
  createProduction: { path: '/ops/production', method: 'POST', confirmed: false },
  dispatches: { path: '/ops/dispatches', method: 'GET', confirmed: false },
  createDispatch: { path: '/ops/dispatches', method: 'POST', confirmed: false },
  weighbridge: { path: '/ops/weighbridge', method: 'GET', confirmed: false },
  stockpiles: { path: '/ops/stockpiles', method: 'GET', confirmed: false },
  createStockpile: { path: '/ops/stockpiles', method: 'POST', confirmed: false },
  stockTx: { path: '/ops/stockpiles/transactions', method: 'GET', confirmed: false },
  transferStock: { path: '/ops/stockpiles/transfer', method: 'POST', confirmed: false },
  reconcileStock: { path: '/ops/stockpiles/reconcile', method: 'POST', confirmed: false },
  bills: { path: '/ops/bills', method: 'GET', confirmed: false },
  createBill: { path: '/ops/bills', method: 'POST', confirmed: false },
  approveBill: { path: '/ops/bills/{id}/approve', method: 'POST', confirmed: false },
  rejectBill: { path: '/ops/bills/{id}/reject', method: 'POST', confirmed: false },
  recordPayment: { path: '/ops/payments', method: 'POST', confirmed: false },
  documents: { path: '/ops/documents', method: 'GET', confirmed: false },
  uploadDocument: { path: '/ops/documents', method: 'POST', confirmed: false },
  documentAction: { path: '/ops/documents/{id}/{action}', method: 'POST', confirmed: false },
  reports: { path: '/ops/reports', method: 'GET', confirmed: false },
  generateReport: { path: '/ops/reports/generate', method: 'POST', confirmed: false },
  inspections: { path: '/ops/inspections', method: 'GET', confirmed: false },
  createInspection: { path: '/ops/inspections', method: 'POST', confirmed: false },
  completeInspection: { path: '/ops/inspections/{id}/complete', method: 'POST', confirmed: false },
  findings: { path: '/ops/findings', method: 'GET', confirmed: false },
  correctiveActions: { path: '/ops/corrective-actions', method: 'GET', confirmed: false },
  settings: { path: '/ops/settings', method: 'GET', confirmed: false },
  saveSettings: { path: '/ops/settings', method: 'PUT', confirmed: false },
  audit: { path: '/ops/audit', method: 'GET', confirmed: false },
} as const;

export type OpsEndpointKey = keyof typeof OPS_ENDPOINTS;

export class OpsHttpError extends Error {
  constructor(message: string, readonly status: number, readonly endpoint: string) {
    super(message);
    this.name = 'OpsHttpError';
  }
}

/** Build a URL from the central map, substituting path params. */
export function opsUrl(key: OpsEndpointKey, params?: Record<string, string | number>): string {
  let path: string = OPS_ENDPOINTS[key].path;
  if (params) for (const [k, v] of Object.entries(params)) path = path.replace(`{${k}}`, String(v));
  return apiUrl(path);
}

/**
 * Authenticated JSON request against the API base.
 * Throws OpsHttpError on any failure — callers surface it (no mock fallback).
 */
export async function opsFetch<T>(key: OpsEndpointKey, opts: {
  params?: Record<string, string | number>;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  signal?: AbortSignal;
} = {}): Promise<T> {
  const endpoint = OPS_ENDPOINTS[key];
  if (!endpoint.confirmed) {
    // Guard: never guess contracts. Surface exactly what is missing.
    throw new OpsHttpError(
      `TODO: endpoint ${endpoint.method} ${endpoint.path} is not yet confirmed with the backend. ` +
      `Set NEXT_PUBLIC_OPS_DATA_MODE=mock until the contract exists.`,
      0, endpoint.path,
    );
  }
  let url = opsUrl(key, opts.params);
  if (opts.query) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(opts.query)) if (v !== undefined && v !== '') qs.set(k, String(v));
    const s = qs.toString();
    if (s) url += `?${s}`;
  }
  const token = getToken();
  const res = await fetch(url, {
    method: endpoint.method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new OpsHttpError((data as { detail?: string }).detail || `Request failed (${res.status})`, res.status, endpoint.path);
  }
  return data as T;
}

/** Multipart upload support (document upload path once backend confirms it). */
export async function opsUpload<T>(key: OpsEndpointKey, form: FormData, params?: Record<string, string>): Promise<T> {
  const endpoint = OPS_ENDPOINTS[key];
  if (!endpoint.confirmed) {
    throw new OpsHttpError(`TODO: upload endpoint ${endpoint.path} is not confirmed with the backend.`, 0, endpoint.path);
  }
  const token = getToken();
  const res = await fetch(opsUrl(key, params), {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new OpsHttpError((data as { detail?: string }).detail || 'Upload failed', res.status, endpoint.path);
  return data as T;
}
