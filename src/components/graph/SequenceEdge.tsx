import { memo } from 'react';
import {
  EdgeProps,
  getSmoothStepPath,
  EdgeLabelRenderer,
  BaseEdge,
} from 'reactflow';

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
    const [edgePath] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      borderRadius: 20,
    });

    // 计算靠近终点 (Target) 的位置
    // badgeX 必须精确等于 targetX (锚点 X 坐标)
    // badgeY 距离 targetY (锚点 Y 坐标) 保持固定间距，以对齐所有汇入线
    const badgeX = targetX;
    const badgeY = targetY - 30; // 稍微调高一点，避免挡住节点标题栏

    const sequenceOrder = data?.sequenceOrder;

    return (
      <>
        <BaseEdge
          id={id}
          path={edgePath}
          markerEnd={markerEnd}
          style={{ stroke: '#9ca3af', strokeWidth: 2 }}
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
