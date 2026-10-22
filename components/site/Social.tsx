import { Facebook, Globe, Instagram, Linkedin, MessageCircle, Pin, Send, Twitter, Youtube, type LucideIcon } from 'lucide-react';
import type { LinkItem } from '@/lib/business';

const ICONS: Record<string, LucideIcon> = {
  whatsapp: MessageCircle, instagram: Instagram, facebook: Facebook, linkedin: Linkedin, youtube: Youtube, x: Twitter, telegram: Send, pinterest: Pin,
};
/** Round icon buttons. Only the profiles that have a link are passed in, so nothing empty ever shows. */
export function SocialIcons({ items, dark = true }: { items: LinkItem[]; dark?: boolean }) {
  if (!items.length) return null;
  return <ul className="flex flex-wrap gap-2.5">{items.map((i) => { const Icon = ICONS[i.key] ?? Globe;
    return <li key={i.key}><a href={i.href} target="_blank" rel="noopener noreferrer" aria-label={i.label} title={i.label}
      className={`w-9 h-9 rounded-full flex items-center justify-center border transition ${dark ? 'border-white/20 text-gray-200 hover:bg-[#00994d] hover:border-[#00994d] hover:text-white' : 'border-gray-300 text-gray-700 hover:bg-[#00994d] hover:border-[#00994d] hover:text-white'}`}><Icon size={16} /></a></li>; })}</ul>;
}
export function MarketplaceChips({ items }: { items: LinkItem[] }) {
  if (!items.length) return null;
  return <ul className="flex flex-wrap gap-2">{items.map((i) => <li key={i.key}><a href={i.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-full border border-white/20 px-3 py-1.5 text-xs font-bold text-gray-200 hover:bg-white hover:text-[#111611] transition">{i.label} <span className="ml-1.5" aria-hidden="true">↗</span></a></li>)}</ul>;
}
