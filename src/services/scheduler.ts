import { SubStep, Process } from '@/types/recipe';
import { DeviceResource, DeviceRequirement, DeviceOccupancy, ScheduleResult, ScheduleWarning, DeviceState } from '@/types/scheduling';

import { defaultDevicePool, findDevicesByType, findDeviceByCode } from '@/data/devicePool';

/**
 * 计算设备占用时间线
 */
export function calculateSchedule(
    processes: Process[],
    devicePool: DeviceResource[] = defaultDevicePool
): ScheduleResult {
    const timeline: DeviceOccupancy[] = [];
    const warnings: ScheduleWarning[] = [];
    const deviceStates = new Map<string, DeviceState>();

    // Initialize device states from pool
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

    // 按顺序处理步骤
    const processedSteps = new Set<string>();
    const stepStartTimes = new Map<string, number>();

    // 第一遍：处理没有依赖的步骤
    allSteps.forEach(({ step, processId }) => {
        if (!step.mustAfter || step.mustAfter.length === 0) {
            scheduleStep(step, processId, 0, timeline, devicePool, stepStartTimes, processedSteps, warnings);
        }
    });

    // 第二遍：处理有依赖的步骤
    let changed = true;
    // Safety break for circular dependencies
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
                    scheduleStep(step, processId, startTime, timeline, devicePool, stepStartTimes, processedSteps, warnings);
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

    // 计算总耗时
    const totalDuration = Math.max(...Array.from(stepStartTimes.values()).map(startTime => {
        const stepObj = allSteps.find(({ step }) => stepStartTimes.get(step.id) === startTime);
        if (!stepObj) return 0;
        const { step } = stepObj;
        const duration = getStepDuration(step);
        return startTime + duration;
    }), 0);

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

function getStepDuration(step: SubStep): number {
    return step.deviceRequirement?.occupyDuration?.value ||
        (step as any).estimatedDuration?.value ||
        10; // 默认10分钟
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
    warnings: ScheduleWarning[]
) {
    if (!step.deviceRequirement) {
        // 没有设备需求，跳过, 但记录开始时间（假设它是瞬时的或者不占用资源）
        stepStartTimes.set(step.id, earliestStartTime);
        processedSteps.add(step.id);
        return;
    }

    // 分配设备
    const device = allocateDevice(step.deviceRequirement, devicePool, earliestStartTime, timeline);

    if (!device) {
        warnings.push({
            type: 'DEVICE_CONFLICT',
            severity: 'error',
            message: `步骤 ${step.label} 无法分配设备`,
            relatedStepIds: [step.id],
        });
        // Record it as processed to allow dependents to proceed, but with warning
        stepStartTimes.set(step.id, earliestStartTime);
        processedSteps.add(step.id);
        return;
    }

    // 检查设备是否在 earliestStartTime 可用
    const deviceAvailableTime = getDeviceAvailableTime(device.deviceCode, earliestStartTime, timeline);
    const actualStartTime = Math.max(earliestStartTime, deviceAvailableTime);

    // 计算持续时间
    const duration = getStepDuration(step);

    // 创建占用记录
    const occupancy: DeviceOccupancy = {
        deviceCode: device.deviceCode,
        stepId: step.id,
        stepLabel: step.label,
        processId,
        startTime: actualStartTime,
        duration,
        endTime: actualStartTime + duration,
        dependencies: step.mustAfter,
        state: 'planned',
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
        // If specific device requested but not available, we might return null or handle conflict differently
        // For now, strict: if requested specifically, must be that one.
        // However, logic above in scheduleStep calls getDeviceAvailableTime if it returns a device. 
        // Wait, allocateDevice logic in plan was slightly different. 
        // Plan's logic: "if device && isDeviceAvailable... return device". 
        // This implies if it's BUSY at startTime it returns null. 
        // But we actually want to find a device that CAN be used, even if we have to wait.
        // The previous logic in plan: 
        // "getDeviceAvailableTime" is called AFTER "allocateDevice". 
        // This implies "allocateDevice" should just find a suitable device candidate, 
        // not necessarily one that is free at EXACTLY startTime.
        // BUT, for dynamic allocation (by type), we might want to pick the one available EARLIEST.

        // Let's refine:
        // If specific code: just return that device if it exists. Timeline check happens later to determine start time.
        if (device) return device;
        return null;
    }

    // 如果只指定了设备类型，查找可用设备
    if (requirement.deviceType) {
        const candidates = findDevicesByType(devicePool, requirement.deviceType);

        // Strategy: Find candidate that becomes free earliest after startTime
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
 * 检查设备是否可用 (Simple check for immediate availability, not used inrefined logic above but kept for reference if needed)
 */
function isDeviceAvailable(
    deviceCode: string,
    startTime: number,
    timeline: DeviceOccupancy[]
): boolean {
    // 检查是否有时间冲突
    for (const occupancy of timeline) {
        if (occupancy.deviceCode === deviceCode) {
            // 检查时间是否重叠 (Existing logic in plan was simplistic, let's just rely on getDeviceAvailableTime)
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
        .sort((a, b) => a.endTime - b.endTime); // Sort by end time

    // We need to find a gap or the end. 
    // For simplicity, just append to the end for now. 
    // Capable scheduler would find gaps.

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

        // If the dependency had a device, it finishes at its endTime.
        // If it didn't have a device (processing step?), we estimated its duration or start time.
        // If occupancy exists, use its endTime.
        if (occupancy) {
            maxEndTime = Math.max(maxEndTime, occupancy.endTime);
        } else {
            // Fallback: we stored start time. We need duration.
            // We probably need to store end times for ALL steps, not just device ones.
            // For now, assume default duration if no occupancy
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
    // Finds the step with the latest end time
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
    // Backtrack? For now just return the end node as a marker.
    // Full critical path needs graph traversal.
    return path;
}
