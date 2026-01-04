import { DeviceType, EquipmentSpec } from './equipment';
import { TimeValue } from './operation';
import { QuantityValue } from './equipment';

/**
 * 设备状态枚举
 */
export enum DeviceState {
    IDLE = 'IDLE',                           // 空闲
    IN_USE = 'IN_USE',                       // 使用中
    CLEANING = 'CLEANING',                   // 清洗中
    MAINTENANCE = 'MAINTENANCE',             // 维护中
    FAULT = 'FAULT',                         // 故障
    RESERVED = 'RESERVED'                    // 预留
}

/**
 * 设备资源定义（设备池）
 */
export interface DeviceResource {
    deviceCode: string;                      // 设备编号（唯一标识）
    deviceType: DeviceType;                  // 设备类型
    displayName: string;                     // 显示名称
    capacity?: QuantityValue;                // 容量
    specifications?: EquipmentSpec[];        // 设备规格

    // 状态信息（运行时）
    currentState?: DeviceState;              // 当前状态
    currentStepId?: string;                  // 当前执行的步骤ID
    stateChangedAt?: Date;                   // 状态变更时间
}

/**
 * 设备资源需求（步骤级别）
 */
export interface DeviceRequirement {
    // 支持两种模式：指定具体设备 或 指定设备类型（由调度器分配）
    deviceCode?: string;                     // 具体设备编号（如"高搅桶1"）
    deviceType?: DeviceType;                 // 设备类型（如 HIGH_SPEED_MIXER）

    // 约束条件
    requiredCapacity?: QuantityValue;        // 所需容量
    requiredSpecs?: EquipmentSpec[];         // 所需规格

    // 占用模式
    exclusiveUse: boolean;                   // 是否独占使用（默认true）
    occupyDuration?: TimeValue;              // 占用时长（默认为步骤estimatedDuration）
}

/**
 * 设备占用记录（用于甘特图）
 */
export interface DeviceOccupancy {
    deviceCode: string;                      // 设备编号
    stepId: string;                          // 步骤ID
    stepLabel: string;                       // 步骤名称
    processId: string;                       // 所属工艺段ID

    // 时间信息
    startTime: number;                       // 开始时间（相对时间，单位：分钟）
    duration: number;                        // 持续时长（单位：分钟）
    endTime: number;                         // 结束时间（计算得出）

    // 依赖关系
    dependencies?: string[];                 // 依赖的步骤ID列表（必须完成后才能开始）

    // 状态
    state: 'planned' | 'in_progress' | 'completed' | 'delayed';
}

/**
 * 调度结果
 */
export interface ScheduleResult {
    timeline: DeviceOccupancy[];             // 设备占用时间线
    deviceStates: Map<string, DeviceState>;  // 各设备的最终状态
    totalDuration: number;                   // 总耗时（分钟）
    criticalPath: string[];                  // 关键路径（步骤ID列表）
    warnings: ScheduleWarning[];             // 调度警告
}

/**
 * 调度警告
 */
export interface ScheduleWarning {
    type: 'DEVICE_CONFLICT' | 'CAPACITY_EXCEEDED' | 'LONG_IDLE' | 'UNMET_DEPENDENCY';
    severity: 'error' | 'warning' | 'info';
    message: string;
    relatedStepIds?: string[];
    relatedDeviceCodes?: string[];
}
