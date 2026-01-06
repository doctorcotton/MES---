import { useEffect, useRef } from 'react';
import dagre from 'dagre';
import { FlowNode, RecipeEdge, ProcessType } from '../types/recipe';
import { useRecipeStore, useFlowNodes, useFlowEdges } from '../store/useRecipeStore';
import { identifyProcessSegments } from './segmentIdentifier';
import {
  layoutParallelSegments,
  calculateConvergenceY,
  layoutSerialSegments,
  validateSegmentLayout,
} from './segmentLayoutCalculator';

// 布局配置参数
const USE_SEGMENT_LAYOUT = true; // 使用新的工艺段布局算法，设为false可回退到旧算法

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
  // 工艺段布局参数
  targetEdgeLength: 120,              // 目标连线长度（固定值）
  convergenceStrategy: 'max' as 'max' | 'weighted' | 'median',  // 汇聚点处理策略
  // 保留targetEdgeGap用于向后兼容
  targetEdgeGap: 120,     // 节点边缘之间的目标最小距离（连线最短长度，已废弃，使用targetEdgeLength）
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
 * 使用 Canvas API 精确测量文字换行
 * 考虑实际字体样式，支持中英文混排
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  if (!text) return [];
  
  const lines: string[] = [];
  let currentLine = '';
  
  // 按字符遍历（支持中文、英文、数字）
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const testLine = currentLine + char;
    const metrics = ctx.measureText(testLine);
    
    if (metrics.width > maxWidth && currentLine.length > 0) {
      // 当前行已满，开始新行
      lines.push(currentLine);
      currentLine = char;
    } else {
      currentLine = testLine;
    }
  }
  
  // 添加最后一行
  if (currentLine) {
    lines.push(currentLine);
  }
  
  return lines.length > 0 ? lines : [''];
}

/**
 * 使用 Canvas API 精确测量文本高度
 * 返回文本在给定宽度下需要的行数和总高度
 */
function measureTextHeight(
  text: string,
  availableWidth: number,
  fontSize: number = 12,
  fontFamily: string = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  lineHeight: number = 20
): { lineCount: number; totalHeight: number } {
  if (!text || availableWidth <= 0) {
    return { lineCount: 0, totalHeight: 0 };
  }
  
  const isDebug = typeof window !== 'undefined' && localStorage.getItem('debug_layout') === 'true';
  
  // 创建离屏 Canvas 进行测量
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    // Canvas 不可用时，回退到简单估算
    const { charWidth } = LAYOUT_CONFIG;
    const estimatedCharsPerLine = Math.floor(availableWidth / charWidth);
    const lineCount = estimatedCharsPerLine > 0 
      ? Math.max(1, Math.ceil(text.length / estimatedCharsPerLine))
      : 1;
    const result = { lineCount, totalHeight: lineCount * lineHeight };
    
    if (isDebug) {
      console.log('[Debug] measureTextHeight (fallback):', {
        text: text.substring(0, 30) + (text.length > 30 ? '...' : ''),
        availableWidth,
        estimatedCharsPerLine,
        lineCount,
        totalHeight: result.totalHeight,
      });
    }
    
    return result;
  }
  
  // 设置字体样式（与实际渲染保持一致）
  ctx.font = `${fontSize}px ${fontFamily}`;
  
  // 计算换行
  const lines = wrapText(ctx, text, availableWidth);
  const lineCount = lines.length;
  const result = {
    lineCount,
    totalHeight: lineCount * lineHeight
  };
  
  if (isDebug) {
    console.log('[Debug] measureTextHeight:', {
      text: text.substring(0, 30) + (text.length > 30 ? '...' : ''),
      availableWidth,
      fontSize,
      lineCount,
      totalHeight: result.totalHeight,
      lines: lines.map(l => l.substring(0, 20) + (l.length > 20 ? '...' : '')),
    });
  }
  
  return result;
}

/**
 * 估算文本内容在给定宽度下的行数（考虑换行）
 * 使用 Canvas API 精确测量，回退到简单估算
 */
function estimateTextLines(text: string, availableWidth: number): number {
  if (!text || availableWidth <= 0) return 0;
  
  const result = measureTextHeight(text, availableWidth);
  return result.lineCount;
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
    let contentHeight = 0; // 使用精确高度而非行数

    const isDebug = typeof window !== 'undefined' && localStorage.getItem('debug_layout') === 'true';
    
    if (isDebug) {
      console.group(`[Debug] 节点高度计算: ${node.id}`);
      console.log('节点类型:', node.type);
      console.log('节点宽度:', nodeWidth);
    }

    // 使用 Canvas API 精确测量位置和原料的文本高度
    const availableWidth = nodeWidth - (contentPadding * 2);
    const fontSize = 12; // 与实际渲染字体大小一致
    
    if (subStep.deviceCode) {
      const deviceText = `位置: ${subStep.deviceCode}`;
      const measurement = measureTextHeight(deviceText, availableWidth, fontSize);
      contentHeight += measurement.totalHeight;
      if (isDebug) {
        console.log('位置文本:', deviceText, '→', measurement.lineCount, '行', measurement.totalHeight, 'px');
      }
    }
    if (subStep.ingredients) {
      const ingredientsText = `原料: ${subStep.ingredients}`;
      const measurement = measureTextHeight(ingredientsText, availableWidth, fontSize);
      contentHeight += measurement.totalHeight;
      if (isDebug) {
        console.log('原料文本:', ingredientsText, '→', measurement.lineCount, '行', measurement.totalHeight, 'px');
      }
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

    // 总高度 = 标题 + 内容高度 + 参数行高度 + 内边距
    // 确保至少有最小内容高度（2行）
    const minContentHeight = 2 * lineHeight;
    const actualContentHeight = Math.max(contentHeight, minContentHeight);
    const paramHeight = paramLines * lineHeight;
    
    const finalHeight = headerHeight + actualContentHeight + paramHeight + padding;
    
    if (isDebug) {
      console.log('参数行数:', paramLines);
      console.log('内容高度:', contentHeight, 'px (最小', minContentHeight, 'px)');
      console.log('参数高度:', paramHeight, 'px');
      console.log('标题高度:', headerHeight, 'px');
      console.log('内边距:', padding, 'px');
      console.log('最终高度:', finalHeight, 'px');
      console.groupEnd();
    }
    
    return finalHeight;
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
 * 根据投料顺序 (sequenceOrder) 和 工艺逻辑顺序 整分支平移
 * 系统性解决方案：不仅移动直接父节点，而是移动整个上游分支
 */
function reorderBranchesHorizontally(
  nodes: FlowNode[],
  edges: RecipeEdge[],
  nodePositions: Record<string, { x: number; y: number }>,
  processIndexMap: Record<string, number>
) {
  // 找到所有汇聚节点
  nodes.forEach(targetNode => {
    const incomingEdges = edges.filter(e => e.target === targetNode.id);
    if (incomingEdges.length <= 1) return;

    // 按 sequenceOrder 优先，Process Index 次之 排序
    const sortedEdges = [...incomingEdges].sort((a, b) => {
      const seqDiff = (a.data?.sequenceOrder || 0) - (b.data?.sequenceOrder || 0);
      if (seqDiff !== 0) return seqDiff;

      // 如果 sequenceOrder 相同，使用 Process Index
      // 需要找到源节点对应的 Process ID
      const sourceNodeA = nodes.find(n => n.id === a.source);
      const sourceNodeB = nodes.find(n => n.id === b.source);

      const pIdxA = processIndexMap[sourceNodeA?.data.processId || ''] ?? 9999;
      const pIdxB = processIndexMap[sourceNodeB?.data.processId || ''] ?? 9999;

      return pIdxA - pIdxB;
    });

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
 * 递归平移分支（向下游传播 deltaX）
 * 仅对单父节点的子节点生效，保持子树形状
 */
function shiftBranch(
  nodeId: string,
  deltaX: number,
  nodes: FlowNode[],
  edges: RecipeEdge[],
  nodePositions: Record<string, { x: number; y: number }>
) {
  if (Math.abs(deltaX) < 1) return;

  // 移动当前节点
  if (nodePositions[nodeId]) {
    nodePositions[nodeId].x += deltaX;
  }

  // 查找所有子节点
  const children = edges
    .filter(e => e.source === nodeId)
    .map(e => e.target);

  children.forEach(childId => {
    // 检查子节点是否只有这一个父节点（独占分支）
    const incoming = edges.filter(e => e.target === childId);
    if (incoming.length === 1) {
      shiftBranch(childId, deltaX, nodes, edges, nodePositions);
    }
  });
}

/**
 * 根节点（起始节点）重排序
 * 确保流程起点的水平顺序符合表格中的逻辑顺序
 */
function reorderRootNodes(
  nodes: FlowNode[],
  edges: RecipeEdge[],
  nodePositions: Record<string, { x: number; y: number }>,
  processIndexMap: Record<string, number>
) {
  // 1. 找到所有根节点（入度为0的节点）
  const rootNodes = nodes.filter(node =>
    !edges.some(e => e.target === node.id)
  );

  if (rootNodes.length <= 1) return;

  // 2. 按 Process Index 排序
  const sortedRoots = [...rootNodes].sort((a, b) => {
    const pIdxA = processIndexMap[a.data.processId || ''] ?? 9999;
    const pIdxB = processIndexMap[b.data.processId || ''] ?? 9999;

    // 如果是同一个 Process 的不同子步骤（理论上根节点通常是Process的主节点或第一个子节点）
    // 使用 displayOrder 辅助排序
    if (pIdxA === pIdxB) {
      return (a.data.displayOrder || 0) - (b.data.displayOrder || 0);
    }
    return pIdxA - pIdxB;
  });

  // 3. 获取物理位置槽
  const currentXs = rootNodes
    .map(n => ({ id: n.id, x: nodePositions[n.id]?.x || 0 }))
    .sort((a, b) => a.x - b.x);

  // 4. 应用位置并移动分支
  sortedRoots.forEach((node, index) => {
    const currentPos = nodePositions[node.id];
    if (!currentPos) return;

    // 目标 X 是物理上第 index 小的 X
    if (index < currentXs.length) {
      const targetX = currentXs[index].x;
      const deltaX = targetX - currentPos.x;

      if (Math.abs(deltaX) > 1) {
        // 使用递归平移，保持子树形状
        shiftBranch(node.id, deltaX, nodes, edges, nodePositions);
      }
    }
  });
}


// 已删除：calculateTargetMinEdgeLength, analyzeEdgeLengths, optimizeEdgeLengths, calculateReverseLevel
// 这些函数已被新的工艺段布局算法替代

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
  const processes = useRecipeStore((state) => state.processes); // 获取 processes 数组用于顺序检测
  const prevNodesRef = useRef<string>('');
  const prevEdgesRef = useRef<string>('');
  const prevProcessOrderRef = useRef<string>('');

  useEffect(() => {
    if (nodes.length === 0) return;

    // 检查是否所有节点都是临时 position（从服务器同步时可能只有 {x: 0, y: 0}）
    const allNodesHaveTempPosition = nodes.every(
      node => node.position?.x === 0 && node.position?.y === 0
    );

    // 创建节点和边的签名用于比较
    // 确保包含 displayOrder 字段，以便检测顺序变化
    const nodesSignature = JSON.stringify(nodes.map(n => ({
      id: n.id,
      data: {
        ...n.data,
        displayOrder: n.data.displayOrder // 明确包含 displayOrder
      }
    })));
    const edgesSignature = JSON.stringify(edges.map(e => ({ source: e.source, target: e.target, data: e.data })));
    // 添加 processes 顺序签名，确保顺序变化时触发重新布局
    const processOrderSignature = processes.map(p => p.id).join(',');

    // 如果节点或边的数据没有变化，且 processes 顺序没有变化，且不是所有节点都是临时 position，跳过布局计算
    if (prevNodesRef.current === nodesSignature &&
      prevEdgesRef.current === edgesSignature &&
      prevProcessOrderRef.current === processOrderSignature &&
      !allNodesHaveTempPosition) {
      console.log('[Layout] 跳过布局计算（缓存命中）');
      return;
    }

    console.log('[Layout] 开始重新计算布局', {
      nodesChanged: prevNodesRef.current !== nodesSignature,
      edgesChanged: prevEdgesRef.current !== edgesSignature,
      processOrderChanged: prevProcessOrderRef.current !== processOrderSignature,
      allNodesHaveTempPosition
    });

    prevNodesRef.current = nodesSignature;
    prevEdgesRef.current = edgesSignature;
    prevProcessOrderRef.current = processOrderSignature;

    // ========== 步骤1: 识别工艺段 ==========
    const { parallelSegments, convergenceNode, serialSegments } = 
      identifyProcessSegments(nodes, edges);

    console.log('[Layout] 工艺段识别:', {
      parallelCount: parallelSegments.length,
      convergenceNodeId: convergenceNode?.id,
      serialCount: serialSegments.length,
      parallelSegments: parallelSegments.map(s => ({
        id: s.id,
        nodeCount: s.nodes.length,
        startNode: s.startNodeId.substring(0, 20),
        endNode: s.endNodeId.substring(0, 20),
      })),
    });

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

    // ========== 步骤5: 基于 displayOrder 计算 X 坐标，使用工艺段布局计算 Y 坐标 ==========
    // 核心改进：X 坐标直接由 displayOrder（表格顺序）决定，而非 dagre
    // Y 坐标使用新的工艺段分段布局算法

    // 5.1: 计算每个 Process 的水平区域（基于 displayOrder）
    const PROCESS_LANE_WIDTH = 300; // 每个工艺段的水平"车道"宽度
    const LANE_GAP = 64; // 车道之间的间隙（原80，缩小20%）
    const START_X = 150; // 起始 X 偏移

    // 构建 processId -> displayOrder 映射
    const processDisplayOrder: Record<string, number> = {};
    nodes.forEach(node => {
      if (node.data.processId && node.data.displayOrder !== undefined) {
        // 每个 processId 只记录一次（使用最小的 displayOrder）
        if (processDisplayOrder[node.data.processId] === undefined) {
          processDisplayOrder[node.data.processId] = node.data.displayOrder;
        }
      }
    });

    // 5.2: 为每个节点计算 X 坐标（基于其所属 Process 的 displayOrder）
    // 同一 Process 的所有节点共享同一 X 坐标区域
    const nodePositions: Record<string, { x: number; y: number }> = {};

    // 根据 displayOrder 分组节点
    const nodesByDisplayOrder: Record<number, FlowNode[]> = {};
    nodes.forEach(node => {
      const displayOrder = node.data.displayOrder || 1;
      if (!nodesByDisplayOrder[displayOrder]) {
        nodesByDisplayOrder[displayOrder] = [];
      }
      nodesByDisplayOrder[displayOrder].push(node);
    });

    // 为每个 displayOrder 组分配 X 坐标
    const displayOrders = Object.keys(nodesByDisplayOrder).map(Number).sort((a, b) => a - b);
    displayOrders.forEach((displayOrder, laneIndex) => {
      const laneX = START_X + laneIndex * (PROCESS_LANE_WIDTH + LANE_GAP);
      nodesByDisplayOrder[displayOrder].forEach(node => {
        // 初始化 X 坐标，Y 坐标稍后计算
        nodePositions[node.id] = { x: laneX, y: 0 };
      });
    });

    // 5.3: 计算 Y 坐标（使用工艺段分段布局算法）
    const INITIAL_Y = 80;

    // 步骤2: 布局并行工艺段（每段内部独立均匀间距）
    const parallelYPositions = layoutParallelSegments(
      parallelSegments,
      calculatedNodeHeights,
      {
        targetEdgeLength: LAYOUT_CONFIG.targetEdgeLength,
        initialY: INITIAL_Y
      }
    );

    // 步骤3: 计算汇聚点Y坐标
    let convergenceY = INITIAL_Y;
    if (convergenceNode) {
      convergenceY = calculateConvergenceY(
        parallelSegments,
        parallelYPositions,
        calculatedNodeHeights,
        LAYOUT_CONFIG.targetEdgeLength,
        LAYOUT_CONFIG.convergenceStrategy
      );
      
      // 设置汇聚点的Y坐标
      if (nodePositions[convergenceNode.id]) {
        nodePositions[convergenceNode.id].y = convergenceY;
      }
    }

    // 步骤4: 布局串行工艺段（统一间距）
    const serialYPositions = layoutSerialSegments(
      serialSegments,
      convergenceY + (convergenceNode ? calculatedNodeHeights[convergenceNode.id] || 120 : 0),
      calculatedNodeHeights,
      {
        targetEdgeLength: LAYOUT_CONFIG.targetEdgeLength
      }
    );

    // 步骤5: 合并Y坐标到nodePositions（只更新Y坐标，保留X坐标）
    Object.keys(parallelYPositions).forEach(nodeId => {
      if (nodePositions[nodeId]) {
        nodePositions[nodeId].y = parallelYPositions[nodeId];
      } else {
        // 如果节点还没有位置，创建一个新对象（X坐标稍后会被设置）
        nodePositions[nodeId] = { x: 0, y: parallelYPositions[nodeId] };
      }
    });
    
    Object.keys(serialYPositions).forEach(nodeId => {
      if (nodePositions[nodeId]) {
        nodePositions[nodeId].y = serialYPositions[nodeId];
      } else {
        // 如果节点还没有位置，创建一个新对象（X坐标稍后会被设置）
        nodePositions[nodeId] = { x: 0, y: serialYPositions[nodeId] };
      }
    });

    // 步骤6: 验证布局结果
    const validationResult = validateSegmentLayout(
      parallelSegments,
      serialSegments,
      nodePositions,
      calculatedNodeHeights,
      LAYOUT_CONFIG.targetEdgeLength
    );

    console.log('[Layout] 布局验证:', {
      parallelSegments: validationResult.parallelSegmentStats.map(stat => ({
        segmentId: stat.segmentId,
        avgEdgeLength: stat.avgEdgeLength.toFixed(1),
        stdDeviation: stat.stdDeviation.toFixed(1),
        minEdgeLength: stat.minEdgeLength.toFixed(1),
        maxEdgeLength: stat.maxEdgeLength.toFixed(1),
      })),
      serialSegment: {
        avgEdgeLength: validationResult.serialSegmentStats.avgEdgeLength.toFixed(1),
        stdDeviation: validationResult.serialSegmentStats.stdDeviation.toFixed(1),
      },
      overall: {
        totalParallelEdges: validationResult.overallStats.totalParallelEdges,
        totalSerialEdges: validationResult.overallStats.totalSerialEdges,
        avgParallelEdgeLength: validationResult.overallStats.avgParallelEdgeLength.toFixed(1),
        avgSerialEdgeLength: validationResult.overallStats.avgSerialEdgeLength.toFixed(1),
      },
    });

    // ========== 步骤6: 汇聚点水平居中 ==========
    // 对于有多个输入的汇聚节点，将其 X 坐标调整为输入节点的加权中心
    if (LAYOUT_CONFIG.enableWeightedCentering) {
      const convergenceNodes = nodes.filter(node => {
        const incomingCount = nodeIncomingEdges[node.id]?.length || 0;
        if (incomingCount > 1) return true;
        if (node.type === 'subStepNode' && node.data.subStep) {
          return node.data.subStep.processType === ProcessType.COMPOUNDING;
        }
        return false;
      });

      convergenceNodes.forEach(node => {
        const newX = calculateConvergenceNodePosition(node, edges, nodes, nodePositions);
        nodePositions[node.id].x = newX;

        // 将中心位置向下游单线支路传播
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
    
    // 保存节点高度和宽度到 Store，供调试组件使用
    useRecipeStore.getState().setNodeHeights(calculatedNodeHeights);
    useRecipeStore.getState().setNodeWidths(calculatedNodeWidths);
    
    // 保存布局验证结果到 Store，供调试面板使用
    useRecipeStore.getState().setLayoutValidation(validationResult);
  }, [nodes, edges, processes]); // 添加 processes 作为依赖，确保顺序变化时重新布局
}
