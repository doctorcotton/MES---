import React, { useEffect, useState } from 'react';
import { FieldConfig, FieldInputType } from '@/types/fieldConfig';
import { shouldDisplayField, validateField } from '@/utils/fieldValidator';
import { TextField } from './fields/TextField';
import { NumberField } from './fields/NumberField';
import { SelectField } from './fields/SelectField';
import { ConditionValueField } from './fields/ConditionValueField';
import { RangeField } from './fields/RangeField';
import { WaterRatioField } from './fields/WaterRatioField';

// Placeholder for other complex fields
const PlaceholderField = ({ config }: { config: FieldConfig }) => (
    <div className="p-2 border border-dashed rounded text-gray-400">
        Configured field {config.label} ({config.inputType}) not yet implemented
    </div>
);

interface Props {
    configs: FieldConfig[];
    data: any;
    onChange: (data: any) => void;
}

const FIELD_COMPONENTS: Record<string, React.FC<any>> = {
    'text': TextField,
    'number': NumberField,
    'select': SelectField,
    'conditionValue': ConditionValueField,
    'range': RangeField,
    'waterRatio': WaterRatioField,
};

export const DynamicFormRenderer: React.FC<Props> = ({ configs, data, onChange }) => {
    const [errors, setErrors] = useState<Record<string, string>>({});

    const handleChange = (key: string, value: any) => {
        const newData = { ...data, [key]: value };
        onChange(newData);

        // Clear error on change
        if (errors[key]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[key];
                return newErrors;
            });
        }
    };

    return (
        <div className="space-y-4">
            {configs.map(config => {
                const isVisible = shouldDisplayField(config, data);
                if (!isVisible) return null;

                const Component = FIELD_COMPONENTS[config.inputType] || PlaceholderField;

                return (
                    <Component
                        key={config.id}
                        config={config}
                        value={data[config.key]}
                        onChange={(val: any) => handleChange(config.key, val)}
                        error={errors[config.key]}
                    />
                );
            })}
        </div>
    );
};
