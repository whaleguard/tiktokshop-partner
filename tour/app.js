// TikTok Shop virtual store tour — scene, navigation, interaction.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FloorBuilder } from './build.js';
import { cutout, radialShadow } from './tex.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { I18N } from './i18n.js';

const BASE = new URL('../', import.meta.url).href;
const SB_URL = 'https://eqsswegpkkyiargzggug.supabase.co';
const SB_KEY = 'sb_publishable_5uTiEe3t4tbkbHyvWZfaig_0PIAmMJt';
const $ = s => document.querySelector(s);
const isTouch = matchMedia('(pointer: coarse)').matches;
const lite = isTouch || (navigator.hardwareConcurrency || 8) <= 4;

// ---------- state ----------
const LANGS = ['ko', 'en', 'zh', 'ja', 'vi'];
let lang = (() => { try { const l = localStorage.getItem('kj_lang'); if (LANGS.includes(l)) return l; } catch (e) { } const n = (navigator.language || 'ko').slice(0, 2); return LANGS.includes(n) ? n : 'ko'; })();
let spec, storeId = 'seoul', level = 1, cur = 'KRW';
const products = new Map();
const t = k => (I18N[k] && (I18N[k][lang] || I18N[k].en)) || k;
const L = v => !v ? '' : typeof v === 'string' ? v : (v[lang] || v.en || v.ko || '');

// ---------- renderer ----------
const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lite, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, lite ? 1.5 : 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#0d0d0f');
const camera = new THREE.PerspectiveCamera(isTouch ? 72 : 64, 1, .05, 120);
const pmrem = new THREE.PMREMGenerator(renderer);
const roomEnvTex = pmrem.fromScene(new RoomEnvironment(), .04).texture;
scene.environment = roomEnvTex;
scene.environmentIntensity = .55;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), lite ? .45 : .6, .5, .82);
composer.addPass(bloom);
composer.addPass(new OutputPass());

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false); composer.setSize(w, h);
  bloom.resolution.set(w / (lite ? 3 : 2), h / (lite ? 3 : 2));
  camera.aspect = w / h; camera.fov = (w < h ? 78 : isTouch ? 70 : 64); camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

// ---------- media ----------
const videos = {};
const videoEls = [];
function videoTex(key, file) {
  const v = document.createElement('video');
  v.src = BASE + 'video/' + file; v.muted = true; v.loop = true; v.playsInline = true; v.crossOrigin = 'anonymous'; v.preload = 'auto';
  v.setAttribute('playsinline', ''); v.setAttribute('webkit-playsinline', '');
  const tx = new THREE.VideoTexture(v); tx.colorSpace = THREE.SRGBColorSpace;
  videos[key] = tx; videoEls.push(v);
}
videoTex('hero', 'hero.mp4'); videoTex('studio', 'studio.mp4'); videoTex('host-jp', 'host-jp.mp4'); videoTex('creator', 'creator.mp4');
videoTex('live-a', 'live-a.mp4'); videoTex('live-b', 'live-b.mp4'); videoTex('live-c', 'live-c.mp4');
const videoAspect = { hero: 16 / 9, studio: 16 / 9, 'host-jp': 16 / 9, creator: 16 / 9, 'live-a': 832 / 1104, 'live-b': 832 / 1104, 'live-c': 16 / 9 };
const texLoader = new THREE.TextureLoader();
const loadTex = url => { const tx = texLoader.load(url); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8; return tx; };
const viewTex = {
  seoul: { street: loadTex(BASE + 'img/tour/view-seoul-street.jpg'), sky: loadTex(BASE + 'img/tour/view-seoul-sky.jpg') },
  tokyo: { street: loadTex(BASE + 'img/tour/view-tokyo-street.jpg'), sky: loadTex(BASE + 'img/tour/view-tokyo-sky.jpg') },
};
const posters = ['poster-beauty', 'poster-creator', 'poster-tech', 'hero', 'host-jp', 'creator'].map(n => BASE + (n.startsWith('poster') ? 'img/tour/' + n + '.jpg' : 'img/' + n + '.jpg'));
const posterCache = new Map();
function posterTex(f) {
  const s = (f.id || '') + (f.text || '');
  let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  let idx = h % posters.length;
  if (/creator|クリエイター|크리에이터/i.test(s)) idx = 1; else if (/tech|gadget|audio|sound/i.test(s)) idx = 2; else if (/beauty|skin|뷰티/i.test(s)) idx = 0;
  const url = posters[idx];
  if (!posterCache.has(url)) posterCache.set(url, loadTex(url));
  return posterCache.get(url);
}

// ---------- products ----------
function fmt(n, c = cur) { if (n == null || n === '') return ''; return c === 'JPY' ? '¥' + Math.round(n).toLocaleString('ja-JP') : '₩' + Math.round(n).toLocaleString('ko-KR'); }
function priceOf(p) { return cur === 'JPY' ? p.price_jpy : p.price_krw; }
function listOf(p) { return cur === 'JPY' ? p.list_price_jpy : p.list_price_krw; }
async function loadProducts() {
  for (const p of spec.products) {
    products.set(p.id, { ...p, image: BASE + 'img/p-' + p.id + '.jpg', db: null });
  }
  try {
    const r = await fetch(SB_URL + '/rest/v1/tts_catalog?select=*&active=eq.true&mall=eq.true', { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } });
    if (!r.ok) throw 0;
    const rows = await r.json();
    for (const row of rows) {
      const m = String(row.img_url || '').match(/p-([a-z0-9-]+)\.jpg/);
      if (!m) continue; const p = products.get(m[1]); if (!p) continue;
      p.db = row.id;
      ['price_krw', 'price_jpy', 'list_price_krw', 'list_price_jpy', 'rating', 'sold', 'options', 'stock'].forEach(k => { if (row[k] != null && row[k] !== '') p[k] = row[k]; });
      if (row.name && lang === 'ko') p.dbName = row.name;
      if (row.detail || row.descr) p.detail_db = row.detail || row.descr;
    }
  } catch (e) { console.warn('catalog fetch failed', e); }
  for (const p of products.values()) { p.price = priceOf(p); }
}

// ---------- world ----------
let floorGroup = null, pickables = [], obstacles = [], portals = [], bounds = { w: 26, d: 18 };
const builderCtx = { videoAspect, boothVideos: null, lang, products, fmtPrice: p => fmt(priceOf(p)), videos, pickables, lite, viewTex: {}, posterTex, levelLabel: '1F' };
let builder = new FloorBuilder(builderCtx);

function disposeGroup(g) {
  g.traverse(o => { if (o.geometry) o.geometry.dispose(); });
}
function buildFloor() {
  if (floorGroup) { scene.remove(floorGroup); disposeGroup(floorGroup); }
  pickables.length = 0; obstacles = []; portals = [];
  const store = spec.stores.find(s => s.id === storeId);
  const floor = store.floors.find(f => f.level === level) || store.floors[0];
  builderCtx.lang = lang; builderCtx.viewTex = viewTex[storeId]; builder.boothN = 0;
  builderCtx.boothVideos = storeId === 'tokyo' ? ['host-jp', 'live-b', 'live-a', 'hero', 'live-b', 'host-jp'] : ['hero', 'live-a', 'live-c', 'creator', 'live-b', 'host-jp']; builderCtx.levelLabel = level + 'F';
  builderCtx.fmtPrice = p => fmt(priceOf(p));
  const g = new THREE.Group();
  g.add(builder.room(floor, store, level, store.floors.length));
  bounds = { w: (floor.size || [26, 18])[0], d: (floor.size || [26, 18])[1] };
  for (const f of floor.fixtures) {
    const obj = builder.fixture(f); g.add(obj);
    // collision footprint (rotated AABB), skip flat things
    if (!['rug', 'neon_sign', 'poster', 'banner'].includes(f.type) || (f.type === 'banner' && (f.pos?.[1] || 0) < .2 && (f.size?.[1] || 0) > 1.5)) {
      let [w, , d] = f.size || [1, 1, 1]; if (f.type === 'studio_booth' && d > w) [w, d] = [d, w]; const a = (f.rot || 0) * Math.PI / 180;
      const hw = Math.abs(Math.cos(a)) * w / 2 + Math.abs(Math.sin(a)) * d / 2, hd = Math.abs(Math.sin(a)) * w / 2 + Math.abs(Math.cos(a)) * d / 2;
      if (f.type !== 'neon_sign' && !(f.type === 'led_wall' && (f.pos?.[1] || 0) > 1))
        obstacles.push({ x0: f.pos[0] - hw, x1: f.pos[0] + hw, z0: f.pos[2] - hd, z1: f.pos[2] + hd, type: f.type, id: f.id });
    }
    if (f.type === 'stairs' || f.type === 'elevator') portals.push({ f, obj });
  }
  builder.finalize(g);
  mergeStatic(g);
  addPeople(g, floor);
  // lighting: hemi + a handful of spots from the spec
  const hemi = new THREE.HemisphereLight(0xfff8f0, 0x6a625a, storeId === 'tokyo' ? .5 : .55); g.add(hemi);
  const amb = new THREE.AmbientLight(0xffffff, .12); g.add(amb);
  const spots = (floor.lights || []).filter(l => l.type === 'spot' || l.type === 'area').slice(0, lite ? 3 : 7);
  for (const l of spots) {
    const sl = new THREE.SpotLight(new THREE.Color(l.color || '#fff'), (l.intensity || 4) * (l.type === 'area' ? 4 : 6), 11, .9, .65, 1.4);
    sl.position.set(l.pos[0], (floor.height || 4.5) - .3, l.pos[2]); sl.target.position.set(l.pos[0], 0, l.pos[2]);
    g.add(sl); g.add(sl.target);
  }
  for (const l of (floor.lights || []).filter(l => l.type === 'neon').slice(0, lite ? 0 : 3)) {
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, Math.max(...(l.size || [1, 1])), 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(l.color).multiplyScalar(2), toneMapped: false }));
    tube.position.set(l.pos[0], l.pos[1], l.pos[2]); tube.rotation.x = Math.PI / 2; if ((l.rot || 0) % 180 === 0) tube.rotation.z = Math.PI / 2; g.add(tube);
  }
  scene.add(g); floorGroup = g;
  scene.environment = roomEnvTex; scene.environmentIntensity = .55;
  clearTimeout(envTimer); envTimer = setTimeout(captureEnv, 1600); setTimeout(captureEnv, 5000);
  scene.background = new THREE.Color(storeId === 'tokyo' ? '#e9eef2' : '#0d0d0f');
  bloom.threshold = storeId === 'tokyo' ? .97 : .82; renderer.toneMappingExposure = storeId === 'tokyo' ? .92 : 1.05;
  renderHud(store, floor);
  return floor;
}

// ---------- static batching: merge plain meshes that share a material ----------
function mergeStatic(root) {
  root.updateMatrixWorld(true);
  const groups = new Map(), victims = [];
  root.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || !o.visible) return;
    if (Object.keys(o.userData).length) return;
    const m = o.material; if (Array.isArray(m) || m.transparent || m.map?.isVideoTexture || !m.visible) return;
    const g = o.geometry; if (!g.index || !g.attributes.normal || !g.attributes.uv) return;
    if (!groups.has(m)) groups.set(m, []);
    groups.get(m).push(o);
  });
  for (const [m, list] of groups) {
    if (list.length < 2) continue;
    const geos = list.map(o => { const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld); for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); return g; });
    let merged; try { merged = mergeGeometries(geos, false); } catch (e) { merged = null; }
    geos.forEach(g => g.dispose());
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, m); mesh.receiveShadow = true; root.add(mesh);
    victims.push(...list);
  }
  for (const o of victims) { o.parent.remove(o); o.geometry.dispose(); }
}

// ---------- people (photo cutouts, billboarded) ----------
const people = [];
function addPeople(g, floor) {
  people.length = 0;
  const set = storeId === 'tokyo' ? 'jp' : 'kr';
  let seed = (storeId === 'tokyo' ? 7 : 3) * 31 + level * 17;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const n = level === 1 ? 5 : 4;
  const spawnP = floor.spawn?.pos || [0, 1.6, 7];
  const spots = [];
  for (let tries = 0; spots.length < n && tries < 400; tries++) {
    const x = (rnd() - .5) * (bounds.w - 3), z = (rnd() - .5) * (bounds.d - 3);
    if (blockedBy(x, z, .9)) continue;
    if (Math.hypot(x - spawnP[0], z - spawnP[2]) < 3) continue;
    if (spots.some(s => Math.hypot(s[0] - x, s[1] - z) < 2.5)) continue;
    spots.push([x, z]);
  }
  spots.forEach(([x, z], i) => {
    const idx = (i + level) % 4 + 1;
    const url = BASE + `img/tour/people-${set}-${idx}.jpg`;
    const grp = new THREE.Group(); grp.position.set(x, 0, z); g.add(grp);
    const h = 1.6 + rnd() * .15;
    const geo = new THREE.PlaneGeometry(1, 1); geo.translate(0, .5, 0);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 })); grp.add(mesh);
    const shd = new THREE.Mesh(new THREE.PlaneGeometry(.75, .4), new THREE.MeshBasicMaterial({ map: radialShadow(), transparent: true, depthWrite: false, color: 0, opacity: .55 }));
    shd.rotation.x = -Math.PI / 2; shd.position.y = .004; grp.add(shd);
    cutout(url, 768).then(r => { if (!r) { grp.visible = false; return; } mesh.material = new THREE.MeshStandardMaterial({ map: r.tex, transparent: true, alphaTest: .4, roughness: .8, side: THREE.DoubleSide }); mesh.scale.set(h * r.aspect, h, 1); });
    people.push(grp);
    obstacles.push({ x0: x - .25, x1: x + .25, z0: z - .25, z1: z + .25, type: 'person' });
  });
}
function blockedBy(x, z, m) { for (const o of obstacles) if (x > o.x0 - m && x < o.x1 + m && z > o.z0 - m && z < o.z1 + m) return true; return false; }

// ---------- capture the actual store into the environment map (real reflections) ----------
let envTimer = 0, envRT = null, cubeRT = null, cubeCam = null;
function captureEnv() {
  if (!floorGroup) return;
  if (!cubeRT) { cubeRT = new THREE.WebGLCubeRenderTarget(lite ? 128 : 256, { type: THREE.HalfFloatType }); cubeCam = new THREE.CubeCamera(.1, 60, cubeRT); scene.add(cubeCam); }
  cubeCam.position.set(0, 1.7, 0);
  const vis = marker.visible; marker.visible = false;
  const prevEnv = scene.environment; scene.environment = roomEnvTex;
  cubeCam.update(renderer, scene);
  marker.visible = vis;
  const tex = pmrem.fromCubemap(cubeRT.texture);
  if (envRT) envRT.dispose(); envRT = tex;
  scene.environment = tex.texture; scene.environmentIntensity = .9;
}

// ---------- player ----------
const player = { x: 0, z: 7, yaw: 0, pitch: .07, vx: 0, vz: 0, eye: 1.62 };
let walkTarget = null;
function spawn(floor, from) {
  let s = floor.spawn || { pos: [0, 1.6, 7], look: 0 };
  if (from === 'portal') { const st = portals.find(p => p.f.type === 'elevator') || portals[0]; if (st) { const a = (st.f.rot || 0) * Math.PI / 180; s = { pos: [st.f.pos[0] + Math.sin(a) * 2.6, 1.6, st.f.pos[2] + Math.cos(a) * 2.6], look: 180 }; } }
  player.x = s.pos[0]; player.z = s.pos[2];
  // spec "look" is degrees; 0 means looking into the store (toward -z)
  player.yaw = ((s.look || 0) * Math.PI / 180);
  player.pitch = .07; walkTarget = null;
  if (blocked(player.x, player.z)) { const f = freeNear(player.x, player.z); player.x = f[0]; player.z = f[1]; }
}
const R = .32;
function blocked(x, z) {
  if (x < -bounds.w / 2 + R || x > bounds.w / 2 - R || z < -bounds.d / 2 + R || z > bounds.d / 2 - R) return true;
  for (const o of obstacles) if (x > o.x0 - R && x < o.x1 + R && z > o.z0 - R && z < o.z1 + R) return o;
  return false;
}
function freeNear(x, z) {
  for (let r = .3; r < 8; r += .3) for (let a = 0; a < 6.28; a += .4) { const nx = x + Math.cos(a) * r, nz = z + Math.sin(a) * r; if (!blocked(nx, nz)) return [nx, nz]; }
  return [0, 0];
}

// ---------- input ----------
const keys = {};
addEventListener('keydown', e => { if (e.target.closest('input,select,textarea')) return; keys[e.code] = true; if (['ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault(); if (e.code === 'Escape') closePanel(); });
addEventListener('keyup', e => { keys[e.code] = false; });
let drag = null;
canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); drag = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: 0 }; });
canvas.addEventListener('pointermove', e => {
  hover(e);
  if (!drag || drag.id !== e.pointerId) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
  const k = isTouch ? .0055 : .0042;
  player.yaw -= dx * k; player.pitch = Math.max(-1.1, Math.min(.9, player.pitch - dy * k));
  if (drag.moved > 6) hideHint();
});
canvas.addEventListener('pointerup', e => {
  if (!drag || drag.id !== e.pointerId) return;
  const tap = drag.moved < 8 && performance.now() - drag.t < 450; drag = null;
  if (tap) click(e);
});
canvas.addEventListener('wheel', e => { e.preventDefault(); camera.fov = Math.max(35, Math.min(80, camera.fov + e.deltaY * .02)); camera.updateProjectionMatrix(); }, { passive: false });

// touch joystick
const joy = { on: false, x: 0, y: 0 };
const pad = $('#joy'), knob = $('#joy i');
if (pad) {
  const setK = (e) => { const r = pad.getBoundingClientRect(); let x = (e.clientX - r.left - r.width / 2) / (r.width / 2), y = (e.clientY - r.top - r.height / 2) / (r.height / 2); const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; } joy.x = x; joy.y = y; knob.style.transform = `translate(${x * 34}px,${y * 34}px)`; };
  pad.addEventListener('pointerdown', e => { pad.setPointerCapture(e.pointerId); joy.on = true; setK(e); walkTarget = null; hideHint(); });
  pad.addEventListener('pointermove', e => { if (joy.on) setK(e); });
  const end = () => { joy.on = false; joy.x = joy.y = 0; knob.style.transform = ''; };
  pad.addEventListener('pointerup', end); pad.addEventListener('pointercancel', end);
}

const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function pick(e) {
  ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const targets = [...pickables]; if (builderCtx.floorMesh) targets.push(builderCtx.floorMesh);
  const hits = ray.intersectObjects(targets, false).filter(h => h.object.visible !== false || h.object.userData.portal);
  // also hit video screens
  return hits[0];
}
let hovered = null;
const tip = $('#tip');
function hover(e) {
  if (isTouch || drag && drag.moved > 4) return;
  const h = pick(e);
  const pid = h && h.object.userData.product;
  const portal = h && h.object.userData.portal;
  canvas.style.cursor = pid || portal ? 'pointer' : (h && h.object.userData.floor ? 'crosshair' : 'grab');
  if (pid) {
    const p = products.get(pid);
    tip.innerHTML = `<b>${esc(pname(p))}</b><span>${fmt(priceOf(p))}</span>`; tip.style.transform = `translate(${e.clientX + 14}px,${e.clientY + 10}px)`; tip.hidden = false;
  } else if (portal) {
    tip.innerHTML = `<b>${portal === 'elevator' ? t('elevator') : t('stairs')}</b><span>${t('change_floor')}</span>`; tip.style.transform = `translate(${e.clientX + 14}px,${e.clientY + 10}px)`; tip.hidden = false;
  } else tip.hidden = true;
}
let lastHit = null;
function click(e) {
  const h = pick(e); lastHit = h ? { p: h.point, ud: h.object.userData, name: h.object.type } : null; if (!h) return;
  const ud = h.object.userData;
  if (ud.product) { openProduct(ud.product); return; }
  if (ud.portal) { openFloors(); return; }
  if (ud.floor) {
    const p = h.point; if (!blocked(p.x, p.z)) { walkTarget = { x: p.x, z: p.z }; ring(p.x, p.z); }
    else { const f = freeNear(p.x, p.z); walkTarget = { x: f[0], z: f[1] }; ring(f[0], f[1]); }
  }
}
// tap marker
const marker = new THREE.Mesh(new THREE.RingGeometry(.18, .24, 40), new THREE.MeshBasicMaterial({ color: 0x25f4ee, transparent: true, opacity: 0, toneMapped: false, depthWrite: false }));
marker.rotation.x = -Math.PI / 2; marker.position.y = .012; scene.add(marker);
let markerT = 0;
function ring(x, z) { marker.position.x = x; marker.position.z = z; markerT = 1; }

// ---------- loop ----------
const clock = new THREE.Clock();
function step(dt) {
  let fx = 0, fz = 0;
  if (keys.KeyW || keys.ArrowUp) fz += 1; if (keys.KeyS || keys.ArrowDown) fz -= 1;
  if (keys.KeyA) fx -= 1; if (keys.KeyD) fx += 1;
  if (keys.ArrowLeft || keys.KeyQ) player.yaw -= dt * 1.8; if (keys.ArrowRight || keys.KeyE) player.yaw += dt * 1.8;
  if (joy.on) { fz += -joy.y; fx += joy.x * .8; }
  const speed = (keys.ShiftLeft || keys.ShiftRight) ? 3.6 : 2.2;
  const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
  let mx = 0, mz = 0;
  if (fx || fz) { walkTarget = null; mx = (fx * cy + fz * sy); mz = (fx * sy - fz * cy); const m = Math.hypot(mx, mz); if (m > 1) { mx /= m; mz /= m; } }
  else if (walkTarget) {
    const dx = walkTarget.x - player.x, dz = walkTarget.z - player.z, d = Math.hypot(dx, dz);
    if (d < .08) walkTarget = null; else { mx = dx / d * Math.min(1, d * 1.6); mz = dz / d * Math.min(1, d * 1.6); }
  }
  player.vx += (mx * speed - player.vx) * Math.min(1, dt * 9); player.vz += (mz * speed - player.vz) * Math.min(1, dt * 9);
  const nx = player.x + player.vx * dt, nz = player.z + player.vz * dt;
  if (!blocked(nx, player.z)) player.x = nx; else { player.vx = 0; if (walkTarget) walkTarget = null; }
  if (!blocked(player.x, nz)) player.z = nz; else { player.vz = 0; if (walkTarget) walkTarget = null; }
  const sp = Math.hypot(player.vx, player.vz);
  bob += sp * dt * 5.5;
  camera.position.set(player.x, player.eye + Math.sin(bob) * .018 * Math.min(1, sp / 2), player.z);
  camera.rotation.order = 'YXZ'; camera.rotation.y = -player.yaw; camera.rotation.x = -player.pitch; camera.rotation.z = 0;
  // stairs proximity -> floor menu prompt
  const near = portals.find(p => Math.hypot(p.f.pos[0] - player.x, p.f.pos[2] - player.z) < Math.max(p.f.size[0], p.f.size[2]) / 2 + 1.1);
  $('#portalBtn').hidden = !near;
  if (markerT > 0) { markerT = Math.max(0, markerT - dt * 1.4); marker.material.opacity = markerT * .9; marker.scale.setScalar(1 + (1 - markerT) * .6); }
  for (const p of people) p.rotation.y = Math.atan2(camera.position.x - p.position.x, camera.position.z - p.position.z);
  drawMap();
}
let bob = 0;
function loop() {
  const dt = Math.min(.05, clock.getDelta());
  if (started) step(dt);
  if (lite) renderer.render(scene, camera); else composer.render();
  requestAnimationFrame(loop);
}

// ---------- mini map ----------
const map = $('#map'), mg = map.getContext('2d');
function drawMap() {
  if (map.hidden) return;
  const W = map.width, H = map.height, s = Math.min(W / (bounds.w + 1), H / (bounds.d + 1));
  mg.clearRect(0, 0, W, H);
  mg.save(); mg.translate(W / 2, H / 2); mg.scale(s, s);
  mg.fillStyle = 'rgba(255,255,255,.08)'; mg.fillRect(-bounds.w / 2, -bounds.d / 2, bounds.w, bounds.d);
  mg.strokeStyle = 'rgba(255,255,255,.35)'; mg.lineWidth = 1 / s; mg.strokeRect(-bounds.w / 2, -bounds.d / 2, bounds.w, bounds.d);
  mg.fillStyle = '#25f4ee'; mg.fillRect(-bounds.w / 2, bounds.d / 2 - .15, bounds.w, .3);
  for (const o of obstacles) { mg.fillStyle = o.type === 'studio_booth' ? 'rgba(254,44,85,.65)' : o.type === 'stairs' || o.type === 'elevator' ? 'rgba(37,244,238,.6)' : 'rgba(255,255,255,.45)'; mg.fillRect(o.x0, o.z0, o.x1 - o.x0, o.z1 - o.z0); }
  mg.translate(player.x, player.z); mg.rotate(player.yaw);
  mg.fillStyle = 'rgba(37,244,238,.25)'; mg.beginPath(); mg.moveTo(0, 0); mg.arc(0, 0, 3.2, -Math.PI / 2 - .55, -Math.PI / 2 + .55); mg.fill();
  mg.fillStyle = '#fff'; mg.beginPath(); mg.arc(0, 0, .45, 0, 7); mg.fill();
  mg.restore();
}
map.addEventListener('click', e => {
  const r = map.getBoundingClientRect(), s = Math.min(map.width / (bounds.w + 1), map.height / (bounds.d + 1));
  const x = ((e.clientX - r.left) * map.width / r.width - map.width / 2) / s, z = ((e.clientY - r.top) * map.height / r.height - map.height / 2) / s;
  const f = blocked(x, z) ? freeNear(x, z) : [x, z]; player.x = f[0]; player.z = f[1]; walkTarget = null; player.vx = player.vz = 0;
});

// ---------- HUD ----------
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pname = p => (lang === 'ko' && p.dbName) || L(p.name);
function renderHud(store, floor) {
  $('#storeName').textContent = L(store.name);
  $('#floorTitle').textContent = `${floor.level}F · ${L(floor.title)}`;
  document.querySelectorAll('[data-store]').forEach(b => b.classList.toggle('on', b.dataset.store === storeId));
  const fl = $('#floors'); fl.innerHTML = store.floors.slice().sort((a, b) => b.level - a.level).map(f => `<button data-level="${f.level}" class="${f.level === level ? 'on' : ''}"><b>${f.level}F</b><span>${esc(L(f.title))}</span></button>`).join('');
  fl.querySelectorAll('button').forEach(b => b.onclick = () => goFloor(+b.dataset.level));
  $('#cur').value = cur;
}
function applyStatic() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-t]').forEach(el => el.textContent = t(el.dataset.t));
  document.querySelectorAll('[data-t-aria]').forEach(el => el.setAttribute('aria-label', t(el.dataset.tAria)));
  $('#lang').value = lang;
}
let busy = false;
async function goFloor(lv, sid = storeId) {
  if (busy || (lv === level && sid === storeId)) { closeFloors(); return; }
  busy = true; closeFloors(); closePanel();
  const fade = $('#fade'); fade.classList.add('on');
  await new Promise(r => setTimeout(r, 380));
  const portal = sid === storeId; storeId = sid; level = lv;
  if (!portal) cur = storeId === 'tokyo' ? 'JPY' : 'KRW';
  const floor = buildFloor(); spawn(floor, portal && lv > 0 ? 'portal' : undefined);
  if (!portal) spawn(floor);
  await new Promise(r => setTimeout(r, 120));
  fade.classList.remove('on'); busy = false;
  try { history.replaceState(null, '', `#${storeId}-${level}`); } catch (e) { }
}
function openFloors() { $('#floorSheet').classList.add('on'); }
function closeFloors() { $('#floorSheet').classList.remove('on'); }
$('#portalBtn').onclick = openFloors;
$('#floorBtn').onclick = () => $('#floorSheet').classList.toggle('on');
$('#floorSheet').addEventListener('click', e => { if (e.target.id === 'floorSheet') closeFloors(); });
document.querySelectorAll('[data-store]').forEach(b => b.onclick = () => goFloor(1, b.dataset.store));
$('#lang').onchange = e => { lang = e.target.value; try { localStorage.setItem('kj_lang', lang); } catch (_) { } applyStatic(); builder = new FloorBuilder(builderCtx); const pos = { x: player.x, z: player.z, yaw: player.yaw }; buildFloor(); Object.assign(player, pos); if (panelPid) openProduct(panelPid); renderCart(); };
$('#cur').onchange = e => { cur = e.target.value; try { localStorage.setItem('kj_cur', cur); } catch (_) { } for (const p of products.values()) p.price = priceOf(p); builder = new FloorBuilder(builderCtx); const pos = { x: player.x, z: player.z, yaw: player.yaw }; buildFloor(); Object.assign(player, pos); if (panelPid) openProduct(panelPid); renderCart(); };
$('#mapBtn').onclick = () => { map.hidden = !map.hidden; $('#mapBtn').classList.toggle('on', !map.hidden); };

// ---------- product panel ----------
let panelPid = null;
function parseOpts(s) { if (!s) return []; return String(s).split('|').map(g => { const [n, v] = g.split(':'); if (!v) return null; return { name: n.trim(), values: v.split(',').map(x => x.trim()).filter(Boolean) }; }).filter(Boolean); }
function openProduct(pid) {
  const p = products.get(pid); if (!p) return; panelPid = pid;
  const price = priceOf(p), list = listOf(p), disc = list > price ? Math.round((1 - price / list) * 100) : 0;
  const opts = parseOpts(p.options);
  const detail = (lang === 'ko' && (p.detail_db || p.detail_ko)) || p.detail_ko || '';
  $('#pp').innerHTML = `
    <button class="pp-x" data-close aria-label="${t('close')}">×</button>
    <div class="pp-img"><img src="${esc(p.image)}" alt=""></div>
    <div class="pp-body">
      <div class="pp-brand">${esc(p.brand || '')}${p.badge ? `<em class="b-${esc(p.badge)}">${esc(p.badge)}</em>` : ''}</div>
      <h3>${esc(pname(p))}</h3>
      <div class="pp-meta">★ ${esc(p.rating || '4.8')} · ${t('sold')} ${Number(p.sold || 0).toLocaleString()}</div>
      <div class="pp-price">${disc ? `<s>${fmt(list)}</s><b class="disc">${disc}%</b>` : ''}<strong>${fmt(price)}</strong></div>
      ${detail ? `<p class="pp-desc">${esc(detail)}</p>` : ''}
      ${opts.map((o, i) => `<label class="pp-opt"><span>${esc(o.name)}</span><select data-opt="${i}"><option value="">${t('choose')}</option>${o.values.map(v => `<option>${esc(v)}</option>`).join('')}</select></label>`).join('')}
      <div class="pp-qty"><span>${t('qty')}</span><button data-q="-1">−</button><output id="ppq">1</output><button data-q="1">+</button></div>
      <div class="pp-msg" id="ppmsg" role="status"></div>
      <div class="pp-cta"><button class="ghost" data-add>${t('add_cart')}</button><button class="primary" data-buy>${t('buy_now')}</button></div>
      ${p.db ? '' : `<p class="pp-note">${t('not_listed')}</p>`}
    </div>`;
  $('#ppWrap').classList.add('on'); $('#ppWrap').setAttribute('aria-hidden', 'false');
}
function closePanel() { panelPid = null; $('#ppWrap').classList.remove('on'); $('#ppWrap').setAttribute('aria-hidden', 'true'); }
$('#ppWrap').addEventListener('click', e => {
  if (e.target.id === 'ppWrap' || e.target.closest('[data-close]')) return closePanel();
  const q = e.target.closest('[data-q]'); if (q) { const o = $('#ppq'); o.textContent = Math.max(1, Math.min(99, +o.textContent + +q.dataset.q)); return; }
  const add = e.target.closest('[data-add]'), buy = e.target.closest('[data-buy]');
  if (add || buy) {
    const p = products.get(panelPid); const sels = [...document.querySelectorAll('#pp [data-opt]')];
    if (sels.some(s => !s.value)) { $('#ppmsg').textContent = t('pick_option'); return; }
    if (!p.db) { $('#ppmsg').textContent = t('not_listed'); return; }
    const od = parseOpts(p.options); const opt = sels.map((s, i) => (od[i] ? od[i].name + ': ' : '') + s.value).join(' / ');
    addToCart(p.db, +$('#ppq').textContent, opt);
    if (buy) { location.href = BASE + 'mall.html#checkout'; return; }
    $('#ppmsg').textContent = t('added'); renderCart(); bump();
  }
});
// cart shared with mall.html (localStorage kj_cart)
const CK = 'kj_cart';
const loadCart = () => { try { const a = JSON.parse(localStorage.getItem(CK) || '[]'); return Array.isArray(a) ? a.filter(x => x && x.productId && x.qty > 0) : []; } catch (e) { return []; } };
function addToCart(id, qty, optLabel) { const a = loadCart(); const key = id + '|' + optLabel; const ex = a.find(x => x.lineId === key); if (ex) ex.qty = Math.min(999, ex.qty + qty); else a.push({ lineId: key, productId: id, optionLabel: optLabel, qty }); try { localStorage.setItem(CK, JSON.stringify(a.slice(0, 50))); } catch (e) { } }
function renderCart() { const n = loadCart().reduce((s, x) => s + x.qty, 0); $('#cartN').textContent = n; $('#cartN').hidden = !n; }
function bump() { const c = $('#cartBtn'); c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); }
addEventListener('storage', e => { if (e.key === CK) renderCart(); });

// ---------- hint ----------
function hideHint() { const h = $('#hint'); if (h && !h.hidden) { h.classList.add('off'); setTimeout(() => h.hidden = true, 400); } }

// ---------- start ----------
let started = false;
async function enter(sid) {
  $('#intro').classList.add('off');
  videoEls.forEach(v => { const p = v.play(); if (p) p.catch(() => { }); });
  storeId = sid; cur = sid === 'tokyo' ? 'JPY' : 'KRW'; level = 1;
  const floor = buildFloor(); spawn(floor); started = true;
  $('#hud').hidden = false;
  setTimeout(() => $('#intro').hidden = true, 600);
  try { history.replaceState(null, '', `#${storeId}-1`); } catch (e) { }
  setTimeout(hideHint, 9000);
}
async function init() {
  applyStatic(); resize();
  spec = await (await fetch(new URL('./spec.json', import.meta.url))).json();
  await loadProducts();
  renderCart();
  document.querySelectorAll('[data-enter]').forEach(b => { b.disabled = false; b.onclick = () => enter(b.dataset.enter); });
  $('#introLoading').hidden = true;
  const m = location.hash.match(/^#(seoul|tokyo)(?:-(\d))?/);
  if (m) { level = +(m[2] || 1); }
  loop();
  window.__tour = { player, goFloor, products, get level() { return level; }, get store() { return storeId; }, openProduct, renderer, enter, dbg: () => ({ walkTarget, hit: lastHit }), pickables: () => pickables, camera };
}
init();
