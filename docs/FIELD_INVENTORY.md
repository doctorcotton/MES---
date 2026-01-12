# 工艺字段完整清单

本文档统计了所有工艺类型使用的字段，包括字段名称、类型、单位、是否必填、选项等信息。

## 统计说明

- **字段Key**: 在参数对象中的键名
- **显示名称**: 字段的中文显示名称
- **数据类型**: TypeScript类型定义
- **输入类型**: 字段配置器中的inputType
- **单位**: 字段的单位（如有）
- **是否必填**: 字段是否必填
- **选项**: 下拉选择字段的选项列表
- **默认值**: 字段的默认值
- **显示条件**: 字段的显示条件（依赖其他字段）
- **当前支持**: 字段配置器是否支持该字段类型
- **备注**: 其他说明

---

## 1. DISSOLUTION (溶解工艺)

| 字段Key | 显示名称 | 数据类型 | 输入类型 | 单位 | 必填 | 选项 | 默认值 | 显示条件 | 当前支持 | 备注 |
|---------|---------|---------|---------|------|------|------|--------|----------|---------|------|
| waterVolumeMode | 水量模式 | `WaterVolumeMode` | select | - | ✅ | `ratio`(料水比), `fixed`(固定水量) | `ratio` | - | ✅ | 控制水量输入方式 |
| waterRatio | 料水比 | `WaterRatio` | waterRatio | (1:X) | ❌ | - | `{min: 5, max: 8}` | `waterVolumeMode == 'ratio'` | ✅ | 仅当水量模式=料水比时显示 |
| waterVolume | 水量 | `ConditionValue` | conditionValue | L | ❌ | - | - | `waterVolumeMode == 'fixed'` | ✅ | 仅当水量模式=固定水量时显示 |
| waterTemp | 水温 | `TemperatureRange` | range | ℃ | ❌ | - | `{unit: '℃'}` | - | ✅ | 可设置min/max，也可只设置unit |
| stirringTime | 搅拌时间 | `{value: number, unit: 'min'}` | number | min | ✅ | - | - | - | ⚠️ | **问题**: 实际是对象，但配置为number |
| stirringRate | 搅拌速率 | `StirringRate` | select | - | ✅ | `high`(高速), `medium`(中速), `low`(低速) | - | - | ✅ | - |
| transferType | 赶料类型 | `TransferType` | select | - | ✅ | `material`(料赶料), `water`(水赶料), `none`(无) | - | - | ✅ | - |

**问题发现**:
- `stirringTime` 实际类型是 `{value: number, unit: 'min'}`，但字段配置器中使用 `number` 类型，单位通过 `unit` 字段配置。这可能导致数据不一致。

---

## 2. COMPOUNDING (调配工艺)

| 字段Key | 显示名称 | 数据类型 | 输入类型 | 单位 | 必填 | 选项 | 默认值 | 显示条件 | 当前支持 | 备注 |
|---------|---------|---------|---------|------|------|------|--------|----------|---------|------|
| additives | 添加物列表 | `CompoundingAdditive[]` | **array** | - | ❌ | - | `[]` | - | ❌ | **缺失**: 数组类型不支持 |
| stirringSpeed | 搅拌速度 | `ConditionValue` | conditionValue | % | ✅ | - | - | - | ✅ | - |
| stirringTime | 搅拌时间 | `{value: number, unit: 'min'}` | number | min | ✅ | - | - | - | ⚠️ | **问题**: 同溶解工艺 |
| finalTemp | 最终温度 | `{max: number, unit: '℃'}` | number | ℃ | ✅ | - | - | - | ⚠️ | **问题**: 实际是对象 `{max, unit}`，但配置为number |

**CompoundingAdditive 结构** (数组项):
| 字段Key | 显示名称 | 数据类型 | 输入类型 | 单位 | 必填 | 选项 | 默认值 | 备注 |
|---------|---------|---------|---------|------|------|------|--------|------|
| order | 添加顺序 | `number` | number | - | ✅ | - | - | 数组项字段 |
| type | 类型 | `AdditiveType` | select | - | ✅ | `rawMaterial`(原料), `solution`(溶解液) | - | 数组项字段 |
| source | 来源节点ID | `string?` | text | - | ❌ | - | - | 数组项字段，仅当type=solution时 |
| name | 名称 | `string` | text | - | ✅ | - | - | 数组项字段 |
| amount | 用量 | `string?` | text | - | ❌ | - | - | 数组项字段，如 "10%-20%" |

**问题发现**:
1. `additives` 是数组类型，字段配置器**完全不支持**
2. `finalTemp` 实际是 `{max: number, unit: '℃'}`，但配置为 `number` 类型，丢失了结构信息

---

## 3. FILTRATION (过滤工艺)

| 字段Key | 显示名称 | 数据类型 | 输入类型 | 单位 | 必填 | 选项 | 默认值 | 显示条件 | 当前支持 | 备注 |
|---------|---------|---------|---------|------|------|------|--------|----------|---------|------|
| precision | 过滤精度 | `{value: number, unit: 'μm'}` | number | μm | ✅ | - | - | - | ⚠️ | **问题**: 实际是对象，但配置为number |

**问题发现**:
- `precision` 实际类型是 `{value: number, unit: 'μm'}`，但字段配置器中使用 `number` 类型。虽然单位可以通过 `unit` 字段配置，但数据结构不匹配。

---

## 4. TRANSFER (赶料工艺)

| 字段Key | 显示名称 | 数据类型 | 输入类型 | 单位 | 必填 | 选项 | 默认值 | 显示条件 | 当前支持 | 备注 |
|---------|---------|---------|---------|------|------|------|------|----------|---------|------|
| transferType | 赶料类型 | `TransferType` | select | - | ✅ | `material`(料赶料), `water`(水赶料), `none`(无) | - | - | ✅ | - |
| waterVolume | 水量 | `ConditionValue?` | conditionValue | L | ❌ | - | - | `transferType == 'water'` | ✅ | 仅当赶料类型=水赶料时显示 |
| cleaning | 清洗要求 | `string?` | text | - | ❌ | - | - | - | ✅ | - |

**支持情况**: ✅ 完全支持

---

## 5. FLAVOR_ADDITION (香精添加工艺)

| 字段Key | 显示名称 | 数据类型 | 输入类型 | 单位 | 必填 | 选项 | 默认值 | 显示条件 | 当前支持 | 备注 |
|---------|---------|---------|---------|------|------|------|--------|----------|---------|------|
| method | 添加方式 | `string` | text | - | ✅ | - | - | - | ✅ | - |

**支持情况**: ✅ 完全支持

---

## 6. OTHER (其他工艺)

| 字段Key | 显示名称 | 数据类型 | 输入类型 | 单位 | 必填 | 选项 | 默认值 | 显示条件 | 当前支持 | 备注 |
|---------|---------|---------|---------|------|------|------|--------|----------|---------|------|
| params | 参数描述 | `string` | text | - | ❌ | - | - | - | ✅ | - |

**支持情况**: ✅ 完全支持

---

## 总结

### 字段类型统计

| 输入类型 | 使用次数 | 支持情况 | 备注 |
|---------|---------|---------|------|
| text | 3 | ✅ | method, cleaning, params |
| number | 3 | ⚠️ | stirringTime(2次), precision - 但实际是对象类型 |
| select | 4 | ✅ | waterVolumeMode, stirringRate, transferType(2次) |
| range | 1 | ✅ | waterTemp |
| conditionValue | 3 | ✅ | waterVolume(2次), stirringSpeed |
| waterRatio | 1 | ✅ | waterRatio |
| **array** | **1** | **❌** | **additives - 完全不支持** |

### 问题汇总

#### 🔴 严重问题（必须解决）

1. **数组类型不支持**
   - 字段: `compoundingParams.additives`
   - 类型: `CompoundingAdditive[]`
   - 影响: 调配工艺的添加物列表无法通过字段配置器管理
   - 优先级: **最高**

#### 🟡 中等问题（建议解决）

2. **对象类型结构不匹配**
   - 字段: `stirringTime` (溶解、调配)
   - 实际类型: `{value: number, unit: 'min'}`
   - 配置类型: `number`
   - 影响: 虽然可以通过 `unit` 字段配置单位，但数据结构不一致，可能导致数据转换问题

3. **对象类型结构不匹配**
   - 字段: `precision` (过滤)
   - 实际类型: `{value: number, unit: 'μm'}`
   - 配置类型: `number`
   - 影响: 同上

4. **对象类型结构不匹配**
   - 字段: `finalTemp` (调配)
   - 实际类型: `{max: number, unit: '℃'}`
   - 配置类型: `number`
   - 影响: 丢失了 `max` 字段的结构信息，应该使用 `range` 类型但只设置 `max`

#### 🟢 轻微问题（可选优化）

5. **Select字段编辑器**
   - 当前使用JSON输入方式配置选项
   - 建议: 提供可视化编辑器

---

## 需要扩展的字段类型

### 1. 数组类型 (array) - **必须实现**

**用途**: 支持 `CompoundingAdditive[]` 等数组字段

**配置需求**:
- `itemConfig`: 数组项的结构配置（FieldConfig对象）
- `minItems`: 最小数组长度
- `maxItems`: 最大数组长度

**实现要点**:
- 动态添加/删除数组项
- 支持拖拽排序
- 使用 `itemConfig` 渲染每个数组项
- 验证数组长度和项内容

### 2. 对象类型 (object) - **建议实现**

**用途**: 支持嵌套对象字段，如 `{value: number, unit: string}`

**配置需求**:
- `fields`: 嵌套字段列表（FieldConfig[]）

**实现要点**:
- 递归渲染嵌套字段
- 支持字段分组和折叠
- 验证嵌套字段

### 3. 增强现有类型支持

**number类型增强**:
- 支持 `{value: number, unit: string}` 结构的自动处理
- 或者创建新的 `numberWithUnit` 类型

**range类型增强**:
- 支持只设置 `max` 或只设置 `min` 的情况（如 `finalTemp`）

---

## 下一步行动

1. ✅ **已完成**: 字段清单统计
2. ⏳ **待讨论**: 与用户讨论扩展方案
3. ⏳ **待实现**: 根据讨论结果实现扩展

