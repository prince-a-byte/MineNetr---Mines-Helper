import { mockRepo } from '../../repositories/mockStore';
import { ApiError } from '../ApiError';
import type { MineService } from '../interfaces';
import { latency } from './util';

export const mockMines: MineService = {
  async listAssignedMines(q = '', status = 'All') {
    await latency();
    await mockRepo.ready();
    const needle = q.toLowerCase();
    return mockRepo.mines().filter((m) => {
      if (status !== 'All' && m.status !== status) return false;
      if (needle && !(m.name.toLowerCase().includes(needle) || m.location.toLowerCase().includes(needle))) return false;
      return true;
    });
  },

  async getMineById(id) {
    await latency();
    await mockRepo.ready();
    const m = mockRepo.mineById(id);
    if (!m) throw new ApiError('Mine not found or not assigned to you.', { status: 404 });
    return m;
  },

  async getMineSummary(id) {
    await latency();
    await mockRepo.ready();
    const ws = mockRepo.data.workers.filter((w) => w.mineId === id);
    return {
      total: ws.length,
      active: ws.filter((w) => w.status === 'Active').length,
      onLeave: ws.filter((w) => w.status === 'On Leave').length,
      inactive: ws.filter((w) => w.status === 'Inactive').length,
    };
  },

  async listAssignments(mineId) {
    await latency();
    await mockRepo.ready();
    return mockRepo.data.assignments.filter((a) => a.mineId === mineId);
  },
};
