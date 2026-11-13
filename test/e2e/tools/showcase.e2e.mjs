// Not a test: takes the showcase screenshots for the README (docs/screenshots).
// Runs in a sandboxed Obsidian on a demo vault with harmless notes, the default theme and
// the plugin's default settings, so the pictures show what a new user gets.
//   npx wdio run ./wdio.conf.mjs --spec ./test/e2e/tools/showcase.e2e.mjs
import { browser } from '@wdio/globals';
import fs from 'node:fs';
import path from 'node:path';
import { setSize, withPlugin, pause, rightClick, clickMenu } from '../helpers.mjs';

const OUT = path.resolve('docs/screenshots');
const HERE = path.resolve('test/e2e');
const VAULT = path.join(HERE, '.showcase-vault');
const SOURCE = process.env.RIBBON_TEST_VAULT || 'D:/BrainTest/SecondBrain/Open/Brain';
const PAGE = 'Work/Website relaunch/Kickoff meeting.md';

function buildVault() {
  fs.rmSync(VAULT, { recursive: true, force: true });
  fs.cpSync(path.join(HERE, 'showcase-notes'), VAULT, { recursive: true });
  const dst = path.join(VAULT, '.obsidian');
  fs.mkdirSync(path.join(dst, 'plugins'), { recursive: true });
  const enabled = [];
  // Two other plugins, to show that their commands can be ribbon buttons. Program files
  // only, no settings: AI ChatBridge has no accounts then and never goes online by itself.
  for (const id of ['omnisearch', 'ai-chatbridge']) {
    const from = path.join(SOURCE, '.obsidian', 'plugins', id);
    if (!fs.existsSync(path.join(from, 'main.js'))) continue;
    fs.mkdirSync(path.join(dst, 'plugins', id), { recursive: true });
    for (const f of ['main.js', 'manifest.json', 'styles.css']) {
      if (fs.existsSync(path.join(from, f))) fs.copyFileSync(path.join(from, f), path.join(dst, 'plugins', id, f));
    }
    enabled.push(id);
  }
  fs.writeFileSync(path.join(dst, 'community-plugins.json'), JSON.stringify(enabled));
  fs.writeFileSync(path.join(dst, 'app.json'), JSON.stringify({ showInlineTitle: true, promptDelete: false }));
  fs.writeFileSync(path.join(dst, 'appearance.json'), JSON.stringify({ theme: 'moonstone' }));
  return VAULT;
}

async function shot(name) {
  fs.mkdirSync(OUT, { recursive: true });
  await pause(350);
  await browser.saveScreenshot(path.join(OUT, name + '.png'));
}

const dark = async (on) => {
  await withPlugin((plugin, app, d) => app.changeTheme(d ? 'obsidian' : 'moonstone'), on);
  await pause(600);
};
const itemId = (command) => withPlugin((plugin, app, cmd) => {
  for (const t of plugin.ribbonLayout.tabs) for (const g of t.groups) for (const i of g.items) if (i.command === cmd) return i.id;
  return null;
}, command);
// The smallest 16:9 window in which the whole Home tab shows at full size.
let wideSize = null;
async function wide() {
  if (!wideSize) {
    for (const w of [1600, 1680, 1760, 1840, 1920]) {
      await setSize(w, Math.round((w * 9) / 16));
      const full = await browser.execute(() => Array.from(document.querySelectorAll('.onr-strip > .onr-group')).every((g) => g.dataset.level === '0') && !document.querySelector('.onr-strip > .onr-more'));
      wideSize = [w, Math.round((w * 9) / 16)];
      if (full) break;
    }
  }
  await setSize(wideSize[0], wideSize[1]);
}
const centre = (sel) => browser.execute((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; }, sel);

describe('showcase', () => {
  before(async () => {
    await browser.reloadObsidian({ vault: buildVault() });
    await browser.$('.onenote-ribbon .onr-strip').waitForExist({ timeout: 30000 });
    await wide();
    // keep the temporary vault's name out of the pictures
    await browser.execute(() => {
      const st = document.createElement('style');
      st.textContent = '.workspace-sidedock-vault-profile, .workspace-drawer-vault-switcher { visibility: hidden !important; } .notice-container { display: none !important; }';
      document.head.appendChild(st);
    });
    await withPlugin(async (plugin, app, p) => {
      await app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(p));
      app.commands.executeCommandById('file-explorer:open');
      app.commands.executeCommandById('file-explorer:reveal-active-file');
      if (app.workspace.rightSplit && !app.workspace.rightSplit.collapsed) app.workspace.rightSplit.collapse();
      plugin.ribbon.selectTab('home');
    }, PAGE);
    await pause(1500);
  });

  it('1 light: the ribbon', async () => {
    await dark(false);
    await withPlugin((plugin, app) => {
      const leaf = app.workspace.getLeavesOfType('markdown')[0];
      app.workspace.setActiveLeaf(leaf, { focus: true });
      leaf.view.editor.setCursor({ line: 6, ch: 0 });
    });
    await shot('1-ribbon-light');
  });

  it('2 dark: right-click a button', async () => {
    await dark(true);
    const id = await itemId('onenote-style:highlight-color');
    await rightClick(`.onenote-ribbon [data-item="${id}"]`);
    await shot('2-right-click-dark');
    await browser.keys('Escape');
  });

  it('3 dark: any command of any plugin', async () => {
    await rightClick('.onr-group[data-group="home-pages"] .onr-group-label');
    await clickMenu('Add command...');
    const input = await browser.$('.prompt .prompt-input');
    await input.waitForExist({ timeout: 5000 });
    await input.setValue('sync');
    await pause(500);
    await shot('3-any-command-dark');
    await browser.keys('Escape');
    await pause(300);
  });

  it('4 light: adapts to the window', async () => {
    await dark(false);
    // A width where the steps show side by side: full, small, icon-only and a group that
    // became one drop-down button. That drop-down is opened.
    const sel = '.onr-strip .onr-group.is-collapsed .onr-group-button';
    for (const w of [1040, 960, 880, 800, 720]) {
      await setSize(w, Math.round((w * 9) / 16));
      if ((await browser.$$(sel).length) > 0) break;
    }
    await (await browser.$$(sel))[0].click();
    await pause(400);
    await shot('4-adaptive-light');
    await browser.keys('Escape');
  });

  it('5 dark: customise mode with drag and drop', async () => {
    await wide();
    await dark(true);
    await rightClick('.onenote-tab[data-tab="home"]');
    await clickMenu('Customise with drag and drop');
    await pause(400);
    const id = await itemId('onenote-style:tag-todo');
    const from = await centre(`.onr-strip [data-item="${id}"]`);
    const bold = await itemId('editor:toggle-italics');
    const to = await centre(`.onr-strip [data-item="${bold}"]`);
    await browser.action('pointer', { parameters: { pointerType: 'mouse' } })
      .move(from).down({ button: 0 }).pause(60)
      .move({ x: from.x - 30, y: from.y, duration: 80 })
      .move({ x: to.x + 60, y: to.y + 40, duration: 200 })
      .move({ x: to.x + 6, y: to.y + 8, duration: 200 })
      .pause(300)
      .perform(true);
    await shot('5-customise-mode-dark');
    await browser.keys('Escape');
    await browser.action('pointer', { parameters: { pointerType: 'mouse' } }).up({ button: 0 }).perform();
    await withPlugin((plugin) => plugin.ribbon.setEditing(false));
  });
});
