'use client';
/**
 * Real-time 3D scene (WebGL / three.js) behind the page.
 *  - mode "fixed": one full-screen scene behind the whole page (used on the home page). Scrolling flies the camera
 *    down through the scene; the spice jar spins faster the harder you scroll or swipe; the mouse tilts the camera.
 *  - mode "hero": the scene fills one section only (used on the Retail and Business heroes).
 * Everything is built from code (no model files to download). Positions are in the ANCHORS table below.
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export type SceneProps = { variant?: 'home' | 'retail' | 'business' | 'page'; mode?: 'fixed' | 'hero' };
type Kind = 'jar' | 'sacks' | 'onion' | 'garlic' | 'chilli';
// xf: -1..1 across the screen width (0 = centre)   f: screens down from the top of the scene   z: depth (+ = closer)
type Anchor = { kind: Kind; xf: number; f: number; z: number; scale: number; tilt?: number };

// A repeating run of objects down the side of a long page: alternate left / right every `step` screens.
const run = (start: number, n: number, kinds: Kind[], step = 0.95): Anchor[] => Array.from({ length: n }, (_, i) => {
  const kind = kinds[i % kinds.length];
  return { kind, xf: i % 2 ? -0.86 : 0.86, f: start + i * step, z: i % 2 ? -0.4 : 0.6, scale: kind === 'jar' || kind === 'sacks' ? 0.7 : 0.52, tilt: ((i % 3) - 1) * 0.3 };
});
const ANCHORS: Record<NonNullable<SceneProps['variant']>, Anchor[]> = {
  page: [
    { kind: 'jar', xf: 0.84, f: 0.55, z: 0, scale: 0.75, tilt: 0.12 },
    { kind: 'onion', xf: -0.86, f: 0.95, z: 0.6, scale: 0.5, tilt: 0.3 },
    ...run(1.6, 7, ['chilli', 'garlic', 'sacks', 'onion', 'jar']),
  ],
  home: [
    { kind: 'jar', xf: 0.74, f: 0.6, z: 0, scale: 0.95, tilt: 0.12 },
    { kind: 'onion', xf: -0.8, f: 0.42, z: 1, scale: 0.62, tilt: 0.3 },
    { kind: 'chilli', xf: 0.88, f: 1.25, z: 0.5, scale: 0.6, tilt: 0.5 },
    { kind: 'garlic', xf: -0.86, f: 1.5, z: 0.5, scale: 0.55, tilt: 0.2 },
    { kind: 'sacks', xf: 0.8, f: 2.2, z: 0, scale: 0.7 },
    { kind: 'jar', xf: -0.76, f: 2.5, z: -0.5, scale: 0.7, tilt: -0.15 },
  ],
  retail: [
    { kind: 'jar', xf: 0.5, f: 0.52, z: 0.5, scale: 1.0, tilt: 0.12 },
    { kind: 'onion', xf: 0.88, f: 0.25, z: 1, scale: 0.5, tilt: 0.3 },
    { kind: 'garlic', xf: 0.2, f: 0.82, z: 1.2, scale: 0.42, tilt: 0.2 },
    { kind: 'chilli', xf: 0.9, f: 0.8, z: 1, scale: 0.5, tilt: 0.5 },
    ...run(1.7, 7, ['onion', 'jar', 'chilli', 'garlic']),
  ],
  business: [
    { kind: 'sacks', xf: 0.8, f: 0.55, z: 0.5, scale: 0.95 },
    { kind: 'jar', xf: 0.5, f: 0.76, z: 1, scale: 0.7, tilt: 0.12 },
    { kind: 'onion', xf: 0.93, f: 0.18, z: 0.5, scale: 0.45, tilt: 0.3 },
    ...run(1.7, 7, ['jar', 'sacks', 'garlic', 'onion']),
  ],
};
const FOG: Record<string, string> = { home: '#09120d', retail: '#09120d', business: '#09120d', page: '#09120d' };
const LABEL: Record<string, string[]> = {
  home: ['ONION POWDER', 'Goodness in every grain'], page: ['ONION POWDER', 'Goodness in every grain'], retail: ['ONION POWDER', 'Goodness in every grain'], business: ['DEHYDRATED ONION', 'Bulk & export supply'],
};

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

function tex(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d') as CanvasRenderingContext2D, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function ridge(geo: THREE.BufferGeometry, n: number, amp: number) {
  const p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); const k = 1 + amp * Math.cos(Math.atan2(z, x) * n); p.setX(i, x * k); p.setZ(i, z * k); }
  geo.computeVertexNormals(); return geo;
}
const lathe = (pts: number[][], seg = 56) => new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p[0], p[1])), seg);

function chilliGeometry() {
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 1, 0), new THREE.Vector3(0.28, 0.4, 0.05), new THREE.Vector3(0.4, -0.3, 0), new THREE.Vector3(0.26, -1, -0.05), new THREE.Vector3(0, -1.5, 0)]);
  const ts = 48, rs = 14; const g = new THREE.TubeGeometry(curve, ts, 0.23, rs, false);
  const p = g.attributes.position as THREE.BufferAttribute; const c = new THREE.Vector3(); const v = new THREE.Vector3();
  for (let i = 0; i <= ts; i++) {
    const t = i / ts; curve.getPointAt(t, c); const f = Math.max(0.05, Math.pow(1 - t, 0.75)) * (t < 0.08 ? 0.75 + t * 3 : 1);
    for (let j = 0; j <= rs; j++) { const idx = i * (rs + 1) + j; v.fromBufferAttribute(p, idx).sub(c).multiplyScalar(f).add(c); p.setXYZ(idx, v.x, v.y, v.z); }
  }
  g.computeVertexNormals(); return g;
}

export default function Scene3D({ variant = 'home', mode = 'fixed' }: SceneProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const parent = canvas.parentElement as HTMLElement;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const lowPower = window.innerWidth < 768 || (navigator.hardwareConcurrency ?? 8) <= 4;

    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowPower, alpha: true, powerPreference: 'high-performance' }); } catch { return; } // no WebGL: page simply shows without the scene
    renderer.setClearAlpha(0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    // Quality tier: 0 full, 1 medium, 2 low, 3 off. The loop below steps it down by itself if this device cannot keep up,
    // and remembers the result for the rest of the visit (sessionStorage), so the next page starts at the right level.
    const RATIO = [lowPower ? 1.25 : 1.75, 1.25, 1, 1]; const KEEP = [1, 0.6, 0.3, 0];
    let tier = lowPower ? 1 : 0; try { const saved = sessionStorage.getItem('vi-fx-tier'); if (saved !== null) tier = clamp(Number(saved) || 0, 0, 3); } catch { /* storage blocked */ }
    if (tier >= 3) { renderer.dispose(); return; }
    const dpr = window.devicePixelRatio || 1;
    renderer.setPixelRatio(Math.min(dpr, RATIO[tier]));

    const scene = new THREE.Scene(); scene.fog = new THREE.Fog(FOG[variant], 11, 27);
    const pm = new THREE.PMREMGenerator(renderer); const env = pm.fromScene(new RoomEnvironment(), 0.04); scene.environment = env.texture;
    const key = new THREE.DirectionalLight('#fff1d6', 2.2); key.position.set(-4, 6, 7); scene.add(key);
    const rim = new THREE.PointLight('#2bd283', 60, 30); rim.position.set(6, 1, -4); scene.add(rim);
    scene.add(new THREE.HemisphereLight('#cfe9d8', '#0b150f', 0.5));

    const CAM_Z = 12; const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 80); camera.position.set(0, 0, CAM_Z);
    const visH = 2 * Math.tan(THREE.MathUtils.degToRad(35 / 2)) * CAM_Z; // world height visible at z = 0
    let halfW = (visH * 1.78) / 2;

    // ---------- materials & shapes ----------
    const [l1, l2] = LABEL[variant]; const textures: THREE.Texture[] = [];
    const label = tex(2048, 480, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#12673c'); gr.addColorStop(1, '#0a3f25'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = '#c99a36'; g.fillRect(0, 26, w, 6); g.fillRect(0, h - 32, w, 6);
      g.textAlign = 'center'; g.fillStyle = '#f4ecd6'; g.font = '900 124px Arial'; g.fillText('VIHAAR', w / 2, 168);
      g.fillStyle = '#9be3bb'; g.font = '700 40px Arial'; g.fillText('INDUSTRIES', w / 2, 226);
      g.fillStyle = '#ffffff'; g.font = '900 62px Arial'; g.fillText(l1, w / 2, 318); g.fillStyle = '#d8e8dc'; g.font = '400 36px Arial'; g.fillText(l2, w / 2, 386);
    });
    const bag = tex(512, 512, (g, w, h) => {
      g.fillStyle = '#c8a266'; g.fillRect(0, 0, w, h); for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(90,60,20,${Math.random() * 0.08})`; g.fillRect(Math.random() * w, Math.random() * h, Math.random() * 90, 2); }
      g.fillStyle = '#0f5a35'; g.fillRect(70, 150, w - 140, 212); g.fillStyle = '#c99a36'; g.fillRect(70, 150, w - 140, 6); g.fillRect(70, 356, w - 140, 6);
      g.textAlign = 'center'; g.fillStyle = '#f4ecd6'; g.font = '900 96px Arial'; g.fillText('VI', w / 2, 252); g.font = '700 30px Arial'; g.fillText('INGREDIENTS · 25 KG', w / 2, 306); g.font = '400 22px Arial'; g.fillStyle = '#9be3bb'; g.fillText('VIHAAR INDUSTRIES', w / 2, 340);
    });
    textures.push(label, bag);

    const M = {
      cream: new THREE.MeshPhysicalMaterial({ color: '#eadfc2', roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.3 }),
      lid: new THREE.MeshStandardMaterial({ color: '#0f6b3c', metalness: 0.65, roughness: 0.32 }),
      gold: new THREE.MeshStandardMaterial({ color: '#c99a36', metalness: 0.9, roughness: 0.25 }),
      label: new THREE.MeshStandardMaterial({ map: label, roughness: 0.55, metalness: 0.05 }),
      bag: new THREE.MeshStandardMaterial({ map: bag, roughness: 0.85 }),
      onion: new THREE.MeshStandardMaterial({ color: '#d39a4e', roughness: 0.55, metalness: 0.05 }),
      garlic: new THREE.MeshStandardMaterial({ color: '#f0e6cf', roughness: 0.6 }),
      chilli: new THREE.MeshPhysicalMaterial({ color: '#c42a18', roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.2, side: THREE.DoubleSide }),
      stem: new THREE.MeshStandardMaterial({ color: '#2f7d32', roughness: 0.6 }),
      pepper: new THREE.MeshStandardMaterial({ color: '#2a2018', roughness: 0.5 }),
      seed: new THREE.MeshStandardMaterial({ color: '#d9b13e', roughness: 0.45 }),
    };
    const G = {
      onion: ridge(lathe([[0, -0.62], [0.35, -0.6], [0.62, -0.4], [0.76, -0.05], [0.68, 0.38], [0.4, 0.72], [0.14, 1.0], [0.05, 1.18], [0, 1.2]]), 14, 0.035),
      garlic: ridge(lathe([[0, -0.55], [0.3, -0.5], [0.62, -0.25], [0.72, 0.1], [0.55, 0.5], [0.22, 0.85], [0.1, 1.1], [0.06, 1.25], [0, 1.28]]), 9, 0.075),
      chilli: chilliGeometry(), ball: new THREE.IcosahedronGeometry(1, 2),
    };

    function jar() {
      const g = new THREE.Group();
      const add = (geo: THREE.BufferGeometry, mat: THREE.Material, y: number) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; g.add(m); return m; };
      add(new THREE.CylinderGeometry(1, 1, 2.2, 72), M.cream, 0);
      add(new THREE.CylinderGeometry(0.86, 1, 0.22, 72), M.cream, 1.2);
      add(new THREE.CylinderGeometry(0.92, 0.92, 0.55, 72), M.lid, 1.6);
      add(new THREE.TorusGeometry(0.93, 0.035, 12, 72), M.gold, 1.33).rotation.x = Math.PI / 2;
      add(new THREE.TorusGeometry(0.93, 0.03, 12, 72), M.gold, 1.88).rotation.x = Math.PI / 2;
      const arc = Math.PI * 1.7; const lab = new THREE.Mesh(new THREE.CylinderGeometry(1.012, 1.012, 1.4, 96, 1, true, -arc / 2, arc), M.label); lab.position.y = -0.05; g.add(lab);
      return g;
    }
    function sacks() {
      const g = new THREE.Group(); const geo = new RoundedBoxGeometry(1.5, 0.9, 1.0, 5, 0.18);
      [[-0.78, -0.6, 0.1, 0.1], [0.78, -0.6, 0, -0.08], [0, 0.35, 0.05, 0.05]].forEach(([x, y, z, r]) => { const m = new THREE.Mesh(geo, M.bag); m.position.set(x, y, z); m.rotation.y = r; g.add(m); });
      return g;
    }
    function fruit(kind: 'onion' | 'garlic' | 'chilli') {
      const g = new THREE.Group();
      if (kind === 'onion') g.add(new THREE.Mesh(G.onion, M.onion));
      else if (kind === 'garlic') g.add(new THREE.Mesh(G.garlic, M.garlic));
      else { g.add(new THREE.Mesh(G.chilli, M.chilli)); const s = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.12, 0.38, 10), M.stem); s.position.set(0, 1.15, 0); s.rotation.z = 0.25; g.add(s); }
      return g;
    }

    // ---------- hero objects ----------
    type Hero = { holder: THREE.Group; obj: THREE.Object3D; a: Anchor; i: number };
    const heroes: Hero[] = ANCHORS[variant].map((a, i) => {
      const obj = a.kind === 'jar' ? jar() : a.kind === 'sacks' ? sacks() : fruit(a.kind);
      obj.scale.setScalar(a.scale); const holder = new THREE.Group(); holder.add(obj); scene.add(holder); return { holder, obj, a, i };
    });

    // ---------- floating field of spices ----------
    const span = mode === 'fixed' ? 8 : 1.25; const density = (lowPower ? 0.5 : 1) * (mode === 'fixed' ? 0.5 : 1);
    type Item = { xf: number; y: number; z: number; s: number; r0: [number, number, number]; v: [number, number, number]; ph: number };
    const fields: { mesh: THREE.InstancedMesh; items: Item[] }[] = [];
    const makeField = (geo: THREE.BufferGeometry, mat: THREE.Material, n: number, smin: number, smax: number) => {
      const count = Math.max(2, Math.round(n * span * density)); const mesh = new THREE.InstancedMesh(geo, mat, count); mesh.frustumCulled = false;
      const items: Item[] = Array.from({ length: count }, () => ({
        xf: (Math.random() < 0.5 ? -1 : 1) * (Math.random() < 0.15 ? rand(0, 0.5) : rand(0.5, 1.2)), y: visH * (0.5 - rand(0, span)), z: rand(-7, 2.5), s: rand(smin, smax),
        r0: [rand(0, 6.28), rand(0, 6.28), rand(0, 6.28)], v: [rand(-0.5, 0.5), rand(-0.6, 0.6), rand(-0.4, 0.4)], ph: rand(0, 6.28),
      }));
      scene.add(mesh); fields.push({ mesh, items });
    };
    makeField(G.onion, M.onion, 3, 0.16, 0.34); makeField(G.garlic, M.garlic, 3, 0.16, 0.32); makeField(G.chilli, M.chilli, 3, 0.14, 0.3);
    makeField(G.ball, M.pepper, 26, 0.05, 0.11); makeField(G.ball, M.seed, 18, 0.04, 0.08);

    // ---------- spice dust ----------
    const dustN = Math.round((mode === 'fixed' ? 2800 : 450) * (lowPower ? 0.5 : 1)); const dp = new Float32Array(dustN * 3);
    for (let i = 0; i < dustN; i++) { dp[i * 3] = rand(-11, 11); dp[i * 3 + 1] = visH * (0.5 - rand(0, span + 0.3)); dp[i * 3 + 2] = rand(-9, 4); }
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
    const dm = new THREE.PointsMaterial({ size: 0.05, color: '#a9ecc6', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending });
    const dust = new THREE.Points(dg, dm); scene.add(dust);
    let stopped = false; let resizeFn: () => void = () => {};
    const applyTier = () => {
      for (const fl of fields) fl.mesh.count = Math.max(1, Math.floor(fl.items.length * KEEP[tier]));
      dg.setDrawRange(0, Math.max(1, Math.floor(dustN * KEEP[tier])));
      renderer.setPixelRatio(Math.min(dpr, RATIO[tier])); resizeFn();
    };

    // ---------- sizing ----------
    const dummy = new THREE.Object3D(); let W = 1, H = 1;
    const resize = () => {
      W = mode === 'fixed' ? window.innerWidth : parent.clientWidth; H = mode === 'fixed' ? window.innerHeight : parent.clientHeight;
      if (!W || !H) return; renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix(); halfW = (visH * camera.aspect) / 2;
    };
    resize(); resizeFn = resize; applyTier();
    const ro = new ResizeObserver(resize); ro.observe(mode === 'fixed' ? document.documentElement : parent);

    // ---------- input ----------
    let tx = 0, ty = 0, mx = 0, my = 0;
    const onMove = (e: PointerEvent) => { tx = (e.clientX / window.innerWidth - 0.5) * 2; ty = (e.clientY / window.innerHeight - 0.5) * 2; };
    let kick = 0; const onNav = () => { kick = 1; };
    window.addEventListener('vi-fx-nav', onNav); window.addEventListener('pointermove', onMove, { passive: true });
    let visible = true; const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }); if (mode === 'hero') io.observe(parent);
    const progress = () => { if (mode === 'fixed') return window.scrollY / window.innerHeight; const r = parent.getBoundingClientRect(); return -r.top / Math.max(1, r.height); };

    // ---------- loop ----------
    const clock = new THREE.Clock(); let time = 0, sp = progress(), lastP = sp, vel = 0, spin = 0, raf = 0, ready = false;
    const host = parent.closest('[data-scene-host]');
    let lastT = 0, acc = 0, nF = 0, bad = 0, warmUntil = performance.now() + 2500;
    const step = (to: number) => {
      tier = to; bad = 0; warmUntil = performance.now() + 1500; try { sessionStorage.setItem('vi-fx-tier', String(tier)); } catch { /* ignore */ }
      if (tier >= 3) { stopped = true; cancelAnimationFrame(raf); canvas.style.display = 'none'; window.dispatchEvent(new Event('vi-fx-auto-off')); return; }
      applyTier();
    };
    const frame = (now: number = performance.now()) => {
      if (stopped) return;
      if (!reduce) raf = requestAnimationFrame(frame);
      if (!reduce) { // frame-rate watchdog: two slow half-second windows in a row = step the quality down one level
        const d = now - lastT; lastT = now;
        if (visible && d > 0 && d < 250 && now > warmUntil) { acc += d; nF++; if (nF >= 30) { bad = acc / nF > 26 ? bad + 1 : 0; acc = 0; nF = 0; if (bad >= 2) step(tier + 1); } } else if (d >= 250) { acc = 0; nF = 0; }
      }
      if (!visible || !W) return;
      const dt = Math.min(0.05, clock.getDelta()); time += reduce ? 0 : dt;
      const p = progress(); vel += ((p - lastP) / Math.max(dt, 0.001) - vel) * Math.min(1, dt * 8); lastP = p;
      sp += (p - sp) * Math.min(1, dt * 7); mx += (tx - mx) * Math.min(1, dt * 4); my += (ty - my) * Math.min(1, dt * 4);
      kick *= Math.exp(-dt * 2.2); spin += clamp(vel, -4, 4) * dt * 3.2 + kick * dt * 7; // scrolling / swiping / changing page spins everything

      camera.position.set(mx * 0.7, -sp * visH - my * 0.25, CAM_Z - kick * 2.2); camera.rotation.set(-my * 0.03, -mx * 0.05, 0);
      for (const h of heroes) {
        const { a, obj, holder, i } = h;
        holder.position.set(a.xf * halfW, visH * (0.5 - a.f) + Math.sin(time * 0.8 + i * 1.7) * 0.12, a.z);
        const big = a.kind === 'jar' || a.kind === 'sacks';
        obj.rotation.set((a.tilt ?? 0) * 0.6 - my * 0.15, time * (big ? 0.35 : 0.6) + spin * (big ? 1 : 1.4) + mx * (big ? 0.6 : 0.3) + i, a.kind === 'jar' ? (a.tilt ?? 0) : (a.tilt ?? 0) * 0.5);
      }
      for (const f of fields) {
        for (let k = 0; k < f.mesh.count; k++) {
          const it = f.items[k];
          dummy.position.set(it.xf * halfW, it.y + Math.sin(time * 0.6 + it.ph) * 0.18, it.z);
          dummy.rotation.set(it.r0[0] + time * it.v[0] + spin * 0.4, it.r0[1] + time * it.v[1] + spin * 0.6, it.r0[2] + time * it.v[2]);
          dummy.scale.setScalar(it.s); dummy.updateMatrix(); f.mesh.setMatrixAt(k, dummy.matrix);
        }
        f.mesh.instanceMatrix.needsUpdate = true;
      }
      dust.rotation.y = time * 0.02 + spin * 0.03;
      renderer.render(scene, camera);
      if (!ready) { ready = true; host?.classList.add('scene-ready'); }
    };
    frame(); const onStaticResize = () => frame(); if (reduce) window.addEventListener('resize', onStaticResize);

    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); window.removeEventListener('pointermove', onMove); window.removeEventListener('vi-fx-nav', onNav); window.removeEventListener('resize', onStaticResize); 
      host?.classList.remove('scene-ready');
      scene.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); });
      Object.values(G).forEach((g) => g.dispose()); Object.values(M).forEach((m) => m.dispose()); textures.forEach((t) => t.dispose()); dg.dispose(); dm.dispose();
      env.dispose(); pm.dispose(); renderer.dispose();
    };
  }, [variant, mode]);

  const style: React.CSSProperties = mode === 'fixed'
    ? { position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: -2, pointerEvents: 'none' }
    : { position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none' };
  return <canvas key={`${variant}-${mode}`} ref={ref} aria-hidden="true" style={style} />;
}
