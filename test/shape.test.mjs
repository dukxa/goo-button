import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clamp, neckPath, ringPath } from '../package/src/shape.js';

const HEIGHT = 60, RADIUS = HEIGHT / 2, WIDTH = 160, CAP_X = WIDTH - RADIUS;
const geometry = (move, grow, reach = 0.72) => ({ height: HEIGHT, radius: RADIUS, capX: CAP_X, dropX: CAP_X + HEIGHT * 1.16 * move, dropRadius: RADIUS * grow, reach: HEIGHT * reach });
const isFinitePath = (path) => !/NaN|Infinity/.test(path);

test('clamp keeps a value inside its range', () => {
  assert.equal(clamp(5, 0, 1), 1);
  assert.equal(clamp(-5, 0, 1), 0);
  assert.equal(clamp(.4, 0, 1), .4);
});

test('no neck without a drop, past reach, or with reach 0', () => {
  assert.equal(neckPath(geometry(0, 0)), '');
  assert.equal(neckPath(geometry(3, 1)), '');
  assert.equal(neckPath(geometry(.5, 1, 0)), '');
});

test('at rest the drop still hangs on a thin neck', () => {
  assert.match(neckPath(geometry(1, 1)), /^M.*Z$/);
});

test('neck exists mid-flight and is a closed path', () => {
  const path = neckPath(geometry(.6, 1));
  assert.match(path, /^M.*Z$/);
  assert.ok(isFinitePath(path));
});

test('neck and ring stay finite across the whole motion and every reach', () => {
  for (const reach of [0, .1, .72, 2, 4])
    for (let move = 0; move <= 1.2; move += .05)
      for (let grow = 0; grow <= 1.2; grow += .1)
        for (const offset of [0, .5, 6, 32]) {
          const shape = geometry(move, grow, reach);
          assert.ok(isFinitePath(neckPath(shape)), `neck ${JSON.stringify(shape)}`);
          assert.ok(isFinitePath(ringPath(shape, offset)), `ring ${JSON.stringify(shape)} offset=${offset}`);
        }
});

test('ring is one stadium before the drop and two shapes once it separates', () => {
  assert.equal((ringPath(geometry(0, 0), 6).match(/M/g) || []).length, 1);
  assert.equal((ringPath(geometry(1, 1), 2).match(/M/g) || []).length, 2);
});