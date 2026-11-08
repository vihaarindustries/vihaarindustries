import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/** Shared 3D building blocks for the product viewer and the farm-to-jar story (the background scene has its own copy). */
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d') as CanvasRenderingContext2D, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function wrap(g: CanvasRenderingContext2D, text: string, maxW: number) {
  const lines: string[] = []; let cur = '';
  for (const w of text.split(/\s+/).filter(Boolean)) { const t = cur ? `${cur} ${w}` : w; if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur); return lines;
}

/** Wrap-around jar label: brand, product name (auto-sized to fit), small line underneath. */
export function jarLabelTexture(title: string, sub: string) {
  return canvasTex(2048, 480, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#12673c'); gr.addColorStop(1, '#0a3f25'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#c99a36'; g.fillRect(0, 26, w, 6); g.fillRect(0, h - 32, w, 6);
    g.textAlign = 'center'; g.fillStyle = '#9be3bb'; g.font = '700 36px Arial'; g.fillText('VIHAAR INDUSTRIES', w / 2, 90);
    let size = 100; let lines: string[] = [];
    for (const s of [100, 84, 70, 58, 48, 40]) { size = s; g.font = `900 ${s}px Arial`; lines = wrap(g, title.toUpperCase(), 640); if (lines.length <= 2 && lines.every((l) => g.measureText(l).width <= 640)) break; }
    g.fillStyle = '#f4ecd6'; g.font = `900 ${size}px Arial`; const y0 = lines.length > 1 ? 190 : 235;
    lines.slice(0, 2).forEach((l, i) => g.fillText(l, w / 2, y0 + i * (size + 10)));
    if (sub) { g.fillStyle = '#d8e8dc'; g.font = '400 34px Arial'; g.fillText(sub.slice(0, 44), w / 2, h - 62); }
  });
}

export type Jar = { group: THREE.Group; lid: THREE.Mesh; fill: THREE.Mesh; dispose: () => void };
/** The Vihaar jar. `glass` makes the body see-through so a powder fill level can be shown inside. */
export function makeJar(o: { title: string; sub?: string; glass?: boolean }): Jar {
  const group = new THREE.Group(); const label = jarLabelTexture(o.title, o.sub ?? 'Goodness in every grain');
  const body = o.glass
    ? new THREE.MeshPhysicalMaterial({ color: '#d4eadd', roughness: 0.08, transparent: true, opacity: 0.3, clearcoat: 1, depthWrite: false })
    : new THREE.MeshPhysicalMaterial({ color: '#eadfc2', roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.3 });
  const lidMat = new THREE.MeshStandardMaterial({ color: '#0f6b3c', metalness: 0.65, roughness: 0.32 });
  const gold = new THREE.MeshStandardMaterial({ color: '#c99a36', metalness: 0.9, roughness: 0.25 });
  const labelMat = new THREE.MeshStandardMaterial({ map: label, roughness: 0.55, metalness: 0.05 });
  const powderMat = new THREE.MeshStandardMaterial({ color: '#e8d6a8', roughness: 0.95 });
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, y: number) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; group.add(m); return m; };
  add(new THREE.CylinderGeometry(1, 1, 2.2, 72), body, 0); add(new THREE.CylinderGeometry(0.86, 1, 0.22, 72), body, 1.2);
  const lid = add(new THREE.CylinderGeometry(0.92, 0.92, 0.55, 72), lidMat, 1.6);
  add(new THREE.TorusGeometry(0.93, 0.035, 12, 72), gold, 1.33).rotation.x = Math.PI / 2;
  const arc = Math.PI * 1.7; const lab = new THREE.Mesh(new THREE.CylinderGeometry(1.012, 1.012, 1.4, 96, 1, true, -arc / 2, arc), labelMat); lab.position.y = -0.05; group.add(lab);
  const fg = new THREE.CylinderGeometry(0.95, 0.95, 2.1, 48); fg.translate(0, 1.05, 0); // pivot at the bottom so scale.y = fill level
  const fill = new THREE.Mesh(fg, powderMat); fill.position.y = -1.08; fill.scale.y = o.glass ? 0.001 : 0; fill.visible = !!o.glass; group.add(fill);
  const dispose = () => { group.traverse((x) => { const m = x as THREE.Mesh; m.geometry?.dispose(); }); [body, lidMat, gold, labelMat, powderMat].forEach((m) => m.dispose()); label.dispose(); };
  return { group, lid, fill, dispose };
}

/** Onion shape (lathe) with soft ridges. */
export function onionGeometry() {
  const pts = [[0, -0.62], [0.35, -0.6], [0.62, -0.4], [0.76, -0.05], [0.68, 0.38], [0.4, 0.72], [0.14, 1.0], [0.05, 1.18], [0, 1.2]].map((p) => new THREE.Vector2(p[0], p[1]));
  const g = new THREE.LatheGeometry(pts, 56); const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); const k = 1 + 0.035 * Math.cos(Math.atan2(z, x) * 14); p.setX(i, x * k); p.setZ(i, z * k); }
  g.computeVertexNormals(); return g;
}

/** A ready-to-use stage: transparent canvas, soft studio lighting, one camera. Call dispose() when done. */
export function createStage(canvas: HTMLCanvasElement, o: { camZ?: number; fov?: number; maxDpr?: number } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearAlpha(0); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, o.maxDpr ?? 1.75));
  const scene = new THREE.Scene(); const pm = new THREE.PMREMGenerator(renderer); const env = pm.fromScene(new RoomEnvironment(), 0.04); scene.environment = env.texture;
  const key = new THREE.DirectionalLight('#fff1d6', 2.2); key.position.set(-4, 6, 7); scene.add(key);
  const rim = new THREE.PointLight('#2bd283', 60, 30); rim.position.set(6, 1, -4); scene.add(rim);
  const camera = new THREE.PerspectiveCamera(o.fov ?? 35, 1, 0.1, 100); camera.position.set(0, 0, o.camZ ?? 12);
  const resize = () => { const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  resize();
  const dispose = () => { scene.traverse((x) => { const m = x as THREE.Mesh; m.geometry?.dispose(); }); env.dispose(); pm.dispose(); renderer.dispose(); };
  return { renderer, scene, camera, resize, dispose };
}
