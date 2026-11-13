// A reload of Obsidian keeps the customised layout.
import { browser, expect } from '@wdio/globals';
import { openSample, resetLayout, selectTab, ribbonState, withPlugin, layout, pause, rightClick, clickMenu, answerPrompt } from './helpers.mjs';

describe('reload', () => {
  it('keeps the layout, the hidden tabs and the selected tab', async () => {
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
    await pause(500);

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
    await pause(500);
    const s = await ribbonState();
    expect(s.tabs.length).toBe(12);
    expect(s.groups.length).toBeGreaterThan(0);
  });
});
