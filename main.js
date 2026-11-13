/* OneNote Style for Obsidian. Built from src/ with esbuild; edit the sources, not this file. */
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.js
var main_exports = {};
__export(main_exports, {
  default: () => main_default
});
module.exports = __toCommonJS(main_exports);
var import_obsidian3 = require("obsidian");

// src/ribbon/view.js
var import_obsidian2 = require("obsidian");

// src/ribbon/model.js
var LAYOUT_VERSION = 1;
var EXPORT_FORMAT = "onenote-style-ribbon-layout";
var PRIORITIES = ["first", "normal", "last"];
var SIZES = ["large", "small"];
var COLORS = ["accent", "red", "orange", "yellow", "green", "cyan", "blue", "purple", "pink", "none"];
var STACK = 3;
var counter = 0;
function uid(prefix) {
  counter += 1;
  return `${prefix || "x"}-${Date.now().toString(36)}${counter.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}
var str = (v, fallback) => typeof v === "string" && v.trim() ? v.trim() : fallback;
function normalizeLayout(raw) {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.tabs)) {
    throw new Error("This is not a ribbon layout (no list of tabs found).");
  }
  const seen = /* @__PURE__ */ new Set();
  const id = (wanted, prefix) => {
    let v = str(wanted, "") || uid(prefix);
    while (seen.has(v)) v = uid(prefix);
    seen.add(v);
    return v;
  };
  const tabs = [];
  for (const t of raw.tabs) {
    if (!t || typeof t !== "object") continue;
    const tab = { id: id(t.id, "tab"), name: str(t.name, "Tab"), hidden: !!t.hidden, groups: [] };
    for (const g of Array.isArray(t.groups) ? t.groups : []) {
      if (!g || typeof g !== "object") continue;
      const group = {
        id: id(g.id, "grp"),
        name: str(g.name, "Group"),
        priority: PRIORITIES.includes(g.priority) ? g.priority : "normal",
        items: []
      };
      for (const i of Array.isArray(g.items) ? g.items : []) {
        if (!i || typeof i !== "object" || !str(i.command, "")) continue;
        const item = { id: id(i.id, "btn"), command: i.command.trim(), size: SIZES.includes(i.size) ? i.size : "small" };
        if (str(i.label, "")) item.label = i.label.trim();
        if (str(i.icon, "")) item.icon = i.icon.trim();
        if (COLORS.includes(i.color)) item.color = i.color;
        group.items.push(item);
      }
      tab.groups.push(group);
    }
    tabs.push(tab);
  }
  return { version: LAYOUT_VERSION, tabs };
}
function findTab(layout, tabId) {
  return layout.tabs.find((t) => t.id === tabId) || null;
}
function findGroup(layout, groupId) {
  for (const tab of layout.tabs) {
    const index = tab.groups.findIndex((g) => g.id === groupId);
    if (index >= 0) return { tab, group: tab.groups[index], index };
  }
  return null;
}
function findItem(layout, itemId) {
  for (const tab of layout.tabs) {
    for (const group of tab.groups) {
      const index = group.items.findIndex((i) => i.id === itemId);
      if (index >= 0) return { tab, group, item: group.items[index], index };
    }
  }
  return null;
}
function visibleTabs(layout) {
  return layout.tabs.filter((t) => !t.hidden);
}
function activeTab(layout, wantedId) {
  const visible = visibleTabs(layout);
  return visible.find((t) => t.id === wantedId) || visible[0] || null;
}
function shift(list, index, dir) {
  const to = index + dir;
  if (index < 0 || to < 0 || to >= list.length) return false;
  const [x] = list.splice(index, 1);
  list.splice(to, 0, x);
  return true;
}
function addTab(layout, name, afterTabId) {
  const tab = { id: uid("tab"), name: str(name, "New tab"), hidden: false, groups: [] };
  const at = layout.tabs.findIndex((t) => t.id === afterTabId);
  layout.tabs.splice(at >= 0 ? at + 1 : layout.tabs.length, 0, tab);
  return tab;
}
function renameTab(layout, tabId, name) {
  const tab = findTab(layout, tabId);
  if (!tab || !str(name, "")) return false;
  tab.name = name.trim();
  return true;
}
function setTabHidden(layout, tabId, hidden) {
  const tab = findTab(layout, tabId);
  if (!tab || tab.hidden === !!hidden) return false;
  if (hidden && visibleTabs(layout).length <= 1) return false;
  tab.hidden = !!hidden;
  return true;
}
function moveTab(layout, tabId, dir) {
  const from = layout.tabs.findIndex((t) => t.id === tabId);
  if (from < 0) return false;
  let to = from + dir;
  while (to >= 0 && to < layout.tabs.length && layout.tabs[to].hidden) to += dir;
  if (to < 0 || to >= layout.tabs.length) return false;
  const [tab] = layout.tabs.splice(from, 1);
  layout.tabs.splice(to, 0, tab);
  return true;
}
function moveTabNextTo(layout, tabId, targetId, after) {
  const from = layout.tabs.findIndex((t) => t.id === tabId);
  if (from < 0 || tabId === targetId || !findTab(layout, targetId)) return false;
  const [tab] = layout.tabs.splice(from, 1);
  const to = layout.tabs.findIndex((t) => t.id === targetId) + (after ? 1 : 0);
  layout.tabs.splice(to, 0, tab);
  return to !== from;
}
function removeTab(layout, tabId) {
  const index = layout.tabs.findIndex((t) => t.id === tabId);
  if (index < 0) return false;
  const tab = layout.tabs[index];
  if (!tab.hidden && visibleTabs(layout).length <= 1) return false;
  layout.tabs.splice(index, 1);
  return true;
}
function addGroup(layout, tabId, name, afterGroupId) {
  const tab = findTab(layout, tabId);
  if (!tab) return null;
  const group = { id: uid("grp"), name: str(name, "New group"), priority: "normal", items: [] };
  const at = tab.groups.findIndex((g) => g.id === afterGroupId);
  tab.groups.splice(at >= 0 ? at + 1 : tab.groups.length, 0, group);
  return group;
}
function renameGroup(layout, groupId, name) {
  const found = findGroup(layout, groupId);
  if (!found || !str(name, "")) return false;
  found.group.name = name.trim();
  return true;
}
function moveGroup(layout, groupId, dir) {
  const found = findGroup(layout, groupId);
  return !!found && shift(found.tab.groups, found.index, dir);
}
function moveGroupTo(layout, groupId, toTabId, index) {
  const from = findGroup(layout, groupId);
  const to = findTab(layout, toTabId);
  if (!from || !to) return false;
  let at = typeof index === "number" ? Math.max(0, Math.min(index, to.groups.length)) : to.groups.length;
  if (from.tab === to) {
    if (at === from.index || at === from.index + 1) return false;
    if (at > from.index) at -= 1;
  }
  from.tab.groups.splice(from.index, 1);
  to.groups.splice(at, 0, from.group);
  return true;
}
function removeGroup(layout, groupId) {
  const found = findGroup(layout, groupId);
  if (!found) return false;
  found.tab.groups.splice(found.index, 1);
  return true;
}
function setGroupPriority(layout, groupId, priority) {
  const found = findGroup(layout, groupId);
  if (!found || !PRIORITIES.includes(priority) || found.group.priority === priority) return false;
  found.group.priority = priority;
  return true;
}
function addItem(layout, groupId, command, opts) {
  const found = findGroup(layout, groupId);
  if (!found || !str(command, "")) return null;
  const o = opts || {};
  const item = { id: uid("btn"), command: command.trim(), size: SIZES.includes(o.size) ? o.size : "small" };
  if (str(o.label, "")) item.label = o.label.trim();
  if (str(o.icon, "")) item.icon = o.icon.trim();
  if (COLORS.includes(o.color)) item.color = o.color;
  const at = typeof o.index === "number" ? Math.max(0, Math.min(o.index, found.group.items.length)) : found.group.items.length;
  found.group.items.splice(at, 0, item);
  return item;
}
function removeItem(layout, itemId) {
  const found = findItem(layout, itemId);
  if (!found) return false;
  found.group.items.splice(found.index, 1);
  return true;
}
function shiftItem(layout, itemId, dir) {
  const found = findItem(layout, itemId);
  return !!found && shift(found.group.items, found.index, dir);
}
function moveItem(layout, itemId, toGroupId, index) {
  const from = findItem(layout, itemId);
  const to = findGroup(layout, toGroupId);
  if (!from || !to) return false;
  let at = typeof index === "number" ? Math.max(0, Math.min(index, to.group.items.length)) : to.group.items.length;
  if (from.group === to.group) {
    if (at === from.index || at === from.index + 1) return false;
    if (at > from.index) at -= 1;
  }
  from.group.items.splice(from.index, 1);
  to.group.items.splice(at, 0, from.item);
  return true;
}
function setItemSize(layout, itemId, size) {
  const found = findItem(layout, itemId);
  if (!found || !SIZES.includes(size) || found.item.size === size) return false;
  found.item.size = size;
  return true;
}
function renameItem(layout, itemId, label) {
  const found = findItem(layout, itemId);
  if (!found) return false;
  if (str(label, "")) found.item.label = label.trim();
  else delete found.item.label;
  return true;
}
function setItemIcon(layout, itemId, icon2) {
  const found = findItem(layout, itemId);
  if (!found) return false;
  if (str(icon2, "")) found.item.icon = icon2.trim();
  else delete found.item.icon;
  return true;
}
function setItemColor(layout, itemId, color) {
  const found = findItem(layout, itemId);
  if (!found || color && !COLORS.includes(color) || (found.item.color || "") === (color || "")) return false;
  if (color) found.item.color = color;
  else delete found.item.color;
  return true;
}
function iconColor(item, large) {
  return item.color || (large ? "accent" : "none");
}
function packColumns(items, level) {
  const cols = [];
  let stack = null;
  for (const item of items) {
    if (level === 0 && item.size === "large") {
      stack = null;
      cols.push({ kind: "large", items: [item] });
      continue;
    }
    if (!stack || stack.items.length >= STACK) {
      stack = { kind: "stack", items: [] };
      cols.push(stack);
    }
    stack.items.push(item);
  }
  return cols;
}
function exportLayout(layout) {
  return JSON.stringify({ format: EXPORT_FORMAT, version: LAYOUT_VERSION, tabs: normalizeLayout(layout).tabs }, null, 2);
}
function importLayout(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    throw new Error("This file is not valid JSON.");
  }
  if (raw && raw.ribbon && Array.isArray(raw.ribbon.tabs)) raw = raw.ribbon;
  if (raw && typeof raw.version === "number" && raw.version > LAYOUT_VERSION) {
    throw new Error("This layout was made by a newer version of the plugin.");
  }
  const layout = normalizeLayout(raw);
  if (!layout.tabs.length) throw new Error("This layout has no tabs.");
  if (!visibleTabs(layout).length) layout.tabs[0].hidden = false;
  return layout;
}

// src/ribbon/collapse.js
var LEVEL_FULL = 0;
var LEVEL_SMALL = 1;
var LEVEL_ICONS = 2;
var LEVEL_COLLAPSED = 3;
var BIAS = { first: -1.5, normal: 0, last: 1.5 };
var bias = (g) => g.priority in BIAS ? BIAS[g.priority] : 0;
function shrinkSteps(groups) {
  const steps = [];
  groups.forEach((g, index) => {
    for (let level = LEVEL_SMALL; level <= LEVEL_COLLAPSED; level++) {
      steps.push({ id: g.id, level, key: level + bias(g), index });
    }
  });
  steps.sort((a, b) => a.key - b.key || b.index - a.index || a.level - b.level);
  return steps.map(({ id, level }) => ({ id, level }));
}
function overflowOrder(groups) {
  return groups.map((g, index) => ({ id: g.id, key: bias(g), index })).sort((a, b) => a.key - b.key || b.index - a.index).map((x) => x.id);
}
function totalWidth(groups, levels, gap) {
  let w = 0;
  for (const g of groups) w += g.widths[levels[g.id]];
  return w + gap * Math.max(0, groups.length - 1);
}
function shrinkToFit(groups, available, gap) {
  const levels = {};
  for (const g of groups) levels[g.id] = LEVEL_FULL;
  const byId = new Map(groups.map((g) => [g.id, g]));
  let used = totalWidth(groups, levels, gap);
  if (used <= available) return { levels, used, fits: true };
  for (const step of shrinkSteps(groups)) {
    const g = byId.get(step.id);
    if (step.level <= levels[g.id] || !(g.widths[step.level] < g.widths[levels[g.id]])) continue;
    levels[g.id] = step.level;
    used = totalWidth(groups, levels, gap);
    if (used <= available) return { levels, used, fits: true };
  }
  return { levels, used, fits: false };
}
function fitGroups({ groups, available, gap = 0, moreWidth = 0 }) {
  const all = shrinkToFit(groups, available, gap);
  if (all.fits) return { levels: all.levels, overflow: [], used: all.used };
  const order = overflowOrder(groups);
  const hidden = /* @__PURE__ */ new Set();
  for (const id of order) {
    hidden.add(id);
    const rest = groups.filter((g) => !hidden.has(g.id));
    const fit = shrinkToFit(rest, available - moreWidth, gap);
    if (fit.fits || !rest.length) {
      return {
        levels: fit.levels,
        overflow: groups.filter((g) => hidden.has(g.id)).map((g) => g.id),
        used: fit.used + moreWidth
      };
    }
  }
  return { levels: {}, overflow: groups.map((g) => g.id), used: moreWidth };
}
function fitTabs({ widths, available, active = -1, moreWidth = 0 }) {
  const all = widths.map((_, i) => i);
  let used = widths.reduce((a, b) => a + b, 0);
  if (used <= available) return { visible: all, overflow: [] };
  const hidden = /* @__PURE__ */ new Set();
  used += moreWidth;
  for (let i = widths.length - 1; i >= 0 && used > available; i--) {
    if (i === active) continue;
    hidden.add(i);
    used -= widths[i];
  }
  return { visible: all.filter((i) => !hidden.has(i)), overflow: all.filter((i) => hidden.has(i)) };
}

// src/ribbon/internal.js
var CORE_PREFIX = {
  "insert-template": "templates",
  "insert-current-date": "templates",
  "insert-current-time": "templates",
  "outgoing-links": "outgoing-link",
  "open-with-default-app": "open-with-default-app"
};
var BUILT_IN = /* @__PURE__ */ new Set(["editor", "workspace", "app", "theme", "markdown", "window", "mobile", "file-explorer"]);
function listCommands(app) {
  try {
    const c = app.commands;
    if (!c) return [];
    if (typeof c.listCommands === "function") return c.listCommands();
    return Object.values(c.commands || {});
  } catch (e) {
    return [];
  }
}
function findCommand(app, id) {
  try {
    const c = app.commands;
    if (!c) return null;
    if (typeof c.findCommand === "function") return c.findCommand(id) || null;
    return c.commands && c.commands[id] || c.editorCommands && c.editorCommands[id] || null;
  } catch (e) {
    return null;
  }
}
function executeCommand(app, id) {
  try {
    if (!findCommand(app, id)) return false;
    return app.commands.executeCommandById(id) !== false;
  } catch (e) {
    console.error("OneNote Style: command failed", id, e);
    return false;
  }
}
function hotkeyText(app, id) {
  try {
    const hm = app.hotkeyManager;
    if (!hm || typeof hm.printHotkeyForCommand !== "function") return "";
    return hm.printHotkeyForCommand(id) || "";
  } catch (e) {
    return "";
  }
}
function missingReason(app, commandId) {
  const prefix = commandId.includes(":") ? commandId.slice(0, commandId.indexOf(":")) : commandId;
  try {
    if (BUILT_IN.has(prefix)) return "This command is not available in this version of Obsidian.";
    const community = app.plugins;
    const manifest = community && community.manifests && community.manifests[prefix];
    if (manifest) {
      const on = !!(community.plugins && community.plugins[prefix]);
      return on ? `The plugin "${manifest.name}" doesn't offer this command (any more).` : `The plugin "${manifest.name}" is turned off. Turn it on in Settings > Community plugins.`;
    }
    const core = app.internalPlugins && app.internalPlugins.plugins;
    const corePlugin = core && core[CORE_PREFIX[prefix] || prefix];
    if (corePlugin) {
      const name = corePlugin.instance && corePlugin.instance.name || prefix;
      return corePlugin.enabled ? `The core plugin "${name}" doesn't offer this command (any more).` : `The core plugin "${name}" is turned off. Turn it on in Settings > Core plugins.`;
    }
  } catch (e) {
  }
  return `Needs the plugin "${prefix}", which is not installed or is turned off.`;
}
function tintMenuItem(menuItem, color) {
  try {
    const icon2 = menuItem.dom && menuItem.dom.querySelector(".menu-item-icon");
    if (icon2 && color && color !== "none") icon2.dataset.onrColor = color;
  } catch (e) {
  }
}
function mountPoint(doc) {
  const parent = doc.body.querySelector(".app-container");
  const before = parent && parent.querySelector(":scope > .horizontal-main-container");
  return parent && before ? { parent, before } : null;
}
function openSettings(app, tabId) {
  try {
    const setting = app.setting;
    if (!setting) return executeCommand(app, "app:open-settings");
    setting.open();
    if (tabId && setting.openTabById) setting.openTabById(tabId);
    return true;
  } catch (e) {
    return false;
  }
}
function isPluginEnabled(app, id) {
  try {
    return !!(app.plugins && app.plugins.enabledPlugins && app.plugins.enabledPlugins.has(id) && app.plugins.plugins[id]);
  } catch (e) {
    return false;
  }
}
function setDarkMode(app, dark, doc) {
  try {
    if (typeof app.changeTheme === "function") {
      app.changeTheme(dark ? "obsidian" : "moonstone");
      return true;
    }
  } catch (e) {
  }
  if (doc.body.classList.contains("theme-dark") !== dark) return executeCommand(app, "theme:toggle-light-dark");
  return true;
}

// src/ribbon/modals.js
var import_obsidian = require("obsidian");
var CommandPickerModal = class extends import_obsidian.FuzzySuggestModal {
  constructor(app, onChoose) {
    super(app);
    this.onChoose = onChoose;
    this.modalEl.addClass("onr-picker");
    this.setPlaceholder("Add a command to the ribbon: type to search...");
    this.setInstructions([
      { command: "\u2191\u2193", purpose: "to move" },
      { command: "\u21B5", purpose: "to add" },
      { command: "esc", purpose: "to cancel" }
    ]);
  }
  getItems() {
    return listCommands(this.app).slice().sort((a, b) => a.name.localeCompare(b.name));
  }
  getItemText(cmd) {
    return cmd.name;
  }
  renderSuggestion(match, el) {
    super.renderSuggestion(match, el);
    el.addClass("onr-picker-item");
    el.createSpan({ cls: "onr-picker-id", text: match.item.id });
  }
  onChooseItem(cmd) {
    this.onChoose(cmd);
  }
};
var IconPickerModal = class extends import_obsidian.FuzzySuggestModal {
  constructor(app, onChoose) {
    super(app);
    this.onChoose = onChoose;
    this.limit = 120;
    this.modalEl.addClass("onr-picker", "onr-icon-picker");
    this.setPlaceholder('Choose an icon: type to search (for example "star", "file", "arrow")...');
  }
  getItems() {
    return (0, import_obsidian.getIconIds)().map((id) => id.replace(/^lucide-/, "")).sort();
  }
  getItemText(id) {
    return id.replace(/-/g, " ");
  }
  renderSuggestion(match, el) {
    el.addClass("onr-picker-item", "onr-icon-item");
    (0, import_obsidian.setIcon)(el.createSpan("onr-icon-item-icon"), match.item);
    el.createSpan({ text: match.item });
  }
  onChooseItem(id) {
    this.onChoose(id);
  }
};

// src/ribbon/view.js
var DRAG_THRESHOLD = 6;
var TAB_HOVER_MS = 450;
var COLOR_LABEL = { accent: "Accent", red: "Red", orange: "Orange", yellow: "Yellow", green: "Green", cyan: "Cyan", blue: "Blue", purple: "Purple", pink: "Pink", none: "No colour" };
var PRIORITY_LABEL = { first: "Shrink first", normal: "Shrink normally", last: "Shrink last" };
var RibbonView = class {
  constructor(host) {
    this.host = host;
    this.app = host.app;
    this.rev = 0;
    this.measured = null;
    this.fitKey = null;
    this.popover = null;
    this.press = null;
    this.drag = null;
    this.anchor = null;
    this.suppressClick = false;
    this.editing = false;
    this.editScope = null;
    this.onClick = this.onClick.bind(this);
    this.onContextMenu = this.onContextMenu.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onDragKey = this.onDragKey.bind(this);
  }
  get layout() {
    return this.host.ribbonLayout;
  }
  get doc() {
    return this.bodyEl ? this.bodyEl.ownerDocument : document;
  }
  currentTab() {
    return activeTab(this.layout, this.host.state.ribbonTab);
  }
  /* ---------- mounting ---------- */
  mount(topBar, tabsEl, bodyEl) {
    this.unmount();
    this.topBar = topBar;
    topBar.toggleClass("is-editing", this.editing);
    this.tabsEl = tabsEl;
    this.bodyEl = bodyEl;
    topBar.addEventListener("click", this.onClick);
    topBar.addEventListener("contextmenu", this.onContextMenu);
    topBar.addEventListener("pointerdown", this.onPointerDown);
    let frame = 0;
    this.observer = new ResizeObserver(() => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        if (!this.bodyEl || !this.bodyEl.isConnected) return;
        this.topBar.toggleClass("is-narrow", this.topBar.clientWidth < 640);
        this.fitTabRow();
        this.layoutBody();
      });
    });
    this.observer.observe(topBar);
    this.render();
  }
  unmount() {
    this.closePopover();
    this.cancelDrag();
    this.popEditScope();
    this.editing = false;
    if (this.observer) this.observer.disconnect();
    this.observer = null;
    if (this.topBar) {
      this.topBar.removeEventListener("click", this.onClick);
      this.topBar.removeEventListener("contextmenu", this.onContextMenu);
      this.topBar.removeEventListener("pointerdown", this.onPointerDown);
    }
    this.topBar = this.tabsEl = this.bodyEl = this.strip = null;
  }
  render() {
    this.renderTabs();
    this.renderBody();
  }
  /**
   * Customise mode: tabs and groups can be dragged like buttons, "+" tiles create new
   * tabs, groups and buttons, and a click on a button opens its menu instead of running it.
   */
  setEditing(on) {
    on = !!on;
    if (this.editing === on || !this.topBar) return;
    this.editing = on;
    this.measured = null;
    this.topBar.toggleClass("is-editing", on);
    this.popEditScope();
    if (on) {
      this.editScope = new import_obsidian2.Scope(this.app.scope);
      this.editScope.register([], "Escape", () => {
        if (this.drag || this.popover) return true;
        this.setEditing(false);
        return false;
      });
      this.app.keymap.pushScope(this.editScope);
      if (this.host.state.ribbonCollapsed) this.host.state.ribbonCollapsed = false;
    }
    this.render();
  }
  popEditScope() {
    if (this.editScope) this.app.keymap.popScope(this.editScope);
    this.editScope = null;
  }
  /** Call after any change to the layout. */
  changed() {
    this.rev += 1;
    this.host.saveRibbon();
    this.render();
  }
  /** Forget measured widths (after a font, theme or zoom change) and redraw. */
  remeasure() {
    this.measured = null;
    this.render();
  }
  /** Called on a timer: redraws when a plugin was turned on or off. */
  tick() {
    if (!this.bodyEl || !this.strip || this.drag || this.popover || this.editing) return;
    const tab = this.currentTab();
    if (!tab || !this.measured) return;
    if (this.measured.key !== this.measureKey(tab)) this.renderBody();
  }
  /** Where a picker opened by the last clicked button should appear, or null. */
  lastAnchor() {
    return this.anchor && Date.now() - this.anchor.time < 1500 ? this.anchor.rect : null;
  }
  /* ---------- tab row ---------- */
  renderTabs() {
    const el = this.tabsEl;
    if (!el) return;
    el.empty();
    const current = this.currentTab();
    for (const tab of visibleTabs(this.layout)) {
      el.createDiv({
        cls: "onenote-tab" + (current && tab.id === current.id ? " is-active" : ""),
        text: tab.name,
        attr: { "data-tab": tab.id, role: "tab" }
      });
    }
    if (this.editing) {
      const add = el.createDiv({ cls: "onenote-tab onr-tab-add", attr: { "aria-label": "New tab", "data-tooltip-position": "bottom" } });
      (0, import_obsidian2.setIcon)(add, "plus");
    }
    this.fitTabRow();
  }
  /** Moves tab labels that don't fit into a drop-down at the end of the tab row. */
  fitTabRow() {
    const el = this.tabsEl;
    if (!el || !el.isConnected) return;
    const old = el.querySelector(".onr-tab-more");
    if (old) old.remove();
    const tabs = Array.from(el.querySelectorAll(".onenote-tab[data-tab]"));
    tabs.forEach((t) => t.removeClass("is-overflow", "is-squeezed"));
    if (!tabs.length || el.clientWidth <= 0 || el.scrollWidth <= el.clientWidth + 1) return;
    const widths = tabs.map((t) => Math.ceil(t.getBoundingClientRect().width) + 2);
    const active = tabs.findIndex((t) => t.hasClass("is-active"));
    const fit = fitTabs({ widths, available: el.clientWidth, active, moreWidth: this.editing ? 68 : 34 });
    fit.overflow.forEach((i) => tabs[i].addClass("is-overflow"));
    if (!fit.overflow.length) return;
    if (fit.visible.length === 1 && widths[fit.visible[0]] + 34 > el.clientWidth) tabs[fit.visible[0]].addClass("is-squeezed");
    const more = el.createDiv({ cls: "onenote-tab onr-tab-more", attr: { "aria-label": "More tabs", "data-tooltip-position": "bottom" } });
    (0, import_obsidian2.setIcon)(more, "chevrons-right");
    more.onclick = (e) => {
      e.stopPropagation();
      const menu = new import_obsidian2.Menu();
      for (const i of fit.overflow) {
        const id = tabs[i].dataset.tab;
        menu.addItem((it) => it.setTitle(tabs[i].textContent).onClick(() => this.selectTab(id)));
      }
      const r = more.getBoundingClientRect();
      menu.showAtPosition({ x: r.left, y: r.bottom + 2 });
    };
  }
  selectTab(id) {
    const state = this.host.state;
    const current = this.currentTab();
    if (current && current.id === id && state.ribbonTab === id && !state.ribbonCollapsed) return;
    state.ribbonTab = id;
    if (state.ribbonCollapsed) state.ribbonCollapsed = false;
    this.host.saveRibbon();
    this.render();
  }
  /* ---------- ribbon body ---------- */
  renderBody() {
    this.closePopover();
    const el = this.bodyEl;
    if (!el) return;
    el.empty();
    this.strip = null;
    this.fitKey = null;
    const collapsed = !!this.host.state.ribbonCollapsed;
    this.topBar.toggleClass("is-ribbon-collapsed", collapsed);
    if (collapsed) return;
    this.strip = el.createDiv("onr-strip");
    const collapse = el.createDiv({ cls: "onenote-ribbon-collapse", attr: { "aria-label": "Collapse the ribbon (Ctrl+F1)", "data-tooltip-position": "left" } });
    (0, import_obsidian2.setIcon)(collapse, "chevron-up");
    collapse.onclick = () => this.host.toggleRibbon();
    if (this.editing) {
      const done = el.createEl("button", { cls: "onr-edit-done", text: "Done", attr: { type: "button", "aria-label": "Customise mode: drag tabs, groups and buttons to move them, use + to add. Click Done or press Esc to finish.", "data-tooltip-position": "left" } });
      done.onclick = (e) => {
        e.stopPropagation();
        this.setEditing(false);
      };
    }
    const tab = this.currentTab();
    if (!tab) return;
    if (!tab.groups.length) {
      const empty = this.strip.createEl("button", { cls: "onr-empty", attr: { type: "button" } });
      (0, import_obsidian2.setIcon)(empty.createSpan("onr-empty-icon"), "plus");
      empty.createSpan({ text: "Add a group" });
      empty.onclick = (e) => {
        e.stopPropagation();
        this.promptAddGroup(tab.id);
      };
      this.strip.createSpan({ cls: "onr-empty-hint", text: "This tab is empty. Right-click anywhere on the ribbon to customise it." });
      return;
    }
    this.measure(tab);
    this.layoutBody();
  }
  measureKey(tab) {
    let avail = "";
    for (const g of tab.groups) for (const i of g.items) avail += findCommand(this.app, i.command) ? "1" : "0";
    return [tab.id, this.rev, avail, this.editing ? "edit" : ""].join("|");
  }
  /** Measures how wide every group of the tab is at each of the four size levels. */
  measure(tab) {
    const key = this.measureKey(tab);
    if (this.measured && this.measured.key === key) return;
    const strip = this.strip;
    strip.addClass("is-measuring");
    const widths = {};
    for (const g of tab.groups) {
      widths[g.id] = [];
      for (let level = LEVEL_FULL; level <= LEVEL_COLLAPSED; level++) {
        const node = this.drawGroup(strip, g, level);
        widths[g.id][level] = Math.ceil(node.getBoundingClientRect().width);
        node.remove();
      }
    }
    const more = this.drawMore(strip, []);
    const moreWidth = Math.ceil(more.getBoundingClientRect().width);
    more.remove();
    let newGroupWidth = 0;
    if (this.editing) {
      const tile = this.drawNewGroup(strip);
      newGroupWidth = Math.ceil(tile.getBoundingClientRect().width) + 12;
      tile.remove();
    }
    strip.removeClass("is-measuring");
    this.measured = { key, widths, moreWidth, newGroupWidth };
  }
  /** Picks a size level for every group so the tab fits the current width, then draws it. */
  layoutBody() {
    const strip = this.strip;
    const tab = this.currentTab();
    if (!strip || !strip.isConnected || !tab || !tab.groups.length || !this.measured) return;
    const available = Math.floor(strip.clientWidth) - (this.editing ? this.measured.newGroupWidth : 0);
    if (strip.clientWidth <= 0) return;
    const fit = fitGroups({
      groups: tab.groups.map((g) => ({ id: g.id, priority: g.priority, widths: this.measured.widths[g.id] })),
      available,
      gap: 0,
      moreWidth: this.measured.moreWidth
    });
    const key = JSON.stringify([fit.levels, fit.overflow, this.editing]);
    if (key === this.fitKey) return;
    this.fitKey = key;
    this.closePopover();
    strip.empty();
    const overflow = [];
    for (const g of tab.groups) {
      if (fit.overflow.includes(g.id)) overflow.push(g);
      else this.drawGroup(strip, g, fit.levels[g.id]);
    }
    if (overflow.length) this.drawMore(strip, overflow);
    if (this.editing) this.drawNewGroup(strip);
    strip.dataset.fit = key;
  }
  drawGroup(parent, group, level) {
    const el = parent.createDiv({ cls: "onr-group", attr: { "data-group": group.id, "data-level": String(level) } });
    if (level === LEVEL_COLLAPSED && group.items.length) {
      el.addClass("is-collapsed");
      const b = el.createEl("button", { cls: "onr-btn is-large onr-group-button", attr: { type: "button", "aria-label": group.name, "data-tooltip-position": "bottom", "aria-haspopup": "true" } });
      const first = group.items[0];
      this.drawIcon(b.createSpan("onr-btn-icon"), first, findCommand(this.app, first.command), group.name, true);
      b.createSpan({ cls: "onr-btn-label", text: group.name });
      (0, import_obsidian2.setIcon)(b.createSpan("onr-btn-caret"), "chevron-down");
      return el;
    }
    const body = el.createDiv("onr-group-body");
    if (!group.items.length) {
      const add = body.createEl("button", { cls: "onr-btn is-large onr-add", attr: { type: "button", "aria-label": "Add a command to this group", "data-tooltip-position": "bottom" } });
      (0, import_obsidian2.setIcon)(add.createSpan("onr-btn-icon"), "plus");
      add.createSpan({ cls: "onr-btn-label", text: "Add" });
    }
    for (const col of packColumns(group.items, level)) {
      if (col.kind === "large") {
        this.drawButton(body, col.items[0], "large");
      } else {
        const stack = body.createDiv("onr-stack");
        for (const item of col.items) this.drawButton(stack, item, level === LEVEL_ICONS ? "icon" : "small");
      }
    }
    if (this.editing && group.items.length) {
      const add = body.createEl("button", { cls: "onr-btn is-icon onr-add onr-add-inline", attr: { type: "button", "aria-label": "Add a command to this group", "data-tooltip-position": "bottom" } });
      (0, import_obsidian2.setIcon)(add.createSpan("onr-btn-icon"), "plus");
    }
    el.createDiv({ cls: "onr-group-label", text: group.name });
    return el;
  }
  /** The "New group" tile shown at the end of the ribbon in customise mode. */
  drawNewGroup(parent) {
    const b = parent.createEl("button", { cls: "onr-btn is-large onr-new-group", attr: { type: "button", "aria-label": "Add a new group to this tab", "data-tooltip-position": "bottom" } });
    (0, import_obsidian2.setIcon)(b.createSpan("onr-btn-icon"), "plus");
    b.createSpan({ cls: "onr-btn-label", text: "New group" });
    return b;
  }
  drawButton(parent, item, mode) {
    const cmd = findCommand(this.app, item.command);
    const label = this.labelOf(item, cmd);
    const b = parent.createEl("button", { cls: `onr-btn is-${mode}`, attr: { type: "button", "data-item": item.id, "data-tooltip-position": "bottom" } });
    this.drawIcon(b.createSpan("onr-btn-icon"), item, cmd, label, mode === "large");
    if (mode !== "icon") b.createSpan({ cls: "onr-btn-label", text: label });
    if (cmd) {
      const keys = hotkeyText(this.app, item.command);
      const name = cmd.name && cmd.name.toLowerCase() !== label.toLowerCase() ? `${label}: ${cmd.name}` : label;
      b.setAttr("aria-label", keys ? `${name} (${keys})` : name);
    } else {
      b.addClass("is-disabled");
      b.setAttr("aria-disabled", "true");
      b.setAttr("aria-label", `${label} - not available. ${missingReason(this.app, item.command)}`);
    }
    return b;
  }
  labelOf(item, cmd) {
    if (item.label) return item.label;
    if (cmd && cmd.name) return cmd.name.replace(/^[^:]{1,40}: /, "");
    const id = item.command;
    return id.slice(id.indexOf(":") + 1).replace(/-/g, " ");
  }
  drawIcon(el, item, cmd, label, large) {
    const color = iconColor(item, large);
    if (color !== "none") el.dataset.color = color;
    for (const id of [item.icon, cmd && cmd.icon]) {
      if (id && /^[\w-]+$/.test(id) && (0, import_obsidian2.getIcon)(id)) {
        (0, import_obsidian2.setIcon)(el, id);
        return;
      }
    }
    el.addClass("is-glyph");
    el.setText((label.trim()[0] || "?").toUpperCase());
  }
  drawMore(parent, groups) {
    const el = parent.createDiv("onr-more");
    const b = el.createEl("button", { cls: "onr-btn is-large onr-more-button", attr: { type: "button", "aria-label": "More commands", "data-tooltip-position": "bottom", "aria-haspopup": "true" } });
    (0, import_obsidian2.setIcon)(b.createSpan("onr-btn-icon"), "chevrons-right");
    b.createSpan({ cls: "onr-btn-label", text: "More" });
    (0, import_obsidian2.setIcon)(b.createSpan("onr-btn-caret"), "chevron-down");
    this.moreGroups = groups;
    return el;
  }
  /* ---------- drop-downs ---------- */
  openPopover(anchorEl, cls, build) {
    const wasOpen = this.popover && this.popover.anchor === anchorEl;
    this.closePopover();
    if (wasOpen) return;
    const doc = this.doc;
    const pop = doc.body.createDiv("onr-popover " + cls);
    pop.addEventListener("mousedown", (e) => e.preventDefault());
    pop.addEventListener("click", this.onClick);
    pop.addEventListener("contextmenu", this.onContextMenu);
    build(pop);
    const r = anchorEl.getBoundingClientRect();
    const vw = doc.documentElement.clientWidth;
    const vh = doc.documentElement.clientHeight;
    pop.style.maxWidth = vw - 16 + "px";
    const ribbonBottom = this.bodyEl ? this.bodyEl.getBoundingClientRect().bottom : 0;
    const top = Math.max(r.bottom + 4, ribbonBottom - 1);
    pop.style.maxHeight = Math.max(120, vh - top - 8) + "px";
    pop.style.top = top + "px";
    pop.style.left = Math.max(8, Math.min(r.left, vw - pop.offsetWidth - 8)) + "px";
    const onDown = (e) => {
      if (pop.contains(e.target) || anchorEl.contains(e.target)) return;
      if (e.target.closest && e.target.closest(".menu")) return;
      this.closePopover();
    };
    const onKey = (e) => {
      if (e.key === "Escape") this.closePopover();
    };
    doc.addEventListener("mousedown", onDown, true);
    doc.addEventListener("keydown", onKey, true);
    anchorEl.addClass("is-open");
    anchorEl.setAttr("aria-expanded", "true");
    this.popover = {
      el: pop,
      anchor: anchorEl,
      close: () => {
        pop.remove();
        doc.removeEventListener("mousedown", onDown, true);
        doc.removeEventListener("keydown", onKey, true);
        anchorEl.removeClass("is-open");
        anchorEl.setAttr("aria-expanded", "false");
      }
    };
  }
  closePopover() {
    const p = this.popover;
    if (!p) return;
    this.popover = null;
    p.close();
  }
  openGroupPopover(groupId, anchorEl) {
    const found = findGroup(this.layout, groupId);
    if (!found) return;
    this.openPopover(anchorEl, "onr-popover-group", (pop) => this.drawGroup(pop, found.group, LEVEL_FULL));
  }
  openMorePopover(anchorEl) {
    const groups = this.moreGroups || [];
    this.openPopover(anchorEl, "onr-popover-more", (pop) => {
      for (const g of groups) {
        const sec = pop.createDiv({ cls: "onr-more-group", attr: { "data-group": g.id } });
        sec.createDiv({ cls: "onr-more-title", text: g.name });
        const body = sec.createDiv("onr-more-items");
        if (!g.items.length) body.createSpan({ cls: "onr-empty-hint", text: "Empty group. Right-click to add a command." });
        for (const item of g.items) this.drawButton(body, item, "small");
      }
    });
  }
  /* ---------- clicks ---------- */
  onClick(e) {
    if (this.suppressClick) return;
    const t = e.target;
    const tabEl = t.closest(".onenote-tab[data-tab]");
    if (tabEl) {
      this.selectTab(tabEl.dataset.tab);
      return;
    }
    if (t.closest(".onr-tab-add")) {
      this.promptAddTab();
      return;
    }
    if (t.closest(".onr-new-group")) {
      const tab = this.currentTab();
      if (tab) this.promptAddGroup(tab.id);
      return;
    }
    const itemEl = t.closest("[data-item]");
    if (itemEl && this.editing) {
      const menu = this.itemMenu(itemEl.dataset.item, e);
      if (menu) menu.showAtMouseEvent(e);
      return;
    }
    if (itemEl) {
      this.runItem(itemEl.dataset.item, itemEl);
      return;
    }
    if (this.editing && t.closest(".onr-group-label")) {
      const menu = this.groupMenu(t.closest("[data-group]").dataset.group);
      if (menu) menu.showAtMouseEvent(e);
      return;
    }
    if (t.closest(".onr-add")) {
      const g = t.closest("[data-group]");
      if (g) this.pickCommand(g.dataset.group);
      return;
    }
    const groupButton = t.closest(".onr-group-button");
    if (groupButton) {
      this.openGroupPopover(groupButton.closest("[data-group]").dataset.group, groupButton);
      return;
    }
    const moreButton = t.closest(".onr-more-button");
    if (moreButton) this.openMorePopover(moreButton);
  }
  runItem(itemId, el) {
    const found = findItem(this.layout, itemId);
    if (!found) return;
    this.anchor = { rect: el.getBoundingClientRect(), time: Date.now() };
    this.closePopover();
    if (!findCommand(this.app, found.item.command)) {
      new import_obsidian2.Notice(`"${this.labelOf(found.item, null)}" is not available. ${missingReason(this.app, found.item.command)}`);
      return;
    }
    this.host.runRibbonCommand(found.item.command);
  }
  /* ---------- right-click menus ---------- */
  onContextMenu(e) {
    const t = e.target;
    if (t.closest("input, textarea, .onenote-section-tabs, .onenote-qat")) return;
    e.preventDefault();
    e.stopPropagation();
    const itemEl = t.closest("[data-item]");
    const groupEl = t.closest("[data-group]");
    const tabEl = t.closest(".onenote-tab[data-tab]");
    let menu;
    if (itemEl) menu = this.itemMenu(itemEl.dataset.item, e);
    else if (groupEl) menu = this.groupMenu(groupEl.dataset.group);
    else {
      const tab = tabEl ? findTab(this.layout, tabEl.dataset.tab) : this.currentTab();
      menu = this.tabMenu(tab, !!tabEl);
    }
    if (menu) menu.showAtMouseEvent(e);
  }
  itemMenu(itemId, e) {
    const found = findItem(this.layout, itemId);
    if (!found) return null;
    const { item, group, index } = found;
    const L2 = this.layout;
    const menu = new import_obsidian2.Menu();
    menu.addItem((i) => i.setTitle("Rename...").setIcon("pencil").onClick(async () => {
      const name = await this.host.promptText("Rename button", this.labelOf(item, findCommand(this.app, item.command)), "Rename");
      if (name && renameItem(L2, itemId, name)) this.changed();
    }));
    menu.addItem((i) => i.setTitle("Change icon...").setIcon("image").onClick(() => {
      new IconPickerModal(this.app, (icon2) => {
        if (setItemIcon(L2, itemId, icon2)) this.changed();
      }).open();
    }));
    menu.addItem((i) => i.setTitle("Icon colour...").setIcon("palette").onClick(() => {
      const pick = new import_obsidian2.Menu();
      pick.addItem((x) => x.setTitle("Default").setChecked(!item.color).onClick(() => {
        if (setItemColor(L2, itemId, "")) this.changed();
      }));
      pick.addSeparator();
      for (const c of COLORS) {
        pick.addItem((x) => {
          x.setTitle(COLOR_LABEL[c]).setIcon(c === "none" ? "circle-off" : "circle").setChecked(item.color === c).onClick(() => {
            if (setItemColor(L2, itemId, c)) this.changed();
          });
          tintMenuItem(x, c);
        });
      }
      pick.showAtPosition({ x: e.clientX, y: e.clientY });
    }));
    if (item.label || item.icon) {
      menu.addItem((i) => i.setTitle("Use the command's own name and icon").setIcon("rotate-ccw").onClick(() => {
        renameItem(L2, itemId, "");
        setItemIcon(L2, itemId, "");
        this.changed();
      }));
    }
    menu.addSeparator();
    menu.addItem((i) => i.setTitle("Large button").setIcon("square").setChecked(item.size === "large").onClick(() => {
      if (setItemSize(L2, itemId, "large")) this.changed();
    }));
    menu.addItem((i) => i.setTitle("Small button").setIcon("rows-3").setChecked(item.size === "small").onClick(() => {
      if (setItemSize(L2, itemId, "small")) this.changed();
    }));
    menu.addSeparator();
    menu.addItem((i) => i.setTitle("Move left").setIcon("arrow-left").setDisabled(index === 0).onClick(() => {
      if (shiftItem(L2, itemId, -1)) this.changed();
    }));
    menu.addItem((i) => i.setTitle("Move right").setIcon("arrow-right").setDisabled(index === group.items.length - 1).onClick(() => {
      if (shiftItem(L2, itemId, 1)) this.changed();
    }));
    menu.addItem((i) => i.setTitle("Move to group...").setIcon("folder-input").onClick(() => {
      const pick = new import_obsidian2.Menu();
      for (const tab of L2.tabs) {
        const groups = tab.groups.filter((g) => g.id !== group.id);
        if (!groups.length) continue;
        pick.addItem((x) => x.setTitle(tab.name).setIsLabel(true));
        for (const g of groups) {
          pick.addItem((x) => x.setTitle(g.name).setIcon("corner-down-right").onClick(() => {
            if (moveItem(L2, itemId, g.id)) this.changed();
          }));
        }
      }
      pick.showAtPosition({ x: e.clientX, y: e.clientY });
    }));
    menu.addSeparator();
    menu.addItem((i) => i.setTitle("Remove from ribbon").setIcon("trash-2").setWarning(true).onClick(() => {
      if (removeItem(L2, itemId)) this.changed();
    }));
    return menu;
  }
  groupMenu(groupId) {
    const found = findGroup(this.layout, groupId);
    if (!found) return null;
    const { group, tab, index } = found;
    const L2 = this.layout;
    const menu = new import_obsidian2.Menu();
    menu.addItem((i) => i.setTitle("Add command...").setIcon("plus").onClick(() => this.pickCommand(groupId)));
    menu.addItem((i) => i.setTitle("Rename group...").setIcon("pencil").onClick(async () => {
      const name = await this.host.promptText("Rename group", group.name, "Rename");
      if (name && renameGroup(L2, groupId, name)) this.changed();
    }));
    menu.addSeparator();
    menu.addItem((i) => i.setTitle("Move group left").setIcon("arrow-left").setDisabled(index === 0).onClick(() => {
      if (moveGroup(L2, groupId, -1)) this.changed();
    }));
    menu.addItem((i) => i.setTitle("Move group right").setIcon("arrow-right").setDisabled(index === tab.groups.length - 1).onClick(() => {
      if (moveGroup(L2, groupId, 1)) this.changed();
    }));
    menu.addSeparator();
    menu.addItem((i) => i.setTitle("When space runs out").setIsLabel(true));
    for (const p of PRIORITIES) {
      menu.addItem((i) => i.setTitle(PRIORITY_LABEL[p]).setChecked(group.priority === p).onClick(() => {
        if (setGroupPriority(L2, groupId, p)) this.changed();
      }));
    }
    menu.addSeparator();
    menu.addItem((i) => i.setTitle("New group...").setIcon("folder-plus").onClick(() => this.promptAddGroup(tab.id, groupId)));
    this.addEditToggle(menu);
    menu.addItem((i) => i.setTitle("Delete group").setIcon("trash-2").setWarning(true).onClick(async () => {
      if (group.items.length) {
        const ok = await this.host.confirm("Delete group", `Delete the group "${group.name}" and its ${group.items.length} button(s)?`, "Delete");
        if (!ok) return;
      }
      if (removeGroup(L2, groupId)) this.changed();
    }));
    return menu;
  }
  tabMenu(tab, onTab) {
    const L2 = this.layout;
    const menu = new import_obsidian2.Menu();
    this.addEditToggle(menu);
    menu.addSeparator();
    if (tab) {
      menu.addItem((i) => i.setTitle("New group...").setIcon("folder-plus").onClick(() => this.promptAddGroup(tab.id)));
    }
    menu.addItem((i) => i.setTitle("New tab...").setIcon("plus").onClick(() => this.promptAddTab(tab ? tab.id : null)));
    if (tab) {
      const visible = visibleTabs(L2);
      const pos = visible.indexOf(tab);
      menu.addItem((i) => i.setTitle(`Rename tab "${tab.name}"...`).setIcon("pencil").onClick(async () => {
        const name = await this.host.promptText("Rename tab", tab.name, "Rename");
        if (name && renameTab(L2, tab.id, name)) this.changed();
      }));
      menu.addItem((i) => i.setTitle("Move tab left").setIcon("arrow-left").setDisabled(pos <= 0).onClick(() => {
        if (moveTab(L2, tab.id, -1)) this.changed();
      }));
      menu.addItem((i) => i.setTitle("Move tab right").setIcon("arrow-right").setDisabled(pos < 0 || pos === visible.length - 1).onClick(() => {
        if (moveTab(L2, tab.id, 1)) this.changed();
      }));
      menu.addItem((i) => i.setTitle(`Hide tab "${tab.name}"`).setIcon("eye-off").setDisabled(visible.length <= 1).onClick(() => {
        if (setTabHidden(L2, tab.id, true)) this.changed();
      }));
      menu.addItem((i) => i.setTitle(`Delete tab "${tab.name}"...`).setIcon("trash-2").setWarning(true).setDisabled(visible.length <= 1).onClick(async () => {
        const ok = await this.host.confirm("Delete tab", `Delete the tab "${tab.name}" with all its groups and buttons? To keep it for later, hide it instead.`, "Delete");
        if (ok && removeTab(L2, tab.id)) this.changed();
      }));
    }
    const hidden = L2.tabs.filter((t) => t.hidden);
    if (hidden.length) {
      menu.addSeparator();
      menu.addItem((i) => i.setTitle("Hidden tabs").setIsLabel(true));
      for (const t of hidden) {
        menu.addItem((i) => i.setTitle(`Show "${t.name}"`).setIcon("eye").onClick(() => {
          if (setTabHidden(L2, t.id, false)) {
            this.host.state.ribbonTab = t.id;
            this.changed();
          }
        }));
      }
    }
    menu.addSeparator();
    menu.addItem((i) => i.setTitle("Export layout...").setIcon("download").onClick(() => this.host.exportRibbon()));
    menu.addItem((i) => i.setTitle("Import layout...").setIcon("upload").onClick(() => this.host.importRibbon()));
    menu.addItem((i) => i.setTitle("Reset to default...").setIcon("rotate-ccw").onClick(() => this.host.resetRibbon()));
    if (!onTab) {
      menu.addSeparator();
      menu.addItem((i) => i.setTitle("Collapse the ribbon").setIcon("chevron-up").onClick(() => this.host.toggleRibbon()));
    }
    return menu;
  }
  addEditToggle(menu) {
    if (this.editing) menu.addItem((i) => i.setTitle("Done customising").setIcon("check").onClick(() => this.setEditing(false)));
    else menu.addItem((i) => i.setTitle("Customise with drag and drop").setIcon("move").onClick(() => this.setEditing(true)));
  }
  async promptAddTab(afterTabId) {
    const name = await this.host.promptText("New tab", "", "Add");
    if (!name) return;
    const current = this.currentTab();
    const created = addTab(this.layout, name, afterTabId || (current ? current.id : null));
    this.host.state.ribbonTab = created.id;
    this.changed();
  }
  pickCommand(groupId) {
    new CommandPickerModal(this.app, (cmd) => {
      if (addItem(this.layout, groupId, cmd.id, { size: "small" })) this.changed();
    }).open();
  }
  async promptAddGroup(tabId, afterGroupId) {
    const name = await this.host.promptText("New group", "", "Add");
    if (!name) return;
    const group = addGroup(this.layout, tabId, name, afterGroupId);
    if (!group) return;
    this.changed();
    this.pickCommand(group.id);
  }
  /* ---------- drag and drop (pointer events, so it also works with touch) ---------- */
  onPointerDown(e) {
    if (e.button !== 0 || !this.strip) return;
    const t = e.target;
    let press = null;
    const itemEl = t.closest("[data-item]");
    if (itemEl && this.strip.contains(itemEl)) {
      press = { kind: "item", id: itemEl.dataset.item, el: itemEl };
    } else if (this.editing) {
      const tabEl = t.closest(".onenote-tab[data-tab]");
      const groupEl = t.closest(".onr-group[data-group]");
      if (tabEl) press = { kind: "tab", id: tabEl.dataset.tab, el: tabEl, label: tabEl.textContent };
      else if (groupEl && this.strip.contains(groupEl) && t.closest(".onr-group-label, .onr-group-button")) {
        const found = findGroup(this.layout, groupEl.dataset.group);
        if (found) press = { kind: "group", id: found.group.id, el: groupEl, label: found.group.name };
      }
    }
    if (!press) return;
    press.x = e.clientX;
    press.y = e.clientY;
    this.press = press;
    const doc = this.doc;
    doc.addEventListener("pointermove", this.onPointerMove, true);
    doc.addEventListener("pointerup", this.onPointerUp, true);
    doc.addEventListener("pointercancel", this.onPointerUp, true);
    doc.addEventListener("keydown", this.onDragKey, true);
  }
  onPointerMove(e) {
    const p = this.press;
    if (!p) return;
    if (!this.drag) {
      if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < DRAG_THRESHOLD) return;
      this.startDrag(p);
    }
    const d = this.drag;
    d.ghost.style.left = e.clientX + 10 + "px";
    d.ghost.style.top = e.clientY + 12 + "px";
    this.updateDropTarget(e.clientX, e.clientY);
  }
  startDrag(p) {
    this.closePopover();
    const doc = this.doc;
    let ghost;
    if (p.kind === "item") {
      ghost = p.el.cloneNode(true);
      ghost.removeAttribute("data-item");
      ghost.removeAttribute("aria-label");
      ghost.addClass("onr-ghost");
      doc.body.appendChild(ghost);
    } else {
      ghost = doc.body.createDiv({ cls: "onr-ghost-chip", text: p.label });
    }
    const line = doc.body.createDiv("onr-drop-line");
    p.el.addClass("is-drag-source");
    this.topBar.addClass("is-dragging");
    this.drag = { kind: p.kind, id: p.id, ghost, line, target: null, hoverTab: null, hoverTimer: 0 };
  }
  updateDropTarget(x, y) {
    const d = this.drag;
    const doc = this.doc;
    d.target = null;
    d.line.style.display = "none";
    doc.querySelectorAll(".onr-group.is-drop-target").forEach((g) => g.removeClass("is-drop-target"));
    const under = doc.elementFromPoint(x, y);
    const tabEl = under && under.closest(".onenote-tab[data-tab]");
    const tabId = tabEl ? tabEl.dataset.tab : null;
    const edge = (r, before) => {
      const s = d.line.style;
      s.display = "block";
      s.left = (before ? r.left - 1 : r.right - 1) + "px";
      s.top = r.top + "px";
      s.width = "2px";
      s.height = r.height + "px";
    };
    if (d.kind === "tab") {
      if (!tabEl || tabId === d.id) return;
      const r = tabEl.getBoundingClientRect();
      const before = x < r.left + r.width / 2;
      d.target = { tabId, after: !before };
      edge(r, before);
      return;
    }
    if (tabId !== d.hoverTab) {
      window.clearTimeout(d.hoverTimer);
      d.hoverTab = tabId;
      const current = this.currentTab();
      if (tabId && (!current || current.id !== tabId)) {
        d.hoverTimer = window.setTimeout(() => {
          if (this.drag !== d) return;
          this.host.state.ribbonTab = tabId;
          this.render();
        }, TAB_HOVER_MS);
      }
    }
    if (!under || !this.strip || !this.strip.contains(under)) return;
    const groupEl = under.closest("[data-group]");
    if (d.kind === "group") {
      const tab = this.currentTab();
      if (!tab) return;
      if (!groupEl) {
        d.target = { tabId: tab.id };
        return;
      }
      if (groupEl.dataset.group === d.id) return;
      const index = tab.groups.findIndex((g) => g.id === groupEl.dataset.group);
      if (index < 0) return;
      const r = groupEl.getBoundingClientRect();
      const before = x < r.left + r.width / 2;
      d.target = { tabId: tab.id, index: index + (before ? 0 : 1) };
      edge(r, before);
      return;
    }
    if (!groupEl) return;
    const found = findGroup(this.layout, groupEl.dataset.group);
    if (!found) return;
    const itemEl = under.closest("[data-item]");
    if (itemEl && itemEl.dataset.item === d.id) return;
    if (itemEl) {
      const index = found.group.items.findIndex((i) => i.id === itemEl.dataset.item);
      const r = itemEl.getBoundingClientRect();
      const sideways = itemEl.hasClass("is-large");
      const before = sideways ? x < r.left + r.width / 2 : y < r.top + r.height / 2;
      d.target = { groupId: found.group.id, index: index + (before ? 0 : 1) };
      const s = d.line.style;
      s.display = "block";
      if (sideways) {
        s.left = (before ? r.left - 2 : r.right) + "px";
        s.top = r.top + "px";
        s.width = "2px";
        s.height = r.height + "px";
      } else {
        s.left = r.left + "px";
        s.top = (before ? r.top - 1 : r.bottom - 1) + "px";
        s.width = r.width + "px";
        s.height = "2px";
      }
      return;
    }
    d.target = { groupId: found.group.id };
    groupEl.addClass("is-drop-target");
  }
  onPointerUp() {
    const d = this.drag;
    const target = d && d.target;
    this.cancelDrag();
    if (!d) return;
    this.suppressClick = true;
    window.setTimeout(() => {
      this.suppressClick = false;
    }, 0);
    let moved = false;
    if (target && d.kind === "item") moved = moveItem(this.layout, d.id, target.groupId, target.index);
    else if (target && d.kind === "group") moved = moveGroupTo(this.layout, d.id, target.tabId, target.index);
    else if (target && d.kind === "tab") moved = moveTabNextTo(this.layout, d.id, target.tabId, target.after);
    if (moved) this.changed();
    else this.render();
  }
  onDragKey(e) {
    if (e.key !== "Escape" || !this.drag) return;
    e.preventDefault();
    e.stopPropagation();
    this.cancelDrag();
    this.render();
  }
  cancelDrag() {
    const doc = this.doc;
    doc.removeEventListener("pointermove", this.onPointerMove, true);
    doc.removeEventListener("pointerup", this.onPointerUp, true);
    doc.removeEventListener("pointercancel", this.onPointerUp, true);
    doc.removeEventListener("keydown", this.onDragKey, true);
    this.press = null;
    const d = this.drag;
    this.drag = null;
    if (!d) return;
    window.clearTimeout(d.hoverTimer);
    d.ghost.remove();
    d.line.remove();
    doc.querySelectorAll(".is-drag-source").forEach((x) => x.removeClass("is-drag-source"));
    doc.querySelectorAll(".onr-group.is-drop-target").forEach((g) => g.removeClass("is-drop-target"));
    if (this.topBar) this.topBar.removeClass("is-dragging");
  }
};

// src/ribbon/defaults.js
var O = "onenote-style:";
var L = (command, label, icon2, color) => ({ command, label, icon: icon2, size: "large", color });
var S = (command, label, icon2, color) => ({ command, label, icon: icon2, size: "small", color });
var G = (id, name, items, priority) => ({ id, name, priority: priority || "normal", items });
var T = (id, name, groups) => ({ id, name, groups });
var TABS = [
  T("home", "Home", [
    G("home-clipboard", "Clipboard", [
      L(O + "paste", "Paste", "clipboard-paste"),
      S(O + "cut", "Cut", "scissors"),
      S(O + "copy", "Copy", "copy"),
      S("editor:clear-formatting", "Clear", "eraser", "pink")
    ], "last"),
    G("home-text", "Basic Text", [
      S("editor:toggle-bold", "Bold", "bold"),
      S("editor:toggle-italics", "Italic", "italic"),
      S(O + "underline", "Underline", "underline"),
      S("editor:toggle-strikethrough", "Strike", "strikethrough"),
      S(O + "highlight-color", "Highlight", "highlighter", "yellow"),
      S(O + "font-color", "Font Color", "baseline", "red"),
      S(O + "subscript", "Subscript", "subscript"),
      S(O + "superscript", "Superscript", "superscript"),
      S("editor:toggle-code", "Code", "code")
    ], "last"),
    G("home-paragraph", "Paragraph", [
      S("editor:toggle-bullet-list", "Bullets", "list"),
      S("editor:toggle-numbered-list", "Numbering", "list-ordered"),
      S("editor:toggle-checklist-status", "Checkbox", "list-checks"),
      S("editor:unindent-list", "Outdent", "outdent"),
      S("editor:indent-list", "Indent", "indent"),
      S("editor:toggle-blockquote", "Quote", "quote")
    ]),
    G("home-styles", "Styles", [
      S(O + "heading-1", "Heading 1", "heading-1", "blue"),
      S(O + "heading-2", "Heading 2", "heading-2", "blue"),
      S(O + "heading-3", "Heading 3", "heading-3", "blue"),
      S(O + "heading-4", "Heading 4", "heading-4", "blue"),
      S(O + "normal", "Normal", "pilcrow")
    ]),
    G("home-tags", "Tags", [
      L(O + "tag-todo", "To Do", "check-square", "blue"),
      S(O + "tag-important", "Important", "star", "yellow"),
      S(O + "tag-question", "Question", "help-circle", "purple"),
      S(O + "tag-remember", "Remember", "bookmark", "orange"),
      S(O + "tag-definition", "Definition", "book-open", "green"),
      S(O + "tag-idea", "Idea", "lightbulb", "yellow"),
      S(O + "find-tags", "Find Tags", "search-check")
    ]),
    G("home-pages", "Pages", [
      L(O + "new-page", "New Page", "file-plus"),
      S(O + "new-subpage", "New Subpage", "corner-down-right"),
      S(O + "make-subpage", "Make Subpage", "indent"),
      S(O + "promote-subpage", "Promote", "outdent")
    ]),
    G("home-ai", "AI", [
      L("ai-chatbridge:sync-all-chats", "Sync All", "refresh-cw"),
      L("ai-chatbridge:stop-sync", "Stop All", "square", "red"),
      S("ai-chatbridge:sync-claude-chats", "Claude", "onenote-ai-claude", "orange"),
      S("ai-chatbridge:sync-chatgpt-chats", "ChatGPT", "onenote-ai-openai", "green"),
      S("ai-chatbridge:sync-gemini-chats", "Gemini", "sparkles", "blue"),
      S("ai-chatbridge:sync-lumo-chats", "Lumo", "onenote-ai-lumo", "purple"),
      S("ai-chatbridge:sync-desktop-app-chats", "Desktop Apps", "monitor"),
      S("ai-chatbridge:sync-hermes-chats", "Hermes", "bot")
    ], "first"),
    G("home-appearance", "Appearance", [
      L("theme:toggle-light-dark", "Light / Dark", "sun-moon"),
      S(O + "use-light-mode", "Light", "sun", "yellow"),
      S(O + "use-dark-mode", "Dark", "moon", "blue"),
      S("theme:switch", "Theme", "palette", "purple")
    ], "first")
  ]),
  T("insert", "Insert", [
    G("insert-tables", "Tables", [
      L(O + "insert-table-grid", "Table", "table")
    ]),
    G("insert-files", "Files", [
      L("editor:attach-file", "Attachment", "paperclip"),
      S("editor:insert-embed", "Embed Page", "file-input"),
      S("insert-template", "Template", "layout-template"),
      S("obsidian-excalidraw-plugin:excalidraw-autocreate-and-embed", "Drawing", "pencil-ruler")
    ]),
    G("insert-links", "Links", [
      L("editor:insert-link", "Link", "link"),
      S("editor:insert-wikilink", "Page Link", "file-symlink"),
      S("editor:insert-tag", "Tag", "tag", "cyan"),
      S("editor:insert-footnote", "Footnote", "file-signature")
    ]),
    G("insert-stamp", "Time Stamp", [
      S(O + "insert-date", "Date", "calendar", "blue"),
      S(O + "insert-time", "Time", "clock", "blue"),
      S(O + "insert-datetime", "Date & Time", "calendar-clock", "blue")
    ]),
    G("insert-blocks", "Blocks", [
      S("editor:insert-callout", "Callout", "message-square", "cyan"),
      S("editor:insert-codeblock", "Code Block", "code-2"),
      S("editor:insert-horizontal-rule", "Divider", "minus"),
      S("editor:toggle-blockquote", "Quote", "quote"),
      S("editor:insert-mathblock", "Equation", "sigma", "purple"),
      S("editor:toggle-inline-math", "Inline Math", "square-function")
    ]),
    G("insert-symbols", "Symbols", [
      L(O + "insert-symbol", "Symbol", "omega")
    ]),
    G("insert-pages", "Pages", [
      L(O + "new-canvas-page", "Canvas Page", "layout-dashboard"),
      S("bases:insert", "Base", "layout-list"),
      S(O + "new-page", "New Page", "file-plus")
    ])
  ]),
  T("view", "View", [
    G("view-views", "Views", [
      L("markdown:toggle-preview", "Read / Edit", "book-open"),
      L(O + "full-page-view", "Full Page", "maximize-2"),
      S("editor:toggle-source", "Source Mode", "code-2"),
      S("editor:toggle-readable-line-length", "Line Width", "ruler"),
      S("editor:toggle-line-numbers", "Line Numbers", "list-ordered")
    ]),
    G("view-zoom", "Zoom", [
      L("window:zoom-in", "Zoom In", "zoom-in"),
      L("window:zoom-out", "Zoom Out", "zoom-out"),
      L("window:reset-zoom", "100%", "scan")
    ], "last"),
    G("view-page", "Page Setup", [
      S(O + "page-color", "Page Color", "paint-bucket", "orange"),
      S(O + "rule-lines", "Rule Lines", "align-justify"),
      S(O + "page-width", "Page Width", "move-horizontal")
    ]),
    G("view-panes", "Show", [
      S("app:toggle-left-sidebar", "Left Sidebar", "panel-left"),
      S("app:toggle-right-sidebar", "Right Sidebar", "panel-right"),
      S(O + "toggle-section-tabs", "Section Tabs", "folder-kanban"),
      S("outline:open", "Outline", "list-tree"),
      S("properties:open-local", "Properties", "info"),
      S("app:toggle-ribbon", "Icon Strip", "panel-left-dashed")
    ]),
    G("view-window", "Window", [
      S("workspace:split-vertical", "Split Right", "separator-vertical"),
      S("workspace:split-horizontal", "Split Down", "separator-horizontal"),
      S("workspace:open-in-new-window", "New Window", "app-window"),
      S("workspace:toggle-stacked-tabs", "Stacked Tabs", "layers"),
      S("workspace:toggle-pin", "Pin Tab", "pin"),
      S("window:toggle-always-on-top", "Always on Top", "arrow-up-to-line")
    ]),
    G("view-folding", "Folding", [
      S("editor:fold-all", "Fold All", "chevrons-down-up"),
      S("editor:unfold-all", "Unfold All", "chevrons-up-down"),
      S("editor:toggle-fold", "Fold Line", "fold-vertical")
    ], "first")
  ]),
  T("table", "Table", [
    G("table-insert", "Table", [
      L("editor:insert-table", "Insert Table", "table"),
      L(O + "insert-table-grid", "Table Grid", "layout-grid")
    ]),
    G("table-rows", "Rows", [
      S("editor:table-row-before", "Add Above", "arrow-up-to-line", "green"),
      S("editor:table-row-after", "Add Below", "arrow-down-to-line", "green"),
      S("editor:table-row-delete", "Delete Row", "trash-2", "red"),
      S("editor:table-row-up", "Move Up", "arrow-up"),
      S("editor:table-row-down", "Move Down", "arrow-down"),
      S("editor:table-row-copy", "Duplicate", "copy")
    ]),
    G("table-columns", "Columns", [
      S("editor:table-col-before", "Add Left", "arrow-left-to-line", "green"),
      S("editor:table-col-after", "Add Right", "arrow-right-to-line", "green"),
      S("editor:table-col-delete", "Delete Column", "trash-2", "red"),
      S("editor:table-col-left", "Move Left", "arrow-left"),
      S("editor:table-col-right", "Move Right", "arrow-right"),
      S("editor:table-col-copy", "Duplicate", "copy")
    ]),
    G("table-align", "Alignment", [
      S("editor:table-col-align-left", "Left", "align-left"),
      S("editor:table-col-align-center", "Center", "align-center"),
      S("editor:table-col-align-right", "Right", "align-right")
    ]),
    G("table-convert", "Convert", [
      S("editing-toolbar:list-to-table", "List to Table", "table-properties"),
      S("editing-toolbar:table-to-list", "Table to List", "list")
    ], "first")
  ]),
  T("navigate", "Navigate", [
    G("nav-history", "History", [
      L("app:go-back", "Back", "arrow-left"),
      L("app:go-forward", "Forward", "arrow-right")
    ], "last"),
    G("nav-find", "Find", [
      L("switcher:open", "Quick Switcher", "navigation"),
      S("global-search:open", "Search Vault", "search"),
      S("omnisearch:show-modal", "Omnisearch", "scan-search"),
      S("editor:open-search", "Find in Page", "text-search")
    ]),
    G("nav-pages", "Pages", [
      S(O + "prev-page", "Previous Page", "chevron-up"),
      S(O + "next-page", "Next Page", "chevron-down"),
      S("file-explorer:reveal-active-file", "Show in List", "locate"),
      S(O + "prev-section", "Previous Section", "chevrons-up"),
      S(O + "next-section", "Next Section", "chevrons-down"),
      S("notebook-navigator:open", "Navigator", "compass")
    ]),
    G("nav-tabs", "Tabs", [
      S("workspace:previous-tab", "Previous Tab", "arrow-left"),
      S("workspace:next-tab", "Next Tab", "arrow-right"),
      S("workspace:new-tab", "New Tab", "plus", "green"),
      S("workspace:close", "Close Tab", "x", "red"),
      S("workspace:undo-close-pane", "Reopen Tab", "undo-2"),
      S("workspace:close-others", "Close Others", "copy-x")
    ]),
    G("nav-daily", "Daily Notes", [
      L("daily-notes", "Today", "calendar-days"),
      S("daily-notes:goto-prev", "Previous Day", "calendar-minus"),
      S("daily-notes:goto-next", "Next Day", "calendar-plus")
    ]),
    G("nav-links", "Links", [
      S("editor:follow-link", "Follow Link", "link"),
      S("editor:open-link-in-new-split", "Open to the Right", "columns-2"),
      S("bookmarks:open", "Bookmarks", "bookmark", "orange")
    ], "first")
  ]),
  T("templates", "Templates", [
    G("tpl-templates", "Templates", [
      L("insert-template", "Insert Template", "layout-template"),
      S("insert-current-date", "Insert Date", "calendar-days"),
      S("insert-current-time", "Insert Time", "clock"),
      S("notebook-navigator:new-note-from-template", "Note from Template", "file-plus-2")
    ]),
    G("tpl-new", "New", [
      L(O + "new-page", "New Page", "file-plus"),
      S("file-explorer:new-file", "New Note", "file"),
      S(O + "new-section", "New Section", "folder-plus"),
      S(O + "new-notebook", "New Notebook", "book-plus")
    ]),
    G("tpl-properties", "Properties", [
      S("markdown:add-metadata-property", "Add Property", "plus-circle"),
      S("markdown:add-alias", "Add Alias", "forward"),
      S("properties:open-local", "File Properties", "info")
    ])
  ]),
  T("canvas", "Canvas", [
    G("canvas-canvas", "Canvas", [
      L("canvas:new-file", "New Canvas", "layout-dashboard"),
      S(O + "new-canvas-page", "Canvas Page", "file-plus"),
      S("canvas:jump-to-group", "Jump to Group", "move"),
      S("canvas:convert-to-file", "Convert to File", "file-input"),
      S("canvas:export-as-image", "Export Image", "image")
    ]),
    G("canvas-excalidraw", "Excalidraw", [
      L("obsidian-excalidraw-plugin:excalidraw-autocreate", "New Drawing", "pencil-ruler"),
      S("obsidian-excalidraw-plugin:excalidraw-autocreate-and-embed", "Embed Drawing", "image-plus"),
      S("obsidian-excalidraw-plugin:excalidraw-open", "Open Drawing", "folder-open"),
      S("obsidian-excalidraw-plugin:toggle-excalidraw-view", "Drawing / Text", "repeat")
    ]),
    G("canvas-graph", "Graph", [
      L("graph:open", "Graph View", "git-fork"),
      S("graph:open-local", "Local Graph", "git-branch")
    ])
  ]),
  T("references", "References", [
    G("ref-links", "Links", [
      L("editor:insert-link", "Link", "link"),
      S("editor:insert-wikilink", "Page Link", "file-symlink"),
      S("editor:insert-embed", "Embed", "file-input"),
      S("editor:insert-footnote", "Footnote", "file-signature")
    ]),
    G("ref-backlinks", "Linked Pages", [
      L("backlink:open-backlinks", "Backlinks", "links-coming-in"),
      S("outgoing-links:open-for-current", "Outgoing Links", "links-going-out"),
      S("backlink:toggle-backlinks-in-document", "Show in Page", "file-text"),
      S("graph:open-local", "Local Graph", "git-branch")
    ]),
    G("ref-tags", "Tags", [
      S("editor:insert-tag", "Add Tag", "tag", "cyan"),
      S("tag-pane:open", "All Tags", "tags")
    ]),
    G("ref-bookmarks", "Bookmarks", [
      S("bookmarks:bookmark-current-view", "Bookmark", "bookmark-plus", "orange"),
      S("bookmarks:bookmark-current-heading", "Bookmark Heading", "heading"),
      S("bookmarks:open", "All Bookmarks", "bookmark", "orange")
    ]),
    G("ref-copy", "Copy", [
      S("workspace:copy-path", "Copy Path", "copy"),
      S("workspace:copy-url", "Copy Link", "link-2")
    ], "first")
  ]),
  T("review", "Review", [
    G("review-proofing", "Proofing", [
      L("editor:toggle-spellcheck", "Spelling", "spell-check")
    ]),
    G("review-find", "Find", [
      S("editor:open-search", "Find", "search"),
      S("editor:open-search-replace", "Replace", "replace"),
      S("global-search:open", "Search Vault", "folder-search")
    ]),
    G("review-comments", "Comments", [
      L("editor:toggle-comments", "Comment", "message-square-dashed")
    ]),
    G("review-tasks", "Tags and Tasks", [
      L(O + "find-tags", "Tags Summary", "search-check"),
      S("obsidian-tasks-plugin:toggle-done", "Toggle Done", "check-circle", "green"),
      S("obsidian-tasks-plugin:edit-task", "Edit Task", "pencil"),
      S(O + "remove-tags", "Remove Tags", "eraser", "pink")
    ]),
    G("review-cleanup", "Clean Up", [
      S("editing-toolbar:remove-whitespace-trim", "Trim Line Ends", "align-left"),
      S("editing-toolbar:remove-blank-lines", "Remove Blank Lines", "fold-vertical"),
      S("editing-toolbar:dedupe-lines", "Remove Duplicates", "list-x")
    ], "first"),
    G("review-history", "History", [
      L("file-recovery:open", "Local History", "history"),
      S("workspace:show-trash", "Deleted Files", "trash-2", "red"),
      S("workspace:undo-close-pane", "Reopen Tab", "undo-2")
    ])
  ]),
  T("data", "Data", [
    G("data-bases", "Bases", [
      L("bases:new-file", "New Base", "layout-list"),
      S("bases:insert", "Insert Base", "between-horizontal-start"),
      S("bases:add-view", "Add View", "shapes"),
      S("bases:add-item", "Add Item", "plus"),
      S("bases:change-view", "Change View", "arrow-left-right"),
      S("bases:copy-table", "Copy Table", "copy")
    ]),
    G("data-properties", "Properties", [
      L("properties:open-local", "File Properties", "info"),
      S("markdown:add-metadata-property", "Add Property", "plus-circle"),
      S("properties:open", "All Properties", "archive"),
      S("markdown:add-alias", "Add Alias", "forward")
    ]),
    G("data-tasks", "Tasks", [
      S("obsidian-tasks-plugin:edit-task", "Create / Edit Task", "pencil"),
      S("obsidian-tasks-plugin:toggle-done", "Toggle Done", "check-circle", "green"),
      S(O + "find-tags", "Tags Summary", "search-check")
    ]),
    G("data-convert", "Convert", [
      S("editing-toolbar:list-to-table", "List to Table", "table-properties"),
      S("editing-toolbar:table-to-list", "Table to List", "list")
    ], "first")
  ]),
  T("slides", "Slides", [
    G("slides-show", "Slide Show", [
      L("slides:start", "Start Presentation", "presentation")
    ]),
    G("slides-edit", "Slides", [
      S("editor:insert-horizontal-rule", "Slide Break", "minus"),
      S("markdown:toggle-preview", "Read / Edit", "book-open"),
      S(O + "full-page-view", "Full Page", "maximize-2")
    ]),
    G("slides-export", "Export", [
      L("workspace:export-pdf", "Export to PDF", "file-down")
    ])
  ]),
  T("utilities", "Utilities", [
    G("util-obsidian", "Obsidian", [
      L("app:open-settings", "Settings", "settings"),
      L("command-palette:open", "Command Palette", "terminal-square"),
      S(O + "open-community-plugins", "Plugins", "puzzle"),
      S(O + "open-ai-chatbridge-settings", "ChatBridge", "message-square-text"),
      S("app:open-help", "Help", "help-circle")
    ], "last"),
    G("util-file", "File", [
      S("workspace:edit-file-title", "Rename", "pencil"),
      S("file-explorer:move-file", "Move", "folder-input"),
      S("file-explorer:duplicate-file", "Duplicate", "files"),
      S("workspace:export-pdf", "Export PDF", "file-down"),
      S("open-with-default-app:show", "Show in Explorer", "folder-open"),
      S("open-with-default-app:open", "Open in App", "arrow-up-right")
    ]),
    G("util-text", "Text Tools", [
      S("editing-toolbar:merge-lines", "Merge Lines", "fold-vertical"),
      S("editing-toolbar:split-lines", "Split Lines", "unfold-vertical"),
      S("editing-toolbar:number-lines", "Number Lines", "list-ordered"),
      S("editing-toolbar:get-plain-text", "Plain Text", "type"),
      S("editing-toolbar:toggle-format-brush", "Format Brush", "paintbrush"),
      S("editing-toolbar:toggle-top-toolbar", "Editing Toolbar", "panel-top")
    ]),
    G("util-ribbon", "Ribbon", [
      S(O + "ribbon-export", "Export Layout", "download"),
      S(O + "ribbon-import", "Import Layout", "upload"),
      S(O + "ribbon-reset", "Reset Ribbon", "rotate-ccw", "red")
    ], "first")
  ])
];
function defaultLayout() {
  return normalizeLayout({ tabs: JSON.parse(JSON.stringify(TABS)) });
}

// src/main.js
var NOTEBOOKS_VIEW = "onenote-notebooks";
var PAGES_VIEW = "onenote-pages";
var DRAG_TYPE = "text/x-onenote-page";
var SECTION_COLORS = [
  "#8AA8E4",
  "#91BAAE",
  "#F6B078",
  "#EE9597",
  "#F5D277",
  "#B49EDE",
  "#9FDDE2",
  "#BAD37C",
  "#E7A4D5",
  "#A9C3D9",
  "#D5B59C",
  "#C4C4C4"
];
var PAGE_COLORS = [
  { name: "No Color", value: "" },
  { name: "Blue", value: "#DCE9F7" },
  { name: "Yellow", value: "#FFF6CC" },
  { name: "Green", value: "#E1F2D9" },
  { name: "Pink", value: "#FADDE7" },
  { name: "Purple", value: "#EBE1F4" },
  { name: "Orange", value: "#FDE6D2" },
  { name: "Teal", value: "#D6F0EE" },
  { name: "Gray", value: "#ECECEC" }
];
var FONT_COLORS = [
  "#000000",
  "#7F7F7F",
  "#C00000",
  "#FF0000",
  "#FFC000",
  "#FFD700",
  "#92D050",
  "#00B050",
  "#00B0F0",
  "#0070C0",
  "#002060",
  "#7030A0",
  "#7719AA",
  "#FF00FF",
  "#996633",
  "#FFFFFF"
];
var HIGHLIGHT_COLORS = [
  { name: "Yellow", value: "" },
  // plain ==highlight==
  { name: "Bright Green", value: "#9BF59B" },
  { name: "Turquoise", value: "#8FF0F0" },
  { name: "Pink", value: "#FFA6E9" },
  { name: "Blue", value: "#A6C8FF" },
  { name: "Orange", value: "#FFC48A" },
  { name: "Red", value: "#FF9C9C" },
  { name: "Gray", value: "#D0D0D0" }
];
var BRAND_ICONS = {
  "onenote-ai-claude": '<g transform="scale(4.1667)" fill="currentColor" stroke="none"><path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z"/></g>',
  "onenote-ai-openai": '<g transform="scale(4.1667)" fill="currentColor" stroke="none"><path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"/></g>',
  "onenote-ai-codex": '<g fill="none" stroke="currentColor" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"><path d="M66.1 17.7A18.0 18.0 0 0 1 86.1 42.8A18.0 18.0 0 0 1 78.9 74.1A18.0 18.0 0 0 1 50.0 88.0A18.0 18.0 0 0 1 21.1 74.1A18.0 18.0 0 0 1 13.9 42.8A18.0 18.0 0 0 1 33.9 17.7A18.0 18.0 0 0 1 66.1 17.7Z"/><path d="M35 40l11 11-11 11"/><path d="M53 63h13"/></g>',
  "onenote-ai-lumo": '<g transform="scale(1.5625)" fill="currentColor" stroke="none"><path d="M42.4499 12.1097L49.6457 7.48831C52.1406 5.8859 55.4516 7.43191 55.8298 10.3713L57.5715 23.9337L42.4465 12.1097H42.4499Z"/><path d="M22.9165 12.1097L15.7206 7.48831C13.2257 5.8859 9.91475 7.43191 9.53654 10.3713L7.7948 23.9337L22.9198 12.1097H22.9165Z"/><path d="M46.5833 39.8431C48.3991 39.8431 49.871 37.4443 49.871 34.4852C49.871 31.5261 48.3991 29.1273 46.5833 29.1273C44.7675 29.1273 43.2955 31.5261 43.2955 34.4852C43.2955 37.4443 44.7675 39.8431 46.5833 39.8431Z"/><path d="M18.7383 40.2558C20.5541 40.2558 22.0261 37.857 22.0261 34.8979C22.0261 31.9387 20.5541 29.5399 18.7383 29.5399C16.9225 29.5399 15.4506 31.9387 15.4506 34.8979C15.4506 37.857 16.9225 40.2558 18.7383 40.2558Z"/><path fill-rule="evenodd" d="M62.5401 38.1462C62.5401 51.9873 46.1147 56.9206 32.413 56.9206C20.37 56.9206 2.28577 51.9873 2.28577 38.1462C2.28577 24.3052 15.7752 10.3148 32.413 10.3148C49.0508 10.3148 62.5401 24.3052 62.5401 38.1462Z M47.1845 42.6603C52.1662 40.5117 54.6588 35.1856 52.7519 30.7641C50.845 26.3426 45.2606 24.5 40.2788 26.6486C35.2971 28.7972 32.8044 34.1233 34.7114 38.5448C36.6183 42.9663 42.2027 44.8088 47.1845 42.6603Z M24.7442 38.542C26.6511 34.1205 24.1585 28.7944 19.1768 26.6458C14.195 24.4973 8.61062 26.3398 6.70368 30.7613C4.79674 35.1828 7.28936 40.5089 12.2711 42.6575C17.2529 44.8061 22.8373 42.9635 24.7442 38.542Z"/></g>'
};
var AI_PLUGIN = "ai-chatbridge";
var TAGS = [
  { id: "todo", name: "To Do", char: " ", icon: "check-square", key: "1" },
  { id: "important", name: "Important", char: "!", icon: "star", key: "2" },
  { id: "question", name: "Question", char: "?", icon: "help-circle", key: "3" },
  { id: "remember", name: "Remember for later", char: "*", icon: "highlighter", key: "4" },
  { id: "definition", name: "Definition", char: "d", icon: "book-open", key: "5" },
  { id: "idea", name: "Idea", char: "i", icon: "lightbulb", key: "6" }
];
var RULE_LINES = [
  { id: "none", name: "No Rule Lines" },
  { id: "narrow", name: "Narrow Ruled" },
  { id: "college", name: "College Ruled" },
  { id: "standard", name: "Standard Ruled" },
  { id: "wide", name: "Wide Ruled" },
  { id: "grid-small", name: "Small Grid" },
  { id: "grid-large", name: "Large Grid" }
];
var PAGE_WIDTHS = [
  { id: "normal", name: "Normal" },
  { id: "wide", name: "Wide" },
  { id: "full", name: "Full width" }
];
var SYMBOLS = [
  "\xA9",
  "\xAE",
  "\u2122",
  "\xB0",
  "\xB1",
  "\xD7",
  "\xF7",
  "\u2248",
  "\u2260",
  "\u2264",
  "\u2265",
  "\u221E",
  "\u221A",
  "\u03C0",
  "\xB5",
  "\u03A9",
  "\u20AC",
  "\xA3",
  "\xA5",
  "\xA2",
  "\xA7",
  "\xB6",
  "\u2022",
  "\u2026",
  "\u2192",
  "\u2190",
  "\u2191",
  "\u2193",
  "\u2194",
  "\u21D2",
  "\u2713",
  "\u2717",
  "\u2605",
  "\u2606",
  "\u2665",
  "\u263A",
  "\xBD",
  "\xBC",
  "\xBE",
  "\xB2",
  "\xB3",
  "\xAB",
  "\xBB",
  "\u2014",
  "\u2013",
  "\xBF",
  "\xA1",
  "\u2020"
];
var DEFAULT_SETTINGS = {
  notebookMode: "folders",
  // 'folders': top-level folders are notebooks; 'vault': the vault is one notebook
  excludedFolders: "",
  pagesPanePosition: "docked",
  // under the file list, so subpages are always visible
  applyTheme: true,
  showRibbon: true,
  showSectionTabs: true,
  showNavigation: false,
  // notebooks/pages panes; off because Fluent OneNote + Notebook Navigator handle navigation
  showPageDate: true,
  hideObsidianRibbon: false,
  pageFont: 'Calibri, Carlito, "Segoe UI", sans-serif',
  uiFont: '"Segoe UI", system-ui, sans-serif',
  fontSize: 15,
  ruleLines: "none",
  pageColor: "",
  pageWidth: "wide",
  newPageName: "Untitled Page",
  dateFormat: "dddd, MMMM D, YYYY",
  timeFormat: "h:mm A"
};
var DEFAULT_STATE = {
  notebook: null,
  section: null,
  ribbonTab: "home",
  ribbonCollapsed: false,
  panesInitialized: false
};
var MAP_KEYS = ["colors", "order", "levels", "lastPage", "lastSection", "expanded"];
var TASK_RE = /^(\s*)(?:((?:[-*+]|\d+[.)])\s+)(?:\[(.)\]\s?)?)?(.*)$/;
function icon(el, name, fallback) {
  (0, import_obsidian3.setIcon)(el, name);
  if (!el.querySelector("svg")) el.setText(fallback || "\u2022");
}
function byName(a, b) {
  return a.name.localeCompare(b.name, void 0, { numeric: true, sensitivity: "base" });
}
function isInside(folder, child) {
  if (!folder || !child) return false;
  if (folder === child) return true;
  if (folder.isRoot()) return true;
  return child.path.startsWith(folder.path + "/");
}
function isPageFile(f) {
  return f instanceof import_obsidian3.TFile && (f.extension === "md" || f.extension === "canvas");
}
function mapLines(editor, fn) {
  const from = editor.getCursor("from");
  const to = editor.getCursor("to");
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
      text: next.slice(0, next.length - s)
    });
  }
  if (changes.length) editor.transaction({ changes });
}
function toggleTagLine(text, char) {
  const [, indent, marker, cur, rest] = text.match(TASK_RE);
  if (cur !== void 0) {
    const same = cur === char || char === " " && (cur === "x" || cur === "X");
    if (same) return /^\d/.test(marker) ? indent + marker + rest : indent + rest;
    return indent + marker + "[" + char + "] " + rest;
  }
  if (marker) return indent + marker + "[" + char + "] " + rest;
  return indent + "- [" + char + "] " + rest;
}
function styleLine(text, style) {
  const t = text.replace(/^\s*#{1,6}\s+/, "").replace(/^\s*>\s?/, "");
  if (typeof style === "number" && style > 0) return "#".repeat(style) + " " + t;
  if (style === "quote") return "> " + t;
  return t;
}
function wrap(editor, before, after) {
  const sel = editor.getSelection();
  const from = editor.getCursor("from");
  const to = editor.getCursor("to");
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
    editor.transaction({ changes: [{ from: to, to: postEnd, text: "" }, { from: preStart, to: from, text: "" }] });
    return;
  }
  editor.replaceSelection(before + sel + after);
  const endCh = to.line === from.line ? to.ch + before.length : to.ch;
  editor.setSelection({ line: from.line, ch: from.ch + before.length }, { line: to.line, ch: endCh });
}
function clearFormatting(s) {
  return s.replace(/<\/?(?:u|sub|sup|mark|span|font|b|i|s|strong|em)\b[^>]*>/gi, "").replace(/(\*\*|__|~~|==)/g, "").replace(/(?<![\w*\\])[*_](\S(?:[^\n]*?\S)?)[*_](?![\w*])/g, "$1");
}
function insertBlock(editor, text, cursorOffset) {
  const c = editor.getCursor();
  const line = editor.getLine(c.line);
  let start;
  let prefix = "";
  if (line.trim()) {
    start = { line: c.line, ch: line.length };
    prefix = "\n";
  } else {
    start = { line: c.line, ch: 0 };
  }
  editor.replaceRange(prefix + text + "\n", start, line.trim() ? start : { line: c.line, ch: line.length });
  const base = editor.posToOffset(start) + prefix.length;
  editor.setCursor(editor.offsetToPos(base + (cursorOffset == null ? text.length + 1 : cursorOffset)));
}
function tableMarkdown(rows, cols) {
  const head = "| " + Array.from({ length: cols }, (_, i) => "Column " + (i + 1)).join(" | ") + " |";
  const sep = "|" + " --- |".repeat(cols);
  const row = "|" + "     |".repeat(cols);
  return [head, sep].concat(Array(Math.max(1, rows - 1)).fill(row)).join("\n");
}
var PromptModal = class extends import_obsidian3.Modal {
  constructor(app, title, value, cta, resolve) {
    super(app);
    this.titleText = title;
    this.value = value || "";
    this.cta = cta || "OK";
    this.resolve = resolve;
    this.done = false;
  }
  onOpen() {
    this.titleEl.setText(this.titleText);
    const input = this.contentEl.createEl("input", { type: "text", cls: "onenote-prompt-input" });
    input.value = this.value;
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this.submit(input.value);
      }
    });
    const buttons = this.contentEl.createDiv("modal-button-container");
    buttons.createEl("button", { text: this.cta, cls: "mod-cta" }).onclick = () => this.submit(input.value);
    buttons.createEl("button", { text: "Cancel" }).onclick = () => this.close();
    setTimeout(() => {
      input.focus();
      input.select();
    }, 0);
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
};
function promptText(app, title, value, cta) {
  return new Promise((resolve) => new PromptModal(app, title, value, cta, resolve).open());
}
var ConfirmModal = class extends import_obsidian3.Modal {
  constructor(app, title, message, cta, resolve) {
    super(app);
    Object.assign(this, { titleText: title, message, cta, resolve, done: false });
  }
  onOpen() {
    this.titleEl.setText(this.titleText);
    this.contentEl.createEl("p", { text: this.message });
    const buttons = this.contentEl.createDiv("modal-button-container");
    buttons.createEl("button", { text: this.cta, cls: "mod-warning" }).onclick = () => {
      this.done = true;
      this.resolve(true);
      this.close();
    };
    buttons.createEl("button", { text: "Cancel" }).onclick = () => this.close();
  }
  onClose() {
    this.contentEl.empty();
    if (!this.done) this.resolve(false);
  }
};
function confirmAction(app, title, message, cta) {
  return new Promise((resolve) => new ConfirmModal(app, title, message, cta || "Delete", resolve).open());
}
var SectionSuggestModal = class extends import_obsidian3.FuzzySuggestModal {
  constructor(app, plugin, onChoose) {
    super(app);
    this.plugin = plugin;
    this.onChoose = onChoose;
    this.setPlaceholder("Move page to section...");
  }
  getItems() {
    return this.plugin.allSections();
  }
  getItemText(f) {
    return this.plugin.sectionLabel(f);
  }
  onChooseItem(f) {
    this.onChoose(f);
  }
};
var PageSuggestModal = class extends import_obsidian3.FuzzySuggestModal {
  constructor(app, items, placeholder, onChoose) {
    super(app);
    this.items = items;
    this.onChoose = onChoose;
    this.setPlaceholder(placeholder);
  }
  getItems() {
    return this.items;
  }
  getItemText(f) {
    return f instanceof import_obsidian3.TFolder ? f.name : f.basename;
  }
  onChooseItem(f) {
    this.onChoose(f);
  }
};
var TagSummaryModal = class extends import_obsidian3.Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
    this.scope = "notebook";
    this.hideDone = false;
  }
  onOpen() {
    this.modalEl.addClass("onenote-tags-modal");
    this.titleEl.setText("Tags Summary");
    const bar = this.contentEl.createDiv("onenote-tags-toolbar");
    new import_obsidian3.Setting(bar).setName("Search").addDropdown((d) => d.addOption("notebook", "This notebook").addOption("section", "This section").addOption("all", "All notebooks").setValue(this.scope).onChange((v) => {
      this.scope = v;
      this.load();
    }));
    new import_obsidian3.Setting(bar).setName("Hide completed To Do items").addToggle((t) => t.setValue(this.hideDone).onChange((v) => {
      this.hideDone = v;
      this.load();
    }));
    this.listEl = this.contentEl.createDiv("onenote-tags-list");
    this.load();
  }
  async load() {
    const { app, plugin } = this;
    const listEl = this.listEl;
    listEl.empty();
    listEl.createDiv({ cls: "onenote-empty", text: "Collecting tags..." });
    const scopeFolder = this.scope === "notebook" ? plugin.currentNotebook : this.scope === "section" ? plugin.currentSection : null;
    const groups = new Map(TAGS.map((t) => [t.char, []]));
    for (const file of app.vault.getMarkdownFiles()) {
      if (scopeFolder && !(this.scope === "section" ? file.parent === scopeFolder : isInside(scopeFolder, file))) continue;
      const items = (app.metadataCache.getFileCache(file) || {}).listItems || [];
      const tagged = items.filter((li) => li.task !== void 0 && (groups.has(li.task) || (li.task === "x" || li.task === "X") && !this.hideDone));
      if (!tagged.length) continue;
      const lines = (await app.vault.cachedRead(file)).split("\n");
      for (const li of tagged) {
        const ln = li.position.start.line;
        const text = (lines[ln] || "").replace(/^\s*(?:[-*+]|\d+[.)])\s+\[.\]\s*/, "");
        const key = groups.has(li.task) ? li.task : " ";
        groups.get(key).push({ file, line: ln, text, done: li.task === "x" || li.task === "X" });
      }
    }
    listEl.empty();
    let total = 0;
    for (const tag of TAGS) {
      const entries = groups.get(tag.char);
      if (!entries.length) continue;
      total += entries.length;
      const head = listEl.createDiv("onenote-tags-group");
      const ic = head.createSpan({ cls: "onenote-tag-icon", attr: { "data-tag": tag.id } });
      icon(ic, tag.icon);
      head.createSpan({ text: `${tag.name} (${entries.length})` });
      for (const e of entries) {
        const row = listEl.createDiv({ cls: "onenote-tags-item" + (e.done ? " is-done" : "") });
        row.createDiv({ cls: "onenote-tags-text", text: e.text || "(empty)" });
        row.createDiv({ cls: "onenote-tags-page", text: plugin.sectionLabel(e.file.parent) + " \u203A " + e.file.basename });
        row.onclick = async () => {
          this.close();
          await app.workspace.getLeaf(false).openFile(e.file, { eState: { line: e.line } });
        };
      }
    }
    if (!total) listEl.createDiv({ cls: "onenote-empty", text: "No tagged notes found. Tag a line with Ctrl+1 \u2026 Ctrl+6." });
  }
  onClose() {
    this.contentEl.empty();
  }
};
var NotebooksView = class extends import_obsidian3.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() {
    return NOTEBOOKS_VIEW;
  }
  getDisplayText() {
    return "Notebooks";
  }
  getIcon() {
    return "book-open";
  }
  async onOpen() {
    this.render();
  }
  render() {
    const p = this.plugin;
    const el = this.contentEl;
    el.empty();
    el.addClass("onenote-nav");
    const head = el.createDiv("onenote-pane-header");
    head.createSpan({ text: "Notebooks" });
    if (p.settings.notebookMode === "folders") {
      const add = head.createDiv({ cls: "onenote-pane-header-btn", attr: { "aria-label": "New notebook" } });
      icon(add, "plus", "+");
      add.onclick = () => p.createNotebook();
    }
    const notebooks = p.getNotebooks();
    const current = p.currentNotebook;
    const curSection = p.currentSection;
    const list = el.createDiv("onenote-nb-list");
    if (!notebooks.length) {
      list.createDiv({ cls: "onenote-empty", text: "No notebooks yet. Each top-level folder in your vault becomes a notebook." });
      const btn = list.createEl("button", { text: "Create a notebook", cls: "mod-cta" });
      btn.onclick = () => p.createNotebook();
      return;
    }
    for (const nb of notebooks) {
      const expanded = p.state.expanded[nb.path] !== void 0 ? p.state.expanded[nb.path] : nb === current;
      const row = list.createDiv({ cls: "onenote-nb-row" + (nb === current ? " is-active" : "") });
      const chev = row.createSpan("onenote-chevron");
      icon(chev, expanded ? "chevron-down" : "chevron-right", expanded ? "\u25BE" : "\u25B8");
      const bi = row.createSpan("onenote-nb-icon");
      bi.style.color = p.colorOf(nb);
      icon(bi, "book", "\u{1F4D3}");
      row.createSpan({ cls: "onenote-nb-name", text: p.notebookName(nb) });
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
      const tree = list.createDiv("onenote-section-tree");
      if (p.getPages(nb).length) this.sectionRow(tree, nb, 0, curSection, true);
      for (const s of p.getSections(nb)) this.sectionTree(tree, s, 0, curSection);
      const add = tree.createDiv("onenote-add-row");
      icon(add.createSpan(), "plus", "+");
      add.createSpan({ text: "Add section" });
      add.onclick = () => p.createSection(nb);
    }
  }
  sectionTree(parent, folder, depth, curSection) {
    this.sectionRow(parent, folder, depth, curSection, false);
    for (const child of this.plugin.getSections(folder)) this.sectionTree(parent, child, depth + 1, curSection);
  }
  sectionRow(parent, folder, depth, curSection, unfiled) {
    const p = this.plugin;
    const row = parent.createDiv({ cls: "onenote-section-row" + (folder === curSection ? " is-active" : "") });
    row.style.paddingLeft = 22 + depth * 14 + "px";
    const sw = row.createSpan("onenote-section-swatch");
    sw.style.backgroundColor = unfiled ? "var(--text-faint)" : p.colorOf(folder);
    row.createSpan({ cls: "onenote-section-name", text: unfiled ? "Unfiled pages" : folder.name });
    row.onclick = () => p.openSection(folder);
    if (!unfiled) row.oncontextmenu = (e) => p.sectionMenu(e, folder);
    p.makeDropTarget(row, folder);
  }
};
var PagesView = class extends import_obsidian3.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() {
    return PAGES_VIEW;
  }
  getDisplayText() {
    return "Pages";
  }
  getIcon() {
    return "file-text";
  }
  async onOpen() {
    this.render();
  }
  render() {
    const p = this.plugin;
    const el = this.contentEl;
    el.empty();
    el.addClass("onenote-pages");
    const section = p.currentSection;
    const head = el.createDiv("onenote-pages-head");
    head.createDiv({ cls: "onenote-pages-title", text: section ? p.sectionDisplayName(section) : "No section selected" });
    const addRow = el.createDiv("onenote-add-page");
    const addMain = addRow.createDiv("onenote-add-page-main");
    icon(addMain.createSpan(), "plus", "+");
    addMain.createSpan({ text: "Add Page" });
    addMain.onclick = () => p.createPage();
    const addMore = addRow.createDiv({ cls: "onenote-add-page-more", attr: { "aria-label": "More page types" } });
    icon(addMore, "chevron-down", "\u25BE");
    addMore.onclick = (e) => {
      const m = new import_obsidian3.Menu();
      m.addItem((i) => i.setTitle("Page").setIcon("file-plus").onClick(() => p.createPage()));
      m.addItem((i) => i.setTitle("Subpage").setIcon("indent").onClick(() => p.createSubpage()));
      m.addItem((i) => i.setTitle("Free-form page (Canvas)").setIcon("layout-dashboard").onClick(() => p.createPage({ canvas: true })));
      m.showAtMouseEvent(e);
    };
    const list = el.createDiv("onenote-page-list");
    if (!section) return;
    p.makeDropTarget(list, section);
    const pages = p.getPages(section);
    if (!pages.length) {
      list.createDiv({ cls: "onenote-empty", text: 'This section is empty. Click "Add Page" to start writing.' });
      return;
    }
    const active = p.app.workspace.getActiveFile();
    for (const file of pages) {
      const level = p.levelOf(file);
      const item = list.createDiv({
        cls: "onenote-page-item" + (file === active ? " is-active" : ""),
        attr: { "data-level": String(level), draggable: "true" }
      });
      if (file.extension === "canvas") icon(item.createSpan("onenote-page-kind"), "layout-dashboard", "\u25A6");
      item.createSpan({ cls: "onenote-page-name", text: file.basename });
      item.setAttr("aria-label", (0, import_obsidian3.moment)(file.stat.ctime).format(p.settings.dateFormat + "  " + p.settings.timeFormat));
      item.setAttr("data-tooltip-position", "left");
      item.onclick = (e) => p.openPage(file, e.ctrlKey || e.metaKey);
      item.onauxclick = (e) => {
        if (e.button === 1) p.openPage(file, true);
      };
      item.oncontextmenu = (e) => p.pageMenu(e, file);
      item.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData(DRAG_TYPE, file.path);
        e.dataTransfer.effectAllowed = "move";
        item.addClass("is-dragging");
      });
      item.addEventListener("dragend", () => item.removeClass("is-dragging"));
      item.addEventListener("dragover", (e) => {
        if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
        e.preventDefault();
        e.stopPropagation();
        const after = e.offsetY > item.offsetHeight / 2;
        item.toggleClass("drop-before", !after);
        item.toggleClass("drop-after", after);
      });
      item.addEventListener("dragleave", () => {
        item.removeClass("drop-before");
        item.removeClass("drop-after");
      });
      item.addEventListener("drop", (e) => {
        const path = e.dataTransfer.getData(DRAG_TYPE);
        if (!path) return;
        e.preventDefault();
        e.stopPropagation();
        const after = item.hasClass("drop-after");
        item.removeClass("drop-before");
        item.removeClass("drop-after");
        p.dropPage(path, file, after);
      });
    }
  }
};
var OneNoteSettingTab = class extends import_obsidian3.PluginSettingTab {
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
    el.createEl("h3", { text: "Notebooks" });
    new import_obsidian3.Setting(el).setName("Notebook structure").setDesc("How vault folders map to OneNote notebooks and sections.").addDropdown((d) => d.addOption("folders", "Top-level folders are notebooks, subfolders are sections").addOption("vault", "The vault is one notebook, folders are sections").setValue(s.notebookMode).onChange(async (v) => {
      s.notebookMode = v;
      await changed();
      this.display();
    }));
    new import_obsidian3.Setting(el).setName("Excluded folders").setDesc("Comma-separated folder paths to hide from notebooks and sections (e.g. attachments, templates).").addText((t) => t.setValue(s.excludedFolders).onChange(async (v) => {
      s.excludedFolders = v;
      await changed();
    }));
    new import_obsidian3.Setting(el).setName("Own notebook and page panes").setDesc("Off: Fluent OneNote and Notebook Navigator handle navigation, and this plugin only provides the ribbon and tags.").addToggle((t) => t.setValue(s.showNavigation).onChange(async (v) => {
      s.showNavigation = v;
      await p.persist();
      await p.activatePanes(v);
    }));
    new import_obsidian3.Setting(el).setName("Page list position").setDesc("OneNote 2016 shows pages on the right; newer OneNote shows them on the left under the notebooks.").addDropdown((d) => d.addOption("docked", "Docked under the file list (always visible)").addOption("right", "Right sidebar").addOption("left", "Left sidebar, below notebooks").setValue(s.pagesPanePosition).onChange(async (v) => {
      s.pagesPanePosition = v;
      await p.persist();
      await p.activatePanes(true);
    })).addButton((b) => b.setButtonText("Reset panes").onClick(() => p.resetPanes()));
    el.createEl("h3", { text: "Look" });
    new import_obsidian3.Setting(el).setName("OneNote theme").setDesc("Purple accents, Segoe UI, OneNote-style page title and tag icons.").addToggle((t) => t.setValue(s.applyTheme).onChange(async (v) => {
      s.applyTheme = v;
      await changed();
    }));
    new import_obsidian3.Setting(el).setName("Show ribbon").setDesc("Home / Insert / View toolbar across the top.").addToggle((t) => t.setValue(s.showRibbon).onChange(async (v) => {
      s.showRibbon = v;
      await changed(true);
    }));
    new import_obsidian3.Setting(el).setName("Show section tabs").setDesc("Colored section tabs above the page.").addToggle((t) => t.setValue(s.showSectionTabs).onChange(async (v) => {
      s.showSectionTabs = v;
      await changed(true);
    }));
    new import_obsidian3.Setting(el).setName("Show page date and time").setDesc('Shown under the page title. Requires "Show inline title" in Appearance settings. Uses the "created" property when present.').addToggle((t) => t.setValue(s.showPageDate).onChange(async (v) => {
      s.showPageDate = v;
      await changed();
    }));
    new import_obsidian3.Setting(el).setName("Hide Obsidian's left ribbon").addToggle((t) => t.setValue(s.hideObsidianRibbon).onChange(async (v) => {
      s.hideObsidianRibbon = v;
      await changed();
    }));
    new import_obsidian3.Setting(el).setName("Page font").setDesc("CSS font-family for page text. OneNote uses Calibri.").addText((t) => t.setValue(s.pageFont).onChange(async (v) => {
      s.pageFont = v;
      await changed();
    }));
    new import_obsidian3.Setting(el).setName("Interface font").addText((t) => t.setValue(s.uiFont).onChange(async (v) => {
      s.uiFont = v;
      await changed();
    }));
    new import_obsidian3.Setting(el).setName("Page font size").setDesc("In pixels. 0 uses Obsidian's own font size.").addSlider((sl) => sl.setLimits(0, 24, 1).setValue(s.fontSize).setDynamicTooltip().onChange(async (v) => {
      s.fontSize = v;
      await changed();
    }));
    new import_obsidian3.Setting(el).setName("Rule lines").addDropdown((d) => {
      RULE_LINES.forEach((r) => d.addOption(r.id, r.name));
      d.setValue(s.ruleLines).onChange(async (v) => {
        s.ruleLines = v;
        await changed();
      });
    });
    new import_obsidian3.Setting(el).setName("Page color").addDropdown((d) => {
      PAGE_COLORS.forEach((c) => d.addOption(c.value, c.name));
      d.setValue(s.pageColor).onChange(async (v) => {
        s.pageColor = v;
        await changed();
      });
    });
    new import_obsidian3.Setting(el).setName("Page width").addDropdown((d) => {
      PAGE_WIDTHS.forEach((w) => d.addOption(w.id, w.name));
      d.setValue(s.pageWidth).onChange(async (v) => {
        s.pageWidth = v;
        await changed();
      });
    });
    el.createEl("h3", { text: "Pages" });
    new import_obsidian3.Setting(el).setName("New page name").addText((t) => t.setValue(s.newPageName).onChange(async (v) => {
      s.newPageName = v.trim() || "Untitled Page";
      await changed();
    }));
    new import_obsidian3.Setting(el).setName("Date format").setDesc("Moment.js format for the page date and Insert \u203A Date.").addMomentFormat((m) => m.setValue(s.dateFormat).setDefaultFormat(DEFAULT_SETTINGS.dateFormat).onChange(async (v) => {
      s.dateFormat = v || DEFAULT_SETTINGS.dateFormat;
      await changed();
    }));
    new import_obsidian3.Setting(el).setName("Time format").addMomentFormat((m) => m.setValue(s.timeFormat).setDefaultFormat(DEFAULT_SETTINGS.timeFormat).onChange(async (v) => {
      s.timeFormat = v || DEFAULT_SETTINGS.timeFormat;
      await changed();
    }));
    el.createEl("h3", { text: "Ribbon layout" });
    el.createEl("p", {
      cls: "setting-item-description",
      text: "You customise the ribbon on the ribbon itself: right-click a button, a group, a tab or an empty area, or drag buttons between groups. The buttons below are only a backup."
    });
    new import_obsidian3.Setting(el).setName("Export or import").setDesc("Export saves the whole layout as one JSON file in your vault. Import replaces the current layout with a file you choose.").addButton((b) => b.setButtonText("Export").onClick(() => p.exportRibbon())).addButton((b) => b.setButtonText("Import").onClick(() => p.importRibbon()));
    new import_obsidian3.Setting(el).setName("Reset").setDesc("Go back to the default tabs, groups and buttons.").addButton((b) => b.setButtonText("Undo last import or reset").onClick(() => p.undoRibbonReplace())).addButton((b) => b.setButtonText("Reset to default").setWarning().onClick(() => p.resetRibbon()));
  }
};
var OneNotePlugin = class extends import_obsidian3.Plugin {
  async onload() {
    for (const name of Object.keys(BRAND_ICONS)) (0, import_obsidian3.addIcon)(name, BRAND_ICONS[name]);
    const data = await this.loadData() || {};
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data.settings);
    this.state = Object.assign({}, DEFAULT_STATE, data.state);
    for (const k of MAP_KEYS) this.state[k] = Object.assign({}, this.state[k]);
    this.ribbonLayout = this.loadRibbonLayout(data.ribbon);
    this.ribbonPrevious = data.ribbonPrevious || null;
    this.ribbon = new RibbonView(this);
    this.registerInterval(window.setInterval(() => this.ribbon.tick(), 1500));
    this.lastMarkdownView = null;
    this.popover = null;
    this.requestRefresh = (0, import_obsidian3.debounce)(() => this.refresh(), 60, true);
    this.save = (0, import_obsidian3.debounce)(() => this.persist(), 400, true);
    this.registerView(NOTEBOOKS_VIEW, (leaf) => new NotebooksView(leaf, this));
    this.registerView(PAGES_VIEW, (leaf) => new PagesView(leaf, this));
    this.addSettingTab(new OneNoteSettingTab(this.app, this));
    if (this.settings.showNavigation) this.addRibbonIcon("book-open", "OneNote: show notebooks and pages", () => this.activatePanes(true));
    this.registerCommands();
    this.applyAppearance();
    this.app.workspace.onLayoutReady(async () => {
      this.buildTopBar();
      const { vault, workspace, metadataCache } = this.app;
      this.registerEvent(vault.on("create", () => this.requestRefresh()));
      this.registerEvent(vault.on("delete", () => this.requestRefresh()));
      this.registerEvent(vault.on("rename", (file, oldPath) => this.onRename(file, oldPath)));
      this.registerEvent(workspace.on("file-open", (file) => this.onFileOpen(file)));
      this.registerEvent(workspace.on("active-leaf-change", (leaf) => {
        if (leaf && leaf.view instanceof import_obsidian3.MarkdownView) this.lastMarkdownView = leaf.view;
        this.decoratePageHeaders();
      }));
      this.registerEvent(workspace.on("layout-change", () => this.decoratePageHeaders()));
      this.registerEvent(workspace.on("css-change", () => this.ribbon.remeasure()));
      this.registerEvent(metadataCache.on("changed", () => this.decoratePageHeaders()));
      const mv = workspace.getActiveViewOfType(import_obsidian3.MarkdownView);
      if (mv) this.lastMarkdownView = mv;
      if (!this.state.navHandedOff) {
        this.settings.showNavigation = false;
        this.settings.showSectionTabs = false;
        this.state.navHandedOff = true;
        this.state.pagesDocked = true;
        await this.persist();
        this.buildTopBar();
      }
      if (!this.state.pagesDocked) {
        this.settings.pagesPanePosition = "docked";
        this.state.pagesDocked = true;
        await this.persist();
      }
      await this.activatePanes(!this.state.panesInitialized || this.settings.pagesPanePosition === "docked");
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
    for (const c of Array.from(b.classList)) if (c.startsWith("onenote-")) b.removeClass(c);
    for (const v of ["--onenote-page-font", "--onenote-ui-font", "--onenote-font-size", "--onenote-page-color", "--onenote-section-color"]) {
      b.style.removeProperty(v);
    }
    document.querySelectorAll(".onenote-page-date").forEach((e) => e.remove());
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
        console.error("OneNote Style: saved ribbon layout is unreadable, using the default", e);
      }
    }
    return defaultLayout();
  }
  /* ---------- structure ---------- */
  get root() {
    return this.app.vault.getRoot();
  }
  isExcluded(folder) {
    if (folder.name.startsWith(".")) return true;
    const ex = this.settings.excludedFolders.split(",").map((x) => (0, import_obsidian3.normalizePath)(x.trim())).filter((x) => x && x !== "/");
    return ex.some((x) => folder.path === x || folder.path.startsWith(x + "/"));
  }
  isFolder(f) {
    return f instanceof import_obsidian3.TFolder && !f.isRoot() && !this.isExcluded(f);
  }
  getNotebooks() {
    if (this.settings.notebookMode === "vault") return [this.root];
    return this.root.children.filter((f) => this.isFolder(f)).sort(byName);
  }
  getSections(folder) {
    return folder.children.filter((f) => this.isFolder(f)).sort(byName);
  }
  getPages(folder) {
    const files = folder.children.filter(isPageFile);
    const order = this.state.order[folder.path] || [];
    const idx = new Map(order.map((path, i) => [path, i]));
    return files.sort((a, b) => {
      const ia = idx.has(a.path) ? idx.get(a.path) : Infinity;
      const ib = idx.has(b.path) ? idx.get(b.path) : Infinity;
      if (ia !== ib) return ia < ib ? -1 : 1;
      return a.stat.ctime - b.stat.ctime;
    });
  }
  allSections() {
    const out = [];
    const walk = (f) => {
      out.push(f);
      this.getSections(f).forEach(walk);
    };
    for (const nb of this.getNotebooks()) {
      if (nb.isRoot() || this.getPages(nb).length) out.push(nb);
      this.getSections(nb).forEach(walk);
    }
    return Array.from(new Set(out));
  }
  notebookName(folder) {
    return folder.isRoot() ? this.app.vault.getName() : folder.name;
  }
  sectionDisplayName(folder) {
    const nb = this.notebookOf(folder);
    return folder === nb ? "Unfiled pages" : folder.name;
  }
  sectionLabel(folder) {
    if (!folder) return "";
    const nb = this.notebookOf(folder);
    if (!nb) return folder.path;
    if (folder === nb) return this.notebookName(nb);
    const rel = nb.isRoot() ? folder.path : folder.path.slice(nb.path.length + 1);
    return this.notebookName(nb) + " \u203A " + rel.split("/").join(" \u203A ");
  }
  folderAt(path) {
    if (path == null) return null;
    if (path === "/" || path === "") return this.root;
    const f = this.app.vault.getAbstractFileByPath(path);
    return f instanceof import_obsidian3.TFolder ? f : null;
  }
  notebookOf(folder) {
    if (!folder) return null;
    if (this.settings.notebookMode === "vault") return this.root;
    if (folder.isRoot()) return null;
    let nb = folder;
    while (nb.parent && !nb.parent.isRoot()) nb = nb.parent;
    return this.isExcluded(nb) ? null : nb;
  }
  locate(file) {
    if (!file) return null;
    const section = file instanceof import_obsidian3.TFolder ? file : file.parent;
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
  levelOf(file) {
    return this.state.levels[file.path || file] || 0;
  }
  colorOf(folder) {
    const c = this.state.colors[folder.path];
    if (c) return c;
    let h = 0;
    for (const ch of folder.name) h = h * 31 + ch.charCodeAt(0) >>> 0;
    return SECTION_COLORS[h % SECTION_COLORS.length];
  }
  uniquePath(folder, base, ext) {
    const dir = folder.isRoot() ? "" : folder.path + "/";
    const clean = base.replace(/[\\/:*?"<>|#^[\]]/g, "").trim() || "Untitled";
    let name = clean;
    let n = 1;
    while (this.app.vault.getAbstractFileByPath((0, import_obsidian3.normalizePath)(dir + name + (ext ? "." + ext : "")))) name = `${clean} ${++n}`;
    return (0, import_obsidian3.normalizePath)(dir + name + (ext ? "." + ext : ""));
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
    await this.app.workspace.getLeaf(newTab ? "tab" : false).openFile(file);
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
    const section = last && isInside(nb, last) ? last : this.getSections(nb)[0] || nb;
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
      nb = await this.app.vault.createFolder(this.uniquePath(this.root, "My Notebook"));
    }
    section = await this.app.vault.createFolder(this.uniquePath(nb, "Quick Notes"));
    return section;
  }
  async createPage(opts) {
    opts = opts || {};
    const section = opts.section || await this.ensureSection();
    const ext = opts.canvas ? "canvas" : "md";
    const file = await this.app.vault.create(
      this.uniquePath(section, this.settings.newPageName, ext),
      opts.canvas ? '{"nodes":[],"edges":[]}' : ""
    );
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
    if (opts.level) this.state.levels[file.path] = opts.level;
    this.save();
    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(file, { state: { mode: "source" } });
    if (!opts.canvas) this.focusTitle(leaf, file);
    return file;
  }
  /* ---------- subpages as real folders (Fluent OneNote format) ----------
   * Notebook = top folder, Section = folder inside it, Page = note.
   * A page with subpages is a folder holding a note of the same name
   * ("folder note") plus its subpage notes:  Notebook/Section/Parent/Parent.md
   */
  fluentRoot() {
    const fp = this.app.plugins && this.app.plugins.plugins && this.app.plugins.plugins["fluent-onenote"];
    const r = fp && fp.settings ? fp.settings.rootFolder : "";
    return (r || "").trim().replace(/^\/+|\/+$/g, "");
  }
  depthOf(folder) {
    if (!folder || folder.isRoot()) return 0;
    const root = this.fluentRoot();
    let rel = folder.path;
    if (root) {
      if (rel !== root && !rel.startsWith(root + "/")) return -1;
      rel = rel === root ? "" : rel.slice(root.length + 1);
    }
    return rel ? rel.split("/").length : 0;
  }
  isFolderNote(f) {
    return f instanceof import_obsidian3.TFile && f.parent && !f.parent.isRoot() && f.basename === f.parent.name;
  }
  /** The thing that moves when a page moves: the page folder for a parent page, else the note. */
  pageUnit(f) {
    return this.isFolderNote(f) && this.depthOf(f.parent) >= 3 ? f.parent : f;
  }
  needsSection(container) {
    if (this.depthOf(container) >= 2) return false;
    new import_obsidian3.Notice("Subpages live inside a section. Create a section in this notebook (a folder inside it) and move the page there first.", 8e3);
    return true;
  }
  /** Turn a plain page into a parent page: Section/P.md -> Section/P/P.md */
  async ensurePageFolder(page) {
    if (this.isFolderNote(page) && this.depthOf(page.parent) >= 3) return page.parent;
    const folderPath = (0, import_obsidian3.normalizePath)(page.parent.path + "/" + page.basename);
    let folder = this.app.vault.getAbstractFileByPath(folderPath);
    if (!folder) folder = await this.app.vault.createFolder(folderPath);
    if (!(folder instanceof import_obsidian3.TFolder)) throw new Error("A file named " + folderPath + " is in the way.");
    await this.app.fileManager.renameFile(page, (0, import_obsidian3.normalizePath)(folderPath + "/" + page.name));
    return folder;
  }
  async moveInto(unit, folder) {
    const dest = (0, import_obsidian3.normalizePath)(folder.path + "/" + unit.name);
    if (this.app.vault.getAbstractFileByPath(dest)) {
      new import_obsidian3.Notice(`There is already a page called "${unit.name}" there.`);
      return false;
    }
    await this.app.fileManager.renameFile(unit, dest);
    return true;
  }
  async createSubpage() {
    const cur = this.app.workspace.getActiveFile();
    if (!cur || cur.extension !== "md") {
      new import_obsidian3.Notice("Open a page first. The subpage is created under the page you are on.");
      return;
    }
    const container = this.pageUnit(cur).parent;
    if (this.needsSection(container)) return;
    const folder = await this.ensurePageFolder(cur);
    const file = await this.app.vault.create(this.uniquePath(folder, this.settings.newPageName, "md"), "");
    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(file, { state: { mode: "source" } });
    this.focusTitle(leaf, file);
    return file;
  }
  async makeSubpage(file) {
    const unit = this.pageUnit(file);
    const container = unit.parent;
    if (this.needsSection(container)) return;
    const candidates = container.children.filter((c) => c !== unit && (c instanceof import_obsidian3.TFolder || c instanceof import_obsidian3.TFile && c.extension === "md" && c.basename !== container.name));
    if (!candidates.length) {
      new import_obsidian3.Notice("There is no other page here to put it under.");
      return;
    }
    new PageSuggestModal(this.app, candidates, `Make "${file.basename}" a subpage of...`, async (parent) => {
      try {
        const folder = parent instanceof import_obsidian3.TFolder ? parent : await this.ensurePageFolder(parent);
        if (await this.moveInto(unit, folder)) new import_obsidian3.Notice(`"${file.basename}" is now a subpage of "${folder.name}".`);
      } catch (e) {
        new import_obsidian3.Notice(String(e.message || e));
      }
    }).open();
  }
  async promotePage(file) {
    const unit = this.pageUnit(file);
    const parentFolder = unit.parent;
    if (this.depthOf(parentFolder) < 3) {
      new import_obsidian3.Notice(`"${file.basename}" is already a top-level page in its section.`);
      return;
    }
    if (await this.moveInto(unit, parentFolder.parent)) new import_obsidian3.Notice(`"${file.basename}" moved up one level.`);
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
      const name = await promptText(this.app, "Page title", file.basename, "Rename");
      if (name && name !== file.basename) await this.renameFile(file, name);
    }, 80);
  }
  async createSection(notebook) {
    const parent = notebook || this.currentNotebook;
    if (!parent) return this.createNotebook();
    const name = await promptText(this.app, "New section", "New Section", "Create");
    if (!name) return;
    const folder = await this.app.vault.createFolder(this.uniquePath(parent, name));
    this.state.colors[folder.path] = SECTION_COLORS[this.getSections(parent).length % SECTION_COLORS.length];
    this.state.notebook = this.notebookOf(folder).path;
    this.state.section = folder.path;
    await this.createPage({ section: folder });
  }
  async createNotebook() {
    if (this.settings.notebookMode === "vault") {
      new import_obsidian3.Notice('Your vault is set up as a single notebook. Change "Notebook structure" in settings to use several.');
      return;
    }
    const name = await promptText(this.app, "New notebook", "New Notebook", "Create");
    if (!name) return;
    const nb = await this.app.vault.createFolder(this.uniquePath(this.root, name));
    const section = await this.app.vault.createFolder(this.uniquePath(nb, "New Section 1"));
    this.state.colors[section.path] = SECTION_COLORS[0];
    this.state.expanded[nb.path] = true;
    this.state.notebook = nb.path;
    this.state.section = section.path;
    await this.createPage({ section });
  }
  async renameFile(file, name) {
    const parent = file.parent;
    const path = this.uniquePath(parent, name, file instanceof import_obsidian3.TFile ? file.extension : "");
    await this.app.fileManager.renameFile(file, path);
  }
  async deleteFile(file, what) {
    const ok = await confirmAction(this.app, `Delete ${what}`, `Delete "${file.name}"? It will be moved to the trash.`);
    if (!ok) return;
    if (this.app.fileManager.trashFile) await this.app.fileManager.trashFile(file);
    else await this.app.vault.trash(file, true);
  }
  setLevel(file, delta) {
    if (!(file instanceof import_obsidian3.TFile) || file.extension !== "md") {
      new import_obsidian3.Notice("Subpages work with notes (not canvases or images).");
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
    delete this.state.levels[file.path];
    this.save();
  }
  async dropPage(path, target, after) {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof import_obsidian3.TFile) || file === target) return;
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
    el.addEventListener("dragover", (e) => {
      if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
      e.preventDefault();
      el.addClass("is-drop-target");
    });
    el.addEventListener("dragleave", () => el.removeClass("is-drop-target"));
    el.addEventListener("drop", async (e) => {
      el.removeClass("is-drop-target");
      const path = e.dataTransfer.getData(DRAG_TYPE);
      const file = path && this.app.vault.getAbstractFileByPath(path);
      if (!(file instanceof import_obsidian3.TFile)) return;
      e.preventDefault();
      await this.movePage(file, folder);
    });
  }
  onRename(file, oldPath) {
    const mig = (p) => p === oldPath ? file.path : p && p.startsWith(oldPath + "/") ? file.path + p.slice(oldPath.length) : p;
    for (const k of MAP_KEYS) {
      const next = {};
      for (const [key, val] of Object.entries(this.state[k])) {
        next[mig(key)] = Array.isArray(val) ? val.map(mig) : typeof val === "string" && k.startsWith("last") ? mig(val) : val;
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
    const m = new import_obsidian3.Menu();
    m.addItem((i) => i.setTitle("Open in new tab").setIcon("file-plus").onClick(() => this.openPage(file, true)));
    m.addItem((i) => i.setTitle("Rename").setIcon("pencil").onClick(async () => {
      const name = await promptText(this.app, "Rename page", file.basename, "Rename");
      if (name && name !== file.basename) await this.renameFile(file, name);
    }));
    m.addSeparator();
    m.addItem((i) => i.setTitle("New page below").setIcon("file-plus-2").onClick(() => this.createPage({ section: file.parent, after: file, level: this.levelOf(file) })));
    m.addItem((i) => i.setTitle("New subpage").setIcon("corner-down-right").onClick(() => this.createPage({ section: file.parent, after: file, level: Math.min(2, this.levelOf(file) + 1) })));
    if (this.levelOf(file) < 2) m.addItem((i) => i.setTitle("Make subpage").setIcon("indent").onClick(() => this.setLevel(file, 1)));
    if (this.levelOf(file) > 0) m.addItem((i) => i.setTitle("Promote subpage").setIcon("outdent").onClick(() => this.setLevel(file, -1)));
    m.addSeparator();
    m.addItem((i) => i.setTitle("Move to section...").setIcon("folder-input").onClick(() => {
      new SectionSuggestModal(this.app, this, (s) => this.movePage(file, s)).open();
    }));
    m.addItem((i) => i.setTitle("Copy link to page").setIcon("link").onClick(() => {
      navigator.clipboard.writeText(this.app.fileManager.generateMarkdownLink(file, ""));
      new import_obsidian3.Notice("Link copied");
    }));
    m.addSeparator();
    m.addItem((i) => i.setTitle("Delete page").setIcon("trash").onClick(() => this.deleteFile(file, "page")));
    m.showAtMouseEvent(evt);
  }
  sectionMenu(evt, folder) {
    const m = new import_obsidian3.Menu();
    m.addItem((i) => i.setTitle("New page").setIcon("file-plus").onClick(() => this.createPage({ section: folder })));
    m.addItem((i) => i.setTitle("New section").setIcon("folder-plus").onClick(() => this.createSection(folder.parent && !folder.parent.isRoot() ? folder.parent : this.notebookOf(folder))));
    m.addItem((i) => i.setTitle("New section inside (section group)").setIcon("folder-tree").onClick(() => this.createSection(folder)));
    m.addSeparator();
    m.addItem((i) => i.setTitle("Rename").setIcon("pencil").onClick(async () => {
      const name = await promptText(this.app, "Rename section", folder.name, "Rename");
      if (name && name !== folder.name) await this.renameFile(folder, name);
    }));
    m.addItem((i) => i.setTitle("Section color...").setIcon("palette").onClick(() => this.pickFolderColor(folder, evt)));
    m.addSeparator();
    m.addItem((i) => i.setTitle("Delete section").setIcon("trash").onClick(() => this.deleteFile(folder, "section")));
    m.showAtMouseEvent(evt);
  }
  notebookMenu(evt, nb) {
    const m = new import_obsidian3.Menu();
    m.addItem((i) => i.setTitle("New section").setIcon("folder-plus").onClick(() => this.createSection(nb)));
    if (!nb.isRoot()) {
      m.addItem((i) => i.setTitle("Rename notebook").setIcon("pencil").onClick(async () => {
        const name = await promptText(this.app, "Rename notebook", nb.name, "Rename");
        if (name && name !== nb.name) await this.renameFile(nb, name);
      }));
      m.addItem((i) => i.setTitle("Notebook color...").setIcon("palette").onClick(() => this.pickFolderColor(nb, evt)));
      m.addSeparator();
      m.addItem((i) => i.setTitle("Delete notebook").setIcon("trash").onClick(() => this.deleteFile(nb, "notebook")));
    }
    m.showAtMouseEvent(evt);
  }
  pickFolderColor(folder, evt) {
    this.showPopover(null, (pop, close) => {
      pop.createDiv({ cls: "onenote-popover-title", text: "Color" });
      const grid = pop.createDiv("onenote-swatch-grid");
      for (const c of SECTION_COLORS) {
        const sw = grid.createDiv({ cls: "onenote-swatch" });
        sw.style.backgroundColor = c;
        sw.onclick = () => {
          this.state.colors[folder.path] = c;
          this.save();
          this.refresh();
          close();
        };
      }
    }, { x: evt.clientX, y: evt.clientY });
  }
  /* ---------- appearance ---------- */
  applyAppearance() {
    const b = document.body;
    const s = this.settings;
    b.toggleClass("onenote-theme", s.applyTheme);
    b.toggleClass("onenote-hide-obsidian-ribbon", s.hideObsidianRibbon);
    for (const r of RULE_LINES) b.removeClass("onenote-rules-" + r.id);
    b.toggleClass("onenote-rules", s.ruleLines !== "none");
    if (s.ruleLines !== "none") b.addClass("onenote-rules-" + s.ruleLines);
    for (const w of PAGE_WIDTHS) b.removeClass("onenote-width-" + w.id);
    b.addClass("onenote-width-" + s.pageWidth);
    b.toggleClass("onenote-has-page-color", !!s.pageColor);
    b.toggleClass("onenote-has-font-size", s.fontSize > 0);
    b.style.setProperty("--onenote-page-font", s.pageFont);
    b.style.setProperty("--onenote-ui-font", s.uiFont);
    b.style.setProperty("--onenote-font-size", s.fontSize + "px");
    if (s.pageColor) b.style.setProperty("--onenote-page-color", s.pageColor);
    else b.style.removeProperty("--onenote-page-color");
  }
  async setAppearance(key, value) {
    this.settings[key] = value;
    await this.persist();
    this.applyAppearance();
  }
  decoratePageHeaders() {
    const show = this.settings.showPageDate;
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (!(view instanceof import_obsidian3.MarkdownView)) continue;
      const titles = view.containerEl.querySelectorAll(".inline-title");
      if (!show || !view.file) {
        view.containerEl.querySelectorAll(".onenote-page-date").forEach((e) => e.remove());
        continue;
      }
      const fm = (this.app.metadataCache.getFileCache(view.file) || {}).frontmatter;
      const raw = fm && (fm.created || fm.date);
      let m = raw ? (0, import_obsidian3.moment)(raw) : null;
      if (!m || !m.isValid()) m = (0, import_obsidian3.moment)(view.file.stat.ctime);
      const date = m.format(this.settings.dateFormat);
      const time = m.format(this.settings.timeFormat);
      titles.forEach((t) => {
        const container = t.closest(".mod-header, .cm-sizer") || t.parentElement;
        let anchor = t;
        while (anchor.parentElement && anchor.parentElement !== container) anchor = anchor.parentElement;
        const existing = Array.from(container.querySelectorAll(".onenote-page-date"));
        let d = existing.find((e) => e.parentElement === container) || null;
        for (const e of existing) if (e !== d) e.remove();
        if (!d) d = createDiv({ cls: "onenote-page-date", attr: { contenteditable: "false" } });
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
  refresh() {
    const sec = this.currentSection;
    const color = sec && sec !== this.notebookOf(sec) ? this.colorOf(sec) : "#B4B4B4";
    document.body.style.setProperty("--onenote-section-color", color);
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
    const explorer = ws.getLeavesOfType("file-explorer")[0];
    let pages = ws.getLeavesOfType(PAGES_VIEW)[0];
    if (pages) {
      const inRight = pages.getRoot() === ws.rightSplit;
      const tabsOfExplorer = explorer && pages.parent === explorer.parent;
      const wrong = want === "right" ? !inRight : inRight || want === "docked" && tabsOfExplorer;
      if (wrong) {
        pages.detach();
        pages = null;
      }
    }
    if (!pages) {
      if (want === "right") pages = ws.getRightLeaf(false);
      else if (want === "docked" && explorer) pages = ws.createLeafBySplit(explorer, "horizontal");
      else pages = ws.getLeftLeaf(true);
      await pages.setViewState({ type: PAGES_VIEW, active: false });
    }
    if (reveal) {
      if (want === "docked") {
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
    if (!leaf) {
      await this.activatePanes(false);
      leaf = ws.getLeavesOfType(type)[0];
    }
    if (!leaf) return;
    const root = leaf.getRoot();
    const split = root === ws.leftSplit ? ws.leftSplit : root === ws.rightSplit ? ws.rightSplit : null;
    if (split && !split.collapsed && leaf.view.containerEl.isShown()) split.collapse();
    else ws.revealLeaf(leaf);
  }
  toggleFullPage() {
    const ws = this.app.workspace;
    const on = !document.body.hasClass("onenote-fullpage");
    document.body.toggleClass("onenote-fullpage", on);
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
    if (!cmds || !(cmds.commands[id] || cmds.editorCommands && cmds.editorCommands[id])) return false;
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
    } else if (ae instanceof import_obsidian3.MarkdownView && ws.activeLeaf !== ae.leaf) {
      ws.setActiveLeaf(ae.leaf, { focus: true });
    }
    if (!ae || !ae.editor) {
      new import_obsidian3.Notice("Open a page to use this.");
      return;
    }
    if (ae instanceof import_obsidian3.MarkdownView && ae.getMode() === "preview") {
      await ae.setState(Object.assign({}, ae.getState(), { mode: "source" }), { history: false });
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
    return this.withEditor((e) => {
      if (!this.exec(id) && fallback) fallback(e);
    });
  }
  edit(fn) {
    return this.withEditor(fn);
  }
  stamp(kind) {
    const m = (0, import_obsidian3.moment)();
    const s = this.settings;
    const text = kind === "date" ? m.format(s.dateFormat) : kind === "time" ? m.format(s.timeFormat) : m.format(s.dateFormat) + " " + m.format(s.timeFormat);
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
      if (cut) e.replaceSelection("");
    });
  }
  registerCommands() {
    const ed = (id, name, fn, hotkeys) => this.addCommand({ id, name, editorCallback: (e) => fn(e), hotkeys });
    const key = (mods, k) => [{ modifiers: mods, key: k }];
    for (const t of TAGS) {
      ed(`tag-${t.id}`, `Tag: ${t.name}`, (e) => mapLines(e, (l) => toggleTagLine(l, t.char)), key(["Mod"], t.key));
    }
    ed("remove-tags", "Tag: Remove tags", (e) => mapLines(e, (l) => {
      const m = l.match(TASK_RE);
      return m[3] === void 0 ? l : /^\d/.test(m[2]) ? m[1] + m[2] + m[4] : m[1] + m[4];
    }));
    this.addCommand({ id: "find-tags", name: "Find tags (Tags Summary)", callback: () => new TagSummaryModal(this.app, this).open() });
    ed("underline", "Underline", (e) => wrap(e, "<u>", "</u>"), key(["Mod"], "U"));
    ed("highlight", "Highlight", (e) => wrap(e, "==", "=="), key(["Mod", "Alt"], "H"));
    ed("subscript", "Subscript", (e) => wrap(e, "<sub>", "</sub>"));
    ed("superscript", "Superscript", (e) => wrap(e, "<sup>", "</sup>"));
    ed("clear-formatting", "Clear formatting", (e) => this.clearFormat(e));
    for (let n = 1; n <= 6; n++) {
      ed(`heading-${n}`, `Style: Heading ${n}`, (e) => mapLines(e, (l) => styleLine(l, n)), key(["Mod", "Alt"], String(n)));
    }
    ed("normal", "Style: Normal", (e) => mapLines(e, (l) => styleLine(l, 0)), key(["Mod", "Shift"], "N"));
    ed("bullets", "Bulleted list", () => this.exec("editor:toggle-bullet-list"), key(["Mod"], "."));
    ed("numbering", "Numbered list", () => this.exec("editor:toggle-numbered-list"));
    ed("insert-date", "Insert date", () => this.stamp("date"), key(["Alt", "Shift"], "D"));
    ed("insert-time", "Insert time", () => this.stamp("time"), key(["Alt", "Shift"], "T"));
    ed("insert-datetime", "Insert date and time", () => this.stamp("datetime"), key(["Alt", "Shift"], "F"));
    this.addCommand({ id: "new-page", name: "New page", callback: () => this.createPage() });
    this.addCommand({ id: "new-subpage", name: "New subpage", callback: () => this.createSubpage(), hotkeys: key(["Mod", "Shift", "Alt"], "N") });
    this.addCommand({ id: "new-canvas-page", name: "New free-form page (Canvas)", callback: () => this.createPage({ canvas: true }) });
    this.addCommand({ id: "new-section", name: "New section", callback: () => this.createSection() });
    this.addCommand({ id: "new-notebook", name: "New notebook", callback: () => this.createNotebook() });
    this.addCommand({ id: "next-page", name: "Go to next page", callback: () => this.stepPage(1), hotkeys: key(["Alt"], "PageDown") });
    this.addCommand({ id: "prev-page", name: "Go to previous page", callback: () => this.stepPage(-1), hotkeys: key(["Alt"], "PageUp") });
    this.addCommand({ id: "next-section", name: "Go to next section", callback: () => this.stepSection(1) });
    this.addCommand({ id: "prev-section", name: "Go to previous section", callback: () => this.stepSection(-1) });
    this.addCommand({ id: "make-subpage", name: "Make current page a subpage", callback: () => this.withActivePage((f) => this.setLevel(f, 1)), hotkeys: key(["Mod", "Alt"], "]") });
    this.addCommand({ id: "promote-subpage", name: "Promote current subpage", callback: () => this.withActivePage((f) => this.setLevel(f, -1)), hotkeys: key(["Mod", "Alt"], "[") });
    this.addCommand({ id: "toggle-ribbon", name: "Collapse or expand the ribbon", callback: () => this.toggleRibbon(), hotkeys: key(["Mod"], "F1") });
    this.addCommand({ id: "full-page-view", name: "Toggle full page view", callback: () => this.toggleFullPage() });
    this.addCommand({ id: "show-panes", name: "Show notebooks and pages panes", callback: () => this.activatePanes(true) });
    const run = (id, name, callback) => this.addCommand({ id, name, callback });
    run("paste", "Paste", () => this.paste());
    run("cut", "Cut", () => this.copy(true));
    run("copy", "Copy", () => this.copy(false));
    run("undo", "Undo", () => this.edit((e) => e.undo()));
    run("redo", "Redo", () => this.edit((e) => e.redo()));
    run("highlight-color", "Highlight color...", () => this.highlightPicker(this.pickerAnchor()));
    run("font-color", "Font color...", () => this.fontColorPicker(this.pickerAnchor()));
    run("insert-table-grid", "Insert table (choose size)...", () => this.tablePicker(this.pickerAnchor()));
    run("insert-symbol", "Insert symbol...", () => this.symbolPicker(this.pickerAnchor()));
    run("page-color", "Page color...", () => this.pageColorPicker(this.pickerAnchor()));
    run("rule-lines", "Rule lines...", () => this.choiceMenu(RULE_LINES, "ruleLines"));
    run("page-width", "Page width...", () => this.choiceMenu(PAGE_WIDTHS, "pageWidth"));
    run("use-light-mode", "Use light mode", () => setDarkMode(this.app, false, document));
    run("use-dark-mode", "Use dark mode", () => setDarkMode(this.app, true, document));
    run("open-community-plugins", "Open Community plugins", () => openSettings(this.app, "community-plugins"));
    run("open-ai-chatbridge-settings", "Open AI ChatBridge settings", () => this.openAiSettings());
    run("toggle-section-tabs", "Show or hide section tabs", async () => {
      this.settings.showSectionTabs = !this.settings.showSectionTabs;
      await this.persist();
      this.buildTopBar();
    });
    run("ribbon-export", "Ribbon: export layout to a file", () => this.exportRibbon());
    run("ribbon-import", "Ribbon: import layout from a file", () => this.importRibbon());
    run("ribbon-reset", "Ribbon: reset to the default layout", () => this.resetRibbon());
    run("ribbon-undo-replace", "Ribbon: undo last import or reset", () => this.undoRibbonReplace());
  }
  withActivePage(fn) {
    const f = this.app.workspace.getActiveFile();
    if (f && (isPageFile(f) || f.extension === "md")) fn(f);
    else new import_obsidian3.Notice("Open a page first.");
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
    document.body.toggleClass("onenote-has-topbar", !!at && (s.showRibbon || s.showSectionTabs));
    if (!at || !s.showRibbon && !s.showSectionTabs) return;
    const bar = createDiv("onenote-topbar");
    at.parent.insertBefore(bar, at.before);
    this.topBar = bar;
    bar.addEventListener("mousedown", (e) => {
      if (!e.target.closest("input, select, textarea")) e.preventDefault();
    });
    this.tabRowEl = this.qatEl = this.tabRowEndEl = this.ribbonEl = null;
    if (s.showRibbon) {
      this.tabRowEl = bar.createDiv("onenote-tabrow");
      this.qatEl = this.tabRowEl.createDiv("onenote-qat");
      const tabsEl = this.tabRowEl.createDiv({ cls: "onenote-tabs", attr: { role: "tablist" } });
      this.tabRowEl.createDiv("onenote-tabrow-spacer");
      this.tabRowEndEl = this.tabRowEl.createDiv("onenote-tabrow-end");
      this.ribbonEl = bar.createDiv("onenote-ribbon");
      this.tabRowEl.addEventListener("dblclick", (e) => {
        if (e.target.closest(".onenote-tab[data-tab]")) this.toggleRibbon();
      });
      this.renderTabRow();
      this.ribbon.mount(bar, tabsEl, this.ribbonEl);
    }
    this.sectionTabsEl = s.showSectionTabs ? bar.createDiv("onenote-section-tabs") : null;
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
      const b = parent.createEl("button", { cls: "onenote-btn" + (label ? " has-label" : ""), attr: { type: "button", "aria-label": tip, "data-tooltip-position": "bottom" } });
      icon(b.createSpan("onenote-btn-icon"), iconName, tip[0]);
      if (label) b.createSpan({ cls: "onenote-btn-label", text: label });
      b.onclick = onClick;
      return b;
    };
    this.qatEl.empty();
    tool(this.qatEl, "undo", "Undo (Ctrl+Z)", () => this.edit((e) => e.undo()));
    tool(this.qatEl, "redo", "Redo (Ctrl+Y)", () => this.edit((e) => e.redo()));
    const end = this.tabRowEndEl;
    end.empty();
    if (document.body.hasClass("onenote-fullpage")) {
      tool(end, "minimize-2", "Exit full page view", () => this.toggleFullPage(), "Exit Full Page");
    }
    const search = end.createDiv("onenote-search");
    icon(search.createSpan("onenote-search-icon"), "search", "\u2315");
    const input = search.createEl("input", { type: "search", attr: { placeholder: "Search (Ctrl+Shift+F)" } });
    input.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      const q = input.value.trim();
      const gs = this.app.internalPlugins && this.app.internalPlugins.getPluginById("global-search");
      if (gs && gs.instance && gs.instance.openGlobalSearch) gs.instance.openGlobalSearch(q);
      else this.exec("global-search:open");
    });
  }
  /* ---------- ribbon: what the ribbon view needs from the plugin ---------- */
  saveRibbon() {
    this.save();
  }
  promptText(title, value, cta) {
    return promptText(this.app, title, value, cta);
  }
  confirm(title, message, cta) {
    return confirmAction(this.app, title, message, cta);
  }
  // Runs the command behind a ribbon button.
  runRibbonCommand(id) {
    const ws = this.app.workspace;
    let ok = executeCommand(this.app, id);
    if (!ok) {
      const v = this.lastMarkdownView;
      if (v && v.leaf && v.leaf.view === v && v.containerEl.isConnected && ws.activeLeaf !== v.leaf) {
        ws.setActiveLeaf(v.leaf, { focus: true });
        ok = executeCommand(this.app, id);
      }
    }
    if (!ok) new import_obsidian3.Notice("This command can't be used here right now.");
    return ok;
  }
  // Where a picker should open: under the ribbon button that was just clicked, else at
  // the top of the page (when the command came from the command palette or a hotkey).
  pickerAnchor() {
    const r = this.ribbon && this.ribbon.lastAnchor();
    if (r) return r;
    const v = this.app.workspace.getActiveViewOfType(import_obsidian3.MarkdownView);
    const box = (v ? v.contentEl : document.body).getBoundingClientRect();
    return { left: box.left + 24, bottom: box.top + 24 };
  }
  choiceMenu(choices, key) {
    const m = new import_obsidian3.Menu();
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
    this.state.ribbonTab = tab ? tab.id : "";
    this.ribbon.changed();
  }
  async exportRibbon() {
    const name = `Ribbon layout ${(0, import_obsidian3.moment)().format("YYYY-MM-DD HHmmss")}.json`;
    try {
      await this.app.vault.create((0, import_obsidian3.normalizePath)(name), exportLayout(this.ribbonLayout));
      new import_obsidian3.Notice(`Ribbon layout saved in your vault as "${name}".`, 8e3);
      return name;
    } catch (e) {
      new import_obsidian3.Notice(`Could not save the ribbon layout: ${e && e.message ? e.message : e}`);
      return null;
    }
  }
  importRibbon() {
    const input = createEl("input", { type: "file", attr: { accept: ".json,application/json" } });
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
      new import_obsidian3.Notice(`The ribbon layout was not imported. ${e.message}`, 8e3);
      return false;
    }
    this.replaceRibbonLayout(layout);
    new import_obsidian3.Notice('Ribbon layout imported. To go back, run the command "Ribbon: undo last import or reset".', 8e3);
    return true;
  }
  async resetRibbon() {
    const ok = await this.confirm("Reset the ribbon", 'Replace all tabs, groups and buttons with the default layout? You can undo this once with the command "Ribbon: undo last import or reset".', "Reset");
    if (!ok) return false;
    this.replaceRibbonLayout(defaultLayout());
    return true;
  }
  undoRibbonReplace() {
    if (!this.ribbonPrevious) {
      new import_obsidian3.Notice("There is no earlier ribbon layout to go back to.");
      return false;
    }
    const previous = this.ribbonPrevious;
    this.replaceRibbonLayout(previous, false);
    new import_obsidian3.Notice("The earlier ribbon layout is back.");
    return true;
  }
  openAiSettings() {
    if (!isPluginEnabled(this.app, AI_PLUGIN)) {
      new import_obsidian3.Notice("AI ChatBridge is not installed or not enabled.");
      openSettings(this.app, "community-plugins");
      return;
    }
    openSettings(this.app, AI_PLUGIN);
  }
  renderSectionTabs() {
    const el = this.sectionTabsEl;
    if (!el) return;
    el.empty();
    const nb = this.currentNotebook;
    const sw = el.createDiv({ cls: "onenote-nb-switch", attr: { "aria-label": "Switch notebook", "data-tooltip-position": "bottom" } });
    const bi = sw.createSpan("onenote-nb-icon");
    if (nb) bi.style.color = this.colorOf(nb);
    icon(bi, "book", "\u{1F4D3}");
    sw.createSpan({ cls: "onenote-nb-switch-name", text: nb ? this.notebookName(nb) : "No notebook" });
    icon(sw.createSpan("onenote-nb-switch-caret"), "chevron-down", "\u25BE");
    sw.onclick = (e) => {
      const m = new import_obsidian3.Menu();
      for (const n of this.getNotebooks()) {
        m.addItem((i) => i.setTitle(this.notebookName(n)).setIcon("book").setChecked(n === nb).onClick(() => this.openNotebook(n)));
      }
      if (this.settings.notebookMode === "folders") {
        m.addSeparator();
        m.addItem((i) => i.setTitle("Add notebook").setIcon("plus").onClick(() => this.createNotebook()));
      }
      m.showAtMouseEvent(e);
    };
    if (!nb) return;
    const cur = this.currentSection;
    const tabs = [];
    if (this.getPages(nb).length) tabs.push({ folder: nb, name: "Unfiled", color: "#C8C8C8" });
    for (const s of this.getSections(nb)) tabs.push({ folder: s, name: s.name, color: this.colorOf(s) });
    for (const t of tabs) {
      const active = cur && (t.folder === nb ? cur === nb : isInside(t.folder, cur));
      const tab = el.createDiv({ cls: "onenote-section-tab" + (active ? " is-active" : ""), text: t.name });
      tab.style.setProperty("--tab-color", t.color);
      tab.onclick = () => this.openSection(active && cur !== t.folder ? cur : t.folder);
      if (t.folder !== nb) tab.oncontextmenu = (e) => this.sectionMenu(e, t.folder);
      this.makeDropTarget(tab, t.folder);
      if (active && cur !== t.folder) tab.setText(t.name + " \u203A " + cur.name);
    }
    const add = el.createDiv({ cls: "onenote-section-tab is-add", attr: { "aria-label": "Create a new section", "data-tooltip-position": "bottom" } });
    icon(add, "plus", "+");
    add.onclick = () => this.createSection(nb);
  }
  /* ---------- popovers ---------- */
  showPopover(anchor, build, pos) {
    this.closePopover();
    const pop = document.body.createDiv("onenote-popover");
    const close = () => {
      pop.remove();
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
      if (this.popover === close) this.popover = null;
    };
    const onDown = (e) => {
      if (!pop.contains(e.target)) close();
    };
    const onKey = (e) => {
      if (e.key === "Escape") close();
    };
    pop.addEventListener("mousedown", (e) => e.preventDefault());
    build(pop, close);
    const r = !anchor ? { left: pos.x, bottom: pos.y } : anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : anchor;
    pop.style.left = Math.max(4, Math.min(r.left, window.innerWidth - pop.offsetWidth - 8)) + "px";
    pop.style.top = Math.min(r.bottom + 2, window.innerHeight - pop.offsetHeight - 8) + "px";
    setTimeout(() => {
      document.addEventListener("mousedown", onDown, true);
      document.addEventListener("keydown", onKey, true);
    }, 0);
    this.popover = close;
  }
  closePopover() {
    if (this.popover) this.popover();
  }
  swatches(pop, colors, onPick, close) {
    const grid = pop.createDiv("onenote-swatch-grid");
    for (const c of colors) {
      const sw = grid.createDiv({ cls: "onenote-swatch", attr: { "aria-label": c.name || c.value || c } });
      sw.style.backgroundColor = c.value !== void 0 ? c.value || "var(--text-highlight-bg)" : c;
      sw.onclick = () => {
        close();
        onPick(c.value !== void 0 ? c.value : c);
      };
    }
  }
  highlightPicker(anchor) {
    this.showPopover(anchor, (pop, close) => {
      pop.createDiv({ cls: "onenote-popover-title", text: "Highlight Colors" });
      this.swatches(pop, HIGHLIGHT_COLORS, (v) => this.edit((e) => v ? wrap(e, `<mark style="background:${v}">`, "</mark>") : wrap(e, "==", "==")), close);
      const none = pop.createDiv({ cls: "onenote-popover-item", text: "No Color" });
      none.onclick = () => {
        close();
        this.edit((e) => e.replaceSelection(e.getSelection().replace(/==|<mark[^>]*>|<\/mark>/g, "")));
      };
    });
  }
  fontColorPicker(anchor) {
    this.showPopover(anchor, (pop, close) => {
      pop.createDiv({ cls: "onenote-popover-title", text: "Font Color" });
      this.swatches(pop, FONT_COLORS, (v) => this.edit((e) => wrap(e, `<span style="color:${v}">`, "</span>")), close);
      const auto = pop.createDiv({ cls: "onenote-popover-item", text: "Automatic" });
      auto.onclick = () => {
        close();
        this.edit((e) => e.replaceSelection(e.getSelection().replace(/<span style="color:[^"]*">|<\/span>/g, "")));
      };
    });
  }
  pageColorPicker(anchor) {
    this.showPopover(anchor, (pop, close) => {
      pop.createDiv({ cls: "onenote-popover-title", text: "Page Color" });
      this.swatches(pop, PAGE_COLORS.filter((c) => c.value), (v) => this.setAppearance("pageColor", v), close);
      const none = pop.createDiv({ cls: "onenote-popover-item", text: "No Color" });
      none.onclick = () => {
        close();
        this.setAppearance("pageColor", "");
      };
    });
  }
  symbolPicker(anchor) {
    this.showPopover(anchor, (pop, close) => {
      pop.createDiv({ cls: "onenote-popover-title", text: "Symbol" });
      const grid = pop.createDiv("onenote-symbol-grid");
      for (const sym of SYMBOLS) {
        const c = grid.createDiv({ cls: "onenote-symbol", text: sym });
        c.onclick = () => {
          close();
          this.edit((e) => e.replaceSelection(sym));
        };
      }
    });
  }
  tablePicker(anchor) {
    this.showPopover(anchor, (pop, close) => {
      const title = pop.createDiv({ cls: "onenote-popover-title", text: "Insert Table" });
      const grid = pop.createDiv("onenote-table-grid");
      const cells = [];
      const ROWS = 8;
      const COLS = 10;
      for (let r = 1; r <= ROWS; r++) {
        for (let c = 1; c <= COLS; c++) {
          const cell = grid.createDiv("onenote-table-cell");
          cells.push({ cell, r, c });
          cell.onmouseenter = () => {
            title.setText(`${c}x${r} Table`);
            for (const x of cells) x.cell.toggleClass("is-on", x.r <= r && x.c <= c);
          };
          cell.onclick = () => {
            close();
            this.edit((e) => insertBlock(e, tableMarkdown(r, c), 2));
          };
        }
      }
    });
  }
};
var main_default = OneNotePlugin;
