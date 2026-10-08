// usage: node tools/analysis/browser-support.mjs [--json]

import caniuse from 'caniuse-lite';
import bcd from '@mdn/browser-compat-data' with { type: 'json' };

const { feature, features } = caniuse;

const TRACKED_BROWSERS = ['chrome', 'edge', 'firefox', 'safari', 'ios_saf', 'android', 'samsung'];
// caniuse id -> bcd id, where they differ
const BCD_BROWSER_ID = { ios_saf: 'safari_ios', android: 'webview_android', samsung: 'samsunginternet_android' };
const nameFor = { chrome: 'Chrome', edge: 'Edge', firefox: 'Firefox', safari: 'Safari (macOS)', ios_saf: 'Safari (iOS)', android: 'Android Browser', samsung: 'Samsung Internet' };

// COMPONENT_* feeds the readme number, DEMO_* is demo/src/* only, never ships to consumers
const COMPONENT_CANIUSE_FEATURES = {
  'ResizeObserver (+ borderBoxSize, checked explicitly in code)': 'resizeobserver',
  ':focus-visible': 'css-focus-visible',
  'oklch() color function': 'css-lch-lab', // caniuse tracks oklch/oklab under this one id
  'light-dark() / color-mix() color functions': 'css-color-function',
  'prefers-reduced-motion media query': 'prefers-reduced-motion',
  'CSS.supports()': 'css-supports-api',
};

const DEMO_CANIUSE_FEATURES = {
  ':has() (used in demo/src/app.css)': 'css-has',
  'oklch() color function (used in demo/src/app.css, demo/src/app.js)': 'css-lch-lab',
};

// reported separately so an unsupported browser here doesn't drag up the headline minimum
const OPTIONAL_CANIUSE_FEATURES = {
  'forced-colors media feature + forced-color-adjust (progressive enhancement, not required)': 'forced-color-adjust',
};

const COMPONENT_BCD_FEATURES = {
  'JS private class fields (#x)': 'javascript.classes.private_class_fields',
  'Constructable CSSStyleSheet + adoptedStyleSheets': 'api.CSSStyleSheet.CSSStyleSheet',
};

const DEMO_BCD_FEATURES = {
  '@property (used for --grid in demo/src/app.css)': 'css.at-rules.property',
};

// allowPartial: true for optional features only
/** @param {string} browserId @param {string} featureId @param {boolean} [allowPartial] @returns {number | 'none'} */
const minVersionCaniuse = (browserId, featureId, allowPartial = false) => {
  const entry = features[featureId] && feature(features[featureId]);
  const stats = entry?.stats?.[browserId];
  if (!stats) return 'none';
  let best = 'none';
  for (const [version, support] of Object.entries(stats)) {
    const qualifies = support?.startsWith('y') || (allowPartial && support?.startsWith('a'));
    if (!qualifies) continue;
    const num = parseFloat(version);
    if (!Number.isFinite(num)) continue; // skips ranges like "10.1-11.0", "TP"
    if (best === 'none' || num < best) best = num;
  }
  return best;
};

/** @param {string | boolean | null | undefined} versionAdded @returns {number | 'none'} */
const normalizeBcdVersion = (versionAdded) => {
  if (versionAdded === false || versionAdded == null) return 'none';
  if (versionAdded === true) return 0;
  const num = parseFloat(String(versionAdded).replace(/^≤/, ''));
  return Number.isFinite(num) ? num : 'none';
};

/** @param {string} browserId @param {string} path dotted bcd path @returns {number | 'none'} */
const minVersionBcd = (browserId, path) => {
  const node = path.split('.').reduce((obj, key) => obj?.[key], bcd);
  const support = node?.__compat?.support?.[BCD_BROWSER_ID[browserId] ?? browserId];
  const entry = Array.isArray(support) ? support[0] : support; // array means added/removed history, [0] is fine here
  return normalizeBcdVersion(entry?.version_added);
};

/** @param {string} browserId @param {[string, () => (number | 'none')][]} checks @returns {{ minVersion: number | 'unsupported', limitingFeature: string | null }} */
const worstOf = (browserId, checks) => {
  let worst = 0, limitingFeature = null;
  for (const [label, getMin] of checks) {
    const min = getMin();
    if (min === 'none') return { minVersion: 'unsupported', limitingFeature: label };
    if (min > worst) { worst = min; limitingFeature = label; }
  }
  return { minVersion: worst, limitingFeature };
};

const componentResults = {}, demoResults = {}, optionalResults = {};
for (const browserId of TRACKED_BROWSERS) {
  const componentChecks = [
    ...Object.entries(COMPONENT_CANIUSE_FEATURES).map(([label, id]) => [label, () => minVersionCaniuse(browserId, id)]),
    ...Object.entries(COMPONENT_BCD_FEATURES).map(([label, path]) => [label, () => minVersionBcd(browserId, path)]),
  ];
  componentResults[browserId] = worstOf(browserId, componentChecks);

  // demo min includes the component checks too, plus what demo/* additionally needs
  const demoChecks = [
    ...componentChecks,
    ...Object.entries(DEMO_CANIUSE_FEATURES).map(([label, id]) => [label, () => minVersionCaniuse(browserId, id)]),
    ...Object.entries(DEMO_BCD_FEATURES).map(([label, path]) => [label, () => minVersionBcd(browserId, path)]),
  ];
  demoResults[browserId] = worstOf(browserId, demoChecks);

  const optionalChecks = Object.entries(OPTIONAL_CANIUSE_FEATURES).map(([label, id]) => [label, () => minVersionCaniuse(browserId, id, /* allowPartial */ true)]);
  optionalResults[browserId] = worstOf(browserId, optionalChecks);
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ component: componentResults, demo: demoResults, optionalEnhancements: optionalResults }, null, 2));
} else {
  const printTable = (results) => {
    for (const [id, { minVersion, limitingFeature }] of Object.entries(results)) {
      const label = minVersion === 'unsupported' ? 'NOT SUPPORTED' : `${minVersion || 'any'}+`;
      console.log(`  ${nameFor[id].padEnd(18)} ${String(label).padEnd(8)} (limited by: ${limitingFeature})`);
    }
  };

  console.log('=== Component (package/*) — this is what the README "Browser support" section should say ===\n');
  console.log('Minimum browser versions required (lowest version with full support for every REQUIRED feature used):\n');
  printTable(componentResults);

  console.log('\n=== Demo page (demo/*) — informational only, never shipped by a consumer of the component ===\n');
  console.log('Minimum browser versions required to run the demo page itself:\n');
  printTable(demoResults);

  console.log('\nProgressive enhancement only (site works fully without these, reported separately):\n');
  for (const [id, { minVersion, limitingFeature }] of Object.entries(optionalResults)) {
    const label = minVersion === 'unsupported' ? 'NOT SUPPORTED' : `${minVersion || 'any'}+`;
    console.log(`  ${nameFor[id].padEnd(18)} ${String(label).padEnd(8)} (${limitingFeature})`);
  }
  console.log('\nData sources: caniuse-lite + @mdn/browser-compat-data (both bundled, offline —');
  console.log('no browsers downloaded or launched). Update COMPONENT_CANIUSE_FEATURES / DEMO_CANIUSE_FEATURES /');
  console.log('COMPONENT_BCD_FEATURES / DEMO_BCD_FEATURES / OPTIONAL_CANIUSE_FEATURES above if the');
  console.log('source starts using a new API/CSS feature.');
}