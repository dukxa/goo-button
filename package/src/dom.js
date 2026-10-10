const SVG_NS = 'http://www.w3.org/2000/svg';
export const DISABLED = ':disabled, [aria-disabled="true"]';
export const COLOR_EASE = 'var(--goo-color-time, 0s) ease';
export const ICON_FROM_SCALE = .9;

/** @param {string} tag @param {string} [className] @param {boolean} [isSvg] @returns {HTMLElement | SVGElement} */
const create = (tag, className, isSvg) => {
  const node = isSvg ? document.createElementNS(SVG_NS, tag) : document.createElement(tag);
  if (className) node.setAttribute('class', className);
  return node;
};

const STYLES = `
:where(.goo-button) {
  all: unset;
  box-sizing: border-box;
  position: relative;
  display: inline-flex;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
:where(.goo-button):focus-visible { outline: .125rem solid transparent; }
:where(.goo-button):is(${DISABLED}) { cursor: not-allowed; }

.goo-inner {
  --font-size: var(--goo-text-size, 1.25rem);
  --icon-size: calc(var(--font-size) * var(--goo-icon-size, 1));
  --fill-color: var(--goo-fill-color, light-dark(oklch(0.2 0.04 200), oklch(0.94 0.03 200)));
  --text-color: var(--goo-text-color, light-dark(oklch(97% 0 0), oklch(15% 0 0)));
  position: relative;
  display: inline-flex;
  align-items: center;
  padding: calc(var(--font-size) * var(--goo-padding-y, 1)) calc(var(--font-size) * var(--goo-padding-x, 2));
  font-size: var(--font-size);
  line-height: 1;
  color: var(--text-color);
  transition: scale var(--goo-press-time, .16s) cubic-bezier(0.23, 1, 0.32, 1), color ${COLOR_EASE};
}
.goo-button:not(:is(${DISABLED})):is(:active, [data-goo-pressed]) .goo-inner { scale: var(--goo-press-scale, .96); }
.goo-button:is(${DISABLED}) .goo-inner { opacity: .45; }
.goo-button[data-goo-calm] .goo-inner { transition: color ${COLOR_EASE}; }
.goo-shape {
  position: absolute;
  inset: 0 auto auto 0;
  overflow: visible;
  shape-rendering: geometricPrecision;
  pointer-events: none;
}
/* RTL: x is computed left-to-right in script, so the mirror has to flip the whole .goo-inner, not
   each layer on its own (an icon mirrored around its own center wouldn't move). Label and icon
   content are mirrored back so they still read normally. The flip sits on the host, one level up,
   so it never shares scale (and its transition) with the press effect — compositing both caused
   the flip itself to animate through the press transition on toggle. */
:where(.goo-button):dir(rtl) { scale: -1 1; }
:where(.goo-button):dir(rtl) .goo-label,
:where(.goo-button):dir(rtl) .goo-icon > * { scale: -1 1; }
.goo-shape .goo-fill { fill: var(--fill-color); pointer-events: visiblePainted; transition: fill ${COLOR_EASE}; }
.goo-shape .goo-ring { fill: none; stroke: var(--fill-color); stroke-width: var(--goo-focus-width, .125rem); opacity: 0; transition: stroke ${COLOR_EASE}; }

.goo-label { position: relative; white-space: var(--goo-white-space, normal); }

.goo-icon {
  position: absolute;
  inset: 0 auto auto 0;
  width: var(--icon-size);
  aspect-ratio: 1;
  font-size: var(--icon-size);
  transform: scale(${ICON_FROM_SCALE});
  opacity: 0;
}
.goo-icon > * { display: block; width: 100%; height: 100%; }
@supports not (color: light-dark(white, black)) {
  .goo-inner {
    --fill-color: var(--goo-fill-color, oklch(0.2 0.04 200));
    --text-color: var(--goo-text-color, oklch(97% 0 0));
  }
}
@media (forced-colors: active) {
  .goo-inner { forced-color-adjust: none; --fill-color: ButtonText; --text-color: ButtonFace; }
  .goo-button:is(${DISABLED}) .goo-inner { --fill-color: GrayText; opacity: 1; }
}
@media (prefers-contrast: more) {
  .goo-shape .goo-ring { stroke-width: calc(var(--goo-focus-width, .125rem) * 1.5); }
}
`;
/** @type {CSSStyleSheet | null} */
let sheet = null;
/** @param {DocumentOrShadowRoot} root */
export const adoptStyles = (root) => {
  if (!sheet) { sheet = new CSSStyleSheet(); sheet.replaceSync(STYLES); }
  if (!root.adoptedStyleSheets.includes(sheet)) root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
};

/** @param {HTMLElement} host */
export function buildDom(host) {
  const slotIcon = host.querySelector(':scope > [slot="icon"]');
  const label = create('span', 'goo-label');
  for (let node; (node = host.firstChild);) node === slotIcon ? node.remove() : label.append(node);
  const wrap = create('span', 'goo-inner');
  const shape = create('svg', 'goo-shape', true);
  shape.setAttribute('aria-hidden', 'true');
  const ring = create('path', 'goo-ring', true);
  const neck = create('path', 'goo-fill', true);
  const pill = create('rect', 'goo-fill', true);
  const drop = create('circle', 'goo-fill', true);
  shape.append(ring, pill, neck, drop);
  const icon = create('span', 'goo-icon');
  icon.setAttribute('aria-hidden', 'true');
  if (slotIcon) icon.append(slotIcon);
  wrap.append(shape, label, icon);
  return { wrap, shape, ring, pill, neck, drop, icon, label };
}