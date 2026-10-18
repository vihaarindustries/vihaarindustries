import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const staffRoles = ['owner', 'admin', 'finance', 'operations', 'content_manager'];

const sections = [
  { title: 'Products', description: 'Product catalogue and published status.', href: '/control-room/products' },
  { title: 'Orders', description: 'Retail, business and export orders.', href: '/control-room/orders' },
  { title: 'Inventory', description: 'Stock batches, quantities and expiry dates.', href: '/control-room/inventory' },
  { title: 'Enquiries', description: 'Customer, bulk purchasing and export enquiries.', href: '/control-room/enquiries' },
  { title: 'Coupons & referrals', description: 'Manage promotions and referral offers.', href: '/control-room/promotions' },
  { title: 'Website content', description: 'Manage visibility of website sections.', href: '/control-room/content' },
  { title: 'Finance', description: 'Accounting records and journal entries.', href: '/control-room/finance', roles: ['owner', 'admin', 'finance'] },
  { title: 'Team & access', description: 'Staff accounts and application roles.', href: '/control-room/team', roles: ['owner', 'admin'] },
];

export default async function ControlRoomHome() {
  const supabase = await createClient();

  if (!supabase) {
    return (
      <main className="min-h-screen p-8">
        <h1 className="text-2xl font-black">Admin setup required</h1>
        <p className="mt-2">Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel, then redeploy.</p>
      </main>
    );
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/sign-in?next=/control-room');

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .maybeSingle();

  if (error || !profile || !staffRoles.includes(profile.role)) {
    redirect('/');
  }

  const visibleSections = sections.filter(
    (section) => !section.roles || section.roles.includes(profile.role)
  );

  return (
    <main className="admin-shell min-h-screen">
      <div className="grid min-h-screen md:grid-cols-[240px_1fr]">
        <aside className="admin-sidebar p-5">
          <Link href="/" className="text-xl font-black">
            Vihaar<span className="text-[#25c878]">.</span>
          </Link>
          <p className="mt-1 text-xs text-gray-400">CONTROL ROOM</p>
          <nav className="mt-8 space-y-1">
            <Link href="/control-room" className="admin-nav">Overview</Link>
            {visibleSections.map((section) => (
              <Link key={section.href} href={section.href} className="admin-nav">
                {section.title}
              </Link>
            ))}
          </nav>
          <p className="mt-10 text-[10px] text-gray-500">
            Signed in as {profile.full_name || user.email}
          </p>
        </aside>

        <section className="min-w-0 p-5 md:p-10">
          <div className="text-xs font-bold uppercase tracking-widest text-vihaar-green">
            Vihaar Industries · Administration
          </div>
          <h1 className="mt-2 text-3xl font-black">Control room</h1>
          <p className="muted mt-2">
            Manage your catalogue, customer enquiries, orders and website operations.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleSections.map((section) => (
              <Link
                key={section.href}
                href={section.href}
                className="block rounded-xl border border-gray-200 bg-white p-5 transition hover:border-green-500 hover:shadow-sm"
              >
                <h2 className="font-bold">{section.title}</h2>
                <p className="muted mt-2 text-sm leading-6">{section.description}</p>
                <span className="mt-5 inline-block text-sm font-semibold text-vihaar-green">
                  Open section →
                </span>
              </Link>
            ))}
          </div>

          <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <strong>Access control is enabled.</strong>
            <p className="mt-1">
              Only profiles with an owner, admin, finance, operations or content_manager
              role can open the control room. Give staff roles only to trusted accounts.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
