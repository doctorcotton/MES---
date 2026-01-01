import { Button } from '@/components/ui/button';
import { useEditLock } from '@/hooks/useEditLock';
import { useCollabStore } from '@/store/useCollabStore';
import { Lock, Unlock, Loader2 } from 'lucide-react';
import { useState } from 'react';

export function EditLockButton() {
  const { mode } = useCollabStore();
  const { acquireLock, releaseLock, isLocked, isLockedByMe, lockHolder } = useEditLock();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (isLockedByMe) {
      // 释放锁
      setLoading(true);
      await releaseLock();
      setLoading(false);
    } else if (!isLocked) {
      // 申请锁
      setLoading(true);
      const result = await acquireLock();
      setLoading(false);
      if (!result.success) {
        alert(result.message || '获取编辑权失败');
      }
    } else {
      // 锁被其他人占用
      alert(`编辑权已被 ${lockHolder} 占用，请等待其释放`);
    }
  };

  if (mode === 'demo') {
    return null; // 演示模式下不显示
  }

  if (isLockedByMe) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={loading}
        className="bg-green-600 text-white hover:bg-green-700"
      >
        {loading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Unlock className="mr-2 h-4 w-4" />
        )}
        释放编辑权
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={loading || isLocked}
      className={`${isLocked ? 'opacity-50 cursor-not-allowed' : ''} text-slate-900`}
    >
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Lock className="mr-2 h-4 w-4" />
      )}
      {isLocked ? `等待 ${lockHolder} 释放` : '申请编辑'}
    </Button>
  );
}
