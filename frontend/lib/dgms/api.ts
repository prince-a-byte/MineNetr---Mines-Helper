/**
 * Future FastAPI integration contract.
 * Base URL comes from the environment; endpoint paths are centralized here.
 * CONFIRMED = exists in backend/app/main.py today (verified 2026-10-17).
 * TODO      = proposed only; must be confirmed with the backend before the
 *             HTTP adapter is enabled. Nothing here is assumed to exist.
 */
import { api as libApi } from '../api';

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

export const ENDPOINTS = {
  // --- CONFIRMED in backend/app/main.py ---
  health: '/api/v1/health', // CONFIRMED
  login: '/api/v1/auth/login', // CONFIRMED (used by login page today)
  me: '/api/v1/auth/me', // CONFIRMED
  dgmsOverview: '/api/v1/dgms/overview', // CONFIRMED
  minesList: '/api/v1/mines', // CONFIRMED (list w/ q/state/status/page/size)
  mineDetail: '/api/v1/mines/{code}', // CONFIRMED (read-only)
  inspectionsList: '/api/v1/inspections', // CONFIRMED (list w/ q/status/page/size)
  inspectionUpdate: '/api/v1/inspections/{iid}', // CONFIRMED (PATCH status)
  findingsList: '/api/v1/findings', // CONFIRMED (list w/ q/severity/status/page/size)
  findingUpdate: '/api/v1/findings/{fid}', // CONFIRMED (PATCH)
  findingCreate: '/api/v1/findings', // CONFIRMED (POST)
  notificationsList: '/api/v1/notifications', // CONFIRMED (read-only list)
  auditList: '/api/v1/audit', // CONFIRMED (read-only list)
  auditCreate: '/api/v1/audit', // CONFIRMED (POST)
  workersList: '/api/v1/workers', // CONFIRMED (list w/ q/page/size)
  workerCreate: '/api/v1/workers', // CONFIRMED (POST)
  contractsList: '/api/v1/contracts', // CONFIRMED (list)
  billsList: '/api/v1/bills', // CONFIRMED (list w/ status/page/size)
  billCreate: '/api/v1/bills', // CONFIRMED (POST)
  billDecision: '/api/v1/bills/{bid}', // CONFIRMED (PATCH)

  // --- TODO: no backend endpoint confirmed; HTTP adapter must not use these ---
  mines: 'TODO: POST /api/v1/dgms/mines (create) — unconfirmed',
  mineById: 'TODO: PUT /api/v1/dgms/mines/{id} (update) — unconfirmed',
  inspections: 'TODO: POST /api/v1/dgms/inspections (schedule) — unconfirmed',
  inspectionById: 'TODO: PATCH /api/v1/dgms/inspections/{id} (status/report) — unconfirmed',
  findings: 'TODO: dedicated DGMS findings write API — unconfirmed',
  findingById: 'TODO: PATCH /api/v1/dgms/findings/{id} (verify/resolve) — unconfirmed',
  correctiveActions: 'TODO: /api/v1/dgms/corrective-actions — unconfirmed',
  notifications: 'TODO: PATCH /api/v1/dgms/notifications/{id} (read/ack) — unconfirmed',
  reports: 'TODO: POST /api/v1/dgms/reports (generate) — unconfirmed',
  users: 'TODO: /api/v1/dgms/users — unconfirmed',
  permissions: 'TODO: /api/v1/dgms/roles/permissions — unconfirmed',
  settings: 'TODO: /api/v1/dgms/settings — unconfirmed',
  workers: 'TODO: PATCH /api/v1/dgms/workers/{id} — unconfirmed',
  contractors: 'TODO: /api/v1/dgms/contractors — unconfirmed',
  dispatch: 'TODO: /api/v1/dgms/dispatch — unconfirmed',
} as const;

export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * Authenticated HTTP helper for future use. Timeouts, no silent fallback:
 * callers must catch ApiError and render error + retry UI.
 */
export async function http(path: string, opts: RequestInit & { timeoutMs?: number } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 15000);
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('minenetr_token') : null;
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...opts,
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(opts.headers || {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError((data as { detail?: string }).detail || `Request failed (${res.status})`, res.status);
    return data;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(e instanceof Error && e.name === 'AbortError' ? 'Request timed out. Retry.' : 'Network error. Retry.');
  } finally {
    clearTimeout(timer);
  }
}

export { libApi };
