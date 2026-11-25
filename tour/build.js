// Builds one floor (room shell + fixtures) from the GPT spec.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { surface, radialShadow, boxShadow, textTex, screenTex, priceTag, cutout } from './tex.js';

const D2R = Math.PI / 180;
const col = c => new THREE.Color(c && /^#?[0-9a-f]{3,8}$/i.test(String(c).replace('#', '')) ? (String(c)[0] === '#' ? c : '#' + c) : '#888888');

export class FloorBuilder {
  constructor(ctx) {
    this.ctx = ctx; // {lang, products(Map), fmtPrice(p), videos{key:VideoTexture}, store, lite}
    this.mats = new Map();
    this.places = [];
  }
  mat(kind, color, extra = {}) {
    const key = kind + col(color).getHexString() + JSON.stringify(extra);
    if (this.mats.has(key)) return this.mats.get(key);
    const c = col(color);
    let m;
    switch (kind) {
      case 'gloss': m = new THREE.MeshPhysicalMaterial({ color: c, roughness: .18, metalness: 0, clearcoat: .6, clearcoatRoughness: .12, ...extra }); break;
      case 'metal': m = new THREE.MeshStandardMaterial({ color: c, roughness: .32, metalness: .9, ...extra }); break;
      case 'chrome': m = new THREE.MeshStandardMaterial({ color: c, roughness: .08, metalness: 1, ...extra }); break;
      case 'glass': m = new THREE.MeshPhysicalMaterial({ color: c, roughness: .03, metalness: 0, transmission: this.ctx.lite ? 0 : .92, transparent: true, opacity: this.ctx.lite ? .18 : 1, thickness: .02, ior: 1.45, depthWrite: false, ...extra }); break;
      case 'wood': { const s = surface('light_oak', c, 11); m = new THREE.MeshStandardMaterial({ map: s.map, roughness: .55, ...extra }); break; }
      case 'fabric': m = new THREE.MeshStandardMaterial({ color: c, roughness: .95, ...extra }); break;
      case 'emit': m = new THREE.MeshBasicMaterial({ color: c, toneMapped: false, ...extra }); break;
      default: m = new THREE.MeshStandardMaterial({ color: c, roughness: .62, metalness: 0, ...extra });
    }
    this.mats.set(key, m); return m;
  }
  box(w, h, d, m, r = 0) {
    const g = r > 0 ? new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2 - .001, h / 2 - .001, d / 2 - .001)) : new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(g, m); mesh.castShadow = false; mesh.receiveShadow = true; return mesh;
  }
  at(obj, x, y, z) { obj.position.set(x, y, z); return obj; }
  plane(w, h, m) { return new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); }
  L(v) { if (!v) return ''; if (typeof v === 'string') return v; return v[this.ctx.lang] || v.en || v.ko || Object.values(v)[0] || ''; }

  contact(group, w, d, round = false, strength = 1) {
    const m = new THREE.MeshBasicMaterial({ map: round ? radialShadow() : boxShadow(), transparent: true, depthWrite: false, opacity: .85 * strength, color: 0x000000 });
    const p = this.plane(w * 1.35 + .25, d * 1.35 + .25, m); p.rotation.x = -Math.PI / 2; p.position.y = .004; p.renderOrder = 1; group.add(p);
  }

  sign(text, { h = .3, color = '#fff', glow = 0, bg = null, font, sub, subColor } = {}) {
    const t = textTex(text, { color, glow, bg, font, sub, subColor });
    const m = new THREE.MeshBasicMaterial({ map: t.tex, transparent: !bg, toneMapped: !glow, depthWrite: !!bg });
    if (glow) m.color.setScalar(1.6);
    const p = this.plane(h * t.aspect, h, m); p.userData.signAspect = t.aspect; return p;
  }

  // ---------- products ----------
  prodHeight(p) {
    const c = (p && p.category) || '';
    return { skincare: .17, makeup: .12, haircare: .26, fashion: .38, food: .24, tech: .19, home: .28, goods: .14 }[c] || .18;
  }
  // place products along a row: centered at local origin, facing +z, on y=0 surface
  productRow(parent, ids, width, opts = {}) {
    const list = (ids || []).map(id => this.ctx.products.get(id)).filter(Boolean);
    if (!list.length) return;
    // retail-style dense merchandising: fill the run by cycling products, 2-3 facings each
    const sc = opts.scale || 1;
    const gap = (opts.minGap || .16) * Math.max(.8, sc);
    const n = Math.max(1, Math.floor(width / gap));
    const fill = opts.sparse ? Math.min(n, list.length) : n;
    const per = opts.sparse ? 1 : Math.max(1, Math.round(fill / list.length));
    const step = width / fill;
    for (let i = 0; i < fill; i++) {
      const p = list[Math.floor(i / per) % list.length];
      const x = -width / 2 + step * (i + .5);
      const first = i % per === 0;
      this.product(parent, p, x, 0, opts.z || 0, { scale: sc, tag: first && opts.tags !== false });
      if (opts.depth !== false && !opts.sparse && this.prodHeight(p) < .3) this.product(parent, p, x, 0, (opts.z || 0) - .1, { scale: sc, tag: false, pick: false });
    }
  }
  product(parent, p, x, y, z, { scale = 1, tag = true, rotY = 0, pick = true } = {}) {
    // placeholder only; real geometry is instanced per product in finalize()
    const holder = new THREE.Object3D(); holder.position.set(x, y, z); holder.rotation.y = rotY;
    holder.userData.place = { id: p.id, h: this.prodHeight(p) * scale, tag, pick };
    parent.add(holder); this.places.push(holder);
    return holder;
  }
  finalize(root) {
    root.updateMatrixWorld(true);
    const byId = new Map();
    for (const h of this.places) { const u = h.userData.place; if (!byId.has(u.id)) byId.set(u.id, []); byId.get(u.id).push(h); }
    const shadowList = this.places;
    const shGeo = new THREE.PlaneGeometry(1, 1); shGeo.rotateX(-Math.PI / 2);
    const sh = new THREE.InstancedMesh(shGeo, new THREE.MeshBasicMaterial({ map: radialShadow(), transparent: true, depthWrite: false, color: 0, opacity: .55 }), Math.max(1, shadowList.length));
    sh.renderOrder = 1; root.add(sh);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), pos = new THREE.Vector3();
    const shIndex = new Map(); shadowList.forEach((h, i) => shIndex.set(h, i));
    const setShadow = (h, w) => { h.matrixWorld.decompose(pos, q, sc); m4.compose(v.set(pos.x, pos.y + .003, pos.z), q, sc.set(w * 1.1, 1, Math.max(.05, w * .5))); sh.setMatrixAt(shIndex.get(h), m4); sh.instanceMatrix.needsUpdate = true; };
    for (const [id, list] of byId) {
      const p = this.ctx.products.get(id);
      const geo = new THREE.PlaneGeometry(1, 1); geo.translate(0, .5, 0);
      const mat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: .4, transparent: true, opacity: .0, side: THREE.DoubleSide });
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      im.userData.product = id; im.frustumCulled = false;
      const apply = (aspect) => {
        list.forEach((h, i) => {
          const u = h.userData.place; let w = u.h * aspect, hh = u.h; if (w > u.h * 1.6) { w = u.h * 1.6; hh = w / aspect; }
          h.matrixWorld.decompose(pos, q, sc); m4.compose(v.set(pos.x, pos.y + .002, pos.z), q, sc.set(w, hh, 1)); im.setMatrixAt(i, m4);
          setShadow(h, w);
        });
        im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere();
      };
      apply(1);
      root.add(im);
      if (list.some(h => h.userData.place.pick)) this.ctx.pickables.push(im);
      cutout(p.image).then(r => {
        if (!r) { mat.opacity = 1; mat.transparent = false; mat.needsUpdate = true; return; }
        im.material = new THREE.MeshStandardMaterial({ map: r.tex, transparent: true, alphaTest: .35, roughness: .35, metalness: 0, side: THREE.DoubleSide, envMapIntensity: .5 });
        apply(r.aspect || 1);
      });
      // price tags (front-row only)
      const tagged = list.filter(h => h.userData.place.tag);
      if (tagged.length && p.price != null) {
        const tg = new THREE.PlaneGeometry(.11, .041);
        const ti = new THREE.InstancedMesh(tg, new THREE.MeshStandardMaterial({ map: priceTag(this.ctx.fmtPrice(p), p.badge), roughness: .5 }), tagged.length);
        const rx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -.25);
        tagged.forEach((h, i) => { h.matrixWorld.decompose(pos, q, sc); const off = new THREE.Vector3(0, -.026, .03).applyQuaternion(q); m4.compose(v.set(pos.x + off.x, pos.y + off.y, pos.z + off.z), q.clone().multiply(rx), sc.set(1, 1, 1)); ti.setMatrixAt(i, m4); });
        ti.instanceMatrix.needsUpdate = true; ti.computeBoundingSphere(); ti.userData.product = id; root.add(ti); this.ctx.pickables.push(ti);
      }
    }
    sh.computeBoundingSphere();
    this.places = [];
  }

  // ---------- room shell ----------
  room(floor, store, level, total) {
    const g = new THREE.Group();
    const [W, Dp] = floor.size || [26, 18]; const H = floor.height || 4.5;
    const fm = floor.floor_material || {}, wm = floor.wall_material || {}, cm = floor.ceiling || {};
    const fs = surface(fm.pattern || 'polished_concrete', fm.color || '#bdbab4', 3);
    const fmap = fs.map.clone(), frm = fs.roughnessMap.clone(); fmap.needsUpdate = frm.needsUpdate = true;
    fmap.repeat.set(W / fs.tile, Dp / fs.tile); frm.repeat.copy(fmap.repeat);
    const floorMat = new THREE.MeshStandardMaterial({ map: fmap, roughnessMap: frm, roughness: Math.min(1, (fm.roughness ?? .35) * 1.6 + .05), metalness: fm.metalness ?? 0, envMapIntensity: 1.1 });
    const fl = this.plane(W, Dp, floorMat); fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true; fl.userData.floor = true; g.add(fl);
    this.ctx.floorMesh = fl;

    const ws = surface(wm.pattern || 'white_plaster', wm.color || '#e9e6e1', 5);
    const wallMat = (len) => { const m = ws.map.clone(), r = ws.roughnessMap.clone(); m.needsUpdate = r.needsUpdate = true; m.repeat.set(len / ws.tile, H / ws.tile); r.repeat.copy(m.repeat); return new THREE.MeshStandardMaterial({ map: m, roughnessMap: r, roughness: Math.max(.3, wm.roughness ?? .8), metalness: wm.pattern === 'black_metal' ? .5 : 0 }); };
    // back wall
    const back = this.plane(W, H, wallMat(W)); back.position.set(0, H / 2, -Dp / 2); g.add(back);
    const left = this.plane(Dp, H, wallMat(Dp)); left.rotation.y = Math.PI / 2; left.position.set(-W / 2, H / 2, 0); g.add(left);
    const right = this.plane(Dp, H, wallMat(Dp)); right.rotation.y = -Math.PI / 2; right.position.set(W / 2, H / 2, 0); g.add(right);
    // skirting
    const sk = this.mat('matte', '#1a1a1a');
    [[0, -Dp / 2 + .01, W, 0], [-W / 2 + .01, 0, Dp, 1], [W / 2 - .01, 0, Dp, 1]].forEach(([x, z, l, r]) => { const b = this.box(r ? .02 : l, .09, r ? l : .02, sk); b.position.set(x, .045, z); g.add(b); });

    // front: glass storefront with mullions + city view
    const glass = this.plane(W, H, new THREE.MeshPhysicalMaterial({ color: 0xdfeff2, roughness: .02, transmission: 0, transparent: true, opacity: .12, metalness: .2, depthWrite: false }));
    glass.position.set(0, H / 2, Dp / 2); glass.rotation.y = Math.PI; g.add(glass);
    const mull = this.mat('metal', '#141414');
    for (let x = -W / 2; x <= W / 2 + .01; x += W / 8) { const b = this.box(.07, H, .1, mull); b.position.set(x, H / 2, Dp / 2); g.add(b); }
    [0.03, H - .05, level === 1 ? 2.9 : 1.05].forEach(y => { const b = this.box(W, .06, .1, mull); b.position.set(0, y, Dp / 2); g.add(b); });
    const view = this.ctx.viewTex[level === 1 ? 'street' : 'sky'];
    if (view) {
      const vm = new THREE.MeshBasicMaterial({ map: view, toneMapped: true }); vm.color.setScalar(level === 1 ? .95 : 1.05);
      const vw = W * 1.7, vh = vw * 9 / 16;
      const v = this.plane(vw, vh, vm); v.position.set(0, level === 1 ? vh * .36 : vh * .3, Dp / 2 + 7); v.rotation.y = Math.PI; g.add(v);
    }
    // ceiling
    const ceilColor = cm.color || '#222';
    const ceil = this.plane(W, Dp, new THREE.MeshStandardMaterial({ color: col(ceilColor), roughness: .9 })); ceil.rotation.x = Math.PI / 2; ceil.position.y = H; g.add(ceil);
    const type = cm.type || 'flat';
    if (type === 'open_grid' || type === 'exposed_duct') {
      const bar = this.mat('metal', '#1b1b1b');
      for (let x = -W / 2 + 1.5; x < W / 2; x += 3) { const b = this.box(.06, .06, Dp, bar); b.position.set(x, H - .55, 0); g.add(b); }
      for (let z = -Dp / 2 + 1.5; z < Dp / 2; z += 3) { const b = this.box(W, .06, .06, bar); b.position.set(0, H - .55, z); g.add(b); }
      if (type === 'exposed_duct') { const dm = this.mat('metal', '#3c3f43'); [-4, 5].forEach(z => { const c = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, W, 24, 1, true), dm); c.rotation.z = Math.PI / 2; c.position.set(0, H - .35, z); g.add(c); }); }
      // track lights
      const lampM = this.mat('matte', '#111'), lensM = this.mat('emit', '#fff6e8');
      for (let x = -W / 2 + 3; x < W / 2 - 1; x += 3) for (let z = -Dp / 2 + 3; z < Dp / 2 - 1; z += 3) {
        const l = new THREE.Mesh(new THREE.CylinderGeometry(.05, .06, .16, 12), lampM); l.position.set(x + .4, H - .66, z); l.rotation.x = .35; g.add(l);
        const ln = new THREE.Mesh(new THREE.CircleGeometry(.045, 12), lensM); ln.position.set(x + .4, H - .745, z + .03); ln.rotation.x = Math.PI / 2 + .35; g.add(ln);
      }
    } else if (type === 'baffles') {
      const bm = this.mat('wood', '#c9a77c');
      for (let x = -W / 2 + .3; x < W / 2; x += .45) { const b = this.box(.07, .35, Dp, bm); b.position.set(x, H - .2, 0); g.add(b); }
      const lm = this.mat('emit', '#fff7ea');
      for (let z = -Dp / 2 + 2; z < Dp / 2; z += 3.5) { const b = this.box(W - 1, .03, .12, lm); b.position.set(0, H - .4, z); g.add(b); }
    } else {
      const lm = this.mat('emit', '#fffaf2');
      for (let x = -W / 2 + 2.2; x < W / 2 - 1; x += 3.2) for (let z = -Dp / 2 + 2; z < Dp / 2 - 1; z += 3) { const c = new THREE.Mesh(new THREE.CircleGeometry(.09, 20), lm); c.rotation.x = Math.PI / 2; c.position.set(x, H - .005, z); g.add(c); }
      // linear light slots
      for (let x = -W / 2 + 4; x < W / 2; x += 9) { const b = this.box(.08, .01, Dp - 3, lm); b.position.set(x, H - .006, 0); g.add(b); }
    }
    return g;
  }

  // ---------- fixtures ----------
  fixture(f) {
    const g = new THREE.Group();
    const [x, , z] = f.pos || [0, 0, 0];
    g.position.set(x || 0, 0, z || 0); g.rotation.y = (f.rot || 0) * D2R;
    let [w, h, d] = f.size || [1, 1, 1]; w = Math.max(.05, +w || 1); h = Math.max(.02, +h || 1); d = Math.max(.02, +d || 1);
    if (f.type === 'studio_booth' && d > w) [w, d] = [d, w]; // live booths face the aisle with their long glass side
    const color = f.color || '#ffffff', mk = f.material || 'matte';
    const fn = this['f_' + f.type] || this.f_generic;
    fn.call(this, g, f, w, h, d, color, mk);
    g.userData.fixture = f;
    return g;
  }
  baseMat(mk, color) { return this.mat(mk === 'gloss' ? 'gloss' : mk === 'metal' ? 'metal' : mk === 'wood' ? 'wood' : mk === 'fabric' ? 'fabric' : mk === 'glass' ? 'glass' : 'matte', color); }
  label(g, f, w, h, d, y, opt = {}) {
    const txt = f.text || this.L(f.label);
    if (!txt) return;
    const s = this.sign(txt, { h: opt.h || Math.min(.2, Math.max(.09, w * .05)), color: opt.color || '#111', bg: opt.bg || null, glow: opt.glow || 0, font: opt.font });
    const maxW = w * .92; if (s.geometry.parameters.width > maxW) s.scale.setScalar(maxW / s.geometry.parameters.width);
    s.position.set(0, y, d / 2 + .012); g.add(s);
  }

  f_generic(g, f, w, h, d, color, mk) { const b = this.box(w, h, d, this.baseMat(mk, color), .02); b.position.y = h / 2; g.add(b); this.contact(g, w, d); this.productsOnTop(g, f, w, h, d); }
  productsOnTop(g, f, w, h, d, rows = 0) {
    if (!f.products || !f.products.length) return;
    const nRows = rows || (d > .9 ? 2 : 1);
    const per = Math.ceil(f.products.length / nRows);
    for (let r = 0; r < nRows; r++) {
      const row = new THREE.Group(); row.position.set(0, h, nRows === 1 ? 0 : (r - (nRows - 1) / 2) * (d * .42)); g.add(row);
      const ids = f.products.slice(r * per, r * per + per);
      this.productRow(row, ids, w * .86, { minGap: .16, scale: 1.2 });
      if (nRows > 1 && r === 0) row.rotation.y = Math.PI; // back row faces the other aisle
    }
  }

  f_island_table(g, f, w, h, d, color, mk) {
    const top = this.box(w, .06, d, this.baseMat(mk === 'matte' ? 'gloss' : mk, color), .025); top.position.y = h - .03; g.add(top);
    const base = this.box(w * .82, h - .06, d * .7, this.mat('matte', mk === 'wood' ? '#2a2420' : '#e9e7e3'), .02); base.position.y = (h - .06) / 2; g.add(base);
    const strip = this.box(w * .82 + .01, .015, d * .7 + .01, this.mat('emit', '#ffffff')); strip.position.y = .06; g.add(strip);
    // risers
    const rm = this.mat('gloss', '#ffffff');
    [-.28, .28].forEach((k, i) => { const r = this.box(w * .28, .12 + i * .08, d * .32, rm, .01); r.position.set(k * w, h + (.12 + i * .08) / 2, 0); g.add(r); });
    this.contact(g, w, d);
    this.productsOnTop(g, f, w, h, d);
    this.label(g, f, w, h, d, h - .2, { color: '#111' });
  }
  f_podium(g, f, w, h, d, color, mk) {
    const r = Math.min(w, d) / 2;
    const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 48), this.baseMat(mk === 'matte' ? 'gloss' : mk, color)); c.position.y = h / 2; g.add(c);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r + .002, .008, 8, 64), this.mat('emit', '#25f4ee')); ring.rotation.x = Math.PI / 2; ring.position.y = h - .02; g.add(ring);
    this.contact(g, w, d, true);
    const ids = f.products || []; const row = new THREE.Group(); row.position.y = h; g.add(row);
    if (ids.length === 1) { const p = this.ctx.products.get(ids[0]); if (p) this.product(row, p, 0, 0, 0, { scale: 1.6 }); }
    else this.productRow(row, ids, r * 1.5, { minGap: .2, scale: 1.25, sparse: true });
    const spot = new THREE.Mesh(new THREE.CylinderGeometry(r * .9, r * 1.2, .01, 32), this.mat('emit', '#ffffff', { transparent: true, opacity: .12 })); spot.position.y = 3.9; g.add(spot);
  }
  f_wall_shelf(g, f, w, h, d, color, mk) {
    const back = this.box(w, h, .04, this.baseMat(mk, color)); back.position.set(0, h / 2, -d / 2 + .02); g.add(back);
    const sideM = this.mat(mk === 'wood' ? 'wood' : 'matte', mk === 'wood' ? color : '#1a1a1a');
    [-w / 2, w / 2].forEach(x => { const s = this.box(.04, h, d, sideM); s.position.set(x, h / 2, 0); g.add(s); });
    const plinth = this.box(w, .12, d, this.mat('matte', '#151515')); plinth.position.y = .06; g.add(plinth);
    const shelves = Math.max(4, Math.min(8, Math.round(h / .34)));
    const ids = f.products || [];
    const per = Math.max(1, Math.ceil(ids.length / (shelves - 1)));
    const sm = this.mat('gloss', '#ffffff'), led = this.mat('emit', '#fff9ef');
    for (let i = 1; i < shelves; i++) {
      const y = .12 + (h - .45) * i / (shelves - 1) - .2;
      const s = this.box(w - .08, .025, d - .05, sm); s.position.set(0, y, .01); g.add(s);
      const l = this.box(w - .1, .008, .02, led); l.position.set(0, y - .016, d / 2 - .06); g.add(l);
      const row = new THREE.Group(); row.position.set(0, y + .013, .02); g.add(row);
      let list = ids.slice(((i - 1) * per) % Math.max(1, ids.length), ((i - 1) * per) % Math.max(1, ids.length) + per);
      if (!list.length) list = ids.slice(0, per);
      this.productRow(row, list, w - .2, { minGap: .17, scale: 1.3 });
    }
    // header sign
    const txt = f.text || this.L(f.label);
    if (txt) { const s = this.sign(txt, { h: .16, color: '#111' }); const mw = w * .8; if (s.geometry.parameters.width > mw) s.scale.setScalar(mw / s.geometry.parameters.width); s.position.set(0, h - .12, -d / 2 + .045); g.add(s); }
    this.contact(g, w, d);
  }
  f_gondola(g, f, w, h, d, color, mk) {
    const spine = this.box(w, h, .05, this.baseMat(mk, color)); spine.position.y = h / 2; g.add(spine);
    const ends = this.mat('matte', '#161616');
    [-w / 2, w / 2].forEach(x => { const s = this.box(.04, h, d, ends); s.position.set(x, h / 2, 0); g.add(s); });
    const plinth = this.box(w, .1, d, ends); plinth.position.y = .05; g.add(plinth);
    const ids = f.products || []; const levels = Math.max(2, Math.min(4, Math.round(h / .4)));
    const half = Math.ceil(ids.length / 2);
    [1, -1].forEach((side, si) => {
      const sideIds = si ? ids.slice(half) : ids.slice(0, half); const use = sideIds.length ? sideIds : ids;
      for (let i = 0; i < levels; i++) {
        const y = .1 + (h - .3) * (i + .2) / levels;
        const s = this.box(w - .06, .022, d / 2 - .04, this.mat('gloss', '#ffffff')); s.position.set(0, y, side * d / 4); g.add(s);
        const row = new THREE.Group(); row.position.set(0, y + .011, side * d / 4); if (side < 0) row.rotation.y = Math.PI; g.add(row);
        const per = Math.max(1, Math.ceil(use.length / levels));
        let list = use.slice(i * per, i * per + per); if (!list.length) list = use.slice(0, per);
        this.productRow(row, list, w - .16, { minGap: .17, scale: 1.25 });
      }
    });
    const txt = f.text || this.L(f.label);
    if (txt) [1, -1].forEach(side => { const s = this.sign(txt, { h: .14, color: '#fff', bg: '#111' }); const mw = w * .7; if (s.geometry.parameters.width > mw) s.scale.setScalar(mw / s.geometry.parameters.width); s.position.set(0, h + .12, 0); s.rotation.y = side < 0 ? Math.PI : 0; s.position.z = side * .03; g.add(s); });
    this.contact(g, w, d);
  }
  f_display_case(g, f, w, h, d, color, mk) {
    const base = this.box(w, h * .55, d, this.mat('gloss', color || '#fff'), .01); base.position.y = h * .275; g.add(base);
    const glass = this.box(w, h * .45, d, this.mat('glass', '#ffffff')); glass.position.y = h * .55 + h * .225; g.add(glass);
    const row = new THREE.Group(); row.position.y = h * .55 + .005; g.add(row);
    this.productRow(row, f.products, w * .85, { minGap: .16 });
    const pl = new THREE.PointLight(0xfff4e6, .6, 1.6); pl.position.set(0, h - .05, 0); if (!this.ctx.lite) g.add(pl);
    this.contact(g, w, d);
    this.label(g, f, w, h, d, h * .3, { color: '#111' });
  }
  f_tester_bar(g, f, w, h, d, color, mk) {
    const counter = this.box(w, h, d, this.mat('gloss', color || '#f4f2ee'), .02); counter.position.y = h / 2; g.add(counter);
    const top = this.box(w + .04, .03, d + .04, this.mat('gloss', '#ffffff'), .01); top.position.y = h + .015; g.add(top);
    // mirrors with bulbs
    const n = Math.max(2, Math.round(w / 1.1));
    for (let i = 0; i < n; i++) {
      const mx = -w / 2 + w * (i + .5) / n;
      const mirror = this.box(.55, .7, .02, this.mat('chrome', '#d8dde0')); mirror.position.set(mx, h + .5, -d / 2 + .05); g.add(mirror);
      const frame = new THREE.Mesh(new THREE.TorusGeometry(.0, .0, 2, 3)); frame.visible = false;
      for (let k = 0; k < 6; k++) { const bulb = new THREE.Mesh(new THREE.SphereGeometry(.018, 10, 8), this.mat('emit', '#fff3dc')); const a = k < 3; bulb.position.set(mx + (a ? -.3 : .3), h + .25 + (k % 3) * .25, -d / 2 + .06); g.add(bulb); }
    }
    const row = new THREE.Group(); row.position.set(0, h + .03, d * .12); g.add(row);
    this.productRow(row, f.products, w * .9, { minGap: .16 });
    this.contact(g, w, d);
    this.label(g, f, w, h, d, h - .18, { color: '#111' });
  }
  f_vanity_mirror(g, f, w, h, d, color) {
    const frame = this.box(w, h, .05, this.mat('matte', color || '#111')); frame.position.set(0, h / 2 + .9, 0); g.add(frame);
    const m = this.box(w - .1, h - .1, .01, this.mat('chrome', '#cfd6da')); m.position.set(0, h / 2 + .9, .03); g.add(m);
    const nb = Math.max(4, Math.round(h / .18));
    for (let i = 0; i < nb; i++) [-1, 1].forEach(s => { const b = new THREE.Mesh(new THREE.SphereGeometry(.024, 10, 8), this.mat('emit', '#fff1d6')); b.position.set(s * (w / 2 - .04), .95 + i * (h - .1) / (nb - 1), .05); g.add(b); });
    const desk = this.box(w + .1, .04, .4, this.mat('gloss', '#ffffff')); desk.position.set(0, .88, .2); g.add(desk);
    const row = new THREE.Group(); row.position.set(0, .9, .22); g.add(row); this.productRow(row, f.products, w * .8, { sparse: true, minGap: .22 });
  }
  f_counter(g, f, w, h, d, color, mk) { this.f_checkout(g, f, w, h, d, color, mk, false); }
  f_checkout(g, f, w, h, d, color, mk, pos = true) {
    const body = this.box(w, h, d, this.baseMat(mk === 'matte' ? 'gloss' : mk, color || '#111'), .02); body.position.y = h / 2; g.add(body);
    const top = this.box(w + .06, .04, d + .06, this.mat('gloss', '#f6f6f6'), .01); top.position.y = h + .02; g.add(top);
    const strip = this.box(w, .02, .01, this.mat('emit', '#fe2c55')); strip.position.set(0, .12, d / 2 + .006); g.add(strip);
    const strip2 = this.box(w, .02, .01, this.mat('emit', '#25f4ee')); strip2.position.set(0, .16, d / 2 + .006); g.add(strip2);
    const logo = this.sign('TikTok Shop', { h: .16, color: '#ffffff' }); logo.position.set(0, h * .62, d / 2 + .012); g.add(logo);
    // POS screens
    const n = Math.max(1, Math.round(w / 1.4));
    for (let i = 0; i < n; i++) {
      const sx = -w / 2 + w * (i + .5) / n;
      const st = this.box(.04, .22, .04, this.mat('metal', '#bbb')); st.position.set(sx, h + .13, 0); g.add(st);
      const scr = this.box(.36, .24, .02, this.mat('matte', '#111')); scr.position.set(sx, h + .3, .02); scr.rotation.x = -.2; g.add(scr);
      const face = this.plane(.33, .21, new THREE.MeshBasicMaterial({ map: screenTex('pos', this.L(f.label) || ''), toneMapped: false })); face.position.set(sx, h + .3, .032); face.rotation.x = -.2; g.add(face);
    }
    if (f.products && f.products.length) { const row = new THREE.Group(); row.position.set(0, h + .04, d * .28); g.add(row); this.productRow(row, f.products, w * .5, { minGap: .15, scale: .8, sparse: true }); }
    // shopping bags
    const bm = this.mat('matte', '#111');
    for (let i = 0; i < 3; i++) { const b = this.box(.28, .34, .12, bm); b.position.set(w / 2 - .25 - i * .32, h + .21, -d / 3); g.add(b); }
    this.contact(g, w, d);
  }
  f_led_wall(g, f, w, h, d, color) {
    const frame = this.box(w + .08, h + .08, Math.max(.08, d), this.mat('matte', '#0b0b0b')); frame.position.y = h / 2 + (f.pos?.[1] || 0); g.add(frame);
    const y0 = (f.pos?.[1] || 0);
    const vt = this.ctx.videos[f.video || 'hero'] || this.ctx.videos.hero;
    const scr = this.plane(w, h, new THREE.MeshBasicMaterial({ map: vt, toneMapped: false }));
    scr.material.color.setScalar(1.15);
    scr.position.set(0, h / 2 + y0, Math.max(.08, d) / 2 + .005); scr.userData.video = f.video || 'hero'; scr.userData.fixtureLabel = this.L(f.label); g.add(scr);
    if (y0 < .2) { const pl = this.box(w + .1, .12, Math.max(.3, d), this.mat('matte', '#111')); pl.position.y = .06; g.add(pl); }
    // light spill
    if (!this.ctx.lite) { const rl = new THREE.PointLight(0xbfe8ff, 1.2, Math.max(4, w * 1.2), 1.8); rl.position.set(0, h / 2 + y0, 1.2); g.add(rl); }
    const txt = f.text;
    if (txt) { const s = this.sign(txt, { h: Math.min(.4, h * .12), color: '#fff', glow: 14 }); s.position.set(0, h + y0 + .3, .05); g.add(s); }
  }
  f_studio_booth(g, f, w, h, d, color) {
    const H = Math.min(h, 3.2);
    const wallM = this.mat('matte', '#141414'); const back = new THREE.Color(color || '#1b1b1b');
    // shell: back, sides, roof
    const bw = this.box(w, H, .08, this.mat('matte', '#' + back.getHexString())); bw.position.set(0, H / 2, -d / 2); g.add(bw);
    const sideM = this.mat('matte', '#' + back.clone().multiplyScalar(.8).getHexString());
    [-w / 2, w / 2].forEach(x => { const s = this.box(.08, H, d, sideM); s.position.set(x, H / 2, 0); g.add(s); const o = this.box(.1, H + .14, d + .02, wallM); o.position.set(x + Math.sign(x) * .01, H / 2 + .07, 0); o.scale.x = .2; g.add(o); });
    const roof = this.box(w + .1, .14, d + .1, wallM); roof.position.set(0, H + .07, 0); g.add(roof);
    // glass front with frame
    const gl = this.box(w - .1, H - .05, .02, this.mat('glass', '#e8fbff')); gl.position.set(0, H / 2, d / 2); g.add(gl);
    const fr = this.mat('metal', '#0f0f0f');
    [[0, H - .02, w, .05], [0, .02, w, .05]].forEach(([x, y, ww, hh]) => { const b = this.box(ww, hh, .06, fr); b.position.set(x, y, d / 2); g.add(b); });
    const rug = this.plane(w - .2, d - .2, this.mat('fabric', '#2a2a2a')); rug.rotation.x = -Math.PI / 2; rug.position.set(0, .006, 0); g.add(rug);
    // the live set: the host video fills the back of the booth, so through the glass it reads as a real broadcast
    const order = this.ctx.boothVideos || ['hero', 'live-a', 'creator', 'live-c', 'host-jp', 'live-b'];
    const key = order[(this.boothN = (this.boothN || 0) + 1) % order.length] || f.video || 'hero';
    const vt = this.ctx.videos[key] || this.ctx.videos.hero;
    const asp = (this.ctx.videoAspect || {})[key] || 16 / 9;
    let vw, vh;
    if (asp < 1) { vh = Math.min(H - .55, 2.35); vw = vh * asp; } else { vw = w - .24; vh = Math.min(H - .55, vw / asp); vw = vh * asp; }
    const y0 = .3;
    const scrFrame = this.box(vw + .08, vh + .08, .04, this.mat('matte', '#050505')); scrFrame.position.set(0, y0 + vh / 2, -d / 2 + .07); g.add(scrFrame);
    const scr = this.plane(vw, vh, new THREE.MeshBasicMaterial({ map: vt, toneMapped: false })); scr.material.color.setScalar(1.08);
    scr.position.set(0, y0 + vh / 2, -d / 2 + .095); scr.userData.video = key; scr.userData.booth = f; g.add(scr);
    if (asp < 1) { // vertical TikTok LIVE frame: side light bars
      [-1, 1].forEach(sx => { const bar = this.box(.04, vh, .03, this.mat('emit', sx < 0 ? '#25f4ee' : '#fe2c55')); bar.position.set(sx * (vw / 2 + .25), y0 + vh / 2, -d / 2 + .08); g.add(bar); });
    }
    // brand light box on the set wall above the screen
    const top = Math.min(H - .25, y0 + vh + .3);
    const tk = this.sign('TikTok LIVE', { h: .2, color: '#ffffff', glow: 10 }); tk.position.set(0, top, -d / 2 + .1); g.add(tk);
    [-1, 1].forEach(sx => { const n = this.box(.6, .02, .02, this.mat('emit', sx < 0 ? '#25f4ee' : '#fe2c55')); n.position.set(sx * (tk.geometry.parameters.width / 2 + .45), top, -d / 2 + .1); g.add(n); });
    // low counter near the glass with the products being sold (click to buy)
    const cw = Math.min(w * .7, 2.2);
    const desk = this.box(cw, .78, .45, this.mat('gloss', '#f5f5f5'), .02); desk.position.set(0, .39, d / 2 - .55); g.add(desk);
    const dstrip = this.box(cw, .02, .01, this.mat('emit', '#fe2c55')); dstrip.position.set(0, .1, d / 2 - .32); g.add(dstrip);
    const row = new THREE.Group(); row.position.set(0, .78, d / 2 - .5); g.add(row); this.productRow(row, f.products, cw * .9, { minGap: .2, sparse: true, scale: 1.15 });
    // crew gear in the front corners, aimed at the host
    this.ringLight(g, -w / 2 + .45, d / 2 - .45, 1.55, [0, 1.4, -d / 2]); this.cameraRig(g, w / 2 - .45, d / 2 - .45, 1.45, [0, 1.3, -d / 2]);
    // LIVE sign
    const live = this.sign('● LIVE', { h: .22, color: '#fe2c55', glow: 18 }); live.position.set(-w / 2 + .5, H + .3, d / 2 + .06); g.add(live);
    const lbl = f.text || this.L(f.label);
    if (lbl) { const s = this.sign(lbl, { h: .17, color: '#ffffff' }); const mw = w - 1.3; if (s.geometry.parameters.width > mw) s.scale.setScalar(mw / s.geometry.parameters.width); s.position.set(.45, H + .3, d / 2 + .06); g.add(s); }
    if (!this.ctx.lite) { const kl = new THREE.PointLight(0xffe6d0, 1.6, Math.max(w, d) * 1.4, 1.6); kl.position.set(0, H - .3, d * .2); g.add(kl); }
    const soft = this.box(w * .6, .03, .5, this.mat('emit', '#fff5ea')); soft.position.set(0, H - .03, 0); g.add(soft);
    this.contact(g, w, d);
  }
  ringLight(g, x, z, y, aim = [0, y, -2]) {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(.015, .015, y, 8), this.mat('metal', '#222')); st.position.set(x, y / 2, z); g.add(st);
    const legs = this.mat('metal', '#222'); for (let i = 0; i < 3; i++) { const l = this.box(.02, .02, .45, legs); l.position.set(x + Math.sin(i * 2.1) * .18, .03, z + Math.cos(i * 2.1) * .18); l.rotation.y = i * 2.1; g.add(l); }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.23, .025, 12, 48), this.mat('emit', '#ffffff')); ring.position.set(x, y + .2, z); g.add(ring); ring.lookAt((g.updateMatrixWorld(true), g.localToWorld(new THREE.Vector3(...aim))));
    const phone = this.box(.08, .16, .01, this.mat('matte', '#0a0a0a')); phone.position.set(x, y + .2, z); g.add(phone); phone.lookAt((g.updateMatrixWorld(true), g.localToWorld(new THREE.Vector3(...aim))));
  }
  cameraRig(g, x, z, y, aim = [0, y, -2]) {
    const legs = this.mat('metal', '#1d1d1d');
    for (let i = 0; i < 3; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, y * 1.02, 6), legs); const a = i * 2.094; l.position.set(x + Math.sin(a) * .2, y / 2, z + Math.cos(a) * .2); l.rotation.set(Math.cos(a) * .25, 0, -Math.sin(a) * .25); g.add(l); }
    const body = this.box(.16, .12, .22, this.mat('matte', '#0c0c0c'), .01); body.position.set(x, y + .06, z); g.add(body); body.lookAt((g.updateMatrixWorld(true), g.localToWorld(new THREE.Vector3(...aim))));
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(.045, .05, .14, 20), this.mat('matte', '#050505')); lens.position.set(x, y + .06, z); g.add(lens); lens.lookAt((g.updateMatrixWorld(true), g.localToWorld(new THREE.Vector3(...aim)))); lens.rotateX(Math.PI / 2); lens.translateY(.15);
    const tally = new THREE.Mesh(new THREE.SphereGeometry(.012, 8, 6), this.mat('emit', '#ff2040')); tally.position.set(x, y + .14, z); g.add(tally);
  }
  f_ring_light(g, f, w, h) { this.ringLight(g, 0, 0, Math.max(1.2, h - .3)); }
  f_camera(g, f, w, h) { this.cameraRig(g, 0, 0, Math.max(1.1, h - .2)); }
  f_neon_sign(g, f, w, h, d) {
    const txt = f.text || this.L(f.label) || 'TikTok Shop';
    const colr = (f.color && f.color.toLowerCase() !== '#ffffff') ? f.color : '#25f4ee';
    const s = this.sign(txt, { h: Math.max(.15, Math.min(h, w / 5)), color: colr, glow: 22 });
    const mw = w; if (s.geometry.parameters.width > mw) s.scale.setScalar(mw / s.geometry.parameters.width);
    const y = (f.pos?.[1] || 0) > .3 ? f.pos[1] : Math.max(2.4, h);
    s.position.set(0, y, .02); g.add(s);
    const back = this.box(s.geometry.parameters.width * s.scale.x + .1, s.geometry.parameters.height * s.scale.y + .1, .02, this.mat('glass', '#ffffff', { opacity: .1 })); back.position.set(0, y, 0); if (this.ctx.lite) back.visible = false; g.add(back);
    if (!this.ctx.lite) { const pl = new THREE.PointLight(col(colr), .9, 3.5, 2); pl.position.set(0, y, .5); g.add(pl); }
  }
  f_poster(g, f, w, h, d, color) { this.f_banner(g, f, w, h, d, color, 'poster'); }
  f_banner(g, f, w, h, d, color, kind) {
    const y0 = (f.pos?.[1] || 0) > .2 ? f.pos[1] : (kind === 'poster' ? 1.4 + h / 2 : 2.2 + h / 2);
    const img = this.ctx.posterTex(f);
    const frame = this.box(w + .04, h + .04, .03, this.mat('matte', '#111')); frame.position.set(0, y0, 0); g.add(frame);
    const m = new THREE.MeshStandardMaterial({ map: img, roughness: .5, emissive: 0xffffff, emissiveMap: img, emissiveIntensity: .35 });
    const p = this.plane(w, h, m); p.position.set(0, y0, .018); g.add(p);
    const txt = f.text || this.L(f.label);
    if (txt) { const s = this.sign(txt, { h: Math.min(.16, h * .1), color: '#fff', bg: 'rgba(0,0,0,.65)' }); const mw = w * .9; if (s.geometry.parameters.width > mw) s.scale.setScalar(mw / s.geometry.parameters.width); s.position.set(0, y0 - h / 2 + .14, .022); g.add(s); }
    if (kind !== 'poster' && (f.pos?.[1] || 0) < .2 && h + 2.2 > 0) { [-w / 2 + .05, w / 2 - .05].forEach(x => { const c = new THREE.Mesh(new THREE.CylinderGeometry(.004, .004, 4.5 - (y0 + h / 2), 4), this.mat('metal', '#999')); c.position.set(x, (4.5 + y0 + h / 2) / 2, 0); g.add(c); }); }
  }
  f_ranking_wall(g, f, w, h, d, color) {
    const back = this.box(w, h, Math.max(.3, d), this.mat('matte', color || '#ffffff')); back.position.y = h / 2; g.add(back);
    const ttl = this.sign(f.text || this.L(f.label) || 'TikTok Shop RANKING', { h: .22, color: '#111' }); const mw = w * .8; if (ttl.geometry.parameters.width > mw) ttl.scale.setScalar(mw / ttl.geometry.parameters.width); ttl.position.set(0, h - .2, Math.max(.3, d) / 2 + .01); g.add(ttl);
    const ids = (f.products || []).slice(0, 10); const cols = 5, rows = 2; const cw = (w - .3) / cols, chh = (h - .7) / rows;
    ids.forEach((id, i) => {
      const p = this.ctx.products.get(id); if (!p) return;
      const cx = -w / 2 + .15 + cw * (i % cols + .5), cy = h - .5 - chh * ((i / cols | 0) + 1);
      const cell = this.box(cw - .06, .02, .3, this.mat('gloss', '#f2f2f2')); cell.position.set(cx, cy, Math.max(.3, d) / 2 + .14); g.add(cell);
      const num = this.sign(String(i + 1), { h: .2, color: i < 3 ? '#fe2c55' : '#111', font: '900 160px Inter, sans-serif' }); num.position.set(cx - cw / 2 + .14, cy + chh - .2, Math.max(.3, d) / 2 + .012); g.add(num);
      const row = new THREE.Group(); row.position.set(cx, cy + .01, Math.max(.3, d) / 2 + .14); g.add(row);
      this.product(row, p, 0, 0, 0, { scale: 3.4 });
    });
    this.contact(g, w, Math.max(.3, d));
  }
  f_kiosk(g, f, w, h) {
    const H = Math.max(1.5, h);
    const base = this.box(.5, .05, .4, this.mat('metal', '#222')); base.position.y = .025; g.add(base);
    const col_ = this.box(.08, H * .5, .08, this.mat('metal', '#333')); col_.position.y = H * .25; g.add(col_);
    const body = this.box(.56, .95, .07, this.mat('matte', '#111'), .02); body.position.y = H - .5; g.add(body);
    const scr = this.plane(.5, .88, new THREE.MeshBasicMaterial({ map: screenTex('kiosk', this.L(f.label)), toneMapped: false })); scr.position.set(0, H - .5, .037); g.add(scr);
    this.contact(g, .5, .4);
  }
  f_glass_partition(g, f, w, h, d) {
    const gl = this.box(w, h, .02, this.mat('glass', '#eefcff')); gl.position.y = h / 2; g.add(gl);
    const fr = this.mat('metal', '#111'); [[0, h, w, .04], [0, 0, w, .04]].forEach(([x, y, ww, hh]) => { const b = this.box(ww, hh, .05, fr); b.position.set(x, y, 0); g.add(b); });
    const txt = f.text || this.L(f.label); if (txt) { const s = this.sign(txt, { h: .14, color: '#111' }); s.position.set(0, 1.5, .02); g.add(s); }
  }
  f_plant(g, f, w, h) {
    const H = Math.max(.6, h); const r = Math.max(.18, Math.min(w, .6) / 2);
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(r, r * .8, H * .32, 24), this.mat('gloss', '#e8e4dc')); pot.position.y = H * .16; g.add(pot);
    const lm = [this.mat('matte', '#2f5d34'), this.mat('matte', '#3e7a40'), this.mat('matte', '#24492a')];
    const rr = (s => () => ((s = (s * 9301 + 49297) % 233280) / 233280))((f.id || 'p').length * 97);
    for (let i = 0; i < 16; i++) { const lf = new THREE.Mesh(new THREE.SphereGeometry(r * (.45 + rr() * .4), 10, 8), lm[i % 3]); lf.scale.set(1, .6 + rr() * .6, .5); lf.position.set((rr() - .5) * r * 2.2, H * .4 + rr() * H * .6, (rr() - .5) * r * 2.2); lf.rotation.set(rr() * 3, rr() * 3, rr() * 3); g.add(lf); }
    const st = new THREE.Mesh(new THREE.CylinderGeometry(.02, .025, H * .6, 6), this.mat('matte', '#4a3a2a')); st.position.y = H * .5; g.add(st);
    this.contact(g, r * 2, r * 2, true);
  }
  f_sofa(g, f, w, h, d, color) {
    const m = this.mat('fabric', color || '#d9d4cc');
    const seat = this.box(w, .42, d, m, .06); seat.position.y = .21; g.add(seat);
    const back = this.box(w, .45, .2, m, .06); back.position.set(0, .6, -d / 2 + .1); g.add(back);
    [-w / 2 + .1, w / 2 - .1].forEach(x => { const a = this.box(.2, .3, d, m, .06); a.position.set(x, .5, 0); g.add(a); });
    for (let i = 0; i < Math.max(1, Math.round(w / .8)); i++) { const c = this.box(.4, .35, .12, this.mat('fabric', i % 2 ? '#fe2c55' : '#25f4ee'), .05); c.position.set(-w / 2 + .5 + i * .8, .6, -d / 2 + .3); c.rotation.x = -.2; if (c.position.x < w / 2 - .3) g.add(c); }
    this.contact(g, w, d);
  }
  f_bench(g, f, w, h, d, color) { const s = this.box(w, .08, d, this.mat('wood', color || '#b48a5a'), .02); s.position.y = Math.max(.42, h) - .04; g.add(s); [-w / 2 + .15, w / 2 - .15].forEach(x => { const l = this.box(.06, Math.max(.42, h) - .08, d * .8, this.mat('metal', '#111')); l.position.set(x, (Math.max(.42, h) - .08) / 2, 0); g.add(l); }); this.contact(g, w, d); }
  f_rug(g, f, w, h, d, color) { const r = this.plane(w, d, this.mat('fabric', color || '#e6e1d8')); r.rotation.x = -Math.PI / 2; r.position.y = .008; g.add(r); }
  f_stairs(g, f, w, h, d, color) {
    // steps rising toward -z, ending at ceiling (visual only; stepping in triggers floor change)
    const steps = 14, sh = 4.5 / steps, sd = d / steps;
    const m = this.mat('gloss', color || '#d6d2cc'), ed = this.mat('emit', '#ffffff');
    for (let i = 0; i < steps; i++) {
      const s = this.box(w, sh * (i + 1), sd, m); s.position.set(0, sh * (i + 1) / 2, d / 2 - sd * (i + .5)); g.add(s);
      const e = this.box(w, .01, .02, ed); e.position.set(0, sh * (i + 1) + .002, d / 2 - sd * i - .02); g.add(e);
    }
    const rail = this.box(.04, .04, Math.hypot(d, 4.5), this.mat('metal', '#111')); rail.position.set(w / 2, 2.25 + .9, 0); rail.rotation.x = Math.atan2(4.5, d); g.add(rail);
    const gl = this.box(.02, 1, Math.hypot(d, 4.5), this.mat('glass', '#fff')); gl.position.set(w / 2, 2.25 + .45, 0); gl.rotation.x = Math.atan2(4.5, d); g.add(gl);
    g.userData.portal = 'stairs';
    const hit = this.box(w, 1.2, d, new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = .6; hit.userData.portal = 'stairs'; g.add(hit); this.ctx.pickables.push(hit);
  }
  f_elevator(g, f, w, h, d, color) {
    const H = 2.7;
    const surround = this.box(w + .3, 3.4, .2, this.mat('matte', '#151515')); surround.position.set(0, 1.7, 0); g.add(surround);
    const dm = this.mat('chrome', '#b8bec3');
    [-1, 1].forEach(s => { const dd = this.box(w / 2 - .02, H, .04, dm); dd.position.set(s * (w / 4), H / 2, .12); g.add(dd); });
    const ind = this.sign('▲▼  ' + (this.ctx.levelLabel || '1F'), { h: .14, color: '#25f4ee', glow: 6 }); ind.position.set(0, H + .3, .12); g.add(ind);
    const btn = new THREE.Mesh(new THREE.CircleGeometry(.04, 16), this.mat('emit', '#25f4ee')); btn.position.set(w / 2 + .1, 1.2, .12); g.add(btn);
    const hit = this.box(w, H, .3, new THREE.MeshBasicMaterial({ visible: false })); hit.position.set(0, H / 2, .2); hit.userData.portal = 'elevator'; g.add(hit); this.ctx.pickables.push(hit);
    g.userData.portal = 'elevator';
  }
}
