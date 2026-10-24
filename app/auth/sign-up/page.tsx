'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { safeNext } from '@/lib/safe-redirect';
import GoogleButton from '@/components/auth/GoogleButton';

function SignUpContent() {
  const params = useSearchParams();
  const next = safeNext(params.get('next'));
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage('');
    if (password.length < 8) { setMessage('Please choose a password of at least 8 characters.'); return; }
    if (password !== confirm) { setMessage('The two passwords do not match.'); return; }
    setBusy(true);

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) { setMessage('Supabase is not configured yet. Add environment variables and restart the app.'); setBusy(false); return; }

    const supabase = createBrowserClient(url, key);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: name.trim() },
        emailRedirectTo: `${window.location.origin}/auth/sign-in?next=${encodeURIComponent(next)}`,
      },
    });

    if (error) { setMessage(error.message || 'We could not create your account. Please try again.'); setBusy(false); return; }

    // If an account with this email already exists, Supabase returns a user with no identities and sends nothing.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      setMessage('An account with this email already exists. Please sign in instead.');
      setBusy(false);
      return;
    }
    // Email confirmation switched OFF in Supabase: the visitor is already signed in.
    if (data.session) { window.location.href = next; return; }
    // Email confirmation switched ON: they must open the link we emailed first.
    setSent(true);
    setBusy(false);
  }

  const signInHref = `/auth/sign-in${params.get('next') ? `?next=${encodeURIComponent(next)}` : ''}`;

  return (
    <main className="container max-w-md py-16">
      <a href="/" className="font-black text-xl">Vihaar<span className="text-vihaar-green">.</span></a>
      <h1 className="text-3xl font-black mt-8">Create your account</h1>
      <p className="muted mt-2">You need an account to place orders and to track them.</p>

      {sent ? (
        <div role="status" className="bg-white border border-gray-200 rounded-xl p-6 mt-6 space-y-3">
          <h2 className="font-black text-lg">Check your email</h2>
          <p className="text-sm">We sent a confirmation link to <b>{email}</b>. Open the email, press the confirm button, and your account is ready. If you do not see it, check your spam folder.</p>
          <a href={signInHref} className="btn w-full">Go to sign in</a>
        </div>
      ) : (
        <>
        <div className="mt-6"><GoogleButton next={next} label="Sign up with Google" /></div>
        <div className="flex items-center gap-3 mt-5 text-xs muted" aria-hidden="true"><span className="flex-1 border-t border-gray-200" />or create an account with email<span className="flex-1 border-t border-gray-200" /></div>
        <form onSubmit={submit} className="bg-white border border-gray-200 rounded-xl p-6 mt-5 space-y-4">
          <label className="block text-sm font-semibold">Full name
            <input className="field block mt-2" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={160} />
          </label>
          <label className="block text-sm font-semibold">Email
            <input className="field block mt-2" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={254} />
          </label>
          <label className="block text-sm font-semibold">Password
            <input className="field block mt-2" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          </label>
          <label className="block text-sm font-semibold">Confirm password
            <input className="field block mt-2" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} />
          </label>
          <button disabled={busy} className="btn w-full">{busy ? 'Creating account…' : 'Create account'}</button>
          {message && <p role="alert" className="text-sm text-red-700">{message}</p>}
        </form>
        </>
      )}

      <p className="text-sm mt-6">Already have an account? <a href={signInHref} className="font-bold underline">Sign in</a></p>
    </main>
  );
}

export default function SignUp() {
  return (
    <Suspense fallback={<main className="container max-w-md py-16"><p className="muted">Loading…</p></main>}>
      <SignUpContent />
    </Suspense>
  );
}
