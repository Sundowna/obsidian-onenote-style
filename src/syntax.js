/*
 * Hides Markdown syntax in Live Preview, also on the line the cursor is on.
 *
 * Live Preview already hides the markers of a line until the cursor touches them. This
 * editor extension keeps them hidden then too, the way OneNote and Word never show
 * markup. It reads the editor's own syntax tree, so one rule set (syntax-rules.js)
 * decides what is hidden, and the hidden markers are "atomic": the arrow keys step over
 * them in one go instead of stopping on characters you can't see.
 *
 * Source mode is left alone: there you asked to see the Markdown.
 */

import { editorLivePreviewField } from 'obsidian';
import { syntaxTree } from '@codemirror/language';
import { Prec } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, keymap } from '@codemirror/view';
import { tokenHider, htmlPairs, isLineMarker } from './syntax-rules.js';

const HIDE = Decoration.replace({});

function build(view) {
  const { state } = view;
  if (!state.field(editorLivePreviewField, false)) return { all: Decoration.none, hidden: Decoration.none };
  const tree = syntaxTree(state);
  const hide = [];
  const marks = [];

  for (const range of view.visibleRanges) {
    const from = state.doc.lineAt(range.from).from;
    const to = state.doc.lineAt(range.to).to;

    const hides = tokenHider();
    tree.iterate({
      from,
      to,
      enter: (n) => {
        if (n.from < n.to && hides(n.name, n.from, n.to)) hide.push([n.from, n.to]);
      },
    });

    // Inline HTML (coloured highlights, underline, font colour): hide the tags and give
    // the text between them its look, which Obsidian drops while the cursor is in it.
    for (let pos = from; pos <= to;) {
      const line = state.doc.lineAt(pos);
      pos = line.to + 1;
      if (!line.text.includes('</')) continue;
      for (const p of htmlPairs(line.text)) {
        const at = line.from + p.open[0];
        if (!/(^|_)tag(_|$)/.test(tree.resolveInner(at, 1).name)) continue; // code, math...
        hide.push([at, line.from + p.open[1]], [line.from + p.close[0], line.from + p.close[1]]);
        if (p.look && p.open[1] < p.close[0]) {
          marks.push(Decoration.mark({ attributes: p.look }).range(line.from + p.open[1], line.from + p.close[0]));
        }
      }
    }
  }

  // Neighbouring markers become one range, so the cursor crosses them in one step.
  hide.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged = [];
  for (const r of hide) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  const hidden = merged.map((r) => HIDE.range(r[0], r[1]));
  return { all: Decoration.set(hidden.concat(marks), true), hidden: Decoration.set(hidden) };
}

const hider = ViewPlugin.fromClass(class {
  constructor(view) {
    Object.assign(this, build(view));
  }

  update(u) {
    const changed = u.docChanged || u.viewportChanged
      || syntaxTree(u.startState) !== syntaxTree(u.state)
      || u.startState.field(editorLivePreviewField, false) !== u.state.field(editorLivePreviewField, false);
    if (changed) Object.assign(this, build(u.view));
  }
}, {
  decorations: (v) => v.all,
  provide: (plugin) => EditorView.atomicRanges.of((view) => {
    const v = view.plugin(plugin);
    return v ? v.hidden : Decoration.none;
  }),
});

// The hidden range that ends (side -1) or starts (side 1) exactly at pos.
function hiddenAt(view, pos, side) {
  const v = view.plugin(hider);
  if (!v) return null;
  let found = null;
  v.hidden.between(Math.max(0, pos - 1), Math.min(view.state.doc.length, pos + 1), (from, to) => {
    if ((side < 0 ? to : from) === pos) found = { from, to };
  });
  return found;
}

/*
 * Backspace and Delete next to a hidden marker. Without this they would delete the
 * marker you can't see and leave its partner behind as stray characters. Instead they
 * do what Word does: delete the character on the other side of the marker. Backspace at
 * the start of a heading or a quote removes that style from the line.
 */
function deleteAcross(view, forward) {
  const { state } = view;
  const sel = state.selection;
  if (sel.ranges.length !== 1 || !sel.main.empty) return false;
  const pos = sel.main.head;
  const first = hiddenAt(view, pos, forward ? 1 : -1);
  if (!first) return false;

  if (forward) {
    let edge = first.to;
    for (let r; (r = hiddenAt(view, edge, 1));) edge = r.to;
    if (edge >= state.doc.length) return true;
    const line = state.doc.lineAt(edge);
    const end = edge === line.to ? edge + 1 : line.from + nextBreak(line.text, edge - line.from, true);
    view.dispatch({ changes: { from: edge, to: end }, userEvent: 'delete.forward', scrollIntoView: true });
    return true;
  }

  let edge = first.from;
  for (let r; (r = hiddenAt(view, edge, -1));) edge = r.from;
  const line = state.doc.lineAt(edge);
  if (edge === line.from && isLineMarker(syntaxTree(state).resolveInner(edge, 1).name)) {
    view.dispatch({ changes: { from: edge, to: pos }, userEvent: 'delete.backward', scrollIntoView: true });
    return true;
  }
  if (edge === 0) return true;
  const start = edge === line.from ? edge - 1 : line.from + nextBreak(line.text, edge - line.from, false);
  view.dispatch({ changes: { from: start, to: edge }, userEvent: 'delete.backward', scrollIntoView: true });
  return true;
}

// The next character boundary, keeping surrogate pairs (emoji) whole.
function nextBreak(text, i, forward) {
  const pair = (hi, lo) => hi >= 0xd800 && hi < 0xdc00 && lo >= 0xdc00 && lo < 0xe000;
  if (forward) return i + (pair(text.charCodeAt(i), text.charCodeAt(i + 1)) ? 2 : 1);
  return i - (i >= 2 && pair(text.charCodeAt(i - 2), text.charCodeAt(i - 1)) ? 2 : 1);
}

export const hideSyntax = [
  hider,
  Prec.high(keymap.of([
    { key: 'Backspace', run: (view) => deleteAcross(view, false) },
    { key: 'Delete', run: (view) => deleteAcross(view, true) },
  ])),
];
