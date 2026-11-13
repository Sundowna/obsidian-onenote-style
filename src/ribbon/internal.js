/*
 * The only file that touches Obsidian internals that are not in the official API
 * (obsidian.d.ts). Everything else in the ribbon goes through these functions, so when
 * an Obsidian update changes one of these internals the fix stays in this file.
 * Each function fails soft: it returns null / false / [] instead of throwing.
 *
 * Why each internal is needed:
 *
 *   app.commands.commands / listCommands()
 *       The official API can register commands but not list or look them up. A ribbon
 *       button that can run "any command" needs the list (for the picker) and a lookup
 *       (to grey out buttons whose plugin is missing).
 *   app.commands.executeCommandById(id)
 *       There is no official way to run a command by id.
 *   app.hotkeyManager.printHotkeyForCommand(id)
 *       Only for showing the shortcut in a button's tooltip. Optional.
 *   app.plugins.manifests / enabledPlugins, app.internalPlugins.plugins
 *       Only for the tooltip of a greyed-out button ("plugin X is turned off").
 *   .app-container > .horizontal-main-container
 *       Obsidian has no official slot for a full-width bar above the workspace, so the
 *       ribbon is inserted before this element. (Obsidian's own ribbon is not touched.)
 *   app.setting.open() / openTabById(id)
 *       Opens Settings on a given page for the "Plugins" style buttons.
 *   menuItem.dom
 *       Only to show a colour dot next to each choice in the "Icon colour" menu. Optional.
 *   file explorer view: getSortedFolderItems(folder), requestSort()
 *       (Used for subpages, not for the ribbon.) Obsidian has no official way to change
 *       the order of the rows in its file explorer. The explorer asks this method for
 *       the sorted rows of a folder; it is wrapped so subpages follow their parent page.
 *       Sorting plugins use the same method. If it disappears, the explorer simply
 *       keeps its normal order.
 *   app.changeTheme(name)
 *       Light / dark buttons. Falls back to the official "theme:toggle-light-dark" command.
 */

/** Command id prefixes of core plugins whose id differs from the prefix. */
const CORE_PREFIX = {
  'insert-template': 'templates',
  'insert-current-date': 'templates',
  'insert-current-time': 'templates',
  'outgoing-links': 'outgoing-link',
  'open-with-default-app': 'open-with-default-app',
};

/** Prefixes that belong to Obsidian itself, not to a plugin that can be turned off. */
const BUILT_IN = new Set(['editor', 'workspace', 'app', 'theme', 'markdown', 'window', 'mobile', 'file-explorer']);

export function listCommands(app) {
  try {
    const c = app.commands;
    if (!c) return [];
    if (typeof c.listCommands === 'function') return c.listCommands();
    return Object.values(c.commands || {});
  } catch (e) {
    return [];
  }
}

export function findCommand(app, id) {
  try {
    const c = app.commands;
    if (!c) return null;
    if (typeof c.findCommand === 'function') return c.findCommand(id) || null;
    return (c.commands && c.commands[id]) || (c.editorCommands && c.editorCommands[id]) || null;
  } catch (e) {
    return null;
  }
}

/** Runs a command. Returns false if it doesn't exist or can't run right now. */
export function executeCommand(app, id) {
  try {
    if (!findCommand(app, id)) return false;
    return app.commands.executeCommandById(id) !== false;
  } catch (e) {
    console.error('OneNote Style: command failed', id, e);
    return false;
  }
}

/** The command's shortcut as text ("Ctrl + B"), or '' if it has none. */
export function hotkeyText(app, id) {
  try {
    const hm = app.hotkeyManager;
    if (!hm || typeof hm.printHotkeyForCommand !== 'function') return '';
    return hm.printHotkeyForCommand(id) || '';
  } catch (e) {
    return '';
  }
}

/**
 * Why a command is missing, as a sentence for the tooltip of its greyed-out button.
 */
export function missingReason(app, commandId) {
  const prefix = commandId.includes(':') ? commandId.slice(0, commandId.indexOf(':')) : commandId;
  try {
    if (BUILT_IN.has(prefix)) return 'This command is not available in this version of Obsidian.';
    const community = app.plugins;
    const manifest = community && community.manifests && community.manifests[prefix];
    if (manifest) {
      const on = !!(community.plugins && community.plugins[prefix]);
      return on
        ? `The plugin "${manifest.name}" doesn't offer this command (any more).`
        : `The plugin "${manifest.name}" is turned off. Turn it on in Settings > Community plugins.`;
    }
    const core = app.internalPlugins && app.internalPlugins.plugins;
    const corePlugin = core && (core[CORE_PREFIX[prefix] || prefix]);
    if (corePlugin) {
      const name = (corePlugin.instance && corePlugin.instance.name) || prefix;
      return corePlugin.enabled
        ? `The core plugin "${name}" doesn't offer this command (any more).`
        : `The core plugin "${name}" is turned off. Turn it on in Settings > Core plugins.`;
    }
  } catch (e) { /* fall through to the general message */ }
  return `Needs the plugin "${prefix}", which is not installed or is turned off.`;
}

/** Colours the icon of a menu item (the dots in the "Icon colour" menu). Cosmetic only. */
export function tintMenuItem(menuItem, color) {
  try {
    const icon = menuItem.dom && menuItem.dom.querySelector('.menu-item-icon');
    if (icon && color && color !== 'none') icon.dataset.onrColor = color;
  } catch (e) { /* the menu simply shows no colour dot */ }
}

/**
 * Lets `regroup(rows)` reorder the rows the file explorer shows in a folder. Each row has
 * a `.file` (a TFile or TFolder). Returns a function that undoes the change, or null if
 * the explorer isn't loaded yet or works differently in this Obsidian version.
 */
export function patchExplorerSort(app, regroup) {
  try {
    const leaf = app.workspace.getLeavesOfType('file-explorer').find((l) => l.view && typeof l.view.getSortedFolderItems === 'function');
    if (!leaf) return null;
    const proto = Object.getPrototypeOf(leaf.view);
    if (!Object.prototype.hasOwnProperty.call(proto, 'getSortedFolderItems')) return null;
    const original = proto.getSortedFolderItems;
    const patched = function (folder) {
      const rows = original.call(this, folder);
      try {
        const out = regroup(rows);
        return Array.isArray(out) && out.length === rows.length ? out : rows;
      } catch (e) {
        return rows;
      }
    };
    proto.getSortedFolderItems = patched;
    return () => {
      // Only put the original back if nobody wrapped the method after us.
      if (proto.getSortedFolderItems === patched) proto.getSortedFolderItems = original;
    };
  } catch (e) {
    return null;
  }
}

/** Asks every file explorer to sort its rows again. */
export function resortExplorers(app) {
  try {
    for (const leaf of app.workspace.getLeavesOfType('file-explorer')) {
      const v = leaf.view;
      if (v && typeof v.requestSort === 'function') v.requestSort();
      else if (v && typeof v.sort === 'function') v.sort();
    }
  } catch (e) { /* the explorer keeps its order */ }
}

/** Where the ribbon is inserted: { parent, before } or null if Obsidian's layout changed. */
export function mountPoint(doc) {
  const parent = doc.body.querySelector('.app-container');
  const before = parent && parent.querySelector(':scope > .horizontal-main-container');
  return parent && before ? { parent, before } : null;
}

export function openSettings(app, tabId) {
  try {
    const setting = app.setting;
    if (!setting) return executeCommand(app, 'app:open-settings');
    setting.open();
    if (tabId && setting.openTabById) setting.openTabById(tabId);
    return true;
  } catch (e) {
    return false;
  }
}

export function isPluginEnabled(app, id) {
  try {
    return !!(app.plugins && app.plugins.enabledPlugins && app.plugins.enabledPlugins.has(id) && app.plugins.plugins[id]);
  } catch (e) {
    return false;
  }
}

/** Switches Obsidian between its light and dark base theme. */
export function setDarkMode(app, dark, doc) {
  try {
    // 'obsidian' is Obsidian's dark base theme, 'moonstone' its light one.
    if (typeof app.changeTheme === 'function') {
      app.changeTheme(dark ? 'obsidian' : 'moonstone');
      return true;
    }
  } catch (e) { /* fall back to the command */ }
  if (doc.body.classList.contains('theme-dark') !== dark) return executeCommand(app, 'theme:toggle-light-dark');
  return true;
}
