import { useState } from 'react';
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
import { Plus, Trash2, ExternalLink, Lock } from 'lucide-react';
import { RecipeNode, ProcessType } from '@/types/recipe';

export function RecipeTable() {
  const {
    nodes,
    edges,
    addNode,
    updateNode,
    removeNode,
    hoveredNodeId,
    setHoveredNodeId,
  } = useRecipeStore();
  const { isEditable, mode } = useCollabStore();
  const canEdit = mode === 'demo' || isEditable();

  const [connectionModalNodeId, setConnectionModalNodeId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<RecipeNode['data']>>({});

  const handleAddNode = () => {
    if (!canEdit) {
      alert('需要编辑权限或进入演示模式');
      return;
    }
    const newId = `P${nodes.length + 1}`;
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
              <TableHead className="w-[100px]">ID</TableHead>
              <TableHead>步骤名称</TableHead>
              <TableHead>位置/设备</TableHead>
              <TableHead>原料/内容</TableHead>
              <TableHead>关键参数</TableHead>
              <TableHead>下一步</TableHead>
              <TableHead className="w-[100px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {nodes.map((node) => {
              const isEditing = editingId === node.id;
              const isHovered = hoveredNodeId === node.id;
              const connections = getNodeConnections(node.id);

              return (
                <TableRow
                  key={node.id}
                  id={`row-${node.id}`}
                  className={isHovered ? 'bg-blue-50' : ''}
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                >
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
                    {isEditing ? (
                      node.data.processType === ProcessType.OTHER ? (
                        <Textarea
                          value={editValues.params ?? (node.data.params || '')}
                          onChange={(e) =>
                            setEditValues({
                              ...editValues,
                              params: e.target.value,
                            })
                          }
                          onBlur={() => handleSaveEdit(node.id)}
                          rows={2}
                          className="min-w-[150px]"
                          disabled={!canEdit}
                        />
                      ) : (
                        <span className="text-xs text-gray-500">
                          {formatParamsDisplay(node.data)}
                        </span>
                      )
                    ) : (
                      <span
                        className={`text-xs font-mono ${canEdit ? 'cursor-pointer hover:text-blue-600' : 'cursor-not-allowed opacity-60'}`}
                        onClick={() => canEdit && handleStartEdit(node)}
                        title={canEdit ? '点击编辑' : '需要编辑权限'}
                      >
                        {formatParamsDisplay(node.data)}
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
          </TableBody>
        </Table>
      </div>

      <div className="border-t p-4">
        <Button 
          onClick={handleAddNode} 
          className="w-full"
          disabled={!canEdit}
          title={!canEdit ? '需要编辑权限或进入演示模式' : '添加新步骤'}
        >
          <Plus className="mr-2 h-4 w-4" />
          添加步骤
        </Button>
      </div>

      {connectionModalNodeId && (
        <ConnectionModal
          nodeId={connectionModalNodeId}
          open={!!connectionModalNodeId}
          onOpenChange={(open) => !open && setConnectionModalNodeId(null)}
        />
      )}
    </div>
  );
}
