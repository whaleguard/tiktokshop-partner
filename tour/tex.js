// Procedural canvas textures for floors, walls, signage and contact shadows.
import * as THREE from 'three';

const cache = new Map();
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function hex(c) { return '#' + new THREE.Color(c).getHexString(); }
function shade(c, f) { const col = new THREE.Color(c); col.multiplyScalar(f); return '#' + col.getHexString(); }

function finish(cv, repeat, srgb = true) {
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Returns {map, roughnessMap?} sized per tile (1 tile = `tile` meters)
export function surface(pattern, color, tileSeed = 7) {
  const key = pattern + color + tileSeed;
  if (cache.has(key)) return cache.get(key);
  const S = 1024, cv = canvas(S, S), g = cv.getContext('2d'), r = rng(tileSeed);
  const rc = canvas(S, S), rg = rc.getContext('2d');
  let tile = 4;
  g.fillStyle = hex(color); g.fillRect(0, 0, S, S);
  rg.fillStyle = '#9a9a9a'; rg.fillRect(0, 0, S, S);
  if (pattern === 'terrazzo') {
    tile = 2.4;
    for (let i = 0; i < 5200; i++) {
      const x = r() * S, y = r() * S, s = 1.5 + r() * r() * 9;
      const pal = ['#d9d4cc', '#8d8a86', '#3d3b39', '#c7b8a5', '#efece6', '#a59d94', '#fe2c55', '#25f4ee'];
      g.fillStyle = pal[(r() * (r() < .015 ? 8 : 6)) | 0];
      g.globalAlpha = .55 + r() * .45;
      g.beginPath();
      const n = 5 + (r() * 3 | 0);
      for (let k = 0; k < n; k++) { const a = k / n * 6.283, rr = s * (.6 + r() * .5); g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
      g.fill();
    }
    g.globalAlpha = 1; rg.fillStyle = '#5a5a5a'; rg.fillRect(0, 0, S, S);
  } else if (pattern === 'polished_concrete' || pattern === 'concrete' || pattern === 'epoxy') {
    tile = pattern === 'concrete' ? 3 : 5;
    for (let i = 0; i < 420; i++) {
      const x = r() * S, y = r() * S, rad = 20 + r() * 120;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      const dark = r() < .5;
      gr.addColorStop(0, dark ? 'rgba(0,0,0,.035)' : 'rgba(255,255,255,.035)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    const id = g.getImageData(0, 0, S, S), d = id.data;
    for (let i = 0; i < d.length; i += 4) { const n = (r() - .5) * (pattern === 'epoxy' ? 6 : 16); d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    g.putImageData(id, 0, 0);
    if (pattern === 'concrete') { // form-tie holes
      g.fillStyle = 'rgba(0,0,0,.25)';
      for (let x = 128; x < S; x += 256) for (let y = 128; y < S; y += 256) { g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill(); }
      g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = 2; g.strokeRect(1, 1, S - 2, S / 2 - 2); g.strokeRect(1, S / 2, S - 2, S / 2 - 2);
    }
    if (pattern !== 'concrete') { g.strokeStyle = 'rgba(0,0,0,.10)'; g.lineWidth = 2; g.strokeRect(0, 0, S, S); }
    rg.fillStyle = pattern === 'epoxy' ? '#303030' : pattern === 'concrete' ? '#d0d0d0' : '#606060'; rg.fillRect(0, 0, S, S);
    for (let i = 0; i < 120; i++) { const x = r() * S, y = r() * S, rad = 30 + r() * 160; const gr = rg.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(255,255,255,.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); rg.fillStyle = gr; rg.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
  } else if (pattern === 'light_oak' || pattern === 'wood_slat' || pattern === 'wood') {
    tile = pattern === 'wood_slat' ? 1.2 : 3;
    const planks = pattern === 'wood_slat' ? 12 : 8, ph = S / planks;
    for (let p = 0; p < planks; p++) {
      const off = r() * S, base = shade(color, .88 + r() * .2);
      if (pattern === 'wood_slat') {
        g.fillStyle = base; g.fillRect(p * ph, 0, ph * .78, S);
        g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(p * ph + ph * .78, 0, ph * .22, S);
        for (let k = 0; k < 40; k++) { g.strokeStyle = `rgba(80,50,20,${.04 + r() * .06})`; g.lineWidth = 1 + r() * 2; const x = p * ph + r() * ph * .78; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + r() * 6, S / 3, x - r() * 6, S * .66, x, S); g.stroke(); }
      } else {
        g.fillStyle = base; g.fillRect(0, p * ph, S, ph);
        for (let k = 0; k < 50; k++) { g.strokeStyle = `rgba(90,55,25,${.03 + r() * .07})`; g.lineWidth = 1 + r() * 2.5; const y = p * ph + r() * ph; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(S / 3, y + (r() - .5) * 8, S * .66, y + (r() - .5) * 8, S, y); g.stroke(); }
        g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(0, p * ph, S, 2); g.fillRect(off, p * ph, 2, ph);
      }
    }
    rg.fillStyle = '#8a8a8a'; rg.fillRect(0, 0, S, S);
  } else if (pattern === 'white_tile' || pattern === 'tile') {
    tile = 2.4; const n = 4, ts = S / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.fillStyle = shade(color, .97 + r() * .05); g.fillRect(i * ts, j * ts, ts, ts); }
    g.strokeStyle = 'rgba(0,0,0,.16)'; g.lineWidth = 4;
    for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * ts, 0); g.lineTo(i * ts, S); g.stroke(); g.beginPath(); g.moveTo(0, i * ts); g.lineTo(S, i * ts); g.stroke(); }
    rg.fillStyle = '#404040'; rg.fillRect(0, 0, S, S); rg.strokeStyle = '#e0e0e0'; rg.lineWidth = 6;
    for (let i = 0; i <= n; i++) { rg.beginPath(); rg.moveTo(i * ts, 0); rg.lineTo(i * ts, S); rg.stroke(); rg.beginPath(); rg.moveTo(0, i * ts); rg.lineTo(S, i * ts); rg.stroke(); }
  } else if (pattern === 'black_metal') {
    tile = 2;
    for (let y = 0; y < S; y += 2) { g.fillStyle = `rgba(255,255,255,${r() * .03})`; g.fillRect(0, y, S, 1); }
    g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 3; g.strokeRect(2, 2, S - 4, S - 4);
    rg.fillStyle = '#707070'; rg.fillRect(0, 0, S, S);
  } else { // white_plaster & default
    tile = 3;
    const id = g.getImageData(0, 0, S, S), d = id.data;
    for (let i = 0; i < d.length; i += 4) { const n = (r() - .5) * 7; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    g.putImageData(id, 0, 0);
    rg.fillStyle = '#e8e8e8'; rg.fillRect(0, 0, S, S);
  }
  const out = { map: finish(cv), roughnessMap: finish(rc, null, false), tile };
  cache.set(key, out);
  return out;
}

export function radialShadow() {
  if (cache.has('shadow')) return cache.get('shadow');
  const S = 256, cv = canvas(S, S), g = cv.getContext('2d');
  const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(.55, 'rgba(0,0,0,.28)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(cv); cache.set('shadow', t); return t;
}
export function boxShadow() {
  if (cache.has('bshadow')) return cache.get('bshadow');
  const S = 256, cv = canvas(S, S), g = cv.getContext('2d');
  g.filter = 'blur(18px)'; g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(36, 36, S - 72, S - 72);
  const t = new THREE.CanvasTexture(cv); cache.set('bshadow', t); return t;
}

// Neon / sign text texture. Returns {tex, aspect}
export function textTex(text, { color = '#ffffff', bg = null, font = '800 120px Inter, "Noto Sans KR", "Noto Sans JP", sans-serif', glow = 0, pad = 40, sub = '', subColor = null, align = 'center', h = 220 } = {}) {
  const key = ['txt', text, color, bg, font, glow, sub, subColor, align, h].join('|');
  if (cache.has(key)) return cache.get(key);
  const m = canvas(10, 10).getContext('2d'); m.font = font;
  const lines = String(text).split('\n');
  const tw = Math.max(...lines.map(l => m.measureText(l).width));
  const fs = parseInt(font.match(/(\d+)px/)[1]);
  let sw = 0; const sfont = font.replace(/\d+px/, Math.round(fs * .34) + 'px').replace(/^\d00/, '600');
  if (sub) { m.font = sfont; sw = m.measureText(sub).width; }
  const W = Math.ceil(Math.max(tw, sw) + pad * 2), H = Math.ceil(lines.length * fs * 1.15 + (sub ? fs * .55 : 0) + pad * 2);
  const cv = canvas(W, H), g = cv.getContext('2d');
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, W, H); }
  g.textBaseline = 'middle'; g.textAlign = align;
  const x = align === 'center' ? W / 2 : pad;
  lines.forEach((l, i) => {
    const y = pad + fs * .58 + i * fs * 1.15;
    g.font = font;
    if (glow) { g.shadowColor = color; for (let k = 0; k < 3; k++) { g.shadowBlur = glow * (k + 1); g.fillStyle = color; g.fillText(l, x, y); } g.shadowBlur = 0; g.fillStyle = '#ffffff'; g.globalAlpha = .85; g.fillText(l, x, y); g.globalAlpha = 1; }
    else { g.fillStyle = color; g.fillText(l, x, y); }
  });
  if (sub) { g.font = sfont; g.fillStyle = subColor || color; g.fillText(sub, x, H - pad - fs * .2); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const out = { tex: t, aspect: W / H }; cache.set(key, out); return out;
}

// Generic UI-ish panel textures (kiosk, POS screen, price tags)
export function screenTex(kind, label = '', accent = '#fe2c55') {
  const key = 'scr' + kind + label + accent;
  if (cache.has(key)) return cache.get(key);
  const W = 512, H = kind === 'kiosk' ? 900 : 320, cv = canvas(W, H), g = cv.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#111'); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.fillStyle = '#25f4ee'; g.fillRect(0, 0, W, 8); g.fillStyle = accent; g.fillRect(0, 8, W, 4);
  g.fillStyle = '#fff'; g.font = '800 44px Inter, sans-serif'; g.textAlign = 'center';
  g.fillText('TikTok Shop', W / 2, 80);
  if (kind === 'kiosk') {
    g.font = '600 30px Inter, "Noto Sans KR", sans-serif'; g.fillStyle = '#ddd'; g.fillText(label || 'Scan to buy', W / 2, 140);
    g.fillStyle = '#fff'; g.fillRect(96, 200, 320, 320);
    const r = rng(42); g.fillStyle = '#000';
    for (let i = 0; i < 25; i++) for (let j = 0; j < 25; j++) if (r() < .5) g.fillRect(106 + i * 12, 210 + j * 12, 12, 12);
    [[106, 210], [310, 210], [106, 414]].forEach(([x, y]) => { g.fillStyle = '#000'; g.fillRect(x, y, 84, 84); g.fillStyle = '#fff'; g.fillRect(x + 12, y + 12, 60, 60); g.fillStyle = '#000'; g.fillRect(x + 24, y + 24, 36, 36); });
    for (let i = 0; i < 4; i++) { g.fillStyle = i ? '#1c1c1c' : accent; roundRect(g, 40, 580 + i * 72, W - 80, 56, 14); g.fill(); g.fillStyle = '#fff'; g.font = '600 26px Inter, sans-serif'; g.fillText(['LIVE NOW', 'Top 10 Ranking', 'Coupons', 'Find a product'][i], W / 2, 617 + i * 72); }
  } else {
    g.font = '700 54px Inter, sans-serif'; g.fillStyle = '#fff'; g.fillText(label || '₩ 0', W / 2, 190);
    g.font = '500 24px Inter, sans-serif'; g.fillStyle = '#25f4ee'; g.fillText('Tap card or scan QR', W / 2, 250);
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; cache.set(key, t); return t;
}

export function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

// Price tag label for shelf edge
export function priceTag(price, badge) {
  const key = 'tag' + price + badge;
  if (cache.has(key)) return cache.get(key);
  const W = 256, H = 96, cv = canvas(W, H), g = cv.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  if (badge) { g.fillStyle = badge === 'LIVE' ? '#fe2c55' : badge === 'NEW' ? '#111' : badge === 'DEAL' ? '#ff6a00' : '#fe2c55'; g.fillRect(0, 0, W, 30); g.fillStyle = '#fff'; g.font = '800 20px Inter, sans-serif'; g.textAlign = 'left'; g.fillText(badge, 10, 22); }
  g.fillStyle = '#111'; g.font = '800 38px Inter, sans-serif'; g.textAlign = 'left'; g.fillText(price, 10, badge ? 76 : 62);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; cache.set(key, t); return t;
}

// Load an image and cut the white studio background out (flood fill from the border)
const imgCache = new Map();
export function cutout(url, size = 384) {
  const ck = url + '|' + size;
  if (imgCache.has(ck)) return imgCache.get(ck);
  const p = new Promise(res => {
    const im = new Image(); im.crossOrigin = 'anonymous';
    im.onload = () => {
      const sc = size / Math.max(im.naturalWidth, im.naturalHeight);
      const SW = Math.max(1, Math.round(im.naturalWidth * sc)), SH = Math.max(1, Math.round(im.naturalHeight * sc));
      const cv = canvas(SW, SH), g = cv.getContext('2d', { willReadFrequently: true });
      g.drawImage(im, 0, 0, SW, SH);
      let id; try { id = g.getImageData(0, 0, SW, SH); } catch (e) { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return res({ tex: t, box: [0, 0, 1, 1] }); }
      const d = id.data, seen = new Uint8Array(SW * SH), q = new Int32Array(SW * SH); let qh = 0, qt = 0;
      const white = i => { const o = i * 4; const mn = Math.min(d[o], d[o + 1], d[o + 2]), mx = Math.max(d[o], d[o + 1], d[o + 2]); return mn > 228 && mx - mn < 22; };
      for (let x = 0; x < SW; x++) for (const y of [0, SH - 1]) { const i = y * SW + x; if (!seen[i] && white(i)) { seen[i] = 1; q[qt++] = i; } }
      for (let y = 0; y < SH; y++) for (const x of [0, SW - 1]) { const i = y * SW + x; if (!seen[i] && white(i)) { seen[i] = 1; q[qt++] = i; } }
      while (qh < qt) { const i = q[qh++], x = i % SW, y = (i / SW) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= SW || ny >= SH) continue; const n = ny * SW + nx; if (!seen[n] && white(n)) { seen[n] = 1; q[qt++] = n; } } }
      let x0 = SW, y0 = SH, x1 = 0, y1 = 0;
      for (let i = 0; i < SW * SH; i++) {
        if (seen[i]) { d[i * 4 + 3] = 0; continue; }
        // soften edge pixels next to background
        const x = i % SW, y = (i / SW) | 0;
        if ((x && seen[i - 1]) || (x < SW - 1 && seen[i + 1]) || (y && seen[i - SW]) || (y < SH - 1 && seen[i + SW])) d[i * 4 + 3] = 150;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      g.putImageData(id, 0, 0);
      if (x1 <= x0) { x0 = 0; y0 = 0; x1 = SW - 1; y1 = SH - 1; }
      // crop to bounding box
      const cw = x1 - x0 + 1, ch = y1 - y0 + 1, c2 = canvas(cw, ch); c2.getContext('2d').drawImage(cv, x0, y0, cw, ch, 0, 0, cw, ch);
      const t = new THREE.CanvasTexture(c2); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      res({ tex: t, aspect: cw / ch, src: c2 });
    };
    im.onerror = () => res(null);
    im.src = url;
  });
  imgCache.set(ck, p); return p;
}
