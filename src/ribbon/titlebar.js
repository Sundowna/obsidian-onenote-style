/*
 * The empty strip of the tab row (between the last tab and the search field).
 *
 * On desktop the strip is a window-drag area (-webkit-app-region: drag). Chromium hands
 * presses on such an area to the operating system, so the page never sees a click there.
 * While the ribbon is auto-collapsed the strip should also open the ribbon on a plain
 * click, so it then stops being a drag area and the plugin moves the window itself when
 * the press turns into a drag, and snaps it at the screen edges when let go (Windows Snap
 * doesn't see a drag it didn't run). These are the pure decisions behind that (unit-tested).
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
/** How close (in screen pixels) to a screen edge a release snaps the window there. */
export const SNAP_EDGE = 8;
/** How far from a corner (along the side edge) a release snaps to a quarter instead of a half. */
export const SNAP_CORNER = 64;

/**
 * Where a window dragged by the strip snaps when it is let go, like Windows Snap does for a
 * native title-bar drag (which the strip drag is not, so Windows doesn't do it for us).
 * bounds: the screen the pointer is on ({ x, y, width, height }).
 * Returns null (no snap), 'maximize', or 'left' / 'right' / 'top-left' / 'top-right' /
 * 'bottom-left' / 'bottom-right'.
 */
export function snapZone(screenX, screenY, bounds, edge = SNAP_EDGE, corner = SNAP_CORNER) {
  if (!bounds) return null;
  const left = screenX <= bounds.x + edge;
  const right = screenX >= bounds.x + bounds.width - 1 - edge;
  const top = screenY <= bounds.y + edge;
  const inside = screenX >= bounds.x - edge && screenX <= bounds.x + bounds.width + edge
    && screenY >= bounds.y - edge && screenY <= bounds.y + bounds.height + edge;
  if (!inside) return null;
  if (left || right) {
    const side = left ? 'left' : 'right';
    if (screenY <= bounds.y + corner) return `top-${side}`;
    if (screenY >= bounds.y + bounds.height - 1 - corner) return `bottom-${side}`;
    return side;
  }
  return top ? 'maximize' : null;
}

/** The window bounds for a snap zone inside a screen's work area (the part without the taskbar). */
export function snapBounds(zone, area) {
  if (!zone || zone === 'maximize' || !area) return null;
  const halfW = Math.round(area.width / 2);
  const halfH = Math.round(area.height / 2);
  const leftSide = zone.endsWith('left');
  const x = leftSide ? area.x : area.x + halfW;
  const width = leftSide ? halfW : area.width - halfW;
  if (zone === 'left' || zone === 'right') return { x, y: area.y, width, height: area.height };
  const topRow = zone.startsWith('top');
  return { x, y: topRow ? area.y : area.y + halfH, width, height: topRow ? halfH : area.height - halfH };
}

/** Whether a window's bounds are (still) the ones a snap gave it. */
export function sameBounds(a, b, slack = 2) {
  if (!a || !b) return false;
  return ['x', 'y', 'width', 'height'].every((k) => Math.abs(a[k] - b[k]) <= slack);
}

export function windowPosition(start, screenX, screenY) {
  const dx = screenX - start.screenX;
  const dy = screenY - start.screenY;
  if (start.ratio == null) return { x: Math.round(start.x + dx), y: Math.round(start.y + dy) };
  return {
    x: Math.round(screenX - start.ratio * start.width),
    y: Math.round(start.y + dy),
  };
}
