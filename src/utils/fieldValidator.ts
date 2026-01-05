import { FieldConfig } from '../types/fieldConfig';

export const validateField = (value: any, config: FieldConfig): string | null => {
    if (!config.validation) return null;
    const { required, min, max, pattern } = config.validation;

    // Required check
    if (required) {
        if (value === undefined || value === null || value === '') {
            return `${config.label} is required`;
        }
    }

    // Skip other checks if empty and not required
    if (value === undefined || value === null || value === '') {
        return null;
    }

    // Number checks
    if (config.inputType === 'number' && typeof value === 'number') {
        if (min !== undefined && value < min) {
            return `${config.label} must be at least ${min}`;
        }
        if (max !== undefined && value > max) {
            return `${config.label} must be at most ${max}`;
        }
    }

    // Range/ConditionValue checks (complex types)
    if (config.inputType === 'conditionValue' && typeof value === 'object') {
        // TODO: Implement deep validation for objects
    }

    // Pattern check
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
