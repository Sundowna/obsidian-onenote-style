/*
 * Draws the ribbon (tabs -> groups -> buttons) and handles everything the user does on
 * it: clicks, right-click menus, drag and drop, the drop-downs for collapsed groups and
 * for "more".
 *
 * The layout itself lives in model.js, the sizing decisions in collapse.js. Obsidian
 * internals are reached only through internal.js.
 *
 * `host` is the plugin. The view needs from it:
 *   app, ribbonLayout, state.ribbonTab, state.ribbonCollapsed,
 *   saveRibbon(), runRibbonCommand(id), toggleRibbon(),
 *   promptText(title, value, cta), confirm(title, message, cta),
 *   exportRibbon(), importRibbon(), resetRibbon()
 */

import { Menu, Notice, setIcon, getIcon } from 'obsidian';
import * as M from './model.js';
import { fitGroups, fitTabs, LEVEL_FULL, LEVEL_SMALL, LEVEL_ICONS, LEVEL_COLLAPSED } from './collapse.js';
import { findCommand, hotkeyText, missingReason } from './internal.js';
import { CommandPickerModal, IconPickerModal } from './modals.js';

const DRAG_THRESHOLD = 6;
const TAB_HOVER_MS = 450;
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
    this.onClick = this.onClick.bind(this);
    this.onContextMenu = this.onContextMenu.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onDragKey = this.onDragKey.bind(this);
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
    this.tabsEl = tabsEl;
    this.bodyEl = bodyEl;
    topBar.addEventListener('click', this.onClick);
    topBar.addEventListener('contextmenu', this.onContextMenu);
    topBar.addEventListener('pointerdown', this.onPointerDown);
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
  }

  unmount() {
    this.closePopover();
    this.cancelDrag();
    if (this.observer) this.observer.disconnect();
    this.observer = null;
    if (this.topBar) {
      this.topBar.removeEventListener('click', this.onClick);
      this.topBar.removeEventListener('contextmenu', this.onContextMenu);
      this.topBar.removeEventListener('pointerdown', this.onPointerDown);
    }
    this.topBar = this.tabsEl = this.bodyEl = this.strip = null;
  }

  render() {
    this.renderTabs();
    this.renderBody();
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
    if (!this.bodyEl || !this.strip || this.drag || this.popover) return;
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
    this.fitTabRow();
  }

  /** Moves tab labels that don't fit into a drop-down at the end of the tab row. */
  fitTabRow() {
    const el = this.tabsEl;
    if (!el || !el.isConnected) return;
    const old = el.querySelector('.onr-tab-more');
    if (old) old.remove();
    const tabs = Array.from(el.querySelectorAll('.onenote-tab'));
    tabs.forEach((t) => t.removeClass('is-overflow'));
    if (!tabs.length || el.clientWidth <= 0 || el.scrollWidth <= el.clientWidth + 1) return;
    const widths = tabs.map((t) => Math.ceil(t.getBoundingClientRect().width) + 2);
    const active = tabs.findIndex((t) => t.hasClass('is-active'));
    const fit = fitTabs({ widths, available: el.clientWidth, active, moreWidth: 34 });
    fit.overflow.forEach((i) => tabs[i].addClass('is-overflow'));
    if (!fit.overflow.length) return;
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
    if (collapsed) return;

    this.strip = el.createDiv('onr-strip');
    const collapse = el.createDiv({ cls: 'onenote-ribbon-collapse', attr: { 'aria-label': 'Collapse the ribbon (Ctrl+F1)', 'data-tooltip-position': 'left' } });
    setIcon(collapse, 'chevron-up');
    collapse.onclick = () => this.host.toggleRibbon();

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
    return [tab.id, this.rev, avail].join('|');
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
    strip.removeClass('is-measuring');
    this.measured = { key, widths, moreWidth };
  }

  /** Picks a size level for every group so the tab fits the current width, then draws it. */
  layoutBody() {
    const strip = this.strip;
    const tab = this.currentTab();
    if (!strip || !strip.isConnected || !tab || !tab.groups.length || !this.measured) return;
    const available = Math.floor(strip.clientWidth);
    if (available <= 0) return;
    const fit = fitGroups({
      groups: tab.groups.map((g) => ({ id: g.id, priority: g.priority, widths: this.measured.widths[g.id] })),
      available,
      gap: 0,
      moreWidth: this.measured.moreWidth,
    });
    const key = JSON.stringify([fit.levels, fit.overflow]);
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
    strip.dataset.fit = key;
  }

  drawGroup(parent, group, level) {
    const el = parent.createDiv({ cls: 'onr-group', attr: { 'data-group': group.id, 'data-level': String(level) } });
    if (level === LEVEL_COLLAPSED && group.items.length) {
      el.addClass('is-collapsed');
      const b = el.createEl('button', { cls: 'onr-btn is-large onr-group-button', attr: { type: 'button', 'aria-label': group.name, 'data-tooltip-position': 'bottom', 'aria-haspopup': 'true' } });
      const first = group.items[0];
      this.drawIcon(b.createSpan('onr-btn-icon'), first, findCommand(this.app, first.command), group.name);
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
    el.createDiv({ cls: 'onr-group-label', text: group.name });
    return el;
  }

  drawButton(parent, item, mode) {
    const cmd = findCommand(this.app, item.command);
    const label = this.labelOf(item, cmd);
    const b = parent.createEl('button', { cls: `onr-btn is-${mode}`, attr: { type: 'button', 'data-item': item.id, 'data-tooltip-position': 'bottom' } });
    this.drawIcon(b.createSpan('onr-btn-icon'), item, cmd, label);
    if (mode !== 'icon') b.createSpan({ cls: 'onr-btn-label', text: label });
    if (cmd) {
      const keys = hotkeyText(this.app, item.command);
      const name = cmd.name && cmd.name.toLowerCase() !== label.toLowerCase() ? `${label}: ${cmd.name}` : label;
      b.setAttr('aria-label', keys ? `${name} (${keys})` : name);
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

  drawIcon(el, item, cmd, label) {
    for (const id of [item.icon, cmd && cmd.icon]) {
      if (id && /^[\w-]+$/.test(id) && getIcon(id)) {
        setIcon(el, id);
        return;
      }
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
    const r = anchorEl.getBoundingClientRect();
    const vw = doc.documentElement.clientWidth;
    const vh = doc.documentElement.clientHeight;
    pop.style.maxWidth = (vw - 16) + 'px';
    const top = r.bottom + 4;
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
    const itemEl = t.closest('[data-item]');
    if (itemEl) { this.runItem(itemEl.dataset.item, itemEl); return; }
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
    this.host.runRibbonCommand(found.item.command);
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
    if (tab) {
      menu.addItem((i) => i.setTitle('New group...').setIcon('folder-plus').onClick(() => this.promptAddGroup(tab.id)));
      menu.addSeparator();
    }
    menu.addItem((i) => i.setTitle('New tab...').setIcon('plus').onClick(async () => {
      const name = await this.host.promptText('New tab', '', 'Add');
      if (!name) return;
      const created = M.addTab(L, name, tab ? tab.id : null);
      this.host.state.ribbonTab = created.id;
      this.changed();
    }));
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
    }
    return menu;
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
    const el = e.target.closest('[data-item]');
    if (!el || !this.strip.contains(el)) return;
    this.press = { id: el.dataset.item, x: e.clientX, y: e.clientY, el };
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
    const ghost = p.el.cloneNode(true);
    ghost.removeAttribute('data-item');
    ghost.removeAttribute('aria-label');
    ghost.addClass('onr-ghost');
    doc.body.appendChild(ghost);
    const line = doc.body.createDiv('onr-drop-line');
    p.el.addClass('is-drag-source');
    this.topBar.addClass('is-dragging');
    this.drag = { id: p.id, ghost, line, target: null, hoverTab: null, hoverTimer: 0 };
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
    if (target && M.moveItem(this.layout, d.id, target.groupId, target.index)) this.changed();
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
