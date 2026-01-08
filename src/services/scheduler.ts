import { SubStep, Process, RecipeEdge, ProcessType } from '@/types/recipe';
import { DeviceResource, DeviceRequirement, DeviceOccupancy, ScheduleResult, ScheduleWarning, DeviceState, OccupancySegment } from '@/types/scheduling';

import { defaultDevicePool, findDevicesByType, findDeviceByCode } from '@/data/devicePool';

/**
 * 计算设备占用时间线
 */
export function calculateSchedule(
    processes: Process[],
    devicePool: DeviceResource[] = defaultDevicePool,
    edges: RecipeEdge[] = []
): ScheduleResult {
    const timeline: DeviceOccupancy[] = [];
    const warnings: ScheduleWarning[] = [];
    const deviceStates = new Map<string, DeviceState>();

    // 从设备池初始化设备状态
    devicePool.forEach(device => {
        deviceStates.set(device.deviceCode, device.currentState || DeviceState.IDLE);
    });

    // 收集所有步骤
    const allSteps: Array<{ step: SubStep; processId: string }> = [];
    processes.forEach(process => {
        process.node.subSteps.forEach(step => {
            allSteps.push({ step, processId: process.id });
        });
    });

    // 1. 基于 SubStep.order 自动生成隐式 mustAfter（工艺段内部顺序）
    allSteps.forEach(({ step, processId }) => {
        const process = processes.find(p => p.id === processId);
        if (!process) return;
        
        const sortedSubSteps = [...process.node.subSteps].sort((a, b) => a.order - b.order);
        const currentIndex = sortedSubSteps.findIndex(s => s.id === step.id);
        
        if (currentIndex > 0) {
            // 当前步骤必须在前一个步骤之后
            const prevStep = sortedSubSteps[currentIndex - 1];
            if (!step.mustAfter) {
                step.mustAfter = [];
            }
            // 避免重复添加
            if (!step.mustAfter.includes(prevStep.id)) {
                step.mustAfter.push(prevStep.id);
            }
        }
    });

    // 2. 基于 edges 为调配步骤添加上游依赖
    const stepIdToProcessId = new Map<string, string>();
    allSteps.forEach(({ step, processId }) => {
        stepIdToProcessId.set(step.id, processId);
    });

    // 找到所有调配步骤（COMPOUNDING 类型）
    const compoundingSteps = allSteps.filter(({ step }) => 
        step.processType === ProcessType.COMPOUNDING
    );

    compoundingSteps.forEach(({ step, processId }) => {
        // 找到所有指向当前工艺段的 edges
        const incomingEdges = edges.filter(e => e.target === processId);
        
        if (incomingEdges.length > 0) {
            // 收集所有上游工艺段的最后一个子步骤ID
            const upstreamStepIds: string[] = [];
            
            incomingEdges.forEach(edge => {
                const sourceProcess = processes.find(p => p.id === edge.source);
                if (sourceProcess && sourceProcess.node.subSteps.length > 0) {
                    // 找到源工艺段的最后一个子步骤
                    const sortedSubSteps = [...sourceProcess.node.subSteps]
                        .sort((a, b) => a.order - b.order);
                    const lastSubStep = sortedSubSteps[sortedSubSteps.length - 1];
                    upstreamStepIds.push(lastSubStep.id);
                }
            });

            // 将上游步骤添加到 mustAfter
            if (!step.mustAfter) {
                step.mustAfter = [];
            }
            upstreamStepIds.forEach(upstreamId => {
                if (!step.mustAfter!.includes(upstreamId)) {
                    step.mustAfter!.push(upstreamId);
                }
            });
        }
    });

    // 3. 对同一设备增加"工艺段级串行"依赖
    // 按 processes 数组顺序，对每个设备，确保后一个工艺段的第一个子步骤 mustAfter 前一个工艺段的最后一个子步骤
    const deviceToProcessSteps = new Map<string, Array<{ processId: string; firstStepId: string; lastStepId: string }>>();
    
    processes.forEach(process => {
        const sortedSubSteps = [...process.node.subSteps].sort((a, b) => a.order - b.order);
        if (sortedSubSteps.length === 0) return;
        
        const firstStep = sortedSubSteps[0];
        const lastStep = sortedSubSteps[sortedSubSteps.length - 1];
        
        // 获取设备编号（优先从 deviceRequirement 获取）
        const deviceCode = firstStep.deviceRequirement?.deviceCode || firstStep.deviceCode;
        if (!deviceCode) return;
        
        if (!deviceToProcessSteps.has(deviceCode)) {
            deviceToProcessSteps.set(deviceCode, []);
        }
        deviceToProcessSteps.get(deviceCode)!.push({
            processId: process.id,
            firstStepId: firstStep.id,
            lastStepId: lastStep.id
        });
    });
    
    // 对每个设备，按 processes 数组顺序建立串行依赖
    deviceToProcessSteps.forEach((processSteps, deviceCode) => {
        // 按 processes 数组顺序排序（保持原始顺序）
        const sortedProcessSteps = processSteps.sort((a, b) => {
            const indexA = processes.findIndex(p => p.id === a.processId);
            const indexB = processes.findIndex(p => p.id === b.processId);
            return indexA - indexB;
        });
        
        // 后一个工艺段的第一个子步骤必须在前一个工艺段的最后一个子步骤之后
        for (let i = 1; i < sortedProcessSteps.length; i++) {
            const prev = sortedProcessSteps[i - 1];
            const curr = sortedProcessSteps[i];
            
            const currFirstStep = allSteps.find(({ step }) => step.id === curr.firstStepId)?.step;
            if (currFirstStep) {
                if (!currFirstStep.mustAfter) {
                    currFirstStep.mustAfter = [];
                }
                if (!currFirstStep.mustAfter.includes(prev.lastStepId)) {
                    currFirstStep.mustAfter.push(prev.lastStepId);
                }
            }
        }
    });

    // 按顺序处理步骤
    const processedSteps = new Set<string>();
    const stepStartTimes = new Map<string, number>();
    const stepEndTimes = new Map<string, number>(); // 新增：记录所有步骤的结束时间

    // 第一遍：处理没有依赖的步骤
    allSteps.forEach(({ step, processId }) => {
        if (!step.mustAfter || step.mustAfter.length === 0) {
            scheduleStep(step, processId, 0, timeline, devicePool, stepStartTimes, processedSteps, warnings, allSteps);
        }
    });

    // 第二遍：处理有依赖的步骤
    let changed = true;
    // 循环依赖的安全中断
    let iterations = 0;
    const maxIterations = allSteps.length * 2;

    while (changed && iterations < maxIterations) {
        changed = false;
        iterations++;

        allSteps.forEach(({ step, processId }) => {
            if (!processedSteps.has(step.id)) {
                const dependenciesMet = checkDependencies(step.mustAfter || [], processedSteps);
                if (dependenciesMet) {
                    const startTime = calculateStartTime(step.mustAfter || [], stepStartTimes, timeline);
                    scheduleStep(step, processId, startTime, timeline, devicePool, stepStartTimes, processedSteps, warnings, allSteps);
                    changed = true;
                }
            }
        });
    }

    if (iterations >= maxIterations) {
        warnings.push({
            type: 'UNMET_DEPENDENCY',
            severity: 'error',
            message: 'Detected possible circular dependency or unresolvable dependencies in scheduling',
        });
    }

    // 计算所有步骤的结束时间
    allSteps.forEach(({ step }) => {
        const startTime = stepStartTimes.get(step.id);
        if (startTime !== undefined) {
            const duration = getStepDuration(step);
            stepEndTimes.set(step.id, startTime + duration);
        }
    });

    // 计算总耗时（优先以调配步骤结束为准，如果没有调配则取最大值）
    const compoundingOccupancies = timeline.filter(o => {
        const step = allSteps.find(({ step }) => step.id === o.stepId)?.step;
        return step?.processType === ProcessType.COMPOUNDING;
    });
    
    let totalDuration: number;
    if (compoundingOccupancies.length > 0) {
        // 以调配步骤的结束时间为准
        totalDuration = Math.max(...compoundingOccupancies.map(o => o.endTime), 0);
    } else {
        // 回退：取所有步骤的最大结束时间
        totalDuration = Math.max(...Array.from(stepEndTimes.values()), 0);
    }

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
 * 计算设备占用时间线（支持工厂配置上下文）
 * @param processes 工艺流程列表
 * @param context 设备配置上下文（研发视图或生产视图）
 * @param edges 工艺段间流向连线（可选）
 * @returns 调度结果
 */
export function calculateScheduleWithContext(
    processes: Process[],
    context: import('@/types/scheduling').DeviceConfigContext,
    edges: RecipeEdge[] = []
): ScheduleResult {
    // 使用上下文中的激活设备池进行调度
    return calculateSchedule(processes, context.activeDevicePool, edges);
}

function getStepDuration(step: SubStep): number {
    // 只使用预计耗时，未填则使用常量1（用于表达先后/并行，不代表真实分钟）
    return (step as any).estimatedDuration?.value || 1;
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
    warnings: ScheduleWarning[],
    allSteps?: Array<{ step: SubStep; processId: string }>
) {
    // 兼容旧数据：如果有 deviceCode 但没有 deviceRequirement，自动构造
    const requirement = step.deviceRequirement || (step.deviceCode ? {
        deviceCode: step.deviceCode,
        exclusiveUse: true
    } : null);

    if (!requirement) {
        // 没有设备需求，跳过, 但记录开始时间（假设它是瞬时的或者不占用资源）
        stepStartTimes.set(step.id, earliestStartTime);
        processedSteps.add(step.id);
        return;
    }

    // 分配设备
    const device = allocateDevice(requirement, devicePool, earliestStartTime, timeline);

    if (!device) {
        warnings.push({
            type: 'DEVICE_CONFLICT',
            severity: 'error',
            message: `步骤 ${step.label} 无法分配设备`,
            relatedStepIds: [step.id],
        });
        // 将其记录为已处理以允许依赖项继续，但带有警告
        stepStartTimes.set(step.id, earliestStartTime);
        processedSteps.add(step.id);
        return;
    }

    // 检查设备是否在 earliestStartTime 可用
    const deviceAvailableTime = getDeviceAvailableTime(device.deviceCode, earliestStartTime, timeline);
    const actualStartTime = Math.max(earliestStartTime, deviceAvailableTime);

    // 计算持续时间
    const duration = getStepDuration(step);

    // 特殊处理：调配步骤需要计算 segments（等待段+最终搅拌段）
    let segments: OccupancySegment[] | undefined;
    let finalEndTime = actualStartTime + duration;
    
    if (step.processType === ProcessType.COMPOUNDING && step.mustAfter && step.mustAfter.length > 0) {
        // 计算所有上游输入步骤的最大结束时间
        // 从 timeline 或 stepStartTimes 中查找依赖步骤的结束时间
        let maxUpstreamEndTime = actualStartTime;
        step.mustAfter.forEach(depId => {
            // 先从 timeline 中查找（已调度的步骤）
            const depOccupancy = timeline.find(o => o.stepId === depId);
            if (depOccupancy) {
                maxUpstreamEndTime = Math.max(maxUpstreamEndTime, depOccupancy.endTime);
            } else {
                // 回退：从 stepStartTimes 计算（假设默认时长）
                const depStartTime = stepStartTimes.get(depId);
                if (depStartTime !== undefined) {
                    const depDuration = allSteps?.find(({ step }) => step.id === depId)?.step 
                        ? getStepDuration(allSteps.find(({ step }) => step.id === depId)!.step)
                        : 10;
                    maxUpstreamEndTime = Math.max(maxUpstreamEndTime, depStartTime + depDuration);
                }
            }
        });

        // 如果上游完成时间晚于设备可用时间，则存在等待段
        if (maxUpstreamEndTime > actualStartTime) {
            const mixStartTime = maxUpstreamEndTime;
            finalEndTime = mixStartTime + duration;

            segments = [
                {
                    kind: 'wait',
                    start: actualStartTime,
                    end: mixStartTime,
                    label: '等待上游完成'
                },
                {
                    kind: 'mix',
                    start: mixStartTime,
                    end: finalEndTime,
                    label: '最终搅拌'
                }
            ];
        } else {
            // 没有等待，直接搅拌
            segments = [
                {
                    kind: 'mix',
                    start: actualStartTime,
                    end: finalEndTime,
                    label: '最终搅拌'
                }
            ];
        }
    }

    // 创建占用记录
    const occupancy: DeviceOccupancy = {
        deviceCode: device.deviceCode,
        stepId: step.id,
        stepLabel: step.label,
        processId,
        startTime: actualStartTime,
        duration: finalEndTime - actualStartTime, // 总占用时长（包含等待）
        endTime: finalEndTime,
        dependencies: step.mustAfter,
        state: 'planned',
        segments,
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
        // 如果请求了特定设备但不可用，我们可能返回 null 或以不同方式处理冲突
        // 目前严格：如果明确请求，必须是该设备。
        // 但是，上面 scheduleStep 中的逻辑在返回设备时会调用 getDeviceAvailableTime。
        // 等等，计划中的 allocateDevice 逻辑略有不同。
        // 计划中的逻辑："if device && isDeviceAvailable... return device"。
        // 这意味着如果它在 startTime 时忙碌，则返回 null。
        // 但实际上我们想找到一个可以使用的设备，即使我们必须等待。
        // 计划中的先前逻辑：
        // "getDeviceAvailableTime" 在 "allocateDevice" 之后调用。
        // 这意味着 "allocateDevice" 应该只找到一个合适的设备候选，
        // 不一定是在 EXACTLY startTime 时空闲的设备。
        // 但是，对于动态分配（按类型），我们可能想选择最早可用的设备。

        // 让我们细化：
        // 如果指定了代码：如果设备存在，只返回该设备。时间线检查稍后确定开始时间。
        if (device) return device;
        return null;
    }

    // 如果只指定了设备类型，查找可用设备
    if (requirement.deviceType) {
        const candidates = findDevicesByType(devicePool, requirement.deviceType);

        // 策略：找到在 startTime 之后最早空闲的候选设备
        let bestCandidate: DeviceResource | null = null;
        let minAvailableTime = Infinity;

        for (const device of candidates) {
            const availableTime = getDeviceAvailableTime(device.deviceCode, startTime, timeline);
            if (availableTime < minAvailableTime) {
                minAvailableTime = availableTime;
                bestCandidate = device;
            }
        }
        return bestCandidate;
    }

    return null;
}

/**
 * 检查设备是否可用（简单的即时可用性检查，在上面的细化逻辑中未使用，但保留以供参考）
 */
function isDeviceAvailable(
    deviceCode: string,
    startTime: number,
    timeline: DeviceOccupancy[]
): boolean {
    // 检查是否有时间冲突
    for (const occupancy of timeline) {
        if (occupancy.deviceCode === deviceCode) {
            // 检查时间是否重叠（计划中的现有逻辑过于简单，让我们只依赖 getDeviceAvailableTime）
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
        .sort((a, b) => a.endTime - b.endTime); // 按结束时间排序

    // 我们需要找到一个间隙或末尾。
    // 为简单起见，现在只追加到末尾。
    // 有能力的调度器会找到间隙。

    if (occupancies.length === 0) {
        return earliestTime;
    }

    const lastOccupancy = occupancies[occupancies.length - 1];
    return Math.max(earliestTime, lastOccupancy.endTime);
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

        // 如果依赖项有设备，它在 endTime 完成。
        // 如果它没有设备（处理步骤？），我们估计了它的持续时间或开始时间。
        // 如果存在占用，使用它的 endTime。
        if (occupancy) {
            maxEndTime = Math.max(maxEndTime, occupancy.endTime);
        } else {
            // 回退：我们存储了开始时间。我们需要持续时间。
            // 我们可能需要存储所有步骤的结束时间，而不仅仅是设备步骤。
            // 现在，如果没有占用，假设默认持续时间
            maxEndTime = Math.max(maxEndTime, startTime + 10);
        }
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
    // 找到结束时间最晚的步骤
    let lastStepId = '';
    let maxEndTime = -1;

    allSteps.forEach(({ step }) => {
        const start = stepStartTimes.get(step.id);
        if (start !== undefined) {
            const end = start + getStepDuration(step);
            if (end > maxEndTime) {
                maxEndTime = end;
                lastStepId = step.id;
            }
        }
    });

    if (!lastStepId) return [];

    const path: string[] = [lastStepId];
    // 回溯？现在只返回结束节点作为标记。
    // 完整的关键路径需要图遍历。
    return path;
}
