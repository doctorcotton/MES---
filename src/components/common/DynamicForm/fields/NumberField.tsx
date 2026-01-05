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
    return (
        <div className="space-y-2">
            <Label>{config.label}</Label>
            <div className="flex items-center space-x-2">
                <Input
                    type="number"
                    value={value !== undefined && value !== null ? value : ''}
                    onChange={(e) => onChange(Number(e.target.value))}
                    placeholder={config.label}
                />
                {config.unit && <span className="text-gray-500 text-sm">{config.unit}</span>}
            </div>
            {error && <span className="text-red-500 text-sm">{error}</span>}
        </div>
    );
};
