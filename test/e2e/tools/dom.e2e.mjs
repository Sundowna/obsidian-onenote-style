// Helper, not a test: prints how Notebook Navigator and the file explorer mark up a note row.
import { browser } from '@wdio/globals';
import { openSample, setSize, withPlugin, pause, shot } from '../helpers.mjs';

describe('dom', () => {
  it('rows', async () => {
    await setSize(1500, 1000);
    await openSample();
    await withPlugin(async (plugin) => { await plugin.createSubpage(); });
    await pause(1500);
    await browser.keys('Escape');
    await withPlugin(async (plugin, app) => {
      app.commands.executeCommandById('notebook-navigator:open');
      app.commands.executeCommandById('notebook-navigator:reveal-file');
    });
    await pause(1500);
    const out = await browser.execute(() => {
      const trim = (el) => (el ? el.outerHTML.replace(/<svg.*?<\/svg>/gs, '<svg/>').slice(0, 1500) : null);
      const nn = Array.from(document.querySelectorAll('.nn-file'));
      return {
        nnCount: nn.length,
        nnRow: trim(nn[0]),
        nnRowParent: nn[0] ? nn[0].parentElement.outerHTML.slice(0, 300) : null,
        nnPaths: nn.map((e) => e.getAttribute('data-path') || (e.querySelector('[data-path]') || {}).dataset?.path || null),
        core: trim(document.querySelector('.nav-file')),
        leaves: Array.from(document.querySelectorAll('.mod-left-split .workspace-leaf-content')).map((e) => e.dataset.type),
      };
    });
    console.log(JSON.stringify(out, null, 1));
    await shot('debug-subpage');
  });
});
