'use client';
/**
 * Page 3 — Contractors.
 * KPIs derived from the central store; 6 working tabs; contractor list with
 * search/filter/sort/pagination/export; Add Contractor + detail drawer with
 * edit; pending-approval workflows (approve contract, approve/reject work
 * order, extend contract) all mutate the shared store so every page updates.
 */
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertOctagon, ArrowRight, Ban, CalendarClock, CheckCircle2, ClipboardList, FileCheck2,
  FilePlus2, HardHat, Plus, TrendingUp, Users, XCircle,
} from 'lucide-react';
import OperationsShell from '../../../components/operations/OperationsShell';
import { operatorNav } from '../nav';
import {
  Column, ConfirmDialog, DataTable, DetailDrawer, EmptyState, Field, KpiCard, Kv,
  LinkBtn, Modal, OpsBanner, QuickActions, SearchInput, SectionCard, StatusPill, Tabs, Toasts,
} from '../../../components/operations/ui';
import { Donut, HBarRows, TrendLine } from '../../../components/operations/charts';
import { AXIS, CHART, TODAY, TOOLTIP_STYLE, byMine, hrefWithTab, useMineScope, usePageReady, useTab } from '../../../components/operations/hooks';
import { UploadDocModal } from '../../../components/operations/modals';
import { actions, getContractor, getMine, useMockOps } from '../../../lib/ops/store';
import { daysUntil, fmtDate, inrShort, num, pct } from '../../../lib/ops/format';
import { exportCsv } from '../../../lib/ops/export';
import { ContractorStatus, WorkOrderStatus, type Contractor, type WorkOrder } from '../../../lib/ops/types';

const TABS = ['Contractor Overview', 'Contracts & Work Orders', 'Contractor Workforce', 'Bills & Payments', 'Compliance & Documents', 'Performance & Ratings'];

const CTR_TONE: Record<string, string> = {
  [ContractorStatus.Active]: 'bg-green-100 text-green-700',
  [ContractorStatus.ExpiringSoon]: 'bg-amber-100 text-amber-700',
  [ContractorStatus.Expired]: 'bg-red-100 text-red-600',
  [ContractorStatus.Inactive]: 'bg-red-100 text-red-600',
  [ContractorStatus.PendingApproval]: 'bg-purple-100 text-purple-700',
  [ContractorStatus.Rejected]: 'bg-red-100 text-red-600',
};

export default function ContractorsPage() {
  const ready = usePageReady();
  const router = useRouter();
  const db = useMockOps();
  const mineId = useMineScope();
  const [tab, setTab] = useTab(TABS[0]);

  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');
  const [fStatus, setFStatus] = useState('All Status');
  const [fWorkType, setFWorkType] = useState('All Work Types');
  const [selected, setSelected] = useState<string[]>([]);
  const [detail, setDetail] = useState<Contractor | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [woOpen, setWoOpen] = useState(false);
  const [docOpen, setDocOpen] = useState(false);
  const [rejectFor, setRejectFor] = useState<Contractor | null>(null);
  const [approveFor, setApproveFor] = useState<Contractor | null>(null);
  const [extendFor, setExtendFor] = useState<Contractor | null>(null);
  const [woRejectFor, setWoRejectFor] = useState<WorkOrder | null>(null);
  const [woApproveFor, setWoApproveFor] = useState<WorkOrder | null>(null);

  const scopedCtrs = useMemo(() => {
    if (mineId === 'ALL') return db.contractors;
    return db.contractors.filter((c) => c.mineIds.includes(mineId));
  }, [db.contractors, mineId]);

  const scopedWos = useMemo(() => {
    if (mineId === 'ALL') return db.workOrders;
    return db.workOrders.filter((w) => w.mineId === mineId);
  }, [db.workers, db.workOrders, mineId]);

  const ctrWorkforce = useMemo(() => {
    const m = new Map<string, number>();
    db.workers.forEach((w) => { if (w.contractorId) m.set(w.contractorId, (m.get(w.contractorId) ?? 0) + 1); });
    return m;
  }, [db.workers]);

  // ---- KPIs ----
  const k = useMemo(() => {
    const total = scopedCtrs.length;
    const active = scopedCtrs.filter((c) => c.status === ContractorStatus.Active).length;
    const expiringSoon = scopedCtrs.filter((c) => c.status === ContractorStatus.ExpiringSoon).length;
    const expired = scopedCtrs.filter((c) => c.status === ContractorStatus.Expired).length;
    const pending = scopedCtrs.filter((c) => c.status === ContractorStatus.PendingApproval).length;
    const workforce = scopedCtrs.reduce((s, c) => s + (ctrWorkforce.get(c.id) ?? 0), 0);
    return { total, active, expiringSoon, expired, pending, workforce, activePct: pct(active, total) };
  }, [scopedCtrs, ctrWorkforce]);

  // ---- Overview charts ----
  const byWorkType = useMemo(() => {
    const m = new Map<string, number>();
    scopedCtrs.forEach((c) => m.set(c.workType, (m.get(c.workType) ?? 0) + 1));
    return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [scopedCtrs]);

  const byContractStatus = useMemo(() => {
    const c = (s: ContractorStatus) => scopedCtrs.filter((x) => x.status === s).length;
    return [
      { name: 'Active', value: c(ContractorStatus.Active), color: '#159B72' },
      { name: 'Expiring Soon', value: c(ContractorStatus.ExpiringSoon), color: '#E8A02B' },
      { name: 'Expired', value: c(ContractorStatus.Expired), color: '#DC4C58' },
      { name: 'Inactive', value: c(ContractorStatus.Inactive), color: '#68788D' },
      { name: 'Pending Approval', value: c(ContractorStatus.PendingApproval), color: '#7C5CFC' },
    ].filter((s) => s.value > 0);
  }, [scopedCtrs]);

  const workforceTrend = useMemo(() => {
    // Derive from worker join dates: cumulative active contractors per month (last 6 months).
    const months = ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
    const monthIso = ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];
    return months.map((label, i) => {
      const endOfMonth = `${monthIso[i]}-${i === 9 ? '03' : '31'}`;
      const cumCtrs = new Set<string>();
      db.workers.forEach((w) => {
        if (w.contractorId && w.joinedOn <= endOfMonth) cumCtrs.add(w.contractorId);
      });
      const cumWorkforce = db.workers.filter((w) => w.contractorId && w.joinedOn <= endOfMonth).length;
      return { label, value: cumWorkforce, ctrs: cumCtrs.size };
    });
  }, [db.workers]);

  // ---- Upcoming contract expiry ----
  const upcomingExpiry = useMemo(() => {
    return scopedCtrs
      .filter((c) => { const d = daysUntil(c.end); return d !== null && d >= 0 && d <= 120; })
      .sort((a, b) => (daysUntil(a.end) ?? 999) - (daysUntil(b.end) ?? 999))
      .slice(0, 5);
  }, [scopedCtrs]);

  // ---- Pending approvals (derived queues, each with a working action) ----
  const pendingQueues = useMemo(() => {
    const newContracts = scopedCtrs.filter((c) => c.status === ContractorStatus.PendingApproval);
    const pendingWos = scopedWos.filter((w) => w.status === WorkOrderStatus.PendingApproval);
    const extensions = scopedCtrs.filter((c) => { const d = daysUntil(c.end); return d !== null && d >= 0 && d <= 30; });
    return { newContracts, pendingWos, extensions };
  }, [scopedCtrs, scopedWos]);

  // ---- Contractor list filtering ----
  const filtered = useMemo(() => {
    const term = dq.trim().toLowerCase();
    return scopedCtrs.filter((c) =>
      (!term || `${c.name} ${c.contractNo} ${c.workType} ${c.code}`.toLowerCase().includes(term)) &&
      (fStatus === 'All Status' || c.status === fStatus) &&
      (fWorkType === 'All Work Types' || c.workType === fWorkType));
  }, [scopedCtrs, dq, fStatus, fWorkType]);

  const statusList = ['All Status', ContractorStatus.Active, ContractorStatus.ExpiringSoon, ContractorStatus.Expired, ContractorStatus.Inactive, ContractorStatus.PendingApproval, ContractorStatus.Rejected];
  const workTypeList = useMemo(() => ['All Work Types', ...new Set(db.contractors.map((c) => c.workType))], [db.contractors]);

  function exportCtrs() {
    exportCsv(`contractors-${mineId === 'ALL' ? 'all-mines' : getMine(mineId)?.code ?? mineId}-${TODAY}`, filtered,
      [['Name', (c: Contractor) => c.name], ['Code', (c) => c.code], ['Contract No.', (c) => c.contractNo],
      ['Work Type', (c) => c.workType], ['Start', (c) => c.start], ['End', (c) => c.end],
      ['Contract Value (₹ L)', (c) => c.contractValueLakh], ['Workforce', (c) => ctrWorkforce.get(c.id) ?? 0],
      ['Status', (c) => c.status], ['Compliance', (c) => c.complianceStatus]]);
  }

  // ---- Columns ----
  const cols: Column<Contractor>[] = [
    { key: 'name', header: 'Contractor', render: (c) => (
      <span className="flex items-center gap-2">
        <span className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold shrink-0">{c.name.slice(0, 2).toUpperCase()}</span>
        <span><span className="block font-bold text-navy text-[13px]">{c.name}</span><span className="block text-[11px] text-slate-400">{c.code}</span></span>
      </span> ), sortValue: (c) => c.name },
    { key: 'contractNo', header: 'Contract No.', render: (c) => <span className="font-mono text-[12px] font-bold">{c.contractNo}</span>, sortValue: (c) => c.contractNo },
    { key: 'workType', header: 'Work Type', render: (c) => <span className="text-slate-600">{c.workType}</span>, sortValue: (c) => c.workType },
    { key: 'period', header: 'Contract Period', render: (c) => <span className="text-[12px] text-slate-600">{fmtDate(c.start)} – {fmtDate(c.end)}</span>, sortValue: (c) => c.start },
    { key: 'workforce', header: 'Workforce', render: (c) => <span className="font-bold">{num(ctrWorkforce.get(c.id) ?? 0)}</span>, sortValue: (c) => ctrWorkforce.get(c.id) ?? 0 },
    { key: 'value', header: 'Value', render: (c) => <span className="font-bold text-navy">{inrShort(c.contractValueLakh * 1e5)}</span>, sortValue: (c) => c.contractValueLakh },
    { key: 'status', header: 'Status', render: (c) => <span className={`badge ${CTR_TONE[c.status]}`}>● {c.status}</span>, sortValue: (c) => c.status },
    { key: 'compliance', header: 'Compliance', render: (c) => <StatusPill v={c.complianceStatus} />, sortValue: (c) => c.complianceStatus },
  ];

  const ctrActions = (c: Contractor) => (
    <span className="space-x-2">
      <button className="text-xs font-bold text-blue-600 hover:underline" onClick={() => setDetail(c)}>View</button>
      {c.status === ContractorStatus.PendingApproval && (
        <button className="text-xs font-bold text-green-600 hover:underline" onClick={() => setApproveFor(c)}>Approve</button>
      )}
    </span>
  );

  return (
    <OperationsShell nav={operatorNav} title="Contractors" sub="Contractor management">
      <OpsBanner title="Contractors" sub="Manage contractor contracts, workforce, work orders, bills and compliance across all mining activities." />
      <div className="px-4 space-y-4">
        {!ready ? (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">{[...Array(5)].map((_, i) => <div key={i} className="card !p-4 animate-pulse"><div className="h-16 bg-slate-100 rounded-xl" /></div>)}</div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <KpiCard icon={<HardHat size={22} />} label="Total Contractors" value={num(k.total)} trend="+9%" context={`${k.pending} pending approval`} tileClass="bg-blue-50 text-blue-600" />
              <KpiCard icon={<FileCheck2 size={22} />} label="Active Contracts" value={num(k.active)} trend="+11%" context={`${k.activePct}% of total`} dotColor="#159B72" tileClass="bg-green-50 text-green-600" />
              <KpiCard icon={<CalendarClock size={22} />} label="Expiring Soon" value={num(k.expiringSoon)} context="Within 30 days" dotColor="#E8A02B" tileClass="bg-amber-50 text-amber-600" />
              <KpiCard icon={<Ban size={22} />} label="Expired Contracts" value={num(k.expired)} context="Require renewal" dotColor={k.expired > 0 ? '#DC4C58' : '#94a3b8'} tileClass="bg-red-50 text-red-500" />
              <KpiCard icon={<Users size={22} />} label="Contractor Workforce" value={num(k.workforce)} trend="+6%" context="Across all contractors" tileClass="bg-purple-50 text-purple-600" />
            </div>

            <SectionCard className="!p-0 !pb-4" title="" action={null}>
              <div className="px-4 -mt-1"><Tabs tabs={TABS} active={tab} onChange={setTab} /></div>
            </SectionCard>

            {tab === 'Contractor Overview' && (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <SectionCard title="Contractor Distribution by Work Type">
                  <Donut data={byWorkType} centerValue={num(k.total)} centerLabel="Total Contractors"
                    onPick={(s) => { setFWorkType(s.name); setTab('Contractor Overview'); }} />
                </SectionCard>
                <SectionCard title="Contract Status">
                  <Donut data={byContractStatus} centerValue={num(k.total)} centerLabel="Total Contracts"
                    onPick={(s) => { setFStatus(s.name === 'Active' ? ContractorStatus.Active : s.name === 'Expiring Soon' ? ContractorStatus.ExpiringSoon : s.name === 'Expired' ? ContractorStatus.Expired : s.name === 'Inactive' ? ContractorStatus.Inactive : ContractorStatus.PendingApproval); setTab('Contractor Overview'); }} />
                </SectionCard>
                <SectionCard title="Contractor Workforce Trend" subtitle="Cumulative active workforce (last 6 months)">
                  <TrendLine data={workforceTrend} lines={[{ key: 'value', name: 'Workforce', stroke: CHART.blue }]} height={200} />
                </SectionCard>

                <div className="xl:col-span-2">
                  <SectionCard title={`Contractor List (${filtered.length})`} action={
                    <div className="flex gap-2 flex-wrap items-center">
                      <SearchInput value={q} onChange={setQ} onSearch={() => setDq(q)} ph="Search by name, contract no..." width="!w-52" />
                      <select className="input !w-40 !py-2 !text-[13px]" value={fStatus} onChange={(e) => setFStatus(e.target.value)} aria-label="Status filter">{statusList.map((s) => <option key={s}>{s}</option>)}</select>
                      <select className="input !w-44 !py-2 !text-[13px]" value={fWorkType} onChange={(e) => setFWorkType(e.target.value)} aria-label="Work type filter">{workTypeList.map((w) => <option key={w}>{w}</option>)}</select>
                      <button className="btn-primary !py-2 !bg-white !text-blue-700 border border-blue-600" onClick={() => { setDq(''); setQ(''); setFStatus('All Status'); setFWorkType('All Work Types'); }}>Reset</button>
                      <button className="btn-primary !py-2" onClick={exportCtrs}>Export CSV</button>
                      <button className="btn-primary !py-2" onClick={() => setAddOpen(true)}><span className="inline-flex items-center gap-1"><Plus size={14} /> Add Contractor</span></button>
                    </div>}>
                    <DataTable<Contractor> columns={cols} rows={filtered} selectable onSelected={setSelected} onRowClick={setDetail} actions={ctrActions}
                      emptyTitle="No contractors match" emptyText="Adjust filters or add a new contractor." />
                  </SectionCard>
                </div>

                <div className="space-y-4">
                  <SectionCard title="Upcoming Contract Expiry" action={<LinkBtn onClick={() => setTab('Contracts & Work Orders')}>View All</LinkBtn>}>
                    {upcomingExpiry.length === 0 ? <EmptyState title="No upcoming expiries" /> : upcomingExpiry.map((c) => {
                      const d = daysUntil(c.end)!;
                      return (
                        <div key={c.id} className="flex items-center gap-2 py-2 border-b border-slate-50 last:border-0">
                          <div className="text-center bg-amber-50 rounded-lg px-2 py-1 min-w-[48px]">
                            <div className="text-[10px] font-bold text-amber-600 uppercase">{new Date(`${c.end}T00:00:00+05:30`).toLocaleString('en', { month: 'short' })}</div>
                            <div className="text-[15px] font-extrabold text-navy leading-none">{new Date(`${c.end}T00:00:00+05:30`).getDate()}</div>
                          </div>
                          <div className="flex-1 min-w-0"><div className="font-bold text-navy text-[13px] truncate">{c.name}</div><div className="text-[11px] text-slate-400 font-mono">{c.contractNo}</div></div>
                          <span className="badge bg-amber-100 text-amber-700 whitespace-nowrap">{d} days</span>
                        </div>
                      );
                    })}
                  </SectionCard>

                  <SectionCard title="Pending Approvals">
                    {pendingQueues.newContracts.length + pendingQueues.pendingWos.length + pendingQueues.extensions.length === 0
                      ? <EmptyState title="No pending approvals" />
                      : (
                        <div className="space-y-2">
                          {pendingQueues.newContracts.length > 0 && (
                            <button className="w-full flex items-center gap-2 text-left hover:bg-blue-50 rounded-lg px-2 py-1.5" onClick={() => setDetail(pendingQueues.newContracts[0])}>
                              <span className="w-8 h-8 rounded-lg bg-green-100 text-green-600 flex items-center justify-center"><FilePlus2 size={15} /></span>
                              <span className="flex-1 text-[13px] font-semibold text-navy">New Contract Request{pendingQueues.newContracts.length > 1 ? 's' : ''}</span>
                              <span className="badge bg-green-100 text-green-700">{pendingQueues.newContracts.length}</span>
                            </button>
                          )}
                          {pendingQueues.pendingWos.length > 0 && (
                            <button className="w-full flex items-center gap-2 text-left hover:bg-blue-50 rounded-lg px-2 py-1.5" onClick={() => setTab('Contracts & Work Orders')}>
                              <span className="w-8 h-8 rounded-lg bg-green-100 text-green-600 flex items-center justify-center"><ClipboardList size={15} /></span>
                              <span className="flex-1 text-[13px] font-semibold text-navy">Work Order Approval{pendingQueues.pendingWos.length > 1 ? 's' : ''}</span>
                              <span className="badge bg-green-100 text-green-700">{pendingQueues.pendingWos.length}</span>
                            </button>
                          )}
                          {pendingQueues.extensions.length > 0 && (
                            <button className="w-full flex items-center gap-2 text-left hover:bg-blue-50 rounded-lg px-2 py-1.5" onClick={() => setDetail(pendingQueues.extensions[0])}>
                              <span className="w-8 h-8 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center"><TrendingUp size={15} /></span>
                              <span className="flex-1 text-[13px] font-semibold text-navy">Contract Extension Request{pendingQueues.extensions.length > 1 ? 's' : ''}</span>
                              <span className="badge bg-purple-100 text-purple-700">{pendingQueues.extensions.length}</span>
                            </button>
                          )}
                        </div>
                      )}
                  </SectionCard>

                  <SectionCard title="Quick Actions">
                    <QuickActions items={[
                      { label: 'Add New Contractor', icon: <Plus size={15} />, tileClass: 'bg-blue-100 text-blue-600', onClick: () => setAddOpen(true) },
                      { label: 'Create Work Order', icon: <ClipboardList size={15} />, tileClass: 'bg-green-100 text-green-700', onClick: () => setWoOpen(true) },
                      { label: 'Assign Worker', icon: <Users size={15} />, tileClass: 'bg-purple-100 text-purple-600', onClick: () => router.push(hrefWithTab('/operator/workers', 'Worker List')) },
                      { label: 'Upload Contract Doc', icon: <FilePlus2 size={15} />, tileClass: 'bg-amber-100 text-amber-700', onClick: () => setDocOpen(true) },
                    ]} />
                  </SectionCard>
                </div>
              </div>
            )}

            {tab === 'Contracts & Work Orders' && (
              <ContractsWorkOrdersTab
                contractors={scopedCtrs} workOrders={scopedWos}
                onAddWo={() => setWoOpen(true)} onEdit={(c) => { setDetail(c); setEditOpen(true); }}
                onApproveWo={(w) => setWoApproveFor(w)} onRejectWo={(w) => setWoRejectFor(w)}
                onExtend={(c) => setExtendFor(c)} />
            )}

            {tab === 'Contractor Workforce' && <ContractorWorkforceTab contractors={scopedCtrs} ctrWorkforce={ctrWorkforce} />}

            {tab === 'Bills & Payments' && (
              <BillsTab contractors={scopedCtrs} />
            )}

            {tab === 'Compliance & Documents' && (
              <ComplianceTab contractors={scopedCtrs} />
            )}

            {tab === 'Performance & Ratings' && (
              <PerformanceTab contractors={scopedCtrs} ctrWorkforce={ctrWorkforce} />
            )}
          </>
        )}
      </div>

      {/* ---- Detail Drawer ---- */}
      {detail && (
        <DetailDrawer title={`${detail.name} (${detail.code})`} onClose={() => { setDetail(null); setEditOpen(false); }}>
          <div className="flex gap-2 mb-3 flex-wrap">
            <button className="btn-primary !py-2 !text-xs" onClick={() => setEditOpen(true)}>Edit Contract</button>
            <button className="btn-primary !py-2 !text-xs !bg-white !text-blue-700 border border-blue-600" onClick={() => { setWoOpen(true); }}>Create Work Order</button>
            <button className="btn-primary !py-2 !text-xs !bg-white !text-blue-700 border border-blue-600" onClick={() => { setDocOpen(true); }}>Upload Document</button>
          </div>
          {editOpen && <EditCtrForm ctr={detail} onDone={() => setEditOpen(false)} />}
          <Kv k="Contract No." v={<span className="font-mono">{detail.contractNo}</span>} />
          <Kv k="Status" v={<span className={`badge ${CTR_TONE[detail.status]}`}>● {detail.status}</span>} />
          <Kv k="Work Type" v={detail.workType} />
          <Kv k="Contract Period" v={`${fmtDate(detail.start)} → ${fmtDate(detail.end)}`} />
          <Kv k="Days Until Expiry" v={(() => { const d = daysUntil(detail.end); return d === null ? '—' : d < 0 ? 'Expired' : `${d} days`; })()} />
          <Kv k="Contract Value" v={inrShort(detail.contractValueLakh * 1e5)} />
          <Kv k="Workforce" v={`${num(ctrWorkforce.get(detail.id) ?? 0)} workers`} />
          <Kv k="Mines" v={detail.mineIds.map((m) => getMine(m)?.name ?? m).join(', ')} />
          <Kv k="Contact" v={`${detail.contactPerson} · ${detail.phone}`} />
          <Kv k="Email" v={detail.email} />
          <Kv k="Compliance" v={<StatusPill v={detail.complianceStatus} />} />
          <Kv k="Performance Rating" v={detail.rating > 0 ? `${'★'.repeat(Math.round(detail.rating))}${'☆'.repeat(5 - Math.round(detail.rating))} (${detail.rating.toFixed(1)})` : 'Not rated'} />

          <h4 className="font-extrabold text-navy mt-4 mb-1 text-sm">Work Orders</h4>
          {db.workOrders.filter((w) => w.contractorId === detail.id).length === 0
            ? <div className="text-[13px] text-slate-500">No work orders.</div>
            : db.workOrders.filter((w) => w.contractorId === detail.id).map((w) => (
              <div key={w.id} className="text-[12px] border border-slate-100 rounded-lg p-2 mb-1.5 flex items-center gap-2">
                <div className="flex-1"><div className="font-bold text-navy">{w.title}</div><div className="text-slate-500 font-mono">{w.id} · {fmtDate(w.start)} → {fmtDate(w.end)}</div></div>
                <span className={`badge ${w.status === WorkOrderStatus.Active ? 'bg-green-100 text-green-700' : w.status === WorkOrderStatus.PendingApproval ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{w.status}</span>
              </div>
            ))}

          <h4 className="font-extrabold text-navy mt-4 mb-1 text-sm">Audit Trail</h4>
          {db.audit.filter((a) => a.relatedId === detail.id || a.resource === detail.contractNo).slice(0, 5).map((a) => (
            <div key={a.id} className="text-[12px] py-1 border-b border-slate-50 last:border-0">
              <span className="font-bold">{a.action}</span> — {a.details} <span className="text-slate-400">({a.timestamp.slice(11, 16)})</span>
            </div>
          ))}
          <p className="text-[11px] text-slate-400 mt-3">Documents: see Documents &amp; Compliance for certificates and statutory filings.</p>
        </DetailDrawer>
      )}

      {/* ---- Modals ---- */}
      {addOpen && <AddCtrModal mineId={mineId} onClose={() => setAddOpen(false)} />}
      {woOpen && <AddWoModal defaultCtrId={detail?.id ?? ''} onClose={() => setWoOpen(false)} />}
      {docOpen && <UploadDocModal mineId={mineId} onClose={() => setDocOpen(false)} presetCategory="Contractor" />}
      {approveFor && (
        <ConfirmDialog title={`Approve contract ${approveFor.contractNo}?`}
          body={`${approveFor.name} (${approveFor.workType}) will become Active. This action is recorded in the audit log.`}
          confirmLabel="Approve Contract" onConfirm={() => { actions.setContractorStatus(approveFor.id, ContractorStatus.Active); setApproveFor(null); setDetail(null); }}
          onCancel={() => setApproveFor(null)} />
      )}
      {rejectFor && (
        <RejectCtrModal ctr={rejectFor} onClose={() => setRejectFor(null)} />
      )}
      {extendFor && (
        <ExtendModal ctr={extendFor} onClose={() => setExtendFor(null)} />
      )}
      {woApproveFor && (
        <ConfirmDialog title={`Approve work order ${woApproveFor.id}?`}
          body={`"${woApproveFor.title}" (${inrShort(woApproveFor.valueLakh * 1e5)}) will become Active.`}
          confirmLabel="Approve Work Order" onConfirm={() => { actions.setWorkOrderStatus(woApproveFor.id, WorkOrderStatus.Active); setWoApproveFor(null); }}
          onCancel={() => setWoApproveFor(null)} />
      )}
      {woRejectFor && (
        <ConfirmDialog title={`Reject work order ${woRejectFor.id}?`}
          body={`"${woRejectFor.title}" will be cancelled. This cannot be undone.`}
          confirmLabel="Reject Work Order" onConfirm={() => { actions.setWorkOrderStatus(woRejectFor.id, WorkOrderStatus.Cancelled); setWoRejectFor(null); }}
          onCancel={() => setWoRejectFor(null)} />
      )}
      <Toasts />
    </OperationsShell>
  );
}

// ---------- Sub-tabs ----------
function ContractsWorkOrdersTab({ contractors, workOrders, onAddWo, onEdit, onApproveWo, onRejectWo, onExtend }: {
  contractors: Contractor[]; workOrders: WorkOrder[];
  onAddWo: () => void; onEdit: (c: Contractor) => void;
  onApproveWo: (w: WorkOrder) => void; onRejectWo: (w: WorkOrder) => void; onExtend: (c: Contractor) => void;
}) {
  const pending = workOrders.filter((w) => w.status === WorkOrderStatus.PendingApproval);
  const active = workOrders.filter((w) => w.status === WorkOrderStatus.Active);
  const completed = workOrders.filter((w) => w.status === WorkOrderStatus.Completed);
  const cancelled = workOrders.filter((w) => w.status === WorkOrderStatus.Cancelled);
  const expiringCtrs = contractors.filter((c) => { const d = daysUntil(c.end); return d !== null && d >= 0 && d <= 30; });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <SectionCard className="lg:col-span-2" title={`Contracts (${contractors.length})`} subtitle="Contracts at selected mine(s)" action={<button className="btn-primary !py-2" onClick={onEdit.bind(null, contractors[0])}>Edit Contract</button>}>
        <DataTable<Contractor> columns={[
          { key: 'n', header: 'Contractor', render: (c) => <span className="font-semibold text-navy">{c.name}</span>, sortValue: (c) => c.name },
          { key: 'no', header: 'Contract No.', render: (c) => <span className="font-mono text-[12px] font-bold">{c.contractNo}</span>, sortValue: (c) => c.contractNo },
          { key: 'p', header: 'Period', render: (c) => <span className="text-[12px]">{fmtDate(c.start)} – {fmtDate(c.end)}</span>, sortValue: (c) => c.start },
          { key: 'v', header: 'Value', render: (c) => <span className="font-bold">{inrShort(c.contractValueLakh * 1e5)}</span>, sortValue: (c) => c.contractValueLakh },
          { key: 's', header: 'Status', render: (c) => <span className={`badge ${CTR_TONE[c.status]}`}>● {c.status}</span>, sortValue: (c) => c.status },
          { key: 'a', header: '', render: (c) => (
            <span className="space-x-2">
              <button className="text-xs font-bold text-blue-600 hover:underline" onClick={() => onEdit(c)}>Edit</button>
              {(daysUntil(c.end) ?? 999) <= 30 && (daysUntil(c.end) ?? 999) >= 0 && (
                <button className="text-xs font-bold text-purple-600 hover:underline" onClick={() => onExtend(c)}>Extend</button>
              )}
            </span> ) },
        ]} rows={contractors} initialSize={10} />
      </SectionCard>

      <div className="space-y-4">
        <SectionCard title="Expiring Contracts" action={<span className="text-[12px] text-slate-500">{expiringCtrs.length} within 30 days</span>}>
          {expiringCtrs.length === 0 ? <EmptyState title="No expiring contracts" /> : expiringCtrs.map((c) => (
            <div key={c.id} className="flex items-center gap-2 py-2 border-b border-slate-50 last:border-0">
              <div className="flex-1 min-w-0"><div className="font-bold text-navy text-[13px] truncate">{c.name}</div><div className="text-[11px] text-slate-400">{daysUntil(c.end)} days left</div></div>
              <button className="text-xs font-bold text-purple-600 hover:underline" onClick={() => onExtend(c)}>Extend</button>
            </div>
          ))}
        </SectionCard>

        <SectionCard title={`Pending Work Orders (${pending.length})`}>
          {pending.length === 0 ? <EmptyState title="No pending work orders" /> : pending.map((w) => (
            <div key={w.id} className="flex items-center gap-2 py-2 border-b border-slate-50 last:border-0">
              <div className="flex-1 min-w-0"><div className="font-bold text-navy text-[13px] truncate">{w.title}</div><div className="text-[11px] text-slate-400">{w.id} · {inrShort(w.valueLakh * 1e5)}</div></div>
              <button className="text-xs font-bold text-green-600 hover:underline" onClick={() => onApproveWo(w)}>Approve</button>
              <button className="text-xs font-bold text-red-500 hover:underline" onClick={() => onRejectWo(w)}>Reject</button>
            </div>
          ))}
        </SectionCard>
      </div>

      <div className="lg:col-span-3">
        <SectionCard title={`Work Orders (${workOrders.length})`} action={<button className="btn-primary !py-2" onClick={onAddWo}><span className="inline-flex items-center gap-1"><Plus size={14} /> Create Work Order</span></button>}>
          <DataTable<WorkOrder> columns={[
            { key: 'id', header: 'WO ID', render: (w) => <span className="font-mono font-bold">{w.id}</span>, sortValue: (w) => w.id },
            { key: 't', header: 'Title', render: (w) => w.title, sortValue: (w) => w.title },
            { key: 'c', header: 'Contractor', render: (w) => getContractor(w.contractorId)?.name ?? w.contractorId },
            { key: 'm', header: 'Mine', render: (w) => <span className="font-semibold">{getMine(w.mineId)?.code}</span> },
            { key: 'v', header: 'Value', render: (w) => <span className="font-bold">{inrShort(w.valueLakh * 1e5)}</span>, sortValue: (w) => w.valueLakh },
            { key: 'p', header: 'Period', render: (w) => <span className="text-[12px]">{fmtDate(w.start)} – {fmtDate(w.end)}</span> },
            { key: 's', header: 'Status', render: (w) => <StatusPill v={w.status} />, sortValue: (w) => w.status },
            { key: 'a', header: '', render: (w) => w.status === WorkOrderStatus.PendingApproval ? (
              <span className="space-x-2">
                <button className="text-xs font-bold text-green-600 hover:underline" onClick={() => onApproveWo(w)}>Approve</button>
                <button className="text-xs font-bold text-red-500 hover:underline" onClick={() => onRejectWo(w)}>Reject</button>
              </span> ) : <span className="text-slate-400 text-xs">—</span> },
          ]} rows={[...pending, ...active, ...completed, ...cancelled]} initialSize={10} />
        </SectionCard>
      </div>
    </div>
  );
}

function ContractorWorkforceTab({ contractors, ctrWorkforce }: { contractors: Contractor[]; ctrWorkforce: Map<string, number> }) {
  const rows = useMemo(() => {
    return contractors.map((c) => ({
      id: c.id, name: c.name, code: c.code, total: ctrWorkforce.get(c.id) ?? 0, status: c.status, workType: c.workType,
    })).sort((a, b) => b.total - a.total);
  }, [contractors, ctrWorkforce]);
  const total = rows.reduce((s, r) => s + r.total, 0);
  return (
    <SectionCard title="Contractor Workforce" subtitle={`${num(total)} workers across ${rows.length} contractors`}>
      <DataTable<{ id: string; name: string; code: string; total: number; status: string; workType: string }> columns={[
        { key: 'n', header: 'Contractor', render: (r) => <span className="font-semibold text-navy">{r.name}</span>, sortValue: (r) => r.name },
        { key: 'w', header: 'Work Type', render: (r) => <span className="text-slate-600">{r.workType}</span> },
        { key: 't', header: 'Total Workers', render: (r) => <span className="font-bold">{num(r.total)}</span>, sortValue: (r) => r.total },
        { key: 'p', header: '% of Workforce', render: (r) => <span className="font-bold">{pct(r.total, total)}%</span>, sortValue: (r) => pct(r.total, total) },
        { key: 's', header: 'Contract Status', render: (r) => <span className={`badge ${CTR_TONE[r.status]}`}>● {r.status}</span>, sortValue: (r) => r.status },
      ]} rows={rows} initialSize={10} />
    </SectionCard>
  );
}

function BillsTab({ contractors }: { contractors: Contractor[] }) {
  const db = useMockOps();
  const bills = useMemo(() => {
    const ids = new Set(contractors.map((c) => c.id));
    return db.bills.filter((b) => ids.has(b.contractorId));
  }, [db.bills, contractors]);
  const approved = bills.filter((b) => b.approvalStatus === 'Approved');
  const totalApproved = approved.reduce((s, b) => s + b.amount + b.tax, 0);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <SectionCard className="lg:col-span-2" title={`Contractor Bills (${bills.length})`} action={<button className="btn-primary !py-2" onClick={() => window.location.href = hrefWithTab('/operator/bills', 'Bill Overview')}>Open Bills &amp; Transactions ›</button>}>
        <DataTable<{ id: string; contractorId: string; amount: number; approvalStatus: string; paymentStatus: string; type: string }> columns={[
          { key: 'id', header: 'Bill ID', render: (b) => <span className="font-mono font-bold">{b.id}</span>, sortValue: (b) => b.id },
          { key: 'c', header: 'Contractor', render: (b) => getContractor(b.contractorId)?.name ?? b.contractorId },
          { key: 't', header: 'Type', render: (b) => b.type },
          { key: 'a', header: 'Amount', render: (b) => <span className="font-bold">{inrShort(b.amount)}</span>, sortValue: (b) => b.amount },
          { key: 'ap', header: 'Approval', render: (b) => <StatusPill v={b.approvalStatus} />, sortValue: (b) => b.approvalStatus },
          { key: 'ps', header: 'Payment', render: (b) => <StatusPill v={b.paymentStatus} />, sortValue: (b) => b.paymentStatus },
        ]} rows={bills.map((b) => ({ id: b.id, contractorId: b.contractorId, amount: b.amount, approvalStatus: b.approvalStatus, paymentStatus: b.paymentStatus, type: b.type }))} initialSize={10} />
      </SectionCard>
      <div className="space-y-4">
        <SectionCard title="Bill Summary">
          <div className="space-y-2 text-[13px]">
            <div className="flex justify-between"><span className="text-slate-600">Total Bills</span><span className="font-bold">{bills.length}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">Approved</span><span className="font-bold text-green-600">{approved.length}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">Pending</span><span className="font-bold text-amber-600">{bills.filter((b) => b.approvalStatus === 'Pending').length}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">Approved Value</span><span className="font-bold text-navy">{inrShort(totalApproved)}</span></div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function ComplianceTab({ contractors }: { contractors: Contractor[] }) {
  const db = useMockOps();
  const docs = useMemo(() => {
    const ids = new Set(contractors.map((c) => c.id));
    return db.documents.filter((d) => d.relatedKind === 'Contractor' && ids.has(d.relatedId));
  }, [db.documents, contractors]);
  return (
    <SectionCard title={`Contractor Documents (${docs.length})`} subtitle="Statutory filings, safety certificates and contract documents" action={<button className="btn-primary !py-2" onClick={() => window.location.href = hrefWithTab('/operator/documents', 'Document Library')}>Open Documents &amp; Compliance ›</button>}>
      {docs.length === 0 ? <EmptyState title="No contractor documents" sub="Upload a contract document to get started." /> : (
        <DataTable<{ id: string; name: string; category: string; refNo: string; expiryDate: string | null; status: string }> columns={[
          { key: 'n', header: 'Document', render: (d) => <span className="font-semibold text-navy">{d.name}</span>, sortValue: (d) => d.name },
          { key: 'c', header: 'Category', render: (d) => d.category },
          { key: 'r', header: 'Ref No.', render: (d) => <span className="font-mono text-[12px]">{d.refNo}</span> },
          { key: 'e', header: 'Expiry', render: (d) => d.expiryDate ? fmtDate(d.expiryDate) : <span className="text-slate-400">N/A</span>, sortValue: (d) => d.expiryDate ?? '' },
          { key: 's', header: 'Status', render: (d) => <StatusPill v={d.status} />, sortValue: (d) => d.status },
        ]} rows={docs.map((d) => ({ id: d.id, name: d.name, category: d.category, refNo: d.refNo, expiryDate: d.expiryDate, status: d.status }))} initialSize={10} />
      )}
    </SectionCard>
  );
}

function PerformanceTab({ contractors, ctrWorkforce }: { contractors: Contractor[]; ctrWorkforce: Map<string, number> }) {
  const db = useMockOps();
  const rows = useMemo(() => {
    return contractors.map((c) => {
      const bills = db.bills.filter((b) => b.contractorId === c.id);
      const approvedBills = bills.filter((b) => b.approvalStatus === 'Approved').length;
      const docs = db.documents.filter((d) => d.relatedKind === 'Contractor' && d.relatedId === c.id);
      const validDocs = docs.filter((d) => d.status === 'Valid').length;
      const workforce = ctrWorkforce.get(c.id) ?? 0;
      const billPct = bills.length ? pct(approvedBills, bills.length) : 0;
      const docPct = docs.length ? pct(validDocs, docs.length) : 0;
      const score = Math.round((billPct + docPct) / 2);
      return { id: c.id, name: c.name, workforce, bills: bills.length, approvedBills, docs: docs.length, validDocs, billPct, docPct, score, rating: c.rating };
    }).sort((a, b) => b.score - a.score);
  }, [contractors, db.bills, db.documents, ctrWorkforce]);

  return (
    <SectionCard title="Performance & Ratings" subtitle="Composite score: bill approval rate + document validity rate">
      <DataTable<{ id: string; name: string; workforce: number; bills: number; approvedBills: number; docs: number; validDocs: number; billPct: number; docPct: number; score: number; rating: number }> columns={[
        { key: 'n', header: 'Contractor', render: (r) => <span className="font-semibold text-navy">{r.name}</span>, sortValue: (r) => r.name },
        { key: 'w', header: 'Workforce', render: (r) => num(r.workforce), sortValue: (r) => r.workforce },
        { key: 'b', header: 'Bills Approved', render: (r) => `${r.approvedBills}/${r.bills} (${r.billPct}%)`, sortValue: (r) => r.billPct },
        { key: 'd', header: 'Docs Valid', render: (r) => `${r.validDocs}/${r.docs} (${r.docPct}%)`, sortValue: (r) => r.docPct },
        { key: 's', header: 'Score', render: (r) => <span className={`font-extrabold ${r.score >= 80 ? 'text-green-600' : r.score >= 50 ? 'text-amber-600' : 'text-red-500'}`}>{r.score}%</span>, sortValue: (r) => r.score },
        { key: 'r', header: 'Rating', render: (r) => r.rating > 0 ? <span className="text-amber-500">{'★'.repeat(Math.round(r.rating))}{'☆'.repeat(5 - Math.round(r.rating))}</span> : <span className="text-slate-400">—</span>, sortValue: (r) => r.rating },
      ]} rows={rows} initialSize={10} />
    </SectionCard>
  );
}

// ---------- Sub-modal forms ----------
function EditCtrForm({ ctr, onDone }: { ctr: Contractor; onDone: () => void }) {
  const [f, setF] = useState({ name: ctr.name, workType: ctr.workType, contactPerson: ctr.contactPerson, phone: ctr.phone, end: ctr.end });
  const [err, setErr] = useState<Record<string, string>>({});
  return (
    <div className="border border-blue-200 bg-blue-50/40 rounded-xl p-3 mb-3">
      <div className="font-bold text-navy text-sm mb-2">Edit Contract</div>
      {err.form && <div className="text-[12px] text-red-600 font-semibold mb-2" role="alert">{err.form}</div>}
      <div className="grid grid-cols-2 gap-x-2">
        <Field label="Contractor name" error={err.name}><input className="input !py-1.5 !text-[13px]" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Work type"><input className="input !py-1.5 !text-[13px]" value={f.workType} onChange={(e) => setF({ ...f, workType: e.target.value })} /></Field>
        <Field label="Contact person"><input className="input !py-1.5 !text-[13px]" value={f.contactPerson} onChange={(e) => setF({ ...f, contactPerson: e.target.value })} /></Field>
        <Field label="Phone"><input className="input !py-1.5 !text-[13px]" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <Field label="Contract end"><input type="date" className="input !py-1.5 !text-[13px]" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></Field>
      </div>
      <div className="flex gap-2">
        <button className="btn-primary !py-1.5 !text-xs !bg-white !text-navy border border-slate-300" onClick={onDone}>Cancel</button>
        <button className="btn-primary !py-1.5 !text-xs" onClick={() => {
          if (!f.name.trim()) { setErr({ name: 'Name is required.' }); return; }
          try {
            actions.updateContractorMeta(ctr.id, { name: f.name.trim(), workType: f.workType.trim(), contactPerson: f.contactPerson.trim(), phone: f.phone.trim(), end: f.end });
            onDone();
          } catch (e: any) { setErr({ form: e.message }); }
        }}>Save</button>
      </div>
    </div>
  );
}

function AddCtrModal({ mineId, onClose }: { mineId: string; onClose: () => void }) {
  const db = useMockOps();
  const scope = mineId === 'ALL' ? 'M-01' : mineId;
  const [f, setF] = useState({
    name: '', code: `CTR-${String(db.contractors.length + 1).padStart(2, '0')}`,
    workType: 'Overburden Removal', contactPerson: '', phone: '', email: '',
    start: TODAY, end: '2027-10-03', mineIds: [scope], contractValueLakh: '',
  });
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  function submit() {
    const e: Record<string, string> = {};
    if (!f.name.trim()) e.name = 'Contractor name is required.';
    if (db.contractors.some((c) => c.code.toLowerCase() === f.code.trim().toLowerCase())) e.code = 'This code already exists.';
    if (!f.contactPerson.trim()) e.contactPerson = 'Contact person is required.';
    if (!f.phone.trim() || f.phone.trim().length < 10) e.phone = 'Enter a valid phone number.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = 'Enter a valid email address.';
    if (!(Number(f.contractValueLakh) > 0)) e.contractValueLakh = 'Contract value must be greater than 0.';
    setErr(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      actions.createContractor({ name: f.name.trim(), code: f.code.trim().toUpperCase(), workType: f.workType, contactPerson: f.contactPerson.trim(), phone: f.phone.trim(), email: f.email.trim(), start: f.start, end: f.end, mineIds: f.mineIds, contractValueLakh: Number(f.contractValueLakh) });
      onClose();
    } catch (ex: any) { setErr({ form: ex.message }); } finally { setBusy(false); }
  }

  return (
    <Modal title="Add Contractor" onClose={onClose}>
      <p className="text-[11px] text-slate-400 mb-3">New contracts start in Pending Approval status. Approve from the Contractor List or Pending Approvals panel.</p>
      {err.form && <div className="text-[12px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-2" role="alert">{err.form}</div>}
      <div className="grid sm:grid-cols-2 gap-x-3">
        <Field label="Contractor name *" error={err.name}><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Shakti Infra Pvt. Ltd." /></Field>
        <Field label="Contractor code *" hint="Unique code"><input className="input" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></Field>
        <Field label="Work type">
          <select className="input" value={f.workType} onChange={(e) => setF({ ...f, workType: e.target.value })}>
            {['Overburden Removal', 'Coal Transportation', 'Drilling & Blasting', 'Maintenance Services', 'Excavation & Loading', 'Water Supply & Dust Control', 'Equipment Maintenance', 'Civil & Infrastructure', 'Other Services'].map((w) => <option key={w}>{w}</option>)}
          </select>
        </Field>
        <Field label="Contact person *" error={err.contactPerson}><input className="input" value={f.contactPerson} onChange={(e) => setF({ ...f, contactPerson: e.target.value })} /></Field>
        <Field label="Phone *" error={err.phone}><input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="+91-9xxxx-xxxxx" /></Field>
        <Field label="Email *" error={err.email}><input className="input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="contact@contractor.in" /></Field>
        <Field label="Start date"><input type="date" className="input" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></Field>
        <Field label="End date"><input type="date" className="input" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></Field>
        <Field label="Contract value (₹ Lakh) *" error={err.contractValueLakh}><input className="input" type="number" min={0} value={f.contractValueLakh} onChange={(e) => setF({ ...f, contractValueLakh: e.target.value })} placeholder="e.g. 150" /></Field>
        <Field label="Mine">
          <select className="input" value={f.mineIds[0]} onChange={(e) => setF({ ...f, mineIds: [e.target.value] })}>
            {db.mines.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.code})</option>)}
          </select>
        </Field>
      </div>
      <div className="flex gap-2 justify-end">
        <button className="btn-primary !bg-white !text-navy border border-slate-300" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={submit} disabled={busy}>{busy ? 'Submitting…' : 'Submit for Approval'}</button>
      </div>
    </Modal>
  );
}

function AddWoModal({ defaultCtrId, onClose }: { defaultCtrId: string; onClose: () => void }) {
  const db = useMockOps();
  const [f, setF] = useState({
    contractorId: defaultCtrId || db.contractors[0]?.id || '',
    mineId: db.contractors[0]?.mineIds[0] || 'M-01',
    title: '', valueLakh: '', start: TODAY, end: '2027-10-03',
  });
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const ctr = db.contractors.find((c) => c.id === f.contractorId);

  function submit() {
    const e: Record<string, string> = {};
    if (!f.title.trim()) e.title = 'Work order title is required.';
    if (!(Number(f.valueLakh) > 0)) e.valueLakh = 'Value must be greater than 0.';
    if (!f.contractorId) e.contractorId = 'Select a contractor.';
    setErr(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      actions.createWorkOrder({ contractorId: f.contractorId, mineId: f.mineId, title: f.title.trim(), valueLakh: Number(f.valueLakh), start: f.start, end: f.end });
      onClose();
    } catch (ex: any) { setErr({ form: ex.message }); } finally { setBusy(false); }
  }

  return (
    <Modal title="Create Work Order" onClose={onClose}>
      <p className="text-[11px] text-slate-400 mb-3">Work orders start in Pending Approval status. Approve from the Contracts &amp; Work Orders tab.</p>
      {err.form && <div className="text-[12px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-2" role="alert">{err.form}</div>}
      <Field label="Contractor *" error={err.contractorId}>
        <select className="input" value={f.contractorId} onChange={(e) => { const c = db.contractors.find((x) => x.id === e.target.value); setF({ ...f, contractorId: e.target.value, mineId: c?.mineIds[0] ?? f.mineId }); }}>
          {db.contractors.filter((c) => c.status !== ContractorStatus.Inactive).map((c) => <option key={c.id} value={c.id}>{c.name} ({c.status})</option>)}
        </select>
      </Field>
      <Field label="Mine">
        <select className="input" value={f.mineId} onChange={(e) => setF({ ...f, mineId: e.target.value })}>
          {(ctr?.mineIds ?? ['M-01']).map((m) => <option key={m} value={m}>{getMine(m)?.name} ({getMine(m)?.code})</option>)}
        </select>
      </Field>
      <Field label="Title *" error={err.title}><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Overburden removal — Pit II" /></Field>
      <div className="grid sm:grid-cols-3 gap-x-3">
        <Field label="Value (₹ Lakh) *" error={err.valueLakh}><input className="input" type="number" min={0} value={f.valueLakh} onChange={(e) => setF({ ...f, valueLakh: e.target.value })} /></Field>
        <Field label="Start date"><input type="date" className="input" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></Field>
        <Field label="End date"><input type="date" className="input" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></Field>
      </div>
      <div className="flex gap-2 justify-end">
        <button className="btn-primary !bg-white !text-navy border border-slate-300" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={submit} disabled={busy}>{busy ? 'Creating…' : 'Create Work Order'}</button>
      </div>
    </Modal>
  );
}

function RejectCtrModal({ ctr, onClose }: { ctr: Contractor; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');
  return (
    <Modal title={`Reject contract ${ctr.contractNo}?`} onClose={onClose}>
      <p className="text-[12px] text-slate-600 mb-3">{ctr.name} ({ctr.workType}) will be marked as Rejected. This cannot be undone.</p>
      <Field label="Rejection reason *" error={err}>
        <textarea className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Incomplete statutory documents" />
      </Field>
      <div className="flex gap-2 justify-end">
        <button className="btn-primary !bg-white !text-navy border border-slate-300" onClick={onClose}>Cancel</button>
        <button className="btn-primary !bg-red-600 hover:!bg-red-700" onClick={() => {
          if (!reason.trim()) { setErr('A rejection reason is required.'); return; }
          actions.setContractorStatus(ctr.id, ContractorStatus.Rejected, reason.trim());
          onClose();
        }}>Reject Contract</button>
      </div>
    </Modal>
  );
}

function ExtendModal({ ctr, onClose }: { ctr: Contractor; onClose: () => void }) {
  const [months, setMonths] = useState('12');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  return (
    <Modal title={`Extend contract ${ctr.contractNo}`} onClose={onClose}>
      <p className="text-[12px] text-slate-600 mb-3">{ctr.name} — current end date {fmtDate(ctr.end)}.</p>
      <Field label="Extension (months)" error={err}>
        <select className="input" value={months} onChange={(e) => setMonths(e.target.value)}>
          {['3', '6', '12', '24'].map((m) => <option key={m} value={m}>{m} months</option>)}
        </select>
      </Field>
      <Field label="Reason / note">
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Phase II extension approved" />
      </Field>
      <div className="flex gap-2 justify-end">
        <button className="btn-primary !bg-white !text-navy border border-slate-300" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={() => {
          try { actions.extendContractor(ctr.id, Number(months), note.trim()); onClose(); } catch (e: any) { setErr(e.message); }
        }}>Extend Contract</button>
      </div>
    </Modal>
  );
}
