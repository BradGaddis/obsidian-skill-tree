import { Plugin, WorkspaceLeaf, PluginSettingTab, Setting, App,} from 'obsidian';
import { SkillTreeSettings } from './interfaces';
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
    defaultLabel: 'New Skill', 
    nodeRadius: 36, 
    showHandles: false, 
    showBezier: false, 
    defaultExp: 10, 
    showExpAsFraction: false,
    currentTreeName: 'default',
    trees: { 'default': { name: 'default', nodes: [], edges: [] } } // TODO implement
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
      .setName('Default label')
      .setDesc('Default label for new nodes')
      .addText(text => text
        .setPlaceholder('New Skill')
        .setValue(this.plugin.settings.defaultLabel)
        .onChange(async (value) => {
          this.plugin.settings.defaultLabel = value;
          await this.plugin.saveSettings();
          this.plugin.updateViews();
        }));

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
}
