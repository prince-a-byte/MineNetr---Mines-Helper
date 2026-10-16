'use client';
import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Factory, HardHat, ShieldCheck, ClipboardCheck, Eye, EyeOff } from 'lucide-react';
import { apiUrl, roleHome } from '../../lib/api';
import InlineLoader from '../../components/ui/InlineLoader';

const ROLES = [
  { id: 'operator', name: 'Mine Operator', desc: 'Manage mine operations, production, workforce and safety.', icon: Factory },
  { id: 'contractor', name: 'Contractor', desc: 'Manage contracts, workers, attendance, billing and compliance.', icon: HardHat },
  { id: 'dgms', name: 'DGMS Administrator', desc: 'Oversee mines, inspections, regulatory compliance and safety.', icon: ShieldCheck },
  { id: 'inspector', name: 'Mine Inspector', desc: 'Conduct inspections, capture evidence and report safety findings.', icon: ClipboardCheck },
];

const DEMO = [
  { role: 'dgms', email: 'dgms@minenetr.in', pass: 'dgms123' },
  { role: 'inspector', email: 'inspector@minenetr.in', pass: 'inspect123' },
  { role: 'operator', email: 'operator@minenetr.in', pass: 'operate123' },
  { role: 'contractor', email: 'contractor@minenetr.in', pass: 'contract123' },
];

export default function LoginPage() {
  const [role, setRole] = useState('dgms');
  const [email, setEmail] = useState('dgms@minenetr.in');
  const [pw, setPw] = useState('dgms123');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const sel = ROLES.find(r => r.id === role)!;

  function pick(id: string) {
    setRole(id); setErr('');
    const d = DEMO.find(x => x.role === id);
    if (d && process.env.NODE_ENV !== 'production') { setEmail(d.email); setPw(d.pass); }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/v1/auth/login'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pw, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Login failed');
      localStorage.setItem('minenetr_token', data.access_token);
      localStorage.setItem('minenetr_user', JSON.stringify(data.user));
      router.push(roleHome[data.user.role] || '/dgms');
    } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-navy">
      {/* Left branding */}
      <div className="md:w-[52%] relative overflow-hidden flex flex-col justify-between p-8 md:p-12 text-white"
        style={{ background: 'linear-gradient(160deg,#060d1f 0%,#0b1e42 55%,#123a8f 100%)' }}>
        {/* stylised night opencast mine, pure CSS/SVG — no external image dependency */}
        <svg className="absolute inset-x-0 bottom-0 w-full h-[58%] opacity-60" viewBox="0 0 800 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
          <defs>
            <linearGradient id="lbench" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#27436e"/><stop offset="1" stopColor="#060d1f"/>
            </linearGradient>
            <radialGradient id="lglow" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#ffca7a"/><stop offset="1" stopColor="#ffca7a" stopOpacity="0"/>
            </radialGradient>
          </defs>
          <g fill="url(#lbench)">
            <path d="M0 300 L140 180 L800 180 L800 300 Z"/>
            <path d="M0 300 L100 220 L800 220 L800 300 Z" opacity="0.8"/>
            <path d="M0 300 L60 260 L800 260 L800 300 Z" opacity="0.9"/>
          </g>
          <ellipse cx="620" cy="205" rx="90" ry="40" fill="url(#lglow)" opacity="0.5"/>
          <g>
            <rect x="560" y="188" width="60" height="20" rx="2" fill="#0a0f1e"/>
            <rect x="570" y="174" width="26" height="14" rx="2" fill="#131c33"/>
            <circle cx="573" cy="210" r="6" fill="#02040a"/><circle cx="604" cy="210" r="6" fill="#02040a"/>
            <rect x="572" y="176" width="22" height="8" rx="1" fill="#ffca7a" opacity="0.8"/>
          </g>
          <g fill="#ffca7a" opacity="0.9">
            <circle cx="200" cy="235" r="2.5"/><circle cx="330" cy="200" r="2.5"/><circle cx="470" cy="240" r="2.5"/><circle cx="700" cy="235" r="2.5"/>
          </g>
        </svg>
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg,rgba(4,10,24,.35),rgba(4,10,24,.88))' }} />
        <div className="relative">
          <div className="flex items-center gap-3">
            <Image src="/assets/minenetr-logo.svg" alt="MineNetr" width={150} height={42} />
          </div>
          <h1 className="mt-12 text-3xl md:text-[42px] leading-tight font-extrabold max-w-xl">Mine Safety. Smarter Operations. Stronger Governance.</h1>
          <p className="mt-4 text-slate-300 max-w-lg text-[15px]">One unified platform for mine operations, contractor management, field inspections, evidence-based findings and DGMS regulatory oversight.</p>
          <div className="mt-8 grid gap-3 max-w-lg">
            {[['Operational visibility','Live KPIs across production, dispatch, workforce and compliance.'],['Evidence-based inspections','Checklists, photos, GPS and AI-assisted findings with human verification.'],['Transparent compliance','Traceable corrective actions, audit logs and regulatory reports.']].map(([t,d]) => (
              <div key={t} className="flex gap-3 bg-white/10 backdrop-blur rounded-xl p-3.5 border border-white/10">
                <ShieldCheck className="text-cyan-300 shrink-0" size={20} />
                <div><div className="font-bold text-sm">{t}</div><div className="text-xs text-slate-300">{d}</div></div>
              </div>))}
          </div>
        </div>
        <div className="relative text-[11px] text-slate-400 mt-8">Directorate General of Mines Safety · Ministry of Labour &amp; Employment · Demo build — simulated data labeled DEMO</div>
      </div>
      {/* Right sign-in */}
      <div className="md:w-[48%] bg-slate-50 p-6 md:p-12 flex flex-col justify-center">
        <div className="max-w-xl w-full mx-auto">
          <h2 className="text-2xl font-extrabold text-navy">Welcome to MineNetr</h2>
          <p className="text-sm text-slate-500 mb-5">Select your workspace to continue.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ROLES.map(r => {
              const Icon = r.icon; const active = role === r.id;
              return (<button key={r.id} onClick={() => pick(r.id)}
                className={`text-left rounded-2xl border-2 p-4 transition ${active ? 'border-blue-600 bg-blue-50 shadow-md' : 'border-slate-200 bg-white hover:border-blue-300'}`}>
                <Icon size={22} className={active ? 'text-blue-700' : 'text-slate-500'} />
                <div className="font-bold text-sm mt-2 text-navy">{r.name}</div>
                <div className="text-[12px] text-slate-500 mt-1 leading-snug">{r.desc}</div>
                <div className={`mt-2 text-[12px] font-bold ${active ? 'text-blue-700' : 'text-slate-400'}`}>{active ? '● Selected — Continue as ' + r.name : 'Continue as ' + r.name}</div>
              </button>);
            })}
          </div>
          <form onSubmit={submit} className="card mt-4">
            <div className="text-sm font-bold text-navy">Sign in as <span className="text-blue-700">{sel.name}</span> <button type="button" className="text-blue-600 underline ml-1" onClick={() => setRole('dgms')}>change</button></div>
            <label className="block text-xs font-semibold mt-3 text-slate-600">Email</label>
            <input className="input mt-1" value={email} onChange={e => setEmail(e.target.value)} type="email" required placeholder="you@org.in" />
            <label className="block text-xs font-semibold mt-3 text-slate-600">Password</label>
            <div className="relative">
              <input className="input mt-1 pr-10" value={pw} onChange={e => setPw(e.target.value)} type={show ? 'text' : 'password'} required />
              <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-3.5 text-slate-400">{show ? <EyeOff size={18}/> : <Eye size={18}/>}</button>
            </div>
            {err && <div className="mt-3 text-[13px] bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2">{err}</div>}
            <button disabled={loading} className="btn-primary w-full mt-4 flex items-center justify-center gap-2">
              {loading ? <InlineLoader label={`Signing in to ${sel.name}…`} light /> : `Sign in to ${sel.name} workspace`}
            </button>
            <div className="mt-3 text-[11px] text-slate-500 bg-amber-50 border border-amber-200 rounded-xl p-2.5">
              <b>Demo accounts (development only):</b><br/>
              DGMS: dgms@minenetr.in / dgms123 · Inspector: inspector@minenetr.in / inspect123<br/>
              Operator: operator@minenetr.in / operate123 · Contractor: contractor@minenetr.in / contract123
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
