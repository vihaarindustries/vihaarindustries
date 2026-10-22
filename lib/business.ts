/** Business profile shown across the website. Edited in the control room under "Business information". Safe to import anywhere. */
export type PlatformDef = { key: string; label: string; placeholder: string };

export const SOCIAL_PLATFORMS: PlatformDef[] = [
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/yourbrand' },
  { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/yourpage' },
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/company/yourcompany' },
  { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@yourchannel' },
  { key: 'x', label: 'X (Twitter)', placeholder: 'https://x.com/yourhandle' },
  { key: 'telegram', label: 'Telegram', placeholder: 'https://t.me/yourchannel' },
  { key: 'pinterest', label: 'Pinterest', placeholder: 'https://pinterest.com/yourbrand' },
];

export const MARKETPLACES: PlatformDef[] = [
  { key: 'amazon', label: 'Amazon', placeholder: 'https://www.amazon.in/stores/your-store' },
  { key: 'flipkart', label: 'Flipkart', placeholder: 'https://www.flipkart.com/your-store' },
  { key: 'meesho', label: 'Meesho', placeholder: 'https://meesho.com/your-store' },
  { key: 'indiamart', label: 'IndiaMART', placeholder: 'https://www.indiamart.com/your-company' },
  { key: 'tradeindia', label: 'TradeIndia', placeholder: 'https://www.tradeindia.com/your-company' },
  { key: 'exportersindia', label: 'ExportersIndia', placeholder: 'https://www.exportersindia.com/your-company' },
  { key: 'jiomart', label: 'JioMart', placeholder: 'https://www.jiomart.com/your-store' },
  { key: 'udaan', label: 'Udaan', placeholder: 'https://udaan.com/your-store' },
  { key: 'alibaba', label: 'Alibaba', placeholder: 'https://yourcompany.alibaba.com' },
];

export type CustomMarketplace = { name: string; url: string };
export type BusinessProfile = {
  name: string; legal_name?: string; tagline?: string; about?: string;
  logo_path?: string; show_name_with_logo?: boolean;
  email?: string; phone?: string; alt_phone?: string; hours?: string;
  whatsapp_enabled?: boolean; whatsapp_number?: string; whatsapp_message?: string;
  address_line?: string; city?: string; state?: string; pincode?: string; country?: string; map_url?: string;
  gstin?: string; fssai?: string; iec?: string;
  social?: Record<string, string>; marketplaces?: Record<string, string>; custom_marketplaces?: CustomMarketplace[];
};
export const DEFAULT_BUSINESS: BusinessProfile = { name: 'Vihaar Industries', tagline: 'Dehydrated spices & ingredients', whatsapp_enabled: true };

const digits = (s?: string) => (s ?? '').replace(/\D/g, '');
/** WhatsApp wants the number in international form without + or spaces. A bare 10-digit number is treated as Indian. */
export function whatsappDigits(b: BusinessProfile): string {
  if (b.whatsapp_enabled === false) return '';
  let d = digits(b.whatsapp_number || b.phone);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  if (d.length === 10) d = '91' + d;
  return d.length >= 11 && d.length <= 15 ? d : '';
}
export function whatsappLink(b: BusinessProfile, text?: string): string | null {
  const d = whatsappDigits(b); if (!d) return null;
  const msg = text ?? b.whatsapp_message ?? `Hello ${b.name}, I would like to know more about your products.`;
  return `https://wa.me/${d}?text=${encodeURIComponent(msg)}`;
}
export const telLink = (phone?: string) => { const d = (phone ?? '').replace(/[^\d+]/g, ''); return d ? `tel:${d}` : null; };

export type LinkItem = { key: string; label: string; href: string };
const safeUrl = (u?: string) => (u && /^https:\/\//i.test(u) ? u : '');
export function socialLinks(b: BusinessProfile): LinkItem[] {
  const out: LinkItem[] = [];
  const wa = whatsappLink(b); if (wa) out.push({ key: 'whatsapp', label: 'WhatsApp', href: wa });
  for (const p of SOCIAL_PLATFORMS) { const u = safeUrl(b.social?.[p.key]); if (u) out.push({ key: p.key, label: p.label, href: u }); }
  return out;
}
export function marketplaceLinks(b: BusinessProfile): LinkItem[] {
  const out: LinkItem[] = [];
  for (const p of MARKETPLACES) { const u = safeUrl(b.marketplaces?.[p.key]); if (u) out.push({ key: p.key, label: p.label, href: u }); }
  (b.custom_marketplaces ?? []).forEach((m, i) => { const u = safeUrl(m.url); if (u && m.name) out.push({ key: `custom${i}`, label: m.name, href: u }); });
  return out;
}
export const addressLines = (b: BusinessProfile) => [b.address_line, [b.city, b.state, b.pincode].filter(Boolean).join(', '), b.country].filter((x): x is string => !!x && x.trim().length > 0);
