import { memo, useMemo } from 'react';
import {
  EdgeProps,
  getSmoothStepPath,
  EdgeLabelRenderer,
  BaseEdge,
} from 'reactflow';

// 走廊路由参数
const CORRIDOR_CLEARANCE_PX = 60; // 走廊距离目标节点的净空
const MIN_TARGET_CLEARANCE_PX = 24; // 最小目标节点净空
const MIN_SOURCE_DROP_PX = 12; // 最小源节点下降距离
const CORNER_RADIUS = 20; // 拐角圆角半径

/**
 * 生成走廊路径（三段式：垂直-水平-垂直）
 * 用于多入边汇入同一节点时，避免连线交叉
 */
function generateCorridorPath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number
): string {
  // 计算走廊Y坐标
  let corridorY = targetY - CORRIDOR_CLEARANCE_PX;

  // 夹紧条件1：确保走廊不压住目标节点
  const minCorridorY = targetY - MIN_TARGET_CLEARANCE_PX;
  corridorY = Math.min(corridorY, minCorridorY);

  // 夹紧条件2：确保有足够的下降距离
  const minSourceY = sourceY + MIN_SOURCE_DROP_PX;
  corridorY = Math.max(corridorY, minSourceY);

  // 计算水平移动方向
  const horizontalDistance = Math.abs(targetX - sourceX);

  // 修复点2：不允许斜线 - 统一使用走廊路径
  // 当源点在目标点下方时，调整走廊Y到源点下方
  if (sourceY >= targetY) {
    // 源点在目标点下方，走廊设置在源点下方
    corridorY = sourceY + CORRIDOR_CLEARANCE_PX;
    // 确保走廊不压住目标节点
    corridorY = Math.max(corridorY, targetY + MIN_TARGET_CLEARANCE_PX);
  }

  // 动态调整圆角半径（确保不超过水平距离的一半）
  // 注意：如果圆角几何不成立，应该通过布局侧吸附解决，这里只做动态调整
  const effectiveCornerRadius = Math.min(CORNER_RADIUS, horizontalDistance / 2);

  // 生成三段式路径（带圆角）
  // 1. 从源点垂直下降到走廊（留出圆角空间）
  const verticalDropEndY = corridorY - effectiveCornerRadius;

  // 2. 圆角过渡到水平段
  // 如果目标在右侧，圆角向右；如果目标在左侧，圆角向左
  const isTargetRight = targetX > sourceX;
  const cornerX1 = isTargetRight
    ? sourceX + effectiveCornerRadius
    : sourceX - effectiveCornerRadius;

  // 3. 水平移动到目标X附近（留出圆角空间）
  const cornerX2 = isTargetRight
    ? targetX - effectiveCornerRadius
    : targetX + effectiveCornerRadius;

  // 4. 圆角过渡到垂直段
  const verticalRiseStartY = corridorY + effectiveCornerRadius;

  // 构建完整路径
  const path = [
    `M ${sourceX} ${sourceY}`,                    // 起点
    `L ${sourceX} ${verticalDropEndY}`,           // 垂直下降
    `Q ${sourceX} ${corridorY} ${cornerX1} ${corridorY}`, // 圆角1
    `L ${cornerX2} ${corridorY}`,                 // 水平移动
    `Q ${targetX} ${corridorY} ${targetX} ${verticalRiseStartY}`, // 圆角2
    `L ${targetX} ${targetY}`,                    // 垂直上升
  ].join(' ');

  return path;
}

export const SequenceEdge = memo(
  ({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    markerEnd,
  }: EdgeProps) => {
    // 判断是否使用走廊路由
    const incomingTotal = data?.incomingTotal;
    const useCorridor = incomingTotal !== undefined && incomingTotal > 1;

    // 根据路由模式生成路径
    const edgePath = useMemo(() => {
      if (useCorridor) {
        // 使用走廊路径
        return generateCorridorPath(sourceX, sourceY, targetX, targetY);
      } else {
        // 使用默认平滑路径
        const [path] = getSmoothStepPath({
          sourceX,
          sourceY,
          sourcePosition,
          targetX,
          targetY,
          targetPosition,
          borderRadius: 20,
        });
        return path;
      }
    }, [useCorridor, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition]);

    // 计算靠近终点 (Target) 的位置
    // badgeX 必须精确等于 targetX (锚点 X 坐标)
    // badgeY 距离 targetY (锚点 Y 坐标) 保持固定间距，以对齐所有汇入线
    const badgeX = targetX;
    const badgeY = targetY - 30; // 稍微调高一点，避免挡住节点标题栏

    const sequenceOrder = data?.sequenceOrder;
    const isEditingDashed = data?.isEditingDashed || false;

    // 根据编辑态决定样式
    const edgeStyle = useMemo(() => {
      const baseStyle: { stroke: string; strokeWidth: number; strokeDasharray?: string; opacity?: number } = {
        stroke: '#9ca3af',
        strokeWidth: 2,
      };

      if (isEditingDashed) {
        baseStyle.strokeDasharray = '6 6';
        baseStyle.opacity = 0.7; // 稍微降低不透明度以突出编辑态
      }

      return baseStyle;
    }, [isEditingDashed]);

    return (
      <>
        <BaseEdge
          id={id}
          path={edgePath}
          markerEnd={markerEnd}
          style={edgeStyle}
        />
        {sequenceOrder && (
          <EdgeLabelRenderer>
            <div
              style={{
                position: 'absolute',
                transform: `translate(-50%, -50%) translate(${badgeX}px,${badgeY}px)`,
                pointerEvents: 'all',
              }}
              className="nodrag nopan"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white shadow-md ring-2 ring-white">
                {sequenceOrder}
              </div>
            </div>
          </EdgeLabelRenderer>
        )}
      </>
    );
  }
);

SequenceEdge.displayName = 'SequenceEdge';
