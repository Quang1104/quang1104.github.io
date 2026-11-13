'use strict';

// Native dialogs keep keyboard focus within the player and restore it on close.
const dialog = document.querySelector('#video-dialog');
const video = document.querySelector('#project-video');
const videoTitle = document.querySelector('#video-title');
const download = document.querySelector('#video-download');
const error = document.querySelector('#video-error');
const demos = {
  nhom14: { title: 'Nhóm 14 Workspace', src: 'assets/nhom14-demo.mp4', poster: 'assets/nhom14-dashboard.webp' },
  pointsnap: { title: 'PointSnap 3D', src: 'assets/pointsnap-demo.mp4', poster: 'assets/pointsnap-frame.jpg' },
  mentorprep: { title: 'MentorPrep', src: 'assets/mentorprep-demo.mp4', poster: 'assets/mentorprep-frame.jpg' },
};
document.querySelectorAll('[data-video]').forEach(button => {
  button.addEventListener('click', () => {
    const demo = demos[button.dataset.video];
    videoTitle.textContent = demo.title;
    video.src = demo.src;
    video.poster = demo.poster;
    download.href = demo.src;
    error.hidden = true;
    dialog.showModal();
    document.body.classList.add('modal-open');
    video.play().catch(() => { /* Native controls remain available if autoplay is declined. */ });
  });
});
document.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const box = dialog.getBoundingClientRect();
  if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
});
dialog.addEventListener('close', () => { video.pause(); video.removeAttribute('src'); video.load(); document.body.classList.remove('modal-open'); });
video.addEventListener('error', () => { if (video.getAttribute('src')) error.hidden = false; });
document.querySelectorAll('[data-expand]').forEach(link => link.addEventListener('click', () => { document.getElementById(link.dataset.expand).open = true; }));

// A geometric study, not a visualization of experimental data.
const canvas = document.querySelector('#sphere');
const ctx = canvas.getContext('2d');
const motion = document.querySelector('#motion-toggle');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let paused = reducedMotion.matches;
let visible = true;
let angle = 0.45;
let tilt = -0.22;
let width = 0;
let height = 0;
let dragging = false;
let lastX = 0;
let raf = 0;
let lastTime = 0;
const points = [];
const rings = [];
for (let row = 1; row < 24; row++) {
  const phi = Math.PI * row / 24;
  const ring = [];
  const count = 60;
  for (let col = 0; col < count; col++) {
    const theta = Math.PI * 2 * col / count;
    const point = { x: Math.sin(phi) * Math.cos(theta), y: Math.cos(phi), z: Math.sin(phi) * Math.sin(theta), row, col };
    points.push(point); ring.push(point);
  }
  rings.push(ring);
}
function project(p) {
  const x = p.x * Math.cos(angle) + p.z * Math.sin(angle);
  const depth = -p.x * Math.sin(angle) + p.z * Math.cos(angle);
  const y = p.y * Math.cos(tilt) - depth * Math.sin(tilt);
  const z = p.y * Math.sin(tilt) + depth * Math.cos(tilt);
  const radius = Math.min(width * .37, height * .35);
  return { x: width / 2 + x * radius, y: height / 2 + y * radius, z };
}
function draw() {
  if (!ctx) return;
  ctx.clearRect(0, 0, width, height);
  ctx.lineWidth = .5;
  rings.forEach((ring, index) => {
    if (index % 3 !== 0) return;
    ctx.beginPath();
    ring.forEach((p, i) => { const q = project(p); if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y); });
    ctx.closePath(); ctx.strokeStyle = 'rgba(26,128,108,.15)'; ctx.stroke();
  });
  const projected = points.map(p => ({ ...project(p), col: p.col, row: p.row })).sort((a, b) => a.z - b.z);
  projected.forEach(p => {
    const opacity = .16 + (p.z + 1) * .36;
    ctx.fillStyle = p.col > 34 ? `rgba(32,88,218,${opacity})` : `rgba(21,145,109,${opacity})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, .55 + (p.z + 1) * .50, 0, Math.PI * 2); ctx.fill();
  });
}
function frame(time) {
  raf = 0;
  if (paused || !visible || document.hidden) return;
  const delta = lastTime ? Math.min(time - lastTime, 50) : 16;
  lastTime = time;
  if (!dragging) angle += delta * .000075;
  draw(); raf = requestAnimationFrame(frame);
}
function restart() { if (!paused && visible && !document.hidden && !raf) { lastTime = 0; raf = requestAnimationFrame(frame); } }
function updateMotion() { motion.textContent = paused ? '▶' : 'Ⅱ'; motion.setAttribute('aria-pressed', String(paused)); motion.setAttribute('aria-label', paused ? 'Play sphere animation' : 'Pause sphere animation'); restart(); }
motion.addEventListener('click', () => { paused = !paused; updateMotion(); });
reducedMotion.addEventListener('change', event => { paused = event.matches; updateMotion(); });
const resize = new ResizeObserver(() => {
  width = canvas.clientWidth; height = canvas.clientHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
});
resize.observe(canvas);
canvas.addEventListener('pointerdown', e => { dragging = true; lastX = e.clientX; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', e => { if (!dragging) return; angle += (e.clientX - lastX) * .007; lastX = e.clientX; draw(); });
canvas.addEventListener('pointerup', () => { dragging = false; });
canvas.addEventListener('pointercancel', () => { dragging = false; });
new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; restart(); }).observe(canvas);
document.addEventListener('visibilitychange', restart);
updateMotion();

const navigation = [...document.querySelectorAll('nav a')];
const sectionObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    navigation.forEach(link => {
      const active = link.getAttribute('href') === '#' + entry.target.id;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
    });
  });
}, { rootMargin: '-10% 0px -65% 0px' });
document.querySelectorAll('#home, #journey, #work, #toolkit, #contact').forEach(section => sectionObserver.observe(section));

// Animate sections once as they enter; content remains visible without JavaScript.
const editorialObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {if(entry.isIntersecting){entry.target.classList.add('editorial-reveal');editorialObserver.unobserve(entry.target);}});
},{threshold:.12});
document.querySelectorAll('.journey-row, .featured-project, .project, .workspace-project, .research-card, .side-build, .toolkit-list').forEach(el=>editorialObserver.observe(el));
