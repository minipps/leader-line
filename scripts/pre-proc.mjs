// `removeTag()` of pre-proc (https://github.com/anseki/pre-proc, MIT), which the build used to
// depend on for this single function. It removes, for a tag such as `DEBUG`:
//
// - every line that contains `[DEBUG/]`,
// - `/* [DEBUG] */ ... /* [/DEBUG] */` and `<!-- [DEBUG] --> ... <!-- [/DEBUG] -->` regions,
// - `// [DEBUG]` ... `// [/DEBUG]` regions, from the opening line to the end of the closing one.

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\/!-]/g, '\\$&');

function createTagPatterns(tag) {
  const SP = '[^\\S\\n\\r]'; // whitespace except line breaks
  const BEFORE_BLOCK = '(?:\\n\\s*)?';
  const AFTER_BLOCK = `${SP}*`;
  const name = `\\s*${escape(tag.trim())}\\s*`;
  const start = `\\[${name}\\]`;
  const end = `\\[\\s*/${name}\\]`;
  return [
    `[^\\n]*\\[${name}/\\s*\\][^\\n]*\\n?`,
    `${BEFORE_BLOCK}/\\*\\s*${start}\\s*\\*/([^]*?)/\\*\\s*${end}\\s*\\*/${AFTER_BLOCK}`,
    `${BEFORE_BLOCK}<\\!\\-\\-\\s*${start}\\s*\\-\\->([^]*?)<\\!\\-\\-\\s*${end}\\s*\\-\\->${AFTER_BLOCK}`,
    `\\n?${SP}*//${SP}*${start}[^\\n]*\\n+([^]*?)//${SP}*${end}[^\\n]*`,
  ].map((pattern) => new RegExp(pattern, 'g'));
}

export function removeTag(tag, content) {
  return createTagPatterns(tag).reduce((result, pattern) => result.replace(pattern, ''), `${content}`);
}
