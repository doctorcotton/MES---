import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { ArrowLeft, Edit2, Plus, Trash2, RotateCcw, Save } from 'lucide-react';
import { ProcessType } from '@/types/recipe';
import { useProcessTypeConfigStore } from '@/store/useProcessTypeConfigStore';
import {
    SubStepTemplate,
    ProcessSegmentTemplate,
    getProcessTypeName,
    PROCESS_TYPE_FIELDS,
} from '@/types/processTypeConfig';
import { FieldConfigEditor } from './FieldConfigEditor';

export function ConfigPage() {
    const navigate = useNavigate();
    const {
        subStepTemplates,
        processSegmentTemplates,
        updateSubStepTemplate,
        addProcessSegmentTemplate,
        updateProcessSegmentTemplate,
        removeProcessSegmentTemplate,
        resetToDefaults,
    } = useProcessTypeConfigStore();

    const [editingSubStep, setEditingSubStep] = useState<ProcessType | null>(null);
    const [editingSegment, setEditingSegment] = useState<string | null>(null);
    const [newSegmentOpen, setNewSegmentOpen] = useState(false);
    const [editSubStepValues, setEditSubStepValues] = useState<Partial<SubStepTemplate>>({});
    const [editSegmentValues, setEditSegmentValues] = useState<Partial<ProcessSegmentTemplate>>({});

    // 开始编辑子步骤模板
    const handleEditSubStep = (type: ProcessType) => {
        const template = subStepTemplates[type];
        const allFields = PROCESS_TYPE_FIELDS[type].map(f => f.key);
        setEditingSubStep(type);
        setEditSubStepValues({
            label: template.label,
            defaultDeviceCode: template.defaultDeviceCode,
            description: template.description,
            enabledFields: template.enabledFields || allFields, // 默认全部启用
        });
    };

    // 保存子步骤模板
    const handleSaveSubStep = () => {
        if (editingSubStep) {
            updateSubStepTemplate(editingSubStep, editSubStepValues);
            setEditingSubStep(null);
            setEditSubStepValues({});
        }
    };

    // 开始编辑工艺段模板
    const handleEditSegment = (id: string) => {
        const template = processSegmentTemplates.find((t) => t.id === id);
        if (template) {
            setEditingSegment(id);
            setEditSegmentValues({
                name: template.name,
                description: template.description,
                defaultSubStepTypes: template.defaultSubStepTypes,
            });
        }
    };

    // 保存工艺段模板
    const handleSaveSegment = () => {
        if (editingSegment) {
            updateProcessSegmentTemplate(editingSegment, editSegmentValues);
            setEditingSegment(null);
            setEditSegmentValues({});
        }
    };

    // 添加新工艺段模板
    const handleAddSegment = () => {
        const newId = `segment_${Date.now()}`;
        addProcessSegmentTemplate({
            id: newId,
            version: 1,
            name: editSegmentValues.name || '新工艺段',
            description: editSegmentValues.description,
            defaultSubStepTypes: editSegmentValues.defaultSubStepTypes || [ProcessType.OTHER],
        });
        setNewSegmentOpen(false);
        setEditSegmentValues({});
    };

    // 重置配置
    const handleReset = () => {
        if (confirm('确定要重置所有配置为默认值吗？')) {
            resetToDefaults();
        }
    };

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <header className="flex items-center justify-between border-b bg-slate-900 px-6 py-3">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="text-white hover:bg-slate-800">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        返回
                    </Button>
                    <h1 className="text-xl font-bold text-white">工艺类型配置</h1>
                </div>
                <Button variant="outline" size="sm" onClick={handleReset}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    重置为默认
                </Button>
            </header>

            {/* Content */}
            <div className="container mx-auto p-6">
                <Tabs defaultValue="substep" className="w-full">
                    <TabsList className="mb-4">
                        <TabsTrigger value="substep">子步骤类型配置</TabsTrigger>
                        <TabsTrigger value="segment">工艺段类型配置</TabsTrigger>
                        <TabsTrigger value="fields">字段管理</TabsTrigger>
                    </TabsList>

                    {/* 字段管理 */}
                    <TabsContent value="fields">
                        <div className="bg-white p-6 rounded-lg border">
                            <FieldConfigEditor />
                        </div>
                    </TabsContent>

                    {/* 子步骤类型配置 */}
                    <TabsContent value="substep">
                        <div className="rounded-lg border bg-white">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[100px]">类型</TableHead>
                                        <TableHead>默认名称</TableHead>
                                        <TableHead>默认设备</TableHead>
                                        <TableHead>工艺参数字段</TableHead>
                                        <TableHead>版本</TableHead>
                                        <TableHead>描述</TableHead>
                                        <TableHead className="w-[80px]">操作</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {Object.values(ProcessType).map((type) => {
                                        const template = subStepTemplates[type];
                                        const fields = PROCESS_TYPE_FIELDS[type];
                                        return (
                                            <TableRow key={type}>
                                                <TableCell className="font-medium">{getProcessTypeName(type)}</TableCell>
                                                <TableCell>{template.label}</TableCell>
                                                <TableCell>{template.defaultDeviceCode || '-'}</TableCell>
                                                <TableCell>
                                                    <div className="flex flex-wrap gap-1">
                                                        {fields.slice(0, 3).map((field, idx) => (
                                                            <span key={idx} className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs">
                                                                {field.label}
                                                            </span>
                                                        ))}
                                                        {fields.length > 3 && (
                                                            <span className="text-xs text-gray-500">+{fields.length - 3}个</span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>v{template.version}</TableCell>
                                                <TableCell className="text-sm text-gray-600">{template.description || '-'}</TableCell>
                                                <TableCell>
                                                    <Button variant="ghost" size="icon" onClick={() => handleEditSubStep(type)}>
                                                        <Edit2 className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </TabsContent>

                    {/* 工艺段类型配置 */}
                    <TabsContent value="segment">
                        <div className="mb-4">
                            <Button onClick={() => setNewSegmentOpen(true)}>
                                <Plus className="mr-2 h-4 w-4" />
                                添加工艺段类型
                            </Button>
                        </div>
                        <div className="rounded-lg border bg-white">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>ID</TableHead>
                                        <TableHead>名称</TableHead>
                                        <TableHead>默认子步骤</TableHead>
                                        <TableHead>版本</TableHead>
                                        <TableHead>描述</TableHead>
                                        <TableHead className="w-[100px]">操作</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {processSegmentTemplates.map((template) => (
                                        <TableRow key={template.id}>
                                            <TableCell className="font-mono text-sm">{template.id}</TableCell>
                                            <TableCell className="font-medium">{template.name}</TableCell>
                                            <TableCell>
                                                <div className="flex gap-1 flex-wrap">
                                                    {template.defaultSubStepTypes.map((type, idx) => (
                                                        <span key={idx} className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs">
                                                            {getProcessTypeName(type)}
                                                        </span>
                                                    ))}
                                                </div>
                                            </TableCell>
                                            <TableCell>v{template.version}</TableCell>
                                            <TableCell className="text-sm text-gray-600">{template.description || '-'}</TableCell>
                                            <TableCell>
                                                <div className="flex gap-1">
                                                    <Button variant="ghost" size="icon" onClick={() => handleEditSegment(template.id)}>
                                                        <Edit2 className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => {
                                                            if (confirm(`确定删除工艺段类型 "${template.name}" 吗？`)) {
                                                                removeProcessSegmentTemplate(template.id);
                                                            }
                                                        }}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>

            {/* 编辑子步骤模板弹窗 */}
            <Dialog open={!!editingSubStep} onOpenChange={() => setEditingSubStep(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>编辑子步骤类型: {editingSubStep && getProcessTypeName(editingSubStep)}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <label className="text-sm font-medium">默认名称</label>
                            <Input
                                value={editSubStepValues.label || ''}
                                onChange={(e) => setEditSubStepValues({ ...editSubStepValues, label: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">默认设备编号</label>
                            <Input
                                value={editSubStepValues.defaultDeviceCode || ''}
                                onChange={(e) => setEditSubStepValues({ ...editSubStepValues, defaultDeviceCode: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">描述</label>
                            <Input
                                value={editSubStepValues.description || ''}
                                onChange={(e) => setEditSubStepValues({ ...editSubStepValues, description: e.target.value })}
                            />
                        </div>

                        {/* 工艺参数字段列表 */}
                        {editingSubStep && (
                            <div className="border-t pt-4 mt-4">
                                <label className="text-sm font-medium mb-2 block">工艺参数字段配置</label>
                                <div className="text-xs text-gray-500 mb-3">
                                    选择启用的字段（去除勾选将隐藏该字段）
                                </div>
                                <div className="bg-gray-50 p-3 rounded-md space-y-2 max-h-60 overflow-y-auto">
                                    {PROCESS_TYPE_FIELDS[editingSubStep].map((field, idx) => {
                                        const isEnabled = (editSubStepValues.enabledFields || []).includes(field.key);
                                        return (
                                            <label
                                                key={idx}
                                                className="flex items-center justify-between bg-white p-2 rounded border hover:bg-gray-50 cursor-pointer"
                                            >
                                                <div className="flex items-center flex-1">
                                                    <input
                                                        type="checkbox"
                                                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-3"
                                                        checked={isEnabled}
                                                        onChange={(e) => {
                                                            const current = editSubStepValues.enabledFields || [];
                                                            const updated = e.target.checked
                                                                ? [...current, field.key]
                                                                : current.filter(k => k !== field.key);
                                                            setEditSubStepValues({
                                                                ...editSubStepValues,
                                                                enabledFields: updated,
                                                            });
                                                        }}
                                                    />
                                                    <div className="flex-1">
                                                        <div className="text-sm font-medium">{field.label}</div>
                                                        <div className="text-xs text-gray-500">
                                                            类型: {field.inputType}
                                                            {field.unit && ` | 单位: ${field.unit}`}
                                                            {field.required && ' | 必填'}
                                                        </div>
                                                    </div>
                                                    {field.options && (
                                                        <div className="text-xs text-gray-400 ml-2">
                                                            {field.options.length}个选项
                                                        </div>
                                                    )}
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>
                                <div className="text-xs text-gray-500 mt-2">
                                    已启用 {(editSubStepValues.enabledFields || []).length} / {PROCESS_TYPE_FIELDS[editingSubStep].length} 个字段
                                </div>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingSubStep(null)}>取消</Button>
                        <Button onClick={handleSaveSubStep}>
                            <Save className="mr-2 h-4 w-4" />
                            保存
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 编辑工艺段模板弹窗 */}
            <Dialog open={!!editingSegment} onOpenChange={() => setEditingSegment(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>编辑工艺段类型</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <label className="text-sm font-medium">名称</label>
                            <Input
                                value={editSegmentValues.name || ''}
                                onChange={(e) => setEditSegmentValues({ ...editSegmentValues, name: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">描述</label>
                            <Input
                                value={editSegmentValues.description || ''}
                                onChange={(e) => setEditSegmentValues({ ...editSegmentValues, description: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">默认子步骤序列（选择类型）</label>
                            <div className="flex flex-wrap gap-2 mt-2">
                                {Object.values(ProcessType).map((type) => {
                                    const isSelected = editSegmentValues.defaultSubStepTypes?.includes(type);
                                    return (
                                        <Button
                                            key={type}
                                            variant={isSelected ? 'default' : 'outline'}
                                            size="sm"
                                            onClick={() => {
                                                const current = editSegmentValues.defaultSubStepTypes || [];
                                                if (isSelected) {
                                                    setEditSegmentValues({
                                                        ...editSegmentValues,
                                                        defaultSubStepTypes: current.filter((t) => t !== type),
                                                    });
                                                } else {
                                                    setEditSegmentValues({
                                                        ...editSegmentValues,
                                                        defaultSubStepTypes: [...current, type],
                                                    });
                                                }
                                            }}
                                        >
                                            {getProcessTypeName(type)}
                                        </Button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingSegment(null)}>取消</Button>
                        <Button onClick={handleSaveSegment}>
                            <Save className="mr-2 h-4 w-4" />
                            保存
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 新增工艺段模板弹窗 */}
            <Dialog open={newSegmentOpen} onOpenChange={setNewSegmentOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>添加工艺段类型</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <label className="text-sm font-medium">名称</label>
                            <Input
                                value={editSegmentValues.name || ''}
                                onChange={(e) => setEditSegmentValues({ ...editSegmentValues, name: e.target.value })}
                                placeholder="例如：溶解工艺段"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">描述</label>
                            <Input
                                value={editSegmentValues.description || ''}
                                onChange={(e) => setEditSegmentValues({ ...editSegmentValues, description: e.target.value })}
                                placeholder="可选"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">默认子步骤序列</label>
                            <div className="flex flex-wrap gap-2 mt-2">
                                {Object.values(ProcessType).map((type) => {
                                    const isSelected = editSegmentValues.defaultSubStepTypes?.includes(type);
                                    return (
                                        <Button
                                            key={type}
                                            variant={isSelected ? 'default' : 'outline'}
                                            size="sm"
                                            onClick={() => {
                                                const current = editSegmentValues.defaultSubStepTypes || [];
                                                if (isSelected) {
                                                    setEditSegmentValues({
                                                        ...editSegmentValues,
                                                        defaultSubStepTypes: current.filter((t) => t !== type),
                                                    });
                                                } else {
                                                    setEditSegmentValues({
                                                        ...editSegmentValues,
                                                        defaultSubStepTypes: [...current, type],
                                                    });
                                                }
                                            }}
                                        >
                                            {getProcessTypeName(type)}
                                        </Button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setNewSegmentOpen(false); setEditSegmentValues({}); }}>取消</Button>
                        <Button onClick={handleAddSegment} disabled={!editSegmentValues.name}>
                            <Plus className="mr-2 h-4 w-4" />
                            添加
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
