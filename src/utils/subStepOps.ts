import { SubStep, Process } from '@/types/recipe';

/**
 * 规范化子步骤的 order 字段，确保从 1 开始连续递增
 */
export function normalizeSubStepOrders(subSteps: SubStep[]): SubStep[] {
  return subSteps.map((subStep, index) => ({
    ...subStep,
    order: index + 1,
  }));
}

/**
 * 生成唯一的子步骤 ID
 * 格式：{processId}-substep-{index}
 * 避免与现有子步骤 ID 冲突
 */
export function generateUniqueSubStepId(
  processId: string,
  existingSubSteps: SubStep[]
): string {
  const prefix = `${processId}-substep-`;
  
  // 找出所有已使用的索引
  const usedIndices = new Set<number>();
  existingSubSteps.forEach((s) => {
    if (typeof s.id === 'string' && s.id.startsWith(prefix)) {
      const suffix = s.id.slice(prefix.length);
      const n = Number.parseInt(suffix, 10);
      if (Number.isFinite(n) && n > 0) {
        usedIndices.add(n);
      }
    }
  });

  // 找到第一个未使用的索引
  let nextIndex = 1;
  while (usedIndices.has(nextIndex)) {
    nextIndex += 1;
  }

  return `${prefix}${nextIndex}`;
}

/**
 * 在工艺段内复制子步骤
 * @param process 源工艺段
 * @param subStepId 要复制的子步骤 ID
 * @param insertAfter 是否插入到原步骤后面（true）还是前面（false）
 * @returns 更新后的工艺段
 */
export function duplicateSubStepInProcess(
  process: Process,
  subStepId: string,
  insertAfter: boolean = true
): Process {
  const subStepIndex = process.node.subSteps.findIndex(
    (s) => s.id === subStepId
  );
  
  if (subStepIndex === -1) {
    throw new Error(`SubStep ${subStepId} not found in process ${process.id}`);
  }

  const sourceSubStep = process.node.subSteps[subStepIndex];
  
  // 深拷贝子步骤（使用 JSON 序列化/反序列化确保深拷贝）
  const duplicatedSubStep: SubStep = {
    ...JSON.parse(JSON.stringify(sourceSubStep)),
    id: generateUniqueSubStepId(process.id, process.node.subSteps),
    // 移除可能存在的迁移标记，因为这是新创建的副本
    _migrated: undefined,
    _migrationSource: undefined,
  };

  // 插入到指定位置
  const newSubSteps = [...process.node.subSteps];
  const insertIndex = insertAfter ? subStepIndex + 1 : subStepIndex;
  newSubSteps.splice(insertIndex, 0, duplicatedSubStep);

  // 规范化 order
  const normalizedSubSteps = normalizeSubStepOrders(newSubSteps);

  return {
    ...process,
    node: {
      ...process.node,
      subSteps: normalizedSubSteps,
    },
  };
}

/**
 * 在工艺段之间移动子步骤
 * @param processes 所有工艺段数组
 * @param sourceProcessId 源工艺段 ID
 * @param subStepId 要移动的子步骤 ID
 * @param targetProcessId 目标工艺段 ID
 * @param targetIndex 目标位置索引（-1 表示插入到末尾）
 * @returns { processes: Process[], newSubStepId: string } 更新后的工艺段数组和新的子步骤 ID（如果跨段移动时 ID 变化）
 */
export function moveSubStepBetweenProcesses(
  processes: Process[],
  sourceProcessId: string,
  subStepId: string,
  targetProcessId: string,
  targetIndex: number
): { processes: Process[]; newSubStepId: string | null } {
  // 找到源工艺段和目标工艺段
  const sourceProcess = processes.find((p) => p.id === sourceProcessId);
  const targetProcess = processes.find((p) => p.id === targetProcessId);

  if (!sourceProcess) {
    throw new Error(`Source process ${sourceProcessId} not found`);
  }
  if (!targetProcess) {
    throw new Error(`Target process ${targetProcessId} not found`);
  }

  // 找到要移动的子步骤
  const subStepIndex = sourceProcess.node.subSteps.findIndex(
    (s) => s.id === subStepId
  );
  if (subStepIndex === -1) {
    throw new Error(
      `SubStep ${subStepId} not found in source process ${sourceProcessId}`
    );
  }

  const subStepToMove = sourceProcess.node.subSteps[subStepIndex];

  // 如果源和目标相同，只需要重新排序
  if (sourceProcessId === targetProcessId) {
    const newSubSteps = [...sourceProcess.node.subSteps];
    const [removed] = newSubSteps.splice(subStepIndex, 1);
    
    // 计算目标索引（考虑移除后的位置变化）
    let finalTargetIndex = targetIndex;
    if (targetIndex === -1) {
      finalTargetIndex = newSubSteps.length;
    } else if (targetIndex > subStepIndex) {
      finalTargetIndex = targetIndex - 1; // 因为移除了一个元素
    }
    
    newSubSteps.splice(finalTargetIndex, 0, removed);
    const normalizedSubSteps = normalizeSubStepOrders(newSubSteps);

    return {
      processes: processes.map((p) =>
        p.id === sourceProcessId
          ? {
              ...p,
              node: {
                ...p.node,
                subSteps: normalizedSubSteps,
              },
            }
          : p
      ),
      newSubStepId: null, // 同段内移动，ID 不变
    };
  }

  // 跨工艺段移动
  // 1. 从源工艺段移除
  const sourceSubSteps = sourceProcess.node.subSteps.filter(
    (s) => s.id !== subStepId
  );
  const normalizedSourceSubSteps = normalizeSubStepOrders(sourceSubSteps);

  // 2. 更新子步骤 ID（如果目标工艺段不同，需要更新 ID 前缀）
  let updatedSubStep = { ...subStepToMove };
  let newSubStepId: string | null = null;
  if (!subStepToMove.id.startsWith(`${targetProcessId}-substep-`)) {
    // 需要生成新的 ID
    newSubStepId = generateUniqueSubStepId(targetProcessId, targetProcess.node.subSteps);
    updatedSubStep = {
      ...subStepToMove,
      id: newSubStepId,
    };
  }

  // 3. 插入到目标工艺段
  const targetSubSteps = [...targetProcess.node.subSteps];
  const finalTargetIndex = targetIndex === -1 ? targetSubSteps.length : targetIndex;
  targetSubSteps.splice(finalTargetIndex, 0, updatedSubStep);
  const normalizedTargetSubSteps = normalizeSubStepOrders(targetSubSteps);

  // 4. 更新 processes 数组
  return {
    processes: processes.map((p) => {
      if (p.id === sourceProcessId) {
        return {
          ...p,
          node: {
            ...p.node,
            subSteps: normalizedSourceSubSteps,
          },
        };
      }
      if (p.id === targetProcessId) {
        return {
          ...p,
          node: {
            ...p.node,
            subSteps: normalizedTargetSubSteps,
          },
        };
      }
      return p;
    }),
    newSubStepId: newSubStepId || subStepId, // 返回新的 ID（如果变化了）或原 ID
  };
}
