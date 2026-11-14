// A reload of Obsidian keeps the customised layout.
import { browser, expect } from '@wdio/globals';
import { setSize, openSample, resetLayout, selectTab, ribbonState, withPlugin, layout, pause, rightClick, clickMenu, answerPrompt } from './helpers.mjs';

describe('reload', () => {
  it('keeps the layout, the hidden tabs and the selected tab', async () => {
    await setSize(1920, 1040);
    await openSample();
    await resetLayout();

    // customise through the real UI
    await rightClick('.onr-group[data-group="home-styles"] .onr-group-label');
    await clickMenu('Rename group...');
    await answerPrompt('Headings');
    await rightClick('.onenote-tab[data-tab="slides"]');
    await clickMenu('Hide tab "Slides"');
    await rightClick('.onenote-tab[data-tab="home"]');
    await clickMenu('New tab...');
    await answerPrompt('Mine');
    await selectTab('view');
    await withPlugin((plugin) => plugin.persist());
    const before = await layout();
    await pause(300);

    // restart Obsidian on the same vault, keeping what the plugin saved
    await browser.reloadObsidian();
    await browser.$('.onenote-ribbon .onr-strip').waitForExist({ timeout: 30000 });
    await setSize(1920, 1040);

    expect(await layout()).toEqual(before);
    const s = await ribbonState();
    expect(s.active).toBe('View');
    expect(s.tabs).toContain('Mine');
    expect(s.tabs).not.toContain('Slides');
    await selectTab('home');
    expect(await browser.$('.onr-group[data-group="home-styles"] .onr-group-label').getText()).toBe('Headings');
  });

  it('falls back to the default layout when the saved one is damaged', async () => {
    await withPlugin(async (plugin) => {
      const data = await plugin.loadData();
      data.ribbon = { tabs: 'broken' };
      await plugin.saveData(data);
    });
    await browser.reloadObsidian();
    await browser.$('.onenote-ribbon .onr-strip').waitForExist({ timeout: 30000 });
    await setSize(1920, 1040);
    const s = await ribbonState();
    expect(s.tabs.length).toBe(12);
    expect(s.groups.length).toBeGreaterThan(0);
  });

  it('turning the plugin off and on (an update) draws the whole ribbon and adds the Editing group to an older layout', async () => {
    await setSize(1920, 1040);
    await openSample();
    await browser.executeObsidian(async ({ app }) => {
      const p = app.plugins.plugins['onenote-style'];
      await p.persist();
      await app.plugins.disablePlugin('onenote-style');
      // a ribbon saved before the Editing group existed
      const path = app.vault.configDir + '/plugins/onenote-style/data.json';
      const d = JSON.parse(await app.vault.adapter.read(path));
      for (const t of d.ribbon.tabs) t.groups = t.groups.filter((g) => g.id !== 'home-editing');
      delete d.state.editingGroupAdded;
      d.state.ribbonTab = 'home';
      await app.vault.adapter.write(path, JSON.stringify(d));
      await app.plugins.enablePlugin('onenote-style');
    });
    // The stylesheet arrives after the ribbon is drawn; the ribbon measures again then.
    await browser.waitUntil(async () => { const s = await ribbonState(); return !!s && s.groups.length === 9; }, { timeout: 15000 });
    const s = await ribbonState();
    expect(s.more).toBe(false);
    expect(s.groups.every((g) => g.level === 0)).toBe(true);
    expect(s.groups.map((g) => g.id).indexOf('home-editing')).toBe(s.groups.map((g) => g.id).indexOf('home-pages') + 1);
    expect(await withPlugin((plugin, app) => app.workspace.getActiveFile().path)).toBe('Notebook/Section/Sample.md');
  });
});
