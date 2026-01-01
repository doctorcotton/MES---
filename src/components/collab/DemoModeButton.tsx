import { Button } from '@/components/ui/button';
import { useDemoMode } from '@/hooks/useDemoMode';
import { useCollabStore } from '@/store/useCollabStore';
import { Gamepad2, X, Download } from 'lucide-react';

export function DemoModeButton() {
  const { mode } = useCollabStore();
  const { isDemoMode, enterDemoMode, exitDemoMode, exportDemoData } = useDemoMode();

  if (isDemoMode) {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={exportDemoData}
          className="bg-orange-100 text-orange-700 hover:bg-orange-200"
        >
          <Download className="mr-2 h-4 w-4" />
          导出演示数据
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={exitDemoMode}
          className="bg-orange-600 text-white hover:bg-orange-700"
        >
          <X className="mr-2 h-4 w-4" />
          退出演示模式
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={enterDemoMode}
      disabled={mode === 'edit'}
      className={`${mode === 'edit' ? 'opacity-50 cursor-not-allowed' : ''} text-slate-900`}
      title={mode === 'edit' ? '请先释放编辑权' : '进入演示模式'}
    >
      <Gamepad2 className="mr-2 h-4 w-4" />
      演示模式
    </Button>
  );
}
