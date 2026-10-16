/**
 * Page 5 — Safety & Environment. Readings are synthetic demo values
 * (every record carries demo:true). Acknowledge changes alert state + counts.
 */
'use client';
import { useMemo, useState } from 'react';
import { Leaf } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Shell from '../../../components/Shell';
import { actions, useMockDb } from '../../../lib/dgms/mockDb';
import { exportCSV } from '../../../lib/dgms/export';
import { fmtDate, relTime } from '../../../lib/dgms/format';
import { AlertStatus, ComplianceStatus, EnvParam, EnvStatus, Severity } from '../../../lib/dgms/types';
import { ConfirmDialog, DataTable, DemoBadge, DetailDrawer, FilterBar, KpiCard, Kv, SearchInput, SectionCard, Toasts, type Column } from '../../../components/dgms/ui';
import { StatusPill } from '../../../components/dgms/ui';
import type { EnvironmentalRecord, SafetyIncident, SensorAlert } from '../../../lib/dgms/types';

/** Deterministic 7-point demo series anchored on the current reading. */
function seriesFor(r: EnvironmentalRecord): { t: string; v: number }[] {
  const seed = [...r.id].reduce((a, c) => a + c.charCodeAt(0), 0);
  return Array.from({ length: 7 }, (_, i) => ({
    t: `${String(27 + i).padStart(2, '0')} Sep`.replace('30 Sep', '30 Sep').replace('31 Sep', '01 Oct').replace('32 Sep', '02 Oct').replace('33 Sep', '03 Oct'),
    v: +(r.value * (0.86 + ((seed + i * 13) % 20) / 100)).toFixed(1),
  }));
}

const PARAMS = ['All Parameters', ...Object.values(EnvParam)];

export default function SafetyPage() {
  const db = useMockDb();
  const [param, setParam] = useState<EnvParam>(EnvParam.AirQuality);
  const [period, setPeriod] = useState('Daily');
  const [q, setQ] = useState(''); const [qq, setQq] = useState('');
  const [draft, setDraft] = useState({ state: 'All States', status: 'All Statuses' });
  const [applied, setApplied] = useState(draft);
  const [selAlert, setSelAlert] = useState<SensorAlert | null>(null);
  const [selMineEnv, setSelMineEnv] = useState<string | null>(null);
  const [confirmAck, setConfirmAck] = useState<SensorAlert | null>(null);

  const states = useMemo(() => ['All States', ...[...new Set(db.mines.map((m) => m.state))].sort()], [db.mines]);
  const mineOf = (id: string) => db.mines.find((m) => m.id === id);
  const mineLabel = (id: string) => { const m = mineOf(id); return m ? `${m.name} (${m.code})` : id; };

  const alerts = db.alerts.filter((a) => {
    const m = mineOf(a.mineId);
    if (applied.state !== 'All States' && m?.state !== applied.state) return false;
    if (applied.status !== 'All Statuses' && a.status !== applied.status) return false;
    const needle = qq.trim().toLowerCase();
    if (needle && !(a.parameter.toLowerCase().includes(needle) || (m?.name.toLowerCase().includes(needle)))) return false;
    return true;
  });

  const paramRecords = db.env.filter((r) => r.parameter === param);
  const trendSource = paramRecords[0];
  const trend = trendSource ? seriesFor(trendSource) : [];

  const envByStatus = (Object.values(EnvStatus) as EnvStatus[]).map((s) => ({
    name: s, value: db.env.filter((r) => r.status === s).length,
    color: s === EnvStatus.Normal ? '#16a34a' : s === EnvStatus.Warning ? '#f59e0b' : s === EnvStatus.Critical ? '#ef4444' : '#94a3b8',
  }));

  const incTrend = useMemo(() => {
    const days = ['27 Sep', '28 Sep', '29 Sep', '30 Sep', '01 Oct', '02 Oct', '03 Oct'];
    return days.map((d, i) => ({
      d, n: db.incidents.filter((x) => {
        const day = Number(x.date.slice(8, 10));
        return (x.date.startsWith('2026-09') && day === 27 + i && i < 4) || (x.date.startsWith('2026-10') && (day - 1) === (i - 4) && i >= 4);
      }).length,
    }));
  }, [db.incidents]);

  const openFindings = db.findings.filter((f) => f.status !== 'Resolved' && (f.category === 'Environment' || f.category === 'Safety'));
  const compliant = db.mines.filter((m) => !openFindings.some((f) => f.mineId === m.id)).length;
  const nonCompliant = db.mines.filter((m) => openFindings.some((f) => f.mineId === m.id && f.severity === Severity.Critical)).length;
  const partial = db.mines.length - compliant - nonCompliant;
  void period;

  const columns: Column<EnvironmentalRecord>[] = [
    { key: 'mine', header: 'Mine Name', render: (r) => <span className="font-semibold text-navy">{mineLabel(r.mineId)}</span>, sortValue: (r) => mineLabel(r.mineId) },
    { key: 'state', header: 'State', render: (r) => mineOf(r.mineId)?.state ?? '—', sortValue: (r) => mineOf(r.mineId)?.state ?? '' },
    { key: 'param', header: 'Parameter', render: (r) => `${r.parameter} · ${r.metric}`, sortValue: (r) => r.parameter },
    { key: 'val', header: 'Current Value', render: (r) => `${r.value} ${r.unit}`, sortValue: (r) => r.value },
    { key: 'thr', header: 'Threshold', render: (r) => `${r.threshold} ${r.unit}`, sortValue: (r) => r.threshold },
    { key: 'status', header: 'Status', render: (r) => <StatusPill v={r.status} />, sortValue: (r) => r.status },
    { key: 'upd', header: 'Last Updated', render: (r) => relTime(r.updatedAt), sortValue: (r) => r.updatedAt },
  ];

  const mineEnv = selMineEnv ? db.env.filter((r) => r.mineId === selMineEnv) : [];

  return (
    <Shell title="Safety & Environment" subtitle="Monitor environmental parameters, sensor alerts and safety compliance. Synthetic demo readings.">
      <div className="flex gap-2 mb-3 flex-wrap items-center"><span className="ml-auto"><DemoBadge /></span></div>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mb-3">
        <KpiCard icon={<Leaf size={22} />} label="Mines with Sensors" value={new Set(db.env.map((r) => r.mineId)).size} sub={`of ${db.mines.length} mines`} />
        <KpiCard icon={<Leaf size={22} />} label="Critical Alerts" value={db.alerts.filter((a) => a.severity === Severity.Critical && a.status === AlertStatus.Open).length} sub="open" />
        <KpiCard icon={<Leaf size={22} />} label="Air Quality Exceedances" value={db.env.filter((r) => r.status !== EnvStatus.Normal && (r.parameter === EnvParam.AirQuality || r.parameter === EnvParam.Dust)).length} />
        <KpiCard icon={<Leaf size={22} />} label="Safety Incidents" value={db.incidents.length} sub="in scope" />
        <KpiCard icon={<Leaf size={22} />} label="Non-Compliant Issues" value={db.env.filter((r) => r.status === EnvStatus.Critical).length + openFindings.length} />
      </div>

      <SectionCard title="Environmental Parameters Trend" action={
        <div className="flex gap-2">
          <select className="input !w-auto !py-1.5 text-[12px]" value={param} onChange={(e) => setParam(e.target.value as EnvParam)}>
            {Object.values(EnvParam).map((p) => <option key={p}>{p}</option>)}
          </select>
          <select className="input !w-auto !py-1.5 text-[12px]" value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option>Daily</option><option>Weekly</option>
          </select>
        </div>
      }>
        <div className="text-[11px] text-slate-500 mb-1">Showing {param} · {trendSource ? `${trendSource.metric} (${trendSource.unit})` : 'no records'} · synthetic demo series</div>
        <div className="h-[210px]">
          <ResponsiveContainer>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
              <XAxis dataKey="t" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="v" stroke="#1463D9" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      <div className="grid xl:grid-cols-3 gap-3 mt-3">
        <SectionCard title="Mines by Environmental Status" action={<span className="text-[11px] text-slate-500 font-normal">Click a mine for details</span>}>
          <div className="text-[12px] space-y-1.5 max-h-[220px] overflow-y-auto">
            {db.mines.map((m) => {
              const worst = db.env.filter((r) => r.mineId === m.id).some((r) => r.status === EnvStatus.Critical) ? EnvStatus.Critical
                : db.env.filter((r) => r.mineId === m.id).some((r) => r.status === EnvStatus.Warning) ? EnvStatus.Warning
                : db.env.some((r) => r.mineId === m.id) ? EnvStatus.Normal : EnvStatus.NoData;
              const dot = worst === EnvStatus.Critical ? 'bg-red-500' : worst === EnvStatus.Warning ? 'bg-amber-400' : worst === EnvStatus.Normal ? 'bg-green-500' : 'bg-slate-300';
              return (
                <button key={m.id} className="w-full flex items-center gap-2 hover:bg-blue-50 rounded-lg px-1 py-0.5 text-left" onClick={() => setSelMineEnv(m.id)}>
                  <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />{m.name}<span className="ml-auto text-slate-500">{worst}</span>
                </button>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard title={`Live Sensor Alerts (${db.alerts.filter((a) => a.status === AlertStatus.Open).length} open)`} action={<span className="text-[11px] text-amber-700 font-semibold">DEMO feed</span>}>
          <div className="space-y-2 max-h-[220px] overflow-y-auto">
            {db.alerts.slice(0, 7).map((a) => (
              <div key={a.id} className="flex gap-2 items-start border-b last:border-0 pb-2">
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold text-navy truncate">{a.parameter}</div>
                  <div className="text-[11px] text-slate-500">{mineLabel(a.mineId)} · {a.reading} (limit {a.threshold}) · {relTime(a.timestamp)}</div>
                </div>
                <StatusPill v={a.severity} />
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Compliance Status">
          <div className="h-[150px] relative">
            <ResponsiveContainer>
              <PieChart><Pie data={[
                { name: 'Compliant', value: compliant, color: '#16a34a' },
                { name: 'Partial', value: partial, color: '#f59e0b' },
                { name: 'Non-Compliant', value: nonCompliant, color: '#ef4444' },
              ]} dataKey="value" innerRadius={42} outerRadius={62} paddingAngle={2}>
                {[ '#16a34a', '#f59e0b', '#ef4444'].map((c) => <Cell key={c} fill={c} />)}
              </Pie></PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><span className="text-xl font-extrabold text-navy">{db.mines.length}</span></div>
          </div>
          <div className="text-[12px] space-y-1">
            <div className="flex gap-2"><span className="w-2.5 h-2.5 rounded-full bg-green-500 mt-1" />Compliant<b className="ml-auto">{compliant}</b></div>
            <div className="flex gap-2"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 mt-1" />Partial<b className="ml-auto">{partial}</b></div>
            <div className="flex gap-2"><span className="w-2.5 h-2.5 rounded-full bg-red-500 mt-1" />Non-Compliant<b className="ml-auto">{nonCompliant}</b></div>
          </div>
        </SectionCard>
      </div>

      <SectionCard className="mt-3" title={`Environmental & Safety Records (${db.env.length})`} action={
        <button className="text-blue-700 border border-blue-200 rounded-lg px-3 py-1.5 text-[12px] font-bold" onClick={() =>
          exportCSV('environment-records', ['Mine', 'State', 'Parameter', 'Metric', 'Value', 'Threshold', 'Status', 'Updated'],
            db.env.map((r) => [mineLabel(r.mineId), mineOf(r.mineId)?.state ?? '', r.parameter, r.metric, `${r.value} ${r.unit}`, `${r.threshold} ${r.unit}`, r.status, r.updatedAt]))}>⤓ Export</button>
      }>
        <SearchInput value={q} onChange={setQ} onSearch={() => setQq(q)} ph="Search by mine or parameter…" />
        <FilterBar defs={[
          { key: 'state', label: 'State', options: states },
          { key: 'status', label: 'Status', options: ['All Statuses', ...Object.values(EnvStatus)] },
        ]} values={draft} onChange={(k, v) => setDraft((d) => ({ ...d, [k]: v }))}
          onApply={() => setApplied(draft)}
          onReset={() => { setDraft({ state: 'All States', status: 'All Statuses' }); setApplied({ state: 'All States', status: 'All Statuses' }); setQ(''); setQq(''); }} />
        <div className="mt-3">
          <DataTable columns={columns} rows={db.env.filter((r) => {
            const needle = qq.trim().toLowerCase();
            if (needle && !(mineLabel(r.mineId).toLowerCase().includes(needle) || r.parameter.toLowerCase().includes(needle))) return false;
            if (applied.state !== 'All States' && mineOf(r.mineId)?.state !== applied.state) return false;
            if (applied.status !== 'All Statuses' && r.status !== applied.status) return false;
            return true;
          })} />
        </div>
      </SectionCard>

      <div className="grid xl:grid-cols-3 gap-3 mt-3">
        <SectionCard className="xl:col-span-2" title="Sensor Alert Register" action={<span className="text-[11px] text-slate-500 font-normal">Acknowledge updates state + counts (not the condition)</span>}>
          <div className="overflow-x-auto"><table className="dense w-full min-w-[720px]">
            <thead><tr><th>Alert</th><th>Mine</th><th>Reading / Threshold</th><th>Severity</th><th>Time</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>{alerts.map((a) => (
              <tr key={a.id}>
                <td className="font-bold text-navy">{a.parameter}</td>
                <td>{mineLabel(a.mineId)}</td>
                <td className="text-[12px]">{a.reading} <span className="text-slate-400">/ {a.threshold}</span></td>
                <td><StatusPill v={a.severity} /></td>
                <td className="text-[12px]">{relTime(a.timestamp)}</td>
                <td><StatusPill v={a.status} /></td>
                <td><div className="flex gap-1">
                  <button className="text-blue-700 border border-blue-200 rounded-lg px-2 py-1 text-[12px] font-bold" onClick={() => setSelAlert(a)}>View</button>
                  {a.status === AlertStatus.Open && <button className="text-[12px] font-bold text-amber-700 border border-amber-300 rounded-lg px-2 py-1" onClick={() => setConfirmAck(a)}>Acknowledge</button>}
                </div></td>
              </tr>
            ))}</tbody>
          </table></div>
        </SectionCard>
        <SectionCard title="Safety Incidents Trend">
          <div className="h-[210px]">
            <ResponsiveContainer>
              <BarChart data={incTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                <XAxis dataKey="d" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="n" fill="#2563eb" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="text-[12px] mt-1 space-y-1 max-h-[120px] overflow-y-auto">
            {db.incidents.slice(0, 5).map((i: SafetyIncident) => (
              <div key={i.id} className="flex gap-2 py-1 border-b last:border-0">
                <span className="font-bold">{i.type}</span><StatusPill v={i.severity} />
                <span className="ml-auto text-slate-500">{fmtDate(i.date)}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard className="mt-3" title="Environmental Reports" action={<span className="text-xs text-slate-500 font-normal">Generates a real downloadable CSV from current records.</span>}>
        <div className="grid sm:grid-cols-3 xl:grid-cols-6 gap-2">
          {['Air Quality Report', 'Water Quality Report', 'Land & Soil Monitoring Report', 'Waste Management Report', 'Noise Monitoring Report', 'Environmental Compliance Report'].map((t) => (
            <button key={t} className="border rounded-xl p-3 hover:border-blue-400 hover:shadow-sm transition text-left" onClick={() => {
              const id = actions.generateReport('Environmental Report', `${t} (${fmtDate('2026-10-03')})`, { scope: 'all mines' },
                ['Mine,Parameter,Metric,Value,Threshold,Status', ...db.env.map((r) => [mineLabel(r.mineId), r.parameter, r.metric, r.value, r.threshold, r.status].join(','))].join('\n'));
              window.location.href = '/dgms/reports';
              void id;
            }}>
              <div className="text-[12px] font-bold text-navy">{t} →</div>
              <div className="text-[11px] text-slate-500 mt-1">Generate from live demo data</div>
            </button>
          ))}
        </div>
      </SectionCard>

      {selAlert && (
        <DetailDrawer title={`Alert ${selAlert.id}`} onClose={() => setSelAlert(null)}>
          <Kv k="Parameter" v={selAlert.parameter} />
          <Kv k="Mine" v={mineLabel(selAlert.mineId)} />
          <Kv k="Reading" v={selAlert.reading} />
          <Kv k="Threshold" v={selAlert.threshold} />
          <Kv k="Severity" v={<StatusPill v={selAlert.severity} />} />
          <Kv k="Detected" v={`${fmtDate(selAlert.timestamp)} (${relTime(selAlert.timestamp)})`} />
          <Kv k="Status" v={<StatusPill v={selAlert.status} />} />
          <Kv k="Source" v="Demo sensor feed (synthetic — not live telemetry)" />
          {selAlert.status === AlertStatus.Open && (
            <button className="btn-primary w-full mt-4" onClick={() => setConfirmAck(selAlert)}>Acknowledge Alert</button>
          )}
        </DetailDrawer>
      )}

      {selMineEnv && (
        <DetailDrawer title={`Environment — ${mineLabel(selMineEnv)}`} onClose={() => setSelMineEnv(null)}>
          {mineEnv.length === 0 && <div className="text-[13px] text-slate-500">No sensor data for this mine (No Data).</div>}
          {mineEnv.map((r) => (
            <div key={r.id} className="border rounded-xl p-3 mb-2 text-[13px]">
              <div className="flex items-center gap-2"><span className="font-bold">{r.parameter} · {r.metric}</span><span className="ml-auto"><StatusPill v={r.status} /></span></div>
              <div className="text-slate-600 mt-1">Current: <b>{r.value} {r.unit}</b> · Threshold: {r.threshold} {r.unit}</div>
              <div className="text-[11px] text-slate-500">Updated {relTime(r.updatedAt)} · demo reading</div>
            </div>
          ))}
        </DetailDrawer>
      )}

      {confirmAck && (
        <ConfirmDialog title="Acknowledge alert?" body={`${confirmAck.parameter} at ${mineLabel(confirmAck.mineId)}. Acknowledgement records receipt — it does not fix the condition.`}
          confirmLabel="Acknowledge" onCancel={() => setConfirmAck(null)}
          onConfirm={() => { actions.acknowledgeAlert(confirmAck.id); setConfirmAck(null); setSelAlert(null); }} />
      )}
      <Toasts />
    </Shell>
  );
}




