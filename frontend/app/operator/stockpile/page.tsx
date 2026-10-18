'use client';
/**
 * Page 6 — Stockpile Management.
 * Stock math is derived from the central store: opening + production − dispatch
 * (+ transfers in − out). Transfer, reconcile and add-stockpile flows mutate
 * the shared stockTx so every page sees the same balance.
 */
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertOctagon, ArrowRightLeft, Briefcase, FileText, Layers, Plus, Scale, Warehouse,
} from 'lucide-react';
import OperationsShell from '../../../components/operations/OperationsShell';
import { operatorNav } from '../nav';
import {
  Column, ConfirmDialog, DataTable, DetailDrawer, EmptyState, Field, KpiCard, Kv,
  LinkBtn, Modal, OpsBanner, PeriodSelect, QuickActions, SearchInput, SectionCard, StatusPill, Tabs, Toasts,
} from '../../../components/operations/ui';
import { Donut, TrendBars } from '../../../components/operations/charts';
import { CHART, TODAY, byMine, hrefWithTab, useMineScope, usePageReady, useTab } from '../../../components/operations/hooks';
import { actions, getMine, stockCurrent, stockStatusOf, useMockOps } from '../../../lib/ops/store';
import { fmtDate, fmtTime12, mt, num, pct } from '../../../lib/ops/format';
import { exportCsv } from '../../../lib/ops/export';
import { StockStatus, StockTxStatus, StockTxType, type Stockpile, type StockpileTransaction } from '../../../lib/ops/types';

const TABS = ['Stockpile Overview', 'Stockpile Details', 'Stock Transactions', 'Reconciliation', 'Stock Movement History'];

const TX_TONE: Record<string, string> = {
  [StockTxStatus.Added]: 'bg-green-100 text-green-700',
  [StockTxStatus.Deducted]: 'bg-red-100 text-red-600',
  [StockTxStatus.Transferred]: 'bg-blue-100 text-blue-700',
  [StockTxStatus.Reconciled]: 'bg-amber-100 text-amber-700',
};

export default function StockpilePage() {
  const ready = usePageReady();
  const router = useRouter();
  const db = useMockOps();
  const mineId = useMineScope();
  const [tab, setTab] = useTab(TABS[0]);

  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');
  const [fGrade, setFGrade] = useState('All Grades');
  const [fStatus, setFStatus] = useState('All Status');
  const [selected, setSelected] = useState<string[]>([]);
  const [detail, setDetail] = useState<Stockpile | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [reconcileFor, setReconcileFor] = useState<Stockpile | null>(null);
  const [period, setPeriod] = useState('Last 7 Days');

  const scopedPiles = useMemo(() => byMine(db.stockpiles, mineId), [db.stockpiles, mineId]);
  const pileMine = useMemo(() => new Map(db.stockpiles.map((s) => [s.id, s.mineId])), [db.stockpiles]);
  const scopedTx = useMemo(() => db.stockTx.filter((t) => {
    const m = pileMine.get(t.stockpileId);
    return mineId === 'ALL' || m === mineId;
  }), [db.stockTx, pileMine, mineId]);
  const scopedProd = useMemo(() => byMine(db.production, mineId), [db.production, mineId]);
  const scopedDisp = useMemo(() => byMine(db.dispatches, mineId), [db.dispatches, mineId]);

  // ---- KPIs ----
  const k = useMemo(() => {
    const totalStock = scopedPiles.reduce((s, sp) => s + stockCurrent(sp.id, db), 0);
    const prodToday = scopedProd.filter((p) => p.date === TODAY).reduce((s, p) => s + p.quantityMt, 0);
    const dispToday = scopedDisp.filter((d) => d.date === TODAY).reduce((s, d) => s + d.quantityMt, 0);
    const reconVariance = scopedTx.filter((t) => t.type === StockTxType.Reconciliation && t.date === TODAY)
      .reduce((s, t) => s + (t.status === StockTxStatus.Added ? t.quantityMt : -t.quantityMt), 0);
    const lowAlerts = scopedPiles.filter((sp) => stockStatusOf(sp, db) === StockStatus.Low).length;
    const highAlerts = scopedPiles.filter((sp) => stockStatusOf(sp, db) === StockStatus.High).length;
    return { totalStock, prodToday, dispToday, reconVariance, lowAlerts, highAlerts, piles: scopedPiles.length };
  }, [scopedPiles, scopedProd, scopedDisp, scopedTx, db]);

  // ---- Stock movement trend ----
  const trend = useMemo(() => {
    const n = period === 'Last 30 Days' ? 30 : 7;
    const out: { label: string; date: string; prod: number; disp: number; closing: number }[] = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(`${TODAY}T00:00:00+05:30`);
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const prod = scopedProd.filter((p) => p.date === iso).reduce((s, p) => s + p.quantityMt, 0);
      const disp = scopedDisp.filter((x) => x.date === iso).reduce((s, x) => s + x.quantityMt, 0);
      out.push({ label: `${iso.slice(8, 10)} ${d.toLocaleString('en', { month: 'short' })}`, date: iso, prod, disp, closing: prod - disp });
    }
    return out;
  }, [scopedProd, scopedDisp, period]);

  // ---- Coal grade distribution ----
  const gradeDonut = useMemo(() => {
    const m = new Map<string, number>();
    scopedPiles.forEach((sp) => m.set(sp.grade, (m.get(sp.grade) ?? 0) + stockCurrent(sp.id, db)));
    return [...m.entries()].map(([name, value]) => ({ name: `${name} Grade`, value })).sort((a, b) => b.value - a.value);
  }, [scopedPiles, db]);

  // ---- Stockpile table filtering ----
  const filtered = useMemo(() => {
    const term = dq.trim().toLowerCase();
    return scopedPiles.filter((sp) =>
      (!term || `${sp.name} ${sp.code} ${sp.grade} ${sp.area}`.toLowerCase().includes(term)) &&
      (fGrade === 'All Grades' || sp.grade === fGrade) &&
      (fStatus === 'All Status' || stockStatusOf(sp, db) === fStatus));
  }, [scopedPiles, dq, fGrade, fStatus, db]);

  const gradeList = useMemo(() => ['All Grades', ...new Set(scopedPiles.map((sp) => sp.grade))], [scopedPiles]);
  const statusList = ['All Status', StockStatus.Normal, StockStatus.Low, StockStatus.High];

  function exportPiles() {
    exportCsv(`stockpiles-${mineId === 'ALL' ? 'all-mines' : getMine(mineId)?.code ?? mineId}-${TODAY}`, filtered,
      [['Code', (sp: Stockpile) => sp.code], ['Name', (sp) => sp.name], ['Grade', (sp) => sp.grade],
      ['Area', (sp) => sp.area], ['Current (MT)', (sp) => stockCurrent(sp.id, db)], ['Capacity (MT)', (sp) => sp.capacityMt],
      ['Utilization %', (sp) => pct(stockCurrent(sp.id, db), sp.capacityMt)], ['Status', (sp) => stockStatusOf(sp, db)]]);
  }

  const pileCols: Column<Stockpile>[] = [
    { key: 'name', header: 'Stockpile', render: (sp) => (
      <span className="flex items-center gap-2">
        <span className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold shrink-0">{sp.code.slice(-2)}</span>
        <span><span className="block font-bold text-navy text-[13px]">{sp.name}</span><span className="block text-[11px] text-slate-400 font-mono">{sp.code}</span></span>
      </span> ), sortValue: (sp) => sp.name },
    { key: 'area', header: 'Location', render: (sp) => <span className="text-slate-600">{sp.area}</span>, sortValue: (sp) => sp.area },
    { key: 'grade', header: 'Grade', render: (sp) => <span className="badge bg-blue-100 text-blue-700">{sp.grade}</span>, sortValue: (sp) => sp.grade },
    { key: 'cur', header: 'Current Stock', render: (sp) => <span className="font-bold text-navy">{num(stockCurrent(sp.id, db))}</span>, sortValue: (sp) => stockCurrent(sp.id, db) },
    { key: 'cap', header: 'Capacity', render: (sp) => <span className="text-slate-600">{num(sp.capacityMt)}</span>, sortValue: (sp) => sp.capacityMt },
    { key: 'util', header: 'Utilization', render: (sp) => { const u = pct(stockCurrent(sp.id, db), sp.capacityMt); return (
      <span className="flex items-center gap-2"><span className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden"><span className="block h-full rounded-full" style={{ width: `${Math.min(100, u)}%`, background: u > 85 ? '#DC4C58' : u < 25 ? '#E8A02B' : '#1463D9' }} /></span><span className="font-bold">{u}%</span></span> ); }, sortValue: (sp) => pct(stockCurrent(sp.id, db), sp.capacityMt) },
    { key: 'status', header: 'Status', render: (sp) => <StatusPill v={stockStatusOf(sp, db)} />, sortValue: (sp) => stockStatusOf(sp, db) },
  ];

  return (
    <OperationsShell nav={operatorNav} title="Stockpile Management" sub="Stock inventory and reconciliation">
      <OpsBanner title="Stockpile Management" sub="Monitor coal stockpiles, track inventory, reconcile production and dispatch, and ensure accurate stock records across all mine locations." />
      <div className="px-4 space-y-4">
        {!ready ? (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">{[...Array(5)].map((_, i) => <div key={i} className="card !p-4 animate-pulse"><div className="h-16 bg-slate-100 rounded-xl" /></div>)}</div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <KpiCard icon={<Warehouse size={22} />} label="Total Stock (On-Site)" value={mt(k.totalStock)} trend="+5%" context={`Across ${k.piles} stockpiles`} tileClass="bg-blue-50 text-blue-600" />
              <KpiCard icon={<Layers size={22} />} label="Production Today" value={mt(k.prodToday)} trend="+8%" context="From mine pit" dotColor="#159B72" tileClass="bg-green-50 text-green-600" />
              <KpiCard icon={<ArrowRightLeft size={22} />} label="Dispatched Today" value={mt(k.dispToday)} trend="+6%" context={`${scopedDisp.filter((d) => d.date === TODAY).length} trucks`} dotColor="#7C5CFC" tileClass="bg-purple-50 text-purple-600" />
              <KpiCard icon={<Briefcase size={22} />} label="Stock Reconciliation" value={`${k.reconVariance >= 0 ? '+' : ''}${num(k.reconVariance)} MT`} context={Math.abs(k.reconVariance) > 100 ? 'Check variance' : 'Within tolerance'} dotColor="#1463D9" tileClass="bg-blue-50 text-blue-600" />
              <KpiCard icon={<AlertOctagon size={22} />} label="Low Stock Alerts" value={num(k.lowAlerts)} context={k.highAlerts > 0 ? `${k.highAlerts} high-stock` : 'Require attention'} dotColor={k.lowAlerts > 0 ? '#DC4C58' : '#94a3b8'} tileClass="bg-red-50 text-red-500" />
            </div>

            <SectionCard className="!p-0 !pb-4" title="" action={null}>
              <div className="px-4 -mt-1"><Tabs tabs={TABS} active={tab} onChange={setTab} /></div>
            </SectionCard>

            {tab === 'Stockpile Overview' && (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <SectionCard className="xl:col-span-2" title="Stock Movement Trend" action={<PeriodSelect value={period} onChange={setPeriod} options={['Last 7 Days', 'Last 30 Days']} />}>
                  <TrendBars data={trend} xKey="label" height={240}
                    bars={[{ key: 'prod', name: 'Production (MT)', fill: '#1463D9' }, { key: 'disp', name: 'Dispatch (MT)', fill: '#159B72' }]} />
                </SectionCard>
                <SectionCard title="Coal Grade Distribution (On-Site)">
                  <Donut data={gradeDonut} centerValue={mt(k.totalStock)} centerLabel="Total Stock" height={200} />
                </SectionCard>

                <SectionCard className="xl:col-span-2" title={`Current Stockpile Status (${filtered.length})`} action={
                  <div className="flex gap-2 flex-wrap items-center">
                    <SearchInput value={q} onChange={setQ} onSearch={() => setDq(q)} ph="Search stockpile name, grade..." width="!w-48" />
                    <select className="input !w-36 !py-2 !text-[13px]" value={fGrade} onChange={(e) => setFGrade(e.target.value)} aria-label="Grade filter">{gradeList.map((g) => <option key={g}>{g}</option>)}</select>
                    <select className="input !w-36 !py-2 !text-[13px]" value={fStatus} onChange={(e) => setFStatus(e.target.value)} aria-label="Status filter">{statusList.map((s) => <option key={s}>{s}</option>)}</select>
                    <button className="btn-primary !py-2" onClick={exportPiles}>Export</button>
                    <button className="btn-primary !py-2" onClick={() => setAddOpen(true)}><span className="inline-flex items-center gap-1"><Plus size={14} /> Add Stockpile</span></button>
                  </div>}>
                  <DataTable<Stockpile> columns={pileCols} rows={filtered} selectable onSelected={setSelected} onRowClick={setDetail}
                    emptyTitle="No stockpiles match" emptyText="Adjust filters or add a stockpile."
                    actions={(sp) => <span className="space-x-2">
                      <button className="text-xs font-bold text-blue-600 hover:underline" onClick={() => setDetail(sp)}>View</button>
                      <button className="text-xs font-bold text-purple-600 hover:underline" onClick={() => { setDetail(sp); setTransferOpen(true); }}>Transfer</button>
                    </span>} />
                </SectionCard>

                <div className="space-y-4">
                  <SectionCard title="Stockpile Capacity Utilization" action={<LinkBtn onClick={() => setTab('Stockpile Details')}>View All</LinkBtn>}>
                    <div className="space-y-2.5">
                      {scopedPiles.map((sp) => {
                        const u = pct(stockCurrent(sp.id, db), sp.capacityMt);
                        return (
                          <button key={sp.id} onClick={() => setDetail(sp)} className="w-full text-left hover:opacity-80">
                            <div className="flex items-center gap-2 text-[12px] mb-1">
                              <span className="font-bold text-navy truncate">{sp.name} ({sp.code})</span>
                              <span className="ml-auto font-extrabold">{u}%</span>
                            </div>
                            <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                              <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, u)}%`, background: u > 85 ? '#DC4C58' : u < 25 ? '#E8A02B' : '#1463D9' }} />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </SectionCard>

                  <SectionCard title="Quick Actions">
                    <QuickActions items={[
                      { label: 'Add Stockpile', icon: <Plus size={15} />, tileClass: 'bg-blue-100 text-blue-600', onClick: () => setAddOpen(true) },
                      { label: 'Transfer Stock', icon: <ArrowRightLeft size={15} />, tileClass: 'bg-purple-100 text-purple-600', onClick: () => setTransferOpen(true) },
                      { label: 'Reconcile Stock', icon: <Scale size={15} />, tileClass: 'bg-red-100 text-red-600', onClick: () => setReconcileFor(scopedPiles[0] ?? null) },
                      { label: 'Generate Stock Report', icon: <FileText size={15} />, tileClass: 'bg-amber-100 text-amber-700', onClick: () => { exportPiles(); } },
                      { label: 'View Stock History', icon: <Layers size={15} />, tileClass: 'bg-blue-100 text-blue-600', onClick: () => setTab('Stock Movement History') },
                    ]} />
                  </SectionCard>

                  <SectionCard title="Recent Stock Transactions" action={<LinkBtn onClick={() => setTab('Stock Transactions')}>View All</LinkBtn>}>
                    <div className="space-y-1.5">
                      {scopedTx.slice(0, 6).map((t) => (
                        <div key={t.id} className="flex items-center gap-2 py-1.5 border-b border-slate-50 last:border-0 text-[12px]">
                          <span className="text-slate-400 w-16 shrink-0">{t.date.slice(8, 10)} {new Date(`${t.date}T00:00:00+05:30`).toLocaleString('en', { month: 'short' })}</span>
                          <span className={`badge ${TX_TONE[t.status]} shrink-0`}>{t.type}</span>
                          <span className="flex-1 min-w-0 truncate font-semibold text-navy">{t.stockpileId}{t.toStockpileId ? ` → ${t.toStockpileId}` : ''} · {t.reference}</span>
                          <span className="font-bold whitespace-nowrap">{t.type === StockTxType.Dispatch || t.status === StockTxStatus.Deducted ? '−' : '+'}{num(t.quantityMt)}</span>
                        </div>
                      ))}
                    </div>
                  </SectionCard>
                </div>

                <div className="xl:col-span-3">
                  <SectionCard title="Stockpile Map (Live View)" subtitle="Schematic representation — positions are from seed data">
                    <div className="bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl p-4 relative" style={{ minHeight: 260 }}>
                      <div className="text-[10px] font-bold text-slate-400 mb-2">AERIAL SCHEMATIC · SIMULATED</div>
                      <div className="flex flex-wrap gap-4 justify-center items-center py-6">
                        {scopedPiles.map((sp) => {
                          const cur = stockCurrent(sp.id, db);
                          const u = pct(cur, sp.capacityMt);
                          const color = u > 85 ? '#DC4C58' : u < 25 ? '#E8A02B' : sp.grade === 'G8' ? '#1463D9' : sp.grade === 'G10' ? '#159B72' : sp.grade === 'G12' ? '#E8A02B' : '#7C5CFC';
                          return (
                            <button key={sp.id} onClick={() => setDetail(sp)} className="rounded-xl px-4 py-3 text-center hover:scale-105 transition-transform" style={{ background: `${color}20`, border: `2px solid ${color}` }}>
                              <div className="font-mono text-[11px] font-bold" style={{ color }}>{sp.code}</div>
                              <div className="text-[13px] font-extrabold text-navy">{num(cur)} MT</div>
                              <div className="text-[10px] text-slate-500">{u}% capacity</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </SectionCard>
                </div>
              </div>
            )}

            {tab === 'Stockpile Details' && (
              <SectionCard title="Stockpile Details" subtitle="Full inventory with current balances">
                <DataTable<Stockpile> columns={pileCols} rows={scopedPiles} selectable onSelected={setSelected} onRowClick={setDetail}
                  actions={(sp) => <span className="space-x-2">
                    <button className="text-xs font-bold text-blue-600 hover:underline" onClick={() => setDetail(sp)}>View</button>
                    <button className="text-xs font-bold text-purple-600 hover:underline" onClick={() => { setDetail(sp); setTransferOpen(true); }}>Transfer</button>
                    <button className="text-xs font-bold text-red-500 hover:underline" onClick={() => setReconcileFor(sp)}>Reconcile</button>
                  </span>} />
              </SectionCard>
            )}

            {tab === 'Stock Transactions' && (
              <StockTxTab tx={scopedTx} />
            )}

            {tab === 'Reconciliation' && (
              <ReconciliationTab tx={scopedTx} stockpiles={scopedPiles} onReconcile={(sp) => setReconcileFor(sp)} />
            )}

            {tab === 'Stock Movement History' && (
              <SectionCard title="Stock Movement History" subtitle="All transactions affecting stock balances" action={
                <button className="btn-primary !py-2" onClick={() => exportCsv(`stock-history-${TODAY}`, scopedTx, [['Date', (t: StockpileTransaction) => t.date], ['Type', (t) => t.type], ['Stockpile', (t) => t.stockpileId], ['To', (t) => t.toStockpileId ?? ''], ['Qty (MT)', (t) => t.quantityMt], ['Ref', (t) => t.reference], ['Status', (t) => t.status]])}>Export History</button>}>
                <StockTxTab tx={scopedTx} embedded />
              </SectionCard>
            )}
          </>
        )}
      </div>

      {/* ---- Detail Drawer ---- */}
      {detail && (
        <DetailDrawer title={`${detail.name} (${detail.code})`} onClose={() => setDetail(null)}>
          <Kv k="Current Stock" v={<span className="font-bold">{mt(stockCurrent(detail.id, db))}</span>} />
          <Kv k="Capacity" v={mt(detail.capacityMt)} />
          <Kv k="Utilization" v={`${pct(stockCurrent(detail.id, db), detail.capacityMt)}%`} />
          <Kv k="Status" v={<StatusPill v={stockStatusOf(detail, db)} />} />
          <Kv k="Grade" v={detail.grade} />
          <Kv k="Area" v={detail.area} />
          <Kv k="Mine" v={`${getMine(detail.mineId)?.name} (${getMine(detail.mineId)?.code})`} />
          <h4 className="font-extrabold text-navy mt-4 mb-1 text-sm">Recent Transactions</h4>
          {db.stockTx.filter((t) => t.stockpileId === detail.id || t.toStockpileId === detail.id).slice(0, 6).map((t) => (
            <div key={t.id} className="flex items-center gap-2 text-[12px] py-1 border-b border-slate-50 last:border-0">
              <span className="badge shrink-0">{t.type}</span>
              <span className="flex-1 truncate">{t.reference}</span>
              <span className="font-bold">{t.quantityMt} MT</span>
            </div>
          ))}
          <div className="flex gap-2 mt-4">
            <button className="btn-primary !py-2 !text-xs" onClick={() => setTransferOpen(true)}>Transfer Stock</button>
            <button className="btn-primary !py-2 !text-xs !bg-white !text-red-500 border border-red-300" onClick={() => setReconcileFor(detail)}>Reconcile</button>
          </div>
        </DetailDrawer>
      )}

      {/* ---- Modals ---- */}
      {addOpen && <AddStockpileModal mineId={mineId} onClose={() => setAddOpen(false)} />}
      {transferOpen && <TransferModal stockpileId={detail?.id ?? ''} onClose={() => setTransferOpen(false)} />}
      {reconcileFor && <ReconcileModal stockpile={reconcileFor} onClose={() => setReconcileFor(null)} />}
      <Toasts />
    </OperationsShell>
  );
}

// ---------- Sub-tabs ----------
function StockTxTab({ tx, embedded }: { tx: StockpileTransaction[]; embedded?: boolean }) {
  const db = useMockOps();
  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');
  const [fType, setFType] = useState('All Types');
  const filtered = useMemo(() => {
    const term = dq.trim().toLowerCase();
    return tx.filter((t) => (!term || `${t.reference} ${t.counterparty} ${t.stockpileId}`.toLowerCase().includes(term)) && (fType === 'All Types' || t.type === fType));
  }, [tx, dq, fType]);
  const pileName = (id: string | null) => id ? (db.stockpiles.find((s) => s.id === id)?.name ?? id) : '—';
  const table = (
    <DataTable<StockpileTransaction> columns={[
      { key: 'dt', header: 'Date & Time', render: (t) => <span className="text-[12px]">{fmtDate(t.date)}, {fmtTime12(t.timestamp)}</span>, sortValue: (t) => t.timestamp },
      { key: 'ty', header: 'Type', render: (t) => <span className={`badge ${TX_TONE[t.status]}`}>{t.type}</span>, sortValue: (t) => t.type },
      { key: 'sp', header: 'Stockpile', render: (t) => <span className="font-semibold">{pileName(t.stockpileId)}{t.toStockpileId ? ` → ${pileName(t.toStockpileId)}` : ''}</span> },
      { key: 'qt', header: 'Quantity (MT)', render: (t) => <span className="font-bold">{num(t.quantityMt)}</span>, sortValue: (t) => t.quantityMt },
      { key: 'rf', header: 'Reference', render: (t) => <span className="font-mono text-[12px]">{t.reference}</span>, sortValue: (t) => t.reference },
      { key: 'cp', header: 'Source / Destination', render: (t) => <span className="text-slate-600">{t.counterparty}</span> },
      { key: 'st', header: 'Status', render: (t) => <StatusPill v={t.status} />, sortValue: (t) => t.status },
    ]} rows={filtered} initialSize={10} />
  );
  if (embedded) return table;
  return (
    <SectionCard title={`Stock Transactions (${filtered.length})`} action={
      <div className="flex gap-2 items-center">
        <SearchInput value={q} onChange={setQ} onSearch={() => setDq(q)} ph="Search reference, counterparty..." width="!w-48" />
        <select className="input !w-36 !py-2 !text-[13px]" value={fType} onChange={(e) => setFType(e.target.value)} aria-label="Type filter">
          {['All Types', StockTxType.Production, StockTxType.Dispatch, StockTxType.Transfer, StockTxType.Reconciliation].map((t) => <option key={t}>{t}</option>)}
        </select>
        <button className="btn-primary !py-2" onClick={() => { setDq(''); setQ(''); setFType('All Types'); }}>Reset</button>
      </div>}>
      {table}
    </SectionCard>
  );
}

function ReconciliationTab({ tx, stockpiles, onReconcile }: { tx: StockpileTransaction[]; stockpiles: Stockpile[]; onReconcile: (sp: Stockpile) => void }) {
  const db = useMockOps();
  const reconTx = tx.filter((t) => t.type === StockTxType.Reconciliation);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <SectionCard title="Stockpile Balances vs Physical" subtitle="System balance derived from transactions" action={<button className="btn-primary !py-2" onClick={() => onReconcile(stockpiles[0])}>Run Reconciliation</button>}>
        <DataTable<Stockpile> columns={[
          { key: 'n', header: 'Stockpile', render: (sp) => <span className="font-semibold text-navy">{sp.name} ({sp.code})</span>, sortValue: (sp) => sp.name },
          { key: 'sys', header: 'System (MT)', render: (sp) => <span className="font-bold">{num(stockCurrent(sp.id, db))}</span>, sortValue: (sp) => stockCurrent(sp.id, db) },
          { key: 'st', header: 'Status', render: (sp) => <StatusPill v={stockStatusOf(sp, db)} />, sortValue: (sp) => stockStatusOf(sp, db) },
          { key: 'a', header: '', render: (sp) => <button className="text-xs font-bold text-blue-600 hover:underline" onClick={() => onReconcile(sp)}>Reconcile</button> },
        ]} rows={stockpiles} initialSize={10} />
      </SectionCard>
      <SectionCard title={`Reconciliation History (${reconTx.length})`}>
        {reconTx.length === 0 ? <EmptyState title="No reconciliations yet" sub="Run a reconciliation to record physical stock vs system balance." /> : (
          <DataTable<StockpileTransaction> columns={[
            { key: 'd', header: 'Date', render: (t) => <span className="text-[12px]">{fmtDate(t.date)}</span>, sortValue: (t) => t.date },
            { key: 's', header: 'Stockpile', render: (t) => stockpiles.find((sp) => sp.id === t.stockpileId)?.name ?? t.stockpileId },
            { key: 'v', header: 'Variance (MT)', render: (t) => <span className={`font-bold ${t.status === StockTxStatus.Added ? 'text-green-600' : 'text-red-500'}`}>{t.status === StockTxStatus.Added ? '+' : '−'}{num(t.quantityMt)}</span>, sortValue: (t) => t.quantityMt },
            { key: 'r', header: 'Note', render: (t) => <span className="text-[12px] text-slate-600">{t.counterparty}</span> },
          ]} rows={reconTx} initialSize={10} />
        )}
      </SectionCard>
    </div>
  );
}

// ---------- Sub-modal forms ----------
function AddStockpileModal({ mineId, onClose }: { mineId: string; onClose: () => void }) {
  const db = useMockOps();
  const scope = mineId === 'ALL' ? 'M-01' : mineId;
  const [f, setF] = useState({ code: `SP-${String(db.stockpiles.length + 1).padStart(2, '0')}`, name: '', area: '', capacityMt: '', openingMt: '', grade: 'G8' });
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  function submit() {
    const e: Record<string, string> = {};
    if (!f.name.trim()) e.name = 'Stockpile name is required.';
    if (db.stockpiles.some((s) => s.code.toLowerCase() === f.code.trim().toLowerCase())) e.code = 'This code already exists.';
    if (!(Number(f.capacityMt) > 0)) e.capacityMt = 'Capacity must be greater than 0.';
    if (Number(f.openingMt) < 0 || Number(f.openingMt) > Number(f.capacityMt)) e.openingMt = 'Opening stock must be between 0 and capacity.';
    setErr(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      actions.createStockpile({ mineId: scope, code: f.code.trim().toUpperCase(), name: f.name.trim(), area: f.area.trim(), capacityMt: Number(f.capacityMt), openingMt: Number(f.openingMt), grade: f.grade });
      onClose();
    } catch (ex: any) { setErr({ form: ex.message }); } finally { setBusy(false); }
  }

  return (
    <Modal title="Add Stockpile" onClose={onClose}>
      {err.form && <div className="text-[12px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-2" role="alert">{err.form}</div>}
      <div className="grid sm:grid-cols-2 gap-x-3">
        <Field label="Code *" error={err.code}><input className="input" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></Field>
        <Field label="Name *" error={err.name}><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. South Yard" /></Field>
        <Field label="Area"><input className="input" value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} placeholder="e.g. South Sector" /></Field>
        <Field label="Grade">
          <select className="input" value={f.grade} onChange={(e) => setF({ ...f, grade: e.target.value })}>
            {['G8', 'G10', 'G12', 'Washed', 'Mixed', 'Other'].map((g) => <option key={g}>{g}</option>)}
          </select>
        </Field>
        <Field label="Capacity (MT) *" error={err.capacityMt}><input className="input" type="number" min={0} value={f.capacityMt} onChange={(e) => setF({ ...f, capacityMt: e.target.value })} /></Field>
        <Field label="Opening Stock (MT)" error={err.openingMt}><input className="input" type="number" min={0} value={f.openingMt} onChange={(e) => setF({ ...f, openingMt: e.target.value })} /></Field>
      </div>
      <div className="flex gap-2 justify-end">
        <button className="btn-primary !bg-white !text-navy border border-slate-300" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={submit} disabled={busy}>{busy ? 'Saving…' : 'Add Stockpile'}</button>
      </div>
    </Modal>
  );
}

function TransferModal({ stockpileId, onClose }: { stockpileId: string; onClose: () => void }) {
  const db = useMockOps();
  const [f, setF] = useState({ from: stockpileId || db.stockpiles[0]?.id || '', to: db.stockpiles[1]?.id || '', quantityMt: '', reference: `TR-2026-${String(db.stockTx.filter((t) => t.type === StockTxType.Transfer).length + 1).padStart(3, '0')}` });
  const [err, setErr] = useState<Record<string, string>>({});
  const fromPile = db.stockpiles.find((s) => s.id === f.from);
  const toPile = db.stockpiles.find((s) => s.id === f.to);
  const avail = fromPile ? stockCurrent(fromPile.id, db) : 0;

  function submit() {
    const e: Record<string, string> = {};
    const q = Number(f.quantityMt);
    if (f.from === f.to) e.to = 'Source and destination must differ.';
    if (!(q > 0)) e.quantityMt = 'Quantity must be greater than 0.';
    if (q > avail) e.quantityMt = `Insufficient stock: available ${avail.toFixed(3)} MT.`;
    setErr(e);
    if (Object.keys(e).length) return;
    try {
      actions.transferStock({ stockpileId: f.from, toStockpileId: f.to, quantityMt: q, reference: f.reference });
      onClose();
    } catch (ex: any) { setErr({ form: ex.message }); }
  }

  return (
    <Modal title="Transfer Stock" onClose={onClose}>
      {err.form && <div className="text-[12px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-2" role="alert">{err.form}</div>}
      <Field label="From stockpile" hint={`Available: ${avail.toFixed(3)} MT`}>
        <select className="input" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })}>
          {db.stockpiles.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code}) — {stockCurrent(s.id, db).toFixed(3)} MT</option>)}
        </select>
      </Field>
      <Field label="To stockpile" error={err.to}>
        <select className="input" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })}>
          {db.stockpiles.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
        </select>
      </Field>
      <Field label="Quantity (MT) *" error={err.quantityMt}>
        <input className="input" type="number" step="0.001" min={0} value={f.quantityMt} onChange={(e) => setF({ ...f, quantityMt: e.target.value })} placeholder="e.g. 500" />
      </Field>
      <Field label="Reference">
        <input className="input" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} />
      </Field>
      <div className="flex gap-2 justify-end">
        <button className="btn-primary !bg-white !text-navy border border-slate-300" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={submit}>Transfer</button>
      </div>
    </Modal>
  );
}

function ReconcileModal({ stockpile, onClose }: { stockpile: Stockpile; onClose: () => void }) {
  const db = useMockOps();
  const sys = stockCurrent(stockpile.id, db);
  const [physical, setPhysical] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const variance = physical ? Number(physical) - sys : 0;

  return (
    <Modal title={`Reconcile ${stockpile.name}`} onClose={onClose}>
      <p className="text-[12px] text-slate-600 mb-3">System balance: <span className="font-bold">{sys.toFixed(3)} MT</span>. Enter the surveyed physical stock.</p>
      <Field label="Physical stock (MT)" error={err}>
        <input className="input" type="number" step="0.001" value={physical} onChange={(e) => setPhysical(e.target.value)} placeholder={sys.toFixed(3)} />
      </Field>
      {physical && (
        <div className={`text-[12px] font-semibold mb-2 ${Math.abs(variance) > sys * 0.1 + 500 ? 'text-red-600' : 'text-blue-600'}`}>
          Variance: {variance >= 0 ? '+' : ''}{variance.toFixed(3)} MT {Math.abs(variance) > sys * 0.1 + 500 && '— exceeds tolerance'}
        </div>
      )}
      <Field label="Note / surveyor">
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Survey Team A" />
      </Field>
      <div className="flex gap-2 justify-end">
        <button className="btn-primary !bg-white !text-navy border border-slate-300" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={() => {
          if (!physical || !(Number(physical) >= 0)) { setErr('Enter a valid physical stock figure.'); return; }
          try { actions.reconcileStock(stockpile.id, Number(physical), note); onClose(); } catch (e: any) { setErr(e.message); }
        }}>Save Reconciliation</button>
      </div>
    </Modal>
  );
}
