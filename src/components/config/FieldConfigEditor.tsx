import React, { useEffect, useState } from 'react';
import { useFieldConfigStore } from '@/store/useFieldConfigStore';
import { FieldConfig, ProcessType, FieldInputType } from '@/types/fieldConfig';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Trash2, Edit, Plus } from 'lucide-react';

const PROCESS_TYPES: { value: ProcessType; label: string }[] = [
    { value: ProcessType.DISSOLUTION, label: '溶解' },
    { value: ProcessType.COMPOUNDING, label: '调配' },
    { value: ProcessType.FILTRATION, label: '过滤' },
    { value: ProcessType.TRANSFER, label: '赶料' },
    { value: ProcessType.FLAVOR_ADDITION, label: '香精添加' },
    { value: ProcessType.OTHER, label: '其他' },
];

const INPUT_TYPES: { value: FieldInputType; label: string }[] = [
    { value: 'text', label: '文本' },
    { value: 'number', label: '数字' },
    { value: 'select', label: '下拉选择' },
    { value: 'conditionValue', label: '条件数值' },
    { value: 'range', label: '范围 (暂未支持)' },
    { value: 'waterRatio', label: '料水比 (暂未支持)' },
];

export const FieldConfigEditor: React.FC = () => {
    const {
        configs, isLoading, error,
        fetchConfigs, addConfig, updateConfig, deleteConfig
    } = useFieldConfigStore();

    const [selectedType, setSelectedType] = useState<ProcessType>(ProcessType.DISSOLUTION);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingConfig, setEditingConfig] = useState<Partial<FieldConfig> | null>(null);

    useEffect(() => {
        fetchConfigs();
    }, []);

    const filteredConfigs = configs
        .filter(c => c.processType === selectedType)
        .sort((a, b) => a.sortOrder - b.sortOrder);

    const handleSave = async () => {
        if (!editingConfig) return;

        try {
            if (editingConfig.id) {
                await updateConfig(editingConfig.id, editingConfig);
            } else {
                await addConfig({
                    ...editingConfig,
                    processType: selectedType,
                    sortOrder: filteredConfigs.length
                });
            }
            setIsDialogOpen(false);
            setEditingConfig(null);
        } catch (e) {
            console.error(e);
            alert('Save failed');
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm('Are you sure used want to delete this field?')) {
            await deleteConfig(id);
        }
    };

    const openAddDialog = () => {
        setEditingConfig({
            processType: selectedType,
            inputType: 'text',
            enabled: true,
            isSystem: false
        });
        setIsDialogOpen(true);
    };

    const openEditDialog = (config: FieldConfig) => {
        setEditingConfig({ ...config });
        setIsDialogOpen(true);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center space-x-4">
                <Label>选择工艺类型:</Label>
                <Select value={selectedType} onValueChange={(v) => setSelectedType(v as ProcessType)}>
                    <SelectTrigger className="w-[200px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {PROCESS_TYPES.map(t => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Button onClick={openAddDialog}>
                    <Plus className="w-4 h-4 mr-2" />
                    添加字段
                </Button>
            </div>

            {isLoading && <div>Loading...</div>}
            {error && <div className="text-red-500">{error}</div>}

            <div className="grid gap-4">
                {filteredConfigs.map((config) => (
                    <Card key={config.id} className="p-4 flex items-center justify-between">
                        <div className="flex-1">
                            <div className="font-bold">{config.label} <span className="text-gray-400 text-sm">({config.key})</span></div>
                            <div className="text-sm text-gray-500">
                                Type: {config.inputType} | Unit: {config.unit || '-'} | Required: {config.validation?.required ? 'Yes' : 'No'}
                            </div>
                            {config.isSystem && <span className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600">System</span>}
                        </div>
                        <div className="flex items-center space-x-2">
                            <Button variant="ghost" size="sm" onClick={() => openEditDialog(config)}>
                                <Edit className="w-4 h-4" />
                            </Button>
                            {!config.isSystem && (
                                <Button variant="ghost" size="sm" onClick={() => handleDelete(config.id)} className="text-red-500">
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            )}
                        </div>
                    </Card>
                ))}
                {filteredConfigs.length === 0 && !isLoading && (
                    <div className="text-center text-gray-500 py-8">
                        该工艺类型暂无字段配置
                    </div>
                )}
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editingConfig?.id ? '编辑字段' : '添加字段'}</DialogTitle>
                    </DialogHeader>
                    {editingConfig && (
                        <div className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>字段Key (英文)</Label>
                                    <Input
                                        value={editingConfig.key || ''}
                                        onChange={e => setEditingConfig({ ...editingConfig, key: e.target.value })}
                                        disabled={!!editingConfig.id && editingConfig.isSystem} // System keys cannot be changed? Logic says update allowed but risky.
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>显示名称</Label>
                                    <Input
                                        value={editingConfig.label || ''}
                                        onChange={e => setEditingConfig({ ...editingConfig, label: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>输入类型</Label>
                                <Select
                                    value={editingConfig.inputType}
                                    onValueChange={(v) => setEditingConfig({ ...editingConfig, inputType: v as FieldInputType })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {INPUT_TYPES.map(t => (
                                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>单位</Label>
                                <Input
                                    value={editingConfig.unit || ''}
                                    onChange={e => setEditingConfig({ ...editingConfig, unit: e.target.value })}
                                />
                            </div>

                            {/* Simplified options editor for Select type */}
                            {editingConfig.inputType === 'select' && (
                                <div className="space-y-2">
                                    <Label>选项 (JSON格式: {"[{'value':'v','label':'l'}]"})</Label>
                                    <Input
                                        value={JSON.stringify(editingConfig.options || [])}
                                        onChange={e => {
                                            try {
                                                const opts = JSON.parse(e.target.value);
                                                setEditingConfig({ ...editingConfig, options: opts });
                                            } catch (err) {
                                                // ignore parse error while typing
                                            }
                                        }}
                                    />
                                </div>
                            )}

                            <div className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    checked={editingConfig.validation?.required || false}
                                    onChange={e => setEditingConfig({
                                        ...editingConfig,
                                        validation: { ...editingConfig.validation, required: e.target.checked }
                                    })}
                                />
                                <Label>必填</Label>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>取消</Button>
                        <Button onClick={handleSave}>保存</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};
