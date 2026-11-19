import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hangColumns, isCodeBlockToken } from '../../src/hang-rules.js';

test('indent: tabs count to the next tab stop, spaces one each', () => {
  assert.equal(hangColumns('\tword'), 4);
  assert.equal(hangColumns('\t\tword'), 8);
  assert.equal(hangColumns('  \tword'), 4);
  assert.equal(hangColumns('    word'), 4);
  assert.equal(hangColumns('\tword', 2), 2);
});

test('a list marker after the indent counts too, with or without a space', () => {
  assert.equal(hangColumns('\t3.Read the material'), 6);
  assert.equal(hangColumns('\t3. Read the material'), 7);
  assert.equal(hangColumns('12) Twelfth'), 4);
  assert.equal(hangColumns('- build high-quality'), 2);
  assert.equal(hangColumns('  * star bullet'), 4);
  assert.equal(hangColumns('\t1.\tTabbed'), 10);
});

test('no hanging indent for plain lines, numbers that are not markers, or empty lines', () => {
  assert.equal(hangColumns('Plain line'), 0);
  assert.equal(hangColumns('3.14 is pi'), 0);
  assert.equal(hangColumns('-not a bullet'), 0);
  assert.equal(hangColumns('<steps>'), 0);
  assert.equal(hangColumns(''), 0);
  assert.equal(hangColumns('\t  '), 0);
  assert.equal(hangColumns('\t-x'), 4);
});

test('code-block tokens: the inside counts, the fences do not', () => {
  assert.equal(isCodeBlockToken('hmd-codeblock'), true);
  assert.equal(isCodeBlockToken('hmd-codeblock_tag'), true);
  assert.equal(isCodeBlockToken('formatting-code-block_hmd-codeblock'), false);
  assert.equal(isCodeBlockToken('formatting_formatting-list_formatting-list-ul_list-1'), false);
  assert.equal(isCodeBlockToken('inline-code'), false);
});
