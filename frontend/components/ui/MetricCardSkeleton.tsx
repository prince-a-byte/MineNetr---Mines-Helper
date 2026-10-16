import { Skel } from './Skel';

/** Placeholder matching the .card KPI layout (icon + label + metric + sub). */
export default function MetricCardSkeleton() {
  return (
    <div className="card !p-4 flex gap-3 items-start" aria-hidden="true">
      <Skel style={{ width: 48, height: 48, borderRadius: 12 }} />
      <div className="flex-1 space-y-2">
        <Skel style={{ width: '55%', height: 12 }} />
        <Skel style={{ width: '40%', height: 24 }} />
        <Skel style={{ width: '70%', height: 11 }} />
      </div>
    </div>
  );
}
