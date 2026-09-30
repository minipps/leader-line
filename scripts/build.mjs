// Builds the published files from `src/`:
//
// - `leader-line.min.js`   UMD: CommonJS, AMD, or the `LeaderLine` global of a classic script.
// - `leader-line.mjs`      ES module, `export default LeaderLine`.
// - `types/leader-line.d.mts`, generated from `types/leader-line.d.ts`.
//
// `src/leader-line.ts` runs in the test pages with only its types stripped, reading its helpers
// and the SVG defs from globals. For the build, the types are stripped the same way, every
// `[DEBUG]` region is removed, which uncomments the `@INCLUDE[code:NAME]@` placeholders, and
// those are replaced by the code they name.

import { readFile, writeFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import { minifySync } from 'oxc-minify';
import { removeTag } from './pre-proc.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
/** A file of `src/`: its types are stripped, as the test server does. */
const readSrc = async (path) => (path.endsWith('.ts') ? stripTypeScriptTypes(await read(path)) : read(path));
const write = async (path, content) => {
  await writeFile(new URL(path, root), content);
  console.log(`File "${path}" created.`);
};

const RE_EXPORT = /^[^]*?@EXPORT@\s*(?:\*\/\s*)?([^]*?)\s*(?:\/\*\s*|\/\/\s*)?@\/EXPORT@[^]*$/;
const RE_INCLUDE = /@INCLUDE\[code:([^\n]+?)\]@/g;
const RE_FINAL_SEMICOLON = /;$/;

/** Serializes the values of `src/defs.js` back to code; the `PLUG_BEHIND` sentinel is kept as an identifier. */
function toCode(value, sentinel) {
  if (value === sentinel) return 'PLUG_BEHIND';
  if (typeof value === 'string') return JSON.stringify(value);
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value)
      .map(([key, item]) => `${key}:${toCode(item, sentinel)}`)
      .join(',')}}`;
  }
  return String(value);
}

/** The code for each `@INCLUDE[code:NAME]@` placeholder. */
async function getCode() {
  const sentinel = Symbol('PLUG_BEHIND');
  const context = { PLUG_BEHIND: sentinel };
  vm.runInNewContext(await read('src/defs.js'), context);
  const code = {};
  for (const name of ['DEFS_HTML', 'SYMBOLS', 'PLUG_KEY_2_ID', 'PLUG_2_SYMBOL', 'DEFAULT_END_PLUG']) {
    if (!(name in context)) throw new Error(`src/defs.js does not define ${name}`);
    code[name] = toCode(context[name], sentinel);
  }
  // An expression, included as an initializer: without the statement's semicolon, if any.
  const pickExport = async (path) => (await readSrc(path)).replace(RE_EXPORT, '$1').replace(RE_FINAL_SEMICOLON, '');
  code.anim = await pickExport('src/anim.ts');
  code.pathDataPolyfill = await pickExport('src/path-data-polyfill/path-data-polyfill.js');
  return code;
}

const pkg = JSON.parse(await read('package.json'));
const code = await getCode();
const source = (await readSrc('src/leader-line.ts')).replace(RE_INCLUDE, (match, name) => {
  if (typeof code[name] !== 'string') throw new Error(`Unknown include: ${name}`);
  return code[name];
});

const banner = `/*! ${pkg.title || pkg.name} v${pkg.version} (c) ${pkg.author.name} ${pkg.homepage} */\n`;
const released = removeTag('DEBUG', source);
// A marker the formatter moved away from the code it tags leaves debug code behind.
for (const leftover of [/\[\s*\/?\s*DEBUG\s*\/?\s*\]/, /\btraceLog\s*\./]) {
  const match = leftover.exec(released);
  if (match)
    throw new Error(
      `Debug code left after removing [DEBUG] regions: ${released.slice(match.index - 80, match.index + 80)}`,
    );
}
const minified = minifySync('leader-line.js', released, {
  compress: { target: 'es2022' },
  mangle: { toplevel: false },
  codegen: { removeWhitespace: true },
});
if (minified.errors?.length) {
  throw new Error(minified.errors.map((error) => error.message).join('\n'));
}
// `var LeaderLine=function(){...}();`
const minCode = minified.code.trim().replace(/;?$/, ';');
if (!minCode.startsWith('var LeaderLine=')) {
  throw new Error('The minified code no longer starts with `var LeaderLine=`');
}

await write('leader-line.mjs', `${banner}${minCode}export default LeaderLine;\n`);
await write(
  'leader-line.min.js',
  `${banner}(function(root,factory){` +
    'typeof exports==="object"&&typeof module!=="undefined"?module.exports=factory():' +
    'typeof define==="function"&&define.amd?define([],factory):root.LeaderLine=factory();' +
    `})(typeof self!=="undefined"?self:this,function(){${minCode}return LeaderLine;});\n`,
);
await write(
  'types/leader-line.d.mts',
  (await read('types/leader-line.d.ts')).replace(/^export = LeaderLine;$/m, 'export default LeaderLine;'),
);
