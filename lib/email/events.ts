/**
 * Every customer email the website can send, in one list.
 * This file has NO server-only imports on purpose: the control room (browser) uses it to show the
 * list of emails, the {{placeholders}} each one supports and a live preview, and the server uses
 * the very same list when it actually sends.
 *
 * To add a new email later: add one entry here, then call sendEventEmail('your_key', ...) from the
 * place in the code where it should be triggered. It appears in Control room -> Email templates automatically.
 */
export type EmailVar = { key: string; label: string; sample: string };
export type EmailGroup = 'Account' | 'Orders' | 'Payments';
export type EmailEvent = {
  key: string;
  group: EmailGroup;
  label: string;
  /** Plain-language description of when this email is sent. */
  trigger: string;
  /** Security emails (verify, reset, invite) can be edited but never switched off. */
  locked?: boolean;
  vars: EmailVar[];
  /** Which placeholder holds the link that the big button opens. Empty value = no button. */
  buttonVar?: string;
  defaults: { subject: string; body: string; buttonLabel: string };
};

/** Available in every email. Filled in automatically from Control room -> Business information. */
export const COMMON_VARS: EmailVar[] = [
  { key: 'name', label: 'Customer name', sample: 'Anita Shah' },
  { key: 'site_name', label: 'Your business name', sample: 'Vihaar Industries' },
  { key: 'site_url', label: 'Website address', sample: 'https://www.example.com' },
  { key: 'support_email', label: 'Your support email', sample: 'care@example.com' },
  { key: 'support_phone', label: 'Your support phone', sample: '+91 98765 43210' },
];

const ORDER_BASE: EmailVar[] = [
  { key: 'order_number', label: 'Order number', sample: 'VI-26-000123' },
  { key: 'order_total', label: 'Order total', sample: '₹1,250.00' },
  { key: 'order_items', label: 'List of items ordered', sample: '2 × Turmeric Powder 200g\n1 × Red Chilli Powder 500g' },
  { key: 'shipping_address', label: 'Delivery address', sample: '12 MG Road\nAhmedabad, Gujarat - 380001\nIndia' },
  { key: 'payment_method', label: 'Payment method chosen', sample: 'UPI / bank transfer' },
  { key: 'payable_amount', label: 'Amount payable (in the currency chosen when the order was accepted)', sample: '$14.79' },
  { key: 'rate_note', label: 'Exchange-rate note (empty for rupee orders)', sample: 'Exchange rate locked: 1 USD = ₹84.50 (European Central Bank, 24 Oct 2026).' },
  { key: 'track_url', label: 'Link to the customer’s orders page', sample: 'https://www.example.com/account' },
];

export const EMAIL_EVENTS: EmailEvent[] = [
  {
    key: 'email_verification', group: 'Account', label: 'Verify email address', locked: true,
    trigger: 'Right after someone creates an account. They must click the link before they can sign in.',
    vars: [{ key: 'verify_link', label: 'Verification link (required)', sample: 'https://www.example.com/auth/confirm?token_hash=abc123&type=signup' }],
    buttonVar: 'verify_link',
    defaults: {
      subject: 'Verify your email for {{site_name}}',
      body: 'Hello {{name}},\n\nWelcome to {{site_name}}! Please confirm your email address to activate your account.\n\nThe link can be used once and expires after a short time. If it has expired, create the account again and we will send a fresh link.\n\nIf you did not create this account, you can safely ignore this email.',
      buttonLabel: 'Verify my email',
    },
  },
  {
    key: 'password_reset', group: 'Account', label: 'Password reset', locked: true,
    trigger: 'When a password reset is requested for an account (for example from the Supabase dashboard).',
    vars: [{ key: 'reset_link', label: 'Reset link (required)', sample: 'https://www.example.com/auth/confirm?token_hash=abc123&type=recovery' }],
    buttonVar: 'reset_link',
    defaults: {
      subject: 'Reset your {{site_name}} password',
      body: 'Hello {{name}},\n\nWe received a request to reset the password for your account.\n\nIf this was you, use the button below. If not, you can ignore this email and your password will stay the same.',
      buttonLabel: 'Reset password',
    },
  },
  {
    key: 'staff_invite', group: 'Account', label: 'Team member invitation', locked: true,
    trigger: 'When an owner or admin invites a new team member from Team & access.',
    vars: [{ key: 'invite_link', label: 'Invitation link (required)', sample: 'https://www.example.com/auth/confirm?token_hash=abc123&type=invite' }],
    buttonVar: 'invite_link',
    defaults: {
      subject: 'You have been invited to {{site_name}}',
      body: 'Hello {{name}},\n\nYou have been invited to join the {{site_name}} team.\n\nUse the button below to accept the invitation and set up your access.',
      buttonLabel: 'Accept invitation',
    },
  },
  {
    key: 'order_placed', group: 'Orders', label: 'Order placed',
    trigger: 'Immediately after the customer places an order on the website.',
    vars: ORDER_BASE, buttonVar: 'track_url',
    defaults: {
      subject: 'Order placed: {{order_number}}',
      body: 'Hello {{name}},\n\nThank you for your order! We have received it and our team will review it shortly.\n\nOrder number: {{order_number}}\nOrder total: {{order_total}}\nPayment: {{payment_method}}\n\nItems:\n{{order_items}}\n\nDelivery address:\n{{shipping_address}}\n\nWe will email you again as soon as your order is accepted and when it ships.',
      buttonLabel: 'View my order',
    },
  },
  {
    key: 'order_accepted', group: 'Orders', label: 'Order accepted',
    trigger: 'When your team accepts (confirms) the order in the control room.',
    vars: ORDER_BASE, buttonVar: 'track_url',
    defaults: {
      subject: 'Order accepted: {{order_number}}',
      body: 'Hello {{name}},\n\nGood news: your order {{order_number}} has been accepted and is being prepared.\n\nPayment: {{payment_method}}\nAmount payable: {{payable_amount}}\n{{rate_note}}\n\nIf you chose UPI / bank transfer, our team will share the payment details with you shortly.\n\nWe will email you the courier and tracking details as soon as it ships.',
      buttonLabel: 'View my order',
    },
  },
  {
    key: 'order_shipped', group: 'Orders', label: 'Order shipped',
    trigger: 'When your team marks the order as shipped (with courier and tracking ID).',
    vars: [...ORDER_BASE,
      { key: 'courier', label: 'Courier company', sample: 'Delhivery' },
      { key: 'tracking_id', label: 'Tracking ID', sample: 'DLV123456789' },
      { key: 'tracking_url', label: 'Courier tracking link (may be empty)', sample: 'https://www.delhivery.com/track/package/DLV123456789' },
      { key: 'expected_delivery', label: 'Expected delivery date (may be empty)', sample: '12 Nov 2026' }],
    buttonVar: 'tracking_url',
    defaults: {
      subject: 'Your order {{order_number}} has shipped',
      body: 'Hello {{name}},\n\nYour order {{order_number}} is on its way!\n\nCourier: {{courier}}\nTracking ID: {{tracking_id}}\nExpected delivery: {{expected_delivery}}\n\nDelivery address:\n{{shipping_address}}\n\nYou can also see every update for your order here: {{track_url}}',
      buttonLabel: 'Track my parcel',
    },
  },
  {
    key: 'order_delivered', group: 'Orders', label: 'Order delivered',
    trigger: 'When your team marks the order as delivered.',
    vars: [...ORDER_BASE, { key: 'delivered_on', label: 'Delivery date', sample: '12 Nov 2026' }],
    buttonVar: 'track_url',
    defaults: {
      subject: 'Your order {{order_number}} has been delivered',
      body: 'Hello {{name}},\n\nYour order {{order_number}} was delivered on {{delivered_on}}. We hope you enjoy it!\n\nIf anything is not right with your order, please contact us at {{support_email}} {{support_phone}} and we will be happy to help.\n\nThank you for choosing {{site_name}}.',
      buttonLabel: 'View my order',
    },
  },
  {
    key: 'payment_received', group: 'Payments', label: 'Payment received',
    trigger: 'When your team records a payment against the order (UPI, bank transfer, cash, card ...).',
    vars: [
      { key: 'order_number', label: 'Order number', sample: 'VI-26-000123' },
      { key: 'amount_received', label: 'Amount received now', sample: '₹1,250.00' },
      { key: 'payment_method', label: 'Payment method', sample: 'UPI' },
      { key: 'payment_reference', label: 'Payment reference (may be empty)', sample: 'UPI-5521983' },
      { key: 'order_total', label: 'Order total', sample: '₹1,250.00' },
      { key: 'amount_paid_total', label: 'Total paid so far', sample: '₹1,250.00' },
      { key: 'balance_due', label: 'Balance still due', sample: '₹0.00 (fully paid)' },
      { key: 'track_url', label: 'Link to the customer’s orders page', sample: 'https://www.example.com/account' }],
    buttonVar: 'track_url',
    defaults: {
      subject: 'Payment received for order {{order_number}}',
      body: 'Hello {{name}},\n\nWe have received your payment of {{amount_received}} for order {{order_number}}. Thank you!\n\nPayment method: {{payment_method}}\nReference: {{payment_reference}}\nOrder total: {{order_total}}\nTotal paid so far: {{amount_paid_total}}\nBalance due: {{balance_due}}',
      buttonLabel: 'View my order',
    },
  },
  {
    key: 'payment_refunded', group: 'Payments', label: 'Payment refunded',
    trigger: 'When your team marks an order that had payments as Refunded.',
    vars: [
      { key: 'order_number', label: 'Order number', sample: 'VI-26-000123' },
      { key: 'refund_amount', label: 'Amount refunded', sample: '₹1,250.00' },
      { key: 'order_total', label: 'Order total', sample: '₹1,250.00' },
      { key: 'track_url', label: 'Link to the customer’s orders page', sample: 'https://www.example.com/account' }],
    buttonVar: 'track_url',
    defaults: {
      subject: 'Refund processed for order {{order_number}}',
      body: 'Hello {{name}},\n\nWe have refunded {{refund_amount}} for your order {{order_number}}.\n\nThe amount will be returned to the account or method you paid with. Depending on your bank, it can take some time to show up.\n\nIf you have any questions, contact us at {{support_email}} {{support_phone}}.',
      buttonLabel: 'View my order',
    },
  },
];

export const EVENT_BY_KEY: Record<string, EmailEvent> = Object.fromEntries(EMAIL_EVENTS.map((e) => [e.key, e]));
export const getEvent = (key: string) => (Object.prototype.hasOwnProperty.call(EVENT_BY_KEY, key) ? EVENT_BY_KEY[key] : undefined);
export const allVarsFor = (e: EmailEvent): EmailVar[] => {
  const own = new Set(e.vars.map((v) => v.key));
  return [...COMMON_VARS.filter((v) => !own.has(v.key)), ...e.vars];
};
export const sampleVars = (e: EmailEvent): Record<string, string> => Object.fromEntries(allVarsFor(e).map((v) => [v.key, v.sample]));
