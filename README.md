# OneNote Style for Obsidian

An Obsidian plugin that makes Obsidian look and work like Microsoft OneNote.

## What you get

| OneNote | In Obsidian |
|---|---|
| Notebooks pane | **Notebooks** view in the left sidebar: every top-level folder is a notebook, its folders are sections (nested folders work like section groups). |
| Section tabs | Colored tabs above the page, plus a notebook switcher. Click **+** for a new section. Right-click a tab to rename it, change its color or delete it. |
| Page list | **Pages** view (right sidebar like OneNote 2016, or left like newer OneNote). **Add Page**, drag and drop to reorder, subpages (two levels), drag a page onto a section to move it. |
| Page title | Big title with a thin underline and the page's date and time under it. |
| Note tags | To Do, Important ⭐, Question, Remember for later (yellow highlight), Definition (green highlight), Idea 💡, with a **Tags Summary** that lists every tagged line in the section, notebook or vault. |

Your notes stay plain Markdown. Tags are stored as task statuses (`- [!] Call the bank`, `- [?] Who owns this?`), which other Obsidian tools can read too. Page order, subpage levels and section colors are kept in the plugin's own `data.json`.

## The ribbon

An Office-style ribbon sits above the workspace: **tabs → groups → buttons**, with Undo/Redo and a search box in the tab row. It is a framework, not a fixed toolbar: every button runs an Obsidian command, so any command of Obsidian or of any installed plugin can be a button.

**Buttons.** Each button is **large** (icon above label) or **small** (icon and label, stacked three high). A button whose plugin is missing or turned off stays in place, greyed out, with a tooltip that says why.

**Customising, on the ribbon itself.**

| Right-click | You can |
|---|---|
| a button | rename it, change its icon or icon colour, make it large or small, move it left or right, move it to another group, remove it |
| a group (its label) | add a command (searchable, like the command palette), rename, move left or right, choose when it shrinks, add a group, delete |
| a tab or an empty area | add, rename, hide, show, move or delete tabs, add a group, export or import the layout, reset to default |

Drag a button to move it, also into another group or (hover over a tab) onto another tab. For bigger changes choose **Customise with drag and drop** from the right-click menu: tabs and groups can then be dragged too, **+** tiles add tabs, groups and buttons, and a click on a button opens its menu. **Done** or Esc ends it.

**It adapts to the window, like Office.** There is never a horizontal scroll bar. When space runs out the groups shrink step by step: large → small → icon-only → the group becomes one drop-down button → what still doesn't fit goes into **More** at the right end. Per group you choose **Shrink first / normally / last**. Tabs that don't fit move into a drop-down as well.

**Look.** The ribbon uses Obsidian's theme variables, so it follows light and dark mode and any theme. Icon colours come from the theme's palette and are adjusted per mode to stay readable; product logos keep their brand colour.

**Layout file.** *Export layout* writes one JSON file (`Ribbon layout <date>.json`) to the vault's top folder; *Import layout* reads such a file. An import or reset can be undone once with the command **Ribbon: undo last import or reset**. The plugin's settings page has the same export, import and reset buttons as a backup.

### Default tabs

Home, Insert, View (with zoom), Table, Navigate, Templates, Canvas, References, Review, Data, Slides, Utilities. They use commands of Obsidian and its core plugins, this plugin's own commands, and, where installed, AI ChatBridge, Editing Toolbar, Excalidraw, Tasks, Omnisearch and Notebook Navigator. Buttons of plugins you don't have are greyed out; remove them or leave them.

Also in the default layout: the six OneNote **note tags** and **Find Tags**, **New Page / Subpage**, **AI** (AI ChatBridge: Sync All, Stop All, one button per service), **Appearance** (light / dark), table grid picker, date and time stamps, symbols, page colour, rule lines and page width.

## Install

1. Copy `manifest.json`, `main.js` and `styles.css` into
   `<your vault>/.obsidian/plugins/onenote-style/` (create the folders if needed).
2. In Obsidian: **Settings → Community plugins** → turn off Restricted mode if needed → enable **OneNote Style**.
3. For the page date under the title, keep **Settings → Appearance → Show inline title** on.

On first start the plugin opens the Notebooks and Pages panes. If you close them, use the book icon in Obsidian's left ribbon or the **OneNote Style: Show notebooks and pages panes** command.

### Using an existing vault

* **Top-level folders are notebooks** (default): `Work/Meetings/Standup.md` is the page *Standup* in section *Meetings* of notebook *Work*. Notes sitting directly in a notebook folder show up as an **Unfiled** section.
* **The vault is one notebook**: switch this in the plugin settings if your vault is one big collection of folders.
* Use **Excluded folders** in settings to hide folders such as `Attachments` or `Templates`.

## Keyboard shortcuts

These match OneNote's. You can change any of them in **Settings → Hotkeys** (search for "OneNote Style").

| Keys | Action |
|---|---|
| Ctrl+1 … Ctrl+6 | To Do, Important, Question, Remember for later, Definition, Idea tag (press again to remove) |
| Ctrl+Alt+1 … 6 | Heading 1 … 6 |
| Ctrl+Shift+N | Normal style (removes heading) |
| Ctrl+U | Underline |
| Ctrl+Alt+H | Highlight |
| Ctrl+. | Bulleted list |
| Alt+Shift+D / T / F | Insert date / time / date and time |
| Ctrl+Shift+Alt+N | New subpage |
| Ctrl+Alt+] / Ctrl+Alt+[ | Make subpage / promote subpage |
| Alt+PageDown / Alt+PageUp | Next / previous page |
| Ctrl+F1 | Collapse or expand the ribbon (or double-click a tab) |

**New page**, **New section**, **New notebook** and **Full page view** have no default key because OneNote's keys for them (Ctrl+N, Ctrl+T, F11) are already used by Obsidian. Assign them in **Settings → Hotkeys** if you want OneNote's behavior.

If Ctrl+1 … Ctrl+6 switch tabs instead of tagging, your Obsidian version binds them to "Go to tab". Remove those bindings in **Settings → Hotkeys** (search "tab #").

## What it can't do

OneNote's free-form canvas, where you click anywhere to type, isn't possible in Markdown notes. For that kind of page, use **Insert → Free-form Page**, which creates an Obsidian Canvas page in the current section. Ink drawing, audio recording and OneNote file import aren't included.

The plugin is desktop-only for now. The ribbon itself avoids Node and Electron APIs so that mobile can follow.

## Privacy

No network calls, no telemetry. The plugin reads and writes only its own `data.json`, the notes you edit with it, and the layout file you export.

## Theme

For the same look without the ribbon and panes, see the [OneNote Style theme](https://github.com/Sundowna/obsidian-onenote-theme).

## For developers

```
src/main.js              the plugin (notebooks, pages, tags, commands, settings)
src/ribbon/model.js      ribbon layout: tabs, groups, buttons (pure, unit-tested)
src/ribbon/collapse.js   adaptive sizing decisions (pure, unit-tested)
src/ribbon/defaults.js   the default layout
src/ribbon/view.js       drawing, menus, drag and drop, drop-downs
src/ribbon/modals.js     command picker and icon picker
src/ribbon/internal.js   the only file that uses Obsidian internals, with the reason for each
```

`main.js` in the repository root is built from `src/`; edit the sources, not that file.

| Command | Does |
|---|---|
| `npm install` | installs the build and test tools |
| `npm run build` | bundles `src/` into `main.js` |
| `npm test` | unit tests for the layout model and the collapse logic |
| `npm run test:e2e` | end-to-end tests in a sandboxed Obsidian (downloaded once into `.obsidian-cache`) |

The end-to-end tests never open a real vault. `test/e2e/prepare-vault.mjs` builds a throw-away vault from fixture notes plus the configuration (theme, snippets, a few offline plugins) of the vault named in `RIBBON_TEST_VAULT`. Screenshots land in `test/e2e/out/shots`.

## License

[MIT](LICENSE).

OneNote is a trademark of Microsoft. Claude, ChatGPT, Codex and Lumo are trademarks of their owners, and their logos are used only to label the sync buttons. This plugin isn't made by or affiliated with any of them.
