'use client';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import TableSkeleton from './ui/TableSkeleton';
import InlineLoader from './ui/InlineLoader';

export function useList(path: string, params: any) {
  const [data, setData] = useState<any>(null); const [loading, setLoading] = useState(true); const [err, setErr] = useState('');
  async function load() {
    setLoading(true); setErr('');
    try {
      const qs = new URLSearchParams({ ...params, page: String(params.page || 1), size: String(params.size || 10) }).toString();
      setData(await api(`${path}?${qs}`));
    } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [JSON.stringify(params)]);
  return { data, loading, err, reload: load };
}

export const pill = (v: string) => {
  const m: any = { Active: 'bg-green-100 text-green-700', Completed: 'bg-green-100 text-green-700', Submitted: 'bg-green-100 text-green-700', Resolved: 'bg-green-100 text-green-700', Compliant: 'bg-green-100 text-green-700', Approved: 'bg-green-100 text-green-700', Paid: 'bg-green-100 text-green-700', High: 'bg-red-100 text-red-600', Critical: 'bg-red-100 text-red-600', Open: 'bg-red-100 text-red-600', Overdue: 'bg-red-100 text-red-600', Rejected: 'bg-red-100 text-red-600', Returned: 'bg-red-100 text-red-600', 'Non-Compliant': 'bg-red-100 text-red-600', Medium: 'bg-amber-100 text-amber-700', Low: 'bg-green-100 text-green-700', 'In Progress': 'bg-blue-100 text-blue-700', Pending: 'bg-amber-100 text-amber-700', 'Pending Approval': 'bg-amber-100 text-amber-700', 'Pending Review': 'bg-amber-100 text-amber-700', Upcoming: 'bg-blue-100 text-blue-700', Updated: 'bg-blue-100 text-blue-700', 'Under Review': 'bg-blue-100 text-blue-700', 'Ending Soon': 'bg-amber-100 text-amber-700', 'Pending Renewal': 'bg-amber-100 text-amber-700', Expiring: 'bg-amber-100 text-amber-700', 'Due Soon': 'bg-amber-100 text-amber-700', Scheduled: 'bg-blue-100 text-blue-700', Normal: 'bg-blue-50 text-blue-700', Draft: 'bg-slate-200 text-slate-600', Closed: 'bg-green-100 text-green-700' };
  return <span className={`badge ${m[v] || 'bg-slate-100 text-slate-600'}`}>● {v}</span>;
};

export function SearchBar({ value, setValue, onSearch, ph }: any) {
  return (<div className="flex gap-2 mb-3 flex-wrap">
    <input className="input !w-80" placeholder={ph} value={value} onChange={e => setValue(e.target.value)}
      onKeyDown={e => e.key === 'Enter' && onSearch()} />
    <button className="btn-primary" onClick={onSearch}>Search</button>
  </div>);
}

/** Error block with retry — loading states must never trap the user. */
export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="py-8 text-center" role="alert">
      <div className="text-sm text-red-600">Couldn&apos;t load data: {message}</div>
      <button className="btn-primary mt-3 !py-2" onClick={onRetry}>Retry</button>
    </div>
  );
}

export function WorkersTable({ canAdd }: { canAdd?: boolean }) {
  const [q, setQ] = useState(''); const [qq, setQq] = useState(''); const [page, setPage] = useState(1);
  const [name, setName] = useState(''); const [mine, setMine] = useState('BCM-03'); const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const { data, loading, err, reload } = useList('/api/v1/workers', { q: qq, page, size: 10 });
  async function add() {
    if (busy) return;
    setMsg(''); setBusy(true);
    try { const r = await api('/api/v1/workers', { method: 'POST', body: JSON.stringify({ name, mine_code: mine }) });
      setMsg(`Worker ${r.worker_id} registered.`); setName(''); reload(); }
    catch (e: any) { setMsg(e.message); }
    finally { setBusy(false); }
  }
  return (<div className="card">
    {msg && <div className="mb-2 text-[13px] bg-blue-50 border border-blue-200 text-blue-800 rounded-xl px-3 py-2">{msg}</div>}
    {canAdd && (<div className="flex gap-2 mb-3 flex-wrap">
      <input className="input !w-64" placeholder="New worker full name" value={name} onChange={e => setName(e.target.value)} />
      <select className="input !w-44" value={mine} onChange={e => setMine(e.target.value)}>
        {['BCM-01','BCM-02','BCM-03','BCM-04','BCM-05','BCM-06','BCM-07','BCM-08','BCM-09','BCM-11','BCM-12'].map(m => <option key={m}>{m}</option>)}
      </select>
      <button className="btn-primary" onClick={add} disabled={busy}>
        {busy ? <InlineLoader label="Adding…" light /> : 'Add Worker'}
      </button>
    </div>)}
    <SearchBar value={q} setValue={setQ} onSearch={() => (setQq(q), setPage(1))} ph="Search by worker name or ID…" />
    {loading ? <TableSkeleton columns={['Worker ID','Name','Contractor','Mine','State','Work Type','Compliance','Training Valid Till']} /> :
     err ? <LoadError message={err} onRetry={reload} /> :
    <div className="overflow-x-auto"><table className="dense w-full min-w-[860px]">
      <thead><tr><th>Worker ID</th><th>Name</th><th>Contractor</th><th>Mine</th><th>State</th><th>Work Type</th><th>Compliance</th><th>Training Valid Till</th></tr></thead>
      <tbody>{data?.items?.map((w: any) => (
        <tr key={w.id}><td className="font-bold text-navy">{w.id}</td><td className="font-semibold">{w.name}</td>
        <td>{w.contractor}</td><td>{w.mine}</td><td>{w.state}</td><td>{w.work}</td><td>{pill(w.compliance)}</td><td>{w.training_till}</td></tr>))}</tbody>
    </table></div>}
  </div>);
}

export function ContractsTable({ allowRenewal }: { allowRenewal?: boolean }) {
  const [q, setQ] = useState(''); const [qq, setQq] = useState(''); const [msg, setMsg] = useState('');
  const [busyId, setBusyId] = useState('');
  const { data, loading, err, reload } = useList('/api/v1/contracts', { q: qq, page: 1, size: 20 });
  async function renew(id: string) {
    if (busyId) return;
    setMsg(''); setBusyId(id);
    try { await api(`/api/v1/contracts/${id}/renewal-request`, { method: 'POST' }); setMsg(`${id}: renewal requested.`); reload(); }
    catch (e: any) { setMsg(e.message); }
    finally { setBusyId(''); }
  }
  return (<div className="card">
    {msg && <div className="mb-2 text-[13px] bg-blue-50 border border-blue-200 text-blue-800 rounded-xl px-3 py-2">{msg}</div>}
    <SearchBar value={q} setValue={setQ} onSearch={() => setQq(q)} ph="Search contracts…" />
    {loading ? <TableSkeleton columns={['Contract','Mine','Period','Value','Status']} rows={4} /> :
     err ? <LoadError message={err} onRetry={reload} /> :
    <div className="grid gap-3">{data?.items?.map((c: any) => (
      <div key={c.id} className="border rounded-2xl p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-extrabold text-navy">{c.name}</span>
          <span className="text-[11px] text-slate-500">{c.id} · {c.mine} ({c.mine_code})</span>
          <span className="ml-auto">{pill(c.status)}</span>
        </div>
        <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-blue-600 rounded-full" style={{ width: `${c.progress}%` }} /></div>
        <div className="mt-2 text-[12px] text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
          <span>Period: <b className="text-navy">{c.start} → {c.end}</b></span>
          <span>Value: <b className="text-navy">₹ {c.value_lakh} Lakh</b></span>
          <span>Progress: <b className="text-navy">{c.progress}%</b></span>
          {allowRenewal && c.status !== 'Pending Renewal' && (
            <button className="text-blue-700 font-bold underline disabled:opacity-50" disabled={!!busyId} onClick={() => renew(c.id)}>
              {busyId === c.id ? 'Requesting…' : 'Request Renewal'}
            </button>
          )}
        </div>
      </div>))}</div>}
  </div>);
}

export function BillsManager({ canDecide, canSubmit }: { canDecide?: boolean; canSubmit?: boolean }) {
  const [st, setSt] = useState('All'); const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false); const [busyId, setBusyId] = useState('');
  const [cid, setCid] = useState('CT-002'); const [period, setPeriod] = useState('Oct 2026'); const [amt, setAmt] = useState('5.0');
  const { data, loading, err, reload } = useList('/api/v1/bills', { status: st, page: 1, size: 20 });
  async function decide(id: string, decision: string) {
    if (busyId) return;
    setMsg(''); setBusyId(id);
    try { await api(`/api/v1/bills/${id}`, { method: 'PATCH', body: JSON.stringify({ decision, remarks: `${decision} in MineNetr demo review` }) });
      setMsg(`${id}: ${decision}.`); reload(); }
    catch (e: any) { setMsg(e.message); }
    finally { setBusyId(''); }
  }
  async function submit() {
    if (busy) return;
    setMsg(''); setBusy(true);
    try { const r = await api('/api/v1/bills', { method: 'POST', body: JSON.stringify({ contract_id: cid, period, amount_lakh: parseFloat(amt) }) });
      setMsg(`Bill ${r.bill_id} submitted → Pending Approval.`); reload(); }
    catch (e: any) { setMsg(e.message); }
    finally { setBusy(false); }
  }
  return (<div className="space-y-3">
    {msg && <div className="text-[13px] bg-blue-50 border border-blue-200 text-blue-800 rounded-xl px-3 py-2">{msg}</div>}
    {canSubmit && (<div className="card">
      <div className="font-extrabold text-navy mb-2">Submit New Bill</div>
      <div className="flex gap-2 flex-wrap">
        <select className="input !w-56" value={cid} onChange={e => setCid(e.target.value)}>
          {['CT-001','CT-002','CT-003','CT-004','CT-005'].map(c => <option key={c}>{c}</option>)}
        </select>
        <input className="input !w-40" value={period} onChange={e => setPeriod(e.target.value)} placeholder="Period (e.g. Oct 2026)" />
        <input className="input !w-36" value={amt} onChange={e => setAmt(e.target.value)} placeholder="₹ Lakh" type="number" min="0.1" step="0.1" />
        <button className="btn-primary" onClick={submit} disabled={busy}>
          {busy ? <InlineLoader label="Submitting bill…" light /> : <>Review &amp; Submit</>}
        </button>
      </div>
      <div className="text-[11px] text-slate-500 mt-1">Approval and payment are distinct: submitted bills enter Pending Approval; only Mine Operator / DGMS can approve.</div>
    </div>)}
    <div className="card">
      <div className="flex gap-2 mb-3">
        <select className="input !w-48" value={st} onChange={e => setSt(e.target.value)}>
          {['All','Draft','Pending Approval','Approved','Rejected','Paid'].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      {loading ? <TableSkeleton columns={['Bill ID','Contract','Mine','Period','Amount','Status','Submitted']} /> :
       err ? <LoadError message={err} onRetry={reload} /> :
      <div className="overflow-x-auto"><table className="dense w-full min-w-[820px]">
        <thead><tr><th>Bill ID</th><th>Contract</th><th>Mine</th><th>Period</th><th>Amount</th><th>Status</th><th>Submitted</th>{canDecide && <th>Decision</th>}</tr></thead>
        <tbody>{data?.items?.map((b: any) => (
          <tr key={b.id}><td className="font-bold text-navy">{b.id}</td><td>{b.contract}</td><td>{b.mine}</td>
          <td>{b.period}</td><td className="font-bold">₹ {b.amount_lakh} L</td><td>{pill(b.status)}</td><td>{b.submitted}</td>
          {canDecide && <td><div className="flex gap-1">
            <button className="text-[12px] font-bold text-green-700 border border-green-300 rounded-lg px-2 py-1 disabled:opacity-50" disabled={!!busyId} onClick={() => decide(b.id, 'Approved')}>{busyId === b.id ? '…' : 'Approve'}</button>
            <button className="text-[12px] font-bold text-red-600 border border-red-300 rounded-lg px-2 py-1 disabled:opacity-50" disabled={!!busyId} onClick={() => { if (confirm(`Reject ${b.id}?`)) decide(b.id, 'Rejected'); }}>Reject</button>
          </div></td>}</tr>))}</tbody>
      </table></div>}
    </div>
  </div>);
}

export function InspectionsTable() {
  const [q, setQ] = useState(''); const [qq, setQq] = useState('');
  const { data, loading, err } = useList('/api/v1/inspections', { q: qq, page: 1, size: 20 });
  return (<div className="card">
    <SearchBar value={q} setValue={setQ} onSearch={() => setQq(q)} ph="Search inspections…" />
    {loading ? <TableSkeleton columns={['Inspection ID','Mine','State','Inspector','Date','Type','Status','Report']} /> :
     err ? <LoadError message={err} onRetry={() => setQq(q)} /> :
    <div className="overflow-x-auto"><table className="dense w-full min-w-[860px]">
      <thead><tr><th>Inspection ID</th><th>Mine</th><th>State</th><th>Inspector</th><th>Date</th><th>Type</th><th>Status</th><th>Report</th></tr></thead>
      <tbody>{data?.items?.map((r: any) => (
        <tr key={r.inspection_id}><td className="font-bold text-navy">{r.inspection_id}</td><td>{r.mine}</td><td>{r.state}</td>
        <td>{r.inspector}</td><td>{r.date}</td><td>{r.type}</td><td>{pill(r.status)}</td><td>{pill(r.report)}</td></tr>))}</tbody>
    </table></div>}
  </div>);
}

export function FindingsTable() {
  const [q, setQ] = useState(''); const [qq, setQq] = useState('');
  const { data, loading, err } = useList('/api/v1/findings', { q: qq, page: 1, size: 20 });
  return (<div className="card">
    <SearchBar value={q} setValue={setQ} onSearch={() => setQq(q)} ph="Search findings…" />
    {loading ? <TableSkeleton columns={['Finding ID','Mine','Category','Severity','Status','Source','Date']} /> :
     err ? <LoadError message={err} onRetry={() => setQq(q)} /> :
    <div className="overflow-x-auto"><table className="dense w-full min-w-[820px]">
      <thead><tr><th>Finding ID</th><th>Mine</th><th>Category</th><th>Severity</th><th>Status</th><th>Source</th><th>Date</th></tr></thead>
      <tbody>{data?.items?.map((f: any) => (
        <tr key={f.finding_id}><td className="font-bold text-navy">{f.finding_id}</td><td>{f.mine}</td><td>{f.category}</td>
        <td>{pill(f.severity)}</td><td>{pill(f.status)}</td><td className="text-[12px]">{f.source}</td><td>{f.date}</td></tr>))}</tbody>
    </table></div>}
  </div>);
}

export function FindingForm({ onDone }: { onDone?: () => void }) {
  const [mine, setMine] = useState('BCM-03'); const [cat, setCat] = useState('Safety (PPE)');
  const [sev, setSev] = useState('Medium'); const [desc, setDesc] = useState(''); const [loc, setLoc] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (busy || !desc.trim()) return;
    setMsg(''); setBusy(true);
    try { const r = await api('/api/v1/findings', { method: 'POST', body: JSON.stringify({ mine_code: mine, category: cat, severity: sev, description: desc, location: loc }) });
      setMsg(`Finding ${r.finding_id} recorded and routed for corrective action.`); setDesc(''); setLoc(''); onDone && onDone(); }
    catch (e: any) { setMsg(e.message); }
    finally { setBusy(false); }
  }
  return (<div className="card">
    <div className="font-extrabold text-navy mb-2">Record a Finding</div>
    {msg && <div className="mb-2 text-[13px] bg-blue-50 border border-blue-200 text-blue-800 rounded-xl px-3 py-2">{msg}</div>}
    <div className="grid sm:grid-cols-3 gap-2">
      <select className="input" value={mine} onChange={e => setMine(e.target.value)}>{['BCM-01','BCM-02','BCM-03','BCM-04','BCM-05','BCM-06','BCM-07','BCM-08','BCM-09','BCM-11','BCM-12'].map(m => <option key={m}>{m}</option>)}</select>
      <select className="input" value={cat} onChange={e => setCat(e.target.value)}>{['Safety (PPE)','Environment','Equipment Safety','Documentation','Worker Welfare','Others'].map(c => <option key={c}>{c}</option>)}</select>
      <select className="input" value={sev} onChange={e => setSev(e.target.value)}>{['Critical','High','Medium','Low'].map(s => <option key={s}>{s}</option>)}</select>
    </div>
    <input className="input mt-2" placeholder="Location / zone (e.g. Pit Area - Loading Point L3)" value={loc} onChange={e => setLoc(e.target.value)} />
    <textarea className="input mt-2" rows={3} placeholder="Observation details…" value={desc} onChange={e => setDesc(e.target.value)} />
    <button className="btn-primary mt-2" onClick={submit} disabled={busy}>
      {busy ? <InlineLoader label="Saving…" light /> : 'Save Finding'}
    </button>
  </div>);
}

export function NotificationsPanel() {
  const [items, setItems] = useState<any[]>([]); const [err, setErr] = useState('');
  useEffect(() => { api('/api/v1/notifications').then(d => setItems(d.items || [])).catch((e: any) => setErr(e.message)); }, []);
  if (err) return <div className="card text-sm text-red-600">Error: {err}</div>;
  return (<div className="card"><div className="font-extrabold text-navy mb-2">Notifications</div>
    <div className="space-y-2.5">{items.map((a: any, i: number) => (
      <div key={i} className="flex gap-2.5 items-start border-b last:border-0 pb-2.5">
        <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 font-bold">◉</div>
        <div><div className="text-[13px] font-bold text-navy">{a.title}</div>
        <div className="text-[11px] text-slate-500">{a.subtitle} · {a.time}</div></div>
        <span className="ml-auto">{pill(a.severity)}</span></div>))}
      {!items.length && <div className="text-sm text-slate-500">No notifications.</div>}</div></div>);
}

export function RoleStub({ t, s }: { t: string; s: string }) {
  return (<div className="card text-sm text-slate-600">
    <div className="font-bold text-navy mb-1">{t} — connected module</div>
    <p>{s} Served by the shared FastAPI backend with JWT role scoping. Demo data labeled DEMO.</p>
  </div>);
}
