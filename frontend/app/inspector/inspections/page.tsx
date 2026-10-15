'use client';
import { useEffect, useState } from 'react';
import RoleShell, { LightBanner } from '../../components/RoleShell';
import { inspectorNav } from '../page';
import { api } from '../../lib/api';
import { pill } from '../../components/ops';

export default function MyInspections() {
  const [items, setItems] = useState<any[]>([]); const [msg, setMsg] = useState(''); const [loading, setLoading] = useState(true);
  async function load() {
    setLoading(true);
    try { const d = await api('/api/v1/inspections?page=1&size=20'); setItems(d.items || []); }
    catch (e: any) { setMsg(e.message); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  async function act(id: string, status: string) {
    setMsg('');
    try { const r = await api(`/api/v1/inspections/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setMsg(`${id}: ${status === 'Completed' ? 'submitted → PENDING_OPERATOR review' : 'started'}.`); load(); }
    catch (e: any) { setMsg(e.message); }
  }
  return (
    <RoleShell role="inspector" nav={inspectorNav} orgTitle="Mine Inspector (DGMS)" orgSub="Directorate General of Mines Safety" mineName="Bharat Coal Mine (BCM-01)"
      banner={<LightBanner title="My Inspections" sub="Assigned inspections — start, continue, save and submit for operator review." />}>
      {msg && <div className="mb-2 text-[13px] bg-blue-50 border border-blue-200 text-blue-800 rounded-xl px-3 py-2">{msg}</div>}
      <div className="card">
        {loading ? <div className="text-sm text-slate-500 py-8 text-center">Loading assigned inspections…</div> :
        <div className="grid gap-3">{items.map((r: any) => (
          <div key={r.inspection_id} className="border rounded-2xl p-4 flex flex-wrap items-center gap-2">
            <div className="flex-1 min-w-[220px]">
              <div className="font-extrabold text-navy">{r.inspection_id} · {r.mine}</div>
              <div className="text-[12px] text-slate-500">{r.type} · {r.date} · Inspector: {r.inspector} · Priority: {r.priority}</div>
            </div>
            {pill(r.status)}{pill(r.report)}
            <div className="flex gap-1.5">
              {r.status !== 'Completed' && <button className="btn-primary !py-1.5" onClick={() => act(r.inspection_id, 'In Progress')}>Start / Continue</button>}
              {r.status !== 'Completed' && <button className="btn-primary !py-1.5 !bg-green-600 hover:!bg-green-700" onClick={() => { if (confirm(`Submit ${r.inspection_id} for operator review?`)) act(r.inspection_id, 'Completed'); }}>Submit</button>}
            </div>
          </div>))}</div>}
      </div>
    </RoleShell>
  );
}
