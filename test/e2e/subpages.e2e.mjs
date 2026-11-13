// Subpages are plain notes with a "parent" property. No folder is created.
import { browser, expect } from '@wdio/globals';
import { openSample, setSize, withPlugin, pause, shot } from './helpers.mjs';

const DIR = 'Notebook/Section';
const snapshot = () => withPlugin((plugin, app) => {
  const folder = app.vault.getAbstractFileByPath('Notebook/Section');
  const walk = (f) => f.children.flatMap((c) => (c.children ? [c.path + '/', ...walk(c)] : [c.path]));
  return walk(folder).sort();
});
const info = (path) => withPlugin((plugin, app, p) => {
  const f = app.vault.getAbstractFileByPath(p);
  if (!f) return null;
  const fm = (app.metadataCache.getFileCache(f) || {}).frontmatter || {};
  const parent = plugin.parentOf(f);
  return { parentProp: fm.parent || null, parent: parent ? parent.path : null, level: plugin.levelOf(f) };
}, path);
const open = async (path) => {
  await withPlugin(async (plugin, app, p) => { await app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(p)); }, path);
  await pause(300);
};
const newFiles = async (before) => (await snapshot()).filter((p) => !before.includes(p));
const settle = async () => { await pause(900); await browser.keys('Escape'); await pause(200); };

describe('subpages', () => {
  before(async () => {
    await setSize(1500, 1000);
    await openSample();
  });

  it('New Subpage makes a plain note next to its parent: no folder, parent kept as a property', async () => {
    const before = await snapshot();
    await open(`${DIR}/Sample.md`);
    await withPlugin(async (plugin, app) => { app.commands.executeCommandById('onenote-style:new-subpage'); });
    await settle();
    const added = await newFiles(before);
    expect(added).toEqual([`${DIR}/Untitled Page.md`]);
    expect(await withPlugin((plugin, app) => app.vault.getAbstractFileByPath('Notebook/Section/Sample.md') !== null)).toBe(true);
    const sub = await info(added[0]);
    expect(sub).toEqual({ parentProp: '[[Sample]]', parent: `${DIR}/Sample.md`, level: 1 });
    const text = await withPlugin((plugin, app, p) => app.vault.adapter.read(p), added[0]);
    expect(text).toBe('---\nparent: "[[Sample]]"\n---\n');
  });

  it('a subpage of a subpage is level 2; below that new pages become siblings', async () => {
    const before = await snapshot();
    await open(`${DIR}/Untitled Page.md`);
    await withPlugin(async (plugin) => { await plugin.createSubpage(); });
    await settle();
    const [second] = await newFiles(before);
    expect(await info(second)).toEqual({ parentProp: '[[Untitled Page]]', parent: `${DIR}/Untitled Page.md`, level: 2 });
    const mid = await snapshot();
    await open(second);
    await withPlugin(async (plugin) => { await plugin.createSubpage(); });
    await settle();
    const [third] = (await snapshot()).filter((p) => !mid.includes(p));
    expect((await info(third)).parent).toBe(`${DIR}/Untitled Page.md`);
    expect((await snapshot()).some((p) => p.endsWith('/'))).toBe(false);
  });

  it('the page list keeps subpages under their parent', async () => {
    const order = await withPlugin((plugin, app) => plugin.getPages(app.vault.getAbstractFileByPath('Notebook/Section')).map((f) => [f.basename, plugin.levelOf(f)]));
    const names = order.map((o) => o[0]);
    expect(names.indexOf('Untitled Page')).toBe(names.indexOf('Sample') + 1);
    expect(order.find((o) => o[0] === 'Sample')[1]).toBe(0);
    expect(order[names.indexOf('Untitled Page') + 1][1]).toBe(2);
  });

  it('subpages are indented and marked with an L in Notebook Navigator', async () => {
    await open(`${DIR}/Untitled Page.md`);
    await withPlugin((plugin, app) => { app.commands.executeCommandById('notebook-navigator:open'); app.commands.executeCommandById('notebook-navigator:reveal-file'); });
    await browser.waitUntil(async () => (await browser.execute(() => document.querySelectorAll('.nn-file[data-onenote-sub]').length)) >= 3, { timeout: 8000 });
    const rows = await browser.execute(() => Array.from(document.querySelectorAll('.nn-file[data-path]')).map((el) => {
      const inner = el.querySelector('.nn-file-inner-content');
      return {
        name: el.dataset.path.split('/').pop(),
        sub: el.getAttribute('data-onenote-sub'),
        indent: parseFloat(getComputedStyle(inner).marginLeft),
        mark: getComputedStyle(inner, '::before').borderLeftStyle,
      };
    }));
    const row = (name) => rows.find((r) => r.name === name);
    expect(row('Sample.md')).toEqual({ name: 'Sample.md', sub: null, indent: 0, mark: 'none' });
    expect(row('Untitled Page.md').sub).toBe('1');
    expect(row('Untitled Page.md').indent).toBeGreaterThan(10);
    expect(row('Untitled Page.md').mark).toBe('solid');
    expect(row('Untitled Page 2.md').sub).toBe('2');
    expect(row('Untitled Page 2.md').indent).toBeGreaterThan(row('Untitled Page.md').indent);
    await shot('subpages-notebook-navigator');
  });

  it('subpages are indented and marked with an L in Obsidian\'s file explorer tree', async () => {
    await withPlugin((plugin, app) => { app.commands.executeCommandById('file-explorer:open'); app.commands.executeCommandById('file-explorer:reveal-active-file'); });
    await browser.waitUntil(async () => (await browser.execute(() => document.querySelectorAll('.nav-file-title[data-onenote-sub]').length)) >= 3, { timeout: 8000 });
    const rows = await browser.execute(() => Array.from(document.querySelectorAll('.nav-file-title[data-path]')).map((el) => {
      const c = el.querySelector('.nav-file-title-content');
      const mark = getComputedStyle(c, '::before');
      return {
        name: el.dataset.path.split('/').pop(),
        sub: el.getAttribute('data-onenote-sub'),
        indent: parseFloat(getComputedStyle(c).paddingLeft),
        mark: mark.borderLeftStyle,
        // the L must lie inside the row's box, or the explorer clips it away
        markInside: mark.borderLeftStyle === 'solid' ? parseFloat(mark.left) >= 0 && parseFloat(mark.left) + parseFloat(mark.width) <= parseFloat(getComputedStyle(c).paddingLeft) : null,
      };
    }));
    const row = (name) => rows.find((r) => r.name === name);
    expect(row('Sample.md')).toEqual({ name: 'Sample.md', sub: null, indent: 0, mark: 'none', markInside: null });
    expect(row('Untitled Page.md')).toEqual({ name: 'Untitled Page.md', sub: '1', indent: 18, mark: 'solid', markInside: true });
    expect(row('Untitled Page 2.md')).toEqual({ name: 'Untitled Page 2.md', sub: '2', indent: 34, mark: 'solid', markInside: true });
    await shot('subpages-file-explorer');
  });

  it('in the file explorer subpages sit under their parent, and the sort order applies within each level', async () => {
    // more pages, so the order is not an accident: "Alpha" with subpage "Zebra", and "Mango" under "Sample"
    await withPlugin(async (plugin, app) => {
      const v = app.vault;
      await v.create('Notebook/Section/Alpha.md', 'A page.');
      await v.create('Notebook/Section/Zebra.md', '---\nparent: "[[Alpha]]"\n---\n');
      await v.create('Notebook/Section/Mango.md', '---\nparent: "[[Sample]]"\n---\n');
    });
    const rows = () => browser.execute(() => Array.from(document.querySelectorAll('.nav-file-title[data-path^="Notebook/Section/"]')).map((el) => el.dataset.path.split('/').pop().replace('.md', '')));
    const sortBy = async (order) => {
      await withPlugin((plugin, app, o) => { app.workspace.getLeavesOfType('file-explorer')[0].view.setSortOrder(o); }, order);
      await pause(700);
    };
    await sortBy('alphabetical');
    await browser.waitUntil(async () => (await rows()).indexOf('Zebra') === (await rows()).indexOf('Alpha') + 1, { timeout: 8000 });
    expect(await rows()).toEqual(['Alpha', 'Zebra', 'Sample', 'Mango', 'Untitled Page', 'Untitled Page 2', 'Untitled Page 3', 'Second page']);
    await sortBy('alphabeticalReverse');
    expect(await rows()).toEqual(['Second page', 'Sample', 'Untitled Page', 'Untitled Page 3', 'Untitled Page 2', 'Mango', 'Alpha', 'Zebra']);
    await shot('subpages-file-explorer-z-a');
    await sortBy('alphabetical');
  });

  it('Promote and Make Subpage only change the property', async () => {
    const before = await snapshot();
    await withPlugin(async (plugin, app) => { await plugin.promotePage(app.vault.getAbstractFileByPath('Notebook/Section/Untitled Page 2.md')); });
    await pause(600);
    expect(await info(`${DIR}/Untitled Page 2.md`)).toEqual({ parentProp: '[[Sample]]', parent: `${DIR}/Sample.md`, level: 1 });
    await withPlugin(async (plugin, app) => { await plugin.promotePage(app.vault.getAbstractFileByPath('Notebook/Section/Untitled Page 2.md')); });
    await pause(600);
    expect(await info(`${DIR}/Untitled Page 2.md`)).toEqual({ parentProp: null, parent: null, level: 0 });
    await withPlugin(async (plugin, app) => {
      const vault = app.vault;
      await plugin.setParent(vault.getAbstractFileByPath('Notebook/Section/Second page.md'), vault.getAbstractFileByPath('Notebook/Section/Sample.md'));
    });
    await pause(600);
    expect((await info(`${DIR}/Second page.md`)).level).toBe(1);
    expect(await withPlugin((plugin, app) => app.vault.adapter.read('Notebook/Section/Second page.md'))).toMatch(/^---\nparent: "\[\[Sample\]\]"\n---\nA second page/);
    expect(await snapshot()).toEqual(before);
  });

  it('renaming the parent keeps its subpages attached', async () => {
    await withPlugin(async (plugin, app) => { await app.fileManager.renameFile(app.vault.getAbstractFileByPath('Notebook/Section/Sample.md'), 'Notebook/Section/Sample renamed.md'); });
    await pause(1200);
    expect(await info(`${DIR}/Untitled Page.md`)).toEqual({ parentProp: '[[Sample renamed]]', parent: `${DIR}/Sample renamed.md`, level: 1 });
    await withPlugin(async (plugin, app) => { await app.fileManager.renameFile(app.vault.getAbstractFileByPath('Notebook/Section/Sample renamed.md'), 'Notebook/Section/Sample.md'); });
    await pause(1200);
  });

  it('an old page folder can be turned back into plain subpages', async () => {
    await withPlugin(async (plugin, app) => {
      await app.vault.createFolder('Notebook/Section/Trip');
      await app.vault.create('Notebook/Section/Trip/Trip.md', 'The parent page.');
      await app.vault.create('Notebook/Section/Trip/Packing.md', 'A subpage.');
    });
    await pause(500);
    await open(`${DIR}/Trip/Packing.md`);
    await withPlugin((plugin, app) => { app.commands.executeCommandById('onenote-style:flatten-page-folder'); });
    const confirm = await browser.$('.modal button.mod-warning');
    await confirm.waitForExist({ timeout: 5000 });
    await confirm.click();
    await pause(1500);
    const files = await snapshot();
    expect(files).toContain(`${DIR}/Trip.md`);
    expect(files).toContain(`${DIR}/Packing.md`);
    expect(files).toContain(`${DIR}/Trip/`); // the folder is left for the user to delete
    expect(files.filter((p) => p.startsWith(`${DIR}/Trip/`) && p !== `${DIR}/Trip/`)).toEqual([]);
    expect(await info(`${DIR}/Packing.md`)).toEqual({ parentProp: '[[Trip]]', parent: `${DIR}/Trip.md`, level: 1 });
    expect((await info(`${DIR}/Trip.md`)).level).toBe(0);
  });
});
