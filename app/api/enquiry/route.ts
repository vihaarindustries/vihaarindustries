import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const text = (v: FormDataEntryValue | null, max: number) => typeof v === 'string' ? v.trim().slice(0, max) : '';

export async function POST(request: Request) {
  const form = await request.formData();
  const name = text(form.get('name'), 120);
  const email = text(form.get('email'), 254).toLowerCase();
  const company = text(form.get('company'), 180);
  const type = text(form.get('type'), 60) || 'Other';
  const details = text(form.get('details'), 5000);
  const quantity = text(form.get('quantity'), 120);
  const destination = text(form.get('destination'), 100);

  if (!name || !emailPattern.test(email) || !details) {
    return NextResponse.json({ error: 'Please provide a name, valid email address and enquiry details.' }, { status: 400 });
  }
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: 'Enquiry service is not configured yet.' }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('enquiries').insert({
    user_id: user?.id ?? null, name, email, company: company || null,
    enquiry_type: type, details, quantity_text: quantity || null,
    destination_country: destination || null
  });
  if (error) {
    // Do not leak database details to anonymous visitors.
    return NextResponse.json({ error: 'We could not submit your enquiry right now. Please try again later.' }, { status: 500 });
  }
  return NextResponse.redirect(new URL('/enquiry?submitted=1', request.url), 303);
}
