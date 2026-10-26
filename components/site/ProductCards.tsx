import Link from 'next/link';
import { publicMediaUrl } from '@/lib/media';
import { effectivePrice } from '@/lib/pricing';
import { fmtMoney, fmtNum } from '@/lib/format';
import Approx from '@/components/fx/Approx';
import type { DbProduct } from '@/lib/catalog';
import AddToCart from './AddToCart';

const mainImage = (p: DbProduct) => {
  const img = [...(p.product_media ?? [])].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order)[0];
  return { url: publicMediaUrl('product-media', img?.storage_path), alt: img?.alt_text || p.name };
};
function Art({ p, badge }: { p: DbProduct; badge?: string }) {
  const { url, alt } = mainImage(p);
  return <div className="product-art overflow-hidden">{url ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={url} alt={alt} loading="lazy" className="w-full h-full object-cover" /> : <div className="spice-dot" style={{ background: '#e8ddbf' }}>🌿</div>}
    {badge && <span className="absolute top-4 left-4 text-[10px] font-bold tracking-wider bg-[#00994d] text-white rounded-full px-3 py-1.5">{badge}</span>}</div>;
}

/** Retail: price, offer badge and Add to cart. Only products marked "Sell to retail customers" in the control room. */
export function RetailGrid({ items }: { items: DbProduct[] }) {
  return <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">{items.map((p) => {
    const price = effectivePrice(p); const sale = p.retail_price_minor != null && price != null && price < p.retail_price_minor;
    const { url } = mainImage(p); const min = Math.max(p.min_order_quantity && p.min_order_quantity > 0 ? Number(p.min_order_quantity) : 1, 0.001);
    return <article className="product-card flex flex-col" key={p.id}><Link href={`/products/${p.slug}`} aria-label={`View ${p.name}`}><Art p={p} badge={sale ? 'OFFER' : p.is_featured ? 'FEATURED' : undefined} /></Link>
      <div className="p-5 flex flex-col flex-1"><div className="eyebrow !text-[9px]">{p.product_categories?.name ?? 'INGREDIENT'}</div><h3 className="text-xl font-black mt-2"><Link href={`/products/${p.slug}`} className="hover:underline">{p.name}</Link></h3>
        {p.short_description && <p className="muted text-sm mt-2">{p.short_description}</p>}
        <div className="mt-auto pt-4">
          {price != null ? <p className="mb-4 text-sm"><b className="text-xl">{fmtMoney(price)}</b> <span className="muted">/ {p.unit}</span>{sale && <s className="muted ml-2">{fmtMoney(p.retail_price_minor)}</s>}{Number(p.tax_rate) > 0 && <span className="block text-[11px] muted mt-0.5">+ {fmtNum(p.tax_rate)}% GST</span>}<Approx minor={price} className="block text-xs muted mt-0.5" /></p> : <p className="mb-4 text-sm muted">Price on request</p>}
          {price != null ? <AddToCart product={{ id: p.id, slug: p.slug, name: p.name, unit: p.unit, price_minor: price, mrp_minor: p.retail_price_minor ?? price, tax_rate: Number(p.tax_rate ?? 0), image: url, min }} /> : <Link href="/enquiry" className="btn w-full">Ask about this product</Link>}
        </div></div></article>;
  })}</div>;
}

/** Business: no cart and no retail price. Specifications, minimum order and a quotation / sample request. */
export function BusinessGrid({ items }: { items: DbProduct[] }) {
  return <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">{items.map((p) => {
    const specs = Object.entries(p.specifications ?? {}).slice(0, 4);
    return <article className="product-card flex flex-col" key={p.id}><Link href={`/products/${p.slug}`} aria-label={`View ${p.name}`}><Art p={p} /></Link>
      <div className="p-5 flex flex-col flex-1"><div className="eyebrow !text-[9px]">{p.product_categories?.name ?? 'INGREDIENT'}</div><h3 className="text-xl font-black mt-2"><Link href={`/products/${p.slug}`} className="hover:underline">{p.name}</Link></h3>
        {p.short_description && <p className="muted text-sm mt-2">{p.short_description}</p>}
        {specs.length > 0 && <dl className="mt-3 space-y-1 text-xs">{specs.map(([k, v]) => <div key={k} className="flex justify-between gap-3 border-b border-gray-100 pb-1"><dt className="muted">{k}</dt><dd className="font-semibold text-right">{v}</dd></div>)}</dl>}
        <p className="text-xs muted mt-3">{[p.min_order_quantity && Number(p.min_order_quantity) > 0 ? `MOQ ${fmtNum(p.min_order_quantity)} ${p.unit}` : '', p.origin ? `Origin: ${p.origin}` : ''].filter(Boolean).join('  ·  ') || 'Pricing on request'}</p>
        <div className="flex gap-2 mt-auto pt-5"><Link href={`/enquiry?product=${encodeURIComponent(p.slug)}`} className="btn flex-1">Request quote ↗</Link><Link href={`/enquiry?product=${encodeURIComponent(p.slug)}&type=sample`} className="btn btn-outline">Sample</Link></div>
      </div></article>;
  })}</div>;
}
