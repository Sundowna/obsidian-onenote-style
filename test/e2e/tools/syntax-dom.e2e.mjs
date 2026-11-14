// Helper, not a test: prints how Live Preview marks up each line of Syntax.md while the
// cursor is on it (DOM classes and syntax tree node names). Used to keep the syntax
// hiding in src/syntax.js in step with Obsidian's editor.
import { browser } from '@wdio/globals';
import { setSize, withPlugin, pause } from '../helpers.mjs';

describe('syntax dom', () => {
  it('lines', async () => {
    await setSize(1500, 1000);
    await browser.executeObsidian(async ({ app }) => {
      const f = app.vault.getAbstractFileByPath('Notebook/Editing/Syntax.md');
      await app.workspace.getLeaf(false).openFile(f, { state: { mode: 'source', source: false } });
    });
    await pause(1500);
    const out = await withPlugin(async (plugin, app, _a) => {
      const { syntaxTree } = require('@codemirror/language');
      const view = app.workspace.activeEditor;
      const editor = view.editor;
      const cm = editor.cm;
      const res = [];
      for (let l = 0; l < editor.lineCount(); l++) {
        const text = editor.getLine(l);
        if (!text.trim()) continue;
        editor.setCursor({ line: l, ch: Math.min(3, text.length) });
        editor.focus();
        await new Promise((r) => setTimeout(r, 150));
        const line = cm.state.doc.line(l + 1);
        const nodes = [];
        syntaxTree(cm.state).iterate({ from: line.from, to: line.to, enter: (n) => { if (n.name !== 'Document') nodes.push(`${n.name} [${n.from - line.from},${n.to - line.from}] ${JSON.stringify(cm.state.sliceDoc(n.from, n.to))}`); } });
        const el = cm.domAtPos(line.from).node;
        const lineEl = (el.nodeType === 1 ? el : el.parentElement).closest('.cm-line');
        res.push({ text, html: lineEl ? lineEl.outerHTML.slice(0, 1500) : null, nodes });
      }
      return res;
    });
    console.log(JSON.stringify(out, null, 1));
  });
});
