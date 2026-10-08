# FAQ

Answers about what the component is for, what it weighs and how it's built.

## What is it for

Buttons that need a noticeable hover without giving up a real button. `data-goo` goes on a plain `<button>`, so forms, keyboard, focus and screen readers work the same as without the module. In practice that means:

- Where the module can't run, the page still has a normal button.
- You can decorate one button and the rest stay untouched. No new tag, no wrappers.
- The module asks for nothing from outside: no fonts, no icons, no network. The icon and the font are yours.
- It works on a page with a strict CSP and Trusted Types.
- Each button is tuned with its own attributes, without touching the component's code.

What it doesn't do: it doesn't mirror the drop for RTL, and it doesn't reserve space for it (see [limits](usage.md#limits)).

## Why does a button weigh 6 KB

Numbers for v0.1.0:

| Form | Size |
| --- | --- |
| minified | <!--size:min-->14676 B<!--/size--> |
| gzip | <!--size:gzip-->6072 B<!--/size--> |
| brotli | <!--size:brotli-->5416 B<!--/size--> |

The browser downloads the gzip or brotli version, so 5 or 6 KB. The file holds everything the button needs to work without any outside files:

- The component's CSS, about 2.4 KB minified. It's built into the module and applied as a constructed stylesheet.
- The shape math (`shape.js`), about 2 KB. It computes the neck and the focus ring.
- The spring (`spring.js`), about 1 KB.
- The rest, around 9.3 KB, is the component itself: checking attribute values, keyboard handling for `role="button"`, observers for size and attributes, `attach` and `detach`, reduced motion mode, console warnings.

## Why is there more than 500 lines of code

There are 546 lines in four files: `goo-button.js` 318, `dom.js` 104, `shape.js` 78, `spring.js` 46. CSS takes 63 lines of `dom.js`. The demo and the tests aren't counted.

The lines go to things a plain button gets for free and that have to be done by hand once the element stays a real button: keyboard and pressed state for `role="button"`, `disabled` and `aria-disabled`, focus only from the keyboard, removing every listener on `detach`. Validation takes some too: each attribute value is checked for type and range, because it ends up in CSS.

## Why JS and not plain CSS

Whatever can stay in CSS did stay there: colors, sizes, padding and press time are all `--goo-*` tokens. JS is needed for three things CSS can't do.

1. **The neck of the drop.** It's a Bezier curve. Its points come from the angles where two circles (the button and the drop) intersect, and the radius, distance and stretch change every frame. CSS properties can't express a path like that.
2. **The spring.** Position and velocity are stored, so if the cursor leaves mid-motion, the spring continues from its current velocity instead of starting over. The same velocity makes the icon sway a little. A CSS transition doesn't expose velocity.
3. **The focus ring.** It's an enlarged copy of the current silhouette, neck included, computed with the same math. A regular `outline` can't follow that shape.

JS also measures the button's real size with `ResizeObserver`, so the SVG matches the text with any font.

## Why not a custom element

The element stays a real button instead of becoming a new tag. That's why your other buttons are unaffected, and why a user sees a normal button wherever the module can't run.