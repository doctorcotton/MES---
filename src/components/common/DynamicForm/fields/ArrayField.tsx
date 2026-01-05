import React from 'react';
import { FieldConfig } from '@/types/fieldConfig';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DynamicFormRenderer } from '../DynamicFormRenderer';
import { Label } from '@/components/ui/label';

interface ArrayFieldProps {
    config: FieldConfig;
    value: any[];
    onChange: (value: any[]) => void;
    error?: string;
}

export const ArrayField: React.FC<ArrayFieldProps> = ({ config, value = [], onChange, error }) => {
    const handleAdd = () => {
        const newItem = config.itemFields ? {} : (config.itemConfig?.defaultValue || '');
        onChange([...value, newItem]);
    };

    const handleRemove = (index: number) => {
        const newValue = [...value];
        newValue.splice(index, 1);
        onChange(newValue);
    };

    const handleChangeItem = (index: number, itemValue: any) => {
        const newValue = [...value];
        newValue[index] = itemValue;
        onChange(newValue);
    };

    // Determine if we are rendering a list of simple fields or complex objects
    const isObjectArray = !!config.itemFields && config.itemFields.length > 0;
    const isSimpleArray = !!config.itemConfig;

    if (!isObjectArray && !isSimpleArray) {
        return <div className="text-red-500">Array field configuration error: missing itemConfig or itemFields</div>;
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <Label className={cn(error && "text-red-500")}>{config.label}</Label>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAdd}
                    className="h-7 px-2"
                >
                    <Plus className="w-3 h-3 mr-1" />
                    添加项
                </Button>
            </div>

            <div className="space-y-2">
                {value.map((item, index) => (
                    <div key={index} className="flex items-start gap-2 p-3 border rounded-md bg-slate-50 relative group">
                        <div className="mt-2 text-slate-400 cursor-grab active:cursor-grabbing">
                            <GripVertical className="w-4 h-4" />
                        </div>

                        <div className="flex-1">
                            {isObjectArray ? (
                                <DynamicFormRenderer
                                    configs={config.itemFields!}
                                    data={item || {}}
                                    onChange={(newItem) => handleChangeItem(index, newItem)}
                                />
                            ) : (
                                // For simple arrays, we need to wrap the single field render
                                // Since DynamicFormRenderer expects a list of configs mapping to an object,
                                // but here we have a single value.
                                // So we might need to verify how to render a single field without the wrapper key.
                                // Actually, standard fields expect `value` and `onChange`.
                                // We can instantiate the specific field component directly if we knew it.
                                // But DynamicFormRenderer chooses the component.
                                // To reuse logic, we can create a temporary config that maps to a dummy key, 
                                // but that's messy.
                                // Better: We should probably export the field mapping from DynamicFormRenderer 
                                // or handle simple fields here.
                                // For now, let's assume `itemConfig` has the inputType and we can render it via DynamicFormRenderer 
                                // by wrapping it in an object like { value: item }.
                                <DynamicFormRenderer
                                    configs={[{ ...config.itemConfig!, key: 'value', label: '', isSystem: false, sortOrder: 0, enabled: true, processType: config.processType, id: `temp-${index}` }]}
                                    data={{ value: item }}
                                    onChange={(newData) => handleChangeItem(index, newData.value)}
                                />
                            )}
                        </div>

                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 top-2"
                            onClick={() => handleRemove(index)}
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </div>
                ))}
            </div>

            {value.length === 0 && (
                <div className="text-center py-4 border border-dashed rounded-md text-slate-400 text-sm">
                    暂无数据
                </div>
            )}

            {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
    );
};
