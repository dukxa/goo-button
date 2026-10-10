import { GooButton } from './goo-button.js';
import { highlight } from './highlight.min.js';
import { clampLightnessForContrast, contrastRatio, toLinearSrgb } from './contrast.js';

const byId = (id) => document.getElementById(id);
const demo = byId('demo');
// button height drives the room the preview reserves for the goo overhang, stage height drives the sticky scroll offset
const stageNode = byId('stage');
new ResizeObserver(() => document.documentElement.style.setProperty('--goo-h', demo.offsetHeight + 'px')).observe(demo);
new ResizeObserver(() => document.documentElement.style.setProperty('--stage-h', stageNode.offsetHeight + 'px')).observe(stageNode);
const round = (number) => String(+number.toFixed(3));
const SVG_NS = 'http://www.w3.org/2000/svg';

const darkQuery = matchMedia('(prefers-color-scheme: dark)');
const isDark = () => (document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : darkQuery.matches);
const themeCallbacks = [];

// preview follows the page theme until the bulb overrides it
let previewScheme = null;
const isPreviewDark = () => (previewScheme ? previewScheme === 'dark' : isDark());

const create = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
const createSvg = (tag, attrs) => {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  return node;
};

const remSize = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
const cssToken = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// waapi reports progress already eased, so apply(0..1) gets the curve from --ease-out instead of a second copy
function tween(apply, finish, token = '--time-slow') {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { apply(1); finish(); return () => {}; }
  const animation = document.documentElement.animate([], { duration: parseFloat(cssToken(token)) * 1000, easing: cssToken('--ease-out') });
  let frame = 0;
  const tick = () => {
    if (animation.playState === 'finished') { apply(1); finish(); return; }
    apply(animation.effect.getComputedTiming().progress ?? 0);
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return () => { cancelAnimationFrame(frame); animation.cancel(); };
}
// colors fade while the theme flips, page.css reads the attribute, a new flip restarts the timer
let fadeTimer = 0;
function fadeTheme(change) {
  const root = document.documentElement;
  root.setAttribute('data-theme-fading', '');
  change();
  clearTimeout(fadeTimer);
  fadeTimer = setTimeout(() => root.removeAttribute('data-theme-fading'), parseFloat(cssToken('--time-theme')) * 1000 + 50);
}
const filter = createSvg('filter', { id: 'goo', filterUnits: 'userSpaceOnUse', x: -.5 * remSize(), y: -.5 * remSize(), width: 19.75 * remSize(), height: 2.625 * remSize() });
const blur = createSvg('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: .15 * remSize(), result: 'blurred' });
filter.append(
  blur,
  createSvg('feColorMatrix', { in: 'blurred', mode: 'matrix', values: '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -11' }),
);
const filterSprite = createSvg('svg', { width: 0, height: 0, 'aria-hidden': 'true', class: 'sprite' });
const defs = createSvg('defs', {});
defs.append(filter);
filterSprite.append(defs);
document.body.prepend(filterSprite);

const fitters = new Map();
const sliderObserver = new ResizeObserver((entries) => entries.forEach((entry) => fitters.get(entry.target)?.(entry.contentRect.width, entry.contentRect.height)));
let sliderCount = 0;

function createSlider({ label, hint, min, max, step, initial }, onInput, format) {
  const id = `slider-${++sliderCount}`;
  const row = create('div', 'row');
  const labelNode = create('label', '', label); labelNode.htmlFor = id;
  const output = create('output'); output.htmlFor = id; output.setAttribute('aria-hidden', 'true');
  const slider = create('div', 'slider');

  const svg = createSvg('svg', { 'aria-hidden': 'true', focusable: 'false' });
  const baseLine = createSvg('line', { class: 'track-base' });
  const baseGroup = createSvg('g', { class: 'goo-blob' });
  baseGroup.append(baseLine);
  const fillGroup = createSvg('g', { class: 'goo-blob' });
  const fillLine = createSvg('line', { class: 'track-fill' });
  const thumb = createSvg('circle', { class: 'thumb' });
  fillGroup.append(fillLine, thumb);
  svg.append(baseGroup, fillGroup);

  const input = create('input');
  Object.assign(input, { id, type: 'range', min, max, step, value: initial });
  slider.append(svg, input);

  let width = 18.75 * remSize(), edge = .6875 * remSize();
  const sync = () => {
    const ratio = (input.value - input.min) / (input.max - input.min);
    const x = (edge + ratio * (width - 2 * edge)).toFixed(2);
    fillLine.setAttribute('x2', x);
    thumb.setAttribute('cx', x);
    output.textContent = format(+input.value);
    input.setAttribute('aria-valuetext', output.textContent);
  };
  fitters.set(slider, (newWidth, height) => {
    if (!newWidth || !height) return;
    const rem = remSize();
    width = newWidth; edge = .6875 * rem;
    svg.setAttribute('viewBox', `0 0 ${newWidth} ${height}`);
    for (const line of [baseLine, fillLine]) { line.setAttribute('x1', edge); line.setAttribute('y1', height / 2); line.setAttribute('y2', height / 2); }
    baseLine.setAttribute('x2', (newWidth - edge).toFixed(2));
    thumb.setAttribute('cy', height / 2); thumb.setAttribute('r', .4375 * rem);
    blur.setAttribute('stdDeviation', .15 * rem);
    filter.setAttribute('x', -.5 * rem); filter.setAttribute('y', -.5 * rem); filter.setAttribute('height', height + 1 * rem);
    filter.setAttribute('width', Math.max(+filter.getAttribute('width'), newWidth + 1 * rem));
    sync();
  });
  sliderObserver.observe(slider);
  let stopGlide = null;
  const stop = () => { stopGlide?.(); stopGlide = null; };
  // reset: the thumb glides to its default instead of jumping
  const glideTo = (target, onStep, onDone, token) => {
    stop();
    const from = +input.value;
    if (from === target) { onDone(); return; }
    stopGlide = tween((progress) => { input.value = from + (target - from) * progress; sync(); onStep(+input.value); }, () => { stopGlide = null; onDone(); }, token);
  };
  // a click on the track (not a drag, not the keyboard) jumps the native value instantly; replay it as the same glide reset uses
  let pointerActive = false, dragged = false, beforeDrag = +input.value;
  input.addEventListener('pointerdown', () => { pointerActive = true; dragged = false; beforeDrag = +input.value; });
  input.addEventListener('pointermove', () => { if (pointerActive) dragged = true; });
  input.addEventListener('pointerup', () => { pointerActive = false; });
  input.addEventListener('pointercancel', () => { pointerActive = false; });
  input.addEventListener('input', () => {
    if (pointerActive && !dragged && +input.value !== beforeDrag) {
      const target = +input.value;
      input.value = beforeDrag; sync();
      glideTo(target, (value) => onInput(value), () => onInput(target));
      return;
    }
    stop(); sync(); onInput(+input.value);
  });

  row.append(labelNode, output);
  if (hint) {
    const note = create('span', 'hint', hint); note.id = `${id}-hint`;
    input.setAttribute('aria-describedby', note.id);
    row.append(note);
  }
  row.append(slider);
  sync();
  return { row, input, sync, glideTo };
}

const CONTROLS = {
  shape: [
    { attr: 'text-size', label: 'Text size', min: 0.75, max: 2, step: 0.025, initial: 1.25, unit: 'rem', hint: 'The base unit for padding and icon size below' },
    { attr: 'padding-x', label: 'Horizontal padding', min: 0.5, max: 4, step: 0.05, initial: 2, unit: '×' },
    { attr: 'padding-y', label: 'Vertical padding', min: 0.5, max: 2, step: 0.05, initial: 1, unit: '×' },
    { attr: 'icon-size', label: 'Icon size', min: 0.5, max: 2, step: 0.05, initial: 1, unit: '×' },
  ],
  drop: [
    { attr: 'gap', label: 'Gap', min: 0, max: 1, step: 0.01, initial: 0.16, unit: '×', hint: 'Distance between the button and the drop, in button heights' },
    { attr: 'neck-reach', label: 'Neck reach', min: 0, max: 2, step: 0.01, initial: 0.72, unit: '×', hint: 'How far the neck stretches before it breaks, in button heights' },
  ],
  press: [
    { attr: 'press-scale', label: 'Press scale', min: 0.85, max: 1, step: 0.01, initial: 0.96, unit: '' },
    { attr: 'press-time', label: 'Press time', min: 0, max: 1, step: 0.01, initial: 0.16, unit: 's' },
    { attr: 'focus-width', label: 'Focus ring width', min: 0.025, max: 0.375, step: 0.025, initial: 0.125, unit: 'rem' },
    { attr: 'focus-offset', label: 'Focus ring offset', min: 0, max: 1, step: 0.025, initial: 0.375, unit: 'rem', hint: 'Distance between the button and the ring' },
  ],
  motion: [
    { attr: 'delay', label: 'Delay', min: 0, max: 1000, step: 10, initial: 0, unit: 'ms', hint: 'Wait before the motion starts' },
    { attr: 'stiffness', label: 'Stiffness', min: 0.3, max: 3, step: 0.05, initial: 1, unit: '×', hint: 'Higher means snappier' },
    { attr: 'damping', label: 'Damping', min: 0.3, max: 3, step: 0.05, initial: 0.5, unit: '×', hint: 'Higher is calmer, lower bounces more' },
  ],
};

const resets = [];
const changed = new Map();

function buildSliders() {
  for (const [group, specs] of Object.entries(CONTROLS)) {
    const host = document.querySelector(`[data-group="${group}"]`);
    for (const spec of specs) {
      const { attr, initial, unit } = spec;
      const apply = (value, print = true) => {
        if (value === initial) { demo.removeAttribute(`data-goo-${attr}`); changed.delete(attr); }
        else { demo.setAttribute(`data-goo-${attr}`, round(value)); changed.set(attr, round(value)); }
        if (print) printCode();
      };
      const { row, glideTo } = createSlider(spec, apply, (value) => `${round(value)}${unit === '×' ? ' ×' : unit ? ` ${unit}` : ''}`);
      resets.push(() => glideTo(initial, (value) => apply(value, false), () => apply(initial)));
      host.append(row);
    }
  }
}

const contrast = contrastRatio;
// sRGB gamma step only; linear RGB comes from contrast.js
const toHex = (color) => `#${toLinearSrgb(color).map((channel) => Math.round((channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055) * 255).toString(16).padStart(2, '0')).join('')}`;

const formatOklch = ([lightness, chroma, hue]) => `oklch(${round(lightness)} ${round(chroma)} ${round(hue)})`;
const COLORS = {
  'fill-color': { label: 'Fill', light: [0.2, 0.04, 200], dark: [0.94, 0.03, 200] },
  'text-color': { label: 'Label and icon', light: [0.97, 0, 0], dark: [0.15, 0, 0] },
};
const currentColors = {};
const getSurface = (dark = isPreviewDark()) => (dark ? [0.2, 0.004, 260] : [1, 0, 0]);

const contrastNote = create('p', 'contrast');
const contrastView = create('span');
contrastView.setAttribute('aria-hidden', 'true');
const contrastSpoken = create('span', 'sr-only');
contrastSpoken.setAttribute('aria-live', 'polite');
contrastNote.append(contrastView, contrastSpoken);
let spokenTimer = 0;

function updateContrast() {
  if (!currentColors['fill-color'] || !currentColors['text-color']) return;
  const ratio = contrast(currentColors['fill-color'], currentColors['text-color']);
  const verdict = ratio >= 4.5 ? 'Passes AA' : 'Below 4.5:1, darken the fill or lighten the label';
  const edge = contrast(currentColors['fill-color'], getSurface());
  const edgeVerdict = edge >= 3 ? 'Passes 3:1' : 'Below 3:1, darken the fill or lighten the page';

  contrastView.replaceChildren(
    create('strong', '', `≈${ratio.toFixed(1)}:1`), ` label on fill, ${verdict}`, create('br'),
    create('strong', '', `≈${edge.toFixed(1)}:1`), ` fill on the preview background, ${edgeVerdict}`);
  clearTimeout(spokenTimer);
  spokenTimer = setTimeout(() => { contrastSpoken.textContent = contrastView.textContent; }, 600);
}

// accent stops once the fill gets too close to the page (same clamp data-goo-wcag-color uses), the favicon follows the accent
const getAccent = () => clampLightnessForContrast(currentColors['fill-color'], getSurface(isDark()), 3);

function updateAccent() {
  const rootStyle = document.documentElement.style;
  // page scheme's default fill equals the css accent, but the bulb's preview scheme can differ, so the accent follows the fill even untouched
  if (!currentColors['fill-color'] || (!changed.has('fill-color') && !previewScheme)) { rootStyle.removeProperty('--accent'); return; }
  rootStyle.setProperty('--accent', formatOklch(getAccent()));
}

const faviconLink = document.querySelector('link[rel="icon"]');
const arrowPath = byId('icon-arrow').querySelector('path').getAttribute('d');
function updateFavicon() {
  const svg = `<svg xmlns="${SVG_NS}" viewBox="0 0 256 256"><rect width="256" height="256" rx="64" fill="${toHex(getAccent())}"/>`
    + `<path fill="${toHex(currentColors['text-color'])}" transform="translate(51.2 51.2) scale(.6)" d="${arrowPath}"/></svg>`;
  faviconLink.setAttribute('href', `data:image/svg+xml,${encodeURIComponent(svg)}`);
}

function buildPickers() {
  const host = document.querySelector('[data-group="color"]');
  for (const [attr, spec] of Object.entries(COLORS)) {
    const base = () => spec[isPreviewDark() ? 'dark' : 'light'];
    let touched = false;
    let [lightness, chroma, hue] = base();

    const box = create('fieldset', 'picker');
    const legend = create('legend', 'sr-only', spec.label);
    box.append(legend);
    const head = create('div', 'picker-head');
    const title = create('span', '', spec.label);
    title.setAttribute('aria-hidden', 'true');
    const swatch = create('span', 'swatch');
    const value = create('code');
    head.append(title, swatch, value);

    const paint = () => {
      const css = formatOklch([lightness, chroma, hue]);
      swatch.style.background = css; value.textContent = css;
      currentColors[attr] = [lightness, chroma, hue];
      updateContrast();
    };
    const commit = () => {
      touched = true;
      paint();
      const css = formatOklch([lightness, chroma, hue]);
      demo.setAttribute(`data-goo-${attr}`, css);
      changed.set(attr, css);
      if (attr === 'fill-color') updateAccent();
      updateFavicon();
      printCode();
    };

    const sliders = [
      createSlider({ label: 'Lightness', min: 0, max: 1, step: 0.01, initial: lightness }, (next) => { lightness = next; commit(); }, (next) => `${Math.round(next * 100)}%`),
      createSlider({ label: 'Chroma', min: 0, max: 0.4, step: 0.005, initial: chroma }, (next) => { chroma = next; commit(); }, (next) => round(next)),
      createSlider({ label: 'Hue', min: 0, max: 360, step: 1, initial: hue }, (next) => { hue = next; commit(); }, (next) => `${Math.round(next)}°`),
    ];
    const setters = [(next) => { lightness = next; }, (next) => { chroma = next; }, (next) => { hue = next; }];
    const load = () => {
      [lightness, chroma, hue] = base();
      [lightness, chroma, hue].forEach((component, index) => { sliders[index].input.value = component; sliders[index].sync(); });
      paint();
    };
    // glide all three sliders to `targets` in parallel, running `onDone` once every slider settles
    const glideTriple = (targets, onStep, onDone, timeVar) => {
      let waiting = sliders.length;
      sliders.forEach((item, index) => item.glideTo(targets[index], (next) => {
        setters[index](next);
        paint();
        onStep?.();
        if (attr === 'fill-color') updateAccent();
      }, () => { if (--waiting === 0) onDone(); }, timeVar));
    };
    // theme flip: the thumbs glide to the new scheme's defaults over the theme fade time
    const glideOnTheme = () => {
      if (touched) return;
      glideTriple(base(), null, () => { updateAccent(); updateFavicon(); printCode(); }, '--time-theme');
    };
    themeCallbacks.push(glideOnTheme);

    box.append(head, ...sliders.map((item) => item.row));
    host.append(box);
    paint();

    resets.push(() => glideTriple(base(), () => demo.setAttribute(`data-goo-${attr}`, formatOklch([lightness, chroma, hue])), () => {
      touched = false;
      demo.removeAttribute(`data-goo-${attr}`);
      changed.delete(attr);
      load();
      if (attr === 'fill-color') updateAccent();
      updateFavicon();
      printCode();
    }));
  }
  host.append(contrastNote);
  themeCallbacks.push(updateContrast, updateAccent, updateFavicon);
  updateFavicon();
}

// one item open at a time across every .accordion card together (they're separate cards only for
// visual grouping, not separate exclusive groups): opening Accessibility closes Shape and vice
// versa. Arrow-key navigation stays scoped to the trigger's own card, since Home/End jumping into
// a visually distinct card reads as a different list. Which item starts open comes from the
// markup's own data-open.
function buildAccordion() {
  const groups = [...document.querySelectorAll('.accordion')].map((accordion) => [...accordion.querySelectorAll('.accordion-item')]);
  const items = groups.flat();
  const triggers = items.map((item) => item.querySelector('.accordion-trigger'));
  const open = (target) => items.forEach((item, index) => {
    const expand = item === target;
    item.toggleAttribute('data-open', expand);
    triggers[index].setAttribute('aria-expanded', String(expand));
  });
  items.forEach((item, index) => {
    const trigger = triggers[index];
    const group = groups.find((members) => members.includes(item));
    const groupTriggers = group.map((member) => triggers[items.indexOf(member)]);
    const indexInGroup = group.indexOf(item);
    trigger.addEventListener('click', () => open(item.hasAttribute('data-open') ? null : item));
    trigger.addEventListener('keydown', (event) => {
      const nextIndex = { ArrowDown: indexInGroup + 1, ArrowUp: indexInGroup - 1, Home: 0, End: groupTriggers.length - 1 }[event.key];
      if (nextIndex === undefined) return;
      event.preventDefault();
      groupTriggers[(nextIndex + groupTriggers.length) % groupTriggers.length].focus();
    });
  });
}

function setupPreviewScheme() {
  const stage = byId('stage'), button = byId('bulb-button');
  const sync = () => {
    if (previewScheme) stage.dataset.scheme = previewScheme; else delete stage.dataset.scheme;
    stage.toggleAttribute('data-light', !isPreviewDark());
    button.setAttribute('aria-pressed', String(!isPreviewDark()));
  };
  const refresh = () => { sync(); themeCallbacks.forEach((callback) => callback()); };
  button.addEventListener('click', () => {
    const toLight = isPreviewDark();
    // back to the page scheme means following the page again
    previewScheme = (toLight ? 'light' : 'dark') === (isDark() ? 'dark' : 'light') ? null : (toLight ? 'light' : 'dark');
    fadeTheme(refresh);
  });
  // runs before the pickers reload their defaults
  resets.unshift(() => { previewScheme = null; sync(); });
  themeCallbacks.unshift(sync);
  sync();
}

function setupMotion() {
  const toggle = byId('calm-motion');
  const sync = () => { toggle.checked = GooButton.motion === 'calm'; document.documentElement.toggleAttribute('data-calm-motion', toggle.checked); };
  toggle.addEventListener('change', () => { GooButton.motion = toggle.checked ? 'calm' : 'full'; sync(); });
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', sync);
  sync();
  return sync;
}

function setupKeepOpen() {
  const toggle = byId('keep-open');
  toggle.addEventListener('change', () => demo.toggleAttribute('data-goo-open', toggle.checked));
  return toggle;
}

// preview-only: direction is page layout, not a button setting, so it never lands in the generated snippet
function setupRtl() {
  const toggle = byId('rtl-preview');
  toggle.addEventListener('change', () => demo.setAttribute('dir', toggle.checked ? 'rtl' : 'ltr'));
  return toggle;
}

function setupWcagColor() {
  const toggle = byId('wcag-color');
  const apply = () => {
    if (toggle.checked) { demo.setAttribute('data-goo-wcag-color', ''); changed.set('wcag-color', ''); }
    else { demo.removeAttribute('data-goo-wcag-color'); changed.delete('wcag-color'); }
    printCode();
  };
  toggle.addEventListener('change', apply);
  return toggle;
}

// storage blocked: the choice just won't persist
const storeTheme = (next) => { try { next === null ? localStorage.removeItem('goo-theme') : localStorage.setItem('goo-theme', next); } catch {} };

function setupTheme() {
  const button = byId('theme-button');
  const showMode = () => {
    button.dataset.mode = isDark() ? 'dark' : 'light';
    button.setAttribute('aria-pressed', String(isDark()));
  };
  const update = () => {
    const next = isDark() ? 'light' : 'dark';

    if (next === (darkQuery.matches ? 'dark' : 'light')) {
      delete document.documentElement.dataset.theme;
      storeTheme(null);
    } else {
      document.documentElement.dataset.theme = next;
      storeTheme(next);
    }
    showMode();
    themeCallbacks.forEach((callback) => callback());
  };
  button.addEventListener('click', () => fadeTheme(update));
  darkQuery.addEventListener('change', () => {
    if (document.documentElement.dataset.theme) return;
    fadeTheme(() => { showMode(); themeCallbacks.forEach((callback) => callback()); });
  });
  showMode();
  requestAnimationFrame(() => button.setAttribute('data-ready', ''));
}

const ORDER = [...Object.values(CONTROLS).flat().map((control) => control.attr), 'wcag-color', ...Object.keys(COLORS)];
// attrs with no value (boolean, like data-goo-open): present means "set", with nothing after the name
const BOOLEAN_KEYS = new Set(['wcag-color']);
const buttonLabel = demo.textContent.trim();
const attrString = (node, names = [...node.attributes].map((attr) => attr.name)) =>
  names.filter((name) => node.hasAttribute(name)).map((name) => `${name}="${node.getAttribute(name)}"`).join(' ');

function iconMarkup() {
  const svg = demo.querySelector('svg[slot="icon"]');
  if (!svg) return '';
  // <use> only works with the demo sprite, so the snippet gets the real shapes
  const shapes = [...svg.children].flatMap((child) => child.localName === 'use' ? [...byId(child.getAttribute('href').slice(1)).children] : [child]);
  const inner = shapes.map((child) => `<${child.localName} ${attrString(child)}/>`).join('');
  return `\n  <svg ${attrString(svg, ['slot', 'viewBox', 'fill', 'aria-hidden'])}>${inner}</svg>`;
}

function printCode() {
  const attrs = ['data-goo', ...ORDER.filter((key) => changed.has(key)).map((key) => BOOLEAN_KEYS.has(key) ? `data-goo-${key}` : `data-goo-${key}="${changed.get(key)}"`)].join(' ');
  byId('code-html').textContent = `<button type="button" ${attrs}>\n  ${buttonLabel}${iconMarkup()}\n</button>`;
  highlight(byId('code-html'));
  fitCode(byId('code-html').closest('pre'));
}

function fitCode(pre) {
  if (pre.scrollHeight > pre.clientHeight || pre.scrollWidth > pre.clientWidth) {
    pre.tabIndex = 0;
    pre.setAttribute('role', 'region');
    pre.setAttribute('aria-labelledby', pre.closest('section').querySelector('h3').id);
  } else ['tabindex', 'role', 'aria-labelledby'].forEach((attr) => pre.removeAttribute(attr));
}
function setupCodeBlocks() {
  document.querySelectorAll('code[data-lang]').forEach(highlight);
  const watcher = new ResizeObserver((entries) => entries.forEach((entry) => fitCode(entry.target)));
  document.querySelectorAll('.code-body').forEach((pre) => watcher.observe(pre));
}

function setupCopy() {
  const status = byId('status');
  let statusTimer = 0;
  const say = (message) => {
    status.textContent = '';
    clearTimeout(statusTimer);
    requestAnimationFrame(() => { status.textContent = message; });
    statusTimer = setTimeout(() => { status.textContent = ''; }, 3000);
  };
  document.querySelectorAll('.copy-button').forEach((button) => {
    let resetTimer = 0;
    button.addEventListener('click', async () => {
      const source = byId(button.dataset.copyTarget);
      try { await navigator.clipboard.writeText(source.textContent); }
      catch {
        getSelection().selectAllChildren(source);
        say(`Couldn’t copy. Press Ctrl+C or Cmd+C to copy the selected ${button.dataset.label}.`);
        return;
      }
      button.classList.add('copied');
      say(`Copied ${button.dataset.label}`);
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => button.classList.remove('copied'), 1600);
    });
  });
}

function setupReset(syncMotion, keepOpen, rtlPreview, wcagColor) {
  const button = byId('reset-button');
  const icon = button.querySelector('svg');
  let angle = 0;
  button.addEventListener('click', () => {
    resets.forEach((reset) => reset());
    keepOpen.checked = false; demo.toggleAttribute('data-goo-open', false);
    rtlPreview.checked = false; demo.setAttribute('dir', 'ltr');
    wcagColor.checked = false; demo.removeAttribute('data-goo-wcag-color'); changed.delete('wcag-color');
    GooButton.motion = 'auto';
    syncMotion();
    printCode();
    angle -= 360;
    icon.style.rotate = `${angle}deg`;
  });
}

function setupStickyColumns() {
  const columns = document.querySelectorAll('.output, .controls');
  const fit = () => {
    const gap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--space-13')) * remSize();
    const viewport = document.documentElement.clientHeight;
    columns.forEach((column) => {
      column.style.setProperty('--stick-top', `${Math.min(gap, viewport - column.getBoundingClientRect().height - gap)}px`);
    });
  };
  const watcher = new ResizeObserver(fit);
  columns.forEach((column) => watcher.observe(column));
  addEventListener('resize', fit);
  fit();
}

buildSliders();
buildPickers();
buildAccordion();
setupTheme();
setupPreviewScheme();
setupReset(setupMotion(), setupKeepOpen(), setupRtl(), setupWcagColor());
setupCopy();
setupCodeBlocks();
printCode();
setupStickyColumns();

console.log('Hi there.\n\n– >D<');