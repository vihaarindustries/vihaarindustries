export type Discountable = {
  retail_price_minor: number | null; discount_type?: string | null; discount_value?: number | string | null;
  discount_starts_at?: string | null; discount_ends_at?: string | null;
};

/** Mirrors the SQL function effective_price_minor(); the database is authoritative for orders. */
export function effectivePrice(p: Discountable, price: number | null = p.retail_price_minor, at = new Date()): number | null {
  if (price == null) return null;
  const type = p.discount_type ?? 'none'; const value = Number(p.discount_value ?? 0);
  if (type === 'none' || value <= 0) return price;
  if (p.discount_starts_at && at < new Date(p.discount_starts_at)) return price;
  if (p.discount_ends_at && at > new Date(p.discount_ends_at)) return price;
  if (type === 'percentage') return Math.max(0, price - Math.round((price * Math.min(value, 100)) / 100));
  if (type === 'fixed') return Math.max(0, price - Math.round(value));
  return price;
}
export const hasActiveDiscount = (p: Discountable) => {
  const e = effectivePrice(p); return e != null && p.retail_price_minor != null && e < p.retail_price_minor;
};
