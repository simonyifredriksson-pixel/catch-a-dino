/* Icons.js - pictures of things, drawn by the game itself.
   Every icon in the hotbar, the inventory, the dex and the shop is the real
   3D model rendered once into a small transparent picture (and cached).
   The inventory's big preview is the same trick every frame: a creature (or
   a tool, or you) on a slow turntable, animating. No image files. */
import * as THREE from '../../lib/three.module.js';
import { SP, VARIANTS } from '../data/Species.js';
import { creatureTemplate } from '../art/CreatureArt.js';
import { instantiate } from '../art/Rig.js';
import { Animator } from '../art/Animator.js';

export class IconMaker {
  constructor(renderer) {
    this.r = renderer; this.cache = new Map();
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#6a7a58', 2.2));
    const sun = new THREE.DirectionalLight('#fff4e0', 2.6); sun.position.set(3, 5, 4); this.scene.add(sun);
    const rim = new THREE.DirectionalLight('#c8e8ff', 1.2); rim.position.set(-4, 2, -3); this.scene.add(rim);
    this.cam = new THREE.PerspectiveCamera(26, 1, 0.01, 1000);
    this.rt = this._target(128, 128);
    this.cv = document.createElement('canvas');
  }
  _target(w, h) { const t = new THREE.WebGLRenderTarget(w, h, { samples: 4 }); t.texture.colorSpace = THREE.SRGBColorSpace; return t; }
  frame(obj, cam, o = {}) {
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj);
    const s = box.getBoundingSphere(new THREE.Sphere());
    const dir = new THREE.Vector3(...(o.dir || [0.85, 0.42, 1.15])).normalize();
    const d = s.radius / Math.sin(THREE.MathUtils.degToRad(cam.fov / 2)) * (o.zoom || 0.98);
    cam.position.copy(s.center).addScaledVector(dir, d); cam.near = d / 60; cam.far = d * 4; cam.updateProjectionMatrix();
    cam.lookAt(s.center);
  }
  draw(scene, cam, rt, canvas) {
    const r = this.r, old = r.getRenderTarget(), oc = r.getClearColor(new THREE.Color()), oa = r.getClearAlpha(), sh = r.shadowMap.enabled, fog = scene.fog;
    r.shadowMap.enabled = false;
    r.setRenderTarget(rt); r.setClearColor(0x000000, 0); r.clear(); r.render(scene, cam);
    const w = rt.width, h = rt.height, px = new Uint8Array(w * h * 4);
    r.readRenderTargetPixels(rt, 0, 0, w, h, px);
    r.setRenderTarget(old); r.setClearColor(oc, oa); r.shadowMap.enabled = sh;
    if (canvas.width !== w) canvas.width = w; if (canvas.height !== h) canvas.height = h;
    const ctx = canvas.getContext('2d'), img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) img.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
    ctx.putImageData(img, 0, 0);
    void fog;
  }
  get(key, build, o) {
    if (this.cache.has(key)) return this.cache.get(key);
    let url = '';
    try {
      const obj = build();
      this.scene.add(obj); this.frame(obj, this.cam, o); this.draw(this.scene, this.cam, this.rt, this.cv); this.scene.remove(obj);
      url = this.cv.toDataURL('image/png');
    } catch (e) { console.warn('icon', key, e); }
    this.cache.set(key, url);
    return url;
  }
  /** a creature's icon (side-on, idle) */
  creature(spId, v, o = {}) {
    return this.get('cr:' + spId + ':' + (v || '') + (o.dark ? ':d' : ''), () => {
      const g = creatureObj(spId, v, 0.6);
      if (o.dark) g.traverse(m => { if (m.isMesh) m.material = new THREE.MeshBasicMaterial({ color: '#1a2228' }); });
      return g;
    }, { dir: [1, 0.25, 0.55] });
  }
}
/** a posed creature in a group (for icons and previews) */
export function creatureObj(spId, v, t = 0.5, state = null) {
  const sp = SP[spId], T = creatureTemplate(sp, v, VARIANTS), I = instantiate(T), A = new Animator(I, T.meta, sp);
  const g = new THREE.Group(); g.add(I.mesh);
  const st = { speed: 0, ground: sp.move !== 'swim', water: sp.move === 'swim', fly: false, state };
  for (let i = 0; i < 20; i++) A.update(t / 20, st);
  if (sp.move === 'fly') I.mesh.position.y = 0;
  g.userData.tick = (dt) => A.update(dt, st);
  g.userData.anim = A;
  return g;
}

/** the turntable */
export class Preview {
  constructor(maker, canvas) {
    this.m = maker; this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#5a6a48', 1.9));
    const sun = new THREE.DirectionalLight('#fff4e0', 2.4); sun.position.set(2, 5, 4); this.scene.add(sun);
    const rim = new THREE.DirectionalLight('#9ad8ff', 1.4); rim.position.set(-3, 3, -4); this.scene.add(rim);
    const stage = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 0.08, 28), new THREE.MeshStandardMaterial({ color: '#2a3a2e', roughness: 0.6 }));
    stage.position.y = -0.04; this.stage = stage; this.scene.add(stage);
    this.cam = new THREE.PerspectiveCamera(26, 0.72, 0.05, 100);
    this.rt = maker._target(360, 500);
    this.spin = new THREE.Group(); this.scene.add(this.spin);
    this.obj = null; this.key = ''; this.yaw = 0.6; this.drag = null;
    canvas.addEventListener('pointerdown', e => { this.drag = { x: e.clientX, yaw: this.yaw }; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', e => { if (this.drag) this.yaw = this.drag.yaw + (e.clientX - this.drag.x) * 0.012; });
    canvas.addEventListener('pointerup', () => { this.drag = null; });
  }
  set(key, build, o = {}) {
    if (key === this.key) return;
    this.key = key;
    if (this.obj) this.spin.remove(this.obj);
    this.obj = build(); this.o = o;
    this.obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.obj), size = box.getSize(new THREE.Vector3());
    const s = (o.height || 2.0) / Math.max(size.y, size.x * 0.62, size.z * 0.62, 0.01);
    this.obj.scale.multiplyScalar(s); this.obj.position.y = -box.min.y * s;
    this.spin.add(this.obj);
    this.stage.scale.setScalar(Math.max(0.6, Math.min(2.2, Math.max(size.x, size.z) * s * 0.55)));
  }
  update(dt) {
    if (!this.obj) return;
    if (!this.drag) this.yaw += dt * 0.35;
    this.spin.rotation.y = this.yaw;
    if (this.obj.userData.tick) this.obj.userData.tick(dt);
    this.cam.position.set(0, 2.1, 8.6); this.cam.lookAt(0, 0.55, 0);
    this.m.draw(this.scene, this.cam, this.rt, this.canvas);
  }
}
