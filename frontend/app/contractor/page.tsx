'use client';
import { contractorNav } from './nav';
import { useEffect, useState } from 'react';
import RoleShell, { LightBanner } from '../../components/RoleShell';
import { api } from '../../lib/api';
import { pill } from '../../components/ops';
import { LayoutDashboard, FileText, Users, CalendarCheck, Receipt, FolderCheck, BarChart3, Bell, Users as UsersIcon, ShieldCheck, IndianRupee, UserPlus, Upload, FilePlus, FolderUp, IdCard, LineChart as ChartIcon } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';


const DCOLORS = ['#2563eb', '#06b6d4', '#8b5cf6', '#94a3b8'];

export default function ContractorDashboard() {
  const [d, setD] = useState<any>(null); const [err, setErr] = useState('');
  const [user, setUser] = useState<any>(null);
  useEffect(() => {
    try { setUser(JSON.parse(localStorage.getItem('minenetr_user') || 'null')); } catch {}
    api('/api/v1/role/overview').then(setD).catch((e: any) => setErr(e.message));
  }, []);
  const att = d?.attendance;
  const attData = att ? [
    { name: 'Present', value: att.present, color: '#10b981' }, { name: 'Absent', value: att.absent, color: '#f59e0b' },
    { name: 'On Leave', value: att.leave, color: '#3b82f6' }, { name: 'Not Marked', value: att.unmarked, color: '#cbd5e1' },
  ] : [];
  return (
    <RoleShell role="contractor" nav={contractorNav} orgTitle="Contractor Workspace" orgSub="ABC Mining Services"
      mineName="Bharat Coal Mine (BCM-01)"
      banner={<LightBanner title={<>Welcome Back, <span className="text-blue-600">{user?.name?.split(' ')[0] || 'Contractor'}!</span></>} sub="Contractor Dashboard — Manage your workforce, contracts, compliance documents and billing for a safer and more transparent mining operation." />}>
      {err ? <div className="card text-sm text-red-600">Backend unreachable: {err}</div> :
       !d ? <div className="card text-sm text-slate-500">Loading contractor overview…</div> : <>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {d.kpis.map((k: any, i: number) => {
          const I = [UsersIcon, FileText, IndianRupee, ShieldCheck][i];
          const bg = ['bg-blue-50 text-blue-600', 'bg-green-50 text-green-600', 'bg-purple-50 text-purple-700', 'bg-amber-50 text-amber-600'][i];
          return (<div key={k.label} className="card !p-4 flex gap-3 items-center">
            <div className={`kpi-icon ${bg}`}><I size={24} /></div>
            <div><div className="text-[13px] font-semibold text-slate-700">{k.label}</div>
            <div className="text-[26px] font-extrabold text-navy">{k.value} {k.delta ? <span className="text-xs font-bold text-green-600">{k.delta}</span> : null}</div>
            <div className="text-[11px] text-slate-500">● {k.sub}</div></div></div>); })}
      </div>
      <div className="grid xl:grid-cols-3 gap-3 mt-3">
        <div className="card">
          <div className="font-extrabold text-navy">Worker Distribution</div>
          <div className="h-[210px] relative"><ResponsiveContainer>
            <PieChart><Pie data={d.distribution} dataKey="value" innerRadius={62} outerRadius={88} paddingAngle={2}>
              {d.distribution.map((_: any, i: number) => <Cell key={i} fill={DCOLORS[i % DCOLORS.length]} />)}</Pie></PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-2xl font-extrabold text-navy">{d.distribution.reduce((a: number, x: any) => a + x.value, 0)}</span>
            <span className="text-[11px] text-slate-500">Workers</span></div></div>
          <div className="text-[12px] space-y-1 mt-1">{d.distribution.map((x: any, i: number) => (
            <div key={x.name} className="flex items-center gap-2"><span className="w-3 h-3 rounded" style={{ background: DCOLORS[i % DCOLORS.length] }} />{x.name}<b className="ml-auto">{x.value}</b></div>))}</div>
        </div>
        <div className="card">
          <div className="font-extrabold text-navy">Contract Overview <a href="/contractor/contracts" className="float-right text-blue-600 text-xs font-bold">View All</a></div>
          <div className="overflow-x-auto"><table className="dense w-full min-w-[460px]">
            <thead><tr><th>Contract Name</th><th>Mine</th><th>Start Date</th><th>End Date</th><th>Status</th></tr></thead>
            <tbody>{d.contracts.map((c: any) => (
              <tr key={c.id}><td className="font-semibold">{c.name}</td><td>{c.mine}</td><td>{c.start}</td><td>{c.end}</td><td>{pill(c.status)}</td></tr>))}</tbody>
          </table></div>
        </div>
        <div className="card">
          <div className="font-extrabold text-navy">Attendance Overview</div>
          <div className="h-[190px] relative"><ResponsiveContainer>
            <PieChart><Pie data={attData} dataKey="value" innerRadius={60} outerRadius={82} paddingAngle={2} startAngle={90} endAngle={450}>
              {attData.map(x => <Cell key={x.name} fill={x.color} />)}</Pie></PieChart></ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-extrabold text-navy">{att?.pct}%</span>
              <span className="text-[11px] text-slate-500">Attendance</span></div></div>
          <div className="text-[12px] space-y-1">{attData.map(x => (
            <div key={x.name} className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: x.color }} />{x.name}<b className="ml-auto">{x.value}</b></div>))}</div>
          <a href="/contractor/attendance" className="mt-2 flex items-center gap-2 bg-blue-50 text-blue-700 font-bold text-[13px] rounded-xl px-3 py-2.5">📊 View Attendance Report <span className="ml-auto">›</span></a>
        </div>
      </div>
      <div className="grid xl:grid-cols-3 gap-3 mt-3">
        <div className="card">
          <div className="font-extrabold text-navy">Recent Activities <span className="float-right text-blue-600 text-xs font-bold">View All</span></div>
          <div className="mt-1">{d.activities.map((a: any, i: number) => (
            <div key={i} className="flex gap-2.5 py-2 border-b last:border-0">
              <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 font-bold text-xs">●</div>
              <div><div className="text-[13px] font-bold text-navy">{a.t}</div><div className="text-[11px] text-slate-500">{a.s}</div></div></div>))}</div>
        </div>
        <div className="card">
          <div className="font-extrabold text-navy">Pending Tasks <span className="float-right text-blue-600 text-xs font-bold">View All</span></div>
          {d.tasks.map((t: any) => (
            <div key={t.t} className="flex items-center gap-2 py-2 border-b last:border-0">
              <div className="flex-1"><div className="text-[13px] font-bold text-navy">{t.t}</div><div className="text-[11px] text-slate-500">{t.s}</div></div>
              <span className="badge bg-red-50 text-red-500">{t.due}</span><span className="text-slate-300">›</span></div>))}
        </div>
        <div className="card">
          <div className="font-extrabold text-navy mb-2">Quick Actions</div>
          <div className="grid grid-cols-2 gap-2 text-[12px] font-bold text-center">
            {[[UserPlus, 'Add New Worker', '/contractor/workers'], [Upload, 'Upload Attendance', '/contractor/attendance'], [FilePlus, 'Submit Bill', '/contractor/bills'], [FolderUp, 'Upload Document', '/contractor/documents'], [IdCard, 'Request Mine Access', '/contractor/attendance'], [ChartIcon, 'Generate Report', '/contractor/reports']].map(([I, t, h]: any) => (
              <a key={t as string} href={h as string} className="border rounded-2xl py-4 px-2 hover:border-blue-400 hover:shadow-sm flex flex-col items-center gap-1.5 text-slate-700"><I size={22} className="text-blue-600" />{t}</a>))}
          </div>
        </div>
      </div>
      </>}
    </RoleShell>
  );
}
