import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useRecipeStore } from '@/store/useRecipeStore';
import { ProcessType, ConditionType, StirringRate, TransferType } from '@/types/recipe';

interface ParamsModalProps {
  nodeId: string; // 保持参数名兼容，但实际是 subStepId
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ParamsModal({ nodeId, open, onOpenChange }: ParamsModalProps) {
  const { processes, updateSubStep } = useRecipeStore();
  const subStepId = nodeId; // nodeId 实际是子步骤ID
  
  // 查找包含该子步骤的工艺段
  const process = processes.find(p => 
    p.node.subSteps.some(s => s.id === subStepId)
  );
  const subStep = process?.node.subSteps.find(s => s.id === subStepId);
  
  const [formData, setFormData] = useState<any>({});

  // 初始化表单数据
  useEffect(() => {
    if (!subStep || !process) return;
    
    switch (subStep.processType) {
      case ProcessType.DISSOLUTION:
        if ('dissolutionParams' in subStep.params) {
          setFormData({
            waterVolume: subStep.params.dissolutionParams.waterVolume.value,
            waterVolumeUnit: subStep.params.dissolutionParams.waterVolume.unit,
            waterVolumeCondition: subStep.params.dissolutionParams.waterVolume.condition || '>=',
            waterTempMin: subStep.params.dissolutionParams.waterTemp.min,
            waterTempMax: subStep.params.dissolutionParams.waterTemp.max,
            waterTempUnit: subStep.params.dissolutionParams.waterTemp.unit,
            stirringTime: subStep.params.dissolutionParams.stirringTime.value,
            stirringTimeUnit: subStep.params.dissolutionParams.stirringTime.unit,
            stirringRate: subStep.params.dissolutionParams.stirringRate,
            transferType: subStep.params.dissolutionParams.transferType,
          });
        }
        break;
      case ProcessType.COMPOUNDING:
        if ('compoundingParams' in subStep.params) {
          setFormData({
            stirringSpeed: subStep.params.compoundingParams.stirringSpeed.value,
            stirringSpeedUnit: subStep.params.compoundingParams.stirringSpeed.unit,
            stirringSpeedCondition: subStep.params.compoundingParams.stirringSpeed.condition || '>=',
            stirringTime: subStep.params.compoundingParams.stirringTime.value,
            stirringTimeUnit: subStep.params.compoundingParams.stirringTime.unit,
            finalTempMax: subStep.params.compoundingParams.finalTemp.max,
            finalTempUnit: subStep.params.compoundingParams.finalTemp.unit,
            additives: subStep.params.compoundingParams.additives,
          });
        }
        break;
      case ProcessType.FILTRATION:
        if ('filtrationParams' in subStep.params) {
          setFormData({
            precision: subStep.params.filtrationParams.precision.value,
            precisionUnit: subStep.params.filtrationParams.precision.unit,
          });
        }
        break;
      case ProcessType.TRANSFER:
        if ('transferParams' in subStep.params) {
          setFormData({
            transferType: subStep.params.transferParams.transferType,
            waterVolume: subStep.params.transferParams.waterVolume?.value,
            waterVolumeUnit: subStep.params.transferParams.waterVolume?.unit,
            cleaning: subStep.params.transferParams.cleaning || '',
          });
        }
        break;
      case ProcessType.FLAVOR_ADDITION:
        if ('flavorAdditionParams' in subStep.params) {
          setFormData({
            method: subStep.params.flavorAdditionParams.method,
          });
        }
        break;
      case ProcessType.OTHER:
        if ('params' in subStep.params) {
          setFormData({
            params: subStep.params.params || '',
          });
        }
        break;
    }
  }, [subStep, process, open]);

  const handleSave = () => {
    if (!subStep || !process) return;

    let updateParams: any = {};

    switch (subStep.processType) {
      case ProcessType.DISSOLUTION:
        updateParams = {
          processType: ProcessType.DISSOLUTION,
          dissolutionParams: {
            waterVolume: {
              value: Number(formData.waterVolume),
              unit: formData.waterVolumeUnit || 'L',
              condition: formData.waterVolumeCondition as ConditionType,
            },
            waterTemp: {
              min: formData.waterTempMin ? Number(formData.waterTempMin) : undefined,
              max: formData.waterTempMax ? Number(formData.waterTempMax) : undefined,
              unit: '℃' as const,
            },
            stirringTime: {
              value: Number(formData.stirringTime),
              unit: 'min' as const,
            },
            stirringRate: formData.stirringRate as StirringRate,
            transferType: formData.transferType as TransferType,
          },
        };
        break;
      case ProcessType.COMPOUNDING:
        updateParams = {
          processType: ProcessType.COMPOUNDING,
          compoundingParams: {
            additives: formData.additives || [],
            stirringSpeed: {
              value: Number(formData.stirringSpeed),
              unit: formData.stirringSpeedUnit || '%',
              condition: formData.stirringSpeedCondition as ConditionType,
            },
            stirringTime: {
              value: Number(formData.stirringTime),
              unit: 'min' as const,
            },
            finalTemp: {
              max: Number(formData.finalTempMax),
              unit: '℃' as const,
            },
          },
        };
        break;
      case ProcessType.FILTRATION:
        updateParams = {
          processType: ProcessType.FILTRATION,
          filtrationParams: {
            precision: {
              value: Number(formData.precision),
              unit: 'μm' as const,
            },
          },
        };
        break;
      case ProcessType.TRANSFER:
        updateParams = {
          processType: ProcessType.TRANSFER,
          transferParams: {
            transferType: formData.transferType as TransferType,
            waterVolume: formData.waterVolume ? {
              value: Number(formData.waterVolume),
              unit: formData.waterVolumeUnit || 'L',
            } : undefined,
            cleaning: formData.cleaning || undefined,
          },
        };
        break;
      case ProcessType.FLAVOR_ADDITION:
        updateParams = {
          processType: ProcessType.FLAVOR_ADDITION,
          flavorAdditionParams: {
            method: formData.method || '',
          },
        };
        break;
      case ProcessType.OTHER:
        updateParams = {
          processType: ProcessType.OTHER,
          params: formData.params || '',
        };
        break;
    }

    updateSubStep(process.id, subStepId, { params: updateParams });
    onOpenChange(false);
  };

  if (!subStep || !process) return null;

  const renderForm = () => {
    switch (subStep.processType) {
      case ProcessType.DISSOLUTION:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>水量条件</Label>
                <Select
                  value={formData.waterVolumeCondition || '>='}
                  onValueChange={(value) => setFormData({ ...formData, waterVolumeCondition: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value=">=">≥</SelectItem>
                    <SelectItem value=">">&gt;</SelectItem>
                    <SelectItem value="<=">≤</SelectItem>
                    <SelectItem value="<">&lt;</SelectItem>
                    <SelectItem value="=">=</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>水量</Label>
                <Input
                  type="number"
                  value={formData.waterVolume || ''}
                  onChange={(e) => setFormData({ ...formData, waterVolume: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>单位</Label>
                <Input value="L" disabled />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>最低水温</Label>
                <Input
                  type="number"
                  value={formData.waterTempMin || ''}
                  onChange={(e) => setFormData({ ...formData, waterTempMin: e.target.value })}
                  placeholder="可选"
                />
              </div>
              <div className="space-y-2">
                <Label>最高水温</Label>
                <Input
                  type="number"
                  value={formData.waterTempMax || ''}
                  onChange={(e) => setFormData({ ...formData, waterTempMax: e.target.value })}
                  placeholder="可选"
                />
              </div>
              <div className="space-y-2">
                <Label>单位</Label>
                <Input value="℃" disabled />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>搅拌时间</Label>
                <Input
                  type="number"
                  value={formData.stirringTime || ''}
                  onChange={(e) => setFormData({ ...formData, stirringTime: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>单位</Label>
                <Input value="min" disabled />
              </div>
            </div>
            <div className="space-y-2">
              <Label>搅拌速率</Label>
              <Select
                value={formData.stirringRate || 'high'}
                onValueChange={(value) => setFormData({ ...formData, stirringRate: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">高速</SelectItem>
                  <SelectItem value="medium">中速</SelectItem>
                  <SelectItem value="low">低速</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>赶料类型</Label>
              <Select
                value={formData.transferType || 'none'}
                onValueChange={(value) => setFormData({ ...formData, transferType: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="material">料赶料</SelectItem>
                  <SelectItem value="water">水赶料</SelectItem>
                  <SelectItem value="none">无</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case ProcessType.COMPOUNDING:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>搅拌速度条件</Label>
                <Select
                  value={formData.stirringSpeedCondition || '>='}
                  onValueChange={(value) => setFormData({ ...formData, stirringSpeedCondition: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value=">=">≥</SelectItem>
                    <SelectItem value=">">&gt;</SelectItem>
                    <SelectItem value="<=">≤</SelectItem>
                    <SelectItem value="<">&lt;</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>搅拌速度</Label>
                <Input
                  type="number"
                  value={formData.stirringSpeed || ''}
                  onChange={(e) => setFormData({ ...formData, stirringSpeed: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>单位</Label>
                <Input value="%" disabled />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>搅拌时间</Label>
                <Input
                  type="number"
                  value={formData.stirringTime || ''}
                  onChange={(e) => setFormData({ ...formData, stirringTime: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>单位</Label>
                <Input value="min" disabled />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>最终温度（最大值）</Label>
                <Input
                  type="number"
                  value={formData.finalTempMax || ''}
                  onChange={(e) => setFormData({ ...formData, finalTempMax: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>单位</Label>
                <Input value="℃" disabled />
              </div>
            </div>
            <div className="space-y-2">
              <Label>添加物列表</Label>
              <div className="text-sm text-gray-500">
                添加物配置需要在节点编辑中完成
              </div>
            </div>
          </div>
        );

      case ProcessType.FILTRATION:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>过滤精度</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.precision || ''}
                  onChange={(e) => setFormData({ ...formData, precision: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>单位</Label>
                <Input value="μm" disabled />
              </div>
            </div>
          </div>
        );

      case ProcessType.TRANSFER:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>赶料类型</Label>
              <Select
                value={formData.transferType || 'none'}
                onValueChange={(value) => setFormData({ ...formData, transferType: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="material">料赶料</SelectItem>
                  <SelectItem value="water">水赶料</SelectItem>
                  <SelectItem value="none">无</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formData.transferType === 'water' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>水量</Label>
                  <Input
                    type="number"
                    value={formData.waterVolume || ''}
                    onChange={(e) => setFormData({ ...formData, waterVolume: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>单位</Label>
                  <Input value="L" disabled />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>清洗要求</Label>
              <Textarea
                value={formData.cleaning || ''}
                onChange={(e) => setFormData({ ...formData, cleaning: e.target.value })}
                placeholder="可选"
                rows={3}
              />
            </div>
          </div>
        );

      case ProcessType.FLAVOR_ADDITION:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>添加方式</Label>
              <Input
                value={formData.method || ''}
                onChange={(e) => setFormData({ ...formData, method: e.target.value })}
                placeholder="如：按配方投料"
              />
            </div>
          </div>
        );

      case ProcessType.OTHER:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>参数</Label>
              <Textarea
                value={formData.params || ''}
                onChange={(e) => setFormData({ ...formData, params: e.target.value })}
                placeholder="输入参数描述"
                rows={5}
              />
            </div>
          </div>
        );

      default:
        return <div className="text-gray-500">未知的工艺类型</div>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>编辑关键参数 - {subStep?.id}</DialogTitle>
          <DialogDescription>
            {subStep?.label} - {getProcessTypeLabel(subStep?.processType)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {renderForm()}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSave}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function getProcessTypeLabel(processType?: ProcessType): string {
  const labels: Record<ProcessType, string> = {
    [ProcessType.DISSOLUTION]: '溶解',
    [ProcessType.COMPOUNDING]: '调配',
    [ProcessType.FILTRATION]: '过滤',
    [ProcessType.TRANSFER]: '赶料',
    [ProcessType.FLAVOR_ADDITION]: '香精添加',
    [ProcessType.OTHER]: '其他',
  };
  return processType ? labels[processType] : '未知';
}
