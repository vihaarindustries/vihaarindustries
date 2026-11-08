'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Scene from './Scene';

/**
 * One 3D scene behind every public page, mounted once in the root layout (the control room never gets it).
 * Safety net: it only starts after the page has finished loading and the browser is idle, so it never delays the first
 * paint; visitors can switch it off (footer button, remembered); and the scene turns itself down, then off, on devices
 * that cannot keep up (see Scene3D).
 */
export default function GlobalScene() {
  const path = usePathname() || '/';
  const admin = path.startsWith('/control-room');
  const [pref, setPref] = useState<'on' | 'off' | null>(null);
  const [go, setGo] = useState(false);
  const [slow, setSlow] = useState(false);

  useEffect(() => { document.documentElement.classList.toggle('s3d', !admin); }, [admin]);
  useEffect(() => { window.dispatchEvent(new Event('vi-fx-nav')); }, [path]); // tells the scene to swoop the camera on every page change

  useEffect(() => {
    const read = () => { try { setPref(localStorage.getItem('vi-fx') === 'off' ? 'off' : 'on'); setSlow(sessionStorage.getItem('vi-fx-tier') === '3'); } catch { setPref('on'); } };
    read();
    const onSlow = () => setSlow(true);
    window.addEventListener('vi-fx-change', read); window.addEventListener('storage', read); window.addEventListener('vi-fx-auto-off', onSlow);
    const start = () => { const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }; if (w.requestIdleCallback) w.requestIdleCallback(() => setGo(true), { timeout: 2500 }); else setTimeout(() => setGo(true), 800); };
    if (document.readyState === 'complete') start(); else window.addEventListener('load', start, { once: true });
    return () => { window.removeEventListener('vi-fx-change', read); window.removeEventListener('storage', read); window.removeEventListener('vi-fx-auto-off', onSlow); window.removeEventListener('load', start); };
  }, []);

  if (admin || !go || pref !== 'on' || slow) return null;
  const variant = path === '/' ? 'home' : path.startsWith('/business') ? 'business' : path.startsWith('/retail') ? 'retail' : 'page';
  return <Scene variant={variant} mode="fixed" />;
}
