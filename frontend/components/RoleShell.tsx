'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Bell, LogOut, Menu, X, ChevronDown } from 'lucide-react';
import { getUser, getToken, api } from '../lib/api';

export type NavItem = { href: string; label: string; icon: any; badge?: number };
export type MineOption = { id: string; label: string };

export default function RoleShell({ role, nav, orgTitle, orgSub, banner, mineName, mineOptions, mineValue, onMineChange, profileSub, children }:
  { role: string; nav: NavItem[]; orgTitle: string; orgSub: string; banner: React.ReactNode; mineName?: string;
    mineOptions?: MineOption[]; mineValue?: string; onMineChange?: (id: string) => void; profileSub?: string; children: React.ReactNode }) {
  const path = usePathname(); const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<any[]>([]);
  const [profileOpen, setProfileOpen] = useState(false);
  useEffect(() => {
    const t = getToken(); const u = getUser();
    if (!t || !u) { router.push('/login'); return; }
    if (u.role !== role) { router.push('/login'); return; }
    setUser(u);
    api('/api/v1/notifications').then(d => setNotifs(d.items || [])).catch(() => {});
  }, []);
  useEffect(() => {
    if (!profileOpen) return;
    const close = () => setProfileOpen(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [profileOpen]);
  const initials = (user?.name || 'U').split(' ').map((x: string) => x[0]).join('').slice(0, 2).toUpperCase();
  function logout() { localStorage.clear(); router.push('/login'); }
  return (
    <div className="min-h-screen flex bg-[#f1f5f9]">
      <aside className={`fixed md:static z-40 h-screen w-[248px] shrink-0 flex flex-col text-white transition-transform ${open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
        style={{ background: 'linear-gradient(180deg,#050b1a 0%,#0a1836 60%,#0b2247 100%)' }}>
        <div className="p-5 flex items-center gap-2.5">
          <Image src="/assets/minenetr-mark.svg" alt="MineNetr" width={40} height={40} className="rounded-xl" />
          <div><div className="text-xl font-extrabold">Mine<span className="text-cyan-400">Netr</span></div>
          <div className="text-[10px] text-slate-400">Safer Mines. Smarter Governance.</div></div>
          <button className="md:hidden ml-auto" onClick={() => setOpen(false)}><X size={18} /></button>
        </div>
        <nav className="px-3 space-y-1 overflow-y-auto flex-1 pb-2">
          {nav.map(n => { const Icon = n.icon;
            // Exact match, or a child route of this item (never the portal root
            // itself, which would otherwise stay lit on every sub-page).
            const active = path === n.href || (n.href !== `/${role}` && path.startsWith(`${n.href}/`));
            return (<Link key={n.href} href={n.href} onClick={() => setOpen(false)}
              className={`navlink ${active ? 'navlink-active' : ''}`}><Icon size={18} />{n.label}
              {n.badge ? <span className="ml-auto bg-red-500 text-white text-[10px] w-[18px] h-[18px] rounded-full flex items-center justify-center font-bold">{n.badge}</span> : null}</Link>); })}
        </nav>
        <div className="p-3"><div className="rounded-xl bg-white/5 border border-white/10 p-3 text-xs">
          <div className="font-bold">Need Help?</div><div className="text-slate-400">Contact MineNetr Support</div></div></div>
      </aside>
      <div className="flex-1 min-w-0">
        <header className="bg-white border-b px-4 py-2.5 flex items-center gap-3 sticky top-0 z-30">
          <button className="md:hidden" onClick={() => setOpen(true)}><Menu size={20} /></button>
          {mineOptions
            ? <div className="relative">
                <select
                  aria-label="Select mine"
                  className="appearance-none flex items-center gap-2 border rounded-xl pl-9 pr-8 py-1.5 text-sm font-bold text-navy bg-white cursor-pointer hover:border-blue-300 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={mineValue ?? 'ALL'}
                  onChange={(e) => onMineChange?.(e.target.value)}
                  style={{ backgroundImage: 'none' }}
                >
                  {mineOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-navy pointer-events-none">⛏</span>
                <ChevronDown size={15} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            : mineName
              ? <div className="flex items-center gap-2 border rounded-xl px-3 py-1.5 text-sm font-bold text-navy">⛏ {mineName} <ChevronDown size={15} className="text-slate-400" /></div>
              : <div className="text-sm"><div className="font-extrabold text-navy">{orgTitle}</div>
                <div className="text-[11px] text-slate-500">{orgSub}</div></div>}
          <div className="ml-auto flex items-center gap-3">
            <Link href={`/${role}/notifications`} className="relative w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-navy"><Bell size={18} />
              {notifs.length ? <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-[18px] h-[18px] rounded-full flex items-center justify-center font-bold">{notifs.length}</span> : null}</Link>
            <div className="relative">
              <button onClick={(e) => { e.stopPropagation(); setProfileOpen(o => !o); }}
                className="flex items-center gap-2 rounded-xl pl-1 pr-2 py-1 hover:bg-slate-50" aria-haspopup="menu" aria-expanded={profileOpen}>
                <span className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">{initials}</span>
                <span className="hidden sm:block text-left"><span className="block text-sm font-bold text-navy">{user?.name || ''}</span>
                <span className="block text-[11px] text-slate-500">{profileSub || user?.title || orgTitle}</span></span>
                <ChevronDown size={15} className={`text-slate-400 transition ${profileOpen ? 'rotate-180' : ''}`} />
              </button>
              {profileOpen && (
                <div role="menu" className="absolute right-0 mt-2 w-52 bg-white rounded-xl border border-slate-200 shadow-xl p-1.5 z-50">
                  <div className="px-3 py-2 border-b border-slate-100 mb-1">
                    <div className="text-sm font-bold text-navy">{user?.name || ''}</div>
                    <div className="text-[11px] text-slate-500">{profileSub || user?.title || orgTitle}</div>
                  </div>
                  <Link href={`/${role}`} role="menuitem" onClick={() => setProfileOpen(false)}
                    className="block w-full text-left px-3 py-2 rounded-lg text-sm font-semibold text-navy hover:bg-slate-50">Dashboard</Link>
                  <button role="menuitem" onClick={() => { setProfileOpen(false); logout(); }}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2"><LogOut size={15} /> Logout</button>
                </div>
              )}
            </div>
          </div>
        </header>
        {banner}
        <main className="px-4 pb-10">{children}</main>
      </div>
    </div>
  );
}

export function LightBanner({ title, sub, quote }: { title: React.ReactNode; sub: string; quote?: string }) {
  return (
    <div className="m-4 rounded-2xl overflow-hidden relative">
      <div className="absolute inset-0" style={{ background: 'linear-gradient(100deg,#e8f0fe 0%,#cfdef8 38%,#3a2c1c 38%,#1c130a 70%,#0a0703 100%)' }} />
      <svg className="absolute inset-y-0 right-0 h-full w-[62%] opacity-90" viewBox="0 0 600 200" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
        <defs>
          <linearGradient id="bsky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#a9c3ea" /><stop offset="0.55" stopColor="#d9b48a" /><stop offset="1" stopColor="#5a3a22" />
          </linearGradient>
          <linearGradient id="bbench" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#6b5236" /><stop offset="1" stopColor="#241a10" />
          </linearGradient>
        </defs>
        <rect width="600" height="200" fill="url(#bsky)" />
        <circle cx="470" cy="52" r="24" fill="#fff3cf" opacity="0.95" />
        <g fill="url(#bbench)">
          <path d="M180 200 L260 120 L600 120 L600 200 Z" />
          <path d="M120 200 L210 150 L600 150 L600 200 Z" opacity="0.85" />
          <path d="M60 200 L160 175 L600 175 L600 200 Z" opacity="0.9" />
        </g>
        <g>
          <rect x="330" y="118" width="46" height="16" rx="2" fill="#14100a" />
          <rect x="338" y="106" width="20" height="12" rx="2" fill="#1f1811" />
          <circle cx="340" cy="136" r="5" fill="#0a0a0a" /><circle cx="366" cy="136" r="5" fill="#0a0a0a" />
          <rect x="440" y="143" width="52" height="18" rx="2" fill="#14100a" />
          <circle cx="451" cy="163" r="5.5" fill="#0a0a0a" /><circle cx="480" cy="163" r="5.5" fill="#0a0a0a" />
        </g>
      </svg>
      <div className="absolute inset-0" style={{ background: 'linear-gradient(100deg,rgba(232,240,254,0.95) 0%,rgba(207,222,248,0.75) 30%,rgba(10,7,3,0) 55%)' }} />
      <div className="relative p-6 md:p-7 max-w-2xl">
        <h1 className="text-2xl md:text-[30px] font-extrabold text-navy">{title}</h1>
        <p className="text-indigo-700 text-sm mt-1 font-semibold">{sub}</p>
      </div>
      <div className="absolute right-4 top-4 hidden lg:flex flex-col items-end gap-1 bg-white/95 rounded-xl px-5 py-3 text-[12px] text-navy shadow">
        <span className="font-bold">📅 Today</span><span>03 Oct 2026 · Friday</span>
      </div>
      {quote ? <div className="absolute right-4 bottom-4 hidden xl:block bg-[#0a1128]/90 rounded-xl px-5 py-3 text-[12px] max-w-[240px] text-white">{quote}</div> : null}
    </div>
  );
}

export function DarkBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="m-4 rounded-2xl overflow-hidden relative text-white">
      <div className="absolute inset-0" style={{ background: 'linear-gradient(120deg,#060d1f 20%,#1b2c52 60%,#7a4a22 100%)' }} />
      <svg className="absolute inset-0 w-full h-full opacity-40" viewBox="0 0 900 220" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <g fill="#02040a" opacity="0.55">
          <path d="M0 220 L180 110 L900 110 L900 220 Z" />
          <path d="M0 220 L120 155 L900 155 L900 220 Z" />
        </g>
        <circle cx="700" cy="45" r="22" fill="#ffca7a" opacity="0.9" />
        <g>
          <rect x="420" y="130" width="70" height="24" rx="3" fill="#0a0f1e" />
          <circle cx="435" cy="156" r="7" fill="#000" /><circle cx="475" cy="156" r="7" fill="#000" />
          <rect x="560" y="150" width="60" height="20" rx="3" fill="#0a0f1e" />
          <circle cx="572" cy="172" r="6" fill="#000" /><circle cx="606" cy="172" r="6" fill="#000" />
        </g>
      </svg>
      <div className="relative p-6 md:p-7 flex flex-wrap gap-4 items-center">{children}</div>
    </div>
  );
}
