import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenHider, htmlPairs, styleValue, isLineMarker } from '../../src/syntax-rules.js';
import { toggleWrap, toggleMark, removeHighlight, clearFormatting, plainText, markColor } from '../../src/selection-format.js';

const YELLOW = '#FFF3A3A6';
const GREEN = '#BBFABBA6';
const mark = (c, t) => `<mark style="background: ${c};">${t}</mark>`;
// "a [|sel|] b" -> the text without the brackets, and the selection they mark
function sel(s) {
  const a = s.indexOf('[|');
  const b = s.indexOf('|]') - 2;
  return [s.replace('[|', '').replace('|]', ''), a, b];
}
const show = (r) => r.text.slice(0, r.a) + '[|' + r.text.slice(r.a, r.b) + '|]' + r.text.slice(r.b);

/* ---------- which tokens are hidden ---------- */

test('formatting markers are hidden, bullets, checkboxes, tags and code fences are not', () => {
  const hides = (name) => tokenHider()(name, 0, 1);
  for (const n of [
    'formatting_formatting-strong_strong', 'em_formatting_formatting-em',
    'formatting_formatting-header_formatting-header-2_header_header-2',
    'formatting_formatting-quote_formatting-quote-1_quote_quote-1',
    'formatting_formatting-highlight_highlight', 'formatting-link_formatting-link-start',
    'formatting_formatting-link_link', 'formatting_formatting-code_inline-code',
    'formatting-escape_hmd-escape-backslash', 'hmd-internal-link_link-has-alias', 'hmd-internal-link_link-alias-pipe',
  ]) assert.equal(hides(n), true, n);
  for (const n of [
    'formatting_formatting-list_formatting-list-ul_list-1', 'formatting_formatting-task_meta',
    'formatting_formatting-hashtag_hashtag_hashtag-begin_meta_tag-x', 'formatting_formatting-code-block_hmd-codeblock',
    'strong', 'hmd-internal-link', 'hmd-internal-link_link-alias', 'link', 'HyperMD-header_HyperMD-header-2', 'url',
  ]) assert.equal(hides(n), false, n);
});

test('the address of [text](url) is hidden, a bare address is not', () => {
  const h = tokenHider();
  assert.equal(h('formatting_formatting-link-string_string_url', 69, 70), true);
  assert.equal(h('string_url', 70, 89), true);
  assert.equal(h('formatting_formatting-link-string_string_url', 89, 90), true);
  assert.equal(tokenHider()('string_url', 5, 24), false);
  assert.equal(tokenHider()('url', 5, 24), false);
});

test('heading and quote markers are line markers', () => {
  assert.equal(isLineMarker('formatting_formatting-header_formatting-header-2_header_header-2'), true);
  assert.equal(isLineMarker('formatting_formatting-quote_formatting-quote-1_quote_quote-1'), true);
  assert.equal(isLineMarker('formatting_formatting-strong_strong'), false);
});

test('html pairs: tags and the look of the text between them', () => {
  const line = `a ${mark(GREEN, 'green')} and <u>under</u> and <sup>2</sup> x`;
  const pairs = htmlPairs(line);
  assert.deepEqual(pairs.map((p) => p.name), ['mark', 'u', 'sup']);
  assert.equal(line.slice(...pairs[0].open), `<mark style="background: ${GREEN};">`);
  assert.equal(line.slice(...pairs[0].close), '</mark>');
  assert.deepEqual(pairs[0].look, { style: `background-color: ${GREEN}` });
  assert.deepEqual(pairs[1].look, { style: 'text-decoration: underline' });
  assert.deepEqual(pairs[2].look, { class: 'onenote-sup' });
  assert.deepEqual(htmlPairs('<mark>plain</mark>')[0].look, { class: 'cm-highlight' });
  assert.deepEqual(htmlPairs('<span style="color:#C00000">red</span>')[0].look, { style: 'color: #C00000' });
});

test('html pairs: unmatched tags are left alone, nesting works', () => {
  assert.deepEqual(htmlPairs('a <mark>b'), []);
  assert.deepEqual(htmlPairs('a </u> b <u>c'), []);
  assert.deepEqual(htmlPairs('<u><b>x</b></u>').map((p) => p.name), ['b', 'u']);
  assert.deepEqual(htmlPairs('a < b and c > d'), []);
});

test('style values: only plain colour values pass', () => {
  assert.equal(styleValue(' style="background: #FFF3A3A6;"', 'background'), '#FFF3A3A6');
  assert.equal(styleValue(' style="background-color:rgb(1, 2, 3)"', 'background'), 'rgb(1, 2, 3)');
  assert.equal(styleValue(' style="background: url(javascript:x)"', 'background'), '');
  assert.equal(styleValue(' class="x"', 'background'), '');
});

/* ---------- formatting the selection ---------- */

test('toggleWrap adds markers, and removes them from around or inside the selection', () => {
  assert.equal(show(toggleWrap(...sel('a [|word|] b'), '**', '**')), 'a **[|word|]** b');
  assert.equal(show(toggleWrap(...sel('a **[|word|]** b'), '**', '**')), 'a [|word|] b');
  assert.equal(show(toggleWrap(...sel('a [|**word**|] b'), '**', '**')), 'a [|word|] b');
  assert.equal(show(toggleWrap(...sel('a [|page|] b'), '[[', ']]')), 'a [[[|page|]]] b');
});

test('toggleMark: colour on, same colour off, other colour replaces', () => {
  const on = toggleMark(...sel('a [|word|] b'), YELLOW);
  assert.equal(show(on), `a ${mark(YELLOW, '[|word|]')} b`);
  assert.equal(show(toggleMark(on.text, on.a, on.b, YELLOW)), 'a [|word|] b');
  assert.equal(show(toggleMark(on.text, on.a, on.b, GREEN)), `a ${mark(GREEN, '[|word|]')} b`);
  // the tags are part of the selection (Source mode)
  assert.equal(show(toggleMark(...sel(`a [|${mark(YELLOW, 'word')}|] b`), YELLOW)), 'a [|word|] b');
});

test('toggleMark: a colour replaces a plain ==highlight== and nothing nests', () => {
  assert.equal(show(toggleMark(...sel('a ==[|word|]== b'), GREEN)), `a ${mark(GREEN, '[|word|]')} b`);
  assert.equal(show(toggleMark(...sel(`[|one ${mark(YELLOW, 'two')} ==three==|]`), GREEN)), mark(GREEN, '[|one two three|]'));
});

test('toggleMark: several lines get one highlight each, list markers stay outside', () => {
  const r = toggleMark(...sel('- [|one\n- [ ] two\n\n## three|]'), YELLOW);
  assert.equal(r.text, `- ${mark(YELLOW, 'one')}\n- [ ] ${mark(YELLOW, 'two')}\n\n## ${mark(YELLOW, 'three')}`);
  assert.equal(r.text.slice(r.a, r.b).startsWith('one'), true);
  assert.equal(r.text.slice(r.a, r.b).endsWith('three'), true);
  // the same colour again takes all of them off
  assert.equal(toggleMark(r.text, r.a, r.b, YELLOW).text, '- one\n- [ ] two\n\n## three');
});

test('removeHighlight: plain, coloured, nested and several parts', () => {
  assert.equal(show(removeHighlight(...sel('a ==[|word|]== b'))), 'a [|word|] b');
  assert.equal(show(removeHighlight(...sel(`a ${mark(GREEN, '[|word|]')} b`))), 'a [|word|] b');
  assert.equal(show(removeHighlight(...sel(`[|==one== and ${mark(YELLOW, 'two')} and ${mark(GREEN, 'three')}|]`))), '[|one and two and three|]');
  assert.equal(show(removeHighlight(...sel('a [|word|] b'))), 'a [|word|] b');
});

test('clearFormatting: markers around and inside the selection', () => {
  assert.equal(show(clearFormatting(...sel('a **[|word|]** b'))), 'a [|word|] b');
  assert.equal(show(clearFormatting(...sel('a ***[|word|]*** b'))), 'a [|word|] b');
  assert.equal(show(clearFormatting(...sel(`a ==${mark(GREEN, '[|word|]')}== b`))), 'a [|word|] b');
  assert.equal(show(clearFormatting(...sel('a [[[|page|]]] b'))), 'a [|page|] b');
  assert.equal(show(clearFormatting(...sel('[|**bold** *it* ~~no~~ <u>u</u> [[Page|name]] [web](https://x.org)|]'))), '[|bold it no u name web|]');
});

test('plainText keeps snake_case and plain stars', () => {
  assert.equal(plainText('snake_case_name and 2 * 3 * 4'), 'snake_case_name and 2 * 3 * 4');
});

test('markColor reads the background of a mark tag', () => {
  assert.equal(markColor('<mark style="background: #FFF3A3A6;">'), '#fff3a3a6');
  assert.equal(markColor('<mark style="background:#9BF59B">'), '#9bf59b');
  assert.equal(markColor('<mark>'), '');
});

/* ---------- the Editing group on the ribbon ---------- */

test('the Editing group is in the default layout and is added once to an older saved layout', async () => {
  const { defaultLayout, addEditingGroup } = await import('../../src/ribbon/defaults.js');
  const commands = ['onenote-style:toggle-syntax-visibility', 'onenote-style:toggle-syntax-guard', 'onenote-style:toggle-quick-bar'];
  const fresh = defaultLayout();
  const home = fresh.tabs.find((t) => t.id === 'home');
  assert.deepEqual(home.groups.find((g) => g.id === 'home-editing').items.map((i) => i.command), commands);
  assert.equal(addEditingGroup(fresh), false, 'nothing to add to the default layout');

  // a layout saved before the group existed
  const old = defaultLayout();
  const oldHome = old.tabs.find((t) => t.id === 'home');
  oldHome.groups = oldHome.groups.filter((g) => g.id !== 'home-editing');
  assert.equal(addEditingGroup(old), true);
  const names = old.tabs.find((t) => t.id === 'home').groups.map((g) => g.id);
  assert.equal(names[names.indexOf('home-pages') + 1], 'home-editing', 'right after Pages');
  const cmds = (l) => l.tabs.map((t) => t.groups.map((g) => g.items.map((i) => i.command)));
  assert.deepEqual(cmds(old), cmds(fresh));
  assert.equal(addEditingGroup(old), false, 'not twice');

  // no Home tab: the first visible tab gets it, at the end
  const custom = { tabs: [{ id: 'mine', name: 'Mine', groups: [{ id: 'g1', name: 'One', items: [{ command: 'editor:toggle-bold' }] }] }] };
  assert.equal(addEditingGroup(custom), true);
  assert.deepEqual(custom.tabs[0].groups.at(-1).items.map((i) => i.command), commands);
  // a layout that already uses one of the commands is left alone
  const has = { tabs: [{ id: 'mine', name: 'Mine', groups: [{ id: 'g1', name: 'One', items: [{ command: commands[2] }] }] }] };
  assert.equal(addEditingGroup(has), false);
});
