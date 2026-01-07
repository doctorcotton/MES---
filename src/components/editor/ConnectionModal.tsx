import { useState } from 'react';
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
import { useRecipeStore } from '@/store/useRecipeStore';
import { RecipeEdge } from '@/types/recipe';
import { Trash2 } from 'lucide-react';

interface ConnectionModalProps {
  nodeId: string; // 保持参数名兼容，但实际是 processId
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConnectionModal({ nodeId, open, onOpenChange }: ConnectionModalProps) {
  const { processes, edges, addEdge, removeEdge } = useRecipeStore();
  const processId = nodeId; // nodeId 实际是工艺段ID
  const [targetProcessId, setTargetProcessId] = useState('');
  const [sequenceOrder, setSequenceOrder] = useState(1);

  // 获取当前工艺段的所有输出连接
  const currentConnections = edges.filter((edge) => edge.source === processId);

  // 可用的目标工艺段（排除自身）
  const availableTargets = processes.filter((process) => process.id !== processId);

  const handleAddConnection = () => {
    if (!targetProcessId) return;

    // 检查是否已存在相同的连接
    const existingEdge = edges.find(
      (edge) => edge.source === processId && edge.target === targetProcessId
    );

    if (existingEdge) {
      alert('该连接已存在');
      return;
    }

    const newEdge: RecipeEdge = {
      id: `e_${processId}-${targetProcessId}-${Date.now()}`,
      source: processId,
      target: targetProcessId,
      type: 'sequenceEdge',
      data: { sequenceOrder },
      // 不在这里设置 animated，由 useFlowEdges 根据编辑态动态决定
    };

    addEdge(newEdge);
    setTargetProcessId('');
    setSequenceOrder(1);
  };

  const handleDeleteConnection = (edgeId: string) => {
    removeEdge(edgeId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>配置 {processId} 的输出流向</DialogTitle>
          <DialogDescription>
            添加或管理该工艺段的输出连接，并设置投料顺序
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 添加新连接 */}
          <div className="space-y-2">
            <Label>目标工艺段</Label>
            <Select value={targetProcessId} onValueChange={setTargetProcessId}>
              <SelectTrigger>
                <SelectValue placeholder="选择目标工艺段" />
              </SelectTrigger>
              <SelectContent>
                {availableTargets.map((process) => (
                  <SelectItem key={process.id} value={process.id}>
                    {process.id} - {process.name}
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
                  const targetProcess = processes.find((p) => p.id === edge.target);
                  return (
                    <div
                      key={edge.id}
                      className="flex items-center justify-between rounded-md border p-2"
                    >
                      <div>
                        <span className="font-medium">
                          → {edge.target} ({targetProcess?.name})
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
