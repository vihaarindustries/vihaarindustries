import type { FieldDef, ResourceDef } from './resources';

export type KvRow = { k: string; v: string };
export type FormValue = string | boolean | string[] | KvRow[];
export type FormValues = Record<string, FormValue>;

const pad = (n: number) => String(n).padStart(2, '0');
export const isoToLocalInput = (iso?: string | null) => {
  if (!iso) return ''; const d = new Date(iso); if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const trimNum = (n: number) => String(Math.round(n * 1000) / 1000);

export function toFormValues(def: ResourceDef, row: Record<string, unknown> | null, extra: Record<string, unknown> = {}): FormValues {
  const out: FormValues = {};
  const src = { ...(row ? {} : { ...(def.defaults ?? {}) }), ...(row ?? {}), ...(row ? {} : extra) };
  for (const f of def.fields) {
    const raw = src[f.name] ?? (row ? null : f.default ?? null);
    switch (f.type) {
      case 'bool': out[f.name] = !!raw; break;
      case 'money': out[f.name] = raw == null || raw === '' ? '' : trimNum(Number(raw) / 100); break;
      case 'moneyOrPercent': {
        const kind = (src[f.typeField ?? ''] ?? 'percentage') as string;
        out[f.name] = raw == null || raw === '' ? '' : kind === 'fixed' ? trimNum(Number(raw) / 100) : trimNum(Number(raw)); break;
      }
      case 'number': out[f.name] = raw == null ? '' : String(raw); break;
      case 'datetime': out[f.name] = isoToLocalInput(raw as string); break;
      case 'kv': out[f.name] = Object.entries((raw as Record<string, string>) ?? {}).map(([k, v]) => ({ k, v: String(v) })); break;
      case 'multiref': out[f.name] = Array.isArray(raw) ? (raw as string[]) : []; break;
      default: out[f.name] = Array.isArray(raw) ? raw.join(', ') : raw == null ? '' : String(raw);
    }
  }
  return out;
}

export function toPayload(def: ResourceDef, values: FormValues, initial: FormValues | null) {
  const out: Record<string, unknown> = {};
  const kind = (f: FieldDef) => (f.typeField ? (values[f.typeField] as string) : undefined);
  for (const f of def.fields) {
    if (f.readOnly || (initial && (f.lockOnEdit || f.hideInForm))) continue;
    const v = values[f.name];
    if (initial && JSON.stringify(v) === JSON.stringify(initial[f.name]) && !(f.type === 'moneyOrPercent' && kind(f) !== initialKind(def, initial, f))) continue;
    switch (f.type) {
      case 'bool': out[f.name] = !!v; break;
      case 'money': out[f.name] = v === '' ? null : Math.round(Number(String(v).replace(/,/g, '')) * 100); break;
      case 'moneyOrPercent': out[f.name] = v === '' ? null : kind(f) === 'fixed' ? Math.round(Number(String(v).replace(/,/g, '')) * 100) : Number(v); break;
      case 'number': out[f.name] = v === '' ? null : Number(v); break;
      case 'datetime': out[f.name] = v ? new Date(String(v)).toISOString() : null; break;
      case 'kv': out[f.name] = Object.fromEntries((v as KvRow[]).filter((r) => r.k.trim()).map((r) => [r.k.trim(), r.v])); break;
      case 'multiref': out[f.name] = v; break;
      default: out[f.name] = typeof v === 'string' ? (v.trim() === '' ? null : v) : v;
    }
  }
  return out;
}
const initialKind = (_d: ResourceDef, initial: FormValues, f: FieldDef) => (f.typeField ? (initial[f.typeField] as string) : undefined);

export const dig = (row: Record<string, unknown>, path: string): unknown =>
  path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), row);
