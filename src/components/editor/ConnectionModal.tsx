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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useRecipeStore, useFlatNodes } from '@/store/useRecipeStore';
import { RecipeEdge } from '@/types/recipe';
import { Trash2 } from 'lucide-react';

interface ConnectionModalProps {
  nodeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConnectionModal({ nodeId, open, onOpenChange }: ConnectionModalProps) {
  const nodes = useFlatNodes(); // 使用展平的节点数组
  const { edges, addEdge, removeEdge } = useRecipeStore();
  const [targetNodeId, setTargetNodeId] = useState('');
  const [sequenceOrder, setSequenceOrder] = useState(1);

  // 获取当前节点的所有输出连接
  const currentConnections = edges.filter((edge) => edge.source === nodeId);

  // 可用的目标节点（排除自身）
  const availableTargets = nodes.filter((node) => node.id !== nodeId);

  const handleAddConnection = () => {
    if (!targetNodeId) return;

    // 检查是否已存在相同的连接
    const existingEdge = edges.find(
      (edge) => edge.source === nodeId && edge.target === targetNodeId
    );

    if (existingEdge) {
      alert('该连接已存在');
      return;
    }

    const newEdge: RecipeEdge = {
      id: `e_${nodeId}-${targetNodeId}-${Date.now()}`,
      source: nodeId,
      target: targetNodeId,
      type: 'sequenceEdge',
      data: { sequenceOrder },
      animated: true,
    };

    addEdge(newEdge);
    setTargetNodeId('');
    setSequenceOrder(1);
  };

  const handleDeleteConnection = (edgeId: string) => {
    removeEdge(edgeId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>配置 {nodeId} 的输出流向</DialogTitle>
          <DialogDescription>
            添加或管理该节点的输出连接，并设置投料顺序
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 添加新连接 */}
          <div className="space-y-2">
            <Label>目标节点</Label>
            <Select value={targetNodeId} onValueChange={setTargetNodeId}>
              <SelectTrigger>
                <SelectValue placeholder="选择目标节点" />
              </SelectTrigger>
              <SelectContent>
                {availableTargets.map((node) => (
                  <SelectItem key={node.id} value={node.id}>
                    {node.id} - {node.data.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>序列顺序</Label>
            <Input
              type="number"
              min="1"
              value={sequenceOrder}
              onChange={(e) => setSequenceOrder(Number(e.target.value))}
            />
          </div>

          <Button onClick={handleAddConnection} className="w-full">
            添加连接
          </Button>

          {/* 已有连接列表 */}
          {currentConnections.length > 0 && (
            <div className="space-y-2">
              <Label>已有连接</Label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {currentConnections.map((edge) => {
                  const targetNode = nodes.find((n) => n.id === edge.target);
                  return (
                    <div
                      key={edge.id}
                      className="flex items-center justify-between rounded-md border p-2"
                    >
                      <div>
                        <span className="font-medium">
                          → {edge.target} ({targetNode?.data.label})
                        </span>
                        <span className="ml-2 text-sm text-gray-500">
                          序列: {edge.data.sequenceOrder}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteConnection(edge.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
