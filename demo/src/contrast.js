// package/src/contrast.js
var clamp = (value, min, max) => Math.min(max, Math.max(min, value));
var toLinearSrgb = ([lightness, chroma, hue]) => {
  const labA = chroma * Math.cos(hue * Math.PI / 180), labB = chroma * Math.sin(hue * Math.PI / 180);
  const [long, medium, short] = [
    lightness + 0.3963377774 * labA + 0.2158037573 * labB,
    lightness - 0.1055613458 * labA - 0.0638541728 * labB,
    lightness - 0.0894841775 * labA - 1.291485548 * labB
  ].map((cone) => cone ** 3);
  return (
    /** @type {[number, number, number]} */
    [
      4.0767416621 * long - 3.3077115913 * medium + 0.2309699292 * short,
      -1.2684380046 * long + 2.6097574011 * medium - 0.3413193965 * short,
      -0.0041960863 * long - 0.7034186147 * medium + 1.707614701 * short
    ].map((channel) => clamp(channel, 0, 1))
  );
};
var luminance = (oklch) => {
  const [red, green, blue] = toLinearSrgb(oklch);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};
var contrastFromLuminances = (luminanceA, luminanceB) => {
  const [lighter, darker] = [luminanceA, luminanceB].sort((first, second) => second - first);
  return (lighter + 0.05) / (darker + 0.05);
};
var contrastRatio = (a, b) => contrastFromLuminances(luminance(a), luminance(b));
function clampLightnessForLuminance(oklch, againstLuminance, minRatio) {
  let [lightness, chroma, hue] = oklch;
  const ratioOf = (l) => contrastFromLuminances(luminance([l, chroma, hue]), againstLuminance);
  if (ratioOf(lightness) >= minRatio) return [lightness, chroma, hue];
  const towardWhite = contrastFromLuminances(1, againstLuminance) >= contrastFromLuminances(0, againstLuminance);
  const step = towardWhite ? 0.01 : -0.01;
  for (let i = 0; i < 100 && lightness >= 0 && lightness <= 1; i++) {
    lightness += step;
    if (ratioOf(lightness) >= minRatio) break;
  }
  return [clamp(lightness, 0, 1), chroma, hue];
}
var clampLightnessForContrast = (oklch, against, minRatio) => clampLightnessForLuminance(oklch, luminance(against), minRatio);
var OKLCH = /^oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)\s*\)$/i;
function parseOklch(css) {
  const match = OKLCH.exec(css.trim());
  if (!match) return null;
  const lightness = match[1].endsWith("%") ? parseFloat(match[1]) / 100 : parseFloat(match[1]);
  return [lightness, parseFloat(match[2]), parseFloat(match[3])];
}
var formatOklch = ([lightness, chroma, hue]) => `oklch(${+lightness.toFixed(4)} ${+chroma.toFixed(4)} ${+hue.toFixed(4)})`;
var probe = null;
var toSrgbLuminance = (rgb) => {
  const match = /^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/.exec(rgb);
  if (!match) return null;
  const [r, g, b] = [match[1], match[2], match[3]].map((channel) => {
    const unit = parseFloat(channel) / 255;
    return unit <= 0.04045 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
function resolvedLuminance(css) {
  if (typeof document === "undefined") return null;
  if (!probe) {
    probe = document.createElement("span");
    probe.style.cssText = "position:fixed;inset:0;width:0;height:0;visibility:hidden;pointer-events:none;";
  }
  if (!probe.isConnected) document.body?.append(probe);
  probe.style.color = "rgb(1 2 3)";
  probe.style.color = css;
  const result = getComputedStyle(probe).color;
  probe.style.color = "rgb(254 253 252)";
  probe.style.color = css;
  if (getComputedStyle(probe).color !== result) return null;
  return toSrgbLuminance(result);
}
export {
  clampLightnessForContrast,
  clampLightnessForLuminance,
  contrastFromLuminances,
  contrastRatio,
  formatOklch,
  luminance,
  parseOklch,
  resolvedLuminance,
  toLinearSrgb
};
