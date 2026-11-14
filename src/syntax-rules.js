/*
 * Which parts of a line count as Markdown syntax to hide. Pure, unit-tested.
 *
 * Obsidian's editor names every token after its CSS classes joined with "_", for
 * example "formatting_formatting-strong_strong" for the ** of bold text. The names are
 * not a public API; test/e2e/tools/syntax-dom.e2e.mjs prints them for a sample note.
 */

// Markers that stay visible: list bullets and checkboxes are part of the text, a tag
// without its # is no tag, and a code fence carries the language.
const KEEP = ['formatting-list', 'formatting-task', 'formatting-hashtag', 'formatting-code-block', 'formatting-math'];

/** Markers at the start of a line that style the whole line (heading, quote). */
export function isLineMarker(name) {
  return /(^|_)formatting-(header|quote)(_|$)/.test(name);
}

/**
 * Returns a function that says for each token of a line, in order, whether to hide it.
 * It keeps a little state: the URL of [text](url) is hidden, a bare URL is not.
 */
export function tokenHider() {
  let urlEnd = -1; // where the hidden part of a link's "(url)" ends so far
  return (name, from, to) => {
    const t = name.split('_');
    if (t.some((x) => KEEP.some((k) => x === k || x.startsWith(k + '-')))) return false;
    if (t.includes('formatting-link-string')) {
      urlEnd = to;
      return true;
    }
    if (t.includes('string') && t.includes('url')) {
      if (from !== urlEnd) return false;
      urlEnd = to;
      return true;
    }
    return t.includes('formatting') || t.includes('formatting-link') || t.includes('formatting-escape')
      || t.includes('link-has-alias') || t.includes('link-alias-pipe');
  };
}

/* ---------- inline HTML such as <mark style="background: #FFF3A3A6;">text</mark> ---------- */

const TAG_RE = /<(\/?)(mark|u|sub|sup|span|font|b|i|s|strong|em)\b([^<>]*)>/gi;
const SAFE_VALUE = /^[#\w\s(),.%-]+$/;

/** The value of one property in a tag's style attribute, or '' (only plain colour values pass). */
export function styleValue(attrs, prop) {
  const m = /style\s*=\s*(["'])(.*?)\1/i.exec(attrs || '');
  if (!m) return '';
  for (const part of m[2].split(';')) {
    const i = part.indexOf(':');
    if (i < 0) continue;
    const key = part.slice(0, i).trim().toLowerCase();
    const value = part.slice(i + 1).trim();
    if ((key === prop || key === prop + '-color') && SAFE_VALUE.test(value)) return value;
  }
  return '';
}

// How the text between the tags looks while the tags themselves are hidden.
function lookOf(name, attrs) {
  if (name === 'mark') {
    const bg = styleValue(attrs, 'background');
    return bg ? { style: `background-color: ${bg}` } : { class: 'cm-highlight' };
  }
  if (name === 'u') return { style: 'text-decoration: underline' };
  if (name === 's') return { class: 'cm-strikethrough' };
  if (name === 'b' || name === 'strong') return { class: 'cm-strong' };
  if (name === 'i' || name === 'em') return { class: 'cm-em' };
  if (name === 'sub') return { class: 'onenote-sub' };
  if (name === 'sup') return { class: 'onenote-sup' };
  const color = styleValue(attrs, 'color');
  const bg = styleValue(attrs, 'background');
  const style = [color && `color: ${color}`, bg && `background-color: ${bg}`].filter(Boolean).join('; ');
  return style ? { style } : null;
}

/**
 * The matched tag pairs of one line: where the opening and closing tag sit and how the
 * text between them should look. Tags without a partner on the same line are left alone.
 */
export function htmlPairs(text) {
  const out = [];
  const open = [];
  for (const m of text.matchAll(TAG_RE)) {
    const name = m[2].toLowerCase();
    const from = m.index;
    const to = from + m[0].length;
    if (!m[1]) {
      open.push({ name, from, to, attrs: m[3] });
      continue;
    }
    let i = open.length - 1;
    while (i >= 0 && open[i].name !== name) i--;
    if (i < 0) continue;
    const o = open[i];
    open.length = i;
    out.push({ name, open: [o.from, o.to], close: [from, to], look: lookOf(name, o.attrs) });
  }
  return out;
}
