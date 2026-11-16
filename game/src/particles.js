// Particles, floating score texts and screen shake. One fixed pool, allocated once
// at boot, so the game never allocates while it runs.

import { FIELD } from './config.js';

const MAX_PARTICLES = 420;
const MAX_TEXTS = 24;

export function createParticles() {
  const pool = [];
  for (let i = 0; i < MAX_PARTICLES; i++) {
    pool.push({ alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#fff', drag: 0, glow: true });
  }
  const texts = [];
  for (let i = 0; i < MAX_TEXTS; i++) {
    texts.push({ alive: false, x: 0, y: 0, vy: 0, life: 0, maxLife: 1, text: '', color: '#fff', size: 16 });
  }
  let trauma = 0;

  function spawn(x, y, vx, vy, life, size, color, drag = 2, glow = true) {
    for (const p of pool) {
      if (p.alive) continue;
      p.alive = true;
      p.x = x;
      p.y = y;
      p.vx = vx;
      p.vy = vy;
      p.life = life;
      p.maxLife = life;
      p.size = size;
      p.color = color;
      p.drag = drag;
      p.glow = glow;
      return;
    }
  }

  return {
    /** A radial burst of sparks. */
    burst(x, y, color, count = 18, speed = 260, life = 0.6, size = 3) {
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + Math.random() * 0.5;
        const v = speed * (0.35 + Math.random() * 0.65);
        spawn(x, y, Math.cos(a) * v, Math.sin(a) * v, life * (0.6 + Math.random() * 0.6), size * (0.6 + Math.random() * 0.8), color);
      }
    },
    /** A soft expanding ring, for explosions and pickups. */
    ring(x, y, color, count = 10, speed = 180) {
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        spawn(x, y, Math.cos(a) * speed, Math.sin(a) * speed, 0.45, 2.5, color, 1.2);
      }
    },
    /** A short thruster spark behind the ship. */
    trail(x, y, vx, vy, color) {
      spawn(x, y, vx * 0.3 + (Math.random() - 0.5) * 40, vy * 0.3 + (Math.random() - 0.5) * 40, 0.3, 2, color, 3, false);
    },
    /** A muzzle flash at the ship's nose. */
    flash(x, y, color) {
      spawn(x, y, 0, 0, 0.08, 7, color, 0);
    },
    /** Floating score text that rises and fades. */
    text(x, y, str, color, size = 16) {
      for (const t of texts) {
        if (t.alive) continue;
        t.alive = true;
        t.x = x;
        t.y = y;
        t.vy = -46;
        t.life = 0.9;
        t.maxLife = 0.9;
        t.text = str;
        t.color = color;
        t.size = size;
        return;
      }
    },
    /** Add trauma (0..1); the shake decays on its own. */
    shake(amount) {
      trauma = Math.min(1, trauma + amount);
    },
    update(dt) {
      trauma = Math.max(0, trauma - dt * 1.6);
      for (const p of pool) {
        if (!p.alive) continue;
        p.life -= dt;
        if (p.life <= 0) {
          p.alive = false;
          continue;
        }
        const d = Math.max(0, 1 - p.drag * dt);
        p.vx *= d;
        p.vy *= d;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
      for (const t of texts) {
        if (!t.alive) continue;
        t.life -= dt;
        if (t.life <= 0) {
          t.alive = false;
          continue;
        }
        t.y += t.vy * dt;
      }
    },
    /** The current shake offset, applied to the whole scene. */
    offset() {
      if (trauma <= 0) return { x: 0, y: 0 };
      const s = trauma * trauma * 14;
      return {
        x: (Math.random() * 2 - 1) * s,
        y: (Math.random() * 2 - 1) * s,
      };
    },
    draw(ctx) {
      for (const p of pool) {
        if (!p.alive) continue;
        const a = Math.max(0, p.life / p.maxLife);
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        if (p.glow) {
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 8;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.5 + a * 0.5), 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      ctx.globalAlpha = 1;
      for (const t of texts) {
        if (!t.alive) continue;
        const a = Math.max(0, t.life / t.maxLife);
        ctx.globalAlpha = a;
        ctx.fillStyle = t.color;
        ctx.font = `bold ${t.size}px ${'system-ui, sans-serif'}`;
        ctx.textAlign = 'center';
        ctx.fillText(t.text, t.x, t.y);
      }
      ctx.globalAlpha = 1;
    },
    clear() {
      for (const p of pool) p.alive = false;
      for (const t of texts) t.alive = false;
      trauma = 0;
    },
  };
}

/** A starfield in three parallax layers, drawn from a seeded layout. */
export function createStarfield(random) {
  const layers = [];
  for (let depth = 0; depth < 3; depth++) {
    const stars = [];
    const count = [70, 46, 26][depth];
    for (let i = 0; i < count; i++) {
      stars.push({
        x: random() * FIELD.width,
        y: random() * FIELD.height,
        r: [0.8, 1.4, 2.1][depth] * (0.7 + random() * 0.6),
        tw: random() * Math.PI * 2,
        ts: 0.6 + random() * 1.8,
      });
    }
    layers.push({ stars, speed: [6, 14, 26][depth] });
  }
  // A few soft nebula blobs, fixed in place.
  const nebulae = [
    { x: 220, y: 150, r: 260, color: 'rgba(64, 40, 140, 0.20)' },
    { x: 1080, y: 560, r: 300, color: 'rgba(20, 90, 120, 0.16)' },
    { x: 900, y: 120, r: 200, color: 'rgba(140, 40, 90, 0.12)' },
    { x: 350, y: 600, r: 220, color: 'rgba(30, 60, 140, 0.14)' },
  ];
  return {
    draw(ctx, time, scrollX, scrollY) {
      for (const n of nebulae) {
        const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
        g.addColorStop(0, n.color);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
      }
      for (const layer of layers) {
        for (const s of layer.stars) {
          const x = (((s.x - scrollX * layer.speed) % FIELD.width) + FIELD.width) % FIELD.width;
          const y = (((s.y - scrollY * layer.speed) % FIELD.height) + FIELD.height) % FIELD.height;
          const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * s.ts + s.tw));
          ctx.globalAlpha = a;
          ctx.fillStyle = '#dfe9ff';
          ctx.beginPath();
          ctx.arc(x, y, s.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    },
  };
}
