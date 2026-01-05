import React, { useState } from 'react';
import { FieldConfig, FieldInputType } from '@/types/fieldConfig';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Edit, Plus, Trash2, ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { v4 as uuidv4 } from 'uuid';
import { SelectOptionsEditor } from './SelectOptionsEditor';

interface NestedFieldEditorProps {
    fields: FieldConfig[];
    onChange: (fields: FieldConfig[]) => void;
    processType: string; // needed for new fields
}

const INPUT_TYPES: { value: FieldInputType; label: string }[] = [
    { value: 'text', label: '文本' },
    { value: 'number', label: '数字' },
    { value: 'select', label: '下拉选择' },
    { value: 'range', label: '范围' },
    { value: 'conditionValue', label: '条件数值' },
    // Nested recursion is limited for now, but technically we could allow object in object
    // { value: 'object', label: '对象' }, 
];

export const NestedFieldEditor: React.FC<NestedFieldEditorProps> = ({ fields = [], onChange, processType }) => {
    const [view, setView] = useState<'list' | 'edit'>('list');
    const [editingField, setEditingField] = useState<Partial<FieldConfig> | null>(null);

    const handleAdd = () => {
        setEditingField({
            id: uuidv4(),
            processType: processType as any,
            key: '',
            label: '',
            inputType: 'text',
            sortOrder: fields.length,
            enabled: true,
            isSystem: false,
        });
        setView('edit');
    };

    const handleEdit = (field: FieldConfig) => {
        setEditingField({ ...field });
        setView('edit');
    };

    const handleDelete = (id: string) => {
        onChange(fields.filter(f => f.id !== id));
    };

    const handleSave = () => {
        if (!editingField || !editingField.key || !editingField.label) return;

        const newField = editingField as FieldConfig;

        let newFields = [...fields];
        const index = newFields.findIndex(f => f.id === newField.id);

        if (index >= 0) {
            newFields[index] = newField;
        } else {
            newFields.push(newField);
        }

        onChange(newFields);
        setView('list');
        setEditingField(null);
    };

    if (view === 'edit' && editingField) {
        return (
            <div className="space-y-4 border rounded-md p-4 bg-slate-50">
                <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm">编辑嵌套字段</h4>
                    <Button variant="ghost" size="sm" onClick={() => setView('list')}>
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        返回列表
                    </Button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Key</Label>
                        <Input
                            value={editingField.key}
                            onChange={e => setEditingField({ ...editingField, key: e.target.value })}
                            placeholder="e.g. name"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>显示名称</Label>
                        <Input
                            value={editingField.label}
                            onChange={e => setEditingField({ ...editingField, label: e.target.value })}
                            placeholder="e.g. 姓名"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>输入类型</Label>
                        <Select
                            value={editingField.inputType}
                            onValueChange={(v) => setEditingField({ ...editingField, inputType: v as FieldInputType })}
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
                            value={editingField.unit || ''}
                            onChange={e => setEditingField({ ...editingField, unit: e.target.value })}
                            placeholder="e.g. kg"
                        />
                    </div>
                </div>

                {editingField.inputType === 'select' && (
                    <SelectOptionsEditor
                        options={editingField.options || []}
                        onChange={opts => setEditingField({ ...editingField, options: opts })}
                    />
                )}

                <div className="flex items-center space-x-2">
                    <input
                        type="checkbox"
                        id="nested-required-check"
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        checked={editingField.validation?.required || false}
                        onChange={e => setEditingField({
                            ...editingField,
                            validation: { ...editingField.validation, required: e.target.checked }
                        })}
                    />
                    <Label htmlFor="nested-required-check" className="cursor-pointer">必填项</Label>
                </div>

                <div className="flex justify-end pt-2">
                    <Button onClick={handleSave}>保存字段</Button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <div className="flex justify-between items-center">
                <Label>嵌套字段列表</Label>
                <Button type="button" variant="outline" size="sm" onClick={handleAdd}>
                    <Plus className="w-4 h-4 mr-2" />
                    添加字段
                </Button>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="h-8">名称</TableHead>
                            <TableHead className="h-8">Key</TableHead>
                            <TableHead className="h-8">类型</TableHead>
                            <TableHead className="h-8 text-right">操作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {fields.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center py-4 text-muted-foreground text-xs">
                                    暂无字段
                                </TableCell>
                            </TableRow>
                        ) : (
                            fields.map((field) => (
                                <TableRow key={field.id} className="h-10">
                                    <TableCell className="font-medium p-2 text-sm">{field.label}</TableCell>
                                    <TableCell className="p-2 text-xs font-mono">{field.key}</TableCell>
                                    <TableCell className="p-2">
                                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-5">
                                            {field.inputType}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="p-2 text-right">
                                        <div className="flex justify-end gap-1">
                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEdit(field)}>
                                                <Edit className="w-3 h-3" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => handleDelete(field.id)}>
                                                <Trash2 className="w-3 h-3" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};
