// Layout and collapse logic: how a tab's groups shrink as the ribbon gets narrower.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fitGroups, shrinkSteps, overflowOrder, fitTabs } from '../../src/ribbon/collapse.js';
import { defaultLayout } from '../../src/ribbon/defaults.js';
import { packColumns } from '../../src/ribbon/model.js';

// A width model close to the real stylesheet, so the tests can run without a browser.
const LARGE = 62, SMALL = 104, ICON = 28, COLLAPSED = 64, PAD = 14, GAP = 2, MORE = 64;
function widthsOf(group) {
  if (!group.items.length) return [60, 60, 60, 60];
  const w = (level) => {
    const cols = packColumns(group.items, level);
    const sum = cols.reduce((a, c) => a + (c.kind === 'large' ? LARGE : level === 2 ? ICON : SMALL), 0);
    return PAD + sum + GAP * (cols.length - 1);
  };
  return [w(0), w(1), w(2), COLLAPSED];
}
const measured = (tab) => tab.groups.map((g) => ({ id: g.id, priority: g.priority, widths: widthsOf(g) }));
const usedWidth = (groups, fit) => groups
  .filter((g) => !fit.overflow.includes(g.id))
  .reduce((a, g) => a + g.widths[fit.levels[g.id]], 0) + (fit.overflow.length ? MORE : 0);

// Window widths from full screen down to a quarter of a small screen.
const WIDTHS = [3840, 2560, 1920, 1600, 1366, 1280, 1024, 960, 800, 683, 640, 512, 480, 400, 341, 320, 240, 160];

test('every default tab fits at every width, without ever needing a scroll bar', () => {
  for (const tab of defaultLayout().tabs) {
    const groups = measured(tab);
    for (const available of WIDTHS) {
      const fit = fitGroups({ groups, available, moreWidth: MORE });
      const used = usedWidth(groups, fit);
      assert.equal(used, fit.used, `${tab.name} @${available}: reported width matches`);
      assert.ok(used <= available, `${tab.name} @${available}: uses ${used}px`);
      // every group is either drawn or in "more", never lost
      for (const g of groups) assert.ok(fit.overflow.includes(g.id) !== (g.id in fit.levels), `${tab.name} @${available}: ${g.id}`);
    }
  }
});

test('with enough room nothing shrinks', () => {
  const groups = measured(defaultLayout().tabs[0]);
  const fit = fitGroups({ groups, available: 100000, moreWidth: MORE });
  assert.deepEqual(fit.overflow, []);
  assert.ok(Object.values(fit.levels).every((l) => l === 0));
});

test('narrower never means bigger: levels only go up as the width goes down', () => {
  for (const tab of defaultLayout().tabs) {
    const groups = measured(tab);
    let prev = null;
    for (let available = 2600; available >= 120; available -= 20) {
      const fit = fitGroups({ groups, available, moreWidth: MORE });
      const visible = groups.filter((g) => !fit.overflow.includes(g.id));
      if (prev !== null) {
        assert.ok(fit.overflow.length >= prev.overflow, `${tab.name} @${available}: "more" never shrinks`);
        if (fit.overflow.length === prev.overflow) {
          for (const g of visible) assert.ok(fit.levels[g.id] >= prev.levels[g.id], `${tab.name} @${available}: ${g.id} grew`);
        }
      }
      prev = { overflow: fit.overflow.length, levels: fit.levels };
    }
  }
});

test('shrinks step by step: large -> small -> icon-only -> drop-down -> more', () => {
  const g = (id) => ({ id, priority: 'normal', widths: [300, 200, 100, 60] });
  const groups = [g('a'), g('b'), g('c')];
  const at = (available) => fitGroups({ groups, available, moreWidth: 50 });
  assert.deepEqual(at(900).levels, { a: 0, b: 0, c: 0 });
  assert.deepEqual(at(899).levels, { a: 0, b: 0, c: 1 }, 'the right-most group shrinks first');
  assert.deepEqual(at(700).levels, { a: 0, b: 1, c: 1 });
  assert.deepEqual(at(600).levels, { a: 1, b: 1, c: 1 }, 'all small before any goes icon-only');
  assert.deepEqual(at(500).levels, { a: 1, b: 1, c: 2 });
  assert.deepEqual(at(300).levels, { a: 2, b: 2, c: 2 }, 'all icon-only before any collapses');
  assert.deepEqual(at(260).levels, { a: 2, b: 2, c: 3 });
  assert.deepEqual(at(180).levels, { a: 3, b: 3, c: 3 });
  const tight = at(179);
  assert.deepEqual(tight.overflow, ['c'], 'then groups move into "more" from the right');
  assert.deepEqual(at(60).overflow, ['a', 'b', 'c']);
  assert.deepEqual(at(60).levels, {});
});

test('groups left on the ribbon use the room that "more" frees up', () => {
  const groups = ['a', 'b', 'c'].map((id) => ({ id, priority: 'normal', widths: [300, 200, 100, 60] }));
  const fit = fitGroups({ groups, available: 175, moreWidth: 50 });
  assert.deepEqual(fit.overflow, ['c']);
  assert.deepEqual(fit.levels, { a: 3, b: 3 });
  assert.equal(fit.used, 170);
  const roomy = fitGroups({ groups, available: 260, moreWidth: 50 });
  assert.deepEqual(roomy.overflow, []);
});

test('the user decides which groups shrink first and last', () => {
  const groups = [
    { id: 'keep', priority: 'last', widths: [300, 200, 100, 60] },
    { id: 'mid', priority: 'normal', widths: [300, 200, 100, 60] },
    { id: 'early', priority: 'first', widths: [300, 200, 100, 60] },
  ];
  const at = (available) => fitGroups({ groups, available, moreWidth: 50 });
  assert.deepEqual(at(800).levels, { keep: 0, mid: 0, early: 1 });
  assert.deepEqual(at(700).levels, { keep: 0, mid: 0, early: 2 }, '"first" is icon-only before a normal group shrinks');
  assert.deepEqual(at(600).levels, { keep: 0, mid: 1, early: 2 });
  assert.deepEqual(at(560).levels, { keep: 0, mid: 1, early: 3 }, '"first" collapses before a normal group goes icon-only');
  assert.deepEqual(at(460).levels, { keep: 0, mid: 2, early: 3 }, '"last" stays large while normal groups go icon-only');
  assert.deepEqual(at(459).levels, { keep: 1, mid: 2, early: 3 });
  // priority also beats position: a "first" group on the far left goes before the others
  const left = [{ ...groups[2] }, { ...groups[1] }, { ...groups[0] }];
  assert.deepEqual(fitGroups({ groups: left, available: 800, moreWidth: 50 }).levels, { early: 1, mid: 0, keep: 0 });
  assert.deepEqual(overflowOrder(groups), ['early', 'mid', 'keep']);
  assert.deepEqual(fitGroups({ groups, available: 175, moreWidth: 50 }).overflow, ['early']);
});

test('steps that save no space are skipped', () => {
  const groups = [
    { id: 'small-only', priority: 'normal', widths: [120, 120, 40, 64] }, // nothing to gain from "small"
    { id: 'one-button', priority: 'normal', widths: [60, 60, 34, 64] }, // collapsing would be wider
  ];
  const fit = fitGroups({ groups, available: 100, moreWidth: 50 });
  assert.deepEqual(fit.levels, { 'small-only': 2, 'one-button': 2 });
  assert.equal(fit.used, 74);
});

test('shrink steps come in a stable, complete order', () => {
  const groups = [{ id: 'a', priority: 'normal' }, { id: 'b', priority: 'normal' }];
  assert.deepEqual(shrinkSteps(groups), [
    { id: 'b', level: 1 }, { id: 'a', level: 1 },
    { id: 'b', level: 2 }, { id: 'a', level: 2 },
    { id: 'b', level: 3 }, { id: 'a', level: 3 },
  ]);
});

test('an empty tab and a zero width do not break anything', () => {
  assert.deepEqual(fitGroups({ groups: [], available: 500 }), { levels: {}, overflow: [], used: 0 });
  const groups = [{ id: 'a', priority: 'normal', widths: [300, 200, 100, 60] }];
  assert.deepEqual(fitGroups({ groups, available: 0, moreWidth: 50 }).overflow, ['a']);
});

test('tab labels that do not fit move into a drop-down, never the active one', () => {
  const widths = [60, 60, 60, 60, 60];
  assert.deepEqual(fitTabs({ widths, available: 300, active: 0, moreWidth: 30 }), { visible: [0, 1, 2, 3, 4], overflow: [] });
  assert.deepEqual(fitTabs({ widths, available: 299, active: 0, moreWidth: 30 }), { visible: [0, 1, 2, 3], overflow: [4] });
  assert.deepEqual(fitTabs({ widths, available: 160, active: 4, moreWidth: 30 }), { visible: [0, 4], overflow: [1, 2, 3] });
  assert.deepEqual(fitTabs({ widths, available: 95, active: 2, moreWidth: 30 }), { visible: [2], overflow: [0, 1, 3, 4] });
});
