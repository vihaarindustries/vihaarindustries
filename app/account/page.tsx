import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/site/Footer';
import { createClient } from '@/lib/supabase/server';
import { fmtMoney } from '@/lib/format';

export const metadata = { title: 'Your account', robots: { index: false } };
export const dynamic = 'force-dynamic';

type Ord = { id: string; order_number: string; status: string; placed_at: string; total_minor: number; currency: string; courier_provider: string | null; courier_reference: string | null; tracking_url: string | null; expected_delivery: string | null };
// "pending_payment" is the database name of the first stage; customers see it as "Placed".
const LABEL: Record<string, string> = { pending_payment: 'Placed', draft: 'Placed', confirmed: 'Accepted', processing: 'Accepted', packed: 'Accepted', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled', refunded: 'Refunded' };
const TONE: Record<string, string> = { Placed: 'bg-amber-50 text-amber-900', Accepted: 'bg-blue-50 text-blue-900', Shipped: 'bg-[#e3f4e9] text-[#006b38]', Delivered: 'bg-[#e3f4e9] text-[#006b38]', Cancelled: 'bg-red-50 text-red-800', Refunded: 'bg-red-50 text-red-800' };
const d = (s: string) => new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export default async function Account() {
  const sb = await createClient();
  const { data: { user } } = sb ? await sb.auth.getUser() : { data: { user: null } };

  if (!user || !sb) {
    return <><Header /><main className="container max-w-lg py-16"><div className="eyebrow">YOUR ACCOUNT</div><h1 className="text-3xl font-black mt-3">Sign in or create an account.</h1>
      <p className="muted mt-3">You need an account to place orders and track them.</p>
      <div className="bg-white border border-gray-200 rounded-xl p-6 mt-7 space-y-3"><Link href="/auth/sign-in" className="btn w-full">Sign in ↗</Link><Link href="/auth/sign-up" className="btn btn-outline w-full">Create an account</Link></div></main><Footer /></>;
  }

  const { data } = await sb.from('orders')
    .select('id, order_number, status, placed_at, total_minor, currency, courier_provider, courier_reference, tracking_url, expected_delivery')
    .eq('user_id', user.id).order('placed_at', { ascending: false }).limit(50);
  const orders = (data ?? []) as Ord[];

  return <><Header /><main className="container max-w-3xl py-16">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="eyebrow">YOUR ACCOUNT</div><h1 className="text-3xl font-black mt-3">Your orders</h1><p className="muted mt-2">Signed in as {user.email}</p></div>
      <form action="/auth/sign-out" method="post"><button className="btn btn-outline">Sign out</button></form></div>
    {orders.length === 0 ? <div className="bg-white border border-gray-200 rounded-xl p-8 mt-8 text-center"><p className="muted">You have not placed any orders yet.</p><Link href="/retail#products" className="btn mt-5">Browse products ↗</Link></div>
      : <ul className="space-y-4 mt-8">{orders.map((o) => { const st = LABEL[o.status] ?? o.status; const shipped = ['shipped', 'delivered'].includes(o.status);
        return <li key={o.id} className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex flex-wrap justify-between gap-2"><div><div className="font-black text-lg">{o.order_number}</div><div className="text-xs muted">Placed {d(o.placed_at)}</div></div>
            <span className={`self-start text-xs font-bold rounded-full px-3 py-1.5 ${TONE[st] ?? 'bg-gray-100'}`}>{st}</span></div>
          <div className="text-sm mt-3 flex flex-wrap gap-x-6 gap-y-1"><span><span className="muted">Total </span><b>{fmtMoney(o.total_minor, o.currency)}</b></span>{o.expected_delivery && <span><span className="muted">Expected </span>{d(o.expected_delivery)}</span>}</div>
          {shipped && o.courier_provider && <div className="mt-4 bg-[#f1faf5] rounded-lg p-4 text-sm"><div><span className="muted">Courier </span><b>{o.courier_provider}</b></div>{o.courier_reference && <div className="mt-1"><span className="muted">Tracking ID </span><b>{o.courier_reference}</b></div>}
            {o.tracking_url && /^https:\/\//.test(o.tracking_url) && <a href={o.tracking_url} target="_blank" rel="noopener noreferrer" className="btn mt-3">Track on courier site ↗</a>}</div>}
        </li>; })}</ul>}
  </main><Footer /></>;
}
