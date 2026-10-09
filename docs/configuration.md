# Configuration

Every button setting: the `data-goo-*` attributes, CSS tokens and the rules for checking values.

Each option is a `data-goo-<name>` attribute on the button. All of them except `delay`, `stiffness`, `damping`, `skip` and `open` also exist as a CSS custom property, `--goo-<name>`, that you can set from a stylesheet. A bare number gets the unit shown in the table.

| Attribute | Controls | Default | Unit |
| --- | --- | --- | --- |
| `data-goo-text-size` | Text size. The whole button scales with it | `1.25rem` | rem, or any CSS length |
| `data-goo-padding-x` / `data-goo-padding-y` | Padding | `2` / `1` | × text size |
| `data-goo-icon-size` | Icon size | `1` | × text size |
| `data-goo-gap` | Gap between button and drop | `0.16` | × height (0-2) |
| `data-goo-neck-reach` | How far the neck stretches before it breaks | `0.72` | × height (0-4) |
| `data-goo-fill-color` | Button, drop and focus ring color | `light-dark(oklch(0.2 0.04 200), oklch(0.94 0.03 200))` | any CSS color |
| `data-goo-text-color` | Label and icon color | `light-dark(oklch(97% 0 0), oklch(15% 0 0))` | any CSS color |
| `data-goo-press-scale` | Scale while pressed | `0.96` | 0.5-1.5 |
| `data-goo-press-time` | Press transition | `0.16` | s |
| `data-goo-focus-width` | Focus ring stroke width | `0.125` | rem |
| `data-goo-focus-offset` | How far the focus ring sits outside the shape | `0.375` | rem (0-2) |
| `data-goo-delay` | Extra delay before the motion starts | `0` | ms (0-5000) |
| `data-goo-stiffness` / `data-goo-damping` | Spring tuning, per button | `1` / `0.5` | × (0.1-10) |
| `data-goo-open` | Keep the drop open, as if hovered (for demos, screenshots and tests) | not set | boolean |
| `data-goo-skip` | Leave this button alone, including for `attach` | not set | |

Example:

```html
<button type="button" data-goo data-goo-fill-color="oklch(0.55 0.22 27)" data-goo-neck-reach="1">Delete</button>
```

## How values are checked

Values are checked by type, never guessed:

- `padding-x`, `padding-y`, `icon-size`, `gap`, `neck-reach`, `focus-offset` and `press-scale` take plain numbers and are clamped to their range. `data-goo-padding-x="1.5rem"` is ignored, and `99` becomes `8`.
- `text-size`, `focus-width` and `press-time` take a bare number (rem, rem, seconds) or a CSS length or time.
- `fill-color` and `text-color` take a color.
- Every value must pass the browser's own CSS parser. It must not contain `url(`, `image-set(`, `expression(`, a comment opener, or any of `; { } < > \`, and it must be shorter than 120 characters.

A rejected value is ignored and logged with `console.warn`.

## CSS only

- `--goo-white-space: nowrap` keeps a label on one line. The default is `normal`, so a long label wraps.
- `--goo-color-time` (default `0s`) fades the fill and label colors over that time. Set it while your theme flips.
- `--goo-focus-offset` set in a stylesheet is read as rem. A value in `px` is converted.
- `data-goo-focus-offset` takes a plain number only. `data-goo-text-size` and `data-goo-focus-width` also take any CSS length (`1.5rem`, `calc(...)`).
- `--goo-gap`, `--goo-neck-reach` and `--goo-focus-offset` set in a stylesheet are read when the drop opens (hover, focus or `data-goo-open`), not on every frame. A change made while the button is closed applies on the next open. Setting the matching `data-goo-*` attribute applies at once.

## Changing at runtime

Attributes can change with `setAttribute`. The button picks the change up immediately, geometry tokens included, because a `MutationObserver` watches them. Removing `data-goo` undoes the decoration, like `detach`. To decorate the element again, add the attribute back and call `attach(el)`.