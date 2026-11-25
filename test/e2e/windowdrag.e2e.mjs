// Dragging the window by the folded ribbon's tab row, with REAL Windows mouse input.
//
// With auto-collapse on and the ribbon folded, the empty part of the tab row opens the
// ribbon on a click, so the plugin moves the window itself on a drag. WebDriver's own
// pointer actions never press a real mouse button, and Windows behaves differently while
// one is held (it refuses to un-maximise the window), so these tests press the real
// button through user32 (they move the mouse pointer for a few seconds). Windows only.
import { browser, expect } from '@wdio/globals';
import { spawn } from 'node:child_process';
import { openSample, withPlugin, pause } from './helpers.mjs';

const isWin = process.platform === 'win32';

/**
 * A real mouse drag: press at (x, y), move through `path` ([[x, y], ...]) in small steps,
 * hold `holdMs`, release. `whileHeld` runs (in the test) while the button is still down
 * at the end of the path.
 */
async function realDrag(x, y, path, { holdMs = 1200, whileHeld } = {}) {
  const moves = path.map(([px, py]) => `[M]::SetCursorPos(${px},${py}); Start-Sleep -Milliseconds 25`).join('\n');
  const ps = `
Add-Type @"
using System; using System.Runtime.InteropServices;
public static class M { [DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y);
[DllImport("user32.dll")] public static extern void mouse_event(uint f,int x,int y,uint d,UIntPtr e); }
"@
[M]::SetCursorPos(${x},${y}); Start-Sleep -Milliseconds 150
[M]::mouse_event(2,0,0,0,[UIntPtr]::Zero); Start-Sleep -Milliseconds 100
${moves}
Write-Output HELD
Start-Sleep -Milliseconds ${holdMs}
[M]::mouse_event(4,0,0,0,[UIntPtr]::Zero)
`;
  const child = spawn('powershell', ['-NoProfile', '-Command', ps]);
  const done = new Promise((res) => child.on('exit', res));
  const held = new Promise((res) => child.stdout.on('data', (d) => { if (String(d).includes('HELD')) res(); }));
  await held;
  await pause(300);
  const seen = whileHeld ? await whileHeld() : null;
  await done;
  await pause(500);
  return seen;
}

/** n points in a straight line from (x0, y0) to (x1, y1). */
const line = (x0, y0, x1, y1, n = 20) => Array.from({ length: n }, (_, i) => [Math.round(x0 + ((x1 - x0) * (i + 1)) / n), Math.round(y0 + ((y1 - y0) * (i + 1)) / n)]);

const win = () => browser.execute(() => {
  const { remote } = window.electron;
  const w = remote.getCurrentWindow();
  const b = w.getBounds();
  const d = remote.screen.getDisplayNearestPoint({ x: b.x + 100, y: b.y + 20 });
  const preview = remote.BrowserWindow.getAllWindows().find((x) => x.getTitle() === 'onenote-style-snap-preview');
  return {
    bounds: b, max: w.isMaximized(), focused: w.isFocused(), screen: d.bounds, work: d.workArea,
    preview: preview ? { visible: preview.isVisible(), bounds: preview.getBounds() } : null,
    pressing: !!app.plugins.plugins['onenote-style'].ribbon.stripPress,
    collapsed: !!document.querySelector('.onenote-topbar.is-ribbon-collapsed'),
  };
});

/** Screen point on the empty part of the tab row, `dx` pixels in from its left end. */
const stripPoint = (dx = 30) => browser.execute((d) => {
  const r = document.querySelector('.onenote-tabrow-spacer').getBoundingClientRect();
  return { x: Math.round(window.screenX + r.left + d), y: Math.round(window.screenY + r.top + r.height / 2) };
}, dx);

const near = (a, b, slack = 2) => ['x', 'y', 'width', 'height'].every((k) => Math.abs(a[k] - b[k]) <= slack);

(isWin ? describe : describe.skip)('window drag by the folded tab row (real mouse)', () => {
  before(async () => {
    await openSample();
  });

  beforeEach(async () => {
    await browser.execute(() => {
      const w = window.electron.remote.getCurrentWindow();
      w.unmaximize();
      w.setBounds({ x: 400, y: 200, width: 1200, height: 800 });
      w.focus();
    });
    await withPlugin((plugin) => plugin.setAutoCollapseRibbon(true));
    await withPlugin((plugin) => { if (!plugin.state.ribbonCollapsed) plugin.toggleRibbon(); });
    await pause(600);
    expect(await browser.$('.onenote-topbar.onr-strip-opens').isExisting()).toBe(true);
  });

  after(async () => {
    await browser.execute(() => {
      const w = window.electron.remote.getCurrentWindow();
      w.unmaximize();
      w.setBounds({ x: 400, y: 200, width: 1200, height: 800 });
    });
    await withPlugin((plugin) => plugin.setAutoCollapseRibbon(false));
    await withPlugin((plugin) => { if (plugin.state.ribbonCollapsed) plugin.toggleRibbon(); });
  });

  it('F-003 a maximised window can be dragged out of full screen; it is restored under the pointer and follows it', async () => {
    await browser.execute(() => window.electron.remote.getCurrentWindow().maximize());
    await pause(800);
    expect((await win()).max).toBe(true);
    const p = await stripPoint(60);
    const end = [p.x + 400, p.y + 300];
    const during = await realDrag(p.x, p.y, line(p.x, p.y, ...end), { whileHeld: win });
    expect(during.max).toBe(false);
    expect(during.pressing).toBe(true);
    const s = await win();
    expect(s.max).toBe(false);
    expect(s.pressing).toBe(false); // the press ended with the real release
    expect(s.collapsed).toBe(true); // a drag is not a click: the ribbon stays folded
    expect(s.focused).toBe(true);
    // Restored to its normal size, with the pointer still on its top row.
    expect({ w: s.bounds.width, h: s.bounds.height }).toEqual({ w: 1200, h: 800 });
    expect(end[0]).toBeGreaterThan(s.bounds.x);
    expect(end[0]).toBeLessThan(s.bounds.x + s.bounds.width);
    expect(Math.abs(end[1] - (s.bounds.y + 16))).toBeLessThanOrEqual(24);
  });

  it('F-004 dragging to the left screen edge shows the snap outline over the left half, and letting go snaps there', async () => {
    const before = await win();
    const p = await stripPoint();
    const midY = before.screen.y + Math.round(before.screen.height / 2);
    const during = await realDrag(p.x, p.y, line(p.x, p.y, before.screen.x, midY), { whileHeld: win });
    const half = { x: before.work.x, y: before.work.y, width: Math.round(before.work.width / 2), height: before.work.height };
    expect(during.preview && during.preview.visible).toBe(true);
    expect({ near: near(during.preview.bounds, half), got: during.preview.bounds }).toEqual({ near: true, got: during.preview.bounds });
    const s = await win();
    expect({ near: near(s.bounds, half), got: s.bounds }).toEqual({ near: true, got: s.bounds });
    expect(s.preview.visible).toBe(false);
    expect(s.focused).toBe(true);
  });

  it('F-004 the outline follows the pointer: top edge shows the whole screen, away from the edges it disappears', async () => {
    const before = await win();
    const p = await stripPoint();
    const topX = before.screen.x + Math.round(before.screen.width / 2);
    const atTop = await realDrag(p.x, p.y, line(p.x, p.y, topX, before.screen.y), {
      holdMs: 1500,
      whileHeld: async () => {
        const top = await win();
        return top;
      },
    });
    expect(atTop.preview && atTop.preview.visible).toBe(true);
    expect({ near: near(atTop.preview.bounds, before.work), got: atTop.preview.bounds }).toEqual({ near: true, got: atTop.preview.bounds });
    let s = await win();
    expect(s.max).toBe(true);
    // From maximised, drag to the middle of the screen: no outline, no snap.
    await browser.execute(() => window.electron.remote.getCurrentWindow().unmaximize());
    await pause(600);
    const q = await stripPoint();
    const mid = [before.screen.x + Math.round(before.screen.width / 2), before.screen.y + Math.round(before.screen.height / 2)];
    const during = await realDrag(q.x, q.y, line(q.x, q.y, ...mid), { whileHeld: win });
    expect(!during.preview || !during.preview.visible).toBe(true);
    s = await win();
    expect(s.max).toBe(false);
    expect({ w: s.bounds.width, h: s.bounds.height }).toEqual({ w: 1200, h: 800 });
  });

  it('F-001 a plain real click on the empty part of the tab row still opens the folded ribbon', async () => {
    const p = await stripPoint();
    await realDrag(p.x, p.y, [], { holdMs: 60 });
    const s = await win();
    expect(s.collapsed).toBe(false);
    expect(s.pressing).toBe(false);
  });
});
