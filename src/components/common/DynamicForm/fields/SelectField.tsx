import React from 'react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { FieldConfig } from '@/types/fieldConfig';

interface Props {
    config: FieldConfig;
    value: any;
    onChange: (value: any) => void;
    error?: string | null;
}

export const SelectField: React.FC<Props> = ({ config, value, onChange, error }) => {
    return (
        <div className="space-y-2">
            <Label>{config.label}</Label>
            <Select
                value={value || ''}
                onValueChange={onChange}
            >
                <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                    {config.options?.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {error && <span className="text-red-500 text-sm">{error}</span>}
        </div>
    );
};
