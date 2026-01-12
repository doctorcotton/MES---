import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Trash2, Copy, GripVertical } from 'lucide-react';
import { CompoundingFeedStep } from '@/types/recipe';
import { cn } from '@/lib/utils';

interface FeedStepListProps {
  steps: CompoundingFeedStep[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  onDelete: (index: number) => void;
  onDuplicate: (index: number) => void;
  onInsertAfter?: (index: number) => void;
  getStepId: (index: number) => string;
}

interface SortableStepItemProps {
  step: CompoundingFeedStep;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onInsertAfter: () => void;
  stepId: string;
}

function SortableStepItem({
  step,
  index,
  isSelected,
  onSelect,
  onDelete,
  onDuplicate,
  onInsertAfter,
  stepId,
}: SortableStepItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stepId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getStepLabel = (step: CompoundingFeedStep): string => {
    if (step.kind === 'water') {
      const amountStr =
        step.amount.mode === 'L'
          ? step.amount.value !== undefined
            ? `${step.amount.value}L`
            : '未设置'
          : step.amount.min !== undefined && step.amount.max !== undefined
          ? `${step.amount.min}%-${step.amount.max}%`
          : step.amount.value !== undefined
          ? `${step.amount.value}%`
          : '未设置';
      return `${step.waterName || 'RO水'} (${amountStr})`;
    } else if (step.kind === 'fromProcess') {
      return `${step.name || `来自${step.sourceProcessId}`} (全量)`;
    } else if (step.kind === 'stir') {
      const duration = step.durationMin ? `${step.durationMin}分钟` : '未设置时长';
      const speed = step.speed?.value
        ? `${step.speed.value}${step.speed.unit === 'percent' ? '%' : 'rpm'}`
        : '';
      return `搅拌 ${duration}${speed ? ` @ ${speed}` : ''}`;
    } else if (step.kind === 'manual') {
      return step.title;
    }
    return '未知步骤';
  };

  const getStepBadgeColor = (step: CompoundingFeedStep): string => {
    switch (step.kind) {
      case 'water':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'fromProcess':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'stir':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'manual':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStepKindLabel = (step: CompoundingFeedStep): string => {
    switch (step.kind) {
      case 'water':
        return '加水';
      case 'fromProcess':
        return '前序';
      case 'stir':
        return '搅拌';
      case 'manual':
        return '手动';
      default:
        return '未知';
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors group',
        isSelected
          ? 'bg-blue-50 border-blue-300'
          : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'
      )}
      onClick={onSelect}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
      >
        <GripVertical className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-gray-500 w-6">#{index + 1}</span>
          <span
            className={cn(
              'text-xs px-1.5 py-0.5 rounded border',
              getStepBadgeColor(step)
            )}
          >
            {getStepKindLabel(step)}
          </span>
          <span className="text-sm truncate">{getStepLabel(step)}</span>
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate();
          }}
          title="复制"
        >
          <Copy className="w-3 h-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-red-500 hover:text-red-700"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="删除"
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

export function FeedStepList({
  steps,
  selectedIndex,
  onSelect,
  onDelete,
  onDuplicate,
  onInsertAfter,
  getStepId,
}: FeedStepListProps) {
  return (
    <div className="space-y-2">
      {steps.map((step, index) => (
        <SortableStepItem
          key={getStepId(index)}
          step={step}
          index={index}
          isSelected={selectedIndex === index}
          onSelect={() => onSelect(index)}
          onDelete={() => onDelete(index)}
          onDuplicate={() => onDuplicate(index)}
          onInsertAfter={() => onInsertAfter(index)}
          stepId={getStepId(index)}
        />
      ))}
      {steps.length === 0 && (
        <div className="text-center py-8 text-gray-400 text-sm">
          暂无步骤，点击下方按钮添加
        </div>
      )}
    </div>
  );
}
