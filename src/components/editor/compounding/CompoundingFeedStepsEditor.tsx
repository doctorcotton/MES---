import { useEffect, useState, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FeedStepList } from './FeedStepList';
import { FeedStepDetail } from './FeedStepDetail';
import {
  CompoundingFeedStep,
  CompoundingFeedStepWater,
  CompoundingFeedStepFromProcess,
  CompoundingFeedStepStir,
  CompoundingFeedStepManual,
} from '@/types/recipe';
import { getAvailableSourceProcesses } from '@/utils/compounding';
import { useRecipeStore } from '@/store/useRecipeStore';

interface CompoundingFeedStepsEditorProps {
  feedSteps: CompoundingFeedStep[];
  currentProcessId: string;
  onChange: (steps: CompoundingFeedStep[]) => void;
}

export function CompoundingFeedStepsEditor({
  feedSteps,
  currentProcessId,
  onChange,
}: CompoundingFeedStepsEditorProps) {
  const { processes } = useRecipeStore();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(
    feedSteps.length > 0 ? 0 : null
  );
  const [localSteps, setLocalSteps] = useState<CompoundingFeedStep[]>(feedSteps);

  // 关键：当父组件异步初始化/更新 feedSteps 时，同步到本地 state
  // 否则首次打开弹窗会先渲染空数组，切换 Tab 触发重挂载后才显示。
  useEffect(() => {
    setLocalSteps(feedSteps);
    setSelectedIndex((prev) => {
      if (feedSteps.length === 0) return null;
      if (prev === null) return 0;
      return Math.min(prev, feedSteps.length - 1);
    });
  }, [feedSteps]);

  const availableProcesses = getAvailableSourceProcesses(
    currentProcessId,
    processes
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
        delay: 150,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleStepsChange = useCallback(
    (newSteps: CompoundingFeedStep[]) => {
      setLocalSteps(newSteps);
      onChange(newSteps);
      // 如果选中的步骤被删除，调整选中索引
      if (selectedIndex !== null && selectedIndex >= newSteps.length) {
        setSelectedIndex(newSteps.length > 0 ? newSteps.length - 1 : null);
      }
    },
    [onChange, selectedIndex]
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = localSteps.findIndex((_, i) => `step-${i}` === active.id);
    const newIndex = localSteps.findIndex((_, i) => `step-${i}` === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newSteps = [...localSteps];
      const [moved] = newSteps.splice(oldIndex, 1);
      newSteps.splice(newIndex, 0, moved);
      handleStepsChange(newSteps);
      // 更新选中索引
      if (selectedIndex === oldIndex) {
        setSelectedIndex(newIndex);
      } else if (selectedIndex !== null) {
        // 调整其他选中索引
        if (oldIndex < selectedIndex && newIndex >= selectedIndex) {
          setSelectedIndex(selectedIndex - 1);
        } else if (oldIndex > selectedIndex && newIndex <= selectedIndex) {
          setSelectedIndex(selectedIndex + 1);
        }
      }
    }
  };

  const handleAddStep = (kind: 'water' | 'fromProcess' | 'stir' | 'manual') => {
    let newStep: CompoundingFeedStep;

    switch (kind) {
      case 'water':
        newStep = {
          kind: 'water',
          waterName: 'RO水',
          amount: { mode: 'percent', min: 10, max: 20 },
        } as CompoundingFeedStepWater;
        break;
      case 'fromProcess':
        if (availableProcesses.length === 0) {
          // 如果没有可用工艺段，提示用户
          alert('当前没有可用的前序工艺段');
          return;
        }
        newStep = {
          kind: 'fromProcess',
          sourceProcessId: availableProcesses[0]?.id || '',
          name: '',
        } as CompoundingFeedStepFromProcess;
        break;
      case 'stir':
        newStep = {
          kind: 'stir',
          durationMin: 3,
          speed: { value: 90, unit: 'percent' },
        } as CompoundingFeedStepStir;
        break;
      case 'manual':
        newStep = {
          kind: 'manual',
          title: '手动步骤',
          note: '',
        } as CompoundingFeedStepManual;
        break;
    }

    const newSteps = [...localSteps, newStep];
    handleStepsChange(newSteps);
    setSelectedIndex(newSteps.length - 1);
  };

  const handleDeleteStep = (index: number) => {
    const newSteps = localSteps.filter((_, i) => i !== index);
    handleStepsChange(newSteps);
  };

  const handleDuplicateStep = (index: number) => {
    const step = localSteps[index];
    const newSteps = [...localSteps];
    newSteps.splice(index + 1, 0, { ...step });
    handleStepsChange(newSteps);
    setSelectedIndex(index + 1);
  };

  const handleInsertAfter = (index: number) => {
    // 在当前步骤后插入一个默认的加水步骤
    const newStep: CompoundingFeedStep = {
      kind: 'water',
      waterName: 'RO水',
      amount: { mode: 'percent', min: 10, max: 20 },
    } as CompoundingFeedStepWater;
    const newSteps = [...localSteps];
    newSteps.splice(index + 1, 0, newStep);
    handleStepsChange(newSteps);
    setSelectedIndex(index + 1);
  };

  const handleStepChange = (updatedStep: CompoundingFeedStep) => {
    if (selectedIndex === null) return;
    const newSteps = [...localSteps];
    newSteps[selectedIndex] = updatedStep;
    handleStepsChange(newSteps);
  };

  const getStepId = (index: number) => `step-${index}`;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-medium">进料顺序</h4>
        <div className="flex items-center gap-2">
          <Select
            onValueChange={(value) =>
              handleAddStep(value as 'water' | 'fromProcess' | 'stir' | 'manual')
            }
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="添加步骤" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="water">加水</SelectItem>
              <SelectItem value="fromProcess">引用前序工艺段</SelectItem>
              <SelectItem value="stir">搅拌</SelectItem>
              <SelectItem value="manual">手动步骤</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
        {/* 左侧：步骤列表 */}
        <div className="flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto pr-2">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={localSteps.map((_, i) => getStepId(i))}
                strategy={verticalListSortingStrategy}
              >
                <FeedStepList
                  steps={localSteps}
                  selectedIndex={selectedIndex}
                  onSelect={setSelectedIndex}
                  onDelete={handleDeleteStep}
                  onDuplicate={handleDuplicateStep}
                  onInsertAfter={handleInsertAfter}
                  getStepId={getStepId}
                />
              </SortableContext>
            </DndContext>
          </div>
        </div>

        {/* 右侧：步骤详情编辑 */}
        <div className="flex flex-col min-h-0 border-l pl-4">
          <div className="flex-1 overflow-y-auto overflow-x-visible px-2">
            <FeedStepDetail
              step={selectedIndex !== null ? localSteps[selectedIndex] : null}
              availableProcesses={availableProcesses}
              usedProcessIds={localSteps
                .filter((s): s is CompoundingFeedStepFromProcess => s.kind === 'fromProcess')
                .map(s => s.sourceProcessId)}
              onChange={handleStepChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
