/**
 * Page 1 — DGMS Dashboard. Every number derives from the central mock store
 * under the current filters. No independent counters.
 */
'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mountain, ClipboardCheck, TriangleAlert, Clock, FileText } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import Shell from '../../components/Shell';
import { useMockDb } from '../../lib/dgms/mockDb';
import { complianceOfMine } from '../../lib/dgms/seed';
import { fmtDate, relTime } from '../../lib/dgms/format';
import { AlertStatus, FindingCategory, FindingStatus, InspectionStatus, NotificationStatus, Priority, Severity } from '../../lib/dgms/types';
import { DemoBadge, DetailDrawer, FilterBar, KpiCard, Kv, SectionCard, Toasts } from '../../components/dgms/ui';
import type { Finding } from '../../lib/dgms/types';

const STATES = ['All States', 'Jharkhand', 'Chhattisgarh', 'Odisha', 'Madhya Pradesh', 'West Bengal'];

export default function DgmsDashboard() {
  const db = useMockDb();
  const router = useRouter();
  const [draft, setDraft] = useState({ range: 'Last 30 days', state: 'All States', mine: 'All Mines' });
  const [applied, setApplied] = useState(draft);
  const [viewFinding, setViewFinding] = useState<Finding | null>(null);

  const mineOpts = useMemo(() => {
    const list = db.mines.filter((m) => applied.state === 'All States' || m.state === applied.state);
    return ['All Mines', ...list.map((m) => `${m.name} (${m.code})`)];
  }, [db.mines, applied.state]);

  const mineIdOf = (label: string) => {
    if (label === 'All Mines') return null;
    const m = db.mines.find((x) => `${x.name} (${x.code})` === label);
    return m?.id ?? null;
  };

  const cutoff = applied.range === 'Last 7 days' ? '2026-09-26' : applied.range === 'Last 30 days' ? '2026-09-03' : '0000-00-00';
  const inRange = (iso: string) => iso.slice(0, 10) >= cutoff;
  const selMine = mineIdOf(applied.mine);

  const findings = db.findings.filter((f) => {
    const m = db.mines.find((x) => x.id === f.mineId);
    if (applied.state !== 'All States' && m?.state !== applied.state) return false;
    if (selMine && f.mineId !== selMine) return false;
    if (!inRange(f.detectedAt)) return false;
    return true;
  });
  const inspections = db.inspections.filter((i) => {
    const m = db.mines.find((x) => x.id === i.mineId);
    if (applied.state !== 'All States' && m?.state !== applied.state) return false;
    if (selMine && i.mineId !== selMine) return false;
    if (!inRange(i.scheduledDate)) return false;
    return true;
  });
  const minesInScope = db.mines.filter((m) => applied.state === 'All States' || m.state === applied.state)
    .filter((m) => !selMine || m.id === selMine);
  const openAlerts = db.alerts.filter((a) => a.status === AlertStatus.Open)
    .filter((a) => {
      const m = db.mines.find((x) => x.id === a.mineId);
      if (applied.state !== 'All States' && m?.state !== applied.state) return false;
      if (selMine && a.mineId !== selMine) return false;
      return true;
    });
  const pendingReports = inspections.filter((i) => i.reportStatus === 'Pending Review').length;
  const critCount = findings.filter((f) => f.severity === Severity.Critical && f.status !== FindingStatus.Resolved).length;

  const byState = STATES.slice(1).map((s) => ({
    state: s,
    mines: db.mines.filter((m) => m.state === s).length,
    open: findings.filter((f) => {
      const m = db.mines.find((x) => x.id === f.mineId);
      return m?.state === s && f.status !== FindingStatus.Resolved;
    }).length,
  })).filter((r) => r.mines > 0);

  const inspDonut = [
    { name: 'Completed', value: inspections.filter((i) => i.status === InspectionStatus.Completed).length, color: '#16a34a' },
    { name: 'In Progress', value: inspections.filter((i) => i.status === InspectionStatus.InProgress).length, color: '#2563eb' },
    { name: 'Pending', value: inspections.filter((i) => i.status === InspectionStatus.Scheduled).length, color: '#f59e0b' },
    { name: 'Overdue', value: inspections.filter((i) => i.status === InspectionStatus.Overdue).length, color: '#ef4444' },
  ];
  const inspTotal = inspDonut.reduce((a, d) => a + d.value, 0);

  const catRows = Object.values(FindingCategory).map((c) => ({
    cat: c,
    n: findings.filter((f) => f.category === c).length,
  }));
  const catMax = Math.max(1, ...catRows.map((r) => r.n));

  const alerts = [
    ...openAlerts.slice(0, 3).map((a) => {
      const m = db.mines.find((x) => x.id === a.mineId);
      return { sev: a.severity === Severity.Critical ? 'Critical' : a.severity === Severity.High ? 'High' : 'Medium', title: a.parameter, mine: m ? `${m.name} (${m.code})` : a.mineId, time: relTime(a.timestamp), findingId: db.findings.find((f) => f.mineId === a.mineId && f.status !== FindingStatus.Resolved)?.id };
    }),
    ...findings.filter((f) => f.severity === Severity.Critical && f.status !== FindingStatus.Resolved).slice(0, 2).map((f) => {
      const m = db.mines.find((x) => x.id === f.mineId);
      return { sev: 'Critical', title: f.description.slice(0, 60) + '…', mine: m ? `${m.name} (${m.code})` : f.mineId, time: relTime(f.detectedAt), findingId: f.id };
    }),
  ].slice(0, 5);

  const unread = db.notifications.filter((n) => n.status === NotificationStatus.Unread).length;

  return (
    <Shell title="DGMS Dashboard" subtitle="National overview of mining safety, compliance and inspection performance.">
      <div className="flex gap-2 mb-3 flex-wrap items-center">
        <FilterBar
          defs={[
            { key: 'range', label: 'Date Range', options: ['Last 7 days', 'Last 30 days', 'All time'] },
            { key: 'state', label: 'State', options: STATES },
            { key: 'mine', label: 'Mine', options: mineOpts, width: '!w-56' },
          ]}
          values={draft}
          onChange={(k, v) => setDraft((d) => ({ ...d, [k]: v, ...(k === 'state' ? { mine: 'All Mines' } : {}) }))}
          onApply={() => setApplied(draft)}
          onReset={() => { const r = { range: 'Last 30 days', state: 'All States', mine: 'All Mines' }; setDraft(r); setApplied(r); }}
        />
        <span className="ml-auto"><DemoBadge /></span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <KpiCard icon={<Mountain size={22} />} label="Total Registered Mines" value={minesInScope.length} sub={`${minesInScope.filter((m) => m.status === 'Active').length} active`} />
        <KpiCard icon={<ClipboardCheck size={22} />} label="Inspections Completed" value={inspections.filter((i) => i.status === InspectionStatus.Completed).length} sub={`of ${inspections.length}`} />
        <KpiCard icon={<TriangleAlert size={22} />} label="Critical Violations" value={critCount} sub="open" tone="text-red-500" />
        <KpiCard icon={<Clock size={22} />} label="Overdue Actions" value={openAlerts.length + inspections.filter((i) => i.status === InspectionStatus.Overdue).length} sub="need attention" tone="text-red-500" />
        <KpiCard icon={<FileText size={22} />} label="Reports Pending Review" value={pendingReports} sub="submitted" />
      </div>

      <div className="grid xl:grid-cols-3 gap-3 mt-3">
        <SectionCard title="Mines by State" action={<span className="text-[11px] text-slate-500 font-normal">{minesInScope.length} mines · click a state to filter</span>}>
          <div className="text-[12px] space-y-1.5">
            {byState.map((r) => (
              <button key={r.state} className="w-full flex items-center gap-2 hover:bg-blue-50 rounded-lg px-1 py-0.5 text-left"
                onClick={() => { setDraft((d) => ({ ...d, state: r.state, mine: 'All Mines' })); setApplied({ range: applied.range, state: r.state, mine: 'All Mines' }); }}>
                <span className={`w-2.5 h-2.5 rounded-full ${r.open > 2 ? 'bg-red-500' : r.open > 0 ? 'bg-amber-400' : 'bg-green-500'}`} />
                {r.state}<b className="ml-auto">{r.mines} <span className="font-normal text-slate-500">· {r.open} open</span></b>
              </button>
            ))}
          </div>
          <div className="mt-3 bg-blue-50 border border-blue-100 rounded-xl p-3 text-[12px] text-slate-600">
            State-based overview (demonstration — no real mine coordinates are used anywhere in this portal).
          </div>
        </SectionCard>

        <div className="space-y-3">
          <SectionCard title={`Inspection Status · ${inspTotal} in scope`}>
            <div className="h-[170px] relative">
              <ResponsiveContainer>
                <PieChart><Pie data={inspDonut} dataKey="value" innerRadius={52} outerRadius={75} paddingAngle={2}>
                  {inspDonut.map((d) => <Cell key={d.name} fill={d.color} />)}
                </Pie></PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-extrabold text-navy">{inspTotal}</span>
                <span className="text-[11px] text-slate-500">inspections</span>
              </div>
            </div>
            <div className="text-[12px] space-y-1">{inspDonut.map((d) => (
              <div key={d.name} className="flex gap-2 items-center"><span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />{d.name}<b className="ml-auto">{d.value}</b></div>
            ))}</div>
          </SectionCard>
          <SectionCard title="Findings by Category">
            {catRows.map((r) => (
              <button key={r.cat} className="w-full flex items-center gap-2 text-[12px] py-1 text-left"
                onClick={() => router.push(`/dgms/findings?category=${encodeURIComponent(r.cat)}`)}>
                <span className="w-32 text-slate-600">{r.cat}</span>
                <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-red-500 to-blue-500 rounded-full" style={{ width: `${Math.round((r.n / catMax) * 100)}%` }} /></div>
                <b>{r.n}</b>
              </button>
            ))}
          </SectionCard>
        </div>

        <SectionCard title="Priority Alerts" action={<Link href="/dgms/notifications" className="text-blue-600 text-xs font-bold">View All</Link>}>
          <div className="space-y-2.5">
            {alerts.length === 0 && <div className="text-[13px] text-slate-500">No open alerts in scope.</div>}
            {alerts.map((a, i) => (
              <div key={i} className="flex gap-2.5 items-start border-b last:border-0 pb-2.5">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold ${a.sev === 'Critical' ? 'bg-red-50 text-red-500' : a.sev === 'High' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>!</div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-bold text-navy truncate">{a.title}</div>
                  <div className="text-[11px] text-slate-500">{a.mine} · {a.time}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`badge ${a.sev === 'Critical' ? 'bg-red-100 text-red-600' : a.sev === 'High' ? 'bg-amber-100 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>{a.sev}</span>
                  {a.findingId && <button className="text-[11px] font-bold text-blue-700" onClick={() => { const f = db.findings.find((x) => x.id === a.findingId); if (f) setViewFinding(f); }}>View</button>}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 text-[11px] text-slate-500">{unread} unread notification(s) in the notification center.</div>
        </SectionCard>
      </div>

      <SectionCard className="mt-3" title="Reports & Analytics" action={<span className="text-xs text-slate-500 font-normal">Access consolidated reports for detailed insights.</span>}>
        <div className="grid sm:grid-cols-3 xl:grid-cols-6 gap-2">
          {[
            ['Mine Compliance Summary', 'Overall compliance status', 'Compliance Report'],
            ['Inspection Performance Report', 'Completion and findings', 'Inspection Report'],
            ['Safety & Environmental Report', 'Air quality, dust, water', 'Safety Report'],
            ['Production & Dispatch Report', 'Production and dispatch', 'Production Report'],
            ['Worker & Contractor Compliance', 'Workforce and training', 'Contractor Report'],
            ['AI Risk & Violation Summary', 'AI-detected risks', 'Safety Report'],
          ].map(([t, d, rt]) => (
            <button key={t} className="border rounded-xl p-3 hover:border-blue-400 hover:shadow-sm transition text-left"
              onClick={() => router.push(`/dgms/reports?type=${encodeURIComponent(rt)}`)}>
              <div className="text-[12px] font-bold text-navy">{t} →</div>
              <div className="text-[11px] text-slate-500 mt-1">{d}</div>
            </button>
          ))}
        </div>
      </SectionCard>

      {viewFinding && (
        <DetailDrawer title={`Finding ${viewFinding.id}`} onClose={() => setViewFinding(null)}>
          <Kv k="Mine" v={`${db.mines.find((m) => m.id === viewFinding.mineId)?.name} (${db.mines.find((m) => m.id === viewFinding.mineId)?.code})`} />
          <Kv k="Severity / Status" v={`${viewFinding.severity} · ${viewFinding.status}`} />
          <Kv k="Detected" v={fmtDate(viewFinding.detectedAt)} />
          <Kv k="Description" v={viewFinding.description} />
          <Kv k="Recommendation" v={viewFinding.recommendation} />
          <Link href={`/dgms/findings?focus=${viewFinding.id}`} className="btn-primary w-full mt-4 text-center block">Open full finding record</Link>
        </DetailDrawer>
      )}
      <Toasts />
    </Shell>
  );
}
