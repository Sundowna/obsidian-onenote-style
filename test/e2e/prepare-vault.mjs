// Builds the vault the end-to-end tests run in: test/e2e/.vault-tmp (git-ignored).
//
// It takes the *configuration* of the Test vault (theme, snippets, a few local-only
// plugins) and adds the fixture notes from test/e2e/notes. No note from the real vault
// is copied, and plugins that go online (chat sync, browser, AI) are left out, so the
// sandboxed Obsidian stays offline and the real vault is never touched.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const VAULT_DIR = path.join(here, '.vault-tmp');
const SOURCE = process.env.RIBBON_TEST_VAULT || 'D:/BrainTest/SecondBrain/Open/Brain';
// Local-only plugins from the Test vault that the default ribbon layout maps commands to.
const PLUGINS = ['editing-toolbar', 'highlightr-plugin', 'obsidian-tasks-plugin', 'obsidian-excalidraw-plugin', 'notebook-navigator', 'omnisearch'];

export function prepareVault() {
  fs.rmSync(VAULT_DIR, { recursive: true, force: true });
  fs.mkdirSync(path.join(VAULT_DIR, '.obsidian', 'plugins'), { recursive: true });
  fs.cpSync(path.join(here, 'notes'), VAULT_DIR, { recursive: true });

  const src = path.join(SOURCE, '.obsidian');
  const dst = path.join(VAULT_DIR, '.obsidian');
  const enabled = [];
  if (fs.existsSync(src)) {
    for (const f of ['app.json', 'appearance.json', 'core-plugins.json', 'themes', 'snippets']) {
      if (fs.existsSync(path.join(src, f))) fs.cpSync(path.join(src, f), path.join(dst, f), { recursive: true });
    }
    for (const id of PLUGINS) {
      const p = path.join(src, 'plugins', id);
      if (!fs.existsSync(p)) continue;
      fs.cpSync(p, path.join(dst, 'plugins', id), { recursive: true });
      enabled.push(id);
    }
    // AI ChatBridge: program files only (no settings, no accounts), installed but turned
    // off. With its default settings it never syncs by itself, so it stays offline. The
    // tests turn it on to check that its commands can be added to the ribbon.
    const bridge = path.join(src, 'plugins', 'ai-chatbridge');
    if (fs.existsSync(path.join(bridge, 'main.js'))) {
      fs.mkdirSync(path.join(dst, 'plugins', 'ai-chatbridge'), { recursive: true });
      for (const f of ['main.js', 'manifest.json', 'styles.css']) {
        if (fs.existsSync(path.join(bridge, f))) fs.copyFileSync(path.join(bridge, f), path.join(dst, 'plugins', 'ai-chatbridge', f));
      }
    }
    // The plugin's own settings from the Test vault, so the tests start from the real setup.
    // The ribbon layout is dropped so every run starts from the default layout.
    const data = path.join(src, 'plugins', 'onenote-style', 'data.json');
    if (fs.existsSync(data)) {
      const d = JSON.parse(fs.readFileSync(data, 'utf8'));
      delete d.ribbon;
      if (d.state) for (const k of ['order', 'levels', 'lastPage', 'lastSection', 'expanded', 'colors']) d.state[k] = {};
      if (d.state) { d.state.notebook = ''; d.state.section = ''; }
      fs.mkdirSync(path.join(dst, 'plugins', 'onenote-style'), { recursive: true });
      fs.writeFileSync(path.join(dst, 'plugins', 'onenote-style', 'data.json'), JSON.stringify(d, null, 2));
    }
  }
  const corePath = path.join(dst, 'core-plugins.json');
  const core = fs.existsSync(corePath) ? JSON.parse(fs.readFileSync(corePath, 'utf8')) : {};
  Object.assign(core, { sync: false, publish: false });
  fs.writeFileSync(corePath, JSON.stringify(core, null, 2));
  fs.writeFileSync(path.join(dst, 'community-plugins.json'), JSON.stringify(enabled, null, 2));
  return VAULT_DIR;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(prepareVault());
