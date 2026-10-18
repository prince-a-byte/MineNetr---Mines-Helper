/**
 * Shared operations shell: navy sidebar (11 sections), header with working
 * mine selector (permission-scoped, persisted), notification panel backed by
 * the central store, and profile menu. Responsive: sidebar becomes a drawer.
 * DEMO MODE labelling is always visible.
 */
'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Bell, ChevronDown, LogOut, Menu, Settings, User, X, CheckCheck, Building2, ChevronRight } from 'lucide-react';
import { getToken, getUser } from '../../lib/api';
import { actions, allowedMines, useMockOps, getMine } from '../../lib/ops/store';
import { NotificationStatusNew } from '../../lib/ops/types';
import { relTime } from '../../lib/ops/format';
import { DemoBadge, StatusPill } from './ui';

export interface OpsNavItem { href: string; label: string; icon: React.ComponentType<{ size?: number | string }> }

const MINE_STORE_KEY = 'minenetr_ops_mine';

/** Mine selector — lists only mines inside the demo user's permission set. */
function MineSelector() {
  const db = useMockOps();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const mines = allowedMines();
  const current = db.selectedMineId === 'ALL' ? null : getMine(db.selectedMineId);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', h); document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k); };
  }, []);

  function choose(id: string) {
    try { actions.selectMine(id); setOpen(false); } catch { /* out-of-scope mines are not listed */ }
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} aria-haspopup="listbox" aria-expanded={open}
        className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-navy bg-white hover:border-blue-300 transition max-w-[280px]">
        <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0"><Building2 size={14} /></span>
        <span className="truncate">{current ? `${current.name} (${current.code})` : 'All Mines'}</span>
        <ChevronDown size={15} className={`text-slate-400 shrink-0 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div role="listbox" className="absolute left-0 top-full mt-1 w-72 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="px-3 py-2 text-[11px] font-bold text-slate-400 uppercase tracking-wide border-b border-slate-100">Your accessible mines</div>
          <button role="option" aria-selected={db.selectedMineId === 'ALL'} onClick={() => choose('ALL')}
            className={`w-full text-left px-3 py-2.5 text-sm hover:bg-blue-50 flex items-center gap-2 ${db.selectedMineId === 'ALL' ? 'bg-blue-50 font-bold text-blue-700' : 'text-slate-700'}`}>
            <span className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-xs">🏭</span>
            <span className="flex-1">All Mines</span>
            {db.selectedMineId === 'ALL' && <CheckCheck size={14} />}
          </button>
          {mines.map((m) => (
            <button key={m.id} role="option" aria-selected={db.selectedMineId === m.id} onClick={() => choose(m.id)}
              className={`w-full text-left px-3 py-2.5 text-sm hover:bg-blue-50 flex items-center gap-2 ${db.selectedMineId === m.id ? 'bg-blue-50 font-bold text-blue-700' : 'text-slate-700'}`}>
              <span className="w-6 h-6 rounded-lg bg-amber-100 flex items-center justify-center text-xs">⛏</span>
              <span className="flex-1 min-w-0"><span className="block truncate">{m.name}</span><span className="block text-[11px] text-slate-400">{m.code} · {m.state}</span></span>
              {db.selectedMineId === m.id && <CheckCheck size={14} className="shrink-0" />}
            </button>
          ))}
          <div className="px-3 py-2 text-[10px] text-slate-400 border-t border-slate-100">Scoped to your role permissions (demo).</div>
        </div>
      )}
    </div>
  );
}

/** Notification bell + panel backed by the central store. */
function NotificationBell() {
  const db = useMockOps();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unread = db.notifications.filter((n) => n.status === NotificationStatusNew.Unread);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', h); document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k); };
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} aria-label={`Notifications (${unread.length} unread)`}
        className="relative w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-navy hover:bg-slate-200 transition">
        <Bell size={18} />
        {unread.length > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] min-w-[18px] h-[18px] px-0.5 rounded-full flex items-center justify-center font-bold">{unread.length}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-[340px] bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2">
            <span className="font-extrabold text-navy text-sm flex-1">Notifications</span>
            <button className="text-[11px] font-bold text-blue-600 hover:underline" onClick={() => actions.markAllNotificationsRead()}>Mark all read</button>
          </div>
          <div className="max-h-[360px] overflow-y-auto">
            {db.notifications.length === 0 && <div className="px-4 py-6 text-[13px] text-slate-500 text-center">No notifications.</div>}
            {db.notifications.slice(0, 8).map((n) => (
              <div key={n.id} className={`px-4 py-3 border-b border-slate-50 last:border-0 ${n.status === NotificationStatusNew.Unread ? 'bg-blue-50/40' : ''}`}>
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-bold text-navy leading-snug">{n.title}</div>
                    <div className="text-[12px] text-slate-500 mt-0.5">{n.body}</div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <StatusPill v={n.priority} />
                      <span className="text-[10px] text-slate-400">{relTime(n.timestamp)}</span>
                    </div>
                  </div>
                  {n.status === NotificationStatusNew.Unread && (
                    <button aria-label={`Mark ${n.title} read`} onClick={() => actions.markNotificationRead(n.id)}
                      className="text-[10px] font-bold text-blue-600 hover:underline shrink-0">Mark read</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Profile menu: profile → settings, logout. */
function ProfileMenu({ name, role }: { name: string; role: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initials = name.split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase();

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open} className="flex items-center gap-2 hover:opacity-80">
        <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">{initials}</div>
        <div className="hidden sm:block text-left">
          <div className="text-sm font-bold text-navy leading-tight">{name}</div>
          <div className="text-[11px] text-slate-500">{role}</div>
        </div>
        <ChevronDown size={14} className="text-slate-400 hidden sm:block" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full mt-1 w-52 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
          <Link href="/operator/settings" role="menuitem" onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-blue-50"><User size={15} /> Profile</Link>
          <Link href="/operator/settings" role="menuitem" onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-blue-50"><Settings size={15} /> Settings</Link>
          <button role="menuitem" onClick={() => { localStorage.clear(); router.push('/login'); }}
            className="w-full text-left flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 border-t border-slate-100"><LogOut size={15} /> Logout</button>
        </div>
      )}
    </div>
  );
}

export default function OperationsShell({ nav, title, sub, children }: {
  nav: OpsNavItem[]; title: string; sub: string; children: React.ReactNode;
}) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<{ name: string; title?: string; role?: string } | null>(null);
  const db = useMockOps();

  // Auth guard (real session) + restore persisted mine selection.
  useEffect(() => {
    const t = getToken(); const u = getUser();
    if (!t || !u || u.role !== 'operator') { router.push('/login'); return; }
    setUser(u);
    const saved = localStorage.getItem(MINE_STORE_KEY);
    if (saved && (saved === 'ALL' || allowedMines().some((m) => m.id === saved))) {
      try { actions.selectMine(saved); } catch { /* default stays */ }
    }
  }, []);

  // Persist mine choice across pages.
  useEffect(() => { localStorage.setItem(MINE_STORE_KEY, db.selectedMineId); }, [db.selectedMineId]);

  const selectedName = db.selectedMineId === 'ALL' ? 'All Mines' : getMine(db.selectedMineId)?.name ?? '';
  const displayName = user?.name || 'Amit Verma';

  return (
    <div className="min-h-screen flex bg-[#F4F7FB]">
      {/* Sidebar */}
      <aside className={`fixed md:static z-40 h-screen w-[248px] shrink-0 flex flex-col text-white transition-transform ${open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
        style={{ background: 'linear-gradient(180deg,#050b1a 0%,#0a1836 60%,#0B3154 100%)' }}>
        <div className="p-5 flex items-center gap-2.5">
          <Image src="/assets/minenetr-mark.svg" alt="MineNetr" width={40} height={40} className="rounded-xl" />
          <div><div className="text-xl font-extrabold">Mine<span className="text-cyan-400">Netr</span></div>
            <div className="text-[10px] text-slate-400">Safer Mines. Smarter Governance.</div></div>
          <button className="md:hidden ml-auto" aria-label="Close menu" onClick={() => setOpen(false)}><X size={18} /></button>
        </div>
        <div className="px-4 pb-2"><DemoBadge /></div>
        <nav className="px-3 space-y-1 overflow-y-auto flex-1 pb-2" aria-label="Operations sections">
          {nav.map((n) => {
            const Icon = n.icon;
            const active = n.href === '/operator' ? path === '/operator' : path.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href} onClick={() => setOpen(false)}
                aria-current={active ? 'page' : undefined}
                className={`navlink ${active ? 'navlink-active' : ''}`}><Icon size={18} />{n.label}</Link>
            );
          })}
        </nav>
        <div className="p-3">
          <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-xs flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">🎧</span>
            <span><span className="font-bold block">Need Help?</span><span className="text-slate-400">Contact MineNetr Support</span></span>
            <ChevronRight size={14} className="ml-auto text-slate-500" />
          </div>
        </div>
      </aside>
      {open && <div className="fixed inset-0 bg-navy/50 z-30 md:hidden" onClick={() => setOpen(false)} />}

      {/* Main */}
      <div className="flex-1 min-w-0">
        <header className="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center gap-3 sticky top-0 z-30">
          <button className="md:hidden" aria-label="Open menu" onClick={() => setOpen(true)}><Menu size={20} /></button>
          <MineSelector />
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden xl:block"><DemoBadge /></span>
            <NotificationBell />
            <ProfileMenu name={displayName} role={user?.title || 'Mine Operator'} />
          </div>
        </header>
        {title ? (
          <div className="px-4 pt-3 text-[12px] text-slate-500 flex items-center gap-1.5 flex-wrap">
            <span>Dashboard</span><span>›</span><span className="font-bold text-navy">{title}</span>
            {selectedName && <><span>·</span><span className="text-blue-700 font-semibold">⛏ {selectedName}</span></>}
          </div>
        ) : null}
        <main className="pb-10">{children}</main>
      </div>
    </div>
  );
}
