/** Navigation types and the built-in menu. Pure data, so both the website (server) and the control room (browser) can import it. */
export type NavItem = { key: string; label: string; href: string; visible: boolean };
export type NavSettings = { items: NavItem[]; show_switch: boolean; show_signin: boolean };

/** Used until the team saves their own menu, and whenever the database cannot be reached. */
export const DEFAULT_NAV: NavSettings = {
  items: [
    { key: 'products', label: 'Products', href: '/retail#products', visible: true },
    { key: 'capabilities', label: 'Capabilities', href: '/retail#capabilities', visible: true },
    { key: 'quality', label: 'Quality & Certifications', href: '/retail#quality', visible: true },
    { key: 'business', label: 'Business buyers', href: '/business', visible: true },
    { key: 'track', label: 'Track order', href: '/track', visible: true },
  ],
  show_switch: true, show_signin: true,
};
