import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { cn } from '@/lib/utils';
import { RecipeNode, ProcessType } from '@/types/recipe';
import { useRecipeStore } from '@/store/useRecipeStore';

type CustomNodeData = RecipeNode['data'];

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

// 渲染参数内容
const renderParams = (data: CustomNodeData) => {
  switch (data.processType) {
    case ProcessType.DISSOLUTION:
      if ('dissolutionParams' in data) {
        const params = data.dissolutionParams;
        const tempStr = formatTemperature(params.waterTemp);
        const volumeStr = formatConditionValue(params.waterVolume);
        const rateMap: Record<string, string> = { high: '高速', medium: '中速', low: '低速' };
        const transferMap: Record<string, string> = { material: '料赶料', water: '水赶料', none: '无' };
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
            <div className="text-xs text-gray-700">
              <span className="font-medium">赶料:</span> {transferMap[params.transferType]}
            </div>
          </div>
        );
      }
      break;

    case ProcessType.COMPOUNDING:
      if ('compoundingParams' in data) {
        const params = data.compoundingParams;
        const speedStr = formatConditionValue(params.stirringSpeed);
        return (
          <div className="space-y-1">
            <div className="text-xs text-gray-700">
              <span className="font-medium">添加物:</span> {params.additives.length}项
            </div>
            <div className="text-xs text-gray-700">
              <span className="font-medium">搅拌:</span> {speedStr} {params.stirringTime.value}{params.stirringTime.unit}
            </div>
            <div className="text-xs text-gray-700">
              <span className="font-medium">温度:</span> &lt;{params.finalTemp.max}{params.finalTemp.unit}
            </div>
          </div>
        );
      }
      break;

    case ProcessType.FILTRATION:
      if ('filtrationParams' in data) {
        const params = data.filtrationParams;
        return (
          <div className="text-xs text-gray-700">
            <span className="font-medium">精度:</span> {params.precision.value}{params.precision.unit}
          </div>
        );
      }
      break;

    case ProcessType.TRANSFER:
      if ('transferParams' in data) {
        const params = data.transferParams;
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
            {params.cleaning && (
              <div className="text-xs text-gray-700">
                <span className="font-medium">清洗:</span> {params.cleaning}
              </div>
            )}
          </div>
        );
      }
      break;

    case ProcessType.FLAVOR_ADDITION:
      if ('flavorAdditionParams' in data) {
        return (
          <div className="text-xs text-gray-700">
            <span className="font-medium">方式:</span> {data.flavorAdditionParams.method}
          </div>
        );
      }
      break;

    case ProcessType.OTHER:
    default:
      if ('params' in data && data.params) {
        return (
          <div className="text-xs text-gray-700 font-mono">
            <span className="font-medium">参数:</span> {data.params}
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

export const CustomNode = memo(({ id, data, selected }: NodeProps<CustomNodeData>) => {
  const hoveredNodeId = useRecipeStore((state) => state.hoveredNodeId);
  const edges = useRecipeStore((state) => state.edges);
  const isHovered = hoveredNodeId === id;

  // 获取输入边数量
  const incomingEdges = edges.filter(edge => edge.target === id);
  const inputCount = incomingEdges.length;

  // 根据工艺类型获取头部颜色
  const headerColor = getNodeHeaderColor(data.processType);

  return (
    <div
      className={cn(
        'rounded-lg border-2 bg-white shadow-md transition-all',
        isHovered ? 'border-blue-500 shadow-lg' : 'border-gray-300',
        selected && 'ring-2 ring-blue-400'
      )}
      style={{ minWidth: '200px', width: '100%' }}
    >
      {/* Header - 根据工艺类型显示不同颜色 */}
      <div className={cn('rounded-t-lg px-3 py-2', headerColor)}>
        <div className="font-bold text-white">
          <span className="text-sm">{id}</span>
          <span className="ml-2">{data.label}</span>
        </div>
      </div>

      {/* Body - 白色背景 */}
      <div className="px-3 py-2 space-y-1">
        <div className="text-xs text-gray-600">
          <span className="font-medium">位置:</span> {data.deviceCode}
        </div>
        <div className="text-xs text-gray-600">
          <span className="font-medium">原料:</span> {data.ingredients}
        </div>
        {renderParams(data)}
      </div>

      {/* Handles */}
      {inputCount <= 1 ? (
        <Handle type="target" position={Position.Top} className="w-3 h-3 bg-gray-400" />
      ) : (
        // 固定渲染 inputCount 个 handles，ID 为 target-0 到 target-N-1
        // 这样 useAutoLayout 分配的 targetHandle 就能精确匹配到实际渲染的 handle ID
        Array.from({ length: inputCount }).map((_, index) => {
          // 计算分布：增加两侧 15% 的 padding，中间均匀分布
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
});

CustomNode.displayName = 'CustomNode';
