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

    // 新增：使用模式（工厂配置层使用）
    usageMode?: DeviceUsageMode;             // 使用模式：默认/备用/禁用

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
 * 占用段（用于区分等待和实际工作）
 */
export interface OccupancySegment {
    kind: 'wait' | 'mix' | 'work';          // 段类型：等待/搅拌/工作
    start: number;                          // 段开始时间（相对时间，单位：分钟）
    end: number;                            // 段结束时间（相对时间，单位：分钟）
    label?: string;                          // 可选的段标签
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

    // 分段信息（用于调配等复杂步骤）
    segments?: OccupancySegment[];          // 占用段列表（如等待段+搅拌段）
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

/**
 * 配置层级枚举
 */
export enum ConfigurationLevel {
    RECIPE = 'RECIPE',                       // 配方层（研发视图）
    FACTORY = 'FACTORY',                     // 工厂层（生产视图）
    PRODUCTION_LINE = 'PRODUCTION_LINE'      // 产线层（具体产线）
}

/**
 * 设备使用模式
 */
export enum DeviceUsageMode {
    PRIMARY = 'PRIMARY',     // 默认使用
    BACKUP = 'BACKUP',       // 备用（特殊情况才启用）
    DISABLED = 'DISABLED'    // 禁用
}

/**
 * 工厂产线配置
 */
export interface ProductionLineConfig {
    id: string;                              // 产线ID（如 "tianjin-line1"）
    factoryName: string;                     // 工厂名称（如 "天津厂"）
    lineName: string;                        // 产线名称（如 "一线"）

    // 设备配置
    devicePool: DeviceResource[];            // 该产线的实际设备列表

    // 设备能力约束
    missingDeviceTypes?: DeviceType[];       // 缺少的设备类型（如没有离心机）

    // 设备映射规则（配方设备 -> 实际设备）
    deviceMapping?: Record<string, string>;  // 配方设备编号 -> 实际设备编号

    // 元数据
    description?: string;                    // 产线描述
    enabled: boolean;                        // 是否启用
    createdAt?: Date;                        // 创建时间
    updatedAt?: Date;                        // 更新时间
}

/**
 * 设备配置上下文（用于调度）
 */
export interface DeviceConfigContext {
    level: ConfigurationLevel;               // 配置层级

    // 配方层配置（研发视图 - 通用/理想配置）
    recipeDevicePool?: DeviceResource[];     // 配方设计时的默认设备配置

    // 工厂层配置（生产视图 - 实际物理配置）
    productionLineConfig?: ProductionLineConfig;  // 具体产线的设备配置

    // 使用哪个配置
    activeDevicePool: DeviceResource[];      // 当前激活的设备池
}

/**
 * 工厂配置（包含多个产线）
 */
export interface FactoryConfig {
    id: string;                              // 工厂ID
    name: string;                            // 工厂名称
    location?: string;                       // 工厂位置
    productionLines: ProductionLineConfig[]; // 产线列表
    enabled: boolean;                        // 是否启用
}
