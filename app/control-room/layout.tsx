import { redirect } from 'next/navigation';
import { getStaffState } from '@/lib/admin/guard';
import { navFor } from '@/lib/admin/permissions';
import Shell from '@/components/admin/Shell';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Control room | Vihaar Industries', robots: { index: false, follow: false } };

/**
 * One layout for every control-room page. The menu stays on screen while you move between sections,
 * so each item opens directly from the left menu. Sign-in, MFA and role are checked here (and again by the API and database).
 */
export default async function ControlRoomLayout({ children }: { children: React.ReactNode }) {
  const state = await getStaffState();
  if (state.status === 'unconfigured') return <Message title="Setup required" text="Add the Supabase environment variables (see .env.example) and restart the app." />;
  if (state.status === 'anon') redirect('/auth/sign-in?next=/control-room');
  if (state.status === 'expired') redirect('/auth/sign-in?next=/control-room&expired=1');
  if (state.status === 'needs_mfa') redirect('/auth/mfa?next=/control-room');
  if (state.status === 'forbidden') return <Message title="No access" text="This account is not an active team member. Ask an owner to grant access." signOut />;
  const { role, fullName, email } = state.ctx;
  return <Shell nav={navFor(role)} role={role} name={fullName ?? ''} email={email ?? ''} idleMinutes={Number(process.env.ADMIN_IDLE_MINUTES || 30)}>{children}</Shell>;
}

function Message({ title, text, signOut }: { title: string; text: string; signOut?: boolean }) {
  return <main className="container max-w-md py-24 text-center"><h1 className="text-3xl font-black">{title}</h1><p className="muted mt-3">{text}</p>
    {signOut && <form action="/auth/sign-out" method="post" className="mt-6"><button className="btn" type="submit">Sign out</button></form>}</main>;
}
