import { audit, dbError, fail, ok, readJson, requireStaff } from '@/lib/admin/http';
import { ValidationError, check, type Schema } from '@/lib/admin/validate';
import type { StaffRole } from '@/lib/admin/permissions';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ key: string }> | { key: string } };

const CONTENT: StaffRole[] = ['owner', 'admin', 'content_manager'];
const ADMIN: StaffRole[] = ['owner', 'admin'];
const s = (max: number, optional = true): Schema => ({ t: 'str', max, optional });

const SETTINGS: Record<string, { read: StaffRole[]; write: StaffRole[]; schema: Schema }> = {
  nav_visibility: { read: CONTENT, write: CONTENT, schema: { t: 'shape', fields: {
    items: { t: 'arr', min: 1, max: 12, of: { t: 'shape', fields: { key: { t: 'str', max: 30, pattern: /^[a-z0-9_-]+$/ }, label: s(40, false), href: { t: 'str', max: 120, pattern: /^(\/|#)[A-Za-z0-9/_#?=&.\-]*$/ }, visible: { t: 'bool' } } } },
    show_switch: { t: 'bool' }, show_signin: { t: 'bool' } } } },
  chatbot_config: { read: CONTENT, write: CONTENT, schema: { t: 'shape', fields: {
    enabled: { t: 'bool' }, name: s(40, false), greeting: s(300, false),
    suggestions: { t: 'arr', max: 6, of: { t: 'str', max: 80 } } } } },
  chatbot_knowledge: { read: CONTENT, write: CONTENT, schema: { t: 'shape', fields: { text: s(6000) } } },
  referral_program: { read: ['owner', 'admin', 'finance', 'content_manager', 'operations'], write: ADMIN, schema: { t: 'shape', fields: {
    enabled: { t: 'bool' }, referrer_reward_minor: { t: 'int', min: 0, max: 1e9 },
    referee_discount_type: { t: 'str', oneOf: ['percentage', 'fixed'] }, referee_discount_value: { t: 'num', min: 0, max: 1e9 }, min_order_minor: { t: 'int', min: 0, max: 1e10 } } } },
};
const PUBLIC_KEYS = new Set(['nav_visibility', 'chatbot_config']);
const has = (k: string) => Object.prototype.hasOwnProperty.call(SETTINGS, k);

export async function GET(req: Request, { params }: Ctx) {
  const key = (await params).key;
  if (!has(key)) return fail('Not found.', 404);
  const g = await requireStaff(req, SETTINGS[key].read);
  if ('res' in g) return g.res;
  const { data, error } = await g.ctx.supabase.from('site_settings').select('value, updated_at').eq('key', key).maybeSingle();
  if (error) return dbError(error);
  return ok(data ?? { value: {}, updated_at: null });
}

export async function PUT(req: Request, { params }: Ctx) {
  const key = (await params).key;
  if (!has(key)) return fail('Not found.', 404);
  const def = SETTINGS[key];
  const g = await requireStaff(req, def.write, true);
  if ('res' in g) return g.res;
  const body = await readJson(req, 60_000);
  if (!body) return fail('Invalid request.');
  let value: unknown;
  try {
    // cross-field rule: a percentage discount cannot exceed 100
    value = check(def.schema, body.value, 'value');
    const v = value as Record<string, unknown>;
    if (key === 'referral_program' && v.referee_discount_type === 'percentage' && Number(v.referee_discount_value) > 100) throw new ValidationError('Percentage cannot exceed 100.');
  } catch (e) { if (e instanceof ValidationError) return fail(e.message, 422); throw e; }
  const { data: before } = await g.ctx.supabase.from('site_settings').select('value').eq('key', key).maybeSingle();
  const { error } = await g.ctx.supabase.from('site_settings').upsert({ key, value, is_public: PUBLIC_KEYS.has(key), updated_by: g.ctx.user.id }, { onConflict: 'key' });
  if (error) return dbError(error);
  await audit(g.ctx, req, 'update', 'settings', key, before?.value ?? null, value);
  return ok(value);
}
