// Generates `src/defs.js` (the SVG symbols of the plugs and the base CSS) from
// `src/symbols.html` and `src/leader-line.css`. The HTML is parsed by a real browser, the same
// headless Chromium the tests run in. Run it only after changing one of those two files.

import { readFile, writeFile } from 'node:fs/promises';
import htmlclean from 'htmlclean';
import { launch } from './browser.mjs';

const APP_ID = 'leader-line';
const DEFS_ID = `${APP_ID}-defs`;
const DEFAULT_LINE_SIZE = 4; // DEFAULT_OPTIONS.lineSize
const root = new URL('../', import.meta.url);

/** Enough CSS minification for `leader-line.css`: comments, whitespace and last semicolons. */
function minifyCss(css) {
  return css
    .replace(/\/\*[^]*?\*\//g, '')
    .replace(/^\s*@charset\s+[^;]+;/gm, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,>~+])\s*/g, '$1')
    .replace(/\s*!important/g, '!important')
    .replace(/;}/g, '}')
    .trim();
}

/** Runs in the page: reads the symbols as the old cheerio-based Gruntfile task did. */
function readSymbols({ APP_ID, DEFAULT_LINE_SIZE }) {
  const symbols = {};
  const plugKey2Id = { behind: null }; // null: `PLUG_BEHIND`
  const plug2Symbol = {};
  const vars = {};
  const serializer = new XMLSerializer();
  let markup = '';

  for (const svg of document.querySelectorAll('svg')) {
    const symbol = svg.querySelector('.symbol');
    const size = svg.querySelector('.size');
    const id = symbol?.id;
    if (!symbol || !size || !id) continue;

    const elmId = `${APP_ID}-${id}`;
    const props = `${symbol.getAttribute('class')}`.split(' ');
    const element = symbol.cloneNode(true);
    element.id = elmId;
    element.removeAttribute('class');
    markup += serializer.serializeToString(element).replace(' xmlns="http://www.w3.org/2000/svg"', '');

    const conf = (symbols[id] = { elmId });
    let noOverhead = false;
    for (const prop of props) {
      let matches;
      if ((matches = /prop-([^\s]+)/.exec(prop))) conf[matches[1]] = true;
      else if ((matches = /varId-([^\s]+)/.exec(prop))) vars[matches[1]] = id;
      else if (prop === 'no-overhead') noOverhead = true;
    }

    const bBox = (conf.bBox = {
      left: Number.parseFloat(size.getAttribute('x')),
      top: Number.parseFloat(size.getAttribute('y')),
      width: Number.parseFloat(size.getAttribute('width')),
      height: Number.parseFloat(size.getAttribute('height')),
    });
    bBox.right = bBox.left + bBox.width;
    bBox.bottom = bBox.top + bBox.height;

    conf.widthR = bBox.width / DEFAULT_LINE_SIZE;
    conf.heightR = bBox.height / DEFAULT_LINE_SIZE;
    conf.bCircle = Math.max(-bBox.left, -bBox.top, bBox.right, bBox.bottom);
    conf.sideLen = Math.max(-bBox.top, bBox.bottom);
    conf.backLen = -bBox.left;
    conf.overhead = noOverhead ? 0 : bBox.right;

    const outlineBase = svg.querySelector('.outline-base');
    const outlineMax = svg.querySelector('.outline-max');
    if (outlineBase && outlineMax) {
      conf.outlineBase = Number.parseFloat(outlineBase.getAttribute('stroke-width')) / 2;
      conf.outlineMax = Number.parseFloat(outlineMax.getAttribute('stroke-width')) / 2 / conf.outlineBase;
    }

    plugKey2Id[id] = id;
    plug2Symbol[id] = id;
  }
  return { markup, symbols, plugKey2Id, plug2Symbol, vars };
}

/** Same output format as the old task: unquoted keys, single-quoted strings. */
function toCode(value) {
  if (value === null) return 'PLUG_BEHIND';
  if (typeof value === 'string') return `'${value}'`;
  if (typeof value === 'object') {
    return `{${Object.entries(value)
      .map(([key, item]) => `${key}:${toCode(item)}`)
      .join(',')}}`;
  }
  return String(value);
}

const browser = await launch();
try {
  // Parse only: the page has scripts of its own, for viewing the symbols, that rewrite them.
  const page = await browser.newPage({ javaScriptEnabled: false });
  await page.setContent(await readFile(new URL('src/symbols.html', root), 'utf8'), { waitUntil: 'domcontentloaded' });
  const { markup, symbols, plugKey2Id, plug2Symbol, vars } = await page.evaluate(readSymbols, {
    APP_ID,
    DEFAULT_LINE_SIZE,
  });

  const css = minifyCss(await readFile(new URL('src/leader-line.css', root), 'utf8'));
  // htmlclean also compacts the path data of the symbols.
  const defsHtml = htmlclean(
    `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" id="${DEFS_ID}">` +
      `<style><![CDATA[${css}]]></style><defs>${markup}</defs></svg>`,
  );
  const code = {
    DEFS_HTML: `'${defsHtml.replace(/'/g, "\\'")}'`,
    PLUG_BEHIND: "'behind'",
    SYMBOLS: toCode(symbols),
    PLUG_KEY_2_ID: toCode(plugKey2Id),
    PLUG_2_SYMBOL: toCode(plug2Symbol),
    ...Object.fromEntries(Object.entries(vars).map(([name, id]) => [name, `'${id}'`])),
  };

  await writeFile(
    new URL('src/defs.js', root),
    `var ${Object.entries(code)
      .map(([name, value]) => `${name}=${value}`)
      .join(',')};`,
  );
  await writeFile(new URL('src/symbols.json', root), JSON.stringify(symbols));
  console.log('File "src/defs.js" created.');
} finally {
  await browser.close();
}
