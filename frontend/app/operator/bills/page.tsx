'use client';
/**
 * Page 7 — Bills & Transactions.
 * Workflow 4 lives here: Approve Bill updates the bill row, the pending/approved
 * KPIs, the status donut and the payment summary — all derived from the store.
 */
import { useMemo, useState } from 'react';
import { AlertOctagon, CheckCircle2, FileText, IndianRupee, Plus, Receipt, Wallet, XCircle } from 'lucide-react';
import OperationsShell from '../../../components/operations/OperationsShell';
import { operatorNav } from '../nav';
import {
  Column, ConfirmDialog, DataTable, DetailDrawer, EmptyState, Field, KpiCard, Kv,
  Modal, OpsBanner, QuickActions, SearchInput, SectionCard, StatusPill, Tabs, Toasts,
} from '../../../components/operations/ui';
import { Donut, HBarRows, TrendBars } from '../../../components/operations/charts';
import { CHART, TODAY, byMine, hrefWithTab, useMineScope, usePageReady, useTab } from '../../../components/operations/hooks';
import { actions, billPaid, getContractor, getMine, useMockOps } from '../../../lib/ops/store';
import { fmtDate, inr, inrShort, num, pct } from '../../../lib/ops/format';
import { exportCsv } from '../../../lib/ops/export';
import { BillApprovalStatus, BillType, PaymentStatus, type Bill } from '../../../lib/ops/types';

const TABS = ['Overview', 'Contractor Bills', 'Mine Operator Expenses', 'Payments & Transactions', 'Work Order Billing', 'Bill Verification', 'Audit Trail'];

const BILL_TONE: Record<string, string> = {
  [BillApprovalStatus.Approved]: 'bg-green-100 text-green-700',
  [BillApprovalStatus.Pending]: 'bg-amber-100 text-amber-700',
  [BillApprovalStatus.Rejected]: 'bg-red-100 text-red-600',
  [BillApprovalStatus.UnderReview]: 'bg-blue-100 text-blue-700',
};

const PAY_TONE: Record<string, string> = {
  [PaymentStatus.Paid]: 'bg-green-100 text-green-700',
  [PaymentStatus.PartiallyPaid]: 'bg-amber-100 text-amber-700',
  [PaymentStatus.Unpaid]: 'bg-red-100 text-red-600',
};

export default function BillsPage() {
  const ready = usePageReady();
  const db = useMockOps();
  const mineId = useMineScope();
  const [tab, setTab] = useTab(TABS[0]);

  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');
  const [fCtr, setFCtr] = useState('All Contractors');
  const [fStatus, setFStatus] = useState('All Status');
  const [fType, setFType] = useState('All Types');
  const [selected, setSelected] = useState<string[]>([]);
  const [detail, setDetail] = useState<Bill | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [approveFor, setApproveFor] = useState<Bill | null>(null);
  const [rejectFor, setRejectFor] = useState<Bill | null>(null);
  const [payFor, setPayFor] = useState<Bill | null>(null);

  const scopedBills = useMemo(() => byMine(db.bills, mineId), [db.bills, mineId]);
  const scopedPayments = useMemo(() => {
    const ids = new Set(scopedBills.map((b) => b.id));
    return db.payments.filter((p) => ids.has(p.billId));
  }, [db.payments, scopedBills]);

  // ---- KPIs ----
  const k = useMemo(() => {
    const total = scopedBills.length;
    const totalAmount = scopedBills.reduce((s, b) => s + b.amount + b.tax, 0);
    const pending = scopedBills.filter((b) => b.approvalStatus === BillApprovalStatus.Pending);
    const approved = scopedBills.filter((b) => b.approvalStatus === BillApprovalStatus.Approved);
    const rejected = scopedBills.filter((b) => b.approvalStatus === BillApprovalStatus.Rejected);
    const underReview = scopedBills.filter((b) => b.approvalStatus === BillApprovalStatus.UnderReview);
    return {
      total, totalAmount, pendingCount: pending.length,
      pendingAmount: pending.reduce((s, b) => s + b.amount + b.tax, 0),
      approvedCount: approved.length,
      approvedAmount: approved.reduce((s, b) => s + b.amount + b.tax, 0),
      rejectedCount: rejected.length,
      rejectedAmount: rejected.reduce((s, b) => s + b.amount + b.tax, 0),
      underReviewCount: underReview.length,
    };
  }, [scopedBills]);

  // ---- Monthly trend ----
  const months = useMemo(() => {
    const out: { label: string; amount: number; count: number }[] = [];
    const now = new Date('2026-10-01T00:00:00+05:30');
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now); d.setMonth(d.getMonth() - i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const bills = scopedBills.filter((b) => b.invoiceDate.startsWith(iso));
      out.push({ label: d.toLocaleString('en', { month: 'short' }), amount: bills.reduce((s, b) => s + b.amount + b.tax, 0) / 1e7, count: bills.length });
    }
    return out;
  }, [scopedBills]);

  const statusDonut = useMemo(() => {
    const c = (s: BillApprovalStatus) => scopedBills.filter((b) => b.approvalStatus === s).length;
    return [
      { name: 'Approved', value: c(BillApprovalStatus.Approved), color: '#159B72' },
      { name: 'Pending', value: c(BillApprovalStatus.Pending), color: '#E8A02B' },
      { name: 'Rejected', value: c(BillApprovalStatus.Rejected), color: '#DC4C58' },
      { name: 'Under Review', value: c(BillApprovalStatus.UnderReview), color: '#1463D9' },
    ].filter((s) => s.value > 0);
  }, [scopedBills]);

  const payDonut = useMemo(() => {
    const approved = scopedBills.filter((b) => b.approvalStatus === BillApprovalStatus.Approved);
    const totalApproved = approved.reduce((s, b) => s + b.amount + b.tax, 0);
    const paidAmt = approved.reduce((s, b) => s + billPaid(b, db), 0);
    const partialAmt = approved.filter((b) => b.paymentStatus === PaymentStatus.PartiallyPaid).reduce((s, b) => s + billPaid(b, db), 0);
    const unpaidAmt = approved.filter((b) => b.paymentStatus === PaymentStatus.Unpaid).reduce((s, b) => s + b.amount + b.tax, 0);
    const data = [
      { name: 'Paid', value: paidAmt - partialAmt, color: '#159B72' },
      { name: 'Partially Paid', value: partialAmt, color: '#E8A02B' },
      { name: 'Pending Payment', value: unpaidAmt, color: '#DC4C58' },
    ].filter((s) => s.value > 0);
    return { data, totalApproved };
  }, [scopedBills, db]);

  const topCtrs = useMemo(() => {
    const m = new Map<string, number>();
    scopedBills.forEach((b) => m.set(b.contractorId, (m.get(b.contractorId) ?? 0) + b.amount + b.tax));
    return [...m.entries()].map(([id, value]) => ({ name: getContractor(id)?.name ?? id, value })).sort((a, b) => b.value - a.value).slice(0, 5);
  }, [scopedBills]);

  // ---- Filtering ----
  const filtered = useMemo(() => {
    const term = dq.trim().toLowerCase();
    return scopedBills.filter((b) =>
      (!term || `${b.id} ${getContractor(b.contractorId)?.name} ${b.description} ${b.workOrderId ?? ''}`.toLowerCase().includes(term)) &&
      (fCtr === 'All Contractors' || getContractor(b.contractorId)?.name === fCtr) &&
      (fStatus === 'All Status' || b.approvalStatus === fStatus) &&
      (fType === 'All Types' || b.type === fType));
  }, [scopedBills, dq, fCtr, fStatus, fType]);

  const ctrList = useMemo(() => ['All Contractors', ...new Set(scopedBills.map((b) => getContractor(b.contractorId)?.name ?? ''))], [scopedBills]);
  const statusList = ['All Status', BillApprovalStatus.Approved, BillApprovalStatus.Pending, BillApprovalStatus.Rejected, BillApprovalStatus.UnderReview];
  const typeList = useMemo(() => ['All Types', ...new Set(scopedBills.map((b) => b.type))], [scopedBills]);

  function exportBills() {
    exportCsv(`bills-${mineId === 'ALL' ? 'all-mines' : getMine(mineId)?.code ?? mineId}-${TODAY}`, filtered,
      [['Bill No.', (b: Bill) => b.id], ['Contractor', (b) => getContractor(b.contractorId)?.name], ['Type', (b) => b.type],
      ['Period', (b) => `${b.periodFrom} – ${b.periodTo}`], ['Amount', (b) => b.amount], ['Tax', (b) => b.tax],
      ['Approval', (b) => b.approvalStatus], ['Payment', (b) => b.paymentStatus]]);
  }

  const billCols: Column<Bill>[] = [
    { key: 'id', header: 'Bill No.', render: (b) => <span className="font-mono font-bold text-blue-700">{b.id}</span>, sortValue: (b) => b.id },
    { key: 'ctr', header: 'Contractor', render: (b) => <span className="font-semibold text-navy">{getContractor(b.contractorId)?.name ?? b.contractorId}</span>, sortValue: (b) => getContractor(b.contractorId)?.name ?? '' },
    { key: 'wo', header: 'Work Order', render: (b) => b.workOrderId ? <span className="font-mono text-[12px] text-blue-600">{b.workOrderId}</span> : <span className="text-slate-400">—</span> },
    { key: 'type', header: 'Type', render: (b) => <span className="text-slate-600">{b.type}</span>, sortValue: (b) => b.type },
    { key: 'period', header: 'Period', render: (b) => <span className="text-[12px]">{fmtDate(b.periodFrom)} – {fmtDate(b.periodTo)}</span>, sortValue: (b) => b.periodFrom },
    { key: 'amt', header: 'Amount', render: (b) => <span className="font-bold">{inr(b.amount + b.tax)}</span>, sortValue: (b) => b.amount + b.tax },
    { key: 'appr', header: 'Approval', render: (b) => <span className={`badge ${BILL_TONE[b.approvalStatus]}`}>● {b.approvalStatus}</span>, sortValue: (b) => b.approvalStatus },
    { key: 'pay', header: 'Payment', render: (b) => <span className={`badge ${PAY_TONE[b.paymentStatus]}`}>● {b.paymentStatus}</span>, sortValue: (b) => b.paymentStatus },
  ];

  return (
    <OperationsShell nav={operatorNav} title="Bills & Transactions" sub="Contractor billing and payments">
      <OpsBanner title="Bills & Transactions" sub="Manage contractor bills, work order payments, fuel and service expenses, and track all financial transactions related to mine operations." />
      <div className="px-4 space-y-4">
        {!ready ? (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">{[...Array(5)].map((_, i) => <div key={i} className="card !p-4 animate-pulse"><div className="h-16 bg-slate-100 rounded-xl" /></div>)}</div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <KpiCard icon={<FileText size={22} />} label="Total Bills" value={num(k.total)} trend="+12%" context="This financial year" tileClass="bg-blue-50 text-blue-600" />
              <KpiCard icon={<IndianRupee size={22} />} label="Total Amount" value={inrShort(k.totalAmount)} trend="+8%" context="Approved + Pending" dotColor="#159B72" tileClass="bg-green-50 text-green-600" />
              <KpiCard icon={<AlertOctagon size={22} />} label="Pending Approval" value={num(k.pendingCount)} context={inrShort(k.pendingAmount)} dotColor="#E8A02B" tileClass="bg-amber-50 text-amber-600" />
              <KpiCard icon={<CheckCircle2 size={22} />} label="Approved Bills" value={num(k.approvedCount)} context={inrShort(k.approvedAmount)} dotColor="#159B72" tileClass="bg-green-50 text-green-600" />
              <KpiCard icon={<XCircle size={22} />} label="Rejected Bills" value={num(k.rejectedCount)} context={inrShort(k.rejectedAmount)} dotColor={k.rejectedCount > 0 ? '#DC4C58' : '#94a3b8'} tileClass="bg-red-50 text-red-500" />
            </div>

            <SectionCard className="!p-0 !pb-4" title="" action={null}>
              <div className="px-4 -mt-1"><Tabs tabs={TABS} active={tab} onChange={setTab} /></div>
            </SectionCard>

            {tab === 'Overview' && (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <SectionCard className="xl:col-span-2" title="Monthly Bill Summary" subtitle="Amount in ₹ Cr (bars) and bill count (line)">
                  <TrendBars data={months} xKey="label" height={230}
                    bars={[{ key: 'amount', name: 'Amount (₹ Cr)', fill: '#1463D9' }]}
                    line={{ key: 'count', name: 'Number of Bills', stroke: '#159B72' }} />
                </SectionCard>
                <SectionCard title="Bill Status Distribution">
                  <Donut data={statusDonut} centerValue={num(k.total)} centerLabel="Total Bills" height={200} />
                </SectionCard>

                <SectionCard className="xl:col-span-2" title={`Recent Bills & Transactions (${filtered.length})`} action={
                  <div className="flex gap-2 flex-wrap items-center">
                    <SearchInput value={q} onChange={setQ} onSearch={() => setDq(q)} ph="Search bill no, contractor..." width="!w-48" />
                    <select className="input !w-44 !py-2 !text-[13px]" value={fCtr} onChange={(e) => setFCtr(e.target.value)} aria-label="Contractor filter">{ctrList.map((c) => <option key={c}>{c}</option>)}</select>
                    <select className="input !w-36 !py-2 !text-[13px]" value={fStatus} onChange={(e) => setFStatus(e.target.value)} aria-label="Status filter">{statusList.map((s) => <option key={s}>{s}</option>)}</select>
                    <select className="input !w-36 !py-2 !text-[13px]" value={fType} onChange={(e) => setFType(e.target.value)} aria-label="Type filter">{typeList.map((t) => <option key={t}>{t}</option>)}</select>
                    <button className="btn-primary !py-2" onClick={exportBills}>Export</button>
                    <button className="btn-primary !py-2" onClick={() => setAddOpen(true)}><span className="inline-flex items-center gap-1"><Plus size={14} /> Add Bill</span></button>
                  </div>}>
                  <DataTable<Bill> columns={billCols} rows={filtered} selectable onSelected={setSelected} onRowClick={setDetail}
                    emptyTitle="No bills match" emptyText="Adjust filters or create a new bill."
                    actions={(b) => <span className="space-x-2">
                      {b.approvalStatus === BillApprovalStatus.Pending && (
                        <>
                          <button className="text-xs font-bold text-green-600 hover:underline" onClick={() => setApproveFor(b)}>Approve</button>
                          <button className="text-xs font-bold text-red-500 hover:underline" onClick={() => setRejectFor(b)}>Reject</button>
                        </>
                      )}
                      {b.approvalStatus === BillApprovalStatus.Approved && b.paymentStatus !== PaymentStatus.Paid && (
                        <button className="text-xs font-bold text-blue-600 hover:underline" onClick={() => setPayFor(b)}>Pay</button>
                      )}
                    </span>} />
                </SectionCard>

                <div className="space-y-4">
                  <SectionCard title="Payment Status (Approved Bills)">
                    <Donut data={payDonut.data} centerValue={inrShort(payDonut.totalApproved)} centerLabel="Total Approved" height={180} />
                  </SectionCard>
                  <SectionCard title="Top Contractors by Bill Amount">
                    <HBarRows data={topCtrs.map((t) => ({ ...t, display: inrShort(t.value) }))} />
                  </SectionCard>
                  <SectionCard title="Quick Actions">
                    <QuickActions items={[
                      { label: 'Create New Bill', icon: <Plus size={15} />, tileClass: 'bg-blue-100 text-blue-600', onClick: () => setAddOpen(true) },
                      { label: 'Verify & Approve Bills', icon: <CheckCircle2 size={15} />, tileClass: 'bg-green-100 text-green-700', onClick: () => setTab('Bill Verification') },
                      { label: 'View Payment History', icon: <Wallet size={15} />, tileClass: 'bg-purple-100 text-purple-600', onClick: () => setTab('Payments & Transactions') },
                      { label: 'Export Transactions', icon: <Receipt size={15} />, tileClass: 'bg-amber-100 text-amber-700', onClick: exportBills },
                    ]} />
                  </SectionCard>
                </div>
              </div>
            )}

            {tab === 'Contractor Bills' && (
              <SectionCard title="Contractor Bills" subtitle="All bills grouped by contractor">
                <DataTable<Bill> columns={billCols} rows={filtered} selectable onSelected={setSelected} onRowClick={setDetail} actions={(b) => b.approvalStatus === BillApprovalStatus.Pending ? (
                  <button className="text-xs font-bold text-green-600 hover:underline" onClick={() => setApproveFor(b)}>Approve</button>
                ) : b.approvalStatus === BillApprovalStatus.Approved && b.paymentStatus !== PaymentStatus.Paid ? (
                  <button className="text-xs font-bold text-blue-600 hover:underline" onClick={() => setPayFor(b)}>Pay</button>
                ) : null} />
              </SectionCard>
            )}

            {tab === 'Mine Operator Expenses' && (
              <SectionCard title="Mine Operator Expenses" subtitle="Direct mine (non-contractor) bills and expenses">
                {(() => {
                  const directBills = scopedBills.filter((b) => !getContractor(b.contractorId));
                  return directBills.length === 0 ? <EmptyState title="No direct expenses" sub="All current bills are contractor bills." /> : (
                    <DataTable<Bill> columns={billCols} rows={directBills} onRowClick={setDetail} />
                  );
                })()}
              </SectionCard>
            )}

            {tab === 'Payments & Transactions' && (
              <PaymentsTab payments={scopedPayments} bills={scopedBills} />
            )}

            {tab === 'Work Order Billing' && (
              <WorkOrderBillingTab bills={scopedBills} />
            )}

            {tab === 'Bill Verification' && (
              <BillVerificationTab bills={scopedBills.filter((b) => b.approvalStatus === BillApprovalStatus.Pending || b.approvalStatus === BillApprovalStatus.UnderReview)}
                onApprove={(b) => setApproveFor(b)} onReject={(b) => setRejectFor(b)}
                onReview={(b) => { try { actions.requestBillCorrection(b.id, 'Correction requested from Bill Verification'); } catch (e: any) { alert(e.message); } }} />
            )}

            {tab === 'Audit Trail' && (
              <SectionCard title="Bill Audit Trail" subtitle="All bill-related actions from the audit log">
                <DataTable<{ id: string; timestamp: string; action: string; resource: string; details: string; user: string }> columns={[
                  { key: 't', header: 'Time', render: (a) => <span className="text-[12px]">{fmtDate(a.timestamp.slice(0, 10))} {a.timestamp.slice(11, 16)}</span>, sortValue: (a) => a.timestamp },
                  { key: 'a', header: 'Action', render: (a) => <span className={`badge ${a.action.includes('Approved') ? 'bg-green-100 text-green-700' : a.action.includes('Rejected') ? 'bg-red-100 text-red-600' : a.action.includes('Payment') ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>{a.action}</span>, sortValue: (a) => a.action },
                  { key: 'r', header: 'Resource', render: (a) => <span className="font-mono text-[12px] font-bold">{a.resource}</span> },
                  { key: 'd', header: 'Details', render: (a) => <span className="text-[12px] text-slate-600">{a.details}</span> },
                  { key: 'u', header: 'User', render: (a) => <span className="text-[12px]">{a.user}</span> },
                ]} rows={db.audit.filter((a) => a.module === 'Bills').map((a) => ({ id: a.id, timestamp: a.timestamp, action: a.action, resource: a.resource, details: a.details, user: a.user }))} initialSize={15} />
              </SectionCard>
            )}
          </>
        )}
      </div>

      {/* ---- Detail Drawer ---- */}
      {detail && (
        <DetailDrawer title={`Bill ${detail.id}`} onClose={() => setDetail(null)}>
          <Kv k="Contractor" v={getContractor(detail.contractorId)?.name ?? 'Direct'} />
          <Kv k="Work Order" v={detail.workOrderId ?? <span className="text-slate-400">—</span>} />
          <Kv k="Type" v={detail.type} />
          <Kv k="Period" v={`${fmtDate(detail.periodFrom)} – ${fmtDate(detail.periodTo)}`} />
          <Kv k="Description" v={detail.description} />
          <Kv k="Amount" v={inr(detail.amount)} />
          <Kv k="Tax (18%)" v={inr(detail.tax)} />
          <Kv k="Total" v={<span className="font-bold">{inr(detail.amount + detail.tax)}</span>} />
          <Kv k="Approval" v={<span className={`badge ${BILL_TONE[detail.approvalStatus]}`}>● {detail.approvalStatus}</span>} />
          <Kv k="Payment" v={<span className={`badge ${PAY_TONE[detail.paymentStatus]}`}>● {detail.paymentStatus}</span>} />
          <Kv k="Paid so far" v={inr(billPaid(detail, db))} />
          <Kv k="Outstanding" v={inr(detail.amount + detail.tax - billPaid(detail, db))} />
          <Kv k="Notes" v={detail.notes || <span className="text-slate-400">—</span>} />
          <h4 className="font-extrabold text-navy mt-4 mb-1 text-sm">Payment History</h4>
          {db.payments.filter((p) => p.billId === detail.id).length === 0 ? (
            <div className="text-[13px] text-slate-500">No payments recorded.</div>
          ) : db.payments.filter((p) => p.billId === detail.id).map((p) => (
            <div key={p.id} className="text-[12px] py-1 border-b border-slate-50 last:border-0 flex justify-between">
              <span className="font-mono">{p.id} · {fmtDate(p.date)}</span>
              <span className="font-bold">{inr(p.amount)} · {p.mode}</span>
            </div>
          ))}
          <div className="flex gap-2 mt-4">
            {detail.approvalStatus === BillApprovalStatus.Pending && (
              <>
                <button className="btn-primary !py-2 !text-xs" onClick={() => { setApproveFor(detail); }}>Approve</button>
                <button className="btn-primary !py-2 !text-xs !bg-white !text-red-500 border border-red-300" onClick={() => { setRejectFor(detail); }}>Reject</button>
              </>
            )}
            {detail.approvalStatus === BillApprovalStatus.Approved && detail.paymentStatus !== PaymentStatus.Paid && (
              <button className="btn-primary !py-2 !text-xs" onClick={() => setPayFor(detail)}>Record Payment</button>
            )}
          </div>
        </DetailDrawer>
      )}

      {/* ---- Modals ---- */}
      {addOpen && <AddBillModal mineId={mineId} onClose={() => setAddOpen(false)} />}
      {approveFor && (
        <ConfirmDialog title={`Approve bill ${approveFor.id}?`}
          body={`${getContractor(approveFor.contractorId)?.name ?? 'Direct'} — ${inr(approveFor.amount + approveFor.tax)}. Approving makes the bill eligible for payment.`}
          confirmLabel="Approve Bill"
          onConfirm={() => { actions.approveBill(approveFor.id); setApproveFor(null); setDetail(null); }}
          onCancel={() => setApproveFor(null)} />
      )}
      {rejectFor && <RejectBillModal bill={rejectFor} onClose={() => setRejectFor(null)} />}
      {payFor && <PayModal bill={payFor} onClose={() => setPayFor(null)} />}
      <Toasts />
    </OperationsShell>
  );
}

// ---------- Sub-tabs ----------
function PaymentsTab({ payments, bills }: { payments: { id: string; billId: string; amount: number; date: string; mode: string; reference: string }[]; bills: Bill[] }) {
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
  return (
    <SectionCard title={`Payments & Transactions (${payments.length})`} subtitle={`Total paid: ${inr(totalPaid)}`}>
      <DataTable<{ id: string; billId: string; amount: number; date: string; mode: string; reference: string }> columns={[
        { key: 'id', header: 'Payment ID', render: (p) => <span className="font-mono font-bold">{p.id}</span>, sortValue: (p) => p.id },
        { key: 'bill', header: 'Bill', render: (p) => <span className="font-mono text-[12px] text-blue-600">{p.billId}</span> },
        { key: 'amt', header: 'Amount', render: (p) => <span className="font-bold">{inr(p.amount)}</span>, sortValue: (p) => p.amount },
        { key: 'date', header: 'Date', render: (p) => <span className="text-[12px]">{fmtDate(p.date)}</span>, sortValue: (p) => p.date },
        { key: 'mode', header: 'Mode', render: (p) => <span className="badge bg-slate-100 text-slate-600">{p.mode}</span> },
        { key: 'ref', header: 'Reference', render: (p) => <span className="font-mono text-[12px]">{p.reference}</span> },
      ]} rows={payments} initialSize={10} />
    </SectionCard>
  );
}

function WorkOrderBillingTab({ bills }: { bills: Bill[] }) {
  const woBills = useMemo(() => bills.filter((b) => b.workOrderId), [bills]);
  const totalWo = woBills.reduce((s, b) => s + b.amount + b.tax, 0);
  return (
    <SectionCard title={`Work Order Billing (${woBills.length})`} subtitle={`Total: ${inr(totalWo)}`}>
      <DataTable<Bill> columns={[
        { key: 'id', header: 'Bill No.', render: (b) => <span className="font-mono font-bold text-blue-700">{b.id}</span>, sortValue: (b) => b.id },
        { key: 'wo', header: 'Work Order', render: (b) => <span className="font-mono text-[12px]">{b.workOrderId}</span> },
        { key: 'ctr', header: 'Contractor', render: (b) => getContractor(b.contractorId)?.name ?? b.contractorId },
        { key: 'amt', header: 'Amount', render: (b) => <span className="font-bold">{inr(b.amount + b.tax)}</span>, sortValue: (b) => b.amount },
        { key: 'ap', header: 'Approval', render: (b) => <StatusPill v={b.approvalStatus} />, sortValue: (b) => b.approvalStatus },
        { key: 'ps', header: 'Payment', render: (b) => <StatusPill v={b.paymentStatus} />, sortValue: (b) => b.paymentStatus },
      ]} rows={woBills} initialSize={10} />
    </SectionCard>
  );
}

function BillVerificationTab({ bills, onApprove, onReject, onReview }: { bills: Bill[]; onApprove: (b: Bill) => void; onReject: (b: Bill) => void; onReview: (b: Bill) => void }) {
  return (
    <SectionCard title="Bill Verification Queue" subtitle="Bills awaiting approval or under review">
      {bills.length === 0 ? <EmptyState title="No bills to verify" sub="All bills have been approved or rejected." /> : (
        <DataTable<Bill> columns={[
          { key: 'id', header: 'Bill No.', render: (b) => <span className="font-mono font-bold">{b.id}</span>, sortValue: (b) => b.id },
          { key: 'ctr', header: 'Contractor', render: (b) => <span className="font-semibold">{getContractor(b.contractorId)?.name}</span> },
          { key: 'desc', header: 'Description', render: (b) => <span className="text-[12px]">{b.description}</span> },
          { key: 'amt', header: 'Amount', render: (b) => <span className="font-bold">{inr(b.amount + b.tax)}</span>, sortValue: (b) => b.amount },
          { key: 'st', header: 'Status', render: (b) => <span className={`badge ${BILL_TONE[b.approvalStatus]}`}>● {b.approvalStatus}</span> },
          { key: 'a', header: '', render: (b) => (
            <span className="space-x-2">
              {b.approvalStatus === BillApprovalStatus.Pending && (
                <>
                  <button className="text-xs font-bold text-green-600 hover:underline" onClick={() => onApprove(b)}>Approve</button>
                  <button className="text-xs font-bold text-red-500 hover:underline" onClick={() => onReject(b)}>Reject</button>
                </>
              )}
              <button className="text-xs font-bold text-blue-600 hover:underline" onClick={() => onReview(b)}>Request Correction</button>
            </span> ) },
        ]} rows={bills} initialSize={10} />
      )}
    </SectionCard>
  );
}

// ---------- Sub-modal forms ----------
function AddBillModal({ mineId, onClose }: { mineId: string; onClose: () => void }) {
  const db = useMockOps();
  const scope = mineId === 'ALL' ? 'M-01' : mineId;
  const [f, setF] = useState({
    contractorId: db.contractors[0]?.id ?? '', workOrderId: null as string | null,
    type: BillType.WorkOrder as string, invoiceDate: TODAY, periodFrom: '2026-09-01', periodTo: TODAY,
    description: '', amount: '', tax: '0', notes: '',
  });
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const ctrWos = db.workOrders.filter((w) => w.contractorId === f.contractorId);

  function submit() {
    const e: Record<string, string> = {};
    if (!f.description.trim()) e.description = 'Description is required.';
    if (!(Number(f.amount) > 0)) e.amount = 'Amount must be greater than 0.';
    if (Number(f.tax) < 0) e.tax = 'Tax cannot be negative.';
    if (new Date(f.periodTo) < new Date(f.periodFrom)) e.periodTo = 'Period end must be on/after start.';
    setErr(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      actions.createBill({ contractorId: f.contractorId, workOrderId: f.workOrderId, mineId: scope, type: f.type as never, invoiceDate: f.invoiceDate, periodFrom: f.periodFrom, periodTo: f.periodTo, description: f.description.trim(), amount: Number(f.amount), tax: Number(f.tax), notes: f.notes, supportingDocs: [] });
      onClose();
    } catch (ex: any) { setErr({ form: ex.message }); } finally { setBusy(false); }
  }

  return (
    <Modal title="Create Bill" onClose={onClose}>
      {err.form && <div className="text-[12px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-2" role="alert">{err.form}</div>}
      <Field label="Contractor *" error={err.contractorId}>
        <select className="input" value={f.contractorId} onChange={(e) => setF({ ...f, contractorId: e.target.value, workOrderId: null })}>
          {db.contractors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <Field label="Work Order (optional)">
        <select className="input" value={f.workOrderId ?? ''} onChange={(e) => setF({ ...f, workOrderId: e.target.value || null })}>
          <option value="">No work order</option>
          {ctrWos.map((w) => <option key={w.id} value={w.id}>{w.id} — {w.title}</option>)}
        </select>
      </Field>
      <div className="grid sm:grid-cols-2 gap-x-3">
        <Field label="Bill type">
          <select className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
            {Object.values(BillType).map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Invoice date"><input type="date" className="input" value={f.invoiceDate} onChange={(e) => setF({ ...f, invoiceDate: e.target.value })} /></Field>
        <Field label="Period from"><input type="date" className="input" value={f.periodFrom} onChange={(e) => setF({ ...f, periodFrom: e.target.value })} /></Field>
        <Field label="Period to" error={err.periodTo}><input type="date" className="input" value={f.periodTo} onChange={(e) => setF({ ...f, periodTo: e.target.value })} /></Field>
        <Field label="Amount (₹) *" error={err.amount}><input className="input" type="number" min={0} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
        <Field label="Tax (₹)" error={err.tax}><input className="input" type="number" min={0} value={f.tax} onChange={(e) => setF({ ...f, tax: e.target.value })} /></Field>
      </div>
      <Field label="Description *" error={err.description}><input className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="e.g. Overburden removal — September 2026" /></Field>
      <Field label="Notes"><textarea className="input" rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
      <div className="flex gap-2 justify-end">
        <button className="btn-primary !bg-white !text-navy border border-slate-300" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={submit} disabled={busy}>{busy ? 'Saving…' : 'Create Bill'}</button>
      </div>
    </Modal>
  );
}

function RejectBillModal({ bill, onClose }: { bill: Bill; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');
  return (
    <Modal title={`Reject bill ${bill.id}?`} onClose={onClose}>
      <p className="text-[12px] text-slate-600 mb-3">{getContractor(bill.contractorId)?.name} — {inr(bill.amount + bill.tax)}.</p>
      <Field label="Rejection reason *" error={err}>
        <textarea className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Quantity mismatch with work order records" />
      </Field>
      <div className="flex gap-2 justify-end">
        <button className="btn-primary !bg-white !text-navy border border-slate-300" onClick={onClose}>Cancel</button>
        <button className="btn-primary !bg-red-600 hover:!bg-red-700" onClick={() => {
          if (!reason.trim()) { setErr('A rejection reason is required.'); return; }
          actions.rejectBill(bill.id, reason.trim());
          onClose();
        }}>Reject Bill</button>
      </div>
    </Modal>
  );
}

function PayModal({ bill, onClose }: { bill: Bill; onClose: () => void }) {
  const db = useMockOps();
  const total = bill.amount + bill.tax;
  const paid = billPaid(bill, db);
  const outstanding = total - paid;
  const [amount, setAmount] = useState(String(outstanding.toFixed(0)));
  const [mode, setMode] = useState('Bank Transfer (demo)');
  const [err, setErr] = useState('');
  return (
    <Modal title={`Record Payment — ${bill.id}`} onClose={onClose}>
      <p className="text-[11px] text-slate-400 mb-3">Demo record only — no actual bank transfer occurs. Total: {inr(total)}, already paid: {inr(paid)}, outstanding: {inr(outstanding)}.</p>
      <Field label="Payment amount (₹) *" error={err}>
        <input className="input" type="number" min={1} max={outstanding} value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Field>
      <Field label="Payment mode">
        <select className="input" value={mode} onChange={(e) => setMode(e.target.value)}>
          {['Bank Transfer (demo)', 'Cheque (demo)', 'UPI (demo)'].map((m) => <option key={m}>{m}</option>)}
        </select>
      </Field>
      <div className="flex gap-2 justify-end">
        <button className="btn-primary !bg-white !text-navy border border-slate-300" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={() => {
          const amt = Number(amount);
          if (!(amt > 0)) { setErr('Enter a valid payment amount.'); return; }
          try { actions.recordPayment(bill.id, amt, mode); onClose(); } catch (e: any) { setErr(e.message); }
        }}>Record Payment</button>
      </div>
    </Modal>
  );
}
