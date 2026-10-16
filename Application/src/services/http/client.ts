/**
 * HTTP service placeholders for the FUTURE FastAPI backend.
 * Every method throws ApiError.notImplemented until its endpoint contract is
 * confirmed against the real backend. Screens never import this file directly —
 * they use `services` from serviceProvider, so switching DATA_MODE flips the
 * whole app without touching UI code.
 *
 * Intended endpoint map (to confirm, NOT assumed to exist):
 *   POST /api/v1/auth/login            AuthService.login
 *   POST /api/v1/auth/otp/request      AuthService.loginWithOtp
 *   POST /api/v1/auth/otp/verify      AuthService.verifyOtp
 *   POST /api/v1/auth/password-reset   AuthService.requestPasswordReset
 *   GET  /api/v1/contractor/workers    WorkerService.listWorkers
 *   POST /api/v1/contractor/workers    WorkerService.createWorker
 *   ... (see docs/API_CONTRACT_TODO.md)
 */
import { ApiError } from '../ApiError';
import type { Services } from '../interfaces';

const BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';
const MODE = process.env.EXPO_PUBLIC_DATA_MODE ?? 'mock';

if (!__DEV__ && !BASE) {
  // eslint-disable-next-line no-console
  console.warn('[api] EXPO_PUBLIC_API_BASE_URL is not set.');
}

export interface HttpEnvelope<T> {
  data: T;
}

/** Centralized fetch with timeout + normalized errors. Session token attached by callers. */
export async function http<T>(path: string, init?: RequestInit & { token?: string; timeoutMs?: number }): Promise<T> {
  if (MODE !== 'http') throw ApiError.notImplemented('HTTP client (DATA_MODE is not "http")');
  if (!BASE) throw new ApiError('API base URL is not configured.');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), init?.timeoutMs ?? 15000);
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.token ? { Authorization: `Bearer ${init.token}` } : {}),
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      let detail = `Request failed (${res.status}).`;
      try {
        const body = (await res.json()) as { detail?: string };
        if (body.detail) detail = body.detail;
      } catch {
        /* keep default */
      }
      throw new ApiError(detail, { status: res.status });
    }
    return (await res.json()) as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if ((e as Error).name === 'AbortError') throw new ApiError('Request timed out. Try again.');
    throw new ApiError('Network error. Check your connection and retry.');
  } finally {
    clearTimeout(timer);
  }
}

function todo(name: string): never {
  throw ApiError.notImplemented(`HTTP ${name}`);
}

/** HTTP adapters — all TODO until endpoint contracts are confirmed. */
export const httpServices: Services = {
  auth: {
    login: () => todo('AuthService.login — POST /api/v1/auth/login'),
    loginWithOtp: () => todo('AuthService.loginWithOtp'),
    verifyOtp: () => todo('AuthService.verifyOtp'),
    resendOtp: () => todo('AuthService.resendOtp'),
    requestPasswordReset: () => todo('AuthService.requestPasswordReset'),
    logout: async () => {},
    getSession: async () => null,
  },
  workers: {
    listWorkers: () => todo('WorkerService.listWorkers — GET /api/v1/contractor/workers'),
    getWorkerById: () => todo('WorkerService.getWorkerById'),
    createWorker: () => todo('WorkerService.createWorker'),
    updateWorker: () => todo('WorkerService.updateWorker'),
    updateWorkerStatus: () => todo('WorkerService.updateWorkerStatus'),
    transferWorker: () => todo('WorkerService.transferWorker'),
  },
  mines: {
    listAssignedMines: () => todo('MineService.listAssignedMines'),
    getMineById: () => todo('MineService.getMineById'),
    getMineSummary: () => todo('MineService.getMineSummary'),
    listAssignments: () => todo('MineService.listAssignments'),
  },
  documents: {
    listDocuments: () => todo('DocumentService.listDocuments'),
    getDocumentById: () => todo('DocumentService.getDocumentById'),
    createDocumentMetadata: () => todo('DocumentService.createDocumentMetadata'),
    uploadDocument: () => todo('DocumentService.uploadDocument (multipart)'),
    requestVerification: () => todo('DocumentService.requestVerification'),
  },
  bills: {
    listBills: () => todo('BillService.listBills'),
    getBillById: () => todo('BillService.getBillById'),
    createBill: () => todo('BillService.createBill'),
    listTransactions: () => todo('BillService.listTransactions'),
  },
  dashboard: {
    summary: () => todo('DashboardService.summary'),
    recentUpdates: () => todo('DashboardService.recentUpdates'),
  },
  profile: {
    getCompany: () => todo('ProfileService.getCompany'),
    updateCompany: () => todo('ProfileService.updateCompany'),
    changePassword: () => todo('ProfileService.changePassword'),
  },
  notifications: {
    list: () => todo('NotificationService.list'),
    markAllRead: async () => {},
  },
};
