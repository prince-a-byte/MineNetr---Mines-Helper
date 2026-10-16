import { mockRepo } from '../../repositories/mockStore';
import type { Bill } from '../../types/models';
import type { BillInput } from '../../schemas/forms';
import { ApiError } from '../ApiError';
import type { BillService } from '../interfaces';
import { latency, paginate } from './util';

export const mockBills: BillService = {
  async listBills(f, page = 1, pageSize = 8) {
    await latency();
    await mockRepo.ready();
    const q = (f.q ?? '').toLowerCase();
    const all = mockRepo.data.bills.filter((b) => {
      if (f.status && f.status !== 'All' && b.status !== f.status) return false;
      if (f.mineId && b.mineId !== f.mineId) return false;
      if (q) {
        const mine = mockRepo.mineById(b.mineId);
        const hay = `${b.id} ${b.workType} ${mine?.name ?? ''} ${b.period}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    return paginate(all, page, pageSize);
  },

  async getBillById(id) {
    await latency();
    await mockRepo.ready();
    const b = mockRepo.data.bills.find((x) => x.id === id);
    if (!b) throw new ApiError('Bill not found.', { status: 404 });
    return b;
  },

  async createBill(input: BillInput) {
    await latency(500);
    await mockRepo.ready();
    const mine = mockRepo.mineById(input.mineId);
    if (!mine) throw new ApiError('Select an assigned mine.', { status: 422 });
    const bill: Bill = {
      id: mockRepo.nextBillId(),
      workType: input.workType,
      mineId: input.mineId,
      amountInr: Math.round(input.amountInr),
      period: input.period.trim(),
      submittedOn: new Date().toISOString().slice(0, 10),
      // Contractors can submit; approval and payment are separate operator actions.
      status: 'Pending',
      description: input.description,
    };
    await mockRepo.mutate((s) => {
      s.bills.unshift(bill);
      s.activities.unshift(mockRepo.pushActivity({ kind: 'bill', text: `Bill ${bill.id} submitted`, refId: bill.id }));
      s.notifications.unshift({
        id: `N-${Date.now()}`, title: 'Bill submitted',
        body: `${bill.id} for ${mine.name} is now under review.`, at: new Date().toISOString(), read: false,
      });
    });
    return bill;
  },

  async listTransactions() {
    await latency();
    await mockRepo.ready();
    return [...mockRepo.data.payments].sort((a, b) => b.date.localeCompare(a.date));
  },
};
