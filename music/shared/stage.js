// Shared helpers for the Figaro hero prototypes.
// All layer boxes are in the source image's pixel space (3520 x 2352).

export const BASE = { w: 3520, h: 2352 };

export const BOX = {
  figaro:        [1061, 845, 2592, 2352],
  'figaro-body': [1143, 1119, 2592, 2352],
  'figaro-arm':  [1061, 845, 1449, 1458],
  'sheet-a':     [124, 39, 847, 407],
  'sheet-b':     [2694, 52, 2967, 382],
  'sheet-c':     [2806, 844, 3247, 1177],
  'sheet-e':     [524, 1219, 852, 1567],
  'sheet-f':     [954, 1454, 1217, 1717],
};

export const SHEETS = ['sheet-a', 'sheet-b', 'sheet-c', 'sheet-e', 'sheet-f'];

export const BRIEFING = {
  'sheet-a': { when: 'Today · Leo',     what: 'Soccer moved to 5:30, Field 3', src: "From the coach's group chat" },
  'sheet-b': { when: 'Thursday · Mia',  what: 'Field-trip form due. Sign it tonight.', src: "From Ms. Park's email" },
  'sheet-c': { when: 'Friday',          what: 'Pizza day: send $4 in cash',     src: 'From the school newsletter' },
  'sheet-e': { when: 'Next Tue · Leo',  what: "Dentist 8:15, so he'll be late for school", src: 'From your calendar' },
  'sheet-f': { when: 'Saturday · Mia',  what: "Ava's birthday party. Gift still needed.", src: 'From the class WhatsApp' },
};

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;

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

export function img(src, cls = 'layer') {
  const i = new Image();
  i.src = src;
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

/**
 * Pointer state: normalized -1..1 (smoothed via update()), raw px, velocity.
 * Falls back to device tilt on phones.
 */
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
