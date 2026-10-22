import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { sameOrigin } from '@/lib/admin/http';
import { notifyNewEnquiry } from '@/lib/integrations/email';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const text = (v: FormDataEntryValue | null, max: number) => typeof v === 'string' ? v.trim().slice(0, max) : '';

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Request blocked.' }, { status: 403 });
  if (!rateLimit(`enq:${clientIp(request)}`, 5, 10 * 60_000).ok) return NextResponse.json({ error: 'Too many enquiries from this connection. Please try again later.' }, { status: 429 });
  const form = await request.formData();
  // Hidden honeypot field: real visitors leave it empty, simple bots fill it. Pretend success so bots learn nothing.
  if (text(form.get('website'), 100)) return NextResponse.redirect(new URL('/enquiry?submitted=1', request.url), 303);
  const name = text(form.get('name'), 120);
  const email = text(form.get('email'), 254).toLowerCase();
  const company = text(form.get('company'), 180);
  const type = text(form.get('type'), 60) || 'Other';
  const details = text(form.get('details'), 5000);
  const quantity = text(form.get('quantity'), 120);
  const destination = text(form.get('destination'), 100);
  const productSlug = text(form.get('product_slug'), 80);

  if (!name || !emailPattern.test(email) || !details) {
    return NextResponse.json({ error: 'Please provide a name, valid email address and enquiry details.' }, { status: 400 });
  }
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: 'Enquiry service is not configured yet.' }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  // "Request quote" on a product card sends the product's address; link the enquiry to that product when it exists.
  let productId: string | null = null; let productName = '';
  if (/^[a-z0-9-]{1,80}$/.test(productSlug)) {
    const { data: prod } = await supabase.from('products').select('id, name').eq('slug', productSlug).eq('is_active', true).maybeSingle();
    if (prod) { productId = prod.id; productName = prod.name; }
  }
  const { error } = await supabase.from('enquiries').insert({
    user_id: user?.id ?? null, name, email, company: company || null,
    enquiry_type: type, product_id: productId, details: productName ? `Product: ${productName}\n${details}` : details, quantity_text: quantity || null,
    destination_country: destination || null
  });
  if (error) {
    // Do not leak database details to anonymous visitors.
    return NextResponse.json({ error: 'We could not submit your enquiry right now. Please try again later.' }, { status: 500 });
  }
  await notifyNewEnquiry({ name, email, company, type, details });
  return NextResponse.redirect(new URL('/enquiry?submitted=1', request.url), 303);
}
