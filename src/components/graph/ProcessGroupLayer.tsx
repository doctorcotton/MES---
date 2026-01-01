import { useMemo } from 'react';
import { useReactFlow } from 'reactflow';
import { useRecipeStore } from '@/store/useRecipeStore';

/**
 * Process红框绘制层
 * 根据Process包含的节点计算包围盒，绘制红色虚线框
 */
export function ProcessGroupLayer() {
  const { processes } = useRecipeStore();
  const { getNodes } = useReactFlow();

  const processBoxes = useMemo(() => {
    const allNodes = getNodes();
    const boxes: Array<{
      processId: string;
      processName: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }> = [];

    processes.forEach(process => {
      const processNodeIds = process.nodes.map(n => n.id);
      const processNodes = allNodes.filter(n => processNodeIds.includes(n.id));

      if (processNodes.length === 0) return;

      // 计算包围盒
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      processNodes.forEach(node => {
        const nodeWidth = node.width || 200;
        const nodeHeight = node.height || 120;
        const x = node.position.x;
        const y = node.position.y;

        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + nodeWidth);
        maxY = Math.max(maxY, y + nodeHeight);
      });

      // 添加padding
      const padding = 20;
      boxes.push({
        processId: process.id,
        processName: process.name,
        x: minX - padding,
        y: minY - padding,
        width: maxX - minX + padding * 2,
        height: maxY - minY + padding * 2,
      });
    });

    return boxes;
  }, [processes, getNodes]);

  if (processBoxes.length === 0) return null;

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 1 }}
    >
      {processBoxes.map(box => (
        <g key={box.processId}>
          {/* 红色虚线框 */}
          <rect
            x={box.x}
            y={box.y}
            width={box.width}
            height={box.height}
            fill="none"
            stroke="#ef4444"
            strokeWidth={2}
            strokeDasharray="5,5"
            rx={8}
            opacity={0.6}
          />
          {/* Process标签 */}
          <text
            x={box.x + 8}
            y={box.y - 8}
            className="text-xs font-semibold fill-red-600"
            style={{ fontSize: '12px' }}
          >
            {box.processId} - {box.processName}
          </text>
        </g>
      ))}
    </svg>
  );
}
