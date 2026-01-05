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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRecipeStore } from '@/store/useRecipeStore';
import { ProcessType, getEquipmentConfig, getMaterials } from '@/types/recipe';
import { MaterialSpec } from '@/types/material';
import { PROCESS_TYPE_FIELDS } from '@/types/processTypeConfig';

import { useFieldConfigStore } from '@/store/useFieldConfigStore';
import { DynamicFormRenderer } from '@/components/common/DynamicForm/DynamicFormRenderer';

interface ParamsModalProps {
  nodeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PARAM_KEYS: Record<string, string> = {
  [ProcessType.DISSOLUTION]: 'dissolutionParams',
  [ProcessType.COMPOUNDING]: 'compoundingParams',
  [ProcessType.FILTRATION]: 'filtrationParams',
  [ProcessType.TRANSFER]: 'transferParams',
  [ProcessType.FLAVOR_ADDITION]: 'flavorAdditionParams',
  [ProcessType.OTHER]: 'params',
};

export function ParamsModal({ nodeId, open, onOpenChange }: ParamsModalProps) {
  const { processes, updateSubStep } = useRecipeStore();
  const subStepId = nodeId;

  const process = processes.find(p =>
    p.node.subSteps.some(s => s.id === subStepId)
  );
  const subStep = process?.node.subSteps.find(s => s.id === subStepId);

  const { configs, fetchConfigs, getConfigsByProcessType } = useFieldConfigStore();
  const [formData, setFormData] = useState<any>({});
  const [currentConfigs, setCurrentConfigs] = useState<any[]>([]);

  useEffect(() => {
    fetchConfigs();
  }, []);

  useEffect(() => {
    if (!subStep || !process) return;

    // Filter configs for this type, with fallback
    const relevantConfigs = getConfigsByProcessType(subStep.processType);
    if (relevantConfigs.length > 0) {
      setCurrentConfigs(relevantConfigs);
    } else {
      // Fallback to hardcoded configs
      const fallbackConfigs = PROCESS_TYPE_FIELDS[subStep.processType]?.map((f, index) => ({
        id: `fallback-${f.key}`,
        processType: subStep.processType,
        key: f.key,
        label: f.label,
        inputType: f.inputType,
        unit: f.unit,
        options: f.options,
        defaultValue: f.defaultValue,
        validation: { required: f.required },
        sortOrder: index,
        isSystem: true,
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })) || [];
      setCurrentConfigs(fallbackConfigs);
    }

    // Initial data loading
    const equipmentV2 = getEquipmentConfig(subStep);
    const materialsV2 = getMaterials(subStep);
    const operationsV2 = subStep.operationsV2;

    const commonV2 = {
      equipmentV2,
      materialsV2,
      operationsV2,
    };

    // Scheduling data
    const schedulingData = {
      deviceRequirement: subStep.deviceRequirement,
      estimatedDuration: subStep.estimatedDuration,
      canParallelWith: subStep.canParallelWith,
      mustAfter: subStep.mustAfter
    };

    // Load params
    const paramKey = PARAM_KEYS[subStep.processType];
    const params: any = (subStep.params as any)[paramKey] || {};

    // Flatten params for form: { key: value }
    // Since DynamicFormRenderer expects keys to match config keys
    // And store param object structure matches config keys (mostly)
    // We can just spread params. 
    // EXCEPT "params" for OTHER type is a string, handle that.

    let formParams = {};
    if (subStep.processType === ProcessType.OTHER) {
      formParams = { params: (subStep.params as any).params };
    } else {
      formParams = { ...params };
    }

    setFormData({
      ...commonV2,
      ...schedulingData,
      ...formParams
    });

  }, [subStep, process, open, configs]); // Added configs dependency

  const handleSave = () => {
    if (!subStep || !process) return;

    const paramKey = PARAM_KEYS[subStep.processType];

    // Reconstruct nested params from flat formData
    const newParams: any = {};

    currentConfigs.forEach(config => {
      if (formData[config.key] !== undefined) {
        newParams[config.key] = formData[config.key];
      }
    });

    let updateData: any = {};

    // Handle specific structure for ProcessNodeData
    if (subStep.processType === ProcessType.OTHER) {
      updateData.params = {
        processType: subStep.processType,
        params: newParams.params || ''
      };
    } else {
      updateData.params = {
        processType: subStep.processType,
        [paramKey]: newParams
      };
    }

    // Scheduling and Layout updates
    if (formData.deviceRequirement) updateData.deviceRequirement = formData.deviceRequirement;
    if (formData.estimatedDuration) updateData.estimatedDuration = formData.estimatedDuration;
    if (formData.canParallelWith) updateData.canParallelWith = formData.canParallelWith;
    if (formData.mustAfter) updateData.mustAfter = formData.mustAfter;
    if (formData.equipmentV2) updateData.equipmentV2 = formData.equipmentV2;
    // Materials V2 not editable here directly except readonly view

    updateSubStep(process.id, subStepId, updateData);
    onOpenChange(false);
  };

  if (!subStep || !process) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>编辑关键参数 - {subStep?.id}</DialogTitle>
          <DialogDescription>
            {subStep?.label}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 h-full overflow-hidden flex flex-col">
          <Tabs defaultValue="params" className="w-full h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="params">工艺参数</TabsTrigger>
              <TabsTrigger value="scheduling">调度设置</TabsTrigger>
            </TabsList>

            <TabsContent value="params" className="flex-1 overflow-auto p-1">
              <div className="space-y-4">

                {/* Dynamic Form Renderer */}
                <DynamicFormRenderer
                  configs={currentConfigs}
                  data={formData}
                  onChange={(updated) => setFormData((prev: any) => ({ ...prev, ...updated }))}
                />

                <div className="border-t pt-4 mt-4">
                  <h4 className="text-sm font-medium mb-4">V2 数据 (核心结构)</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>设备编号</Label>
                      <Input
                        value={formData.equipmentV2?.deviceCode || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          equipmentV2: { ...formData.equipmentV2, deviceCode: e.target.value }
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>物料数量</Label>
                      <Input
                        value={formData.materialsV2?.length || 0}
                        disabled
                      />
                    </div>
                  </div>
                  <div className="space-y-2 mt-2">
                    <Label>物料清单 (预览)</Label>
                    <div className="text-xs text-gray-500 border p-2 rounded bg-gray-50">
                      {formData.materialsV2?.map((m: MaterialSpec) => m.name).join(', ') || '无'}
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="scheduling" className="flex-1 overflow-auto p-1">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>设备需求类型</Label>
                  <Select
                    value={formData.deviceRequirement?.deviceType || process?.node.subSteps.find(s => s.id === subStepId)?.equipmentV2?.deviceType || 'OTHER'}
                    onValueChange={(value) => setFormData({
                      ...formData,
                      deviceRequirement: { ...formData.deviceRequirement, deviceType: value }
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择设备类型" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="HIGH_SPEED_MIXER">高搅桶</SelectItem>
                      <SelectItem value="MIXING_TANK">调配桶</SelectItem>
                      <SelectItem value="PIPELINE">管道</SelectItem>
                      <SelectItem value="FILTER">过滤器</SelectItem>
                      <SelectItem value="UHT_MACHINE">UHT灭菌机</SelectItem>
                      <SelectItem value="FILLING_MACHINE">灌装机</SelectItem>
                      <SelectItem value="OTHER">其他</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>指定具体设备 (可选)</Label>
                  <Input
                    value={formData.deviceRequirement?.deviceCode || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      deviceRequirement: { ...formData.deviceRequirement, deviceCode: e.target.value }
                    })}
                    placeholder="留空则自动分配"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>预计耗时</Label>
                    <Input
                      type="number"
                      value={formData.estimatedDuration?.value || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        estimatedDuration: { ...formData.estimatedDuration, value: Number(e.target.value), unit: 'min' }
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>单位</Label>
                    <Input value="min" disabled />
                  </div>
                </div>

                <div className="flex items-center space-x-2 pt-2">
                  <input
                    type="checkbox"
                    id="exclusive"
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    checked={formData.deviceRequirement?.exclusiveUse !== false}
                    onChange={(e) => setFormData({
                      ...formData,
                      deviceRequirement: { ...formData.deviceRequirement, exclusiveUse: e.target.checked }
                    })}
                  />
                  <Label htmlFor="exclusive" className="cursor-pointer">独占设备资源</Label>
                </div>

                {/* 并行关系设置 */}
                <div className="space-y-2 pt-4 border-t">
                  <Label>可并行执行的步骤</Label>
                  <div className="text-xs text-gray-500 mb-2">
                    选择可以与当前步骤同时执行的其他步骤
                  </div>
                  <div className="border rounded-md p-2 max-h-32 overflow-y-auto space-y-1">
                    {process?.node.subSteps
                      .filter(s => s.id !== subStepId)
                      .map(step => (
                        <label
                          key={step.id}
                          className="flex items-center space-x-2 p-1 hover:bg-gray-50 rounded cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                            checked={formData.canParallelWith?.includes(step.id) || false}
                            onChange={(e) => {
                              const current = formData.canParallelWith || [];
                              const updated = e.target.checked
                                ? [...current, step.id]
                                : current.filter((id: string) => id !== step.id);
                              setFormData({ ...formData, canParallelWith: updated });
                            }}
                          />
                          <span className="text-sm">{step.label} ({step.id})</span>
                        </label>
                      ))}
                    {(!process?.node.subSteps || process.node.subSteps.filter(s => s.id !== subStepId).length === 0) && (
                      <div className="text-xs text-gray-400 p-2">暂无其他步骤</div>
                    )}
                  </div>
                </div>

                {/* 依赖关系设置 */}
                <div className="space-y-2 pt-4 border-t">
                  <Label>依赖关系(必须在以下步骤之后)</Label>
                  <div className="text-xs text-gray-500 mb-2">
                    选择必须在当前步骤之前完成的步骤
                  </div>
                  <div className="border rounded-md p-2 max-h-32 overflow-y-auto space-y-1">
                    {process?.node.subSteps
                      .filter(s => s.id !== subStepId)
                      .map(step => (
                        <label
                          key={step.id}
                          className="flex items-center space-x-2 p-1 hover:bg-gray-50 rounded cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            checked={formData.mustAfter?.includes(step.id) || false}
                            onChange={(e) => {
                              const current = formData.mustAfter || [];
                              const updated = e.target.checked
                                ? [...current, step.id]
                                : current.filter((id: string) => id !== step.id);
                              setFormData({ ...formData, mustAfter: updated });
                            }}
                          />
                          <span className="text-sm">{step.label} ({step.id})</span>
                        </label>
                      ))}
                    {(!process?.node.subSteps || process.node.subSteps.filter(s => s.id !== subStepId).length === 0) && (
                      <div className="text-xs text-gray-400 p-2">暂无其他步骤</div>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
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
