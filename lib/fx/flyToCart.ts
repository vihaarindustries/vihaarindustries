/** Small jar (or the product photo) flies from the button to the cart icon in the header, then the cart icon pops. */
export function flyToCart(from: HTMLElement, image?: string | null) {
  if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const target = document.querySelector<HTMLElement>('[data-cart-target]'); if (!target) return;
  const a = from.getBoundingClientRect(), b = target.getBoundingClientRect(); if (!a.width || !b.width) return;
  const size = 46; const sx = a.left + a.width / 2 - size / 2, sy = a.top + a.height / 2 - size / 2; const ex = b.left + b.width / 2 - size / 2, ey = b.top + b.height / 2 - size / 2;
  const el = document.createElement('div'); el.setAttribute('aria-hidden', 'true');
  el.style.cssText = `position:fixed;left:0;top:0;width:${size}px;height:${size}px;z-index:9999;pointer-events:none;border-radius:12px;overflow:hidden;box-shadow:0 10px 30px #0008;will-change:transform;`
    + (image && /^https:\/\//.test(image) ? `background:#fff url("${image.replace(/"/g, '%22')}") center/cover;` : 'background:linear-gradient(145deg,#12673c,#0a3f25);border:2px solid #c99a36;display:flex;align-items:center;justify-content:center;font-size:24px;');
  if (!(image && /^https:\/\//.test(image))) el.textContent = '🫙';
  document.body.appendChild(el);
  const dx = ex - sx, dy = ey - sy; const lift = -Math.min(160, Math.abs(dy) * 0.5 + 70);
  const anim = el.animate([
    { transform: `translate(${sx}px,${sy}px) scale(1) rotate(0deg)`, opacity: 1 },
    { transform: `translate(${sx + dx * 0.5}px,${sy + dy * 0.5 + lift}px) scale(1.15) rotate(180deg)`, opacity: 1, offset: 0.5 },
    { transform: `translate(${ex}px,${ey}px) scale(0.25) rotate(360deg)`, opacity: 0.4 },
  ], { duration: 750, easing: 'cubic-bezier(.5,.1,.3,1)' });
  anim.onfinish = () => { el.remove(); target.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 320, easing: 'ease-out' }); };
}
