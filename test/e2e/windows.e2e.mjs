// Other windows (Settings, popouts) must stay movable. Obsidian copies the main
// window's body classes into them, so the top bar's "title bar: no-drag" rules
// must only hit the window that holds the top bar (issue #1).
import { browser, expect } from '@wdio/globals';
import { openSample, pause } from './helpers.mjs';


describe('other windows', () => {
  before(async () => {
    await openSample();
  });

  it('keeps the main title bar out of the way of the top bar', async () => {
    const r = await browser.execute(() => {
      const t = document.querySelector('.titlebar');
      return t ? getComputedStyle(t).getPropertyValue('-webkit-app-region').trim() : null;
    });
    if (r !== null) expect(r).toBe('no-drag');
  });

  it('leaves the Settings window draggable', async () => {
    await browser.execute(() => app.setting.open());
    await pause(800);
    const r = await browser.execute(() => {
      const doc = app.setting.containerEl.ownerDocument;
      const body = doc.body;
      const t = doc.querySelector('.titlebar');
      const inner = doc.querySelector('.titlebar-inner');
      const reg = (el) => el ? el.ownerDocument.defaultView.getComputedStyle(el).getPropertyValue('-webkit-app-region').trim() : null;
      return { own: doc !== document, copied: body.classList.contains('onenote-has-topbar'), titlebar: reg(t), inner: reg(inner) };
    });
    await browser.execute(() => app.setting.close());
    console.log('settings window', JSON.stringify(r));
    // Settings is its own window in newer Obsidian on some systems, a dialog on others
    if (!r.own) return;
    expect(r.titlebar).toBe('drag');
    expect(r.inner).not.toBe('no-drag');
  });

  it('leaves a popout window draggable', async () => {
    // Obsidian's Settings window is a popout with body.is-popout-modal: its title bar is
    // the drag handle. Mark a popout that way to check it on every system.
    await browser.execute(() => { window.__pop = app.workspace.openPopoutLeaf(); });
    await pause(1500);
    const r = await browser.execute(() => {
      const doc = window.__pop.view.containerEl.ownerDocument;
      const reg = (el) => el ? el.ownerDocument.defaultView.getComputedStyle(el).getPropertyValue('-webkit-app-region').trim() : null;
      const plain = { inner: reg(doc.querySelector('.titlebar-inner')) };
      doc.body.addClass('is-popout-modal');
      const modal = { titlebar: reg(doc.querySelector('.titlebar')), inner: reg(doc.querySelector('.titlebar-inner')) };
      doc.body.removeClass('is-popout-modal');
      return { own: doc !== document, copied: doc.body.classList.contains('onenote-has-topbar'), plain, modal };
    });
    await browser.execute(() => window.__pop.detach());
    console.log('popout window', JSON.stringify(r));
    expect(r.own).toBe(true);
    expect(r.plain.inner).not.toBe('no-drag');
    expect(r.modal.titlebar).toBe('drag');
    expect(r.modal.inner).not.toBe('no-drag');
  });
});
