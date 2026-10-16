import { mockRepo } from '../../repositories/mockStore';
import type { Worker, WorkerStatus } from '../../types/models';
import type { WorkerInput } from '../../schemas/forms';
import { ApiError } from '../ApiError';
import type { WorkerService } from '../interfaces';
import { latency, paginate } from './util';

export const mockWorkers: WorkerService = {
  async listWorkers(f, page = 1, pageSize = 8) {
    await latency();
    await mockRepo.ready();
    const q = (f.q ?? '').toLowerCase();
    const all = mockRepo.data.workers.filter((w) => {
      if (f.status && f.status !== 'All' && w.status !== f.status) return false;
      if (f.mineId && w.mineId !== f.mineId) return false;
      if (f.role && w.role !== f.role) return false;
      if (q && !(w.name.toLowerCase().includes(q) || w.id.toLowerCase().includes(q))) return false;
      return true;
    });
    return paginate(all, page, pageSize);
  },

  async getWorkerById(id) {
    await latency();
    await mockRepo.ready();
    const w = mockRepo.data.workers.find((x) => x.id === id);
    if (!w) throw new ApiError('Worker not found.', { status: 404 });
    return w;
  },

  async createWorker(input: WorkerInput) {
    await latency(450);
    await mockRepo.ready();
    const id = mockRepo.nextWorkerId();
    const mine = mockRepo.mineById(input.mineId);
    if (!mine) throw new ApiError('Select an assigned mine.', { status: 422 });
    const worker: Worker = {
      id,
      name: input.fullName.trim(),
      role: input.jobRole,
      mineId: input.mineId,
      status: 'Active',
      phone: `91${input.phone}`,
      dob: input.dob,
      gender: input.gender,
      aadhaarLast4: input.aadhaar.slice(-4),
      joiningDate: input.joiningDate,
      employmentType: input.employmentType,
      address: '',
      emergencyName: '',
      emergencyPhone: '',
      remarks: input.remarks,
    };
    await mockRepo.mutate((s) => {
      s.workers.unshift(worker);
      s.assignments.unshift({ id: `ASG-${id}`, workerId: id, mineId: input.mineId, from: input.joiningDate, status: 'Active' });
      s.activities.unshift(mockRepo.pushActivity({ kind: 'worker', text: `${worker.name} added to ${mine.name}`, refId: id }));
    });
    return worker;
  },

  async updateWorker(id, input) {
    await latency(350);
    await mockRepo.ready();
    let updated: Worker | undefined;
    await mockRepo.mutate((s) => {
      const i = s.workers.findIndex((w) => w.id === id);
      if (i === -1) return;
      s.workers[i] = { ...s.workers[i], ...input, id } as Worker;
      updated = s.workers[i];
    });
    if (!updated) throw new ApiError('Worker not found.', { status: 404 });
    return updated;
  },

  async updateWorkerStatus(id, status: WorkerStatus) {
    await latency(300);
    await mockRepo.ready();
    let updated: Worker | undefined;
    await mockRepo.mutate((s) => {
      const w = s.workers.find((x) => x.id === id);
      if (!w) return;
      w.status = status;
      s.assignments.filter((a) => a.workerId === id && !a.to).forEach((a) => { a.status = status; });
      updated = { ...w };
    });
    if (!updated) throw new ApiError('Worker not found.', { status: 404 });
    return updated;
  },

  async transferWorker(id, mineId) {
    await latency(350);
    await mockRepo.ready();
    const mine = mockRepo.mineById(mineId);
    if (!mine) throw new ApiError('Select an assigned mine.', { status: 422 });
    let updated: Worker | undefined;
    await mockRepo.mutate((s) => {
      const w = s.workers.find((x) => x.id === id);
      if (!w) return;
      const today = new Date().toISOString().slice(0, 10);
      s.assignments.filter((a) => a.workerId === id && !a.to).forEach((a) => { a.to = today; });
      w.mineId = mineId;
      s.assignments.unshift({ id: `ASG-${id}-${Date.now()}`, workerId: id, mineId, from: today, status: w.status });
      s.activities.unshift(mockRepo.pushActivity({ kind: 'worker', text: `${w.name} transferred to ${mine.name}`, refId: id }));
      updated = { ...w };
    });
    if (!updated) throw new ApiError('Worker not found.', { status: 404 });
    return updated;
  },
};
