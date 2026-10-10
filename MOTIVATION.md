# Why this project exists

This is a personal project, not a library I'm pushing for production use. The whole scope is one button. I wanted to find out how far a single component could go. I wanted to work that out by actually writing the code, not by reading about it in someone else's article.

It shows in the numbers: one component, a few hundred lines, 6 KB of brotli for a single button. That's not a budget I'd defend in a real product. It's what you get when the goal is "how much can one element do" instead of "what's the minimum that works."

## What's here beyond a plain button with a hover effect

None of the items below are needed just to make a drop slide out on hover. Each one is a separate decision, and each can be cut without breaking the rest.

- **WCAG contrast with automatic correction.** `data-goo-wcag-color` keeps the fill and text at a passing contrast (3:1 against the page, 4.5:1 for text against the fill), shifting the lightness of `oklch()` colors in real time. A typical CTA only needs to check contrast once in Figma.
- **RTL mirroring.** The drop, neck, and focus ring mirror through `:dir(rtl)`, while the icon itself stays upright. Only multilingual interfaces with Arabic, Hebrew, and similar scripts need this.
- **`forced-colors` and `prefers-contrast: more` support.** Under Windows High Contrast, the custom ring steps aside for the system outline; under increased contrast, the ring draws 1.5 times thicker. Most buttons never touch these specific media queries.
- **`prefers-reduced-motion` with live switching.** The springs don't just turn off once. A `change` listener flips the mode on the fly, with no page reload.
- **CSS-injection guards on attributes.** Every `data-goo-*` value passes through `parseValue`, which rejects anything containing `url(`, `image-set(`, `expression(`, `; { } < >`, or `\`, and anything over 120 characters. This only matters if attribute values can come from an untrusted source, like a CMS or user input.
- **A MutationObserver watching itself.** The button tracks its own attributes and `class`, picking up external changes in real time without needing an update call.
- **17 configurable attributes with range clamping** (`neck-reach`, `gap`, `stiffness`, `damping`, `press-scale`, and more). A plain button gets by with two or three CSS variables.
- **A small API of its own.** `attach`, `detach`, `attachAll`, and `GooButton.motion` are the kind of thing dynamic content needs (SPA routing, infinite scroll), not a static page.
- **Trigonometric geometry for the neck and focus ring,** recomputed every frame through `ResizeObserver` and a custom spring engine that keeps velocity between hovers.

## What it's for

- Finding out what each piece actually costs by building it, not by guessing.
- Leaving behind something a browser can run, something `docs/faq.md` breaks down piece by piece: what it is, why there's so much code, and where the weight goes. That beats a one-off CodePen I'll forget about in a week.
- Giving people a reference point. The code is small enough to read in one sitting and cut from.

## Where you could use it as is

Motion in an interface earns its place when it signals that an action matters, not when it's decoration for its own sake, and when it respects `prefers-reduced-motion` and accessibility defaults. This level of effort makes sense where a button is the single, clear action on the screen rather than one of many. You can add it via jsdelivr or `pnpm add goo-button`, no forking or trimming required:

- **A landing page's main CTA** ("Get started," "Request a demo"). A noticeable hover underlines that this is the main action on the page, not one choice among several.
- **A checkout or payment button.** WCAG contrast and accessibility aren't optional here in many jurisdictions; they're required by law, not just good practice.
- **A button in a product or promo site's hero section**, where the site is already built around motion and detail, say a landing page for a design tool or dev tool. The button won't look out of place against the rest.
- **A featured button in a component showcase or design system**, shown as a sample rather than deployed across a whole product, where attention is already focused on one element.

The 6 KB doesn't grow with how many buttons are on the page; it's one reusable module. But it shouldn't go on every button in an interface: secondary actions, buttons inside tables, repeated list items, confirmation dialogs. There, motion on every instance works against the user instead of for them. Attention splits across too many equally loud animations, and in a dialog it's already focused by the text; an extra animation on the confirm button just distracts from the decision itself. That's what the trimming below is for.

## If you want less of it

Fork it and cut what you don't need. The contrast check, the CSS-injection guards, RTL handling, and the spring are self-contained enough to pull one out without unwinding the rest. AI is a reasonable way to do that cut fast: point it at `package/src/` and [`docs/faq.md`](docs/faq.md), which lay out what each piece costs and why it's there, and ask it to keep only what you need.

## What I'd actually want feedback on

Not "should this be smaller," that's a deliberate choice. More useful: whether the shape math in `shape.js` or the spring in `spring.js` has bugs, whether the accessibility behavior described in `ACCESSIBILITY.md` holds up in the screen reader you actually use, and where the docs claim something the code doesn't do.
