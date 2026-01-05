import { db } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { ProcessType } from '../../../src/types/recipe';

// We need to duplicate the config here to avoid importing from frontend code in backend execution context
// if ts-node/commonjs issues arise. However, since this is a migration script, we might want to just copy the structure.

// Mapping existing fields to DB structure
const PROCESS_TYPE_FIELDS: Record<string, any[]> = {
    'DISSOLUTION': [
        {
            key: 'waterVolumeMode', label: '水量模式', inputType: 'select', options: [
                { value: 'ratio', label: '料水比' },
                { value: 'fixed', label: '固定水量' },
            ], defaultValue: 'ratio', validation: { required: true }
        },
        { key: 'waterRatio', label: '料水比', inputType: 'waterRatio', unit: '(1:X)', defaultValue: { min: 5, max: 8 }, displayCondition: { field: 'waterVolumeMode', operator: '==', value: 'ratio' } },
        { key: 'waterVolume', label: '水量', inputType: 'conditionValue', unit: 'L', displayCondition: { field: 'waterVolumeMode', operator: '==', value: 'fixed' } },
        { key: 'waterTemp', label: '水温', inputType: 'range', unit: '℃' },
        { key: 'stirringTime', label: '搅拌时间', inputType: 'number', unit: 'min', validation: { required: true } },
        {
            key: 'stirringRate', label: '搅拌速率', inputType: 'select', options: [
                { value: 'high', label: '高速' },
                { value: 'medium', label: '中速' },
                { value: 'low', label: '低速' },
            ], validation: { required: true }
        },
        {
            key: 'transferType', label: '赶料类型', inputType: 'select', options: [
                { value: 'material', label: '料赶料' },
                { value: 'water', label: '水赶料' },
                { value: 'none', label: '无' },
            ], validation: { required: true }
        },
    ],
    'COMPOUNDING': [
        { key: 'stirringSpeed', label: '搅拌速度', inputType: 'conditionValue', unit: '%', validation: { required: true } },
        { key: 'stirringTime', label: '搅拌时间', inputType: 'number', unit: 'min', validation: { required: true } },
        { key: 'finalTemp', label: '最终温度', inputType: 'number', unit: '℃', validation: { required: true } },
    ],
    'FILTRATION': [
        { key: 'precision', label: '过滤精度', inputType: 'number', unit: 'μm', validation: { required: true } },
    ],
    'TRANSFER': [
        {
            key: 'transferType', label: '赶料类型', inputType: 'select', options: [
                { value: 'material', label: '料赶料' },
                { value: 'water', label: '水赶料' },
                { value: 'none', label: '无' },
            ], validation: { required: true }
        },
        { key: 'waterVolume', label: '水量', inputType: 'number', unit: 'L', displayCondition: { field: 'transferType', operator: '==', value: 'water' } },
        { key: 'cleaning', label: '清洗要求', inputType: 'text' },
    ],
    'FLAVOR_ADDITION': [
        { key: 'method', label: '添加方式', inputType: 'text', validation: { required: true } },
    ],
    'OTHER': [
        { key: 'params', label: '参数描述', inputType: 'text' },
    ],
};

export function syncDefaultFields() {
    console.log('Checking if default fields need sync...');
    const check = db.prepare('SELECT COUNT(*) as count FROM process_field_configs').get() as { count: number };

    if (check.count > 0) {
        console.log('Field configs already exist. Skipping sync.');
        return;
    }

    console.log('Syncing default fields to database...');

    const insert = db.prepare(`
        INSERT INTO process_field_configs (
            id, process_type, key, label, input_type, unit, options, 
            default_value, validation, display_condition, sort_order, 
            is_system, enabled, created_at, updated_at
        ) VALUES (
            @id, @processType, @key, @label, @inputType, @unit, @options, 
            @defaultValue, @validation, @displayCondition, @sortOrder, 
            @isSystem, @enabled, @createdAt, @updatedAt
        )
    `);

    const transaction = db.transaction((fields: any[]) => {
        for (const field of fields) {
            insert.run(field);
        }
    });

    const allFields: any[] = [];
    const now = new Date().toISOString();

    Object.entries(PROCESS_TYPE_FIELDS).forEach(([processType, fields]) => {
        fields.forEach((field, index) => {
            allFields.push({
                id: uuidv4(),
                processType,
                key: field.key,
                label: field.label,
                inputType: field.inputType,
                unit: field.unit || null,
                options: field.options ? JSON.stringify(field.options) : null,
                defaultValue: field.defaultValue !== undefined ? JSON.stringify(field.defaultValue) : null,
                validation: field.validation ? JSON.stringify(field.validation) : null,
                displayCondition: field.displayCondition ? JSON.stringify(field.displayCondition) : null,
                sortOrder: index,
                isSystem: 1, // These are core system fields
                enabled: 1,
                createdAt: now,
                updatedAt: now
            });
        });
    });

    transaction(allFields);
    console.log(`Synced ${allFields.length} default fields.`);
}
