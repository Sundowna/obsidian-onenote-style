/*
 * The default ribbon layout. Pure data, editable by the user afterwards.
 *
 * Every button is just a command id. Buttons whose plugin is not installed show greyed
 * out, so the layout can safely name commands of optional plugins.
 *
 *   own:        this plugin's commands (onenote-style:*)
 *   core:       Obsidian and its core plugins
 *   community:  AI ChatBridge, Editing Toolbar, Excalidraw, Tasks, Omnisearch,
 *               Notebook Navigator
 */

import { normalizeLayout } from './model.js';

const O = 'onenote-style:';
// The optional fourth value is the icon colour. Large icons use the accent colour by
// themselves; colours are set where they help to recognise a button at a glance.
const L = (command, label, icon, color) => ({ command, label, icon, size: 'large', color });
const S = (command, label, icon, color) => ({ command, label, icon, size: 'small', color });
const G = (id, name, items, priority) => ({ id, name, priority: priority || 'normal', items });
const T = (id, name, groups) => ({ id, name, groups });

const TABS = [
  T('home', 'Home', [
    G('home-clipboard', 'Clipboard', [
      L(O + 'paste', 'Paste', 'clipboard-paste'),
      S(O + 'cut', 'Cut', 'scissors'),
      S(O + 'copy', 'Copy', 'copy'),
      S('editor:clear-formatting', 'Clear', 'eraser', 'pink'),
    ], 'last'),
    G('home-text', 'Basic Text', [
      S('editor:toggle-bold', 'Bold', 'bold'),
      S('editor:toggle-italics', 'Italic', 'italic'),
      S(O + 'underline', 'Underline', 'underline'),
      S('editor:toggle-strikethrough', 'Strike', 'strikethrough'),
      S(O + 'highlight-color', 'Highlight', 'highlighter', 'yellow'),
      S(O + 'font-color', 'Font Color', 'baseline', 'red'),
      S(O + 'subscript', 'Subscript', 'subscript'),
      S(O + 'superscript', 'Superscript', 'superscript'),
      S('editor:toggle-code', 'Code', 'code'),
    ], 'last'),
    G('home-paragraph', 'Paragraph', [
      S('editor:toggle-bullet-list', 'Bullets', 'list'),
      S('editor:toggle-numbered-list', 'Numbering', 'list-ordered'),
      S('editor:toggle-checklist-status', 'Checkbox', 'list-checks'),
      S('editor:unindent-list', 'Outdent', 'outdent'),
      S('editor:indent-list', 'Indent', 'indent'),
      S('editor:toggle-blockquote', 'Quote', 'quote'),
    ]),
    G('home-styles', 'Styles', [
      S(O + 'heading-1', 'Heading 1', 'heading-1', 'blue'),
      S(O + 'heading-2', 'Heading 2', 'heading-2', 'blue'),
      S(O + 'heading-3', 'Heading 3', 'heading-3', 'blue'),
      S(O + 'heading-4', 'Heading 4', 'heading-4', 'blue'),
      S(O + 'normal', 'Normal', 'pilcrow'),
    ]),
    G('home-tags', 'Tags', [
      L(O + 'tag-todo', 'To Do', 'check-square', 'blue'),
      S(O + 'tag-important', 'Important', 'star', 'yellow'),
      S(O + 'tag-question', 'Question', 'help-circle', 'purple'),
      S(O + 'tag-remember', 'Remember', 'bookmark', 'orange'),
      S(O + 'tag-definition', 'Definition', 'book-open', 'green'),
      S(O + 'tag-idea', 'Idea', 'lightbulb', 'yellow'),
      S(O + 'find-tags', 'Find Tags', 'search-check'),
    ]),
    G('home-pages', 'Pages', [
      L(O + 'new-page', 'New Page', 'file-plus'),
      S(O + 'new-subpage', 'New Subpage', 'corner-down-right'),
      S(O + 'make-subpage', 'Make Subpage', 'indent'),
      S(O + 'promote-subpage', 'Promote', 'outdent'),
    ]),
    G('home-ai', 'AI', [
      L('ai-chatbridge:sync-all-chats', 'Sync All', 'refresh-cw'),
      L('ai-chatbridge:stop-sync', 'Stop All', 'square', 'red'),
      S('ai-chatbridge:sync-claude-chats', 'Claude', 'onenote-ai-claude', 'orange'),
      S('ai-chatbridge:sync-chatgpt-chats', 'ChatGPT', 'onenote-ai-openai', 'green'),
      S('ai-chatbridge:sync-gemini-chats', 'Gemini', 'sparkles', 'blue'),
      S('ai-chatbridge:sync-lumo-chats', 'Lumo', 'onenote-ai-lumo', 'purple'),
      S('ai-chatbridge:sync-desktop-app-chats', 'Desktop Apps', 'monitor'),
      S('ai-chatbridge:sync-hermes-chats', 'Hermes', 'bot'),
    ], 'first'),
    G('home-appearance', 'Appearance', [
      L('theme:toggle-light-dark', 'Light / Dark', 'sun-moon'),
      S(O + 'use-light-mode', 'Light', 'sun', 'yellow'),
      S(O + 'use-dark-mode', 'Dark', 'moon', 'blue'),
      S('theme:switch', 'Theme', 'palette', 'purple'),
    ], 'first'),
  ]),

  T('insert', 'Insert', [
    G('insert-tables', 'Tables', [
      L(O + 'insert-table-grid', 'Table', 'table'),
    ]),
    G('insert-files', 'Files', [
      L('editor:attach-file', 'Attachment', 'paperclip'),
      S('editor:insert-embed', 'Embed Page', 'file-input'),
      S('insert-template', 'Template', 'layout-template'),
      S('obsidian-excalidraw-plugin:excalidraw-autocreate-and-embed', 'Drawing', 'pencil-ruler'),
    ]),
    G('insert-links', 'Links', [
      L('editor:insert-link', 'Link', 'link'),
      S('editor:insert-wikilink', 'Page Link', 'file-symlink'),
      S('editor:insert-tag', 'Tag', 'tag', 'cyan'),
      S('editor:insert-footnote', 'Footnote', 'file-signature'),
    ]),
    G('insert-stamp', 'Time Stamp', [
      S(O + 'insert-date', 'Date', 'calendar', 'blue'),
      S(O + 'insert-time', 'Time', 'clock', 'blue'),
      S(O + 'insert-datetime', 'Date & Time', 'calendar-clock', 'blue'),
    ]),
    G('insert-blocks', 'Blocks', [
      S('editor:insert-callout', 'Callout', 'message-square', 'cyan'),
      S('editor:insert-codeblock', 'Code Block', 'code-2'),
      S('editor:insert-horizontal-rule', 'Divider', 'minus'),
      S('editor:toggle-blockquote', 'Quote', 'quote'),
      S('editor:insert-mathblock', 'Equation', 'sigma', 'purple'),
      S('editor:toggle-inline-math', 'Inline Math', 'square-function'),
    ]),
    G('insert-symbols', 'Symbols', [
      L(O + 'insert-symbol', 'Symbol', 'omega'),
    ]),
    G('insert-pages', 'Pages', [
      L(O + 'new-canvas-page', 'Canvas Page', 'layout-dashboard'),
      S('bases:insert', 'Base', 'layout-list'),
      S(O + 'new-page', 'New Page', 'file-plus'),
    ]),
  ]),

  T('view', 'View', [
    G('view-views', 'Views', [
      L('markdown:toggle-preview', 'Read / Edit', 'book-open'),
      L(O + 'full-page-view', 'Full Page', 'maximize-2'),
      S('editor:toggle-source', 'Source Mode', 'code-2'),
      S('editor:toggle-readable-line-length', 'Line Width', 'ruler'),
      S('editor:toggle-line-numbers', 'Line Numbers', 'list-ordered'),
    ]),
    G('view-zoom', 'Zoom', [
      L('window:zoom-in', 'Zoom In', 'zoom-in'),
      L('window:zoom-out', 'Zoom Out', 'zoom-out'),
      L('window:reset-zoom', '100%', 'scan'),
    ], 'last'),
    G('view-page', 'Page Setup', [
      S(O + 'page-color', 'Page Color', 'paint-bucket', 'orange'),
      S(O + 'rule-lines', 'Rule Lines', 'align-justify'),
      S(O + 'page-width', 'Page Width', 'move-horizontal'),
    ]),
    G('view-panes', 'Show', [
      S('app:toggle-left-sidebar', 'Left Sidebar', 'panel-left'),
      S('app:toggle-right-sidebar', 'Right Sidebar', 'panel-right'),
      S(O + 'toggle-section-tabs', 'Section Tabs', 'folder-kanban'),
      S('outline:open', 'Outline', 'list-tree'),
      S('properties:open-local', 'Properties', 'info'),
      S('app:toggle-ribbon', 'Icon Strip', 'panel-left-dashed'),
    ]),
    G('view-window', 'Window', [
      S('workspace:split-vertical', 'Split Right', 'separator-vertical'),
      S('workspace:split-horizontal', 'Split Down', 'separator-horizontal'),
      S('workspace:open-in-new-window', 'New Window', 'app-window'),
      S('workspace:toggle-stacked-tabs', 'Stacked Tabs', 'layers'),
      S('workspace:toggle-pin', 'Pin Tab', 'pin'),
      S('window:toggle-always-on-top', 'Always on Top', 'arrow-up-to-line'),
    ]),
    G('view-folding', 'Folding', [
      S('editor:fold-all', 'Fold All', 'chevrons-down-up'),
      S('editor:unfold-all', 'Unfold All', 'chevrons-up-down'),
      S('editor:toggle-fold', 'Fold Line', 'fold-vertical'),
    ], 'first'),
  ]),

  T('table', 'Table', [
    G('table-insert', 'Table', [
      L('editor:insert-table', 'Insert Table', 'table'),
      L(O + 'insert-table-grid', 'Table Grid', 'layout-grid'),
    ]),
    G('table-rows', 'Rows', [
      S('editor:table-row-before', 'Add Above', 'arrow-up-to-line', 'green'),
      S('editor:table-row-after', 'Add Below', 'arrow-down-to-line', 'green'),
      S('editor:table-row-delete', 'Delete Row', 'trash-2', 'red'),
      S('editor:table-row-up', 'Move Up', 'arrow-up'),
      S('editor:table-row-down', 'Move Down', 'arrow-down'),
      S('editor:table-row-copy', 'Duplicate', 'copy'),
    ]),
    G('table-columns', 'Columns', [
      S('editor:table-col-before', 'Add Left', 'arrow-left-to-line', 'green'),
      S('editor:table-col-after', 'Add Right', 'arrow-right-to-line', 'green'),
      S('editor:table-col-delete', 'Delete Column', 'trash-2', 'red'),
      S('editor:table-col-left', 'Move Left', 'arrow-left'),
      S('editor:table-col-right', 'Move Right', 'arrow-right'),
      S('editor:table-col-copy', 'Duplicate', 'copy'),
    ]),
    G('table-align', 'Alignment', [
      S('editor:table-col-align-left', 'Left', 'align-left'),
      S('editor:table-col-align-center', 'Center', 'align-center'),
      S('editor:table-col-align-right', 'Right', 'align-right'),
    ]),
    G('table-convert', 'Convert', [
      S('editing-toolbar:list-to-table', 'List to Table', 'table-properties'),
      S('editing-toolbar:table-to-list', 'Table to List', 'list'),
    ], 'first'),
  ]),

  T('navigate', 'Navigate', [
    G('nav-history', 'History', [
      L('app:go-back', 'Back', 'arrow-left'),
      L('app:go-forward', 'Forward', 'arrow-right'),
    ], 'last'),
    G('nav-find', 'Find', [
      L('switcher:open', 'Quick Switcher', 'navigation'),
      S('global-search:open', 'Search Vault', 'search'),
      S('omnisearch:show-modal', 'Omnisearch', 'scan-search'),
      S('editor:open-search', 'Find in Page', 'text-search'),
    ]),
    G('nav-pages', 'Pages', [
      S(O + 'prev-page', 'Previous Page', 'chevron-up'),
      S(O + 'next-page', 'Next Page', 'chevron-down'),
      S('file-explorer:reveal-active-file', 'Show in List', 'locate'),
      S(O + 'prev-section', 'Previous Section', 'chevrons-up'),
      S(O + 'next-section', 'Next Section', 'chevrons-down'),
      S('notebook-navigator:open', 'Navigator', 'compass'),
    ]),
    G('nav-tabs', 'Tabs', [
      S('workspace:previous-tab', 'Previous Tab', 'arrow-left'),
      S('workspace:next-tab', 'Next Tab', 'arrow-right'),
      S('workspace:new-tab', 'New Tab', 'plus', 'green'),
      S('workspace:close', 'Close Tab', 'x', 'red'),
      S('workspace:undo-close-pane', 'Reopen Tab', 'undo-2'),
      S('workspace:close-others', 'Close Others', 'copy-x'),
    ]),
    G('nav-daily', 'Daily Notes', [
      L('daily-notes', 'Today', 'calendar-days'),
      S('daily-notes:goto-prev', 'Previous Day', 'calendar-minus'),
      S('daily-notes:goto-next', 'Next Day', 'calendar-plus'),
    ]),
    G('nav-links', 'Links', [
      S('editor:follow-link', 'Follow Link', 'link'),
      S('editor:open-link-in-new-split', 'Open to the Right', 'columns-2'),
      S('bookmarks:open', 'Bookmarks', 'bookmark', 'orange'),
    ], 'first'),
  ]),

  T('templates', 'Templates', [
    G('tpl-templates', 'Templates', [
      L('insert-template', 'Insert Template', 'layout-template'),
      S('insert-current-date', 'Insert Date', 'calendar-days'),
      S('insert-current-time', 'Insert Time', 'clock'),
      S('notebook-navigator:new-note-from-template', 'Note from Template', 'file-plus-2'),
    ]),
    G('tpl-new', 'New', [
      L(O + 'new-page', 'New Page', 'file-plus'),
      S('file-explorer:new-file', 'New Note', 'file'),
      S(O + 'new-section', 'New Section', 'folder-plus'),
      S(O + 'new-notebook', 'New Notebook', 'book-plus'),
    ]),
    G('tpl-properties', 'Properties', [
      S('markdown:add-metadata-property', 'Add Property', 'plus-circle'),
      S('markdown:add-alias', 'Add Alias', 'forward'),
      S('properties:open-local', 'File Properties', 'info'),
    ]),
  ]),

  T('canvas', 'Canvas', [
    G('canvas-canvas', 'Canvas', [
      L('canvas:new-file', 'New Canvas', 'layout-dashboard'),
      S(O + 'new-canvas-page', 'Canvas Page', 'file-plus'),
      S('canvas:jump-to-group', 'Jump to Group', 'move'),
      S('canvas:convert-to-file', 'Convert to File', 'file-input'),
      S('canvas:export-as-image', 'Export Image', 'image'),
    ]),
    G('canvas-excalidraw', 'Excalidraw', [
      L('obsidian-excalidraw-plugin:excalidraw-autocreate', 'New Drawing', 'pencil-ruler'),
      S('obsidian-excalidraw-plugin:excalidraw-autocreate-and-embed', 'Embed Drawing', 'image-plus'),
      S('obsidian-excalidraw-plugin:excalidraw-open', 'Open Drawing', 'folder-open'),
      S('obsidian-excalidraw-plugin:toggle-excalidraw-view', 'Drawing / Text', 'repeat'),
    ]),
    G('canvas-graph', 'Graph', [
      L('graph:open', 'Graph View', 'git-fork'),
      S('graph:open-local', 'Local Graph', 'git-branch'),
    ]),
  ]),

  T('references', 'References', [
    G('ref-links', 'Links', [
      L('editor:insert-link', 'Link', 'link'),
      S('editor:insert-wikilink', 'Page Link', 'file-symlink'),
      S('editor:insert-embed', 'Embed', 'file-input'),
      S('editor:insert-footnote', 'Footnote', 'file-signature'),
    ]),
    G('ref-backlinks', 'Linked Pages', [
      L('backlink:open-backlinks', 'Backlinks', 'links-coming-in'),
      S('outgoing-links:open-for-current', 'Outgoing Links', 'links-going-out'),
      S('backlink:toggle-backlinks-in-document', 'Show in Page', 'file-text'),
      S('graph:open-local', 'Local Graph', 'git-branch'),
    ]),
    G('ref-tags', 'Tags', [
      S('editor:insert-tag', 'Add Tag', 'tag', 'cyan'),
      S('tag-pane:open', 'All Tags', 'tags'),
    ]),
    G('ref-bookmarks', 'Bookmarks', [
      S('bookmarks:bookmark-current-view', 'Bookmark', 'bookmark-plus', 'orange'),
      S('bookmarks:bookmark-current-heading', 'Bookmark Heading', 'heading'),
      S('bookmarks:open', 'All Bookmarks', 'bookmark', 'orange'),
    ]),
    G('ref-copy', 'Copy', [
      S('workspace:copy-path', 'Copy Path', 'copy'),
      S('workspace:copy-url', 'Copy Link', 'link-2'),
    ], 'first'),
  ]),

  T('review', 'Review', [
    G('review-proofing', 'Proofing', [
      L('editor:toggle-spellcheck', 'Spelling', 'spell-check'),
    ]),
    G('review-find', 'Find', [
      S('editor:open-search', 'Find', 'search'),
      S('editor:open-search-replace', 'Replace', 'replace'),
      S('global-search:open', 'Search Vault', 'folder-search'),
    ]),
    G('review-comments', 'Comments', [
      L('editor:toggle-comments', 'Comment', 'message-square-dashed'),
    ]),
    G('review-tasks', 'Tags and Tasks', [
      L(O + 'find-tags', 'Tags Summary', 'search-check'),
      S('obsidian-tasks-plugin:toggle-done', 'Toggle Done', 'check-circle', 'green'),
      S('obsidian-tasks-plugin:edit-task', 'Edit Task', 'pencil'),
      S(O + 'remove-tags', 'Remove Tags', 'eraser', 'pink'),
    ]),
    G('review-cleanup', 'Clean Up', [
      S('editing-toolbar:remove-whitespace-trim', 'Trim Line Ends', 'align-left'),
      S('editing-toolbar:remove-blank-lines', 'Remove Blank Lines', 'fold-vertical'),
      S('editing-toolbar:dedupe-lines', 'Remove Duplicates', 'list-x'),
    ], 'first'),
    G('review-history', 'History', [
      L('file-recovery:open', 'Local History', 'history'),
      S('workspace:show-trash', 'Deleted Files', 'trash-2', 'red'),
      S('workspace:undo-close-pane', 'Reopen Tab', 'undo-2'),
    ]),
  ]),

  T('data', 'Data', [
    G('data-bases', 'Bases', [
      L('bases:new-file', 'New Base', 'layout-list'),
      S('bases:insert', 'Insert Base', 'between-horizontal-start'),
      S('bases:add-view', 'Add View', 'shapes'),
      S('bases:add-item', 'Add Item', 'plus'),
      S('bases:change-view', 'Change View', 'arrow-left-right'),
      S('bases:copy-table', 'Copy Table', 'copy'),
    ]),
    G('data-properties', 'Properties', [
      L('properties:open-local', 'File Properties', 'info'),
      S('markdown:add-metadata-property', 'Add Property', 'plus-circle'),
      S('properties:open', 'All Properties', 'archive'),
      S('markdown:add-alias', 'Add Alias', 'forward'),
    ]),
    G('data-tasks', 'Tasks', [
      S('obsidian-tasks-plugin:edit-task', 'Create / Edit Task', 'pencil'),
      S('obsidian-tasks-plugin:toggle-done', 'Toggle Done', 'check-circle', 'green'),
      S(O + 'find-tags', 'Tags Summary', 'search-check'),
    ]),
    G('data-convert', 'Convert', [
      S('editing-toolbar:list-to-table', 'List to Table', 'table-properties'),
      S('editing-toolbar:table-to-list', 'Table to List', 'list'),
    ], 'first'),
  ]),

  T('slides', 'Slides', [
    G('slides-show', 'Slide Show', [
      L('slides:start', 'Start Presentation', 'presentation'),
    ]),
    G('slides-edit', 'Slides', [
      S('editor:insert-horizontal-rule', 'Slide Break', 'minus'),
      S('markdown:toggle-preview', 'Read / Edit', 'book-open'),
      S(O + 'full-page-view', 'Full Page', 'maximize-2'),
    ]),
    G('slides-export', 'Export', [
      L('workspace:export-pdf', 'Export to PDF', 'file-down'),
    ]),
  ]),

  T('utilities', 'Utilities', [
    G('util-obsidian', 'Obsidian', [
      L('app:open-settings', 'Settings', 'settings'),
      L('command-palette:open', 'Command Palette', 'terminal-square'),
      S(O + 'open-community-plugins', 'Plugins', 'puzzle'),
      S(O + 'open-ai-chatbridge-settings', 'ChatBridge', 'message-square-text'),
      S('app:open-help', 'Help', 'help-circle'),
    ], 'last'),
    G('util-file', 'File', [
      S('workspace:edit-file-title', 'Rename', 'pencil'),
      S('file-explorer:move-file', 'Move', 'folder-input'),
      S('file-explorer:duplicate-file', 'Duplicate', 'files'),
      S('workspace:export-pdf', 'Export PDF', 'file-down'),
      S('open-with-default-app:show', 'Show in Explorer', 'folder-open'),
      S('open-with-default-app:open', 'Open in App', 'arrow-up-right'),
    ]),
    G('util-text', 'Text Tools', [
      S('editing-toolbar:merge-lines', 'Merge Lines', 'fold-vertical'),
      S('editing-toolbar:split-lines', 'Split Lines', 'unfold-vertical'),
      S('editing-toolbar:number-lines', 'Number Lines', 'list-ordered'),
      S('editing-toolbar:get-plain-text', 'Plain Text', 'type'),
      S('editing-toolbar:toggle-format-brush', 'Format Brush', 'paintbrush'),
      S('editing-toolbar:toggle-top-toolbar', 'Editing Toolbar', 'panel-top'),
    ]),
    G('util-ribbon', 'Ribbon', [
      S(O + 'ribbon-export', 'Export Layout', 'download'),
      S(O + 'ribbon-import', 'Import Layout', 'upload'),
      S(O + 'ribbon-reset', 'Reset Ribbon', 'rotate-ccw', 'red'),
    ], 'first'),
  ]),
];

export function defaultLayout() {
  return normalizeLayout({ tabs: JSON.parse(JSON.stringify(TABS)) });
}
