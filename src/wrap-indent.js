/*
 * Wrapped lines in code blocks start under the first word of their line, not at the
 * left edge: a hanging indent, the way Obsidian already does it for list items.
 *
 * Each code-block line that starts with tabs, spaces or a list marker ("3.", "-") gets
 * a line decoration: padding on the left the width of that prefix, and the same amount
 * of negative text-indent, so the first line stays where it was and only the wrapped
 * part moves in. Only the look changes; the text in the file stays as it is.
 * Works in Live Preview and Source mode.
 */

import { syntaxTree } from '@codemirror/language';
import { RangeSetBuilder } from '@codemirror/state';
import { Decoration, ViewPlugin } from '@codemirror/view';
import { hangColumns, isCodeBlockToken } from './hang-rules.js';

const cache = new Map(); // columns -> decoration, so equal lines share one

function hang(cols) {
  let d = cache.get(cols);
  if (!d) {
    d = Decoration.line({ class: 'onenote-hang', attributes: { style: `--onenote-hang: ${cols}ch` } });
    cache.set(cols, d);
  }
  return d;
}

function inCodeBlock(tree, line) {
  let inside = false;
  tree.iterate({
    from: line.from,
    to: Math.max(line.to, line.from + 1),
    enter: (n) => {
      if (inside) return false;
      if (isCodeBlockToken(n.name)) inside = true;
    },
  });
  return inside;
}

function build(view) {
  const { state } = view;
  const tree = syntaxTree(state);
  const b = new RangeSetBuilder();
  let last = -1; // two visible ranges can share a line
  for (const { from, to } of view.visibleRanges) {
    for (let pos = from; pos <= to;) {
      const line = state.doc.lineAt(pos);
      pos = line.to + 1;
      if (line.from <= last) continue;
      last = line.from;
      const cols = hangColumns(line.text, state.tabSize);
      if (cols && inCodeBlock(tree, line)) b.add(line.from, line.from, hang(cols));
    }
  }
  return b.finish();
}

export const wrapIndent = ViewPlugin.fromClass(class {
  constructor(view) {
    this.decorations = build(view);
  }

  update(u) {
    if (u.docChanged || u.viewportChanged || syntaxTree(u.startState) !== syntaxTree(u.state)) {
      this.decorations = build(u.view);
    }
  }
}, { decorations: (v) => v.decorations });
