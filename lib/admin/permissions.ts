export type StaffRole = 'owner' | 'admin' | 'finance' | 'operations' | 'content_manager';
export const STAFF_ROLES: StaffRole[] = ['owner', 'admin', 'finance', 'operations', 'content_manager'];
export const ROLE_LABEL: Record<StaffRole, string> = {
  owner: 'Owner', admin: 'Admin', finance: 'Finance', operations: 'Operations', content_manager: 'Content manager',
};
export const ROLE_SUMMARY: Record<StaffRole, string> = {
  owner: 'Everything, including owners and security settings',
  admin: 'Everything except owner accounts',
  finance: 'Finance, payments, receivables and payables; can view orders, customers and stock',
  operations: 'Orders, customers, enquiries, inventory and purchasing',
  content_manager: 'Products, certificates, website content, coupons and chatbot',
};

export type NavGroup = 'Overview' | 'Catalogue' | 'Sales' | 'Inventory' | 'Marketing' | 'Finance' | 'Settings';
export type NavItem = { key: string; label: string; href: string; group: NavGroup; roles: StaffRole[]; badge?: string };

export const ROLE_HELP: Record<StaffRole, string> = {
  owner: 'Everything, including adding or removing other owners and admins.',
  admin: 'Everything except changing owners. Manages team, settings and all data.',
  finance: 'Accounts, payments, receivables, payables, statements and the audit log.',
  operations: 'Orders, stock, purchases, suppliers, customers and enquiries.',
  content_manager: 'Products, photos, certificates, website text, menu, coupons and the chatbot. Cannot see customers or money.',
};
const ALL = STAFF_ROLES;
export const NAV: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', href: '/control-room', group: 'Overview', roles: ALL },
  { key: 'traffic', label: 'Website traffic', href: '/control-room/traffic', group: 'Overview', roles: ALL },

  { key: 'products', label: 'Products', href: '/control-room/products', group: 'Catalogue', roles: ['owner', 'admin', 'content_manager', 'operations'] },
  { key: 'showcase', label: 'Certificates & achievements', href: '/control-room/showcase', group: 'Catalogue', roles: ['owner', 'admin', 'content_manager'] },
  { key: 'content', label: 'Website sections', href: '/control-room/content', group: 'Catalogue', roles: ['owner', 'admin', 'content_manager'] },
  { key: 'business', label: 'Business information', href: '/control-room/business', group: 'Settings', roles: ['owner', 'admin', 'content_manager'] },
  { key: 'navigation', label: 'Navigation menu', href: '/control-room/navigation', group: 'Catalogue', roles: ['owner', 'admin', 'content_manager'] },

  { key: 'orders', label: 'Orders', href: '/control-room/orders', group: 'Sales', roles: ['owner', 'admin', 'operations', 'finance'], badge: 'orders' },
  { key: 'customers', label: 'Customers', href: '/control-room/customers', group: 'Sales', roles: ['owner', 'admin', 'operations', 'finance'] },
  { key: 'couriers', label: 'Couriers', href: '/control-room/couriers', group: 'Sales', roles: ['owner', 'admin', 'operations', 'finance'] },
  { key: 'enquiries', label: 'Enquiries', href: '/control-room/enquiries', group: 'Sales', roles: ['owner', 'admin', 'operations'], badge: 'enquiries' },

  { key: 'inventory', label: 'Stock', href: '/control-room/inventory', group: 'Inventory', roles: ['owner', 'admin', 'operations', 'finance'], badge: 'lowstock' },
  { key: 'purchases', label: 'Purchases & suppliers', href: '/control-room/purchases', group: 'Inventory', roles: ['owner', 'admin', 'operations', 'finance'] },

  { key: 'coupons', label: 'Coupons', href: '/control-room/coupons', group: 'Marketing', roles: ['owner', 'admin', 'content_manager', 'operations', 'finance'] },
  { key: 'referrals', label: 'Referrals', href: '/control-room/referrals', group: 'Marketing', roles: ['owner', 'admin', 'finance', 'content_manager', 'operations'] },

  { key: 'finance', label: 'Finance overview', href: '/control-room/finance', group: 'Finance', roles: ['owner', 'admin', 'finance'] },
  { key: 'transactions', label: 'Record transaction', href: '/control-room/finance/transactions', group: 'Finance', roles: ['owner', 'admin', 'finance'] },
  { key: 'statements', label: 'Financial statements', href: '/control-room/finance/statements', group: 'Finance', roles: ['owner', 'admin', 'finance'] },
  { key: 'receivables', label: 'Receivables', href: '/control-room/finance/receivables', group: 'Finance', roles: ['owner', 'admin', 'finance'] },
  { key: 'payables', label: 'Payables', href: '/control-room/finance/payables', group: 'Finance', roles: ['owner', 'admin', 'finance'] },

  { key: 'team', label: 'Team & access', href: '/control-room/team', group: 'Settings', roles: ['owner', 'admin'] },
  { key: 'security', label: 'Security', href: '/control-room/security', group: 'Settings', roles: ALL },
  { key: 'chatbot', label: 'AI chatbot', href: '/control-room/chatbot', group: 'Settings', roles: ['owner', 'admin', 'content_manager'] },
  { key: 'integrations', label: 'Integrations', href: '/control-room/integrations', group: 'Settings', roles: ['owner', 'admin'] },
  { key: 'audit', label: 'Audit log', href: '/control-room/audit', group: 'Settings', roles: ['owner', 'admin', 'finance'] },
];

export const NAV_GROUPS: NavGroup[] = ['Overview', 'Catalogue', 'Sales', 'Inventory', 'Marketing', 'Finance', 'Settings'];
export const navFor = (role: StaffRole) => NAV.filter((n) => n.roles.includes(role));

/** Longest matching nav entry decides whether a role may open a path. */
export function canOpen(role: StaffRole, pathname: string) {
  const match = [...NAV].sort((a, b) => b.href.length - a.href.length)
    .find((n) => pathname === n.href || pathname.startsWith(n.href + '/'));
  return !match || match.roles.includes(role);
}
