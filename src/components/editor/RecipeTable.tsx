import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
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
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useRecipeStore } from '@/store/useRecipeStore';
import { useCollabStore } from '@/store/useCollabStore';
import { ConnectionModal } from './ConnectionModal';
import { ParamsModal } from './ParamsModal';
import { AddSubStepDialog } from './AddSubStepDialog';
import { Plus, Trash2, Lock, ChevronDown, ChevronRight, Edit2, Copy, ArrowUp, ArrowDown } from 'lucide-react';
import { SubStep, ProcessType, getEquipmentConfig, getMaterials, Process } from '@/types/recipe';
import { DeviceType } from '@/types/equipment';
import { DeviceRequirement } from '@/types/scheduling';
import { useProcessTypeConfigStore } from '@/store/useProcessTypeConfigStore';
import { useFieldConfigStore } from '@/store/useFieldConfigStore';
import { FieldConfig } from '@/types/fieldConfig';

// 工艺类型中文映射
const getProcessTypeLabel = (type: ProcessType): string => {
  const labels: Record<ProcessType, string> = {
    [ProcessType.DISSOLUTION]: '溶解',
    [ProcessType.COMPOUNDING]: '调配',
    [ProcessType.FILTRATION]: '过滤',
    [ProcessType.TRANSFER]: '赶料',
    [ProcessType.FLAVOR_ADDITION]: '香精添加',
    [ProcessType.OTHER]: '其他',
  };
  return labels[type];
};

// 可拖动的工艺段行组件
function SortableProcessRow({
  process,
  index,
  isExpanded,
  isEditingProcess,
  editProcessValues,
  setEditProcessValues,
  toggleProcessExpanded,
  handleStartEditProcess,
  handleSaveEditProcess,
  handleAddSubStep,
  getProcessConnections,
  canEdit,
  setConnectionModalProcessId,
  removeProcess,
  insertProcess,
  duplicateProcess,
  setEditingProcessId,
}: {
  process: Process;
  index: number;
  isExpanded: boolean;
  isEditingProcess: boolean;
  editProcessValues: { name?: string; description?: string };
  setEditProcessValues: (values: { name?: string; description?: string }) => void;
  toggleProcessExpanded: (id: string) => void;
  handleStartEditProcess: (id: string) => void;
  handleSaveEditProcess: (id: string) => void;
  handleAddSubStep: (id: string) => void;
  getProcessConnections: (id: string) => any[];
  canEdit: boolean;
  setConnectionModalProcessId: (id: string | null) => void;
  removeProcess: (id: string) => void;
  insertProcess: (process: Process, targetIndex: number) => void;
  duplicateProcess: (processId: string, insertAfter: boolean) => void;
  setEditingProcessId: (id: string | null) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: process.id, disabled: !canEdit });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleInsertAbove = () => {
    if (!canEdit) return;
    const newProcessId = `P${Date.now()}`;
    const newProcess: Process = {
      id: newProcessId,
      name: `新工艺段${newProcessId}`,
      node: {
        id: newProcessId,
        type: 'processNode',
        label: `新工艺段${newProcessId}`,
        subSteps: [],
      },
    };
    insertProcess(newProcess, index);
  };

  const handleInsertBelow = () => {
    if (!canEdit) return;
    const newProcessId = `P${Date.now()}`;
    const newProcess: Process = {
      id: newProcessId,
      name: `新工艺段${newProcessId}`,
      node: {
        id: newProcessId,
        type: 'processNode',
        label: `新工艺段${newProcessId}`,
        subSteps: [],
      },
    };
    insertProcess(newProcess, index + 1);
  };

  const handleDuplicate = () => {
    if (!canEdit) return;
    duplicateProcess(process.id, true);
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <TableRow
          ref={setNodeRef}
          style={style}
          className="bg-slate-100 hover:bg-slate-200"
        >
          <TableCell colSpan={10} className="py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {canEdit && (
                  <div
                    {...attributes}
                    {...listeners}
                    className="cursor-grab active:cursor-grabbing mr-1"
                    title="拖动排序"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <circle cx="2" cy="2" r="1" fill="currentColor" />
                      <circle cx="6" cy="2" r="1" fill="currentColor" />
                      <circle cx="10" cy="2" r="1" fill="currentColor" />
                      <circle cx="2" cy="6" r="1" fill="currentColor" />
                      <circle cx="6" cy="6" r="1" fill="currentColor" />
                      <circle cx="10" cy="6" r="1" fill="currentColor" />
                      <circle cx="2" cy="10" r="1" fill="currentColor" />
                      <circle cx="6" cy="10" r="1" fill="currentColor" />
                      <circle cx="10" cy="10" r="1" fill="currentColor" />
                    </svg>
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => toggleProcessExpanded(process.id)}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
                <span className="font-bold text-sm">
                  P{index + 1} - {isEditingProcess ? (
                    <Input
                      value={editProcessValues.name || process.name}
                      onChange={(e) => setEditProcessValues({ ...editProcessValues, name: e.target.value })}
                      onBlur={() => handleSaveEditProcess(process.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEditProcess(process.id);
                        if (e.key === 'Escape') {
                          setEditingProcessId(null);
                          setEditingContext(null);
                        }
                      }}
                      className="inline-block w-48 h-6 text-sm"
                      autoFocus
                    />
                  ) : (
                    <span
                      className={cn(
                        canEdit ? 'cursor-pointer hover:text-blue-600' : '',
                        'min-w-[120px] inline-block',
                        !process.name && canEdit && 'border border-dashed border-gray-300 px-2 py-1 rounded text-gray-400'
                      )}
                      onClick={() => canEdit && handleStartEditProcess(process.id)}
                    >
                      {process.name || '未命名步骤'}
                    </span>
                  )}
                </span>
                <span className="text-xs text-gray-500">
                  ({process.node.subSteps.length}个步骤)
                </span>
                {/* 下一步显示 */}
                {(() => {
                  const processConnections = getProcessConnections(process.id);
                  return processConnections.length > 0 ? (
                    <div className="ml-4 flex items-center gap-1 text-xs text-gray-600">
                      <span className="font-medium">下一步:</span>
                      {processConnections.map((conn, idx) => (
                        <span key={idx} className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100">
                          → {conn.target} (Seq:{conn.sequence})
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="ml-4 text-xs text-gray-400">无下一步</span>
                  );
                })()}
              </div>
              <div className="flex items-center gap-2">
                {canEdit && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConnectionModalProcessId(process.id)}
                      title="设置下一步"
                    >
                      <Edit2 className="h-4 w-4 mr-1" />
                      设置下一步
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAddSubStep(process.id)}
                      title="添加子步骤"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      添加子步骤
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm(`确定要删除工艺段 ${process.id} 及其所有步骤吗？`)) {
                          removeProcess(process.id);
                        }
                      }}
                      title="删除工艺段"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </TableCell>
        </TableRow>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {canEdit && (
          <>
            <ContextMenuItem onClick={handleInsertAbove}>
              <ArrowUp className="mr-2 h-4 w-4" />
              向上插入工艺段
            </ContextMenuItem>
            <ContextMenuItem onClick={handleInsertBelow}>
              <ArrowDown className="mr-2 h-4 w-4" />
              向下插入工艺段
            </ContextMenuItem>
            <ContextMenuItem onClick={handleDuplicate}>
              <Copy className="mr-2 h-4 w-4" />
              复制工艺段
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}
        <ContextMenuItem
          onClick={() => {
            if (!canEdit) {
              alert('需要编辑权限或进入演示模式');
              return;
            }
            if (confirm(`确定要删除工艺段 ${process.id} 及其所有步骤吗？`)) {
              removeProcess(process.id);
            }
          }}
          disabled={!canEdit}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          删除工艺段
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export function RecipeTable() {
  const {
    processes,
    edges,
    addSubStep,
    updateSubStep,
    removeSubStep,
    addProcess,
    updateProcess,
    removeProcess,
    insertProcess,
    duplicateProcess,
    reorderProcesses,
    hoveredNodeId,
    setHoveredNodeId,
    setEditingContext,
  } = useRecipeStore();
  const { isEditable, mode } = useCollabStore();
  const canEdit = mode === 'demo' || isEditable();

  // 拖动传感器
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const [connectionModalProcessId, setConnectionModalProcessId] = useState<string | null>(null);
  const [paramsModalSubStepId, setParamsModalSubStepId] = useState<string | null>(null);
  // 编辑状态：追踪正在编辑的子步骤ID和具体字段
  const [editingSubStep, setEditingSubStep] = useState<{ id: string; field: 'label' | 'deviceCode' | 'ingredients' } | null>(null);
  const [editingProcessId, setEditingProcessId] = useState<string | null>(null);
  const [editSubStepValues, setEditSubStepValues] = useState<Partial<SubStep>>({});
  const [editProcessValues, setEditProcessValues] = useState<{ name?: string; description?: string }>({});
  const [expandedProcesses, setExpandedProcesses] = useState<Set<string>>(
    new Set(processes.map(p => p.id))
  );
  // 类型选择对话框状态
  const [addSubStepDialogOpen, setAddSubStepDialogOpen] = useState(false);
  const [addSubStepProcessId, setAddSubStepProcessId] = useState<string | null>(null);
  const { getSubStepTemplate } = useProcessTypeConfigStore();

  // 同步expandedProcesses，确保processes更新时也更新展开状态
  useEffect(() => {
    setExpandedProcesses(prev => {
      const currentIds = new Set(processes.map(p => p.id));
      // 保留已展开的，添加新 processes 的 ID
      const next = new Set(prev);
      processes.forEach(p => {
        if (!next.has(p.id)) {
          next.add(p.id); // 新 processes 默认展开
        }
      });
      // 移除已删除的 processes
      prev.forEach(id => {
        if (!currentIds.has(id)) {
          next.delete(id);
        }
      });
      return next;
    });
  }, [processes]);

  const toggleProcessExpanded = (processId: string) => {
    setExpandedProcesses(prev => {
      const next = new Set(prev);
      if (next.has(processId)) {
        next.delete(processId);
      } else {
        next.add(processId);
      }
      return next;
    });
  };

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || !canEdit) return;

    if (active.id !== over.id) {
      const oldIndex = processes.findIndex(p => p.id === active.id);
      const newIndex = processes.findIndex(p => p.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(processes, oldIndex, newIndex);
        reorderProcesses(newOrder.map(p => p.id));
      }
    }
  }, [processes, canEdit, reorderProcesses]);

  const handleAddProcess = () => {
    if (!canEdit) {
      alert('需要编辑权限或进入演示模式');
      return;
    }
    const newProcessId = `P${Date.now()}`;
    addProcess({
      id: newProcessId,
      name: `新工艺段${newProcessId}`,
      node: {
        id: newProcessId,
        type: 'processNode',
        label: `新工艺段${newProcessId}`,
        subSteps: [],
      },
    });
    setEditingProcessId(newProcessId);
    setEditProcessValues({ name: `新工艺段${newProcessId}` });
  };

  const handleStartEditProcess = (processId: string) => {
    const process = processes.find(p => p.id === processId);
    if (process) {
      setEditingProcessId(processId);
      setEditProcessValues({ name: process.name, description: process.description });
      setEditingContext({ processId });
    }
  };

  const handleSaveEditProcess = (processId: string) => {
    if (editingProcessId === processId) {
      updateProcess(processId, editProcessValues);
      setEditingProcessId(null);
      setEditProcessValues({});
      setEditingContext(null);
    }
  };

  // 打开类型选择对话框
  const handleOpenAddSubStepDialog = (processId: string) => {
    if (!canEdit) {
      alert('需要编辑权限或进入演示模式');
      return;
    }
    setAddSubStepProcessId(processId);
    setAddSubStepDialogOpen(true);
  };

  // 确认添加子步骤（从模板创建）
  const handleConfirmAddSubStep = (processType: ProcessType) => {
    if (!addSubStepProcessId) return;

    const process = processes.find(p => p.id === addSubStepProcessId);
    const existingSubSteps = process?.node.subSteps || [];
    const subStepCount = existingSubSteps.length || 0;
    const template = getSubStepTemplate(processType);
    
    if (!template) {
      console.error(`Template for processType ${processType} not found`);
      alert(`无法创建子步骤：类型 ${processType} 的模板不存在`);
      return;
    }

    // 生成全局唯一的子步骤 ID：
    // 之前使用 length+1，在“删除中间步骤后再新增”会复用旧 ID，导致流程图节点缺失/连线断开
    const prefix = `${addSubStepProcessId}-substep-`;
    const maxIndex = existingSubSteps.reduce((max, s) => {
      if (typeof s.id !== 'string' || !s.id.startsWith(prefix)) return max;
      const suffix = s.id.slice(prefix.length);
      const n = Number.parseInt(suffix, 10);
      return Number.isFinite(n) ? Math.max(max, n) : max;
    }, 0);

    let nextIndex = Math.max(maxIndex + 1, subStepCount + 1);
    let newId = `${addSubStepProcessId}-substep-${nextIndex}`;
    while (existingSubSteps.some(s => s.id === newId)) {
      nextIndex += 1;
      newId = `${addSubStepProcessId}-substep-${nextIndex}`;
    }

    const maxOrder = existingSubSteps.reduce((max, s) => Math.max(max, s.order || 0), 0);

    const newSubStep: SubStep = {
      id: newId,
      order: maxOrder + 1,
      processType: processType,
      label: template.label,
      deviceCode: template.defaultDeviceCode,
      ingredients: '',
      params: template.defaultParams,
      deviceRequirement: {
        exclusiveUse: true,
        deviceType: template.defaultDeviceType,
        deviceCode: template.defaultDeviceCode || undefined,
      },
      templateVersion: template.version,
    };
    addSubStep(addSubStepProcessId, newSubStep);
    setAddSubStepProcessId(null);
  };

  const handleStartEditSubStep = (subStep: SubStep, field: 'label' | 'deviceCode' | 'ingredients') => {
    setEditingSubStep({ id: subStep.id, field });
    setEditSubStepValues(subStep);
    // 找到该子步骤所属的工艺段
    const process = processes.find(p => p.node.subSteps.some(s => s.id === subStep.id));
    if (process) {
      setEditingContext({ processId: process.id, subStepId: subStep.id });
    }
  };

  const handleSaveEditSubStep = (processId: string, subStepId: string) => {
    if (editingSubStep?.id === subStepId) {
      // 自动同步 deviceCode 到 deviceRequirement
      const updatedValues = { ...editSubStepValues };

      // 如果修改了设备编号，同步更新 deviceRequirement
      if (updatedValues.deviceCode !== undefined) {
        const currentProcess = processes.find(p => p.id === processId);
        const currentSubStep = currentProcess?.node.subSteps.find(s => s.id === subStepId);

        if (currentSubStep) {
          const newDeviceCode = updatedValues.deviceCode;
          const currentRequirement: DeviceRequirement = currentSubStep.deviceRequirement || {
            exclusiveUse: true,
            deviceType: DeviceType.OTHER
          };

          updatedValues.deviceRequirement = {
            ...currentRequirement,
            deviceCode: newDeviceCode,
            // 如果只有deviceCode没有type，尝试保留原有type或默认为OTHER
            deviceType: currentRequirement.deviceType || DeviceType.OTHER,
            exclusiveUse: currentRequirement.exclusiveUse ?? true
          };
        }
      }

      updateSubStep(processId, subStepId, updatedValues);
      setEditingSubStep(null);
      setEditSubStepValues({});
      setEditingContext(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingSubStep(null);
    setEditSubStepValues({});
    setEditingContext(null);
  };

  const getProcessConnections = (processId: string) => {
    return edges
      .filter((edge) => edge.source === processId)
      .map((edge) => {
        const targetProcess = processes.find((p) => p.id === edge.target);
        return {
          edge,
          target: targetProcess?.name || edge.target,
          sequence: edge.data.sequenceOrder,
        };
      });
  };

  // 格式化条件值
  const formatConditionValue = (value: { value: number; unit: string; condition?: string }) => {
    if (!value) return '';
    const condition = value.condition || '';
    return `${condition}${value.value}${value.unit}`;
  };

  // 渲染子步骤参数显示 - Dynamic Component usage
  const SubStepParamsCell = ({ subStep }: { subStep: SubStep }) => {
    const { getConfigsByProcessType } = useFieldConfigStore();
    const configs = getConfigsByProcessType(subStep.processType);

    // 从嵌套参数结构中获取值的辅助函数 - 重复逻辑
    // 理想情况下应该是辅助工具函数
    const getParamValue = (key: string): any => {
      const paramKeyMaps: Record<string, string> = {
        [ProcessType.DISSOLUTION]: 'dissolutionParams',
        [ProcessType.COMPOUNDING]: 'compoundingParams',
        [ProcessType.FILTRATION]: 'filtrationParams',
        [ProcessType.TRANSFER]: 'transferParams',
        [ProcessType.FLAVOR_ADDITION]: 'flavorAdditionParams',
        [ProcessType.EXTRACTION]: 'extractionParams',
      };

      if (subStep.processType === ProcessType.OTHER) {
        if (key === 'params') return (subStep.params as any).params;
        return null;
      }

      const groupKey = paramKeyMaps[subStep.processType];
      if (!groupKey || !(subStep.params as any)[groupKey]) return null;
      return (subStep.params as any)[groupKey][key];
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
        if (value.min !== undefined && value.max !== undefined) {
          displayValue = `${value.min}-${value.max}`;
        } else if (value.max !== undefined) {
          displayValue = `≤${value.max}`;
        } else if (value.min !== undefined) {
          displayValue = `≥${value.min}`;
        }
        if (config.unit) displayValue += config.unit;
      } else if (config.inputType === 'object' && config.fields) {
        // 处理对象类型: 使用 fields 元数据来格式化
        const parts: string[] = [];

        config.fields.forEach(fieldConfig => {
          const fieldValue = value[fieldConfig.key];
          if (fieldValue !== undefined && fieldValue !== null) {
            // 根据字段语义添加前缀
            if (fieldConfig.key === 'max') {
              parts.push(`≤${fieldValue}`);
            } else if (fieldConfig.key === 'min') {
              parts.push(`≥${fieldValue}`);
            } else if (fieldConfig.key === 'value') {
              parts.push(String(fieldValue));
            } else if (fieldConfig.key !== 'unit') {
              // 跳过 unit 字段,它会被附加到末尾
              parts.push(String(fieldValue));
            }
          }
        });

        // 查找 unit 字段
        const unitField = config.fields.find(f => f.key === 'unit');
        const unit = unitField ? value[unitField.key] : '';

        displayValue = parts.join('') + unit;
      } else if (config.inputType === 'array' && Array.isArray(value)) {
        // 处理数组类型
        if (value.length === 0) {
          displayValue = '无';
        } else if (config.itemFields) {
          // 对象数组: 显示每个对象的主要字段
          displayValue = value.map(item => {
            // 优先显示 name 字段
            return item.name || item.label || JSON.stringify(item);
          }).join(', ');
        } else {
          // 简单数组
          displayValue = value.join(', ');
        }
      } else if (config.inputType === 'number' || config.inputType === 'text') {
        displayValue = String(value);
        if (config.unit) displayValue += config.unit;
      }
      return displayValue;
    };

    if (subStep.processType === ProcessType.OTHER) {
      return <span className="text-xs text-left break-words">{getParamValue('params')}</span>;
    }

    return (
      <div className="flex flex-col gap-1 text-xs text-left">
        {configs.slice(0, 3).map(config => { // Limit to 3 fields for table view
          const val = getParamValue(config.key);
          if (val === undefined || val === null) return null;
          const displayValue = renderFieldValue(config, val);
          return (
            <span key={config.key} className="truncate block" title={`${config.label}: ${displayValue}`}>
              <span className="text-slate-500 mr-1">{config.label}:</span>
              {displayValue}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-auto relative">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <Table className="table-fixed w-full min-w-[800px]">
            <TableHeader className="sticky top-0 z-10 bg-white shadow-sm">
              <TableRow>
                <TableHead className="w-[60px] min-w-[60px] whitespace-nowrap">工艺段</TableHead>
                <TableHead className="w-[60px] min-w-[60px] whitespace-nowrap">步骤ID</TableHead>
                <TableHead className="min-w-[80px] whitespace-nowrap truncate">步骤名称</TableHead>
                <TableHead className="w-[70px] min-w-[70px] whitespace-nowrap">工艺类型</TableHead>
                <TableHead className="min-w-[80px] whitespace-nowrap truncate">位置/设备</TableHead>
                <TableHead className="min-w-[60px] whitespace-nowrap truncate">原料/内容</TableHead>
                <TableHead className="min-w-[80px] whitespace-nowrap truncate">关键参数</TableHead>
                <TableHead className="w-[70px] min-w-[70px] whitespace-nowrap">预计耗时</TableHead>
                <TableHead className="w-[70px] min-w-[70px] whitespace-nowrap">调度约束</TableHead>
                <TableHead className="w-[50px] min-w-[50px] whitespace-nowrap">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <SortableContext
                items={processes.map(p => p.id)}
                strategy={verticalListSortingStrategy}
              >
                {processes.map((process, index) => {
                  const isExpanded = expandedProcesses.has(process.id);
                  const isEditingProcess = editingProcessId === process.id;

                  return (
                    <React.Fragment key={`process-group-${process.id}`}>
                      {/* Process分组头 */}
                      <SortableProcessRow
                        process={process}
                        index={index}
                        isExpanded={isExpanded}
                        isEditingProcess={isEditingProcess}
                        editProcessValues={editProcessValues}
                        setEditProcessValues={setEditProcessValues}
                        toggleProcessExpanded={toggleProcessExpanded}
                        handleStartEditProcess={handleStartEditProcess}
                        handleSaveEditProcess={handleSaveEditProcess}
                        handleAddSubStep={handleOpenAddSubStepDialog}
                        getProcessConnections={getProcessConnections}
                        canEdit={canEdit}
                        setConnectionModalProcessId={setConnectionModalProcessId}
                        removeProcess={removeProcess}
                        insertProcess={insertProcess}
                        duplicateProcess={duplicateProcess}
                        setEditingProcessId={setEditingProcessId}
                      />

                      {/* Process内的子步骤 */}
                      {isExpanded && process.node.subSteps.map((subStep) => {
                        const isEditingLabel = editingSubStep?.id === subStep.id && editingSubStep?.field === 'label';
                        const isEditingDeviceCode = editingSubStep?.id === subStep.id && editingSubStep?.field === 'deviceCode';
                        const isEditingIngredients = editingSubStep?.id === subStep.id && editingSubStep?.field === 'ingredients';
                        const isHovered = hoveredNodeId === subStep.id;

                        return (
                          <TableRow
                            key={subStep.id}
                            id={`row-${subStep.id}`}
                            className={isHovered ? 'bg-blue-50' : ''}
                            onMouseEnter={() => setHoveredNodeId(subStep.id)}
                            onMouseLeave={() => setHoveredNodeId(null)}
                          >
                            <TableCell>
                              <span className="text-xs text-gray-400">↑</span>
                            </TableCell>
                            <TableCell>
                              <span className="font-mono text-sm">{subStep.order}</span>
                            </TableCell>
                            <TableCell>
                              {isEditingLabel ? (
                                <Input
                                  value={editSubStepValues.label ?? subStep.label}
                                  onChange={(e) =>
                                    setEditSubStepValues({ ...editSubStepValues, label: e.target.value })
                                  }
                                  onBlur={() => handleSaveEditSubStep(process.id, subStep.id)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveEditSubStep(process.id, subStep.id);
                                    if (e.key === 'Escape') handleCancelEdit();
                                  }}
                                  autoFocus
                                  disabled={!canEdit}
                                />
                              ) : (
                                <span
                                  className={cn(
                                    canEdit ? 'cursor-pointer hover:text-blue-600' : 'cursor-not-allowed opacity-60',
                                    'min-w-[80px] inline-block',
                                    !subStep.label && canEdit && 'border border-dashed border-gray-300 px-2 py-1 rounded text-gray-400'
                                  )}
                                  onClick={() => canEdit && handleStartEditSubStep(subStep, 'label')}
                                >
                                  {subStep.label || '未命名'}
                                  {!canEdit && <Lock className="ml-1 inline h-3 w-3" />}
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className="text-xs text-gray-600">
                                {getProcessTypeLabel(subStep.processType)}
                              </span>
                            </TableCell>
                            <TableCell>
                              {isEditingDeviceCode ? (
                                <Input
                                  value={editSubStepValues.deviceCode ?? subStep.deviceCode}
                                  onChange={(e) =>
                                    setEditSubStepValues({
                                      ...editSubStepValues,
                                      deviceCode: e.target.value,
                                    })
                                  }
                                  onBlur={() => handleSaveEditSubStep(process.id, subStep.id)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveEditSubStep(process.id, subStep.id);
                                    if (e.key === 'Escape') handleCancelEdit();
                                  }}
                                  autoFocus
                                  disabled={!canEdit}
                                />
                              ) : (
                                <span
                                  className={`${canEdit ? 'cursor-pointer hover:text-blue-600' : 'cursor-not-allowed opacity-60'}`}
                                  onClick={() => canEdit && handleStartEditSubStep(subStep, 'deviceCode')}
                                >
                                  {getEquipmentConfig(subStep)?.deviceCode || subStep.deviceCode}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="max-w-[150px] overflow-hidden">
                              {isEditingIngredients ? (
                                <Textarea
                                  value={editSubStepValues.ingredients ?? subStep.ingredients}
                                  onChange={(e) =>
                                    setEditSubStepValues({
                                      ...editSubStepValues,
                                      ingredients: e.target.value,
                                    })
                                  }
                                  onBlur={() => handleSaveEditSubStep(process.id, subStep.id)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Escape') handleCancelEdit();
                                  }}
                                  autoFocus
                                  rows={2}
                                  className="w-full max-w-full text-sm"
                                  disabled={!canEdit}
                                />
                              ) : (
                                <span
                                  className={`text-xs ${canEdit ? 'cursor-pointer hover:text-blue-600' : 'cursor-not-allowed opacity-60'}`}
                                  onClick={() => canEdit && handleStartEditSubStep(subStep, 'ingredients')}
                                >
                                  {getMaterials(subStep).length > 0
                                    ? getMaterials(subStep).map(m => m.name).join('、')
                                    : subStep.ingredients}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="max-w-[200px]">
                              <div className="overflow-hidden">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    if (!canEdit) {
                                      alert('需要编辑权限或进入演示模式');
                                      return;
                                    }
                                    setParamsModalSubStepId(subStep.id);
                                  }}
                                  className="w-full h-auto py-2 px-3 text-left min-h-[2rem]"
                                  disabled={!canEdit}
                                  title={!canEdit ? '需要编辑权限' : '点击编辑参数'}
                                >
                                  <div className="flex items-start w-full overflow-hidden">
                                    <Edit2 className="mr-2 h-3 w-3 mt-1 shrink-0 opacity-50" />
                                    <div className="flex-1 min-w-0">
                                      <SubStepParamsCell subStep={subStep} />
                                    </div>
                                  </div>
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-xs text-gray-600">
                                {subStep.estimatedDuration
                                  ? `${subStep.estimatedDuration.value}${subStep.estimatedDuration.unit}`
                                  : '-'}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col space-y-1">
                                {subStep.deviceRequirement && (
                                  <span className="text-xs bg-purple-50 text-purple-700 px-1 py-0.5 rounded border border-purple-100 truncate max-w-[100px]" title="设备需求">
                                    {subStep.deviceRequirement.deviceCode || subStep.deviceRequirement.deviceType || '设备需求'}
                                  </span>
                                )}
                                {subStep.canParallelWith && subStep.canParallelWith.length > 0 && (
                                  <span className="text-xs bg-green-50 text-green-700 px-1 py-0.5 rounded border border-green-100" title="可并行">
                                    并行:{subStep.canParallelWith.length}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  if (!canEdit) {
                                    alert('需要编辑权限或进入演示模式');
                                    return;
                                  }
                                  removeSubStep(process.id, subStep.id);
                                }}
                                disabled={!canEdit}
                                title={!canEdit ? '需要编辑权限或进入演示模式' : '删除'}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </SortableContext>
            </TableBody>
          </Table>
        </DndContext>
      </div>

      <div className="border-t p-4">
        <Button
          onClick={handleAddProcess}
          className="w-full"
          disabled={!canEdit}
          title={!canEdit ? '需要编辑权限或进入演示模式' : '添加工艺段'}
        >
          <Plus className="mr-2 h-4 w-4" />
          添加工艺段
        </Button>
      </div>

      {connectionModalProcessId && (
        <ConnectionModal
          nodeId={connectionModalProcessId}
          open={!!connectionModalProcessId}
          onOpenChange={(open) => !open && setConnectionModalProcessId(null)}
        />
      )}

      {paramsModalSubStepId && (
        <ParamsModal
          nodeId={paramsModalSubStepId}
          open={!!paramsModalSubStepId}
          onOpenChange={(open) => !open && setParamsModalSubStepId(null)}
        />
      )}

      <AddSubStepDialog
        open={addSubStepDialogOpen}
        onOpenChange={setAddSubStepDialogOpen}
        onConfirm={handleConfirmAddSubStep}
      />
    </div>
  );
}
