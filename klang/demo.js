import { createCore } from './core-canvas.js';

const stage = document.querySelector('.klang-stage');
const stateLabel = document.querySelector('#stage-state');
const timer = document.querySelector('#timer');
const timerLabel = document.querySelector('#timer-label');
const reply = document.querySelector('#demo-reply');
const focusButton = document.querySelector('#focus-button');
const resetButton = document.querySelector('#reset-button');
const musicButton = document.querySelector('#music-button');
const newsButton = document.querySelector('#news-button');
const form = document.querySelector('#demo-command');
const input = document.querySelector('#command-text');
const music = document.querySelector('#klang-music');

const core = createCore(document.querySelector('#klang-core'), matchMedia('(prefers-reduced-motion: reduce)'));
const duration = 25 * 60 * 1000;
let remaining = duration;
let deadline = null;
let tickId;

function say(text) {
  reply.textContent = text;
}

function setMode(mode, label, tint) {
  stage.dataset.mode = mode;
  stateLabel.textContent = label;
  core.setTint(tint);
}

function renderTime() {
  const seconds = Math.ceil(remaining / 1000);
  const minutesLabel = String(Math.floor(seconds / 60)).padStart(2, '0');
  const secondsLabel = String(seconds % 60).padStart(2, '0');
  const time = minutesLabel + ':' + secondsLabel;
  if (timer.textContent !== time) timer.textContent = time;
}

function stopTick() {
  clearInterval(tickId);
  deadline = null;
}

function tick() {
  if (deadline === null) return;
  remaining = Math.max(0, deadline - Date.now());
  renderTime();
  if (remaining > 0) return;
  stopTick();
  focusButton.textContent = 'Start focus';
  timerLabel.textContent = 'Session complete';
  setMode('idle', 'Complete', [71, 224, 181]);
  say('Your focus session is complete. Time for a break.');
}

function startFocus() {
  if (deadline !== null) return say('Your focus session is already running.');
  if (remaining === 0) remaining = duration;
  const isNew = remaining === duration;
  deadline = Date.now() + remaining;
  tickId = setInterval(tick, 250);
  tick();
  focusButton.textContent = 'Pause focus';
  resetButton.disabled = false;
  timerLabel.textContent = 'Time remaining';
  setMode('focus', 'Focusing', [122, 233, 157]);
  say(isNew ? 'Your 25-minute session is running. Take it one task at a time.' : 'Your focus session has resumed.');
}

function pauseFocus() {
  if (deadline === null) return say('There is no running focus session.');
  tick();
  if (deadline === null) return;
  stopTick();
  focusButton.textContent = 'Resume focus';
  timerLabel.textContent = 'Paused';
  setMode('paused', 'Paused', [224, 183, 117]);
  say('Focus paused. Resume whenever you’re ready.');
}

function resetFocus() {
  stopTick();
  remaining = duration;
  renderTime();
  focusButton.textContent = 'Start focus';
  resetButton.disabled = true;
  timerLabel.textContent = 'Focus timer';
  setMode('idle', 'Ready', [71, 224, 181]);
  say('The focus timer is back to 25 minutes.');
}

function updateMusic() {
  musicButton.textContent = music.paused ? 'Play piano' : 'Pause piano';
  musicButton.setAttribute('aria-pressed', String(!music.paused));
}

function playMusic() {
  music.play().then(() => say('Rain Keys is playing. You can pause it anytime.')).catch((error) => {
    if (error.name !== 'AbortError') say('Piano playback is unavailable. Try the Play piano button again.');
  });
}

function pauseMusic() {
  music.pause();
  say('Piano paused.');
}

function showBriefing() {
  say('For this sample briefing, Hanoi may see showers. On the AI desk, a research team is testing smaller models for on-device transcription. These are demo headlines.');
}

const commands = [
  [startFocus, ['start focus', 'resume focus', 'start pomodoro', 'bat dau tap trung', 'bat dau pomodoro', 'tiep tuc tap trung']],
  [pauseFocus, ['pause focus', 'tam dung tap trung', 'tam dung pomodoro']],
  [resetFocus, ['reset timer', 'reset focus', 'dat lai bo dem', 'dat lai pomodoro']],
  [playMusic, ['play piano', 'play music', 'bat nhac', 'bat piano', 'mo nhac']],
  [pauseMusic, ['pause piano', 'pause music', 'tat nhac', 'dung nhac', 'tam dung nhac']],
  [showBriefing, ['sample briefing', 'show briefing', 'doc ban tin', 'mo ban tin', 'ban tin']],
];
const actions = new Map(commands.flatMap(([action, phrases]) => phrases.map((phrase) => [phrase, action])));

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const command = input.value.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replaceAll('đ', 'd')
    .replace(/[^a-z0-9 ]+/g, ' ').trim().replace(/\s+/g, ' ');
  const action = actions.get(command);
  if (!action) return say('Try “start focus”, “bật nhạc”, or “sample briefing”.');
  action();
  input.value = '';
});

focusButton.addEventListener('click', () => deadline === null ? startFocus() : pauseFocus());
resetButton.addEventListener('click', resetFocus);
musicButton.addEventListener('click', () => music.paused ? playMusic() : pauseMusic());
newsButton.addEventListener('click', showBriefing);
music.addEventListener('play', updateMusic);
music.addEventListener('pause', updateMusic);
document.addEventListener('visibilitychange', tick);

music.volume = 0.45;
setMode('idle', 'Ready', [71, 224, 181]);
for (const control of [focusButton, musicButton, newsButton, input, form.querySelector('button')]) control.disabled = false;
