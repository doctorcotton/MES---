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
  position: { x: number; y: number }; // 由布局算法计算
  data: {
    // 汇总节点数据
    processId?: string;
    processName?: string;
    subStepCount?: number;
    isExpanded?: boolean;
    // 子步骤节点数据
    subStep?: SubStep;
    // 输入来源信息（主要用于调配节点）
    inputSources?: InputSource[];
  };
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
 * 只连接工艺段之间，不包含工艺段内部连线
 */
export interface RecipeEdge {
  id: string;        // unique id, e.g., "e_P1-P6"
  source: string;    // 源工艺段 ID（如 "P1"）
  target: string;    // 目标工艺段 ID（如 "P6"）
  type: 'sequenceEdge'; // 对应 React Flow 自定义连线组件名
  data: {
    sequenceOrder: number; // 投料顺序权重，1 为最优先
  };
  animated?: boolean; // 默认为 true，表示流动方向
  targetHandle?: string; // 目标节点的 handle ID，由布局算法动态分配（如 "target-0", "target-1"）
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
