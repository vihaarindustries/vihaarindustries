export const toRupees = (minor: number | null | undefined) => (minor ?? 0) / 100;
export const toMinor = (rupees: string | number) => {
  const n = typeof rupees === 'number' ? rupees : parseFloat(String(rupees).replace(/,/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
};

export function fmtMoney(minor: number | null | undefined, currency = 'INR', opts: { compact?: boolean; decimals?: boolean } = {}) {
  const v = toRupees(minor);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency, notation: opts.compact ? 'compact' : 'standard',
    minimumFractionDigits: opts.decimals === false ? 0 : Number.isInteger(v) && !opts.decimals ? 0 : 2,
    maximumFractionDigits: opts.decimals === false ? 0 : 2,
  }).format(v);
}
export const fmtNum = (n: number | string | null | undefined, max = 3) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: max }).format(Number(n ?? 0));
export const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const fmtDateTime = (d?: string | null) =>
  d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';

export const slugify = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 80);

export const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
