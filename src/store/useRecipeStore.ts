import { create } from 'zustand';
import { RecipeEdge, RecipeSchema, Process, SubStep, FlowNode, ProcessType } from '../types/recipe';
import { initialProcesses, initialEdges } from '../data/initialData';
import { calculateSchedule } from '../services/scheduler'; // calculateSchedule returned from here
import { ScheduleResult } from '../types/scheduling'; // ScheduleResult is a type definition
import { defaultDevicePool } from '../data/devicePool';
import { useMemo } from 'react';
import { socketService } from '../services/socketService';

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

  // 编辑上下文（用于虚线高亮）
  editingContext: { processId: string; subStepId?: string } | null;

  // 编辑上下文操作
  setEditingContext: (context: { processId: string; subStepId?: string } | null) => void;

  // Process操作
  addProcess: (process: Process) => void;
  updateProcess: (id: string, data: Partial<Omit<Process, 'id' | 'node'>>) => void;
  removeProcess: (id: string) => void;
  insertProcess: (process: Process, targetIndex: number) => void;
  duplicateProcess: (processId: string, insertAfter: boolean) => void;
  reorderProcesses: (newOrder: string[]) => void;

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
  setVersion: (version: number) => void;
  saveToServer: (userId?: string) => Promise<boolean>;
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
  editingContext: null,

  // 编辑上下文操作
  setEditingContext: (context) => {
    set({ editingContext: context });
  },

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

  insertProcess: (process, targetIndex) => {
    set((state) => {
      const newProcesses = [...state.processes];
      newProcesses.splice(targetIndex, 0, process);
      return {
        processes: newProcesses,
        expandedProcesses: new Set([...state.expandedProcesses, process.id]),
        metadata: {
          ...state.metadata,
          updatedAt: new Date().toISOString(),
        },
      };
    });
  },

  duplicateProcess: (processId, insertAfter) => {
    const state = get();
    const sourceProcess = state.processes.find(p => p.id === processId);
    if (!sourceProcess) return;

    // 生成新的工艺段ID
    const generateNewId = (baseId: string): string => {
      const timestamp = Date.now();
      let newId = `${baseId}-copy-${timestamp}`;
      let counter = 1;
      while (state.processes.some(p => p.id === newId)) {
        newId = `${baseId}-copy-${timestamp}-${counter}`;
        counter++;
      }
      return newId;
    };

    const newProcessId = generateNewId(processId);

    // 递归复制子步骤，更新ID
    const duplicateSubSteps = sourceProcess.node.subSteps.map((subStep, index) => ({
      ...subStep,
      id: `${newProcessId}-substep-${index + 1}`,
      order: index + 1,
    }));

    // 创建新的工艺段
    const newProcess: Process = {
      id: newProcessId,
      name: `${sourceProcess.name} (副本)`,
      description: sourceProcess.description,
      node: {
        id: newProcessId,
        type: 'processNode',
        label: `${sourceProcess.node.label} (副本)`,
        subSteps: duplicateSubSteps,
      },
    };

    // 找到源工艺段的位置
    const sourceIndex = state.processes.findIndex(p => p.id === processId);
    if (sourceIndex === -1) return;

    // 确定插入位置
    const targetIndex = insertAfter ? sourceIndex + 1 : sourceIndex;

    // 插入新工艺段
    set((state) => {
      const newProcesses = [...state.processes];
      newProcesses.splice(targetIndex, 0, newProcess);
      return {
        processes: newProcesses,
        expandedProcesses: new Set([...state.expandedProcesses, newProcess.id]),
        metadata: {
          ...state.metadata,
          updatedAt: new Date().toISOString(),
        },
      };
    });
  },

  reorderProcesses: (newOrder) => {
    set((state) => {
      const processMap = new Map(state.processes.map(p => [p.id, p]));
      const reorderedProcesses = newOrder
        .map(id => processMap.get(id))
        .filter((p): p is Process => p !== undefined);

      // 如果有些ID不在newOrder中，保留在末尾
      const remainingIds = state.processes
        .map(p => p.id)
        .filter(id => !newOrder.includes(id));
      const remainingProcesses = remainingIds
        .map(id => processMap.get(id))
        .filter((p): p is Process => p !== undefined);

      return {
        processes: [...reorderedProcesses, ...remainingProcesses],
        metadata: {
          ...state.metadata,
          updatedAt: new Date().toISOString(),
        },
      };
    });
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

  setVersion: (newVersion) => {
    set({ version: newVersion });
  },

  saveToServer: async (userId?: string) => {
    const state = get();
    state.setSaving(true);

    console.log('[保存] 开始保存到服务器...', {
      userId,
      version: state.version,
      hasUserId: !!userId
    });

    // 检查 userId 是否存在
    if (!userId) {
      console.error('[保存] 错误:缺少 userId');
      state.setSaving(false);
      return false;
    }

    try {
      const recipeData = {
        metadata: state.metadata,
        processes: state.processes.map(process => ({
          ...process,
          node: {
            ...process.node,
            position: undefined, // 排除position
          },
        })),
        edges: state.edges,
        version: state.version,
      };

      // 获取 socketId，用于服务端排除提交者
      const socketId = socketService.getSocket()?.id || null;

      const response = await fetch('http://localhost:3001/api/recipe', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          socketId, // 携带 socketId，服务端用于排除提交者
          recipeData,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('[保存] 保存失败:', {
          status: response.status,
          error,
          userId,
        });
        return false;
      }

      const data = await response.json();
      console.log('[保存] 保存成功', {
        version: data.version || data.recipe?.version,
        userId
      });

      // 更新版本和更新时间
      const newVersion = data.version || data.recipe?.version || state.version;
      set({
        version: newVersion,
        metadata: {
          ...state.metadata,
          updatedAt: new Date().toISOString(), // 关键修复:更新保存时间
        }
      });

      return true;
    } catch (error) {
      console.error('[保存] 保存错误:', error);
      return false;
    } finally {
      state.setSaving(false);
    }
  },
}));

/**
 * Selector: 获取流程图节点数组（根据展开状态动态生成）
 */
export const useFlowNodes = (): FlowNode[] => {
  const processes = useRecipeStore((state) => state.processes);
  const expandedProcesses = useRecipeStore((state) => state.expandedProcesses);
  const flowEdges = useFlowEdges();

  return useMemo(() => {
    const nodes: FlowNode[] = [];
    const tempNodes: FlowNode[] = [];

    processes.forEach((process, index) => {
      const isExpanded = expandedProcesses.has(process.id);
      const displayOrder = index + 1;

      if (isExpanded) {
        process.node.subSteps.forEach((subStep) => {
          tempNodes.push({
            id: subStep.id,
            type: 'subStepNode',
            // 设置默认位置 (0, 0)，React Flow 需要 position 属性才能初始化
            // LayoutController 会立即更新为正确的位置
            position: { x: 0, y: 0 },
            data: {
              subStep,
              processId: process.id,
              displayOrder,
            },
          });
        });
      } else {
        tempNodes.push({
          id: process.id,
          type: 'processSummaryNode',
          // 设置默认位置 (0, 0)，React Flow 需要 position 属性才能初始化
          // LayoutController 会立即更新为正确的位置
          position: { x: 0, y: 0 },
          data: {
            processId: process.id,
            processName: process.name,
            subStepCount: process.node.subSteps.length,
            isExpanded: false,
            displayOrder,
          },
        });
      }
    });

    tempNodes.forEach(node => {
      const incomingEdges = flowEdges.filter(e => e.target === node.id);

      if (node.type === 'subStepNode' &&
        node.data.subStep?.processType === ProcessType.COMPOUNDING &&
        incomingEdges.length > 0) {
        const inputSources = incomingEdges
          .map(edge => {
            const sourceNode = tempNodes.find(n => n.id === edge.source);
            if (!sourceNode) return null;

            let sourceName = '';
            if (sourceNode.type === 'subStepNode' && sourceNode.data.subStep) {
              sourceName = sourceNode.data.subStep.label;
            } else if (sourceNode.type === 'processSummaryNode') {
              sourceName = sourceNode.data.processName || sourceNode.data.processId || '';
            }

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
          .sort((a, b) => a.sequenceOrder - b.sequenceOrder);

        node.data = {
          ...node.data,
          inputSources,
        };
      }

      nodes.push(node);
    });

    return nodes;
  }, [processes, expandedProcesses, flowEdges]);
};

/**
 * Selector: 获取流程图连线数组（根据展开状态动态生成）
 */
export const useFlowEdges = (): RecipeEdge[] => {
  const processes = useRecipeStore((state) => state.processes);
  const edges = useRecipeStore((state) => state.edges);
  const expandedProcesses = useRecipeStore((state) => state.expandedProcesses);
  const editingContext = useRecipeStore((state) => state.editingContext);

  return useMemo(() => {
    const flowEdges: RecipeEdge[] = [];

    edges.forEach(edge => {
      const sourceProcess = processes.find(p => p.id === edge.source);
      const targetProcess = processes.find(p => p.id === edge.target);

      if (!sourceProcess || !targetProcess) return;

      const sourceExpanded = expandedProcesses.has(sourceProcess.id);
      const targetExpanded = expandedProcesses.has(targetProcess.id);

      let sourceNodeId: string;
      let targetNodeId: string;

      if (sourceExpanded && sourceProcess.node.subSteps.length > 0) {
        const lastSubStep = sourceProcess.node.subSteps[sourceProcess.node.subSteps.length - 1];
        sourceNodeId = lastSubStep.id;
      } else {
        sourceNodeId = sourceProcess.id;
      }

      if (targetExpanded && targetProcess.node.subSteps.length > 0) {
        const firstSubStep = targetProcess.node.subSteps[0];
        targetNodeId = firstSubStep.id;
      } else {
        targetNodeId = targetProcess.id;
      }

      flowEdges.push({
        ...edge,
        source: sourceNodeId,
        target: targetNodeId,
      });
    });

    processes.forEach(process => {
      if (expandedProcesses.has(process.id) && process.node.subSteps.length > 1) {
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

    // 1. Group edges by target for targetHandle assignment
    const nodeIncomingEdges = new Map<string, RecipeEdge[]>();
    // 2. Group edges by source for sourceHandle assignment
    const nodeOutgoingEdges = new Map<string, RecipeEdge[]>();

    flowEdges.forEach(edge => {
      // Incoming
      const inEdges = nodeIncomingEdges.get(edge.target) || [];
      inEdges.push(edge);
      nodeIncomingEdges.set(edge.target, inEdges);

      // Outgoing - 排除内部边，它们使用默认的中心 handle
      if (!edge.id.startsWith('internal-')) {
        const outEdges = nodeOutgoingEdges.get(edge.source) || [];
        outEdges.push(edge);
        nodeOutgoingEdges.set(edge.source, outEdges);
      }
    });

    return flowEdges.map(edge => {
      // Logic for Target Handle (unchanged)
      const incomingEdges = nodeIncomingEdges.get(edge.target) || [];
      let targetHandle: string | undefined;

      if (incomingEdges.length > 1) {
        const sortedInEdges = [...incomingEdges].sort((a, b) => {
          const orderA = a.data?.sequenceOrder || 0;
          const orderB = b.data?.sequenceOrder || 0;
          return orderA - orderB;
        });
        const handleIndex = sortedInEdges.findIndex(e => e.id === edge.id);
        if (handleIndex >= 0) targetHandle = `target-${handleIndex}`;
      }

      // Logic for Source Handle (new)
      const outgoingEdges = nodeOutgoingEdges.get(edge.source) || [];
      let sourceHandle: string | undefined;

      if (outgoingEdges.length > 1) {
        // Sort outgoing edges by target node's process index
        const sortedOutEdges = [...outgoingEdges].sort((a, b) => {
          // 使用 process index 排序
          const getSortKey = (nodeId: string): number => {
            const pIndex = processes.findIndex(p => p.id === nodeId);
            if (pIndex >= 0) return pIndex * 1000;

            for (let i = 0; i < processes.length; i++) {
              const p = processes[i];
              const sIndex = p.node.subSteps.findIndex(s => s.id === nodeId);
              if (sIndex >= 0) {
                return (i * 1000) + (sIndex + 1);
              }
            }
            return 999999;
          };

          return getSortKey(a.target) - getSortKey(b.target);
        });

        const handleIndex = sortedOutEdges.findIndex(e => e.id === edge.id);
        if (handleIndex >= 0) {
          sourceHandle = `source-${handleIndex}`;
          // 调试日志：验证 sourceHandle 分配
          if (process.env.NODE_ENV === 'development') {
            console.log(`[SourceHandle] Edge ${edge.id}: source=${edge.source}, outgoingCount=${outgoingEdges.length}, handleIndex=${handleIndex}, sourceHandle=${sourceHandle}`);
          }
        }
      }

      // 添加 incomingTotal 用于走廊路由判断
      const incomingTotal = incomingEdges.length;

      // 判断是否应该显示为虚线（编辑态高亮）
      let isEditingDashed = false;

      if (editingContext) {
        const { processId, subStepId } = editingContext;
        const editingProcess = processes.find(p => p.id === processId);

        if (editingProcess) {
          const isInternalEdge = edge.id.startsWith('internal-');

          if (subStepId) {
            // 编辑子步骤：从该子步骤开始往后的内部边 + 如果是最后一步则对外出边
            const subStepIndex = editingProcess.node.subSteps.findIndex(s => s.id === subStepId);
            const isLastSubStep = subStepIndex === editingProcess.node.subSteps.length - 1;

            if (isInternalEdge) {
              // 检查是否是"从该子步骤开始往后"的内部边
              const edgeSourceIndex = editingProcess.node.subSteps.findIndex(s => s.id === edge.source);
              if (edgeSourceIndex >= subStepIndex && edgeSourceIndex < editingProcess.node.subSteps.length - 1) {
                isEditingDashed = true;
              }
            } else if (isLastSubStep) {
              // 如果是最后一步，标记对外出边
              const sourceExpanded = expandedProcesses.has(processId);
              const expectedSourceId = (sourceExpanded && editingProcess.node.subSteps.length > 0)
                ? editingProcess.node.subSteps[editingProcess.node.subSteps.length - 1].id
                : processId;
              if (edge.source === expectedSourceId) {
                isEditingDashed = true;
              }
            }
          } else {
            // 编辑工艺段：该段所有内部边 + 对外出边
            if (isInternalEdge) {
              // 检查是否是该工艺段的内部边
              const sourceSubStep = editingProcess.node.subSteps.find(s => s.id === edge.source);
              const targetSubStep = editingProcess.node.subSteps.find(s => s.id === edge.target);
              if (sourceSubStep && targetSubStep) {
                isEditingDashed = true;
              }
            } else {
              // 检查是否是该工艺段的对外出边
              const sourceExpanded = expandedProcesses.has(processId);
              const expectedSourceId = (sourceExpanded && editingProcess.node.subSteps.length > 0)
                ? editingProcess.node.subSteps[editingProcess.node.subSteps.length - 1].id
                : processId;
              if (edge.source === expectedSourceId) {
                isEditingDashed = true;
              }
            }
          }
        }
      }

      return {
        ...edge,
        data: {
          ...edge.data,
          incomingTotal,
          isEditingDashed,
        },
        targetHandle,
        sourceHandle,
        // 根据编辑态动态设置 animated：只有编辑态虚线才流动
        animated: isEditingDashed ? true : false,
      };
    });
  }, [processes, edges, expandedProcesses, editingContext]);
};

/**
 * Hook: 获取当前的调度结果
 * 基于当前的工艺步骤和默认设备池计算
 */
export const useRecipeSchedule = (): ScheduleResult => {
  const processes = useRecipeStore((state) => state.processes);
  const edges = useRecipeStore((state) => state.edges);

  const schedule = useMemo(() => {
    return calculateSchedule(processes, defaultDevicePool, edges);
  }, [processes, edges]);

  return schedule;
};
