/*
 * What a ribbon button shows besides its icon and label:
 *
 *   pressed  the button's mode is on right now (reading view, dark mode, hidden syntax),
 *            like the pilcrow button in Word
 *   busy     the button's work is running right now (an AI ChatBridge sync)
 *
 * Both are looked up by command id, so they follow a button wherever the user moves it
 * and also work for buttons the user added. Pure functions over a plain snapshot `ctx`;
 * the snapshot itself is taken in internal.js (readToggleContext, readSyncState).
 */

const O = 'onenote-style:';
const AI = 'ai-chatbridge:';

export const SYNC_ALL = AI + 'sync-all-chats';

/** command id -> is its mode on? `c` is the snapshot from readToggleContext plus `settings`. */
const TOGGLES = {
  // this plugin
  [O + 'toggle-syntax-visibility']: (c) => !!c.settings.hideSyntax,
  [O + 'toggle-syntax-guard']: (c) => !!c.settings.syntaxGuard,
  [O + 'toggle-quick-bar']: (c) => !!c.settings.quickBar,
  [O + 'toggle-section-tabs']: (c) => !!c.settings.showSectionTabs,
  [O + 'toggle-auto-collapse-ribbon']: (c) => !!c.settings.autoCollapseRibbon,
  [O + 'full-page-view']: (c) => !!c.fullPage,
  [O + 'use-light-mode']: (c) => !c.dark,
  [O + 'use-dark-mode']: (c) => !!c.dark,
  // Obsidian: the open page
  'markdown:toggle-preview': (c) => (c.mode ? c.mode === 'preview' : null),
  'editor:toggle-source': (c) => (c.mode ? c.mode === 'source' : null),
  'workspace:toggle-pin': (c) => c.pinned,
  'workspace:toggle-stacked-tabs': (c) => c.stacked,
  'backlink:toggle-backlinks-in-document': (c) => (c.mode ? !!c.backlinks : null),
  // Obsidian: settings and window
  'editor:toggle-readable-line-length': (c) => c.readableLineLength,
  'editor:toggle-line-numbers': (c) => c.lineNumbers,
  'editor:toggle-spellcheck': (c) => c.spellcheck,
  'app:toggle-left-sidebar': (c) => c.leftSidebar,
  'app:toggle-right-sidebar': (c) => c.rightSidebar,
  'app:toggle-ribbon': (c) => c.iconStrip,
};

export const TOGGLE_COMMANDS = Object.keys(TOGGLES);

/**
 * true / false for a button that shows a mode, null for every other button and for a
 * mode that can't be read right now (no page open, an Obsidian internal that moved).
 */
export function pressedState(command, ctx) {
  const read = TOGGLES[command];
  if (!read || !ctx) return null;
  try {
    const on = read(ctx);
    return typeof on === 'boolean' ? on : null;
  } catch (e) {
    return null;
  }
}

/** The sync command of each ChatBridge provider. */
const PROVIDER_COMMAND = {
  claude: AI + 'sync-claude-chats',
  chatgpt: AI + 'sync-chatgpt-chats',
  gemini: AI + 'sync-gemini-chats',
  lumo: AI + 'sync-lumo-chats',
};
const HERMES = AI + 'sync-hermes-chats';
const SYNC_COMMANDS = new Set([SYNC_ALL, HERMES, AI + 'sync-desktop-app-chats', ...Object.values(PROVIDER_COMMAND)]);

export function isSyncCommand(command) {
  return SYNC_COMMANDS.has(command);
}

/**
 * The commands whose buttons show a running sync.
 *
 *   sync     { busy, current } from readSyncState, or null when ChatBridge is off
 *   started  the sync command last run from the ribbon, or '' (timed sync, command palette)
 *
 * The button that started the sync moves. A sync nobody started from the ribbon shows on
 * Sync All. During Sync All the provider that is being synced right now moves as well.
 */
export function syncingCommands(sync, started) {
  const out = new Set();
  if (!sync || !sync.busy) return out;
  const origin = isSyncCommand(started) ? started : SYNC_ALL;
  out.add(origin);
  const cur = sync.current;
  if (origin === SYNC_ALL && cur) {
    if (cur.hermes) out.add(HERMES);
    else if (PROVIDER_COMMAND[cur.provider]) out.add(PROVIDER_COMMAND[cur.provider]);
  }
  return out;
}
