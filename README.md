# Skill Tree for Obsidian

A gamified skill tree visualization plugin for Obsidian. Design free-form node-based skill trees, link them to notes, and track progress with experience points (XP) and levels.

## Features

- Create node-based skill trees on an interactive canvas
- Link nodes to markdown notes with automatic progress tracking
- Track progress with XP and level system (Level = floor(sqrt(EXP)))
- Visual node states: complete, in-progress, unavailable, optional, checkpoint
- Task integration (works with Tasks and Dataview plugins)
- Multiple skill trees with import/export
- Edit trees as JSON for bulk changes
- Custom CSS themes
- Pan, zoom, and touch gestures

## Installation

### Community Plugins (recommended)
1. Open Obsidian Settings
2. Navigate to Community Plugins
3. Search for "Skill Tree"
4. Click Install, then Enable

### Manual Installation
1. Download the latest release from GitHub
2. Copy `main.js`, `manifest.json`, and `styles.css` to your vault: `VaultFolder/.obsidian/plugins/skill-tree/`
3. Enable the plugin in Obsidian settings

## Getting Started

1. Click the dice icon in the sidebar to open the skill tree
2. Enable **Edit Mode** to add and edit nodes
3. Click **Add Node** to create a new node linked to a note
4. Connect nodes by dragging from one node's handle to another
5. Complete tasks in linked notes to automatically progress nodes

## Node Types

| Type | Description | Icon |
|------|-------------|------|
| **Regular** | Default node linked to a note | - |
| **Optional** | Optional path node with `?` icon | `?` |
| **Checkpoint** | Milestone node (diamond shape) | Diamond |
| **Tree Link** | Links to another skill tree | Tree icon |
| **Repeating** | Can be completed multiple times | Double-ring |
| **Empty** | Node without a linked file | - |

## Node States

Node states are automatically determined by the state resolution algorithm:

| State | Visual | Meaning |
|-------|--------|---------|
| **Complete** | Gold/green | All linked tasks done |
| **In Progress** | Blue/purple | Some tasks complete, children available |
| **Unavailable** | Gray | Prerequisites not met |
| **Optional** | Sky blue | Optional path node |
| **Checkpoint (Incomplete)** | Red outline | Checkpoint not yet reached |

## Node Shapes

Override shape in note frontmatter:

```yaml
---
shape: hexagon  # circle, square, hexagon, diamond
---
```

- **circle** - Default for simple styles
- **square** - Square shape
- **hexagon** - Default for gamified style
- **diamond** - Checkpoint nodes
- **tree-link** - Tree link nodes
- **repeat** - Repeating nodes (double-ring circle)

## Repeating Nodes

Repeating nodes are nodes that can be completed multiple times - useful for daily quests, practice routines, or any repeatable skill.

### Creating a Repeating Node

**Option 1: Toolbar**
1. Enable Edit Mode
2. Click "Add Repeating" in the toolbar
3. Configure reset mode, max repeats, and EXP

**Option 2: Frontmatter**
Add to your note's frontmatter:
```yaml
---
skilltree-node: 123
skilltree-node-repeat: true
skilltree-node-repeat-reset: daily
skilltree-node-repeat-max: 30
skilltree-node-repeat-cooldown: 24
---
```

### Reset Modes

| Mode | Behavior |
|------|----------|
| **manual** | Stays complete until manually reset |
| **daily** | Resets to in-progress at midnight |
| **weekly** | Resets at the start of each week |
| **monthly** | Resets at the start of each month |
| **cooldown** | Resets after X hours |

### Frontmatter Properties

All properties can be set via frontmatter OR the toolbar:

| Property | Description | Example |
|----------|-------------|---------|
| `skilltree-node-repeat` | Enable repeating | `true` |
| `skilltree-node-repeat-count` | Current completion count | `5` |
| `skilltree-node-repeat-max` | Maximum repeats (0=unlimited) | `30` |
| `skilltree-node-repeat-reset` | Reset mode | `daily` |
| `skilltree-node-repeat-cooldown` | Hours for cooldown mode | `24` |
| `skilltree-node-repeat-last` | Timestamp of last completion | `1700000000000` |

### Visual Indicator

Repeating nodes display a gold badge showing completion count:
- `×5` - Completed 5 times
- `10✓` - Completed 10 times (at max)

The node uses the "repeat" shape (double-ring circle) by default.

## Canvas Interactions

### View Mode
| Action | Result |
|--------|--------|
| Click node | Select and center |
| Click checkbox | Complete node |
| Drag canvas | Pan view |
| Scroll wheel | Zoom in/out |
| Ctrl + scroll | Pan view |

### Edit Mode
| Action | Result |
|--------|--------|
| Click empty space | Add node (via dialog) |
| Double-click node | Open node editor |
| Right-click node | Open node editor |
| Click + drag node | Move node |
| Click node handle | Start creating edge |
| Drag edge endpoint | Reconnect edge |
| Drag edge body | Delete/reconnect edge |
| Click checkbox | Complete node |
| Delete key | Delete selected node |

### Multi-Select (Edit Mode)
| Action | Result |
|--------|--------|
| Shift + drag | Box select nodes |
| Click (with selection) | Add to selection |
| Drag selected node | Move all selected |

### Touch Gestures
- **Single tap** on task: Select task
- **Tap checkbox**: Complete all tasks
- **Long press** (600ms): Open editor (edit mode only)
- **Pinch**: Zoom
- **Single finger drag**: Pan (view mode) or drag (edit mode)

## Task Integration

The plugin automatically parses checkboxes from linked notes:

```markdown
- [ ] Uncompleted task
- [x] Completed task
* [ ] Also works with asterisks
  - [ ] Nested task
```

### Supported Plugins (in priority order)
1. **Tasks Plugin** - Full task parsing
2. **Dataview Plugin** - Frontmatter queries
3. **Manual Regex** - Fallback parsing

### State Resolution Algorithm

Nodes are automatically updated using a 6-pass algorithm:
1. **Orphan Handling** - Disconnected nodes use task completion
2. **Child Activation** - Sets children to in-progress, marks ancestors unavailable
3. **Optional Children** - Optional in-progress promotes parent to optional
4. **Regular Children** - All children complete = parent in-progress
5. **Optional Collapse** - Optional nodes without tasks collapse to optional
6. **Checkpoint Finalization** - Checkpoints only have 2 states

## Note Frontmatter

The plugin writes to linked notes' YAML frontmatter:

```yaml
---
skilltree-node: 123           # Node ID
skilltree-node-exp: 10        # EXP value
shape: hexagon               # Node shape override
skilltree-node-to: [124, 125] # Connected node IDs
skilltree-node-from: [126]    # Parent node IDs
---
```

## Level/XP System

- **Level calculation**: `floor(sqrt(EXP))`
- **Progress bar**: Shows completed EXP / Total possible EXP
- **Orphaned and complete nodes don't block progress**
- **Optional and checkpoint nodes don't contribute XP**

## Commands

Open the command palette (Ctrl/Cmd + P) and search for:

| Command | Description |
|---------|-------------|
| **Open Skill Tree** | Open the skill tree view |
| **Toggle Edit Mode** | Switch between view and edit mode |
| **Jump to Node** | Quick navigation modal to any node |

## Toolbar

### Always Visible
- **Edit Mode** toggle
- **Undo / Redo**
- **Jump to Node**
- **Find Orphans**
- **Recenter**
- **Tree selector** dropdown

### Edit Mode Only
- **Add Node** - Create linked node
- **Add Empty** - Create unlinked node
- **Add Optional** - Create optional path
- **Add Checkpoint** - Create checkpoint
- **Add Tree Link** - Link to another tree
- **Add Repeating** - Create repeating node
- **Edit as JSON** - JSON editor
- **Delete Tree** - Delete current tree
- **Show Handles** toggle

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl/Cmd + Z | Undo |
| Ctrl/Cmd + Y | Redo |
| Ctrl/Cmd + Shift + Z | Redo (alternative) |
| Delete | Delete selected (edit mode) |

## Settings

### Visual Settings
- **Style** - Choose visual style (Gamified, Simple Light, Simple Dark)
- **Min/Max node radius** - Node size range (default: 36-72px)
- **Show handles** - Display connection points on nodes
- **Show EXP as fraction** - Display as "50/100" vs "50"
- **Show level pane** - Bottom-left level display
- **Show EXP pane** - Top-right EXP display
- **Bezier edges** - Curved lines (non-gamified styles)

### File Settings
- **Default file path** - Directory for new node files (with folder browser)

### Tree Management
- **Current Tree** - Switch between skill trees
- **Create new tree** - Add additional trees
- **Delete Tree** - Remove current tree

### Import/Export
- **Import JSON** - Load tree from file
- **Export JSON** - Download tree as file

### Custom Themes

Create custom CSS themes to override the default visual styling. Go to **Settings > Custom Themes > Manage Themes**.

1. Click **+ New Theme**
2. Enter a name (e.g., "Dark Purple")
3. Write your CSS rules

**CSS is scoped to `.skill-tree-canvas`** - all your styles should target this container.

**Available selectors:**

**Canvas & Background**
| Selector | Description |
|----------|-------------|
| `.skill-tree-canvas` | The main canvas container |
| `.skill-tree-view` | The view wrapper element |

**Nodes**
| Selector | Description |
|----------|-------------|
| `.skill-tree-node` | All nodes (base styling) |
| `.skill-tree-node-complete` | Complete nodes (gold/green) |
| `.skill-tree-node-in-progress` | In-progress nodes (blue/purple) |
| `.skill-tree-node-unavailable` | Unavailable nodes (gray) |
| `.skill-tree-node-optional` | Optional path nodes (sky blue) |
| `.skill-tree-node-error` | Nodes with file link issues |

**Panes & Overlays**
| Selector | Description |
|----------|-------------|
| `.skill-tree-level-pane` | Level display panel (bottom-left) |
| `.skill-tree-level-content` | Level text and progress bar wrapper |
| `.skill-tree-level-progress-inner` | Progress bar fill |
| `.gamified-exp-badge` | EXP badge styling |
| `.gamified-level-badge` | Level badge styling |

**Toolbar**
| Selector | Description |
|----------|-------------|
| `.skill-tree-toolbar` | Toolbar container |
| `.skill-tree-toolbar-wrapper` | Wrapper with flex layout |
| `.skill-tree-toolbar-buttons` | Button container with flex wrap |
| `.skill-tree-handle` | Connection handles |
| `.skill-tree-handle-toggle` | Show handles toggle |

**Modals**
| Selector | Description |
|----------|-------------|
| `.gamified-modal` | Modal styling for gamified theme |
| `.skill-tree-node-modal` | Node editor modal |
| `.skill-tree-node-list-pane` | Node list modal |
| `.st-desc` | Description text in modals |
| `.st-desc a` | Links in descriptions |
| `.st-note-link` | Note link in header |
| `.st-note-icon` | Note link icon |

**Node Overlay**
| Selector | Description |
|----------|-------------|
| `.skill-tree-node-overlay` | Jump to node overlay |
| `.skill-tree-node-overlay.open` | Overlay when visible |
| `.st-overlay-header` | Overlay header with search |
| `.st-overlay-search` | Search input field |

**Progress Bar**
| Selector | Description |
|----------|-------------|
| `.gamified-progress-inner` | Progress bar fill (gradient) |

**Example theme:**

```css
/* Dark purple theme */
.skill-tree-canvas {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
}

.skill-tree-node {
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
}

.skill-tree-node-complete {
  background: #9b59b6;
  border-color: #8e44ad;
}

.skill-tree-level-pane {
  background: rgba(26, 26, 46, 0.9);
  color: #a29bfe;
  font-size: 18px;
}

/* Custom progress bar */
.gamified-progress-inner {
  background: linear-gradient(90deg, #9b59b6, #8e44ad);
}

/* Modal styling */
.gamified-modal {
  background: #1a1a2e;
  border: 2px solid #9b59b6;
}
```

After saving, select your theme from the **Active Theme** dropdown.

## Multiple Trees

Create unlimited skill trees:
1. Go to Settings > Tree Management
2. Enter a name and click Create
3. Switch between trees using the toolbar dropdown
4. Use Tree Link nodes to connect trees

## Development

```bash
npm install
npm run dev   # Watch mode with hot reload
npm run build # Production build
npm test      # Run tests
```

## License

MIT
