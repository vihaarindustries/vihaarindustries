import { publicMediaUrl } from '@/lib/media';
import { fmtDate } from '@/lib/format';
import type { Cert, Testi } from '@/lib/catalog';

export default function TrustBlock({ certs, achievements, testimonials }: { certs: Cert[]; achievements: Cert[]; testimonials: Testi[] }) {
  if (!certs.length && !achievements.length && !testimonials.length) return <div className="grid sm:grid-cols-3 gap-4 mt-9 text-left">{[['Certifications', 'FSSAI, GST and other applicable documents.'], ['Quality documentation', 'Product specifications and supporting documents.'], ['Customer stories', 'Approved testimonials and business milestones.']].map((x) => <div className="border border-gray-200 rounded-lg p-5" key={x[0]}><div className="w-10 h-10 rounded-full bg-[#e3f4e9] text-[#008b47] flex items-center justify-center font-black">✓</div><h3 className="font-bold mt-4">{x[0]}</h3><p className="muted text-sm mt-2">{x[1]}</p></div>)}</div>;
  const card = (c: Cert) => { const u = publicMediaUrl('site-media', c.image_path); return <div key={c.id} className="border border-gray-200 rounded-lg p-5 text-left bg-white">
    {u ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={u} alt={c.title} loading="lazy" className="w-full h-36 object-contain mb-4" /> : <div className="w-10 h-10 rounded-full bg-[#e3f4e9] text-[#008b47] flex items-center justify-center font-black mb-4">✓</div>}
    <div className="eyebrow !text-[9px]">{c.certificate_type ?? c.kind.toUpperCase()}</div><h3 className="font-bold mt-1.5">{c.title}</h3>
    {(c.issuer || c.year) && <p className="text-xs muted mt-1">{[c.issuer, c.year].filter(Boolean).join(' · ')}</p>}{c.description && <p className="muted text-sm mt-2">{c.description}</p>}
    {c.valid_until && <p className="text-[11px] muted mt-2">Valid until {fmtDate(c.valid_until)}</p>}</div>; };
  return <div className="mt-9 space-y-10 text-left">
    {certs.length > 0 && <div><h3 className="font-black text-lg mb-4 text-center">Certifications &amp; licences</h3><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{certs.map(card)}</div></div>}
    {achievements.length > 0 && <div><h3 className="font-black text-lg mb-4 text-center">Achievements &amp; awards</h3><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{achievements.map(card)}</div></div>}
    {testimonials.length > 0 && <div><h3 className="font-black text-lg mb-4 text-center">What customers say</h3><div className="grid md:grid-cols-3 gap-4">{testimonials.map((t) => <figure key={t.id} className="border border-gray-200 rounded-lg p-5 bg-white"><blockquote className="text-sm leading-6">&ldquo;{t.quote}&rdquo;</blockquote><figcaption className="text-xs muted mt-3"><b className="text-gray-800">{t.customer_name}</b>{t.company_name ? `, ${t.company_name}` : ''}</figcaption></figure>)}</div></div>}
  </div>;
}
