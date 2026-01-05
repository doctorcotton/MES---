import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldConfig } from '@/types/fieldConfig';

interface Props {
    config: FieldConfig;
    value: any; // { min, max, unit }
    onChange: (value: any) => void;
    error?: string | null;
}

export const RangeField: React.FC<Props> = ({ config, value, onChange, error }) => {
    const min = value?.min;
    const max = value?.max;

    const handleMinChange = (v: string) => {
        onChange({ ...value, min: Number(v), unit: config.unit });
    };

    const handleMaxChange = (v: string) => {
        onChange({ ...value, max: Number(v), unit: config.unit });
    };

    return (
        <div className="space-y-2">
            <Label>{config.label}</Label>
            <div className="flex items-center space-x-2">
                <Input
                    type="number"
                    value={min !== undefined ? min : ''}
                    onChange={(e) => handleMinChange(e.target.value)}
                    placeholder="Min"
                />
                <span className="text-gray-500">-</span>
                <Input
                    type="number"
                    value={max !== undefined ? max : ''}
                    onChange={(e) => handleMaxChange(e.target.value)}
                    placeholder="Max"
                />
                <span className="text-gray-500 text-sm">{config.unit}</span>
            </div>
            {error && <span className="text-red-500 text-sm">{error}</span>}
        </div>
    );
};
