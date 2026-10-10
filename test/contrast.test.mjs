import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampLightnessForContrast, clampLightnessForLuminance, contrastFromLuminances, contrastRatio, formatOklch, luminance, parseOklch } from '../package/src/contrast.js';

// minimal CSSOM shim: a real `style.color` setter silently keeps its old value for anything it
// can't parse, and otherwise normalizes to `rgb(r, g, b)` — just enough of that to exercise
// resolvedLuminance's two-sentinel-reset trick honestly, without a browser
const NAMED = { red: 'rgb(255, 0, 0)', black: 'rgb(0, 0, 0)', white: 'rgb(255, 255, 255)', currentcolor: 'INHERITED' };
function installFakeDom(inheritedColor = 'rgb(10, 10, 10)') {
  let bodyChildren = [];
  class FakeElement {
    style = { _color: '', set color(value) { const resolved = resolveCss(value); if (resolved !== null) this._color = resolved; }, get color() { return this._color; } };
    isConnected = false;
  }
  function resolveCss(value) {
    const trimmed = value.trim().toLowerCase();
    if (trimmed === 'currentcolor') return inheritedColor;
    if (trimmed in NAMED) return NAMED[trimmed];
    const hex = /^#([0-9a-f]{6})$/.exec(trimmed);
    if (hex) { const n = hex[1]; return `rgb(${parseInt(n.slice(0, 2), 16)}, ${parseInt(n.slice(2, 4), 16)}, ${parseInt(n.slice(4, 6), 16)})`; }
    const rgb = /^rgba?\((\d+)[\s,]+(\d+)[\s,]+(\d+)/.exec(trimmed);
    if (rgb) return `rgb(${rgb[1]}, ${rgb[2]}, ${rgb[3]})`;
    return null; // anything else (garbage, oklch, light-dark()) is left as whatever was already set
  }
  global.document = { createElement: () => new FakeElement(), body: { append: (el) => { bodyChildren.push(el); el.isConnected = true; } } };
  global.getComputedStyle = (el) => ({ color: el.style.color });
}
function uninstallFakeDom() { delete global.document; delete global.getComputedStyle; }

const WHITE = /** @type {[number, number, number]} */ ([1, 0, 0]);
const BLACK = /** @type {[number, number, number]} */ ([0, 0, 0]);

test('luminance of white and black are the WCAG extremes', () => {
  assert.ok(Math.abs(luminance(WHITE) - 1) < 1e-6);
  assert.ok(Math.abs(luminance(BLACK)) < 1e-6);
});

test('contrastRatio of white on black is 21:1, and is order independent', () => {
  assert.ok(Math.abs(contrastRatio(WHITE, BLACK) - 21) < 1e-6);
  assert.equal(contrastRatio(WHITE, BLACK), contrastRatio(BLACK, WHITE));
});

test('contrastRatio of a color against itself is 1:1', () => {
  const color = /** @type {[number, number, number]} */ ([0.5, 0.1, 140]);
  assert.ok(Math.abs(contrastRatio(color, color) - 1) < 1e-6);
});

test('contrastFromLuminances matches contrastRatio for the achromatic case', () => {
  assert.ok(Math.abs(contrastFromLuminances(luminance(WHITE), luminance(BLACK)) - 21) < 1e-6);
});

test('clampLightnessForContrast leaves an already-passing color untouched', () => {
  const passing = /** @type {[number, number, number]} */ ([0.2, 0.04, 200]);
  const [lightness] = clampLightnessForContrast(passing, WHITE, 4.5);
  assert.equal(lightness, passing[0]);
});

test('clampLightnessForContrast pushes a failing color toward the passing side, not away from it', () => {
  // mid-gray-ish blue against near-white text: too close, needs to go darker, not lighter
  const failing = /** @type {[number, number, number]} */ ([0.75, 0.1, 250]);
  const against = /** @type {[number, number, number]} */ ([0.97, 0, 0]);
  const before = contrastRatio(failing, against);
  const fixed = clampLightnessForContrast(failing, against, 4.5);
  assert.ok(contrastRatio(fixed, against) >= 4.5, 'clamp should reach the target ratio');
  assert.ok(fixed[0] < failing[0], 'should move darker, away from a lighter target');
  assert.ok(before < 4.5, 'fixture should start out failing');
});

test('clampLightnessForContrast never changes chroma or hue', () => {
  const failing = /** @type {[number, number, number]} */ ([0.75, 0.1, 250]);
  const [, chroma, hue] = clampLightnessForContrast(failing, [0.97, 0, 0], 4.5);
  assert.equal(chroma, 0.1);
  assert.equal(hue, 250);
});

test('clampLightnessForContrast on a color already on the correct side only pushes further that way', () => {
  // dark fill against a white page: already on the dark side, should go darker still if needed, never flip to light
  const darkFill = /** @type {[number, number, number]} */ ([0.3, 0.05, 200]);
  const fixed = clampLightnessForLuminance(darkFill, luminance(WHITE), 3);
  assert.ok(fixed[0] <= darkFill[0] + 1e-9);
});

test('clampLightnessForLuminance flips a color to the opposite end when it starts on the same side as its target, instead of chasing that side to its limit', () => {
  // both near-white: pushing "further the same way it's already leaning" only runs both into L=1 and never separates them
  const text = /** @type {[number, number, number]} */ ([0.97, 0, 0]);
  const fill = /** @type {[number, number, number]} */ ([1, 0.005, 200]);
  const fixed = clampLightnessForLuminance(text, luminance(fill), 4.5);
  assert.ok(contrastFromLuminances(luminance(fixed), luminance(fill)) >= 4.5);
  assert.ok(fixed[0] < 0.9, 'should have moved to the dark side, not stayed pinned near 1');

  // same shape, both near-black
  const textDark = /** @type {[number, number, number]} */ ([0.15, 0, 0]);
  const fillDark = /** @type {[number, number, number]} */ ([0.1, 0.03, 200]);
  const fixedDark = clampLightnessForLuminance(textDark, luminance(fillDark), 4.5);
  assert.ok(contrastFromLuminances(luminance(fixedDark), luminance(fillDark)) >= 4.5);
  assert.ok(fixedDark[0] > 0.1, 'should have moved to the light side, not stayed pinned near 0');
});

test('clampLightnessForLuminance is idempotent: reapplying its own output does not drift or oscillate', () => {
  // simulates what happens when a slider drag re-triggers the clamp on every step against an
  // already-adjusted color — the fixed point must be stable, not walk toward a bound over time
  let text = /** @type {[number, number, number]} */ ([0.97, 0, 0]);
  const fill = /** @type {[number, number, number]} */ ([1, 0.005, 200]);
  const first = clampLightnessForLuminance(text, luminance(fill), 4.5);
  let settled = first;
  for (let i = 0; i < 50; i++) settled = clampLightnessForLuminance(settled, luminance(fill), 4.5);
  assert.deepEqual(settled, first);
});

test('clampLightnessForLuminance can bottom out at 0 or top out at 1 without going out of range', () => {
  // impossible target ratio forces the loop to its lightness bound
  const [lightness] = clampLightnessForLuminance([0.5, 0.3, 0], 0.5, 100);
  assert.ok(lightness >= 0 && lightness <= 1);
});

test('parseOklch round-trips what formatOklch writes', () => {
  const oklch = /** @type {[number, number, number]} */ ([0.55, 0.22, 27]);
  assert.deepEqual(parseOklch(formatOklch(oklch)), oklch);
});

test('parseOklch accepts a percent lightness', () => {
  assert.deepEqual(parseOklch('oklch(55% 0.22 27)'), [0.55, 0.22, 27]);
});

test('parseOklch rejects anything that is not oklch(...)', () => {
  assert.equal(parseOklch('#ff0000'), null);
  assert.equal(parseOklch('rgb(255 0 0)'), null);
  assert.equal(parseOklch('red'), null);
  assert.equal(parseOklch('light-dark(white, black)'), null);
});

test('resolvedLuminance resolves a named color, hex and rgb() for the same color to the same luminance', async () => {
  installFakeDom();
  try {
    const { resolvedLuminance } = await import('../package/src/contrast.js?fake-dom-1');
    const red = resolvedLuminance('red'), hex = resolvedLuminance('#ff0000'), rgb = resolvedLuminance('rgb(255, 0, 0)');
    assert.ok(red !== null && hex !== null && rgb !== null);
    assert.ok(Math.abs(red - hex) < 1e-9);
    assert.ok(Math.abs(hex - rgb) < 1e-9);
    assert.ok(red > 0 && red < 1);
  } finally { uninstallFakeDom(); }
});

test('resolvedLuminance returns null for a string the CSSOM silently rejects', async () => {
  installFakeDom();
  try {
    const { resolvedLuminance } = await import('../package/src/contrast.js?fake-dom-2');
    assert.equal(resolvedLuminance('not-a-color'), null);
    assert.equal(resolvedLuminance('oklch(0.5 0.1 200)'), null); // this fake CSSOM doesn't parse oklch, same as an unsupported browser wouldn't
  } finally { uninstallFakeDom(); }
});

test('resolvedLuminance resolves currentcolor to the inherited color', async () => {
  installFakeDom('rgb(20, 40, 60)');
  try {
    const { resolvedLuminance } = await import('../package/src/contrast.js?fake-dom-3');
    const resolved = resolvedLuminance('currentcolor');
    assert.notEqual(resolved, null);
  } finally { uninstallFakeDom(); }
});
