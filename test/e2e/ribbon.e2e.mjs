// End-to-end tests of the ribbon inside a real (sandboxed) Obsidian.
import { browser, expect } from '@wdio/globals';
import {
  openSample, resetLayout, selectTab, setDark, setSize, ribbonState, withPlugin, layout, pause,
  rightClick, clickMenu, menuTitles, closeMenus, answerPrompt,
} from './helpers.mjs';

const item = (command) => withPlugin((plugin, app, cmd) => {
  for (const t of plugin.ribbonLayout.tabs) for (const g of t.groups) for (const i of g.items) if (i.command === cmd) return { id: i.id, group: g.id, tab: t.id, size: i.size, label: i.label, icon: i.icon };
  return null;
}, command);
const groupItems = async (groupId) => {
  const L = await layout();
  for (const t of L.tabs) for (const g of t.groups) if (g.id === groupId) return g.items.map((i) => i.command);
  return null;
};
const btn = (id) => `.onenote-ribbon [data-item="${id}"]`;

/** Drags with real pointer input, in small steps like a hand would. */
async function drag(fromSel, toSel, toOffset) {
  const from = await browser.$(fromSel);
  const to = await browser.$(toSel);
  const a = await browser.execute((el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, from);
  const b = await browser.execute((el, o) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width * o.x, y: r.top + r.height * o.y }; }, to, toOffset || { x: 0.5, y: 0.5 });
  const steps = [];
  for (let i = 1; i <= 8; i++) steps.push({ x: Math.round(a.x + ((b.x - a.x) * i) / 8), y: Math.round(a.y + ((b.y - a.y) * i) / 8) });
  let act = browser.action('pointer', { parameters: { pointerType: 'mouse' } }).move({ x: Math.round(a.x), y: Math.round(a.y) }).down({ button: 0 }).pause(60);
  for (const s of steps) act = act.move({ x: s.x, y: s.y, duration: 40 });
  await act.pause(120).up({ button: 0 }).perform();
  await pause(250);
}

describe('ribbon', () => {
  before(async () => {
    await setSize(1920, 1040);
    await openSample();
  });

  beforeEach(async () => {
    await closeMenus();
    await setDark(false);
    await setSize(1920, 1040);
    await resetLayout();
  });

  describe('load', () => {
    it('shows the ribbon above the workspace with the twelve default tabs', async () => {
      const s = await ribbonState();
      expect(s.tabs).toEqual(['Home', 'Insert', 'View', 'Table', 'Navigate', 'Templates', 'Canvas', 'References', 'Review', 'Data', 'Slides', 'Utilities']);
      expect(s.active).toBe('Home');
      expect(s.groups.length).toBe(8);
      expect(s.groups.every((g) => g.level === 0)).toBe(true);
      const order = await browser.execute(() => {
        const bar = document.querySelector('.onenote-topbar');
        return bar.nextElementSibling.classList.contains('horizontal-main-container') && bar.parentElement.classList.contains('app-container');
      });
      expect(order).toBe(true);
    });

    it('leaves Obsidian\'s own ribbon and menus alone', async () => {
      const own = await browser.execute(() => ({
        ribbon: !!document.querySelector('.workspace-ribbon.mod-left, .workspace-ribbon.mod-primary'),
        actions: document.querySelectorAll('.workspace-ribbon .side-dock-ribbon-action').length,
      }));
      expect(own.ribbon).toBe(true);
      expect(own.actions).toBeGreaterThan(0);
    });

    it('every default icon exists, and every default command exists or is greyed out', async () => {
      const r = await withPlugin((plugin, app, require) => {
        const out = { icons: [], missing: [] };
        for (const t of plugin.ribbonLayout.tabs) for (const g of t.groups) for (const i of g.items) {
          if (!app.commands.commands[i.command]) out.missing.push(i.command);
        }
        return out;
      });
      const glyphs = [];
      for (const tab of (await layout()).tabs) {
        await selectTab(tab.id);
        glyphs.push(...await browser.execute(() => Array.from(document.querySelectorAll('.onr-strip .onr-btn-icon.is-glyph')).map((e) => e.parentElement.getAttribute('aria-label'))));
      }
      expect(glyphs).toEqual([]);
      // In the sandbox only AI ChatBridge (not installed) and the Slides core plugin (off) are missing.
      expect(r.missing.filter((c) => !c.startsWith('ai-chatbridge:') && c !== 'slides:start')).toEqual([]);
    });

    it('switches tabs by click and collapses by double-click', async () => {
      await browser.$('.onenote-tab[data-tab="insert"]').click();
      expect((await ribbonState()).active).toBe('Insert');
      await browser.$('.onenote-tab[data-tab="insert"]').doubleClick();
      await pause(200);
      expect(await browser.$('.onenote-topbar.is-ribbon-collapsed').isExisting()).toBe(true);
      await browser.$('.onenote-tab[data-tab="view"]').click();
      await pause(200);
      expect(await browser.$('.onenote-topbar.is-ribbon-collapsed').isExisting()).toBe(false);
      expect((await ribbonState()).active).toBe('View');
    });
  });

  describe('running commands', () => {
    it('a button runs its command on the selected text and keeps the editor focused', async () => {
      await withPlugin((plugin, app) => {
        const editor = app.workspace.activeEditor.editor;
        editor.setValue('alpha beta gamma');
        editor.setSelection({ line: 0, ch: 6 }, { line: 0, ch: 10 });
        editor.focus();
      });
      const bold = await item('editor:toggle-bold');
      await browser.$(btn(bold.id)).click();
      await pause(200);
      const r = await withPlugin((plugin, app) => ({
        text: app.workspace.activeEditor.editor.getValue(),
        focused: app.workspace.activeEditor.editor.hasFocus(),
      }));
      expect(r.text).toBe('alpha **beta** gamma');
      expect(r.focused).toBe(true);
    });

    it('a picker opens under the button that was clicked', async () => {
      await selectTab('insert');
      const table = await item('onenote-style:insert-table-grid');
      await browser.$(btn(table.id)).click();
      const pop = await browser.$('.onenote-popover .onenote-table-grid');
      await pop.waitForExist({ timeout: 3000 });
      const pos = await browser.execute((sel) => {
        const b = document.querySelector(sel).getBoundingClientRect();
        const p = document.querySelector('.onenote-popover').getBoundingClientRect();
        return { dx: Math.abs(p.left - b.left), dy: p.top - b.bottom };
      }, btn(table.id));
      expect(pos.dx).toBeLessThan(6);
      expect(pos.dy).toBeGreaterThanOrEqual(0);
      expect(pos.dy).toBeLessThan(12);
      await browser.keys('Escape');
    });
  });

  describe('missing plugin', () => {
    it('greys out a button whose plugin is not installed, with a tooltip, and never crashes', async () => {
      await withPlugin((plugin) => {
        plugin.ribbonLayout.tabs[0].groups[0].items.push({ id: 'ghost', command: 'no-such-plugin:do-something', size: 'large', label: 'Ghost' });
        plugin.ribbon.changed();
      });
      const ghost = await browser.$(btn('ghost'));
      expect(await ghost.getAttribute('aria-disabled')).toBe('true');
      expect(await ghost.getAttribute('aria-label')).toMatch(/Ghost - not available.*no-such-plugin.*not installed/i);
      // AI ChatBridge is installed in the test vault but turned off
      const sync = await item('ai-chatbridge:sync-all-chats');
      const el = await browser.$(btn(sync.id));
      expect(await el.getAttribute('aria-disabled')).toBe('true');
      expect((await el.getAttribute('class')).includes('is-disabled')).toBe(true);
      expect(await el.getAttribute('aria-label')).toMatch(/not available.*AI ChatBridge.*turned off/i);
      await el.click();
      await pause(200);
      const notice = await browser.execute(() => Array.from(document.querySelectorAll('.notice')).map((n) => n.textContent).join(' | '));
      expect(notice).toMatch(/not available/i);
      expect((await ribbonState()).groups.length).toBe(8);
    });

    it('greys a button out when its plugin is turned off, and brings it back when turned on', async () => {
      await selectTab('utilities');
      const merge = await item('editing-toolbar:merge-lines');
      await browser.waitUntil(async () => (await browser.$(btn(merge.id)).getAttribute('aria-disabled')) === null, { timeout: 6000 });
      await withPlugin((plugin, app) => app.plugins.disablePluginAndSave('editing-toolbar'));
      await browser.waitUntil(async () => (await browser.$(btn(merge.id)).getAttribute('aria-disabled')) === 'true', { timeout: 6000 });
      expect(await browser.$(btn(merge.id)).getAttribute('aria-label')).toMatch(/Editing Toolbar.*turned off/i);
      await withPlugin((plugin, app) => app.plugins.enablePluginAndSave('editing-toolbar'));
      await browser.waitUntil(async () => (await browser.$(btn(merge.id)).getAttribute('aria-disabled')) === null, { timeout: 6000 });
    });

    it('names the core plugin that is turned off (Slides)', async () => {
      await selectTab('slides');
      const start = await item('slides:start');
      expect(await browser.$(btn(start.id)).getAttribute('aria-label')).toMatch(/core plugin.*turned off/i);
    });
  });

  describe('right-click on a button', () => {
    it('offers remove, move to group, change icon, rename, large/small, move left/right', async () => {
      const cut = await item('onenote-style:cut');
      await rightClick(btn(cut.id));
      expect(await menuTitles()).toEqual(['Rename...', 'Change icon...', 'Icon colour...', 'Use the command\'s own name and icon', 'Large button', 'Small button', 'Move left', 'Move right', 'Move to group...', 'Remove from ribbon']);
    });

    it('large / small', async () => {
      const cut = await item('onenote-style:cut');
      await rightClick(btn(cut.id));
      await clickMenu('Large button');
      expect((await item('onenote-style:cut')).size).toBe('large');
      expect((await browser.$(btn(cut.id)).getAttribute('class')).includes('is-large')).toBe(true);
      await rightClick(btn(cut.id));
      await clickMenu('Small button');
      expect((await browser.$(btn(cut.id)).getAttribute('class')).includes('is-small')).toBe(true);
    });

    it('rename', async () => {
      const cut = await item('onenote-style:cut');
      await rightClick(btn(cut.id));
      await clickMenu('Rename...');
      await answerPrompt('Snip');
      expect(await browser.$(btn(cut.id)).getText()).toBe('Snip');
    });

    it('change icon', async () => {
      const cut = await item('onenote-style:cut');
      await rightClick(btn(cut.id));
      await clickMenu('Change icon...');
      const input = await browser.$('.prompt .prompt-input');
      await input.waitForExist({ timeout: 5000 });
      await input.setValue('rocket');
      await pause(300);
      await browser.keys('Enter');
      await pause(300);
      expect((await item('onenote-style:cut')).icon).toBe('rocket');
      expect(await browser.$(`${btn(cut.id)} svg.lucide-rocket`).isExisting()).toBe(true);
    });

    it('icon colour', async () => {
      const cut = await item('onenote-style:cut');
      const colorOf = () => browser.execute((sel) => {
        const el = document.querySelector(sel + ' .onr-btn-icon');
        return { name: el.dataset.color || null, css: getComputedStyle(el).color };
      }, btn(cut.id));
      const plain = await colorOf();
      expect(plain.name).toBe(null);
      await rightClick(btn(cut.id));
      await clickMenu('Icon colour...');
      expect(await menuTitles()).toEqual(['Default', 'Accent', 'Red', 'Orange', 'Yellow', 'Green', 'Cyan', 'Blue', 'Purple', 'Pink', 'No colour']);
      await clickMenu('Red');
      const red = await colorOf();
      expect(red.name).toBe('red');
      expect(red.css).not.toBe(plain.css);
      // large icons use the accent colour unless told otherwise; defaults carry colours
      const paste = await item('onenote-style:paste');
      expect(await browser.$(btn(paste.id) + ' .onr-btn-icon').getAttribute('data-color')).toBe('accent');
      const star = await item('onenote-style:tag-important');
      expect(await browser.$(btn(star.id) + ' .onr-btn-icon').getAttribute('data-color')).toBe('yellow');
    });

    it('move left / right', async () => {
      const before = await groupItems('home-clipboard');
      const cut = await item('onenote-style:cut');
      await rightClick(btn(cut.id));
      await clickMenu('Move right');
      const after = await groupItems('home-clipboard');
      expect(after.indexOf('onenote-style:cut')).toBe(before.indexOf('onenote-style:cut') + 1);
      await rightClick(btn(cut.id));
      await clickMenu('Move left');
      expect(await groupItems('home-clipboard')).toEqual(before);
    });

    it('move to group', async () => {
      const cut = await item('onenote-style:cut');
      await rightClick(btn(cut.id));
      await clickMenu('Move to group...');
      await clickMenu('Styles');
      expect((await item('onenote-style:cut')).group).toBe('home-styles');
      expect((await groupItems('home-clipboard')).includes('onenote-style:cut')).toBe(false);
    });

    it('remove', async () => {
      const cut = await item('onenote-style:cut');
      await rightClick(btn(cut.id));
      await clickMenu('Remove from ribbon');
      expect(await item('onenote-style:cut')).toBe(null);
      expect(await browser.$(btn(cut.id)).isExisting()).toBe(false);
    });
  });

  describe('right-click on a group', () => {
    const label = '.onr-group[data-group="home-styles"] .onr-group-label';

    it('offers rename, add command, reorder, collapse priority, delete', async () => {
      await rightClick(label);
      expect(await menuTitles()).toEqual(['Add command...', 'Rename group...', 'Move group left', 'Move group right', 'Shrink first', 'Shrink normally', 'Shrink last', 'New group...', 'Customise with drag and drop', 'Delete group']);
    });

    it('add command with the searchable picker', async () => {
      await rightClick(label);
      await clickMenu('Add command...');
      const input = await browser.$('.prompt .prompt-input');
      await input.waitForExist({ timeout: 5000 });
      await input.setValue('Open graph view');
      await pause(300);
      await browser.keys('Enter');
      await pause(300);
      expect((await groupItems('home-styles')).at(-1)).toBe('graph:open');
      const added = await item('graph:open');
      expect(await browser.$(btn(added.id)).getText()).toBe('Open graph view');
    });

    it('rename', async () => {
      await rightClick(label);
      await clickMenu('Rename group...');
      await answerPrompt('Headings');
      expect(await browser.$(label).getText()).toBe('Headings');
    });

    it('reorder', async () => {
      const ids = async () => (await ribbonState()).groups.map((g) => g.id);
      const before = await ids();
      await rightClick(label);
      await clickMenu('Move group left');
      const after = await ids();
      expect(after.indexOf('home-styles')).toBe(before.indexOf('home-styles') - 1);
    });

    it('collapse priority decides which group shrinks first', async () => {
      await setSize(1100, 1040);
      const levelOf = async (id) => (await ribbonState()).groups.find((g) => g.id === id).level;
      expect(await levelOf('home-clipboard')).toBe(0);
      await rightClick('.onr-group[data-group="home-clipboard"] .onr-group-label');
      await clickMenu('Shrink first');
      expect(await levelOf('home-clipboard')).toBeGreaterThan(0);
      await rightClick('.onr-group[data-group="home-clipboard"] .onr-group-label, .onr-group[data-group="home-clipboard"] .onr-group-button');
      await clickMenu('Shrink last');
      expect(await levelOf('home-clipboard')).toBe(0);
    });

    it('delete (asks first when the group has buttons)', async () => {
      await rightClick(label);
      await clickMenu('Delete group');
      const confirm = await browser.$('.modal button.mod-warning');
      await confirm.waitForExist({ timeout: 5000 });
      await confirm.click();
      await pause(250);
      expect((await ribbonState()).groups.some((g) => g.id === 'home-styles')).toBe(false);
    });
  });

  describe('right-click on a tab or an empty area', () => {
    it('offers add / rename / hide / reorder tabs and reset', async () => {
      await rightClick('.onenote-tab[data-tab="insert"]');
      expect(await menuTitles()).toEqual(['Customise with drag and drop', 'New group...', 'New tab...', 'Rename tab "Insert"...', 'Move tab left', 'Move tab right', 'Hide tab "Insert"', 'Delete tab "Insert"...', 'Export layout...', 'Import layout...', 'Reset to default...']);
      await closeMenus();
      const s = await ribbonState();
      const y = await browser.execute(() => { const r = document.querySelector('.onr-strip').getBoundingClientRect(); return Math.round(r.top + r.height / 2); });
      await browser.action('pointer', { parameters: { pointerType: 'mouse' } }).move({ x: s.contentRight + 40, y }).down({ button: 2 }).up({ button: 2 }).perform();
      await browser.$('.menu').waitForExist({ timeout: 5000 });
      const empty = await menuTitles();
      expect(empty).toContain('New tab...');
      expect(empty).toContain('Reset to default...');
      expect(empty).toContain('Collapse the ribbon');
    });

    it('add a tab, add a group to it, add a command', async () => {
      await rightClick('.onenote-tab[data-tab="home"]');
      await clickMenu('New tab...');
      await answerPrompt('Mine');
      let s = await ribbonState();
      expect(s.tabs.slice(0, 2)).toEqual(['Home', 'Mine']);
      expect(s.active).toBe('Mine');
      await browser.$('.onenote-ribbon .onr-empty').click();
      await answerPrompt('Favourites');
      const input = await browser.$('.prompt .prompt-input');
      await input.waitForExist({ timeout: 5000 });
      await input.setValue('Toggle light/dark mode');
      await pause(300);
      await browser.keys('Enter');
      await pause(300);
      s = await ribbonState();
      expect(s.groups.length).toBe(1);
      expect(s.groups[0].items.length).toBe(1);
      expect(await browser.$('.onr-strip .onr-group-label').getText()).toBe('Favourites');
    });

    it('rename, hide, show again and reorder tabs', async () => {
      await rightClick('.onenote-tab[data-tab="insert"]');
      await clickMenu('Rename tab "Insert"...');
      await answerPrompt('Add');
      expect((await ribbonState()).tabs[1]).toBe('Add');
      await rightClick('.onenote-tab[data-tab="insert"]');
      await clickMenu('Hide tab "Add"');
      expect((await ribbonState()).tabs).not.toContain('Add');
      await rightClick('.onenote-tab[data-tab="home"]');
      await clickMenu('Show "Add"');
      expect((await ribbonState()).tabs[1]).toBe('Add');
      await rightClick('.onenote-tab[data-tab="insert"]');
      await clickMenu('Move tab right');
      expect((await ribbonState()).tabs.slice(0, 3)).toEqual(['Home', 'View', 'Add']);
    });

    it('reset to default', async () => {
      const cut = await item('onenote-style:cut');
      await rightClick(btn(cut.id));
      await clickMenu('Remove from ribbon');
      await rightClick('.onenote-tab[data-tab="home"]');
      await clickMenu('Reset to default...');
      const confirm = await browser.$('.modal button.mod-warning');
      await confirm.waitForExist({ timeout: 5000 });
      await confirm.click();
      await pause(250);
      expect(await item('onenote-style:cut')).not.toBe(null);
      // and the reset can be undone once
      await withPlugin((plugin) => plugin.undoRibbonReplace());
      expect(await item('onenote-style:cut')).toBe(null);
    });
  });

  describe('drag and drop', () => {
    it('moves a button into another group at the place it was dropped', async () => {
      const cut = await item('onenote-style:cut');
      const h2 = await item('onenote-style:heading-2');
      await drag(btn(cut.id), btn(h2.id), { x: 0.5, y: 0.2 });
      const styles = await groupItems('home-styles');
      expect(styles.indexOf('onenote-style:cut')).toBe(styles.indexOf('onenote-style:heading-2') - 1);
      expect((await groupItems('home-clipboard')).includes('onenote-style:cut')).toBe(false);
    });

    it('drops after a button when released on its lower half', async () => {
      const cut = await item('onenote-style:cut');
      const h2 = await item('onenote-style:heading-2');
      await drag(btn(cut.id), btn(h2.id), { x: 0.5, y: 0.8 });
      const styles = await groupItems('home-styles');
      expect(styles.indexOf('onenote-style:cut')).toBe(styles.indexOf('onenote-style:heading-2') + 1);
    });

    it('dropping on a group\'s empty space appends to that group', async () => {
      const cut = await item('onenote-style:cut');
      await drag(btn(cut.id), '.onr-group[data-group="home-pages"] .onr-group-label');
      expect((await groupItems('home-pages')).at(-1)).toBe('onenote-style:cut');
    });

    it('a drag does not run the button, and a plain click still does', async () => {
      await withPlugin((plugin, app) => { const e = app.workspace.activeEditor.editor; e.setValue('plain text'); e.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 5 }); e.focus(); });
      const bold = await item('editor:toggle-bold');
      const italic = await item('editor:toggle-italics');
      await drag(btn(bold.id), btn(italic.id), { x: 0.5, y: 0.9 });
      expect(await withPlugin((plugin, app) => app.workspace.activeEditor.editor.getValue())).toBe('plain text');
      await browser.$(btn(bold.id)).click();
      await pause(200);
      expect(await withPlugin((plugin, app) => app.workspace.activeEditor.editor.getValue())).toBe('**plain** text');
    });

    it('hovering over another tab while dragging switches to it, then the button can be dropped there', async () => {
      const cut = await item('onenote-style:cut');
      const from = await browser.execute((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; }, btn(cut.id));
      const tab = await browser.execute(() => { const r = document.querySelector('.onenote-tab[data-tab="insert"]').getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; });
      await browser.action('pointer', { parameters: { pointerType: 'mouse' } })
        .move(from).down({ button: 0 }).pause(50)
        .move({ x: from.x + 20, y: from.y, duration: 50 })
        .move({ x: tab.x, y: tab.y, duration: 150 })
        .move({ x: tab.x + 2, y: tab.y, duration: 50 })
        .pause(800)
        .perform(true);
      expect((await ribbonState()).active).toBe('Insert');
      const target = await browser.execute(() => { const r = document.querySelector('.onr-group[data-group="insert-stamp"] .onr-group-label').getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; });
      await browser.action('pointer', { parameters: { pointerType: 'mouse' } })
        .move({ x: target.x, y: target.y, duration: 150 }).move({ x: target.x + 1, y: target.y, duration: 50 }).pause(100).up({ button: 0 })
        .perform();
      await pause(250);
      expect((await item('onenote-style:cut')).group).toBe('insert-stamp');
    });
  });

  describe('adaptive resizing', () => {
    const WIDTHS = [1920, 1700, 1500, 1366, 1280, 1100, 960, 840, 720, 640, 560, 480, 400, 320];

    it('never needs a horizontal scroll bar, on any tab, from full screen down to a quarter', async () => {
      const tabs = (await layout()).tabs.map((t) => t.id);
      for (const w of WIDTHS) {
        await setSize(w, 1040);
        for (const tab of tabs) {
          await selectTab(tab);
          const s = await ribbonState();
          if (!s) continue; // tab not visible in the row is still selectable through the drop-down
          const [strip, ribbon, tabRow, bar] = s.overflow;
          expect({ w, tab, strip, ribbon, bar }).toEqual({ w, tab, strip: 0, ribbon: 0, bar: 0 });
          expect(tabRow).toBeLessThanOrEqual(1); // sub-pixel rounding of the flexible tab area
          expect(s.contentRight).toBeLessThanOrEqual(s.stripRight);
          expect(s.barWidth).toBe(s.windowWidth);
        }
      }
    });

    it('shrinks step by step and ends with a "more" drop-down', async () => {
      const seen = { small: false, icons: false, collapsed: false, more: false };
      let prev = -1;
      for (const w of [1920, 1700, 1500, 1366, 1200, 1100, 960, 840, 720, 600, 480, 400]) {
        await setSize(w, 1040);
        const s = await ribbonState();
        const levels = s.groups.map((g) => g.level);
        if (levels.includes(1)) seen.small = true;
        if (levels.includes(2)) seen.icons = true;
        if (levels.includes(3)) seen.collapsed = true;
        if (s.more) seen.more = true;
        const score = levels.reduce((a, b) => a + b, 0) + (8 - s.groups.length) * 4;
        expect(score).toBeGreaterThanOrEqual(prev);
        prev = score;
      }
      expect(seen).toEqual({ small: true, icons: true, collapsed: true, more: true });
      await setSize(1920, 1040);
      expect((await ribbonState()).groups.every((g) => g.level === 0)).toBe(true);
    });

    it('a collapsed group opens as a drop-down with all its buttons, and they work', async () => {
      await setSize(700, 1040);
      await browser.waitUntil(async () => (await browser.$$('.onr-strip .onr-group.is-collapsed').length) > 0, { timeout: 3000 });
      const group = (await browser.$$('.onr-strip .onr-group.is-collapsed'))[0];
      const id = await group.getAttribute('data-group');
      await group.$('.onr-group-button').click();
      const pop = await browser.$('.onr-popover.onr-popover-group');
      await pop.waitForExist({ timeout: 3000 });
      const inside = await browser.execute(() => {
        const p = document.querySelector('.onr-popover');
        const r = p.getBoundingClientRect();
        return { n: p.querySelectorAll('[data-item]').length, fits: r.left >= 0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight, hscroll: p.scrollWidth - p.clientWidth };
      });
      expect(inside.n).toBe((await groupItems(id)).length);
      expect(inside.fits).toBe(true);
      expect(inside.hscroll).toBeLessThanOrEqual(0);
      await browser.keys('Escape');
      await pause(150);
      expect(await pop.isExisting()).toBe(false);
    });

    it('"more" lists the groups that did not fit; a button in it runs and closes it', async () => {
      await setSize(420, 1040);
      const more = await browser.$('.onr-strip .onr-more-button');
      await more.waitForExist({ timeout: 3000 });
      await more.click();
      const pop = await browser.$('.onr-popover.onr-popover-more');
      await pop.waitForExist({ timeout: 3000 });
      const info = await browser.execute(() => {
        const p = document.querySelector('.onr-popover');
        const r = p.getBoundingClientRect();
        return {
          groups: Array.from(p.querySelectorAll('.onr-more-group')).map((g) => g.dataset.group),
          fits: r.left >= 0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight,
          hscroll: p.scrollWidth - p.clientWidth,
        };
      });
      const onStrip = (await ribbonState()).groups.map((g) => g.id);
      const all = (await layout()).tabs[0].groups.map((g) => g.id);
      expect([...onStrip, ...info.groups].sort()).toEqual(all.slice().sort());
      expect(info.fits).toBe(true);
      expect(info.hscroll).toBeLessThanOrEqual(0);
      const dark = await item('onenote-style:use-dark-mode');
      await browser.$(`.onr-popover [data-item="${dark.id}"]`).click();
      await pause(500);
      expect(await pop.isExisting()).toBe(false);
      expect(await browser.execute(() => document.body.classList.contains('theme-dark'))).toBe(true);
    });

    it('tabs that do not fit move into a drop-down in the tab row', async () => {
      await setSize(560, 1040);
      const s = await ribbonState();
      expect(s.tabMore).toBe(true);
      expect(s.tabs.length).toBeLessThan(12);
      expect(s.tabs).toContain('Home');
      await browser.$('.onenote-tabs .onr-tab-more').click();
      await browser.$('.menu').waitForExist({ timeout: 3000 });
      await clickMenu('Utilities');
      const after = await ribbonState();
      expect(after.active).toBe('Utilities');
      expect(after.tabs).toContain('Utilities');
    });
  });

  describe('light and dark', () => {
    it('follows the theme: light uses the interface grey, dark has a slight contrast', async () => {
      const colors = () => browser.execute(() => {
        const bg = (el) => getComputedStyle(el).backgroundColor;
        const probe = document.body.createDiv();
        probe.style.backgroundColor = 'var(--background-secondary)';
        const out = { ribbon: bg(document.querySelector('.onenote-ribbon')), secondary: bg(probe), text: getComputedStyle(document.querySelector('.onr-btn-label')).color };
        probe.remove();
        return out;
      });
      await setDark(false);
      const light = await colors();
      expect(light.ribbon).toBe(light.secondary);
      const dark0 = await item('onenote-style:use-dark-mode');
      await browser.$(btn(dark0.id)).click();
      await pause(600);
      expect(await browser.execute(() => document.body.classList.contains('theme-dark'))).toBe(true);
      const dark = await colors();
      expect(dark.ribbon).not.toBe(dark.secondary);
      expect(dark.ribbon).not.toBe(light.ribbon);
      expect(dark.text).not.toBe(light.text);
      const toggle = await item('theme:toggle-light-dark');
      await browser.$(btn(toggle.id)).click();
      await pause(600);
      expect(await browser.execute(() => document.body.classList.contains('theme-light'))).toBe(true);
      expect((await colors()).ribbon).toBe(light.ribbon);
    });
  });

  describe('icon colours', () => {
    // WCAG asks for at least 3:1 between a graphic and its background.
    const measure = () => browser.execute(() => {
      const parse = (c) => {
        let m = c.match(/^rgba?\(([^)]+)\)/);
        if (m) return m[1].split(/[ ,/]+/).slice(0, 3).map((v) => Number(v) / 255);
        m = c.match(/^color\(srgb ([^)]+)\)/);
        return m[1].split(/[ /]+/).slice(0, 3).map(Number);
      };
      const lum = (c) => {
        const [r, g, b] = parse(c).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const ratio = (x, y) => { const a = lum(x); const b = lum(y); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
      const bg = getComputedStyle(document.querySelector('.onenote-ribbon')).backgroundColor;
      const out = {};
      for (const el of document.querySelectorAll('.onr-strip [data-item]:not(.is-disabled) .onr-btn-icon, .onr-strip [data-item="probe"] .onr-btn-icon')) {
        const key = (el.dataset.color || 'plain') + (el.dataset.icon ? ':' + el.dataset.icon : '');
        out[key] = Math.round(ratio(getComputedStyle(el).color, bg) * 100) / 100;
      }
      return out;
    });

    it('every icon colour and every brand logo keeps at least 3:1 contrast, in light and in dark mode', async () => {
      // one probe button per colour and per brand logo, in a group of their own
      await withPlugin((plugin) => {
        const colors = ['accent', 'red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'pink'];
        const items = colors.map((c) => ({ id: 'probe-' + c, command: 'editor:toggle-bold', size: 'small', icon: 'star', color: c }));
        for (const logo of ['onenote-ai-claude', 'onenote-ai-openai', 'onenote-ai-lumo', 'onenote-ai-codex']) {
          items.push({ id: 'probe-' + logo, command: 'editor:toggle-bold', size: 'small', icon: logo });
        }
        items.push({ id: 'probe-plain', command: 'editor:toggle-bold', size: 'small', icon: 'star' });
        plugin.ribbonLayout.tabs[0].groups = [{ id: 'probes', name: 'Probes', priority: 'last', items }];
        plugin.ribbon.changed();
      });
      for (const dark of [false, true]) {
        await setDark(dark);
        const ratios = await measure();
        expect(Object.keys(ratios).length).toBe(14);
        for (const [key, value] of Object.entries(ratios)) {
          expect({ dark, key, ok: value >= 3, value }).toEqual({ dark, key, ok: true, value });
        }
      }
    });

    it('product logos keep their brand colour until the user picks another one', async () => {
      const claude = await item('ai-chatbridge:sync-claude-chats');
      const icon = btn(claude.id) + ' .onr-btn-icon';
      expect(await browser.$(icon).getAttribute('data-color')).toBe('brand');
      await rightClick(btn(claude.id));
      await clickMenu('Icon colour...');
      await clickMenu('Blue');
      expect(await browser.$(icon).getAttribute('data-color')).toBe('blue');
    });
  });

  describe('export and import', () => {
    it('exports the layout as one JSON file and imports it back', async () => {
      const cut = await item('onenote-style:cut');
      await rightClick(btn(cut.id));
      await clickMenu('Rename...');
      await answerPrompt('Snip');
      const name = await withPlugin((plugin) => plugin.exportRibbon());
      expect(name).toMatch(/^Ribbon layout .*\.json$/);
      const text = await withPlugin((plugin, app, n) => app.vault.adapter.read(n), name);
      expect(JSON.parse(text).format).toBe('onenote-style-ribbon-layout');
      await resetLayout();
      expect((await item('onenote-style:cut')).label).toBe('Cut');
      expect(await withPlugin((plugin, app, t) => plugin.importRibbonText(t), text)).toBe(true);
      expect((await item('onenote-style:cut')).label).toBe('Snip');
      expect(await browser.$(btn((await item('onenote-style:cut')).id)).getText()).toBe('Snip');
      await withPlugin((plugin, app, n) => app.vault.adapter.remove(n), name);
    });

    it('refuses a file that is not a layout and keeps the current one', async () => {
      const before = await layout();
      expect(await withPlugin((plugin) => plugin.importRibbonText('{"hello": "world"}'))).toBe(false);
      expect(await withPlugin((plugin) => plugin.importRibbonText('not json'))).toBe(false);
      expect(await layout()).toEqual(before);
    });
  });
});
