import { DeviceResource, DeviceState } from '@/types/scheduling';
import { DeviceType } from '@/types/equipment';

/**
 * 研发视图默认设备资源池
 * 默认配置：2个高搅桶、1个调配桶，以及前段关键设备
 */
export const defaultDevicePool: DeviceResource[] = [
    {
        deviceCode: "高搅桶1",
        deviceType: DeviceType.HIGH_SPEED_MIXER,
        displayName: "高速搅拌桶#1",
        capacity: { value: 2000, unit: 'L' },
        currentState: DeviceState.IDLE,
    },
    {
        deviceCode: "高搅桶2",
        deviceType: DeviceType.HIGH_SPEED_MIXER,
        displayName: "高速搅拌桶#2",
        capacity: { value: 2000, unit: 'L' },
        currentState: DeviceState.IDLE,
    },
    {
        deviceCode: "调配桶",
        deviceType: DeviceType.MIXING_TANK,
        displayName: "主调配桶",
        capacity: { value: 5000, unit: 'L' },
        currentState: DeviceState.IDLE,
    },
    {
        deviceCode: "人工",
        deviceType: DeviceType.OTHER,
        displayName: "人工操作",
        currentState: DeviceState.IDLE,
    },
    {
        deviceCode: "萃茶釜1",
        deviceType: DeviceType.OTHER,
        displayName: "萃茶釜#1",
        capacity: { value: 1000, unit: 'L' },
        currentState: DeviceState.IDLE,
    },
    {
        deviceCode: "暂存桶1",
        deviceType: DeviceType.ASEPTIC_TANK,
        displayName: "暂存桶#1",
        capacity: { value: 3000, unit: 'L' },
        currentState: DeviceState.IDLE,
    },
    {
        deviceCode: "离心机1",
        deviceType: DeviceType.OTHER,
        displayName: "离心机#1",
        currentState: DeviceState.IDLE,
    },
    {
        deviceCode: "膜过滤1",
        deviceType: DeviceType.FILTER,
        displayName: "膜过滤#1",
        specifications: [
            { name: "filterPrecision", value: 0.1, unit: "μm" },
        ],
        currentState: DeviceState.IDLE,
    },
    // 以下设备不在甘特图显示范围，但保留在设备池中用于依赖计算
    {
        deviceCode: "管道过滤器1",
        deviceType: DeviceType.FILTER,
        displayName: "管道过滤器#1",
        specifications: [
            { name: "filterPrecision", value: 0.5, unit: "μm" },
        ],
        currentState: DeviceState.IDLE,
    },
    {
        deviceCode: "UHT机",
        deviceType: DeviceType.UHT_MACHINE,
        displayName: "UHT灭菌机",
        currentState: DeviceState.IDLE,
    },
    {
        deviceCode: "灌装机",
        deviceType: DeviceType.FILLING_MACHINE,
        displayName: "无菌灌装机",
        currentState: DeviceState.IDLE,
    },
];

/**
 * 根据设备类型查找设备
 */
export function findDevicesByType(
    devicePool: DeviceResource[],
    deviceType: DeviceType
): DeviceResource[] {
    return devicePool.filter(device => device.deviceType === deviceType);
}

/**
 * 根据设备编号查找设备
 */
export function findDeviceByCode(
    devicePool: DeviceResource[],
    deviceCode: string
): DeviceResource | undefined {
    return devicePool.find(device => device.deviceCode === deviceCode);
}
