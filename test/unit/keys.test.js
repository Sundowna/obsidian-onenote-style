// Shortcut texts on Windows/Linux and on macOS.
import test from 'node:test';
import assert from 'node:assert/strict';
import { keysText, redoKeys, highlightModifiers } from '../../src/keys.js';

test('Windows and Linux: Mod is Ctrl, joined with +', () => {
  assert.equal(keysText('Mod+Z', false), 'Ctrl+Z');
  assert.equal(keysText('Mod+Shift+F', false), 'Ctrl+Shift+F');
  assert.equal(keysText('Mod+Alt+1', false), 'Ctrl+Alt+1');
  assert.equal(keysText('Alt+Shift+D', false), 'Alt+Shift+D');
  assert.equal(keysText('Mod+F1', false), 'Ctrl+F1');
});

test('macOS: symbols in Apple order, no +', () => {
  assert.equal(keysText('Mod+Z', true), '⌘Z');
  assert.equal(keysText('Mod+Shift+F', true), '⇧⌘F');
  assert.equal(keysText('Mod+Alt+1', true), '⌥⌘1');
  assert.equal(keysText('Alt+Shift+D', true), '⌥⇧D');
  assert.equal(keysText('Mod+Ctrl+H', true), '⌃⌘H');
  assert.equal(keysText('Mod+Shift+Alt+N', true), '⌥⇧⌘N');
});

test('redo and highlight differ on macOS', () => {
  assert.equal(keysText(redoKeys(false), false), 'Ctrl+Y');
  assert.equal(keysText(redoKeys(true), true), '⇧⌘Z');
  assert.deepEqual(highlightModifiers(false), ['Mod', 'Alt']);
  assert.deepEqual(highlightModifiers(true), ['Mod', 'Ctrl']);
});
