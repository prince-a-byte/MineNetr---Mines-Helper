'use client';
/**
 * Page 2 — Workers & Manpower.
 * KPIs derived from the central store; 7 working tabs; worker table with
 * search/filter/sort/pagination/export; Add Worker + detail drawer with
 * edit; quick actions wired to real workflows (assignment, training
 * certificate, access card). Add Worker updates contractor manpower,
 * KPIs, attendance options and manning instantly.
 */
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertOctagon, Award, BadgeCheck, CalendarCheck, IdCard, Plus, ShieldCheck, UserCheck,
  UserPlus, Users,
} from 'lucide-react';
import OperationsShell from '../../../components/operations/OperationsShell';
import { operatorNav } from '../nav';
import {
  Column, DataTable, DetailDrawer, EmptyState, Field, KpiCard, Kv, LinkBtn, Modal,
  OpsBanner, QuickActions, SearchInput, SectionCard, StatusPill, Tabs, Toasts,
} from '../../../components/operations/ui';
import { Donut, HBarRows, VBars } from '../../../components/operations/charts';
import { TODAY, byMine, hrefWithTab, useMineScope, usePageReady, useTab } from '../../../components/operations/hooks';
import { AddWorkerModal } from '../../../components/operations/modals';
import { actions, getContractor, getMine, useMockOps } from '../../../lib/ops/store';
import { daysUntil, fmtDate, num, pct } from '../../../lib/ops/format';
import { exportCsv } from '../../../lib/ops/export';
import { AccessStatus, AttendanceStatus, TrainingStatus, WorkerStatus, type Worker } from '../../../lib/ops/types';

const TABS = ['Overview', 'Worker List', 'Contractor-wise', 'Attendance', 'Training & Certification', 'Access Control', 'Manpower Deployment'];

const TRAINING_TONE: Record<string, string> = {
  [TrainingStatus.Valid]: 'bg-green-100 text-green-700',
  [TrainingStatus.ExpiringSoon]: 'bg-amber-100 text-amber-700',
  [TrainingStatus.Expired]: 'bg-red-100 text-red-600',
  [TrainingStatus.NotTrained]: 'bg-red-100 text-red-600',
};

export default function WorkersPage() {
  const ready = usePageReady();
  const router = useRouter();
  const db = useMockOps();
  const mineId = useMineScope();
  const [tab, setTab] = useTab(TABS[0]);

  // ---- table state ----
  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');
  const [fCtr, setFCtr] = useState('All Contractors');
  const [fStatus, setFStatus] = useState('All Status');
  const [fRole, setFRole] = useState('All Roles');
  const [selected, setSelected] = useState<string[]>([]);
  const [detail, setDetail] = useState<Worker | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [certOpen, setCertOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const [revokeFor, setRevokeFor] = useState<Worker | null>(null);

  const scoped = useMemo(() => byMine(db.workers, mineId), [db.workers, mineId]);
  const todaysAtt = useMemo(() => {
    const mineWorkerIds = new Set(scoped.map((w) => w.id));
    return db.attendance.filter((a) => a.date === TODAY && mineWorkerIds.has(a.workerId));
  }, [db.attendance, scoped]);
  const attByWorker = useMemo(() => new Map(todaysAtt.map((a) => [a.workerId, a])), [todaysAtt]);

  // ---- KPIs ----
  const k = useMemo(() => {
    const total = scoped.length;
    const onsite = todaysAtt.filter((a) => a.inTime && !a.outTime && (a.status === AttendanceStatus.Present || a.status === AttendanceStatus.HalfDay)).length;
    const absent = todaysAtt.filter((a) => a.status === AttendanceStatus.Absent).length;
    const newJoined = scoped.filter((w) => w.joinedOn.startsWith('2026-10')).length;
    const trainingDue = scoped.filter((w) => w.trainingStatus === TrainingStatus.ExpiringSoon || w.trainingStatus === TrainingStatus.Expired || w.trainingStatus === TrainingStatus.NotTrained).length;
    const blocked = scoped.filter((w) => w.accessStatus === AccessStatus.Blocked).length;
    return { total, onsite, absent, newJoined, trainingDue, blocked, ctrs: new Set(scoped.map((w) => w.contractorId).filter(Boolean)).size };
  }, [scoped, todaysAtt]);

  // ---- overview charts ----
  const byCtr = useMemo(() => {
    const m = new Map<string, number>();
    for (const w of scoped) { const key = w.contractorId ?? 'Direct (Mine)'; m.set(key, (m.get(key) ?? 0) + 1); }
    return [...m.entries()].map(([id, value]) => ({ name: id === 'Direct (Mine)' ? 'Direct (Mine)' : (getContractor(id)?.name ?? id), value, id }))
      .sort((a, b) => b.value - a.value).slice(0, 6);
  }, [scoped]);

  const attSplit = useMemo(() => {
    const present = todaysAtt.filter((a) => a.status === AttendanceStatus.Present || a.status === AttendanceStatus.HalfDay).length;
    const absent = todaysAtt.filter((a) => a.status === AttendanceStatus.Absent).length;
    const leave = todaysAtt.filter((a) => a.status === AttendanceStatus.OnLeave).length;
    const notSched = Math.max(0, k.total - todaysAtt.length);
    return [
      { name: 'Present', value: present, color: '#159B72' },
      { name: 'Absent', value: absent, color: '#DC4C58' },
      { name: 'On Leave', value: leave, color: '#E8A02B' },
      { name: 'Not Scheduled', value: notSched, color: '#7C5CFC' },
    ].filter((s) => s.value > 0);
  }, [todaysAtt, k.total]);

  const trainingSplit = useMemo(() => {
    const c = (t: TrainingStatus) => scoped.filter((w) => w.trainingStatus === t).length;
    return [
      { name: 'Valid', value: c(TrainingStatus.Valid), color: '#159B72' },
      { name: 'Expiring Soon', value: c(TrainingStatus.ExpiringSoon), color: '#E8A02B' },
      { name: 'Expired', value: c(TrainingStatus.Expired), color: '#DC4C58' },
      { name: 'Not Trained', value: c(TrainingStatus.NotTrained), color: '#7C5CFC' },
    ].filter((s) => s.value > 0);
  }, [scoped]);

  const skills = useMemo(() => {
    const m = new Map<string, number>();
    scoped.forEach((w) => m.set(w.skill, (m.get(w.skill) ?? 0) + 1));
    return [...m.entries()].map(([name, value]) => ({ name, value, pct: pct(value, scoped.length) })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [scoped]);

  // ---- worker list filtering ----
  const filtered = useMemo(() => {
    const term = dq.trim().toLowerCase();
    return scoped.filter((w) =>
      (!term || `${w.code} ${w.name} ${w.role} ${w.skill} ${getContractor(w.contractorId)?.name ?? ''}`.toLowerCase().includes(term)) &&
      (fCtr === 'All Contractors' || (fCtr === 'Direct (Mine)' ? !w.contractorId : getContractor(w.contractorId)?.name === fCtr)) &&
      (fStatus === 'All Status' || w.status === fStatus) &&
      (fRole === 'All Roles' || w.role === fRole));
  }, [scoped, dq, fCtr, fStatus, fRole]);

  const roles = useMemo(() => ['All Roles', ...new Set(scoped.map((w) => w.role))], [scoped]);
  const ctrNames = useMemo(() => ['All Contractors', 'Direct (Mine)', ...new Set(scoped.map((w) => getContractor(w.contractorId)?.name).filter(Boolean) as string[])], [scoped]);

  function exportWorkers() {
    exportCsv(`workers-${mineId === 'ALL' ? 'all-mines' : getMine(mineId)?.code ?? mineId}-${TODAY}`, filtered,
      [['Worker ID', (w: Worker) => w.code], ['Name', (w) => w.name], ['Contractor', (w) => getContractor(w.contractorId)?.name ?? 'Direct (Mine)'],
      ['Role/Trade', (w) => w.role], ['Mine', (w) => getMine(w.mineId)?.code ?? ''], ['Joined', (w) => w.joinedOn],
      ['Training', (w) => w.trainingStatus], ['Access', (w) => w.accessStatus], ['Status', (w) => w.status]]);
  }

  // ---- columns ----
  const cols: Column<Worker>[] = [
    { key: 'id', header: 'Worker ID', render: (w) => (
      <span className="flex items-center gap-2">
        <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold shrink-0">{w.name.split(' ').map((x) => x[0]).join('').slice(0, 2)}</span>
        <span><span className="block font-bold text-blue-700">{w.code}</span><span className="block text-[11px] text-slate-400">{w.accessCardId}</span></span>
      </span> ), sortValue: (w) => w.code },
    { key: 'name', header: 'Name', render: (w) => <span className="font-semibold text-navy">{w.name}</span>, sortValue: (w) => w.name },
    { key: 'ctr', header: 'Contractor', render: (w) => <span className="text-slate-600">{getContractor(w.contractorId)?.name ?? 'Direct (Mine)'}</span>, sortValue: (w) => getContractor(w.contractorId)?.name ?? 'zzz' },
    { key: 'role', header: 'Role / Trade', render: (w) => w.role, sortValue: (w) => w.role },
    { key: 'mine', header: 'Mine', render: (w) => <span className="font-semibold">{getMine(w.mineId)?.code ?? '—'}</span>, sortValue: (w) => getMine(w.mineId)?.code ?? '' },
    { key: 'att', header: 'Attendance', render: (w) => { const a = attByWorker.get(w.id); return <StatusPill v={a?.status ?? 'Not Scheduled'} />; },
      sortValue: (w) => attByWorker.get(w.id)?.status ?? 'Not Scheduled' },
    { key: 'training', header: 'Training', render: (w) => <span className={`badge ${TRAINING_TONE[w.trainingStatus]}`}>● {w.trainingStatus}</span>, sortValue: (w) => w.trainingStatus },
    { key: 'access', header: 'Access', render: (w) => <StatusPill v={w.accessStatus} />, sortValue: (w) => w.accessStatus },
    { key: 'status', header: 'Status', render: (w) => <StatusPill v={w.status} />, sortValue: (w) => w.status },
  ];

  const ctrList = ctrNames.filter((c) => c !== 'All Contractors' && c !== 'Direct (Mine)');
  const statusList = ['All Status', WorkerStatus.Active, WorkerStatus.Blocked, WorkerStatus.Inactive];

  return (
    <OperationsShell nav={operatorNav} title="Workers & Manpower" sub="Workforce directory">
      <OpsBanner title="Workers & Manpower" sub="Manage workforce across all contractors, track attendance, training, certifications and access eligibility." />
      <div className="px-4 space-y-4">
        {!ready ? (
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">{[...Array(6)].map((_, i) => <div key={i} className="card !p-4 animate-pulse"><div className="h-16 bg-slate-100 rounded-xl" /></div>)}</div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
              <KpiCard icon={<Users size={22} />} label="Total Workers" value={num(k.total)} trend="+5%" context={`Across ${k.ctrs} contractors`} tileClass="bg-blue-50 text-blue-600" />
              <KpiCard icon={<UserCheck size={22} />} label="On-Site Today" value={num(k.onsite)} trend="+3%" context={`${pct(k.onsite, k.total)}% of total`} dotColor="#159B72" tileClass="bg-green-50 text-green-600" />
              <KpiCard icon={<AlertOctagon size={22} />} label="Absent Today" value={num(k.absent)} trendTone="down" trend="-2%" context={`${pct(k.absent, k.total)}% of total`} dotColor="#DC4C58" tileClass="bg-red-50 text-red-500" />
              <KpiCard icon={<UserPlus size={22} />} label="New Joined" value={num(k.newJoined)} context="This month" dotColor="#E8A02B" tileClass="bg-amber-50 text-amber-600" />
              <KpiCard icon={<Award size={22} />} label="Training Due" value={num(k.trainingDue)} context="Require action" dotColor="#7C5CFC" tileClass="bg-purple-50 text-purple-600" />
              <KpiCard icon={<IdCard size={22} />} label="Access Blocked" value={num(k.blocked)} context="Safety / compliance" dotColor="#DC4C58" tileClass="bg-red-50 text-red-500" />
            </div>

            <SectionCard className="!p-0 !pb-4" title="" action={null}>
              <div className="px-4 -mt-1"><Tabs tabs={TABS} active={tab} onChange={setTab} /></div>
            </SectionCard>

            {tab === 'Overview' && (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <SectionCard title="Manpower Distribution by Contractor">
                  <VBars data={byCtr.map(({ name, value }) => ({ name: name.length > 14 ? name.slice(0, 13) + '…' : name, value }))} height={210}
                    onPick={() => setTab('Contractor-wise')} />
                  <div className="text-[11px] text-slate-400 mt-1">Click a bar to open the contractor-wise tab.</div>
                </SectionCard>
                <SectionCard title="Attendance Status (Today)">
                  <Donut data={attSplit} centerValue={num(k.total)} centerLabel="Total Workers"
                    onPick={() => setTab('Attendance')} />
                </SectionCard>
                <SectionCard title="Training & Certification Status">
                  <Donut data={trainingSplit} centerValue={num(k.total)} centerLabel="Total Workers"
                    onPick={() => setTab('Training & Certification')} />
                </SectionCard>

                <div className="xl:col-span-2">
                  <SectionCard title="Worker Details" action={
                    <div className="flex gap-2 flex-wrap">
                      <SearchInput value={q} onChange={setQ} onSearch={() => setDq(q)} ph="Search by name, ID, contractor, skill..." width="!w-56" />
                      <button className="btn-primary !py-2" onClick={exportWorkers}>Export CSV</button>
                      <button className="btn-primary !py-2" onClick={() => setAddOpen(true)}><span className="inline-flex items-center gap-1"><Plus size={14} /> Add Worker</span></button>
                    </div>}>
                    <DataTable<Worker> columns={cols} rows={filtered} selectable onSelected={setSelected} onRowClick={setDetail}
                      emptyTitle="No workers match" emptyText="Adjust the search or add a new worker."
                      actions={(w) => <button className="text-xs font-bold text-blue-600 hover:underline" onClick={() => setDetail(w)}>View</button>} />
                    {selected.length > 0 && (
                      <div className="mt-2 flex items-center gap-2 text-xs">
                        <span className="font-bold text-navy">{selected.length} selected</span>
                        <button className="btn-primary !py-1.5 !text-xs" onClick={() => { setSelected([]); setAccessOpen(true); }}>Manage Access Cards</button>
                        <button className="btn-primary !py-1.5 !text-xs !bg-white !text-blue-700 border border-blue-600" onClick={() => setSelected([])}>Clear</button>
                      </div>
                    )}
                  </SectionCard>
                </div>

                <div className="space-y-4">
                  <SectionCard title="Skill-wise Workforce" action={<LinkBtn onClick={() => setTab('Worker List')}>View All</LinkBtn>}>
                    <HBarRows data={skills.map((s) => ({ name: s.name, value: s.value, display: `${s.value} (${s.pct}%)` }))} />
                  </SectionCard>
                  <SectionCard title="Quick Actions">
                    <QuickActions items={[
                      { label: 'Register New Worker', icon: <UserPlus size={15} />, tileClass: 'bg-blue-100 text-blue-600', onClick: () => setAddOpen(true) },
                      { label: 'Assign to Contractor', icon: <Users size={15} />, tileClass: 'bg-green-100 text-green-700', onClick: () => setAssignOpen(true) },
                      { label: 'Upload Training Certificate', icon: <Award size={15} />, tileClass: 'bg-amber-100 text-amber-700', onClick: () => setCertOpen(true) },
                      { label: 'Manage Access Card', icon: <ShieldCheck size={15} />, tileClass: 'bg-purple-100 text-purple-600', onClick: () => setAccessOpen(true) },
                    ]} />
                  </SectionCard>
                </div>
              </div>
            )}

            {tab === 'Worker List' && (
              <SectionCard title={`Worker List (${filtered.length})`} action={
                <div className="flex gap-2 flex-wrap items-center">
                  <SearchInput value={q} onChange={setQ} onSearch={() => setDq(q)} ph="Search by name, ID, contractor, skill..." width="!w-56" />
                  <select className="input !w-44 !py-2 !text-[13px]" value={fCtr} onChange={(e) => setFCtr(e.target.value)} aria-label="Contractor filter">{ctrNames.map((c) => <option key={c}>{c}</option>)}</select>
                  <select className="input !w-36 !py-2 !text-[13px]" value={fStatus} onChange={(e) => setFStatus(e.target.value)} aria-label="Status filter">{statusList.map((s) => <option key={s}>{s}</option>)}</select>
                  <select className="input !w-36 !py-2 !text-[13px]" value={fRole} onChange={(e) => setFRole(e.target.value)} aria-label="Role filter">{roles.map((r) => <option key={r}>{r}</option>)}</select>
                  <button className="btn-primary !py-2 !bg-white !text-blue-700 border border-blue-600" onClick={() => { setDq(''); setQ(''); setFCtr('All Contractors'); setFStatus('All Status'); setFRole('All Roles'); }}>Reset</button>
                  <button className="btn-primary !py-2" onClick={exportWorkers}>Export CSV</button>
                  <button className="btn-primary !py-2" onClick={() => setAddOpen(true)}><span className="inline-flex items-center gap-1"><Plus size={14} /> Add Worker</span></button>
                </div>}>
                <DataTable<Worker> columns={cols} rows={filtered} selectable onSelected={setSelected} onRowClick={setDetail}
                  emptyTitle="No workers match" emptyText="No workers match the current search and filters."
                  actions={(w) => <span className="space-x-2"><button className="text-xs font-bold text-blue-600 hover:underline" onClick={() => setDetail(w)}>View</button><button className="text-xs font-bold text-slate-500 hover:text-navy" onClick={() => { setDetail(w); setEditOpen(true); }}>Edit</button></span>} />
              </SectionCard>
            )}

            {tab === 'Contractor-wise' && <ContractorWiseTab />}
            {tab === 'Attendance' && (
              <SectionCard title="Today's Attendance (03 Oct 2026)" action={<button className="btn-primary !py-2" onClick={() => router.push(hrefWithTab('/operator/attendance', 'Attendance Overview'))}>Open Attendance & Access ›</button>}>
                <DataTable<Worker> columns={[
                  cols[0], cols[1], cols[2], cols[3],
                  { key: 'in', header: 'In Time', render: (w) => attByWorker.get(w.id)?.inTime ?? '—' },
                  { key: 'out', header: 'Out Time', render: (w) => attByWorker.get(w.id)?.outTime ?? '—' },
                  cols[5], cols[7],
                ]} rows={scoped} onRowClick={setDetail} initialSize={10} />
              </SectionCard>
            )}
            {tab === 'Training & Certification' && (
              <TrainingTab workers={scoped} onUpload={(w) => { setDetail(w); setCertOpen(true); }} />
            )}
            {tab === 'Access Control' && (
              <SectionCard title="Access Control" subtitle="Grant/revoked access is audited and reflected on attendance & gate logs" action={
                <button className="btn-primary !py-2" onClick={() => setAccessOpen(true)}>Manage Access Cards</button>}>
                <DataTable<Worker> columns={[
                  cols[0], cols[1], cols[2],
                  { key: 'card', header: 'Access Card', render: (w) => <span className="font-mono text-[12px]">{w.accessCardId}</span> },
                  { key: 'train', header: 'Training', render: (w) => <span className={`badge ${TRAINING_TONE[w.trainingStatus]}`}>● {w.trainingStatus}</span>, sortValue: (w) => w.trainingStatus },
                  cols[7],
                  { key: 'act', header: 'Last Gate Event', render: (w) => { const ev = db.access.find((a) => a.workerId === w.id); return ev ? <span className="text-[12px]">{ev.type} · {ev.time} · {ev.result}</span> : <span className="text-slate-400">No event today</span>; } },
                ]} rows={scoped} onRowClick={setDetail} selectable onSelected={setSelected}
                  actions={(w) => w.accessStatus === AccessStatus.Allowed
                    ? <button className="text-xs font-bold text-red-500 hover:underline" onClick={() => setRevokeFor(w)}>Revoke</button>
                    : <button className="text-xs font-bold text-green-600 hover:underline" onClick={() => { try { actions.grantAccess(w.id); } catch (e: any) { alert(e.message); } }}>Grant</button>} />
              </SectionCard>
            )}
            {tab === 'Manpower Deployment' && <ManpowerTab />}
          </>
        )}
      </div>

      {detail && (
        <DetailDrawer title={`${detail.name} (${detail.code})`} onClose={() => { setDetail(null); setEditOpen(false); }}>
          <div className="flex gap-2 mb-3 flex-wrap">
            <button className="btn-primary !py-2 !text-xs" onClick={() => setEditOpen(true)}>Edit Worker</button>
            <button className="btn-primary !py-2 !text-xs !bg-white !text-blue-700 border border-blue-600" onClick={() => { setAssignOpen(true); }}>Assign Contractor</button>
            <button className="btn-primary !py-2 !text-xs !bg-white !text-blue-700 border border-blue-600" onClick={() => setCertOpen(true)}>Upload Training Certificate</button>
          </div>
          {editOpen && <EditWorkerForm worker={detail} onDone={() => setEditOpen(false)} />}
          <Kv k="Status" v={<StatusPill v={detail.status} />} />
          <Kv k="Workforce" v={detail.workforceType === 'Mine' ? 'Direct mine workforce' : getContractor(detail.contractorId)?.name ?? '—'} />
          <Kv k="Mine" v={`${getMine(detail.mineId)?.name ?? '—'} (${getMine(detail.mineId)?.code ?? ''})`} />
          <Kv k="Role / Trade" v={`${detail.role} · ${detail.skill}`} />
          <Kv k="Joined" v={fmtDate(detail.joinedOn)} />
          <Kv k="Phone" v={detail.phone} />
          <Kv k="Training" v={<span className={`badge ${TRAINING_TONE[detail.trainingStatus]}`}>● {detail.trainingStatus} {detail.trainingExpiry ? `· exp ${fmtDate(detail.trainingExpiry)}` : ''}</span>} />
          <Kv k="Access Card" v={<span className="font-mono">{detail.accessCardId}</span>} />
          <Kv k="Biometric ID" v={<span className="font-mono">{detail.biomeitricId} (demo)</span>} />
          <Kv k="Access" v={<StatusPill v={detail.accessStatus} />} />
          <Kv k="Today's Attendance" v={<StatusPill v={attByWorker.get(detail.id)?.status ?? 'Not Scheduled'} />} />

          <h4 className="font-extrabold text-navy mt-4 mb-1 text-sm">Assignment History</h4>
          {detail.assignments.length === 0 ? <div className="text-[13px] text-slate-500">No contractor assignments (direct workforce).</div> : (
            detail.assignments.map((a) => (
              <div key={a.id} className="text-[12px] border border-slate-100 rounded-lg p-2 mb-1.5">
                <div className="font-bold text-navy">{getContractor(a.contractorId)?.name}</div>
                <div className="text-slate-500">{getMine(a.mineId)?.code} · {a.role} · {fmtDate(a.from)} → {a.to ? fmtDate(a.to) : 'present'}</div>
              </div>
            ))
          )}

          <h4 className="font-extrabold text-navy mt-4 mb-1 text-sm">Attendance History (last 7 days)</h4>
          {db.attendance.filter((a) => a.workerId === detail.id).slice(-7).reverse().map((a) => (
            <div key={a.id} className="flex items-center gap-2 text-[12px] py-1 border-b border-slate-50 last:border-0">
              <span className="font-semibold">{fmtDate(a.date)}</span>
              <span className="text-slate-500">{a.inTime ?? '—'} → {a.outTime ?? '—'}</span>
              <span className="ml-auto"><StatusPill v={a.status} /></span>
            </div>
          ))}
          <p className="text-[11px] text-slate-400 mt-3">Document compliance: see Documents & Compliance for worker medical/fitness records.</p>
        </DetailDrawer>
      )}

      {addOpen && <AddWorkerModal mineId={mineId} onClose={() => setAddOpen(false)} />}
      {assignOpen && <AssignModal workerId={detail?.id ?? ''} onClose={() => setAssignOpen(false)} />}
      {certOpen && <CertModal workerId={detail?.id ?? ''} onClose={() => setCertOpen(false)} />}
      {accessOpen && <AccessCardModal onClose={() => setAccessOpen(false)} defaultSel={selected} />}
      {revokeFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="alertdialog" aria-modal="true">
          <div className="absolute inset-0 bg-navy/50" onClick={() => setRevokeFor(null)} />
          <div className="relative bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl">
            <h3 className="font-extrabold text-navy">Revoke access for {revokeFor.code}?</h3>
            <p className="text-sm text-slate-600 mt-1">{revokeFor.name} will be blocked at all gates until access is granted again.</p>
            <div className="flex gap-2 mt-4">
              <button className="btn-primary !bg-white !text-navy border border-slate-300 flex-1" onClick={() => setRevokeFor(null)}>Cancel</button>
              <button className="btn-primary flex-1 !bg-red-600 hover:!bg-red-700" onClick={() => { actions.revokeAccess(revokeFor.id, 'Revoked by operator from Access Control'); setRevokeFor(null); }}>Revoke Access</button>
            </div>
          </div>
        </div>
      )}
      <Toasts />
    </OperationsShell>
  );
}

// ---------- Sub-tabs ----------
function ContractorWiseTab() {
  const db = useMockOps();
  const mineId = useMineScope();
  const scoped = byMine(db.workers, mineId);
  const rows = useMemo(() => {
    const m = new Map<string, { ctrId: string | null; total: number; present: number }>();
    for (const w of scoped) {
      const key = w.contractorId ?? 'DIRECT';
      const cur = m.get(key) ?? { ctrId: w.contractorId, total: 0, present: 0 };
      cur.total++;
      const a = db.attendance.find((x) => x.workerId === w.id && x.date === TODAY);
      if (a && (a.status === AttendanceStatus.Present || a.status === AttendanceStatus.HalfDay)) cur.present++;
      m.set(key, cur);
    }
    return [...m.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [scoped, db.attendance]);

  return (
    <SectionCard title="Contractor-wise Manpower" subtitle="Live counts derived from worker + attendance records">
      {rows.length === 0 ? <EmptyState title="No workers in scope" /> : (
        <DataTable<{ id: string; name: string; total: number; present: number; ctrId: string | null }> columns={[
          { key: 'n', header: 'Contractor', render: (r) => <span className="font-semibold text-navy">{r.name}</span>, sortValue: (r) => r.name },
          { key: 't', header: 'Total Workers', render: (r) => <span className="font-bold">{r.total}</span>, sortValue: (r) => r.total },
          { key: 'p', header: 'Present Today', render: (r) => <span className="font-bold text-green-600">{r.present}</span>, sortValue: (r) => r.present },
          { key: 'a', header: 'Absent', render: (r) => <span className="font-bold text-red-500">{r.total - r.present}</span> },
          { key: 'att', header: 'Attendance %', render: (r) => <span className="font-bold">{pct(r.present, r.total)}%</span>, sortValue: (r) => pct(r.present, r.total) },
          { key: 'st', header: 'Contract Status', render: (r) => <StatusPill v={r.ctrId ? (getContractor(r.ctrId)?.status ?? '—') : 'Direct Workforce'} /> },
        ]} rows={rows.map((r) => ({ id: r[0], name: r[0] === 'DIRECT' ? 'Direct (Mine Workforce)' : (getContractor(r[1].ctrId)?.name ?? r[0]), total: r[1].total, present: r[1].present, ctrId: r[1].ctrId }))} />
      )}
    </SectionCard>
  );
}

function TrainingTab({ workers, onUpload }: { workers: Worker[]; onUpload: (w: Worker) => void }) {
  const due = workers.filter((w) => w.trainingStatus !== TrainingStatus.Valid);
  const ok = workers.filter((w) => w.trainingStatus === TrainingStatus.Valid);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <SectionCard className="lg:col-span-2" title={`Training & Certification (${workers.length})`} subtitle="Sorted: workers requiring action first">
        <DataTable<Worker> columns={[
          { key: 'id', header: 'Worker', render: (w) => <span><span className="block font-bold text-blue-700">{w.code}</span><span className="block text-[12px] text-navy">{w.name}</span></span>, sortValue: (w) => w.code },
          { key: 'ctr', header: 'Contractor', render: (w) => getContractor(w.contractorId)?.name ?? 'Direct (Mine)' },
          { key: 'tr', header: 'Training', render: (w) => <span className={`badge ${TRAINING_TONE[w.trainingStatus]}`}>● {w.trainingStatus}</span>, sortValue: (w) => (w.trainingStatus === TrainingStatus.Valid ? 'z' : w.trainingStatus) },
          { key: 'exp', header: 'Expiry', render: (w) => w.trainingExpiry ? <span className={daysUntil(w.trainingExpiry)! <= 60 ? 'font-bold text-amber-600' : ''}>{fmtDate(w.trainingExpiry)}</span> : <span className="text-slate-400">—</span>, sortValue: (w) => w.trainingExpiry ?? '' },
          { key: 'act', header: '', render: (w) => <button className="text-xs font-bold text-blue-600 hover:underline" onClick={() => onUpload(w)}>Upload Certificate</button> },
        ]} rows={[...due, ...ok]} initialSize={10} />
      </SectionCard>
      <div className="space-y-4">
        <SectionCard title="Certification Health">
          <div className="space-y-2 text-[13px]">
            <div className="flex justify-between"><span className="text-slate-600">Valid</span><span className="font-bold text-green-600">{ok.length}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">Expiring soon</span><span className="font-bold text-amber-600">{workers.filter((w) => w.trainingStatus === TrainingStatus.ExpiringSoon).length}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">Expired</span><span className="font-bold text-red-500">{workers.filter((w) => w.trainingStatus === TrainingStatus.Expired).length}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">Not trained</span><span className="font-bold text-red-500">{workers.filter((w) => w.trainingStatus === TrainingStatus.NotTrained).length}</span></div>
          </div>
          <p className="text-[11px] text-slate-400 mt-3">Expired / not-trained workers are auto-blocked at gate access (safety rule).</p>
        </SectionCard>
      </div>
    </div>
  );
}

function ManpowerTab() {
  const db = useMockOps();
  const rows = useMemo(() => {
    return db.mines.map((m) => {
      const ws = db.workers.filter((w) => w.mineId === m.id);
      return { id: m.id, name: m.name, code: m.code, total: ws.length, contractors: new Set(ws.map((w) => w.contractorId).filter(Boolean)).size, status: m.status };
    });
  }, [db.workers, db.mines]);
  return (
    <SectionCard title="Manpower Deployment (mine-wise)" subtitle="Where the workforce is deployed right now">
      <DataTable<{ id: string; name: string; code: string; total: number; contractors: number; status: string }> columns={[
        { key: 'c', header: 'Mine', render: (r) => <span className="font-semibold text-navy">{r.name} <span className="text-slate-400">({r.code})</span></span>, sortValue: (r) => r.code },
        { key: 't', header: 'Workers', render: (r) => <span className="font-bold">{r.total}</span>, sortValue: (r) => r.total },
        { key: 'ct', header: 'Contractors', render: (r) => r.contractors, sortValue: (r) => r.contractors },
        { key: 's', header: 'Mine Status', render: (r) => <StatusPill v={r.status} /> },
      ]} rows={rows} initialSize={10} />
    </SectionCard>
  );
}

// ---------- Sub-modal forms ----------
function EditWorkerForm({ worker, onDone }: { worker: Worker; onDone: () => void }) {
  const [f, setF] = useState({ name: worker.name, role: worker.role, phone: worker.phone, status: worker.status });
  const [err, setErr] = useState('');
  return (
    <div className="border border-blue-200 bg-blue-50/40 rounded-xl p-3 mb-3">
      <div className="font-bold text-navy text-sm mb-2">Edit Worker</div>
      {err && <div className="text-[12px] text-red-600 font-semibold mb-2">{err}</div>}
      <div className="grid grid-cols-2 gap-x-2">
        <Field label="Name"><input className="input !py-1.5 !text-[13px]" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Role"><input className="input !py-1.5 !text-[13px]" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} /></Field>
        <Field label="Phone"><input className="input !py-1.5 !text-[13px]" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <Field label="Status">
          <select className="input !py-1.5 !text-[13px]" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as WorkerStatus })}>
            {Object.values(WorkerStatus).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
      </div>
      <div className="flex gap-2">
        <button className="btn-primary !py-1.5 !text-xs !bg-white !text-navy border border-slate-300" onClick={onDone}>Cancel</button>
        <button className="btn-primary !py-1.5 !text-xs" onClick={() => {
          if (!f.name.trim()) { setErr('Name is required.'); return; }
          if (!/^\+?[\d\s-]{10,}$/.test(f.phone.trim())) { setErr('Enter a valid phone number.'); return; }
          actions.updateWorker(worker.id, { name: f.name.trim(), role: f.role.trim(), phone: f.phone.trim(), status: f.status });
          onDone();
        }}>Save Changes</button>
      </div>
    </div>
  );
}

function AssignModal({ workerId, onClose }: { workerId: string; onClose: () => void }) {
  const db = useMockOps();
  const [wid, setWid] = useState(workerId || db.workers[0]?.id || '');
  const [ctr, setCtr] = useState(db.contractors[0]?.id || '');
  const [err, setErr] = useState('');
  const w = db.workers.find((x) => x.id === wid);
  const mineOpts = db.contractors.find((c) => c.id === ctr)?.mineIds ?? [];

  return (
    <Modal title="Assign Worker to Contractor" onClose={onClose}>
      <Field label="Worker">
        <select className="input" value={wid} onChange={(e) => setWid(e.target.value)}>
          {db.workers.map((x) => <option key={x.id} value={x.id}>{x.code} — {x.name}</option>)}
        </select>
      </Field>
      <Field label="Contractor" hint="Assignment requires the contractor to be empanelled at the chosen mine">
        <select className="input" value={ctr} onChange={(e) => setCtr(e.target.value)}>
          {db.contractors.filter((c) => c.status !== 'Inactive').map((c) => <option key={c.id} value={c.id}>{c.name} ({c.status})</option>)}
        </select>
      </Field>
      <Field label="Mine">
        <select className="input" value={mineOpts[0] ?? ''} disabled={mineOpts.length === 0}>
          {mineOpts.map((m) => <option key={m} value={m}>{getMine(m)?.name} ({getMine(m)?.code})</option>)}
        </select>
      </Field>
      {err && <div className="text-[12px] font-semibold text-red-600 mb-2" role="alert">{err}</div>}
      <p className="text-[11px] text-slate-400 mb-3">Currently: {w ? `${w.code} → ${getContractor(w.contractorId)?.name ?? 'Direct (Mine)'}` : 'select a worker'}</p>
      <div className="flex gap-2 justify-end">
        <button className="btn-primary !bg-white !text-navy border border-slate-300" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={() => {
          try {
            const mine = db.contractors.find((c) => c.id === ctr)?.mineIds[0];
            if (!mine) { setErr('Selected contractor is not empanelled at any mine.'); return; }
            actions.assignContractor(wid, ctr, mine);
            onClose();
          } catch (e: any) { setErr(e.message); }
        }}>Assign</button>
      </div>
    </Modal>
  );
}

function CertModal({ workerId, onClose }: { workerId: string; onClose: () => void }) {
  const db = useMockOps();
  const [wid, setWid] = useState(workerId || db.workers[0]?.id || '');
  const [status, setStatus] = useState<TrainingStatus>(TrainingStatus.Valid);
  const [expiry, setExpiry] = useState('2027-10-03');
  const [fileName, setFileName] = useState('');
  const [err, setErr] = useState('');

  return (
    <Modal title="Upload Training Certificate" onClose={onClose}>
      <p className="text-[11px] text-slate-400 mb-3">The certificate file stays in browser demo storage; only the training status is recorded.</p>
      <Field label="Worker">
        <select className="input" value={wid} onChange={(e) => setWid(e.target.value)}>
          {db.workers.map((x) => <option key={x.id} value={x.id}>{x.code} — {x.name} (currently {x.trainingStatus})</option>)}
        </select>
      </Field>
      <div className="grid sm:grid-cols-2 gap-x-3">
        <Field label="New training status">
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value as TrainingStatus)}>
            {Object.values(TrainingStatus).map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Expiry date" hint={status === TrainingStatus.NotTrained ? 'Not applicable' : undefined}>
          <input type="date" className="input" value={expiry} disabled={status === TrainingStatus.NotTrained} onChange={(e) => setExpiry(e.target.value)} />
        </Field>
        <Field label="Certificate file (demo)">
          <input type="file" className="input !py-1.5 !text-[12px]" onChange={(e) => setFileName(e.target.files?.[0]?.name ?? '')} />
        </Field>
      </div>
      {err && <div className="text-[12px] font-semibold text-red-600 mb-2" role="alert">{err}</div>}
      <div className="flex gap-2 justify-end">
        <button className="btn-primary !bg-white !text-navy border border-slate-300" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={() => {
          try {
            actions.updateTraining(wid, status, status === TrainingStatus.NotTrained ? null : expiry);
            onClose();
          } catch (e: any) { setErr(e.message); }
        }}>{fileName ? 'Save & Record' : 'Save'}</button>
      </div>
    </Modal>
  );
}

function AccessCardModal({ onClose, defaultSel }: { onClose: () => void; defaultSel: string[] }) {
  const db = useMockOps();
  const [sel, setSel] = useState<string[]>(defaultSel.length ? defaultSel : [db.workers[0]?.id ?? '']);
  const [err, setErr] = useState('');
  const w = db.workers.find((x) => x.id === sel[0]);

  return (
    <Modal title="Manage Access Card" onClose={onClose}>
      <Field label="Worker">
        <select className="input" value={sel[0] ?? ''} onChange={(e) => setSel([e.target.value])}>
          {db.workers.map((x) => <option key={x.id} value={x.id}>{x.code} — {x.name} ({x.accessStatus})</option>)}
        </select>
      </Field>
      {w && (
        <div className="border border-slate-200 rounded-xl p-3 text-[13px] space-y-1.5 mb-3">
          <div className="flex justify-between"><span className="text-slate-500">Card</span><span className="font-mono font-bold">{w.accessCardId}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Status</span><StatusPill v={w.accessStatus} /></div>
          <div className="flex justify-between"><span className="text-slate-500">Training</span><span className={`badge ${TRAINING_TONE[w.trainingStatus]}`}>● {w.trainingStatus}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Gate events today</span><span className="font-bold">{db.access.filter((a) => a.workerId === w.id).length}</span></div>
        </div>
      )}
      {err && <div className="text-[12px] font-semibold text-red-600 mb-2" role="alert">{err}</div>}
      <div className="flex gap-2 justify-end">
        <button className="btn-primary !bg-white !text-navy border border-slate-300" onClick={onClose}>Close</button>
        {w && w.accessStatus === AccessStatus.Allowed ? (
          <button className="btn-primary !bg-red-600 hover:!bg-red-700" onClick={() => {
            try { actions.revokeAccess(w.id, 'Card managed from Workers quick action'); onClose(); } catch (e: any) { setErr(e.message); }
          }}>Revoke Access</button>
        ) : (
          <button className="btn-primary" onClick={() => {
            try { if (w) actions.grantAccess(w.id); onClose(); } catch (e: any) { setErr(e.message); }
          }}>Grant Access</button>
        )}
      </div>
    </Modal>
  );
}
