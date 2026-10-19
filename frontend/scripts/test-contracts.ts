/**
 * Executable verification of the contractor "My Contracts" data layer.
 * Stubs browser globals, imports the REAL store/filter logic and asserts the
 * behaviours the UI depends on. Run with: npx tsx scripts/test-contracts.ts
 */
// ---- Browser global stubs (before importing the store) ----
const mem = new Map<string, string>();
(globalThis as any).window = {
  localStorage: {
    getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
    setItem: (k: string, v: string) => { mem.set(k, String(v)); },
    removeItem: (k: string) => { mem.delete(k); },
    clear: () => mem.clear(),
  },
  setTimeout: (fn: () => void) => setTimeout(fn, 0),
  addEventListener: () => {},
  removeEventListener: () => {},
};
(globalThis as any).localStorage = (globalThis as any).window.localStorage;

import {
  actions, filterContracts, isExpiringSoon, inStatusTab, getContractsDb,
  allowedMines, upcomingMilestones, mineLabel,
} from '../lib/contracts/store';
import { ContractStatus, RequestStatus, type ContractFilters } from '../lib/contracts/types';

let pass = 0; let fail = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name}`, extra ?? ''); }
}
const ALL: ContractFilters = {
  mineId: 'ALL', status: 'All Contracts', workType: 'All Work Types',
  startFrom: '', startTo: '', endFrom: '', endTo: '', minValue: '', maxValue: '',
};
const db = getContractsDb();

console.log('\n— Reference contract values —');
const byId = (id: string) => db.contracts.find((c) => c.id === id)!;
check('CT-BCM-001 Overburden Removal = Active, 70%, ₹12.5Cr',
  byId('CT-BCM-001').status === ContractStatus.Active && byId('CT-BCM-001').progress === 70 && byId('CT-BCM-001').contractValue === 125000000);
check('CT-EFM-003 Site Services = Expiring Soon, 85%',
  byId('CT-EFM-003').status === ContractStatus.ExpiringSoon && byId('CT-EFM-003').progress === 85);
check('CT-NBM-004 Exploration Support = Completed, 100%',
  byId('CT-NBM-004').status === ContractStatus.Completed && byId('CT-NBM-004').progress === 100);

console.log('\n— Status tabs (derived, not hardcoded) —');
const scoped = db.contracts.filter((c) => c.contractorId === db.contractor.id);
check('All Contracts = 9', scoped.length === 9, scoped.length);
check('Active = 3', scoped.filter((c) => c.status === ContractStatus.Active).length === 3);
check('Upcoming = 2 (populated)', scoped.filter((c) => c.status === ContractStatus.Upcoming).length === 2);
check('Expiring Soon = 1', scoped.filter(isExpiringSoon).length === 1);
check('Completed = 1', scoped.filter((c) => c.status === ContractStatus.Completed).length === 1);
check('Terminated = 2 (populated)', scoped.filter((c) => c.status === ContractStatus.Terminated).length === 2);
check('inStatusTab(Terminated) returns only terminated',
  filterContracts(scoped, { ...ALL, status: 'Terminated' }, '').every((c) => c.status === ContractStatus.Terminated));

console.log('\n— Search —');
check('search by name "Overburden" → 2 (name + category)',
  filterContracts(scoped, ALL, 'Overburden').length === 2);
check('search by id "CT-BCM-001" → 1', filterContracts(scoped, ALL, 'CT-BCM-001').length === 1);
check('search by mine "North Block" → 3', filterContracts(scoped, ALL, 'North Block').length === 3);
check('search combines with tab (Active + "Coal") → 2 (name + mine)',
  filterContracts(scoped, { ...ALL, status: 'Active' }, 'Coal').length === 2);
check('no-results search → 0', filterContracts(scoped, ALL, 'zzz-no-match').length === 0);

console.log('\n— Mine scope —');
check('permission-scoped mines = 3', allowedMines().length === 3);
check('mine M-01 scope → 4 contracts', scoped.filter((c) => c.mineId === 'M-01').length === 4);
check('mine label renders code', mineLabel('M-01') === 'Bharat Coal Mine (BCM-01)');
check('reject out-of-permission mine', (() => { try { actions.setSelectedMine('M-99'); return getContractsDb().selectedMineId !== 'M-99'; } catch { return true; } })());
actions.setSelectedMine('M-01');
check('setSelectedMine(M-01) persists', getContractsDb().selectedMineId === 'M-01');
actions.setSelectedMine('ALL');

console.log('\n— Structured filters —');
check('end-date window catches CT-BCM-001 (ends 2026-12-31)',
  filterContracts(scoped, { ...ALL, endFrom: '2026-10-01', endTo: '2027-01-31' }, '').some((c) => c.id === 'CT-BCM-001'));
check('value min 10Cr → only the 12.5Cr contract',
  filterContracts(scoped, { ...ALL, minValue: '100000000' }, '').length === 1);
check('workType/category filter Site Services → 3',
  filterContracts(scoped, { ...ALL, workType: 'Site Services' }, '').length === 3);
check('search + filter + tab combine (Active, Site Services) → 0',
  filterContracts(scoped, { ...ALL, status: 'Active', workType: 'Site Services' }, '').length === 0);

console.log('\n— New contract request is NOT a contract —');
const before = getContractsDb().contracts.length;
const crId = actions.createContractRequest({
  mineId: 'M-01', workType: 'Site Services', proposedTitle: 'Test Workshop Contract',
  scopeOfWork: 'A sufficiently long scope of work for validation testing purposes.',
  proposedStartDate: '2026-12-01', proposedEndDate: '2027-11-30',
  estimatedValue: 15000000, currency: 'INR' as any, notes: '', attachments: [],
});
check('request created with stable id', /^CR-2026-\d{4}$/.test(crId), crId);
check('request is Pending Review', getContractsDb().requests.find((r) => r.id === crId)!.status === RequestStatus.PendingReview);
check('contracts count unchanged (request ≠ contract)', getContractsDb().contracts.length === before);
check('request does NOT appear in Active tab',
  !filterContracts(getContractsDb().contracts, { ...ALL, status: 'Active' }, '').some((c) => c.id === crId));
check('out-of-permission request rejected', (() => {
  try { actions.createContractRequest({ mineId: 'M-99', workType: 'x', proposedTitle: 'x x', scopeOfWork: 'y'.repeat(30), proposedStartDate: '2026-12-01', proposedEndDate: '2027-01-01', estimatedValue: 1, currency: 'INR' as any, notes: '', attachments: [] }); return false; } catch { return true; }
})());

console.log('\n— Renewal does NOT change the parent contract —');
const target = byId('CT-BCM-001');
const endBefore = target.endDate; const valBefore = target.contractValue;
const rrId = actions.requestRenewal('CT-BCM-001', {
  proposedEndDate: '2028-03-31', proposedValue: 150000000, reason: 'Extending for the next phase of overburden removal.', attachments: [],
});
check('renewal created with stable id', /^RR-2026-\d{4}$/.test(rrId), rrId);
check('renewal is Pending Review', getContractsDb().renewals.find((r) => r.id === rrId)!.status === RequestStatus.PendingReview);
check('parent contract endDate UNCHANGED', byId('CT-BCM-001').endDate === endBefore);
check('parent contract value UNCHANGED', byId('CT-BCM-001').contractValue === valBefore);
check('completed contract not renewal-eligible', byId('CT-NBM-004').renewalEligible === false);
check('renew on non-eligible contract throws', (() => {
  try { actions.requestRenewal('CT-NBM-004', { proposedEndDate: '2027-01-01', proposedValue: 1, reason: 'n/a reason here', attachments: [] }); return false; } catch { return true; }
})());

console.log('\n— Milestone workflow (contractor can submit, never approve) —');
const ms = getContractsDb().milestones.find((m) => m.id === 'MS-004')!;
const cBefore = getContractsDb().contracts.find((c) => c.id === ms.contractId)!.updatedAt;
actions.updateMilestone('MS-004', { submit: true });
const msAfter = getContractsDb().milestones.find((m) => m.id === 'MS-004')!;
check('milestone marked submitted (Completed)', msAfter.status === 'Completed');
check('milestone has submittedAt', !!msAfter.submittedAt);
check('contract updatedAt bumped', getContractsDb().contracts.find((c) => c.id === ms.contractId)!.updatedAt !== cBefore);
check('audit entry appended', getContractsDb().audit[0].module === 'Milestone');
check('activity logged', getContractsDb().activity[0].kind === 'Milestone Updated');

console.log('\n— Upcoming milestones —');
check('upcoming milestones present for ALL', upcomingMilestones('ALL').length > 0);
check('upcoming milestones exclude Completed',
  upcomingMilestones('ALL').every((m) => m.status !== 'Completed'));

console.log('\n— Demo persistence —');
const raw = mem.get('minenetr_contractor_contracts_v1');
check('state persisted to localStorage', !!raw && raw.length > 100);
actions.resetDemo();
check('reset restores original contract count (9)', getContractsDb().contracts.length === 9);
check('reset clears the test request', !getContractsDb().requests.some((r) => r.id === crId));

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
if (fail > 0) process.exit(1);
