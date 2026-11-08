'use client';
import { useEffect } from 'react';

const SEL = '.product-card, .choice-card, [data-tilt]';
/** Glass cards lean toward the mouse with a moving light reflection. Mouse only (touch scrolling is left alone), off with "reduce motion" or the footer switch. */
export default function TiltCards() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !window.matchMedia('(hover: hover)').matches) return;
    let active: HTMLElement | null = null; let raf = 0; let px = 0, py = 0;
    const off = () => { try { return localStorage.getItem('vi-fx') === 'off'; } catch { return false; } };
    const reset = (el: HTMLElement | null) => { if (!el) return; el.classList.remove('is-tilting'); el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); };
    const paint = () => {
      raf = 0; if (!active) return; const r = active.getBoundingClientRect();
      const x = clamp01((px - r.left) / r.width), y = clamp01((py - r.top) / r.height); const max = 7;
      active.style.setProperty('--ry', `${((x - 0.5) * 2 * max).toFixed(2)}deg`); active.style.setProperty('--rx', `${((0.5 - y) * 2 * max).toFixed(2)}deg`);
      active.style.setProperty('--gx', `${(x * 100).toFixed(1)}%`); active.style.setProperty('--gy', `${(y * 100).toFixed(1)}%`);
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || off()) return;
      const el = (e.target as Element | null)?.closest<HTMLElement>(SEL) ?? null;
      if (el !== active) { reset(active); active = el; el?.classList.add('is-tilting'); }
      if (el) { px = e.clientX; py = e.clientY; if (!raf) raf = requestAnimationFrame(paint); }
    };
    const leave = () => { reset(active); active = null; };
    document.addEventListener('pointermove', move, { passive: true }); document.documentElement.addEventListener('mouseleave', leave);
    return () => { document.removeEventListener('pointermove', move); document.documentElement.removeEventListener('mouseleave', leave); if (raf) cancelAnimationFrame(raf); };
  }, []);
  return null;
}
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
