import { useCallback, useEffect, useRef, useState } from 'react';
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
import { useRecipeStore, useFlowNodes, useFlowEdges } from '@/store/useRecipeStore';
import { useCollabStore } from '@/store/useCollabStore';
import { useAutoLayout } from '@/hooks/useAutoLayout';

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
  const nodes = useFlowNodes(); // 使用动态生成的节点数组
  const edges = useFlowEdges(); // 使用动态生成的连线数组
  const { setSelectedNodeId } = useRecipeStore();
  const { mode, isEditable } = useCollabStore();
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);
  const prevNodesSignatureRef = useRef<string>('');
  const isInitialMountRef = useRef<boolean>(true);
  useAutoLayout();

  const isReadOnly = mode === 'view' && !isEditable();
  
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

  // 当布局完成后，自动居中显示
  const onInit = useCallback((instance: ReactFlowInstance) => {
    reactFlowInstance.current = instance;
  }, []);

  // 当节点布局更新后，重新居中（只在节点真正变化时）
  useEffect(() => {
    if (!reactFlowInstance.current || nodes.length === 0) return;

    // 计算节点签名：节点ID的排序数组，用于检测节点是否真正变化
    const nodesSignature = JSON.stringify([...nodes.map(n => n.id)].sort());

    // 只有当节点签名真正变化时才调用 fitView
    if (prevNodesSignatureRef.current !== nodesSignature) {
      prevNodesSignatureRef.current = nodesSignature;

      const isInitialMount = isInitialMountRef.current;
      isInitialMountRef.current = false;

      // 检查位置是否就绪（从 store 获取最新状态，避免闭包陷阱）
      const nodePositions = useRecipeStore.getState().nodePositions;
      const hasValidPositions = Object.keys(nodePositions).length > 0;

      // 根据位置就绪状态选择延时策略
      // 位置就绪时零延时，未就绪时 50ms 等待布局完成
      const delay = hasValidPositions ? 0 : 50;

      const timerId = setTimeout(() => {
        reactFlowInstance.current?.fitView({
          padding: 0.1,
          maxZoom: 1.5,
          minZoom: 0.5,
          duration: isInitialMount ? 0 : 300 // 首次无动画，后续有动画
        });
      }, delay);

      return () => clearTimeout(timerId);
    }
  }, [nodes]);

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

  return (
    <div className="h-full w-full relative">
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
      
      {/* 调试统计面板 */}
      <DebugStatsPanel enabled={debugMode} />
      
      <ReactFlow
        nodes={nodes as Node[]}
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
        <NodeInternalsUpdater nodes={nodes as Node[]} edges={edges as Edge[]} />
        <Background />
        <Controls />
        <MiniMap />
        <DebugOverlay enabled={debugMode} />
      </ReactFlow>
    </div>
  );
}

