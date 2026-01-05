import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FlowNode, SubStep, ProcessType } from '@/types/recipe';
import { useRecipeStore, useFlowEdges, useRecipeSchedule } from '@/store/useRecipeStore';
import { useFieldConfigStore } from '@/store/useFieldConfigStore';
import { FieldConfig } from '@/types/fieldConfig';

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

// 渲染子步骤参数内容 - Dynamic Version
const SubStepParamsDisplay = ({ subStep, inputSources }: { subStep: SubStep, inputSources?: FlowNode['data']['inputSources'] }) => {
  const { getConfigsByProcessType } = useFieldConfigStore();
  const configs = getConfigsByProcessType(subStep.processType);

  // Helper to get value from nested params structure
  const getParamValue = (key: string): any => {
    const paramKeyMaps: Record<string, string> = {
      [ProcessType.DISSOLUTION]: 'dissolutionParams',
      [ProcessType.COMPOUNDING]: 'compoundingParams',
      [ProcessType.FILTRATION]: 'filtrationParams',
      [ProcessType.TRANSFER]: 'transferParams',
      [ProcessType.FLAVOR_ADDITION]: 'flavorAdditionParams',
    };

    if (subStep.processType === ProcessType.OTHER) {
      // OTHER uses 'params' directly as string, but handle if it becomes structured
      if (key === 'params') return (subStep.params as any).params;
      return null;
    }

    const groupKey = paramKeyMaps[subStep.processType];
    if (!groupKey || !(subStep.params as any)[groupKey]) return null;
    return (subStep.params as any)[groupKey][key];
  };

  // Special handling for Compounding input sources (presuming this is custom logic not in fields)
  const renderCompoundingExtras = () => {
    if (subStep.processType === ProcessType.COMPOUNDING && inputSources && inputSources.length > 0) {
      return (
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
      );
    }
    return null;
  };


  const renderFieldValue = (config: FieldConfig, value: any) => {
    if (value === undefined || value === null) return null;

    let displayValue = '';

    if (config.inputType === 'select' && config.options) {
      const opt = config.options.find((o: any) => o.value === value);
      displayValue = opt ? opt.label : value;
    } else if (config.inputType === 'conditionValue') {
      displayValue = formatConditionValue(value);
    } else if (config.inputType === 'range' || config.inputType === 'waterRatio') {
      // Re-use formatTemperature logic but generic
      if (value.min !== undefined && value.max !== undefined) {
        displayValue = `${value.min}-${value.max}`;
      } else if (value.min !== undefined) {
        displayValue = `≥${value.min}`;
      } else if (value.max !== undefined) {
        displayValue = `≤${value.max}`;
      }
      if (config.unit) displayValue += config.unit;
    } else {
      // Text, number
      displayValue = String(value);
      if (config.unit) displayValue += config.unit;
    }

    return displayValue;
  };

  if (subStep.processType === ProcessType.OTHER) {
    return (
      <div className="text-xs text-gray-700 font-mono">
        <span className="font-medium">参数:</span> {getParamValue('params')}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {renderCompoundingExtras()}
      {configs.map(config => {
        const val = getParamValue(config.key);
        if (val === undefined || val === null) return null;
        return (
          <div key={config.key} className="text-xs text-gray-700">
            <span className="font-medium">{config.label}:</span> {renderFieldValue(config, val)}
          </div>
        );
      })}
    </div>
  );
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
          {/* Use new component */}
          <SubStepParamsDisplay subStep={subStep} inputSources={data.inputSources} />

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
