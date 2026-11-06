// Shared helpers for the Seville hero prototypes.
// All boxes are in the source image's pixel space (3520 x 2352), same size as the music hero.

export const BASE = { w: 3520, h: 2352 };
export const A = 'assets/';

export const BOX = {
  figaro:        [1307, 1258, 2139, 2256],
  'figaro-body': [1382, 1371, 2139, 2256],
  'figaro-arm':  [1307, 1258, 1654, 1628],
  dog:           [1964, 1931, 2319, 2259],
  'dog-body':    [2016, 1996, 2319, 2259],
  'dog-head':    [1964, 1931, 2098, 2049],
  'cloud-1': [2776, 34, 3040, 128],
  'cloud-2': [458, 94, 659, 161],
  'cloud-3': [670, 98, 1091, 218],
  'cloud-4': [2145, 252, 2766, 347],
  'cloud-5': [2728, 289, 2929, 368],
  'cloud-6': [1089, 495, 1499, 566],
  'bird-1': [2463, 110, 2528, 145],
  'bird-2': [2352, 159, 2414, 195],
  'bird-3': [2639, 675, 2691, 704],
  'bird-4': [2620, 750, 2663, 779],
};
export const CLOUDS = ['cloud-1', 'cloud-2', 'cloud-3', 'cloud-4', 'cloud-5', 'cloud-6'];
export const BIRDS = ['bird-1', 'bird-2', 'bird-3', 'bird-4'];

// Pivots (image space)
export const SHOULDER = { x: 1610, y: 1560 };   // Figaro's raised arm
export const SCISSORS = { x: 1335, y: 1295 };
export const NECK = { x: 2065, y: 2030 };        // the dog
export const NOSE = { x: 1966, y: 1940 };
export const PETAL_HAND = { x: 700, y: 760 };    // the woman throwing petals from the balcony

// Everyone in the plaza wants something from Figaro.
// `at` is roughly the speaker's head, in image space.
export const CALLERS = [
  { id: 'balcony',  at: [575, 640],   who: 'From the balcony', when: 'Thursday · Mia',  what: 'Field-trip form due. Sign it tonight.', src: "From Ms. Park's email" },
  { id: 'hat',      at: [330, 1495],  who: 'The man with the hat', when: 'Today · Leo',     what: 'Soccer moved to 5:30, Field 3', src: "From the coach's group chat" },
  { id: 'fan',      at: [665, 1630],  who: 'The lady with the fan', when: 'Saturday · Mia',  what: "Ava's birthday party. Gift still needed.", src: 'From the class WhatsApp' },
  { id: 'flamenco', at: [2585, 1490], who: 'The dancer', when: 'Next Tue · Leo',  what: "Dentist 8:15, so he'll be late for school", src: 'From your calendar' },
  { id: 'waiter',   at: [2925, 1690], who: 'The waiter', when: 'Friday',          what: 'Pizza day: send $4 in cash', src: 'From the school newsletter' },
  { id: 'guitar',   at: [2785, 2000], who: 'The guitarist', when: 'Wednesday · Leo', what: 'Bring the recorder for music class', src: 'From the school app' },
];

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = t => t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
export const seg = (p, a, b) => clamp((p - a) / (b - a), 0, 1);

/** Position an element inside a parent box (default: whole image), in %. */
export function place(el, key, parentKey) {
  const [x0, y0, x1, y1] = BOX[key];
  const [px0, py0, px1, py1] = parentKey ? BOX[parentKey] : [0, 0, BASE.w, BASE.h];
  const pw = px1 - px0, ph = py1 - py0;
  Object.assign(el.style, {
    position: 'absolute',
    left: ((x0 - px0) / pw) * 100 + '%',
    top: ((y0 - py0) / ph) * 100 + '%',
    width: ((x1 - x0) / pw) * 100 + '%',
    height: ((y1 - y0) / ph) * 100 + '%',
  });
  return el;
}

/** transform-origin for a point given in image space, relative to a box. */
export function originOf(key, pt) {
  const [x0, y0, x1, y1] = BOX[key];
  return `${(pt.x - x0) / (x1 - x0) * 100}% ${(pt.y - y0) / (y1 - y0) * 100}%`;
}

export function img(src, cls = 'layer') {
  const i = new Image();
  i.src = src.includes('/') ? src : A + src;
  i.className = cls;
  i.draggable = false;
  i.alt = '';
  return i;
}

/** Convert a point in image space to viewport px, using the stage's rect. */
export function toScreen(stage, x, y) {
  const r = stage.getBoundingClientRect();
  return { x: r.left + (x / BASE.w) * r.width, y: r.top + (y / BASE.h) * r.height, s: r.width / BASE.w };
}

/** Pointer: normalized -1..1 (smoothed via update()), raw px, velocity. Falls back to tilt on phones. */
export function pointer() {
  const p = { x: 0, y: 0, tx: 0, ty: 0, px: innerWidth / 2, py: innerHeight / 2, vx: 0, vy: 0, speed: 0, inside: false };
  addEventListener('pointermove', (e) => {
    p.tx = (e.clientX / innerWidth) * 2 - 1;
    p.ty = (e.clientY / innerHeight) * 2 - 1;
    p.vx = e.clientX - p.px;
    p.vy = e.clientY - p.py;
    p.px = e.clientX;
    p.py = e.clientY;
    p.inside = true;
  });
  document.documentElement.addEventListener('pointerleave', () => { p.inside = false; p.tx = 0; p.ty = 0; });
  addEventListener('deviceorientation', (e) => {
    if (e.gamma == null) return;
    p.tx = clamp(e.gamma / 25, -1, 1);
    p.ty = clamp((e.beta - 45) / 25, -1, 1);
  });
  addEventListener('pointerdown', () => {
    if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) {
      DeviceOrientationEvent.requestPermission().catch(() => {});
    }
  }, { once: true });
  p.update = (k = 0.08) => {
    p.x += (p.tx - p.x) * k;
    p.y += (p.ty - p.y) * k;
    p.speed = p.speed * 0.85 + Math.hypot(p.vx, p.vy) * 0.15;
    p.vx *= 0.6;
    p.vy *= 0.6;
  };
  return p;
}

export const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Red petals, like the ones thrown from the balcony. Draws into a full-viewport 2D canvas. */
export function petals(canvas) {
  const ctx = canvas.getContext('2d');
  const list = [];
  function resize() { const d = Math.min(devicePixelRatio, 2); canvas.width = innerWidth * d; canvas.height = innerHeight * d; ctx.setTransform(d, 0, 0, d, 0, 0); }
  addEventListener('resize', resize); resize();
  return {
    list,
    add(x, y, vx = 0, vy = 0, s = 1) {
      list.push({ x, y, vx, vy, r: (4 + Math.random() * 4) * s, a: Math.random() * 6, va: (Math.random() - .5) * .2, life: 1, ph: Math.random() * 6, shade: Math.random() });
    },
    draw(wind = 0) {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        p.vy += 0.04; p.vy *= 0.97; p.vx = p.vx * 0.97 + wind * 0.05;
        p.ph += 0.08;
        p.x += p.vx + Math.sin(p.ph) * 0.6; p.y += p.vy; p.a += p.va;
        p.life -= 0.004;
        if (p.life <= 0 || p.y > innerHeight + 20) { list.splice(i, 1); continue; }
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.scale(1, Math.abs(Math.sin(p.ph * .7)) * .6 + .4);
        ctx.globalAlpha = Math.min(1, p.life * 3);
        ctx.fillStyle = p.shade > .5 ? '#e2402f' : '#c9301f';
        // four-lobed blossom, like the painted ones
        for (let k = 0; k < 4; k++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.ellipse(p.r * .55, 0, p.r * .55, p.r * .38, 0, 0, 7); ctx.fill(); }
        ctx.restore();
      }
    },
  };
}
