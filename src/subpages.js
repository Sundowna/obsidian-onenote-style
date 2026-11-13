/*
 * Subpage ordering. Pure function, no Obsidian access, unit-tested.
 *
 * A list (already sorted the way the user chose: A-Z, Z-A, newest first...) is regrouped
 * so that every subpage sits directly under its parent. The given order is kept within
 * each level: the top-level pages keep their order, and so do the subpages of one parent.
 * So "Z-A" sorts the pages Z-A, and under each page its subpages Z-A.
 *
 *   items     the sorted list (anything: files, tree rows...)
 *   keyOf     item -> unique key (a path)
 *   parentOf  item -> key of its parent, or null. A parent that is not in the list
 *             counts as no parent.
 */
export function groupUnderParents(items, keyOf, parentOf) {
  const keys = new Set(items.map(keyOf));
  const kids = new Map();
  const roots = [];
  for (const item of items) {
    const parent = parentOf(item);
    if (parent != null && parent !== keyOf(item) && keys.has(parent)) {
      if (!kids.has(parent)) kids.set(parent, []);
      kids.get(parent).push(item);
    } else {
      roots.push(item);
    }
  }
  if (!kids.size) return items;
  const out = [];
  const done = new Set();
  const add = (item) => {
    const key = keyOf(item);
    if (done.has(key)) return;
    done.add(key);
    out.push(item);
    for (const kid of kids.get(key) || []) add(kid);
  };
  roots.forEach(add);
  items.forEach(add); // pages caught in a loop of parents still show, in their sorted place
  return out;
}
