import type { StaffRole } from './permissions';

/**
 * One definition per admin table. The same file drives the API (what may be read, written and by
 * whom, and how input is validated) and the screens (columns, forms, filters). Anything not listed
 * here cannot be reached through the admin API. Row-level security in the database repeats these rules.
 */
export type FieldType = 'text' | 'textarea' | 'number' | 'money' | 'moneyOrPercent' | 'bool' | 'date' | 'datetime' | 'select' | 'email' | 'phone' | 'slug' | 'kv' | 'image' | 'file' | 'ref' | 'multiref';
export type Option = { value: string; label: string };
export type FieldDef = {
  name: string; label: string; type: FieldType; required?: boolean; max?: number; min?: number; step?: number; integer?: boolean;
  options?: Option[]; group?: string; help?: string; placeholder?: string; readOnly?: boolean; lockOnEdit?: boolean;
  ref?: { resource: string; label: string }; bucket?: 'product-media' | 'site-media' | 'private-documents'; default?: unknown;
  typeField?: string; slugFrom?: string; half?: boolean; hideInForm?: boolean;
};
export type ColumnDef = { key: string; label: string; type?: 'text' | 'money' | 'bool' | 'date' | 'datetime' | 'badge' | 'number' | 'image'; badges?: Record<string, 'green' | 'red' | 'amber' | 'blue' | 'gray'>; bucket?: 'product-media' | 'site-media' };
export type ResourceDef = {
  key: string; label: string; singular: string; table: string; select?: string;
  orderBy: { column: string; asc?: boolean }; sortable?: boolean;
  read: StaffRole[]; write: StaffRole[]; remove: StaffRole[]; creatable?: boolean;
  fields: FieldDef[]; columns: ColumnDef[]; search: string[];
  filters?: { column: string; label: string; options: Option[] }[]; filterable?: string[];
  fixed?: Record<string, string>; defaults?: Record<string, unknown>;
  pii?: boolean; exportable?: boolean; emptyText?: string; noTieBreak?: boolean;
};

const OWNER_ADMIN: StaffRole[] = ['owner', 'admin'];
const CONTENT: StaffRole[] = ['owner', 'admin', 'content_manager'];
const OPS: StaffRole[] = ['owner', 'admin', 'operations'];
const FIN: StaffRole[] = ['owner', 'admin', 'finance'];
const ALL: StaffRole[] = ['owner', 'admin', 'finance', 'operations', 'content_manager'];
const OPS_FIN: StaffRole[] = ['owner', 'admin', 'operations', 'finance'];
const opts = (...v: string[]): Option[] => v.map((x) => ({ value: x, label: x.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) }));

export const ORDER_STATUS_BADGES: Record<string, 'green' | 'red' | 'amber' | 'blue' | 'gray'> = {
  draft: 'gray', pending_payment: 'amber', confirmed: 'blue', processing: 'blue', packed: 'blue', shipped: 'blue', delivered: 'green', cancelled: 'red', refunded: 'red',
};

export const RESOURCES: Record<string, ResourceDef> = {
  categories: {
    key: 'categories', label: 'Categories', singular: 'category', table: 'product_categories', orderBy: { column: 'sort_order', asc: true }, sortable: true,
    read: ALL, write: CONTENT, remove: CONTENT, search: ['name'], emptyText: 'No categories yet. Add one to group your products.',
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true, max: 80 },
      { name: 'slug', label: 'Web address', type: 'slug', required: true, max: 80, slugFrom: 'name', help: 'Used in the link, e.g. whole-spices' },
      { name: 'description', label: 'Description', type: 'textarea', max: 500 },
      { name: 'is_visible', label: 'Show on website', type: 'bool', default: true },
    ],
    columns: [{ key: 'name', label: 'Category' }, { key: 'slug', label: 'Address' }, { key: 'is_visible', label: 'Visible', type: 'bool' }],
  },

  products: {
    key: 'products', label: 'Products', singular: 'product', table: 'products', select: '*, product_categories(name)',
    orderBy: { column: 'sort_order', asc: true }, sortable: true,
    read: ALL, write: CONTENT, remove: OWNER_ADMIN, search: ['name', 'sku'], exportable: true,
    filters: [
      { column: 'is_active', label: 'Status', options: [{ value: 'true', label: 'Published' }, { value: 'false', label: 'Hidden' }] },
    ],
    emptyText: 'No products yet. Add your first product to show it on the website.',
    fields: [
      { name: 'name', label: 'Product name', type: 'text', required: true, max: 120, group: 'Basics' },
      { name: 'slug', label: 'Web address', type: 'slug', required: true, max: 80, slugFrom: 'name', group: 'Basics', half: true },
      { name: 'sku', label: 'SKU', type: 'text', max: 40, group: 'Basics', half: true, help: 'Your own stock code, e.g. ONP-100' },
      { name: 'category_id', label: 'Category', type: 'ref', ref: { resource: 'categories', label: 'name' }, group: 'Basics', half: true },
      { name: 'unit', label: 'Sold per', type: 'select', options: opts('kg', 'g', 'pack', 'carton', 'tonne'), default: 'kg', group: 'Basics', half: true },
      { name: 'short_description', label: 'Short description', type: 'text', max: 200, group: 'Content', help: 'One line shown on product cards' },
      { name: 'description', label: 'Full description', type: 'textarea', max: 4000, group: 'Content' },
      { name: 'ingredients', label: 'Ingredients', type: 'textarea', max: 1000, group: 'Content' },
      { name: 'specifications', label: 'Specifications', type: 'kv', group: 'Content', help: 'e.g. Mesh size = 80–100, Moisture = under 6%' },
      { name: 'retail_price_minor', label: 'Retail price (₹ per unit)', type: 'money', group: 'Pricing and discount', half: true },
      { name: 'wholesale_price_minor', label: 'Business / export price (₹ per unit)', type: 'money', group: 'Pricing and discount', half: true },
      { name: 'tax_rate', label: 'GST rate (%)', type: 'number', min: 0, max: 100, step: 0.5, default: 0, group: 'Pricing and discount', half: true },
      { name: 'hs_code', label: 'HSN / HS code', type: 'text', max: 16, group: 'Pricing and discount', half: true, help: 'Needed for invoices and export documents' },
      { name: 'discount_type', label: 'Discount', type: 'select', options: [{ value: 'none', label: 'No discount' }, { value: 'percentage', label: 'Percentage off' }, { value: 'fixed', label: 'Fixed amount off' }], default: 'none', group: 'Pricing and discount', half: true },
      { name: 'discount_value', label: 'Discount value', type: 'moneyOrPercent', typeField: 'discount_type', default: 0, group: 'Pricing and discount', half: true },
      { name: 'discount_starts_at', label: 'Discount starts', type: 'datetime', group: 'Pricing and discount', half: true },
      { name: 'discount_ends_at', label: 'Discount ends', type: 'datetime', group: 'Pricing and discount', half: true },
      { name: 'min_order_quantity', label: 'Minimum order quantity', type: 'number', min: 0, step: 0.001, default: 1, group: 'Stock and sales', half: true },
      { name: 'reorder_level', label: 'Low-stock alert at', type: 'number', min: 0, step: 0.001, default: 0, group: 'Stock and sales', half: true, help: 'Warn when available stock falls to this quantity' },
      { name: 'shelf_life_days', label: 'Shelf life (days)', type: 'number', min: 1, integer: true, group: 'Stock and sales', half: true },
      { name: 'origin', label: 'Origin', type: 'text', max: 80, group: 'Stock and sales', half: true, placeholder: 'e.g. Gujarat, India' },
      { name: 'is_retail_available', label: 'Sell to retail customers', type: 'bool', default: true, group: 'Visibility', half: true },
      { name: 'is_export_available', label: 'Available for export / business', type: 'bool', default: true, group: 'Visibility', half: true },
      { name: 'is_active', label: 'Published on website', type: 'bool', default: false, group: 'Visibility', half: true },
      { name: 'is_featured', label: 'Featured', type: 'bool', default: false, group: 'Visibility', half: true },
    ],
    columns: [
      { key: 'name', label: 'Product' }, { key: 'sku', label: 'SKU' }, { key: 'product_categories.name', label: 'Category' },
      { key: 'retail_price_minor', label: 'Retail price', type: 'money' }, { key: 'wholesale_price_minor', label: 'Business price', type: 'money' },
      { key: 'discount_type', label: 'Discount', type: 'badge', badges: { none: 'gray', percentage: 'green', fixed: 'green' } },
      { key: 'is_active', label: 'Published', type: 'bool' },
    ],
  },

  product_media: {
    key: 'product_media', label: 'Product images', singular: 'image', table: 'product_media', orderBy: { column: 'sort_order', asc: true }, sortable: true,
    read: ALL, write: CONTENT, remove: CONTENT, search: [], filterable: ['product_id'],
    fields: [
      { name: 'product_id', label: 'Product', type: 'ref', required: true, ref: { resource: 'products', label: 'name' }, hideInForm: true },
      { name: 'storage_path', label: 'Image', type: 'image', bucket: 'product-media', required: true },
      { name: 'alt_text', label: 'Describe the image', type: 'text', max: 160 },
      { name: 'is_primary', label: 'Main image', type: 'bool', default: false },
    ],
    columns: [{ key: 'storage_path', label: 'Image', type: 'image', bucket: 'product-media' }, { key: 'alt_text', label: 'Description' }, { key: 'is_primary', label: 'Main', type: 'bool' }],
  },

  certificates: {
    key: 'certificates', label: 'Certificates and achievements', singular: 'item', table: 'certificates', orderBy: { column: 'sort_order', asc: true }, sortable: true,
    read: ALL, write: CONTENT, remove: CONTENT, search: ['title', 'issuer'], filterable: ['kind'],
    emptyText: 'Nothing here yet. Add items to show them on the website.',
    fields: [
      { name: 'kind', label: 'Type', type: 'select', required: true, options: [{ value: 'certificate', label: 'Certificate or licence' }, { value: 'achievement', label: 'Achievement' }, { value: 'award', label: 'Award' }], default: 'certificate', group: 'Details' },
      { name: 'title', label: 'Title', type: 'text', required: true, max: 160, group: 'Details' },
      { name: 'certificate_type', label: 'Category', type: 'text', required: true, max: 80, default: 'Certificate', placeholder: 'e.g. FSSAI, ISO 22000, APEDA, IEC', group: 'Details', half: true },
      { name: 'issuer', label: 'Issued by', type: 'text', max: 120, group: 'Details', half: true },
      { name: 'certificate_number', label: 'Number', type: 'text', max: 80, group: 'Details', half: true },
      { name: 'year', label: 'Year', type: 'number', integer: true, min: 1900, max: 2100, group: 'Details', half: true },
      { name: 'valid_from', label: 'Valid from', type: 'date', group: 'Validity', half: true },
      { name: 'valid_until', label: 'Valid until', type: 'date', group: 'Validity', half: true, help: 'Expired items are hidden from the website automatically' },
      { name: 'description', label: 'Short description', type: 'textarea', max: 1500, group: 'Display' },
      { name: 'image_path', label: 'Image shown on website', type: 'image', bucket: 'site-media', group: 'Display' },
      { name: 'storage_path', label: 'Original document (private, staff only)', type: 'file', bucket: 'private-documents', group: 'Display' },
      { name: 'is_public', label: 'Show on website', type: 'bool', default: false, group: 'Display' },
    ],
    columns: [
      { key: 'image_path', label: '', type: 'image', bucket: 'site-media' }, { key: 'title', label: 'Title' }, { key: 'kind', label: 'Type', type: 'badge', badges: { certificate: 'blue', achievement: 'green', award: 'amber' } },
      { key: 'issuer', label: 'Issued by' }, { key: 'valid_until', label: 'Valid until', type: 'date' }, { key: 'is_public', label: 'On website', type: 'bool' },
    ],
  },

  testimonials: {
    key: 'testimonials', label: 'Testimonials', singular: 'testimonial', table: 'testimonials', orderBy: { column: 'sort_order', asc: true }, sortable: true,
    read: ALL, write: CONTENT, remove: CONTENT, search: ['customer_name', 'company_name'],
    fields: [
      { name: 'customer_name', label: 'Customer name', type: 'text', required: true, max: 120, half: true },
      { name: 'company_name', label: 'Company', type: 'text', max: 160, half: true },
      { name: 'quote', label: 'Testimonial', type: 'textarea', required: true, max: 800 },
      { name: 'rating', label: 'Rating (1–5)', type: 'number', integer: true, min: 1, max: 5, half: true },
      { name: 'approved', label: 'Customer approved this', type: 'bool', default: false, half: true, help: 'Only publish with the customer’s permission' },
      { name: 'is_visible', label: 'Show on website', type: 'bool', default: false },
    ],
    columns: [{ key: 'customer_name', label: 'Customer' }, { key: 'company_name', label: 'Company' }, { key: 'rating', label: 'Rating', type: 'number' }, { key: 'approved', label: 'Approved', type: 'bool' }, { key: 'is_visible', label: 'On website', type: 'bool' }],
  },

  site_sections: {
    key: 'site_sections', label: 'Website sections', singular: 'section', table: 'site_sections', orderBy: { column: 'sort_order', asc: true }, sortable: true,
    read: ALL, write: CONTENT, remove: OWNER_ADMIN, search: ['title', 'section_key'],
    fields: [
      { name: 'section_key', label: 'Section', type: 'select', required: true, lockOnEdit: true, options: [
        { value: 'products', label: 'Product range' }, { value: 'capabilities', label: 'How we work' }, { value: 'quality', label: 'Quality and trust' }, { value: 'cta', label: 'Enquiry banner' }] },
      { name: 'title', label: 'Heading', type: 'text', required: true, max: 120 },
      { name: 'content', label: 'Text on this section', type: 'kv', help: 'Optional. Keys: eyebrow, intro' },
      { name: 'is_visible', label: 'Show on website', type: 'bool', default: true },
    ],
    columns: [{ key: 'title', label: 'Heading' }, { key: 'section_key', label: 'Section' }, { key: 'is_visible', label: 'Visible', type: 'bool' }],
  },

  customers: {
    key: 'customers', label: 'Customers', singular: 'customer', table: 'customers', orderBy: { column: 'created_at' },
    read: OPS_FIN, write: OPS, remove: OWNER_ADMIN, search: ['name', 'email', 'company', 'phone'], pii: true, exportable: true,
    filters: [{ column: 'customer_type', label: 'Type', options: opts('retail', 'business', 'export') }],
    emptyText: 'No customers yet. They appear when you create an order or convert an enquiry.',
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true, max: 160, group: 'Contact', half: true },
      { name: 'customer_type', label: 'Type', type: 'select', required: true, options: opts('retail', 'business', 'export'), default: 'retail', group: 'Contact', half: true },
      { name: 'email', label: 'Email', type: 'email', max: 254, group: 'Contact', half: true },
      { name: 'phone', label: 'Phone', type: 'phone', group: 'Contact', half: true },
      { name: 'company', label: 'Company', type: 'text', max: 180, group: 'Business', half: true },
      { name: 'gstin', label: 'GSTIN / tax ID', type: 'text', max: 20, group: 'Business', half: true },
      { name: 'country_code', label: 'Country code', type: 'text', max: 2, min: 2, default: 'IN', group: 'Business', half: true, help: 'Two letters, e.g. IN, AE, US' },
      { name: 'tags', label: 'Tags', type: 'text', max: 200, group: 'Business', half: true, help: 'Comma separated' },
      { name: 'notes', label: 'Notes (private)', type: 'textarea', max: 4000, group: 'Notes' },
      { name: 'is_blocked', label: 'Block new orders', type: 'bool', default: false, group: 'Notes' },
      { name: 'referral_code', label: 'Referral code', type: 'text', readOnly: true, group: 'Notes' },
    ],
    columns: [
      { key: 'name', label: 'Customer' }, { key: 'company', label: 'Company' }, { key: 'customer_type', label: 'Type', type: 'badge', badges: { retail: 'gray', business: 'blue', export: 'green' } },
      { key: 'email', label: 'Email' }, { key: 'phone', label: 'Phone' }, { key: 'created_at', label: 'Added', type: 'date' },
    ],
  },

  enquiries: {
    key: 'enquiries', label: 'Enquiries', singular: 'enquiry', table: 'enquiries', orderBy: { column: 'created_at' },
    read: OPS, write: OPS, remove: OWNER_ADMIN, creatable: false, search: ['name', 'email', 'company'], pii: true, exportable: true,
    filters: [
      { column: 'status', label: 'Status', options: opts('new', 'in_progress', 'quoted', 'won', 'lost', 'closed') },
      { column: 'enquiry_type', label: 'Type', options: ['Product enquiry', 'Bulk / wholesale', 'Export quotation', 'Sample request', 'Other'].map((v) => ({ value: v, label: v })) },
    ],
    emptyText: 'No enquiries yet. They arrive from the enquiry form on your website.',
    fields: [
      { name: 'name', label: 'Name', type: 'text', readOnly: true, half: true }, { name: 'email', label: 'Email', type: 'text', readOnly: true, half: true },
      { name: 'company', label: 'Company', type: 'text', readOnly: true, half: true }, { name: 'enquiry_type', label: 'Type', type: 'text', readOnly: true, half: true },
      { name: 'quantity_text', label: 'Quantity', type: 'text', readOnly: true, half: true }, { name: 'destination_country', label: 'Destination', type: 'text', readOnly: true, half: true },
      { name: 'details', label: 'Message', type: 'textarea', readOnly: true },
      { name: 'status', label: 'Status', type: 'select', required: true, options: opts('new', 'in_progress', 'quoted', 'won', 'lost', 'closed') },
      { name: 'internal_notes', label: 'Internal notes', type: 'textarea', max: 4000 },
    ],
    columns: [
      { key: 'name', label: 'Contact' }, { key: 'company', label: 'Company' }, { key: 'enquiry_type', label: 'Type' },
      { key: 'status', label: 'Status', type: 'badge', badges: { new: 'amber', in_progress: 'blue', quoted: 'blue', won: 'green', lost: 'red', closed: 'gray' } },
      { key: 'created_at', label: 'Received', type: 'datetime' },
    ],
  },

  orders: {
    key: 'orders', label: 'Orders', singular: 'order', table: 'orders', select: '*, customers(name, email, company)', orderBy: { column: 'placed_at' },
    read: OPS_FIN, write: [], remove: [], creatable: false, search: ['order_number'], pii: true, exportable: true,
    filters: [
      { column: 'status', label: 'Status', options: opts('draft', 'pending_payment', 'confirmed', 'processing', 'packed', 'shipped', 'delivered', 'cancelled', 'refunded') },
      { column: 'order_type', label: 'Type', options: opts('retail', 'business', 'export') },
      { column: 'payment_status', label: 'Payment', options: opts('unpaid', 'partial', 'paid', 'refunded') },
    ],
    filterable: ['customer_id'], emptyText: 'No orders yet. Create the first order to start tracking.',
    fields: [],
    columns: [
      { key: 'order_number', label: 'Order' }, { key: 'customers.name', label: 'Customer' }, { key: 'order_type', label: 'Type', type: 'badge', badges: { retail: 'gray', business: 'blue', export: 'green' } },
      { key: 'status', label: 'Status', type: 'badge', badges: ORDER_STATUS_BADGES },
      { key: 'payment_status', label: 'Payment', type: 'badge', badges: { unpaid: 'red', partial: 'amber', paid: 'green', refunded: 'gray' } },
      { key: 'total_minor', label: 'Total', type: 'money' }, { key: 'placed_at', label: 'Placed', type: 'date' },
    ],
  },

  suppliers: {
    key: 'suppliers', label: 'Suppliers', singular: 'supplier', table: 'suppliers', orderBy: { column: 'name', asc: true },
    read: OPS_FIN, write: OPS, remove: OWNER_ADMIN, search: ['name', 'contact_name', 'email'],
    emptyText: 'No suppliers yet. Add the farms and mills you buy from.',
    fields: [
      { name: 'name', label: 'Supplier name', type: 'text', required: true, max: 180, half: true }, { name: 'contact_name', label: 'Contact person', type: 'text', max: 120, half: true },
      { name: 'email', label: 'Email', type: 'email', half: true }, { name: 'phone', label: 'Phone', type: 'phone', half: true },
      { name: 'gstin', label: 'GSTIN', type: 'text', max: 20, half: true }, { name: 'country_code', label: 'Country code', type: 'text', max: 2, min: 2, default: 'IN', half: true },
      { name: 'address', label: 'Address', type: 'textarea', max: 600 }, { name: 'notes', label: 'Notes', type: 'textarea', max: 2000 },
      { name: 'is_active', label: 'Active', type: 'bool', default: true },
    ],
    columns: [{ key: 'name', label: 'Supplier' }, { key: 'contact_name', label: 'Contact' }, { key: 'phone', label: 'Phone' }, { key: 'is_active', label: 'Active', type: 'bool' }],
  },

  inventory_locations: {
    key: 'inventory_locations', label: 'Storage locations', singular: 'location', table: 'inventory_locations', orderBy: { column: 'name', asc: true },
    read: OPS_FIN, write: OPS, remove: OWNER_ADMIN, search: ['name'],
    emptyText: 'Add at least one location, e.g. Main warehouse, before receiving stock.',
    fields: [
      { name: 'name', label: 'Location name', type: 'text', required: true, max: 80 },
      { name: 'location_code', label: 'Code', type: 'text', max: 20, half: true }, { name: 'is_active', label: 'Active', type: 'bool', default: true, half: true },
    ],
    columns: [{ key: 'name', label: 'Location' }, { key: 'location_code', label: 'Code' }, { key: 'is_active', label: 'Active', type: 'bool' }],
  },

  inventory_summary: {
    key: 'inventory_summary', label: 'Stock levels', singular: 'product', table: 'inventory_summary', orderBy: { column: 'name', asc: true }, noTieBreak: true,
    read: OPS_FIN, write: [], remove: [], creatable: false, search: ['name', 'sku'], filterable: ['is_active'], exportable: true,
    filters: [{ column: 'is_low', label: 'Stock', options: [{ value: 'true', label: 'Low stock only' }] }],
    emptyText: 'Add products first, then receive a purchase or add opening stock.', fields: [],
    columns: [
      { key: 'name', label: 'Product' }, { key: 'sku', label: 'SKU' }, { key: 'on_hand', label: 'On hand', type: 'number' }, { key: 'unit', label: 'Unit' },
      { key: 'reorder_level', label: 'Reorder at', type: 'number' }, { key: 'is_low', label: 'Low', type: 'bool' }, { key: 'nearest_expiry', label: 'Next expiry', type: 'date' }, { key: 'stock_value_minor', label: 'Stock value', type: 'money' },
    ],
  },

  inventory_batches: {
    key: 'inventory_batches', label: 'Batches', singular: 'batch', table: 'inventory_batches', select: '*, products(name, sku), inventory_locations(name)',
    orderBy: { column: 'created_at' }, read: OPS_FIN, write: [], remove: [], creatable: false, search: ['batch_number'], filterable: ['product_id'],
    emptyText: 'No stock yet. Receive a purchase or add opening stock.', fields: [],
    columns: [
      { key: 'products.name', label: 'Product' }, { key: 'batch_number', label: 'Batch' }, { key: 'quantity_on_hand', label: 'On hand', type: 'number' },
      { key: 'unit_cost_minor', label: 'Cost / unit', type: 'money' }, { key: 'expires_on', label: 'Expires', type: 'date' }, { key: 'inventory_locations.name', label: 'Location' },
    ],
  },

  stock_movements: {
    key: 'stock_movements', label: 'Stock movements', singular: 'movement', table: 'stock_movements', select: '*, products(name, sku), inventory_batches(batch_number)',
    orderBy: { column: 'created_at' }, read: OPS_FIN, write: [], remove: [], creatable: false, search: ['reference'], filterable: ['product_id', 'order_id'],
    filters: [{ column: 'movement_type', label: 'Type', options: opts('receipt', 'sale', 'return', 'adjustment', 'waste') }],
    emptyText: 'Stock movements appear when you receive, sell or adjust stock.', fields: [],
    columns: [
      { key: 'created_at', label: 'When', type: 'datetime' }, { key: 'products.name', label: 'Product' }, { key: 'inventory_batches.batch_number', label: 'Batch' },
      { key: 'movement_type', label: 'Type', type: 'badge', badges: { receipt: 'green', sale: 'blue', return: 'amber', adjustment: 'gray', waste: 'red' } },
      { key: 'quantity_delta', label: 'Quantity', type: 'number' }, { key: 'reference', label: 'Reference' }, { key: 'notes', label: 'Note' },
    ],
  },

  purchase_orders: {
    key: 'purchase_orders', label: 'Purchase orders', singular: 'purchase', table: 'purchase_orders', select: '*, suppliers(name)', orderBy: { column: 'created_at' },
    read: OPS_FIN, write: [], remove: [], creatable: false, search: ['po_number', 'invoice_number', 'source_file_name'],
    filters: [{ column: 'status', label: 'Status', options: opts('ordered', 'received', 'cancelled') }],
    emptyText: 'No purchases yet. Record what you buy from suppliers to update stock.', fields: [],
    columns: [
      { key: 'po_number', label: 'PO' }, { key: 'suppliers.name', label: 'Supplier' }, { key: 'source_file_name', label: 'Imported file' }, { key: 'status', label: 'Status', type: 'badge', badges: { ordered: 'amber', received: 'green', cancelled: 'red', draft: 'gray' } },
      { key: 'supplier_invoice_date', label: 'Invoice date', type: 'date' }, { key: 'total_minor', label: 'Total', type: 'money' }, { key: 'payment_status', label: 'Payment', type: 'badge', badges: { unpaid: 'red', partial: 'amber', paid: 'green' } }, { key: 'order_date', label: 'Ordered', type: 'date' },
    ],
  },

  promotions: {
    key: 'promotions', label: 'Coupons', singular: 'coupon', table: 'promotions', orderBy: { column: 'created_at' },
    read: ALL, write: CONTENT, remove: OWNER_ADMIN, search: ['code', 'description'], fixed: { promotion_type: 'coupon' }, defaults: { promotion_type: 'coupon' },
    emptyText: 'No coupons yet. Create a code to offer a discount to a customer group.',
    fields: [
      { name: 'code', label: 'Coupon code', type: 'text', required: true, max: 30, lockOnEdit: true, group: 'Offer', half: true, placeholder: 'e.g. EXPORT10', help: 'Letters and numbers. Not case sensitive.' },
      { name: 'applies_to', label: 'Who can use it', type: 'select', required: true, group: 'Offer', half: true, default: 'all',
        options: [{ value: 'all', label: 'Everyone' }, { value: 'retail', label: 'Retail customers' }, { value: 'business', label: 'Business buyers' }, { value: 'export', label: 'Export customers' }] },
      { name: 'discount_type', label: 'Discount type', type: 'select', required: true, group: 'Offer', half: true, default: 'percentage', options: [{ value: 'percentage', label: 'Percentage off' }, { value: 'fixed', label: 'Fixed amount off' }] },
      { name: 'discount_value', label: 'Discount', type: 'moneyOrPercent', typeField: 'discount_type', required: true, group: 'Offer', half: true },
      { name: 'description', label: 'Note for your team', type: 'text', max: 500, group: 'Offer' },
      { name: 'minimum_order_minor', label: 'Minimum order (₹)', type: 'money', default: 0, group: 'Limits', half: true },
      { name: 'max_discount_minor', label: 'Maximum discount (₹)', type: 'money', group: 'Limits', half: true, help: 'Caps a percentage discount' },
      { name: 'total_uses_limit', label: 'Total uses allowed', type: 'number', integer: true, min: 1, group: 'Limits', half: true },
      { name: 'per_user_limit', label: 'Uses per customer', type: 'number', integer: true, min: 1, default: 1, group: 'Limits', half: true },
      { name: 'starts_at', label: 'Starts', type: 'datetime', group: 'Limits', half: true }, { name: 'expires_at', label: 'Expires', type: 'datetime', group: 'Limits', half: true },
      { name: 'first_order_only', label: 'First order only', type: 'bool', default: false, group: 'Limits' },
      { name: 'product_ids', label: 'Only for these products', type: 'multiref', ref: { resource: 'products', label: 'name' }, group: 'Scope', help: 'Leave empty for all products' },
      { name: 'category_ids', label: 'Only for these categories', type: 'multiref', ref: { resource: 'categories', label: 'name' }, group: 'Scope' },
      { name: 'is_active', label: 'Active', type: 'bool', default: true, group: 'Scope' },
    ],
    columns: [
      { key: 'code', label: 'Code' }, { key: 'applies_to', label: 'For', type: 'badge', badges: { all: 'gray', retail: 'gray', business: 'blue', export: 'green' } },
      { key: 'discount_type', label: 'Type' }, { key: 'uses_count', label: 'Used', type: 'number' }, { key: 'expires_at', label: 'Expires', type: 'date' }, { key: 'is_active', label: 'Active', type: 'bool' },
    ],
  },

  promotion_redemptions: {
    key: 'promotion_redemptions', label: 'Coupon usage', singular: 'redemption', table: 'promotion_redemptions',
    select: '*, promotions(code), customers(name), orders(order_number)', orderBy: { column: 'created_at' }, read: ALL, write: [], remove: [], creatable: false, search: [],
    emptyText: 'Nobody has used a coupon yet.', fields: [],
    columns: [{ key: 'created_at', label: 'Used', type: 'datetime' }, { key: 'promotions.code', label: 'Code' }, { key: 'customers.name', label: 'Customer' }, { key: 'orders.order_number', label: 'Order' }, { key: 'discount_minor', label: 'Discount', type: 'money' }],
  },

  referrals: {
    key: 'referrals', label: 'Referrals', singular: 'referral', table: 'referrals',
    select: '*, referrer:customers!referrals_referrer_customer_id_fkey(name, referral_code), referred:customers!referrals_referred_customer_id_fkey(name)',
    orderBy: { column: 'created_at' }, read: ALL, write: [], remove: [], creatable: false, search: ['referral_code'],
    filters: [{ column: 'status', label: 'Status', options: opts('pending', 'qualified', 'rewarded', 'rejected') }],
    emptyText: 'No referrals yet. Customers appear here when a new customer uses a referral code.', fields: [],
    columns: [
      { key: 'created_at', label: 'Date', type: 'date' }, { key: 'referrer.name', label: 'Referred by' }, { key: 'referral_code', label: 'Code' }, { key: 'referred.name', label: 'New customer' },
      { key: 'reward_minor', label: 'Reward', type: 'money' }, { key: 'status', label: 'Status', type: 'badge', badges: { pending: 'amber', qualified: 'blue', rewarded: 'green', rejected: 'red' } },
    ],
  },

  journal_entries: {
    key: 'journal_entries', label: 'Journal entries', singular: 'entry', table: 'journal_entries', orderBy: { column: 'entry_number' },
    read: FIN, write: [], remove: [], creatable: false, search: ['description'], exportable: true,
    filters: [{ column: 'status', label: 'Status', options: opts('posted', 'reversed') }, { column: 'source_type', label: 'Source', options: opts('manual', 'order_invoice', 'order_cogs', 'order_payment', 'order_advance', 'order_refund', 'purchase', 'purchase_payment', 'stock_opening', 'stock_adjustment', 'referral_reward', 'reversal') }],
    emptyText: 'No entries yet. Entries are created automatically when orders ship, payments arrive and stock is received.', fields: [],
    columns: [{ key: 'entry_number', label: '#', type: 'number' }, { key: 'entry_date', label: 'Date', type: 'date' }, { key: 'description', label: 'Description' }, { key: 'source_type', label: 'Source' }, { key: 'status', label: 'Status', type: 'badge', badges: { posted: 'green', reversed: 'gray', draft: 'amber' } }],
  },

  journal_lines: {
    key: 'journal_lines', label: 'Journal lines', singular: 'line', table: 'journal_lines', select: '*, chart_of_accounts(code, name)', orderBy: { column: 'created_at', asc: true },
    read: FIN, write: [], remove: [], creatable: false, search: [], filterable: ['journal_entry_id'], fields: [],
    columns: [{ key: 'chart_of_accounts.code', label: 'Account' }, { key: 'chart_of_accounts.name', label: 'Name' }, { key: 'debit_minor', label: 'Debit', type: 'money' }, { key: 'credit_minor', label: 'Credit', type: 'money' }],
  },

  chart_of_accounts: {
    key: 'chart_of_accounts', label: 'Accounts', singular: 'account', table: 'chart_of_accounts', orderBy: { column: 'code', asc: true },
    read: FIN, write: [], remove: [], creatable: false, search: ['code', 'name'], fields: [],
    columns: [{ key: 'code', label: 'Code' }, { key: 'name', label: 'Account' }, { key: 'account_type', label: 'Type' }],
  },

  audit_logs: {
    key: 'audit_logs', label: 'Audit log', singular: 'entry', table: 'audit_logs', select: '*, profiles(full_name, email)', orderBy: { column: 'created_at' },
    read: FIN, write: [], remove: [], creatable: false, search: ['action', 'entity_type'], exportable: true,
    filters: [{ column: 'entity_type', label: 'Area', options: ['order', 'purchase_order', 'inventory_batch', 'journal_entry', 'referral', 'customers', 'products', 'promotions', 'team', 'settings', 'export'].map((v) => ({ value: v, label: v.replace(/_/g, ' ') })) }],
    emptyText: 'Changes made in the control room are recorded here.', fields: [],
    columns: [{ key: 'created_at', label: 'When', type: 'datetime' }, { key: 'profiles.full_name', label: 'Who' }, { key: 'action', label: 'Action' }, { key: 'entity_type', label: 'Area' }, { key: 'entity_id', label: 'Record' }],
  },
};

export const getResource = (key: string) => (Object.prototype.hasOwnProperty.call(RESOURCES, key) ? RESOURCES[key] : undefined);
