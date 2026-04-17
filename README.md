# Skill Tree

<!-- badges -->
[![Obsidian plugin](https://img.shields.io/badge/Obsidian-Plugin-blue?style=flat&logo=obsidian)](https://obsidian.md)
[![License](https://img.shields.io/badge/License-MIT-green)](https://github.com/anomalyco/opencode/blob/main/LICENSE)

Visualize and gamify your learning with an interactive, node-based skill tree.

![Skill Tree Demo](demo.gif)
<!-- Add screenshots:
     - Full skill tree view
     - Edit mode with toolbar
     - Node detail modal
     - Settings panel
-->

## Skill Tree:

A visual representation of linked notes and nodes where:

* **Nodes** represent skills, concepts, or milestones you've achieved (or want to achieve)
* **Edges** show dependencies—like needing to learn A before B
* **XP** accumulates as you complete checkbox items in your linked notes


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
  * You can also add sub-trees that can't be completed until the corresponding node is ready

### Node Types
| Node Type |Description |
|----------|------|
| **Regular**  | Normal skill node |
| **Optional**  | Optional path node |
| **Checkpoint**   | Milestone node |
| **Repeating**   | Daily/recurring tasks with cooldown |
| **Tree Link**    | Link to another skill tree |
| **Task Nodes**   | Nodes that have tasks that must be completed before moving on |

You can change these (mostly) freely in the metadata of a linked note.

<!-- ![Node Types](assets/node-types.png) -->
<!-- Add:
     - All 5 node types rendered in edit mode
     - Visual distinction between each
-->

### Progress & Gamification
* **XP System** - Earn experience for completing skills
* **Leveling** - A basic leveling system that grows with skills added
* **Repeating Nodes** - Track daily habits with automatic reset timers

<!-- ![Progress](assets/progress.png) -->
<!-- Add:
     - Level pane showing current level
     - XP badge on nodes showing their EXP value
     - Repeating node timer display
-->

<!-- ## Getting Started -->

<!-- ![First Tree](assets/first-tree.gif) -->
<!-- Add:
     - Screen recording from fresh install to first node
     - Step-by-step click sequence
-->

<!-- ## Example -->
<!-- ![Minimal Tree Example](assets/minimal-tree.png) -->
<!-- Add:
     - Minimal 3-node tree with proper edges
     - Brief walkthrough text
-->

## Creating Nodes

In Edit Mode, click the toolbar buttons to add nodes:

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
---

- [ ] Task 1
- [x] Task 2
- [ ] Task 3
```



## Touch & Mobile Support


| Gesture | Action |
|---------|--------|
| **Single tap** | Select node |
| **Double tap** | Open selected node |
| **Drag** | Pan the canvas |
| **Pinch** | Zoom in/out |
| **Long press** | Start dragging a node/handle |


## Import/Export



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


## License

MIT License - Feel free to use, modify, and distribute.

---

*Like this plugin? Help others find it by leaving a ⭐ or buying me a coffee.
