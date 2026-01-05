import { ProcessType, ProcessNodeData } from './recipe';
import { DeviceType } from './equipment';

/**
 * 子步骤类型模板
 */
export interface SubStepTemplate {
    type: ProcessType;
    version: number;                    // 模板版本号
    label: string;                      // 默认步骤名称
    defaultDeviceCode: string;          // 默认设备编号
    defaultDeviceType: DeviceType;      // 默认设备类型
    defaultParams: ProcessNodeData;     // 默认参数
    description?: string;               // 类型描述
    enabledFields?: string[];           // 启用的字段键名列表（未设置时默认全部启用）
}

/**
 * 工艺段类型模板
 */
export interface ProcessSegmentTemplate {
    id: string;
    version: number;
    name: string;                       // 显示名称
    description?: string;               // 描述
    defaultSubStepTypes: ProcessType[]; // 默认子步骤类型序列
}

/**
 * 工艺类型配置
 */
export interface ProcessTypeConfig {
    subStepTemplates: Record<ProcessType, SubStepTemplate>;
    processSegmentTemplates: ProcessSegmentTemplate[];
}

/**
 * 字段输入类型
 */
export type FieldInputType =
    | 'number'           // 数值输入
    | 'text'             // 文本输入
    | 'select'           // 下拉选择
    | 'range'            // 范围输入（最小/最大）
    | 'conditionValue'   // 条件值（值+ 条件运算符）
    | 'waterRatio';      // 料水比（最小/最大）

/**
 * 字段配置
 */
export interface SubStepFieldConfig {
    key: string;                    // 字段键名
    label: string;                  // 显示名称
    inputType: FieldInputType;      // 输入类型
    unit?: string;                  // 单位
    required?: boolean;             // 是否必填
    options?: { value: string; label: string }[];  // 下拉选项
    defaultValue?: any;             // 默认值
}

/**
 * 工艺类型字段配置
 */
export const PROCESS_TYPE_FIELDS: Record<ProcessType, SubStepFieldConfig[]> = {
    [ProcessType.DISSOLUTION]: [
        {
            key: 'waterVolumeMode', label: '水量模式', inputType: 'select', options: [
                { value: 'ratio', label: '料水比' },
                { value: 'fixed', label: '固定水量' },
            ], defaultValue: 'ratio', required: true
        },
        { key: 'waterRatio', label: '料水比', inputType: 'waterRatio', unit: '(1:X)', defaultValue: { min: 5, max: 8 } },
        { key: 'waterVolume', label: '水量', inputType: 'conditionValue', unit: 'L' },
        { key: 'waterTemp', label: '水温', inputType: 'range', unit: '℃' },
        { key: 'stirringTime', label: '搅拌时间', inputType: 'number', unit: 'min', required: true },
        {
            key: 'stirringRate', label: '搅拌速率', inputType: 'select', options: [
                { value: 'high', label: '高速' },
                { value: 'medium', label: '中速' },
                { value: 'low', label: '低速' },
            ], required: true
        },
        {
            key: 'transferType', label: '赶料类型', inputType: 'select', options: [
                { value: 'material', label: '料赶料' },
                { value: 'water', label: '水赶料' },
                { value: 'none', label: '无' },
            ], required: true
        },
    ],
    [ProcessType.COMPOUNDING]: [
        { key: 'stirringSpeed', label: '搅拌速度', inputType: 'conditionValue', unit: '%', required: true },
        { key: 'stirringTime', label: '搅拌时间', inputType: 'number', unit: 'min', required: true },
        { key: 'finalTemp', label: '最终温度', inputType: 'number', unit: '℃', required: true },
    ],
    [ProcessType.FILTRATION]: [
        { key: 'precision', label: '过滤精度', inputType: 'number', unit: 'μm', required: true },
    ],
    [ProcessType.TRANSFER]: [
        {
            key: 'transferType', label: '赶料类型', inputType: 'select', options: [
                { value: 'material', label: '料赶料' },
                { value: 'water', label: '水赶料' },
                { value: 'none', label: '无' },
            ], required: true
        },
        { key: 'waterVolume', label: '水量', inputType: 'number', unit: 'L' },
        { key: 'cleaning', label: '清洗要求', inputType: 'text' },
    ],
    [ProcessType.FLAVOR_ADDITION]: [
        { key: 'method', label: '添加方式', inputType: 'text', required: true },
    ],
    [ProcessType.OTHER]: [
        { key: 'params', label: '参数描述', inputType: 'text' },
    ],
};

// ============ 默认子步骤模板 ============

export const DEFAULT_DISSOLUTION_TEMPLATE: SubStepTemplate = {
    type: ProcessType.DISSOLUTION,
    version: 1,
    label: '溶解',
    defaultDeviceCode: '高搅桶1',
    defaultDeviceType: DeviceType.HIGH_SPEED_MIXER,
    defaultParams: {
        processType: ProcessType.DISSOLUTION,
        dissolutionParams: {
            waterVolumeMode: 'ratio',
            waterRatio: { min: 5, max: 8 },
            waterTemp: { unit: '℃' },
            stirringTime: { value: 6, unit: 'min' },
            stirringRate: 'high',
            transferType: 'material',
        },
    },
    description: '溶解原料于水中',
};

export const DEFAULT_COMPOUNDING_TEMPLATE: SubStepTemplate = {
    type: ProcessType.COMPOUNDING,
    version: 1,
    label: '调配定容',
    defaultDeviceCode: '调配桶',
    defaultDeviceType: DeviceType.MIXING_TANK,
    defaultParams: {
        processType: ProcessType.COMPOUNDING,
        compoundingParams: {
            additives: [],
            stirringSpeed: { value: 90, unit: '%', condition: '>=' },
            stirringTime: { value: 10, unit: 'min' },
            finalTemp: { max: 30, unit: '℃' },
        },
    },
    description: '调配和定容',
};

export const DEFAULT_FILTRATION_TEMPLATE: SubStepTemplate = {
    type: ProcessType.FILTRATION,
    version: 1,
    label: '过滤',
    defaultDeviceCode: '管道',
    defaultDeviceType: DeviceType.FILTER,
    defaultParams: {
        processType: ProcessType.FILTRATION,
        filtrationParams: {
            precision: { value: 0.5, unit: 'μm' },
        },
    },
    description: '过滤杂质',
};

export const DEFAULT_TRANSFER_TEMPLATE: SubStepTemplate = {
    type: ProcessType.TRANSFER,
    version: 1,
    label: '赶料',
    defaultDeviceCode: '高搅桶1',
    defaultDeviceType: DeviceType.HIGH_SPEED_MIXER,
    defaultParams: {
        processType: ProcessType.TRANSFER,
        transferParams: {
            transferType: 'material',
        },
    },
    description: '物料转移',
};

export const DEFAULT_FLAVOR_ADDITION_TEMPLATE: SubStepTemplate = {
    type: ProcessType.FLAVOR_ADDITION,
    version: 1,
    label: '香精添加',
    defaultDeviceCode: '人工',
    defaultDeviceType: DeviceType.OTHER,
    defaultParams: {
        processType: ProcessType.FLAVOR_ADDITION,
        flavorAdditionParams: {
            method: '按配方投料',
        },
    },
    description: '添加香精',
};

export const DEFAULT_OTHER_TEMPLATE: SubStepTemplate = {
    type: ProcessType.OTHER,
    version: 1,
    label: '新步骤',
    defaultDeviceCode: '',
    defaultDeviceType: DeviceType.OTHER,
    defaultParams: {
        processType: ProcessType.OTHER,
        params: '',
    },
    description: '其他工艺步骤',
};

/**
 * 默认子步骤模板集合
 */
export const DEFAULT_SUBSTEP_TEMPLATES: Record<ProcessType, SubStepTemplate> = {
    [ProcessType.DISSOLUTION]: DEFAULT_DISSOLUTION_TEMPLATE,
    [ProcessType.COMPOUNDING]: DEFAULT_COMPOUNDING_TEMPLATE,
    [ProcessType.FILTRATION]: DEFAULT_FILTRATION_TEMPLATE,
    [ProcessType.TRANSFER]: DEFAULT_TRANSFER_TEMPLATE,
    [ProcessType.FLAVOR_ADDITION]: DEFAULT_FLAVOR_ADDITION_TEMPLATE,
    [ProcessType.OTHER]: DEFAULT_OTHER_TEMPLATE,
};

/**
 * 默认工艺段模板
 */
export const DEFAULT_PROCESS_SEGMENT_TEMPLATES: ProcessSegmentTemplate[] = [
    {
        id: 'dissolution_process',
        version: 1,
        name: '溶解工艺段',
        description: '标准溶解工艺：溶解→过滤→赶料',
        defaultSubStepTypes: [ProcessType.DISSOLUTION, ProcessType.FILTRATION, ProcessType.TRANSFER],
    },
    {
        id: 'compounding_process',
        version: 1,
        name: '调配工艺段',
        description: '调配定容工艺',
        defaultSubStepTypes: [ProcessType.COMPOUNDING],
    },
    {
        id: 'flavor_process',
        version: 1,
        name: '香精添加工艺段',
        description: '香精添加',
        defaultSubStepTypes: [ProcessType.FLAVOR_ADDITION],
    },
    {
        id: 'other_process',
        version: 1,
        name: '其他工艺段',
        description: '自定义工艺',
        defaultSubStepTypes: [ProcessType.OTHER],
    },
];

/**
 * 获取工艺类型的中文名称
 */
export function getProcessTypeName(type: ProcessType): string {
    const names: Record<ProcessType, string> = {
        [ProcessType.DISSOLUTION]: '溶解',
        [ProcessType.COMPOUNDING]: '调配',
        [ProcessType.FILTRATION]: '过滤',
        [ProcessType.TRANSFER]: '赶料',
        [ProcessType.FLAVOR_ADDITION]: '香精添加',
        [ProcessType.OTHER]: '其他',
    };
    return names[type];
}
