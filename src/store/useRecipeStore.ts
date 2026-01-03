import { create } from 'zustand';
import { RecipeEdge, RecipeSchema, Process, SubStep, FlowNode, ProcessType } from '../types/recipe';
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
  
  // 展开/折叠状态管理（用于流程图）
  expandedProcesses: Set<string>; // 记录哪些工艺段在流程图中展开显示子步骤
  
  // 节点位置缓存（用于流程图布局）
  nodePositions: Record<string, { x: number; y: number }>; // 缓存计算好的节点位置

  // Process操作
  addProcess: (process: Process) => void;
  updateProcess: (id: string, data: Partial<Omit<Process, 'id' | 'node'>>) => void;
  removeProcess: (id: string) => void;
  
  // 展开/折叠操作
  toggleProcessExpanded: (processId: string) => void;
  setProcessExpanded: (processId: string, expanded: boolean) => void;
  
  // 子步骤管理
  addSubStep: (processId: string, subStep: SubStep) => void;
  updateSubStep: (processId: string, subStepId: string, data: Partial<SubStep>) => void;
  removeSubStep: (processId: string, subStepId: string) => void;
  reorderSubSteps: (processId: string, newOrder: string[]) => void;
  
  // Edge actions
  addEdge: (edge: RecipeEdge) => void;
  updateEdge: (id: string, data: Partial<RecipeEdge['data']>) => void;
  removeEdge: (id: string) => void;
  cleanupEdges: (processId: string) => void;
  
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
  
  // Layout
  setNodePositions: (positions: Record<string, { x: number; y: number }>) => void;
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
  expandedProcesses: new Set(initialProcesses.map(p => p.id)), // 默认全部展开
  nodePositions: {}, // 节点位置缓存

  // Process操作
  addProcess: (process) => {
    set((state) => ({
      processes: [...state.processes, process],
      expandedProcesses: new Set([...state.expandedProcesses, process.id]), // 新工艺段默认展开
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
    // 级联删除该Process的连线
    state.cleanupEdges(id);
    
    set((state) => ({
      processes: state.processes.filter((process) => process.id !== id),
      expandedProcesses: new Set([...state.expandedProcesses].filter(pid => pid !== id)),
      metadata: {
        ...state.metadata,
        updatedAt: new Date().toISOString(),
      },
    }));
  },

  // 展开/折叠操作
  toggleProcessExpanded: (processId) => {
    set((state) => {
      const newExpanded = new Set(state.expandedProcesses);
      if (newExpanded.has(processId)) {
        newExpanded.delete(processId);
      } else {
        newExpanded.add(processId);
      }
      return { expandedProcesses: newExpanded };
    });
  },

  setProcessExpanded: (processId, expanded) => {
    set((state) => {
      const newExpanded = new Set(state.expandedProcesses);
      if (expanded) {
        newExpanded.add(processId);
      } else {
        newExpanded.delete(processId);
      }
      return { expandedProcesses: newExpanded };
    });
  },

  // 子步骤管理
  addSubStep: (processId, subStep) => {
    set((state) => ({
      processes: state.processes.map((process) =>
        process.id === processId
          ? {
              ...process,
              node: {
                ...process.node,
                subSteps: [...process.node.subSteps, subStep],
              },
            }
          : process
      ),
      metadata: {
        ...state.metadata,
        updatedAt: new Date().toISOString(),
      },
    }));
  },

  updateSubStep: (processId, subStepId, data) => {
    set((state) => ({
      processes: state.processes.map((process) =>
        process.id === processId
          ? {
              ...process,
              node: {
                ...process.node,
                subSteps: process.node.subSteps.map((subStep) =>
                  subStep.id === subStepId
                    ? { ...subStep, ...data }
                    : subStep
                ),
              },
            }
          : process
      ),
      metadata: {
        ...state.metadata,
        updatedAt: new Date().toISOString(),
      },
    }));
  },

  removeSubStep: (processId, subStepId) => {
    set((state) => ({
      processes: state.processes.map((process) =>
        process.id === processId
          ? {
              ...process,
              node: {
                ...process.node,
                subSteps: process.node.subSteps.filter((subStep) => subStep.id !== subStepId),
              },
            }
          : process
      ),
      metadata: {
        ...state.metadata,
        updatedAt: new Date().toISOString(),
      },
    }));
  },

  reorderSubSteps: (processId, newOrder) => {
    set((state) => {
      const process = state.processes.find(p => p.id === processId);
      if (!process) return state;

      const subStepMap = new Map(process.node.subSteps.map(s => [s.id, s]));
      const reorderedSubSteps = newOrder
        .map(id => subStepMap.get(id))
        .filter((s): s is SubStep => s !== undefined)
        .map((subStep, index) => ({ ...subStep, order: index + 1 }));

      return {
        processes: state.processes.map((p) =>
          p.id === processId
            ? {
                ...p,
                node: {
                  ...p.node,
                  subSteps: reorderedSubSteps,
                },
              }
            : p
        ),
        metadata: {
          ...state.metadata,
          updatedAt: new Date().toISOString(),
        },
      };
    });
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

  cleanupEdges: (processId) => {
    set((state) => ({
      edges: state.edges.filter(
        (edge) => edge.source !== processId && edge.target !== processId
      ),
      metadata: {
        ...state.metadata,
        updatedAt: new Date().toISOString(),
      },
    }));
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
        node: {
          ...process.node,
          position: undefined, // 排除position
        },
      })),
      edges: state.edges,
    };
    return JSON.stringify(schema, null, 2);
  },

  importJSON: (json) => {
    try {
      const schema = JSON.parse(json) as RecipeSchema;
      set({
        processes: schema.processes || [],
        edges: schema.edges || [],
        metadata: schema.metadata || {
          name: '饮料生产工艺配方',
          version: '1.0.0',
          updatedAt: new Date().toISOString(),
        },
        expandedProcesses: new Set((schema.processes || []).map(p => p.id)), // 导入后默认全部展开
      });
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
      expandedProcesses: new Set(initialProcesses.map(p => p.id)),
    });
  },

  syncFromServer: (schema, version) => {
    set({
      processes: schema.processes || [],
      edges: schema.edges || [],
      metadata: schema.metadata || {
        name: '饮料生产工艺配方',
        version: '1.0.0',
        updatedAt: new Date().toISOString(),
      },
      version,
      expandedProcesses: new Set((schema.processes || []).map(p => p.id)), // 同步后默认全部展开
    });
  },

  setSaving: (isSaving) => {
    set({ isSaving });
  },

  setNodePositions: (positions) => {
    set({ nodePositions: positions });
  },
}));

/**
 * Selector: 获取流程图节点数组（根据展开状态动态生成）
 */
export const useFlowNodes = (): FlowNode[] => {
  const processes = useRecipeStore((state) => state.processes);
  const expandedProcesses = useRecipeStore((state) => state.expandedProcesses);
  const nodePositions = useRecipeStore((state) => state.nodePositions);
  
  const nodes: FlowNode[] = [];
  
  // 先收集所有节点（临时数组，用于查找输入来源）
  const tempNodes: FlowNode[] = [];
  
  processes.forEach(process => {
    const isExpanded = expandedProcesses.has(process.id);
    
    if (isExpanded) {
      // 展开模式：每个子步骤一个节点
      process.node.subSteps.forEach((subStep) => {
        tempNodes.push({
          id: subStep.id,
          type: 'subStepNode',
          position: nodePositions[subStep.id] || { x: 0, y: 0 },
          data: {
            subStep,
          },
        });
      });
    } else {
      // 折叠模式：一个汇总节点
      tempNodes.push({
        id: process.id,
        type: 'processSummaryNode',
        position: nodePositions[process.id] || { x: 0, y: 0 },
        data: {
          processId: process.id,
          processName: process.name,
          subStepCount: process.node.subSteps.length,
          isExpanded: false,
        },
      });
    }
  });
  
  // 生成流程边（用于查找输入来源）
  const flowEdges = useFlowEdges();
  
  // 为每个节点添加输入来源信息（特别是调配节点）
  tempNodes.forEach(node => {
    // 查找所有指向当前节点的边
    const incomingEdges = flowEdges.filter(e => e.target === node.id);
    
    // 如果是调配节点，收集输入来源信息
    if (node.type === 'subStepNode' && 
        node.data.subStep?.processType === ProcessType.COMPOUNDING && 
        incomingEdges.length > 0) {
      const inputSources = incomingEdges
        .map(edge => {
          // 找到源节点
          const sourceNode = tempNodes.find(n => n.id === edge.source);
          if (!sourceNode) return null;
          
          // 获取来源名称
          let sourceName = '';
          if (sourceNode.type === 'subStepNode' && sourceNode.data.subStep) {
            sourceName = sourceNode.data.subStep.label;
          } else if (sourceNode.type === 'processSummaryNode') {
            sourceName = sourceNode.data.processName || sourceNode.data.processId || '';
          }
          
          // 获取来源工艺段信息
          const sourceProcess = processes.find(p => {
            if (p.id === edge.source) return true;
            return p.node.subSteps.some(s => s.id === edge.source);
          });
          
          return {
            nodeId: edge.source,
            name: sourceName,
            processId: sourceProcess?.id || '',
            processName: sourceProcess?.name || '',
            sequenceOrder: edge.data?.sequenceOrder || 0,
          };
        })
        .filter((source): source is NonNullable<typeof source> => source !== null)
        .sort((a, b) => a.sequenceOrder - b.sequenceOrder); // 按顺序排序
      
      // 添加到节点数据中
      node.data.inputSources = inputSources;
    }
    
    nodes.push(node);
  });
  
  return nodes;
};

/**
 * Selector: 获取流程图连线数组（根据展开状态动态生成）
 */
export const useFlowEdges = (): RecipeEdge[] => {
  const processes = useRecipeStore((state) => state.processes);
  const edges = useRecipeStore((state) => state.edges);
  const expandedProcesses = useRecipeStore((state) => state.expandedProcesses);
  
  const flowEdges: RecipeEdge[] = [];
  
  // 处理工艺段间连线
  edges.forEach(edge => {
    const sourceProcess = processes.find(p => p.id === edge.source);
    const targetProcess = processes.find(p => p.id === edge.target);
    
    if (!sourceProcess || !targetProcess) return;
    
    const sourceExpanded = expandedProcesses.has(sourceProcess.id);
    const targetExpanded = expandedProcesses.has(targetProcess.id);
    
    // 确定源节点和目标节点
    let sourceNodeId: string;
    let targetNodeId: string;
    
    if (sourceExpanded) {
      // 源工艺段展开：连接到最后一个子步骤
      const lastSubStep = sourceProcess.node.subSteps[sourceProcess.node.subSteps.length - 1];
      sourceNodeId = lastSubStep.id;
    } else {
      // 源工艺段折叠：连接到汇总节点
      sourceNodeId = sourceProcess.id;
    }
    
    if (targetExpanded) {
      // 目标工艺段展开：从第一个子步骤连接
      const firstSubStep = targetProcess.node.subSteps[0];
      targetNodeId = firstSubStep.id;
    } else {
      // 目标工艺段折叠：连接到汇总节点
      targetNodeId = targetProcess.id;
    }
    
    flowEdges.push({
      ...edge,
      source: sourceNodeId,
      target: targetNodeId,
    });
  });
  
  // 生成工艺段内部连线（仅当展开时）
  processes.forEach(process => {
    if (expandedProcesses.has(process.id) && process.node.subSteps.length > 1) {
      // 为子步骤生成内部连线
      for (let idx = 0; idx < process.node.subSteps.length - 1; idx++) {
        const current = process.node.subSteps[idx];
        const next = process.node.subSteps[idx + 1];
        flowEdges.push({
          id: `internal-${current.id}-${next.id}`,
          source: current.id,
          target: next.id,
          type: 'sequenceEdge',
          data: { sequenceOrder: 1 },
        });
      }
    }
  });
  
  // ========== 新增：为多输入节点分配targetHandle ==========
  
  // 1. 统计每个节点的输入边
  const nodeIncomingEdges = new Map<string, RecipeEdge[]>();
  flowEdges.forEach(edge => {
    const edges = nodeIncomingEdges.get(edge.target) || [];
    edges.push(edge);
    nodeIncomingEdges.set(edge.target, edges);
  });
  
  // 2. 为多输入节点的边分配targetHandle
  const finalEdges = flowEdges.map(edge => {
    const incomingEdges = nodeIncomingEdges.get(edge.target) || [];
    
    // 如果只有1个输入，不需要指定targetHandle（使用默认handle）
    if (incomingEdges.length <= 1) {
      return edge;
    }
    
    // 多输入节点：按sequenceOrder排序，分配targetHandle
    const sortedEdges = [...incomingEdges].sort((a, b) => {
      const orderA = a.data?.sequenceOrder || 0;
      const orderB = b.data?.sequenceOrder || 0;
      return orderA - orderB;
    });
    
    // 找到当前边在排序后的索引
    const handleIndex = sortedEdges.findIndex(e => e.id === edge.id);
    
    // 分配targetHandle（必须匹配CustomNode中的handle ID）
    return {
      ...edge,
      targetHandle: handleIndex >= 0 ? `target-${handleIndex}` : undefined,
    };
  });
  
  return finalEdges;
};
