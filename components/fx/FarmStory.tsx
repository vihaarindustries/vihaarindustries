'use client';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { clamp, createStage, makeJar, onionGeometry, smooth } from '@/lib/fx/models';

const STEPS = [
  { n: '01', title: 'Harvested fresh', text: 'Mature onions are selected, cleaned and graded at the farm gate.' },
  { n: '02', title: 'Sliced evenly', text: 'Uniform slices dry evenly and keep their natural flavour.' },
  { n: '03', title: 'Gently dehydrated', text: 'Moisture is drawn out under controlled heat, locking in taste and colour.' },
  { n: '04', title: 'Ground & packed', text: 'Milled to size, sealed and packed, ready for your kitchen or production line.' },
];

/** Scroll-driven story: an onion is sliced, dried, ground and ends up in a jar. The section pins to the screen while you scroll. */
export default function FarmStory() {
  const wrap = useRef<HTMLElement>(null); const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fallback, setFallback] = useState(false); const [step, setStep] = useState(0); const [bar, setBar] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current; const host = wrap.current; if (!canvas || !host) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let off = false; try { off = localStorage.getItem('vi-fx') === 'off' || sessionStorage.getItem('vi-fx-tier') === '3'; } catch { /* storage blocked */ }
    if (reduce || off) { setFallback(true); return; }
    let stage: ReturnType<typeof createStage>;
    try { stage = createStage(canvas, { camZ: 11 }); } catch { setFallback(true); return; }

    const onionGeo = onionGeometry();
    const onionMat = new THREE.MeshStandardMaterial({ color: '#d39a4e', roughness: 0.55 });
    const onion = new THREE.Mesh(onionGeo, onionMat); onion.scale.setScalar(1.5); onion.position.y = -0.4; stage.scene.add(onion);

    // slices
    const SL = 8; const sliceGeo = new THREE.SphereGeometry(1, 40, 14); const slices = new THREE.Group(); stage.scene.add(slices);
    const sliceMats: THREE.MeshStandardMaterial[] = []; const baseC = new THREE.Color('#ecd2a2'); const dryC = new THREE.Color('#a8742f');
    const slice: { m: THREE.Mesh; y0: number; r: number }[] = [];
    for (let i = 0; i < SL; i++) {
      const y = -0.55 + (i / (SL - 1)) * 1.5; const r = 0.78 * Math.sqrt(Math.max(0.12, 1 - Math.pow((y - 0.1) / 1.05, 2)));
      const mat = new THREE.MeshStandardMaterial({ color: baseC, roughness: 0.6, transparent: true }); sliceMats.push(mat);
      const m = new THREE.Mesh(sliceGeo, mat); slices.add(m); slice.push({ m, y0: y, r });
    }
    slices.scale.setScalar(1.5); slices.position.y = -0.4; slices.visible = false;

    // powder
    const N = 1800; const start = new Float32Array(N * 3), end = new Float32Array(N * 3), cur = new Float32Array(N * 3), delay = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const a = Math.random() * 6.28, rr = Math.sqrt(Math.random());
      start[i * 3] = Math.cos(a) * rr * 1.1; start[i * 3 + 1] = -0.5 + Math.random() * 1.4; start[i * 3 + 2] = Math.sin(a) * rr * 1.1;
      const a2 = Math.random() * 6.28, r2 = Math.sqrt(Math.random()) * 0.85;
      end[i * 3] = Math.cos(a2) * r2; end[i * 3 + 1] = -1.0 + Math.random() * 0.5; end[i * 3 + 2] = Math.sin(a2) * r2; delay[i] = Math.random() * 0.45;
    }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(cur, 3));
    const pm = new THREE.PointsMaterial({ size: 0.06, color: '#e8cf93', transparent: true, opacity: 0.95, depthWrite: false });
    const powder = new THREE.Points(pg, pm); powder.visible = false; stage.scene.add(powder);

    // jar (glass) that fills with powder
    const jar = makeJar({ title: 'Onion Powder', sub: 'Goodness in every grain', glass: true }); jar.group.position.y = -0.2; jar.group.scale.setScalar(0); stage.scene.add(jar.group);

    let p = 0, sp = 0, raf = 0, visible = true, lastStep = -1, lastBar = -1; const clock = new THREE.Clock();
    const prog = () => { const r = host.getBoundingClientRect(); return clamp(-r.top / Math.max(1, r.height - window.innerHeight), 0, 1); };
    const ro = new ResizeObserver(() => stage.resize()); ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }); io.observe(host);
    const frame = () => {
      raf = requestAnimationFrame(frame); if (!visible) return;
      const dt = Math.min(0.05, clock.getDelta()); const t = clock.elapsedTime; p = prog(); sp += (p - sp) * Math.min(1, dt * 6);
      const q = sp;
      // 1 onion
      const onionK = 1 - smooth(0.2, 0.28, q); onion.visible = onionK > 0.02; onion.scale.setScalar(1.5 * (0.6 + 0.4 * onionK)); onion.rotation.y = t * 0.5 + q * 8;
      // 2-3 slices
      slices.visible = q > 0.18 && q < 0.7; const spread = smooth(0.24, 0.44, q), dry = smooth(0.42, 0.6, q), shrink = smooth(0.52, 0.66, q), fade = 1 - smooth(0.62, 0.7, q);
      slice.forEach((s, i) => { s.m.position.y = s.y0 + (i - (SL - 1) / 2) * 0.28 * spread; const k = 1 - 0.5 * shrink; s.m.scale.set(s.r * k, 0.07 * (1 - 0.5 * dry), s.r * k); s.m.rotation.y = t * 0.3 + i; sliceMats[i].color.copy(baseC).lerp(dryC, dry); sliceMats[i].opacity = fade; });
      slices.rotation.y = q * 3;
      // 3-4 powder falls into the jar
      powder.visible = q > 0.56 && q < 0.97; const fall = smooth(0.58, 0.9, q) * 1.5;
      for (let i = 0; i < N; i++) {
        const k = clamp(fall - delay[i], 0, 1); const e = k * k * (3 - 2 * k); const a = i * 3;
        cur[a] = start[a] + (end[a] - start[a]) * e; cur[a + 1] = start[a + 1] + (end[a + 1] - start[a + 1]) * e + Math.sin(e * Math.PI) * 1.6 * (1 - e); cur[a + 2] = start[a + 2] + (end[a + 2] - start[a + 2]) * e;
      }
      (pg.attributes.position as THREE.BufferAttribute).needsUpdate = true; pm.opacity = 0.95 * (1 - smooth(0.92, 0.97, q));
      // 4 jar
      const jk = smooth(0.5, 0.68, q); jar.group.scale.setScalar(1.15 * jk); jar.group.visible = jk > 0.01; jar.group.rotation.y = -0.5 + q * 5 + Math.sin(t * 0.6) * 0.1;
      jar.fill.scale.y = 0.001 + 0.9 * smooth(0.66, 0.92, q); jar.lid.position.y = 1.6 + 2.6 * (1 - smooth(0.9, 0.99, q));
      stage.camera.position.z = 11 - 1.4 * q; stage.camera.position.x = Math.sin(q * 3) * 0.6; stage.camera.lookAt(0, -0.2, 0);
      stage.renderer.render(stage.scene, stage.camera);
      const s = q < 0.22 ? 0 : q < 0.46 ? 1 : q < 0.7 ? 2 : 3; if (s !== lastStep) { lastStep = s; setStep(s); } if (Math.abs(q - lastBar) > 0.004) { lastBar = q; setBar(q); }
    };
    frame();
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); jar.dispose(); onionGeo.dispose(); onionMat.dispose(); sliceGeo.dispose(); sliceMats.forEach((m) => m.dispose()); pg.dispose(); pm.dispose(); stage.dispose(); };
  }, []);

  if (fallback) return <section className="relative z-10 py-16 md:py-20" aria-label="From farm to jar"><div className="container">
    <div className="text-center max-w-2xl mx-auto"><div className="choice-eyebrow justify-center">FROM FARM TO JAR</div><h2 className="text-3xl md:text-5xl font-black tracking-tight text-white mt-4">How your onion powder is made.</h2></div>
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-10">{STEPS.map((s) => <div key={s.n} className="rounded-2xl border border-white/10 bg-white/5 p-6"><div className="text-[#28c779] font-black text-sm">{s.n}</div><h3 className="text-white font-bold mt-3">{s.title}</h3><p className="text-sm text-gray-400 leading-6 mt-2">{s.text}</p></div>)}</div>
  </div></section>;

  return <section ref={wrap} aria-label="From farm to jar" className="relative z-10" style={{ height: '430vh', background: '#07100b' }}>
    <div className="sticky top-0 h-screen overflow-hidden">
      <canvas ref={canvasRef} aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      <div className="relative z-10 container h-full flex flex-col justify-between py-10 md:py-14 pointer-events-none">
        <div><div className="choice-eyebrow">FROM FARM TO JAR</div><h2 className="text-3xl md:text-5xl font-black tracking-tight text-white mt-3 max-w-md">How your onion powder is made.</h2></div>
        <div className="max-w-sm md:max-w-md" aria-live="polite">
          <div className="text-[#28c779] font-black text-sm">{STEPS[step].n} / 04</div>
          <h3 className="text-2xl md:text-4xl font-black text-white mt-2">{STEPS[step].title}</h3>
          <p className="text-gray-300 leading-7 mt-3">{STEPS[step].text}</p>
          <div className="h-1 rounded-full bg-white/15 mt-6 overflow-hidden"><div className="h-full bg-[#28c779]" style={{ width: `${Math.round(bar * 100)}%` }} /></div>
          <div className="text-[11px] text-gray-500 mt-3 tracking-widest">KEEP SCROLLING ↓</div>
        </div>
      </div>
    </div>
  </section>;
}
