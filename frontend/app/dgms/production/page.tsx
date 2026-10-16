/**
 * Page 6 — Production & Dispatch. All quantities in Mt, consistent units.
 * Dispatch actions are audited; anomaly review is explicit.
 */
'use client';
import { useMemo, useState } from 'react';
import { Truck } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Bar, BarChart } from 'recharts';
import Shell from '../../../components/Shell';
import { actions, useMockDb } from '../../../lib/dgms/mockDb';
import { exportCSV } from '../../../lib/dgms/export';
import { fmtDate, fmtDateTime, fmtNum } from '../../../lib/dgms/format';
import { DispatchStatus, StockpileStatus } from '../../../lib/dgms/types';
import type { DispatchRecord } from '../../../lib/dgms/types';
import { ConfirmDialog, DataTable, DemoBadge, DetailDrawer, FilterBar, KpiCard, Kv, SearchInput, SectionCard, Toasts, type Column } from '../../../components/dgms/ui';
import { StatusPill } from '../../../components/dgms/ui';

export default function ProductionPage() {
  const db = useMockDb();
  const [q, setQ] = useState(''); const [qq, setQq] = useState('');
  const [draft, setDraft] = useState({ state: 'All States', mine: 'All Mines', status: 'All Statuses' });
  const [applied, setApplied] = useState(draft);
  const [period, setPeriod] = useState('Last 6 months');
  const [sel, setSel] = useState<DispatchRecord | null>(null);
  const [recording, setRecording] = useState(false);
  const [form, setForm] = useState({ mineId: '', vehicle: '', destination: '', quantityMt: '0.03', datetime: '2026-10-03T10:00', weighbridgeId: '' });
  const [formErr, setFormErr] = useState('');
  const [stockFilter, setStockFilter] = useState<StockpileStatus | 'All'>('All');

  const states = useMemo(() => ['All States', ...[...new Set(db.mines.map((m) => m.state))].sort()], [db.mines]);
  const mineOpts = useMemo(() => ['All Mines', ...db.mines.filter((m) => applied.state === 'All States' || m.state === applied.state).map((m) => `${m.name} (${m.code})`)], [db.mines, applied.state]);
  const mineName = (id: string) => { const m = db.mines.find((x) => x.id === id); return m ? `${m.name} (${m.code})` : id; };
  const mineIdOf = (label: string) => db.mines.find((x) => `${x.name} (${x.code})` === label)?.id ?? null;
  const activeMineIds = useMemo(() => new Set(db.mines.filter((m) => m.status !== 'Inactive' && m.status !== 'Closed').map((m) => m.id)), [db.mines]);

  const inScope = (mineId: string) => {
    const m = db.mines.find((x) => x.id === mineId);
    if (applied.state !== 'All States' && m?.state !== applied.state) return false;
    const mid = mineIdOf(applied.mine); if (mid && mineId !== mid) return false;
    return true;
  };

  const prodRows = db.production.filter((p) => inScope(p.mineId));
  const totalProd = prodRows.reduce((a, p) => a + p.productionMt, 0);
  const totalDisp = prodRows.reduce((a, p) => a + p.dispatchMt, 0);
  const stockQty = db.stockpiles.filter((s) => inScope(s.mineId)).reduce((a, s) => a + s.quantityMt, 0);
  const dispRows = db.dispatches.filter((d) => inScope(d.mineId));
  const anomalies = dispRows.filter((d) => d.anomaly);

  const trend = useMemo(() => {
    const map = new Map<string, { m: string; prod: number; disp: number }>();
    prodRows.forEach((p) => {
      if (!map.has(p.month)) map.set(p.month, { m: p.month.slice(5), prod: 0, disp: 0 });
      const b = map.get(p.month)!;
      b.prod += p.productionMt; b.disp += p.dispatchMt;
    });
    return [...map.values()].map((b) => ({ ...b, prod: +b.prod.toFixed(2), disp: +b.disp.toFixed(2) }));
  }, [prodRows]);

  const stockDonut = (Object.values(StockpileStatus) as StockpileStatus[]).map((s, i) => ({
    name: s, value: db.stockpiles.filter((x) => x.status === s && inScope(x.mineId)).length,
    color: ['#16a34a', '#f59e0b', '#ef4444', '#94a3b8'][i],
  }));

  const byState = states.slice(1).map((s) => ({
    state: s,
    disp: +prodRows.filter((p) => db.mines.find((m) => m.id === p.mineId)?.state === s).reduce((a, p) => a + p.dispatchMt, 0).toFixed(2),
  })).filter((r) => r.disp > 0);

  const rows = dispRows.filter((d) => {
    const needle = qq.trim().toLowerCase();
    if (needle && !(d.id.toLowerCase().includes(needle) || d.vehicle.toLowerCase().includes(needle) || d.destination.toLowerCase().includes(needle))) return false;
    if (applied.status !== 'All Statuses' && d.status !== applied.status) return false;
    return true;
  });

  const columns: Column<DispatchRecord>[] = [
    { key: 'dt', header: 'Date & Time', render: (d) => <span className="text-[12px]">{fmtDateTime(d.datetime)}</span>, sortValue: (d) => d.datetime },
    { key: 'mine', header: 'Mine', render: (d) => mineName(d.mineId), sortValue: (d) => mineName(d.mineId) },
    { key: 'truck', header: 'Truck / Vehicle', render: (d) => d.vehicle, sortValue: (d) => d.vehicle },
    { key: 'dest', header: 'Destination', render: (d) => d.destination, sortValue: (d) => d.destination },
    { key: 'qty', header: 'Quantity (Mt)', render: (d) => d.quantityMt.toFixed(3), sortValue: (d) => d.quantityMt },
    { key: 'status', header: 'Status', render: (d) => <StatusPill v={d.status} />, sortValue: (d) => d.status },
    { key: 'anom', header: 'Anomaly', render: (d) => d.anomaly ? <span className="badge bg-amber-100 text-amber-700">⚠ Flagged</span> : <span className="text-slate-400 text-[12px]">—</span> },
    { key: 'actions', header: 'Actions', render: (d) => <button className="text-blue-700 border border-blue-200 rounded-lg px-2.5 py-1 text-[12px] font-bold" onClick={(e) => { e.stopPropagation(); setSel(d); }}>View</button> },
  ];

  const stockRows = db.stockpiles.filter((s) => inScope(s.mineId) && (stockFilter === 'All' || s.status === stockFilter));

  function submitDispatch() {
    setFormErr('');
    if (!form.mineId || !form.vehicle.trim() || !form.destination.trim() || !form.weighbridgeId.trim()) { setFormErr('Mine, vehicle, destination and weighbridge ID are required.'); return; }
    const qty = Number(form.quantityMt);
    if (!Number.isFinite(qty) || qty <= 0) { setFormErr('Quantity must be a positive number (Mt).'); return; }
    actions.recordDispatch({ mineId: form.mineId, vehicle: form.vehicle.trim().toUpperCase(), destination: form.destination.trim(), quantityMt: qty, datetime: `${form.datetime}:00+05:30`, weighbridgeId: form.weighbridgeId.trim().toUpperCase() });
    setRecording(false);
    setForm({ mineId: '', vehicle: '', destination: '', quantityMt: '0.03', datetime: '2026-10-03T10:00', weighbridgeId: '' });
  }

  return (
    <Shell title="Production & Dispatch" subtitle="Monitor coal production, stockpiles, dispatch and weighbridge transactions.">
      <div className="flex gap-2 mb-3 flex-wrap items-center"><span className="ml-auto"><DemoBadge /></span></div>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mb-3">
        <KpiCard icon={<Truck size={22} />} label="Total Production" value={`${fmtNum(totalProd, 2)} Mt`} sub="in scope" />
        <KpiCard icon={<Truck size={22} />} label="Current Stockpile" value={`${fmtNum(stockQty, 2)} Mt`} />
        <KpiCard icon={<Truck size={22} />} label="Total Dispatch" value={`${fmtNum(totalDisp, 2)} Mt`} />
        <KpiCard icon={<Truck size={22} />} label="Weighbridge Txns" value={dispRows.length} />
        <KpiCard icon={<Truck size={22} />} label="Dispatch Anomalies" value={anomalies.length} tone="text-red-500" />
      </div>

      <SectionCard title="Recent Dispatch Activity" action={
        <div className="flex gap-2">
          <button className="text-blue-700 border border-blue-200 rounded-lg px-3 py-1.5 text-[12px] font-bold" onClick={() =>
            exportCSV('dispatch-activity', ['Dispatch ID', 'Mine', 'DateTime', 'Vehicle', 'Destination', 'Quantity Mt', 'Status', 'Anomaly'],
              rows.map((d) => [d.id, mineName(d.mineId), d.datetime, d.vehicle, d.destination, d.quantityMt, d.status, d.anomaly ?? '']))}>⤓ Export</button>
          <button className="btn-primary !py-1.5" onClick={() => { setFormErr(''); setRecording(true); }}>+ Record Dispatch</button>
        </div>
      }>
        <SearchInput value={q} onChange={setQ} onSearch={() => setQq(q)} ph="Search by dispatch ID, vehicle or destination…" />
        <FilterBar defs={[
          { key: 'state', label: 'State', options: states },
          { key: 'mine', label: 'Mine', options: mineOpts, width: '!w-56' },
          { key: 'status', label: 'Status', options: ['All Statuses', ...Object.values(DispatchStatus)] },
        ]} values={draft}
          onChange={(k, v) => setDraft((d) => ({ ...d, [k]: v, ...(k === 'state' ? { mine: 'All Mines' } : {}) }))}
          onApply={() => setApplied(draft)}
          onReset={() => { const r = { state: 'All States', mine: 'All Mines', status: 'All Statuses' }; setDraft(r); setApplied(r); setQ(''); setQq(''); }} />
        <div className="mt-3"><DataTable columns={columns} rows={rows} onRowClick={(d) => setSel(d)} /></div>
      </SectionCard>

      <div className="grid xl:grid-cols-3 gap-3 mt-3">
        <SectionCard className="xl:col-span-2" title="Production vs Dispatch Trend" action={
          <select className="input !w-auto !py-1.5 text-[12px]" value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option>Last 6 months</option>
          </select>
        }>
          <div className="h-[220px]">
            <ResponsiveContainer>
              <AreaChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                <XAxis dataKey="m" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area type="monotone" dataKey="prod" name="Production (Mt)" stroke="#2563eb" fill="#dbeafe" />
                <Area type="monotone" dataKey="disp" name="Dispatch (Mt)" stroke="#16a34a" fill="#dcfce7" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Aggregated from production records in scope. {period}.</div>
        </SectionCard>
        <SectionCard title="Dispatch by State">
          <div className="h-[220px]">
            <ResponsiveContainer>
              <BarChart data={byState} layout="vertical" margin={{ left: 80 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="state" tick={{ fontSize: 11 }} width={75} />
                <Tooltip />
                <Bar dataKey="disp" name="Dispatch (Mt)" fill="#2563eb" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      <SectionCard className="mt-3" title={`Stockpile Status (${stockRows.length})`} action={
        <select className="input !w-auto !py-1.5 text-[12px]" value={stockFilter} onChange={(e) => setStockFilter(e.target.value as StockpileStatus | 'All')}>
          <option value="All">All statuses</option>
          {Object.values(StockpileStatus).map((s) => <option key={s}>{s}</option>)}
        </select>
      }>
        <div className="grid xl:grid-cols-3 gap-3">
          <div>
            <div className="h-[170px] relative">
              <ResponsiveContainer>
                <PieChart><Pie data={stockDonut} dataKey="value" innerRadius={48} outerRadius={68} paddingAngle={2}>
                  {stockDonut.map((d) => <Cell key={d.name} fill={d.color} />)}
                </Pie></PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><span className="text-xl font-extrabold text-navy">{db.stockpiles.filter((x) => inScope(x.mineId)).length}</span></div>
            </div>
            <div className="text-[12px] space-y-1">{stockDonut.map((d) => (
              <button key={d.name} className="w-full flex gap-2 items-center hover:bg-blue-50 rounded px-1" onClick={() => setStockFilter(d.name as StockpileStatus)}>
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />{d.name}<b className="ml-auto">{d.value}</b>
              </button>
            ))}</div>
          </div>
          <div className="xl:col-span-2 overflow-x-auto">
            <table className="dense w-full min-w-[520px]">
              <thead><tr><th>Mine</th><th>Type</th><th>Quantity (Mt)</th><th>Limit (Mt)</th><th>Status</th><th>Updated</th></tr></thead>
              <tbody>{stockRows.map((s) => (
                <tr key={s.id}><td className="font-semibold">{mineName(s.mineId)}</td><td>{s.type}</td>
                  <td>{s.quantityMt.toFixed(2)}</td><td>{s.limitMt.toFixed(2)}</td>
                  <td><StatusPill v={s.status} /></td><td className="text-[12px]">{fmtDate(s.updatedAt)}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      </SectionCard>

      {sel && (
        <DetailDrawer title={`Dispatch ${sel.id}`} onClose={() => setSel(null)}>
          <Kv k="Mine" v={mineName(sel.mineId)} />
          <Kv k="Date & Time" v={fmtDateTime(sel.datetime)} />
          <Kv k="Vehicle" v={sel.vehicle} />
          <Kv k="Destination" v={sel.destination} />
          <Kv k="Quantity" v={`${sel.quantityMt.toFixed(3)} Mt`} />
          <Kv k="Weighbridge" v={sel.weighbridgeId} />
          <Kv k="Status" v={<StatusPill v={sel.status} />} />
          {sel.anomaly && <div className="text-[12px] bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-3 py-2 mt-2">Anomaly: {sel.anomaly}</div>}
          {sel.anomaly && sel.status !== DispatchStatus.Delivered && (
            <button className="btn-primary w-full mt-3" onClick={() => { actions.updateDispatch(sel.id, { status: DispatchStatus.Delivered, anomaly: undefined }); setSel({ ...sel, status: DispatchStatus.Delivered, anomaly: undefined }); }}>
              Mark Reviewed — Clear Anomaly
            </button>
          )}
          <p className="text-[11px] text-slate-500 mt-2">Status changes are audited. Production records themselves are read-only in this demo.</p>
        </DetailDrawer>
      )}

      {recording && (
        <DetailDrawer title="Record Dispatch" onClose={() => setRecording(false)}>
          {formErr && <div className="text-[13px] bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 mb-3">{formErr}</div>}
          <label className="block text-xs font-semibold text-slate-600 mb-2">Mine (active only) *
            <select className="input mt-1" value={form.mineId} onChange={(e) => setForm({ ...form, mineId: e.target.value })}>
              <option value="">Select mine…</option>
              {[...activeMineIds].map((id) => { const m = db.mines.find((x) => x.id === id)!; return <option key={id} value={id}>{m.name} ({m.code})</option>; })}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <label className="block text-xs font-semibold text-slate-600">Vehicle No. *<input className="input mt-1" value={form.vehicle} onChange={(e) => setForm({ ...form, vehicle: e.target.value })} placeholder="JH-10-AB-1234" /></label>
            <label className="block text-xs font-semibold text-slate-600">Quantity (Mt) *<input type="number" step="0.001" min="0.001" className="input mt-1" value={form.quantityMt} onChange={(e) => setForm({ ...form, quantityMt: e.target.value })} /></label>
          </div>
          <label className="block text-xs font-semibold text-slate-600 mb-2">Destination *
            <input className="input mt-1" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} placeholder="e.g. NTPC Dadri" />
          </label>
          <label className="block text-xs font-semibold text-slate-600 mb-2">Weighbridge ID *
            <input className="input mt-1" value={form.weighbridgeId} onChange={(e) => setForm({ ...form, weighbridgeId: e.target.value })} placeholder="WB-BCM-01" />
          </label>
          <label className="block text-xs font-semibold text-slate-600 mb-2">Date & Time
            <input type="datetime-local" className="input mt-1" value={form.datetime} onChange={(e) => setForm({ ...form, datetime: e.target.value })} />
          </label>
          <button className="btn-primary w-full mt-2" onClick={submitDispatch}>Record Dispatch</button>
        </DetailDrawer>
      )}
      <Toasts />
    </Shell>
  );
}




