'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { safeNext } from '@/lib/safe-redirect';

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
      // one message for every failure, so the form never reveals which emails have accounts
      setMessage('Incorrect email or password.');
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
        Access your customer account or authorised admin workspace.
      </p>

      {(params.get('idle') || params.get('expired') || params.get('signed_out')) && (
        <p role="status" className="mt-4 text-sm bg-[#e3f4e9] text-[#006b38] rounded-lg px-4 py-3">
          {params.get('idle') ? 'You were signed out after a period of inactivity.' : params.get('expired') ? 'Your session ended. Please sign in again.' : 'You have been signed out.'}
        </p>
      )}

      <form
        onSubmit={submit}
        className="bg-white border border-gray-200 rounded-xl p-6 mt-6 space-y-4"
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

      <p className="text-xs muted mt-4">
        Account registration, email verification and password reset should be
        configured in Supabase before launch.
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
