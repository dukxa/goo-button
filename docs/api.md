# API

The module's JS interface. Buttons are attached automatically: on load, and afterward for any `[data-goo]` element added to the page. You only need the API for edge cases. Types ship in `goo-button.d.ts`.

```js
import { GooButton, attach, attachAll, detach } from 'goo-button'
```

## attach(el)

Decorates one element. It needs a `<button>` or `role="button"`, and elements with `data-goo-skip` are ignored. If the element doesn't fit, a warning goes to the console.

## detach(el)

Undoes it: restores the original children and removes listeners and observers.

## attachAll(root?)

Decorates every `[data-goo]` under `root` (default `document`). Use it for shadow roots.

## GooButton.motion

The global motion mode. Reading it returns the mode in effect, `'calm'` or `'full'`. Assigning pins the mode, and `'auto'` hands control back to the system:

```js
GooButton.motion            //=> 'calm' or 'full'
GooButton.motion = 'calm'   // pin calm for everyone, whatever the system says
// GooButton.motion = 'full'  // pin full, the same way
GooButton.motion = 'auto'   // stop pinning and follow the system again
// GooButton.motion = 'fast'  // throws a RangeError: only 'calm', 'full' and 'auto' are accepted
```

`GooButton` is also the default export: `import GooButton from 'goo-button'`.