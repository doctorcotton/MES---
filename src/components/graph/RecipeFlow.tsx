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
  applyNodeChanges,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { CustomNode } from './CustomNode';
import { SequenceEdge } from './SequenceEdge';
import { ProcessGroupLayer } from './ProcessGroupLayer';
import { useRecipeStore, useFlatNodes } from '@/store/useRecipeStore';
import { useCollabStore } from '@/store/useCollabStore';
import { useAutoLayout } from '@/hooks/useAutoLayout';

const nodeTypes = {
  customProcessNode: CustomNode,
};

const edgeTypes = {
  sequenceEdge: SequenceEdge,
};

export function RecipeFlow() {
  const nodes = useFlatNodes(); // 使用展平的节点数组
  const { edges, setSelectedNodeId, setNodes } = useRecipeStore();
  const { mode, isEditable } = useCollabStore();
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);
  useAutoLayout();
  
  const isReadOnly = mode === 'view' && !isEditable();

  // 当布局完成后，自动居中显示
  const onInit = useCallback((instance: ReactFlowInstance) => {
    reactFlowInstance.current = instance;
  }, []);

  // 当节点布局更新后，重新居中
  useEffect(() => {
    if (reactFlowInstance.current && nodes.length > 0) {
      // 延迟执行，确保布局计算完成
      const timer = setTimeout(() => {
        reactFlowInstance.current?.fitView({ padding: 0.1, maxZoom: 1.5, minZoom: 0.5 });
      }, 300);
      return () => clearTimeout(timer);
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
    (changes: NodeChange[]) => {
      // 只读模式下不允许任何节点变化
      if (isReadOnly) return;
      
      const updatedNodes = applyNodeChanges(changes, nodes as Node[]);
      setNodes(updatedNodes as any);
    },
    [nodes, isReadOnly, setNodes]
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
        <ProcessGroupLayer />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
