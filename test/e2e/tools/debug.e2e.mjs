import { browser } from '@wdio/globals';
import { openSample, resetLayout, selectTab, setDark, setSize, ribbonState, withPlugin } from '../helpers.mjs';
describe('debug', () => {
  it('state', async () => {
    await openSample(); await resetLayout();
    for (const w of [960]) {
      await setSize(w, 1040);
      for (const tab of ['home', 'insert', 'view']) {
        await selectTab(tab);
        const s = await ribbonState();
        console.log(w, tab, JSON.stringify({ o: s.overflow, sw: s.stripWidth, cr: s.contentRight, sr: s.stripRight, lv: s.groups.map((g) => g.level), more: s.more, tabs: s.tabs.length, tm: s.tabMore }));
      }
    }
    const extra = await browser.execute(() => {
      const q = (s) => document.querySelector(s);
      const d = (el) => [el.scrollWidth, el.clientWidth, el.getBoundingClientRect().width];
      return { tabs: d(q('.onenote-tabs')), row: d(q('.onenote-tabrow')), bar: d(q('.onenote-topbar')), end: d(q('.onenote-tabrow-end')) };
    });
    console.log(JSON.stringify(extra));
    for (const dark of [false, true]) {
      await setDark(dark);
      const c = await browser.execute(() => {
        const bg = (s) => { const e = document.querySelector(s); return e ? getComputedStyle(e).backgroundColor : null; };
        return { ribbon: bg('.onenote-ribbon'), tabrow: bg('.onenote-tabrow'), side: bg('.workspace-split.mod-left-split .workspace-leaf-content') || bg('.mod-left-split'), sideTabs: bg('.mod-left-split .workspace-tab-header-container'), page: bg('.workspace-leaf.mod-active .view-content'), body: getComputedStyle(document.body).getPropertyValue('--background-secondary') };
      });
      console.log(dark ? 'dark' : 'light', JSON.stringify(c));
    }
    const r = await withPlugin((plugin, app) => {
      const cmds = app.commands;
      const out = {};
      out.noEditorResult = String(cmds.executeCommandById('editor:this-does-not-exist'));
      const c = cmds.commands['editor:toggle-bold'];
      out.boldKeys = Object.keys(c);
      out.icons = {};
      const { getIcon } = require('obsidian');
      const missing = [];
      for (const t of plugin.ribbonLayout.tabs) for (const g of t.groups) for (const i of g.items) if (!getIcon(i.icon)) missing.push(i.icon);
      out.missingIcons = missing;
      const miss = [];
      for (const t of plugin.ribbonLayout.tabs) for (const g of t.groups) for (const i of g.items) if (!cmds.commands[i.command]) miss.push(i.command);
      out.missingCommands = miss;
      return out;
    });
    console.log(JSON.stringify(r, null, 1));
  });
});
