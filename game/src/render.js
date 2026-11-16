// Everything the player sees: the starfield, the ship, enemies, bullets, the HUD,
// the title screen and the game-over screen. Nothing here changes the simulation;
// it reads the world and paints it.

import { FIELD, PALETTE, FONT, BANNER, ORB } from './config.js';

/** The orb radius, shared with the world for collisions. */
const ORB_RADIUS = ORB.radius;

/** The scale and offset that fit the 1280x720 field into a window, letterboxed. */
export function computeView(width, height) {
  const scale = Math.min(width / FIELD.width, height / FIELD.height);
  return {
    scale,
    ox: (width - FIELD.width * scale) / 2,
    oy: (height - FIELD.height * scale) / 2,
  };
}

function drawShip(ctx, x, y, angle, color, core, scale = 1, flame = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  ctx.shadowColor = color;
  ctx.shadowBlur = 16;
  // Hull: a sleek dart.
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(20, 0);
  ctx.lineTo(-12, -11);
  ctx.lineTo(-7, 0);
  ctx.lineTo(-12, 11);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  // Cockpit.
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(5, 0, 4.5, 0, Math.PI * 2);
  ctx.fill();
  // Engine flame, flickering with thrust.
  if (flame > 0.05) {
    const len = 10 + flame * 14 + Math.random() * 6;
    const grad = ctx.createLinearGradient(-12, 0, -12 - len, 0);
    grad.addColorStop(0, '#ffe9a8');
    grad.addColorStop(0.5, '#ff9a3d');
    grad.addColorStop(1, 'rgba(255, 80, 40, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-12, -5);
    ctx.lineTo(-12 - len, 0);
    ctx.lineTo(-12, 5);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawDrone(ctx, e) {
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.angle);
  ctx.shadowColor = e.color;
  ctx.shadowBlur = 14;
  ctx.fillStyle = e.color;
  ctx.beginPath();
  ctx.moveTo(16, 0);
  ctx.lineTo(0, -11);
  ctx.lineTo(-16, 0);
  ctx.lineTo(0, 11);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawWeaver(ctx, e) {
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.t * 0.8);
  ctx.shadowColor = e.color;
  ctx.shadowBlur = 14;
  ctx.fillStyle = e.color;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const px = Math.cos(a) * 17;
    const py = Math.sin(a) * 17;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#3a2200';
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSplitter(ctx, e) {
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.angle * 0.4);
  ctx.shadowColor = e.color;
  ctx.shadowBlur = 14;
  ctx.fillStyle = e.color;
  ctx.fillRect(-18, -18, 36, 36);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.strokeRect(-10, -10, 20, 20);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBoss(ctx, e, time) {
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.shadowColor = e.color;
  ctx.shadowBlur = 26;
  // Outer ring, rotating segments.
  ctx.rotate(e.angle);
  ctx.strokeStyle = e.color;
  ctx.lineWidth = 7;
  for (let i = 0; i < 5; i++) {
    const a0 = (i / 5) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(0, 0, 48, a0 + 0.12, a0 + Math.PI * 2 / 5 - 0.12);
    ctx.stroke();
  }
  ctx.rotate(-e.angle);
  // Core.
  const pulse = 1 + 0.12 * Math.sin(time * 5);
  ctx.fillStyle = '#2a0010';
  ctx.beginPath();
  ctx.arc(0, 0, 34 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ff8fb0';
  ctx.beginPath();
  ctx.arc(0, 0, 16 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  // Health bar above the boss.
  const w = 110;
  const frac = Math.max(0, e.hp / e.maxHp);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(-w / 2, -72, w, 9);
  ctx.fillStyle = '#ff2e63';
  ctx.fillRect(-w / 2, -72, w * frac, 9);
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1;
  ctx.strokeRect(-w / 2, -72, w, 9);
  ctx.restore();
}

function drawPowerup(ctx, u, time) {
  const bob = Math.sin(time * 3 + u.x) * 3;
  const blink = u.life < 3 ? (Math.sin(time * 12) > 0 ? 1 : 0.35) : 1;
  ctx.save();
  ctx.globalAlpha = blink;
  ctx.translate(u.x, u.y + bob);
  ctx.shadowColor = u.color;
  ctx.shadowBlur = 16;
  ctx.fillStyle = 'rgba(4, 8, 18, 0.9)';
  ctx.beginPath();
  ctx.arc(0, 0, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = u.color;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = u.color;
  ctx.font = `bold 13px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(u.label[0], 0, 1);
  ctx.restore();
}

function drawHUD(ctx, world) {
  const { score, best, wave, multiplier, combo } = world;
  const p = world.player;
  ctx.textBaseline = 'alphabetic';
  // Score, top left.
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.text;
  ctx.font = `bold 34px ${FONT}`;
  ctx.fillText(String(score).padStart(6, '0'), 28, 48);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `13px ${FONT}`;
  ctx.fillText(`BEST ${Math.max(best, score).toLocaleString('en-US')}`, 28, 70);
  // Combo, under the score.
  if (multiplier > 1 || combo > 0) {
    ctx.fillStyle = combo > 0 ? '#ffd75e' : PALETTE.muted;
    ctx.font = `bold 17px ${FONT}`;
    ctx.fillText(`COMBO x${multiplier}  (${combo})`, 28, 96);
    const frac = Math.max(0, world.comboTimer / 3.5);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(28, 104, 120, 5);
    ctx.fillStyle = '#ffd75e';
    ctx.fillRect(28, 104, 120 * frac, 5);
  }
  // Wave, top centre.
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.text;
  ctx.font = `bold 22px ${FONT}`;
  ctx.fillText(`WAVE ${Math.max(1, wave)}`, FIELD.width / 2, 42);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `13px ${FONT}`;
  const left = world.enemies.length + world.spawnQueue.length;
  ctx.fillText(left > 0 ? `${left} HOSTILE${left === 1 ? '' : 'S'}` : 'SECTOR CLEAR', FIELD.width / 2, 64);
  // Hull hearts and bombs, top right.
  ctx.textAlign = 'right';
  for (let i = 0; i < 3; i++) {
    const x = FIELD.width - 32 - i * 34;
    const y = 36;
    ctx.fillStyle = i < p.hull ? '#ff5a6e' : 'rgba(255,255,255,0.16)';
    ctx.beginPath();
    ctx.moveTo(x, y + 8);
    ctx.bezierCurveTo(x - 11, y - 3, x - 6, y - 12, x, y - 5);
    ctx.bezierCurveTo(x + 6, y - 12, x + 11, y - 3, x, y + 8);
    ctx.fill();
  }
  ctx.fillStyle = PALETTE.text;
  ctx.font = `bold 16px ${FONT}`;
  ctx.fillText(`BOMB x${world.effects.bombs}  [Q]`, FIELD.width - 28, 74);
  // Active timed effects, as chips under the hearts.
  let chipY = 96;
  ctx.textAlign = 'right';
  ctx.font = `bold 13px ${FONT}`;
  if (world.effects.spread > 0) {
    ctx.fillStyle = '#59ffa0';
    ctx.fillText(`TRIPLE ${Math.ceil(world.effects.spread)}s`, FIELD.width - 28, chipY);
    chipY += 20;
  }
  if (world.effects.rapid > 0) {
    ctx.fillStyle = '#ffe14d';
    ctx.fillText(`RAPID ${Math.ceil(world.effects.rapid)}s`, FIELD.width - 28, chipY);
    chipY += 20;
  }
  if (world.effects.shield > 0) {
    ctx.fillStyle = '#5aa8ff';
    ctx.fillText(`SHIELD x${world.effects.shield}`, FIELD.width - 28, chipY);
  }
  // Controls hint, early in wave 1 only.
  if (world.state === 'playing' && world.wave === 1 && world.time < 7) {
    ctx.textAlign = 'center';
    ctx.globalAlpha = Math.max(0, Math.min(1, 7 - world.time));
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `15px ${FONT}`;
    ctx.fillText('WASD / ARROWS move   ·   MOUSE aim   ·   CLICK / SPACE fire   ·   Q bomb   ·   P pause   ·   M mute', FIELD.width / 2, FIELD.height - 24);
    ctx.globalAlpha = 1;
  }
}

function drawBanner(ctx, world) {
  if (!world.banner || world.bannerTimer <= 0) return;
  const a = Math.min(1, world.bannerTimer / 0.5, (BANNER.wave - world.bannerTimer) / 0.3 + 0.4);
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, a));
  ctx.textAlign = 'center';
  ctx.shadowColor = '#46e0ff';
  ctx.shadowBlur = 24;
  ctx.fillStyle = PALETTE.text;
  ctx.font = `bold 52px ${FONT}`;
  ctx.fillText(world.banner.text, FIELD.width / 2, 250);
  ctx.shadowBlur = 0;
  if (world.banner.sub) {
    ctx.fillStyle = '#ffd75e';
    ctx.font = `bold 20px ${FONT}`;
    ctx.fillText(world.banner.sub, FIELD.width / 2, 286);
  }
  ctx.restore();
}

function drawTitle(ctx, world, time) {
  // Dim the field a little so the title reads.
  ctx.fillStyle = 'rgba(3, 5, 12, 0.55)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  const bob = Math.sin(time * 1.4) * 6;
  ctx.textAlign = 'center';
  ctx.save();
  ctx.shadowColor = '#46e0ff';
  ctx.shadowBlur = 34;
  ctx.fillStyle = '#eafcff';
  ctx.font = `bold 92px ${FONT}`;
  try {
    ctx.letterSpacing = '10px';
  } catch {
    // Older browsers ignore letter spacing.
  }
  ctx.fillText('NOVA DRIFT', FIELD.width / 2, 218 + bob);
  ctx.restore();
  try {
    ctx.letterSpacing = '0px';
  } catch {
    // Ignore.
  }
  ctx.fillStyle = '#8be9ff';
  ctx.font = `20px ${FONT}`;
  ctx.fillText('A NEON ARENA SHOOTER  ·  SURVIVE THE VOID, CHASE THE COMBO', FIELD.width / 2, 262 + bob);
  // Controls card.
  ctx.fillStyle = 'rgba(10, 16, 34, 0.8)';
  ctx.strokeStyle = 'rgba(70, 224, 255, 0.35)';
  ctx.lineWidth = 1.5;
  const cx = FIELD.width / 2;
  const cw = 560;
  const cy = 300;
  const ch = 168;
  ctx.beginPath();
  ctx.roundRect(cx - cw / 2, cy, cw, ch, 14);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = PALETTE.text;
  ctx.font = `bold 17px ${FONT}`;
  ctx.textAlign = 'left';
  const rows = [
    ['MOVE', 'WASD  /  ARROW KEYS'],
    ['AIM + FIRE', 'MOUSE  ·  HOLD CLICK OR SPACE'],
    ['BOMB', 'Q  OR  RIGHT-CLICK  —  CLEARS THE SCREEN'],
    ['PAUSE / MUTE', 'P  /  M'],
  ];
  rows.forEach(([k, v], i) => {
    const y = cy + 38 + i * 34;
    ctx.fillStyle = '#46e0ff';
    ctx.fillText(k, cx - cw / 2 + 36, y);
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(v, cx - cw / 2 + 190, y);
  });
  // Start prompt, pulsing.
  const pulse = 0.65 + 0.35 * Math.sin(time * 3.2);
  ctx.globalAlpha = pulse;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd75e';
  ctx.font = `bold 26px ${FONT}`;
  ctx.fillText('CLICK OR PRESS ENTER TO LAUNCH', FIELD.width / 2, 540);
  ctx.globalAlpha = 1;
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `15px ${FONT}`;
  ctx.fillText(
    world.best > 0 ? `BEST SCORE  ${world.best.toLocaleString('en-US')}` : 'NO RUNS YET — SET THE FIRST RECORD',
    FIELD.width / 2, 576,
  );
  ctx.fillStyle = 'rgba(139, 150, 184, 0.8)';
  ctx.font = `13px ${FONT}`;
  ctx.fillText('Kill drones, weavers and splitters. Chain kills for combo. Grab power-ups. Survive the Void Titan every 5th wave.', FIELD.width / 2, 640);
}

function drawPaused(ctx) {
  ctx.fillStyle = 'rgba(3, 5, 12, 0.6)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.text;
  ctx.font = `bold 56px ${FONT}`;
  ctx.fillText('PAUSED', FIELD.width / 2, 350);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `18px ${FONT}`;
  ctx.fillText('Press P or click to resume', FIELD.width / 2, 392);
}

function drawGameOver(ctx, world) {
  ctx.fillStyle = 'rgba(3, 5, 12, 0.72)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.textAlign = 'center';
  ctx.save();
  ctx.shadowColor = '#ff2e63';
  ctx.shadowBlur = 30;
  ctx.fillStyle = '#ff8fb0';
  ctx.font = `bold 76px ${FONT}`;
  ctx.fillText('GAME OVER', FIELD.width / 2, 240);
  ctx.restore();
  if (world.newBest) {
    ctx.fillStyle = '#ffd75e';
    ctx.font = `bold 24px ${FONT}`;
    ctx.fillText('★ NEW BEST SCORE ★', FIELD.width / 2, 286);
  }
  ctx.fillStyle = PALETTE.text;
  ctx.font = `bold 44px ${FONT}`;
  ctx.fillText(world.score.toLocaleString('en-US'), FIELD.width / 2, 356);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `18px ${FONT}`;
  const acc = world.stats.shots > 0 ? Math.round((world.stats.hits / world.stats.shots) * 100) : 0;
  ctx.fillText(
    `WAVE ${world.wave}   ·   ${world.stats.kills} KILLS   ·   ${acc}% ACCURACY   ·   BEST ${world.best.toLocaleString('en-US')}`,
    FIELD.width / 2, 398,
  );
  const pulse = 0.65 + 0.35 * Math.sin(world.time * 3.2);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = '#ffd75e';
  ctx.font = `bold 26px ${FONT}`;
  ctx.fillText('PRESS R OR CLICK TO FLY AGAIN', FIELD.width / 2, 480);
  ctx.globalAlpha = 1;
}

/** Paint the whole frame. `view` is computeView's result for this canvas size. */
export function draw(ctx, world, view, time, canvasW, canvasH) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvasW, canvasH);
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr * view.scale, 0, 0, dpr * view.scale, dpr * view.ox, dpr * view.oy);
  // Field background.
  const bg = ctx.createLinearGradient(0, 0, 0, FIELD.height);
  bg.addColorStop(0, PALETTE.bg2);
  bg.addColorStop(1, PALETTE.bg);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);

  const shake = world.particles.offset();
  ctx.save();
  ctx.translate(shake.x, shake.y);
  world.starfield.draw(ctx, time, world.player.x / FIELD.width, world.player.y / FIELD.height);

  // Shards.
  for (const s of world.shards) {
    const tw = 0.7 + 0.3 * Math.sin(time * 6 + s.x);
    ctx.save();
    ctx.globalAlpha = tw;
    ctx.translate(s.x, s.y);
    ctx.rotate(time * 2 + s.x);
    ctx.fillStyle = PALETTE.shard;
    ctx.shadowColor = PALETTE.shard;
    ctx.shadowBlur = 8;
    ctx.fillRect(-4, -4, 8, 8);
    ctx.restore();
  }
  // Power-ups.
  for (const u of world.powerups) drawPowerup(ctx, u, time);
  // Enemies.
  for (const e of world.enemies) {
    if (e.type === 'drone') drawDrone(ctx, e);
    else if (e.type === 'weaver') drawWeaver(ctx, e);
    else if (e.type === 'splitter') drawSplitter(ctx, e);
    else if (e.type === 'boss') drawBoss(ctx, e, time);
  }
  // Enemy orbs.
  for (const o of world.orbs) {
    ctx.save();
    ctx.shadowColor = PALETTE.orb;
    ctx.shadowBlur = 12;
    ctx.fillStyle = PALETTE.orb;
    ctx.beginPath();
    ctx.arc(o.x, o.y, ORB_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(o.x, o.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // Player bullets.
  for (const b of world.bullets) {
    const a = Math.atan2(b.vy, b.vx);
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(a);
    ctx.shadowColor = PALETTE.bullet;
    ctx.shadowBlur = 10;
    ctx.fillStyle = PALETTE.bullet;
    ctx.beginPath();
    ctx.roundRect(-9, -2.5, 18, 5, 2.5);
    ctx.fill();
    ctx.restore();
  }
  // The player ship (flickers while invulnerable).
  if (world.state !== 'gameover') {
    const p = world.player;
    const blink = p.invuln > 0 ? (Math.sin(time * 30) > 0 ? 0.35 : 1) : 1;
    ctx.save();
    ctx.globalAlpha = blink;
    drawShip(ctx, p.x, p.y, p.angle, PALETTE.player, PALETTE.playerCore, 1, p.thrust);
    if (world.effects.shield > 0) {
      ctx.strokeStyle = 'rgba(90, 168, 255, 0.8)';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#5aa8ff';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 26 + Math.sin(time * 4) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
  world.particles.draw(ctx);
  ctx.restore();

  // HUD and overlays (no shake).
  if (world.state === 'playing' || world.state === 'paused') drawHUD(ctx, world);
  drawBanner(ctx, world);
  if (world.state === 'title') drawTitle(ctx, world, time);
  else if (world.state === 'paused') drawPaused(ctx);
  else if (world.state === 'gameover') drawGameOver(ctx, world);

  // Hit flash: a red vignette that fades.
  if (world.flash > 0) {
    const a = Math.min(0.5, world.flash * 1.4);
    const grad = ctx.createRadialGradient(
      FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.35,
      FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.75,
    );
    grad.addColorStop(0, 'rgba(255, 40, 60, 0)');
    grad.addColorStop(1, `rgba(255, 40, 60, ${a})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }
}
