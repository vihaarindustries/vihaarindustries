import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/site/Footer';
import AddToCart from '@/components/site/AddToCart';
import { loadProduct } from '@/lib/catalog';
import { getMode } from '@/lib/site';
import { publicMediaUrl } from '@/lib/media';
import { effectivePrice } from '@/lib/pricing';
import { fmtMoney, fmtNum } from '@/lib/format';

type Params = { slug: string };
type Ctx = { params: Promise<Params> | Params };

export async function generateMetadata({ params }: Ctx): Promise<Metadata> {
  const p = await loadProduct((await params).slug);
  return p ? { title: p.name, description: p.short_description ?? undefined } : { title: 'Product not found' };
}

/** Full product page. Everything here is entered in the control room (Products): photos, descriptions, ingredients, specifications and price. */
export default async function ProductPage({ params }: Ctx) {
  const p = await loadProduct((await params).slug);
  if (!p) notFound();
  const mode = await getMode();
  const retail = mode === 'retail';
  // a product that is not offered on the side the visitor is browsing still opens, but offers an enquiry instead of a cart
  const canBuy = retail && p.is_retail_available;
  const images = [...(p.product_media ?? [])].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order)
    .map((m) => ({ url: publicMediaUrl('product-media', m.storage_path), alt: m.alt_text || p.name })).filter((m): m is { url: string; alt: string } => !!m.url);
  const price = effectivePrice(p); const sale = p.retail_price_minor != null && price != null && price < p.retail_price_minor;
  const min = Math.max(p.min_order_quantity && Number(p.min_order_quantity) > 0 ? Number(p.min_order_quantity) : 1, 0.001);
  const specs = Object.entries(p.specifications ?? {});
  const facts = [
    p.origin && ['Origin', p.origin], p.shelf_life_days && ['Shelf life', `${p.shelf_life_days} days`], p.sku && ['SKU', p.sku],
    p.min_order_quantity && Number(p.min_order_quantity) > 0 && ['Minimum order', `${fmtNum(p.min_order_quantity)} ${p.unit}`],
  ].filter(Boolean) as string[][];
  return <><Header /><main className="container py-10 md:py-14">
    <nav className="text-xs muted mb-6" aria-label="Breadcrumb"><Link href={retail ? '/retail#products' : '/business#products'} className="hover:underline">← All products</Link></nav>
    <div className="grid md:grid-cols-2 gap-10 items-start">
      <div>
        <div className="aspect-square overflow-hidden rounded-xl border border-gray-200 bg-[#f2eee1] flex items-center justify-center">{images[0] ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={images[0].url} alt={images[0].alt} className="w-full h-full object-cover" /> : <div className="spice-dot" style={{ background: '#e8ddbf' }}>🌿</div>}</div>
        {images.length > 1 && <div className="grid grid-cols-4 gap-3 mt-3">{images.slice(1, 9).map((m) => /* eslint-disable-next-line @next/next/no-img-element */ <img key={m.url} src={m.url} alt={m.alt} loading="lazy" className="w-full aspect-square object-cover rounded-lg border border-gray-200" />)}</div>}
      </div>
      <div>
        <div className="eyebrow">{p.product_categories?.name ?? 'INGREDIENT'}</div>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight mt-2">{p.name}</h1>
        {p.short_description && <p className="muted mt-3 text-lg leading-7">{p.short_description}</p>}
        <div className="mt-6">
          {canBuy ? (price != null ? <>
            <p className="text-sm"><b className="text-3xl">{fmtMoney(price)}</b> <span className="muted">/ {p.unit}</span>{sale && <s className="muted ml-2">{fmtMoney(p.retail_price_minor)}</s>}{Number(p.tax_rate) > 0 && <span className="block text-xs muted mt-1">+ {fmtNum(p.tax_rate)}% GST</span>}</p>
            <div className="mt-5 max-w-xs"><AddToCart product={{ id: p.id, slug: p.slug, name: p.name, unit: p.unit, price_minor: price, mrp_minor: p.retail_price_minor ?? price, tax_rate: Number(p.tax_rate ?? 0), image: images[0]?.url ?? null, min }} /></div></>
            : <><p className="muted text-sm">Price on request</p><Link href={`/enquiry?product=${encodeURIComponent(p.slug)}`} className="btn mt-4">Ask about this product ↗</Link></>)
            : <div className="flex flex-wrap gap-3"><Link href={`/enquiry?product=${encodeURIComponent(p.slug)}`} className="btn">Request quote ↗</Link><Link href={`/enquiry?product=${encodeURIComponent(p.slug)}&type=sample`} className="btn btn-outline">Request a sample</Link></div>}
        </div>
        {facts.length > 0 && <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">{facts.map(([k, v]) => <div key={k} className="border-b border-gray-100 pb-2"><dt className="muted text-xs">{k}</dt><dd className="font-semibold">{v}</dd></div>)}</dl>}
      </div>
    </div>
    {(p.description || p.ingredients || specs.length > 0) && <div className="grid md:grid-cols-2 gap-10 mt-14">
      <div className="space-y-8">
        {p.description && <section><h2 className="font-black text-xl">About this product</h2><p className="muted leading-7 mt-3 whitespace-pre-line">{p.description}</p></section>}
        {p.ingredients && <section><h2 className="font-black text-xl">Ingredients</h2><p className="muted leading-7 mt-3 whitespace-pre-line">{p.ingredients}</p></section>}
      </div>
      {specs.length > 0 && <section><h2 className="font-black text-xl">Specifications</h2><dl className="mt-3 text-sm">{specs.map(([k, v]) => <div key={k} className="flex justify-between gap-4 border-b border-gray-100 py-2"><dt className="muted">{k}</dt><dd className="font-semibold text-right">{v}</dd></div>)}</dl></section>}
    </div>}
  </main><Footer /></>;
}
