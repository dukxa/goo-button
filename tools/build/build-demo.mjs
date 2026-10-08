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