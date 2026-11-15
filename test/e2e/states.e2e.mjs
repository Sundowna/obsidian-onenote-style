// Button state inside a real (sandboxed) Obsidian: a button whose mode is on shows as
// pressed, like the pilcrow button in Word, and the AI buttons move while a sync runs.
import { browser, expect } from '@wdio/globals';
import { openSample, resetLayout, selectTab, setDark, setSize, ribbonState, withPlugin, pause, closeMenus } from './helpers.mjs';

const O = 'onenote-style:';
const AI = 'ai-chatbridge:';
const sel = (command) => `.onenote-ribbon [data-command="${command}"]`;

/** What the button of a command shows right now. */
const look = (command, root) => browser.execute((s) => {
  const b = document.querySelector(s);
  if (!b) return null;
  const svg = b.querySelector('.onr-btn-icon svg');
  return {
    pressed: b.classList.contains('is-pressed'),
    aria: b.getAttribute('aria-pressed'),
    busy: b.classList.contains('is-busy'),
    animation: svg ? getComputedStyle(svg).animationName : '',
    tip: b.getAttribute('aria-label'),
    width: Math.round(b.getBoundingClientRect().width * 10) / 10,
    background: getComputedStyle(b).backgroundColor,
  };
}, (root || '.onenote-ribbon') + ` [data-command="${command}"]`);

async function click(command) {
  const el = await browser.$(sel(command));
  await el.waitForExist({ timeout: 5000 });
  await el.click();
  await pause(450);
}

/** The real state in Obsidian, read without the ribbon. */
const truth = (command) => withPlugin((plugin, app, cmd) => {
  const { MarkdownView } = require('obsidian');
  const view = app.workspace.getActiveViewOfType(MarkdownView);
  const leaf = view ? view.leaf : app.workspace.getMostRecentLeaf();
  const cfg = (k, d) => { const v = app.vault.getConfig(k); return v === undefined || v === null ? d : !!v; };
  switch (cmd) {
    case 'onenote-style:toggle-syntax-visibility': return plugin.settings.hideSyntax && document.body.classList.contains('onenote-hide-syntax');
    case 'onenote-style:toggle-syntax-guard': return plugin.settings.syntaxGuard;
    case 'onenote-style:toggle-quick-bar': return plugin.settings.quickBar;
    case 'onenote-style:toggle-section-tabs': return !!document.querySelector('.onenote-topbar .onenote-section-tabs');
    case 'onenote-style:full-page-view': return document.body.classList.contains('onenote-fullpage');
    case 'markdown:toggle-preview': return view.getMode() === 'preview';
    case 'editor:toggle-source': return view.getMode() === 'source' && view.getState().source === true;
    case 'editor:toggle-readable-line-length': return cfg('readableLineLength', true);
    case 'editor:toggle-line-numbers': return cfg('showLineNumber', false);
    case 'editor:toggle-spellcheck': return cfg('spellcheck', true);
    case 'app:toggle-left-sidebar': return !app.workspace.leftSplit.collapsed;
    case 'app:toggle-right-sidebar': return !app.workspace.rightSplit.collapsed;
    case 'app:toggle-ribbon': return cfg('showRibbon', true);
    case 'workspace:toggle-pin': return !!leaf.pinned;
    case 'workspace:toggle-stacked-tabs': return !!leaf.parent.isStacked;
    case 'backlink:toggle-backlinks-in-document': return !!leaf.getViewState().state.backlinks;
    default: throw new Error('no truth for ' + cmd);
  }
}, command);

// Every toggle button of the default ribbon, by tab. (Full page view has its own test:
// it hides the ribbon, so its button can't be clicked a second time.)
const TOGGLES = [
  ['home', O + 'toggle-syntax-visibility'],
  ['home', O + 'toggle-syntax-guard'],
  ['home', O + 'toggle-quick-bar'],
  ['view', 'markdown:toggle-preview'],
  ['view', 'editor:toggle-source'],
  ['view', 'editor:toggle-readable-line-length'],
  ['view', 'editor:toggle-line-numbers'],
  ['view', 'app:toggle-left-sidebar'],
  ['view', 'app:toggle-right-sidebar'],
  ['view', O + 'toggle-section-tabs'],
  ['view', 'app:toggle-ribbon'],
  ['view', 'workspace:toggle-stacked-tabs'],
  ['view', 'workspace:toggle-pin'],
  ['review', 'editor:toggle-spellcheck'],
  ['references', 'backlink:toggle-backlinks-in-document'],
];

describe('button state', () => {
  let hidRibbon;

  before(async () => {
    await setSize(1920, 1040);
    await openSample();
    // The Test vault may hide Obsidian's icon strip; the Icon Strip button needs it visible.
    hidRibbon = await withPlugin((plugin) => {
      const was = plugin.settings.hideObsidianRibbon;
      plugin.settings.hideObsidianRibbon = false;
      plugin.applyAppearance();
      return was;
    });
  });

  after(async () => {
    await withPlugin((plugin, app, was) => {
      plugin.settings.hideObsidianRibbon = was;
      plugin.applyAppearance();
    }, hidRibbon);
  });

  beforeEach(async () => {
    await closeMenus();
    await setDark(false);
    await setSize(1920, 1040);
    await resetLayout();
    await openSample();
  });

  describe('pressed', () => {
    for (const [tab, command] of TOGGLES) {
      it(`${command}: pressed while on, and a click switches it`, async () => {
        await selectTab(tab);
        await pause(450);
        const before = await truth(command);
        const a = await look(command);
        expect(a).not.toBe(null);
        expect(a.pressed).toBe(before);
        expect(a.aria).toBe(String(before));
        try {
          await click(command);
          expect(await truth(command)).toBe(!before);
          const b = await look(command);
          expect(b.pressed).toBe(!before);
          expect(b.aria).toBe(String(!before));
          // the tooltip says it too, and the button keeps its width
          const on = before ? a : b;
          const off = before ? b : a;
          expect(on.tip).toBe(off.tip + ' (on)');
          expect(on.width).toBe(off.width);
          expect(on.background).not.toBe(off.background);
        } finally {
          if ((await truth(command)) !== before) await click(command);
        }
        expect(await truth(command)).toBe(before);
        expect((await look(command)).pressed).toBe(before);
      });
    }

    it('Full Page: on while the page fills the window, off again after leaving it', async () => {
      await selectTab('view');
      await pause(450);
      expect((await look(O + 'full-page-view')).pressed).toBe(false);
      await click(O + 'full-page-view');
      try {
        expect(await truth(O + 'full-page-view')).toBe(true);
        // the ribbon is hidden now; its button is marked for when it comes back
        expect((await look(O + 'full-page-view')).aria).toBe('true');
      } finally {
        await withPlugin((plugin) => { if (document.body.classList.contains('onenote-fullpage')) plugin.toggleFullPage(); });
        await pause(450);
      }
      expect(await truth(O + 'full-page-view')).toBe(false);
      const back = await look(O + 'full-page-view');
      expect([back.pressed, back.aria]).toEqual([false, 'false']);
    });

    it('Light and Dark: the one that is on is pressed', async () => {
      const both = async () => [(await look(O + 'use-light-mode')).pressed, (await look(O + 'use-dark-mode')).pressed];
      expect(await both()).toEqual([true, false]);
      await click(O + 'use-dark-mode');
      expect(await browser.execute(() => document.body.classList.contains('theme-dark'))).toBe(true);
      expect(await both()).toEqual([false, true]);
      // the big Light / Dark button switches without being a mode itself
      await click('theme:toggle-light-dark');
      expect(await both()).toEqual([true, false]);
      expect((await look('theme:toggle-light-dark')).aria).toBe(null);
      await click(O + 'use-light-mode');
      expect(await both()).toEqual([true, false]);
    });

    it('Read / Edit and Source Mode: at most one is pressed', async () => {
      await selectTab('view');
      const both = async () => [(await look('markdown:toggle-preview')).pressed, (await look('editor:toggle-source')).pressed];
      expect(await both()).toEqual([false, false]);
      await click('markdown:toggle-preview');
      expect(await both()).toEqual([true, false]);
      await click('markdown:toggle-preview');
      await click('editor:toggle-source');
      expect(await both()).toEqual([false, true]);
      await click('editor:toggle-source');
      expect(await both()).toEqual([false, false]);
    });

    it('follows a mode that was switched without the ribbon', async () => {
      await selectTab('view');
      const before = (await look('editor:toggle-line-numbers')).pressed;
      await withPlugin((plugin, app) => app.commands.executeCommandById('editor:toggle-line-numbers'));
      try {
        await browser.waitUntil(async () => (await look('editor:toggle-line-numbers')).pressed === !before, { timeout: 2000 });
      } finally {
        await withPlugin((plugin, app) => app.commands.executeCommandById('editor:toggle-line-numbers'));
      }
      await browser.waitUntil(async () => (await look('editor:toggle-line-numbers')).pressed === before, { timeout: 2000 });
      // a setting changed in the plugin's settings page
      await selectTab('home');
      const quick = (await look(O + 'toggle-quick-bar')).pressed;
      await withPlugin((plugin, app, on) => plugin.setQuickBar(on), !quick);
      await browser.waitUntil(async () => (await look(O + 'toggle-quick-bar')).pressed === !quick, { timeout: 2000 });
      await withPlugin((plugin, app, on) => plugin.setQuickBar(on), quick);
      await browser.waitUntil(async () => (await look(O + 'toggle-quick-bar')).pressed === quick, { timeout: 2000 });
    });

    it('buttons that are not a mode never show as pressed', async () => {
      const marked = async () => browser.execute(() => Array.from(document.querySelectorAll('.onenote-ribbon [data-item]'))
        .filter((b) => b.hasAttribute('aria-pressed') || b.classList.contains('is-pressed')).map((b) => b.dataset.command).sort());
      expect(await marked()).toEqual([O + 'toggle-quick-bar', O + 'toggle-syntax-guard', O + 'toggle-syntax-visibility', O + 'use-dark-mode', O + 'use-light-mode'].sort());
      await click('editor:toggle-bold');
      expect((await look('editor:toggle-bold')).aria).toBe(null);
      await selectTab('insert');
      await pause(450);
      expect(await marked()).toEqual([]);
    });

    it('a button moved to another tab, or added again, keeps showing its state', async () => {
      const ids = await withPlugin((plugin) => {
        const L = plugin.ribbonLayout;
        const insert = L.tabs.find((t) => t.id === 'insert');
        insert.groups[0].items.push({ id: 'extra-dark', command: 'onenote-style:use-dark-mode', label: 'Night', icon: 'moon', size: 'large' });
        plugin.ribbon.changed();
        return insert.groups[0].id;
      });
      expect(ids).toBeTruthy();
      await selectTab('insert');
      await pause(450);
      expect((await look(O + 'use-dark-mode')).pressed).toBe(false);
      await click(O + 'use-dark-mode');
      expect((await look(O + 'use-dark-mode')).pressed).toBe(true);
      await setDark(false);
    });

    it('a folded group shows the state in its drop-down', async () => {
      await setDark(true);
      // narrow the window until the Appearance group is one button, or in "More"
      let group;
      for (const width of [1000, 860, 720, 600]) {
        await setSize(width, 900);
        group = (await ribbonState()).groups.find((g) => g.id === 'home-appearance');
        if (!group || group.level === 3) break;
      }
      const opener = group ? '.onr-group[data-group="home-appearance"] .onr-group-button' : '.onr-more-button';
      if (group) expect(group.level).toBe(3);
      await browser.$('.onenote-ribbon ' + opener).click();
      await browser.$('.onr-popover').waitForExist({ timeout: 5000 });
      const inPopover = async (c) => look(c, '.onr-popover');
      expect((await inPopover(O + 'use-dark-mode')).pressed).toBe(true);
      expect((await inPopover(O + 'use-light-mode')).pressed).toBe(false);
      await browser.keys('Escape');
    });

    it('a button whose plugin is off shows no state', async () => {
      const disabled = await browser.execute(() => Array.from(document.querySelectorAll('.onenote-ribbon [data-item][aria-disabled="true"]'))
        .filter((b) => b.classList.contains('is-pressed') || b.classList.contains('is-busy') || b.hasAttribute('aria-pressed')).length);
      expect(disabled).toBe(0);
    });
  });

  describe('busy: AI ChatBridge syncs', () => {
    let installed;
    // A real sync would go online, so ChatBridge is put into its "sync running" state by
    // hand: the fields below are the ones its own "syncing" and "current" read.
    const fake = (running, current) => withPlugin((plugin, app, r, c) => {
      const p = app.plugins.plugins['ai-chatbridge'];
      p.running = r;
      p.fetchingList = false;
      p.current = c;
      return { syncing: p.syncing, busy: p.busy };
    }, running, current);
    const started = (id) => withPlugin((plugin, app, cmd) => { plugin.aiStarted = cmd ? { id: cmd, time: Date.now() } : null; }, id);
    const busyButtons = () => browser.execute(() => Array.from(document.querySelectorAll('.onenote-ribbon [data-item].is-busy')).map((b) => b.dataset.command.replace('ai-chatbridge:', '')).sort());

    before(async () => {
      installed = await withPlugin((plugin, app) => !!app.plugins.manifests['ai-chatbridge']);
      if (!installed) return; // the Test vault has no AI ChatBridge to copy
      await withPlugin((plugin, app) => app.plugins.enablePluginAndSave('ai-chatbridge'));
    });

    after(async () => {
      if (!installed) return;
      await fake(false, null);
      await withPlugin((plugin, app) => app.plugins.disablePluginAndSave('ai-chatbridge'));
    });

    beforeEach(async function () {
      if (!installed) this.skip();
      await fake(false, null);
      await started(null);
      await browser.waitUntil(async () => (await browser.execute(() => document.querySelectorAll('.onr-group[data-group="home-ai"] [data-item][aria-disabled="true"]').length)) === 0, { timeout: 8000 });
      await pause(450);
    });

    afterEach(async () => {
      if (installed) await fake(false, null);
    });

    it('ChatBridge still has the fields the ribbon reads', async () => {
      expect(await fake(false, null)).toEqual({ syncing: false, busy: false });
      expect(await fake(true, { provider: 'chatgpt', id: 'x' })).toEqual({ syncing: true, busy: true });
    });

    it('nothing moves while no sync runs', async () => {
      expect(await busyButtons()).toEqual([]);
      expect((await look(AI + 'sync-all-chats')).animation).toBe('none');
    });

    it('a sync that started by itself turns the Sync All icon', async () => {
      await fake(true, null);
      await browser.waitUntil(async () => (await busyButtons()).length > 0, { timeout: 2000 });
      expect(await busyButtons()).toEqual(['sync-all-chats']);
      const all = await look(AI + 'sync-all-chats');
      expect(all.animation).toBe('onr-spin');
      expect(all.tip).toMatch(/^Sync All.* - running\.\.\.$/);
      expect(all.aria).toBe(null);
      await fake(false, null);
      await browser.waitUntil(async () => (await busyButtons()).length === 0, { timeout: 2000 });
      const idle = await look(AI + 'sync-all-chats');
      expect(idle.animation).toBe('none');
      expect(idle.tip).not.toMatch(/running/);
      expect(idle.width).toBe(all.width);
    });

    it('during Sync All the provider being synced pulses', async () => {
      await started(AI + 'sync-all-chats');
      await fake(true, { provider: 'chatgpt', id: 'x' });
      await browser.waitUntil(async () => (await busyButtons()).length === 2, { timeout: 2000 });
      expect(await busyButtons()).toEqual(['sync-all-chats', 'sync-chatgpt-chats']);
      expect((await look(AI + 'sync-chatgpt-chats')).animation).toBe('onr-pulse');
      expect((await look(AI + 'sync-all-chats')).animation).toBe('onr-spin');
      // ChatBridge moves on to the next provider
      await fake(true, { provider: 'claude', id: 'y' });
      await browser.waitUntil(async () => (await busyButtons()).includes('sync-claude-chats'), { timeout: 2000 });
      expect(await busyButtons()).toEqual(['sync-all-chats', 'sync-claude-chats']);
      await fake(true, { hermes: true, id: 'p' });
      await browser.waitUntil(async () => (await busyButtons()).includes('sync-hermes-chats'), { timeout: 2000 });
      expect(await busyButtons()).toEqual(['sync-all-chats', 'sync-hermes-chats']);
    });

    it('a sync started from one provider\'s button shows on that button only', async () => {
      await started(AI + 'sync-chatgpt-chats');
      await fake(true, { provider: 'chatgpt', id: 'x' });
      await browser.waitUntil(async () => (await busyButtons()).length > 0, { timeout: 2000 });
      expect(await busyButtons()).toEqual(['sync-chatgpt-chats']);
      expect((await look(AI + 'sync-chatgpt-chats')).animation).toBe('onr-pulse');
      // finished: the button rests, and the next timed sync is not blamed on ChatGPT
      await fake(false, null);
      await browser.waitUntil(async () => (await busyButtons()).length === 0, { timeout: 2000 });
      await pause(3200);
      await fake(true, null);
      await browser.waitUntil(async () => (await busyButtons()).length > 0, { timeout: 2000 });
      expect(await busyButtons()).toEqual(['sync-all-chats']);
    });

    it('a click on a sync button is remembered as the starter, unless a sync runs already', async () => {
      // The command is swapped for a harmless one, so the click starts no real sync.
      const swap = (on) => withPlugin((plugin, app, o) => {
        const c = app.commands.commands['ai-chatbridge:sync-lumo-chats'];
        if (o) { window.__lumoRuns = 0; c.__callback = c.callback; c.callback = () => { window.__lumoRuns += 1; }; } else if (c.__callback) { c.callback = c.__callback; delete c.__callback; }
        return window.__lumoRuns;
      }, on);
      await swap(true);
      try {
        await click(AI + 'sync-lumo-chats');
        expect(await swap(null)).toBe(1);
        expect(await withPlugin((plugin) => plugin.aiStarted && plugin.aiStarted.id)).toBe(AI + 'sync-lumo-chats');
        expect(await busyButtons()).toEqual([]); // not busy before ChatBridge says so
        await fake(true, { provider: 'lumo', id: 'z' });
        await browser.waitUntil(async () => (await busyButtons()).length > 0, { timeout: 2000 });
        expect(await busyButtons()).toEqual(['sync-lumo-chats']);
        // a second click while it runs does not take over
        await started(null);
        await click(AI + 'sync-lumo-chats');
        expect(await withPlugin((plugin) => plugin.aiStarted)).toBe(null);
      } finally {
        await swap(false);
      }
    });

    it('the folded AI group moves too, and so do the buttons in its drop-down', async () => {
      await fake(true, { provider: 'claude', id: 'y' });
      await setSize(1000, 900);
      await pause(450);
      const s = await ribbonState();
      const group = s.groups.find((g) => g.id === 'home-ai');
      const opener = '.onenote-ribbon ' + (group ? '.onr-group[data-group="home-ai"] .onr-group-button' : '.onr-more-button');
      if (group) expect(group.level).toBe(3);
      await browser.waitUntil(async () => browser.execute((o) => document.querySelector(o).classList.contains('is-busy'), opener), { timeout: 2000 });
      const anim = await browser.execute((o) => getComputedStyle(document.querySelector(o + ' .onr-btn-icon svg')).animationName, opener);
      expect(anim).toBe(group ? 'onr-spin' : 'onr-pulse');
      await browser.$(opener).click();
      await browser.$('.onr-popover').waitForExist({ timeout: 5000 });
      expect((await look(AI + 'sync-all-chats', '.onr-popover')).busy).toBe(true);
      expect((await look(AI + 'sync-claude-chats', '.onr-popover')).busy).toBe(true);
      expect((await look(AI + 'sync-gemini-chats', '.onr-popover')).busy).toBe(false);
      await browser.keys('Escape');
      await fake(false, null);
      await browser.waitUntil(async () => browser.execute((o) => !document.querySelector(o).classList.contains('is-busy'), opener), { timeout: 2000 });
    });

    it('the icons stand still for people who asked for reduced motion', async () => {
      const rule = await browser.execute(() => {
        for (const sheet of Array.from(document.styleSheets)) {
          let rules;
          try { rules = sheet.cssRules; } catch (e) { continue; }
          for (const r of Array.from(rules)) {
            if (r instanceof CSSMediaRule && /prefers-reduced-motion:\s*reduce/.test(r.conditionText) && /\.onr-btn\.is-busy/.test(r.cssText)) return r.cssText.replace(/\s+/g, ' ');
          }
        }
        return null;
      });
      expect(rule).toMatch(/animation:[^;]*none !important/);
    });
  });
});
