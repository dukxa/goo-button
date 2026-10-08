import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_DELTA, MOTION, Spring } from '../package/src/spring.js';

const createSpring = (stiffness, damping) => Object.assign(new Spring(), { stiffness, damping });
const run = (spring, seconds, delta = 1 / 60) => {
  let now = 0, peak = 0;
  for (let time = 0; time < seconds; time += delta) { now += delta * 1000; spring.step(now, delta); peak = Math.max(peak, Math.abs(spring.pos)); }
  return peak;
};

test('a spring settles exactly on its target', () => {
  const spring = createSpring(38, 5.2);
  spring.to(1, 0, 0);
  run(spring, 8);
  assert.equal(spring.pos, 1);
  assert.equal(spring.vel, 0);
});

test('a retarget waits for its delay', () => {
  const spring = createSpring(38, 5.2);
  spring.to(1, 200, 0);
  run(spring, .15);
  assert.equal(spring.pos, 0);
  run(spring, 8);
  assert.equal(spring.pos, 1);
});

test('stays finite and bounded over the whole documented stiffness and damping range', () => {
  const maxStiffness = Math.max(...Object.values(MOTION).map(({ stiffness }) => stiffness));
  const maxDamping = Math.max(...Object.values(MOTION).map(({ damping }) => damping));
  for (const calm of [false, true])
    for (const stiffnessScale of [.1, 1, 3, 10])
      for (const dampingScale of [.1, 1, 3, 5, 10])
        for (const delta of [1 / 240, 1 / 144, 1 / 60, MAX_DELTA]) {
          const stiffness = maxStiffness * stiffnessScale;
          const damping = (calm ? 2 * Math.sqrt(stiffness) : maxDamping) * dampingScale;
          const spring = createSpring(MOTION.tip.stiffness * stiffnessScale, damping);
          spring.to(1, 0, 0);
          let peak = run(spring, 2, delta);
          spring.to(0, 0, 0);
          peak = Math.max(peak, run(spring, 2, delta));
          assert.ok(Number.isFinite(peak) && peak < 3, `calm=${calm} stiffness=${stiffnessScale} damping=${dampingScale} delta=${delta}: peak ${peak}`);
        }
});

test('the UI spring is the 0.5 s, bounce 0.2 Apple-style spring', () => {
  const { stiffness, damping } = MOTION.body;
  assert.ok(Math.abs(stiffness - 157.91) < .01);
  assert.ok(Math.abs(damping - 20.11) < .01);
});

test('jump lands on the target at once and stops', () => {
  const spring = createSpring(38, 5.2);
  spring.to(1, 200, 0);
  spring.jump(1);
  assert.equal(spring.pos, 1);
  assert.equal(spring.vel, 0);
  assert.equal(spring.pending, null);
  assert.equal(spring.step(16, 1 / 60), false);
});

test('retargeting to the same target keeps the pending delay', () => {
  const spring = createSpring(38, 5.2);
  spring.to(1, 200, 0);
  spring.to(1, 200, 150);
  run(spring, .1);
  assert.equal(spring.pos, 0);
  spring.step(210, 1 / 60);
  assert.equal(spring.target, 1);
});

test('retargeting back to the current target cancels a pending change', () => {
  const spring = createSpring(38, 5.2);
  spring.to(1, 0, 0);
  run(spring, 8);
  spring.to(0, 300, 0);
  spring.to(1, 0, 10);
  assert.equal(spring.pending, null);
  assert.equal(spring.step(400, 1 / 60), false);
});