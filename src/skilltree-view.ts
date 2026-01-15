import {ItemView, WorkspaceLeaf, TFile } from 'obsidian';

import { SkillNode, SkillEdge, SkillTreeSettings, SkillTreeData } from './interfaces';
import  {VIEW_TYPE_SKILLTREE}  from './main';
import SkillTreePlugin from './main';
import { chooseEdgeColor, computeBezierControls, drawBezierArrow, drawArrow, parseCSSColor, distanceSqToBezier } from './drawing';
import { Coordinate } from './types';
import { ModalStyleOptions } from './types';
import { DEFAULT_MODAL_STYLES } from './constants';

/**
 * Create a small default set of nodes used when initializing a new tree.
 * @internal
 */
function defaultNodes(): SkillNode[] {
  return [
    { id: Date.now(), x: 200, y: 150, label: 'Right Click Me!', state: 'unavailable', exp: 10 },
    { id: Date.now() + 1, x: 200, y: 150, label: 'Double Left Click Me', state: 'unavailable', exp: 10 },
  ];
}

/**
 * View that renders and manages the interactive Skill Tree canvas.
 *
 * This class extends Obsidian's `ItemView` and handles node/edge
 * rendering, input handling, and integrations with task/dataview plugins.
 */
export class SkillTreeView extends ItemView {
  /** The canvas that this plugin will render to */
  canvas: HTMLCanvasElement | null = null;

  /** The context in which is manipulated to draw our elements */
  context: CanvasRenderingContext2D | null = null;

  /** TODO */
  canvasWrap: HTMLDivElement | null = null;

  /** I am not entirely sure what this does yet. It appears to be rendered onLoad(), and used for what we ACTUALLY draw on */
  resizeObserver: ResizeObserver | null = null;
  
  /** Updated anytime the "camera" is moved */
  offset: Coordinate = { x: 0, y: 0 };
  
  /** A measure of how "zoomed" we are on the canvas */
  scale = 1;

  /** The node information that is rendered to a the canvas */
  nodes: SkillNode[] = [];

  /** Information about the line that is drawn between two nodes */
  edges: SkillEdge[] = [];

  /** Information about where a mouse drag starts from a node id and its coordinates */
  _dragStart: { nodeId: number; x: number; y: number } | null = null;
  
  /** TODO */
  _dragStartScreen: Coordinate | null = null;
  
  /** TODO */
  _dragging = false;
  
  /** TODO */
  creatingEdgeFrom: SkillNode | null = null;
  
  /** TODO */
  creatingEdgeFromSide: 'top'|'right'|'bottom'|'left' | null = null;
  
  /** TODO */
  tempEdgeTarget: { x: number; y: number } | null = null;
  
  /** TODO */
  nodeRadii: Record<number, number> = {};
  
  /** TODO */
  selectedNodeId: number | null = null;
  
  /** TODO */
  selectedTask: { nodeId: number; taskIndex: number } | null = null;
  
  /** TODO */
  historyPast: any[] = [];
  
  /** TODO */
  historyFuture: any[] = [];
  
  /** TODO */
  _suppressHistory = false;
  
  /** Exists to detect when the mouse is clicked outside of a modal */
  modalOutsideListener: ((e: Event) => void) | null = null;
  
  /** TODO */
  draggingEdgeEndpoint: { edgeId: number; which: 'from' | 'to' } | null = null;
  
  /** TODO */
  _edgeDragActive = false;
  
  /** TODO */
  _edgeDragStart: Coordinate | null = null;
  
  /** Referenced to the default plugin*/
  plugin: SkillTreePlugin;
  
  /** TODO */
  _keyHandler: ((e: KeyboardEvent) => void) | null = null;
  
  /** TODO */
  _animationTime = 0;
  
  /** TODO */
  _animationFrameId: number | null = null;

  
  
  constructor(leaf: WorkspaceLeaf, plugin: SkillTreePlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  get settings(): SkillTreeSettings {
    return this.plugin.settings;
  }

  getViewType(): string {
    return VIEW_TYPE_SKILLTREE;
  }

  getDisplayText(): string {
    return 'Skill Tree';
  }

  // Check if Tasks plugin is installed
  isTasksPluginInstalled(): boolean {
    try {
      // Check if Tasks plugin is available
      const tasksPlugin = (this.app as any).plugins?.plugins?.['obsidian-tasks-plugin'];
      if (tasksPlugin) return true;
      
      
      return false;
    } catch (e) {
      return false;
    }
  }

  // Check if Tasks plugin is installed
  isDataviewPluginInstalled(): boolean {
    try {
      // Check if Tasks plugin is available
      const dataviewPlugin = (this.app as any).plugins?.plugins?.['dataview'];
      if (dataviewPlugin) return true;
      
      return false;
    } catch (e) {
      return false;
    }
  }



  // Get Tasks plugin instance
  getTasksPlugin(): any {
    try {
      return (this.app as any).plugins?.plugins?.['obsidian-tasks-plugin'] || 
             (this.app as any).plugins?.plugins?.['tasks'] || 
             null;
    } catch (e) {
      return null;
    }
  }

  // TODO switch to dataview sTask 
  // Get tasks from a file using Tasks plugin or manual parsing
  async getTasksFromFile(filePath: string): Promise<any[]> {
    try {

      // Normalize file path - remove leading slash if present, ensure .md extension
      let normalizedPath = filePath.trim();
      
      if (normalizedPath.startsWith('/')) {
        normalizedPath = normalizedPath.substring(1);
      }

      if (!normalizedPath.endsWith('.md')) {
        normalizedPath = normalizedPath + '.md';
      }
      
      // Try to get the file - also try without .md extension
      let file = this.app.vault.getAbstractFileByPath(normalizedPath);
      
      if (!file && !filePath.endsWith('.md')) {
        // Try the original path as-is
        file = this.app.vault.getAbstractFileByPath(filePath.trim());
        if (file) {
          normalizedPath = filePath.trim();
        }
      }
      
      if (!file) {
        return [];
      }
      
      // Check if it's a TFile (text file)
      if (!(file instanceof TFile)) {
        return [];
      }
      
      // Read file content
      const content = await this.app.vault.read(file);
      
      // Try Tasks plugin API first if available, but we still need to parse hierarchy manually
      let tasksFromAPI: any[] = [];
      
      if (this.isTasksPluginInstalled()) {
        const tasksPlugin = this.getTasksPlugin();
        if (tasksPlugin && tasksPlugin.api && typeof tasksPlugin.api.parseTasks === 'function') {
          try {
            const parsedTasks = tasksPlugin.api.parseTasks(content);
            // Convert to our format if needed
            if (parsedTasks && parsedTasks.length > 0) {
              tasksFromAPI = parsedTasks.map((t: any, idx: number) => ({
                id: idx,
                text: t.description || t.text || '',
                completed: t.status === 'x' || t.completed || false,
                line: t.line || idx,
                originalTask: t,
                exp: 10 // Default exp for each task
              }));
            }
          } catch (e) {
            // Fallback to manual parsing
          }
        }
        
      }
      
      // If we got tasks from API, we still need to parse hierarchy from the file
      // So we'll parse manually to get hierarchy, then merge with API data if available
      
      // Fallback: parse tasks manually using regex
      // Tasks format: - [ ] task text or - [x] completed task
      // Also handles: * [ ] and other list markers
      // Supports nested tasks (children) based on indentation
      const lines = content.split('\n');
      const tasks: any[] = [];
      let index = 0;
      
      // First pass: parse all tasks and determine hierarchy based on indentation
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Try multiple patterns to match different task formats
        // Pattern 1: - [ ] or - [x] (with spaces)
        // Pattern 2: -[ ] or -[x] (without space)
        // Pattern 3: * [ ] or * [x]
        // Pattern 4: *[ ] or *[x]
        let taskMatch = line.match(/^(\s*)[-*]\s*\[([ xX])\]\s+(.+)$/);
        if (!taskMatch) {
          // Try without space between marker and bracket
          taskMatch = line.match(/^(\s*)[-*]\[([ xX])\]\s+(.+)$/);
        }
        if (!taskMatch) {
          // Try with tab or multiple spaces
          taskMatch = line.match(/^(\s*)[-*]\s+\[([ xX])\]\s+(.+)$/);
        }
        
        if (taskMatch) {
          // Calculate indentation - count spaces and tabs (tabs = 2 spaces)
          const indentStr = taskMatch[1];
          let indent = 0;
          for (let k = 0; k < indentStr.length; k++) {
            if (indentStr[k] === '\t') {
              indent += 2; // Treat tab as 2 spaces
            } else if (indentStr[k] === ' ') {
              indent += 1;
            }
          }
          const isCompleted = taskMatch[2].toLowerCase() === 'x';
          const taskText = taskMatch[3].trim();
          tasks.push({
            id: index++,
            text: taskText,
            completed: isCompleted,
            line:  i,
            originalLine: line,
            indent: indent,
            parentIndex: null as number | null,
            children: [] as number[],
            exp: 10 // Default exp for each task
          });
        }
      }
      
      // Second pass: establish parent-child relationships based on indentation
      for (let i = 0; i < tasks.length; i++) {
        const currentTask = tasks[i];
        // Look backwards to find the most recent task with less indentation
        for (let j = i - 1; j >= 0; j--) {
          const prevTask = tasks[j];
          // Check if previous task has less indentation (is a parent)
          // Also handle tabs - treat tab as 2 spaces for comparison
          const prevIndent = prevTask.indent || 0;
          const currentIndent = currentTask.indent || 0;
          if (prevIndent < currentIndent) {
            // Found parent
            currentTask.parentIndex = j;
            if (!prevTask.children) prevTask.children = [];
            prevTask.children.push(i);
            break;
          }
        }
      }
      
      // If we have tasks from API, merge the originalTask data
      if (tasksFromAPI.length > 0) {
        // Match tasks by line number and merge originalTask
        for (let i = 0; i < tasks.length; i++) {
          const manualTask = tasks[i];
          const apiTask = tasksFromAPI.find((t: any) => t.line === manualTask.line);
          if (apiTask && apiTask.originalTask) {
            manualTask.originalTask = apiTask.originalTask;
            // Also update completion status from API if it differs
            if (apiTask.completed !== undefined) {
              manualTask.completed = apiTask.completed;
            }
          }
        }
      }
      
      // Ensure all tasks have exp (default 10)
      for (const task of tasks) {
        if (task.exp === undefined) {
          task.exp = 10;
        }
      }
      return tasks;
    } catch (e) {
      return [];
    }
  }






  

  // Cache for tasks per node
  _tasksCache: Map<number, any[]> = new Map();
  _fileWatchers: Map<number, any> = new Map(); // Store file watchers per node
  _taskPositions: Map<number, Array<{ taskIndex: number; x: number; y: number; radius: number }>> = new Map(); // Store task positions for click detection
  
  getNodeHit(e: any) : SkillNode {
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const w = this.screenToWorld(sx, sy);
    return this.getNodeAtWorld(w.x, w.y);
  }

  // Get tasks for a node (with caching)
  async getNodeTasks(node: SkillNode): Promise<any[]> {
    if (!node.fileLink) return [];
    
    // Always reload tasks (don't use cache for now, to ensure fresh data)
    const tasks = await this.getTasksFromFile(node.fileLink);
    // Store file path in each task for updating
    tasks.forEach((task: any) => {
      task.filePath = node.fileLink;
    });
              this._tasksCache.set(node.id, tasks);
    
    // Update node state based on task completion
    this.updateNodeStateFromTasks(node);
    
    // Set up file watcher if not already set
    if (!this._fileWatchers.has(node.id)) {
      try {
        // Normalize path for watcher
        let watchPath = node.fileLink.trim();
        if (!watchPath.endsWith('.md')) {
          watchPath = watchPath + '.md';
        }
        
        const file = this.app.vault.getAbstractFileByPath(watchPath);
        if (file && file instanceof TFile) {
          // Watch for file changes
          const watcher = this.app.vault.on('modify', async (changedFile) => {
            if (changedFile instanceof TFile && (changedFile.path === watchPath || changedFile.path === node.fileLink)) {
              // Reload tasks when file changes
              const newTasks = await this.getTasksFromFile(node.fileLink);
              newTasks.forEach((task: any) => {
                task.filePath = node.fileLink;
              });
              this._tasksCache.set(node.id, newTasks);
              // Update node state based on task completion
              this.updateNodeStateFromTasks(node);
              this.render();
            }
          });
          this._fileWatchers.set(node.id, watcher);
        }
      } catch (e) {
        // Error setting up file watcher
      }
    }
    
    return tasks;
  }
  
  // Check if all tasks for a node are complete and update node state accordingly
  updateNodeStateFromTasks(node: SkillNode) {
    const tasks = this._tasksCache.get(node.id) || [];
    if (tasks.length === 0) {
      // No tasks - node state is managed by connection rules
      return;
    }
    
    // Check if all tasks are complete
    const allTasksComplete = tasks.length > 0 && tasks.every((task: any) => task.completed);
    
    if (allTasksComplete) {
      // All tasks are complete - set node to complete (even if orphaned)
      if (node.state !== 'complete') {
        node.state = 'complete';
        // Apply connection rules to update parent states
        this.applyConnectionStateRules();
        this.saveNodes().catch(() => {});
        this.render(); // Update exp display
      }
    }
    // If not all tasks are complete, let connection rules handle the state
  }
  
  // Toggle task completion in file using Tasks API if available
  async toggleTaskCompletion(node: SkillNode, taskIndex: number) {
    if (!node.fileLink) return;
    
    const tasks = this._tasksCache.get(node.id) || [];
    if (taskIndex < 0 || taskIndex >= tasks.length) return;
    
    const task = tasks[taskIndex];
    if (!task.filePath || task.line === undefined) return;
    
    try {
      // Normalize path
      let filePath = task.filePath.trim();
      if (!filePath.endsWith('.md')) {
        filePath = filePath + '.md';
      }
      
      const file = this.app.vault.getAbstractFileByPath(filePath);
      if (!file || !(file instanceof TFile)) return;
      
      // Try to use Tasks plugin API if available
      if (this.isTasksPluginInstalled()) {
        const tasksPlugin = this.getTasksPlugin();
        if (tasksPlugin && tasksPlugin.api) {
          // Method 1: Try toggleTask if available
          if (task.originalTask && typeof tasksPlugin.api.toggleTask === 'function') {
            try {
              await tasksPlugin.api.toggleTask(task.originalTask);
              // Reload tasks after modification
              const newTasks = await this.getTasksFromFile(node.fileLink);
              newTasks.forEach((t: any) => {
                t.filePath = node.fileLink;
              });
              this._tasksCache.set(node.id, newTasks);
              this.updateNodeStateFromTasks(node);
              this.render();
              return;
            } catch (e) {
              // Fallback to next method
            }
          }
          // Method 2: Try to toggle via task status property
          if (task.originalTask && task.originalTask.status !== undefined) {
            try {
              const newStatus = task.originalTask.status === 'x' ? ' ' : 'x';
              task.originalTask.status = newStatus;
              // Try updateTask if available
              if (typeof tasksPlugin.api.updateTask === 'function') {
                await tasksPlugin.api.updateTask(task.originalTask);
              } else if (typeof tasksPlugin.api.replaceTaskWithTasks === 'function') {
                // Some APIs use replaceTaskWithTasks
                await tasksPlugin.api.replaceTaskWithTasks(task.originalTask, [task.originalTask]);
              }
              // Reload tasks after modification
              const newTasks = await this.getTasksFromFile(node.fileLink);
              newTasks.forEach((t: any) => {
                t.filePath = node.fileLink;
              });
              this._tasksCache.set(node.id, newTasks);
              this.updateNodeStateFromTasks(node);
              this.render();
              return;
            } catch (e) {
              // Fallback to manual toggle
            }
          }
        }
      }
      
      // Fallback: manual toggle
      const content = await this.app.vault.read(file);
      const lines = content.split('\n');
      
      if (task.line >= 0 && task.line < lines.length) {
        const line = lines[task.line];
        // Toggle the checkbox: [ ] -> [x] or [x] -> [ ]
        const newLine = line.replace(/\[([ x])\]/i, (match, status) => {
          return status.toLowerCase() === 'x' ? '[ ]' : '[x]';
        });
        
        if (newLine !== line) {
          lines[task.line] = newLine;
          await this.app.vault.modify(file, lines.join('\n'));
          
          // Reload tasks after modification
          const newTasks = await this.getTasksFromFile(node.fileLink);
          newTasks.forEach((t: any) => {
            t.filePath = node.fileLink;
          });
          this._tasksCache.set(node.id, newTasks);
          // Update node state based on task completion
          this.updateNodeStateFromTasks(node);
          this.render();
        }
      }
    } catch (e) {
      // Error toggling task completion
    }
  }

  async onOpen(): Promise<void> {
    this.containerEl.empty();
    const toolbar = this.containerEl.createEl('div', { cls: 'skill-tree-toolbar' });
    const undoBtn = toolbar.createEl('button', { text: 'Undo' });
    undoBtn.onclick = () => { this.undo(); };
    const redoBtn = toolbar.createEl('button', { text: 'Redo' });
    redoBtn.onclick = () => { this.redo(); };
    const addBtn = toolbar.createEl('button', { text: 'Add Node' });
    addBtn.onclick = async () => {
      this.recordSnapshot();
      // Add node at the center of the current view
      if (this.canvas) {
        const rect = this.canvas.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const worldPos = this.screenToWorld(centerX, centerY);
        this.addNode(worldPos.x, worldPos.y, this.settings.defaultLabel || 'New Skill');
      } else {
        this.addNode(200, 150, this.settings.defaultLabel || 'New Skill');
      }
      await this.saveNodes();
      this.render();
    };
    const handlesLabel = toolbar.createEl('label', { cls: 'skill-tree-handle-toggle' });
    handlesLabel.style.marginLeft = '8px';
    const handlesCheckbox = handlesLabel.createEl('input') as HTMLInputElement;
    handlesCheckbox.type = 'checkbox';
    handlesCheckbox.checked = !!this.settings.showHandles;
    handlesCheckbox.onchange = async () => {
      this.plugin.settings.showHandles = handlesCheckbox.checked;
      await this.plugin.saveSettings();
      this.render();
    };
    handlesLabel.createEl('span', { text: ' Show Handles' });
    const bezierLabel = toolbar.createEl('label', { cls: 'skill-tree-bezier-toggle' });
    bezierLabel.style.marginLeft = '8px';
    const bezierCheckbox = bezierLabel.createEl('input') as HTMLInputElement;
    bezierCheckbox.type = 'checkbox';
    bezierCheckbox.checked = !!this.settings.showBezier;
    bezierCheckbox.onchange = async () => {
      this.plugin.settings.showBezier = bezierCheckbox.checked;
      await this.plugin.saveSettings();
      this.render();
    };
    bezierLabel.createEl('span', { text: ' Bezier Edges' });
    const expFormatLabel = toolbar.createEl('label', { cls: 'skill-tree-exp-format-toggle' });
    expFormatLabel.style.marginLeft = '8px';
    const expFormatCheckbox = expFormatLabel.createEl('input') as HTMLInputElement;
    expFormatCheckbox.type = 'checkbox';
    expFormatCheckbox.checked = !!this.settings.showExpAsFraction;
    expFormatCheckbox.onchange = async () => {
      this.plugin.settings.showExpAsFraction = expFormatCheckbox.checked;
      await this.plugin.saveSettings();
      this.render();
    };
    expFormatLabel.createEl('span', { text: ' Show EXP as Fraction' });
    
    // Tree selector
    const treeSelectLabel = toolbar.createEl('label', { text: 'Tree: ' });
    treeSelectLabel.style.marginLeft = '8px';
    const treeSelect = toolbar.createEl('select') as HTMLSelectElement;
    treeSelect.style.marginLeft = '4px';
    treeSelect.style.padding = '4px';
    this.updateTreeSelector(treeSelect);
    treeSelect.onchange = async () => {
      await this.switchTree(treeSelect.value);
      this.updateTreeSelector(treeSelect);
      this.render();
    };
    
    const newTreeBtn = toolbar.createEl('button', { text: 'New Tree' });
    newTreeBtn.onclick = async () => {
      const name = prompt('butts Enter tree name:');
      if (name && name.trim()) {
        await this.createTree(name.trim());
        this.updateTreeSelector(treeSelect);
        treeSelect.value = name.trim();
        await this.switchTree(name.trim());
        this.render();
      }
    };
    
    const deleteTreeBtn = toolbar.createEl('button', { text: 'Delete Tree' });
    deleteTreeBtn.onclick = async () => {
      if (Object.keys(this.settings.trees).length <= 1) {
        alert('Cannot delete the last tree. Create a new tree first.');
        return;
      }
      if (confirm(`Delete tree "${this.settings.currentTreeName}"?`)) {
        await this.deleteTree(this.settings.currentTreeName);
        const firstTree = Object.keys(this.settings.trees)[0];
        await this.switchTree(firstTree);
        this.updateTreeSelector(treeSelect);
        this.render();
      }
    };
    
    const importBtn = toolbar.createEl('button', { text: 'Import JSON' });
    importBtn.onclick = async () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          const text = await file.text();
          try {
            const data = JSON.parse(text);
            await this.importTree(data);
            this.updateTreeSelector(treeSelect);
            this.render();
            alert('Tree imported successfully!');
          } catch (err) {
            alert('Failed to import tree: Invalid JSON');
          }
        }
      };
      input.click();
    };
    
    const exportBtn = toolbar.createEl('button', { text: 'Export JSON' });
    exportBtn.onclick = () => {
      const data = this.exportTree();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${this.settings.currentTreeName || 'skill-tree'}.json`;
      a.click();
      URL.revokeObjectURL(url);
    };
    
    const recenterBtn = toolbar.createEl('button', { text: 'Recenter' });
    recenterBtn.onclick = () => {
      this.recenterView();
    };

    // Set container to use flexbox so canvas can fill remaining space
    this.containerEl.style.display = 'flex';
    this.containerEl.style.flexDirection = 'column';
    this.containerEl.style.height = '100%';
    
    this.canvasWrap = this.containerEl.createEl('div', { cls: 'skill-tree-canvas-wrap' });
    this.canvasWrap.style.width = '100%';
    this.canvasWrap.style.flex = '1';
    this.canvasWrap.style.minHeight = '400px';
    this.canvasWrap.style.overflow = 'hidden';
    this.canvas = this.canvasWrap!.createEl('canvas') as HTMLCanvasElement;
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.context = this.canvas.getContext('2d');
    if (!this.context) {
      // Failed to get canvas context
      return;
    }

    if (window.ResizeObserver) {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.canvasWrap!);
    } else {
      window.addEventListener('resize', () => this.resize());
    }

    // keyboard shortcuts for undo/redo and delete
    this._keyHandler = (e: KeyboardEvent) => {
      // Don't intercept keys if user is typing in an input field
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) {
        return; // Let the input handle the key
      }
      
      const z = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z';
      const y = (e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'));
      const deleteKey = e.key === 'Delete' || e.key === 'Backspace';
      
      if (z) { e.preventDefault(); this.undo(); }
      if (y) { e.preventDefault(); this.redo(); }
      
      // Delete selected node
      if (deleteKey && this.selectedNodeId !== null) {
        e.preventDefault();
        const nodeToDelete = this.nodes.find((n) => n.id === this.selectedNodeId);
        if (nodeToDelete) {
          this.deleteNode(nodeToDelete, false); // false = don't show confirmation
        }
      }
    };
    window.addEventListener('keydown', this._keyHandler as any);

    let isPanning = false;
    let edgesChanged = false;

    this.canvas.addEventListener('click', async (e) => {
      if (!this.canvas) return;
      let hit = this.getNodeHit(e)
      
      if (hit) {
        this.selectedNodeId = hit.id;
        console.log("opening stats")
        this.openNodeStats(hit)
      }
    })

    // double click: open file if node has fileLink, otherwise open editor, or add node if empty
    this.canvas.addEventListener('dblclick', async (e) => {
      if (!this.canvas) return;
      const rect = this.canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const w = this.screenToWorld(sx, sy);
      const hit = this.getNodeAtWorld(w.x, w.y);
      if (hit) {
        // If node has a file link, open it instead of the editor
        if (hit.fileLink) {
          try {
            await this.app.workspace.openLinkText(hit.fileLink, '', false);
          } catch (e) {
            // Failed to open file link
            // If opening fails, fall back to opening the editor
            this.openNodeEditor(hit);
          }
        } else {
          // No file link, open the editor
          this.openNodeEditor(hit);
        }
      } else {
        this.addNode(w.x, w.y, this.settings.defaultLabel || 'New');
        this.saveNodes().catch(() => {});
        this.render();
      }
    });

    // right-click on a node should open the editor modal
    this.canvas.addEventListener('contextmenu', (e) => {
      if (!this.canvas) return;
      const rect = this.canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const w = this.screenToWorld(sx, sy);
      const hit = this.getNodeAtWorld(w.x, w.y);
      if (hit) {
        e.preventDefault();
        this.selectedNodeId = hit.id;
        this.openNodeEditor(hit);
      } else {
        this.selectedNodeId = null;
        this.selectedTask = null;
      }
    });

    // basic mouse interactions: dragging nodes, creating edges with Shift, panning
    this.canvas.addEventListener('mousedown', async (e) => {
      if (!this.canvas) return;
      const rect = this.canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const w = this.screenToWorld(sx, sy);

      // clear selection only for left-click; middle/right (panning) keep selection
      // But don't clear if clicking on a task node

      if (e.button === 0) {
        const taskHit = this.getTaskNodeAtWorld(w.x, w.y);
        if (!taskHit) {
          this.selectedNodeId = null;
          this.selectedTask = null;
        }
      }
      if (e.button === 1 || e.button === 2) {
        isPanning = true;
        return;
      }

      // check task checkbox first (if a task is selected)
      const taskCheckboxHit = this.getTaskCheckboxAtWorld(w.x, w.y);
      if (taskCheckboxHit) {
        // Will handle toggle in mouseup - don't set _dragStart to prevent node dragging
        return;
      }

      // check task nodes first (before other checks)
      const taskHit = this.getTaskNodeAtWorld(w.x, w.y);
      if (taskHit) {
        // Select the task (don't move the parent node)
        this.selectedTask = { nodeId: taskHit.node.id, taskIndex: taskHit.taskIndex };
        // Don't set _dragStart - we don't want to allow dragging the parent node when clicking tasks
        this.render(); // Update display to show expanded task
        return;
      }
      
      // check edge endpoints first
      const edgeHit = this.getEdgeEndpointAtWorld(w.x, w.y);
      if (edgeHit) {
        this.draggingEdgeEndpoint = { edgeId: edgeHit.edge.id, which: edgeHit.which };
        this._edgeDragActive = false;
        this._edgeDragStart = { x: e.clientX, y: e.clientY };
        this.tempEdgeTarget = { x: edgeHit.ex, y: edgeHit.ey };
        this.recordSnapshot();
        return;
      }

      // if not clicking directly on an endpoint, allow clicking near the edge body
      const edgeBody = this.getEdgeAtWorld(w.x, w.y, 12);
      if (edgeBody) {
        this.draggingEdgeEndpoint = { edgeId: edgeBody.edge.id, which: edgeBody.which };
        this._edgeDragActive = false;
        this._edgeDragStart = { x: e.clientX, y: e.clientY };
        this.tempEdgeTarget = { x: edgeBody.ex, y: edgeBody.ey };
        this.recordSnapshot();
        return;
      }

      // check checkbox clicks first
      const checkboxHit = this.getCheckboxAtWorld(w.x, w.y);
      if (checkboxHit) {
        this.recordSnapshot();
        checkboxHit.node.state = 'complete';
        this.applyConnectionStateRules(); // Update parent states when child becomes complete
        await this.saveNodes();
        this.render();
        return;
      }

      // check handles next
      const h = this.getNodeHandleAtWorld(w.x, w.y);
      if (h) {
        this.selectedNodeId = h.node.id;
        this.creatingEdgeFrom = h.node;
        this.creatingEdgeFromSide = h.side;
        this.tempEdgeTarget = { x: h.hx, y: h.hy };
        this.recordSnapshot();
        return;
      }

      const hit = this.getNodeAtWorld(w.x, w.y);
      if (hit) {
        this.selectedNodeId = hit.id;
        this.selectedTask = null; // Clear task selection when clicking on a node
        if (e.shiftKey) {
          this.recordSnapshot();
          this.creatingEdgeFrom = hit;
          this.tempEdgeTarget = { x: w.x, y: w.y };
        } else {
          this.recordSnapshot();
          this._dragStart = { nodeId: hit.id, x: hit.x, y: hit.y };
          this._dragStartScreen = { x: e.clientX, y: e.clientY };
          this._dragging = false;
        }
      }
    });

    window.addEventListener('mouseup', async (e) => {
      if (!this.canvas) return;
      const rect = this.canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const w = this.screenToWorld(sx, sy);
      if (this._dragStart) {
        const start = this._dragStart;
        const node = this.nodes.find((n) => n.id === start.nodeId);
        if (node) {
          if (node.x !== start.x || node.y !== start.y) {
            // Node was dragged
            await this.saveNodes();
          }
          // File link opening is now handled after all other handlers
        }
      }
      // finish dragging an edge endpoint
      if (this.draggingEdgeEndpoint) {
        const de = this.draggingEdgeEndpoint;
        const edge = this.edges.find((ee) => ee.id === de.edgeId);
        if (edge) {
          const targetHandle = this.findHandleNear(w.x, w.y, 18);
          // Helper to check if a node became orphaned and set it to unavailable
          const checkOrphanedNode = (nodeId: number | null) => {
            if (nodeId == null) return;
            const remainingParents = this.edges.filter((ee) => ee.to === nodeId).length;
            const remainingChildren = this.edges.filter((ee) => ee.from === nodeId).length;
            if (remainingParents === 0 && remainingChildren === 0) {
                      const node = this.nodes.find((n) => n.id === nodeId);
                      if (node) {
                        node.state = 'unavailable';
                      }
            }
          };

          if (targetHandle) {
              const otherNodeId = de.which === 'from' ? edge.to : edge.from;
              // Save the original node ID before changing the edge
              const originalNodeId = de.which === 'from' ? edge.from : edge.to;
              // prevent self-loops and duplicate edges
              if (targetHandle.node.id !== otherNodeId && !this.edges.some((ee) => ee.id !== edge.id && ee.from === (de.which === 'from' ? targetHandle.node.id : otherNodeId) && ee.to === (de.which === 'from' ? otherNodeId : targetHandle.node.id))) {
                this.recordSnapshot();
                if (de.which === 'from') { edge.from = targetHandle.node.id; edge.fromSide = targetHandle.side; }
                else { edge.to = targetHandle.node.id; edge.toSide = targetHandle.side; }
                // Check if the original node is now orphaned
                checkOrphanedNode(originalNodeId as number);
                edgesChanged = true;
                this.applyConnectionStateRules();
                await this.saveNodes();
              }
          } else {
            const nodeTarget = this.getNodeAtWorld(w.x, w.y);
              if (nodeTarget) {
                const otherNodeId = de.which === 'from' ? edge.to : edge.from;
                // Save the original node ID before changing the edge
                const originalNodeId = de.which === 'from' ? edge.from : edge.to;
                // prevent self-loops and duplicate edges
                if (nodeTarget.id !== otherNodeId && !this.edges.some((ee) => ee.id !== edge.id && ee.from === (de.which === 'from' ? nodeTarget.id : otherNodeId) && ee.to === (de.which === 'from' ? otherNodeId : nodeTarget.id))) {
                  this.recordSnapshot();
                  const otherNode = de.which === 'from' ? this.nodes.find((n)=>n.id===edge.to) : this.nodes.find((n)=>n.id===edge.from);
                  if (de.which === 'from') {
                    edge.from = nodeTarget.id;
                    if (otherNode) edge.fromSide = this.getSideBetween(nodeTarget, otherNode);
                    else delete edge.fromSide;
                  } else {
                    edge.to = nodeTarget.id;
                    if (otherNode) edge.toSide = this.getSideBetween(nodeTarget, otherNode);
                    else delete edge.toSide;
                  }
                  // Check if the original node is now orphaned
                  checkOrphanedNode(originalNodeId as number);
                  edgesChanged = true;
                  this.applyConnectionStateRules();
                  await this.saveNodes();
                }
            } else {
              // dropped on empty -> delete edge
                this.recordSnapshot();
                // determine nodes that will become orphaned after deletion
                const fromId = edge.from as number | null;
                const toId = edge.to as number | null;
                // remove the edge
                this.edges = this.edges.filter((ee) => ee.id !== edge.id);
                edgesChanged = true;
                try {
                  // Check both nodes: if orphaned (no parents AND no children), set to unavailable
                  // If a node has children, don't change its state
                  // IMPORTANT: Set state directly here to ensure orphaned nodes become unavailable
                  // even if they were previously 'complete'
                  const checkNode = (nodeId: number | null) => {
                    if (nodeId == null) return;
                    const remainingParents = this.edges.filter((ee) => ee.to === nodeId).length;
                    const remainingChildren = this.edges.filter((ee) => ee.from === nodeId).length;
                    // Only set to unavailable if truly orphaned (no parents AND no children)
                    // If it has children, don't change its state
                    if (remainingParents === 0 && remainingChildren === 0) {
                      const node = this.nodes.find((n) => n.id === nodeId);
                      if (node) {
                        // Force set to unavailable regardless of previous state (even if 'complete')
                        node.state = 'unavailable';
                      }
                    }
                  };
                  checkNode(fromId);
                  checkNode(toId);
                } catch (e) {}
                this.applyConnectionStateRules();
                await this.saveNodes();
            }
          }
        }
      }
      if (this.creatingEdgeFrom && this.tempEdgeTarget) {
        const targetHandle = this.findHandleNear(this.tempEdgeTarget.x, this.tempEdgeTarget.y, 18);
        const targetNode = this.getNodeAtWorld(this.tempEdgeTarget.x, this.tempEdgeTarget.y);
        if (targetNode && targetNode.id !== this.creatingEdgeFrom.id) {
          // check for duplicate edge
          const duplicate = this.edges.some((ee) => ee.from === this.creatingEdgeFrom!.id && ee.to === targetNode.id);
          if (!duplicate) {
            this.recordSnapshot();
            const newEdge: SkillEdge = { id: Date.now() + Math.random(), from: this.creatingEdgeFrom.id, to: targetNode.id };
            // prefer explicit starting side, otherwise compute side from geometry
            if (this.creatingEdgeFromSide) newEdge.fromSide = this.creatingEdgeFromSide;
            else newEdge.fromSide = this.getSideBetween(this.creatingEdgeFrom, targetNode);
            // prefer snapping to target handle, otherwise compute side
            if (targetHandle) newEdge.toSide = targetHandle.side;
            else newEdge.toSide = this.getSideBetween(targetNode, this.creatingEdgeFrom);
            this.edges.push(newEdge);
            edgesChanged = true;
          }
        }
      }
      // Check for task checkbox clicks first (check regardless of _dragStart)
      const taskCheckboxHit = this.getTaskCheckboxAtWorld(w.x, w.y);
      if (taskCheckboxHit) {
        // Toggle task completion using Tasks API
        await this.toggleTaskCompletion(taskCheckboxHit.node, taskCheckboxHit.taskIndex);
        return; // Don't process other clicks
      }
      
      // Check for task node clicks (but not if clicking on checkbox)
      const taskHit = this.getTaskNodeAtWorld(w.x, w.y);
      if (taskHit) {
        // Just select the task, don't toggle (toggle is done via checkbox)
        // Selection is already handled in mousedown, but we need to ensure it's set here too
        this.selectedTask = { nodeId: taskHit.node.id, taskIndex: taskHit.taskIndex };
        this.render();
        return; // Don't process other clicks
      }
      
      // Check for file link clicks before clearing drag state
      if (this._dragStart && !this._dragging) {
        const start = this._dragStart;
        const node = this.nodes.find((n) => n.id === start.nodeId);
        if (node && node.fileLink && node.x === start.x && node.y === start.y) {
          // Node was clicked (not dragged) and has a file link - open it
          try {
            await this.app.workspace.openLinkText(node.fileLink, '', false);
          } catch (e) {
            // Failed to open file link
          }
        }
      }
      
      this._dragStart = null;
      this.creatingEdgeFrom = null;
      this.tempEdgeTarget = null;
      this.draggingEdgeEndpoint = null;
      this._edgeDragActive = false;
      this._edgeDragStart = null;
      isPanning = false;
      // If any edges changed during this mouseup, apply rules, save and render
      try {
        if (edgesChanged) {
          this.applyConnectionStateRules();
          await this.saveNodes();
          this.render();
        } else {
          try { this.saveNodes(); } catch (e) {}
          this.render();
        }
      } catch (e) {}
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.canvas) return;
      if (!isPanning && !this._dragStart && !this.creatingEdgeFrom && !this.draggingEdgeEndpoint) return;
      const rect = this.canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const w = this.screenToWorld(sx, sy);
      if (this._dragStart) {
        const start = this._dragStart;
        const node = this.nodes.find((n) => n.id === start.nodeId);
        if (!node) return;
        if (!this._dragging) {
          if (this._dragStartScreen) {
            const dx = e.clientX - this._dragStartScreen.x;
            const dy = e.clientY - this._dragStartScreen.y;
            if (dx * dx + dy * dy >= 9) this._dragging = true;
            else return;
          }
        }
        if (this._dragging) {
          // Apply collision detection - find a position that doesn't overlap
          const newPos = this.findNonOverlappingPosition(w.x, w.y, node);
          node.x = newPos.x;
          node.y = newPos.y;
          // update connected edge sides immediately so handles stay on closest side
          this.updateConnectedSides(node);
          this.render();
        }
        return;
      }
      if (this.draggingEdgeEndpoint) {
        if (this._edgeDragStart) {
          const dx = e.clientX - this._edgeDragStart.x;
          const dy = e.clientY - this._edgeDragStart.y;
          const dist2 = dx * dx + dy * dy;
          if (!this._edgeDragActive && dist2 >= 9) this._edgeDragActive = true;
        }
        this.tempEdgeTarget = { x: w.x, y: w.y };
        this.render();
        return;
      }
      if (this.creatingEdgeFrom) {
        this.tempEdgeTarget = { x: w.x, y: w.y };
        this.render();
        return;
      }
      if (isPanning) {
        this.offset.x += e.movementX;
        this.offset.y += e.movementY;
        this.render();
      }
    });


    this.canvas.addEventListener('wheel', (e) => {
      if (!this.canvas) return;
      e.preventDefault();

      const rect = this.canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const worldBefore = this.screenToWorld(sx, sy);
      const delta = -e.deltaY * 0.001;
      const factor = 1 + delta;

      this.scale *= factor;
      this.scale = Math.max(0.2, Math.min(3, this.scale));
      this.offset.x = sx - worldBefore.x * this.scale;
      this.offset.y = sy - worldBefore.y * this.scale;
      this.render();
    }, { passive: false });

    await this.loadNodes();
    try { (handlesCheckbox as HTMLInputElement).checked = !!this.settings.showHandles; } catch (e) {}
    if (!this.nodes || this.nodes.length === 0) {
      this.nodes = defaultNodes();
    }

    // Load tasks for all nodes with file links
    await this.loadAllNodeTasks();
    
    // Force initial resize to ensure canvas has size
    this.resize();
    // Ensure canvas is properly sized before first render
    if (this.canvas && (this.canvas.width === 0 || this.canvas.height === 0)) {
      const dpr = window.devicePixelRatio || 1;
      this.canvas.width = Math.floor(800 * dpr);
      this.canvas.height = Math.floor(400 * dpr);
      if (this.context) {
        this.context.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    }
    // Always center on nodes after loading
    if (this.nodes.length > 0) {
      this.recenterView();
    }
    // Always center on nodes after loading
    if (this.nodes.length > 0) {
      this.recenterView();
    }
    this.render();
    // Some layouts may not be measured correctly immediately — run another resize/render
    // on the next frame and shortly after to ensure the canvas has real size.
    window.requestAnimationFrame(() => { this.resize(); this.render(); });
    setTimeout(() => { this.resize(); this.render(); }, 50);
    
    // Start animation loop for pulsing selected node
    this.startAnimationLoop();
  }

  async onClose(): Promise<void> {
    // remove keyboard handler
    try { window.removeEventListener('keydown', this._keyHandler as any); } catch (e) {}
    // Stop animation loop
    this.stopAnimationLoop();
  }

  startAnimationLoop() {
    const animate = (timestamp: number) => {
      this._animationTime = timestamp;
      // Always render to animate orbiting tasks, and pulse selected node if any
      this.render();
      this._animationFrameId = requestAnimationFrame(animate);
    };
    this._animationFrameId = requestAnimationFrame(animate);
  }

  stopAnimationLoop() {
    if (this._animationFrameId !== null) {
      cancelAnimationFrame(this._animationFrameId);
      this._animationFrameId = null;
    }
  }

  // history helpers
  getSnapshot() {
    return {
      nodes: JSON.parse(JSON.stringify(this.nodes)),
      edges: JSON.parse(JSON.stringify(this.edges)),
    };
  }

  applySnapshot(snap: any) {
    this._suppressHistory = true;
    try {
      this.nodes = JSON.parse(JSON.stringify(snap.nodes || []));
      this.edges = JSON.parse(JSON.stringify(snap.edges || []));
      this.computeAllNodeRadii();
      this.render();
    } finally { this._suppressHistory = false; }
  }

  recordSnapshot() {
    if (this._suppressHistory) return;
    try {
      const s = this.getSnapshot();
      this.historyPast.push(s);
      this.historyFuture = [];
      // keep history bounded
      if (this.historyPast.length > 100) this.historyPast.shift();
    } catch (e) {}
  }

  undo() {
    if (this.historyPast.length === 0) return;
    const cur = this.getSnapshot();
    const prev = this.historyPast.pop() as any;
    if (prev) {
      this.historyFuture.push(cur);
      this.applySnapshot(prev);
      try { this.saveNodes(); } catch (e) {}
    }
  }

  redo() {
    if (this.historyFuture.length === 0) return;
    const cur = this.getSnapshot();
    const next = this.historyFuture.pop() as any;
    if (next) {
      this.historyPast.push(cur);
      this.applySnapshot(next);
      try { this.saveNodes(); } catch (e) {}
    }
  }

  resize(): void {
    if (!this.canvas || !this.context || !this.canvasWrap) return;
    const rect = this.canvasWrap.getBoundingClientRect();
    // Ensure minimum size
    const width = Math.max(rect.width || 800, 100);
    const height = Math.max(rect.height || 400, 100);
    const dpr = window.devicePixelRatio || 1;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.canvas.width = Math.max(1, Math.floor(width * dpr));
    this.canvas.height = Math.max(1, Math.floor(height * dpr));
    this.context.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  computeNodeRadius(n: SkillNode): number {
    if (!this.context) return this.settings.nodeRadius;
    try {
      this.context.save();
      // measure text at a stable 14px font in device pixels
      this.context.setTransform(1, 0, 0, 1, 0, 0);
      this.context.font = '14px sans-serif';

      // Wrap label after 4 words per line and append exp to last line
      const exp = n.exp !== undefined ? n.exp : 0;
      const words = (n.label || '').split(/\s+/).filter(Boolean);
      const lines: string[] = [];
      for (let i = 0; i < words.length; i += 4) {
        lines.push(words.slice(i, i + 4).join(' '));
      }
      if (lines.length === 0) lines.push('');
      if (exp > 0 || this.settings.showExpAsFraction) {
        lines[lines.length - 1] = `${lines[lines.length - 1]} (${exp})`.trim();
      }

      // Measure each wrapped line and take the maximum
      let titleMaxWidth = 0;
      for (const ln of lines) {
        titleMaxWidth = Math.max(titleMaxWidth, this.context.measureText(ln).width || 0);
      }

      // Measure file name if present (using smaller font)
      let fileNameWidth = 0;
      if (n.fileLink) {
        const pathParts = n.fileLink.split('/');
        let fileName = pathParts[pathParts.length - 1];
        if (fileName.endsWith('.md')) fileName = fileName.slice(0, -3);
        this.context.font = '12px sans-serif';
        fileNameWidth = this.context.measureText(fileName).width || 0;
        this.context.font = '14px sans-serif'; // Reset
      }

      // Use the wider of the title lines and file name
      const textWidth = Math.max(titleMaxWidth, fileNameWidth);

      this.context.restore();
      const horizontalPadding = 12; // px horizontal padding
      const verticalPadding = 8; // px vertical padding
      const lineHeight = 16; // px at device pixel measurement

      const numLines = lines.length + (n.fileLink ? 1 : 0);
      const textHeight = numLines * lineHeight;

      const desiredScreenRadiusFromWidth = textWidth / 2 + horizontalPadding;
      const desiredScreenRadiusFromHeight = textHeight / 2 + verticalPadding;
      const desiredScreenRadius = Math.max(desiredScreenRadiusFromWidth, desiredScreenRadiusFromHeight);
      const desiredWorldRadius = desiredScreenRadius / Math.max(0.0001, this.scale);
      return Math.max(this.settings.nodeRadius, desiredWorldRadius);
    } catch (e) {
      try { this.context && this.context.restore(); } catch (e2) {}
      return this.settings.nodeRadius;
    }
  }

  computeAllNodeRadii() {
    for (const n of this.nodes) {
      this.nodeRadii[n.id] = this.computeNodeRadius(n);
    }
  }

  /** If a node with the HTML Class .skill-tree-node-modal exists, close it*/
  closeAllModals() {
    if (!this.containerEl) return;
    const nodeModal = this.containerEl.querySelector('.skill-tree-node-modal');
    if (nodeModal) nodeModal.remove();
    // also remove any outside-click listener
    this.removeOutsideClickHandler();
  }

  installOutsideClickHandler(modalEl: HTMLElement) {
    this.removeOutsideClickHandler();
    const listener = (ev: Event) => {
      try {
        const target = ev.target as Node | null;
        if (!target) return;
        if (!modalEl.contains(target)) {
          this.closeAllModals();
          this.removeOutsideClickHandler();
        }
      } catch (e) {}
    };
    this.modalOutsideListener = listener;
    document.addEventListener('pointerdown', listener);
  }

  /** Sets [[modalOutsideListener]] to null if it exists */
  removeOutsideClickHandler() {
    if (this.modalOutsideListener) {
      document.removeEventListener('pointerdown', this.modalOutsideListener);
      this.modalOutsideListener = null;
    }
  }

  addNode(x: number, y: number, label: string) {
    this.nodes.push({ 
      id: Date.now() + Math.random(), 
      x, 
      y, 
      label, 
      state: 'unavailable',
      exp: this.settings.defaultExp || 0
    });
  }

  // Apply connection state rules
  applyConnectionStateRules() {
    // Build lookup maps
    const idToNode = new Map<number, SkillNode>();
    for (const n of this.nodes) idToNode.set(n.id, n);
    
    // Build parent/children maps
    // parentsMap: nodes this node points TO (arrow points to parent)
    // childrenMap: nodes that point TO this node (arrow comes from children)
    const parentsMap = new Map<number, SkillNode[]>();
    const childrenMap = new Map<number, SkillNode[]>();
    
    for (const ee of this.edges) {
      if (ee.from != null && ee.to != null) {
        const fromNode = idToNode.get(ee.from as number);
        const toNode = idToNode.get(ee.to as number);
        if (fromNode && toNode) {
          // toNode is the parent (arrow points to it)
          const children = childrenMap.get(ee.to as number) || [];
          children.push(fromNode);
          childrenMap.set(ee.to as number, children);
          
          // fromNode is the child (has parent toNode)
          const parents = parentsMap.get(ee.from as number) || [];
          parents.push(toNode);
          parentsMap.set(ee.from as number, parents);
        }
      }
    }
    
    // Rule 1: If a node is orphaned (disconnected), set it to unavailable
    // BUT: Allow orphaned nodes to be complete if all tasks are complete
    // Rule 2: If a node was disconnected and had children, don't change the state
    for (const n of this.nodes) {
      const hasAnyConnection = this.edges.some((ee) => ee.from === n.id || ee.to === n.id);
      const children = childrenMap.get(n.id) || [];
      const tasks = this._tasksCache.get(n.id) || [];
      const hasTasks = tasks.length > 0;
      const allTasksComplete = hasTasks && tasks.every((task: any) => task.completed);
      
      if (!hasAnyConnection) {
        // Node is disconnected
        if (children.length === 0) {
          // Truly orphaned
          if (allTasksComplete) {
            // All tasks complete - set to complete (even if orphaned)
            n.state = 'complete';
          } else if (n.state !== 'complete') {
            // Not all tasks complete and not already complete - set to unavailable
            n.state = 'unavailable';
          }
          // If already complete, keep it complete
        }
        // If it had children, don't change the state (Rule 2)
      }
    }
    
    // Rule 3: When connecting a node, make all parents (traversing up the tree) unavailable
    // Also set child nodes to in-progress when they have parents
    // Traverse up from each parent to mark all ancestors as unavailable
    const markAncestorsUnavailable = (nodeId: number, visited: Set<number>) => {
      if (visited.has(nodeId)) return; // Prevent cycles
      visited.add(nodeId);
      
      const node = idToNode.get(nodeId);
      if (node) {
        // Only mark as unavailable if not already complete (preserve complete state)
        // Rule 4 will override if all children are complete
        if (node.state !== 'complete') {
          node.state = 'unavailable';
        }
      }
      
      // Get parents of this node (following arrowheads UP the tree) and mark them too
      const parents = parentsMap.get(nodeId) || [];
      for (const parent of parents) {
        markAncestorsUnavailable(parent.id, visited);
      }
    };
    
    // For each edge, set child to in-progress and mark the parent and all its ancestors as unavailable
    for (const ee of this.edges) {
      if (ee.from != null && ee.to != null) {
        const childNode = idToNode.get(ee.from as number);
        const parentNode = idToNode.get(ee.to as number);
        
        // Set child to in-progress when it has a parent (unless it's already complete)
        if (childNode && childNode.state !== 'complete') {
          childNode.state = 'in-progress';
        }
        
        // Mark parent and all ancestors as unavailable
        if (parentNode) {
          markAncestorsUnavailable(parentNode.id, new Set());
        }
      }
    }
    
    // Rule 4: If a node has children, it should be unavailable until all of its children are complete
    // Apply this AFTER Rule 3 so it can override when all children are complete
    for (const n of this.nodes) {
      const children = childrenMap.get(n.id) || [];
      if (children.length > 0) {
        // Check if all children are complete
        const allChildrenComplete = children.every((child) => child.state === 'complete');
        if (allChildrenComplete) {
          // All children are complete - set parent to in-progress (unless it's already complete)
          // This overrides Rule 3 for nodes where all children are complete
          // IMPORTANT: Preserve complete state - if user set it to complete, keep it complete
          if (n.state !== 'complete') {
            n.state = 'in-progress';
          }
          // If it's already complete, leave it as complete (don't change it)
        } else {
          // Not all children are complete, so this node should be unavailable
          // But preserve complete state if user explicitly set it (though this shouldn't happen)
          if (n.state !== 'complete') {
            n.state = 'unavailable';
          }
        }
      }
    }
  }

  // Render orbiting task nodes around a main node (synchronous, uses cached tasks)
  renderOrbitingTasks(ctx: CanvasRenderingContext2D, node: SkillNode, nodeRadius: number) {
    const tasks = this._tasksCache.get(node.id) || [];
    if (tasks.length === 0) {
      this._taskPositions.delete(node.id);
      return;
    }
    
    // Check if any task from this node is selected - pause orbit if so
    const hasSelectedTask = this.selectedTask && this.selectedTask.nodeId === node.id;
    
    // Filter to only top-level tasks (tasks without parents) for main orbit
    const topLevelTasks = tasks.filter((t: any) => t.parentIndex === null || t.parentIndex === undefined);
    
    // Make task nodes more visible - use a larger radius
    const orbitRadius = nodeRadius * 1.8; // Distance from center of main node
    const baseTaskNodeRadius = Math.max(nodeRadius * 0.15, 8 / this.scale);
    const angleStep = topLevelTasks.length > 0 ? (Math.PI * 2) / topLevelTasks.length : 0; // Distribute top-level tasks evenly around
    
    const taskPositions: Array<{ taskIndex: number; x: number; y: number; radius: number }> = [];
    const parentTaskPositions = new Map<number, { x: number; y: number }>(); // Store parent task positions for drawing connections
    
    // First pass: render top-level tasks
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      // Skip child tasks in first pass
      if (task.parentIndex !== null && task.parentIndex !== undefined) continue;
      // Check if this specific task is selected
      const isTaskSelected = this.selectedTask && this.selectedTask.nodeId === node.id && this.selectedTask.taskIndex === i;
      
      // Calculate orbiting position with animation
      const baseAngle = i * angleStep;
      // Pause orbit when any task from this node is selected
      const orbitSpeed = hasSelectedTask ? 0 : 0.0005;
      const angle = baseAngle + (this._animationTime * orbitSpeed);
      
      const taskX = node.x + Math.cos(angle) * orbitRadius;
      const taskY = node.y + Math.sin(angle) * orbitRadius;
      
      // Expand only the selected task
      const taskNodeRadius = isTaskSelected ? Math.max(nodeRadius * 0.4, 20 / this.scale) : baseTaskNodeRadius;
      
      // Store position for click detection
      taskPositions.push({
        taskIndex: i,
        x: taskX,
        y: taskY,
        radius: taskNodeRadius
      });
      
      // Draw task node as a mini-node (circle with border)
      ctx.save();
      
      // Draw outer circle (border) - theme-aware background
      ctx.beginPath();
      let bgColor = '#fff'; // Default white for light mode
      try {
        const docStyle = getComputedStyle(document.documentElement);
        const bgVar = docStyle.getPropertyValue('--background-primary');
        if (bgVar && bgVar.trim()) {
          bgColor = bgVar.trim();
        }
      } catch (e) {}
      ctx.fillStyle = bgColor;
      ctx.strokeStyle = isTaskSelected ? '#0066cc' : '#333'; // Blue border when selected
      ctx.lineWidth = isTaskSelected ? 3 / this.scale : 2 / this.scale;
      ctx.arc(taskX, taskY, taskNodeRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      // Draw inner circle (status indicator)
      ctx.beginPath();
      if (task.completed) {
        ctx.fillStyle = '#4caf50'; // Green for completed
      } else {
        ctx.fillStyle = '#ff9800'; // Orange for incomplete
      }
      ctx.arc(taskX, taskY, taskNodeRadius * 0.7, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw checkbox or SVG checkmark when task is selected and expanded
      if (isTaskSelected) {
        if (task.completed) {
          // Draw SVG checkmark icon (green circle with white checkmark) when completed
          const iconSize = 18 / this.scale;
          const iconX = taskX - taskNodeRadius * 0.6;
          const iconY = taskY - taskNodeRadius * 0.6;
          
          ctx.save();
          ctx.translate(iconX, iconY);
          // Draw circular background
          ctx.fillStyle = '#4caf50'; // Green background
          ctx.beginPath();
          ctx.arc(iconSize / 2, iconSize / 2, iconSize / 2, 0, Math.PI * 2);
          ctx.fill();
          // Draw white checkmark
          ctx.strokeStyle = '#fff';
          ctx.fillStyle = '#fff';
          ctx.lineWidth = 2.5 / this.scale;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(iconSize * 0.25, iconSize * 0.5);
          ctx.lineTo(iconSize * 0.45, iconSize * 0.7);
          ctx.lineTo(iconSize * 0.75, iconSize * 0.3);
          ctx.stroke();
          ctx.restore();
        } else {
          // Draw checkbox when not completed (clickable)
          const checkboxSize = 16 / this.scale;
          const checkboxX = taskX - taskNodeRadius * 0.6;
          const checkboxY = taskY - taskNodeRadius * 0.6;
          
          // Draw checkbox border
          ctx.beginPath();
          ctx.strokeStyle = '#333';
          ctx.lineWidth = 2 / this.scale;
          ctx.strokeRect(checkboxX, checkboxY, checkboxSize, checkboxSize);
        }
      }
      
      // Draw task text - always show full text, theme-aware
      // Get theme-aware text color - ensure it's readable on task node background
      let textColor = '#000'; // Default to black for light mode
      try {
        const docStyle = getComputedStyle(document.documentElement);
        const textColorVar = docStyle.getPropertyValue('--text-normal');
        const bgVar = docStyle.getPropertyValue('--background-primary') || '';
        
        if (textColorVar && textColorVar.trim()) {
          textColor = textColorVar.trim();
        }
        
        // Detect dark mode and use white text for better contrast on task nodes
        if (bgVar && (bgVar.includes('rgb(2') || bgVar.includes('rgb(1') || 
            bgVar.includes('#1') || bgVar.includes('#2') || bgVar.includes('#0') ||
            bgVar.includes('rgb(3') || bgVar.includes('rgb(4'))) {
          textColor = '#fff'; // White for dark mode
        }
      } catch (e) {
        // Fallback to black if theme detection fails
      }
      
      ctx.fillStyle = textColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const fontSize = isTaskSelected ? Math.max(12 / this.scale, 10) : Math.max(10 / this.scale, 8);
      ctx.font = `${fontSize}px sans-serif`;
      
      const taskText = task.text || '';
      const maxTextWidth = taskNodeRadius * 6; // Wider for full text display
      const textY = taskY + taskNodeRadius + (isTaskSelected ? 8 / this.scale : 4 / this.scale);
      
      // Always show full text with word wrapping
      const words = taskText.split(' ');
      let line = '';
      let yOffset = 0;
      
      // Add text shadow/outline for better visibility
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 2 / this.scale;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      
      for (const word of words) {
        const testLine = line + (line ? ' ' : '') + word;
        const testWidth = ctx.measureText(testLine).width;
        if (testWidth > maxTextWidth && line) {
          ctx.fillText(line, taskX, textY + yOffset);
          line = word;
          yOffset += fontSize + 2;
        } else {
          line = testLine;
        }
      }
      if (line) {
        ctx.fillText(line, taskX, textY + yOffset);
      }
      
      ctx.restore();
      
      ctx.restore();
    }
    
    // Second pass: render child tasks connected to their parents
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      // Only process child tasks
      if (task.parentIndex === null || task.parentIndex === undefined) {
        continue;
      }
      
      const parentPos = parentTaskPositions.get(task.parentIndex);
      if (!parentPos) {
        // Parent position not found for child task
        continue; // Parent not found, skip
      }
      
      // Get parent task info
      const parentTask = tasks[task.parentIndex];
      const parentChildren = parentTask.children || [];
      const childIndex = parentChildren.indexOf(i);
      const totalChildren = parentChildren.length;
      
      // Position child tasks in a smaller orbit around their parent
      const childOrbitRadius = baseTaskNodeRadius * 2.5; // Smaller orbit for children
      const childAngleStep = totalChildren > 1 ? (Math.PI * 2) / totalChildren : 0;
      const childBaseAngle = childIndex * childAngleStep;
      const childAngle = childBaseAngle + (hasSelectedTask ? 0 : this._animationTime * 0.0003); // Slower orbit for children
      
      const childX = parentPos.x + Math.cos(childAngle) * childOrbitRadius;
      const childY = parentPos.y + Math.sin(childAngle) * childOrbitRadius;
      const childRadius = baseTaskNodeRadius * 0.7; // Smaller than parent tasks
      
      // Check if this child task is selected
      const isChildSelected = this.selectedTask && this.selectedTask.nodeId === node.id && this.selectedTask.taskIndex === i;
      const childTaskRadius = isChildSelected ? Math.max(nodeRadius * 0.3, 15 / this.scale) : childRadius;
      
      // Store position for click detection
      taskPositions.push({
        taskIndex: i,
        x: childX,
        y: childY,
        radius: childTaskRadius
      });
      
      // Draw connection line from parent to child
      ctx.save();
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 1 / this.scale;
      ctx.setLineDash([2 / this.scale, 2 / this.scale]);
      ctx.beginPath();
      ctx.moveTo(parentPos.x, parentPos.y);
      ctx.lineTo(childX, childY);
      ctx.stroke();
      ctx.restore();
      
      // Draw child task node
      ctx.save();
      
      // Draw outer circle (border) - theme-aware background
      ctx.beginPath();
      let childBgColor = '#fff'; // Default white for light mode
      try {
        const docStyle = getComputedStyle(document.documentElement);
        const bgVar = docStyle.getPropertyValue('--background-primary');
        if (bgVar && bgVar.trim()) {
          childBgColor = bgVar.trim();
        }
      } catch (e) {}
      ctx.fillStyle = childBgColor;
      ctx.strokeStyle = isChildSelected ? '#0066cc' : '#666';
      ctx.lineWidth = isChildSelected ? 2 / this.scale : 1.5 / this.scale;
      ctx.arc(childX, childY, childTaskRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      // Draw inner circle (status indicator)
      ctx.beginPath();
      if (task.completed) {
        ctx.fillStyle = '#4caf50';
      } else {
        ctx.fillStyle = '#ff9800';
      }
      ctx.arc(childX, childY, childTaskRadius * 0.7, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw task text for child - ensure readable in dark mode
      let textColor = '#000';
      try {
        const docStyle = getComputedStyle(document.documentElement);
        const textColorVar = docStyle.getPropertyValue('--text-normal');
        const bgVar = docStyle.getPropertyValue('--background-primary') || '';
        
        if (textColorVar && textColorVar.trim()) {
          textColor = textColorVar.trim();
        }
        
        // Detect dark mode and use white text
        if (bgVar && (bgVar.includes('rgb(2') || bgVar.includes('rgb(1') || 
            bgVar.includes('#1') || bgVar.includes('#2') || bgVar.includes('#0') ||
            bgVar.includes('rgb(3') || bgVar.includes('rgb(4'))) {
          textColor = '#fff'; // White for dark mode
        }
      } catch (e) {}
      
      ctx.fillStyle = textColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const childFontSize = isChildSelected ? Math.max(10 / this.scale, 8) : Math.max(8 / this.scale, 7);
      ctx.font = `${childFontSize}px sans-serif`;
      
      const childTaskText = task.text || '';
      const childMaxTextWidth = childTaskRadius * 5;
      const childTextY = childY + childTaskRadius + 3 / this.scale;
      
      // Word wrap for child task text
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 1.5 / this.scale;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      
      const childWords = childTaskText.split(' ');
      let childLine = '';
      let childYOffset = 0;
      
      for (const word of childWords) {
        const testLine = childLine + (childLine ? ' ' : '') + word;
        const testWidth = ctx.measureText(testLine).width;
        if (testWidth > childMaxTextWidth && childLine) {
          ctx.fillText(childLine, childX, childTextY + childYOffset);
          childLine = word;
          childYOffset += childFontSize + 1;
        } else {
          childLine = testLine;
        }
      }
      if (childLine) {
        ctx.fillText(childLine, childX, childTextY + childYOffset);
      }
      
      ctx.restore();
      ctx.restore();
    }
    
    // Store task positions for this node
    this._taskPositions.set(node.id, taskPositions);
  }
  
  // Get checkbox or checkmark icon position for a selected task
  getTaskCheckboxAtWorld(x: number, y: number): { node: SkillNode; taskIndex: number } | null {
    if (!this.selectedTask) return null;
    
    const node = this.nodes.find((n) => n.id === this.selectedTask!.nodeId);
    if (!node) return null;
    
    const tasks = this._tasksCache.get(node.id) || [];
    if (this.selectedTask.taskIndex < 0 || this.selectedTask.taskIndex >= tasks.length) return null;
    
    const task = tasks[this.selectedTask.taskIndex];
    const nodeRadius = this.nodeRadii[node.id] || this.settings.nodeRadius;
    
    // Get top-level tasks for orbit calculation
    const topLevelTasks = tasks.filter((t: any) => t.parentIndex === null || t.parentIndex === undefined);
    const angleStep = topLevelTasks.length > 0 ? (Math.PI * 2) / topLevelTasks.length : 0;
    const topLevelIndex = topLevelTasks.findIndex((t: any) => t.id === task.id);
    const baseAngle = topLevelIndex >= 0 ? topLevelIndex * angleStep : 0;
    const angle = baseAngle; // Orbit is paused when selected
    
    const orbitRadius = nodeRadius * 1.8;
    const taskNodeRadius = Math.max(nodeRadius * 0.4, 20 / this.scale);
    
    const taskX = node.x + Math.cos(angle) * orbitRadius;
    const taskY = node.y + Math.sin(angle) * orbitRadius;
    
    // Check both checkbox (if not completed) and checkmark icon (if completed)
    const iconSize = 18 / this.scale;
    const checkboxSize = 16 / this.scale;
    const iconX = taskX - taskNodeRadius * 0.6;
    const iconY = taskY - taskNodeRadius * 0.6;
    
    // Check if click is within checkbox/icon bounds
    if (x >= iconX && x <= iconX + Math.max(iconSize, checkboxSize) && 
        y >= iconY && y <= iconY + Math.max(iconSize, checkboxSize)) {
      return { node, taskIndex: this.selectedTask.taskIndex };
    }
    
    return null;
  }
  
  // Find a non-overlapping position for a node being dragged
  findNonOverlappingPosition(targetX: number, targetY: number, draggingNode: SkillNode): { x: number; y: number } {
    const minMargin = 20; // Minimum margin between nodes
    const draggingRadius = this.nodeRadii[draggingNode.id] || this.settings.nodeRadius;
    
    // Check for collisions with other nodes
    for (const otherNode of this.nodes) {
      if (otherNode.id === draggingNode.id) continue;
      
      const otherRadius = this.nodeRadii[otherNode.id] || this.settings.nodeRadius;
      const minDistance = draggingRadius + otherRadius + minMargin;
      
      const dx = targetX - otherNode.x;
      const dy = targetY - otherNode.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < minDistance) {
        // Collision detected - push the node away
        if (distance < 0.001) {
          // Nodes are exactly on top of each other - move in a random direction
          const angle = Math.random() * Math.PI * 2;
          return {
            x: otherNode.x + Math.cos(angle) * minDistance,
            y: otherNode.y + Math.sin(angle) * minDistance
          };
        } else {
          // Push away from the other node
          const pushAngle = Math.atan2(dy, dx);
          return {
            x: otherNode.x + Math.cos(pushAngle) * minDistance,
            y: otherNode.y + Math.sin(pushAngle) * minDistance
          };
        }
      }
    }
    
    // No collision - return original position
    return { x: targetX, y: targetY };
  }
  
  // Get task node at world coordinates
  getTaskNodeAtWorld(x: number, y: number): { node: SkillNode; taskIndex: number } | null {
    for (const [nodeId, taskPositions] of this._taskPositions.entries()) {
      const node = this.nodes.find((n) => n.id === nodeId);
      if (!node) continue;
      
      for (const taskPos of taskPositions) {
        const dx = x - taskPos.x;
        const dy = y - taskPos.y;
        const dist2 = dx * dx + dy * dy;
        if (dist2 <= taskPos.radius * taskPos.radius) {
          return { node, taskIndex: taskPos.taskIndex };
        }
      }
    }
    return null;
  }
  
  // Load tasks for all nodes with file links (call this periodically or on file changes)
  async loadAllNodeTasks() {
    // Load tasks even if Tasks plugin isn't installed (we can parse manually)
    for (const node of this.nodes) {
      if (node.fileLink) {
        await this.getNodeTasks(node);
      }
    }
  }


/** Updates the 2D Context to display information on the screen */
  render(): void {
    if (!this.context || !this.canvas) return;
    const context = this.context;
 
    // recompute node radii each render (depends on current scale and label widths)
    this.computeAllNodeRadii();

    // clear in device pixels
    context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // draw background in device pixels so it doesn't move with pan/zoom
    context.save();
    try {
      context.setTransform(1, 0, 0, 1, 0, 0);
    } catch (e) {
      /* ignore if not supported */
    }

    // respect Obsidian theme variable for background if available
    let bg = '#e7f5ff';

    try {
      const docStyle = getComputedStyle(document.documentElement);
      const cssBg = docStyle.getPropertyValue('--background-primary');
      if (cssBg && cssBg.trim()) bg = cssBg.trim();
      else if (this.canvas) {
        const cs = getComputedStyle(this.canvas);
        if (cs && cs.backgroundColor) bg = cs.backgroundColor;
      }
    }
    catch (e) { /* ignore */ }

    context.fillStyle = bg;
    context.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw warning banner at top if Tasks plugin is not installed
    if (!this.isTasksPluginInstalled()) {
      context.save();
      context.setTransform(1, 0, 0, 1, 0, 0);
      // Draw warning background
      context.fillStyle = 'rgba(255, 193, 7, 0.9)';
      context.fillRect(0, 0, this.canvas.width, 40);
      // Draw warning text
      context.fillStyle = '#000';
      context.font = '14px sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText('⚠️ Tasks plugin is required but not installed. Please install the Tasks plugin to use all features.', this.canvas.width / 2, 20);
      context.restore();
    }
    // if (!this.isDataviewPluginInstalled()) {
    //   context.save();
    //   context.setTransform(1, 0, 0, 1, 0, 0);
    //   // Draw warning background
    //   context.fillStyle = 'rgba(255, 193, 7, 0.9)'; // Amber/yellow warning color
    //   context.fillRect(0, 40, this.canvas.width, 40);
    //   // Draw warning text
    //   context.fillStyle = '#000';
    //   context.font = '14px sans-serif';
    //   context.textAlign = 'center';
    //   context.textBaseline = 'middle';
    //   context.fillText('⚠️ Dataview plugin is required but not installed. Please install the Tasks plugin to use all features.', this.canvas.width / 2, 20);
    //   context.restore();
    // }
    
    context.restore();

    context.save();
    // apply pan/zoom for world drawing
    context.translate(this.offset.x, this.offset.y);
    context.scale(this.scale, this.scale);

    // draw explicit edges as arrows
    for (const e of this.edges) {
      const a = this.nodes.find((n) => n.id === e.from) || null;
      const b = this.nodes.find((n) => n.id === e.to) || null;
      if (!a || !b) continue;
      const rFrom = this.nodeRadii[a.id] || this.settings.nodeRadius || 36;
      const rTo = this.nodeRadii[b.id] || this.settings.nodeRadius || 36;
      // compute edge endpoints respecting explicit side info
      let sx1 = a.x;
      let sy1 = a.y;
      if (e.fromSide) {
        if (e.fromSide === 'top') { sx1 = a.x; sy1 = a.y - rFrom; }
        if (e.fromSide === 'right') { sx1 = a.x + rFrom; sy1 = a.y; }
        if (e.fromSide === 'bottom') { sx1 = a.x; sy1 = a.y + rFrom; }
        if (e.fromSide === 'left') { sx1 = a.x - rFrom; sy1 = a.y; }
      }
      let sx2 = b.x;
      let sy2 = b.y;
      if (e.toSide) {
        if (e.toSide === 'top') { sx2 = b.x; sy2 = b.y - rTo; }
        if (e.toSide === 'right') { sx2 = b.x + rTo; sy2 = b.y; }
        if (e.toSide === 'bottom') { sx2 = b.x; sy2 = b.y + rTo; }
        if (e.toSide === 'left') { sx2 = b.x - rTo; sy2 = b.y; }
      }
      // if this edge is currently being dragged, override the dragged endpoint with tempEdgeTarget
      if (this.draggingEdgeEndpoint && this.draggingEdgeEndpoint.edgeId === e.id && this.tempEdgeTarget) {
        if (this.draggingEdgeEndpoint.which === 'from') {
          sx1 = this.tempEdgeTarget.x;
          sy1 = this.tempEdgeTarget.y;
        } else {
          sx2 = this.tempEdgeTarget.x;
          sy2 = this.tempEdgeTarget.y;
        }
      }
      // fallback: if sides not set, offset by respective radii along centerline
      if (!e.fromSide || !e.toSide) {
        const dx = sx2 - sx1;
        const dy = sy2 - sy1;
        const d = Math.hypot(dx, dy) || 1;
        if (!e.fromSide) {
          sx1 = a.x + (dx / d) * rFrom;
          sy1 = a.y + (dy / d) * rFrom;
        }
        if (!e.toSide) {
          sx2 = b.x - (dx / d) * rTo;
          sy2 = b.y - (dy / d) * rTo;
        }
      }
      context.save();
      const edgeColor = chooseEdgeColor();
      // compute bezier control points
      const controls = computeBezierControls(sx1, sy1, sx2, sy2, e.fromSide, e.toSide, rFrom, rTo);
      if (this.settings.showBezier) {
        // draw halo for contrast
        context.lineWidth = 6 / this.scale;
        context.strokeStyle = (edgeColor === '#fff' ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.12)');
        drawBezierArrow(context, sx1, sy1, controls.c1x, controls.c1y, controls.c2x, controls.c2y, sx2, sy2, this.scale);
        // draw main edge
        context.lineWidth = 2 / this.scale;
        context.strokeStyle = edgeColor;
        context.fillStyle = edgeColor;
        drawBezierArrow(context, sx1, sy1, controls.c1x, controls.c1y, controls.c2x, controls.c2y, sx2, sy2, this.scale);
      } else {
        // draw halo for contrast (straight)
        context.lineWidth = 6 / this.scale;
        context.strokeStyle = (edgeColor === '#fff' ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.12)');
        drawArrow(context, sx1, sy1, sx2, sy2, this.scale);
        // draw main edge
        context.lineWidth = 2 / this.scale;
        context.strokeStyle = edgeColor;
        context.fillStyle = edgeColor;
        drawArrow(context, sx1, sy1, sx2, sy2, this.scale);
      }
      context.restore();
    }

    for (const n of this.nodes) {
      const r = (this.nodeRadii[n.id] || this.settings.nodeRadius || 36);
      context.beginPath();
      
      // fill/stroke depending on state - use actual state from node object
      const nodeState = n.state || 'in-progress';
      
      if (nodeState === 'complete') {
        context.fillStyle = '#4caf50';
        context.strokeStyle = '#2e7d32';
        
      } else if (nodeState === 'unavailable') {
        // darken / gray-out unavailable nodes by mixing base color with a desaturated gray
        const base = '#2b6';
        const parsed = parseCSSColor(base) || { r: 43, g: 102, b: 102 };
        const gray = { r: 120, g: 120, b: 120 };
        // mix: 40% base, 60% gray
        const mixR = Math.round(parsed.r * 0.4 + gray.r * 0.6);
        const mixG = Math.round(parsed.g * 0.4 + gray.g * 0.6);
        const mixB = Math.round(parsed.b * 0.4 + gray.b * 0.6);
        context.fillStyle = `rgb(${mixR},${mixG},${mixB})`;
        context.strokeStyle = `rgb(${Math.round(mixR * 0.9)},${Math.round(mixG * 0.9)},${Math.round(mixB * 0.9)})`;
      
      } else {
        context.fillStyle = '#2b6';
        context.strokeStyle = '#173';
      }
      context.lineWidth = 4 / this.scale;
      context.arc(n.x, n.y, r, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      // draw selection highlight if this node is selected with pulsing animation
      if (this.selectedNodeId === n.id) {
        // Use sine wave for smooth pulsing (pulse between 6 and 10 pixels extra radius)
        const pulseAmount = 6 + 4 * Math.sin(this._animationTime / 500); // 500ms period
        context.beginPath();
        context.lineWidth = 4 / this.scale;
        context.strokeStyle = 'rgba(255,165,0,0.95)';
        context.arc(n.x, n.y, r + (pulseAmount / this.scale), 0, Math.PI * 2);
        context.stroke();
      }
      // Draw label - make it look clickable if there's a file link
      context.textAlign = 'center';
      context.font = `${14 / this.scale}px sans-serif`;
      
      // Get theme-aware text color
      let labelTextColor = '#000';
      try {
        const docStyle = getComputedStyle(document.documentElement);
        const textVar = docStyle.getPropertyValue('--text-normal');
        if (textVar && textVar.trim()) {
          labelTextColor = textVar.trim();
        }
      } catch (e) {}
      
      // Build wrapped label lines (wrap after 4 words) and append exp to last line
      const exp = n.exp !== undefined ? n.exp : 0;
      const words = (n.label || '').split(/\s+/).filter(Boolean);
      const lines: string[] = [];
      for (let i = 0; i < words.length; i += 4) {
        lines.push(words.slice(i, i + 4).join(' '));
      }
      if (lines.length === 0) lines.push('');
      if (exp > 0 || this.settings.showExpAsFraction) {
        lines[lines.length - 1] = `${lines[lines.length - 1]}`.trim();
      }

      // Extract file name from fileLink if it exists (rendered as its own line)
      let fileName = '';
      if (n.fileLink) {
        const pathParts = n.fileLink.split('/');
        fileName = pathParts[pathParts.length - 1];
        if (fileName.endsWith('.md')) fileName = fileName.slice(0, -3);
      }

      const lineHeight = 16 / this.scale;
      // Start drawing so the block of text is vertically centered around n.y
      const totalLines = lines.length + (fileName ? 1 : 0);
      const firstLineY = n.y - ((totalLines - 1) * lineHeight) / 2;

      // Determine fill style for linked vs plain nodes
      if (n.fileLink) context.fillStyle = '#0066cc';
      else context.fillStyle = labelTextColor;

      // Draw wrapped label lines
      for (let i = 0; i < lines.length; i++) {
        const text = lines[i];
        const y = firstLineY + i * lineHeight;
        context.fillText(text, n.x, y);
        // underline the first line for linked nodes
        if (i === 0 && n.fileLink) {
          const textWidth = context.measureText(text).width;
          context.strokeStyle = '#0066cc';
          context.lineWidth = 1 / this.scale;
          context.beginPath();
          context.moveTo(n.x - textWidth / 2, y + 8 / this.scale);
          context.lineTo(n.x + textWidth / 2, y + 8 / this.scale);
          context.stroke();
        }
      }

      // Draw file name on its own line below wrapped label lines
      if (fileName) {
        context.font = `${12 / this.scale}px sans-serif`;
        context.fillStyle = n.fileLink ? '#0066cc' : labelTextColor;
        const y = firstLineY + lines.length * lineHeight;
        context.fillText(fileName, n.x, y);
        context.font = `${14 / this.scale}px sans-serif`;
      }
      // display checkbox for in-progress nodes (centered below text)
      // BUT: don't show checkbox if node has tasks (tasks have their own checkboxes)
      const actualState = n.state || 'in-progress';
      const nodeTasks = this._tasksCache.get(n.id) || [];
      const hasTasks = nodeTasks.length > 0;
      
      // Calculate the bottom of the text (accounting for wrapped lines and optional file name)
      let textBottomY = firstLineY + (lines.length - 1) * lineHeight;
      if (fileName) textBottomY += lineHeight; // file name occupies another line below
      
      if (actualState === 'in-progress' && !hasTasks) {
        // Draw checkbox centered horizontally, below all text
        const checkboxSize = 12 / this.scale;
        const checkboxX = n.x - checkboxSize / 2;
        const checkboxY = textBottomY + 8 / this.scale; // Below all text with spacing
        
        // Draw checkbox border
        context.strokeStyle = '#000';
        context.lineWidth = 1.5 / this.scale;
        context.strokeRect(checkboxX, checkboxY, checkboxSize, checkboxSize);
        
        // Checkbox is empty (not checked) for in-progress nodes
      } else if (actualState === 'complete') {
        // Draw checked checkbox centered horizontally, below all text
        const checkboxSize = 12 / this.scale;
        const checkboxX = n.x - checkboxSize / 2;
        const checkboxY = textBottomY + 8 / this.scale; // Below all text with spacing
        
        // Draw checkbox border
        context.strokeStyle = '#000';
        context.lineWidth = 1.5 / this.scale;
        context.strokeRect(checkboxX, checkboxY, checkboxSize, checkboxSize);
        
        // Draw checkmark
        context.strokeStyle = '#000';
        context.lineWidth = 2 / this.scale;
        context.beginPath();
        context.moveTo(checkboxX + checkboxSize * 0.2, checkboxY + checkboxSize * 0.5);
        context.lineTo(checkboxX + checkboxSize * 0.45, checkboxY + checkboxSize * 0.75);
        context.lineTo(checkboxX + checkboxSize * 0.8, checkboxY + checkboxSize * 0.25);
        context.stroke();
        
        // Draw SVG checkmark icon in top-right corner
        const iconSize = 18 / this.scale;
        const iconX = n.x + r - iconSize - 4 / this.scale;
        const iconY = n.y - r + 4 / this.scale;
        
        context.save();
        context.translate(iconX, iconY);
        // Draw circular background
        context.fillStyle = '#4caf50'; // Green background
        context.beginPath();
        context.arc(iconSize / 2, iconSize / 2, iconSize / 2, 0, Math.PI * 2);
        context.fill();
        // Draw white checkmark
        context.strokeStyle = '#fff';
        context.fillStyle = '#fff';
        context.lineWidth = 2.5 / this.scale;
        context.lineCap = 'round';
        context.lineJoin = 'round';
        context.beginPath();
        context.moveTo(iconSize * 0.25, iconSize * 0.5);
        context.lineTo(iconSize * 0.45, iconSize * 0.7);
        context.lineTo(iconSize * 0.75, iconSize * 0.3);
        context.stroke();
        context.restore();
      }
      // handles: render per-side unless that specific handle is already used by an explicit edge
      // Show handles if the global setting is enabled or this node is currently selected
      if (this.settings.showHandles || this.selectedNodeId === n.id) {
        const used = new Set<string>();
        for (const ee of this.edges) {
          if (ee.from === n.id && ee.fromSide) used.add(ee.fromSide);
          if (ee.to === n.id && ee.toSide) used.add(ee.toSide);
        }
        const hs = 6 / this.scale;
        context.strokeStyle = '#000';
        context.lineWidth = 1 / this.scale;
        if (!used.has('top')) { context.beginPath(); context.arc(n.x, n.y - r, hs / 2, 0, Math.PI * 2); context.stroke(); }
        if (!used.has('right')) { context.beginPath(); context.arc(n.x + r, n.y, hs / 2, 0, Math.PI * 2); context.stroke(); }
        if (!used.has('bottom')) { context.beginPath(); context.arc(n.x, n.y + r, hs / 2, 0, Math.PI * 2); context.stroke(); }
        if (!used.has('left')) { context.beginPath(); context.arc(n.x - r, n.y, hs / 2, 0, Math.PI * 2); context.stroke(); }
      }
      
      // Draw orbiting task nodes if node has a file link (works even without Tasks plugin)
      if (n.fileLink) {
        this.renderOrbitingTasks(context, n, r);
      }
    }

    // draw temporary edge when creating
    if (this.creatingEdgeFrom && this.tempEdgeTarget) {
      const a = this.creatingEdgeFrom;
      const ax = a.x;
      const ay = a.y;
      const bx = this.tempEdgeTarget.x;
      const by = this.tempEdgeTarget.y;
      const dx = bx - ax;
      const dy = by - ay;
      const d = Math.hypot(dx, dy) || 1;
      const r = this.settings.nodeRadius || 36;
      const sx1 = ax + (dx / d) * r;
      const sy1 = ay + (dy / d) * r;
      context.save();
      context.setLineDash([4 / this.scale, 4 / this.scale]);
      const tempColor = chooseEdgeColor();
      // compute controls for temp edge
      const tempFromSide = this.creatingEdgeFromSide || this.getSideBetween(this.creatingEdgeFrom, { id: -1, x: bx, y: by, label: '' });
      const tempControls = computeBezierControls(sx1, sy1, bx, by, tempFromSide, null, r, 0);
      if (this.settings.showBezier) {
        context.lineWidth = 3 / this.scale;
        context.strokeStyle = (tempColor === '#fff' ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.10)');
        drawBezierArrow(context, sx1, sy1, tempControls.c1x, tempControls.c1y, tempControls.c2x, tempControls.c2y, bx, by, this.scale);
        context.lineWidth = 1 / this.scale;
        context.strokeStyle = tempColor;
        context.fillStyle = tempColor;
        drawBezierArrow(context, sx1, sy1, tempControls.c1x, tempControls.c1y, tempControls.c2x, tempControls.c2y, bx, by, this.scale);
      } else {
        context.lineWidth = 3 / this.scale;
        context.strokeStyle = (tempColor === '#fff' ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.10)');
        drawArrow(context, sx1, sy1, bx, by, this.scale);
        context.lineWidth = 1 / this.scale;
        context.strokeStyle = tempColor;
        context.fillStyle = tempColor;
        drawArrow(context, sx1, sy1, bx, by, this.scale);
      }
      context.restore();
    }

    context.restore();
    
    // Draw exp overlay in upper(?) right corner
    this.renderExpOverlay(context);
  }
  
  








  // Render exp overlay in top right corner (to avoid status bar)
  renderExpOverlay(ctx: CanvasRenderingContext2D) {
    // Calculate total exp from all completed nodes
    let totalExp = 0;
    let totalAvailableExp = 0;
    
    for (const node of this.nodes) {
      const nodeExp = node.exp !== undefined ? node.exp : (this.settings.defaultExp || 0);
      totalAvailableExp += nodeExp;
      
      // Only count exp from completed nodes
      if (node.state === 'complete') {
        totalExp += nodeExp;
      }
    }
    
    // Get theme-aware colors
    let textColor = '#000';
    let bgColor = 'rgba(255, 255, 255, 0.9)';
    try {
      const docStyle = getComputedStyle(document.documentElement);
      const textVar = docStyle.getPropertyValue('--text-normal');
      const bgVar = docStyle.getPropertyValue('--background-primary');
      if (textVar && textVar.trim()) textColor = textVar.trim();
      if (bgVar && bgVar.trim()) {
        // Make background semi-transparent
        bgColor = bgVar.trim();
        // Convert to rgba if needed
        if (bgColor.startsWith('#')) {
          const r = parseInt(bgColor.slice(1, 3), 16);
          const g = parseInt(bgColor.slice(3, 5), 16);
          const b = parseInt(bgColor.slice(5, 7), 16);
          bgColor = `rgba(${r}, ${g}, ${b}, 0.9)`;
        } else if (bgColor.startsWith('rgb')) {
          bgColor = bgColor.replace('rgb', 'rgba').replace(')', ', 0.9)');
        }
      }
    } catch (e) {}
    
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset to device pixels
    
    const padding = 10;
    const fontSize = 14;
    ctx.font = `${fontSize}px sans-serif`;
    
    // Format exp display
    let expText = `Total EXP: ${totalExp}`;
    if (this.settings.showExpAsFraction) {
      // Calculate total available exp from all nodes
      expText = `EXP: ${totalExp} / ${totalAvailableExp}`;
    }
    
    const textMetrics = ctx.measureText(expText);
    const boxWidth = textMetrics.width + padding * 2;
    const boxHeight = fontSize + padding * 2;
    const x = this.canvas!.width - boxWidth - padding;
    const y = padding + 60; // Position below toolbar (60px for toolbar height) to avoid status bar
    
    // Draw background box
    ctx.fillStyle = bgColor;
    ctx.fillRect(x, y, boxWidth, boxHeight);
    ctx.strokeStyle = textColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, boxWidth, boxHeight);
    
    // Draw text
    ctx.fillStyle = textColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(expText, x + padding, y + padding);
    
    ctx.restore();
  }

  screenToWorld(sx: number, sy: number) {
    return { x: (sx - this.offset.x) / this.scale, y: (sy - this.offset.y) / this.scale };
  }

  worldToScreen(wx: number, wy: number) {
    return { x: wx * this.scale + this.offset.x, y: wy * this.scale + this.offset.y };
  }

  recenterView() {
    if (!this.canvas || this.nodes.length === 0) return;
    
    // Calculate bounding box of all nodes
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of this.nodes) {
      const r = this.nodeRadii[n.id] || this.settings.nodeRadius || 36;
      minX = Math.min(minX, n.x - r);
      minY = Math.min(minY, n.y - r);
      maxX = Math.max(maxX, n.x + r);
      maxY = Math.max(maxY, n.y + r);
    }
    
    // Calculate center of bounding box
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    // Get canvas dimensions
    const rect = this.canvas.getBoundingClientRect();
    const canvasCenterX = rect.width / 2;
    const canvasCenterY = rect.height / 2;
    
    // Calculate offset to center the nodes
    this.offset.x = canvasCenterX - centerX * this.scale;
    this.offset.y = canvasCenterY - centerY * this.scale;
    
    // Optionally adjust scale to fit all nodes with padding
    const padding = 40;
    const width = maxX - minX + padding * 2;
    const height = maxY - minY + padding * 2;
    const scaleX = rect.width / width;
    const scaleY = rect.height / height;
    const newScale = Math.min(scaleX, scaleY, 1.5); // Don't zoom in too much, max 1.5x
    
    if (newScale > 0.1 && newScale < 3) {
      // Recalculate offset with new scale
      this.scale = newScale;
      this.offset.x = canvasCenterX - centerX * this.scale;
      this.offset.y = canvasCenterY - centerY * this.scale;
    }
    
    this.render();
  }

  async saveNodes() {
    try {
      // Save current tree data
      const currentTree = this.settings.trees[this.settings.currentTreeName];
      if (currentTree) {
        currentTree.nodes = JSON.parse(JSON.stringify(this.nodes));
        currentTree.edges = JSON.parse(JSON.stringify(this.edges));
      } else {
        // Create tree if it doesn't exist
        this.settings.trees[this.settings.currentTreeName] = {
          name: this.settings.currentTreeName,
          nodes: JSON.parse(JSON.stringify(this.nodes)),
          edges: JSON.parse(JSON.stringify(this.edges))
        };
      }
      await this.plugin.saveSettings();
    } catch (e) {
      // ignore
    }
  }

  async loadNodes() {
    try {
      // Load current tree data from settings
      const currentTree = this.settings.trees[this.settings.currentTreeName];
      if (currentTree) {
        this.nodes = currentTree.nodes || [];
        this.edges = currentTree.edges || [];
      } else {
        // Initialize if tree doesn't exist
        this.nodes = [];
        this.edges = [];
        this.settings.trees[this.settings.currentTreeName] = {
          name: this.settings.currentTreeName,
          nodes: [],
          edges: []
        };
        await this.plugin.saveSettings();
      }
      
      // Legacy support: try loading from old data format if current tree is empty
      if (this.nodes.length === 0) {
        const p: any = this.plugin as any;
        if (p && typeof p.loadData === 'function') {
          const data: any = await p.loadData();
          if (data && Array.isArray(data.nodes) && data.nodes.length > 0) {
            // Migrate old data to new format
            this.nodes = data.nodes;
            this.edges = (data as any).edges || [];
            this.settings.trees[this.settings.currentTreeName] = {
              name: this.settings.currentTreeName,
              nodes: this.nodes,
              edges: this.edges
            };
            await this.plugin.saveSettings();
          }
        }
      }
      
      // Initialize exp for nodes that don't have it
      for (const node of this.nodes) {
        if (node.exp === undefined) {
          node.exp = this.settings.defaultExp || 0;
        }
      }
      
      // migrate edges to ensure fromSide/toSide are set when possible
      try {
        for (const ee of this.edges) {
          const fromNode = this.nodes.find((n) => n.id === ee.from) || null;
          const toNode = this.nodes.find((n) => n.id === ee.to) || null;
          if (fromNode && toNode) {
            if (!ee.fromSide) ee.fromSide = this.getSideBetween(fromNode, toNode);
            if (!ee.toSide) ee.toSide = this.getSideBetween(toNode, fromNode);
          }
        }
      } catch (e) {}
      
      // Settings are now managed by the plugin, not stored with nodes
      // migrate old boolean `completed` to `state` and compute derived states (including Unavailable)
      try {
        for (const n of this.nodes) {
          if ((n as any).completed !== undefined && n.state === undefined) {
            n.state = (n as any).completed ? 'complete' : 'in-progress';
          }
          if (!n.state) n.state = 'in-progress';
        }
        // compute derived states (Unavailable) from children relationships
        const computeOnce = () => {
          let changed = false;
          const idToNode = new Map<number, SkillNode>();
          for (const nd of this.nodes) idToNode.set(nd.id, nd);
          // children are incoming (nodes that point to this node)
          const getChildren = (nid: number) => this.edges.filter((ee) => ee.to === nid && ee.from != null).map((ee) => idToNode.get(ee.from as number)).filter(Boolean) as SkillNode[];
          for (const nd of this.nodes) {
            const children = getChildren(nd.id);
            if (nd.state !== undefined) continue; // preserve explicit persisted state
            if (children.length === 0) {
              nd.state = 'unavailable'; changed = true; continue;
            }
            // treat undefined or non-complete children as blocking
            const anyBad = children.some((c) => !c.state || c.state === 'unavailable' || c.state === 'in-progress');
            if (anyBad) {
              nd.state = 'unavailable'; changed = true;
            } else {
              nd.state = 'in-progress'; changed = true;
            }
          }
          return changed;
        };
        let iter = 0;
        while (computeOnce() && iter++ < 20) {}
      } catch (e) {}
      // Apply connection state rules after loading
      this.applyConnectionStateRules();
    } catch (e) {
      // ignore
    }
  }
  
  updateTreeSelector(select: HTMLSelectElement) {
    select.innerHTML = '';
    for (const treeName of Object.keys(this.settings.trees)) {
      const option = select.createEl('option', { text: treeName });
      option.value = treeName;
      if (treeName === this.settings.currentTreeName) {
        option.selected = true;
      }
    }
  }
  
  async switchTree(treeName: string) {
    // Save current tree
    await this.saveNodes();
    
    // Switch to new tree
    this.settings.currentTreeName = treeName;
    if (!this.settings.trees[treeName]) {
      this.settings.trees[treeName] = {
        name: treeName,
        nodes: [],
        edges: []
      };
    }
    
    // Load new tree
    await this.loadNodes();
    
    // Clean up file watchers for old nodes
    this._fileWatchers.forEach((watcher) => {
      this.app.vault.off('modify', watcher);
    });
    this._fileWatchers.clear();
    this._tasksCache.clear();
    
    // Reload tasks for new tree
    await this.loadAllNodeTasks();
    
    await this.plugin.saveSettings();
    this.render();
  }
  
  async createTree(name: string) {
    if (this.settings.trees[name]) {
      alert('Tree with that name already exists');
      return;
    }
    
    this.settings.trees[name] = {
      name: name,
      nodes: [],
      edges: []
    };
    
    await this.plugin.saveSettings();
  }
  
  async deleteTree(name: string) {
    if (Object.keys(this.settings.trees).length <= 1) {
      alert('Cannot delete the last tree');
      return;
    }
    
    delete this.settings.trees[name];
    
    if (this.settings.currentTreeName === name) {
      // Switch to first available tree
      const firstTree = Object.keys(this.settings.trees)[0];
      await this.switchTree(firstTree);
    }
    
    await this.plugin.saveSettings();
  }
  
  exportTree(): SkillTreeData {
    return {
      name: this.settings.currentTreeName,
      nodes: JSON.parse(JSON.stringify(this.nodes)),
      edges: JSON.parse(JSON.stringify(this.edges))
    };
  }
  
  async importTree(data: SkillTreeData) {
    if (!data || !data.name) {
      alert('Invalid tree data: missing name');
      return;
    }
    
    const treeName = data.name;
    
    // If tree exists, ask to overwrite
    if (this.settings.trees[treeName]) {
      if (!confirm(`Tree "${treeName}" already exists. Overwrite?`)) {
        return;
      }
    }
    
    // Import the tree
    this.settings.trees[treeName] = {
      name: treeName,
      nodes: data.nodes || [],
      edges: data.edges || []
    };
    
    // Switch to imported tree
    await this.switchTree(treeName);
    
    await this.plugin.saveSettings();
  }

  getSideBetween(a: SkillNode, b: SkillNode): 'top'|'right'|'bottom'|'left' {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);
    if (adx > ady) return dx > 0 ? 'right' : 'left';
    return dy > 0 ? 'bottom' : 'top';
  }

  getNeighborNodes(nodeId: number): SkillNode[] {
    const out = new Set<number>();
    for (const ee of this.edges) {
      if (ee.from === nodeId && ee.to != null) out.add(ee.to as number);
      if (ee.to === nodeId && ee.from != null) out.add(ee.from as number);
    }
    return Array.from(out).map((id) => this.nodes.find((n) => n.id === id)).filter(Boolean) as SkillNode[];
  }


  updateConnectedSides(node: SkillNode) {
    for (const ee of this.edges) {
      const fromNode = this.nodes.find((n) => n.id === ee.from) || null;
      const toNode = this.nodes.find((n) => n.id === ee.to) || null;
      if (!fromNode || !toNode) continue;
      if (ee.from === node.id || ee.to === node.id) {
        ee.fromSide = this.getSideBetween(fromNode, toNode);
        ee.toSide = this.getSideBetween(toNode, fromNode);
      }
    }
  }

  getCheckboxAtWorld(x: number, y: number): { node: SkillNode } | null {
    for (const n of this.nodes) {
      const actualState = n.state || 'in-progress';
      // Only checkboxes are clickable for in-progress nodes
      // BUT: don't show checkbox if node has tasks (tasks have their own checkboxes)
      const nodeTasks = this._tasksCache.get(n.id) || [];
      const hasTasks = nodeTasks.length > 0;
      
      if (actualState === 'in-progress' && !hasTasks) {
        // Calculate text bottom position (match wrapped rendering)
        const lineHeight = 16 / this.scale;
        const words = (n.label || '').split(/\s+/).filter(Boolean);
        const lines: string[] = [];
        for (let i = 0; i < words.length; i += 4) lines.push(words.slice(i, i + 4).join(' '));
        if (lines.length === 0) lines.push('');
        const hasFileName = !!n.fileLink;
        const totalLines = lines.length + (hasFileName ? 1 : 0);
        const firstLineY = n.y - ((totalLines - 1) * lineHeight) / 2;
        let textBottomY = firstLineY + (lines.length - 1) * lineHeight;
        if (hasFileName) textBottomY += lineHeight; // file name occupies another line
        
        const checkboxSize = 12 / this.scale;
        const checkboxX = n.x - checkboxSize / 2;
        const checkboxY = textBottomY + 8 / this.scale; // Below all text with spacing
        
        // Check if click is within checkbox bounds
        if (x >= checkboxX && x <= checkboxX + checkboxSize &&
            y >= checkboxY && y <= checkboxY + checkboxSize) {
          return { node: n };
        }
      }
    }
    return null;
  }

  getNodeAtWorld(x: number, y: number): SkillNode | null {
    for (const n of this.nodes) {
      const r = this.nodeRadii[n.id] || this.settings.nodeRadius || 36;
      const dx = x - n.x;
      const dy = y - n.y;
      if (dx * dx + dy * dy <= r * r) return n;
    }
    return null;
  }

  getNodeHandleAtWorld(x: number, y: number): { node: SkillNode; side: 'top'|'right'|'bottom'|'left'; hx: number; hy: number } | null {
    for (const n of this.nodes) {
      const r = this.nodeRadii[n.id] || this.settings.nodeRadius || 36;
      const hs = 6;
      const handles = [
        { side: 'top', hx: n.x, hy: n.y - r },
        { side: 'right', hx: n.x + r, hy: n.y },
        { side: 'bottom', hx: n.x, hy: n.y + r },
        { side: 'left', hx: n.x - r, hy: n.y },
      ];
      for (const h of handles) {
        const dx = x - h.hx;
        const dy = y - h.hy;
        if (Math.abs(dx) <= hs && Math.abs(dy) <= hs) return { node: n, side: h.side as any, hx: h.hx, hy: h.hy };
      }
    }
    return null;
  }

  findHandleNear(x: number, y: number, thresh = 12): { node: SkillNode; side: 'top'|'right'|'bottom'|'left'; hx: number; hy: number } | null {
    for (const n of this.nodes) {
      const r = this.nodeRadii[n.id] || this.settings.nodeRadius || 36;
      const handles = [
        { side: 'top', hx: n.x, hy: n.y - r },
        { side: 'right', hx: n.x + r, hy: n.y },
        { side: 'bottom', hx: n.x, hy: n.y + r },
        { side: 'left', hx: n.x - r, hy: n.y },
      ];
      for (const h of handles) {
        const dx = x - h.hx;
        const dy = y - h.hy;
        if (dx * dx + dy * dy <= thresh * thresh) return { node: n, side: h.side as any, hx: h.hx, hy: h.hy };
      }
    }
    return null;
  }

  getEdgeEndpointAtWorld(x: number, y: number): { edge: SkillEdge; which: 'from' | 'to'; ex: number; ey: number } | null {
    for (const e of this.edges) {
      const edgeObj = e;
      const fromNode = this.nodes.find((n) => n.id === edgeObj.from) || null;
      const toNode = this.nodes.find((n) => n.id === edgeObj.to) || null;
      // use per-node radii when available
      const rFrom = fromNode ? (this.nodeRadii[fromNode.id] || this.settings.nodeRadius || 36) : (this.settings.nodeRadius || 36);
      const rTo = toNode ? (this.nodeRadii[toNode.id] || this.settings.nodeRadius || 36) : (this.settings.nodeRadius || 36);
      // compute endpoint positions depending on whether sides are specified
      if (fromNode) {
        let ex = fromNode.x;
        let ey = fromNode.y;
        if (edgeObj.fromSide) {
          if (edgeObj.fromSide === 'top') { ex = fromNode.x; ey = fromNode.y - rFrom; }
          if (edgeObj.fromSide === 'right') { ex = fromNode.x + rFrom; ey = fromNode.y; }
          if (edgeObj.fromSide === 'bottom') { ex = fromNode.x; ey = fromNode.y + rFrom; }
          if (edgeObj.fromSide === 'left') { ex = fromNode.x - rFrom; ey = fromNode.y; }
        } else if (toNode) {
          const dx = toNode.x - fromNode.x;
          const dy = toNode.y - fromNode.y;
          const d = Math.max(1, Math.hypot(dx, dy));
          ex = fromNode.x + (dx / d) * rFrom;
          ey = fromNode.y + (dy / d) * rFrom;
        }
        const dx = x - ex;
        const dy = y - ey;
        if (dx * dx + dy * dy <= (12 * 12)) return { edge: edgeObj, which: 'from', ex, ey };
      }
      if (toNode) {
        let ex2 = toNode.x;
        let ey2 = toNode.y;
        if (edgeObj.toSide) {
          if (edgeObj.toSide === 'top') { ex2 = toNode.x; ey2 = toNode.y - rTo; }
          if (edgeObj.toSide === 'right') { ex2 = toNode.x + rTo; ey2 = toNode.y; }
          if (edgeObj.toSide === 'bottom') { ex2 = toNode.x; ey2 = toNode.y + rTo; }
          if (edgeObj.toSide === 'left') { ex2 = toNode.x - rTo; ey2 = toNode.y; }
        } else if (fromNode) {
          const dx2 = fromNode.x - toNode.x;
          const dy2 = fromNode.y - toNode.y;
          const d2 = Math.max(1, Math.hypot(dx2, dy2));
          ex2 = toNode.x + (dx2 / d2) * rTo;
          ey2 = toNode.y + (dy2 / d2) * rTo;
        }
        const dx2 = x - ex2;
        const dy2 = y - ey2;
        if (dx2 * dx2 + dy2 * dy2 <= (12 * 12)) return { edge: edgeObj, which: 'to', ex: ex2, ey: ey2 };
      }
    }
    return null;
  }

  // mark all ancestor parents (nodes reachable by following outgoing edges) as 'unavailable'
  markAncestorsUnavailable(startNodeId: number): Set<number> {
    const visited = new Set<number>();
    const stack = [startNodeId];
    while (stack.length > 0) {
      const cur = stack.pop() as number;
      if (visited.has(cur)) continue;
      visited.add(cur);
      // find parents: edges where from === cur -> to is a parent
      for (const ee of this.edges) {
        if (ee.from === cur && ee.to != null) {
          const pid = ee.to as number;
          if (!visited.has(pid)) stack.push(pid);
        }
      }
    }
    // include the start node itself so the immediate parent is also marked
    for (const id of visited) {
      const nn = this.nodes.find((n) => n.id === id);
      if (nn) nn.state = 'unavailable';
    }
    return visited;
  }

  getEdgeAtWorld(x: number, y: number, thresh = 10): { edge: SkillEdge; which: 'from' | 'to'; ex: number; ey: number } | null {
    for (const e of this.edges) {
      const fromNode = this.nodes.find((n) => n.id === e.from) || null;
      const toNode = this.nodes.find((n) => n.id === e.to) || null;
      if (!fromNode || !toNode) continue;
      const rFrom = this.nodeRadii[fromNode.id] || this.settings.nodeRadius || 36;
      const rTo = this.nodeRadii[toNode.id] || this.settings.nodeRadius || 36;
      let sx1 = fromNode.x;
      let sy1 = fromNode.y;
      let sx2 = toNode.x;
      let sy2 = toNode.y;
      if (e.fromSide) {
        if (e.fromSide === 'top') { sx1 = fromNode.x; sy1 = fromNode.y - rFrom; }
        if (e.fromSide === 'right') { sx1 = fromNode.x + rFrom; sy1 = fromNode.y; }
        if (e.fromSide === 'bottom') { sx1 = fromNode.x; sy1 = fromNode.y + rFrom; }
        if (e.fromSide === 'left') { sx1 = fromNode.x - rFrom; sy1 = fromNode.y; }
      }
      if (e.toSide) {
        if (e.toSide === 'top') { sx2 = toNode.x; sy2 = toNode.y - rTo; }
        if (e.toSide === 'right') { sx2 = toNode.x + rTo; sy2 = toNode.y; }
        if (e.toSide === 'bottom') { sx2 = toNode.x; sy2 = toNode.y + rTo; }
        if (e.toSide === 'left') { sx2 = toNode.x - rTo; sy2 = toNode.y; }
      }
      // compute bezier controls and test distance to curve
      if (this.settings.showBezier) {
        const ctr = computeBezierControls(sx1, sy1, sx2, sy2, e.fromSide, e.toSide, rFrom, rTo);
        const res = distanceSqToBezier(x, y, sx1, sy1, ctr.c1x, ctr.c1y, ctr.c2x, ctr.c2y, sx2, sy2, 28);
        if (res.dist2 <= thresh * thresh) {
          const dFrom2 = (x - sx1) * (x - sx1) + (y - sy1) * (y - sy1);
          const dTo2 = (x - sx2) * (x - sx2) + (y - sy2) * (y - sy2);
          if (dFrom2 <= dTo2) return { edge: e, which: 'from', ex: sx1, ey: sy1 };
          return { edge: e, which: 'to', ex: sx2, ey: sy2 };
        }
      } else {
        // straight-line projection
        const vx = sx2 - sx1;
        const vy = sy2 - sy1;
        const len2 = vx * vx + vy * vy;
        if (len2 === 0) continue;
        const t = Math.max(0, Math.min(1, ((x - sx1) * vx + (y - sy1) * vy) / len2));
        const px = sx1 + t * vx;
        const py = sy1 + t * vy;
        const dx = x - px;
        const dy = y - py;
        if (dx * dx + dy * dy <= thresh * thresh) {
          const dFrom2 = (x - sx1) * (x - sx1) + (y - sy1) * (y - sy1);
          const dTo2 = (x - sx2) * (x - sx2) + (y - sy2) * (y - sy2);
          if (dFrom2 <= dTo2) return { edge: e, which: 'from', ex: sx1, ey: sy1 };
          return { edge: e, which: 'to', ex: sx2, ey: sy2 };
        }
      }
    }
    return null;
  }

  checkEditorModalUnavailableOption(node: SkillNode, modal: HTMLElement) {
    if (node.state === 'unavailable') {
      const stateRow = modal.createDiv({ cls: 'st-row' });
      stateRow.style.marginBottom = '12px';
      stateRow.style.display = 'flex';
      stateRow.style.flexDirection = 'column';
      stateRow.style.gap = '4px';
      const label = stateRow.createEl('label', { text: 'State' });
      label.style.fontWeight = '500';
      const stateText = stateRow.createEl('span');
      stateText.textContent = 'Unavailable (cannot be changed)';
      stateText.style.fontStyle = 'italic';
      stateText.style.color = 'var(--text-muted)';
      const note = modal.createDiv({ cls: 'st-note' });
      note.style.marginBottom = '12px';
      note.style.padding = '8px';
      note.style.backgroundColor = 'var(--background-secondary)';
      note.style.borderRadius = '4px';
      note.style.fontSize = '0.9em';
      note.style.color = 'var(--text-muted)';
      note.setText('This node is Unavailable — complete its prerequisites first.');
    } else {
      const stateRow = modal.createDiv({ cls: 'st-row' });
      stateRow.style.marginBottom = '12px';
      stateRow.style.display = 'flex';
      stateRow.style.flexDirection = 'column';
      stateRow.style.gap = '4px';
      const label = stateRow.createEl('label', { text: 'State' });
      label.style.fontWeight = '500';
      const stateSelect = stateRow.createEl('select') as HTMLSelectElement;
      // Only allow Complete and In-Progress - Unavailable is NEVER an option
      stateSelect.innerHTML = '<option value="in-progress">In-Progress</option><option value="complete">Complete</option>';
      stateSelect.value = node.state === 'complete' ? 'complete' : 'in-progress';
      stateSelect.style.padding = '6px';
      stateSelect.style.width = '100%';
      // immediate-save: update state on change (only Complete or In-Progress allowed)
      stateSelect.addEventListener('change', async () => {
        this.recordSnapshot();
        const selected = stateSelect.value as ('complete'|'in-progress');
        node.state = selected;
        this.applyConnectionStateRules(); // Update parent states when child state changes
        try { await this.saveNodes(); } catch (e) {}
        this.render();
      });
    }
  }


  openModal(
      modal: HTMLElement,
      options: ModalStyleOptions = {}
    ) {
      Object.assign(modal.style, {
        ...DEFAULT_MODAL_STYLES,
        ...options,
      });
    }

  async setStatsModalContents(modal: HTMLElement, node: SkillNode) {
    const header = modal.createDiv();
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.margin = '0 20px 8px 20px';
    header.createEl('h3', { text: node.label }).style.margin = '0';
    modal.createEl('span', { text: 'Stats' }).style.fontWeight = '600';

    // Requirements tree
    const reqHeader = modal.createEl('h4', { text: 'Requirements' });
    reqHeader.style.margin = '8px 20px 4px 20px';

    const container = modal.createDiv();
    container.style.margin = '0 20px 12px 20px';

    // Helper: resolve direct children of a node
    const childrenOf = (id: number) => {
      return this.edges
        .filter((e) => e.to === id && e.from !== null)
        .map((e) => this.nodes.find((n) => n.id === e.from))
        .filter((n): n is SkillNode => !!n);
    };

    const children = childrenOf(node.id);
    if (children.length === 0) {
      container.createEl('div', { text: 'None' });
      return;
    }

    const ul = container.createEl('ul');
    ul.style.margin = '4px 0 0 12px';
    ul.style.paddingLeft = '12px';

    for (const child of children) {
      const li = ul.createEl('li');
      li.style.marginBottom = '6px';
      const childLabel = li.createEl('span', { text: child.label });

      // grandchildren
      const grandchildren = childrenOf(child.id);
      if (grandchildren.length > 0) {
        const subUl = li.createEl('ul');
        subUl.style.margin = '4px 0 0 12px';
        subUl.style.paddingLeft = '12px';
        for (const gc of grandchildren) {
          const gLi = subUl.createEl('li');
          gLi.style.marginBottom = '4px';
          gLi.createEl('span', { text: gc.label });

          // if this grandchild has deeper children, show ellipsis
          const deeper = childrenOf(gc.id);
          if (deeper.length > 0) {
            const ell = gLi.createEl('div', { text: '...' });
            ell.style.display = 'inline-block';
            ell.style.marginLeft = '6px';
            ell.style.opacity = '0.7';
          }
        }
      }
    }
  }

  async setEditorModalContents(modal: HTMLElement, node: SkillNode) {
    const h3 = modal.createEl('h3', { text: 'Edit Node' });
    h3.style.marginTop = '0';
    h3.style.marginBottom = '16px';
    const row = modal.createDiv({ cls: 'st-row' });
    row.style.marginBottom = '12px';
    row.style.display = 'flex';
    row.style.flexDirection = 'column';
    row.style.gap = '4px';
    const input = row.createEl('input') as HTMLInputElement;
    input.type = 'text';
    input.value = node.label;
    input.style.width = '100%';
    input.style.padding = '6px';
    // state selector (Complete / In-Progress only - Unavailable is NEVER shown or selectable)
    // If node is unavailable, don't show the state selector at all - just show a message
    this.checkEditorModalUnavailableOption(node, modal)
    // File link input
    const fileLinkRow = modal.createDiv({ cls: 'st-row' });
    fileLinkRow.style.marginBottom = '12px';
    fileLinkRow.style.display = 'flex';
    fileLinkRow.style.flexDirection = 'column';
    fileLinkRow.style.gap = '4px';
    const fileLinkLabel = fileLinkRow.createEl('label', { text: 'File Link (optional)' });
    fileLinkLabel.style.fontWeight = '500';
    const fileLinkInput = fileLinkRow.createEl('input') as HTMLInputElement;
    fileLinkInput.type = 'text';
    fileLinkInput.placeholder = 'e.g., Notes/MyNote.md';
    fileLinkInput.value = node.fileLink || '';
    fileLinkInput.style.width = '100%';
    fileLinkInput.style.padding = '6px';
    // Save file link on change (when user finishes typing)
    fileLinkInput.addEventListener('change', async () => {
      this.recordSnapshot();
      const oldFileLink = node.fileLink;
      const newFileLink = fileLinkInput.value.trim() || undefined;
      node.fileLink = newFileLink;
      
      // Clean up old file watcher if file link changed
      if (oldFileLink !== newFileLink) {
        const oldWatcher = this._fileWatchers.get(node.id);
        if (oldWatcher) {
          this.app.vault.off('modify', oldWatcher);
          this._fileWatchers.delete(node.id);
        }
        this._tasksCache.delete(node.id);
        this._taskPositions.delete(node.id);
      }
      
      // Reload tasks if file link exists
      if (newFileLink) {
        await this.getNodeTasks(node);
      }
      
      try { await this.saveNodes(); } catch (e) {}
      this.render();
    });

     // Exp input
    const expRow = modal.createDiv({ cls: 'st-row' });
    expRow.style.marginBottom = '12px';
    expRow.style.display = 'flex';
    expRow.style.flexDirection = 'column';
    expRow.style.gap = '4px';
    const expLabel = expRow.createEl('label', { text: 'Experience Points' });
    expLabel.style.fontWeight = '500';
    const expInput = expRow.createEl('input') as HTMLInputElement;
    expInput.type = 'number';
    expInput.min = '0';
    expInput.step = '1';
    expInput.value = String(node.exp !== undefined ? node.exp : this.settings.defaultExp || 0);
    expInput.style.width = '100%';
    expInput.style.padding = '6px';

    expInput.addEventListener('change', async () => {
      this.recordSnapshot();
      const expValue = parseInt(expInput.value, 10);
      if (!isNaN(expValue) && expValue >= 0) {
        node.exp = expValue;
        try { await this.saveNodes(); } catch (e) {}
        this.render();
      }
    });
    expInput.addEventListener('blur', async () => {
      this.recordSnapshot();
      const expValue = parseInt(expInput.value, 10);
      if (!isNaN(expValue) && expValue >= 0) {
        node.exp = expValue;
        try { await this.saveNodes(); } catch (e) {}
        this.render();
      }
    });
    
    // Also save on blur in case change doesn't fire
    fileLinkInput.addEventListener('blur', async () => {
      this.recordSnapshot();
      const oldFileLink = node.fileLink;
      const newFileLink = fileLinkInput.value.trim() || undefined;
      node.fileLink = newFileLink;
      
      // Clean up old file watcher if file link changed
      if (oldFileLink !== newFileLink) {
        const oldWatcher = this._fileWatchers.get(node.id);
        if (oldWatcher) {
          this.app.vault.off('modify', oldWatcher);
          this._fileWatchers.delete(node.id);
        }
        this._tasksCache.delete(node.id);
        this._taskPositions.delete(node.id);
      }
      
      // Reload tasks if file link exists
      if (newFileLink) {
        await this.getNodeTasks(node);
      }
      
      try { await this.saveNodes(); } catch (e) {}
      this.render();
    });
    
    const actions = modal.createDiv({ cls: 'st-actions' });
    actions.style.display = 'flex';
    actions.style.gap = '8px';
    actions.style.justifyContent = 'flex-end';
    actions.style.marginTop = '16px';
    const delBtn = actions.createEl('button', { text: 'Delete' });
    delBtn.style.padding = '6px 12px';
    const closeBtn = actions.createEl('button', { text: 'Close' });
    closeBtn.style.padding = '6px 12px';
    // immediate-save: update label on input
    input.addEventListener('input', async () => {
      this.recordSnapshot();
      node.label = input.value;
      try { await this.saveNodes(); } catch (e) {}
      this.render();
    });
    delBtn.onclick = async () => {
      await this.deleteNode(node, true);
      modal.remove();
      this.removeOutsideClickHandler();
    };
    closeBtn.onclick = () => { modal.remove(); this.removeOutsideClickHandler(); };
  }

  async openNodeStats(node: SkillNode) {
    this.closeAllModals();
    const modal = this.containerEl.createDiv({ cls: 'skill-tree-node-modal' });
    this.openModal(modal, {
      position: 'absolute',
      left: '20px',
    })
    this.installOutsideClickHandler(modal);

    await this.setStatsModalContents(modal, node)
  }

  async openNodeEditor(node: SkillNode) {
    // create an in-DOM modal inside the view so clicks always work
    if (!this.containerEl) {
      const newLabel = window.prompt('Edit node label', node.label);
      if (newLabel !== null) {
        node.label = newLabel;
            await this.saveNodes();
        this.render();
      }
      return;
    }
    // ensure only one modal is open
    this.closeAllModals();
    const modal = this.containerEl.createDiv({ cls: 'skill-tree-node-modal' });
    // Style the modal to be visible in top right
    this.openModal(modal)
    
    // close modal on outside click
    this.installOutsideClickHandler(modal);
    
    await this.setEditorModalContents(modal, node)

    
    
   
  }

  async deleteNode(node: SkillNode, showConfirmation: boolean = true) {
    if (showConfirmation && !confirm('Delete this node?')) return;
    
    this.recordSnapshot();
    this.nodes = this.nodes.filter((n) => n.id !== node.id);
    this.edges = this.edges.filter((e) => e.from !== node.id && e.to !== node.id);
    this.selectedNodeId = null; // Clear selection
    this.selectedTask = null; // Clear task selection
    
    // Clean up task cache and file watchers
    this._tasksCache.delete(node.id);
    this._taskPositions.delete(node.id);
    const watcher = this._fileWatchers.get(node.id);
    if (watcher) {
      this.app.vault.off('modify', watcher);
      this._fileWatchers.delete(node.id);
    }
    
    await this.saveNodes();
    this.render();
  }

}