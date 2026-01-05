import { FieldConfig } from '../types/fieldConfig';

// 用于验证对象字段的内部辅助函数
function validateObject(value: any, fields: FieldConfig[]): string | null {
    for (const field of fields) {
        const error = validateField(value?.[field.key], field);
        if (error) return error;
    }
    return null;
}

export const validateField = (value: any, config: FieldConfig): string | null => {
    if (!config.validation) return null;
    const { required, min, max, pattern } = config.validation;

    // 必填检查
    if (required) {
        if (value === undefined || value === null || value === '' ||
            (Array.isArray(value) && value.length === 0)) {
            return `${config.label} is required`;
        }
    }

    // 如果为空且不是必填，则跳过其他检查
    if (value === undefined || value === null || value === '') {
        return null;
    }

    // 数组检查
    if (config.inputType === 'array' && Array.isArray(value)) {
        if (config.minItems !== undefined && value.length < config.minItems) {
            return `${config.label} must have at least ${config.minItems} items`;
        }
        if (config.maxItems !== undefined && value.length > config.maxItems) {
            return `${config.label} must have at most ${config.maxItems} items`;
        }

        // 对数组项进行递归验证
        for (let i = 0; i < value.length; i++) {
            const item = value[i];
            if (config.itemFields) {
                // 对象数组
                const error = validateObject(item, config.itemFields);
                if (error) return `Item ${i + 1}: ${error}`;
            } else if (config.itemConfig) {
                // 简单数组
                const error = validateField(item, config.itemConfig);
                if (error) return `Item ${i + 1}: ${error}`;
            }
        }
    }

    // 对象检查
    if (config.inputType === 'object' && typeof value === 'object') {
        if (config.fields) {
            const error = validateObject(value, config.fields);
            if (error) return error;
        }
    }

    // 数字检查
    if (config.inputType === 'number' && typeof value === 'number') {
        if (min !== undefined && value < min) {
            return `${config.label} must be at least ${min}`;
        }
        if (max !== undefined && value > max) {
            return `${config.label} must be at most ${max}`;
        }
    }

    // 范围/条件值检查（复杂类型）
    if (config.inputType === 'conditionValue' && typeof value === 'object') {
        // TODO: 实现对象的深度验证
    }

    // 模式检查
    if (pattern && typeof value === 'string') {
        const regex = new RegExp(pattern);
        if (!regex.test(value)) {
            return `${config.label} format is invalid`;
        }
    }

    return null;
};

export const shouldDisplayField = (config: FieldConfig, allValues: any): boolean => {
    if (!config.displayCondition) return true;

    const { field, operator, value } = config.displayCondition;
    const dependencyValue = allValues[field];

    switch (operator) {
        case '==': return dependencyValue == value;
        case '!=': return dependencyValue != value;
        case '>': return dependencyValue > value;
        case '<': return dependencyValue < value;
        case 'in': return Array.isArray(value) && value.includes(dependencyValue);
        case 'notIn': return Array.isArray(value) && !value.includes(dependencyValue);
        default: return true;
    }
};
