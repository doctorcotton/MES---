import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CompoundingFeedStep,
  CompoundingFeedStepWater,
  CompoundingFeedStepFromProcess,
  CompoundingFeedStepStir,
  CompoundingFeedStepManual,
  Process,
} from '@/types/recipe';

interface FeedStepDetailProps {
  step: CompoundingFeedStep | null;
  availableProcesses: Process[];
  usedProcessIds: string[]; // 已经被其他步骤使用的前序工艺段 ID
  onChange: (step: CompoundingFeedStep) => void;
}

export function FeedStepDetail({
  step,
  availableProcesses,
  usedProcessIds,
  onChange,
}: FeedStepDetailProps) {
  if (!step) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        请选择一个步骤进行编辑
      </div>
    );
  }

  const handleChange = (updates: Partial<CompoundingFeedStep>) => {
    onChange({ ...step, ...updates } as CompoundingFeedStep);
  };

  if (step.kind === 'water') {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>水名称</Label>
          <Input
            value={step.waterName || ''}
            onChange={(e) =>
              handleChange({ waterName: e.target.value } as Partial<CompoundingFeedStepWater>)
            }
            placeholder="如：RO水"
          />
        </div>
        <div className="space-y-2">
          <Label>添加方式</Label>
          <Select
            value={step.amount.mode}
            onValueChange={(mode: 'L' | 'percent') =>
              handleChange({
                amount: { ...step.amount, mode },
              } as Partial<CompoundingFeedStepWater>)
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="L">升数 (L)</SelectItem>
              <SelectItem value="percent">百分比 (%)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {step.amount.mode === 'L' ? (
          <div className="space-y-2">
            <Label>升数</Label>
            <Input
              type="number"
              value={step.amount.value || ''}
              onChange={(e) =>
                handleChange({
                  amount: {
                    ...step.amount,
                    value: e.target.value ? parseFloat(e.target.value) : undefined,
                  },
                } as Partial<CompoundingFeedStepWater>)
              }
              placeholder="输入升数"
            />
          </div>
        ) : (
          <div className="max-w-[320px]">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>最小百分比</Label>
                <Input
                  type="number"
                  className="w-28 focus-visible:ring-1 focus-visible:ring-offset-0"
                  value={step.amount.min || ''}
                  onChange={(e) =>
                    handleChange({
                      amount: {
                        ...step.amount,
                        min: e.target.value ? parseFloat(e.target.value) : undefined,
                      },
                    } as Partial<CompoundingFeedStepWater>)
                  }
                  placeholder="最小值"
                />
              </div>
              <div className="space-y-2">
                <Label>最大百分比</Label>
                <Input
                  type="number"
                  className="w-28 focus-visible:ring-1 focus-visible:ring-offset-0"
                  value={step.amount.max || ''}
                  onChange={(e) =>
                    handleChange({
                      amount: {
                        ...step.amount,
                        max: e.target.value ? parseFloat(e.target.value) : undefined,
                      },
                    } as Partial<CompoundingFeedStepWater>)
                  }
                  placeholder="最大值"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (step.kind === 'fromProcess') {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>来源工艺段</Label>
          <Select
            value={step.sourceProcessId}
            onValueChange={(sourceProcessId) =>
              handleChange({ sourceProcessId } as Partial<CompoundingFeedStepFromProcess>)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="选择工艺段" />
            </SelectTrigger>
            <SelectContent>
              {availableProcesses.map((process) => {
                // 如果这个工艺段已被其他步骤使用，且不是当前步骤选中的，则禁用
                const isUsedByOthers = usedProcessIds.includes(process.id) &&
                  process.id !== step.sourceProcessId;
                return (
                  <SelectItem
                    key={process.id}
                    value={process.id}
                    disabled={isUsedByOthers}
                  >
                    {process.id} - {process.name}
                    {isUsedByOthers && ' (已添加)'}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>显示名称（可选）</Label>
          <Input
            value={step.name || ''}
            onChange={(e) =>
              handleChange({ name: e.target.value } as Partial<CompoundingFeedStepFromProcess>)
            }
            placeholder="如：赤藓糖醇、三氯蔗糖溶解液"
          />
        </div>
        <div className="text-xs text-gray-500 bg-blue-50 p-2 rounded">
          注意：引用前序工艺段将添加全部量，无需配置百分比
        </div>
      </div>
    );
  }

  if (step.kind === 'stir') {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>搅拌时长（分钟）</Label>
          <Input
            type="number"
            value={step.durationMin || ''}
            onChange={(e) =>
              handleChange({
                durationMin: e.target.value ? parseFloat(e.target.value) : undefined,
              } as Partial<CompoundingFeedStepStir>)
            }
            placeholder="输入分钟数"
          />
        </div>
        <div className="space-y-2">
          <Label>搅拌速度单位</Label>
          <Select
            value={step.speed?.unit || 'percent'}
            onValueChange={(unit: 'percent' | 'rpm') =>
              handleChange({
                speed: { ...step.speed, unit },
              } as Partial<CompoundingFeedStepStir>)
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="percent">百分比 (%)</SelectItem>
              <SelectItem value="rpm">转速 (rpm)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>速度值</Label>
          <Input
            type="number"
            value={step.speed?.value || ''}
            onChange={(e) =>
              handleChange({
                speed: {
                  ...step.speed,
                  value: e.target.value ? parseFloat(e.target.value) : undefined,
                },
              } as Partial<CompoundingFeedStepStir>)
            }
            placeholder="输入速度值"
          />
        </div>
      </div>
    );
  }

  if (step.kind === 'manual') {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>步骤标题</Label>
          <Input
            value={step.title}
            onChange={(e) =>
              handleChange({ title: e.target.value } as Partial<CompoundingFeedStepManual>)
            }
            placeholder="如：调整理化，定容"
          />
        </div>
        <div className="space-y-2">
          <Label>备注说明（可选）</Label>
          <Input
            value={step.note || ''}
            onChange={(e) =>
              handleChange({ note: e.target.value } as Partial<CompoundingFeedStepManual>)
            }
            placeholder="输入备注"
          />
        </div>
      </div>
    );
  }

  return null;
}
