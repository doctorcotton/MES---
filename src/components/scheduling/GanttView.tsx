import { useMemo } from 'react';
import { useRecipeStore } from '@/store/useRecipeStore';
import { calculateSchedule } from '@/services/scheduler';
import { DeviceOccupancy } from '@/types/scheduling';
import { defaultDevicePool } from '@/data/devicePool';

export function GanttView() {
    const { processes } = useRecipeStore();

    // 计算调度结果
    const scheduleResult = useMemo(() => {
        return calculateSchedule(processes);
    }, [processes]);

    // 获取所有设备
    const devices = useMemo(() => {
        const deviceSet = new Set<string>();
        scheduleResult.timeline.forEach(occupancy => {
            deviceSet.add(occupancy.deviceCode);
        });
        // Add devices from pool even if empty
        defaultDevicePool.forEach(d => deviceSet.add(d.deviceCode));
        return Array.from(deviceSet).sort();
    }, [scheduleResult]);

    // 计算时间范围
    const maxTime = useMemo(() => {
        return Math.max(...scheduleResult.timeline.map(o => o.endTime), 60); // Min 60 mins
    }, [scheduleResult]);

    return (
        <div className="gantt-view h-full overflow-auto flex flex-col">
            <div className="gantt-header sticky top-0 bg-white z-10 border-b">
                <div className="flex">
                    <div className="w-48 border-r p-2 font-bold flex-shrink-0 bg-gray-50">设备</div>
                    <div className="flex-1 relative overflow-hidden" style={{ minWidth: `${maxTime * 2}px` }}>
                        {/* 时间轴 */}
                        <div className="flex h-8">
                            {Array.from({ length: Math.ceil(maxTime / 10) + 1 }, (_, i) => (
                                <div key={i} className="border-l p-1 text-xs text-gray-500 box-border" style={{ width: '20px', flexShrink: 0 }}>
                                    {i * 10}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="gantt-body flex-1">
                {devices.map(deviceCode => (
                    <GanttRow
                        key={deviceCode}
                        deviceCode={deviceCode}
                        occupancies={scheduleResult.timeline.filter(o => o.deviceCode === deviceCode)}
                        maxTime={maxTime}
                    />
                ))}
            </div>

            {/* 统计信息 */}
            <div className="gantt-footer border-t p-4 bg-gray-50 sticky bottom-0">
                <div className="text-sm">
                    <span>总耗时: {scheduleResult.totalDuration} 分钟</span>
                    {scheduleResult.warnings.length > 0 && (
                        <span className="ml-4 text-red-600">
                            警告: {scheduleResult.warnings.length} 个
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

function GanttRow({
    deviceCode,
    occupancies,
    maxTime,
}: {
    deviceCode: string;
    occupancies: DeviceOccupancy[];
    maxTime: number;
}) {
    return (
        <div className="gantt-row flex border-b h-12">
            <div className="w-48 border-r p-2 flex items-center text-sm font-medium truncate flex-shrink-0 bg-white" title={deviceCode}>
                {deviceCode}
            </div>
            <div className="flex-1 relative" style={{ minWidth: `${maxTime * 2}px` }}>
                {/* 时间线背景grid */}
                <div className="absolute inset-0 flex pointer-events-none">
                    {Array.from({ length: Math.ceil(maxTime / 10) + 1 }, (_, i) => (
                        <div key={i} className="border-l border-gray-100 h-full box-border" style={{ width: '20px', flexShrink: 0 }} />
                    ))}
                </div>

                {/* 占用块 */}
                {occupancies.map(occupancy => (
                    <div
                        key={occupancy.stepId}
                        className={`absolute text-xs p-1 rounded cursor-pointer overflow-hidden whitespace-nowrap text-white transition-opacity hover:opacity-90 shadow-sm
                ${occupancy.state === 'delayed' ? 'bg-red-500' : 'bg-blue-500'}
            `}
                        style={{
                            left: `${(occupancy.startTime / maxTime) * 100}%`,
                            width: `${(occupancy.duration / maxTime) * 100}%`,
                            minWidth: '2px', // Ensure visible even if short
                            top: '4px',
                            bottom: '4px',
                        }}
                        title={`${occupancy.stepLabel} (${occupancy.duration}分钟) [${occupancy.startTime}-${occupancy.endTime}]`}
                    >
                        {occupancy.stepLabel}
                    </div>
                ))}
            </div>
        </div>
    );
}
