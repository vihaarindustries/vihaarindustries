'use client';
import { useState } from 'react';
import { PageHeader, Tabs, Alert } from '../ui';
import ResourceManager from '../ResourceManager';

export default function ProductsView() {
  const [tab, setTab] = useState('products');
  return <div>
    <PageHeader title="Products" subtitle="Everything shown on the website catalogue: names, photos, descriptions, prices and discounts." />
    <Tabs value={tab} onChange={setTab} tabs={[{ key: 'products', label: 'Products' }, { key: 'categories', label: 'Categories' }]} />
    {tab === 'products' && <>
      <div className="mb-4"><Alert tone="info">Open a product to edit it. Use the <b>Images</b> tab inside a product to upload photos, choose the main photo and set their order. Stock is managed under <b>Inventory</b>, not here.</Alert></div>
      <ResourceManager resource="products" extraTab={{ label: 'Images', render: (row) => <ProductImages productId={row.id} /> }} />
    </>}
    {tab === 'categories' && <ResourceManager resource="categories" />}
  </div>;
}

function ProductImages({ productId }: { productId: string }) {
  return <div><p className="text-sm muted mb-4">JPG, PNG or WebP, up to 5 MB. The first image (or the one marked Main) is shown in the catalogue.</p>
    <ResourceManager resource="product_media" fixedFilter={{ product_id: productId }} createDefaults={{ product_id: productId }} addLabel="Add image" pageSize={100} /></div>;
}
