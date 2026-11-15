// Button state: which buttons show as pressed (their mode is on) and which as busy (a sync runs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { pressedState, syncingCommands, isSyncCommand, TOGGLE_COMMANDS, SYNC_ALL } from '../../src/ribbon/state.js';
import { readSyncState, readToggleContext } from '../../src/ribbon/internal.js';
import { defaultLayout } from '../../src/ribbon/defaults.js';

const O = 'onenote-style:';
const AI = 'ai-chatbridge:';
const ctx = (over) => Object.assign({
  settings: { hideSyntax: false, syntaxGuard: false, quickBar: false, showSectionTabs: false },
  dark: false, fullPage: false, mode: 'live', backlinks: false, pinned: false, stacked: false,
  readableLineLength: false, lineNumbers: false, spellcheck: false, leftSidebar: false, rightSidebar: false, iconStrip: false,
}, over);

test('pressed: every toggle is off in an all-off snapshot, except Light', () => {
  for (const c of TOGGLE_COMMANDS) assert.equal(pressedState(c, ctx()), c === O + 'use-light-mode', c);
});

test('pressed: each mode presses its own button and no other', () => {
  const cases = [
    [{ settings: { hideSyntax: true } }, O + 'toggle-syntax-visibility'],
    [{ settings: { syntaxGuard: true } }, O + 'toggle-syntax-guard'],
    [{ settings: { quickBar: true } }, O + 'toggle-quick-bar'],
    [{ settings: { showSectionTabs: true } }, O + 'toggle-section-tabs'],
    [{ fullPage: true }, O + 'full-page-view'],
    [{ mode: 'preview' }, 'markdown:toggle-preview'],
    [{ mode: 'source' }, 'editor:toggle-source'],
    [{ pinned: true }, 'workspace:toggle-pin'],
    [{ stacked: true }, 'workspace:toggle-stacked-tabs'],
    [{ backlinks: true }, 'backlink:toggle-backlinks-in-document'],
    [{ readableLineLength: true }, 'editor:toggle-readable-line-length'],
    [{ lineNumbers: true }, 'editor:toggle-line-numbers'],
    [{ spellcheck: true }, 'editor:toggle-spellcheck'],
    [{ leftSidebar: true }, 'app:toggle-left-sidebar'],
    [{ rightSidebar: true }, 'app:toggle-right-sidebar'],
    [{ iconStrip: true }, 'app:toggle-ribbon'],
  ];
  const base = TOGGLE_COMMANDS.filter((c) => pressedState(c, ctx()));
  for (const [over, command] of cases) {
    const on = TOGGLE_COMMANDS.filter((c) => pressedState(c, ctx(over)));
    assert.deepEqual(on.sort(), [...base, command].sort(), command);
  }
  // every toggle is covered by a case above (Light and Dark are checked below)
  const covered = new Set([...cases.map((c) => c[1]), O + 'use-light-mode', O + 'use-dark-mode']);
  assert.deepEqual(TOGGLE_COMMANDS.filter((c) => !covered.has(c)), []);
});

test('pressed: Light and Dark are a pair, exactly one is on', () => {
  assert.equal(pressedState(O + 'use-light-mode', ctx({ dark: false })), true);
  assert.equal(pressedState(O + 'use-dark-mode', ctx({ dark: false })), false);
  assert.equal(pressedState(O + 'use-light-mode', ctx({ dark: true })), false);
  assert.equal(pressedState(O + 'use-dark-mode', ctx({ dark: true })), true);
});

test('pressed: Read / Edit and Source Mode follow the three views of a page', () => {
  const at = (mode) => [pressedState('markdown:toggle-preview', ctx({ mode })), pressedState('editor:toggle-source', ctx({ mode }))];
  assert.deepEqual(at('live'), [false, false]);
  assert.deepEqual(at('preview'), [true, false]);
  assert.deepEqual(at('source'), [false, true]);
  assert.deepEqual(at(null), [null, null], 'no page open: no state');
});

test('pressed: buttons that are not toggles, and states that can\'t be read, show nothing', () => {
  for (const c of ['editor:toggle-bold', 'theme:toggle-light-dark', O + 'paste', SYNC_ALL, '']) assert.equal(pressedState(c, ctx()), null, c);
  assert.equal(pressedState('editor:toggle-line-numbers', ctx({ lineNumbers: null })), null);
  assert.equal(pressedState('workspace:toggle-pin', ctx({ pinned: undefined })), null);
  assert.equal(pressedState(O + 'toggle-quick-bar', null), null);
  assert.equal(pressedState(O + 'toggle-quick-bar', {}), null, 'a broken snapshot does not throw');
});

test('pressed: every toggle command is a button of the default ribbon', () => {
  const all = new Set(defaultLayout().tabs.flatMap((t) => t.groups.flatMap((g) => g.items.map((i) => i.command))));
  for (const c of TOGGLE_COMMANDS) assert.ok(all.has(c), c);
});

test('busy: nothing moves while no sync runs', () => {
  assert.equal(syncingCommands(null, '').size, 0, 'ChatBridge is off');
  assert.equal(syncingCommands({ busy: false, current: null }, '').size, 0);
  assert.equal(syncingCommands({ busy: false, current: { provider: 'chatgpt' } }, AI + 'sync-chatgpt-chats').size, 0);
});

test('busy: the button that started the sync moves', () => {
  for (const c of ['sync-claude-chats', 'sync-chatgpt-chats', 'sync-gemini-chats', 'sync-lumo-chats', 'sync-desktop-app-chats', 'sync-hermes-chats']) {
    assert.deepEqual([...syncingCommands({ busy: true, current: null }, AI + c)], [AI + c]);
  }
  // only that one, whatever ChatBridge is working on
  assert.deepEqual([...syncingCommands({ busy: true, current: { provider: 'claude' } }, AI + 'sync-desktop-app-chats')], [AI + 'sync-desktop-app-chats']);
});

test('busy: a sync that was not started from the ribbon shows on Sync All', () => {
  assert.deepEqual([...syncingCommands({ busy: true, current: null }, '')], [SYNC_ALL]);
  assert.deepEqual([...syncingCommands({ busy: true, current: null }, 'ai-chatbridge:stop-sync')], [SYNC_ALL]);
  assert.deepEqual([...syncingCommands({ busy: true, current: null }, 'editor:toggle-bold')], [SYNC_ALL]);
});

test('busy: during Sync All the provider being synced moves too', () => {
  const during = (current) => [...syncingCommands({ busy: true, current }, SYNC_ALL)].sort();
  assert.deepEqual(during({ provider: 'chatgpt' }), [SYNC_ALL, AI + 'sync-chatgpt-chats'].sort());
  assert.deepEqual(during({ provider: 'claude' }), [SYNC_ALL, AI + 'sync-claude-chats'].sort());
  assert.deepEqual(during({ provider: 'gemini' }), [SYNC_ALL, AI + 'sync-gemini-chats'].sort());
  assert.deepEqual(during({ provider: 'lumo' }), [SYNC_ALL, AI + 'sync-lumo-chats'].sort());
  assert.deepEqual(during({ hermes: true }), [SYNC_ALL, AI + 'sync-hermes-chats'].sort());
  assert.deepEqual(during({ provider: 'someone-new' }), [SYNC_ALL]);
  assert.deepEqual(during({ provider: '' }), [SYNC_ALL]);
});

test('busy: Stop All and other ChatBridge commands are not sync buttons', () => {
  assert.equal(isSyncCommand(SYNC_ALL), true);
  assert.equal(isSyncCommand(AI + 'sync-chatgpt-chats'), true);
  assert.equal(isSyncCommand(AI + 'stop-sync'), false);
  assert.equal(isSyncCommand(AI + 'refresh-index'), false);
  assert.equal(isSyncCommand(undefined), false);
});

test('ChatBridge: its sync state is read defensively', () => {
  const app = (plugin, on = true) => ({ plugins: { enabledPlugins: new Set(on ? ['ai-chatbridge'] : []), plugins: plugin ? { 'ai-chatbridge': plugin } : {} } });
  const read = (plugin, on) => readSyncState(app(plugin, on), 'ai-chatbridge');
  assert.equal(read(null), null, 'not installed');
  assert.equal(read({ syncing: true }, false), null, 'turned off');
  assert.deepEqual(read({ syncing: false, busy: true }), { busy: false, current: null }, '"syncing" wins: loading the project list is not a sync');
  assert.deepEqual(read({ busy: true }), { busy: true, current: null }, 'older versions only have "busy"');
  assert.deepEqual(read({ syncing: true, current: { provider: 'chatgpt', id: 'a' } }), { busy: true, current: { provider: 'chatgpt', hermes: false } });
  assert.deepEqual(read({ syncing: true, current: { hermes: true, id: 'p' } }), { busy: true, current: { provider: '', hermes: true } });
  assert.deepEqual(read({ syncing: false, current: { provider: 'chatgpt' } }), { busy: false, current: null }, 'a leftover "current" is ignored');
  assert.deepEqual(read({ syncing: true, current: 'nonsense' }), { busy: true, current: null });
  assert.equal(readSyncState({}, 'ai-chatbridge'), null, 'an app without plugins does not throw');
  const throwing = { get syncing() { throw new Error('boom'); } };
  assert.equal(read(throwing), null);
});

test('Obsidian: the toggle snapshot survives missing internals', () => {
  class MarkdownView {}
  const body = (classes) => ({ body: { classList: { contains: (c) => classes.includes(c) }, querySelector: () => null } });
  // nothing but a body: every value is false or null, nothing throws
  const bare = readToggleContext({ workspace: {}, vault: {} }, body(['theme-dark']), MarkdownView);
  assert.equal(bare.dark, true);
  assert.equal(bare.fullPage, false);
  assert.equal(bare.mode, null);
  for (const k of ['pinned', 'stacked', 'readableLineLength', 'lineNumbers', 'spellcheck', 'leftSidebar', 'rightSidebar', 'backlinks']) assert.equal(bare[k], null, k);
  assert.equal(bare.iconStrip, false);

  const view = (state, pinned) => {
    const v = new MarkdownView();
    v.leaf = { getViewState: () => ({ state, pinned }), parent: { isStacked: true } };
    return v;
  };
  const app = (v, config) => ({
    workspace: { getActiveViewOfType: () => v, getMostRecentLeaf: () => null, leftSplit: { collapsed: true }, rightSplit: { collapsed: false } },
    vault: { getConfig: (k) => config[k] },
  });
  const doc = { body: { classList: { contains: () => false }, querySelector: () => ({ getClientRects: () => [{}] }) } };
  const live = readToggleContext(app(view({ mode: 'source', source: false }, true), { showLineNumber: true }), doc, MarkdownView);
  assert.deepEqual(live, {
    dark: false, fullPage: false, mode: 'live', backlinks: false, pinned: true, stacked: true,
    readableLineLength: true, lineNumbers: true, spellcheck: true, leftSidebar: false, rightSidebar: true, iconStrip: true,
  }, 'unset Obsidian settings count as their defaults');
  assert.equal(readToggleContext(app(view({ mode: 'source', source: true }), {}), doc, MarkdownView).mode, 'source');
  const reading = readToggleContext(app(view({ mode: 'preview', source: true, backlinks: true }), { readableLineLength: false, spellcheck: false }), doc, MarkdownView);
  assert.equal(reading.mode, 'preview');
  assert.equal(reading.backlinks, true);
  assert.equal(reading.readableLineLength, false);
  assert.equal(reading.spellcheck, false);
});
