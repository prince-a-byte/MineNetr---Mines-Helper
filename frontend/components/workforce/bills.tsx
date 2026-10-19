'use client';
/**
 * MineNetr contractor portal — Bills & Transactions (page 5 of the design reference).
 *
 * Everything derives from the centralized workforce repository:
 *  - the four KPI tiles come from computeKpis(db) (mine-scope aware),
 *  - the bill register, payment register, donut, recent transactions and the
 *    billed-vs-approved trend all read the same collections, so a mine change,
 *    tab change, filter, search or workflow action updates every view at once,
 *  - every mutation goes through `actions` (submit / withdraw / acknowledge),
 *    which validates, audits and toasts; failures surface inline, never alert().
 *
 * Domain rule (enforced by the store, stated in the UI): a submitted bill is
 * Pending — the mine commercial office approves or rejects it. The contractor
 * can never approve their own bill; they may only withdraw pending bills and
 * acknowledge decisions that were already taken.
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle, ArrowDown, ArrowRight, ArrowUp, Check, CheckCircle2, Download, Eye,
  FileText, Hourglass, Info, Plus, Send, ShieldCheck, Trash2, X, XCircle,
} from 'lucide-react';
import { ContractorShell } from './shell';
import {
  type Column, DataTable, DetailDrawer, Donut, EmptyState, Field, KpiCard,
  Kv, Modal, PageToolbar, PermBtn, Pill, SearchInput, SectionCard, SoftPill, TrendLine,
} from './ui';
import { ConfirmDialog } from '../operations/ui';
import {
  actions, allowedMines, computeKpis, mineCode, mineLabel, toast, useMockWorkforce,
} from '../../lib/workforce/store';
import { getContractsDb } from '../../lib/contracts/store';
import { exportCsv, exportText } from '../../lib/workforce/export';
import { BillStatus, DEMO_TODAY, type Bill, type Payment } from '../../lib/workforce/types';
import { fmtDate, inr, pct, periodLabel, relTime } from '../../lib/workforce/format';
import { CHART } from '../operations/hooks';

// ---------- Types ----------
const BILL_TABS = ['All Bills', 'Pending', 'Approved', 'Rejected', 'Payments'] as const;
type BillTab = (typeof BILL_TABS)[number];

/** Bill row enriched (at render time) with its contract name — never a local copy. */
interface BillView extends Bill { contractName: string }

/** Payment row enriched with a chronological running total. */
interface PaymentRow extends Payment { running: number }

interface TxnRow {
  id: string; kind: 'payment' | 'bill'; title: string; billId: string;
  amount: number; date: string; contractName: string;
}

const TAB_PARAM_MAP: Record<string, BillTab> = {
  'All Bills': 'All Bills', Pending: 'Pending', 'Pending Bills': 'Pending',
  Approved: 'Approved', 'Approved Bills': 'Approved',
  Rejected: 'Rejected', 'Rejected Bills': 'Rejected', Payments: 'Payments',
};

/** Contract display name from the contracts repository (guarded lookup). */
function contractNameOf(id: string): string | undefined {
  return getContractsDb().contracts.find((c) => c.id === id)?.name;
}

// ---------- Page ----------
export function BillsPage() {
  const db = useMockWorkforce();
  const contracts = useMemo(() => getContractsDb().contracts, []);
  const mineId = db.selectedMineId;

  const [tab, setTab] = useState<BillTab>('All Bills');
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [contractFilter, setContractFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [withdrawId, setWithdrawId] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [actionError, setActionError] = useState('');

  // Deep links from notifications (…/bills?tab=Pending%20Bills) resolve to a tab.
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('tab');
    if (!raw) return;
    const t = TAB_PARAM_MAP[raw];
    if (t) setTab(t);
  }, []);

  // ---------- Derived (single source of truth: the store) ----------
  const billById = useMemo(() => new Map(db.bills.map((b) => [b.id, b] as const)), [db.bills]);

  const scopedBills = useMemo(
    () => db.bills.filter((b) => mineId === 'ALL' || b.mineId === mineId),
    [db.bills, mineId],
  );

  const scopedPayments = useMemo(
    () => db.payments.filter((p) => {
      const b = billById.get(p.billId);
      return !!b && (mineId === 'ALL' || b.mineId === mineId);
    }),
    [db.payments, billById, mineId],
  );

  const withNames = useMemo<BillView[]>(
    () => scopedBills.map((b) => ({ ...b, contractName: contractNameOf(b.contractId) ?? b.contractId })),
    [scopedBills],
  );

  const kpis = useMemo(() => computeKpis(db), [db]);

  const tabCounts = useMemo(() => ({
    'All Bills': scopedBills.length,
    Pending: scopedBills.filter((b) => b.status === BillStatus.Pending).length,
    Approved: scopedBills.filter((b) => b.status === BillStatus.Approved).length,
    Rejected: scopedBills.filter((b) => b.status === BillStatus.Rejected).length,
    Payments: scopedPayments.length,
  }), [scopedBills, scopedPayments]);

  const isPayments = tab === 'Payments';

  const list = useMemo<BillView[]>(() => {
    const needle = appliedQuery.trim().toLowerCase();
    return withNames.filter((b) => {
      if (tab !== 'All Bills' && b.status !== tab) return false;
      if (tab === 'All Bills' && statusFilter !== 'ALL' && b.status !== statusFilter) return false;
      if (contractFilter !== 'ALL' && b.contractId !== contractFilter) return false;
      if (needle) {
        const hay = `${b.id} ${b.invoiceNumber} ${b.contractName} ${b.contractId} ${mineLabel(b.mineId)} ${mineCode(b.mineId)} ${b.workPeriod} ${b.description} ${b.amount}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [withNames, tab, statusFilter, contractFilter, appliedQuery]);

  /** Chronological payment register (running total computed in date order). */
  const paymentRows = useMemo<PaymentRow[]>(() => {
    const asc = [...scopedPayments].sort((a, b) =>
      a.date === b.date ? (a.id < b.id ? -1 : 1) : a.date < b.date ? -1 : 1);
    let run = 0;
    return asc.map((p) => ({ ...p, running: (run += p.amount) }));
  }, [scopedPayments]);

  const paymentList = useMemo<PaymentRow[]>(() => {
    const needle = appliedQuery.trim().toLowerCase();
    return paymentRows.filter((p) => {
      if (contractFilter !== 'ALL' && billById.get(p.billId)?.contractId !== contractFilter) return false;
      if (needle) {
        const b = billById.get(p.billId);
        const hay = `${p.id} ${p.billId} ${p.mode} ${p.reference} ${p.amount} ${contractNameOf(b?.contractId ?? '') ?? ''}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [paymentRows, contractFilter, appliedQuery, billById]);

  const donutData = useMemo(() => ([
    { name: 'Approved', value: kpis.approvedAmount, color: CHART.green },
    { name: 'Pending', value: kpis.pendingAmount, color: CHART.amber },
    { name: 'Rejected', value: kpis.rejectedAmount, color: CHART.red },
  ].filter((d) => d.value > 0)), [kpis]);

  const monthly = useMemo(() => {
    const m = new Map<string, { label: string; billed: number; approved: number }>();
    for (const b of scopedBills) {
      const key = b.billDate.slice(0, 7);
      const cur = m.get(key) ?? { label: fmtDate(`${key}-01`).slice(3, 6), billed: 0, approved: 0 };
      cur.billed += b.amount;
      if (b.status === BillStatus.Approved) cur.approved += b.amount;
      m.set(key, cur);
    }
    return [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([, v]) => ({
        label: v.label,
        billed: Math.round((v.billed / 1e5) * 10) / 10,
        approved: Math.round((v.approved / 1e5) * 10) / 10,
      }));
  }, [scopedBills]);

  const txns = useMemo<TxnRow[]>(() => {
    const payTx: TxnRow[] = paymentRows.map((p) => ({
      id: p.id, kind: 'payment', title: 'Payment Received', billId: p.billId,
      amount: p.amount, date: p.date,
      contractName: contractNameOf(billById.get(p.billId)?.contractId ?? '') ?? '',
    }));
    const billTx: TxnRow[] = withNames.map((b) => ({
      id: b.id, kind: 'bill',
      title: b.status === BillStatus.Pending ? 'Bill Submitted'
        : b.status === BillStatus.Approved ? 'Bill Approved' : 'Bill Rejected',
      billId: b.id, amount: b.amount, date: b.decidedOn ?? b.billDate, contractName: b.contractName,
    }));
    return [...payTx, ...billTx].sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1)).slice(0, 7);
  }, [paymentRows, withNames, billById]);

  const drawerBill = drawerId ? db.bills.find((b) => b.id === drawerId) ?? null : null;
  const drawerPayments = drawerBill ? db.payments.filter((p) => p.billId === drawerBill.id) : [];
  const drawerActivity = drawerBill
    ? db.activity.filter((a) => a.description.includes(drawerBill.id)).slice(0, 8)
    : [];

  const hasActiveFilters = contractFilter !== 'ALL' || (tab === 'All Bills' && statusFilter !== 'ALL') || !!appliedQuery || mineId !== 'ALL';

  // ---------- Handlers ----------
  function clearSearch() { setQuery(''); setAppliedQuery(''); }

  function resetFilters() {
    setQuery(''); setAppliedQuery(''); setContractFilter('ALL'); setStatusFilter('ALL');
    if (mineId !== 'ALL') actions.setSelectedMine('ALL');
  }

  function handleAcknowledge(id: string) {
    setActionError('');
    try { actions.acknowledgeBill(id); } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    }
  }

  function confirmWithdraw() {
    if (!withdrawId) return;
    setActionError('');
    try {
      actions.withdrawBill(withdrawId);
      if (drawerId === withdrawId) setDrawerId(null);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setWithdrawId(null);
    }
  }

  /** Real local file download — a text bill summary, never a toast. */
  function downloadBillText(b: Bill) {
    setActionError('');
    try {
      const name = contractNameOf(b.contractId) ?? b.contractId;
      const pays = db.payments.filter((p) => p.billId === b.id);
      const rule = '='.repeat(64);
      exportText(`${b.id}-demo-bill-summary.txt`, [
        rule,
        '  M I N E N E T R  —  B I L L   S U M M A R Y   ( D E M O )',
        rule,
        '',
        '  *** DEMO ONLY — NOT A TAX INVOICE ***',
        '  All data below is synthetic and fictional.',
        '',
        `  Bill ID           : ${b.id}`,
        `  Invoice No.       : ${b.invoiceNumber}`,
        `  Contract          : ${name} (${b.contractId})`,
        `  Mine              : ${mineLabel(b.mineId)}`,
        `  Work Period       : ${b.workPeriod}`,
        `  Bill Date         : ${fmtDate(b.billDate)}`,
        `  Amount (INR)      : Rs. ${b.amount.toLocaleString('en-IN')}  (${inr(b.amount)})`,
        `  Status            : ${b.status}${b.status === BillStatus.Pending ? ' — awaiting mine approval' : ''}`,
        `  Submitted By      : ${b.submittedBy}`,
        `  Description       : ${b.description}`,
        '',
        '  Decision (by the mine commercial office)',
        `  Decided On        : ${fmtDate(b.decidedOn)}`,
        `  Decision Note     : ${b.decisionNote ?? '—'}`,
        `  Acknowledged      : ${b.acknowledged ? 'Yes' : 'No'}`,
        '',
        '  Payments against this bill',
        ...(pays.length
          ? pays.map((p) => `  ${p.id}  ${fmtDate(p.date)}  ${String(p.mode).padEnd(6)}  Rs. ${p.amount.toLocaleString('en-IN')}  ${p.reference}`)
          : ['  No payment recorded against this bill yet.']),
        '',
        '  Note: bills are approved by the mine commercial office, never by the contractor.',
        rule,
      ].join('\n'));
      toast(`${b.id} bill summary downloaded.`);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    }
  }

  /** Export the CURRENT view (respects tab, search, contract, status, mine). */
  function exportCurrent() {
    setActionError('');
    try {
      if (isPayments) {
        const n = exportCsv(`minenetr-payments-${DEMO_TODAY}`, paymentList, [
          ['Payment ID', (p: PaymentRow) => p.id],
          ['Bill ID', (p) => p.billId],
          ['Contract', (p) => contractNameOf(billById.get(p.billId)?.contractId ?? '') ?? ''],
          ['Amount (INR)', (p) => p.amount],
          ['Date', (p) => fmtDate(p.date)],
          ['Mode', (p) => p.mode],
          ['UTR / Reference', (p) => p.reference],
          ['Running Total (INR)', (p) => p.running],
        ]);
        toast(`Exported ${n} payment row${n === 1 ? '' : 's'} to CSV.`);
      } else {
        const n = exportCsv(`minenetr-bills-${DEMO_TODAY}`, list, [
          ['Bill ID', (b: BillView) => b.id],
          ['Invoice No.', (b) => b.invoiceNumber],
          ['Contract', (b) => b.contractName],
          ['Contract ID', (b) => b.contractId],
          ['Mine', (b) => mineLabel(b.mineId)],
          ['Work Period', (b) => b.workPeriod],
          ['Bill Date', (b) => fmtDate(b.billDate)],
          ['Amount (INR)', (b) => b.amount],
          ['Status', (b) => b.status],
          ['Decided On', (b) => fmtDate(b.decidedOn)],
          ['Decision Note', (b) => b.decisionNote ?? ''],
          ['Acknowledged', (b) => (b.acknowledged ? 'Yes' : 'No')],
        ]);
        toast(`Exported ${n} bill row${n === 1 ? '' : 's'} to CSV.`);
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    }
  }

  // ---------- Table columns ----------
  const billColumns: Column<BillView>[] = [
    {
      key: 'id', header: 'Bill ID', sortValue: (b) => b.id,
      render: (b) => <span className="font-bold text-navy whitespace-nowrap">{b.id}</span>,
    },
    {
      key: 'invoice', header: 'Invoice No.', sortValue: (b) => b.invoiceNumber,
      render: (b) => <span className="whitespace-nowrap text-slate-600">{b.invoiceNumber}</span>,
    },
    {
      key: 'contract', header: 'Contract', sortValue: (b) => b.contractName,
      render: (b) => <span className="font-semibold text-slate-700">{b.contractName}</span>,
    },
    { key: 'mine', header: 'Mine', sortValue: (b) => mineCode(b.mineId), render: (b) => mineCode(b.mineId) },
    {
      key: 'period', header: 'Work Period',
      render: (b) => <span className="whitespace-nowrap">{b.workPeriod}</span>,
    },
    { key: 'date', header: 'Bill Date', sortValue: (b) => b.billDate, render: (b) => <span className="whitespace-nowrap">{fmtDate(b.billDate)}</span> },
    {
      key: 'amount', header: 'Amount', sortValue: (b) => b.amount,
      render: (b) => <span className="font-extrabold text-navy whitespace-nowrap">{inr(b.amount)}</span>,
    },
    {
      key: 'status', header: 'Status', sortValue: (b) => b.status,
      render: (b) => (
        <div className="space-y-0.5">
          <Pill v={b.status} />
          {b.status === BillStatus.Pending && (
            <div className="text-[10px] font-semibold text-amber-600">Awaiting mine approval</div>
          )}
          {b.status !== BillStatus.Pending && (b.acknowledged
            ? <div className="text-[10px] text-slate-400">Decision acknowledged</div>
            : <div className="text-[10px] font-semibold text-orange-600">Awaiting your acknowledgement</div>)}
        </div>
      ),
    },
  ];

  const paymentColumns: Column<PaymentRow>[] = [
    {
      key: 'pid', header: 'Payment ID', sortValue: (p) => p.id,
      render: (p) => <span className="font-bold text-navy whitespace-nowrap">{p.id}</span>,
    },
    {
      key: 'bill', header: 'Bill ID', sortValue: (p) => p.billId,
      render: (p) => {
        const name = contractNameOf(billById.get(p.billId)?.contractId ?? '');
        return (
          <span className="whitespace-nowrap">
            <span className="font-semibold text-slate-700">{p.billId}</span>
            {name && <span className="block text-[11px] text-slate-400">{name}</span>}
          </span>
        );
      },
    },
    {
      key: 'amount', header: 'Amount', sortValue: (p) => p.amount,
      render: (p) => <span className="font-extrabold text-emerald-600 whitespace-nowrap">{inr(p.amount)}</span>,
    },
    { key: 'date', header: 'Date', sortValue: (p) => p.date, render: (p) => <span className="whitespace-nowrap">{fmtDate(p.date)}</span> },
    { key: 'mode', header: 'Mode', render: (p) => <SoftPill v={p.mode} cls="bg-sky-50 text-sky-700" /> },
    { key: 'ref', header: 'UTR / Reference', render: (p) => <span className="font-mono text-[12px]">{p.reference}</span> },
    {
      key: 'running', header: 'Running Total', sortValue: (p) => p.running,
      render: (p) => <span className="font-bold text-navy whitespace-nowrap">{inr(p.running)}</span>,
    },
  ];

  // ---------- Render ----------
  return (
    <ContractorShell
      title="Bills & Transactions"
      sub="Submit, track and manage your bills and payments across all contracts."
    >
      <PageToolbar
        period={periodLabel('2026-04-01', DEMO_TODAY)}
        onExport={exportCurrent}
        exportLabel={isPayments ? 'Export Payments CSV' : 'Export Bills CSV'}
      />

      {actionError && <InlineError msg={actionError} onClose={() => setActionError('')} />}

      {/* KPI tiles — clicking one opens the matching tab */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
        <KpiButton onClick={() => setTab('All Bills')} title="Show the full bill register">
          <KpiCard
            icon={<FileText size={22} />} label="Total Billed Amount" value={inr(kpis.totalBilled)}
            context={`${scopedBills.length} bill${scopedBills.length === 1 ? '' : 's'} in scope`}
            dotColor={CHART.blue} tileClass="bg-blue-50 text-blue-600"
          />
        </KpiButton>
        <KpiButton onClick={() => setTab('Approved')} title="Show approved bills">
          <KpiCard
            icon={<ShieldCheck size={22} />} label="Approved Amount" value={inr(kpis.approvedAmount)}
            context={`${pct(kpis.totalBilled ? (kpis.approvedAmount / kpis.totalBilled) * 100 : 0)} of total billed`}
            contextTone="text-emerald-600" dotColor={CHART.green} tileClass="bg-emerald-50 text-emerald-600"
          />
        </KpiButton>
        <KpiButton onClick={() => setTab('Pending')} title="Show bills awaiting the mine decision">
          <KpiCard
            icon={<Hourglass size={22} />} label="Pending Approval" value={inr(kpis.pendingAmount)}
            context={`${tabCounts.Pending} bill${tabCounts.Pending === 1 ? '' : 's'} awaiting mine decision`}
            contextTone="text-amber-600" dotColor={CHART.amber} tileClass="bg-amber-50 text-amber-600"
          />
        </KpiButton>
        <KpiButton onClick={() => setTab('Rejected')} title="Show rejected bills">
          <KpiCard
            icon={<XCircle size={22} />} label="Rejected Amount" value={inr(kpis.rejectedAmount)}
            context={`${tabCounts.Rejected} bill${tabCounts.Rejected === 1 ? '' : 's'} rejected`}
            contextTone="text-rose-600" dotColor={CHART.red} tileClass="bg-rose-50 text-rose-600"
          />
        </KpiButton>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* LEFT — tabs, filters, register, submit stepper */}
        <div className="xl:col-span-2 space-y-4">
          {/* Tabs + submit + filters */}
          <div className="card !p-0 overflow-hidden">
            <div className="px-2 pt-1 flex items-center gap-2 border-b border-slate-200">
              <div className="flex gap-0.5 overflow-x-auto flex-1" role="tablist" aria-label="Bill views">
                {BILL_TABS.map((t) => (
                  <button
                    key={t} role="tab" aria-selected={t === tab} onClick={() => { setTab(t); setStatusFilter('ALL'); }}
                    className={`px-3.5 py-3 text-[13px] font-bold whitespace-nowrap border-b-2 -mb-px transition flex items-center gap-1.5
                      ${t === tab ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-navy'}`}
                  >
                    {t}
                    <span className={`text-[11px] font-extrabold px-1.5 py-0.5 rounded-full ${t === tab ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                      {tabCounts[t]}
                    </span>
                  </button>
                ))}
              </div>
              <div className="p-2 shrink-0">
                <PermBtn perm="bill.submit" onClick={() => setWizardOpen(true)} className="btn-primary !py-2 !px-3 !text-[12px]">
                  <span className="flex items-center gap-1.5"><Plus size={14} /> Submit New Bill</span>
                </PermBtn>
              </div>
            </div>

            <div className="p-3 flex flex-wrap items-center gap-2">
              <SearchInput
                value={query} onChange={setQuery} onSearch={() => setAppliedQuery(query)}
                ph={isPayments ? 'Search by payment / bill / UTR…' : 'Search by bill no., invoice, contract, mine or description…'}
                width="!w-64"
              />
              <select
                className="input !w-auto !py-2 !text-[13px] font-semibold" value={mineId}
                aria-label="Filter by mine" title="Mine scope (shared across the portal)"
                onChange={(e) => actions.setSelectedMine(e.target.value)}
              >
                <option value="ALL">All Assigned Mines</option>
                {allowedMines().map((m) => <option key={m.id} value={m.id}>{m.name} ({m.code})</option>)}
              </select>
              <select
                className="input !w-auto !py-2 !text-[13px] font-semibold" value={contractFilter}
                aria-label="Filter by contract"
                onChange={(e) => setContractFilter(e.target.value)}
              >
                <option value="ALL">All Contracts</option>
                {contracts.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.id})</option>)}
              </select>
              {!isPayments && (
                <select
                  className="input !w-auto !py-2 !text-[13px] font-semibold" value={tab === 'All Bills' ? statusFilter : tab}
                  aria-label="Filter by status"
                  disabled={tab !== 'All Bills'}
                  title={tab !== 'All Bills' ? `Status is fixed by the active “${tab}” tab — switch to All Bills to filter by status.` : 'Filter by bill status'}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  {tab !== 'All Bills' && <option value={tab}>{tab}</option>}
                  <option value="ALL">All Status</option>
                  <option value={BillStatus.Pending}>Pending</option>
                  <option value={BillStatus.Approved}>Approved</option>
                  <option value={BillStatus.Rejected}>Rejected</option>
                </select>
              )}
              {hasActiveFilters && (
                <button onClick={resetFilters} className="text-[12px] font-semibold text-slate-500 hover:text-navy">
                  ✕ Clear filters
                </button>
              )}
            </div>
          </div>

          {/* Domain note — the contractor can never approve their own bill */}
          <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 text-blue-800 rounded-xl px-3 py-2.5 text-[12px]">
            <Info size={15} className="shrink-0 mt-0.5" />
            {isPayments ? (
              <span>
                Payments are recorded by the finance department against approved bills. The register is chronological and the
                <b> running total</b> accumulates in date order. Click a row to open the linked bill.
              </span>
            ) : (
              <span>
                Every submitted bill is reviewed by the <b>mine commercial office</b>. As the contractor you can submit, withdraw and
                acknowledge decisions — <b>you cannot approve your own bill</b>. Pending bills stay “Awaiting mine approval” until the
                mine office decides.
              </span>
            )}
          </div>

          {/* Register */}
          <SectionCard
            title={isPayments ? 'Payment Register' : `${tab}${list.length ? ` (${list.length})` : ''}`}
            subtitle={isPayments
              ? `${paymentList.length} payment${paymentList.length === 1 ? '' : 's'} · total received ${inr(paymentList.reduce((s, p) => s + p.amount, 0))} · chronological order`
              : 'Sorting, search and pagination are live — the register always reflects the current mine scope.'}
          >
            {isPayments ? (
              <DataTable
                columns={paymentColumns} rows={paymentList} initialSize={10}
                onRowClick={(p) => { if (billById.has(p.billId)) setDrawerId(p.billId); }}
                emptyTitle="No payments in this view"
                emptyText="No payments match the current mine, contract or search filters. Payments are only recorded against approved bills."
              />
            ) : (
              <DataTable
                columns={billColumns} rows={list} initialSize={10}
                onRowClick={(b) => setDrawerId(b.id)}
                actions={(b) => (
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => setDrawerId(b.id)}
                      title="View bill details, payments, decision and activity"
                      aria-label={`View ${b.id}`}
                      className="w-7 h-7 rounded-lg border border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-300 text-navy flex items-center justify-center"
                    >
                      <Eye size={14} />
                    </button>
                    <PermBtn
                      perm="export" onClick={() => downloadBillText(b)}
                      title="Download a text copy of this bill (demo file)"
                      className="w-7 h-7 rounded-lg border border-slate-200 bg-white hover:bg-emerald-50 hover:border-emerald-300 text-navy flex items-center justify-center"
                    >
                      <Download size={14} />
                    </PermBtn>
                    <PermBtn
                      perm="bill.withdraw" onClick={() => setWithdrawId(b.id)}
                      disabled={b.status !== BillStatus.Pending}
                      title={b.status === BillStatus.Pending
                        ? `Withdraw ${b.id} — a withdrawn bill is removed from the register`
                        : `Only pending bills can be withdrawn — ${b.id} was already decided by the mine commercial office on ${fmtDate(b.decidedOn)}.`}
                      className="w-7 h-7 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-300 text-navy flex items-center justify-center"
                    >
                      <X size={14} />
                    </PermBtn>
                    <PermBtn
                      perm="bill.acknowledge" onClick={() => handleAcknowledge(b.id)}
                      disabled={b.status === BillStatus.Pending || !!b.acknowledged}
                      title={b.status === BillStatus.Pending
                        ? 'The mine commercial office has not decided yet — a contractor cannot approve or acknowledge their own pending bill.'
                        : b.acknowledged
                          ? `You already acknowledged the decision on ${b.id}.`
                          : `Acknowledge the mine office decision on ${b.id}`}
                      className="w-7 h-7 rounded-lg border border-slate-200 bg-white hover:bg-emerald-50 hover:border-emerald-300 text-navy flex items-center justify-center"
                    >
                      <Check size={14} />
                    </PermBtn>
                  </div>
                )}
                emptyTitle={tab === 'All Bills' ? 'No bills in this view' : `No ${tab.toLowerCase()} bills`}
                emptyText={appliedQuery || contractFilter !== 'ALL' || (tab === 'All Bills' && statusFilter !== 'ALL')
                  ? 'No bills match your current search and filters. Try clearing them.'
                  : mineId !== 'ALL'
                    ? `There are no bills for ${mineLabel(mineId)} in this category. Switch to All Assigned Mines or another tab.`
                    : 'Submitted bills will appear here. Use “Submit New Bill” to raise one.'}
              />
            )}
          </SectionCard>

          {/* Submit New Bill stepper (matches the reference footer card) */}
          <SectionCard
            title="Submit New Bill"
            subtitle="A new bill enters the register as Pending — the mine commercial office decides approval."
          >
            <div className="flex flex-wrap items-center gap-3">
              <Stepper n={1} title="Fill Details" sub="Contract, mine, work period" active />
              <ArrowRight size={15} className="text-slate-300 hidden sm:block" />
              <Stepper n={2} title="Amount & Charges" sub="Amount and optional line items" />
              <ArrowRight size={15} className="text-slate-300 hidden sm:block" />
              <Stepper n={3} title="Review & Submit" sub="Sent for mine approval" />
              <div className="ml-auto">
                <PermBtn perm="bill.submit" onClick={() => setWizardOpen(true)} className="btn-primary">
                  <span className="flex items-center gap-1.5"><FileText size={15} /> Start New Bill</span>
                </PermBtn>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* RIGHT — payment summary + recent transactions + trend */}
        <div className="space-y-4">
          <SectionCard
            title="Payment Summary"
            action={
              <Link href="/contractor/reports"
                className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline whitespace-nowrap">
                Detailed Report ›
              </Link>
            }
          >
            {donutData.length === 0 ? (
              <EmptyState title="No bills in scope" sub="Billed amounts will chart here once bills exist for the current mine scope." />
            ) : (
              <>
                <Donut
                  data={donutData.map((d) => ({ name: d.name, value: Math.round((d.value / 1e5) * 10) / 10, color: d.color }))}
                  centerValue={inr(kpis.totalBilled)}
                  centerLabel="Total Billed"
                  onPick={(s) => { if (s.name === 'Approved' || s.name === 'Pending' || s.name === 'Rejected') setTab(s.name as BillTab); }}
                  height={180}
                />
                <div className="text-[10px] text-slate-400 text-center mt-1">
                  Values in ₹ Lakh · click a slice to open that tab
                </div>
              </>
            )}
          </SectionCard>

          <SectionCard
            title="Recent Transactions"
            action={
              <button onClick={() => setTab('Payments')}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline">
                View All ›
              </button>
            }
          >
            {txns.length === 0 ? (
              <EmptyState title="No transactions yet" sub="Payments and submitted bills will appear here." />
            ) : (
              <RecentTransactions rows={txns} onOpenBill={(billId) => setDrawerId(billId)} />
            )}
          </SectionCard>

          <SectionCard title="Billed vs Approved" subtitle="Monthly totals from the bill register (₹ Lakh)">
            {monthly.length === 0 ? (
              <EmptyState title="No billing history" sub="No bills in scope to chart." />
            ) : (
              <TrendLine
                data={monthly}
                lines={[
                  { key: 'billed', name: 'Billed', stroke: CHART.blue },
                  { key: 'approved', name: 'Approved', stroke: CHART.green },
                ]}
                height={180}
              />
            )}
          </SectionCard>
        </div>
      </div>

      {/* Withdraw confirmation — a withdrawn bill leaves the register for good */}
      {withdrawId && (
        <ConfirmDialog
          title={`Withdraw ${withdrawId}?`}
          body="A withdrawn bill is removed from the bill register and cannot be restored — it will no longer appear in any list, KPI, chart or export. Withdraw only if the claim was raised in error; you can submit a corrected bill afterwards."
          confirmLabel="Withdraw bill"
          onCancel={() => setWithdrawId(null)}
          onConfirm={confirmWithdraw}
        />
      )}

      {/* Bill detail drawer */}
      {drawerBill && (
        <BillDetailDrawer
          bill={drawerBill}
          payments={drawerPayments}
          activity={drawerActivity}
          onClose={() => setDrawerId(null)}
          onAcknowledge={() => handleAcknowledge(drawerBill.id)}
          onWithdraw={() => setWithdrawId(drawerBill.id)}
          onDownload={() => downloadBillText(drawerBill)}
        />
      )}

      {/* Submit wizard */}
      {wizardOpen && (
        <BillWizard
          contracts={contracts.map((c) => ({ id: c.id, name: c.name, mineId: c.mineId }))}
          defaultMineId={mineId === 'ALL' ? '' : mineId}
          onClose={() => setWizardOpen(false)}
          onCreated={(id) => { setWizardOpen(false); setTab('Pending'); setDrawerId(id); }}
        />
      )}
    </ContractorShell>
  );
}

// ---------- Small building blocks ----------
function KpiButton({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick} title={title}
      className="text-left rounded-2xl transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-400"
    >
      {children}
    </button>
  );
}

function Stepper({ n, title, sub, active }: { n: number; title: string; sub: string; active?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={`w-9 h-9 rounded-full text-[13px] font-extrabold flex items-center justify-center shrink-0
        ${active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{n}</span>
      <span className="min-w-0">
        <span className="block text-[13px] font-bold text-navy leading-tight">{title}</span>
        <span className="block text-[11px] text-slate-400 leading-tight">{sub}</span>
      </span>
    </div>
  );
}

function InlineError({ msg, onClose }: { msg: string; onClose: () => void }) {
  return (
    <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2.5 text-[12px] font-semibold mb-3" role="alert">
      <AlertCircle size={15} className="shrink-0 mt-0.5" />
      <span className="flex-1">{msg}</span>
      <button onClick={onClose} aria-label="Dismiss error" className="text-red-400 hover:text-red-700"><X size={14} /></button>
    </div>
  );
}

// ---------- Recent transactions ----------
function RecentTransactions({ rows, onOpenBill }: { rows: TxnRow[]; onOpenBill: (billId: string) => void }) {
  return (
    <div className="space-y-0.5">
      {rows.map((t) => (
        <button
          key={`${t.kind}-${t.id}`} onClick={() => onOpenBill(t.billId)}
          title={`Open ${t.billId}`}
          className="w-full flex items-center gap-3 rounded-xl p-2 hover:bg-slate-50 text-left"
        >
          <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0
            ${t.kind === 'payment' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
            {t.kind === 'payment' ? <ArrowDown size={16} /> : <ArrowUp size={16} />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-bold text-navy truncate">{t.title}</span>
            <span className="block text-[11px] text-slate-500 truncate">
              {t.billId}{t.contractName ? ` · ${t.contractName}` : ''}
            </span>
            <span className="block text-[10px] text-slate-400">{fmtDate(t.date)} · {relTime(t.date)}</span>
          </span>
          <span className={`text-[13px] font-extrabold shrink-0 whitespace-nowrap ${t.kind === 'payment' ? 'text-emerald-600' : 'text-rose-600'}`}>
            {t.kind === 'payment' ? '+' : '−'} {inr(t.amount)}
          </span>
        </button>
      ))}
    </div>
  );
}

// ---------- Bill detail drawer ----------
function BillDetailDrawer({
  bill, payments, activity, onClose, onAcknowledge, onWithdraw, onDownload,
}: {
  bill: Bill; payments: Payment[]; activity: { id: string; kind: string; description: string; timestamp: string; user: string }[];
  onClose: () => void; onAcknowledge: () => void; onWithdraw: () => void; onDownload: () => void;
}) {
  const name = contractNameOf(bill.contractId) ?? bill.contractId;
  const paid = payments.reduce((s, p) => s + p.amount, 0);

  return (
    <DetailDrawer title={`Bill ${bill.id}`} onClose={onClose} wide>
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <Pill v={bill.status} />
        {bill.status === BillStatus.Pending && (
          <span className="badge bg-amber-50 text-amber-700 border border-amber-200">⏳ Awaiting mine approval</span>
        )}
        {bill.status !== BillStatus.Pending && (
          <span className={`badge ${bill.acknowledged ? 'bg-slate-100 text-slate-600' : 'bg-orange-100 text-orange-700'}`}>
            {bill.acknowledged ? 'Decision acknowledged' : 'Awaiting your acknowledgement'}
          </span>
        )}
        <span className="ml-auto text-[11px] text-slate-400">DEMO · synthetic record</span>
      </div>

      {/* Decision / approval state — read-only for the contractor */}
      {bill.status === BillStatus.Pending ? (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 mb-4 text-[12px] text-amber-800 font-semibold">
          <div className="flex items-start gap-2">
            <Hourglass size={15} className="shrink-0 mt-0.5" />
            <span>
              Submitted on {fmtDate(bill.billDate)} by {bill.submittedBy} and now with the <b>mine commercial office</b>.
              The contractor cannot approve or acknowledge their own bill — you will be notified once the mine office decides.
              Until then you may withdraw it.
            </span>
          </div>
        </div>
      ) : (
        <div className={`rounded-xl border p-3 mb-4 text-[12px] font-semibold ${bill.status === BillStatus.Approved
          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
          : 'bg-red-50 border-red-200 text-red-700'}`}>
          <div className="flex items-start gap-2">
            {bill.status === BillStatus.Approved ? <CheckCircle2 size={15} className="shrink-0 mt-0.5" /> : <XCircle size={15} className="shrink-0 mt-0.5" />}
            <span>
              <b>Decision by the mine commercial office on {fmtDate(bill.decidedOn)}:</b> {bill.decisionNote ?? 'No note recorded.'}
              {' '}Payment is released by the mine finance department against approved bills.
            </span>
          </div>
        </div>
      )}

      <div className="card !p-4 mb-4">
        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Bill details</div>
        <Kv k="Invoice No." v={<span className="font-mono">{bill.invoiceNumber}</span>} />
        <Kv k="Contract" v={`${name} (${bill.contractId})`} />
        <Kv k="Mine" v={mineLabel(bill.mineId)} />
        <Kv k="Work Period" v={bill.workPeriod} />
        <Kv k="Bill Date" v={fmtDate(bill.billDate)} />
        <Kv k="Amount" v={<span className="font-extrabold">{inr(bill.amount)}</span>} />
        <Kv k="Submitted By" v={bill.submittedBy} />
      </div>

      <div className="card !p-4 mb-4">
        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Description</div>
        <p className="text-[13px] text-slate-700 whitespace-pre-line">{bill.description || '—'}</p>
      </div>

      <div className="card !p-4 mb-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Linked payments</div>
          <span className="ml-auto text-[12px] font-extrabold text-navy">{inr(paid)}</span>
        </div>
        {payments.length === 0 ? (
          <p className="text-[12px] text-slate-400">
            {bill.status === BillStatus.Approved
              ? 'Approved but not yet paid — the finance department releases payment on cycle.'
              : 'No payment can exist until the mine office approves this bill.'}
          </p>
        ) : (
          <div className="space-y-1.5">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-[12px] border-b border-slate-100 last:border-0 py-1.5">
                <span className="font-bold text-navy">{p.id}</span>
                <SoftPill v={p.mode} cls="bg-sky-50 text-sky-700" />
                <span className="text-slate-500 font-mono text-[11px]">{p.reference}</span>
                <span className="ml-auto font-extrabold text-emerald-600 whitespace-nowrap">+ {inr(p.amount)}</span>
                <span className="text-slate-400 whitespace-nowrap">{fmtDate(p.date)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card !p-4 mb-4">
        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Activity</div>
        {activity.length === 0 ? (
          <p className="text-[12px] text-slate-400">Submitted on {fmtDate(bill.billDate)} by {bill.submittedBy}. No further activity recorded.</p>
        ) : (
          <div className="space-y-2">
            {activity.map((a) => (
              <div key={a.id} className="flex gap-2 text-[12px]">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                <span className="min-w-0">
                  <span className="block font-bold text-navy">{a.kind}</span>
                  <span className="block text-slate-600">{a.description}</span>
                  <span className="block text-[10px] text-slate-400">{relTime(a.timestamp)} · {a.user}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <PermBtn perm="export" onClick={onDownload} className="btn-primary !bg-white !text-navy border border-slate-300 flex-1">
          <span className="flex items-center justify-center gap-1.5"><Download size={15} /> Download Bill</span>
        </PermBtn>
        <PermBtn
          perm="bill.acknowledge" onClick={onAcknowledge}
          disabled={bill.status === BillStatus.Pending || !!bill.acknowledged}
          title={bill.status === BillStatus.Pending
            ? 'The mine commercial office has not decided yet — a contractor cannot approve or acknowledge their own pending bill.'
            : bill.acknowledged ? 'You already acknowledged this decision.' : 'Acknowledge the mine office decision'}
          className="btn-primary flex-1"
        >
          <span className="flex items-center justify-center gap-1.5"><Check size={15} /> Acknowledge Decision</span>
        </PermBtn>
        <PermBtn
          perm="bill.withdraw" onClick={onWithdraw}
          disabled={bill.status !== BillStatus.Pending}
          title={bill.status === BillStatus.Pending
            ? 'Withdraw this pending bill — it is removed from the register'
            : 'Only pending bills can be withdrawn — the mine office already decided on this bill.'}
          className="btn-primary !bg-white !text-rose-600 border border-rose-200 flex-1"
        >
          <span className="flex items-center justify-center gap-1.5"><X size={15} /> Withdraw Bill</span>
        </PermBtn>
      </div>
    </DetailDrawer>
  );
}

// ---------- Submit-new-bill wizard ----------
interface LineItem { key: string; desc: string; amount: string }
let liSeq = 0;

function BillWizard({
  contracts, defaultMineId, onClose, onCreated,
}: {
  contracts: { id: string; name: string; mineId: string }[];
  defaultMineId: string;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const mineOptions = useMemo(() => allowedMines().map((m) => ({ id: m.id, label: `${m.name} (${m.code})` })), []);

  const [step, setStep] = useState(1);
  const [contractId, setContractId] = useState('');
  const [mineId, setMineId] = useState(defaultMineId);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [items, setItems] = useState<LineItem[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [createdId, setCreatedId] = useState<string | null>(null);

  const amountNum = Number(amount);
  const itemTotal = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
  const workPeriod = from && to ? (from === to ? fmtDate(from) : `${fmtDate(from)} – ${fmtDate(to)}`) : '';

  function validateStep1() {
    const e: Record<string, string> = {};
    if (!contractId) e.contractId = 'Select the contract this bill is raised against.';
    if (!mineId) e.mineId = 'Select the mine where the billed work was executed.';
    if (!from) e.from = 'Work period start date is required.';
    if (!to) e.to = 'Work period end date is required.';
    if (from && to && to < from) e.to = 'End date must be on or after the start date.';
    if (!description.trim()) e.description = 'Describe the work covered by this bill.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validateStep2() {
    const e: Record<string, string> = {};
    if (!amount.trim() || !Number.isFinite(amountNum) || amountNum <= 0) e.amount = 'Bill amount must be greater than zero.';
    for (const it of items) {
      if (!it.desc.trim()) e[`item-desc-${it.key}`] = 'Line description is required.';
      if (!it.amount.trim() || !Number.isFinite(Number(it.amount)) || Number(it.amount) <= 0) e[`item-amount-${it.key}`] = 'Must be greater than zero.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function reset() {
    setStep(1); setContractId(''); setMineId(defaultMineId); setFrom(''); setTo('');
    setDescription(''); setAmount(''); setItems([]); setErrors({}); setSubmitError('');
    setCreatedId(null);
  }

  function submit() {
    setSubmitError('');
    const finalDescription = items.length
      ? `${description.trim()}\nLine items:\n${items.map((it) => `- ${it.desc.trim()}: ₹ ${Math.round(Number(it.amount)).toLocaleString('en-IN')}`).join('\n')}`
      : description.trim();
    try {
      const id = actions.submitBill({ contractId, mineId, workPeriod, amount: amountNum, description: finalDescription });
      setCreatedId(id);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : String(e));
    }
  }

  const STEP_LABELS = ['Bill Details', 'Amount & Charges', 'Review & Submit'];

  return (
    <Modal title="Submit New Bill" onClose={onClose} wide>
      {createdId ? (
        <div className="text-center py-6">
          <CheckCircle2 size={48} className="text-emerald-500 mx-auto" />
          <h4 className="font-extrabold text-navy text-lg mt-3">Bill {createdId} submitted</h4>
          <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
            It is now <b>Pending</b> in the bill register. The <b>mine commercial office</b> reviews and approves it —
            as the contractor you cannot approve your own bill. You will be notified when a decision is taken.
          </p>
          <div className="flex gap-2 justify-center mt-5 flex-wrap">
            <button className="btn-primary !bg-white !text-navy border border-slate-300" onClick={() => { reset(); }}>
              Submit another bill
            </button>
            <button className="btn-primary" onClick={() => onCreated(createdId)}>View bill</button>
          </div>
        </div>
      ) : (
        <>
          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            {STEP_LABELS.map((label, i) => (
              <div key={label} className="flex items-center gap-2">
                <span className={`w-7 h-7 rounded-full text-[12px] font-extrabold flex items-center justify-center shrink-0
                  ${step === i + 1 ? 'bg-blue-600 text-white' : step > i + 1 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {step > i + 1 ? '✓' : i + 1}
                </span>
                <span className={`text-[12px] font-bold whitespace-nowrap ${step === i + 1 ? 'text-navy' : 'text-slate-400'}`}>{label}</span>
                {i < 2 && <span className="w-5 h-px bg-slate-200 hidden sm:block" />}
              </div>
            ))}
          </div>

          {step === 1 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <Field label="Contract" error={errors.contractId} hint="The contract this claim is raised against.">
                  <select
                    className="input" value={contractId}
                    onChange={(e) => {
                      setContractId(e.target.value);
                      const c = contracts.find((x) => x.id === e.target.value);
                      if (c) setMineId(c.mineId);
                    }}
                  >
                    <option value="">Select a contract…</option>
                    {contracts.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.id})</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Mine" error={errors.mineId} hint="Pre-filled from the contract; adjust if the work was executed elsewhere.">
                <select className="input" value={mineId} onChange={(e) => setMineId(e.target.value)}>
                  <option value="">Select a mine…</option>
                  {mineOptions.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Work period from" error={errors.from}>
                  <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
                </Field>
                <Field label="Work period to" error={errors.to}>
                  <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Description of work" error={errors.description} hint="Scope covered by this bill — shown to the mine commercial office during review.">
                  <textarea
                    className="input min-h-[90px]" value={description}
                    placeholder="e.g. Manpower deployment and equipment charges — overburden removal, September campaign."
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </Field>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Bill amount (₹)" error={errors.amount} hint="Total claim in Indian rupees — must be greater than zero.">
                  <input
                    type="number" min={0} step={1000} className="input" value={amount}
                    placeholder="e.g. 450000" onChange={(e) => setAmount(e.target.value)}
                  />
                </Field>
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 flex flex-col justify-center">
                  <span className="text-[11px] font-semibold text-slate-500">Amount in words (figure)</span>
                  <span className="text-lg font-extrabold text-navy">{inr(Number.isFinite(amountNum) && amountNum > 0 ? amountNum : 0)}</span>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[12px] font-bold text-navy">Line items (optional)</span>
                  <span className="text-[11px] text-slate-400">Itemised breakdown recorded with the bill — the amount above stays authoritative.</span>
                  <button
                    onClick={() => setItems([...items, { key: `li-${liSeq++}`, desc: '', amount: '' }])}
                    className="ml-auto text-[12px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    <Plus size={13} /> Add line
                  </button>
                </div>
                {items.length === 0 ? (
                  <p className="text-[12px] text-slate-400">No line items — the bill is claimed as a single amount.</p>
                ) : (
                  <div className="space-y-2">
                    {items.map((it, i) => (
                      <div key={it.key}>
                        <div className="flex gap-2 items-start">
                          <input
                            className="input flex-1" placeholder={`Line ${i + 1} description`} value={it.desc}
                            onChange={(e) => setItems(items.map((x) => (x.key === it.key ? { ...x, desc: e.target.value } : x)))}
                          />
                          <input
                            className="input !w-40" type="number" min={0} placeholder="Amount (₹)" value={it.amount}
                            onChange={(e) => setItems(items.map((x) => (x.key === it.key ? { ...x, amount: e.target.value } : x)))}
                          />
                          <button
                            onClick={() => setItems(items.filter((x) => x.key !== it.key))}
                            aria-label={`Remove line ${i + 1}`}
                            title="Remove this line item"
                            className="w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:border-rose-300 shrink-0"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                        {(errors[`item-desc-${it.key}`] || errors[`item-amount-${it.key}`]) && (
                          <p className="text-[11px] text-red-600 font-semibold mt-1">
                            {errors[`item-desc-${it.key}`] || errors[`item-amount-${it.key}`]}
                          </p>
                        )}
                      </div>
                    ))}
                    <div className="flex justify-between text-[12px] font-bold text-navy border-t border-slate-100 pt-2">
                      <span>Line items total</span>
                      <span>{inr(itemTotal)}</span>
                    </div>
                    {items.length > 0 && Math.round(itemTotal) !== Math.round(amountNum) && (
                      <p className="text-[11px] text-amber-600 font-semibold">
                        Line items ({inr(itemTotal)}) do not add up to the bill amount ({inr(amountNum || 0)}) — the bill amount remains the submitted value.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <div className="card !p-4">
                <Kv k="Contract" v={contractId ? `${contracts.find((c) => c.id === contractId)?.name ?? contractId} (${contractId})` : '—'} />
                <Kv k="Mine" v={mineId ? mineLabel(mineId) : '—'} />
                <Kv k="Work Period" v={workPeriod || '—'} />
                <Kv k="Amount" v={<span className="font-extrabold">{inr(Number.isFinite(amountNum) && amountNum > 0 ? amountNum : 0)}</span>} />
                {items.length > 0 && <Kv k="Line items" v={`${items.length} · total ${inr(itemTotal)}`} />}
                <Kv k="Description" v={<span className="whitespace-pre-line font-normal">{description || '—'}</span>} />
              </div>
              <div className="rounded-xl bg-blue-50 border border-blue-100 text-blue-800 text-[12px] font-semibold p-3 flex items-start gap-2">
                <Send size={15} className="shrink-0 mt-0.5" />
                <span>
                  On submission the bill enters the register as <b>Pending</b>. The <b>mine commercial office</b> approves or rejects it —
                  you cannot approve your own bill. You can withdraw it any time before the decision.
                </span>
              </div>
              {submitError && <InlineError msg={submitError} onClose={() => setSubmitError('')} />}
            </div>
          )}

          <div className="flex gap-2 mt-5 flex-wrap">
            {step > 1 && (
              <button className="btn-primary !bg-white !text-navy border border-slate-300 flex-1" onClick={() => setStep(step - 1)}>
                Back
              </button>
            )}
            {step < 3 && (
              <button
                className="btn-primary flex-1"
                onClick={() => { if (step === 1 ? validateStep1() : validateStep2()) setStep(step + 1); }}
              >
                Continue
              </button>
            )}
            {step === 3 && (
              <PermBtn perm="bill.submit" onClick={submit} className="btn-primary flex-1">
                <span className="flex items-center justify-center gap-1.5"><Send size={15} /> Submit Bill for Approval</span>
              </PermBtn>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
