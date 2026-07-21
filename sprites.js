'use strict';
/* sprites.js — pre-rendered art library for Castle Siege TD.
   Global: SpriteLib { build(), terrain(map), tower(id,lvl), icon(kind,id) } */
const SpriteLib = (function () {
  const OUT = 'rgba(24,18,32,0.9)';

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function hx(h) {
    h = h.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function rgba(r, g, b, a) { return 'rgba(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ',' + (a === undefined ? 1 : a) + ')'; }
  // shade: f<1 darker, f>1 brighter (clamped)
  function sh(hex, f, a) { const c = hx(hex); return rgba(clamp(c[0] * f, 0, 255), clamp(c[1] * f, 0, 255), clamp(c[2] * f, 0, 255), a); }
  // mix toward white by t (0..1)
  function lt(hex, t, a) { const c = hx(hex); return rgba(c[0] + (255 - c[0]) * t, c[1] + (255 - c[1]) * t, c[2] + (255 - c[2]) * t, a); }
  function mix(h1, h2, t, a) {
    const c = hx(h1), d = hx(h2);
    return rgba(c[0] + (d[0] - c[0]) * t, c[1] + (d[1] - c[1]) * t, c[2] + (d[2] - c[2]) * t, a);
  }
  function rr(g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  function poly(g, pts) {
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath();
  }
  function outl(g, w) { g.strokeStyle = OUT; g.lineWidth = w || 2; g.lineJoin = 'round'; g.stroke(); }
  function shadowEllipse(g, x, y, rx, ry, a) {
    g.save();
    g.fillStyle = rgba(15, 10, 22, a === undefined ? 0.3 : a);
    g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  function shine(g, x, y, rx, ry, rot, a) {
    g.save();
    g.fillStyle = rgba(255, 255, 255, a === undefined ? 0.3 : a);
    g.beginPath(); g.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  function glow(g, x, y, r, color, a) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, sh(color, 1.4, a === undefined ? 0.8 : a));
    gr.addColorStop(0.55, sh(color, 1, (a === undefined ? 0.8 : a) * 0.45));
    gr.addColorStop(1, sh(color, 1, 0));
    g.fillStyle = gr;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }

  /* =================== TERRAIN =================== */
  let FLAVOR = 'castle';
  const REEF_THEMES = {
    meadow: { /* sunlit lagoon */
      ground: '#3f9a8c', patch: ['#4bae9c', '#358a7c', '#58b8a8', '#2f8f80'],
      speck: ['#7ac8b8', '#2a7568', '#9cd6c8'],
      tuft: '#2a7c5f', tuftHi: '#6ed4a8',
      pathEdge: '#4a4026', pathDirt: '#9a8a5a',
      stone: '#a8a094', stoneTint: '#b8ae9c',
      portalGlow: '#46e0d0', sky: '#d8f6ee'
    },
    autumn: { /* golden kelp forest */
      ground: '#8f8434', patch: ['#a0943c', '#7c722c', '#ac9e44', '#6f662a'],
      speck: ['#c4b44c', '#5f5622', '#d0c058'],
      tuft: '#6f6222', tuftHi: '#d8c858',
      pathEdge: '#43391e', pathDirt: '#8a7a42',
      stone: '#a89484', stoneTint: '#c0a082',
      portalGlow: '#ffd036', sky: '#eee8b8'
    },
    ashen: { /* the abyssal trench */
      ground: '#263340', patch: ['#2c3c4a', '#1e2a36', '#324453', '#19232e'],
      speck: ['#3a4e60', '#101820', '#44586c'],
      tuft: '#182430', tuftHi: '#4aa8b8',
      pathEdge: '#10181f', pathDirt: '#37424e',
      stone: '#4e5866', stoneTint: '#5c6874',
      portalGlow: '#3ae0d8', sky: '#22303c'
    }
  };
  const THEMES = {
    meadow: {
      ground: '#5d9a44', patch: ['#6fae4e', '#4f8a3c', '#79b85a', '#548f3e'],
      speck: ['#8cc86a', '#3f7530', '#a4d67e'],
      tuft: '#3f7c2f', tuftHi: '#8ed468',
      pathEdge: '#4a3a26', pathDirt: '#8a6a42',
      stone: '#a8a094', stoneTint: '#b8ae9c',
      portalGlow: '#46e0a0', sky: '#eaf6d8'
    },
    autumn: {
      ground: '#a87f38', patch: ['#b98f40', '#96702f', '#c49a48', '#8a6a30'],
      speck: ['#d4a850', '#7a5a26', '#e0b860'],
      tuft: '#8a6226', tuftHi: '#e8c060',
      pathEdge: '#4e3820', pathDirt: '#8a5f36',
      stone: '#a89484', stoneTint: '#c0a082',
      portalGlow: '#ff9636', sky: '#f6e8c8'
    },
    ashen: {
      ground: '#4a4448', patch: ['#544e52', '#3c3639', '#5e565a', '#332e32'],
      speck: ['#6a6266', '#28242a', '#7a7076'],
      tuft: '#2e2a2e', tuftHi: '#8a8088',
      pathEdge: '#241f24', pathDirt: '#565056',
      stone: '#6e686e', stoneTint: '#7a7078',
      portalGlow: '#ff5a3a', sky: '#5a5058'
    }
  };

  function drawGround(g, T, theme, R, W2, H2) {
    const W = W2 || 1280, H = H2 || 720, AF = (W * H) / 921600;
    g.fillStyle = T.ground;
    g.fillRect(0, 0, W, H);
    // large soft tonal patches (ambience gradients allowed)
    for (let i = 0; i < Math.round(26 * AF); i++) {
      const x = R() * W, y = R() * H, r = 90 + R() * 190;
      const col = T.patch[(R() * T.patch.length) | 0];
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, sh(col, 1, 0.5));
      gr.addColorStop(1, sh(col, 1, 0));
      g.fillStyle = gr;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    // fine noise speckle
    for (let i = 0; i < Math.round(2600 * AF); i++) {
      const x = R() * W, y = R() * H;
      g.fillStyle = sh(T.speck[(R() * T.speck.length) | 0], 0.9 + R() * 0.25, 0.16 + R() * 0.2);
      const s = 1 + R() * 2.2;
      g.fillRect(x, y, s, s);
    }
    if (theme === 'ashen') {
      // ember cracks + glow patches
      for (let i = 0; i < Math.round(26 * AF); i++) {
        const x = R() * W, y = R() * H;
        glow(g, x, y, 26 + R() * 40, '#e8712a', 0.12 + R() * 0.1);
        g.strokeStyle = rgba(255, 120 + R() * 60, 40, 0.75);
        g.lineWidth = 1.6 + R();
        g.beginPath();
        let cx = x - 20 - R() * 15, cy = y + (R() - 0.5) * 20;
        g.moveTo(cx, cy);
        for (let s = 0; s < 4; s++) { cx += 9 + R() * 14; cy += (R() - 0.5) * 16; g.lineTo(cx, cy); }
        g.stroke();
      }
      // charred speckle
      for (let i = 0; i < Math.round(500 * AF); i++) {
        g.fillStyle = rgba(16, 12, 16, 0.3 + R() * 0.3);
        g.fillRect(R() * W, R() * H, 1 + R() * 3, 1 + R() * 2);
      }
    } else {
      // grass tufts
      const n = theme === 'meadow' ? 420 : 300;
      for (let i = 0; i < n; i++) {
        const x = R() * W, y = R() * H, s = 2.5 + R() * 3.5;
        g.strokeStyle = R() < 0.5 ? sh(T.tuft, 0.9 + R() * 0.3, 0.8) : sh(T.tuftHi, 0.85 + R() * 0.3, 0.7);
        g.lineWidth = 1.3;
        g.beginPath();
        for (let b = -1; b <= 1; b++) {
          g.moveTo(x, y);
          g.quadraticCurveTo(x + b * s * 0.6, y - s * 0.8, x + b * s, y - s * (1.3 + R() * 0.6));
        }
        g.stroke();
      }
      if (theme === 'autumn') {
        // fallen-leaf drifts: clustered patches + loose scatter
        const cols = ['#d8752c', '#c9552a', '#e0a030', '#a84a22', '#e88838'];
        for (let cN = 0; cN < 34; cN++) {
          const cx2 = R() * W, cy2 = R() * H, rad = 20 + R() * 46, n = 10 + R() * 18;
          g.fillStyle = sh(cols[(R() * 5) | 0], 0.9, 0.12);
          g.beginPath(); g.ellipse(cx2, cy2, rad, rad * 0.6, R(), 0, Math.PI * 2); g.fill();
          for (let i = 0; i < n; i++) {
            const a = R() * Math.PI * 2, rr2 = Math.sqrt(R()) * rad;
            const x = cx2 + Math.cos(a) * rr2, y = cy2 + Math.sin(a) * rr2 * 0.6;
            g.fillStyle = sh(cols[(R() * 5) | 0], 0.85 + R() * 0.4, 0.9);
            g.save();
            g.translate(x, y); g.rotate(R() * Math.PI * 2);
            g.beginPath(); g.ellipse(0, 0, 2.8 + R() * 2, 1.5 + R(), 0, 0, Math.PI * 2); g.fill();
            g.restore();
          }
        }
        for (let i = 0; i < 120; i++) {
          const x = R() * W, y = R() * H;
          g.fillStyle = sh(cols[(R() * 5) | 0], 0.85 + R() * 0.35, 0.8);
          g.save();
          g.translate(x, y); g.rotate(R() * Math.PI * 2);
          g.beginPath(); g.ellipse(0, 0, 2.4 + R() * 2, 1.3 + R(), 0, 0, Math.PI * 2); g.fill();
          g.restore();
        }
      }
      if (theme === 'meadow') {
        for (let i = 0; i < 46; i++) {
          const x = R() * W, y = R() * H;
          const cols = ['#f2e35a', '#f6f2e8', '#e87ab0'];
          const c = cols[(R() * 3) | 0];
          for (let k = 0; k < 3; k++) {
            const fx = x + (R() - 0.5) * 14, fy = y + (R() - 0.5) * 10;
            g.fillStyle = sh(c, 0.95, 0.9);
            for (let p = 0; p < 5; p++) {
              const a = p / 5 * Math.PI * 2 + R();
              g.beginPath(); g.arc(fx + Math.cos(a) * 1.7, fy + Math.sin(a) * 1.7, 1.3, 0, Math.PI * 2); g.fill();
            }
            g.fillStyle = 'rgba(248,200,48,0.95)';
            g.beginPath(); g.arc(fx, fy, 1.1, 0, Math.PI * 2); g.fill();
          }
        }
      }
    }
  }

  function vignette(g, w, h) {
    w = w || 1280; h = h || 720;
    const gr = g.createRadialGradient(w / 2, h / 2 - 20, Math.min(w, h) * 0.45, w / 2, h / 2, Math.max(w, h) * 0.62);
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(1, 'rgba(10,6,16,0.34)');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  }

  function samplePath(pts, step) {
    const out = [];
    let prev = pts[0];
    let acc = 0;
    out.push({ x: prev.x, y: prev.y, ang: 0 });
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i];
      const dx = p.x - prev.x, dy = p.y - prev.y;
      const len = Math.hypot(dx, dy);
      const ang = Math.atan2(dy, dx);
      let d = step - acc;
      while (d <= len) {
        out.push({ x: prev.x + dx * d / len, y: prev.y + dy * d / len, ang: ang });
        d += step;
      }
      acc = len - (d - step);
      prev = p;
    }
    if (out.length > 1) out[0].ang = out[1].ang;
    return out;
  }

  function drawPaths(g, T, paths, R) {
    // underlay: dark edge then dirt base for all paths
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const pass of [[48, sh(T.pathEdge, 1, 0.95)], [41, T.pathDirt]]) {
      g.lineWidth = pass[0]; g.strokeStyle = pass[1];
      for (const p of paths) {
        g.beginPath();
        g.moveTo(p[0].x, p[0].y);
        for (let i = 1; i < p.length; i++) g.lineTo(p[i].x, p[i].y);
        g.stroke();
      }
    }
    // dirt mottling along the road
    for (const p of paths) {
      const sm = samplePath(p, 9);
      for (const s of sm) {
        if (R() < 0.55) continue;
        const off = (R() - 0.5) * 30;
        const x = s.x - Math.sin(s.ang) * off, y = s.y + Math.cos(s.ang) * off;
        g.fillStyle = sh(T.pathDirt, 0.8 + R() * 0.45, 0.35);
        g.beginPath(); g.ellipse(x, y, 4 + R() * 6, 3 + R() * 4, s.ang, 0, Math.PI * 2); g.fill();
      }
    }
    // cobblestones: 3 staggered rows of rounded stones with per-stone shading
    for (const p of paths) {
      const sm = samplePath(p, 13);
      for (let i = 0; i < sm.length; i++) {
        const s = sm[i];
        for (let row = -1; row <= 1; row++) {
          const stagger = (i % 2) ? 6.5 : 0;
          const lat = row * 13 + (R() - 0.5) * 3 + (row === 0 ? 0 : (stagger * (row > 0 ? 1 : -1) * 0));
          const along = (R() - 0.5) * 3 + ((i % 2) && row !== 0 ? 0 : 0);
          const x = s.x + Math.cos(s.ang) * along - Math.sin(s.ang) * lat;
          const y = s.y + Math.sin(s.ang) * along + Math.cos(s.ang) * lat;
          if (row !== 0 && R() < 0.08) continue; // occasional missing stone
          const w = 10.5 + R() * 3.5, h = 8 + R() * 2.5;
          const rot = s.ang + (R() - 0.5) * 0.35;
          const base = mix(T.stone, T.stoneTint, R(), 1);
          const lum = 0.82 + R() * 0.35;
          g.save();
          g.translate(x, y); g.rotate(rot);
          // stone body
          g.fillStyle = sh(T.stone, lum);
          rr(g, -w / 2, -h / 2, w, h, 4);
          g.fill();
          g.strokeStyle = 'rgba(24,18,32,0.55)'; g.lineWidth = 1.5; g.stroke();
          // shadow lower-right
          g.fillStyle = rgba(20, 14, 26, 0.28);
          g.beginPath();
          g.moveTo(-w / 2 + 2, h / 2 - 1.5);
          g.quadraticCurveTo(0, h / 2 + 0.5, w / 2 - 1.5, h / 2 - 3);
          g.lineTo(w / 2 - 1.5, h / 2 - 1.5);
          g.quadraticCurveTo(0, h / 2, -w / 2 + 2, h / 2 - 1.5);
          g.closePath(); g.fill();
          g.fillStyle = rgba(20, 14, 26, 0.18);
          rr(g, -w / 2 + 1.5, -1, w - 3, h / 2, 3); g.fill();
          // highlight upper-left
          g.fillStyle = rgba(255, 255, 250, 0.3);
          g.beginPath(); g.ellipse(-w * 0.16, -h * 0.2, w * 0.3, h * 0.2, -0.4, 0, Math.PI * 2); g.fill();
          g.restore();
        }
      }
    }
  }

  function drawPortal(g, T, x, y, R) {
    const w = 74, h = 78;
    shadowEllipse(g, x, y + 6, 44, 12, 0.32);
    // dark interior with glow
    g.save();
    g.beginPath();
    g.moveTo(x - w * 0.34, y + 4);
    g.lineTo(x - w * 0.34, y - h * 0.32);
    g.arc(x, y - h * 0.32, w * 0.34, Math.PI, 0);
    g.lineTo(x + w * 0.34, y + 4);
    g.closePath();
    g.fillStyle = '#0c0812';
    g.fill();
    g.clip();
    glow(g, x, y - h * 0.14, w * 0.42, T.portalGlow, 0.75);
    g.fillStyle = sh(T.portalGlow, 1.5, 0.5);
    g.beginPath(); g.ellipse(x, y - h * 0.1, 9, 13, 0, 0, Math.PI * 2); g.fill();
    g.restore();
    // arch voussoir stones
    const n = 7;
    for (let i = 0; i <= n; i++) {
      const a = Math.PI + (i / n) * Math.PI;
      const cxs = x + Math.cos(a) * w * 0.42, cys = (y - h * 0.32) + Math.sin(a) * h * 0.46;
      const lum = 0.85 + ((i * 37) % 10) / 28;
      g.save();
      g.translate(cxs, cys); g.rotate(a + Math.PI / 2);
      g.fillStyle = sh(T.stone, lum);
      rr(g, -8, -7, 16, 14, 4); g.fill();
      outl(g, 2);
      g.fillStyle = rgba(255, 255, 255, 0.22);
      g.beginPath(); g.ellipse(-2, -2.5, 4, 2.4, -0.4, 0, Math.PI * 2); g.fill();
      g.restore();
    }
    // side pillars
    for (const sx of [-1, 1]) {
      const px = x + sx * w * 0.42;
      g.fillStyle = sh(T.stone, 0.9);
      rr(g, px - 9, y - h * 0.34, 18, h * 0.4, 4); g.fill(); outl(g, 2);
      g.fillStyle = rgba(20, 14, 26, 0.25);
      rr(g, px - 9 + (sx > 0 ? 8 : 1), y - h * 0.34 + 3, 8, h * 0.4 - 5, 3); g.fill();
      g.fillStyle = rgba(255, 255, 255, 0.22);
      g.beginPath(); g.ellipse(px - sx * 3, y - h * 0.28, 4, 2.6, 0, 0, Math.PI * 2); g.fill();
      // cap stone
      g.fillStyle = sh(T.stone, 1.06);
      rr(g, px - 11, y + h * 0.05, 22, 9, 3); g.fill(); outl(g, 2);
    }
    // ground glow seep
    glow(g, x, y + 2, 30, T.portalGlow, 0.22);
  }

  /* ---------- decorations ---------- */
  function drawDecor(g, T, theme, d, R) {
    const s = d.s || 1;
    g.save();
    g.translate(d.x, d.y);
    g.scale(s, s);
    const k = d.kind;
    if (theme === 'ashen' && (k === 'tree' || k === 'pine')) { drawCharredTree(g, R); g.restore(); return; }
    if (theme === 'ashen' && k === 'bush') { drawCharredBush(g, R); g.restore(); return; }
    if (theme === 'ashen' && k === 'flowers') { drawEmberPatch(g, R); g.restore(); return; }
    if (k === 'tree') drawTree(g, theme, R);
    else if (k === 'pine') drawPine(g, theme, R);
    else if (k === 'rock') drawRock(g, T, R);
    else if (k === 'bush') drawBush(g, theme, R);
    else if (k === 'flowers') drawFlowers(g, theme, R);
    else if (k === 'stump') drawStump(g, theme === 'ashen', R);
    else if (k === 'crystal') drawCrystal(g, T, R);
    g.restore();
  }
  function canopyCols(theme) {
    if (theme === 'autumn') return ['#b06424', '#d8862e', '#eaa83c'];
    return ['#2e6e2a', '#4a9438', '#6fbe4e'];
  }
  function drawTree(g, theme, R) {
    shadowEllipse(g, 2, 4, 26, 8, 0.3);
    // trunk
    g.fillStyle = '#6a4526';
    poly(g, [[-5, 2], [-3, -18], [3, -18], [6, 2]]); g.fill(); outl(g, 2);
    g.fillStyle = 'rgba(255,235,200,0.25)';
    g.fillRect(-3.5, -16, 2, 14);
    const C = canopyCols(theme);
    // canopy: dark base blob, mid, light top-left
    g.fillStyle = C[0];
    g.beginPath();
    g.ellipse(0, -34, 25, 21, 0, 0, Math.PI * 2); g.fill(); outl(g, 2.4);
    g.fillStyle = C[1];
    g.beginPath();
    g.ellipse(-3, -38, 20, 16, 0, 0, Math.PI * 2);
    g.ellipse(10, -30, 12, 10, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = C[2];
    g.beginPath();
    g.ellipse(-7, -43, 12, 9, 0, 0, Math.PI * 2);
    g.ellipse(4, -45, 8, 6, 0, 0, Math.PI * 2);
    g.fill();
    shine(g, -10, -46, 5, 3, -0.5, 0.3);
  }
  function drawPine(g, theme, R) {
    shadowEllipse(g, 2, 3, 20, 7, 0.3);
    g.fillStyle = '#5e3d22';
    g.fillRect(-3, -10, 6, 12); outl(g, 2);
    const dark = theme === 'autumn' ? '#4e6e26' : '#1f5c30';
    const midc = theme === 'autumn' ? '#6e9434' : '#2f7c3e';
    const hi = theme === 'autumn' ? '#96bc4a' : '#54a45a';
    const tiers = [[-8, 24, 20], [-26, 19, 18], [-42, 14, 16]];
    for (const t of tiers) {
      poly(g, [[-t[1], t[0]], [t[1], t[0]], [0, t[0] - t[2] - 8]]);
      g.fillStyle = dark; g.fill(); outl(g, 2.4);
      poly(g, [[-t[1] * 0.7, t[0] - 2], [t[1] * 0.35, t[0] - 2], [0, t[0] - t[2] - 7]]);
      g.fillStyle = midc; g.fill();
      poly(g, [[-t[1] * 0.45, t[0] - 4], [-t[1] * 0.05, t[0] - 4], [-t[1] * 0.12, t[0] - t[2] - 5]]);
      g.fillStyle = hi; g.fill();
    }
    shine(g, -5, -50, 3, 2, -0.5, 0.35);
  }
  function drawCharredTree(g, R) {
    shadowEllipse(g, 2, 3, 18, 6, 0.35);
    g.strokeStyle = OUT; g.lineWidth = 2; g.lineCap = 'round';
    g.fillStyle = '#241d22';
    poly(g, [[-5, 2], [-3, -26], [3, -26], [5, 2]]); g.fill(); g.stroke();
    g.strokeStyle = '#241d22'; g.lineWidth = 4;
    g.beginPath();
    g.moveTo(0, -24); g.lineTo(-12, -40); g.moveTo(-8, -35); g.lineTo(-14, -46);
    g.moveTo(0, -22); g.lineTo(12, -38); g.moveTo(8, -33) ; g.lineTo(16, -40);
    g.moveTo(0, -26); g.lineTo(2, -46);
    g.stroke();
    g.strokeStyle = 'rgba(24,18,32,0.9)'; g.lineWidth = 1;
    // ember at base
    glow(g, 3, 0, 10, '#ff6a2a', 0.5);
    g.fillStyle = 'rgba(255,150,60,0.8)';
    g.fillRect(-2, -14, 1.6, 5);
  }
  function drawCharredBush(g, R) {
    shadowEllipse(g, 1, 2, 15, 5, 0.32);
    g.fillStyle = '#26202a';
    g.beginPath();
    g.ellipse(-6, -6, 8, 7, 0, 0, Math.PI * 2);
    g.ellipse(6, -5, 7, 6, 0, 0, Math.PI * 2);
    g.ellipse(0, -10, 8, 7, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = OUT; g.lineWidth = 2.2;
    g.beginPath(); g.ellipse(0, -7, 14, 9.5, 0, 0, Math.PI * 2); g.stroke();
    // bare twigs poking out
    g.strokeStyle = '#171219'; g.lineWidth = 2; g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-4, -12); g.lineTo(-8, -20);
    g.moveTo(3, -13); g.lineTo(6, -21);
    g.moveTo(0, -13); g.lineTo(-1, -19);
    g.stroke();
    g.fillStyle = 'rgba(140,130,140,0.35)';
    g.beginPath(); g.ellipse(-5, -11, 4, 2.6, -0.3, 0, Math.PI * 2); g.fill();
    // embers
    glow(g, 4, -5, 7, '#ff6a2a', 0.5);
    g.fillStyle = '#ffab52';
    for (const b of [[4, -5], [-7, -3], [1, -9]]) { g.beginPath(); g.arc(b[0], b[1], 1.4, 0, Math.PI * 2); g.fill(); }
  }
  function drawEmberPatch(g, R) {
    for (let i = 0; i < 7; i++) {
      const x = (R() - 0.5) * 36, y = (R() - 0.5) * 16;
      glow(g, x, y, 6 + R() * 6, FLAVOR === 'reef' ? '#3ae0d8' : '#ff6a2a', 0.4);
      g.fillStyle = FLAVOR === 'reef' ? rgba(90 + R() * 60, 220, 210, 0.9) : rgba(255, 130 + R() * 80, 50, 0.9);
      g.beginPath(); g.arc(x, y, 1.4 + R() * 1.4, 0, Math.PI * 2); g.fill();
    }
    g.strokeStyle = FLAVOR === 'reef' ? 'rgba(70,220,210,0.6)' : 'rgba(255,120,50,0.7)'; g.lineWidth = 1.4;
    for (let i = 0; i < 3; i++) {
      const x = (R() - 0.5) * 30, y = (R() - 0.5) * 14;
      g.beginPath(); g.moveTo(x, y);
      g.lineTo(x + 6 + R() * 6, y + (R() - 0.5) * 6); g.stroke();
    }
  }
  function drawRock(g, T, R) {
    shadowEllipse(g, 2, 5, 22, 7, 0.3);
    g.fillStyle = sh(T.stone, 0.95);
    poly(g, [[-20, 4], [-16, -12], [-4, -19], [10, -16], [19, -4], [16, 5]]);
    g.fill(); outl(g, 2.4);
    g.fillStyle = rgba(20, 14, 26, 0.25);
    poly(g, [[16, 5], [19, -4], [10, -16], [6, -14], [10, -2], [6, 5]]); g.fill();
    g.fillStyle = lt(T.stone, 0.35);
    poly(g, [[-16, -12], [-4, -19], [2, -15], [-10, -8]]); g.fill();
    shine(g, -8, -13, 4, 2.4, -0.4, 0.3);
  }
  function drawBush(g, theme, R) {
    shadowEllipse(g, 1, 2, 17, 5, 0.28);
    const C = canopyCols(theme);
    g.fillStyle = C[0];
    g.beginPath();
    g.ellipse(-8, -8, 9.5, 9, 0, 0, Math.PI * 2);
    g.ellipse(8, -8, 9, 8.5, 0, 0, Math.PI * 2);
    g.ellipse(0, -14, 10, 9.5, 0, 0, Math.PI * 2);
    g.ellipse(0, -6, 12, 8, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = OUT; g.lineWidth = 2.2;
    g.beginPath();
    g.moveTo(-16, -3);
    g.quadraticCurveTo(-18, -13, -9, -16);
    g.quadraticCurveTo(-6, -23, 2, -22);
    g.quadraticCurveTo(10, -22, 12, -15);
    g.quadraticCurveTo(18, -12, 16, -3);
    g.quadraticCurveTo(8, 2, 0, 1.5);
    g.quadraticCurveTo(-9, 2, -16, -3);
    g.closePath(); g.stroke();
    g.fillStyle = C[1];
    g.beginPath();
    g.ellipse(-5, -13, 8, 6.5, 0.2, 0, Math.PI * 2);
    g.ellipse(6, -9, 6.5, 5, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = C[2];
    g.beginPath(); g.ellipse(-6, -16, 5.5, 4, -0.3, 0, Math.PI * 2); g.fill();
    shine(g, -8, -18, 3, 1.8, -0.4, 0.35);
    // berries
    g.fillStyle = theme === 'autumn' ? '#d84040' : '#e85060';
    for (const b of [[-11, -7], [3, -5], [9, -13]]) {
      g.beginPath(); g.arc(b[0], b[1], 1.8, 0, Math.PI * 2); g.fill();
    }
  }
  function drawFlowers(g, theme, R) {
    const petals = theme === 'autumn' ? ['#e8b040', '#d87030', '#e05050'] : ['#f8e858', '#f078b0', '#ffffff', '#9ab8f8'];
    // grass tuft bed
    g.strokeStyle = theme === 'autumn' ? '#8a6226' : '#3f7c2f';
    g.lineWidth = 1.6;
    for (let i = 0; i < 9; i++) {
      const x = (R() - 0.5) * 40, y = (R() - 0.5) * 18, s = 4 + R() * 3;
      g.beginPath();
      g.moveTo(x, y); g.quadraticCurveTo(x - s * 0.6, y - s, x - s, y - s * 1.6);
      g.moveTo(x, y); g.quadraticCurveTo(x + s * 0.6, y - s, x + s, y - s * 1.6);
      g.stroke();
    }
    for (let i = 0; i < 6; i++) {
      const x = (R() - 0.5) * 36, y = (R() - 0.5) * 16;
      g.strokeStyle = theme === 'autumn' ? '#7a5a26' : '#3f7c2f'; g.lineWidth = 1.8;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 2, y - 6, x + 1, y - 10); g.stroke();
      const c = petals[(R() * petals.length) | 0];
      for (let p = 0; p < 6; p++) {
        const a = p / 6 * Math.PI * 2;
        g.fillStyle = sh(c, 0.82);
        g.beginPath(); g.arc(x + 1 + Math.cos(a) * 3.4, y - 10 + Math.sin(a) * 3.4, 2.5, 0, Math.PI * 2); g.fill();
      }
      for (let p = 0; p < 6; p++) {
        const a = p / 6 * Math.PI * 2;
        g.fillStyle = c;
        g.beginPath(); g.arc(x + 0.6 + Math.cos(a) * 3.2, y - 10.4 + Math.sin(a) * 3.2, 2.2, 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = '#f8c830';
      g.beginPath(); g.arc(x + 1, y - 10, 2.2, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(24,18,32,0.6)'; g.lineWidth = 1;
      g.beginPath(); g.arc(x + 1, y - 10, 2.2, 0, Math.PI * 2); g.stroke();
    }
  }
  function drawStump(g, charred, R) {
    shadowEllipse(g, 1, 3, 15, 5, 0.28);
    g.fillStyle = charred ? '#2c2229' : '#6a4526';
    g.beginPath();
    g.moveTo(-11, -12); g.lineTo(-12, 0);
    g.quadraticCurveTo(0, 6, 12, 0);
    g.lineTo(11, -12); g.closePath();
    g.fill(); outl(g, 2.2);
    g.fillStyle = 'rgba(20,14,26,0.25)';
    g.beginPath(); g.moveTo(4, -11); g.lineTo(5, 2); g.quadraticCurveTo(9, 1.4, 12, 0); g.lineTo(11, -12); g.closePath(); g.fill();
    g.fillStyle = charred ? '#8a7568' : '#c89a5e';
    g.beginPath(); g.ellipse(0, -12, 11.5, 5.5, 0, 0, Math.PI * 2); g.fill(); outl(g, 2);
    g.strokeStyle = charred ? '#4e4038' : '#8a6236'; g.lineWidth = 1.2;
    for (const r of [7, 4.4, 2]) { g.beginPath(); g.ellipse(0, -12, r, r * 0.46, 0, 0, Math.PI * 2); g.stroke(); }
    shine(g, -4, -14, 3.4, 1.6, -0.3, 0.35);
  }
  function drawCrystal(g, T, R) {
    shadowEllipse(g, 1, 3, 16, 5, 0.3);
    glow(g, 0, -16, 26, T.portalGlow, 0.35);
    const c = T.portalGlow;
    const shards = [[0, 0, -34, 9], [-11, -2, -20, 6], [10, -1, -16, 5]];
    for (const sd of shards) {
      poly(g, [[sd[0] - sd[3], 2 + sd[1]], [sd[0], sd[2] + sd[1]], [sd[0] + sd[3], 2 + sd[1]]]);
      g.fillStyle = sh(c, 0.8, 0.92); g.fill(); outl(g, 2.2);
      poly(g, [[sd[0] - sd[3] * 0.5, sd[1]], [sd[0] - sd[3] * 0.1, sd[2] + sd[1] + 3], [sd[0] + sd[3] * 0.15, sd[1]]]);
      g.fillStyle = lt(c, 0.55, 0.95); g.fill();
    }
    shine(g, -2, -26, 2, 4, 0.1, 0.5);
  }

  /* ---------- castle ---------- */
  function crenel(g, x0, y0, w, n, cw, ch, fill, dark) {
    const gap = (w - n * cw) / (n - 1);
    for (let i = 0; i < n; i++) {
      const x = x0 + i * (cw + gap);
      g.fillStyle = fill;
      rr(g, x, y0 - ch, cw, ch + 2, 2); g.fill(); outl(g, 2);
      g.fillStyle = dark;
      g.fillRect(x + cw * 0.55, y0 - ch + 2, cw * 0.4, ch - 2);
      g.fillStyle = 'rgba(255,255,255,0.22)';
      g.fillRect(x + 1.5, y0 - ch + 1.5, cw * 0.3, 2.4);
    }
  }
  function brickHints(g, x, y, w, h, R, tint) {
    g.strokeStyle = tint || 'rgba(30,22,40,0.22)';
    g.lineWidth = 1.2;
    for (let i = 0; i < w * h / 130; i++) {
      const bx = x + R() * (w - 12), by = y + R() * (h - 6);
      g.beginPath();
      g.moveTo(bx, by); g.lineTo(bx + 8 + R() * 6, by);
      g.stroke();
    }
  }
  function drawCastle(g, T, theme, cx, cy, R) {
    g.save();
    g.translate(cx, cy);
    const stoneBase = FLAVOR === 'reef' ? '#e0bfae' : '#b0a8b8';
    const stone = stoneBase, stoneD = sh(stoneBase, 0.72), stoneL = lt(stoneBase, 0.3);
    const roofBase = FLAVOR === 'reef' ? '#2f9a8e' : '#3e63b0';
    const roof = roofBase, roofD = sh(roofBase, 0.7), roofL = lt(roofBase, 0.3);
    const gold = '#e8c34a';
    shadowEllipse(g, 0, 62, 122, 20, 0.34);

    // central keep (behind)
    g.fillStyle = stone;
    rr(g, -40, -118, 80, 118, 4); g.fill(); outl(g, 2.6);
    g.fillStyle = stoneD; g.fillRect(16, -114, 22, 112);
    g.fillStyle = stoneL; g.fillRect(-38, -114, 10, 112);
    brickHints(g, -36, -112, 74, 108, R);
    crenel(g, -42, -118, 84, 5, 12, 12, stone, stoneD);
    // keep roof turret
    g.fillStyle = stone;
    rr(g, -16, -152, 32, 36, 3); g.fill(); outl(g, 2.4);
    g.fillStyle = stoneD; g.fillRect(6, -149, 8, 33);
    poly(g, [[-22, -152], [22, -152], [0, -196]]);
    g.fillStyle = roof; g.fill(); outl(g, 2.6);
    poly(g, [[0, -196], [22, -152], [8, -152]]); g.fillStyle = roofD; g.fill();
    poly(g, [[0, -196], [-22, -152], [-14, -152]]); g.fillStyle = roofL; g.fill();
    g.fillStyle = gold;
    g.beginPath(); g.arc(0, -199, 4, 0, Math.PI * 2); g.fill(); outl(g, 2);
    // keep windows
    for (const wy of [-96, -66]) {
      g.fillStyle = '#241c30';
      rr(g, -5, wy, 10, 16, 5); g.fill(); outl(g, 2);
      g.fillStyle = 'rgba(255,214,110,0.85)';
      rr(g, -3.4, wy + 2, 6.8, 12, 3.4); g.fill();
    }

    // side towers
    for (const sx of [-1, 1]) {
      const tx = sx * 92;
      g.fillStyle = stone;
      rr(g, tx - 24, -88, 48, 146, 5); g.fill(); outl(g, 2.6);
      g.fillStyle = stoneD; g.fillRect(tx + 8, -84, 13, 140);
      g.fillStyle = stoneL; g.fillRect(tx - 21, -84, 8, 140);
      brickHints(g, tx - 20, -80, 40, 130, R);
      // machicolation ring
      g.fillStyle = stone;
      rr(g, tx - 28, -92, 56, 12, 4); g.fill(); outl(g, 2.4);
      g.fillStyle = stoneD; g.fillRect(tx + 10, -90, 15, 8);
      // conical roof
      poly(g, [[tx - 29, -92], [tx + 29, -92], [tx, -148]]);
      g.fillStyle = roof; g.fill(); outl(g, 2.6);
      poly(g, [[tx, -148], [tx + 29, -92], [tx + 10, -92]]); g.fillStyle = roofD; g.fill();
      poly(g, [[tx, -148], [tx - 29, -92], [tx - 18, -92]]); g.fillStyle = roofL; g.fill();
      g.fillStyle = gold;
      g.beginPath(); g.arc(tx, -150, 3.4, 0, Math.PI * 2); g.fill(); outl(g, 2);
      // arrow slit
      g.fillStyle = '#241c30';
      rr(g, tx - 2.5, -66, 5, 18, 2.5); g.fill(); outl(g, 1.6);
      rr(g, tx - 2.5, -20, 5, 18, 2.5); g.fill(); outl(g, 1.6);
      shine(g, tx - 12, -74, 5, 3, -0.5, 0.25);
    }

    // front wall
    g.fillStyle = stone;
    rr(g, -74, -46, 148, 104, 4); g.fill(); outl(g, 2.6);
    g.fillStyle = stoneD; g.fillRect(38, -42, 34, 100);
    g.fillStyle = stoneL; g.fillRect(-71, -42, 12, 100);
    brickHints(g, -70, -42, 140, 96, R);
    crenel(g, -74, -46, 148, 7, 14, 13, stone, stoneD);
    // walkway line
    g.strokeStyle = 'rgba(30,22,40,0.35)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(-72, -30); g.lineTo(72, -30); g.stroke();

    // gate arch + portcullis
    const gw = 46, gh = 62, gy = 58;
    g.fillStyle = sh(stone, 0.85);
    g.beginPath();
    g.moveTo(-gw / 2 - 7, gy);
    g.lineTo(-gw / 2 - 7, gy - gh + gw / 2);
    g.arc(0, gy - gh + gw / 2, gw / 2 + 7, Math.PI, 0);
    g.lineTo(gw / 2 + 7, gy);
    g.closePath(); g.fill(); outl(g, 2.6);
    g.fillStyle = '#1c1524';
    g.beginPath();
    g.moveTo(-gw / 2, gy);
    g.lineTo(-gw / 2, gy - gh + gw / 2);
    g.arc(0, gy - gh + gw / 2, gw / 2, Math.PI, 0);
    g.lineTo(gw / 2, gy);
    g.closePath(); g.fill();
    // warm interior glow
    g.save(); g.beginPath();
    g.moveTo(-gw / 2, gy); g.lineTo(-gw / 2, gy - gh + gw / 2);
    g.arc(0, gy - gh + gw / 2, gw / 2, Math.PI, 0);
    g.lineTo(gw / 2, gy); g.closePath(); g.clip();
    glow(g, 0, gy - 6, 30, '#ffb43c', 0.35);
    g.restore();
    // portcullis bars
    g.strokeStyle = '#6a707e'; g.lineWidth = 3.4; g.lineCap = 'round';
    for (let i = -2; i <= 2; i++) {
      g.beginPath(); g.moveTo(i * 9, gy - 1); g.lineTo(i * 9, gy - gh + Math.abs(i) * 3 + 2); g.stroke();
    }
    for (const by of [gy - 14, gy - 32, gy - 48]) {
      g.beginPath(); g.moveTo(-gw / 2 + 3, by); g.lineTo(gw / 2 - 3, by); g.stroke();
    }
    g.strokeStyle = 'rgba(255,255,255,0.3)'; g.lineWidth = 1.2;
    for (let i = -2; i <= 2; i++) {
      g.beginPath(); g.moveTo(i * 9 - 1, gy - 4); g.lineTo(i * 9 - 1, gy - gh + Math.abs(i) * 3 + 6); g.stroke();
    }
    // gold keystone + wall shine
    g.fillStyle = gold;
    rr(g, -6, gy - gh - 8, 12, 12, 3); g.fill(); outl(g, 2);
    shine(g, -52, -36, 9, 4.5, -0.4, 0.22);
    g.restore();
  }

  function terrain(map) {
    const c = cv(map.w || 1280, map.h || 720);
    const g = c.getContext('2d');
    const theme = map.theme || 'meadow';
    const T = (FLAVOR==='reef'?REEF_THEMES:THEMES)[theme] || THEMES.meadow;
    const R = mulberry32(theme === 'meadow' ? 1001 : theme === 'autumn' ? 2002 : 3003);
    drawGround(g, T, theme, R, c.width, c.height);
    vignette(g, c.width, c.height);
    drawPaths(g, T, map.pathsPx || [], R);
    for (const sp of (map.spawns || [])) drawPortal(g, T, sp.x, sp.y, R);
    const decor = (map.decor || []).slice().sort((a, b) => a.y - b.y);
    for (const d of decor) drawDecor(g, T, theme, d, R);
    if (map.castle) drawCastle(g, T, theme, map.castle.x, map.castle.y, R);
    return c;
  }

  /* =================== TOWERS =================== */
  const TOWER_IDS = ['archer', 'cannon', 'frost', 'flame', 'ballista', 'poison', 'storm', 'mint', 'beacon', 'arbalest', 'barracks', 'lodge', 'siegecamp'];
  const TOWER_HUE = {
    archer: '#c9a227', cannon: '#7a7f8a', frost: '#69c8e8', flame: '#e8712a',
    ballista: '#a8743a', poison: '#7ec244', storm: '#b48ce8', mint: '#e8c93a', beacon: '#f0e6b4', arbalest: '#7a94b8', wall: '#8d8798',
    barracks: '#b0623c', lodge: '#3a7a44', siegecamp: '#7a7f8a'
  };
  const WOOD = '#96683a', STONE = '#9a95a4', GOLD = '#e8c34a';

  // trapezoid tower body with cel shading. (x,y)=bottom center.
  function body(g, x, y, wB, wT, h, col, o) {
    o = o || {};
    poly(g, [[x - wB / 2, y], [x - wT / 2, y - h], [x + wT / 2, y - h], [x + wB / 2, y]]);
    g.fillStyle = col; g.fill(); outl(g, o.ow || 2.4);
    // right shadow
    poly(g, [[x + wB / 2, y], [x + wT / 2, y - h], [x + wT * 0.14, y - h], [x + wB * 0.14, y]]);
    g.fillStyle = 'rgba(20,14,26,0.24)'; g.fill();
    // left highlight
    poly(g, [[x - wB / 2 + 3, y], [x - wT / 2 + 3, y - h], [x - wT * 0.24, y - h], [x - wB * 0.24, y]]);
    g.fillStyle = 'rgba(255,250,235,0.14)'; g.fill();
  }
  function plankLines(g, x, y, wB, wT, h, n) {
    g.strokeStyle = 'rgba(40,26,16,0.4)'; g.lineWidth = 1.6;
    for (let i = 1; i < n; i++) {
      const t = i / n, w = wB + (wT - wB) * t;
      g.beginPath(); g.moveTo(x - w / 2 + 2, y - h * t); g.lineTo(x + w / 2 - 2, y - h * t); g.stroke();
    }
  }
  function stoneHints(g, x, y, wB, wT, h, R) {
    g.strokeStyle = 'rgba(30,22,40,0.28)'; g.lineWidth = 1.2;
    for (let i = 0; i < h / 7; i++) {
      const t = R(), w = (wB + (wT - wB) * t) - 8;
      const bx = x - w / 2 + R() * (w - 10), by = y - h * t - 2;
      g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + 6 + R() * 6, by); g.stroke();
    }
  }
  function band(g, x, y, w, h, col) {
    rr(g, x - w / 2, y - h / 2, w, h, 3);
    g.fillStyle = col; g.fill(); outl(g, 2);
    g.fillStyle = 'rgba(255,255,255,0.25)';
    rr(g, x - w / 2 + 2, y - h / 2 + 1.5, w * 0.4, 2.4, 1.2); g.fill();
    g.fillStyle = 'rgba(20,14,26,0.22)';
    rr(g, x + w * 0.12, y - h / 2 + 1.5, w * 0.36, h - 3, 2); g.fill();
  }
  function banner(g, x, y, hue, len) {
    len = len || 24;
    g.strokeStyle = '#5a4026'; g.lineWidth = 3; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 8); g.stroke();
    poly(g, [[x - 6, y - 7], [x + 6, y - 7], [x + 6, y + len - 10], [x, y + len - 16], [x - 6, y + len - 10]]);
    g.fillStyle = hue; g.fill(); outl(g, 2);
    g.fillStyle = 'rgba(20,14,26,0.22)';
    poly(g, [[x + 1, y - 7], [x + 6, y - 7], [x + 6, y + len - 10], [x + 1, y + len - 14]]); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.3)';
    g.fillRect(x - 5, y - 5.5, 4, 2);
  }
  function crownGlow(g, x, y, hue) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = sh(hue, 1.3, 0.55); g.lineWidth = 3;
    g.beginPath(); g.ellipse(x, y, 34, 10, 0, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = lt(hue, 0.6, 0.35); g.lineWidth = 6;
    g.beginPath(); g.ellipse(x, y, 34, 10, 0, 0, Math.PI * 2); g.stroke();
    g.restore();
  }
  function gem(g, x, y, r, hue) {
    poly(g, [[x - r, y], [x, y - r * 1.2], [x + r, y], [x, y + r * 1.2]]);
    g.fillStyle = hue; g.fill(); outl(g, 2);
    poly(g, [[x - r * 0.5, y - r * 0.1], [x, y - r * 0.9], [x + r * 0.15, y - r * 0.15]]);
    g.fillStyle = 'rgba(255,255,255,0.6)'; g.fill();
  }
  function roofCone(g, x, yTop, w, h, col) {
    poly(g, [[x - w / 2, yTop], [x + w / 2, yTop], [x, yTop - h]]);
    g.fillStyle = col; g.fill(); outl(g, 2.4);
    poly(g, [[x, yTop - h], [x + w / 2, yTop], [x + w * 0.16, yTop]]);
    g.fillStyle = 'rgba(20,14,26,0.26)'; g.fill();
    poly(g, [[x, yTop - h], [x - w / 2, yTop], [x - w * 0.3, yTop]]);
    g.fillStyle = 'rgba(255,250,230,0.2)'; g.fill();
  }

  // ---- per-tower painters: draw with ground anchor at (48,116); return mountH ----
  function tArcher(g, lvl, R) {
    const x = 48, y = 116;
    const h = 52 + lvl * 7;
    const wood = lvl === 1 ? WOOD : sh(WOOD, 1.05).replace ? WOOD : WOOD;
    shadowEllipse(g, x, y, 34, 9, 0.32);
    if (lvl === 1) {
      body(g, x, y, 52, 40, h, WOOD);
      plankLines(g, x, y, 52, 40, h, 5);
    } else {
      body(g, x, y, 54, 42, h * 0.55, STONE);
      stoneHints(g, x, y, 54, 42, h * 0.55, R);
      body(g, x, y - h * 0.55 + 2, 46, 38, h * 0.45 + 2, WOOD);
      plankLines(g, x, y - h * 0.55 + 2, 46, 38, h * 0.45, 3);
    }
    // arrow slit
    g.fillStyle = '#241c30';
    rr(g, x - 2.5, y - h * 0.62, 5, 13, 2.5); g.fill(); outl(g, 1.6);
    // platform
    const py = y - h;
    g.fillStyle = lvl === 1 ? sh(WOOD, 1.12) : sh(STONE, 1.05);
    rr(g, x - 30, py - 8, 60, 10, 3); g.fill(); outl(g, 2.4);
    g.fillStyle = 'rgba(20,14,26,0.22)'; rr(g, x + 6, py - 6.5, 22, 7, 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.2)'; rr(g, x - 27, py - 7, 18, 2.5, 1); g.fill();
    // railing posts
    g.fillStyle = sh(WOOD, 0.8);
    for (const px of [-27, 27]) { rr(g, x + px - 2.5, py - 20, 5, 14, 2); g.fill(); outl(g, 1.8); }
    // peaked roof canopy on back posts
    roofCone(g, x, py - 34, 46, 18, lvl >= 4 ? TOWER_HUE.archer : '#8a4a30');
    g.fillStyle = sh(WOOD, 0.8);
    rr(g, x - 20, py - 34, 4, 16, 2); g.fill(); outl(g, 1.6);
    rr(g, x + 16, py - 34, 4, 16, 2); g.fill(); outl(g, 1.6);
    if (lvl >= 2) band(g, x, y - 6, 56, 7, sh(STONE, 0.85));
    if (lvl >= 3) banner(g, x - 33, y - h * 0.55, TOWER_HUE.archer, 22);
    if (lvl >= 4) { band(g, x, y - h * 0.55, 50, 6, sh(TOWER_HUE.archer, 0.9)); }
    if (lvl >= 5) {
      crownGlow(g, x, y - 4, TOWER_HUE.archer);
      gem(g, x, py - 55, 5, GOLD);
      band(g, x, py - 3, 62, 6, GOLD);
    }
    return h + 14;
  }
  function tCannon(g, lvl, R) {
    const x = 48, y = 116;
    const h = 38 + lvl * 5;
    shadowEllipse(g, x, y, 38, 10, 0.34);
    // squat round bastion
    const col = lvl === 1 ? WOOD : STONE;
    g.fillStyle = col;
    g.beginPath();
    g.ellipse(x, y - 6, 34, 12, 0, 0, Math.PI);
    g.lineTo(x - 34, y - h);
    g.ellipse(x, y - h, 34, 11, 0, Math.PI, 0);
    g.lineTo(x + 34, y - 6);
    g.closePath(); g.fill(); outl(g, 2.6);
    // side shading
    g.fillStyle = 'rgba(20,14,26,0.24)';
    g.beginPath();
    g.moveTo(x + 12, y - 2); g.lineTo(x + 12, y - h + 4);
    g.quadraticCurveTo(x + 30, y - h + 2, x + 34, y - h);
    g.lineTo(x + 34, y - 6); g.quadraticCurveTo(x + 28, y + 2, x + 12, y - 2);
    g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,250,235,0.15)';
    g.fillRect(x - 30, y - h + 3, 9, h - 8);
    if (lvl === 1) plankLines(g, x, y - 2, 62, 62, h - 8, 4);
    else stoneHints(g, x, y - 2, 64, 64, h - 8, R);
    // reinforced ring: front arc hugging the body
    const ringCol = lvl >= 4 ? sh(TOWER_HUE.cannon, 0.75) : '#4e4a56';
    const ryy = y - h * 0.5;
    g.strokeStyle = OUT; g.lineWidth = 9.5; g.lineCap = 'round';
    g.beginPath(); g.ellipse(x, ryy, 33.5, 10, 0, 0.12, Math.PI - 0.12); g.stroke();
    g.strokeStyle = ringCol; g.lineWidth = 6.5;
    g.beginPath(); g.ellipse(x, ryy, 33.5, 10, 0, 0.12, Math.PI - 0.12); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 1.8;
    g.beginPath(); g.ellipse(x, ryy - 2, 33, 9.5, 0, Math.PI * 0.55, Math.PI * 0.92); g.stroke();
    // rivets along the front arc
    g.fillStyle = '#c8ccd6';
    for (const a of [0.2, 0.45, 0.62, 0.85]) {
      const rx = x + Math.cos(Math.PI * a) * 32.5, ry2 = ryy + Math.sin(Math.PI * a) * 9.6;
      g.beginPath(); g.arc(rx, ry2, 2, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(24,18,32,0.7)'; g.lineWidth = 1.2;
      g.beginPath(); g.arc(rx, ry2, 2, 0, Math.PI * 2); g.stroke();
    }
    // top rim
    g.fillStyle = sh(col, 1.1);
    g.beginPath(); g.ellipse(x, y - h, 34, 11, 0, 0, Math.PI * 2); g.fill(); outl(g, 2.4);
    g.fillStyle = sh(col, 0.8);
    g.beginPath(); g.ellipse(x, y - h, 27, 8, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(24,18,32,0.6)'; g.lineWidth = 1.6; g.stroke();
    shine(g, x - 16, y - h - 4, 8, 3, -0.3, 0.3);
    if (lvl >= 3) banner(g, x - 37, y - h * 0.75, TOWER_HUE.cannon, 20);
    if (lvl >= 5) {
      crownGlow(g, x, y - 4, '#aab2c0');
      band(g, x, y - 8, 70, 6, GOLD);
      gem(g, x + 30, y - h - 6, 4, GOLD);
    }
    return h + 4;
  }
  function tFrost(g, lvl, R) {
    const x = 48, y = 116;
    const H = 62 + lvl * 9;
    const c = TOWER_HUE.frost;
    shadowEllipse(g, x, y, 34, 9, 0.3);
    // cold mist ring
    g.save();
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * Math.PI * 2;
      glow(g, x + Math.cos(a) * 26, y - 2 + Math.sin(a) * 6, 12, '#bce8f8', 0.22);
    }
    g.restore();
    // rocky base (stone at L2+, ice at 1)
    body(g, x, y, 46, 34, 16, lvl === 1 ? mix(c, '#ffffff', 0.15) : STONE);
    if (lvl >= 2) stoneHints(g, x, y, 46, 34, 16, R);
    // main spire + side shards
    const shards = [
      [0, -14, H, 15],
      [-16, -12, H * 0.55, 9],
      [15, -10, H * 0.48, 8]
    ];
    if (lvl >= 3) shards.push([-25, -8, H * 0.32, 6], [24, -7, H * 0.3, 5.5]);
    for (const sd of shards) {
      const sx = x + sd[0], sy = y + sd[1], shh = sd[2], sw = sd[3];
      poly(g, [[sx - sw, sy], [sx - sw * 0.5, sy - shh], [sx, sy - shh * 1.12], [sx + sw * 0.6, sy - shh * 0.85], [sx + sw, sy]]);
      g.fillStyle = sh(c, 0.85, 0.92); g.fill(); outl(g, 2.4);
      // facets
      poly(g, [[sx + sw, sy], [sx + sw * 0.6, sy - shh * 0.85], [sx + sw * 0.15, sy - shh * 0.4], [sx + sw * 0.3, sy]]);
      g.fillStyle = sh(c, 0.6, 0.9); g.fill();
      poly(g, [[sx - sw * 0.7, sy], [sx - sw * 0.4, sy - shh * 0.8], [sx - sw * 0.1, sy - shh * 0.95], [sx - sw * 0.15, sy]]);
      g.fillStyle = lt(c, 0.55, 0.95); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(sx - sw * 0.2, sy - 4); g.lineTo(sx, sy - shh * 1.05); g.stroke();
    }
    // inner glow at heart
    glow(g, x, y - H * 0.5, 20, '#aef0ff', 0.4);
    shine(g, x - 5, y - H * 0.85, 3, 7, 0.12, 0.55);
    if (lvl >= 3) banner(g, x - 30, y - 16, c, 18);
    if (lvl >= 4) {
      // orbiting ice motes
      for (const m of [[-30, -H * 0.7, 3], [32, -H * 0.55, 2.6], [-24, -H * 0.95, 2.2]]) {
        poly(g, [[x + m[0] - m[2], y + m[1]], [x + m[0], y + m[1] - m[2] * 1.4], [x + m[0] + m[2], y + m[1]], [x + m[0], y + m[1] + m[2] * 1.4]]);
        g.fillStyle = lt(c, 0.5, 0.95); g.fill(); outl(g, 1.6);
      }
    }
    if (lvl >= 5) {
      crownGlow(g, x, y - 2, c);
      gem(g, x, y - H * 1.12 - 8, 5.5, '#e8f6ff');
      glow(g, x, y - H * 1.12 - 8, 16, '#ffffff', 0.5);
    }
    return H;
  }
  function tFlame(g, lvl, R) {
    const x = 48, y = 116;
    const h = 44 + lvl * 6;
    const c = TOWER_HUE.flame;
    shadowEllipse(g, x, y, 34, 9, 0.34);
    const obsidian = '#3a3040';
    // tower body: obsidian tapered block
    body(g, x, y, 50, 34, h, lvl === 1 ? '#5c4030' : obsidian);
    if (lvl === 1) plankLines(g, x, y, 50, 34, h, 4);
    else {
      // obsidian facets
      g.strokeStyle = 'rgba(255,120,50,0.35)'; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(x - 14, y - 6); g.lineTo(x - 8, y - h * 0.6); g.moveTo(x + 10, y - 10); g.lineTo(x + 6, y - h * 0.5); g.stroke();
    }
    // glowing seams
    glow(g, x, y - h * 0.4, 18, c, 0.22);
    // brazier bowl
    const by = y - h;
    g.fillStyle = lvl >= 4 ? sh(c, 0.55) : '#4e3a34';
    g.beginPath();
    g.moveTo(x - 30, by - 4);
    g.quadraticCurveTo(x, by + 14, x + 30, by - 4);
    g.lineTo(x + 24, by - 14);
    g.quadraticCurveTo(x, by - 4, x - 24, by - 14);
    g.closePath(); g.fill(); outl(g, 2.6);
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.beginPath(); g.ellipse(x - 14, by - 9, 8, 3, -0.2, 0, Math.PI * 2); g.fill();
    // flame crown (cel: 3 tones)
    const fy = by - 12;
    glow(g, x, fy - 12, 34, c, 0.5);
    poly(g, [[x - 18, fy], [x - 12, fy - 16], [x - 6, fy - 8], [x, fy - 34 - lvl * 2], [x + 7, fy - 10], [x + 13, fy - 18], [x + 18, fy]]);
    g.fillStyle = '#e85820'; g.fill(); outl(g, 2.4);
    poly(g, [[x - 11, fy], [x - 6, fy - 10], [x, fy - 24 - lvl], [x + 6, fy - 9], [x + 11, fy]]);
    g.fillStyle = '#ffa030'; g.fill();
    poly(g, [[x - 5, fy], [x, fy - 13], [x + 5, fy]]);
    g.fillStyle = '#ffe27a'; g.fill();
    if (lvl >= 2) band(g, x, y - 6, 52, 7, sh(STONE, 0.8));
    if (lvl >= 3) banner(g, x - 30, y - h * 0.6, c, 20);
    if (lvl >= 5) {
      crownGlow(g, x, y - 2, c);
      gem(g, x - 26, by - 16, 4, GOLD);
      gem(g, x + 26, by - 16, 4, GOLD);
    }
    return h + 16;
  }

  function tBallista(g, lvl, R) {
    const x = 48, y = 116;
    const h = 42 + lvl * 6;
    shadowEllipse(g, x, y, 36, 9, 0.32);
    const wood = TOWER_HUE.ballista;
    // crossed support beams
    g.lineCap = 'round';
    for (const sd of [-1, 1]) {
      g.strokeStyle = OUT; g.lineWidth = 11;
      g.beginPath(); g.moveTo(x + sd * 26, y - 2); g.lineTo(x - sd * 16, y - h + 6); g.stroke();
      g.strokeStyle = sh(wood, 0.85); g.lineWidth = 8;
      g.beginPath(); g.moveTo(x + sd * 26, y - 2); g.lineTo(x - sd * 16, y - h + 6); g.stroke();
      g.strokeStyle = 'rgba(255,250,230,0.22)'; g.lineWidth = 2.4;
      g.beginPath(); g.moveTo(x + sd * 24, y - 5); g.lineTo(x - sd * 14, y - h + 8); g.stroke();
    }
    if (lvl >= 2) {
      // stone footing blocks
      for (const sd of [-1, 1]) {
        g.fillStyle = STONE;
        rr(g, x + sd * 26 - 9, y - 12, 18, 13, 3); g.fill(); outl(g, 2.2);
        g.fillStyle = 'rgba(20,14,26,0.22)'; rr(g, x + sd * 26 + 1, y - 10, 7, 9, 2); g.fill();
      }
    }
    // lashings
    g.strokeStyle = '#5c3c1e'; g.lineWidth = 2.4;
    g.beginPath(); g.moveTo(x - 6, y - h * 0.5 - 4); g.lineTo(x + 6, y - h * 0.5 + 4);
    g.moveTo(x - 6, y - h * 0.5 + 4); g.lineTo(x + 6, y - h * 0.5 - 4); g.stroke();
    // deck platform
    const py = y - h;
    g.fillStyle = sh(wood, 1.05);
    rr(g, x - 32, py - 9, 64, 12, 3); g.fill(); outl(g, 2.6);
    plankLines(g, x, py + 3, 62, 62, 10, 2);
    g.fillStyle = 'rgba(20,14,26,0.22)'; rr(g, x + 8, py - 7, 22, 8, 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.22)'; rr(g, x - 29, py - 8, 16, 2.6, 1.2); g.fill();
    // deck rim bolts
    g.fillStyle = '#3e3644';
    for (const bx of [-27, -9, 9, 27]) { g.beginPath(); g.arc(x + bx, py - 3, 1.8, 0, Math.PI * 2); g.fill(); }
    if (lvl >= 3) banner(g, x - 34, y - h * 0.4, wood, 20);
    if (lvl >= 4) band(g, x, py + 1, 66, 5, sh(TOWER_HUE.ballista, 0.7));
    if (lvl >= 5) {
      crownGlow(g, x, y - 2, GOLD);
      gem(g, x, py - 13, 4.5, GOLD);
    }
    return h + 12;
  }
  function tPoison(g, lvl, R) {
    const x = 48, y = 116;
    const c = TOWER_HUE.poison;
    const h = 40 + lvl * 5;
    shadowEllipse(g, x, y, 36, 9, 0.32);
    // hut body
    const wall = lvl === 1 ? WOOD : '#8a7a68';
    body(g, x + 4, y, 52, 46, h * 0.75, wall);
    if (lvl === 1) plankLines(g, x + 4, y, 52, 46, h * 0.75, 4);
    else stoneHints(g, x + 4, y, 52, 46, h * 0.75, R);
    // thatch/moss roof
    const ry = y - h * 0.75;
    poly(g, [[x - 26, ry + 2], [x + 34, ry + 2], [x + 26, ry - 18 - lvl * 2], [x - 16, ry - 18 - lvl * 2]]);
    g.fillStyle = sh(c, 0.55); g.fill(); outl(g, 2.6);
    poly(g, [[x - 26, ry + 2], [x - 16, ry - 18 - lvl * 2], [x - 6, ry - 18 - lvl * 2], [x - 14, ry + 2]]);
    g.fillStyle = sh(c, 0.75); g.fill();
    g.fillStyle = 'rgba(20,14,26,0.24)';
    poly(g, [[x + 18, ry + 2], [x + 34, ry + 2], [x + 26, ry - 18 - lvl * 2], [x + 16, ry - 18 - lvl * 2]]); g.fill();
    shine(g, x - 12, ry - 14, 6, 2.6, -0.2, 0.25);
    // round window
    g.fillStyle = '#241c30';
    g.beginPath(); g.arc(x + 12, y - h * 0.42, 6, 0, Math.PI * 2); g.fill(); outl(g, 2);
    g.fillStyle = sh(c, 1.3, 0.9);
    g.beginPath(); g.arc(x + 12, y - h * 0.42, 3.6, 0, Math.PI * 2); g.fill();
    // chimney with green wisp
    g.fillStyle = sh(wall, 0.8);
    rr(g, x + 18, ry - 30 - lvl * 2, 10, 16, 2); g.fill(); outl(g, 2.2);
    glow(g, x + 23, ry - 34 - lvl * 2, 10, c, 0.5);
    // cauldron in front
    const cy = y - 4, cx = x - 22;
    g.fillStyle = '#3a3644';
    g.beginPath();
    g.moveTo(cx - 14, cy - 14);
    g.quadraticCurveTo(cx - 16, cy + 2, cx, cy + 4);
    g.quadraticCurveTo(cx + 16, cy + 2, cx + 14, cy - 14);
    g.closePath(); g.fill(); outl(g, 2.4);
    g.fillStyle = 'rgba(255,255,255,0.16)';
    g.beginPath(); g.ellipse(cx - 7, cy - 6, 4, 6, 0.3, 0, Math.PI * 2); g.fill();
    // bubbling brew
    glow(g, cx, cy - 16, 16, c, 0.5);
    g.fillStyle = sh(c, 1.1);
    g.beginPath(); g.ellipse(cx, cy - 14, 13, 4.5, 0, 0, Math.PI * 2); g.fill(); outl(g, 2);
    g.fillStyle = lt(c, 0.5);
    for (const b of [[-6, -19, 2.4], [2, -22, 3], [8, -18, 2]]) {
      g.beginPath(); g.arc(cx + b[0], cy + b[1], b[2], 0, Math.PI * 2); g.fill();
    }
    g.strokeStyle = OUT; g.lineWidth = 1.4;
    for (const b of [[-6, -19, 2.4], [2, -22, 3], [8, -18, 2]]) {
      g.beginPath(); g.arc(cx + b[0], cy + b[1], b[2], 0, Math.PI * 2); g.stroke();
    }
    // glass retort on a shelf
    g.fillStyle = 'rgba(190,240,200,0.55)';
    g.beginPath(); g.arc(x + 30, y - 10, 6, 0, Math.PI * 2); g.fill(); outl(g, 2);
    g.fillStyle = sh(c, 1.2, 0.85);
    g.beginPath(); g.arc(x + 30, y - 8.4, 3.8, 0, Math.PI); g.fill();
    g.fillStyle = 'rgba(190,240,200,0.55)';
    rr(g, x + 28.5, y - 22, 3, 8, 1.5); g.fill(); outl(g, 1.6);
    shine(g, x + 28, y - 12, 1.6, 2.4, 0.3, 0.6);
    if (lvl >= 3) banner(g, x + 36, y - h * 0.5, c, 18);
    if (lvl >= 5) { crownGlow(g, x, y - 2, c); gem(g, x + 5, ry - 24 - lvl * 2, 4.5, '#c8f0a0'); }
    return h * 0.75 + 18;
  }
  function tStorm(g, lvl, R) {
    const x = 48, y = 116;
    const c = TOWER_HUE.storm;
    const h = 56 + lvl * 8;
    shadowEllipse(g, x, y, 32, 9, 0.32);
    // twisting spire
    const bodyCol = lvl === 1 ? WOOD : '#5c4a78';
    body(g, x, y, 44, 20, h, bodyCol);
    if (lvl === 1) plankLines(g, x, y, 44, 20, h, 5);
    // spiral seam
    g.strokeStyle = lvl === 1 ? 'rgba(40,26,16,0.4)' : sh(c, 0.8, 0.8);
    g.lineWidth = 2.4;
    g.beginPath();
    g.moveTo(x - 18, y - 8);
    g.bezierCurveTo(x + 22, y - h * 0.3, x - 22, y - h * 0.62, x + 9, y - h + 4);
    g.stroke();
    // coil rings hugging the spire (front arcs)
    for (let i = 0; i < (lvl >= 4 ? 3 : 2); i++) {
      const t = 0.34 + i * 0.24;
      const ry = y - h * t;
      const rw = (44 + (20 - 44) * t) / 2 + 4.5;
      g.strokeStyle = OUT; g.lineWidth = 7; g.lineCap = 'round';
      g.beginPath(); g.ellipse(x, ry, rw, rw * 0.34, 0, 0.15, Math.PI - 0.15); g.stroke();
      g.strokeStyle = lvl >= 5 ? GOLD : '#c8b078'; g.lineWidth = 4.2;
      g.beginPath(); g.ellipse(x, ry, rw, rw * 0.34, 0, 0.15, Math.PI - 0.15); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 1.6;
      g.beginPath(); g.ellipse(x, ry - 1.5, rw - 1, rw * 0.3, 0, Math.PI * 0.55, Math.PI * 0.9); g.stroke();
    }
    // floating orb
    const oy = y - h - 18;
    glow(g, x, oy, 26 + lvl * 2, c, 0.55);
    g.fillStyle = sh(c, 0.75);
    g.beginPath(); g.arc(x, oy, 11 + lvl, 0, Math.PI * 2); g.fill(); outl(g, 2.4);
    g.fillStyle = sh(c, 1.15);
    g.beginPath(); g.arc(x - 2, oy - 2, 7 + lvl * 0.7, 0, Math.PI * 2); g.fill();
    shine(g, x - 4, oy - 5, 3.4, 2.2, -0.5, 0.55);
    // static arcs baked
    g.strokeStyle = '#eadcff'; g.lineWidth = 2; g.lineCap = 'round';
    const arcs = [[-1, 0.2], [1, -0.15], [-0.6, -0.9]];
    for (const a of arcs) {
      g.beginPath();
      let ax = x + a[0] * (13 + lvl), ay = oy + a[1] * 10;
      g.moveTo(ax, ay);
      for (let s = 0; s < 3; s++) {
        ax += a[0] * (5 + R() * 5); ay += (R() - 0.5) * 9 - 2;
        g.lineTo(ax, ay);
      }
      g.stroke();
    }
    if (lvl >= 3) banner(g, x - 26, y - 14, c, 18);
    if (lvl >= 5) { crownGlow(g, x, y - 2, c); gem(g, x, y - h + 2, 4.5, '#e8d8ff'); }
    return h + 18;
  }
  function tMint(g, lvl, R) {
    const x = 48, y = 116;
    const c = TOWER_HUE.mint;
    const h = 40 + lvl * 5;
    shadowEllipse(g, x, y, 36, 9, 0.32);
    const wall = lvl === 1 ? WOOD : '#b0a08a';
    // vault-house
    body(g, x - 2, y, 56, 50, h * 0.78, wall);
    if (lvl === 1) plankLines(g, x - 2, y, 56, 50, h * 0.78, 4);
    else stoneHints(g, x - 2, y, 56, 50, h * 0.78, R);
    // roof
    const ry = y - h * 0.78;
    poly(g, [[x - 33, ry + 2], [x + 29, ry + 2], [x + 17, ry - 16 - lvl * 2], [x - 21, ry - 16 - lvl * 2]]);
    g.fillStyle = lvl >= 4 ? sh(c, 0.72) : '#8a4a30'; g.fill(); outl(g, 2.6);
    g.fillStyle = 'rgba(20,14,26,0.24)';
    poly(g, [[x + 13, ry + 2], [x + 29, ry + 2], [x + 17, ry - 16 - lvl * 2], [x + 7, ry - 16 - lvl * 2]]); g.fill();
    g.fillStyle = 'rgba(255,250,230,0.2)';
    poly(g, [[x - 33, ry + 2], [x - 21, ry - 16 - lvl * 2], [x - 13, ry - 16 - lvl * 2], [x - 22, ry + 2]]); g.fill();
    // chimney
    g.fillStyle = sh(wall, 0.78);
    rr(g, x + 12, ry - 28 - lvl * 2, 11, 18, 2); g.fill(); outl(g, 2.2);
    g.fillStyle = 'rgba(255,255,255,0.2)'; g.fillRect(x + 13.5, ry - 26 - lvl * 2, 3, 12);
    // door
    g.fillStyle = '#4e3620';
    rr(g, x - 22, y - 24, 16, 24, 6); g.fill(); outl(g, 2.2);
    g.fillStyle = 'rgba(255,255,255,0.14)'; rr(g, x - 20, y - 21, 5, 17, 2.5); g.fill();
    g.fillStyle = GOLD; g.beginPath(); g.arc(x - 10, y - 12, 1.8, 0, Math.PI * 2); g.fill();
    // gold coin emblem on front
    const ex = x + 8, ey = y - h * 0.45;
    g.fillStyle = sh(c, 0.7);
    g.beginPath(); g.arc(ex, ey, 11, 0, Math.PI * 2); g.fill(); outl(g, 2.4);
    g.fillStyle = c;
    g.beginPath(); g.arc(ex - 1, ey - 1, 8.4, 0, Math.PI * 2); g.fill();
    g.fillStyle = sh(c, 0.72);
    g.font = 'bold 11px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('$', ex - 0.5, ey - 0.5);
    shine(g, ex - 3.4, ey - 4, 2.6, 1.6, -0.5, 0.5);
    // coin stack by the door
    let sy = y - 3;
    for (let i = 0; i < 3 + lvl; i++) {
      g.fillStyle = i % 2 ? c : sh(c, 1.12);
      g.beginPath(); g.ellipse(x + 30, sy, 8, 3.2, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = OUT; g.lineWidth = 1.6; g.stroke();
      sy -= 4.4;
    }
    shine(g, x + 27, sy + 3, 3, 1.2, -0.2, 0.5);
    if (lvl >= 3) banner(g, x - 34, y - h * 0.55, c, 18);
    if (lvl >= 5) { crownGlow(g, x, y - 2, c); gem(g, x - 2, ry - 22 - lvl * 2, 4.5, GOLD); }
    return h * 0.78 + 14;
  }
  function tBeacon(g, lvl, R) {
    const x = 48, y = 116;
    const c = TOWER_HUE.beacon;
    const h = 54 + lvl * 8;
    shadowEllipse(g, x, y, 32, 9, 0.3);
    const marble = lvl === 1 ? WOOD : '#eee8dc';
    // stepped plinth
    g.fillStyle = sh(marble, 0.94);
    rr(g, x - 26, y - 10, 52, 12, 3); g.fill(); outl(g, 2.4);
    g.fillStyle = 'rgba(20,14,26,0.18)'; rr(g, x + 6, y - 8, 18, 8, 2); g.fill();
    // fluted pillar
    body(g, x, y - 8, 34, 26, h - 26, marble);
    g.strokeStyle = 'rgba(120,110,100,0.4)'; g.lineWidth = 1.6;
    for (const fx of [-8, 0, 8]) {
      g.beginPath(); g.moveTo(x + fx, y - 12); g.lineTo(x + fx * 0.82, y - h + 20); g.stroke();
    }
    // capital
    const ky = y - 8 - (h - 26);
    g.fillStyle = sh(marble, 1.02);
    rr(g, x - 20, ky - 8, 40, 10, 3); g.fill(); outl(g, 2.4);
    g.fillStyle = 'rgba(20,14,26,0.18)'; rr(g, x + 4, ky - 6, 14, 6, 2); g.fill();
    // radiant sun-disc
    const dy = ky - 26;
    glow(g, x, dy, 34 + lvl * 3, '#ffe9a0', 0.55);
    // rays
    g.fillStyle = sh(GOLD, 1.05);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2 + 0.4;
      g.save(); g.translate(x, dy); g.rotate(a);
      poly(g, [[12, -3], [22 + (i % 2) * 4, 0], [12, 3]]);
      g.fill(); outl(g, 1.8);
      g.restore();
    }
    g.fillStyle = GOLD;
    g.beginPath(); g.arc(x, dy, 13, 0, Math.PI * 2); g.fill(); outl(g, 2.4);
    g.fillStyle = lt(GOLD, 0.45);
    g.beginPath(); g.arc(x - 2, dy - 2, 8.5, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff6d8';
    g.beginPath(); g.arc(x - 3, dy - 3, 4, 0, Math.PI * 2); g.fill();
    if (lvl >= 3) banner(g, x - 27, y - 20, GOLD, 18);
    if (lvl >= 4) band(g, x, y - h + 16, 40, 5, GOLD);
    if (lvl >= 5) { crownGlow(g, x, y - 2, '#ffe9a0'); gem(g, x, ky - 4, 4, '#fff0c0'); }
    return h;
  }

  /* ---- turrets: art points RIGHT, pivot at (tpx,tpy) ---- */
  function turretArcher(lvl) {
    const c = cv(64, 56), g = c.getContext('2d');
    const px = 22, py = 28;
    const limb = lvl >= 4 ? sh(TOWER_HUE.archer, 0.85) : '#7a4c26';
    // bow: vertical recurve arc opening right
    g.lineCap = 'round';
    g.strokeStyle = OUT; g.lineWidth = 8;
    g.beginPath(); g.moveTo(px + 4, py - 22);
    g.bezierCurveTo(px + 22, py - 14, px + 22, py + 14, px + 4, py + 22);
    g.stroke();
    g.strokeStyle = limb; g.lineWidth = 4.6;
    g.beginPath(); g.moveTo(px + 4, py - 22);
    g.bezierCurveTo(px + 22, py - 14, px + 22, py + 14, px + 4, py + 22);
    g.stroke();
    g.strokeStyle = 'rgba(255,250,230,0.35)'; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(px + 7, py - 19);
    g.bezierCurveTo(px + 20, py - 12, px + 20, py + 12, px + 7, py + 19);
    g.stroke();
    // string
    g.strokeStyle = '#efe8da'; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(px + 4, py - 22); g.lineTo(px - 8, py); g.lineTo(px + 4, py + 22); g.stroke();
    // arrow
    g.strokeStyle = OUT; g.lineWidth = 5;
    g.beginPath(); g.moveTo(px - 8, py); g.lineTo(px + 32, py); g.stroke();
    g.strokeStyle = '#c8a060'; g.lineWidth = 2.6;
    g.beginPath(); g.moveTo(px - 8, py); g.lineTo(px + 30, py); g.stroke();
    // head
    poly(g, [[px + 30, py - 4], [px + 40, py], [px + 30, py + 4]]);
    g.fillStyle = '#c8ccd6'; g.fill(); outl(g, 2);
    // fletching
    g.fillStyle = lvl >= 3 ? TOWER_HUE.archer : '#d84040';
    poly(g, [[px - 8, py], [px - 15, py - 5], [px - 11, py]]); g.fill(); outl(g, 1.6);
    poly(g, [[px - 8, py], [px - 15, py + 5], [px - 11, py]]); g.fill(); outl(g, 1.6);
    // grip
    g.fillStyle = '#4e3620';
    rr(g, px + 8, py - 5, 6, 10, 3); g.fill(); outl(g, 1.8);
    return { c: c, px: px, py: py };
  }
  function turretCannon(lvl) {
    const c = cv(84, 48), g = c.getContext('2d');
    const px = 30, py = 24;
    const barrelLen = 34 + lvl * 2.5;
    // carriage hint
    g.fillStyle = '#5c4026';
    rr(g, px - 14, py - 7, 20, 14, 4); g.fill(); outl(g, 2);
    // barrel
    g.fillStyle = '#3c4048';
    rr(g, px - 10, py - 8, barrelLen + 10, 16, 7); g.fill(); outl(g, 2.4);
    g.fillStyle = 'rgba(20,14,26,0.3)';
    rr(g, px - 8, py + 1, barrelLen + 6, 6, 3); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.22)';
    rr(g, px - 7, py - 6.4, barrelLen + 2, 3.4, 1.6); g.fill();
    // bands
    for (const bx of [px + 2, px + barrelLen * 0.55]) {
      g.fillStyle = lvl >= 4 ? sh(TOWER_HUE.cannon, 0.7) : '#23262c';
      rr(g, bx, py - 9, 5, 18, 2); g.fill(); outl(g, 1.8);
    }
    // muzzle rim
    g.fillStyle = '#23262c';
    rr(g, px + barrelLen - 2, py - 10, 8, 20, 4); g.fill(); outl(g, 2.2);
    g.fillStyle = 'rgba(255,255,255,0.2)';
    rr(g, px + barrelLen - 0.5, py - 8.4, 3, 6, 1.5); g.fill();
    // muzzle hole
    g.fillStyle = '#0e0c12';
    g.beginPath(); g.ellipse(px + barrelLen + 6, py, 2.6, 6.5, 0, 0, Math.PI * 2); g.fill();
    // breech ball
    g.fillStyle = '#3c4048';
    g.beginPath(); g.arc(px - 13, py, 6.5, 0, Math.PI * 2); g.fill(); outl(g, 2.2);
    shine(g, px - 15, py - 2.4, 2.4, 1.6, -0.4, 0.4);
    if (lvl >= 5) { g.fillStyle = GOLD; rr(g, px + barrelLen * 0.3, py - 9, 4, 18, 2); g.fill(); outl(g, 1.6); }
    return { c: c, px: px, py: py };
  }
  function turretBallista(lvl) {
    const c = cv(88, 64), g = c.getContext('2d');
    const px = 32, py = 32;
    const wood = TOWER_HUE.ballista;
    g.lineCap = 'round';
    // limbs (swept back like a bow opening right)
    g.strokeStyle = OUT; g.lineWidth = 9;
    g.beginPath();
    g.moveTo(px + 16, py - 4); g.quadraticCurveTo(px + 12, py - 22, px - 6, py - 27);
    g.moveTo(px + 16, py + 4); g.quadraticCurveTo(px + 12, py + 22, px - 6, py + 27);
    g.stroke();
    g.strokeStyle = sh(wood, 0.8); g.lineWidth = 5.4;
    g.beginPath();
    g.moveTo(px + 16, py - 4); g.quadraticCurveTo(px + 12, py - 22, px - 6, py - 27);
    g.moveTo(px + 16, py + 4); g.quadraticCurveTo(px + 12, py + 22, px - 6, py + 27);
    g.stroke();
    g.strokeStyle = 'rgba(255,250,230,0.3)'; g.lineWidth = 1.8;
    g.beginPath(); g.moveTo(px + 14, py - 6); g.quadraticCurveTo(px + 10, py - 20, px - 4, py - 24); g.stroke();
    // string drawn back
    g.strokeStyle = '#efe8da'; g.lineWidth = 1.8;
    g.beginPath(); g.moveTo(px - 6, py - 27); g.lineTo(px - 14, py); g.lineTo(px - 6, py + 27); g.stroke();
    // stock beam
    g.fillStyle = sh(wood, 0.95);
    rr(g, px - 18, py - 5.5, 56, 11, 4); g.fill(); outl(g, 2.4);
    g.fillStyle = 'rgba(20,14,26,0.26)'; rr(g, px - 16, py + 0.5, 52, 4, 2); g.fill();
    g.fillStyle = 'rgba(255,250,230,0.25)'; rr(g, px - 15, py - 4.4, 46, 2.6, 1.3); g.fill();
    // winch drum
    g.fillStyle = '#5c4026';
    g.beginPath(); g.arc(px - 12, py, 5.5, 0, Math.PI * 2); g.fill(); outl(g, 2);
    g.strokeStyle = '#2e2018'; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(px - 16, py); g.lineTo(px - 8, py); g.moveTo(px - 12, py - 4); g.lineTo(px - 12, py + 4); g.stroke();
    // loaded bolt
    g.strokeStyle = OUT; g.lineWidth = 6;
    g.beginPath(); g.moveTo(px - 12, py); g.lineTo(px + 42, py); g.stroke();
    g.strokeStyle = '#caa268'; g.lineWidth = 3.4;
    g.beginPath(); g.moveTo(px - 12, py); g.lineTo(px + 40, py); g.stroke();
    poly(g, [[px + 40, py - 5], [px + 52, py], [px + 40, py + 5]]);
    g.fillStyle = '#c8ccd6'; g.fill(); outl(g, 2.2);
    shine(g, px + 43, py - 1.4, 2.6, 1, -0.3, 0.5);
    if (lvl >= 4) { g.fillStyle = sh(TOWER_HUE.ballista, 0.65); rr(g, px + 4, py - 7, 5, 14, 2); g.fill(); outl(g, 1.6); }
    return { c: c, px: px, py: py };
  }
  const TOWER_PAINT = {
    archer: tArcher, cannon: tCannon, frost: tFrost, flame: tFlame,
    ballista: tBallista, poison: tPoison, storm: tStorm, mint: tMint, beacon: tBeacon, arbalest: tBallista,
    barracks: tMint, lodge: tArcher, siegecamp: tCannon
  };
  function turretArbalest(lvl) {
    const t = turretBallista(Math.min(5, lvl + 1));
    const s = 1.3;
    const c2 = cv(Math.round(t.c.width * s), Math.round(t.c.height * s));
    c2.getContext('2d').drawImage(t.c, 0, 0, c2.width, c2.height);
    return { c: c2, px: t.px * s, py: t.py * s };
  }
  const TURRET_PAINT = { archer: turretArcher, cannon: turretCannon, ballista: turretBallista, arbalest: turretArbalest };
  /* premium towers reuse existing bases; render.js layers their flourishes on top */
  ['pHeal','pStorm','pGat','pShadow','pGod'].forEach(id=>{ if(TOWER_IDS.indexOf(id)<0)TOWER_IDS.push(id); });
  TOWER_PAINT.pHeal=tBeacon; TOWER_PAINT.pStorm=tStorm; TOWER_PAINT.pGat=tBallista; TOWER_PAINT.pShadow=tStorm; TOWER_PAINT.pGod=tBeacon;
  TURRET_PAINT.pGat=turretBallista;
  Object.assign(TOWER_HUE,{pHeal:'#54e0a0',pStorm:'#c060ff',pGat:'#ff5a3a',pShadow:'#8a3adf',pGod:'#ffd75e'});

  function renderTower(id, lvl) {
    const c = cv(96, 122), g = c.getContext('2d');
    const R = mulberry32(9000 + TOWER_IDS.indexOf(id) * 97 + lvl * 13);
    const mountH = TOWER_PAINT[id](g, lvl, R);
    const out = { base: c, ax: 48, ay: 116, turret: null, tpx: 0, tpy: 0, mountH: mountH };
    if (TURRET_PAINT[id]) {
      const t = TURRET_PAINT[id](lvl);
      out.turret = t.c; out.tpx = t.px; out.tpy = t.py;
    }
    return out;
  }

  /* =================== ICONS =================== */
  function splash(g, col) {
    glow(g, 22, 22, 20, col, 0.5);
    g.fillStyle = sh(col, 1, 0.28);
    g.beginPath(); g.arc(22, 22, 15, 0, Math.PI * 2); g.fill();
  }
  function iSword(g, x, y, len, ang, col) {
    g.save(); g.translate(x, y); g.rotate(ang);
    poly(g, [[-3.5, 0], [-2.2, -len], [0, -len - 5], [2.2, -len], [3.5, 0]]);
    g.fillStyle = col || '#cdd2dc'; g.fill(); outl(g, 2);
    g.fillStyle = 'rgba(255,255,255,0.5)';
    poly(g, [[-2.2, -2], [-1.4, -len], [0, -len - 4], [-0.2, -2]]); g.fill();
    g.fillStyle = 'rgba(20,14,26,0.25)'; poly(g, [[1, -2], [1.6, -len], [3.5, 0]]); g.fill();
    // guard
    g.fillStyle = GOLD; rr(g, -7, -1, 14, 4, 2); g.fill(); outl(g, 1.8);
    // grip + pommel
    g.fillStyle = '#6a4526'; rr(g, -2, 3, 4, 8, 2); g.fill(); outl(g, 1.6);
    g.fillStyle = GOLD; g.beginPath(); g.arc(0, 13, 2.6, 0, Math.PI * 2); g.fill(); outl(g, 1.6);
    g.restore();
  }
  function iAxe(g, x, y, s, ang, twin) {
    g.save(); g.translate(x, y); g.rotate(ang); g.scale(s, s);
    g.strokeStyle = OUT; g.lineWidth = 6.4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(0, 14); g.lineTo(0, -12); g.stroke();
    g.strokeStyle = '#8a5a30'; g.lineWidth = 3.6;
    g.beginPath(); g.moveTo(0, 14); g.lineTo(0, -12); g.stroke();
    g.strokeStyle = 'rgba(255,250,230,0.4)'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(-0.8, 12); g.lineTo(-0.8, -10); g.stroke();
    const sides = twin ? [-1, 1] : [1];
    for (const sd of sides) {
      g.beginPath();
      g.moveTo(sd * 1, -12);
      g.quadraticCurveTo(sd * 12, -16, sd * 13, -6);
      g.quadraticCurveTo(sd * 9, -8, sd * 1, -5);
      g.closePath();
      g.fillStyle = '#cdd2dc'; g.fill(); outl(g, 2);
      g.fillStyle = 'rgba(255,255,255,0.5)';
      g.beginPath(); g.moveTo(sd * 2, -11.4); g.quadraticCurveTo(sd * 9, -14, sd * 11.6, -8); g.quadraticCurveTo(sd * 8, -11, sd * 2, -9.6); g.closePath(); g.fill();
    }
    g.restore();
  }
  function iShield(g, x, y, s, col, winged) {
    g.save(); g.translate(x, y); g.scale(s, s);
    if (winged) {
      g.fillStyle = '#eee8dc';
      for (const sd of [-1, 1]) {
        poly(g, [[sd * 8, -8], [sd * 20, -14], [sd * 16, -6], [sd * 21, -6], [sd * 14, 0], [sd * 8, 0]]);
        g.fill(); outl(g, 1.8);
      }
    }
    poly(g, [[-10, -12], [10, -12], [11, 2], [0, 15], [-11, 2]]);
    g.fillStyle = col; g.fill(); outl(g, 2.2);
    poly(g, [[2, -12], [10, -12], [11, 2], [2, 12]]);
    g.fillStyle = 'rgba(20,14,26,0.28)'; g.fill();
    poly(g, [[-8, -10], [-2, -10], [-2, 8], [-9, 1]]);
    g.fillStyle = 'rgba(255,255,255,0.22)'; g.fill();
    g.fillStyle = GOLD; g.beginPath(); g.arc(0, 0, 3.4, 0, Math.PI * 2); g.fill(); outl(g, 1.6);
    g.restore();
  }
  function coin(g, x, y, r) {
    g.fillStyle = sh(GOLD, 0.72);
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); outl(g, 2.2);
    g.fillStyle = GOLD;
    g.beginPath(); g.arc(x - r * 0.08, y - r * 0.08, r * 0.78, 0, Math.PI * 2); g.fill();
    g.fillStyle = sh(GOLD, 0.72);
    g.font = 'bold ' + (r * 1.1 | 0) + 'px Georgia, serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('$', x - r * 0.05, y + r * 0.02);
    shine(g, x - r * 0.35, y - r * 0.42, r * 0.3, r * 0.17, -0.5, 0.55);
  }

  const TROOP_COL = {
    militia: '#a8865a', archer: '#5aa848', sword: '#7a90b8', spear: '#c8a050',
    xbow: '#8a6a42', berserker: '#d85838', knight: '#6a7dd8', mage: '#9a6ae0',
    cleric: '#e8d888', cavalry: '#b8763a', paladin: '#e8ce6a', giant: '#8a8090'
  };
  const ICON_PAINT = {
    troop: {
      militia: function (g) { splash(g, TROOP_COL.militia); iAxe(g, 22, 22, 1.15, 0.5, false); },
      archer: function (g) {
        splash(g, TROOP_COL.archer);
        g.save(); g.translate(22, 22); g.rotate(0.78);
        g.strokeStyle = OUT; g.lineWidth = 7; g.lineCap = 'round';
        g.beginPath(); g.moveTo(0, -14); g.bezierCurveTo(11, -9, 11, 9, 0, 14); g.stroke();
        g.strokeStyle = '#8a5a30'; g.lineWidth = 3.6;
        g.beginPath(); g.moveTo(0, -14); g.bezierCurveTo(11, -9, 11, 9, 0, 14); g.stroke();
        g.strokeStyle = '#efe8da'; g.lineWidth = 1.4;
        g.beginPath(); g.moveTo(0, -14); g.lineTo(-7, 0); g.lineTo(0, 14); g.stroke();
        g.strokeStyle = OUT; g.lineWidth = 4.6;
        g.beginPath(); g.moveTo(-7, 0); g.lineTo(15, 0); g.stroke();
        g.strokeStyle = '#c8a060'; g.lineWidth = 2.2;
        g.beginPath(); g.moveTo(-7, 0); g.lineTo(13, 0); g.stroke();
        poly(g, [[13, -3.4], [20, 0], [13, 3.4]]); g.fillStyle = '#cdd2dc'; g.fill(); outl(g, 1.8);
        g.restore();
      },
      sword: function (g) { splash(g, TROOP_COL.sword); iSword(g, 22, 30, 20, 0.45); },
      spear: function (g) {
        splash(g, TROOP_COL.spear);
        g.save(); g.translate(22, 22); g.rotate(0.65);
        g.strokeStyle = OUT; g.lineWidth = 6; g.lineCap = 'round';
        g.beginPath(); g.moveTo(0, 17); g.lineTo(0, -9); g.stroke();
        g.strokeStyle = '#8a5a30'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(0, 17); g.lineTo(0, -9); g.stroke();
        poly(g, [[-4, -8], [0, -19], [4, -8], [0, -10]]);
        g.fillStyle = '#cdd2dc'; g.fill(); outl(g, 2);
        g.fillStyle = 'rgba(255,255,255,0.5)'; poly(g, [[-2.4, -9], [-0.4, -17], [-0.2, -10]]); g.fill();
        g.restore();
      },
      xbow: function (g) {
        splash(g, TROOP_COL.xbow);
        g.save(); g.translate(22, 22); g.rotate(-0.78);
        g.fillStyle = '#6a4526'; rr(g, -3, -12, 6, 27, 3); g.fill(); outl(g, 2);
        g.strokeStyle = OUT; g.lineWidth = 6.4; g.lineCap = 'round';
        g.beginPath(); g.moveTo(-12, -6); g.quadraticCurveTo(0, -15, 12, -6); g.stroke();
        g.strokeStyle = '#4e3620'; g.lineWidth = 3.4;
        g.beginPath(); g.moveTo(-12, -6); g.quadraticCurveTo(0, -15, 12, -6); g.stroke();
        g.strokeStyle = '#efe8da'; g.lineWidth = 1.4;
        g.beginPath(); g.moveTo(-12, -6); g.lineTo(0, -2); g.lineTo(12, -6); g.stroke();
        poly(g, [[-2.2, -12], [0, -19], [2.2, -12]]);
        g.fillStyle = '#cdd2dc'; g.fill(); outl(g, 1.8);
        g.fillStyle = 'rgba(255,250,230,0.3)'; g.fillRect(-1.6, -10, 1.6, 22);
        g.restore();
      },
      berserker: function (g) {
        splash(g, TROOP_COL.berserker);
        iAxe(g, 15, 23, 1, -0.5, false); iAxe(g, 29, 23, 1, 0.5, false);
      },
      knight: function (g) { splash(g, TROOP_COL.knight); iShield(g, 22, 21, 1.25, '#4a63b8', false); },
      mage: function (g) {
        splash(g, TROOP_COL.mage);
        g.save(); g.translate(22, 23); g.rotate(0.3);
        g.strokeStyle = OUT; g.lineWidth = 6.2; g.lineCap = 'round';
        g.beginPath(); g.moveTo(0, 16); g.lineTo(0, -8); g.stroke();
        g.strokeStyle = '#6a4526'; g.lineWidth = 3.4;
        g.beginPath(); g.moveTo(0, 16); g.lineTo(0, -8); g.stroke();
        glow(g, 0, -12, 12, '#b48ce8', 0.7);
        g.fillStyle = '#8a5ad0'; g.beginPath(); g.arc(0, -12, 6, 0, Math.PI * 2); g.fill(); outl(g, 2);
        g.fillStyle = '#c8a8f0'; g.beginPath(); g.arc(-1.4, -13.4, 3.4, 0, Math.PI * 2); g.fill();
        shine(g, -2.2, -14.6, 1.4, 1, -0.4, 0.7);
        g.restore();
      },
      cleric: function (g) {
        splash(g, TROOP_COL.cleric);
        glow(g, 22, 21, 16, '#ffe9a0', 0.6);
        g.fillStyle = GOLD;
        rr(g, 18.6, 8, 6.8, 28, 2.4); g.fill(); outl(g, 2);
        rr(g, 11, 15.6, 22, 6.8, 2.4); g.fill(); outl(g, 2);
        g.fillStyle = 'rgba(255,255,255,0.55)';
        rr(g, 19.8, 9.4, 2.2, 24, 1); g.fill();
        rr(g, 12.4, 16.8, 18, 2, 1); g.fill();
      },
      cavalry: function (g) {
        splash(g, TROOP_COL.cavalry);
        g.save(); g.translate(22, 22);
        // horse head silhouette
        g.fillStyle = '#7a4e2a';
        g.beginPath();
        g.moveTo(-8, 15);
        g.lineTo(-8, 2);
        g.quadraticCurveTo(-9, -9, -1, -13);
        g.lineTo(1, -17);
        g.lineTo(5, -12);
        g.quadraticCurveTo(13, -9, 15, -2);
        g.lineTo(13, 1);
        g.lineTo(6, -1);
        g.quadraticCurveTo(3, 5, 3, 15);
        g.closePath();
        g.fill(); outl(g, 2.2);
        // mane
        g.fillStyle = '#4e3018';
        g.beginPath();
        g.moveTo(-8, 2); g.quadraticCurveTo(-9, -9, -1, -13); g.lineTo(-4, -13);
        g.quadraticCurveTo(-12, -8, -11, 4); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,250,230,0.25)';
        g.beginPath(); g.ellipse(2, -7, 4.4, 2.6, 0.5, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#241c30'; g.beginPath(); g.arc(4.5, -7.5, 1.6, 0, Math.PI * 2); g.fill();
        g.restore();
      },
      paladin: function (g) { splash(g, TROOP_COL.paladin); iShield(g, 22, 21, 1.1, '#d8b840', true); },
      giant: function (g) {
        splash(g, TROOP_COL.giant);
        g.save(); g.translate(22, 22);
        // stone fist
        g.fillStyle = '#8a8494';
        poly(g, [[-12, 12], [-13, -2], [-8, -8], [10, -10], [14, -3], [13, 8], [6, 13]]);
        g.fill(); outl(g, 2.4);
        // knuckle cuts
        g.strokeStyle = 'rgba(24,18,32,0.6)'; g.lineWidth = 1.8;
        for (const kx of [-6, 0, 6]) { g.beginPath(); g.moveTo(kx, -9); g.lineTo(kx + 1, -2); g.stroke(); }
        g.fillStyle = 'rgba(20,14,26,0.25)';
        poly(g, [[6, 13], [13, 8], [14, -3], [9, -4], [8, 8]]); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.25)';
        poly(g, [[-11, -3], [-7, -7], [0, -8], [-1, -4], [-8, -1]]); g.fill();
        // thumb
        g.fillStyle = '#9a94a4';
        rr(g, -13, 0, 8, 11, 4); g.fill(); outl(g, 2);
        g.restore();
      }
    },
    hero: {},
    relic: {},
    misc: {}
  };

  // hero bust helper: shoulders + head base; details per hero
  function bustBase(g, shoulderCol, skinCol) {
    // shoulders
    g.fillStyle = shoulderCol;
    g.beginPath();
    g.moveTo(6, 40); g.quadraticCurveTo(6, 26, 15, 24);
    g.lineTo(29, 24); g.quadraticCurveTo(38, 26, 38, 40);
    g.closePath(); g.fill(); outl(g, 2.2);
    g.fillStyle = 'rgba(20,14,26,0.25)';
    g.beginPath(); g.moveTo(29, 24); g.quadraticCurveTo(38, 26, 38, 40); g.lineTo(30, 40); g.lineTo(29, 25); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.2)';
    g.beginPath(); g.ellipse(12, 29, 3.4, 2, -0.5, 0, Math.PI * 2); g.fill();
    // head
    if (skinCol) {
      g.fillStyle = skinCol;
      g.beginPath(); g.arc(22, 15, 9.5, 0, Math.PI * 2); g.fill(); outl(g, 2.2);
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.beginPath(); g.ellipse(19, 11.5, 3, 2, -0.4, 0, Math.PI * 2); g.fill();
    }
  }
  ICON_PAINT.hero = {
    aldric: function (g) { // blue steel knight helm, red plume
      bustBase(g, '#4a63b8', null);
      // helm
      g.fillStyle = '#9fb2cf';
      g.beginPath();
      g.arc(22, 15, 10, Math.PI, 0);
      g.lineTo(32, 24); g.lineTo(12, 24);
      g.closePath(); g.fill(); outl(g, 2.2);
      g.fillStyle = 'rgba(20,14,26,0.28)';
      g.beginPath(); g.moveTo(27, 6.6); g.arc(22, 15, 10, -0.55, 0); g.lineTo(32, 24); g.lineTo(27, 24); g.closePath(); g.fill();
      // visor slit
      g.fillStyle = '#181428';
      rr(g, 14, 13.5, 16, 3.6, 1.8); g.fill();
      g.fillStyle = '#9fb2cf'; rr(g, 21, 12.5, 2, 6, 1); g.fill();
      // plume
      g.fillStyle = '#d83a3a';
      g.beginPath();
      g.moveTo(18, 5); g.quadraticCurveTo(22, -4, 31, 1);
      g.quadraticCurveTo(27, 3, 26, 6); g.closePath();
      g.fill(); outl(g, 2);
      shine(g, 17, 8, 3, 2, -0.4, 0.45);
    },
    lyra: function (g) { // green hooded ranger, braid
      bustBase(g, '#3f7a38', '#e8b890');
      // braid
      g.fillStyle = '#b8762e';
      rr(g, 28, 16, 5, 20, 2.5); g.fill(); outl(g, 2);
      g.strokeStyle = 'rgba(24,18,32,0.5)'; g.lineWidth = 1.4;
      for (const by of [20, 25, 30]) { g.beginPath(); g.moveTo(28.5, by); g.lineTo(32.5, by + 2); g.stroke(); }
      // hood
      g.fillStyle = '#4a8a3e';
      g.beginPath();
      g.moveTo(11, 20);
      g.quadraticCurveTo(9, 4, 22, 3);
      g.quadraticCurveTo(35, 4, 33, 20);
      g.quadraticCurveTo(30, 10, 22, 9.5);
      g.quadraticCurveTo(14, 10, 11, 20);
      g.closePath(); g.fill(); outl(g, 2.2);
      g.fillStyle = 'rgba(255,255,255,0.2)';
      g.beginPath(); g.ellipse(15, 8.5, 3.4, 2, -0.6, 0, Math.PI * 2); g.fill();
      // face shading + eyes
      g.fillStyle = 'rgba(20,14,26,0.85)';
      g.beginPath(); g.arc(19, 15, 1.4, 0, Math.PI * 2); g.arc(26, 15, 1.4, 0, Math.PI * 2); g.fill();
    },
    magnus: function (g) { // crimson wizard hat, grey beard, glowing eyes
      bustBase(g, '#8a2e34', '#e0b090');
      // beard
      g.fillStyle = '#cfcfd6';
      g.beginPath();
      g.moveTo(14, 15); g.quadraticCurveTo(14, 30, 22, 33);
      g.quadraticCurveTo(30, 30, 30, 15);
      g.quadraticCurveTo(26, 20, 22, 20);
      g.quadraticCurveTo(18, 20, 14, 15);
      g.closePath(); g.fill(); outl(g, 2.2);
      g.fillStyle = 'rgba(20,14,26,0.18)';
      g.beginPath(); g.moveTo(26, 18); g.quadraticCurveTo(30, 24, 27, 30); g.quadraticCurveTo(30, 24, 30, 15); g.closePath(); g.fill();
      // hat
      poly(g, [[10, 12], [34, 12], [26, 9], [30, -4], [18, 8]]);
      g.fillStyle = '#b03040'; g.fill(); outl(g, 2.2);
      poly(g, [[30, -4], [26, 9], [22, 10], [27, -1]]);
      g.fillStyle = 'rgba(20,14,26,0.3)'; g.fill();
      g.fillStyle = 'rgba(255,255,255,0.22)';
      g.beginPath(); g.ellipse(16, 10.6, 3.4, 1.2, 0, 0, Math.PI * 2); g.fill();
      // glowing eyes
      glow(g, 18.5, 15, 4, '#6ad8ff', 0.8); glow(g, 25.5, 15, 4, '#6ad8ff', 0.8);
      g.fillStyle = '#bff0ff';
      g.beginPath(); g.arc(18.5, 15, 1.5, 0, Math.PI * 2); g.arc(25.5, 15, 1.5, 0, Math.PI * 2); g.fill();
    },
    celeste: function (g) { // white+gold circlet, halo hint
      glow(g, 22, 8, 13, '#ffe9a0', 0.55);
      g.strokeStyle = 'rgba(255,230,150,0.9)'; g.lineWidth = 2.4;
      g.beginPath(); g.ellipse(22, 5.5, 10, 3.4, 0, 0, Math.PI * 2); g.stroke();
      bustBase(g, '#e8e2d4', '#f0c8a8');
      // hair
      g.fillStyle = '#f0e0b0';
      g.beginPath();
      g.moveTo(12.5, 18); g.quadraticCurveTo(11, 6, 22, 5);
      g.quadraticCurveTo(33, 6, 31.5, 18);
      g.quadraticCurveTo(31, 11, 22, 10);
      g.quadraticCurveTo(13, 11, 12.5, 18);
      g.closePath(); g.fill(); outl(g, 2);
      // circlet
      g.strokeStyle = GOLD; g.lineWidth = 2;
      g.beginPath(); g.moveTo(13.4, 12.4); g.quadraticCurveTo(22, 8.4, 30.6, 12.4); g.stroke();
      gem(g, 22, 10.4, 2, '#8ad8f0');
      g.fillStyle = 'rgba(20,14,26,0.85)';
      g.beginPath(); g.arc(19, 16, 1.2, 0, Math.PI * 2); g.arc(25, 16, 1.2, 0, Math.PI * 2); g.fill();
      g.fillStyle = GOLD; rr(g, 20, 24, 4, 5, 1); g.fill();
    },
    bjorn: function (g) { // horned helm, red beard
      bustBase(g, '#7a5a34', '#e0b090');
      // beard (big red)
      g.fillStyle = '#c04a24';
      g.beginPath();
      g.moveTo(13, 14); g.quadraticCurveTo(12, 32, 22, 35);
      g.quadraticCurveTo(32, 32, 31, 14);
      g.quadraticCurveTo(27, 19, 22, 19);
      g.quadraticCurveTo(17, 19, 13, 14);
      g.closePath(); g.fill(); outl(g, 2.2);
      g.fillStyle = 'rgba(20,14,26,0.2)';
      g.beginPath(); g.moveTo(27, 17); g.quadraticCurveTo(31, 26, 27, 32); g.quadraticCurveTo(31, 26, 31, 14); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(120,30,10,0.5)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(18, 22); g.quadraticCurveTo(19, 28, 22, 32); g.moveTo(25, 22); g.quadraticCurveTo(25, 27, 24, 31); g.stroke();
      // helm dome
      g.fillStyle = '#8a8fa0';
      g.beginPath(); g.arc(22, 13, 9.8, Math.PI, 0); g.lineTo(31.8, 15.5); g.lineTo(12.2, 15.5); g.closePath();
      g.fill(); outl(g, 2.2);
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.beginPath(); g.ellipse(18, 7.6, 3, 1.8, -0.4, 0, Math.PI * 2); g.fill();
      // horns
      for (const sd of [-1, 1]) {
        g.beginPath();
        g.moveTo(22 + sd * 8, 12);
        g.quadraticCurveTo(22 + sd * 17, 11, 22 + sd * 16, 0);
        g.quadraticCurveTo(22 + sd * 13, 7, 22 + sd * 7, 8);
        g.closePath();
        g.fillStyle = '#e8dcc8'; g.fill(); outl(g, 2);
      }
      g.fillStyle = 'rgba(20,14,26,0.85)';
      g.beginPath(); g.arc(19, 17, 1.3, 0, Math.PI * 2); g.arc(25, 17, 1.3, 0, Math.PI * 2); g.fill();
    },
    nyx: function (g) { // black hood, glowing violet eyes, mask
      bustBase(g, '#2c2436', null);
      // hood
      g.fillStyle = '#332a40';
      g.beginPath();
      g.moveTo(10, 24);
      g.quadraticCurveTo(8, 3, 22, 2);
      g.quadraticCurveTo(36, 3, 34, 24);
      g.quadraticCurveTo(31, 9, 22, 8);
      g.quadraticCurveTo(13, 9, 10, 24);
      g.closePath(); g.fill(); outl(g, 2.2);
      g.fillStyle = 'rgba(255,255,255,0.12)';
      g.beginPath(); g.ellipse(14, 8, 3.4, 2, -0.6, 0, Math.PI * 2); g.fill();
      // shadowed face + mask
      g.fillStyle = '#141020';
      g.beginPath(); g.arc(22, 16, 7.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#4a3f5c';
      rr(g, 15, 17, 14, 6.5, 3); g.fill(); outl(g, 1.8);
      // glowing violet eyes
      glow(g, 19, 13.5, 4.5, '#c060ff', 0.9); glow(g, 25, 13.5, 4.5, '#c060ff', 0.9);
      g.fillStyle = '#e8b8ff';
      poly(g, [[16.6, 13.5], [19, 12.2], [21.4, 13.5], [19, 14.8]]); g.fill();
      poly(g, [[22.6, 13.5], [25, 12.2], [27.4, 13.5], [25, 14.8]]); g.fill();
    },
    aurelia: function (g) { // legendary: radiant gold winged crown, white-gold armor
      glow(g, 22, 14, 16, '#ffe9a0', 0.5);
      bustBase(g, '#e8c452', '#f0c8a8');
      // flowing white hair
      g.fillStyle = '#f4f0e4';
      g.beginPath();
      g.moveTo(12, 22); g.quadraticCurveTo(10, 5, 22, 4);
      g.quadraticCurveTo(34, 5, 32, 22);
      g.quadraticCurveTo(31, 10, 22, 9);
      g.quadraticCurveTo(13, 10, 12, 22);
      g.closePath(); g.fill(); outl(g, 2.2);
      // winged crown
      for (const sd of [-1, 1]) {
        g.beginPath();
        g.moveTo(22 + sd * 9, 9);
        g.quadraticCurveTo(22 + sd * 18, 6, 22 + sd * 17, -3);
        g.quadraticCurveTo(22 + sd * 13, 3, 22 + sd * 8, 4.5);
        g.closePath();
        g.fillStyle = '#ffd75e'; g.fill(); outl(g, 2);
        g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(22 + sd * 10, 6.5); g.quadraticCurveTo(22 + sd * 15, 4, 22 + sd * 15, -1); g.stroke();
      }
      g.strokeStyle = GOLD; g.lineWidth = 2.2;
      g.beginPath(); g.moveTo(13.6, 11.4); g.quadraticCurveTo(22, 7, 30.4, 11.4); g.stroke();
      gem(g, 22, 9.2, 2.4, '#ffe9a0');
      // serene eyes
      g.fillStyle = 'rgba(20,14,26,0.85)';
      g.beginPath(); g.arc(19, 15.5, 1.2, 0, Math.PI * 2); g.arc(25, 15.5, 1.2, 0, Math.PI * 2); g.fill();
      shine(g, 17, 27, 3, 2, -0.5, 0.5);
    },
    karrgoth: function (g) { // legendary: dragon-skull helm, ember eyes, smoke
      glow(g, 22, 15, 15, '#ff8a3a', 0.4);
      bustBase(g, '#6a3428', null);
      // dragon skull helm
      g.fillStyle = '#d8ccb8';
      g.beginPath();
      g.moveTo(11, 22); g.quadraticCurveTo(8, 6, 22, 4);
      g.quadraticCurveTo(36, 6, 33, 22);
      g.lineTo(29, 17); g.lineTo(26, 22);
      g.lineTo(22, 18); g.lineTo(18, 22);
      g.lineTo(15, 17); g.closePath();
      g.fill(); outl(g, 2.2);
      g.fillStyle = 'rgba(20,14,26,0.2)';
      g.beginPath(); g.moveTo(28, 7); g.quadraticCurveTo(34, 12, 33, 22); g.lineTo(29, 17); g.closePath(); g.fill();
      // horns swept back
      for (const sd of [-1, 1]) {
        g.beginPath();
        g.moveTo(22 + sd * 9, 8);
        g.quadraticCurveTo(22 + sd * 19, 6, 22 + sd * 20, -2);
        g.quadraticCurveTo(22 + sd * 14, 2, 22 + sd * 8, 4);
        g.closePath();
        g.fillStyle = '#b04a2a'; g.fill(); outl(g, 2);
      }
      // ember eyes in skull sockets
      g.fillStyle = '#181428';
      g.beginPath(); g.ellipse(18, 13.5, 3.2, 3.8, 0, 0, Math.PI * 2); g.ellipse(26, 13.5, 3.2, 3.8, 0, 0, Math.PI * 2); g.fill();
      glow(g, 18, 13.5, 4, '#ff9a3a', 0.9); glow(g, 26, 13.5, 4, '#ff9a3a', 0.9);
      g.fillStyle = '#ffd08a';
      g.beginPath(); g.arc(18, 13.5, 1.6, 0, Math.PI * 2); g.arc(26, 13.5, 1.6, 0, Math.PI * 2); g.fill();
      shine(g, 15, 7.5, 3, 1.6, -0.5, 0.4);
    },
    morrigan: function (g) { // legendary: raven-feather crown, pale queen, violet magic
      glow(g, 22, 13, 15, '#9a5ae0', 0.45);
      bustBase(g, '#2e2440', '#e8dce8');
      // black feathered hair
      g.fillStyle = '#221c30';
      g.beginPath();
      g.moveTo(11.5, 24); g.quadraticCurveTo(9, 5, 22, 4);
      g.quadraticCurveTo(35, 5, 32.5, 24);
      g.quadraticCurveTo(31, 10, 22, 9.5);
      g.quadraticCurveTo(13, 10, 11.5, 24);
      g.closePath(); g.fill(); outl(g, 2.2);
      // raven-feather crown spikes
      for (const [fx, fh] of [[14, 8], [18, 11], [22, 13], [26, 11], [30, 8]]) {
        g.beginPath();
        g.moveTo(fx - 2, 9); g.quadraticCurveTo(fx, 9 - fh, fx + 1.4, 9 - fh * 0.5);
        g.quadraticCurveTo(fx + 2, 9 - fh * 0.2, fx + 2.4, 9);
        g.closePath();
        g.fillStyle = '#3a3050'; g.fill();
        g.strokeStyle = OUT; g.lineWidth = 1.6; g.stroke();
      }
      g.strokeStyle = '#9a5ae0'; g.lineWidth = 1.8;
      g.beginPath(); g.moveTo(13.6, 11.8); g.quadraticCurveTo(22, 8.2, 30.4, 11.8); g.stroke();
      gem(g, 22, 10.2, 2.2, '#c88bff');
      // violet eyes, dark lips
      glow(g, 19, 15.5, 3.5, '#c060ff', 0.7); glow(g, 25, 15.5, 3.5, '#c060ff', 0.7);
      g.fillStyle = '#e0b8ff';
      g.beginPath(); g.arc(19, 15.5, 1.3, 0, Math.PI * 2); g.arc(25, 15.5, 1.3, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#6a3a5a';
      rr(g, 20, 19.5, 4, 1.8, 0.9); g.fill();
    }
  };

  ICON_PAINT.heroReef = {
    aldric: function (g) { // Porous Pete: yellow sponge fry-cook with spatula
      // shoulders (chef whites)
      g.fillStyle = '#e8e2d4';
      g.beginPath();
      g.moveTo(6, 40); g.quadraticCurveTo(6, 28, 15, 26);
      g.lineTo(29, 26); g.quadraticCurveTo(38, 28, 38, 40);
      g.closePath(); g.fill(); outl(g, 2.2);
      // porous sponge head: rounded yellow square
      g.fillStyle = '#f2d94e';
      rr(g, 10, 1, 24, 24, 5); g.fill(); outl(g, 2.4);
      g.fillStyle = 'rgba(20,14,26,0.10)';
      rr(g, 26, 3, 6, 20, 3); g.fill();
      // pores
      g.fillStyle = 'rgba(180,150,30,0.75)';
      for (const [px, py, pr] of [[13.5, 5.5, 1.6], [30, 8, 1.9], [12.5, 19, 2.0], [29.5, 20.5, 1.5], [21, 3.4, 1.2]]) {
        g.beginPath(); g.ellipse(px, py, pr, pr * 0.8, 0.4, 0, Math.PI * 2); g.fill();
      }
      // big grin + eyes
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(18, 11, 3.4, 0, Math.PI * 2); g.arc(26, 11, 3.4, 0, Math.PI * 2); g.fill();
      g.strokeStyle = OUT; g.lineWidth = 1.6;
      g.beginPath(); g.arc(18, 11, 3.4, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.arc(26, 11, 3.4, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#2a5a8a';
      g.beginPath(); g.arc(18.8, 11.4, 1.5, 0, Math.PI * 2); g.arc(25.2, 11.4, 1.5, 0, Math.PI * 2); g.fill();
      g.strokeStyle = OUT; g.lineWidth = 1.8;
      g.beginPath(); g.arc(22, 15.5, 5.4, 0.25, Math.PI - 0.25); g.stroke();
      // golden spatula over the shoulder
      g.save(); g.translate(35, 30); g.rotate(-0.7);
      g.strokeStyle = '#6b4a2a'; g.lineWidth = 2.6;
      g.beginPath(); g.moveTo(0, 8); g.lineTo(0, -8); g.stroke();
      g.fillStyle = '#e8c34a';
      rr(g, -4.5, -17, 9, 10, 2); g.fill(); outl(g, 1.8);
      g.strokeStyle = 'rgba(20,14,26,0.5)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(-2, -16); g.lineTo(-2, -8.5); g.moveTo(1.6, -16); g.lineTo(1.6, -8.5); g.stroke();
      g.restore();
      shine(g, 14, 5.5, 3, 2, -0.4, 0.5);
    },
    aurelia: function (g) { // King Neptune: sea-god, gold crown, white beard, trident
      glow(g, 22, 14, 16, '#7de8d8', 0.5);
      bustBase(g, '#2f9a8e', '#e8c8a8');
      // flowing white beard
      g.fillStyle = '#f4f0e4';
      g.beginPath();
      g.moveTo(14, 16); g.quadraticCurveTo(13, 32, 22, 35);
      g.quadraticCurveTo(31, 32, 30, 16);
      g.quadraticCurveTo(26, 21, 22, 21);
      g.quadraticCurveTo(18, 21, 14, 16);
      g.closePath(); g.fill(); outl(g, 2.2);
      // white hair
      g.fillStyle = '#f4f0e4';
      g.beginPath();
      g.moveTo(12.5, 16); g.quadraticCurveTo(11, 4, 22, 3.4);
      g.quadraticCurveTo(33, 4, 31.5, 16);
      g.quadraticCurveTo(31, 9, 22, 8.4);
      g.quadraticCurveTo(13, 9, 12.5, 16);
      g.closePath(); g.fill(); outl(g, 2);
      // golden crown with points
      g.fillStyle = GOLD;
      poly(g, [[13.6, 8.4], [30.4, 8.4], [30.4, 4.4], [26.8, 6.8], [22, 1.4], [17.2, 6.8], [13.6, 4.4]]);
      g.fill(); outl(g, 2);
      gem(g, 22, 6.6, 1.9, '#7de8d8');
      // stern eyes
      g.fillStyle = 'rgba(20,14,26,0.85)';
      g.beginPath(); g.arc(18.6, 13.4, 1.2, 0, Math.PI * 2); g.arc(25.4, 13.4, 1.2, 0, Math.PI * 2); g.fill();
      // trident by the shoulder
      g.save(); g.translate(36.5, 24); g.rotate(0.12);
      g.strokeStyle = GOLD; g.lineWidth = 2.4;
      g.beginPath(); g.moveTo(0, 16); g.lineTo(0, -10); g.stroke();
      g.beginPath();
      g.moveTo(-5, -8); g.lineTo(-5, -14); g.moveTo(5, -8); g.lineTo(5, -14);
      g.moveTo(-5, -8); g.quadraticCurveTo(0, -4, 5, -8);
      g.moveTo(0, -10); g.lineTo(0, -16);
      g.stroke();
      g.restore();
      shine(g, 16, 27, 3, 2, -0.5, 0.4);
    },
    karrgoth: function (g) { // The Flying Dutchman: ghost-green pirate captain
      glow(g, 22, 15, 15, '#5ee8a8', 0.45);
      bustBase(g, '#1a3a2e', null);
      // spectral face
      g.fillStyle = '#7de8b8';
      g.beginPath(); g.arc(22, 15, 9.2, 0, Math.PI * 2); g.fill(); outl(g, 2.2);
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.beginPath(); g.ellipse(19, 11.5, 3, 2, -0.4, 0, Math.PI * 2); g.fill();
      // wispy ghost beard
      g.fillStyle = 'rgba(125,232,184,0.8)';
      g.beginPath();
      g.moveTo(15, 19); g.quadraticCurveTo(15, 30, 20, 34);
      g.quadraticCurveTo(20, 28, 22, 27);
      g.quadraticCurveTo(24, 30, 26, 33);
      g.quadraticCurveTo(29, 27, 29, 19);
      g.closePath(); g.fill();
      // tricorn hat
      g.fillStyle = '#12261e';
      g.beginPath();
      g.moveTo(9, 9.5); g.quadraticCurveTo(22, 2.5, 35, 9.5);
      g.quadraticCurveTo(30, 4.5, 27, 1.5);
      g.quadraticCurveTo(22, -1.5, 17, 1.5);
      g.quadraticCurveTo(14, 4.5, 9, 9.5);
      g.closePath(); g.fill(); outl(g, 2.2);
      g.strokeStyle = '#5ee8a8'; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(11, 8.6); g.quadraticCurveTo(22, 3.4, 33, 8.6); g.stroke();
      // hollow glowing eyes
      glow(g, 18.5, 13.5, 4, '#b8ffd8', 0.9); glow(g, 25.5, 13.5, 4, '#b8ffd8', 0.9);
      g.fillStyle = '#eafff2';
      g.beginPath(); g.arc(18.5, 13.5, 1.6, 0, Math.PI * 2); g.arc(25.5, 13.5, 1.6, 0, Math.PI * 2); g.fill();
    },
    morrigan: function (g) { // Davy Jones: teal keeper of the locker, tentacle beard
      glow(g, 22, 13, 15, '#4ad0c8', 0.45);
      bustBase(g, '#12262a', '#7ac8bc');
      // barnacled hat/hood
      g.fillStyle = '#1a3a40';
      g.beginPath();
      g.moveTo(11.5, 15);
      g.quadraticCurveTo(10, 3, 22, 2.6);
      g.quadraticCurveTo(34, 3, 32.5, 15);
      g.quadraticCurveTo(31, 8, 22, 7.6);
      g.quadraticCurveTo(13, 8, 11.5, 15);
      g.closePath(); g.fill(); outl(g, 2.2);
      g.fillStyle = '#4ad0c8';
      g.beginPath(); g.arc(15, 6.6, 1.3, 0, Math.PI * 2); g.arc(28.4, 5.8, 1.1, 0, Math.PI * 2); g.fill();
      // tentacle beard
      g.fillStyle = '#3aaca4';
      for (const [tx, len, sway] of [[15, 13, -2.5], [18.4, 16, -1], [22, 18, 0.6], [25.6, 15.5, 1.8], [29, 12, 3]]) {
        g.beginPath();
        g.moveTo(tx - 1.7, 17);
        g.quadraticCurveTo(tx - 2 + sway, 17 + len * 0.6, tx + sway, 17 + len);
        g.quadraticCurveTo(tx + 2 + sway, 17 + len * 0.55, tx + 1.7, 17);
        g.closePath(); g.fill();
        g.strokeStyle = OUT; g.lineWidth = 1.5; g.stroke();
      }
      // piercing eyes
      glow(g, 18.6, 12, 3.5, '#8affe8', 0.75); glow(g, 25.4, 12, 3.5, '#8affe8', 0.75);
      g.fillStyle = '#d8fff4';
      g.beginPath(); g.arc(18.6, 12, 1.4, 0, Math.PI * 2); g.arc(25.4, 12, 1.4, 0, Math.PI * 2); g.fill();
    },
  };
  ICON_PAINT.troop.thrall = function (g) { // enthralled foe — green sigil
    splash(g, '#5a8a4a');
    g.fillStyle = '#2a3a22'; g.beginPath(); g.arc(22, 20, 9, 0, 7); g.fill(); outl(g, 2);
    g.fillStyle = '#9ae05e'; g.beginPath(); g.arc(18, 19, 2, 0, 7); g.arc(26, 19, 2, 0, 7); g.fill();
    g.strokeStyle = '#9ae05e'; g.lineWidth = 2; g.beginPath(); g.arc(22, 30, 6, 0.2, Math.PI - 0.2); g.stroke();
  };
  ICON_PAINT.troop.aeonchamp = function (g) { // radiant champion
    splash(g, '#c88b6a');
    glow(g, 22, 20, 12, '#ffb0a0', 0.5);
    g.fillStyle = '#e8d0b0'; g.beginPath(); g.arc(22, 18, 9, 0, 7); g.fill(); outl(g, 2.2);
    g.fillStyle = '#ffd75e'; poly(g, [[14, 12], [18, 4], [22, 11], [26, 4], [30, 12]]); g.fill(); outl(g, 1.6);
    g.fillStyle = '#2a2036'; g.beginPath(); g.arc(19, 18, 1.8, 0, 7); g.arc(25, 18, 1.8, 0, 7); g.fill();
  };
  ICON_PAINT.troop.templar = function (g) { // kite shield with gold cross
    splash(g, '#e8ce6a');
    g.fillStyle = '#f0e6c8';
    g.beginPath(); g.moveTo(22, 8); g.quadraticCurveTo(32, 10, 32, 20); g.quadraticCurveTo(32, 32, 22, 38);
    g.quadraticCurveTo(12, 32, 12, 20); g.quadraticCurveTo(12, 10, 22, 8); g.closePath(); g.fill(); outl(g, 2.4);
    g.strokeStyle = '#c9a227'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(22, 12); g.lineTo(22, 32); g.moveTo(15, 19); g.lineTo(29, 19); g.stroke();
  };
  ICON_PAINT.troop.stormcaller = function (g) { // storm orb with bolt
    splash(g, '#7ab8e8');
    g.fillStyle = '#2a4a7a';
    g.beginPath(); g.arc(22, 22, 11, 0, Math.PI * 2); g.fill(); outl(g, 2.4);
    g.fillStyle = '#aee0ff';
    g.beginPath(); g.moveTo(24, 10); g.lineTo(16, 24); g.lineTo(22, 24); g.lineTo(19, 35); g.lineTo(29, 20); g.lineTo(23, 20); g.closePath();
    g.fill(); outl(g, 1.6);
  };
  ICON_PAINT.hero.seraphine = function (g) { // storm oracle: deep-blue hood, arc crown
    bustBase(g, '#2a4a7a', '#e8d0c0');
    g.strokeStyle = '#8ad4ff'; g.lineWidth = 2.4;
    g.beginPath(); g.moveTo(12, 10); g.lineTo(18, 5); g.lineTo(16, 11); g.lineTo(24, 4); g.stroke();
    g.fillStyle = '#8ad4ff';
    g.beginPath(); g.arc(17, 17, 1.8, 0, 7); g.fill();
    g.beginPath(); g.arc(27, 17, 1.8, 0, 7); g.fill();
    glow(g, 22, 14, 10, '#8ad4ff', 0.35);
  };
  ICON_PAINT.hero.garrick = function (g) { // gold-trimmed great helm + tower shield
    bustBase(g, '#4a3f68', null);
    g.fillStyle = '#b8bfcf';
    g.beginPath(); g.arc(22, 15, 10, Math.PI, 0); g.lineTo(32, 26); g.lineTo(12, 26); g.closePath(); g.fill(); outl(g, 2.2);
    g.fillStyle = '#181428'; rr(g, 14, 14, 16, 3.6, 1.8); g.fill();
    g.strokeStyle = '#d8b45a'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(12, 26); g.lineTo(32, 26); g.stroke();
    g.fillStyle = '#4a3f68';
    rr(g, 29, 16, 9, 18, 3); g.fill(); outl(g, 2);
    g.strokeStyle = '#d8b45a'; g.lineWidth = 1.6;
    rr(g, 31, 19, 5, 12, 2); g.stroke();
  };
  ICON_PAINT.hero.drake = function (g) { // sky drake hero: horned drake head
    glow(g, 22, 15, 14, '#ff9a5e', 0.4);
    bustBase(g, '#8a3a24', null);
    g.fillStyle = '#d85f38';
    g.beginPath(); g.ellipse(22, 14, 10.5, 9, 0, 0, Math.PI * 2); g.fill(); outl(g, 2.2);
    g.fillStyle = sh('#d85f38', 0.8);
    g.beginPath(); g.ellipse(26, 17.5, 6.5, 4.4, 0.2, 0, Math.PI * 2); g.fill();
    for (const sd of [-1, 1]) {
      g.beginPath();
      g.moveTo(22 + sd * 7, 8);
      g.quadraticCurveTo(22 + sd * 15, 4, 22 + sd * 15, -4);
      g.quadraticCurveTo(22 + sd * 10, 1, 22 + sd * 5, 5);
      g.closePath();
      g.fillStyle = '#e8dcc8'; g.fill(); outl(g, 2);
    }
    glow(g, 18.5, 13, 3.5, '#ffd75e', 0.85); glow(g, 25.5, 13, 3.5, '#ffd75e', 0.85);
    g.fillStyle = '#ffe9a0';
    g.beginPath(); g.arc(18.5, 13, 1.5, 0, Math.PI * 2); g.arc(25.5, 13, 1.5, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,150,60,0.75)';
    g.beginPath(); g.arc(22, 21.5, 2.2, 0, Math.PI * 2); g.fill();
  };
  ICON_PAINT.hero.lich = function (g) { // necromancer: green-lit skull sage
    glow(g, 22, 14, 15, '#9ae05e', 0.5);
    bustBase(g, '#1c2418', null);
    g.fillStyle = '#2a331f';
    g.beginPath();
    g.moveTo(10, 24);
    g.quadraticCurveTo(8, 3, 22, 2);
    g.quadraticCurveTo(36, 3, 34, 24);
    g.quadraticCurveTo(31, 9, 22, 8);
    g.quadraticCurveTo(13, 9, 10, 24);
    g.closePath(); g.fill(); outl(g, 2.2);
    g.fillStyle = '#d8e4c8';
    g.beginPath(); g.arc(22, 15, 7.6, 0, Math.PI * 2); g.fill(); outl(g, 2);
    g.fillStyle = '#141a10';
    g.beginPath(); g.ellipse(19, 13.5, 2.4, 3, 0, 0, Math.PI * 2); g.ellipse(25, 13.5, 2.4, 3, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(20,14,26,0.55)';
    g.beginPath(); g.moveTo(20.6, 17.5); g.lineTo(23.4, 17.5); g.lineTo(22, 19.6); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(20,26,16,0.6)'; g.lineWidth = 1.2;
    for (const tx of [18.4, 20.8, 23.2, 25.6]) { g.beginPath(); g.moveTo(tx, 20.4); g.lineTo(tx, 22.4); g.stroke(); }
    glow(g, 19, 13.5, 3.5, '#9ae05e', 0.9); glow(g, 25, 13.5, 3.5, '#9ae05e', 0.9);
    g.fillStyle = '#d2ff9e';
    g.beginPath(); g.arc(19, 13.5, 1.2, 0, Math.PI * 2); g.arc(25, 13.5, 1.2, 0, Math.PI * 2); g.fill();
  };

  ICON_PAINT.relic = {
    steel: function (g) {
      iSword(g, 22, 33, 22, 0);
      // glint sparkle
      g.fillStyle = 'rgba(255,255,255,0.95)';
      poly(g, [[15, 12], [17, 15.5], [15, 19], [13, 15.5]]); g.fill();
      poly(g, [[15, 13.6], [19.5, 15.5], [15, 17.4], [10.5, 15.5]]); g.fill();
    },
    engineering: function (g) {
      // gear
      const cx = 17, cyy = 18;
      g.fillStyle = '#8a90a0';
      for (let i = 0; i < 8; i++) {
        g.save(); g.translate(cx, cyy); g.rotate(i / 8 * Math.PI * 2);
        rr(g, -2.6, -13.5, 5.2, 6, 1.5); g.fill();
        g.restore();
      }
      g.beginPath(); g.arc(cx, cyy, 10, 0, Math.PI * 2); g.fill(); outl(g, 2.2);
      g.fillStyle = 'rgba(255,255,255,0.28)';
      g.beginPath(); g.arc(cx - 2.4, cyy - 2.4, 6, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#3a3444';
      g.beginPath(); g.arc(cx, cyy, 4.4, 0, Math.PI * 2); g.fill();
      // mini tower
      g.fillStyle = '#a08050';
      poly(g, [[27, 38], [28.5, 22], [35.5, 22], [37, 38]]); g.fill(); outl(g, 2);
      g.fillStyle = '#8a6a40';
      for (const tx of [27.6, 30.8, 34]) g.fillRect(tx, 19, 2.6, 4);
      g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(29, 24, 2, 12);
    },
    banners: function (g) {
      g.strokeStyle = OUT; g.lineWidth = 5.4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(14, 5); g.lineTo(14, 39); g.stroke();
      g.strokeStyle = '#8a5a30'; g.lineWidth = 2.8;
      g.beginPath(); g.moveTo(14, 5); g.lineTo(14, 39); g.stroke();
      g.fillStyle = GOLD; g.beginPath(); g.arc(14, 5, 2.6, 0, Math.PI * 2); g.fill(); outl(g, 1.6);
      poly(g, [[16, 8], [37, 10], [31, 15], [37, 20], [16, 22]]);
      g.fillStyle = '#c03a3a'; g.fill(); outl(g, 2.2);
      poly(g, [[16, 8], [16, 22], [22, 21.6], [22, 8.6]]);
      g.fillStyle = 'rgba(255,255,255,0.22)'; g.fill();
      g.fillStyle = 'rgba(20,14,26,0.25)';
      poly(g, [[30, 9.4], [37, 10], [31, 15], [37, 20], [30, 20.6]]); g.fill();
      g.fillStyle = GOLD; g.beginPath(); g.arc(22, 15, 2.4, 0, Math.PI * 2); g.fill();
    },
    treasury: function (g) {
      coin(g, 15, 30, 7.5); coin(g, 29, 30, 7.5); coin(g, 22, 19, 8.5);
    },
    walls: function (g) {
      g.fillStyle = '#9a95a4';
      rr(g, 8, 16, 28, 22, 2); g.fill(); outl(g, 2.4);
      // crenels
      for (const bx of [8, 19, 30]) { g.fillStyle = '#9a95a4'; rr(g, bx, 10, 6, 8, 1.5); g.fill(); outl(g, 2); }
      g.fillStyle = 'rgba(20,14,26,0.25)'; g.fillRect(29, 18, 6, 19);
      g.fillStyle = 'rgba(255,255,255,0.2)'; g.fillRect(10, 18, 4, 18);
      g.strokeStyle = 'rgba(30,22,40,0.4)'; g.lineWidth = 1.3;
      g.beginPath();
      g.moveTo(9, 24); g.lineTo(35, 24); g.moveTo(9, 31); g.lineTo(35, 31);
      g.moveTo(16, 18); g.lineTo(16, 24); g.moveTo(26, 18); g.lineTo(26, 24);
      g.moveTo(21, 24); g.lineTo(21, 31); g.moveTo(13, 31); g.lineTo(13, 37); g.moveTo(28, 31); g.lineTo(28, 37);
      g.stroke();
    },
    grimoire: function (g) {
      glow(g, 22, 21, 17, '#b48ce8', 0.5);
      g.save(); g.translate(22, 23); g.rotate(-0.12);
      g.fillStyle = '#5a3a8a';
      rr(g, -12, -14, 24, 28, 3); g.fill(); outl(g, 2.4);
      g.fillStyle = '#7a52b0';
      rr(g, -9, -14, 21, 28, 3); g.fill();
      g.strokeStyle = OUT; g.lineWidth = 2; rr(g, -12, -14, 24, 28, 3); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.18)';
      rr(g, -7, -12, 5, 24, 2); g.fill();
      // clasp + rune
      g.fillStyle = GOLD; rr(g, 8, -3, 5, 6, 1.5); g.fill(); outl(g, 1.6);
      g.strokeStyle = '#e8d8ff'; g.lineWidth = 2; g.lineCap = 'round';
      g.beginPath();
      g.moveTo(1, -8); g.lineTo(-4, 0); g.lineTo(1, 2); g.lineTo(-2, 9);
      g.stroke();
      glow(g, 0, 0, 8, '#d0b0ff', 0.55);
      g.restore();
    },
    drums: function (g) {
      // war drum
      g.fillStyle = '#a0522a';
      g.beginPath();
      g.moveTo(9, 20); g.lineTo(11, 36); g.quadraticCurveTo(22, 40, 33, 36); g.lineTo(35, 20);
      g.closePath(); g.fill(); outl(g, 2.4);
      g.fillStyle = 'rgba(20,14,26,0.25)';
      g.beginPath(); g.moveTo(28, 21); g.lineTo(29, 37.4); g.quadraticCurveTo(31.6, 37, 33, 36); g.lineTo(35, 20); g.closePath(); g.fill();
      // rope zigzag
      g.strokeStyle = '#e8c34a'; g.lineWidth = 1.8;
      g.beginPath();
      g.moveTo(10, 22);
      for (let i = 0; i < 5; i++) { g.lineTo(12 + i * 5.4, 33); g.lineTo(14.5 + i * 5.4, 22); }
      g.stroke();
      // skin
      g.fillStyle = '#e8d8b8';
      g.beginPath(); g.ellipse(22, 19, 13, 5.4, 0, 0, Math.PI * 2); g.fill(); outl(g, 2.2);
      shine(g, 17, 17.4, 5, 2, -0.2, 0.4);
      // crossed sticks
      g.strokeStyle = OUT; g.lineWidth = 4.6; g.lineCap = 'round';
      g.beginPath(); g.moveTo(12, 4); g.lineTo(26, 16); g.moveTo(32, 4); g.lineTo(18, 16); g.stroke();
      g.strokeStyle = '#c8a060'; g.lineWidth = 2.2;
      g.beginPath(); g.moveTo(12, 4); g.lineTo(26, 16); g.moveTo(32, 4); g.lineTo(18, 16); g.stroke();
      g.fillStyle = '#e8d8b8';
      g.beginPath(); g.arc(12, 4, 3, 0, Math.PI * 2); g.arc(32, 4, 3, 0, Math.PI * 2); g.fill();
      g.strokeStyle = OUT; g.lineWidth = 1.6;
      g.beginPath(); g.arc(12, 4, 3, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.arc(32, 4, 3, 0, Math.PI * 2); g.stroke();
    },
    meteor: function (g) {
      // falling comet
      glow(g, 27, 27, 15, '#ff8030', 0.6);
      // tail
      for (const t of [[0.9, 7], [0.65, 4.6], [0.4, 2.6]]) {
        g.fillStyle = 'rgba(255,' + (140 + t[0] * 80 | 0) + ',60,' + (0.35 + t[0] * 0.3) + ')';
        poly(g, [[6, 4], [27 - t[1], 27 - t[1] * 0.4], [27 - t[1] * 0.4, 27 - t[1]]]);
        g.fill();
      }
      g.fillStyle = '#7a4632';
      g.beginPath(); g.arc(28, 28, 8.5, 0, Math.PI * 2); g.fill(); outl(g, 2.4);
      g.fillStyle = '#a05e3e';
      g.beginPath(); g.arc(26.6, 26.6, 6, 0, Math.PI * 2); g.fill();
      // craters
      g.fillStyle = 'rgba(60,30,20,0.55)';
      g.beginPath(); g.arc(30, 30, 2, 0, Math.PI * 2); g.arc(25, 30.4, 1.4, 0, Math.PI * 2); g.fill();
      shine(g, 24.4, 24.4, 2.4, 1.6, -0.5, 0.5);
    },
    horn: function (g) {
      // golden war horn
      g.save(); g.translate(22, 22); g.rotate(-0.3);
      g.strokeStyle = OUT; g.lineWidth = 12; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-12, 8); g.quadraticCurveTo(4, 14, 14, -2); g.stroke();
      g.strokeStyle = sh(GOLD, 0.85); g.lineWidth = 8.4;
      g.beginPath(); g.moveTo(-12, 8); g.quadraticCurveTo(4, 14, 14, -2); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2.6;
      g.beginPath(); g.moveTo(-11, 5.4); g.quadraticCurveTo(3, 10.4, 12, -2); g.stroke();
      // bell
      g.fillStyle = GOLD;
      g.beginPath(); g.ellipse(15.5, -4.4, 5, 7, 0.55, 0, Math.PI * 2); g.fill(); outl(g, 2.2);
      g.fillStyle = sh(GOLD, 0.6);
      g.beginPath(); g.ellipse(16.6, -5.4, 2.6, 4, 0.55, 0, Math.PI * 2); g.fill();
      // mouthpiece + bands
      g.fillStyle = sh(GOLD, 0.7);
      g.beginPath(); g.arc(-13, 8, 3.4, 0, Math.PI * 2); g.fill(); outl(g, 2);
      for (const t of [0.3, 0.68]) {
        const bx = -12 + 26 * t, by = 8 + (2 - 24 * t * t) * 1;
        g.fillStyle = '#b06a28';
        g.save(); g.translate(-12 + t * 26, t < 0.5 ? 10.4 : 4); g.rotate(-0.5 * t * 2);
        rr(g, -2.2, -6, 4.4, 12, 2); g.fill(); outl(g, 1.6);
        g.restore();
      }
      g.restore();
    },
    frostbomb: function (g) {
      glow(g, 22, 22, 18, '#69c8e8', 0.6);
      g.fillStyle = 'rgba(105,200,232,0.9)';
      g.beginPath(); g.arc(22, 22, 11, 0, Math.PI * 2); g.fill(); outl(g, 2.4);
      g.fillStyle = 'rgba(190,235,250,0.9)';
      g.beginPath(); g.arc(20, 20, 7, 0, Math.PI * 2); g.fill();
      // snowflake
      g.strokeStyle = '#eefaff'; g.lineWidth = 1.8; g.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        g.save(); g.translate(22, 22); g.rotate(i / 6 * Math.PI * 2);
        g.beginPath(); g.moveTo(0, -2); g.lineTo(0, -8.4);
        g.moveTo(0, -5.6); g.lineTo(-2.2, -7.4); g.moveTo(0, -5.6); g.lineTo(2.2, -7.4);
        g.stroke(); g.restore();
      }
      shine(g, 17.6, 17, 2.6, 1.8, -0.5, 0.7);
      // fuse spark
      g.strokeStyle = '#5a4a3a'; g.lineWidth = 2.4;
      g.beginPath(); g.moveTo(28, 12.4); g.quadraticCurveTo(32, 8, 35, 9); g.stroke();
      glow(g, 35.5, 8.5, 5, '#aef0ff', 0.9);
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(35.5, 8.5, 1.8, 0, Math.PI * 2); g.fill();
    }
  };
  ICON_PAINT.wallIcon = function (g) {
    g.fillStyle = '#9a95a4';
    rr(g, 6, 14, 32, 20, 3); g.fill(); outl(g, 2.4);
    g.fillStyle = '#b4afbe';
    for (let i = 0; i < 4; i++) { rr(g, 6 + i * 8.6, 8, 6.4, 7, 1.5); g.fill(); outl(g, 1.8); }
    g.strokeStyle = 'rgba(20,14,26,0.35)'; g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(6, 21); g.lineTo(38, 21); g.moveTo(6, 27.5); g.lineTo(38, 27.5);
    g.moveTo(14, 14); g.lineTo(14, 21); g.moveTo(24, 14); g.lineTo(24, 21); g.moveTo(32, 14); g.lineTo(32, 21);
    g.moveTo(10, 21); g.lineTo(10, 27.5); g.moveTo(20, 21); g.lineTo(20, 27.5); g.moveTo(29, 21); g.lineTo(29, 27.5);
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.22)'; rr(g, 7.5, 15, 10, 2.4, 1.2); g.fill();
  };
  ICON_PAINT.misc = {
    gold: function (g) { coin(g, 22, 22, 13); },
    fire: function (g) { // firestorm spell
      glow(g, 22, 24, 15, '#ff8a3a', 0.5);
      g.fillStyle = '#e85a20';
      g.beginPath();
      g.moveTo(22, 4);
      g.bezierCurveTo(30, 14, 36, 20, 34, 29);
      g.bezierCurveTo(33, 37, 28, 40, 22, 40);
      g.bezierCurveTo(16, 40, 11, 37, 10, 29);
      g.bezierCurveTo(9, 21, 14, 16, 16, 12);
      g.bezierCurveTo(18, 15, 20, 15, 22, 4);
      g.closePath(); g.fill(); outl(g, 2.2);
      g.fillStyle = '#ffb02a';
      g.beginPath();
      g.moveTo(22, 15);
      g.bezierCurveTo(27, 21, 29, 25, 28, 31);
      g.bezierCurveTo(27, 36, 25, 37.5, 22, 37.5);
      g.bezierCurveTo(19, 37.5, 17, 36, 16, 31);
      g.bezierCurveTo(15, 26, 19, 21, 22, 15);
      g.closePath(); g.fill();
      g.fillStyle = '#ffe9a0';
      g.beginPath(); g.ellipse(22, 32, 3.5, 5, 0, 0, Math.PI * 2); g.fill();
    },
    heal: function (g) { // sanctified ground spell
      glow(g, 22, 22, 15, '#7ee08a', 0.5);
      g.fillStyle = '#4aa858';
      g.beginPath(); g.ellipse(22, 33, 14, 5.5, 0, 0, Math.PI * 2); g.fill(); outl(g, 2.2);
      g.fillStyle = 'rgba(160,240,170,0.65)';
      g.beginPath(); g.ellipse(22, 32, 9.5, 3.4, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#7ee08a';
      rr(g, 18.5, 8, 7, 20, 3); g.fill();
      rr(g, 12, 14.5, 20, 7, 3); g.fill();
      g.strokeStyle = OUT; g.lineWidth = 2.2;
      g.beginPath();
      g.moveTo(18.5, 14.5); g.lineTo(18.5, 11); g.arcTo(18.5, 8, 22, 8, 3.5); g.arcTo(25.5, 8, 25.5, 11, 3.5); g.lineTo(25.5, 14.5);
      g.lineTo(29, 14.5); g.arcTo(32, 14.5, 32, 18, 3.5); g.arcTo(32, 21.5, 29, 21.5, 3.5); g.lineTo(25.5, 21.5);
      g.lineTo(25.5, 25); g.arcTo(25.5, 28, 22, 28, 3.5); g.arcTo(18.5, 28, 18.5, 25, 3.5); g.lineTo(18.5, 21.5);
      g.lineTo(15, 21.5); g.arcTo(12, 21.5, 12, 18, 3.5); g.arcTo(12, 14.5, 15, 14.5, 3.5); g.closePath();
      g.stroke();
      shine(g, 20, 11, 2.4, 1.6, -0.5, 0.55);
    },
    frost: function (g) { // frost nova spell
      glow(g, 22, 22, 15, '#8ad4ff', 0.5);
      g.strokeStyle = '#e6f6ff'; g.lineWidth = 3; g.lineCap = 'round';
      for (let k = 0; k < 6; k++) {
        g.save(); g.translate(22, 22); g.rotate(k * Math.PI / 3);
        g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -15);
        g.moveTo(0, -7); g.lineTo(-4, -11); g.moveTo(0, -7); g.lineTo(4, -11);
        g.moveTo(0, -12); g.lineTo(-3, -15); g.moveTo(0, -12); g.lineTo(3, -15);
        g.stroke(); g.restore();
      }
      g.fillStyle = '#bfe8ff'; g.beginPath(); g.arc(22, 22, 3, 0, 7); g.fill();
    },
    bolt: function (g) { // chain lightning spell
      glow(g, 22, 22, 15, '#8ad4ff', 0.5);
      poly(g, [[26, 4], [12, 24], [20, 24], [16, 40], [32, 18], [23, 18]]);
      g.fillStyle = '#ffe86a'; g.fill(); outl(g, 2.4);
      poly(g, [[24.5, 8], [16, 22.5], [21, 22.5], [18.5, 33]]);
      g.fillStyle = '#fff4c0'; g.fill();
    },
    warcry: function (g) { // war cry / rally banner
      g.strokeStyle = OUT; g.lineWidth = 3; g.beginPath(); g.moveTo(13, 6); g.lineTo(13, 40); g.stroke();
      g.strokeStyle = '#8a6a42'; g.lineWidth = 1.6; g.stroke();
      g.fillStyle = '#d83a3a';
      g.beginPath(); g.moveTo(13, 7); g.lineTo(35, 11); g.lineTo(29, 17); g.lineTo(35, 23); g.lineTo(13, 27); g.closePath();
      g.fill(); outl(g, 2.2);
      g.fillStyle = '#ffd75e'; g.beginPath(); g.arc(20, 17, 3, 0, 7); g.fill();
      g.beginPath(); g.arc(13, 5, 2.4, 0, 7); g.fillStyle = '#e8c34a'; g.fill();
    },
    ragnarok: function (g) { // ultimate: storm-wreathed rune bolt
      glow(g, 22, 22, 18, '#8ad0ff', 0.55);
      // dark storm ring
      g.strokeStyle = '#3a4a6a'; g.lineWidth = 4;
      g.beginPath(); g.arc(22, 22, 16, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = '#6a8ac0'; g.lineWidth = 1.8;
      g.beginPath(); g.arc(22, 22, 16, 0, Math.PI * 2); g.stroke();
      // great bolt
      poly(g, [[26, 3], [13, 24], [20, 24], [16, 41], [31, 18], [23, 18]]);
      g.fillStyle = '#ffd75e'; g.fill(); outl(g, 2.4);
      poly(g, [[24.5, 7], [16, 22.5], [21, 22.5], [19, 33]]);
      g.fillStyle = '#fff2c0'; g.fill();
      // rune sparks
      for (const [sx2, sy2] of [[8, 12], [36, 12], [8, 32], [36, 32]]) {
        g.fillStyle = '#bfe0ff';
        poly(g, [[sx2, sy2 - 3], [sx2 + 2, sy2], [sx2, sy2 + 3], [sx2 - 2, sy2]]); g.fill();
      }
    },
    heart: function (g) {
      g.fillStyle = '#d83a4a';
      g.beginPath();
      g.moveTo(22, 36);
      g.bezierCurveTo(6, 24, 8, 9, 17, 9);
      g.bezierCurveTo(20.5, 9, 22, 12, 22, 14);
      g.bezierCurveTo(22, 12, 23.5, 9, 27, 9);
      g.bezierCurveTo(36, 9, 38, 24, 22, 36);
      g.closePath(); g.fill(); outl(g, 2.4);
      g.fillStyle = 'rgba(20,14,26,0.22)';
      g.beginPath();
      g.moveTo(22, 34.5); g.bezierCurveTo(33, 25, 35, 13, 28.5, 10.6);
      g.bezierCurveTo(34, 15, 31, 25, 22, 32.6);
      g.closePath(); g.fill();
      shine(g, 15.6, 14.6, 3.6, 2.6, -0.5, 0.5);
    },
    wave: function (g) {
      iSword(g, 15, 32, 18, -0.55, '#cdd2dc');
      iSword(g, 29, 32, 18, 0.55, '#cdd2dc');
    },
    pop: function (g) {
      // soldier helmet
      g.fillStyle = '#8a8fa0';
      g.beginPath();
      g.arc(22, 20, 12, Math.PI, 0);
      g.lineTo(34, 26); g.lineTo(30, 26); g.lineTo(29, 22);
      g.lineTo(15, 22); g.lineTo(14, 26); g.lineTo(10, 26);
      g.closePath(); g.fill(); outl(g, 2.4);
      g.fillStyle = 'rgba(20,14,26,0.28)';
      g.beginPath(); g.moveTo(29, 10.6); g.arc(22, 20, 12, -0.6, 0); g.lineTo(34, 26); g.lineTo(30, 26); g.closePath(); g.fill();
      shine(g, 17, 12, 4, 2.6, -0.4, 0.4);
      // crest
      g.fillStyle = '#d83a3a';
      g.beginPath(); g.moveTo(16, 9); g.quadraticCurveTo(22, 2, 28, 9); g.quadraticCurveTo(22, 6.4, 16, 9); g.closePath(); g.fill(); outl(g, 1.8);
      // cheek guards
      g.fillStyle = '#8a8fa0';
      rr(g, 13, 24, 6.5, 10, 3); g.fill(); outl(g, 2);
      rr(g, 24.5, 24, 6.5, 10, 3); g.fill(); outl(g, 2);
      g.fillStyle = '#241c30'; g.fillRect(20, 24, 4, 8);
    },
    skull: function (g) {
      g.fillStyle = '#e8e2d4';
      g.beginPath();
      g.arc(22, 18, 11.5, Math.PI * 0.95, Math.PI * 0.05);
      g.quadraticCurveTo(33.5, 27, 28, 28);
      g.lineTo(28, 32); g.lineTo(16, 32); g.lineTo(16, 28);
      g.quadraticCurveTo(10.5, 27, 10.7, 19.6);
      g.closePath(); g.fill(); outl(g, 2.4);
      g.fillStyle = 'rgba(20,14,26,0.16)';
      g.beginPath(); g.moveTo(28, 10); g.quadraticCurveTo(34, 16, 32, 24); g.quadraticCurveTo(33.5, 27, 28, 28); g.lineTo(28, 22); g.closePath(); g.fill();
      // eyes
      g.fillStyle = '#241c30';
      g.beginPath();
      g.ellipse(17.4, 19, 3.2, 4, 0.15, 0, Math.PI * 2);
      g.ellipse(26.6, 19, 3.2, 4, -0.15, 0, Math.PI * 2);
      g.fill();
      // nose + teeth
      poly(g, [[22, 24], [20.4, 27.4], [23.6, 27.4]]);
      g.fill();
      g.strokeStyle = '#241c30'; g.lineWidth = 1.6;
      for (const tx of [19, 22, 25]) { g.beginPath(); g.moveTo(tx, 28.6); g.lineTo(tx, 32); g.stroke(); }
      shine(g, 17, 12, 3.6, 2.2, -0.4, 0.5);
    },
    lock: function (g) {
      // shackle
      g.strokeStyle = OUT; g.lineWidth = 9;
      g.beginPath(); g.arc(22, 17, 7.5, Math.PI, 0); g.stroke();
      g.strokeStyle = '#9aa0ae'; g.lineWidth = 5;
      g.beginPath(); g.arc(22, 17, 7.5, Math.PI, 0); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1.6;
      g.beginPath(); g.arc(22, 17, 8.6, Math.PI * 1.15, Math.PI * 1.6); g.stroke();
      // body
      g.fillStyle = GOLD;
      rr(g, 11, 17, 22, 18, 4); g.fill(); outl(g, 2.4);
      g.fillStyle = 'rgba(20,14,26,0.22)'; rr(g, 27, 19, 4.6, 14, 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.3)'; rr(g, 13, 19, 4, 14, 2); g.fill();
      // keyhole
      g.fillStyle = '#3a2e18';
      g.beginPath(); g.arc(22, 24.4, 2.6, 0, Math.PI * 2); g.fill();
      poly(g, [[20.8, 25.6], [23.2, 25.6], [24, 31], [20, 31]]); g.fill();
    }
  };

  function renderIcon(kind, id) {
    const c = cv(44, 44), g = c.getContext('2d');
    if (kind === 'tower') {
      if (id === 'wall') { ICON_PAINT.wallIcon(g); return c; }
      const t = towerCache[id + ':2'] || renderTower(id, 2);
      // compose base + turret, crop the art region, fit into the 44 box
      const comp = cv(96, 122), cg = comp.getContext('2d');
      cg.drawImage(t.base, 0, 0);
      if (t.turret) {
        cg.save();
        cg.translate(48, 116 - t.mountH);
        cg.rotate(-0.55);
        cg.drawImage(t.turret, -t.tpx, -t.tpy);
        cg.restore();
      }
      const sx = 6, sw = 84, sy = 14, shh = 108;
      const s = Math.min(42 / shh, 42 / sw);
      g.drawImage(comp, sx, sy, sw, shh, 22 - sw * s / 2, 43 - shh * s, sw * s, shh * s);
    } else {
      let fn = ICON_PAINT[kind] && ICON_PAINT[kind][id];
      if (kind === 'hero' && FLAVOR === 'reef' && ICON_PAINT.heroReef[id]) fn = ICON_PAINT.heroReef[id];
      if (fn) fn(g);
      else { // fallback: question tile
        g.fillStyle = '#5a5468'; rr(g, 8, 8, 28, 28, 8); g.fill(); outl(g, 2.4);
        g.fillStyle = '#efe8da'; g.font = 'bold 20px Georgia, serif';
        g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 22, 23);
      }
    }
    return c;
  }

  /* =================== API + caches =================== */
  const towerCache = {};
  const iconCache = {};
  let built = false;

  function build() {
    if (built) return;
    for (const id of TOWER_IDS) {
      for (let lvl = 1; lvl <= 5; lvl++) {
        towerCache[id + ':' + lvl] = renderTower(id, lvl);
      }
    }
    built = true;
  }
  function tower(id, lvl) {
    if (!TOWER_PAINT[id]) return null; // walls draw live, not as sprites
    lvl = clamp(lvl | 0, 1, 5);
    const key = id + ':' + lvl;
    if (!towerCache[key]) towerCache[key] = renderTower(id, lvl);
    return towerCache[key];
  }
  function icon(kind, id) {
    const key = kind + ':' + id;
    if (!iconCache[key]) iconCache[key] = renderIcon(kind, id);
    return iconCache[key];
  }

  function setFlavor(f) {
    if (f !== 'castle' && f !== 'reef') f = 'castle';
    if (f === FLAVOR) return;
    FLAVOR = f;
    built = false;
    for (const k in towerCache) delete towerCache[k];
    for (const k in iconCache) delete iconCache[k];
    build();
  }
  return { build: build, terrain: terrain, tower: tower, icon: icon, setFlavor: setFlavor, get flavor(){ return FLAVOR; } };
})();
