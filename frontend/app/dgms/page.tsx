'use client';
import { useEffect, useState } from 'react';
import Shell from '../../components/Shell';
import { api } from '../../lib/api';
import MetricCardSkeleton from '../../components/ui/MetricCardSkeleton';
import ChartSkeleton from '../../components/ui/ChartSkeleton';
import { LoadError } from '../../components/ops';
import { Mountain, ClipboardCheck, TriangleAlert, Clock, FileText } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, Tooltip } from 'recharts';

export default function DgmsDashboard() {
  const [data, setData] = useState<any>(null); const [err, setErr] = useState('');
  useEffect(() => { api('/api/v1/dgms/overview').then(setData).catch(e => setErr(e.message)); }, []);
  const icons = [Mountain, ClipboardCheck, TriangleAlert, Clock, FileText];
  const colors = ['bg-blue-50 text-blue-600','bg-blue-50 text-blue-600','bg-red-50 text-red-500','bg-amber-50 text-amber-500','bg-blue-50 text-blue-600'];
  const donut = data ? [
    { name: 'Completed', value: data.inspection_status.Completed, color: '#16a34a' },
    { name: 'In Progress', value: data.inspection_status['In Progress'], color: '#2563eb' },
    { name: 'Pending', value: data.inspection_status.Pending, color: '#f59e0b' },
    { name: 'Overdue', value: data.inspection_status.Overdue, color: '#ef4444' },
  ] : [];
  if (err) return (<Shell title="DGMS Dashboard" subtitle="National overview of mining safety, compliance and inspection performance."><div className="card"><LoadError message={err} onRetry={() => window.location.reload()} /></div></Shell>);
  if (!data) return (
    <Shell title="DGMS Dashboard" subtitle="National overview of mining safety, compliance and inspection performance.">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3" aria-label="Loading dashboard metrics">
        {[0,1,2,3,4].map(i => <MetricCardSkeleton key={i} />)}
      </div>
      <div className="grid xl:grid-cols-3 gap-3 mt-3">
        <div className="card"><ChartSkeleton height={150} bars={4} /></div>
        <div className="card"><ChartSkeleton height={170} /></div>
        <div className="card"><ChartSkeleton height={170} bars={5} /></div>
      </div>
    </Shell>
  );
  return (
    <Shell title="DGMS Dashboard" subtitle="National overview of mining safety, compliance and inspection performance.">
      <div className="flex gap-2 mb-3 flex-wrap">
        {[ '01 Sep 2026 – 03 Oct 2026','All States','All Mines'].map(f => (<span key={f} className="bg-white border rounded-xl px-3 py-2 text-xs font-semibold text-slate-600">{f} ▾</span>))}
        <button className="btn-primary !py-2">Apply</button>
        <span className="ml-auto text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5 font-semibold">DEMO data · simulated telemetry</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {data.kpis.map((k: any, i: number) => { const Icon = icons[i];
          return (<div key={k.label} className="card !p-4 flex gap-3 items-start">
            <div className={`kpi-icon ${colors[i]}`}><Icon size={22}/></div>
            <div><div className="text-[12px] font-semibold text-slate-600">{k.label}</div>
            <div className="text-2xl font-extrabold text-navy">{k.value} <span className={`text-xs font-bold ${String(k.delta).startsWith('-') ? 'text-red-500' : k.label.includes('Critical')||k.label.includes('Overdue') ? 'text-red-500' : 'text-green-600'}`}>{k.delta}</span></div>
            <div className="text-[11px] text-slate-500">{k.sub}</div></div></div>); })}
      </div>
      <div className="grid xl:grid-cols-3 gap-3 mt-3">
        <div className="card">
          <div className="font-extrabold text-navy mb-1">Mines by Status</div>
          <div className="text-[12px] space-y-1.5">
            {[['Normal Operation',142,'bg-green-500'],['Requires Attention',38,'bg-amber-400'],['Critical Risk',18,'bg-red-500'],['No Recent Data',15,'bg-slate-300']].map(([l,v,c]) => (
              <div key={l as string} className="flex items-center gap-2"><span className={`w-2.5 h-2.5 rounded-full ${c}`}/>{l}<b className="ml-auto">{v}</b></div>))}
          </div>
          <div className="mt-3 bg-blue-50 border border-blue-100 rounded-xl p-3 text-[12px] text-slate-600">India · 12 coal-bearing states · Jharkhand 36 · Chhattisgarh 28 · Odisha 24 · <button className="text-blue-700 font-bold">View State Wise →</button></div>
          <div className="mt-2 text-[11px] text-slate-500">Mine distribution map uses registered coordinates. <span className="font-semibold">List view available when map tiles offline.</span></div>
        </div>
        <div className="space-y-3">
          <div className="card">
            <div className="font-extrabold text-navy mb-2">Inspection Status · 214 Scheduled</div>
            <div className="h-[170px]"><ResponsiveContainer><PieChart><Pie data={donut} dataKey="value" innerRadius={52} outerRadius={75} paddingAngle={2}>{donut.map(d => <Cell key={d.name} fill={d.color}/>)}</Pie></PieChart></ResponsiveContainer></div>
            <div className="text-[12px] space-y-1">{donut.map(d => (<div key={d.name} className="flex gap-2 items-center"><span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }}/>{d.name}<b className="ml-auto">{d.value}</b></div>))}</div>
          </div>
          <div className="card">
            <div className="font-extrabold text-navy mb-2">Findings by Category</div>
            {data.findings_by_category.map((f: any) => (
              <div key={f.name} className="flex items-center gap-2 text-[12px] py-1"><span className="w-32 text-slate-600">{f.name}</span>
              <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-red-500 to-blue-500 rounded-full" style={{ width: `${Math.round(f.value / 98 * 100)}%` }}/></div><b>{f.value}</b></div>))}
          </div>
        </div>
        <div className="card">
          <div className="font-extrabold text-navy mb-2">Priority Alerts <span className="float-right text-blue-600 text-xs font-bold">View All</span></div>
          <Alerts />
        </div>
      </div>
      <div className="card mt-3">
        <div className="font-extrabold text-navy">Reports &amp; Analytics</div>
        <div className="text-xs text-slate-500 mb-3">Access consolidated reports for detailed insights.</div>
        <div className="grid sm:grid-cols-3 xl:grid-cols-6 gap-2">
          {[['Mine Compliance Summary','Overall compliance status'],['Inspection Performance Report','Completion and findings'],['Safety & Environmental Report','Air quality, dust, water'],['Production & Dispatch Report','Production and dispatch'],['Worker & Contractor Compliance','Workforce and training'],['AI Risk & Violation Summary','AI-detected risks']].map(([t,d]) => (
            <div key={t} className="border rounded-xl p-3 hover:border-blue-400 hover:shadow-sm transition cursor-pointer"><div className="text-[12px] font-bold text-navy">{t} →</div><div className="text-[11px] text-slate-500 mt-1">{d}</div></div>))}
        </div>
      </div>
    </Shell>
  );
}
function Alerts() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => { api('/api/v1/notifications').then(d => setItems(d.items)).catch(() => setItems([
    { title: 'High dust level detected', subtitle: 'BCM-03 | Underground Mine · 5 mins ago', severity: 'Critical' },
    { title: 'Methane level above threshold', subtitle: 'BCM-07 | Panel 2 · 28 mins ago', severity: 'Critical' },
    { title: 'Missing PPE detected (AI)', subtitle: 'BCM-05 | Loading Area · 1 hour ago', severity: 'High' },
    { title: 'Inspection report pending review', subtitle: 'BCM-02 | Routine · 3 hours ago', severity: 'Medium' },
    { title: 'Corrective action overdue', subtitle: 'BCM-01 | Safety · 5 hours ago', severity: 'Medium' },
  ])); }, []);
  const badge = (s: string) => s === 'Critical' ? 'bg-red-100 text-red-600' : s === 'High' ? 'bg-amber-100 text-amber-700' : 'bg-blue-50 text-blue-700';
  return (<div className="space-y-2.5">{items.map((a, i) => (
    <div key={i} className="flex gap-2.5 items-start border-b last:border-0 pb-2.5">
      <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center text-red-500 font-bold">!</div>
      <div className="min-w-0"><div className="text-[13px] font-bold text-navy truncate">{a.title}</div>
      <div className="text-[11px] text-slate-500">{a.subtitle} · {a.time || ''}</div></div>
      <span className={`badge ml-auto ${badge(a.severity)}`}>{a.severity}</span></div>))}</div>);
}
