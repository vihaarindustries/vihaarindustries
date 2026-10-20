'use client';
import { useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert } from 'lucide-react';
import { Alert, Btn, Card, PageHeader, Spinner } from '@/components/admin/ui';
import { createBrowser } from '@/lib/supabase/browser';
import { useRole } from '@/components/admin/role';
import { ROLE_LABEL } from '@/lib/admin/permissions';

export default function Page() {
  const role = useRole();
  const [state, setState] = useState<{ email: string; factors: number; level: string; signedIn: string | null } | null>(null);
  useEffect(() => { (async () => {
    const sb = createBrowser(); const { data: u } = await sb.auth.getUser(); const { data: f } = await sb.auth.mfa.listFactors(); const { data: a } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    setState({ email: u.user?.email ?? '', factors: f?.totp?.length ?? 0, level: a?.currentLevel ?? 'aal1', signedIn: u.user?.last_sign_in_at ?? null });
  })(); }, []);
  if (!state) return <Spinner />;
  const ok = state.factors > 0 && state.level === 'aal2';
  return <div><PageHeader title="Security" subtitle="Protect your account. The control room holds customer and financial data." />
    <div className="grid lg:grid-cols-2 gap-4">
      <Card title="Two-step verification">
        <div className="flex items-start gap-3">{ok ? <ShieldCheck className="text-[#008b47] shrink-0" /> : <ShieldAlert className="text-amber-600 shrink-0" />}
          <div className="text-sm"><p className="font-bold">{ok ? 'Switched on for this account' : 'Not completed'}</p>
            <p className="muted mt-1">{ok ? 'You enter a 6-digit code from your authenticator app every time you sign in. The database itself refuses staff data without it.' : 'Add an authenticator app (Google Authenticator, Microsoft Authenticator, Authy) to unlock the control room.'}</p>
            {!ok && <a href="/auth/mfa?next=/control-room/security"><Btn className="mt-4">Set up now</Btn></a>}</div></div>
      </Card>
      <Card title="This account"><dl className="text-sm space-y-2"><div className="flex justify-between"><dt className="muted">Email</dt><dd className="font-semibold">{state.email}</dd></div><div className="flex justify-between"><dt className="muted">Role</dt><dd className="font-semibold">{ROLE_LABEL[role]}</dd></div>
        <div className="flex justify-between"><dt className="muted">Last sign-in</dt><dd className="font-semibold">{state.signedIn ? new Date(state.signedIn).toLocaleString('en-IN') : '—'}</dd></div></dl>
        <form action="/auth/sign-out" method="post" className="mt-5"><Btn type="submit" variant="outline">Log out of this device</Btn></form></Card>
      <Card title="Built-in protections" className="lg:col-span-2"><ul className="text-sm space-y-2 list-disc pl-5">
        <li>The control room address is hidden: it shows a 404 page unless the secret entry link was opened first.</li>
        <li>Every change is checked three times: by the server, by role rules in the database, and recorded in the permanent audit log.</li>
        <li>You are signed out automatically after a period of inactivity, and sessions expire after a working day.</li>
        <li>Customer details are visible only to sales, finance and admin roles. Content managers cannot see them.</li>
        <li>Photos and documents: public images are separate from private certificate documents, which open only through short-lived links.</li></ul>
        <div className="mt-4"><Alert tone="info">Tip: give each person their own login. Never share one account. Switch a person off under <b>Team &amp; access</b> the day they leave.</Alert></div></Card>
    </div></div>;
}
