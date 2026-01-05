import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { FieldConfig } from '@/types/fieldConfig';

interface Props {
    config: FieldConfig;
    value: any;
    onChange: (value: any) => void;
    error?: string | null;
}

export const ConditionValueField: React.FC<Props> = ({ config, value, onChange, error }) => {
    // value expected to be { value: number, unit: string, condition?: string }
    // OR basic number if simplified

    const currentValue = typeof value === 'object' ? value?.value : value;
    const currentCondition = typeof value === 'object' ? value?.condition : '>=';

    const handleValueChange = (v: string) => {
        onChange({
            value: Number(v),
            unit: config.unit,
            condition: currentCondition
        });
    };

    const handleConditionChange = (c: string) => {
        onChange({
            value: currentValue,
            unit: config.unit,
            condition: c
        });
    };

    return (
        <div className="space-y-2">
            <Label>{config.label}</Label>
            <div className="grid grid-cols-3 gap-2">
                <Select value={currentCondition} onValueChange={handleConditionChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value=">=">≥</SelectItem>
                        <SelectItem value=">">&gt;</SelectItem>
                        <SelectItem value="<=">≤</SelectItem>
                        <SelectItem value="<">&lt;</SelectItem>
                        <SelectItem value="=">=</SelectItem>
                    </SelectContent>
                </Select>
                <Input
                    type="number"
                    value={currentValue || ''}
                    onChange={(e) => handleValueChange(e.target.value)}
                />
                <div className="flex items-center text-sm text-gray-500">
                    {config.unit}
                </div>
            </div>
            {error && <span className="text-red-500 text-sm">{error}</span>}
        </div>
    );
};
