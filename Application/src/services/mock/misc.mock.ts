import { mockRepo } from '../../repositories/mockStore';
import type { DashboardService, NotificationService, ProfileService } from '../interfaces';
import { latency } from './util';
import { ApiError } from '../ApiError';

export const mockDashboard: DashboardService = {
  async summary() {
    await latency();
    await mockRepo.ready();
    const { workers, documents, bills } = mockRepo.data;
    const active = workers.filter((w) => w.status === 'Active').length;
    const pendingDocs = documents.filter((d) => d.status === 'Pending').length;
    const totalBilled = bills.reduce((a, b) => a + b.amountInr, 0);
    const approved = bills.filter((b) => b.status === 'Approved' || b.status === 'Paid')
      .reduce((a, b) => a + b.amountInr, 0);
    const mines = new Set(workers.map((w) => w.mineId)).size;
    return {
      totalWorkers: workers.length,
      activeWorkers: active,
      assignedMines: mockRepo.mines().length || mines,
      pendingDocuments: pendingDocs,
      totalBilledInr: totalBilled,
      approvedInr: approved,
      pendingBills: bills.filter((b) => b.status === 'Pending').length,
    };
  },
  async recentUpdates(limit = 6) {
    await latency(150);
    await mockRepo.ready();
    return mockRepo.data.activities.slice(0, limit);
  },
};

export const mockProfile: ProfileService = {
  async getCompany() {
    await latency();
    await mockRepo.ready();
    const c = mockRepo.data.company;
    const mineIds = mockRepo.mines().map((m) => m.id);
    return { ...c, ...mockRepo.data.profileEdits, mineIds };
  },
  async updateCompany(patch) {
    await latency(400);
    await mockRepo.ready();
    await mockRepo.mutate((s) => {
      s.profileEdits = { ...s.profileEdits, ...patch };
    });
    return this.getCompany();
  },
  async changePassword(current, next) {
    await latency(400);
    if (current !== 'Demo@123') throw new ApiError('Current password is incorrect (demo: Demo@123).', { status: 401 });
    if (next.length < 6) throw new ApiError('Use at least 6 characters.', { status: 422 });
  },
};

export const mockNotifications: NotificationService = {
  async list() {
    await latency(150);
    await mockRepo.ready();
    return mockRepo.data.notifications;
  },
  async markAllRead() {
    await mockRepo.mutate((s) => {
      s.notifications.forEach((n) => { n.read = true; });
    });
  },
};
