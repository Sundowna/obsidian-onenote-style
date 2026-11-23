import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

// Every selector of every rule that sets the given declaration.
function selectorsWith(declaration) {
  const out = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (m[2].replace(/\s+/g, ' ').includes(declaration)) {
      out.push(...m[1].split(',').map((s) => s.trim()).filter(Boolean));
    }
  }
  return out;
}

// Issue #1: Obsidian's pop-out Settings window copies the body classes, and
// its title bar is the only handle to drag the window by.
test('the title bar stays a drag area in pop-out modal windows', () => {
  const blocking = selectorsWith('-webkit-app-region: no-drag')
    .filter((s) => /\.titlebar(-inner)?$/.test(s));
  assert.ok(blocking.length > 0, 'expected the rule that frees the title bar under the top bar');
  for (const s of blocking) {
    assert.match(s, /:not\(\.is-popout-modal\)/, `"${s}" also hits pop-out modal windows`);
  }
});
