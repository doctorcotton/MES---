import React, { useState } from 'react';
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
import { useRecipeStore, useFlatNodes } from '@/store/useRecipeStore';
import { useCollabStore } from '@/store/useCollabStore';
import { ConnectionModal } from './ConnectionModal';
import { ParamsModal } from './ParamsModal';
import { Plus, Trash2, ExternalLink, Lock, ChevronDown, ChevronRight, Edit2 } from 'lucide-react';
import { RecipeNode, ProcessType, findProcessByNodeId } from '@/types/recipe';

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
    addNode,
    updateNode,
    removeNode,
    addProcess,
    updateProcess,
    removeProcess,
    hoveredNodeId,
    setHoveredNodeId,
  } = useRecipeStore();
  const nodes = useFlatNodes();
  const { isEditable, mode } = useCollabStore();
  const canEdit = mode === 'demo' || isEditable();

  const [connectionModalNodeId, setConnectionModalNodeId] = useState<string | null>(null);
  const [paramsModalNodeId, setParamsModalNodeId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingProcessId, setEditingProcessId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<RecipeNode['data']>>({});
  const [editProcessValues, setEditProcessValues] = useState<{ name?: string; description?: string }>({});
  const [expandedProcesses, setExpandedProcesses] = useState<Set<string>>(
    new Set(processes.map(p => p.id))
  );

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
      nodes: [],
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

  const handleAddNodeToProcess = (processId: string) => {
    if (!canEdit) {
      alert('需要编辑权限或进入演示模式');
      return;
    }
    const process = processes.find(p => p.id === processId);
    const nodeCount = process?.nodes.length || 0;
    const newId = `${processId}-Step${nodeCount + 1}`;
    const newNode: RecipeNode = {
      id: newId,
      type: 'customProcessNode',
      position: { x: 0, y: 0 },
      data: {
        processType: ProcessType.OTHER,
        label: '新步骤',
        deviceCode: '',
        ingredients: '',
        params: '',
      },
    };
    addNode(newNode);
    setEditingId(newId);
    setEditValues(newNode.data);
  };

  const handleStartEdit = (node: RecipeNode) => {
    setEditingId(node.id);
    setEditValues(node.data);
  };

  const handleSaveEdit = (id: string) => {
    if (editingId === id) {
      updateNode(id, editValues);
      setEditingId(null);
      setEditValues({});
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValues({});
  };

  const getNodeConnections = (nodeId: string) => {
    return edges
      .filter((edge) => edge.source === nodeId)
      .map((edge) => {
        const targetNode = nodes.find((n) => n.id === edge.target);
        return {
          edge,
          target: targetNode?.data.label || edge.target,
          sequence: edge.data.sequenceOrder,
        };
      });
  };

  // 格式化参数显示
  const formatParamsDisplay = (data: RecipeNode['data']): string => {
    switch (data.processType) {
      case ProcessType.DISSOLUTION:
        if ('dissolutionParams' in data) {
          const p = data.dissolutionParams;
          const temp = p.waterTemp.min !== undefined && p.waterTemp.max !== undefined
            ? `${p.waterTemp.min}-${p.waterTemp.max}${p.waterTemp.unit}`
            : '常温';
          const volume = `${p.waterVolume.condition || ''}${p.waterVolume.value}${p.waterVolume.unit}`;
          const rate = p.stirringRate === 'high' ? '高速' : p.stirringRate === 'medium' ? '中速' : '低速';
          return `水量:${volume} 水温:${temp} 搅拌:${rate} ${p.stirringTime.value}${p.stirringTime.unit}`;
        }
        break;
      case ProcessType.COMPOUNDING:
        if ('compoundingParams' in data) {
          const p = data.compoundingParams;
          const speed = `${p.stirringSpeed.condition || ''}${p.stirringSpeed.value}${p.stirringSpeed.unit}`;
          return `添加物:${p.additives.length}项 搅拌:${speed} ${p.stirringTime.value}${p.stirringTime.unit} 温度:<${p.finalTemp.max}${p.finalTemp.unit}`;
        }
        break;
      case ProcessType.FILTRATION:
        if ('filtrationParams' in data) {
          return `${data.filtrationParams.precision.value}${data.filtrationParams.precision.unit}`;
        }
        break;
      case ProcessType.TRANSFER:
        if ('transferParams' in data) {
          const p = data.transferParams;
          const type = p.transferType === 'material' ? '料赶料' : p.transferType === 'water' ? '水赶料' : '无';
          return type + (p.waterVolume ? ` ${p.waterVolume.value}${p.waterVolume.unit}` : '');
        }
        break;
      case ProcessType.FLAVOR_ADDITION:
        if ('flavorAdditionParams' in data) {
          return data.flavorAdditionParams.method;
        }
        break;
      case ProcessType.OTHER:
        if ('params' in data && data.params) {
          return data.params;
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
                    <TableCell colSpan={9} className="py-2">
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
                            ({process.nodes.length}个步骤)
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {canEdit && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleAddNodeToProcess(process.id)}
                                title="添加步骤"
                              >
                                <Plus className="h-4 w-4 mr-1" />
                                添加步骤
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

                  {/* Process内的节点 */}
                  {isExpanded && process.nodes.map((node) => {
                    const isEditing = editingId === node.id;
                    const isHovered = hoveredNodeId === node.id;
                    const connections = getNodeConnections(node.id);

                    return (
                      <TableRow
                        key={node.id}
                        id={`row-${node.id}`}
                        className={`${isHovered ? 'bg-blue-50' : ''} ${!isExpanded ? 'hidden' : ''}`}
                        onMouseEnter={() => setHoveredNodeId(node.id)}
                        onMouseLeave={() => setHoveredNodeId(null)}
                      >
                        <TableCell>
                          <span className="text-xs text-gray-400">↑</span>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-sm">{node.id}</span>
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Input
                              value={editValues.label ?? node.data.label}
                              onChange={(e) =>
                                setEditValues({ ...editValues, label: e.target.value })
                              }
                              onBlur={() => handleSaveEdit(node.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEdit(node.id);
                                if (e.key === 'Escape') handleCancelEdit();
                              }}
                              autoFocus
                              disabled={!canEdit}
                            />
                          ) : (
                            <span
                              className={`${canEdit ? 'cursor-pointer hover:text-blue-600' : 'cursor-not-allowed opacity-60'}`}
                              onClick={() => canEdit && handleStartEdit(node)}
                            >
                              {node.data.label}
                              {!canEdit && <Lock className="ml-1 inline h-3 w-3" />}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-gray-600">
                            {getProcessTypeLabel(node.data.processType)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Input
                              value={editValues.deviceCode ?? node.data.deviceCode}
                              onChange={(e) =>
                                setEditValues({
                                  ...editValues,
                                  deviceCode: e.target.value,
                                })
                              }
                              onBlur={() => handleSaveEdit(node.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEdit(node.id);
                                if (e.key === 'Escape') handleCancelEdit();
                              }}
                              disabled={!canEdit}
                            />
                          ) : (
                            <span
                              className={`${canEdit ? 'cursor-pointer hover:text-blue-600' : 'cursor-not-allowed opacity-60'}`}
                              onClick={() => canEdit && handleStartEdit(node)}
                            >
                              {node.data.deviceCode}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Textarea
                              value={editValues.ingredients ?? node.data.ingredients}
                              onChange={(e) =>
                                setEditValues({
                                  ...editValues,
                                  ingredients: e.target.value,
                                })
                              }
                              onBlur={() => handleSaveEdit(node.id)}
                              rows={2}
                              className="min-w-[150px]"
                              disabled={!canEdit}
                            />
                          ) : (
                            <span
                              className={`text-xs ${canEdit ? 'cursor-pointer hover:text-blue-600' : 'cursor-not-allowed opacity-60'}`}
                              onClick={() => canEdit && handleStartEdit(node)}
                            >
                              {node.data.ingredients}
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
                              setParamsModalNodeId(node.id);
                            }}
                            className="w-full text-xs"
                            disabled={!canEdit}
                            title={!canEdit ? '需要编辑权限' : '点击编辑参数'}
                          >
                            <Edit2 className="mr-1 h-3 w-3" />
                            {formatParamsDisplay(node.data).substring(0, 20)}
                            {formatParamsDisplay(node.data).length > 20 ? '...' : ''}
                          </Button>
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
                              setConnectionModalNodeId(node.id);
                            }}
                            className="w-full"
                            disabled={!canEdit}
                            title={!canEdit ? '需要编辑权限或进入演示模式' : '配置连接'}
                          >
                            <ExternalLink className="mr-1 h-3 w-3" />
                            {connections.length > 0
                              ? `${connections.length}个连接`
                              : '配置'}
                          </Button>
                          {connections.length > 0 && (
                            <div className="mt-1 space-y-0.5 text-xs text-gray-500">
                              {connections.map((conn, idx) => (
                                <div key={idx}>
                                  → {conn.target} (Seq:{conn.sequence})
                                </div>
                              ))}
                            </div>
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
                              removeNode(node.id);
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

      {connectionModalNodeId && (
        <ConnectionModal
          nodeId={connectionModalNodeId}
          open={!!connectionModalNodeId}
          onOpenChange={(open) => !open && setConnectionModalNodeId(null)}
        />
      )}

      {paramsModalNodeId && (
        <ParamsModal
          nodeId={paramsModalNodeId}
          open={!!paramsModalNodeId}
          onOpenChange={(open) => !open && setParamsModalNodeId(null)}
        />
      )}
    </div>
  );
}
