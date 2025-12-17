import { ReactiveFormsModule } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface Person {
  id: number;
  parentId?: number | null;
  name: string;
  gender: 'Male' | 'Female';
  birthYear?: number | null;
  deathYear?: number | null;
  isChartParent?: number;
}

/** Tree node used for nested rendering in the template */
export interface TreeNode extends Person {
  children: TreeNode[];
}

interface ChartColumn {
  parent: TreeNode;
  items: TreeNode[];
  selectedChildId?: number;
}

@Component({
  selector: 'app-tree',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './tree.html',
  styleUrl: './tree.scss'
})
export class TreeComponent implements OnInit {
  

  // Nested nodes used by the template
  public treeNodes: TreeNode[] = [];

  // chart columns (for bottom yellow boxes)
  public chartColumns: ChartColumn[] = [];

  // Local test data (flat list with parentId)
  testData: Person[] = [
    { id: 101, parentId: null, name: 'Root Remedy', gender: 'Male', birthYear: 1950, isChartParent: 0 },
    { id: 102, parentId: 101, name: 'Remedy A', gender: 'Female', birthYear: 1975, isChartParent: 0 },
    { id: 103, parentId: 101, name: 'Remedy B', gender: 'Male', birthYear: 1978, isChartParent: 0 },
    { id: 104, parentId: 101, name: 'Remedy C', gender: 'Male', birthYear: 1978, isChartParent: 0 },
    { id: 105, parentId: 101, name: 'Remedy D', gender: 'Male', birthYear: 1978, isChartParent: 0 },

    { id: 106, parentId: 102, name: 'Sub-Remedy A1', gender: 'Male', birthYear: 2000, isChartParent: 0 },
    { id: 107, parentId: 102, name: 'Sub-Remedy A2', gender: 'Female', birthYear: 2003, isChartParent: 0 },

    { id: 108, parentId: 103, name: 'Sub-Remedy B1', gender: 'Female', birthYear: 2005, isChartParent: 0 },
    { id: 109, parentId: 103, name: 'Sub-Remedy B2', gender: 'Male', birthYear: 2007, isChartParent: 0 },
    { id: 110, parentId: 103, name: 'Sub-Remedy B3', gender: 'Male', birthYear: 2010, isChartParent: 0 },
    { id: 111, parentId: 103, name: 'Sub-Remedy B4', gender: 'Female', birthYear: 2012, isChartParent: 0 },

    { id: 112, parentId: 104, name: 'Sub-Remedy C1', gender: 'Male', birthYear: 2008, isChartParent: 0 },
    { id: 113, parentId: 104, name: 'Sub-Remedy C2', gender: 'Female', birthYear: 2010, isChartParent: 0 },
    { id: 114, parentId: 104, name: 'Sub-Remedy C3', gender: 'Male', birthYear: 2015, isChartParent: 0 },
    { id: 115, parentId: 104, name: 'Sub-Remedy C4', gender: 'Male', birthYear: 2018, isChartParent: 0 },

    { id: 116, parentId: 105, name: 'Sub-Remedy D1', gender: 'Female', birthYear: 2020, isChartParent: 0 },
    { id: 117, parentId: 105, name: 'Sub-Remedy D2', gender: 'Male', birthYear: 2022, isChartParent: 0 },

    { id: 118, parentId: 106, name: 'Great Sub-Remedy A1-1', gender: 'Male', birthYear: 2025, isChartParent: 0 },

    { id: 119, parentId: 110, name: 'Chart Parent Remedy', gender: 'Male', birthYear: 2025, isChartParent: 1 },

    { id: 120, parentId: 119, name: 'Chart Child Remedy 1', gender: 'Male', birthYear: 2025, isChartParent: 0 },
    { id: 121, parentId: 119, name: 'Chart Child Remedy 2', gender: 'Male', birthYear: 2025, isChartParent: 0 },
    { id: 122, parentId: 119, name: 'Chart Child Remedy 3', gender: 'Male', birthYear: 2025, isChartParent: 0 },
    { id: 123, parentId: 119, name: 'Chart Child Remedy 4', gender: 'Male', birthYear: 2025, isChartParent: 0 },
    { id: 124, parentId: 119, name: 'Chart Child Remedy 5', gender: 'Male', birthYear: 2025, isChartParent: 0 },

    { id: 125, parentId: 120, name: 'Next Level Remedy 1', gender: 'Male', birthYear: 2025, isChartParent: 0 },
    { id: 126, parentId: 120, name: 'Next Level Remedy 2', gender: 'Male', birthYear: 2025, isChartParent: 0 },

    { id: 127, parentId: 122, name: 'Next Level Remedy 3', gender: 'Male', birthYear: 2025, isChartParent: 0 },
    { id: 128, parentId: 122, name: 'Next Level Remedy 4', gender: 'Male', birthYear: 2025, isChartParent: 0 },

    { id: 129, parentId: 125, name: 'Next Level Remedy 1', gender: 'Male', birthYear: 2025, isChartParent: 0 },
    { id: 130, parentId: 125, name: 'Next Level Remedy 2', gender: 'Male', birthYear: 2025, isChartParent: 0 },

    { id: 131, parentId: 128, name: 'Next Level Remedy 1', gender: 'Male', birthYear: 2025, isChartParent: 0 },
    { id: 132, parentId: 128, name: 'Next Level Remedy 2', gender: 'Male', birthYear: 2025, isChartParent: 0 },
    { id: 133, parentId: 128, name: 'Next Level Remedy 3', gender: 'Male', birthYear: 2025, isChartParent: 0 },

    { id: 134, parentId: 131, name: 'Next Level Remedy 11', gender: 'Male', birthYear: 2025, isChartParent: 0 },
    { id: 135, parentId: 131, name: 'Next Level Remedy 12', gender: 'Male', birthYear: 2025, isChartParent: 0 },

    { id: 136, parentId: 134, name: 'Next Level Remedy 111', gender: 'Male', birthYear: 2025, isChartParent: 0 },
    { id: 137, parentId: 134, name: 'Next Level Remedy 112', gender: 'Male', birthYear: 2025, isChartParent: 0 },
];

  constructor() {}

  ngOnInit(): void {
    this.refresh();
  }

  /** Rebuilds the nested treeNodes from the flat test data */
  refresh() {
    this.treeNodes = this.buildTree(this.testData);
    // if chart root disappeared, clear chart
    if (this.chartColumns.length) {
      const rootId = this.chartColumns[0].parent.id;
      const existingRoot = this.findTreeNodeById(rootId);
      if (!existingRoot) {
        this.chartColumns = [];
      } else {
        // rebuild columns using current tree structure
        this.openChartForNode(existingRoot);
      }
    }
  }

  /** Root button to just demo adding a node */
  addRoot() {
    const nextId = Math.max(...this.testData.map(d => d.id)) + 1;
    this.testData.push({
      id: nextId,
      parentId: null,
      name: `New Root ${nextId}`,
      gender: 'Male'
    });
    this.refresh();
  }

  // --- Context menu / dialog state for CRUD ---
  public selectedNode: TreeNode | null = null;
  public expandedNodeIds = new Set<number>();
  public showMenu = false;
  public showDialog = false;
  public dialogMode: 'Add' | 'Update' = 'Add';
  public dialogModel: Partial<Person & { id?: number }> = {};
  public menuPosition = { x: 0, y: 0 };

  // Right-click select & open context menu
  onNodeClick(node: TreeNode, ev: MouseEvent) {
    ev.stopPropagation();
    this.selectedNode = node;
    this.menuPosition = { x: ev.clientX, y: ev.clientY };
    this.showMenu = true;
  }

  // Toggle node expansion (and open chart if isChartParent === 1)
  onNodeExpand(node: TreeNode, ev: Event) {
    this.chartColumns = [];
    ev.stopPropagation();

    if (this.expandedNodeIds.has(node.id)) {
      this.expandedNodeIds.delete(node.id);
      this.removeExpandedDescendants(node);
    } else {
      // collapse siblings
      const siblings = this.testData.filter(item => item.parentId === node.parentId);
      siblings.forEach(item => {
        if (this.expandedNodeIds.delete(item.id)) {
          const t = this.findTreeNodeById(item.id);
          this.removeExpandedDescendants(t);
        }
      });
      this.expandedNodeIds.add(node.id);
    }

    // If this is a chart parent, open bottom chart
    if (node.isChartParent === 1 && this.expandedNodeIds.has(node.id)) {
      this.openChartForNode(node);
    }
  }

  /** Prepare chartColumns starting from a chart-parent node */
  private openChartForNode(node: TreeNode) {
    if (!node.children || !node.children.length) {
      this.chartColumns = [];
      return;
    }
    this.chartColumns = [{
      parent: node,
      items: node.children,
      selectedChildId: undefined
    }];
  }

  /** When clicking on a child in one of the yellow boxes */
  onChartItemClick(columnIndex: number, child: TreeNode, ev: MouseEvent) {
    ev.stopPropagation();

    this.selectedNode = child;

    // keep columns up to this level
    this.chartColumns = this.chartColumns.slice(0, columnIndex + 1);

    // mark selected at this level
    this.chartColumns[columnIndex].selectedChildId = child.id;

    // if this child has its own children, show them in a new column
    if (child.children && child.children.length) {
      this.chartColumns.push({
        parent: child,
        items: child.children,
        selectedChildId: undefined
      });
    }
  }

  private removeExpandedDescendants(node: TreeNode | null | undefined) {
    if (!node || !node.children) return;
    const stack = [...node.children];
    while (stack.length) {
      const current = stack.pop()!;
      this.expandedNodeIds.delete(current.id);
      if (current.children && current.children.length) {
        stack.push(...current.children);
      }
    }
  }

  private findTreeNodeById(id: number, nodes: TreeNode[] = this.treeNodes): TreeNode | null {
    for (const node of nodes) {
      if (node.id === id) return node;
      const found = this.findTreeNodeById(id, node.children);
      if (found) return found;
    }
    return null;
  }

  // --- Context menu actions ---
  onAddClick() {
    this.dialogMode = 'Add';
    this.dialogModel = { name: '', gender: 'Male', birthYear: undefined };
    this.showDialog = true;
    this.showMenu = false;
  }

  onUpdateClick() {
    if (!this.selectedNode) return;
    this.dialogMode = 'Update';
    this.dialogModel = { ...this.selectedNode };
    this.showDialog = true;
    this.showMenu = false;
  }

  onDeleteClick() {
    if (!this.selectedNode) return;
    const ok = confirm(`Delete node "${this.selectedNode.name}" and all its children?`);
    if (!ok) {
      this.showMenu = false;
      return;
    }

    const removeIds = new Set<number>();
    const collect = (n: TreeNode) => {
      removeIds.add(n.id);
      if (n.children) for (const c of n.children) collect(c);
    };
    collect(this.selectedNode);

    this.testData = this.testData.filter(t => !removeIds.has(t.id));
    removeIds.forEach(id => this.expandedNodeIds.delete(id));

    this.refresh();
    this.showMenu = false;
    this.selectedNode = null;
  }

  // Dialog
  onDialogCancel() {
    this.showDialog = false;
  }

  onDialogSave() {
    if (this.dialogMode === 'Add') {
      const nextId = Math.max(0, ...this.testData.map(d => d.id)) + 1;
      const parentId = this.selectedNode ? this.selectedNode.id : null;
      const newPerson: Person = {
        id: nextId,
        parentId,
        name: this.dialogModel.name || `New ${nextId}`,
        gender: (this.dialogModel.gender as any) || 'Male',
        birthYear: this.dialogModel.birthYear ?? null
      };
      this.testData.push(newPerson);

      if (this.selectedNode) {
        this.expandedNodeIds.add(this.selectedNode.id);
      }
      this.refresh();
      this.showDialog = false;

    } else if (this.dialogMode === 'Update') {
      if (!this.dialogModel.id) return;
      const id = this.dialogModel.id as number;
      const idx = this.testData.findIndex(t => t.id === id);
      if (idx >= 0) {
        this.testData[idx] = { ...this.testData[idx], ...this.dialogModel } as Person;
      }
      this.refresh();
      this.showDialog = false;
    }
  }

  // Hide context menu on document click
  @HostListener('document:click', ['$event'])
  onDocumentClick(_: MouseEvent) {
    if (this.showMenu) this.showMenu = false;
  }

  // Build nested structure
  buildTree(data: Person[]): TreeNode[] {
    const map = new Map<number, any>();
    data.forEach(d => map.set(d.id, { ...d, children: [] as TreeNode[] }));

    const roots: TreeNode[] = [];
    map.forEach(node => {
      const pid = node.parentId;
      if (pid === null || pid === undefined) {
        roots.push(node);
      } else {
        const parent = map.get(pid);
        if (parent) {
          parent.children.push(node);
        } else {
          roots.push(node);
        }
      }
    });
    return roots;
  }

  trackById(index: number, item: TreeNode) {
    return item.id;
  }
}