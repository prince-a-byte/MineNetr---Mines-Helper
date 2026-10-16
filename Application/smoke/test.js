/** Node smoke test: exercises mock repository + services end-to-end.
 *  Native modules (AsyncStorage, SecureStore, .jpg assets) are stubbed.
 *  Run AFTER `npx tsc` emit (see runtest below). Fails loudly on any mismatch.
 */
const Module = require('module');
const path = require('path');
global.__DEV__ = true;

const mem = new Map();
const asyncStorageStub = {
  getItem: async (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: async (k, v) => { mem.set(k, v); },
  removeItem: async (k) => { mem.delete(k); },
};
const secureStub = {
  getItemAsync: async (k) => (mem.has('ss:' + k) ? mem.get('ss:' + k) : null),
  setItemAsync: async (k, v) => { mem.set('ss:' + k, v); },
  deleteItemAsync: async (k) => { mem.delete('ss:' + k); },
};

const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '@react-native-async-storage/async-storage') return { default: asyncStorageStub, ...asyncStorageStub };
  if (request === 'expo-secure-store') return secureStub;
  return origLoad.apply(this, arguments);
};
require.extensions['.jpg'] = (m) => { m.exports = 999; };

const BUILD = path.join(__dirname, '..', 'build-smoke');
const { mockRepo } = require(path.join(BUILD, 'repositories/mockStore.js'));
const { services } = require(path.join(BUILD, 'services/serviceProvider.js'));

let pass = 0;
function ok(cond, label) {
  if (!cond) { console.error('FAIL:', label); process.exit(1); }
  pass++;
  console.log('ok:', label);
}

(async () => {
  await mockRepo.ready();

  // auth
  const s = await services.auth.login('contractor@minenetr.demo', 'Demo@123', 'contractor');
  ok(s.role === 'contractor', 'contractor login');
  try { await services.auth.login('contractor@minenetr.demo', 'wrong', 'contractor'); ok(false, 'bad password rejected'); }
  catch (e) { ok(e.status === 401, 'bad password rejected'); }
  const otp = await services.auth.loginWithOtp('9876543210');
  ok(/X/.test(otp.maskedTo), 'otp masked identifier');
  const so = await services.auth.verifyOtp('9876543210', '123456', 'contractor');
  ok(!!so.token, 'otp verify (123456)');
  try { await services.auth.verifyOtp('9876543210', '000000', 'contractor'); ok(false, 'bad otp rejected'); }
  catch (e) { ok(true, 'bad otp rejected'); }
  const rst = await services.auth.requestPasswordReset('a@b.com');
  ok(/no real reset/i.test(rst.demoNote), 'reset is honest demo');

  // workers
  const w0 = await services.workers.listWorkers({}, 1, 200);
  ok(w0.total === 8, `seed has 8 workers (got ${w0.total})`);
  const created = await services.workers.createWorker({
    fullName: 'Test Mazdoor', aadhaar: '123412341234', dob: '1995-05-05', gender: 'Male',
    phone: '9811111111', mineId: 'm2', jobRole: 'Helper', joiningDate: '2026-02-01', employmentType: 'Contract',
  });
  ok(created.id === 'WK009', `worker id generated (${created.id})`);
  try {
    await services.workers.createWorker({ fullName: 'x', aadhaar: '1', dob: 'bad', gender: 'Male', phone: '1', mineId: 'm9', jobRole: '', joiningDate: 'x', employmentType: 'Contract' });
    ok(false, 'bad mine rejected');
  } catch (e) { ok(true, 'bad mine rejected'); }
  const moved = await services.workers.transferWorker('WK009', 'm3');
  ok(moved.mineId === 'm3', 'transfer updates mine');
  const sum1 = await services.mines.getMineSummary('m3');
  ok(sum1.total === 3, `m3 now has 3 workers (got ${sum1.total})`);
  await services.workers.updateWorkerStatus('WK009', 'Inactive');
  const w9 = await services.workers.getWorkerById('WK009');
  ok(w9.status === 'Inactive', 'status change persists');

  // documents: upload stays Pending, never auto-verified
  const doc = await services.documents.createDocumentMetadata({
    workerId: 'WK009', type: 'Medical Certificate', mineId: 'm3',
    issueDate: '2026-01-01', expiryDate: '2027-01-01', fileName: 'med.pdf', fileSize: 1024,
  });
  ok(doc.status === 'Pending', 'new upload is Pending (not verified)');
  const dl = await services.documents.listDocuments({ scope: 'all' }, 1, 500);
  ok(dl.total === 11, `11 docs total (got ${dl.total})`);

  // bills: submit -> Pending; totals stay consistent
  const before = await services.dashboard.summary();
  const bill = await services.bills.createBill({ mineId: 'm1', workType: 'Labor Charges', period: 'Feb 2026', amountInr: 100000 });
  ok(bill.status === 'Pending', 'new bill is Pending (not approved)');
  const after = await services.dashboard.summary();
  ok(after.totalBilledInr === before.totalBilledInr + 100000, 'dashboard total follows new bill');
  ok(after.pendingBills === before.pendingBills + 1, 'pending count follows');
  const found = await services.bills.listBills({ q: bill.id }, 1, 5);
  ok(found.total === 1 && found.items[0].id === bill.id, 'bill searchable immediately');
  const txns = await services.bills.listTransactions();
  ok(txns.length === 2, 'seed payments intact');

  // dashboard + company + notifications
  const dash = await services.dashboard.summary();
  ok(dash.totalWorkers === 9 && dash.assignedMines === 3, 'dashboard summary coherent');
  const co = await services.profile.getCompany();
  ok(co.mineIds.length === 3, 'company mines linked');
  await services.profile.updateCompany({ contactName: 'New Person' });
  const co2 = await services.profile.getCompany();
  ok(co2.contactName === 'New Person', 'profile edit persists');
  const n0 = await services.notifications.list();
  ok(n0.length >= 3, 'notifications seeded');
  await services.notifications.markAllRead();
  ok((await services.notifications.list()).every((n) => n.read), 'mark-all-read works');

  await services.auth.logout();
  console.log(`\nALL ${pass} CHECKS PASSED`);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
