import Link from 'next/link';

export default function Header() {
  return <header className="bg-white border-b border-black/5 sticky top-0 z-40"><div className="container flex items-center justify-between gap-4 py-3 md:py-4">
    <Link href="/" className="flex items-center gap-3" aria-label="Vihaar Industries home"><div className="w-10 h-10 rounded-full border-2 border-vihaar-green flex items-center justify-center text-vihaar-green text-2xl font-black">V</div><div><div className="font-black text-xl leading-none tracking-tight">Vihaar<span className="text-vihaar-green">.</span></div><div className="text-[9px] tracking-[.28em] text-gray-500 mt-1">INDUSTRIES</div></div></Link>
    <nav className="hidden md:flex items-center gap-6"><Link className="navlink" href="/retail#products">Products</Link><Link className="navlink" href="/retail#capabilities">Capabilities</Link><Link className="navlink" href="/retail#quality">Quality & Certifications</Link><Link className="navlink" href="/business">Business buyers</Link></nav>
    <div className="flex items-center gap-2"><Link href="/retail" className="switch-link hidden sm:inline-flex">Retail</Link><Link href="/business" className="switch-link hidden sm:inline-flex">Business</Link><Link href="/account" className="navlink hidden lg:block">Sign in</Link><Link href="/enquiry" className="btn !px-3 !py-2 md:!px-4 md:!py-3">Enquire <span>↗</span></Link></div>
  </div></header>;
}
