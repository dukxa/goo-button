# goo-button

A button that pulls a drop out of its edge on hover or focus, with your icon riding inside it. It's an ES module, not a custom element: it decorates any real `<button>` (or `role="button"`) marked with `data-goo` and leaves your other buttons alone. Where the module can't run, the plain button stays.

- **Size.** <!--size:min-->14676 B<!--/size--> minified, <!--size:gzip-->6072 B<!--/size--> gzip, <!--size:brotli-->5416 B<!--/size--> brotli (v1.2.4). See the [FAQ](docs/faq.md) for what's in those bytes.
- **A real button.** Forms, keyboard and screen readers work as with any `<button>`. The element isn't replaced and there's no new tag.
- **No dependencies.** No network requests, fonts, icons, `innerHTML` or `eval`.
- **Strict CSP.** No inline styles in the markup. Styles come from a constructed stylesheet. It runs under Trusted Types, and attribute values are checked before they reach CSS.
- **Vector shapes.** The drop, the neck and the focus ring are SVG paths, so edges stay sharp at any size.
- **Springs.** Each one lasts 0.5 s with a bounce of 0.2, and the parts start 40 ms apart. You can tune them per button.
- **Accessibility.** It respects `prefers-reduced-motion`, `forced-colors`, `disabled` and `aria-disabled`. The focus ring follows the button's shape, drop included.

```html
<script type="module"
        src="https://cdn.jsdelivr.net/npm/goo-button@1.2.4/goo-button.min.js"></script>

<button type="button" data-goo data-goo-fill-color="oklch(0.5 0.2 260)">
  Open
  <svg slot="icon" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M224.49,136.49l-72,72a12,12,0,0,1-17-17L187,140H40a12,12,0,0,1,0-24H187L135.51,64.48a12,12,0,0,1,17-17l72,72A12,12,0,0,1,224.49,136.49Z"/></svg>
</button>
```

You get a blue button labeled "Open". On hover or focus a drop slides out of its right edge and an arrow appears inside it. The icon is Phosphor's `arrow-right` (Bold).

## Getting started

Works in Chrome and Edge 111+, Safari 16.4+, Firefox 113+, Samsung Internet 22+ and Android Browser 154+.

Load the module from a CDN. Pin an exact version, not `@latest` or a range.

```html
<script type="module"
        src="https://cdn.jsdelivr.net/npm/goo-button@1.2.4/goo-button.min.js"></script>
```

Or install it from npm:

```sh
pnpm add goo-button
```

```js
import 'goo-button'
```

The module starts as soon as it loads. It finds every `[data-goo]`, including ones added later. Mark a button like this:

```html
<button type="button" data-goo>Save</button>
```

Write `type="button"` as on any button. Without it, a button inside a `<form>` submits the form.

Fonts, colors, icons and the rest are covered below.

## Docs

- [usage](docs/usage.md): fonts, colors, icons, states, focus, reduced motion, frameworks, limits.
- [configuration](docs/configuration.md): every `data-goo-*` attribute and CSS token in one table.
- [api](docs/api.md): `attach`, `detach`, `attachAll`, `GooButton.motion`.
- [faq](docs/faq.md): what it's for, why it weighs what it does and why it's written in JS.

The repo also has a demo with sliders, color pickers and a code generator. Run `pnpm install`, then `pnpm demo`, and open http://localhost:5173/demo/.

## Credits

Demo icons: [Phosphor Icons](https://phosphoricons.com) (MIT). Demo fonts are in `demo/assets/fonts/` under the SIL Open Font License: Google Sans Flex, Manrope and Google Sans Code. All third-party license texts (icons and fonts) live in `demo/LICENSES/`.

## License

MIT © 2026 Dukxa. See [LICENSE](LICENSE).