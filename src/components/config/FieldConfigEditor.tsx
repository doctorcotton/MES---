import React, { useEffect, useState, useMemo } from 'react';
import { useFieldConfigStore } from '@/store/useFieldConfigStore';
import { useRecipeStore } from '@/store/useRecipeStore';
import { FieldConfig, ProcessType, FieldInputType } from '@/types/fieldConfig';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/ui/tabs';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, Edit, Plus, Search, BarChart3, List, AlertCircle } from 'lucide-react';
import { getProcessTypeName } from '@/types/processTypeConfig';

const PROCESS_TYPES: { value: ProcessType; label: string }[] = Object.values(ProcessType).map(type => ({
    value: type,
    label: getProcessTypeName(type)
}));

const INPUT_TYPES: { value: FieldInputType; label: string }[] = [
    { value: 'text', label: '文本' },
    { value: 'number', label: '数字' },
    { value: 'select', label: '下拉选择' },
    { value: 'conditionValue', label: '条件数值' },
    { value: 'range', label: '范围' },
    { value: 'waterRatio', label: '料水比' },
];

export const FieldConfigEditor: React.FC = () => {
    const {
        configs, isLoading, error,
        fetchConfigs, addConfig, updateConfig, deleteConfig
    } = useFieldConfigStore();
    const { processes } = useRecipeStore();

    const [selectedType, setSelectedType] = useState<ProcessType>(ProcessType.DISSOLUTION);
    const [searchQuery, setSearchQuery] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingConfig, setEditingConfig] = useState<Partial<FieldConfig> | null>(null);

    useEffect(() => {
        fetchConfigs();
    }, []);

    const filteredConfigs = useMemo(() => {
        return configs
            .filter(c => c.processType === selectedType)
            .filter(c =>
                c.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.key.toLowerCase().includes(searchQuery.toLowerCase())
            )
            .sort((a, b) => a.sortOrder - b.sortOrder);
    }, [configs, selectedType, searchQuery]);

    const usageStats = useMemo(() => {
        const stats: Record<string, { count: number; locations: string[] }> = {};

        // Initialize for current filtered configs
        filteredConfigs.forEach(c => {
            stats[c.key] = { count: 0, locations: [] };
        });

        processes.forEach(p => {
            p.node.subSteps.forEach(s => {
                if (s.processType !== selectedType) return;

                // Helper to safely access params
                let stepParams: any = {};
                if (s.processType === ProcessType.DISSOLUTION && 'dissolutionParams' in s.params) stepParams = s.params.dissolutionParams;
                else if (s.processType === ProcessType.COMPOUNDING && 'compoundingParams' in s.params) stepParams = s.params.compoundingParams;
                else if (s.processType === ProcessType.FILTRATION && 'filtrationParams' in s.params) stepParams = s.params.filtrationParams;
                else if (s.processType === ProcessType.TRANSFER && 'transferParams' in s.params) stepParams = s.params.transferParams;
                else if (s.processType === ProcessType.FLAVOR_ADDITION && 'flavorAdditionParams' in s.params) stepParams = s.params.flavorAdditionParams;

                Object.keys(stepParams).forEach(key => {
                    if (stats[key]) {
                        stats[key].count++;
                        stats[key].locations.push(`${p.name} > ${s.label}`);
                    }
                });
            });
        });

        return stats;
    }, [filteredConfigs, processes, selectedType]);

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
        if (confirm('Are you sure you want to delete this field?')) {
            await deleteConfig(id);
        }
    };

    const openAddDialog = () => {
        setEditingConfig({
            processType: selectedType,
            inputType: 'text',
            enabled: true,
            isSystem: false,
            label: '',
            key: '',
            unit: ''
        });
        setIsDialogOpen(true);
    };

    const openEditDialog = (config: FieldConfig) => {
        setEditingConfig({ ...config });
        setIsDialogOpen(true);
    };

    return (
        <div className="h-full flex flex-col space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">工艺类型</Label>
                        <Select value={selectedType} onValueChange={(v) => setSelectedType(v as ProcessType)}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {PROCESS_TYPES.map(t => (
                                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">搜索字段</Label>
                        <div className="relative">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="搜索名称或Key..."
                                className="pl-8 w-[200px]"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
                <Button onClick={openAddDialog}>
                    <Plus className="w-4 h-4 mr-2" />
                    新建字段
                </Button>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-md flex items-center text-sm">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    {error}
                </div>
            )}

            <Tabs defaultValue="list" className="flex-1 flex flex-col">
                <TabsList>
                    <TabsTrigger value="list"><List className="w-4 h-4 mr-2" />字段列表</TabsTrigger>
                    <TabsTrigger value="usage"><BarChart3 className="w-4 h-4 mr-2" />使用统计</TabsTrigger>
                </TabsList>

                <TabsContent value="list" className="flex-1 border rounded-md mt-2">
                    <ScrollArea className="h-[500px]">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[100px]">Key</TableHead>
                                    <TableHead className="w-[150px]">名称</TableHead>
                                    <TableHead>类型</TableHead>
                                    <TableHead>单位</TableHead>
                                    <TableHead className="text-center">必填</TableHead>
                                    <TableHead className="text-center">系统字段</TableHead>
                                    <TableHead className="text-right">操作</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredConfigs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                            暂无字段配置
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredConfigs.map((config) => (
                                        <TableRow key={config.id}>
                                            <TableCell className="font-mono text-xs">{config.key}</TableCell>
                                            <TableCell className="font-medium">{config.label}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{INPUT_TYPES.find(t => t.value === config.inputType)?.label || config.inputType}</Badge>
                                            </TableCell>
                                            <TableCell>{config.unit || '-'}</TableCell>
                                            <TableCell className="text-center">
                                                {config.validation?.required ? <span className="text-green-600">Yes</span> : <span className="text-gray-300">No</span>}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {config.isSystem && <Badge variant="secondary" className="text-xs">System</Badge>}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end items-center gap-2">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(config)}>
                                                        <Edit className="w-4 h-4" />
                                                    </Button>
                                                    {!config.isSystem && (
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={() => handleDelete(config.id)}>
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </TabsContent>

                <TabsContent value="usage" className="flex-1 border rounded-md mt-2">
                    <ScrollArea className="h-[500px]">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[150px]">字段名称</TableHead>
                                    <TableHead className="w-[100px]">Key</TableHead>
                                    <TableHead className="w-[100px]">使用次数</TableHead>
                                    <TableHead>使用位置 (Top 5)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredConfigs.map((config) => {
                                    const stat = usageStats[config.key];
                                    return (
                                        <TableRow key={config.id}>
                                            <TableCell className="font-medium">{config.label}</TableCell>
                                            <TableCell className="font-mono text-xs">{config.key}</TableCell>
                                            <TableCell>
                                                <Badge variant={stat.count > 0 ? "default" : "secondary"}>
                                                    {stat.count}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-1">
                                                    {stat.locations.length > 0 ? (
                                                        <>
                                                            {stat.locations.slice(0, 5).map((loc, idx) => (
                                                                <span key={idx} className="text-xs text-muted-foreground">{loc}</span>
                                                            ))}
                                                            {stat.locations.length > 5 && (
                                                                <span className="text-xs text-muted-foreground italic">...等共{stat.locations.length}处</span>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <span className="text-xs text-gray-300">未使用</span>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </TabsContent>
            </Tabs>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editingConfig?.id ? '编辑字段配置' : '新建字段配置'}</DialogTitle>
                        <DialogDescription>
                            配置字段的显示名称、类型、单位及校验规则。
                        </DialogDescription>
                    </DialogHeader>
                    {editingConfig && (
                        <div className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>字段Key (英文)</Label>
                                    <Input
                                        value={editingConfig.key || ''}
                                        onChange={e => setEditingConfig({ ...editingConfig, key: e.target.value })}
                                        disabled={!!editingConfig.id && editingConfig.isSystem}
                                        placeholder="e.g. waterTemp"
                                    />
                                    {editingConfig.isSystem && <p className="text-[10px] text-muted-foreground">系统字段Key不可修改</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label>显示名称</Label>
                                    <Input
                                        value={editingConfig.label || ''}
                                        onChange={e => setEditingConfig({ ...editingConfig, label: e.target.value })}
                                        placeholder="e.g. 水温"
                                    />
                                </div>
                            </div>

                            <Separator />

                            <div className="grid grid-cols-2 gap-4">
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
                                        placeholder="e.g. ℃"
                                    />
                                </div>
                            </div>

                            {editingConfig.inputType === 'select' && (
                                <div className="space-y-2">
                                    <Label>选项配置 (JSON)</Label>
                                    <div className="relative">
                                        <Input
                                            className="font-mono text-xs"
                                            value={JSON.stringify(editingConfig.options || [])}
                                            onChange={e => {
                                                try {
                                                    const opts = JSON.parse(e.target.value);
                                                    setEditingConfig({ ...editingConfig, options: opts });
                                                } catch (err) { }
                                            }}
                                        />
                                        <p className="text-[10px] text-muted-foreground mt-1">格式: {'[{"value":"v", "label":"l"}]'}</p>
                                    </div>
                                </div>
                            )}

                            <Separator />

                            <div className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id="required-check"
                                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                    checked={editingConfig.validation?.required || false}
                                    onChange={e => setEditingConfig({
                                        ...editingConfig,
                                        validation: { ...editingConfig.validation, required: e.target.checked }
                                    })}
                                />
                                <Label htmlFor="required-check" className="cursor-pointer">设为必填项</Label>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>取消</Button>
                        <Button onClick={handleSave}>保存配置</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};
