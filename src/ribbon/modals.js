/*
 * Pickers used when customising the ribbon: a command picker that works like the
 * command palette, and an icon picker. Official Obsidian API only.
 */

import { FuzzySuggestModal, getIconIds, setIcon } from 'obsidian';
import { listCommands } from './internal.js';

/** Searchable list of every command of Obsidian and all enabled plugins. */
export class CommandPickerModal extends FuzzySuggestModal {
  constructor(app, onChoose) {
    super(app);
    this.onChoose = onChoose;
    this.modalEl.addClass('onr-picker');
    this.setPlaceholder('Add a command to the ribbon: type to search...');
    this.setInstructions([
      { command: '↑↓', purpose: 'to move' },
      { command: '↵', purpose: 'to add' },
      { command: 'esc', purpose: 'to cancel' },
    ]);
  }

  getItems() {
    return listCommands(this.app).slice().sort((a, b) => a.name.localeCompare(b.name));
  }

  getItemText(cmd) {
    return cmd.name;
  }

  renderSuggestion(match, el) {
    super.renderSuggestion(match, el);
    el.addClass('onr-picker-item');
    el.createSpan({ cls: 'onr-picker-id', text: match.item.id });
  }

  onChooseItem(cmd) {
    this.onChoose(cmd);
  }
}

/** Searchable list of every icon Obsidian knows (Lucide plus icons added by plugins). */
export class IconPickerModal extends FuzzySuggestModal {
  constructor(app, onChoose) {
    super(app);
    this.onChoose = onChoose;
    this.limit = 120;
    this.modalEl.addClass('onr-picker', 'onr-icon-picker');
    this.setPlaceholder('Choose an icon: type to search (for example "star", "file", "arrow")...');
  }

  getItems() {
    return getIconIds().map((id) => id.replace(/^lucide-/, '')).sort();
  }

  getItemText(id) {
    return id.replace(/-/g, ' ');
  }

  renderSuggestion(match, el) {
    el.addClass('onr-picker-item', 'onr-icon-item');
    setIcon(el.createSpan('onr-icon-item-icon'), match.item);
    el.createSpan({ text: match.item });
  }

  onChooseItem(id) {
    this.onChoose(id);
  }
}
