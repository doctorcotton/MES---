/**
 * 设备类型枚举
 */
export enum DeviceType {
  HIGH_SPEED_MIXER = 'HIGH_SPEED_MIXER',   // 高搅桶
  MIXING_TANK = 'MIXING_TANK',             // 调配桶
  PIPELINE = 'PIPELINE',                   // 管道
  FILTER = 'FILTER',                       // 过滤器
  UHT_MACHINE = 'UHT_MACHINE',             // UHT灭菌机
  FILLING_MACHINE = 'FILLING_MACHINE',     // 灌装机
  ASEPTIC_TANK = 'ASEPTIC_TANK',           // 无菌罐
  OTHER = 'OTHER'
}

/**
 * 设备规格（配置参数）
 */
export interface EquipmentSpec {
  name: string;                            // 规格名称
  value: string | number;                  // 规格值
  unit?: string;                           // 单位
  description?: string;                    // 说明
}

/**
 * 设备配置接口
 */
export interface EquipmentConfig {
  deviceCode: string;                      // 设备编号
  deviceType: DeviceType;                  // 设备类型
  capacity?: QuantityValue;                // 设备容量
  specifications?: EquipmentSpec[];        // 设备规格（如过滤精度）
  constraints?: EquipmentConstraint[];     // 设备约束
}

/**
 * 设备约束
 */
export interface EquipmentConstraint {
  parameter: string;                       // 约束参数
  maxValue?: number;
  minValue?: number;
  unit?: string;
}

/**
 * 通用数量值
 */
export interface QuantityValue {
  value: number;
  unit: string;                            // 'L', 'kg', 'g', etc.
  tolerance?: {                            // 公差
    type: 'absolute' | 'percent';
    value: number;
  };
  condition?: '>=' | '>' | '<=' | '<' | '=';
}
