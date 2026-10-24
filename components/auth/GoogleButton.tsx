'use client';

import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

/**
 * "Continue with Google" for the sign-in and sign-up pages. One button does both: a new person gets an account,
 * a returning person is signed in. Google confirms the email address, so no verification email is needed.
 * Needs the Google provider switched on in Supabase (Authentication -> Providers -> Google).
 */
export default function GoogleButton({ next, label = 'Continue with Google' }: { next: string; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function go() {
    setMsg(''); setBusy(true);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) { setMsg('Supabase is not configured yet. Add environment variables and restart the app.'); setBusy(false); return; }
    const supabase = createBrowserClient(url, key);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`, queryParams: { prompt: 'select_account' } },
    });
    // on success the browser leaves for Google, so the button simply stays in its "busy" state
    if (error) { setMsg('Google sign-in is not available right now. Please use your email and password.'); setBusy(false); }
  }

  return (
    <div>
      <button type="button" onClick={go} disabled={busy} className="btn btn-outline w-full inline-flex items-center justify-center gap-3">
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
          <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z" />
          <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
        </svg>
        {busy ? 'Opening Google…' : label}
      </button>
      {msg && <p role="alert" className="text-sm text-red-700 mt-2">{msg}</p>}
    </div>
  );
}
