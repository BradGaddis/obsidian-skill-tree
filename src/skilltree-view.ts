import {ItemView, WorkspaceLeaf, TFile } from 'obsidian';

import { SkillNode, SkillEdge, SkillTreeSettings, SkillTreeData, SKILL_TREE_STYLES } from './interfaces';
import  {VIEW_TYPE_SKILLTREE}  from './main';
import SkillTreePlugin from './main';
import { chooseEdgeColor, computeBezierControls, drawBezierArrow, drawRigidBezierArrow, drawArrow, parseCSSColor, distanceSqToBezier } from './drawing';
import { Coordinate } from './types';
import { ModalStyleOptions } from './types';
import { DEFAULT_MODAL_STYLES } from './constants';

/**
 * Draw a hexagon shape
 */
function drawHexagon(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6; // Start at top
    const px = x + radius * Math.cos(angle);
    const py = y + radius * Math.sin(angle);
    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.closePath();
}

/**
 * Draw a star shape
 */
function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, points: number = 5) {
  ctx.beginPath();
  const outerRadius = radius;
  const innerRadius = radius * 0.5;
  for (let i = 0; i < points * 2; i++) {
    const angle = (Math.PI / points) * i - Math.PI / 2;
    const r = i % 2 === 0 ? outerRadius : innerRadius;
    const px = x + r * Math.cos(angle);
    const py = y + r * Math.sin(angle);
    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.closePath();
}

/**
 * Draw a diamond shape
 */
function drawDiamond(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - radius);
  ctx.lineTo(x + radius, y);
  ctx.lineTo(x, y + radius);
  ctx.lineTo(x - radius, y);
  ctx.closePath();
}

/**
 * Create a small default set of nodes used when initializing a new tree.
 * @internal
 */
function defaultNodes(): SkillNode[] {
  // Note: Shape will be set based on current style when nodes are actually used
  // This is just a placeholder - the actual shape will be set in loadNodes or addNode
  return [
    { id: Date.now(), x: 200, y: 150, state: 'unavailable', exp: 10 },
    { id: Date.now() + 1, x: 200, y: 150, state: 'unavailable', exp: 10 },
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
  
  /** Track previous node states to detect state changes */
  _previousNodeStates: Map<number, string> = new Map();
  
  /** Track active state change animations (nodeId -> { type, startTime }) */
  _nodeStateChangeAnimations: Map<number, { type: 'in-progress' | 'complete', startTime: number }> = new Map();
  
  /** Track previous total exp to detect when it reaches total available */
  _previousTotalExp: number = 0;
  
  /** Track exp overlay animation when exp equals total */
  _expOverlayAnimation: { startTime: number; active: boolean } | null = null;
  
  /** Track task children modal */
  _taskChildrenModal: HTMLElement | null = null;

  
  
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

  // Parse front matter from a file and extract shape using Dataview if available
  async getNodeShapeFromFile(filePath: string): Promise<'circle' | 'square' | 'hexagon' | 'diamond'> {
    try {
      let normalizedPath = filePath.trim();
      if (normalizedPath.startsWith('/')) normalizedPath = normalizedPath.substring(1);
      if (!normalizedPath.endsWith('.md')) normalizedPath = normalizedPath + '.md';

      // Get default shape based on current style
      const selectedStyle = this.settings.style || 'gamified';
      const styleDef = SKILL_TREE_STYLES[selectedStyle];
      const defaultShape = styleDef?.nodeShape || 'circle';

      // Try to use Dataview API if available
      if (this.isDataviewPluginInstalled()) {
        try {
          const dv = (this.app as any).plugins.plugins.dataview.api;
          if (dv) {
            const page = dv.page(normalizedPath);
            if (page && page.shape) {
              const shape = page.shape.toLowerCase();
              if (shape === 'square' || shape === 'hexagon' || shape === 'diamond' || shape === 'circle') {
                return shape as 'circle' | 'square' | 'hexagon' | 'diamond';
              }
              // Invalid shape, return default
              return defaultShape as 'circle' | 'square' | 'hexagon' | 'diamond';
            }
          }
        } catch (e) {
          // Fall back to manual parsing if Dataview fails
          console.warn('Dataview parsing failed, falling back to manual parsing:', e);
        }
      }

      // Fallback: manual parsing
      const file = this.app.vault.getAbstractFileByPath(normalizedPath);
      if (!file || !(file instanceof TFile)) return defaultShape as 'circle' | 'square' | 'hexagon' | 'diamond';

      const content = await this.app.vault.read(file);
      // Simple YAML front matter regex: extract content between --- delimiters
      const frontMatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
      if (!frontMatterMatch) return defaultShape as 'circle' | 'square' | 'hexagon' | 'diamond';

      const frontMatter = frontMatterMatch[1];
      // Look for shape: circle, square, hexagon, or diamond
      const shapeMatch = frontMatter.match(/shape\s*:\s*(circle|square|hexagon|diamond)/i);
      if (shapeMatch) {
        const shape = shapeMatch[1].toLowerCase();
        if (shape === 'square' || shape === 'hexagon' || shape === 'diamond' || shape === 'circle') {
          return shape as 'circle' | 'square' | 'hexagon' | 'diamond';
        }
      }
      return defaultShape as 'circle' | 'square' | 'hexagon' | 'diamond';
    } catch (e) {
      // Return default shape based on style
      const selectedStyle = this.settings.style || 'gamified';
      const styleDef = SKILL_TREE_STYLES[selectedStyle];
      const defaultShape = styleDef?.nodeShape || 'circle';
      return defaultShape as 'circle' | 'square' | 'hexagon' | 'diamond';
    }
  }

  // Build full file path using default path from settings if needed
  buildFilePath(filePath: string): string {
    let path = filePath.trim();
    
    // If path is already absolute (starts with /) or contains directory separators, use as is
    if (path.startsWith('/') || path.includes('/')) {
      // Remove leading slash if present
      if (path.startsWith('/')) {
        path = path.substring(1);
      }
      return path;
    }
    
    // Otherwise, prepend default path from settings
    const defaultPath = this.settings.defaultFilePath || '';
    if (defaultPath) {
      // Remove trailing slash from default path and leading slash from file path
      const cleanDefaultPath = defaultPath.replace(/\/$/, '');
      const cleanFilePath = path.replace(/^\//, '');
      return cleanDefaultPath ? `${cleanDefaultPath}/${cleanFilePath}` : cleanFilePath;
    }
    
    return path;
  }

  // Update frontmatter of a file to include skilltree-node association
  async updateFileFrontmatterWithNodeId(filePath: string, nodeId: number): Promise<void> {
    try {
      let normalizedPath = filePath.trim();
      if (normalizedPath.startsWith('/')) normalizedPath = normalizedPath.substring(1);
      if (!normalizedPath.endsWith('.md')) normalizedPath = normalizedPath + '.md';

      const file = this.app.vault.getAbstractFileByPath(normalizedPath);
      if (!file || !(file instanceof TFile)) return;

      // Get the node to access its shape
      const node = this.nodes.find(n => n.id === nodeId);
      // Get default shape based on current style
      const selectedStyle = this.settings.style || 'gamified';
      const styleDef = SKILL_TREE_STYLES[selectedStyle];
      let defaultShape = styleDef?.nodeShape || 'circle';
      // Filter out 'star' as it's not a valid node shape (only style shape)
      if (defaultShape === 'star') {
        defaultShape = 'circle';
      }
      const nodeShape = node?.shape || defaultShape;
      
      await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
        // Always update skilltree-node to reflect current node ID
        frontmatter['skilltree-node'] = nodeId;
        // Set default exp if not already set
        if (frontmatter['skilltree-node-exp'] === undefined) {
          frontmatter['skilltree-node-exp'] = 10;
        }
        // Set default shape if not already set
        if (frontmatter['shape'] === undefined) {
          frontmatter['shape'] = nodeShape;
        }
        
        // Always update connections
        const outgoing = this.edges.filter(edge => edge.from === nodeId).map(edge => edge.to);
        const incoming = this.edges.filter(edge => edge.to === nodeId).map(edge => edge.from);
        
        if (outgoing.length > 0) {
          frontmatter['skilltree-node-to'] = outgoing;
        } else {
          delete frontmatter['skilltree-node-to'];
        }
        
        if (incoming.length > 0) {
          frontmatter['skilltree-node-from'] = incoming;
        } else {
          delete frontmatter['skilltree-node-from'];
        }
      });
      
      // Wait for metadata cache to update, then trigger render
      // This ensures the cache reflects the updated frontmatter before we check nodeFileHasCorrectId
      // The metadata cache needs a moment to process the file change
      setTimeout(() => {
        this.render();
      }, 150);
    } catch (e) {
      console.warn('Failed to update frontmatter with skilltree-node:', e);
    }
  }

  // Check if a node's file has the correct ID in its frontmatter
  nodeFileHasCorrectId(node: SkillNode): boolean {
    if (!node.fileLink) return true; // No file link means no issue
    
    try {
      let normalizedPath = node.fileLink.trim();
      if (normalizedPath.startsWith('/')) normalizedPath = normalizedPath.substring(1);
      if (!normalizedPath.endsWith('.md')) normalizedPath = normalizedPath + '.md';
      
      const file = this.app.vault.getAbstractFileByPath(normalizedPath);
      if (!file || !(file instanceof TFile)) return true; // File doesn't exist, no issue
      
      const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
      const existingNodeId = frontmatter?.['skilltree-node'];
      
      // Return true if the file has the correct ID, false otherwise
      return existingNodeId === node.id;
    } catch (e) {
      // If we can't check, assume it's fine
      return true;
    }
  }

  // Get the display label for a node (note title if associated, prompt if not)
  getNodeDisplayLabel(node: SkillNode): string {
    // Always return empty string - filename is displayed separately
    return '';
  }

  // Use Dataview to find notes with skilltree-node associations and link them to nodes
  async associateNotesWithNodes(): Promise<void> {
    if (!this.isDataviewPluginInstalled()) return;

    try {
      const dv = (this.app as any).plugins.plugins.dataview.api;
      if (!dv) return;

      // Query for all pages that have a skilltree-node field
      const pages = dv.pages().where((p: any) => p['skilltree-node'] !== undefined);

      for (const page of pages) {
        const fileNodeId = page['skilltree-node'];
        const node = this.nodes.find((n) => n.id === fileNodeId);

        if (node) {
          // Associate the note with the node, preferring existing links but allowing updates
          const notePath = page.file.path;
          if (!node.fileLink || node.fileLink !== notePath) {
            node.fileLink = notePath;
            this._lastKnownNodeIds.set(notePath, node.id);
            // Update frontmatter to ensure it matches the node's ID (node ID takes precedence)
            await this.updateFileFrontmatterWithNodeId(notePath, node.id);
          } else {
            // Node already has this file linked - ensure frontmatter matches node ID
            // This handles the case where file frontmatter has a different ID
            await this.updateFileFrontmatterWithNodeId(notePath, node.id);
          }
        } else {
          // File has a node ID that doesn't match any existing node
          // Don't create a new node or change existing nodes - just leave it
          // The user will need to manually link it or change the ID in the file
        }
      }
    } catch (e) {
      console.warn('Failed to associate notes with nodes using Dataview:', e);
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
  _lastKnownNodeIds: Map<string, number> = new Map(); // Store last known node ID per file path
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
    
    // Load node shape from file front matter
    node.shape = await this.getNodeShapeFromFile(node.fileLink);
    
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
          // Store initial node ID for this file
          this._lastKnownNodeIds.set(watchPath, node.id);
          
          // Track last update time to debounce rapid updates
          let lastUpdateTime = 0;
          const UPDATE_DEBOUNCE_MS = 150;
          
          // Function to update node from file metadata
          const updateNodeFromFile = async (changedFile: TFile, fromMetadataCache: boolean = false) => {
            // Debounce rapid updates
            const now = Date.now();
            if (now - lastUpdateTime < UPDATE_DEBOUNCE_MS) {
              return;
            }
            lastUpdateTime = now;
            
            // If this is from file modify event (not metadata cache), wait for cache to update
            if (!fromMetadataCache) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            // Check for frontmatter changes
            const frontmatter = this.app.metadataCache.getFileCache(changedFile)?.frontmatter;
            const currentNodeId = frontmatter?.['skilltree-node'];
            
            // Node ID takes precedence - if file has different ID, update the file (not the node)
            // Check if we need to update the file's frontmatter to match the node's ID
            const lastKnownId = this._lastKnownNodeIds.get(watchPath);
            
            // Only update if the file's ID doesn't match the node's ID AND we haven't just set it
            // This prevents infinite loops when we update the file
            if (currentNodeId !== node.id && lastKnownId !== node.id) {
              // File has a different ID than the node - update the file to match the node
              await this.updateFileFrontmatterWithNodeId(node.fileLink, node.id);
              // Update the stored ID to match the node (so we don't update again immediately)
              this._lastKnownNodeIds.set(watchPath, node.id);
            } else if (currentNodeId === undefined && lastKnownId !== node.id) {
              // File doesn't have the ID - add it
              await this.updateFileFrontmatterWithNodeId(node.fileLink, node.id);
              this._lastKnownNodeIds.set(watchPath, node.id);
            } else if (lastKnownId !== node.id) {
              // Update stored ID to current node ID (in case node ID changed)
              this._lastKnownNodeIds.set(watchPath, node.id);
            }
            
            // Reload tasks when file changes
            const newTasks = await this.getTasksFromFile(node.fileLink);
            newTasks.forEach((task: any) => {
              task.filePath = node.fileLink;
            });
            this._tasksCache.set(node.id, newTasks);
            
            // Reload node shape from file front matter
            node.shape = await this.getNodeShapeFromFile(node.fileLink);
            
            // Reload exp from file frontmatter (but don't change node ID)
            try {
              const fileExp = frontmatter?.['skilltree-node-exp'];
              if (fileExp !== undefined && typeof fileExp === 'number') {
                node.exp = fileExp;
              } else {
                // File doesn't have exp, default to 10
                node.exp = 10;
              }
            } catch (e) {
              // Error reading exp, default to 10
              node.exp = 10;
            }
            
            // Update node state based on task completion
            this.updateNodeStateFromTasks(node);
            
            // Save nodes to persist the updated exp and shape
            try { await this.saveNodes(); } catch (e) {}
            
            this.render();
          };
          
          // Watch for file changes
          const fileWatcher = this.app.vault.on('modify', async (changedFile) => {
            if (changedFile instanceof TFile && (changedFile.path === watchPath || changedFile.path === node.fileLink)) {
              await updateNodeFromFile(changedFile, false);
            }
          });
          
          // Also watch for metadata cache changes (more reliable for frontmatter updates)
          const metadataWatcher = this.app.metadataCache.on('changed', async (changedFile) => {
            if (changedFile instanceof TFile && (changedFile.path === watchPath || changedFile.path === node.fileLink)) {
              await updateNodeFromFile(changedFile, true);
            }
          });
          
          // Store cleanup function for both watchers
          const cleanupWatchers = () => {
            this.app.vault.offref(fileWatcher);
            this.app.metadataCache.offref(metadataWatcher);
          };
          this._fileWatchers.set(node.id, cleanupWatchers as any);
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
  
  // Complete all tasks in a note
  async completeAllTasksInNote(node: SkillNode) {
    if (!node.fileLink) return;
    
    const tasks = this._tasksCache.get(node.id) || [];
    if (tasks.length === 0) return;
    
    try {
      // Normalize path
      let filePath = node.fileLink.trim();
      if (!filePath.endsWith('.md')) {
        filePath = filePath + '.md';
      }
      
      const file = this.app.vault.getAbstractFileByPath(filePath);
      if (!file || !(file instanceof TFile)) return;
      
      // Try to use Tasks plugin API if available
      if (this.isTasksPluginInstalled()) {
        const tasksPlugin = this.getTasksPlugin();
        if (tasksPlugin && tasksPlugin.api) {
          // Complete all tasks using Tasks API
          for (const task of tasks) {
            if (task.completed) continue; // Skip already completed tasks
            
            if (task.originalTask) {
              try {
                // Try toggleTask if available
                if (typeof tasksPlugin.api.toggleTask === 'function') {
                  await tasksPlugin.api.toggleTask(task.originalTask);
                  continue;
                }
                // Try updating status
                if (task.originalTask.status !== undefined && task.originalTask.status !== 'x') {
                  task.originalTask.status = 'x';
                  if (typeof tasksPlugin.api.updateTask === 'function') {
                    await tasksPlugin.api.updateTask(task.originalTask);
                    continue;
                  } else if (typeof tasksPlugin.api.replaceTaskWithTasks === 'function') {
                    await tasksPlugin.api.replaceTaskWithTasks(task.originalTask, [task.originalTask]);
                    continue;
                  }
                }
              } catch (e) {
                // Fallback to manual toggle
              }
            }
          }
        }
      }
      
      // Fallback: manual toggle for all tasks
      const content = await this.app.vault.read(file);
      const lines = content.split('\n');
      let modified = false;
      
      for (const task of tasks) {
        if (task.completed || task.line === undefined || task.line < 0 || task.line >= lines.length) continue;
        
        const line = lines[task.line];
        // Toggle the checkbox: [ ] -> [x]
        const newLine = line.replace(/\[([ x])\]/i, (match, status) => {
          return status.toLowerCase() === 'x' ? '[x]' : '[x]';
        });
        
        if (newLine !== line) {
          lines[task.line] = newLine;
          modified = true;
        }
      }
      
      if (modified) {
        await this.app.vault.modify(file, lines.join('\n'));
      }
      
      // Reload tasks after modification
      const newTasks = await this.getTasksFromFile(node.fileLink);
      newTasks.forEach((t: any) => {
        t.filePath = node.fileLink;
      });
      this._tasksCache.set(node.id, newTasks);
      this.updateNodeStateFromTasks(node);
      this.render();
    } catch (e) {
      console.error('Failed to complete all tasks:', e);
    }
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
        this.addNode(worldPos.x, worldPos.y);
      } else {
        this.addNode(200, 150);
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
      this.openNewTreeModal();
    };
    
    const deleteTreeBtn = toolbar.createEl('button', { text: 'Delete Tree' });
    deleteTreeBtn.onclick = async () => {
      if (Object.keys(this.settings.trees).length <= 1) {
        this.openErrorModal('Cannot delete the last tree. Create a new tree first.');
        return;
      }
      
      const treeNameToDelete = this.settings.currentTreeName;
      this.openDeleteConfirmationModal(treeNameToDelete, async () => {
        await this.deleteTree(treeNameToDelete);
        this.updateTreeSelector(treeSelect);
        // render() is already called by deleteTree() if tree was switched
        // but we need to ensure it's called if it wasn't
        this.render();
      });
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
    // Track if a node was dragged to prevent showing stats modal
    let nodeWasDragged = false;
    
    this.canvas.addEventListener('click', async (e) => {
      if (!this.canvas) return;
      const rect = this.canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const w = this.screenToWorld(sx, sy);
      
      // Check for task node click first
      const taskHit = this.getTaskNodeAtWorld(w.x, w.y);
      if (taskHit) {
        this.selectedTask = { nodeId: taskHit.node.id, taskIndex: taskHit.taskIndex };
        this.selectedNodeId = taskHit.node.id;
        // Center and zoom on task
        this.centerAndZoomOnPoint(taskHit.node.x, taskHit.node.y, 2.5);
        
        // Check if task has children and show modal
        const tasks = this._tasksCache.get(taskHit.node.id) || [];
        const task = tasks[taskHit.taskIndex];
        if (task && task.children && task.children.length > 0) {
          this.showTaskChildrenModal(taskHit.node, taskHit.taskIndex, task);
        } else {
          // Close modal if task has no children
          this.closeTaskChildrenModal();
        }
        
        this.render();
        return;
      }
      
      // Check for regular node click
      let hit = this.getNodeHit(e);
      
      if (hit) {
        // Only show stats modal if we didn't drag the node
        if (nodeWasDragged) {
          // Node was dragged, don't show stats modal
          nodeWasDragged = false; // Reset for next interaction
          this.selectedNodeId = hit.id;
          return;
        }
        // Node was just clicked (not dragged), center/zoom and show stats modal
        this.selectedNodeId = hit.id;
        this.centerAndZoomOnPoint(hit.x, hit.y, 2.0);
        this.openNodeStats(hit);
      }
    })

    // double click: open editor for nodes, or add node if empty
    this.canvas.addEventListener('dblclick', async (e) => {
      if (!this.canvas) return;
      const rect = this.canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const w = this.screenToWorld(sx, sy);
      const hit = this.getNodeAtWorld(w.x, w.y);
      if (hit) {
        // Open the editor for the node
        this.openNodeEditor(hit);
      } else {
        this.addNode(w.x, w.y);
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
      
      // Check for task node
      const taskHit = this.getTaskNodeAtWorld(w.x, w.y);
      if (taskHit) {
        e.preventDefault();
        this.selectedTask = { nodeId: taskHit.node.id, taskIndex: taskHit.taskIndex };
        this.selectedNodeId = taskHit.node.id;
        // Center and zoom on task
        this.centerAndZoomOnPoint(taskHit.node.x, taskHit.node.y, 2.5);
        this.render();
        return;
      }
      
      const hit = this.getNodeAtWorld(w.x, w.y);
      if (hit) {
        e.preventDefault();
        this.selectedNodeId = hit.id;
        // Center and zoom on node
        this.centerAndZoomOnPoint(hit.x, hit.y, 2.0);
        this.openNodeEditor(hit);
      } else {
        this.selectedNodeId = null;
        this.selectedTask = null;
        this.closeTaskChildrenModal();
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
        this.closeTaskChildrenModal();
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
        // Check if clicking the same task - toggle modal
        const isSameTask = this.selectedTask && 
          this.selectedTask.nodeId === taskHit.node.id && 
          this.selectedTask.taskIndex === taskHit.taskIndex;
        
        // Select the task (don't move the parent node)
        this.selectedTask = { nodeId: taskHit.node.id, taskIndex: taskHit.taskIndex };
        this.selectedNodeId = taskHit.node.id;
        // Center and zoom on parent node
        this.centerAndZoomOnPoint(taskHit.node.x, taskHit.node.y, 2.5);
        
        // If clicking the same task and modal is open, toggle it
        if (isSameTask && this._taskChildrenModal) {
          this.closeTaskChildrenModal();
        }
        // Otherwise, centerAndZoomOnPoint will handle showing the modal if task has children
        
        // Don't set _dragStart - we don't want to allow dragging the parent node when clicking tasks
        this.render(); // Update display to show expanded task
        return;
      }
      
      // Check for child task node click
      const tasks = this._tasksCache.get(this.selectedTask?.nodeId || -1) || [];
      let clickedChildTask = false;
      if (this.selectedTask) {
        const parentTask = tasks[this.selectedTask.taskIndex];
        if (parentTask && parentTask.children) {
          for (const childIndex of parentTask.children) {
            const childTaskPos = this._taskPositions.get(this.selectedTask.nodeId)?.find(p => p.taskIndex === childIndex);
            if (childTaskPos) {
              const dx = w.x - childTaskPos.x;
              const dy = w.y - childTaskPos.y;
              const dist2 = dx * dx + dy * dy;
              if (dist2 <= childTaskPos.radius * childTaskPos.radius) {
                clickedChildTask = true;
                break;
              }
            }
          }
        }
      }
      
      // If clicking outside task/child nodes, close modal
      if (!clickedChildTask) {
        this.closeTaskChildrenModal();
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
        this.selectedTask = null;
        this.closeTaskChildrenModal(); // Clear task selection when clicking on a node
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
            nodeWasDragged = true; // Mark that node was dragged
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
                
                // Update frontmatter for affected nodes
                const fromNode = this.nodes.find(n => n.id === fromId);
                const toNode = this.nodes.find(n => n.id === toId);
                if (fromNode?.fileLink) await this.updateFileFrontmatterWithNodeId(fromNode.fileLink, fromNode.id);
                if (toNode?.fileLink) await this.updateFileFrontmatterWithNodeId(toNode.fileLink, toNode.id);
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
            
            // Update frontmatter for affected nodes
            const fromNode = this.nodes.find(n => n.id === newEdge.from);
            const toNode = this.nodes.find(n => n.id === newEdge.to);
            if (fromNode?.fileLink) await this.updateFileFrontmatterWithNodeId(fromNode.fileLink, fromNode.id);
            if (toNode?.fileLink) await this.updateFileFrontmatterWithNodeId(toNode.fileLink, toNode.id);
          }
        }
      }
      // Check for task checkbox clicks first (check regardless of _dragStart)
      const taskCheckboxHit = this.getTaskCheckboxAtWorld(w.x, w.y);
      if (taskCheckboxHit) {
        // Complete all tasks in the note
        await this.completeAllTasksInNote(taskCheckboxHit.node);
        return; // Don't process other clicks
      }
      
      // Check for task node clicks (but not if clicking on checkbox)
      const taskHit = this.getTaskNodeAtWorld(w.x, w.y);
      if (taskHit) {
        // Just select the task, don't toggle (toggle is done via checkbox)
        // Selection is already handled in mousedown, but we need to ensure it's set here too
        this.selectedTask = { nodeId: taskHit.node.id, taskIndex: taskHit.taskIndex };
        this.selectedNodeId = taskHit.node.id;
        // Center and zoom on parent node
        this.centerAndZoomOnPoint(taskHit.node.x, taskHit.node.y, 2.5);
        
        // Check if task has children and show modal
        const tasks = this._tasksCache.get(taskHit.node.id) || [];
        const task = tasks[taskHit.taskIndex];
        if (task && task.children && task.children.length > 0) {
          this.showTaskChildrenModal(taskHit.node, taskHit.taskIndex, task);
        } else {
          // Close modal if task has no children
          this.closeTaskChildrenModal();
        }
        
        this.render();
        return; // Don't process other clicks
      }
      
      this._dragStart = null;
      this.creatingEdgeFrom = null;
      this.tempEdgeTarget = null;
      this.draggingEdgeEndpoint = null;
      this._edgeDragActive = false;
      this._edgeDragStart = null;
      isPanning = false;
      // Reset drag flag after mouseup is processed
      if (!nodeWasDragged) {
        nodeWasDragged = false; // Ensure it's reset if it wasn't set
      }
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
      
      // Close task modal on zoom
      this.closeTaskChildrenModal();
      
      this.render();
    }, { passive: false });

    await this.loadNodes();
    try { (handlesCheckbox as HTMLInputElement).checked = !!this.settings.showHandles; } catch (e) {}
    
    // Initialize previous states for all nodes
    for (const node of this.nodes) {
      this._previousNodeStates.set(node.id, node.state || 'in-progress');
    }
    
    if (!this.nodes || this.nodes.length === 0) {
      this.nodes = defaultNodes();
      // Set default shapes for default nodes based on current style
      const selectedStyle = this.settings.style || 'gamified';
      const styleDef = SKILL_TREE_STYLES[selectedStyle];
      let defaultShape = styleDef?.nodeShape || 'circle';
      if (defaultShape === 'star') {
        defaultShape = 'circle';
      }
      for (const node of this.nodes) {
        if (!node.shape) {
          node.shape = defaultShape as 'circle' | 'square' | 'hexagon' | 'diamond';
        }
        this._previousNodeStates.set(node.id, node.state || 'in-progress');
      }
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
      const exp = n.exp !== undefined ? n.exp : 10;
      const words = (this.getNodeDisplayLabel(n) || '').split(/\s+/).filter(Boolean);
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
      let fileName = '';
      if (n.fileLink) {
        const pathParts = n.fileLink.split('/');
        fileName = pathParts[pathParts.length - 1];
        if (fileName.endsWith('.md')) fileName = fileName.slice(0, -3);
        // Take first part before ---
        fileName = fileName.split(' --- ')[0].trim();
      } else {
        // No file link, show prompt
        fileName = 'Right click to add note';
      }
      if (fileName) {
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

  addNode(x: number, y: number) {
    // Get default shape based on current style
    const selectedStyle = this.settings.style || 'default';
    const styleDef = SKILL_TREE_STYLES[selectedStyle];
    let defaultShape = styleDef?.nodeShape || 'circle';
    // Filter out 'star' as it's not a valid node shape (only style shape)
    if (defaultShape === 'star') {
      defaultShape = 'circle';
    }
    
    this.nodes.push({ 
      id: Date.now() + Math.random(), 
      x, 
      y, 
      state: 'unavailable',
      exp: 10,
      shape: defaultShape as 'circle' | 'square' | 'hexagon' | 'diamond'
    });
  }

  // Apply connection state rules
  applyConnectionStateRules() {
    // Track state changes for animations (only in gamified mode)
    const selectedStyle = this.settings.style || 'gamified';
    const isGamified = selectedStyle === 'gamified';
    
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
            const prevState = this._previousNodeStates.get(n.id);
            if (prevState !== 'complete' && isGamified) {
              // State changed to complete - trigger animation
              this._nodeStateChangeAnimations.set(n.id, { type: 'complete', startTime: this._animationTime });
            }
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
          const prevState = this._previousNodeStates.get(childNode.id);
          if (prevState !== 'in-progress' && isGamified) {
            // State changed to in-progress - trigger animation
            this._nodeStateChangeAnimations.set(childNode.id, { type: 'in-progress', startTime: this._animationTime });
          }
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
            const prevState = this._previousNodeStates.get(n.id);
            if (prevState !== 'in-progress' && isGamified) {
              // State changed to in-progress - trigger animation
              this._nodeStateChangeAnimations.set(n.id, { type: 'in-progress', startTime: this._animationTime });
            }
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
      
      // Draw checkbox or SVG checkmark - centered in task node when selected
      if (isTaskSelected) {
        if (task.completed) {
          // Draw SVG checkmark icon (green circle with white checkmark) when completed - centered
          const iconSize = 18 / this.scale;
          const iconX = taskX - iconSize / 2;
          const iconY = taskY - iconSize / 2;
          
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
          // Draw checkbox when not completed (clickable) - centered
          const checkboxSize = 16 / this.scale;
          const checkboxX = taskX - checkboxSize / 2;
          const checkboxY = taskY - checkboxSize / 2;
          
          // Get text color for checkbox border
          const selectedStyle = this.settings.style || 'gamified';
          const styleDef = SKILL_TREE_STYLES[selectedStyle];
          let checkboxColor = '#333';
          if (styleDef) {
            const bgColor = styleDef.backgroundColor;
            // Check if background is dark
            if (bgColor && (bgColor.includes('#1') || bgColor.includes('#2') || bgColor.includes('#0') || 
                bgColor.includes('rgb(2') || bgColor.includes('rgb(1') || bgColor.includes('rgb(3'))) {
              checkboxColor = '#fff';
            }
          }
          
          // Draw checkbox border
          ctx.beginPath();
          ctx.strokeStyle = checkboxColor;
          ctx.lineWidth = 2 / this.scale;
          ctx.strokeRect(checkboxX, checkboxY, checkboxSize, checkboxSize);
        }
      }
      
      // Draw task text - show full text below task node when selected
      // Get theme-aware text color based on style background
      let textColor = '#000'; // Default to black for light mode
      try {
        const selectedStyle = this.settings.style || 'gamified';
        const styleDef = SKILL_TREE_STYLES[selectedStyle];
        
        if (styleDef) {
          const bgColor = styleDef.backgroundColor;
          // Check if background is dark - use white text for dark backgrounds
          if (bgColor && (bgColor.includes('#1') || bgColor.includes('#2') || bgColor.includes('#0') || 
              bgColor.includes('rgb(2') || bgColor.includes('rgb(1') || bgColor.includes('rgb(3') ||
              bgColor.includes('rgb(4'))) {
            textColor = '#fff'; // White for dark backgrounds
          } else {
            // Light background - use theme text color or black
            const docStyle = getComputedStyle(document.documentElement);
            const textColorVar = docStyle.getPropertyValue('--text-normal');
            if (textColorVar && textColorVar.trim()) {
              textColor = textColorVar.trim();
            }
          }
        } else {
          // Fallback to theme detection
          const docStyle = getComputedStyle(document.documentElement);
          const textColorVar = docStyle.getPropertyValue('--text-normal');
          const bgVar = docStyle.getPropertyValue('--background-primary') || '';
          
          if (textColorVar && textColorVar.trim()) {
            textColor = textColorVar.trim();
          }
          
          // Detect dark mode
          if (bgVar && (bgVar.includes('rgb(2') || bgVar.includes('rgb(1') || 
              bgVar.includes('#1') || bgVar.includes('#2') || bgVar.includes('#0') ||
              bgVar.includes('rgb(3') || bgVar.includes('rgb(4'))) {
            textColor = '#fff';
          }
        }
      } catch (e) {
        // Fallback to black if theme detection fails
      }
      
      ctx.fillStyle = textColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const fontSize = isTaskSelected ? Math.max(14 / this.scale, 12) : Math.max(10 / this.scale, 8);
      ctx.font = `${fontSize}px sans-serif`;
      
      const taskText = task.text || '';
      const textY = taskY + taskNodeRadius + (isTaskSelected ? 12 / this.scale : 4 / this.scale);
      
      // When selected, show full text below with word wrapping
      if (isTaskSelected) {
        const maxTextWidth = 200 / this.scale; // Wider for full text display when selected
        const words = taskText.split(' ');
        let line = '';
        let yOffset = 0;
        
        // Add text shadow/outline for better visibility on dark backgrounds
        ctx.save();
        if (textColor === '#fff') {
          ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        } else {
          ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
        }
        ctx.shadowBlur = 3 / this.scale;
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
      } else {
        // Not selected - show truncated text
        const truncated = taskText.length > 20 ? taskText.substring(0, 20) + '...' : taskText;
        ctx.fillText(truncated, taskX, textY);
      }
      
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

  /**
   * Draw a node shape based on the shape type
   */
  drawNodeShape(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, shape: string) {
    switch (shape) {
      case 'square':
        ctx.rect(x - radius, y - radius, radius * 2, radius * 2);
        break;
      case 'hexagon':
        drawHexagon(ctx, x, y, radius);
        break;
      case 'star':
        drawStar(ctx, x, y, radius, 5);
        break;
      case 'diamond':
        drawDiamond(ctx, x, y, radius);
        break;
      case 'circle':
      default:
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        break;
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

    // Get background color from selected style
    let bg = '#e7f5ff'; // Default fallback
    
    try {
      // First, try to get background from the selected style
      const selectedStyle = this.settings.style || 'gamified';
      const styleDef = SKILL_TREE_STYLES[selectedStyle];
      if (styleDef && styleDef.backgroundColor) {
        bg = styleDef.backgroundColor;
      } else {
        // Fallback to Obsidian theme variable if style not found
        const docStyle = getComputedStyle(document.documentElement);
        const cssBg = docStyle.getPropertyValue('--background-primary');
        if (cssBg && cssBg.trim()) bg = cssBg.trim();
        else if (this.canvas) {
          const cs = getComputedStyle(this.canvas);
          if (cs && cs.backgroundColor) bg = cs.backgroundColor;
        }
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
      // Get edge color from style or use theme-based color
      const selectedStyle = this.settings.style || 'gamified';
      const styleDef = SKILL_TREE_STYLES[selectedStyle];
      let edgeColor: string;
      let edgeGlow = false;
      const edgeStyle = styleDef?.edgeStyle || 'straight';
      const isGamified = selectedStyle === 'gamified';
      
      // For gamified style, always use bezier (rigid)
      const useBezier = isGamified || this.settings.showBezier;
      
      // Check node states - only animate edges where at least one node is in-progress (not both complete)
      const aState = a.state || 'in-progress';
      const bState = b.state || 'in-progress';
      const bothUnavailable = aState === 'unavailable' && bState === 'unavailable';
      const bothComplete = aState === 'complete' && bState === 'complete';
      // Only animate if at least one node is in-progress (exclude both complete and both unavailable)
      const shouldAnimateEdge = isGamified && !bothUnavailable && !bothComplete && (aState === 'in-progress' || bState === 'in-progress');
      
      if (styleDef && styleDef.edgeColor && styleDef.edgeColor !== 'auto') {
        edgeColor = styleDef.edgeColor;
        edgeGlow = styleDef.edgeGlow || false;
      } else {
        edgeColor = chooseEdgeColor();
      }
      
      // compute bezier control points
      // For gamified style, use rightAngles=true to create perfect 90-degree angles
      const controls = computeBezierControls(sx1, sy1, sx2, sy2, e.fromSide, e.toSide, rFrom, rTo, isGamified);
      
      // Choose drawing function: rigid bezier for gamified, smooth bezier otherwise
      const drawBezier = isGamified ? drawRigidBezierArrow : drawBezierArrow;
      
      // Draw animated particles on edges for gamified style (only for complete/in-progress connections)
      if (edgeGlow && styleDef?.animated && shouldAnimateEdge) {
        const particleCount = 3;
        const particleSpeed = this._animationTime * 0.002;
        for (let i = 0; i < particleCount; i++) {
          const particlePhase = (particleSpeed + i / particleCount) % 1;
          const midX = sx1 + (sx2 - sx1) * particlePhase;
          const midY = sy1 + (sy2 - sy1) * particlePhase;
          context.beginPath();
          context.fillStyle = edgeColor;
          context.globalAlpha = 0.8;
          context.arc(midX, midY, 3 / this.scale, 0, Math.PI * 2);
          context.fill();
          context.globalAlpha = 1.0;
        }
      }
      
      if (useBezier || edgeStyle === 'gradient') {
        if (edgeStyle === 'gradient' && edgeGlow && shouldAnimateEdge) {
          // Draw gradient edge with glow (only for complete/in-progress connections)
          const gradient = context.createLinearGradient(sx1, sy1, sx2, sy2);
          gradient.addColorStop(0, 'rgba(255, 215, 0, 0.3)');
          gradient.addColorStop(0.5, edgeColor);
          gradient.addColorStop(1, 'rgba(255, 215, 0, 0.3)');
          
          // Glow layer
          context.shadowBlur = 15 / this.scale;
          context.shadowColor = edgeColor;
          context.lineWidth = 8 * this.scale;
          context.strokeStyle = gradient;
          context.globalAlpha = 0.4;
          drawBezier(context, sx1, sy1, controls.c1x, controls.c1y, controls.c2x, controls.c2y, sx2, sy2, this.scale);
          context.globalAlpha = 1.0;
          context.shadowBlur = 0;
          
          // Main edge
          context.lineWidth = 3 * this.scale;
          context.strokeStyle = gradient;
          context.fillStyle = edgeColor;
          drawBezier(context, sx1, sy1, controls.c1x, controls.c1y, controls.c2x, controls.c2y, sx2, sy2, this.scale);
        } else if (edgeGlow) {
          // Draw glow effect for gamified style
          context.shadowBlur = 15 / this.scale;
          context.shadowColor = edgeColor;
          context.lineWidth = 8 * this.scale;
          context.strokeStyle = edgeColor;
          context.globalAlpha = 0.4;
          drawBezier(context, sx1, sy1, controls.c1x, controls.c1y, controls.c2x, controls.c2y, sx2, sy2, this.scale);
          context.globalAlpha = 1.0;
          context.shadowBlur = 0;
          // draw main edge
          context.lineWidth = 2 * this.scale;
          context.strokeStyle = edgeColor;
          context.fillStyle = edgeColor;
          drawBezier(context, sx1, sy1, controls.c1x, controls.c1y, controls.c2x, controls.c2y, sx2, sy2, this.scale);
        } else {
          // draw halo for contrast
          context.lineWidth = 6 * this.scale;
          context.strokeStyle = (edgeColor === '#fff' ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.12)');
          drawBezier(context, sx1, sy1, controls.c1x, controls.c1y, controls.c2x, controls.c2y, sx2, sy2, this.scale);
          // draw main edge
          context.lineWidth = 2 * this.scale;
          context.strokeStyle = edgeColor;
          context.fillStyle = edgeColor;
          drawBezier(context, sx1, sy1, controls.c1x, controls.c1y, controls.c2x, controls.c2y, sx2, sy2, this.scale);
        }
      } else {
        // Straight or wavy edges
        if (edgeStyle === 'wavy' && edgeGlow && shouldAnimateEdge) {
          // Draw wavy edge with glow (only for complete/in-progress connections)
          const dx = sx2 - sx1;
          const dy = sy2 - sy1;
          const distance = Math.hypot(dx, dy);
          const waveAmplitude = 8 / this.scale;
          const waveFrequency = distance / 50;
          const wavePhase = this._animationTime * 0.001;
          
          context.beginPath();
          context.moveTo(sx1, sy1);
          const steps = Math.max(20, Math.floor(distance / 5));
          for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const baseX = sx1 + dx * t;
            const baseY = sy1 + dy * t;
            const perpX = -dy / distance;
            const perpY = dx / distance;
            const waveOffset = Math.sin(waveFrequency * t * Math.PI * 2 + wavePhase) * waveAmplitude;
            context.lineTo(baseX + perpX * waveOffset, baseY + perpY * waveOffset);
          }
          
          // Glow
          context.shadowBlur = 15 / this.scale;
          context.shadowColor = edgeColor;
          context.lineWidth = 8 * this.scale;
          context.strokeStyle = edgeColor;
          context.globalAlpha = 0.4;
          context.stroke();
          context.globalAlpha = 1.0;
          context.shadowBlur = 0;
          
          // Main wavy line
          context.lineWidth = 3 * this.scale;
          context.strokeStyle = edgeColor;
          context.stroke();
          
          // Draw arrowhead at end
          const angle = Math.atan2(dy, dx);
          const headLen = 12 / this.scale;
          const p1x = sx2 - headLen * Math.cos(angle - Math.PI / 6);
          const p1y = sy2 - headLen * Math.sin(angle - Math.PI / 6);
          const p2x = sx2 - headLen * Math.cos(angle + Math.PI / 6);
          const p2y = sy2 - headLen * Math.sin(angle + Math.PI / 6);
          context.beginPath();
          context.moveTo(sx2, sy2);
          context.lineTo(p1x, p1y);
          context.lineTo(p2x, p2y);
          context.closePath();
          context.fillStyle = edgeColor;
          context.fill();
        } else if (edgeGlow) {
          // Draw glow effect for gamified style
          context.shadowBlur = 15 / this.scale;
          context.shadowColor = edgeColor;
          context.lineWidth = 8 * this.scale;
          context.strokeStyle = edgeColor;
          context.globalAlpha = 0.4;
          drawArrow(context, sx1, sy1, sx2, sy2, this.scale);
          context.globalAlpha = 1.0;
          context.shadowBlur = 0;
          // draw main edge
          context.lineWidth = 2 * this.scale;
          context.strokeStyle = edgeColor;
          context.fillStyle = edgeColor;
          drawArrow(context, sx1, sy1, sx2, sy2, this.scale);
        } else {
          // draw halo for contrast (straight)
          context.lineWidth = 6 * this.scale;
          context.strokeStyle = (edgeColor === '#fff' ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.12)');
          drawArrow(context, sx1, sy1, sx2, sy2, this.scale);
          // draw main edge
          context.lineWidth = 2 * this.scale;
          context.strokeStyle = edgeColor;
          context.fillStyle = edgeColor;
          drawArrow(context, sx1, sy1, sx2, sy2, this.scale);
        }
      }
      context.restore();
    }

    for (const n of this.nodes) {
      const r = (this.nodeRadii[n.id] || this.settings.nodeRadius || 36);
      context.beginPath();
      
      // Check if node has a file but the file doesn't have the correct ID
      const hasFileLinkIssue = n.fileLink && !this.nodeFileHasCorrectId(n);
      
      // fill/stroke depending on state - use actual state from node object
      const nodeState = n.state || 'in-progress';
      
      // Get colors from style or use defaults
      const selectedStyle = this.settings.style || 'gamified';
      const styleDef = SKILL_TREE_STYLES[selectedStyle];
      
      if (hasFileLinkIssue) {
        // Node has a file but the file doesn't have the correct ID
        if (styleDef && styleDef.nodeColors) {
          context.fillStyle = styleDef.nodeColors.error.fill;
          context.strokeStyle = styleDef.nodeColors.error.stroke;
        } else {
          context.fillStyle = '#f44336';
          context.strokeStyle = '#c62828';
        }
      } else if (nodeState === 'complete') {
        if (styleDef && styleDef.nodeColors) {
          context.fillStyle = styleDef.nodeColors.complete.fill;
          context.strokeStyle = styleDef.nodeColors.complete.stroke;
        } else {
          context.fillStyle = '#4caf50';
          context.strokeStyle = '#2e7d32';
        }
      } else if (nodeState === 'unavailable') {
        if (styleDef && styleDef.nodeColors) {
          context.fillStyle = styleDef.nodeColors.unavailable.fill;
          context.strokeStyle = styleDef.nodeColors.unavailable.stroke;
        } else {
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
        }
      } else {
        // in-progress
        if (styleDef && styleDef.nodeColors) {
          context.fillStyle = styleDef.nodeColors.inProgress.fill;
          context.strokeStyle = styleDef.nodeColors.inProgress.stroke;
        } else {
          context.fillStyle = '#2b6';
          context.strokeStyle = '#173';
        }
      }
      context.lineWidth = 4 / this.scale;
      
      // Determine the shape to use (node shape from frontmatter takes precedence, then style default)
      // Get default shape based on style if node doesn't have a shape
      const defaultShape = styleDef?.nodeShape || 'circle';
      // Node's shape from frontmatter takes precedence over style default
      const effectiveShape = n.shape || defaultShape;
      const isAnimated = styleDef && styleDef.animated;
      
      // Check for state change animation
      const stateChangeAnim = this._nodeStateChangeAnimations.get(n.id);
      const animElapsed = stateChangeAnim ? (this._animationTime - stateChangeAnim.startTime) : Infinity;
      const animDuration = 2000; // 2 seconds
      const animProgress = Math.min(1, animElapsed / animDuration);
      const isAnimating = stateChangeAnim && animProgress < 1;
      
      // Add glow effect for gamified style (only for active nodes)
      const shouldGlow = styleDef && styleDef.edgeGlow && !hasFileLinkIssue && nodeState !== 'unavailable';
      if (shouldGlow) {
        // Save current fill style for glow
        const glowColor = context.fillStyle;
        let glowIntensity = 20 / this.scale;
        
        // No enhanced glow animations - only edges are animated
        
        context.shadowBlur = glowIntensity;
        context.shadowColor = glowColor;
        context.globalAlpha = 0.6;
        context.beginPath();
        // Draw glow with appropriate shape
        this.drawNodeShape(context, n.x, n.y, r, effectiveShape);
        context.fill();
        context.globalAlpha = 1.0;
        context.shadowBlur = 0;
        // Restore fill style
        context.fillStyle = glowColor;
      }
      
      // Add rotation animation for in-progress nodes in gamified style
      if (isAnimated && nodeState === 'in-progress' && !hasFileLinkIssue) {
        const rotation = (this._animationTime * 0.001) % (Math.PI * 2); // Slow rotation
        context.save();
        context.translate(n.x, n.y);
        context.rotate(rotation);
        context.translate(-n.x, -n.y);
      }
      
      // Draw the node shape
      context.beginPath();
      this.drawNodeShape(context, n.x, n.y, r, effectiveShape);
      context.fill();
      context.stroke();
      
      // Restore transform if rotation was applied
      if (isAnimated && nodeState === 'in-progress' && !hasFileLinkIssue) {
        context.restore();
      }
      
      // Remove node shimmer, particle burst, and ripple animations - only animate edges
      
      // draw selection highlight if this node is selected with pulsing animation
      if (this.selectedNodeId === n.id) {
        // Use sine wave for smooth pulsing (pulse between 6 and 10 pixels extra radius)
        const pulseAmount = 6 + 4 * Math.sin(this._animationTime / 500); // 500ms period
        context.beginPath();
        context.lineWidth = 4 / this.scale;
        context.strokeStyle = 'rgba(255,165,0,0.95)';
        // Draw selection highlight with appropriate shape
        const expandedR = r + (pulseAmount / this.scale);
        this.drawNodeShape(context, n.x, n.y, expandedR, effectiveShape);
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
      const words = (this.getNodeDisplayLabel(n) || '').split(/\s+/).filter(Boolean);
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
        // Take first part before ---
        fileName = fileName.split(' --- ')[0].trim();
      } else {
        // No file link, show prompt
        fileName = 'Right click to add note';
      }

      const lineHeight = 16 / this.scale;
      // Start drawing so the block of text is vertically centered around n.y
      const totalLines = lines.length + (fileName ? 1 : 0);
      const firstLineY = n.y - ((totalLines - 1) * lineHeight) / 2;

      // Determine fill style - use engraved effect for unavailable nodes in gamified mode
      const isGamifiedUnavailable = (selectedStyle === 'gamified' && nodeState === 'unavailable');
      
      if (isGamifiedUnavailable) {
        // Engraved impression effect: draw darker shadow first, then lighter text on top
        context.shadowColor = 'rgba(0, 0, 0, 0.8)';
        context.shadowBlur = 0;
        context.shadowOffsetX = 1 / this.scale;
        context.shadowOffsetY = 1 / this.scale;
        context.fillStyle = 'rgba(200, 200, 200, 0.4)'; // Light gray for engraved look
      } else {
        context.fillStyle = labelTextColor;
      }

      // Draw wrapped label lines
      for (let i = 0; i < lines.length; i++) {
        const text = lines[i];
        const y = firstLineY + i * lineHeight;
        
        if (isGamifiedUnavailable) {
          // Draw shadow/engraved effect
          context.save();
          context.shadowColor = 'rgba(0, 0, 0, 0.6)';
          context.shadowBlur = 2 / this.scale;
          context.shadowOffsetX = 1 / this.scale;
          context.shadowOffsetY = 1 / this.scale;
          context.fillStyle = 'rgba(0, 0, 0, 0.5)'; // Dark shadow
          context.fillText(text, n.x, y);
          context.restore();
          
          // Draw lighter text on top for engraved effect
          context.fillStyle = 'rgba(255, 255, 255, 0.7)'; // Light text
          context.fillText(text, n.x, y);
        } else {
          context.fillText(text, n.x, y);
        }
      }

      // Draw file name on its own line below wrapped label lines
      if (fileName) {
        context.font = `${12 / this.scale}px sans-serif`;
        
        if (isGamifiedUnavailable) {
          // Draw shadow/engraved effect for filename
          context.save();
          context.shadowColor = 'rgba(0, 0, 0, 0.6)';
          context.shadowBlur = 2 / this.scale;
          context.shadowOffsetX = 1 / this.scale;
          context.shadowOffsetY = 1 / this.scale;
          context.fillStyle = 'rgba(0, 0, 0, 0.5)'; // Dark shadow
          const y = firstLineY + lines.length * lineHeight;
          context.fillText(fileName, n.x, y);
          context.restore();
          
          // Draw lighter text on top
          context.fillStyle = 'rgba(255, 255, 255, 0.7)'; // Light text
          context.fillText(fileName, n.x, y);
        } else {
          context.fillStyle = labelTextColor;
          const y = firstLineY + lines.length * lineHeight;
          context.fillText(fileName, n.x, y);
        }
        
        context.font = `${14 / this.scale}px sans-serif`;
      }
      
      // Reset shadow
      context.shadowBlur = 0;
      context.shadowOffsetX = 0;
      context.shadowOffsetY = 0;
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
      const tempFromSide = this.creatingEdgeFromSide || this.getSideBetween(this.creatingEdgeFrom, { id: -1, x: bx, y: by, state: 'unavailable' });
      const tempControls = computeBezierControls(sx1, sy1, bx, by, tempFromSide, null, r, 0);
      const isGamifiedTemp = (this.settings.style || 'default') === 'gamified';
      const useBezierTemp = isGamifiedTemp || this.settings.showBezier;
      const drawBezierTemp = isGamifiedTemp ? drawRigidBezierArrow : drawBezierArrow;
      if (useBezierTemp) {
        context.lineWidth = 3 / this.scale;
        context.strokeStyle = (tempColor === '#fff' ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.10)');
        drawBezierTemp(context, sx1, sy1, tempControls.c1x, tempControls.c1y, tempControls.c2x, tempControls.c2y, bx, by, this.scale);
        context.lineWidth = 1 / this.scale;
        context.strokeStyle = tempColor;
        context.fillStyle = tempColor;
        drawBezierTemp(context, sx1, sy1, tempControls.c1x, tempControls.c1y, tempControls.c2x, tempControls.c2y, bx, by, this.scale);
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
      const nodeExp = node.exp !== undefined ? node.exp : 10;
      totalAvailableExp += nodeExp;
      
      // Only count exp from completed nodes
      if (node.state === 'complete') {
        totalExp += nodeExp;
      }
    }
    
    // Check if exp just reached total (for animation)
    if (totalExp === totalAvailableExp && totalAvailableExp > 0 && this._previousTotalExp < totalAvailableExp) {
      // Exp just reached total - trigger animation
      this._expOverlayAnimation = { startTime: this._animationTime, active: true };
    }
    this._previousTotalExp = totalExp;
    
    // Clean up animation after 2 seconds
    if (this._expOverlayAnimation && this._animationTime - this._expOverlayAnimation.startTime > 2000) {
      this._expOverlayAnimation = null;
    }
    
    // Get theme-aware colors with better styling
    let textColor = '#000';
    let bgColor = 'rgba(255, 255, 255, 0.95)';
    let borderColor = 'rgba(0, 0, 0, 0.2)';
    try {
      const docStyle = getComputedStyle(document.documentElement);
      const textVar = docStyle.getPropertyValue('--text-normal');
      const bgVar = docStyle.getPropertyValue('--background-primary');
      const borderVar = docStyle.getPropertyValue('--background-modifier-border');
      if (textVar && textVar.trim()) textColor = textVar.trim();
      if (bgVar && bgVar.trim()) {
        // Make background more opaque for better readability
        bgColor = bgVar.trim();
        // Convert to rgba if needed
        if (bgColor.startsWith('#')) {
          const r = parseInt(bgColor.slice(1, 3), 16);
          const g = parseInt(bgColor.slice(3, 5), 16);
          const b = parseInt(bgColor.slice(5, 7), 16);
          bgColor = `rgba(${r}, ${g}, ${b}, 0.95)`;
        } else if (bgColor.startsWith('rgb')) {
          bgColor = bgColor.replace('rgb', 'rgba').replace(')', ', 0.95)');
        }
      }
      if (borderVar && borderVar.trim()) {
        borderColor = borderVar.trim();
      }
    } catch (e) {}
    
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset to device pixels
    
    const padding = 12;
    const fontSize = 15;
    const borderRadius = 8;
    ctx.font = `600 ${fontSize}px sans-serif`; // Make font bolder
    
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
    
    // Draw rounded background box with shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 2;
    
    // Apply animation effects if exp just reached total
    let scale = 1;
    let glowIntensity = 0;
    if (this._expOverlayAnimation && this._expOverlayAnimation.active) {
      const animElapsed = this._animationTime - this._expOverlayAnimation.startTime;
      const animDuration = 2000; // 2 seconds
      const animProgress = Math.min(1, animElapsed / animDuration);
      
      // Pulse scale effect
      const pulsePhase = animProgress * Math.PI * 4; // 2 pulses
      scale = 1 + Math.sin(pulsePhase) * 0.15 * (1 - animProgress); // Start at 1.15x, fade to 1x
      
      // Glow effect
      glowIntensity = (1 - animProgress) * 20; // Fade from 20 to 0
    }
    
    // Apply scale transform
    const centerX = x + boxWidth / 2;
    const centerY = y + boxHeight / 2;
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.scale(scale, scale);
    ctx.translate(-centerX, -centerY);
    
    // Draw glow if animating
    if (glowIntensity > 0) {
      ctx.shadowColor = '#4caf50'; // Green glow
      ctx.shadowBlur = glowIntensity;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }
    
    // Draw rounded rectangle
    ctx.beginPath();
    ctx.moveTo(x + borderRadius, y);
    ctx.lineTo(x + boxWidth - borderRadius, y);
    ctx.quadraticCurveTo(x + boxWidth, y, x + boxWidth, y + borderRadius);
    ctx.lineTo(x + boxWidth, y + boxHeight - borderRadius);
    ctx.quadraticCurveTo(x + boxWidth, y + boxHeight, x + boxWidth - borderRadius, y + boxHeight);
    ctx.lineTo(x + borderRadius, y + boxHeight);
    ctx.quadraticCurveTo(x, y + boxHeight, x, y + boxHeight - borderRadius);
    ctx.lineTo(x, y + borderRadius);
    ctx.quadraticCurveTo(x, y, x + borderRadius, y);
    ctx.closePath();
    ctx.fillStyle = bgColor;
    ctx.fill();
    
    // Draw border
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // Reset shadow
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    
    // Draw text with better positioning
    ctx.fillStyle = textColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(expText, x + padding, y + boxHeight / 2);
    
    ctx.restore();
  }

  /**
   * Center and zoom on a specific point in world coordinates
   */
  centerAndZoomOnPoint(worldX: number, worldY: number, zoomLevel: number = 2.0) {
    if (!this.canvas) return;
    
    // Set the zoom level
    this.scale = Math.max(0.2, Math.min(3, zoomLevel));
    
    // Calculate offset to center the point on screen
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    
    // Convert world point to screen coordinates at current scale
    // Then adjust offset so it appears at center
    this.offset.x = centerX - worldX * this.scale;
    this.offset.y = centerY - worldY * this.scale;
    
    // Check if we're zooming to a selected task with children and show modal
    if (this.selectedTask) {
      const tasks = this._tasksCache.get(this.selectedTask.nodeId) || [];
      const task = tasks[this.selectedTask.taskIndex];
      if (task && task.children && task.children.length > 0) {
        const node = this.nodes.find(n => n.id === this.selectedTask!.nodeId);
        if (node) {
          this.showTaskChildrenModal(node, this.selectedTask.taskIndex, task);
        }
      } else {
        this.closeTaskChildrenModal();
      }
    }
    
    this.render();
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
      
      // Get default shape based on current style
      const selectedStyle = this.settings.style || 'gamified';
      const styleDef = SKILL_TREE_STYLES[selectedStyle];
      let defaultShape = styleDef?.nodeShape || 'circle';
      // Filter out 'star' as it's not a valid node shape (only style shape)
      if (defaultShape === 'star') {
        defaultShape = 'circle';
      }
      
      // Load exp from file frontmatter or default to 10, and set default shape if missing
      for (const node of this.nodes) {
        // Set default shape if node doesn't have one
        if (!node.shape) {
          node.shape = defaultShape as 'circle' | 'square' | 'hexagon' | 'diamond';
        }
        
        if (node.fileLink) {
          // Try to load exp from file frontmatter
          try {
            let normalizedPath = node.fileLink.trim();
            if (normalizedPath.startsWith('/')) normalizedPath = normalizedPath.substring(1);
            if (!normalizedPath.endsWith('.md')) normalizedPath = normalizedPath + '.md';
            
            const file = this.app.vault.getAbstractFileByPath(normalizedPath);
            if (file && file instanceof TFile) {
              const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
              const fileExp = frontmatter?.['skilltree-node-exp'];
              if (fileExp !== undefined && typeof fileExp === 'number') {
                node.exp = fileExp;
              } else {
                // File exists but no exp in frontmatter, default to 10
                node.exp = 10;
              }
            } else {
              // File doesn't exist, default to 10
              node.exp = 10;
            }
          } catch (e) {
            // Error reading file, default to 10
            node.exp = 10;
          }
        } else {
          // No file link, default to 10
          if (node.exp === undefined) {
            node.exp = 10;
          }
        }
      }

      // Sync node IDs with file frontmatter - node ID takes precedence
      // If a node has a fileLink, ensure the file's frontmatter matches the node's ID
      for (const node of this.nodes) {
        if (node.fileLink) {
          try {
            let normalizedPath = node.fileLink.trim();
            if (normalizedPath.startsWith('/')) normalizedPath = normalizedPath.substring(1);
            if (!normalizedPath.endsWith('.md')) normalizedPath = normalizedPath + '.md';
            
            const file = this.app.vault.getAbstractFileByPath(normalizedPath);
            if (file && file instanceof TFile) {
              const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
              const fileNodeId = frontmatter?.['skilltree-node'];
              
              // If file has a different ID, update it to match the node's ID (node ID takes precedence)
              if (fileNodeId !== undefined && fileNodeId !== node.id) {
                await this.updateFileFrontmatterWithNodeId(node.fileLink, node.id);
              } else if (fileNodeId === undefined) {
                // File doesn't have the ID, add it
                await this.updateFileFrontmatterWithNodeId(node.fileLink, node.id);
              }
            }
          } catch (e) {
            console.warn('Failed to sync node ID with file:', e);
          }
        }
      }

      // Associate existing notes with nodes using Dataview
      await this.associateNotesWithNodes();

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
      if (typeof watcher === 'function') {
        watcher();
      }
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
    const wasCurrentTree = this.settings.currentTreeName === name;
    
    // Delete the tree from settings - ensure it's actually removed
    if (this.settings.trees[name]) {
      delete this.settings.trees[name];
    }
    
    // Verify deletion
    if (this.settings.trees[name]) {
      console.error('Failed to delete tree:', name);
      return;
    }
    
    if (wasCurrentTree) {
      // Switch to first available tree (but don't save the deleted tree first)
      const remainingTrees = Object.keys(this.settings.trees);
      if (remainingTrees.length > 0) {
        const firstTree = remainingTrees[0];
        // Switch without saving the deleted tree
        this.settings.currentTreeName = firstTree;
        if (!this.settings.trees[firstTree]) {
          this.settings.trees[firstTree] = {
            name: firstTree,
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
      } else {
        // No trees left - create a default one
        this.settings.trees['default'] = {
          name: 'default',
          nodes: [],
          edges: []
        };
        this.settings.currentTreeName = 'default';
        await this.loadNodes();
        
        // Clean up file watchers
        this._fileWatchers.forEach((watcher) => {
          this.app.vault.off('modify', watcher);
        });
        this._fileWatchers.clear();
        this._tasksCache.clear();
        
        // Reload tasks
        await this.loadAllNodeTasks();
      }
      
      await this.plugin.saveSettings();
      this.render();
    } else {
      // Not the current tree, just save settings
      await this.plugin.saveSettings();
    }
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
        const words = (this.getNodeDisplayLabel(n) || '').split(/\s+/).filter(Boolean);
        const lines: string[] = [];
        for (let i = 0; i < words.length; i += 4) lines.push(words.slice(i, i + 4).join(' '));
        if (lines.length === 0) lines.push('');
        // Always have a filename/prompt line
        const totalLines = lines.length + 1;
        const firstLineY = n.y - ((totalLines - 1) * lineHeight) / 2;
        let textBottomY = firstLineY + (lines.length - 1) * lineHeight;
        textBottomY += lineHeight; // filename/prompt occupies another line
        
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
      // Get effective shape (node shape or style default)
      const selectedStyle = this.settings.style || 'gamified';
      const styleDef = SKILL_TREE_STYLES[selectedStyle];
      const defaultShape = styleDef?.nodeShape || 'circle';
      const effectiveShape = n.shape || defaultShape;
      
      if (effectiveShape === 'square' || effectiveShape === 'diamond') {
        // Square/Diamond collision: axis-aligned bounding box
        if (x >= n.x - r && x <= n.x + r && y >= n.y - r && y <= n.y + r) {
          return n;
        }
      } else {
        // Circle/Hexagon/Star collision: distance check
        const dx = x - n.x;
        const dy = y - n.y;
        if (dx * dx + dy * dy <= r * r) return n;
      }
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
      const isGamifiedStyle = (this.settings.style || 'default') === 'gamified';
      const useBezierForHitTest = isGamifiedStyle || this.settings.showBezier;
      if (useBezierForHitTest) {
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
        const prevState = this._previousNodeStates.get(node.id);
        const selectedStyle = this.settings.style || 'gamified';
        const isGamified = selectedStyle === 'gamified';
        
        // Track state change for animation
        if (prevState !== selected && isGamified) {
          if (selected === 'complete' || (selected === 'in-progress' && prevState === 'unavailable')) {
            this._nodeStateChangeAnimations.set(node.id, { type: selected, startTime: this._animationTime });
          }
        }
        
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
    header.createEl('h3', { text: this.getNodeDisplayLabel(node) || 'Node' }).style.margin = '0';
    
    // Add note link in bottom right if there's a file link
    const headerRight = header.createDiv();
    headerRight.style.display = 'flex';
    headerRight.style.flexDirection = 'column';
    headerRight.style.alignItems = 'flex-end';
    
    modal.createEl('span', { text: 'Stats' }).style.fontWeight = '600';
    
    if (node.fileLink) {
      const noteLink = headerRight.createEl('a', { 
        text: '📄 ' + this.getNodeDisplayLabel(node),
        href: '#' 
      });
      noteLink.style.fontSize = '12px';
      noteLink.style.color = 'var(--text-accent)';
      noteLink.style.textDecoration = 'underline';
      noteLink.style.cursor = 'pointer';
      noteLink.style.marginTop = '4px';
      
      // Click handler to open/create the file
      noteLink.addEventListener('click', async (e) => {
        e.preventDefault();
        
        let normalizedPath = node.fileLink!.trim();
        if (!normalizedPath.endsWith('.md')) {
          normalizedPath = normalizedPath + '.md';
        }
        const file = this.app.vault.getAbstractFileByPath(normalizedPath);
        
        if (file && file instanceof TFile) {
          // File exists, open it and update frontmatter
          try {
            await this.app.workspace.openLinkText(node.fileLink!, '', false);
            await this.updateFileFrontmatterWithNodeId(node.fileLink, node.id);
          } catch (err) {
            console.error('Failed to open note:', err);
          }
        } else {
          // File doesn't exist, show creation modal
          this.showCreateFileModal(node);
        }
      });
      
      // Hover handler to show file content
      let hoverPopup: HTMLElement | null = null;
      noteLink.addEventListener('mouseenter', async (e) => {
        if (hoverPopup) return;
        
        try {
          const file = this.app.vault.getAbstractFileByPath(node.fileLink!);
          if (file && file instanceof TFile) {
            const content = await this.app.vault.read(file);
            
            hoverPopup = document.body.createEl('div');
            hoverPopup.style.position = 'fixed';
            hoverPopup.style.left = (e.clientX + 10) + 'px';
            hoverPopup.style.top = (e.clientY + 10) + 'px';
            hoverPopup.style.background = 'var(--background-primary)';
            hoverPopup.style.border = '1px solid var(--background-modifier-border)';
            hoverPopup.style.borderRadius = '4px';
            hoverPopup.style.padding = '12px';
            hoverPopup.style.maxWidth = '400px';
            hoverPopup.style.maxHeight = '300px';
            hoverPopup.style.overflow = 'auto';
            hoverPopup.style.zIndex = '1000';
            hoverPopup.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
            
            const textarea = hoverPopup.createEl('textarea');
            textarea.value = content;
            textarea.style.width = '100%';
            textarea.style.height = '100%';
            textarea.style.border = 'none';
            textarea.style.background = 'transparent';
            textarea.style.resize = 'none';
            textarea.style.fontFamily = 'var(--font-interface)';
            textarea.style.fontSize = '14px';
            
            // Auto-save on change
            textarea.addEventListener('input', async () => {
              try {
                await this.app.vault.modify(file, textarea.value);
              } catch (err) {
                console.error('Failed to save note:', err);
              }
            });
            
            document.body.appendChild(hoverPopup);
          }
        } catch (err) {
          console.error('Failed to read note:', err);
        }
      });
      
      noteLink.addEventListener('mouseleave', () => {
        if (hoverPopup) {
          document.body.removeChild(hoverPopup);
          hoverPopup = null;
        }
      });
      
      // Update popup position on mouse move
      noteLink.addEventListener('mousemove', (e) => {
        if (hoverPopup) {
          hoverPopup.style.left = (e.clientX + 10) + 'px';
          hoverPopup.style.top = (e.clientY + 10) + 'px';
        }
      });
    }

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
      const childLabel = li.createEl('span', { text: this.getNodeDisplayLabel(child) || 'Node' });

      // grandchildren
      const grandchildren = childrenOf(child.id);
      if (grandchildren.length > 0) {
        const subUl = li.createEl('ul');
        subUl.style.margin = '4px 0 0 12px';
        subUl.style.paddingLeft = '12px';
        for (const gc of grandchildren) {
          const gLi = subUl.createEl('li');
          gLi.style.marginBottom = '4px';
          gLi.createEl('span', { text: this.getNodeDisplayLabel(gc) || 'Node' });

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

  async changeNodeIdFromFrontmatter(node: SkillNode, newId: number): Promise<void> {
    // Check if new ID is already taken
    if (this.nodes.some(n => n.id === newId && n !== node)) {
      // Find a unique ID
      let uniqueId = newId;
      while (this.nodes.some(n => n.id === uniqueId)) {
        uniqueId++;
      }
      newId = uniqueId;
      // Update the frontmatter to reflect the adjusted ID
      if (node.fileLink) {
        await this.app.fileManager.processFrontMatter(
          this.app.vault.getAbstractFileByPath(node.fileLink) as TFile,
          (frontmatter) => {
            frontmatter['skilltree-node'] = newId;
          }
        );
      }
    }
    
    const oldId = node.id;
    this.recordSnapshot();
    
    // Update node ID
    node.id = newId;
    
    // Update all edges that reference this node
    this.edges.forEach(edge => {
      if (edge.from === oldId) edge.from = newId;
      if (edge.to === oldId) edge.to = newId;
    });
    
    // Update frontmatter of connected nodes (but not this node's frontmatter since it was just updated)
    const connectedNodeIds = new Set<number>();
    this.edges.forEach(edge => {
      if (edge.from === newId || edge.to === newId) {
        connectedNodeIds.add(edge.from);
        connectedNodeIds.add(edge.to);
      }
    });
    for (const connectedId of connectedNodeIds) {
      if (connectedId !== newId) {
        const connectedNode = this.nodes.find(n => n.id === connectedId);
        if (connectedNode?.fileLink) {
          await this.updateFileFrontmatterWithNodeId(connectedNode.fileLink, connectedId);
        }
      }
    }
    
    // Update cached data
    if (this._tasksCache.has(oldId)) {
      this._tasksCache.set(newId, this._tasksCache.get(oldId)!);
      this._tasksCache.delete(oldId);
    }
    if (this._taskPositions.has(oldId)) {
      this._taskPositions.set(newId, this._taskPositions.get(oldId)!);
      this._taskPositions.delete(oldId);
    }
    if (this._fileWatchers.has(oldId)) {
      this._fileWatchers.set(newId, this._fileWatchers.get(oldId)!);
      this._fileWatchers.delete(oldId);
    }
    if (this._lastKnownNodeIds.has(node.fileLink!)) {
      this._lastKnownNodeIds.set(node.fileLink!, newId);
    }
    
    // Update selected node ID if it was this node
    if (this.selectedNodeId === oldId) {
      this.selectedNodeId = newId;
    }
    
    await this.saveNodes();
    this.render();
  }

  async changeNodeId(node: SkillNode, newId: number): Promise<void> {
    // Check if new ID is already taken
    if (this.nodes.some(n => n.id === newId && n !== node)) {
      // Find a unique ID
      let uniqueId = newId;
      while (this.nodes.some(n => n.id === uniqueId)) {
        uniqueId++;
      }
      newId = uniqueId;
    }
    
    const oldId = node.id;
    this.recordSnapshot();
    
    // Update node ID
    node.id = newId;
    
    // Update all edges that reference this node
    this.edges.forEach(edge => {
      if (edge.from === oldId) edge.from = newId;
      if (edge.to === oldId) edge.to = newId;
    });
    
    // Update frontmatter if node has a file link
    if (node.fileLink) {
      await this.updateFileFrontmatterWithNodeId(node.fileLink, newId);
    }
    
    // Update frontmatter of nodes connected to this node
    const connectedNodeIds = new Set<number>();
    this.edges.forEach(edge => {
      if (edge.from === newId || edge.to === newId) {
        connectedNodeIds.add(edge.from);
        connectedNodeIds.add(edge.to);
      }
    });
    for (const connectedId of connectedNodeIds) {
      if (connectedId !== newId) {
        const connectedNode = this.nodes.find(n => n.id === connectedId);
        if (connectedNode?.fileLink) {
          await this.updateFileFrontmatterWithNodeId(connectedNode.fileLink, connectedId);
        }
      }
    }
    
    // Update cached data
    if (this._tasksCache.has(oldId)) {
      this._tasksCache.set(newId, this._tasksCache.get(oldId)!);
      this._tasksCache.delete(oldId);
    }
    if (this._taskPositions.has(oldId)) {
      this._taskPositions.set(newId, this._taskPositions.get(oldId)!);
      this._taskPositions.delete(oldId);
    }
    if (this._fileWatchers.has(oldId)) {
      this._fileWatchers.set(newId, this._fileWatchers.get(oldId)!);
      this._fileWatchers.delete(oldId);
    }
    
    // Update selected node ID if it was this node
    if (this.selectedNodeId === oldId) {
      this.selectedNodeId = newId;
    }
    
    await this.saveNodes();
    this.render();
  }

  async showCreateFileModal(node: SkillNode) {
    // create an in-DOM modal inside the view so clicks always work
    if (!this.containerEl) {
      return;
    }
    // ensure only one modal is open
    this.closeAllModals();
    const modal = this.containerEl.createDiv({ cls: 'skill-tree-node-modal' });
    // Style the modal to be visible in center
    this.openModal(modal);
    
    // close modal on outside click
    this.installOutsideClickHandler(modal);
    
    // Modal content
    const h3 = modal.createEl('h3', { text: 'Create Note' });
    h3.style.marginTop = '0';
    h3.style.marginBottom = '16px';
    
    const p = modal.createEl('p', { text: `The file "${node.fileLink}" does not exist. Would you like to create it?` });
    p.style.marginBottom = '16px';
    
    // Actions
    const actions = modal.createDiv({ cls: 'st-actions' });
    actions.style.display = 'flex';
    actions.style.gap = '8px';
    actions.style.justifyContent = 'flex-end';
    actions.style.marginTop = '16px';
    
    const cancelBtn = actions.createEl('button', { text: 'Cancel' });
    cancelBtn.style.padding = '6px 12px';
    cancelBtn.onclick = () => { 
      modal.remove(); 
      this.removeOutsideClickHandler(); 
    };
    
    const createBtn = actions.createEl('button', { text: 'Create & Open' });
    createBtn.style.padding = '6px 12px';
    createBtn.style.backgroundColor = 'var(--interactive-accent)';
    createBtn.style.color = 'var(--text-on-accent)';
    createBtn.onclick = async () => {
      try {
        // Create the file
        let filePath = node.fileLink!.trim();
        if (!filePath.endsWith('.md')) {
          filePath = filePath + '.md';
        }
        
        // Build full path using default path from settings
        const fullFilePath = this.buildFilePath(filePath);
        
        // Create the file with initial content
        // Get default shape based on current style
        const selectedStyle = this.settings.style || 'gamified';
        const styleDef = SKILL_TREE_STYLES[selectedStyle];
        let defaultShape = styleDef?.nodeShape || 'circle';
        // Filter out 'star' as it's not a valid node shape (only style shape)
        if (defaultShape === 'star') {
          defaultShape = 'circle';
        }
        const nodeShape = node.shape || defaultShape;
        const initialContent = `---\nskilltree-node: ${node.id}\nskilltree-node-exp: 10\nshape: ${nodeShape}\n---\n\n# ${this.getNodeDisplayLabel(node)}\n\n`;
        await this.app.vault.create(fullFilePath, initialContent);
        
        // Update node.fileLink to the actual created path
        node.fileLink = fullFilePath.replace(/\.md$/, '');
        
        // Update frontmatter to ensure all fields are set correctly
        await this.updateFileFrontmatterWithNodeId(node.fileLink!, node.id);
        
        // Set node exp to 10 (matching the file)
        node.exp = 10;
        
        // Open the file
        await this.app.workspace.openLinkText(node.fileLink!, '', false);
        
        modal.remove();
        this.removeOutsideClickHandler();
      } catch (err) {
        console.error('Failed to create note:', err);
        // Show error message
        p.textContent = `Failed to create file: ${err.message}`;
        p.style.color = 'var(--text-error)';
      }
    };
    
    // Handle Enter/Escape keys
    document.addEventListener('keydown', function handler(e) {
      if (e.key === 'Enter') {
        createBtn.click();
        document.removeEventListener('keydown', handler);
      } else if (e.key === 'Escape') {
        cancelBtn.click();
        document.removeEventListener('keydown', handler);
      }
    });
  }

  async setEditorModalContents(modal: HTMLElement, node: SkillNode) {
    const h3 = modal.createEl('h3', { text: 'Edit Node' });
    h3.style.marginTop = '0';
    h3.style.marginBottom = '16px';
    // state selector (Complete / In-Progress only - Unavailable is NEVER shown or selectable)
    // If node is unavailable, don't show the state selector at all - just show a message
    this.checkEditorModalUnavailableOption(node, modal)
    
    // File link input
    const fileLinkRow = modal.createDiv({ cls: 'st-row' });
    fileLinkRow.style.marginBottom = '12px';
    fileLinkRow.style.display = 'flex';
    fileLinkRow.style.flexDirection = 'column';
    fileLinkRow.style.gap = '4px';
    const fileLinkLabel = fileLinkRow.createEl('label', { text: 'File Link' });
    fileLinkLabel.style.fontWeight = '500';
    const fileLinkInput = fileLinkRow.createEl('input') as HTMLInputElement;
    fileLinkInput.type = 'text';
    fileLinkInput.placeholder = 'e.g., Notes/MyNote.md';
    fileLinkInput.value = node.fileLink || '';
    fileLinkInput.style.width = '100%';
    fileLinkInput.style.padding = '6px';
    
    // Warning message for non-existent files
    const fileWarning = fileLinkRow.createEl('div');
    fileWarning.style.fontSize = '12px';
    fileWarning.style.color = 'var(--text-error)';
    fileWarning.style.marginTop = '4px';
    fileWarning.style.display = 'none';
    fileWarning.textContent = 'File does not exist';
    
    // Open/Create button (created early so checkFileExists can reference it)
    const openCreateRow = fileLinkRow.createDiv({ cls: 'st-row' });
    openCreateRow.style.display = 'flex';
    openCreateRow.style.justifyContent = 'flex-end';
    const openCreateBtn = openCreateRow.createEl('button', { text: 'Open / Create' });
    openCreateBtn.style.padding = '6px 12px';
    openCreateBtn.style.marginTop = '6px';
    
    // Check file existence and metadata as user types
    const checkFileExists = () => {
      const path = fileLinkInput.value.trim();
      if (!path) {
        fileWarning.style.display = 'none';
        openCreateBtn.textContent = 'Open / Create';
        return;
      }
      let normalizedPath = path;
      if (!normalizedPath.endsWith('.md')) {
        normalizedPath = normalizedPath + '.md';
      }
      const file = this.app.vault.getAbstractFileByPath(normalizedPath);
      if (!file || !(file instanceof TFile)) {
        fileWarning.style.display = 'block';
        openCreateBtn.textContent = 'Open / Create';
        return;
      }
      fileWarning.style.display = 'none';
      
      // Check if file has the correct metadata
      try {
        const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
        const existingNodeId = frontmatter?.['skilltree-node'];
        if (existingNodeId !== node.id) {
          // File exists but doesn't have the correct ID - show "Relink" button
          openCreateBtn.textContent = 'Relink';
        } else {
          // File exists and has the correct ID - show "Open / Create" button
          openCreateBtn.textContent = 'Open / Create';
        }
      } catch (e) {
        // If we can't check, default to "Open / Create"
        openCreateBtn.textContent = 'Open / Create';
      }
    };
    
    fileLinkInput.addEventListener('input', checkFileExists);
    fileLinkInput.addEventListener('blur', checkFileExists);
    
    // Initial check
    checkFileExists();
    openCreateBtn.onclick = async (e) => {
      e.preventDefault();
      const path = fileLinkInput.value.trim();
      if (!path) {
        fileWarning.textContent = 'Please enter a file path';
        fileWarning.style.display = 'block';
        fileLinkInput.focus();
        return;
      }
      
      const normalizedPath = path.endsWith('.md') ? path : path + '.md';
      // Ensure node.fileLink is set to the latest input before action
      this.recordSnapshot();
      const oldFileLink = node.fileLink;
      node.fileLink = path;
      if (oldFileLink !== node.fileLink) {
        if (oldFileLink) this._lastKnownNodeIds.delete(oldFileLink);
        this._lastKnownNodeIds.set(node.fileLink, node.id);
      }

      const file = this.app.vault.getAbstractFileByPath(normalizedPath);
      if (file && file instanceof TFile) {
        // File exists - check its frontmatter
        try {
          const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
          const existingNodeId = frontmatter?.['skilltree-node'];
          
          if (existingNodeId === node.id) {
            // File is already linked to this node - just open it
            await this.app.workspace.openLinkText(path, '', false);
            await this.updateFileFrontmatterWithNodeId(path, node.id);
            // Load exp from file frontmatter
            try {
              const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
              const fileExp = frontmatter?.['skilltree-node-exp'];
              if (fileExp !== undefined && typeof fileExp === 'number') {
                node.exp = fileExp;
              } else {
                node.exp = 10;
              }
            } catch (e) {
              node.exp = 10;
            }
          } else {
            // File exists but doesn't have the correct ID (or has a different ID)
            // Relink the file to this node - update file frontmatter to match node ID
            // Update _lastKnownNodeIds first to prevent watcher from creating a loop
            let normalizedPath = path.trim();
            if (normalizedPath.startsWith('/')) normalizedPath = normalizedPath.substring(1);
            if (!normalizedPath.endsWith('.md')) normalizedPath = normalizedPath + '.md';
            this._lastKnownNodeIds.set(normalizedPath, node.id);
            
            await this.updateFileFrontmatterWithNodeId(path, node.id);
            await this.app.workspace.openLinkText(path, '', false);
            // Load exp from file frontmatter
            try {
              const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
              const fileExp = frontmatter?.['skilltree-node-exp'];
              if (fileExp !== undefined && typeof fileExp === 'number') {
                node.exp = fileExp;
              } else {
                node.exp = 10;
              }
            } catch (e) {
              node.exp = 10;
            }
          }
        } catch (err) {
          console.error('Failed to check file frontmatter:', err);
          // Fallback: just open the file and try to link it
          await this.updateFileFrontmatterWithNodeId(path, node.id);
          await this.app.workspace.openLinkText(path, '', false);
          // Default to 10 if we can't read exp
          node.exp = 10;
        }
      } else {
        // File doesn't exist -> show create modal
        this.showCreateFileModal(node);
      }

      try { await this.saveNodes(); } catch (e) {}
      this.render();
    };

    // Save file link on change (when user finishes typing)
    fileLinkInput.addEventListener('change', async () => {
      this.recordSnapshot();
      const oldFileLink = node.fileLink;
      const newFileLink = fileLinkInput.value.trim() || undefined;
      node.fileLink = newFileLink;
      
      // Clean up old file watcher if file link changed
      if (oldFileLink !== newFileLink) {
        const oldWatcher = this._fileWatchers.get(node.id);
        if (oldWatcher && typeof oldWatcher === 'function') {
          oldWatcher();
          this._fileWatchers.delete(node.id);
        }
        this._tasksCache.delete(node.id);
        this._taskPositions.delete(node.id);
        // Update last known node IDs map
        if (oldFileLink) {
          this._lastKnownNodeIds.delete(oldFileLink);
        }
        if (newFileLink) {
          this._lastKnownNodeIds.set(newFileLink, node.id);
          // Update frontmatter when linking a new file
          await this.updateFileFrontmatterWithNodeId(newFileLink, node.id);
          // Load exp from file frontmatter
          try {
            let normalizedPath = newFileLink.trim();
            if (normalizedPath.startsWith('/')) normalizedPath = normalizedPath.substring(1);
            if (!normalizedPath.endsWith('.md')) normalizedPath = normalizedPath + '.md';
            
            const file = this.app.vault.getAbstractFileByPath(normalizedPath);
            if (file && file instanceof TFile) {
              const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
              const fileExp = frontmatter?.['skilltree-node-exp'];
              if (fileExp !== undefined && typeof fileExp === 'number') {
                node.exp = fileExp;
              } else {
                // File exists but no exp in frontmatter, default to 10
                node.exp = 10;
              }
            } else {
              // File doesn't exist, default to 10
              node.exp = 10;
            }
          } catch (e) {
            // Error reading file, default to 10
            node.exp = 10;
          }
        }
      }
      
      // Reload tasks if file link exists
      if (newFileLink) {
        await this.getNodeTasks(node);
      }
      
      try { await this.saveNodes(); } catch (e) {}
      this.render();
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
        if (oldWatcher && typeof oldWatcher === 'function') {
          oldWatcher();
          this._fileWatchers.delete(node.id);
        }
        this._tasksCache.delete(node.id);
        this._taskPositions.delete(node.id);
        // Update last known node IDs map
        if (oldFileLink) {
          this._lastKnownNodeIds.delete(oldFileLink);
        }
        if (newFileLink) {
          this._lastKnownNodeIds.set(newFileLink, node.id);
          // Update frontmatter when linking a new file
          await this.updateFileFrontmatterWithNodeId(newFileLink, node.id);
          // Load exp from file frontmatter
          try {
            let normalizedPath = newFileLink.trim();
            if (normalizedPath.startsWith('/')) normalizedPath = normalizedPath.substring(1);
            if (!normalizedPath.endsWith('.md')) normalizedPath = normalizedPath + '.md';
            
            const file = this.app.vault.getAbstractFileByPath(normalizedPath);
            if (file && file instanceof TFile) {
              const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
              const fileExp = frontmatter?.['skilltree-node-exp'];
              if (fileExp !== undefined && typeof fileExp === 'number') {
                node.exp = fileExp;
              } else {
                // File exists but no exp in frontmatter, default to 10
                node.exp = 10;
              }
            } else {
              // File doesn't exist, default to 10
              node.exp = 10;
            }
          } catch (e) {
            // Error reading file, default to 10
            node.exp = 10;
          }
        }
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

  async openNewTreeModal() {
    // create an in-DOM modal inside the view so clicks always work
    if (!this.containerEl) {
      // Fallback: no modal support, just return
      return;
    }
    // ensure only one modal is open
    this.closeAllModals();
    const modal = this.containerEl.createDiv({ cls: 'skill-tree-node-modal' });
    // Style the modal to be visible in center
    this.openModal(modal);
    
    // close modal on outside click
    this.installOutsideClickHandler(modal);
    
    // Modal content
    const h3 = modal.createEl('h3', { text: 'Create New Tree' });
    h3.style.marginTop = '0';
    h3.style.marginBottom = '16px';
    
    const row = modal.createDiv({ cls: 'st-row' });
    row.style.marginBottom = '12px';
    row.style.display = 'flex';
    row.style.flexDirection = 'column';
    row.style.gap = '4px';
    
    const label = row.createEl('label', { text: 'Tree Name:' });
    label.style.fontWeight = '500';
    
    const input = row.createEl('input') as HTMLInputElement;
    input.type = 'text';
    input.placeholder = 'Enter tree name...';
    input.style.width = '100%';
    input.style.padding = '6px';
    
    // Actions
    const actions = modal.createDiv({ cls: 'st-actions' });
    actions.style.display = 'flex';
    actions.style.gap = '8px';
    actions.style.justifyContent = 'flex-end';
    actions.style.marginTop = '16px';
    
    const cancelBtn = actions.createEl('button', { text: 'Cancel' });
    cancelBtn.style.padding = '6px 12px';
    cancelBtn.onclick = () => { 
      modal.remove(); 
      this.removeOutsideClickHandler(); 
    };
    
    const createBtn = actions.createEl('button', { text: 'Create' });
    createBtn.style.padding = '6px 12px';
    createBtn.onclick = async () => {
      const name = input.value.trim();
      if (name) {
        await this.createTree(name);
        // Find and update tree selector
        const treeSelect = this.containerEl?.querySelector('select') as HTMLSelectElement;
        if (treeSelect) {
          this.updateTreeSelector(treeSelect);
          treeSelect.value = name;
        }
        await this.switchTree(name);
        this.render();
        modal.remove();
        this.removeOutsideClickHandler();
      }
    };
    
    // Handle Enter key
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        createBtn.click();
      } else if (e.key === 'Escape') {
        cancelBtn.click();
      }
    });
    
    // Focus input
    setTimeout(() => input.focus(), 10);
  }

  async openErrorModal(message: string) {
    // create an in-DOM modal inside the view so clicks always work
    if (!this.containerEl) {
      // Fallback: no modal support, just return
      return;
    }
    // ensure only one modal is open
    this.closeAllModals();
    const modal = this.containerEl.createDiv({ cls: 'skill-tree-node-modal' });
    // Style the modal to be visible in center
    this.openModal(modal);
    
    // close modal on outside click
    this.installOutsideClickHandler(modal);
    
    // Modal content
    const h3 = modal.createEl('h3', { text: 'Error' });
    h3.style.marginTop = '0';
    h3.style.marginBottom = '16px';
    
    const p = modal.createEl('p', { text: message });
    p.style.marginBottom = '16px';
    
    // Actions
    const actions = modal.createDiv({ cls: 'st-actions' });
    actions.style.display = 'flex';
    actions.style.gap = '8px';
    actions.style.justifyContent = 'flex-end';
    actions.style.marginTop = '16px';
    
    const okBtn = actions.createEl('button', { text: 'OK' });
    okBtn.style.padding = '6px 12px';
    okBtn.onclick = () => { 
      modal.remove(); 
      this.removeOutsideClickHandler(); 
    };
    
    // Handle Enter/Escape keys
    document.addEventListener('keydown', function handler(e) {
      if (e.key === 'Enter' || e.key === 'Escape') {
        okBtn.click();
        document.removeEventListener('keydown', handler);
      }
    });
  }

  async openDeleteConfirmationModal(treeName: string, onConfirm: () => void) {
    // create an in-DOM modal inside the view so clicks always work
    if (!this.containerEl) {
      // Fallback: no modal support, just return
      return;
    }
    // ensure only one modal is open
    this.closeAllModals();
    const modal = this.containerEl.createDiv({ cls: 'skill-tree-node-modal' });
    // Style the modal to be visible in center
    this.openModal(modal);
    
    // close modal on outside click
    this.installOutsideClickHandler(modal);
    
    // Modal content
    const h3 = modal.createEl('h3', { text: 'Confirm Delete' });
    h3.style.marginTop = '0';
    h3.style.marginBottom = '16px';
    
    const p = modal.createEl('p', { text: `Delete tree "${treeName}"? This action cannot be undone.` });
    p.style.marginBottom = '16px';
    
    // Actions
    const actions = modal.createDiv({ cls: 'st-actions' });
    actions.style.display = 'flex';
    actions.style.gap = '8px';
    actions.style.justifyContent = 'flex-end';
    actions.style.marginTop = '16px';
    
    const cancelBtn = actions.createEl('button', { text: 'Cancel' });
    cancelBtn.style.padding = '6px 12px';
    cancelBtn.onclick = () => { 
      modal.remove(); 
      this.removeOutsideClickHandler(); 
    };
    
    const deleteBtn = actions.createEl('button', { text: 'Delete' });
    deleteBtn.style.padding = '6px 12px';
    deleteBtn.style.backgroundColor = '#dc3545';
    deleteBtn.style.color = 'white';
    deleteBtn.onclick = () => {
      onConfirm();
      modal.remove();
      this.removeOutsideClickHandler();
    };
    
    // Handle Enter/Escape keys
    document.addEventListener('keydown', function handler(e) {
      if (e.key === 'Enter') {
        deleteBtn.click();
        document.removeEventListener('keydown', handler);
      } else if (e.key === 'Escape') {
        cancelBtn.click();
        document.removeEventListener('keydown', handler);
      }
    });
  }

  async openDeleteNodeConfirmationModal(node: SkillNode): Promise<boolean> {
    return new Promise((resolve) => {
      // create an in-DOM modal inside the view so clicks always work
      if (!this.containerEl) {
        // Fallback: no modal support, just return false
        resolve(false);
        return;
      }
      // ensure only one modal is open
      this.closeAllModals();
      const modal = this.containerEl.createDiv({ cls: 'skill-tree-node-modal' });
      // Style the modal to be visible in center
      this.openModal(modal);
      
      // close modal on outside click
      this.installOutsideClickHandler(modal);
      
      // Modal content
      const h3 = modal.createEl('h3', { text: 'Confirm Delete' });
      h3.style.marginTop = '0';
      h3.style.marginBottom = '16px';
      
      const p = modal.createEl('p', { text: `Delete node "${this.getNodeDisplayLabel(node)}"? This action cannot be undone.` });
      p.style.marginBottom = '16px';
      
      // Actions
      const actions = modal.createDiv({ cls: 'st-actions' });
      actions.style.display = 'flex';
      actions.style.gap = '8px';
      actions.style.justifyContent = 'flex-end';
      actions.style.marginTop = '16px';
      
      const cancelBtn = actions.createEl('button', { text: 'Cancel' });
      cancelBtn.style.padding = '6px 12px';
      cancelBtn.onclick = () => { 
        modal.remove(); 
        this.removeOutsideClickHandler(); 
        resolve(false);
      };
      
      const deleteBtn = actions.createEl('button', { text: 'Delete' });
      deleteBtn.style.padding = '6px 12px';
      deleteBtn.style.backgroundColor = '#dc3545';
      deleteBtn.style.color = 'white';
      deleteBtn.onclick = () => {
        modal.remove();
        this.removeOutsideClickHandler();
        resolve(true);
      };
      
      // Handle Enter/Escape keys
      document.addEventListener('keydown', function handler(e) {
        if (e.key === 'Enter') {
          deleteBtn.click();
          document.removeEventListener('keydown', handler);
        } else if (e.key === 'Escape') {
          cancelBtn.click();
          document.removeEventListener('keydown', handler);
        }
      });
    });
  }

  async openNodeEditor(node: SkillNode) {
    // create an in-DOM modal inside the view so clicks always work
    if (!this.containerEl) {
      // Fallback: no modal support, just return
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
    if (showConfirmation) {
      const confirmed = await this.openDeleteNodeConfirmationModal(node);
      if (!confirmed) return;
    }
    
    this.recordSnapshot();
    
    // Collect nodes that will be affected by the deletion (before filtering)
    const affectedNodes = this.nodes.filter(n => 
      n.id !== node.id && n.fileLink && (
        this.edges.some(e => (e.from === n.id && e.to === node.id) || (e.to === n.id && e.from === node.id))
      )
    );
    
    this.nodes = this.nodes.filter((n) => n.id !== node.id);
    this.edges = this.edges.filter((e) => e.from !== node.id && e.to !== node.id);
    this.selectedNodeId = null; // Clear selection
    this.selectedTask = null; // Clear task selection
    this.closeTaskChildrenModal(); // Close task modal if open
    
    // Update frontmatter for nodes that were connected to the deleted node
    for (const affectedNode of affectedNodes) {
      await this.updateFileFrontmatterWithNodeId(affectedNode.fileLink!, affectedNode.id);
    }
  }
  
  // Show modal with task children
  showTaskChildrenModal(node: SkillNode, taskIndex: number, task: any) {
    // Close existing modal if any
    this.closeTaskChildrenModal();
    
    if (!task.children || task.children.length === 0) return;
    
    const tasks = this._tasksCache.get(node.id) || [];
    const childTasks = task.children.map((childIndex: number) => tasks[childIndex]).filter(Boolean);
    
    if (childTasks.length === 0) return;
    
    // Create modal element
    const modal = document.createElement('div');
    modal.className = 'skill-tree-task-children-modal';
    modal.style.position = 'absolute';
    modal.style.zIndex = '10000';
    modal.style.backgroundColor = 'var(--background-primary)';
    modal.style.border = '1px solid var(--background-modifier-border)';
    modal.style.borderRadius = '8px';
    modal.style.padding = '12px';
    modal.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
    modal.style.maxWidth = '300px';
    modal.style.maxHeight = '400px';
    modal.style.overflowY = 'auto';
    
    // Position modal to the side of the task node
    const taskPos = this._taskPositions.get(node.id)?.find(p => p.taskIndex === taskIndex);
    if (taskPos) {
      const screenPos = this.worldToScreen(taskPos.x, taskPos.y);
      const rect = this.canvas!.getBoundingClientRect();
      modal.style.left = `${rect.left + screenPos.x + 40}px`;
      modal.style.top = `${rect.top + screenPos.y - 20}px`;
    } else {
      // Fallback positioning
      modal.style.right = '20px';
      modal.style.top = '100px';
    }
    
    // Add title
    const title = modal.createEl('div', { text: 'Child Tasks' });
    title.style.fontWeight = '600';
    title.style.marginBottom = '8px';
    title.style.fontSize = '14px';
    
    // Add child tasks list
    const list = modal.createEl('div');
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.gap = '4px';
    
    for (const childTask of childTasks) {
      const item = list.createEl('div');
      item.style.display = 'flex';
      item.style.alignItems = 'center';
      item.style.gap = '8px';
      item.style.padding = '4px';
      item.style.borderRadius = '4px';
      item.style.cursor = 'pointer';
      
      item.addEventListener('mouseenter', () => {
        item.style.backgroundColor = 'var(--background-modifier-hover)';
      });
      item.addEventListener('mouseleave', () => {
        item.style.backgroundColor = 'transparent';
      });
      
      // Checkbox
      const checkbox = item.createEl('input', { type: 'checkbox' });
      checkbox.checked = childTask.completed || false;
      checkbox.style.cursor = 'pointer';
      checkbox.addEventListener('change', async () => {
        const childTaskIndex = tasks.indexOf(childTask);
        if (childTaskIndex >= 0) {
          await this.toggleTaskCompletion(node, childTaskIndex);
        }
      });
      
      // Task text
      const text = item.createEl('span', { text: childTask.text || 'Task' });
      text.style.flex = '1';
      text.style.fontSize = '13px';
      if (childTask.completed) {
        text.style.textDecoration = 'line-through';
        text.style.opacity = '0.6';
      }
    }
    
    // Add close button
    const closeBtn = modal.createEl('button', { text: 'Close' });
    closeBtn.style.marginTop = '8px';
    closeBtn.style.width = '100%';
    closeBtn.style.padding = '6px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.onclick = () => this.closeTaskChildrenModal();
    
    document.body.appendChild(modal);
    this._taskChildrenModal = modal;
  }
  
  // Close task children modal
  closeTaskChildrenModal() {
    if (this._taskChildrenModal) {
      this._taskChildrenModal.remove();
      this._taskChildrenModal = null;
    }
  }
}