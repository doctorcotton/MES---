import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  ConnectionMode,
  ReactFlowInstance,
  NodeChange,
  useUpdateNodeInternals,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { CustomNode } from './CustomNode';
import { SequenceEdge } from './SequenceEdge';
import { DebugOverlay, toggleDebugMode } from './DebugOverlay';
import { DebugStatsPanel } from './DebugStatsPanel';
import { LayoutController } from './LayoutController';
import { useRecipeStore, useFlowNodes, useFlowEdges } from '@/store/useRecipeStore';
import { useCollabStore } from '@/store/useCollabStore';
import { FlowNode } from '@/types/recipe';

const nodeTypes = {
  processSummaryNode: CustomNode,
  subStepNode: CustomNode,
};

const edgeTypes = {
  sequenceEdge: SequenceEdge,
};

/**
 * 内部组件：用于更新节点的 handle 位置
 * 必须在 ReactFlow 内部渲染，因为 useUpdateNodeInternals 需要访问 React Flow 的内部 store
 */
function NodeInternalsUpdater({ nodes, edges }: { nodes: Node[], edges: Edge[] }) {
  const updateNodeInternals = useUpdateNodeInternals();

  // 当 edges 变化时，更新所有节点的 handle 位置
  // React Flow 需要此调用来感知动态 handle 数量的变化
  useEffect(() => {
    if (nodes.length > 0) {
      const nodeIds = nodes.map(n => n.id);
      updateNodeInternals(nodeIds);
    }
  }, [edges, nodes, updateNodeInternals]);

  return null; // 此组件不渲染任何内容
}

export function RecipeFlow() {
  // 获取基础节点数据（动态内容，不含布局位置）
  const baseNodes = useFlowNodes();
  const edges = useFlowEdges(); // 使用动态生成的连线数组
  const processes = useRecipeStore(state => state.processes);
  const expandedProcesses = useRecipeStore(state => state.expandedProcesses);
  const { setSelectedNodeId } = useRecipeStore();
  const { mode, isEditable } = useCollabStore();
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);
  const [layoutReady, setLayoutReady] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const layoutReadyRef = useRef(false);
  
  // 受控节点状态：作为 ReactFlow 的唯一节点来源
  const [nodesState, setNodesState] = useState<FlowNode[]>(() => baseNodes);

  const isReadOnly = mode === 'view' && !isEditable();
  
  // 当基础节点数据变化时，合并旧位置到新内容，避免位置丢失
  useEffect(() => {
    setNodesState(prevNodesState => {
      // 创建位置映射表
      const positionMap = new Map(
        prevNodesState.map(n => [n.id, n.position])
      );
      
      // 合并：使用新的基础数据，但保留现有节点的位置
      const mergedNodes = baseNodes.map(baseNode => ({
        ...baseNode,
        position: positionMap.get(baseNode.id) ?? baseNode.position ?? { x: 0, y: 0 },
      }));
      
      console.log('[RecipeFlow] 合并节点数据:', {
        baseNodesCount: baseNodes.length,
        prevNodesCount: prevNodesState.length,
        mergedNodesCount: mergedNodes.length,
        preservedPositions: Array.from(positionMap.keys()).length,
        samplePositions: mergedNodes.slice(0, 3).map(n => ({
          id: n.id,
          x: n.position.x,
          y: n.position.y,
        })),
      });
      
      return mergedNodes;
    });
  }, [baseNodes]);
  
  // LayoutController 更新节点的回调
  const handleNodesUpdate = useCallback((updatedNodes: FlowNode[]) => {
    console.log('[RecipeFlow] 收到 LayoutController 的节点更新:', {
      nodeCount: updatedNodes.length,
      samplePositions: updatedNodes.slice(0, 3).map(n => ({
        id: n.id,
        x: n.position.x,
        y: n.position.y,
      })),
    });
    setNodesState(updatedNodes);
  }, []);
  
  // 布局完成回调
  const onLayoutComplete = useCallback(() => {
    // 清理布局超时，避免布局已完成还触发一次 re-render
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setLayoutReady(true);
  }, []);
  
  // 内容变化触发器 - 用于检测需要重新布局的情况
  // 只包含影响布局的信息：工艺段ID、子步骤ID、展开状态
  const layoutTrigger = useMemo(() => {
    const processIds = processes.map(p => p.id).join(',');
    const subStepIds = processes.flatMap(p => p.node.subSteps.map(s => s.id)).join(',');
    const expandedIds = Array.from(expandedProcesses).sort().join(',');
    
    return `${processIds}|${subStepIds}|${expandedIds}`;
  }, [processes, expandedProcesses]);
  
  // 添加调试日志，监控 layoutTrigger 变化（只依赖 layoutTrigger，避免引用抖动导致重复输出）
  const lastLayoutTriggerRef = useRef<string>('');
  useEffect(() => {
    // 只有 layoutTrigger 字符串真的变化时才输出日志
    if (layoutTrigger === lastLayoutTriggerRef.current) {
      return;
    }
    
    lastLayoutTriggerRef.current = layoutTrigger;
    // 在 effect 内部读取最新的 store 值（避免依赖引用变化）
    const currentState = useRecipeStore.getState();
    console.log('[RecipeFlow] layoutTrigger 变化:', {
      新值: layoutTrigger,
      processes数量: currentState.processes.length,
      expandedProcesses: Array.from(currentState.expandedProcesses),
      processIds: currentState.processes.map(p => p.id),
      触发时间: new Date().toISOString(),
    });
  }, [layoutTrigger]);
  
  // 内容变化时重置布局状态，并添加超时保护
  useEffect(() => {
    console.log('[RecipeFlow] 检测到布局内容变化，重置布局状态');
    setLayoutReady(false);
    
    // 清理之前的超时
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // 3秒后强制显示（容错机制）
    timeoutRef.current = setTimeout(() => {
      // 检查是否已完成布局，避免布局已完成还触发
      if (!layoutReadyRef.current) {
        console.warn('[RecipeFlow] 布局超时，强制显示');
        setLayoutReady(true);
      }
      timeoutRef.current = null;
    }, 3000);
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [layoutTrigger]);

  // 保持一个最新的 layoutReady 引用，供 timeout 回调读取（避免闭包读到旧值）
  useEffect(() => {
    layoutReadyRef.current = layoutReady;
  }, [layoutReady]);
  
  // 调试模式状态
  const [debugMode, setDebugMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('debug_layout') === 'true';
  });

  // 监听 localStorage 变化
  useEffect(() => {
    const handleStorageChange = () => {
      setDebugMode(localStorage.getItem('debug_layout') === 'true');
    };
    window.addEventListener('storage', handleStorageChange);
    // 也监听同标签页内的变化（通过自定义事件）
    const handleCustomStorageChange = () => {
      setDebugMode(localStorage.getItem('debug_layout') === 'true');
    };
    window.addEventListener('debugLayoutToggle', handleCustomStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('debugLayoutToggle', handleCustomStorageChange);
    };
  }, []);

  const handleToggleDebug = () => {
    const newValue = toggleDebugMode();
    setDebugMode(newValue);
    // 触发自定义事件，通知同标签页内的其他组件
    window.dispatchEvent(new Event('debugLayoutToggle'));
  };

  // 导出 PNG 图片
  const handleExportPNG = useCallback(async () => {
    if (!reactFlowInstance.current) return;

    try {
      // 动态导入 html-to-image（按需加载）
      // @ts-ignore - 动态导入，类型检查在运行时
      const { toPng } = await import('html-to-image');
      
      // 获取 ReactFlow 的 viewport 容器
      const viewportElement = document.querySelector('.react-flow__viewport') as HTMLElement;
      if (!viewportElement) {
        console.error('[RecipeFlow] 找不到 ReactFlow viewport 元素');
        return;
      }

      // 导出为 PNG
      const dataUrl = await toPng(viewportElement, {
        backgroundColor: '#ffffff',
        quality: 1.0,
        pixelRatio: 2, // 提高清晰度
      });

      // 创建下载链接
      const link = document.createElement('a');
      link.download = `recipe-flow-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('[RecipeFlow] 导出 PNG 失败:', error);
      if ((error as Error).message?.includes('Cannot find module')) {
        console.error('[RecipeFlow] 请先安装依赖: npm install html-to-image');
      }
    }
  }, []);

  // 初始化 React Flow 实例
  const onInit = useCallback((instance: ReactFlowInstance) => {
    reactFlowInstance.current = instance;
  }, []);

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setSelectedNodeId(node.id);
      // 滚动到表格对应行
      const rowElement = document.getElementById(`row-${node.id}`);
      if (rowElement) {
        rowElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        rowElement.classList.add('bg-blue-100');
        setTimeout(() => {
          rowElement.classList.remove('bg-blue-100');
        }, 2000);
      }
    },
    [setSelectedNodeId]
  );

  const onNodeMouseEnter = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      useRecipeStore.getState().setHoveredNodeId(node.id);
    },
    []
  );

  const onNodeMouseLeave = useCallback(() => {
    useRecipeStore.getState().setHoveredNodeId(null);
  }, []);

  const onNodesChange = useCallback(
    (_changes: NodeChange[]) => {
      // 只读模式下不允许任何节点变化
      if (isReadOnly) return;

      // 节点位置变化由布局算法处理，这里不需要更新store
      // 因为节点是动态生成的，位置由布局算法计算
    },
    [isReadOnly]
  );

  // 添加节点状态检查日志（使用受控的 nodesState）
  useEffect(() => {
    const nonZeroPositions = nodesState.filter(n => n.position.x !== 0 || n.position.y !== 0);
    console.log('[RecipeFlow] 节点状态检查:', {
      nodeCount: nodesState.length,
      edgeCount: edges.length,
      layoutReady,
      nonZeroPositionCount: nonZeroPositions.length,
      allZeroPosition: nodesState.every(n => n.position.x === 0 && n.position.y === 0),
      samplePositions: nodesState.slice(0, 5).map(n => ({
        id: n.id,
        x: n.position.x,
        y: n.position.y,
      })),
    });
  }, [nodesState, edges, layoutReady]);

  return (
    <div className="h-full w-full relative">
      {/* 加载指示器 */}
      {!layoutReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-10">
          <div className="text-gray-500 text-sm">
            <div className="animate-spin h-5 w-5 border-2 border-gray-300 border-t-blue-500 rounded-full inline-block mr-2" />
            布局计算中...
          </div>
        </div>
      )}
      
      {/* 调试模式开关按钮 */}
      <button
        onClick={handleToggleDebug}
        className={`
          absolute top-4 right-4 z-50 px-3 py-2 rounded-md text-sm font-medium shadow-lg
          transition-colors
          ${debugMode 
            ? 'bg-red-500 hover:bg-red-600 text-white' 
            : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
          }
        `}
        title={debugMode ? '关闭调试模式' : '开启调试模式（显示连线长度）'}
      >
        {debugMode ? '🔴 调试: 开' : '⚪ 调试: 关'}
      </button>

      {/* 导出 PNG 按钮 */}
      {layoutReady && (
        <button
          onClick={handleExportPNG}
          className="absolute top-4 right-32 z-50 px-3 py-2 rounded-md text-sm font-medium shadow-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors"
          title="导出当前流程图为 PNG 图片"
        >
          📥 导出 PNG
        </button>
      )}
      
      {/* ReactFlow 容器 - 布局完成前隐藏 */}
      <div 
        style={{ 
          opacity: layoutReady ? 1 : 0,
          transition: 'opacity 0.2s ease-in-out'
        }}
        className="h-full w-full"
      >
        <ReactFlow
          nodes={nodesState as Node[]}
          edges={edges as Edge[]}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onInit={onInit}
          onNodesChange={onNodesChange}
          onNodeClick={onNodeClick}
          onNodeMouseEnter={onNodeMouseEnter}
          onNodeMouseLeave={onNodeMouseLeave}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={!isReadOnly}
          connectionMode={ConnectionMode.Loose}
        >
          <LayoutController 
            onLayoutComplete={onLayoutComplete}
            onNodesUpdate={handleNodesUpdate}
            layoutTrigger={layoutTrigger}
          />
          <NodeInternalsUpdater nodes={nodesState as Node[]} edges={edges as Edge[]} />
          <Background />
          <Controls />
          <MiniMap />
          <DebugOverlay enabled={debugMode} />
          <DebugStatsPanel enabled={debugMode} />
        </ReactFlow>
      </div>
    </div>
  );
}

