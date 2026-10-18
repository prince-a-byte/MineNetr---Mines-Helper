'use client';
/**
 * Page 9 — Reports & Analytics.
 * 8 tabs, each generating a real CSV report through actions.generateReport so
 * the report shows up in the store (and in the Dashboard/report history).
 * Trend/grade/mine charts derive from production + dispatch records.
 */
import { useMemo, useState } from 'react';
import {
  BarChart3, Download, FileText, Plus, Scale, Target, TrendingUp, Truck, Users,
} from 'lucide-react';
import OperationsShell from '../../../components/operations/OperationsShell';
import { operatorNav } from '../nav';
import {
  Column, DataTable, DetailDrawer, EmptyState, Field, KpiCard, Kv, Modal,
  OpsBanner, PeriodSelect, QuickActions, SearchInput, SectionCard, StatusPill, Tabs, Toasts,
} from '../../../components/operations/ui';
import { Donut, HBarRows, TrendBars } from '../../../components/operations/charts';
import { CHART, TODAY, byMine, useMineScope, usePageReady, useTab } from '../../../components/operations/hooks';
import { actions, billPaid, getMine, onSiteWorkerIds, useMockOps } from '../../../lib/ops/store';
import { fmtDate, inrShort, mt, num, pct } from '../../../lib/ops/format';
import { exportCsv } from '../../../lib/ops/export';
import { ReportType, type OpsReport, type ProductionRecord } from '../../../lib/ops/types';

const TABS = ['Production Report', 'Dispatch Report', 'Stockpile Report', 'Contractor Report', 'Manpower Report', 'Financial Report', 'Compliance Report', 'Custom Reports'];

const TARGET_MT = 5000; // daily demo target used for achievement %

export default function ReportsPage() {
  const ready = usePageReady();
  const db = useMockOps();
  const mineId = useMineScope();
  const [tab, setTab] = useTab(TABS[0]);

  const [genOpen, setGenOpen] = useState(false);
  const [detail, setDetail] = useState<OpsReport | null>(null);
  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');

  const scopedProd = useMemo(() => byMine(db.production, mineId), [db.production, mineId]);
  const scopedDisp = useMemo(() => byMine(db.dispatches, mineId), [db.dispatches, mineId]);
  const scopedPiles = useMemo(() => byMine(db.stockpiles, mineId), [db.stockpiles, mineId]);
  const scopedWorkers = useMemo(() => byMine(db.workers, mineId), [db.workers, mineId]);
  const scopedBills = useMemo(() => byMine(db.bills, mineId), [db.bills, mineId]);
  const scopedCtrs = useMemo(() => mineId === 'ALL' ? db.contractors : db.contractors.filter((c) => c.mineIds.includes(mineId)), [db.contractors, mineId]);
  const scopedDocs = useMemo(() => byMine(db.documents, mineId), [db.documents, mineId]);
  const scopedInsp = useMemo(() => byMine(db.inspections, mineId), [db.inspections, mineId]);

  // ---- KPIs ----
  const k = useMemo(() => {
    const monthProd = scopedProd.filter((p) => p.date.startsWith('2026-10')).reduce((s, p) => s + p.quantityMt, 0);
    const monthDisp = scopedDisp.filter((d) => d.date.startsWith('2026-10')).reduce((s, d) => s + d.quantityMt, 0);
    const onRoll = scopedWorkers.length;
    const billTotal = scopedBills.reduce((s, b) => s + b.amount + b.tax, 0);
    const validDocs = scopedDocs.filter((d) => d.status === 'Valid').length;
    const compliance = pct(validDocs, scopedDocs.length || 1);
    return { monthProd, monthDisp, onRoll, billTotal, compliance, onSite: onSiteWorkerIds(db).size };
  }, [scopedProd, scopedDisp, scopedWorkers, scopedBills, scopedDocs, db]);

  // ---- Production trend (7 days, target vs actual vs achievement) ----
  const prodTrend = useMemo(() => {
    const out: { label: string; target: number; actual: number; achieve: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(`${TODAY}T00:00:00+05:30`);
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const actual = scopedProd.filter((p) => p.date === iso).reduce((s, p) => s + p.quantityMt, 0);
      out.push({ label: `${iso.slice(8, 10)} ${d.toLocaleString('en', { month: 'short' })}`, target: TARGET_MT, actual, achieve: pct(actual, TARGET_MT) });
    }
    return out;
  }, [scopedProd]);

  const gradeDonut = useMemo(() => {
    const m = new Map<string, number>();
    scopedProd.filter((p) => p.date.startsWith('2026-10')).forEach((p) => m.set(p.grade, (m.get(p.grade) ?? 0) + p.quantityMt));
    return [...m.entries()].map(([name, value]) => ({ name: `${name} Grade`, value })).sort((a, b) => b.value - a.value);
  }, [scopedProd]);

  const mineBars = useMemo(() => db.mines.map((m) => ({
    name: m.code, value: db.production.filter((p) => p.mineId === m.id && p.date.startsWith('2026-10')).reduce((s, p) => s + p.quantityMt, 0),
  })).sort((a, b) => b.value - a.value), [db.mines, db.production]);

  // ---- Tab-specific datasets ----
  const dispatchRows = useMemo(() => scopedDisp.slice(0, 50).map((d) => ({
    id: d.id, date: d.date, mine: getMine(d.mineId)?.code ?? d.mineId, dest: d.destination,
    qty: d.quantityMt, truck: d.vehicleNo, challan: d.challanNo, status: d.status,
  })), [scopedDisp]);

  const stockRows = useMemo(() => scopedPiles.map((sp) => {
    const prod = scopedProd.filter((p) => p.stockpileId === sp.id).reduce((s, p) => s + p.quantityMt, 0);
    const disp = scopedDisp.filter((d) => d.stockpileId === sp.id).reduce((s, d) => s + d.quantityMt, 0);
    return { id: sp.id, name: sp.name, code: sp.code, grade: sp.grade, prod, disp, cap: sp.capacityMt, util: pct(prod, sp.capacityMt) };
  }), [scopedPiles, scopedProd, scopedDisp]);

  const ctrRows = useMemo(() => scopedCtrs.map((c) => {
    const bills = scopedBills.filter((b) => b.contractorId === c.id);
    const approved = bills.filter((b) => b.approvalStatus === 'Approved');
    return {
      id: c.id, name: c.name, workType: c.workType, workforce: scopedWorkers.filter((w) => w.contractorId === c.id).length,
      bills: bills.length, approvedAmt: approved.reduce((s, b) => s + b.amount + b.tax, 0), status: c.status,
    };
  }).sort((a, b) => b.approvedAmt - a.approvedAmt), [scopedCtrs, scopedBills, scopedWorkers]);

  const manpowerRows = useMemo(() => db.mines.map((m) => {
    const ws = scopedWorkers.filter((w) => w.mineId === m.id);
    return { id: m.id, code: m.code, name: m.name, total: ws.length, contractor: ws.filter((w) => w.contractorId).length, direct: ws.filter((w) => !w.contractorId).length };
  }), [db.mines, scopedWorkers]);

  const finRows = useMemo(() => scopedBills.map((b) => ({
    id: b.id, ctr: scopedCtrs.find((c) => c.id === b.contractorId)?.name ?? b.contractorId,
    amount: b.amount + b.tax, paid: billPaid(b, db), approval: b.approvalStatus, payment: b.paymentStatus,
  })), [scopedBills, scopedCtrs, db]);

  const compRows = useMemo(() => scopedDocs.map((d) => ({
    id: d.id, name: d.name, cat: d.category, ref: d.refNo, exp: d.expiryDate, status: d.status,
  })), [scopedDocs]);

  // ---- Generated report history ----
  const reportHistory = useMemo(() => {
    const term = dq.trim().toLowerCase();
    return db.reports.filter((r) => !term || `${r.name} ${r.type}`.toLowerCase().includes(term));
  }, [db.reports, dq]);

  function genReport(name: string, type: ReportType, rows: unknown[], cols: [string, (r: any) => unknown][], from = '2026-10-01') {
    const csv = buildCsvString(rows, cols);
    actions.generateReport({ name, type, mineId, from, to: TODAY, rowCount: rows.length, csv });
  }

  function buildCsvString(rows: unknown[], cols: [string, (r: any) => unknown][]): string {
    const header = cols.map((c) => c[0]).join(',');
    const body = rows.map((r) => cols.map((c) => {
      const v = String(c[1](r) ?? '');
      return v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
    }).join(',')).join('\n');
    return `${header}\n${body}`;
  }

  function downloadReport(r: OpsReport) {
    const blob = new Blob([r.csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${r.name.replace(/\s+/g, '-').toLowerCase()}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  const prodCols: Column<ProductionRecord>[] = [
    { key: 'id', header: 'Record', render: (p) => <span className="font-mono font-bold">{p.id}</span>, sortValue: (p) => p.id },
    { key: 'd', header: 'Date', render: (p) => <span className="text-[12px]">{fmtDate(p.date)}</span>, sortValue: (p) => p.date },
    { key: 'mine', header: 'Mine', render: (p) => <span className="font-semibold">{getMine(p.mineId)?.code}</span>, sortValue: (p) => p.mineId },
    { key: 'g', header: 'Grade', render: (p) => p.grade, sortValue: (p) => p.grade },
    { key: 'q', header: 'Production (MT)', render: (p) => <span className="font-bold text-blue-600">{num(p.quantityMt)}</span>, sortValue: (p) => p.quantityMt },
    { key: 'ach', header: 'Achievement', render: (p) => { const a = pct(p.quantityMt, 800); return <span className={`font-bold ${a >= 100 ? 'text-green-600' : a >= 90 ? 'text-amber-600' : 'text-red-500'}`}>{a}%</span>; }, sortValue: (p) => pct(p.quantityMt, 800) },
    { key: 's', header: 'Status', render: () => <span className="badge bg-green-100 text-green-700">● Generated</span> },
  ];

  return (
    <OperationsShell nav={operatorNav} title="Reports & Analytics" sub="Operational reports and insights">
      <OpsBanner title="Reports & Analytics" sub="Get detailed reports on production, dispatch, manpower, stockpiles, compliance and financial transactions with visual insights and downloadable documents." />
      <div className="px-4 space-y-4">
        {!ready ? (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">{[...Array(5)].map((_, i) => <div key={i} className="card !p-4 animate-pulse"><div className="h-16 bg-slate-100 rounded-xl" /></div>)}</div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <KpiCard icon={<BarChart3 size={22} />} label="Total Production" value={mt(k.monthProd)} trend="+8%" context="This month" tileClass="bg-blue-50 text-blue-600" />
              <KpiCard icon={<Truck size={22} />} label="Total Dispatch" value={mt(k.monthDisp)} trend="+6%" context="This month" dotColor="#159B72" tileClass="bg-green-50 text-green-600" />
              <KpiCard icon={<Users size={22} />} label="Total Workers" value={num(k.onRoll)} trend="+3%" context={`${num(k.onSite)} on-site`} dotColor="#E8A02B" tileClass="bg-amber-50 text-amber-600" />
              <KpiCard icon={<TrendingUp size={22} />} label="Bills Processed" value={inrShort(k.billTotal)} trend="+8%" context="This financial year" dotColor="#7C5CFC" tileClass="bg-purple-50 text-purple-600" />
              <KpiCard icon={<Target size={22} />} label="Compliance Score" value={`${k.compliance}%`} trend="+4%" context="Overall" dotColor="#DC4C58" tileClass="bg-red-50 text-red-500" />
            </div>

            <SectionCard className="!p-0 !pb-4" title="" action={null}>
              <div className="px-4 -mt-1"><Tabs tabs={TABS} active={tab} onChange={setTab} /></div>
            </SectionCard>

            {tab === 'Production Report' && (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <SectionCard className="xl:col-span-2" title="Production Trend" subtitle="Target vs Actual with achievement %">
                  <TrendBars data={prodTrend} xKey="label" height={230}
                    bars={[{ key: 'target', name: 'Target (MT)', fill: '#93C5FD' }, { key: 'actual', name: 'Actual (MT)', fill: '#1463D9' }]}
                    line={{ key: 'achieve', name: 'Achievement (%)', stroke: '#159B72' }} />
                </SectionCard>
                <SectionCard title="Production by Grade (This Month)">
                  <Donut data={gradeDonut} centerValue={mt(k.monthProd)} centerLabel="Total Production" height={200} />
                </SectionCard>
                <SectionCard className="xl:col-span-2" title="Recent Production Data" action={
                  <div className="flex gap-2 items-center">
                    <button className="btn-primary !py-2 !bg-white !text-blue-700 border border-blue-600" onClick={() => genReport('Production Report (7d)', ReportType.Production, scopedProd.filter((p) => p.date >= '2026-09-27'), [['Record', (p: ProductionRecord) => p.id], ['Date', (p) => p.date], ['Mine', (p) => getMine(p.mineId)?.code], ['Grade', (p) => p.grade], ['Qty (MT)', (p) => p.quantityMt]])}>Generate Report</button>
                    <button className="btn-primary !py-2" onClick={() => setGenOpen(true)}><span className="inline-flex items-center gap-1"><Plus size={14} /> Generate</span></button>
                  </div>}>
                  <DataTable<ProductionRecord> columns={prodCols} rows={scopedProd} initialSize={10} onRowClick={(p) => genReport(`Production ${p.id}`, ReportType.Production, [p], [['Record', (x: ProductionRecord) => x.id], ['Date', (x) => x.date], ['Qty (MT)', (x) => x.quantityMt]])} />
                </SectionCard>
                <div className="space-y-4">
                  <SectionCard title="Mine-wise Production (This Month)">
                    <HBarRows data={mineBars.map((m) => ({ ...m, display: mt(m.value) }))} onPick={() => undefined} />
                  </SectionCard>
                  <SectionCard title="Quick Actions">
                    <QuickActions items={[
                      { label: 'Generate Production Report', icon: <FileText size={15} />, tileClass: 'bg-green-100 text-green-700', onClick: () => genReport('Production Report (month)', ReportType.Production, scopedProd.filter((p) => p.date.startsWith('2026-10')), [['Record', (p: ProductionRecord) => p.id], ['Date', (p) => p.date], ['Mine', (p) => getMine(p.mineId)?.code], ['Grade', (p) => p.grade], ['Qty (MT)', (p) => p.quantityMt]]) },
                      { label: 'Export to CSV', icon: <Download size={15} />, tileClass: 'bg-red-100 text-red-600', onClick: () => exportCsv('production-export', scopedProd, [['Record', (p: ProductionRecord) => p.id], ['Date', (p) => p.date], ['Qty (MT)', (p) => p.quantityMt]]) },
                      { label: 'Compare with Target', icon: <Target size={15} />, tileClass: 'bg-blue-100 text-blue-600', onClick: () => genReport('Target Comparison', ReportType.Custom, prodTrend, [['Date', (r: any) => r.label], ['Target', (r: any) => r.target], ['Actual', (r: any) => r.actual], ['Achievement %', (r: any) => r.achieve]]) },
                    ]} />
                  </SectionCard>
                </div>
              </div>
            )}

            {tab === 'Dispatch Report' && (
              <SectionCard title="Dispatch Report" subtitle={`${dispatchRows.length} dispatch records`} action={
                <button className="btn-primary !py-2" onClick={() => genReport('Dispatch Report', ReportType.Dispatch, dispatchRows, [['Dispatch', (r: any) => r.id], ['Date', (r: any) => r.date], ['Mine', (r: any) => r.mine], ['Destination', (r: any) => r.dest], ['Qty (MT)', (r: any) => r.qty], ['Truck', (r: any) => r.truck], ['Challan', (r: any) => r.challan]])}>Generate Report</button>}>
                <DataTable<any> columns={[
                  { key: 'id', header: 'Dispatch', render: (r) => <span className="font-mono font-bold">{r.id}</span>, sortValue: (r) => r.id },
                  { key: 'd', header: 'Date', render: (r) => <span className="text-[12px]">{fmtDate(r.date)}</span>, sortValue: (r) => r.date },
                  { key: 'm', header: 'Mine', render: (r) => <span className="font-semibold">{r.mine}</span> },
                  { key: 'dst', header: 'Destination', render: (r) => r.dest, sortValue: (r) => r.dest },
                  { key: 'q', header: 'Qty (MT)', render: (r) => <span className="font-bold">{num(r.qty)}</span>, sortValue: (r) => r.qty },
                  { key: 't', header: 'Truck', render: (r) => <span className="font-mono text-[12px]">{r.truck}</span> },
                  { key: 'c', header: 'Challan', render: (r) => <span className="font-mono text-[12px]">{r.challan}</span> },
                  { key: 's', header: 'Status', render: (r) => <StatusPill v={r.status} />, sortValue: (r) => r.status },
                ]} rows={dispatchRows} initialSize={10} />
              </SectionCard>
            )}

            {tab === 'Stockpile Report' && (
              <SectionCard title="Stockpile Report" subtitle="Utilization and movement per stockpile" action={
                <button className="btn-primary !py-2" onClick={() => genReport('Stockpile Report', ReportType.Stockpile, stockRows, [['Stockpile', (r: any) => r.name], ['Grade', (r: any) => r.grade], ['Production (MT)', (r: any) => r.prod], ['Dispatch (MT)', (r: any) => r.disp], ['Capacity (MT)', (r: any) => r.cap]])}>Generate Report</button>}>
                <DataTable<any> columns={[
                  { key: 'n', header: 'Stockpile', render: (r) => <span className="font-semibold text-navy">{r.name} ({r.code})</span>, sortValue: (r) => r.name },
                  { key: 'g', header: 'Grade', render: (r) => r.grade },
                  { key: 'p', header: 'Production (MT)', render: (r) => <span className="font-bold text-blue-600">{num(r.prod)}</span>, sortValue: (r) => r.prod },
                  { key: 'd', header: 'Dispatch (MT)', render: (r) => <span className="font-bold text-green-600">{num(r.disp)}</span>, sortValue: (r) => r.disp },
                  { key: 'c', header: 'Capacity', render: (r) => num(r.cap), sortValue: (r) => r.cap },
                  { key: 'u', header: 'Utilization', render: (r) => <span className="font-bold">{r.util}%</span>, sortValue: (r) => r.util },
                ]} rows={stockRows} initialSize={10} />
              </SectionCard>
            )}

            {tab === 'Contractor Report' && (
              <SectionCard title="Contractor Report" subtitle="Workforce and billing by contractor" action={
                <button className="btn-primary !py-2" onClick={() => genReport('Contractor Report', ReportType.Contractor, ctrRows, [['Contractor', (r: any) => r.name], ['Work Type', (r: any) => r.workType], ['Workforce', (r: any) => r.workforce], ['Bills', (r: any) => r.bills], ['Approved (₹)', (r: any) => r.approvedAmt], ['Status', (r: any) => r.status]])}>Generate Report</button>}>
                <DataTable<any> columns={[
                  { key: 'n', header: 'Contractor', render: (r) => <span className="font-semibold text-navy">{r.name}</span>, sortValue: (r) => r.name },
                  { key: 'w', header: 'Work Type', render: (r) => <span className="text-slate-600">{r.workType}</span> },
                  { key: 'wf', header: 'Workforce', render: (r) => <span className="font-bold">{r.workforce}</span>, sortValue: (r) => r.workforce },
                  { key: 'b', header: 'Bills', render: (r) => r.bills, sortValue: (r) => r.bills },
                  { key: 'a', header: 'Approved (₹)', render: (r) => <span className="font-bold">{inrShort(r.approvedAmt)}</span>, sortValue: (r) => r.approvedAmt },
                  { key: 's', header: 'Status', render: (r) => <StatusPill v={r.status} />, sortValue: (r) => r.status },
                ]} rows={ctrRows} initialSize={10} />
              </SectionCard>
            )}

            {tab === 'Manpower Report' && (
              <SectionCard title="Manpower Report" subtitle="Workforce deployment by mine" action={
                <button className="btn-primary !py-2" onClick={() => genReport('Manpower Report', ReportType.Manpower, manpowerRows, [['Mine', (r: any) => r.code], ['Total', (r: any) => r.total], ['Contractor', (r: any) => r.contractor], ['Direct', (r: any) => r.direct]])}>Generate Report</button>}>
                <DataTable<any> columns={[
                  { key: 'c', header: 'Mine', render: (r) => <span className="font-semibold">{r.code} — {r.name}</span>, sortValue: (r) => r.code },
                  { key: 't', header: 'Total', render: (r) => <span className="font-bold">{num(r.total)}</span>, sortValue: (r) => r.total },
                  { key: 'ct', header: 'Contractor', render: (r) => num(r.contractor), sortValue: (r) => r.contractor },
                  { key: 'd', header: 'Direct', render: (r) => num(r.direct), sortValue: (r) => r.direct },
                ]} rows={manpowerRows} initialSize={10} />
              </SectionCard>
            )}

            {tab === 'Financial Report' && (
              <SectionCard title="Financial Report" subtitle="Bill amounts and payments" action={
                <button className="btn-primary !py-2" onClick={() => genReport('Financial Report', ReportType.Financial, finRows, [['Bill', (r: any) => r.id], ['Contractor', (r: any) => r.ctr], ['Amount (₹)', (r: any) => r.amount], ['Paid (₹)', (r: any) => r.paid], ['Approval', (r: any) => r.approval], ['Payment', (r: any) => r.payment]])}>Generate Report</button>}>
                <DataTable<any> columns={[
                  { key: 'id', header: 'Bill', render: (r) => <span className="font-mono font-bold">{r.id}</span>, sortValue: (r) => r.id },
                  { key: 'c', header: 'Contractor', render: (r) => r.ctr },
                  { key: 'a', header: 'Amount', render: (r) => <span className="font-bold">{inrShort(r.amount)}</span>, sortValue: (r) => r.amount },
                  { key: 'p', header: 'Paid', render: (r) => <span className="text-green-600 font-bold">{inrShort(r.paid)}</span>, sortValue: (r) => r.paid },
                  { key: 'ap', header: 'Approval', render: (r) => <StatusPill v={r.approval} />, sortValue: (r) => r.approval },
                  { key: 'ps', header: 'Payment', render: (r) => <StatusPill v={r.payment} />, sortValue: (r) => r.payment },
                ]} rows={finRows} initialSize={10} />
              </SectionCard>
            )}

            {tab === 'Compliance Report' && (
              <SectionCard title="Compliance Report" subtitle="Document compliance status" action={
                <button className="btn-primary !py-2" onClick={() => genReport('Compliance Report', ReportType.Compliance, compRows, [['Document', (r: any) => r.name], ['Category', (r: any) => r.cat], ['Ref', (r: any) => r.ref], ['Expires', (r: any) => r.exp ?? 'N/A'], ['Status', (r: any) => r.status]])}>Generate Report</button>}>
                <DataTable<any> columns={[
                  { key: 'n', header: 'Document', render: (r) => <span className="font-semibold text-navy">{r.name}</span>, sortValue: (r) => r.name },
                  { key: 'c', header: 'Category', render: (r) => r.cat },
                  { key: 'r', header: 'Ref', render: (r) => <span className="font-mono text-[12px]">{r.ref}</span> },
                  { key: 'e', header: 'Expires', render: (r) => r.exp ? fmtDate(r.exp) : <span className="text-slate-400">N/A</span>, sortValue: (r) => r.exp ?? '' },
                  { key: 's', header: 'Status', render: (r) => <StatusPill v={r.status} />, sortValue: (r) => r.status },
                ]} rows={compRows} initialSize={10} />
              </SectionCard>
            )}

            {tab === 'Custom Reports' && (
              <SectionCard title="Custom Reports" subtitle="Generate and manage report history" action={
                <div className="flex gap-2 items-center">
                  <SearchInput value={q} onChange={setQ} onSearch={() => setDq(q)} ph="Search report name..." width="!w-52" />
                  <button className="btn-primary !py-2" onClick={() => setGenOpen(true)}><span className="inline-flex items-center gap-1"><Plus size={14} /> Generate Report</span></button>
                </div>}>
                {reportHistory.length === 0 ? <EmptyState title="No reports yet" sub="Generate a report from any tab or use the form here." action={<button className="btn-primary !py-2" onClick={() => setGenOpen(true)}>Generate Report</button>} /> : (
                  <DataTable<OpsReport> columns={[
                    { key: 'n', header: 'Report', render: (r) => <span className="font-semibold text-navy">{r.name}</span>, sortValue: (r) => r.name },
                    { key: 't', header: 'Type', render: (r) => <span className="text-slate-600">{r.type}</span>, sortValue: (r) => r.type },
                    { key: 'd', header: 'Generated', render: (r) => <span className="text-[12px]">{fmtDate(r.generatedAt.slice(0, 10))}</span>, sortValue: (r) => r.generatedAt },
                    { key: 'rows', header: 'Rows', render: (r) => num(r.rowCount), sortValue: (r) => r.rowCount },
                    { key: 's', header: 'Status', render: (r) => <StatusPill v={r.status} /> },
                    { key: 'a', header: '', render: (r) => (
                      <span className="space-x-2">
                        <button className="text-xs font-bold text-blue-600 hover:underline" onClick={() => downloadReport(r)}>Download</button>
                        <button className="text-xs font-bold text-slate-500" onClick={() => setDetail(r)}>View</button>
                        <button className="text-xs font-bold text-red-500 hover:underline" onClick={() => actions.deleteReport(r.id)}>Delete</button>
                      </span> ) },
                  ]} rows={reportHistory} initialSize={10} onRowClick={setDetail} />
                )}
              </SectionCard>
            )}
          </>
        )}
      </div>

      {/* ---- Report Drawer ---- */}
      {detail && (
        <DetailDrawer title={detail.name} onClose={() => setDetail(null)}>
          <Kv k="Type" v={detail.type} />
          <Kv k="Period" v={`${fmtDate(detail.from)} – ${fmtDate(detail.to)}`} />
          <Kv k="Generated" v={`${fmtDate(detail.generatedAt.slice(0, 10))} by ${detail.generatedBy}`} />
          <Kv k="Rows" v={num(detail.rowCount)} />
          <Kv k="Status" v={<StatusPill v={detail.status} />} />
          <Kv k="Schedule" v={detail.scheduled ? 'Weekly (demo)' : 'Not scheduled'} />
          <div className="mt-3">
            <button className="btn-primary !py-2 !text-xs" onClick={() => downloadReport(detail)}>Download CSV</button>
            <button className="btn-primary !py-2 !text-xs ml-2 !bg-white !text-blue-700 border border-blue-600" onClick={() => actions.toggleReportSchedule(detail.id)}>{detail.scheduled ? 'Remove Schedule' : 'Schedule Weekly (demo)'}</button>
          </div>
          <h4 className="font-extrabold text-navy mt-4 mb-1 text-sm">Preview</h4>
          <pre className="text-[10px] bg-slate-50 rounded-lg p-2 overflow-auto max-h-60 border border-slate-100">{detail.csv.split('\n').slice(0, 8).join('\n')}</pre>
        </DetailDrawer>
      )}

      {/* ---- Generate Modal ---- */}
      {genOpen && <GenerateReportModal onClose={() => setGenOpen(false)} onGenerate={genReport} />}
      <Toasts />
    </OperationsShell>
  );
}

function GenerateReportModal({ onClose, onGenerate }: { onClose: () => void; onGenerate: (name: string, type: ReportType, rows: unknown[], cols: [string, (r: any) => unknown][]) => void }) {
  const [name, setName] = useState('');
  const [type, setType] = useState<ReportType>(ReportType.Custom);
  const [err, setErr] = useState('');
  return (
    <Modal title="Generate Custom Report" onClose={onClose}>
      <Field label="Report name *" error={err}>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Weekly Operations Summary" />
      </Field>
      <Field label="Report type">
        <select className="input" value={type} onChange={(e) => setType(e.target.value as ReportType)}>
          {Object.values(ReportType).map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </Field>
      <p className="text-[11px] text-slate-400 mb-3">The report snapshots the current demo dataset and appears in Custom Reports with a downloadable CSV.</p>
      <div className="flex gap-2 justify-end">
        <button className="btn-primary !bg-white !text-navy border border-slate-300" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={() => {
          if (!name.trim()) { setErr('Report name is required.'); return; }
          onGenerate(name.trim(), type, [], [['Info', () => 'Custom report generated from Reports & Analytics (demo)']]);
          onClose();
        }}>Generate</button>
      </div>
    </Modal>
  );
}
