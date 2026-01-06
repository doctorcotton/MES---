import { useMemo } from 'react';
import { useReactFlow, Edge } from 'reactflow';
import { useFlowNodes, useFlowEdges } from '@/store/useRecipeStore';
import { useRecipeStore } from '@/store/useRecipeStore';

/**
 * 调试标签接口
 */
interface DebugLabel {
  id: string;
  x: number;
  y: number;
  value: number;  // 实际长度
  target: number; // 目标长度
  error: number;  // 误差
  color: 'green' | 'yellow' | 'red';
  // 增强信息
  sourceId: string;
  targetId: string;
  sourceBottom: number;
  targetTop: number;
  sourceHeight: number;
  targetHeight: number;
  sourceCenterY: number;
  targetCenterY: number;
}

/**
 * 调试叠加层组件
 * 显示连线长度、节点间距等调试信息
 */
export function DebugOverlay({ enabled }: { enabled: boolean }) {
  const { getNodes, getEdges, getViewport } = useReactFlow();
  const nodes = useFlowNodes();
  const edges = useFlowEdges();
  const nodePositions = useRecipeStore((state) => state.nodePositions);
  const nodeHeights = useRecipeStore((state) => state.nodeHeights);
  const nodeWidths = useRecipeStore((state) => state.nodeWidths);

  // 计算调试标签
  const debugLabels = useMemo((): DebugLabel[] => {
    if (!enabled) return [];

    const labels: DebugLabel[] = [];
    const targetEdgeLength = 120; // 目标连线长度

    edges.forEach(edge => {
      const sourceNode = nodes.find(n => n.id === edge.source);
      const targetNode = nodes.find(n => n.id === edge.target);
      
      if (!sourceNode || !targetNode) return;

      const sourcePos = nodePositions[sourceNode.id];
      const targetPos = nodePositions[targetNode.id];
      
      if (!sourcePos || !targetPos) return;

      // 从 store 获取节点高度和宽度，如果没有则使用默认值
      const sourceHeight = nodeHeights[sourceNode.id] || 120;
      const targetHeight = nodeHeights[targetNode.id] || 120;
      const sourceWidth = nodeWidths[sourceNode.id] || 200;
      const targetWidth = nodeWidths[targetNode.id] || 200;

      // nodePositions 存储的是左上角坐标，需要转换为中心坐标
      const sourceCenterX = sourcePos.x + sourceWidth / 2;
      const sourceCenterY = sourcePos.y + sourceHeight / 2;
      const targetCenterX = targetPos.x + targetWidth / 2;
      const targetCenterY = targetPos.y + targetHeight / 2;

      // 计算实际连线长度
      // 连线长度 = 目标节点顶部Y - 源节点底部Y
      const sourceBottom = sourceCenterY + sourceHeight / 2;
      const targetTop = targetCenterY - targetHeight / 2;
      const actualLength = targetTop - sourceBottom;

      // 计算误差
      const error = Math.abs(actualLength - targetEdgeLength);
      
      // 确定颜色
      let color: 'green' | 'yellow' | 'red' = 'green';
      if (error > 10) {
        color = 'red';
      } else if (error > 5) {
        color = 'yellow';
      }

      // 计算标签位置（连线中点，使用中心坐标）
      const labelX = (sourceCenterX + targetCenterX) / 2;
      const labelY = (sourceBottom + targetTop) / 2;

      labels.push({
        id: `debug-${edge.id}`,
        x: labelX,
        y: labelY,
        value: actualLength,
        target: targetEdgeLength,
        error,
        color,
        sourceId: sourceNode.id,
        targetId: targetNode.id,
        sourceBottom,
        targetTop,
        sourceHeight,
        targetHeight,
        sourceCenterY,
        targetCenterY,
      });
    });

    // 输出验证日志
    if (enabled && labels.length > 0) {
      console.group('[Debug] 连线长度验证');
      labels.forEach(label => {
        const status = label.color === 'green' ? '✅' : 
                       label.color === 'yellow' ? '⚠️' : '❌';
        console.log(`${status} ${label.sourceId} → ${label.targetId}:`, 
          '实际', label.value.toFixed(1), 
          '目标', label.target, 
          '误差', label.error.toFixed(1),
          '| 源底', label.sourceBottom.toFixed(1),
          '目标顶', label.targetTop.toFixed(1),
          '| H₁', label.sourceHeight, 'H₂', label.targetHeight);
      });
      console.groupEnd();
    }

    return labels;
  }, [enabled, edges, nodes, nodePositions, nodeHeights, nodeWidths]);

  // 计算节点调试信息
  const nodeDebugInfos = useMemo(() => {
    if (!enabled) return [];
    
    return nodes.map(node => {
      const pos = nodePositions[node.id];
      if (!pos) return null;
      
      const height = nodeHeights[node.id] || 120;
      const width = nodeWidths[node.id] || 200;
      const centerX = pos.x + width / 2;
      const centerY = pos.y + height / 2;
      
      return {
        id: node.id,
        x: pos.x + width, // 右上角
        y: pos.y,
        width,
        height,
        centerX,
        centerY,
        topY: pos.y,
        bottomY: pos.y + height,
      };
    }).filter((info): info is NonNullable<typeof info> => info !== null);
  }, [enabled, nodes, nodePositions, nodeHeights, nodeWidths]);

  // 获取视口变换
  const viewport = getViewport();

  if (!enabled) {
    return null;
  }

  return (
    <div
      className="pointer-events-none absolute inset-0 z-50"
      style={{
        transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
        transformOrigin: '0 0',
      }}
    >
      {/* 连线标签 */}
      {debugLabels.map(label => (
        <div
          key={label.id}
          className="absolute"
          style={{
            left: `${label.x}px`,
            top: `${label.y}px`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div
            className={`
              rounded px-2 py-1 text-xs font-mono font-bold shadow-lg
              ${label.color === 'green' ? 'bg-green-500 text-white' : ''}
              ${label.color === 'yellow' ? 'bg-yellow-500 text-white' : ''}
              ${label.color === 'red' ? 'bg-red-500 text-white' : ''}
            `}
            title={`目标: ${label.target}px, 误差: ${label.error.toFixed(1)}px\n源底: ${label.sourceBottom.toFixed(1)}px → 目标顶: ${label.targetTop.toFixed(1)}px\nH₁: ${label.sourceHeight}px | H₂: ${label.targetHeight}px`}
          >
            <div className="text-center">
              <div>{label.value.toFixed(1)}px</div>
              {label.error > 0.5 && (
                <div className="text-[10px] opacity-75">
                  (Δ{label.error > 0 ? '+' : ''}{label.error.toFixed(1)})
                </div>
              )}
              <div className="text-[9px] opacity-60 mt-0.5">
                {label.sourceBottom.toFixed(0)}→{label.targetTop.toFixed(0)}
              </div>
              <div className="text-[9px] opacity-60">
                H₁:{label.sourceHeight} H₂:{label.targetHeight}
              </div>
            </div>
          </div>
        </div>
      ))}
      
      {/* 节点信息标签 */}
      {nodeDebugInfos.map(info => (
        <div
          key={`node-info-${info.id}`}
          className="absolute bg-blue-500 text-white rounded px-2 py-1 text-[10px] font-mono shadow-lg"
          style={{
            left: `${info.x + 5}px`,
            top: `${info.y}px`,
            transform: 'translateY(0)',
          }}
          title={`节点: ${info.id}\n中心: (${info.centerX.toFixed(0)}, ${info.centerY.toFixed(0)})\n顶部: ${info.topY.toFixed(0)}px\n底部: ${info.bottomY.toFixed(0)}px`}
        >
          <div className="font-bold mb-0.5">{info.id.split('-').pop()}</div>
          <div>H: {info.height}px</div>
          <div>W: {info.width}px</div>
          <div>Y: {info.centerY.toFixed(0)}px</div>
        </div>
      ))}
    </div>
  );
}

/**
 * Hook: 检查调试模式是否启用
 */
export function useDebugMode(): boolean {
  return useMemo(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('debug_layout') === 'true';
  }, []);
}

/**
 * 工具函数: 切换调试模式
 */
export function toggleDebugMode(): boolean {
  if (typeof window === 'undefined') return false;
  const current = localStorage.getItem('debug_layout') === 'true';
  const newValue = !current;
  localStorage.setItem('debug_layout', String(newValue));
  return newValue;
}

