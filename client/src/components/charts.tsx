import { useState, type ReactNode } from 'react';
import { cx } from '../lib/styles';

// Single-series charts: one validated hue (#2a78d6, ≥3:1 on white); values are direct-labelled,
// so colour never carries meaning alone. Text uses ink tokens, never the series colour.
const SERIES = '#2a78d6';
const TRACK = '#eef2f7';

export interface BarDatum {
  label: string;
  value: number;
  hint?: string;
}

/**
 * Horizontal bar chart with direct value labels, per-bar hover/focus tooltip and a table view.
 * `max` fixes the scale (e.g. 5 for dimension scores); otherwise the largest value is used.
 */
export function HBarChart({
  data,
  max,
  format = (v) => String(v),
  labelWidth = '9rem',
  caption,
}: {
  data: BarDatum[];
  max?: number;
  format?: (v: number) => string;
  labelWidth?: string;
  caption?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const scaleMax = Math.max(max ?? 0, ...data.map((d) => d.value), 1);

  if (asTable) {
    return (
      <div>
        <table className="w-full text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <tbody>
            {data.map((d) => (
              <tr key={d.label} className="border-b border-slate-100 last:border-0">
                <td className="py-1.5 text-slate-600">{d.label}</td>
                <td className="py-1.5 text-right font-medium tabular-nums text-slate-900">{format(d.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <ViewToggle asTable onToggle={() => setAsTable(false)} />
      </div>
    );
  }

  return (
    <div>
      <div role="list" aria-label={caption} className="space-y-1.5">
        {data.map((d, i) => {
          const pct = (d.value / scaleMax) * 100;
          return (
            <div
              key={d.label}
              role="listitem"
              tabIndex={0}
              aria-label={`${d.label}: ${format(d.value)}`}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              className="group relative grid items-center gap-3 rounded-md py-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              style={{ gridTemplateColumns: `${labelWidth} 1fr` }}
            >
              <span className="truncate text-xs text-slate-600">{d.label}</span>
              <div className="flex items-center gap-2">
                <div className="relative h-4 flex-1 rounded-r" style={{ background: TRACK }}>
                  <div
                    className="h-4 rounded-r transition-[width,filter] duration-300"
                    style={{ width: `${Math.max(pct, d.value > 0 ? 1.5 : 0)}%`, background: SERIES, filter: hover === i ? 'brightness(1.15)' : undefined }}
                  />
                </div>
                <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums text-slate-800">{format(d.value)}</span>
              </div>
              {hover === i && d.hint && (
                <div className="pointer-events-none absolute top-full z-20 mt-1 max-w-sm rounded-lg bg-slate-900 px-3 py-2 text-xs text-slate-100 shadow-lg" style={{ left: `calc(${labelWidth} + 0.75rem)` }}>
                  <div className="font-semibold text-white">{format(d.value)} · {d.label}</div>
                  <div className="mt-0.5 text-slate-300">{d.hint}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <ViewToggle asTable={false} onToggle={() => setAsTable(true)} />
    </div>
  );
}

function ViewToggle({ asTable, onToggle }: { asTable: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className="mt-2 text-xs text-slate-400 hover:text-slate-600">
      {asTable ? 'View as chart' : 'View as table'}
    </button>
  );
}

export function StatTile({ label, value, sub, icon, accent }: { label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode; accent?: boolean }) {
  return (
    <div className={cx('rounded-xl p-4 ring-1', accent ? 'bg-blue-600 text-white ring-blue-600' : 'bg-white ring-slate-200')}>
      <div className={cx('flex items-center justify-between text-xs font-medium', accent ? 'text-blue-100' : 'text-slate-500')}>
        {label}
        {icon}
      </div>
      <div className={cx('mt-2 text-2xl font-semibold', accent ? 'text-white' : 'text-slate-900')}>{value}</div>
      {sub && <div className={cx('mt-1 text-xs', accent ? 'text-blue-100' : 'text-slate-500')}>{sub}</div>}
    </div>
  );
}

/** A single ratio against a limit, e.g. the daily application budget. */
export function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = Math.min(100, (value / Math.max(max, 1)) * 100);
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-slate-600">
        <span>{label}</span>
        <span className="font-medium tabular-nums text-slate-800">
          {value} / {max}
        </span>
      </div>
      <div className="h-2 rounded-full bg-blue-100" role="meter" aria-valuenow={value} aria-valuemax={max} aria-label={label}>
        <div className="h-2 rounded-full bg-blue-600" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
