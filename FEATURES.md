# Features

What OneNote Style does, one line per feature. Each line names the tests that prove it.
Sessions: read this before changing anything; never delete a line without the user's OK.
Run the proof with `npm test` (unit) and `npm run test:e2e` (real Obsidian).

This ledger was started on 2026-11-25 and so far only covers the tab-row strip. The rest of
the plugin (ribbon tabs and groups, customise mode, note tags, subpages, notebooks, section
tabs, Quick Bar, settings, commands) still has to be inventoried here.

## Tab row and window
- F-001 Auto-collapse on and ribbon folded: a click on the empty part of the tab row opens the ribbon on the tab that was open; with auto-collapse off it does nothing — `ribbon.e2e.mjs: F-001`, `windowdrag.e2e.mjs: F-001`, `titlebar.test.js`
- F-002 Auto-collapse on and ribbon folded: dragging the window by the empty part of the tab row moves it, and letting go at a screen edge snaps it like Windows Snap (left/right edge = half, near a corner = quarter, top edge = maximised); dragging a snapped window away gives back its earlier size — `ribbon.e2e.mjs: F-002`, `titlebar.test.js`
- F-003 Auto-collapse on and ribbon folded: a maximised window can be dragged out of full screen by the empty part of the tab row (real mouse); it is restored to its normal size under the pointer, follows it, and the ribbon stays folded — `windowdrag.e2e.mjs: F-003`
- F-004 While dragging by the folded tab row, a see-through outline shows where the window will snap (half, quarter, or the whole screen at the top edge), like Windows does; it disappears when the pointer leaves the edges and when the window is let go — `windowdrag.e2e.mjs: F-004`

## Removed
