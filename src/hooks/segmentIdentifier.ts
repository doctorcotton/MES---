import { FlowNode, RecipeEdge } from '../types/recipe';

/**
 * 工艺段接口
 */
export interface ProcessSegment {
  id: string;
  nodes: FlowNode[];           // 该段的所有节点
  isParallel: boolean;         // 是否在并行区域
  startNodeId: string;         // 起始节点ID
  endNodeId: string;           // 结束节点ID
}

/**
 * 识别工艺段的结果
 */
export interface SegmentIdentificationResult {
  parallelSegments: ProcessSegment[];
  convergenceNode: FlowNode | null;
  serialSegments: ProcessSegment[];
}

/**
 * 识别工艺段
 * 
 * 策略：
 * 1. 找到所有起点节点（入度为0）
 * 2. 从每个起点开始DFS，直到遇到汇聚点（多入度节点）或终点
 * 3. 每条路径 = 一个并行工艺段
 * 4. 汇聚点之后的节点 = 串行工艺段
 */
export function identifyProcessSegments(
  nodes: FlowNode[],
  edges: RecipeEdge[]
): SegmentIdentificationResult {
  // 构建图结构
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

  // 找到所有起点节点（入度为0）
  const startNodes = nodes.filter(node => {
    const incoming = incomingEdges.get(node.id) || [];
    return incoming.length === 0;
  });

  // 找到汇聚点（入度 > 1 的节点）
  const convergenceNodes = nodes.filter(node => {
    const incoming = incomingEdges.get(node.id) || [];
    return incoming.length > 1;
  });

  // 如果只有一个汇聚点，使用它；否则选择第一个
  const convergenceNode = convergenceNodes.length > 0 ? convergenceNodes[0] : null;

  // 从每个起点开始DFS，构建并行工艺段
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

  // 识别串行工艺段（汇聚点之后的节点）
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

    if (serialNodes.length > 1) {
      // 将串行节点分组为工艺段（连续的节点为一个段）
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

