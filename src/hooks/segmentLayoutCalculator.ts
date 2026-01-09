import { ProcessType, ProcessTypes } from '../types/recipe';
import { ProcessSegment } from './segmentIdentifier';

/**
 * 并行工艺段布局配置
 */
export interface ParallelLayoutConfig {
  targetEdgeLength: number;  // 目标连线长度（固定值，用于非萃取段）
  initialY: number;          // 初始Y坐标
}

/**
 * 获取工艺段的类型（基于第一步的工艺类型）
 */
function getSegmentType(segment: ProcessSegment): ProcessType | 'unknown' {
  if (segment.nodes.length === 0) return 'unknown';
  
  const firstNode = segment.nodes[0];
  
  // 展开模式：从 subStep 获取
  if (firstNode.data.subStep) {
    return firstNode.data.subStep.processType;
  }
  
  // 折叠模式：从 firstProcessType 获取
  if (firstNode.data.firstProcessType) {
    return firstNode.data.firstProcessType;
  }
  
  return 'unknown';
}

/**
 * 计算萃取段的自适应边距长度
 * 
 * 公式: edgeLen(n) = clamp(base * s * sqrt(3 / max(n, 3)), minEdge, base)
 * 
 * @param nodeCount 段内节点数量
 * @param base 基础边距（默认 120）
 * @param scale 缩放因子（默认 0.96，让 n=4 时约等于 100）
 * @param minEdge 最小边距（默认 70，防止太挤）
 * @returns 计算后的边距长度
 */
function calculateExtractionEdgeLength(
  nodeCount: number,
  base: number = 120,
  scale: number = 0.96,
  minEdge: number = 70
): number {
  if (nodeCount <= 3) {
    return base; // n≤3 时保持基础值
  }
  
  const ratio = Math.sqrt(3 / Math.max(nodeCount, 3));
  const calculated = base * scale * ratio;
  
  // 夹紧到 [minEdge, base] 范围
  return Math.max(minEdge, Math.min(calculated, base));
}

/**
 * 计算段的相对布局（假设 startY=0）
 * 
 * @returns { relativePositions: Record<string, number>, lastNodeBottom: number }
 */
function calculateRelativeLayout(
  segment: ProcessSegment,
  nodeHeights: Record<string, number>,
  edgeLength: number
): { relativePositions: Record<string, number>; lastNodeBottom: number } {
  const relativePositions: Record<string, number> = {};
  let currentY = 0;
  
  segment.nodes.forEach((node, idx) => {
    relativePositions[node.id] = currentY;
    
    if (idx < segment.nodes.length - 1) {
      const nextNode = segment.nodes[idx + 1];
      const currentNodeHeight = nodeHeights[node.id] || 120;
      const nextNodeHeight = nodeHeights[nextNode.id] || 120;
      
      const spacing =
        currentNodeHeight / 2 +
        edgeLength +
        nextNodeHeight / 2;
      
      currentY += spacing;
    }
  });
  
  // 计算最后一个节点的底部位置（相对坐标）
  const lastNode = segment.nodes[segment.nodes.length - 1];
  const lastNodeHeight = nodeHeights[lastNode.id] || 120;
  const lastNodeBottom = relativePositions[lastNode.id] + lastNodeHeight / 2;
  
  return { relativePositions, lastNodeBottom };
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
 * - 按"第一步工艺类型"分组（萃取类/溶解类/香精类等）
 * - 组内头部对齐：同类型段的起点Y坐标相同
 * - 组间Y偏移：短类型整体下移，让各组末端更接近，尾线长度接近常量（≈120px）
 * - 萃取类自适应压缩：子步骤越多，段内间距越小（平滑公式+上下限夹紧）
 */
export function layoutParallelSegments(
  segments: ProcessSegment[],
  nodeHeights: Record<string, number>,
  config: ParallelLayoutConfig
): Record<string, number> {
  const nodeYPositions: Record<string, number> = {};
  const isDebug = typeof window !== 'undefined' && localStorage.getItem('debug_layout') === 'true';

  if (isDebug) {
    console.group('[Debug] 并行工艺段布局：按类型分组对齐');
  }

  // 步骤1: 按类型分组
  const segmentsByType = new Map<ProcessType | 'unknown', ProcessSegment[]>();
  segments.forEach(segment => {
    const segmentType = getSegmentType(segment);
    if (!segmentsByType.has(segmentType)) {
      segmentsByType.set(segmentType, []);
    }
    segmentsByType.get(segmentType)!.push(segment);
  });

  if (isDebug) {
    console.log('工艺段分组:', Array.from(segmentsByType.entries()).map(([type, segs]) => 
      `${type}: ${segs.length}个段`
    ));
  }

  // 步骤2: 计算每个段的相对布局和边距
  interface SegmentLayoutInfo {
    segment: ProcessSegment;
    segmentType: ProcessType | 'unknown';
    edgeLength: number;
    relativePositions: Record<string, number>;
    lastNodeBottom: number;
  }

  const segmentLayouts: SegmentLayoutInfo[] = [];
  
  segments.forEach(segment => {
    const segmentType = getSegmentType(segment);
    const nodeCount = segment.nodes.length;
    
    // 计算边距：萃取类使用自适应公式，其他类型使用固定值
    let edgeLength: number;
    if (segmentType === ProcessTypes.EXTRACTION) {
      edgeLength = calculateExtractionEdgeLength(nodeCount, config.targetEdgeLength);
    } else {
      edgeLength = config.targetEdgeLength;
    }
    
    // 计算相对布局（假设 startY=0）
    const { relativePositions, lastNodeBottom } = calculateRelativeLayout(
      segment,
      nodeHeights,
      edgeLength
    );
    
    segmentLayouts.push({
      segment,
      segmentType,
      edgeLength,
      relativePositions,
      lastNodeBottom,
    });

    if (isDebug) {
      console.log(`段 ${segment.id}: 类型=${segmentType}, 节点数=${nodeCount}, 边距=${edgeLength.toFixed(1)}px, 末端相对位置=${lastNodeBottom.toFixed(1)}px`);
    }
  });

  // 步骤3: 计算每个类型组的 span（组内最大 lastNodeBottom）
  const groupSpans = new Map<ProcessType | 'unknown', number>();
  segmentsByType.forEach((typeSegments, type) => {
    const maxSpan = Math.max(
      ...typeSegments.map(seg => {
        const layout = segmentLayouts.find(l => l.segment.id === seg.id);
        return layout ? layout.lastNodeBottom : 0;
      })
    );
    groupSpans.set(type, maxSpan);
    
    if (isDebug) {
      console.log(`类型组 ${type}: ${typeSegments.length}个段, span=${maxSpan.toFixed(1)}px`);
    }
  });

  // 步骤4: 计算全局最大 span
  const globalMaxSpan = Math.max(...Array.from(groupSpans.values()));
  
  if (isDebug) {
    console.log(`全局最大 span: ${globalMaxSpan.toFixed(1)}px`);
  }

  // 步骤5: 确定每组 startY（组内头部对齐，组间偏移让末端接近）
  const groupStartYs = new Map<ProcessType | 'unknown', number>();
  const baseStartY = config.initialY;
  
  segmentsByType.forEach((_typeSegments, type) => {
    const groupSpan = groupSpans.get(type) || 0;
    // 短组下移：groupStartY = baseStartY + (globalMaxSpan - groupSpan)
    const groupStartY = baseStartY + (globalMaxSpan - groupSpan);
    groupStartYs.set(type, groupStartY);
    
    if (isDebug) {
      console.log(`类型组 ${type}: startY=${groupStartY.toFixed(1)}px (偏移=${(globalMaxSpan - groupSpan).toFixed(1)}px)`);
    }
  });

  // 步骤6: 应用偏移，写入最终位置
  segmentLayouts.forEach(({ segment, segmentType, relativePositions }) => {
    const groupStartY = groupStartYs.get(segmentType) || baseStartY;
    
    segment.nodes.forEach(node => {
      const relativeY = relativePositions[node.id];
      nodeYPositions[node.id] = groupStartY + relativeY;
    });

    if (isDebug) {
      const firstNode = segment.nodes[0];
      const lastNode = segment.nodes[segment.nodes.length - 1];
      console.log(`段 ${segment.id}: 首节点Y=${nodeYPositions[firstNode.id].toFixed(1)}px, 末节点Y=${nodeYPositions[lastNode.id].toFixed(1)}px`);
    }
  });

  if (isDebug) {
    console.groupEnd();
  }

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
  _targetEdgeLength: number // 保留用于接口兼容性，实际验证基于计算出的实际位置
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

