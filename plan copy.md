---
name: 阶段2-设备调度和甘特图
overview: 基于阶段1的新数据结构，实现设备状态管理、并行调度算法和甘特图可视化。帮助研发人员理解设备占用关系，优化工艺并行度，缩短生产周期。
todos:
  - id: create-scheduling-types
    content: 创建调度相关类型定义：scheduling.ts
    status: pending
  - id: create-device-pool
    content: 创建设备资源池配置（研发视图默认：2个高搅桶）
    status: pending
  - id: create-scheduler-service
    content: 创建调度器服务，实现设备占用计算和冲突检测
    status: pending
  - id: create-gantt-view
    content: 新建 GanttView 组件，展示设备占用时间线
    status: pending
  - id: create-device-status-panel
    content: 新建 DeviceStatusPanel 组件，显示设备状态
    status: pending
  - id: extend-substep-scheduling
    content: 扩展 SubStep，增加设备需求和并行关系字段
    status: pending
  - id: update-recipe-table-scheduling
    content: 更新 RecipeTable，增加设备需求和并行关系列
    status: pending
  - id: update-params-modal-scheduling
    content: 更新 ParamsModal，增加调度设置Tab
    status: pending
  - id: update-store-scheduling
    content: 更新 useRecipeStore，集成调度计算
    status: pending
  - id: update-graph-nodes-scheduling
    content: 更新 CustomNode，显示设备状态和并行关系
    status: pending
  - id: test-scheduling
    content: 测试调度算法和甘特图功能
    status: pending
---

# 阶段2：设备调度和甘特图

## 目标

基于阶段1的新数据结构，实现：
1. **设备状态管理**：追踪关键设备的使用状态
2. **并行调度算法**：识别可并行步骤，优化生产周期
3. **甘特图可视化**：直观展示设备占用时间线
4. **研发视图优化**：帮助研发人员理解设备占用关系

## 前置条件

- [x] 阶段1已完成
- [x] SubStep 已支持 equipmentV2、materialsV2、operationsV2
- [x] 数据迁移工具可用

## 核心设计

### 设备资源池（研发视图）

```typescript
// 研发视图默认配置：2个高搅桶
const defaultDevicePool: DeviceResource[] = [
  {
    deviceCode: "高搅桶1",
    deviceType: DeviceType.HIGH_SPEED_MIXER,
    displayName: "高速搅拌桶#1",
    capacity: { value: 2000, unit: 'L' },
    currentState: DeviceState.IDLE
  },
  {
    deviceCode: "高搅桶2",
    deviceType: DeviceType.HIGH_SPEED_MIXER,
    displayName: "高速搅拌桶#2",
    capacity: { value: 2000, unit: 'L' },
    currentState: DeviceState.IDLE
  },
  {
    deviceCode: "调配桶",
    deviceType: DeviceType.MIXING_TANK,
    displayName: "主调配桶",
    capacity: { value: 5000, unit: 'L' },
    currentState: DeviceState.IDLE
  }
];
```

### 设备需求定义

```typescript
// 在 SubStep 中增加设备需求字段
interface SubStep {
  // ... 阶段1的字段 ...
  
  // 新增：设备调度相关
  deviceRequirement?: DeviceRequirement;    // 设备资源需求
  canParallelWith?: string[];              // 可以并行的步骤ID列表
  mustAfter?: string[];                     // 必须在某些步骤之后执行
}
```

## 实施步骤

### 步骤1：创建调度类型定义（1-2小时）

创建 `src/types/scheduling.ts`：

```typescript
import { DeviceType, EquipmentSpec } from './equipment';
import { TimeValue } from './operation';

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
```

**验收标准**：
- [ ] 所有调度类型定义完成
- [ ] TypeScript 编译通过

---

### 步骤2：创建设备资源池配置（1小时）

创建 `src/data/devicePool.ts`：

```typescript
import { DeviceResource, DeviceState } from '@/types/scheduling';
import { DeviceType } from '@/types/equipment';

/**
 * 研发视图默认设备资源池
 * 默认配置：2个高搅桶、1个调配桶
 */
export const defaultDevicePool: DeviceResource[] = [
  {
    deviceCode: "高搅桶1",
    deviceType: DeviceType.HIGH_SPEED_MIXER,
    displayName: "高速搅拌桶#1",
    capacity: { value: 2000, unit: 'L' },
    currentState: DeviceState.IDLE,
  },
  {
    deviceCode: "高搅桶2",
    deviceType: DeviceType.HIGH_SPEED_MIXER,
    displayName: "高速搅拌桶#2",
    capacity: { value: 2000, unit: 'L' },
    currentState: DeviceState.IDLE,
  },
  {
    deviceCode: "调配桶",
    deviceType: DeviceType.MIXING_TANK,
    displayName: "主调配桶",
    capacity: { value: 5000, unit: 'L' },
    currentState: DeviceState.IDLE,
  },
  {
    deviceCode: "管道过滤器1",
    deviceType: DeviceType.FILTER,
    displayName: "管道过滤器#1",
    specifications: [
      { name: "filterPrecision", value: 0.5, unit: "μm" },
    ],
    currentState: DeviceState.IDLE,
  },
  {
    deviceCode: "UHT机",
    deviceType: DeviceType.UHT_MACHINE,
    displayName: "UHT灭菌机",
    currentState: DeviceState.IDLE,
  },
  {
    deviceCode: "灌装机",
    deviceType: DeviceType.FILLING_MACHINE,
    displayName: "无菌灌装机",
    currentState: DeviceState.IDLE,
  },
];

/**
 * 根据设备类型查找设备
 */
export function findDevicesByType(
  devicePool: DeviceResource[],
  deviceType: DeviceType
): DeviceResource[] {
  return devicePool.filter(device => device.deviceType === deviceType);
}

/**
 * 根据设备编号查找设备
 */
export function findDeviceByCode(
  devicePool: DeviceResource[],
  deviceCode: string
): DeviceResource | undefined {
  return devicePool.find(device => device.deviceCode === deviceCode);
}
```

**验收标准**：
- [ ] 设备资源池配置完成
- [ ] 包含研发视图所需的所有设备

---

### 步骤3：创建调度器服务（3-4小时）

创建 `src/services/scheduler.ts`：

```typescript
import { SubStep, Process } from '@/types/recipe';
import { DeviceResource, DeviceRequirement, DeviceOccupancy, ScheduleResult, ScheduleWarning, DeviceState } from '@/types/scheduling';
import { DeviceType } from '@/types/equipment';
import { defaultDevicePool, findDevicesByType, findDeviceByCode } from '@/data/devicePool';

/**
 * 计算设备占用时间线
 */
export function calculateSchedule(
  processes: Process[],
  devicePool: DeviceResource[] = defaultDevicePool
): ScheduleResult {
  const timeline: DeviceOccupancy[] = [];
  const warnings: ScheduleWarning[] = [];
  const deviceStates = new Map<string, DeviceState>();
  
  // 收集所有步骤
  const allSteps: Array<{ step: SubStep; processId: string }> = [];
  processes.forEach(process => {
    process.node.subSteps.forEach(step => {
      allSteps.push({ step, processId: process.id });
    });
  });
  
  // 按顺序处理步骤
  const processedSteps = new Set<string>();
  const stepStartTimes = new Map<string, number>();
  
  // 第一遍：处理没有依赖的步骤
  allSteps.forEach(({ step, processId }) => {
    if (!step.mustAfter || step.mustAfter.length === 0) {
      scheduleStep(step, processId, 0, timeline, devicePool, stepStartTimes, processedSteps, warnings);
    }
  });
  
  // 第二遍：处理有依赖的步骤
  let changed = true;
  while (changed) {
    changed = false;
    allSteps.forEach(({ step, processId }) => {
      if (!processedSteps.has(step.id)) {
        const dependenciesMet = checkDependencies(step.mustAfter || [], processedSteps);
        if (dependenciesMet) {
          const startTime = calculateStartTime(step.mustAfter || [], stepStartTimes, timeline);
          scheduleStep(step, processId, startTime, timeline, devicePool, stepStartTimes, processedSteps, warnings);
          changed = true;
        }
      }
    });
  }
  
  // 计算总耗时
  const totalDuration = Math.max(...Array.from(stepStartTimes.values()).map(startTime => {
    const step = allSteps.find(({ step }) => stepStartTimes.get(step.id) === startTime)?.step;
    if (!step) return 0;
    const duration = step.deviceRequirement?.occupyDuration?.value || 
                     step.estimatedDuration?.value || 
                     10; // 默认10分钟
    return startTime + duration;
  }), 0);
  
  // 计算关键路径（简化版：最长路径）
  const criticalPath = findCriticalPath(allSteps, stepStartTimes);
  
  return {
    timeline,
    deviceStates,
    totalDuration,
    criticalPath,
    warnings,
  };
}

/**
 * 调度单个步骤
 */
function scheduleStep(
  step: SubStep,
  processId: string,
  earliestStartTime: number,
  timeline: DeviceOccupancy[],
  devicePool: DeviceResource[],
  stepStartTimes: Map<string, number>,
  processedSteps: Set<string>,
  warnings: ScheduleWarning[]
) {
  if (!step.deviceRequirement) {
    // 没有设备需求，跳过
    processedSteps.add(step.id);
    return;
  }
  
  // 分配设备
  const device = allocateDevice(step.deviceRequirement, devicePool, earliestStartTime, timeline);
  
  if (!device) {
    warnings.push({
      type: 'DEVICE_CONFLICT',
      severity: 'error',
      message: `步骤 ${step.label} 无法分配设备`,
      relatedStepIds: [step.id],
    });
    return;
  }
  
  // 检查设备是否在 earliestStartTime 可用
  const deviceAvailableTime = getDeviceAvailableTime(device.deviceCode, earliestStartTime, timeline);
  const actualStartTime = Math.max(earliestStartTime, deviceAvailableTime);
  
  // 计算持续时间
  const duration = step.deviceRequirement.occupyDuration?.value || 
                   step.estimatedDuration?.value || 
                   10; // 默认10分钟
  
  // 创建占用记录
  const occupancy: DeviceOccupancy = {
    deviceCode: device.deviceCode,
    stepId: step.id,
    stepLabel: step.label,
    processId,
    startTime: actualStartTime,
    duration,
    endTime: actualStartTime + duration,
    dependencies: step.mustAfter,
    state: 'planned',
  };
  
  timeline.push(occupancy);
  stepStartTimes.set(step.id, actualStartTime);
  processedSteps.add(step.id);
}

/**
 * 分配设备
 */
function allocateDevice(
  requirement: DeviceRequirement,
  devicePool: DeviceResource[],
  startTime: number,
  timeline: DeviceOccupancy[]
): DeviceResource | null {
  // 如果指定了具体设备编号
  if (requirement.deviceCode) {
    const device = findDeviceByCode(devicePool, requirement.deviceCode);
    if (device && isDeviceAvailable(device.deviceCode, startTime, timeline)) {
      return device;
    }
    return null;
  }
  
  // 如果只指定了设备类型，查找可用设备
  if (requirement.deviceType) {
    const candidates = findDevicesByType(devicePool, requirement.deviceType);
    for (const device of candidates) {
      if (isDeviceAvailable(device.deviceCode, startTime, timeline)) {
        return device;
      }
    }
  }
  
  return null;
}

/**
 * 检查设备是否可用
 */
function isDeviceAvailable(
  deviceCode: string,
  startTime: number,
  timeline: DeviceOccupancy[]
): boolean {
  // 检查是否有时间冲突
  for (const occupancy of timeline) {
    if (occupancy.deviceCode === deviceCode) {
      // 检查时间是否重叠
      if (startTime < occupancy.endTime && startTime + 10 > occupancy.startTime) {
        return false;
      }
    }
  }
  return true;
}

/**
 * 获取设备可用时间
 */
function getDeviceAvailableTime(
  deviceCode: string,
  earliestTime: number,
  timeline: DeviceOccupancy[]
): number {
  const occupancies = timeline
    .filter(o => o.deviceCode === deviceCode)
    .filter(o => o.endTime > earliestTime)
    .sort((a, b) => a.endTime - b.endTime);
  
  if (occupancies.length === 0) {
    return earliestTime;
  }
  
  return Math.max(earliestTime, occupancies[occupancies.length - 1].endTime);
}

/**
 * 检查依赖是否满足
 */
function checkDependencies(
  dependencies: string[],
  processedSteps: Set<string>
): boolean {
  return dependencies.every(depId => processedSteps.has(depId));
}

/**
 * 计算开始时间（基于依赖）
 */
function calculateStartTime(
  dependencies: string[],
  stepStartTimes: Map<string, number>,
  timeline: DeviceOccupancy[]
): number {
  if (dependencies.length === 0) {
    return 0;
  }
  
  let maxEndTime = 0;
  for (const depId of dependencies) {
    const startTime = stepStartTimes.get(depId) || 0;
    const occupancy = timeline.find(o => o.stepId === depId);
    const endTime = occupancy ? occupancy.endTime : startTime + 10;
    maxEndTime = Math.max(maxEndTime, endTime);
  }
  
  return maxEndTime;
}

/**
 * 寻找关键路径（简化版）
 */
function findCriticalPath(
  allSteps: Array<{ step: SubStep; processId: string }>,
  stepStartTimes: Map<string, number>
): string[] {
  // 简化实现：返回耗时最长的路径
  const path: string[] = [];
  // TODO: 实现完整的关键路径算法
  return path;
}
```

**验收标准**：
- [ ] 调度器服务实现完成
- [ ] 能够计算设备占用时间线
- [ ] 能够检测设备冲突
- [ ] 能够处理依赖关系

---

### 步骤4：扩展 SubStep 接口（1小时）

更新 `src/types/recipe.ts`：

```typescript
import { DeviceRequirement } from './scheduling';

export interface SubStep {
  // ... 阶段1的字段 ...
  
  // 新增：设备调度相关
  deviceRequirement?: DeviceRequirement;    // 设备资源需求
  canParallelWith?: string[];              // 可以并行的步骤ID列表
  mustAfter?: string[];                     // 必须在某些步骤之后执行
  estimatedDuration?: TimeValue;           // 预计耗时（用于调度）
}
```

**验收标准**：
- [ ] SubStep 接口扩展完成
- [ ] 类型定义正确

---

### 步骤5：创建甘特图组件（4-5小时）

创建 `src/components/scheduling/GanttView.tsx`：

```typescript
import React, { useMemo } from 'react';
import { useRecipeStore } from '@/store/useRecipeStore';
import { calculateSchedule } from '@/services/scheduler';
import { DeviceOccupancy } from '@/types/scheduling';
import { defaultDevicePool } from '@/data/devicePool';

export function GanttView() {
  const { processes } = useRecipeStore();
  
  // 计算调度结果
  const scheduleResult = useMemo(() => {
    return calculateSchedule(processes);
  }, [processes]);
  
  // 获取所有设备
  const devices = useMemo(() => {
    const deviceSet = new Set<string>();
    scheduleResult.timeline.forEach(occupancy => {
      deviceSet.add(occupancy.deviceCode);
    });
    return Array.from(deviceSet).sort();
  }, [scheduleResult]);
  
  // 计算时间范围
  const maxTime = useMemo(() => {
    return Math.max(...scheduleResult.timeline.map(o => o.endTime), 0);
  }, [scheduleResult]);
  
  return (
    <div className="gantt-view h-full overflow-auto">
      <div className="gantt-header sticky top-0 bg-white z-10 border-b">
        <div className="flex">
          <div className="w-48 border-r p-2 font-bold">设备</div>
          <div className="flex-1 relative" style={{ minWidth: `${maxTime * 2}px` }}>
            {/* 时间轴 */}
            <div className="flex">
              {Array.from({ length: Math.ceil(maxTime / 10) + 1 }, (_, i) => (
                <div key={i} className="border-l p-1 text-xs" style={{ width: '20px' }}>
                  {i * 10}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      <div className="gantt-body">
        {devices.map(deviceCode => (
          <GanttRow
            key={deviceCode}
            deviceCode={deviceCode}
            occupancies={scheduleResult.timeline.filter(o => o.deviceCode === deviceCode)}
            maxTime={maxTime}
          />
        ))}
      </div>
      
      {/* 统计信息 */}
      <div className="gantt-footer border-t p-4 bg-gray-50">
        <div className="text-sm">
          <span>总耗时: {scheduleResult.totalDuration} 分钟</span>
          {scheduleResult.warnings.length > 0 && (
            <span className="ml-4 text-red-600">
              警告: {scheduleResult.warnings.length} 个
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function GanttRow({
  deviceCode,
  occupancies,
  maxTime,
}: {
  deviceCode: string;
  occupancies: DeviceOccupancy[];
  maxTime: number;
}) {
  return (
    <div className="gantt-row flex border-b">
      <div className="w-48 border-r p-2">{deviceCode}</div>
      <div className="flex-1 relative" style={{ minWidth: `${maxTime * 2}px` }}>
        {/* 时间线背景 */}
        <div className="absolute inset-0 bg-gray-100" />
        
        {/* 占用块 */}
        {occupancies.map(occupancy => (
          <div
            key={occupancy.stepId}
            className="absolute bg-blue-500 text-white text-xs p-1 rounded cursor-pointer hover:bg-blue-600"
            style={{
              left: `${(occupancy.startTime / maxTime) * 100}%`,
              width: `${(occupancy.duration / maxTime) * 100}%`,
              minWidth: '60px',
            }}
            title={`${occupancy.stepLabel} (${occupancy.duration}分钟)`}
          >
            {occupancy.stepLabel}
          </div>
        ))}
      </div>
    </div>
  );
}
```

**验收标准**：
- [ ] 甘特图组件实现完成
- [ ] 能够正确显示设备占用时间线
- [ ] 交互功能正常（悬停、点击）

---

### 步骤6：创建设备状态面板（1-2小时）

创建 `src/components/scheduling/DeviceStatusPanel.tsx`：

```typescript
import React from 'react';
import { DeviceState } from '@/types/scheduling';
import { defaultDevicePool } from '@/data/devicePool';

export function DeviceStatusPanel() {
  return (
    <div className="device-status-panel p-4 border-l bg-gray-50">
      <h3 className="font-bold mb-4">设备状态</h3>
      <div className="space-y-2">
        {defaultDevicePool.map(device => (
          <DeviceStatusItem key={device.deviceCode} device={device} />
        ))}
      </div>
    </div>
  );
}

function DeviceStatusItem({ device }: { device: any }) {
  const stateColor = {
    [DeviceState.IDLE]: 'bg-green-100 text-green-800',
    [DeviceState.IN_USE]: 'bg-blue-100 text-blue-800',
    [DeviceState.CLEANING]: 'bg-yellow-100 text-yellow-800',
    [DeviceState.MAINTENANCE]: 'bg-red-100 text-red-800',
    [DeviceState.FAULT]: 'bg-red-200 text-red-900',
  }[device.currentState || DeviceState.IDLE];
  
  return (
    <div className="flex items-center justify-between p-2 bg-white rounded">
      <span className="text-sm">{device.displayName}</span>
      <span className={`text-xs px-2 py-1 rounded ${stateColor}`}>
        {device.currentState || DeviceState.IDLE}
      </span>
    </div>
  );
}
```

**验收标准**：
- [ ] 设备状态面板实现完成
- [ ] 能够正确显示设备状态

---

### 步骤7：更新 UI 组件（2-3小时）

#### 7.1 更新 `src/components/editor/RecipeTable.tsx`

增加列：
- 设备需求列
- 可并行列
- 预计耗时列

#### 7.2 更新 `src/components/editor/ParamsModal.tsx`

增加 Tab："调度设置"
- 设备需求编辑
- 并行关系设置
- 依赖关系设置

**验收标准**：
- [ ] UI 组件更新完成
- [ ] 能够编辑设备需求和并行关系

---

### 步骤8：更新状态管理（1-2小时）

更新 `src/store/useRecipeStore.ts`：

```typescript
import { calculateSchedule } from '@/services/scheduler';

// 增加调度结果缓存
const scheduleResult = useMemo(() => {
  return calculateSchedule(processes);
}, [processes]);
```

**验收标准**：
- [ ] 状态管理集成调度功能
- [ ] 调度结果缓存正确

---

### 步骤9：更新流程图节点（1小时）

更新 `src/components/graph/CustomNode.tsx`：

- 显示设备编号
- 显示设备状态指示
- 并行关系高亮

**验收标准**：
- [ ] 流程图节点更新完成
- [ ] 设备信息正确显示

---

### 步骤10：测试和验证（2小时）

**测试清单**：

1. **调度算法测试**
   - [ ] 设备占用计算正确
   - [ ] 并行步骤识别正确
   - [ ] 依赖关系处理正确
   - [ ] 设备冲突检测正确

2. **甘特图测试**
   - [ ] 时间线显示正确
   - [ ] 占用块位置正确
   - [ ] 交互功能正常

3. **UI 测试**
   - [ ] 设备需求编辑正常
   - [ ] 并行关系设置正常
   - [ ] 设备状态显示正常

---

## 验收标准总结

### 功能验收

- [ ] 调度类型定义完成
- [ ] 设备资源池配置完成
- [ ] 调度器服务实现完成
- [ ] 甘特图组件实现完成
- [ ] 设备状态面板实现完成
- [ ] UI 组件更新完成
- [ ] 状态管理集成完成
- [ ] 流程图节点更新完成
- [ ] 所有测试通过

### 质量验收

- [ ] 代码无 TypeScript 错误
- [ ] 代码无 ESLint 警告
- [ ] 调度算法正确性验证
- [ ] 性能满足要求

---

## 预期成果

完成阶段2后：

1. **设备调度可视化**：甘特图直观展示设备占用
2. **并行优化**：自动识别可并行步骤，优化生产周期
3. **设备状态管理**：实时追踪设备使用状态
4. **研发辅助**：帮助研发人员理解设备占用关系

---

## 注意事项

1. **研发视图优先**：当前只实现研发视图的调度，不考虑实际生产执行
2. **简化调度算法**：不需要复杂的优化算法，重点是可视化
3. **性能考虑**：调度计算可能较慢，需要缓存和优化
