export class ValidationError extends Error {}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);

/** Tiny schema language shared by the RPC endpoint. */
export type Schema =
  | { t: 'uuid'; optional?: boolean }
  | { t: 'str'; max?: number; min?: number; optional?: boolean; oneOf?: string[]; pattern?: RegExp }
  | { t: 'int'; min?: number; max?: number; optional?: boolean }
  | { t: 'num'; min?: number; max?: number; optional?: boolean }
  | { t: 'bool'; optional?: boolean }
  | { t: 'date'; optional?: boolean }
  | { t: 'iso'; optional?: boolean }
  | { t: 'obj'; optional?: boolean; maxBytes?: number }
  | { t: 'arr'; of: Schema; min?: number; max?: number; optional?: boolean }
  | { t: 'shape'; fields: Record<string, Schema>; optional?: boolean };

export function check(s: Schema, v: unknown, path = 'value'): unknown {
  const empty = v === undefined || v === null || v === '';
  if (empty) { if ('optional' in s && s.optional) return null; throw new ValidationError(`${path} is required.`); }
  switch (s.t) {
    case 'uuid': if (!isUuid(v)) throw new ValidationError(`${path} is not valid.`); return v;
    case 'str': {
      if (typeof v !== 'string') throw new ValidationError(`${path} must be text.`);
      const t = v.trim();
      if (s.min && t.length < s.min) throw new ValidationError(`${path} is too short.`);
      if (t.length > (s.max ?? 500)) throw new ValidationError(`${path} is too long.`);
      if (s.oneOf && !s.oneOf.includes(t)) throw new ValidationError(`${path} is not an allowed option.`);
      if (s.pattern && !s.pattern.test(t)) throw new ValidationError(`${path} has an invalid format.`);
      return t;
    }
    case 'int': case 'num': {
      const n = typeof v === 'number' ? v : Number(v);
      if (!Number.isFinite(n) || (s.t === 'int' && !Number.isSafeInteger(n))) throw new ValidationError(`${path} must be a ${s.t === 'int' ? 'whole ' : ''}number.`);
      if (s.min !== undefined && n < s.min) throw new ValidationError(`${path} is too small.`);
      if (n > (s.max ?? 1e12)) throw new ValidationError(`${path} is too large.`);
      return n;
    }
    case 'bool': if (typeof v !== 'boolean') throw new ValidationError(`${path} must be true or false.`); return v;
    case 'date': if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) throw new ValidationError(`${path} must be a date.`); return v;
    case 'iso': { const d = new Date(String(v)); if (Number.isNaN(d.getTime())) throw new ValidationError(`${path} must be a date and time.`); return d.toISOString(); }
    case 'obj':
      if (typeof v !== 'object' || Array.isArray(v) || JSON.stringify(v).length > (s.maxBytes ?? 2000)) throw new ValidationError(`${path} is not valid.`);
      return v;
    case 'arr': {
      if (!Array.isArray(v)) throw new ValidationError(`${path} must be a list.`);
      if (v.length < (s.min ?? 0) || v.length > (s.max ?? 100)) throw new ValidationError(`${path} has the wrong number of entries.`);
      return v.map((x, i) => check(s.of, x, `${path} ${i + 1}`));
    }
    case 'shape': {
      if (typeof v !== 'object' || Array.isArray(v)) throw new ValidationError(`${path} is not valid.`);
      const out: Record<string, unknown> = {};
      for (const [k, sub] of Object.entries(s.fields)) { const r = check(sub, (v as Record<string, unknown>)[k], `${path}.${k}`); if (r !== null) out[k] = r; }
      return out;
    }
  }
}
