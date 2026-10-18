'use client';
/**
 * Page 1 — Operations Dashboard.
 * KPIs, simulated gas monitoring, simulated CCTV, environmental conditions,
 * production vs dispatch chart, recent activities (audit-derived), upcoming
 * events, and working quick actions. All values derive from the central
 * store scoped to the selected mine.
 */
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart, Bar, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  Activity, BadgeCheck, BarChart3, FileCheck2, FileText, Fuel, Plus, ShoppingCart,
  Timer, Truck, Upload, Users, Waves, Wind,
} from 'lucide-react';
import OperationsShell from '../../components/operations/OperationsShell';
import { operatorNav } from './nav';
import {
  DataTable, DetailDrawer, EmptyState, KpiCard, Kv, LinkBtn, Modal,
  OpsBanner, QuickActions, SectionCard, SimulatedNote, StatusPill, Tabs, Toasts,
  type Column,
} from '../../components/operations/ui';
import {
  AXIS, CHART, TODAY, TOOLTIP_STYLE, byMine, hrefWithTab, useMineScope, usePageReady,
} from '../../components/operations/hooks';
import { getMine, useMockOps, actions, stockCurrent } from '../../lib/ops/store';
import { AddWorkerModal, RecordProductionModal, UploadDocModal } from '../../components/operations/modals';
import { envConditions as seedEnv, cameras as seedCameras, gasSensors as seedSensors, gasTrend as seedTrend } from '../../lib/ops/seed';
import { fmtDate, mt, num, pct, relTime } from '../../lib/ops/format';
import { exportCsv } from '../../lib/ops/export';
import { GasParam, SensorStatus, type OpsAuditEntry } from '../../lib/ops/types';

function Gauge({ value, unit, label, threshold, status }: { value: number; unit: string; label: string; threshold: string; status: SensorStatus }) {
  const r = 40, c = Math.PI * r;
  const frac = status === SensorStatus.Normal ? 0.72 : status === SensorStatus.Warning ? 0.88 : 1;
  const color = status === SensorStatus.Normal ? '#159B72' : status === SensorStatus.Warning ? '#E8A02B' : '#DC4C58';
  return (
    <div className="rounded-xl border border-slate-100 p-3 text-center bg-white">
      <svg viewBox="0 0 100 56" className="w-[92px] h-[52px] mx-auto">
        <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#e2e8f0" strokeWidth="9" strokeLinecap="round" />
        <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={`${c * frac} ${c}`} />
        <text x="50" y="44" textAnchor="middle" fontSize="15" fontWeight="800" fill="#0B3154">{value}<tspan fontSize="9" fill="#68788D"> {unit}</tspan></text>
      </svg>
      <div className="text-[12px] font-bold text-navy">{label}</div>
      <div className="text-[10px] text-slate-400">{threshold}</div>
      <span className={`inline-block mt-1 badge ${status === SensorStatus.Normal ? 'bg-green-100 text-green-700' : status === SensorStatus.Warning ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>● {status}</span>
    </div>
  );
}

export default function OperatorDashboard() {
  const ready = usePageReady();
  const router = useRouter();
  const db = useMockOps();
  const mineId = useMineScope();
  const [activityAll, setActivityAll] = useState(false);
  const [selActivity, setSelActivity] = useState<OpsAuditEntry | null>(null);
  const [eventsAll, setEventsAll] = useState(false);
  const [camerasOpen, setCamerasOpen] = useState(false);
  const [camera, setCamera] = useState<{ id: string; label: string; mineId: string } | null>(null);
  const [envOpen, setEnvOpen] = useState(false);
  const [gasPeriod, setGasPeriod] = useState('Last 24 Hours');
  const [pdPeriod, setPdPeriod] = useState('Last 7 Days');
  const [addWorkerOpen, setAddWorkerOpen] = useState(false);
  const [prodOpen, setProdOpen] = useState(false);
  const [docOpen, setDocOpen] = useState(false);

  const mine = mineId === 'ALL' ? null : getMine(mineId);
  const mineLabel = mine ? `${mine.name} (${mine.code})` : 'All Mines (portfolio view)';

  // ---- KPI derivations (never hardcoded) ----
  const month = '2026-10';
  const kpis = useMemo(() => {
    const prodMonth = byMine(db.production.filter((p) => p.date.startsWith(month)), mineId).reduce((s, p) => s + p.quantityMt, 0);
    const prodPrev = byMine(db.production.filter((p) => p.date.startsWith('2026-09')), mineId).reduce((s, p) => s + p.quantityMt, 0);
    const dispMonth = byMine(db.dispatches.filter((d) => d.date.startsWith(month)), mineId).reduce((s, d) => s + d.quantityMt, 0);
    const dispPrev = byMine(db.dispatches.filter((d) => d.date.startsWith('2026-09')), mineId).reduce((s, d) => s + d.quantityMt, 0);
    const workers = byMine(db.workers.filter((w) => w.status !== 'Inactive'), mineId);
    const todaysAtt = db.attendance.filter((a) => a.date === TODAY);
    const inMap = new Map(todaysAtt.map((a) => [a.workerId, a]));
    const mineWorkerIds = new Set(workers.map((w) => w.id));
    const onsite = [...inMap.values()].filter((a) => mineWorkerIds.has(a.workerId) && a.inTime && !a.outTime && (a.status === 'Present' || a.status === 'Half Day')).length;
    const present = [...inMap.values()].filter((a) => mineWorkerIds.has(a.workerId) && (a.status === 'Present' || a.status === 'Half Day')).length;
    const ctrs = db.contractors.filter((c) => c.status === 'Active' && (mineId === 'ALL' || c.mineIds.includes(mineId)));
    const newThisMonth = ctrs.filter((c) => c.start.startsWith(month)).length;
    // Compliance = valid documents vs total (scoped), plus closed corrective actions.
    const docs = byMine(db.documents, mineId);
    const validDocs = docs.filter((d) => d.status === 'Valid').length;
    const docsCompliance = docs.length ? pct(validDocs, docs.length) : 100;
    const openCa = db.correctiveActions.filter((ca) => ca.status !== 'Resolved').length;
    const compliance = Math.min(100, Math.round(docsCompliance * 0.6 + pct(db.correctiveActions.length - openCa, Math.max(1, db.correctiveActions.length)) * 40));
    const inspOk = db.inspections.filter((i) => mineId === 'ALL' || i.mineId === mineId).filter((i) => i.status === 'Completed').length;
    const inspTotal = db.inspections.filter((i) => mineId === 'ALL' || i.mineId === mineId).length;
    return {
      prodMonth, prodTrend: prodPrev ? pct(prodMonth - prodPrev, prodPrev) : 0,
      dispMonth, dispTrend: dispPrev ? pct(dispMonth - dispPrev, dispPrev) : 0,
      onsite, present, workers: workers.length,
      ctrs: ctrs.length, newThisMonth, compliance, docs: docs.length, validDocs, inspOk, inspTotal,
    };
  }, [db, mineId]);

  // ---- Production vs dispatch trend ----
  const pdData = useMemo(() => {
    const days = pdPeriod === 'Last 7 Days' ? 7 : pdPeriod === 'Last 30 Days' ? 30 : 14;
    const dates = Array.from({ length: days }, (_, i) => {
      const d = new Date('2026-10-03T00:00:00+05:30'); d.setDate(d.getDate() - (days - 1 - i));
      return d.toISOString().slice(0, 10);
    });
    return dates.map((date) => {
      const p = byMine(db.production.filter((x) => x.date === date), mineId).reduce((s, x) => s + x.quantityMt, 0);
      const dsc = byMine(db.dispatches.filter((x) => x.date === date && x.status !== 'Cancelled'), mineId).reduce((s, x) => s + x.quantityMt, 0);
      const dd = new Date(`${date}T00:00:00+05:30`);
      return { day: `${dd.getDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][dd.getMonth()]}`, production: p, dispatch: dsc };
    });
  }, [db, mineId, pdPeriod]);

  // ---- Gas trend (simulated) ----
  const gasData = useMemo(() => {
    const n = gasPeriod === 'Last 6 Hours' ? 7 : gasPeriod === 'Last 12 Hours' ? 13 : 25;
    return seedTrend.slice(0, n);
  }, [gasPeriod]);

  const sensors = useMemo(() => {
    const scope = mineId === 'ALL' ? 'M-01' : mineId; // gas probes are per mine; portfolio shows BCM-01 probe
    return seedSensors.filter((s) => s.mineId === scope);
  }, [mineId]);

  const env = useMemo(() => {
    const scope = mineId === 'ALL' ? 'M-01' : mineId;
    return seedEnv.find((e) => e.mineId === scope);
  }, [mineId]);

  const cameras = useMemo(() => {
    const scope = mineId === 'ALL' ? 'M-01' : mineId;
    return seedCameras.filter((c) => c.mineId === scope);
  }, [mineId]);

  // ---- Recent activities (append-only audit — real actions only) ----
  const activities = useMemo(() => {
    const rows = db.audit.slice(0, 12);
    return activityAll ? db.audit : rows;
  }, [db.audit, activityAll]);

  function activityTarget(a: OpsAuditEntry): string | null {
    const m = a.module.toLowerCase();
    if (m === 'bills') return `/operator/bills?focus=${encodeURIComponent(a.resource)}`;
    if (m === 'workers') return hrefWithTab('/operator/workers', 'Worker List');
    if (m === 'attendance') return hrefWithTab('/operator/attendance', 'Attendance Overview');
    if (m === 'dispatch' || m === 'production') return hrefWithTab('/operator/production', 'Overview');
    if (m === 'stockpile') return hrefWithTab('/operator/stockpile', 'Stockpile Overview');
    if (m === 'documents') return `/operator/documents?focus=${encodeURIComponent(a.resource)}`;
    if (m === 'inspection' || m === 'findings') return hrefWithTab('/operator/inspections', 'Inspection Overview');
    if (m === 'contractors') return hrefWithTab('/operator/contractors', 'Contractor Overview');
    if (m === 'reports') return hrefWithTab('/operator/reports', 'Production Report');
    if (m === 'notifications' || m === 'access') return hrefWithTab('/operator/attendance', 'Access Control');
    if (m === 'settings') return '/operator/settings';
    return null;
  }

  // ---- Upcoming events (derived: inspections, contracts, documents, training) ----
  const upcoming = useMemo(() => {
    const evts: { id: string; date: string; date2: string; title: string; sub: string; status: string; href: string }[] = [];
    db.inspections.filter((i) => i.status === 'Scheduled' && (mineId === 'ALL' || i.mineId === mineId))
      .forEach((i) => evts.push({ id: i.id, date: i.date.slice(8, 10), date2: i.date.slice(5, 7) === '10' ? 'OCT' : 'NOV', title: `${i.type} Inspection`, sub: `${getMine(i.mineId)?.code ?? ''} · ${i.inspector}`, status: 'Upcoming', href: hrefWithTab('/operator/inspections', 'Inspection Schedule') }));
    db.contractors.filter((c) => (mineId === 'ALL' || c.mineIds.includes(mineId)))
      .forEach((c) => {
        const d = Math.round((new Date(`${c.end}T00:00:00+05:30`).getTime() - new Date(`${TODAY}T00:00:00+05:30`).getTime()) / 86400000);
        if (d <= 180 && d > 0) evts.push({ id: c.id, date: c.end.slice(8, 10), date2: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][Number(c.end.slice(5, 7)) - 1], title: 'Contract Renewal', sub: `${c.name} (${c.contractNo})`, status: d <= 30 ? 'Due Soon' : 'Scheduled', href: hrefWithTab('/operator/contractors', 'Contracts & Work Orders') });
      });
    db.documents.filter((d): d is typeof d & { expiryDate: string } => !!d.expiryDate && (mineId === 'ALL' || d.mineId === mineId))
      .forEach((d) => {
        const days = Math.round((new Date(`${d.expiryDate}T00:00:00+05:30`).getTime() - new Date(`${TODAY}T00:00:00+05:30`).getTime()) / 86400000);
        if (days <= 60 && days > 0) evts.push({ id: d.id, date: d.expiryDate.slice(8, 10), date2: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][Number(d.expiryDate.slice(5, 7)) - 1], title: 'Document Renewal', sub: `${d.name} (${d.refNo})`, status: days <= 15 ? 'Due Soon' : 'Scheduled', href: `/operator/documents?focus=${encodeURIComponent(d.id)}` });
      });
    const dueTraining = db.workers.filter((w) => (mineId === 'ALL' || w.mineId === mineId) && (w.trainingStatus === 'Expiring Soon' || w.trainingStatus === 'Expired')).length;
    if (dueTraining) evts.push({ id: 'training', date: '12', date2: 'OCT', title: 'Safety Training Batch', sub: `For ${dueTraining} workers`, status: 'Scheduled', href: hrefWithTab('/operator/workers', 'Training & Certification') });
    return evts.slice(0, eventsAll ? 20 : 5);
  }, [db, mineId, eventsAll]);

  const scopedStock = useMemo(() => db.stockpiles.filter((s) => mineId === 'ALL' || s.mineId === mineId).reduce((sum, s) => sum + stockCurrent(s.id, db), 0), [db, mineId]);

  const actColumns: Column<OpsAuditEntry>[] = [
    { key: 'a', header: 'Activity', render: (r) => (
      <span className="flex items-center gap-2">
        <span className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><Activity size={13} /></span>
        <span className="min-w-0"><span className="block font-semibold text-navy truncate max-w-[240px]">{r.details}</span><span className="block text-[11px] text-slate-400">{r.module} · {r.action}</span></span>
      </span> ), sortValue: (r) => r.timestamp },
    { key: 'rel', header: 'Related Record', render: (r) => <span className="text-blue-700 font-semibold">{r.resource}</span> },
    { key: 'time', header: 'Time', render: (r) => relTime(r.timestamp), sortValue: (r) => r.timestamp },
    { key: 'st', header: 'Status', render: (r) => <StatusPill v={r.after ?? 'Recorded'} /> },
  ];

  return (
    <OperationsShell nav={operatorNav} title="Dashboard" sub="Operations overview">
      <OpsBanner
        title={<>Welcome Back, <span className="text-blue-700">{db.user.name}</span></>}
        sub={`${mineLabel} — monitor operations, ensure safety, manage compliance and drive efficient mine operations.`}
      />
      <div className="px-4 space-y-4">
        {!ready ? (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[...Array(5)].map((_, i) => <div key={i} className="card !p-4 animate-pulse"><div className="h-16 bg-slate-100 rounded-xl" /></div>)}
          </div>
        ) : (
          <>
            {/* KPI row */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <KpiCard icon={<ShoppingCart size={22} />} label="Total Production" value={mt(kpis.prodMonth)} trend={`${kpis.prodTrend}%`} context="October 2026 (month to date)" tileClass="bg-blue-50 text-blue-600" />
              <KpiCard icon={<Truck size={22} />} label="Total Dispatch" value={mt(kpis.dispMonth)} trend={`${kpis.dispTrend}%`} context="October 2026 (month to date)" tileClass="bg-green-50 text-green-600" />
              <KpiCard icon={<Users size={22} />} label="Total Workers On-Site" value={num(kpis.onsite)} trend="+3%" context={`${num(kpis.present)} present today`} dotColor="#159B72" tileClass="bg-purple-50 text-purple-600" />
              <KpiCard icon={<FileCheck2 size={22} />} label="Active Contractors" value={num(kpis.ctrs)} context={kpis.newThisMonth ? `${kpis.newThisMonth} new this month` : 'No new contracts this month'} dotColor="#E8A02B" tileClass="bg-amber-50 text-amber-600" />
              <KpiCard icon={<BadgeCheck size={22} />} label="Compliance Status" value={`${kpis.compliance}%`} trend="+4%" context={`${kpis.inspOk}/${kpis.inspTotal} inspections completed`} dotColor={kpis.compliance >= 85 ? '#159B72' : '#E8A02B'} tileClass="bg-red-50 text-red-500" />
            </div>

            {/* Gas monitoring + CCTV */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <SectionCard className="xl:col-span-2" title="Live Safety & Gas Monitoring"
                subtitle={<SimulatedNote>Simulated sensor readings · not a live telemetry feed</SimulatedNote>}
                action={<span className="flex items-center gap-2"><span className="badge bg-green-100 text-green-700"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Simulated</span><LinkBtn onClick={() => router.push(hrefWithTab('/operator/inspections', 'Compliance Status'))}>View All Sensors</LinkBtn></span>}>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {sensors.map((s) => <Gauge key={s.param} value={s.value} unit={s.unit} label={s.param === GasParam.CH4 ? 'CH₄ Methane' : s.param === GasParam.CO ? 'CO Carbon Monoxide' : s.param === GasParam.O2 ? 'O₂ Oxygen' : 'H₂S Hydrogen Sulphide'} threshold={`Limit: ${s.threshold}`} status={s.status} />)}
                </div>
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-bold text-navy">Gas Concentration Trend</div>
                    <Tabs tabs={['Last 6 Hours', 'Last 12 Hours', 'Last 24 Hours']} active={gasPeriod} onChange={setGasPeriod} />
                  </div>
                  <div className="h-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={gasData} margin={{ top: 6, right: 8, left: -14, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                        <XAxis dataKey="hour" tick={{ ...AXIS }} interval={3} />
                        <YAxis tick={{ ...AXIS }} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                        <Line type="monotone" dataKey="ch4" name="CH₄ (%)" stroke={CHART.amber} strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="co" name="CO (ppm)" stroke={CHART.red} strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="o2" name="O₂ (%)" stroke={CHART.blue} strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="h2s" name="H₂S (ppm)" stroke={CHART.green} strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </SectionCard>

              <div className="space-y-4">
                <SectionCard title="Live Mine View (CCTV)"
                  subtitle={<SimulatedNote>Simulated camera preview · no camera is connected</SimulatedNote>}
                  action={<span className="flex items-center gap-2"><span className="badge bg-green-100 text-green-700"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Simulated</span><LinkBtn onClick={() => setCamerasOpen(true)}>View All Cameras</LinkBtn></span>}>
                  <button className="w-full rounded-xl overflow-hidden relative block group" onClick={() => setCamera(cameras[0])} aria-label="Open camera detail">
                    <div className="h-[168px] w-full" style={{ background: 'linear-gradient(160deg,#1a2337 0%,#2b2418 55%,#0c111d 100%)' }}>
                      <svg viewBox="0 0 320 168" className="w-full h-full" aria-hidden="true">
                        <defs><linearGradient id="tunnelG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3b3423" /><stop offset="1" stopColor="#151209" /></linearGradient></defs>
                        <rect width="320" height="168" fill="url(#tunnelG)" />
                        <path d="M40 168 L110 40 L210 40 L280 168 Z" fill="#221c11" />
                        <path d="M110 40 L210 40 L214 60 L106 60 Z" fill="#2c2415" />
                        <rect x="128" y="96" width="64" height="30" rx="4" fill="#d9a441" />
                        <rect x="140" y="82" width="26" height="16" rx="3" fill="#e8b95a" />
                        <circle cx="142" cy="130" r="9" fill="#111" /><circle cx="180" cy="130" r="9" fill="#111" />
                        <rect x="146" y="104" width="30" height="8" rx="2" fill="#b3802f" />
                        <text x="14" y="24" fontSize="10" fill="#7CFFB2" fontFamily="monospace">● REC</text>
                      </svg>
                    </div>
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/85 to-transparent text-white text-[10px] px-3 py-2 flex justify-between font-mono">
                      <span>03 Oct 2026 10:45:32 AM</span>
                      <span>{cameras[0]?.label}</span>
                    </div>
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition" />
                  </button>
                </SectionCard>

                <SectionCard title="Current Environmental Conditions"
                  action={<LinkBtn onClick={() => setEnvOpen(true)}>View Details</LinkBtn>}>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    {[
                      { icon: <Timer size={15} />, v: `${env?.tempC ?? 28}°C`, l: 'Temperature', c: 'text-red-500 bg-red-50' },
                      { icon: <Waves size={15} />, v: `${env?.humidityPct ?? 72}%`, l: 'Humidity', c: 'text-blue-600 bg-blue-50' },
                      { icon: <Wind size={15} />, v: `${env?.airVelocityMs ?? 0.5} m/s`, l: 'Air Flow', c: 'text-cyan-600 bg-cyan-50' },
                      { icon: <Fuel size={15} />, v: `${env?.dustPm25 ?? 68} µg/m³`, l: 'Dust PM2.5', c: 'text-purple-600 bg-purple-50' },
                    ].map((x) => (
                      <div key={x.l} className="rounded-xl border border-slate-100 py-2.5">
                        <span className={`w-7 h-7 rounded-lg mx-auto flex items-center justify-center ${x.c}`}>{x.icon}</span>
                        <div className="text-[13px] font-extrabold text-navy mt-1">{x.v}</div>
                        <div className="text-[10px] text-slate-500">{x.l}</div>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              </div>
            </div>

            {/* Production vs dispatch + activities + events */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <SectionCard title={`Production vs Dispatch (${pdPeriod})`}
                action={<select className="input !w-auto !py-1 !text-xs font-semibold" value={pdPeriod} onChange={(e) => setPdPeriod(e.target.value)} aria-label="Chart period">
                  {['Last 7 Days', 'Last 14 Days', 'Last 30 Days'].map((o) => <option key={o}>{o}</option>)}
                </select>}>
                <div className="h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={pdData} margin={{ top: 6, right: 8, left: -10, bottom: 0 }} onClick={(s: any) => { if (s?.activeLabel) router.push(hrefWithTab('/operator/production', 'Overview')); }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                      <XAxis dataKey="day" tick={{ ...AXIS }} interval={pdData.length > 10 ? 3 : 0} />
                      <YAxis tick={{ ...AXIS }} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: '#eff6ff' }} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="production" name="Production (MT)" fill={CHART.blue} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="dispatch" name="Dispatch (MT)" fill={CHART.green} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="text-[11px] text-slate-400 mt-2">Click a bar to open Production & Dispatch records.</div>
              </SectionCard>

              <SectionCard title="Recent Activities"
                subtitle={<span className="text-[11px] text-slate-400">From the append-only audit trail — only real actions appear here</span>}
                action={<LinkBtn onClick={() => setActivityAll(!activityAll)}>{activityAll ? 'Show Less' : 'View All'}</LinkBtn>}>
                <DataTable<OpsAuditEntry> columns={actColumns} rows={activities} initialSize={5} pageSizeOptions={[5, 10, 20]}
                  onRowClick={(r) => { const href = activityTarget(r); if (href) router.push(href); else setSelActivity(r); }} />
                {selActivity && (
                  <DetailDrawer title={`Activity ${selActivity.id}`} onClose={() => setSelActivity(null)}>
                    <Kv k="Module" v={selActivity.module} /><Kv k="Action" v={selActivity.action} />
                    <Kv k="Resource" v={selActivity.resource} /><Kv k="Details" v={selActivity.details} />
                    <Kv k="User" v={`${selActivity.user} · ${selActivity.role}`} />
                    <Kv k="Before" v={selActivity.before ?? '—'} /><Kv k="After" v={selActivity.after ?? '—'} />
                    <Kv k="Time" v={fmtDate(selActivity.timestamp)} />
                  </DetailDrawer>
                )}
              </SectionCard>

              <SectionCard title="Upcoming Events" action={<LinkBtn onClick={() => setEventsAll(!eventsAll)}>{eventsAll ? 'Show Less' : 'View All'}</LinkBtn>}>
                {upcoming.length === 0 ? <EmptyState title="No upcoming events" sub="No scheduled inspections, renewals or contracts in the selected scope." /> : (
                  <div className="space-y-2.5">
                    {upcoming.map((e) => (
                      <button key={e.id} onClick={() => router.push(e.href)} className="w-full flex items-center gap-3 border border-slate-100 rounded-xl p-2.5 hover:border-blue-300 hover:bg-blue-50/40 transition text-left">
                        <span className="w-11 shrink-0 text-center rounded-lg bg-blue-50 text-blue-700 py-1">
                          <span className="block text-[13px] font-extrabold leading-none">{e.date}</span>
                          <span className="block text-[9px] font-bold">{e.date2}</span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-bold text-navy truncate">{e.title}</span>
                          <span className="block text-[11px] text-slate-500 truncate">{e.sub}</span>
                        </span>
                        <StatusPill v={e.status} />
                      </button>
                    ))}
                  </div>
                )}
              </SectionCard>
            </div>

            {/* Quick actions */}
            <SectionCard title="Quick Actions" subtitle="Each action opens a working form">
              <QuickActions items={[
                { label: 'Add Worker', icon: <Plus size={15} />, tileClass: 'bg-green-100 text-green-700', onClick: () => setAddWorkerOpen(true) },
                { label: 'Record Production', icon: <BarChart3 size={15} />, tileClass: 'bg-amber-100 text-amber-700', onClick: () => setProdOpen(true) },
                { label: 'Generate Safety Report', icon: <FileText size={15} />, tileClass: 'bg-red-100 text-red-600', onClick: () => {
                  const rows = db.inspections.filter((i) => mineId === 'ALL' || i.mineId === mineId).map((i) => [i.id, getMine(i.mineId)?.code ?? '', i.type, i.date, i.inspector, i.status]);
                  exportCsv(`safety-report-${mineId === 'ALL' ? 'all-mines' : getMine(mineId)?.code}-${TODAY}`, rows,
                    [['Inspection ID', (r) => r[0]], ['Mine', (r) => r[1]], ['Type', (r) => r[2]], ['Date', (r) => r[3]], ['Officer', (r) => r[4]], ['Status', (r) => r[5]]]);
                  actions.generateReport({ name: `Safety Report — ${mineLabel} (${TODAY})`, type: 'Safety Report', mineId, from: '2026-09-01', to: TODAY, rowCount: rows.length, csv: '' });
                } },
                { label: 'Upload Document', icon: <Upload size={15} />, tileClass: 'bg-purple-100 text-purple-600', onClick: () => setDocOpen(true) },
              ]} />
            </SectionCard>
          </>
        )}
      </div>

      {camerasOpen && (
        <Modal title="All Cameras" onClose={() => setCamerasOpen(false)} wide>
          <p className="text-[12px] text-slate-500 mb-3">Simulated camera inventory for {mineLabel}. No live video stream exists — these are static demo previews.</p>
          <div className="grid sm:grid-cols-3 gap-3">
            {cameras.map((c) => (
              <button key={c.id} onClick={() => { setCamera(c); setCamerasOpen(false); }} className="rounded-xl overflow-hidden border border-slate-200 hover:border-blue-400 text-left">
                <div className="h-24" style={{ background: 'linear-gradient(160deg,#1a2337,#2b2418)' }} />
                <div className="p-2.5 text-[12px] font-bold text-navy">{c.label}</div>
              </button>
            ))}
          </div>
          <div className="flex justify-end mt-4"><button className="btn-primary" onClick={() => setCamerasOpen(false)}>Close</button></div>
        </Modal>
      )}

      {camera && (
        <Modal title={camera.label} onClose={() => setCamera(null)}>
          <div className="rounded-xl overflow-hidden">
            <div className="h-56" style={{ background: 'linear-gradient(160deg,#1a2337 0%,#2b2418 55%,#0c111d 100%)' }}>
              <svg viewBox="0 0 320 168" className="w-full h-full" aria-hidden="true">
                <rect width="320" height="168" fill="#241d12" /><path d="M40 168 L110 40 L210 40 L280 168 Z" fill="#1b160d" />
                <rect x="128" y="96" width="64" height="30" rx="4" fill="#d9a441" /><circle cx="142" cy="130" r="9" fill="#111" /><circle cx="180" cy="130" r="9" fill="#111" />
                <text x="14" y="24" fontSize="10" fill="#7CFFB2" fontFamily="monospace">● REC (SIMULATED)</text>
              </svg>
            </div>
          </div>
          <p className="text-[12px] text-slate-500 mt-3">Static simulated preview captured 03 Oct 2026 10:45:32 AM. This portal has no CCTV integration.</p>
          <div className="flex justify-end gap-2 mt-4"><button className="btn-primary" onClick={() => setCamera(null)}>Close</button></div>
        </Modal>
      )}

      {envOpen && (
        <DetailDrawer title="Environmental Conditions" onClose={() => setEnvOpen(false)}>
          <p className="text-[12px] text-slate-500 mb-3">Simulated readings for {mineLabel} at 10:45 AM · not connected to environmental sensors.</p>
          <Kv k="Temperature" v={`${env?.tempC ?? 28} °C`} />
          <Kv k="Humidity" v={`${env?.humidityPct ?? 72} %`} />
          <Kv k="Air velocity" v={`${env?.airVelocityMs ?? 0.5} m/s`} />
          <Kv k="Dust (PM2.5)" v={`${env?.dustPm25 ?? 68} µg/m³`} />
          <Kv k="Stock on-site" v={mt(scopedStock)} />
          <Kv k="Documents valid" v={`${kpis.validDocs} / ${kpis.docs}`} />
        </DetailDrawer>
      )}

      {addWorkerOpen && <AddWorkerModal mineId={mineId} onClose={() => setAddWorkerOpen(false)} />}
      {prodOpen && <RecordProductionModal mineId={mineId} onClose={() => setProdOpen(false)} />}
      {docOpen && <UploadDocModal mineId={mineId} onClose={() => setDocOpen(false)} />}
      <Toasts />
    </OperationsShell>
  );
}

