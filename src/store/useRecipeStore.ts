import { create } from 'zustand';
import { RecipeNode, RecipeEdge, RecipeSchema, Process, flattenProcessesToNodes, extractProcessIdFromNodeId, findProcessByNodeId } from '../types/recipe';
import { initialProcesses, initialEdges } from '../data/initialData';

interface RecipeStore {
  // 主数据结构：工艺段列表
  processes: Process[];
  edges: RecipeEdge[];
  metadata: {
    name: string;
    version: string;
    updatedAt: string;
  };
  hoveredNodeId: string | null;
  selectedNodeId: string | null;
  version: number; // 乐观锁版本号
  isSaving: boolean; // 保存状态

  // Process操作
  addProcess: (process: Process) => void;
  updateProcess: (id: string, data: Partial<Omit<Process, 'id' | 'nodes'>>) => void;
  removeProcess: (id: string) => void;
  
  // Node操作（在指定Process内）
  addNodeToProcess: (processId: string, node: RecipeNode) => void;
  updateNodeInProcess: (processId: string, nodeId: string, data: Partial<RecipeNode['data']>) => void;
  removeNodeFromProcess: (processId: string, nodeId: string) => void;
  
  // 向后兼容的Node操作（自动查找所属Process）
  addNode: (node: RecipeNode) => void;
  updateNode: (id: string, data: Partial<RecipeNode['data']>) => void;
  removeNode: (id: string) => void;
  
  // Edge actions
  addEdge: (edge: RecipeEdge) => void;
  updateEdge: (id: string, data: Partial<RecipeEdge['data']>) => void;
  removeEdge: (id: string) => void;
  cleanupEdges: (nodeId: string) => void;
  
  // Layout（兼容ReactFlow）
  setNodes: (nodes: RecipeNode[]) => void;
  setEdges: (edges: RecipeEdge[]) => void;
  
  // Interaction
  setHoveredNodeId: (id: string | null) => void;
  setSelectedNodeId: (id: string | null) => void;
  
  // Import/Export
  exportJSON: () => string;
  importJSON: (json: string) => void;
  reset: () => void;
  
  // Collaboration
  syncFromServer: (schema: RecipeSchema, version: number) => void;
  setSaving: (saving: boolean) => void;
}

/**
 * 将旧格式的nodes数组迁移为Process数组
 * 按节点ID前缀分组（如P1, P2等）
 */
function migrateNodesToProcesses(nodes: RecipeNode[]): Process[] {
  const processMap = new Map<string, RecipeNode[]>();
  
  nodes.forEach(node => {
    const processId = extractProcessIdFromNodeId(node.id);
    if (!processMap.has(processId)) {
      processMap.set(processId, []);
    }
    processMap.get(processId)!.push(node);
  });
  
  return Array.from(processMap.entries()).map(([id, processNodes]) => ({
    id,
    name: id, // 默认使用ID作为名称
    nodes: processNodes
  }));
}

export const useRecipeStore = create<RecipeStore>((set, get) => ({
  processes: initialProcesses,
  edges: initialEdges,
  metadata: {
    name: '饮料生产工艺配方',
    version: '1.0.0',
    updatedAt: new Date().toISOString(),
  },
  hoveredNodeId: null,
  selectedNodeId: null,
  version: 1,
  isSaving: false,

  // Process操作
  addProcess: (process) => {
    set((state) => ({
      processes: [...state.processes, process],
      metadata: {
        ...state.metadata,
        updatedAt: new Date().toISOString(),
      },
    }));
  },

  updateProcess: (id, data) => {
    set((state) => ({
      processes: state.processes.map((process) =>
        process.id === id
          ? { ...process, ...data }
          : process
      ),
      metadata: {
        ...state.metadata,
        updatedAt: new Date().toISOString(),
      },
    }));
  },

  removeProcess: (id) => {
    const state = get();
    // 级联删除该Process内所有节点的连线
    const nodeIds = state.processes.find(p => p.id === id)?.nodes.map(n => n.id) || [];
    nodeIds.forEach(nodeId => {
      state.cleanupEdges(nodeId);
    });
    
    set((state) => ({
      processes: state.processes.filter((process) => process.id !== id),
      metadata: {
        ...state.metadata,
        updatedAt: new Date().toISOString(),
      },
    }));
  },

  // Node操作（在指定Process内）
  addNodeToProcess: (processId, node) => {
    set((state) => ({
      processes: state.processes.map((process) =>
        process.id === processId
          ? { ...process, nodes: [...process.nodes, node] }
          : process
      ),
      metadata: {
        ...state.metadata,
        updatedAt: new Date().toISOString(),
      },
    }));
  },

  updateNodeInProcess: (processId, nodeId, data) => {
    // @ts-expect-error - TypeScript无法正确推断ProcessNodeData联合类型的部分更新，但运行时是安全的
    set((state) => ({
      processes: state.processes.map((process) =>
        process.id === processId
          ? {
              ...process,
              nodes: process.nodes.map((node) =>
                node.id === nodeId
                  ? { ...node, data: { ...node.data, ...data } }
                  : node
              ),
            }
          : process
      ),
      metadata: {
        ...state.metadata,
        updatedAt: new Date().toISOString(),
      },
    }));
  },

  removeNodeFromProcess: (processId, nodeId) => {
    const { cleanupEdges } = get();
    cleanupEdges(nodeId);
    set((state) => ({
      processes: state.processes.map((process) =>
        process.id === processId
          ? { ...process, nodes: process.nodes.filter((node) => node.id !== nodeId) }
          : process
      ),
      metadata: {
        ...state.metadata,
        updatedAt: new Date().toISOString(),
      },
    }));
  },

  // 向后兼容的Node操作（自动查找所属Process）
  addNode: (node) => {
    const processId = extractProcessIdFromNodeId(node.id);
    const state = get();
    const process = state.processes.find(p => p.id === processId);
    
    if (process) {
      // 如果Process已存在，添加到该Process
      state.addNodeToProcess(processId, node);
    } else {
      // 如果Process不存在，创建新Process
      state.addProcess({
        id: processId,
        name: processId,
        nodes: [node]
      });
    }
  },

  updateNode: (id, data) => {
    const state = get();
    const process = findProcessByNodeId(state.processes, id);
    
    if (process) {
      state.updateNodeInProcess(process.id, id, data);
    } else {
      console.warn(`Node ${id} not found in any process`);
    }
  },

  removeNode: (id) => {
    const state = get();
    const process = findProcessByNodeId(state.processes, id);
    
    if (process) {
      state.removeNodeFromProcess(process.id, id);
    } else {
      console.warn(`Node ${id} not found in any process`);
    }
  },

  addEdge: (edge) => {
    set((state) => ({
      edges: [...state.edges, edge],
      metadata: {
        ...state.metadata,
        updatedAt: new Date().toISOString(),
      },
    }));
  },

  updateEdge: (id, data) => {
    set((state) => ({
      edges: state.edges.map((edge) =>
        edge.id === id
          ? { ...edge, data: { ...edge.data, ...data } }
          : edge
      ),
      metadata: {
        ...state.metadata,
        updatedAt: new Date().toISOString(),
      },
    }));
  },

  removeEdge: (id) => {
    set((state) => ({
      edges: state.edges.filter((edge) => edge.id !== id),
      metadata: {
        ...state.metadata,
        updatedAt: new Date().toISOString(),
      },
    }));
  },

  cleanupEdges: (nodeId) => {
    set((state) => ({
      edges: state.edges.filter(
        (edge) => edge.source !== nodeId && edge.target !== nodeId
      ),
      metadata: {
        ...state.metadata,
        updatedAt: new Date().toISOString(),
      },
    }));
  },

  // Layout（兼容ReactFlow，直接操作展平的nodes）
  setNodes: (nodes) => {
    // 将nodes重新分组为processes
    const processes = migrateNodesToProcesses(nodes);
    set({ processes });
  },

  setEdges: (edges) => {
    set({ edges });
  },

  setHoveredNodeId: (id) => {
    set({ hoveredNodeId: id });
  },

  setSelectedNodeId: (id) => {
    set({ selectedNodeId: id });
  },

  exportJSON: () => {
    const state = get();
    const schema: RecipeSchema = {
      metadata: state.metadata,
      processes: state.processes.map(process => ({
        ...process,
        nodes: process.nodes.map(({ position, ...node }) => node), // 排除position
      })),
      edges: state.edges,
    };
    return JSON.stringify(schema, null, 2);
  },

  importJSON: (json) => {
    try {
      const schema = JSON.parse(json) as RecipeSchema;
      
      // 检测旧格式（只有nodes，没有processes）
      if (!schema.processes && schema.nodes) {
        // 自动迁移：将nodes按ID前缀分组为processes
        const processes = migrateNodesToProcesses(schema.nodes);
        set({
          processes,
          edges: schema.edges || [],
          metadata: schema.metadata || {
            name: '饮料生产工艺配方',
            version: '1.0.0',
            updatedAt: new Date().toISOString(),
          },
        });
      } else {
        // 新格式直接使用
        set({
          processes: schema.processes || [],
          edges: schema.edges || [],
          metadata: schema.metadata || {
            name: '饮料生产工艺配方',
            version: '1.0.0',
            updatedAt: new Date().toISOString(),
          },
        });
      }
    } catch (error) {
      console.error('Failed to import JSON:', error);
      alert('导入失败：JSON格式错误');
    }
  },

  reset: () => {
    set({
      processes: initialProcesses,
      edges: initialEdges,
      metadata: {
        name: '饮料生产工艺配方',
        version: '1.0.0',
        updatedAt: new Date().toISOString(),
      },
      hoveredNodeId: null,
      selectedNodeId: null,
      version: 1,
    });
  },

  syncFromServer: (schema, version) => {
    // 确保所有节点都有 position 属性（ReactFlow 要求）
    const processesWithPosition: Process[] = (schema.processes || []).map((process: any) => ({
      ...process,
      nodes: (process.nodes || []).map((node: any) => {
        const recipeNode = node as RecipeNode;
        if (!recipeNode.position) {
          return { ...recipeNode, position: { x: 0, y: 0 } } as RecipeNode;
        }
        return recipeNode;
      })
    }));

    // 向后兼容：如果服务器返回的是旧格式（nodes），进行迁移
    if (!schema.processes && schema.nodes) {
      const processes = migrateNodesToProcesses(schema.nodes as RecipeNode[]);
      set({
        processes,
        edges: (schema.edges || []) as RecipeEdge[],
        metadata: schema.metadata || {
          name: '饮料生产工艺配方',
          version: '1.0.0',
          updatedAt: new Date().toISOString(),
        },
        version,
      });
    } else {
      set({
        processes: processesWithPosition,
        edges: (schema.edges || []) as RecipeEdge[],
        metadata: schema.metadata || {
          name: '饮料生产工艺配方',
          version: '1.0.0',
          updatedAt: new Date().toISOString(),
        },
        version,
      });
    }
  },

  setSaving: (isSaving) => {
    set({ isSaving });
  },
}));

/**
 * Selector: 获取展平的节点数组（供ReactFlow使用）
 */
export const useFlatNodes = () => {
  const processes = useRecipeStore((state) => state.processes);
  return flattenProcessesToNodes(processes);
};
