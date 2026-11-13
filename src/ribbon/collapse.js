/*
 * Adaptive sizing: decides how each group of a tab is drawn for a given ribbon width.
 *
 * Pure functions, no DOM. The view measures how wide each group is at each level and
 * passes the numbers in; this file decides. It never returns a result wider than the
 * space it was given (unless the "more" button alone doesn't fit), so the ribbon never
 * needs a horizontal scroll bar.
 *
 * Levels of a group:
 *   0  as the user set it up (large and small buttons)
 *   1  every button small: icon + label, stacked three high
 *   2  every button icon-only, stacked three high
 *   3  the whole group collapses into one drop-down button
 * After that, groups that still don't fit move into the "more" drop-down at the right end.
 *
 * Shrinking is step by step, like Office: first everything goes small, then icon-only,
 * then groups collapse. A group's priority shifts when its steps happen:
 *   'first'  shrinks one and a half levels ahead of normal groups
 *   'last'   shrinks one and a half levels behind
 * Among equals, the group furthest to the right goes first.
 */

export const LEVEL_FULL = 0;
export const LEVEL_SMALL = 1;
export const LEVEL_ICONS = 2;
export const LEVEL_COLLAPSED = 3;

const BIAS = { first: -1.5, normal: 0, last: 1.5 };

const bias = (g) => (g.priority in BIAS ? BIAS[g.priority] : 0);

/**
 * The order in which shrink steps are taken.
 * groups: [{ id, priority }] in ribbon order. Returns [{ id, level }].
 */
export function shrinkSteps(groups) {
  const steps = [];
  groups.forEach((g, index) => {
    for (let level = LEVEL_SMALL; level <= LEVEL_COLLAPSED; level++) {
      steps.push({ id: g.id, level, key: level + bias(g), index });
    }
  });
  steps.sort((a, b) => a.key - b.key || b.index - a.index || a.level - b.level);
  return steps.map(({ id, level }) => ({ id, level }));
}

/** The order in which groups move into the "more" drop-down: 'first' groups, then from the right. */
export function overflowOrder(groups) {
  return groups
    .map((g, index) => ({ id: g.id, key: bias(g), index }))
    .sort((a, b) => a.key - b.key || b.index - a.index)
    .map((x) => x.id);
}

function totalWidth(groups, levels, gap) {
  let w = 0;
  for (const g of groups) w += g.widths[levels[g.id]];
  return w + gap * Math.max(0, groups.length - 1);
}

function shrinkToFit(groups, available, gap) {
  const levels = {};
  for (const g of groups) levels[g.id] = LEVEL_FULL;
  const byId = new Map(groups.map((g) => [g.id, g]));
  let used = totalWidth(groups, levels, gap);
  if (used <= available) return { levels, used, fits: true };
  for (const step of shrinkSteps(groups)) {
    const g = byId.get(step.id);
    // Skip steps that don't make the group narrower (a group of small buttons has no
    // "small" step, a one-button group gains nothing from collapsing).
    if (step.level <= levels[g.id] || !(g.widths[step.level] < g.widths[levels[g.id]])) continue;
    levels[g.id] = step.level;
    used = totalWidth(groups, levels, gap);
    if (used <= available) return { levels, used, fits: true };
  }
  return { levels, used, fits: false };
}

/**
 * Fits a tab's groups into `available` pixels.
 *
 *   groups     [{ id, priority, widths: [w0, w1, w2, w3] }] in ribbon order
 *   available  width of the ribbon strip
 *   gap        space between two groups
 *   moreWidth  width of the "more" button, including its gap
 *
 * Returns { levels: { [id]: 0..3 }, overflow: [ids in ribbon order], used }.
 * `used` is the width taken, including the "more" button when there is overflow.
 */
export function fitGroups({ groups, available, gap = 0, moreWidth = 0 }) {
  const all = shrinkToFit(groups, available, gap);
  if (all.fits) return { levels: all.levels, overflow: [], used: all.used };

  const order = overflowOrder(groups);
  const hidden = new Set();
  for (const id of order) {
    hidden.add(id);
    const rest = groups.filter((g) => !hidden.has(g.id));
    const fit = shrinkToFit(rest, available - moreWidth, gap);
    if (fit.fits || !rest.length) {
      return {
        levels: fit.levels,
        overflow: groups.filter((g) => hidden.has(g.id)).map((g) => g.id),
        used: fit.used + moreWidth,
      };
    }
  }
  return { levels: {}, overflow: groups.map((g) => g.id), used: moreWidth };
}

/**
 * Fits the tab labels into the tab row. Tabs that don't fit (from the right, never the
 * active one) move into a drop-down.
 *
 *   widths     width of each tab label, in order
 *   available  width of the tab area
 *   active     index of the active tab (-1 for none)
 *   moreWidth  width of the drop-down button
 *
 * Returns { visible: [indexes], overflow: [indexes] }.
 */
export function fitTabs({ widths, available, active = -1, moreWidth = 0 }) {
  const all = widths.map((_, i) => i);
  let used = widths.reduce((a, b) => a + b, 0);
  if (used <= available) return { visible: all, overflow: [] };
  const hidden = new Set();
  used += moreWidth;
  for (let i = widths.length - 1; i >= 0 && used > available; i--) {
    if (i === active) continue;
    hidden.add(i);
    used -= widths[i];
  }
  return { visible: all.filter((i) => !hidden.has(i)), overflow: all.filter((i) => hidden.has(i)) };
}
