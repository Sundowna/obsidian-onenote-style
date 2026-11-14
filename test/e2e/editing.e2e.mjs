// End-to-end tests of hidden syntax and the Quick Bar inside a real (sandboxed) Obsidian.
import { browser, expect } from '@wdio/globals';
import { setSize, withPlugin, pause } from './helpers.mjs';

const NOTE = 'Notebook/Editing/Syntax.md';
// Lines of Syntax.md (0-based)
const L = { plain: 0, bold: 2, heading: 4, quote: 6, marks: 8, links: 10, bare: 12, bullet: 14, task: 15, fence: 17, last: 21 };
let original = '';

async function openNote(mode) {
  await browser.executeObsidian(async ({ app }, path, m) => {
    const f = app.vault.getAbstractFileByPath(path);
    const state = m === 'preview' ? { mode: 'preview' } : { mode: 'source', source: m === 'source' };
    await app.workspace.getLeaf(false).openFile(f, { state });
  }, NOTE, mode || 'live');
  await pause(500);
}

/** Puts the cursor in a line and returns the text that line shows. */
const shown = (line, ch) => withPlugin(async (plugin, app, l, c) => {
  const editor = app.workspace.activeEditor.editor;
  editor.setCursor({ line: l, ch: c });
  editor.focus();
  await new Promise((r) => setTimeout(r, 200));
  const cm = editor.cm;
  const n = cm.domAtPos(cm.state.doc.line(l + 1).from).node;
  return (n.nodeType === 1 ? n : n.parentElement).closest('.cm-line').textContent;
}, line, ch);

const lineText = (line) => withPlugin((plugin, app, l) => app.workspace.activeEditor.editor.getLine(l), line);
const cursor = () => withPlugin((plugin, app) => app.workspace.activeEditor.editor.getCursor());
const selection = () => withPlugin((plugin, app) => app.workspace.activeEditor.editor.getSelection());
const setCursor = (line, ch) => withPlugin((plugin, app, l, c) => {
  const e = app.workspace.activeEditor.editor;
  e.setCursor({ line: l, ch: c });
  e.focus();
}, line, ch);
const run = (id) => withPlugin((plugin, app, cmd) => app.commands.executeCommandById('onenote-style:' + cmd), id);

/** Selects text the way the keyboard would have, then lets the Quick Bar react. */
async function select(line, from, to) {
  await withPlugin((plugin, app, l, a, b) => {
    const e = app.workspace.activeEditor.editor;
    e.setSelection({ line: l, ch: a }, { line: l, ch: b });
    e.focus();
    plugin.quickBar.update();
  }, line, from, to);
  await pause(100);
}

const bar = () => browser.execute(() => {
  const el = document.querySelector('.onenote-quick-bar');
  if (!el || el.style.display === 'none') return null;
  const r = el.getBoundingClientRect();
  const s = window.getSelection().getRangeAt(0).getBoundingClientRect();
  return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, selTop: s.top, selBottom: s.bottom, width: window.innerWidth };
});

async function press(selector) {
  await (await browser.$('.onenote-quick-bar ' + selector)).click();
  await pause(150);
}

describe('editing', () => {
  before(async () => {
    await setSize(1500, 1000);
    await openNote();
    original = await withPlugin((plugin, app) => app.workspace.activeEditor.editor.getValue());
  });

  beforeEach(async () => {
    await browser.keys('Escape');
    await withPlugin(async (plugin) => { await plugin.setHideSyntax(true); await plugin.setQuickBar(true); });
    await openNote();
    await withPlugin((plugin, app, text) => {
      const e = app.workspace.activeEditor.editor;
      if (e.getValue() !== text) e.setValue(text);
    }, original);
    await pause(200);
  });

  describe('hidden syntax', () => {
    it('shows no markers on the line the cursor is in', async () => {
      expect(await shown(L.bold, 9)).toBe('Some bold words and italic words and struck words here.');
      expect(await shown(L.bold, 27)).toBe('Some bold words and italic words and struck words here.');
      expect(await shown(L.heading, 5)).toBe('Heading two');
      expect(await shown(L.quote, 5)).toBe('A quoted line');
      expect(await shown(L.marks, 6)).toBe('A yellow mark and a green mark end.');
      expect(await shown(L.marks, 65)).toBe('A yellow mark and a green mark end.');
      expect(await shown(L.links, 6)).toBe('A Second page link, a named link and a web link too.');
      expect(await shown(L.links, 42)).toBe('A Second page link, a named link and a web link too.');
      expect(await shown(L.links, 63)).toBe('A Second page link, a named link and a web link too.');
    });

    it('keeps bullets, checkboxes, tags, bare addresses and code fences', async () => {
      expect(await shown(L.bare, 8)).toBe('Bare https://example.org address, a #sometag tag, inline code and an escaped * star.');
      expect(await shown(L.bullet, 4)).toBe('- A bullet item');
      expect(await shown(L.task, 1)).toContain('[ ]');
      expect(await shown(L.fence, 2)).toBe('```js');
    });

    it('keeps a coloured highlight coloured while the cursor is in it', async () => {
      await shown(L.marks, 65);
      const bg = await browser.execute(() => {
        const line = document.querySelector('.cm-line.cm-active');
        const el = Array.from(line.querySelectorAll('span')).find((s) => s.textContent === 'green mark' && s.style.backgroundColor);
        return el ? getComputedStyle(el).backgroundColor : null;
      });
      expect(bg).toBe('rgba(187, 250, 187, 0.65)');
    });

    it('"Toggle syntax visibility" shows the markers and hides them again', async () => {
      await run('toggle-syntax-visibility');
      await pause(200);
      expect(await shown(L.bold, 9)).toContain('**bold words**');
      expect(await shown(L.heading, 5)).toBe('## Heading two');
      expect(await withPlugin((plugin) => plugin.settings.hideSyntax)).toBe(false);
      await run('toggle-syntax-visibility');
      await pause(200);
      expect(await shown(L.bold, 9)).toBe('Some bold words and italic words and struck words here.');
      expect(await shown(L.heading, 5)).toBe('Heading two');
    });

    it('syntax guard: a note that opens in Source mode switches to Live Preview, the Source Mode button still works', async () => {
      const sourceMode = () => withPlugin((plugin, app) => app.workspace.getActiveViewOfType(require('obsidian').MarkdownView).leaf.getViewState().state.source === true);
      const openSecond = () => browser.executeObsidian(async ({ app }) => {
        const f = app.vault.getAbstractFileByPath('Notebook/Section/Second page.md');
        await app.workspace.getLeaf(false).openFile(f, { state: { mode: 'source', source: true } });
      });
      await openSecond();
      await pause(400);
      expect(await sourceMode()).toBe(false);

      // switching to Source mode yourself stays, and shows the Markdown
      await openNote();
      await withPlugin((plugin, app) => app.commands.executeCommandById('editor:toggle-source'));
      await pause(400);
      expect(await sourceMode()).toBe(true);
      expect(await shown(L.bold, 9)).toContain('**bold words**');
      await (await browser.$('.onenote-tabrow-spacer')).click();
      await pause(300);
      expect(await sourceMode()).toBe(true);

      // with Syntax Guard turned off in the settings nothing is switched
      await withPlugin((plugin) => { plugin.settings.syntaxGuard = false; });
      await openSecond();
      await pause(400);
      expect(await sourceMode()).toBe(true);
      await withPlugin((plugin) => { plugin.settings.syntaxGuard = true; });
      await openNote();

      // with syntax visible nothing is switched
      await run('toggle-syntax-visibility');
      await openSecond();
      await pause(400);
      expect(await sourceMode()).toBe(true);
      // turning hiding back on brings the open note to Live Preview
      await run('toggle-syntax-visibility');
      await pause(400);
      expect(await sourceMode()).toBe(false);
    });

    it('the arrow keys step over hidden markers in one go', async () => {
      await setCursor(L.bold, 5);
      await browser.keys('ArrowRight');
      expect((await cursor()).ch).toBe(7);
      await browser.keys('ArrowLeft');
      expect((await cursor()).ch).toBe(5);
    });

    it('Backspace next to a hidden marker deletes the character before it, not the marker', async () => {
      await setCursor(L.bold, 7);
      await browser.keys('Backspace');
      expect(await lineText(L.bold)).toBe('Some**bold words** and *italic words* and ~~struck words~~ here.');
      await setCursor(L.bold, 16);
      await browser.keys('Delete');
      expect(await lineText(L.bold)).toBe('Some**bold words**and *italic words* and ~~struck words~~ here.');
    });

    it('Backspace at the start of a heading makes it normal text', async () => {
      await setCursor(L.heading, 3);
      await browser.keys('Backspace');
      expect(await lineText(L.heading)).toBe('Heading two');
    });
  });

  describe('quick bar', () => {
    it('appears above a selection and inside the window', async () => {
      await select(L.last, 0, 4);
      const b = await bar();
      expect(b).not.toBeNull();
      expect(b.bottom).toBeLessThanOrEqual(b.selTop);
      expect(b.left).toBeGreaterThanOrEqual(0);
      expect(b.right).toBeLessThanOrEqual(b.width);
    });

    it('appears after a double-click and after Shift+arrow', async () => {
      await setCursor(L.last, 0);
      const at = await withPlugin((plugin, app) => {
        const cm = app.workspace.activeEditor.editor.cm;
        const c = cm.coordsAtPos(cm.state.doc.line(22).from + 2);
        return { x: Math.round(c.left), y: Math.round((c.top + c.bottom) / 2) };
      });
      await browser.action('pointer').move(at).down().up().pause(40).down().up().perform();
      await pause(200);
      expect(await selection()).toBe('Last');
      expect(await bar()).not.toBeNull();

      await browser.keys('Escape');
      await pause(100);
      expect(await bar()).toBeNull();

      await setCursor(L.last, 0);
      await browser.keys(['Shift', 'ArrowRight']);
      await pause(200);
      expect(await selection()).toBe('L');
      expect(await bar()).not.toBeNull();
    });

    it('hides on typing, on a click elsewhere and in Reading view', async () => {
      await select(L.last, 0, 4);
      await browser.keys('x');
      await pause(100);
      expect(await bar()).toBeNull();

      await select(L.plain, 0, 5);
      expect(await bar()).not.toBeNull();
      await (await browser.$('.onenote-tabrow-spacer')).click();
      await pause(100);
      expect(await bar()).toBeNull();

      await select(L.plain, 0, 5);
      await openNote('preview');
      expect(await bar()).toBeNull();
      await withPlugin((plugin) => plugin.quickBar.update());
      expect(await bar()).toBeNull();
    });

    it('formats and takes the formatting off again, keeping the selection', async () => {
      await select(L.plain, 0, 5);
      for (const [action, open, close] of [['bold', '**', '**'], ['italic', '*', '*'], ['strikethrough', '~~', '~~'], ['highlight', '==', '=='], ['link', '[[', ']]']]) {
        await press(`[data-action="${action}"]`);
        expect(await lineText(L.plain)).toBe(`${open}Plain${close} start line for the syntax tests.`);
        expect(await selection()).toBe('Plain');
        expect(await bar()).not.toBeNull();
        await press(`[data-action="${action}"]`);
        expect(await lineText(L.plain)).toBe('Plain start line for the syntax tests.');
        expect(await selection()).toBe('Plain');
      }
    });

    it('colours: on, same colour off, another colour replaces, "No colour" removes', async () => {
      const rest = ' start line for the syntax tests.';
      await select(L.plain, 0, 5);
      await press('[data-color="yellow"]');
      expect(await lineText(L.plain)).toBe('<mark style="background: #FFF3A3A6;">Plain</mark>' + rest);
      expect(await selection()).toBe('Plain');
      // with syntax hidden the tags don't show, the colour does
      expect(await shown(L.plain, 40)).toBe('Plain' + rest);
      await select(L.plain, 37, 42);
      await press('[data-color="green"]');
      expect(await lineText(L.plain)).toBe('<mark style="background: #BBFABBA6;">Plain</mark>' + rest);
      await press('[data-color="green"]');
      expect(await lineText(L.plain)).toBe('Plain' + rest);
      expect(await selection()).toBe('Plain');

      await press('[data-color="pink"]');
      await press('[data-color="none"]');
      expect(await lineText(L.plain)).toBe('Plain' + rest);
      await press('[data-action="highlight"]');
      await press('[data-color="none"]');
      expect(await lineText(L.plain)).toBe('Plain' + rest);
      expect(await selection()).toBe('Plain');
      expect(await bar()).not.toBeNull();
    });

    it('"Clear formatting" also removes the hidden markers around the selection', async () => {
      await select(L.bold, 7, 17);
      await press('[data-action="clear"]');
      expect(await lineText(L.bold)).toBe('Some bold words and *italic words* and ~~struck words~~ here.');
    });

    it('"Toggle Quick Bar" turns it off and on', async () => {
      await run('toggle-quick-bar');
      await select(L.plain, 0, 5);
      expect(await bar()).toBeNull();
      expect(await withPlugin((plugin) => plugin.settings.quickBar)).toBe(false);
      await run('toggle-quick-bar');
      await select(L.plain, 0, 5);
      expect(await bar()).not.toBeNull();
    });
  });
});
