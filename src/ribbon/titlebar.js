/*
 * The empty strip of the tab row (between the last tab and the search field).
 *
 * On desktop the strip is a window-drag area (-webkit-app-region: drag). Chromium hands
 * presses on such an area to the operating system, so the page never sees a click there.
 * While the ribbon is auto-collapsed the strip should also open the ribbon on a plain
 * click, so it then stops being a drag area and the plugin moves the window itself when
 * the press turns into a drag. These are the pure decisions behind that (unit-tested).
 */

/** How far (in CSS pixels) the pointer may move before a press counts as a drag. */
export const DRAG_THRESHOLD = 4;

/** Whether a click on the strip should open the ribbon right now. */
export function stripOpensRibbon({ autoCollapse, collapsed, editing }) {
  return !!autoCollapse && !!collapsed && !editing;
}

/** Whether the pointer has moved far enough from where it was pressed to be a drag. */
export function isDrag(dx, dy, threshold = DRAG_THRESHOLD) {
  return Math.abs(dx) > threshold || Math.abs(dy) > threshold;
}

/**
 * Where the window goes while it is dragged by the strip.
 * start: the window's position and the pointer's screen position when the drag began.
 * When a maximised window is dragged it is restored first (like the native drag); `ratio`
 * keeps the pointer at the same relative spot of the now narrower window, and `width` is
 * the restored width.
 */
export function windowPosition(start, screenX, screenY) {
  const dx = screenX - start.screenX;
  const dy = screenY - start.screenY;
  if (start.ratio == null) return { x: Math.round(start.x + dx), y: Math.round(start.y + dy) };
  return {
    x: Math.round(screenX - start.ratio * start.width),
    y: Math.round(start.y + dy),
  };
}
