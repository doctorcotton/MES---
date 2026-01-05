import { ProcessType } from './recipe';
export { ProcessType };

export type FieldInputType =
    | 'number'
    | 'text'
    | 'select'
    | 'range'
    | 'conditionValue'
    | 'waterRatio'
    | 'array'
    | 'object';

export interface FieldConfig {
    id: string;
    processType: ProcessType;
    key: string;
    label: string;
    inputType: FieldInputType;
    unit?: string;
    options?: { value: string; label: string }[];
    defaultValue?: any;

    // Array type config
    itemConfig?: FieldConfig;     // For simple arrays or single-field objects in array
    itemFields?: FieldConfig[];   // For object arrays with multiple fields
    minItems?: number;
    maxItems?: number;

    // Object type config
    fields?: FieldConfig[];       // For nested object fields

    validation?: {
        min?: number;
        max?: number;
        required?: boolean;
        pattern?: string;
    };
    displayCondition?: {
        field: string;
        operator: '==' | '!=' | '>' | '<' | 'in' | 'notIn';
        value: any;
    };
    sortOrder: number;
    isSystem: boolean;
    enabled: boolean;
    createdAt?: string;
    updatedAt?: string;
}
