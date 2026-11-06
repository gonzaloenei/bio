// Whirl prototypes: a paint vortex (WebGL) and/or streams of notes spiraling around Figaro.
// Driven either by the cursor (stir it) or by scroll (wind it up).
import { place, img, toScreen, pointer, clamp, prefersReducedMotion } from './stage.js';

const FOCUS = 0.42, FIG_DEPTH = 165 / 255, NOTE_DEPTH = 0.55, ZOOM = 0.975;
const CENTER = [1760, 1150];            // eye of the vortex, image px (just above Figaro's head)
const ORBIT = { x: 1760, y: 1350, ky: 0.38 };   // the ring the notes travel on, around his torso
const HANDS = [[1150, 905], [2475, 1505]];     // scissors tip, comb

export async function whirlPage({ vortex, notes }) {
  const mode = new URLSearchParams(location.search).get('mode') === 'scroll' ? 'scroll' : 'cursor';
  document.body.classList.add('mode-' + mode);
  document.querySelectorAll('.modes a').forEach(a => {
    if (a.dataset.mode === mode) a.setAttribute('aria-current', 'page');
    a.href = '?mode=' + a.dataset.mode;
  });

  const stage = document.getElementById('stage');
  const fig = place(document.createElement('div'), 'figaro');
  fig.className = 'figure';
  fig.appendChild(img('../assets/figaro.png'));
  stage.appendChild(fig);

  const bg = await createBackground(document.getElementById('gl'));
  const notesFx = notes ? createNotes(document.getElementById('back'), document.getElementById('front')) : null;

  const ptr = pointer();
  const scroller = document.getElementById('scroller');
  const headline = document.getElementById('headline');
  const bar = document.getElementById('bar');

  // Cursor mode: how fast the pointer is circling the vortex centre (radians per move, clockwise +).
  let angAcc = 0, lastX = null, lastY = null;
  addEventListener('pointermove', (e) => {
    if (lastX != null) {
      const c = toScreen(stage, CENTER[0], CENTER[1]);
      const rx = e.clientX - c.x, ry = e.clientY - c.y, vx = e.clientX - lastX, vy = e.clientY - lastY;
      const soft = (120 * c.s / 0.3) ** 2;     // keep tiny circles right at the centre from exploding
      angAcc += (rx * vy - ry * vx) / (rx * rx + ry * ry + soft);
    }
    lastX = e.clientX; lastY = e.clientY;
  });

  let twist = 0, spin = 0, T = 0, glow = 0, p = 0, last = performance.now();

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    ptr.update(0.06);

    if (mode === 'cursor') {
      const target = clamp(angAcc, -0.25, 0.25); angAcc = 0;
      spin += (target - spin) * 0.25;
      if (vortex) twist = clamp((twist + spin * 1.6) * 0.975, -3.5, 3.5);   // stir in, relax back out
      T += dt * 0.25 + clamp(spin * 1.2, -0.25, 0.25);
      glow += (clamp(Math.abs(spin) * 25, 0, 1) - glow) * 0.05;
      bar.style.width = '0';
    } else {
      const max = scroller.offsetHeight - innerHeight;
      const target = clamp(scrollY / max, 0, 1);
      p += (target - p) * 0.12;
      const e = p * p * (3 - 2 * p);
      const prev = twist;
      if (vortex) twist = e * 3.2;
      spin = twist - prev;
      T = p * 16;
      glow = clamp(p / 0.08, 0, 1);
      headline.style.opacity = 1 - clamp(p / 0.25, 0, 1) * 0.85;
      bar.style.width = target * 100 + '%';
    }
    if (prefersReducedMotion) { twist *= 0.3; spin *= 0.3; }

    const mx = ptr.x, my = ptr.y;
    bg.render(mx, my, twist, vortex ? spin : 0);
    const r = stage.getBoundingClientRect();
    const parX = d => -mx * (d - FOCUS) * 0.028 * r.width;
    const parY = d => -my * (d - FOCUS) * 0.02 * r.height;
    fig.style.transform = `translate(${parX(FIG_DEPTH)}px, ${parY(FIG_DEPTH)}px)`;
    if (notesFx) notesFx.render(stage, T, mode === 'cursor' ? 0.4 + 0.6 * glow : 1, parX(NOTE_DEPTH), parY(NOTE_DEPTH), mode === 'scroll');
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------------ background: depth + vortex
export async function createBackground(canvas, { plate: plateSrc = '../assets/plate-sheets.jpg', assets = '../assets/', zoom = ZOOM } = {}) {
  const gl = canvas.getContext('webgl', { antialias: false });
  const vs = `attribute vec2 p; varying vec2 uv;
void main(){ uv = vec2(p.x*.5+.5, .5-p.y*.5); gl_Position = vec4(p,0.,1.); }`;
  const fs = `precision mediump float;
varying vec2 uv; uniform sampler2D img, dep, msk; uniform vec2 mouse, res, center; uniform float aspect, twist, spin, rad;
vec2 swirl(vec2 st, float a){
  vec2 q = (st-center)*vec2(aspect,1.);
  float f = exp(-dot(q,q)/(rad*rad));
  float an = -a*f; float c = cos(an), s = sin(an);
  q = mat2(c,s,-s,c)*q;
  return center + q/vec2(aspect,1.);
}
void main(){
  float sa = res.x/res.y;
  vec2 st = (uv-.5)*vec2(sa/aspect,1.)*${zoom.toFixed(4)}+.5;
  vec2 amt = mouse*vec2(.028,.02);
  float d = texture2D(dep, st).r; vec2 off = amt*(d-.42);
  d = texture2D(dep, st+off).r; off = amt*(d-.42);
  vec2 p = st+off;
  float m = texture2D(msk, p).r;
  // three taps along the recent rotation: a watery motion smear while it is spinning
  vec4 col = texture2D(img, swirl(p, twist*m))*.5
           + texture2D(img, swirl(p, (twist-spin*2.)*m))*.3
           + texture2D(img, swirl(p, (twist-spin*4.)*m))*.2;
  float inX = smoothstep(0., .01, st.x) * smoothstep(1., .99, st.x);
  gl_FragColor = mix(vec4(.984,.976,.957,1.), col, inX);
}`;
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o);
    if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw gl.getShaderInfoLog(o); return o; };
  const program = gl.createProgram();
  gl.attachShader(program, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(program, sh(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(program); gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const U = n => gl.getUniformLocation(program, n);
  const tex = (unit, src) => new Promise(res => { const im = new Image(); im.onload = () => {
    gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); res(im); }; im.src = src; });
  const [plate] = await Promise.all([
    tex(0, plateSrc), tex(1, assets + 'depth.jpg'), tex(2, assets + 'whirl-mask.jpg')]);
  gl.uniform1i(U('img'), 0); gl.uniform1i(U('dep'), 1); gl.uniform1i(U('msk'), 2);
  gl.uniform1f(U('aspect'), plate.width / plate.height);
  gl.uniform2f(U('center'), CENTER[0] / 3520, CENTER[1] / 2352);
  gl.uniform1f(U('rad'), 0.65);
  function resize() {
    const dpr = Math.min(devicePixelRatio, 2);
    canvas.width = canvas.clientWidth * dpr; canvas.height = canvas.clientHeight * dpr;
    gl.viewport(0, 0, canvas.width, canvas.height); gl.uniform2f(U('res'), canvas.width, canvas.height);
  }
  addEventListener('resize', resize); resize();
  return {
    render(mx, my, twist, spin) {
      gl.uniform2f(U('mouse'), mx, my); gl.uniform1f(U('twist'), twist); gl.uniform1f(U('spin'), spin);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
  };
}

// ------------------------------------------------------------------ notes: ink sprites on a spiral
function rng(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }

function sprite(kind, rand) {
  const c = document.createElement('canvas'); c.width = 160; c.height = 160;
  const g = c.getContext('2d'); const ink = '#1d1b1a';
  g.lineCap = 'round'; g.strokeStyle = ink; g.fillStyle = ink;
  const head = (x, y) => { g.save(); g.translate(x, y); g.rotate(-0.4); g.beginPath(); g.ellipse(0, 0, 13, 9, 0, 0, 7); g.fill(); g.restore(); };
  const stem = (x, y, h) => { g.lineWidth = 3.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 1.5, y - h); g.stroke(); };
  if (kind === 'quarter' || kind === 'eighth') {
    head(70, 115); stem(81, 110, 70);
    if (kind === 'eighth') { g.lineWidth = 4; g.beginPath(); g.moveTo(83, 42); g.bezierCurveTo(100, 60, 112, 70, 100, 98); g.stroke(); }
  } else if (kind === 'beam') {
    head(45, 118); head(105, 108); stem(56, 113, 66); stem(116, 103, 62);
    g.lineWidth = 9; g.beginPath(); g.moveTo(57, 48); g.lineTo(118, 40); g.stroke();
  } else if (kind === 'staff') {
    g.lineWidth = 1.6;
    const wob = rand() * 6;
    for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(8, 55 + i * 11); g.bezierCurveTo(50, 45 + i * 11 + wob, 100, 68 + i * 11 - wob, 152, 55 + i * 11); g.stroke(); }
    head(52, 89); stem(63, 84, 50); head(108, 72); stem(119, 67, 46);
  } else {                                   // watercolor dab
    const col = kind === 'red' ? [226, 64, 47] : [74, 166, 232];
    for (let i = 0; i < 7; i++) {
      const x = 80 + (rand() - 0.5) * 30, y = 80 + (rand() - 0.5) * 16, r = 12 + rand() * 16;
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, r);
      gr.addColorStop(0, `rgba(${col},.45)`); gr.addColorStop(0.7, `rgba(${col},.3)`); gr.addColorStop(1, `rgba(${col},0)`);
      g.save(); g.translate(x, y); g.rotate((rand() - 0.5) * 0.3); g.scale(2.2, 0.55);   // a brush streak, not a dot
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill(); g.restore();
    }
  }
  return c;
}

export function createNotes(back, front) {
  const rand = rng(7);
  const kinds = ['quarter', 'eighth', 'beam', 'staff', 'eighth', 'quarter', 'red', 'blue', 'red', 'blue'];
  const N = 90;
  const parts = Array.from({ length: N }, (_, i) => {
    const kind = kinds[Math.floor(rand() * kinds.length)];
    const hand = HANDS[i % 2];
    const dx = hand[0] - ORBIT.x, dy = (hand[1] - ORBIT.y) / ORBIT.ky;
    return {
      kind, img: sprite(kind, rand), phase: i / N, dab: kind === 'red' || kind === 'blue',
      th0: Math.atan2(dy, dx), r0: Math.hypot(dx, dy) * 0.9,
      turns: 0.8 + rand() * 0.6, grow: 600 + rand() * 900, lift: 200 + rand() * 600,
      size: kind === 'staff' ? 300 + rand() * 120 : (kind === 'red' || kind === 'blue') ? 320 + rand() * 220 : 150 + rand() * 90,
      spinR: (rand() - 0.5) * 3, jitter: (rand() - 0.5) * 0.5,
    };
  });
  const ctxs = [back.getContext('2d'), front.getContext('2d')];
  function resize() {
    const dpr = Math.min(devicePixelRatio, 2);
    for (const cv of [back, front]) { cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; cv.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0); }
  }
  addEventListener('resize', resize); resize();
  const P = 7;   // T units per lifetime

  return {
    render(stage, T, alpha, ox, oy, gated) {
      for (const g of ctxs) g.clearRect(0, 0, innerWidth, innerHeight);
      const r = stage.getBoundingClientRect(), k = r.width / 3520;
      for (const q of parts) {
        let age = ((T / P - q.phase) % 1 + 1) % 1;
        // In scroll mode notes only exist once they have been "emitted" since the top of the page.
        if (gated && T / P < q.phase) continue;
        const th = q.th0 + q.jitter * age + age * Math.PI * 2 * q.turns;
        const R = q.r0 + age * q.grow;
        const x = ORBIT.x + R * Math.cos(th);
        const y = ORBIT.y + R * ORBIT.ky * Math.sin(th) - age * q.lift;
        const depth = Math.sin(th);
        const fade = clamp(age / 0.05, 0, 1) * clamp((1 - age) / 0.3, 0, 1);
        const a = fade * alpha * (q.dab ? 0.75 : 0.95);
        if (a < 0.01) continue;
        const g = ctxs[(age < 0.08 || depth > 0) ? 1 : 0];
        const s = q.size * k * (0.85 + 0.25 * depth) / 160;
        g.save();
        g.globalAlpha = a;
        g.globalCompositeOperation = q.dab ? 'multiply' : 'source-over';
        g.translate(r.left + x * k + ox, r.top + y * k + oy);
        // dabs stretch along the direction of travel; notes tumble a little
        g.rotate(q.dab ? Math.atan2(ORBIT.ky * Math.cos(th), -Math.sin(th)) : th * 0.3 + q.spinR * age);
        g.scale(s, s);
        g.drawImage(q.img, -80, -80);
        g.restore();
      }
    },
  };
}
