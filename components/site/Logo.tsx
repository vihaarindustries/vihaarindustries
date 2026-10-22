import Link from 'next/link';
import { getBusiness } from '@/lib/site';

/** The brand mark. Uses the logo uploaded in the control room; falls back to a lettermark until one is uploaded. */
export default async function Logo({ dark = false, href = '/' }: { dark?: boolean; href?: string }) {
  const b = await getBusiness();
  const words = b.name.trim().split(/\s+/); const first = words[0] || 'Vihaar'; const rest = words.slice(1).join(' ');
  const text = dark ? 'text-white' : 'text-[#171917]'; const sub = dark ? 'text-gray-400' : 'text-gray-500';
  if (b.logoUrl) {
    return <Link href={href} aria-label={`${b.name} home`} className="flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={b.logoUrl} alt={b.show_name_with_logo ? '' : b.name} className="h-10 md:h-11 w-auto max-w-[170px] object-contain" />
      {b.show_name_with_logo && <span className={`font-black text-lg leading-none tracking-tight ${text}`}>{b.name}</span>}
    </Link>;
  }
  return <Link href={href} aria-label={`${b.name} home`} className="flex items-center gap-3">
    <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-2xl font-black ${dark ? 'border-[#1cb76a] text-[#36d987]' : 'border-vihaar-green text-vihaar-green'}`}>{first.charAt(0).toUpperCase()}</div>
    <div><div className={`font-black text-xl leading-none tracking-tight ${text}`}>{first}<span className={dark ? 'text-[#20bd70]' : 'text-vihaar-green'}>.</span></div>{rest && <div className={`text-[9px] tracking-[.28em] mt-1 uppercase ${sub}`}>{rest}</div>}</div>
  </Link>;
}
