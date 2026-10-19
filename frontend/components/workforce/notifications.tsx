'use client';
/**
 * Contractor — Notifications (page 8 of the design reference).
 *
 * Reads the centralized workforce repository only — every KPI, tab count,
 * donut slice, quick filter and list row derives from db.notifications:
 *  - KPI cards count notifications by type (Total / Action Required /
 *    Information / Completed),
 *  - the tab bar filters by read state, type or category,
 *  - clicking a row marks it read (actions.markNotificationRead) and follows
 *    its deep link (n.href already carries ?tab= params),
 *  - "Mark All Read" goes through actions.markNotificationsRead (permission
 *    notifications.manage),
 *  - the Notification Summary donut and Quick Filters both apply real
 *    filters, and the toolbar Export downloads a REAL CSV of the currently
 *    filtered rows.
 *
 * Unread rows are visually distinct (bold title + left accent + tint).
 * All data is synthetic (fixed demo clock 03 Oct 2026).
 */
import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, BadgeCheck, Bell, Check, CheckCheck, ExternalLink, FileCheck, Info,
  Receipt, ShieldCheck, Users,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ContractorShell } from './shell';
import {
  Donut, EmptyState, KpiCard, KpiGrid, PageToolbar, PermBtn, SearchInput,
  SectionCard, SoftPill,
} from './ui';
import { actions, toast, useMockWorkforce } from '../../lib/workforce/store';
import { fmtDateTime, relTime } from '../../lib/workforce/format';
import { exportCsv } from '../../lib/workforce/export';
import { CHART } from '../operations/hooks';
import { NOTIFICATION_CATEGORIES, type NotificationCategory, type NotificationType, type PortalNotification } from '../../lib/workforce/types';

// ---------- Constants ----------
const TABS = ['All', 'Unread', 'Action Required', 'Approvals', 'Worker Related', 'Bills & Payments', 'Compliance'];

const CAT_ICON: Record<NotificationCategory, React.ReactNode> = {
  Approvals: <FileCheck size={15} />,
  'Worker Related': <Users size={15} />,
  'Bills & Payments': <Receipt size={15} />,
  Compliance: <ShieldCheck size={15} />,
};

const CAT_COLOR: Record<NotificationCategory, string> = {
  Approvals: CHART.amber,
  'Worker Related': CHART.blue,
  'Bills & Payments': CHART.green,
  Compliance: CHART.purple,
};

const CAT_PILL: Record<NotificationCategory, string> = {
  Approvals: 'bg-amber-100 text-amber-700',
  'Worker Related': 'bg-sky-100 text-sky-700',
  'Bills & Payments': 'bg-emerald-100 text-emerald-700',
  Compliance: 'bg-violet-100 text-violet-700',
};

const TYPE_PILL: Record<NotificationType, string> = {
  'Action Required': 'bg-orange-100 text-orange-700',
  Information: 'bg-blue-100 text-blue-700',
  Completed: 'bg-emerald-100 text-emerald-700',
};

const TYPE_TILE: Record<NotificationType, string> = {
  'Action Required': 'bg-red-50 text-red-600',
  Information: 'bg-blue-50 text-blue-600',
  Completed: 'bg-emerald-50 text-emerald-600',
};

function msg(e: unknown): string { return e instanceof Error ? e.message : String(e); }

// ---------- Page ----------
export function ContractorNotifications() {
  const db = useMockWorkforce();
  const router = useRouter();

  const [tab, setTab] = useState('All');
  const [category, setCategory] = useState<'ALL' | NotificationCategory>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | NotificationType>('ALL');
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [err, setErr] = useState('');

  // ----- derived (all from the store, never local counters) -----
  const counts = useMemo(() => {
    const c: Record<string, number> = { All: db.notifications.length, Unread: 0 };
    for (const t of ['Action Required', 'Information', 'Completed'] as NotificationType[]) c[t] = 0;
    for (const n of NOTIFICATION_CATEGORIES) c[n] = 0;
    for (const n of db.notifications) {
      if (!n.read) c.Unread++;
      c[n.type]++;
      c[n.category]++;
    }
    return c;
  }, [db.notifications]);

  const needle = appliedQuery.trim().toLowerCase();

  const list = useMemo(() => db.notifications.filter((n) => {
    if (tab === 'Unread' && n.read) return false;
    if (tab === 'Action Required' && n.type !== 'Action Required') return false;
    if ((NOTIFICATION_CATEGORIES as readonly string[]).includes(tab) && n.category !== tab) return false;
    if (category !== 'ALL' && n.category !== category) return false;
    if (typeFilter !== 'ALL' && n.type !== typeFilter) return false;
    if (needle && !`${n.id} ${n.title} ${n.description}`.toLowerCase().includes(needle)) return false;
    return true;
  }).sort((a, b) => (a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0)),
    [db.notifications, tab, category, typeFilter, needle]);

  useEffect(() => { setPage(1); }, [tab, category, typeFilter, appliedQuery, size]);

  const pages = Math.max(1, Math.ceil(list.length / size));
  const cur = Math.min(page, pages);
  const view = list.slice((cur - 1) * size, cur * size);

  const donutData = useMemo(() => NOTIFICATION_CATEGORIES.map((c) => ({
    name: c as string, value: counts[c] ?? 0, color: CAT_COLOR[c],
  })), [counts]);

  const hasFilters = tab !== 'All' || category !== 'ALL' || typeFilter !== 'ALL' || !!appliedQuery;

  // ----- real actions -----
  function open(n: PortalNotification) {
    try { actions.markNotificationRead(n.id); } catch (e) { setErr(msg(e)); }
    router.push(n.href);
  }

  function markRead(n: PortalNotification) {
    try { actions.markNotificationRead(n.id); } catch (e) { setErr(msg(e)); }
  }

  function markAll() {
    try { actions.markNotificationsRead(); } catch (e) { setErr(msg(e)); }
  }

  function exportFiltered() {
    try {
      const n = exportCsv('minenetr-notifications', list, [
        ['Notification ID', (r: PortalNotification) => r.id],
        ['Title', (r: PortalNotification) => r.title],
        ['Description', (r: PortalNotification) => r.description],
        ['Type', (r: PortalNotification) => r.type],
        ['Category', (r: PortalNotification) => r.category],
        ['Timestamp', (r: PortalNotification) => r.timestamp],
        ['Read', (r: PortalNotification) => (r.read ? 'Yes' : 'No')],
        ['Related ID', (r: PortalNotification) => r.relatedId ?? '—'],
        ['Deep Link', (r: PortalNotification) => r.href],
      ]);
      toast(`Exported ${n} notification${n === 1 ? '' : 's'}.`);
    } catch (e) { setErr(msg(e)); }
  }

  function goTab(t: string) { setTab(t); setCategory('ALL'); setTypeFilter('ALL'); }

  function clearFilters() {
    setTab('All'); setCategory('ALL'); setTypeFilter('ALL'); setQuery(''); setAppliedQuery('');
  }

  const quickFilters: { label: string; target: string; count: number; icon: React.ReactNode; tile: string }[] = [
    { label: 'Unread', target: 'Unread', count: counts.Unread, icon: <Bell size={15} />, tile: 'bg-slate-100 text-slate-600' },
    { label: 'Action Required', target: 'Action Required', count: counts['Action Required'], icon: <AlertTriangle size={15} />, tile: 'bg-red-100 text-red-600' },
    { label: 'Information', target: 'Information', count: counts.Information, icon: <Info size={15} />, tile: 'bg-blue-100 text-blue-600' },
    { label: 'Approvals', target: 'Approvals', count: counts.Approvals, icon: <FileCheck size={15} />, tile: 'bg-amber-100 text-amber-600' },
    { label: 'Worker Related', target: 'Worker Related', count: counts['Worker Related'], icon: <Users size={15} />, tile: 'bg-sky-100 text-sky-600' },
    { label: 'Bills & Payments', target: 'Bills & Payments', count: counts['Bills & Payments'], icon: <Receipt size={15} />, tile: 'bg-emerald-100 text-emerald-600' },
    { label: 'Compliance', target: 'Compliance', count: counts.Compliance, icon: <ShieldCheck size={15} />, tile: 'bg-violet-100 text-violet-600' },
  ];

  function applyQuick(target: string) {
    if (target === 'Unread' || target === 'Action Required') { goTab(target); return; }
    if (target === 'Information') { setTab('All'); setCategory('ALL'); setTypeFilter('Information'); return; }
    goTab(target); // category tabs
  }

  function isQuickActive(target: string): boolean {
    if (target === 'Information') return typeFilter === 'Information';
    return tab === target && category === 'ALL' && typeFilter === 'ALL';
  }

  return (
    <ContractorShell
      title="Notifications"
      sub="Stay updated with important alerts, approvals and actions across your contracts, workers, bills and compliance."
    >
      <PageToolbar period="As on 03 Oct 2026" onExport={exportFiltered} exportLabel="Export CSV" />

      {err && (
        <div role="alert" className="mb-3 flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-[13px] font-semibold rounded-xl px-3 py-2">
          <AlertTriangle size={15} className="shrink-0" />
          <span className="min-w-0 flex-1">{err}</span>
          <button onClick={() => setErr('')} aria-label="Dismiss error" className="text-red-400 hover:text-red-700 font-bold px-1">✕</button>
        </div>
      )}

      {/* KPI cards */}
      <KpiGrid cols="sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={<Bell size={22} />} label="Total Notifications" value={counts.All}
          context={counts.Unread ? `${counts.Unread} Unread` : 'All caught up'}
          dotColor={counts.Unread ? '#DC4C58' : '#159B72'} tileClass="bg-rose-50 text-rose-600" />
        <KpiCard icon={<AlertTriangle size={22} />} label="Action Required" value={counts['Action Required']}
          context="Needs Your Attention" dotColor="#E8A02B" tileClass="bg-amber-50 text-amber-600" />
        <KpiCard icon={<Info size={22} />} label="Information" value={counts.Information}
          context="General Updates" dotColor="#1463D9" tileClass="bg-blue-50 text-blue-600" />
        <KpiCard icon={<BadgeCheck size={22} />} label="Completed" value={counts.Completed}
          context="Marked as Read" dotColor="#159B72" tileClass="bg-emerald-50 text-emerald-600" />
      </KpiGrid>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* LEFT — tabs + filters + notification list */}
        <div className="xl:col-span-2">
          <div className="card !p-0 overflow-hidden">
            {/* Tab bar with counts + Mark All Read */}
            <div className="border-b border-slate-200 px-2 flex gap-0.5 overflow-x-auto items-center" role="tablist">
              {TABS.map((t) => (
                <button key={t} role="tab" aria-selected={t === tab} onClick={() => goTab(t)}
                  className={`px-3.5 py-3 text-[13px] font-bold whitespace-nowrap border-b-2 -mb-px transition flex items-center gap-1.5
                    ${t === tab ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-navy'}`}>
                  {t}
                  <span className={`text-[11px] font-extrabold px-1.5 py-0.5 rounded-full ${t === tab ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                    {counts[t] ?? 0}
                  </span>
                </button>
              ))}
              <div className="ml-auto pl-2 py-1.5">
                <PermBtn perm="notifications.manage" onClick={markAll} className="btn-primary !bg-white !text-blue-700 border border-blue-200 !py-1.5 !px-3 !text-[12px]">
                  <span className="flex items-center gap-1.5"><CheckCheck size={14} /> Mark All as Read</span>
                </PermBtn>
              </div>
            </div>

            {/* Search + category filter */}
            <div className="p-3 flex flex-wrap items-center gap-2">
              <SearchInput value={query} onChange={setQuery} onSearch={() => setAppliedQuery(query)} ph="Search notifications..." width="!w-56" />
              <label className="flex items-center gap-1.5 text-[12px] font-bold text-slate-600">
                Filter by category
                <select className="input !w-auto !py-2 !text-[13px]" value={category}
                  onChange={(e) => setCategory(e.target.value as 'ALL' | NotificationCategory)}
                  aria-label="Filter by category">
                  <option value="ALL">All categories</option>
                  {NOTIFICATION_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              {(typeFilter !== 'ALL' || category !== 'ALL' || appliedQuery) && (
                <button onClick={clearFilters} className="text-[12px] font-semibold text-slate-500 hover:text-navy">✕ Clear filters</button>
              )}
            </div>

            {/* List */}
            <div>
              {view.length === 0 ? (
                <div className="px-4 pb-4">
                  <EmptyState
                    title={hasFilters ? 'No notifications match your filters' : 'No notifications yet'}
                    sub={hasFilters
                      ? 'Try a different tab, category or search term.'
                      : 'Alerts about approvals, workers, bills and compliance will appear here.'}
                    action={hasFilters
                      ? <button onClick={clearFilters} className="btn-primary !py-2 mt-1">Clear filters</button>
                      : undefined}
                  />
                </div>
              ) : view.map((n) => (
                <div key={n.id} role="button" tabIndex={0}
                  onClick={() => open(n)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(n); } }}
                  className={`flex items-start gap-3 px-3 py-2.5 border-t border-slate-100 cursor-pointer border-l-4 transition
                    ${n.read ? 'border-l-transparent hover:bg-blue-50/40' : 'border-l-blue-600 bg-blue-50/40 hover:bg-blue-50/70'}`}>
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${TYPE_TILE[n.type]}`}>
                    {CAT_ICON[n.category]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className={`text-[13px] text-navy ${n.read ? 'font-semibold text-slate-600' : 'font-extrabold'}`}>{n.title}</div>
                    <div className="text-[11px] text-slate-500 truncate">{n.description}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{n.id}{n.relatedId ? ` · related: ${n.relatedId}` : ''}</div>
                    <div className="flex items-center gap-1.5 mt-1 md:hidden">
                      <SoftPill v={n.category} cls={CAT_PILL[n.category]} />
                      <SoftPill v={n.read ? 'Read' : 'Unread'} cls={n.read ? 'bg-slate-100 text-slate-500' : 'bg-red-100 text-red-600'} />
                      <span className="text-[10px] text-slate-400" title={fmtDateTime(n.timestamp)}>{relTime(n.timestamp)}</span>
                    </div>
                  </div>
                  <div className="hidden md:flex items-center gap-2 shrink-0 pt-0.5">
                    <span className="w-20 flex justify-end"><SoftPill v={n.category} cls={CAT_PILL[n.category]} /></span>
                    <span className="hidden lg:block w-24"><SoftPill v={n.type} cls={TYPE_PILL[n.type]} /></span>
                    <span className="w-20 text-[11px] text-slate-500 text-right" title={fmtDateTime(n.timestamp)}>{relTime(n.timestamp)}</span>
                    <span className="w-16 flex justify-end">
                      <SoftPill v={n.read ? 'Read' : 'Unread'} cls={n.read ? 'bg-slate-100 text-slate-500' : 'bg-red-100 text-red-600'} />
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 pt-0.5" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => open(n)} title={`Open: ${n.href}`} aria-label={`Open notification ${n.id}`}
                      className="w-7 h-7 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-navy hover:bg-blue-50 hover:border-blue-300">
                      <ExternalLink size={14} />
                    </button>
                    <button onClick={() => markRead(n)} disabled={n.read}
                      title={n.read ? 'Already read' : 'Mark as read'} aria-label={`Mark ${n.id} as read`}
                      className={`w-7 h-7 rounded-lg border flex items-center justify-center
                        ${n.read ? 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed' : 'border-slate-200 bg-white text-navy hover:bg-emerald-50 hover:border-emerald-300'}`}>
                      <Check size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {list.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-3 border-t border-slate-100 text-xs text-slate-500 flex-wrap">
                <span>Showing {(cur - 1) * size + 1}–{Math.min(cur * size, list.length)} of {list.length}</span>
                <label className="ml-2 flex items-center gap-1">Show
                  <select className="input !w-auto !py-1" value={size} onChange={(e) => setSize(Number(e.target.value))} aria-label="Rows per page">
                    {[10, 25, 50].map((o) => <option key={o} value={o}>{o}</option>)}
                  </select> per page
                </label>
                <div className="ml-auto flex items-center gap-1">
                  <button className="w-8 h-8 rounded-lg bg-white border font-bold" disabled={cur <= 1} onClick={() => setPage(cur - 1)} aria-label="Previous page">‹</button>
                  <span className="px-2 font-bold text-navy">Page {cur} of {pages}</span>
                  <button className="w-8 h-8 rounded-lg bg-white border font-bold" disabled={cur >= pages} onClick={() => setPage(cur + 1)} aria-label="Next page">›</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — summary donut + quick filters + quick actions */}
        <div className="space-y-4">
          <SectionCard title="Notification Summary"
            subtitle={category !== 'ALL' ? `Filtered to ${category} — click again to clear` : 'Click a slice to filter by category'}>
            <Donut data={donutData} centerValue={String(counts.All)} centerLabel="Total"
              onPick={(s) => {
                const c = s.name as NotificationCategory;
                setCategory((prev) => (prev === c ? 'ALL' : c));
                setTab('All'); setTypeFilter('ALL');
              }}
              height={190} />
          </SectionCard>

          <SectionCard title="Quick Filters">
            <div className="space-y-1">
              {quickFilters.map((q) => (
                <button key={q.label} onClick={() => applyQuick(q.target)}
                  className={`w-full flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-bold transition text-left border
                    ${isQuickActive(q.target) ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-transparent text-navy hover:bg-slate-50'}`}>
                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${q.tile}`}>{q.icon}</span>
                  <span className="flex-1 min-w-0 truncate">{q.label}</span>
                  <span className={`text-[12px] font-extrabold ${isQuickActive(q.target) ? 'text-blue-700' : 'text-slate-500'}`}>{q.count}</span>
                </button>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Quick Actions">
            <div className="grid grid-cols-2 gap-2">
              <PermBtn perm="notifications.manage" onClick={markAll}
                className="btn-primary !bg-emerald-50 !text-emerald-700 border border-emerald-200 !py-3 flex flex-col items-center gap-1 !text-[12px]">
                <CheckCheck size={17} /> Mark All as Read
              </PermBtn>
              <button onClick={() => router.push('/contractor/bills?tab=All%20Bills')}
                className="border border-slate-200 rounded-xl px-3 py-3 text-[12px] font-bold text-navy hover:border-blue-300 hover:bg-blue-50/50 transition flex flex-col items-center gap-1">
                <Receipt size={17} className="text-amber-600" /> Open Bills
              </button>
              <button onClick={() => router.push('/contractor/documents?tab=Statutory%20Compliance')}
                className="border border-slate-200 rounded-xl px-3 py-3 text-[12px] font-bold text-navy hover:border-blue-300 hover:bg-blue-50/50 transition flex flex-col items-center gap-1">
                <ShieldCheck size={17} className="text-violet-600" /> Open Compliance
              </button>
              <button onClick={() => router.push('/contractor/workers?tab=Training%20Status')}
                className="border border-slate-200 rounded-xl px-3 py-3 text-[12px] font-bold text-navy hover:border-blue-300 hover:bg-blue-50/50 transition flex flex-col items-center gap-1">
                <Users size={17} className="text-sky-600" /> Open Workers
              </button>
            </div>
          </SectionCard>
        </div>
      </div>
    </ContractorShell>
  );
}
