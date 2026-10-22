const TYPES = ['Product enquiry', 'Bulk / wholesale', 'Export quotation', 'Sample request', 'Other'];

/** The business enquiry / quotation form. Posts to /api/enquiry (spam-protected). Shared by the Business page and the Enquiry page. */
export default function EnquiryForm({ type = 'Bulk / wholesale', productSlug, productName, id }: { type?: string; productSlug?: string; productName?: string; id?: string }) {
  return <form id={id} className="bg-white border border-gray-200 rounded-xl p-6 grid sm:grid-cols-2 gap-4 text-gray-900" action="/api/enquiry" method="post">
    <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}><label>Leave this empty<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
    {productSlug && <input type="hidden" name="product_slug" value={productSlug} />}
    {productName && <div className="sm:col-span-2 rounded-lg bg-[#e3f4e9] text-[#006b38] text-sm font-bold px-4 py-3">Enquiring about: {productName}</div>}
    <label className="text-sm font-semibold">Your name<input className="field block mt-2" name="name" required maxLength={120} /></label>
    <label className="text-sm font-semibold">Work email<input className="field block mt-2" name="email" type="email" required maxLength={254} /></label>
    <label className="text-sm font-semibold">Company (optional)<input className="field block mt-2" name="company" maxLength={180} /></label>
    <label className="text-sm font-semibold">Enquiry type<select className="field block mt-2" name="type" defaultValue={TYPES.includes(type) ? type : 'Other'}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
    <label className="text-sm font-semibold sm:col-span-2">Product and specification<textarea className="field block mt-2" rows={3} name="details" required maxLength={5000} placeholder="Product, grade / mesh size, packaging, delivery timeline…" /></label>
    <label className="text-sm font-semibold">Estimated quantity<input className="field block mt-2" name="quantity" maxLength={120} placeholder="e.g. 500 kg / 20 cartons" /></label>
    <label className="text-sm font-semibold">Destination country<input className="field block mt-2" name="destination" maxLength={100} /></label>
    <button className="btn sm:col-span-2" type="submit">Send enquiry ↗</button>
  </form>;
}
