import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type SectionConfig = {
  title: string;
  description: string;
  table: string;
  columns: { key: string; label: string }[];
  roles?: string[];
};

const sections: Record<string, SectionConfig> = {
  products: {
    title: 'Products', description: 'Product catalogue and published status.', table: 'products',
    columns: [
      { key: 'name', label: 'Product' }, { key: 'sku', label: 'SKU' },
      { key: 'unit', label: 'Unit' }, { key: 'retail_price_minor', label: 'Retail price (minor units)' },
      { key: 'wholesale_price_minor', label: 'Wholesale price (minor units)' }, { key: 'is_active', label: 'Active' },
    ],
  },
  orders: {
    title: 'Orders', description: 'Retail, business and export orders.', table: 'orders',
    columns: [
      { key: 'order_number', label: 'Order' }, { key: 'order_type', label: 'Type' },
      { key: 'status', label: 'Status' }, { key: 'currency', label: 'Currency' },
      { key: 'total_minor', label: 'Total (minor units)' }, { key: 'placed_at', label: 'Placed at' },
    ],
  },
  inventory: {
    title: 'Inventory', description: 'Batch stock, expiry dates and on-hand quantities.', table: 'inventory_batches',
    columns: [
      { key: 'batch_number', label: 'Batch' }, { key: 'product_id', label: 'Product ID' },
      { key: 'quantity_on_hand', label: 'On hand' }, { key: 'quantity_reserved', label: 'Reserved' },
      { key: 'manufactured_on', label: 'Manufactured' }, { key: 'expires_on', label: 'Expires' },
    ],
  },
  enquiries: {
    title: 'Enquiries', description: 'Customer, bulk purchasing and export enquiries.', table: 'enquiries',
    columns: [
      { key: 'name', label: 'Contact' }, { key: 'company', label: 'Company' },
      { key: 'email', label: 'Email' }, { key: 'enquiry_type', label: 'Type' },
      { key: 'status', label: 'Status' }, { key: 'created_at', label: 'Received' },
    ],
  },
  promotions: {
    title: 'Coupons & referrals', description: 'Coupon codes, referral offers and eligibility settings.', table: 'promotions',
    columns: [
      { key: 'code', label: 'Code' }, { key: 'promotion_type', label: 'Type' },
      { key: 'discount_type', label: 'Discount type' }, { key: 'discount_value', label: 'Value' },
      { key: 'applies_to', label: 'Applies to' }, { key: 'is_active', label: 'Active' },
    ],
  },
  content: {
    title: 'Website content', description: 'Visibility and ordering of configurable website sections.', table: 'site_sections',
    columns: [
      { key: 'section_key', label: 'Section key' }, { key: 'title', label: 'Title' },
      { key: 'sort_order', label: 'Sort order' }, { key: 'is_visible', label: 'Visible' },
      { key: 'updated_at', label: 'Last updated' },
    ],
  },
  finance: {
    title: 'Finance', description: 'Journal entries and accounting status. Monetary amounts are stored in minor units (for INR, paise).', table: 'journal_entries',
    roles: ['owner', 'admin', 'finance'],
    columns: [
      { key: 'entry_number', label: 'Entry #' }, { key: 'entry_date', label: 'Date' },
      { key: 'description', label: 'Description' }, { key: 'source_type', label: 'Source' },
      { key: 'status', label: 'Status' }, { key: 'currency', label: 'Currency' },
    ],
  },
  team: {
    title: 'Team & access', description: 'Staff accounts and assigned application roles.', table: 'profiles',
    roles: ['owner', 'admin'],
    columns: [
      { key: 'full_name', label: 'Name' }, { key: 'email', label: 'Email' },
      { key: 'role', label: 'Role' }, { key: 'account_type', label: 'Account type' },
      { key: 'created_at', label: 'Created' },
    ],
  },
};

function display(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export default async function ControlRoomSection({ params }: { params: { Section: string } }) {
  const config = sections[params.Section];
  if (!config) notFound();

  const supabase = await createClient();
  if (!supabase) {
    return <main className="p-8"><h1 className="text-2xl font-black">Admin setup required</h1><p className="mt-2">Configure Supabase environment variables and apply the SQL migrations.</p></main>;
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/sign-in?next=/control-room/${params.Section}`);
  const { data: profile } = await supabase.from('profiles').select('role,full_name').eq('id', user.id).maybeSingle();
  const staffRoles = ['owner', 'admin', 'finance', 'operations', 'content_manager'];
  if (!profile || !staffRoles.includes(profile.role)) redirect('/');
  if (config.roles && !config.roles.includes(profile.role)) redirect('/control-room');

  const { data, error } = await supabase.from(config.table).select('*').order('created_at', { ascending: false }).limit(100);
  const rows = (data ?? []) as Record<string, unknown>[];
  const columns = config.columns;

  return (
    <main className="admin-shell min-h-screen">
      <div className="grid md:grid-cols-[240px_1fr]">
        <aside className="admin-sidebar p-5">
          <Link href="/" className="text-xl font-black">Vihaar<span className="text-[#25c878]">.</span></Link>
          <p className="mt-1 text-xs text-gray-400">CONTROL ROOM</p>
          <nav className="mt-8 space-y-1">
            {[
              ['Overview', '/control-room'], ['Products', '/control-room/products'], ['Orders', '/control-room/orders'],
              ['Inventory', '/control-room/inventory'], ['Enquiries', '/control-room/enquiries'],
              ['Coupons & referrals', '/control-room/promotions'], ['Website content', '/control-room/content'],
              ['Finance', '/control-room/finance'], ['Team & access', '/control-room/team'],
            ].map(([label, href]) => <Link key={href} href={href} className="admin-nav">{label}</Link>)}
          </nav>
          <p className="mt-10 text-[10px] text-gray-500">Signed in as {profile.full_name || user.email}</p>
        </aside>
        <section className="min-w-0 p-5 md:p-10">
          <Link href="/control-room" className="text-sm text-vihaar-green hover:underline">← Back to overview</Link>
          <div className="mt-5 text-xs font-bold uppercase tracking-widest text-vihaar-green">Control room</div>
          <h1 className="mt-2 text-3xl font-black">{config.title}</h1>
          <p className="muted mt-2">{config.description}</p>
          {error ? (
            <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
              <strong>Could not load this section.</strong><p className="mt-1">Check that the database migrations for this table have been applied and that your staff role has permission to read it.</p>
            </div>
          ) : (
            <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 p-4">
                <div><strong>{rows.length}</strong><span className="muted ml-2 text-sm">records shown (maximum 100)</span></div>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600">Read-only view</span>
              </div>
              {rows.length === 0 ? (
                <div className="p-10 text-center"><h2 className="font-bold">Nothing here yet</h2><p className="muted mt-2 text-sm">Once records exist in the database, they will appear here.</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500"><tr>{columns.map(c => <th key={c.key} className="whitespace-nowrap px-4 py-3">{c.label}</th>)}</tr></thead>
                    <tbody>{rows.map((row, index) => <tr key={String(row.id ?? index)} className="border-t border-gray-100 hover:bg-gray-50">{columns.map(c => <td key={c.key} className="max-w-[280px] whitespace-nowrap px-4 py-3 text-gray-700">{display(row[c.key])}</td>)}</tr>)}</tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          <p className="muted mt-4 text-xs">This patch restores the missing routes and provides a read-only data view. Create/edit workflows, file uploads and status-changing actions will be added separately with server-side validation and audit logging.</p>
        </section>
      </div>
    </main>
  );
}
