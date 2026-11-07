'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Scene from './Scene';

/**
 * One 3D scene behind every public page. It is mounted once in the root layout, so it keeps running while visitors
 * move between pages. The control room (staff area) never gets it.
 */
export default function GlobalScene() {
  const path = usePathname() || '/';
  const admin = path.startsWith('/control-room');
  useEffect(() => { document.documentElement.classList.toggle('s3d', !admin); }, [admin]);
  if (admin) return null;
  const variant = path === '/' ? 'home' : path.startsWith('/business') ? 'business' : path.startsWith('/retail') ? 'retail' : 'page';
  return <Scene variant={variant} mode="fixed" />;
}
