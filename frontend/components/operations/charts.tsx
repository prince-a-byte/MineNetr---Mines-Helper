'use client';
/**
 * Shared chart primitives built on Recharts — the same visual language on
 * all 11 pages (donut with center total, horizontal/vertical bars with
 * value labels, stacked trend bars). Every chart accepts an onPick handler
 * so clicking a segment/series filters the related records.
 */
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { AXIS, CHART, TOOLTIP_STYLE } from './hooks';

const PALETTE = [CHART.blue, CHART.green, CHART.amber, CHART.red, CHART.purple, CHART.cyan, CHART.slate, CHART.orange];

export interface Slice { name: string; value: number; color?: string }

/** Donut with a center total (e.g. "12 Total Contractors"). */
export function Donut({ data, centerLabel, centerValue, onPick, height = 190, legend = true }: {
  data: Slice[]; centerLabel?: string; centerValue?: string;
  onPick?: (s: Slice) => void; height?: number; legend?: boolean;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div>
      <div className="relative" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="86%"
              paddingAngle={2} strokeWidth={0} cursor={onPick ? 'pointer' : 'default'}
              onClick={(s: any) => onPick?.(s as Slice)}>
              {data.map((d, i) => <Cell key={d.name} fill={d.color ?? PALETTE[i % PALETTE.length]} />)}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE}
              formatter={(v: number, n: string) => [`${v.toLocaleString('en-IN')} (${total ? Math.round((v / total) * 100) : 0}%)`, n]} />
          </PieChart>
        </ResponsiveContainer>
        {(centerValue || centerLabel) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            {centerValue && <div className="text-lg font-extrabold text-navy leading-tight">{centerValue}</div>}
            {centerLabel && <div className="text-[10px] text-slate-500 text-center max-w-[90px]">{centerLabel}</div>}
          </div>
        )}
      </div>
      {legend && (
        <div className="space-y-1.5 mt-1">
          {data.map((d, i) => (
            <button key={d.name} onClick={() => onPick?.(d)} disabled={!onPick}
              className={`w-full flex items-center gap-2 text-[12px] text-slate-600 ${onPick ? 'hover:bg-blue-50 rounded-lg px-1 -mx-1 cursor-pointer' : 'cursor-default'}`}>
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color ?? PALETTE[i % PALETTE.length] }} />
              <span className="flex-1 text-left truncate">{d.name}</span>
              <span className="font-bold text-navy">{d.value.toLocaleString('en-IN')}{total ? ` (${Math.round((d.value / total) * 100)}%)` : ''}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Vertical bars with value labels on top (manpower by contractor etc.). */
export function VBars({ data, color = CHART.blue, height = 190, unit = '', onPick }: {
  data: { name: string; value: number; color?: string }[]; color?: string; height?: number; unit?: string;
  onPick?: (d: { name: string; value: number }) => void;
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 18, right: 6, left: -18, bottom: 0 }}
          onClick={(s: any) => { if (s?.activeLabel && onPick) onPick(data.find((d) => d.name === s.activeLabel)!); }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
          <XAxis dataKey="name" tick={{ ...AXIS }} interval={0} angle={data.length > 5 ? -20 : 0} textAnchor={data.length > 5 ? 'end' : 'middle'} height={data.length > 5 ? 52 : 30} />
          <YAxis tick={{ ...AXIS }} />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: '#eff6ff' }}
            formatter={(v: number) => [`${v.toLocaleString('en-IN')}${unit}`, 'Value']} />
          <Bar dataKey="value" radius={[5, 5, 0, 0]} cursor={onPick ? 'pointer' : 'default'}>
            {data.map((d, i) => <Cell key={d.name} fill={d.color ?? PALETTE[i % PALETTE.length] ?? color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal bars with name + value + percent rows (top destinations etc.). */
export function HBarRows({ data, total, color = CHART.blue, onPick }: {
  data: { name: string; value: number; display?: string; color?: string }[]; total?: number; color?: string;
  onPick?: (d: { name: string; value: number }) => void;
}) {
  const tot = total ?? data.reduce((s, d) => s + d.value, 0);
  const max = Math.max(1, ...data.map((d) => d.value));
  const colors = [CHART.blue, CHART.green, CHART.amber, CHART.purple, CHART.red, CHART.cyan];
  return (
    <div className="space-y-2.5">
      {data.map((d, i) => (
        <button key={d.name} onClick={() => onPick?.(d)} disabled={!onPick}
          className={`w-full text-left ${onPick ? 'hover:opacity-80' : 'cursor-default'}`}>
          <div className="flex items-center gap-2 text-[12px] mb-1">
            <span className="font-bold text-navy truncate">{d.name}</span>
            <span className="ml-auto font-extrabold text-navy whitespace-nowrap">{d.display ?? d.value.toLocaleString('en-IN')}</span>
            <span className="text-slate-400 w-10 text-right">{tot ? `${Math.round((d.value / tot) * 100)}%` : ''}</span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${(d.value / max) * 100}%`, background: d.color ?? colors[i % colors.length] ?? color }} />
          </div>
        </button>
      ))}
    </div>
  );
}

/** Grouped/trend bars with optional overlay line (production vs dispatch etc.). */
export function TrendBars({ data, bars, line, height = 220, xKey = 'label', onPick }: {
  data: any[];
  bars: { key: string; name: string; fill: string }[];
  line?: { key: string; name: string; stroke: string };
  height?: number; xKey?: string;
  onPick?: (row: any) => void;
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
          onClick={(s: any) => { if (s?.activeLabel && onPick) onPick(data.find((d) => d[xKey] === s.activeLabel)); }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
          <XAxis dataKey={xKey} tick={{ ...AXIS }} interval={data.length > 12 ? Math.ceil(data.length / 8) - 1 : 0} />
          <YAxis tick={{ ...AXIS }} yAxisId="left" />
          {line && <YAxis yAxisId="right" orientation="right" tick={{ ...AXIS }} />}
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: '#eff6ff' }} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
          {bars.map((b) => <Bar key={b.key} dataKey={b.key} name={b.name} fill={b.fill} radius={[3, 3, 0, 0]} yAxisId="left" />)}
          {line && <Line key={line.key} dataKey={line.key} name={line.name} stroke={line.stroke} strokeWidth={2} dot={false} yAxisId="right" type="monotone" />}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Stacked trend bars (attendance trend, inspection trend). */
export function StackedBars({ data, series, height = 210, xKey = 'label', onPick }: {
  data: any[]; series: { key: string; name: string; fill: string }[]; height?: number; xKey?: string;
  onPick?: (row: any) => void;
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}
          onClick={(s: any) => { if (s?.activeLabel && onPick) onPick(data.find((d) => d[xKey] === s.activeLabel)); }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
          <XAxis dataKey={xKey} tick={{ ...AXIS }} interval={data.length > 10 ? 1 : 0} />
          <YAxis tick={{ ...AXIS }} />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: '#eff6ff' }} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="total" name="Total" hide />
          {series.map((s) => <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.fill} stackId="st" radius={[0, 0, 0, 0]} />)}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Simple line (contractor workforce trend, bill trend). */
export function TrendLine({ data, lines, height = 190, xKey = 'label', onPick }: {
  data: any[]; lines: { key: string; name: string; stroke: string; dashed?: boolean }[];
  height?: number; xKey?: string; onPick?: (row: any) => void;
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}
          onClick={(s: any) => { if (s?.activeLabel && onPick) onPick(data.find((d) => d[xKey] === s.activeLabel)); }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
          <XAxis dataKey={xKey} tick={{ ...AXIS }} interval={data.length > 10 ? Math.ceil(data.length / 7) - 1 : 0} />
          <YAxis tick={{ ...AXIS }} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
          {lines.map((l) => (
            <Line key={l.key} dataKey={l.key} name={l.name} stroke={l.stroke} strokeWidth={2}
              strokeDasharray={l.dashed ? '5 4' : undefined} dot={data.length <= 14} type="monotone" />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
