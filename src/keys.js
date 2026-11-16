// Keyboard shortcuts as text, the way each system writes them:
//   Windows and Linux: "Ctrl+Shift+F"
//   macOS:             "⇧⌘F" (symbols, in Apple's order: Control, Option, Shift, Command)
// Pure code; the caller says whether this is a Mac (Platform.isMacOS).

const MAC_SYMBOL = { Ctrl: '⌃', Alt: '⌥', Shift: '⇧', Mod: '⌘' };
const MAC_ORDER = ['Ctrl', 'Alt', 'Shift', 'Mod'];

/**
 * "Mod+Shift+F" as text. "Mod" is Obsidian's name for Ctrl on Windows and Linux and
 * Command on macOS; "Ctrl" is always the Control key.
 */
export function keysText(combo, isMac) {
  const parts = combo.split('+');
  const key = parts.pop();
  if (!isMac) return [...parts.map((m) => (m === 'Mod' ? 'Ctrl' : m)), key].join('+');
  const mods = MAC_ORDER.filter((m) => parts.includes(m)).map((m) => MAC_SYMBOL[m]).join('');
  return mods + key;
}

/** Redo: Ctrl+Y on Windows and Linux, Shift+Command+Z on macOS. */
export const redoKeys = (isMac) => (isMac ? 'Mod+Shift+Z' : 'Mod+Y');

/**
 * Highlight: OneNote's Ctrl+Alt+H. On macOS Command+Option+H is the system's "Hide Others"
 * and never reaches Obsidian, so it is Control+Command+H there, as in OneNote for Mac.
 */
export const highlightModifiers = (isMac) => (isMac ? ['Mod', 'Ctrl'] : ['Mod', 'Alt']);
