// Customise mode: right-click > "Customise with drag and drop". Tabs, groups and buttons
// can be dragged, "+" tiles create new tabs, groups and buttons.
import { browser, expect } from '@wdio/globals';
import { openSample, resetLayout, selectTab, setSize, ribbonState, withPlugin, layout, pause, rightClick, clickMenu, menuTitles, closeMenus, answerPrompt, drag, pick, shot } from './helpers.mjs';

const editing = () => browser.execute(() => document.querySelector('.onenote-topbar').classList.contains('is-editing'));
const tabIds = async () => (await layout()).tabs.map((t) => t.id);
const groupIds = async (tabId) => (await layout()).tabs.find((t) => t.id === tabId).groups.map((g) => g.id);
const tab = (id) => `.onenote-tab[data-tab="${id}"]`;
const groupLabel = (id) => `.onr-strip .onr-group[data-group="${id}"] .onr-group-label`;

async function enter() {
  await rightClick(tab('home'));
  await clickMenu('Customise with drag and drop');
  await pause(200);
}

describe('customise mode', () => {
  before(async () => {
    await setSize(1920, 1040);
    await openSample();
  });

  beforeEach(async () => {
    await closeMenus();
    await withPlugin((plugin) => plugin.ribbon.setEditing(false));
    await setSize(1920, 1040);
    await resetLayout();
  });

  after(async () => {
    await withPlugin((plugin) => plugin.ribbon.setEditing(false));
  });

  it('starts from the right-click menu and ends with Done or Esc', async () => {
    expect(await editing()).toBe(false);
    await enter();
    expect(await editing()).toBe(true);
    expect(await browser.$('.onenote-tabs .onr-tab-add').isExisting()).toBe(true);
    expect(await browser.$('.onr-strip .onr-new-group').isExisting()).toBe(true);
    await shot('customise-mode-light-full');
    await browser.$('.onenote-ribbon .onr-edit-done').click();
    await pause(200);
    expect(await editing()).toBe(false);
    expect(await browser.$('.onenote-tabs .onr-tab-add').isExisting()).toBe(false);

    await rightClick(groupLabel('home-styles'));
    await clickMenu('Customise with drag and drop');
    expect(await editing()).toBe(true);
    await rightClick(tab('home'));
    expect(await menuTitles()).toContain('Done customising');
    await closeMenus();
    expect(await editing()).toBe(true); // the first Esc only closed the menu
    await browser.keys('Escape');
    await pause(200);
    expect(await editing()).toBe(false);
  });

  it('tabs and groups stay put outside customise mode', async () => {
    const before = await layout();
    await drag(tab('view'), tab('home'), { x: 0.1, y: 0.5 });
    await drag(groupLabel('home-styles'), groupLabel('home-clipboard'), { x: 0.1, y: 0.5 });
    expect(await layout()).toEqual(before);
  });

  it('drag a tab to reorder it', async () => {
    await enter();
    await drag(tab('view'), tab('home'), { x: 0.15, y: 0.5 });
    expect((await tabIds()).slice(0, 3)).toEqual(['view', 'home', 'insert']);
    await drag(tab('view'), tab('table'), { x: 0.85, y: 0.5 });
    expect((await tabIds()).slice(0, 4)).toEqual(['home', 'insert', 'table', 'view']);
    expect((await ribbonState()).tabs.slice(0, 4)).toEqual(['Home', 'Insert', 'Table', 'View']);
  });

  it('drag a group by its label to reorder it', async () => {
    await enter();
    await drag(groupLabel('home-styles'), groupLabel('home-clipboard'), { x: 0.1, y: 0.5 });
    expect((await groupIds('home')).slice(0, 2)).toEqual(['home-styles', 'home-clipboard']);
    await drag(groupLabel('home-styles'), groupLabel('home-paragraph'), { x: 0.9, y: 0.5 });
    expect((await groupIds('home')).slice(0, 4)).toEqual(['home-clipboard', 'home-text', 'home-paragraph', 'home-styles']);
    expect((await ribbonState()).groups.map((g) => g.id).slice(0, 4)).toEqual(['home-clipboard', 'home-text', 'home-paragraph', 'home-styles']);
  });

  it('drag a group onto another tab', async () => {
    await enter();
    const from = await browser.execute((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; }, groupLabel('home-styles'));
    const over = await browser.execute((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; }, tab('templates'));
    await browser.action('pointer', { parameters: { pointerType: 'mouse' } })
      .move(from).down({ button: 0 }).pause(50)
      .move({ x: from.x + 20, y: from.y, duration: 50 })
      .move({ x: over.x, y: over.y, duration: 150 }).move({ x: over.x + 2, y: over.y, duration: 50 })
      .pause(800)
      .perform(true);
    expect((await ribbonState()).active).toBe('Templates');
    const target = await browser.execute((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: Math.round(r.left + r.width * 0.1), y: Math.round(r.top + r.height / 2) }; }, groupLabel('tpl-new'));
    await browser.action('pointer', { parameters: { pointerType: 'mouse' } })
      .move({ x: target.x, y: target.y, duration: 150 }).move({ x: target.x + 1, y: target.y, duration: 50 }).pause(100).up({ button: 0 })
      .perform();
    await pause(250);
    expect(await groupIds('templates')).toEqual(['tpl-templates', 'home-styles', 'tpl-new', 'tpl-properties']);
    expect(await groupIds('home')).not.toContain('home-styles');
  });

  it('buttons still drag, and a click opens the button\'s menu instead of running it', async () => {
    await enter();
    const ids = await withPlugin((plugin) => {
      const out = {};
      for (const g of plugin.ribbonLayout.tabs[0].groups) for (const i of g.items) out[i.command] = i.id;
      return out;
    });
    await withPlugin((plugin, app) => { const e = app.workspace.activeEditor.editor; e.setValue('plain text'); e.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 5 }); e.focus(); });
    await browser.$(`.onr-strip [data-item="${ids['editor:toggle-bold']}"]`).click();
    await browser.$('.menu').waitForExist({ timeout: 3000 });
    expect(await menuTitles()).toContain('Remove from ribbon');
    await closeMenus();
    expect(await withPlugin((plugin, app) => app.workspace.activeEditor.editor.getValue())).toBe('plain text');
    await drag(`.onr-strip [data-item="${ids['onenote-style:cut']}"]`, groupLabel('home-pages'));
    expect((await layout()).tabs[0].groups.find((g) => g.id === 'home-pages').items.at(-1).command).toBe('onenote-style:cut');
  });

  it('"+" creates a tab, a group and a button', async () => {
    await enter();
    await browser.$('.onenote-tabs .onr-tab-add').click();
    await answerPrompt('Mine');
    expect((await ribbonState()).active).toBe('Mine');
    expect(await editing()).toBe(true);
    await browser.$('.onenote-ribbon .onr-empty').click();
    await answerPrompt('First');
    await pick('Toggle bold');
    await browser.$('.onr-strip .onr-new-group').click();
    await answerPrompt('Second');
    await pick('Toggle italic');
    await browser.$('.onr-strip > .onr-group:first-child .onr-add-inline').click();
    await pick('Toggle strikethrough');
    const mine = (await layout()).tabs.find((t) => t.name === 'Mine');
    expect(mine.groups.map((g) => [g.name, g.items.map((i) => i.command)])).toEqual([
      ['First', ['editor:toggle-bold', 'editor:toggle-strikethrough']],
      ['Second', ['editor:toggle-italics']],
    ]);
    await shot('customise-mode-new-tab');
  });

  it('never needs a scroll bar while customising either', async () => {
    await enter();
    for (const w of [1920, 1366, 960, 640, 480, 360]) {
      await setSize(w, 1040);
      for (const id of ['home', 'view', 'utilities']) {
        await selectTab(id);
        const s = await ribbonState();
        const [strip, ribbon, tabRow, bar] = s.overflow;
        expect({ w, id, strip, ribbon, bar }).toEqual({ w, id, strip: 0, ribbon: 0, bar: 0 });
        expect(tabRow).toBeLessThanOrEqual(1);
        const tile = await browser.execute(() => { const t = document.querySelector('.onr-strip .onr-new-group'); const s2 = document.querySelector('.onr-strip'); return t ? Math.round(t.getBoundingClientRect().right - s2.getBoundingClientRect().right) : null; });
        expect(tile).not.toBe(null);
        expect(tile).toBeLessThanOrEqual(0);
      }
    }
    await shot('customise-mode-light-360');
  });
});
