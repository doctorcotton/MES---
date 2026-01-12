import {
  SubStep,
  Process,
  RecipeEdge,
  CompoundingParams,
  CompoundingFeedStep,
  CompoundingAdditive,
  CompoundingFeedStepWater,
  CompoundingFeedStepFromProcess,
  CompoundingFeedStepManual,
  ProcessType,
} from '@/types/recipe';

/**
 * 从旧的 additives 结构转换为新的 feedSteps 结构
 */
export function convertAdditivesToFeedSteps(
  additives: CompoundingAdditive[]
): CompoundingFeedStep[] {
  return additives.map((additive) => {
    if (additive.type === 'solution') {
      // 溶解液 → 引用前序工艺段（全量）
      return {
        kind: 'fromProcess',
        sourceProcessId: additive.source || '',
        name: additive.name,
      } as CompoundingFeedStepFromProcess;
    } else if (additive.type === 'rawMaterial') {
      // 原料：判断是水还是手动步骤
      const name = additive.name || '';
      const amount = additive.amount || '';

      // 如果名称包含"水"或"RO水"，且 amount 是百分比或升数，则视为加水
      if (name.includes('水') || name.includes('RO')) {
        // 解析 amount：可能是 "10%-20%" 或 "100L" 等
        const percentMatch = amount.match(/(\d+(?:\.\d+)?)%(?:-(\d+(?:\.\d+)?)%)?/);
        const literMatch = amount.match(/(\d+(?:\.\d+)?)\s*L/i);

        if (percentMatch) {
          // 百分比模式
          const min = parseFloat(percentMatch[1]);
          const max = percentMatch[2] ? parseFloat(percentMatch[2]) : min;
          return {
            kind: 'water',
            waterName: name,
            amount: {
              mode: 'percent',
              min,
              max,
            },
          } as CompoundingFeedStepWater;
        } else if (literMatch) {
          // 升数模式
          const value = parseFloat(literMatch[1]);
          return {
            kind: 'water',
            waterName: name,
            amount: {
              mode: 'L',
              value,
            },
          } as CompoundingFeedStepWater;
        } else {
          // 无法解析，视为手动步骤
          return {
            kind: 'manual',
            title: name,
            note: amount ? `用量: ${amount}` : undefined,
          } as CompoundingFeedStepManual;
        }
      } else {
        // 其他原料视为手动步骤
        return {
          kind: 'manual',
          title: name,
          note: amount ? `用量: ${amount}` : undefined,
        } as CompoundingFeedStepManual;
      }
    } else {
      // 未知类型，转为手动步骤
      return {
        kind: 'manual',
        title: additive.name || '未知步骤',
        note: additive.amount,
      } as CompoundingFeedStepManual;
    }
  });
}

/**
 * 从新的 feedSteps 结构派生旧的 additives 结构（用于兼容显示）
 * 只包含加水、引用前序、手动步骤，不包含搅拌
 */
export function deriveAdditivesFromFeedSteps(
  feedSteps: CompoundingFeedStep[]
): CompoundingAdditive[] {
  const additives: CompoundingAdditive[] = [];
  let order = 1;

  feedSteps.forEach((step) => {
    if (step.kind === 'water') {
      // 加水 → rawMaterial
      const amountStr =
        step.amount.mode === 'percent'
          ? step.amount.min !== undefined && step.amount.max !== undefined
            ? `${step.amount.min}%-${step.amount.max}%`
            : step.amount.value !== undefined
            ? `${step.amount.value}%`
            : ''
          : step.amount.value !== undefined
          ? `${step.amount.value}L`
          : '';

      additives.push({
        order: order++,
        type: 'rawMaterial',
        name: step.waterName || 'RO水',
        amount: amountStr,
      });
    } else if (step.kind === 'fromProcess') {
      // 引用前序工艺段 → solution
      additives.push({
        order: order++,
        type: 'solution',
        source: step.sourceProcessId,
        name: step.name || `来自${step.sourceProcessId}`,
      });
    } else if (step.kind === 'manual') {
      // 手动步骤 → rawMaterial（用于显示）
      additives.push({
        order: order++,
        type: 'rawMaterial',
        name: step.title,
        amount: step.note,
      });
    }
    // 搅拌步骤不加入 additives
  });

  return additives;
}

/**
 * 规范化调配子步骤的 feedSteps 数据
 * 如果已有 feedSteps 则直接使用，否则从 additives 转换
 */
export function normalizeCompoundingFeedSteps(
  subStep: SubStep,
  processes: Process[]
): CompoundingFeedStep[] {
  if (subStep.processType !== ProcessType.COMPOUNDING) {
    return [];
  }

  const params = subStep.params as { compoundingParams?: CompoundingParams };
  const compoundingParams = params?.compoundingParams;

  if (!compoundingParams) {
    return [];
  }

  // 如果已有 feedSteps，直接使用
  if (compoundingParams.feedSteps && compoundingParams.feedSteps.length > 0) {
    return compoundingParams.feedSteps;
  }

  // 否则从旧的 additives 转换
  if (compoundingParams.additives && compoundingParams.additives.length > 0) {
    return convertAdditivesToFeedSteps(compoundingParams.additives);
  }

  return [];
}

/**
 * 获取可用的前序工艺段列表（用于下拉选择）
 * 返回在当前工艺段之前的所有工艺段
 */
export function getAvailableSourceProcesses(
  currentProcessId: string,
  processes: Process[]
): Process[] {
  const currentIndex = processes.findIndex((p) => p.id === currentProcessId);
  if (currentIndex === -1) {
    return [];
  }

  // 返回当前工艺段之前的所有工艺段
  return processes.slice(0, currentIndex);
}
