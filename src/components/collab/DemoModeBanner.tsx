import { useCollabStore } from '@/store/useCollabStore';

export function DemoModeBanner() {
  const { mode } = useCollabStore();

  if (mode !== 'demo') return null;

  return (
    <div className="bg-orange-500 text-white px-4 py-2 text-sm font-medium text-center">
      🎮 演示模式 - 您的修改不会保存到服务器
    </div>
  );
}
