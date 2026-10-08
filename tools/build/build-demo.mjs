import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const resolvePath = (file) => fileURLToPath(new URL(file, import.meta.url));

// demo-only syntax highlighter (prism core + markup), not part of the library build
await build({
  entryPoints: [resolvePath('../demo-highlight/highlight.js')],
  outfile: resolvePath('../../demo/src/highlight.min.js'),
  bundle: true,
  format: 'esm',
  minify: true,
  target: 'es2022',
  legalComments: 'none',
});

// bundle goo-button itself into the demo so it's served same-origin
// (the demo page's strict CSP only allows script-src 'self', so it can't
// load the library from a CDN or from outside the published demo/ folder)
await build({
  entryPoints: [resolvePath('../../package/src/goo-button.js')],
  outfile: resolvePath('../../demo/src/goo-button.js'),
  bundle: true,
  format: 'esm',
  minify: false,
  target: 'es2022',
  legalComments: 'none',
});