import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, GripVertical } from 'lucide-react';

interface Option {
    label: string;
    value: string;
}

interface SelectOptionsEditorProps {
    options: Option[];
    onChange: (options: Option[]) => void;
}

export const SelectOptionsEditor: React.FC<SelectOptionsEditorProps> = ({ options = [], onChange }) => {
    const handleAdd = () => {
        onChange([...options, { label: '', value: '' }]);
    };

    const handleRemove = (index: number) => {
        const newOptions = [...options];
        newOptions.splice(index, 1);
        onChange(newOptions);
    };

    const handleChange = (index: number, key: keyof Option, value: string) => {
        const newOptions = [...options];
        newOptions[index] = { ...newOptions[index], [key]: value };
        onChange(newOptions);
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <Label>选项列表</Label>
                <Button type="button" variant="outline" size="sm" onClick={handleAdd} className="h-7 px-2">
                    <Plus className="w-3 h-3 mr-1" />
                    添加选项
                </Button>
            </div>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {options.map((option, index) => (
                    <div key={index} className="flex items-center gap-2">
                        <GripVertical className="w-4 h-4 text-slate-400 cursor-grab" />
                        <Input
                            placeholder="值 (Value)"
                            className="flex-1 h-8 text-xs font-mono"
                            value={option.value}
                            onChange={(e) => handleChange(index, 'value', e.target.value)}
                        />
                        <Input
                            placeholder="显示名称 (Label)"
                            className="flex-1 h-8 text-xs"
                            value={option.label}
                            onChange={(e) => handleChange(index, 'label', e.target.value)}
                        />
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-red-500"
                            onClick={() => handleRemove(index)}
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </div>
                ))}
            </div>
            {options.length === 0 && (
                <div className="text-center py-4 border border-dashed rounded-md text-slate-400 text-xs">
                    暂无选项
                </div>
            )}
        </div>
    );
};
