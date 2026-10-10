import { clamp, fixed, neckPath, ringPath } from './shape.js';
import { MAX_DELTA, MOTION, Spring } from './spring.js';
import { adoptStyles, buildDom, COLOR_EASE, DISABLED, ICON_FROM_SCALE } from './dom.js';
import { DATA_ATTRS, DELAY, DRIVEN, GEOMETRY_TOKENS, OPTIONS, parseValue, readToken, SPEC } from './tokens.js';
import { clampLightnessForContrast, clampLightnessForLuminance, contrastFromLuminances, formatOklch, luminance, parseOklch, resolvedLuminance } from './contrast.js';
/** @typedef {import('./tokens.js').DrivenName} DrivenName */

const supported = typeof document !== 'undefined' && typeof ResizeObserver === 'function'
  && 'borderBoxSize' in ResizeObserverEntry.prototype && typeof CSSStyleSheet === 'function'
  && 'replaceSync' in CSSStyleSheet.prototype && 'adoptedStyleSheets' in document
  && typeof CSS !== 'undefined' && CSS.supports('color', 'oklch(0.5 0.1 200)');

const DEFAULT_GAP = .16, DEFAULT_REACH = .72;
const FOCUS_RING = { offset: .375, min: .03125, fade: 2.5 };

// WCAG 1.4.3 (text on fill) and 1.4.11 (fill on the page). The page leg has no way to read an
// arbitrary ancestor's real background, so it checks against the same light/dark pair `light-dark()`
// itself represents — a reasonable default, not a guarantee for a page with a tinted background.
const WCAG_TEXT_RATIO = 4.5, WCAG_SURFACE_RATIO = 3;
/** @type {{ light: [number, number, number], dark: [number, number, number] }} */
const PAGE_SURFACE = { light: [1, 0, 0], dark: [0.2, 0.004, 260] };

const SWAY = { gain: 5 / 64, max: 1 / 8 };

const reducedMotionQuery = supported ? matchMedia('(prefers-reduced-motion: reduce)') : null;
const systemMode = () => (reducedMotionQuery?.matches ? 'calm' : 'full');
let mode = systemMode(), isModePinned = false;

reducedMotionQuery?.addEventListener('change', () => { if (!isModePinned) mode = systemMode(); });

const registry = new WeakMap();

class Goo {
  /** @type {HTMLElement} */
  #host;
  /** @type {ReturnType<typeof buildDom>} */
  #dom;
  #resizeObserver;
  #mutationObserver;

  #width = 0;
  #height = 0;
  #iconSize = 0;
  #gap = DEFAULT_GAP;
  #reach = DEFAULT_REACH;
  // CSS px, not rem: FOCUS_RING.offset gets multiplied by #rem once at read time instead
  #ringOffset = 0;
  #rem = 16;
  #frame = 0;
  #lastTime = 0;
  /** @type {{ delay: number, stiffness: number, damping: number }} */
  #options = { delay: 0, stiffness: 1, damping: .5 };
  /** @type {Set<'hover' | 'focus' | 'pinned'>} */
  #flags = new Set();
  /** @type {Record<DrivenName | 'ring', Spring>} */
  #springs = { body: new Spring(), move: new Spring(), grow: new Spring(), tip: new Spring(), ring: new Spring() };
  #allSprings = Object.values(this.#springs);
  #abort = new AbortController();
  #addedTabindex = false;
  #ownProps = new Set();
  #wcagColor = false;
  /** raw, as-authored values for fill-color/text-color, read back when `wcag-color` toggles on/off or either color changes */
  #rawColor = { 'fill-color': /** @type {string | null} */ (null), 'text-color': /** @type {string | null} */ (null) };

  /** @param {HTMLElement} host */
  constructor(host) {
    // getRootNode() is the document or a shadow root, the cast only tells typescript what the runtime already guarantees
    adoptStyles(/** @type {DocumentOrShadowRoot} */ (/** @type {unknown} */ (host.getRootNode())));
    this.#host = host;
    this.#dom = buildDom(host);
    host.classList.add('goo-button');
    host.append(this.#dom.wrap);

    /** @type {(type: string, handler: (event: any) => void) => void} */
    const on = (type, handler) => host.addEventListener(type, handler, { signal: this.#abort.signal });
    const updateFocus = () => this.#setFlag('focus', host.matches(':focus-visible'));
    on('pointerenter', (event) => event.pointerType !== 'touch' && this.#setFlag('hover', true));
    on('pointerleave', () => this.#setFlag('hover', false));
    on('pointerdown', (event) => event.pointerType === 'touch' && this.#setFlag('hover', true));

    on('focus', updateFocus);

    on('keydown', updateFocus);
    on('blur', () => { this.#setFlag('focus', false); host.removeAttribute('data-goo-pressed'); });
    if (!(host instanceof HTMLButtonElement)) this.#bindRoleButton(on);

    this.#resizeObserver = new ResizeObserver(([entry]) => this.#layout(entry.borderBoxSize[0]));
    this.#resizeObserver.observe(this.#dom.wrap, { box: 'border-box' });
    this.#mutationObserver = new MutationObserver((records) => this.#onMutation(records));
    this.#mutationObserver.observe(host, { attributes: true, attributeFilter: ['class', 'data-goo', ...DATA_ATTRS, 'disabled', 'aria-disabled'] });
    for (const { name, value } of [...host.attributes]) if (DATA_ATTRS.includes(name)) this.#applyAttr(name, value);
    this.#retune();
  }

  get #disabled() { return this.#host.matches(DISABLED); }

  /** @param {(type: string, handler: (event: any) => void) => void} on */
  #bindRoleButton(on) {
    const host = this.#host;
    if (!host.hasAttribute('tabindex') && !host.hasAttribute('href')) { host.tabIndex = 0; this.#addedTabindex = true; }
    /** @param {Event} event */
    const isOwn = (event) => event.target === host && !this.#disabled;

    let spaceDown = false;
    on('keydown', (event) => {
      if (event.target !== host) return;
      if (event.key === ' ') { event.preventDefault(); if (!event.repeat) spaceDown = true; }
      else if (event.key === 'Enter' && !host.hasAttribute('href') && isOwn(event)) { event.preventDefault(); host.click(); }
      if ((event.key === ' ' || event.key === 'Enter') && !this.#disabled) host.setAttribute('data-goo-pressed', '');
    });
    on('keyup', (event) => {
      host.removeAttribute('data-goo-pressed');
      if (event.key === ' ') { if (spaceDown && isOwn(event)) host.click(); spaceDown = false; }
    });
    on('blur', () => { spaceDown = false; });
  }

  /** @param {MutationRecord[]} records */
  #onMutation(records) {
    let needsSync = false;
    for (const { attributeName: name } of records) {
      if (name === 'disabled' || name === 'aria-disabled') {
        needsSync = true;
        if (this.#disabled) this.#flags.delete('hover');
        else if (this.#host.matches(':hover')) this.#flags.add('hover');
        if (this.#host.matches(':disabled')) this.#flags.delete('focus');
      } else if (name === 'class') {
        if (!this.#host.classList.contains('goo-button')) this.#host.classList.add('goo-button');
      } else if (name === 'data-goo') {
        if (!this.#host.hasAttribute('data-goo')) { detach(this.#host); return; }
      } else if (name !== null) this.#applyAttr(name, this.#host.getAttribute(name));
    }
    if (needsSync) this.#sync();
  }

  /** @param {string} attr @param {string | null} value */
  #applyAttr(attr, value) {
    const name = attr.slice('data-goo-'.length);
    if (Object.hasOwn(OPTIONS, name)) {
      const key = /** @type {'delay' | 'stiffness' | 'damping'} */ (name);
      const [fallback, min, max] = OPTIONS[key], num = parseFloat(value ?? '');
      this.#options[key] = Number.isFinite(num) ? clamp(num, min, max) : fallback;
      this.#retune();
    } else if (name === 'open') {
      this.#setFlag('pinned', value !== null);
    } else if (name === 'wcag-color') {
      this.#wcagColor = value !== null;
      this.#applyWcagColor();
    } else if (name === 'fill-color' || name === 'text-color') {
      this.#rawColor[name] = value;
      this.#applyColor(name, value);
    } else {
      const prop = `--goo-${name}`, css = value === null ? null : parseValue(name, value);
      if (css === null && value?.trim()) console.warn(`goo-button: ${attr}="${value}" ignored (wrong type or out of the allowed form)`, this.#host);
      if (css !== null) { this.#host.style.setProperty(prop, css); this.#ownProps.add(prop); }
      else this.#release(prop);
      if (GEOMETRY_TOKENS.has(name)) { this.#readTokens(); this.#render(); }
    }
  }

  /** @param {'fill-color' | 'text-color'} name @param {string | null} value */
  #applyColor(name, value) {
    const prop = `--goo-${name}`, css = value === null ? null : parseValue(name, value);
    if (css === null && value?.trim()) console.warn(`goo-button: data-goo-${name}="${value}" ignored (wrong type or out of the allowed form)`, this.#host);
    if (css !== null) { this.#host.style.setProperty(prop, css); this.#ownProps.add(prop); }
    else this.#release(prop);
    if (name === 'fill-color') this.#applyWcagColor();
  }

  // Keeps data-goo-fill-color / data-goo-text-color at a passing WCAG contrast while data-goo-wcag-color is set:
  // fill against the page at 3:1 (1.4.11), label against fill at 4.5:1 (1.4.3). An oklch() value is adjusted in
  // place (lightness only, toward the nearest pass). Any other color notation (hex, rgb, named, ...) can't be
  // adjusted the same way without abandoning the author's intended color, so a failing one is only flagged.
  #applyWcagColor() {
    const fillRaw = this.#rawColor['fill-color'], textRaw = this.#rawColor['text-color'];
    if (!this.#wcagColor || (!fillRaw && !textRaw)) return;
    let fillOklch = fillRaw ? parseOklch(fillRaw) : null;
    const textOklch = textRaw ? parseOklch(textRaw) : null;

    if (fillOklch) {
      fillOklch = clampLightnessForLuminance(fillOklch, luminance(this.#pageSurface()), WCAG_SURFACE_RATIO);
      if (textOklch) fillOklch = clampLightnessForContrast(fillOklch, textOklch, WCAG_TEXT_RATIO);
      this.#setAdjustedColor('fill-color', fillOklch);
    } else {
      this.#warnIfFailing('fill-color', fillRaw, luminance(this.#pageSurface()), WCAG_SURFACE_RATIO, 'the page');
    }

    // the fill to check the label against: the one just adjusted, or (if only the label is custom) the resolved default
    const fillLuminance = fillOklch ? luminance(fillOklch) : this.#computedFillLuminance();
    if (fillLuminance === null) return;
    if (textOklch) this.#setAdjustedColor('text-color', clampLightnessForLuminance(textOklch, fillLuminance, WCAG_TEXT_RATIO));
    else this.#warnIfFailing('text-color', textRaw, fillLuminance, WCAG_TEXT_RATIO, 'the fill');
  }

  /** @param {'fill-color' | 'text-color'} name @param {import('./contrast.js').Oklch} oklch */
  #setAdjustedColor(name, oklch) {
    const prop = `--goo-${name}`, css = formatOklch(oklch);
    this.#host.style.setProperty(prop, css);
    this.#ownProps.add(prop);
  }

  // a color we can't shift (hex, rgb, named...) stays as authored; warns on every change it fails rather than leaving bad contrast silent
  /** @param {'fill-color' | 'text-color'} name @param {string | null} raw @param {number} againstLuminance @param {number} minRatio @param {string} againstLabel */
  #warnIfFailing(name, raw, againstLuminance, minRatio, againstLabel) {
    if (!raw) return;
    const rawLuminance = resolvedLuminance(raw);
    if (rawLuminance === null || contrastFromLuminances(rawLuminance, againstLuminance) >= minRatio) return;
    console.warn(
      `goo-button: data-goo-${name}="${raw}" doesn't reach ${minRatio}:1 against ${againstLabel}. `
      + 'Give it as oklch(...) so wcag-color can adjust it, or remove data-goo-wcag-color.',
      this.#host,
    );
  }

  /** The default fill's luminance, resolved from the rendered element (it's declared via light-dark() in CSS, so it can't be computed from the token alone). @returns {number | null} */
  #computedFillLuminance() { return resolvedLuminance(getComputedStyle(this.#dom.pill).fill); }

  /** @returns {import('./contrast.js').Oklch} */
  #pageSurface() { return PAGE_SURFACE[getComputedStyle(this.#host).colorScheme.includes('dark') ? 'dark' : 'light']; }

  /** @param {string} prop */
  #release(prop) {
    if (!this.#ownProps.delete(prop)) return;
    this.#host.style.removeProperty(prop);
    if (!this.#host.getAttribute('style')) this.#host.removeAttribute('style');
  }

  #retune() {
    const { stiffness, damping } = this.#options, calm = mode === 'calm';
    this.#host.toggleAttribute('data-goo-calm', calm);
    for (const name of DRIVEN) {
      const spring = this.#springs[name];
      const { stiffness: baseStiffness, damping: baseDamping } = MOTION[name];
      const tunedStiffness = baseStiffness * stiffness;
      Object.assign(spring, {
        stiffness: tunedStiffness,
        // calm clamps to at least critical damping, whatever the damping slider says, so nothing overshoots
        damping: calm ? Math.max(2 * Math.sqrt(tunedStiffness), baseDamping * damping) : baseDamping * damping,
      });
    }
  }

  #readTokens() {
    const style = getComputedStyle(this.#host);
    this.#gap = readToken(style, '--goo-gap', DEFAULT_GAP, 0, 2);
    this.#reach = readToken(style, '--goo-neck-reach', DEFAULT_REACH, 0, 4);

    this.#rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;

    const raw = style.getPropertyValue('--goo-focus-offset').trim(), num = parseFloat(raw);
    this.#ringOffset = (Number.isFinite(num) ? clamp(/px$/i.test(raw) ? num / this.#rem : num, 0, 2) : FOCUS_RING.offset) * this.#rem;
    this.#iconSize = parseFloat(getComputedStyle(this.#dom.icon).width) || 0;
  }

  /** @param {{ inlineSize: number, blockSize: number }} size */
  #layout({ inlineSize: width, blockSize: height }) {
    const { shape, pill, drop } = this.#dom;
    this.#width = width; this.#height = height;
    shape.setAttribute('width', String(width)); shape.setAttribute('height', String(height));
    pill.setAttribute('width', String(width)); pill.setAttribute('height', String(height)); pill.setAttribute('rx', String(height / 2));
    drop.setAttribute('cy', String(height / 2));
    this.#readTokens();
    this.#render();
  }

  #render() {
    const width = this.#width, height = this.#height, iconSize = this.#iconSize;
    if (!width || !height) return;
    const { wrap, neck, drop, icon, ring } = this.#dom, { body, move, grow, tip } = this.#springs;

    const radius = height / 2;
    const shift = height * (1 + this.#gap);
    const capX = width - radius;
    const dropX = capX + shift * move.pos;
    const dropRadius = radius * Math.max(0, grow.pos);
    const geometry = { height, radius, capX, dropX, dropRadius, reach: height * this.#reach };

    // keeps the button visually centered as it breathes; RTL mirror in dom.js flips this on its own, don't flip the sign here too
    wrap.style.translate = `${-shift / 2 * body.pos}px 0`;
    drop.setAttribute('cx', fixed(dropX)); drop.setAttribute('r', fixed(dropRadius));
    neck.setAttribute('d', neckPath(geometry));

    const ringOffset = this.#ringOffset * this.#springs.ring.pos;
    if (ringOffset > FOCUS_RING.min * this.#rem) {
      ring.setAttribute('d', ringPath(geometry, ringOffset));
      ring.style.opacity = String(Math.min(1, this.#springs.ring.pos * FOCUS_RING.fade));
    } else ring.style.opacity = '0';

    const swayMax = SWAY.max * height, sway = clamp(move.vel * SWAY.gain * height, -swayMax, swayMax);
    const reveal = Math.max(0, tip.pos);
    icon.style.opacity = String(Math.min(1, reveal));
    icon.style.transform = `translate(${fixed(dropX - iconSize / 2 - sway)}px, ${(height - iconSize) / 2}px) scale(${ICON_FROM_SCALE + (1 - ICON_FROM_SCALE) * reveal})`;
  }

  /** @param {'hover' | 'focus' | 'pinned'} flag @param {boolean} on */
  #setFlag(flag, on) {
    if (on === this.#flags.has(flag) || (on && flag === 'hover' && this.#disabled)) return;
    this.#flags[on ? 'add' : 'delete'](flag);
    this.#sync();
  }

  #sync() {
    this.#retune();
    const open = !this.#disabled && this.#flags.size > 0, now = performance.now(), delay = DELAY[open ? 'open' : 'close'];
    if (open) this.#readTokens();
    for (const name of DRIVEN) this.#springs[name].to(+open, delay[name] + this.#options.delay, now);
    this.#springs.ring.jump(+this.#flags.has('focus'));
    if (!this.#frame) { this.#lastTime = now; this.#frame = requestAnimationFrame((time) => this.#tick(time)); }
  }

  /** @param {number} now */
  #tick(now) {
    const delta = clamp((now - this.#lastTime) / 1000, 0, MAX_DELTA); this.#lastTime = now;
    let busy = false;

    for (const spring of this.#allSprings) busy = spring.step(now, delta) || busy;
    this.#render();
    this.#frame = busy ? requestAnimationFrame((time) => this.#tick(time)) : 0;
  }

  detach() {
    this.#abort.abort();
    this.#resizeObserver.disconnect();
    this.#mutationObserver.disconnect();
    cancelAnimationFrame(this.#frame);
    const host = this.#host, dom = this.#dom, slotIcon = dom.icon.firstChild;
    while (dom.label.firstChild) host.append(dom.label.firstChild);
    if (slotIcon) host.append(slotIcon);
    dom.wrap.remove();
    host.classList.remove('goo-button');
    if (!host.classList.length) host.removeAttribute('class');
    host.removeAttribute('data-goo-calm');
    host.removeAttribute('data-goo-pressed');
    for (const prop of [...this.#ownProps]) this.#release(prop);
    if (this.#addedTabindex) host.removeAttribute('tabindex');
  }
}

/** @param {Element} host */
const hasButtonSemantics = (host) => host instanceof HTMLButtonElement || host.getAttribute('role')?.trim().toLowerCase().split(/\s+/)[0] === 'button';

/** @param {Element} host */
export function attach(host) {
  if (!supported || !(host instanceof Element)) return;
  if (host.ownerDocument !== document) { console.warn('goo-button: the element belongs to another document; load the module there', host); return; }
  if (host.classList.contains('goo-button') || host.hasAttribute('data-goo-skip')) return;
  if (!host.isConnected) { console.warn('goo-button: the element must be in the document', host); return; }
  if (!hasButtonSemantics(host)) { console.warn('goo-button: [data-goo] needs a <button> or role="button"', host); return; }
  if (!host.textContent.trim() && !host.hasAttribute('aria-label') && !host.hasAttribute('aria-labelledby')) {
    console.warn('goo-button: the button has no text and no aria-label, so it has no accessible name', host);
  }
  try { registry.set(host, new Goo(/** @type {HTMLElement} */ (host))); } catch (error) { console.warn('goo-button: could not decorate', host, error); }
}

/** @param {Element} host */
export function detach(host) {
  registry.get(host)?.detach();
  registry.delete(host);
}

/** @param {ParentNode} [root] */
export function attachAll(root = document) {
  if (supported) root.querySelectorAll?.('[data-goo]').forEach(attach);
}

export const GooButton = {
  attach, detach, attachAll,
  get motion() { return mode; },
  set motion(value) {
    if (value !== 'calm' && value !== 'full' && value !== 'auto') throw new RangeError("GooButton.motion must be 'calm', 'full' or 'auto'");
    isModePinned = value !== 'auto';
    mode = isModePinned ? value : systemMode();
  },
};
export default GooButton;

if (supported) {
  /** @param {Iterable<Node>} nodes @param {(node: Element) => void} callback */
  const visit = (nodes, callback) => {
    for (const item of nodes) {
      if (item.nodeType !== 1) continue;
      const node = /** @type {Element} */ (item);
      if (node.matches('[data-goo]')) callback(node);
      if (node.firstElementChild) node.querySelectorAll('[data-goo]').forEach(callback);
    }
  };

  const observer = new MutationObserver((records) => records.forEach((record) => {
    visit(record.addedNodes, (node) => node.isConnected && attach(node));
    visit(record.removedNodes, detach);
  }));

  const start = () => { attachAll(); observer.observe(document.documentElement, { childList: true, subtree: true }); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}