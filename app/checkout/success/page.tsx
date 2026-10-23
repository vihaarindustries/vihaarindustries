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
    <p className="muted mt-3">Your order is <b>placed</b>. We will let you know by email when it is <b>accepted</b>, and again when it is <b>shipped</b> with the courier and tracking details. You can follow every step from your account.</p>
    <div className="flex flex-wrap justify-center gap-3 mt-8"><Link href="/account" className="btn">View my orders ↗</Link><Link href="/track" className="btn btn-outline">Track an order</Link><Link href="/retail#products" className="btn btn-outline">Continue shopping</Link>{wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-outline">WhatsApp us</a>}</div>
  </main><Footer mode="retail" /></>;
}
