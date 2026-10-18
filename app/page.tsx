import Link from 'next/link';

const benefits = [
  { number: '01', title: 'Quality-led ingredients', text: 'Explore dehydrated spices and ingredient options for kitchens, food brands and manufacturers.' },
  { number: '02', title: 'A buying journey that fits', text: 'Simple retail shopping or a dedicated bulk and export enquiry experience.' },
  { number: '03', title: 'From India to global markets', text: 'Tell us your product, quantity and destination and let’s discuss the right supply solution.' },
];

export default function Home() {
  return (
    <main className="choice-page min-h-screen overflow-hidden">
      <div className="choice-glow choice-glow-one" aria-hidden="true" />
      <div className="choice-glow choice-glow-two" aria-hidden="true" />
      <header className="container flex items-center justify-between py-6 relative z-10">
        <Link href="/" aria-label="Vihaar Industries home" className="flex items-center gap-3">
          <div className="choice-logo">V</div>
          <div><div className="text-white font-black text-xl tracking-tight">Vihaar<span className="text-[#20bd70]">.</span></div><div className="text-[9px] tracking-[.28em] text-gray-400 mt-1">INDUSTRIES</div></div>
        </Link>
        <Link href="/enquiry" className="choice-top-link">Contact us <span aria-hidden="true">↗</span></Link>
      </header>

      <section className="container relative z-10 pt-8 pb-14 md:pt-14 md:pb-20">
        <div className="max-w-3xl mx-auto text-center">
          <div className="choice-eyebrow"><span className="choice-dot" /> QUALITY SPICES. THOUGHTFULLY SOURCED.</div>
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-black tracking-[-.055em] leading-[1.02] text-white mt-6">Goodness in every grain.<br /><span className="choice-highlight">Made for your world.</span></h1>
          <p className="max-w-xl mx-auto text-sm md:text-base leading-7 text-gray-300 mt-6">From everyday kitchens to high-volume food production, find the Vihaar experience that works for you.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-5 max-w-5xl mx-auto mt-10 md:mt-14">
          <Link href="/retail" className="choice-card choice-card-retail group">
            <div className="choice-card-top"><span className="choice-icon" aria-hidden="true">⌂</span><span className="choice-pill">FOR EVERYDAY SHOPPING</span></div>
            <div className="choice-art choice-art-retail" aria-hidden="true"><span className="choice-spice spice-onion">◉</span><span className="choice-spice spice-garlic">✳</span><span className="choice-spice spice-chilli">〰</span></div>
            <div className="mt-2"><div className="text-xs font-bold uppercase tracking-[.18em] text-[#65d99b]">01 / Retail</div><h2 className="text-2xl md:text-3xl font-black text-white mt-2">I’m shopping for myself.</h2><p className="text-sm leading-6 text-gray-300 mt-3 max-w-md">Discover products and pack sizes, explore offers, use coupon codes and manage your orders in one simple place.</p></div>
            <div className="choice-card-action"><span>Enter retail store</span><span className="choice-arrow" aria-hidden="true">↗</span></div>
          </Link>

          <Link href="/business" className="choice-card choice-card-business group">
            <div className="choice-card-top"><span className="choice-icon" aria-hidden="true">▦</span><span className="choice-pill">FOR TRADE & INDUSTRY</span></div>
            <div className="choice-art choice-art-business" aria-hidden="true"><div className="bulk-stack"><span /><span /><span /><span /></div><div className="bulk-seal">VI<br/><small>INGREDIENTS</small></div></div>
            <div className="mt-2"><div className="text-xs font-bold uppercase tracking-[.18em] text-[#c8d5cb]">02 / Business</div><h2 className="text-2xl md:text-3xl font-black text-white mt-2">I’m sourcing for a business.</h2><p className="text-sm leading-6 text-gray-300 mt-3 max-w-md">Explore bulk supply, share specifications, request negotiated pricing and obtain domestic or export quotations.</p></div>
            <div className="choice-card-action"><span>Enter business portal</span><span className="choice-arrow" aria-hidden="true">↗</span></div>
          </Link>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-xs text-gray-400 mt-8"><span>✓ Domestic & export enquiries</span><span>✓ Retail and bulk supply</span><span>✓ Quality-first approach</span></div>
      </section>

      <section className="choice-benefits relative z-10">
        <div className="container grid sm:grid-cols-3 gap-7 py-8 md:py-10">
          {benefits.map((item) => <div key={item.number} className="flex gap-4"><div className="text-[#28c779] text-sm font-black pt-1">{item.number}</div><div><h3 className="text-white font-bold">{item.title}</h3><p className="text-sm text-gray-400 leading-6 mt-2">{item.text}</p></div></div>)}
        </div>
      </section>
      <footer className="container relative z-10 flex flex-col sm:flex-row justify-between gap-3 py-6 text-xs text-gray-500"><span>© {new Date().getFullYear()} Vihaar Industries</span><div className="flex gap-5"><Link href="/enquiry" className="hover:text-white">Contact</Link><Link href="/auth/sign-in" className="hover:text-white">Sign in</Link></div></footer>
    </main>
  );
}
