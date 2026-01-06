import { FlowNode } from '../types/recipe';
import { ProcessSegment } from './segmentIdentifier';

/**
 * 并行工艺段布局配置
 */
export interface ParallelLayoutConfig {
  targetEdgeLength: number;  // 目标连线长度（固定值）
  initialY: number;          // 初始Y坐标
}

/**
 * 串行工艺段布局配置
 */
export interface SerialLayoutConfig {
  targetEdgeLength: number;  // 目标连线长度（固定值）
}

/**
 * 布局并行工艺段
 * 
 * 核心逻辑：
 * - 所有并行段起点Y坐标相同（视觉上对齐）
 * - 每个段内部连线长度固定（targetEdgeLength）
 * - 段之间终点Y坐标不同（因为子步骤数量不同）
 */
export function layoutParallelSegments(
  segments: ProcessSegment[],
  nodeHeights: Record<string, number>,
  config: ParallelLayoutConfig
): Record<string, number> {
  const nodeYPositions: Record<string, number> = {};
  
  const isDebug = typeof window !== 'undefined' && localStorage.getItem('debug_layout') === 'true';

  segments.forEach((segment, segmentIndex) => {
    if (isDebug) {
      console.group(`[Debug] 工艺段间距计算: segment-${segmentIndex} (${segment.nodes.length}个节点)`);
    }
    
    let currentY = config.initialY;

    segment.nodes.forEach((node, idx) => {
      nodeYPositions[node.id] = currentY;

      if (idx < segment.nodes.length - 1) {
        const nextNode = segment.nodes[idx + 1];
        const currentNodeHeight = nodeHeights[node.id] || 120;
        const nextNodeHeight = nodeHeights[nextNode.id] || 120;

        // 计算间距：节点高度的一半 + 目标连线长度 + 下个节点高度的一半
        const spacing =
          currentNodeHeight / 2 +      // 当前节点底部到中心
          config.targetEdgeLength +    // 连线长度（固定）
          nextNodeHeight / 2;          // 下个节点中心到顶部

        if (isDebug) {
          console.log(`${node.id} → ${nextNode.id}:`);
          console.log('  当前节点中心Y:', currentY.toFixed(1), 'px');
          console.log('  当前节点高度:', currentNodeHeight, 'px');
          console.log('  目标间距:', config.targetEdgeLength, 'px');
          console.log('  下个节点高度:', nextNodeHeight, 'px');
          console.log('  计算: H₁/2 + gap + H₂/2 =', 
            `${currentNodeHeight / 2} + ${config.targetEdgeLength} + ${nextNodeHeight / 2} = ${spacing.toFixed(1)}`);
          console.log('  下个节点中心Y:', (currentY + spacing).toFixed(1), 'px');
          
          // 验证实际间距
          const sourceBottom = currentY + currentNodeHeight / 2;
          const targetTop = (currentY + spacing) - nextNodeHeight / 2;
          const actualGap = targetTop - sourceBottom;
          const gapError = Math.abs(actualGap - config.targetEdgeLength);
          console.log('  验证: 源底', sourceBottom.toFixed(1), '→ 目标顶', targetTop.toFixed(1), 
            '= 实际间距', actualGap.toFixed(1), 'px (误差', gapError.toFixed(1), 'px)');
        }

        currentY += spacing;
      } else {
        if (isDebug) {
          console.log(`${node.id}: 段最后一个节点，中心Y = ${currentY.toFixed(1)}px`);
        }
      }
    });
    
    if (isDebug) {
      console.groupEnd();
    }
  });

  return nodeYPositions;
}

/**
 * 汇聚点处理策略
 */
export type ConvergenceStrategy = 'max' | 'weighted' | 'median';

/**
 * 计算汇聚点Y坐标
 * 
 * 策略：
 * - max: 取最大值（推荐）- 所有入边都向下，符合视觉习惯
 * - weighted: 加权平均 - 根据工艺段长度加权
 * - median: 中位数 - 取所有分支终点的中位数
 */
export function calculateConvergenceY(
  parallelSegments: ProcessSegment[],
  nodeYPositions: Record<string, number>,
  nodeHeights: Record<string, number>,
  targetEdgeLength: number,
  strategy: ConvergenceStrategy = 'max'
): number {
  if (parallelSegments.length === 0) {
    return 80; // 默认值
  }

  // 计算每个并行段的终点Y坐标（段最后一个节点的底部 + 连线长度）
  const endYs = parallelSegments.map(seg => {
    const lastNode = seg.nodes[seg.nodes.length - 1];
    const lastNodeY = nodeYPositions[lastNode.id];
    const lastNodeHeight = nodeHeights[lastNode.id] || 120;
    
    // 终点Y = 节点中心Y + 节点高度的一半 + 连线长度
    return lastNodeY + lastNodeHeight / 2 + targetEdgeLength;
  });

  switch (strategy) {
    case 'max':
      return Math.max(...endYs);

    case 'weighted': {
      // 根据工艺段长度加权
      const totalSteps = parallelSegments.reduce((sum, seg) => sum + seg.nodes.length, 0);
      if (totalSteps === 0) return Math.max(...endYs);

      let weightedSum = 0;
      parallelSegments.forEach((seg, idx) => {
        const weight = seg.nodes.length / totalSteps;
        weightedSum += endYs[idx] * weight;
      });

      return weightedSum;
    }

    case 'median': {
      // 取中位数
      const sorted = [...endYs].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
    }

    default:
      return Math.max(...endYs);
  }
}

/**
 * 布局串行工艺段
 * 
 * 逻辑：
 * - 从汇聚点开始，垂直向下排列
 * - 所有连线长度统一（targetEdgeLength）
 */
export function layoutSerialSegments(
  segments: ProcessSegment[],
  startY: number,
  nodeHeights: Record<string, number>,
  config: SerialLayoutConfig
): Record<string, number> {
  const nodeYPositions: Record<string, number> = {};
  let currentY = startY;

  segments.forEach(segment => {
    segment.nodes.forEach((node, idx) => {
      // 如果节点已经有Y坐标（可能是汇聚点），跳过
      if (nodeYPositions[node.id] !== undefined) {
        currentY = nodeYPositions[node.id];
        return;
      }

      nodeYPositions[node.id] = currentY;

      if (idx < segment.nodes.length - 1) {
        const nextNode = segment.nodes[idx + 1];
        const currentNodeHeight = nodeHeights[node.id] || 120;
        const nextNodeHeight = nodeHeights[nextNode.id] || 120;

        // 计算间距：节点高度的一半 + 目标连线长度 + 下个节点高度的一半
        const spacing =
          currentNodeHeight / 2 +
          config.targetEdgeLength +
          nextNodeHeight / 2;

        currentY += spacing;
      }
    });
  });

  return nodeYPositions;
}

/**
 * 验证布局结果的统计信息
 */
export interface SegmentLayoutValidation {
  parallelSegmentStats: Array<{
    segmentId: string;
    avgEdgeLength: number;
    stdDeviation: number;
    allEdgeLengths: number[];
    minEdgeLength: number;
    maxEdgeLength: number;
  }>;
  serialSegmentStats: {
    avgEdgeLength: number;
    stdDeviation: number;
    allEdgeLengths: number[];
    minEdgeLength: number;
    maxEdgeLength: number;
  };
  overallStats: {
    totalParallelEdges: number;
    totalSerialEdges: number;
    avgParallelEdgeLength: number;
    avgSerialEdgeLength: number;
  };
}

/**
 * 验证工艺段布局结果
 * 
 * 计算每个工艺段内部的连线长度统计信息，验证是否均匀
 */
export function validateSegmentLayout(
  parallelSegments: ProcessSegment[],
  serialSegments: ProcessSegment[],
  nodePositions: Record<string, { x: number; y: number }>,
  nodeHeights: Record<string, number>,
  targetEdgeLength: number
): SegmentLayoutValidation {
  // 计算标准差的辅助函数
  function calculateStdDev(values: number[]): number {
    if (values.length === 0) return 0;
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  // 计算一条边的实际长度
  function calculateEdgeLength(
    sourceNodeId: string,
    targetNodeId: string
  ): number {
    const sourcePos = nodePositions[sourceNodeId];
    const targetPos = nodePositions[targetNodeId];
    if (!sourcePos || !targetPos) return 0;

    const sourceHeight = nodeHeights[sourceNodeId] || 120;
    const targetHeight = nodeHeights[targetNodeId] || 120;

    // 连线长度 = 目标节点顶部Y - 源节点底部Y
    const sourceBottom = sourcePos.y + sourceHeight / 2;
    const targetTop = targetPos.y - targetHeight / 2;
    return targetTop - sourceBottom;
  }

  // 验证并行工艺段
  const parallelSegmentStats = parallelSegments.map(segment => {
    const edgeLengths: number[] = [];

    for (let i = 0; i < segment.nodes.length - 1; i++) {
      const sourceNode = segment.nodes[i];
      const targetNode = segment.nodes[i + 1];
      const length = calculateEdgeLength(sourceNode.id, targetNode.id);
      edgeLengths.push(length);
    }

    const avgEdgeLength = edgeLengths.length > 0
      ? edgeLengths.reduce((a, b) => a + b, 0) / edgeLengths.length
      : 0;
    const stdDeviation = calculateStdDev(edgeLengths);
    const minEdgeLength = edgeLengths.length > 0 ? Math.min(...edgeLengths) : 0;
    const maxEdgeLength = edgeLengths.length > 0 ? Math.max(...edgeLengths) : 0;

    return {
      segmentId: segment.id,
      avgEdgeLength,
      stdDeviation,
      allEdgeLengths: edgeLengths,
      minEdgeLength,
      maxEdgeLength,
    };
  });

  // 验证串行工艺段
  const allSerialEdgeLengths: number[] = [];
  serialSegments.forEach(segment => {
    for (let i = 0; i < segment.nodes.length - 1; i++) {
      const sourceNode = segment.nodes[i];
      const targetNode = segment.nodes[i + 1];
      const length = calculateEdgeLength(sourceNode.id, targetNode.id);
      allSerialEdgeLengths.push(length);
    }
  });

  const serialAvgEdgeLength = allSerialEdgeLengths.length > 0
    ? allSerialEdgeLengths.reduce((a, b) => a + b, 0) / allSerialEdgeLengths.length
    : 0;
  const serialStdDeviation = calculateStdDev(allSerialEdgeLengths);
  const serialMinEdgeLength = allSerialEdgeLengths.length > 0 ? Math.min(...allSerialEdgeLengths) : 0;
  const serialMaxEdgeLength = allSerialEdgeLengths.length > 0 ? Math.max(...allSerialEdgeLengths) : 0;

  // 计算总体统计
  const allParallelEdgeLengths = parallelSegmentStats.flatMap(stat => stat.allEdgeLengths);
  const totalParallelEdges = allParallelEdgeLengths.length;
  const totalSerialEdges = allSerialEdgeLengths.length;
  const avgParallelEdgeLength = totalParallelEdges > 0
    ? allParallelEdgeLengths.reduce((a, b) => a + b, 0) / totalParallelEdges
    : 0;
  const avgSerialEdgeLength = serialAvgEdgeLength;

  return {
    parallelSegmentStats,
    serialSegmentStats: {
      avgEdgeLength: serialAvgEdgeLength,
      stdDeviation: serialStdDeviation,
      allEdgeLengths: allSerialEdgeLengths,
      minEdgeLength: serialMinEdgeLength,
      maxEdgeLength: serialMaxEdgeLength,
    },
    overallStats: {
      totalParallelEdges,
      totalSerialEdges,
      avgParallelEdgeLength,
      avgSerialEdgeLength,
    },
  };
}

