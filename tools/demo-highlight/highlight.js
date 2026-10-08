import './highlight-setup.js';
import Prism from 'prismjs/components/prism-core.js';
import 'prismjs/components/prism-markup.js';

// shell command: "pnpm add goo-button", aliases reuse the markup colors
Prism.languages.sh = {
  command: { pattern: /^\S+(?:\s+[^\s-]\S*)?/, inside: { tag: /^\S+/, 'attr-name': /\S+$/ } },
  flag: { pattern: /(\s)--?[\w-]+/, lookbehind: true, alias: 'attr-name' },
  argument: { pattern: /\S+/, alias: 'attr-value' },
};

// trusted types blocks innerHTML, so tokens become dom nodes
const render = (tokens, parent) => {
  for (const token of tokens) {
    if (typeof token === 'string') { parent.append(token); continue; }
    const span = document.createElement('span');
    span.className = ['token', token.type, ...[].concat(token.alias ?? [])].join(' ');
    render([].concat(token.content), span);
    parent.append(span);
  }
};

export const highlight = (code) => {
  const text = code.textContent;
  code.replaceChildren();
  render(Prism.tokenize(text, Prism.languages[code.dataset.lang]), code);
};