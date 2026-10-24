'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { safeNext } from '@/lib/safe-redirect';
import GoogleButton from '@/components/auth/GoogleButton';

function SignInContent() {
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage('');

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      setMessage('Supabase is not configured yet. Add environment variables and restart the app.');
      setBusy(false);
      return;
    }

    const supabase = createBrowserClient(url, key);
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      // Supabase only reports "not confirmed" when the password was correct, so this does not reveal who has an account.
      if (error.code === 'email_not_confirmed') setMessage('Please confirm your email first. Open the link we sent you, then sign in.');
      // one message for every other failure: wrong password and "no such account" look the same
      else setMessage('Incorrect email or password. If you do not have an account yet, create one first.');
      setBusy(false);
      return;
    }

    window.location.href = safeNext(params.get('next'));
  }

  return (
    <main className="container max-w-md py-16">
      <a href="/" className="font-black text-xl">
        Vihaar<span className="text-vihaar-green">.</span>
      </a>
      <h1 className="text-3xl font-black mt-8">Sign in</h1>
      <p className="muted mt-2">
        Sign in to your existing account to place and track orders.
      </p>
      {params.get('next')?.startsWith('/checkout') && (
        <p role="status" className="mt-4 text-sm bg-amber-50 text-amber-900 rounded-lg px-4 py-3">
          Please sign in to place your order. Your cart is saved.
        </p>
      )}

      {(params.get('idle') || params.get('expired') || params.get('signed_out')) && (
        <p role="status" className="mt-4 text-sm bg-[#e3f4e9] text-[#006b38] rounded-lg px-4 py-3">
          {params.get('idle') ? 'You were signed out after a period of inactivity.' : params.get('expired') ? 'Your session ended. Please sign in again.' : 'You have been signed out.'}
        </p>
      )}

      {params.get('oauth_error') && (
        <p role="alert" className="mt-4 text-sm bg-red-50 text-red-800 rounded-lg px-4 py-3">
          Google sign-in was cancelled or did not complete. Please try again, or use your email and password.
        </p>
      )}

      <div className="mt-6"><GoogleButton next={safeNext(params.get('next'))} /></div>
      <div className="flex items-center gap-3 mt-5 text-xs muted" aria-hidden="true"><span className="flex-1 border-t border-gray-200" />or sign in with email<span className="flex-1 border-t border-gray-200" /></div>

      <form
        onSubmit={submit}
        className="bg-white border border-gray-200 rounded-xl p-6 mt-5 space-y-4"
      >
        <label className="block text-sm font-semibold">
          Email
          <input
            className="field block mt-2"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label className="block text-sm font-semibold">
          Password
          <input
            className="field block mt-2"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        <button disabled={busy} className="btn w-full">
          {busy ? 'Signing in…' : 'Sign in securely'}
        </button>

        {message && (
          <p role="alert" className="text-sm text-red-700">
            {message}
          </p>
        )}
      </form>

      <p className="text-sm mt-6">
        New here?{' '}
        <a href={`/auth/sign-up${params.get('next') ? `?next=${encodeURIComponent(safeNext(params.get('next')))}` : ''}`} className="font-bold underline">Create an account</a>
      </p>
    </main>
  );
}

export default function SignIn() {
  return (
    <Suspense
      fallback={
        <main className="container max-w-md py-16">
          <p className="muted">Loading sign-in page…</p>
        </main>
      }
    >
      <SignInContent />
    </Suspense>
  );
}
