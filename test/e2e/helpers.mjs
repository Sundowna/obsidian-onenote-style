// Shared helpers for the end-to-end tests.
import { browser } from '@wdio/globals';
import fs from 'node:fs';
import path from 'node:path';

export const OUT = path.resolve('test/e2e/out');
export const SHOTS = path.join(OUT, 'shots');
export const PLUGIN = 'onenote-style';

export const pause = (ms) => browser.pause(ms);

/** Opens the sample page and waits for the ribbon. */
export async function openSample() {
  await browser.executeObsidian(async ({ app }) => {
    const f = app.vault.getAbstractFileByPath('Notebook/Section/Sample.md');
    await app.workspace.getLeaf(false).openFile(f);
  });
  await browser.$('.onenote-ribbon .onr-strip').waitForExist({ timeout: 20000 });
  await pause(300);
}

/** Runs a function inside Obsidian with the plugin instance. */
export function withPlugin(fn, ...args) {
  return browser.executeObsidian(({ app }, id, src, a) => {
    const plugin = app.plugins.plugins[id];
    // eslint-disable-next-line no-new-func
    return new Function('plugin', 'app', 'args', `return (${src})(plugin, app, ...args);`)(plugin, app, a);
  }, PLUGIN, fn.toString(), args);
}

export async function selectTab(id) {
  await withPlugin((plugin, app, tabId) => plugin.ribbon.selectTab(tabId), id);
  await pause(150);
}

export async function resetLayout() {
  await withPlugin((plugin) => {
    const fresh = plugin.loadRibbonLayout(null);
    plugin.replaceRibbonLayout(fresh, false);
    plugin.state.ribbonCollapsed = false;
    plugin.ribbon.selectTab('home');
  });
  await pause(150);
}

export async function setDark(dark) {
  await withPlugin((plugin, app, d) => app.changeTheme(d ? 'obsidian' : 'moonstone'), dark);
  await pause(500);
}

export async function setSize(width, height) {
  await browser.setWindowSize(width, height);
  await pause(450);
}

/** What the ribbon currently shows, read from the DOM. */
export function ribbonState() {
  return browser.execute(() => {
    const strip = document.querySelector('.onenote-ribbon .onr-strip');
    const ribbon = document.querySelector('.onenote-ribbon');
    const tabs = document.querySelector('.onenote-tabs');
    const bar = document.querySelector('.onenote-topbar');
    if (!strip) return null;
    const groups = Array.from(strip.querySelectorAll(':scope > .onr-group')).map((g) => ({
      id: g.dataset.group,
      level: Number(g.dataset.level),
      right: Math.round(g.getBoundingClientRect().right),
      items: Array.from(g.querySelectorAll('[data-item]')).map((b) => b.dataset.item),
    }));
    const stripRect = strip.getBoundingClientRect();
    return {
      groups,
      more: !!strip.querySelector(':scope > .onr-more'),
      stripWidth: Math.round(stripRect.width),
      stripRight: Math.round(stripRect.right),
      contentRight: Math.max(0, ...Array.from(strip.children).map((c) => Math.round(c.getBoundingClientRect().right))),
      // any horizontal overflow anywhere in the top bar would need a scroll bar
      overflow: [strip, ribbon, tabs, bar].map((el) => el.scrollWidth - el.clientWidth),
      barWidth: bar.clientWidth,
      windowWidth: window.innerWidth,
      tabs: Array.from(tabs.querySelectorAll('.onenote-tab[data-tab]')).filter((t) => t.offsetParent !== null).map((t) => t.textContent),
      tabMore: !!tabs.querySelector('.onr-tab-more'),
      active: (tabs.querySelector('.onenote-tab.is-active') || {}).textContent || null,
    };
  });
}

export async function shot(name) {
  fs.mkdirSync(SHOTS, { recursive: true });
  await browser.saveScreenshot(path.join(SHOTS, name + '.png'));
}

/** Titles of the open Obsidian menu. */
export function menuTitles() {
  return browser.execute(() => Array.from(document.querySelectorAll('.menu .menu-item:not(.is-label) .menu-item-title')).map((e) => e.textContent));
}

export async function clickMenu(title) {
  const done = await browser.execute((t) => {
    const items = Array.from(document.querySelectorAll('.menu .menu-item'));
    const it = items.reverse().find((e) => (e.querySelector('.menu-item-title') || {}).textContent === t);
    if (!it) return false;
    it.click();
    return true;
  }, title);
  if (!done) throw new Error(`Menu item not found: ${title} (have: ${(await menuTitles()).join(' | ')})`);
  await pause(200);
}

export async function rightClick(selector) {
  const el = await browser.$(selector);
  await el.waitForExist({ timeout: 5000 });
  await el.click({ button: 'right' });
  await browser.$('.menu').waitForExist({ timeout: 5000 });
  await pause(100);
}

export async function closeMenus() {
  await browser.keys('Escape');
  await pause(100);
}

/** Fills the plugin's text prompt and confirms. */
export async function answerPrompt(text) {
  const input = await browser.$('.modal .onenote-prompt-input');
  await input.waitForExist({ timeout: 5000 });
  await input.setValue(text);
  await browser.keys('Enter');
  await pause(250);
}

export function layout() {
  return withPlugin((plugin) => JSON.parse(JSON.stringify(plugin.ribbonLayout)));
}
