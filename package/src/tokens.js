import { clamp } from './shape.js';

/** @typedef {'body' | 'move' | 'grow' | 'tip'} DrivenName */
export const DRIVEN = /** @type {DrivenName[]} */ (['body', 'move', 'grow', 'tip']);

/** @type {Record<'open' | 'close', Record<DrivenName, number>>} */
export const DELAY = {
  open:  { body: 0,  move: 40, grow: 80, tip: 120 },
  close: { body: 80, move: 40, grow: 0,  tip: 0 },
};

/** @type {Record<string, { unit?: string, check?: string[], number?: [number, number] }>} */
export const SPEC = {
  'text-size':    { unit: 'rem', check: ['font-size'] },
  'padding-x':    { number: [0, 8] },
  'padding-y':    { number: [0, 8] },
  'icon-size':    { number: [0, 4] },
  gap:            { number: [0, 2] },
  'neck-reach':   { number: [0, 4] },
  'focus-offset': { number: [0, 2] },
  'press-scale':  { number: [0.5, 1.5] },
  'press-time':   { unit: 's', check: ['transition-duration'] },
  'focus-width':  { unit: 'rem', check: ['stroke-width'] },
  'fill-color':   { check: ['color'] },
  'text-color':   { check: ['color'] },
};
export const GEOMETRY_TOKENS = new Set(['gap', 'neck-reach', 'focus-offset', 'icon-size']);
/** @type {Record<'delay' | 'stiffness' | 'damping', [number, number, number]>} */
export const OPTIONS = { delay: [0, 0, 5000], stiffness: [1, .1, 10], damping: [.5, .1, 10] };
// booleans, same family as `open`: presence toggles them, there's no CSS custom property
export const BOOLEAN_ATTRS = ['open', 'wcag-color'];
export const DATA_ATTRS = [...Object.keys(SPEC), ...Object.keys(OPTIONS), ...BOOLEAN_ATTRS].map((name) => `data-goo-${name}`);

// FIXME: denylist, not a parser, a future css function that fetches (like cross-fade() some day) slips through until added here
const UNSAFE = /url\(|image-set\(|expression\(|\/\*|[;{}<>\\]/i;
const PLAIN_NUMBER = /^-?\d*\.?\d+$/;

/** @param {CSSStyleDeclaration} style @param {string} name @param {number} fallback @param {number} min @param {number} max @returns {number} */
export const readToken = (style, name, fallback, min, max) => {
  const num = parseFloat(style.getPropertyValue(name));
  return Number.isFinite(num) ? clamp(num, min, max) : fallback;
};

/** @param {string} name @param {string} raw @returns {string | null} */
export const parseValue = (name, raw) => {
  const value = raw.trim(), spec = SPEC[name];
  if (!value || value.length > 120 || !spec || UNSAFE.test(value)) return null;
  if (spec.number) return PLAIN_NUMBER.test(value) ? String(clamp(parseFloat(value), spec.number[0], spec.number[1])) : null;
  const css = PLAIN_NUMBER.test(value) ? value + (spec.unit ?? '') : value;
  return (spec.check ?? []).every((prop) => CSS.supports(prop, css)) ? css : null;
};