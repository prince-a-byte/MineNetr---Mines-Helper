import { Skel } from './Skel';

/** Chart skeleton: container + axis lines + placeholder bars, restrained shimmer. */
export default function ChartSkeleton({ height = 190, bars = 7 }: { height?: number; bars?: number }) {
  const widths = [62, 78, 55, 84, 70, 60, 76, 66, 80, 58];
  return (
    <div role="status" aria-label="Loading chart">
      <div className="flex items-end gap-2 px-1" style={{ height }} aria-hidden="true">
        {Array.from({ length: bars }).map((_, i) => (
          <Skel
            key={i}
            style={{
              flex: 1,
              height: `${widths[i % widths.length]}%`,
              borderRadius: '6px 6px 2px 2px',
              minHeight: 24,
            }}
          />
        ))}
      </div>
      <Skel style={{ height: 2, marginTop: 8, borderRadius: 2 }} />
    </div>
  );
}
