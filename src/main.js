/*
 * OneNote Style for Obsidian
 *
 * Mapping between OneNote and the vault:
 *   Notebook  = a top-level folder (or the whole vault, see settings)
 *   Section   = a folder inside a notebook (nested folders work like section groups)
 *   Page      = a Markdown note (or a Canvas file for free-form pages) inside a section
 *
 * Page order, subpage levels and section colors are stored in the plugin's data.json,
 * so the notes themselves stay plain Markdown.
 */

import {
  Plugin, ItemView, MarkdownView, Modal, Menu, Notice, PluginSettingTab, Setting,
  TFile, TFolder, FuzzySuggestModal, setIcon, addIcon, moment, normalizePath, debounce,
} from 'obsidian';
import { RibbonView } from './ribbon/view.js';
import { defaultLayout } from './ribbon/defaults.js';
import { normalizeLayout, exportLayout, importLayout, activeTab } from './ribbon/model.js';
import { executeCommand, mountPoint, openSettings, isPluginEnabled, setDarkMode, patchExplorerSort, resortExplorers } from './ribbon/internal.js';
import { groupUnderParents } from './subpages.js';

const NOTEBOOKS_VIEW = 'onenote-notebooks';
const PAGES_VIEW = 'onenote-pages';
const DRAG_TYPE = 'text/x-onenote-page';

const SECTION_COLORS = [
  '#8AA8E4', '#91BAAE', '#F6B078', '#EE9597', '#F5D277', '#B49EDE',
  '#9FDDE2', '#BAD37C', '#E7A4D5', '#A9C3D9', '#D5B59C', '#C4C4C4',
];

const PAGE_COLORS = [
  { name: 'No Color', value: '' },
  { name: 'Blue', value: '#DCE9F7' },
  { name: 'Yellow', value: '#FFF6CC' },
  { name: 'Green', value: '#E1F2D9' },
  { name: 'Pink', value: '#FADDE7' },
  { name: 'Purple', value: '#EBE1F4' },
  { name: 'Orange', value: '#FDE6D2' },
  { name: 'Teal', value: '#D6F0EE' },
  { name: 'Gray', value: '#ECECEC' },
];

const FONT_COLORS = [
  '#000000', '#7F7F7F', '#C00000', '#FF0000', '#FFC000', '#FFD700', '#92D050', '#00B050',
  '#00B0F0', '#0070C0', '#002060', '#7030A0', '#7719AA', '#FF00FF', '#996633', '#FFFFFF',
];

const HIGHLIGHT_COLORS = [
  { name: 'Yellow', value: '' }, // plain ==highlight==
  { name: 'Bright Green', value: '#9BF59B' },
  { name: 'Turquoise', value: '#8FF0F0' },
  { name: 'Pink', value: '#FFA6E9' },
  { name: 'Blue', value: '#A6C8FF' },
  { name: 'Orange', value: '#FFC48A' },
  { name: 'Red', value: '#FF9C9C' },
  { name: 'Gray', value: '#D0D0D0' },
];

// Tags are stored as Markdown task statuses, e.g. "- [!] Call the bank"
// Official product logos, drawn in one colour to match the ribbon's other icons.
// Claude and OpenAI: Simple Icons (24 x 24). Lumo: Proton's own logo (64 x 64).
// Codex: redrawn as an outline from the Codex app's icon.
// addIcon expects a 100 x 100 canvas, so each is scaled up to fill it.
const BRAND_ICONS = {
  'onenote-ai-claude': '<g transform="scale(4.1667)" fill="currentColor" stroke="none"><path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z"/></g>',
  'onenote-ai-openai': '<g transform="scale(4.1667)" fill="currentColor" stroke="none"><path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"/></g>',
  'onenote-ai-codex': '<g fill="none" stroke="currentColor" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"><path d="M66.1 17.7A18.0 18.0 0 0 1 86.1 42.8A18.0 18.0 0 0 1 78.9 74.1A18.0 18.0 0 0 1 50.0 88.0A18.0 18.0 0 0 1 21.1 74.1A18.0 18.0 0 0 1 13.9 42.8A18.0 18.0 0 0 1 33.9 17.7A18.0 18.0 0 0 1 66.1 17.7Z"/><path d="M35 40l11 11-11 11"/><path d="M53 63h13"/></g>',
  'onenote-ai-lumo': '<g transform="scale(1.5625)" fill="currentColor" stroke="none"><path d="M42.4499 12.1097L49.6457 7.48831C52.1406 5.8859 55.4516 7.43191 55.8298 10.3713L57.5715 23.9337L42.4465 12.1097H42.4499Z"/><path d="M22.9165 12.1097L15.7206 7.48831C13.2257 5.8859 9.91475 7.43191 9.53654 10.3713L7.7948 23.9337L22.9198 12.1097H22.9165Z"/><path d="M46.5833 39.8431C48.3991 39.8431 49.871 37.4443 49.871 34.4852C49.871 31.5261 48.3991 29.1273 46.5833 29.1273C44.7675 29.1273 43.2955 31.5261 43.2955 34.4852C43.2955 37.4443 44.7675 39.8431 46.5833 39.8431Z"/><path d="M18.7383 40.2558C20.5541 40.2558 22.0261 37.857 22.0261 34.8979C22.0261 31.9387 20.5541 29.5399 18.7383 29.5399C16.9225 29.5399 15.4506 31.9387 15.4506 34.8979C15.4506 37.857 16.9225 40.2558 18.7383 40.2558Z"/><path fill-rule="evenodd" d="M62.5401 38.1462C62.5401 51.9873 46.1147 56.9206 32.413 56.9206C20.37 56.9206 2.28577 51.9873 2.28577 38.1462C2.28577 24.3052 15.7752 10.3148 32.413 10.3148C49.0508 10.3148 62.5401 24.3052 62.5401 38.1462Z M47.1845 42.6603C52.1662 40.5117 54.6588 35.1856 52.7519 30.7641C50.845 26.3426 45.2606 24.5 40.2788 26.6486C35.2971 28.7972 32.8044 34.1233 34.7114 38.5448C36.6183 42.9663 42.2027 44.8088 47.1845 42.6603Z M24.7442 38.542C26.6511 34.1205 24.1585 28.7944 19.1768 26.6458C14.195 24.4973 8.61062 26.3398 6.70368 30.7613C4.79674 35.1828 7.28936 40.5089 12.2711 42.6575C17.2529 44.8061 22.8373 42.9635 24.7442 38.542Z"/></g>',
};

const AI_PLUGIN = 'ai-chatbridge';

const TAGS = [
  { id: 'todo', name: 'To Do', char: ' ', icon: 'check-square', key: '1' },
  { id: 'important', name: 'Important', char: '!', icon: 'star', key: '2' },
  { id: 'question', name: 'Question', char: '?', icon: 'help-circle', key: '3' },
  { id: 'remember', name: 'Remember for later', char: '*', icon: 'highlighter', key: '4' },
  { id: 'definition', name: 'Definition', char: 'd', icon: 'book-open', key: '5' },
  { id: 'idea', name: 'Idea', char: 'i', icon: 'lightbulb', key: '6' },
];

const RULE_LINES = [
  { id: 'none', name: 'No Rule Lines' },
  { id: 'narrow', name: 'Narrow Ruled' },
  { id: 'college', name: 'College Ruled' },
  { id: 'standard', name: 'Standard Ruled' },
  { id: 'wide', name: 'Wide Ruled' },
  { id: 'grid-small', name: 'Small Grid' },
  { id: 'grid-large', name: 'Large Grid' },
];

const PAGE_WIDTHS = [
  { id: 'normal', name: 'Normal' },
  { id: 'wide', name: 'Wide' },
  { id: 'full', name: 'Full width' },
];

const SYMBOLS = [
  '©', '®', '™', '°', '±', '×', '÷', '≈', '≠', '≤', '≥', '∞', '√', 'π', 'µ', 'Ω',
  '€', '£', '¥', '¢', '§', '¶', '•', '…', '→', '←', '↑', '↓', '↔', '⇒', '✓', '✗',
  '★', '☆', '♥', '☺', '½', '¼', '¾', '²', '³', '«', '»', '—', '–', '¿', '¡', '†',
];

const DEFAULT_SETTINGS = {
  notebookMode: 'folders', // 'folders': top-level folders are notebooks; 'vault': the vault is one notebook
  excludedFolders: '',
  pagesPanePosition: 'docked', // under the file list, so subpages are always visible
  applyTheme: true,
  showRibbon: true,
  showSectionTabs: true,
  showNavigation: false, // notebooks/pages panes; off because Fluent OneNote + Notebook Navigator handle navigation
  showPageDate: true,
  hideObsidianRibbon: false,
  pageFont: 'Calibri, Carlito, "Segoe UI", sans-serif',
  uiFont: '"Segoe UI", system-ui, sans-serif',
  fontSize: 15,
  ruleLines: 'none',
  pageColor: '',
  pageWidth: 'wide',
  newPageName: 'Untitled Page',
  dateFormat: 'dddd, MMMM D, YYYY',
  timeFormat: 'h:mm A',
};

const DEFAULT_STATE = {
  notebook: null,
  section: null,
  ribbonTab: 'home',
  ribbonCollapsed: false,
  panesInitialized: false,
};
const MAP_KEYS = ['colors', 'order', 'levels', 'lastPage', 'lastSection', 'expanded'];

const TASK_RE = /^(\s*)(?:((?:[-*+]|\d+[.)])\s+)(?:\[(.)\]\s?)?)?(.*)$/;

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

function icon(el, name, fallback) {
  setIcon(el, name);
  if (!el.querySelector('svg')) el.setText(fallback || '•');
}

function byName(a, b) {
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
}

function isInside(folder, child) {
  if (!folder || !child) return false;
  if (folder === child) return true;
  if (folder.isRoot()) return true;
  return child.path.startsWith(folder.path + '/');
}

function isPageFile(f) {
  return f instanceof TFile && (f.extension === 'md' || f.extension === 'canvas');
}

// Apply fn to every line touched by the selection, only replacing the part of the
// line that actually changes so the cursor stays where it was.
function mapLines(editor, fn) {
  const from = editor.getCursor('from');
  const to = editor.getCursor('to');
  const multi = from.line !== to.line;
  const changes = [];
  for (let l = from.line; l <= to.line; l++) {
    const text = editor.getLine(l);
    if (multi && !text.trim()) continue;
    const next = fn(text);
    if (next === text) continue;
    let s = 0;
    while (s < text.length && s < next.length && text[text.length - 1 - s] === next[next.length - 1 - s]) s++;
    changes.push({
      from: { line: l, ch: 0 },
      to: { line: l, ch: text.length - s },
      text: next.slice(0, next.length - s),
    });
  }
  if (changes.length) editor.transaction({ changes });
}

function toggleTagLine(text, char) {
  const [, indent, marker, cur, rest] = text.match(TASK_RE);
  if (cur !== undefined) {
    const same = cur === char || (char === ' ' && (cur === 'x' || cur === 'X'));
    if (same) return /^\d/.test(marker) ? indent + marker + rest : indent + rest;
    return indent + marker + '[' + char + '] ' + rest;
  }
  if (marker) return indent + marker + '[' + char + '] ' + rest;
  return indent + '- [' + char + '] ' + rest;
}

function styleLine(text, style) {
  const t = text.replace(/^\s*#{1,6}\s+/, '').replace(/^\s*>\s?/, '');
  if (typeof style === 'number' && style > 0) return '#'.repeat(style) + ' ' + t;
  if (style === 'quote') return '> ' + t;
  return t;
}

function wrap(editor, before, after) {
  const sel = editor.getSelection();
  const from = editor.getCursor('from');
  const to = editor.getCursor('to');
  if (!sel) {
    editor.replaceRange(before + after, from);
    editor.setCursor({ line: from.line, ch: from.ch + before.length });
    return;
  }
  if (sel.length >= before.length + after.length && sel.startsWith(before) && sel.endsWith(after)) {
    editor.replaceSelection(sel.slice(before.length, sel.length - after.length));
    return;
  }
  const preStart = { line: from.line, ch: Math.max(0, from.ch - before.length) };
  const postEnd = { line: to.line, ch: Math.min(editor.getLine(to.line).length, to.ch + after.length) };
  if (editor.getRange(preStart, from) === before && editor.getRange(to, postEnd) === after) {
    editor.transaction({ changes: [{ from: to, to: postEnd, text: '' }, { from: preStart, to: from, text: '' }] });
    return;
  }
  editor.replaceSelection(before + sel + after);
  const endCh = to.line === from.line ? to.ch + before.length : to.ch;
  editor.setSelection({ line: from.line, ch: from.ch + before.length }, { line: to.line, ch: endCh });
}

function clearFormatting(s) {
  return s
    .replace(/<\/?(?:u|sub|sup|mark|span|font|b|i|s|strong|em)\b[^>]*>/gi, '')
    .replace(/(\*\*|__|~~|==)/g, '')
    .replace(/(?<![\w*\\])[*_](\S(?:[^\n]*?\S)?)[*_](?![\w*])/g, '$1');
}

function insertBlock(editor, text, cursorOffset) {
  const c = editor.getCursor();
  const line = editor.getLine(c.line);
  let start;
  let prefix = '';
  if (line.trim()) {
    start = { line: c.line, ch: line.length };
    prefix = '\n';
  } else {
    start = { line: c.line, ch: 0 };
  }
  editor.replaceRange(prefix + text + '\n', start, line.trim() ? start : { line: c.line, ch: line.length });
  const base = editor.posToOffset(start) + prefix.length;
  editor.setCursor(editor.offsetToPos(base + (cursorOffset == null ? text.length + 1 : cursorOffset)));
}

function tableMarkdown(rows, cols) {
  const head = '| ' + Array.from({ length: cols }, (_, i) => 'Column ' + (i + 1)).join(' | ') + ' |';
  const sep = '|' + ' --- |'.repeat(cols);
  const row = '|' + '     |'.repeat(cols);
  return [head, sep].concat(Array(Math.max(1, rows - 1)).fill(row)).join('\n');
}

/* ------------------------------------------------------------------ */
/* Modals                                                              */
/* ------------------------------------------------------------------ */

class PromptModal extends Modal {
  constructor(app, title, value, cta, resolve) {
    super(app);
    this.titleText = title;
    this.value = value || '';
    this.cta = cta || 'OK';
    this.resolve = resolve;
    this.done = false;
  }
  onOpen() {
    this.titleEl.setText(this.titleText);
    const input = this.contentEl.createEl('input', { type: 'text', cls: 'onenote-prompt-input' });
    input.value = this.value;
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this.submit(input.value); }
    });
    const buttons = this.contentEl.createDiv('modal-button-container');
    buttons.createEl('button', { text: this.cta, cls: 'mod-cta' }).onclick = () => this.submit(input.value);
    buttons.createEl('button', { text: 'Cancel' }).onclick = () => this.close();
    setTimeout(() => { input.focus(); input.select(); }, 0);
  }
  submit(v) {
    v = v.trim();
    if (!v) return;
    this.done = true;
    this.resolve(v);
    this.close();
  }
  onClose() {
    this.contentEl.empty();
    if (!this.done) this.resolve(null);
  }
}

function promptText(app, title, value, cta) {
  return new Promise((resolve) => new PromptModal(app, title, value, cta, resolve).open());
}

class ConfirmModal extends Modal {
  constructor(app, title, message, cta, resolve) {
    super(app);
    Object.assign(this, { titleText: title, message, cta, resolve, done: false });
  }
  onOpen() {
    this.titleEl.setText(this.titleText);
    this.contentEl.createEl('p', { text: this.message });
    const buttons = this.contentEl.createDiv('modal-button-container');
    buttons.createEl('button', { text: this.cta, cls: 'mod-warning' }).onclick = () => {
      this.done = true; this.resolve(true); this.close();
    };
    buttons.createEl('button', { text: 'Cancel' }).onclick = () => this.close();
  }
  onClose() {
    this.contentEl.empty();
    if (!this.done) this.resolve(false);
  }
}

function confirmAction(app, title, message, cta) {
  return new Promise((resolve) => new ConfirmModal(app, title, message, cta || 'Delete', resolve).open());
}

class SectionSuggestModal extends FuzzySuggestModal {
  constructor(app, plugin, onChoose) {
    super(app);
    this.plugin = plugin;
    this.onChoose = onChoose;
    this.setPlaceholder('Move page to section...');
  }
  getItems() { return this.plugin.allSections(); }
  getItemText(f) { return this.plugin.sectionLabel(f); }
  onChooseItem(f) { this.onChoose(f); }
}

class PageSuggestModal extends FuzzySuggestModal {
  constructor(app, items, placeholder, onChoose) {
    super(app);
    this.items = items;
    this.onChoose = onChoose;
    this.setPlaceholder(placeholder);
  }
  getItems() { return this.items; }
  getItemText(f) { return f instanceof TFolder ? f.name : f.basename; }
  onChooseItem(f) { this.onChoose(f); }
}

class TagSummaryModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
    this.scope = 'notebook';
    this.hideDone = false;
  }
  onOpen() {
    this.modalEl.addClass('onenote-tags-modal');
    this.titleEl.setText('Tags Summary');
    const bar = this.contentEl.createDiv('onenote-tags-toolbar');
    new Setting(bar).setName('Search').addDropdown((d) => d
      .addOption('notebook', 'This notebook')
      .addOption('section', 'This section')
      .addOption('all', 'All notebooks')
      .setValue(this.scope)
      .onChange((v) => { this.scope = v; this.load(); }));
    new Setting(bar).setName('Hide completed To Do items').addToggle((t) => t
      .setValue(this.hideDone)
      .onChange((v) => { this.hideDone = v; this.load(); }));
    this.listEl = this.contentEl.createDiv('onenote-tags-list');
    this.load();
  }
  async load() {
    const { app, plugin } = this;
    const listEl = this.listEl;
    listEl.empty();
    listEl.createDiv({ cls: 'onenote-empty', text: 'Collecting tags...' });
    const scopeFolder = this.scope === 'notebook' ? plugin.currentNotebook
      : this.scope === 'section' ? plugin.currentSection : null;
    const groups = new Map(TAGS.map((t) => [t.char, []]));
    for (const file of app.vault.getMarkdownFiles()) {
      if (scopeFolder && !(this.scope === 'section' ? file.parent === scopeFolder : isInside(scopeFolder, file))) continue;
      const items = (app.metadataCache.getFileCache(file) || {}).listItems || [];
      const tagged = items.filter((li) => li.task !== undefined
        && (groups.has(li.task) || ((li.task === 'x' || li.task === 'X') && !this.hideDone)));
      if (!tagged.length) continue;
      const lines = (await app.vault.cachedRead(file)).split('\n');
      for (const li of tagged) {
        const ln = li.position.start.line;
        const text = (lines[ln] || '').replace(/^\s*(?:[-*+]|\d+[.)])\s+\[.\]\s*/, '');
        const key = groups.has(li.task) ? li.task : ' ';
        groups.get(key).push({ file, line: ln, text, done: li.task === 'x' || li.task === 'X' });
      }
    }
    listEl.empty();
    let total = 0;
    for (const tag of TAGS) {
      const entries = groups.get(tag.char);
      if (!entries.length) continue;
      total += entries.length;
      const head = listEl.createDiv('onenote-tags-group');
      const ic = head.createSpan({ cls: 'onenote-tag-icon', attr: { 'data-tag': tag.id } });
      icon(ic, tag.icon);
      head.createSpan({ text: `${tag.name} (${entries.length})` });
      for (const e of entries) {
        const row = listEl.createDiv({ cls: 'onenote-tags-item' + (e.done ? ' is-done' : '') });
        row.createDiv({ cls: 'onenote-tags-text', text: e.text || '(empty)' });
        row.createDiv({ cls: 'onenote-tags-page', text: plugin.sectionLabel(e.file.parent) + ' › ' + e.file.basename });
        row.onclick = async () => {
          this.close();
          await app.workspace.getLeaf(false).openFile(e.file, { eState: { line: e.line } });
        };
      }
    }
    if (!total) listEl.createDiv({ cls: 'onenote-empty', text: 'No tagged notes found. Tag a line with Ctrl+1 … Ctrl+6.' });
  }
  onClose() { this.contentEl.empty(); }
}

/* ------------------------------------------------------------------ */
/* Notebook pane (left)                                                */
/* ------------------------------------------------------------------ */

class NotebooksView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() { return NOTEBOOKS_VIEW; }
  getDisplayText() { return 'Notebooks'; }
  getIcon() { return 'book-open'; }
  async onOpen() { this.render(); }

  render() {
    const p = this.plugin;
    const el = this.contentEl;
    el.empty();
    el.addClass('onenote-nav');

    const head = el.createDiv('onenote-pane-header');
    head.createSpan({ text: 'Notebooks' });
    if (p.settings.notebookMode === 'folders') {
      const add = head.createDiv({ cls: 'onenote-pane-header-btn', attr: { 'aria-label': 'New notebook' } });
      icon(add, 'plus', '+');
      add.onclick = () => p.createNotebook();
    }

    const notebooks = p.getNotebooks();
    const current = p.currentNotebook;
    const curSection = p.currentSection;
    const list = el.createDiv('onenote-nb-list');
    if (!notebooks.length) {
      list.createDiv({ cls: 'onenote-empty', text: 'No notebooks yet. Each top-level folder in your vault becomes a notebook.' });
      const btn = list.createEl('button', { text: 'Create a notebook', cls: 'mod-cta' });
      btn.onclick = () => p.createNotebook();
      return;
    }

    for (const nb of notebooks) {
      const expanded = p.state.expanded[nb.path] !== undefined ? p.state.expanded[nb.path] : nb === current;
      const row = list.createDiv({ cls: 'onenote-nb-row' + (nb === current ? ' is-active' : '') });
      const chev = row.createSpan('onenote-chevron');
      icon(chev, expanded ? 'chevron-down' : 'chevron-right', expanded ? '▾' : '▸');
      const bi = row.createSpan('onenote-nb-icon');
      bi.style.color = p.colorOf(nb);
      icon(bi, 'book', '📓');
      row.createSpan({ cls: 'onenote-nb-name', text: p.notebookName(nb) });
      chev.onclick = (e) => {
        e.stopPropagation();
        p.state.expanded[nb.path] = !expanded;
        p.save();
        this.render();
      };
      row.onclick = () => {
        p.state.expanded[nb.path] = true;
        p.openNotebook(nb);
      };
      row.oncontextmenu = (e) => p.notebookMenu(e, nb);

      if (!expanded) continue;
      const tree = list.createDiv('onenote-section-tree');
      if (p.getPages(nb).length) this.sectionRow(tree, nb, 0, curSection, true);
      for (const s of p.getSections(nb)) this.sectionTree(tree, s, 0, curSection);
      const add = tree.createDiv('onenote-add-row');
      icon(add.createSpan(), 'plus', '+');
      add.createSpan({ text: 'Add section' });
      add.onclick = () => p.createSection(nb);
    }
  }

  sectionTree(parent, folder, depth, curSection) {
    this.sectionRow(parent, folder, depth, curSection, false);
    for (const child of this.plugin.getSections(folder)) this.sectionTree(parent, child, depth + 1, curSection);
  }

  sectionRow(parent, folder, depth, curSection, unfiled) {
    const p = this.plugin;
    const row = parent.createDiv({ cls: 'onenote-section-row' + (folder === curSection ? ' is-active' : '') });
    row.style.paddingLeft = (22 + depth * 14) + 'px';
    const sw = row.createSpan('onenote-section-swatch');
    sw.style.backgroundColor = unfiled ? 'var(--text-faint)' : p.colorOf(folder);
    row.createSpan({ cls: 'onenote-section-name', text: unfiled ? 'Unfiled pages' : folder.name });
    row.onclick = () => p.openSection(folder);
    if (!unfiled) row.oncontextmenu = (e) => p.sectionMenu(e, folder);
    p.makeDropTarget(row, folder);
  }
}

/* ------------------------------------------------------------------ */
/* Page list pane                                                      */
/* ------------------------------------------------------------------ */

class PagesView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() { return PAGES_VIEW; }
  getDisplayText() { return 'Pages'; }
  getIcon() { return 'file-text'; }
  async onOpen() { this.render(); }

  render() {
    const p = this.plugin;
    const el = this.contentEl;
    el.empty();
    el.addClass('onenote-pages');
    const section = p.currentSection;

    const head = el.createDiv('onenote-pages-head');
    head.createDiv({ cls: 'onenote-pages-title', text: section ? p.sectionDisplayName(section) : 'No section selected' });

    const addRow = el.createDiv('onenote-add-page');
    const addMain = addRow.createDiv('onenote-add-page-main');
    icon(addMain.createSpan(), 'plus', '+');
    addMain.createSpan({ text: 'Add Page' });
    addMain.onclick = () => p.createPage();
    const addMore = addRow.createDiv({ cls: 'onenote-add-page-more', attr: { 'aria-label': 'More page types' } });
    icon(addMore, 'chevron-down', '▾');
    addMore.onclick = (e) => {
      const m = new Menu();
      m.addItem((i) => i.setTitle('Page').setIcon('file-plus').onClick(() => p.createPage()));
      m.addItem((i) => i.setTitle('Subpage').setIcon('indent').onClick(() => p.createSubpage()));
      m.addItem((i) => i.setTitle('Free-form page (Canvas)').setIcon('layout-dashboard').onClick(() => p.createPage({ canvas: true })));
      m.showAtMouseEvent(e);
    };

    const list = el.createDiv('onenote-page-list');
    if (!section) return;
    p.makeDropTarget(list, section);
    const pages = p.getPages(section);
    if (!pages.length) {
      list.createDiv({ cls: 'onenote-empty', text: 'This section is empty. Click "Add Page" to start writing.' });
      return;
    }
    const active = p.app.workspace.getActiveFile();
    for (const file of pages) {
      const level = p.levelOf(file);
      const item = list.createDiv({
        cls: 'onenote-page-item' + (file === active ? ' is-active' : ''),
        attr: { 'data-level': String(level), draggable: 'true' },
      });
      if (file.extension === 'canvas') icon(item.createSpan('onenote-page-kind'), 'layout-dashboard', '▦');
      item.createSpan({ cls: 'onenote-page-name', text: file.basename });
      item.setAttr('aria-label', moment(file.stat.ctime).format(p.settings.dateFormat + '  ' + p.settings.timeFormat));
      item.setAttr('data-tooltip-position', 'left');
      item.onclick = (e) => p.openPage(file, e.ctrlKey || e.metaKey);
      item.onauxclick = (e) => { if (e.button === 1) p.openPage(file, true); };
      item.oncontextmenu = (e) => p.pageMenu(e, file);

      item.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData(DRAG_TYPE, file.path);
        e.dataTransfer.effectAllowed = 'move';
        item.addClass('is-dragging');
      });
      item.addEventListener('dragend', () => item.removeClass('is-dragging'));
      item.addEventListener('dragover', (e) => {
        if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
        e.preventDefault();
        e.stopPropagation();
        const after = e.offsetY > item.offsetHeight / 2;
        item.toggleClass('drop-before', !after);
        item.toggleClass('drop-after', after);
      });
      item.addEventListener('dragleave', () => { item.removeClass('drop-before'); item.removeClass('drop-after'); });
      item.addEventListener('drop', (e) => {
        const path = e.dataTransfer.getData(DRAG_TYPE);
        if (!path) return;
        e.preventDefault();
        e.stopPropagation();
        const after = item.hasClass('drop-after');
        item.removeClass('drop-before'); item.removeClass('drop-after');
        p.dropPage(path, file, after);
      });
    }
  }
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

class OneNoteSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const p = this.plugin;
    const s = p.settings;
    const el = this.containerEl;
    el.empty();
    const changed = async (rebuild) => {
      await p.persist();
      p.applyAppearance();
      if (rebuild) p.buildTopBar();
      p.refresh();
    };

    el.createEl('h3', { text: 'Notebooks' });
    new Setting(el).setName('Notebook structure')
      .setDesc('How vault folders map to OneNote notebooks and sections.')
      .addDropdown((d) => d
        .addOption('folders', 'Top-level folders are notebooks, subfolders are sections')
        .addOption('vault', 'The vault is one notebook, folders are sections')
        .setValue(s.notebookMode)
        .onChange(async (v) => { s.notebookMode = v; await changed(); this.display(); }));
    new Setting(el).setName('Excluded folders')
      .setDesc('Comma-separated folder paths to hide from notebooks and sections (e.g. attachments, templates).')
      .addText((t) => t.setValue(s.excludedFolders).onChange(async (v) => { s.excludedFolders = v; await changed(); }));
    new Setting(el).setName('Own notebook and page panes')
      .setDesc('Off: Fluent OneNote and Notebook Navigator handle navigation, and this plugin only provides the ribbon and tags.')
      .addToggle((t) => t.setValue(s.showNavigation).onChange(async (v) => { s.showNavigation = v; await p.persist(); await p.activatePanes(v); }));
    new Setting(el).setName('Page list position')
      .setDesc('OneNote 2016 shows pages on the right; newer OneNote shows them on the left under the notebooks.')
      .addDropdown((d) => d
        .addOption('docked', 'Docked under the file list (always visible)')
        .addOption('right', 'Right sidebar')
        .addOption('left', 'Left sidebar, below notebooks')
        .setValue(s.pagesPanePosition)
        .onChange(async (v) => { s.pagesPanePosition = v; await p.persist(); await p.activatePanes(true); }))
      .addButton((b) => b.setButtonText('Reset panes').onClick(() => p.resetPanes()));

    el.createEl('h3', { text: 'Look' });
    new Setting(el).setName('OneNote theme').setDesc('Purple accents, Segoe UI, OneNote-style page title and tag icons.')
      .addToggle((t) => t.setValue(s.applyTheme).onChange(async (v) => { s.applyTheme = v; await changed(); }));
    new Setting(el).setName('Show ribbon').setDesc('Home / Insert / View toolbar across the top.')
      .addToggle((t) => t.setValue(s.showRibbon).onChange(async (v) => { s.showRibbon = v; await changed(true); }));
    new Setting(el).setName('Show section tabs').setDesc('Colored section tabs above the page.')
      .addToggle((t) => t.setValue(s.showSectionTabs).onChange(async (v) => { s.showSectionTabs = v; await changed(true); }));
    new Setting(el).setName('Show page date and time').setDesc('Shown under the page title. Requires "Show inline title" in Appearance settings. Uses the "created" property when present.')
      .addToggle((t) => t.setValue(s.showPageDate).onChange(async (v) => { s.showPageDate = v; await changed(); }));
    new Setting(el).setName("Hide Obsidian's left ribbon")
      .addToggle((t) => t.setValue(s.hideObsidianRibbon).onChange(async (v) => { s.hideObsidianRibbon = v; await changed(); }));
    new Setting(el).setName('Page font').setDesc('CSS font-family for page text. OneNote uses Calibri.')
      .addText((t) => t.setValue(s.pageFont).onChange(async (v) => { s.pageFont = v; await changed(); }));
    new Setting(el).setName('Interface font')
      .addText((t) => t.setValue(s.uiFont).onChange(async (v) => { s.uiFont = v; await changed(); }));
    new Setting(el).setName('Page font size').setDesc('In pixels. 0 uses Obsidian\'s own font size.')
      .addSlider((sl) => sl.setLimits(0, 24, 1).setValue(s.fontSize).setDynamicTooltip()
        .onChange(async (v) => { s.fontSize = v; await changed(); }));
    new Setting(el).setName('Rule lines')
      .addDropdown((d) => {
        RULE_LINES.forEach((r) => d.addOption(r.id, r.name));
        d.setValue(s.ruleLines).onChange(async (v) => { s.ruleLines = v; await changed(); });
      });
    new Setting(el).setName('Page color')
      .addDropdown((d) => {
        PAGE_COLORS.forEach((c) => d.addOption(c.value, c.name));
        d.setValue(s.pageColor).onChange(async (v) => { s.pageColor = v; await changed(); });
      });
    new Setting(el).setName('Page width')
      .addDropdown((d) => {
        PAGE_WIDTHS.forEach((w) => d.addOption(w.id, w.name));
        d.setValue(s.pageWidth).onChange(async (v) => { s.pageWidth = v; await changed(); });
      });

    el.createEl('h3', { text: 'Pages' });
    new Setting(el).setName('New page name')
      .addText((t) => t.setValue(s.newPageName).onChange(async (v) => { s.newPageName = v.trim() || 'Untitled Page'; await changed(); }));
    new Setting(el).setName('Date format').setDesc('Moment.js format for the page date and Insert › Date.')
      .addMomentFormat((m) => m.setValue(s.dateFormat).setDefaultFormat(DEFAULT_SETTINGS.dateFormat)
        .onChange(async (v) => { s.dateFormat = v || DEFAULT_SETTINGS.dateFormat; await changed(); }));
    new Setting(el).setName('Time format')
      .addMomentFormat((m) => m.setValue(s.timeFormat).setDefaultFormat(DEFAULT_SETTINGS.timeFormat)
        .onChange(async (v) => { s.timeFormat = v || DEFAULT_SETTINGS.timeFormat; await changed(); }));

    el.createEl('h3', { text: 'Ribbon layout' });
    el.createEl('p', {
      cls: 'setting-item-description',
      text: 'You customise the ribbon on the ribbon itself: right-click a button, a group, a tab or an empty area, or drag buttons between groups. The buttons below are only a backup.',
    });
    new Setting(el).setName('Export or import').setDesc('Export saves the whole layout as one JSON file in your vault. Import replaces the current layout with a file you choose.')
      .addButton((b) => b.setButtonText('Export').onClick(() => p.exportRibbon()))
      .addButton((b) => b.setButtonText('Import').onClick(() => p.importRibbon()));
    new Setting(el).setName('Reset').setDesc('Go back to the default tabs, groups and buttons.')
      .addButton((b) => b.setButtonText('Undo last import or reset').onClick(() => p.undoRibbonReplace()))
      .addButton((b) => b.setButtonText('Reset to default').setWarning().onClick(() => p.resetRibbon()));
  }
}

/* ------------------------------------------------------------------ */
/* Plugin                                                              */
/* ------------------------------------------------------------------ */

class OneNotePlugin extends Plugin {
  async onload() {
    for (const name of Object.keys(BRAND_ICONS)) addIcon(name, BRAND_ICONS[name]);
    const data = (await this.loadData()) || {};
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data.settings);
    this.state = Object.assign({}, DEFAULT_STATE, data.state);
    for (const k of MAP_KEYS) this.state[k] = Object.assign({}, this.state[k]);
    this.ribbonLayout = this.loadRibbonLayout(data.ribbon);
    this.ribbonPrevious = data.ribbonPrevious || null;
    this.ribbon = new RibbonView(this);
    // Greys buttons out (or brings them back) when a plugin is turned off or on.
    this.registerInterval(window.setInterval(() => this.ribbon.tick(), 1500));

    this.lastMarkdownView = null;
    this.popover = null;
    this.requestRefresh = debounce(() => this.refresh(), 60, true);
    this.save = debounce(() => this.persist(), 400, true);

    this.registerView(NOTEBOOKS_VIEW, (leaf) => new NotebooksView(leaf, this));
    this.registerView(PAGES_VIEW, (leaf) => new PagesView(leaf, this));
    this.addSettingTab(new OneNoteSettingTab(this.app, this));
    if (this.settings.showNavigation) this.addRibbonIcon('book-open', 'OneNote: show notebooks and pages', () => this.activatePanes(true));
    this.registerCommands();
    this.applyAppearance();

    this.app.workspace.onLayoutReady(async () => {
      this.buildTopBar();
      const { vault, workspace, metadataCache } = this.app;
      this.registerEvent(vault.on('create', () => this.requestRefresh()));
      this.registerEvent(vault.on('delete', () => this.requestRefresh()));
      this.registerEvent(vault.on('rename', (file, oldPath) => this.onRename(file, oldPath)));
      this.registerEvent(workspace.on('file-open', (file) => this.onFileOpen(file)));
      this.registerEvent(workspace.on('active-leaf-change', (leaf) => {
        if (leaf && leaf.view instanceof MarkdownView) this.lastMarkdownView = leaf.view;
        this.decoratePageHeaders();
      }));
      this.registerEvent(workspace.on('layout-change', () => { this.decoratePageHeaders(); this.patchExplorer(); }));
      // Fonts or theme changed: button widths may differ, so measure again.
      this.registerEvent(workspace.on('css-change', () => this.ribbon.remeasure()));
      this.registerEvent(metadataCache.on('changed', () => { this.decoratePageHeaders(); this.requestRefresh(); }));

      this.watchSidebars();
      const mv = workspace.getActiveViewOfType(MarkdownView);
      if (mv) this.lastMarkdownView = mv;
      if (!this.state.navHandedOff) {
        // One-time switch: Fluent OneNote and Notebook Navigator now do navigation.
        this.settings.showNavigation = false;
        this.settings.showSectionTabs = false;
        this.state.navHandedOff = true;
        this.state.pagesDocked = true;
        await this.persist();
        this.buildTopBar();
      }
      if (!this.state.pagesDocked) {
        // One-time switch: dock the Pages list under the file list so subpages are always visible.
        this.settings.pagesPanePosition = 'docked';
        this.state.pagesDocked = true;
        await this.persist();
      }
      await this.activatePanes(!this.state.panesInitialized || this.settings.pagesPanePosition === 'docked');
      if (!this.state.panesInitialized) {
        this.state.panesInitialized = true;
        this.save();
      }
      this.onFileOpen(workspace.getActiveFile());
      this.refresh();
    });
  }

  onunload() {
    this.closePopover();
    if (this.ribbon) this.ribbon.unmount();
    if (this.topBar) this.topBar.remove();
    const b = document.body;
    for (const c of Array.from(b.classList)) if (c.startsWith('onenote-')) b.removeClass(c);
    for (const v of ['--onenote-page-font', '--onenote-ui-font', '--onenote-font-size', '--onenote-page-color', '--onenote-section-color']) {
      b.style.removeProperty(v);
    }
    document.querySelectorAll('.onenote-page-date').forEach((e) => e.remove());
    if (this.sidebarObserver) this.sidebarObserver.disconnect();
    if (this.unpatchExplorer) { this.unpatchExplorer(); this.unpatchExplorer = null; resortExplorers(this.app); }
    document.querySelectorAll('[data-onenote-sub]').forEach((e) => e.removeAttribute('data-onenote-sub'));
  }

  async persist() {
    const data = { settings: this.settings, state: this.state, ribbon: this.ribbonLayout };
    if (this.ribbonPrevious) data.ribbonPrevious = this.ribbonPrevious;
    await this.saveData(data);
  }

  // The saved ribbon layout, or the default one if nothing usable was saved.
  loadRibbonLayout(saved) {
    if (saved) {
      try {
        const layout = normalizeLayout(saved);
        if (layout.tabs.length) return layout;
      } catch (e) {
        console.error('OneNote Style: saved ribbon layout is unreadable, using the default', e);
      }
    }
    return defaultLayout();
  }

  /* ---------- structure ---------- */

  get root() { return this.app.vault.getRoot(); }

  isExcluded(folder) {
    if (folder.name.startsWith('.')) return true;
    const ex = this.settings.excludedFolders.split(',').map((x) => normalizePath(x.trim())).filter((x) => x && x !== '/');
    return ex.some((x) => folder.path === x || folder.path.startsWith(x + '/'));
  }

  isFolder(f) { return f instanceof TFolder && !f.isRoot() && !this.isExcluded(f); }

  getNotebooks() {
    if (this.settings.notebookMode === 'vault') return [this.root];
    return this.root.children.filter((f) => this.isFolder(f)).sort(byName);
  }

  getSections(folder) {
    return folder.children.filter((f) => this.isFolder(f)).sort(byName);
  }

  getPages(folder) {
    const files = folder.children.filter(isPageFile);
    const order = this.state.order[folder.path] || [];
    const idx = new Map(order.map((path, i) => [path, i]));
    files.sort((a, b) => {
      const ia = idx.has(a.path) ? idx.get(a.path) : Infinity;
      const ib = idx.has(b.path) ? idx.get(b.path) : Infinity;
      if (ia !== ib) return ia < ib ? -1 : 1;
      return a.stat.ctime - b.stat.ctime;
    });
    // Subpages follow their parent page.
    return this.underParents(files, (f) => f);
  }

  allSections() {
    const out = [];
    const walk = (f) => { out.push(f); this.getSections(f).forEach(walk); };
    for (const nb of this.getNotebooks()) {
      if (nb.isRoot() || this.getPages(nb).length) out.push(nb);
      this.getSections(nb).forEach(walk);
    }
    return Array.from(new Set(out));
  }

  notebookName(folder) { return folder.isRoot() ? this.app.vault.getName() : folder.name; }

  sectionDisplayName(folder) {
    const nb = this.notebookOf(folder);
    return folder === nb ? 'Unfiled pages' : folder.name;
  }

  sectionLabel(folder) {
    if (!folder) return '';
    const nb = this.notebookOf(folder);
    if (!nb) return folder.path;
    if (folder === nb) return this.notebookName(nb);
    const rel = nb.isRoot() ? folder.path : folder.path.slice(nb.path.length + 1);
    return this.notebookName(nb) + ' › ' + rel.split('/').join(' › ');
  }

  folderAt(path) {
    if (path == null) return null;
    if (path === '/' || path === '') return this.root;
    const f = this.app.vault.getAbstractFileByPath(path);
    return f instanceof TFolder ? f : null;
  }

  notebookOf(folder) {
    if (!folder) return null;
    if (this.settings.notebookMode === 'vault') return this.root;
    if (folder.isRoot()) return null;
    let nb = folder;
    while (nb.parent && !nb.parent.isRoot()) nb = nb.parent;
    return this.isExcluded(nb) ? null : nb;
  }

  locate(file) {
    if (!file) return null;
    const section = file instanceof TFolder ? file : file.parent;
    const notebook = this.notebookOf(section);
    if (!notebook || this.isExcluded(section) && !section.isRoot()) return null;
    return { notebook, section };
  }

  get currentNotebook() {
    const nbs = this.getNotebooks();
    const nb = this.folderAt(this.state.notebook);
    return nb && nbs.includes(nb) ? nb : nbs[0] || null;
  }

  get currentSection() {
    const nb = this.currentNotebook;
    if (!nb) return null;
    const s = this.folderAt(this.state.section);
    if (s && isInside(nb, s) && (s === nb || this.isFolder(s))) return s;
    return this.getSections(nb)[0] || (this.getPages(nb).length ? nb : null);
  }

  /**
   * Subpages are plain notes in the same folder as their parent page. A subpage names
   * its parent in its own front matter:  parent: "[[Parent page]]"
   * Nothing else marks it, so the notes stay pure Markdown and no folder is created.
   */
  parentOf(file) {
    if (typeof file === 'string') file = this.app.vault.getAbstractFileByPath(file);
    if (!(file instanceof TFile) || file.extension !== 'md') return null;
    const fm = (this.app.metadataCache.getFileCache(file) || {}).frontmatter;
    let raw = fm && fm.parent;
    if (Array.isArray(raw)) raw = raw[0];
    if (typeof raw !== 'string') return null;
    const m = raw.match(/\[\[([^\]|#]+)/);
    const link = (m ? m[1] : raw).trim();
    if (!link) return null;
    const dest = this.app.metadataCache.getFirstLinkpathDest(link, file.path);
    return dest instanceof TFile && dest !== file && dest.parent === file.parent ? dest : null;
  }

  /** 0 = page, 1 = subpage, 2 = subpage of a subpage (deeper chains show as 2). */
  levelOf(file) {
    let level = 0;
    const seen = new Set();
    let cur = file;
    while (level < 2) {
      const parent = this.parentOf(cur);
      if (!parent || seen.has(parent.path)) break;
      seen.add(parent.path);
      cur = parent;
      level++;
    }
    return level;
  }

  /** Regroups an already sorted list so subpages sit under their parent (see subpages.js). */
  underParents(items, fileOf) {
    const pathOf = (item) => { const f = fileOf(item); return f ? f.path : ''; };
    return groupUnderParents(items, pathOf, (item) => {
      const parent = this.parentOf(fileOf(item));
      return parent ? parent.path : null;
    });
  }

  /**
   * Obsidian's file explorer: subpages sit under their parent page, and the explorer's
   * own sort order (A-Z, Z-A, newest...) applies within each level.
   */
  patchExplorer() {
    if (this.unpatchExplorer) return;
    this.unpatchExplorer = patchExplorerSort(this.app, (rows) => this.underParents(rows, (row) => row.file));
    if (this.unpatchExplorer) resortExplorers(this.app);
  }

  parentLink(parent, from) {
    return '[[' + this.app.metadataCache.fileToLinktext(parent, from.path, true) + ']]';
  }

  async setParent(file, parent) {
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      if (parent) fm.parent = this.parentLink(parent, file);
      else delete fm.parent;
    });
  }

  colorOf(folder) {
    const c = this.state.colors[folder.path];
    if (c) return c;
    let h = 0;
    for (const ch of folder.name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return SECTION_COLORS[h % SECTION_COLORS.length];
  }

  uniquePath(folder, base, ext) {
    const dir = folder.isRoot() ? '' : folder.path + '/';
    const clean = base.replace(/[\\/:*?"<>|#^[\]]/g, '').trim() || 'Untitled';
    let name = clean;
    let n = 1;
    while (this.app.vault.getAbstractFileByPath(normalizePath(dir + name + (ext ? '.' + ext : '')))) name = `${clean} ${++n}`;
    return normalizePath(dir + name + (ext ? '.' + ext : ''));
  }

  /* ---------- navigation ---------- */

  onFileOpen(file) {
    const loc = this.locate(file);
    if (loc && isPageFile(file)) {
      this.state.notebook = loc.notebook.path;
      this.state.section = loc.section.path;
      this.state.lastPage[loc.section.path] = file.path;
      this.state.lastSection[loc.notebook.path] = loc.section.path;
      this.save();
    }
    this.requestRefresh();
  }

  async openPage(file, newTab) {
    await this.app.workspace.getLeaf(newTab ? 'tab' : false).openFile(file);
  }

  async openSection(folder) {
    const nb = this.notebookOf(folder);
    if (nb) this.state.notebook = nb.path;
    this.state.section = folder.path;
    if (nb) this.state.lastSection[nb.path] = folder.path;
    this.save();
    const pages = this.getPages(folder);
    const target = pages.find((f) => f.path === this.state.lastPage[folder.path]) || pages[0];
    if (target && target !== this.app.workspace.getActiveFile()) await this.openPage(target);
    this.refresh();
  }

  async openNotebook(nb) {
    this.state.notebook = nb.path;
    const last = this.folderAt(this.state.lastSection[nb.path]);
    const section = last && isInside(nb, last) ? last : (this.getSections(nb)[0] || nb);
    await this.openSection(section);
  }

  async stepPage(delta) {
    const section = this.currentSection;
    if (!section) return;
    const pages = this.getPages(section);
    const i = pages.indexOf(this.app.workspace.getActiveFile());
    const next = pages[i + delta];
    if (next) await this.openPage(next);
  }

  async stepSection(delta) {
    const sections = this.allSections().filter((s) => this.notebookOf(s) === this.currentNotebook);
    const i = sections.indexOf(this.currentSection);
    const next = sections[(i + delta + sections.length) % sections.length];
    if (next) await this.openSection(next);
  }

  /* ---------- creating & editing structure ---------- */

  async ensureSection() {
    let section = this.currentSection;
    if (section) return section;
    let nb = this.currentNotebook;
    if (!nb) {
      nb = await this.app.vault.createFolder(this.uniquePath(this.root, 'My Notebook'));
    }
    section = await this.app.vault.createFolder(this.uniquePath(nb, 'Quick Notes'));
    return section;
  }

  async createPage(opts) {
    opts = opts || {};
    const section = opts.section || await this.ensureSection();
    const ext = opts.canvas ? 'canvas' : 'md';
    const path = this.uniquePath(section, this.settings.newPageName, ext);
    const parent = !opts.canvas && opts.parent instanceof TFile && opts.parent.parent === section ? opts.parent : null;
    const body = parent
      ? '---\nparent: "[[' + this.app.metadataCache.fileToLinktext(parent, path, true) + ']]"\n---\n'
      : '';
    const file = await this.app.vault.create(path, opts.canvas ? '{"nodes":[],"edges":[]}' : body);
    const list = this.getPages(section).filter((f) => f !== file).map((f) => f.path);
    const after = opts.after;
    let i = after ? list.indexOf(after.path) : -1;
    if (i >= 0) {
      const lvl = this.levelOf(after);
      i++;
      while (i < list.length && this.levelOf(list[i]) > lvl) i++;
      list.splice(i, 0, file.path);
    } else {
      list.push(file.path);
    }
    this.state.order[section.path] = list;
    this.save();
    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(file, { state: { mode: 'source' } });
    if (!opts.canvas) this.focusTitle(leaf, file);
    return file;
  }

  /* ---------- subpages ---------- */

  isFolderNote(f) { return f instanceof TFile && f.parent && !f.parent.isRoot() && f.basename === f.parent.name; }

  async createSubpage() {
    const cur = this.app.workspace.getActiveFile();
    if (!cur || cur.extension !== 'md') {
      new Notice('Open a page first. The subpage is created under the page you are on.');
      return;
    }
    // OneNote has two levels of subpages: below that, the new page becomes a sibling.
    const parent = this.levelOf(cur) < 2 ? cur : this.parentOf(cur);
    return this.createPage({ section: cur.parent, after: cur, parent });
  }

  /** The page and everything below it. */
  familyOf(file) {
    const out = new Set([file.path]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const f of file.parent.children) {
        if (!(f instanceof TFile) || out.has(f.path)) continue;
        const p = this.parentOf(f);
        if (p && out.has(p.path)) { out.add(f.path); grew = true; }
      }
    }
    return out;
  }

  async makeSubpage(file) {
    const family = this.familyOf(file);
    const candidates = file.parent.children.filter((c) => c instanceof TFile && c.extension === 'md' && !family.has(c.path) && this.levelOf(c) < 2);
    if (!candidates.length) {
      new Notice('There is no other page in this folder to put it under.');
      return;
    }
    new PageSuggestModal(this.app, candidates, `Make "${file.basename}" a subpage of...`, async (parent) => {
      try {
        await this.setParent(file, parent);
        new Notice(`"${file.basename}" is now a subpage of "${parent.basename}".`);
      } catch (e) { new Notice(String(e.message || e)); }
    }).open();
  }

  async promotePage(file) {
    const parent = this.parentOf(file);
    if (!parent) {
      new Notice(`"${file.basename}" is already a top-level page.`);
      return;
    }
    await this.setParent(file, this.parentOf(parent));
    new Notice(`"${file.basename}" moved up one level.`);
  }

  /**
   * Undoes the older "page folder" format (Section/Page/Page.md with the subpages beside
   * it): the notes move up into the section and the subpages get a parent property.
   * The emptied folder is left in place; nothing is deleted.
   */
  async flattenPageFolder() {
    const cur = this.app.workspace.getActiveFile();
    const folder = cur && cur.parent;
    const main = folder && !folder.isRoot() ? folder.children.find((c) => this.isFolderNote(c) && c.extension === 'md') : null;
    if (!main || !folder.parent) {
      new Notice('Open a page that sits in a page folder (a folder with a note of the same name).');
      return;
    }
    const target = folder.parent;
    const notes = folder.children.filter((c) => c instanceof TFile && c.extension === 'md');
    const subfolders = folder.children.some((c) => c instanceof TFolder);
    const ok = await confirmAction(this.app, 'Turn page folder into plain subpages',
      `Move "${main.basename}" and its ${notes.length - 1} subpage(s) out of the folder "${folder.name}" into "${target.isRoot() ? 'the vault' : target.name}"? The subpages keep their place under "${main.basename}" through a "parent" property. The folder itself is not deleted.`, 'Move');
    if (!ok) return;
    for (const note of notes) {
      await this.app.fileManager.renameFile(note, this.uniquePath(target, note.basename, note.extension));
    }
    for (const note of notes) if (note !== main) await this.setParent(note, main);
    new Notice(subfolders
      ? `Done. The folder "${folder.name}" still holds other folders, so it stays.`
      : `Done. The folder "${folder.name}" is now empty (apart from attachments); you can delete it.`, 8000);
  }

  focusTitle(leaf, file) {
    setTimeout(async () => {
      const el = leaf.view && leaf.view.inlineTitleEl;
      if (el && el.isShown && el.isShown()) {
        el.focus();
        const r = document.createRange();
        r.selectNodeContents(el);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(r);
        return;
      }
      const name = await promptText(this.app, 'Page title', file.basename, 'Rename');
      if (name && name !== file.basename) await this.renameFile(file, name);
    }, 80);
  }

  async createSection(notebook) {
    const parent = notebook || this.currentNotebook;
    if (!parent) return this.createNotebook();
    const name = await promptText(this.app, 'New section', 'New Section', 'Create');
    if (!name) return;
    const folder = await this.app.vault.createFolder(this.uniquePath(parent, name));
    this.state.colors[folder.path] = SECTION_COLORS[this.getSections(parent).length % SECTION_COLORS.length];
    this.state.notebook = this.notebookOf(folder).path;
    this.state.section = folder.path;
    await this.createPage({ section: folder });
  }

  async createNotebook() {
    if (this.settings.notebookMode === 'vault') {
      new Notice('Your vault is set up as a single notebook. Change "Notebook structure" in settings to use several.');
      return;
    }
    const name = await promptText(this.app, 'New notebook', 'New Notebook', 'Create');
    if (!name) return;
    const nb = await this.app.vault.createFolder(this.uniquePath(this.root, name));
    const section = await this.app.vault.createFolder(this.uniquePath(nb, 'New Section 1'));
    this.state.colors[section.path] = SECTION_COLORS[0];
    this.state.expanded[nb.path] = true;
    this.state.notebook = nb.path;
    this.state.section = section.path;
    await this.createPage({ section });
  }

  async renameFile(file, name) {
    const parent = file.parent;
    const path = this.uniquePath(parent, name, file instanceof TFile ? file.extension : '');
    await this.app.fileManager.renameFile(file, path);
  }

  async deleteFile(file, what) {
    const ok = await confirmAction(this.app, `Delete ${what}`, `Delete "${file.name}"? It will be moved to the trash.`);
    if (!ok) return;
    if (this.app.fileManager.trashFile) await this.app.fileManager.trashFile(file);
    else await this.app.vault.trash(file, true);
  }

  setLevel(file, delta) {
    if (!(file instanceof TFile) || file.extension !== 'md') {
      new Notice('Subpages work with notes (not canvases or images).');
      return;
    }
    return delta > 0 ? this.makeSubpage(file) : this.promotePage(file);
  }

  /** Subpages only show in the Pages list, so bring it to the front. */
  async revealPages() {
    const ws = this.app.workspace;
    if (!this.settings.showNavigation) return;
    await this.activatePanes(false);
    const leaf = ws.getLeavesOfType(PAGES_VIEW)[0];
    if (!leaf) return;
    const side = leaf.getRoot();
    if (side && side.collapsed && side.expand) side.expand();
    ws.revealLeaf(leaf);
  }

  async movePage(file, section) {
    if (file.parent === section) return;
    await this.app.fileManager.renameFile(file, this.uniquePath(section, file.basename, file.extension));
    this.save();
  }

  async dropPage(path, target, after) {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile) || file === target) return;
    if (file.parent !== target.parent) await this.movePage(file, target.parent);
    const section = target.parent;
    const list = this.getPages(section).map((f) => f.path);
    const from = list.indexOf(file.path);
    let end = from + 1;
    const lvl = this.levelOf(file);
    while (end < list.length && this.levelOf(list[end]) > lvl) end++;
    const block = list.splice(from, end - from);
    if (block.includes(target.path)) return;
    let to = list.indexOf(target.path);
    if (after) {
      const tl = this.levelOf(target);
      to++;
      while (to < list.length && this.levelOf(list[to]) > tl) to++;
    }
    list.splice(to, 0, ...block);
    this.state.order[section.path] = list;
    this.save();
    this.refresh();
  }

  makeDropTarget(el, folder) {
    el.addEventListener('dragover', (e) => {
      if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
      e.preventDefault();
      el.addClass('is-drop-target');
    });
    el.addEventListener('dragleave', () => el.removeClass('is-drop-target'));
    el.addEventListener('drop', async (e) => {
      el.removeClass('is-drop-target');
      const path = e.dataTransfer.getData(DRAG_TYPE);
      const file = path && this.app.vault.getAbstractFileByPath(path);
      if (!(file instanceof TFile)) return;
      e.preventDefault();
      await this.movePage(file, folder);
    });
  }

  onRename(file, oldPath) {
    const mig = (p) => (p === oldPath ? file.path : p && p.startsWith(oldPath + '/') ? file.path + p.slice(oldPath.length) : p);
    for (const k of MAP_KEYS) {
      const next = {};
      for (const [key, val] of Object.entries(this.state[k])) {
        next[mig(key)] = Array.isArray(val) ? val.map(mig) : typeof val === 'string' && k.startsWith('last') ? mig(val) : val;
      }
      this.state[k] = next;
    }
    this.state.notebook = mig(this.state.notebook);
    this.state.section = mig(this.state.section);
    this.save();
    this.requestRefresh();
  }

  /* ---------- context menus ---------- */

  pageMenu(evt, file) {
    const m = new Menu();
    m.addItem((i) => i.setTitle('Open in new tab').setIcon('file-plus').onClick(() => this.openPage(file, true)));
    m.addItem((i) => i.setTitle('Rename').setIcon('pencil').onClick(async () => {
      const name = await promptText(this.app, 'Rename page', file.basename, 'Rename');
      if (name && name !== file.basename) await this.renameFile(file, name);
    }));
    m.addSeparator();
    m.addItem((i) => i.setTitle('New page below').setIcon('file-plus-2').onClick(() => this.createPage({ section: file.parent, after: file, parent: this.parentOf(file) })));
    m.addItem((i) => i.setTitle('New subpage').setIcon('corner-down-right').onClick(() => this.createPage({ section: file.parent, after: file, parent: this.levelOf(file) < 2 ? file : this.parentOf(file) })));
    if (this.levelOf(file) < 2) m.addItem((i) => i.setTitle('Make subpage').setIcon('indent').onClick(() => this.setLevel(file, 1)));
    if (this.levelOf(file) > 0) m.addItem((i) => i.setTitle('Promote subpage').setIcon('outdent').onClick(() => this.setLevel(file, -1)));
    m.addSeparator();
    m.addItem((i) => i.setTitle('Move to section...').setIcon('folder-input').onClick(() => {
      new SectionSuggestModal(this.app, this, (s) => this.movePage(file, s)).open();
    }));
    m.addItem((i) => i.setTitle('Copy link to page').setIcon('link').onClick(() => {
      navigator.clipboard.writeText(this.app.fileManager.generateMarkdownLink(file, ''));
      new Notice('Link copied');
    }));
    m.addSeparator();
    m.addItem((i) => i.setTitle('Delete page').setIcon('trash').onClick(() => this.deleteFile(file, 'page')));
    m.showAtMouseEvent(evt);
  }

  sectionMenu(evt, folder) {
    const m = new Menu();
    m.addItem((i) => i.setTitle('New page').setIcon('file-plus').onClick(() => this.createPage({ section: folder })));
    m.addItem((i) => i.setTitle('New section').setIcon('folder-plus').onClick(() => this.createSection(folder.parent && !folder.parent.isRoot() ? folder.parent : this.notebookOf(folder))));
    m.addItem((i) => i.setTitle('New section inside (section group)').setIcon('folder-tree').onClick(() => this.createSection(folder)));
    m.addSeparator();
    m.addItem((i) => i.setTitle('Rename').setIcon('pencil').onClick(async () => {
      const name = await promptText(this.app, 'Rename section', folder.name, 'Rename');
      if (name && name !== folder.name) await this.renameFile(folder, name);
    }));
    m.addItem((i) => i.setTitle('Section color...').setIcon('palette').onClick(() => this.pickFolderColor(folder, evt)));
    m.addSeparator();
    m.addItem((i) => i.setTitle('Delete section').setIcon('trash').onClick(() => this.deleteFile(folder, 'section')));
    m.showAtMouseEvent(evt);
  }

  notebookMenu(evt, nb) {
    const m = new Menu();
    m.addItem((i) => i.setTitle('New section').setIcon('folder-plus').onClick(() => this.createSection(nb)));
    if (!nb.isRoot()) {
      m.addItem((i) => i.setTitle('Rename notebook').setIcon('pencil').onClick(async () => {
        const name = await promptText(this.app, 'Rename notebook', nb.name, 'Rename');
        if (name && name !== nb.name) await this.renameFile(nb, name);
      }));
      m.addItem((i) => i.setTitle('Notebook color...').setIcon('palette').onClick(() => this.pickFolderColor(nb, evt)));
      m.addSeparator();
      m.addItem((i) => i.setTitle('Delete notebook').setIcon('trash').onClick(() => this.deleteFile(nb, 'notebook')));
    }
    m.showAtMouseEvent(evt);
  }

  pickFolderColor(folder, evt) {
    this.showPopover(null, (pop, close) => {
      pop.createDiv({ cls: 'onenote-popover-title', text: 'Color' });
      const grid = pop.createDiv('onenote-swatch-grid');
      for (const c of SECTION_COLORS) {
        const sw = grid.createDiv({ cls: 'onenote-swatch' });
        sw.style.backgroundColor = c;
        sw.onclick = () => { this.state.colors[folder.path] = c; this.save(); this.refresh(); close(); };
      }
    }, { x: evt.clientX, y: evt.clientY });
  }

  /* ---------- appearance ---------- */

  applyAppearance() {
    const b = document.body;
    const s = this.settings;
    b.toggleClass('onenote-theme', s.applyTheme);
    b.toggleClass('onenote-hide-obsidian-ribbon', s.hideObsidianRibbon);
    for (const r of RULE_LINES) b.removeClass('onenote-rules-' + r.id);
    b.toggleClass('onenote-rules', s.ruleLines !== 'none');
    if (s.ruleLines !== 'none') b.addClass('onenote-rules-' + s.ruleLines);
    for (const w of PAGE_WIDTHS) b.removeClass('onenote-width-' + w.id);
    b.addClass('onenote-width-' + s.pageWidth);
    b.toggleClass('onenote-has-page-color', !!s.pageColor);
    b.toggleClass('onenote-has-font-size', s.fontSize > 0);
    b.style.setProperty('--onenote-page-font', s.pageFont);
    b.style.setProperty('--onenote-ui-font', s.uiFont);
    b.style.setProperty('--onenote-font-size', s.fontSize + 'px');
    if (s.pageColor) b.style.setProperty('--onenote-page-color', s.pageColor);
    else b.style.removeProperty('--onenote-page-color');
  }

  async setAppearance(key, value) {
    this.settings[key] = value;
    await this.persist();
    this.applyAppearance();
  }

  decoratePageHeaders() {
    const show = this.settings.showPageDate;
    for (const leaf of this.app.workspace.getLeavesOfType('markdown')) {
      const view = leaf.view;
      if (!(view instanceof MarkdownView)) continue;
      const titles = view.containerEl.querySelectorAll('.inline-title');
      if (!show || !view.file) {
        view.containerEl.querySelectorAll('.onenote-page-date').forEach((e) => e.remove());
        continue;
      }
      const fm = (this.app.metadataCache.getFileCache(view.file) || {}).frontmatter;
      const raw = fm && (fm.created || fm.date);
      let m = raw ? moment(raw) : null;
      if (!m || !m.isValid()) m = moment(view.file.stat.ctime);
      const date = m.format(this.settings.dateFormat);
      const time = m.format(this.settings.timeFormat);
      titles.forEach((t) => {
        // Other plugins (e.g. Iconic) wrap the title in their own row, so anchor the date to
        // the title's top-level block in the page header and keep exactly one date per header.
        const container = t.closest('.mod-header, .cm-sizer') || t.parentElement;
        let anchor = t;
        while (anchor.parentElement && anchor.parentElement !== container) anchor = anchor.parentElement;
        const existing = Array.from(container.querySelectorAll('.onenote-page-date'));
        let d = existing.find((e) => e.parentElement === container) || null;
        for (const e of existing) if (e !== d) e.remove();
        if (!d) d = createDiv({ cls: 'onenote-page-date', attr: { contenteditable: 'false' } });
        if (anchor.nextElementSibling !== d) anchor.after(d);
        if (d.dataset.stamp !== date + time) {
          d.empty();
          d.createSpan({ text: date });
          d.createSpan({ text: time });
          d.dataset.stamp = date + time;
        }
      });
    }
  }

  /**
   * Marks subpages in the file lists of the sidebars (Notebook Navigator and Obsidian's
   * file explorer) so the stylesheet can indent them and draw the little "L". Only an
   * attribute is set on rows those lists already show; their order is theirs.
   */
  decorateSidebars() {
    for (const el of document.querySelectorAll('.nn-file[data-path], .nav-file-title[data-path]')) {
      const path = el.getAttribute('data-path');
      const level = path && path.endsWith('.md') ? this.levelOf(path) : 0;
      if (level) el.setAttribute('data-onenote-sub', String(level));
      else if (el.hasAttribute('data-onenote-sub')) el.removeAttribute('data-onenote-sub');
    }
  }

  watchSidebars() {
    const run = debounce(() => this.decorateSidebars(), 80, true);
    // The lists draw rows as they scroll into view, so watch for new rows.
    this.sidebarObserver = new MutationObserver((records) => {
      if (records.some((r) => r.addedNodes.length)) run();
    });
    const ws = document.body.querySelector('.workspace');
    if (ws) this.sidebarObserver.observe(ws, { childList: true, subtree: true });
    run();
  }

  refresh() {
    this.patchExplorer();
    resortExplorers(this.app);
    this.decorateSidebars();
    const sec = this.currentSection;
    const color = sec && sec !== this.notebookOf(sec) ? this.colorOf(sec) : '#B4B4B4';
    document.body.style.setProperty('--onenote-section-color', color);
    this.renderSectionTabs();
    for (const type of [NOTEBOOKS_VIEW, PAGES_VIEW]) {
      for (const leaf of this.app.workspace.getLeavesOfType(type)) {
        if (leaf.view instanceof NotebooksView || leaf.view instanceof PagesView) leaf.view.render();
      }
    }
    this.decoratePageHeaders();
  }

  /* ---------- panes ---------- */

  async activatePanes(reveal) {
    const ws = this.app.workspace;
    if (!this.settings.showNavigation) {
      ws.detachLeavesOfType(NOTEBOOKS_VIEW);
      ws.detachLeavesOfType(PAGES_VIEW);
      return;
    }
    let nb = ws.getLeavesOfType(NOTEBOOKS_VIEW)[0];
    if (!nb) {
      nb = ws.getLeftLeaf(false);
      await nb.setViewState({ type: NOTEBOOKS_VIEW, active: false });
    }
    const want = this.settings.pagesPanePosition;
    const explorer = ws.getLeavesOfType('file-explorer')[0];
    let pages = ws.getLeavesOfType(PAGES_VIEW)[0];
    // Move the Pages list if it sits somewhere other than the chosen position.
    if (pages) {
      const inRight = pages.getRoot() === ws.rightSplit;
      const tabsOfExplorer = explorer && pages.parent === explorer.parent;
      const wrong = want === 'right' ? !inRight : inRight || (want === 'docked' && tabsOfExplorer);
      if (wrong) { pages.detach(); pages = null; }
    }
    if (!pages) {
      if (want === 'right') pages = ws.getRightLeaf(false);
      else if (want === 'docked' && explorer) pages = ws.createLeafBySplit(explorer, 'horizontal');
      else pages = ws.getLeftLeaf(true);
      await pages.setViewState({ type: PAGES_VIEW, active: false });
    }
    if (reveal) {
      if (want === 'docked') {
        if (ws.leftSplit && ws.leftSplit.collapsed) ws.leftSplit.expand();
        ws.revealLeaf(pages);
        if (explorer) ws.revealLeaf(explorer);
      } else {
        ws.revealLeaf(nb);
        ws.revealLeaf(pages);
      }
    }
  }

  async resetPanes() {
    const ws = this.app.workspace;
    ws.detachLeavesOfType(NOTEBOOKS_VIEW);
    ws.detachLeavesOfType(PAGES_VIEW);
    await this.activatePanes(true);
  }

  async togglePane(type) {
    const ws = this.app.workspace;
    let leaf = ws.getLeavesOfType(type)[0];
    if (!leaf) { await this.activatePanes(false); leaf = ws.getLeavesOfType(type)[0]; }
    if (!leaf) return;
    const root = leaf.getRoot();
    const split = root === ws.leftSplit ? ws.leftSplit : root === ws.rightSplit ? ws.rightSplit : null;
    if (split && !split.collapsed && leaf.view.containerEl.isShown()) split.collapse();
    else ws.revealLeaf(leaf);
  }

  toggleFullPage() {
    const ws = this.app.workspace;
    const on = !document.body.hasClass('onenote-fullpage');
    document.body.toggleClass('onenote-fullpage', on);
    if (on) {
      this.splitsBeforeFullPage = { left: ws.leftSplit.collapsed, right: ws.rightSplit.collapsed };
      ws.leftSplit.collapse();
      ws.rightSplit.collapse();
    } else {
      const prev = this.splitsBeforeFullPage || { left: false, right: false };
      if (!prev.left) ws.leftSplit.expand();
      if (!prev.right) ws.rightSplit.expand();
    }
    this.renderTabRow();
  }

  /* ---------- editor actions ---------- */

  exec(id) {
    const cmds = this.app.commands;
    if (!cmds || !(cmds.commands[id] || (cmds.editorCommands && cmds.editorCommands[id]))) return false;
    return cmds.executeCommandById(id);
  }

  async withEditor(fn) {
    const ws = this.app.workspace;
    let ae = ws.activeEditor;
    if (!ae || !ae.editor) {
      const v = this.lastMarkdownView;
      if (v && v.leaf && v.leaf.view === v && v.containerEl.isConnected) {
        ws.setActiveLeaf(v.leaf, { focus: true });
        ae = v;
      }
    } else if (ae instanceof MarkdownView && ws.activeLeaf !== ae.leaf) {
      ws.setActiveLeaf(ae.leaf, { focus: true });
    }
    if (!ae || !ae.editor) { new Notice('Open a page to use this.'); return; }
    if (ae instanceof MarkdownView && ae.getMode() === 'preview') {
      await ae.setState(Object.assign({}, ae.getState(), { mode: 'source' }), { history: false });
    }
    const editor = ae.editor;
    try {
      await fn(editor);
    } finally {
      editor.focus();
    }
  }

  // Run a built-in Obsidian editor command, falling back to our own implementation.
  cmd(id, fallback) {
    return this.withEditor((e) => { if (!this.exec(id) && fallback) fallback(e); });
  }

  edit(fn) { return this.withEditor(fn); }

  stamp(kind) {
    const m = moment();
    const s = this.settings;
    const text = kind === 'date' ? m.format(s.dateFormat)
      : kind === 'time' ? m.format(s.timeFormat)
        : m.format(s.dateFormat) + ' ' + m.format(s.timeFormat);
    return this.edit((e) => e.replaceSelection(text));
  }

  async paste() {
    const text = await navigator.clipboard.readText();
    return this.edit((e) => e.replaceSelection(text));
  }

  copy(cut) {
    return this.edit(async (e) => {
      const sel = e.getSelection();
      if (!sel) return;
      await navigator.clipboard.writeText(sel);
      if (cut) e.replaceSelection('');
    });
  }

  registerCommands() {
    const ed = (id, name, fn, hotkeys) => this.addCommand({ id, name, editorCallback: (e) => fn(e), hotkeys });
    const key = (mods, k) => [{ modifiers: mods, key: k }];

    for (const t of TAGS) {
      ed(`tag-${t.id}`, `Tag: ${t.name}`, (e) => mapLines(e, (l) => toggleTagLine(l, t.char)), key(['Mod'], t.key));
    }
    ed('remove-tags', 'Tag: Remove tags', (e) => mapLines(e, (l) => {
      const m = l.match(TASK_RE);
      return m[3] === undefined ? l : (/^\d/.test(m[2]) ? m[1] + m[2] + m[4] : m[1] + m[4]);
    }));
    this.addCommand({ id: 'find-tags', name: 'Find tags (Tags Summary)', callback: () => new TagSummaryModal(this.app, this).open() });

    ed('underline', 'Underline', (e) => wrap(e, '<u>', '</u>'), key(['Mod'], 'U'));
    ed('highlight', 'Highlight', (e) => wrap(e, '==', '=='), key(['Mod', 'Alt'], 'H'));
    // OneNote's Ctrl+= / Ctrl+Shift+= would clash with Obsidian's zoom keys, so no default hotkeys here.
    ed('subscript', 'Subscript', (e) => wrap(e, '<sub>', '</sub>'));
    ed('superscript', 'Superscript', (e) => wrap(e, '<sup>', '</sup>'));
    ed('clear-formatting', 'Clear formatting', (e) => this.clearFormat(e));
    for (let n = 1; n <= 6; n++) {
      ed(`heading-${n}`, `Style: Heading ${n}`, (e) => mapLines(e, (l) => styleLine(l, n)), key(['Mod', 'Alt'], String(n)));
    }
    ed('normal', 'Style: Normal', (e) => mapLines(e, (l) => styleLine(l, 0)), key(['Mod', 'Shift'], 'N'));
    ed('bullets', 'Bulleted list', () => this.exec('editor:toggle-bullet-list'), key(['Mod'], '.'));
    // Ctrl+/ is Obsidian's "Toggle comment", so numbering has no default hotkey.
    ed('numbering', 'Numbered list', () => this.exec('editor:toggle-numbered-list'));
    ed('insert-date', 'Insert date', () => this.stamp('date'), key(['Alt', 'Shift'], 'D'));
    ed('insert-time', 'Insert time', () => this.stamp('time'), key(['Alt', 'Shift'], 'T'));
    ed('insert-datetime', 'Insert date and time', () => this.stamp('datetime'), key(['Alt', 'Shift'], 'F'));

    this.addCommand({ id: 'new-page', name: 'New page', callback: () => this.createPage() });
    this.addCommand({ id: 'new-subpage', name: 'New subpage', callback: () => this.createSubpage(), hotkeys: key(['Mod', 'Shift', 'Alt'], 'N') });
    this.addCommand({ id: 'new-canvas-page', name: 'New free-form page (Canvas)', callback: () => this.createPage({ canvas: true }) });
    this.addCommand({ id: 'new-section', name: 'New section', callback: () => this.createSection() });
    this.addCommand({ id: 'new-notebook', name: 'New notebook', callback: () => this.createNotebook() });
    this.addCommand({ id: 'next-page', name: 'Go to next page', callback: () => this.stepPage(1), hotkeys: key(['Alt'], 'PageDown') });
    this.addCommand({ id: 'prev-page', name: 'Go to previous page', callback: () => this.stepPage(-1), hotkeys: key(['Alt'], 'PageUp') });
    this.addCommand({ id: 'next-section', name: 'Go to next section', callback: () => this.stepSection(1) });
    this.addCommand({ id: 'prev-section', name: 'Go to previous section', callback: () => this.stepSection(-1) });
    this.addCommand({ id: 'make-subpage', name: 'Make current page a subpage', callback: () => this.withActivePage((f) => this.setLevel(f, 1)), hotkeys: key(['Mod', 'Alt'], ']') });
    this.addCommand({ id: 'promote-subpage', name: 'Promote current subpage', callback: () => this.withActivePage((f) => this.setLevel(f, -1)), hotkeys: key(['Mod', 'Alt'], '[') });
    this.addCommand({ id: 'flatten-page-folder', name: 'Turn page folder into plain subpages', callback: () => this.flattenPageFolder() });
    this.addCommand({ id: 'toggle-ribbon', name: 'Collapse or expand the ribbon', callback: () => this.toggleRibbon(), hotkeys: key(['Mod'], 'F1') });
    this.addCommand({ id: 'full-page-view', name: 'Toggle full page view', callback: () => this.toggleFullPage() });
    this.addCommand({ id: 'show-panes', name: 'Show notebooks and pages panes', callback: () => this.activatePanes(true) });

    // Commands for the ribbon's default buttons. Every ribbon button runs a command,
    // so everything the old fixed ribbon could do is a command now.
    const run = (id, name, callback) => this.addCommand({ id, name, callback });
    run('paste', 'Paste', () => this.paste());
    run('cut', 'Cut', () => this.copy(true));
    run('copy', 'Copy', () => this.copy(false));
    run('undo', 'Undo', () => this.edit((e) => e.undo()));
    run('redo', 'Redo', () => this.edit((e) => e.redo()));
    run('highlight-color', 'Highlight color...', () => this.highlightPicker(this.pickerAnchor()));
    run('font-color', 'Font color...', () => this.fontColorPicker(this.pickerAnchor()));
    run('insert-table-grid', 'Insert table (choose size)...', () => this.tablePicker(this.pickerAnchor()));
    run('insert-symbol', 'Insert symbol...', () => this.symbolPicker(this.pickerAnchor()));
    run('page-color', 'Page color...', () => this.pageColorPicker(this.pickerAnchor()));
    run('rule-lines', 'Rule lines...', () => this.choiceMenu(RULE_LINES, 'ruleLines'));
    run('page-width', 'Page width...', () => this.choiceMenu(PAGE_WIDTHS, 'pageWidth'));
    run('use-light-mode', 'Use light mode', () => setDarkMode(this.app, false, document));
    run('use-dark-mode', 'Use dark mode', () => setDarkMode(this.app, true, document));
    run('open-community-plugins', 'Open Community plugins', () => openSettings(this.app, 'community-plugins'));
    run('open-ai-chatbridge-settings', 'Open AI ChatBridge settings', () => this.openAiSettings());
    run('toggle-section-tabs', 'Show or hide section tabs', async () => {
      this.settings.showSectionTabs = !this.settings.showSectionTabs;
      await this.persist();
      this.buildTopBar();
    });
    run('ribbon-export', 'Ribbon: export layout to a file', () => this.exportRibbon());
    run('ribbon-import', 'Ribbon: import layout from a file', () => this.importRibbon());
    run('ribbon-reset', 'Ribbon: reset to the default layout', () => this.resetRibbon());
    run('ribbon-undo-replace', 'Ribbon: undo last import or reset', () => this.undoRibbonReplace());
  }

  withActivePage(fn) {
    const f = this.app.workspace.getActiveFile();
    if (f && (isPageFile(f) || f.extension === 'md')) fn(f);
    else new Notice('Open a page first.');
  }

  clearFormat(e) {
    if (e.getSelection()) e.replaceSelection(clearFormatting(e.getSelection()));
    else mapLines(e, (l) => clearFormatting(styleLine(l, 0)));
  }

  /* ---------- top bar: tab row, ribbon, section tabs ---------- */

  buildTopBar() {
    if (this.ribbon) this.ribbon.unmount();
    if (this.topBar) this.topBar.remove();
    this.topBar = null;
    const at = mountPoint(document);
    const s = this.settings;
    document.body.toggleClass('onenote-has-topbar', !!at && (s.showRibbon || s.showSectionTabs));
    if (!at || (!s.showRibbon && !s.showSectionTabs)) return;

    const bar = createDiv('onenote-topbar');
    at.parent.insertBefore(bar, at.before);
    this.topBar = bar;
    // Keep the editor's focus and selection when clicking toolbar buttons.
    bar.addEventListener('mousedown', (e) => {
      if (!e.target.closest('input, select, textarea')) e.preventDefault();
    });
    this.tabRowEl = this.qatEl = this.tabRowEndEl = this.ribbonEl = null;
    if (s.showRibbon) {
      this.tabRowEl = bar.createDiv('onenote-tabrow');
      this.qatEl = this.tabRowEl.createDiv('onenote-qat');
      const tabsEl = this.tabRowEl.createDiv({ cls: 'onenote-tabs', attr: { role: 'tablist' } });
      this.tabRowEl.createDiv('onenote-tabrow-spacer');
      this.tabRowEndEl = this.tabRowEl.createDiv('onenote-tabrow-end');
      this.ribbonEl = bar.createDiv('onenote-ribbon');
      this.tabRowEl.addEventListener('dblclick', (e) => {
        if (e.target.closest('.onenote-tab[data-tab]')) this.toggleRibbon();
      });
      this.renderTabRow();
      this.ribbon.mount(bar, tabsEl, this.ribbonEl);
    }
    this.sectionTabsEl = s.showSectionTabs ? bar.createDiv('onenote-section-tabs') : null;
    this.renderSectionTabs();
  }

  toggleRibbon() {
    this.state.ribbonCollapsed = !this.state.ribbonCollapsed;
    this.save();
    if (this.ribbon) this.ribbon.renderBody();
  }

  // The fixed parts of the tab row: Undo / Redo on the left, search on the right.
  // The tabs between them are drawn by the ribbon.
  renderTabRow() {
    if (!this.qatEl) return;
    const tool = (parent, iconName, tip, onClick, label) => {
      const b = parent.createEl('button', { cls: 'onenote-btn' + (label ? ' has-label' : ''), attr: { type: 'button', 'aria-label': tip, 'data-tooltip-position': 'bottom' } });
      icon(b.createSpan('onenote-btn-icon'), iconName, tip[0]);
      if (label) b.createSpan({ cls: 'onenote-btn-label', text: label });
      b.onclick = onClick;
      return b;
    };
    this.qatEl.empty();
    tool(this.qatEl, 'undo', 'Undo (Ctrl+Z)', () => this.edit((e) => e.undo()));
    tool(this.qatEl, 'redo', 'Redo (Ctrl+Y)', () => this.edit((e) => e.redo()));

    const end = this.tabRowEndEl;
    end.empty();
    if (document.body.hasClass('onenote-fullpage')) {
      tool(end, 'minimize-2', 'Exit full page view', () => this.toggleFullPage(), 'Exit Full Page');
    }
    const search = end.createDiv('onenote-search');
    icon(search.createSpan('onenote-search-icon'), 'search', '⌕');
    const input = search.createEl('input', { type: 'search', attr: { placeholder: 'Search (Ctrl+Shift+F)' } });
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const q = input.value.trim();
      const gs = this.app.internalPlugins && this.app.internalPlugins.getPluginById('global-search');
      if (gs && gs.instance && gs.instance.openGlobalSearch) gs.instance.openGlobalSearch(q);
      else this.exec('global-search:open');
    });
  }

  /* ---------- ribbon: what the ribbon view needs from the plugin ---------- */

  saveRibbon() { this.save(); }

  promptText(title, value, cta) { return promptText(this.app, title, value, cta); }

  confirm(title, message, cta) { return confirmAction(this.app, title, message, cta); }

  // Runs the command behind a ribbon button.
  runRibbonCommand(id) {
    const ws = this.app.workspace;
    let ok = executeCommand(this.app, id);
    if (!ok) {
      // Editing commands need a page. If a side pane has the focus, go back to the page
      // that was used last and try once more.
      const v = this.lastMarkdownView;
      if (v && v.leaf && v.leaf.view === v && v.containerEl.isConnected && ws.activeLeaf !== v.leaf) {
        ws.setActiveLeaf(v.leaf, { focus: true });
        ok = executeCommand(this.app, id);
      }
    }
    if (!ok) new Notice('This command can\'t be used here right now.');
    return ok;
  }

  // Where a picker should open: under the ribbon button that was just clicked, else at
  // the top of the page (when the command came from the command palette or a hotkey).
  pickerAnchor() {
    const r = this.ribbon && this.ribbon.lastAnchor();
    if (r) return r;
    const v = this.app.workspace.getActiveViewOfType(MarkdownView);
    const box = (v ? v.contentEl : document.body).getBoundingClientRect();
    return { left: box.left + 24, bottom: box.top + 24 };
  }

  choiceMenu(choices, key) {
    const m = new Menu();
    for (const c of choices) {
      m.addItem((i) => i.setTitle(c.name).setChecked(this.settings[key] === c.id).onClick(() => this.setAppearance(key, c.id)));
    }
    const r = this.pickerAnchor();
    m.showAtPosition({ x: r.left, y: r.bottom + 2 });
  }

  // Replaces the whole layout (import, reset, undo). The layout it replaces is kept so
  // the last replacement can be undone.
  replaceRibbonLayout(layout, keepPrevious) {
    this.ribbonPrevious = keepPrevious === false ? null : this.ribbonLayout;
    this.ribbonLayout = layout;
    const tab = activeTab(layout, this.state.ribbonTab);
    this.state.ribbonTab = tab ? tab.id : '';
    this.ribbon.changed();
  }

  async exportRibbon() {
    const name = `Ribbon layout ${moment().format('YYYY-MM-DD HHmmss')}.json`;
    try {
      await this.app.vault.create(normalizePath(name), exportLayout(this.ribbonLayout));
      new Notice(`Ribbon layout saved in your vault as "${name}".`, 8000);
      return name;
    } catch (e) {
      new Notice(`Could not save the ribbon layout: ${e && e.message ? e.message : e}`);
      return null;
    }
  }

  importRibbon() {
    const input = createEl('input', { type: 'file', attr: { accept: '.json,application/json' } });
    input.onchange = async () => {
      const f = input.files && input.files[0];
      if (f) this.importRibbonText(await f.text());
    };
    input.click();
  }

  importRibbonText(text) {
    let layout;
    try {
      layout = importLayout(text);
    } catch (e) {
      new Notice(`The ribbon layout was not imported. ${e.message}`, 8000);
      return false;
    }
    this.replaceRibbonLayout(layout);
    new Notice('Ribbon layout imported. To go back, run the command "Ribbon: undo last import or reset".', 8000);
    return true;
  }

  async resetRibbon() {
    const ok = await this.confirm('Reset the ribbon', 'Replace all tabs, groups and buttons with the default layout? You can undo this once with the command "Ribbon: undo last import or reset".', 'Reset');
    if (!ok) return false;
    this.replaceRibbonLayout(defaultLayout());
    return true;
  }

  undoRibbonReplace() {
    if (!this.ribbonPrevious) {
      new Notice('There is no earlier ribbon layout to go back to.');
      return false;
    }
    const previous = this.ribbonPrevious;
    this.replaceRibbonLayout(previous, false);
    new Notice('The earlier ribbon layout is back.');
    return true;
  }

  openAiSettings() {
    if (!isPluginEnabled(this.app, AI_PLUGIN)) {
      new Notice('AI ChatBridge is not installed or not enabled.');
      openSettings(this.app, 'community-plugins');
      return;
    }
    openSettings(this.app, AI_PLUGIN);
  }

  renderSectionTabs() {
    const el = this.sectionTabsEl;
    if (!el) return;
    el.empty();
    const nb = this.currentNotebook;
    const sw = el.createDiv({ cls: 'onenote-nb-switch', attr: { 'aria-label': 'Switch notebook', 'data-tooltip-position': 'bottom' } });
    const bi = sw.createSpan('onenote-nb-icon');
    if (nb) bi.style.color = this.colorOf(nb);
    icon(bi, 'book', '📓');
    sw.createSpan({ cls: 'onenote-nb-switch-name', text: nb ? this.notebookName(nb) : 'No notebook' });
    icon(sw.createSpan('onenote-nb-switch-caret'), 'chevron-down', '▾');
    sw.onclick = (e) => {
      const m = new Menu();
      for (const n of this.getNotebooks()) {
        m.addItem((i) => i.setTitle(this.notebookName(n)).setIcon('book').setChecked(n === nb).onClick(() => this.openNotebook(n)));
      }
      if (this.settings.notebookMode === 'folders') {
        m.addSeparator();
        m.addItem((i) => i.setTitle('Add notebook').setIcon('plus').onClick(() => this.createNotebook()));
      }
      m.showAtMouseEvent(e);
    };
    if (!nb) return;

    const cur = this.currentSection;
    const tabs = [];
    if (this.getPages(nb).length) tabs.push({ folder: nb, name: 'Unfiled', color: '#C8C8C8' });
    for (const s of this.getSections(nb)) tabs.push({ folder: s, name: s.name, color: this.colorOf(s) });
    for (const t of tabs) {
      const active = cur && (t.folder === nb ? cur === nb : isInside(t.folder, cur));
      const tab = el.createDiv({ cls: 'onenote-section-tab' + (active ? ' is-active' : ''), text: t.name });
      tab.style.setProperty('--tab-color', t.color);
      tab.onclick = () => this.openSection(active && cur !== t.folder ? cur : t.folder);
      if (t.folder !== nb) tab.oncontextmenu = (e) => this.sectionMenu(e, t.folder);
      this.makeDropTarget(tab, t.folder);
      // Nested folders behave like OneNote section groups: show the open subsection's name.
      if (active && cur !== t.folder) tab.setText(t.name + ' › ' + cur.name);
    }
    const add = el.createDiv({ cls: 'onenote-section-tab is-add', attr: { 'aria-label': 'Create a new section', 'data-tooltip-position': 'bottom' } });
    icon(add, 'plus', '+');
    add.onclick = () => this.createSection(nb);
  }

  /* ---------- popovers ---------- */

  showPopover(anchor, build, pos) {
    this.closePopover();
    const pop = document.body.createDiv('onenote-popover');
    const close = () => {
      pop.remove();
      document.removeEventListener('mousedown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
      if (this.popover === close) this.popover = null;
    };
    const onDown = (e) => { if (!pop.contains(e.target)) close(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    pop.addEventListener('mousedown', (e) => e.preventDefault());
    build(pop, close);
    const r = !anchor ? { left: pos.x, bottom: pos.y } : anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : anchor;
    pop.style.left = Math.max(4, Math.min(r.left, window.innerWidth - pop.offsetWidth - 8)) + 'px';
    pop.style.top = Math.min(r.bottom + 2, window.innerHeight - pop.offsetHeight - 8) + 'px';
    setTimeout(() => {
      document.addEventListener('mousedown', onDown, true);
      document.addEventListener('keydown', onKey, true);
    }, 0);
    this.popover = close;
  }

  closePopover() { if (this.popover) this.popover(); }

  swatches(pop, colors, onPick, close) {
    const grid = pop.createDiv('onenote-swatch-grid');
    for (const c of colors) {
      const sw = grid.createDiv({ cls: 'onenote-swatch', attr: { 'aria-label': c.name || c.value || c } });
      sw.style.backgroundColor = c.value !== undefined ? (c.value || 'var(--text-highlight-bg)') : c;
      sw.onclick = () => { close(); onPick(c.value !== undefined ? c.value : c); };
    }
  }

  highlightPicker(anchor) {
    this.showPopover(anchor, (pop, close) => {
      pop.createDiv({ cls: 'onenote-popover-title', text: 'Highlight Colors' });
      this.swatches(pop, HIGHLIGHT_COLORS, (v) => this.edit((e) => (v ? wrap(e, `<mark style="background:${v}">`, '</mark>') : wrap(e, '==', '=='))), close);
      const none = pop.createDiv({ cls: 'onenote-popover-item', text: 'No Color' });
      none.onclick = () => { close(); this.edit((e) => e.replaceSelection(e.getSelection().replace(/==|<mark[^>]*>|<\/mark>/g, ''))); };
    });
  }

  fontColorPicker(anchor) {
    this.showPopover(anchor, (pop, close) => {
      pop.createDiv({ cls: 'onenote-popover-title', text: 'Font Color' });
      this.swatches(pop, FONT_COLORS, (v) => this.edit((e) => wrap(e, `<span style="color:${v}">`, '</span>')), close);
      const auto = pop.createDiv({ cls: 'onenote-popover-item', text: 'Automatic' });
      auto.onclick = () => { close(); this.edit((e) => e.replaceSelection(e.getSelection().replace(/<span style="color:[^"]*">|<\/span>/g, ''))); };
    });
  }

  pageColorPicker(anchor) {
    this.showPopover(anchor, (pop, close) => {
      pop.createDiv({ cls: 'onenote-popover-title', text: 'Page Color' });
      this.swatches(pop, PAGE_COLORS.filter((c) => c.value), (v) => this.setAppearance('pageColor', v), close);
      const none = pop.createDiv({ cls: 'onenote-popover-item', text: 'No Color' });
      none.onclick = () => { close(); this.setAppearance('pageColor', ''); };
    });
  }

  symbolPicker(anchor) {
    this.showPopover(anchor, (pop, close) => {
      pop.createDiv({ cls: 'onenote-popover-title', text: 'Symbol' });
      const grid = pop.createDiv('onenote-symbol-grid');
      for (const sym of SYMBOLS) {
        const c = grid.createDiv({ cls: 'onenote-symbol', text: sym });
        c.onclick = () => { close(); this.edit((e) => e.replaceSelection(sym)); };
      }
    });
  }

  tablePicker(anchor) {
    this.showPopover(anchor, (pop, close) => {
      const title = pop.createDiv({ cls: 'onenote-popover-title', text: 'Insert Table' });
      const grid = pop.createDiv('onenote-table-grid');
      const cells = [];
      const ROWS = 8;
      const COLS = 10;
      for (let r = 1; r <= ROWS; r++) {
        for (let c = 1; c <= COLS; c++) {
          const cell = grid.createDiv('onenote-table-cell');
          cells.push({ cell, r, c });
          cell.onmouseenter = () => {
            title.setText(`${c}x${r} Table`);
            for (const x of cells) x.cell.toggleClass('is-on', x.r <= r && x.c <= c);
          };
          cell.onclick = () => { close(); this.edit((e) => insertBlock(e, tableMarkdown(r, c), 2)); };
        }
      }
    });
  }
}

export default OneNotePlugin;
