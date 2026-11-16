// Power-ups: what drops, what each one does, and how long timed effects last.
// Dropped by enemies, they drift and bob, and drift toward the player up close.

import { POWERUP } from './config.js';
import { pick } from './random.js';

export const KINDS = {
  spread: { label: 'SPREAD', color: '#59ffa0', desc: 'Triple shot' },
  rapid: { label: 'RAPID', color: '#ffe14d', desc: 'Double fire rate' },
  shield: { label: 'SHIELD', color: '#5aa8ff', desc: 'Blocks 3 hits' },
  bomb: { label: 'BOMB', color: '#ff5a5a', desc: '+1 bomb (Q)' },
};

const DROP_TABLE = ['spread', 'rapid', 'shield', 'bomb', 'spread', 'rapid'];

/** Roll a drop for a killed enemy; returns a kind or null. */
export function rollDrop(random) {
  if (random() >= POWERUP.dropChance) return null;
  return pick(random, DROP_TABLE);
}

export function makePowerup(kind, x, y) {
  return {
    kind,
    x,
    y,
    vx: 0,
    vy: 26,
    radius: 15,
    t: 0,
    life: 11,
    color: KINDS[kind].color,
    label: KINDS[kind].label,
  };
}

/**
 * Apply a picked-up power-up to the player's effects. Returns a short banner
 * line for the HUD, or null for the bomb (which just adds stock).
 */
export function applyPowerup(effects, kind) {
  if (kind === 'spread') {
    effects.spread = POWERUP.duration;
    return 'TRIPLE SHOT!';
  }
  if (kind === 'rapid') {
    effects.rapid = POWERUP.duration;
    return 'RAPID FIRE!';
  }
  if (kind === 'shield') {
    effects.shield = POWERUP.shieldHits;
    return 'SHIELD UP!';
  }
  if (kind === 'bomb') {
    effects.bombs = Math.min(POWERUP.bombMax, effects.bombs + 1);
    return '+1 BOMB';
  }
  return null;
}

/** Tick the timed effects down; returns nothing. */
export function updateEffects(effects, dt) {
  if (effects.spread > 0) effects.spread = Math.max(0, effects.spread - dt);
  if (effects.rapid > 0) effects.rapid = Math.max(0, effects.rapid - dt);
}

/** Fresh effects for a new game. */
export function freshEffects() {
  return { spread: 0, rapid: 0, shield: 0, bombs: POWERUP.bombStart };
}
