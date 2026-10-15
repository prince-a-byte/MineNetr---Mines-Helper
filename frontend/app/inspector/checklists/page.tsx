'use client';
import { useEffect, useState } from 'react';
import RoleShell, { LightBanner } from '../../../components/RoleShell';
import { inspectorNav } from '../nav';

const SECTIONS = [
  { name: 'Mine Safety', items: ['PPE compliance in active zones', 'Haul road edge protection', 'Blasting shelter signage'] },
  { name: 'Environmental Compliance', items: ['Dust suppression on haul roads', 'Water runoff controls', 'Overburden dump stability'] },
  { name: 'Mechanical & Electrical', items: ['Conveyor guards in place', 'Electrical earthing records', 'Dumper reverse horns functional'] },
  { name: 'Workers & Contractors', items: ['Valid gate passes for crew', 'Training certificates current', 'First-aid kit stocked'] },
  { name: 'Statutory Compliance', items: ['Shift logbook complete', 'Explosive magazine license valid', 'Statutory postings displayed'] },
];
const K = 'minenetr_checklist_v1';

export default function Checklists() {
  const [ans, setAns] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState('');
  useEffect(() => { try { setAns(JSON.parse(localStorage.getItem(K) || '{}')); } catch {} }, []);
  function set(k: string, v: string) { const n = { ...ans, [k]: v }; setAns(n); localStorage.setItem(K, JSON.stringify(n)); }
  const total = SECTIONS.reduce((a, s) => a + s.items.length, 0);
  const done = Object.keys(ans).length;
  return (
    <RoleShell role="inspector" nav={inspectorNav} orgTitle="Mine Inspector (DGMS)" orgSub="Directorate General of Mines Safety" mineName="Bharat Coal Mine (BCM-01)"
      banner={<LightBanner title="Checklists & Forms" sub="Offline-capable draft — progress saves locally, submit from My Inspections." />}>
      <div className="card mb-3">
        <div className="flex items-center gap-3">
          <div className="font-extrabold text-navy">BCM-03 · Routine Safety Inspection</div>
          <div className="ml-auto text-sm font-bold text-navy">{done}/{total} answered</div>
        </div>
        <div className="mt-2 h-2.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-blue-600 rounded-full transition-all" style={{ width: `${Math.round(done / total * 100)}%` }} /></div>
        {saved && <div className="mt-2 text-[13px] text-green-700 font-semibold">{saved}</div>}
      </div>
      {SECTIONS.map(s => (
        <div key={s.name} className="card mb-3">
          <div className="font-extrabold text-navy mb-2">{s.name}</div>
          {s.items.map(it => (
            <div key={it} className="flex flex-wrap items-center gap-2 py-2 border-t border-slate-100">
              <span className="flex-1 text-[13px] text-slate-700 min-w-[200px]">{it}</span>
              {['Compliant', 'Non-Compliant', 'N/A'].map(o => (
                <button key={o} onClick={() => set(it, o)}
                  className={`text-[12px] font-bold rounded-lg px-3 py-1.5 border ${ans[it] === o ? (o === 'Compliant' ? 'bg-green-600 text-white border-green-600' : o === 'Non-Compliant' ? 'bg-red-600 text-white border-red-600' : 'bg-slate-600 text-white border-slate-600') : 'bg-white text-slate-500 border-slate-200'}`}>{o}</button>))}
            </div>))}
        </div>))}
      <button className="btn-primary" onClick={() => { localStorage.setItem(K, JSON.stringify(ans)); setSaved(`Draft saved locally at ${new Date().toLocaleTimeString()} — syncs on submit, never marked synced before server confirmation.`); }}>Save Draft Locally</button>
    </RoleShell>
  );
}
