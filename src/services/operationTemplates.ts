import { Operation, OperationType, OperationTemplate } from '../types/operation';
import { MaterialSpec } from '../types/material';
// import { ProcessType } from '@/types/recipe';

/**
 * 操作模板配置
 */
export interface TemplateConfig {
    template: OperationTemplate;
    params: Record<string, any>;
}

/**
 * 从模板生成操作序列
 */
export function generateOperationsFromTemplate(
    template: OperationTemplate,
    config: TemplateConfig['params'],
    materials: MaterialSpec[]
): Operation[] {
    switch (template) {
        case OperationTemplate.DISSOLUTION_STANDARD:
            return generateDissolutionOperations(config as any, materials);
        case OperationTemplate.FILTRATION_AUTO:
            return generateFiltrationOperations(config);
        case OperationTemplate.TRANSFER_MATERIAL:
            return generateTransferMaterialOperations(config);
        case OperationTemplate.TRANSFER_WATER:
            return generateTransferWaterOperations(config);
        case OperationTemplate.COMPOUNDING_SEQUENTIAL:
            return generateCompoundingOperations(config, materials);
        default:
            return [];
    }
}

/**
 * 生成标准溶解操作序列
 */
function generateDissolutionOperations(
    config: {
        waterVolume: { value: number; unit: string };
        waterTemp?: { min?: number; max?: number; unit: string }; // unit usually '℃'
        stirringTime: { value: number; unit: string };
        stirringRate: 'high' | 'medium' | 'low';
    },
    materials: MaterialSpec[]
): Operation[] {
    const operations: Operation[] = [];
    let order = 1;

    // 1. 打水
    operations.push({
        id: `op-fill-water-${Date.now()}`,
        order: order++,
        type: OperationType.FILL_WATER,
        description: '打水',
        params: {
            volume: config.waterVolume,
            temperature: config.waterTemp ? {
                min: config.waterTemp.min,
                max: config.waterTemp.max,
                unit: config.waterTemp.unit as '℃' | 'K' | '℉' // Type casting or validation needed
            } : undefined,
        },
    });

    // 2. 开始搅拌
    operations.push({
        id: `op-start-stirring-${Date.now()}`,
        order: order++,
        type: OperationType.START_STIRRING,
        description: '启动搅拌',
        params: {
            speed: config.stirringRate,
        },
    });

    // 3. 投料（每个物料一个操作）
    materials.forEach((material) => {
        operations.push({
            id: `op-add-material-${material.id}`,
            order: order++,
            type: OperationType.ADD_MATERIAL,
            description: `投入${material.name}`,
            params: {
                materialRef: material.id,
                additionMethod: 'gradual',
            },
        });
    });

    // 4. 等待/计时
    operations.push({
        id: `op-wait-${Date.now()}`,
        order: order++,
        type: OperationType.WAIT,
        description: '维持搅拌以完成溶解',
        params: {
            duration: {
                value: config.stirringTime.value,
                unit: config.stirringTime.unit as 'h' | 'min' | 's' | 'ms'
            },
            reason: '溶解反应',
        },
    });

    // 5. 停止搅拌
    operations.push({
        id: `op-stop-stirring-${Date.now()}`,
        order: order++,
        type: OperationType.STOP_STIRRING,
        description: '停止搅拌',
        params: {},
    });

    return operations;
}

function generateFiltrationOperations(_config: any): Operation[] {
    // Implement later
    return [];
}

function generateTransferMaterialOperations(_config: any): Operation[] {
    // Implement later
    return [];
}

function generateTransferWaterOperations(_config: any): Operation[] {
    // Implement later
    return [];
}

function generateCompoundingOperations(_config: any, _materials: MaterialSpec[]): Operation[] {
    // Implement later
    return [];
}
