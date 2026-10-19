/**
 * Executable verification of the contractor workforce mock repository.
 * Run: npx tsx scripts/test-workforce.ts
 *
 * Asserts dataset shape, relational coherence, KPI derivation, filters,
 * permission boundaries, mutation side-effects and demo reset — against the
 * real store (no mocked internals).
 */
import {
  actions, attendanceOf, computeKpis, filterWorkers, getWorkforceDb, indexTraining,
  worstTraining, accessOf, attendanceTrend, can, canReason,
} from '../lib/workforce/store';
import { trainingStatusOf } from '../lib/workforce/format';
import {
  AccessStatus, AttendanceStatus, BillStatus, ContractorStatus, DocumentStatus,
  IncidentStatus, Severity, TransferStatus, WorkerStatus, type WorkerFilters,
} from '../lib/workforce/types';

let pass = 0; let fail = 0;
function ok(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ FAIL: ${label}`); }
}
function section(t: string) { console.log(`\n${t}`); }

// ---------- Dataset shape ----------
section('1. Dataset shape');
const db = getWorkforceDb();
ok(db.workers.length === 482, `482 workers (got ${db.workers.length})`);
ok(db.contractors.length === 8, `8 contractors (got ${db.contractors.length})`);
ok(db.training.length >= 40, `>=40 training records (got ${db.training.length})`);
ok(db.attendance.length === 482, `482 attendance records (got ${db.attendance.length})`);
ok(db.access.length >= 20, `>=20 access records (got ${db.access.length})`);
ok(db.leaves.length >= 20, `>=20 leave records (got ${db.leaves.length})`);
ok(db.gatePasses.length >= 18, `>=18 gate passes (got ${db.gatePasses.length})`);
ok(db.bills.length === 12, `12 bills (got ${db.bills.length})`);
ok(db.payments.length === 8, `8 payments (got ${db.payments.length})`);
ok(db.documents.length === 128, `128 documents (got ${db.documents.length})`);
ok(db.transfers.length === 10, `10 transfer requests (got ${db.transfers.length})`);
ok(db.incidents.length >= 20, `>=20 incidents (got ${db.incidents.length})`);
ok(db.notifications.length === 24, `24 notifications (got ${db.notifications.length})`);
ok(db.reports.length === 14, `14 report definitions (got ${db.reports.length})`);
ok(new Set(db.workers.map((w) => w.id)).size === 482, 'worker IDs are unique');
ok(new Set(db.training.map((t) => t.id)).size === db.training.length, 'training IDs are unique');

// ---------- Relational coherence ----------
section('2. Relational coherence');
const contIds = new Set(db.contractors.map((c) => c.id));
const mineIds = new Set(['M-01', 'M-02', 'M-03']);
ok(db.workers.every((w) => contIds.has(w.contractorId)), 'every worker references an existing contractor');
ok(db.workers.every((w) => mineIds.has(w.mineId)), 'every worker references a valid mine');
ok(db.training.every((t) => db.workers.some((w) => w.id === t.workerId)), 'every training record references a worker');
ok(db.attendance.every((a) => db.workers.some((w) => w.id === a.workerId)), 'every attendance record references a worker');
ok(db.access.every((a) => db.workers.some((w) => w.id === a.workerId)), 'every access record references a worker');
ok(db.transfers.every((t) => db.workers.some((w) => w.id === t.workerId)), 'every transfer references a worker');
ok(db.incidents.every((i) => contIds.has(i.contractorId)), 'every incident references an existing contractor');

// Attendance must never contradict worker status.
const blockedPresent = db.workers.filter((w) => w.status !== WorkerStatus.Active
  && attendanceOf(db, w.id)?.status === AttendanceStatus.Present);
ok(blockedPresent.length === 0, 'no inactive/blocked worker is shown Present today');

// Expiry-driven statuses.
const expiredRec = db.training.find((t) => trainingStatusOf(t) === 'Expired');
const validRec = db.training.find((t) => trainingStatusOf(t) === 'Valid');
const pendingRec = db.training.find((t) => trainingStatusOf(t) === 'Pending Verification');
ok(!!expiredRec && expiredRec.expiryDate < '2026-10-03', 'expired certification has a past expiry date');
ok(!!validRec && validRec.expiryDate > '2026-10-03' && validRec.verified, 'valid certification is verified + future expiry');
ok(!!pendingRec && !pendingRec.verified, 'pending certification is unverified');

const docExpired = db.documents.filter((d) => d.expiryDate < '2026-10-03');
const docExpiring = db.documents.filter((d) => d.expiryDate >= '2026-10-03' && d.expiryDate <= '2026-12-02');
ok(docExpired.length === 8, `8 expired documents (got ${docExpired.length})`);
ok(docExpiring.length === 18, `18 expiring documents (got ${docExpiring.length})`);
ok(db.documents.length - docExpired.length - docExpiring.length === 102, '102 valid documents');

// ---------- KPI derivation ----------
section('3. KPI derivation (mine scope = ALL)');
const k = computeKpis(db);
ok(k.totalWorkers === 482, `Total workers = 482 (got ${k.totalWorkers})`);
ok(k.activeWorkers === 447, `Active = 447 (got ${k.activeWorkers})`);
ok(k.blockedOrInactive === 35, `Blocked/Inactive = 35 (got ${k.blockedOrInactive})`);
ok(k.presentToday === 415, `Present today = 415 (got ${k.presentToday})`);
ok(k.onLeave === 8, `On leave = 8 (got ${k.onLeave})`);
ok(k.absentToday === 52, `Absent = 52 (got ${k.absentToday})`);
ok(k.accessBlocked === 7, `Access blocked = 7 (got ${k.accessBlocked})`);
ok(k.trainingExpiring === 25, `Training expiring soon ≈ 24 (got ${k.trainingExpiring})`);ok(k.totalBilled === 2840000, `Total billed = ₹28.4 Lakh (got ${k.totalBilled})`);
ok(k.approvedAmount === 2060000, `Approved = ₹20.6 Lakh (got ${k.approvedAmount})`);
ok(k.pendingAmount === 680000, `Pending = ₹6.8 Lakh (got ${k.pendingAmount})`);
ok(k.rejectedAmount === 100000, `Rejected = ₹1.0 Lakh (got ${k.rejectedAmount})`);
ok(k.totalDocs === 128, `Total documents = 128 (got ${k.totalDocs})`);
ok(k.complianceScore > 80 && k.complianceScore <= 100, `compliance score plausible (${k.complianceScore}%)`);
ok(k.avgAttendance > 70 && k.avgAttendance <= 100, `30-day avg attendance plausible (${k.avgAttendance}%)`);

// Bills must add up.
const billed = db.bills.reduce((s, b) => s + b.amount, 0);
const split = ['Approved', 'Pending', 'Rejected'].reduce((s, st) =>
  s + db.bills.filter((b) => b.status === st).reduce((a, b) => a + b.amount, 0), 0);
ok(billed === split, 'bill statuses partition the total billed amount');

// ---------- Mine scoping ----------
section('4. Mine scoping + filters');
const bcm = computeKpis({ ...db, selectedMineId: 'M-01' });
ok(bcm.totalWorkers === 245, `Bharat Coal Mine scope = 245 workers (got ${bcm.totalWorkers})`);
ok(bcm.totalWorkers < k.totalWorkers, 'mine scope narrows the KPI set');

const base: WorkerFilters = {
  mineId: 'ALL', tab: 'All Workers', contractorId: 'ALL', department: 'ALL', status: 'ALL',
  trainingStatus: 'ALL', attendance: 'ALL', accessStatus: 'ALL',
};
ok(filterWorkers(db, db.workers, base, '').length === 482, 'no filters → full dataset');
const byCont = filterWorkers(db, db.workers, { ...base, contractorId: 'DEMO-CONT-001' }, '');
ok(byCont.length === 172, `contractor filter → 172 (got ${byCont.length})`);
const byMine = filterWorkers(db, db.workers, { ...base, mineId: 'M-02' }, '');
ok(byMine.length === 156, `mine filter M-02 → 156 (got ${byMine.length})`);
const combined = filterWorkers(db, db.workers, { ...base, mineId: 'M-01', department: 'Mining' }, '');
ok(combined.length > 0 && combined.every((w) => w.mineId === 'M-01' && w.department === 'Mining'), 'combined filters intersect');
const bySearch = filterWorkers(db, db.workers, base, 'WORK-0007');
ok(bySearch.length === 1 && bySearch[0].id === 'WORK-0007', 'search by worker ID');
const byName = filterWorkers(db, db.workers, base, db.workers[12].name);
ok(byName.some((w) => w.id === db.workers[12].name ? false : byName.some((x) => x.id === db.workers[12].id)), 'search by worker name finds the worker');
const byTraining = filterWorkers(db, db.workers, { ...base, trainingStatus: 'Expired' }, '');
ok(byTraining.length > 0 && byTraining.every((w) => worstTraining(indexTraining(db).get(w.id)) === 'Expired'), 'training-status filter is accurate');
const byAccess = filterWorkers(db, db.workers, { ...base, accessStatus: 'Blocked' }, '');
ok(byAccess.length === 7, `access Blocked filter → 7 (got ${byAccess.length})`);

// ---------- Permissions ----------
section('5. Demo role permissions');
actions.setRole('Read-Only Viewer');
ok(!can('worker.create'), 'read-only viewer cannot create workers');
ok(canReason('worker.create').length > 0, 'denied action explains why');
ok(can('export'), 'read-only viewer can still export');
let denied = false;
try { actions.createWorker({ name: 'X', workerId: 'WORK-9999', contractorId: 'DEMO-CONT-001', designation: 'Electrician', department: 'Electrical', mineId: 'M-01', contact: '9876543210', joiningDate: '2026-10-03', emergencyContact: '9876543211', gender: 'Male', shift: 'A', workZone: 'Workshop Bay 2', initialTraining: 'None' }); } catch (e) { denied = (e as Error).message.includes('demo role'); }
ok(denied, 'permission is enforced inside the action (not just UI)');

// ---------- Worker workflow ----------
section('6. Worker create → update → deactivate');
actions.setRole('Project Manager');
const newId = actions.createWorker({
  name: 'Test Kumar', workerId: 'WORK-9999', contractorId: 'DEMO-CONT-001', designation: 'Electrician',
  department: 'Electrical', mineId: 'M-01', contact: '9876543210', joiningDate: '2026-10-03',
  emergencyContact: '9876543211', gender: 'Male', shift: 'A', workZone: 'Workshop Bay 2',
  initialTraining: 'Mine Safety Induction',
});
ok(newId === 'WORK-9999', 'worker created');
ok(getWorkforceDb().workers.length === 483, 'worker count incremented');
ok(computeKpis(getWorkforceDb()).totalWorkers === 483, 'KPI total updated after creation');
ok(getWorkforceDb().training.some((t) => t.workerId === 'WORK-9999'), 'initial training record created');
ok(getWorkforceDb().attendance.some((a) => a.workerId === 'WORK-9999'), 'attendance row created');

let dupErr = '';
try { actions.createWorker({ name: 'Dup', workerId: 'WORK-9999', contractorId: 'DEMO-CONT-001', designation: 'Electrician', department: 'Electrical', mineId: 'M-01', contact: '9876543211', joiningDate: '2026-10-03', emergencyContact: '9876543212', gender: 'Male', shift: 'A', workZone: 'x', initialTraining: 'None' }); } catch (e) { dupErr = (e as Error).message; }
ok(dupErr.includes('already exists'), 'duplicate worker ID rejected');

let phoneErr = '';
try { actions.createWorker({ name: 'Bad Phone', workerId: 'WORK-9998', contractorId: 'DEMO-CONT-001', designation: 'Electrician', department: 'Electrical', mineId: 'M-01', contact: '12345', joiningDate: '2026-10-03', emergencyContact: '9876543212', gender: 'Male', shift: 'A', workZone: 'x', initialTraining: 'None' }); } catch (e) { phoneErr = (e as Error).message; }
ok(phoneErr.includes('10-digit'), 'invalid contact number rejected');

actions.updateWorker('WORK-9999', { department: 'Mining', shift: 'B' });
ok(getWorkforceDb().workers.find((w) => w.id === 'WORK-9999')?.department === 'Mining', 'worker update persisted');
actions.setWorkerStatus('WORK-9999', WorkerStatus.Inactive);
ok(getWorkforceDb().workers.find((w) => w.id === 'WORK-9999')?.status === WorkerStatus.Inactive, 'worker deactivated');
ok(getWorkforceDb().attendance.some((a) => a.workerId === 'WORK-9999'), 'deactivation did not delete history');
actions.setWorkerStatus('WORK-9999', WorkerStatus.Active);

// ---------- Deployment restrictions ----------
section('7. Deployment restrictions');
let deployErr = '';
actions.setContractorStatus('CONT-0007', ContractorStatus.Suspended);
const gftWorker = getWorkforceDb().workers.find((w) => w.contractorId === 'CONT-0007' && w.status === WorkerStatus.Active);
if (gftWorker) {
  try { actions.deployWorker(gftWorker.id, { mineId: 'M-02' }); } catch (e) { deployErr = (e as Error).message; }
}
ok(deployErr.includes('suspended'), 'suspended contractor blocks new deployments');
actions.setContractorStatus('CONT-0007', ContractorStatus.Active);

const inactiveW = getWorkforceDb().workers.find((w) => w.status === WorkerStatus.Inactive)!;
let inactiveErr = '';
try { actions.deployWorker(inactiveW.id, { mineId: 'M-01' }); } catch (e) { inactiveErr = (e as Error).message; }
ok(inactiveErr.includes('cannot be deployed'), 'inactive worker cannot be deployed');

// ---------- Transfer workflow ----------
section('8. Transfer request workflow');
const tId = actions.createTransfer({ workerId: 'WORK-0010', toMineId: 'M-03', toDepartment: 'Mining', reason: 'Skill matched to a vacancy.' });
const beforeMine = getWorkforceDb().workers.find((w) => w.id === 'WORK-0010')!.mineId;
ok(getWorkforceDb().transfers.find((t) => t.id === tId)?.status === TransferStatus.Pending, 'transfer starts Pending');
ok(getWorkforceDb().workers.find((w) => w.id === 'WORK-0010')!.mineId === beforeMine, 'requesting a transfer does NOT move the worker');
actions.decideTransfer(tId, 'approve');
ok(getWorkforceDb().workers.find((w) => w.id === 'WORK-0010')!.mineId === 'M-03', 'approving the transfer reassigns the worker');
ok(getWorkforceDb().transfers.find((t) => t.id === tId)?.status === TransferStatus.Approved, 'transfer marked Approved');

// ---------- Training workflow ----------
section('9. Training workflow');
const expired = getWorkforceDb().training.find((t) => trainingStatusOf(t) === 'Expired')!;
let verifyErr = '';
try { actions.verifyTraining(expired.id); } catch (e) { verifyErr = (e as Error).message; }
ok(verifyErr.includes('expired'), 'expired certification cannot be verified');
actions.renewTraining(expired.id);
ok(trainingStatusOf(getWorkforceDb().training.find((t) => t.id === expired.id)!) === 'Valid', 'renewed certification becomes Valid');

// ---------- Bills ----------
section('10. Bill workflow');
const bId = actions.submitBill({ contractId: 'CT-BCM-001', mineId: 'M-01', workPeriod: '01 Oct 2026 – 03 Oct 2026', amount: 123456, description: 'Test claim' });
ok(getWorkforceDb().bills.find((b) => b.id === bId)?.status === BillStatus.Pending, 'submitted bill is Pending');
ok(computeKpis(getWorkforceDb()).pendingAmount === 680000 + 123456, 'pending KPI updated after bill submission');
let ackErr = '';
try { actions.acknowledgeBill(bId); } catch (e) { ackErr = (e as Error).message; }
ok(ackErr.includes('not yet been decided'), 'contractor cannot acknowledge an undecided bill');
actions.withdrawBill(bId);
ok(!getWorkforceDb().bills.some((b) => b.id === bId), 'pending bill withdrawn');

// ---------- Incidents / corrective actions ----------
section('11. Compliance workflow');
const incId = actions.createIncident({ workerId: null, contractorId: 'DEMO-CONT-001', mineId: 'M-01', category: 'Missing Documents', severity: Severity.High, description: 'Test incident', inspector: 'S. Chandra' });
ok(getWorkforceDb().incidents.find((i) => i.id === incId)?.status === IncidentStatus.Open, 'incident starts Open');
let permErr = '';
try { actions.setIncidentStatus(incId, IncidentStatus.Resolved, 'note'); } catch (e) { permErr = (e as Error).message; }
ok(permErr.includes('demo role'), 'contractor Project Manager cannot resolve incidents (inspector duty)');
const caId = actions.createCorrectiveAction(incId, { description: 'Upload the lapsed document', assignedTo: 'Eastern Mining Services Pvt. Ltd.', dueDate: '2026-10-20' });
let submitErr = '';
try { actions.updateCorrectiveAction(caId, { submit: true }); } catch (e) { submitErr = (e as Error).message; }
ok(submitErr.includes('evidence'), 'cannot submit a corrective action without evidence');
actions.updateCorrectiveAction(caId, { note: 'Document uploaded', evidenceRef: 'gst-2026.pdf', submit: true });
ok(getWorkforceDb().correctiveActions.find((c) => c.id === caId)?.status === 'Submitted', 'corrective action submitted');
ok(getWorkforceDb().incidents.find((i) => i.id === incId)?.status === IncidentStatus.ActionRequired, 'incident moved to Action Required');
actions.setRole('Inspector');
let resErr = '';
try { actions.setIncidentStatus(incId, IncidentStatus.Resolved); } catch (e) { resErr = (e as Error).message; }
ok(resErr.includes('resolution note'), 'resolving requires a resolution note');
actions.setIncidentStatus(incId, IncidentStatus.Resolved, 'Document verified — incident closed.');
ok(getWorkforceDb().incidents.find((i) => i.id === incId)?.status === IncidentStatus.Resolved, 'inspector resolved the incident');
actions.reviewCorrectiveAction(caId, true, 'Evidence satisfactory.');
ok(getWorkforceDb().correctiveActions.find((c) => c.id === caId)?.status === 'Approved', 'inspector approved the corrective action');
actions.setRole('Project Manager');

// ---------- Documents ----------
section('12. Document upload + expiry derivation');
const dId = actions.uploadDocument({ name: 'test-doc.pdf', category: 'Statutory Compliance', relatedType: 'statutory', relatedId: 'DEMO-CONT-001', mineId: 'M-01', expiryDate: '2026-11-01', sizeKb: 240 });
const dRec = getWorkforceDb().documents.find((d) => d.id === dId)!;
ok(dRec.expiryDate === '2026-11-01', 'document stored with expiry');
ok(computeKpis(getWorkforceDb()).docsExpiring === 19, 'expiring-document KPI updated (29 days out)');

// ---------- Attendance / access ----------
section('13. Attendance + access decisions');
const target = getWorkforceDb().workers[3];
actions.markAttendance(target.id, AttendanceStatus.Absent, true);
const rec = getWorkforceDb().attendance.find((a) => a.workerId === target.id)!;
ok(rec.status === AttendanceStatus.Absent && rec.method === 'Manual', 'attendance marked (labelled Manual)');
const accessRec = getWorkforceDb().access.find((a) => a.workerId === target.id && a.timestamp.startsWith('2026-10-03'));
if (accessRec) {
  actions.decideAccess(accessRec.id, AccessStatus.Revoked, 'Contract suspended for non-payment.');
  ok(getWorkforceDb().access.find((a) => a.id === accessRec.id)?.status === AccessStatus.Revoked, 'access decision persisted');
}

// ---------- Trend ----------
section('14. Attendance trend (derived, no storage bloat)');
const trend = attendanceTrend(getWorkforceDb(), 30, 'ALL');
ok(trend.length === 30, '30-day series returned');
ok(trend[29].label === '2026-10-03', 'series ends on the demo day');
ok(trend[29].present === computeKpis(getWorkforceDb()).presentToday, 'today\'s series point matches the live KPI');

// ---------- Reset ----------
section('15. Demo reset');
actions.resetDemo();
const fresh = getWorkforceDb();
ok(fresh.workers.length === 482, 'reset restores 482 workers');
ok(fresh.bills.length === 12, 'reset restores 12 bills');
ok(fresh.selectedMineId === 'ALL', 'reset clears the mine selection');
ok(fresh.role === 'Project Manager', 'reset restores the default demo role');

// ---------- Training status sanity ----------
section('16. Training status derivation');
const byT = indexTraining(fresh);
const worsts = fresh.workers.map((w) => worstTraining(byT.get(w.id)));
const mandatoryExpired = fresh.workers.filter((w) => {
  const m = byT.get(w.id)?.find((r) => r.mandatory);
  return m && trainingStatusOf(m) === 'Expired';
}).length;
const mandatoryExpiring = fresh.workers.filter((w) => {
  const m = byT.get(w.id)?.find((r) => r.mandatory);
  return m && trainingStatusOf(m) === 'Expiring Soon';
}).length;
ok(mandatoryExpired === 25, `25 workers with an expired MANDATORY induction (got ${mandatoryExpired})`);
ok(mandatoryExpiring === 25, `25 workers with an expiring MANDATORY induction (got ${mandatoryExpiring})`);
ok(worsts.filter((x) => x === 'Expired').length >= mandatoryExpired, 'any-cert expired count includes the mandatory ones');
ok(worsts.filter((x) => x === 'Expiring Soon').length >= mandatoryExpiring, 'any-cert expiring count includes the mandatory ones');
ok(worsts.every((x) => x !== 'No Training'), 'every worker has at least one training record');
// KPI must be the mandatory figure, not the looser any-cert figure.
ok(computeKpis(fresh).trainingExpiring === mandatoryExpiring, 'training-expiring KPI tracks the mandatory certification');

section('17. Leave decisions + gate pass workflow (real store actions)');
actions.setRole('Project Manager');
const freshDb = getWorkforceDb();

const pendingLeave = freshDb.leaves.find((l) => l.status === 'Pending');
ok(!!pendingLeave, 'the seeded leave register contains a pending request');
if (pendingLeave) {
  actions.decideLeave(pendingLeave.id, 'approve');
  ok(getWorkforceDb().leaves.find((l) => l.id === pendingLeave.id)!.status === 'Approved',
    'leave approved in the store (not local page state)');
  actions.decideLeave(pendingLeave.id, 'cancel');
  ok(getWorkforceDb().leaves.find((l) => l.id === pendingLeave.id)!.status === 'Cancelled',
    'approved leave cancelled in the store');
}

let nonPendingErr = '';
const notPending = freshDb.leaves.find((l) => l.status !== 'Pending');
if (notPending) {
  try { actions.decideLeave(notPending.id, 'reject'); } catch (e) { nonPendingErr = (e as Error).message; }
}
ok(nonPendingErr.includes('pending'), `only pending requests can be rejected (got "${nonPendingErr}")`);

const activePass = freshDb.gatePasses.find((g) => g.status === 'Issued');
ok(!!activePass, 'the seeded gate-pass register contains an active pass');
ok(getWorkforceDb().gatePasses.some((g) => g.status === 'Expired'),
  'an expired gate pass exists so the "no longer editable" rule is reachable');

// Permission enforcement sits inside the action, not only on the button.
actions.setRole('Read-Only Viewer');
let permGateErr = '';
try { actions.issueGatePass({ workerId: freshDb.workers[0].id, vehicle: 'CG-12-AA-1010', purpose: 'Site Visit', validTill: '2026-10-10' }); }
catch (e) { permGateErr = (e as Error).message; }
ok(permGateErr.includes('demo role'), 'gate pass cannot be issued by a read-only viewer');
let permLeaveErr = '';
const touchLeave = freshDb.leaves.find((l) => l.status === 'Pending');
if (touchLeave) { try { actions.decideLeave(touchLeave.id, 'approve'); } catch (e) { permLeaveErr = (e as Error).message; } }
ok(!!touchLeave && permLeaveErr.includes('demo role'), 'leave cannot be decided by a read-only viewer');
actions.setRole('Project Manager');

const gpId = actions.issueGatePass({ workerId: freshDb.workers[0].id, vehicle: 'cg-12-ab-7788', purpose: 'Material Delivery', validTill: '2026-10-10' });
const gp = getWorkforceDb().gatePasses.find((g) => g.id === gpId);
ok(!!gp && gp.status === 'Issued', `gate pass ${gpId} persisted as Issued`);
ok(gp?.vehicle === 'CG-12-AB-7788', 'vehicle number normalized to upper case');
if (gp) {
  actions.setGatePassStatus(gp.id, 'Used');
  ok(getWorkforceDb().gatePasses.find((g) => g.id === gpId)!.status === 'Used', 'gate pass marked Used in the store');
}

let badTillErr = '';
try { actions.issueGatePass({ workerId: freshDb.workers[0].id, vehicle: 'CG-12-AB-9090', purpose: 'Site Visit', validTill: '2026-10-01' }); }
catch (e) { badTillErr = (e as Error).message; }
ok(badTillErr.length > 0, `impossible validity window rejected (got "${badTillErr}")`);

const auditBefore = getWorkforceDb().audit.length;
const leaveToTouch = getWorkforceDb().leaves.find((l) => l.status === 'Pending');
if (leaveToTouch) actions.decideLeave(leaveToTouch.id, 'approve');
ok(getWorkforceDb().audit.length > auditBefore, 'leave decision appended to the audit log');
ok(getWorkforceDb().notifications.some((n) => n.title === 'Leave approved' && n.href?.includes('attendance')),
  'leave decision raised a notification with the attendance deep link');

void DocumentStatus;

console.log(`\n${'='.repeat(50)}\nRESULT: ${pass} passed, ${fail} failed\n${'='.repeat(50)}`);
if (fail > 0) process.exit(1);
