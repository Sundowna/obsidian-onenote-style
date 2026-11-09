# OneNote Style for Obsidian

An Obsidian plugin that makes Obsidian look and work like Microsoft OneNote.

## What you get

| OneNote | In Obsidian |
|---|---|
| Notebooks pane | **Notebooks** view in the left sidebar: every top-level folder is a notebook, its folders are sections (nested folders work like section groups). |
| Section tabs | Colored tabs above the page, plus a notebook switcher. Click **+** for a new section. Right-click a tab to rename it, change its color or delete it. |
| Page list | **Pages** view (right sidebar like OneNote 2016, or left like newer OneNote). **Add Page**, drag and drop to reorder, subpages (two levels), drag a page onto a section to move it. |
| Ribbon | Purple **Home / Insert / View** ribbon with Undo/Redo and a search box. Double-click a tab or press **Ctrl+F1** to collapse it. |
| Home tab | Paste/Cut/Copy, bold, italic, underline, strikethrough, sub/superscript, highlight colors, font colors, clear formatting, bullets, numbering, indent, a **Styles** gallery (Heading 1–4, Quote, Normal), a **Tags** gallery and **Find Tags**, New Page/Subpage. |
| AI group (Home tab) | With the [AI ChatBridge](https://github.com/Sundowna/obsidian-ai-chatbridge) plugin: **Sync All**, plus one button each for Claude, ChatGPT, Lumo, Claude Desktop and Codex. |
| Insert tab | Table grid picker, file/picture, embed page, links, **Date / Time / Date & Time** stamps, callout, code block, divider, equation, symbols, free-form page (Canvas). |
| View tab | Normal / Full Page View, reading mode, **page color**, **rule lines** (narrow, college, standard, wide, grids), page width, zoom, show/hide panes and section tabs. |
| Page title | Big title with a thin underline and the page's date and time under it. |
| Note tags | To Do, Important ⭐, Question, Remember for later (yellow highlight), Definition (green highlight), Idea 💡, with a **Tags Summary** that lists every tagged line in the section, notebook or vault. |

Your notes stay plain Markdown. Tags are stored as task statuses (`- [!] Call the bank`, `- [?] Who owns this?`), which other Obsidian tools can read too. Page order, subpage levels and section colors are kept in the plugin's own `data.json`.

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
| Ctrl+F1 | Collapse or expand the ribbon |

**New page**, **New section**, **New notebook** and **Full page view** have no default key because OneNote's keys for them (Ctrl+N, Ctrl+T, F11) are already used by Obsidian. Assign them in **Settings → Hotkeys** if you want OneNote's behavior.

If Ctrl+1 … Ctrl+6 switch tabs instead of tagging, your Obsidian version binds them to "Go to tab". Remove those bindings in **Settings → Hotkeys** (search "tab #").

## What it can't do

OneNote's free-form canvas, where you click anywhere to type, isn't possible in Markdown notes. For that kind of page, use **Insert → Free-form Page**, which creates an Obsidian Canvas page in the current section. Ink drawing, audio recording and OneNote file import aren't included.

The plugin is desktop-only.

## Theme

For the same look without the ribbon and panes, see the [OneNote Style theme](https://github.com/Sundowna/obsidian-onenote-theme).

## License

[MIT](LICENSE).

OneNote is a trademark of Microsoft. Claude, ChatGPT, Codex and Lumo are trademarks of their owners, and their logos are used only to label the sync buttons. This plugin isn't made by or affiliated with any of them.
