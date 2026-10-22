import type { Schema } from './validate';
import type { StaffRole } from './permissions';

const OPS: StaffRole[] = ['owner', 'admin', 'operations'];
const FIN: StaffRole[] = ['owner', 'admin', 'finance'];
const OPS_FIN: StaffRole[] = ['owner', 'admin', 'operations', 'finance'];
const ALL: StaffRole[] = ['owner', 'admin', 'finance', 'operations', 'content_manager'];

const uuid: Schema = { t: 'uuid' };
const ouuid: Schema = { t: 'uuid', optional: true };
const odate: Schema = { t: 'date', optional: true };
const minor = (optional = false): Schema => ({ t: 'int', min: 0, max: 1e11, optional });
const text = (max: number, optional = true, min?: number): Schema => ({ t: 'str', max, optional, min });
export const PAYMENT_METHODS = ['UPI', 'Bank transfer', 'Cash', 'Cheque', 'Card', 'Online gateway', 'Other'];

export type RpcDef = { roles: StaffRole[]; params: Record<string, Schema>; mutating: boolean };

/** Every database function the control room may call, with the exact shape of its inputs. */
export const RPC: Record<string, RpcDef> = {
  create_order: { roles: OPS, mutating: true, params: {
    p_customer_id: uuid, p_order_type: { t: 'str', oneOf: ['retail', 'business', 'export'] },
    p_items: { t: 'arr', min: 1, max: 100, of: { t: 'shape', fields: { product_id: uuid, quantity: { t: 'num', min: 0.001, max: 1e7 }, unit_price_minor: minor(true) } } },
    p_coupon_code: text(30), p_referral_code: text(20), p_shipping_minor: minor(true),
    p_shipping_address: { t: 'obj', optional: true, maxBytes: 2000 }, p_billing_address: { t: 'obj', optional: true, maxBytes: 2000 },
    p_notes: text(2000), p_expected_delivery: odate, p_incoterm: text(12),
    p_initial_status: { t: 'str', optional: true, oneOf: ['draft', 'pending_payment', 'confirmed'] } } },
  set_order_status: { roles: OPS, mutating: true, params: {
    p_order: uuid, p_new: { t: 'str', oneOf: ['draft', 'pending_payment', 'confirmed', 'processing', 'packed', 'shipped', 'delivered', 'cancelled', 'refunded'] },
    p_note: text(500), p_visible: { t: 'bool', optional: true } } },
  record_payment: { roles: OPS_FIN, mutating: true, params: {
    p_order: uuid, p_amount_minor: { t: 'int', min: 1, max: 1e11 }, p_method: { t: 'str', oneOf: PAYMENT_METHODS }, p_reference: text(80), p_received_on: odate } },
  update_order_details: { roles: OPS, mutating: true, params: { p_order: uuid, p_patch: { t: 'obj', maxBytes: 6000 } } },
  add_order_note: { roles: OPS, mutating: true, params: { p_order: uuid, p_message: text(1000, false, 1), p_visible: { t: 'bool', optional: true } } },
  convert_enquiry_to_customer: { roles: OPS, mutating: true, params: { p_enquiry: uuid } },
  mark_referral_rewarded: { roles: FIN, mutating: true, params: { p_referral: uuid } },
  reject_referral: { roles: FIN, mutating: true, params: { p_referral: uuid } },
  create_purchase: { roles: OPS, mutating: true, params: {
    p_supplier: uuid, p_location: ouuid, p_expected: odate, p_invoice: text(60), p_shipping_minor: minor(true), p_notes: text(2000),
    p_invoice_date: odate, p_source_file_name: text(255), p_source_file_sha256: { t: 'str', optional: true, pattern: /^[a-f0-9]{64}$/ },
    p_items: { t: 'arr', min: 1, max: 100, of: { t: 'shape', fields: {
      product_id: uuid, quantity: { t: 'num', min: 0.001, max: 1e7 }, unit_cost_minor: minor(), tax_rate: { t: 'num', min: 0, max: 100, optional: true },
      batch_number: text(60), manufactured_on: odate, expires_on: odate } } } } },
  create_purchase_from_invoice: { roles: OPS, mutating: true, params: {
    p_items: { t: 'arr', min: 1, max: 100, of: { t: 'shape', fields: {
      product_id: { t: 'uuid', optional: true }, product_name: text(120),
      quantity: { t: 'num', min: 0.001, max: 1e7 }, unit_cost_minor: minor(), tax_rate: { t: 'num', min: 0, max: 100, optional: true },
      batch_number: text(60), manufactured_on: odate, expires_on: odate } } },
    p_supplier: { t: 'uuid', optional: true }, p_supplier_name: text(180), p_location: ouuid, p_expected: odate,
    p_invoice: text(60), p_shipping_minor: minor(true), p_notes: text(2000), p_invoice_date: odate,
    p_source_file_name: text(255), p_source_file_sha256: { t: 'str', optional: true, pattern: /^[a-f0-9]{64}$/ } } },
  receive_purchase: { roles: OPS, mutating: true, params: { p_po: uuid } },
  cancel_purchase: { roles: OPS, mutating: true, params: { p_po: uuid } },
  record_purchase_payment: { roles: FIN, mutating: true, params: { p_po: uuid, p_amount_minor: { t: 'int', min: 1, max: 1e11 }, p_method: { t: 'str', oneOf: PAYMENT_METHODS }, p_reference: text(80) } },
  add_opening_stock: { roles: OPS, mutating: true, params: {
    p_product: uuid, p_batch: text(60, false, 1), p_qty: { t: 'num', min: 0.001, max: 1e7 }, p_unit_cost_minor: minor(), p_mfg: odate, p_exp: odate, p_location: ouuid } },
  adjust_stock: { roles: OPS, mutating: true, params: {
    p_batch: uuid, p_delta: { t: 'num', min: -1e7, max: 1e7 }, p_type: { t: 'str', oneOf: ['adjustment', 'waste', 'return'] }, p_notes: text(300, false, 3) } },
  post_manual_journal: { roles: FIN, mutating: true, params: {
    p_date: { t: 'date' }, p_description: text(300, false, 3),
    p_lines: { t: 'arr', min: 2, max: 20, of: { t: 'shape', fields: { account: { t: 'str', pattern: /^\d{4}$/ }, debit: minor(true), credit: minor(true), memo: text(200) } } } } },
  reverse_journal: { roles: FIN, mutating: true, params: { p_id: uuid, p_reason: text(300, false, 3) } },
  account_balances: { roles: FIN, mutating: false, params: { p_from: odate, p_to: odate } },
  finance_summary: { roles: FIN, mutating: false, params: { p_from: { t: 'date' }, p_to: { t: 'date' } } },
  receivables: { roles: OPS_FIN, mutating: false, params: {} },
  payables: { roles: OPS_FIN, mutating: false, params: {} },
  traffic_summary: { roles: ALL, mutating: false, params: { p_from: { t: 'iso' }, p_to: { t: 'iso' } } },
  dashboard_metrics: { roles: ['owner', 'admin', 'finance', 'operations'], mutating: false,
    params: { p_from: { t: 'iso' }, p_to: { t: 'iso' }, p_segment: { t: 'str', optional: true, oneOf: ['all', 'retail', 'business', 'export'] } } },
};
export const hasRpc = (n: string) => Object.prototype.hasOwnProperty.call(RPC, n);
