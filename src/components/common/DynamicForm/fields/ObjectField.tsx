import React, { useState } from 'react';
import { FieldConfig } from '@/types/fieldConfig';
import { DynamicFormRenderer } from '../DynamicFormRenderer';
import { Label } from '@/components/ui/label';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface ObjectFieldProps {
    config: FieldConfig;
    value: any;
    onChange: (value: any) => void;
    error?: string;
}

export const ObjectField: React.FC<ObjectFieldProps> = ({ config, value = {}, onChange, error }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    if (!config.fields || config.fields.length === 0) {
        return <div className="text-red-500">Object field configuration error: missing fields</div>;
    }

    const handleChange = (newData: any) => {
        onChange(newData);
    };

    return (
        <div className="space-y-2 border rounded-md p-3 relative">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 cursor-pointer select-none" onClick={() => setIsExpanded(!isExpanded)}>
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                    <Label className={cn("cursor-pointer", error && "text-red-500")}>{config.label}</Label>
                </div>
            </div>

            {isExpanded && (
                <div className="pt-2 pl-2 border-l border-slate-100 ml-2">
                    <DynamicFormRenderer
                        configs={config.fields}
                        data={value || {}}
                        onChange={handleChange}
                    />
                </div>
            )}

            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>
    );
};
