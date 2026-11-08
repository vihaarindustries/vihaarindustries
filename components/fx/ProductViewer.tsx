'use client';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { canvasTex, createStage, makeJar } from '@/lib/fx/models';

/** Drag-to-spin 3D jar for a product page. The label shows the product's own name and category. */
export default function ProductViewer({ name, category, onFail }: { name: string; category?: string; onFail?: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null); const failRef = useRef(onFail); failRef.current = onFail;
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    let stage: ReturnType<typeof createStage>;
    try { stage = createStage(canvas, { camZ: 9.5 }); } catch { failRef.current?.(); return; }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const jar = makeJar({ title: name, sub: category || 'Goodness in every grain' }); jar.group.scale.setScalar(1.05); stage.scene.add(jar.group);
    // soft glow on the "floor" under the jar
    const glowTex = canvasTex(256, 256, (g, w, h) => { const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); r.addColorStop(0, 'rgba(43,210,131,.45)'); r.addColorStop(1, 'rgba(43,210,131,0)'); g.fillStyle = r; g.fillRect(0, 0, w, h); });
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false })); glow.rotation.x = -Math.PI / 2; glow.position.y = -1.9; stage.scene.add(glow);

    let ry = -0.4, rx = 0.08, vy = 0, dragging = false, lastX = 0, lastY = 0, idle = 0, visible = true, raf = 0; const clock = new THREE.Clock();
    const down = (e: PointerEvent) => { dragging = true; lastX = e.clientX; lastY = e.clientY; vy = 0; canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing'; };
    const move = (e: PointerEvent) => { if (!dragging) return; const dx = e.clientX - lastX, dy = e.clientY - lastY; lastX = e.clientX; lastY = e.clientY; ry += dx * 0.012; vy = dx * 0.012; rx = THREE.MathUtils.clamp(rx + dy * 0.006, -0.5, 0.5); idle = 0; };
    const up = () => { dragging = false; canvas.style.cursor = 'grab'; };
    canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    const ro = new ResizeObserver(() => stage.resize()); ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }); io.observe(canvas);
    const frame = () => {
      raf = requestAnimationFrame(frame); if (!visible) return;
      const dt = Math.min(0.05, clock.getDelta()); idle += dt;
      if (!dragging) { ry += vy; vy *= 0.94; if (idle > 1.5 && !reduce) ry += dt * 0.5; rx += (0.08 - rx) * Math.min(1, dt * 2); }
      jar.group.rotation.set(rx, ry, 0); jar.group.position.y = Math.sin(clock.elapsedTime * 0.9) * 0.06;
      stage.renderer.render(stage.scene, stage.camera);
    };
    frame();
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up); jar.dispose(); glow.geometry.dispose(); (glow.material as THREE.Material).dispose(); glowTex.dispose(); stage.dispose(); };
  }, [name, category]);
  return <canvas ref={ref} aria-label={`3D view of ${name}. Drag to rotate.`} role="img" style={{ width: '100%', height: '100%', display: 'block', cursor: 'grab', touchAction: 'pan-y' }} />;
}
