# Skill Tree

<!-- badges -->
[![Obsidian plugin](https://img.shields.io/badge/Obsidian-Plugin-blue?style=flat&logo=obsidian)](https://obsidian.md)
[![License](https://img.shields.io/badge/License-MIT-green)](https://github.com/anomalyco/opencode/blob/main/LICENSE)
[![Version](https://img.shields.io/badge/Version-1.0.0-brightgreen)](https://github.com/anomalyco/opencode/releases)
[![Download](https://img.shields.io/badge/Downloads-100+-success)](https://obsidian.md/plugins)

Visualize your learning journey with an interactive, node-based skill tree.

![Skill Tree Demo](demo.gif)
<!-- Add screenshots: 
     - Full skill tree view
     - Edit mode with toolbar
     - Node detail modal
     - Settings panel
-->

## Wait, What is a Skill Tree?

A skill tree is a visual representation of your learning journey—a graph where:

* **Nodes** represent skills, concepts, or milestones you've achieved (or want to achieve)
* **Edges** show dependencies—like needing to learn A before B
* **XP** accumulates as you complete checkbox items in your linked notes

Think of it like video game skill trees (think Zelda skill trees, Path of Exile, etc.) but for real-world learning.

![Conceptual Overview](assets/concept.png)
<!-- Add: 
     - Simple diagram showing node → node connections
     - XP flow from checkboxes through nodes to level
-->

## Features

### Core Functionality
* **Interactive Canvas** - Pan, zoom, and organize your skill tree freely
* **Note Integration** - Link nodes to markdown notes with checkboxes
* **Progress Tracking** - XP and level system to track your advancement

### Organization
* **Multiple Trees** - Create separate skill trees for different areas
* **Tree Linking** - Connect trees together with prerequisite dependencies

### Node Types
| Node Type | Icon | Description |
|----------|------|------------|
| **Regular** | Circle/Standard | Normal skill node |
| **Optional** | Diamond | Optional path node |
| **Checkpoint** | ⬡ Hexagon | Milestone node |
| **Repeating** | ⟳ | Daily/recurring tasks with cooldown |
| **Tree Link** | ↪ | Link to another skill tree |

![Node Types](assets/node-types.png)
<!-- Add: 
     - All 5 node types rendered in edit mode
     - Visual distinction between each
-->

### Progress & Gamification
* **XP System** - Earn experience for completing tasks
* **Leveling** - Watch your level grow as you progress
* **Repeating Nodes** - Track daily habits with automatic reset timers

![Progress](assets/progress.png)
<!-- Add:
     - Level pane showing current level
     - XP badge on nodes showing their EXP value
     - Repeating node timer display
-->

## Getting Started

### Quick Start

1. Open Obsidian and go to **Settings → Community Plugins**
2. Search for "Skill Tree" and install
3. Click the dice icon in the sidebar to open the plugin
4. Toggle **Edit Mode** to start building your tree

![First Tree](assets/first-tree.gif)
<!-- Add:
     - Screen recording from fresh install to first node
     - Step-by-step click sequence
-->

### Your First Skill Tree

Let's say you want to learn a new language. Here's how to build a simple tree:

1. **Create a root node** - Click "Add Node" and select a note or create a new one
2. **Add prerequisites** - Click and drag from the handle to new nodes
3. **Link your notes** - Each node should link to notes with checkbox items

![Minimal Tree Example](assets/minimal-tree.png)
<!-- Add:
     - Minimal 3-node tree with proper edges
     - Brief walkthrough text
-->

## Creating Nodes

In Edit Mode, click the toolbar buttons to add nodes:

| Button | Keyboard | Description |
|--------|----------|------------|
| **Add Node** | `N` | Create a node linked to a note |
| **Add Empty** | `E` | Create an unlinked node |
| **Add Optional** | `O` | Optional path node |
| **Add Checkpoint** | `C` | Milestone node |
| **Add Sub Tree** | `T` | Link to another skill tree |
| **Add Repeating** | `R` | Node with cooldown reset |

### Connecting Nodes

1. Hover over a node to reveal its handles (colored dots around edges)
2. Click and drag from a handle to another node
3. Release to connect—edges show the learning order

![Creating Connections](assets/create-edge.gif)
<!-- Add:
     - Dragging from handle to another node
     - Edge appearing
-->

## Node States

Nodes automatically update based on connections and checkbox completion:

### State Reference

| State | Color | Description |
|-------|-------|-------------|
| **Complete** | Green | All tasks done or no prerequisites |
| **In Progress** | Blue | Some tasks complete, children unlocked |
| **Unavailable** | Gray | Prerequisites not met |
| **On Hold** | Yellow | Manually set to on hold |
| **Error** | Red | Linked note not found |

![Node States](assets/node-states.png)
<!-- Add:
     - All 5 states shown together
     - Each with distinct colors
-->

## Settings

Access via **Settings → Plugin Settings → Skill Tree**:

| Setting | Description | Default |
|---------|-------------|---------|
| Handle Radius | Hit area for edge handles | 8px |
| Node Radius (Min/Max) | Size range for nodes | 40-100px |
| Show EXP as Fraction | Display as "50/100" | Off |
| Level Display Mode | Current, aggregate, or both | Current |
| Level Multiplier | Higher = slower leveling | 1 |
| Default Skill EXP | EXP for new linked nodes | 10 |
| Default File Path | Folder for new note files | Root |

### Node-Level Settings

You can customize individual nodes:

```yaml
---
# In your note's frontmatter
skilltree-node: my-language-node
skilltree-node-exp: 50
shape: hexagon  # Optional shape override
color: #ff5555  # Optional color override
---

- [ ] Task 1
- [x] Task 2
- [ ] Task 3
```

![Settings Panel](assets/settings.png)
<!-- Add:
     - Full settings panel screenshot
     - Each setting annotated
-->

## Note Frontmatter

When you link a node to a note, these properties are automatically added:

```yaml
---
skilltree-node: <node-id>
skilltree-node-exp: <current-exp>
skilltree-node-to: [<child-node-ids>]
skilltree-node-from: [<parent-node-ids>]
---
```

### Customizing Node Appearance

Override node shape in your note's frontmatter:

| Shape | Description |
|-------|------------|
| `circle` | Normal (default) |
| `square` | Square corners |
| `hexagon` | Six-sided |
| `diamond` | Rotated square |
| `star` | Star shape |
| `repeat` | Repeating/loop icon |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Y` | Redo |
| `Delete` | Delete selected node (edit mode) |
| `Space` | Toggle selected node complete |
| `1-5` | Set node state (edit mode) |

## Commands

Open the Obsidian command palette (`Ctrl/Cmd + P`):

- **Skill Tree: Open** - Open the skill tree view
- **Skill Tree: Switch to Tree** - Switch between saved trees
- **Skill Tree: Reload** - Reload the current tree from disk
- **Skill Tree: Export** - Export current tree as JSON

## Touch & Mobile Support

Skill Tree works on touch devices with full gesture support:

| Gesture | Action |
|---------|--------|
| **Single tap** | Select node |
| **Double tap** | Open selected node |
| **Drag** | Pan the canvas |
| **Pinch** | Zoom in/out |
| **Long press** | Start dragging a node/handle |

![Mobile View](assets/mobile.png)
<!-- Add:
     - Phone screenshot showing skill tree
     - Pinch gesture indicator
-->

## Import/Export

### JSON Format

Save your trees as JSON for backup or sharing:

```json
{
  "trees": {
    "node-name": {
      "nodes": [...],
      "edges": [...]
    }
  },
  "settings": {...}
}
```

### Importing

1. **Settings → Plugin Settings → Import**
2. Select your JSON file
3. Confirm import

## Multiple Trees

Create separate trees for different learning areas:

![Multi-Tree](assets/multi-tree.png)
<!-- Add:
     - Tree selector dropdown
     - Two different tree screenshots
-->

### Creating New Trees

In Edit Mode, use the tree selector in the toolbar:

1. Click the tree name dropdown
2. Select "Create New Tree..."
3. Enter a name for your tree

## Workflow Examples

### Language Learning

```
Root: English Fluency
  ├── Basics (unlock after 5 tasks)
  │   ├── Pronunciation
  │   ├── Grammar Fundamentals
  │   └── Vocabulary Daily (repeating)
  ├── Speaking Practice
  │   ├── Conversation Topics
  │   └── Pronunciation Drills
  └── Advanced
      ├── Idioms
      └── Business Writing
```

### Video Game Skill Tree

```
Core Mechanics
  ├── Movement
  │   ├── Dash
  │   └── Jump
  ├── Combat
  │   ├── Light Attack
  │   ├── Heavy Attack
  │   └── Dodge
  └── Abilities
      ├── Fireball
      ├── Ice Blast
      └── Lightning Strike
```

## Development

```bash
# Install dependencies
npm install

# Development (watch mode)
npm run dev

# Production build
npm run build

# Type checking
npm run typecheck
```

### Project Structure

```
src/
├── handlers/        # Event handlers (click, touch, zoom, etc.)
├── nodes/          # Node type definitions
├── rendering/      # Canvas rendering logic
├── data/           # Tree data management
├── ui/            # Modal and UI components
└── types/         # TypeScript definitions
```

## Troubleshooting

### "Plugin not loading"
- Make sure Community Plugins are enabled in Obsidian settings
- Check the console (Developer Tools → Console) for errors

### "Nodes not showing"
- Try reloading: Cmd+Shift+P → "Skill Tree: Reload"
- Check that your notes exist in the linked path

### "Edges aren't connecting"
- Ensure you're in Edit Mode
- Click and drag from the handles (not the node center)

![Troubleshooting](assets/troubleshoot.png)
<!-- Add:
     - Common error messages
     - Solutions for each
-->

## License

MIT License - Feel free to use, modify, and distribute.

---

*Like this plugin? Help others find it by leaving a ⭐ on the [plugin page]().*