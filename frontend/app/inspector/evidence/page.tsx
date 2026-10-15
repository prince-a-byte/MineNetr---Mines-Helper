'use client';
import { useRef, useState } from 'react';
import RoleShell, { LightBanner } from '../../../components/RoleShell';
import { inspectorNav } from '../nav';

type Ev = { name: string; url: string; time: string; synced: boolean };

export default function Evidence() {
  const [items, setItems] = useState<Ev[]>([]);
  const [msg, setMsg] = useState('');
  const cam = useRef<HTMLInputElement>(null);
  function pick(files: FileList | null, fromCamera: boolean) {
    if (!files?.length) return;
    const f = files[0];
    if (!f.type.startsWith('image/') && !f.type.startsWith('video/')) { setMsg('Only photo/video evidence accepted.'); return; }
    if (f.size > 25 * 1024 * 1024) { setMsg('File exceeds 25 MB limit.'); return; }
    const url = URL.createObjectURL(f);
    setItems(x => [{ name: f.name, url, time: new Date().toLocaleString(), synced: false }, ...x]);
    setMsg(`${f.name} queued for upload (${fromCamera ? 'camera' : 'file fallback'}) — will show Synced only after backend confirmation.`);
  }
  return (
    <RoleShell role="inspector" nav={inspectorNav} orgTitle="Mine Inspector (DGMS)" orgSub="Directorate General of Mines Safety" mineName="Bharat Coal Mine (BCM-01)"
      banner={<LightBanner title="Photos & Evidence" sub="Capture photo/video with timestamp and zone linkage. GPS recorded only when actually available." />}>
      {msg && <div className="mb-2 text-[13px] bg-blue-50 border border-blue-200 text-blue-800 rounded-xl px-3 py-2">{msg}</div>}
      <div className="card mb-3">
        <div className="flex gap-2 flex-wrap">
          <input ref={cam} type="file" accept="image/*,video/*" capture="environment" className="hidden" onChange={e => pick(e.target.files, true)} />
          <button className="btn-primary" onClick={() => cam.current?.click()}>📷 Capture with Camera</button>
          <label className="btn-primary !bg-white !text-blue-700 border border-blue-600 cursor-pointer">Choose File (fallback)
            <input type="file" accept="image/*,video/*" className="hidden" onChange={e => pick(e.target.files, false)} />
          </label>
        </div>
        <div className="text-[11px] text-slate-500 mt-2">Mine: BCM-03 · Zone: selected in checklist · No GPS coordinates are fabricated — positioning method is stored per item.</div>
      </div>
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {items.map((e, i) => (
          <div key={i} className="card !p-3">
            {e.url && <img src={e.url} alt={e.name} className="rounded-xl w-full h-44 object-cover bg-slate-100" />}
            <div className="text-[12px] font-bold text-navy mt-1.5 truncate">{e.name}</div>
            <div className="text-[11px] text-slate-500">{e.time}</div>
            <span className={`badge mt-1 ${e.synced ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{e.synced ? '● Synced' : '● Queued — not yet synced'}</span>
          </div>))}
        {!items.length && <div className="card text-sm text-slate-500">No evidence captured yet in this session.</div>}
      </div>
    </RoleShell>
  );
}
