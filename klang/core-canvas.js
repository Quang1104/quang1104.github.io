// JARVIS-style core: particle sphere, radiating rays and HUD rings on one 2D canvas.
const TAU = Math.PI * 2;
const STATE_COLORS = { listening: [56, 225, 255], thinking: [255, 176, 32], speaking: [255, 236, 205], error: [255, 59, 59] };
const ALERT = [255, 122, 26];
const STATES = ['idle', 'offline', 'booting', 'listening', 'thinking', 'speaking', 'error'];
const mix = (a, b, f) => a.map((v, i) => v + (b[i] - v) * f);
// Particles + core take 75% of the state colour; rings and aura keep 60% of the tab hue.
export function tint(state, tab) {
  if (state === 'idle') return { core: tab, ring: tab };
  if (state === 'offline' || state === 'booting') return { core: ALERT, ring: ALERT };
  if (state === 'error') return { core: STATE_COLORS.error, ring: STATE_COLORS.error };
  const colour = STATE_COLORS[state];
  return { core: mix(tab, colour, .75), ring: mix(colour, tab, .6) };
}
const ease = (x) => (x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x));
const clamp01 = (x) => Math.max(0, Math.min(1, x));

export const RING = 96;
// Fills out[RING] with band energies (9 values, 0..1) mirrored left/right and cosine-interpolated; index 0 is the top.
export function ringTargets(bands, out) {
  const last = bands.length - 1;
  for (let i = 0; i < RING; i++) {
    const p = i / RING, m = (p <= .5 ? p : 1 - p) * 2 * last, lo = Math.min(last - 1, Math.floor(m));
    const f = (1 - Math.cos((m - lo) * Math.PI)) / 2;
    out[i] = bands[lo] + (bands[lo + 1] - bands[lo]) * f;
  }
  return out;
}
const rand = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646; })();

export function createCore(canvas, reduced) {
  const ctx = canvas.getContext('2d');
  const small = innerWidth < 700;
  const N = small ? 1100 : 2400;
  const pts = new Float32Array(N * 3); // unit sphere
  const scatter = new Float32Array(N * 3); // boot start positions
  const seed = new Float32Array(N);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (i + .5) * 2 / N, r = Math.sqrt(1 - y * y), a = i * golden;
    const k = .96 + rand() * .08; // break up the Fibonacci lattice
    pts.set([Math.cos(a) * r * k + (rand() - .5) * .025, y * k + (rand() - .5) * .025, Math.sin(a) * r * k + (rand() - .5) * .025], i * 3);
    const d = 1.4 + rand() * 1.6, t = rand() * TAU, v = rand() * 2 - 1, q = Math.sqrt(1 - v * v);
    scatter.set([Math.cos(t) * q * d, v * d, Math.sin(t) * q * d], i * 3);
    seed[i] = rand();
  }
  const rays = Array.from({ length: 48 }, (_, i) => ({ a: (i / 48) * TAU + rand() * .05, p: rand() * TAU, s: .6 + rand() * 1.6, w: .6 + rand() * .9 }));

  let state = 'idle', level = 0, lent = new Float32Array(9), hasBands = false, ringAlpha = 0, shown = 0, boot = 1, t = 0, spin = 0, pulse = 0, errorTimer = 0;
  const bandNow = new Float32Array(9), ringGoal = new Float32Array(RING), ring = new Float32Array(RING);
  let tab = [56, 225, 255];
  const first = tint('idle', tab);
  const color = [...first.core, ...first.ring], from = [...color];
  let to = [...color], colorAt = -1e9, rgb = '', solid = '', ringRgb = '', ringSolid = '', haze = null, hot = null, gradSize = 0;
  let size = 0, dpr = 1, visible = true, raf = 0, last = 0, bootDone = null, bootStart = 0;
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = 64;
  let spriteKey = '';

  function makeSprite(rgb) {
    if (rgb === spriteKey) return;
    spriteKey = rgb;
    const g = sprite.getContext('2d');
    g.clearRect(0, 0, 64, 64);
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(.18, `rgba(${rgb},.95)`);
    grad.addColorStop(.5, `rgba(${rgb},.22)`);
    grad.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
  }

  function frame(dt) {
    if (!size) return;
    t += dt;
    const calm = reduced.matches;
    const k = ease((performance.now() - colorAt) / 600);
    for (let i = 0; i < 6; i++) color[i] = from[i] + (to[i] - from[i]) * k;
    const key = color.slice(0, 3).map(Math.round).join(',');
    const ringKey = color.slice(3).map(Math.round).join(',');
    if (key !== rgb || ringKey !== ringRgb || !haze || gradSize !== size) { // rebuild cached strings and gradients only on change
      rgb = key;
      ringRgb = ringKey;
      solid = 'rgb(' + key + ')';
      ringSolid = 'rgb(' + ringKey + ')';
      gradSize = size;
      makeSprite(rgb);
      const cc = size / 2, RR = cc * .96 * .56;
      haze = ctx.createRadialGradient(cc, cc, 0, cc, cc, RR * 1.7);
      haze.addColorStop(0, `rgba(${ringRgb},.5)`);
      haze.addColorStop(.45, `rgba(${ringRgb},.147)`);
      haze.addColorStop(1, `rgba(${ringRgb},0)`);
      hot = ctx.createRadialGradient(cc, cc, 0, cc, cc, RR * .62);
      hot.addColorStop(0, 'rgba(255,255,255,1)');
      hot.addColorStop(.35, 'rgba(255,250,235,.58)');
      hot.addColorStop(1, `rgba(${rgb},0)`);
    }
    shown = calm ? level : shown + (level - shown) * (1 - Math.exp(-dt * 12));
    const thinking = state === 'thinking';
    const offline = state === 'offline';
    const lv = offline ? 0 : Math.max(shown, thinking ? .16 + .1 * Math.sin(t * 5) : 0);
    spin += dt * (thinking ? 2.6 : state === 'listening' ? 1.3 : 1);
    pulse = (pulse + dt * .7) % 1;
    const s = calm ? 0 : spin, b = ease(boot), dim = offline ? .4 : 1;
    const c = size / 2, u = c * .96, R = u * .56;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, size, size);
    ctx.globalCompositeOperation = 'lighter';

    ctx.globalAlpha = clamp01((.34 + lv * .3) / .5 * b * dim);
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, size, size);

    const ay = calm ? .6 : s * .16 + Math.sin(t * .31) * .12, cy = Math.cos(ay), sy = Math.sin(ay);
    const ct = Math.cos(.38), st = Math.sin(.38);
    const px = Math.max(1.4, u * .0062) * (small ? 1.6 : 1);
    const breathe = 1 + lv * .07;
    for (let i = 0; i < N; i++) {
      const j = i * 3, sd = seed[i];
      const wob = (1 + (calm ? 0 : Math.sin(t * .9 + sd * 40) * .025) + (sd - .5) * .05) * breathe * b;
      const x0 = pts[j] * wob + scatter[j] * (1 - b);
      const y0 = pts[j + 1] * wob + scatter[j + 1] * (1 - b);
      const z0 = pts[j + 2] * wob + scatter[j + 2] * (1 - b);
      const x1 = x0 * cy + z0 * sy, z1 = -x0 * sy + z0 * cy;
      const y2 = y0 * ct - z1 * st, z2 = y0 * st + z1 * ct;
      const d = clamp01((z2 + 1.2) / 2.4);
      const persp = 1 / (1.9 - z2 * .55);
      const w = px * (1.2 + d * 2.1 + sd * .9) * persp * 1.9;
      ctx.globalAlpha = (.08 + d * d * .85) * dim * Math.min(1, b * 1.5);
      ctx.drawImage(sprite, c + x1 * R * persp * 1.9 - w / 2, c + y2 * R * persp * 1.9 - w / 2, w, w);
    }
    ctx.globalAlpha = 1;

    // Voice ring: bands from the caller, else synthesised from the level so it still breathes.
    for (let i = 0; i < 9; i++) bandNow[i] = hasBands ? lent[i] : lv * (.6 + .4 * Math.sin(i * 1.7 + (calm ? 0 : t * 3)));
    ringTargets(bandNow, ringGoal);
    const decay = 1 - Math.pow(.88, dt * 60), rise = 1 - Math.pow(.55, dt * 60);
    for (let i = 0; i < RING; i++) ring[i] += (ringGoal[i] - ring[i]) * (calm ? 1 : ringGoal[i] > ring[i] ? rise : decay);
    ringAlpha = clamp01(.15 + lv * .65) * b * dim;
    if (ringAlpha > .01) {
      const base = u * .68, cap = u * .95;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = ringSolid;
      ctx.lineWidth = 1.75 * dpr;
      ctx.beginPath();
      for (let i = 0; i <= RING; i++) {
        const k = i % RING, a = k * TAU / RING - Math.PI / 2, r = Math.min(cap, base * (1 + .35 * ring[k]));
        if (i) ctx.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
        else ctx.moveTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.globalAlpha = ringAlpha * .35;
      ctx.lineWidth = 4.5 * dpr;
      ctx.stroke();
      ctx.globalAlpha = ringAlpha;
      ctx.lineWidth = 1.75 * dpr;
      ctx.stroke();
    }

    ctx.lineCap = 'round';
    if (b > .4 && !offline) {
      const fade = clamp01((b - .4) / .5);
      ctx.lineWidth = Math.max(1, u * .0045) * (1 + lv);
      const r0 = R * 1.04;
      // three batched segments (bright root to faint tip) replace one gradient per ray
      const tiers = [[0, .3, 'rgb(255,255,255)', .75], [.3, .65, ringSolid, .55], [.65, 1, ringSolid, .22]];
      for (const [t0, t1, style, alpha] of tiers) {
        ctx.strokeStyle = style;
        ctx.globalAlpha = alpha * dim * (1 - .3 * clamp01(lv * 1.5));
        ctx.beginPath();
        for (const r of rays) {
          const wave = calm ? .6 : .5 + .5 * Math.sin(t * r.s * 2.2 + r.p);
          const len = Math.min(u * .99 - r0, lv * R * .9 * (.35 + wave * .9) + R * (.12 + .1 * wave)) * fade;
          const a = r.a + s * .015, cx = Math.cos(a), sn = Math.sin(a);
          ctx.moveTo(c + cx * (r0 + len * t0), c + sn * (r0 + len * t0));
          ctx.lineTo(c + cx * (r0 + len * t1), c + sn * (r0 + len * t1));
        }
        ctx.stroke();
      }
    }

    const grow = 1 + lv * .25;
    ctx.globalAlpha = clamp01(b * .95);
    ctx.setTransform(grow, 0, 0, grow, c * (1 - grow), c * (1 - grow));
    ctx.fillStyle = hot;
    ctx.fillRect(0, 0, size, size);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    hud(c, u, R, rgb, s, b, dim);
  }

  function arc(c, r, start, sweep, width, alpha, rgb) {
    if (sweep <= 0) return;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.arc(c, c, r, start, start + sweep);
    ctx.stroke();
  }

  function hud(c, u, R, rgb, s, b, dim) {
    const px = Math.max(1, u * .0035);
    const f = (i) => ease((b - i * .1) / .6);
    const spd = state === 'thinking' ? 2.6 : 1;
    ctx.lineCap = 'butt';
    ctx.strokeStyle = ringSolid;
    const f1 = f(0), r1 = u * .97, rot1 = s * .03 - Math.PI / 2;
    arc(c, r1, rot1, TAU * f1, px, .3 * dim, rgb);
    for (const major of [false, true]) {
      ctx.globalAlpha = (major ? .65 : .3) * dim;
      ctx.lineWidth = major ? px * 1.4 : px;
      ctx.beginPath();
      for (let i = 0, n = Math.floor(60 * f1); i < n; i++) {
        if ((i % 5 === 0) !== major) continue;
        const a = rot1 + i * TAU / 60, len = u * (major ? .045 : .02);
        ctx.moveTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1);
        ctx.lineTo(c + Math.cos(a) * (r1 - len), c + Math.sin(a) * (r1 - len));
      }
      ctx.stroke();
    }
    for (let i = 0; i < 3; i++) arc(c, u * .9, s * .15 * spd + i * TAU / 3, TAU / 3 * .62 * f(1), px * 3, .6 * dim, rgb);
    const f3 = f(2);
    for (let i = 0; i < 5; i++) arc(c, u * .8, -s * .1 * spd + i * TAU / 5, TAU / 5 * .55 * f3, px * 1.6, .5 * dim, rgb);
    arc(c, u * .8, 0, TAU * f3, px * .7, .16 * dim, rgb);
    const f4 = f(3);
    arc(c, u * .68, s * .2 * spd, TAU * .22 * f4, px * 2.2, .75 * dim, rgb);
    arc(c, u * .68, s * .2 * spd + Math.PI, TAU * .12 * f4, px * 2.2, .5 * dim, rgb);
    arc(c, u * .68, 0, TAU * f4, px * .6, .14 * dim, rgb);
    if (state === 'listening') {
      const p = reduced.matches ? .5 : pulse;
      arc(c, R + (u * .97 - R) * p, 0, TAU, px * 1.4, (1 - p) * .55, rgb);
    }
    if (b > .6) {
      ctx.globalAlpha = .8 * dim * clamp01((b - .6) / .4);
      ctx.fillStyle = ringSolid;
      ctx.font = `${Math.max(8, Math.round(u * .062))}px "IBM Plex Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.letterSpacing = `${Math.round(u * .03)}px`;
      ctx.fillText('KLANG', c + u * .015, c + u * .745);
    }
  }

  const loopOn = () => !reduced.matches && visible && !document.hidden;
  function resize() {
    dpr = Math.min(2, devicePixelRatio || 1);
    size = Math.max(1, Math.round(canvas.offsetWidth * dpr));
    canvas.width = canvas.height = size;
    if (!loopOn()) frame(0);
  }
  function tick(ts) {
    raf = 0;
    if (!loopOn()) return;
    const dt = Math.min(.05, (ts - last) / 1000 || 0);
    last = ts;
    if (bootDone) {
      boot = clamp01((ts - bootStart) / 1600);
      if (boot > .62 && state === 'booting') setState('idle');
      if (boot >= 1) { bootDone(); bootDone = null; }
    }
    frame(dt);
    raf = requestAnimationFrame(tick);
  }
  function sync() {
    if (loopOn()) {
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
    } else {
      cancelAnimationFrame(raf);
      raf = 0;
      frame(0);
    }
    canvas.dataset.loop = raf ? '1' : '0';
  }
  function retarget() {
    from.splice(0, 6, ...color);
    const next = tint(state, tab);
    to = [...next.core, ...next.ring];
    colorAt = loopOn() ? performance.now() : -1e9; // no easing without a loop
  }
  function setTint(rgb) { tab = rgb; retarget(); sync(); }
  function setState(next) {
    if (!STATES.includes(next) || (next === state && next !== 'error')) return;
    state = next;
    retarget();
    clearTimeout(errorTimer);
    if (next === 'error') errorTimer = setTimeout(() => setState('idle'), 1200);
    sync();
  }
  function setLevel(v, bands) {
    level = clamp01(v || 0);
    hasBands = bands?.length >= 9;
    if (hasBands) for (let i = 0; i < 9; i++) lent[i] = clamp01(bands[i] || 0);
    if (!loopOn()) frame(0);
  }
  function runBoot() {
    if (reduced.matches) { boot = 1; setState('idle'); return Promise.resolve(); }
    boot = 0;
    setState('booting');
    bootStart = performance.now();
    return new Promise((resolve) => { bootDone = resolve; sync(); });
  }

  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }).observe(canvas);
  document.addEventListener('visibilitychange', sync);
  reduced.addEventListener('change', () => {
    if (reduced.matches && bootDone) { boot = 1; bootDone(); bootDone = null; }
    sync();
  });
  resize();
  sync();
  return { setState, setTint, setLevel, boot: runBoot, get state() { return state; } };
}
