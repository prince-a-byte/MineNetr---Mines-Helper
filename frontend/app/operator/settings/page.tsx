'use client';
/** Page 11 — Settings. Nine working sections: profile, security (demo password), notifications, user management, mine details, display prefs, integrations (adapter info), data & privacy (reset/export), and the full audit log. */
import { useMemo, useState } from 'react';
import { AlertOctagon, Bell, Building2, Database, Eye, EyeOff, FileText, KeyRound, Monitor, Moon, Palette, Plug, Save, Shield, Trash2, User, Users } from 'lucide-react';
import OperationsShell from '../../../components/operations/OperationsShell';
import { operatorNav } from '../nav';
import { ConfirmDialog, DetailDrawer, EmptyState, Field, KpiCard, Kv, Modal, OpsBanner, SectionCard, SimulatedNote, StatusPill, Toasts } from '../../../components/operations/ui';
import { TODAY, usePageReady } from '../../../components/operations/hooks';
import { actions, useMockOps } from '../../../lib/ops/store';
import { fmtDate, num } from '../../../lib/ops/format';
import { exportCsv } from '../../../lib/ops/export';
import { DateFormatSetting, NumberFormatSetting, ThemeSetting, TimeFormatSetting } from '../../../lib/ops/types';

const MENU = [
  { key: 'Profile & Account', icon: <User size={16} /> },
  { key: 'Security', icon: <KeyRound size={16} /> },
  { key: 'Notifications', icon: <Bell size={16} /> },
  { key: 'User Management', icon: <Users size={16} /> },
  { key: 'Mine Details', icon: <Building2 size={16} /> },
  { key: 'System Preferences', icon: <Palette size={16} /> },
  { key: 'Integrations', icon: <Plug size={16} /> },
  { key: 'Data & Privacy', icon: <Database size={16} /> },
  { key: 'Audit Logs', icon: <FileText size={16} /> },
];

export default function SettingsPage() {
  const ready = usePageReady();
  const db = useMockOps();
  const [section, setSection] = useState(MENU[0].key);
  const [resetOpen, setResetOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <OperationsShell nav={operatorNav} title="Settings" sub="Profile, security and preferences">
      <OpsBanner title="Settings" sub="Manage your profile preferences, security, notifications, and system configurations." />
      <div className="px-4 space-y-4">
        {!ready ? (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4"><div className="card animate-pulse h-96" /><div className="lg:col-span-3 card animate-pulse h-96" /></div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* ---- Settings Menu ---- */}
            <SectionCard className="!p-0" title="" action={null}>
              <div className="p-3">
                <div className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-2 px-2">Settings Menu</div>
                {MENU.map((m) => (
                  <button key={m.key} onClick={() => setSection(m.key)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-semibold transition-colors ${section === m.key ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                    <span className={section === m.key ? 'text-blue-600' : 'text-slate-400'}>{m.icon}</span>
                    {m.key}
                  </button>
                ))}
              </div>
            </SectionCard>

            {/* ---- Section Content ---- */}
            <div className="lg:col-span-3 space-y-4">
              {section === 'Profile & Account' && <ProfileSection />}
              {section === 'Security' && <SecuritySection />}
              {section === 'Notifications' && <NotificationsSection />}
              {section === 'User Management' && <UserMgmtSection />}
              {section === 'Mine Details' && <MineDetailsSection />}
              {section === 'System Preferences' && <DisplaySection />}
              {section === 'Integrations' && <IntegrationsSection />}
              {section === 'Data & Privacy' && <DataSection onReset={() => setResetOpen(true)} onDelete={() => setDeleteOpen(true)} />}
              {section === 'Audit Logs' && <AuditSection />}
            </div>
          </div>
        )}
      </div>
      {resetOpen && <ConfirmDialog title="Reset demo data?" body="All changes made in this session will be discarded and the synthetic seed data restored. This cannot be undone." confirmLabel="Reset Demo Data" onConfirm={() => { actions.resetDemo(); setResetOpen(false); }} onCancel={() => setResetOpen(false)} />}
      {deleteOpen && <ConfirmDialog title="Delete account (demo)?" body="This is a simulated action — no account or data is actually deleted. The demo session continues normally." confirmLabel="Simulate Delete" onConfirm={() => { actions.updateProfile({}); setDeleteOpen(false); }} onCancel={() => setDeleteOpen(false)} />}
      <Toasts />
    </OperationsShell>
  );
}

/* ---------- Profile & Account ---------- */
function ProfileSection() {
  const db = useMockOps();
  const u = db.user;
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({ name: u.name, email: u.email, phone: u.phone, department: u.department, language: u.language });
  const [err, setErr] = useState<Record<string, string>>({});
  return (
    <>
      <SectionCard title="Profile Information" action={!edit && <button className="btn-primary !py-2 !text-xs" onClick={() => setEdit(true)}>Edit Profile</button>}>
        <div className="flex flex-col sm:flex-row gap-6">
          <div className="flex flex-col items-center gap-2">
            <div className="w-20 h-20 rounded-full bg-blue-600 text-white flex items-center justify-center text-2xl font-extrabold">{u.name.split(' ').map((x) => x[0]).join('').slice(0, 2)}</div>
            <div className="text-[13px] font-bold text-navy">{u.name}</div>
            <div className="text-[12px] text-slate-500">{u.role}</div>
            <div className="text-[11px] text-slate-400">Employee ID: {u.employeeId}</div>
          </div>
          <div className="flex-1">
            {edit ? (
              <>
                {err.form && <div className="text-[12px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-2" role="alert">{err.form}</div>}
                <div className="grid sm:grid-cols-2 gap-x-3">
                  <Field label="Full Name" error={err.name}><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
                  <Field label="Email Address" error={err.email}><input className="input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
                  <Field label="Phone Number"><input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
                  <Field label="Department"><select className="input" value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })}>{['Operations', 'Safety', 'Maintenance', 'Finance'].map((d) => <option key={d}>{d}</option>)}</select></Field>
                  <Field label="Language"><select className="input" value={f.language} onChange={(e) => setF({ ...f, language: e.target.value })}>{['English', 'Hindi'].map((l) => <option key={l}>{l}</option>)}</select></Field>
                </div>
                <div className="flex gap-2 mt-3">
                  <button className="btn-primary !py-2 !text-xs !bg-white !text-navy border border-slate-300" onClick={() => { setEdit(false); setF({ name: u.name, email: u.email, phone: u.phone, department: u.department, language: u.language }); }}>Cancel</button>
                  <button className="btn-primary !py-2 !text-xs" onClick={() => {
                    const e: Record<string, string> = {};
                    if (!f.name.trim()) e.name = 'Name is required.';
                    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = 'Enter a valid email.';
                    setErr(e);
                    if (Object.keys(e).length) return;
                    try { actions.updateProfile(f); setEdit(false); } catch (ex: any) { setErr({ form: ex.message }); }
                  }}>Save Profile</button>
                </div>
              </>
            ) : (
              <div className="space-y-2 text-[13px]">
                <div className="flex justify-between border-b border-slate-50 pb-1.5"><span className="text-slate-500">Full Name</span><span className="font-bold text-navy">{u.name}</span></div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5"><span className="text-slate-500">Email Address</span><span className="font-bold text-navy">{u.email}</span></div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5"><span className="text-slate-500">Phone Number</span><span className="font-bold text-navy">{u.phone}</span></div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5"><span className="text-slate-500">Department</span><span className="font-bold text-navy">{u.department}</span></div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5"><span className="text-slate-500">Language</span><span className="font-bold text-navy">{u.language}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Mine Permissions</span><span className="font-bold text-navy">{u.minePermissions.length === db.mines.length ? 'All Mines' : u.minePermissions.join(', ')}</span></div>
              </div>
            )}
          </div>
        </div>
      </SectionCard>
      <ChangePasswordCard />
    </>
  );
}

/* ---------- Security ---------- */
function SecuritySection() {
  const db = useMockOps();
  return (
    <>
      <ChangePasswordCard />
      <SectionCard title="Active Sessions" subtitle="Manage your active login sessions">
        <div className="space-y-3">
          {db.user.sessions.map((s) => (
            <div key={s.id} className={`flex items-center gap-3 rounded-xl p-3 border ${s.current ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-100'}`}>
              <span className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${s.current ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-500'}`}><Monitor size={18} /></span>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-navy text-[13px]">{s.device} • {s.browser} {s.current && <span className="badge bg-green-100 text-green-700 ml-1">Current Session</span>}</div>
                <div className="text-[12px] text-slate-500">{s.location} • Last active {fmtDate(s.lastActive.slice(0, 10))} {s.lastActive.slice(11, 16)}</div>
              </div>
              {!s.current && <button className="btn-primary !py-1.5 !text-xs !bg-white !text-red-500 border border-red-300" onClick={() => actions.revokeSession(s.id)}>Logout</button>}
            </div>
          ))}
        </div>
        <SimulatedNote>Session management is simulated — this demo has no real authentication backend.</SimulatedNote>
      </SectionCard>
    </>
  );
}

function ChangePasswordCard() {
  const [f, setF] = useState({ current: '', next: '', confirm: '' });
  const [show, setShow] = useState(false);
  const [err, setErr] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const checks = [
    { label: 'At least 8 characters', ok: f.next.length >= 8 },
    { label: 'One uppercase letter', ok: /[A-Z]/.test(f.next) },
    { label: 'One lowercase letter', ok: /[a-z]/.test(f.next) },
    { label: 'One number', ok: /\d/.test(f.next) },
    { label: 'One special character (@ # $ % etc.)', ok: /[@#$%^&*!]/.test(f.next) },
  ];
  return (
    <SectionCard title="Change Password" subtitle="Demo account: operator@minenetr.in / operate123">
      {err.form && <div className="text-[12px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-2" role="alert">{err.form}</div>}
      {done && <div className="text-[12px] font-semibold text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-2" role="status">Demo password verified (simulation only — nothing was stored).</div>}
      <div className="grid sm:grid-cols-3 gap-x-3">
        <Field label="Current Password" error={err.current}>
          <div className="relative"><input type={show ? 'text' : 'password'} className="input pr-9" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} /><button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? <EyeOff size={15} /> : <Eye size={15} />}</button></div>
        </Field>
        <Field label="New Password" error={err.next}><input type={show ? 'text' : 'password'} className="input" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} /></Field>
        <Field label="Confirm New Password" error={err.confirm}><input type={show ? 'text' : 'password'} className="input" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} /></Field>
      </div>
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-3">
        <div className="text-[12px] font-extrabold text-blue-700 mb-1.5">Password Requirements</div>
        {checks.map((c) => (
          <div key={c.label} className={`text-[12px] flex items-center gap-1.5 ${c.ok ? 'text-green-600' : 'text-slate-500'}`}>
            <span>{c.ok ? '✓' : '○'}</span> {c.label}
          </div>
        ))}
      </div>
      <button className="btn-primary !py-2" onClick={() => {
        const e: Record<string, string> = {};
        if (!f.current) e.current = 'Enter your current password.';
        if (!checks.every((c) => c.ok)) e.next = 'New password does not meet all requirements.';
        if (f.next !== f.confirm) e.confirm = 'Passwords do not match.';
        setErr(e);
        if (Object.keys(e).length) return;
        try { actions.changeDemoPassword(f.current, f.next, f.confirm); setDone(true); setF({ current: '', next: '', confirm: '' }); } catch (ex: any) { setErr({ form: ex.message }); }
      }}>Update Password</button>
      <SimulatedNote>Password change is simulated for the demo account — no credential is stored or transmitted.</SimulatedNote>
    </SectionCard>
  );
}

/* ---------- Notifications ---------- */
function NotificationsSection() {
  const db = useMockOps();
  const prefs = db.settings.notifications;
  const rows: { key: keyof typeof prefs; label: string; sub: string; color: string }[] = [
    { key: 'attendance', label: 'Attendance Alerts', sub: 'Worker entry/exit notifications', color: 'bg-blue-100 text-blue-600' },
    { key: 'inspection', label: 'Inspection Notifications', sub: 'Upcoming and completed inspections', color: 'bg-green-100 text-green-600' },
    { key: 'compliance', label: 'Compliance Alerts', sub: 'Document expiry and compliance updates', color: 'bg-amber-100 text-amber-600' },
    { key: 'bills', label: 'Bill & Payment Updates', sub: 'Approval, payment and transaction alerts', color: 'bg-purple-100 text-purple-600' },
    { key: 'production', label: 'Production Alerts', sub: 'Production targets and dispatch updates', color: 'bg-blue-100 text-blue-600' },
    { key: 'system', label: 'System Announcements', sub: 'Important updates from administration', color: 'bg-slate-100 text-slate-500' },
    { key: 'email', label: 'Email Notifications', sub: 'Receive all notifications via email', color: 'bg-blue-100 text-blue-600' },
    { key: 'sms', label: 'SMS Notifications', sub: 'Receive critical alerts via SMS', color: 'bg-red-100 text-red-500' },
  ];
  return (
    <SectionCard title="Notification Preferences" subtitle="Choose what notifications you want to receive.">
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0">
            <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${r.color}`}><Bell size={16} /></span>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-navy text-[13px]">{r.label}</div>
              <div className="text-[12px] text-slate-400">{r.sub}</div>
            </div>
            <button role="switch" aria-checked={prefs[r.key]} aria-label={r.label}
              onClick={() => actions.updateNotificationPrefs({ [r.key]: !prefs[r.key] })}
              className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${prefs[r.key] ? 'bg-blue-600' : 'bg-slate-300'}`}>
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${prefs[r.key] ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

/* ---------- User Management ---------- */
function UserMgmtSection() {
  const db = useMockOps();
  const u = db.user;
  return (
    <SectionCard title="User Management" subtitle="Your account and access scope (single-user demo)">
      <div className="grid sm:grid-cols-3 gap-3 mb-4">
        <KpiCard icon={<Users size={20} />} label="Your Role" value={u.role} tileClass="bg-blue-50 text-blue-600" />
        <KpiCard icon={<Building2 size={20} />} label="Mine Access" value={u.minePermissions.length === db.mines.length ? 'All Mines' : `${u.minePermissions.length} Mines`} tileClass="bg-green-50 text-green-600" />
        <KpiCard icon={<Shield size={20} />} label="Employee ID" value={u.employeeId} tileClass="bg-purple-50 text-purple-600" />
      </div>
      <div className="text-[13px] font-bold text-navy mb-2">Accessible Mines</div>
      <div className="flex flex-wrap gap-2 mb-4">
        {db.mines.map((m) => (
          <span key={m.id} className={`badge ${u.minePermissions.includes(m.id) ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>{m.code} — {m.name}</span>
        ))}
      </div>
      <SimulatedNote>This demo portal has a single operator account. Multi-user management requires the FastAPI backend.</SimulatedNote>
    </SectionCard>
  );
}

/* ---------- Mine Details ---------- */
function MineDetailsSection() {
  const db = useMockOps();
  return (
    <SectionCard title="Mine Details" subtitle="Information about mines in your scope">
      <div className="grid sm:grid-cols-2 gap-3">
        {db.mines.map((m) => (
          <div key={m.id} className="border border-slate-100 rounded-xl p-3.5 hover:border-blue-200 transition-colors">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[11px]">{m.code.slice(-2)}</span>
              <div>
                <div className="font-bold text-navy text-[13px]">{m.name}</div>
                <div className="text-[11px] text-slate-400 font-mono">{m.code}</div>
              </div>
              <span className={`badge ml-auto ${m.status === 'Active' ? 'bg-green-100 text-green-700' : m.status === 'Maintenance' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>● {m.status}</span>
            </div>
            <div className="text-[12px] text-slate-600 space-y-1">
              <div>Location: {m.location.area} ({m.state}, {m.district})</div>
              <div>Operator: {m.operator}</div>
              <div>Capacity: {num(m.capacityMtYr)} MT/yr</div>
              <div>Contact: {m.contactName} • {m.contactPhone}</div>
              <div>Workers: {db.workers.filter((w) => w.mineId === m.id).length} • Contractors: {db.contractors.filter((c) => c.mineIds.includes(m.id)).length}</div>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

/* ---------- System Preferences ---------- */
function DisplaySection() {
  const db = useMockOps();
  const d = db.settings.display;
  return (
    <SectionCard title="Display & Preferences" subtitle="Customize your dashboard and display settings.">
      <div className="space-y-1">
        {[
          { icon: <Palette size={16} />, label: 'Theme', value: d.theme, options: Object.values(ThemeSetting), onChange: (v: string) => actions.updateDisplayPrefs({ theme: v as never }) },
          { icon: <FileText size={16} />, label: 'Date Format', value: d.dateFormat, options: Object.values(DateFormatSetting), onChange: (v: string) => actions.updateDisplayPrefs({ dateFormat: v as never }) },
          { icon: <Monitor size={16} />, label: 'Time Format', value: d.timeFormat, options: Object.values(TimeFormatSetting), onChange: (v: string) => actions.updateDisplayPrefs({ timeFormat: v as never }) },
          { icon: <Database size={16} />, label: 'Number Format', value: d.numberFormat, options: Object.values(NumberFormatSetting), onChange: (v: string) => actions.updateDisplayPrefs({ numberFormat: v as never }) },
        ].map((r) => (
          <div key={r.label} className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0">
            <span className="w-9 h-9 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">{r.icon}</span>
            <div className="flex-1 font-bold text-navy text-[13px]">{r.label}</div>
            <select className="input !w-64 !py-1.5 !text-[13px]" value={r.value} onChange={(e) => r.onChange(e.target.value)} aria-label={r.label}>
              {r.options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        ))}
        <div className="flex items-center gap-3 py-2.5 border-b border-slate-50">
          <span className="w-9 h-9 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0"><FileText size={16} /></span>
          <div className="flex-1 font-bold text-navy text-[13px]">Items per Page</div>
          <select className="input !w-64 !py-1.5 !text-[13px]" value={String(d.itemsPerPage)} onChange={(e) => actions.updateDisplayPrefs({ itemsPerPage: Number(e.target.value) })} aria-label="Items per Page">
            {[10, 15, 25, 50].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-3 py-2.5">
          <span className="w-9 h-9 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0"><Building2 size={16} /></span>
          <div className="flex-1 font-bold text-navy text-[13px]">Default Mine</div>
          <select className="input !w-64 !py-1.5 !text-[13px]" value={d.defaultMineId} onChange={(e) => actions.updateDisplayPrefs({ defaultMineId: e.target.value })} aria-label="Default Mine">
            <option value="ALL">All Mines</option>
            {db.mines.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.code})</option>)}
          </select>
        </div>
      </div>
      <SimulatedNote>Display preferences persist for this session only (localStorage-backed mock store).</SimulatedNote>
    </SectionCard>
  );
}

/* ---------- Integrations ---------- */
function IntegrationsSection() {
  const mode = process.env.NEXT_PUBLIC_OPS_DATA_MODE ?? 'mock';
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? '(not set)';
  return (
    <SectionCard title="Integrations" subtitle="Backend adapter status and endpoint map">
      <div className="grid sm:grid-cols-2 gap-3 mb-4">
        <div className="border border-slate-100 rounded-xl p-3.5">
          <div className="text-[11px] font-extrabold text-slate-400 uppercase mb-1">Data Mode</div>
          <div className={`badge ${mode === 'http' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{mode === 'http' ? 'HTTP (FastAPI)' : 'Mock (Synthetic)'}</div>
          <div className="text-[12px] text-slate-500 mt-1.5">Set <code className="bg-slate-100 px-1 rounded">NEXT_PUBLIC_OPS_DATA_MODE=http</code> to switch.</div>
        </div>
        <div className="border border-slate-100 rounded-xl p-3.5">
          <div className="text-[11px] font-extrabold text-slate-400 uppercase mb-1">API Base URL</div>
          <div className="font-mono text-[12px] text-navy">{base}</div>
          <div className="text-[12px] text-slate-500 mt-1.5">From <code className="bg-slate-100 px-1 rounded">NEXT_PUBLIC_API_BASE_URL</code></div>
        </div>
      </div>
      <div className="text-[13px] font-bold text-navy mb-2">Endpoint Map (HTTP mode)</div>
      <div className="text-[12px] bg-slate-50 rounded-xl p-3 font-mono space-y-0.5 border border-slate-100 max-h-72 overflow-auto">
        {[
          'GET    /api/ops/mines', 'GET    /api/ops/workers', 'POST   /api/ops/workers',
          'GET    /api/ops/contractors', 'POST   /api/ops/contractors', 'PATCH  /api/ops/contractors/{id}',
          'GET    /api/ops/work-orders', 'POST   /api/ops/work-orders', 'PATCH  /api/ops/work-orders/{id}',
          'GET    /api/ops/attendance', 'POST   /api/ops/attendance/check-in', 'POST   /api/ops/attendance/check-out',
          'GET    /api/ops/access', 'POST   /api/ops/access/revoke', 'POST   /api/ops/access/grant',
          'GET    /api/ops/production', 'POST   /api/ops/production',
          'GET    /api/ops/dispatches', 'POST   /api/ops/dispatches', 'PATCH  /api/ops/dispatches/{id}/status',
          'GET    /api/ops/stockpiles', 'POST   /api/ops/stockpiles', 'POST   /api/ops/stockpiles/transfer', 'POST   /api/ops/stockpiles/reconcile',
          'GET    /api/ops/bills', 'POST   /api/ops/bills', 'POST   /api/ops/bills/{id}/approve', 'POST   /api/ops/bills/{id}/reject', 'POST   /api/ops/bills/{id}/payment',
          'GET    /api/ops/documents', 'POST   /api/ops/documents', 'POST   /api/ops/documents/{id}/submit', 'POST   /api/ops/documents/{id}/approve', 'POST   /api/ops/documents/{id}/reject',
          'GET    /api/ops/inspections', 'POST   /api/ops/inspections', 'POST   /api/ops/inspections/{id}/start', 'POST   /api/ops/inspections/{id}/complete',
          'GET    /api/ops/findings', 'POST   /api/ops/findings', 'POST   /api/ops/findings/{id}/action',
          'GET    /api/ops/corrective-actions', 'PATCH  /api/ops/corrective-actions/{id}',
          'GET    /api/ops/reports', 'POST   /api/ops/reports', 'DELETE /api/ops/reports/{id}',
          'GET    /api/ops/audit', 'GET    /api/ops/notifications', 'GET    /api/ops/settings', 'PATCH  /api/ops/settings',
          'PATCH  /api/ops/profile', 'POST   /api/ops/password', 'GET    /api/ops/sessions', 'DELETE /api/ops/sessions/{id}',
        ].map((e) => <div key={e} className="text-slate-600">{e} <span className="text-amber-500">{'// TODO: confirm with backend'}</span></div>)}
      </div>
      <SimulatedNote>All endpoints above are placeholders — the portal currently runs on the in-memory mock repository. When HTTP mode is enabled, failures surface as errors (no silent mock fallback).</SimulatedNote>
    </SectionCard>
  );
}

/* ---------- Data & Privacy ---------- */
function DataSection({ onReset, onDelete }: { onReset: () => void; onDelete: () => void }) {
  const db = useMockOps();
  const counts = [
    { label: 'Workers', value: db.workers.length }, { label: 'Contractors', value: db.contractors.length },
    { label: 'Attendance Records', value: db.attendance.length }, { label: 'Dispatches', value: db.dispatches.length },
    { label: 'Bills', value: db.bills.length }, { label: 'Documents', value: db.documents.length },
    { label: 'Inspections', value: db.inspections.length }, { label: 'Audit Entries', value: db.audit.length },
  ];
  return (
    <>
      <SectionCard title="Data & Privacy" subtitle="Overview of synthetic demo records in this session">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {counts.map((c) => (
            <div key={c.label} className="bg-slate-50 rounded-xl p-3 text-center">
              <div className="text-[18px] font-extrabold text-navy">{num(c.value)}</div>
              <div className="text-[11px] text-slate-500">{c.label}</div>
            </div>
          ))}
        </div>
        <button className="btn-primary !py-2 !text-xs" onClick={() => exportCsv(`ops-data-export-${TODAY}`, db.workers, [['ID', (w: { code: string }) => w.code], ['Name', (w: { name: string }) => w.name]])}>Export Worker Data (CSV)</button>
        <SimulatedNote>All data is synthetic and generated in-browser. Nothing is transmitted to any server.</SimulatedNote>
      </SectionCard>
      <SectionCard title="Danger Zone" subtitle="These actions are irreversible. Please proceed with caution.">
        <div className="border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <span className="w-10 h-10 rounded-lg bg-red-50 text-red-500 flex items-center justify-center shrink-0"><Trash2 size={18} /></span>
          <div className="flex-1">
            <div className="font-bold text-navy text-[13px]">Reset Demo Data</div>
            <div className="text-[12px] text-slate-500">Restore the original synthetic seed and discard session changes.</div>
          </div>
          <button className="btn-primary !py-2 !text-xs !bg-white !text-red-500 border border-red-300" onClick={onReset}>Reset Demo Data</button>
        </div>
        <div className="border border-red-200 rounded-xl p-4 flex items-center gap-3 mt-3">
          <span className="w-10 h-10 rounded-lg bg-red-50 text-red-500 flex items-center justify-center shrink-0"><AlertOctagon size={18} /></span>
          <div className="flex-1">
            <div className="font-bold text-navy text-[13px]">Delete Account (simulated)</div>
            <div className="text-[12px] text-slate-500">Simulated only — no account or data is actually deleted.</div>
          </div>
          <button className="btn-primary !py-2 !text-xs !bg-white !text-red-500 border border-red-300" onClick={onDelete}>Delete Account</button>
        </div>
      </SectionCard>
    </>
  );
}

/* ---------- Audit Logs ---------- */
function AuditSection() {
  const db = useMockOps();
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return db.audit.filter((a) => !term || `${a.action} ${a.module} ${a.details} ${a.resource}`.toLowerCase().includes(term));
  }, [db.audit, q]);
  return (
    <SectionCard title={`Audit Logs (${filtered.length})`} subtitle="Append-only record of every action in this session" action={
      <div className="flex gap-2 items-center">
        <input className="input !w-52 !py-2 !text-[13px]" placeholder="Search audit log..." value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn-primary !py-2" onClick={() => exportCsv(`audit-${TODAY}`, filtered, [['Time', (a: { timestamp: string }) => a.timestamp], ['Module', (a: { module: string }) => a.module], ['Action', (a: { action: string }) => a.action], ['Resource', (a: { resource: string }) => a.resource], ['Details', (a: { details: string }) => a.details]])}>Export</button>
      </div>}>
      {filtered.length === 0 ? <EmptyState title="No audit entries" /> : (
        <div className="space-y-1.5">
          {filtered.map((a) => (
            <div key={a.id} className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0">
              <span className="text-[12px] text-slate-400 w-32 shrink-0">{fmtDate(a.timestamp.slice(0, 10))} {a.timestamp.slice(11, 16)}</span>
              <span className="badge bg-slate-100 text-slate-600 shrink-0">{a.module}</span>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-navy text-[13px]">{a.action} <span className="font-mono text-[11px] text-slate-400">{a.resource}</span></div>
                <div className="text-[12px] text-slate-500">{a.details}</div>
              </div>
              <span className="text-[11px] text-slate-400 shrink-0">{a.user}</span>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
