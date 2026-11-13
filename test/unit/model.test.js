// The layout model: every right-click action and drag-and-drop ends up in one of these functions.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../../src/ribbon/model.js';
import { defaultLayout } from '../../src/ribbon/defaults.js';

const sample = () => M.normalizeLayout({
  tabs: [
    { id: 't1', name: 'One', groups: [
      { id: 'g1', name: 'A', items: [{ id: 'a', command: 'x:a', size: 'large' }, { id: 'b', command: 'x:b' }, { id: 'c', command: 'x:c' }] },
      { id: 'g2', name: 'B', items: [{ id: 'd', command: 'x:d' }] },
    ] },
    { id: 't2', name: 'Two', groups: [{ id: 'g3', name: 'C', items: [] }] },
  ],
});
const ids = (layout, groupId) => M.findGroup(layout, groupId).group.items.map((i) => i.id);

test('default layout has the twelve tabs, unique ids and no empty tab', () => {
  const L = defaultLayout();
  assert.deepEqual(L.tabs.map((t) => t.name), ['Home', 'Insert', 'View', 'Table', 'Navigate', 'Templates', 'Canvas', 'References', 'Review', 'Data', 'Slides', 'Utilities']);
  const seen = new Set();
  for (const t of L.tabs) {
    assert.ok(t.groups.length > 0, `${t.name} has groups`);
    for (const x of [t, ...t.groups, ...t.groups.flatMap((g) => g.items)]) {
      assert.ok(!seen.has(x.id), `duplicate id ${x.id}`);
      seen.add(x.id);
    }
    for (const g of t.groups) {
      assert.ok(g.items.length > 0, `${t.name} / ${g.name} has buttons`);
      for (const i of g.items) {
        assert.match(i.command, /^[\w-]+(:[\w:/-]+)?$/, i.command);
        assert.ok(i.label && i.icon, `${i.command} has a label and an icon`);
        assert.ok(M.SIZES.includes(i.size));
      }
    }
  }
  assert.ok(M.commandsIn(L, 'view').some((c) => c.startsWith('window:zoom')), 'View has zoom');
  assert.notEqual(defaultLayout().tabs[0], L.tabs[0], 'each call returns a fresh copy');
});

test('normalize repairs sloppy input and rejects non-layouts', () => {
  const L = M.normalizeLayout({ tabs: [
    { name: ' Home ', groups: [{ items: [{ command: ' a:b ', size: 'huge', label: '  ' }, { nope: 1 }, null], priority: 'whenever' }, 'junk'] },
    { id: 'dup', groups: 'x' }, { id: 'dup' }, 7,
  ] });
  assert.equal(L.tabs.length, 3);
  assert.equal(L.tabs[0].name, 'Home');
  const g = L.tabs[0].groups[0];
  assert.equal(g.priority, 'normal');
  assert.equal(g.items.length, 1);
  assert.deepEqual({ ...g.items[0], id: 0 }, { id: 0, command: 'a:b', size: 'small' });
  assert.notEqual(L.tabs[1].id, L.tabs[2].id);
  for (const bad of [null, 5, 'x', {}, { tabs: 'no' }]) assert.throws(() => M.normalizeLayout(bad), /not a ribbon layout/);
});

test('buttons: add, remove, rename, icon, size', () => {
  const L = sample();
  const added = M.addItem(L, 'g2', 'x:new', { size: 'large', index: 0 });
  assert.deepEqual(ids(L, 'g2'), [added.id, 'd']);
  assert.equal(M.addItem(L, 'nope', 'x:y'), null);
  assert.equal(M.addItem(L, 'g2', '  '), null);
  assert.ok(M.setItemSize(L, 'b', 'large'));
  assert.ok(!M.setItemSize(L, 'b', 'large'), 'no change reports false');
  assert.ok(!M.setItemSize(L, 'b', 'giant'));
  assert.ok(M.renameItem(L, 'b', ' Bee '));
  assert.ok(M.setItemIcon(L, 'b', 'star'));
  assert.deepEqual(M.findItem(L, 'b').item, { id: 'b', command: 'x:b', size: 'large', label: 'Bee', icon: 'star' });
  M.renameItem(L, 'b', '');
  M.setItemIcon(L, 'b', '');
  assert.deepEqual(M.findItem(L, 'b').item, { id: 'b', command: 'x:b', size: 'large' });
  assert.ok(M.removeItem(L, 'b'));
  assert.ok(!M.removeItem(L, 'b'));
  assert.deepEqual(ids(L, 'g1'), ['a', 'c']);
});

test('buttons: move left / right inside the group', () => {
  const L = sample();
  assert.ok(!M.shiftItem(L, 'a', -1), 'the first button has no left');
  assert.ok(M.shiftItem(L, 'a', 1));
  assert.deepEqual(ids(L, 'g1'), ['b', 'a', 'c']);
  assert.ok(M.shiftItem(L, 'a', 1));
  assert.ok(!M.shiftItem(L, 'a', 1), 'the last button has no right');
  assert.deepEqual(ids(L, 'g1'), ['b', 'c', 'a']);
});

test('buttons: drag and drop between groups and within a group', () => {
  const L = sample();
  assert.ok(M.moveItem(L, 'a', 'g2'), 'append to another group');
  assert.deepEqual([ids(L, 'g1'), ids(L, 'g2')], [['b', 'c'], ['d', 'a']]);
  assert.ok(M.moveItem(L, 'a', 'g1', 1), 'insert at a position');
  assert.deepEqual([ids(L, 'g1'), ids(L, 'g2')], [['b', 'a', 'c'], ['d']]);
  assert.ok(M.moveItem(L, 'b', 'g1', 3), 'to the end of its own group');
  assert.deepEqual(ids(L, 'g1'), ['a', 'c', 'b']);
  assert.ok(M.moveItem(L, 'b', 'g1', 0), 'to the start of its own group');
  assert.deepEqual(ids(L, 'g1'), ['b', 'a', 'c']);
  assert.ok(!M.moveItem(L, 'a', 'g1', 1), 'dropping on its own place changes nothing');
  assert.ok(!M.moveItem(L, 'a', 'g1', 2), 'dropping right after itself changes nothing');
  assert.ok(M.moveItem(L, 'c', 'g3', 99), 'into an empty group on another tab');
  assert.deepEqual(ids(L, 'g3'), ['c']);
  assert.ok(!M.moveItem(L, 'zzz', 'g1') && !M.moveItem(L, 'a', 'zzz'));
  const all = L.tabs.flatMap((t) => t.groups.flatMap((g) => g.items.map((i) => i.id))).sort();
  assert.deepEqual(all, ['a', 'b', 'c', 'd'], 'nothing lost or duplicated');
});

test('groups: add, rename, reorder, priority, delete', () => {
  const L = sample();
  const g = M.addGroup(L, 't1', 'New', 'g1');
  assert.deepEqual(L.tabs[0].groups.map((x) => x.id), ['g1', g.id, 'g2']);
  assert.ok(M.renameGroup(L, g.id, 'Renamed') && !M.renameGroup(L, g.id, ' '));
  assert.ok(M.moveGroup(L, 'g1', 1));
  assert.ok(!M.moveGroup(L, 'g2', 1));
  assert.deepEqual(L.tabs[0].groups.map((x) => x.id), [g.id, 'g1', 'g2']);
  assert.ok(M.setGroupPriority(L, 'g1', 'first'));
  assert.ok(!M.setGroupPriority(L, 'g1', 'first') && !M.setGroupPriority(L, 'g1', 'soon'));
  assert.ok(M.removeGroup(L, g.id));
  assert.deepEqual(L.tabs[0].groups.map((x) => x.id), ['g1', 'g2']);
});

test('tabs: add, rename, hide, reorder, delete', () => {
  const L = sample();
  const t = M.addTab(L, 'Three', 't1');
  assert.deepEqual(L.tabs.map((x) => x.id), ['t1', t.id, 't2']);
  assert.ok(M.renameTab(L, t.id, 'III'));
  assert.ok(M.setTabHidden(L, t.id, true));
  assert.deepEqual(M.visibleTabs(L).map((x) => x.id), ['t1', 't2']);
  assert.equal(M.activeTab(L, t.id).id, 't1', 'a hidden tab is never the active one');
  assert.equal(M.activeTab(L, 't2').id, 't2');
  assert.ok(M.moveTab(L, 't1', 1), 'moving skips over hidden tabs');
  assert.deepEqual(M.visibleTabs(L).map((x) => x.id), ['t2', 't1']);
  assert.ok(!M.moveTab(L, 't1', 1));
  assert.ok(M.setTabHidden(L, 't2', true));
  assert.ok(!M.setTabHidden(L, 't1', true), 'the last visible tab stays');
  assert.ok(!M.removeTab(L, 't1'), 'the last visible tab is never deleted');
  assert.ok(M.removeTab(L, 't2'));
  assert.ok(M.setTabHidden(L, t.id, false));
  assert.deepEqual(M.visibleTabs(L).map((x) => x.name), ['III', 'One']);
});

test('columns: large buttons stand alone, small ones stack three high', () => {
  const items = [{ size: 'large', id: 1 }, ...[2, 3, 4, 5].map((id) => ({ size: 'small', id })), { size: 'large', id: 6 }, { size: 'small', id: 7 }];
  const shape = (level) => M.packColumns(items, level).map((c) => `${c.kind}:${c.items.map((i) => i.id).join('')}`);
  assert.deepEqual(shape(0), ['large:1', 'stack:234', 'stack:5', 'large:6', 'stack:7']);
  assert.deepEqual(shape(1), ['stack:123', 'stack:456', 'stack:7']);
  assert.deepEqual(shape(2), shape(1));
  assert.deepEqual(M.packColumns([], 0), []);
});

test('export and import give back the same layout as one JSON file', () => {
  const L = defaultLayout();
  M.addItem(L, L.tabs[0].groups[0].id, 'some-plugin:thing', { label: 'Thing', icon: 'star', size: 'large' });
  M.setTabHidden(L, 'slides', true);
  M.setGroupPriority(L, L.tabs[1].groups[0].id, 'last');
  const text = M.exportLayout(L);
  assert.equal(JSON.parse(text).format, M.EXPORT_FORMAT);
  assert.deepEqual(M.importLayout(text), L);
  assert.deepEqual(M.importLayout(JSON.stringify({ settings: {}, ribbon: L })), L, 'a whole data.json works too');
});

test('import refuses files that are not a layout, with a readable reason', () => {
  assert.throws(() => M.importLayout('not json {'), /not valid JSON/);
  assert.throws(() => M.importLayout('{"hello": 1}'), /not a ribbon layout/);
  assert.throws(() => M.importLayout('{"tabs": []}'), /no tabs/);
  assert.throws(() => M.importLayout(JSON.stringify({ version: 99, tabs: [{ name: 'x' }] })), /newer version/);
  const allHidden = M.importLayout(JSON.stringify({ tabs: [{ name: 'x', hidden: true }] }));
  assert.equal(M.visibleTabs(allHidden).length, 1, 'never ends up with no visible tab');
});
