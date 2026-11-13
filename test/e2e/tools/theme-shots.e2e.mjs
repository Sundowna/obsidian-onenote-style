// Not a test: takes the screenshots for the OneNote Style *theme* repository.
// Runs in a sandboxed Obsidian on the demo vault with the theme installed.
//   THEME_DIR=<path to obsidian-onenote-theme> npx wdio run ./wdio.conf.mjs --spec ./test/e2e/tools/theme-shots.e2e.mjs
import { browser } from '@wdio/globals';
import fs from 'node:fs';
import path from 'node:path';
import { setSize, pause } from '../helpers.mjs';

const HERE = path.resolve('test/e2e');
const VAULT = path.join(HERE, '.showcase-vault');
const THEME_DIR = process.env.THEME_DIR || 'C:/Users/Walter/Desktop/OneNote/obsidian-onenote-theme';
const PAGE = 'Work/Website relaunch/Kickoff meeting.md';

function buildVault() {
  fs.rmSync(VAULT, { recursive: true, force: true });
  fs.cpSync(path.join(HERE, 'showcase-notes'), VAULT, { recursive: true });
  const dst = path.join(VAULT, '.obsidian');
  const theme = path.join(dst, 'themes', 'OneNote Style');
  fs.mkdirSync(theme, { recursive: true });
  for (const f of ['theme.css', 'manifest.json']) fs.copyFileSync(path.join(THEME_DIR, f), path.join(theme, f));
  fs.writeFileSync(path.join(dst, 'community-plugins.json'), '[]');
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
const save = async (file) => { await pause(300); fs.mkdirSync(path.dirname(file), { recursive: true }); await browser.saveScreenshot(file); };

/** Scales a PNG with Electron (no extra dependency) and returns it as base64. */
const resized = (file, width, height) => browser.execute((f, w, h) => {
  const img = window.electron.remote.nativeImage.createFromPath(f).resize({ width: w, height: h, quality: 'best' });
  return img.toPNG().toString('base64');
}, file, width, height);

describe('theme screenshots', () => {
  it('theme alone: light, dark and the 512 x 288 directory screenshot', async () => {
    await browser.reloadObsidian({ vault: buildVault(), plugins: [] });
    await browser.$('.workspace').waitForExist({ timeout: 30000 });
    await setSize(1280, 720);
    await prepare();
    await dark(false);
    const light = path.join(THEME_DIR, 'docs', 'light.png');
    await save(light);
    fs.writeFileSync(path.join(THEME_DIR, 'screenshot.png'), Buffer.from(await resized(light, 512, 288), 'base64'));
    await dark(true);
    await save(path.join(THEME_DIR, 'docs', 'dark.png'));
  });

  it('theme together with the OneNote Style plugin', async () => {
    await browser.reloadObsidian({ vault: buildVault(), plugins: ['onenote-style'] });
    await browser.$('.onenote-ribbon .onr-strip').waitForExist({ timeout: 30000 });
    await setSize(1840, 1035);
    await prepare();
    await dark(false);
    await save(path.join(THEME_DIR, 'docs', 'with-plugin.png'));
    const state = await browser.execute(() => {
      const bg = (s) => { const e = document.querySelector(s); return e ? getComputedStyle(e).backgroundColor : null; };
      return { tabrow: bg('.onenote-tabrow'), winButtons: bg('.titlebar-button-container.mod-right'), ribbon: bg('.onenote-ribbon'), strip: bg('.workspace-ribbon.mod-left'), tabs: bg('.workspace-tab-header-container') };
    });
    console.log('THEME+PLUGIN ' + JSON.stringify(state));
  });
});
