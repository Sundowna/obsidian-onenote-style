/*
 * The outline Windows draws where a dragged window will snap, for strip drags.
 *
 * A strip drag (view.js) moves the window itself, so Windows doesn't show its own snap
 * outline. This draws one: a see-through, click-through window without a frame, behind the
 * dragged window, covering the half, quarter or whole screen the window would snap to.
 * The window is made on first use and kept hidden between drags.
 */

const INSET = 6; // Windows draws the outline a little inside the area it will fill

const TITLE = 'onenote-style-snap-preview';

const HTML = `<!doctype html><html><head><meta charset="utf-8"><title>${TITLE}</title><style>
html, body { margin: 0; height: 100%; background: transparent; overflow: hidden; }
.box { position: absolute; inset: ${INSET}px; border-radius: 8px;
  background: rgba(150, 150, 150, 0.28); border: 1px solid rgba(255, 255, 255, 0.55);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.18), 0 8px 24px rgba(0, 0, 0, 0.25); }
</style></head><body><div class="box"></div></body></html>`;

export class SnapPreview {
  /** remote: Electron's remote module (with BrowserWindow), from the dragged window's renderer. */
  constructor(remote) {
    this.remote = remote;
    this.win = null;
    this.shown = null; // the bounds the outline is shown at, or null
  }

  ensure() {
    if (this.win && !this.win.isDestroyed()) return this.win;
    const { BrowserWindow } = this.remote;
    this.win = new BrowserWindow({
      show: false, frame: false, transparent: true, backgroundColor: '#00000000',
      resizable: false, movable: false, minimizable: false, maximizable: false, fullscreenable: false,
      focusable: false, skipTaskbar: true, hasShadow: false, thickFrame: false,
      title: TITLE,
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
    });
    this.win.setIgnoreMouseEvents(true);
    this.win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(HTML));
    return this.win;
  }

  /** Shows the outline over `bounds` ({ x, y, width, height }), just behind `under`. */
  show(bounds, under) {
    const same = this.shown && ['x', 'y', 'width', 'height'].every((k) => this.shown[k] === bounds[k]);
    if (same) return;
    const win = this.ensure();
    win.setBounds(bounds);
    if (!this.shown) {
      win.showInactive();
      // Keep the dragged window in front of its outline, like Windows does.
      if (under) under.moveTop();
    }
    this.shown = { ...bounds };
  }

  hide() {
    if (!this.shown) return;
    this.shown = null;
    if (this.win && !this.win.isDestroyed()) this.win.hide();
  }

  destroy() {
    this.shown = null;
    if (this.win && !this.win.isDestroyed()) this.win.destroy();
    this.win = null;
  }
}
