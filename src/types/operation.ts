import { QuantityValue } from './equipment';

/**
 * 操作指令类型枚举
 */
export enum OperationType {
    // 液体操作
    FILL_WATER = 'FILL_WATER',              // 打水
    DRAIN = 'DRAIN',                         // 排液
    TRANSFER = 'TRANSFER',                   // 转移

    // 搅拌操作
    START_STIRRING = 'START_STIRRING',       // 开始搅拌
    STOP_STIRRING = 'STOP_STIRRING',         // 停止搅拌
    ADJUST_STIRRING = 'ADJUST_STIRRING',     // 调整搅拌速度

    // 物料操作
    ADD_MATERIAL = 'ADD_MATERIAL',           // 投料

    // 温度控制
    HEAT = 'HEAT',                           // 加热
    COOL = 'COOL',                           // 冷却
    MAINTAIN_TEMP = 'MAINTAIN_TEMP',         // 保温

    // 时间控制
    WAIT = 'WAIT',                           // 等待/计时

    // 清洗
    CLEAN = 'CLEAN',                         // 清洗

    // 其他
    MANUAL_OPERATION = 'MANUAL_OPERATION'    // 人工操作
}

/**
 * 操作模板类型（简化操作定义）
 */
export enum OperationTemplate {
    DISSOLUTION_STANDARD = 'dissolution-standard',    // 标准溶解流程
    FILTRATION_AUTO = 'filtration-auto',              // 自动过滤
    TRANSFER_MATERIAL = 'transfer-material',           // 料赶料
    TRANSFER_WATER = 'transfer-water',                 // 水赶料
    COMPOUNDING_SEQUENTIAL = 'compounding-sequential'  // 顺序调配
}

/**
 * 操作指令接口
 */
export interface Operation {
    id: string;                              // 操作ID
    order: number;                           // 执行顺序
    type: OperationType;                     // 操作类型
    description?: string;                    // 操作描述
    params: OperationParams;                 // 操作参数
    isOptional?: boolean;                    // 是否可选操作
    conditions?: OperationCondition[];       // 执行条件
}

/**
 * 操作参数联合类型
 */
export type OperationParams =
    | FillWaterParams
    | TransferParams
    | StirringParams
    | AddMaterialParams
    | TemperatureParams
    | WaitParams
    | CleanParams
    | ManualOperationParams;

// 打水参数
export interface FillWaterParams {
    volume: QuantityValue;
    temperature?: TemperatureRange;
    targetDevice?: string;
}

// 搅拌参数
export interface StirringParams {
    speed?: number | 'high' | 'medium' | 'low';
    speedUnit?: 'rpm' | 'percent';
    duration?: TimeValue;
}

// 投料参数
export interface AddMaterialParams {
    materialRef: string;                     // 引用 MaterialSpec.id
    additionMethod?: 'batch' | 'gradual' | 'continuous';
    additionRate?: QuantityValue;
}

// 转移参数
export interface TransferParams {
    targetDevice: string;
    transferMethod: 'pump' | 'material_push' | 'water_push' | 'gravity';
    volume?: QuantityValue;
    pushVolume?: QuantityValue;
}

// 等待/计时参数
export interface WaitParams {
    duration: TimeValue;
    reason?: string;
}

// 温度控制参数
export interface TemperatureParams {
    targetTemp?: TemperatureRange;
    duration?: TimeValue;
}

// 清洗参数
export interface CleanParams {
    method: 'manual' | 'cip';
    cleaningAgent?: string;
    instruction?: string;
}

// 人工操作参数
export interface ManualOperationParams {
    instruction: string;
    estimatedTime?: TimeValue;
}

/**
 * 操作执行条件
 */
export interface OperationCondition {
    parameter: string;
    operator: '>=' | '<=' | '=' | '>' | '<' | 'range';
    value: number | { min: number; max: number };
    unit?: string;
}

/**
 * 时间值
 */
export interface TimeValue {
    value: number;
    unit: 'h' | 'min' | 's' | 'ms';
}

/**
 * 温度范围
 */
export interface TemperatureRange {
    min?: number;
    max?: number;
    target?: number;
    unit: '℃' | 'K' | '℉';
}
