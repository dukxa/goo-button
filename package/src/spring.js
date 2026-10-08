export const MAX_DELTA = .034;

const STEPS = 240;
const MAX_DAMPING = .9 * STEPS;

const REST_POS = 4e-4, REST_VEL = 2e-3;

// Apple-style spring, mass 1: stiffness = (2π / duration)², damping = 4π (1 − bounce) / duration
/** @param {number} duration @param {number} bounce @returns {{ stiffness: number, damping: number }} */
const appleSpring = (duration, bounce) => ({
  stiffness: (2 * Math.PI / duration) ** 2,
  damping: 4 * Math.PI * (1 - bounce) / duration,
});
const UI_SPRING = appleSpring(.5, .2);

/** @typedef {{ stiffness: number, damping: number }} MotionSpec */
/** @type {Record<'body' | 'move' | 'grow' | 'tip', MotionSpec>} */
export const MOTION = { body: UI_SPRING, move: UI_SPRING, grow: UI_SPRING, tip: UI_SPRING };

export class Spring {
  pos = 0; vel = 0; target = 0;
  stiffness = 0; damping = 0;
  /** @type {number | null} */ pending = null; pendingAt = 0;

  // no motion at all, for keyboard-driven state
  /** @param {number} target */
  jump(target) { this.target = this.pos = target; this.vel = 0; this.pending = null; }

  /** @param {number} target @param {number} delay @param {number} now */
  to(target, delay, now) {
    if (this.pending === target) return;
    if (this.pending === null && this.target === target) return;
    this.pending = target === this.target ? null : target;
    this.pendingAt = now + delay;
  }

  /** @param {number} now @param {number} delta @returns {boolean} */
  step(now, delta) {
    if (this.pending !== null && now >= this.pendingAt) { this.target = this.pending; this.pending = null; }
    const count = Math.max(1, Math.ceil(delta * STEPS)), substep = delta / count;
    const { stiffness } = this, damping = Math.min(MAX_DAMPING, this.damping);
    for (let i = 0; i < count; i++) { this.vel += (-stiffness * (this.pos - this.target) - damping * this.vel) * substep; this.pos += this.vel * substep; }
    if (this.pending !== null || Math.abs(this.pos - this.target) > REST_POS || Math.abs(this.vel) > REST_VEL) return true;
    this.pos = this.target; this.vel = 0; return false;
  }
}