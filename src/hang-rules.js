/*
 * How far a wrapped code-block line should be indented. Pure, unit-tested.
 *
 * A long line inside a code block wraps back to the left edge. The wrapped part reads
 * better when it starts under the first word of the line: past the leading tabs and
 * spaces and past a list marker such as "3." or "-".
 */

// A list marker at the start of the text: "3." or "3)" (with or without a space after
// it, but not "3.14"), or a bullet "-", "*", "+" followed by a space.
const MARKER = /^(?:\d{1,3}[.)](?!\d)\s*|[-*+]\s+)/;

/**
 * The number of columns the wrapped part of `text` should start at: its indent, with a
 * tab counting up to the next tab stop, plus a list marker after it. 0 when the line has
 * neither, or holds nothing but whitespace.
 */
export function hangColumns(text, tabSize = 4) {
  let col = 0;
  let i = 0;
  for (; i < text.length; i++) {
    const c = text[i];
    if (c === '\t') col += tabSize - (col % tabSize);
    else if (c === ' ') col++;
    else break;
  }
  if (i === text.length) return 0;
  const m = MARKER.exec(text.slice(i));
  if (m) col += m[0].replace(/\t/g, ' '.repeat(tabSize)).length;
  return col;
}

/** Whether a token name from Obsidian's editor belongs to the inside of a code block. */
export function isCodeBlockToken(name) {
  const t = name.split('_');
  return t.includes('hmd-codeblock') && !t.some((x) => x.startsWith('formatting-code-block'));
}
