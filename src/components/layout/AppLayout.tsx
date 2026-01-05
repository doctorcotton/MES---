import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useRecipeStore } from '@/store/useRecipeStore';
import { useCollabStore } from '@/store/useCollabStore';
import { StatusBar } from '@/components/collab/StatusBar';
import { DemoModeBanner } from '@/components/collab/DemoModeBanner';
import { Download, Upload, RotateCcw, Save, Loader2, Settings } from 'lucide-react';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { exportJSON, importJSON, reset, saveToServer, isSaving } = useRecipeStore();
  const { mode, userId, isLockedByMe } = useCollabStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);

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

  const handleSave = async () => {
    if (!isLockedByMe() || mode !== 'edit') {
      alert('需要编辑权限');
      return;
    }

    if (!userId) {
      console.error('[保存] 错误:userId 为空');
      alert('用户ID未设置,请刷新页面重试');
      return;
    }

    console.log('[保存] 用户点击保存按钮', {
      userId,
      isLockedByMe: isLockedByMe()
    });

    setSaving(true);
    try {
      const success = await saveToServer(userId);
      if (success) {
        console.log('[保存] 保存成功,已更新到服务器');
        // 可以添加更友好的提示,但保持简洁
      } else {
        console.error('[保存] 保存失败');
        alert('保存失败,请重试。如果持续失败,请检查是否持有编辑权限。');
      }
    } catch (error) {
      console.error('[保存] 保存异常:', error);
      alert('保存失败,请重试');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b bg-slate-900 px-6 py-3">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-white">MES 工艺流程编辑器</h1>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/config')}
            className="bg-slate-800 hover:bg-slate-700 text-white border-slate-600"
          >
            <Settings className="mr-2 h-4 w-4" />
            配置
          </Button>
        </div>
        <div className="flex gap-2">
          {mode === 'edit' && isLockedByMe() && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSave}
              disabled={saving || isSaving}
              title="保存到服务器"
            >
              {saving || isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              保存
            </Button>
          )}
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
