'use client';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createBrowser } from '@/lib/supabase/browser';
import { safeNext } from '@/lib/safe-redirect';

type Mode = 'loading' | 'enroll' | 'verify' | 'noauth';

function Content() {
  const next = safeNext(useSearchParams().get('next'), '/control-room');
  const [mode, setMode] = useState<Mode>('loading');
  const [factorId, setFactorId] = useState(''); const [qr, setQr] = useState(''); const [secret, setSecret] = useState('');
  const [code, setCode] = useState(''); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);

  const start = useCallback(async () => {
    const sb = createBrowser();
    const { data: u } = await sb.auth.getUser();
    if (!u.user) return setMode('noauth');
    const { data: f } = await sb.auth.mfa.listFactors();
    const verified = f?.totp?.find((x) => x.status === 'verified');
    if (verified) { setFactorId(verified.id); return setMode('verify'); }
    // clear any half-finished setup, then start a fresh one
    for (const x of f?.all ?? []) if (x.status !== 'verified') await sb.auth.mfa.unenroll({ factorId: x.id });
    const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Control room ${new Date().toISOString().slice(0, 10)}` });
    if (error || !data) { setMsg('Could not start setup. Please try again.'); return setMode('enroll'); }
    setFactorId(data.id); setQr(data.totp.qr_code); setSecret(data.totp.secret); setMode('enroll');
  }, []);
  useEffect(() => { start(); }, [start]);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg('');
    const sb = createBrowser();
    const { error } = await sb.auth.mfa.challengeAndVerify({ factorId, code: code.replace(/\s/g, '') });
    if (error) { setMsg('That code was not accepted. Check the code in your app and try again.'); setBusy(false); setCode(''); return; }
    window.location.href = next;
  }

  return <main className="container max-w-md py-16">
    <a href="/" className="font-black text-xl">Vihaar<span className="text-vihaar-green">.</span></a>
    <h1 className="text-3xl font-black mt-8">{mode === 'enroll' ? 'Set up two-step verification' : 'Two-step verification'}</h1>
    {mode === 'loading' && <p className="muted mt-4">Loading…</p>}
    {mode === 'noauth' && <p className="mt-4">Please <a className="underline font-bold" href={`/auth/sign-in?next=${encodeURIComponent(next)}`}>sign in</a> first.</p>}
    {(mode === 'enroll' || mode === 'verify') && <>
      <p className="muted mt-2 text-sm">{mode === 'enroll' ? 'Scan this code with an authenticator app (Google Authenticator, Microsoft Authenticator, Authy), then type the 6-digit code it shows.' : 'Enter the 6-digit code from your authenticator app.'}</p>
      <form onSubmit={submit} className="bg-white border border-gray-200 rounded-xl p-6 mt-6 space-y-4">
        {mode === 'enroll' && qr && <div className="text-center">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={qr} alt="QR code to scan" width={180} height={180} className="mx-auto" />
          <details className="mt-3 text-xs text-left"><summary className="cursor-pointer font-bold">Can&apos;t scan? Enter the key by hand</summary><code className="block mt-2 break-all bg-gray-100 rounded p-2 select-all">{secret}</code></details></div>}
        <label className="block text-sm font-semibold">6-digit code
          <input className="field block mt-2 text-center text-xl tracking-[.4em]" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} required autoFocus /></label>
        <button disabled={busy || code.replace(/\s/g, '').length !== 6} className="btn w-full">{busy ? 'Checking…' : mode === 'enroll' ? 'Turn on and continue' : 'Verify'}</button>
        {msg && <p role="alert" className="text-sm text-red-700">{msg}</p>}
      </form>
      <form action="/auth/sign-out" method="post" className="mt-4 text-center"><button className="text-xs underline muted" type="submit">Use a different account</button></form>
    </>}
  </main>;
}
export default function Page() { return <Suspense fallback={<main className="container max-w-md py-16"><p className="muted">Loading…</p></main>}><Content /></Suspense>; }
