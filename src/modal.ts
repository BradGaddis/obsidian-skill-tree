import { SkillTreeView } from "./skilltreeview";


let view: SkillTreeView

export function InitSkillModal(skillTreeView: SkillTreeView) {
    view = skillTreeView
}

export function OpenOrphanedNodeListPane() {
    //
    // const container = view.canvasWrap || view.containerEl;
    // if (!container) return;
    //
    // view.closeNodeListPane();
    //
    // const pane = container.createEl('div', { cls: 'skill-tree-node-list-pane' });
    // pane.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:320px;background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:8px;z-index:9999;';
    // view._nodeListPane = pane;
    //
    // const header = pane.createEl('div');
    // header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--background-modifier-border);background:var(--background-secondary);';
    //
    // const title = header.createEl('span', { text: 'Find Orphans' });
    // title.style.cssText = 'font-weight:bold;font-size:14px;';
    //
    // const closeBtn = header.createEl('button', { text: '×' });
    // closeBtn.style.cssText = 'background:none;border:none;font-size:20px;cursor:pointer;padding:0 4px;';
    // closeBtn.onclick = () => view.closeNodeListPane();
    //
    // const list = pane.createEl('ul');
    // list.style.cssText = 'list-style:none;padding:0;margin:0;max-height:300px;overflow-y:auto;';
    //
    // // Filter to orphaned nodes (no parents and no children)
    // const orphanedNodes = view.nodes.filter(node => {
    //   const hasParent = view.edges.some(e => e.to === node.id);
    //   const hasChild = view.edges.some(e => e.from === node.id);
    //   return !hasParent && !hasChild;
    // });
    //
    // let sortedNodes: SkillNode[] = [];
    // let filteredNodes: SkillNode[] = [];
    // let selectedIndex = -1;
    //
    // if (orphanedNodes.length === 0) {
    //   const li = list.createEl('li');
    //   li.style.cssText = 'padding:12px;text-align:center;color:var(--text-muted);';
    //   li.textContent = 'No orphaned nodes';
    // } else {
    //   sortedNodes = [...orphanedNodes].sort((a, b) => {
    //     const aLabel = (view.getNodeDisplayLabel(a) || '').toLowerCase();
    //     const bLabel = (view.getNodeDisplayLabel(b) || '').toLowerCase();
    //     return aLabel.localeCompare(bLabel);
    //   });
    //   filteredNodes = sortedNodes;
    //
    //   const renderList = () => {
    //     list.innerHTML = '';
    //     selectedIndex = -1;
    //
    //     if (filteredNodes.length === 0) {
    //       const li = list.createEl('li');
    //       li.style.cssText = 'padding:12px;text-align:center;color:var(--text-muted);';
    //       li.textContent = 'No orphaned nodes';
    //       return;
    //     }
    //
    //     for (let i = 0; i < filteredNodes.length; i++) {
    //       const node = filteredNodes[i];
    //       const li = list.createEl('li');
    //       li.style.cssText = 'padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--background-modifier-border);display:flex;align-items:center;gap:8px;';
    //       li.dataset.index = String(i);
    //
    //       const stateDot = li.createEl('span');
    //       stateDot.style.cssText = 'width:8px;height:8px;border-radius:50%;flex-shrink:0;background:' + view.getStateColor(node.state);
    //
    //       const label = li.createEl('span', { text: view.getNodeDisplayLabel(node) || (node.fileLink ? node.fileLink.split('/').pop()! : `Node ${node.id}`) });
    //       label.style.cssText = 'flex:1;';
    //
    //       li.onmouseenter = () => {
    //         const items = list.querySelectorAll('li');
    //         items.forEach(item => item.style.backgroundColor = '');
    //         li.style.backgroundColor = 'var(--background-modifier-hover)';
    //         selectedIndex = i;
    //       };
    //       li.onmouseleave = () => li.style.backgroundColor = '';
    //       li.onclick = () => {
    //         view.selectedNodeId = node.id;
    //         view.centerAndZoomOnPoint(node.x, node.y, 1.6);
    //         view.closeNodeListPane();
    //         view.requestRender();
    //       };
    //     }
    //   };
    //
    //   const selectItem = (index: number) => {
    //     const items = list.querySelectorAll('li');
    //     if (items.length === 0) return;
    //
    //     if (index < 0) index = 0;
    //     if (index >= items.length) index = items.length - 1;
    //     selectedIndex = index;
    //
    //     items.forEach((item, i) => {
    //       if (i === selectedIndex) {
    //         item.style.backgroundColor = 'var(--background-modifier-hover)';
    //         item.scrollIntoView({ block: 'nearest' });
    //
    //         // Preview the node position (offset so it appears below the pane)
    //         const node = filteredNodes[selectedIndex];
    //         if (node) {
    //           view.selectedNodeId = node.id;
    //           const paneHeight = pane.getBoundingClientRect().height;
    //           view.centerAndZoomOnPoint(node.x, node.y, 1.6, 0, paneHeight);
    //           view.requestRender();
    //         }
    //       } else {
    //         item.style.backgroundColor = '';
    //       }
    //     });
    //   };
    //
    //   const jumpToSelected = () => {
    //     if (selectedIndex >= 0 && selectedIndex < filteredNodes.length) {
    //       const node = filteredNodes[selectedIndex];
    //       view.selectedNodeId = node.id;
    //       view.centerAndZoomOnPoint(node.x, node.y, 1.6);
    //       view.closeNodeListPane();
    //       view.requestRender();
    //     }
    //   };
    //
    //   renderList();
    //
    //   const keyHandler = (e: KeyboardEvent) => {
    //     if (e.key === 'ArrowDown') {
    //       e.preventDefault();
    //       selectItem(selectedIndex + 1);
    //     } else if (e.key === 'ArrowUp') {
    //       e.preventDefault();
    //       selectItem(selectedIndex - 1);
    //     } else if (e.key === 'Enter') {
    //       e.preventDefault();
    //       if (selectedIndex >= 0) {
    //         jumpToSelected();
    //       } else {
    //         selectItem(0);
    //         jumpToSelected();
    //       }
    //     }
    //   };
    //   document.addEventListener('keydown', keyHandler);
    //
    //   const outsideHandler = (e: MouseEvent) => {
    //     if (pane && !pane.contains(e.target as Node)) {
    //       // Don't close if clicking on toolbar buttons that open panes
    //       const target = e.target as HTMLElement;
    //       if (target.closest('.skill-tree-toolbar-buttons')) {
    //         return;
    //       }
    //       e.stopPropagation();
    //       // Delay close so click can reach target button
    //       setTimeout(() => {
    //         view.closeNodeListPane();
    //       }, 50);
    //       document.removeEventListener('click', outsideHandler);
    //       document.removeEventListener('keydown', keyHandler);
    //     }
    //   };
    //   setTimeout(() => document.addEventListener('click', outsideHandler), 100);
    //
    //   const escapeHandler = (e: KeyboardEvent) => {
    //     if (e.key === 'Escape') {
    //       view.closeNodeListPane();
    //       document.removeEventListener('keydown', escapeHandler);
    //       document.removeEventListener('keydown', keyHandler);
    //     }
    //   };
    //   document.addEventListener('keydown', escapeHandler);
    // }
    // }
}

export function openNodeListModal() {
    console.log("TODO");
    // const container = view.canvasWrap || view.containerEl;
    // if (!container) return;
    //
    // view.closeNodeListPane();
    //
    // const pane = container.createEl('div', { cls: 'skill-tree-node-list-pane' });
    // pane.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:320px;background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:8px;z-index:9999;';
    // view._nodeListPane = pane;
    //
    // const header = pane.createEl('div');
    // header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--background-modifier-border);background:var(--background-secondary);';
    //
    // const title = header.createEl('span', { text: 'Jump to Node' });
    // title.style.cssText = 'font-weight:bold;font-size:14px;';
    //
    // const closeBtn = header.createEl('button', { text: '×' });
    // closeBtn.style.cssText = 'background:none;border:none;font-size:20px;cursor:pointer;padding:0 4px;';
    // closeBtn.onclick = () => view.closeNodeListPane();
    //
    // // Search input for filtering
    // const searchContainer = pane.createEl('div');
    // searchContainer.style.cssText = 'padding:8px 12px;border-bottom:1px solid var(--background-modifier-border);';
    //
    // const searchInput = searchContainer.createEl('input', { attr: { placeholder: 'Type to filter...' } });
    // searchInput.style.cssText = 'width:100%;padding:6px 8px;border:1px solid var(--background-modifier-border);border-radius:4px;background:var(--background-secondary);color:var(--text-normal);box-sizing:border-box;';
    //
    // const list = pane.createEl('ul');
    // list.style.cssText = 'list-style:none;padding:0;margin:0;max-height:300px;overflow-y:auto;';
    //
    // const sortedNodes = [...view.nodes].sort((a, b) => {
    //     const aLabel = (view.getNodeDisplayLabel(a) || '').toLowerCase();
    //     const bLabel = (view.getNodeDisplayLabel(b) || '').toLowerCase();
    //     return aLabel.localeCompare(bLabel);
    // });
    //
    // let filteredNodes: SkillNode[] = [];
    // let selectedIndex = -1;
    //
    // const renderList = (filter: string) => {
    //     list.innerHTML = '';
    //     selectedIndex = -1;
    //     const lowerFilter = filter.toLowerCase();
    //
    //     filteredNodes = sortedNodes.filter(node => {
    //         const displayLabel = view.getNodeDisplayLabel(node) || '';
    //         const fileName = node.fileLink ? node.fileLink.split('/').pop() || node.fileLink : '';
    //         const nodeId = `Node ${node.id}`;
    //         const searchText = `${displayLabel} ${fileName} ${nodeId}`.toLowerCase();
    //         return searchText.includes(lowerFilter);
    //     });
    //
    //     if (filteredNodes.length === 0) {
    //         const li = list.createEl('li');
    //         li.style.cssText = 'padding:12px;text-align:center;color:var(--text-muted);';
    //         li.textContent = filter ? 'No matching nodes' : 'No nodes';
    //         return;
    //     }
    //
    //     for (let i = 0; i < filteredNodes.length; i++) {
    //         const node = filteredNodes[i];
    //         const li = list.createEl('li');
    //         li.style.cssText = 'padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--background-modifier-border);display:flex;align-items:center;gap:8px;';
    //         li.dataset.index = String(i);
    //
    //         const stateDot = li.createEl('span');
    //         stateDot.style.cssText = 'width:8px;height:8px;border-radius:50%;flex-shrink:0;background:' + view.getStateColor(node.state);
    //
    //         const label = li.createEl('span', { text: view.getNodeDisplayLabel(node) || (node.fileLink ? node.fileLink.split('/').pop()! : `Node ${node.id}`) });
    //         label.style.cssText = 'flex:1;';
    //
    //         li.onmouseenter = () => {
    //             // Update selection on hover
    //             const items = list.querySelectorAll('li');
    //             items.forEach(item => item.style.backgroundColor = '');
    //             li.style.backgroundColor = 'var(--background-modifier-hover)';
    //             selectedIndex = i;
    //         };
    //         li.onmouseleave = () => li.style.backgroundColor = '';
    //         li.onclick = () => {
    //             view.selectedNodeId = node.id;
    //             view.centerAndZoomOnPoint(node.x, node.y, 1.6);
    //             view.closeNodeListPane();
    //             view.requestRender();
    //         };
    //     }
    // };
    //
    // const selectItem = (index: number) => {
    //     const items = list.querySelectorAll('li');
    //     if (items.length === 0) return;
    //
    //     // Clamp index
    //     if (index < 0) index = 0;
    //     if (index >= items.length) index = items.length - 1;
    //     selectedIndex = index;
    //
    //     // Update visual selection
    //     items.forEach((item, i) => {
    //         if (i === selectedIndex) {
    //             (item as HTMLElement).style.backgroundColor = 'var(--background-modifier-hover)';
    //         } else {
    //             item.style.backgroundColor = '';
    //         }
    //     });
    //
    //     // Scroll into view
    //     const selectedItem = items[selectedIndex] as HTMLElement;
    //     selectedItem.scrollIntoView({ block: 'nearest' });
    //
    //     // Jump to the node and open info modal (but don't close the pane)
    //     // Offset so node appears below the pane
    //     if (selectedIndex >= 0 && selectedIndex < filteredNodes.length) {
    //         const node = filteredNodes[selectedIndex];
    //         view.selectedNodeId = node.id;
    //         const paneHeight = pane.getBoundingClientRect().height;
    //         view.centerAndZoomOnPoint(node.x, node.y, 1.6, 0, paneHeight);
    //         view.requestRender();
    //         view.openNodeStats(node);
    //     }
    // };
    //
    // const jumpToSelected = () => {
    //     if (selectedIndex >= 0 && selectedIndex < filteredNodes.length) {
    //         const node = filteredNodes[selectedIndex];
    //         view.selectedNodeId = node.id;
    //         view.centerAndZoomOnPoint(node.x, node.y, 1.6);
    //         view.closeNodeListPane();
    //         view.requestRender();
    //     }
    // };
    //
    // // Initial render
    // renderList('');
    //
    // // Filter on input
    // searchInput.addEventListener('input', () => {
    //     renderList(searchInput.value);
    // });
    //
    // // Handle keyboard navigation
    // searchInput.addEventListener('keydown', (e) => {
    //     if (e.key === 'ArrowDown') {
    //         e.preventDefault();
    //         selectItem(selectedIndex + 1);
    //     } else if (e.key === 'ArrowUp') {
    //         e.preventDefault();
    //         selectItem(selectedIndex - 1);
    //     } else if (e.key === 'Enter') {
    //         e.preventDefault();
    //         if (selectedIndex >= 0) {
    //             jumpToSelected();
    //         } else {
    //             // If nothing selected, select first item and jump
    //             selectItem(0);
    //             jumpToSelected();
    //         }
    //     }
    // });
    //
    // // Focus search input when pane opens
    // setTimeout(() => searchInput.focus(), 50);
    //
    // const outsideHandler = (e: MouseEvent) => {
    //     if (pane && !pane.contains(e.target as Node)) {
    //         // Don't close if clicking on toolbar buttons that open panes
    //         const target = e.target as HTMLElement;
    //         if (target.closest('.skill-tree-toolbar-buttons')) {
    //             return;
    //         }
    //         e.stopPropagation();
    //         // Delay close so click can reach target button
    //         setTimeout(() => {
    //             view.closeNodeListPane();
    //         }, 50);
    //         document.removeEventListener('click', outsideHandler);
    //     }
    // };
    // setTimeout(() => document.addEventListener('click', outsideHandler), 100);
    //
    // const escapeHandler = (e: KeyboardEvent) => {
    //     if (e.key === 'Escape') {
    //         view.closeNodeListPane();
    //         document.removeEventListener('keydown', escapeHandler);
    //     }
    // };
    // document.addEventListener('keydown', escapeHandler);
}


class SkillTreeModal {

    OpenModal() {

    }
}

export class TreeLinkModal extends SkillTreeModal {

}

