/** @typedef {[lightness: number, chroma: number, hue: number]} Oklch */

// kept local (not imported from shape.js) so this module has no dependency on the SVG geometry
// code and can be reused on its own, e.g. by the demo's accent swatch
/** @param {number} value @param {number} min @param {number} max @returns {number} */
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// oklch -> linear sRGB, then WCAG relative luminance. Same matrices as the CSS Color 4 spec.
/** @param {Oklch} oklch @returns {[number, number, number]} */
export const toLinearSrgb = ([lightness, chroma, hue]) => {
  const labA = chroma * Math.cos(hue * Math.PI / 180), labB = chroma * Math.sin(hue * Math.PI / 180);
  const [long, medium, short] = [
    lightness + 0.3963377774 * labA + 0.2158037573 * labB,
    lightness - 0.1055613458 * labA - 0.0638541728 * labB,
    lightness - 0.0894841775 * labA - 1.2914855480 * labB,
  ].map((cone) => cone ** 3);
  return /** @type {[number, number, number]} */ ([
    4.0767416621 * long - 3.3077115913 * medium + 0.2309699292 * short,
    -1.2684380046 * long + 2.6097574011 * medium - 0.3413193965 * short,
    -0.0041960863 * long - 0.7034186147 * medium + 1.7076147010 * short,
  ].map((channel) => clamp(channel, 0, 1)));
};

/** @param {Oklch} oklch @returns {number} */
export const luminance = (oklch) => {
  const [red, green, blue] = toLinearSrgb(oklch);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

/** WCAG contrast ratio between two already-resolved relative luminances. @param {number} luminanceA @param {number} luminanceB @returns {number} */
export const contrastFromLuminances = (luminanceA, luminanceB) => {
  const [lighter, darker] = [luminanceA, luminanceB].sort((first, second) => second - first);
  return (lighter + 0.05) / (darker + 0.05);
};

/** WCAG contrast ratio between two oklch colors, always >= 1. @param {Oklch} a @param {Oklch} b @returns {number} */
export const contrastRatio = (a, b) => contrastFromLuminances(luminance(a), luminance(b));

/**
 * Nudges an oklch color's lightness toward 0 or 1 until its luminance clears `minRatio` against
 * `againstLuminance`, or until lightness hits its bound.
 *
 * Direction is picked by which end (black or white) can actually reach the ratio against
 * `against`, not by where the color itself currently sits: a color sitting on the same side as
 * `against` has no contrast to gain by going further that way (it only gets closer to merging
 * with it), so it's moved to the opposite end instead. This matters once this runs on every
 * change: a color nudged one step closer to its target's side must not then read that one step
 * as "this is my side, keep going", or the two converge instead of separating. White (L=1) always
 * reaches the highest ratio available against anything that isn't itself white, and black (L=0)
 * the same against anything that isn't black, so the color moves toward whichever of those two
 * is actually farther from `against` right now.
 * @param {Oklch} oklch @param {number} againstLuminance @param {number} minRatio @returns {Oklch}
 */
export function clampLightnessForLuminance(oklch, againstLuminance, minRatio) {
  let [lightness, chroma, hue] = oklch;
  /** @param {number} l */
  const ratioOf = (l) => contrastFromLuminances(luminance([l, chroma, hue]), againstLuminance);
  if (ratioOf(lightness) >= minRatio) return [lightness, chroma, hue];
  // contrast against white vs. against black, from `against`'s own luminance — whichever is bigger is reachable
  const towardWhite = contrastFromLuminances(1, againstLuminance) >= contrastFromLuminances(0, againstLuminance);
  const step = towardWhite ? 0.01 : -0.01;
  for (let i = 0; i < 100 && lightness >= 0 && lightness <= 1; i++) {
    lightness += step;
    if (ratioOf(lightness) >= minRatio) break;
  }
  return [clamp(lightness, 0, 1), chroma, hue];
}

/**
 * Nudges an oklch color's lightness toward 0 or 1 (away from `against`) until it clears
 * `minRatio` against `against`, or until lightness hits its bound.
 * @param {Oklch} oklch @param {Oklch} against @param {number} minRatio @returns {Oklch}
 */
export const clampLightnessForContrast = (oklch, against, minRatio) => clampLightnessForLuminance(oklch, luminance(against), minRatio);

const OKLCH = /^oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)\s*\)$/i;

/** Parses a CSS `oklch(L C H)` string (the form this module itself writes). Returns null for anything else,
 * including valid CSS colors in other notations (hex, rgb, named, light-dark(), ...) — those aren't our concern
 * to adjust, only to flag. @param {string} css @returns {Oklch | null} */
export function parseOklch(css) {
  const match = OKLCH.exec(css.trim());
  if (!match) return null;
  const lightness = match[1].endsWith('%') ? parseFloat(match[1]) / 100 : parseFloat(match[1]);
  return [lightness, parseFloat(match[2]), parseFloat(match[3])];
}

/** @param {Oklch} oklch @returns {string} */
export const formatOklch = ([lightness, chroma, hue]) => `oklch(${+lightness.toFixed(4)} ${+chroma.toFixed(4)} ${+hue.toFixed(4)})`;

/** @type {HTMLElement | null} */
let probe = null;

const toSrgbLuminance = (/** @type {string} */ rgb) => {
  const match = /^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/.exec(rgb);
  if (!match) return null;
  const [r, g, b] = [match[1], match[2], match[3]].map((channel) => {
    const unit = parseFloat(channel) / 255;
    return unit <= 0.04045 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/**
 * Resolves any valid, already-accepted CSS color (hex, rgb(), named, ...) to a WCAG relative
 * luminance via the browser's own color parsing, so the wcag-color warning works for formats this
 * module doesn't parse itself. Returns null for a color that can't be resolved to concrete sRGB
 * (a `light-dark()`/`currentcolor` reference, or an invalid string the browser silently rejects)
 * — there's nothing fixed to check in either case.
 * @param {string} css @returns {number | null}
 */
export function resolvedLuminance(css) {
  if (typeof document === 'undefined') return null;
  if (!probe) { probe = document.createElement('span'); probe.style.cssText = 'position:fixed;inset:0;width:0;height:0;visibility:hidden;pointer-events:none;'; }
  if (!probe.isConnected) document.body?.append(probe);
  // setting an unparsable value is a no-op in CSSOM, it leaves the property exactly as it was —
  // so two different sentinel resets that both end up reading back as `css` means it never applied
  probe.style.color = 'rgb(1 2 3)';
  probe.style.color = css;
  const result = getComputedStyle(probe).color;
  probe.style.color = 'rgb(254 253 252)';
  probe.style.color = css;
  if (getComputedStyle(probe).color !== result) return null; // didn't resolve to the same concrete color both times -> css was never applied
  return toSrgbLuminance(result);
}
