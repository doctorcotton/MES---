import { DragEndEvent } from '@dnd-kit/core';
import { Process } from '@/types/recipe';

/**
 * ID 前缀常量
 */
const PROCESS_PREFIX = 'process:';
const SUBSTEP_PREFIX = 'substep:';
const SLOT_PREFIX = 'slot:';

/**
 * 生成工艺段 sortable ID
 */
export function makeProcessId(processId: string): string {
  return `${PROCESS_PREFIX}${processId}`;
}

/**
 * 生成子步骤 sortable ID
 */
export function makeSubStepId(subStepId: string): string {
  return `${SUBSTEP_PREFIX}${subStepId}`;
}

/**
 * 生成插入槽位 droppable ID
 */
export function makeSlotId(processId: string, index: number): string {
  return `${SLOT_PREFIX}${processId}:${index}`;
}

/**
 * 解析工艺段 ID
 */
export function parseProcessId(id: string): string | null {
  if (id.startsWith(PROCESS_PREFIX)) {
    return id.slice(PROCESS_PREFIX.length);
  }
  return null;
}

/**
 * 解析子步骤 ID
 */
export function parseSubStepId(id: string): string | null {
  if (id.startsWith(SUBSTEP_PREFIX)) {
    return id.slice(SUBSTEP_PREFIX.length);
  }
  return null;
}

/**
 * 解析插入槽位 ID，返回 { processId, index }
 * index: -1 表示末尾，0 表示首位前，>0 表示插入到第 index 个子步骤前
 */
export function parseSlotId(id: string): { processId: string; index: number } | null {
  if (id.startsWith(SLOT_PREFIX)) {
    const rest = id.slice(SLOT_PREFIX.length);
    const [processId, indexStr] = rest.split(':');
    const index = Number.parseInt(indexStr, 10);
    if (processId && Number.isFinite(index)) {
      return { processId, index };
    }
  }
  return null;
}

/**
 * 判断是否为工艺段 ID
 */
export function isProcessId(id: string): boolean {
  return id.startsWith(PROCESS_PREFIX);
}

/**
 * 判断是否为子步骤 ID
 */
export function isSubStepId(id: string): boolean {
  return id.startsWith(SUBSTEP_PREFIX);
}

/**
 * 判断是否为插入槽位 ID
 */
export function isSlotId(id: string): boolean {
  return id.startsWith(SLOT_PREFIX);
}

/**
 * 从原始子步骤 ID 提取工艺段 ID（兼容旧格式）
 * 格式：{processId}-substep-{index}
 */
export function extractProcessIdFromSubStepId(subStepId: string): string | null {
  const match = subStepId.match(/^([P]\d+)-substep-/);
  return match ? match[1] : null;
}

/**
 * 兼容旧格式：判断是否为原始子步骤 ID
 */
export function isLegacySubStepId(id: string): boolean {
  return /^[P]\d+-substep-\d+$/.test(id);
}

/**
 * 拖拽意图类型
 */
export type DragIntent =
  | { type: 'noop' }
  | { type: 'reorderProcess'; processIds: string[] }
  | { type: 'reorderSubSteps'; processId: string; subStepIds: string[] }
  | {
      type: 'moveSubStep';
      sourceProcessId: string;
      subStepId: string;
      targetProcessId: string;
      targetIndex: number;
    };

/**
 * 解析拖拽事件，返回明确的拖拽意图
 */
export function getSubStepDragIntent(
  event: DragEndEvent,
  processes: Process[]
): DragIntent {
  const { active, over } = event;

  if (!over) {
    return { type: 'noop' };
  }

  const activeId = active.id as string;
  const overId = over.id as string;

  // 获取 active 和 over 的 data（如果存在）
  const activeData = (active.data.current as { type?: string; processId?: string }) || {};
  const overData = (over.data.current as { type?: string; processId?: string }) || {};

  // 情况1：拖拽工艺段（process）
  if (isProcessId(activeId) || activeData.type === 'process') {
    const sourceProcessId = parseProcessId(activeId) || activeId;
    
    // 只在 over 也是 process 时触发重排序
    if (isProcessId(overId) || overData.type === 'process') {
      const targetProcessId = parseProcessId(overId) || overId;
      
      if (sourceProcessId !== targetProcessId) {
        const processIds = processes.map((p) => p.id);
        const oldIndex = processIds.indexOf(sourceProcessId);
        const newIndex = processIds.indexOf(targetProcessId);
        
        if (oldIndex !== -1 && newIndex !== -1) {
          // 使用 arrayMove 逻辑计算新顺序
          const newOrder = [...processIds];
          const [removed] = newOrder.splice(oldIndex, 1);
          newOrder.splice(newIndex, 0, removed);
          return { type: 'reorderProcess', processIds: newOrder };
        }
      }
    }
    return { type: 'noop' };
  }

  // 情况2：拖拽子步骤（subStep）
  if (isSubStepId(activeId) || activeData.type === 'subStep' || isLegacySubStepId(activeId)) {
    // 解析源子步骤 ID
    const rawSubStepId = isSubStepId(activeId) 
      ? parseSubStepId(activeId) 
      : (isLegacySubStepId(activeId) ? activeId : null);
    
    if (!rawSubStepId) {
      return { type: 'noop' };
    }

    const sourceProcessId =
      activeData.processId || extractProcessIdFromSubStepId(rawSubStepId);
    
    if (!sourceProcessId) {
      return { type: 'noop' };
    }

    // 情况2.1：拖到插入槽位（slot）
    const slotInfo = parseSlotId(overId);
    if (slotInfo) {
      const { processId: targetProcessId, index } = slotInfo;
      
      // 找到目标工艺段
      const targetProcess = processes.find((p) => p.id === targetProcessId);
      if (!targetProcess) {
        return { type: 'noop' };
      }

      // 计算实际插入位置
      // index: -1 表示末尾，0 表示首位前，>0 表示插入到第 index 个子步骤前
      let targetIndex: number;
      if (index === -1) {
        targetIndex = targetProcess.node.subSteps.length; // 末尾
      } else if (index === 0) {
        targetIndex = 0; // 首位前
      } else {
        // index > 0: 插入到第 index 个子步骤前（index 从 1 开始）
        targetIndex = Math.min(index - 1, targetProcess.node.subSteps.length);
      }

      // 如果源和目标相同，检查是否需要重排序
      if (sourceProcessId === targetProcessId) {
        const sourceProcess = processes.find((p) => p.id === sourceProcessId);
        if (sourceProcess) {
          const subStepIds = sourceProcess.node.subSteps.map((s) => s.id);
          const oldIndex = subStepIds.indexOf(rawSubStepId);
          
          // 如果位置没变，返回 noop
          if (oldIndex === targetIndex || (oldIndex === targetIndex - 1 && oldIndex < targetIndex)) {
            return { type: 'noop' };
          }

          // 需要重排序
          const newOrder = [...subStepIds];
          const [removed] = newOrder.splice(oldIndex, 1);
          // 调整插入位置（如果移除的元素在插入位置之前，插入位置需要减1）
          const adjustedIndex = oldIndex < targetIndex ? targetIndex - 1 : targetIndex;
          newOrder.splice(adjustedIndex, 0, removed);
          return {
            type: 'reorderSubSteps',
            processId: sourceProcessId,
            subStepIds: newOrder,
          };
        }
      }

      // 跨段移动
      return {
        type: 'moveSubStep',
        sourceProcessId,
        subStepId: rawSubStepId,
        targetProcessId,
        targetIndex,
      };
    }

    // 情况2.2：拖到另一个子步骤上（兼容旧逻辑）
    if (isSubStepId(overId) || isLegacySubStepId(overId)) {
      const rawTargetSubStepId = isSubStepId(overId)
        ? parseSubStepId(overId)
        : (isLegacySubStepId(overId) ? overId : null);
      
      if (!rawTargetSubStepId) {
        return { type: 'noop' };
      }

      const targetProcessId =
        overData.processId || extractProcessIdFromSubStepId(rawTargetSubStepId);
      
      if (!targetProcessId) {
        return { type: 'noop' };
      }

      // 找到目标工艺段
      const targetProcess = processes.find((p) => p.id === targetProcessId);
      if (!targetProcess) {
        return { type: 'noop' };
      }

      // 找到目标子步骤的索引
      const targetSubStepIndex = targetProcess.node.subSteps.findIndex(
        (s) => s.id === rawTargetSubStepId
      );

      if (targetSubStepIndex === -1) {
        return { type: 'noop' };
      }

      // 如果源和目标相同，返回重排序意图
      if (sourceProcessId === targetProcessId) {
        const subStepIds = targetProcess.node.subSteps.map((s) => s.id);
        const oldIndex = subStepIds.indexOf(rawSubStepId);
        const newIndex = targetSubStepIndex;

        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          const newOrder = [...subStepIds];
          const [removed] = newOrder.splice(oldIndex, 1);
          newOrder.splice(newIndex, 0, removed);
          return {
            type: 'reorderSubSteps',
            processId: sourceProcessId,
            subStepIds: newOrder,
          };
        }
        return { type: 'noop' };
      }

      // 跨段移动：插入到目标子步骤的位置
      return {
        type: 'moveSubStep',
        sourceProcessId,
        subStepId: rawSubStepId,
        targetProcessId,
        targetIndex: targetSubStepIndex,
      };
    }
  }

  return { type: 'noop' };
}
