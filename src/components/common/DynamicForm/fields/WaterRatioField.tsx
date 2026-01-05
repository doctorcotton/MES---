import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldConfig } from '@/types/fieldConfig';

interface Props {
    config: FieldConfig;
    value: any; // { min, max }
    onChange: (value: any) => void;
    error?: string | null;
}

export const WaterRatioField: React.FC<Props> = ({ config, value, onChange, error }) => {
    const min = value?.min;
    const max = value?.max;

    const handleMinChange = (v: string) => {
        onChange({ ...value, min: Number(v) });
    };

    const handleMaxChange = (v: string) => {
        onChange({ ...value, max: Number(v) });
    };

    return (
        <div className="space-y-2">
            <Label>{config.label} (1:X)</Label>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <span className="text-xs text-gray-500">Min Ratio</span>
                    <div className="flex items-center space-x-1">
                        <span className="text-sm">1:</span>
                        <Input
                            type="number"
                            value={min !== undefined ? min : ''}
                            onChange={(e) => handleMinChange(e.target.value)}
                            placeholder="Min"
                        />
                    </div>
                </div>
                <div className="space-y-1">
                    <span className="text-xs text-gray-500">Max Ratio</span>
                    <div className="flex items-center space-x-1">
                        <span className="text-sm">1:</span>
                        <Input
                            type="number"
                            value={max !== undefined ? max : ''}
                            onChange={(e) => handleMaxChange(e.target.value)}
                            placeholder="Max"
                        />
                    </div>
                </div>
            </div>
            {error && <span className="text-red-500 text-sm">{error}</span>}
        </div>
    );
};
