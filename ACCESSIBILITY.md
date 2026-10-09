# Accessibility

goo-button is built on a real `<button>` (or `role="button"`), so baseline accessibility comes free from the browser: forms, keyboard, and screen readers work like with any normal button. The module adds a few things on top of that, and wherever it can't guarantee them, it just does nothing and the page is left with a plain button.

## What's already covered

- **Keyboard.** Native for `<button>`. For `role="button"` on a non-button element, the module adds focusability and Enter/Space activation itself.
- **Focus ring.** On `:focus-visible`, an outline is drawn that follows the button's current shape, drop included. It appears and disappears without animation, since a keyboard focus indicator shouldn't move. Under `forced-colors`, the custom ring is dropped in favor of the system outline. Under `prefers-contrast: more`, the ring is drawn 1.5 times thicker.
- **Reduced motion.** The module watches `prefers-reduced-motion` live. In that mode the springs are more damped: the motion is still there, just without sharp jumps and settling faster.
- **disabled and aria-disabled.** Both close the drop and dim the button. Native `disabled` blocks the click, `aria-disabled` doesn't, so you still need to check for it in your own handler.
- **Icon.** The icon slot is hidden from screen readers (`aria-hidden`), so it doesn't get read as a separate element. If a button is icon-only with no text, it needs its own `aria-label`, otherwise a warning gets logged for a missing accessible name.
- **Contrast.** Default colors follow `color-scheme` through `light-dark()`. With custom colors through `data-goo-fill-color` and `data-goo-text-color`, you need to check contrast yourself: text against the fill (4.5:1 under WCAG 1.4.3) and the fill against the page background (3:1 under WCAG 1.4.11). The module doesn't check this for you.

## What you still need to check

- **Target size.** The recommended minimum button size is 1.2 x 1.2 rem (WCAG 2.5.8 at a 20px root). The module doesn't constrain size or padding, that's on whoever builds the page.
- **Accessible name.** If a button has no text and no `aria-label`, a warning gets logged to the console. Add text or an `aria-label`.
- **RTL.** The drop always opens to the right. It isn't mirrored for RTL layouts or vertical writing modes. That's a documented limitation, not a bug.

## Known limitations

- **Older browsers.** The module needs `ResizeObserver`, `MutationObserver`, constructable stylesheets (`CSSStyleSheet.replaceSync` and `adoptedStyleSheets`), `oklch()`, and `light-dark()`. If any of the first three are missing, the module does nothing and you're left with a plain button, so accessibility doesn't break. Without `light-dark()`, the default colors fall back to the light pair, so for dark mode in that case you need to set `data-goo-fill-color` and `data-goo-text-color` yourself.
- **Clipping.** The drop and the focus ring render outside the button's box. If a parent has `overflow: hidden`, they get clipped, and in particular the focus ring can become invisible during keyboard navigation. Make sure there's enough free space around the button, roughly 0.6 of the button's height on each side, more with a larger `data-goo-gap`.

## Reporting an accessibility issue

If you run into an accessibility problem that isn't listed above, open an issue in the [repo](https://github.com/dukxa/goo-button/issues) describing which assistive technology you're using and what's going wrong.
