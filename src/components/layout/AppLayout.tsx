import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useRecipeStore } from '@/store/useRecipeStore';
import { useCollabStore } from '@/store/useCollabStore';
import { StatusBar } from '@/components/collab/StatusBar';
import { DemoModeBanner } from '@/components/collab/DemoModeBanner';
import { Download, Upload, RotateCcw } from 'lucide-react';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { exportJSON, importJSON, reset } = useRecipeStore();
  const { mode } = useCollabStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const json = exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recipe-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        importJSON(text);
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b bg-slate-900 px-6 py-3">
        <h1 className="text-xl font-bold text-white">MES 工艺流程编辑器</h1>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleExport}
            disabled={mode === 'demo'}
            title={mode === 'demo' ? '演示模式下请使用"导出演示数据"' : ''}
          >
            <Download className="mr-2 h-4 w-4" />
            Export JSON
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleImport}
            disabled={mode !== 'edit'}
            title={mode !== 'edit' ? '需要编辑权限' : ''}
          >
            <Upload className="mr-2 h-4 w-4" />
            Import JSON
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button 
            variant="outline" 
            size="sm" 
            onClick={reset}
            disabled={mode !== 'edit'}
            title={mode !== 'edit' ? '需要编辑权限' : ''}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset
          </Button>
        </div>
      </header>

      {/* Status Bar */}
      <StatusBar />

      {/* Demo Mode Banner */}
      <DemoModeBanner />

      {/* Main Content */}
      <main className="flex flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
