import { httpServices } from './http/client';
import { mockAuth } from './mock/auth.mock';
import { mockBills } from './mock/bills.mock';
import { mockDashboard, mockNotifications, mockProfile } from './mock/misc.mock';
import { mockDocuments } from './mock/documents.mock';
import { mockMines } from './mock/mines.mock';
import { mockWorkers } from './mock/workers.mock';
import type { Services } from './interfaces';

/**
 * DATA_MODE switch. "mock" (default) uses local repositories.
 * "http" uses real backend adapters and NEVER falls back to mock data —
 * failures surface as real errors so fake records can't masquerade as live ones.
 */
const MODE = process.env.EXPO_PUBLIC_DATA_MODE ?? 'mock';

const mockServices: Services = {
  auth: mockAuth,
  workers: mockWorkers,
  mines: mockMines,
  documents: mockDocuments,
  bills: mockBills,
  dashboard: mockDashboard,
  profile: mockProfile,
  notifications: mockNotifications,
};

export const services: Services = MODE === 'http' ? httpServices : mockServices;
export const DATA_MODE = MODE;
export const isDemo = MODE !== 'http';
