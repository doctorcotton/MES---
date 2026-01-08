import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useCollabStore } from '@/store/useCollabStore';
import { Users } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export function OnlineUsers() {
  const { onlineUsers, userId } = useCollabStore();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-slate-900">
          <Users className="mr-2 h-4 w-4" />
          在线用户 ({onlineUsers.length})
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>在线用户</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {onlineUsers.length === 0 ? (
            <p className="text-sm text-gray-500">暂无在线用户</p>
          ) : (
            onlineUsers.map((user) => (
              <div
                key={user.socketId}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`h-3 w-3 rounded-full ${user.mode === 'edit'
                        ? 'bg-green-500'
                        : user.mode === 'demo'
                          ? 'bg-orange-500'
                          : 'bg-gray-400'
                      }`}
                  />
                  <div>
                    <div className="font-medium">
                      {user.userName}
                      {user.userId === userId && ' (我)'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {user.mode === 'edit'
                        ? '编辑模式'
                        : user.mode === 'demo'
                          ? '演示模式'
                          : '查看模式'}
                      {user.ip && ` · ${user.ip}`}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
