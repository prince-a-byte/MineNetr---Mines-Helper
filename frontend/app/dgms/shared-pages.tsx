'use client';
import { useEffect, useState } from 'react';
import Shell from '../../components/Shell';
import { api } from '../../lib/api';

function useList(path: string, params: any) {
  const [data, setData] = useState<any>(null); const [loading, setLoading] = useState(true); const [err, setErr] = useState('');
  async function load() {
    setLoading(true); setErr('');
    try { const qs = new URLSearchParams({ ...params, page: String(params.page || 1), size: String(params.size || 10) }).toString();
      setData(await api(`${path}?${qs}`)); }
    catch (e: any) { setErr(e.message); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [JSON.stringify(params)]);
  return { data, loading, err, reload: load };
}
const pill = (v: string) => {
  const m: any = { Active: 'bg-green-100 text-green-700', Completed: 'bg-green-100 text-green-700', Submitted: 'bg-green-100 text-green-700', Resolved: 'bg-green-100 text-green-700', High: 'bg-red-100 text-red-600', Critical: 'bg-red-100 text-red-600', Open: 'bg-red-100 text-red-600', Medium: 'bg-amber-100 text-amber-700', Low: 'bg-green-100 text-green-700', 'In Progress': 'bg-blue-100 text-blue-700', Pending: 'bg-amber-100 text-amber-700', Overdue: 'bg-red-100 text-red-600', 'Under Inspection': 'bg-amber-100 text-amber-700', Inactive: 'bg-slate-200 text-slate-600' };
  return <span className={`badge ${m[v] || 'bg-slate-100 text-slate-600'}`}>● {v}</span>;
};

export function RegistryPage() {
  const [q, setQ] = useState(''); const [qq, setQq] = useState(''); const [page, setPage] = useState(1);
  const { data, loading, err } = useList('/api/v1/mines', { q: qq, page, size: 10 });
  return (<Shell title="Mine Registry" subtitle="View and manage all registered mines across India.">
    <div className="grid grid-cols-2 xl:grid-cols-5 gap-3 mb-3">
      {[['Total Registered Mines','213','+2%'],['Active Mines','182','+4%'],['Under Inspection','18','-2%'],['High Risk Mines','13','No Change'],['Inactive / Closed','8','-1%']].map(([l,v,d]) => (
        <div key={l} className="card !p-4"><div className="text-[12px] text-slate-500 font-semibold">{l}</div><div className="text-2xl font-extrabold text-navy">{v} <span className="text-xs text-green-600">{d}</span></div></div>))}
    </div>
    <div className="card">
      <div className="flex gap-2 flex-wrap mb-3">
        <input className="input !w-80" placeholder="Search by mine name, code, operator or location…" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key==='Enter' && (setQq(q), setPage(1))}/>
        <button className="btn-primary" onClick={() => (setQq(q), setPage(1))}>Search</button>
        <button className="btn-primary !bg-white !text-blue-700 border border-blue-600" onClick={() => (setQ(''), setQq(''), setPage(1))}>Reset</button>
      </div>
      {loading ? <div className="text-sm text-slate-500 py-8 text-center">Loading mines…</div> :
       err ? <div className="text-sm text-red-600 py-8 text-center">Error: {err}</div> :
      <div className="overflow-x-auto"><table className="dense w-full min-w-[900px]">
        <thead><tr><th>#</th><th>Mine Code</th><th>Mine Name</th><th>State</th><th>District</th><th>Operator</th><th>Status</th><th>Risk Level</th><th>Last Inspection</th><th>Actions</th></tr></thead>
        <tbody>{data?.items?.map((m: any, i: number) => (
          <tr key={m.code}><td>{(page-1)*10+i+1}</td><td className="font-bold text-blue-700">{m.code}</td><td className="font-semibold text-navy">{m.name}</td>
          <td>{m.state}</td><td>{m.district}</td><td>{m.operator}</td><td>{pill(m.status)}</td><td>{pill(m.risk)}</td><td>{m.last_inspection}</td>
          <td><button className="text-blue-700 border border-blue-200 rounded-lg px-2.5 py-1 text-[12px] font-bold" onClick={() => alert(`${m.name} (${m.code})\nOperator: ${m.operator}\nCapacity: ${m.capacity}\nType: ${m.type}\nStatus: ${m.status} · Risk: ${m.risk}`)}>View</button></td></tr>))}</tbody>
      </table></div>}
      <div className="flex items-center gap-2 mt-3 text-xs text-slate-500">
        <span>Showing {(page-1)*10+1}–{Math.min(page*10, data?.total || 0)} of {data?.total} mines</span>
        <div className="ml-auto flex gap-1">{[1,2,3].map(p => (<button key={p} onClick={() => setPage(p)} className={`w-8 h-8 rounded-lg font-bold ${page===p ? 'bg-blue-600 text-white' : 'bg-white border'}`}>{p}</button>))}</div>
      </div>
    </div>
  </Shell>);
}

export function InspectionsPage() {
  const [q, setQ] = useState(''); const [qq, setQq] = useState(''); const [page, setPage] = useState(1);
  const { data, loading, err } = useList('/api/v1/inspections', { q: qq, page, size: 10 });
  return (<Shell title="Inspection Oversight" subtitle="Monitor inspection planning, progress, reports and compliance across all mines.">
    <div className="grid grid-cols-2 xl:grid-cols-5 gap-3 mb-3">
      {[['Total Inspections','214','Scheduled in period'],['Completed','158','73.8% completion rate'],['In Progress','28','Under inspection'],['Overdue','20','Require attention'],['Reports Pending Review','18','Submitted by inspectors']].map(([l,v,d]) => (
        <div key={l} className="card !p-4"><div className="text-[12px] text-slate-500 font-semibold">{l}</div><div className="text-2xl font-extrabold text-navy">{v}</div><div className="text-[11px] text-slate-500">{d}</div></div>))}
    </div>
    <div className="card">
      <div className="flex gap-2 mb-3"><input className="input !w-80" placeholder="Search by mine, inspector or report ID…" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key==='Enter' && (setQq(q), setPage(1))}/>
      <button className="btn-primary" onClick={() => (setQq(q), setPage(1))}>Search</button></div>
      {loading ? <div className="text-sm text-slate-500 py-8 text-center">Loading inspections…</div> :
       err ? <div className="text-sm text-red-600">Error: {err}</div> :
      <div className="overflow-x-auto"><table className="dense w-full min-w-[1000px]">
        <thead><tr><th>#</th><th>Inspection ID</th><th>Mine Name</th><th>State</th><th>Inspector</th><th>Scheduled Date</th><th>Type</th><th>Status</th><th>Report</th><th>Actions</th></tr></thead>
        <tbody>{data?.items?.map((r: any, i: number) => (
          <tr key={r.inspection_id}><td>{(page-1)*10+i+1}</td><td className="font-bold text-navy">{r.inspection_id}</td><td>{r.mine}</td><td>{r.state}</td><td>{r.inspector}</td><td>{r.date}</td><td>{r.type}</td><td>{pill(r.status)}</td><td>{pill(r.report)}</td>
          <td><button className="text-blue-700 border border-blue-200 rounded-lg px-2.5 py-1 text-[12px] font-bold" onClick={() => alert(`${r.inspection_id} · ${r.mine}\nInspector: ${r.inspector}\nType: ${r.type} · Status: ${r.status}\nReport: ${r.report}`)}>View</button></td></tr>))}</tbody>
      </table></div>}
      <div className="flex gap-1 mt-3">{[1,2].map(p => (<button key={p} onClick={() => setPage(p)} className={`w-8 h-8 rounded-lg font-bold text-xs ${page===p ? 'bg-blue-600 text-white' : 'bg-white border'}`}>{p}</button>))}</div>
    </div>
  </Shell>);
}

export function FindingsPage() {
  const [q, setQ] = useState(''); const [qq, setQq] = useState(''); const [sev, setSev] = useState(''); const [page, setPage] = useState(1);
  const [sel, setSel] = useState<any>(null); const [msg, setMsg] = useState('');
  const { data, loading, err, reload } = useList('/api/v1/findings', { q: qq, severity: sev, page, size: 10 });
  async function resolve(f: any) {
    setMsg('');
    try { await api(`/api/v1/findings/${f.finding_id}`, { method: 'PATCH', body: JSON.stringify({ status: 'Resolved', ai_verified: true }) });
      setMsg(`${f.finding_id} marked Resolved (human-verified).`); reload(); }
    catch (e: any) { setMsg(e.message); }
  }
  return (<Shell title="Findings & Violations" subtitle="Monitor inspection findings, AI-detected observations and violations across all mines.">
    <div className="grid grid-cols-2 xl:grid-cols-5 gap-3 mb-3">
      {[['Total Findings','482'],['Critical','86'],['High Priority','134'],['Open Findings','212'],['Resolved Findings','270']].map(([l,v]) => (
        <div key={l} className="card !p-4"><div className="text-[12px] text-slate-500 font-semibold">{l}</div><div className="text-2xl font-extrabold text-navy">{v}</div></div>))}
    </div>
    {msg && <div className="mb-2 text-[13px] bg-blue-50 border border-blue-200 text-blue-800 rounded-xl px-3 py-2">{msg}</div>}
    <div className="grid xl:grid-cols-3 gap-3">
      <div className="card xl:col-span-2">
        <div className="flex gap-2 mb-3 flex-wrap">
          <input className="input !w-72" placeholder="Search by finding ID, mine, category…" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key==='Enter' && (setQq(q), setPage(1))}/>
          <select className="input !w-40" value={sev} onChange={e => (setSev(e.target.value), setPage(1))}>
            <option value="">All Severities</option><option>Critical</option><option>High</option><option>Medium</option><option>Low</option></select>
          <button className="btn-primary" onClick={() => (setQq(q), setPage(1))}>Search</button>
        </div>
        {loading ? <div className="text-sm text-slate-500 py-8 text-center">Loading findings…</div> :
         err ? <div className="text-sm text-red-600">Error: {err}</div> :
        <div className="overflow-x-auto"><table className="dense w-full min-w-[860px]">
          <thead><tr><th>Finding ID</th><th>Mine</th><th>Category</th><th>Severity</th><th>Status</th><th>Source</th><th>Actions</th></tr></thead>
          <tbody>{data?.items?.map((f: any) => (
            <tr key={f.finding_id}><td className="font-bold text-navy">{f.finding_id}</td><td>{f.mine}</td><td>{f.category}</td>
            <td>{pill(f.severity)}</td><td>{pill(f.status)}</td><td className="text-[12px]">{f.source}{f.source==='AI Detection' && !f.ai_verified ? ' · unverified' : ''}</td>
            <td><button className="text-blue-700 border border-blue-200 rounded-lg px-2.5 py-1 text-[12px] font-bold" onClick={() => setSel(f)}>View</button></td></tr>))}</tbody>
        </table></div>}
        <div className="flex gap-1 mt-3">{[1,2].map(p => (<button key={p} onClick={() => setPage(p)} className={`w-8 h-8 rounded-lg font-bold text-xs ${page===p ? 'bg-blue-600 text-white' : 'bg-white border'}`}>{p}</button>))}</div>
      </div>
      <div className="card">
        <div className="font-extrabold text-navy">Finding Details</div>
        {!sel ? <div className="text-[13px] text-slate-500 mt-2">Select a finding to review evidence, location and recommended action. AI predictions require human verification before closure.</div> : (
          <div className="text-[13px] mt-2 space-y-1.5">
            <div className="font-bold">{sel.finding_id} · {pill(sel.severity)} {pill(sel.status)}</div>
            <div className="text-slate-600">{sel.description}</div>
            <div><b>Mine:</b> {sel.mine} ({sel.mine_code})</div>
            <div><b>Location:</b> {sel.location}</div>
            <div><b>Source:</b> {sel.source}{sel.ai_conf ? ` · conf ${(sel.ai_conf*100).toFixed(0)}%` : ''}</div>
            <div><b>Assigned:</b> {sel.assigned} · <b>Target:</b> {sel.target}</div>
            <button onClick={() => resolve(sel)} className="btn-primary w-full mt-2">Mark as Resolved (verify)</button>
          </div>)}
      </div>
    </div>
  </Shell>);
}
