/**
 * Page 2 — Mine Registry. KPIs, table, chart all derive from the same store.
 * Add/edit flows validate + duplicate-check; inactive mines are excluded from
 * other pages' mine selectors via the shared activeMines() rule.
 */
'use client';
import { useMemo, useState } from 'react';
import { Mountain } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import Shell from '../../../components/Shell';
import { actions, useMockDb } from '../../../lib/dgms/mockDb';
import { complianceOfMine } from '../../../lib/dgms/seed';
import { exportCSV } from '../../../lib/dgms/export';
import { fmtDate } from '../../../lib/dgms/format';
import { FindingStatus, MineStatus, MineType, RiskLevel } from '../../../lib/dgms/types';
import type { Mine } from '../../../lib/dgms/types';
import { ConfirmDialog, DataTable, DemoBadge, DetailDrawer, FilterBar, KpiCard, Kv, SearchInput, SectionCard, StatusPill, Toasts, type Column } from '../../../components/dgms/ui';

const STATUS_OPTS = ['All Statuses', MineStatus.Active, MineStatus.UnderInspection, MineStatus.Inactive, MineStatus.Closed];
const TYPE_OPTS = ['All Types', MineType.OpenCast, MineType.Underground];


const EMPTY_MINE = {
  code: '', name: '', state: 'Jharkhand', district: '', operator: '',
  type: MineType.OpenCast, status: MineStatus.Active, risk: RiskLevel.Medium,
  address: '', contactName: '', contactPhone: '', productionMt: 0, lastInspection: '2026-10-03',
};

export default function RegistryPage() {
  const db = useMockDb();
  const [q, setQ] = useState(''); const [qq, setQq] = useState('');
  const [draft, setDraft] = useState({ state: 'All States', status: 'All Statuses', type: 'All Types', operator: 'All Operators' });
  const [applied, setApplied] = useState(draft);
  const [sel, setSel] = useState<Mine | null>(null);
  const [editing, setEditing] = useState<Mine | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_MINE);
  const [formErr, setFormErr] = useState('');
  const [measure, setMeasure] = useState<'count' | 'production'>('count');
  const [confirmDeact, setConfirmDeact] = useState<Mine | null>(null);

  const states = useMemo(() => ['All States', ...[...new Set(db.mines.map((m) => m.state))].sort()], [db.mines]);
  const operators = useMemo(() => ['All Operators', ...[...new Set(db.mines.map((m) => m.operator))].sort()], [db.mines]);

  const rows = db.mines.filter((m) => {
    const needle = qq.trim().toLowerCase();
    if (needle && !(m.name.toLowerCase().includes(needle) || m.code.toLowerCase().includes(needle) || m.operator.toLowerCase().includes(needle) || m.district.toLowerCase().includes(needle))) return false;
    if (applied.state !== 'All States' && m.state !== applied.state) return false;
    if (applied.status !== 'All Statuses' && m.status !== applied.status) return false;
    if (applied.type !== 'All Types' && m.type !== applied.type) return false;
    if (applied.operator !== 'All Operators' && m.operator !== applied.operator) return false;
    return true;
  });

  const openCount = (id: string) => db.findings.filter((f) => f.mineId === id && f.status !== FindingStatus.Resolved).length;

  const columns: Column<Mine>[] = [
    { key: 'code', header: 'Mine Code', render: (m) => <span className="font-bold text-blue-700">{m.code}</span>, sortValue: (m) => m.code },
    { key: 'name', header: 'Mine Name', render: (m) => <span className="font-semibold text-navy">{m.name}</span>, sortValue: (m) => m.name },
    { key: 'state', header: 'State', render: (m) => m.state, sortValue: (m) => m.state },
    { key: 'district', header: 'District', render: (m) => m.district, sortValue: (m) => m.district },
    { key: 'operator', header: 'Operator', render: (m) => m.operator, sortValue: (m) => m.operator },
    { key: 'status', header: 'Status', render: (m) => <StatusPill v={m.status} />, sortValue: (m) => m.status },
    { key: 'risk', header: 'Risk Level', render: (m) => <StatusPill v={m.risk} />, sortValue: (m) => m.risk },
    { key: 'last', header: 'Last Inspection', render: (m) => fmtDate(m.lastInspection), sortValue: (m) => m.lastInspection },
    {
      key: 'actions', header: 'Actions', render: (m) => (
        <button className="text-blue-700 border border-blue-200 rounded-lg px-2.5 py-1 text-[12px] font-bold"
          onClick={(e) => { e.stopPropagation(); setSel(m); }}>View</button>
      ),
    },
  ];

  const stateChart = states.slice(1).map((s) => ({
    state: s,
    value: measure === 'count'
      ? db.mines.filter((m) => m.state === s).length
      : +db.mines.filter((m) => m.state === s).reduce((a, m) => a + m.productionMt, 0).toFixed(1),
  }));

  function doExport() {
    exportCSV(`mine-registry-${Date.now()}`, ['Mine Code', 'Mine Name', 'State', 'District', 'Operator', 'Type', 'Status', 'Risk', 'Last Inspection'],
      rows.map((m) => [m.code, m.name, m.state, m.district, m.operator, m.type, m.status, m.risk, m.lastInspection]));
  }

  function submitForm(isEdit: boolean) {
    setFormErr('');
    if (!form.code.trim() || !form.name.trim() || !form.operator.trim()) { setFormErr('Mine code, name and operator are required.'); return; }
    try {
      if (isEdit && editing) actions.updateMine(editing.id, { ...form });
      else actions.createMine({ ...form });
      setAdding(false); setEditing(null); setForm(EMPTY_MINE);
    } catch (e) { setFormErr(e instanceof Error ? e.message : 'Save failed.'); }
  }

  return (
    <Shell title="Mine Registry" subtitle="View and manage all registered mines across India.">
      <div className="flex gap-2 mb-3 flex-wrap items-center">
        <span className="ml-auto"><DemoBadge /></span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mb-3">
        <KpiCard icon={<Mountain size={22} />} label="Total Registered Mines" value={db.mines.length} />
        <KpiCard icon={<Mountain size={22} />} label="Active Mines" value={db.mines.filter((m) => m.status === MineStatus.Active).length} />
        <KpiCard icon={<Mountain size={22} />} label="Under Inspection" value={db.mines.filter((m) => m.status === MineStatus.UnderInspection).length} />
        <KpiCard icon={<Mountain size={22} />} label="High Risk Mines" value={db.mines.filter((m) => m.risk === RiskLevel.High || m.risk === RiskLevel.Critical).length} />
        <KpiCard icon={<Mountain size={22} />} label="Inactive / Closed" value={db.mines.filter((m) => m.status === MineStatus.Inactive || m.status === MineStatus.Closed).length} />
      </div>

      <SectionCard title={`Mine Registry (${rows.length})`} action={
        <div className="flex gap-2">
          <button className="text-blue-700 border border-blue-200 rounded-lg px-3 py-1.5 text-[12px] font-bold" onClick={doExport}>⤓ Export</button>
          <button className="btn-primary !py-1.5" onClick={() => { setForm(EMPTY_MINE); setFormErr(''); setAdding(true); }}>+ Add Mine</button>
        </div>
      }>
        <SearchInput value={q} onChange={setQ} onSearch={() => setQq(q)} ph="Search by mine name, code, operator or location…" />
        <FilterBar defs={[
          { key: 'state', label: 'State', options: states },
          { key: 'status', label: 'Mine Status', options: STATUS_OPTS },
          { key: 'type', label: 'Mine Type', options: TYPE_OPTS },
          { key: 'operator', label: 'Operator', options: operators, width: '!w-52' },
        ]} values={draft} onChange={(k, v) => setDraft((d) => ({ ...d, [k]: v }))}
          onApply={() => setApplied(draft)}
          onReset={() => { const r = { state: 'All States', status: 'All Statuses', type: 'All Types', operator: 'All Operators' }; setDraft(r); setApplied(r); setQ(''); setQq(''); }} />
        <div className="mt-3">
          <DataTable columns={columns} rows={rows} onRowClick={(m) => setSel(m)} />
        </div>
      </SectionCard>

      <SectionCard className="mt-3" title="Mines by State" action={
        <select className="input !w-auto !py-1.5 text-[12px]" value={measure} onChange={(e) => setMeasure(e.target.value as 'count' | 'production')}>
          <option value="count">Mine count</option>
          <option value="production">Production (Mt)</option>
        </select>
      }>
        <div className="h-[220px]">
          <ResponsiveContainer>
            <BarChart data={stateChart} layout="vertical" margin={{ left: 90 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="state" tick={{ fontSize: 11 }} width={85} />
              <Tooltip />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} onClick={(d: { state?: string }) => {
                if (d?.state) { setDraft((x) => ({ ...x, state: d.state as string })); setApplied((x) => ({ ...x, state: d.state as string })); }
              }}>
                {stateChart.map((r, i) => <Cell key={r.state} fill={['#2563eb', '#16a34a', '#f59e0b', '#8b5cf6'][i % 4]} cursor="pointer" />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="text-[11px] text-slate-500 mt-1">Click a bar to filter the registry by that state.</div>
      </SectionCard>

      {sel && (
        <DetailDrawer title={`${sel.name} (${sel.code})`} onClose={() => setSel(null)}>
          <div className="flex items-center gap-2 mb-2">
            <StatusPill v={sel.status} /><StatusPill v={sel.risk} />
            <span className="text-[11px] text-slate-500 ml-auto">Compliance: {complianceOfMine(sel.id, db.findings)}</span>
          </div>
          <Kv k="Operator" v={sel.operator} />
          <Kv k="State / District" v={`${sel.state} / ${sel.district}`} />
          <Kv k="Address" v={sel.address} />
          <Kv k="Mine Type" v={sel.type} />
          <Kv k="Production" v={`${sel.productionMt} Mt`} />
          <Kv k="Last Inspection" v={fmtDate(sel.lastInspection)} />
          <Kv k="Open Findings" v={openCount(sel.id)} />
          <Kv k="Contact" v={`${sel.contactName} · ${sel.contactPhone}`} />
          <Kv k="Location" v={`Demo coords ${sel.location.lat}, ${sel.location.lng} (fictional)`} />
          <div className="grid grid-cols-2 gap-2 mt-4">
            <button className="btn-primary" onClick={() => { setForm({ ...sel }); setFormErr(''); setEditing(sel); }}>Edit Mine</button>
            <button className="btn-primary !bg-white !text-navy border border-slate-300" onClick={() => setConfirmDeact(sel)}>Deactivate</button>
          </div>
          <p className="text-[11px] text-slate-500 mt-3">Records are archived via status change (Active → Inactive), never hard-deleted. Inactive mines leave all selection lists.</p>
        </DetailDrawer>
      )}

      {(adding || editing) && (
        <DetailDrawer title={editing ? `Edit ${editing.code}` : 'Add Mine'} onClose={() => { setAdding(false); setEditing(null); }}>
          {formErr && <div className="text-[13px] bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 mb-3">{formErr}</div>}
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs font-semibold text-slate-600">Mine Code *<input className="input mt-1" value={form.code} disabled={!!editing} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} /></label>
            <label className="block text-xs font-semibold text-slate-600">Mine Name *<input className="input mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label className="block text-xs font-semibold text-slate-600">State<select className="input mt-1" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })}>{states.slice(1).map((s) => <option key={s}>{s}</option>)}</select></label>
            <label className="block text-xs font-semibold text-slate-600">District<input className="input mt-1" value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} /></label>
            <label className="block text-xs font-semibold text-slate-600 col-span-2">Operator *<input className="input mt-1" value={form.operator} onChange={(e) => setForm({ ...form, operator: e.target.value })} /></label>
            <label className="block text-xs font-semibold text-slate-600">Mine Type<select className="input mt-1" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as MineType })}>{Object.values(MineType).map((t) => <option key={t}>{t}</option>)}</select></label>
            <label className="block text-xs font-semibold text-slate-600">Risk<select className="input mt-1" value={form.risk} onChange={(e) => setForm({ ...form, risk: e.target.value as RiskLevel })}>{Object.values(RiskLevel).map((t) => <option key={t}>{t}</option>)}</select></label>
            <label className="block text-xs font-semibold text-slate-600 col-span-2">Address<input className="input mt-1" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
            <label className="block text-xs font-semibold text-slate-600">Contact Name<input className="input mt-1" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} /></label>
            <label className="block text-xs font-semibold text-slate-600">Contact Phone<input className="input mt-1" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} /></label>
          </div>
          <button className="btn-primary w-full mt-4" onClick={() => submitForm(!!editing)}>{editing ? 'Save Changes' : 'Register Mine'}</button>
        </DetailDrawer>
      )}

      {confirmDeact && (
        <ConfirmDialog title="Deactivate mine?" body={`${confirmDeact.name} will be set to Inactive and removed from selection lists. History is preserved.`}
          confirmLabel="Deactivate" onCancel={() => setConfirmDeact(null)}
          onConfirm={() => { actions.updateMine(confirmDeact.id, { status: MineStatus.Inactive }); setConfirmDeact(null); setSel(null); }} />
      )}
      <Toasts />
    </Shell>
  );
}







