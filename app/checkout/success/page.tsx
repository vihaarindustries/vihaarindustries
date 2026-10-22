import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/site/Footer';
import { getBusiness } from '@/lib/site';
import { whatsappLink } from '@/lib/business';

export const metadata = { title: 'Order placed', robots: { index: false } };
export default async function Success({ searchParams }: { searchParams: Promise<{ order?: string }> | { order?: string } }) {
  const sp = await searchParams; const b = await getBusiness();
  const order = typeof sp.order === 'string' && /^[A-Z0-9-]{4,30}$/.test(sp.order) ? sp.order : '';
  const wa = whatsappLink(b, `Hello ${b.name}, I just placed order ${order}.`);
  return <><Header mode="retail" /><main className="container max-w-xl py-16 text-center">
    <div className="w-16 h-16 rounded-full bg-[#e3f4e9] text-[#008b47] flex items-center justify-center text-3xl font-black mx-auto">✓</div>
    <h1 className="text-3xl font-black mt-6">Thank you! Your order is placed.</h1>
    {order && <p className="mt-3">Order number <b className="text-xl">{order}</b></p>}
    <p className="muted mt-3">We will confirm your order shortly and update you by email. Keep your order number and the email you used — you need both to track it.</p>
    <div className="flex flex-wrap justify-center gap-3 mt-8"><Link href="/track" className="btn">Track my order ↗</Link><Link href="/retail#products" className="btn btn-outline">Continue shopping</Link>{wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-outline">WhatsApp us</a>}</div>
  </main><Footer mode="retail" /></>;
}
