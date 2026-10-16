/**
 * Page 11 — Settings. All tabs work against the demo store.
 * Explicitly labeled: frontend toggles here do NOT enforce backend
 * authorization; the permission matrix only gates demo UI actions.
 */
'use client';
import { useState } from 'react';
import { Settings as SettingsIcon, Users, KeyRound, ShieldCheck, Bell, Server, Archive } from 'lucide-react';
import Shell from '../../../components/Shell';
import { actions, getDb, useMockDb } from '../../../lib/dgms/mockDb';
import { downloadJSON, validateBackup } from '../../../lib/dgms/export';
import { exportCSV } from '../../../lib/dgms/export';
import { pingHttp } from '../../../lib/dgms/services';
import { UserRole } from '../../../lib/dgms/types';
import type { DgmsUser, PermissionKey, RolePermissions } from '../../../lib/dgms/types';
import { ConfirmDialog, DataTable, DemoBadge, DetailDrawer, SectionCard, Toasts, type Column } from '../../../components/dgms/ui';
import { StatusPill } from '../../../components/dgms/ui';
import type { DbState } from '../../../lib/dgms/mockDb';

const TABS = ['General', 'User Management', 'Roles & Permissions', 'Security', 'Notifications', 'System Configuration', 'Audit & Backup'] as const;
const PERM_KEYS: PermissionKey[] = ['view', 'create', 'edit', 'delete', 'approve', 'export'];

function Toggle({ on, onFlip, label }: { on: boolean; onFlip: () => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={onFlip}
      className={`w-10 h-6 rounded-full relative transition shrink-0 ${on ? 'bg-blue-600' : 'bg-slate-300'}`}>
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
    </button>
  );
}

export default function SettingsPage() {
  const db = useMockDb();
  const [tab, setTab] = useState<(typeof TABS)[number]>('General');
  const [q, setQQ] = useState(''); const [qq, setQq] = useState('');
  const [orgEdit, setOrgEdit] = useState(false);
  const [org, setOrg] = useState({ orgName: '', ministry: '', address: '', email: '', phone: '', website: '' });
  const [orgInit, setOrgInit] = useState(false);
  const [secUser, setSecUser] = useState<DgmsUser | null>(null);
  const [userForm, setUserForm] = useState({ name: '', email: '', role: UserRole.Inspector as UserRole, status: 'Active' as 'Active' | 'Inactive' });
  const [userErr, setUserErr] = useState('');
  const [confirmSec, setConfirmSec] = useState<{ key: string; label: string } | null>(null);
  const [conn, setConn] = useState<{ checked: boolean; httpOk: boolean; ms: number }>({ checked: false, httpOk: false, ms: 0 });
  const [restoreErr, setRestoreErr] = useState('');
  const [confirmRestore, setConfirmRestore] = useState<DbState | null>(null);

  const s = db.settings;
  const users = db.users.filter((u) => {
    const needle = qq.trim().toLowerCase();
    return !needle || u.name.toLowerCase().includes(needle) || u.email.toLowerCase().includes(needle) || u.role.toLowerCase().includes(needle);
  });

  const userCols: Column<DgmsUser>[] = [
    { key: 'name', header: 'Name', render: (u) => <span className="font-bold text-navy">{u.name}</span>, sortValue: (u) => u.name },
    { key: 'email', header: 'Email', render: (u) => <span className="text-[12px]">{u.email}</span>, sortValue: (u) => u.email },
    { key: 'role', header: 'Role', render: (u) => u.role, sortValue: (u) => u.role },
    { key: 'status', header: 'Status', render: (u) => <StatusPill v={u.status === 'Active' ? 'Active' : 'Inactive'} />, sortValue: (u) => u.status },
    { key: 'actions', header: 'Actions', render: (u) => <button className="text-blue-700 border border-blue-200 rounded-lg px-2.5 py-1 text-[12px] font-bold" onClick={(e) => { e.stopPropagation(); setUserForm({ name: u.name, email: u.email, role: u.role, status: u.status }); setUserErr(''); setSecUser(u); }}>Edit</button> },
  ];

  function openOrgEdit() {
    setOrg({ orgName: s.orgName, ministry: s.ministry, address: s.address, email: s.email, phone: s.phone, website: s.website });
    setOrgInit(true); setOrgEdit(true);
  }

  function submitUser() {
    setUserErr('');
    if (!userForm.name.trim() || !/.+@.+\..+/.test(userForm.email)) { setUserErr('Name and a valid email are required. No passwords are ever stored or shown.'); return; }
    try {
      if (secUser) actions.updateUser(secUser.id, { name: userForm.name.trim(), email: userForm.email.trim(), role: userForm.role, status: userForm.status });
      else actions.createUser({ name: userForm.name.trim(), email: userForm.email.trim(), role: userForm.role, status: userForm.status });
      setSecUser(null);
      setUserForm({ name: '', email: '', role: UserRole.Inspector, status: 'Active' });
    } catch (e) { setUserErr(e instanceof Error ? e.message : 'Save failed.'); }
  }

  async function checkHttp() {
    try {
      const r = await pingHttp();
      setConn({ checked: true, httpOk: r.ok, ms: r.latencyMs });
    } catch {
      setConn({ checked: true, httpOk: false, ms: 0 });
    }
  }

  function onRestoreFile(file: File) {
    setRestoreErr('');
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        const v = validateBackup(data);
        if (!v.ok) { setRestoreErr(`Invalid backup: ${v.error}`); return; }
        setConfirmRestore(data as DbState);
      } catch { setRestoreErr('File is not valid JSON.'); }
    };
    reader.readAsText(file);
  }

  const secToggle = (key: 'twoFactor' | 'lockout' | 'ipRestriction' | 'loginNotifications' | 'showMapByDefault' | 'sessionTimeoutWarning', label: string, consequential: boolean) => {
    const apply = () => actions.updateSettings({ [key]: !s[key] } as Partial<typeof s>, label);
    if (consequential && !s[key]) setConfirmSec({ key, label });
    else apply();
  };

  return (
    <Shell title="Settings" subtitle="Manage system configuration, user access, security and notification preferences.">
      <div className="flex gap-2 mb-3 flex-wrap items-center"><span className="ml-auto"><DemoBadge /></span></div>

      <div className="flex gap-2 mb-3 flex-wrap">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-xl px-4 py-2 text-[13px] font-bold flex items-center gap-1.5 ${tab === t ? 'bg-blue-600 text-white' : 'bg-white border'}`}>
            {t === 'General' && <SettingsIcon size={15} />}
            {t === 'User Management' && <Users size={15} />}
            {t === 'Roles & Permissions' && <KeyRound size={15} />}
            {t === 'Security' && <ShieldCheck size={15} />}
            {t === 'Notifications' && <Bell size={15} />}
            {t === 'System Configuration' && <Server size={15} />}
            {t === 'Audit & Backup' && <Archive size={15} />}
            {t}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mb-3">
        {[
          ['Total Users', db.users.length, 'Active system users'],
          ['User Roles', db.perms.length, 'Defined roles'],
          ['Security Status', s.twoFactor ? 'Enabled' : 'Off', '2FA Active'],
          ['Alert Notifications', 'Configured', 'For critical events'],
          ['Last Backup', s.lastBackup ? s.lastBackup.slice(0, 16).replace('T', ', ') : 'Never', 'Successful'],
        ].map(([l, v, d]) => (
          <div key={l as string} className="card !p-4">
            <div className="text-[12px] text-slate-500 font-semibold">{l}</div>
            <div className="text-xl font-extrabold text-navy">{v}</div>
            <div className="text-[11px] text-slate-500">{d}</div>
          </div>
        ))}
      </div>

      {tab === 'General' && (
        <div className="grid xl:grid-cols-2 gap-3">
          <SectionCard title="Organization Details" action={
            <button className="btn-primary !py-1.5 !text-[12px]" onClick={openOrgEdit}>Edit Details</button>
          }>
            {[
              ['Organization Name', s.orgName], ['Ministry', s.ministry], ['Address', s.address],
              ['Contact Email', s.email], ['Contact Number', s.phone], ['Website', s.website],
            ].map(([k, v]) => (
              <div key={k as string} className="flex gap-2 py-1.5 border-b border-slate-100 last:border-0 text-[13px]">
                <span className="text-slate-500 w-36 shrink-0">{k}</span><span className="font-semibold text-navy">{v}</span>
              </div>
            ))}
            <p className="text-[11px] text-slate-500 mt-2">Configurable placeholder identity for the demo (not an official emblem).</p>
          </SectionCard>
          <SectionCard title="System Preferences" action={
            <button className="btn-primary !py-1.5 !text-[12px]" onClick={() => actions.updateSettings({}, 'System preferences')}>Save Changes</button>
          }>
            {(
              [
                ['Default Landing Page', 'landingPage', ['Dashboard', 'Mine Registry', 'Reports & Analytics']],
                ['Date Format', 'dateFormat', ['DD MMM YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']],
                ['Time Zone', 'timeZone', ['(GMT+05:30) India Standard Time', '(GMT+00:00) UTC']],
                ['Language', 'language', ['English', 'Hindi']],
              ] as Array<[string, 'landingPage' | 'dateFormat' | 'timeZone' | 'language', string[]]>
            ).map(([label, key, opts]) => (
              <label key={key as string} className="flex items-center gap-2 py-1.5 text-[13px]">
                <span className="text-slate-500 w-40 shrink-0">{label}</span>
                <select className="input flex-1" value={String(s[key as keyof typeof s])} onChange={(e) => actions.updateSettings({ [key]: e.target.value } as Partial<typeof s>, String(label))}>
                  {(opts as string[]).map((o) => <option key={o}>{o}</option>)}
                </select>
              </label>
            ))}
            <label className="flex items-center gap-2 py-1.5 text-[13px]">
              <span className="text-slate-500 w-40 shrink-0">Auto Logout (minutes)</span>
              <input type="number" min={5} max={120} className="input flex-1" value={s.autoLogoutMinutes}
                onChange={(e) => actions.updateSettings({ autoLogoutMinutes: Math.max(5, Number(e.target.value) || 30) }, 'Auto logout')} />
            </label>
            <div className="flex items-center gap-2 py-1.5 text-[13px]">
              <span className="text-slate-500 flex-1">Show Map View by Default</span>
              <Toggle on={s.showMapByDefault} onFlip={() => actions.updateSettings({ showMapByDefault: !s.showMapByDefault }, 'Map default')} label="Show map by default" />
            </div>
            <div className="flex items-center gap-2 py-1.5 text-[13px]">
              <span className="text-slate-500 flex-1">Session Timeout Warning</span>
              <Toggle on={s.sessionTimeoutWarning} onFlip={() => actions.updateSettings({ sessionTimeoutWarning: !s.sessionTimeoutWarning }, 'Timeout warning')} label="Session timeout warning" />
            </div>
          </SectionCard>
        </div>
      )}

      {tab === 'User Management' && (
        <SectionCard title={`DGMS Users (${users.length})`} action={
          <button className="btn-primary !py-1.5 !text-[12px]" onClick={() => { setUserForm({ name: '', email: '', role: UserRole.Inspector, status: 'Active' }); setUserErr(''); setSecUser({ id: '', name: '', email: '', role: UserRole.Inspector, status: 'Active', lastLogin: '' } as DgmsUser); }}>+ Add User</button>
        }>
          <div className="flex gap-2 mb-3 flex-wrap">
            <input className="input !w-80" placeholder="Search users…" value={q} onChange={(e) => setQQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && setQq(q)} />
            <button className="btn-primary" onClick={() => setQq(q)}>Search</button>
          </div>
          <DataTable columns={userCols} rows={users} onRowClick={(u) => { setUserForm({ name: u.name, email: u.email, role: u.role, status: u.status }); setUserErr(''); setSecUser(u); }} />
          <p className="text-[11px] text-slate-500 mt-2">Demo users only. Passwords are never stored or displayed.</p>
        </SectionCard>
      )}

      {tab === 'Roles & Permissions' && (
        <SectionCard title="Role Permissions (demo matrix)" action={<span className="text-[11px] text-slate-500 font-normal">Frontend demo only — not backend authorization</span>}>
          <div className="overflow-x-auto"><table className="dense w-full min-w-[640px]">
            <thead><tr><th>Role</th>{PERM_KEYS.map((k) => <th key={k} className="!text-center capitalize">{k}</th>)}</tr></thead>
            <tbody>{db.perms.map((r) => (
              <tr key={r.role}>
                <td className="font-bold text-navy">{r.role}</td>
                {PERM_KEYS.map((k) => (
                  <td key={k} className="!text-center">
                    <input type="checkbox" aria-label={`${r.role} ${k}`} checked={r.perms[k]}
                      onChange={() => actions.updatePermissions(r.role, { ...r.perms, [k]: !r.perms[k] })} />
                  </td>
                ))}
              </tr>
            ))}</tbody>
          </table></div>
          <p className="text-[11px] text-slate-500 mt-2">Toggling Export off for a role hides export buttons in this demo UI. Real enforcement must happen server-side.</p>
        </SectionCard>
      )}

      {tab === 'Security' && (
        <SectionCard title="Security Settings" action={<span className="text-[11px] text-slate-500 font-normal">Demo controls — do not change real server security</span>}>
          {[
            ['Two-Factor Authentication (2FA)', 'Require 2FA for all admin users', 'twoFactor', true],
            ['Login Attempt Limit', `Block account after ${s.loginAttemptLimit} failed attempts`, 'lockout', true],
            ['Session Timeout', `Automatic logout after ${s.autoLogoutMinutes} minutes of inactivity`, 'sessionTimeoutWarning', false],
            ['IP Restriction (Optional)', 'Allow login only from authorized IP ranges', 'ipRestriction', true],
            ['Login Notifications', 'Notification for new device login', 'loginNotifications', false],
          ].map(([label, sub, key, consequential]) => (
            <div key={key as string} className="flex items-center gap-3 py-2.5 border-b last:border-0">
              <div className="flex-1"><div className="text-[13px] font-bold text-navy">{label}</div><div className="text-[12px] text-slate-500">{sub}</div></div>
              <Toggle on={!!s[key as keyof typeof s]} onFlip={() => secToggle(key as 'twoFactor' | 'lockout' | 'ipRestriction' | 'loginNotifications' | 'sessionTimeoutWarning', String(label), !!consequential)} label={String(label)} />
            </div>
          ))}
          <label className="flex items-center gap-3 py-2.5 text-[13px]">
            <span className="flex-1 font-bold text-navy">Login Attempt Limit (count)</span>
            <input type="number" min={3} max={10} className="input !w-24" value={s.loginAttemptLimit}
              onChange={(e) => actions.updateSettings({ loginAttemptLimit: Math.min(10, Math.max(3, Number(e.target.value) || 5)) }, 'Login attempt limit')} />
          </label>
        </SectionCard>
      )}

      {tab === 'Notifications' && (
        <SectionCard title="Notification Preferences">
          <div className="overflow-x-auto"><table className="dense w-full min-w-[720px]">
            <thead><tr><th>Event Type</th><th>Channel</th><th>Email</th><th>In-App</th><th>SMS</th></tr></thead>
            <tbody>{Object.entries(s.notifPrefs).map(([ev, p]) => (
              <tr key={ev}>
                <td className="font-semibold">{ev}</td><td className="text-[12px]">{p.channel}</td>
                {(['email', 'inApp', 'sms'] as const).map((ch) => (
                  <td key={ch}><Toggle on={p[ch]} label={`${ev} ${ch}`}
                    onFlip={() => actions.updateSettings({ notifPrefs: { ...s.notifPrefs, [ev]: { ...p, [ch]: !p[ch] } } }, 'Notification preferences')} /></td>
                ))}
              </tr>
            ))}</tbody>
          </table></div>
          <p className="text-[11px] text-slate-500 mt-2">Demo preferences only. No email/SMS provider is connected; nothing is actually sent.</p>
        </SectionCard>
      )}

      {tab === 'System Configuration' && (
        <div className="grid xl:grid-cols-2 gap-3">
          <SectionCard title="System Information">
            {[
              ['Application Version', s.appVersion], ['Environment', s.environment],
              ['Last Updated', '28 Sep 2026'], ['Uptime', '15 days, 6 hours (demo)'],
              ['Database Status', conn.checked ? (conn.httpOk ? `Reachable (${conn.ms} ms)` : 'Unreachable') : 'Demo store (local)'],
              ['Server Status', 'Running (demo UI)'],
            ].map(([k, v]) => (
              <div key={k as string} className="flex gap-2 py-1.5 border-b border-slate-100 last:border-0 text-[13px]">
                <span className="text-slate-500 w-40 shrink-0">{k}</span><span className="font-semibold text-navy">{v}</span>
              </div>
            ))}
            <button className="btn-primary mt-3 !py-2" onClick={checkHttp}>Check Backend Connection</button>
            {conn.checked && (
              <div className={`text-[12px] mt-2 rounded-xl px-3 py-2 ${conn.httpOk ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {conn.httpOk
                  ? `Backend reachable at ${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'} (${conn.ms} ms). Portal data remains demo until HTTP adapters are implemented.`
                  : 'Backend not reachable. Portal continues in demo mode — no silent fallback is applied anywhere.'}
              </div>
            )}
          </SectionCard>
          <SectionCard title="Data Configuration">
            <div className="text-[13px] text-slate-600 space-y-1">
              <p>Mode: <b>Demonstration (mock repository)</b></p>
              <p>Records: {db.mines.length} mines · {db.inspections.length} inspections · {db.findings.length} findings · {db.workers.length} workers</p>
              <p>HTTP integration: pending endpoint confirmation (<code>lib/dgms/api.ts</code>).</p>
            </div>
          </SectionCard>
        </div>
      )}

      {tab === 'Audit & Backup' && (
        <div className="grid xl:grid-cols-2 gap-3">
          <SectionCard title="Backup & Restore">
            <p className="text-[13px] text-slate-600">Download the full demo dataset as JSON, or restore from a previously downloaded backup (validated before applying).</p>
            <div className="flex gap-2 mt-3 flex-wrap">
              <button className="btn-primary !py-2" onClick={() => downloadJSON(`minenetr-demo-backup-${Date.now()}`, getDb())}>Download Backup</button>
              <label className="btn-primary !py-2 !bg-white !text-navy border border-slate-300 cursor-pointer">Restore Backup
                <input type="file" accept="application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onRestoreFile(f); e.target.value = ''; }} />
              </label>
            </div>
            {restoreErr && <div className="text-[13px] bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 mt-3">{restoreErr}</div>}
            <p className="text-[11px] text-slate-500 mt-2">Demo backup only — never a real server backup.</p>
          </SectionCard>
          <SectionCard title="Data Export">
            <p className="text-[13px] text-slate-600">Export master data (mines, findings, workers) as CSV.</p>
            <div className="flex gap-2 mt-3 flex-wrap">
              <button className="btn-primary !py-2 !bg-white !text-navy border border-slate-300" onClick={() =>
                exportCSV('master-mines', ['Code', 'Name', 'State', 'Status'], db.mines.map((m) => [m.code, m.name, m.state, m.status]))}>Export Mines</button>
              <button className="btn-primary !py-2 !bg-white !text-navy border border-slate-300" onClick={() =>
                exportCSV('master-findings', ['ID', 'Mine', 'Severity', 'Status'], db.findings.map((f) => [f.id, f.mineId, f.severity, f.status]))}>Export Findings</button>
              <button className="btn-primary !py-2 !bg-white !text-navy border border-slate-300" onClick={() =>
                exportCSV('master-workers', ['ID', 'Name', 'Mine', 'Status'], db.workers.map((w) => [w.id, w.name, w.mineId, w.status]))}>Export Workers</button>
            </div>
          </SectionCard>
        </div>
      )}

      {orgEdit && (
        <DetailDrawer title="Edit Organization Details" onClose={() => setOrgEdit(false)}>
          {!orgInit ? null : (
            <>
              {(['orgName', 'ministry', 'address', 'email', 'phone', 'website'] as const).map((k) => (
                <label key={k} className="block text-xs font-semibold text-slate-600 mb-2 capitalize">{k.replace('orgName', 'Organization Name')}
                  <input className="input mt-1" value={org[k]} onChange={(e) => setOrg({ ...org, [k]: e.target.value })} />
                </label>
              ))}
              <button className="btn-primary w-full mt-2" onClick={() => { actions.updateSettings({ ...org }, 'Organization details'); setOrgEdit(false); }}>Save</button>
            </>
          )}
        </DetailDrawer>
      )}

      {secUser && (
        <DetailDrawer title={secUser.id ? `Edit ${secUser.name}` : 'Add User'} onClose={() => setSecUser(null)}>
          {userErr && <div className="text-[13px] bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 mb-3">{userErr}</div>}
          <label className="block text-xs font-semibold text-slate-600 mb-2">Full Name *
            <input className="input mt-1" value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} /></label>
          <label className="block text-xs font-semibold text-slate-600 mb-2">Email *
            <input className="input mt-1" value={userForm.email} disabled={!!secUser.id} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} /></label>
          <label className="block text-xs font-semibold text-slate-600 mb-2">Role
            <select className="input mt-1" value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value as UserRole })}>
              {Object.values(UserRole).map((r) => <option key={r}>{r}</option>)}
            </select></label>
          <label className="block text-xs font-semibold text-slate-600 mb-2">Status
            <select className="input mt-1" value={userForm.status} onChange={(e) => setUserForm({ ...userForm, status: e.target.value as 'Active' | 'Inactive' })}>
              <option>Active</option><option>Inactive</option>
            </select></label>
          <button className="btn-primary w-full mt-2" onClick={submitUser}>{secUser.id ? 'Save Changes' : 'Create User'}</button>
        </DetailDrawer>
      )}

      {confirmSec && (
        <ConfirmDialog title={`${confirmSec.label} — confirm?`} body="This changes demo security configuration. It does not alter any real server enforcement."
          confirmLabel="Apply" onCancel={() => setConfirmSec(null)}
          onConfirm={() => {
            const k = confirmSec.key as 'twoFactor' | 'lockout' | 'ipRestriction';
            actions.updateSettings({ [k]: !s[k] } as Partial<typeof s>, confirmSec.label);
            setConfirmSec(null);
          }} />
      )}

      {confirmRestore && (
        <ConfirmDialog title="Restore backup?" body="Current demo data will be replaced with the validated backup file. This is audited."
          confirmLabel="Restore" onCancel={() => setConfirmRestore(null)}
          onConfirm={() => { actions.restoreBackup(confirmRestore); setConfirmRestore(null); }} />
      )}
      <Toasts />
    </Shell>
  );
}




