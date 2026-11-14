// Commands of other plugins: any installed plugin's command can be added to the ribbon
// through the picker, and runs from there. Checked with Omnisearch and AI ChatBridge.
import { browser, expect } from '@wdio/globals';
import { openSample, resetLayout, selectTab, setSize, withPlugin, layout, pause, rightClick, clickMenu, pick, closeMenus } from './helpers.mjs';

const commandName = (id) => withPlugin((plugin, app, cmd) => (app.commands.commands[cmd] || {}).name || null, id);
const itemsOf = async (groupId) => {
  for (const t of (await layout()).tabs) for (const g of t.groups) if (g.id === groupId) return g.items;
  return null;
};
const label = '.onr-group[data-group="home-pages"] .onr-group-label';

describe('commands of other plugins', () => {
  before(async () => {
    await setSize(1920, 1040);
    await openSample();
  });

  beforeEach(async () => {
    await closeMenus();
    await resetLayout();
  });

  it('the picker offers every command of Obsidian and of every enabled plugin', async () => {
    const counts = await withPlugin((plugin, app) => {
      const all = Object.values(app.commands.commands);
      const prefixes = new Set(all.map((c) => c.id.split(':')[0]));
      return { all: all.length, plugins: Object.keys(app.plugins.plugins).filter((id) => prefixes.has(id)) };
    });
    expect(counts.all).toBeGreaterThan(300);
    for (const id of ['omnisearch', 'editing-toolbar', 'obsidian-excalidraw-plugin', 'obsidian-tasks-plugin', 'notebook-navigator', 'onenote-style']) {
      expect(counts.plugins).toContain(id);
    }
    await rightClick(label);
    await clickMenu('Add command...');
    const input = await browser.$('.prompt .prompt-input');
    await input.waitForExist({ timeout: 5000 });
    for (const [query, id] of [['Omnisearch', 'omnisearch:'], ['Excalidraw', 'obsidian-excalidraw-plugin:'], ['Tasks', 'obsidian-tasks-plugin:'], ['Editing Toolbar', 'editing-toolbar:']]) {
      await input.setValue(query);
      await pause(300);
      const ids = await browser.execute(() => Array.from(document.querySelectorAll('.prompt .onr-picker-id')).map((e) => e.textContent));
      expect(ids.some((x) => x.startsWith(id))).toBe(true);
    }
    await browser.keys('Escape');
  });

  it('Omnisearch: add its command with the picker, then run it from the ribbon', async () => {
    const name = await commandName('omnisearch:show-modal-infile');
    expect(name).not.toBe(null);
    await rightClick(label);
    await clickMenu('Add command...');
    await pick(name);
    const added = (await itemsOf('home-pages')).at(-1);
    expect(added.command).toBe('omnisearch:show-modal-infile');
    const el = await browser.$(`.onenote-ribbon [data-item="${added.id}"]`);
    expect(await el.getAttribute('aria-disabled')).toBe(null);
    await el.click();
    const modal = await browser.$('.omnisearch-modal, .prompt');
    await modal.waitForExist({ timeout: 5000 });
    await browser.keys('Escape');
    await pause(200);
  });

  it('Omnisearch: the default Navigate tab button opens the vault search', async () => {
    await selectTab('navigate');
    const id = await withPlugin((plugin) => {
      for (const t of plugin.ribbonLayout.tabs) for (const g of t.groups) for (const i of g.items) if (i.command === 'omnisearch:show-modal') return i.id;
      return null;
    });
    await browser.$(`.onenote-ribbon [data-item="${id}"]`).click();
    await browser.$('.omnisearch-modal, .prompt').waitForExist({ timeout: 5000 });
    await browser.keys('Escape');
    await pause(200);
  });

  it('AI ChatBridge: buttons wake up when the plugin is turned on, and its commands can be added', async () => {
    const installed = await withPlugin((plugin, app) => !!app.plugins.manifests['ai-chatbridge']);
    if (!installed) return; // the Test vault has no AI ChatBridge to copy
    // By its id, not its size: the group may shrink once a ninth button is added to it.
    const syncAll = `.onenote-ribbon [data-item="${(await itemsOf('home-ai'))[0].id}"]`;
    expect(await browser.$(syncAll).getAttribute('aria-disabled')).toBe('true');
    await withPlugin((plugin, app) => app.plugins.enablePluginAndSave('ai-chatbridge'));
    try {
      // every default AI button comes alive (none is clicked: a click would start a real sync)
      await browser.waitUntil(async () => (await browser.execute(() => document.querySelectorAll('.onr-group[data-group="home-ai"] [data-item][aria-disabled="true"]').length)) === 0, { timeout: 8000 });
      expect(await browser.execute(() => document.querySelectorAll('.onr-group[data-group="home-ai"] [data-item]').length)).toBe(8);
      const tip = await browser.$(syncAll).getAttribute('aria-label');
      expect(tip).toMatch(/^Sync All/);
      // add another ChatBridge command through the picker
      const name = await commandName('ai-chatbridge:refresh-index');
      expect(name).not.toBe(null);
      await rightClick('.onr-group[data-group="home-ai"] .onr-group-label');
      await clickMenu('Add command...');
      await pick(name);
      const added = (await itemsOf('home-ai')).at(-1);
      expect(added.command).toBe('ai-chatbridge:refresh-index');
      expect(await browser.$(`.onenote-ribbon [data-item="${added.id}"]`).getAttribute('aria-disabled')).toBe(null);
    } finally {
      await withPlugin((plugin, app) => app.plugins.disablePluginAndSave('ai-chatbridge'));
    }
    await browser.waitUntil(async () => (await browser.$(syncAll).getAttribute('aria-disabled')) === 'true', { timeout: 8000 });
  });
});
