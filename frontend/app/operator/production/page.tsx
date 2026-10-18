'use client';
/**
 * Page 5 — Production & Dispatch.
 * Workflow 3 lives here: Record Dispatch updates the dispatch table, the
 * Production vs Dispatch chart, the stock balance (via stockTx) and the
 * destination donut. 7 tabs; weighbridge feed derived from dispatch records.
 */
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertOctagon, BarChart3, FileText, Plus, Scale, Truck, Upload, Weight,
} from 'lucide-react';
import OperationsShell from '../../../components/operations/OperationsShell';
import { operatorNav } from '../nav';
import {
  Column, DataTable, DetailDrawer, EmptyState, Field, KpiCard, Kv, LinkBtn, Modal,
  OpsBanner, PeriodSelect, QuickActions, SearchInput, SectionCard, SimulatedNote, StatusPill, Tabs, Toasts,
} from '../../../components/operations/ui';
import { Donut, HBarRows, TrendBars } from '../../../components/operations/charts';
import { CHART, TODAY, byMine, hrefWithTab, useMineScope, usePageReady, useTab } from '../../../components/operations/hooks';
import { RecordProductionModal } from '../../../components/operations/modals';
import { actions, getMine, stockCurrent, useMockOps } from '../../../lib/ops/store';
import { fmtDate, fmtTime12, mt, num, pct } from '../../../lib/ops/format';
import { exportCsv } from '../../../lib/ops/export';
import { Destination, DispatchStatus, type DispatchRecord, type ProductionRecord } from '../../../lib/ops/types';

const TABS = ['Overview', 'Production Records', 'Weighbridge Transactions', 'Dispatch Records', 'Truck Movement', 'Destination & Challan', 'Analysis'];

const DISP_TONE: Record<string, string> = {
  [DispatchStatus.Dispatched]: 'bg-green-100 text-green-700',
  [DispatchStatus.InTransit]: 'bg-amber-100 text-amber-700',
  [DispatchStatus.Pending]: 'bg-red-100 text-red-600',
  [DispatchStatus.Cancelled]: 'bg-purple-100 text-purple-700',
};

export default function ProductionDispatchPage() {
  const ready = usePageReady();
  const router = useRouter();
  const db = useMockOps();
  const mineId = useMineScope();
  const [tab, setTab] = useTab(TABS[0]);

  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');
  const [fDest, setFDest] = useState('All Destinations');
  const [fDispStatus, setFDispStatus] = useState('All Status');
  const [selected, setSelected] = useState<string[]>([]);
  const [detail, setDetail] = useState<DispatchRecord | null>(null);
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [prodOpen, setProdOpen] = useState(false);
  const [challanOpen, setChallanOpen] = useState(false);
  const [period, setPeriod] = useState('Last 7 Days');

  const scopedDispatches = useMemo(() => byMine(db.dispatches, mineId), [db.dispatches, mineId]);
  const scopedProduction = useMemo(() => byMine(db.production, mineId), [db.production, mineId]);
  const scopedStockpiles = useMemo(() => byMine(db.stockpiles, mineId), [db.stockpiles, mineId]);

  // Weighbridge feed derived from dispatch records (same derivation as the seed).
  const weighbridge = useMemo(() => scopedDispatches.map((d) => ({
    id: `WB-2026-${d.id.slice(-3)}`, dispatchId: d.id, vehicleNo: d.vehicleNo, mineId: d.mineId,
    grossMt: d.grossMt, tareMt: d.tareMt, netMt: d.quantityMt, timestamp: d.timestamp,
    status: d.status === DispatchStatus.Pending ? 'Pending' : 'Recorded',
  })), [scopedDispatches]);

  // ---- KPIs ----
  const k = useMemo(() => {
    const todaysProd = scopedProduction.filter((p) => p.date === TODAY).reduce((s, p) => s + p.quantityMt, 0);
    const todaysDisp = scopedDispatches.filter((d) => d.date === TODAY).reduce((s, d) => s + d.quantityMt, 0);
    const trucks = scopedDispatches.filter((d) => d.date === TODAY).length;
    const avgNet = trucks ? scopedDispatches.filter((d) => d.date === TODAY).reduce((s, d) => s + d.quantityMt, 0) / trucks : 0;
    const pending = scopedDispatches.filter((d) => d.status === DispatchStatus.Pending).length;
    return { todaysProd, todaysDisp, trucks, avgNet, pending };
  }, [scopedProduction, scopedDispatches]);

  // ---- Overview chart data ----
  const days = useMemo(() => {
    const n = period === 'Last 30 Days' ? 30 : 7;
    const out: { label: string; date: string; prod: number; disp: number }[] = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(`${TODAY}T00:00:00+05:30`);
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      out.push({
        label: `${iso.slice(8, 10)} ${d.toLocaleString('en', { month: 'short' })}`, date: iso,
        prod: scopedProduction.filter((p) => p.date === iso).reduce((s, p) => s + p.quantityMt, 0),
        disp: scopedDispatches.filter((d2) => d2.date === iso).reduce((s, d2) => s + d2.quantityMt, 0),
      });
    }
    return out;
  }, [scopedProduction, scopedDispatches, period]);

  const destDonut = useMemo(() => {
    const todays = scopedDispatches.filter((d) => d.date === TODAY);
    const total = todays.reduce((s, d) => s + d.quantityMt, 0);
    const colors: Record<string, string> = { [Destination.NTPC]: '#1463D9', [Destination.RailwaySiding]: '#159B72', [Destination.OtherConsumer]: '#E8A02B', [Destination.WashedCoal]: '#7C5CFC' };
    const m = new Map<string, number>();
    todays.forEach((d) => m.set(d.destination, (m.get(d.destination) ?? 0) + d.quantityMt));
    return [...m.entries()].map(([name, value]) => ({ name, value, color: colors[name] ?? '#68788D' })).sort((a, b) => b.value - a.value);
  }, [scopedDispatches]);

  const dispStatusDonut = useMemo(() => {
    const todays = scopedDispatches.filter((d) => d.date === TODAY);
    const total = todays.length;
    const c = (s: DispatchStatus) => todays.filter((d) => d.status === s).length;
    return [
      { name: 'Dispatched', value: c(DispatchStatus.Dispatched), color: '#159B72' },
      { name: 'In Transit', value: c(DispatchStatus.InTransit), color: '#E8A02B' },
      { name: 'Pending', value: c(DispatchStatus.Pending), color: '#DC4C58' },
      { name: 'Cancelled', value: c(DispatchStatus.Cancelled), color: '#7C5CFC' },
    ].filter((s) => s.value > 0);
  }, [scopedDispatches]);

  // ---- Dispatch table filtering ----
  const filtered = useMemo(() => {
    const term = dq.trim().toLowerCase();
    return scopedDispatches.filter((d) =>
      (!term || `${d.vehicleNo} ${d.driver} ${d.challanNo} ${d.destination}`.toLowerCase().includes(term)) &&
      (fDest === 'All Destinations' || d.destination === fDest) &&
      (fDispStatus === 'All Status' || d.status === fDispStatus));
  }, [scopedDispatches, dq, fDest, fDispStatus]);

  const destList = ['All Destinations', Destination.NTPC, Destination.RailwaySiding, Destination.OtherConsumer, Destination.WashedCoal];
  const statusList = ['All Status', DispatchStatus.Dispatched, DispatchStatus.InTransit, DispatchStatus.Pending, DispatchStatus.Cancelled];

  function exportDisp() {
    exportCsv(`dispatch-${mineId === 'ALL' ? 'all-mines' : getMine(mineId)?.code ?? mineId}-${TODAY}`, filtered,
      [['Dispatch ID', (d: DispatchRecord) => d.id], ['Truck No.', (d) => d.vehicleNo], ['Driver', (d) => d.driver],
      ['Gross (MT)', (d) => d.grossMt], ['Tare (MT)', (d) => d.tareMt], ['Net (MT)', (d) => d.quantityMt],
      ['Destination', (d) => d.destination], ['Challan', (d) => d.challanNo], ['Time', (d) => d.timestamp.slice(11, 16)], ['Status', (d) => d.status]]);
  }

  const dispCols: Column<DispatchRecord>[] = [
    { key: 'truck', header: 'Truck No.', render: (d) => <span className="font-mono font-bold text-navy">{d.vehicleNo}</span>, sortValue: (d) => d.vehicleNo },
    { key: 'driver', header: 'Driver', render: (d) => <span className="text-slate-600">{d.driver}</span>, sortValue: (d) => d.driver },
    { key: 'gross', header: 'Gross', render: (d) => d.grossMt.toFixed(3), sortValue: (d) => d.grossMt },
    { key: 'tare', header: 'Tare', render: (d) => d.tareMt.toFixed(3), sortValue: (d) => d.tareMt },
    { key: 'net', header: 'Net', render: (d) => <span className="font-bold">{d.quantityMt.toFixed(3)}</span>, sortValue: (d) => d.quantityMt },
    { key: 'dest', header: 'Destination', render: (d) => d.destination, sortValue: (d) => d.destination },
    { key: 'challan', header: 'Challan No.', render: (d) => <span className="font-mono text-[12px]">{d.challanNo}</span>, sortValue: (d) => d.challanNo },
    { key: 'time', header: 'Time', render: (d) => <span className="text-[12px]">{d.timestamp.slice(11, 16)}</span>, sortValue: (d) => d.timestamp },
    { key: 'status', header: 'Status', render: (d) => <span className={`badge ${DISP_TONE[d.status]}`}>● {d.status}</span>, sortValue: (d) => d.status },
  ];

  const latestWb = weighbridge[0];

  return (
    <OperationsShell nav={operatorNav} title="Production & Dispatch" sub="Production, weighbridge and dispatch">
      <OpsBanner title="Production & Dispatch" sub="Track coal production, manage weighbridge transactions, monitor truck movements and oversee dispatch to different mine destinations." />
      <div className="px-4 space-y-4">
        {!ready ? (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">{[...Array(5)].map((_, i) => <div key={i} className="card !p-4 animate-pulse"><div className="h-16 bg-slate-100 rounded-xl" /></div>)}</div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <KpiCard icon={<BarChart3 size={22} />} label="Today's Production" value={mt(k.todaysProd)} trend="+8%" context="From mine pit" tileClass="bg-blue-50 text-blue-600" />
              <KpiCard icon={<Truck size={22} />} label="Today's Dispatch" value={mt(k.todaysDisp)} trend="+6%" context="To destinations" dotColor="#159B72" tileClass="bg-green-50 text-green-600" />
              <KpiCard icon={<Truck size={22} />} label="Trucks Dispatched" value={num(k.trucks)} context="Today" dotColor="#7C5CFC" tileClass="bg-purple-50 text-purple-600" />
              <KpiCard icon={<Weight size={22} />} label="Avg Net Weight" value={`${k.avgNet.toFixed(1)} MT`} context="Standard: 25–30 MT" dotColor="#E8A02B" tileClass="bg-amber-50 text-amber-600" />
              <KpiCard icon={<AlertOctagon size={22} />} label="Pending Dispatch" value={num(k.pending)} context="Require attention" dotColor={k.pending > 0 ? '#DC4C58' : '#94a3b8'} tileClass="bg-red-50 text-red-500" />
            </div>

            <SectionCard className="!p-0 !pb-4" title="" action={null}>
              <div className="px-4 -mt-1"><Tabs tabs={TABS} active={tab} onChange={setTab} /></div>
            </SectionCard>

            {tab === 'Overview' && (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <SectionCard className="xl:col-span-2" title="Production vs Dispatch" action={<PeriodSelect value={period} onChange={setPeriod} options={['Last 7 Days', 'Last 30 Days']} />}>
                  <TrendBars data={days} xKey="label" height={240}
                    bars={[{ key: 'prod', name: 'Production (MT)', fill: '#1463D9' }, { key: 'disp', name: 'Dispatch (MT)', fill: '#159B72' }]}
                    onPick={() => setTab('Production Records')} />
                </SectionCard>
                <SectionCard title="Dispatch by Destination (Today)">
                  <Donut data={destDonut} centerValue={mt(k.todaysDisp)} centerLabel="Total Dispatch" onPick={(s) => { setFDest(s.name as Destination); setTab('Dispatch Records'); }} />
                </SectionCard>

                <SectionCard className="xl:col-span-2" title="Recent Dispatch Transactions" action={
                  <div className="flex gap-2 flex-wrap items-center">
                    <SearchInput value={q} onChange={setQ} onSearch={() => setDq(q)} ph="Search by truck no, driver, challan..." width="!w-48" />
                    <select className="input !w-40 !py-2 !text-[13px]" value={fDest} onChange={(e) => setFDest(e.target.value)} aria-label="Destination filter">{destList.map((d) => <option key={d}>{d}</option>)}</select>
                    <select className="input !w-36 !py-2 !text-[13px]" value={fDispStatus} onChange={(e) => setFDispStatus(e.target.value)} aria-label="Status filter">{statusList.map((s) => <option key={s}>{s}</option>)}</select>
                    <button className="btn-primary !py-2" onClick={exportDisp}>Export</button>
                    <button className="btn-primary !py-2" onClick={() => setDispatchOpen(true)}><span className="inline-flex items-center gap-1"><Plus size={14} /> Add Dispatch</span></button>
                  </div>}>
                  <DataTable<DispatchRecord> columns={dispCols} rows={filtered} selectable onSelected={setSelected} onRowClick={setDetail}
                    emptyTitle="No dispatch records" emptyText="No dispatches match the current filters."
                    actions={(d) => d.status === DispatchStatus.Pending
                      ? <button className="text-xs font-bold text-green-600 hover:underline" onClick={() => actions.updateDispatchStatus(d.id, DispatchStatus.InTransit)}>Mark In Transit</button>
                      : d.status === DispatchStatus.InTransit
                        ? <button className="text-xs font-bold text-green-600 hover:underline" onClick={() => actions.updateDispatchStatus(d.id, DispatchStatus.Dispatched)}>Mark Dispatched</button>
                        : <span className="text-slate-400 text-xs">—</span>} />
                </SectionCard>

                <div className="space-y-4">
                  <SectionCard title="Dispatch Status Overview (Today)" action={<LinkBtn onClick={() => setTab('Dispatch Records')}>View Details</LinkBtn>}>
                    <Donut data={dispStatusDonut} centerValue={num(scopedDispatches.filter((d) => d.date === TODAY).length)} centerLabel="Total Trucks" height={170} />
                  </SectionCard>
                  <SectionCard title="Top Destinations (Today)">
                    <HBarRows data={destDonut.map((d) => ({ name: d.name, value: d.value, display: mt(d.value), color: d.color }))} />
                  </SectionCard>
                  <SectionCard title="Quick Actions">
                    <QuickActions items={[
                      { label: 'Add Dispatch Record', icon: <Plus size={15} />, tileClass: 'bg-green-100 text-green-700', onClick: () => setDispatchOpen(true) },
                      { label: 'Generate Challan', icon: <FileText size={15} />, tileClass: 'bg-blue-100 text-blue-600', onClick: () => setChallanOpen(true) },
                      { label: 'Record Production', icon: <BarChart3 size={15} />, tileClass: 'bg-amber-100 text-amber-700', onClick: () => setProdOpen(true) },
                      { label: 'Export Report', icon: <Upload size={15} />, tileClass: 'bg-purple-100 text-purple-600', onClick: exportDisp },
                    ]} />
                  </SectionCard>
                </div>

                <div className="xl:col-span-3">
                  <SectionCard title="Live Weighbridge Feed" subtitle="Derived from dispatch weighbridge records" action={<SimulatedNote>Weighbridge integration is simulated</SimulatedNote>}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-navy rounded-xl p-4 text-center">
                        <div className="text-[11px] text-blue-300 font-bold mb-2">WB-01 · SIMULATED</div>
                        <div className="bg-black rounded-lg p-3 font-mono text-[13px] space-y-1">
                          <div className="text-red-400">GROSS : {latestWb?.grossMt.toFixed(3) ?? '—'} t</div>
                          <div className="text-red-400">TARE&nbsp; : {latestWb?.tareMt.toFixed(3) ?? '—'} t</div>
                          <div className="text-green-400 font-bold">NET&nbsp;&nbsp; : {latestWb?.netMt.toFixed(3) ?? '—'} t</div>
                        </div>
                      </div>
                      <div className="md:col-span-2">
                        <DataTable<{ id: string; vehicleNo: string; netMt: number; timestamp: string; status: string }> columns={[
                          { key: 'v', header: 'Truck No.', render: (r) => <span className="font-mono font-bold">{r.vehicleNo}</span>, sortValue: (r) => r.vehicleNo },
                          { key: 'n', header: 'Net Weight', render: (r) => <span className="font-bold">{r.netMt.toFixed(3)} MT</span>, sortValue: (r) => r.netMt },
                          { key: 't', header: 'Time', render: (r) => <span className="text-[12px]">{fmtTime12(r.timestamp)}</span>, sortValue: (r) => r.timestamp },
                          { key: 's', header: 'Status', render: (r) => <StatusPill v={r.status} />, sortValue: (r) => r.status },
                        ]} rows={weighbridge.slice(0, 8).map((w) => ({ id: w.id, vehicleNo: w.vehicleNo, netMt: w.netMt, timestamp: w.timestamp, status: w.status }))} initialSize={8} pageSizeOptions={[8, 15]} />
                      </div>
                    </div>
                  </SectionCard>
                </div>
              </div>
            )}

            {tab === 'Production Records' && (
              <ProductionTab production={scopedProduction} stockpiles={scopedStockpiles} onAdd={() => setProdOpen(true)} />
            )}

            {tab === 'Weighbridge Transactions' && (
              <WeighbridgeTab weighbridge={weighbridge} />
            )}

            {tab === 'Dispatch Records' && (
              <SectionCard title={`Dispatch Records (${filtered.length})`} action={
                <div className="flex gap-2 flex-wrap items-center">
                  <SearchInput value={q} onChange={setQ} onSearch={() => setDq(q)} ph="Search truck, driver, challan..." width="!w-48" />
                  <select className="input !w-40 !py-2 !text-[13px]" value={fDest} onChange={(e) => setFDest(e.target.value)} aria-label="Destination filter">{destList.map((d) => <option key={d}>{d}</option>)}</select>
                  <select className="input !w-36 !py-2 !text-[13px]" value={fDispStatus} onChange={(e) => setFDispStatus(e.target.value)} aria-label="Status filter">{statusList.map((s) => <option key={s}>{s}</option>)}</select>
                  <button className="btn-primary !py-2" onClick={exportDisp}>Export CSV</button>
                  <button className="btn-primary !py-2" onClick={() => setDispatchOpen(true)}><span className="inline-flex items-center gap-1"><Plus size={14} /> Add Dispatch</span></button>
                </div>}>
                <DataTable<DispatchRecord> columns={dispCols} rows={filtered} selectable onSelected={setSelected} onRowClick={setDetail}
                  emptyTitle="No dispatch records" emptyText="No dispatches match the current filters."
                  actions={(d) => d.status === DispatchStatus.Pending
                    ? <button className="text-xs font-bold text-green-600 hover:underline" onClick={() => actions.updateDispatchStatus(d.id, DispatchStatus.InTransit)}>In Transit</button>
                    : d.status === DispatchStatus.InTransit
                      ? <button className="text-xs font-bold text-green-600 hover:underline" onClick={() => actions.updateDispatchStatus(d.id, DispatchStatus.Dispatched)}>Dispatched</button>
                      : <span className="text-slate-400 text-xs">—</span>} />
              </SectionCard>
            )}

            {tab === 'Truck Movement' && <TruckMovementTab weighbridge={weighbridge} dispatches={scopedDispatches} />}

            {tab === 'Destination & Challan' && <DestinationTab dispatches={scopedDispatches} onGenerate={() => setChallanOpen(true)} />}

            {tab === 'Analysis' && (
              <SectionCard title="Production & Dispatch Analysis" subtitle="Period totals and averages from the central store">
                <DataTable<{ id: string; label: string; prod: number; disp: number; gap: number }> columns={[
                  { key: 'l', header: 'Date', render: (r) => <span className="font-semibold">{r.label}</span>, sortValue: (r) => r.label },
                  { key: 'p', header: 'Production (MT)', render: (r) => <span className="font-bold text-blue-600">{num(r.prod)}</span>, sortValue: (r) => r.prod },
                  { key: 'd', header: 'Dispatch (MT)', render: (r) => <span className="font-bold text-green-600">{num(r.disp)}</span>, sortValue: (r) => r.disp },
                  { key: 'g', header: 'Net Gap (MT)', render: (r) => <span className={`font-bold ${r.gap >= 0 ? 'text-green-600' : 'text-red-500'}`}>{r.gap >= 0 ? '+' : ''}{num(r.gap)}</span>, sortValue: (r) => r.gap },
                ]} rows={days.map((d) => ({ id: d.date, label: d.label, prod: d.prod, disp: d.disp, gap: d.prod - d.disp }))} initialSize={10} />
              </SectionCard>
            )}
          </>
        )}
      </div>

      {/* ---- Detail Drawer ---- */}
      {detail && (
        <DetailDrawer title={`Dispatch ${detail.id}`} onClose={() => setDetail(null)}>
          <Kv k="Truck No." v={<span className="font-mono font-bold">{detail.vehicleNo}</span>} />
          <Kv k="Driver" v={detail.driver} />
          <Kv k="Status" v={<span className={`badge ${DISP_TONE[detail.status]}`}>● {detail.status}</span>} />
          <Kv k="Gross" v={`${detail.grossMt.toFixed(3)} MT`} />
          <Kv k="Tare" v={`${detail.tareMt.toFixed(3)} MT`} />
          <Kv k="Net" v={<span className="font-bold">{detail.quantityMt.toFixed(3)} MT</span>} />
          <Kv k="Destination" v={detail.destination} />
          <Kv k="Challan No." v={<span className="font-mono">{detail.challanNo}</span>} />
          <Kv k="Stockpile" v={db.stockpiles.find((s) => s.id === detail.stockpileId)?.name ?? '—'} />
          <Kv k="Timestamp" v={fmtTime12(detail.timestamp)} />
          <div className="flex gap-2 mt-4">
            {detail.status === DispatchStatus.Pending && (
              <button className="btn-primary !py-2 !text-xs" onClick={() => { actions.updateDispatchStatus(detail.id, DispatchStatus.InTransit); setDetail(null); }}>Mark In Transit</button>
            )}
            {detail.status === DispatchStatus.InTransit && (
              <button className="btn-primary !py-2 !text-xs" onClick={() => { actions.updateDispatchStatus(detail.id, DispatchStatus.Dispatched); setDetail(null); }}>Mark Dispatched</button>
            )}
            <button className="btn-primary !py-2 !text-xs !bg-white !text-blue-700 border border-blue-600" onClick={() => { setChallanOpen(true); }}>Generate Challan</button>
          </div>
        </DetailDrawer>
      )}

      {/* ---- Modals ---- */}
      {dispatchOpen && <AddDispatchModal mineId={mineId} onClose={() => setDispatchOpen(false)} />}
      {prodOpen && <RecordProductionModal mineId={mineId} onClose={() => setProdOpen(false)} />}
      {challanOpen && <ChallanModal dispatch={detail} onClose={() => setChallanOpen(false)} />}
      <Toasts />
    </OperationsShell>
  );
}

// ---------- Sub-tabs ----------
function ProductionTab({ production, stockpiles, onAdd }: { production: ProductionRecord[]; stockpiles: { id: string; name: string; code: string }[]; onAdd: () => void }) {
  return (
    <SectionCard title={`Production Records (${production.length})`} action={<button className="btn-primary !py-2" onClick={onAdd}><span className="inline-flex items-center gap-1"><Plus size={14} /> Record Production</span></button>}>
      <DataTable<ProductionRecord> columns={[
        { key: 'id', header: 'Record ID', render: (p) => <span className="font-mono font-bold">{p.id}</span>, sortValue: (p) => p.id },
        { key: 'd', header: 'Date', render: (p) => <span className="text-[12px]">{fmtDate(p.date)}</span>, sortValue: (p) => p.date },
        { key: 'sp', header: 'Stockpile', render: (p) => stockpiles.find((s) => s.id === p.stockpileId)?.name ?? p.stockpileId, sortValue: (p) => p.stockpileId },
        { key: 'q', header: 'Quantity (MT)', render: (p) => <span className="font-bold text-blue-600">{num(p.quantityMt)}</span>, sortValue: (p) => p.quantityMt },
        { key: 'g', header: 'Grade', render: (p) => p.grade },
        { key: 's', header: 'Shift', render: (p) => p.shift },
        { key: 'src', header: 'Source', render: (p) => <span className="text-slate-600">{p.source}</span> },
        { key: 'by', header: 'Recorded By', render: (p) => <span className="text-[12px] text-slate-500">{p.recordedBy}</span> },
      ]} rows={production} initialSize={10} />
    </SectionCard>
  );
}

function WeighbridgeTab({ weighbridge }: { weighbridge: { id: string; vehicleNo: string; grossMt: number; tareMt: number; netMt: number; timestamp: string; status: string; dispatchId: string }[] }) {
  return (
    <SectionCard title={`Weighbridge Transactions (${weighbridge.length})`} action={<SimulatedNote>Simulated weighbridge feed</SimulatedNote>}>
      <DataTable<{ id: string; vehicleNo: string; grossMt: number; tareMt: number; netMt: number; timestamp: string; status: string; dispatchId: string }> columns={[
        { key: 'id', header: 'WB ID', render: (w) => <span className="font-mono font-bold">{w.id}</span>, sortValue: (w) => w.id },
        { key: 'v', header: 'Vehicle', render: (w) => <span className="font-mono font-bold">{w.vehicleNo}</span>, sortValue: (w) => w.vehicleNo },
        { key: 'g', header: 'Gross (MT)', render: (w) => w.grossMt.toFixed(3), sortValue: (w) => w.grossMt },
        { key: 't', header: 'Tare (MT)', render: (w) => w.tareMt.toFixed(3), sortValue: (w) => w.tareMt },
        { key: 'n', header: 'Net (MT)', render: (w) => <span className="font-bold">{w.netMt.toFixed(3)}</span>, sortValue: (w) => w.netMt },
        { key: 'ts', header: 'Timestamp', render: (w) => <span className="text-[12px]">{fmtTime12(w.timestamp)}</span>, sortValue: (w) => w.timestamp },
        { key: 's', header: 'Status', render: (w) => <StatusPill v={w.status} />, sortValue: (w) => w.status },
      ]} rows={weighbridge} initialSize={10} />
    </SectionCard>
  );
}

function TruckMovementTab({ weighbridge, dispatches }: { weighbridge: { id: string; vehicleNo: string; netMt: number; timestamp: string; status: string }[]; dispatches: DispatchRecord[] }) {
  const byTruck = useMemo(() => {
    const m = new Map<string, { count: number; totalMt: number; lastSeen: string }>();
    weighbridge.forEach((w) => {
      const cur = m.get(w.vehicleNo) ?? { count: 0, totalMt: 0, lastSeen: w.timestamp };
      cur.count++; cur.totalMt += w.netMt; if (w.timestamp > cur.lastSeen) cur.lastSeen = w.timestamp;
      m.set(w.vehicleNo, cur);
    });
    return [...m.entries()].map(([no, v]) => ({ id: no, no, ...v })).sort((a, b) => b.totalMt - a.totalMt);
  }, [weighbridge]);
  return (
    <SectionCard title="Truck Movement" subtitle="Trips and total tonnage per truck today">
      <DataTable<{ id: string; no: string; count: number; totalMt: number; lastSeen: string }> columns={[
        { key: 'n', header: 'Truck No.', render: (r) => <span className="font-mono font-bold">{r.no}</span>, sortValue: (r) => r.no },
        { key: 'c', header: 'Trips', render: (r) => <span className="font-bold">{r.count}</span>, sortValue: (r) => r.count },
        { key: 't', header: 'Total (MT)', render: (r) => <span className="font-bold text-green-600">{r.totalMt.toFixed(3)}</span>, sortValue: (r) => r.totalMt },
        { key: 'l', header: 'Last Seen', render: (r) => <span className="text-[12px]">{fmtTime12(r.lastSeen)}</span>, sortValue: (r) => r.lastSeen },
      ]} rows={byTruck} initialSize={10} />
    </SectionCard>
  );
}

function DestinationTab({ dispatches, onGenerate }: { dispatches: DispatchRecord[]; onGenerate: () => void }) {
  const grouped = useMemo(() => {
    const m = new Map<string, DispatchRecord[]>();
    dispatches.forEach((d) => { m.set(d.challanNo, [...(m.get(d.challanNo) ?? []), d]); });
    return [...m.entries()].map(([challan, ds]) => ({ id: challan, challan, dest: ds[0].destination, trucks: ds.length, totalMt: ds.reduce((s, d) => s + d.quantityMt, 0), status: ds[0].status }));
  }, [dispatches]);
  return (
    <SectionCard title="Destination & Challan Summary" action={<button className="btn-primary !py-2" onClick={onGenerate}>Generate Challan</button>}>
      <DataTable<{ id: string; challan: string; dest: string; trucks: number; totalMt: number; status: string }> columns={[
        { key: 'c', header: 'Challan No.', render: (r) => <span className="font-mono font-bold">{r.challan}</span>, sortValue: (r) => r.challan },
        { key: 'd', header: 'Destination', render: (r) => r.dest, sortValue: (r) => r.dest },
        { key: 't', header: 'Trucks', render: (r) => r.trucks, sortValue: (r) => r.trucks },
        { key: 'm', header: 'Total (MT)', render: (r) => <span className="font-bold">{r.totalMt.toFixed(3)}</span>, sortValue: (r) => r.totalMt },
        { key: 's', header: 'Status', render: (r) => <StatusPill v={r.status} />, sortValue: (r) => r.status },
      ]} rows={grouped} initialSize={10} />
    </SectionCard>
  );
}

// ---------- Sub-modal forms ----------
function AddDispatchModal({ mineId, onClose }: { mineId: string; onClose: () => void }) {
  const db = useMockOps();
  const scope = mineId === 'ALL' ? 'M-01' : mineId;
  const sps = db.stockpiles.filter((s) => s.mineId === scope);
  const [f, setF] = useState({
    stockpileId: sps[0]?.id ?? '', destination: Destination.NTPC as string,
    vehicleNo: '', driver: '', quantityMt: '', grossMt: '', tareMt: '',
    challanNo: `CH-2026-${String(db.dispatches.length + 1).padStart(3, '0')}`, date: TODAY,
  });
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const avail = sps[0] ? stockCurrent(sps[0].id, db) : 0;

  function submit() {
    const e: Record<string, string> = {};
    const q = Number(f.quantityMt); const g = Number(f.grossMt); const t = Number(f.tareMt);
    if (!f.vehicleNo.trim()) e.vehicleNo = 'Truck number is required.';
    if (!f.driver.trim()) e.driver = 'Driver name is required.';
    if (!(q > 0)) e.quantityMt = 'Net quantity must be greater than 0.';
    if (!(g > 0) || !(t > 0)) e.grossMt = 'Gross and tare must be greater than 0.';
    else if (Math.abs((g - t) - q) > 0.01) e.quantityMt = `Weight mismatch: gross − tare = ${(g - t).toFixed(3)} ≠ net ${q}.`;
    if (!f.challanNo.trim()) e.challanNo = 'Challan number is required.';
    setErr(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      actions.createDispatch({ date: f.date, mineId: scope, stockpileId: f.stockpileId, destination: f.destination as never, vehicleNo: f.vehicleNo.trim().toUpperCase(), driver: f.driver.trim(), quantityMt: q, grossMt: g, tareMt: t, challanNo: f.challanNo.trim() });
      onClose();
    } catch (ex: any) { setErr({ form: ex.message }); } finally { setBusy(false); }
  }

  return (
    <Modal title="Record Dispatch" onClose={onClose}>
      <p className="text-[11px] text-slate-400 mb-3">Adding a dispatch updates the dispatch table, charts and reduces the stockpile balance.</p>
      {err.form && <div className="text-[12px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-2" role="alert">{err.form}</div>}
      <Field label="Stockpile *" hint={`Available: ${avail.toFixed(3)} MT`}>
        <select className="input" value={f.stockpileId} onChange={(e) => setF({ ...f, stockpileId: e.target.value })}>
          {sps.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code}) — {stockCurrent(s.id, db).toFixed(3)} MT</option>)}
        </select>
      </Field>
      <div className="grid sm:grid-cols-2 gap-x-3">
        <Field label="Destination *">
          <select className="input" value={f.destination} onChange={(e) => setF({ ...f, destination: e.target.value })}>
            {[Destination.NTPC, Destination.RailwaySiding, Destination.OtherConsumer, Destination.WashedCoal].map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </Field>
        <Field label="Truck No. *" error={err.vehicleNo}><input className="input" value={f.vehicleNo} onChange={(e) => setF({ ...f, vehicleNo: e.target.value })} placeholder="e.g. JH01AB1234" /></Field>
        <Field label="Driver *" error={err.driver}><input className="input" value={f.driver} onChange={(e) => setF({ ...f, driver: e.target.value })} /></Field>
        <Field label="Challan No. *" error={err.challanNo}><input className="input" value={f.challanNo} onChange={(e) => setF({ ...f, challanNo: e.target.value })} /></Field>
        <Field label="Gross (MT) *" error={err.grossMt}><input className="input" type="number" step="0.001" min={0} value={f.grossMt} onChange={(e) => setF({ ...f, grossMt: e.target.value })} placeholder="e.g. 52.780" /></Field>
        <Field label="Tare (MT)" hint="Subtracted from gross"><input className="input" type="number" step="0.001" min={0} value={f.tareMt} onChange={(e) => setF({ ...f, tareMt: e.target.value })} placeholder="e.g. 26.140" /></Field>
        <Field label="Net (MT) *" error={err.quantityMt}><input className="input" type="number" step="0.001" min={0} value={f.quantityMt} onChange={(e) => setF({ ...f, quantityMt: e.target.value })} placeholder="e.g. 26.640" /></Field>
      </div>
      <div className="flex gap-2 justify-end">
        <button className="btn-primary !bg-white !text-navy border border-slate-300" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={submit} disabled={busy}>{busy ? 'Saving…' : 'Record Dispatch'}</button>
      </div>
    </Modal>
  );
}

function ChallanModal({ dispatch, onClose }: { dispatch: DispatchRecord | null; onClose: () => void }) {
  return (
    <Modal title="Generate Challan" onClose={onClose}>
      <p className="text-[11px] text-slate-400 mb-3">Demo challan preview — this portal has no challan/printing integration.</p>
      {dispatch ? (
        <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-[13px] space-y-1.5 bg-slate-50">
          <div className="text-center font-extrabold text-navy text-[15px]">DELIVERY CHALLAN (DEMO)</div>
          <div className="flex justify-between"><span className="text-slate-500">Challan No.</span><span className="font-mono font-bold">{dispatch.challanNo}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Truck</span><span className="font-mono font-bold">{dispatch.vehicleNo}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Driver</span><span className="font-bold">{dispatch.driver}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Net Weight</span><span className="font-bold">{dispatch.quantityMt.toFixed(3)} MT</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Destination</span><span className="font-bold">{dispatch.destination}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Date</span><span className="font-bold">{fmtDate(dispatch.date)}</span></div>
          <div className="text-center text-[10px] text-slate-400 pt-2">Synthetic demo document — not a valid transit challan</div>
        </div>
      ) : (
        <EmptyState title="Select a dispatch first" sub="Open a dispatch record from the Dispatch Records tab and click Generate Challan." />
      )}
      <div className="flex gap-2 justify-end mt-3">
        <button className="btn-primary !bg-white !text-navy border border-slate-300" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}
