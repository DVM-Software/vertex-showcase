/* Vertex AI showcase: the engine. Copy, timing, colours and camera moves
   are in config.js; this file builds the scene and plays the timeline. */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import './style.css';
import { CONFIG, COLORS, STAGES, SOURCES, KEY, SCENES } from './config.js';

/* Screenshots in shots/ are packed into the built file at build time. */
const BUNDLED = import.meta.glob('../shots/*.{png,jpg,jpeg,webp,PNG,JPG,JPEG,WEBP}', { eager: true, query: '?url', import: 'default' });
const BUNDLED_TEAM = import.meta.glob('../team/*.{png,jpg,jpeg,webp,PNG,JPG,JPEG,WEBP}', { eager: true, query: '?url', import: 'default' });

function boot() {
const $ = id => document.getElementById(id);

const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const easeIO = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeSine = t => .5 - .5 * Math.cos(Math.PI * clamp(t, 0, 1));
const rgb = hex => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
const COL = {}; Object.keys(COLORS).forEach(k => COL[k] = rgb(COLORS[k]));
const cssVar = { signal: '--signal', ledger: '--ledger', flag: '--flag', clear: '--clear', ice: '--ice', caught: '--caught', normal: '--signal' };

/* deterministic random so every run of the film is identical */
let seed = 20261006;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

/* ---------- timeline ---------- */
const starts = []; let TOTAL = 0;
SCENES.forEach(s => { starts.push(TOTAL); TOTAL += s.dur; });
const sceneAt = t => { let i = SCENES.length - 1; while (i > 0 && starts[i] > t) i--; return i; };

/* ---------- renderer ---------- */
const canvas = $('gl');
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); }
catch (e) { $('fail').style.display = 'grid'; return; }
renderer.setClearColor(COLORS.abyss, 1);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x000000, 14, 70);
const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 900);

/* ---------- the stream path ---------- */
/* s runs from -1 to 9: stage k sits exactly at s = k. */
const PTS = [[-30, 3, -4], [-15, 1, 2]].concat(STAGES.map(s => s.at), [[120, 2, -2]]);
const curve = new THREE.CatmullRomCurve3(PTS.map(p => new THREE.Vector3(p[0], p[1], p[2])));
const K = 1001, LP = new Float32Array(K * 3), LS = new Float32Array(K * 3), LU = new Float32Array(K * 3), LT = new Float32Array(K * 3);
(function buildLUT(){
  const p = new THREE.Vector3(), q = new THREE.Vector3(), t = new THREE.Vector3(), s = new THREE.Vector3(), u = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < K; i++) {
    const a = i / (K - 1);
    curve.getPoint(a, p);
    curve.getPoint(Math.min(a + 1e-4, 1), q); curve.getPoint(Math.max(a - 1e-4, 0), t);
    t.subVectors(q, t).normalize();
    s.crossVectors(t, Y).normalize(); u.crossVectors(s, t).normalize();
    p.toArray(LP, i * 3); t.toArray(LT, i * 3); s.toArray(LS, i * 3); u.toArray(LU, i * 3);
  }
})();
const lutIdx = s => clamp((s + 1) * 100, 0, K - 1.001);
function pointAt(s, out) {
  const x = lutIdx(s), i = x | 0, f = x - i, a = i * 3;
  return out.set(LP[a] + (LP[a + 3] - LP[a]) * f, LP[a + 1] + (LP[a + 4] - LP[a + 1]) * f, LP[a + 2] + (LP[a + 5] - LP[a + 2]) * f);
}

/* ---------- backdrop: a quiet gradient that takes the scene accent ---------- */
const bgU = { uA: { value: new THREE.Color(COLORS.trench) }, uB: { value: new THREE.Color(COLORS.abyss) }, uAccent: { value: new THREE.Color(COLORS.signal) }, uC: { value: new THREE.Vector2(.6, .58) } };
const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
  uniforms: bgU, depthTest: false, depthWrite: false,
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 1., 1.); }',
  fragmentShader: [
    'varying vec2 vUv; uniform vec3 uA, uB, uAccent; uniform vec2 uC;',
    'void main(){',
    '  vec2 d = (vUv - uC) * vec2(1.25, 1.0);',
    '  float r = length(d);',
    '  vec3 c = mix(uA, uB, smoothstep(0.0, 0.85, r));',
    '  c += uAccent * 0.055 * (1.0 - smoothstep(0.0, 0.5, r));',
    '  gl_FragColor = vec4(c, 1.0);',
    '}'].join('\n'),
}));
backdrop.frustumCulled = false; backdrop.renderOrder = -10;
scene.add(backdrop);

/* ---------- shared square-point material ---------- */
const PU = { uScale: { value: 1 }, uFog: { value: new THREE.Vector2(14, 70) }, uGain: { value: CONFIG.gain },
             uSafe: { value: new THREE.Vector4(-2, -2, -2, -2) }, uSafeOn: { value: 0 } };   // text-safe zone, in clip space
function pointsMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uScale: PU.uScale, uFog: PU.uFog, uGain: PU.uGain, uSafe: PU.uSafe, uSafeOn: PU.uSafeOn },
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    vertexShader: [
      'attribute vec4 aColor; attribute float aSize;',
      'uniform float uScale, uGain, uSafeOn; uniform vec2 uFog; uniform vec4 uSafe; varying vec4 vColor;',
      'void main(){',
      '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
      '  gl_Position = projectionMatrix * mv;',
      '  float d = max(-mv.z, 0.01);',
      '  float px = aSize * uScale / d;',
      '  gl_PointSize = clamp(px, 1.5, uScale * 0.016);',
      '  float fog = 1.0 - smoothstep(uFog.x, uFog.y, d);',
      '  float near = smoothstep(2.5, 9.0, d);',
      '  vec2 n = gl_Position.xy / gl_Position.w;',
      '  float inx = smoothstep(uSafe.x - 0.12, uSafe.x + 0.02, n.x) * (1.0 - smoothstep(uSafe.z - 0.02, uSafe.z + 0.16, n.x));',
      '  float iny = smoothstep(uSafe.y - 0.12, uSafe.y + 0.02, n.y) * (1.0 - smoothstep(uSafe.w - 0.02, uSafe.w + 0.18, n.y));',
      '  near *= 1.0 - 0.78 * uSafeOn * inx * iny;       // records dim where the copy sits',
      '  vColor = vec4(aColor.rgb, aColor.a * uGain * near * mix(0.1, 1.0, fog) * min(1.0, px / 1.5 + 0.35));',
      '}'].join('\n'),
    fragmentShader: [
      'varying vec4 vColor;',
      'void main(){',
      '  vec2 p = abs(gl_PointCoord - 0.5);',
      '  float sq = 1.0 - smoothstep(0.34, 0.5, max(p.x, p.y));',
      '  gl_FragColor = vec4(vColor.rgb, vColor.a * sq);',
      '}'].join('\n'),
  });
}

/* ---------- the stream ---------- */
const N = CONFIG.particles, S0 = -0.9, S1 = 8.9, RANGE = S1 - S0;
const LANES = 7, ROWS = 3, RANKS = 24;
const SRC_SIDE = [-13, -7.5, -2, 3.5, 7.5], SRC_UP = [4.5, -2, 6, -3.5, 2.5], SRC_TINT = [0, .7, .3, 1, .5];
const pPhase = new Float32Array(N), pSnap = new Float32Array(N), pA = new Float32Array(N), pB = new Float32Array(N),
      pGA = new Float32Array(N), pGB = new Float32Array(N), pH = new Float32Array(N);
const pSrc = new Uint8Array(N), pHist = new Uint8Array(N), pFlag = new Uint8Array(N), pOut = new Uint8Array(N);
for (let i = 0; i < N; i++) {
  const ph = rnd() * RANGE;
  pPhase[i] = ph; pSnap[i] = Math.round(ph * RANKS) / RANKS - ph;
  const ra = rnd(), rb = rnd();
  pA[i] = ra * 2 - 1; pB[i] = rb * 2 - 1;
  pGA[i] = (Math.floor(ra * LANES) - (LANES - 1) / 2) * 0.36;
  pGB[i] = (Math.floor(rb * ROWS) - (ROWS - 1) / 2) * 0.42;
  pH[i] = rnd();
  pSrc[i] = Math.floor(rnd() * SRC_SIDE.length);
  pHist[i] = rnd() < 0.38 ? 1 : 0;
  pFlag[i] = rnd() < 0.2 ? 1 : 0;
  const o = rnd(); pOut[i] = o < 0.58 ? 0 : o < 0.84 ? 1 : 2;
}
const sPos = new Float32Array(N * 3), sCol = new Float32Array(N * 4), sSize = new Float32Array(N);
const streamGeo = new THREE.BufferGeometry();
streamGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3).setUsage(THREE.DynamicDrawUsage));
streamGeo.setAttribute('aColor', new THREE.BufferAttribute(sCol, 4).setUsage(THREE.DynamicDrawUsage));
streamGeo.setAttribute('aSize', new THREE.BufferAttribute(sSize, 1).setUsage(THREE.DynamicDrawUsage));
const stream = new THREE.Points(streamGeo, pointsMaterial());
stream.frustumCulled = false; stream.renderOrder = 2;
scene.add(stream);

const OUTC = [COL.clear, COL.ice, COL.caught];
const SRC_COL = SRC_TINT.map(t => [lerp(COL.ledger[0], COL.signal[0], t), lerp(COL.ledger[1], COL.signal[1], t), lerp(COL.ledger[2], COL.signal[2], t)]);
const P8 = new THREE.Vector3(); pointAt(8, P8);

/* Where each record is and what it looks like, purely as a function of
   how far along the stream it is. Each stage changes the stream in the
   way the stage name says. */
function updateStream(wt) {
  const base = wt * CONFIG.flow;
  for (let i = 0; i < N; i++) {
    let s = S0 + (pPhase[i] + base) % RANGE;
    const q = sstep(1.5, 2.0, s);                 // 0 = loose, 1 = ordered
    s += q * pSnap[i];                            // fall into ranks
    const a = pA[i], b = pB[i], h = pH[i];
    let os = 0, ou = 0, ot = 0, size, al = 1, r, g, bl;

    if (s < 1) {
      /* separate sources, drawing together */
      const w = Math.pow(1 - clamp((s + 0.5) / 1.5, 0, 1), 1.6), j = pSrc[i];
      const amp = 0.18 + 0.4 * w;
      os = SRC_SIDE[j] * w + a * (0.75 + 0.9 * w) + Math.sin(wt * 1.4 + i) * amp;
      ou = SRC_UP[j] * w + b * (0.6 + 0.7 * w) + Math.cos(wt * 1.2 + i * 1.3) * amp;
      const c = SRC_COL[j]; r = lerp(c[0], COL.raw[0], 1 - w); g = lerp(c[1], COL.raw[1], 1 - w); bl = lerp(c[2], COL.raw[2], 1 - w);
      al = sstep(S0, S0 + 0.35, s) * (0.5 + 0.5 * h);
      size = 0.12 + 0.13 * h;
    } else {
      /* one bundle, then one lattice */
      const k = 1 - q;
      os = lerp(a * 0.75 + Math.sin(wt * 1.4 + i) * 0.18, pGA[i], q);
      ou = lerp(b * 0.6 + Math.cos(wt * 1.2 + i * 1.3) * 0.18, pGB[i], q);
      size = lerp(0.12 + 0.13 * h, 0.135, q);
      al = lerp(0.5 + 0.5 * h, 0.95, q);
      r = lerp(COL.raw[0], COL.unified[0], q); g = lerp(COL.raw[1], COL.unified[1], q); bl = lerp(COL.raw[2], COL.unified[2], q);

      const split = sstep(2.78, 3.3, s);
      if (pHist[i]) {
        /* history: lifts away, then feeds the model */
        const into = sstep(3.5, 4.0, s);
        ou = (ou + 1.55 * split) * (1 - into); os *= (1 - into);
        r = lerp(r, COL.ledger[0], split); g = lerp(g, COL.ledger[1], split); bl = lerp(bl, COL.ledger[2], split);
        size *= 1 - 0.45 * into;
        al *= 1 - sstep(3.9, 4.01, s);
      } else {
        ou -= 1.55 * split * (1 - sstep(4.12, 4.8, s));
        r = lerp(r, COL.signal[0], split); g = lerp(g, COL.signal[1], split); bl = lerp(bl, COL.signal[2], split);

        /* score gate */
        const sc = sstep(4.99, 5.03, s);
        if (sc > 0) {
          const d = (s - 5.0) / 0.04, flash = Math.exp(-d * d);
          const c = pFlag[i] ? COL.flag : COL.normal;
          r = lerp(r, c[0], sc) + flash * .7; g = lerp(g, c[1], sc) + flash * .7; bl = lerp(bl, c[2], sc) + flash * .7;
          size *= 1 + flash * 0.9 + (pFlag[i] ? 0.4 * sc : 0);
          if (!pFlag[i]) al *= 1 - 0.25 * sc;
        }

        if (s > 6) {
          if (!pFlag[i]) {
            /* passes: arcs over the review step */
            ou += 7 * Math.sin(Math.PI * clamp((s - 6) / 2, 0, 1));
            al *= 1 - 0.3 * sstep(6, 6.4, s);
            const cg = sstep(7.3, 8, s);
            r = lerp(r, COL.clear[0], cg); g = lerp(g, COL.clear[1], cg); bl = lerp(bl, COL.clear[2], cg);
          } else {
            /* flagged: circles the reviewer, leaves with an outcome */
            const d = (s - 7) / 0.3, wv = Math.exp(-d * d), th = wt * 1.5 + i * 2.399 + s * 9;
            os = os * (1 - wv) + Math.cos(th) * 1.95 * wv; ou = ou * (1 - wv) + Math.sin(th) * 1.95 * wv;
            const oc = sstep(7.12, 7.42, s), c = OUTC[pOut[i]];
            r = lerp(r, c[0], oc); g = lerp(g, c[1], oc); bl = lerp(bl, c[2], oc);
            const ln = sstep(7.3, 7.6, s);
            ou = ou * (1 - ln) + ((pOut[i] - 1) * 0.95 + pGB[i] * 0.25) * ln;
          }
          const conv = sstep(7.72, 8.0, s); os *= 1 - 0.85 * conv; ou *= 1 - 0.85 * conv;
        }

        if (s >= 8) {
          /* the loop closes */
          const w = (s - 8) / (S1 - 8), ang = w * Math.PI * 2 * 1.35;
          const rad = 3.0 * sstep(0, 0.2, w) + pGA[i] * 0.22;
          ot = Math.cos(ang) * rad; os = Math.sin(ang) * rad; ou = pGB[i] * 0.3;
          al *= 1 - sstep(0.78, 1, w);
          if (!pFlag[i]) { r = COL.clear[0]; g = COL.clear[1]; bl = COL.clear[2]; }
          s = 8;
        }
      }
    }

    const x = lutIdx(s), li = x | 0, f = x - li, o = li * 3, i3 = i * 3, i4 = i * 4;
    for (let c = 0; c < 3; c++) {
      const P = LP[o + c] + (LP[o + 3 + c] - LP[o + c]) * f;
      sPos[i3 + c] = P + LS[o + c] * os + LU[o + c] * ou + LT[o + c] * ot;
    }
    sCol[i4] = r; sCol[i4 + 1] = g; sCol[i4 + 2] = bl; sCol[i4 + 3] = al;
    sSize[i] = size;
  }
  streamGeo.attributes.position.needsUpdate = true;
  streamGeo.attributes.aColor.needsUpdate = true;
  streamGeo.attributes.aSize.needsUpdate = true;
}

/* ---------- spine, floor and dust ---------- */
(function buildSpine(){
  const pos = [], col = [], c = new THREE.Color(COLORS.ledger);
  for (let i = 10; i <= 900; i++) { pos.push(LP[i * 3], LP[i * 3 + 1], LP[i * 3 + 2]); const k = sstep(10, 120, i) * 0.9; col.push(c.r * k, c.g * k, c.b * k); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  scene.add(new THREE.Line(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false })));
})();
(function buildFloorAndDust(){
  const pos = [], col = [], size = [];
  for (let x = -60; x <= 150; x += 3) for (let z = -54; z <= 54; z += 3) {
    pos.push(x, -9, z); col.push(COL.ledger[0], COL.ledger[1], COL.ledger[2], 0.33); size.push(0.085);
  }
  for (let i = 0; i < 900; i++) {
    pos.push(-70 + rnd() * 240, -6 + rnd() * 46, -70 + rnd() * 120);
    col.push(COL.unified[0], COL.unified[1], COL.unified[2], 0.12 + rnd() * 0.3); size.push(0.05 + rnd() * 0.07);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aColor', new THREE.Float32BufferAttribute(col, 4));
  g.setAttribute('aSize', new THREE.Float32BufferAttribute(size, 1));
  const p = new THREE.Points(g, pointsMaterial()); p.frustumCulled = false; p.renderOrder = 1;
  scene.add(p);
})();

/* ---------- stage nodes: each has its own form ---------- */
const nodes = [];
function glowMat(color, opacity, line) {
  const M = line ? THREE.LineBasicMaterial : THREE.MeshBasicMaterial;
  const m = new M({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
  m.userData.base = opacity; return m;
}
function ring(R, tube, color, op, plane) {       // plane: 'flat' lies level, 'gate' faces the stream
  const m = new THREE.Mesh(new THREE.TorusGeometry(R, tube, 10, 120), glowMat(color, op));
  if (plane === 'flat') m.rotation.x = Math.PI / 2; else m.rotation.y = Math.PI / 2;
  return m;
}
const wire = (geo, color, op) => new THREE.LineSegments(new THREE.WireframeGeometry(geo), glowMat(color, op, true));
const edges = (geo, color, op) => new THREE.LineSegments(new THREE.EdgesGeometry(geo), glowMat(color, op, true));

STAGES.forEach((st, k) => {
  const g = new THREE.Group(), col = COLORS[st.color], spin = [];
  const o = lutIdx(k + 1) | 0, o3 = o * 3;
  const T = new THREE.Vector3(LT[o3], LT[o3 + 1], LT[o3 + 2]), U = new THREE.Vector3(LU[o3], LU[o3 + 1], LU[o3 + 2]), S = new THREE.Vector3(LS[o3], LS[o3 + 1], LS[o3 + 2]);
  g.position.set(st.at[0], st.at[1], st.at[2]);
  g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(T, U, S));   // local x runs along the stream
  const add = (obj, sp) => { g.add(obj); if (sp) spin.push([obj, sp]); return obj; };

  if (k === 0) {            // Acquire: a funnel
    [[-3.2, 3.1, .5], [-2.0, 2.3, .65], [-0.9, 1.55, .85]].forEach(a => { const r = add(ring(a[1], .035, col, a[2], 'gate')); r.position.x = a[0]; });
    add(ring(1.9, .05, col, 1, 'flat'));
    add(wire(new THREE.IcosahedronGeometry(.85, 1), col, .7), [.2, .5, 0]);
  } else if (k === 1) {     // Unify: nested boxes
    add(ring(2.0, .05, col, 1, 'flat'));
    add(edges(new THREE.BoxGeometry(1.5, 1.5, 1.5), col, .95), [.25, .4, 0]);
    add(edges(new THREE.BoxGeometry(.85, .85, .85), col, .8), [-.3, -.5, .2]);
  } else if (k === 2) {     // Featurize: a prism with two ways out
    add(ring(1.9, .05, col, 1, 'flat'));
    add(wire(new THREE.OctahedronGeometry(1.05, 0), col, .95), [0, .6, 0]);
  } else if (k === 3) {     // Train: the model
    add(ring(2.2, .05, col, 1, 'flat'));
    add(wire(new THREE.IcosahedronGeometry(1.35, 1), COLORS.signal, .6), [.12, .3, 0]);
    add(wire(new THREE.IcosahedronGeometry(.7, 0), col, 1), [-.3, -.45, .1]);
    add(ring(1.75, .025, col, .6, 'gate'), [0, 0, 0]);
  } else if (k === 4) {     // Score: a gate the stream passes through
    [[-.55, .55], [0, 1], [.55, .55]].forEach(a => { const r = add(ring(1.75, a[0] === 0 ? .055 : .03, col, a[1], 'gate')); r.position.x = a[0]; });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.72, 64), glowMat(col, .07)); disc.material.side = THREE.DoubleSide; disc.rotation.y = Math.PI / 2; add(disc);
    g.userData.disc = disc;
  } else if (k === 5) {     // Decide: a switch
    add(ring(2.0, .05, col, 1, 'flat'));
    const d = add(wire(new THREE.OctahedronGeometry(.95, 0), col, 1), [0, .7, 0]); d.scale.y = 1.5;
    const up = add(ring(1.0, .035, COLORS.normal, .8, 'gate')); up.position.set(3.0, 2.5, 0); up.rotation.z = .6;
  } else if (k === 6) {     // Investigate: a lens with evidence around it
    add(ring(2.05, .055, col, 1, 'flat'));
    add(wire(new THREE.IcosahedronGeometry(.9, 1), col, .85), [.15, .5, 0]);
    const orbit = new THREE.Group();
    for (let j = 0; j < 4; j++) {
      const card = edges(new THREE.PlaneGeometry(.95, .62), col, .9), a = j / 4 * Math.PI * 2;
      card.position.set(Math.cos(a) * 2.9, Math.sin(j * 1.7) * .5 + .3, Math.sin(a) * 2.9); card.rotation.y = -a + Math.PI / 2;
      orbit.add(card);
    }
    add(orbit, [0, .28, 0]);
  } else {                  // Resolve: the closed loop
    add(ring(3.0, .045, col, .9, 'flat'));
    add(ring(1.7, .05, COLORS.signal, 1, 'flat'));
    add(wire(new THREE.IcosahedronGeometry(.8, 1), COLORS.signal, .8), [.15, .45, 0]);
  }

  /* status marker above each node: a ring, filled once the stage is done */
  const mk = new THREE.Group();
  const mRing = new THREE.Mesh(new THREE.RingGeometry(.26, .36, 40), glowMat(col, 1));
  const mDot = new THREE.Mesh(new THREE.CircleGeometry(.3, 32), glowMat(col, 0));
  mk.add(mRing, mDot); mk.position.copy(g.position).addScaledVector(U, 3.0);
  scene.add(mk);

  const mats = []; g.traverse(o => { if (o.material) mats.push(o.material); });
  g.userData.spin = spin; g.userData.mats = mats; g.userData.glow = .3; g.userData.fill = 0;
  g.userData.marker = mk; g.userData.mDot = mDot; g.userData.mRing = mRing; g.userData.up = U;
  scene.add(g); nodes.push(g);
});

/* ---------- post: bloom when available ---------- */
let composer = null, bloom = null;
{
  try {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(2, 2), CONFIG.bloom.strength, CONFIG.bloom.radius, CONFIG.bloom.threshold);
    composer.addPass(bloom);
  } catch (e) { composer = null; }
}

/* ---------- DOM: copy, legend, labels, screenshots, progress ---------- */
$('brandA').textContent = CONFIG.brand[0]; $('brandB').textContent = CONFIG.brand[1];
const elCopy = $('copy'), elKick = $('kicker'), elTitle = $('title'), elTitleWrap = $('titleWrap'), elSub = $('sub'), elMeta = $('meta'),
      elSegs = $('segs'), elClock = $('clock'), elFade = $('fade'), elLabels = $('labels'), elPlay = $('play');
const qs = new URLSearchParams(location.search);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function setCopy(i) {
  const sc = SCENES[i];
  elKick.innerHTML = (sc.stage ? '<b>Stage ' + sc.stage + ' of ' + STAGES.length + '</b><i></i>' : '') + '<span>' + esc(sc.kicker) + '</span>';
  elTitle.textContent = sc.title; elTitleWrap.classList.toggle('long', !!sc.long);
  elSub.textContent = sc.sub;
  let m = '';
  (KEY[sc.legend] || []).forEach(k => { m += '<span class="key" style="--c:var(' + (cssVar[k[0]] || '--signal') + ')"><i></i>' + esc(k[1]) + '</span>'; });
  if (sc.module) m += '<span class="where">In the app: <strong>' + esc(sc.module) + '</strong></span>';
  elMeta.innerHTML = m;
  document.documentElement.style.setProperty('--accent', 'var(' + (cssVar[sc.accent] || '--signal') + ')');
}

const segs = SCENES.map((sc, i) => {
  const b = document.createElement('button'); b.className = 'seg'; b.style.flexGrow = sc.dur; b.title = sc.title;
  b.setAttribute('aria-label', 'Go to ' + sc.title); b.innerHTML = '<i></i>';
  b.addEventListener('click', () => seek(starts[i]));
  elSegs.appendChild(b); return b;
});

/* labels pinned to 3D points */
function makeLabel(text, cls) { const d = document.createElement('div'); d.className = 'lab ' + (cls || ''); d.textContent = text; elLabels.appendChild(d); return { el: d, o: 0, w: new THREE.Vector3() }; }
const nodeLabels = STAGES.map((st, k) => { const L = makeLabel(st.name); L.w.copy(nodes[k].position).addScaledVector(nodes[k].userData.up, -3.0); return L; });
const srcLabels = SOURCES.slice(0, SRC_SIDE.length).map((name, j) => {
  const L = makeLabel(name, 'src'), s = 0.2, x = lutIdx(s) | 0, o = x * 3, w = Math.pow(1 - (s + .5) / 1.5, 1.6);
  L.w.set(LP[o] + LS[o] * SRC_SIDE[j] * w + LU[o] * (SRC_UP[j] * w + 1.1),
          LP[o + 1] + LS[o + 1] * SRC_SIDE[j] * w + LU[o + 1] * (SRC_UP[j] * w + 1.1),
          LP[o + 2] + LS[o + 2] * SRC_SIDE[j] * w + LU[o + 2] * (SRC_UP[j] * w + 1.1));
  return L;
});

/* ---------- app screenshots ----------
   shots/acquire1.png, shots/acquire2.png ... play during the scene whose
   id they start with, in number order, sharing its screenshot time. The
   built film looks for a shots/ folder next to docs/ when it opens, so new
   screenshots show up without a rebuild; if there is none it uses the ones
   packed in at build time. */
const EXTS = ['png', 'jpg', 'jpeg', 'webp'];
const SHOTS = {};                                        // scene id -> [{ src, el, img, ar }]
const shotKey = path => {
  const m = /([^/\\]+)\.(png|jpe?g|webp)$/i.exec(path); if (!m) return null;
  const k = /^(.*?)[-_ ]?(\d*)$/.exec(m[1].toLowerCase());
  return { id: k[1], n: k[2] ? +k[2] : 0 };
};
function bundledShots() {
  const by = {};
  Object.keys(BUNDLED).forEach(path => {
    const k = shotKey(path);
    if (k && SCENES.some(sc => sc.id === k.id)) (by[k.id] = by[k.id] || []).push({ n: k.n, src: BUNDLED[path] });
  });
  Object.keys(by).forEach(id => { by[id] = by[id].sort((a, b) => a.n - b.n).map(x => x.src); });
  return by;
}
const loadImg = src => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
async function folderShots(base) {
  const find = async name => (await Promise.all(EXTS.map(e => loadImg(base + name + '.' + e)))).find(Boolean);
  const by = {};
  await Promise.all(SCENES.map(async sc => {
    const list = [], bare = await find(sc.id);
    if (bare) list.push(bare);
    for (let n = 1; n < 100; n++) { const im = await find(sc.id + n); if (!im) break; list.push(im); }
    if (list.length) by[sc.id] = list.map(im => im.src);
  }));
  return by;
}
const elShots = $('shots'), elScrim = $('scrim'), elCap = document.createElement('div');
elCap.className = 'shotcap'; elShots.appendChild(elCap);
const ready = (async () => {
  let by = {};
  if (!import.meta.env.DEV && !qs.has('bundled')) by = await folderShots(new URL('../shots/', location.href).href);
  if (!Object.keys(by).length) by = bundledShots();      // no folder found: use the packed-in set
  const jobs = [];
  Object.keys(by).forEach(id => {
    const sc = SCENES.find(x => x.id === id), list = by[id];
    SHOTS[id] = list.map((src, k) => {
      const el = document.createElement('figure'); el.className = 'shot';
      const img = new Image(); img.alt = ''; img.src = src; el.appendChild(img);
      el.style.setProperty('--c', 'var(' + (cssVar[sc.accent] || '--signal') + ')');
      elShots.appendChild(el);
      const s = { src, el, img, ar: 16 / 9, w: 0, h: 0 };
      jobs.push(img.decode().catch(() => {}).then(() => { if (img.naturalWidth) s.ar = img.naturalWidth / img.naturalHeight; }));
      return s;
    });
  });
  await Promise.all(jobs);
  shotsDirty = true;
  return Object.keys(SHOTS).reduce((o, id) => (o[id] = SHOTS[id].length, o), {});
})();
let shotsDirty = true;
function layoutShots() {
  const f = CONFIG.shots.fill;
  Object.keys(SHOTS).forEach(id => SHOTS[id].forEach(s => {
    s.w = Math.min(W * f, H * f * s.ar); s.h = s.w / s.ar;
    s.el.style.width = s.w.toFixed(1) + 'px'; s.el.style.height = s.h.toFixed(1) + 'px';
  }));
  shotsDirty = false;
}
/* Every shot gets an equal slice of the scene's screenshot time. Placement
   is computed from the clock each frame, so exports are frame exact. */
function updateShots(i, lt) {
  const sc = SCENES[i], list = SHOTS[sc.id] || [], n = list.length;
  if (shotsDirty) layoutShots();
  Object.keys(SHOTS).forEach(id => { if (id !== sc.id) SHOTS[id].forEach(s => { if (s.on) { s.on = false; s.el.style.display = 'none'; } }); });
  if (!n) { elCap.style.opacity = 0; return [0, 0]; }
  const a = sc.dur * CONFIG.shots.from, b = sc.dur * CONFIG.shots.to, slot = (b - a) / n, X = Math.min(0.6, slot * 0.4);
  const ramp = (x0, x1) => clamp((lt - x0) / (x1 - x0), 0, 1);
  let top = 0, topOp = -1;
  list.forEach((s, k) => {
    const s0 = a + k * slot, s1 = s0 + slot;
    const ein = easeIO(k === 0 ? ramp(s0, s0 + 0.9) : ramp(s0 - X / 2, s0 + X / 2));
    const eout = easeIO(k === n - 1 ? ramp(b - 0.6, b) : ramp(s1 - X / 2, s1 + X / 2));
    const op = ein * (1 - eout);
    if (op > topOp) { topOp = op; top = k; }
    if (op <= 0.001) { if (s.on) { s.on = false; s.el.style.display = 'none'; } return; }
    if (!s.on) { s.on = true; s.el.style.display = 'block'; }
    const dx = (k === 0 ? 0 : (1 - ein) * 6) - (k === n - 1 ? 0 : eout * 6);
    const dy = k === 0 ? (1 - ein) * 5 : 0, tilt = k === 0 ? (1 - ein) * 9 : 0;
    const z = (k === 0 ? .93 + .07 * ein : 1) * (k === n - 1 ? 1 + .035 * eout : 1) * (1 + .014 * clamp((lt - s0) / slot, 0, 1));
    s.el.style.opacity = op.toFixed(3);
    s.el.style.transform = 'translate(-50%,-50%) perspective(2000px) translate3d(' + dx.toFixed(2) + '%,' + dy.toFixed(2) + '%,0) rotateX(' + tilt.toFixed(2) + 'deg) scale(' + z.toFixed(4) + ')';
  });
  const on = sstep(a, a + 0.9, lt) * (1 - sstep(b - 0.6, b, lt));
  /* one caption above the frame, with a counter when there are several */
  const capKey = sc.id + top;
  if (elCap.dataset.key !== capKey) {
    elCap.dataset.key = capKey;
    elCap.style.setProperty('--c', 'var(' + (cssVar[sc.accent] || '--signal') + ')');
    elCap.innerHTML = '<span class="t">' + (sc.stage ? '<b>Stage ' + sc.stage + ' of ' + STAGES.length + '</b><i></i>' : '') + esc(sc.title) + '</span>' +
      (sc.module ? '<span class="m">In the app: <strong>' + esc(sc.module) + '</strong></span>' : '') +
      (n > 1 ? '<span class="n">' + (top + 1) + ' / ' + n + '</span>' : '');
  }
  const f = list[top];
  elCap.style.opacity = on.toFixed(3);
  elCap.style.left = ((W - f.w) / 2).toFixed(1) + 'px'; elCap.style.width = f.w.toFixed(1) + 'px';
  elCap.style.bottom = ((H + f.h) / 2).toFixed(1) + 'px';
  return [on, sstep(a - 0.2, a + 0.6, lt)];              // scrim, and how far the copy should be out of the way
}

/* ---------- the team: an org chart from team/ ----------
   Photos are named First_Last_Role_N_lL.png: level L is the row (1 at the
   top), N the order within it. A page opened from disk cannot list a
   folder, so tools/check.mjs writes team/team.js with the file names; the
   built film reads that list and falls back to the photos packed in at
   build time. */
const elTeam = $('team');
let TEAM = [], teamRows = [], teamDirty = true;
function teamPerson(file, src) {
  const base = decodeURIComponent(file.split(/[\\/]/).pop()).replace(/\.(png|jpe?g|webp)$/i, '');
  const parts = base.split('_');
  if (parts.length < 5 || !/^l\d+$/i.test(parts[parts.length - 1]) || !/^\d+$/.test(parts[parts.length - 2])) return null;
  return { name: parts[0] + ' ' + parts[1], role: parts.slice(2, -2).join(' '),
           n: +parts[parts.length - 2], level: +parts[parts.length - 1].slice(1), src };
}
const loadScript = src => new Promise(res => { const el = document.createElement('script'); el.onload = () => res(true); el.onerror = () => res(false); el.src = src; document.head.appendChild(el); });
/* keeps only the people whose photo actually loads, so a stale team.js
   that still lists deleted files cannot leave empty circles */
async function loadPeople(list) {
  const people = list.filter(Boolean);
  await Promise.all(people.map(m => { m.img = new Image(); m.img.alt = ''; m.img.src = m.src; return m.img.decode().catch(() => {}); }));
  return people.filter(m => m.img.naturalWidth > 0);
}
const teamReady = (async () => {
  let list = [];
  if (!import.meta.env.DEV && !qs.has('bundled')) {
    const base = new URL('../team/', location.href).href;
    if (await loadScript(base + 'team.js') && Array.isArray(window.VERTEX_TEAM))
      list = await loadPeople(window.VERTEX_TEAM.map(f => teamPerson(f, base + encodeURIComponent(f))));
  }
  if (!list.length) list = await loadPeople(Object.keys(BUNDLED_TEAM).map(path => teamPerson(path, BUNDLED_TEAM[path])));
  TEAM = list.sort((a, b) => a.level - b.level || a.n - b.n);
  TEAM.forEach(m => {
    m.el = document.createElement('div'); m.el.className = 'person';
    m.el.appendChild(m.img);
    m.el.insertAdjacentHTML('beforeend', '<b>' + esc(m.name) + '</b><span>' + esc(m.role) + '</span>');
    elTeam.appendChild(m.el);
  });
  /* rows: one per level, long levels split over several rows */
  const levels = [];
  TEAM.forEach(m => { if (!levels.length || levels[levels.length - 1][0].level !== m.level) levels.push([]); levels[levels.length - 1].push(m); });
  teamRows = [];
  levels.forEach(lv => {
    const k = Math.ceil(lv.length / CONFIG.team.perRow), per = Math.ceil(lv.length / k);
    for (let r = 0; r < k; r++) teamRows.push({ people: lv.slice(r * per, (r + 1) * per) });
  });
  teamRows.forEach((row, r) => {
    row.bus = document.createElement('i'); row.bus.className = 'bus'; elTeam.appendChild(row.bus);
    row.stem = document.createElement('i'); row.stem.className = 'stem'; elTeam.appendChild(row.stem);
    row.people.forEach(m => { m.drop = document.createElement('i'); m.drop.className = 'drop'; elTeam.appendChild(m.drop); });
  });
  const head = document.createElement('header'); elTeam.appendChild(head);
  const motto = document.createElement('p'); motto.className = 'motto'; elTeam.appendChild(motto);
  teamDirty = true;
  return TEAM.length;
})();
const px = v => v.toFixed(1) + 'px';
function place(el, x, y, w, h) { el.style.left = px(x); el.style.top = px(y); if (w !== undefined) el.style.width = px(w); if (h !== undefined) el.style.height = px(h); }
function layoutTeam() {
  teamDirty = false;
  if (!teamRows.length) return;
  const f = CONFIG.shots.fill, bw = W * f, bh = H * f, x0 = (W - bw) / 2, y0 = (H - bh) / 2;
  const headH = bh * .17, mottoH = bh * .15, top = y0 + headH, rowH = (bh - headH - mottoH) / teamRows.length;
  const most = Math.max.apply(null, teamRows.map(r => r.people.length)), colW = bw / most;
  const d = Math.min(rowH * .52, colW * .56, H * .2), fs = Math.max(10, d * .14), gap = rowH * .1;
  elTeam.style.setProperty('--d', px(d)); elTeam.style.setProperty('--fs', px(fs));
  const cw = Math.min(colW, d * 2.1), cx = W / 2;
  teamRows.forEach((row, r) => {
    const n = row.people.length, ry = top + r * rowH, busY = ry + gap * .5, cardY = ry + gap;
    row.people.forEach((m, k) => {
      const x = cx + (k - (n - 1) / 2) * colW;
      m.x = x; place(m.el, x - cw / 2, cardY, cw);
      place(m.drop, x, busY, undefined, cardY - busY);
    });
    const span = (n - 1) * colW;
    place(row.bus, cx - span / 2, busY, span);
    row.cardBottom = cardY + d + fs * 3.6;
    if (r > 0) place(row.stem, cx, teamRows[r - 1].cardBottom, undefined, Math.max(0, busY - teamRows[r - 1].cardBottom));
  });
  const head = elTeam.querySelector('header'), motto = elTeam.querySelector('.motto');
  place(head, x0, y0, bw); place(motto, x0, y0 + bh - mottoH * .75, bw);
}
let teamScene = -1;
function updateTeam(i, lt) {
  const sc = SCENES[i];
  if (teamDirty) layoutTeam();
  if (!sc.team || !TEAM.length) { if (teamScene !== -1) { elTeam.style.display = 'none'; teamScene = -1; } return [0, 0]; }
  if (teamScene !== i) {
    teamScene = i; elTeam.style.display = 'block';
    elTeam.style.setProperty('--c', 'var(' + (cssVar[sc.accent] || '--signal') + ')');
    elTeam.querySelector('header').innerHTML = '<span>' + esc(sc.kicker) + '</span><h2>' + esc(sc.title) + '</h2>';
    elTeam.querySelector('.motto').textContent = sc.sub;
  }
  const T = CONFIG.team, ramp = (x0, x1) => clamp((lt - x0) / (x1 - x0), 0, 1);
  const show = (el, e, dy) => { el.style.opacity = e.toFixed(3); el.style.transform = dy ? 'translateY(' + ((1 - e) * dy).toFixed(1) + 'px)' : ''; };
  show(elTeam.querySelector('header'), easeIO(ramp(.3, 1.3)), 14);
  teamRows.forEach((row, r) => {
    const t0 = T.reveal + r * T.row, n = row.people.length;
    const line = easeIO(ramp(t0, t0 + .5));
    row.stem.style.transform = 'scaleY(' + (r > 0 ? line : 0).toFixed(3) + ')';
    row.bus.style.transform = 'scaleX(' + (r > 0 || n > 1 ? easeIO(ramp(t0 + .25, t0 + .75)) : 0).toFixed(3) + ')';
    row.people.forEach((m, k) => {
      const e = easeIO(ramp(t0 + .45 + k * .07, t0 + 1.05 + k * .07));
      m.drop.style.transform = 'scaleY(' + (r > 0 || n > 1 ? e : 0).toFixed(3) + ')';
      m.el.style.opacity = e.toFixed(3);
      m.el.style.transform = 'translateY(' + ((1 - e) * 18).toFixed(1) + 'px) scale(' + (.9 + .1 * e).toFixed(4) + ')';
    });
  });
  show(elTeam.querySelector('.motto'), easeIO(ramp(T.motto, T.motto + 1.2)), 16);
  return [sstep(0, .9, lt), 1];
}

const ICON = {
  pause: '<svg viewBox="0 0 24 24"><path d="M9 5v14M15 5v14"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M8 5l11 7-11 7z"/></svg>',
  again: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v5h5"/></svg>',
};

/* ---------- camera rig ---------- */
const tp = new THREE.Vector3(), tl = new THREE.Vector3(), pp = new THREE.Vector3(), pl = new THREE.Vector3(),
      k1p = new THREE.Vector3(), k1l = new THREE.Vector3(), k2p = new THREE.Vector3(), k2l = new THREE.Vector3(),
      look = new THREE.Vector3(50, 2, 0), tmp = new THREE.Vector3();
const rig = { fov: 40, fogN: 14, fogF: 70, cx: .62, cy: .4, big: 1, snap: true };
function keyPose(k, P, L) {
  if (k.p) { P.fromArray(k.p); L.fromArray(k.l); return; }
  pointAt(k.s, P); P.x += k.off[0]; P.y += k.off[1]; P.z += k.off[2];
  pointAt(k.ls === undefined ? k.s : k.ls, L); if (k.loff) { L.x += k.loff[0]; L.y += k.loff[1]; L.z += k.loff[2]; }
}
function scenePose(i, p, P, L) {
  const c = SCENES[i].cam, e = easeSine(p);
  keyPose(c.a, k1p, k1l); keyPose(c.b, k2p, k2l);
  P.lerpVectors(k1p, k2p, e); L.lerpVectors(k1l, k2l, e);
}
const camNum = (i, key, def) => { const c = SCENES[i].cam; return c[key] === undefined ? def : c[key]; };

let W = 2, H = 2, aspect = 16 / 9, copyRect = null, frameNo = 0;
function resize() {
  W = window.innerWidth; H = window.innerHeight; aspect = W / H;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr); renderer.setSize(W, H, false);
  if (composer) { composer.setPixelRatio(dpr); composer.setSize(W, H); }
  camera.aspect = aspect; rig.snap = true; shotsDirty = true; teamDirty = true;
}
window.addEventListener('resize', resize);

/* ---------- playback state ---------- */
let t = 0, wt = 0, playing = !window.matchMedia('(prefers-reduced-motion: reduce)').matches, ended = false,
    cur = -1, copyState = '', last = performance.now();
function setPlaying(v) {
  playing = v; document.body.classList.toggle('paused', !v);
  elPlay.innerHTML = ended ? ICON.again : v ? ICON.pause : ICON.play;
  elPlay.setAttribute('aria-label', ended ? 'Play again' : v ? 'Pause' : 'Play');
}
function seek(time, hard) { t = clamp(time, 0, TOTAL - 0.001); ended = false; if (hard) rig.snap = true; setPlaying(playing); }
function step(d) { const i = sceneAt(t); seek(starts[clamp(d < 0 && t - starts[i] > 1.5 ? i : i + d, 0, SCENES.length - 1)]); }
$('prev').addEventListener('click', () => step(-1));
$('next').addEventListener('click', () => step(1));
elPlay.addEventListener('click', () => { if (ended) { seek(0, true); setPlaying(true); } else setPlaying(!playing); });
window.addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === ' ') { e.preventDefault(); elPlay.click(); }
  else if (k === 'arrowright') step(1);
  else if (k === 'arrowleft') step(-1);
  else if (k === 'h') document.body.classList.toggle('clean');
  else if (k === 'r') { seek(0, true); setPlaying(true); }
  else if (k === 'v') record();
  else if (k >= '1' && k <= '9') seek(starts[Math.min(+k + 1, SCENES.length - 1)]);
});
/* ?clean hides controls from the first frame, ?t=45 starts at 45 s, ?paused starts paused */
if (qs.has('clean')) document.body.classList.add('clean');
if (qs.has('t')) t = clamp(parseFloat(qs.get('t')) || 0, 0, TOTAL - .001);
if (qs.has('paused')) playing = false;

/* ---------- getting a video out ----------
   Three routes, simplest first:
   1. Press V. Chrome asks which tab to share; pick this one. The film
      restarts with the controls hidden, records itself to the end and
      saves vertex-showcase.mp4 (or .webm on older browsers).
   2. Screen capture: open with ?clean (or press H), start your capture
      tool, press R. The film fades in from black and holds its last frame.
   3. Frame-exact export: open with ?capture and call
      __vertex.renderAt(seconds, 1 / fps) once per frame from a script. */
let rec = null, toastTimer = 0;
function toast(msg) {
  const el = $('toast'); el.textContent = msg; el.classList.add('on');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('on'), 5200);
}
async function record() {
  if (rec) { if (rec.state !== 'inactive') rec.stop(); return; }
  const md = navigator.mediaDevices;
  if (!md || !md.getDisplayMedia || !window.MediaRecorder) { toast('This browser cannot record the tab. Use screen capture instead: press H, then R.'); return; }
  let media;
  try { media = await md.getDisplayMedia({ video: { frameRate: 60 }, audio: false, preferCurrentTab: true }); }
  catch (e) { toast('Recording was not allowed here. Open the page in its own tab, or use screen capture: press H, then R.'); return; }
  const type = ['video/mp4;codecs=avc1.640033', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'].find(m => MediaRecorder.isTypeSupported(m));
  const chunks = [];
  rec = new MediaRecorder(media, { mimeType: type, videoBitsPerSecond: 20e6 });
  rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  rec.onstop = () => {
    media.getTracks().forEach(tr => tr.stop());
    const blob = new Blob(chunks, { type: rec.mimeType }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'vertex-showcase.' + (blob.type.indexOf('mp4') > -1 ? 'mp4' : 'webm');
    document.body.appendChild(a); a.click(); a.remove();
    rec = null; document.body.classList.remove('clean'); toast('Saved the recording to your downloads.');
  };
  media.getVideoTracks()[0].addEventListener('ended', () => { if (rec && rec.state !== 'inactive') rec.stop(); });
  document.body.classList.add('clean');
  seek(0, true); setPlaying(false);
  setTimeout(() => { if (!rec) return; seek(0, true); rec.start(); setPlaying(true); }, 900);   // let the share prompt clear
}
const CAPTURE = qs.has('capture');
function renderAt(time, dt, skipDraw) {
  t = clamp(time, 0, TOTAL - 0.001); wt = time;
  update(dt);
  if (skipDraw) return;
  if (composer) composer.render(); else renderer.render(scene, camera);
}

const accentNow = new THREE.Color(COLORS.signal), accentTo = new THREE.Color();
const fmt = x => Math.floor(x / 60) + ':' + ('0' + Math.floor(x % 60)).slice(-2);

/* ---------- one frame ---------- */
function update(dt) {
  const i = sceneAt(t), sc = SCENES[i], lt = t - starts[i], p = clamp(lt / sc.dur, 0, 1);
  const damp = rig.snap ? 1 : 1 - Math.exp(-dt * 5), slow = rig.snap ? 1 : 1 - Math.exp(-dt * 2.4);

  /* copy */
  if (i !== cur) { cur = i; setCopy(i); copyState = 'pre'; elCopy.dataset.state = 'pre'; void elCopy.offsetWidth; copyRect = null; }
  const want = lt < 0.4 ? 'pre' : lt > sc.dur - 0.5 && i < SCENES.length - 1 ? 'out' : 'in';
  if (want !== copyState) { copyState = want; elCopy.dataset.state = want; }
  segs.forEach((b, k) => { b.style.setProperty('--p', k < i ? 1 : k === i ? p : 0); b.classList.toggle('past', k < i); });
  elClock.textContent = fmt(t) + ' / ' + fmt(TOTAL);
  elFade.style.opacity = (1 - sstep(0.1, 1.3, t)).toFixed(3);
  const sh = updateShots(i, lt), tm = updateTeam(i, lt), away = Math.max(sh[1], tm[1]);
  elScrim.style.opacity = Math.max(sh[0], tm[0]).toFixed(3);
  elCopy.style.opacity = (1 - away).toFixed(3); elLabels.style.opacity = (1 - away).toFixed(3);

  /* camera target for this instant */
  scenePose(i, p, tp, tl);
  let fov = camNum(i, 'fov', 38), fog = camNum(i, 'fog', [14, 70]), ctr = camNum(i, 'center', [.62, .34]);
  let fogN = fog[0], fogF = fog[1], cx = ctr[0], cy = ctr[1];
  const TR = sc.tr || CONFIG.transition;
  if (i > 0 && lt < TR) {
    const e = easeIO(lt / TR);
    scenePose(i - 1, 1, pp, pl);
    const dist = pp.distanceTo(tp);
    tp.lerpVectors(pp, tp, e); tl.lerpVectors(pl, tl, e);
    tp.y += Math.sin(Math.PI * e) * Math.min(dist * 0.05, 5);
    const f0 = camNum(i - 1, 'fog', [14, 70]), c0 = camNum(i - 1, 'center', [.62, .34]);
    fov = lerp(camNum(i - 1, 'fov', 38), fov, e);
    fogN = lerp(f0[0], fogN, e); fogF = lerp(f0[1], fogF, e); cx = lerp(c0[0], cx, e); cy = lerp(c0[1], cy, e);
  }
  if (aspect < 1) { cx = .5; cy = .3; }
  const zoom = clamp(1.5 / aspect, 1, 2.3);                 // step back on narrow screens
  tp.sub(tl).multiplyScalar(zoom).add(tl);
  fogN *= zoom; fogF *= zoom;

  camera.position.lerp(tp, damp); look.lerp(tl, damp);
  rig.fov = lerp(rig.fov, fov, damp); rig.fogN = lerp(rig.fogN, fogN, damp); rig.fogF = lerp(rig.fogF, fogF, damp);
  rig.cx = lerp(rig.cx, cx, damp); rig.cy = lerp(rig.cy, cy, damp);
  camera.fov = rig.fov; camera.lookAt(look);
  camera.setViewOffset(W, H, (0.5 - rig.cx) * W, (0.5 - rig.cy) * H, W, H);
  camera.updateMatrixWorld();
  PU.uScale.value = renderer.domElement.height / (2 * Math.tan(rig.fov * Math.PI / 360));
  PU.uFog.value.set(rig.fogN, rig.fogF); scene.fog.near = rig.fogN; scene.fog.far = rig.fogF * 1.25;
  accentTo.set(COLORS[sc.accent || 'signal']); accentNow.lerp(accentTo, slow); bgU.uAccent.value.copy(accentNow);
  bgU.uC.value.set(rig.cx, 1 - rig.cy);

  /* stream */
  updateStream(wt);

  /* nodes */
  const finale = sc.id === 'outro' || sc.id === 'team', st = sc.stage ? sc.stage - 1 : -1, wide = sc.id === 'overview' || finale;
  rig.big = lerp(rig.big, sc.big || 1, slow);
  nodes.forEach((g, k) => {
    let glow, fill, show;
    if (sc.id === 'overview') { const on = p > 0.06 + k * 0.05; glow = on ? .9 : .2; fill = on ? 1 : 0; show = on ? 1 : 0; }
    else if (finale) { glow = .82 + .18 * Math.sin(wt * 1.6 - k * .8); fill = 1; show = sc.id === 'team' ? 1 : sstep(.1, .3, p); }
    else if (st < 0) { glow = .34; fill = 0; show = .7; }
    else { glow = k === st ? 1 : k < st ? .5 : .32; fill = k < st || (k === st && p > .82) ? 1 : 0; show = k === st ? 0 : .72; }
    const u = g.userData;
    u.glow = lerp(u.glow, glow, slow); u.fill = lerp(u.fill, fill, slow);
    const pulse = 1 + 0.035 * Math.sin(wt * 2.2 + k) * u.glow;
    g.scale.setScalar(pulse * rig.big);
    u.mats.forEach(m => { m.opacity = m.userData.base * u.glow; });
    u.spin.forEach(a => { a[0].rotation.x += a[1][0] * dt; a[0].rotation.y += a[1][1] * dt; a[0].rotation.z += a[1][2] * dt; });
    if (u.disc) u.disc.material.opacity = (0.015 + 0.03 * (0.5 + 0.5 * Math.sin(wt * 3.1))) * u.glow;
    u.marker.quaternion.copy(camera.quaternion);
    u.marker.scale.setScalar(rig.big);
    u.marker.position.copy(g.position).addScaledVector(u.up, (2.6 + 0.12 * Math.sin(wt * 1.3 + k * 1.7)) * rig.big);
    u.mRing.material.opacity = 0.35 + 0.65 * u.glow; u.mDot.material.opacity = u.fill * (0.35 + 0.65 * u.glow);

    /* node name: neighbours only in close shots, all of them in wide shots */
    const L = nodeLabels[k], d = camera.position.distanceTo(g.position);
    L.w.copy(g.position).addScaledVector(u.up, -3.0 * rig.big);
    placeLabel(L, show * (wide ? 1 : 1 - sstep(30 * zoom, 46 * zoom, d)), slow, true);
  });
  const srcOn = sc.sources ? sstep(.12, .25, p) * (1 - sstep(.42, .5, p)) : 0;
  srcLabels.forEach(L => placeLabel(L, srcOn, slow, false));

  if (bloom) bloom.strength = CONFIG.bloom.strength * (wide ? 1.15 : 1);
  if ((frameNo++ % 12) === 0 || !copyRect) copyRect = elCopy.getBoundingClientRect();
  PU.uSafe.value.set(copyRect.left / W * 2 - 1, 1 - copyRect.bottom / H * 2, copyRect.right / W * 2 - 1, 1 - copyRect.top / H * 2);
  PU.uSafeOn.value = lerp(PU.uSafeOn.value, copyState === 'in' ? 1 : 0, slow);
  rig.snap = false;
}
function placeLabel(L, target, k, centred) {
  tmp.copy(L.w).project(camera);
  const x = (tmp.x * .5 + .5) * W, y = (-tmp.y * .5 + .5) * H;
  let vis = target;
  if (tmp.z > 1 || x < 40 || x > W - 40 || y < 50 || y > H - 70) vis = 0;
  if (copyRect && x > copyRect.left - 70 && x < copyRect.right + 30 && y > copyRect.top - 26 && y < copyRect.bottom + 16) vis = 0;
  L.o = lerp(L.o, vis, Math.min(1, k * 2.2));
  L.el.style.opacity = L.o < 0.01 ? 0 : L.o.toFixed(3);
  if (L.o >= 0.01) L.el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) translate(' + (centred ? '-50%' : '0') + ',-50%)';
}

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.1); last = now;
  wt += dt;                                   // the world keeps moving while paused
  if (playing) {
    t += dt;
    if (t >= TOTAL) {
      if (rec && rec.state === 'recording') setTimeout(() => { if (rec && rec.state !== 'inactive') rec.stop(); }, 700);
      if (CONFIG.loop && !rec) { t = 0; rig.snap = true; } else { t = TOTAL - 0.001; ended = true; setPlaying(false); }
    }
  }
  update(dt);
  if (composer) composer.render(); else renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

resize(); setPlaying(playing);
window.__vertex = { seek: x => seek(x, true), play: v => setPlaying(v), record, renderAt, total: TOTAL, scenes: SCENES, config: CONFIG, ready: Promise.all([ready, teamReady]).then(r => ({ shots: r[0], team: r[1] })), shots: SHOTS, team: () => TEAM };
if (CAPTURE) { document.body.classList.add('clean'); renderAt(0, 1 / 30); }
else requestAnimationFrame(now => { last = now; frame(now); });
}

boot();
