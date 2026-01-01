/**
 * 工艺类型枚举
 */
export enum ProcessType {
  DISSOLUTION = 'dissolution',        // 溶解
  COMPOUNDING = 'compounding',       // 调配
  FILTRATION = 'filtration',         // 过滤
  TRANSFER = 'transfer',             // 赶料
  FLAVOR_ADDITION = 'flavorAddition', // 香精添加
  OTHER = 'other'                    // 其他
}

/**
 * 数值条件类型
 */
export type ConditionType = '>=' | '>' | '<=' | '<' | '=';

/**
 * 带条件的数值
 */
export interface ConditionValue {
  value: number;
  unit: string;
  condition?: ConditionType;
}

/**
 * 温度范围
 */
export interface TemperatureRange {
  min?: number;
  max?: number;
  unit: '℃';
}

/**
 * 搅拌速率枚举
 */
export type StirringRate = 'high' | 'medium' | 'low';

/**
 * 赶料类型枚举
 */
export type TransferType = 'material' | 'water' | 'none';

/**
 * 添加物类型
 */
export type AdditiveType = 'rawMaterial' | 'solution';

/**
 * 调配添加物
 */
export interface CompoundingAdditive {
  order: number;              // 添加顺序
  type: AdditiveType;         // 类型：原料或溶解液
  source?: string;            // 来源节点ID（如果是溶解液）
  name: string;               // 名称
  amount?: string;            // 用量（如 "10%-20%"）
}

/**
 * 溶解参数接口
 */
export interface DissolutionParams {
  waterVolume: ConditionValue;      // 水量
  waterTemp: TemperatureRange;       // 水温
  stirringTime: { value: number; unit: 'min' }; // 搅拌时间
  stirringRate: StirringRate;        // 搅拌速率
  transferType: TransferType;        // 赶料类型
}

/**
 * 调配参数接口
 */
export interface CompoundingParams {
  additives: CompoundingAdditive[];  // 添加物列表（有序）
  stirringSpeed: ConditionValue;     // 搅拌速度
  stirringTime: { value: number; unit: 'min' }; // 搅拌时间
  finalTemp: { max: number; unit: '℃' };       // 最终温度
}

/**
 * 过滤参数接口
 */
export interface FiltrationParams {
  precision: { value: number; unit: 'μm' }; // 过滤精度
}

/**
 * 赶料参数接口
 */
export interface TransferParams {
  transferType: TransferType;        // 赶料类型
  waterVolume?: ConditionValue;      // 水量（如果是水赶料）
  cleaning?: string;                  // 清洗要求
}

/**
 * 香精添加参数接口
 */
export interface FlavorAdditionParams {
  method: string;                    // 添加方式（如 "按配方投料"）
}

/**
 * 可辨识联合类型 - 工艺节点数据
 */
export type ProcessNodeData =
  | ({ processType: ProcessType.DISSOLUTION } & { dissolutionParams: DissolutionParams })
  | ({ processType: ProcessType.COMPOUNDING } & { compoundingParams: CompoundingParams })
  | ({ processType: ProcessType.FILTRATION } & { filtrationParams: FiltrationParams })
  | ({ processType: ProcessType.TRANSFER } & { transferParams: TransferParams })
  | ({ processType: ProcessType.FLAVOR_ADDITION } & { flavorAdditionParams: FlavorAdditionParams })
  | ({ processType: ProcessType.OTHER } & { params: string });

/**
 * 完整的配方数据对象 (Root Object)
 */
export interface RecipeSchema {
  metadata: {
    name: string;
    version: string;
    updatedAt: string;
  };
  nodes: RecipeNode[];
  edges: RecipeEdge[];
}

/**
 * 节点定义
 */
export interface RecipeNode {
  id: string;        // 核心主键，如 "P1"
  type: 'customProcessNode'; // 对应 React Flow 自定义节点组件名
  data: ProcessNodeData & {
    label: string;       // 步骤名称，如 "糖醇溶解"
    deviceCode: string;  // 设备号，如 "TANK_01" (对应表格的位置列)
    ingredients: string; // 原料描述
    // 保留 params 作为向后兼容字段（可选）
    params?: string;
  };
  position: { x: number; y: number }; // 由 Dagre 自动计算，无需持久化存储
}

/**
 * 类型守卫函数
 */
export function isDissolutionNode(node: RecipeNode): node is RecipeNode & { data: { processType: ProcessType.DISSOLUTION; dissolutionParams: DissolutionParams } } {
  return node.data.processType === ProcessType.DISSOLUTION;
}

export function isCompoundingNode(node: RecipeNode): node is RecipeNode & { data: { processType: ProcessType.COMPOUNDING; compoundingParams: CompoundingParams } } {
  return node.data.processType === ProcessType.COMPOUNDING;
}

export function isFiltrationNode(node: RecipeNode): node is RecipeNode & { data: { processType: ProcessType.FILTRATION; filtrationParams: FiltrationParams } } {
  return node.data.processType === ProcessType.FILTRATION;
}

export function isTransferNode(node: RecipeNode): node is RecipeNode & { data: { processType: ProcessType.TRANSFER; transferParams: TransferParams } } {
  return node.data.processType === ProcessType.TRANSFER;
}

export function isFlavorAdditionNode(node: RecipeNode): node is RecipeNode & { data: { processType: ProcessType.FLAVOR_ADDITION; flavorAdditionParams: FlavorAdditionParams } } {
  return node.data.processType === ProcessType.FLAVOR_ADDITION;
}

/**
 * 连线定义 (包含顺序逻辑)
 */
export interface RecipeEdge {
  id: string;        // unique id, e.g., "e_P1-P6"
  source: string;    // 源节点 ID
  target: string;    // 目标节点 ID
  type: 'sequenceEdge'; // 对应 React Flow 自定义连线组件名
  data: {
    sequenceOrder: number; // 投料顺序权重，1 为最优先
  };
  animated?: boolean; // 默认为 true，表示流动方向
  targetHandle?: string; // 目标节点的 handle ID，由布局算法动态分配（如 "target-0", "target-1"）
}
