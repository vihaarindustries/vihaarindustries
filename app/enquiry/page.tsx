import Header from '@/components/Header';
import Footer from '@/components/site/Footer';
import EnquiryForm from '@/components/site/EnquiryForm';
import { createPublicClient } from '@/lib/supabase/public';
import { getBusiness } from '@/lib/site';
import { addressLines, telLink, whatsappLink } from '@/lib/business';

type SP = { submitted?: string; product?: string; type?: string };

export default async function Enquiry({ searchParams }: { searchParams: Promise<SP> | SP }) {
  const sp = await searchParams; const b = await getBusiness();
  // "Request quote" on a product opens this page with that product already chosen.
  let product: { slug: string; name: string } | null = null;
  const slug = typeof sp.product === 'string' && /^[a-z0-9-]{1,80}$/.test(sp.product) ? sp.product : '';
  if (slug) { try { const { data } = await createPublicClient()?.from('products').select('slug, name').eq('slug', slug).eq('is_active', true).maybeSingle() ?? { data: null }; if (data) product = data; } catch { /* ignore */ } }
  const type = sp.type === 'sample' ? 'Sample request' : product ? 'Bulk / wholesale' : 'Product enquiry';
  const wa = whatsappLink(b); const tel = telLink(b.phone); const lines = addressLines(b);
  return <><Header /><main className="container py-14 max-w-5xl"><div className="grid md:grid-cols-[1.4fr_1fr] gap-10 items-start">
    <div><div className="eyebrow">LET&apos;S TALK</div><h1 className="text-4xl font-black mt-3">Tell us what you&apos;re sourcing.</h1><p className="muted mt-3">Use this form for product questions, bulk pricing, samples or export enquiries. We reply by email.</p>
      {sp.submitted === '1' ? <div role="status" className="mt-8 bg-[#e3f4e9] border border-[#00994d]/30 text-[#006b38] rounded-xl p-6"><div className="font-black text-lg">Thank you — your enquiry has been received.</div><p className="text-sm mt-2">Our team will get back to you shortly{b.email ? <> at the email you provided. You can also write to <b>{b.email}</b></> : ''}.</p></div>
        : <div className="mt-8"><EnquiryForm type={type} productSlug={product?.slug} productName={product?.name} /></div>}</div>
    <aside className="bg-white border border-gray-200 rounded-xl p-6 space-y-4 text-sm"><h2 className="font-black text-lg">{b.name}</h2>
      {lines.length > 0 && <div><div className="eyebrow !text-[9px] mb-1">ADDRESS</div>{lines.map((l, i) => <div key={i}>{l}</div>)}</div>}
      {b.phone && <div><div className="eyebrow !text-[9px] mb-1">PHONE</div>{tel ? <a className="font-semibold hover:underline" href={tel}>{b.phone}</a> : b.phone}</div>}
      {b.email && <div><div className="eyebrow !text-[9px] mb-1">EMAIL</div><a className="font-semibold hover:underline break-all" href={`mailto:${b.email}`}>{b.email}</a></div>}
      {b.hours && <div><div className="eyebrow !text-[9px] mb-1">HOURS</div>{b.hours}</div>}
      {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="btn w-full !bg-[#25D366] !border-[#25D366]">Chat on WhatsApp ↗</a>}
    </aside></div></main><Footer /></>;
}
