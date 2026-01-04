import React, { useState, useEffect } from 'react';
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
import { useRecipeStore } from '@/store/useRecipeStore';
import { useCollabStore } from '@/store/useCollabStore';
import { ConnectionModal } from './ConnectionModal';
import { ParamsModal } from './ParamsModal';
import { Plus, Trash2, Lock, ChevronDown, ChevronRight, Edit2 } from 'lucide-react';
import { SubStep, ProcessType, getEquipmentConfig, getMaterials } from '@/types/recipe';

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
    hoveredNodeId,
    setHoveredNodeId,
  } = useRecipeStore();
  const { isEditable, mode } = useCollabStore();
  const canEdit = mode === 'demo' || isEditable();

  const [connectionModalProcessId, setConnectionModalProcessId] = useState<string | null>(null);
  const [paramsModalSubStepId, setParamsModalSubStepId] = useState<string | null>(null);
  const [editingSubStepId, setEditingSubStepId] = useState<string | null>(null);
  const [editingProcessId, setEditingProcessId] = useState<string | null>(null);
  const [editSubStepValues, setEditSubStepValues] = useState<Partial<SubStep>>({});
  const [editProcessValues, setEditProcessValues] = useState<{ name?: string; description?: string }>({});
  const [expandedProcesses, setExpandedProcesses] = useState<Set<string>>(
    new Set(processes.map(p => p.id))
  );

  // 同步expandedProcesses，确保processes更新时也更新展开状态
  useEffect(() => {
    setExpandedProcesses(prev => {
      const currentIds = new Set(processes.map(p => p.id));
      // 保留已展开的，添加新processes的ID
      const next = new Set(prev);
      processes.forEach(p => {
        if (!next.has(p.id)) {
          next.add(p.id); // 新processes默认展开
        }
      });
      // 移除已删除的processes
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

  const handleAddProcess = () => {
    if (!canEdit) {
      alert('需要编辑权限或进入演示模式');
      return;
    }
    const newProcessId = `P${processes.length + 1}`;
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
    }
  };

  const handleSaveEditProcess = (processId: string) => {
    if (editingProcessId === processId) {
      updateProcess(processId, editProcessValues);
      setEditingProcessId(null);
      setEditProcessValues({});
    }
  };

  const handleAddSubStep = (processId: string) => {
    if (!canEdit) {
      alert('需要编辑权限或进入演示模式');
      return;
    }
    const process = processes.find(p => p.id === processId);
    const subStepCount = process?.node.subSteps.length || 0;
    const newSubStep: SubStep = {
      id: `${processId}-substep-${subStepCount + 1}`,
      order: subStepCount + 1,
      processType: ProcessType.OTHER,
      label: '新步骤',
      deviceCode: '',
      ingredients: '',
      params: {
        processType: ProcessType.OTHER,
        params: '',
      },
    };
    addSubStep(processId, newSubStep);
    setEditingSubStepId(newSubStep.id);
    setEditSubStepValues(newSubStep);
  };

  const handleStartEditSubStep = (subStep: SubStep) => {
    setEditingSubStepId(subStep.id);
    setEditSubStepValues(subStep);
  };

  const handleSaveEditSubStep = (processId: string, subStepId: string) => {
    if (editingSubStepId === subStepId) {
      updateSubStep(processId, subStepId, editSubStepValues);
      setEditingSubStepId(null);
      setEditSubStepValues({});
    }
  };

  const handleCancelEdit = () => {
    setEditingSubStepId(null);
    setEditSubStepValues({});
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

  // 格式化子步骤参数显示
  const formatSubStepParamsDisplay = (subStep: SubStep): string => {
    switch (subStep.processType) {
      case ProcessType.DISSOLUTION:
        if ('dissolutionParams' in subStep.params) {
          const p = subStep.params.dissolutionParams;
          const temp = p.waterTemp.min !== undefined && p.waterTemp.max !== undefined
            ? `${p.waterTemp.min}-${p.waterTemp.max}${p.waterTemp.unit}`
            : '常温';
          const volume = `${p.waterVolume.condition || ''}${p.waterVolume.value}${p.waterVolume.unit}`;
          const rate = p.stirringRate === 'high' ? '高速' : p.stirringRate === 'medium' ? '中速' : '低速';
          return `水量:${volume} 水温:${temp} 搅拌:${rate} ${p.stirringTime.value}${p.stirringTime.unit}`;
        }
        break;
      case ProcessType.COMPOUNDING:
        if ('compoundingParams' in subStep.params) {
          const p = subStep.params.compoundingParams;
          const speed = `${p.stirringSpeed.condition || ''}${p.stirringSpeed.value}${p.stirringSpeed.unit}`;
          return `添加物:${p.additives.length}项 搅拌:${speed} ${p.stirringTime.value}${p.stirringTime.unit} 温度:<${p.finalTemp.max}${p.finalTemp.unit}`;
        }
        break;
      case ProcessType.FILTRATION:
        if ('filtrationParams' in subStep.params) {
          return `${subStep.params.filtrationParams.precision.value}${subStep.params.filtrationParams.precision.unit}`;
        }
        break;
      case ProcessType.TRANSFER:
        if ('transferParams' in subStep.params) {
          const p = subStep.params.transferParams;
          const type = p.transferType === 'material' ? '料赶料' : p.transferType === 'water' ? '水赶料' : '无';
          return type + (p.waterVolume ? ` ${p.waterVolume.value}${p.waterVolume.unit}` : '');
        }
        break;
      case ProcessType.FLAVOR_ADDITION:
        if ('flavorAdditionParams' in subStep.params) {
          return subStep.params.flavorAdditionParams.method;
        }
        break;
      case ProcessType.OTHER:
        if ('params' in subStep.params && subStep.params.params) {
          return subStep.params.params;
        }
        break;
    }
    return '-';
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">工艺段</TableHead>
              <TableHead className="w-[120px]">步骤ID</TableHead>
              <TableHead>步骤名称</TableHead>
              <TableHead className="w-[100px]">工艺类型</TableHead>
              <TableHead>位置/设备</TableHead>
              <TableHead>原料/内容</TableHead>
              <TableHead>关键参数</TableHead>
              <TableHead>预计耗时</TableHead>
              <TableHead>调度约束</TableHead>

              <TableHead>下一步</TableHead>
              <TableHead className="w-[100px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {processes.map((process) => {
              const isExpanded = expandedProcesses.has(process.id);
              const isEditingProcess = editingProcessId === process.id;

              return (
                <React.Fragment key={`process-group-${process.id}`}>
                  {/* Process分组头 */}
                  <TableRow
                    className="bg-slate-100 hover:bg-slate-200"
                  >
                    <TableCell colSpan={11} className="py-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
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
                            {process.id} - {isEditingProcess ? (
                              <Input
                                value={editProcessValues.name || process.name}
                                onChange={(e) => setEditProcessValues({ ...editProcessValues, name: e.target.value })}
                                onBlur={() => handleSaveEditProcess(process.id)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveEditProcess(process.id);
                                  if (e.key === 'Escape') {
                                    setEditingProcessId(null);
                                    setEditProcessValues({});
                                  }
                                }}
                                className="inline-block w-48 h-6 text-sm"
                                autoFocus
                              />
                            ) : (
                              <span
                                className={canEdit ? 'cursor-pointer hover:text-blue-600' : ''}
                                onClick={() => canEdit && handleStartEditProcess(process.id)}
                              >
                                {process.name}
                              </span>
                            )}
                          </span>
                          <span className="text-xs text-gray-500">
                            ({process.node.subSteps.length}个步骤)
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {canEdit && (
                            <>
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

                  {/* Process内的子步骤 */}
                  {isExpanded && process.node.subSteps.map((subStep) => {
                    const isEditing = editingSubStepId === subStep.id;
                    const isHovered = hoveredNodeId === subStep.id;
                    const processConnections = getProcessConnections(process.id);

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
                          {isEditing ? (
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
                              className={`${canEdit ? 'cursor-pointer hover:text-blue-600' : 'cursor-not-allowed opacity-60'}`}
                              onClick={() => canEdit && handleStartEditSubStep(subStep)}
                            >
                              {subStep.label}
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
                          {isEditing ? (
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
                              disabled={!canEdit}
                            />
                          ) : (
                            <span
                              className={`${canEdit ? 'cursor-pointer hover:text-blue-600' : 'cursor-not-allowed opacity-60'}`}
                              onClick={() => canEdit && handleStartEditSubStep(subStep)}
                            >
                              {getEquipmentConfig(subStep)?.deviceCode || subStep.deviceCode}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Textarea
                              value={editSubStepValues.ingredients ?? subStep.ingredients}
                              onChange={(e) =>
                                setEditSubStepValues({
                                  ...editSubStepValues,
                                  ingredients: e.target.value,
                                })
                              }
                              onBlur={() => handleSaveEditSubStep(process.id, subStep.id)}
                              rows={2}
                              className="min-w-[150px]"
                              disabled={!canEdit}
                            />
                          ) : (
                            <span
                              className={`text-xs ${canEdit ? 'cursor-pointer hover:text-blue-600' : 'cursor-not-allowed opacity-60'}`}
                              onClick={() => canEdit && handleStartEditSubStep(subStep)}
                            >
                              {getMaterials(subStep).length > 0
                                ? getMaterials(subStep).map(m => m.name).join('、')
                                : subStep.ingredients}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
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
                            className="w-full text-xs"
                            disabled={!canEdit}
                            title={!canEdit ? '需要编辑权限' : '点击编辑参数'}
                          >
                            <Edit2 className="mr-1 h-3 w-3" />
                            {formatSubStepParamsDisplay(subStep).substring(0, 20)}
                            {formatSubStepParamsDisplay(subStep).length > 20 ? '...' : ''}
                          </Button>
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
                          {processConnections.length > 0 ? (
                            <div className="space-y-0.5 text-xs text-gray-500">
                              {processConnections.map((conn, idx) => (
                                <div key={idx}>
                                  → {conn.target} (Seq:{conn.sequence})
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
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
          </TableBody>
        </Table>
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
    </div>
  );
}
