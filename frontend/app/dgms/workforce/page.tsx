/**
 * Page 7 — Workers & Contractors. Compliance is derived from worker records
 * (workerComplianceOf), never hardcoded. Identifiers are masked.
 */
'use client';
import { useMemo, useState } from 'react';
import { Users } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Bar, BarChart, XAxis, YAxis } from 'recharts';
import Shell from '../../../components/Shell';
import { actions, useMockDb } from '../../../lib/dgms/mockDb';
import { exportCSV } from '../../../lib/dgms/export';
import { workerComplianceOf } from '../../../lib/dgms/seed';
import { ContractorStatus, WorkerCompliance, WorkerStatus } from '../../../lib/dgms/types';
import type { Contractor, Worker } from '../../../lib/dgms/types';
import { DataTable, DemoBadge, DetailDrawer, FilterBar, KpiCard, Kv, SearchInput, SectionCard, Toasts, type Column } from '../../../components/dgms/ui';
import { StatusPill } from '../../../components/dgms/ui';

export default function WorkforcePage() {
  const db = useMockDb();
  const [tab, setTab] = useState<'Workers' | 'Contractors' | 'Compliance'>('Workers');
  const [q, setQ] = useState(''); const [qq, setQq] = useState('');
  const [draft, setDraft] = useState({ mine: 'All Mines', contractor: 'All Contractors', status: 'All Statuses' });
  const [applied, setApplied] = useState(draft);
  const [selWorker, setSelWorker] = useState<Worker | null>(null);
  const [selCtr, setSelCtr] = useState<Contractor | null>(null);
  const [addingWorker, setAddingWorker] = useState(false);
  const [addingCtr, setAddingCtr] = useState(false);
  const [wForm, setWForm] = useState({ name: '', contractorId: '', mineId: '', designation: 'Helper' });
  const [wErr, setWErr] = useState('');
  const [cForm, setCForm] = useState({ company: '', regNo: '', contactName: '', contactPhone: '', mineId: '' });
  const [cErr, setCErr] = useState('');

  const states = useMemo(() => [...new Set(db.workers.map((w) => w.state))].sort(), [db.workers]);
  const mineName = (id: string) => { const m = db.mines.find((x) => x.id === id); return m ? `${m.name} (${m.code})` : id; };
  const ctrName = (id: string) => db.contractors.find((c) => c.id === id)?.company ?? id;

  const compOf = (w: Worker) => workerComplianceOf(w);
  const compliant = db.workers.filter((w) => compOf(w) === WorkerCompliance.Complete);
  const partial = db.workers.filter((w) => compOf(w) === WorkerCompliance.Partial);
  const nonCompliant = db.workers.filter((w) => compOf(w) === WorkerCompliance.NonCompliant);

  const rows = db.workers.filter((w) => {
    const needle = qq.trim().toLowerCase();
    if (needle && !(w.name.toLowerCase().includes(needle) || w.id.toLowerCase().includes(needle))) return false;
    if (applied.mine !== 'All Mines' && w.mineId !== applied.mine) return false;
    if (applied.contractor !== 'All Contractors' && w.contractorId !== applied.contractor) return false;
    if (applied.status !== 'All Statuses' && compOf(w) !== applied.status) return false;
    return true;
  });

  const byState = states.map((s) => ({ state: s, n: db.workers.filter((w) => w.state === s).length }));
  const breakdown = [
    { label: 'Valid identification', n: db.workers.filter((w) => w.idValid).length },
    { label: 'Medical fitness', n: db.workers.filter((w) => w.medicalValid).length },
    { label: 'Safety training', n: db.workers.filter((w) => w.trainingValid).length },
    { label: 'Work authorization', n: db.workers.filter((w) => w.authValid).length },
  ];
  const ctrComp = [
    { name: 'Compliant', value: db.contractors.filter((c) => c.status === ContractorStatus.Active).length, color: '#16a34a' },
    { name: 'Pending review', value: db.contractors.filter((c) => c.status === ContractorStatus.Pending).length, color: '#f59e0b' },
    { name: 'Suspended', value: db.contractors.filter((c) => c.status === ContractorStatus.Suspended).length, color: '#ef4444' },
  ];

  const columns: Column<Worker>[] = [
    { key: 'id', header: 'Worker ID', render: (w) => <span className="font-bold text-navy">{w.id}</span>, sortValue: (w) => w.id },
    { key: 'name', header: 'Worker Name', render: (w) => w.name, sortValue: (w) => w.name },
    { key: 'ctr', header: 'Contractor', render: (w) => ctrName(w.contractorId), sortValue: (w) => ctrName(w.contractorId) },
    { key: 'mine', header: 'Mine', render: (w) => mineName(w.mineId), sortValue: (w) => mineName(w.mineId) },
    { key: 'state', header: 'State', render: (w) => w.state, sortValue: (w) => w.state },
    { key: 'desig', header: 'Designation', render: (w) => w.designation, sortValue: (w) => w.designation },
    { key: 'comp', header: 'Compliance', render: (w) => <StatusPill v={compOf(w)} />, sortValue: (w) => compOf(w) },
    { key: 'actions', header: 'Actions', render: (w) => <button className="text-blue-700 border border-blue-200 rounded-lg px-2.5 py-1 text-[12px] font-bold" onClick={(e) => { e.stopPropagation(); setSelWorker(w); }}>View</button> },
  ];

  function submitWorker() {
    setWErr('');
    if (!wForm.name.trim() || !wForm.contractorId || !wForm.mineId) { setWErr('Name, contractor and mine are required. Synthetic identifiers are generated automatically.'); return; }
    const mine = db.mines.find((m) => m.id === wForm.mineId)!;
    actions.createWorker({
      name: wForm.name.trim(), contractorId: wForm.contractorId, mineId: wForm.mineId, state: mine.state,
      designation: wForm.designation, status: WorkerStatus.Active,
      medicalValid: true, trainingValid: true, authValid: true, idValid: true, joinedOn: '2026-10-03',
    });
    setAddingWorker(false);
    setWForm({ name: '', contractorId: '', mineId: '', designation: 'Helper' });
  }

  function submitContractor() {
    setCErr('');
    if (!cForm.company.trim() || !cForm.regNo.trim() || !cForm.mineId) { setCErr('Company, registration number and an assigned mine are required.'); return; }
    actions.createContractor({ company: cForm.company.trim(), regNo: cForm.regNo.trim().toUpperCase(), status: ContractorStatus.Pending, mines: [cForm.mineId], contactName: cForm.contactName, contactPhone: cForm.contactPhone });
    setAddingCtr(false);
    setCForm({ company: '', regNo: '', contactName: '', contactPhone: '', mineId: '' });
  }

  const selWDocs = selWorker ? db.workerDocs.filter((d) => d.workerId === selWorker.id) : [];

  return (
    <Shell title="Workers & Contractors" subtitle="Monitor workforce compliance, contractor registrations and documentation.">
      <div className="flex gap-2 mb-3 flex-wrap items-center"><span className="ml-auto"><DemoBadge /></span></div>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mb-3">
        <KpiCard icon={<Users size={22} />} label="Total Workers" value={db.workers.length} />
        <KpiCard icon={<Users size={22} />} label="Contractors Registered" value={db.contractors.length} />
        <KpiCard icon={<Users size={22} />} label="Compliant Workers" value={compliant.length} />
        <KpiCard icon={<Users size={22} />} label="Non-Compliant Workers" value={nonCompliant.length} />
        <KpiCard icon={<Users size={22} />} label="Contractors Pending" value={db.contractors.filter((c) => c.status === ContractorStatus.Pending).length} />
      </div>

      <div className="flex gap-2 mb-3">
        {(['Workers', 'Contractors', 'Compliance'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-xl px-4 py-2 text-[13px] font-bold ${tab === t ? 'bg-blue-600 text-white' : 'bg-white border'}`}>{t}</button>
        ))}
      </div>

      {tab === 'Workers' && (
        <SectionCard title={`Worker Registry (${rows.length})`} action={
          <div className="flex gap-2">
            <button className="text-blue-700 border border-blue-200 rounded-lg px-3 py-1.5 text-[12px] font-bold" onClick={() =>
              exportCSV('worker-registry', ['Worker ID', 'Name', 'Contractor', 'Mine', 'State', 'Designation', 'Compliance'],
                rows.map((w) => [w.id, w.name, ctrName(w.contractorId), mineName(w.mineId), w.state, w.designation, compOf(w)]))}>⤓ Export</button>
            <button className="btn-primary !py-1.5" onClick={() => { setWErr(''); setAddingWorker(true); }}>+ Add Worker</button>
          </div>
        }>
          <SearchInput value={q} onChange={setQ} onSearch={() => setQq(q)} ph="Search by worker name or ID…" />
          <FilterBar defs={[
            { key: 'mine', label: 'Mine', options: ['All Mines', ...db.mines.map((m) => m.id)], width: '!w-40' },
            { key: 'contractor', label: 'Contractor', options: ['All Contractors', ...db.contractors.map((c) => c.id)] },
            { key: 'status', label: 'Compliance', options: ['All Statuses', WorkerCompliance.Complete, WorkerCompliance.Partial, WorkerCompliance.NonCompliant] },
          ]} values={draft}
            onChange={(k, v) => setDraft((d) => ({ ...d, [k]: v === 'All Mines' || v === 'All Contractors' || v === 'All Statuses' ? (k === 'mine' ? 'All Mines' : k === 'contractor' ? 'All Contractors' : 'All Statuses') : v }))}
            onApply={() => setApplied(draft)}
            onReset={() => { const r = { mine: 'All Mines', contractor: 'All Contractors', status: 'All Statuses' }; setDraft(r); setApplied(r); setQ(''); setQq(''); }} />
          <div className="mt-3"><DataTable columns={columns} rows={rows} onRowClick={(w) => setSelWorker(w)} /></div>
          <div className="text-[11px] text-slate-500 mt-2">Mine/contractor filters use record IDs. Identity numbers are masked demo values.</div>
        </SectionCard>
      )}

      {tab === 'Contractors' && (
        <SectionCard title={`Contractors (${db.contractors.length})`} action={
          <button className="btn-primary !py-1.5" onClick={() => { setCErr(''); setAddingCtr(true); }}>+ Add Contractor</button>
        }>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
            {db.contractors.map((c) => {
              const crew = db.workers.filter((w) => w.contractorId === c.id);
              const pending = db.workerDocs.filter((d) => crew.some((w) => w.id === d.workerId) && d.status !== 'Valid').length;
              return (
                <button key={c.id} className="border rounded-2xl p-4 text-left hover:border-blue-400" onClick={() => setSelCtr(c)}>
                  <div className="flex items-center gap-2"><span className="font-extrabold text-navy">{c.company}</span><span className="ml-auto"><StatusPill v={c.status} /></span></div>
                  <div className="text-[12px] text-slate-500 mt-1">{c.regNo} · {c.mines.length} mine(s)</div>
                  <div className="text-[12px] text-slate-500">{crew.length} workers · {pending} pending document(s)</div>
                </button>
              );
            })}
          </div>
        </SectionCard>
      )}

      {tab === 'Compliance' && (
        <div className="grid xl:grid-cols-3 gap-3">
          <SectionCard title="Workers by State">
            <div className="h-[220px]">
              <ResponsiveContainer>
                <BarChart data={byState} layout="vertical" margin={{ left: 80 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="state" tick={{ fontSize: 11 }} width={75} />
                  <Tooltip />
                  <Bar dataKey="n" fill="#2563eb" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
          <SectionCard title="Worker Compliance Status">
            <div className="h-[170px] relative">
              <ResponsiveContainer>
                <PieChart><Pie data={[
                  { name: 'Complete', value: compliant.length, color: '#16a34a' },
                  { name: 'Partial', value: partial.length, color: '#f59e0b' },
                  { name: 'Non-Compliant', value: nonCompliant.length, color: '#ef4444' },
                ]} dataKey="value" innerRadius={48} outerRadius={68} paddingAngle={2}>
                  {['#16a34a', '#f59e0b', '#ef4444'].map((c) => <Cell key={c} fill={c} />)}
                </Pie></PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><span className="text-xl font-extrabold text-navy">{db.workers.length}</span></div>
            </div>
            <div className="text-[12px] space-y-1 mt-1">
              <div className="flex gap-2"><span className="w-2.5 h-2.5 rounded-full bg-green-500 mt-1" />Complete<b className="ml-auto">{compliant.length}</b></div>
              <div className="flex gap-2"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 mt-1" />Partial<b className="ml-auto">{partial.length}</b></div>
              <div className="flex gap-2"><span className="w-2.5 h-2.5 rounded-full bg-red-500 mt-1" />Non-Compliant<b className="ml-auto">{nonCompliant.length}</b></div>
            </div>
          </SectionCard>
          <div className="space-y-3">
            <SectionCard title="Compliance Breakdown">
              {breakdown.map((b) => (
                <div key={b.label} className="flex items-center gap-2 text-[12px] py-1">
                  <span className="w-36 text-slate-600">{b.label}</span>
                  <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.round((b.n / db.workers.length) * 100)}%` }} /></div>
                  <b>{b.n}/{db.workers.length}</b>
                </div>
              ))}
            </SectionCard>
            <SectionCard title="Contractor Compliance">
              <div className="h-[140px] relative">
                <ResponsiveContainer>
                  <PieChart><Pie data={ctrComp} dataKey="value" innerRadius={40} outerRadius={58} paddingAngle={2}>
                    {ctrComp.map((d) => <Cell key={d.name} fill={d.color} />)}
                  </Pie></PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><span className="text-lg font-extrabold text-navy">{db.contractors.length}</span></div>
              </div>
              <div className="text-[12px] space-y-1">{ctrComp.map((d) => (
                <div key={d.name} className="flex gap-2 items-center"><span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />{d.name}<b className="ml-auto">{d.value}</b></div>
              ))}</div>
            </SectionCard>
          </div>
        </div>
      )}

      {selWorker && (
        <DetailDrawer title={`${selWorker.name} (${selWorker.id})`} onClose={() => setSelWorker(null)}>
          <div className="flex gap-2 mb-2"><StatusPill v={selWorker.status} /><StatusPill v={compOf(selWorker)} /></div>
          <Kv k="Designation" v={selWorker.designation} />
          <Kv k="Contractor" v={ctrName(selWorker.contractorId)} />
          <Kv k="Mine" v={mineName(selWorker.mineId)} />
          <Kv k="Identity (masked)" v={selWorker.idMasked} />
          <Kv k="Medical fitness" v={selWorker.medicalValid ? 'Valid' : 'Expired'} />
          <Kv k="Safety training" v={selWorker.trainingValid ? 'Valid' : 'Expired'} />
          <Kv k="Work authorization" v={selWorker.authValid ? 'Valid' : 'Pending'} />
          <Kv k="Joined" v={selWorker.joinedOn} />
          <div className="font-bold text-navy mt-3 mb-1 text-sm">Documents ({selWDocs.length})</div>
          {selWDocs.map((d) => <div key={d.id} className="flex gap-2 text-[13px] py-1 border-b last:border-0"><span className="flex-1">{d.type}</span><StatusPill v={d.status} /></div>)}
          {selWDocs.length === 0 && <div className="text-[13px] text-slate-500">No flagged documents — all checks complete.</div>}
        </DetailDrawer>
      )}

      {selCtr && (
        <DetailDrawer title={selCtr.company} onClose={() => setSelCtr(null)}>
          <div className="mb-2"><StatusPill v={selCtr.status} /></div>
          <Kv k="Registration" v={selCtr.regNo} />
          <Kv k="Contact" v={`${selCtr.contactName} · ${selCtr.contactPhone}`} />
          <Kv k="Assigned Mines" v={selCtr.mines.map(mineName).join(', ')} />
          <Kv k="Workforce" v={db.workers.filter((w) => w.contractorId === selCtr.id).length} />
          <Kv k="Pending Documents" v={db.workerDocs.filter((d) => db.workers.some((w) => w.id === d.workerId && w.contractorId === selCtr.id) && d.status !== 'Valid').length} />
        </DetailDrawer>
      )}

      {addingWorker && (
        <DetailDrawer title="Add Worker" onClose={() => setAddingWorker(false)}>
          {wErr && <div className="text-[13px] bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 mb-3">{wErr}</div>}
          <label className="block text-xs font-semibold text-slate-600 mb-2">Full Name *
            <input className="input mt-1" value={wForm.name} onChange={(e) => setWForm({ ...wForm, name: e.target.value })} /></label>
          <label className="block text-xs font-semibold text-slate-600 mb-2">Contractor *
            <select className="input mt-1" value={wForm.contractorId} onChange={(e) => setWForm({ ...wForm, contractorId: e.target.value })}>
              <option value="">Select…</option>{db.contractors.map((c) => <option key={c.id} value={c.id}>{c.company}</option>)}
            </select></label>
          <label className="block text-xs font-semibold text-slate-600 mb-2">Mine *
            <select className="input mt-1" value={wForm.mineId} onChange={(e) => setWForm({ ...wForm, mineId: e.target.value })}>
              <option value="">Select…</option>{db.mines.filter((m) => m.status !== 'Inactive' && m.status !== 'Closed').map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select></label>
          <label className="block text-xs font-semibold text-slate-600 mb-2">Designation
            <input className="input mt-1" value={wForm.designation} onChange={(e) => setWForm({ ...wForm, designation: e.target.value })} /></label>
          <button className="btn-primary w-full mt-2" onClick={submitWorker}>Register Worker</button>
        </DetailDrawer>
      )}

      {addingCtr && (
        <DetailDrawer title="Add Contractor" onClose={() => setAddingCtr(false)}>
          {cErr && <div className="text-[13px] bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 mb-3">{cErr}</div>}
          <label className="block text-xs font-semibold text-slate-600 mb-2">Company *
            <input className="input mt-1" value={cForm.company} onChange={(e) => setCForm({ ...cForm, company: e.target.value })} /></label>
          <label className="block text-xs font-semibold text-slate-600 mb-2">Registration No. *
            <input className="input mt-1" value={cForm.regNo} onChange={(e) => setCForm({ ...cForm, regNo: e.target.value })} /></label>
          <label className="block text-xs font-semibold text-slate-600 mb-2">Assigned Mine *
            <select className="input mt-1" value={cForm.mineId} onChange={(e) => setCForm({ ...cForm, mineId: e.target.value })}>
              <option value="">Select…</option>{db.mines.filter((m) => m.status !== 'Inactive' && m.status !== 'Closed').map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select></label>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <label className="block text-xs font-semibold text-slate-600">Contact Name<input className="input mt-1" value={cForm.contactName} onChange={(e) => setCForm({ ...cForm, contactName: e.target.value })} /></label>
            <label className="block text-xs font-semibold text-slate-600">Contact Phone<input className="input mt-1" value={cForm.contactPhone} onChange={(e) => setCForm({ ...cForm, contactPhone: e.target.value })} /></label>
          </div>
          <button className="btn-primary w-full mt-2" onClick={submitContractor}>Register (Pending Review)</button>
        </DetailDrawer>
      )}
      <Toasts />
    </Shell>
  );
}




