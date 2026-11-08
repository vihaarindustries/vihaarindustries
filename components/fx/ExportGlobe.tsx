'use client';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { createStage } from '@/lib/fx/models';

/** Edit this list to match the countries you really ship to. [name, latitude, longitude] */
export const DESTINATIONS: [string, number, number][] = [
  ['Dubai', 25.2, 55.3], ['London', 51.5, -0.1], ['Hamburg', 53.5, 10], ['New York', 40.7, -74], ['Toronto', 43.7, -79.4],
  ['Singapore', 1.35, 103.8], ['Sydney', -33.9, 151.2], ['Tokyo', 35.7, 139.7], ['Johannesburg', -26.2, 28], ['Los Angeles', 34, -118.2],
];
const ORIGIN: [number, number] = [23.03, 72.58]; // Ahmedabad

// Very simplified continent outlines [lon, lat] (just enough to make a recognisable dotted globe)
const LAND: number[][][] = [
  [[-168, 66], [-156, 71], [-125, 70], [-95, 73], [-80, 72], [-62, 66], [-56, 52], [-66, 45], [-75, 38], [-81, 31], [-80, 25], [-90, 29], [-97, 26], [-97, 20], [-90, 21], [-87, 16], [-83, 10], [-78, 8], [-85, 11], [-92, 15], [-105, 20], [-110, 24], [-115, 30], [-118, 34], [-124, 40], [-124, 48], [-135, 58], [-150, 60], [-165, 60]],
  [[-78, 8], [-72, 12], [-62, 10], [-52, 5], [-50, 0], [-35, -6], [-39, -15], [-48, -26], [-58, -35], [-65, -42], [-68, -52], [-73, -52], [-74, -40], [-71, -28], [-70, -18], [-76, -12], [-81, -5], [-80, 0]],
  [[-10, 36], [-9, 43], [-2, 48], [-5, 50], [3, 52], [8, 55], [10, 58], [5, 62], [15, 69], [28, 71], [40, 67], [40, 55], [30, 46], [28, 41], [24, 37], [15, 38], [8, 44], [0, 38]],
  [[-17, 21], [-10, 30], [-6, 36], [10, 37], [20, 32], [32, 31], [35, 28], [43, 12], [51, 12], [40, -3], [40, -15], [33, -26], [20, -35], [18, -30], [12, -17], [9, -1], [9, 4], [-8, 4], [-17, 14]],
  [[28, 41], [40, 55], [40, 67], [60, 70], [80, 73], [110, 77], [140, 72], [170, 68], [180, 65], [160, 60], [142, 52], [135, 43], [128, 38], [122, 40], [121, 30], [110, 20], [108, 12], [104, 1], [98, 8], [98, 16], [92, 22], [88, 22], [80, 13], [77, 8], [72, 20], [66, 25], [57, 25], [56, 27], [48, 30], [43, 13], [35, 28], [36, 36]],
  [[114, -22], [122, -18], [131, -12], [142, -11], [146, -19], [153, -27], [150, -37], [140, -38], [132, -33], [115, -34]],
  [[-55, 60], [-45, 60], [-20, 70], [-20, 82], [-60, 82], [-70, 76]],
];
const inPoly = (lon: number, lat: number, poly: number[][]) => {
  let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) c = !c; } return c;
};
const toVec = (lat: number, lon: number, r = 1) => { const phi = ((90 - lat) * Math.PI) / 180, th = ((lon + 180) * Math.PI) / 180; return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th)); };

/** 3D globe with glowing shipping routes from Ahmedabad. Drag to spin. */
export default function ExportGlobe() {
  const ref = useRef<HTMLCanvasElement>(null); const [failed, setFailed] = useState(false);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    let stage: ReturnType<typeof createStage>; try { stage = createStage(canvas, { camZ: 3.6, fov: 38 }); } catch { setFailed(true); return; }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const tilt = new THREE.Group(); tilt.rotation.x = 0.35; const globe = new THREE.Group(); tilt.add(globe); stage.scene.add(tilt);
    const disposables: { dispose: () => void }[] = [];
    const keep = <T extends { dispose: () => void }>(x: T) => { disposables.push(x); return x; };

    // body + atmosphere
    globe.add(new THREE.Mesh(keep(new THREE.SphereGeometry(0.985, 64, 48)), keep(new THREE.MeshStandardMaterial({ color: '#0b1c13', roughness: 0.9, metalness: 0.1 }))));
    const atm = new THREE.Mesh(keep(new THREE.SphereGeometry(1.12, 48, 32)), keep(new THREE.MeshBasicMaterial({ color: '#25c878', transparent: true, opacity: 0.07, side: THREE.BackSide }))); tilt.add(atm);
    // graticule
    const gl: number[] = [];
    for (let lat = -60; lat <= 60; lat += 30) for (let lon = -180; lon < 180; lon += 6) { const a = toVec(lat, lon, 0.99), b = toVec(lat, lon + 6, 0.99); gl.push(a.x, a.y, a.z, b.x, b.y, b.z); }
    for (let lon = -180; lon < 180; lon += 30) for (let lat = -84; lat < 84; lat += 6) { const a = toVec(lat, lon, 0.99), b = toVec(lat + 6, lon, 0.99); gl.push(a.x, a.y, a.z, b.x, b.y, b.z); }
    const gg = keep(new THREE.BufferGeometry()); gg.setAttribute('position', new THREE.Float32BufferAttribute(gl, 3));
    globe.add(new THREE.LineSegments(gg, keep(new THREE.LineBasicMaterial({ color: '#2bd283', transparent: true, opacity: 0.1 }))));
    // land dots
    const dots: number[] = [];
    for (let lat = -58; lat <= 80; lat += 2.2) { const step = 2.2 / Math.max(0.2, Math.cos((lat * Math.PI) / 180)); for (let lon = -180; lon < 180; lon += step) if (LAND.some((pl) => inPoly(lon, lat, pl))) { const v = toVec(lat, lon, 1.0); dots.push(v.x, v.y, v.z); } }
    const dg = keep(new THREE.BufferGeometry()); dg.setAttribute('position', new THREE.Float32BufferAttribute(dots, 3));
    globe.add(new THREE.Points(dg, keep(new THREE.PointsMaterial({ color: '#4fe09a', size: 0.022, sizeAttenuation: true, transparent: true, opacity: 0.9 }))));

    // routes
    const o = toVec(ORIGIN[0], ORIGIN[1]); const SEG = 56;
    const routes = DESTINATIONS.map(([, lat, lon], i) => {
      const d = toVec(lat, lon); const ang = o.angleTo(d); const pts: THREE.Vector3[] = [];
      for (let k = 0; k <= SEG; k++) { const t = k / SEG; const v = new THREE.Vector3().copy(o).lerp(d, t).normalize().multiplyScalar(1 + Math.sin(Math.PI * t) * (0.08 + ang * 0.17)); pts.push(v); }
      const g = keep(new THREE.BufferGeometry().setFromPoints(pts)); const mat = keep(new THREE.LineBasicMaterial({ color: '#ffd36b', transparent: true, opacity: 0.95 }));
      const line = new THREE.Line(g, mat); globe.add(line);
      const head = new THREE.Mesh(keep(new THREE.SphereGeometry(0.02, 12, 8)), keep(new THREE.MeshBasicMaterial({ color: '#fff3c4' }))); globe.add(head);
      const mk = new THREE.Mesh(keep(new THREE.SphereGeometry(0.022, 12, 8)), keep(new THREE.MeshBasicMaterial({ color: '#ffd36b' }))); mk.position.copy(d); globe.add(mk);
      return { g, pts, head, mk, phase: i * 0.37 };
    });
    const home = new THREE.Mesh(keep(new THREE.SphereGeometry(0.04, 16, 12)), keep(new THREE.MeshBasicMaterial({ color: '#ffffff' }))); home.position.copy(o); globe.add(home);
    const halo = new THREE.Mesh(keep(new THREE.SphereGeometry(0.04, 16, 12)), keep(new THREE.MeshBasicMaterial({ color: '#25c878', transparent: true, opacity: 0.5 }))); halo.position.copy(o); globe.add(halo);

    const face = -Math.atan2(o.x, o.z); let spin = face - 0.6, vel = 0, dragging = false, lastX = 0, idle = 0, visible = true, raf = 0; const clock = new THREE.Clock();
    const down = (e: PointerEvent) => { dragging = true; lastX = e.clientX; vel = 0; canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing'; };
    const move = (e: PointerEvent) => { if (!dragging) return; const dx = e.clientX - lastX; lastX = e.clientX; spin += dx * 0.008; vel = dx * 0.008; idle = 0; };
    const up = () => { dragging = false; canvas.style.cursor = 'grab'; };
    canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    const ro = new ResizeObserver(() => stage.resize()); ro.observe(canvas); const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }); io.observe(canvas);
    const frame = () => {
      raf = requestAnimationFrame(frame); if (!visible) return; const dt = Math.min(0.05, clock.getDelta()); const t = clock.elapsedTime; idle += dt;
      if (!dragging) { spin += vel; vel *= 0.94; if (!reduce) spin += dt * (idle > 2 ? 0.12 : 0.03) * (idle > 2 ? 1 : 0); }
      globe.rotation.y = spin;
      for (const r of routes) {
        const c = (t * 0.45 + r.phase) % 1.9; const f = Math.min(1, c); const n = Math.max(2, Math.floor(f * (SEG + 1)));
        r.g.setDrawRange(0, n); r.head.position.copy(r.pts[n - 1]); r.head.visible = c < 1.2; r.mk.scale.setScalar(1 + 0.4 * Math.sin(t * 3 + r.phase * 9));
      }
      halo.scale.setScalar(1.4 + 1.1 * ((t * 0.9) % 1)); (halo.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - ((t * 0.9) % 1));
      stage.renderer.render(stage.scene, stage.camera);
    };
    frame();
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up); disposables.forEach((d) => d.dispose()); stage.dispose(); };
  }, []);

  return <section id="export" className="relative z-10 py-16 md:py-24"><div className="container grid md:grid-cols-[1fr_1.1fr] gap-10 items-center">
    <div><div className="eyebrow mb-3">EXPORT NETWORK</div><h2 className="text-3xl md:text-5xl font-black tracking-tight">From Gujarat to your port.</h2>
      <p className="muted leading-7 mt-5 max-w-md">We ship dehydrated onion, garlic and spice ingredients from Ahmedabad to buyers across the world. Tell us your destination and shipping terms and we will quote accordingly.</p>
      <div className="flex flex-wrap gap-2 mt-6">{DESTINATIONS.map(([n]) => <span key={n} className="text-xs font-bold rounded-full border border-white/20 px-3 py-1.5 text-gray-200">{n}</span>)}</div>
      <a href="#quote" className="btn mt-7">Get an export quotation ↗</a></div>
    <div className="relative aspect-square max-w-[560px] w-full mx-auto">
      {failed ? <div className="absolute inset-0 flex items-center justify-center text-sm muted">Interactive globe unavailable on this device.</div> : <canvas ref={ref} role="img" aria-label="3D globe showing shipping routes from Ahmedabad, India" style={{ width: '100%', height: '100%', display: 'block', cursor: 'grab', touchAction: 'pan-y' }} />}
      <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-bold tracking-widest text-gray-400">DRAG TO ROTATE</span>
    </div>
  </div></section>;
}
