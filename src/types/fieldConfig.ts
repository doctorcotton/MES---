import { ProcessType } from './recipe';
export { ProcessType };

export type FieldInputType =
    | 'number'
    | 'text'
    | 'select'
    | 'range'
    | 'conditionValue'
    | 'waterRatio';

export interface FieldConfig {
    id: string;
    processType: ProcessType;
    key: string;
    label: string;
    inputType: FieldInputType;
    unit?: string;
    options?: { value: string; label: string }[];
    defaultValue?: any;
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
