// Screenshots at full, half and quarter width, in light and dark mode.
// Saved to test/e2e/out/shots for a visual check. Also asserts that no width needs a scroll bar.
import { browser, expect } from '@wdio/globals';
import { openSample, resetLayout, selectTab, setDark, setSize, ribbonState, shot, pause } from './helpers.mjs';

const SIZES = [
  ['full', 1920, 1040],
  ['half', 960, 1040],
  ['quarter', 480, 1040],
];

describe('screenshots', () => {
  before(async () => {
    await openSample();
    await resetLayout();
  });

  after(async () => {
    await setDark(false);
    await setSize(1400, 900);
  });

  for (const dark of [false, true]) {
    for (const [name, w, h] of SIZES) {
      it(`${dark ? 'dark' : 'light'} ${name} (${w}px)`, async () => {
        await setDark(dark);
        await setSize(w, h);
        for (const tab of ['home', 'insert', 'view']) {
          await selectTab(tab);
          await pause(200);
          const s = await ribbonState();
          const [strip, ribbon, tabRow, bar] = s.overflow;
          expect({ strip, ribbon, bar }).toEqual({ strip: 0, ribbon: 0, bar: 0 });
          expect(tabRow).toBeLessThanOrEqual(1); // sub-pixel rounding of the flexible tab area
          expect(s.contentRight).toBeLessThanOrEqual(s.stripRight);
          await shot(`${dark ? 'dark' : 'light'}-${name}-${tab}`);
        }
        await selectTab('home');
      });
    }
  }

  it('drop-downs: collapsed group and "more" (half and quarter width, light and dark)', async () => {
    for (const dark of [false, true]) {
      await setDark(dark);
      await setSize(960, 1040);
      await selectTab('home');
      const collapsed = await browser.$('.onr-strip .onr-group.is-collapsed .onr-group-button');
      if (await collapsed.isExisting()) {
        await collapsed.click();
        await pause(250);
        await shot(`${dark ? 'dark' : 'light'}-half-home-group-dropdown`);
        await browser.keys('Escape');
      }
      await setSize(480, 1040);
      const more = await browser.$('.onr-strip .onr-more-button');
      if (await more.isExisting()) {
        await more.click();
        await pause(250);
        await shot(`${dark ? 'dark' : 'light'}-quarter-home-more-dropdown`);
        await browser.keys('Escape');
      }
    }
  });
});
