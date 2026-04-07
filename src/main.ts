import { Plugin, WorkspaceLeaf, PluginSettingTab, Setting, App, FuzzySuggestModal, FuzzyMatch, TFolder, Notice, Modal } from 'obsidian';
import { SkillTreeData, CustomTheme } from './interfaces';
import { VIEW_TYPE_SKILLTREE } from './constants';
import { SkillTreeView } from './skilltreeview';
import { Mode } from './types'
import { skillTreeEvents, EVENTS } from './utils/events';
import * as S from './styles';

export function defaultSettings(): SkillTreeSettings {
  return {
    mode: "view",
    nodeRadius: 36,
    maxNodeRadius: 72,
    showBezier: false,
    defaultExp: 10,
    showExpAsFraction: false,
    currentTreeName: 'default',
    trees: { 'default': { name: 'default', nodes: [], edges: [] } },
    defaultFilePath: '',
    style: 'gamified',
    handleRadius: 8,
    modalPositions: {},
    suppressDeleteConfirmation: false,
    showLevelPane: true,
    showExpPane: true,
    levelDisplayMode: 'current',
    expDisplayMode: 'current',
    showStatusBar: true,
    themes: {},
    suppressNodeTypeWarning: false,
  };
}


/**
 * Main plugin class for the Skill Tree Obsidian plugin.
 * Handles settings, view registration and activation.
 */

export default class SkillTreePlugin extends Plugin {
  /** The settings. Will be default if nothing is saved or changed */
  settings: SkillTreeSettings = defaultSettings();

  /** Status bar item showing level and exp */
  statusBarItem: HTMLElement | null = null;

  /**
   * Called when the plugin is loaded. Registers views, commands, and UI elements.
   */
  async onload() {
    await this.loadSettings();

    this.addSettingTab(new SkillTreeSettingTab(this.app, this));

    this.registerView?.(VIEW_TYPE_SKILLTREE, (leaf: WorkspaceLeaf) => new SkillTreeView(leaf, this));

    this.addCommand?.({
      id: 'open-skill-tree',
      name: 'Open Skill Tree',
      callback: () => this.activateView(),
    });

    // this.addCommand?.({
    //   id: 'toggle-edit-mode',
    //   name: 'Skill Tree: Toggle Edit Mode',
    //   checkCallback: (checking) => {
    //     const view = this.getActiveView();
    //     if (view) {
    //       if (!checking) {
    // this.settings.editMode = !this.editMode;
    // this.settings.editMode = this.editMode;
    // this.saveSettings();
    // // Sync edit mode buttons directly
    // // view.syncEditModeButtons(this.editMode);
    // view.requestRender();
    //       }
    //       return true;
    //     }
    //     return false;
    //   },
    // });

    this.addCommand?.({
      id: 'jump-to-node',
      name: 'Skill Tree: Jump to Node',
      checkCallback: (checking) => {
        const view = this.getActiveView();
        if (view) {
          if (!checking) {
            // view.openNodeListPane();
          }
          return true;
        }
        return false;
      },
    });

    this.addCommand?.({
      id: 'open-skill-tree-tree',
      name: 'Skill Tree: Switch to Tree',
      callback: () => {
        const treeNames = Object.keys(this.settings.trees);
        if (treeNames.length === 0) {
          new Notice('No skill trees found');
          return;
        }
        if (treeNames.length === 1) {
          this.settings.currentTreeName = treeNames[0];
          this.saveSettings();
          this.activateView();
          return;
        }
        new TreeSelectModal(this.app, treeNames, (selectedTree) => {
          this.settings.currentTreeName = selectedTree;
          this.saveSettings();
          this.activateView();
        }).open();
      },
    });

    // this.addCommand?.({
    //   id: 'skill-tree-undo',
    //   name: 'Skill Tree: Undo',
    //   checkCallback: (checking) => {
    //     const view = this.getActiveView();
    //     if (view) {
    //       if (!checking) {
    //         view.undo();
    //       }
    //       return true;
    //     }
    //     return false;
    //   },
    // });

    // this.addCommand?.({
    //   id: 'skill-tree-redo',
    //   name: 'Skill Tree: Redo',
    //   checkCallback: (checking) => {
    //     const view = this.getActiveView();
    //     if (view) {
    //       if (!checking) {
    //         view.redo();
    //       }
    //       return true;
    //     }
    //     return false;
    //   },
    // });

    this.addRibbonIcon?.('dice', 'Open Skill Tree', () => this.activateView());

    this.statusBarItem = this.addStatusBarItem();
    this.statusBarItem.setAttribute('style', 'cursor: pointer;');
    this.statusBarItem.onclick = () => this.activateView();
    this.statusBarItem.textContent = 'Skill Tree';
  }

  onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_SKILLTREE);
  }

  async loadSettings() {
    this.settings = Object.assign(defaultSettings(), await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async activateView() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_SKILLTREE);
    const leaf = this.app.workspace.getLeaf(true);
    await leaf.setViewState({ type: VIEW_TYPE_SKILLTREE, active: true });
    this.app.workspace.revealLeaf(leaf);
  }

  updateViews() {
    this.app.workspace.getLeavesOfType(VIEW_TYPE_SKILLTREE).forEach(async leaf => {
      const view = leaf.view as any;
      if (view && view.loadSettings) {
        await view.loadSettings();
        const { LoadTree, LoadAllNodeTasks, SetupFileWatchers, CleanupFileWatchers } = await import("src/tree_manager");
        CleanupFileWatchers();
        await LoadTree();
        await LoadAllNodeTasks();
        SetupFileWatchers();
        const { Render } = await import("src/renderer");
        Render();
      }
    });
  }

  updateLevelPaneVisibility() {
    this.app.workspace.getLeavesOfType(VIEW_TYPE_SKILLTREE).forEach(leaf => {
      // const view = leaf.view as SkillTreeView;
      // if (view && view.toggleLevelPane) {
      //   view.toggleLevelPane(this.settings.showLevelPane !== false);
      // }
    });
  }

  updateStatusBar(text: string) {
    if (this.statusBarItem) {
      if (this.settings.showStatusBar !== false) {
        this.statusBarItem.textContent = `Skill Tree: ${text}`;
      } else {
        this.statusBarItem.textContent = 'Skill Tree';
      }
    }
  }

  getActiveView(): SkillTreeView | null {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_SKILLTREE);
    if (leaves.length > 0) {
      return leaves[0].view as SkillTreeView;
    }
    return null;
  }

  async importTree(data: any): Promise<void> {
    if (!data || !data.name || !Array.isArray(data.nodes)) {
      throw new Error('Invalid JSON: missing required fields');
    }
    
    let treeName = data.name;
    let counter = 1;
    while (this.settings.trees[treeName]) {
      treeName = `${data.name}-${counter}`;
      counter++;
    }
    
    data.name = treeName;
    this.settings.trees[treeName] = data;
    this.settings.currentTreeName = treeName;
    await this.saveData(this.settings);
    this.updateViews();
    skillTreeEvents.emit(EVENTS.TREE_ADDED, treeName);
  }

  exportTree(): any {
    const currentTree = this.settings.trees[this.settings.currentTreeName];
    if (currentTree) {
      return JSON.parse(JSON.stringify(currentTree));
    }
    return { name: this.settings.currentTreeName, nodes: [], edges: [] };
  }

  async openNewTreeModal(): Promise<void> {
    // const view = this.getActiveView();
    // if (view && view.openNewTreeModal) {
    //   await view.openNewTreeModal();
    // }
  }

  async deleteTree(name: string): Promise<void> {
    // const view = this.getActiveView();
    // if (view && view.deleteTree) {
    //   await view.deleteTree(name);
    //   this.updateViews();
    // }
  }

  getTreeNames(): string[] {
    return Object.keys(this.settings.trees);
  }

  getCurrentTreeName(): string {
    return this.settings.currentTreeName;
  }

  async switchTree(name: string): Promise<void> {
    // TODO:
    // const view = this.getActiveView();
    // if (view && view.switchTree) {
    //   await view.switchTree(name);
    //   this.updateViews();
    // }
  }
}

class FolderSuggestionModal extends FuzzySuggestModal<string> {
  folders: string[];
  onChoose: (value: string) => void;

  constructor(app: App, folders: string[], onChoose: (value: string) => void) {
    super(app);
    this.folders = folders;
    this.onChoose = onChoose;
  }

  getItems(): string[] {
    return this.folders;
  }

  getItemText(item: string): string {
    return item === '' ? 'Root' : item;
  }

  onChooseItem(item: string, evt: MouseEvent | KeyboardEvent): void {
    this.close();
    this.onChoose(item);
  }

  // Override to show all folders when no query
  getSuggestions(query: string): FuzzyMatch<string>[] {
    if (!query) {
      // Map folder paths to FuzzyMatch objects. Cast to satisfy expected type.
      return this.folders.map((f) => ({ item: f } as unknown as FuzzyMatch<string>));
    }
    return super.getSuggestions(query);
  }
}

class SkillTreeSettingTab extends PluginSettingTab {
  plugin: SkillTreePlugin;
  treeDropdown: any = null;

  constructor(app: App, plugin: SkillTreePlugin) {
    super(app, plugin);
    this.plugin = plugin;
    skillTreeEvents.on(EVENTS.TREE_ADDED, () => this.refreshTreeDropdown());
    skillTreeEvents.on(EVENTS.TREE_DELETED, () => this.refreshTreeDropdown());
  }

  refreshTreeDropdown() {
    if (this.treeDropdown) {
      const trees = this.plugin.getTreeNames();
      this.treeDropdown.options = {};
      trees.forEach((treeName: string) => {
        this.treeDropdown.addOption(treeName, treeName);
      });
      this.treeDropdown.setValue(this.plugin.getCurrentTreeName());
    }
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    containerEl.createEl('h2', { text: 'Skill Tree Settings' });

    new Setting(containerEl)
      .setName('Min node radius')
      .setDesc('Minimum radius for nodes in pixels')
      .addText(text => text
        .setPlaceholder('36')
        .setValue(String(this.plugin.settings.nodeRadius))
        .onChange(async (value) => {
          const val = parseInt(value, 10);
          if (!isNaN(val) && val > 4) {
            this.plugin.settings.nodeRadius = val;
            await this.plugin.saveSettings();
            this.plugin.updateViews();
          }
        }));

    new Setting(containerEl)
      .setName('Max node radius')
      .setDesc('Maximum radius for nodes in pixels')
      .addText(text => text
        .setPlaceholder('72')
        .setValue(String(this.plugin.settings.maxNodeRadius))
        .onChange(async (value) => {
          const val = parseInt(value, 10);
          if (!isNaN(val) && val > 4) {
            this.plugin.settings.maxNodeRadius = val;
            await this.plugin.saveSettings();
            this.plugin.updateViews();
          }
        }));

    new Setting(containerEl)
      .setName('Show EXP as fraction')
      .setDesc('Display EXP as a fraction (e.g., 50/100) instead of a number')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.showExpAsFraction)
        .onChange(async (value) => {
          this.plugin.settings.showExpAsFraction = value;
          await this.plugin.saveSettings();
          this.plugin.updateViews();
        }));

    new Setting(containerEl)
      .setName('Show level pane')
      .setDesc('Show the level and progress pane in the bottom-left corner')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.showLevelPane ?? true)
        .onChange(async (value) => {
          this.plugin.settings.showLevelPane = value;
          await this.plugin.saveSettings();
          this.plugin.updateLevelPaneVisibility();
        }));

    new Setting(containerEl)
      .setName('Level display mode')
      .setDesc('Choose what to display for level')
      .addDropdown(dropdown => dropdown
        .addOption('current', 'Current tree only')
        .addOption('aggregate', 'All trees (aggregate)')
        .addOption('both', 'Both current and aggregate')
        .setValue(this.plugin.settings.levelDisplayMode ?? 'current')
        .onChange(async (value) => {
          this.plugin.settings.levelDisplayMode = value as 'current' | 'aggregate' | 'both';
          await this.plugin.saveSettings();
          this.plugin.updateViews();
        }));

    new Setting(containerEl)
      .setName('EXP display mode')
      .setDesc('Choose what to display for EXP')
      .addDropdown(dropdown => dropdown
        .addOption('current', 'Current tree only')
        .addOption('aggregate', 'All trees (aggregate)')
        .addOption('both', 'Both current and aggregate')
        .setValue(this.plugin.settings.expDisplayMode ?? 'current')
        .onChange(async (value) => {
          this.plugin.settings.expDisplayMode = value as 'current' | 'aggregate' | 'both';
          await this.plugin.saveSettings();
          this.plugin.updateViews();
        }));

    new Setting(containerEl)
      .setName('Show in status bar')
      .setDesc('Show level and exp in the Obsidian status bar')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.showStatusBar ?? true)
        .onChange(async (value) => {
          this.plugin.settings.showStatusBar = value;
          await this.plugin.saveSettings();
          this.plugin.updateViews();
        }));

    new Setting(containerEl)
      .setName('Show EXP pane')
      .setDesc('Show the total EXP display in the top-right corner')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.showExpPane ?? true)
        .onChange(async (value) => {
          this.plugin.settings.showExpPane = value;
          await this.plugin.saveSettings();
          this.plugin.updateViews();
        }));

    // Bezier toggle (shown for non-gamified styles)
    const currentStyle = this.plugin.settings.style || 'default';
    if (currentStyle !== 'gamified') {
      new Setting(containerEl)
        .setName('Bezier edges')
        .setDesc('Use curved bezier edges instead of straight lines')
        .addToggle(toggle => toggle
          .setValue(this.plugin.settings.showBezier)
          .onChange(async (value) => {
            this.plugin.settings.showBezier = value;
            await this.plugin.saveSettings();
            this.plugin.updateViews();
          }));
    }

    // Default file path setting with autocomplete
    const folders = this.app.vault.getAllFolders();
    const folderPaths = ['']; // Start with root (empty string)
    folders.forEach(folder => {
      folderPaths.push(folder.path);
    });
    // Sort folder paths (root first, then alphabetically)
    folderPaths.sort((a, b) => {
      if (a === '') return -1; // Root first
      if (b === '') return 1;
      return a.localeCompare(b);
    });

    const pathSetting = new Setting(containerEl)
      .setName('Default file path')
      .setDesc('Directory where new files will be created (empty = root). Click Browse to select a folder.');

    pathSetting.addText(text => {
      const currentValue = this.plugin.settings.defaultFilePath || '';

      // Inline error message element (hidden until validation fails)
      const errorEl = pathSetting.controlEl.createEl('div', { text: '' });
      errorEl.style.color = 'var(--text-error, #e55353)';
      errorEl.style.fontSize = '12px';
      errorEl.style.marginTop = '6px';
      errorEl.style.display = 'none';
      errorEl.setAttribute('aria-live', 'polite');

      text.setPlaceholder('Root (or type a folder path)')
        .setValue(currentValue)
        .onChange(async (value) => {
          // Validate that the path is a valid folder (allow empty for root)
          try {
            const trimmed = (value || '').trim();
            // Normalize leading/trailing slashes
            let lookup = trimmed.startsWith('/') ? trimmed.substring(1) : trimmed;
            lookup = lookup.replace(/\/+$/, '');
            let isValid = false;
            if (trimmed === '') {
              isValid = true; // root
            } else {
              const file = this.app.vault.getAbstractFileByPath(lookup);
              isValid = !!file && file instanceof TFolder;
            }

            if (isValid) {
              this.plugin.settings.defaultFilePath = trimmed;
              await this.plugin.saveSettings();
              text.inputEl.style.border = '';
              errorEl.style.display = 'none';
              errorEl.setText('');
            } else {
              text.inputEl.style.border = '1px solid var(--text-error, #e55353)';
              errorEl.style.display = 'block';
              errorEl.setText('Folder not found — invalid path; will default to root');
            }
          } catch (e) {
            text.inputEl.style.border = '1px solid var(--text-error, #e55353)';
            errorEl.style.display = 'block';
            errorEl.setText('Folder not found — invalid path; will default to root');
          }
        });

      // Add a browse button
      const browseBtn = pathSetting.controlEl.createEl('button', { text: 'Browse' });
      browseBtn.style.marginLeft = '8px';
      browseBtn.style.padding = '4px 12px';
      browseBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const modal = new FolderSuggestionModal(this.app, folderPaths, (selectedPath: string) => {
          text.setValue(selectedPath);
          this.plugin.settings.defaultFilePath = selectedPath;
          this.plugin.saveSettings();
          errorEl.style.display = 'none';
          errorEl.setText('');
          text.inputEl.style.border = '';
        });
        modal.open();
      };
    });

    // Import/Export section
    containerEl.createEl('h3', { text: 'Import / Export' });

    new Setting(containerEl)
      .setName('Import Skill Tree')
      .setDesc('Import a skill tree from a JSON file')
      .addButton(button => button
        .setButtonText('Import JSON')
        .onClick(async () => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.json';
          input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
              const text = await file.text();
              try {
                const data = JSON.parse(text);
                await this.plugin.importTree(data);
                new Notice('Skill tree imported successfully!');
              } catch (err) {
                new Notice('Failed to import: Invalid JSON');
              }
            }
          };
          input.click();
        }));

    new Setting(containerEl)
      .setName('Export Skill Tree')
      .setDesc('Export the current skill tree to a JSON file')
      .addButton(button => button
        .setButtonText('Export JSON')
        .onClick(() => {
          const data = this.plugin.exportTree();
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${this.plugin.settings.currentTreeName || 'skill-tree'}.json`;
          a.click();
          URL.revokeObjectURL(url);
        }));

    // Tree Management section
    containerEl.createEl('h3', { text: 'Tree Management' });

    new Setting(containerEl)
      .setName('Current Tree')
      .setDesc('Switch between multiple skill trees')
      .addDropdown(dropdown => {
        this.treeDropdown = dropdown;
        const trees = this.plugin.getTreeNames();
        trees.forEach(treeName => {
          dropdown.addOption(treeName, treeName);
        });
        dropdown.setValue(this.plugin.getCurrentTreeName());
        dropdown.onChange(async (value) => {
          await this.plugin.switchTree(value);
          new Notice(`Switched to "${value}"`);
        });
      });

    // Custom Themes section
    containerEl.createEl('h3', { text: 'Custom Themes' });

    new Setting(containerEl)
      .setName('Active Theme')
      .setDesc('Select a custom CSS theme to apply')
      .addDropdown(dropdown => {
        dropdown.addOption('', 'None (default gamified style)');
        const themes = this.plugin.settings.themes || {};
        Object.values(themes).forEach(theme => {
          dropdown.addOption(theme.id, theme.name);
        });
        dropdown.setValue(this.plugin.settings.activeThemeId || '');
        dropdown.onChange(async (value) => {
          this.plugin.settings.activeThemeId = value || undefined;
          await this.plugin.saveSettings();
          this.plugin.updateViews();
        });
      })
      .addButton(button => button
        .setButtonText('Manage Themes')
        .setIcon('palette')
        .onClick(() => {
          new ManageThemesModal(this.app, this.plugin).open();
        }));

    // New Tree input row
    const newTreeRow = containerEl.createDiv();
    newTreeRow.style.cssText = S.TREE_ROW;

    const newTreeInput = newTreeRow.createEl('input', { attr: { placeholder: 'New tree name...' } });
    newTreeInput.style.cssText = S.TREE_INPUT;

    const createTreeBtn = newTreeRow.createEl('button', { text: 'Create' });
    createTreeBtn.style.cssText = S.BTN_PRIMARY_SMALL;

    const createNewTree = async () => {
      const name = newTreeInput.value.trim();
      if (!name) {
        new Notice('Please enter a tree name');
        return;
      }
      if (this.plugin.settings.trees[name]) {
        new Notice('A tree with that name already exists');
        return;
      }
      this.plugin.settings.trees[name] = {
        name: name,
        nodes: [],
        edges: []
      };
      await this.plugin.saveSettings();
      newTreeInput.value = '';
      new Notice(`Created tree "${name}"`);
      // Refresh the dropdown
      this.display();
    };

    createTreeBtn.onclick = createNewTree;
    newTreeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        createNewTree();
      }
    });

    // Rename current tree
    new Setting(containerEl)
      .setName('Rename Current Tree')
      .setDesc('Rename the currently selected skill tree')
    // .addButton(button => button
    //   .setButtonText('Rename')
    //   .onClick(async () => {
    //     const view = this.app.workspace.getActiveViewOfType(SkillTreeView);
    //     if (!view) {
    //       new Notice('No skill tree view open');
    //       return;
    //     }
    //     const currentName = this.plugin.settings.currentTreeName;
    //     const newName = await view.showRenameTreeDialog(currentName);
    //     if (newName && newName.trim() && newName.trim() !== currentName) {
    //       const trimmed = newName.trim();
    //       if (this.plugin.settings.trees[trimmed]) {
    //         new Notice('A tree with that name already exists');
    //       } else {
    //         this.plugin.settings.trees[trimmed] = this.plugin.settings.trees[currentName];
    //         this.plugin.settings.trees[trimmed].name = trimmed;
    //         delete this.plugin.settings.trees[currentName];
    //         this.plugin.settings.currentTreeName = trimmed;
    //         await this.plugin.saveSettings();
    //         this.plugin.switchTree(trimmed);
    //         new Notice(`Tree renamed to "${trimmed}"`);
    //       }
    //     }
    //   }));

    new Setting(containerEl)
      .setName('Delete Current Tree')
      .setDesc('Delete the currently selected skill tree')
      .addButton(button => button
        .setButtonText('Delete Tree')
        .setCta()
        .onClick(async () => {
          const treeCount = this.plugin.getTreeNames().length;
          if (treeCount <= 1) {
            new Notice('Cannot delete the last tree. Create a new tree first.');
            return;
          }
          const treeName = this.plugin.getCurrentTreeName();
          if (confirm(`Delete tree "${treeName}"? This cannot be undone.`)) {
            await this.plugin.deleteTree(treeName);
            new Notice(`Deleted "${treeName}"`);
          }
        }));
  }
}

/**
 * Modal for managing custom CSS themes.
 */
class ManageThemesModal extends Modal {
  private plugin: SkillTreePlugin;

  /**
   * Creates a new ManageThemesModal.
   * @param app - The Obsidian app instance
   * @param plugin - The Skill Tree plugin instance
   */
  constructor(app: App, plugin: SkillTreePlugin) {
    super(app);
    this.plugin = plugin;
  }

  /**
   * Called when the modal opens. Renders the theme list UI.
   */
  onOpen() {
    const { contentEl } = this;
    contentEl.style.padding = '20px';
    contentEl.style.maxWidth = '600px';

    const title = contentEl.createEl('h2', { text: 'Manage Custom Themes' });
    title.style.marginTop = '0';

    const listContainer = contentEl.createDiv();
    listContainer.style.marginBottom = '16px';

    const renderThemeList = () => {
      listContainer.innerHTML = '';
      const themes = this.plugin.settings.themes || {};

      Object.values(themes).forEach(theme => {
        const themeRow = listContainer.createDiv();
        themeRow.style.cssText = S.THEME_ROW;

        const themeName = themeRow.createSpan({ text: theme.name });
        themeName.style.cssText = S.THEME_NAME;

        const btnGroup = themeRow.createDiv();
        btnGroup.style.cssText = S.SETTING_BTN_GROUP;

        const editBtn = btnGroup.createEl('button', { text: 'Edit' });
        editBtn.style.cssText = S.BTN_ICON;
        editBtn.onclick = () => this.openThemeEditor(theme.id);

        const deleteBtn = btnGroup.createEl('button', { text: 'Delete' });
        deleteBtn.style.cssText = S.BTN_ICON;
        deleteBtn.onclick = async () => {
          if (confirm(`Delete theme "${theme.name}"?`)) {
            delete this.plugin.settings.themes[theme.id];
            // Reset active theme if it was this theme
            if (this.plugin.settings.activeThemeId === theme.id) {
              this.plugin.settings.activeThemeId = undefined;
            }
            await this.plugin.saveSettings();
            this.plugin.updateViews();
            renderThemeList();
          }
        };
      });

      if (Object.keys(themes).length === 0) {
        const emptyMsg = listContainer.createDiv();
        emptyMsg.style.cssText = S.EMPTY_MESSAGE;
        emptyMsg.textContent = 'No custom themes yet. Create one to get started.';
      }
    };

    const newThemeBtn = contentEl.createEl('button', { text: '+ New Theme' });
    newThemeBtn.style.cssText = S.BTN_PRIMARY;
    newThemeBtn.onclick = () => this.openThemeEditor();

    const closeBtn = contentEl.createEl('button', { text: 'Close' });
    closeBtn.style.cssText = S.CLOSE_BTN_ABSOLUTE;
    closeBtn.onclick = () => this.close();

    this.renderThemeList = renderThemeList;
    renderThemeList();
  }

  private renderThemeList: () => void = () => { };

  /**
   * Opens the theme editor for creating or editing a theme.
   * @param themeId - Optional ID of an existing theme to edit
   */
  private openThemeEditor(themeId?: string) {
    const theme = themeId ? this.plugin.settings.themes[themeId] : null;
    const isNew = !theme;

    const { contentEl } = this;
    contentEl.innerHTML = '';

    const title = contentEl.createEl('h2', { text: isNew ? 'New Theme' : 'Edit Theme' });
    title.style.marginTop = '0';

    const nameSetting = new Setting(contentEl)
      .setName('Theme Name')
      .addText(text => {
        text.inputEl.style.width = '100%';
        if (theme) text.setValue(theme.name);
        text.onChange(() => { });
      });

    const cssSetting = contentEl.createDiv();
    cssSetting.style.cssText = S.SETTING_MARGIN;

    const cssLabel = cssSetting.createEl('label', { text: 'Custom CSS' });
    cssLabel.style.cssText = S.SETTING_LABEL;

    const cssHint = cssSetting.createEl('p', { text: 'CSS is scoped to .skill-tree-canvas. Example: .skill-tree-canvas { background: #1a1a1a; }' });
    cssHint.style.cssText = S.SETTING_HINT;

    const cssTextarea = cssSetting.createEl('textarea');
    cssTextarea.style.cssText = S.FORM_TEXTAREA;
    if (theme) cssTextarea.value = theme.css;

    const actions = contentEl.createDiv();
    actions.style.cssText = S.BTN_ROW_LARGE;

    const cancelBtn = actions.createEl('button', { text: 'Cancel' });
    cancelBtn.style.cssText = S.BTN_SECONDARY;
    cancelBtn.onclick = () => this.onOpen();

    const saveBtn = actions.createEl('button', { text: 'Save' });
    saveBtn.style.cssText = S.BTN_PRIMARY;
    saveBtn.onclick = async () => {
      const name = (nameSetting.descEl as HTMLElement).querySelector('input')?.value.trim() || 'Untitled Theme';
      const css = cssTextarea.value;
      const id = themeId || crypto.randomUUID();

      this.plugin.settings.themes[id] = { id, name, css };
      await this.plugin.saveSettings();
      this.plugin.updateViews();
      this.onOpen();
    };
  }
}

/**
 * Modal for selecting a skill tree with fuzzy search.
 */
class TreeSelectModal extends FuzzySuggestModal<string> {
  private treeItems: string[];
  private onSelect: (tree: string) => void;

  /**
   * Creates a new TreeSelectModal.
   * @param app - The Obsidian app instance
   * @param items - List of tree names to suggest
   * @param onSelect - Callback when a tree is selected
   */
  constructor(app: App, items: string[], onSelect: (tree: string) => void) {
    super(app);
    this.treeItems = items;
    this.onSelect = onSelect;
  }

  getItems(): string[] {
    return this.treeItems;
  }

  getItemText(item: string): string {
    return item;
  }

  onChooseItem(item: string, evt: MouseEvent | KeyboardEvent): void {
    this.onSelect(item);
  }

  renderSuggestion(item: FuzzyMatch<string>, el: HTMLElement): void {
    el.setText(item.item);
  }
}


export interface SkillTreeSettings {
  mode: Mode
  /** Minimum radius for nodes in pixels (default: 36) */
  nodeRadius: number;
  /** Maximum radius for nodes in pixels (default: 72) */
  maxNodeRadius: number;
  /** Whether to use curved bezier edges (non-gamified styles only) */
  showBezier: boolean;
  /** Default EXP value for new nodes (default: 10) */
  defaultExp: number;
  /** Whether to display EXP as fraction (e.g., "50/100") */
  showExpAsFraction: boolean;
  /** Name of the currently active skill tree */
  currentTreeName: string;
  /** All skill trees indexed by name */
  trees: Record<string, SkillTreeData>;
  /** Default directory for creating new node files (empty = root) */
  defaultFilePath: string;
  /** Visual style name (key from SKILL_TREE_STYLES) */
  style: string;

  handleRadius: number
  /** Persisted positions for draggable modals (keys like 'statsModal', 'editorModal') */
  modalPositions?: Record<string, { left: number; top: number }>;
  /** Whether to suppress the delete confirmation dialog */
  suppressDeleteConfirmation?: boolean;
  /** Whether to show the level pane in the bottom-left corner */
  showLevelPane?: boolean;
  /** Whether to show the EXP pane in the top-right corner */
  showExpPane?: boolean;
  /** Level display mode: 'current' = current tree only, 'aggregate' = all trees, 'both' = both */
  levelDisplayMode?: 'current' | 'aggregate' | 'both';
  /** EXP display mode: 'current' = current tree only, 'aggregate' = all trees, 'both' = both */
  expDisplayMode?: 'current' | 'aggregate' | 'both';
  /** Whether to show level/exp in the status bar */
  showStatusBar?: boolean;
  /** Custom CSS themes (not exported with tree JSON) */
  themes: Record<string, CustomTheme>;
  /** Active custom theme ID (undefined = use default style) */
  activeThemeId?: string;
  /** Whether to suppress the node type change warning in JSON editor */
  suppressNodeTypeWarning?: boolean;
}
