/*
 * Draws the ribbon (tabs -> groups -> buttons) and handles everything the user does on
 * it: clicks, right-click menus, drag and drop, the drop-downs for collapsed groups and
 * for "more".
 *
 * The layout itself lives in model.js, the sizing decisions in collapse.js. Obsidian
 * internals are reached only through internal.js.
 *
 * `host` is the plugin. The view needs from it:
 *   app, ribbonLayout, settings.autoCollapseRibbon, state.ribbonTab, state.ribbonCollapsed,
 *   saveRibbon(), runRibbonCommand(id), toggleRibbon(), setAutoCollapseRibbon(on), ribbonButtonState(),
 *   promptText(title, value, cta), confirm(title, message, cta),
 *   exportRibbon(), importRibbon(), resetRibbon()
 */

import { Menu, Notice, Scope, setIcon, getIcon } from 'obsidian';
import * as M from './model.js';
import { fitGroups, fitTabs, LEVEL_FULL, LEVEL_SMALL, LEVEL_ICONS, LEVEL_COLLAPSED } from './collapse.js';
import { findCommand, hotkeyText, missingReason, tintMenuItem } from './internal.js';
import { CommandPickerModal, IconPickerModal } from './modals.js';
import { pressedState } from './state.js';
import { stripOpensRibbon, isDrag, windowPosition, snapZone, snapBounds, sameBounds } from './titlebar.js';

const DRAG_THRESHOLD = 6;
const TAB_HOVER_MS = 450;
const COLOR_LABEL = { accent: 'Accent', red: 'Red', orange: 'Orange', yellow: 'Yellow', green: 'Green', cyan: 'Cyan', blue: 'Blue', purple: 'Purple', pink: 'Pink', none: 'No colour' };
const PRIORITY_LABEL = { first: 'Shrink first', normal: 'Shrink normally', last: 'Shrink last' };

export class RibbonView {
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
    this.tips = new WeakMap(); // button -> its tooltip without the state
    this.onClick = this.onClick.bind(this);
    this.onContextMenu = this.onContextMenu.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onDragKey = this.onDragKey.bind(this);
    this.onOutsideDown = this.onOutsideDown.bind(this);
    this.onOutsideUp = this.onOutsideUp.bind(this);
    this.outsideDown = false;
    this.onStripDown = this.onStripDown.bind(this);
    this.onStripMove = this.onStripMove.bind(this);
    this.onStripUp = this.onStripUp.bind(this);
    this.stripEl = null;
    this.stripPress = null;
    // The bounds a strip drag last snapped this window to, and the size to restore when it
    // is dragged away again ({ bounds, restore: { width, height } }), or null.
    this.snapped = null;
  }

  get layout() { return this.host.ribbonLayout; }

  get doc() { return this.bodyEl ? this.bodyEl.ownerDocument : document; }

  currentTab() {
    return M.activeTab(this.layout, this.host.state.ribbonTab);
  }

  /* ---------- mounting ---------- */

  mount(topBar, tabsEl, bodyEl) {
    this.unmount();
    this.topBar = topBar;
    topBar.toggleClass('is-editing', this.editing);
    this.tabsEl = tabsEl;
    this.bodyEl = bodyEl;
    topBar.addEventListener('click', this.onClick);
    topBar.addEventListener('contextmenu', this.onContextMenu);
    topBar.addEventListener('pointerdown', this.onPointerDown);
    this.stripEl = topBar.querySelector('.onenote-tabrow-spacer');
    if (this.stripEl) this.stripEl.addEventListener('pointerdown', this.onStripDown);
    this.listenDoc = topBar.ownerDocument;
    this.listenDoc.addEventListener('pointerdown', this.onOutsideDown, true);
    this.listenDoc.addEventListener('pointerup', this.onOutsideUp, true);
    let frame = 0;
    this.observer = new ResizeObserver(() => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        if (!this.bodyEl || !this.bodyEl.isConnected) return;
        this.topBar.toggleClass('is-narrow', this.topBar.clientWidth < 640);
        this.fitTabRow();
        this.layoutBody();
      });
    });
    this.observer.observe(topBar);
    this.render();
    this.awaitStyles();
  }

  /**
   * When the plugin is turned on (or updated) while Obsidian is running, its stylesheet
   * arrives a moment after the ribbon is drawn. Widths measured without it are far too
   * wide and every group would end up in "More", so measure again once it is there.
   */
  awaitStyles() {
    window.clearInterval(this.styleTimer);
    const styled = () => {
      const probe = this.topBar.createDiv('onr-strip');
      const ok = getComputedStyle(probe).display === 'flex';
      probe.remove();
      return ok;
    };
    if (styled()) return;
    let tries = 0;
    this.styleTimer = window.setInterval(() => {
      if (!this.topBar || ++tries > 200) { window.clearInterval(this.styleTimer); return; }
      if (!styled()) return;
      window.clearInterval(this.styleTimer);
      this.remeasure();
    }, 50);
  }

  unmount() {
    this.closePopover();
    this.cancelDrag();
    this.popEditScope();
    this.editing = false;
    if (this.observer) this.observer.disconnect();
    this.observer = null;
    window.clearInterval(this.styleTimer);
    if (this.topBar) {
      this.topBar.removeEventListener('click', this.onClick);
      this.topBar.removeEventListener('contextmenu', this.onContextMenu);
      this.topBar.removeEventListener('pointerdown', this.onPointerDown);
    }
    this.endStripPress();
    if (this.stripEl) this.stripEl.removeEventListener('pointerdown', this.onStripDown);
    this.stripEl = null;
    if (this.listenDoc) {
      this.listenDoc.removeEventListener('pointerdown', this.onOutsideDown, true);
      this.listenDoc.removeEventListener('pointerup', this.onOutsideUp, true);
    }
    this.listenDoc = null;
    this.outsideDown = false;
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
    this.topBar.toggleClass('is-editing', on);
    this.popEditScope();
    if (on) {
      // Esc ends customise mode. It goes through Obsidian's key scopes: an open menu or
      // dialog has its own scope on top, so Esc closes that first.
      this.editScope = new Scope(this.app.scope);
      this.editScope.register([], 'Escape', () => {
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
    for (const tab of M.visibleTabs(this.layout)) {
      el.createDiv({
        cls: 'onenote-tab' + (current && tab.id === current.id ? ' is-active' : ''),
        text: tab.name,
        attr: { 'data-tab': tab.id, role: 'tab' },
      });
    }
    if (this.editing) {
      const add = el.createDiv({ cls: 'onenote-tab onr-tab-add', attr: { 'aria-label': 'New tab', 'data-tooltip-position': 'bottom' } });
      setIcon(add, 'plus');
    }
    this.fitTabRow();
  }

  /** Moves tab labels that don't fit into a drop-down at the end of the tab row. */
  fitTabRow() {
    const el = this.tabsEl;
    if (!el || !el.isConnected) return;
    const old = el.querySelector('.onr-tab-more');
    if (old) old.remove();
    const tabs = Array.from(el.querySelectorAll('.onenote-tab[data-tab]'));
    tabs.forEach((t) => t.removeClass('is-overflow', 'is-squeezed'));
    if (!tabs.length || el.clientWidth <= 0 || el.scrollWidth <= el.clientWidth + 1) return;
    const widths = tabs.map((t) => Math.ceil(t.getBoundingClientRect().width) + 2);
    const active = tabs.findIndex((t) => t.hasClass('is-active'));
    const fit = fitTabs({ widths, available: el.clientWidth, active, moreWidth: this.editing ? 68 : 34 });
    fit.overflow.forEach((i) => tabs[i].addClass('is-overflow'));
    if (!fit.overflow.length) return;
    // Even the active tab alone is too wide: let its label shorten with "...".
    if (fit.visible.length === 1 && widths[fit.visible[0]] + 34 > el.clientWidth) tabs[fit.visible[0]].addClass('is-squeezed');
    const more = el.createDiv({ cls: 'onenote-tab onr-tab-more', attr: { 'aria-label': 'More tabs', 'data-tooltip-position': 'bottom' } });
    setIcon(more, 'chevrons-right');
    more.onclick = (e) => {
      e.stopPropagation();
      const menu = new Menu();
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
    // Nothing to do. Not redrawing also keeps the tab element alive for a double-click.
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
    this.topBar.toggleClass('is-ribbon-collapsed', collapsed);
    this.syncStrip();
    if (collapsed) return;

    this.strip = el.createDiv('onr-strip');
    // The key actually assigned (none unless the OneNote shortcuts are on), written the system's way.
    const collapseKeys = hotkeyText(this.app, 'onenote-style:toggle-ribbon');
    const collapse = el.createDiv({ cls: 'onenote-ribbon-collapse', attr: { 'aria-label': collapseKeys ? `Collapse the ribbon (${collapseKeys})` : 'Collapse the ribbon', 'data-tooltip-position': 'left' } });
    setIcon(collapse, 'chevron-up');
    collapse.onclick = () => this.host.toggleRibbon();
    if (this.editing) {
      const done = el.createEl('button', { cls: 'onr-edit-done', text: 'Done', attr: { type: 'button', 'aria-label': 'Customise mode: drag tabs, groups and buttons to move them, use + to add. Click Done or press Esc to finish.', 'data-tooltip-position': 'left' } });
      done.onclick = (e) => { e.stopPropagation(); this.setEditing(false); };
    }

    const tab = this.currentTab();
    if (!tab) return;
    if (!tab.groups.length) {
      const empty = this.strip.createEl('button', { cls: 'onr-empty', attr: { type: 'button' } });
      setIcon(empty.createSpan('onr-empty-icon'), 'plus');
      empty.createSpan({ text: 'Add a group' });
      empty.onclick = (e) => { e.stopPropagation(); this.promptAddGroup(tab.id); };
      this.strip.createSpan({ cls: 'onr-empty-hint', text: 'This tab is empty. Right-click anywhere on the ribbon to customise it.' });
      return;
    }
    this.measure(tab);
    this.layoutBody();
  }

  measureKey(tab) {
    let avail = '';
    for (const g of tab.groups) for (const i of g.items) avail += findCommand(this.app, i.command) ? '1' : '0';
    return [tab.id, this.rev, avail, this.editing ? 'edit' : ''].join('|');
  }

  /** Measures how wide every group of the tab is at each of the four size levels. */
  measure(tab) {
    const key = this.measureKey(tab);
    if (this.measured && this.measured.key === key) return;
    const strip = this.strip;
    strip.addClass('is-measuring');
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
    strip.removeClass('is-measuring');
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
      moreWidth: this.measured.moreWidth,
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
    this.refreshStates();
  }

  /* ---------- button state: pressed (mode is on) and busy (sync is running) ---------- */

  /**
   * Shows which buttons are "on" and which are working. Called after every draw, after a
   * click and on a timer, because a mode can also change by hotkey, in the settings or
   * from another plugin. Only touches the DOM where something changed.
   */
  refreshStates() {
    if (!this.strip || !this.strip.isConnected || this.drag) return;
    const state = this.host.ribbonButtonState();
    this.markButtons(this.strip, state);
    if (this.popover) this.markButtons(this.popover.el, state);
    const more = this.strip.querySelector(':scope > .onr-more .onr-more-button');
    if (more) more.toggleClass('is-busy', (this.moreGroups || []).some((g) => g.items.some((i) => state.busy.has(i.command))));
  }

  markButtons(root, state) {
    root.querySelectorAll('[data-item]').forEach((b) => {
      const command = b.dataset.command;
      const usable = !b.hasClass('is-disabled');
      const pressed = usable ? pressedState(command, state.ctx) : null;
      const busy = usable && state.busy.has(command);
      b.toggleClass('is-pressed', pressed === true);
      b.toggleClass('is-busy', busy);
      const aria = pressed === null ? null : String(pressed);
      if (b.getAttribute('aria-pressed') !== aria) {
        if (aria === null) b.removeAttribute('aria-pressed');
        else b.setAttr('aria-pressed', aria);
      }
      const base = this.tips.get(b);
      if (!base) return;
      const tip = base + (busy ? ' - running...' : pressed ? ' (on)' : '');
      if (b.getAttribute('aria-label') !== tip) b.setAttr('aria-label', tip);
    });
    // A group that is folded into one button moves while one of its buttons is busy.
    root.querySelectorAll('.onr-group.is-collapsed[data-group]').forEach((g) => {
      const found = M.findGroup(this.layout, g.dataset.group);
      const button = g.querySelector('.onr-group-button');
      if (button) button.toggleClass('is-busy', !!found && found.group.items.some((i) => state.busy.has(i.command)));
    });
  }

  drawGroup(parent, group, level) {
    const el = parent.createDiv({ cls: 'onr-group', attr: { 'data-group': group.id, 'data-level': String(level) } });
    if (level === LEVEL_COLLAPSED && group.items.length) {
      el.addClass('is-collapsed');
      const b = el.createEl('button', { cls: 'onr-btn is-large onr-group-button', attr: { type: 'button', 'aria-label': group.name, 'data-tooltip-position': 'bottom', 'aria-haspopup': 'true' } });
      const first = group.items[0];
      this.drawIcon(b.createSpan('onr-btn-icon'), first, findCommand(this.app, first.command), group.name, true);
      b.createSpan({ cls: 'onr-btn-label', text: group.name });
      setIcon(b.createSpan('onr-btn-caret'), 'chevron-down');
      return el;
    }
    const body = el.createDiv('onr-group-body');
    if (!group.items.length) {
      const add = body.createEl('button', { cls: 'onr-btn is-large onr-add', attr: { type: 'button', 'aria-label': 'Add a command to this group', 'data-tooltip-position': 'bottom' } });
      setIcon(add.createSpan('onr-btn-icon'), 'plus');
      add.createSpan({ cls: 'onr-btn-label', text: 'Add' });
    }
    for (const col of M.packColumns(group.items, level)) {
      if (col.kind === 'large') {
        this.drawButton(body, col.items[0], 'large');
      } else {
        const stack = body.createDiv('onr-stack');
        for (const item of col.items) this.drawButton(stack, item, level === LEVEL_ICONS ? 'icon' : 'small');
      }
    }
    if (this.editing && group.items.length) {
      const add = body.createEl('button', { cls: 'onr-btn is-icon onr-add onr-add-inline', attr: { type: 'button', 'aria-label': 'Add a command to this group', 'data-tooltip-position': 'bottom' } });
      setIcon(add.createSpan('onr-btn-icon'), 'plus');
    }
    el.createDiv({ cls: 'onr-group-label', text: group.name });
    return el;
  }

  /** The "New group" tile shown at the end of the ribbon in customise mode. */
  drawNewGroup(parent) {
    const b = parent.createEl('button', { cls: 'onr-btn is-large onr-new-group', attr: { type: 'button', 'aria-label': 'Add a new group to this tab', 'data-tooltip-position': 'bottom' } });
    setIcon(b.createSpan('onr-btn-icon'), 'plus');
    b.createSpan({ cls: 'onr-btn-label', text: 'New group' });
    return b;
  }

  drawButton(parent, item, mode) {
    const cmd = findCommand(this.app, item.command);
    const label = this.labelOf(item, cmd);
    const b = parent.createEl('button', { cls: `onr-btn is-${mode}`, attr: { type: 'button', 'data-item': item.id, 'data-command': item.command, 'data-tooltip-position': 'bottom' } });
    this.drawIcon(b.createSpan('onr-btn-icon'), item, cmd, label, mode === 'large');
    if (mode !== 'icon') b.createSpan({ cls: 'onr-btn-label', text: label });
    if (cmd) {
      const keys = hotkeyText(this.app, item.command);
      const name = cmd.name && cmd.name.toLowerCase() !== label.toLowerCase() ? `${label}: ${cmd.name}` : label;
      b.setAttr('aria-label', keys ? `${name} (${keys})` : name);
      this.tips.set(b, b.getAttribute('aria-label'));
    } else {
      b.addClass('is-disabled');
      b.setAttr('aria-disabled', 'true');
      b.setAttr('aria-label', `${label} - not available. ${missingReason(this.app, item.command)}`);
    }
    return b;
  }

  labelOf(item, cmd) {
    if (item.label) return item.label;
    if (cmd && cmd.name) return cmd.name.replace(/^[^:]{1,40}: /, '');
    const id = item.command;
    return id.slice(id.indexOf(':') + 1).replace(/-/g, ' ');
  }

  drawIcon(el, item, cmd, label, large) {
    const color = M.iconColor(item, large);
    if (color !== 'none') el.dataset.color = color;
    let shown = '';
    for (const id of [item.icon, cmd && cmd.icon]) {
      if (id && /^[\w-]+$/.test(id) && getIcon(id)) {
        setIcon(el, id);
        shown = id;
        break;
      }
    }
    if (shown) {
      // Product logos keep their brand's colour unless the user chose a colour.
      if (shown.startsWith('onenote-ai-') && !item.color) {
        el.dataset.color = 'brand';
        el.dataset.icon = shown;
      }
      return;
    }
    // No usable icon: show the label's first letter in a tile.
    el.addClass('is-glyph');
    el.setText((label.trim()[0] || '?').toUpperCase());
  }

  drawMore(parent, groups) {
    const el = parent.createDiv('onr-more');
    const b = el.createEl('button', { cls: 'onr-btn is-large onr-more-button', attr: { type: 'button', 'aria-label': 'More commands', 'data-tooltip-position': 'bottom', 'aria-haspopup': 'true' } });
    setIcon(b.createSpan('onr-btn-icon'), 'chevrons-right');
    b.createSpan({ cls: 'onr-btn-label', text: 'More' });
    setIcon(b.createSpan('onr-btn-caret'), 'chevron-down');
    this.moreGroups = groups;
    return el;
  }

  /* ---------- drop-downs ---------- */

  openPopover(anchorEl, cls, build) {
    const wasOpen = this.popover && this.popover.anchor === anchorEl;
    this.closePopover();
    if (wasOpen) return;
    const doc = this.doc;
    const pop = doc.body.createDiv('onr-popover ' + cls);
    pop.addEventListener('mousedown', (e) => e.preventDefault());
    pop.addEventListener('click', this.onClick);
    pop.addEventListener('contextmenu', this.onContextMenu);
    build(pop);
    this.markButtons(pop, this.host.ribbonButtonState());
    const r = anchorEl.getBoundingClientRect();
    const vw = doc.documentElement.clientWidth;
    const vh = doc.documentElement.clientHeight;
    pop.style.maxWidth = (vw - 16) + 'px';
    // Open just below the ribbon, so the drop-down doesn't cover the group labels.
    const ribbonBottom = this.bodyEl ? this.bodyEl.getBoundingClientRect().bottom : 0;
    const top = Math.max(r.bottom + 4, ribbonBottom - 1);
    pop.style.maxHeight = Math.max(120, vh - top - 8) + 'px';
    pop.style.top = top + 'px';
    pop.style.left = Math.max(8, Math.min(r.left, vw - pop.offsetWidth - 8)) + 'px';
    const onDown = (e) => {
      if (pop.contains(e.target) || anchorEl.contains(e.target)) return;
      if (e.target.closest && e.target.closest('.menu')) return;
      this.closePopover();
    };
    const onKey = (e) => { if (e.key === 'Escape') this.closePopover(); };
    doc.addEventListener('mousedown', onDown, true);
    doc.addEventListener('keydown', onKey, true);
    anchorEl.addClass('is-open');
    anchorEl.setAttr('aria-expanded', 'true');
    this.popover = {
      el: pop,
      anchor: anchorEl,
      close: () => {
        pop.remove();
        doc.removeEventListener('mousedown', onDown, true);
        doc.removeEventListener('keydown', onKey, true);
        anchorEl.removeClass('is-open');
        anchorEl.setAttr('aria-expanded', 'false');
      },
    };
  }

  closePopover() {
    const p = this.popover;
    if (!p) return;
    this.popover = null;
    p.close();
  }

  openGroupPopover(groupId, anchorEl) {
    const found = M.findGroup(this.layout, groupId);
    if (!found) return;
    this.openPopover(anchorEl, 'onr-popover-group', (pop) => this.drawGroup(pop, found.group, LEVEL_FULL));
  }

  openMorePopover(anchorEl) {
    const groups = this.moreGroups || [];
    this.openPopover(anchorEl, 'onr-popover-more', (pop) => {
      for (const g of groups) {
        const sec = pop.createDiv({ cls: 'onr-more-group', attr: { 'data-group': g.id } });
        sec.createDiv({ cls: 'onr-more-title', text: g.name });
        const body = sec.createDiv('onr-more-items');
        if (!g.items.length) body.createSpan({ cls: 'onr-empty-hint', text: 'Empty group. Right-click to add a command.' });
        for (const item of g.items) this.drawButton(body, item, 'small');
      }
    });
  }

  /* ---------- clicks ---------- */

  onClick(e) {
    if (this.suppressClick) return;
    const t = e.target;
    const tabEl = t.closest('.onenote-tab[data-tab]');
    if (tabEl) { this.selectTab(tabEl.dataset.tab); return; }
    if (t.closest('.onr-tab-add')) { this.promptAddTab(); return; }
    if (t.closest('.onr-new-group')) {
      const tab = this.currentTab();
      if (tab) this.promptAddGroup(tab.id);
      return;
    }
    const itemEl = t.closest('[data-item]');
    if (itemEl && this.editing) {
      // While customising, a click opens the button's menu instead of running it.
      const menu = this.itemMenu(itemEl.dataset.item, e);
      if (menu) menu.showAtMouseEvent(e);
      return;
    }
    if (itemEl) { this.runItem(itemEl.dataset.item, itemEl); return; }
    if (this.editing && t.closest('.onr-group-label')) {
      const menu = this.groupMenu(t.closest('[data-group]').dataset.group);
      if (menu) menu.showAtMouseEvent(e);
      return;
    }
    if (t.closest('.onr-add')) {
      const g = t.closest('[data-group]');
      if (g) this.pickCommand(g.dataset.group);
      return;
    }
    const groupButton = t.closest('.onr-group-button');
    if (groupButton) { this.openGroupPopover(groupButton.closest('[data-group]').dataset.group, groupButton); return; }
    const moreButton = t.closest('.onr-more-button');
    if (moreButton) this.openMorePopover(moreButton);
  }

  runItem(itemId, el) {
    const found = M.findItem(this.layout, itemId);
    if (!found) return;
    this.anchor = { rect: el.getBoundingClientRect(), time: Date.now() };
    this.closePopover();
    if (!findCommand(this.app, found.item.command)) {
      new Notice(`"${this.labelOf(found.item, null)}" is not available. ${missingReason(this.app, found.item.command)}`);
      return;
    }
    const ok = this.host.runRibbonCommand(found.item.command);
    // Auto-collapse: fold the ribbon away once a command has run. Not when the command
    // itself changed the ribbon (collapsed it, started customise mode, or turned
    // auto-collapse on: the pressed button should stay in view).
    const state = this.host.state;
    const own = found.item.command === 'onenote-style:toggle-auto-collapse-ribbon';
    // A command that opened a picker (highlight, font colour) keeps the ribbon open until
    // the user has picked: that click lands outside the ribbon and collapses it then.
    const picking = !!this.doc.querySelector('.onenote-popover');
    if (ok && !own && !picking && this.autoCollapses()) this.host.toggleRibbon();
  }

  /** Auto-collapse is on and the ribbon is open, so a finished command or an outside click folds it. */
  autoCollapses() {
    return !!this.host.settings.autoCollapseRibbon && !this.editing && !this.drag && !!this.topBar && !this.host.state.ribbonCollapsed;
  }

  /*
   * Auto-collapse also folds the ribbon when the user clicks somewhere else without
   * running a command. Menus, dialogs, notices and the ribbon's own drop-downs don't
   * count: they belong to what the user is doing with the ribbon. The ribbon folds after
   * the click is over, so the page doesn't move under the pointer mid-click.
   */
  onOutsideDown(e) {
    const t = e.target;
    this.outsideDown = this.autoCollapses() && !!t && !!t.closest && !this.topBar.contains(t)
      && !t.closest('.onr-popover, .menu, .modal-container, .notice-container, .tooltip');
  }

  onOutsideUp() {
    if (!this.outsideDown) return;
    this.outsideDown = false;
    window.setTimeout(() => { if (this.autoCollapses()) this.host.toggleRibbon(); }, 0);
  }

  /* ---------- the empty strip of the tab row ---------- */

  /*
   * With auto-collapse on and the ribbon folded, a click on the empty strip between the
   * last tab and the search field opens the ribbon again (on the tab that was open), like
   * a tab click. On desktop that strip is normally a window-drag area, which the page
   * never gets clicks from. So while the strip can open the ribbon it is not a drag area
   * (class onr-strip-opens, see styles.css): a plain click opens the ribbon, and a press
   * that moves more than a few pixels moves the window instead, done here through
   * Electron, which also snaps it at the screen edges on release (snapAfterDrag), since
   * Windows Snap only sees native drags. Without Electron's window object (should
   * Obsidian ever stop providing it) the strip stays a native drag area in frameless
   * windows and only tab clicks open the ribbon there; where the strip isn't a drag area (framed windows, mobile) a click
   * always works.
   */
  stripOpens() {
    if (!this.topBar || !this.stripEl) return false;
    const on = stripOpensRibbon({
      autoCollapse: this.host.settings.autoCollapseRibbon,
      collapsed: this.host.state.ribbonCollapsed,
      editing: this.editing,
    });
    if (!on) return false;
    const frameless = this.doc.body.hasClass('is-hidden-frameless');
    return !frameless || !!electronWindow();
  }

  /** Call when auto-collapse, the collapsed state or customise mode changes. */
  syncStrip() {
    if (!this.topBar) return;
    const on = this.stripOpens();
    this.topBar.toggleClass('onr-strip-opens', on);
    if (!on) this.endStripPress();
  }

  onStripDown(e) {
    if (e.button !== 0 || !this.topBar || !this.topBar.hasClass('onr-strip-opens')) return;
    this.endStripPress();
    const el = this.stripEl;
    this.stripPress = { id: e.pointerId, screenX: e.screenX, screenY: e.screenY, clientY: e.clientY, moving: null, cancelled: false, frame: 0 };
    try { el.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ }
    el.addEventListener('pointermove', this.onStripMove);
    el.addEventListener('pointerup', this.onStripUp);
    el.addEventListener('pointercancel', this.onStripUp);
    el.addEventListener('lostpointercapture', this.onStripUp);
  }

  onStripMove(e) {
    const p = this.stripPress;
    if (!p || p.cancelled || e.pointerId !== p.id) return;
    if (!p.moving) {
      if (!isDrag(e.screenX - p.screenX, e.screenY - p.screenY)) return;
      const win = electronWindow();
      // No window to move (mobile, or a framed window the system title bar moves): the
      // press just isn't a click any more.
      if (!win || !this.doc.body.hasClass('is-hidden-frameless') || safe(() => win.isFullScreen())) { p.cancelled = true; return; }
      const snapped = this.snapped;
      this.snapped = null;
      const ratio = Math.min(1, Math.max(0, e.clientX / Math.max(1, this.doc.defaultView.innerWidth)));
      if (safe(() => win.isMaximized())) {
        // Like the native drag: restore the window, keeping the pointer at the same
        // relative spot of the title bar.
        safe(() => win.unmaximize());
        const size = safe(() => win.getSize()) || [this.doc.defaultView.innerWidth];
        p.moving = { win, start: { ratio, width: size[0], y: p.screenY - p.clientY, screenX: p.screenX, screenY: p.screenY } };
      } else if (snapped && sameBounds(safe(() => win.getBounds()), snapped.bounds)) {
        // Dragging a window that a strip drag snapped to half or a quarter of the screen:
        // like Windows, it gets back the size it had before the snap.
        const { width, height } = snapped.restore;
        safe(() => win.setSize(width, height));
        p.moving = { win, start: { ratio, width, y: p.screenY - p.clientY, screenX: p.screenX, screenY: p.screenY } };
      } else {
        const pos = safe(() => win.getPosition());
        if (!pos) { p.cancelled = true; return; }
        p.moving = { win, start: { x: pos[0], y: pos[1], screenX: p.screenX, screenY: p.screenY } };
      }
    }
    p.last = { x: e.screenX, y: e.screenY };
    if (p.frame) return;
    p.frame = window.requestAnimationFrame(() => {
      p.frame = 0;
      if (this.stripPress !== p || !p.moving) return;
      const to = windowPosition(p.moving.start, p.last.x, p.last.y);
      safe(() => p.moving.win.setPosition(to.x, to.y));
    });
  }

  onStripUp(e) {
    const p = this.stripPress;
    if (!p || e.pointerId !== p.id) return;
    const click = e.type === 'pointerup' && !p.moving && !p.cancelled;
    const moved = e.type === 'pointerup' && p.moving && !p.cancelled ? p.moving : null;
    this.endStripPress();
    if (click && this.stripOpens()) this.host.toggleRibbon();
    if (moved) this.snapAfterDrag(moved.win, e.screenX, e.screenY);
  }

  /*
   * Windows Snap (and the Linux desktops' edge tiling) only react to the system's own
   * title-bar drag. The strip drag above moves the window itself, so it snaps the window
   * here instead when it is let go at a screen edge: left or right edge = that half, near a
   * corner = that quarter, top edge = maximised.
   */
  snapAfterDrag(win, screenX, screenY) {
    const body = this.doc.body;
    if (!body.hasClass('mod-windows') && !body.hasClass('mod-linux')) return;
    const screen = electronScreen();
    if (!screen) return;
    const at = { x: Math.round(screenX), y: Math.round(screenY) };
    const display = safe(() => screen.getDisplayNearestPoint(at));
    if (!display) return;
    const zone = snapZone(at.x, at.y, display.bounds);
    if (!zone) return;
    const size = safe(() => win.getSize());
    if (zone === 'maximize') { safe(() => win.maximize()); return; }
    const bounds = snapBounds(zone, display.workArea);
    if (!bounds) return;
    safe(() => win.setBounds(bounds));
    if (size) this.snapped = { bounds: safe(() => win.getBounds()) || bounds, restore: { width: size[0], height: size[1] } };
  }

  endStripPress() {
    const p = this.stripPress;
    if (!p) return;
    this.stripPress = null;
    if (p.frame) window.cancelAnimationFrame(p.frame);
    const el = this.stripEl;
    if (!el) return;
    el.removeEventListener('pointermove', this.onStripMove);
    el.removeEventListener('pointerup', this.onStripUp);
    el.removeEventListener('pointercancel', this.onStripUp);
    el.removeEventListener('lostpointercapture', this.onStripUp);
    try { if (el.hasPointerCapture(p.id)) el.releasePointerCapture(p.id); } catch (err) { /* already released */ }
  }

  /* ---------- right-click menus ---------- */

  onContextMenu(e) {
    const t = e.target;
    if (t.closest('input, textarea, .onenote-section-tabs, .onenote-qat')) return;
    e.preventDefault();
    e.stopPropagation();
    const itemEl = t.closest('[data-item]');
    const groupEl = t.closest('[data-group]');
    const tabEl = t.closest('.onenote-tab[data-tab]');
    let menu;
    if (itemEl) menu = this.itemMenu(itemEl.dataset.item, e);
    else if (groupEl) menu = this.groupMenu(groupEl.dataset.group);
    else {
      const tab = tabEl ? M.findTab(this.layout, tabEl.dataset.tab) : this.currentTab();
      menu = this.tabMenu(tab, !!tabEl);
    }
    if (menu) menu.showAtMouseEvent(e);
  }

  itemMenu(itemId, e) {
    const found = M.findItem(this.layout, itemId);
    if (!found) return null;
    const { item, group, index } = found;
    const L = this.layout;
    const menu = new Menu();
    menu.addItem((i) => i.setTitle('Rename...').setIcon('pencil').onClick(async () => {
      const name = await this.host.promptText('Rename button', this.labelOf(item, findCommand(this.app, item.command)), 'Rename');
      if (name && M.renameItem(L, itemId, name)) this.changed();
    }));
    menu.addItem((i) => i.setTitle('Change icon...').setIcon('image').onClick(() => {
      new IconPickerModal(this.app, (icon) => { if (M.setItemIcon(L, itemId, icon)) this.changed(); }).open();
    }));
    menu.addItem((i) => i.setTitle('Icon colour...').setIcon('palette').onClick(() => {
      const pick = new Menu();
      pick.addItem((x) => x.setTitle('Default').setChecked(!item.color).onClick(() => {
        if (M.setItemColor(L, itemId, '')) this.changed();
      }));
      pick.addSeparator();
      for (const c of M.COLORS) {
        pick.addItem((x) => {
          x.setTitle(COLOR_LABEL[c]).setIcon(c === 'none' ? 'circle-off' : 'circle').setChecked(item.color === c).onClick(() => {
            if (M.setItemColor(L, itemId, c)) this.changed();
          });
          tintMenuItem(x, c);
        });
      }
      pick.showAtPosition({ x: e.clientX, y: e.clientY });
    }));
    if (item.label || item.icon) {
      menu.addItem((i) => i.setTitle('Use the command\'s own name and icon').setIcon('rotate-ccw').onClick(() => {
        M.renameItem(L, itemId, '');
        M.setItemIcon(L, itemId, '');
        this.changed();
      }));
    }
    menu.addSeparator();
    menu.addItem((i) => i.setTitle('Large button').setIcon('square').setChecked(item.size === 'large').onClick(() => {
      if (M.setItemSize(L, itemId, 'large')) this.changed();
    }));
    menu.addItem((i) => i.setTitle('Small button').setIcon('rows-3').setChecked(item.size === 'small').onClick(() => {
      if (M.setItemSize(L, itemId, 'small')) this.changed();
    }));
    menu.addSeparator();
    menu.addItem((i) => i.setTitle('Move left').setIcon('arrow-left').setDisabled(index === 0).onClick(() => {
      if (M.shiftItem(L, itemId, -1)) this.changed();
    }));
    menu.addItem((i) => i.setTitle('Move right').setIcon('arrow-right').setDisabled(index === group.items.length - 1).onClick(() => {
      if (M.shiftItem(L, itemId, 1)) this.changed();
    }));
    menu.addItem((i) => i.setTitle('Move to group...').setIcon('folder-input').onClick(() => {
      const pick = new Menu();
      for (const tab of L.tabs) {
        const groups = tab.groups.filter((g) => g.id !== group.id);
        if (!groups.length) continue;
        pick.addItem((x) => x.setTitle(tab.name).setIsLabel(true));
        for (const g of groups) {
          pick.addItem((x) => x.setTitle(g.name).setIcon('corner-down-right').onClick(() => {
            if (M.moveItem(L, itemId, g.id)) this.changed();
          }));
        }
      }
      pick.showAtPosition({ x: e.clientX, y: e.clientY });
    }));
    menu.addSeparator();
    menu.addItem((i) => i.setTitle('Remove from ribbon').setIcon('trash-2').setWarning(true).onClick(() => {
      if (M.removeItem(L, itemId)) this.changed();
    }));
    return menu;
  }

  groupMenu(groupId) {
    const found = M.findGroup(this.layout, groupId);
    if (!found) return null;
    const { group, tab, index } = found;
    const L = this.layout;
    const menu = new Menu();
    menu.addItem((i) => i.setTitle('Add command...').setIcon('plus').onClick(() => this.pickCommand(groupId)));
    menu.addItem((i) => i.setTitle('Rename group...').setIcon('pencil').onClick(async () => {
      const name = await this.host.promptText('Rename group', group.name, 'Rename');
      if (name && M.renameGroup(L, groupId, name)) this.changed();
    }));
    menu.addSeparator();
    menu.addItem((i) => i.setTitle('Move group left').setIcon('arrow-left').setDisabled(index === 0).onClick(() => {
      if (M.moveGroup(L, groupId, -1)) this.changed();
    }));
    menu.addItem((i) => i.setTitle('Move group right').setIcon('arrow-right').setDisabled(index === tab.groups.length - 1).onClick(() => {
      if (M.moveGroup(L, groupId, 1)) this.changed();
    }));
    menu.addSeparator();
    menu.addItem((i) => i.setTitle('When space runs out').setIsLabel(true));
    for (const p of M.PRIORITIES) {
      menu.addItem((i) => i.setTitle(PRIORITY_LABEL[p]).setChecked(group.priority === p).onClick(() => {
        if (M.setGroupPriority(L, groupId, p)) this.changed();
      }));
    }
    menu.addSeparator();
    menu.addItem((i) => i.setTitle('New group...').setIcon('folder-plus').onClick(() => this.promptAddGroup(tab.id, groupId)));
    this.addEditToggle(menu);
    menu.addItem((i) => i.setTitle('Delete group').setIcon('trash-2').setWarning(true).onClick(async () => {
      if (group.items.length) {
        const ok = await this.host.confirm('Delete group', `Delete the group "${group.name}" and its ${group.items.length} button(s)?`, 'Delete');
        if (!ok) return;
      }
      if (M.removeGroup(L, groupId)) this.changed();
    }));
    return menu;
  }

  tabMenu(tab, onTab) {
    const L = this.layout;
    const menu = new Menu();
    this.addEditToggle(menu);
    menu.addSeparator();
    if (tab) {
      menu.addItem((i) => i.setTitle('New group...').setIcon('folder-plus').onClick(() => this.promptAddGroup(tab.id)));
    }
    menu.addItem((i) => i.setTitle('New tab...').setIcon('plus').onClick(() => this.promptAddTab(tab ? tab.id : null)));
    if (tab) {
      const visible = M.visibleTabs(L);
      const pos = visible.indexOf(tab);
      menu.addItem((i) => i.setTitle(`Rename tab "${tab.name}"...`).setIcon('pencil').onClick(async () => {
        const name = await this.host.promptText('Rename tab', tab.name, 'Rename');
        if (name && M.renameTab(L, tab.id, name)) this.changed();
      }));
      menu.addItem((i) => i.setTitle('Move tab left').setIcon('arrow-left').setDisabled(pos <= 0).onClick(() => {
        if (M.moveTab(L, tab.id, -1)) this.changed();
      }));
      menu.addItem((i) => i.setTitle('Move tab right').setIcon('arrow-right').setDisabled(pos < 0 || pos === visible.length - 1).onClick(() => {
        if (M.moveTab(L, tab.id, 1)) this.changed();
      }));
      menu.addItem((i) => i.setTitle(`Hide tab "${tab.name}"`).setIcon('eye-off').setDisabled(visible.length <= 1).onClick(() => {
        if (M.setTabHidden(L, tab.id, true)) this.changed();
      }));
      menu.addItem((i) => i.setTitle(`Delete tab "${tab.name}"...`).setIcon('trash-2').setWarning(true).setDisabled(visible.length <= 1).onClick(async () => {
        const ok = await this.host.confirm('Delete tab', `Delete the tab "${tab.name}" with all its groups and buttons? To keep it for later, hide it instead.`, 'Delete');
        if (ok && M.removeTab(L, tab.id)) this.changed();
      }));
    }
    const hidden = L.tabs.filter((t) => t.hidden);
    if (hidden.length) {
      menu.addSeparator();
      menu.addItem((i) => i.setTitle('Hidden tabs').setIsLabel(true));
      for (const t of hidden) {
        menu.addItem((i) => i.setTitle(`Show "${t.name}"`).setIcon('eye').onClick(() => {
          if (M.setTabHidden(L, t.id, false)) { this.host.state.ribbonTab = t.id; this.changed(); }
        }));
      }
    }
    menu.addSeparator();
    menu.addItem((i) => i.setTitle('Export layout...').setIcon('download').onClick(() => this.host.exportRibbon()));
    menu.addItem((i) => i.setTitle('Import layout...').setIcon('upload').onClick(() => this.host.importRibbon()));
    menu.addItem((i) => i.setTitle('Reset to default...').setIcon('rotate-ccw').onClick(() => this.host.resetRibbon()));
    if (!onTab) {
      menu.addSeparator();
      menu.addItem((i) => i.setTitle('Collapse the ribbon').setIcon('chevron-up').onClick(() => this.host.toggleRibbon()));
      const auto = !!this.host.settings.autoCollapseRibbon;
      menu.addItem((i) => i.setTitle('Auto-collapse after a command').setIcon('fold-vertical').setChecked(auto).onClick(() => this.host.setAutoCollapseRibbon(!auto)));
    }
    return menu;
  }

  addEditToggle(menu) {
    if (this.editing) menu.addItem((i) => i.setTitle('Done customising').setIcon('check').onClick(() => this.setEditing(false)));
    else menu.addItem((i) => i.setTitle('Customise with drag and drop').setIcon('move').onClick(() => this.setEditing(true)));
  }

  async promptAddTab(afterTabId) {
    const name = await this.host.promptText('New tab', '', 'Add');
    if (!name) return;
    const current = this.currentTab();
    const created = M.addTab(this.layout, name, afterTabId || (current ? current.id : null));
    this.host.state.ribbonTab = created.id;
    this.changed();
  }

  pickCommand(groupId) {
    new CommandPickerModal(this.app, (cmd) => {
      if (M.addItem(this.layout, groupId, cmd.id, { size: 'small' })) this.changed();
    }).open();
  }

  async promptAddGroup(tabId, afterGroupId) {
    const name = await this.host.promptText('New group', '', 'Add');
    if (!name) return;
    const group = M.addGroup(this.layout, tabId, name, afterGroupId);
    if (!group) return;
    this.changed();
    this.pickCommand(group.id);
  }

  /* ---------- drag and drop (pointer events, so it also works with touch) ---------- */

  onPointerDown(e) {
    if (e.button !== 0 || !this.strip) return;
    const t = e.target;
    let press = null;
    const itemEl = t.closest('[data-item]');
    if (itemEl && this.strip.contains(itemEl)) {
      press = { kind: 'item', id: itemEl.dataset.item, el: itemEl };
    } else if (this.editing) {
      // In customise mode tabs and groups (by their label) can be dragged too.
      const tabEl = t.closest('.onenote-tab[data-tab]');
      const groupEl = t.closest('.onr-group[data-group]');
      if (tabEl) press = { kind: 'tab', id: tabEl.dataset.tab, el: tabEl, label: tabEl.textContent };
      else if (groupEl && this.strip.contains(groupEl) && t.closest('.onr-group-label, .onr-group-button')) {
        const found = M.findGroup(this.layout, groupEl.dataset.group);
        if (found) press = { kind: 'group', id: found.group.id, el: groupEl, label: found.group.name };
      }
    }
    if (!press) return;
    press.x = e.clientX;
    press.y = e.clientY;
    this.press = press;
    const doc = this.doc;
    doc.addEventListener('pointermove', this.onPointerMove, true);
    doc.addEventListener('pointerup', this.onPointerUp, true);
    doc.addEventListener('pointercancel', this.onPointerUp, true);
    doc.addEventListener('keydown', this.onDragKey, true);
  }

  onPointerMove(e) {
    const p = this.press;
    if (!p) return;
    if (!this.drag) {
      if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < DRAG_THRESHOLD) return;
      this.startDrag(p);
    }
    const d = this.drag;
    d.ghost.style.left = (e.clientX + 10) + 'px';
    d.ghost.style.top = (e.clientY + 12) + 'px';
    this.updateDropTarget(e.clientX, e.clientY);
  }

  startDrag(p) {
    this.closePopover();
    const doc = this.doc;
    let ghost;
    if (p.kind === 'item') {
      ghost = p.el.cloneNode(true);
      ghost.removeAttribute('data-item');
      ghost.removeAttribute('aria-label');
      ghost.addClass('onr-ghost');
      doc.body.appendChild(ghost);
    } else {
      ghost = doc.body.createDiv({ cls: 'onr-ghost-chip', text: p.label });
    }
    const line = doc.body.createDiv('onr-drop-line');
    p.el.addClass('is-drag-source');
    this.topBar.addClass('is-dragging');
    this.drag = { kind: p.kind, id: p.id, ghost, line, target: null, hoverTab: null, hoverTimer: 0 };
  }

  updateDropTarget(x, y) {
    const d = this.drag;
    const doc = this.doc;
    d.target = null;
    d.line.style.display = 'none';
    doc.querySelectorAll('.onr-group.is-drop-target').forEach((g) => g.removeClass('is-drop-target'));
    const under = doc.elementFromPoint(x, y);
    const tabEl = under && under.closest('.onenote-tab[data-tab]');
    const tabId = tabEl ? tabEl.dataset.tab : null;
    const edge = (r, before) => {
      const s = d.line.style;
      s.display = 'block';
      s.left = (before ? r.left - 1 : r.right - 1) + 'px';
      s.top = r.top + 'px';
      s.width = '2px';
      s.height = r.height + 'px';
    };
    if (d.kind === 'tab') {
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
        // Hovering over another tab while dragging switches to it.
        d.hoverTimer = window.setTimeout(() => {
          if (this.drag !== d) return;
          this.host.state.ribbonTab = tabId;
          this.render();
        }, TAB_HOVER_MS);
      }
    }
    if (!under || !this.strip || !this.strip.contains(under)) return;
    const groupEl = under.closest('[data-group]');
    if (d.kind === 'group') {
      const tab = this.currentTab();
      if (!tab) return;
      if (!groupEl) { d.target = { tabId: tab.id }; return; } // empty space: to the end
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
    const found = M.findGroup(this.layout, groupEl.dataset.group);
    if (!found) return;
    const itemEl = under.closest('[data-item]');
    if (itemEl && itemEl.dataset.item === d.id) return;
    if (itemEl) {
      const index = found.group.items.findIndex((i) => i.id === itemEl.dataset.item);
      const r = itemEl.getBoundingClientRect();
      const sideways = itemEl.hasClass('is-large');
      const before = sideways ? x < r.left + r.width / 2 : y < r.top + r.height / 2;
      d.target = { groupId: found.group.id, index: index + (before ? 0 : 1) };
      const s = d.line.style;
      s.display = 'block';
      if (sideways) {
        s.left = (before ? r.left - 2 : r.right) + 'px';
        s.top = r.top + 'px';
        s.width = '2px';
        s.height = r.height + 'px';
      } else {
        s.left = r.left + 'px';
        s.top = (before ? r.top - 1 : r.bottom - 1) + 'px';
        s.width = r.width + 'px';
        s.height = '2px';
      }
      return;
    }
    d.target = { groupId: found.group.id };
    groupEl.addClass('is-drop-target');
  }

  onPointerUp() {
    const d = this.drag;
    const target = d && d.target;
    this.cancelDrag();
    if (!d) return;
    // The click that follows a drag must not run the button.
    this.suppressClick = true;
    window.setTimeout(() => { this.suppressClick = false; }, 0);
    let moved = false;
    if (target && d.kind === 'item') moved = M.moveItem(this.layout, d.id, target.groupId, target.index);
    else if (target && d.kind === 'group') moved = M.moveGroupTo(this.layout, d.id, target.tabId, target.index);
    else if (target && d.kind === 'tab') moved = M.moveTabNextTo(this.layout, d.id, target.tabId, target.after);
    if (moved) this.changed();
    else this.render();
  }

  onDragKey(e) {
    if (e.key !== 'Escape' || !this.drag) return;
    e.preventDefault();
    e.stopPropagation();
    this.cancelDrag();
    this.render();
  }

  cancelDrag() {
    const doc = this.doc;
    doc.removeEventListener('pointermove', this.onPointerMove, true);
    doc.removeEventListener('pointerup', this.onPointerUp, true);
    doc.removeEventListener('pointercancel', this.onPointerUp, true);
    doc.removeEventListener('keydown', this.onDragKey, true);
    this.press = null;
    const d = this.drag;
    this.drag = null;
    if (!d) return;
    window.clearTimeout(d.hoverTimer);
    d.ghost.remove();
    d.line.remove();
    doc.querySelectorAll('.is-drag-source').forEach((x) => x.removeClass('is-drag-source'));
    doc.querySelectorAll('.onr-group.is-drop-target').forEach((g) => g.removeClass('is-drop-target'));
    if (this.topBar) this.topBar.removeClass('is-dragging');
  }
}

/** Electron's window object for this (desktop) window, or null (mobile, or not available). */
let cachedWindow;
function electronWindow() {
  if (cachedWindow === undefined) cachedWindow = findElectronWindow();
  return cachedWindow;
}

function findElectronWindow() {
  try {
    const req = window.require;
    if (!req) return null;
    const electron = req('electron');
    const remote = (electron && electron.remote) || req('@electron/remote');
    const win = remote && remote.getCurrentWindow && remote.getCurrentWindow();
    return win && typeof win.setPosition === 'function' ? win : null;
  } catch (err) {
    return null;
  }
}

/** Electron's screen module (display bounds and work areas), or null. */
function electronScreen() {
  try {
    const req = window.require;
    if (!req) return null;
    const electron = req('electron');
    const remote = (electron && electron.remote) || req('@electron/remote');
    const screen = remote && remote.screen;
    return screen && typeof screen.getDisplayNearestPoint === 'function' ? screen : null;
  } catch (err) {
    return null;
  }
}

function safe(fn) {
  try { return fn(); } catch (err) { return null; }
}
