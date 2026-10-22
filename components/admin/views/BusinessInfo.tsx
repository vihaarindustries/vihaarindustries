'use client';
import { useState } from 'react';
import { Plus, Trash2, Upload } from 'lucide-react';
import { Alert, Btn, Card, Input, Label, PageHeader, Spinner, Textarea, useFlash } from '../ui';
import { useSetting } from '../useSetting';
import { errMsg } from '@/lib/admin/client';
import { createBrowser } from '@/lib/supabase/browser';
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, publicMediaUrl } from '@/lib/media';
import { DEFAULT_BUSINESS, MARKETPLACES, SOCIAL_PLATFORMS, whatsappLink, type BusinessProfile } from '@/lib/business';

const https = (v: string) => { const t = v.trim(); if (!t) return ''; if (/^https:\/\//i.test(t)) return t; return `https://${t.replace(/^https?:\/\//i, '')}`; };

export default function BusinessInfoView() {
  const { value: v, setValue, loading, error, save } = useSetting<BusinessProfile>('business_profile', DEFAULT_BUSINESS);
  const [busy, setBusy] = useState(false); const [up, setUp] = useState(false); const [upErr, setUpErr] = useState(''); const { show, node } = useFlash();
  const set = <K extends keyof BusinessProfile>(k: K, val: BusinessProfile[K]) => setValue({ ...v, [k]: val });
  const setLink = (group: 'social' | 'marketplaces', key: string, val: string) => setValue({ ...v, [group]: { ...(v[group] ?? {}), [key]: val } });
  const custom = v.custom_marketplaces ?? [];

  async function pickLogo(file: File | undefined) {
    if (!file) return; setUpErr('');
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return setUpErr('Use a JPG, PNG or WebP image.');
    if (file.size > MAX_IMAGE_BYTES) return setUpErr('The image is too large (max 5 MB).');
    setUp(true);
    const ext = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as Record<string, string>)[file.type];
    const path = `logo/${crypto.randomUUID()}.${ext}`;
    const { error: e } = await createBrowser().storage.from('site-media').upload(path, file, { contentType: file.type, upsert: false, cacheControl: '31536000' });
    setUp(false);
    if (e) return setUpErr('Upload failed. Please try again.');
    set('logo_path', path);
  }
  async function submit() {
    setBusy(true);
    try {
      // tidy links before saving: add https:// where it is missing, drop empty rows
      const clean = (o?: Record<string, string>) => Object.fromEntries(Object.entries(o ?? {}).map(([k, x]) => [k, https(x)]).filter(([, x]) => x));
      await save({ ...v, social: clean(v.social), marketplaces: clean(v.marketplaces), custom_marketplaces: custom.map((m) => ({ name: m.name.trim(), url: https(m.url) })).filter((m) => m.name && m.url) });
      show('success', 'Saved. The website shows the new details within about a minute.');
    } catch (e) { show('error', errMsg(e)); } finally { setBusy(false); }
  }
  if (loading) return <Spinner />;
  const logo = publicMediaUrl('site-media', v.logo_path); const wa = whatsappLink(v);
  const grid = 'grid sm:grid-cols-2 gap-4';
  return <div className="space-y-5 max-w-4xl">
    <PageHeader title="Business information" subtitle="Your logo, name, address, contact details, social profiles and marketplaces. Everything saved here appears on the website wherever it is relevant." actions={<Btn busy={busy} onClick={submit}>Save changes</Btn>} />
    {error && <Alert tone="error">{error}</Alert>}{node}
    <Alert tone="info">All of this is shown publicly on your website. Leave a field empty and it is simply not shown.</Alert>

    <Card title="Logo">
      <div className="flex flex-wrap items-center gap-5">
        <div className="w-40 h-24 rounded-lg border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center overflow-hidden">{logo ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={logo} alt="Current logo" className="max-w-full max-h-full object-contain" /> : <span className="text-xs muted px-2 text-center">No logo yet</span>}</div>
        <div className="space-y-2">
          <label className={`inline-flex items-center gap-2 text-sm font-bold border border-gray-300 rounded-md px-3 py-2 cursor-pointer hover:bg-gray-50 ${up ? 'opacity-50 pointer-events-none' : ''}`}><Upload size={14} />{up ? 'Uploading…' : logo ? 'Replace logo' : 'Upload logo'}<input type="file" accept={ALLOWED_IMAGE_TYPES.join(',')} className="sr-only" onChange={(e) => { pickLogo(e.target.files?.[0]); e.target.value = ''; }} /></label>
          {logo && <button type="button" className="block text-xs text-red-600 underline" onClick={() => set('logo_path', '')}>Remove logo</button>}
          {upErr && <div role="alert" className="text-xs text-red-600">{upErr}</div>}
          <p className="text-xs muted max-w-sm">PNG with a transparent background works best, ideally wider than tall. JPG, PNG or WebP up to 5 MB. Click <b>Save changes</b> to publish it. It is used in the header, the first page, the browser tab and everywhere else on the website.</p>
        </div>
      </div>
      <label className="flex items-start gap-2.5 text-sm font-semibold mt-5"><input type="checkbox" className="mt-0.5 w-4 h-4 accent-[#00994d]" checked={!!v.show_name_with_logo} onChange={(e) => set('show_name_with_logo', e.target.checked)} /><span>Show the business name next to the logo<span className="block text-xs font-normal muted">Turn on if your logo is only a symbol without the name.</span></span></label>
    </Card>

    <Card title="Business details"><div className={grid}>
      <Label>Business name<Input required maxLength={120} value={v.name ?? ''} onChange={(e) => set('name', e.target.value)} /></Label>
      <Label help="Used in the footer copyright and on invoices.">Registered / legal name<Input maxLength={160} value={v.legal_name ?? ''} onChange={(e) => set('legal_name', e.target.value)} /></Label>
      <Label className="sm:col-span-2">Tagline<Input maxLength={160} value={v.tagline ?? ''} onChange={(e) => set('tagline', e.target.value)} placeholder="e.g. Dehydrated spices & ingredients" /></Label>
      <Label className="sm:col-span-2">About the business<Textarea rows={3} maxLength={1500} value={v.about ?? ''} onChange={(e) => set('about', e.target.value)} /></Label>
    </div></Card>

    <Card title="Contact details"><div className={grid}>
      <Label>Email<Input type="email" maxLength={254} value={v.email ?? ''} onChange={(e) => set('email', e.target.value)} /></Label>
      <Label help="With country code, e.g. +91 98765 43210">Phone<Input type="tel" maxLength={25} value={v.phone ?? ''} onChange={(e) => set('phone', e.target.value)} /></Label>
      <Label>Second phone (optional)<Input type="tel" maxLength={25} value={v.alt_phone ?? ''} onChange={(e) => set('alt_phone', e.target.value)} /></Label>
      <Label>Working hours<Input maxLength={160} value={v.hours ?? ''} onChange={(e) => set('hours', e.target.value)} placeholder="Mon–Sat, 9:30 am – 6:30 pm" /></Label>
    </div></Card>

    <Card title="WhatsApp chat">
      <label className="flex items-start gap-2.5 text-sm font-semibold"><input type="checkbox" className="mt-0.5 w-4 h-4 accent-[#00994d]" checked={v.whatsapp_enabled !== false} onChange={(e) => set('whatsapp_enabled', e.target.checked)} /><span>Show a WhatsApp chat button on the website<span className="block text-xs font-normal muted">A floating button plus a WhatsApp icon in the footer.</span></span></label>
      <div className={`${grid} mt-4`}>
        <Label help="Leave empty to use the main phone number above.">WhatsApp number<Input type="tel" maxLength={25} value={v.whatsapp_number ?? ''} onChange={(e) => set('whatsapp_number', e.target.value)} /></Label>
        <Label help="The message customers start with.">Pre-filled message<Input maxLength={300} value={v.whatsapp_message ?? ''} onChange={(e) => set('whatsapp_message', e.target.value)} placeholder={`Hello ${v.name || 'there'}, I would like to know more…`} /></Label>
      </div>
      <p className="text-xs muted mt-3">{wa ? <>Chat link that visitors will open: <a className="underline font-semibold" href={wa} target="_blank" rel="noopener noreferrer">test it ↗</a></> : 'Add a phone or WhatsApp number to switch the chat button on.'}</p>
    </Card>

    <Card title="Address"><div className={grid}>
      <Label className="sm:col-span-2">Address<Input maxLength={200} value={v.address_line ?? ''} onChange={(e) => set('address_line', e.target.value)} placeholder="Building, street, area" /></Label>
      <Label>City<Input maxLength={80} value={v.city ?? ''} onChange={(e) => set('city', e.target.value)} /></Label>
      <Label>State<Input maxLength={80} value={v.state ?? ''} onChange={(e) => set('state', e.target.value)} /></Label>
      <Label>PIN / postal code<Input maxLength={12} value={v.pincode ?? ''} onChange={(e) => set('pincode', e.target.value)} /></Label>
      <Label>Country<Input maxLength={60} value={v.country ?? ''} onChange={(e) => set('country', e.target.value)} /></Label>
      <Label className="sm:col-span-2" help="Optional. Open Google Maps, press Share, and paste the link.">Google Maps link<Input maxLength={400} value={v.map_url ?? ''} onChange={(e) => set('map_url', e.target.value)} onBlur={(e) => set('map_url', https(e.target.value))} placeholder="https://maps.google.com/…" /></Label>
    </div></Card>

    <Card title="Registrations (shown in the footer)"><div className="grid sm:grid-cols-3 gap-4">
      <Label>GSTIN<Input maxLength={20} value={v.gstin ?? ''} onChange={(e) => set('gstin', e.target.value.toUpperCase())} /></Label>
      <Label>FSSAI licence no.<Input maxLength={30} value={v.fssai ?? ''} onChange={(e) => set('fssai', e.target.value)} /></Label>
      <Label>IEC (import-export code)<Input maxLength={20} value={v.iec ?? ''} onChange={(e) => set('iec', e.target.value.toUpperCase())} /></Label>
    </div></Card>

    <Card title="Social media profiles"><p className="text-xs muted mb-4">Paste the link to each profile you have. Only the ones you fill in appear as icons on the website. WhatsApp comes from the number above.</p>
      <div className={grid}>{SOCIAL_PLATFORMS.map((p) => <Label key={p.key}>{p.label}<Input maxLength={400} value={v.social?.[p.key] ?? ''} onChange={(e) => setLink('social', p.key, e.target.value)} onBlur={(e) => setLink('social', p.key, https(e.target.value))} placeholder={p.placeholder} /></Label>)}</div></Card>

    <Card title="Also available on (marketplaces)"><p className="text-xs muted mb-4">Add your store link on each marketplace where you sell. Only the ones you fill in appear in the website footer under “Also available on”.</p>
      <div className={grid}>{MARKETPLACES.map((p) => <Label key={p.key}>{p.label}<Input maxLength={400} value={v.marketplaces?.[p.key] ?? ''} onChange={(e) => setLink('marketplaces', p.key, e.target.value)} onBlur={(e) => setLink('marketplaces', p.key, https(e.target.value))} placeholder={p.placeholder} /></Label>)}</div>
      <div className="mt-6 border-t border-gray-100 pt-5"><h3 className="text-sm font-bold">Other marketplaces</h3>
        <ul className="space-y-3 mt-3">{custom.map((m, i) => <li key={i} className="grid sm:grid-cols-[1fr_2fr_auto] gap-3 items-center">
          <Input aria-label="Marketplace name" className="!mt-0" maxLength={60} placeholder="Name, e.g. Etsy" value={m.name} onChange={(e) => set('custom_marketplaces', custom.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
          <Input aria-label="Marketplace link" className="!mt-0" maxLength={400} placeholder="https://…" value={m.url} onChange={(e) => set('custom_marketplaces', custom.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} onBlur={(e) => set('custom_marketplaces', custom.map((x, j) => (j === i ? { ...x, url: https(e.target.value) } : x)))} />
          <button type="button" aria-label="Remove" onClick={() => set('custom_marketplaces', custom.filter((_, j) => j !== i))} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 size={16} /></button></li>)}</ul>
        {custom.length < 10 && <Btn variant="outline" size="sm" className="mt-3" onClick={() => set('custom_marketplaces', [...custom, { name: '', url: '' }])}><Plus size={14} />Add marketplace</Btn>}</div></Card>

    <div className="flex justify-end pb-8"><Btn busy={busy} onClick={submit}>Save changes</Btn></div>
  </div>;
}
