// Not a test: takes the screenshots for the OneNote Style *theme* repository.
// Runs in a sandboxed Obsidian on the demo vault with the theme installed.
// Three pictures with the OneNote Style plugin's ribbon, two with the theme alone.
//   THEME_DIR=<path to obsidian-onenote-theme> npx wdio run ./wdio.conf.mjs --spec ./test/e2e/tools/theme-shots.e2e.mjs
import { browser } from '@wdio/globals';
import fs from 'node:fs';
import path from 'node:path';
import { setSize, pause } from '../helpers.mjs';

const HERE = path.resolve('test/e2e');
const VAULT = path.join(HERE, '.showcase-vault');
const SOURCE = process.env.RIBBON_TEST_VAULT || 'D:/BrainTest/SecondBrain/Open/Brain';
const THEME_DIR = process.env.THEME_DIR || 'C:/Users/Walter/Desktop/OneNote/obsidian-onenote-theme';
const PAGE = 'Work/Website relaunch/Kickoff meeting.md';
const shotPath = (name) => path.join(THEME_DIR, 'docs', name + '.png');

function buildVault(withBridge) {
  fs.rmSync(VAULT, { recursive: true, force: true });
  fs.cpSync(path.join(HERE, 'showcase-notes'), VAULT, { recursive: true });
  const dst = path.join(VAULT, '.obsidian');
  const theme = path.join(dst, 'themes', 'OneNote Style');
  fs.mkdirSync(theme, { recursive: true });
  for (const f of ['theme.css', 'manifest.json']) fs.copyFileSync(path.join(THEME_DIR, f), path.join(theme, f));
  const enabled = [];
  // AI ChatBridge (program files only, no accounts, so it stays offline) lights up the
  // ribbon's AI group in the pictures with the ribbon.
  const from = path.join(SOURCE, '.obsidian', 'plugins', 'ai-chatbridge');
  if (withBridge && fs.existsSync(path.join(from, 'main.js'))) {
    fs.mkdirSync(path.join(dst, 'plugins', 'ai-chatbridge'), { recursive: true });
    for (const f of ['main.js', 'manifest.json', 'styles.css']) {
      if (fs.existsSync(path.join(from, f))) fs.copyFileSync(path.join(from, f), path.join(dst, 'plugins', 'ai-chatbridge', f));
    }
    enabled.push('ai-chatbridge');
  }
  fs.writeFileSync(path.join(dst, 'community-plugins.json'), JSON.stringify(enabled));
  fs.writeFileSync(path.join(dst, 'app.json'), JSON.stringify({ showInlineTitle: true }));
  fs.writeFileSync(path.join(dst, 'appearance.json'), JSON.stringify({ theme: 'moonstone', cssTheme: 'OneNote Style' }));
  return VAULT;
}

const exec = (fn, ...args) => browser.executeObsidian(({ app }, src, a) => new Function('app', 'args', `return (${src})(app, ...args);`)(app, a), fn.toString(), args);

async function prepare() {
  await browser.execute(() => {
    const st = document.createElement('style');
    st.textContent = '.notice-container { display: none !important; }';
    document.head.appendChild(st);
    // show a neutral name instead of the temporary vault folder's name
    const name = document.querySelector('.workspace-drawer-vault-name');
    if (name) name.textContent = 'Notes';
  });
  await exec(async (app, p) => {
    await app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(p));
    app.commands.executeCommandById('file-explorer:open');
    app.commands.executeCommandById('file-explorer:reveal-active-file');
    if (app.workspace.rightSplit && !app.workspace.rightSplit.collapsed) app.workspace.rightSplit.collapse();
  }, PAGE);
  await pause(1500);
}

const dark = async (on) => { await exec((app, d) => app.changeTheme(d ? 'obsidian' : 'moonstone'), on); await pause(700); };
const tab = async (id) => { await exec((app, t) => app.plugins.plugins['onenote-style'].ribbon.selectTab(t), id); await pause(300); };
const save = async (name) => { await pause(300); fs.mkdirSync(path.join(THEME_DIR, 'docs'), { recursive: true }); await browser.saveScreenshot(shotPath(name)); };

/** Scales a PNG with Electron (no extra dependency) and returns it as base64. */
const resized = (file, width, height) => browser.execute((f, w, h) => {
  const img = window.electron.remote.nativeImage.createFromPath(f).resize({ width: w, height: h, quality: 'best' });
  return img.toPNG().toString('base64');
}, file, width, height);

describe('theme screenshots', () => {
  it('1-3: with the OneNote Style ribbon (light, dark, another tab) and the 512 x 288 directory screenshot', async () => {
    await browser.reloadObsidian({ vault: buildVault(true) });
    await browser.$('.onenote-ribbon .onr-strip').waitForExist({ timeout: 30000 });
    await setSize(1840, 1035);
    await prepare();
    await dark(false);
    await tab('home');
    await save('1-ribbon-light');
    fs.writeFileSync(path.join(THEME_DIR, 'screenshot.png'), Buffer.from(await resized(shotPath('1-ribbon-light'), 512, 288), 'base64'));
    await dark(true);
    await save('2-ribbon-dark');
    await dark(false);
    await tab('insert');
    await save('3-ribbon-insert-light');
    await tab('home');
  });

  it('4-5: the theme alone, light and dark', async () => {
    await browser.reloadObsidian({ vault: buildVault(false), plugins: [] });
    await browser.$('.workspace').waitForExist({ timeout: 30000 });
    await setSize(1280, 720);
    await prepare();
    await dark(false);
    await save('4-theme-light');
    await dark(true);
    await save('5-theme-dark');
  });
});
