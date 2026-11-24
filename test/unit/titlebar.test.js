// The empty strip of the tab row: when a click there opens the folded ribbon, and when a
// press on it is a drag that moves the window instead.
import test from 'node:test';
import assert from 'node:assert/strict';
import { stripOpensRibbon, isDrag, windowPosition, DRAG_THRESHOLD } from '../../src/ribbon/titlebar.js';

test('the strip opens the ribbon only with auto-collapse on, the ribbon folded and not customising', () => {
  assert.equal(stripOpensRibbon({ autoCollapse: true, collapsed: true, editing: false }), true);
  assert.equal(stripOpensRibbon({ autoCollapse: false, collapsed: true, editing: false }), false);
  assert.equal(stripOpensRibbon({ autoCollapse: true, collapsed: false, editing: false }), false);
  assert.equal(stripOpensRibbon({ autoCollapse: true, collapsed: true, editing: true }), false);
  assert.equal(stripOpensRibbon({}), false);
});

test('a press that stays within a few pixels is a click, more is a drag', () => {
  assert.equal(isDrag(0, 0), false);
  assert.equal(isDrag(DRAG_THRESHOLD, -DRAG_THRESHOLD), false);
  assert.equal(isDrag(DRAG_THRESHOLD + 1, 0), true);
  assert.equal(isDrag(0, -(DRAG_THRESHOLD + 1)), true);
});

test('a dragged window follows the pointer', () => {
  const start = { x: 100, y: 50, screenX: 400, screenY: 60 };
  assert.deepEqual(windowPosition(start, 400, 60), { x: 100, y: 50 });
  assert.deepEqual(windowPosition(start, 430.4, 20), { x: 130, y: 10 });
});

test('a maximised window is restored under the pointer at the same relative spot', () => {
  // Pressed at 75% of a maximised window's width, 10px below its top; restored to 800px wide.
  const start = { ratio: 0.75, width: 800, y: 0, screenX: 1440, screenY: 10 };
  assert.deepEqual(windowPosition(start, 1450, 110), { x: 850, y: 100 });
});
