'use client';
/**
 * Page 4 — Attendance & Access.
 * Workflow 2 lives here: Check-In / Check-Out update the attendance table,
 * the On-Site Now KPI, the gate activity feed and the audit trail together.
 * 6 tabs: Attendance Overview, Access Control, Gate Pass Logs, On-Site
 * Movement, Biometric Records, Contractor-wise Attendance.
 */
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertOctagon, BadgeCheck, DoorOpen, Download, IdCard, LogIn, LogOut, ScanFace,
  ShieldCheck, Truck, UserCheck, UserPlus, Users,
} from 'lucide-react';
import OperationsShell from '../../../components/operations/OperationsShell';
import { operatorNav } from '../nav';
import {
  Column, DataTable, DetailDrawer, EmptyState, Field, KpiCard, Kv, LinkBtn, Modal,
  OpsBanner, QuickActions, SearchInput, SectionCard, SimulatedNote, StatusPill, Tabs, Toasts,
} from '../../../components/operations/ui';
import { Donut, HBarRows, StackedBars } from '../../../components/operations/charts';
import { CHART, TODAY, byMine, hrefWithTab, useMineScope, usePageReady, useTab } from '../../../components/operations/hooks';
import { AddWorkerModal } from '../../../components/operations/modals';
import { actions, getContractor, getMine, onSiteWorkerIds, useMockOps } from '../../../lib/ops/store';
import { daysUntil, fmtDate, fmtTime12, num, pct } from '../../../lib/ops/format';
import { exportCsv } from '../../../lib/ops/export';
import { AccessStatus, AttendanceStatus, TrainingStatus, type AttendanceRecord, type Worker } from '../../../lib/ops/types';

const TABS = ['Attendance Overview', 'Access Control', 'Gate Pass Logs', 'On-Site Movement', 'Biometric Records', 'Contractor-wise Attendance'];

const ATT_TONE: Record<string, string> = {
  [AttendanceStatus.Present]: 'bg-green-100 text-green-700',
  [AttendanceStatus.Absent]: 'bg-red-100 text-red-600',
  [AttendanceStatus.OnLeave]: 'bg-amber-100 text-amber-700',
  [AttendanceStatus.HalfDay]: 'bg-blue-100 text-blue-700',
  [AttendanceStatus.NotScheduled]: 'bg-slate-100 text-slate-600',
};

export default function AttendancePage() {
  const ready = usePageReady();
  const router = useRouter();
  const db = useMockOps();
  const mineId = useMineScope();
  const [tab, setTab] = useTab(TABS[0]);

  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');
  const [fCtr, setFCtr] = useState('All Contractors');
  const [fDept, setFDept] = useState('All Departments');
  const [fStatus, setFStatus] = useState('All Status');
  const [selected, setSelected] = useState<string[]>([]);
  const [detail, setDetail] = useState<Worker | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [gatePassOpen, setGatePassOpen] = useState(false);
  const [accessModalOpen, setAccessModalOpen] = useState(false);

  const scopedWorkers = useMemo(() => byMine(db.workers, mineId), [db.workers, mineId]);
  const scopedAccess = useMemo(() => byMine(db.access, mineId), [db.access, mineId]);

  const todaysAtt = useMemo(() => {
    const ids = new Set(scopedWorkers.map((w) => w.id));
    return db.attendance.filter((a) => a.date === TODAY && ids.has(a.workerId));
  }, [db.attendance, scopedWorkers]);
  const attByWorker = useMemo(() => new Map(todaysAtt.map((a) => [a.workerId, a])), [todaysAtt]);

  const onSite = useMemo(() => onSiteWorkerIds(db), [db]);
  const scopedOnSite = useMemo(() => scopedWorkers.filter((w) => onSite.has(w.id)).length, [scopedWorkers, onSite]);

  // ---- KPIs ----
  const k = useMemo(() => {
    const total = scopedWorkers.length;
    const mineWorkers = scopedWorkers.filter((w) => w.workforceType === 'Mine').length;
    const contractorWorkers = total - mineWorkers;
    const present = todaysAtt.filter((a) => a.status === AttendanceStatus.Present || a.status === AttendanceStatus.HalfDay).length;
    const absent = todaysAtt.filter((a) => a.status === AttendanceStatus.Absent).length;
    const blocked = scopedWorkers.filter((w) => w.accessStatus === AccessStatus.Blocked).length;
    const vIn = scopedAccess.filter((a) => a.subjectKind === 'Vehicle' && a.type === 'Entry').length;
    const vOut = scopedAccess.filter((a) => a.subjectKind === 'Vehicle' && a.type === 'Exit').length;
    return { total, mineWorkers, contractorWorkers, present, absent, blocked, vIn, vOut, presentPct: pct(present, total), absentPct: pct(absent, total) };
  }, [scopedWorkers, todaysAtt, scopedAccess]);

  // ---- Attendance trend (last 7 days) ----
  const trend = useMemo(() => {
    const days = ['2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03'];
    const ids = new Set(scopedWorkers.map((w) => w.id));
    return days.map((d) => {
      const recs = db.attendance.filter((a) => a.date === d && ids.has(a.workerId));
      return {
        label: `${d.slice(8, 10)} ${new Date(`${d}T00:00:00+05:30`).toLocaleString('en', { month: 'short' })}`,
        present: recs.filter((a) => a.status === AttendanceStatus.Present || a.status === AttendanceStatus.HalfDay).length,
        absent: recs.filter((a) => a.status === AttendanceStatus.Absent).length,
        leave: recs.filter((a) => a.status === AttendanceStatus.OnLeave).length,
        other: recs.filter((a) => a.status === AttendanceStatus.NotScheduled || a.status === AttendanceStatus.HalfDay).length,
        total: recs.length,
      };
    });
  }, [db.attendance, scopedWorkers]);

  // ---- Contractor-wise attendance (today) ----
  const ctrAttendance = useMemo(() => {
    const m = new Map<string, { total: number; present: number }>();
    for (const w of scopedWorkers) {
      const key = w.contractorId ?? 'DIRECT';
      const cur = m.get(key) ?? { total: 0, present: 0 };
      cur.total++;
      const a = attByWorker.get(w.id);
      if (a && (a.status === AttendanceStatus.Present || a.status === AttendanceStatus.HalfDay)) cur.present++;
      m.set(key, cur);
    }
    return [...m.entries()].map(([id, v]) => ({
      id, name: id === 'DIRECT' ? 'Direct (Mine Workforce)' : (getContractor(id)?.name ?? id), ...v, pct: pct(v.present, v.total),
    })).sort((a, b) => b.total - a.total);
  }, [scopedWorkers, attByWorker]);

  // ---- On-site distribution (by location, for present workers) ----
  const onSiteDist = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of todaysAtt) {
      if ((a.status === AttendanceStatus.Present || a.status === AttendanceStatus.HalfDay) && a.inTime && !a.outTime && a.location) {
        m.set(a.location, (m.get(a.location) ?? 0) + 1);
      }
    }
    const colors: Record<string, string> = { Underground: '#1463D9', Surface: '#159B72', Stockyard: '#E8A02B', Workshop: '#F97316', Office: '#7C5CFC' };
    return [...m.entries()].map(([name, value]) => ({ name, value, color: colors[name] ?? '#68788D' })).sort((a, b) => b.value - a.value);
  }, [todaysAtt]);

  // ---- Attendance log table filtering ----
  const filtered = useMemo(() => {
    const term = dq.trim().toLowerCase();
    const ctrName = (w: Worker) => getContractor(w.contractorId)?.name ?? 'Direct (Mine)';
    return scopedWorkers.filter((w) => {
      const a = attByWorker.get(w.id);
      return (!term || `${w.code} ${w.name} ${ctrName(w)} ${w.role}`.toLowerCase().includes(term)) &&
        (fCtr === 'All Contractors' || ctrName(w) === fCtr) &&
        (fDept === 'All Departments' || w.role === fDept) &&
        (fStatus === 'All Status' || (a?.status ?? 'Not Scheduled') === fStatus);
    });
  }, [scopedWorkers, attByWorker, dq, fCtr, fDept, fStatus]);

  const ctrList = useMemo(() => ['All Contractors', ...new Set(scopedWorkers.map((w) => getContractor(w.contractorId)?.name ?? 'Direct (Mine)'))], [scopedWorkers]);
  const deptList = useMemo(() => ['All Departments', ...new Set(scopedWorkers.map((w) => w.role))], [scopedWorkers]);
  const statusList = ['All Status', AttendanceStatus.Present, AttendanceStatus.Absent, AttendanceStatus.OnLeave, AttendanceStatus.HalfDay, AttendanceStatus.NotScheduled];

  function exportAtt() {
    exportCsv(`attendance-${mineId === 'ALL' ? 'all-mines' : getMine(mineId)?.code ?? mineId}-${TODAY}`, filtered,
      [['Worker ID', (w: Worker) => w.code], ['Name', (w) => w.name], ['Contractor', (w) => getContractor(w.contractorId)?.name ?? 'Direct (Mine)'],
      ['Role', (w) => w.role], ['In Time', (w) => attByWorker.get(w.id)?.inTime ?? '—'], ['Out Time', (w) => attByWorker.get(w.id)?.outTime ?? '—'],
      ['Status', (w) => attByWorker.get(w.id)?.status ?? 'Not Scheduled'], ['Access', (w) => w.accessStatus],
      ['Location', (w) => attByWorker.get(w.id)?.location ?? '—']]);
  }

  // ---- Worker table columns (attendance log) ----
  const cols: Column<Worker>[] = [
    { key: 'id', header: 'Worker ID', render: (w) => (
      <span className="flex items-center gap-2">
        <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold shrink-0">{w.name.split(' ').map((x) => x[0]).join('').slice(0, 2)}</span>
        <span><span className="block font-bold text-blue-700">{w.code}</span></span>
      </span> ), sortValue: (w) => w.code },
    { key: 'name', header: 'Name', render: (w) => <span className="font-semibold text-navy">{w.name}</span>, sortValue: (w) => w.name },
    { key: 'ctr', header: 'Contractor', render: (w) => <span className="text-slate-600">{getContractor(w.contractorId)?.name ?? 'Direct (Mine)'}</span>, sortValue: (w) => getContractor(w.contractorId)?.name ?? 'zzz' },
    { key: 'dept', header: 'Department', render: (w) => w.role, sortValue: (w) => w.role },
    { key: 'in', header: 'In Time', render: (w) => attByWorker.get(w.id)?.inTime ?? <span className="text-slate-400">—</span>, sortValue: (w) => attByWorker.get(w.id)?.inTime ?? 'zzz' },
    { key: 'out', header: 'Out Time', render: (w) => attByWorker.get(w.id)?.outTime ?? <span className="text-slate-400">—</span>, sortValue: (w) => attByWorker.get(w.id)?.outTime ?? 'zzz' },
    { key: 'status', header: 'Status', render: (w) => { const s = attByWorker.get(w.id)?.status ?? 'Not Scheduled'; return <span className={`badge ${ATT_TONE[s] ?? 'bg-slate-100 text-slate-600'}`}>● {s}</span>; }, sortValue: (w) => attByWorker.get(w.id)?.status ?? 'Not Scheduled' },
    { key: 'access', header: 'Access', render: (w) => <StatusPill v={w.accessStatus} />, sortValue: (w) => w.accessStatus },
    { key: 'loc', header: 'Location', render: (w) => attByWorker.get(w.id)?.location ?? <span className="text-slate-400">—</span> },
  ];

  return (
    <OperationsShell nav={operatorNav} title="Attendance & Access" sub="Daily attendance and gate control">
      <OpsBanner title="Attendance & Access" sub="Track daily attendance, manage access control and monitor movement of workers, contractors and vehicles in and out of the mine." />
      <div className="px-4 space-y-4">
        {!ready ? (
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">{[...Array(6)].map((_, i) => <div key={i} className="card !p-4 animate-pulse"><div className="h-16 bg-slate-100 rounded-xl" /></div>)}</div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
              <KpiCard icon={<Users size={22} />} label="Total Registered" value={num(k.total)} trend="+5%" context={`${num(k.mineWorkers)} Mine | ${num(k.contractorWorkers)} Contractor`} tileClass="bg-blue-50 text-blue-600" />
              <KpiCard icon={<UserCheck size={22} />} label="Present Today" value={num(k.present)} trend="+3%" context={`${k.presentPct}% of total`} dotColor="#159B72" tileClass="bg-green-50 text-green-600" />
              <KpiCard icon={<AlertOctagon size={22} />} label="Absent Today" value={num(k.absent)} trendTone="down" trend="-2%" context={`${k.absentPct}% of total`} dotColor="#DC4C58" tileClass="bg-red-50 text-red-500" />
              <KpiCard icon={<DoorOpen size={22} />} label="On-Site Now" value={num(scopedOnSite)} context="Currently in mine" dotColor="#E8A02B" tileClass="bg-amber-50 text-amber-600" />
              <KpiCard icon={<IdCard size={22} />} label="Access Blocked" value={num(k.blocked)} context="Safety / compliance" dotColor="#7C5CFC" tileClass="bg-purple-50 text-purple-600" />
              <KpiCard icon={<Truck size={22} />} label="Vehicles In / Out" value={`${k.vIn} / ${k.vOut}`} context="Today's movement" tileClass="bg-blue-50 text-blue-600" />
            </div>

            <SectionCard className="!p-0 !pb-4" title="" action={null}>
              <div className="px-4 -mt-1"><Tabs tabs={TABS} active={tab} onChange={setTab} /></div>
            </SectionCard>

            {tab === 'Attendance Overview' && (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <SectionCard className="xl:col-span-2" title="Attendance Trend (Last 7 Days)">
                  <StackedBars data={trend} xKey="label" height={230} series={[
                    { key: 'present', name: 'Present', fill: '#159B72' },
                    { key: 'absent', name: 'Absent', fill: '#DC4C58' },
                    { key: 'leave', name: 'On Leave', fill: '#E8A02B' },
                    { key: 'other', name: 'Others', fill: '#1463D9' },
                  ]} />
                </SectionCard>
                <SectionCard title="On-Site Distribution (Live)" subtitle={`${num(scopedOnSite)} on-site now`}>
                  <Donut data={onSiteDist} centerValue={num(scopedOnSite)} centerLabel="On-Site Now" />
                </SectionCard>

                <SectionCard className="xl:col-span-2" title="Contractor-wise Attendance (Today)">
                  {ctrAttendance.length === 0 ? <EmptyState title="No attendance yet" /> : (
                    <div className="space-y-2.5">
                      {ctrAttendance.map((r) => (
                        <div key={r.id} className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold shrink-0">{r.name.slice(0, 2).toUpperCase()}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 text-[13px] mb-1">
                              <span className="font-bold text-navy truncate">{r.name}</span>
                              <span className="ml-auto font-extrabold text-navy whitespace-nowrap">{r.present}/{r.total} ({r.pct}%)</span>
                            </div>
                            <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                              <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${r.pct}%` }} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>

                <SectionCard title="Quick Actions">
                  <QuickActions items={[
                    { label: 'Mark Manual Attendance', icon: <LogIn size={15} />, tileClass: 'bg-blue-100 text-blue-600', onClick: () => setCheckInOpen(true) },
                    { label: 'Register New Worker', icon: <UserPlus size={15} />, tileClass: 'bg-purple-100 text-purple-600', onClick: () => setAddOpen(true) },
                    { label: 'Generate Gate Pass', icon: <BadgeCheck size={15} />, tileClass: 'bg-green-100 text-green-700', onClick: () => setGatePassOpen(true) },
                    { label: 'Block / Unblock Access', icon: <ShieldCheck size={15} />, tileClass: 'bg-amber-100 text-amber-700', onClick: () => setAccessModalOpen(true) },
                    { label: 'View Access Exceptions', icon: <AlertOctagon size={15} />, tileClass: 'bg-red-100 text-red-600', onClick: () => { setFStatus(AttendanceStatus.Absent); setTab('Access Control'); } },
                    { label: 'Export Attendance', icon: <Download size={15} />, tileClass: 'bg-blue-100 text-blue-600', onClick: exportAtt },
                  ]} />
                </SectionCard>

                <div className="xl:col-span-3">
                  <SectionCard title={`Today's Attendance Log (${filtered.length})`} action={
                    <div className="flex gap-2 flex-wrap items-center">
                      <SearchInput value={q} onChange={setQ} onSearch={() => setDq(q)} ph="Search by name, ID, contractor..." width="!w-52" />
                      <select className="input !w-44 !py-2 !text-[13px]" value={fCtr} onChange={(e) => setFCtr(e.target.value)} aria-label="Contractor filter">{ctrList.map((c) => <option key={c}>{c}</option>)}</select>
                      <select className="input !w-40 !py-2 !text-[13px]" value={fDept} onChange={(e) => setFDept(e.target.value)} aria-label="Department filter">{deptList.map((d) => <option key={d}>{d}</option>)}</select>
                      <select className="input !w-36 !py-2 !text-[13px]" value={fStatus} onChange={(e) => setFStatus(e.target.value)} aria-label="Status filter">{statusList.map((s) => <option key={s}>{s}</option>)}</select>
                      <button className="btn-primary !py-2 !bg-white !text-blue-700 border border-blue-600" onClick={() => { setDq(''); setQ(''); setFCtr('All Contractors'); setFDept('All Departments'); setFStatus('All Status'); }}>Reset</button>
                      <button className="btn-primary !py-2" onClick={exportAtt}>Export</button>
                      <button className="btn-primary !py-2" onClick={() => setCheckInOpen(true)}>Check In Worker</button>
                    </div>}>
                    <DataTable<Worker> columns={cols} rows={filtered} selectable onSelected={setSelected} onRowClick={setDetail}
                      emptyTitle="No attendance records" emptyText="No workers match the current search and filters."
                      actions={(w) => {
                        const a = attByWorker.get(w.id);
                        const checkedIn = a && a.inTime && !a.outTime && (a.status === AttendanceStatus.Present || a.status === AttendanceStatus.HalfDay);
                        return (
                          <span className="space-x-2">
                            {checkedIn
                              ? <button className="text-xs font-bold text-red-500 hover:underline" onClick={() => { try { actions.checkOut(w.id); } catch (e: any) { alert(e.message); } }}>Check Out</button>
                              : <button className="text-xs font-bold text-green-600 hover:underline" onClick={() => { try { actions.checkIn(w.id); } catch (e: any) { alert(e.message); } }}>Check In</button>}
                            <button className="text-xs font-bold text-blue-600 hover:underline" onClick={() => setDetail(w)}>View</button>
                          </span>
                        );
                      }} />
                  </SectionCard>
                </div>

                <div className="xl:col-span-3">
                  <SectionCard title="Recent Gate Activity (Live)" action={<LinkBtn onClick={() => setTab('Gate Pass Logs')}>View All</LinkBtn>}>
                    <div className="space-y-1.5">
                      {scopedAccess.slice(0, 6).map((a) => (
                        <div key={a.id} className="flex items-center gap-3 py-1.5 border-b border-slate-50 last:border-0">
                          <span className="text-[12px] text-slate-400 w-16 shrink-0">{a.time}</span>
                          <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${a.subjectKind === 'Vehicle' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                            {a.subjectKind === 'Vehicle' ? <Truck size={14} /> : <Users size={14} />}
                          </span>
                          <span className="flex-1 min-w-0 text-[13px]"><span className="font-bold text-navy">{a.subject}</span><span className="text-slate-400 ml-1">{a.gate}</span></span>
                          <span className={`text-[12px] font-bold ${a.type === 'Entry' ? 'text-green-600' : 'text-blue-600'}`}>{a.type}</span>
                          <StatusPill v={a.result} />
                        </div>
                      ))}
                    </div>
                  </SectionCard>
                </div>
              </div>
            )}

            {tab === 'Access Control' && (
              <SectionCard title="Access Control" subtitle="Gate-level access decisions, blocked attempts and worker access status" action={
                <div className="flex gap-2">
                  <button className="btn-primary !py-2" onClick={() => setAccessModalOpen(true)}>Block / Unblock</button>
                  <button className="btn-primary !py-2" onClick={() => { const blocked = scopedWorkers.filter((w) => w.accessStatus === AccessStatus.Blocked); exportCsv(`access-exceptions-${TODAY}`, blocked, [['Worker ID', (w: Worker) => w.code], ['Name', (w) => w.name], ['Reason', (w) => w.trainingStatus]]); }}>Export Exceptions</button>
                </div>}>
                <DataTable<Worker> columns={[
                  cols[0], cols[1], cols[2],
                  { key: 'tr', header: 'Training', render: (w) => <span className={`badge ${w.trainingStatus === TrainingStatus.Valid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>● {w.trainingStatus}</span>, sortValue: (w) => w.trainingStatus },
                  { key: 'card', header: 'Access Card', render: (w) => <span className="font-mono text-[12px]">{w.accessCardId}</span> },
                  cols[7],
                  { key: 'ev', header: 'Last Gate Event', render: (w) => { const ev = scopedAccess.find((a) => a.workerId === w.id); return ev ? <span className="text-[12px]">{ev.type} · {ev.time} · {ev.gate}</span> : <span className="text-slate-400 text-[12px]">No event</span>; } },
                ]} rows={scopedWorkers.filter((w) => w.accessStatus === AccessStatus.Blocked || scopedAccess.some((a) => a.workerId === w.id))} onRowClick={setDetail} selectable onSelected={setSelected} initialSize={10}
                  actions={(w) => w.accessStatus === AccessStatus.Allowed
                    ? <button className="text-xs font-bold text-red-500 hover:underline" onClick={() => { try { actions.revokeAccess(w.id, 'Revoked from Access Control'); } catch (e: any) { alert(e.message); } }}>Block</button>
                    : <button className="text-xs font-bold text-green-600 hover:underline" onClick={() => { try { actions.grantAccess(w.id); } catch (e: any) { alert(e.message); } }}>Unblock</button>} />
              </SectionCard>
            )}

            {tab === 'Gate Pass Logs' && (
              <SectionCard title="Gate Pass & Access Logs" subtitle="All worker and vehicle gate events today" action={
                <button className="btn-primary !py-2" onClick={() => { exportCsv(`gate-logs-${TODAY}`, scopedAccess, [['Time', (a: typeof scopedAccess[0]) => a.time], ['Subject', (a) => a.subject], ['Kind', (a) => a.subjectKind], ['Type', (a) => a.type], ['Gate', (a) => a.gate], ['Result', (a) => a.result], ['Reason', (a) => a.reason ?? '']]); }}>Export Logs</button>}>
                <DataTable<{ id: string; time: string; subject: string; subjectKind: string; type: string; gate: string; result: string; reason: string | null }> columns={[
                  { key: 't', header: 'Time', render: (a) => <span className="font-semibold">{a.time}</span>, sortValue: (a) => a.time },
                  { key: 's', header: 'Subject', render: (a) => <span className="font-bold text-navy">{a.subject}</span>, sortValue: (a) => a.subject },
                  { key: 'k', header: 'Kind', render: (a) => <span className={`badge ${a.subjectKind === 'Vehicle' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{a.subjectKind}</span> },
                  { key: 'ty', header: 'Type', render: (a) => <span className={`font-bold ${a.type === 'Entry' ? 'text-green-600' : 'text-blue-600'}`}>{a.type}</span> },
                  { key: 'g', header: 'Gate', render: (a) => a.gate },
                  { key: 'r', header: 'Result', render: (a) => <StatusPill v={a.result} />, sortValue: (a) => a.result },
                  { key: 'rs', header: 'Reason', render: (a) => a.reason ?? <span className="text-slate-400">—</span> },
                ]} rows={scopedAccess.map((a) => ({ id: a.id, time: a.time, subject: a.subject, subjectKind: a.subjectKind, type: a.type, gate: a.gate, result: a.result, reason: a.reason }))} initialSize={15} />
              </SectionCard>
            )}

            {tab === 'On-Site Movement' && (
              <OnSiteTab workers={scopedWorkers} attendance={todaysAtt} />
            )}

            {tab === 'Biometric Records' && (
              <BiometricTab workers={scopedWorkers} attendance={todaysAtt} />
            )}

            {tab === 'Contractor-wise Attendance' && (
              <SectionCard title="Contractor-wise Attendance (Today)" subtitle="Present vs total by contractor" action={
                <button className="btn-primary !py-2" onClick={() => router.push(hrefWithTab('/operator/contractors', 'Contractor Workforce'))}>Open Contractors ›</button>}>
                <DataTable<{ id: string; name: string; total: number; present: number; absent: number; pct: number }> columns={[
                  { key: 'n', header: 'Contractor', render: (r) => <span className="font-semibold text-navy">{r.name}</span>, sortValue: (r) => r.name },
                  { key: 't', header: 'Total', render: (r) => <span className="font-bold">{r.total}</span>, sortValue: (r) => r.total },
                  { key: 'p', header: 'Present', render: (r) => <span className="font-bold text-green-600">{r.present}</span>, sortValue: (r) => r.present },
                  { key: 'a', header: 'Absent', render: (r) => <span className="font-bold text-red-500">{r.absent}</span>, sortValue: (r) => r.absent },
                  { key: 'pc', header: 'Rate', render: (r) => <span className="font-extrabold">{r.pct}%</span>, sortValue: (r) => r.pct },
                ]} rows={ctrAttendance.map((r) => ({ id: r.id, name: r.name, total: r.total, present: r.present, absent: r.total - r.present, pct: r.pct }))} initialSize={10} />
              </SectionCard>
            )}
          </>
        )}
      </div>

      {/* ---- Detail Drawer ---- */}
      {detail && (
        <DetailDrawer title={`${detail.name} (${detail.code})`} onClose={() => setDetail(null)}>
          {(() => { const a = attByWorker.get(detail.id); return (
            <>
              <Kv k="Status" v={<span className={`badge ${ATT_TONE[a?.status ?? 'Not Scheduled']}`}>● {a?.status ?? 'Not Scheduled'}</span>} />
              <Kv k="In Time" v={a?.inTime ?? '—'} />
              <Kv k="Out Time" v={a?.outTime ?? '—'} />
              <Kv k="Location" v={a?.location ?? '—'} />
              <Kv k="Source" v={a?.source ?? '—'} />
              <Kv k="Contractor" v={getContractor(detail.contractorId)?.name ?? 'Direct (Mine)'} />
              <Kv k="Access" v={<StatusPill v={detail.accessStatus} />} />
              <Kv k="Access Card" v={<span className="font-mono">{detail.accessCardId}</span>} />
              <Kv k="Training" v={<span className={`badge ${detail.trainingStatus === TrainingStatus.Valid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>● {detail.trainingStatus}</span>} />
              <div className="flex gap-2 mt-4">
                {a && a.inTime && !a.outTime
                  ? <button className="btn-primary !py-2 !text-xs" onClick={() => { try { actions.checkOut(detail.id); setDetail(null); } catch (e: any) { alert(e.message); } }}>Check Out</button>
                  : <button className="btn-primary !py-2 !text-xs" onClick={() => { try { actions.checkIn(detail.id); setDetail(null); } catch (e: any) { alert(e.message); } }}>Check In</button>}
              </div>
            </>
          ); })()}
        </DetailDrawer>
      )}

      {/* ---- Modals ---- */}
      {addOpen && <AddWorkerModal mineId={mineId} onClose={() => setAddOpen(false)} />}
      {checkInOpen && <CheckInModal onClose={() => setCheckInOpen(false)} />}
      {gatePassOpen && <GatePassModal onClose={() => setGatePassOpen(false)} />}
      {accessModalOpen && <AccessToggleModal onClose={() => setAccessModalOpen(false)} />}
      <Toasts />
    </OperationsShell>
  );
}

// ---------- Sub-tabs ----------
function OnSiteTab({ workers, attendance }: { workers: Worker[]; attendance: AttendanceRecord[] }) {
  const onSiteIds = useMemo(() => {
    const s = new Set<string>();
    attendance.forEach((a) => { if (a.inTime && !a.outTime && (a.status === AttendanceStatus.Present || a.status === AttendanceStatus.HalfDay)) s.add(a.workerId); });
    return s;
  }, [attendance]);
  const onSiteWorkers = workers.filter((w) => onSiteIds.has(w.id));
  const byLoc = useMemo(() => {
    const m = new Map<string, number>();
    onSiteWorkers.forEach((w) => { const a = attendance.find((x) => x.workerId === w.id); if (a?.location) m.set(a.location, (m.get(a.location) ?? 0) + 1); });
    return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [onSiteWorkers, attendance]);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <SectionCard className="lg:col-span-2" title={`On-Site Workers (${onSiteWorkers.length})`} subtitle="Checked in and not yet checked out">
        <DataTable<Worker> columns={[
          { key: 'id', header: 'Worker', render: (w) => <span><span className="block font-bold text-blue-700">{w.code}</span><span className="block text-[12px] text-navy">{w.name}</span></span>, sortValue: (w) => w.code },
          { key: 'c', header: 'Contractor', render: (w) => getContractor(w.contractorId)?.name ?? 'Direct (Mine)' },
          { key: 'in', header: 'In Time', render: (w) => attendance.find((a) => a.workerId === w.id)?.inTime ?? '—', sortValue: (w) => attendance.find((a) => a.workerId === w.id)?.inTime ?? 'zzz' },
          { key: 'loc', header: 'Location', render: (w) => attendance.find((a) => a.workerId === w.id)?.location ?? '—' },
          { key: 'a', header: '', render: (w) => <button className="text-xs font-bold text-red-500 hover:underline" onClick={() => { try { actions.checkOut(w.id); } catch (e: any) { alert(e.message); } }}>Check Out</button> },
        ]} rows={onSiteWorkers} initialSize={10} />
      </SectionCard>
      <SectionCard title="By Location">
        <HBarRows data={byLoc} />
      </SectionCard>
    </div>
  );
}

function BiometricTab({ workers, attendance }: { workers: Worker[]; attendance: AttendanceRecord[] }) {
  const rows = useMemo(() => workers.slice(0, 50).map((w) => {
    const a = attendance.find((x) => x.workerId === w.id);
    return { id: w.id, code: w.code, name: w.name, bio: w.biomeitricId, inTime: a?.inTime ?? null, outTime: a?.outTime ?? null, match: a ? (a.source === 'Gate Terminal' ? 'Matched' : 'Manual') : 'No record' };
  }), [workers, attendance]);
  return (
    <SectionCard title="Biometric Records" subtitle="Simulated biometric gate terminal logs — no real biometric data is stored" action={<SimulatedNote>Simulated</SimulatedNote>}>
      <DataTable<{ id: string; code: string; name: string; bio: string; inTime: string | null; outTime: string | null; match: string }> columns={[
        { key: 'b', header: 'Bio ID', render: (r) => <span className="font-mono text-[12px] font-bold">{r.bio}</span>, sortValue: (r) => r.bio },
        { key: 'c', header: 'Worker', render: (r) => <span><span className="block font-bold text-blue-700">{r.code}</span><span className="block text-[12px] text-navy">{r.name}</span></span>, sortValue: (r) => r.code },
        { key: 'i', header: 'In (biometric)', render: (r) => r.inTime ?? <span className="text-slate-400">—</span>, sortValue: (r) => r.inTime ?? 'zzz' },
        { key: 'o', header: 'Out (biometric)', render: (r) => r.outTime ?? <span className="text-slate-400">—</span>, sortValue: (r) => r.outTime ?? 'zzz' },
        { key: 'm', header: 'Match Result', render: (r) => <StatusPill v={r.match} />, sortValue: (r) => r.match },
      ]} rows={rows} initialSize={10} />
    </SectionCard>
  );
}

// ---------- Sub-modal forms ----------
function CheckInModal({ onClose }: { onClose: () => void }) {
  const db = useMockOps();
  const [wid, setWid] = useState('');
  const [loc, setLoc] = useState('Surface');
  const [err, setErr] = useState('');
  // default to first available worker not currently checked in
  const available = useMemo(() => {
    const checkedIn = new Set(db.attendance.filter((a) => a.inTime && !a.outTime && (a.status === AttendanceStatus.Present || a.status === AttendanceStatus.HalfDay)).map((a) => a.workerId));
    return db.workers.filter((w) => w.accessStatus === AccessStatus.Allowed && !checkedIn.has(w.id));
  }, [db.workers, db.attendance]);

  return (
    <Modal title="Mark Attendance — Check In" onClose={onClose}>
      <p className="text-[11px] text-slate-400 mb-3">Check-in adds an attendance row, an access log entry and increments the On-Site count. Blocked workers cannot check in.</p>
      <Field label="Worker" error={err}>
        <select className="input" value={wid || available[0]?.id || ''} onChange={(e) => setWid(e.target.value)}>
          {available.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name} ({getContractor(w.contractorId)?.name ?? 'Direct'})</option>)}
        </select>
      </Field>
      <Field label="Location">
        <select className="input" value={loc} onChange={(e) => setLoc(e.target.value)}>
          {['Surface', 'Underground', 'Stockyard', 'Workshop', 'Office'].map((l) => <option key={l}>{l}</option>)}
        </select>
      </Field>
      <div className="flex gap-2 justify-end">
        <button className="btn-primary !bg-white !text-navy border border-slate-300" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={() => {
          try { actions.checkIn(wid || available[0]?.id, loc); onClose(); } catch (e: any) { setErr(e.message); }
        }}>Check In</button>
      </div>
    </Modal>
  );
}

function GatePassModal({ onClose }: { onClose: () => void }) {
  const db = useMockOps();
  const [wid, setWid] = useState('');
  const w = db.workers.find((x) => x.id === wid) ?? db.workers[0];
  return (
    <Modal title="Generate Gate Pass" onClose={onClose}>
      <p className="text-[11px] text-slate-400 mb-3">Demo gate pass preview — this portal has no printing or pass-issuing integration.</p>
      <Field label="Worker">
        <select className="input" value={wid || db.workers[0]?.id || ''} onChange={(e) => setWid(e.target.value)}>
          {db.workers.map((x) => <option key={x.id} value={x.id}>{x.code} — {x.name}</option>)}
        </select>
      </Field>
      {w && (
        <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-[13px] space-y-1.5 bg-slate-50">
          <div className="text-center font-extrabold text-navy text-[15px]">GATE PASS (DEMO)</div>
          <div className="flex justify-between"><span className="text-slate-500">Worker</span><span className="font-bold">{w.name} ({w.code})</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Contractor</span><span className="font-bold">{getContractor(w.contractorId)?.name ?? 'Direct (Mine)'}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Access Card</span><span className="font-mono font-bold">{w.accessCardId}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Valid</span><span className="font-bold">{fmtDate(TODAY)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Status</span><span className={`badge ${w.accessStatus === AccessStatus.Allowed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>{w.accessStatus}</span></div>
          <div className="text-center text-[10px] text-slate-400 pt-2">Synthetic demo document — not a valid mine pass</div>
        </div>
      )}
      <div className="flex gap-2 justify-end mt-3">
        <button className="btn-primary !bg-white !text-navy border border-slate-300" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}

function AccessToggleModal({ onClose }: { onClose: () => void }) {
  const db = useMockOps();
  const [wid, setWid] = useState('');
  const w = db.workers.find((x) => x.id === wid) ?? db.workers[0];
  const [err, setErr] = useState('');
  return (
    <Modal title="Block / Unblock Access" onClose={onClose}>
      <Field label="Worker">
        <select className="input" value={wid || db.workers[0]?.id || ''} onChange={(e) => setWid(e.target.value)}>
          {db.workers.map((x) => <option key={x.id} value={x.id}>{x.code} — {x.name} ({x.accessStatus})</option>)}
        </select>
      </Field>
      {w && (
        <div className="border border-slate-200 rounded-xl p-3 text-[13px] space-y-1.5 mb-3">
          <div className="flex justify-between"><span className="text-slate-500">Current access</span><StatusPill v={w.accessStatus} /></div>
          <div className="flex justify-between"><span className="text-slate-500">Training</span><span className={`badge ${w.trainingStatus === TrainingStatus.Valid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>● {w.trainingStatus}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Card</span><span className="font-mono font-bold">{w.accessCardId}</span></div>
        </div>
      )}
      {err && <div className="text-[12px] font-semibold text-red-600 mb-2" role="alert">{err}</div>}
      <div className="flex gap-2 justify-end">
        <button className="btn-primary !bg-white !text-navy border border-slate-300" onClick={onClose}>Cancel</button>
        {w && w.accessStatus === AccessStatus.Allowed ? (
          <button className="btn-primary !bg-red-600 hover:!bg-red-700" onClick={() => { try { actions.revokeAccess(w.id, 'Blocked from Attendance & Access'); onClose(); } catch (e: any) { setErr(e.message); } }}>Block Access</button>
        ) : (
          <button className="btn-primary" onClick={() => { try { actions.grantAccess(w.id); onClose(); } catch (e: any) { setErr(e.message); } }}>Unblock Access</button>
        )}
      </div>
    </Modal>
  );
}
