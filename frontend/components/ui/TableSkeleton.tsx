import { Skel } from './Skel';

/** Table skeleton: preserves real headers + column widths, placeholder rows. */
export default function TableSkeleton({
  columns,
  rows = 6,
}: {
  columns: string[];
  rows?: number;
}) {
  return (
    <div className="overflow-x-auto" role="status" aria-label="Loading table data">
      <table className="dense w-full min-w-[860px]">
        <thead>
          <tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {columns.map((c, i) => (
                <td key={c}>
                  <Skel style={{ width: i === 0 ? '62%' : `${58 + ((r * 7 + i * 13) % 30)}%`, height: 13 }} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
