// NOVA DRIFT — every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 14,
  accel: 2600,
  maxSpeed: 430,
  drag: 4.2,
  fireInterval: 0.14,
  bulletSpeed: 760,
  bulletRadius: 4,
  hull: 3,
  invulnerable: 1.6,
  /** Pixels the ship drifts back toward the centre when the player lets go. */
  recentre: 0,
};

/** Enemy bullets. */
export const ORB = { radius: 6, speed: 230, life: 6 };

/** Points per kill, before the combo multiplier. */
export const SCORE = {
  drone: 50,
  weaver: 100,
  splitter: 150,
  boss: 1000,
  shard: 10,
  waveClear: 250,
  waveClearPerWave: 50,
};

/** Combo: kills and pickups raise it; it decays after this many seconds without one. */
export const COMBO = { window: 3.5, perMultiplier: 10, maxMultiplier: 5 };

/** A wave's spawn budget grows with the wave number; costs are per enemy type. */
export const WAVE = {
  budgetBase: 6,
  budgetPerWave: 4,
  spawnInterval: 0.9,
  spawnIntervalMin: 0.3,
  bossEvery: 5,
  clearPause: 2.2,
};

/** Power-up drop chance per kill, and how long timed effects last. */
export const POWERUP = {
  dropChance: 0.12,
  duration: 12,
  shieldHits: 3,
  bombDamage: 5,
  bombStart: 1,
  bombMax: 3,
};

export const PALETTE = {
  bg: '#04060d',
  bg2: '#0a0f22',
  player: '#46e0ff',
  playerCore: '#eafcff',
  bullet: '#bdf3ff',
  shard: '#ffd75e',
  drone: '#ff4d9d',
  weaver: '#ffb02e',
  splitter: '#a78bff',
  boss: '#ff2e63',
  orb: '#ff7ad9',
  spread: '#59ffa0',
  rapid: '#ffe14d',
  shield: '#5aa8ff',
  bomb: '#ff5a5a',
  text: '#eaf2ff',
  muted: '#8b96b8',
  danger: '#ff5a6e',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'nova-drift.best';

/** How long the floating "WAVE N" banner and the hit flash last, in seconds. */
export const BANNER = { wave: 1.6, flash: 0.35 };
