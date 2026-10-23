import { redirect } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/site/Footer';
import CheckoutForm from '@/components/cart/CheckoutForm';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Checkout', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function CheckoutPage() {
  // Placing an order needs an account. (The middleware also redirects; this is the second lock.)
  const sb = await createClient();
  const { data: { user } } = sb ? await sb.auth.getUser() : { data: { user: null } };
  if (!user) redirect('/auth/sign-in?next=/checkout');
  const { data: profile } = await sb!.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
  const name = (profile?.full_name as string | undefined) || (user.user_metadata?.full_name as string | undefined) || '';
  return <><Header mode="retail" /><main className="container py-12 max-w-5xl"><CheckoutForm accountEmail={user.email ?? ''} accountName={name} /></main><Footer mode="retail" /></>;
}
