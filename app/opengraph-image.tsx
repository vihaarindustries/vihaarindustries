import { ImageResponse } from 'next/og';

// The picture shown when a link to the site is shared on WhatsApp, LinkedIn, Facebook, etc.
export const alt = 'Vihaar Industries — dehydrated spices and ingredients';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 80, background: 'linear-gradient(135deg,#0b1a12,#0f3d25)', color: '#f4ecd6' }}>
      <div style={{ fontSize: 28, letterSpacing: 8, color: '#4fe09a', fontWeight: 700 }}>FROM GUJARAT, INDIA</div>
      <div style={{ fontSize: 108, fontWeight: 900, marginTop: 24, lineHeight: 1.05 }}>Vihaar Industries</div>
      <div style={{ fontSize: 40, marginTop: 28, color: '#cfe0d4' }}>Onion powder, garlic powder &amp; dehydrated spice ingredients</div>
      <div style={{ display: 'flex', marginTop: 48, gap: 16 }}>{['Retail', 'Bulk', 'Export'].map((t) => <div key={t} style={{ border: '2px solid #c99a36', color: '#c99a36', borderRadius: 40, padding: '10px 28px', fontSize: 28, fontWeight: 700 }}>{t}</div>)}</div>
    </div>,
    size,
  );
}
