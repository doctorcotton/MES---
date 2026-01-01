# 产品需求文档 (PRD): 饮料工艺流程配方编辑器 (MVP)

| 项目 | 内容 |
| --- | --- |
| **产品名称** | Beverage Recipe & Process Editor (MES-Ready) |
| **版本** | v1.0 (MVP) |
| **目标用户** | 工艺工程师 (Process Engineer) |
| **核心目标** | 将饮料生产工艺结构化，通过表格输入自动生成带时序逻辑的流程图，并输出可供 MES 读取的标准 JSON。 |
| **技术栈要求** | React, TypeScript, React Flow, Zustand, Dagre, Shadcn/UI |

---

## 1. 产品概述 (Overview)

### 1.1 背景

传统的饮料生产工艺图通常是静态图片（Visio/CAD），MES 系统无法直接理解其中的逻辑。我们需要一个工具，允许工程师以**表格形式**定义工艺步骤、参数和**投料顺序**，系统自动生成可视化的拓扑图，并确保数据的逻辑严密性。

### 1.2 核心价值

* **结构化数据:** 界面是图，底层是标准 JSON。
* **自动布局:** 无论流程多复杂，无需人工拖拽，自动生成标准布局。
* **时序逻辑:** 解决“多股流汇聚”时的先后投料顺序问题（Sequence Order）。

---

## 2. 用户界面架构 (UI Architecture)

页面采用 **左右分栏 (Split View)** 布局，高度 100vh，无滚动条（内部区域滚动）。

* **Header (顶部栏):**
* 左侧: 项目名称。
* 右侧: "Export JSON"（导出）, "Import JSON"（导入）, "Reset"（重置）按钮。


* **Left Panel (左侧 40% - 编辑区):**
* 组件: `RecipeDataTable`。
* 功能: 数据的增删改查。


* **Right Panel (右侧 60% - 视图区):**
* 组件: `RecipeFlowChart`。
* 功能: 基于 React Flow 的实时渲染，只读（或仅支持点击查看），不支持拖拽改变逻辑。



---

## 3. 功能需求详细说明 (Functional Requirements)

### 3.1 数据表格 (The Data Table)

左侧面板是一个可编辑的表格，每一行代表一个“工艺节点 (Node)”。

#### 3.1.1 字段定义

| 列名 | 数据类型 | 说明 | 交互控件 |
| --- | --- | --- | --- |
| **ID** | String (Unique) | 唯一标识 (如 P1, Tank1) | 文本输入 (校验唯一性) |
| **步骤名称** | String | 显示在节点的标题栏 | 文本输入 |
| **位置/设备** | String | 对应的物理设备 (Device Code) | 文本输入 |
| **原料/内容** | String | 该步骤涉及的物料 | 多行文本域 (Textarea) |
| **关键参数** | String | 温度、时间、转速 | 多行文本域 |
| **下一步 (Output)** | Array | 定义流向及顺序 **(核心)** | **点击弹出“连接管理器”对话框** |
| **操作** | Action | 删除该行 | 图标按钮 |

#### 3.1.2 核心逻辑：连接管理 (Connection Manager)

这是本产品的逻辑核心。当用户点击“下一步”单元格时，弹出一个 Dialog/Modal：

* **标题:** 配置 `{CurrentNodeID}` 的输出流向。
* **列表内容:**
* 允许添加多个目标节点 (Target Node)。
* **字段 1 (Target):** 下拉选择框，列出所有其他节点的 ID。
* **字段 2 (Sequence):** 数字输入框 (1, 2, 3...)。定义物料进入目标节点的顺序。


* **示例场景:**
* P1 的 Output 配置为: `{ Target: P6, Sequence: 1 }`
* P2 的 Output 配置为: `{ Target: P6, Sequence: 2 }`
* *含义:* P6 桶先接收 P1 的料，再接收 P2 的料。



### 3.2 流程图视图 (The Visualization)

右侧面板根据表格数据实时渲染。

#### 3.2.1 自动布局 (Auto-Layout)

* **算法:** 使用 `dagre` 库。
* **方向:** Top-to-Bottom ('TB')。
* **触发时机:** 任意节点数据变更、连线变更、新增/删除行时，立即重新计算 `x, y` 坐标。

#### 3.2.2 自定义节点 (Custom Node)

* **外观:** 工业卡片风格。
* **内容:**
* **Header:** 橙色背景，粗体显示 `ID` 和 `步骤名称`。
* **Body:** 白色背景，分行显示 `位置`、`原料`、`参数`。
* **Handles:**
* Top Handle: 接收输入 (Target)。
* Bottom Handle: 输出 (Source)。





#### 3.2.3 自定义连线 (Custom Edge)

* **外观:** 平滑阶梯线 (SmoothStep)。
* **顺序标识 (Badge):**
* 如果在连接管理器中定义了 `Sequence Order`，必须在线条中间渲染一个圆形 Badge。
* 内容: 显示数字 (如 ①, ②)。
* 颜色: 蓝色或显眼颜色，用于区分并行流的优先级。



### 3.3 交互联动 (Interactivity)

* **Hover 高亮:**
* 鼠标悬停在表格某一行 -> 右侧对应节点边框变色 (Highlight)。
* 鼠标悬停在右侧节点 -> 左侧表格对应行背景变色。


* **点击同步:**
* 点击右侧节点 -> 左侧表格自动滚动到该行并聚焦。



---

## 4. 数据模型 (Data Schema)

这是系统唯一的“单一事实来源 (Single Source of Truth)”。Cursor 必须严格遵守此结构。

```typescript
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
  data: {
    label: string;       // 步骤名称，如 "糖醇溶解"
    deviceCode: string;  // 设备号，如 "TANK_01" (对应表格的位置列)
    ingredients: string; // 原料描述
    params: string;      // 工艺参数描述
  };
  position: { x: number; y: number }; // 由 Dagre 自动计算，无需持久化存储
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
}

```

---

## 5. 异常处理与校验 (Validation)

1. **唯一性校验:** 用户输入 ID 时，如果 ID 已存在，表格应提示错误或禁止保存。
2. **环路检测 (Loop Detection):** (MVP 可选) 理想情况下，禁止 A -> B -> A 的连接。如果检测到，连线不予创建并 Toast 报错。
3. **孤立节点:** 允许存在没有连线的节点（如刚创建时）。
4. **删除保护:** 删除一个节点时，必须级联删除所有以该节点为 Source 或 Target 的连线 (Edges)。

---

## 6. 技术实现指南 (Technical Implementation Guide)

请按照以下模块结构进行代码生成：

### 6.1 状态管理 (Zustand Store)

创建 `useRecipeStore.ts`：

* State: `nodes`, `edges`
* Actions:
* `addNode(node)`
* `updateNode(id, data)`
* `removeNode(id)` -> **重要:** 同时触发 `cleanupEdges(id)`
* `setEdges(edges)` -> 触发 `onLayout()`
* `onLayout()` -> 调用 Dagre 计算函数



### 6.2 组件结构

* `/components/editor/RecipeTable.tsx`: 使用 Shadcn Table。
* `/components/editor/ConnectionModal.tsx`: 用于编辑 Edge 和 Sequence。
* `/components/graph/RecipeFlow.tsx`: React Flow 包装器。
* `/components/graph/CustomNode.tsx`: 展示详细信息的卡片。
* `/components/graph/SequenceEdge.tsx`: 渲染带有数字 Badge 的连线。

### 6.3 样式指南

* 使用 Tailwind CSS。
* 主色调: Slate (900/100) 用于 UI 框架。
* 节点颜色: Orange-500 (标题), White (内容), Border-Gray-300。
* 连线颜色: Gray-400。

---

## 7. 初始测试数据 (Initial State)

(请直接使用前面提供的 P1...P8 完整 JSON 数据作为 `initialState`，以便应用启动时即可看到效果。)