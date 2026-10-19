'use client';
/**
 * Contractor — My Contracts (page 2 of the design reference).
 *
 * Everything derives from the centralized repository in lib/contracts/store:
 * KPI cards, the six status tabs, the contract list, the Contract Value
 * Overview donut and Upcoming Milestones all read the same state, so a mine
 * change, tab change, search, filter or workflow action updates every view at
 * once. Requests and renewals are stored SEPARATELY from approved contracts —
 * a submitted request never appears as an Active contract.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, BadgeCheck, FileText, FilePlus, Filter, RefreshCw, TrendingUp,
} from 'lucide-react';
import RoleShell from '../../../components/RoleShell';
import { contractorNav } from '../nav';
import {
  EmptyState, KpiCard, SearchInput, SectionCard,
} from '../../../components/operations/ui';
import { Donut } from '../../../components/operations/charts';
import {
  ContractCard, ContractsBanner, ContractsDemoBadge, ContractsToasts, InlineSelect,
  MilestoneItem, ResetDemoBtn,
} from '../../../components/contracts/ui';
import { ContractDetailsDrawer } from '../../../components/contracts/drawer';
import {
  ContractExportDialog, ContractFiltersPanel, ContractRenewalDialog, NewContractRequestDialog,
} from '../../../components/contracts/dialogs';
import {
  actions, allowedMines, filterContracts, getContractsDb, isExpiringSoon, mineLabel, toast,
  upcomingMilestones, useMockContracts,
} from '../../../lib/contracts/store';
import { exportText } from '../../../lib/workforce/export';
import { inr, inrCroreFigure, fmtDate, relTime } from '../../../lib/contracts/format';
import { CHART } from '../../../components/operations/hooks';
import {
  ContractStatus, DEMO_TODAY, type Contract, type ContractFilters,
} from '../../../lib/contracts/types';

const TABS = ['All Contracts', 'Active', 'Upcoming', 'Expiring Soon', 'Completed', 'Terminated'];

const EMPTY_FILTERS: ContractFilters = {
  mineId: 'ALL', status: 'All Contracts', workType: 'All Work Types',
  startFrom: '', startTo: '', endFrom: '', endTo: '', minValue: '', maxValue: '',
};

// Donut slice colours per category (matches the reference palette).
const CATEGORY_COLOR: Record<string, string> = {
  'Overburden Removal': CHART.blue,
  'Coal Transportation': CHART.green,
  'Equipment Maintenance': CHART.slate,
  'Site Services': CHART.amber,
  'Exploration Support': CHART.purple,
};

/**
 * Contract download. The official PDF is served by `GET /contractor/contracts/
 * {id}/document`, which is still a proposed endpoint, so this writes a REAL,
 * complete plain-text summary file instead of faking a success — no alert(),
 * no dead control. The file states plainly that it is a demo export.
 */
function downloadContractSummary(c: Contract) {
  const db = getContractsDb();
  const ms = db.milestones.filter((m) => m.contractId === c.id);
  const docs = db.documents.filter((d) => d.contractId === c.id);
  const act = db.activity.filter((a) => a.contractId === c.id);
  const line = '='.repeat(64);
  const text = [
    line,
    'MINENETR — CONTRACT SUMMARY',
    'DEMO EXPORT (fictional data — not a statutory or commercial document)',
    `Generated ${DEMO_TODAY} from the MineNetr contractor workspace.`,
    `The official contract PDF is served by GET /api/v1/contractor/contracts/${c.id}/document,`,
    'a proposed endpoint that is not yet confirmed with the backend.',
    line,
    '',
    `Contract ID       : ${c.id}`,
    `Work Order Number : ${c.workOrderNumber}`,
    `Title             : ${c.name}`,
    `Work Type         : ${c.workType} (${c.category})`,
    `Contractor        : ${db.contractor.name}`,
    `Mine              : ${mineLabel(c.mineId)}`,
    `Period            : ${fmtDate(c.startDate)} → ${fmtDate(c.endDate)}`,
    `Contract Value    : ${inrCroreFigure(c.contractValue)}`,
    `Progress          : ${c.progress}%`,
    `Status            : ${c.status}`,
    `Compliance        : ${c.complianceStatus}`,
    `Renewal Eligible  : ${c.renewalEligible ? 'Yes' : 'No'}`,
    '',
    'DESCRIPTION',
    `  ${c.description}`,
    '',
    'SCOPE',
    `  ${c.scope}`,
    '',
    `MILESTONES (${ms.length})`,
    ...(ms.length
      ? ms.map((m, i) => `  ${i + 1}. ${m.title} — ${m.status}, due ${fmtDate(m.dueDate)}`)
      : ['  (none)']),
    '',
    `DOCUMENTS (${docs.length})`,
    ...(docs.length
      ? docs.map((d) => `  - ${d.name} [${d.category}] ${d.sizeKb} KB, uploaded ${fmtDate(d.uploadedAt)} by ${d.uploadedBy}`)
      : ['  (none)']),
    '',
    `ACTIVITY (${act.length}${act.length > 15 ? ', latest 15 shown' : ''})`,
    ...(act.length
      ? act.slice(0, 15).map((a) => `  ${a.timestamp.slice(0, 10)}  ${a.kind} — ${a.description} [${a.user}]`)
      : ['  (none)']),
    '',
    line,
    'End of demo export.',
  ].join('\n');

  exportText(`${c.id}-contract-summary.txt`, text);
  toast(`Contract summary for ${c.id} downloaded.`);
}

export default function MyContractsPage() {
  const db = useMockContracts();
  const mineId = db.selectedMineId;
  const mines = allowedMines();

  // Mine options for the header selector (permission-scoped + All Mines).
  const mineOptions = useMemo(() => [
    { id: 'ALL', label: 'All Mines' },
    ...mines.map((m) => ({ id: m.id, label: `${m.name} (${m.code})` })),
  ], [mines]);

  const [tab, setTab] = useState('All Contracts');
  const [query, setQuery] = useState(''); // input value
  const [appliedQuery, setAppliedQuery] = useState(''); // committed search
  const [filters, setFilters] = useState<ContractFilters>(EMPTY_FILTERS);

  // Dialog / drawer state
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<'Overview' | 'Milestones' | 'Documents' | 'Activity History'>('Overview');
  const [newRequestOpen, setNewRequestOpen] = useState(false);
  const [renewId, setRenewId] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Close the actions menu on outside click.
  useEffect(() => {
    if (!openMenuId) return;
    const close = () => setOpenMenuId(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [openMenuId]);

  // --- Derived (all from the single store; never local counters) ---
  const mineScoped = useMemo(
    () => db.contracts.filter((c) => c.contractorId === db.contractor.id && (mineId === 'ALL' || c.mineId === mineId)),
    [db.contracts, db.contractor.id, mineId],
  );

  const kpis = useMemo(() => {
    const total = mineScoped.length;
    const active = mineScoped.filter((c) => c.status === ContractStatus.Active).length;
    const expiring = mineScoped.filter(isExpiringSoon).length;
    const completed = mineScoped.filter((c) => c.status === ContractStatus.Completed).length;
    const minesCount = new Set(mineScoped.map((c) => c.mineId)).size;
    return { total, active, expiring, completed, minesCount };
  }, [mineScoped]);

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { 'All Contracts': mineScoped.length };
    for (const t of TABS.slice(1)) counts[t] = mineScoped.filter((c) => {
      if (t === 'Expiring Soon') return isExpiringSoon(c);
      return c.status === t;
    }).length;
    return counts;
  }, [mineScoped]);

  const list = useMemo(
    () => filterContracts(mineScoped, { ...filters, mineId: 'ALL', status: tab }, appliedQuery),
    [mineScoped, filters, tab, appliedQuery],
  );

  const donutData = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of mineScoped) m.set(c.category, (m.get(c.category) ?? 0) + c.contractValue);
    return [...m.entries()]
      .map(([name, value]) => ({ name, value, color: CATEGORY_COLOR[name] ?? CHART.cyan }))
      .sort((a, b) => b.value - a.value);
  }, [mineScoped]);
  const donutTotal = donutData.reduce((s, d) => s + d.value, 0);

  const milestones = useMemo(() => upcomingMilestones(mineId), [db.milestones, mineId]);

  const drawerContract = drawerId ? db.contracts.find((c) => c.id === drawerId) ?? null : null;
  const renewContract = renewId ? db.contracts.find((c) => c.id === renewId) ?? null : null;

  const scopeLabel = [
    mineId === 'ALL' ? 'All Mines' : mineLabel(mineId),
    tab,
    appliedQuery && `search "${appliedQuery}"`,
    filters.workType !== 'All Work Types' && filters.workType,
  ].filter(Boolean).join(' · ');

  const hasActiveFilters = filters.workType !== 'All Work Types' || filters.startFrom || filters.startTo ||
    filters.endFrom || filters.endTo || filters.minValue || filters.maxValue;

  // Reset the page-scoped search when the mine changes (tab/filters persist).
  function handleMineChange(id: string) {
    actions.setSelectedMine(id);
  }

  function clearSearch() { setQuery(''); setAppliedQuery(''); }

  function openDrawer(c: Contract, t: 'Overview' | 'Milestones' | 'Documents' | 'Activity History' = 'Overview') {
    setDrawerId(c.id); setDrawerTab(t); setOpenMenuId(null);
  }

  function handleCardAction(c: Contract, action: string) {
    setOpenMenuId(null);
    switch (action) {
      case 'view': openDrawer(c, 'Overview'); break;
      case 'milestones': openDrawer(c, 'Milestones'); break;
      case 'documents': openDrawer(c, 'Documents'); break;
      case 'activity': openDrawer(c, 'Activity History'); break;
      case 'download': downloadContractSummary(c); break;
      case 'renew': if (c.renewalEligible) setRenewId(c.id); break;
    }
  }

  return (
    <RoleShell role="contractor" nav={contractorNav} orgTitle="Contractor Workspace"
      orgSub={db.contractor.name} profileSub={db.contractor.role}
      mineOptions={mineOptions} mineValue={mineId} onMineChange={handleMineChange}
      banner={<ContractsBanner onNewRequest={() => setNewRequestOpen(true)} />}>

      <ContractsToasts />

      {/* Demo banner row */}
      <div className="flex items-center gap-2 flex-wrap mb-3 px-1">
        <ContractsDemoBadge />
        <span className="text-[11px] text-slate-400">Synthetic contract records for demonstration. No live contracts or approvals are connected.</span>
        <span className="ml-auto"><ResetDemoBtn /></span>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
        <KpiCard icon={<FileText size={22} />} label="Total Contracts" value={kpis.total}
          context={kpis.total ? `Across ${kpis.minesCount} Mine${kpis.minesCount === 1 ? '' : 's'}` : 'No contracts in scope'}
          dotColor="#1463D9" tileClass="bg-blue-50 text-blue-600" />
        <KpiCard icon={<TrendingUp size={22} />} label="Active Contracts" value={kpis.active}
          context="Currently Ongoing" dotColor="#159B72" tileClass="bg-emerald-50 text-emerald-600" />
        <KpiCard icon={<AlertTriangle size={22} />} label="Expiring Soon" value={kpis.expiring}
          context="Within 60 Days" dotColor="#E8A02B" tileClass="bg-amber-50 text-amber-600" />
        <KpiCard icon={<BadgeCheck size={22} />} label="Completed Contracts" value={kpis.completed}
          context="This Year" dotColor="#DC4C58" tileClass="bg-rose-50 text-rose-600" />
      </div>

      {/* Main content grid: list (left) + value/milestones (right) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* LEFT — tabs, controls, contract list, requests */}
        <div className="xl:col-span-2 space-y-4">
          {/* Status tabs + search + filters + export */}
          <div className="card !p-0 overflow-hidden">
            <div className="border-b border-slate-200 px-2 flex gap-0.5 overflow-x-auto" role="tablist">
              {TABS.map((t) => (
                <button key={t} role="tab" aria-selected={t === tab} onClick={() => setTab(t)}
                  className={`px-3.5 py-3 text-[13px] font-bold whitespace-nowrap border-b-2 -mb-px transition flex items-center gap-1.5
                    ${t === tab ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-navy'}`}>
                  {t}
                  <span className={`text-[11px] font-extrabold px-1.5 py-0.5 rounded-full ${t === tab ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>{tabCounts[t] ?? 0}</span>
                </button>
              ))}
            </div>
            <div className="p-3 flex flex-wrap items-center gap-2">
              <SearchInput value={query} onChange={setQuery} onSearch={() => setAppliedQuery(query)} ph="Search contracts..." width="!w-56" />
              {appliedQuery && (
                <button onClick={clearSearch} className="text-[12px] font-semibold text-slate-500 hover:text-navy flex items-center gap-1">
                  ✕ Clear
                </button>
              )}
              <button onClick={() => setFiltersOpen(true)}
                className="btn-primary !bg-white !text-navy border border-slate-300 !py-2 flex items-center gap-1.5 relative">
                <Filter size={15} /> Filters
                {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-blue-600 absolute -top-1 -right-1" />}
              </button>
              <button onClick={() => setExportOpen(true)}
                className="btn-primary !py-2 flex items-center gap-1.5"><FileText size={15} /> Export</button>
            </div>
            {/* Active filter chips */}
            {(hasActiveFilters || appliedQuery) && (
              <div className="px-3 pb-3 flex flex-wrap gap-1.5">
                {appliedQuery && <Chip label={`Search: ${appliedQuery}`} onClear={clearSearch} />}
                {filters.workType !== 'All Work Types' && <Chip label={filters.workType} onClear={() => setFilters((f) => ({ ...f, workType: 'All Work Types' }))} />}
                {filters.startFrom && <Chip label={`Start ≥ ${fmtDate(filters.startFrom)}`} onClear={() => setFilters((f) => ({ ...f, startFrom: '' }))} />}
                {filters.startTo && <Chip label={`Start ≤ ${fmtDate(filters.startTo)}`} onClear={() => setFilters((f) => ({ ...f, startTo: '' }))} />}
                {filters.endFrom && <Chip label={`End ≥ ${fmtDate(filters.endFrom)}`} onClear={() => setFilters((f) => ({ ...f, endFrom: '' }))} />}
                {filters.endTo && <Chip label={`End ≤ ${fmtDate(filters.endTo)}`} onClear={() => setFilters((f) => ({ ...f, endTo: '' }))} />}
                {filters.minValue && <Chip label={`Min ${inr(Number(filters.minValue))}`} onClear={() => setFilters((f) => ({ ...f, minValue: '' }))} />}
                {filters.maxValue && <Chip label={`Max ${inr(Number(filters.maxValue))}`} onClear={() => setFilters((f) => ({ ...f, maxValue: '' }))} />}
                <button onClick={() => { setFilters({ ...EMPTY_FILTERS, mineId }); setAppliedQuery(''); setQuery(''); }}
                  className="text-[11px] font-bold text-blue-700 hover:underline px-1">Reset all</button>
              </div>
            )}
          </div>

          {/* Contract list */}
          {list.length === 0 ? (
            <div className="card">
              <EmptyState
                title={tab === 'All Contracts' ? 'No contracts yet' : `No ${tab.toLowerCase()} contracts`}
                sub={appliedQuery || hasActiveFilters
                  ? 'No contracts match your current search and filters. Try clearing them.'
                  : mineId !== 'ALL'
                    ? `There are no contracts for ${mineLabel(mineId)} in this category. Switch to All Mines or another tab.`
                    : 'Contracts assigned to your company will appear here.'}
                action={
                  <button onClick={() => { setFilters({ ...EMPTY_FILTERS, mineId }); setAppliedQuery(''); setQuery(''); setTab('All Contracts'); }}
                    className="btn-primary !py-2 mt-1">Clear search & filters</button>
                } />
            </div>
          ) : (
            <div className="space-y-2.5">
              {list.map((c) => (
                <ContractCard key={c.id} c={c}
                  onView={() => openDrawer(c, 'Overview')}
                  menuOpen={openMenuId === c.id}
                  onToggleMenu={() => setOpenMenuId((id) => (id === c.id ? null : c.id))}
                  onAction={(a) => handleCardAction(c, a)} />
              ))}
            </div>
          )}

          {/* Requests & Renewals (kept separate from approved contracts) */}
          <RequestsPanel />
        </div>

        {/* RIGHT — Contract Value Overview + Upcoming Milestones */}
        <div className="space-y-4">
          <SectionCard title="Contract Value Overview"
            action={<InlineSelect label="Chart mine scope" value={mineId} onChange={handleMineChange}
              options={[{ id: 'ALL', label: 'All Mines' }, ...mines.map((m) => ({ id: m.id, label: m.name }))]} />}>
            {donutData.length === 0 ? (
              <EmptyState title="No contract value" sub="No contracts in scope to chart." />
            ) : (
              <>
                <Donut
                  data={donutData.map((d) => ({ name: d.name, value: Math.round(d.value / 1e5) / 100, color: d.color }))}
                  centerValue={inrCroreFigure(donutTotal)}
                  centerLabel="Total Value"
                  onPick={(s) => { setFilters((f) => ({ ...f, workType: s.name })); setTab('All Contracts'); }}
                  height={190} />
                <div className="text-[10px] text-slate-400 text-center mt-1">Values in ₹ Crore · click a slice to filter the list</div>
              </>
            )}
          </SectionCard>

          <SectionCard title="Upcoming Milestones"
            action={<button onClick={() => {
              const first = milestones[0];
              const c = first ? db.contracts.find((x) => x.id === first.contractId) : null;
              if (c) openDrawer(c, 'Milestones');
            }}
              disabled={!milestones.length}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline disabled:text-slate-300">View All ›</button>}>
            {milestones.length === 0 ? (
              <EmptyState title="No upcoming milestones" sub="Milestones for in-scope contracts will appear here." />
            ) : (
              <div>
                {milestones.slice(0, 6).map((m) => {
                  const c = db.contracts.find((x) => x.id === m.contractId);
                  if (!c) return null;
                  return <MilestoneItem key={m.id} m={m} contractName={c.name} contractId={c.id}
                    onClick={() => openDrawer(c, 'Milestones')} />;
                })}
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      {/* Dialogs / drawer */}
      {newRequestOpen && (
        <NewContractRequestDialog onClose={() => setNewRequestOpen(false)} onSubmitted={() => setNewRequestOpen(false)} />
      )}
      {renewContract && (
        <ContractRenewalDialog contract={renewContract} onClose={() => setRenewId(null)} onSubmitted={() => setRenewId(null)} />
      )}
      {exportOpen && (
        <ContractExportDialog rows={list} scopeLabel={scopeLabel} onClose={() => setExportOpen(false)} />
      )}
      {filtersOpen && (
        <ContractFiltersPanel value={{ ...filters, mineId, status: tab }}
          onApply={(f) => { setFilters((prev) => ({ ...f, status: prev.status })); if (f.mineId !== mineId) actions.setSelectedMine(f.mineId); }}
          onReset={() => { setFilters({ ...EMPTY_FILTERS, mineId }); setAppliedQuery(''); setQuery(''); }}
          onClose={() => setFiltersOpen(false)} />
      )}
      {drawerContract && (
        <ContractDetailsDrawer contract={drawerContract} initialTab={drawerTab}
          onClose={() => setDrawerId(null)}
          onRenew={() => { setDrawerId(null); setRenewId(drawerContract.id); }} />
      )}
    </RoleShell>
  );
}

// ---------- Removable filter chip ----------
function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="badge bg-blue-50 text-blue-700 border border-blue-100 pl-2.5 pr-1.5 py-1">
      {label}
      <button onClick={onClear} aria-label={`Remove ${label}`} className="ml-1 text-blue-400 hover:text-blue-700">✕</button>
    </span>
  );
}

// ---------- Requests & Renewals panel (separate from contracts) ----------
function RequestsPanel() {
  const db = useMockContracts();
  const [view, setView] = useState<'requests' | 'renewals'>('requests');
  const requests = db.requests;
  const renewals = db.renewals;

  const statusTone = (s: string) =>
    s === 'Approved' ? 'bg-green-100 text-green-700'
      : s === 'Rejected' ? 'bg-red-100 text-red-600'
        : s === 'Under Review' ? 'bg-blue-100 text-blue-700'
          : 'bg-amber-100 text-amber-700';

  const rows = view === 'requests' ? requests : renewals;

  return (
    <SectionCard title="Requests & Renewals"
      subtitle="Submitted requests stay here until the mine office approves them — they are not active contracts."
      action={
        <div className="flex gap-1">
          <button onClick={() => setView('requests')}
            className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition ${view === 'requests' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            New Requests ({requests.length})
          </button>
          <button onClick={() => setView('renewals')}
            className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition ${view === 'renewals' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            Renewals ({renewals.length})
          </button>
        </div>
      }>
      {rows.length === 0 ? (
        <EmptyState title={view === 'requests' ? 'No contract requests yet' : 'No renewal requests yet'}
          sub={view === 'requests'
            ? 'Use “New Contract Request” to propose a new contract. It will appear here pending review.'
            : 'Renewal requests for eligible contracts will appear here.'} />
      ) : (
        <div className="space-y-2">
          {rows.map((r: any) => {
            const mine = mineLabel(r.mineId);
            const isReq = 'proposedTitle' in r;
            const title = isReq ? r.proposedTitle : `${db.contracts.find((c) => c.id === r.contractId)?.name ?? r.contractId} Renewal`;
            return (
              <div key={r.id} className="border border-slate-200 rounded-xl p-3 flex flex-wrap items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  {isReq ? <FilePlus size={16} /> : <RefreshCw size={16} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-bold text-navy truncate">{title}</div>
                  <div className="text-[11px] text-slate-500">
                    <span className="font-semibold text-slate-600">{r.id}</span> · {mine} · {isReq ? r.workType : `Extends to ${fmtDate(r.proposedEndDate)}`}
                  </div>
                  <div className="text-[11px] text-slate-400">Submitted {relTime(r.createdAt)} by {r.createdBy}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[13px] font-extrabold text-navy">{inr(isReq ? r.estimatedValue : r.proposedValue)}</div>
                  <span className={`badge ${statusTone(r.status)}`}>{r.status}</span>
                </div>
              </div>
            );
          })}
          <p className="text-[11px] text-slate-400 pt-1">Requests are reviewed by the mine commercial office. You will be notified when the status changes.</p>
        </div>
      )}
    </SectionCard>
  );
}
