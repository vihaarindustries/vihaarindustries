import 'server-only';
import { ValidationError, isUuid } from './validate';
import type { FieldDef, ResourceDef } from './resources';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[0-9+()\-\s]{6,30}$/;
const STORAGE_PATH = /^[A-Za-z0-9][A-Za-z0-9/_\-.]{0,198}$/;

const blank = (v: unknown) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

function one(f: FieldDef, v: unknown, all: Record<string, unknown>): unknown {
  const label = f.label;
  switch (f.type) {
    case 'text': case 'textarea': case 'email': case 'phone': case 'slug': case 'select': {
      if (typeof v !== 'string') throw new ValidationError(`${label} must be text.`);
      let t = v.trim();
      if (f.type !== 'textarea') t = t.replace(/[\r\n\t]+/g, ' ');
      if (f.min && t.length < f.min) throw new ValidationError(`${label} is too short.`);
      if (t.length > (f.max ?? (f.type === 'textarea' ? 4000 : 200))) throw new ValidationError(`${label} is too long.`);
      if (f.type === 'slug' && !SLUG.test(t)) throw new ValidationError(`${label} may only use lowercase letters, numbers and hyphens.`);
      if (f.type === 'email' && !EMAIL.test(t)) throw new ValidationError(`${label} is not a valid email address.`);
      if (f.type === 'phone' && !PHONE.test(t)) throw new ValidationError(`${label} is not a valid phone number.`);
      if (f.type === 'select' && !f.options?.some((o) => o.value === t)) throw new ValidationError(`${label} is not an allowed option.`);
      return t;
    }
    case 'number': case 'money': case 'moneyOrPercent': {
      const n = typeof v === 'number' ? v : Number(v);
      if (!Number.isFinite(n)) throw new ValidationError(`${label} must be a number.`);
      if (f.type === 'money' && !Number.isSafeInteger(n)) throw new ValidationError(`${label} must be a whole number of paise.`);
      if (f.integer && !Number.isSafeInteger(n)) throw new ValidationError(`${label} must be a whole number.`);
      const min = f.min ?? 0; const max = f.max ?? 1e12;
      if (n < min) throw new ValidationError(`${label} is too small.`);
      if (n > max) throw new ValidationError(`${label} is too large.`);
      if (f.type === 'moneyOrPercent') {
        const kind = f.typeField ? all[f.typeField] : undefined;
        if (kind === 'percentage' && n > 100) throw new ValidationError(`${label} cannot be more than 100%.`);
        if (kind === 'fixed' && !Number.isSafeInteger(n)) throw new ValidationError(`${label} must be a whole number of paise.`);
      }
      return n;
    }
    case 'bool': if (typeof v !== 'boolean') throw new ValidationError(`${label} must be yes or no.`); return v;
    case 'date': if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) throw new ValidationError(`${label} must be a date.`); return v;
    case 'datetime': { const d = new Date(String(v)); if (Number.isNaN(d.getTime())) throw new ValidationError(`${label} must be a date and time.`); return d.toISOString(); }
    case 'kv': {
      if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new ValidationError(`${label} is not valid.`);
      const entries = Object.entries(v as Record<string, unknown>);
      if (entries.length > 30) throw new ValidationError(`${label} has too many rows.`);
      const out: Record<string, string> = {};
      for (const [k, val] of entries) {
        const key = k.trim();
        if (!key) continue;
        if (key.length > 60 || typeof val !== 'string' || val.length > 400) throw new ValidationError(`${label} has an entry that is too long.`);
        out[key] = val;
      }
      return out;
    }
    case 'image': case 'file':
      if (typeof v !== 'string' || !STORAGE_PATH.test(v) || v.includes('..')) throw new ValidationError(`${label} is not a valid file.`);
      return v;
    case 'ref': if (!isUuid(v)) throw new ValidationError(`${label} is not valid.`); return v;
    case 'multiref':
      if (!Array.isArray(v) || v.length > 100 || !v.every(isUuid)) throw new ValidationError(`${label} is not valid.`);
      return v;
  }
}

/** Per-field adjustments that cannot be expressed by the generic field types. */
function adjust(resource: string, name: string, value: unknown) {
  if (resource === 'customers' && name === 'tags' && typeof value === 'string')
    return value.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 12).map((t) => t.slice(0, 30));
  if ((resource === 'customers' || resource === 'suppliers') && name === 'country_code' && typeof value === 'string') return value.toUpperCase();
  if (resource === 'promotions' && name === 'code' && typeof value === 'string') return value.toUpperCase().replace(/\s+/g, '');
  return value;
}

/** Builds the row to write. Only fields declared in the resource definition can ever be written. */
export function buildPayload(def: ResourceDef, body: Record<string, unknown>, mode: 'create' | 'update') {
  const out: Record<string, unknown> = {};
  const merged = { ...(def.defaults ?? {}), ...body };
  for (const f of def.fields) {
    if (f.readOnly) continue;
    if (mode === 'update' && (f.lockOnEdit || f.hideInForm)) continue;
    const provided = Object.prototype.hasOwnProperty.call(body, f.name);
    if (!provided) {
      if (mode === 'create' && f.required) throw new ValidationError(`${f.label} is required.`);
      if (mode === 'create' && f.default !== undefined) out[f.name] = f.default;
      continue;
    }
    const raw = body[f.name];
    if (blank(raw) && !(f.type === 'bool') && !(f.type === 'multiref' && Array.isArray(raw)) && !(f.type === 'kv' && raw && typeof raw === 'object')) {
      if (f.required) throw new ValidationError(`${f.label} is required.`);
      out[f.name] = f.type === 'kv' ? {} : null;
      continue;
    }
    out[f.name] = adjust(def.key, f.name, one(f, raw, merged));
  }
  if (def.key === 'customers' && out.tags === null) out.tags = [];
  if (mode === 'create' && def.fixed) Object.assign(out, def.fixed);
  return out;
}

/** Search text is placed inside a PostgREST filter, so strip the characters that have meaning there. */
export const cleanSearch = (q: string) => q.replace(/[,()*%\\:"'`;]/g, ' ').trim().slice(0, 60);

export const parsePaging = (sp: URLSearchParams, max = 100) => {
  const page = Math.max(1, Math.min(1000, parseInt(sp.get('page') || '1', 10) || 1));
  const size = Math.max(1, Math.min(max, parseInt(sp.get('size') || '25', 10) || 25));
  return { page, size, from: (page - 1) * size, to: (page - 1) * size + size - 1 };
};

export function allowedFilters(def: ResourceDef) {
  const cols = new Set<string>([...(def.filters ?? []).map((f) => f.column), ...(def.filterable ?? [])]);
  return cols;
}

export const diff = (before: Record<string, unknown> | null, after: Record<string, unknown>) => {
  const b: Record<string, unknown> = {}; const a: Record<string, unknown> = {};
  for (const k of Object.keys(after)) {
    if (JSON.stringify(before?.[k]) !== JSON.stringify(after[k])) { if (before) b[k] = before[k]; a[k] = after[k]; }
  }
  return { before: before ? b : null, after: a };
};

const dig = (row: Record<string, unknown>, path: string) => path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), row);
/** CSV with spreadsheet-formula neutralisation (cells starting with = + - @ are prefixed with a quote). */
export function toCsv(def: ResourceDef, rows: Record<string, unknown>[]) {
  const cell = (v: unknown) => {
    let s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const cols = def.columns.filter((c) => c.type !== 'image' && c.label);
  const head = cols.map((c) => cell(c.label)).join(',');
  const lines = rows.map((r) => cols.map((c) => cell(c.type === 'money' && typeof dig(r, c.key) === 'number' ? (dig(r, c.key) as number) / 100 : dig(r, c.key))).join(','));
  return '\uFEFF' + [head, ...lines].join('\r\n');
}

export const storageRefs = (def: ResourceDef, row: Record<string, unknown> | null) =>
  def.fields.filter((f) => (f.type === 'image' || f.type === 'file') && f.bucket && row && typeof row[f.name] === 'string')
    .map((f) => ({ bucket: f.bucket as string, path: row![f.name] as string }));
