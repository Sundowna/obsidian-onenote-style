/*
 * Quick Bar: a small toolbar that appears above selected text, like Office's mini
 * toolbar. Built for reviewing long notes, so highlighting is one click.
 *
 * To add a button, add an entry to QUICK_BAR_ACTIONS; to add a colour, add it to
 * HIGHLIGHTS. Nothing else needs to change.
 */

import { MarkdownView, setIcon } from 'obsidian';
import { editSelection, toggleWrap, toggleMark, removeHighlight, clearFormatting } from './selection-format.js';

// Highlight colours, written the way the Highlightr plugin writes them, so highlights
// made with either look the same.
export const HIGHLIGHTS = [
  { name: 'Yellow', color: '#FFF3A3A6' },
  { name: 'Green', color: '#BBFABBA6' },
  { name: 'Blue', color: '#ADCCFFA6' },
  { name: 'Pink', color: '#FFB8EBA6' },
  { name: 'Red', color: '#FF5582A6' },
  { name: 'Orange', color: '#FFB86CA6' },
  { name: 'Purple', color: '#D2B3FFA6' },
];

// Obsidian's own command where there is one (it copes with partly formatted selections),
// with our own toggle as the fallback.
const toggle = (command, open, close) => (plugin, editor) => {
  if (!command || !plugin.exec(command)) editSelection(editor, (t, a, b) => toggleWrap(t, a, b, open, close));
};

/*
 *   type "button":   icon (Lucide name), title (tooltip), run(plugin, editor)
 *   type "swatches": one coloured dot per HIGHLIGHTS entry, then "No colour"
 *   type "sep":      a thin divider
 */
export const QUICK_BAR_ACTIONS = [
  { type: 'button', id: 'bold', icon: 'bold', title: 'Bold', run: toggle('editor:toggle-bold', '**', '**') },
  { type: 'button', id: 'italic', icon: 'italic', title: 'Italic', run: toggle('editor:toggle-italics', '*', '*') },
  { type: 'button', id: 'strikethrough', icon: 'strikethrough', title: 'Strikethrough', run: toggle('editor:toggle-strikethrough', '~~', '~~') },
  { type: 'sep' },
  { type: 'button', id: 'highlight', icon: 'highlighter', title: 'Highlight', run: toggle('editor:toggle-highlight', '==', '==') },
  { type: 'swatches' },
  { type: 'sep' },
  { type: 'button', id: 'link', icon: 'link', title: 'Make internal link', run: toggle(null, '[[', ']]') },
  { type: 'button', id: 'copy', icon: 'copy', title: 'Copy', run: (plugin, editor) => navigator.clipboard.writeText(editor.getSelection()) },
  { type: 'button', id: 'clear', icon: 'eraser', title: 'Clear formatting', run: (plugin, editor) => editSelection(editor, clearFormatting) },
];

const GAP = 8;

export class QuickBar {
  constructor(plugin) {
    this.plugin = plugin;
    this.el = null;
  }

  get enabled() { return !!this.plugin.settings.quickBar; }

  mount() {
    const p = this.plugin;
    const bar = this.el = document.body.createDiv({ cls: 'onenote-quick-bar', attr: { role: 'toolbar', 'aria-label': 'Quick Bar' } });
    bar.hide();
    // Keep the editor's focus and selection when a button is pressed.
    bar.addEventListener('mousedown', (e) => e.preventDefault());

    const button = (cls, label, run) => {
      const b = bar.createEl('button', { cls, attr: { type: 'button', 'aria-label': label, 'data-tooltip-position': 'top' } });
      b.addEventListener('click', () => this.run(run));
      return b;
    };
    for (const a of QUICK_BAR_ACTIONS) {
      if (a.type === 'sep') {
        bar.createDiv('onenote-quick-bar-sep');
      } else if (a.type === 'swatches') {
        for (const h of HIGHLIGHTS) {
          const dot = button('onenote-quick-bar-swatch', h.name + ' highlight', (plugin, editor) => editSelection(editor, (t, x, y) => toggleMark(t, x, y, h.color)));
          dot.dataset.color = h.name.toLowerCase();
          dot.style.setProperty('--swatch', h.color);
        }
        button('onenote-quick-bar-swatch is-none', 'No colour (remove highlight)', (plugin, editor) => editSelection(editor, removeHighlight))
          .dataset.color = 'none';
      } else {
        const b = button('onenote-quick-bar-btn', a.title, a.run);
        b.dataset.action = a.id;
        setIcon(b, a.icon);
      }
    }

    // Show once a selection is finished: mouse button released, or a Shift+arrow (or
    // select-all) key released. Not while dragging, so the bar never chases the mouse.
    const later = () => window.setTimeout(() => this.update(), 10);
    const inEditor = (e) => e.target instanceof Element && !!e.target.closest('.markdown-source-view');
    p.registerDomEvent(document, 'mouseup', (e) => {
      if (this.enabled && !bar.contains(e.target) && inEditor(e)) later();
    });
    p.registerDomEvent(document, 'keyup', (e) => {
      // Shift itself counts: it is often let go before the arrow key.
      const selecting = e.shiftKey || e.key === 'Shift' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a');
      if (this.enabled && selecting && inEditor(e)) later();
    });

    // Hide on typing, Escape, scrolling, a click elsewhere, another note.
    p.registerDomEvent(document, 'keydown', (e) => {
      if (e.key === 'Escape' || !(e.shiftKey || e.key === 'Shift')) this.hide();
    }, { capture: true });
    // pointerdown, not mousedown: the ribbon's drag and drop swallows the mouse event.
    p.registerDomEvent(document, 'pointerdown', (e) => { if (!bar.contains(e.target)) this.hide(); }, { capture: true });
    p.registerDomEvent(document, 'scroll', () => this.hide(), { capture: true });
    p.registerDomEvent(window, 'resize', () => this.hide());
    // Another note, or the same note switched to Reading view.
    for (const name of ['active-leaf-change', 'file-open', 'layout-change']) {
      p.registerEvent(p.app.workspace.on(name, () => this.hide()));
    }
  }

  unmount() {
    if (this.el) this.el.remove();
    this.el = null;
  }

  // The editor that holds the selection: the note's own, or a table cell's.
  target() {
    const ws = this.plugin.app.workspace;
    const view = ws.getActiveViewOfType(MarkdownView);
    if (!view || view.getMode() !== 'source') return null; // never in Reading view
    const editor = (ws.activeEditor && ws.activeEditor.editor) || view.editor;
    if (!editor || !editor.hasFocus() || !editor.getSelection().trim()) return null;
    return editor;
  }

  /** Shows the bar at the current selection, or hides it when there is none. */
  update() {
    const bar = this.el;
    const editor = this.enabled && bar ? this.target() : null;
    const cm = editor && editor.cm;
    if (!cm || !cm.coordsAtPos) return this.hide();

    const sel = cm.state.selection.main;
    const start = cm.coordsAtPos(sel.from, 1);
    const end = cm.coordsAtPos(sel.to, -1);
    const page = cm.scrollDOM.getBoundingClientRect();
    const text = cm.contentDOM.getBoundingClientRect();
    // A selection end that is scrolled out of view has no coordinates.
    const top = start ? Math.max(start.top, page.top) : page.top;
    const bottom = end ? Math.min(end.bottom, page.bottom) : page.bottom;
    const oneLine = start && end && Math.abs(start.top - end.top) < 2;
    const centre = oneLine ? (start.left + end.right) / 2 : (text.left + text.right) / 2;

    bar.show();
    const w = bar.offsetWidth;
    const h = bar.offsetHeight;
    let y = top - h - GAP;
    if (y < page.top) y = bottom + GAP; // no room above: below the selection
    if (y + h > Math.min(page.bottom, window.innerHeight)) y = page.top + GAP;
    bar.style.top = Math.round(y) + 'px';
    bar.style.left = Math.round(Math.max(GAP, Math.min(centre - w / 2, window.innerWidth - w - GAP))) + 'px';
  }

  hide() {
    if (this.el) this.el.hide();
  }

  get visible() { return !!this.el && this.el.isShown(); }

  // Runs a button, then shows the bar again: the selection is kept, so several actions
  // can follow each other.
  async run(fn) {
    const editor = this.target();
    if (!editor) return this.hide();
    try {
      await fn(this.plugin, editor);
    } finally {
      editor.focus();
      window.setTimeout(() => this.update(), 10);
    }
  }
}
