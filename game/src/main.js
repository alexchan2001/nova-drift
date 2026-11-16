// NOVA DRIFT — boot and the main loop. Fixed 60 Hz simulation steps, the renderer
// paints every animation frame, and the state machine (title / playing / paused /
// game over) lives here, reading one-shot actions from the input.

import { FIELD, STEP } from './config.js';
import { createRandom } from './random.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_RESTART, ACTION_BOMB, ACTION_MUTE } from './input.js';
import { createAudio } from './audio.js';
import { createParticles } from './particles.js';
import { createWorld, startGame, update, detonateBomb } from './world.js';
import { draw, computeView } from './render.js';
import { applyDemo, createDemoInput } from './demo.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// A failed load or a runtime error must be visible to a headless test run: it is
// written into the document title, which --dump-dom shows, and never drawn.
window.addEventListener('error', (event) => {
  document.title = `NOVA DRIFT ERROR: ${event.message}`;
});

const params = new URLSearchParams(window.location.search);
const seedParam = Number(params.get('seed'));
const seed = Number.isFinite(seedParam) && seedParam !== 0 ? seedParam : (Date.now() % 2147483647);
const random = createRandom(seed);

const audio = createAudio();
const particles = createParticles();
const world = createWorld(random, audio, particles);
const realInput = createInput(canvas);

// Screenshot scenes (?shot=start|play|storm|end): the demo input flies the ship.
const shot = params.get('shot');
let input = realInput;
if (shot) {
  const autopilot = applyDemo(world, shot);
  if (autopilot) input = createDemoInput(world);
}

let view = computeView(1, 1);
function resize() {
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  view = computeView(w, h);
  input.setView(view);
}
window.addEventListener('resize', resize);
resize();

// The audio context may only start from a user gesture.
window.addEventListener('pointerdown', () => audio.unlock(), { once: true });
window.addEventListener('keydown', () => audio.unlock(), { once: true });

let last = performance.now();
let accumulator = 0;

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.1) dt = 0.1;
  accumulator += dt;

  // One-shot actions, taken once per frame.
  const actions = input.takeActions();
  if (actions & ACTION_MUTE) audio.toggleMute();
  if (world.state === 'title' && actions & ACTION_CONFIRM) {
    audio.unlock();
    startGame(world);
  } else if (world.state === 'playing') {
    if (actions & ACTION_PAUSE) world.state = 'paused';
    else if (actions & ACTION_BOMB) detonateBomb(world);
  } else if (world.state === 'paused' && (actions & ACTION_PAUSE || actions & ACTION_CONFIRM)) {
    world.state = 'playing';
  } else if (world.state === 'gameover' && (actions & ACTION_RESTART || actions & ACTION_CONFIRM)) {
    audio.unlock();
    startGame(world);
  }

  // Fixed steps, at most five a frame so a slow frame cannot spiral.
  let steps = 0;
  while (accumulator >= STEP && steps < 5) {
    update(world, input, STEP);
    accumulator -= STEP;
    steps += 1;
  }
  if (steps === 5) accumulator = 0;

  draw(ctx, world, view, world.time, canvas.width, canvas.height);
}

requestAnimationFrame(frame);
