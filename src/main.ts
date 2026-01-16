import { Plugin, WorkspaceLeaf, PluginSettingTab, Setting, App, FuzzySuggestModal, TAbstractFile} from 'obsidian';
import { SkillTreeSettings, SKILL_TREE_STYLES } from './interfaces';
import { SkillTreeView } from './skilltree-view';
import { VIEW_TYPE_SKILLTREE } from './constants';

export type { SkillTreeSettings, SkillTreeData, SkillNode, SkillEdge } from './interfaces';
export type { Coordinate } from './types';
export { VIEW_TYPE_SKILLTREE }
export { SkillTreeView };

/**
 * Unique view type identifier used when registering the Skill Tree view.
 */


/**
 * Default plugin settings.
 * @internal
 */
function defaultSettings(): SkillTreeSettings {
  return {
    nodeRadius: 36, 
    showHandles: false, 
    showBezier: false, 
    defaultExp: 10, 
    showExpAsFraction: false,
    currentTreeName: 'default',
    trees: { 'default': { name: 'default', nodes: [], edges: [] } }, // TODO implement
    defaultFilePath: '', // Empty string = root directory
    style: 'gamified' // Default style
  };
}


/**
 * Main plugin class for the Skill Tree Obsidian plugin.
 * Handles settings, view registration and activation.
 */
export default class SkillTreePlugin extends Plugin {
  /** The settings. Will be default if nothing is saved or changed */
  settings: SkillTreeSettings = defaultSettings();

  async onload() {
    await this.loadSettings();

    this.addSettingTab(new SkillTreeSettingTab(this.app, this));

    this.registerView?.(VIEW_TYPE_SKILLTREE, (leaf: WorkspaceLeaf) => new SkillTreeView(leaf, this));

    this.addCommand?.({
      id: 'open-skill-tree',
      name: 'Open Skill Tree',
      callback: () => this.activateView(),
    });

    this.addRibbonIcon?.('dice', 'Open Skill Tree', () => this.activateView());
  }

  onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_SKILLTREE);
  }

  async loadSettings() {
    this.settings = Object.assign(defaultSettings(), await this.loadData());
    // Ensure style is set (for backward compatibility)
    if (!this.settings.style || !SKILL_TREE_STYLES[this.settings.style]) {
      // Migrate old style names to new ones
      if (this.settings.style === 'default') {
        this.settings.style = 'simple-light';
      } else if (this.settings.style === 'dark') {
        this.settings.style = 'simple-dark';
      } else {
        // Default to gamified for new installations or invalid styles
        this.settings.style = 'gamified';
      }
    }
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
    this.app.workspace.getLeavesOfType(VIEW_TYPE_SKILLTREE).forEach(leaf => {
      const view = leaf.view as SkillTreeView;
      if (view && view.render) {
        view.render();
      }
    });
  }
}

/**
 * Folder suggestion modal for selecting directories with fuzzy search
 */
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
  getSuggestions(query: string): string[] {
    if (!query) {
      return this.folders;
    }
    return super.getSuggestions(query);
  }
}

/**
 * Settings tab displayed in Obsidian's settings dialog for the plugin.
 */
class SkillTreeSettingTab extends PluginSettingTab {
  plugin: SkillTreePlugin;

  constructor(app: App, plugin: SkillTreePlugin) {
    super(app, plugin);
    this.plugin = plugin;
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
      .setName('Show handles')
      .setDesc('Show connection handles on nodes')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.showHandles)
        .onChange(async (value) => {
          this.plugin.settings.showHandles = value;
          await this.plugin.saveSettings();
          this.plugin.updateViews();
        }));

    // Only show bezier toggle if not using gamified style (gamified always uses rigid bezier)
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

    new Setting(containerEl)
      .setName('Style')
      .setDesc('Visual style for the skill tree canvas')
      .addDropdown(dropdown => {
        Object.keys(SKILL_TREE_STYLES).forEach(styleKey => {
          dropdown.addOption(styleKey, SKILL_TREE_STYLES[styleKey].name);
        });
        dropdown.setValue(this.plugin.settings.style || 'default');
        dropdown.onChange(async (value) => {
          this.plugin.settings.style = value;
          // For gamified style, force bezier to be enabled
          if (value === 'gamified') {
            this.plugin.settings.showBezier = true;
          }
          await this.plugin.saveSettings();
          this.plugin.updateViews();
          // Refresh settings display to show/hide bezier toggle
          this.display();
        });
      });

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
      .setDesc('Directory where new files will be created (empty = root). Click Browse to select a folder.')
      .addText(text => {
        const currentValue = this.plugin.settings.defaultFilePath || '';
        text.setPlaceholder('Root (or type a folder path)')
            .setValue(currentValue)
            .onChange(async (value) => {
              // Validate that the path is a valid folder (allow empty for root)
              const isValid = value === '' || folderPaths.includes(value);
              if (isValid) {
                this.plugin.settings.defaultFilePath = value;
                await this.plugin.saveSettings();
                // Clear any error styling
                text.inputEl.style.borderColor = '';
              } else {
                // Show error styling for invalid paths
                text.inputEl.style.borderColor = 'var(--text-error)';
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
          });
          modal.open();
        };
      });
  }
}
