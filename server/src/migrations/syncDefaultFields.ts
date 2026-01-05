import { db } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { ProcessType } from '../../../src/types/recipe';

// 需要在此处复制配置以避免在后端执行上下文中从前端代码导入
// 如果出现 ts-node/commonjs 问题。但由于这是迁移脚本，我们可能只想复制结构。

// ProcessType 映射：旧的大写格式 -> 新的小写格式
const PROCESS_TYPE_MIGRATION: Record<string, string> = {
    'DISSOLUTION': 'dissolution',
    'COMPOUNDING': 'compounding',
    'FILTRATION': 'filtration',
    'TRANSFER': 'transfer',
    'FLAVOR_ADDITION': 'flavorAddition',
    'OTHER': 'other'
};

/**
 * 迁移现有数据库中的 processType 值从大写改为小写
 * 这确保与前端 ProcessType 枚举值匹配
 */
function migrateProcessTypes() {
    console.log('检查是否需要迁移 processType 值...');
    
    let migratedCount = 0;
    const updateStmt = db.prepare('UPDATE process_field_configs SET process_type = ? WHERE process_type = ?');
    
    Object.entries(PROCESS_TYPE_MIGRATION).forEach(([oldValue, newValue]) => {
        const result = updateStmt.run(newValue, oldValue);
        if (result.changes > 0) {
            migratedCount += result.changes;
            console.log(`  迁移 ${result.changes} 条记录: ${oldValue} -> ${newValue}`);
        }
    });
    
    if (migratedCount > 0) {
        console.log(`✓ 完成 processType 迁移，共迁移 ${migratedCount} 条记录\n`);
    } else {
        console.log('✓ processType 值已是最新格式，无需迁移\n');
    }
}

// 将现有字段映射到数据库结构
// 注意：processType 键必须与 ProcessType 枚举值匹配（小写）
const PROCESS_TYPE_FIELDS: Record<string, any[]> = {
    'dissolution': [
        {
            key: 'waterVolumeMode', label: '水量模式', inputType: 'select', options: [
                { value: 'ratio', label: '料水比' },
                { value: 'fixed', label: '固定水量' },
            ], defaultValue: 'ratio', validation: { required: true }
        },
        { key: 'waterRatio', label: '料水比', inputType: 'waterRatio', unit: '(1:X)', defaultValue: { min: 5, max: 8 }, displayCondition: { field: 'waterVolumeMode', operator: '==', value: 'ratio' } },
        { key: 'waterVolume', label: '水量', inputType: 'conditionValue', unit: 'L', displayCondition: { field: 'waterVolumeMode', operator: '==', value: 'fixed' } },
        { key: 'waterTemp', label: '水温', inputType: 'range', unit: '℃' },
        {
            key: 'stirringTime', label: '搅拌时间', inputType: 'object', validation: { required: true },
            fields: [
                { id: uuidv4(), key: 'value', label: '时间', inputType: 'number', unit: 'min', validation: { required: true } },
                { id: uuidv4(), key: 'unit', label: '单位', inputType: 'text', defaultValue: 'min', enabled: false }
            ]
        },
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
    'compounding': [
        {
            key: 'additives', label: '添加物列表', inputType: 'array', defaultValue: [],
            itemFields: [
                { id: uuidv4(), key: 'order', label: '顺序', inputType: 'number', validation: { required: true } },
                { id: uuidv4(), key: 'name', label: '名称', inputType: 'text', validation: { required: true } },
                { id: uuidv4(), key: 'type', label: '类型', inputType: 'select', options: [{ value: 'rawMaterial', label: '原料' }, { value: 'solution', label: '溶解液' }], validation: { required: true } },
                { id: uuidv4(), key: 'amount', label: '用量', inputType: 'text' },
                { id: uuidv4(), key: 'source', label: '来源', inputType: 'text' }
            ]
        },
        { key: 'stirringSpeed', label: '搅拌速度', inputType: 'conditionValue', unit: '%', validation: { required: true } },
        {
            key: 'stirringTime', label: '搅拌时间', inputType: 'object', validation: { required: true },
            fields: [
                { id: uuidv4(), key: 'value', label: '时间', inputType: 'number', unit: 'min', validation: { required: true } },
                { id: uuidv4(), key: 'unit', label: '单位', inputType: 'text', defaultValue: 'min', enabled: false }
            ]
        },
        {
            key: 'finalTemp', label: '最终温度', inputType: 'object', validation: { required: true },
            fields: [
                { id: uuidv4(), key: 'max', label: '最大温度', inputType: 'number', unit: '℃', validation: { required: true } },
                { id: uuidv4(), key: 'unit', label: '单位', inputType: 'text', defaultValue: '℃', enabled: false }
            ]
        },
    ],
    'filtration': [
        {
            key: 'precision', label: '过滤精度', inputType: 'object', validation: { required: true },
            fields: [
                { id: uuidv4(), key: 'value', label: '精度', inputType: 'number', unit: 'μm', validation: { required: true } },
                { id: uuidv4(), key: 'unit', label: '单位', inputType: 'text', defaultValue: 'μm', enabled: false }
            ]
        },
    ],
    'transfer': [
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
    'flavorAddition': [
        { key: 'method', label: '添加方式', inputType: 'text', validation: { required: true } },
    ],
    'other': [
        { key: 'params', label: '参数描述', inputType: 'text' },
    ],
};

export function syncDefaultFields() {
    console.log('===== 开始同步默认字段配置 =====');

    // 首先执行 processType 迁移（如果有旧数据）
    migrateProcessTypes();

    // 查询现有所有系统字段，建立索引
    const existingFields = db.prepare(`
        SELECT id, process_type, key, is_system 
        FROM process_field_configs 
        WHERE is_system = 1
    `).all() as Array<{ id: string; process_type: string; key: string; is_system: number }>;

    // 建立快速查找索引 (processType + key -> id)
    const existingFieldMap = new Map<string, string>();
    existingFields.forEach(field => {
        const mapKey = `${field.process_type}:${field.key}`;
        existingFieldMap.set(mapKey, field.id);
    });

    console.log(`数据库中已有 ${existingFields.length} 个系统字段配置`);

    // 准备 INSERT OR REPLACE 语句
    const upsert = db.prepare(`
        INSERT OR REPLACE INTO process_field_configs (
            id, process_type, key, label, input_type, unit, options, 
            default_value, validation, display_condition, sort_order, 
            is_system, enabled, created_at, updated_at,
            item_config, item_fields, fields, min_items, max_items
        ) VALUES (
            @id, @processType, @key, @label, @inputType, @unit, @options, 
            @defaultValue, @validation, @displayCondition, @sortOrder, 
            @isSystem, @enabled, @createdAt, @updatedAt,
            @itemConfig, @itemFields, @fields, @minItems, @maxItems
        )
    `);

    const transaction = db.transaction((fields: any[]) => {
        for (const field of fields) {
            upsert.run(field);
        }
    });

    // 统计信息
    let newCount = 0;
    let updateCount = 0;
    const allFields: any[] = [];
    const now = new Date().toISOString();

    // 遍历所有默认字段配置
    Object.entries(PROCESS_TYPE_FIELDS).forEach(([processType, fields]) => {
        console.log(`\n处理工艺类型: ${processType} (${fields.length} 个字段)`);

        fields.forEach((field, index) => {
            const mapKey = `${processType}:${field.key}`;
            const existingId = existingFieldMap.get(mapKey);

            // 如果字段已存在，保留其 ID 并更新；否则生成新 ID
            const fieldId = existingId || uuidv4();

            if (existingId) {
                updateCount++;
                console.log(`  ✓ 更新字段: ${field.key} (${field.label})`);
            } else {
                newCount++;
                console.log(`  + 新增字段: ${field.key} (${field.label})`);
            }

            allFields.push({
                id: fieldId,
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
                isSystem: 1,
                enabled: 1,
                createdAt: existingId ? existingFields.find(f => f.id === existingId) : now, // 保留原创建时间
                updatedAt: now,
                itemConfig: field.itemConfig ? JSON.stringify(field.itemConfig) : null,
                itemFields: field.itemFields ? JSON.stringify(field.itemFields) : null,
                fields: field.fields ? JSON.stringify(field.fields) : null,
                minItems: field.minItems || null,
                maxItems: field.maxItems || null
            });
        });
    });

    // 执行事务
    transaction(allFields);

    // 输出同步统计
    console.log('\n===== 字段同步完成 =====');
    console.log(`总计: ${allFields.length} 个字段`);
    console.log(`新增: ${newCount} 个`);
    console.log(`更新: ${updateCount} 个`);
    console.log('========================\n');
}
