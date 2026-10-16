import MetricCardSkeleton from './MetricCardSkeleton';
import ChartSkeleton from './ChartSkeleton';
import TableSkeleton from './TableSkeleton';
import { Skel } from './Skel';

/**
 * Full dashboard loading layout: sidebar + topbar chrome skeleton with
 * content-area KPI / chart / table skeletons. Used by route loading.tsx
 * boundaries so navigation shows structure, never a blank page or a
 * whole-screen cinematic overlay.
 */
export default function DashboardSkeleton({
  kpis = 5,
  tableColumns,
  showChart = true,
}: {
  kpis?: number;
  tableColumns?: string[];
  showChart?: boolean;
}) {
  return (
    <div className="min-h-screen flex bg-[#f1f5f9]" role="status" aria-label="Loading dashboard">
      {/* sidebar chrome */}
      <aside className="hidden md:flex w-[248px] shrink-0 flex-col p-5" style={{ background: '#0a1836' }} aria-hidden="true">
        <div className="flex items-center gap-2.5 mb-6">
          <Skel style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(100deg,#16294d 30%,#1d3560 48%,#16294d 66%)' }} />
          <Skel style={{ width: 110, height: 18, background: 'linear-gradient(100deg,#16294d 30%,#1d3560 48%,#16294d 66%)' }} />
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <Skel key={i} style={{ height: 38, borderRadius: 12, marginBottom: 6, opacity: i === 0 ? 1 : 0.55, background: 'linear-gradient(100deg,#16294d 30%,#1d3560 48%,#16294d 66%)' }} />
        ))}
      </aside>
      <div className="flex-1 min-w-0">
        {/* topbar chrome */}
        <div className="bg-white border-b px-4 py-2.5 flex items-center gap-3" aria-hidden="true">
          <Skel style={{ width: 220, height: 16 }} />
          <div className="ml-auto flex items-center gap-3">
            <Skel style={{ width: 36, height: 36, borderRadius: 999 }} />
            <Skel style={{ width: 36, height: 36, borderRadius: 999 }} />
          </div>
        </div>
        {/* banner placeholder */}
        <div className="m-4 rounded-2xl overflow-hidden" aria-hidden="true">
          <div className="p-6 md:p-7" style={{ background: 'linear-gradient(100deg,#e8f0fe,#cfdef8)' }}>
            <Skel style={{ width: 260, height: 30, background: '#fff', opacity: 0.9 }} />
            <Skel style={{ width: 380, height: 13, marginTop: 10, background: '#fff', opacity: 0.7 }} />
          </div>
        </div>
        <main className="px-4 pb-10" aria-hidden="true">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            {Array.from({ length: kpis }).map((_, i) => <MetricCardSkeleton key={i} />)}
          </div>
          <div className="grid xl:grid-cols-3 gap-3 mt-3">
            <div className="card"><ChartSkeleton /></div>
            <div className="card"><ChartSkeleton bars={5} height={150} /></div>
            <div className="card space-y-3">
              <Skel style={{ width: '45%', height: 16 }} />
              {Array.from({ length: 5 }).map((_, i) => <Skel key={i} style={{ height: 44, borderRadius: 12 }} />)}
            </div>
          </div>
          {tableColumns && showChart ? (
            <div className="card mt-3"><TableSkeleton columns={tableColumns} rows={5} /></div>
          ) : null}
        </main>
      </div>
    </div>
  );
}
