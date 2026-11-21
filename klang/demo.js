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
const introButton = document.querySelector('#intro-button');
const introStatus = document.querySelector('#intro-status');
const voiceButton = document.querySelector('#voice-button');
const voiceHint = document.querySelector('#voice-hint');
const form = document.querySelector('#demo-command');
const input = document.querySelector('#command-text');
const music = document.querySelector('#klang-music');
const intro = document.querySelector('#klang-intro-audio');
const briefing = document.querySelector('#klang-briefing-audio');
const players = [music, intro, briefing];
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const core = createCore(document.querySelector('#klang-core'), matchMedia('(prefers-reduced-motion: reduce)'));
const duration = 25 * 60 * 1000;
let remaining = duration;
let deadline = null;
let tickId;
let timerState = 'Ready';
let recognition = null;
let listening = false;

function say(text) {
  reply.textContent = text;
}

function setMode(mode, label, tint) {
  stage.dataset.mode = mode;
  timerState = label;
  core.setTint(tint);
  syncOrb();
}

function syncOrb() {
  const speaking = [intro, briefing].some((audio) => !audio.paused && !audio.ended);
  const state = listening ? 'listening' : speaking ? 'speaking' : 'idle';
  core.setState(state);
  stage.dataset.voice = state;
  stateLabel.textContent = listening ? 'Listening' : speaking ? 'Speaking' : timerState;
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

function updateAudioControls() {
  musicButton.textContent = music.paused ? 'Play piano' : 'Pause piano';
  musicButton.setAttribute('aria-pressed', String(!music.paused));
  introButton.textContent = intro.paused || intro.ended ? 'Hear Klang in Vietnamese' : 'Pause introduction';
  newsButton.textContent = briefing.paused || briefing.ended ? 'Hear sample briefing' : 'Pause briefing';
  syncOrb();
}

function playExclusive(audio) {
  stopListening();
  for (const other of players) {
    if (other !== audio) other.pause();
  }
  if (audio.ended) audio.currentTime = 0;
  return audio.play();
}

function playMusic() {
  playExclusive(music).then(() => say('Rain Keys is playing. You can pause it anytime.')).catch((error) => {
    if (error.name !== 'AbortError') say('Piano playback is unavailable. Try the Play piano button again.');
  });
}

function pauseMusic() {
  music.pause();
  say('Piano paused.');
}

function showBriefing() {
  if (!briefing.paused && !briefing.ended) {
    briefing.pause();
    return;
  }
  say('For this sample briefing, Hanoi may see afternoon showers. On the AI desk, a research team is testing smaller speech recognition models to process audio on the device with less delay.');
  playExclusive(briefing).catch((error) => {
    if (error.name !== 'AbortError') say('Briefing audio was unavailable. You can try the Hear sample briefing button again.');
  });
}

function playIntroduction() {
  introStatus.hidden = true;
  if (!intro.paused && !intro.ended) {
    intro.pause();
    return;
  }
  playExclusive(intro).catch((error) => {
    if (error.name === 'AbortError') return;
    introStatus.textContent = 'Audio is unavailable. You can open the transcript below.';
    introStatus.hidden = false;
  });
}

const commands = [
  [startFocus, ['start focus', 'resume focus', 'start pomodoro', 'bat dau tap trung', 'bat dau pomodoro', 'tiep tuc tap trung']],
  [pauseFocus, ['pause focus', 'tam dung tap trung', 'tam dung pomodoro']],
  [resetFocus, ['reset timer', 'reset focus', 'dat lai bo dem', 'dat lai pomodoro']],
  [playMusic, ['play piano', 'play music', 'bat nhac', 'bat nhac piano', 'bat piano', 'mo nhac']],
  [pauseMusic, ['pause piano', 'pause music', 'tat nhac', 'dung nhac', 'tam dung nhac']],
  [showBriefing, ['sample briefing', 'show briefing', 'hear briefing', 'doc ban tin', 'nghe ban tin', 'mo ban tin', 'ban tin']],
];
const actions = new Map(commands.flatMap(([action, phrases]) => phrases.map((phrase) => [phrase, action])));

function runCommand(phrase) {
  const command = phrase.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replaceAll('đ', 'd')
    .replace(/[^a-z0-9 ]+/g, ' ').trim().replace(/\s+/g, ' ');
  const action = actions.get(command);
  if (!action) {
    say('Try “start focus”, “bật nhạc”, or “sample briefing”.');
    return false;
  }
  action();
  return true;
}

const voicePrompt = 'Try “bật nhạc” or “bắt đầu tập trung”.';

function finishListening(session, message) {
  if (!session || session !== recognition) return false;
  recognition = null;
  listening = false;
  voiceButton.textContent = 'Speak Vietnamese';
  voiceButton.setAttribute('aria-pressed', 'false');
  voiceHint.textContent = message;
  syncOrb();
  return true;
}

function stopListening() {
  const session = recognition;
  if (finishListening(session, voicePrompt)) session.abort();
}

function listen() {
  if (recognition) return stopListening();
  for (const player of players) player.pause();

  try {
    const session = new SpeechRecognition();
    recognition = session;
    session.lang = 'vi-VN';
    session.continuous = false;
    session.interimResults = false;
    voiceButton.textContent = 'Cancel mic';
    voiceButton.setAttribute('aria-pressed', 'true');
    voiceHint.textContent = 'Opening your browser’s speech recognition.';

    session.onstart = () => {
      if (session !== recognition) return;
      listening = true;
      voiceButton.textContent = 'Stop listening';
      voiceHint.textContent = 'Listening for a Vietnamese command…';
      syncOrb();
    };
    session.onresult = (event) => {
      const result = event.results[event.resultIndex];
      const phrase = result?.isFinal ? result[0].transcript.trim() : '';
      if (!phrase || !finishListening(session, 'Heard “' + phrase + '”.')) return;
      runCommand(phrase);
    };
    session.onend = () => finishListening(session, 'No command was received. Try again or type it instead.');
    session.onerror = ({ error }) => {
      const denied = error === 'not-allowed' || error === 'service-not-allowed';
      finishListening(session, denied ? 'Microphone access was blocked. Allow access or type a command.' :
        error === 'no-speech' ? 'No speech was detected. Try again.' : 'Speech recognition is unavailable. You can type a command.');
    };
    session.start();
  } catch {
    const message = 'The browser could not open the microphone. You can type a command.';
    if (!finishListening(recognition, message)) voiceHint.textContent = message;
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  stopListening();
  if (runCommand(input.value)) input.value = '';
});

focusButton.addEventListener('click', () => deadline === null ? startFocus() : pauseFocus());
resetButton.addEventListener('click', resetFocus);
musicButton.addEventListener('click', () => music.paused ? playMusic() : pauseMusic());
newsButton.addEventListener('click', showBriefing);
introButton.addEventListener('click', playIntroduction);
for (const player of players) {
  for (const event of ['play', 'pause', 'ended', 'error']) player.addEventListener(event, updateAudioControls);
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopListening();
  tick();
});

music.volume = 0.45;
setMode('idle', 'Ready', [71, 224, 181]);
for (const control of [focusButton, musicButton, newsButton, introButton, input, form.querySelector('button')]) control.disabled = false;
if (SpeechRecognition) {
  voiceButton.disabled = false;
  voiceButton.setAttribute('aria-pressed', 'false');
  voiceButton.addEventListener('click', listen);
} else {
  voiceHint.textContent = 'This browser does not support voice commands. You can type the same commands.';
}
