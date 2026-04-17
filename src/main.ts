import { App, Notice, Plugin, PluginSettingTab, Setting, WorkspaceLeaf } from 'obsidian';

import { SkillTreeSettings, SkillTreeData } from './types/interfaces';
import { toTitleCase, findTreeByCaseInsensitive } from './types/utils';
import { VIEW_TYPE_SKILLTREE } from './types/constants';

import { SkillTreeView } from './skilltreeview';
import { GetCurrentTreeData } from './data/tree_manager';
import { SetupFileWatchers, CleanupFileWatchers } from './handlers/watcher_setup';
import { SetSettings, SetView } from './utils/globals';
import { skillTreeEvents, EVENTS } from './utils/events';
import { TreeSuggestModal, FolderSuggestionModal } from './ui/fuzzy_suggest_modal';
import { isValidTreeName, sanitizeTreeName } from './utils/html_escape';
import { validateSkillTreeData, formatValidationErrors } from './utils/json_validator';

export function defaultSettings(): SkillTreeSettings {
  return {
    mode: "view",
    previousMode: "view",
    minNodeRadius: 40,
    maxNodeRadius: 100,
    defaultExp: 10,
    showExpAsFraction: false,
    currentTreeName: 'default',
    trees: { 'default': { name: 'default', nodes: [], edges: [] } },
    defaultFilePath: '',
    handleRadius: 8,
    modalPositions: {},
    suppressDeleteConfirmation: false,
    showLevelPane: true,
    levelMultiplier: 1,
    currentExp: 0,
    aggregateExp: 0,
    aggregateTotalExp: 0,
    levelDisplayMode: 'current',
    expDisplayMode: 'current',
    showStatusBar: true,
    fontSize: 16,
    customTaskQuery: '',
    lastModified: 0,
  };
}


export default class SkillTreePlugin extends Plugin {
  settings: SkillTreeSettings = defaultSettings();
  settingsTab: SkillTreeSettingTab | null = null;

  statusBarItem: HTMLElement | null = null;

  async onload() {
    await this.loadSettings();

    this.settingsTab = new SkillTreeSettingTab(this.app, this);
    this.addSettingTab(this.settingsTab);

    this.registerView?.(VIEW_TYPE_SKILLTREE, (leaf: WorkspaceLeaf) => {
      let view: SkillTreeView = new SkillTreeView(leaf, this)
      SetView(view)
      return view
    });

    this.addCommand?.({
      id: 'open-skill-tree',
      name: 'Open Skill Tree',
      callback: () => this.activateView(),
    });

    this.addCommand?.({
      id: 'toggle-edit-mode',
      name: 'Skill Tree: Toggle Edit Mode',

      checkCallback: (checking) => {

        const view = this.getActiveView();

        if (!view) {
          return false;
        }

        if (!checking) {
          const currentMode = this.settings.mode;
          const previousMode = this.settings.previousMode;
          this.settings.previousMode = currentMode;
          this.settings.mode = previousMode;
          this.saveSettings();

          // Dynamically import Update to avoid circular deps
          import("./rendering/renderer").then(m => m.Update());
        }
        return true;
      },
    });

    this.addCommand?.({
      id: 'jump-to-node',
      name: 'Jump to Node',
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
      name: 'Switch to Tree',
      callback: () => {
        const treeNames = Object.keys(this.settings.trees);
        if (treeNames.length === 0) {
          new Notice('No skill trees found');
          return;
        }
        if (treeNames.length === 1) {
          const firstTree = treeNames[0];
          if (firstTree === undefined) {
            new Notice('No skill trees found');
            return;
          }
          this.settings.currentTreeName = firstTree;
          this.saveSettings();
          this.activateView();
          return;
        }
        new TreeSuggestModal(this.app, (selectedTree) => {
          this.settings.currentTreeName = selectedTree;
          this.saveSettings();
          this.activateView();
        }, treeNames).open();
      },
    });


    this.addRibbonIcon?.('dice', 'Open Skill Tree', () => this.activateView());

    this.statusBarItem = this.addStatusBarItem();
    this.statusBarItem.setAttribute('style', 'cursor: pointer;');
    this.statusBarItem.onclick = () => this.activateView();
    this.statusBarItem.textContent = 'Skill Tree';

    SetupFileWatchers(this.app)
  }

  onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_SKILLTREE);

    // Clean up setting tab event listeners
    if (this.settingsTab) {
      this.settingsTab.cleanup();
      this.settingsTab = null;
    }

    // Clean up file watchers
    CleanupFileWatchers();
  }

  async loadSettings() {
    this.settings = Object.assign(defaultSettings(), await this.loadData());
    SetSettings(this.settings)
  }

  async saveSettings() {
    this.settings.lastModified = Date.now();
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
      const view = leaf.view as SkillTreeView | undefined;
      if (view && view.loadSettings) {
        await view.loadSettings();
        const { LoadTree } = await import("./data/tree_manager");
        const { CleanupFileWatchers, SetupFileWatchers } = await import("./handlers/watcher_setup");
        CleanupFileWatchers();
        await LoadTree();
        SetupFileWatchers();
        const { Update: Render } = await import("./rendering/renderer");
        Render();
      }
    });
  }

  updateLevelPaneVisibility() {
    this.app.workspace.getLeavesOfType(VIEW_TYPE_SKILLTREE).forEach(async leaf => {
      const view = leaf.view as SkillTreeView | undefined;
      if (view && view.settings) {
        const { ToggleLevelPane, UpdateLevelPane } = await import("./rendering/renderer");
        ToggleLevelPane(view.settings.showLevelPane !== false);
        UpdateLevelPane();
      }
    });
  }

  updateStatusBar(text: string) {
    if (this.statusBarItem) {
      if (this.settings.showStatusBar !== false) {
        if (this.statusBarItem) {
          this.statusBarItem.textContent = `Skill Tree: ${text}`;
        }
      } else {
        if (this.statusBarItem) {
          this.statusBarItem.textContent = 'Skill Tree';
        }
      }
    }
  }

  getActiveView(): SkillTreeView | null {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_SKILLTREE);
    const firstLeaf = leaves[0];
    if (firstLeaf) {
      return firstLeaf.view as SkillTreeView;
    }
    return null;
  }

  async importTree(data: SkillTreeData): Promise<void> {
    // Validate the imported JSON data against schema
    const validation = validateSkillTreeData(data);
    if (!validation.valid) {
      throw new Error(formatValidationErrors(validation.errors));
    }

    // Validate and sanitize the tree name
    if (!isValidTreeName(data.name)) {
      throw new Error('Invalid tree name: tree names cannot contain HTML tags or script content');
    }

    const treeName = toTitleCase(data.name);
    const existingMatch = findTreeByCaseInsensitive(data.name, this.settings.trees);
    if (existingMatch) {
      throw new Error(`A tree with that name already exists: "${existingMatch}"`);
    }

    // Sanitize the tree name to ensure safety
    data.name = sanitizeTreeName(treeName) || treeName;
    this.settings.trees[data.name] = data;
    this.settings.currentTreeName = data.name;
    await this.saveData(this.settings);
    this.updateViews();
    skillTreeEvents.emit(EVENTS.TREE_ADDED, data.name);
  }

  exportTree(): SkillTreeData {
    const currentTree = GetCurrentTreeData();
    if (currentTree) {
      return JSON.parse(JSON.stringify(currentTree));
    }
    return { name: this.settings.currentTreeName, nodes: [], edges: [] };
  }

  getTreeNames(): string[] {
    return Object.keys(this.settings.trees);
  }

  getCurrentTreeName(): string {
    return this.settings.currentTreeName;
  }

  async switchTree(name: string): Promise<void> {
    const { SwitchTree } = await import("./data/tree_manager");
    await SwitchTree(name);
  }


  async onExternalSettingsChange(): Promise<void> {
    const externalData = await this.loadData();
    const externalTime = externalData?.lastModified || 0;
    const ourTime = this.settings.lastModified || 0;

    if (externalTime > ourTime) {
      // new Notice('External changes detected - reloading');
      await this.loadSettings();
      this.updateViews();
    } else {
      await this.saveSettings();
    }
  }
}

class SkillTreeSettingTab extends PluginSettingTab {
  plugin: SkillTreePlugin;
  treeDropdown: any = null;
  private treeAddedCallback: (() => void) | null = null;
  private treeDeletedCallback: (() => void) | null = null;

  constructor(app: App, plugin: SkillTreePlugin) {
    super(app, plugin);
    this.plugin = plugin;
    this.treeAddedCallback = () => this.refreshTreeDropdown();
    this.treeDeletedCallback = () => this.refreshTreeDropdown();
    skillTreeEvents.on(EVENTS.TREE_ADDED, this.treeAddedCallback);
    skillTreeEvents.on(EVENTS.TREE_DELETED, this.treeDeletedCallback);
  }

  /**
   * Clean up event listeners registered by this settings tab.
   * Must be called when the plugin is unloaded to prevent memory leaks.
   */
  cleanup(): void {
    if (this.treeAddedCallback) {
      skillTreeEvents.off(EVENTS.TREE_ADDED, this.treeAddedCallback);
      this.treeAddedCallback = null;
    }
    if (this.treeDeletedCallback) {
      skillTreeEvents.off(EVENTS.TREE_DELETED, this.treeDeletedCallback);
      this.treeDeletedCallback = null;
    }
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
      .setName('Default Skill EXP')
      .setDesc('Skills worth exp with contribute this much when linked to a terminal node')
      .addText(text => text
        .setPlaceholder(String(10))
        .setValue(String(this.plugin.settings.defaultExp))
        .onChange(async (value) => {
          const val = parseInt(value);
          if (!isNaN(val)) {
            this.plugin.settings.defaultExp = val;
            await this.plugin.saveSettings();
            this.plugin.updateViews();
          }
        }));


    new Setting(containerEl)
      .setName('Min node radius')
      .setDesc('Minimum radius for nodes in pixels')
      .addText(text => text
        .setPlaceholder('36')
        .setValue(String(this.plugin.settings.minNodeRadius))
        .onChange(async (value) => {
          const val = parseInt(value, 10);
          if (!isNaN(val) && val > 4) {
            this.plugin.settings.minNodeRadius = val;
            await this.plugin.saveSettings();
            this.plugin.updateViews();
          }
        }));

    new Setting(containerEl)
      .setName('Max node radius')
      .setDesc('Maximum radius for nodes in pixels')
      .addText(text => text
        .setPlaceholder('100')
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
          this.app.workspace.getLeavesOfType(VIEW_TYPE_SKILLTREE).forEach(async leaf => {
            const view = leaf.view as SkillTreeView | undefined;
            if (view) {
              const { UpdateLevelPane } = await import("./rendering/renderer");
              UpdateLevelPane();
            }
          });
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
          this.app.workspace.getLeavesOfType(VIEW_TYPE_SKILLTREE).forEach(async leaf => {
            const view = leaf.view as SkillTreeView | undefined;
            if (view) {
              const { UpdateLevelPane } = await import("./rendering/renderer");
              UpdateLevelPane();
            }
          });
        }));

    new Setting(containerEl)
      .setName('Level multiplier')
      .setDesc('Higher numbers slow down leveling progression (1 = default)')
      .addText(text => text
        .setValue(String(this.plugin.settings.levelMultiplier ?? 1))
        .setPlaceholder('1')
        .onChange(async (value) => {
          const num = parseFloat(value);
          if (!isNaN(num) && num > 0) {
            this.plugin.settings.levelMultiplier = num;
            await this.plugin.saveSettings();
            this.app.workspace.getLeavesOfType(VIEW_TYPE_SKILLTREE).forEach(async leaf => {
              const view = leaf.view as SkillTreeView | undefined;
              if (view) {
                const { UpdateLevelPane } = await import("./rendering/renderer");
                UpdateLevelPane();
              }
            });
          }
        }));

    new Setting(containerEl)
      .setName('Show level pane')
      .setDesc('Show the level and progress pane in the bottom-left corner')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.showLevelPane !== false)
        .onChange(async (value) => {
          this.plugin.settings.showLevelPane = value;
          await this.plugin.saveSettings();
          this.app.workspace.getLeavesOfType(VIEW_TYPE_SKILLTREE).forEach(async leaf => {
            const view = leaf.view as SkillTreeView | undefined;
            if (view) {
              const { ToggleLevelPane, UpdateLevelPane } = await import("./rendering/renderer");
              ToggleLevelPane(value);
              UpdateLevelPane();
            }
          });
        }));

    new Setting(containerEl)
      .setName('Show in status bar')
      .setDesc('Show level and exp in the Obsidian status bar')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.showStatusBar ?? true)
        .onChange(async (value) => {
          this.plugin.settings.showStatusBar = value;
          await this.plugin.saveSettings();
          this.app.workspace.getLeavesOfType(VIEW_TYPE_SKILLTREE).forEach(async leaf => {
            const view = leaf.view as SkillTreeView | undefined;
            if (view && view.settings) {
              view.settings.showStatusBar = value;
              const { UpdateLevelPane } = await import("./rendering/renderer");
              UpdateLevelPane();
            }
          });
        }));



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

    const currentPath = this.plugin.settings.defaultFilePath || '';
    const displayEl = pathSetting.controlEl.createEl('span', {
      text: currentPath === '' ? 'Root' : currentPath
    });
    displayEl.addClass('skill-tree-path-display');

    const browseBtn = pathSetting.controlEl.createEl('button', { text: 'Browse' });
    browseBtn.addClass('skill-tree-browse-btn');
    browseBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const modal = new FolderSuggestionModal(this.app, folderPaths, async (selectedPath: string) => {
        displayEl.setText(selectedPath === '' ? 'Root' : selectedPath);
        this.plugin.settings.defaultFilePath = selectedPath;
        await this.plugin.saveSettings();
      });
      modal.open();
    };

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
                const errorMessage = (err as Error).message || 'Invalid JSON';
                new Notice(`Import failed: ${errorMessage}`);
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


    // New Tree input row
    const newTreeRow = containerEl.createDiv();
    newTreeRow.classList.add('skill-tree-tree-row');

    const newTreeInput = newTreeRow.createEl('input', { attr: { placeholder: 'New tree name...' } });
    newTreeInput.classList.add('skill-tree-tree-input');

    const createTreeBtn = newTreeRow.createEl('button', { text: 'Create' });
    createTreeBtn.classList.add('skill-tree-btn', 'skill-tree-btn--primary-sm');

    const createNewTree = async () => {
      const name = newTreeInput.value.trim();
      if (!name) {
        new Notice('Please enter a tree name');
        return;
      }
      if (!isValidTreeName(name)) {
        new Notice('Invalid tree name: cannot contain HTML tags or script content');
        return;
      }
      if (this.plugin.settings.trees[name]) {
        new Notice('A tree with that name already exists');
        return;
      }
      const safeName = sanitizeTreeName(name);
      this.plugin.settings.trees[safeName] = {
        name: safeName,
        nodes: [],
        edges: []
      };
      await this.plugin.saveSettings();
      await this.plugin.switchTree(safeName);
      newTreeInput.value = '';
      new Notice(`Created tree "${safeName}"`);
      // Refresh the dropdown
      this.refreshTreeDropdown();
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
      .addText(text => {
        text.setPlaceholder(this.plugin.settings.currentTreeName || 'new name');
        text.onChange(() => { });
      })
      .addButton(button => button
        .setButtonText('Rename')
        .onClick(async () => {
          const inputEl = containerEl.querySelector('.setting-item:nth-last-child(2) input') as HTMLInputElement;
          const newName = inputEl?.value?.trim();
          if (!newName) {
            new Notice('Please enter a new name');
            return;
          }
          if (!isValidTreeName(newName)) {
            new Notice('Invalid tree name: cannot contain HTML tags or script content');
            return;
          }
          const currentName = this.plugin.settings.currentTreeName;
          if (newName === currentName) {
            new Notice('Name unchanged');
            return;
          }
          if (this.plugin.settings.trees[newName]) {
            new Notice('A tree with that name already exists');
            return;
          }
          const currentTree = this.plugin.settings.trees[currentName];
          if (!currentTree) {
            new Notice('Current tree not found');
            return;
          }
          const safeName = sanitizeTreeName(newName);
          this.plugin.settings.trees[safeName] = currentTree;
          this.plugin.settings.trees[safeName].name = safeName;
          delete this.plugin.settings.trees[currentName];
          this.plugin.settings.currentTreeName = safeName;
          await this.plugin.saveSettings();
          this.plugin.switchTree(safeName);
          this.refreshTreeDropdown();
          new Notice(`Tree renamed to "${safeName}"`);
        }));

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
            const { DeleteTree } = await import("./data/tree_manager");
            await DeleteTree(treeName);
            new Notice(`Deleted "${treeName}"`);
          }
        }));


    // new Setting(containerEl)
    //   .setName("Custom TaskQuery")
    //   .addTextArea((text) => {
    //     text.setValue(this.plugin.settings.customTaskQuery || '')
    //       .setPlaceholder("Enter custom tasks query...");
    //     text.inputEl.addEventListener('change', async () => {
    //       this.plugin.settings.customTaskQuery = text.getValue();
    //       await this.plugin.saveSettings();
    //     });
    //   });

  }

}
