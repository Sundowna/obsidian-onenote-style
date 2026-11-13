/*
 * Ribbon layout model: tabs -> groups -> buttons.
 *
 * Pure data and functions, no Obsidian or DOM access, so it runs in plain Node for the
 * unit tests. Every function that changes a layout changes it in place and returns
 * true when something changed.
 *
 *   layout = { version, tabs: [tab] }
 *   tab    = { id, name, hidden, groups: [group] }
 *   group  = { id, name, priority: 'first' | 'normal' | 'last', items: [item] }
 *   item   = { id, command, size: 'large' | 'small', label?, icon?, color? }
 *
 * `command` is an Obsidian command id such as "editor:toggle-bold". `label` and `icon`
 * are optional overrides; without them the command's own name and icon are used.
 * `color` is the icon's colour: one of COLORS, which map to the theme's own colours.
 * Without it a large icon uses the accent colour and a small icon the normal icon colour.
 */

export const LAYOUT_VERSION = 1;
export const EXPORT_FORMAT = 'onenote-style-ribbon-layout';
export const PRIORITIES = ['first', 'normal', 'last'];
export const SIZES = ['large', 'small'];
/** Icon colours. 'accent' and the names follow the theme; 'none' is the plain icon colour. */
export const COLORS = ['accent', 'red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'pink', 'none'];
/** Small buttons are stacked this many high, like in Office. */
export const STACK = 3;

let counter = 0;
export function uid(prefix) {
  counter += 1;
  return `${prefix || 'x'}-${Date.now().toString(36)}${counter.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

const str = (v, fallback) => (typeof v === 'string' && v.trim() ? v.trim() : fallback);

/**
 * Returns a clean copy of `raw`: unknown fields dropped, missing ones filled in, ids made
 * unique. Throws an Error with a readable message if `raw` is not a layout at all.
 */
export function normalizeLayout(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.tabs)) {
    throw new Error('This is not a ribbon layout (no list of tabs found).');
  }
  const seen = new Set();
  const id = (wanted, prefix) => {
    let v = str(wanted, '') || uid(prefix);
    while (seen.has(v)) v = uid(prefix);
    seen.add(v);
    return v;
  };
  const tabs = [];
  for (const t of raw.tabs) {
    if (!t || typeof t !== 'object') continue;
    const tab = { id: id(t.id, 'tab'), name: str(t.name, 'Tab'), hidden: !!t.hidden, groups: [] };
    for (const g of Array.isArray(t.groups) ? t.groups : []) {
      if (!g || typeof g !== 'object') continue;
      const group = {
        id: id(g.id, 'grp'),
        name: str(g.name, 'Group'),
        priority: PRIORITIES.includes(g.priority) ? g.priority : 'normal',
        items: [],
      };
      for (const i of Array.isArray(g.items) ? g.items : []) {
        if (!i || typeof i !== 'object' || !str(i.command, '')) continue;
        const item = { id: id(i.id, 'btn'), command: i.command.trim(), size: SIZES.includes(i.size) ? i.size : 'small' };
        if (str(i.label, '')) item.label = i.label.trim();
        if (str(i.icon, '')) item.icon = i.icon.trim();
        if (COLORS.includes(i.color)) item.color = i.color;
        group.items.push(item);
      }
      tab.groups.push(group);
    }
    tabs.push(tab);
  }
  return { version: LAYOUT_VERSION, tabs };
}

export function cloneLayout(layout) {
  return JSON.parse(JSON.stringify(layout));
}

/* ---------- lookups ---------- */

export function findTab(layout, tabId) {
  return layout.tabs.find((t) => t.id === tabId) || null;
}

export function findGroup(layout, groupId) {
  for (const tab of layout.tabs) {
    const index = tab.groups.findIndex((g) => g.id === groupId);
    if (index >= 0) return { tab, group: tab.groups[index], index };
  }
  return null;
}

export function findItem(layout, itemId) {
  for (const tab of layout.tabs) {
    for (const group of tab.groups) {
      const index = group.items.findIndex((i) => i.id === itemId);
      if (index >= 0) return { tab, group, item: group.items[index], index };
    }
  }
  return null;
}

export function visibleTabs(layout) {
  return layout.tabs.filter((t) => !t.hidden);
}

/** The tab to show: the wanted one if it is visible, else the first visible tab. */
export function activeTab(layout, wantedId) {
  const visible = visibleTabs(layout);
  return visible.find((t) => t.id === wantedId) || visible[0] || null;
}

/** Every command id used in the layout (or in one tab). */
export function commandsIn(layout, tabId) {
  const out = [];
  for (const tab of layout.tabs) {
    if (tabId && tab.id !== tabId) continue;
    for (const g of tab.groups) for (const i of g.items) out.push(i.command);
  }
  return out;
}

function shift(list, index, dir) {
  const to = index + dir;
  if (index < 0 || to < 0 || to >= list.length) return false;
  const [x] = list.splice(index, 1);
  list.splice(to, 0, x);
  return true;
}

/* ---------- tabs ---------- */

export function addTab(layout, name, afterTabId) {
  const tab = { id: uid('tab'), name: str(name, 'New tab'), hidden: false, groups: [] };
  const at = layout.tabs.findIndex((t) => t.id === afterTabId);
  layout.tabs.splice(at >= 0 ? at + 1 : layout.tabs.length, 0, tab);
  return tab;
}

export function renameTab(layout, tabId, name) {
  const tab = findTab(layout, tabId);
  if (!tab || !str(name, '')) return false;
  tab.name = name.trim();
  return true;
}

/** Hides or shows a tab. The last visible tab can't be hidden. */
export function setTabHidden(layout, tabId, hidden) {
  const tab = findTab(layout, tabId);
  if (!tab || tab.hidden === !!hidden) return false;
  if (hidden && visibleTabs(layout).length <= 1) return false;
  tab.hidden = !!hidden;
  return true;
}

/** Moves a tab one step among the visible tabs (hidden tabs are skipped over). */
export function moveTab(layout, tabId, dir) {
  const from = layout.tabs.findIndex((t) => t.id === tabId);
  if (from < 0) return false;
  let to = from + dir;
  while (to >= 0 && to < layout.tabs.length && layout.tabs[to].hidden) to += dir;
  if (to < 0 || to >= layout.tabs.length) return false;
  const [tab] = layout.tabs.splice(from, 1);
  layout.tabs.splice(to, 0, tab);
  return true;
}

/** Drops a tab right before (or after) another tab. Used by drag and drop. */
export function moveTabNextTo(layout, tabId, targetId, after) {
  const from = layout.tabs.findIndex((t) => t.id === tabId);
  if (from < 0 || tabId === targetId || !findTab(layout, targetId)) return false;
  const [tab] = layout.tabs.splice(from, 1);
  const to = layout.tabs.findIndex((t) => t.id === targetId) + (after ? 1 : 0);
  layout.tabs.splice(to, 0, tab);
  return to !== from;
}

export function removeTab(layout, tabId) {
  const index = layout.tabs.findIndex((t) => t.id === tabId);
  if (index < 0) return false;
  const tab = layout.tabs[index];
  if (!tab.hidden && visibleTabs(layout).length <= 1) return false;
  layout.tabs.splice(index, 1);
  return true;
}

/* ---------- groups ---------- */

export function addGroup(layout, tabId, name, afterGroupId) {
  const tab = findTab(layout, tabId);
  if (!tab) return null;
  const group = { id: uid('grp'), name: str(name, 'New group'), priority: 'normal', items: [] };
  const at = tab.groups.findIndex((g) => g.id === afterGroupId);
  tab.groups.splice(at >= 0 ? at + 1 : tab.groups.length, 0, group);
  return group;
}

export function renameGroup(layout, groupId, name) {
  const found = findGroup(layout, groupId);
  if (!found || !str(name, '')) return false;
  found.group.name = name.trim();
  return true;
}

export function moveGroup(layout, groupId, dir) {
  const found = findGroup(layout, groupId);
  return !!found && shift(found.tab.groups, found.index, dir);
}

/**
 * Moves a group to `index` of tab `toTabId` (any tab). `index` counts positions in the
 * target tab as it is before the move; leave it out to append. Used by drag and drop.
 */
export function moveGroupTo(layout, groupId, toTabId, index) {
  const from = findGroup(layout, groupId);
  const to = findTab(layout, toTabId);
  if (!from || !to) return false;
  let at = typeof index === 'number' ? Math.max(0, Math.min(index, to.groups.length)) : to.groups.length;
  if (from.tab === to) {
    if (at === from.index || at === from.index + 1) return false;
    if (at > from.index) at -= 1;
  }
  from.tab.groups.splice(from.index, 1);
  to.groups.splice(at, 0, from.group);
  return true;
}

export function removeGroup(layout, groupId) {
  const found = findGroup(layout, groupId);
  if (!found) return false;
  found.tab.groups.splice(found.index, 1);
  return true;
}

export function setGroupPriority(layout, groupId, priority) {
  const found = findGroup(layout, groupId);
  if (!found || !PRIORITIES.includes(priority) || found.group.priority === priority) return false;
  found.group.priority = priority;
  return true;
}

/* ---------- buttons ---------- */

export function addItem(layout, groupId, command, opts) {
  const found = findGroup(layout, groupId);
  if (!found || !str(command, '')) return null;
  const o = opts || {};
  const item = { id: uid('btn'), command: command.trim(), size: SIZES.includes(o.size) ? o.size : 'small' };
  if (str(o.label, '')) item.label = o.label.trim();
  if (str(o.icon, '')) item.icon = o.icon.trim();
  if (COLORS.includes(o.color)) item.color = o.color;
  const at = typeof o.index === 'number' ? Math.max(0, Math.min(o.index, found.group.items.length)) : found.group.items.length;
  found.group.items.splice(at, 0, item);
  return item;
}

export function removeItem(layout, itemId) {
  const found = findItem(layout, itemId);
  if (!found) return false;
  found.group.items.splice(found.index, 1);
  return true;
}

/** Moves a button one step left (-1) or right (+1) inside its group. */
export function shiftItem(layout, itemId, dir) {
  const found = findItem(layout, itemId);
  return !!found && shift(found.group.items, found.index, dir);
}

/**
 * Moves a button to `index` of group `toGroupId` (any tab). `index` counts positions in
 * the target group as it is before the move; leave it out to append.
 */
export function moveItem(layout, itemId, toGroupId, index) {
  const from = findItem(layout, itemId);
  const to = findGroup(layout, toGroupId);
  if (!from || !to) return false;
  let at = typeof index === 'number' ? Math.max(0, Math.min(index, to.group.items.length)) : to.group.items.length;
  if (from.group === to.group) {
    if (at === from.index || at === from.index + 1) return false;
    if (at > from.index) at -= 1;
  }
  from.group.items.splice(from.index, 1);
  to.group.items.splice(at, 0, from.item);
  return true;
}

export function setItemSize(layout, itemId, size) {
  const found = findItem(layout, itemId);
  if (!found || !SIZES.includes(size) || found.item.size === size) return false;
  found.item.size = size;
  return true;
}

/** Sets the button's own label. An empty name goes back to the command's name. */
export function renameItem(layout, itemId, label) {
  const found = findItem(layout, itemId);
  if (!found) return false;
  if (str(label, '')) found.item.label = label.trim();
  else delete found.item.label;
  return true;
}

/** Sets the button's own icon. An empty icon goes back to the command's icon. */
export function setItemIcon(layout, itemId, icon) {
  const found = findItem(layout, itemId);
  if (!found) return false;
  if (str(icon, '')) found.item.icon = icon.trim();
  else delete found.item.icon;
  return true;
}

/** Sets the icon's colour (one of COLORS). An empty colour goes back to the default. */
export function setItemColor(layout, itemId, color) {
  const found = findItem(layout, itemId);
  if (!found || (color && !COLORS.includes(color)) || (found.item.color || '') === (color || '')) return false;
  if (color) found.item.color = color;
  else delete found.item.color;
  return true;
}

/** The colour an icon is drawn in: its own, else accent for large and none for small. */
export function iconColor(item, large) {
  return item.color || (large ? 'accent' : 'none');
}

/* ---------- columns ---------- */

/**
 * Packs a group's buttons into ribbon columns for one size level.
 *   level 0: as chosen by the user - a large button is its own column, runs of small
 *            buttons are stacked three high
 *   level 1: every button small (icon + label), stacked three high
 *   level 2: every button icon-only, stacked three high
 * Returns [{ kind: 'large' | 'stack', items: [...] }].
 */
export function packColumns(items, level) {
  const cols = [];
  let stack = null;
  for (const item of items) {
    if (level === 0 && item.size === 'large') {
      stack = null;
      cols.push({ kind: 'large', items: [item] });
      continue;
    }
    if (!stack || stack.items.length >= STACK) {
      stack = { kind: 'stack', items: [] };
      cols.push(stack);
    }
    stack.items.push(item);
  }
  return cols;
}

/* ---------- export / import ---------- */

export function exportLayout(layout) {
  return JSON.stringify({ format: EXPORT_FORMAT, version: LAYOUT_VERSION, tabs: normalizeLayout(layout).tabs }, null, 2);
}

/** Parses an exported file. Throws an Error with a readable message when it can't be used. */
export function importLayout(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    throw new Error('This file is not valid JSON.');
  }
  if (raw && raw.ribbon && Array.isArray(raw.ribbon.tabs)) raw = raw.ribbon; // a whole data.json
  if (raw && typeof raw.version === 'number' && raw.version > LAYOUT_VERSION) {
    throw new Error('This layout was made by a newer version of the plugin.');
  }
  const layout = normalizeLayout(raw);
  if (!layout.tabs.length) throw new Error('This layout has no tabs.');
  if (!visibleTabs(layout).length) layout.tabs[0].hidden = false;
  return layout;
}
