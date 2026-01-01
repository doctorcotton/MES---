import { useEffect, useRef } from 'react';
import dagre from 'dagre';
import { RecipeNode } from '../types/recipe';
import { useRecipeStore } from '../store/useRecipeStore';

const nodeWidth = 200;
const nodeHeight = 120;

export function useAutoLayout() {
  const { nodes, edges, setNodes, setEdges } = useRecipeStore();
  const prevNodesRef = useRef<string>('');
  const prevEdgesRef = useRef<string>('');

  useEffect(() => {
    if (nodes.length === 0) return;

    // 检查是否所有节点都是临时 position（从服务器同步时可能只有 {x: 0, y: 0}）
    const allNodesHaveTempPosition = nodes.every(
      node => node.position?.x === 0 && node.position?.y === 0
    );

    // 创建节点和边的签名用于比较
    const nodesSignature = JSON.stringify(nodes.map(n => ({ id: n.id, data: n.data })));
    const edgesSignature = JSON.stringify(edges.map(e => ({ source: e.source, target: e.target, data: e.data })));

    // 如果节点或边的数据没有变化，且不是所有节点都是临时 position，跳过布局计算
    if (prevNodesRef.current === nodesSignature && prevEdgesRef.current === edgesSignature && !allNodesHaveTempPosition) {
      return;
    }

    prevNodesRef.current = nodesSignature;
    prevEdgesRef.current = edgesSignature;

    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    // 优化布局参数：增加垂直间距解决连线交叉问题
    dagreGraph.setGraph({ 
      rankdir: 'TB',
      nodesep: 120,   // 增加水平间距，防止宽节点碰撞
      ranksep: 150,   // 大幅增加垂直间距，解决 Tank 节点过低导致的连线交叉
      marginx: 50,    // 增加画布边距
      marginy: 50,
      align: 'DL'     // Down-Left 对齐，改善树形结构
    });

    // 计算每个节点的输入边
    const nodeIncomingEdges: Record<string, typeof edges> = {};
    edges.forEach(edge => {
      if (!nodeIncomingEdges[edge.target]) {
        nodeIncomingEdges[edge.target] = [];
      }
      nodeIncomingEdges[edge.target].push(edge);
    });

    // 排序输入边并计算节点宽度
    const calculatedNodeWidths: Record<string, number> = {};
    nodes.forEach(node => {
      const incoming = nodeIncomingEdges[node.id] || [];
      const inputCount = incoming.length;
      // 优化宽度计算，给予更多横向空间
      const width = inputCount > 3 ? Math.max(200, inputCount * 80) : 200;
      calculatedNodeWidths[node.id] = width;
      dagreGraph.setNode(node.id, { width, height: nodeHeight });
    });

    // 添加边到 dagre graph
    edges.forEach((edge) => {
      dagreGraph.setEdge(edge.source, edge.target);
    });

    // 计算布局
    dagre.layout(dagreGraph);

    // 获取布局后的节点位置信息
    const nodePositions: Record<string, { x: number; y: number }> = {};
    nodes.forEach(node => {
      const pos = dagreGraph.node(node.id);
      nodePositions[node.id] = { x: pos.x, y: pos.y };
    });

    // 为边分配 targetHandle，基于物理位置排序消除交叉
    const updatedEdges = edges.map(edge => {
      const incoming = nodeIncomingEdges[edge.target] || [];
      if (incoming.length <= 1) return edge;

      // 按 Source 节点的布局 X 坐标排序，而不是 sequenceOrder
      // 这能保证物理上从左到右进入，杜绝交叉
      const sortedIncoming = [...incoming].sort((a, b) => {
        const posXA = nodePositions[a.source]?.x || 0;
        const posXB = nodePositions[b.source]?.x || 0;
        return posXA - posXB;
      });
      
      const handleIndex = sortedIncoming.findIndex(e => e.id === edge.id);
      return {
        ...edge,
        targetHandle: `target-${handleIndex}`
      };
    });

    // 更新节点位置
    const layoutedNodes: RecipeNode[] = nodes.map((node) => {
      const pos = nodePositions[node.id];
      const width = calculatedNodeWidths[node.id];
      if (!pos) return node;
      return {
        ...node,
        style: { ...node.style, width }, 
        position: {
          x: pos.x - width / 2,
          y: pos.y - nodeHeight / 2,
        },
      };
    });

    setNodes(layoutedNodes);
    setEdges(updatedEdges);
  }, [nodes, edges, setNodes, setEdges]);
}
