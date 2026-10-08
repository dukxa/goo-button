# Usage

Tasks you'll run into when working with the button: font, colors, icons, states, frameworks and limits. Installation is in the [README](../README.md).

## Which element you can mark

Any `<button>` or `<a role="button">` works. A plain `<div data-goo>` is refused with a console warning, because the module relies on real button semantics for keyboard, forms and assistive tech. On an element that isn't a `<button>`, the module adds what a button has natively: it makes the element focusable and activates it with Enter and Space.

If a button has no text and no `aria-label`, the console warns that it has no accessible name.

## Set the font

The button inherits the page font. Border, background and padding are reset, so it takes your font, weight and cursor like any text. Page rules always win over the reset:

```css
[data-goo] { font-family: "Manrope", system-ui, sans-serif; font-weight: 600; }
```

## Set the colors

By default the fill and the text follow `color-scheme` through `light-dark()`. Declare it on the page, or on the class that switches your theme:

```css
:root { color-scheme: light dark; }
.theme-dark { color-scheme: dark; }
```

Without a `color-scheme`, `light-dark()` resolves to its light value. You can also set colors explicitly with `data-goo-fill-color` and `data-goo-text-color` (see [configuration](configuration.md)).

Check the contrast of your own colors. The focus ring is drawn in the fill color, so check two ratios: the text against the fill at 4.5:1 (WCAG 1.4.3), and the fill against the page behind the button at 3:1 (WCAG 1.4.11).

To fade colors when your theme flips, set `--goo-color-time` (CSS only, default `0s`) for the duration of the switch.

## Add an icon

The icon goes in `slot="icon"`. Without one you get a plain drop. Any markup works. The component only sizes the box (`--goo-icon-size` × text size). `fill`, `stroke` and weight are yours:

```html
<button type="button" data-goo>Next <svg slot="icon" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="..."/></svg></button>
<button type="button" data-goo>Next <img slot="icon" src="arrow.svg" alt=""></button>
<button type="button" data-goo>Next <i slot="icon" class="your-icon-font"></i></button>
```

`currentColor` follows the text color. The icon box is hidden from assistive tech, so an icon-only button needs its own `aria-label`.

## States

- **Disabled.** `disabled` closes the drop and dims the button. `aria-disabled="true"` does the same, but the button stays focusable, so the focus ring still shows. Native `disabled` blocks `click`. `aria-disabled` doesn't, so check it in your handler.
- **Pointer.** Mouse and pen open the drop on hover. Touch has no hover, so the drop opens while the finger is down.
- **Hit area.** The drop is part of the button. Hovering or clicking it counts as hovering or clicking the button. The click lands on an inner element, so use `event.currentTarget`, not `event.target`, in handlers.

## Focus ring

Keyboard focus (`:focus-visible`) draws a contour around the button: a scaled-up copy of its current silhouette, including the neck once the drop has grown. It uses the same math as the fill, drawn `data-goo-focus-offset` further out at `data-goo-focus-width`, so it matches the shape even mid-animation. It appears and disappears at once, with no spring, because keyboard focus isn't animated. The native outline is hidden, except in forced-colors mode, where it stays as a system-colored fallback. Under `prefers-contrast: more`, the ring is drawn 1.5× thicker.

## Reduced motion

The module follows `prefers-reduced-motion` live. In that mode the springs are damped harder: the drop still moves, but the bounces are smaller and settle faster. To override it, see [api](api.md#goobuttonmotion).

## Frameworks and shadow DOM

- **Shadow DOM.** Buttons inside a shadow root aren't seen by the page-level observer. Call `attachAll(shadowRoot)` after the content renders. The styles are adopted into that root automatically.
- **Frameworks.** The module moves the button's children into an inner wrapper. A framework that later rewrites those children, such as a reactive label, can lose track of them. Keep the label static, or call `detach(el)` before the update and `attach(el)` after it.
- **Class rewrites.** If a framework rewrites `class`, the `goo-button` marker is put back.
- **SSR hydration.** The module moves the button's children before the framework hydrates, which can cause a hydration mismatch. Call `attach` after hydration, or mark such buttons with `data-goo-skip` and attach them from `onMounted` or `useEffect`.
- **Iframes.** An element from another document isn't attached, and a console warning is logged. Load the module inside that document too.
- **Two copies.** If the module loads twice, the second copy skips buttons the first one already attached.

## Limits

- **Clipping.** The drop and the focus ring are drawn outside the button's box. The shape shifts left by half of the drop's travel to stay centered, so about 0.6 × the button height is used on each side (more with a larger `data-goo-gap`). The space isn't reserved. An ancestor with `overflow: hidden` cuts them off, and a clipped focus ring makes keyboard focus invisible.
- **Direction.** The drop always opens to the right. Right-to-left layouts and vertical writing modes aren't mirrored.
- **Size.** Keep the button at least 1.2 × 1.2 rem (the WCAG 2.5.8 target size, with a 20-pixel root). The component doesn't clamp size or padding.
- **Detach.** `detach` returns the icon to the end of the button, which can differ from its original position.
- **Long labels** wrap by default. `--goo-white-space: nowrap` keeps one line.

## Older browsers

The module relies on `ResizeObserver`, `MutationObserver`, constructable stylesheets (`CSSStyleSheet.replaceSync` and `adoptedStyleSheets`), `oklch()` and `light-dark()`. If constructable stylesheets, `ResizeObserver` or `oklch()` are missing, the module does nothing and the plain button stays. Without `light-dark()`, the default colors fall back to the light pair, so set `data-goo-fill-color` and `data-goo-text-color` for dark themes there.

## Security

- The slotted icon is your markup and isn't sanitized. Never pass untrusted SVG into `slot="icon"`.
- A CDN link is only as safe as its pin. Use an exact version, never `@latest` or a range.
- `data-goo` only decorates elements with real button semantics (`<button>` or `role="button"`). Anything else is refused, so the script can't make arbitrary page content clickable.