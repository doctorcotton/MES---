import { ProductionLineConfig, FactoryConfig, DeviceConfigContext, ConfigurationLevel, DeviceUsageMode, DeviceState } from '@/types/scheduling';
import { DeviceType } from '@/types/equipment';
import { defaultDevicePool } from '@/data/devicePool';

/**
 * 工厂配置管理服务
 */
export class FactoryConfigService {
    private factories: Map<string, FactoryConfig> = new Map();

    /**
     * 初始化默认配置
     */
    initialize() {
        // 创建示例配置：天津厂一线
        const tianjinLine1: ProductionLineConfig = {
            id: "tianjin-line1",
            factoryName: "天津厂",
            lineName: "一线",
            devicePool: [
                {
                    deviceCode: "TJ-L1-高搅桶1",
                    deviceType: DeviceType.HIGH_SPEED_MIXER,
                    displayName: "天津一线-高搅桶#1",
                    capacity: { value: 2000, unit: 'L' },
                    usageMode: DeviceUsageMode.PRIMARY,
                    currentState: DeviceState.IDLE,
                },
                {
                    deviceCode: "TJ-L1-高搅桶2",
                    deviceType: DeviceType.HIGH_SPEED_MIXER,
                    displayName: "天津一线-高搅桶#2",
                    capacity: { value: 2000, unit: 'L' },
                    usageMode: DeviceUsageMode.PRIMARY,
                    currentState: DeviceState.IDLE,
                },
                {
                    deviceCode: "TJ-L1-高搅桶3",
                    deviceType: DeviceType.HIGH_SPEED_MIXER,
                    displayName: "天津一线-高搅桶#3（备用）",
                    capacity: { value: 2000, unit: 'L' },
                    usageMode: DeviceUsageMode.BACKUP,
                    currentState: DeviceState.IDLE,
                },
                {
                    deviceCode: "TJ-L1-调配桶",
                    deviceType: DeviceType.MIXING_TANK,
                    displayName: "天津一线-调配桶",
                    capacity: { value: 5000, unit: 'L' },
                    usageMode: DeviceUsageMode.PRIMARY,
                    currentState: DeviceState.IDLE,
                },
                {
                    deviceCode: "TJ-L1-过滤器1",
                    deviceType: DeviceType.FILTER,
                    displayName: "天津一线-过滤器#1",
                    specifications: [
                        { name: "filterPrecision", value: 0.5, unit: "μm" },
                    ],
                    usageMode: DeviceUsageMode.PRIMARY,
                    currentState: DeviceState.IDLE,
                },
            ],
            missingDeviceTypes: [],
            deviceMapping: {
                "高搅桶1": "TJ-L1-高搅桶1",
                "高搅桶2": "TJ-L1-高搅桶2",
                "调配桶": "TJ-L1-调配桶",
                "管道过滤器1": "TJ-L1-过滤器1",
            },
            description: "天津工厂一号生产线，配备3个高搅桶（2个常用+1个备用）",
            enabled: true,
        };

        const tianjinFactory: FactoryConfig = {
            id: "tianjin",
            name: "天津厂",
            location: "天津市",
            productionLines: [tianjinLine1],
            enabled: true,
        };

        this.factories.set("tianjin", tianjinFactory);

        // 创建示例配置：上海厂二线
        const shanghaiLine2: ProductionLineConfig = {
            id: "shanghai-line2",
            factoryName: "上海厂",
            lineName: "二线",
            devicePool: [
                {
                    deviceCode: "SH-L2-高搅桶A",
                    deviceType: DeviceType.HIGH_SPEED_MIXER,
                    displayName: "上海二线-高搅桶A",
                    capacity: { value: 1500, unit: 'L' },
                    usageMode: DeviceUsageMode.PRIMARY,
                    currentState: DeviceState.IDLE,
                },
                {
                    deviceCode: "SH-L2-高搅桶B",
                    deviceType: DeviceType.HIGH_SPEED_MIXER,
                    displayName: "上海二线-高搅桶B",
                    capacity: { value: 1500, unit: 'L' },
                    usageMode: DeviceUsageMode.PRIMARY,
                    currentState: DeviceState.IDLE,
                },
                {
                    deviceCode: "SH-L2-调配桶",
                    deviceType: DeviceType.MIXING_TANK,
                    displayName: "上海二线-调配桶",
                    capacity: { value: 4000, unit: 'L' },
                    usageMode: DeviceUsageMode.PRIMARY,
                    currentState: DeviceState.IDLE,
                },
            ],
            missingDeviceTypes: [DeviceType.FILTER], // 上海厂二线没有过滤器
            deviceMapping: {
                "高搅桶1": "SH-L2-高搅桶A",
                "高搅桶2": "SH-L2-高搅桶B",
                "调配桶": "SH-L2-调配桶",
            },
            description: "上海工厂二号生产线，设备容量较小，无过滤器",
            enabled: true,
        };

        const shanghaiFactory: FactoryConfig = {
            id: "shanghai",
            name: "上海厂",
            location: "上海市",
            productionLines: [shanghaiLine2],
            enabled: true,
        };

        this.factories.set("shanghai", shanghaiFactory);
    }

    /**
     * 获取所有工厂
     */
    getAllFactories(): FactoryConfig[] {
        return Array.from(this.factories.values());
    }

    /**
     * 获取工厂
     */
    getFactory(factoryId: string): FactoryConfig | undefined {
        return this.factories.get(factoryId);
    }

    /**
     * 获取产线配置
     */
    getProductionLine(lineId: string): ProductionLineConfig | undefined {
        for (const factory of this.factories.values()) {
            const line = factory.productionLines.find(l => l.id === lineId);
            if (line) return line;
        }
        return undefined;
    }

    /**
     * 获取所有产线配置
     */
    getAllProductionLines(): ProductionLineConfig[] {
        const lines: ProductionLineConfig[] = [];
        for (const factory of this.factories.values()) {
            lines.push(...factory.productionLines);
        }
        return lines;
    }

    /**
     * 创建设备配置上下文
     */
    createDeviceContext(
        level: ConfigurationLevel,
        lineId?: string
    ): DeviceConfigContext {
        if (level === ConfigurationLevel.RECIPE) {
            // 研发视图：使用配方层配置
            return {
                level: ConfigurationLevel.RECIPE,
                recipeDevicePool: defaultDevicePool,
                activeDevicePool: defaultDevicePool,
            };
        }

        if (level === ConfigurationLevel.PRODUCTION_LINE && lineId) {
            // 生产视图：使用产线配置
            const lineConfig = this.getProductionLine(lineId);
            if (!lineConfig) {
                throw new Error(`产线配置不存在: ${lineId}`);
            }

            return {
                level: ConfigurationLevel.PRODUCTION_LINE,
                recipeDevicePool: defaultDevicePool,
                productionLineConfig: lineConfig,
                activeDevicePool: lineConfig.devicePool.filter(
                    d => d.usageMode !== DeviceUsageMode.DISABLED
                ),
            };
        }

        throw new Error(`无效的配置层级: ${level}`);
    }

    /**
     * 映射设备编号（配方设备 -> 实际设备）
     */
    mapDeviceCode(
        recipeDeviceCode: string,
        lineId: string
    ): string | undefined {
        const lineConfig = this.getProductionLine(lineId);
        if (!lineConfig || !lineConfig.deviceMapping) {
            return recipeDeviceCode;  // 无映射，返回原值
        }

        return lineConfig.deviceMapping[recipeDeviceCode] || recipeDeviceCode;
    }

    /**
     * 检查产线是否支持设备类型
     */
    supportsDeviceType(
        lineId: string,
        deviceType: DeviceType
    ): boolean {
        const lineConfig = this.getProductionLine(lineId);
        if (!lineConfig) return false;

        // 检查是否缺少该设备类型
        if (lineConfig.missingDeviceTypes?.includes(deviceType)) {
            return false;
        }

        // 检查是否有该类型的设备
        return lineConfig.devicePool.some(
            d => d.deviceType === deviceType && d.usageMode !== DeviceUsageMode.DISABLED
        );
    }
}

// 创建单例实例
export const factoryConfigService = new FactoryConfigService();
