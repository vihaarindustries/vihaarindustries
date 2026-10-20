'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/** Sends one anonymous page view per navigation. Uses a random id in localStorage; skips admin pages. */
export default function TrackVisit() {
  const path = usePathname();
  useEffect(() => {
    if (!path || path.startsWith('/control-room') || path.startsWith('/auth')) return;
    let id = '';
    try {
      id = localStorage.getItem('vi_vid') || '';
      if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) { id = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join(''); localStorage.setItem('vi_vid', id); }
    } catch { return; }
    const u = new URLSearchParams(window.location.search).get('utm_source') || '';
    const body = JSON.stringify({ v: id, p: path, r: document.referrer, u });
    if (navigator.sendBeacon) navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }));
    else fetch('/api/track', { method: 'POST', body, keepalive: true }).catch(() => {});
  }, [path]);
  return null;
}
