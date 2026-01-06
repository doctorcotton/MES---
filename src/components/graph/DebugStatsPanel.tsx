import { useMemo } from 'react';
import { useRecipeStore } from '@/store/useRecipeStore';

interface SegmentLayoutValidation {
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

export function DebugStatsPanel({ enabled }: { enabled: boolean }) {
  const layoutValidation = useRecipeStore((state) => state.layoutValidation);

  if (!enabled || !layoutValidation) {
    return null;
  }

  return (
    <div className="absolute top-4 left-4 z-50 bg-white rounded-lg shadow-xl border border-gray-300 p-4 max-w-sm max-h-[80vh] overflow-y-auto">
      <div className="font-bold text-sm mb-3 flex items-center gap-2">
        <span>📊</span>
        <span>布局统计</span>
      </div>

      {/* 并行工艺段统计 */}
      {layoutValidation.parallelSegmentStats.length > 0 && (
        <div className="mb-4">
          <div className="text-xs font-semibold text-gray-700 mb-2">并行工艺段:</div>
          {layoutValidation.parallelSegmentStats.map((stat, idx) => (
            <div key={stat.segmentId} className="mb-3 p-2 bg-gray-50 rounded text-xs">
              <div className="font-medium mb-1">段 {idx + 1} ({stat.segmentId.split('-').pop()})</div>
              <div className="text-gray-600 space-y-0.5">
                <div>• 节点: {stat.allEdgeLengths.length + 1}个</div>
                <div>• 边: {stat.allEdgeLengths.length}条</div>
                <div>• 平均长度: <span className="font-mono">{stat.avgEdgeLength.toFixed(1)}px</span></div>
                <div>• 标准差: <span className="font-mono">{stat.stdDeviation.toFixed(1)}px</span></div>
                <div>• 最小/最大: <span className="font-mono">{stat.minEdgeLength.toFixed(1)}/{stat.maxEdgeLength.toFixed(1)}px</span></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 串行工艺段统计 */}
      {layoutValidation.serialSegmentStats.allEdgeLengths.length > 0 && (
        <div className="mb-4">
          <div className="text-xs font-semibold text-gray-700 mb-2">串行工艺段:</div>
          <div className="p-2 bg-gray-50 rounded text-xs">
            <div className="text-gray-600 space-y-0.5">
              <div>• 边: {layoutValidation.serialSegmentStats.allEdgeLengths.length}条</div>
              <div>• 平均长度: <span className="font-mono">{layoutValidation.serialSegmentStats.avgEdgeLength.toFixed(1)}px</span></div>
              <div>• 标准差: <span className="font-mono">{layoutValidation.serialSegmentStats.stdDeviation.toFixed(1)}px</span></div>
              <div>• 最小/最大: <span className="font-mono">{layoutValidation.serialSegmentStats.minEdgeLength.toFixed(1)}/{layoutValidation.serialSegmentStats.maxEdgeLength.toFixed(1)}px</span></div>
            </div>
          </div>
        </div>
      )}

      {/* 总体统计 */}
      <div className="border-t border-gray-200 pt-2">
        <div className="text-xs font-semibold text-gray-700 mb-2">总体统计:</div>
        <div className="text-xs text-gray-600 space-y-0.5">
          <div>• 并行边总数: {layoutValidation.overallStats.totalParallelEdges}</div>
          <div>• 串行边总数: {layoutValidation.overallStats.totalSerialEdges}</div>
          <div>• 并行平均长度: <span className="font-mono">{layoutValidation.overallStats.avgParallelEdgeLength.toFixed(1)}px</span></div>
          <div>• 串行平均长度: <span className="font-mono">{layoutValidation.overallStats.avgSerialEdgeLength.toFixed(1)}px</span></div>
        </div>
      </div>
    </div>
  );
}

