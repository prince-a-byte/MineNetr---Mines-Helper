'use client';
import { inspectorNav } from './nav';
import { useEffect, useState } from 'react';
import RoleShell, { DarkBanner } from '../../components/RoleShell';
import { api } from '../../lib/api';
import { pill } from '../../components/ops';
import { LayoutDashboard, ClipboardList, CalendarDays, ListChecks, TriangleAlert, Camera, Leaf, Truck, Users, BarChart3, ShieldCheck, MessagesSquare, FolderClosed, Settings, ClipboardCheck, ListVideo, ScanLine, Database, FilePlus, Siren, Bell } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';


const envTrend = [
  { h: '12 AM', m: 30, d: 55, c: 20 }, { h: '4 AM', m: 38, d: 62, c: 26 }, { h: '8 AM', m: 45, d: 70, c: 32 },
  { h: '12 PM', m: 52, d: 78, c: 38 }, { h: '4 PM', m: 48, d: 72, c: 34 }, { h: '8 PM', m: 40, d: 64, c: 28 },
];

export default function InspectorDashboard() {
  const [d, setD] = useState<any>(null); const [err, setErr] = useState('');
  const [user, setUser] = useState<any>(null);
  useEffect(() => {
    try { setUser(JSON.parse(localStorage.getItem('minenetr_user') || 'null')); } catch {}
    api('/api/v1/role/overview').then(setD).catch((e: any) => setErr(e.message));
  }, []);
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const prog = d?.progress;
  const progData = prog ? [
    { name: 'Completed', value: prog.completed, color: '#10b981' }, { name: 'In Progress', value: prog.inprog, color: '#2563eb' },
    { name: 'Pending', value: prog.pending, color: '#f59e0b' }, { name: 'Overdue', value: prog.overdue, color: '#ef4444' },
  ] : [];
  return (
    <RoleShell role="inspector" nav={inspectorNav} orgTitle="Mine Inspector (DGMS)" orgSub="Directorate General of Mines Safety"
      mineName="Bharat Coal Mine (BCM-01)"
      banner={<DarkBanner>
        <div className="min-w-[220px]">
          <div className="text-slate-300">{greet},</div>
          <div className="text-3xl md:text-4xl font-extrabold">{user?.name || 'Inspector'}</div>
          <div className="text-cyan-300 font-semibold text-sm">Mine Inspector (DGMS)</div>
          <div className="text-slate-300 text-sm">Inspect. Verify. Ensure Safer Mines.</div>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          {[['📅', 'Today', '03 Oct 2026 · Friday'], ['🕙', 'Next Inspection', '10:00 AM · BCM-03'], ['☀️', '28°C Clear', 'Dhanbad, Jharkhand']].map(([i, a, b]) => (
            <div key={a as string} className="bg-[#0a1128]/85 border border-white/10 rounded-xl px-4 py-3 text-[12px] flex gap-2.5 items-center">
              <span className="text-xl">{i}</span><span><b>{a}</b><br /><span className="text-slate-300">{b}</span></span></div>))}
        </div>
      </DarkBanner>}>
      {err ? <div className="card text-sm text-red-600">Backend unreachable: {err}</div> :
       !d ? <div className="card text-sm text-slate-500">Loading inspection workspace…</div> : <>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {d.kpis.map((k: any, i: number) => (
          <div key={k.label} className="card !p-3.5 flex gap-2.5 items-start">
            <div className={`kpi-icon !w-10 !h-10 ${['bg-blue-50 text-blue-600', 'bg-green-50 text-green-600', 'bg-amber-50 text-amber-500', 'bg-red-50 text-red-500', 'bg-red-50 text-red-500', 'bg-blue-50 text-blue-600'][i]}`}>
              <ClipboardCheck size={19} /></div>
            <div><div className="text-[11px] font-semibold text-slate-600">{k.label}</div>
            <div className="text-xl font-extrabold text-navy">{k.value} {k.delta ? <span className={`text-[11px] font-bold ${String(k.delta).startsWith('-') ? 'text-red-500' : 'text-green-600'}`}>{k.delta}</span> : null}</div>
            <div className="text-[10px] text-slate-500">{k.sub}</div></div></div>))}
      </div>
      <div className="grid xl:grid-cols-3 gap-3 mt-3">
        <div className="card">
          <div className="font-extrabold text-navy">Today&apos;s Inspection Schedule <a href="/inspector/schedule" className="float-right text-blue-600 text-xs font-bold">View All</a></div>
          <div className="mt-2 space-y-0">{d.today.map((t: any, i: number) => (
            <div key={i} className="flex gap-3">
              <div className="flex flex-col items-center"><span className={`w-3 h-3 rounded-full mt-1 ${i === 0 ? 'bg-blue-600' : 'bg-white border-2 border-slate-300'}`} />
              {i < d.today.length - 1 && <span className="w-0.5 flex-1 bg-slate-200" />}</div>
              <div className="flex-1 pb-3">
                <div className="text-[11px] text-slate-500">{t.time}</div>
                <div className="flex items-center gap-2 bg-slate-50 border rounded-xl px-3 py-2 mt-0.5">
                  <div className="flex-1"><div className="font-extrabold text-navy text-sm">{t.mine}</div>
                  <div className="text-[11px] text-slate-500">{t.type}</div></div>
                  {pill(t.pri.replace(' Priority', ''))}<span className="text-slate-300">›</span></div>
              </div></div>))}</div>
        </div>
        <div className="card">
          <div className="font-extrabold text-navy">Inspection Progress (This Month)</div>
          <div className="flex items-center gap-2">
            <div className="h-[190px] w-[55%]"><ResponsiveContainer>
              <PieChart><Pie data={progData} dataKey="value" innerRadius={55} outerRadius={80} paddingAngle={2}>
                {progData.map(x => <Cell key={x.name} fill={x.color} />)}</Pie></PieChart></ResponsiveContainer></div>
            <div className="text-[12px] space-y-1.5 flex-1">{progData.map(x => (
              <div key={x.name} className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: x.color }} />{x.name}<b className="ml-auto">{x.value} ({Math.round(x.value / prog.total * 100)}%)</b></div>))}</div>
          </div>
          <div className="text-center text-sm font-extrabold text-navy -mt-24 pointer-events-none" style={{ display: 'none' }} />
        </div>
        <div className="card">
          <div className="font-extrabold text-navy">Mine Locations <span className="float-right text-blue-600 text-xs font-bold">View Full Map</span></div>
          <svg viewBox="0 0 300 170" className="w-full h-44 rounded-xl mt-1" style={{ background: '#20242a' }} aria-label="Mine location map (registered coordinates, stylised)">
            <g opacity="0.5" stroke="#3a4150" strokeWidth="1">
              {Array.from({ length: 9 }).map((_, i) => <line key={'h' + i} x1="0" y1={i * 20} x2="300" y2={i * 20} />)}
              {Array.from({ length: 15 }).map((_, i) => <line key={'v' + i} x1={i * 20} y1="0" x2={i * 20} y2="170" />)}
            </g>
            {[['BCM-01', 150, 45, '#10b981'], ['BCM-02', 225, 70, '#3b82f6'], ['BCM-03', 120, 110, '#ef4444'], ['BCM-04', 190, 135, '#f59e0b'], ['BCM-05', 245, 130, '#8b5cf6']].map(([c, x, y, col]: any) => (
              <g key={c as string}><circle cx={x} cy={y} r="9" fill={col} opacity="0.9" />
              <circle cx={x} cy={y} r="3.5" fill="#fff" />
              <rect x={Number(x) + 11} y={Number(y) - 9} rx="4" width="52" height="17" fill="#0a1128" opacity="0.9" />
              <text x={Number(x) + 15} y={Number(y) + 4} fontSize="10" fill="#fff" fontWeight="bold">{c}</text></g>))}
          </svg>
          <div className="text-[11px] space-y-1 mt-1">{d.mines.map((m: any) => (
            <div key={m.code} className="flex gap-1.5 items-center"><span>📍</span><b>{m.code}</b><span className="text-slate-500">{m.st}</span></div>))}</div>
        </div>
      </div>
      <div className="grid xl:grid-cols-3 gap-3 mt-3">
        <div className="card">
          <div className="font-extrabold text-navy">Live Environmental Monitoring <span className="float-right text-blue-600 text-xs font-bold">View Details</span></div>
          <div className="grid grid-cols-4 gap-2 mt-2">{d.env.map((e: any) => (
            <div key={e.n} className="bg-slate-50 rounded-xl p-2 text-center">
              <div className="text-[10px] text-slate-500 font-semibold">{e.n}</div>
              <div className="font-extrabold text-navy">{e.v}</div>
              <div className="text-[10px] text-green-600 font-bold">● Normal</div></div>))}</div>
          <div className="h-[130px] mt-1"><ResponsiveContainer>
            <LineChart data={envTrend}><CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
              <XAxis dataKey="h" tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 9 }} /><Tooltip />
              <Line type="monotone" dataKey="m" name="Methane" stroke="#f59e0b" dot={false} />
              <Line type="monotone" dataKey="d" name="Dust" stroke="#2563eb" dot={false} />
              <Line type="monotone" dataKey="c" name="CO" stroke="#10a779" dot={false} />
            </LineChart></ResponsiveContainer></div>
          <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 font-semibold inline-block">DEMO telemetry · simulated</div>
        </div>
        <div className="card">
          <div className="font-extrabold text-navy">AI Detected Observations (Today) <span className="float-right text-blue-600 text-xs font-bold">View All</span></div>
          {d.ai_queue.map((a: any) => (
            <div key={a.id} className="flex gap-2.5 items-center py-2 border-b last:border-0">
              <div className="w-12 h-12 rounded-lg bg-slate-800 text-amber-300 flex items-center justify-center text-lg shrink-0 font-bold">AI</div>
              <div className="flex-1 min-w-0"><div className="text-[13px] font-bold text-navy truncate">{a.id} · {a.t}</div>
              <div className="text-[11px] text-slate-500">AI-detected · {a.verified ? 'human-verified' : 'awaiting human verification'}</div></div>
              {pill(a.sev)}<span className="text-slate-300">›</span></div>))}
          <div className="text-[11px] text-slate-500 mt-1">Predictions are never auto-confirmed — verification required before corrective action.</div>
        </div>
        <div className="card">
          <div className="font-extrabold text-navy">Recent Findings &amp; Actions <span className="float-right text-blue-600 text-xs font-bold">View All</span></div>
          <div className="overflow-x-auto"><table className="dense w-full min-w-[420px]">
            <thead><tr><th>#</th><th>Date</th><th>Mine</th><th>Category</th><th>Severity</th><th>Status</th></tr></thead>
            <tbody>{d.recent_findings.map((f: any, i: number) => (
              <tr key={f.id}><td>{i + 1}</td><td>{f.date}</td><td className="font-bold">{f.mine}</td>
              <td>{f.cat}</td><td>{pill(f.sev)}</td><td>{pill(f.st)}</td></tr>))}</tbody>
          </table></div>
        </div>
      </div>
      <div className="grid xl:grid-cols-3 gap-3 mt-3">
        <div className="card xl:col-span-2">
          <div className="font-extrabold text-navy">Recent Reports <span className="float-right text-blue-600 text-xs font-bold">View All</span></div>
          <div className="overflow-x-auto"><table className="dense w-full min-w-[560px]">
            <thead><tr><th>#</th><th>Report No.</th><th>Mine</th><th>Inspection Type</th><th>Submitted On</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>{d.my_inspections.slice(0, 4).map((r: any, i: number) => (
              <tr key={r.id}><td>{i + 1}</td><td className="font-bold text-navy">INSP-2026-0{56 - i}</td><td className="font-bold">{r.mine}</td>
              <td>{r.type}</td><td>{r.date}</td><td>{pill(r.report === '-' ? r.status : r.report)}</td>
              <td><span className="text-blue-700 font-bold text-[12px]">🗎 View</span></td></tr>))}</tbody>
          </table></div>
        </div>
        <div className="card">
          <div className="font-extrabold text-navy mb-2">Quick Actions</div>
          <div className="grid grid-cols-4 gap-2 text-[11px] font-bold text-center">
            {[[ClipboardCheck, 'Start Inspection', '/inspector/inspections'], [ListVideo, 'Open Checklist', '/inspector/checklists'], [Camera, 'Capture Evidence', '/inspector/evidence'], [ScanLine, 'Scan NFC/RFID', '/inspector/evidence'], [Database, 'View Mine Records', '/inspector/production'], [FilePlus, 'Generate Report', '/inspector/reports'], [Siren, 'Report a Finding', '/inspector/findings'], [Bell, 'View Notifications', '/inspector/communications']].map(([I, t, h]: any) => (
              <a key={t as string} href={h as string} className="border rounded-2xl py-3 px-1 hover:border-blue-400 flex flex-col items-center gap-1 text-slate-700"><I size={20} className="text-blue-600" />{t}</a>))}
          </div>
        </div>
      </div>
      </>}
    </RoleShell>
  );
}
