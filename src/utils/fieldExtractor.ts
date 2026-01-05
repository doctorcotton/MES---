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
 * 从值推断字段输入类型
 */
function inferFieldType(key: string, value: any): FieldInputType {
    if (key === 'waterVolumeMode' || key === 'stirringRate' || key === 'transferType' || key === 'method') {
        return 'select'; // 这些通常是枚举/选择类型
    }

    if (typeof value === 'object' && value !== null) {
        if ('min' in value && 'max' in value) {
            return key.includes('Ratio') ? 'waterRatio' : 'range';
        }
        if ('value' in value) {
            if ('condition' in value) {
                return 'conditionValue';
            }
            // 它有值和单位，如果值是数字则视为数字类型
            return 'number';
        }
    }

    if (typeof value === 'number') return 'number';

    return 'text'; // 默认回退
}

/**
 * 从流程数据中提取字段
 */
export function extractFieldsFromRecipes(processes: Process[]): ExtractedField[] {
    const fieldMap = new Map<string, ExtractedField>();

    processes.forEach(process => {
        process.node.subSteps.forEach(subStep => {
            const { processType, params } = subStep;

            // 根据 processType 逻辑识别参数对象键
            // 通常是 dissolutionParams、compoundingParams 等
            // 或者我们在 params 中查找不是 'processType' 的对象
            if (!params) return;

            // initialData 中的常见模式：params = { processType: '...', dissolutionParams: { ... } }
            // 排除 'processType' 的唯一键
            const paramKeys = Object.keys(params).filter(k => k !== 'processType');

            paramKeys.forEach(parentKey => {
                const paramObj = (params as any)[parentKey];
                if (typeof paramObj !== 'object' || paramObj === null) return; // 应该是嵌套的参数对象

                // 特定字段
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
