import { createPublicClient } from '@/lib/supabase/public';

export type Sec = { section_key: string; title: string; content: Record<string, string> | null; sort_order: number };
export type DbProduct = {
  id: string; name: string; slug: string; short_description: string | null; unit: string; sku: string | null;
  retail_price_minor: number | null; discount_type: string; discount_value: number; discount_starts_at: string | null; discount_ends_at: string | null;
  tax_rate: number | null; min_order_quantity: number | null; origin: string | null; specifications: Record<string, string> | null;
  is_featured: boolean; is_retail_available: boolean; is_export_available: boolean;
  product_categories: { name: string } | null; product_media: { storage_path: string; alt_text: string | null; is_primary: boolean; sort_order: number }[];
};
export type Cert = { id: string; kind: string; title: string; certificate_type: string | null; issuer: string | null; year: number | null; valid_until: string | null; description: string | null; image_path: string | null };
export type Testi = { id: string; customer_name: string; company_name: string | null; quote: string; rating: number | null };

/** Everything the retail and business pages read from the database. Products come from the control room's Products section. */
export async function loadCatalog() {
  const out = { sections: [] as Sec[], products: [] as DbProduct[], certs: [] as Cert[], testimonials: [] as Testi[] };
  const sb = createPublicClient();
  if (!sb) return out;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const [s, p, c, t] = await Promise.all([
      sb.from('site_sections').select('section_key, title, content, sort_order').order('sort_order'),
      sb.from('products').select('id, name, slug, sku, short_description, unit, retail_price_minor, discount_type, discount_value, discount_starts_at, discount_ends_at, tax_rate, min_order_quantity, origin, specifications, is_featured, is_retail_available, is_export_available, product_categories(name), product_media(storage_path, alt_text, is_primary, sort_order)').eq('is_active', true).order('sort_order').limit(96),
      sb.from('certificates').select('id, kind, title, certificate_type, issuer, year, valid_until, description, image_path').eq('is_public', true).or(`valid_until.is.null,valid_until.gte.${today}`).order('sort_order'),
      sb.from('testimonials').select('id, customer_name, company_name, quote, rating').eq('approved', true).eq('is_visible', true).order('sort_order').limit(6),
    ]);
    out.sections = (s.data ?? []) as Sec[]; out.products = (p.data ?? []) as unknown as DbProduct[]; out.certs = (c.data ?? []) as Cert[]; out.testimonials = (t.data ?? []) as Testi[];
  } catch { /* fall back to the built-in content */ }
  return out;
}

/** Order the sections the way the control room set them; show everything in the default order when nothing is saved. */
export function sectionOrder(sections: Sec[], defaults: string[]) {
  return sections.length ? [...sections].sort((a, b) => a.sort_order - b.sort_order).map((x) => x.section_key).filter((k) => defaults.includes(k)) : defaults;
}
