import { create } from 'zustand';
import { RecipeNode, RecipeEdge, RecipeSchema } from '../types/recipe';
import { initialNodes, initialEdges } from '../data/initialData';

interface RecipeStore {
  nodes: RecipeNode[];
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

  // Node actions
  addNode: (node: RecipeNode) => void;
  updateNode: (id: string, data: Partial<RecipeNode['data']>) => void;
  removeNode: (id: string) => void;
  
  // Edge actions
  addEdge: (edge: RecipeEdge) => void;
  updateEdge: (id: string, data: Partial<RecipeEdge['data']>) => void;
  removeEdge: (id: string) => void;
  cleanupEdges: (nodeId: string) => void;
  
  // Layout
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

export const useRecipeStore = create<RecipeStore>((set, get) => ({
  nodes: initialNodes,
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

  addNode: (node) => {
    set((state) => ({
      nodes: [...state.nodes, node],
      metadata: {
        ...state.metadata,
        updatedAt: new Date().toISOString(),
      },
    }));
  },

  updateNode: (id, data) => {
    // @ts-expect-error - TypeScript无法正确推断ProcessNodeData联合类型的部分更新，但运行时是安全的
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, ...data } }
          : node
      ),
      metadata: {
        ...state.metadata,
        updatedAt: new Date().toISOString(),
      },
    }));
  },

  removeNode: (id) => {
    const { cleanupEdges } = get();
    cleanupEdges(id);
    set((state) => ({
      nodes: state.nodes.filter((node) => node.id !== id),
      metadata: {
        ...state.metadata,
        updatedAt: new Date().toISOString(),
      },
    }));
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

  setNodes: (nodes) => {
    set({ nodes });
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
    const schema = {
      metadata: state.metadata,
      nodes: state.nodes.map(({ position, ...node }) => node), // 排除position
      edges: state.edges,
    };
    return JSON.stringify(schema, null, 2);
  },

  importJSON: (json) => {
    try {
      const schema = JSON.parse(json);
      set({
        nodes: schema.nodes || [],
        edges: schema.edges || [],
        metadata: schema.metadata || {
          name: '饮料生产工艺配方',
          version: '1.0.0',
          updatedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Failed to import JSON:', error);
      alert('导入失败：JSON格式错误');
    }
  },

  reset: () => {
    set({
      nodes: initialNodes,
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
    // 从服务器同步的数据可能没有 position，需要添加临时值
    const nodesWithPosition: RecipeNode[] = (schema.nodes || []).map((node: any) => {
      const recipeNode = node as RecipeNode;
      if (!recipeNode.position) {
        return { ...recipeNode, position: { x: 0, y: 0 } } as RecipeNode;
      }
      return recipeNode;
    });

    // @ts-ignore - 服务器返回的数据类型可能不完全匹配TypeScript的严格类型，但运行时是正确的
    set({
      nodes: nodesWithPosition,
      edges: (schema.edges || []) as RecipeEdge[],
      metadata: schema.metadata || {
        name: '饮料生产工艺配方',
        version: '1.0.0',
        updatedAt: new Date().toISOString(),
      },
      version,
    });
  },

  setSaving: (isSaving) => {
    set({ isSaving });
  },
}));
