import Link from 'next/link';
import { getMode, getNav, type Mode } from '@/lib/site';
import Logo from '@/components/site/Logo';
import CartButton from '@/components/cart/CartButton';

/**
 * One header for the whole public site. The visitor already chose Retail or Business on the first page, so there is no
 * Retail / Business switch here: retail pages get a Cart button, business pages get a "Request quote" button.
 * `mode` is passed by /retail and /business; every other page falls back to the remembered choice.
 */
export default async function Header({ mode: given }: { mode?: Mode }) {
  const [nav, remembered] = await Promise.all([getNav(), given ? Promise.resolve(given) : getMode()]);
  const mode = given ?? remembered;
  const home = mode === 'business' ? '/business' : '/retail';
  const items = nav.items.filter((i) => i.visible).flatMap((i) => {
    if (mode === 'retail') return i.href.startsWith('/business') ? [] : [i];                         // retail visitors never see "Business buyers"
    if (i.href.startsWith('/track') || i.href === '/business') return [];                             // tracking is retail-only; the business home link is redundant here
    return [{ ...i, href: i.href.startsWith('/retail') ? i.href.replace('/retail', '/business') : i.href }];  // same anchors, business side
  });
  return <header className="bg-white border-b border-black/5 sticky top-0 z-40"><div className="container flex items-center justify-between gap-4 py-3 md:py-4">
    <Logo href={home} />
    <nav className="hidden md:flex items-center gap-6" aria-label="Main">{items.map((i) => <Link key={i.key} className="navlink" href={i.href}>{i.label}</Link>)}</nav>
    <div className="flex items-center gap-2">
      {nav.show_signin && <Link href="/account" className="navlink hidden lg:block">Sign in</Link>}
      {mode === 'retail' ? <CartButton /> : <Link href="/enquiry" className="btn !px-3 !py-2 md:!px-4 md:!py-3">Request quote <span>↗</span></Link>}
    </div>
  </div></header>;
}
