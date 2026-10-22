import Link from 'next/link';
import { Mail, MapPin, Phone } from 'lucide-react';
import { getBusiness, getMode } from '@/lib/site';
import { addressLines, marketplaceLinks, socialLinks, telLink } from '@/lib/business';
import { MarketplaceChips, SocialIcons } from './Social';

/** One footer for every public page. All details come from the control room's Business information page. */
export default async function Footer({ mode: given, home = false }: { mode?: 'retail' | 'business'; home?: boolean }) {
  const b = await getBusiness(); const mode = given ?? (home ? 'retail' : await getMode());
  const lines = addressLines(b); const social = socialLinks(b); const markets = marketplaceLinks(b);
  const base = mode === 'business' ? '/business' : '/retail';
  const ids = [b.gstin && `GSTIN: ${b.gstin}`, b.fssai && `FSSAI: ${b.fssai}`, b.iec && `IEC: ${b.iec}`].filter(Boolean) as string[];
  return <footer className="bg-[#111611] text-gray-300 pt-12 pb-8 mt-0">
    <div className="container grid gap-10 md:grid-cols-[1.3fr_1fr_1fr]">
      <div>
        <div className="text-white font-black text-xl">{b.name}</div>
        {b.tagline && <p className="text-sm mt-2 text-gray-400 max-w-xs">{b.tagline}</p>}
        {social.length > 0 && <div className="mt-5"><SocialIcons items={social} /></div>}
      </div>
      <div className="text-sm space-y-3">
        <div className="text-xs font-bold uppercase tracking-widest text-gray-500">Contact</div>
        {lines.length > 0 && <div className="flex gap-2.5"><MapPin size={16} className="mt-0.5 shrink-0 text-[#25c878]" /><address className="not-italic leading-6">{lines.map((l, i) => <div key={i}>{l}</div>)}{b.map_url && /^https:\/\//.test(b.map_url) && <a href={b.map_url} target="_blank" rel="noopener noreferrer" className="text-[#62d99b] hover:underline">View on map ↗</a>}</address></div>}
        {b.phone && <div className="flex gap-2.5 items-center"><Phone size={16} className="shrink-0 text-[#25c878]" /><span>{telLink(b.phone) ? <a href={telLink(b.phone)!} className="hover:text-white">{b.phone}</a> : b.phone}{b.alt_phone && <>, <a href={telLink(b.alt_phone) ?? '#'} className="hover:text-white">{b.alt_phone}</a></>}</span></div>}
        {b.email && <div className="flex gap-2.5 items-center"><Mail size={16} className="shrink-0 text-[#25c878]" /><a href={`mailto:${b.email}`} className="hover:text-white break-all">{b.email}</a></div>}
        {b.hours && <div className="text-xs text-gray-400">{b.hours}</div>}
      </div>
      <div className="text-sm">
        <div className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">Quick links</div>
        <div className="flex flex-col gap-2">
          {home ? <><Link href="/retail" className="hover:text-white">Retail store</Link><Link href="/business" className="hover:text-white">Business portal</Link></> : <Link href={`${base}#products`} className="hover:text-white">Products</Link>}
          {!home && (mode === 'retail' ? <Link href="/track" className="hover:text-white">Track your order</Link> : <Link href="/enquiry" className="hover:text-white">Request a quotation</Link>)}
          <Link href="/enquiry" className="hover:text-white">Contact us</Link>
          <Link href="/account" className="hover:text-white">Account</Link>
        </div>
        {markets.length > 0 && <div className="mt-6"><div className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">Also available on</div><MarketplaceChips items={markets} /></div>}
      </div>
    </div>
    <div className="container border-t border-white/10 mt-9 pt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px] text-gray-500">
      <span>© {new Date().getFullYear()} {b.legal_name || b.name}. All rights reserved.{ids.length > 0 && <span className="ml-3">{ids.join('  ·  ')}</span>}</span>
      {!home && <Link href={mode === 'retail' ? '/business' : '/retail'} className="text-gray-500 hover:text-white">{mode === 'retail' ? 'Looking to buy in bulk? Business portal →' : 'Buying for yourself? Retail store →'}</Link>}
    </div>
  </footer>;
}
