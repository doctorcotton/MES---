import { useCollabStore } from '@/store/useCollabStore';
import { EditLockButton } from './EditLockButton';
import { DemoModeButton } from './DemoModeButton';
import { OnlineUsers } from './OnlineUsers';
import { Eye, Edit, Gamepad2 } from 'lucide-react';

export function StatusBar() {
  const { mode, lockStatus, getOnlineUsersCount } = useCollabStore();
  const onlineCount = getOnlineUsersCount();

  const getModeIcon = () => {
    switch (mode) {
      case 'edit':
        return <Edit className="h-4 w-4" />;
      case 'demo':
        return <Gamepad2 className="h-4 w-4" />;
      default:
        return <Eye className="h-4 w-4" />;
    }
  };

  const getModeText = () => {
    switch (mode) {
      case 'edit':
        return '编辑模式';
      case 'demo':
        return '演示模式';
      default:
        return '查看模式';
    }
  };

  return (
    <div className="flex items-center justify-between border-b bg-slate-800 px-4 py-2 text-sm text-white">
      <div className="flex items-center gap-4">
        {/* 模式指示 */}
        <div className="flex items-center gap-2">
          {getModeIcon()}
          <span className="font-medium">{getModeText()}</span>
        </div>

        {/* 编辑者信息 */}
        {lockStatus.isLocked && (
          <div className="flex items-center gap-2">
            <span className="text-slate-400">编辑者：</span>
            <span className="font-medium">{lockStatus.userName}</span>
          </div>
        )}

        {/* 在线人数 */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400">在线：</span>
          <span className="font-medium">{onlineCount}人</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <EditLockButton />
        <DemoModeButton />
        <OnlineUsers />
      </div>
    </div>
  );
}
