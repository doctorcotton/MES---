import { useCallback, useEffect, useRef } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  ConnectionMode,
  ReactFlowInstance,
  NodeChange,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { CustomNode } from './CustomNode';
import { SequenceEdge } from './SequenceEdge';
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

export function RecipeFlow() {
  const nodes = useFlowNodes(); // 使用动态生成的节点数组
  const edges = useFlowEdges(); // 使用动态生成的连线数组
  const { setSelectedNodeId } = useRecipeStore();
  const { mode, isEditable } = useCollabStore();
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);
  const prevNodesSignatureRef = useRef<string>('');
  useAutoLayout();
  
  const isReadOnly = mode === 'view' && !isEditable();

  // 当布局完成后，自动居中显示
  const onInit = useCallback((instance: ReactFlowInstance) => {
    reactFlowInstance.current = instance;
  }, []);

  // 当节点布局更新后，重新居中（只在节点真正变化时）
  useEffect(() => {
    if (reactFlowInstance.current && nodes.length > 0) {
      // 计算节点签名：节点ID的排序数组，用于检测节点是否真正变化
      const nodesSignature = JSON.stringify([...nodes.map(n => n.id)].sort());
      
      // 只有当节点签名真正变化时才调用 fitView
      if (prevNodesSignatureRef.current !== nodesSignature) {
        prevNodesSignatureRef.current = nodesSignature;
        
        // 延迟执行，确保布局计算完成
        const timer = setTimeout(() => {
          reactFlowInstance.current?.fitView({ padding: 0.1, maxZoom: 1.5, minZoom: 0.5 });
        }, 300);
        return () => clearTimeout(timer);
      }
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
    <div className="h-full w-full">
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
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
