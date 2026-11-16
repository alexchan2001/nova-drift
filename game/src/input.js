// Keyboard and pointer input. Held keys steer the ship and fire; one-shot presses
// (start, restart, pause, bomb, mute) are queued as bit flags and taken once by the
// loop, so a press between two frames is never lost and never counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;
export const ACTION_BOMB = 8;
export const ACTION_MUTE = 16;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const FIRE = new Set(['Space']);
const CONFIRM = new Set(['Enter']);
const RESTART = new Set(['KeyR']);
const PAUSE = new Set(['KeyP', 'Escape']);
const BOMB = new Set(['KeyQ']);
const MUTE = new Set(['KeyM']);

export function createInput(canvas) {
  const keys = new Set();
  let mouseX = 640;
  let mouseY = 360;
  let mouseDown = false;
  let actions = 0;
  // The view transform (scale + letterbox offset) the renderer computes; the
  // mouse position is mapped through it into logical playfield coordinates.
  let view = { scale: 1, ox: 0, oy: 0 };

  function press(code) {
    if (CONFIRM.has(code)) actions |= ACTION_CONFIRM;
    else if (RESTART.has(code)) actions |= ACTION_RESTART;
    else if (PAUSE.has(code)) actions |= ACTION_PAUSE;
    else if (BOMB.has(code)) actions |= ACTION_BOMB;
    else if (MUTE.has(code)) actions |= ACTION_MUTE;
  }

  window.addEventListener('keydown', (event) => {
    if (
      UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) ||
      RIGHT.has(event.code) || FIRE.has(event.code) || CONFIRM.has(event.code) ||
      RESTART.has(event.code) || PAUSE.has(event.code) || BOMB.has(event.code) ||
      MUTE.has(event.code)
    ) {
      if (!event.repeat) press(event.code);
      keys.add(event.code);
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    keys.clear();
    mouseDown = false;
  });

  function updateMouse(event) {
    const rect = canvas.getBoundingClientRect();
    mouseX = (event.clientX - rect.left - view.ox) / view.scale;
    mouseY = (event.clientY - rect.top - view.oy) / view.scale;
  }
  canvas.addEventListener('pointermove', updateMouse);
  canvas.addEventListener('pointerdown', (event) => {
    updateMouse(event);
    if (event.button === 2) {
      actions |= ACTION_BOMB;
    } else {
      mouseDown = true;
      actions |= ACTION_CONFIRM;
    }
    event.preventDefault();
  });
  window.addEventListener('pointerup', (event) => {
    if (event.button !== 2) mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    /** Update the view transform (from render.computeView) after a resize. */
    setView(next) {
      view = next;
    },
    /** -1/0/1 on each axis from the held movement keys. */
    moveX() {
      let x = 0;
      for (const code of keys) {
        if (RIGHT.has(code)) x += 1;
        if (LEFT.has(code)) x -= 1;
      }
      return Math.max(-1, Math.min(1, x));
    },
    moveY() {
      let y = 0;
      for (const code of keys) {
        if (DOWN.has(code)) y += 1;
        if (UP.has(code)) y -= 1;
      }
      return Math.max(-1, Math.min(1, y));
    },
    /** True while the fire key or the mouse button is held. */
    firing() {
      for (const code of keys) if (FIRE.has(code)) return true;
      return mouseDown;
    },
    /** The mouse position in logical playfield coordinates. */
    aim() {
      return { x: mouseX, y: mouseY };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
