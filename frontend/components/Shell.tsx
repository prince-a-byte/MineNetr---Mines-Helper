'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Mountain, ClipboardList, TriangleAlert, Leaf, Truck, Users, BarChart3, Bell, ScrollText, Settings, LogOut, Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getUser, getToken } from '../lib/api';

const NAV = [
  { href: '/dgms', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dgms/registry', label: 'Mine Registry', icon: Mountain },
  { href: '/dgms/inspections', label: 'Inspection Oversight', icon: ClipboardList },
  { href: '/dgms/findings', label: 'Findings & Violations', icon: TriangleAlert },
  { href: '/dgms/safety', label: 'Safety & Environment', icon: Leaf },
  { href: '/dgms/production', label: 'Production & Dispatch', icon: Truck },
  { href: '/dgms/workforce', label: 'Workers & Contractors', icon: Users },
  { href: '/dgms/reports', label: 'Reports & Analytics', icon: BarChart3 },
  { href: '/dgms/notifications', label: 'Notifications', icon: Bell },
  { href: '/dgms/audit', label: 'Audit Logs', icon: ScrollText },
  { href: '/dgms/settings', label: 'Settings', icon: Settings },
];

export default function Shell({ children, title, subtitle }: { children: React.ReactNode; title: string; subtitle?: string }) {
  const path = usePathname(); const router = useRouter();
  const [user, setUser] = useState<any>(null); const [open, setOpen] = useState(false);
  useEffect(() => {
    const t = getToken(); const u = getUser();
    if (!t || !u) { router.push('/login'); return; }
    if (u.role !== 'dgms') { router.push('/login'); return; }
    setUser(u);
  }, []);
  function logout() { localStorage.clear(); router.push('/login'); }
  return (
    <div className="min-h-screen flex bg-slate-100">
      {/* Sidebar */}
      <aside className={`fixed md:static z-40 h-screen w-[248px] shrink-0 flex flex-col text-white transition-transform ${open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
        style={{ background: 'linear-gradient(180deg,#050b1a 0%,#0a1836 60%,#0b2247 100%)' }}>
        <div className="p-5 flex items-center gap-2.5">
          <Image src="/assets/minenetr-mark.svg" alt="MineNetr" width={40} height={40} className="rounded-xl" />
          <div><div className="text-xl font-extrabold">Mine<span className="text-cyan-400">Netr</span></div>
          <div className="text-[10px] text-slate-400">Safer Mines. Smarter Governance.</div></div>
          <button className="md:hidden ml-auto" onClick={() => setOpen(false)}><X size={18}/></button>
        </div>
        <nav className="px-3 space-y-1 overflow-y-auto flex-1">
          {NAV.map(n => { const Icon = n.icon; const active = path === n.href;
            return (<Link key={n.href} href={n.href} onClick={() => setOpen(false)}
              className={`navlink ${active ? 'navlink-active' : ''}`}><Icon size={18}/>{n.label}</Link>); })}
        </nav>
        <div className="p-3"><div className="rounded-xl bg-white/5 border border-white/10 p-3 text-xs">
          <div className="font-bold">Need Help?</div><div className="text-slate-400">Contact MineNetr Support</div></div></div>
      </aside>
      {/* Main */}
      <div className="flex-1 min-w-0">
        <header className="bg-white border-b px-4 py-2.5 flex items-center gap-3 sticky top-0 z-30">
          <button className="md:hidden" onClick={() => setOpen(true)}><Menu size={20}/></button>
          <div className="text-sm"><div className="font-extrabold text-navy">Directorate General of Mines Safety (DGMS)</div>
          <div className="text-[11px] text-slate-500">Ministry of Labour &amp; Employment · Government of India</div></div>
          <div className="ml-auto flex items-center gap-3">
            <Link href="/dgms/notifications" className="relative w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center"><Bell size={18}/><span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-[18px] h-[18px] rounded-full flex items-center justify-center font-bold">3</span></Link>
            <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">{user?.name?.split(' ').map((x:string)=>x[0]).join('').slice(0,2) || 'AV'}</div>
            <div className="hidden sm:block"><div className="text-sm font-bold text-navy">{user?.name || 'Amit Verma'}</div>
            <div className="text-[11px] text-slate-500">{user?.title || 'Main Administrator (DGMS)'}</div></div>
            <button onClick={logout} title="Logout" className="text-slate-400 hover:text-red-600"><LogOut size={18}/></button>
          </div>
        </header>
        {/* Banner */}
        <div className="m-4 rounded-2xl overflow-hidden relative">
          <div className="absolute inset-0" style={{ background: 'linear-gradient(100deg,#e8f0fe 0%,#cfdef8 38%,#3a2c1c 38%,#1c130a 70%,#0a0703 100%)' }} />
          {/* stylised opencast-mine terraces + haul road, pure CSS so no external image is required */}
          <svg className="absolute inset-y-0 right-0 h-full w-[62%] opacity-90" viewBox="0 0 600 200" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
            <defs>
              <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#f7b267"/><stop offset="0.55" stopColor="#e88f4a"/><stop offset="1" stopColor="#5a3a22"/>
              </linearGradient>
              <linearGradient id="bench" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#6b5236"/><stop offset="1" stopColor="#241a10"/>
              </linearGradient>
            </defs>
            <rect width="600" height="200" fill="url(#sky)"/>
            <circle cx="470" cy="52" r="26" fill="#ffe3a3" opacity="0.9"/>
            <g fill="url(#bench)">
              <path d="M180 200 L260 120 L600 120 L600 200 Z"/>
              <path d="M120 200 L210 150 L600 150 L600 200 Z" opacity="0.85"/>
              <path d="M60 200 L160 175 L600 175 L600 200 Z" opacity="0.9"/>
            </g>
            <g stroke="#0e0a05" strokeWidth="3" opacity="0.7">
              <line x1="230" y1="140" x2="420" y2="140"/><line x1="180" y1="165" x2="480" y2="165"/>
            </g>
            {/* haul trucks */}
            <g>
              <rect x="330" y="118" width="46" height="16" rx="2" fill="#14100a"/>
              <rect x="338" y="106" width="20" height="12" rx="2" fill="#1f1811"/>
              <circle cx="340" cy="136" r="5" fill="#0a0a0a"/><circle cx="366" cy="136" r="5" fill="#0a0a0a"/>
              <rect x="440" y="143" width="52" height="18" rx="2" fill="#14100a"/>
              <rect x="449" y="130" width="22" height="13" rx="2" fill="#1f1811"/>
              <circle cx="451" cy="163" r="5.5" fill="#0a0a0a"/><circle cx="480" cy="163" r="5.5" fill="#0a0a0a"/>
            </g>
          </svg>
          <div className="absolute inset-0" style={{ background: 'linear-gradient(100deg,rgba(232,240,254,0.95) 0%,rgba(207,222,248,0.75) 30%,rgba(10,7,3,0) 55%)' }} />
          <div className="relative p-6 md:p-7 max-w-2xl">
            <h1 className="text-2xl md:text-[32px] font-extrabold text-indigo-900">{title}</h1>
            {subtitle && <p className="text-indigo-700 text-sm mt-1">{subtitle}</p>}
          </div>
          <div className="absolute right-4 top-4 hidden lg:block bg-[#0a1128]/90 rounded-xl px-5 py-4 text-[12px] max-w-[240px] text-white">“Towards safer mines and a more compliant, transparent mining ecosystem.”</div>
        </div>
        <main className="px-4 pb-10 -mt-1">{children}</main>
      </div>
    </div>
  );
}
