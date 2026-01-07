import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ProcessType } from '@/types/recipe';
import { useProcessTypeConfigStore } from '@/store/useProcessTypeConfigStore';
import { getProcessTypeName } from '@/types/processTypeConfig';

interface AddSubStepDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (type: ProcessType) => void;
}

export function AddSubStepDialog({ open, onOpenChange, onConfirm }: AddSubStepDialogProps) {
    const [selectedType, setSelectedType] = useState<ProcessType | null>(null);
    const { subStepTemplates, getAllSubStepTypes } = useProcessTypeConfigStore();

    const handleConfirm = () => {
        if (selectedType) {
            onConfirm(selectedType);
            setSelectedType(null);
            onOpenChange(false);
        }
    };

    const handleCancel = () => {
        setSelectedType(null);
        onOpenChange(false);
    };

    const availableTypes = getAllSubStepTypes();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>选择子步骤类型</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                    <p className="text-sm text-gray-600 mb-4">选择要添加的子步骤类型，将使用该类型的默认配置：</p>
                    <div className="grid grid-cols-2 gap-3">
                        {availableTypes.map((type) => {
                            const template = subStepTemplates[type];
                            if (!template) return null;
                            const isSelected = selectedType === type;
                            return (
                                <Button
                                    key={type}
                                    variant={isSelected ? 'default' : 'outline'}
                                    className={`h-auto py-3 px-4 flex flex-col items-start ${isSelected ? '' : 'hover:bg-blue-50'}`}
                                    onClick={() => setSelectedType(type)}
                                >
                                    <span className="font-medium">{getProcessTypeName(type)}</span>
                                    <span className="text-xs opacity-70 mt-1">{template.description || template.label}</span>
                                </Button>
                            );
                        })}
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={handleCancel}>取消</Button>
                    <Button onClick={handleConfirm} disabled={!selectedType}>确认添加</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
