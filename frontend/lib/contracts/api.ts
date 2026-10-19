/**
 * HTTP adapter boundary for the contractor "My Contracts" portal.
 *
 * - `NEXT_PUBLIC_CONTRACTS_DATA_MODE=mock` (default) → centralized repository
 *   in lib/contracts/store.ts (visible DEMO labelling).
 * - `NEXT_PUBLIC_CONTRACTS_DATA_MODE=http` → the typed HTTP adapters below.
 *   HTTP mode NEVER falls back to mock data after a failure: errors surface to
 *   the page with a retry action.
 *
 * Endpoint contract status:
 *   CONFIRMED = the backend /api/v1 endpoints that exist today are only auth,
 *               notifications and role overview. Every contractor/contract
 *               route below is PROPOSED and marked `confirmed: false`.
 *   TODO      = proposed mapping; MUST be confirmed with the FastAPI backend
 *               before http mode is enabled. Do not treat as a contract.
 *
 * See docs/contractor-contracts-api.md for the full proposed contract.
 */
import { apiUrl, getToken } from '../api';

export type ContractsDataMode = 'mock' | 'http';

export const CONTRACTS_DATA_MODE: ContractsDataMode =
  process.env.NEXT_PUBLIC_CONTRACTS_DATA_MODE === 'http' ? 'http' : 'mock';

/**
 * Central endpoint map — the ONLY place contractor-contract URLs are declared.
 * Every entry is currently PROPOSED (confirmed:false). The three entries at the
 * top are the shared platform routes that already exist on the backend.
 */
export const CONTRACTS_ENDPOINTS = {
  // ---- CONFIRMED (present in backend/app/main.py today) ----
  login: { path: '/auth/login', method: 'POST', confirmed: true },
  notifications: { path: '/notifications', method: 'GET', confirmed: true },
  roleOverview: { path: '/role/overview', method: 'GET', confirmed: true },

  // ---- TODO: proposed contractor-contract endpoints (unconfirmed) ----
  mines: { path: '/contractor/mines', method: 'GET', confirmed: false },
  profile: { path: '/contractor/profile', method: 'GET', confirmed: false },
  contracts: { path: '/contractor/contracts', method: 'GET', confirmed: false },
  contractById: { path: '/contractor/contracts/{id}', method: 'GET', confirmed: false },
  contractValueSummary: { path: '/contractor/contracts/value-summary', method: 'GET', confirmed: false },
  milestones: { path: '/contractor/contracts/{id}/milestones', method: 'GET', confirmed: false },
  updateMilestone: { path: '/contractor/milestones/{id}', method: 'PATCH', confirmed: false },
  documents: { path: '/contractor/contracts/{id}/documents', method: 'GET', confirmed: false },
  uploadDocument: { path: '/contractor/contracts/{id}/documents', method: 'POST', confirmed: false },
  downloadDocument: { path: '/contractor/documents/{id}/download', method: 'GET', confirmed: false },
  activity: { path: '/contractor/contracts/{id}/activity', method: 'GET', confirmed: false },
  createContractRequest: { path: '/contractor/contract-requests', method: 'POST', confirmed: false },
  listContractRequests: { path: '/contractor/contract-requests', method: 'GET', confirmed: false },
  createRenewalRequest: { path: '/contractor/renewal-requests', method: 'POST', confirmed: false },
  listRenewalRequests: { path: '/contractor/renewal-requests', method: 'GET', confirmed: false },
  downloadContract: { path: '/contractor/contracts/{id}/download', method: 'GET', confirmed: false },
} as const;

export type ContractsEndpointKey = keyof typeof CONTRACTS_ENDPOINTS;

export class ContractsHttpError extends Error {
  constructor(message: string, readonly status: number, readonly endpoint: string) {
    super(message);
    this.name = 'ContractsHttpError';
  }
}

/** Build a URL from the central map, substituting path params. */
export function contractsUrl(key: ContractsEndpointKey, params?: Record<string, string | number>): string {
  let path: string = CONTRACTS_ENDPOINTS[key].path;
  if (params) for (const [k, v] of Object.entries(params)) path = path.replace(`{${k}}`, String(v));
  return apiUrl(path);
}

/**
 * Authenticated JSON request against the API base.
 * Throws ContractsHttpError on any failure — callers surface it (no mock fallback).
 */
export async function contractsFetch<T>(key: ContractsEndpointKey, opts: {
  params?: Record<string, string | number>;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  signal?: AbortSignal;
} = {}): Promise<T> {
  const endpoint = CONTRACTS_ENDPOINTS[key];
  if (!endpoint.confirmed) {
    // Guard: never guess contracts. Surface exactly what is missing.
    throw new ContractsHttpError(
      `TODO: endpoint ${endpoint.method} ${endpoint.path} is not yet confirmed with the backend. ` +
      `Set NEXT_PUBLIC_CONTRACTS_DATA_MODE=mock until the contract exists.`,
      0, endpoint.path,
    );
  }
  let url = contractsUrl(key, opts.params);
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
    throw new ContractsHttpError(
      (data as { detail?: string }).detail || `Request failed (${res.status})`,
      res.status, endpoint.path,
    );
  }
  return data as T;
}

/** Multipart upload support (document upload path once backend confirms it). */
export async function contractsUpload<T>(key: ContractsEndpointKey, form: FormData, params?: Record<string, string>): Promise<T> {
  const endpoint = CONTRACTS_ENDPOINTS[key];
  if (!endpoint.confirmed) {
    throw new ContractsHttpError(`TODO: upload endpoint ${endpoint.path} is not confirmed with the backend.`, 0, endpoint.path);
  }
  const token = getToken();
  const res = await fetch(contractsUrl(key, params), {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ContractsHttpError((data as { detail?: string }).detail || 'Upload failed', res.status, endpoint.path);
  return data as T;
}
