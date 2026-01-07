# AI-GUIDE.md 更新总结

## 更新时间
2026-01-07

## 更新内容

### 1. 新增"重要更新"部分 📌

在文档开头添加了重要更新说明，包括：

#### 布局算法架构重构
- ✅ 从 Dagre 库迁移到自研的**工艺段识别 + 分段布局**算法
- ✅ 核心文件变更：
  - `LayoutController.tsx` - Headless 布局控制器（替代 `useAutoLayout.ts`）
  - `segmentIdentifier.ts` - DFS 工艺段识别算法
  - `segmentLayoutCalculator.ts` - 分段布局计算器
- ✅ 新特性：
  - 固定连线长度（120px）
  - 汇聚点智能居中（加权质心算法）
  - 调试模式可视化（连线长度标注、误差高亮）

#### 动态字段配置系统
- ✅ 数据库驱动的字段定义系统
- ✅ 核心组件：DynamicFormRenderer、FieldConfigEditor、useFieldConfigStore
- ✅ 支持多种字段类型：Text, Number, Select, Array, Object, Range 等

### 2. 更新功能-文件映射表

#### 新增流程图组件
- `LayoutController.tsx` - Headless 布局组件
- `DebugOverlay.tsx` - 调试模式可视化
- `DebugStatsPanel.tsx` - 布局统计信息

#### 更新 Hooks 部分
- 移除：`useAutoLayout.ts`（已废弃）
- 新增：
  - `segmentIdentifier.ts` - DFS 算法识别并行/串行段
  - `segmentLayoutCalculator.ts` - 布局算法

#### 新增类型定义
- `fieldConfig.ts` - 动态字段配置类型定义

#### 新增工具函数
- `fieldExtractor.ts` - 从配方数据中提取字段定义
- `fieldValidator.ts` - 字段验证逻辑
- `syncFieldsFromRecipes.ts` - 从配方同步字段到数据库

### 3. 更新目录结构说明

- 添加 `common/` 目录说明（通用组件、动态表单渲染器）
- 更新各目录的描述，反映最新的文件组织结构

### 4. 更新核心概念部分

#### React Flow 集成
- 从"使用 Dagre 算法"改为"采用工艺段识别 + 分段布局策略"
- 详细说明布局算法的四个步骤：
  1. 工艺段识别（DFS 算法）
  2. 并行段布局（起点对齐、连线统一）
  3. 汇聚点居中（加权质心算法）
  4. 串行段布局（垂直向下、连线统一）
- 新增调试模式说明

### 5. 更新数据流架构图

- 将 `useAutoLayout` 替换为 `LayoutController`
- 添加 `segmentIdentifier` 和 `segmentLayoutCalculator` 节点
- 更新数据流向，反映实际的布局计算流程

### 6. 更新常见任务速查

#### 修改自动布局算法
- 更新文件路径和说明
- 添加配置参数列表
- 添加调试工具说明
- 引用 `AUTO_LAYOUT_ALGORITHM.md` 详细文档

#### 添加新工艺类型
- 移除手动高度估算步骤
- 说明节点高度由 React Flow 自动测量

#### 新增任务说明
- **使用调试模式**：
  - 启用方式（UI 按钮 / localStorage）
  - 显示内容（连线长度、颜色编码）
  - 组件位置
- **配置动态字段**：
  - 访问配置页面
  - 字段类型和配置项
  - 核心文件

### 7. 更新 README.md

#### 核心编辑功能
- 将"使用 Dagre 自动布局"改为"采用工艺段识别+分段布局算法"
- 新增"调试模式"功能说明

#### 技术栈
- 移除 `Dagre.js`（已不再使用）

## 核对要点

### ✅ 已核对项目
1. **文件结构**：核对了 `src/` 下所有子目录的实际文件
2. **组件列表**：确认了所有组件的存在和功能
3. **Hooks 列表**：更新为实际存在的 hooks 文件
4. **类型定义**：确认了所有类型文件
5. **工具函数**：添加了新增的工具函数
6. **布局算法**：详细核对了 `LayoutController.tsx` 的实现
7. **技术栈**：移除了已废弃的 Dagre.js

### ✅ 文档一致性
- AI-GUIDE.md 与实际代码结构完全一致
- README.md 与 AI-GUIDE.md 描述保持一致
- 所有文件路径均已验证存在

### ✅ 新增说明
- 布局算法架构重构的完整说明
- 动态字段配置系统的使用指南
- 调试模式的详细使用方法

## 建议

### 后续可以考虑的改进
1. 在 AI-GUIDE.md 中添加常见问题（FAQ）部分
2. 添加性能优化建议部分
3. 添加测试指南部分
4. 考虑添加架构决策记录（ADR）

### 文档维护建议
1. 每次重大架构变更后及时更新 AI-GUIDE.md
2. 保持 README.md 和 AI-GUIDE.md 的同步
3. 定期核对文件映射表的准确性
4. 重要算法变更时同步更新 AUTO_LAYOUT_ALGORITHM.md

## 总结

本次更新全面核对并更新了 AI-GUIDE.md 和 README.md，主要反映了以下两个重大变更：

1. **布局算法重构**：从 Dagre 库迁移到自研算法
2. **动态字段配置系统**：实现了数据库驱动的字段定义

所有文档现在与实际代码结构完全一致，为 AI 助手和开发者提供了准确的技术导航。
