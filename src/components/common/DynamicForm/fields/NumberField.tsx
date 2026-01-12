import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldConfig } from '@/types/fieldConfig';

interface Props {
    config: FieldConfig;
    value: any;
    onChange: (value: any) => void;
    error?: string | null;
}

export const NumberField: React.FC<Props> = ({ config, value, onChange, error }) => {
    // 处理可能是 { value, unit } 对象结构的情况
    const isObjectValue = typeof value === 'object' && value !== null && 'value' in value;
    const displayValue = isObjectValue ? value.value : value;
    const displayUnit = isObjectValue ? value.unit : config.unit;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const numValue = Number(e.target.value);
        // 如果原始值是对象结构，保持该结构
        if (isObjectValue) {
            onChange({ value: numValue, unit: value.unit || config.unit || '' });
        } else {
            onChange(numValue);
        }
    };

    return (
        <div className="space-y-2">
            <Label>{config.label}</Label>
            <div className="flex items-center space-x-2">
                <Input
                    type="number"
                    value={displayValue !== undefined && displayValue !== null ? displayValue : ''}
                    onChange={handleChange}
                    placeholder={config.label}
                />
                {displayUnit && <span className="text-gray-500 text-sm">{displayUnit}</span>}
            </div>
            {error && <span className="text-red-500 text-sm">{error}</span>}
        </div>
    );
};
