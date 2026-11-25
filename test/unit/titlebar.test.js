// The empty strip of the tab row: when a click there opens the folded ribbon, and when a
// press on it is a drag that moves the window instead.
import test from 'node:test';
import assert from 'node:assert/strict';
import { stripOpensRibbon, isDrag, windowPosition, snapZone, snapBounds, sameBounds, DRAG_THRESHOLD, SNAP_EDGE, SNAP_CORNER } from '../../src/ribbon/titlebar.js';

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

// A second screen to the right of the first, so the zones are checked away from 0,0 too.
const screen = { x: 2560, y: 0, width: 1920, height: 1080 };
const work = { x: 2560, y: 0, width: 1920, height: 1040 }; // taskbar at the bottom

test('a strip drag let go at a side edge snaps to that half, near a corner to that quarter', () => {
  const mid = 540;
  assert.equal(snapZone(2560, mid, screen), 'left');
  assert.equal(snapZone(2560 + SNAP_EDGE, mid, screen), 'left');
  assert.equal(snapZone(4479, mid, screen), 'right');
  assert.equal(snapZone(2560, SNAP_CORNER, screen), 'top-left');
  assert.equal(snapZone(4479, 0, screen), 'top-right');
  assert.equal(snapZone(2560, 1079, screen), 'bottom-left');
  assert.equal(snapZone(4479, 1079 - SNAP_CORNER, screen), 'bottom-right');
});

test('a strip drag let go at the top edge maximises; anywhere else it does not snap', () => {
  assert.equal(snapZone(3500, 0, screen), 'maximize');
  assert.equal(snapZone(3500, SNAP_EDGE, screen), 'maximize');
  assert.equal(snapZone(3500, SNAP_EDGE + 1, screen), null);
  assert.equal(snapZone(2560 + SNAP_EDGE + 1, 540, screen), null);
  assert.equal(snapZone(3500, 540, screen), null);
  assert.equal(snapZone(3500, 1079, screen), null); // bottom edge: Windows doesn't snap there either
  assert.equal(snapZone(100, 540, screen), null); // pointer on another screen
  assert.equal(snapZone(3500, 540, null), null);
});

test('snapped windows fill their half or quarter of the work area, not the taskbar', () => {
  assert.deepEqual(snapBounds('left', work), { x: 2560, y: 0, width: 960, height: 1040 });
  assert.deepEqual(snapBounds('right', work), { x: 3520, y: 0, width: 960, height: 1040 });
  assert.deepEqual(snapBounds('top-left', work), { x: 2560, y: 0, width: 960, height: 520 });
  assert.deepEqual(snapBounds('bottom-right', work), { x: 3520, y: 520, width: 960, height: 520 });
  // Odd sizes: the two halves still cover the whole area without a gap.
  const odd = { x: 0, y: 0, width: 1365, height: 767 };
  const l = snapBounds('left', odd), r = snapBounds('right', odd);
  assert.equal(l.width + r.width, 1365);
  assert.equal(r.x, l.x + l.width);
  const t = snapBounds('top-right', odd), b = snapBounds('bottom-right', odd);
  assert.equal(t.height + b.height, 767);
  assert.equal(snapBounds('maximize', work), null);
  assert.equal(snapBounds(null, work), null);
});

test('a window still counts as snapped within a pixel or two of its snap bounds', () => {
  const a = { x: 0, y: 0, width: 960, height: 1040 };
  assert.equal(sameBounds(a, { x: 1, y: 0, width: 959, height: 1041 }), true);
  assert.equal(sameBounds(a, { x: 0, y: 0, width: 1000, height: 1040 }), false);
  assert.equal(sameBounds(a, null), false);
});
