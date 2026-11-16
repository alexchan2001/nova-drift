// Enemy types and their movement: drones chase, weavers sway and shoot, splitters
// drift and split, and the Void Titan bosses every fifth wave with radial bursts.

import { FIELD } from './config.js';
import { angle, range } from './random.js';

export const TYPES = {
  drone: { radius: 15, hp: 1, speed: 150, score: 50, color: '#ff4d9d' },
  weaver: { radius: 17, hp: 2, speed: 105, score: 100, color: '#ffb02e' },
  splitter: { radius: 22, hp: 3, speed: 70, score: 150, color: '#a78bff' },
  boss: { radius: 52, hp: 60, speed: 46, score: 1000, color: '#ff2e63' },
};

/** Spawn budget cost of each type, for wave building. */
export const COST = { drone: 1, weaver: 2, splitter: 3, boss: 12 };

export function makeEnemy(type, x, y, random, wave) {
  const def = TYPES[type];
  const hpScale = 1 + Math.floor((wave - 1) / 4);
  return {
    type,
    x,
    y,
    vx: 0,
    vy: 0,
    radius: def.radius,
    hp: def.hp + (type === 'boss' ? Math.floor(wave / 5) * 20 : 0) + (type !== 'boss' ? hpScale - 1 : 0),
    maxHp: def.hp + (type === 'boss' ? Math.floor(wave / 5) * 20 : 0) + (type !== 'boss' ? hpScale - 1 : 0),
    speed: def.speed * (1 + Math.min(0.5, (wave - 1) * 0.04)),
    score: def.score,
    color: def.color,
    t: 0,
    phase: random() * Math.PI * 2,
    fireTimer: range(random, 1.2, 2.4),
    burstTimer: 2.5,
    angle: angle(random),
    spin: range(random, -1.2, 1.2),
  };
}

/** Pick a spawn point on the field's edge, away from the player. */
export function spawnPoint(random, player) {
  for (let tries = 0; tries < 8; tries++) {
    const side = Math.floor(random() * 4);
    let x;
    let y;
    if (side === 0) {
      x = random() * FIELD.width;
      y = -30;
    } else if (side === 1) {
      x = FIELD.width + 30;
      y = random() * FIELD.height;
    } else if (side === 2) {
      x = random() * FIELD.width;
      y = FIELD.height + 30;
    } else {
      x = -30;
      y = random() * FIELD.height;
    }
    const dx = x - player.x;
    const dy = y - player.y;
    if (dx * dx + dy * dy > 320 * 320) return { x, y };
  }
  return { x: FIELD.width / 2, y: -30 };
}

/**
 * Move one enemy for a step. `fire` is called with (x, y, vx, vy) whenever an
 * enemy shoots; the world turns that into an orb.
 */
export function updateEnemy(e, dt, player, fire) {
  e.t += dt;
  const dx = player.x - e.x;
  const dy = player.y - e.y;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = dx / dist;
  const ny = dy / dist;

  if (e.type === 'drone') {
    e.vx += nx * e.speed * 2.4 * dt;
    e.vy += ny * e.speed * 2.4 * dt;
    const v = Math.hypot(e.vx, e.vy);
    const cap = e.speed * 1.15;
    if (v > cap) {
      e.vx = (e.vx / v) * cap;
      e.vy = (e.vy / v) * cap;
    }
    e.angle = Math.atan2(e.vy, e.vx);
  } else if (e.type === 'weaver') {
    // Sway sideways while closing in, and shoot aimed orbs.
    const sway = Math.sin(e.t * 2.2 + e.phase) * 90;
    e.vx = nx * e.speed + -ny * sway;
    e.vy = ny * e.speed + nx * sway;
    e.angle = Math.atan2(dy, dx);
    e.fireTimer -= dt;
    if (e.fireTimer <= 0 && dist < 560) {
      e.fireTimer = 2.3;
      fire(e.x, e.y, nx * 230, ny * 230);
    }
  } else if (e.type === 'splitter') {
    e.vx += nx * e.speed * 1.4 * dt;
    e.vy += ny * e.speed * 1.4 * dt;
    const v = Math.hypot(e.vx, e.vy);
    const cap = e.speed;
    if (v > cap) {
      e.vx = (e.vx / v) * cap;
      e.vy = (e.vy / v) * cap;
    }
    e.angle += e.spin * dt;
  } else if (e.type === 'boss') {
    // Drift toward the centre of the field, then strafe; fire radial bursts.
    const cx = FIELD.width / 2 - e.x;
    const cy = FIELD.height / 2 - e.y;
    const cd = Math.hypot(cx, cy) || 1;
    if (cd > 140) {
      e.vx += (cx / cd) * e.speed * 1.6 * dt;
      e.vy += (cy / cd) * e.speed * 1.6 * dt;
    } else {
      e.vx += Math.cos(e.t * 0.7 + e.phase) * 60 * dt;
      e.vy += Math.sin(e.t * 0.9 + e.phase) * 60 * dt;
    }
    const v = Math.hypot(e.vx, e.vy);
    const cap = e.speed * 1.4;
    if (v > cap) {
      e.vx = (e.vx / v) * cap;
      e.vy = (e.vy / v) * cap;
    }
    e.angle += 0.6 * dt;
    e.burstTimer -= dt;
    if (e.burstTimer <= 0) {
      e.burstTimer = 2.6;
      const count = 12;
      const base = Math.random() * Math.PI * 2;
      for (let i = 0; i < count; i++) {
        const a = base + (i / count) * Math.PI * 2;
        fire(e.x, e.y, Math.cos(a) * 190, Math.sin(a) * 190);
      }
    }
    e.fireTimer -= dt;
    if (e.fireTimer <= 0 && dist < 620) {
      e.fireTimer = 1.4;
      // A aimed three-shot fan at the player.
      const aim = Math.atan2(dy, dx);
      for (const off of [-0.22, 0, 0.22]) {
        fire(e.x, e.y, Math.cos(aim + off) * 250, Math.sin(aim + off) * 250);
      }
    }
  }

  e.x += e.vx * dt;
  e.y += e.vy * dt;
  // Keep bosses and splitters inside the field; drones and weavers may wander in.
  if (e.type === 'boss' || e.type === 'splitter') {
    e.x = Math.max(e.radius, Math.min(FIELD.width - e.radius, e.x));
    e.y = Math.max(e.radius, Math.min(FIELD.height - e.radius, e.y));
  }
}
