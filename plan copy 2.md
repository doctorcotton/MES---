---
name: 阶段3-工厂产线配置
overview: 实现多工厂、多产线的设备配置管理。支持不同工厂、不同产线有不同的实际物理设备配置（如天津厂一线有3个高搅桶，上海厂二线有离心机等）。这是拓展功能，为生产执行系统集成做准备。
todos:
  - id: create-factory-types
    content: 创建工厂产线配置相关类型定义
    status: pending
  - id: create-factory-config-service
    content: 创建工厂配置管理服务
    status: pending
  - id: create-factory-config-ui
    content: 创建工厂配置管理界面
    status: pending
  - id: implement-config-inheritance
    content: 实现配置继承和覆盖机制（配方层 -> 工厂层）
    status: pending
  - id: update-scheduler-factory
    content: 更新调度器，支持工厂产线配置
    status: pending
  - id: update-gantt-factory
    content: 更新甘特图，支持切换不同工厂产线视图
    status: pending
  - id: create-device-mapping
    content: 创建设备映射机制（配方设备 -> 实际设备）
    status: pending
  - id: test-factory-config
    content: 测试工厂配置功能
    status: pending
---

# 阶段3：工厂产线配置

## 目标

实现多工厂、多产线的设备配置管理，支持：
1. **工厂产线配置**：不同工厂、不同产线有不同的实际物理设备
2. **配置继承**：配方层配置 -> 工厂层配置的映射
3. **设备映射**：配方设计时的设备 -> 实际生产设备的映射
4. **调度适配**：调度器能够基于不同工厂产线配置进行调度

## 前置条件

- [x] 阶段1已完成（核心数据结构）
- [x] 阶段2已完成（设备调度和甘特图）
- [x] 调度器服务可用

## 核心设计

### 配置层级

```
配方层（研发视图）
  ↓ 使用通用设备配置
[高搅桶1, 高搅桶2, 调配桶]
  ↓ 下发到生产
工厂层（生产视图）
  ↓ 映射到实际设备
天津厂-一线: [TJ-L1-高搅桶1, TJ-L1-高搅桶2, TJ-L1-高搅桶3(备用), TJ-L1-调配桶]
上海厂-二线: [SH-L2-高搅桶A, SH-L2-高搅桶B, SH-L2-离心机, SH-L2-调配桶]
```

### 设备使用模式

```typescript
enum DeviceUsageMode {
  PRIMARY = 'PRIMARY',     // 默认使用
  BACKUP = 'BACKUP',       // 备用（特殊情况才启用）
  DISABLED = 'DISABLED'    // 禁用
}
```

## 实施步骤

### 步骤1：创建工厂产线配置类型（1-2小时）

更新 `src/types/scheduling.ts`：

```typescript
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
  PRIMARY = 'PRIMARY',                     // 默认使用
  BACKUP = 'BACKUP',                       // 备用（特殊情况才启用）
  DISABLED = 'DISABLED'                    // 禁用
}

/**
 * 设备资源定义（扩展版 - 支持使用模式）
 */
export interface DeviceResource {
  deviceCode: string;
  deviceType: DeviceType;
  displayName: string;
  capacity?: QuantityValue;
  specifications?: EquipmentSpec[];
  
  // 新增：使用模式（工厂配置层使用）
  usageMode?: DeviceUsageMode;             // 使用模式：默认/备用/禁用
  
  // 状态信息（运行时）
  currentState?: DeviceState;
  currentStepId?: string;
  stateChangedAt?: Date;
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
  deviceMapping?: Map<string, string>;     // 配方设备编号 -> 实际设备编号
  
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
```

**验收标准**：
- [ ] 所有工厂配置类型定义完成
- [ ] TypeScript 编译通过

---

### 步骤2：创建工厂配置管理服务（2-3小时）

创建 `src/services/factoryConfigService.ts`：

```typescript
import { ProductionLineConfig, FactoryConfig, DeviceConfigContext, ConfigurationLevel, DeviceResource, DeviceUsageMode } from '@/types/scheduling';
import { defaultDevicePool } from '@/data/devicePool';

/**
 * 工厂配置管理服务
 */
export class FactoryConfigService {
  private factories: Map<string, FactoryConfig> = new Map();
  
  /**
   * 初始化默认配置
   */
  initialize() {
    // 创建示例配置：天津厂一线
    const tianjinLine1: ProductionLineConfig = {
      id: "tianjin-line1",
      factoryName: "天津厂",
      lineName: "一线",
      devicePool: [
        {
          deviceCode: "TJ-L1-高搅桶1",
          deviceType: DeviceType.HIGH_SPEED_MIXER,
          displayName: "天津一线-高搅桶#1",
          capacity: { value: 2000, unit: 'L' },
          usageMode: DeviceUsageMode.PRIMARY,
          currentState: DeviceState.IDLE,
        },
        {
          deviceCode: "TJ-L1-高搅桶2",
          deviceType: DeviceType.HIGH_SPEED_MIXER,
          displayName: "天津一线-高搅桶#2",
          capacity: { value: 2000, unit: 'L' },
          usageMode: DeviceUsageMode.PRIMARY,
          currentState: DeviceState.IDLE,
        },
        {
          deviceCode: "TJ-L1-高搅桶3",
          deviceType: DeviceType.HIGH_SPEED_MIXER,
          displayName: "天津一线-高搅桶#3（备用）",
          capacity: { value: 2000, unit: 'L' },
          usageMode: DeviceUsageMode.BACKUP,  // 备用设备
          currentState: DeviceState.IDLE,
        },
        {
          deviceCode: "TJ-L1-调配桶",
          deviceType: DeviceType.MIXING_TANK,
          displayName: "天津一线-调配桶",
          capacity: { value: 5000, unit: 'L' },
          usageMode: DeviceUsageMode.PRIMARY,
          currentState: DeviceState.IDLE,
        },
      ],
      missingDeviceTypes: [],  // 天津厂一线没有离心机，但这里不标记（因为配方中也没有）
      deviceMapping: new Map([
        ["高搅桶1", "TJ-L1-高搅桶1"],
        ["高搅桶2", "TJ-L1-高搅桶2"],
        ["调配桶", "TJ-L1-调配桶"],
      ]),
      description: "天津工厂一号生产线，配备3个高搅桶（2个常用+1个备用），无离心机",
      enabled: true,
    };
    
    const tianjinFactory: FactoryConfig = {
      id: "tianjin",
      name: "天津厂",
      location: "天津市",
      productionLines: [tianjinLine1],
      enabled: true,
    };
    
    this.factories.set("tianjin", tianjinFactory);
  }
  
  /**
   * 获取所有工厂
   */
  getAllFactories(): FactoryConfig[] {
    return Array.from(this.factories.values());
  }
  
  /**
   * 获取工厂
   */
  getFactory(factoryId: string): FactoryConfig | undefined {
    return this.factories.get(factoryId);
  }
  
  /**
   * 获取产线配置
   */
  getProductionLine(lineId: string): ProductionLineConfig | undefined {
    for (const factory of this.factories.values()) {
      const line = factory.productionLines.find(l => l.id === lineId);
      if (line) return line;
    }
    return undefined;
  }
  
  /**
   * 创建设备配置上下文
   */
  createDeviceContext(
    level: ConfigurationLevel,
    lineId?: string
  ): DeviceConfigContext {
    if (level === ConfigurationLevel.RECIPE) {
      // 研发视图：使用配方层配置
      return {
        level: ConfigurationLevel.RECIPE,
        recipeDevicePool: defaultDevicePool,
        activeDevicePool: defaultDevicePool,
      };
    }
    
    if (level === ConfigurationLevel.PRODUCTION_LINE && lineId) {
      // 生产视图：使用产线配置
      const lineConfig = this.getProductionLine(lineId);
      if (!lineConfig) {
        throw new Error(`产线配置不存在: ${lineId}`);
      }
      
      return {
        level: ConfigurationLevel.PRODUCTION_LINE,
        recipeDevicePool: defaultDevicePool,
        productionLineConfig: lineConfig,
        activeDevicePool: lineConfig.devicePool.filter(
          d => d.usageMode !== DeviceUsageMode.DISABLED
        ),
      };
    }
    
    throw new Error(`无效的配置层级: ${level}`);
  }
  
  /**
   * 映射设备编号（配方设备 -> 实际设备）
   */
  mapDeviceCode(
    recipeDeviceCode: string,
    lineId: string
  ): string | undefined {
    const lineConfig = this.getProductionLine(lineId);
    if (!lineConfig || !lineConfig.deviceMapping) {
      return recipeDeviceCode;  // 无映射，返回原值
    }
    
    return lineConfig.deviceMapping.get(recipeDeviceCode) || recipeDeviceCode;
  }
  
  /**
   * 检查产线是否支持设备类型
   */
  supportsDeviceType(
    lineId: string,
    deviceType: DeviceType
  ): boolean {
    const lineConfig = this.getProductionLine(lineId);
    if (!lineConfig) return false;
    
    // 检查是否缺少该设备类型
    if (lineConfig.missingDeviceTypes?.includes(deviceType)) {
      return false;
    }
    
    // 检查是否有该类型的设备
    return lineConfig.devicePool.some(
      d => d.deviceType === deviceType && d.usageMode !== DeviceUsageMode.DISABLED
    );
  }
}
```

**验收标准**：
- [ ] 工厂配置管理服务实现完成
- [ ] 能够创建和管理工厂产线配置
- [ ] 设备映射功能正常

---

### 步骤3：创建工厂配置管理界面（3-4小时）

创建 `src/components/factory/FactoryConfigManager.tsx`：

```typescript
import React, { useState } from 'react';
import { FactoryConfig, ProductionLineConfig } from '@/types/scheduling';
import { FactoryConfigService } from '@/services/factoryConfigService';

export function FactoryConfigManager() {
  const [factories, setFactories] = useState<FactoryConfig[]>([]);
  const [selectedFactory, setSelectedFactory] = useState<string | null>(null);
  const [selectedLine, setSelectedLine] = useState<string | null>(null);
  
  const service = new FactoryConfigService();
  
  React.useEffect(() => {
    service.initialize();
    setFactories(service.getAllFactories());
  }, []);
  
  return (
    <div className="factory-config-manager h-full flex">
      {/* 左侧：工厂列表 */}
      <div className="w-64 border-r p-4">
        <h2 className="font-bold mb-4">工厂列表</h2>
        <div className="space-y-2">
          {factories.map(factory => (
            <div
              key={factory.id}
              className={`p-2 rounded cursor-pointer ${
                selectedFactory === factory.id ? 'bg-blue-100' : 'hover:bg-gray-100'
              }`}
              onClick={() => setSelectedFactory(factory.id)}
            >
              <div className="font-semibold">{factory.name}</div>
              <div className="text-sm text-gray-500">
                {factory.productionLines.length} 条产线
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* 中间：产线列表 */}
      {selectedFactory && (
        <div className="w-64 border-r p-4">
          <h2 className="font-bold mb-4">产线列表</h2>
          <div className="space-y-2">
            {factories
              .find(f => f.id === selectedFactory)
              ?.productionLines.map(line => (
                <div
                  key={line.id}
                  className={`p-2 rounded cursor-pointer ${
                    selectedLine === line.id ? 'bg-blue-100' : 'hover:bg-gray-100'
                  }`}
                  onClick={() => setSelectedLine(line.id)}
                >
                  <div className="font-semibold">{line.lineName}</div>
                  <div className="text-sm text-gray-500">
                    {line.devicePool.length} 台设备
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
      
      {/* 右侧：产线配置详情 */}
      {selectedLine && (
        <ProductionLineConfigEditor
          lineId={selectedLine}
          onUpdate={() => {
            setFactories(service.getAllFactories());
          }}
        />
      )}
    </div>
  );
}

function ProductionLineConfigEditor({
  lineId,
  onUpdate,
}: {
  lineId: string;
  onUpdate: () => void;
}) {
  const service = new FactoryConfigService();
  const lineConfig = service.getProductionLine(lineId);
  
  if (!lineConfig) {
    return <div>产线配置不存在</div>;
  }
  
  return (
    <div className="flex-1 p-4">
      <h2 className="font-bold mb-4">
        {lineConfig.factoryName} - {lineConfig.lineName}
      </h2>
      
      {/* 设备列表 */}
      <div className="mb-4">
        <h3 className="font-semibold mb-2">设备列表</h3>
        <div className="space-y-2">
          {lineConfig.devicePool.map(device => (
            <div key={device.deviceCode} className="p-2 border rounded">
              <div className="flex items-center justify-between">
                <span>{device.displayName}</span>
                <span className={`text-xs px-2 py-1 rounded ${
                  device.usageMode === DeviceUsageMode.PRIMARY
                    ? 'bg-green-100 text-green-800'
                    : device.usageMode === DeviceUsageMode.BACKUP
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {device.usageMode || 'PRIMARY'}
                </span>
              </div>
              <div className="text-sm text-gray-500">
                {device.deviceType} | {device.capacity?.value}{device.capacity?.unit}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* 设备映射 */}
      <div className="mb-4">
        <h3 className="font-semibold mb-2">设备映射</h3>
        <div className="space-y-1 text-sm">
          {Array.from(lineConfig.deviceMapping?.entries() || []).map(([recipe, actual]) => (
            <div key={recipe} className="flex items-center gap-2">
              <span className="text-gray-600">{recipe}</span>
              <span>→</span>
              <span className="font-semibold">{actual}</span>
            </div>
          ))}
        </div>
      </div>
      
      {/* 缺少的设备 */}
      {lineConfig.missingDeviceTypes && lineConfig.missingDeviceTypes.length > 0 && (
        <div className="mb-4">
          <h3 className="font-semibold mb-2 text-red-600">缺少的设备类型</h3>
          <div className="text-sm text-red-600">
            {lineConfig.missingDeviceTypes.join(', ')}
          </div>
        </div>
      )}
    </div>
  );
}
```

**验收标准**：
- [ ] 工厂配置管理界面实现完成
- [ ] 能够查看和编辑工厂产线配置
- [ ] 设备映射显示正确

---

### 步骤4：实现配置继承机制（2-3小时）

创建 `src/services/configInheritance.ts`：

```typescript
import { DeviceConfigContext, ConfigurationLevel } from '@/types/scheduling';
import { SubStep } from '@/types/recipe';
import { FactoryConfigService } from './factoryConfigService';

/**
 * 配置继承服务
 * 处理配方层配置到工厂层配置的映射
 */
export class ConfigInheritanceService {
  private factoryService: FactoryConfigService;
  
  constructor(factoryService: FactoryConfigService) {
    this.factoryService = factoryService;
  }
  
  /**
   * 将配方层步骤转换为生产层步骤
   */
  adaptStepForProduction(
    recipeStep: SubStep,
    lineId: string
  ): SubStep {
    const context = this.factoryService.createDeviceContext(
      ConfigurationLevel.PRODUCTION_LINE,
      lineId
    );
    
    // 映射设备编号
    if (recipeStep.deviceRequirement?.deviceCode) {
      const mappedDeviceCode = this.factoryService.mapDeviceCode(
        recipeStep.deviceRequirement.deviceCode,
        lineId
      );
      
      return {
        ...recipeStep,
        deviceRequirement: {
          ...recipeStep.deviceRequirement,
          deviceCode: mappedDeviceCode,
        },
      };
    }
    
    // 如果只指定了设备类型，检查产线是否支持
    if (recipeStep.deviceRequirement?.deviceType) {
      const supported = this.factoryService.supportsDeviceType(
        lineId,
        recipeStep.deviceRequirement.deviceType
      );
      
      if (!supported) {
        throw new Error(
          `产线 ${lineId} 不支持设备类型 ${recipeStep.deviceRequirement.deviceType}`
        );
      }
    }
    
    return recipeStep;
  }
  
  /**
   * 验证配方是否适用于产线
   */
  validateRecipeForProductionLine(
    processes: Process[],
    lineId: string
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    processes.forEach(process => {
      process.node.subSteps.forEach(step => {
        if (step.deviceRequirement?.deviceType) {
          const supported = this.factoryService.supportsDeviceType(
            lineId,
            step.deviceRequirement.deviceType
          );
          
          if (!supported) {
            errors.push(
              `步骤 ${step.label} 需要设备类型 ${step.deviceRequirement.deviceType}，但产线 ${lineId} 不支持`
            );
          }
        }
      });
    });
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
```

**验收标准**：
- [ ] 配置继承机制实现完成
- [ ] 设备映射功能正常
- [ ] 配方适用性验证功能正常

---

### 步骤5：更新调度器支持工厂配置（2-3小时）

更新 `src/services/scheduler.ts`：

```typescript
import { DeviceConfigContext } from '@/types/scheduling';

/**
 * 计算设备占用时间线（支持工厂配置）
 */
export function calculateScheduleWithContext(
  processes: Process[],
  context: DeviceConfigContext
): ScheduleResult {
  // 使用 context.activeDevicePool 而不是 defaultDevicePool
  return calculateSchedule(processes, context.activeDevicePool);
}
```

**验收标准**：
- [ ] 调度器支持工厂配置
- [ ] 能够基于不同产线配置进行调度

---

### 步骤6：更新甘特图支持切换视图（2小时）

更新 `src/components/scheduling/GanttView.tsx`：

```typescript
// 增加视图切换
const [viewMode, setViewMode] = useState<'recipe' | 'production'>('recipe');
const [selectedLineId, setSelectedLineId] = useState<string | null>(null);

// 根据视图模式选择设备池
const context = useMemo(() => {
  if (viewMode === 'recipe') {
    return factoryService.createDeviceContext(ConfigurationLevel.RECIPE);
  } else {
    return factoryService.createDeviceContext(
      ConfigurationLevel.PRODUCTION_LINE,
      selectedLineId || undefined
    );
  }
}, [viewMode, selectedLineId]);

const scheduleResult = useMemo(() => {
  return calculateScheduleWithContext(processes, context);
}, [processes, context]);
```

**验收标准**：
- [ ] 甘特图支持切换研发视图/生产视图
- [ ] 能够选择不同产线查看调度结果

---

### 步骤7：测试和验证（2小时）

**测试清单**：

1. **工厂配置测试**
   - [ ] 工厂产线配置创建正常
   - [ ] 设备映射功能正常
   - [ ] 设备使用模式设置正常

2. **配置继承测试**
   - [ ] 配方到生产的映射正确
   - [ ] 设备类型支持检查正确
   - [ ] 配方适用性验证正确

3. **调度适配测试**
   - [ ] 基于不同产线配置的调度正确
   - [ ] 备用设备处理正确
   - [ ] 缺少设备类型的处理正确

---

## 验收标准总结

### 功能验收

- [ ] 工厂产线配置类型定义完成
- [ ] 工厂配置管理服务实现完成
- [ ] 工厂配置管理界面实现完成
- [ ] 配置继承机制实现完成
- [ ] 调度器支持工厂配置
- [ ] 甘特图支持切换视图
- [ ] 所有测试通过

### 质量验收

- [ ] 代码无 TypeScript 错误
- [ ] 代码无 ESLint 警告
- [ ] 配置继承正确性验证
- [ ] 性能满足要求

---

## 预期成果

完成阶段3后：

1. **多工厂支持**：能够管理多个工厂的配置
2. **多产线支持**：每个工厂可以有多个产线
3. **设备映射**：配方设备到实际设备的映射
4. **生产适配**：配方可以适配到不同产线
5. **为MES集成准备**：数据结构支持生产执行系统

---

## 注意事项

1. **这是拓展功能**：不影响阶段1和阶段2的核心功能
2. **数据持久化**：工厂配置需要保存到数据库（当前可能只是内存）
3. **权限管理**：工厂配置管理可能需要权限控制
4. **向后兼容**：研发视图的默认配置（2个高搅桶）保持不变

---

## 后续扩展

1. **数据库集成**：将工厂配置保存到数据库
2. **权限管理**：不同用户只能管理特定工厂
3. **设备状态同步**：与MES系统同步实际设备状态
4. **生产执行集成**：将调度结果下发到MES系统执行
