import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/site/Footer';
import ModeSetter from '@/components/site/ModeSetter';
import TrustBlock from '@/components/site/TrustBlock';
import EnquiryForm from '@/components/site/EnquiryForm';
import { BusinessGrid } from '@/components/site/ProductCards';
import { loadCatalog, sectionOrder } from '@/lib/catalog';
import { getBusiness } from '@/lib/site';
import { telLink, whatsappLink } from '@/lib/business';

export const revalidate = 60;

const DEFAULT_ORDER = ['products', 'capabilities', 'quality', 'cta'];

/** Business portal. No cart and no retail prices: buyers browse specifications and send an enquiry or quotation request. */
export default async function Business() {
  const [{ sections, products, certs: allCerts, testimonials }, b] = await Promise.all([loadCatalog(), getBusiness()]);
  const sec = Object.fromEntries(sections.map((x) => [x.section_key, x]));
  const items = products.filter((p) => p.is_export_available);
  const certs = allCerts.filter((c) => c.kind === 'certificate'); const achievements = allCerts.filter((c) => c.kind !== 'certificate');
  const wa = whatsappLink(b, `Hello ${b.name}, I would like a business quotation.`); const tel = telLink(b.phone);
  const S: Record<string, React.ReactNode> = {
    products: <section id="products" className="section"><div className="container"><div className="flex flex-wrap justify-between items-end gap-5 mb-9"><div><div className="eyebrow mb-3">PRODUCTS FOR BUSINESS</div><h2 className="text-3xl md:text-4xl font-black tracking-tight">{sec.products?.title ?? 'Ingredients with purpose.'}</h2><p className="muted mt-3 max-w-xl">{sec.products?.content?.intro ?? 'Explore core ingredients, then request pricing, specifications or a sample.'}</p></div><Link className="btn btn-outline" href="#enquiry">Request a product list ↗</Link></div>
      {items.length ? <BusinessGrid items={items} /> : <div className="border border-dashed border-gray-300 rounded-xl p-10 text-center bg-white"><h3 className="font-black text-xl">Tell us what you need</h3><p className="muted mt-2 max-w-lg mx-auto">Our business catalogue is being updated. Share your product, quantity and destination and we will respond with a quotation.</p><Link href="#enquiry" className="btn mt-5">Send an enquiry ↗</Link></div>}</div></section>,
    capabilities: <section id="capabilities" className="bg-[#e9eee7] section"><div className="container"><div className="grid md:grid-cols-3 gap-5">{[['Bulk sourcing', 'Discuss quantities, packaging formats, lead times and supply requirements.'], ['Specification-led enquiries', 'Share target mesh size, application, packaging and documentation needs.'], ['Export quotations', 'Request pricing with destination, currency and proposed shipping terms.']].map((x) => <article className="bg-white border border-gray-200 p-6 rounded-lg" key={x[0]}><div className="text-vihaar-green font-black text-2xl">↗</div><h2 className="font-black text-xl mt-4">{x[0]}</h2><p className="muted text-sm leading-6 mt-3">{x[1]}</p></article>)}</div>
      <div className="bg-[#151915] text-white rounded-xl p-8 md:p-10 mt-8"><div className="eyebrow !text-[#62d99b]">A BETTER BUYING PROCESS</div><div className="mt-8 grid md:grid-cols-3 gap-7">{[['01', 'Tell us what you need', 'Product, grade, packaging, quantity and destination.'], ['02', 'Align on specifications', 'Confirm availability, pricing, logistics and documentation.'], ['03', 'Move from quote to order', 'Track agreed terms and keep the paperwork together.']].map((x) => <div className="flex gap-4" key={x[0]}><div className="text-[#25c878] font-black text-xl">{x[0]}</div><div><div className="font-bold">{x[1]}</div><p className="text-sm text-gray-400 mt-1">{x[2]}</p></div></div>)}</div></div></div></section>,
    quality: <section id="quality" className="section bg-white"><div className="container text-center"><div className="eyebrow mb-3">QUALITY & TRUST</div><h2 className="text-3xl md:text-4xl font-black">{sec.quality?.title ?? 'Proof belongs in the open.'}</h2><p className="muted max-w-2xl mx-auto mt-4 leading-7">{sec.quality?.content?.intro ?? 'Verified licences, certifications, achievements and customer feedback.'}</p><TrustBlock certs={certs} achievements={achievements} testimonials={testimonials} /></div></section>,
    cta: <section id="enquiry" className="bg-[#00994d] text-white py-14 scroll-mt-20"><div className="container grid md:grid-cols-[.9fr_1.1fr] gap-10 items-start"><div><div className="text-xs tracking-[.2em] font-bold text-white/75">LET&apos;S TALK INGREDIENTS</div><h2 className="text-3xl md:text-4xl font-black mt-3">{sec.cta?.title ?? 'Have a specification in mind?'}</h2><p className="text-white/85 mt-3 leading-7">Tell us your product, volume and destination. Our team replies with pricing, availability and documentation.</p><div className="flex flex-wrap gap-3 mt-6">{wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="btn !bg-white !text-[#006b38] !border-white">WhatsApp us ↗</a>}{tel && <a href={tel} className="btn !bg-transparent !border-white/60">Call {b.phone}</a>}{b.email && <a href={`mailto:${b.email}`} className="btn !bg-transparent !border-white/60">Email us</a>}</div></div><EnquiryForm /></div></section>,
  };
  return <><Header mode="business" /><ModeSetter mode="business" /><main>
    <section className="bg-[#151915] text-white py-16 md:py-24"><div className="container max-w-4xl"><div className="eyebrow !text-[#5dd795]">FOR BUSINESS BUYERS</div><h1 className="text-4xl md:text-6xl font-black tracking-tight mt-4">Source with confidence.<br /><span className="text-[#20bd70]">Scale with {b.name.split(' ')[0]}.</span></h1><p className="text-gray-300 max-w-2xl leading-7 mt-5">Tell us about your volumes, product requirements, packaging and delivery destination. Our business workflow is designed for bulk supply and export quotations.</p><div className="flex flex-wrap gap-3 mt-7"><Link href="#enquiry" className="btn">Request a business quotation ↗</Link><Link href="#products" className="btn btn-outline !text-white !border-white/30">Browse products ↓</Link></div><div className="flex flex-wrap gap-x-7 gap-y-3 mt-10 text-xs text-gray-300"><span>✓ Domestic &amp; export enquiries</span><span>✓ Specification-led supply</span><span>✓ Documentation support</span></div></div></section>
    {[...sectionOrder(sections, DEFAULT_ORDER), ...(sectionOrder(sections, DEFAULT_ORDER).includes('cta') ? [] : ['cta'])].map((k) => <div key={k} style={{ display: 'contents' }}>{S[k]}</div>)}
  </main><Footer mode="business" /></>;
}
