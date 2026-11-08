'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';

const ProductViewer = dynamic(() => import('@/components/fx/ProductViewer'), { ssr: false });
type Img = { url: string; alt: string };

/** Product page picture area: a drag-to-spin 3D jar and the product photos, switchable. Photos only if 3D is unavailable. */
export default function ProductGallery({ images, name, category }: { images: Img[]; name: string; category?: string }) {
  const [tab, setTab] = useState<'3d' | 'photos'>('3d'); const [failed, setFailed] = useState(false);
  const show3d = !failed && tab === '3d';
  return <div>
    <div className="relative aspect-square overflow-hidden rounded-xl border border-gray-200 bg-[#f2eee1] flex items-center justify-center" style={show3d ? { background: 'radial-gradient(circle at 50% 40%, #1b3326, #0b140f 70%)' } : undefined}>
      {show3d ? <>
        <ProductViewer name={name} category={category} onFail={() => setFailed(true)} />
        <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-[11px] font-bold tracking-wider text-gray-300 bg-black/40 rounded-full px-3 py-1.5">DRAG TO ROTATE</span>
      </> : images[0]
        ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={images[0].url} alt={images[0].alt} className="w-full h-full object-cover" />
        : <div className="spice-dot" style={{ background: '#e8ddbf' }}>🌿</div>}
    </div>
    {!failed && images.length > 0 && <div className="flex gap-2 mt-3" role="tablist" aria-label="Product view">
      <button role="tab" aria-selected={tab === '3d'} onClick={() => setTab('3d')} className={`text-xs font-bold rounded-full px-4 py-2 border ${tab === '3d' ? 'bg-[#00994d] border-[#00994d] text-white' : 'border-gray-300'}`}>3D view</button>
      <button role="tab" aria-selected={tab === 'photos'} onClick={() => setTab('photos')} className={`text-xs font-bold rounded-full px-4 py-2 border ${tab === 'photos' ? 'bg-[#00994d] border-[#00994d] text-white' : 'border-gray-300'}`}>Photos ({images.length})</button>
    </div>}
    {(tab === 'photos' || failed) && images.length > 1 && <div className="grid grid-cols-4 gap-3 mt-3">{images.slice(1, 9).map((m) => /* eslint-disable-next-line @next/next/no-img-element */ <img key={m.url} src={m.url} alt={m.alt} loading="lazy" className="w-full aspect-square object-cover rounded-lg border border-gray-200" />)}</div>}
  </div>;
}
