import { EquipmentConfig, DeviceType } from './equipment';
import { MaterialSpec, MaterialRole } from './material';
import { Operation, TimeValue } from './operation';
import { DeviceRequirement } from './scheduling';

// Temporary fix for missing type
type RecipeNode = any;

/**
 * 工艺类型（可扩展的字符串类型）
 * 支持运行时动态扩展，基础类型作为常量保留
 */
export type ProcessType = string;

/**
 * 基础工艺类型常量（向后兼容）
 * 使用 ProcessTypes 访问常量值，ProcessType 作为类型使用
 */
export const ProcessTypes = {
  DISSOLUTION: 'dissolution' as const,        // 溶解
  COMPOUNDING: 'compounding' as const,       // 调配
  FILTRATION: 'filtration' as const,         // 过滤
  TRANSFER: 'transfer' as const,             // 赶料
  FLAVOR_ADDITION: 'flavorAddition' as const, // 香精添加
  OTHER: 'other' as const,                    // 其他
  EXTRACTION: 'extraction' as const,          // 萃取
  CENTRIFUGE: 'centrifuge' as const,          // 离心
  COOLING: 'cooling' as const,                // 冷却
  HOLDING: 'holding' as const,                // 暂存
  MEMBRANE_FILTRATION: 'membraneFiltration' as const, // 膜过滤
} as const;

/**
 * 为了向后兼容，保留 ProcessType 作为命名空间访问常量
 * 注意：ProcessType 是类型，ProcessType.XXX 访问常量（通过类型断言）
 */
export const ProcessType = ProcessTypes;

/**
 * 基础工艺类型集合（用于类型检查）
 */
export const BASE_PROCESS_TYPES = [
  ProcessTypes.DISSOLUTION,
  ProcessTypes.COMPOUNDING,
  ProcessTypes.FILTRATION,
  ProcessTypes.TRANSFER,
  ProcessTypes.FLAVOR_ADDITION,
  ProcessTypes.OTHER,
  ProcessTypes.EXTRACTION,
  ProcessTypes.CENTRIFUGE,
  ProcessTypes.COOLING,
  ProcessTypes.HOLDING,
  ProcessTypes.MEMBRANE_FILTRATION,
] as const;

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
 * 水量模式枚举
 */
export type WaterVolumeMode = 'ratio' | 'fixed';

/**
 * 料水比范围
 */
export interface WaterRatio {
  min: number;  // 最小比例，如 5 表示 1:5
  max: number;  // 最大比例，如 8 表示 1:8
}

/**
 * 溶解参数接口
 */
export interface DissolutionParams {
  waterVolumeMode: WaterVolumeMode;   // 水量模式（默认 ratio）
  waterRatio?: WaterRatio;            // 料水比（ratio模式）
  waterVolume?: ConditionValue;       // 水量（fixed模式）
  waterTemp: TemperatureRange;        // 水温
  stirringTime: { value: number; unit: 'min' }; // 搅拌时间
  stirringRate: StirringRate;         // 搅拌速率
  transferType: TransferType;         // 赶料类型
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
 * 茶叶配比项
 */
export interface TeaBlendItem {
  teaCode: string;      // 茶叶代码，如 "PT044"
  teaName: string;      // 茶叶名称，如 "普洱生茶"
  ratioPart: number;    // 配比份数，如 4, 9, 2
}

/**
 * 萃取参数接口
 */
export interface ExtractionParams {
  extractWaterVolume?: ConditionValue;   // 萃取水量（L）
  waterTempRange?: TemperatureRange;     // 水温范围（℃），如 84-86
  tempMaxLimit?: number;                  // 温度上限（℃），默认 87
  teaWaterRatio?: WaterRatio;            // 茶水比（1:X），默认 1:50
  teaBlend?: TeaBlendItem[];             // 茶叶配比数组
  extractTime?: { value: number; unit: 'min' | 's' };  // 萃取时长
  stirProgram?: string;                  // 搅拌程序描述
  referenceRpm?: number;                 // 参考转速（r/min），默认 10
  pourTimeLimitSec?: number;             // 倾倒时间限制（秒），默认 130
  openExtraction?: '是' | '否';          // 敞口提取，默认 '是'
  stirDuringFeeding?: '是' | '否';       // 投料期间开启搅拌，默认 '否'
  exhaustFanOff?: '是' | '否';          // 投料/萃取/倾倒关闭排气扇，默认 '是'
}

/**
 * 离心参数接口
 */
export interface CentrifugeParams {
  inletFilterMesh?: number;              // 入口过滤目数，如 200
  flowRateRange?: { min: number; max: number; unit: 't/h' };  // 流量范围，默认 5.0-5.5 t/h
  pressureMin?: ConditionValue;          // 最小压力（Bar），默认 ≥5.0
  polyphenolsRange?: { min: number; max: number; unit: 'mg/kg' };  // 茶多酚范围，2000-2400
  brixRange?: { min: number; max: number; unit: 'Brix' };    // Brix范围，0.51-0.61
  pHRange?: { min: number; max: number; unit: 'pH' };        // pH范围，5.3-5.9
  turbidityMax?: number;                 // 最大浊度（NTU），默认 15
  targetFinalPolyphenols?: number;       // 目标最终茶多酚（mg/kg），默认 650
}

/**
 * 冷却参数接口
 */
export interface CoolingParams {
  targetTempMax: number;                 // 目标最高温度（℃），默认 15，max=15
  method?: string;                       // 冷却方式/注意事项（可选）
}

/**
 * 暂存参数接口
 */
export interface HoldingParams {
  settlingTime?: number;                 // 静置时间（min），默认 10
  outletFilterMesh?: number;             // 出口过滤目数，默认 200
  container?: string;                    // 容器名称，默认 "暂存桶"
}

/**
 * 膜过滤参数接口
 */
export interface MembraneFiltrationParams {
  membraneMaterial?: 'PES' | '其他';     // 膜材料，默认 'PES'
  poreSize?: number;                     // 孔径（μm），默认 0.45
  polyphenolsRange?: { min: number; max: number; unit: 'mg/kg' };  // 茶多酚范围，2000-2400
  brixRange?: { min: number; max: number; unit: 'Brix' };    // Brix范围，0.50-0.60
  pHRange?: { min: number; max: number; unit: 'pH' };        // pH范围，5.3-5.9
  turbidityMax?: number;                 // 最大浊度（NTU），默认 5
  endDeltaP?: number;                    // 终点压差（MPa），默认 0.3
  maxInletPressure?: number;             // 最大进口压力（MPa），默认 0.6
  firstBatchFlushRequired?: '是' | '否'; // 首桶赶水要求，默认 '是'
  flushNote?: string;                    // 赶水说明/仪器校准说明
}

/**
 * 可辨识联合类型 - 工艺节点数据
 */
export type ProcessNodeData =
  | ({ processType: typeof ProcessTypes.DISSOLUTION } & { dissolutionParams: DissolutionParams })
  | ({ processType: typeof ProcessTypes.COMPOUNDING } & { compoundingParams: CompoundingParams })
  | ({ processType: typeof ProcessTypes.FILTRATION } & { filtrationParams: FiltrationParams })
  | ({ processType: typeof ProcessTypes.TRANSFER } & { transferParams: TransferParams })
  | ({ processType: typeof ProcessTypes.FLAVOR_ADDITION } & { flavorAdditionParams: FlavorAdditionParams })
  | ({ processType: typeof ProcessTypes.EXTRACTION } & { extractionParams: ExtractionParams })
  | ({ processType: typeof ProcessTypes.CENTRIFUGE } & { centrifugeParams: CentrifugeParams })
  | ({ processType: typeof ProcessTypes.COOLING } & { coolingParams: CoolingParams })
  | ({ processType: typeof ProcessTypes.HOLDING } & { holdingParams: HoldingParams })
  | ({ processType: typeof ProcessTypes.MEMBRANE_FILTRATION } & { membraneFiltrationParams: MembraneFiltrationParams })
  | ({ processType: typeof ProcessTypes.OTHER } & { params: string })
  | ({ processType: string } & { [key: string]: any }); // 支持动态扩展类型

/**
 * 子步骤定义（用于合并步骤内的子步骤序列）
 */
export interface SubStep {
  id: string;                    // 子步骤ID: "P1-substep-1"
  order: number;                 // 执行顺序: 1, 2, 3...
  processType: ProcessType;      // 工艺类型: 溶解、过滤、赶料等
  label: string;                 // 子步骤名称: "溶解"
  deviceCode: string;            // 设备编号: "高搅桶1"
  ingredients: string;           // 原料描述
  params: ProcessNodeData;       // 工艺参数（根据processType动态）

  // === 新字段（可选，逐步迁移） ===
  equipmentV2?: EquipmentConfig;      // 设备配置（新结构）
  materialsV2?: MaterialSpec[];       // 物料清单（新结构）
  operationsV2?: Operation[];         // 操作序列（新结构）

  // === 调度相关（新） ===
  deviceRequirement?: DeviceRequirement;    // 设备资源需求
  canParallelWith?: string[];              // 可以并行的步骤ID列表
  mustAfter?: string[];                     // 必须在某些步骤之后执行
  estimatedDuration?: TimeValue;           // 预计耗时（用于调度）

  // === 迁移辅助字段 ===
  _migrated?: boolean;               // 是否已迁移到新结构
  _migrationSource?: string;          // 迁移来源（用于调试）
  templateVersion?: number;           // 创建时的模板版本号
}

/**
 * 步骤节点定义（合并后的整体步骤）
 */
export interface ProcessNode {
  id: string;                    // 节点ID: "P1" (与工艺段ID相同)
  type: 'processNode';           // 节点类型（固定值）
  label: string;                 // 节点标签: "糖醇、三氯蔗糖类溶解液"
  subSteps: SubStep[];           // 子步骤序列
  position?: { x: number; y: number };  // 布局位置（前端计算）
}

/**
 * 工艺段（Process）定义
 * 一个工艺段包含一个合并步骤节点，该节点内含多个子步骤序列
 */
export interface Process {
  id: string;                    // 工艺段ID: "P1"
  name: string;                  // 工艺段名称: "糖醇、三氯蔗糖类溶解液"
  description?: string;          // 工艺段描述
  node: ProcessNode;             // 该工艺段的步骤节点（单节点）
}

/**
 * 完整的配方数据对象 (Root Object)
 */
export interface RecipeSchema {
  metadata: {
    name: string;
    version: string;
    updatedAt: string;
  };
  processes: Process[];      // 主数据结构（工艺段列表）
  edges: RecipeEdge[];       // 工艺段间连线（只连接Process.id）
}

/**
 * 节点定义（用于流程图渲染）
 * 支持两种模式：
 * 1. 汇总节点（折叠模式）：显示工艺段汇总信息
 * 2. 子步骤节点（展开模式）：显示单个子步骤详情
 */
/**
 * 输入来源信息（用于调配节点显示进料顺序）
 */
export interface InputSource {
  nodeId: string;           // 来源节点ID
  name: string;              // 来源名称（子步骤名称或工艺段名称）
  processId: string;         // 来源工艺段ID
  processName: string;       // 来源工艺段名称
  sequenceOrder: number;     // 投料顺序序号
}

export interface FlowNode {
  id: string;        // 节点ID: "P1" (汇总节点) 或 "P1-substep-1" (子步骤节点)
  type: 'processSummaryNode' | 'subStepNode'; // 节点类型
  position: { x: number; y: number }; // 由布局算法计算，初始化时使用 (0, 0)
  // React Flow runtime-measured sizes (populated by ReactFlow store)
  width?: number;
  height?: number;
  data: {
    // 汇总节点数据
    processId?: string;
    processName?: string;
    subStepCount?: number;
    isExpanded?: boolean;
    displayOrder?: number; // 显示顺序（基于 processes 数组索引 + 1），用于显示 P1、P2 等标签
    // 子步骤节点数据
    subStep?: SubStep;
    // 输入来源信息（主要用于调配节点）
    inputSources?: InputSource[];
  };
}

/**
 * 类型守卫函数
 */
export function isDissolutionNode(node: RecipeNode): node is RecipeNode & { data: { processType: typeof ProcessTypes.DISSOLUTION; dissolutionParams: DissolutionParams } } {
  return node.data.processType === ProcessTypes.DISSOLUTION;
}

export function isCompoundingNode(node: RecipeNode): node is RecipeNode & { data: { processType: typeof ProcessTypes.COMPOUNDING; compoundingParams: CompoundingParams } } {
  return node.data.processType === ProcessTypes.COMPOUNDING;
}

export function isFiltrationNode(node: RecipeNode): node is RecipeNode & { data: { processType: typeof ProcessTypes.FILTRATION; filtrationParams: FiltrationParams } } {
  return node.data.processType === ProcessTypes.FILTRATION;
}

export function isTransferNode(node: RecipeNode): node is RecipeNode & { data: { processType: typeof ProcessTypes.TRANSFER; transferParams: TransferParams } } {
  return node.data.processType === ProcessTypes.TRANSFER;
}

export function isFlavorAdditionNode(node: RecipeNode): node is RecipeNode & { data: { processType: typeof ProcessTypes.FLAVOR_ADDITION; flavorAdditionParams: FlavorAdditionParams } } {
  return node.data.processType === ProcessTypes.FLAVOR_ADDITION;
}

export function isExtractionNode(node: RecipeNode): node is RecipeNode & { data: { processType: typeof ProcessTypes.EXTRACTION; extractionParams: ExtractionParams } } {
  return node.data.processType === ProcessTypes.EXTRACTION;
}

export function isCentrifugeNode(node: RecipeNode): node is RecipeNode & { data: { processType: typeof ProcessTypes.CENTRIFUGE; centrifugeParams: CentrifugeParams } } {
  return node.data.processType === ProcessTypes.CENTRIFUGE;
}

export function isCoolingNode(node: RecipeNode): node is RecipeNode & { data: { processType: typeof ProcessTypes.COOLING; coolingParams: CoolingParams } } {
  return node.data.processType === ProcessTypes.COOLING;
}

export function isHoldingNode(node: RecipeNode): node is RecipeNode & { data: { processType: typeof ProcessTypes.HOLDING; holdingParams: HoldingParams } } {
  return node.data.processType === ProcessTypes.HOLDING;
}

export function isMembraneFiltrationNode(node: RecipeNode): node is RecipeNode & { data: { processType: typeof ProcessTypes.MEMBRANE_FILTRATION; membraneFiltrationParams: MembraneFiltrationParams } } {
  return node.data.processType === ProcessTypes.MEMBRANE_FILTRATION;
}

/**
 * 连线定义 (包含顺序逻辑)
 * 只连接工艺段之间，不包含工艺段内部连线
 */
export interface RecipeEdge {
  id: string;        // unique id, e.g., "e_P1-P6"
  source: string;    // 源工艺段 ID（如 "P1"）
  target: string;    // 目标工艺段 ID（如 "P6"）
  type: 'sequenceEdge'; // 对应 React Flow 自定义连线组件名
  data: {
    sequenceOrder: number; // 投料顺序权重，1 为最优先
    incomingTotal?: number; // 目标节点的入边总数，用于判断是否启用走廊路由
  };
  animated?: boolean; // 默认为 true，表示流动方向
  targetHandle?: string; // 目标节点的 handle ID，由布局算法动态分配（如 "target-0", "target-1"）
  sourceHandle?: string; // 源节点的 handle ID，由布局算法动态分配（如 "source-0", "source-1"）
}

/**
 * 工具函数：从子步骤节点ID提取Process ID
 * 支持格式 "P1-substep-1" -> "P1"
 */
export function extractProcessIdFromSubStepId(subStepId: string): string {
  const match = subStepId.match(/^([P]\d+)-substep-/);
  return match ? match[1] : subStepId;
}

/**
 * 工具函数：查找子步骤所属的Process
 */
export function findProcessBySubStepId(processes: Process[], subStepId: string): Process | undefined {
  const processId = extractProcessIdFromSubStepId(subStepId);
  return processes.find(process => process.id === processId);
}

/**
 * 工具函数：提取Process节点数组（用于布局）
 */
export function extractProcessNodes(processes: Process[]): ProcessNode[] {
  return processes.map(process => process.node);
}

/**
 * 工具函数：检查是否已迁移
 */
export function isSubStepMigrated(subStep: SubStep): boolean {
  return subStep._migrated === true &&
    subStep.equipmentV2 !== undefined &&
    subStep.materialsV2 !== undefined &&
    subStep.operationsV2 !== undefined;
}

/**
 * 工具函数：获取设备配置（兼容新旧）
 */
export function getEquipmentConfig(subStep: SubStep): EquipmentConfig | null {
  if (subStep.equipmentV2) {
    return subStep.equipmentV2;
  }
  // 从旧字段构建
  if (subStep.deviceCode) {
    return {
      deviceCode: subStep.deviceCode,
      deviceType: DeviceType.OTHER,  // 默认类型
    };
  }
  return null;
}

/**
 * 工具函数：获取物料列表（兼容新旧）
 */
export function getMaterials(subStep: SubStep): MaterialSpec[] {
  if (subStep.materialsV2) {
    return subStep.materialsV2;
  }
  // 从旧字段解析（简单解析 ingredients 字符串）
  if (subStep.ingredients && subStep.ingredients !== '-') {
    // 简单解析：按逗号分割
    const separator = subStep.ingredients.includes('、') ? '、' : ',';
    return subStep.ingredients.split(separator).map((name, idx) => ({
      id: `${subStep.id}-mat-${idx}`,
      name: name.trim(),
      role: MaterialRole.SOLUTE,  // 默认角色
    }));
  }
  return [];
}
