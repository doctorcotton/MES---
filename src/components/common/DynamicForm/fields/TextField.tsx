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

export const TextField: React.FC<Props> = ({ config, value, onChange, error }) => {
    return (
        <div className="space-y-2">
            <Label>{config.label}</Label>
            <Input
                type="text"
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                placeholder={config.label}
            />
            {error && <span className="text-red-500 text-sm">{error}</span>}
        </div>
    );
};
