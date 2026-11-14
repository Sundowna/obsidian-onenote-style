/*
 * Formatting the selected text. Pure functions, unit-tested.
 *
 * Each function takes a piece of text and the selection inside it (offsets a..b) and
 * returns { text, a, b }: the new text and what to select afterwards. They look just
 * outside the selection too, because with hidden syntax a double-click selects the words
 * between the markers, not the markers.
 */

const MARK_TAG = /<\/?mark\b[^>]*>/gi;
const HTML_TAG = /<\/?(?:u|sub|sup|mark|span|font|b|i|s|strong|em)\b[^>]*>/gi;

const MARK = { open: /<mark\b[^>]*>$/i, close: /^<\/mark>/i, openAt: /^<mark\b[^>]*>/i, closeAt: /<\/mark>$/i };
const EQ = pair('==', '==');
const HTML = {
  open: /<(u|sub|sup|mark|span|font|b|i|s|strong|em)\b[^>]*>$/i,
  close: /^<\/(u|sub|sup|mark|span|font|b|i|s|strong|em)>/i,
};
// Order matters: ** is looked for before *, __ before _.
const CLEARABLE = [pair('**', '**'), pair('__', '__'), pair('~~', '~~'), EQ, pair('*', '*'), pair('_', '_'), pair('`', '`'), pair('[[', ']]'), HTML];

function pair(open, close) { return { open, close }; }

/** The background colour of a <mark> tag, lower-cased, or ''. */
export function markColor(tag) {
  const m = /background(?:-color)?\s*:\s*([^;"']+)/i.exec(tag || '');
  return m ? m[1].trim().toLowerCase() : '';
}

// The markers of one pair that sit directly around a..b, or null.
function around(text, a, b, p) {
  const before = text.slice(0, a);
  const after = text.slice(b);
  if (typeof p.open === 'string') {
    return before.endsWith(p.open) && after.startsWith(p.close) ? { open: p.open, close: p.close } : null;
  }
  const o = p.open.exec(before);
  const c = p.close.exec(after);
  return o && c ? { open: o[0], close: c[0] } : null;
}

// If the selection includes its own markers, select only what is between them.
function shrink(text, a, b, p) {
  const sel = text.slice(a, b);
  if (typeof p.open === 'string') {
    if (sel.length >= p.open.length + p.close.length && sel.startsWith(p.open) && sel.endsWith(p.close)) {
      return { a: a + p.open.length, b: b - p.close.length };
    }
    return null;
  }
  if (!p.openAt) return null;
  const o = p.openAt.exec(sel);
  const c = p.closeAt.exec(sel);
  return o && c && o[0].length + c[0].length <= sel.length ? { a: a + o[0].length, b: b - c[0].length } : null;
}

function cut(text, a, b, m) {
  return {
    text: text.slice(0, a - m.open.length) + text.slice(a, b) + text.slice(b + m.close.length),
    a: a - m.open.length,
    b: b - m.open.length,
  };
}

function replaceSelection(text, a, b, inner) {
  return { text: text.slice(0, a) + inner + text.slice(b), a, b: a + inner.length };
}

/** Wraps the selection in open/close, or removes them when they are already there. */
export function toggleWrap(text, a, b, open, close) {
  const p = pair(open, close);
  const s = shrink(text, a, b, p);
  if (s) ({ a, b } = s);
  const m = around(text, a, b, p);
  if (m) return cut(text, a, b, m);
  return { text: text.slice(0, a) + open + text.slice(a, b) + close + text.slice(b), a: a + open.length, b: b + open.length };
}

// Removes every highlight from and directly around the selection. Also reports the
// colours it found ('' stands for a plain ==highlight==).
function stripHighlight(text, a, b) {
  const colors = [];
  for (let again = true; again;) {
    again = false;
    for (const p of [MARK, EQ]) {
      const s = shrink(text, a, b, p);
      if (s) ({ a, b } = s);
      const m = around(text, a, b, p);
      if (!m) continue;
      colors.push(p === MARK ? markColor(m.open) : '');
      ({ text, a, b } = cut(text, a, b, m));
      again = true;
    }
  }
  const inner = text.slice(a, b)
    .replace(MARK_TAG, (tag) => { if (tag[1] !== '/') colors.push(markColor(tag)); return ''; })
    .replace(/==/g, () => { colors.push(''); return ''; });
  return Object.assign(replaceSelection(text, a, b, inner), { colors });
}

/** "No colour": removes any highlight, ==plain== and coloured, from the selection. */
export function removeHighlight(text, a, b) {
  const r = stripHighlight(text, a, b);
  return { text: r.text, a: r.a, b: r.b };
}

// What stays in front of a highlight at the start of a line: indent, list marker,
// checkbox, heading or quote marker.
const LINE_PREFIX = /^(?:\s*(?:[-*+]|\d+[.)])\s+(?:\[.\]\s+)?|\s*#{1,6}\s+|\s*>\s?)*/;

/**
 * Coloured highlight, written as <mark style="background: #FFF3A3A6;">text</mark> (the
 * format the Highlightr plugin uses). The same colour again removes it, another colour
 * replaces it. A selection over several lines gets one highlight per line.
 */
export function toggleMark(text, a, b, color) {
  const r = stripHighlight(text, a, b);
  const want = color.toLowerCase();
  if (r.colors.length && r.colors.every((c) => c === want)) return { text: r.text, a: r.a, b: r.b };

  const open = `<mark style="background: ${color};">`;
  const close = '</mark>';
  let first = -1;
  let last = -1;
  let out = '';
  r.text.slice(r.a, r.b).split('\n').forEach((seg, i) => {
    if (i) out += '\n';
    const atLineStart = i > 0 || r.a === 0 || r.text[r.a - 1] === '\n';
    const prefix = atLineStart ? LINE_PREFIX.exec(seg)[0] : '';
    const body = seg.slice(prefix.length);
    const core = body.trim();
    if (!core) { out += seg; return; }
    const lead = body.length - body.trimStart().length;
    out += prefix + body.slice(0, lead) + open;
    if (first < 0) first = out.length;
    out += core;
    last = out.length;
    out += close + body.slice(lead + core.length);
  });
  if (first < 0) return { text: r.text, a: r.a, b: r.b };
  return { text: r.text.slice(0, r.a) + out + r.text.slice(r.b), a: r.a + first, b: r.a + last };
}

/** Removes inline formatting from a piece of text. */
export function plainText(s) {
  return s
    .replace(HTML_TAG, '')
    .replace(/\[\[(?:[^\]|\n]*\|)?([^\]\n]*)\]\]/g, '$1')
    .replace(/(?<!!)\[([^\]\n]*)\]\([^)\n]*\)/g, '$1')
    .replace(/(\*\*|__|~~|==)/g, '')
    .replace(/(?<![\w*\\])[*_](\S(?:[^\n]*?\S)?)[*_](?![\w*])/g, '$1');
}

/** Clear formatting: strips inline formatting from and directly around the selection. */
export function clearFormatting(text, a, b) {
  for (let again = true; again;) {
    again = false;
    for (const p of CLEARABLE) {
      const m = around(text, a, b, p);
      if (!m) continue;
      ({ text, a, b } = cut(text, a, b, m));
      again = true;
      break;
    }
  }
  return replaceSelection(text, a, b, plainText(text.slice(a, b)));
}

/**
 * Runs one of the functions above on the editor's selection. Only the part of the text
 * that changes is replaced, as one undo step, and the result stays selected.
 */
export function editSelection(editor, fn) {
  const from = editor.getCursor('from');
  const to = editor.getCursor('to');
  const start = { line: from.line, ch: 0 };
  const end = { line: to.line, ch: editor.getLine(to.line).length };
  const text = editor.getRange(start, end);
  const base = editor.posToOffset(start);
  const r = fn(text, editor.posToOffset(from) - base, editor.posToOffset(to) - base);
  if (!r) return;
  if (r.text !== text) {
    const max = Math.min(text.length, r.text.length);
    let p = 0;
    while (p < max && text[p] === r.text[p]) p++;
    let s = 0;
    while (s < max - p && text[text.length - 1 - s] === r.text[r.text.length - 1 - s]) s++;
    editor.replaceRange(r.text.slice(p, r.text.length - s), editor.offsetToPos(base + p), editor.offsetToPos(base + text.length - s));
  }
  editor.setSelection(editor.offsetToPos(base + r.a), editor.offsetToPos(base + r.b));
}
