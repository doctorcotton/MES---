# 配方生图算法技术路线文档

本文档详细描述了 MES 系统中将工艺配方自动转换为流程图的核心算法设计、技术路线及数据存储结构。

---

## 1. 技术路线概览

系统采用 **"数据驱动 + 自动布局"** 的架构，将复杂的工艺配方解耦为纯数据模型，并通过图形算法动态生成拓扑结构。

### 核心技术栈
- **React Flow**: 专业的流程图渲染引擎，支持高度定制化的节点和连线。
- **Zustand**: 轻量级状态管理，用于实时维护配方数据和节点位置。
- **自定义布局算法**: 针对工艺段（Process Segments）设计的车道制（Lanes）布局算法。

**注意**：文档中提到的 Dagre 库未在代码中使用。水平布局直接基于 `displayOrder` 计算，不依赖图形布局算法库。

---

## 2. 数据模型与存储格式

配方数据以 **JSON** 格式保存。数据结构采用了"工艺段 - 子步骤"的层次模型，并配合独立的连线定义。

### 2.1 核心 Schema 结构

#### RecipeSchema（根对象）

```typescript
interface RecipeSchema {
  metadata: {
    name: string;        // 配方名称
    version: string;     // 版本号
    updatedAt: string;   // 更新时间（ISO 8601）
  };
  processes: Process[];  // 主数据：工艺段列表（对应表格中的大项）
  edges: RecipeEdge[];   // 拓扑数据：工艺段之间的连线（逻辑流向）
}
```

#### Process（工艺段）

一个工艺段代表一个完整的工艺单元，包含多个子步骤。

```typescript
interface Process {
  id: string;                    // 工艺段ID: "P1"
  name: string;                  // 工艺段名称: "糖醇、三氯蔗糖类溶解液"
  description?: string;          // 工艺段描述（可选）
  node: ProcessNode;             // 该工艺段的步骤节点（单节点）
}
```

#### ProcessNode（步骤节点）

```typescript
interface ProcessNode {
  id: string;                    // 节点ID: "P1" (与工艺段ID相同)
  type: 'processNode';           // 节点类型（固定值）
  label: string;                 // 节点标签: "糖醇、三氯蔗糖类溶解液"
  subSteps: SubStep[];           // 子步骤序列
  position?: { x: number; y: number };  // 布局位置（前端计算，不持久化）
}
```

#### SubStep（子步骤）

子步骤是工艺段内的最小执行单元，包含具体的工艺参数。

```typescript
interface SubStep {
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
```

#### ProcessType（工艺类型枚举）

```typescript
enum ProcessType {
  DISSOLUTION = 'dissolution',        // 溶解
  COMPOUNDING = 'compounding',       // 调配
  FILTRATION = 'filtration',         // 过滤
  TRANSFER = 'transfer',             // 赶料
  FLAVOR_ADDITION = 'flavorAddition', // 香精添加
  OTHER = 'other'                    // 其他
}
```

#### ProcessNodeData（工艺参数联合类型）

根据不同的工艺类型，参数结构不同：

```typescript
type ProcessNodeData =
  | ({ processType: ProcessType.DISSOLUTION } & { dissolutionParams: DissolutionParams })
  | ({ processType: ProcessType.COMPOUNDING } & { compoundingParams: CompoundingParams })
  | ({ processType: ProcessType.FILTRATION } & { filtrationParams: FiltrationParams })
  | ({ processType: ProcessType.TRANSFER } & { transferParams: TransferParams })
  | ({ processType: ProcessType.FLAVOR_ADDITION } & { flavorAdditionParams: FlavorAdditionParams })
  | ({ processType: ProcessType.OTHER } & { params: string });
```

#### RecipeEdge（连线定义）

连线只连接工艺段之间，不包含工艺段内部连线。

```typescript
interface RecipeEdge {
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
```

### 2.2 FlowNode（流程图节点）

流程图节点支持两种模式：汇总节点（折叠模式）和子步骤节点（展开模式）。

```typescript
interface FlowNode {
  id: string;        // 节点ID: "P1" (汇总节点) 或 "P1-substep-1" (子步骤节点)
  type: 'processSummaryNode' | 'subStepNode'; // 节点类型
  position: { x: number; y: number }; // 由布局算法计算，初始化时使用 (0, 0)
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
```

#### InputSource（输入来源信息）

用于调配节点显示进料顺序。

```typescript
interface InputSource {
  nodeId: string;           // 来源节点ID
  name: string;              // 来源名称（子步骤名称或工艺段名称）
  processId: string;         // 来源工艺段ID
  processName: string;       // 来源工艺段名称
  sequenceOrder: number;     // 投料顺序序号
}
```

### 2.3 数据存储格式

#### 内存数据结构（Zustand Store）

```typescript
interface RecipeStore {
  // 主数据结构
  processes: Process[];           // 工艺段列表
  edges: RecipeEdge[];           // 工艺段间连线
  metadata: {
    name: string;
    version: string;
    updatedAt: string;
  };
  
  // UI状态
  hoveredNodeId: string | null;
  selectedNodeId: string | null;
  expandedProcesses: Set<string>; // 展开的工艺段ID集合
  
  // 布局缓存（不持久化）
  // 注意：节点位置、高度、宽度不存储在数据库中，仅保存在内存中
  // 每次加载配方时，由布局算法重新计算
}
```

#### 数据库存储格式（SQLite）

```sql
CREATE TABLE recipes (
  id TEXT PRIMARY KEY,              -- 配方ID（默认 'default'）
  metadata TEXT NOT NULL,           -- JSON字符串：{ name, version, updatedAt }
  processes TEXT NOT NULL,          -- JSON字符串：Process[] 数组
  edges TEXT NOT NULL,              -- JSON字符串：RecipeEdge[] 数组
  version INTEGER DEFAULT 1,        -- 乐观锁版本号
  updated_at TEXT NOT NULL,         -- ISO 8601 时间戳
  updated_by TEXT                   -- 最后更新用户ID
);
```

**重要**：节点位置、高度、宽度**不存储在数据库中**，仅保存在内存中的缓存中。每次加载配方时，由布局算法重新计算，以保证算法逻辑的可进化性。

---

## 3. 算法核心细节

自动生图算法分为三个阶段：**数据转换**、**逻辑识别** 和 **坐标计算**。

### 3.1 工艺段识别 (Segment Identification)

算法通过分析 `edges` 自动识别流程中的并行段和串行段。

#### 算法原理

工艺段识别采用**深度优先搜索（DFS）**策略，从起点节点开始遍历，直到遇到汇聚点或终点。

#### 识别规则

1. **起点节点**：入度为 0 的节点
2. **汇聚点**：入度 > 1 的节点（多个分支汇聚）
3. **并行工艺段**：从起点到汇聚点之间的路径
4. **串行工艺段**：汇聚点之后的连续节点序列

#### 完整实现代码

```typescript
export function identifyProcessSegments(
  nodes: FlowNode[],
  edges: RecipeEdge[]
): SegmentIdentificationResult {
  // 1. 构建图结构（邻接表）
  const nodeMap = new Map<string, FlowNode>();
  nodes.forEach(node => nodeMap.set(node.id, node));

  const outgoingEdges = new Map<string, RecipeEdge[]>();
  const incomingEdges = new Map<string, RecipeEdge[]>();

  edges.forEach(edge => {
    if (!outgoingEdges.has(edge.source)) {
      outgoingEdges.set(edge.source, []);
    }
    outgoingEdges.get(edge.source)!.push(edge);

    if (!incomingEdges.has(edge.target)) {
      incomingEdges.set(edge.target, []);
    }
    incomingEdges.get(edge.target)!.push(edge);
  });

  // 2. 找到所有起点节点（入度为0）
  const startNodes = nodes.filter(node => {
    const incoming = incomingEdges.get(node.id) || [];
    return incoming.length === 0;
  });

  // 3. 找到汇聚点（入度 > 1 的节点）
  const convergenceNodes = nodes.filter(node => {
    const incoming = incomingEdges.get(node.id) || [];
    return incoming.length > 1;
  });

  // 如果只有一个汇聚点，使用它；否则选择第一个
  const convergenceNode = convergenceNodes.length > 0 ? convergenceNodes[0] : null;

  // 4. 从每个起点开始DFS，构建并行工艺段
  const parallelSegments: ProcessSegment[] = [];
  const visited = new Set<string>();

  startNodes.forEach((startNode, index) => {
    if (visited.has(startNode.id)) return;

    const segmentNodes: FlowNode[] = [];
    const segmentNodeIds = new Set<string>();

    // DFS遍历，直到遇到汇聚点或终点
    function dfs(currentNodeId: string): void {
      if (visited.has(currentNodeId)) return;
      if (segmentNodeIds.has(currentNodeId)) return; // 防止循环

      const currentNode = nodeMap.get(currentNodeId);
      if (!currentNode) return;

      // 如果当前节点是汇聚点，停止遍历
      if (convergenceNode && currentNodeId === convergenceNode.id) {
        return;
      }

      segmentNodes.push(currentNode);
      segmentNodeIds.add(currentNodeId);
      visited.add(currentNodeId);

      // 继续遍历出边
      const outgoing = outgoingEdges.get(currentNodeId) || [];
      for (const edge of outgoing) {
        const targetId = edge.target;
        
        // 如果目标节点是汇聚点，停止遍历
        if (convergenceNode && targetId === convergenceNode.id) {
          continue;
        }

        // 如果目标节点已经有入边（且不是当前边），说明是汇聚点，停止
        const targetIncoming = incomingEdges.get(targetId) || [];
        if (targetIncoming.length > 1) {
          continue;
        }

        dfs(targetId);
      }
    }

    dfs(startNode.id);

    if (segmentNodes.length > 0) {
      parallelSegments.push({
        id: `parallel-segment-${index}`,
        nodes: segmentNodes,
        isParallel: true,
        startNodeId: segmentNodes[0].id,
        endNodeId: segmentNodes[segmentNodes.length - 1].id,
      });
    }
  });

  // 5. 识别串行工艺段（汇聚点之后的节点）
  const serialSegments: ProcessSegment[] = [];
  
  if (convergenceNode) {
    const serialNodes: FlowNode[] = [convergenceNode];
    const serialNodeIds = new Set<string>([convergenceNode.id]);

    // 从汇聚点开始，找到所有后续节点
    function collectSerialNodes(nodeId: string): void {
      const outgoing = outgoingEdges.get(nodeId) || [];
      
      for (const edge of outgoing) {
        const targetId = edge.target;
        
        if (serialNodeIds.has(targetId)) continue;

        const targetNode = nodeMap.get(targetId);
        if (!targetNode) continue;

        // 如果目标节点有多个入边，说明是另一个汇聚点，停止
        const targetIncoming = incomingEdges.get(targetId) || [];
        if (targetIncoming.length > 1 && targetId !== convergenceNode.id) {
          continue;
        }

        serialNodes.push(targetNode);
        serialNodeIds.add(targetId);
        collectSerialNodes(targetId);
      }
    }

    collectSerialNodes(convergenceNode.id);

    // 将串行节点分组为工艺段（连续的节点为一个段）
    if (serialNodes.length > 1) {
      let currentSegment: FlowNode[] = [serialNodes[0]];
      
      for (let i = 1; i < serialNodes.length; i++) {
        const prevNode = serialNodes[i - 1];
        const currentNode = serialNodes[i];
        
        // 检查是否有直接连接
        const hasDirectEdge = edges.some(
          e => e.source === prevNode.id && e.target === currentNode.id
        );

        if (hasDirectEdge) {
          currentSegment.push(currentNode);
        } else {
          // 开始新段
          if (currentSegment.length > 0) {
            serialSegments.push({
              id: `serial-segment-${serialSegments.length}`,
              nodes: currentSegment,
              isParallel: false,
              startNodeId: currentSegment[0].id,
              endNodeId: currentSegment[currentSegment.length - 1].id,
            });
          }
          currentSegment = [currentNode];
        }
      }

      // 添加最后一个段
      if (currentSegment.length > 0) {
        serialSegments.push({
          id: `serial-segment-${serialSegments.length}`,
          nodes: currentSegment,
          isParallel: false,
          startNodeId: currentSegment[0].id,
          endNodeId: currentSegment[currentSegment.length - 1].id,
        });
      }
    }
  }

  return {
    parallelSegments,
    convergenceNode,
    serialSegments,
  };
}
```

#### 识别结果结构

```typescript
interface ProcessSegment {
  id: string;              // 段ID，如 "parallel-segment-0"
  nodes: FlowNode[];       // 该段的所有节点
  isParallel: boolean;     // 是否在并行区域
  startNodeId: string;     // 起始节点ID
  endNodeId: string;       // 结束节点ID
}

interface SegmentIdentificationResult {
  parallelSegments: ProcessSegment[];
  convergenceNode: FlowNode | null;
  serialSegments: ProcessSegment[];
}
```

### 3.2 坐标计算策略

布局算法不依赖单一布局引擎，而是采用复合策略：

1. **车道布局 (Lane Layout)**: X 轴位置由 `processes` 在表格中的顺序（`displayOrder`）决定。每个工艺段占领一个"垂直车道"，确保流程走向与表格逻辑严格一致。
2. **段内均匀布局**: Y 轴位置计算时，确保各并行段起点垂直对齐。段内子步骤之间保持固定的物理链高度。
3. **加权居中 (Weighted Centering)**: 汇聚点（如调配桶）会自动计算其所有上游分支的 X 坐标质心，并尝试居中对齐，以最大程度减少连线交叉。

#### X 坐标计算（水平布局）

```typescript
// 每个 Process 分配一个水平"车道"
const PROCESS_LANE_WIDTH = 300; // 每个工艺段的水平车道宽度
const LANE_GAP = 64;            // 车道之间的间隙
const START_X = 150;            // 起始 X 偏移

// 根据 displayOrder 分组节点
const nodesByDisplayOrder: Record<number, FlowNode[]> = {};
nodes.forEach(node => {
  const displayOrder = node.data.displayOrder || 1;
  if (!nodesByDisplayOrder[displayOrder]) {
    nodesByDisplayOrder[displayOrder] = [];
  }
  nodesByDisplayOrder[displayOrder].push(node);
});

// 为每个 displayOrder 组分配 X 坐标（存储为中心点）
const displayOrders = Object.keys(nodesByDisplayOrder).map(Number).sort((a, b) => a - b);
displayOrders.forEach((displayOrder, laneIndex) => {
  const laneX = START_X + laneIndex * (PROCESS_LANE_WIDTH + LANE_GAP);
  nodesByDisplayOrder[displayOrder].forEach(node => {
    const width = nodeWidths[node.id] || 200;
    // 存储节点中心点：车道左边缘 + 节点宽度的一半
    nodePositions[node.id] = { x: laneX + width / 2, y: 0 };
  });
});
```

#### 汇聚点 X 坐标计算（加权质心算法）

```typescript
// 计算汇聚点 X 坐标 (加权质心法)
if (parallelSegments.length > 0) {
  let totalWeight = 0;
  let weightedXSum = 0;

  parallelSegments.forEach(segment => {
    // 过滤出已分配位置的节点
    const validNodes = segment.nodes.filter(n => nodePositions[n.id]);
    if (validNodes.length === 0) return;

    // 计算该分支的质心 X
    const segmentCentroidX = validNodes.reduce((sum, n) => 
      sum + nodePositions[n.id].x, 0
    ) / validNodes.length;

    // 权重 = 节点数量 (子树规模)
    const weight = validNodes.length;

    weightedXSum += segmentCentroidX * weight;
    totalWeight += weight;
  });

  if (totalWeight > 0) {
    convergenceX = weightedXSum / totalWeight;
  }
}
```

#### Y 坐标计算（垂直布局）

**并行段布局**：

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

**汇聚点 Y 坐标计算**（支持三种策略）：

```typescript
// 计算每个并行段的终点 Y 坐标
const endYs = parallelSegments.map(seg => {
  const lastNode = seg.nodes[seg.nodes.length - 1];
  const lastNodeY = nodeYPositions[lastNode.id];
  const lastNodeHeight = nodeHeights[lastNode.id] || 120;
  
  // 终点Y = 节点中心Y + 节点高度的一半 + 固定连线长
  return lastNodeY + lastNodeHeight / 2 + targetEdgeLength;
});

// 策略1: max（推荐）- 所有入边都向下，符合视觉习惯
const convergenceY = Math.max(...endYs);

// 策略2: weighted - 根据工艺段长度加权
const totalSteps = parallelSegments.reduce((sum, seg) => sum + seg.nodes.length, 0);
let weightedSum = 0;
parallelSegments.forEach((seg, idx) => {
  const weight = seg.nodes.length / totalSteps;
  weightedSum += endYs[idx] * weight;
});
const convergenceY = weightedSum;

// 策略3: median - 取中位数
const sorted = [...endYs].sort((a, b) => a - b);
const mid = Math.floor(sorted.length / 2);
const convergenceY = sorted.length % 2 === 0
  ? (sorted[mid - 1] + sorted[mid]) / 2
  : sorted[mid];
```

**坐标转换**（中心点 → 左上角）：

React Flow 使用左上角坐标，但内部计算使用中心点坐标：

```typescript
// 转换为左上角坐标（React Flow 要求）
const layoutedNodes = nodes.map(node => {
  const pos = nodePositions[node.id];
  const width = nodeWidths[node.id] || 200;
  const height = nodeHeights[node.id] || 120;
  
  return {
    ...node,
    position: {
      x: pos.x - width / 2,  // 中心点 → 左上角
      y: pos.y - height / 2, // 中心点 → 左上角
    },
  };
});
```

### 3.3 动态 Handle 分配

为解决多条连线汇入同一节点导致的重叠问题，算法会：

1. **统计节点的入度**：计算每个节点的输入边数量
2. **排序连线**：根据连线的 `sequenceOrder`（投料顺序）对输入边进行排序
3. **均匀分配挂载点**：在节点顶部均匀分配 handle 位置

```typescript
// 分配 targetHandle 和 sourceHandle
const nodeIncomingEdges = new Map<string, RecipeEdge[]>();
edges.forEach(edge => {
  if (!nodeIncomingEdges.has(edge.target)) {
    nodeIncomingEdges.set(edge.target, []);
  }
  nodeIncomingEdges.get(edge.target)!.push(edge);
});

return flowEdges.map(edge => {
  const incomingEdges = nodeIncomingEdges.get(edge.target) || [];
  let targetHandle: string | undefined;
  
  if (incomingEdges.length > 1) {
    // 根据 sequenceOrder 排序
    const sortedInEdges = [...incomingEdges].sort((a, b) => 
      (a.data?.sequenceOrder || 0) - (b.data?.sequenceOrder || 0)
    );
    const handleIndex = sortedInEdges.findIndex(e => e.id === edge.id);
    if (handleIndex >= 0) {
      targetHandle = `target-${handleIndex}`;
    }
  }
  
  return { ...edge, targetHandle, sourceHandle };
});
```

在 `CustomNode` 组件中，根据输入数量动态生成 handle：

```typescript
// 获取输入边数量
const incomingEdges = flowEdges.filter(edge => edge.target === id);
const inputCount = incomingEdges.length;

// 根据输入数量生成 handle
{inputCount <= 1 ? (
  <Handle type="target" position={Position.Top} className="w-3 h-3 bg-gray-400" />
) : (
  Array.from({ length: inputCount }).map((_, index) => {
    const leftPosition = inputCount > 1
      ? 15 + (index * (70 / (inputCount - 1)))
      : 50;

    return (
      <Handle
        key={`target-${index}`}
        id={`target-${index}`}
        type="target"
        position={Position.Top}
        className="w-3 h-3 bg-gray-400"
        style={{ left: `${leftPosition}%` }}
      />
    );
  })
)}
```

---

## 4. 渲染层实现细节

### 4.1 自定义节点 (CustomNode)

#### 动态宽度计算（分档策略）

根据输入数量分档，在节点渲染时动态计算：

```typescript
/**
 * 根据输入数量计算分档宽度
 */
const getTieredWidth = (inputCount: number): number => {
  if (inputCount <= 2) return 200;  // 1-2个输入：200px
  if (inputCount <= 4) return 280;  // 3-4个输入：280px
  return 360;                        // 5个及以上：360px
};
```

**使用方式**：

```typescript
const inputCount = edges.filter(e => e.target === id).length;
const nodeWidth = getTieredWidth(inputCount);

// 应用到节点样式
<div style={{ minWidth: `${nodeWidth}px`, width: `${nodeWidth}px` }}>
  {/* 节点内容 */}
</div>
```

#### 内容映射

节点内容根据 `ProcessNodeData` 动态渲染：

1. **使用 `useFieldConfigStore`**：根据 `processType` 获取字段配置
2. **动态渲染字段**：根据字段类型（`inputType`）选择不同的渲染方式
3. **支持嵌套结构**：处理对象类型、数组类型等复杂结构

```typescript
const SubStepParamsDisplay = ({ subStep, inputSources }: { subStep: SubStep, inputSources?: InputSource[] }) => {
  const { getConfigsByProcessType } = useFieldConfigStore();
  const configs = getConfigsByProcessType(subStep.processType);

  // 从嵌套参数结构中获取值
  const getParamValue = (key: string): any => {
    const paramKeyMaps: Record<string, string> = {
      [ProcessType.DISSOLUTION]: 'dissolutionParams',
      [ProcessType.COMPOUNDING]: 'compoundingParams',
      // ...
    };
    const groupKey = paramKeyMaps[subStep.processType];
    if (!groupKey || !(subStep.params as any)[groupKey]) return null;
    return (subStep.params as any)[groupKey][key];
  };

  return (
    <div className="space-y-1">
      {configs.map(config => {
        const val = getParamValue(config.key);
        if (val === undefined || val === null) return null;
        return (
          <div key={config.key} className="text-xs text-gray-700">
            <span className="font-medium">{config.label}:</span> {renderFieldValue(config, val)}
          </div>
        );
      })}
    </div>
  );
};
```

#### 节点展开/折叠

节点支持两种模式：

1. **汇总节点（折叠模式）**：显示工艺段汇总信息，点击可展开
2. **子步骤节点（展开模式）**：显示单个子步骤详情

```typescript
// 汇总节点渲染
if (isSummaryNode && data.processId) {
  return (
    <div onClick={() => toggleProcessExpanded(data.processId!)}>
      {/* 显示工艺段名称和子步骤数量 */}
    </div>
  );
}

// 子步骤节点渲染
if (isSubStepNode && data.subStep) {
  return (
    <div>
      {/* 显示子步骤详情 */}
    </div>
  );
}
```

#### 调度信息显示

节点可以显示调度信息（如果可用）：

```typescript
const { timeline } = useRecipeSchedule();
const occupancy = timeline.find((o: any) => o.stepId === subStep.id);

if (occupancy) {
  return (
    <div className="mt-2 pt-2 border-t border-dashed border-gray-300">
      <div className="text-xs text-purple-700 font-medium flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
        {occupancy.deviceCode}
      </div>
      <div className="text-xs text-gray-500 ml-2.5">
        耗时: {occupancy.duration}min
        {occupancy.startTime > 0 && ` (T+${occupancy.startTime})`}
      </div>
    </div>
  );
}
```

### 4.2 连线逻辑 (SequenceEdge)

#### 平滑路径

使用 React Flow 的 `getSmoothStepPath` 生成平滑路径：

```typescript
const [path] = getSmoothStepPath({
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  borderRadius: 20,
});
```

#### 走廊路由机制

当多条连线汇入同一节点时，使用走廊路由避免连线交叉：

```typescript
// 判断是否使用走廊路由
const incomingTotal = data?.incomingTotal;
const useCorridor = incomingTotal !== undefined && incomingTotal > 1;

if (useCorridor) {
  // 使用走廊路径（三段式：垂直-水平-垂直）
  return generateCorridorPath(sourceX, sourceY, targetX, targetY);
} else {
  // 使用默认平滑路径
  return getSmoothStepPath({...});
}
```

**走廊路径生成**：

```typescript
function generateCorridorPath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number
): string {
  // 计算走廊Y坐标
  let corridorY = targetY - CORRIDOR_CLEARANCE_PX;
  
  // 夹紧条件1：确保走廊不压住目标节点
  const minCorridorY = targetY - MIN_TARGET_CLEARANCE_PX;
  corridorY = Math.min(corridorY, minCorridorY);
  
  // 夹紧条件2：确保有足够的下降距离
  const minSourceY = sourceY + MIN_SOURCE_DROP_PX;
  corridorY = Math.max(corridorY, minSourceY);
  
  // 生成三段式路径（带圆角）
  // 1. 从源点垂直下降到走廊
  // 2. 水平移动到目标X附近
  // 3. 垂直上升到目标点
  return path;
}
```

#### 顺序角标

在靠近目标节点处渲染"顺序角标"（数字标识），清晰展示投料优先级：

```typescript
const sequenceOrder = data?.sequenceOrder;
const badgeX = targetX;
const badgeY = targetY - 30; // 稍微调高一点，避免挡住节点标题栏

{sequenceOrder && (
  <EdgeLabelRenderer>
    <div
      style={{
        position: 'absolute',
        transform: `translate(-50%, -50%) translate(${badgeX}px,${badgeY}px)`,
      }}
    >
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white shadow-md ring-2 ring-white">
        {sequenceOrder}
      </div>
    </div>
  </EdgeLabelRenderer>
)}
```

---

## 5. 错误处理和边界情况

### 5.1 节点尺寸未测量

**问题**：React Flow 可能在某些情况下未测量节点尺寸。

**处理**：使用默认值继续布局，并在控制台输出警告：

```typescript
const measuredNodes = nodes.filter(n => n.width && n.height);
const unmeasuredNodes = nodes.filter(n => !n.width || !n.height);

if (unmeasuredNodes.length > 0) {
  console.warn('[LayoutController] 部分节点尺寸未测量，使用默认尺寸:',
    unmeasuredNodes.map(n => n.id)
  );
}

// 使用默认值
nodes.forEach(node => {
  nodeHeights[node.id] = node.height || 120;
  nodeWidths[node.id] = node.width || 200;
});
```

### 5.2 节点位置缺失

**问题**：某些节点可能没有分配到位置。

**处理**：为缺失节点分配默认位置：

```typescript
const nodesWithoutPosition = nodes.filter(n => !nodePositions[n.id]);
if (nodesWithoutPosition.length > 0) {
  console.warn('[LayoutController] 发现未分配位置的节点:',
    nodesWithoutPosition.map(n => n.id)
  );

  // 为缺失节点分配默认位置
  nodesWithoutPosition.forEach(node => {
    const displayOrder = node.data.displayOrder || 1;
    const laneIndex = displayOrders.indexOf(displayOrder);
    const laneX = laneIndex >= 0
      ? START_X + laneIndex * (PROCESS_LANE_WIDTH + LANE_GAP)
      : START_X;
    const width = nodeWidths[node.id] || 200;
    nodePositions[node.id] = { x: laneX + width / 2, y: INITIAL_Y };
  });
}
```

### 5.3 循环检测

**问题**：DFS 遍历可能遇到循环。

**处理**：使用 `visited` 和 `segmentNodeIds` Set 防止循环：

```typescript
const visited = new Set<string>();
const segmentNodeIds = new Set<string>();

function dfs(currentNodeId: string): void {
  if (visited.has(currentNodeId)) return;
  if (segmentNodeIds.has(currentNodeId)) return; // 防止循环
  // ...
}
```

### 5.4 重排迭代机制

**问题**：首次布局后，节点尺寸可能发生变化，导致连线长度不准确。

**处理**：自动校验间距，必要时重排（最多3次迭代，容差5px）：

```typescript
const TARGET_EDGE_LENGTH = 120;
const TOLERANCE = 5; // 允许误差 5px
const MAX_ITERATIONS = 3; // 最多重排 3 次

// 等待 1-2 帧让 ReactFlow 完成重新测量
window.requestAnimationFrame(() => {
  window.requestAnimationFrame(() => {
    // 重新获取节点（可能已重新测量尺寸）
    const currentNodes = getNodes() as FlowNode[];
    const currentEdges = getEdges() as RecipeEdge[];

    // 校验边间距
    let maxError = 0;
    let invalidEdgeCount = 0;

    currentEdges.forEach(edge => {
      const sourceNode = currentNodes.find(n => n.id === edge.source);
      const targetNode = currentNodes.find(n => n.id === edge.target);
      if (!sourceNode || !targetNode) return;

      const sourceHeight = sourceNode.height || 120;
      const sourceBottom = sourceNode.position.y + sourceHeight;
      const targetTop = targetNode.position.y;
      const actualGap = targetTop - sourceBottom;
      const error = Math.abs(actualGap - TARGET_EDGE_LENGTH);

      if (error > TOLERANCE) {
        invalidEdgeCount++;
        maxError = Math.max(maxError, error);
      }
    });

    // 判断是否需要重排
    const needsRelayout = invalidEdgeCount > 0 && layoutIterationRef.current < MAX_ITERATIONS;

    if (needsRelayout) {
      layoutIterationRef.current++;
      hasLayoutedRef.current = false;
      setRelayoutTrigger(prev => prev + 1); // 触发重排
      return;
    }

    // 间距合格或达到最大迭代次数，完成布局
    hasLayoutedRef.current = true;
    fitView({ padding: 0.2, duration: 0 });
    onLayoutComplete();
  });
});
```

---

## 6. 性能优化

### 6.1 缓存机制

**位置缓存**：计算好的位置会实时更新到 `useRecipeStore` 的 `nodePositions` 缓存中，防止页面刷新抖动。

**签名比较**：使用 `layoutTrigger` 检测内容变化，避免不必要的重新计算：

```typescript
const layoutTrigger = useMemo(() => {
  const processIds = processes.map(p => p.id).join(',');
  const subStepIds = processes.flatMap(p => p.node.subSteps.map(s => s.id)).join(',');
  const expandedIds = Array.from(expandedProcesses).sort().join(',');
  
  return `${processIds}|${subStepIds}|${expandedIds}`;
}, [processes, expandedProcesses]);
```

### 6.2 批量更新

所有位置计算完成后，一次性更新 Store：

```typescript
// 所有位置计算完成后，一次性更新
onNodesUpdate(layoutedNodes);
setNodes(layoutedNodes);
```

### 6.3 React 优化

**useMemo**：`useFlowNodes` 和 `useFlowEdges` 使用 `useMemo` 缓存结果：

```typescript
export const useFlowNodes = (): FlowNode[] => {
  return useMemo(() => {
    // 计算节点...
  }, [processes, expandedProcesses, nodePositions]);
};
```

**memo**：`CustomNode` 和 `SequenceEdge` 使用 `React.memo` 避免不必要的重渲染：

```typescript
export const CustomNode = memo(({ id, data, selected, type }: NodeProps<CustomNodeData>) => {
  // ...
});

export const SequenceEdge = memo(({ ... }: EdgeProps) => {
  // ...
});
```

### 6.4 布局触发优化

基于内容变化触发器，避免不必要的重新计算：

```typescript
// 内容变化时重置布局标记
if (layoutTrigger !== layoutTriggerRef.current) {
  hasLayoutedRef.current = false;
  layoutIterationRef.current = 0;
  layoutTriggerRef.current = layoutTrigger;
  setRelayoutTrigger(0);
}
```

---

## 7. 调试和验证

### 7.1 调试模式

调试模式提供可视化工具，实时显示连线长度和误差，帮助快速定位布局问题。

**启用方式**：

1. **UI 开关**：点击流程图右上角的调试按钮
2. **控制台**：
   ```javascript
   localStorage.setItem('debug_layout', 'true');  // 开启
   localStorage.setItem('debug_layout', 'false'); // 关闭
   ```

**显示内容**：

- **连线长度标注**：每条连线旁边显示实际长度和误差
- **颜色编码**：
  - 🟢 绿色：误差 < 5px
  - 🟡 黄色：误差 5-10px
  - 🔴 红色：误差 > 10px
- **节点信息标签**：显示节点尺寸和位置信息

**实现位置**：`src/components/graph/DebugOverlay.tsx`

### 7.2 布局验证统计

控制台输出布局验证统计：

```javascript
[Debug] 连线长度验证:
  ✅ P1 → P6: 实际 120.3 目标 120 误差 0.3 | 源底 200.0 目标顶 320.3 | H₁ 120 H₂ 120
  ⚠️ P2 → P6: 实际 125.1 目标 120 误差 5.1 | 源底 205.0 目标顶 330.1 | H₁ 120 H₂ 120
```

**目标指标**：
- 标准差 < 3px
- 平均误差 < 2px

---

## 8. 存储与交互

### 8.1 持久化策略

**持久化**：保存时仅持久化逻辑数据（Processes & Edges），坐标信息属于前端运行时的视图状态，不存储于主数据库，以保证算法逻辑的可进化性。

**内存缓存**：计算好的位置会实时更新到 `useRecipeStore` 的 `nodePositions` 缓存中，防止页面刷新抖动。

### 8.2 数据同步

**协作编辑**：支持多用户协作编辑，使用 WebSocket 实时同步数据。

**乐观锁**：使用版本号（`version`）实现乐观锁，防止并发冲突。

---

## 9. 相关文件

### 核心布局文件

- `src/components/graph/LayoutController.tsx` - 主布局控制器（Headless Component）
- `src/components/graph/RecipeFlow.tsx` - React Flow 组件（集成布局控制器）
- `src/hooks/segmentIdentifier.ts` - 工艺段识别算法
- `src/hooks/segmentLayoutCalculator.ts` - 分段布局计算器

### 渲染组件

- `src/components/graph/CustomNode.tsx` - 自定义节点组件（包含分档宽度计算）
- `src/components/graph/SequenceEdge.tsx` - 自定义连线组件（包含走廊路由）

### 调试组件

- `src/components/graph/DebugOverlay.tsx` - 调试叠加层组件（显示连线长度）
- `src/components/graph/DebugStatsPanel.tsx` - 调试统计面板（显示布局统计）

### 状态管理

- `src/store/useRecipeStore.ts` - 状态管理（包含节点位置缓存）

### 类型定义

- `src/types/recipe.ts` - 类型定义（FlowNode, RecipeEdge, ProcessSegment 等）

---

## 10. 总结

本算法采用**工艺段识别 + 分段布局**的策略，能够：

1. ✅ 自动识别并行和串行工艺段
2. ✅ 确保连线长度统一（120px）
3. ✅ 使用 React Flow 自动测量的真实节点尺寸
4. ✅ 基于表格顺序（`displayOrder`）进行水平对齐
5. ✅ 智能处理汇聚点的居中（加权质心算法）
6. ✅ 提供调试模式可视化布局问题
7. ✅ 支持节点展开/折叠
8. ✅ 支持走廊路由避免连线交叉
9. ✅ 自动重排迭代机制确保布局准确

算法具有良好的可扩展性和性能，能够处理复杂的工艺流程图形布局需求。
