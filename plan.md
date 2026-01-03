---
name: 阶段1-核心数据结构重构
overview: 渐进式重构工艺配方数据结构，清晰区分设备配置参数、操作指令和物料信息。采用向后兼容的渐进式迁移策略，确保现有功能正常运行的同时，为MES系统集成打下基础。
todos:
  - id: create-base-types
    content: 创建基础类型定义：operation.ts, equipment.ts, material.ts
    status: pending
  - id: extend-substep
    content: 扩展 SubStep 接口，新增可选字段（渐进式兼容）
    status: pending
  - id: create-operation-templates
    content: 创建操作模板系统，简化操作序列定义
    status: pending
  - id: migrate-data-gradually
    content: 渐进式迁移 initialData.ts，保留旧字段，新增结构化字段
    status: pending
  - id: update-params-modal
    content: 更新 ParamsModal，支持新结构的编辑（兼容旧数据）
    status: pending
  - id: update-recipe-table
    content: 更新 RecipeTable，展示新结构（优先显示新字段，回退到旧字段）
    status: pending
  - id: update-store-compat
    content: 更新 useRecipeStore，支持新旧数据结构的读写
    status: pending
  - id: test-backward-compat
    content: 测试向后兼容性，确保旧数据正常显示和编辑
    status: pending
---

# 阶段1：核心数据结构重构

## 目标

将当前混杂的参数体系重构为三层清晰架构，采用**渐进式迁移**策略，确保：
- 现有功能不受影响
- 新数据可以逐步迁移
- 为后续阶段（调度、工厂配置）打下基础

## 核心设计理念

### 三层架构

1. **Equipment Configuration（设备配置层）**：预设的物理属性，不需要操作
2. **Operation Instructions（操作指令层）**：需要发送给设备执行的指令序列
3. **Material Specification（物料规格层）**：物料清单和用量

### 渐进式迁移策略

**不破坏现有结构**，通过扩展字段实现：

```typescript
// 旧结构保留（向后兼容）
interface SubStep {
  id: string;
  order: number;
  processType: ProcessType;
  label: string;
  deviceCode: string;        // 旧字段
  ingredients: string;       // 旧字段
  params: ProcessNodeData;  // 旧字段
}

// 新结构扩展（可选字段）
interface SubStep {
  // ... 旧字段保留 ...
  
  // 新增字段（可选，逐步迁移）
  equipmentV2?: EquipmentConfig;      // 设备配置（新）
  materialsV2?: MaterialSpec[];       // 物料清单（新）
  operationsV2?: Operation[];         // 操作序列（新）
  
  // 迁移标记
  _migrated?: boolean;               // 是否已迁移到新结构
}
```

## 实施步骤

### 步骤1：创建基础类型定义（2-3小时）

#### 1.1 创建 `src/types/equipment.ts`

```typescript
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
```

#### 1.2 创建 `src/types/material.ts`

```typescript
/**
 * 物料角色
 */
export enum MaterialRole {
  SOLVENT = 'SOLVENT',                     // 溶剂
  SOLUTE = 'SOLUTE',                       // 溶质
  ADDITIVE = 'ADDITIVE',                   // 添加剂
  INTERMEDIATE = 'INTERMEDIATE',           // 中间产物
  FINAL_PRODUCT = 'FINAL_PRODUCT'          // 最终产品
}

/**
 * 物料规格
 */
export interface MaterialSpec {
  id: string;                              // 物料ID（唯一）
  name: string;                            // 物料名称
  role: MaterialRole;                      // 物料角色
  specification?: string;                  // 规格（如"食品级"）
  amount?: QuantityValue;                  // 用量
  supplier?: string;                       // 供应商
  storageConditions?: string;              // 储存条件
}
```

#### 1.3 创建 `src/types/operation.ts`

```typescript
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
```

**验收标准**：
- [ ] 所有类型定义文件创建完成
- [ ] TypeScript 编译通过
- [ ] 类型导出正确

---

### 步骤2：扩展 SubStep 接口（1小时）

更新 `src/types/recipe.ts`：

```typescript
import { EquipmentConfig } from './equipment';
import { MaterialSpec } from './material';
import { Operation } from './operation';

/**
 * 子步骤定义（扩展版 - 向后兼容）
 */
export interface SubStep {
  // === 旧字段（保留，向后兼容） ===
  id: string;
  order: number;
  processType: ProcessType;
  label: string;
  deviceCode: string;            // 旧字段
  ingredients: string;           // 旧字段
  params: ProcessNodeData;       // 旧字段
  
  // === 新字段（可选，逐步迁移） ===
  equipmentV2?: EquipmentConfig;      // 设备配置（新结构）
  materialsV2?: MaterialSpec[];       // 物料清单（新结构）
  operationsV2?: Operation[];         // 操作序列（新结构）
  
  // === 迁移辅助字段 ===
  _migrated?: boolean;               // 是否已迁移到新结构
  _migrationSource?: string;          // 迁移来源（用于调试）
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
    return subStep.ingredients.split('、').map((name, idx) => ({
      id: `${subStep.id}-mat-${idx}`,
      name: name.trim(),
      role: MaterialRole.SOLUTE,  // 默认角色
    }));
  }
  return [];
}
```

**验收标准**：
- [ ] SubStep 接口扩展完成
- [ ] 向后兼容函数实现
- [ ] 现有代码编译通过

---

### 步骤3：创建操作模板系统（2-3小时）

创建 `src/services/operationTemplates.ts`：

```typescript
import { Operation, OperationType, OperationTemplate } from '@/types/operation';
import { MaterialSpec } from '@/types/material';
import { ProcessType } from '@/types/recipe';

/**
 * 操作模板配置
 */
export interface TemplateConfig {
  template: OperationTemplate;
  params: Record<string, any>;
}

/**
 * 从模板生成操作序列
 */
export function generateOperationsFromTemplate(
  template: OperationTemplate,
  config: TemplateConfig['params'],
  materials: MaterialSpec[]
): Operation[] {
  switch (template) {
    case OperationTemplate.DISSOLUTION_STANDARD:
      return generateDissolutionOperations(config, materials);
    case OperationTemplate.FILTRATION_AUTO:
      return generateFiltrationOperations(config);
    case OperationTemplate.TRANSFER_MATERIAL:
      return generateTransferMaterialOperations(config);
    case OperationTemplate.TRANSFER_WATER:
      return generateTransferWaterOperations(config);
    case OperationTemplate.COMPOUNDING_SEQUENTIAL:
      return generateCompoundingOperations(config, materials);
    default:
      return [];
  }
}

/**
 * 生成标准溶解操作序列
 */
function generateDissolutionOperations(
  config: {
    waterVolume: { value: number; unit: string };
    waterTemp?: { min?: number; max?: number; unit: string };
    stirringTime: { value: number; unit: string };
    stirringRate: 'high' | 'medium' | 'low';
  },
  materials: MaterialSpec[]
): Operation[] {
  const operations: Operation[] = [];
  let order = 1;
  
  // 1. 打水
  operations.push({
    id: `op-fill-water-${Date.now()}`,
    order: order++,
    type: OperationType.FILL_WATER,
    description: '打水',
    params: {
      volume: config.waterVolume,
      temperature: config.waterTemp,
    },
  });
  
  // 2. 开始搅拌
  operations.push({
    id: `op-start-stirring-${Date.now()}`,
    order: order++,
    type: OperationType.START_STIRRING,
    description: '启动搅拌',
    params: {
      speed: config.stirringRate,
    },
  });
  
  // 3. 投料（每个物料一个操作）
  materials.forEach((material) => {
    operations.push({
      id: `op-add-material-${material.id}`,
      order: order++,
      type: OperationType.ADD_MATERIAL,
      description: `投入${material.name}`,
      params: {
        materialRef: material.id,
        additionMethod: 'gradual',
      },
    });
  });
  
  // 4. 等待/计时
  operations.push({
    id: `op-wait-${Date.now()}`,
    order: order++,
    type: OperationType.WAIT,
    description: '维持搅拌以完成溶解',
    params: {
      duration: config.stirringTime,
      reason: '溶解反应',
    },
  });
  
  // 5. 停止搅拌
  operations.push({
    id: `op-stop-stirring-${Date.now()}`,
    order: order++,
    type: OperationType.STOP_STIRRING,
    description: '停止搅拌',
    params: {},
  });
  
  return operations;
}

// ... 其他模板生成函数 ...
```

**验收标准**：
- [ ] 操作模板系统实现
- [ ] 至少实现溶解、过滤、转移三个模板
- [ ] 模板生成的操作序列正确

---

### 步骤4：数据迁移工具（2-3小时）

创建 `src/utils/migration.ts`：

```typescript
import { SubStep, ProcessType } from '@/types/recipe';
import { EquipmentConfig, DeviceType } from '@/types/equipment';
import { MaterialSpec, MaterialRole } from '@/types/material';
import { Operation, OperationTemplate } from '@/types/operation';
import { generateOperationsFromTemplate } from '@/services/operationTemplates';

/**
 * 迁移单个 SubStep 到新结构
 */
export function migrateSubStepToV2(subStep: SubStep): SubStep {
  // 如果已迁移，直接返回
  if (subStep._migrated) {
    return subStep;
  }
  
  const migrated: SubStep = {
    ...subStep,
    _migrated: true,
    _migrationSource: 'auto-migration',
  };
  
  // 1. 迁移设备配置
  migrated.equipmentV2 = migrateEquipment(subStep);
  
  // 2. 迁移物料清单
  migrated.materialsV2 = migrateMaterials(subStep);
  
  // 3. 生成操作序列
  migrated.operationsV2 = generateOperations(subStep);
  
  return migrated;
}

/**
 * 迁移设备配置
 */
function migrateEquipment(subStep: SubStep): EquipmentConfig {
  const deviceType = inferDeviceType(subStep.deviceCode, subStep.processType);
  
  const config: EquipmentConfig = {
    deviceCode: subStep.deviceCode,
    deviceType,
  };
  
  // 如果是过滤，提取过滤精度
  if (subStep.processType === ProcessType.FILTRATION) {
    const precision = extractFiltrationPrecision(subStep);
    if (precision) {
      config.specifications = [
        {
          name: 'filterPrecision',
          value: precision.value,
          unit: precision.unit,
          description: '过滤精度',
        },
      ];
    }
  }
  
  return config;
}

/**
 * 迁移物料清单
 */
function migrateMaterials(subStep: SubStep): MaterialSpec[] {
  if (!subStep.ingredients || subStep.ingredients === '-') {
    return [];
  }
  
  // 解析 ingredients 字符串
  const materialNames = subStep.ingredients.split('、').map(s => s.trim());
  
  return materialNames.map((name, idx) => ({
    id: `${subStep.id}-mat-${idx}`,
    name,
    role: inferMaterialRole(name, subStep.processType),
  }));
}

/**
 * 生成操作序列
 */
function generateOperations(subStep: SubStep): Operation[] {
  // 根据 processType 选择模板
  const template = inferTemplate(subStep.processType);
  
  if (!template) {
    return [];  // 无法自动生成，需要手动定义
  }
  
  // 从 params 提取配置
  const config = extractTemplateConfig(subStep);
  const materials = migrateMaterials(subStep);
  
  return generateOperationsFromTemplate(template, config, materials);
}

// ... 辅助函数 ...
```

**验收标准**：
- [ ] 迁移工具实现
- [ ] 能够迁移所有类型的 SubStep
- [ ] 迁移后的数据验证通过

---

### 步骤5：渐进式数据迁移（2-3小时）

更新 `src/data/initialData.ts`：

```typescript
import { Process } from '@/types/recipe';
import { migrateSubStepToV2 } from '@/utils/migration';

/**
 * 初始工艺段数据（渐进式迁移）
 * 保留旧结构，新增新结构字段
 */
export const initialProcesses: Process[] = [
  {
    id: "P1",
    name: "糖醇、三氯蔗糖类溶解液",
    description: "糖醇和三氯蔗糖的溶解工艺",
    node: {
      id: "P1",
      type: "processNode",
      label: "糖醇、三氯蔗糖类溶解液",
      subSteps: [
        {
          id: "P1-substep-1",
          order: 1,
          processType: ProcessType.DISSOLUTION,
          label: "溶解",
          deviceCode: "高搅桶1",
          ingredients: "RO水、部分赤藓糖醇、三氯蔗糖类",
          params: {
            processType: ProcessType.DISSOLUTION,
            dissolutionParams: {
              waterVolume: { value: 1000, unit: 'L', condition: '>=' },
              waterTemp: { min: 65, max: 75, unit: '℃' },
              stirringTime: { value: 6, unit: 'min' },
              stirringRate: 'high',
              transferType: 'material'
            }
          },
          // 新增：新结构字段（手动定义或使用迁移工具）
          equipmentV2: {
            deviceCode: "高搅桶1",
            deviceType: DeviceType.HIGH_SPEED_MIXER,
            capacity: { value: 2000, unit: 'L' },
          },
          materialsV2: [
            { id: "P1-mat-1", name: "RO水", role: MaterialRole.SOLVENT },
            { id: "P1-mat-2", name: "赤藓糖醇", role: MaterialRole.SOLUTE },
            { id: "P1-mat-3", name: "三氯蔗糖", role: MaterialRole.SOLUTE },
          ],
          operationsV2: [
            // ... 操作序列 ...
          ],
          _migrated: true,
        },
        // ... 其他子步骤 ...
      ]
    }
  },
  // ... 其他工艺段 ...
];

/**
 * 自动迁移所有未迁移的数据（开发时使用）
 */
export function autoMigrateAllProcesses(): Process[] {
  return initialProcesses.map(process => ({
    ...process,
    node: {
      ...process.node,
      subSteps: process.node.subSteps.map(migrateSubStepToV2),
    },
  }));
}
```

**验收标准**：
- [ ] 至少迁移 P1 工艺段到新结构
- [ ] 旧字段保留，新字段填充
- [ ] 数据验证通过

---

### 步骤6：更新 UI 组件（3-4小时）

#### 6.1 更新 `src/components/editor/ParamsModal.tsx`

```typescript
// 优先使用新结构，回退到旧结构
const equipment = getEquipmentConfig(subStep);
const materials = getMaterials(subStep);
const operations = subStep.operationsV2 || [];

// UI 展示新结构，编辑时兼容旧结构
```

#### 6.2 更新 `src/components/editor/RecipeTable.tsx`

```typescript
// 展示时优先显示新结构
const displayEquipment = subStep.equipmentV2 
  ? `${subStep.equipmentV2.deviceCode} (${subStep.equipmentV2.deviceType})`
  : subStep.deviceCode;  // 回退到旧字段

const displayMaterials = subStep.materialsV2?.length 
  ? subStep.materialsV2.map(m => m.name).join('、')
  : subStep.ingredients;  // 回退到旧字段
```

**验收标准**：
- [ ] UI 能正确显示新结构数据
- [ ] 旧数据正常显示（回退机制）
- [ ] 编辑功能兼容新旧结构

---

### 步骤7：更新状态管理（2小时）

更新 `src/store/useRecipeStore.ts`：

```typescript
// 读取时：优先使用新结构
function getSubStep(processId: string, subStepId: string): SubStep {
  const subStep = findSubStep(processId, subStepId);
  // 如果未迁移，自动迁移
  if (!subStep._migrated) {
    return migrateSubStepToV2(subStep);
  }
  return subStep;
}

// 保存时：同时保存新旧字段（过渡期）
function updateSubStep(processId: string, subStepId: string, updates: Partial<SubStep>) {
  // 更新新结构
  // 同时同步更新旧字段（保持兼容）
}
```

**验收标准**：
- [ ] 状态管理支持新旧结构
- [ ] 自动迁移机制工作正常
- [ ] 保存功能正常

---

### 步骤8：测试和验证（2小时）

**测试清单**：

1. **向后兼容测试**
   - [ ] 旧数据正常加载和显示
   - [ ] 旧数据可以编辑
   - [ ] 编辑后保存正常

2. **新结构测试**
   - [ ] 新结构数据正确显示
   - [ ] 新结构数据可以编辑
   - [ ] 操作序列生成正确

3. **迁移测试**
   - [ ] 自动迁移工具工作正常
   - [ ] 迁移后数据完整性验证
   - [ ] 迁移后功能正常

4. **集成测试**
   - [ ] 流程图正常显示
   - [ ] 表格正常显示
   - [ ] 协同编辑功能正常

---

## 验收标准总结

### 功能验收

- [ ] 所有类型定义完成，TypeScript 编译通过
- [ ] SubStep 接口扩展完成，向后兼容
- [ ] 操作模板系统实现，至少支持溶解、过滤、转移
- [ ] 数据迁移工具实现，能够迁移所有类型
- [ ] 至少 P1 工艺段迁移到新结构
- [ ] UI 组件支持新旧结构显示和编辑
- [ ] 状态管理支持新旧结构读写
- [ ] 所有测试通过

### 质量验收

- [ ] 代码无 TypeScript 错误
- [ ] 代码无 ESLint 警告
- [ ] 向后兼容性验证通过
- [ ] 性能无明显下降

---

## 预期成果

完成阶段1后：

1. **数据结构清晰**：设备配置、物料清单、操作序列三层分离
2. **向后兼容**：现有功能完全正常，旧数据可正常使用
3. **渐进迁移**：可以逐步将数据迁移到新结构
4. **MES 友好**：新结构可以直接映射到 MES 系统
5. **为阶段2打基础**：设备调度功能可以基于新结构实现

---

## 注意事项

1. **不要删除旧字段**：保持向后兼容
2. **迁移是渐进的**：不需要一次性迁移所有数据
3. **优先保证稳定性**：新功能不能影响现有功能
4. **做好测试**：每个步骤都要充分测试
