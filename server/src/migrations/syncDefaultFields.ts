import { db } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { ProcessType } from '../../../src/types/recipe';

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
        { key: 'compounding_stirringTime', label: '搅拌时间', inputType: 'number', unit: 'min', validation: { required: true } },
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
            key: 'transfer_transferType', label: '赶料类型', inputType: 'select', options: [
                { value: 'material', label: '料赶料' },
                { value: 'water', label: '水赶料' },
                { value: 'none', label: '无' },
            ], validation: { required: true }
        },
        { key: 'transfer_waterVolume', label: '水量', inputType: 'number', unit: 'L', displayCondition: { field: 'transfer_transferType', operator: '==', value: 'water' } },
        { key: 'cleaning', label: '清洗要求', inputType: 'text' },
    ],
    'flavorAddition': [
        { key: 'method', label: '添加方式', inputType: 'text', validation: { required: true } },
    ],
    'other': [
        { key: 'params', label: '参数描述', inputType: 'text' },
    ],
    'extraction': [
        { key: 'extraction_extractWaterVolume', label: '萃取水量', inputType: 'conditionValue', unit: 'L' },
        {
            key: 'extraction_waterTempRange', label: '水温范围', inputType: 'object', validation: { required: true },
            fields: [
                { id: uuidv4(), key: 'min', label: '最低温度', inputType: 'number', unit: '℃' },
                { id: uuidv4(), key: 'max', label: '最高温度', inputType: 'number', unit: '℃' },
                { id: uuidv4(), key: 'unit', label: '单位', inputType: 'text', defaultValue: '℃', enabled: false }
            ]
        },
        { key: 'extraction_tempMaxLimit', label: '温度上限', inputType: 'number', unit: '℃', defaultValue: 87, validation: { max: 87 } },
        {
            key: 'extraction_teaWaterRatio', label: '茶水比', inputType: 'waterRatio', unit: '(1:X)', 
            defaultValue: { min: 50, max: 50 }
        },
        {
            key: 'extraction_teaBlend', label: '茶叶配比', inputType: 'array', defaultValue: [],
            itemFields: [
                { id: uuidv4(), key: 'teaCode', label: '茶叶代码', inputType: 'text', validation: { required: true } },
                { id: uuidv4(), key: 'teaName', label: '茶叶名称', inputType: 'text', validation: { required: true } },
                { id: uuidv4(), key: 'ratioPart', label: '配比份数', inputType: 'number', validation: { required: true } }
            ]
        },
        {
            key: 'extraction_extractTime', label: '萃取时长', inputType: 'object',
            fields: [
                { id: uuidv4(), key: 'value', label: '时长', inputType: 'number', validation: { required: true } },
                { id: uuidv4(), key: 'unit', label: '单位', inputType: 'select', options: [
                    { value: 'min', label: '分钟' },
                    { value: 's', label: '秒' }
                ], validation: { required: true } }
            ]
        },
        { key: 'extraction_stirProgram', label: '搅拌程序', inputType: 'text' },
        { key: 'extraction_referenceRpm', label: '参考转速', inputType: 'number', unit: 'r/min', defaultValue: 10 },
        { key: 'extraction_pourTimeLimitSec', label: '倾倒时间限制', inputType: 'number', unit: 's', defaultValue: 130 },
        {
            key: 'extraction_openExtraction', label: '敞口提取', inputType: 'select', options: [
                { value: '是', label: '是' },
                { value: '否', label: '否' }
            ], defaultValue: '是'
        },
        {
            key: 'extraction_stirDuringFeeding', label: '投料期间开启搅拌', inputType: 'select', options: [
                { value: '是', label: '是' },
                { value: '否', label: '否' }
            ], defaultValue: '否'
        },
        {
            key: 'extraction_exhaustFanOff', label: '关闭排气扇', inputType: 'select', options: [
                { value: '是', label: '是' },
                { value: '否', label: '否' }
            ], defaultValue: '是'
        },
    ],
    'centrifuge': [
        { key: 'centrifuge_inletFilterMesh', label: '入口过滤目数', inputType: 'number', unit: '目', defaultValue: 200 },
        {
            key: 'centrifuge_flowRateRange', label: '流量范围', inputType: 'object',
            fields: [
                { id: uuidv4(), key: 'min', label: '最小流量', inputType: 'number', unit: 't/h' },
                { id: uuidv4(), key: 'max', label: '最大流量', inputType: 'number', unit: 't/h' },
                { id: uuidv4(), key: 'unit', label: '单位', inputType: 'text', defaultValue: 't/h', enabled: false }
            ],
            defaultValue: { min: 5.0, max: 5.5, unit: 't/h' }
        },
        { key: 'centrifuge_pressureMin', label: '最小压力', inputType: 'conditionValue', unit: 'Bar', defaultValue: { value: 5.0, unit: 'Bar', condition: '>=' } },
        {
            key: 'centrifuge_polyphenolsRange', label: '茶多酚范围', inputType: 'object',
            fields: [
                { id: uuidv4(), key: 'min', label: '最小值', inputType: 'number', unit: 'mg/kg' },
                { id: uuidv4(), key: 'max', label: '最大值', inputType: 'number', unit: 'mg/kg' },
                { id: uuidv4(), key: 'unit', label: '单位', inputType: 'text', defaultValue: 'mg/kg', enabled: false }
            ],
            defaultValue: { min: 2000, max: 2400, unit: 'mg/kg' }
        },
        {
            key: 'centrifuge_brixRange', label: 'Brix范围', inputType: 'object',
            fields: [
                { id: uuidv4(), key: 'min', label: '最小值', inputType: 'number', unit: 'Brix' },
                { id: uuidv4(), key: 'max', label: '最大值', inputType: 'number', unit: 'Brix' },
                { id: uuidv4(), key: 'unit', label: '单位', inputType: 'text', defaultValue: 'Brix', enabled: false }
            ],
            defaultValue: { min: 0.51, max: 0.61, unit: 'Brix' }
        },
        {
            key: 'centrifuge_pHRange', label: 'pH范围', inputType: 'object',
            fields: [
                { id: uuidv4(), key: 'min', label: '最小值', inputType: 'number', unit: 'pH' },
                { id: uuidv4(), key: 'max', label: '最大值', inputType: 'number', unit: 'pH' },
                { id: uuidv4(), key: 'unit', label: '单位', inputType: 'text', defaultValue: 'pH', enabled: false }
            ],
            defaultValue: { min: 5.3, max: 5.9, unit: 'pH' }
        },
        { key: 'centrifuge_turbidityMax', label: '最大浊度', inputType: 'number', unit: 'NTU', defaultValue: 15 },
        { key: 'centrifuge_targetFinalPolyphenols', label: '目标最终茶多酚', inputType: 'number', unit: 'mg/kg', defaultValue: 650 },
    ],
    'cooling': [
        { key: 'cooling_targetTempMax', label: '目标最高温度', inputType: 'number', unit: '℃', defaultValue: 15, validation: { max: 15, required: true } },
        { key: 'cooling_method', label: '冷却方式', inputType: 'text' },
    ],
    'holding': [
        { key: 'holding_settlingTime', label: '静置时间', inputType: 'number', unit: 'min', defaultValue: 10 },
        { key: 'holding_outletFilterMesh', label: '出口过滤目数', inputType: 'number', unit: '目', defaultValue: 200 },
        { key: 'holding_container', label: '容器名称', inputType: 'text', defaultValue: '暂存桶' },
    ],
    'membraneFiltration': [
        {
            key: 'membrane_membraneMaterial', label: '膜材料', inputType: 'select', options: [
                { value: 'PES', label: 'PES' },
                { value: '其他', label: '其他' }
            ], defaultValue: 'PES'
        },
        { key: 'membrane_poreSize', label: '孔径', inputType: 'number', unit: 'μm', defaultValue: 0.45 },
        {
            key: 'membrane_polyphenolsRange', label: '茶多酚范围', inputType: 'object',
            fields: [
                { id: uuidv4(), key: 'min', label: '最小值', inputType: 'number', unit: 'mg/kg' },
                { id: uuidv4(), key: 'max', label: '最大值', inputType: 'number', unit: 'mg/kg' },
                { id: uuidv4(), key: 'unit', label: '单位', inputType: 'text', defaultValue: 'mg/kg', enabled: false }
            ],
            defaultValue: { min: 2000, max: 2400, unit: 'mg/kg' }
        },
        {
            key: 'membrane_brixRange', label: 'Brix范围', inputType: 'object',
            fields: [
                { id: uuidv4(), key: 'min', label: '最小值', inputType: 'number', unit: 'Brix' },
                { id: uuidv4(), key: 'max', label: '最大值', inputType: 'number', unit: 'Brix' },
                { id: uuidv4(), key: 'unit', label: '单位', inputType: 'text', defaultValue: 'Brix', enabled: false }
            ],
            defaultValue: { min: 0.50, max: 0.60, unit: 'Brix' }
        },
        {
            key: 'membrane_pHRange', label: 'pH范围', inputType: 'object',
            fields: [
                { id: uuidv4(), key: 'min', label: '最小值', inputType: 'number', unit: 'pH' },
                { id: uuidv4(), key: 'max', label: '最大值', inputType: 'number', unit: 'pH' },
                { id: uuidv4(), key: 'unit', label: '单位', inputType: 'text', defaultValue: 'pH', enabled: false }
            ],
            defaultValue: { min: 5.3, max: 5.9, unit: 'pH' }
        },
        { key: 'membrane_turbidityMax', label: '最大浊度', inputType: 'number', unit: 'NTU', defaultValue: 5 },
        { key: 'membrane_endDeltaP', label: '终点压差', inputType: 'number', unit: 'MPa', defaultValue: 0.3 },
        { key: 'membrane_maxInletPressure', label: '最大进口压力', inputType: 'number', unit: 'MPa', defaultValue: 0.6 },
        {
            key: 'membrane_firstBatchFlushRequired', label: '首桶赶水要求', inputType: 'select', options: [
                { value: '是', label: '是' },
                { value: '否', label: '否' }
            ], defaultValue: '是'
        },
        { key: 'membrane_flushNote', label: '赶水说明', inputType: 'text' },
    ],
};

export function syncDefaultFields() {
    console.log('===== 开始同步默认字段配置 =====');

    // 查询现有所有系统字段，建立索引
    const existingFields = db.prepare(`
        SELECT id, process_type, key, is_system 
        FROM process_field_configs 
        WHERE is_system = 1
    `).all() as Array<{ id: string; process_type: string; key: string; is_system: number }>;

    // 建立快速查找索引 (key -> id，因为 key 现在是全局唯一的)
    const existingFieldMap = new Map<string, string>();
    existingFields.forEach(field => {
        existingFieldMap.set(field.key, field.id);
    });

    console.log(`数据库中已有 ${existingFields.length} 个系统字段配置`);

    // 准备 UPSERT 语句（使用 ON CONFLICT，现在 key 是全局唯一的）
    const upsert = db.prepare(`
        INSERT INTO process_field_configs (
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
        ON CONFLICT(key) DO UPDATE SET
            id = excluded.id,
            process_type = excluded.process_type,
            label = excluded.label,
            input_type = excluded.input_type,
            unit = excluded.unit,
            options = excluded.options,
            default_value = excluded.default_value,
            validation = excluded.validation,
            display_condition = excluded.display_condition,
            sort_order = excluded.sort_order,
            is_system = excluded.is_system,
            enabled = excluded.enabled,
            updated_at = excluded.updated_at,
            item_config = excluded.item_config,
            item_fields = excluded.item_fields,
            fields = excluded.fields,
            min_items = excluded.min_items,
            max_items = excluded.max_items
        -- 注意：created_at 不在 UPDATE 中，因此保留原值
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
            const existingId = existingFieldMap.get(field.key);

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
                createdAt: now, // 新增时使用 now，更新时由 SQL 保留原值（不在 UPDATE 子句中）
                updatedAt: now,
                itemConfig: field.itemConfig ? JSON.stringify(field.itemConfig) : null,
                itemFields: field.itemFields ? JSON.stringify(field.itemFields) : null,
                fields: field.fields ? JSON.stringify(field.fields) : null,
                minItems: field.minItems ?? null,
                maxItems: field.maxItems ?? null
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
