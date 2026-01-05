import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FlowNode, SubStep, ProcessType } from '@/types/recipe';
import { useRecipeStore, useFlowEdges, useRecipeSchedule } from '@/store/useRecipeStore';

type CustomNodeData = FlowNode['data'];

// 格式化条件值
const formatConditionValue = (value: { value: number; unit: string; condition?: string }) => {
  const condition = value.condition || '';
  return `${condition}${value.value}${value.unit}`;
};

// 格式化温度范围
const formatTemperature = (temp: { min?: number; max?: number; unit: string }) => {
  if (temp.min !== undefined && temp.max !== undefined) {
    return `${temp.min}-${temp.max}${temp.unit}`;
  } else if (temp.min !== undefined) {
    return `≥${temp.min}${temp.unit}`;
  } else if (temp.max !== undefined) {
    return `≤${temp.max}${temp.unit}`;
  }
  return '常温';
};

/**
 * 根据输入数量计算分档宽度
 */
const getTieredWidth = (inputCount: number): number => {
  if (inputCount <= 2) return 200;
  if (inputCount <= 4) return 280;
  return 360;
};

// 渲染子步骤参数内容
const renderSubStepParams = (subStep: SubStep, inputSources?: FlowNode['data']['inputSources']) => {
  switch (subStep.processType) {
    case ProcessType.DISSOLUTION:
      if ('dissolutionParams' in subStep.params) {
        const params = subStep.params.dissolutionParams;
        const tempStr = formatTemperature(params.waterTemp);
        const volumeStr = formatConditionValue(params.waterVolume);
        const rateMap: Record<string, string> = { high: '高速', medium: '中速', low: '低速' };
        return (
          <div className="space-y-1">
            <div className="text-xs text-gray-700">
              <span className="font-medium">水量:</span> {volumeStr}
            </div>
            <div className="text-xs text-gray-700">
              <span className="font-medium">水温:</span> {tempStr}
            </div>
            <div className="text-xs text-gray-700">
              <span className="font-medium">搅拌:</span> {rateMap[params.stirringRate]} {params.stirringTime.value}{params.stirringTime.unit}
            </div>
          </div>
        );
      }
      break;

    case ProcessType.COMPOUNDING:
      if ('compoundingParams' in subStep.params) {
        const params = subStep.params.compoundingParams;
        const speedStr = formatConditionValue(params.stirringSpeed);
        return (
          <div className="space-y-1">
            {/* 进料顺序列表 */}
            {inputSources && inputSources.length > 0 && (
              <div className="mb-2 pb-2 border-b border-gray-200">
                <div className="text-xs font-semibold text-gray-800 mb-1">进料顺序:</div>
                <div className="space-y-0.5">
                  {inputSources.map((source) => (
                    <div key={source.nodeId} className="text-xs text-gray-700">
                      <span className="font-medium">{source.sequenceOrder}.</span>{' '}
                      <span>{source.name}</span>
                      {source.processName && (
                        <span className="text-gray-500 ml-1">({source.processName})</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="text-xs text-gray-700">
              <span className="font-medium">添加物:</span> {params.additives.length}项
            </div>
            <div className="text-xs text-gray-700">
              <span className="font-medium">搅拌:</span> {speedStr} {params.stirringTime.value}{params.stirringTime.unit}
            </div>
          </div>
        );
      }
      break;

    case ProcessType.FILTRATION:
      if ('filtrationParams' in subStep.params) {
        const params = subStep.params.filtrationParams;
        return (
          <div className="text-xs text-gray-700">
            <span className="font-medium">精度:</span> {params.precision.value}{params.precision.unit}
          </div>
        );
      }
      break;

    case ProcessType.TRANSFER:
      if ('transferParams' in subStep.params) {
        const params = subStep.params.transferParams;
        const transferMap: Record<string, string> = { material: '料赶料', water: '水赶料', none: '无' };
        return (
          <div className="space-y-1">
            <div className="text-xs text-gray-700">
              <span className="font-medium">类型:</span> {transferMap[params.transferType]}
            </div>
            {params.waterVolume && (
              <div className="text-xs text-gray-700">
                <span className="font-medium">水量:</span> {params.waterVolume.value}{params.waterVolume.unit}
              </div>
            )}
          </div>
        );
      }
      break;

    case ProcessType.FLAVOR_ADDITION:
      if ('flavorAdditionParams' in subStep.params) {
        return (
          <div className="text-xs text-gray-700">
            <span className="font-medium">方式:</span> {subStep.params.flavorAdditionParams.method}
          </div>
        );
      }
      break;

    case ProcessType.OTHER:
    default:
      if ('params' in subStep.params && subStep.params.params) {
        return (
          <div className="text-xs text-gray-700 font-mono">
            <span className="font-medium">参数:</span> {subStep.params.params}
          </div>
        );
      }
      break;
  }
  return null;
};

// 根据工艺类型获取节点头部颜色
const getNodeHeaderColor = (processType: ProcessType): string => {
  const colorMap: Record<ProcessType, string> = {
    [ProcessType.DISSOLUTION]: 'bg-blue-500',        // 溶解 - 蓝色
    [ProcessType.COMPOUNDING]: 'bg-purple-500',      // 调配 - 紫色
    [ProcessType.FILTRATION]: 'bg-green-500',        // 过滤 - 绿色
    [ProcessType.TRANSFER]: 'bg-orange-500',         // 赶料 - 橙色
    [ProcessType.FLAVOR_ADDITION]: 'bg-pink-500',    // 香精添加 - 粉色
    [ProcessType.OTHER]: 'bg-gray-500',              // 其他 - 灰色
  };
  return colorMap[processType] || 'bg-gray-500';
};

export const CustomNode = memo(({ id, data, selected, type }: NodeProps<CustomNodeData>) => {
  const hoveredNodeId = useRecipeStore((state) => state.hoveredNodeId);
  const flowEdges = useFlowEdges();
  const { toggleProcessExpanded } = useRecipeStore();
  const isHovered = hoveredNodeId === id;

  // 获取输入边数量
  const incomingEdges = flowEdges.filter(edge => edge.target === id);
  const inputCount = incomingEdges.length;

  // 判断节点类型
  const isSummaryNode = type === 'processSummaryNode';
  const isSubStepNode = type === 'subStepNode';

  // 汇总节点渲染
  if (isSummaryNode && data.processId) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const process = useRecipeStore((state) => state.processes.find(p => p.id === data.processId));
    const firstSubStep = process?.node.subSteps[0];
    const headerColor = firstSubStep ? getNodeHeaderColor(firstSubStep.processType) : 'bg-gray-500';

    // 计算分档宽度
    const nodeWidth = getTieredWidth(inputCount);

    return (
      <div
        className={cn(
          'rounded-lg border-2 bg-white shadow-md transition-all cursor-pointer',
          isHovered ? 'border-blue-500 shadow-lg' : 'border-gray-300',
          selected && 'ring-2 ring-blue-400'
        )}
        style={{ minWidth: `${nodeWidth}px`, width: `${nodeWidth}px` }}
        onClick={() => toggleProcessExpanded(data.processId!)}
      >
        {/* Header */}
        <div className={cn('rounded-t-lg px-3 py-2', headerColor)}>
          <div className="font-bold text-white flex items-center justify-between">
            <div>
              <span className="text-sm">P{data.displayOrder ?? '?'}</span>
              <span className="ml-2">{data.processName}</span>
            </div>
            <ChevronRight className="h-4 w-4" />
          </div>
        </div>

        {/* Body */}
        <div className="px-3 py-2">
          <div className="text-xs text-gray-600">
            <span className="font-medium">包含步骤:</span> {data.subStepCount}个
          </div>
        </div>

        {/* Handles */}
        {inputCount <= 1 ? (
          <Handle type="target" position={Position.Top} className="w-3 h-3 bg-gray-400" />
        ) : (
          Array.from({ length: inputCount }).map((_, index) => {
            const leftPosition = inputCount > 1
              ? 15 + (index * (70 / (inputCount - 1)))
              : 50;

            return (
              <Handle
                key={`target-${index}`}
                id={`target-${index}`}
                type="target"
                position={Position.Top}
                className="w-3 h-3 bg-gray-400"
                style={{ left: `${leftPosition}%` }}
              />
            );
          })
        )}
        <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-gray-400" />
      </div>
    );
  }

  // 子步骤节点渲染
  if (isSubStepNode && data.subStep) {
    const subStep = data.subStep;
    const headerColor = getNodeHeaderColor(subStep.processType);

    // 计算分档宽度
    const nodeWidth = getTieredWidth(inputCount);

    return (
      <div
        className={cn(
          'rounded-lg border-2 bg-white shadow-md transition-all',
          isHovered ? 'border-blue-500 shadow-lg' : 'border-gray-300',
          selected && 'ring-2 ring-blue-400'
        )}
        style={{ minWidth: `${nodeWidth}px`, width: `${nodeWidth}px` }}
      >
        {/* Header */}
        <div className={cn('rounded-t-lg px-3 py-2', headerColor)}>
          <div className="font-bold text-white">
            <span className="text-sm">P{data.displayOrder}-{subStep.order}.</span>
            <span className="ml-2">{subStep.label}</span>
          </div>
        </div>

        {/* Body */}
        <div className="px-3 py-2 space-y-1 whitespace-normal break-words">
          <div className="text-xs text-gray-600">
            <span className="font-medium">位置:</span> <span className="break-words">{subStep.deviceCode}</span>
          </div>
          <div className="text-xs text-gray-600">
            <span className="font-medium">原料:</span> <span className="break-words">{subStep.ingredients}</span>
          </div>
          {renderSubStepParams(subStep, data.inputSources)}

          {/* Scheduling Info */}
          {(() => {
            // eslint-disable-next-line react-hooks/rules-of-hooks
            const { timeline } = useRecipeSchedule();
            const occupancy = timeline.find((o: any) => o.stepId === subStep.id);

            if (occupancy) {
              return (
                <div className="mt-2 pt-2 border-t border-dashed border-gray-300">
                  <div className="text-xs text-purple-700 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                    {occupancy.deviceCode}
                  </div>
                  <div className="text-xs text-gray-500 ml-2.5">
                    耗时: {occupancy.duration}min
                    {occupancy.startTime > 0 && ` (T+${occupancy.startTime})`}
                  </div>
                </div>
              );
            }
            return null;
          })()}
        </div>

        {/* Handles */}
        {inputCount <= 1 ? (
          <Handle type="target" position={Position.Top} className="w-3 h-3 bg-gray-400" />
        ) : (
          Array.from({ length: inputCount }).map((_, index) => {
            const leftPosition = inputCount > 1
              ? 15 + (index * (70 / (inputCount - 1)))
              : 50;

            return (
              <Handle
                key={`target-${index}`}
                id={`target-${index}`}
                type="target"
                position={Position.Top}
                className="w-3 h-3 bg-gray-400"
                style={{ left: `${leftPosition}%` }}
              />
            );
          })
        )}
        <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-gray-400" />
      </div>
    );
  }

  return null;
});

CustomNode.displayName = 'CustomNode';
