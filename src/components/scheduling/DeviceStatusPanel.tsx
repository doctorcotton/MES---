
import { DeviceResource, DeviceState } from '@/types/scheduling';
import { defaultDevicePool } from '@/data/devicePool';

export function DeviceStatusPanel() {
    return (
        <div className="device-status-panel p-4 border-l bg-gray-50 h-full overflow-auto w-64">
            <h3 className="font-bold mb-4 text-gray-700">设备状态</h3>
            <div className="space-y-2">
                {defaultDevicePool.map(device => (
                    <DeviceStatusItem key={device.deviceCode} device={device} />
                ))}
            </div>
        </div>
    );
}

function DeviceStatusItem({ device }: { device: DeviceResource }) {
    const stateColor = {
        [DeviceState.IDLE]: 'bg-green-100 text-green-800',
        [DeviceState.IN_USE]: 'bg-blue-100 text-blue-800',
        [DeviceState.CLEANING]: 'bg-yellow-100 text-yellow-800',
        [DeviceState.MAINTENANCE]: 'bg-red-100 text-red-800',
        [DeviceState.FAULT]: 'bg-red-200 text-red-900',
        [DeviceState.RESERVED]: 'bg-gray-100 text-gray-800',
    }[device.currentState || DeviceState.IDLE];

    return (
        <div className="flex flex-col p-2 bg-white rounded shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">{device.displayName}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stateColor}`}>
                    {device.currentState || DeviceState.IDLE}
                </span>
            </div>
            <div className="text-xs text-gray-500 truncate">
                {device.deviceCode}
            </div>
            {device.capacity && (
                <div className="text-xs text-gray-400 mt-1">
                    容量: {device.capacity.value}{device.capacity.unit}
                </div>
            )}
        </div>
    );
}
