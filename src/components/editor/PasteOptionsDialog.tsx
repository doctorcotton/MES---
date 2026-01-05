import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

export type PasteMode = 'keep' | 'update';

interface PasteOptionsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (mode: PasteMode) => void;
    sourceName: string;
    hasTemplateChanges: boolean;
}

export function PasteOptionsDialog({
    open,
    onOpenChange,
    onConfirm,
    sourceName,
    hasTemplateChanges,
}: PasteOptionsDialogProps) {
    const handleSelect = (mode: PasteMode) => {
        onConfirm(mode);
        onOpenChange(false);
    };

    // 如果没有模板变更，直接保留原数据
    if (!hasTemplateChanges) {
        return null;
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-amber-500" />
                        检测到配置变更
                    </DialogTitle>
                    <DialogDescription>
                        工艺段 "{sourceName}" 的模板配置已更新，请选择粘贴方式：
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-3">
                    <Button
                        variant="outline"
                        className="w-full h-auto py-4 px-4 flex flex-col items-start text-left"
                        onClick={() => handleSelect('update')}
                    >
                        <span className="font-medium text-blue-600">应用新配置</span>
                        <span className="text-xs text-gray-500 mt-1">
                            使用最新的模板配置创建子步骤，旧参数将被替换
                        </span>
                    </Button>
                    <Button
                        variant="outline"
                        className="w-full h-auto py-4 px-4 flex flex-col items-start text-left"
                        onClick={() => handleSelect('keep')}
                    >
                        <span className="font-medium">保留原数据</span>
                        <span className="text-xs text-gray-500 mt-1">
                            保持原工艺段的参数不变，直接复制
                        </span>
                    </Button>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>取消</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
