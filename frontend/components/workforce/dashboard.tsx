'use client';
/**
 * MineNetr Contractor Dashboard — the /contractor landing page composition.
 *
 * Everything on this page derives from the centralized synthetic repositories
 * (lib/workforce/store for the workforce domain, lib/contracts/store for the
 * contract list). There is no fetch, no skeleton and no hard-coded figure:
 * every KPI, chart slice, table row and task badge is computed from the same
 * state the rest of the portal mutates, so a mine-scope change, a submitted
 * bill or an approved transfer updates the dashboard instantly.
 *
 * Every visible control is wired: KPI cards navigate, donut slices re-scope
 * the portal, table rows open the contracts page, task rows open the exact
 * page/tab that resolves them and the toolbar Export downloads a real CSV.
 */
import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeftRight, BarChart3, Bell, CalendarCheck, CalendarClock, ChevronRight, ClipboardList,
  FileText, FolderCheck, FolderUp, GraduationCap, IndianRupee, Receipt, ShieldAlert,
  ShieldCheck, UserPlus, Users,
} from 'lucide-react';
import {
  CardGrid, DataTable, Donut, EmptyState, KpiCard, KpiGrid, MiniBar, PageToolbar, Pill,
  QuickActions, SectionCard, StackedBars, type Column,
} from './ui';
import {
  actions, attendanceTrend, computeKpis, contractorName, mineCode, mineLabel, toast,
  useMockWorkforce,
} from '../../lib/workforce/store';
import { mines } from '../../lib/workforce/seed';
import { exportCsv } from '../../lib/workforce/export';
import {
  AttendanceStatus, BillStatus, DEMO_TODAY, TransferStatus, type Worker,
} from '../../lib/workforce/types';
import { fmtDate, inr, lastNDates, periodLabel, relTime } from '../../lib/workforce/format';
import { getContractsDb, isExpiringSoon, useMockContracts } from '../../lib/contracts/store';
import { ContractStatus, type Contract } from '../../lib/contracts/types';

// ---------- Static presentation constants (colours only — never numbers) ----------
const MINE_COLORS: Record<string, string> = { 'M-01': '#2563eb', 'M-02': '#06b6d4', 'M-03': '#8b5cf6' };
const ATT = { present: '#10b981', absent: '#f59e0b', leave: '#3b82f6', unmarked: '#cbd5e1' };

/** Activity kind → tile colour + icon (fallback keeps the feed readable). */
const ACT_META: Record<string, { color: string; icon: React.ReactNode }> = {
  'Worker Added': { color: '#2563eb', icon: <UserPlus size={14} /> },
  'Transfer Requested': { color: '#8b5cf6', icon: <ArrowLeftRight size={14} /> },
  'Transfer Approved': { color: '#8b5cf6', icon: <ArrowLeftRight size={14} /> },
  'Bill Submitted': { color: '#10b981', icon: <Receipt size={14} /> },
  'Document Uploaded': { color: '#f59e0b', icon: <FolderUp size={14} /> },
  'Attendance Marked': { color: '#0ea5e9', icon: <CalendarCheck size={14} /> },
  'Incident Raised': { color: '#ef4444', icon: <ShieldAlert size={14} /> },
  'Corrective Action': { color: '#f97316', icon: <ShieldAlert size={14} /> },
  'Access Decision': { color: '#64748b', icon: <ShieldCheck size={14} /> },
  'Deployment Changed': { color: '#06b6d4', icon: <Users size={14} /> },
};
const actMeta = (kind: string) => ACT_META[kind] ?? { color: '#64748b', icon: <ClipboardList size={14} /> };

interface DashTask {
  id: string; title: string; sub: string; badge: string; badgeCls: string;
  href: string; color: string; icon: React.ReactNode;
}

/** Card-shaped link — KPI cards behave like buttons but keep the card look. */
function KpiLink({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className="text-left w-full rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      <div className="h-full transition hover:-translate-y-0.5 hover:shadow-md">{children}</div>
    </button>
  );
}

const viewAllBtn = (label: string, onClick: () => void) => (
  <button onClick={onClick} className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline">
    {label} ›
  </button>
);

export function ContractorDashboard() {
  const db = useMockWorkforce();
  const router = useRouter();
  const cdb = useMockContracts(); // subscription — keeps the dashboard in sync with contract actions

  const mineId = db.selectedMineId;
  const scopeLabel = mineId === 'ALL' ? 'All assigned mines' : mineLabel(mineId);

  const k = useMemo(() => computeKpis(db), [db]);

  // Contracts come from the contracts repository (safe against a missing store).
  const contracts = useMemo<Contract[]>(() => {
    try { return (cdb.contracts ?? getContractsDb().contracts ?? []) as Contract[]; }
    catch { return []; }
  }, [cdb.contracts]);

  const scopedContracts = useMemo(
    () => contracts.filter((c) => mineId === 'ALL' || c.mineId === mineId),
    [contracts, mineId],
  );
  const activeContracts = scopedContracts.filter(
    (c) => c.status === ContractStatus.Active || c.status === ContractStatus.ExpiringSoon,
  ).length;
  const endingSoon = scopedContracts.filter(isExpiringSoon).length;

  const pendingBills = useMemo(
    () => db.bills.filter((b) => (mineId === 'ALL' || b.mineId === mineId) && b.status === BillStatus.Pending),
    [db.bills, mineId],
  );

  // Worker distribution by mine — always shows every mine, because the donut
  // doubles as the mine selector that re-scopes the whole portal.
  const distribution = useMemo(() => {
    const counts = new Map<string, number>();
    for (const w of db.workers) counts.set(w.mineId, (counts.get(w.mineId) ?? 0) + 1);
    return mines.map((m) => ({
      id: m.id,
      name: `${m.name} (${m.code})`,
      value: counts.get(m.id) ?? 0,
      color: MINE_COLORS[m.id] ?? '#94a3b8',
    }));
  }, [db.workers]);

  const distSlices = distribution.map((d) => ({
    name: d.name,
    value: d.value,
    color: mineId === 'ALL' || mineId === d.id ? d.color : '#e2e8f0',
  }));
  const distTotal = mineId === 'ALL'
    ? distribution.reduce((s, d) => s + d.value, 0)
    : distribution.find((d) => d.id === mineId)?.value ?? 0;

  // Today's attendance split (all four buckets from the same store).
  const unmarked = Math.max(0, k.totalWorkers - k.presentToday - k.absentToday - k.onLeave);
  const attendanceSlices = useMemo(() => [
    { name: 'Present', value: k.presentToday, color: ATT.present },
    { name: 'Absent', value: k.absentToday, color: ATT.absent },
    { name: 'On Leave', value: k.onLeave, color: ATT.leave },
    { name: 'Not Marked', value: unmarked, color: ATT.unmarked },
  ], [k.presentToday, k.absentToday, k.onLeave, unmarked]);
  const presentPct = k.totalWorkers ? Math.round((k.presentToday / k.totalWorkers) * 100) : 0;

  const trend = useMemo(
    () => attendanceTrend(db, 14, mineId).map((r) => ({
      label: fmtDate(r.label).slice(0, 6),
      present: r.present, absent: r.absent, leave: r.leave, notMarked: r.notMarked, total: r.total,
    })),
    [db, mineId],
  );

  const activities = useMemo(() => db.activity.slice(0, 6), [db.activity]);

  // ---- Pending tasks: genuinely derived, never a static list ----
  const tasks = useMemo<DashTask[]>(() => {
    const out: DashTask[] = [];
    const plural = (n: number, s: string) => `${n} ${s}${n === 1 ? '' : 's'}`;

    if (pendingBills.length) {
      out.push({
        id: 'bills',
        title: `Follow up ${plural(pendingBills.length, 'pending bill')}`,
        sub: `${inr(pendingBills.reduce((s, b) => s + b.amount, 0))} awaiting mine-office approval`,
        badge: 'Billing', badgeCls: 'bg-amber-100 text-amber-700',
        href: '/contractor/bills?tab=Pending', color: '#10b981', icon: <Receipt size={15} />,
      });
    }
    const pendingTransfers = db.transfers.filter((t) =>
      t.status === TransferStatus.Pending && (mineId === 'ALL' || t.fromMineId === mineId || t.toMineId === mineId));
    if (pendingTransfers.length) {
      out.push({
        id: 'transfers',
        title: `Review ${plural(pendingTransfers.length, 'transfer request')}`,
        sub: 'Raised for your workers — awaiting approval',
        badge: 'Pending', badgeCls: 'bg-amber-100 text-amber-700',
        href: '/contractor/workers?tab=Transfer%20History', color: '#8b5cf6', icon: <ArrowLeftRight size={15} />,
      });
    }
    if (k.trainingExpiring) {
      out.push({
        id: 'training-expiring',
        title: `Renew ${plural(k.trainingExpiring, 'expiring training certificate')}`,
        sub: 'Mandatory certifications expiring within 60 days',
        badge: '60 days', badgeCls: 'bg-amber-100 text-amber-700',
        href: '/contractor/workers?tab=Training%20Status', color: '#f59e0b', icon: <GraduationCap size={15} />,
      });
    }
    if (k.trainingExpired) {
      out.push({
        id: 'training-expired',
        title: `${plural(k.trainingExpired, 'worker')} with expired or missing training`,
        sub: 'Blocked from deployment until renewed',
        badge: 'Blocked', badgeCls: 'bg-red-100 text-red-600',
        href: '/contractor/workers?tab=Training%20Status', color: '#ef4444', icon: <GraduationCap size={15} />,
      });
    }
    if (unmarked) {
      out.push({
        id: 'attendance',
        title: `Mark attendance for ${plural(unmarked, 'worker')}`,
        sub: `Not marked yet for ${fmtDate(DEMO_TODAY)}`,
        badge: 'Today', badgeCls: 'bg-sky-100 text-sky-700',
        href: '/contractor/attendance', color: '#0ea5e9', icon: <CalendarClock size={15} />,
      });
    }
    if (k.docsExpired) {
      out.push({
        id: 'docs-expired',
        title: `Replace ${plural(k.docsExpired, 'expired document')}`,
        sub: 'Past expiry — compliance risk until re-uploaded',
        badge: 'Expired', badgeCls: 'bg-red-100 text-red-600',
        href: '/contractor/documents', color: '#ef4444', icon: <FolderCheck size={15} />,
      });
    }
    if (k.docsExpiring) {
      out.push({
        id: 'docs-expiring',
        title: `Update ${plural(k.docsExpiring, 'document')} expiring soon`,
        sub: 'Expiring within the next 60 days',
        badge: '60 days', badgeCls: 'bg-amber-100 text-amber-700',
        href: '/contractor/documents', color: '#f59e0b', icon: <FolderCheck size={15} />,
      });
    }
    if (k.complianceIssues) {
      out.push({
        id: 'incidents',
        title: `Respond to ${plural(k.complianceIssues, 'open compliance incident')}`,
        sub: 'Inspector-raised incidents awaiting your response',
        badge: 'Action', badgeCls: 'bg-orange-100 text-orange-700',
        href: '/contractor/documents?tab=Statutory%20Compliance', color: '#f97316', icon: <ShieldAlert size={15} />,
      });
    }
    return out;
  }, [db.transfers, k, unmarked, pendingBills, mineId]);

  // ---- Contract overview table ----
  const contractCols: Column<Contract>[] = useMemo(() => [
    {
      key: 'name', header: 'Contract', sortValue: (c) => c.name,
      render: (c) => (
        <div className="min-w-[150px]">
          <div className="font-semibold text-navy">{c.name}</div>
          <div className="text-[11px] text-slate-400">{c.id} · {c.workType}</div>
        </div>
      ),
    },
    {
      key: 'mine', header: 'Mine', sortValue: (c) => c.mineId,
      render: (c) => <span title={mineLabel(c.mineId)} className="whitespace-nowrap">{mineCode(c.mineId)}</span>,
    },
    {
      key: 'period', header: 'Period', sortValue: (c) => c.endDate,
      render: (c) => (
        <span className="whitespace-nowrap text-[12px]">{fmtDate(c.startDate)} – {fmtDate(c.endDate)}</span>
      ),
    },
    {
      key: 'value', header: 'Value', sortValue: (c) => c.contractValue,
      render: (c) => <span className="whitespace-nowrap font-semibold">{inr(c.contractValue)}</span>,
    },
    {
      key: 'status', header: 'Status', sortValue: (c) => c.status,
      render: (c) => <Pill v={c.status} />,
    },
    {
      key: 'progress', header: 'Progress', sortValue: (c) => c.progress,
      render: (c) => (
        <div className="flex items-center gap-2 min-w-[110px]">
          <div className="flex-1"><MiniBar pct={c.progress} /></div>
          <span className="text-[11px] font-bold text-slate-600">{c.progress}%</span>
        </div>
      ),
    },
  ], []);

  // ---- Export: workers in scope + the KPI summary of the current scope ----
  function handleExport() {
    const rows = db.workers.filter((w) => mineId === 'ALL' || w.mineId === mineId);
    const attBy = new Map<string, string>();
    for (const a of db.attendance) attBy.set(a.workerId, a.status);
    const first = rows[0];
    const only = (v: string | number) => (w: Worker) => (w === first ? v : '');
    const count = exportCsv<Worker>(`minenetr-dashboard-${DEMO_TODAY}`, rows, [
      ['Worker ID', (w) => w.id],
      ['Name', (w) => w.name],
      ['Designation', (w) => w.designation],
      ['Department', (w) => w.department],
      ['Mine', (w) => mineLabel(w.mineId)],
      ['Contractor', (w) => contractorName(w.contractorId)],
      ['Shift', (w) => w.shift],
      ['Worker Status', (w) => w.status],
      ['Work Zone', (w) => w.workZone],
      ['Supervisor', (w) => w.supervisor],
      ["Today's Attendance", (w) => attBy.get(w.id) ?? AttendanceStatus.NotMarked],
      ['Joining Date', (w) => w.joiningDate],
      // KPI summary of the current scope (carried on the first data row).
      ['Scope: Mine', () => scopeLabel],
      ['Scope: Total Workers', only(k.totalWorkers)],
      ['Scope: Present Today', only(k.presentToday)],
      ['Scope: Pending Transfers', only(k.pendingTransfers)],
      ['Scope: Pending Bills (INR)', only(k.pendingAmount)],
      ['Scope: Active Contracts', only(activeContracts)],
      ['Scope: Compliance Score (%)', only(k.complianceScore)],
      ['Scope: Avg Attendance 30d (%)', only(k.avgAttendance)],
    ]);
    toast(`Exported ${count} worker${count === 1 ? '' : 's'} + KPI summary for ${scopeLabel}.`);
  }

  const quickActions = [
    { label: 'Add Worker', icon: <UserPlus size={16} />, onClick: () => router.push('/contractor/workers?new=1'), tileClass: 'bg-blue-100 text-blue-600' },
    { label: 'Mark Attendance', icon: <CalendarCheck size={16} />, onClick: () => router.push('/contractor/attendance'), tileClass: 'bg-emerald-100 text-emerald-600' },
    { label: 'Submit Bill', icon: <Receipt size={16} />, onClick: () => router.push('/contractor/bills'), tileClass: 'bg-purple-100 text-purple-600' },
    { label: 'Upload Document', icon: <FolderUp size={16} />, onClick: () => router.push('/contractor/documents'), tileClass: 'bg-amber-100 text-amber-600' },
    { label: 'Raise Transfer', icon: <ArrowLeftRight size={16} />, onClick: () => router.push('/contractor/workers?tab=Transfer%20History'), tileClass: 'bg-cyan-100 text-cyan-600' },
    { label: 'View Reports', icon: <BarChart3 size={16} />, onClick: () => router.push('/contractor/reports'), tileClass: 'bg-indigo-100 text-indigo-600' },
    { label: 'Notifications', icon: <Bell size={16} />, onClick: () => router.push('/contractor/notifications'), tileClass: 'bg-rose-100 text-rose-600' },
  ];

  const period = periodLabel(lastNDates(14)[0], DEMO_TODAY);

  return (
    <>
      <PageToolbar period={period} onExport={handleExport} exportLabel="Export Summary" />

      {/* ---------- KPI row ---------- */}
      <KpiGrid cols="sm:grid-cols-2 xl:grid-cols-4">
        <KpiLink onClick={() => router.push('/contractor/workers')} title="Open Workers & Manpower">
          <KpiCard
            icon={<Users size={24} />} label="Total Deployed Workers" value={k.totalWorkers}
            context={mineId === 'ALL'
              ? `Across ${distribution.filter((d) => d.value > 0).length} mines · ${k.activeWorkers} active`
              : `${k.activeWorkers} active · ${scopeLabel}`}
            contextTone="text-slate-500" dotColor="#2563eb" tileClass="bg-blue-50 text-blue-600"
          />
        </KpiLink>

        <KpiLink onClick={() => router.push('/contractor/contracts')} title="Open My Contracts">
          <KpiCard
            icon={<FileText size={24} />} label="Active Contracts" value={activeContracts}
            context={endingSoon > 0 ? `${endingSoon} ending soon` : 'None ending soon'}
            contextTone={endingSoon > 0 ? 'text-amber-600' : 'text-emerald-600'}
            dotColor={endingSoon > 0 ? '#f59e0b' : '#10b981'} tileClass="bg-emerald-50 text-emerald-600"
          />
        </KpiLink>

        <KpiLink onClick={() => router.push('/contractor/bills?tab=Pending')} title="Open Bills — Pending tab">
          <KpiCard
            icon={<IndianRupee size={24} />} label="Pending Bills" value={inr(k.pendingAmount)}
            context={pendingBills.length ? `${pendingBills.length} bill${pendingBills.length === 1 ? '' : 's'} awaiting approval` : 'No bills awaiting approval'}
            contextTone={pendingBills.length ? 'text-amber-600' : 'text-emerald-600'}
            dotColor={pendingBills.length ? '#ef4444' : '#10b981'} tileClass="bg-purple-50 text-purple-700"
          />
        </KpiLink>

        <KpiLink onClick={() => router.push('/contractor/documents')} title="Open Documents & Compliance">
          <KpiCard
            icon={<ShieldCheck size={24} />} label="Compliance Status" value={`${k.complianceScore}%`}
            context={k.complianceScore >= 85 ? `Good standing · ${k.complianceIssues} open issue${k.complianceIssues === 1 ? '' : 's'}`
              : k.complianceScore >= 70 ? `Needs attention · ${k.complianceIssues} open issue${k.complianceIssues === 1 ? '' : 's'}`
                : `Action required · ${k.complianceIssues} open issue${k.complianceIssues === 1 ? '' : 's'}`}
            contextTone={k.complianceScore >= 85 ? 'text-emerald-600' : k.complianceScore >= 70 ? 'text-amber-600' : 'text-red-500'}
            dotColor={k.complianceScore >= 85 ? '#10b981' : k.complianceScore >= 70 ? '#f59e0b' : '#ef4444'}
            tileClass="bg-amber-50 text-amber-600"
          />
        </KpiLink>
      </KpiGrid>

      {/* ---------- Distribution / contracts / attendance ---------- */}
      <CardGrid className="lg:grid-cols-3">
        <SectionCard
          title="Worker Distribution"
          subtitle="Click a mine to re-scope the entire portal"
          action={mineId === 'ALL'
            ? <span className="text-[11px] font-semibold text-slate-400">Scope: all mines</span>
            : <button className="btn-primary !py-1 !px-2.5 !text-[11px]" onClick={() => actions.setSelectedMine('ALL')}>Show all mines</button>}
        >
          <Donut
            data={distSlices} height={170}
            centerValue={String(distTotal)}
            centerLabel={mineId === 'ALL' ? 'Workers · all mines' : `Workers · ${mineCode(mineId)}`}
            onPick={(s) => {
              const picked = distribution.find((d) => d.name === s.name);
              if (!picked) return;
              actions.setSelectedMine(picked.id === mineId ? 'ALL' : picked.id);
            }}
          />
        </SectionCard>

        <SectionCard
          title="Contract Overview"
          subtitle={`${activeContracts} active · ${scopedContracts.length} in scope`}
          action={viewAllBtn('View all', () => router.push('/contractor/contracts'))}
        >
          <DataTable
            columns={contractCols}
            rows={scopedContracts}
            initialSize={5}
            pageSizeOptions={[5, 10, 20]}
            onRowClick={() => router.push('/contractor/contracts')}
            emptyTitle="No contracts in scope"
            emptyText="No contracts match the current mine scope. Switch the mine selector to All Assigned Mines or open My Contracts."
          />
        </SectionCard>

        <SectionCard
          title="Attendance Overview"
          subtitle={`Today · ${fmtDate(DEMO_TODAY)} · ${scopeLabel}`}
        >
          <Donut
            data={attendanceSlices} height={165}
            centerValue={`${presentPct}%`} centerLabel="Present today"
            onPick={() => router.push('/contractor/attendance')}
          />
          <button
            onClick={() => router.push('/contractor/attendance')}
            className="mt-2 w-full flex items-center gap-2 bg-blue-50 text-blue-700 font-bold text-[13px] rounded-xl px-3 py-2.5 hover:bg-blue-100 transition"
          >
            <BarChart3 size={15} /> View Attendance Report <ChevronRight size={15} className="ml-auto" />
          </button>
        </SectionCard>
      </CardGrid>

      {/* ---------- Activities / tasks / quick actions ---------- */}
      <CardGrid className="lg:grid-cols-3 mt-4">
        <SectionCard
          title="Recent Activities"
          subtitle={`Latest changes in ${scopeLabel.toLowerCase()}`}
          action={viewAllBtn('View all', () => router.push('/contractor/reports'))}
        >
          {activities.length ? (
            <div>
              {activities.map((a) => {
                const meta = actMeta(a.kind);
                return (
                  <div key={a.id} className="flex gap-2.5 py-2.5 border-b border-slate-100 last:border-0">
                    <span
                      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: `${meta.color}1a`, color: meta.color }}
                      aria-hidden="true"
                    >
                      {meta.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-bold text-navy leading-tight">{a.kind}</div>
                      <div className="text-[11px] text-slate-500 truncate" title={a.description}>{a.description}</div>
                      <div className="text-[11px] text-slate-400">{relTime(a.timestamp)} · {a.user}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState title="No recent activity" sub="Actions you take across the portal will appear here." />
          )}
        </SectionCard>

        <SectionCard
          title="Pending Tasks"
          subtitle={tasks.length ? `${tasks.length} item${tasks.length === 1 ? '' : 's'} need attention in ${scopeLabel.toLowerCase()}` : 'Nothing pending'}
        >
          {tasks.length ? (
            <div>
              {tasks.map((t) => (
                <div key={t.id} className="flex items-center gap-2.5 py-2.5 border-b border-slate-100 last:border-0">
                  <span
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${t.color}1a`, color: t.color }}
                    aria-hidden="true"
                  >
                    {t.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-bold text-navy leading-tight">{t.title}</div>
                    <div className="text-[11px] text-slate-500 truncate" title={t.sub}>{t.sub}</div>
                  </div>
                  <span className={`badge ${t.badgeCls} whitespace-nowrap`}>● {t.badge}</span>
                  <button
                    type="button"
                    onClick={() => router.push(t.href)}
                    title={`Open: ${t.title}`}
                    aria-label={`Open ${t.title}`}
                    className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 shrink-0 transition"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="All caught up" sub="No pending transfers, expiring certificates, documents or bills in the current scope." />
          )}
        </SectionCard>

        <SectionCard title="Quick Actions" subtitle="Jump straight into a workflow">
          <QuickActions items={quickActions} />
        </SectionCard>
      </CardGrid>

      {/* ---------- 14-day attendance trend ---------- */}
      <div className="mt-4">
        <SectionCard
          title="Attendance Trend"
          subtitle={`Last 14 days · ${scopeLabel} · click a day to open attendance`}
          action={viewAllBtn('Open attendance', () => router.push('/contractor/attendance'))}
        >
          <StackedBars
            data={trend}
            height={220}
            series={[
              { key: 'present', name: 'Present', fill: ATT.present },
              { key: 'absent', name: 'Absent', fill: ATT.absent },
              { key: 'leave', name: 'On Leave', fill: ATT.leave },
              { key: 'notMarked', name: 'Not Marked', fill: ATT.unmarked },
            ]}
            onPick={() => router.push('/contractor/attendance')}
          />
        </SectionCard>
      </div>
    </>
  );
}
