import { useMemo, useState, useRef, useEffect } from 'react';
import { useRecipeStore } from '@/store/useRecipeStore';
import { calculateScheduleWithContext } from '@/services/scheduler';
import { DeviceOccupancy, ConfigurationLevel } from '@/types/scheduling';
import { Process } from '@/types/recipe';
import { defaultDevicePool } from '@/data/devicePool';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { factoryConfigService } from '@/services/factoryConfigService';

// 计算时间轴参数
function calculateTimeAxisParams(containerWidth: number, maxTime: number, zoomLevel: number) {
    // 可用宽度（减去设备列宽度和padding）
    const availableWidth = containerWidth - 200; // 设备列约192px + padding
    
    // 1. 计算理想的时间单位宽度（每个分钟占用的像素）
    const minUnitWidth = 2; // 最小单位宽度（px/分钟），确保可读性
    const maxUnitWidth = 10; // 最大单位宽度（px/分钟），避免过度拉伸
    const idealUnitWidth = Math.max(
        minUnitWidth,
        Math.min(maxUnitWidth, availableWidth / maxTime * zoomLevel)
    );
    
    // 2. 根据时间范围自动选择标签间隔
    let labelInterval: number;
    if (maxTime <= 30) {
        labelInterval = 5; // 30分钟以内：每5分钟一个标签
    } else if (maxTime <= 60) {
        labelInterval = 10; // 60分钟以内：每10分钟一个标签
    } else if (maxTime <= 120) {
        labelInterval = 20; // 120分钟以内：每20分钟一个标签
    } else {
        labelInterval = 30; // 超过120分钟：每30分钟一个标签
    }
    
    // 3. 确保标签数量适中（5-15个）
    const estimatedLabelCount = maxTime / labelInterval;
    if (estimatedLabelCount > 15) {
        // 标签太多，增大间隔
        labelInterval = Math.ceil(maxTime / 15 / 5) * 5; // 向上取整到5的倍数
    } else if (estimatedLabelCount < 5 && maxTime > 20) {
        // 标签太少，减小间隔
        labelInterval = Math.max(5, Math.floor(maxTime / 10 / 5) * 5);
    }
    
    // 4. 网格间隔（始终是标签间隔的一半，提供更细的参考线）
    const gridInterval = labelInterval / 2;
    
    return {
        unitWidth: idealUnitWidth,
        labelInterval,
        gridInterval,
        totalWidth: maxTime * idealUnitWidth
    };
}

export function GanttView() {
    const { processes, edges, setHoveredNodeId } = useRecipeStore();
    const [zoomLevel, setZoomLevel] = useState(1); // 1 = 100%, 2 = 200%
    const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
    const [containerWidth, setContainerWidth] = useState(800); // 默认宽度
    const timeAxisContainerRef = useRef<HTMLDivElement>(null);

    // 视图模式状态
    const [viewMode, setViewMode] = useState<'recipe' | 'production'>('recipe');
    const [selectedLineId, setSelectedLineId] = useState<string | null>(null);

    // 初始化工厂配置服务
    useMemo(() => {
        factoryConfigService.initialize();
    }, []);

    // 获取所有产线配置
    const productionLines = useMemo(() => {
        return factoryConfigService.getAllProductionLines();
    }, []);

    // 根据视图模式创建设备配置上下文
    const deviceContext = useMemo(() => {
        if (viewMode === 'recipe') {
            return factoryConfigService.createDeviceContext(ConfigurationLevel.RECIPE);
        } else if (viewMode === 'production' && selectedLineId) {
            return factoryConfigService.createDeviceContext(
                ConfigurationLevel.PRODUCTION_LINE,
                selectedLineId
            );
        }
        // 默认返回研发视图
        return factoryConfigService.createDeviceContext(ConfigurationLevel.RECIPE);
    }, [viewMode, selectedLineId]);

    // 计算调度结果（使用设备配置上下文）
    // 添加 processes 顺序签名作为依赖，确保顺序变化时重新计算
    const processOrderSignature = useMemo(() => processes.map(p => p.id).join(','), [processes]);
    const edgesSignature = useMemo(() => edges.map(e => `${e.source}-${e.target}`).join(','), [edges]);
    const scheduleResult = useMemo(() => {
        return calculateScheduleWithContext(processes, deviceContext, edges);
    }, [processes, processOrderSignature, deviceContext, edges, edgesSignature]);

    // 获取所有设备（严格按表格JSON的首次出现顺序）
    // 过滤掉不在范围内的设备：UHT机、灌装机、管道过滤器1等
    const excludedDevices = new Set(['UHT机', '灌装机', '管道过滤器1']);
    
    const devices = useMemo(() => {
        // 第一优先：从表格JSON（processes → subSteps）按首次出现顺序提取设备
        const orderedDevicesFromTable: string[] = [];
        const seenDevices = new Set<string>();
        
        // 按照 processes 数组顺序遍历
        processes.forEach(process => {
            // 按照 order 字段排序子步骤
            const sortedSteps = [...process.node.subSteps].sort((a, b) => a.order - b.order);
            
            sortedSteps.forEach(step => {
                // 获取设备编号（优先从 deviceRequirement 获取）
                const deviceCode = step.deviceRequirement?.deviceCode || step.deviceCode;
                if (deviceCode && !seenDevices.has(deviceCode) && !excludedDevices.has(deviceCode)) {
                    // 首次出现，添加到顺序列表
                    orderedDevicesFromTable.push(deviceCode);
                    seenDevices.add(deviceCode);
                }
            });
        });
        
        // 第二优先：从 timeline 中找出不在表格顺序中的设备（例如按类型动态分配出来的）
        const devicesFromTimeline = new Set<string>();
        scheduleResult.timeline.forEach(occupancy => {
            if (!excludedDevices.has(occupancy.deviceCode) && !seenDevices.has(occupancy.deviceCode)) {
                devicesFromTimeline.add(occupancy.deviceCode);
            }
        });
        
        // 追加到末尾（按timeline中出现的顺序）
        const allocatedDevices = Array.from(devicesFromTimeline);
        allocatedDevices.forEach(deviceCode => {
            orderedDevicesFromTable.push(deviceCode);
            seenDevices.add(deviceCode);
        });
        
        // 最后：追加设备池中剩余的空行占位（确保相关设备在甘特图有行位）
        defaultDevicePool.forEach(d => {
            if (!seenDevices.has(d.deviceCode) && !excludedDevices.has(d.deviceCode)) {
                orderedDevicesFromTable.push(d.deviceCode);
                seenDevices.add(d.deviceCode);
            }
        });
        
        return orderedDevicesFromTable;
    }, [processes, scheduleResult]);

    // 计算时间范围（自适应，不再硬截断80分钟）
    const maxTime = useMemo(() => {
        const calculatedMax = Math.max(...scheduleResult.timeline.map(o => o.endTime), 60);
        // 向上取整到最近的10分钟，并添加10%的边距
        const roundedMax = Math.ceil(calculatedMax / 10) * 10;
        return Math.max(roundedMax + 10, 60); // 至少60分钟，添加10分钟边距
    }, [scheduleResult]);

    // 监听容器宽度变化
    useEffect(() => {
        const container = timeAxisContainerRef.current;
        if (!container) return;

        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setContainerWidth(entry.contentRect.width);
            }
        });

        resizeObserver.observe(container);
        return () => resizeObserver.disconnect();
    }, []);

    // 计算时间轴参数
    const timeAxisParams = useMemo(() => {
        return calculateTimeAxisParams(containerWidth, maxTime, zoomLevel);
    }, [containerWidth, maxTime, zoomLevel]);

    // 处理占用块点击
    const handleOccupancyClick = (stepId: string) => {
        setSelectedStepId(stepId);
        setHoveredNodeId(stepId);

        // 滚动到对应的表格行
        const rowElement = document.getElementById(`row-${stepId}`);
        if (rowElement) {
            rowElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    };

    // 缩放控制
    const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.5, 3));
    const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.5, 0.5));

    return (
        <div className="gantt-view h-full overflow-auto flex flex-col">
            {/* 工具栏 */}
            <div className="gantt-toolbar border-b p-2 bg-gray-50 flex items-center justify-between sticky top-0 z-20">
                <div className="flex items-center gap-4">
                    <div className="text-sm font-medium text-gray-700">设备甘特图</div>

                    {/* 视图模式切换 */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">视图:</span>
                        <Select value={viewMode} onValueChange={(value: 'recipe' | 'production') => setViewMode(value)}>
                            <SelectTrigger className="h-8 w-28">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="recipe">研发视图</SelectItem>
                                <SelectItem value="production">生产视图</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* 产线选择器（仅生产视图） */}
                    {viewMode === 'production' && (
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">产线:</span>
                            <Select
                                value={selectedLineId || ''}
                                onValueChange={(value) => setSelectedLineId(value || null)}
                            >
                                <SelectTrigger className="h-8 w-40">
                                    <SelectValue placeholder="选择产线" />
                                </SelectTrigger>
                                <SelectContent>
                                    {productionLines.map(line => (
                                        <SelectItem key={line.id} value={line.id}>
                                            {line.factoryName} - {line.lineName}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>

                {/* 缩放控制 */}
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">缩放:</span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleZoomOut}
                        disabled={zoomLevel <= 0.5}
                        className="h-7 w-7 p-0"
                    >
                        <ZoomOut className="h-4 w-4" />
                    </Button>
                    <span className="text-xs text-gray-600 w-12 text-center">{Math.round(zoomLevel * 100)}%</span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleZoomIn}
                        disabled={zoomLevel >= 3}
                        className="h-7 w-7 p-0"
                    >
                        <ZoomIn className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <div className="gantt-header sticky top-12 bg-white z-10 border-b">
                <div className="flex">
                    <div className="w-48 border-r p-2 font-bold flex-shrink-0 bg-gray-50">设备</div>
                    <div 
                        ref={timeAxisContainerRef}
                        className="flex-1 relative overflow-hidden" 
                        style={{ minWidth: `${timeAxisParams.totalWidth}px` }}
                    >
                        {/* 时间轴 */}
                        <div className="flex h-8">
                            {Array.from({ length: Math.ceil(maxTime / timeAxisParams.labelInterval) + 1 }, (_, i) => {
                                const timeLabel = i * timeAxisParams.labelInterval;
                                if (timeLabel > maxTime) return null;
                                return (
                                    <div 
                                        key={i} 
                                        className="border-l p-1 text-xs text-gray-500 box-border" 
                                        style={{ width: `${timeAxisParams.unitWidth * timeAxisParams.labelInterval}px`, flexShrink: 0 }}
                                    >
                                        {timeLabel}
                                    </div>
                                );
                            })}
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
                        timeAxisParams={timeAxisParams}
                        selectedStepId={selectedStepId}
                        onOccupancyClick={handleOccupancyClick}
                        processes={processes}
                    />
                ))}
            </div>

            {/* 统计信息 */}
            <div className="gantt-footer border-t p-4 bg-gray-50 sticky bottom-0">
                <div className="text-sm flex items-center gap-4 flex-wrap">
                    <span className="font-medium">
                        {viewMode === 'recipe' ? '研发视图' : '生产视图'}
                        {viewMode === 'production' && selectedLineId && (
                            <span className="text-blue-600 ml-1">
                                ({productionLines.find(l => l.id === selectedLineId)?.factoryName} - {productionLines.find(l => l.id === selectedLineId)?.lineName})
                            </span>
                        )}
                    </span>
                    <span>总耗时: {scheduleResult.totalDuration.toFixed(1)} 分钟（溶解+调配过程）</span>
                    {scheduleResult.timeline.filter(o => o.duration > 50).length > 0 && (
                        <span className="text-red-600">
                            超过50分钟: {scheduleResult.timeline.filter(o => o.duration > 50).length} 个
                        </span>
                    )}
                    {scheduleResult.warnings.length > 0 && (
                        <span className="text-red-600">
                            警告: {scheduleResult.warnings.length} 个
                        </span>
                    )}
                    {selectedStepId && (
                        <span className="text-blue-600">
                            已选择: {scheduleResult.timeline.find(o => o.stepId === selectedStepId)?.stepLabel}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

// 构建 tooltip 文本（无 segments）
function buildTooltip(occupancy: DeviceOccupancy, isLongDuration: boolean, hasEstimatedDuration: boolean = true): string {
    const parts = [
        `${occupancy.stepLabel}`,
        `总占用: ${occupancy.duration}分钟`,
        `[${occupancy.startTime}-${occupancy.endTime}]`
    ];
    if (!hasEstimatedDuration) {
        parts.push('⚠️ 未填预计耗时，按1显示（仅表达先后/并行）');
    }
    if (isLongDuration) {
        parts.push('⚠️ 超过50分钟');
    }
    return parts.join(' | ');
}

// 构建 tooltip 文本（有 segments）
function buildSegmentsTooltip(occupancy: DeviceOccupancy, isLongDuration: boolean, hasEstimatedDuration: boolean = true): string {
    const parts = [
        `${occupancy.stepLabel}`,
        `总占用: ${occupancy.duration}分钟`,
        `[${occupancy.startTime}-${occupancy.endTime}]`
    ];
    
    if (!hasEstimatedDuration) {
        parts.push('⚠️ 未填预计耗时，按1显示（仅表达先后/并行）');
    }
    
    if (occupancy.segments && occupancy.segments.length > 0) {
        occupancy.segments.forEach((segment) => {
            const segmentDuration = segment.end - segment.start;
            parts.push(`${segment.label || segment.kind}: ${segmentDuration.toFixed(1)}分钟 [${segment.start}-${segment.end}]`);
        });
    }
    
    if (isLongDuration) {
        parts.push('⚠️ 超过50分钟');
    }
    
    return parts.join('\n');
}

function GanttRow({
    deviceCode,
    occupancies,
    maxTime,
    timeAxisParams,
    selectedStepId,
    onOccupancyClick,
    processes,
}: {
    deviceCode: string;
    occupancies: DeviceOccupancy[];
    maxTime: number;
    timeAxisParams: { unitWidth: number; labelInterval: number; gridInterval: number; totalWidth: number };
    selectedStepId: string | null;
    onOccupancyClick: (stepId: string) => void;
    processes: Process[];
}) {
    return (
        <div className="gantt-row flex border-b h-12">
            <div className="w-48 border-r p-2 flex items-center text-sm font-medium truncate flex-shrink-0 bg-white" title={deviceCode}>
                {deviceCode}
            </div>
            <div className="flex-1 relative" style={{ minWidth: `${timeAxisParams.totalWidth}px` }}>
                {/* 时间线背景grid */}
                <div className="absolute inset-0 flex pointer-events-none">
                    {Array.from({ length: Math.ceil(maxTime / timeAxisParams.gridInterval) + 1 }, (_, i) => {
                        const timeLabel = i * timeAxisParams.gridInterval;
                        if (timeLabel > maxTime) return null;
                        return (
                            <div 
                                key={i} 
                                className="border-l border-gray-100 h-full box-border" 
                                style={{ width: `${timeAxisParams.unitWidth * timeAxisParams.gridInterval}px`, flexShrink: 0 }} 
                            />
                        );
                    })}
                </div>

                {/* 占用块 */}
                {occupancies.map(occupancy => {
                    const isSelected = selectedStepId === occupancy.stepId;
                    // 超过50分钟的任务标红
                    const isLongDuration = occupancy.duration > 50;
                    const shouldBeRed = occupancy.state === 'delayed' || isLongDuration;
                    
                    // 检查步骤是否有预计耗时
                    const step = processes
                        .find(p => p.id === occupancy.processId)
                        ?.node.subSteps.find(s => s.id === occupancy.stepId);
                    const hasEstimatedDuration = step?.estimatedDuration?.value !== undefined && step.estimatedDuration.value > 0;
                    
                    // 如果有 segments，渲染分段
                    if (occupancy.segments && occupancy.segments.length > 0) {
                        return (
                            <div
                                key={occupancy.stepId}
                                className={`absolute cursor-pointer transition-all shadow-sm
                                    ${isSelected ? 'ring-2 ring-yellow-400 ring-offset-1 opacity-100 z-10' : 'hover:opacity-90'}
                                `}
                                style={{
                                    left: `${(occupancy.startTime / maxTime) * 100}%`,
                                    width: `${(occupancy.duration / maxTime) * 100}%`,
                                    minWidth: '2px',
                                    top: '4px',
                                    bottom: '4px',
                                }}
                                title={buildSegmentsTooltip(occupancy, isLongDuration, hasEstimatedDuration)}
                                onClick={() => onOccupancyClick(occupancy.stepId)}
                            >
                                {occupancy.segments.map((segment, idx) => {
                                    const segmentLeft = ((segment.start - occupancy.startTime) / occupancy.duration) * 100;
                                    const segmentWidth = ((segment.end - segment.start) / occupancy.duration) * 100;
                                    const isWait = segment.kind === 'wait';
                                    return (
                                        <div
                                            key={idx}
                                            className={`absolute h-full text-xs p-1 rounded overflow-hidden whitespace-nowrap text-white
                                                ${isWait 
                                                    ? 'bg-gray-400 opacity-70' 
                                                    : shouldBeRed ? 'bg-red-500' : 'bg-blue-500'
                                                }
                                            `}
                                            style={{
                                                left: `${segmentLeft}%`,
                                                width: `${segmentWidth}%`,
                                                height: '100%',
                                            }}
                                        >
                                            {segmentWidth > 5 && segment.label && (
                                                <span className="text-[10px]">{segment.label}</span>
                                            )}
                                        </div>
                                    );
                                })}
                                {/* 显示步骤标签（在最上层） */}
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <span className="text-xs font-medium text-white drop-shadow-md">
                                        {occupancy.stepLabel}
                                    </span>
                                </div>
                            </div>
                        );
                    }
                    
                    // 没有 segments，使用原来的渲染方式
                    return (
                        <div
                            key={occupancy.stepId}
                            className={`absolute text-xs p-1 rounded cursor-pointer overflow-hidden whitespace-nowrap text-white transition-all shadow-sm
                                ${shouldBeRed ? 'bg-red-500' : 'bg-blue-500'}
                                ${isSelected ? 'ring-2 ring-yellow-400 ring-offset-1 opacity-100 z-10' : 'hover:opacity-90'}
                            `}
                            style={{
                                left: `${(occupancy.startTime / maxTime) * 100}%`,
                                width: `${(occupancy.duration / maxTime) * 100}%`,
                                minWidth: '2px',
                                top: '4px',
                                bottom: '4px',
                            }}
                            title={buildTooltip(occupancy, isLongDuration, hasEstimatedDuration)}
                            onClick={() => onOccupancyClick(occupancy.stepId)}
                        >
                            {occupancy.stepLabel}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
