import { useLayoutEffect, useRef, useState } from 'react';
import { useReactFlow, useNodesInitialized } from 'reactflow';
import { identifyProcessSegments } from '@/hooks/segmentIdentifier';
import { layoutParallelSegments, calculateConvergenceY, layoutSerialSegments } from '@/hooks/segmentLayoutCalculator';
import { FlowNode, RecipeEdge } from '@/types/recipe';

interface LayoutControllerProps {
  onLayoutComplete: () => void;
  onNodesUpdate: (nodes: FlowNode[]) => void;
  layoutTrigger: string;
}

/**
 * LayoutController - Headless Component
 * 
 * 必须在 <ReactFlow> 内部渲染，因为需要使用 useReactFlow 钩子
 * 
 * 核心逻辑：
 * 1. 等待 React Flow 自动测量所有节点的真实尺寸
 * 2. 使用真实尺寸计算精确布局
 * 3. 更新节点位置并调用 fitView
 * 4. 通知父组件布局完成
 */
export function LayoutController({ onLayoutComplete, onNodesUpdate, layoutTrigger }: LayoutControllerProps) {
  const { getNodes, setNodes, getEdges, fitView } = useReactFlow();
  const nodesInitialized = useNodesInitialized();
  const hasLayoutedRef = useRef(false);
  const layoutTriggerRef = useRef(layoutTrigger);
  const layoutIterationRef = useRef(0); // 记录重排迭代次数
  const [relayoutTrigger, setRelayoutTrigger] = useState(0); // 用于触发重排的 state
  const measurementRetryRef = useRef(0); // 记录测量重试次数
  const measurementRetryTimeoutRef = useRef<number | null>(null); // 测量重试的定时器

  // 内容变化时重置布局标记和迭代次数（移到 effect 中，避免在 render 阶段调用 setState）
  useLayoutEffect(() => {
    if (layoutTrigger !== layoutTriggerRef.current) {
      console.log('[LayoutController] layoutTrigger 变化，重置布局状态', {
        old: layoutTriggerRef.current,
        new: layoutTrigger,
      });
      hasLayoutedRef.current = false;
      layoutIterationRef.current = 0;
      measurementRetryRef.current = 0; // 重置测量重试次数
      // 清理之前的测量重试定时器
      if (measurementRetryTimeoutRef.current !== null) {
        window.cancelAnimationFrame(measurementRetryTimeoutRef.current);
        measurementRetryTimeoutRef.current = null;
      }
      layoutTriggerRef.current = layoutTrigger;
      // 递增触发器，确保触发依赖变化（而不是重置为 0，因为可能之前就是 0）
      setRelayoutTrigger(prev => prev + 1);
    }
  }, [layoutTrigger]);

  useLayoutEffect(() => {
    // 条件1: 节点已初始化（React Flow 已测量尺寸）
    if (!nodesInitialized) {
      console.log('[LayoutController] 等待节点初始化...');
      return;
    }

    // 条件2: 还没有布局过
    if (hasLayoutedRef.current) {
      console.log('[LayoutController] 已布局过，跳过');
      return;
    }

    try {
      const nodes = getNodes() as FlowNode[];
      const edges = getEdges() as RecipeEdge[];

      // 检查节点初始化状态
      const nodeIds = new Set(nodes.map(n => n.id));
      const invalidEdges = edges.filter(e => !nodeIds.has(e.source) || !nodeIds.has(e.target));
      
      if (invalidEdges.length > 0) {
        console.warn('[LayoutController] 发现指向不存在节点的边（可能节点列表滞后）:', {
          invalidEdgeCount: invalidEdges.length,
          invalidEdges: invalidEdges.map(e => ({ id: e.id, source: e.source, target: e.target })),
          nodeIds: Array.from(nodeIds).slice(0, 10),
        });
      }

      console.log('[LayoutController] 状态检查:', {
        nodesInitialized,
        hasLayouted: hasLayoutedRef.current,
        nodeCount: nodes.length,
        edgeCount: edges.length,
        invalidEdgeCount: invalidEdges.length,
      });

      // 检查节点尺寸（放宽条件：允许部分节点未测量，使用默认尺寸继续布局）
      // React Flow 11 中节点尺寸存储在 node.width 和 node.height
      const measuredNodes = nodes.filter(n => n.width && n.height);
      const unmeasuredNodes = nodes.filter(n => !n.width || !n.height);
      console.log('[LayoutController] 节点尺寸检查:', {
        total: nodes.length,
        measured: measuredNodes.length,
        unmeasured: unmeasuredNodes.length,
        unmeasuredIds: unmeasuredNodes.map(n => n.id),
        sampleNode: nodes[0] ? {
          id: nodes[0].id,
          width: nodes[0].width,
          height: nodes[0].height,
          hasMeasured: !!(nodes[0] as any).measured,
        } : null,
      });

      // 如果所有节点都未测量（可能是 React Flow 临时清空了尺寸），延迟重试而不是用默认尺寸布局
      const MAX_MEASUREMENT_RETRIES = 5; // 最多重试 5 次
      if (measuredNodes.length === 0 && nodes.length > 0) {
        if (measurementRetryRef.current < MAX_MEASUREMENT_RETRIES) {
          console.warn(`[LayoutController] 所有节点尺寸未测量，延迟重试 (${measurementRetryRef.current + 1}/${MAX_MEASUREMENT_RETRIES})`);
          measurementRetryRef.current++;
          
          // 清理之前的定时器
          if (measurementRetryTimeoutRef.current !== null) {
            window.cancelAnimationFrame(measurementRetryTimeoutRef.current);
          }
          
          // 延迟 2-3 帧后重试
          measurementRetryTimeoutRef.current = window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
              measurementRetryTimeoutRef.current = null;
              // 通过递增 relayoutTrigger 触发重试
              setRelayoutTrigger(prev => prev + 1);
            });
          });
          return; // 不继续布局，等待重试
        } else {
          console.warn('[LayoutController] 达到最大测量重试次数，使用默认尺寸继续布局');
          // 重置重试计数，允许后续重排时再次尝试
          measurementRetryRef.current = 0;
        }
      } else {
        // 有节点已测量，重置重试计数
        measurementRetryRef.current = 0;
      }

      // 即使部分节点未测量，也继续布局（使用默认值）
      if (unmeasuredNodes.length > 0 && measuredNodes.length > 0) {
        console.warn('[LayoutController] 部分节点尺寸未测量，使用默认尺寸:',
          unmeasuredNodes.map(n => n.id)
        );
      }

      console.log('[LayoutController] 开始布局计算', {
        nodeCount: nodes.length,
        edgeCount: edges.length,
      });

      // ========== 收集真实尺寸（React Flow 测量的） ==========
      const nodeHeights: Record<string, number> = {};
      const nodeWidths: Record<string, number> = {};
      nodes.forEach(node => {
        // React Flow 11 中节点尺寸存储在 node.width 和 node.height
        // 未测量时使用默认值
        nodeHeights[node.id] = node.height || 120;
        nodeWidths[node.id] = node.width || 200;
      });

      // ========== 步骤1: 识别工艺段 ==========
      const { parallelSegments, serialSegments, convergenceNode } = identifyProcessSegments(nodes, edges);

      console.log('[LayoutController] 工艺段识别:', {
        parallelCount: parallelSegments.length,
        convergenceNodeId: convergenceNode?.id,
        serialCount: serialSegments.length,
      });

      // ========== 步骤2: 计算布局 ==========
      const TARGET_EDGE_LENGTH = 120;
      const INITIAL_Y = 80;
      const PROCESS_LANE_WIDTH = 300;
      const LANE_GAP = 64;
      const START_X = 150;

      // 初始化节点位置
      const nodePositions: Record<string, { x: number; y: number }> = {};

      // 2.1: 根据 displayOrder 分配 X 坐标
      const nodesByDisplayOrder: Record<number, FlowNode[]> = {};
      nodes.forEach(node => {
        const displayOrder = node.data.displayOrder || 1;
        if (!nodesByDisplayOrder[displayOrder]) {
          nodesByDisplayOrder[displayOrder] = [];
        }
        nodesByDisplayOrder[displayOrder].push(node);
      });

      const displayOrders = Object.keys(nodesByDisplayOrder).map(Number).sort((a, b) => a - b);
      displayOrders.forEach((displayOrder, laneIndex) => {
        // 计算节点中心点 X 坐标（与 Y 坐标语义一致：存储中心点，转换时减半宽）
        const laneX = START_X + laneIndex * (PROCESS_LANE_WIDTH + LANE_GAP);
        nodesByDisplayOrder[displayOrder].forEach(node => {
          const width = nodeWidths[node.id] || 200;
          // 存储节点中心点：车道左边缘 + 节点宽度的一半
          nodePositions[node.id] = { x: laneX + width / 2, y: 0 };
        });
      });

      // 2.2: 布局并行段（计算 Y 坐标）
      const parallelYPositions = layoutParallelSegments(
        parallelSegments,
        nodeHeights,
        {
          targetEdgeLength: TARGET_EDGE_LENGTH,
          initialY: INITIAL_Y
        }
      );

      // 2.3: 计算汇聚点位置 (X 和 Y)
      // 注意：nodePositions 的 y 语义是“节点中心点 Y”
      let convergenceCenterY = INITIAL_Y;
      let convergenceX = 0;

      if (convergenceNode) {
        // calculateConvergenceY 当前返回的是“汇聚点顶部 Y”（并行段末节点底部 + gap）
        const convergenceTopY = calculateConvergenceY(
          parallelSegments,
          parallelYPositions,
          nodeHeights,
          TARGET_EDGE_LENGTH,
          'max'
        );
        const convergenceHeight = nodeHeights[convergenceNode.id] || 120;
        convergenceCenterY = convergenceTopY + convergenceHeight / 2;

        // 新增：计算汇聚点 X 坐标 (加权质心法)
        // 算法参考 AUTO_LAYOUT_ALGORITHM.md Node 4.2
        if (parallelSegments.length > 0) {
          let totalWeight = 0;
          let weightedXSum = 0;

          parallelSegments.forEach(segment => {
            // 过滤出已分配位置的节点
            const validNodes = segment.nodes.filter(n => nodePositions[n.id]);
            if (validNodes.length === 0) return;

            // 计算该分支的质心 X
            const segmentCentroidX = validNodes.reduce((sum, n) => sum + nodePositions[n.id].x, 0) / validNodes.length;

            // 权重 = 节点数量的平方根 (弱化长分支的影响，避免汇聚点过度偏向)
            const weight = Math.sqrt(validNodes.length);

            weightedXSum += segmentCentroidX * weight;
            totalWeight += weight;
          });

          if (totalWeight > 0) {
            convergenceX = weightedXSum / totalWeight;
          }
        }

        if (nodePositions[convergenceNode.id]) {
          nodePositions[convergenceNode.id].y = convergenceCenterY;
          // 如果计算出了新的 X 坐标，更新它
          if (convergenceX > 0) {
            nodePositions[convergenceNode.id].x = convergenceX;
          }
        }
      }

      // 2.4: 布局串行段
      const serialYPositions = layoutSerialSegments(
        serialSegments,
        // 串行段起点应为“汇聚点中心 Y”（serialSegments 通常包含汇聚点作为首节点）
        convergenceCenterY,
        nodeHeights,
        {
          targetEdgeLength: TARGET_EDGE_LENGTH
        }
      );

      // 新增：应用 X 坐标到串行段 (与汇聚点垂直对齐)
      if (convergenceX > 0) {
        serialSegments.forEach(segment => {
          segment.nodes.forEach(node => {
            if (nodePositions[node.id]) {
              nodePositions[node.id].x = convergenceX;
            }
          });
        });
      }

      // 2.5: 合并 Y 坐标
      Object.keys(parallelYPositions).forEach(nodeId => {
        if (nodePositions[nodeId]) {
          nodePositions[nodeId].y = parallelYPositions[nodeId];
        } else {
          // 如果节点还没有位置，创建新位置
          const node = nodes.find(n => n.id === nodeId);
          const displayOrder = node?.data.displayOrder || 1;
          const laneIndex = displayOrders.indexOf(displayOrder);
          const laneX = laneIndex >= 0
            ? START_X + laneIndex * (PROCESS_LANE_WIDTH + LANE_GAP)
            : START_X;
          const width = nodeWidths[nodeId] || 200;
          nodePositions[nodeId] = { x: laneX + width / 2, y: parallelYPositions[nodeId] };
        }
      });

      Object.keys(serialYPositions).forEach(nodeId => {
        if (nodePositions[nodeId]) {
          nodePositions[nodeId].y = serialYPositions[nodeId];
        } else {
          // 如果节点还没有位置，创建新位置
          const node = nodes.find(n => n.id === nodeId);
          const displayOrder = node?.data.displayOrder || 1;
          const laneIndex = displayOrders.indexOf(displayOrder);
          const laneX = laneIndex >= 0
            ? START_X + laneIndex * (PROCESS_LANE_WIDTH + LANE_GAP)
            : START_X;
          const width = nodeWidths[nodeId] || 200;
          nodePositions[nodeId] = { x: laneX + width / 2, y: serialYPositions[nodeId] };
        }
      });

      // 关键：检查并处理完全没有位置的节点
      const nodesWithoutPosition = nodes.filter(n => !nodePositions[n.id]);
      if (nodesWithoutPosition.length > 0) {
        console.warn('[LayoutController] 发现未分配位置的节点:',
          nodesWithoutPosition.map(n => n.id)
        );

        // 为缺失节点分配默认位置
        nodesWithoutPosition.forEach(node => {
          const displayOrder = node.data.displayOrder || 1;
          const laneIndex = displayOrders.indexOf(displayOrder);
          const laneX = laneIndex >= 0
            ? START_X + laneIndex * (PROCESS_LANE_WIDTH + LANE_GAP)
            : START_X;
          const width = nodeWidths[node.id] || 200;

          // 使用默认 Y 坐标
          nodePositions[node.id] = { x: laneX + width / 2, y: INITIAL_Y };
          console.log('[LayoutController] 为节点分配默认位置:', {
            id: node.id,
            x: laneX + width / 2,
            y: INITIAL_Y,
          });
        });
      }

      // 确保所有节点都有 Y 坐标（防止 Y 为 0）
      nodes.forEach(node => {
        if (nodePositions[node.id]) {
          if (nodePositions[node.id].y === 0 || nodePositions[node.id].y === undefined) {
            nodePositions[node.id].y = INITIAL_Y;
          }
        }
      });

      // 检查节点位置分配情况
      console.log('[LayoutController] 位置分配检查:', {
        totalNodes: nodes.length,
        nodesWithPosition: Object.keys(nodePositions).length,
        missingNodes: nodes.filter(n => !nodePositions[n.id]).map(n => n.id),
        positionSample: Object.entries(nodePositions).slice(0, 3).map(([id, pos]) => ({
          id,
          x: pos.x,
          y: pos.y,
        })),
      });

      // ========== 步骤3: 转换为左上角坐标（React Flow 要求） ==========
      const layoutedNodes = nodes.map(node => {
        let pos = nodePositions[node.id];

        // 如果节点没有位置（不应该发生，但作为最后保障）
        if (!pos) {
          console.error('[LayoutController] 节点没有位置，使用默认值:', node.id);
          const displayOrder = node.data.displayOrder || 1;
          const laneIndex = displayOrders.indexOf(displayOrder);
          const laneX = laneIndex >= 0
            ? START_X + laneIndex * (PROCESS_LANE_WIDTH + LANE_GAP)
            : START_X;
          const fallbackWidth = nodeWidths[node.id] || 200;
          pos = { x: laneX + fallbackWidth / 2, y: INITIAL_Y };
        }

        const width = nodeWidths[node.id] || 200;
        const height = nodeHeights[node.id] || 120;

        return {
          ...node,
          position: {
            x: pos.x - width / 2,
            y: pos.y - height / 2,
          },
        };
      });

      // 检查节点位置
      console.log('[LayoutController] 布局后节点位置:',
        layoutedNodes.map(n => ({ id: n.id, x: n.position.x, y: n.position.y }))
      );

      // 更新受控节点状态（通过回调）：只传位置信息
      console.log('[LayoutController] 更新受控节点状态');
      onNodesUpdate(layoutedNodes);

      // 同时更新 React Flow 内部状态：只更新 position，不覆盖节点数组
      // 这是修复"新增节点不出现"的关键：不能把 getNodes() 拿到的数组作为权威节点列表
      setNodes(prev => {
        const positionMap = new Map(layoutedNodes.map(n => [n.id, n.position]));
        return prev.map(node => {
          const newPosition = positionMap.get(node.id);
          if (newPosition) {
            return { ...node, position: newPosition };
          }
          return node;
        });
      });

      console.log('[LayoutController] 节点位置已更新，准备校验间距');

      // ========== 步骤4: 校验间距，必要时重排 ==========
      // 使用已定义的 TARGET_EDGE_LENGTH (120)
      const TOLERANCE = 5; // 允许误差 5px
      const MAX_ITERATIONS = 3; // 最多重排 3 次

      // 等待 1-2 帧让 ReactFlow 完成重新测量
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          // 重新获取节点（可能已重新测量尺寸）
          const currentNodes = getNodes() as FlowNode[];
          const currentEdges = getEdges() as RecipeEdge[];

          // 校验边间距
          let maxError = 0;
          let invalidEdgeCount = 0;

          currentEdges.forEach(edge => {
            const sourceNode = currentNodes.find(n => n.id === edge.source);
            const targetNode = currentNodes.find(n => n.id === edge.target);

            if (!sourceNode || !targetNode) {
              return;
            }

            // 使用默认尺寸，与布局计算阶段保持一致
            const sourceHeight = sourceNode.height || 120;

            // 计算实际间距
            const sourceBottom = sourceNode.position.y + sourceHeight;
            const targetTop = targetNode.position.y;
            const actualGap = targetTop - sourceBottom;
            const error = Math.abs(actualGap - TARGET_EDGE_LENGTH);

            if (error > TOLERANCE) {
              invalidEdgeCount++;
              maxError = Math.max(maxError, error);
            }
          });

          console.log('[LayoutController] 间距校验:', {
            iteration: layoutIterationRef.current,
            totalEdges: currentEdges.length,
            invalidEdges: invalidEdgeCount,
            maxError: maxError.toFixed(1),
            tolerance: TOLERANCE,
          });

          // 判断是否需要重排
          const needsRelayout = invalidEdgeCount > 0 && layoutIterationRef.current < MAX_ITERATIONS;

          if (needsRelayout) {
            console.log(`[LayoutController] 间距不合格，触发第 ${layoutIterationRef.current + 1} 次重排`);
            layoutIterationRef.current++;
            // 重置布局标记，通过 state 触发下一轮布局
            hasLayoutedRef.current = false;
            setRelayoutTrigger(prev => prev + 1); // 触发重排
            // 注意：这里不调用 onLayoutComplete，让下一轮布局继续
            return;
          }

          // 间距合格或达到最大迭代次数，完成布局
          if (layoutIterationRef.current >= MAX_ITERATIONS && invalidEdgeCount > 0) {
            console.warn('[LayoutController] 达到最大迭代次数，停止重排（部分边间距可能仍不合格）');
          } else {
            console.log('[LayoutController] 间距校验通过，布局完成');
          }

          // 标记已布局
          hasLayoutedRef.current = true;
          layoutIterationRef.current = 0; // 重置迭代次数

          // 执行 fitView
          console.log('[LayoutController] 执行 fitView');
          fitView({ padding: 0.2, duration: 0 });
          console.log('[LayoutController] fitView 完成，通知布局完成');
          onLayoutComplete();
        });
      });
    } catch (error) {
      console.error('[LayoutController] 布局计算失败:', error);
      // 失败时也要调用，避免卡住
      hasLayoutedRef.current = true;
      onLayoutComplete();
    }

  }, [nodesInitialized, getNodes, setNodes, getEdges, fitView, onLayoutComplete, onNodesUpdate, relayoutTrigger]);

  return null; // Headless Component
}

