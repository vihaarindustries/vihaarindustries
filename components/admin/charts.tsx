'use client';
import { useId } from 'react';

type Pt = { label: string; value: number; value2?: number };
const niceMax = (n: number) => { if (n <= 0) return 1; const p = 10 ** Math.floor(Math.log10(n)); const m = n / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; };

/** Simple responsive area/line chart. `value2` draws a second line. */
export function LineChart({ data, format = (n) => String(n), color = '#00994d', color2 = '#c8892b', label, label2 }: { data: Pt[]; format?: (n: number) => string; color?: string; color2?: string; label?: string; label2?: string }) {
  const id = useId();
  const W = 640, H = 220, L = 46, R = 12, T = 14, B = 28;
  if (!data.length) return <div className="text-sm muted text-center py-16">No data for this period yet.</div>;
  const max = niceMax(Math.max(...data.flatMap((d) => [d.value, d.value2 ?? 0])));
  const x = (i: number) => L + (data.length === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (data.length - 1));
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const path = (k: 'value' | 'value2') => data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d[k] ?? 0).toFixed(1)}`).join(' ');
  const area = `${path('value')} L${x(data.length - 1)},${H - B} L${x(0)},${H - B} Z`;
  const ticks = [0, 0.5, 1].map((t) => t * max);
  const step = Math.max(1, Math.ceil(data.length / 7));
  return <div>
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={label ?? 'Chart'}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".22" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      {ticks.map((t) => <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#e5e7e5" /><text x={L - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="#6b746c">{format(t)}</text></g>)}
      <path d={area} fill={`url(#${id})`} /><path d={path('value')} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" />
      {data.some((d) => d.value2 !== undefined) && <path d={path('value2')} fill="none" stroke={color2} strokeWidth="2" strokeDasharray="5 4" />}
      {data.map((d, i) => <g key={i}>{data.length <= 31 && <circle cx={x(i)} cy={y(d.value)} r="2.6" fill={color}><title>{`${d.label}: ${format(d.value)}`}</title></circle>}
        {i % step === 0 && <text x={x(i)} y={H - 9} textAnchor="middle" fontSize="10" fill="#6b746c">{d.label}</text>}</g>)}
    </svg>
    {(label || label2) && <div className="flex gap-4 text-xs muted justify-center mt-1">{label && <span><i className="inline-block w-3 h-0.5 align-middle mr-1.5" style={{ background: color }} />{label}</span>}{label2 && <span><i className="inline-block w-3 h-0.5 align-middle mr-1.5" style={{ background: color2 }} />{label2}</span>}</div>}
  </div>;
}

/** Horizontal bars with the value on the right. */
export function BarList({ items, format = (n) => n.toLocaleString('en-IN'), empty = 'No data yet.' }: { items: { name: string; value: number; sub?: string }[]; format?: (n: number) => string; empty?: string }) {
  if (!items.length) return <div className="text-sm muted py-6 text-center">{empty}</div>;
  const max = Math.max(...items.map((i) => i.value), 1);
  return <ul className="space-y-3">{items.map((i) => <li key={i.name}>
    <div className="flex justify-between gap-3 text-sm"><span className="truncate font-semibold">{i.name}{i.sub && <span className="muted font-normal"> · {i.sub}</span>}</span><span className="tabular-nums font-bold shrink-0">{format(i.value)}</span></div>
    <div className="h-2 bg-gray-100 rounded-full mt-1.5 overflow-hidden"><div className="h-full bg-vihaar-green rounded-full" style={{ width: `${Math.max(3, (i.value / max) * 100)}%` }} /></div></li>)}</ul>;
}

export function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  const max = Math.max(...steps.map((s) => s.value), 1);
  return <ol className="space-y-2.5">{steps.map((s, i) => {
    const prev = i ? steps[i - 1].value : 0; const rate = i && prev ? Math.round((s.value / prev) * 1000) / 10 : null;
    return <li key={s.label}><div className="flex justify-between text-sm"><span className="font-semibold">{s.label}</span><span className="tabular-nums"><b>{s.value.toLocaleString('en-IN')}</b>{rate !== null && <span className="muted text-xs"> · {rate}% of previous</span>}</span></div>
      <div className="h-7 bg-gray-100 rounded mt-1"><div className="h-full rounded bg-gradient-to-r from-[#00994d] to-[#19b96a]" style={{ width: `${Math.max(2, (s.value / max) * 100)}%` }} /></div></li>;
  })}</ol>;
}
