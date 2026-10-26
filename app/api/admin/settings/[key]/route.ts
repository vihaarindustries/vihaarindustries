import { audit, dbError, fail, ok, readJson, requireStaff } from '@/lib/admin/http';
import { ValidationError, check, type Schema } from '@/lib/admin/validate';
import type { StaffRole } from '@/lib/admin/permissions';
import { refreshForSetting } from '@/lib/admin/revalidate';
import { MARKETPLACES, SOCIAL_PLATFORMS } from '@/lib/business';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ key: string }> | { key: string } };

const CONTENT: StaffRole[] = ['owner', 'admin', 'content_manager'];
const ADMIN: StaffRole[] = ['owner', 'admin'];
const s = (max: number, optional = true): Schema => ({ t: 'str', max, optional });
// https links only (blocks javascript: and other schemes); the website renders these as <a href>
const url: Schema = { t: 'str', max: 400, optional: true, pattern: /^https:\/\/[^\s<>"']{3,390}$/ };
const phone: Schema = { t: 'str', max: 25, optional: true, pattern: /^[+0-9 ()-]{6,25}$/ };
const linkFields = (list: { key: string }[]) => Object.fromEntries(list.map((p) => [p.key, url]));

const SETTINGS: Record<string, { read: StaffRole[]; write: StaffRole[]; schema: Schema }> = {
  nav_visibility: { read: CONTENT, write: CONTENT, schema: { t: 'shape', fields: {
    items: { t: 'arr', min: 1, max: 12, of: { t: 'shape', fields: { key: { t: 'str', max: 30, pattern: /^[a-z0-9_-]+$/ }, label: s(40, false), href: { t: 'str', max: 120, pattern: /^(\/|#)[A-Za-z0-9/_#?=&.\-]*$/ }, visible: { t: 'bool' } } } },
    show_switch: { t: 'bool' }, show_signin: { t: 'bool' } } } },
  business_profile: { read: CONTENT, write: CONTENT, schema: { t: 'shape', fields: {
    name: s(120, false), legal_name: s(160), tagline: s(160), about: s(1500),
    logo_path: { t: 'str', max: 200, optional: true, pattern: /^[A-Za-z0-9/_.-]+$/ }, show_name_with_logo: { t: 'bool', optional: true },
    email: { t: 'str', max: 254, optional: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ }, phone, alt_phone: phone, hours: s(160),
    whatsapp_enabled: { t: 'bool', optional: true }, whatsapp_number: phone, whatsapp_message: s(300),
    address_line: s(200), city: s(80), state: s(80), pincode: s(12), country: s(60), map_url: url,
    gstin: s(20), fssai: s(30), iec: s(20),
    social: { t: 'shape', optional: true, fields: linkFields(SOCIAL_PLATFORMS) },
    marketplaces: { t: 'shape', optional: true, fields: linkFields(MARKETPLACES) },
    custom_marketplaces: { t: 'arr', max: 10, optional: true, of: { t: 'shape', fields: { name: s(60, false), url: { t: 'str', max: 400, pattern: /^https:\/\/[^\s<>"']{3,390}$/ } } } } } } },
  chatbot_config: { read: CONTENT, write: CONTENT, schema: { t: 'shape', fields: {
    enabled: { t: 'bool' }, name: s(40, false), greeting: s(300, false),
    suggestions: { t: 'arr', max: 6, of: { t: 'str', max: 80 } } } } },
  chatbot_knowledge: { read: CONTENT, write: CONTENT, schema: { t: 'shape', fields: { text: s(6000) } } },
  // Website currency display: owners/admins change it; finance and operations can read it
  fx_config: { read: ['owner', 'admin', 'finance', 'operations'], write: ADMIN, schema: { t: 'shape', fields: {
    display_enabled: { t: 'bool' }, display_source: { t: 'str', oneOf: ['ecb', 'exchangerate_api', 'oxr', 'manual'] },
    currencies: { t: 'arr', max: 12, optional: true, of: { t: 'str', max: 3, pattern: /^[A-Z]{3}$/ } }, max_age_days: { t: 'int', min: 1, max: 30 } } } },
  referral_program: { read: ['owner', 'admin', 'finance', 'content_manager', 'operations'], write: ADMIN, schema: { t: 'shape', fields: {
    enabled: { t: 'bool' }, referrer_reward_minor: { t: 'int', min: 0, max: 1e9 },
    referee_discount_type: { t: 'str', oneOf: ['percentage', 'fixed'] }, referee_discount_value: { t: 'num', min: 0, max: 1e9 }, min_order_minor: { t: 'int', min: 0, max: 1e10 } } } },
};
const PUBLIC_KEYS = new Set(['nav_visibility', 'chatbot_config', 'business_profile']);
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
  refreshForSetting(key);   // menu, business details and chatbot appear on the website immediately
  return ok(value);
}
