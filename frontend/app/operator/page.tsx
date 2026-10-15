'use client';
import { operatorNav } from './nav';
import { useEffect, useState } from 'react';
import RoleShell, { LightBanner } from '../../components/RoleShell';
import { api } from '../../lib/api';
import { LayoutDashboard, Users, HardHat, CalendarCheck, Truck, Warehouse, Receipt, FileCheck, BarChart3, ClipboardCheck, Settings, ShoppingCart, Users as UsersIcon, FileText, ShieldCheck, Plus, Upload, IdCard } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend } from 'recharts';
import { pill } from '../../components/ops';


function Gauge({ pct, color }: { pct: number; color: string }) {
  const r = 44; const c = Math.PI * r;
  return (<svg viewBox="0 0 110 62" className="w-28 h-[68px]">
    <path d={`M 11 56 A ${r} ${r} 0 0 1 99 56`} fill="none" stroke="#e2e8f0" strokeWidth="11" strokeLinecap="round" />
    <path d={`M 11 56 A ${r} ${r} 0 0 1 99 56`} fill="none" stroke={color} strokeWidth="11" strokeLinecap="round"
      strokeDasharray={`${(pct / 100) * c} ${c}`} />
  </svg>);
}

const trend = [
  { h: '12AM', ch4: 0.6, co: 9, o2: 20.8, h2s: 1.5 }, { h: '4AM', ch4: 0.7, co: 11, o2: 20.7, h2s: 1.8 },
  { h: '8AM', ch4: 0.9, co: 14, o2: 20.5, h2s: 2.2 }, { h: '12PM', ch4: 0.8, co: 12, o2: 20.6, h2s: 2.0 },
  { h: '4PM', ch4: 0.7, co: 10, o2: 20.7, h2s: 1.7 }, { h: '8PM', ch4: 0.6, co: 9, o2: 20.8, h2s: 1.5 },
  { h: '12AM', ch4: 0.6, co: 8, o2: 20.8, h2s: 1.4 },
];

export default function OperatorDashboard() {
  const [d, setD] = useState<any>(null); const [err, setErr] = useState('');
  const [user, setUser] = useState<any>(null);
  useEffect(() => {
    try { setUser(JSON.parse(localStorage.getItem('minenetr_user') || 'null')); } catch {}
    api('/api/v1/role/overview').then(setD).catch((e: any) => setErr(e.message));
  }, []);
  const kpiIcon = [ShoppingCart, Truck, UsersIcon, FileText, ShieldCheck];
  const kpiBg = ['bg-blue-50 text-blue-600', 'bg-green-50 text-green-600', 'bg-purple-50 text-purple-600', 'bg-amber-50 text-amber-500', 'bg-red-50 text-red-500'];
  return (
    <RoleShell role="operator" nav={operatorNav} orgTitle="Mine Operations" orgSub="Bharat Coking Coal Ltd."
      mineName="Bharat Coal Mine (BCM-03)"
      banner={<LightBanner title={<>Welcome Back, <span className="text-blue-600">{user?.name?.split(' ')[0] || 'Operator'}</span></>} sub="Bharat Coal Mine (BCM-03) — Monitor operations, ensure safety, manage compliance and drive efficient mine operations." />}>
      {err ? <div className="card text-sm text-red-600">Backend unreachable: {err}</div> :
       !d ? <div className="card text-sm text-slate-500">Loading operations overview…</div> : <>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {d.kpis.map((k: any, i: number) => { const I = kpiIcon[i];
          return (<div key={k.label} className="card !p-4 flex gap-3 items-start">
            <div className={`kpi-icon ${kpiBg[i]}`}><I size={22} /></div>
            <div><div className="text-[12px] font-semibold text-slate-600">{k.label}</div>
            <div className="text-2xl font-extrabold text-navy">{k.value} <span className="text-xs font-bold text-green-600">{k.delta}</span></div>
            <div className="text-[11px] text-slate-500">● {k.sub}</div></div></div>); })}
      </div>
      <div className="grid xl:grid-cols-5 gap-3 mt-3">
        <div className="card xl:col-span-3">
          <div className="font-extrabold text-navy">Live Safety &amp; Gas Monitoring <span className="badge bg-green-100 text-green-700 ml-1">● Live</span>
            <span className="float-right text-blue-600 text-xs font-bold">View All Sensors →</span></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
            {d.gas.map((g: any) => (
              <div key={g.name} className="bg-slate-50 border rounded-2xl p-3 text-center">
                <div className="font-extrabold text-navy">{g.name}</div><div className="text-[11px] text-slate-500">{g.full}</div>
                <div className="flex justify-center"><Gauge pct={g.pct} color="#10a779" /></div>
                <div className="text-xl font-extrabold text-navy -mt-3">{g.value}</div>
                <div className="text-[11px] text-slate-500">{g.limit}</div>
                <span className="badge bg-green-100 text-green-700 mt-1">Normal</span>
              </div>))}
          </div>
          <div className="font-bold text-navy text-sm mt-3">Gas Concentration Trend (Last 24 Hours)</div>
          <div className="h-[190px]"><ResponsiveContainer>
            <LineChart data={trend}><CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
              <XAxis dataKey="h" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
              <Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="o2" name="O₂" stroke="#2563eb" dot={false} />
              <Line type="monotone" dataKey="co" name="CO" stroke="#ef4444" dot={false} />
              <Line type="monotone" dataKey="ch4" name="CH₄" stroke="#f59e0b" dot={false} />
              <Line type="monotone" dataKey="h2s" name="H₂S" stroke="#10a779" dot={false} />
            </LineChart></ResponsiveContainer></div>
          <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5 font-semibold inline-block">DEMO telemetry · simulated sensor feed</div>
        </div>
        <div className="xl:col-span-2 space-y-3">
          <div className="card">
            <div className="font-extrabold text-navy">Live Mine View (CCTV) <span className="badge bg-green-100 text-green-700 ml-1">● Live</span></div>
            <div className="mt-2 rounded-xl overflow-hidden relative">
              <svg viewBox="0 0 400 190" className="w-full h-44" aria-label="Simulated CCTV feed placeholder">
                <defs><linearGradient id="tun" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#1a2436" /><stop offset="1" stopColor="#05080f" />
                </linearGradient></defs>
                <rect width="400" height="190" fill="url(#tun)" />
                <ellipse cx="200" cy="190" rx="150" ry="120" fill="none" stroke="#334155" strokeWidth="3" />
                <ellipse cx="200" cy="190" rx="105" ry="88" fill="none" stroke="#475569" strokeWidth="2" />
                <g fill="#ffca7a"><circle cx="60" cy="40" r="3" /><circle cx="340" cy="40" r="3" /><circle cx="140" cy="25" r="2.5" /><circle cx="260" cy="25" r="2.5" /></g>
                <rect x="150" y="120" width="70" height="30" rx="4" fill="#b45309" />
                <rect x="160" y="108" width="30" height="14" rx="2" fill="#78350f" />
                <circle cx="165" cy="152" r="9" fill="#111" /><circle cx="205" cy="152" r="9" fill="#111" />
              </svg>
              <div className="absolute bottom-2 left-2 right-2 flex justify-between text-[11px] text-white font-semibold">
                <span>03 Oct 2026 · 10:45:32 AM</span><span>BCM-03 | Main Tunnel - Cam 2</span>
              </div>
              <div className="absolute top-2 left-2 badge bg-slate-900/80 text-amber-300">SIMULATED FEED</div>
            </div>
          </div>
          <div className="card">
            <div className="font-extrabold text-navy">Current Environmental Conditions</div>
            <div className="grid grid-cols-4 gap-2 mt-2 text-center">
              {[['🌡', '28°C', 'Temperature'], ['💧', '72%', 'Humidity'], ['🍃', '0.5 m/s', 'Air Flow'], ['🌫', '68 µg/m³', 'Dust (PM2.5)']].map(([i, v, l]) => (
                <div key={l as string} className="bg-slate-50 rounded-xl p-2"><div className="text-lg">{i}</div>
                <div className="font-extrabold text-navy text-sm">{v}</div><div className="text-[10px] text-slate-500">{l}</div></div>))}
            </div>
          </div>
        </div>
      </div>
      <div className="grid xl:grid-cols-4 gap-3 mt-3">
        <div className="card">
          <div className="font-extrabold text-navy">Production vs Dispatch (Last 7 Days)</div>
          <div className="h-[220px]"><ResponsiveContainer>
            <BarChart data={d.production_7d}><XAxis dataKey="day" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} />
              <Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="prod" name="Production (MT)" fill="#2563eb" radius={[4, 4, 0, 0]} />
              <Bar dataKey="disp" name="Dispatch (MT)" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart></ResponsiveContainer></div>
        </div>
        <div className="card">
          <div className="font-extrabold text-navy mb-2">Recent Activities</div>
          {d.activities.map((a: any, i: number) => (
            <div key={i} className="flex items-center gap-2 text-[12px] py-1.5 border-b last:border-0">
              <span className="text-slate-400">☐</span><span className="text-slate-500 w-4">{i + 1}</span>
              <span className="flex-1 text-slate-700">{a.t}</span><span className="text-slate-400">{a.time}</span>{pill(a.status)}</div>))}
        </div>
        <div className="space-y-3">
          <div className="card">
            <div className="font-extrabold text-navy mb-2">Upcoming Events</div>
            {d.events.map((e: any) => (
              <div key={e.t} className="flex gap-2.5 items-center py-1.5 border-b last:border-0">
                <div className="text-center bg-slate-50 rounded-lg px-2 py-1"><div className="font-extrabold text-navy">{e.d}</div><div className="text-[10px] text-slate-500">{e.m}</div></div>
                <div className="flex-1"><div className="text-[13px] font-bold text-navy">{e.t}</div><div className="text-[11px] text-slate-500">{e.s}</div></div>
                {pill(e.tag)}</div>))}
          </div>
          <div className="card">
            <div className="font-extrabold text-navy mb-2">Quick Actions</div>
            <div className="grid grid-cols-2 gap-2 text-[12px] font-bold">
              {[['Add Worker', Plus, 'bg-green-100 text-green-700', '/operator/workers'], ['Record Production', Plus, 'bg-amber-100 text-amber-700', '/operator/production'], ['Generate Gate Pass', IdCard, 'bg-red-100 text-red-600', '/operator/attendance'], ['Upload Document', Upload, 'bg-purple-100 text-purple-700', '/operator/documents']].map(([t, I, c, h]: any) => (
                <a key={t as string} href={h as string} className="flex items-center gap-1.5 border rounded-xl px-2.5 py-2 hover:border-blue-400"><span className={`w-6 h-6 rounded-full flex items-center justify-center ${c}`}><I size={13} /></span>{t}</a>))}
            </div>
          </div>
        </div>
      </div>
      </>}
    </RoleShell>
  );
}
