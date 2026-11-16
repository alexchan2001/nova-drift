// Screenshot scenes (?shot=start|play|storm|end) and the autopilot that flies the
// ship in them, so the action shots are real renders of the game playing itself.
// Nothing here runs in normal play: without a ?shot= parameter the game starts on
// its title screen and waits for the player.

import { FIELD } from './config.js';
import { makeEnemy } from './enemies.js';
import { makePowerup } from './powerups.js';
import { startGame, setGameOver } from './world.js';

/**
 * Set the world up for one screenshot scene. Returns true when the scene wants
 * the autopilot to fly the ship (play and storm); false for title and game over.
 */
export function applyDemo(world, shot) {
  if (shot === 'end') {
    setGameOver(world, 7340, 6);
    world.particles.burst(640, 360, '#46e0ff', 24, 200, 1.2, 3);
    world.particles.burst(420, 300, '#ff4d9d', 16, 180, 1.0, 3);
    return false;
  }
  if (shot === 'play' || shot === 'storm') {
    startGame(world);
    const w = world;
    // Freeze the wave spawner: the tableau is fixed for the screenshot.
    // (Without this, the announce timer fires buildWaveQueue with the
    // display wave number — wave 5 builds a second boss that wanders
    // into the HUD.)
    w.spawnQueue = [];
    w.waveState = 'fighting';
    if (shot === 'play') {
      w.score = 1250;
      w.wave = 2;
      w.combo = 12;
      w.multiplier = 2;
      w.comboTimer = 3.0;
      w.effects.spread = 9;
      w.player.x = 620;
      w.player.y = 430;
      const spots = [
        ['drone', 300, 200],
        ['drone', 900, 180],
        ['weaver', 1020, 330],
        ['drone', 180, 480],
        ['splitter', 780, 150],
        ['weaver', 420, 140],
        ['drone', 1060, 520],
        ['drone', 200, 300],
        ['weaver', 1100, 450],
        ['drone', 500, 560],
        ['splitter', 950, 560],
        ['drone', 650, 120],
      ];
      for (const [type, x, y] of spots) {
        w.enemies.push(makeEnemy(type, x, y, w.random, 2));
      }
      for (let i = 0; i < 5; i++) {
        w.bullets.push({
          x: 640 + i * 26,
          y: 410 - i * 8,
          vx: 760,
          vy: -40,
          life: 1.0,
        });
      }
      for (let i = 0; i < 4; i++) {
        w.shards.push({ x: 500 + i * 40, y: 300 + (i % 2) * 40, vx: 0, vy: 0, value: 10, t: 0 });
      }
      w.powerups.push(makePowerup('rapid', 880, 470));
    } else {
      // storm: a boss wave at full tilt.
      w.score = 4830;
      w.wave = 5;
      w.combo = 24;
      w.multiplier = 3;
      w.comboTimer = 3.2;
      w.effects.rapid = 8;
      w.effects.shield = 2;
      w.player.x = 640;
      w.player.y = 520;
      w.enemies.push(makeEnemy('boss', 640, 180, w.random, 5));
      const spots = [
        ['drone', 240, 220],
        ['drone', 1040, 240],
        ['weaver', 340, 420],
        ['weaver', 940, 440],
        ['splitter', 180, 560],
        ['splitter', 1100, 560],
        ['drone', 520, 120],
        ['drone', 760, 110],
      ];
      for (const [type, x, y] of spots) {
        w.enemies.push(makeEnemy(type, x, y, w.random, 5));
      }
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        w.orbs.push({ x: 640 + Math.cos(a) * 120, y: 180 + Math.sin(a) * 120, vx: Math.cos(a) * 190, vy: Math.sin(a) * 190, life: 5 });
      }
      for (let i = 0; i < 8; i++) {
        w.bullets.push({
          x: 640 + (i - 4) * 18,
          y: 500 - Math.abs(i - 4) * 10,
          vx: (i - 4) * 30,
          vy: -760,
          life: 1.0,
        });
      }
      w.powerups.push(makePowerup('spread', 300, 300));
      w.powerups.push(makePowerup('bomb', 980, 300));
    }
    return true;
  }
  return false;
}

/** An input that flies the ship itself: orbit the nearest enemy and keep firing. */
export function createDemoInput(world) {
  return {
    setView() {
      // The demo flies in logical coordinates; the view does not matter.
    },
    moveX() {
      return this._steer().x;
    },
    moveY() {
      return this._steer().y;
    },
    firing() {
      return true;
    },
    aim() {
      const target = nearestEnemy(world);
      if (!target) return { x: world.player.x, y: world.player.y - 100 };
      return { x: target.x, y: target.y };
    },
    takeActions() {
      return 0;
    },
    _steer() {
      const p = world.player;
      const target = nearestEnemy(world);
      let dx = 0;
      let dy = 0;
      if (target) {
        const ex = target.x - p.x;
        const ey = target.y - p.y;
        const d = Math.hypot(ex, ey) || 1;
        // Hold a ring around the enemy, strafing sideways as time passes.
        const want = 300;
        const radial = (d - want) / 200;
        const strafe = Math.sin(world.time * 1.3) * 0.9;
        dx = (ex / d) * radial + (-ey / d) * strafe;
        dy = (ey / d) * radial + (ex / d) * strafe;
      } else {
        dx = (FIELD.width / 2 - p.x) / 200;
        dy = (FIELD.height / 2 - p.y) / 200;
      }
      return {
        x: dx > 0.25 ? 1 : dx < -0.25 ? -1 : 0,
        y: dy > 0.25 ? 1 : dy < -0.25 ? -1 : 0,
      };
    },
  };
}

function nearestEnemy(world) {
  const p = world.player;
  let best = null;
  let bestD = Infinity;
  for (const e of world.enemies) {
    const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}
