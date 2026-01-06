# 配方生图算法技术路线文档

本文档详细描述了 MES 系统中将工艺配方自动转换为流程图的核心算法设计、技术路线及数据存储结构。

---

## 1. 技术路线概览

系统采用 **“数据驱动 + 自动布局”** 的架构，将复杂的工艺配方解耦为纯数据模型，并通过图形算法动态生成拓扑结构。

### 核心技术栈
- **React Flow**: 专业的流程图渲染引擎，支持高度定制化的节点和连线。
- **Zustand**: 轻量级状态管理，用于实时维护配方数据和节点位置。
- **Dagre**: 基础的有向图布局引擎，辅助计算初步的层级关系。
- **自定义布局算法**: 针对工艺段（Process Segments）设计的车道制（Lanes）布局算法。

---

## 2. 数据模型与存储格式

配方数据以 **JSON** 格式保存。数据结构采用了“工艺段 - 子步骤”的层次模型，并配合独立的连线定义。

### 核心 Schema 结构
```typescript
interface RecipeSchema {
  metadata: {
    name: string;        // 配方名称
    version: string;     // 版本号
    updatedAt: string;   // 更新时间
  };
  processes: Process[];  // 主数据：工艺段列表（对应表格中的大项）
  edges: RecipeEdge[];   // 拓扑数据：工艺段之间的连线（逻辑流向）
}

// 连线定义（存储物理流向逻辑）
interface RecipeEdge {
  id: string;
  source: string;        // 起点工艺段ID
  target: string;        // 终点工艺段ID
  data: {
    sequenceOrder: number; // 投料顺序权重（用于多分支汇聚排序）
  };
}
```

---

## 3. 算法核心细节

自动生图算法分为三个阶段：**数据转换**、**逻辑识别** 和 **坐标计算**。

### 3.1 工艺段识别 (Segment Identification)
算法通过分析 `edges` 自动识别流程中的并行段和串行段：
- **并行工艺段**: 入度为 0 的起始分支，或汇聚点之前的独立路径。
- **汇聚节点**: 具有多个输入源的节点（如“调配”节点）。
- **串行工艺段**: 汇聚点之后的一系列线性步骤。

### 3.2 坐标计算策略
布局算法不依赖单一布局引擎，而是采用复合策略：
1. **车道布局 (Lane Layout)**: X 轴位置由 `processes` 在表格中的顺序（`displayOrder`）决定。每个工艺段占领一个“垂直车道”，确保流程走向与表格逻辑严格一致。
2. **段内均匀布局**: Y 轴位置计算时，确保各并行段起点垂直对齐。段内子步骤之间保持固定的物理链高度。
3. **加权居中 (Weighted Centering)**: 汇聚点（如调配桶）会自动计算其所有上游分支的 X 坐标质心，并尝试居中对齐，以最大程度减少连线交叉。

### 3.3 动态 Handle 分配
为解决多条连线汇入同一节点导致的重叠问题，算法会：
- 统计节点的入度（Incoming Edges）。
- 根据连线的 `sequenceOrder`（投料顺序）动态在节点顶部均匀分配挂载点（Handles）。

### 3.4 核心函数逻辑示例 (TypeScript)

以下是用于 Y 轴坐标计算的简化核心逻辑：

```typescript
/**
 * 间距计算逻辑：节点高度的一半 + 目标连线长度 + 下个节点高度的一半
 */
const spacing =
  currentNodeHeight / 2 +      // 当前节点底部到中心
  config.targetEdgeLength +    // 连线长度（固定，默认为 120px）
  nextNodeHeight / 2;          // 下个节点中心到顶部

currentY += spacing;
```

以及汇聚点 Y 坐标的处理策略（`max` 模式）：
```typescript
// 计算每个并行段的终点 Y 坐标
const endYs = parallelSegments.map(seg => {
  const lastNode = seg.nodes[seg.nodes.length - 1];
  // 终点 Y = 节点中心 Y + 节点一半高度 + 固定连线长
  return lastNodeY + lastNodeHeight / 2 + targetEdgeLength;
});

// 取最大值作为汇聚点的起始 Y，确保所有连线向下流动
const convergenceY = Math.max(...endYs);
```

---

## 4. 渲染层实现细节

### 自定义节点 (CustomNode)
- **动态宽度**: 根据入度数量自动分档（200px / 280px / 360px），确保存放多个挂载点时不拥挤。
- **内容映射**: 将 `ProcessNodeData`（溶解、调配等参数）按照后端定义的字段结构，利用 `useFieldConfigStore` 动态渲染。

### 连线逻辑 (SequenceEdge)
- 使用 `SmoothStep` 路径，并在靠近目标节点处渲染 **“顺序角标”**（数字标识），清晰展示投料优先级。

---

## 5. 存储与交互

- **缓存机制**: 计算好的位置会实时更新到 `useRecipeStore` 的 `nodePositions` 缓存中，防止页面刷新抖动。
- **持久化**: 保存时仅持久化逻辑数据（Processes & Edges），坐标信息属于前端运行时的视图状态，不存储于主数据库，以保证算法逻辑的可进化性。
