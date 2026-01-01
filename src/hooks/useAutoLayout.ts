import { useEffect, useRef } from 'react';
import dagre from 'dagre';
import { RecipeNode, RecipeEdge, ProcessType } from '../types/recipe';
import { useRecipeStore } from '../store/useRecipeStore';

// 布局配置参数
const LAYOUT_CONFIG = {
  baseNodeWidth: 200,
  baseNodeHeight: 120,
  baseRankSep: 180,        // 基础层间距
  extraSpacingPerInput: 30, // 每个额外输入增加的间距
  // nodeSep 将在计算过程中根据节点宽度动态调整，这里作为最小间距参考
  minNodeSep: 160,            
  enableWeightedCentering: true, // 是否启用加权居中
  centeringStrategy: 'subtree-size' as 'subtree-size' | 'equal-weight' | 'visual-span'
};

/**
 * 根据节点类型和参数复杂度动态估算节点高度
 * 这是解决垂直遮挡问题的关键：不同工艺类型的节点实际高度差异很大
 */
function estimateNodeHeight(node: RecipeNode): number {
  const headerHeight = 40;  // 标题栏固定高度
  const baseBodyHeight = 50; // 基础内容区（位置、原料）
  const lineHeight = 20;    // 每行参数高度
  const padding = 20;       // 上下内边距
  
  let paramLines = 0;
  switch (node.data.processType) {
    case ProcessType.DISSOLUTION:
      paramLines = 4; // 水量、水温、搅拌、赶料
      break;
    case ProcessType.COMPOUNDING:
      paramLines = 3; // 添加物、搅拌、温度
      break;
    case ProcessType.TRANSFER:
      // 根据是否有水量和清洗参数动态计算
      if ('transferParams' in node.data && node.data.transferParams) {
        paramLines = 1; // 类型
        if (node.data.transferParams.waterVolume) paramLines++;
        if (node.data.transferParams.cleaning) paramLines++;
      } else {
        paramLines = 1;
      }
      break;
    case ProcessType.FILTRATION:
    case ProcessType.FLAVOR_ADDITION:
      paramLines = 1;
      break;
    default:
      paramLines = 1;
  }
  
  return headerHeight + baseBodyHeight + (paramLines * lineHeight) + padding;
}

/**
 * 递归使单线连接的下游节点跟随父节点的 X 坐标
 */
function propagateChainCentering(
  nodeId: string, 
  x: number, 
  nodePositions: Record<string, { x: number; y: number }>, 
  edges: RecipeEdge[]
) {
  const childEdges = edges.filter(e => e.source === nodeId);
  childEdges.forEach(edge => {
    const childId = edge.target;
    const childIncoming = edges.filter(e => e.target === childId);
    // 如果该子节点只有这一个输入（单线链路），则强制对齐
    if (childIncoming.length === 1) {
      if (nodePositions[childId]) {
        nodePositions[childId].x = x;
        propagateChainCentering(childId, x, nodePositions, edges);
      }
    }
  });
}

/**
 * 根据投料顺序 (sequenceOrder) 整分支平移，从根本上防止连线交叉
 * 系统性解决方案：不仅移动直接父节点，而是移动整个上游分支
 */
function reorderBranchesHorizontally(
  nodes: RecipeNode[], 
  edges: RecipeEdge[], 
  nodePositions: Record<string, { x: number; y: number }>
) {
  // 找到所有汇聚节点
  nodes.forEach(targetNode => {
    const incomingEdges = edges.filter(e => e.target === targetNode.id);
    if (incomingEdges.length <= 1) return;
    
    // 按 sequenceOrder 排序
    const sortedEdges = [...incomingEdges].sort((a, b) => 
      (a.data?.sequenceOrder || 0) - (b.data?.sequenceOrder || 0)
    );
    
    // 为每个输入分支收集信息
    const branches = sortedEdges.map(edge => {
      const directParent = edge.source;
      // 获取整个上游分支（包括直接父节点及其所有祖先）
      const upstreamNodes = getUpstreamNodes(directParent, edges, nodes);
      
      // 计算分支质心（所有上游节点的平均X）
      const validNodes = upstreamNodes.filter(id => nodePositions[id]);
      if (validNodes.length === 0) {
        return { directParent, upstreamNodes: [], centroidX: nodePositions[directParent]?.x || 0, sequenceOrder: edge.data?.sequenceOrder || 0 };
      }
      
      const centroidX = validNodes.reduce((sum, id) => 
        sum + (nodePositions[id]?.x || 0), 0
      ) / validNodes.length;
      
      return { directParent, upstreamNodes, centroidX, sequenceOrder: edge.data?.sequenceOrder || 0 };
    });
    
    // 按当前质心排序，得到可用的X位置序列
    const sortedCentroidX = [...branches]
      .sort((a, b) => a.centroidX - b.centroidX)
      .map(b => b.centroidX);
    
    // 按 sequenceOrder 重新分配位置：将整个分支平移
    branches.forEach((branch, index) => {
      const oldCentroidX = branch.centroidX;
      const newCentroidX = sortedCentroidX[index];
      const deltaX = newCentroidX - oldCentroidX;
      
      if (Math.abs(deltaX) > 1) { // 只有当偏移量显著时才移动
        // 平移整个分支的所有节点
        branch.upstreamNodes.forEach(nodeId => {
          if (nodePositions[nodeId]) {
            nodePositions[nodeId].x += deltaX;
          }
        });
      }
    });
  });
}

/**
 * 计算反向层级：从终点节点开始反向BFS，标记每个节点距离终点的步数
 * 这样相同反向层级的节点可以对齐在同一Y坐标
 */
function calculateReverseLevel(nodes: RecipeNode[], edges: RecipeEdge[]): Record<string, number> {
  const levels: Record<string, number> = {};
  
  // 1. 找到终点节点（出度为0的节点）
  const endNodes = nodes.filter(n => !edges.some(e => e.source === n.id));
  
  if (endNodes.length === 0) {
    // 如果没有终点节点，从所有节点开始，层级为0
    nodes.forEach(n => levels[n.id] = 0);
    return levels;
  }
  
  // 2. 反向BFS：从终点节点开始，向上遍历
  const queue: Array<{ id: string; level: number }> = endNodes.map(n => ({ id: n.id, level: 0 }));
  const visited = new Set<string>();
  
  while (queue.length > 0) {
    const { id, level } = queue.shift()!;
    
    if (visited.has(id)) continue;
    visited.add(id);
    levels[id] = level;
    
    // 找到所有指向当前节点的节点（父节点）
    const parents = edges
      .filter(e => e.target === id)
      .map(e => e.source)
      .filter(p => !visited.has(p));
    
    parents.forEach(p => {
      queue.push({ id: p, level: level + 1 });
    });
  }
  
  // 处理孤立节点（没有连接关系的节点）
  nodes.forEach(node => {
    if (!(node.id in levels)) {
      levels[node.id] = 0;
    }
  });
  
  return levels;
}

/**
 * 获取节点的所有上游节点（递归遍历所有祖先节点）
 */
function getUpstreamNodes(
  nodeId: string,
  edges: RecipeEdge[],
  nodes: RecipeNode[],
  visited: Set<string> = new Set()
): string[] {
  if (visited.has(nodeId)) return [];
  visited.add(nodeId);
  
  const result = [nodeId];
  
  // 找到所有指向当前节点的边（父节点）
  const parents = edges
    .filter(e => e.target === nodeId)
    .map(e => e.source);
  
  // 递归获取所有父节点的上游节点
  parents.forEach(parentId => {
    const upstream = getUpstreamNodes(parentId, edges, nodes, visited);
    result.push(...upstream);
  });
  
  return result;
}

/**
 * 计算汇聚节点的加权居中位置
 * 基于子树规模的加权质心算法
 */
function calculateConvergenceNodePosition(
  node: RecipeNode,
  edges: RecipeEdge[],
  nodes: RecipeNode[],
  nodePositions: Record<string, { x: number; y: number }>
): number {
  // 获取所有输入节点
  const inputEdges = edges.filter(e => e.target === node.id);
  const inputIds = inputEdges.map(e => e.source);
  
  if (inputIds.length === 0) {
    return nodePositions[node.id]?.x || 0;
  }
  
  // 为每个输入分支计算权重和质心
  const branchWeights: Array<{ weight: number; centroidX: number }> = [];
  
  inputIds.forEach(inputId => {
    // 获取该输入节点的所有上游节点（包括自身）
    const subTree = getUpstreamNodes(inputId, edges, nodes);
    
    // 计算子树中所有节点的x坐标平均值（质心）
    const validNodes = subTree.filter(id => nodePositions[id]);
    if (validNodes.length === 0) {
      // 如果没有位置信息，使用输入节点自身的位置
      const inputPos = nodePositions[inputId];
      if (inputPos) {
        branchWeights.push({
          weight: 1,
          centroidX: inputPos.x
        });
      }
      return;
    }
    
    const centroidX = validNodes.reduce((sum, id) => sum + nodePositions[id].x, 0) / validNodes.length;
    const weight = validNodes.length;
    
    branchWeights.push({ weight, centroidX });
  });
  
  if (branchWeights.length === 0) {
    return nodePositions[node.id]?.x || 0;
  }
  
  // 计算加权平均
  const totalWeight = branchWeights.reduce((sum, b) => sum + b.weight, 0);
  if (totalWeight === 0) {
    return nodePositions[node.id]?.x || 0;
  }
  
  const weightedX = branchWeights.reduce((sum, b) => sum + b.centroidX * b.weight, 0) / totalWeight;
  
  return weightedX;
}

/**
 * 计算自适应垂直间距
 * 根据节点的输入数量动态调整
 */
function calculateAdaptiveSpacing(
  node: RecipeNode,
  edges: RecipeEdge[],
  baseSpacing: number = LAYOUT_CONFIG.baseRankSep
): number {
  const inputCount = edges.filter(e => e.target === node.id).length;
  
  // 基础间距，每多一个输入增加额外间距
  const extraSpacing = Math.max(0, (inputCount - 1) * LAYOUT_CONFIG.extraSpacingPerInput);
  
  return baseSpacing + extraSpacing;
}

/**
 * 按层级分组节点
 */
function groupByLevel(
  nodes: RecipeNode[],
  levels: Record<string, number>
): Record<number, RecipeNode[]> {
  const groups: Record<number, RecipeNode[]> = {};
  
  nodes.forEach(node => {
    const level = levels[node.id] || 0;
    if (!groups[level]) {
      groups[level] = [];
    }
    groups[level].push(node);
  });
  
  return groups;
}

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

    // ========== 步骤1: 计算反向层级 ==========
    const reverseLevels = calculateReverseLevel(nodes, edges);
    
    // ========== 步骤2: 使用dagre计算初始水平布局 ==========
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    
    // 系统性解决遮挡：动态计算水平间距
    // 节点宽 200，我们希望间距至少是宽度的 80%
    const dynamicNodeSep = Math.max(LAYOUT_CONFIG.minNodeSep, LAYOUT_CONFIG.baseNodeWidth * 0.8);
    
    dagreGraph.setGraph({ 
      rankdir: 'TB',
      nodesep: dynamicNodeSep,
      ranksep: LAYOUT_CONFIG.baseRankSep,
      marginx: 100,
      marginy: 50,
      align: 'DL'
    });

    // 计算每个节点的输入边
    const nodeIncomingEdges: Record<string, typeof edges> = {};
    edges.forEach(edge => {
      if (!nodeIncomingEdges[edge.target]) {
        nodeIncomingEdges[edge.target] = [];
      }
      nodeIncomingEdges[edge.target].push(edge);
    });

    // 计算节点宽度和高度（使用动态估算）
    const calculatedNodeWidths: Record<string, number> = {};
    const calculatedNodeHeights: Record<string, number> = {};
    nodes.forEach(node => {
      const incoming = nodeIncomingEdges[node.id] || [];
      const inputCount = incoming.length;
      const width = inputCount > 3 ? Math.max(200, inputCount * 80) : 200;
      const height = estimateNodeHeight(node);
      calculatedNodeWidths[node.id] = width;
      calculatedNodeHeights[node.id] = height;
      dagreGraph.setNode(node.id, { width, height });
    });

    // 添加边到 dagre graph
    edges.forEach((edge) => {
      dagreGraph.setEdge(edge.source, edge.target);
    });

    // 计算dagre布局（主要用于水平位置）
    dagre.layout(dagreGraph);

    // 获取dagre计算的初始位置
    const initialPositions: Record<string, { x: number; y: number }> = {};
    nodes.forEach(node => {
      const pos = dagreGraph.node(node.id);
      initialPositions[node.id] = { x: pos.x, y: pos.y };
    });

    // ========== 步骤3: 按反向层级重新计算Y坐标 ==========
    const levelGroups = groupByLevel(nodes, reverseLevels);
    // 反向层级：level 0是终点（最底层），level越大越靠上
    // 所以从大到小排序，从顶层到底层
    const levelKeys = Object.keys(levelGroups).map(Number).sort((a, b) => b - a);
    
    // 计算每层的Y坐标，使用自适应间距和动态高度
    const nodePositions: Record<string, { x: number; y: number }> = {};
    let currentY = 50; // 起始Y坐标（从顶部开始）
    
    levelKeys.forEach((level, index) => {
      const levelNodes = levelGroups[level];
      
      // 计算这一层到下一层（更小的level，更靠近终点）的间距
      if (index > 0) {
        // 系统性解决垂直遮挡：使用上一层的最大节点高度
        const prevLevel = levelKeys[index - 1];
        const prevLevelNodes = levelGroups[prevLevel];
        const maxPrevHeight = Math.max(...prevLevelNodes.map(n => calculatedNodeHeights[n.id] || estimateNodeHeight(n)));
        
        // 层间距 = 上一层最大高度 + 安全边距(60px)
        // 这确保了即使节点内容撑高，也不会遮挡下一层
        const baseSpacing = maxPrevHeight + 60;
        
        // 如果当前层有多个输入，增加额外间距
        const maxInputNode = levelNodes.reduce((max, node) => {
          const maxInputs = nodeIncomingEdges[max.id]?.length || 0;
          const nodeInputs = nodeIncomingEdges[node.id]?.length || 0;
          return nodeInputs > maxInputs ? node : max;
        }, levelNodes[0]);
        
        const extraSpacing = calculateAdaptiveSpacing(maxInputNode, edges) - LAYOUT_CONFIG.baseRankSep;
        const spacing = baseSpacing + Math.max(0, extraSpacing);
        
        currentY += spacing;
      }
      
      // 为这一层的所有节点分配Y坐标
      levelNodes.forEach(node => {
        // 先使用dagre计算的X坐标
        nodePositions[node.id] = {
          x: initialPositions[node.id]?.x || 0,
          y: currentY
        };
      });
    });

    // ========== 步骤4: 对汇聚节点应用加权居中与顺序修正 ==========
    
    // 1. 先进行投料顺序修正，确保 X 坐标物理顺序与 sequenceOrder 一致
    // 系统性解决交叉：整分支平移，确保上游分支随直接父节点一起移动
    reorderBranchesHorizontally(nodes, edges, nodePositions);

    if (LAYOUT_CONFIG.enableWeightedCentering) {
      // 2. 识别汇聚节点并应用加权居中
      const convergenceNodes = nodes.filter(node => 
        (nodeIncomingEdges[node.id]?.length || 0) > 1 || 
        node.data.processType === ProcessType.COMPOUNDING
      );
      
      convergenceNodes.forEach(node => {
        const newX = calculateConvergenceNodePosition(node, edges, nodes, nodePositions);
        nodePositions[node.id].x = newX;
        
        // 3. 系统性解决对齐：将中心位置向下游单线支路传播
        propagateChainCentering(node.id, newX, nodePositions, edges);
      });
    }

    // ========== 步骤5: 为边分配 targetHandle ==========
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

    // 更新节点位置（使用动态高度）
    const layoutedNodes: RecipeNode[] = nodes.map((node) => {
      const pos = nodePositions[node.id];
      const width = calculatedNodeWidths[node.id];
      const height = calculatedNodeHeights[node.id] || estimateNodeHeight(node);
      if (!pos) return node;
      return {
        ...node,
        style: { ...(node as any).style, width }, 
        position: {
          x: pos.x - width / 2,
          y: pos.y - height / 2,
        },
      };
    });

    setNodes(layoutedNodes);
    setEdges(updatedEdges);
  }, [nodes, edges, setNodes, setEdges]);
}
