import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, constants as zlibConstants, gzipSync } from 'node:zlib';

const resolvePath = (file) => fileURLToPath(new URL(file, import.meta.url));
const { name, version, license } = JSON.parse(readFileSync(resolvePath('../../package/package.json'), 'utf8'));
const outFile = resolvePath('../../package/goo-button.min.js');

// esbuild doesn't minify css inside a js template literal, stripped here by hand
const squeeze = (source) => {
  let found = false;
  const result = source.replace(/(const STYLES = `)([^`]*)`/, (_, head, css) => {
    found = true;
    return `${head}${css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s*\n\s*/g, ' ').trim()}\``;
  });
  if (!found) throw new Error('build: the "const STYLES = `…`" template was not found in dom.js');
  return result;
};
const squeezeCss = {
  name: 'squeeze-css',
  setup: (pluginBuild) => pluginBuild.onLoad({ filter: /dom\.js$/ }, ({ path: file }) => ({
    loader: 'js',
    contents: squeeze(readFileSync(file, 'utf8')),
  })),
};

await build({
  entryPoints: [resolvePath('../../package/src/goo-button.js')],
  outfile: outFile,
  bundle: true,
  plugins: [squeezeCss],
  format: 'esm',
  minify: true,
  target: 'es2022',
  legalComments: 'none',
  banner: { js: `/*! ${name} v${version} | ${license} */` },
});

const code = readFileSync(outFile);
const versionPin = [new RegExp(`${name}@\\d+\\.\\d+\\.\\d+`, 'g'), `${name}@${version}`];

const syncFile = (file, replacements) => {
  let text = readFileSync(resolvePath(`../../${file}`), 'utf8');
  for (const [pattern, value] of replacements) text = text.replace(pattern, value);
  writeFileSync(resolvePath(`../../${file}`), text);
};
syncFile('README.md', [versionPin]);
syncFile('demo/index.html', [versionPin, [/(<span class="version"><span class="sr-only">version <\/span>)[^<]*/, `$1${version}`]]);

const sizes = { min: code.length, gzip: gzipSync(code, { level: 9 }).length, brotli: brotliCompressSync(code, { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 11 } }).length };
const sizeMarker = (key) => [new RegExp(`(<!--size:${key}-->)[^<]*(<!--/size-->)`, 'g'), `$1${sizes[key].toLocaleString('en-US').replace(/,/g, '')} B$2`];
const sizeFiles = ['docs/faq.md', 'README.md'];
for (const file of sizeFiles) {
  try { syncFile(file, [sizeMarker('min'), sizeMarker('gzip'), sizeMarker('brotli')]); } catch (error) { if (error.code !== 'ENOENT') throw error; } // not every checkout has docs/faq.md
}

console.log(`${name}@${version}`);
console.log(`min     ${sizes.min} B`);
console.log(`gzip    ${sizes.gzip} B`);
console.log(`brotli  ${sizes.brotli} B`);