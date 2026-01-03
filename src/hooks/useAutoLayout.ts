import { useEffect, useRef } from 'react';
import dagre from 'dagre';
import { FlowNode, RecipeEdge, ProcessType } from '../types/recipe';
import { useRecipeStore, useFlowNodes, useFlowEdges } from '../store/useRecipeStore';

// 布局配置参数
const LAYOUT_CONFIG = {
  baseNodeWidth: 200,
  baseNodeHeight: 120,
  baseRankSep: 180,        // 基础层间距
  extraSpacingPerInput: 30, // 每个额外输入增加的间距
  // nodeSep 将在计算过程中根据节点宽度动态调整，这里作为最小间距参考
  minNodeSep: 100,         // 减小最小节点间距（从160降至100，减少37.5%）            
  enableWeightedCentering: true, // 是否启用加权居中
  centeringStrategy: 'subtree-size' as 'subtree-size' | 'equal-weight' | 'visual-span',
  // 分档宽度配置
  widthTiers: {
    tier1: { maxInputs: 2, width: 200 },  // 1-2个输入：200px
    tier2: { maxInputs: 4, width: 280 },  // 3-4个输入：280px
    tier3: { maxInputs: Infinity, width: 360 } // 5个及以上：360px
  },
  // 内容换行估算参数
  charWidth: 8,           // 每个字符平均宽度（px）
  lineHeight: 20,         // 每行文本高度（px）
  minContentWidth: 150,   // 内容区域最小宽度（考虑padding）
};

/**
 * 根据输入数量计算分档宽度
 */
function calculateTieredWidth(inputCount: number): number {
  const { widthTiers } = LAYOUT_CONFIG;
  if (inputCount <= widthTiers.tier1.maxInputs) {
    return widthTiers.tier1.width;
  } else if (inputCount <= widthTiers.tier2.maxInputs) {
    return widthTiers.tier2.width;
  } else {
    return widthTiers.tier3.width;
  }
}

/**
 * 估算文本内容在给定宽度下的行数（考虑换行）
 */
function estimateTextLines(text: string, availableWidth: number): number {
  if (!text) return 0;
  const { charWidth } = LAYOUT_CONFIG;
  const estimatedCharsPerLine = Math.floor(availableWidth / charWidth);
  if (estimatedCharsPerLine <= 0) return 1;
  return Math.max(1, Math.ceil(text.length / estimatedCharsPerLine));
}

/**
 * 根据节点类型和参数复杂度动态估算节点高度
 * 考虑内容换行后的实际高度
 */
function estimateNodeHeight(node: FlowNode, nodeWidth: number): number {
  const headerHeight = 40;  // 标题栏固定高度
  const baseBodyHeight = 30; // 基础内容区最小高度
  const lineHeight = LAYOUT_CONFIG.lineHeight;    // 每行参数高度
  const padding = 20;       // 上下内边距
  const contentPadding = 12; // 内容区域左右padding
  
  // 汇总节点高度
  if (node.type === 'processSummaryNode') {
    return headerHeight + baseBodyHeight + padding;
  }
  
  // 子步骤节点高度
  if (node.type === 'subStepNode' && node.data.subStep) {
    const subStep = node.data.subStep;
    let paramLines = 0;
    let contentLines = 0;
    
    // 估算位置和原料的换行行数
    const availableWidth = nodeWidth - (contentPadding * 2);
    if (subStep.deviceCode) {
      contentLines += estimateTextLines(`位置: ${subStep.deviceCode}`, availableWidth);
    }
    if (subStep.ingredients) {
      contentLines += estimateTextLines(`原料: ${subStep.ingredients}`, availableWidth);
    }
    
    // 根据工艺类型估算参数行数
    switch (subStep.processType) {
      case ProcessType.DISSOLUTION:
        paramLines = 4; // 水量、水温、搅拌、赶料
        break;
      case ProcessType.COMPOUNDING:
        paramLines = 3; // 添加物、搅拌、温度
        // 调配节点需要额外空间显示进料列表
        // 进料列表高度：每个进料约15-20px，加上标题行
        const inputCount = node.data.inputSources?.length || 0;
        if (inputCount > 0) {
          paramLines += 1; // "进料顺序"标题
          paramLines += inputCount; // 每个进料一行
        }
        break;
      case ProcessType.TRANSFER:
        if ('transferParams' in subStep.params && subStep.params.transferParams) {
          paramLines = 1; // 类型
          if (subStep.params.transferParams.waterVolume) paramLines++;
          if (subStep.params.transferParams.cleaning) paramLines++;
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
    
    // 总高度 = 标题 + 内容行 + 参数行 + 内边距
    const totalLines = Math.max(contentLines, 2) + paramLines; // 至少2行基础内容
    return headerHeight + (totalLines * lineHeight) + padding;
  }
  
  return headerHeight + baseBodyHeight + padding;
}

/**
 * 递归使单线连接的下游节点跟随父节点的 X 坐标
 */
function propagateChainCentering(
  nodeId: string, 
  x: number, 
  nodePositions: Record<string, { x: number; y: number }>, 
  edges: RecipeEdge[],
  nodes: FlowNode[]
) {
  const childEdges = edges.filter(e => e.source === nodeId);
  childEdges.forEach(edge => {
    const childId = edge.target;
    const childIncoming = edges.filter(e => e.target === childId);
    // 如果该子节点只有这一个输入（单线链路），则强制对齐
      if (childIncoming.length === 1) {
        if (nodePositions[childId]) {
          nodePositions[childId].x = x;
          propagateChainCentering(childId, x, nodePositions, edges, nodes);
        }
      }
  });
}

/**
 * 根据投料顺序 (sequenceOrder) 整分支平移，从根本上防止连线交叉
 * 系统性解决方案：不仅移动直接父节点，而是移动整个上游分支
 */
function reorderBranchesHorizontally(
  nodes: FlowNode[], 
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
function calculateReverseLevel(nodes: FlowNode[], edges: RecipeEdge[]): Record<string, number> {
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
  nodes: FlowNode[],
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
  node: FlowNode,
  edges: RecipeEdge[],
  nodes: FlowNode[],
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
  node: FlowNode,
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
  nodes: FlowNode[],
  levels: Record<string, number>
): Record<number, FlowNode[]> {
  const groups: Record<number, FlowNode[]> = {};
  
  nodes.forEach(node => {
    const level = levels[node.id] || 0;
    if (!groups[level]) {
      groups[level] = [];
    }
    groups[level].push(node);
  });
  
  return groups;
}

/**
 * 改进贪心聚类算法（最优解）
 * 关键改进：检查组内最大差异，避免不合理分组
 */
function improvedClusterSimilarSizes(
  sizes: { id: string; value: number }[],
  threshold: number = 0.15,
  minGroupSize: number = 1
): Map<string, number> {
  if (sizes.length === 0) return new Map();
  if (sizes.length === 1) {
    return new Map([[sizes[0].id, sizes[0].value]]);
  }
  
  // 按尺寸从小到大排序
  const sorted = [...sizes].sort((a, b) => a.value - b.value);
  
  // 聚类分组
  const clusters: Array<{ 
    ids: string[]; 
    minValue: number;
    maxValue: number;
  }> = [];
  
  let currentCluster = {
    ids: [sorted[0].id],
    minValue: sorted[0].value,
    maxValue: sorted[0].value
  };
  
  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    
    // 关键改进：检查加入后组内最大差异
    const newMaxValue = current.value;
    const groupSpan = (newMaxValue - currentCluster.minValue) / currentCluster.minValue;
    
    // 如果组内差异仍在阈值内，归入当前组
    if (groupSpan <= threshold) {
      currentCluster.ids.push(current.id);
      currentCluster.maxValue = newMaxValue;
    } else {
      // 差异过大，创建新组
      clusters.push(currentCluster);
      currentCluster = {
        ids: [current.id],
        minValue: current.value,
        maxValue: current.value
      };
    }
  }
  clusters.push(currentCluster);
  
  // 单节点合并策略（可选）
  if (minGroupSize >= 2) {
    mergeSingletonClusters(clusters, threshold);
  }
  
  // 构建映射：节点ID -> 统一尺寸（使用组内最大值）
  const result = new Map<string, number>();
  clusters.forEach(cluster => {
    cluster.ids.forEach(id => {
      result.set(id, cluster.maxValue);
    });
  });
  
  return result;
}

/**
 * 合并单节点到最近的组
 * 减少碎片化，提高统一效果
 */
function mergeSingletonClusters(
  clusters: Array<{ 
    ids: string[]; 
    minValue: number;
    maxValue: number;
  }>,
  threshold: number
): void {
  // 从后向前处理，避免索引问题
  for (let i = clusters.length - 1; i >= 0; i--) {
    if (clusters[i].ids.length === 1) {
      const singletonValue = clusters[i].minValue;
      let merged = false;
      
      // 尝试合并到前一组
      if (i > 0) {
        const prevCluster = clusters[i - 1];
        const diffToPrev = (singletonValue - prevCluster.minValue) / prevCluster.minValue;
        
        // 稍微放宽阈值（1.5倍），优先合并
        if (diffToPrev <= threshold * 1.5) {
          prevCluster.ids.push(...clusters[i].ids);
          prevCluster.maxValue = Math.max(prevCluster.maxValue, singletonValue);
          clusters.splice(i, 1);
          merged = true;
          continue;
        }
      }
      
      // 如果没合并成功，尝试合并到后一组
      if (!merged && i < clusters.length - 1) {
        const nextCluster = clusters[i + 1];
        const diffToNext = (nextCluster.maxValue - singletonValue) / singletonValue;
        
        if (diffToNext <= threshold * 1.5) {
          nextCluster.ids.push(...clusters[i].ids);
          nextCluster.minValue = Math.min(nextCluster.minValue, singletonValue);
          clusters.splice(i, 1);
        }
      }
    }
  }
}

/**
 * 计算智能统一尺寸
 * 先按类型分组，组内使用改进贪心算法聚类
 */
function calculateIntelligentUnifiedSizes(
  nodes: FlowNode[],
  initialWidths: Record<string, number>,
  initialHeights: Record<string, number>
): {
  unifiedWidths: Map<string, number>;
  unifiedHeights: Map<string, number>;
} {
  // 按工艺类型分组
  const nodesByType: Record<ProcessType, FlowNode[]> = {
    [ProcessType.DISSOLUTION]: [],
    [ProcessType.COMPOUNDING]: [],
    [ProcessType.FILTRATION]: [],
    [ProcessType.TRANSFER]: [],
    [ProcessType.FLAVOR_ADDITION]: [],
    [ProcessType.OTHER]: []
  };
  
  nodes.forEach(node => {
    if (node.type === 'subStepNode' && node.data.subStep) {
      const type = node.data.subStep.processType;
      nodesByType[type].push(node);
    }
  });
  
  const unifiedWidths = new Map<string, number>();
  const unifiedHeights = new Map<string, number>();
  
  // 对每个类型组进行智能聚类
  Object.values(nodesByType).forEach((typeNodes) => {
    if (typeNodes.length === 0) return;
    
    // 收集该类型所有节点的宽度和高度
    const widthData = typeNodes.map(node => ({
      id: node.id,
      value: initialWidths[node.id]
    }));
    
    const heightData = typeNodes.map(node => ({
      id: node.id,
      value: initialHeights[node.id]
    }));
    
    // 改进贪心聚类宽度（阈值15%，启用单节点合并）
    const clusteredWidths = improvedClusterSimilarSizes(widthData, 0.15, 2);
    clusteredWidths.forEach((width, id) => unifiedWidths.set(id, width));
    
    // 改进贪心聚类高度（阈值20%，高度变化容忍度更高）
    const clusteredHeights = improvedClusterSimilarSizes(heightData, 0.20, 2);
    clusteredHeights.forEach((height, id) => unifiedHeights.set(id, height));
  });
  
  return { unifiedWidths, unifiedHeights };
}

/**
 * 压缩并行分支的水平间距
 * 识别同一层级内无直接连接关系的节点，应用更紧凑的间距
 */
function compressParallelBranches(
  nodes: FlowNode[],
  edges: RecipeEdge[],
  levels: Record<string, number>,
  nodePositions: Record<string, { x: number; y: number }>,
  calculatedNodeWidths: Record<string, number>,
  compressionRatio: number = 0.65 // 压缩到标准间距的65%
): void {
  // 按层级分组
  const levelGroups = groupByLevel(nodes, levels);
  
  // 为每个层级处理并行节点
  Object.values(levelGroups).forEach(levelNodes => {
    if (levelNodes.length <= 1) return; // 单个节点无需压缩
    
    // 按当前X坐标排序
    const sortedNodes = [...levelNodes].sort((a, b) => {
      const posA = nodePositions[a.id]?.x || 0;
      const posB = nodePositions[b.id]?.x || 0;
      return posA - posB;
    });
    
    // 检查每对相邻节点是否有直接连接
    for (let i = 0; i < sortedNodes.length - 1; i++) {
      const nodeA = sortedNodes[i];
      const nodeB = sortedNodes[i + 1];
      
      // 检查是否有直接连接（A->B 或 B->A）
      const hasDirectConnection = edges.some(
        e => (e.source === nodeA.id && e.target === nodeB.id) ||
             (e.source === nodeB.id && e.target === nodeA.id)
      );
      
      // 如果没有直接连接，则视为并行分支，可以压缩
      if (!hasDirectConnection) {
        const posA = nodePositions[nodeA.id];
        const posB = nodePositions[nodeB.id];
        if (!posA || !posB) continue;
        
        const widthA = calculatedNodeWidths[nodeA.id] || LAYOUT_CONFIG.baseNodeWidth;
        const widthB = calculatedNodeWidths[nodeB.id] || LAYOUT_CONFIG.baseNodeWidth;
        
        // 计算当前间距
        const currentSpacing = posB.x - posA.x - (widthA / 2) - (widthB / 2);
        
        // 计算目标间距（压缩后的间距）
        const minSpacing = Math.max(
          LAYOUT_CONFIG.minNodeSep * compressionRatio,
          (widthA + widthB) / 2 * 0.2 // 至少保持节点宽度的20%作为最小间距
        );
        
        // 如果当前间距大于目标间距，则压缩
        if (currentSpacing > minSpacing) {
          const targetSpacing = currentSpacing * compressionRatio;
          const deltaX = currentSpacing - targetSpacing;
          
          // 将右侧节点向左移动（压缩间距）
          // 同时移动该节点右侧的所有节点，保持相对位置
          for (let j = i + 1; j < sortedNodes.length; j++) {
            const rightNode = sortedNodes[j];
            if (nodePositions[rightNode.id]) {
              nodePositions[rightNode.id].x -= deltaX;
            }
          }
        }
      }
    }
  });
}

export function useAutoLayout() {
  const nodes = useFlowNodes(); // 使用动态生成的节点数组
  const edges = useFlowEdges(); // 使用动态生成的连线数组
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
    
    // ========== 步骤2: 计算每个节点的输入边 ==========
    const nodeIncomingEdges: Record<string, typeof edges> = {};
    edges.forEach(edge => {
      if (!nodeIncomingEdges[edge.target]) {
        nodeIncomingEdges[edge.target] = [];
      }
      nodeIncomingEdges[edge.target].push(edge);
    });

    // ========== 步骤3: 计算初始尺寸（使用分档策略和动态估算） ==========
    const initialWidths: Record<string, number> = {};
    const initialHeights: Record<string, number> = {};
    
    // 第一遍：计算宽度（基于输入数量）
    nodes.forEach(node => {
      const incoming = nodeIncomingEdges[node.id] || [];
      const inputCount = incoming.length;
      const width = calculateTieredWidth(inputCount);
      initialWidths[node.id] = width;
    });
    
    // 第二遍：基于宽度计算高度（考虑换行）
    nodes.forEach(node => {
      const width = initialWidths[node.id];
      const height = estimateNodeHeight(node, width);
      initialHeights[node.id] = height;
    });
    
    // ========== 步骤3.5: 智能统一尺寸（新增） ==========
    const { unifiedWidths, unifiedHeights } = calculateIntelligentUnifiedSizes(
      nodes,
      initialWidths,
      initialHeights
    );
    
    // ========== 步骤4: 应用统一尺寸 ==========
    const calculatedNodeWidths: Record<string, number> = {};
    const calculatedNodeHeights: Record<string, number> = {};
    
    nodes.forEach(node => {
      // 优先使用统一尺寸，否则使用初始尺寸
      calculatedNodeWidths[node.id] = unifiedWidths.get(node.id) || initialWidths[node.id];
      calculatedNodeHeights[node.id] = unifiedHeights.get(node.id) || initialHeights[node.id];
    });
    
    // ========== 步骤4: 使用dagre计算初始水平布局 ==========
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    
    // 计算动态节点间距（基于平均宽度，更紧凑）
    const nodeWidths = Object.values(calculatedNodeWidths);
    const avgNodeWidth = nodeWidths.reduce((a, b) => a + b, 0) / nodeWidths.length;
    // 使用平均宽度的40%作为间距（从0.8降至0.4，减少50%）
    const dynamicNodeSep = Math.max(LAYOUT_CONFIG.minNodeSep, avgNodeWidth * 0.4);
    
    dagreGraph.setGraph({ 
      rankdir: 'TB',
      nodesep: dynamicNodeSep,
      ranksep: LAYOUT_CONFIG.baseRankSep,
      marginx: 100,
      marginy: 50,
      // 移除 align: 'DL'，使用中心对齐
    });
    
    // 添加节点到 dagre graph
    nodes.forEach(node => {
      dagreGraph.setNode(node.id, { 
        width: calculatedNodeWidths[node.id], 
        height: calculatedNodeHeights[node.id] 
      });
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

    // ========== 步骤5: 按反向层级重新计算Y坐标 ==========
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
        const maxPrevHeight = Math.max(...prevLevelNodes.map(n => {
          const cachedHeight = calculatedNodeHeights[n.id];
          if (cachedHeight) return cachedHeight;
          // 如果缓存中没有，使用当前宽度重新估算
          const width = calculatedNodeWidths[n.id] || LAYOUT_CONFIG.baseNodeWidth;
          return estimateNodeHeight(n, width);
        }));
        
        // 层间距 = 上一层最大高度的一半（因为Y坐标是中心点）+ 下一层最大高度的一半 + 安全边距
        // 这确保了即使节点内容撑高，也不会遮挡下一层
        const currentLevelMaxHeight = Math.max(...levelNodes.map(n => {
          const cachedHeight = calculatedNodeHeights[n.id];
          if (cachedHeight) return cachedHeight;
          const width = calculatedNodeWidths[n.id] || LAYOUT_CONFIG.baseNodeWidth;
          return estimateNodeHeight(n, width);
        }));
        
        // 箭头长度 = 上一层底部到下一层顶部的距离
        const baseSpacing = (maxPrevHeight / 2) + (currentLevelMaxHeight / 2) + 60;
        
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

    // ========== 步骤5.5: 压缩并行分支间距 ==========
    // 在dagre布局后，压缩同一层级内无直接连接的并行节点间距
    compressParallelBranches(
      nodes,
      edges,
      reverseLevels,
      nodePositions,
      calculatedNodeWidths,
      0.65 // 压缩到标准间距的65%
    );

    // ========== 步骤6: 对汇聚节点应用加权居中与顺序修正 ==========
    
    // 1. 先进行投料顺序修正，确保 X 坐标物理顺序与 sequenceOrder 一致
    // 系统性解决交叉：整分支平移，确保上游分支随直接父节点一起移动
    reorderBranchesHorizontally(nodes, edges, nodePositions);

    if (LAYOUT_CONFIG.enableWeightedCentering) {
      // 2. 识别汇聚节点并应用加权居中
      const convergenceNodes = nodes.filter(node => {
        const incomingCount = nodeIncomingEdges[node.id]?.length || 0;
        if (incomingCount > 1) return true;
        // 检查是否是调配节点（子步骤类型为COMPOUNDING）
        if (node.type === 'subStepNode' && node.data.subStep) {
          return node.data.subStep.processType === ProcessType.COMPOUNDING;
        }
        return false;
      });
      
      convergenceNodes.forEach(node => {
        const newX = calculateConvergenceNodePosition(node, edges, nodes, nodePositions);
        nodePositions[node.id].x = newX;
        
        // 3. 系统性解决对齐：将中心位置向下游单线支路传播
        propagateChainCentering(node.id, newX, nodePositions, edges, nodes);
      });
    }

    // 注意：targetHandle 的分配已在 useFlowEdges 中完成，按 sequenceOrder 排序
    // 这里不再需要重复分配

    // 计算最终位置（考虑节点宽度和高度，以节点中心为基准）
    const finalPositions: Record<string, { x: number; y: number }> = {};
    nodes.forEach((node) => {
      const pos = nodePositions[node.id];
      if (!pos) return;
      
      const width = calculatedNodeWidths[node.id] || LAYOUT_CONFIG.baseNodeWidth;
      const height = calculatedNodeHeights[node.id] || estimateNodeHeight(node, width);
      
      // 保存位置（以节点左上角为基准，ReactFlow 使用左上角坐标）
      finalPositions[node.id] = {
        x: pos.x - width / 2,
        y: pos.y - height / 2,
      };
    });

    // 保存位置到 Store，供 useFlowNodes 使用
    useRecipeStore.getState().setNodePositions(finalPositions);
  }, [nodes, edges]);
}
