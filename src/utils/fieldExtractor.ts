import { Process, SubStep } from '../types/recipe';
import { FieldInputType, ProcessType } from '../types/fieldConfig';

export interface ExtractedField {
    processType: ProcessType;
    key: string;
    inferredType: FieldInputType;
    sampleValue: any;
    unit?: string;
}

/**
 * Infer field input type from value
 */
function inferFieldType(key: string, value: any): FieldInputType {
    if (key === 'waterVolumeMode' || key === 'stirringRate' || key === 'transferType' || key === 'method') {
        return 'select'; // These are typically enums/selects
    }

    if (typeof value === 'object' && value !== null) {
        if ('min' in value && 'max' in value) {
            return key.includes('Ratio') ? 'waterRatio' : 'range';
        }
        if ('value' in value) {
            if ('condition' in value) {
                return 'conditionValue';
            }
            // It has value and unit, treat as number if value is number
            return 'number';
        }
    }

    if (typeof value === 'number') return 'number';

    return 'text'; // Default fallback
}

/**
 * Extract fields from process data
 */
export function extractFieldsFromRecipes(processes: Process[]): ExtractedField[] {
    const fieldMap = new Map<string, ExtractedField>();

    processes.forEach(process => {
        process.node.subSteps.forEach(subStep => {
            const { processType, params } = subStep;

            // Identify the params object key based on processType logic
            // Usually it's like dissolutionParams, compoundingParams etc.
            // Or we look for the object inside params that is not 'processType'
            if (!params) return;

            // Common pattern in initialData: params = { processType: '...', dissolutionParams: { ... } }
            // unique keys excluding 'processType'
            const paramKeys = Object.keys(params).filter(k => k !== 'processType');

            paramKeys.forEach(parentKey => {
                const paramObj = (params as any)[parentKey];
                if (typeof paramObj !== 'object' || paramObj === null) return; // Should be the nested params object

                // specific fields
                Object.keys(paramObj).forEach(fieldKey => {
                    const value = paramObj[fieldKey];
                    const uniqueId = `${processType}:${fieldKey}`;

                    if (!fieldMap.has(uniqueId)) {
                        let unit = undefined;
                        if (typeof value === 'object' && value?.unit) {
                            unit = value.unit;
                        }

                        fieldMap.set(uniqueId, {
                            processType,
                            key: fieldKey,
                            inferredType: inferFieldType(fieldKey, value),
                            sampleValue: value,
                            unit
                        });
                    }
                });
            });
        });
    });

    return Array.from(fieldMap.values());
}
