// The game world: state machine (title / playing / paused / game over), the player,
// bullets, waves, collisions, scoring and the combo multiplier. Nothing here draws;
// render.js reads this state and paints it.

import { FIELD, STEP, PLAYER, ORB, SCORE, COMBO, WAVE, POWERUP, BEST_KEY, BANNER } from './config.js';
import { createRandom, range, pick, chance } from './random.js';
import { makeEnemy, updateEnemy, spawnPoint, COST } from './enemies.js';
import { rollDrop, makePowerup, applyPowerup, updateEffects, freshEffects } from './powerups.js';
import { createStarfield } from './particles.js';

export function createWorld(random, audio, particles) {
  let best = 0;
  try {
    best = Number(window.localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    best = 0;
  }
  return {
    random,
    audio,
    particles,
    starfield: createStarfield(random),
    state: 'title',
    time: 0,
    score: 0,
    best,
    wave: 0,
    combo: 0,
    comboTimer: 0,
    multiplier: 1,
    player: freshPlayer(),
    bullets: [],
    orbs: [],
    enemies: [],
    shards: [],
    powerups: [],
    effects: freshEffects(),
    waveState: 'idle',
    waveTimer: 0,
    spawnQueue: [],
    spawnTimer: 0,
    banner: null,
    bannerTimer: 0,
    flash: 0,
    stats: { kills: 0, shots: 0, hits: 0 },
    newBest: false,
  };
}

function freshPlayer() {
  return {
    x: FIELD.width / 2,
    y: FIELD.height / 2,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    fireTimer: 0,
    invuln: 0,
    hull: PLAYER.hull,
    thrust: 0,
  };
}

/** Start (or restart) a run: fresh player, fresh wave 1. */
export function startGame(world) {
  world.player = freshPlayer();
  world.bullets = [];
  world.orbs = [];
  world.enemies = [];
  world.shards = [];
  world.powerups = [];
  world.effects = freshEffects();
  world.score = 0;
  world.wave = 0;
  world.combo = 0;
  world.comboTimer = 0;
  world.multiplier = 1;
  world.stats = { kills: 0, shots: 0, hits: 0 };
  world.newBest = false;
  world.particles.clear();
  world.state = 'playing';
  nextWave(world);
}

function nextWave(world) {
  world.wave += 1;
  world.waveState = 'announce';
  world.waveTimer = BANNER.wave;
  showBanner(world, `WAVE ${world.wave}`, world.wave % WAVE.bossEvery === 0 ? 'VOID TITAN APPROACHES' : '');
}

function buildWaveQueue(world) {
  const n = world.wave;
  const queue = [];
  if (n % WAVE.bossEvery === 0) {
    queue.push('boss');
    for (let i = 0; i < 2 + n / WAVE.bossEvery; i++) queue.push('drone');
    for (let i = 0; i < Math.floor(n / 5); i++) queue.push('weaver');
  } else {
    let budget = WAVE.budgetBase + n * WAVE.budgetPerWave;
    const table = ['drone', 'drone', 'drone', 'weaver', 'weaver', 'splitter'];
    while (budget > 0) {
      const type = pick(world.random, table);
      if (COST[type] > budget && type !== 'drone') continue;
      queue.push(type);
      budget -= COST[type];
    }
  }
  // Shuffle the queue so the wave does not arrive in type order.
  for (let i = queue.length - 1; i > 0; i--) {
    const j = Math.floor(world.random() * (i + 1));
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }
  world.spawnQueue = queue;
  world.spawnTimer = 0.4;
}

function showBanner(world, text, sub = '') {
  world.banner = { text, sub };
  world.bannerTimer = BANNER.wave;
}

/** Add points with the combo multiplier, and float the total at (x, y). */
function addScore(world, base, x, y) {
  const pts = base * world.multiplier;
  world.score += pts;
  world.particles.text(x, y, `+${pts}`, '#ffd75e', world.multiplier > 1 ? 18 : 15);
}

function raiseCombo(world) {
  world.combo += 1;
  world.comboTimer = COMBO.window;
  world.multiplier = Math.min(COMBO.maxMultiplier, 1 + Math.floor(world.combo / COMBO.perMultiplier));
}

function killEnemy(world, index, byBomb = false) {
  const e = world.enemies[index];
  world.enemies.splice(index, 1);
  world.stats.kills += 1;
  raiseCombo(world);
  addScore(world, e.score, e.x, e.y);
  world.particles.burst(e.x, e.y, e.color, e.type === 'boss' ? 60 : 20, e.type === 'boss' ? 340 : 260);
  world.particles.ring(e.x, e.y, e.color, 10);
  world.particles.shake(e.type === 'boss' ? 0.7 : 0.25);
  world.audio.explosion(e.type === 'boss');
  // Splitters break into two drones.
  if (e.type === 'splitter') {
    for (const off of [-0.5, 0.5]) {
      const d = makeEnemy('drone', e.x + Math.cos(off) * 24, e.y + Math.sin(off) * 24, world.random, world.wave);
      d.vx = Math.cos(off + e.angle) * 180;
      d.vy = Math.sin(off + e.angle) * 180;
      world.enemies.push(d);
    }
  }
  // Shards: the score pickups enemies leave behind.
  const shards = e.type === 'boss' ? 10 : e.type === 'splitter' ? 3 : 1;
  for (let i = 0; i < shards; i++) {
    const a = world.random() * Math.PI * 2;
    world.shards.push({
      x: e.x,
      y: e.y,
      vx: Math.cos(a) * range(world.random, 40, 140),
      vy: Math.sin(a) * range(world.random, 40, 140),
      value: SCORE.shard,
      t: 0,
    });
  }
  // A power-up drop, now and then.
  if (!byBomb || chance(world.random, 0.5)) {
    const kind = rollDrop(world.random);
    if (kind) world.powerups.push(makePowerup(kind, e.x, e.y));
  }
}

function damagePlayer(world, fromX, fromY) {
  const p = world.player;
  if (p.invuln > 0 || world.state !== 'playing') return;
  if (world.effects.shield > 0) {
    world.effects.shield -= 1;
    p.invuln = 0.8;
    world.particles.ring(p.x, p.y, '#5aa8ff', 14, 240);
    world.particles.text(p.x, p.y - 30, 'SHIELD!', '#5aa8ff', 16);
    world.audio.hit();
    return;
  }
  p.hull -= 1;
  p.invuln = PLAYER.invulnerable;
  world.combo = 0;
  world.multiplier = 1;
  world.flash = BANNER.flash;
  world.particles.burst(p.x, p.y, '#46e0ff', 26, 300);
  world.particles.shake(0.6);
  world.audio.hit();
  // A knock away from the hit.
  const dx = p.x - fromX;
  const dy = p.y - fromY;
  const d = Math.hypot(dx, dy) || 1;
  p.vx += (dx / d) * 320;
  p.vy += (dy / d) * 320;
  if (p.hull <= 0) gameOver(world);
}

/** The bomb: clears every orb and hurts every enemy on screen. */
export function detonateBomb(world) {
  if (world.state !== 'playing' || world.effects.bombs <= 0) return;
  world.effects.bombs -= 1;
  world.flash = 0.5;
  world.particles.shake(0.9);
  world.audio.bomb();
  for (const o of world.orbs) {
    world.particles.burst(o.x, o.y, '#ff7ad9', 4, 120, 0.4, 2);
  }
  world.orbs = [];
  for (let i = world.enemies.length - 1; i >= 0; i--) {
    const e = world.enemies[i];
    e.hp -= POWERUP.bombDamage;
    world.particles.burst(e.x, e.y, '#ffffff', 8, 200, 0.4, 2);
    if (e.hp <= 0) killEnemy(world, i, true);
  }
}

function gameOver(world) {
  world.state = 'gameover';
  world.newBest = world.score > world.best;
  if (world.newBest) {
    world.best = world.score;
    try {
      window.localStorage.setItem(BEST_KEY, String(world.best));
    } catch {
      // Private mode: the best score just does not persist.
    }
  }
  world.particles.burst(world.player.x, world.player.y, '#46e0ff', 50, 380, 0.9, 4);
  world.particles.shake(1);
  world.audio.gameOver();
}

/** Set the game-over screen directly (used by the screenshot demo). */
export function setGameOver(world, score, wave) {
  startGame(world);
  world.score = score;
  world.wave = wave;
  world.player.hull = 0;
  world.enemies = [];
  world.orbs = [];
  world.state = 'gameover';
  world.newBest = score > world.best;
  if (world.newBest) world.best = score;
}

function fireBullet(world, angle, speedMul = 1) {
  const p = world.player;
  const nx = p.x + Math.cos(angle) * 22;
  const ny = p.y + Math.sin(angle) * 22;
  world.bullets.push({
    x: nx,
    y: ny,
    vx: Math.cos(angle) * PLAYER.bulletSpeed * speedMul,
    vy: Math.sin(angle) * PLAYER.bulletSpeed * speedMul,
    life: 1.1,
  });
  world.particles.flash(nx, ny, '#bdf3ff');
  world.stats.shots += 1;
}

function updatePlayer(world, input, dt) {
  const p = world.player;
  const mx = input.moveX();
  const my = input.moveY();
  p.vx += mx * PLAYER.accel * dt;
  p.vy += my * PLAYER.accel * dt;
  const damp = Math.max(0, 1 - PLAYER.drag * dt);
  p.vx *= damp;
  p.vy *= damp;
  const speed = Math.hypot(p.vx, p.vy);
  if (speed > PLAYER.maxSpeed) {
    p.vx = (p.vx / speed) * PLAYER.maxSpeed;
    p.vy = (p.vy / speed) * PLAYER.maxSpeed;
  }
  p.x = Math.max(PLAYER.radius, Math.min(FIELD.width - PLAYER.radius, p.x + p.vx * dt));
  p.y = Math.max(PLAYER.radius, Math.min(FIELD.height - PLAYER.radius, p.y + p.vy * dt));
  p.thrust = Math.min(1, speed / PLAYER.maxSpeed);

  const aim = input.aim();
  p.angle = Math.atan2(aim.y - p.y, aim.x - p.x);

  p.fireTimer -= dt;
  if (input.firing() && p.fireTimer <= 0) {
    const interval = world.effects.rapid > 0 ? PLAYER.fireInterval / 2 : PLAYER.fireInterval;
    p.fireTimer = interval;
    if (world.effects.spread > 0) {
      fireBullet(world, p.angle - 0.16);
      fireBullet(world, p.angle);
      fireBullet(world, p.angle + 0.16);
    } else {
      fireBullet(world, p.angle);
    }
    world.audio.laser();
  }
  if (p.invuln > 0) p.invuln -= dt;
}

function updateBullets(world, dt) {
  for (let i = world.bullets.length - 1; i >= 0; i--) {
    const b = world.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0 || b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20) {
      world.bullets.splice(i, 1);
    }
  }
  for (let i = world.orbs.length - 1; i >= 0; i--) {
    const o = world.orbs[i];
    o.x += o.vx * dt;
    o.y += o.vy * dt;
    o.life -= dt;
    if (o.life <= 0 || o.x < -20 || o.x > FIELD.width + 20 || o.y < -20 || o.y > FIELD.height + 20) {
      world.orbs.splice(i, 1);
    }
  }
}

function updateEnemies(world, dt) {
  const p = world.player;
  const fire = (x, y, vx, vy) => {
    world.orbs.push({ x, y, vx, vy, life: ORB.life });
    world.audio.enemyShot();
  };
  for (const e of world.enemies) updateEnemy(e, dt, p, fire);
  // Gentle separation so enemies do not stack on one point.
  const list = world.enemies;
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const rr = a.radius + b.radius;
      const d2 = dx * dx + dy * dy;
      if (d2 > 0.01 && d2 < rr * rr) {
        const d = Math.sqrt(d2);
        const push = ((rr - d) / d) * 0.5;
        a.x -= dx * push * 0.5;
        a.y -= dy * push * 0.5;
        b.x += dx * push * 0.5;
        b.y += dy * push * 0.5;
      }
    }
  }
}

function updatePickups(world, dt) {
  const p = world.player;
  for (let i = world.shards.length - 1; i >= 0; i--) {
    const s = world.shards[i];
    s.t += dt;
    const dx = p.x - s.x;
    const dy = p.y - s.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < 170) {
      s.vx += (dx / d) * 900 * dt;
      s.vy += (dy / d) * 900 * dt;
    }
    s.vx *= Math.max(0, 1 - 2.4 * dt);
    s.vy *= Math.max(0, 1 - 2.4 * dt);
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    if (d < 26) {
      world.shards.splice(i, 1);
      raiseCombo(world);
      addScore(world, s.value, s.x, s.y);
      world.particles.burst(s.x, s.y, '#ffd75e', 3, 90, 0.3, 2);
    } else if (s.t > 9) {
      world.shards.splice(i, 1);
    }
  }
  for (let i = world.powerups.length - 1; i >= 0; i--) {
    const u = world.powerups[i];
    u.t += dt;
    u.life -= dt;
    const dx = p.x - u.x;
    const dy = p.y - u.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < 190) {
      u.vx += (dx / d) * 700 * dt;
      u.vy += (dy / d) * 700 * dt;
    }
    u.vx *= Math.max(0, 1 - 2 * dt);
    u.vy *= Math.max(0, 1 - 2 * dt);
    u.x += u.vx * dt;
    u.y += u.vy * dt + Math.sin(u.t * 3) * 12 * dt;
    if (d < 30) {
      world.powerups.splice(i, 1);
      const line = applyPowerup(world.effects, u.kind);
      if (line) showBanner(world, line, '');
      world.particles.ring(u.x, u.y, u.color, 12, 200);
      world.audio.powerup();
    } else if (u.life <= 0) {
      world.powerups.splice(i, 1);
    }
  }
}

function updateCollisions(world) {
  const p = world.player;
  // Player bullets against enemies.
  for (let i = world.bullets.length - 1; i >= 0; i--) {
    const b = world.bullets[i];
    let hit = false;
    for (let j = world.enemies.length - 1; j >= 0; j--) {
      const e = world.enemies[j];
      const dx = b.x - e.x;
      const dy = b.y - e.y;
      const rr = e.radius + PLAYER.bulletRadius;
      if (dx * dx + dy * dy < rr * rr) {
        world.bullets.splice(i, 1);
        hit = true;
        world.stats.hits += 1;
        e.hp -= 1;
        world.particles.burst(b.x, b.y, e.color, 5, 160, 0.3, 2);
        if (e.hp <= 0) killEnemy(world, j);
        break;
      }
    }
    if (hit) continue;
  }
  if (world.state !== 'playing') return;
  // Enemy orbs against the player.
  for (let i = world.orbs.length - 1; i >= 0; i--) {
    const o = world.orbs[i];
    const dx = o.x - p.x;
    const dy = o.y - p.y;
    const rr = ORB.radius + PLAYER.radius - 3;
    if (dx * dx + dy * dy < rr * rr) {
      world.orbs.splice(i, 1);
      damagePlayer(world, o.x, o.y);
      if (world.state !== 'playing') return;
    }
  }
  // Enemies ramming the player.
  for (let j = world.enemies.length - 1; j >= 0; j--) {
    const e = world.enemies[j];
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const rr = e.radius + PLAYER.radius - 2;
    if (dx * dx + dy * dy < rr * rr) {
      e.hp -= 2;
      if (e.hp <= 0) killEnemy(world, j);
      damagePlayer(world, e.x, e.y);
      if (world.state !== 'playing') return;
    }
  }
}

function updateWaves(world, dt) {
  if (world.waveState === 'announce') {
    world.waveTimer -= dt;
    if (world.waveTimer <= 0) {
      buildWaveQueue(world);
      world.waveState = 'spawning';
    }
    return;
  }
  if (world.waveState === 'spawning') {
    world.spawnTimer -= dt;
    if (world.spawnTimer <= 0 && world.spawnQueue.length > 0) {
      const type = world.spawnQueue.shift();
      const at = spawnPoint(world.random, world.player);
      world.enemies.push(makeEnemy(type, at.x, at.y, world.random, world.wave));
      const interval = Math.max(WAVE.spawnIntervalMin, WAVE.spawnInterval - world.wave * 0.04);
      world.spawnTimer = interval;
    }
    if (world.spawnQueue.length === 0) world.waveState = 'fighting';
    return;
  }
  if (world.waveState === 'fighting') {
    if (world.enemies.length === 0) {
      const bonus = (SCORE.waveClear + SCORE.waveClearPerWave * world.wave) * world.multiplier;
      world.score += bonus;
      showBanner(world, 'WAVE CLEAR', `+${bonus} BONUS`);
      world.audio.waveClear();
      world.waveState = 'clear';
      world.waveTimer = WAVE.clearPause;
    }
    return;
  }
  if (world.waveState === 'clear') {
    world.waveTimer -= dt;
    if (world.waveTimer <= 0) nextWave(world);
  }
}

/** One fixed step of the simulation. `input` is the real or the demo input. */
export function update(world, input, dt) {
  world.time += dt;
  if (world.bannerTimer > 0) world.bannerTimer -= dt;
  if (world.flash > 0) world.flash -= dt;
  updateEffects(world.effects, dt);
  if (world.comboTimer > 0) {
    world.comboTimer -= dt;
    if (world.comboTimer <= 0) {
      world.combo = 0;
      world.multiplier = 1;
    }
  }
  world.particles.update(dt);
  if (world.state !== 'playing') return;
  updatePlayer(world, input, dt);
  updateBullets(world, dt);
  updateEnemies(world, dt);
  updatePickups(world, dt);
  updateCollisions(world);
  if (world.state === 'playing') updateWaves(world, dt);
}
