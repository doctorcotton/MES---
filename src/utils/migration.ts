import { SubStep, ProcessType } from '../types/recipe';
import { EquipmentConfig, DeviceType } from '../types/equipment';
import { MaterialSpec, MaterialRole } from '../types/material';
import { Operation, OperationTemplate } from '../types/operation';
import { generateOperationsFromTemplate } from '../services/operationTemplates';

/**
 * 迁移单个 SubStep 到新结构
 */
export function migrateSubStepToV2(subStep: SubStep): SubStep {
    // 如果已迁移，直接返回
    if (subStep._migrated) {
        return subStep;
    }

    const migrated: SubStep = {
        ...subStep,
        _migrated: true,
        _migrationSource: 'auto-migration',
    };

    // 1. 迁移设备配置
    migrated.equipmentV2 = migrateEquipment(subStep);

    // 2. 迁移物料清单
    migrated.materialsV2 = migrateMaterials(subStep);

    // 3. 生成操作序列
    migrated.operationsV2 = generateOperations(subStep, migrated.materialsV2);

    return migrated;
}

/**
 * 迁移设备配置
 */
function migrateEquipment(subStep: SubStep): EquipmentConfig {
    const deviceType = inferDeviceType(subStep.deviceCode, subStep.processType);

    const config: EquipmentConfig = {
        deviceCode: subStep.deviceCode,
        deviceType,
    };

    // 如果是过滤，提取过滤精度
    if (subStep.processType === ProcessType.FILTRATION && subStep.params.processType === ProcessType.FILTRATION) {
        const precision = subStep.params.filtrationParams.precision;
        if (precision) {
            config.specifications = [
                {
                    name: 'filterPrecision',
                    value: precision.value,
                    unit: precision.unit,
                    description: '过滤精度',
                },
            ];
        }
    }

    return config;
}

/**
 * 迁移物料清单
 */
function migrateMaterials(subStep: SubStep): MaterialSpec[] {
    if (!subStep.ingredients || subStep.ingredients === '-') {
        return [];
    }

    // 解析 ingredients 字符串
    const separator = subStep.ingredients.includes('、') ? '、' : ',';
    const materialNames = subStep.ingredients.split(separator).map(s => s.trim());

    return materialNames.map((name, idx) => ({
        id: `${subStep.id}-mat-${idx}`,
        name,
        role: inferMaterialRole(name, subStep.processType),
    }));
}

/**
 * 生成操作序列
 */
function generateOperations(subStep: SubStep, materials: MaterialSpec[]): Operation[] {
    // 根据 processType 选择模板
    const template = inferTemplate(subStep.processType);

    if (!template) {
        return [];  // 无法自动生成，需要手动定义
    }

    // 从 params 提取配置
    const config = extractTemplateConfig(subStep);

    return generateOperationsFromTemplate(template, config, materials);
}


// --- Helpers ---

function inferDeviceType(deviceCode: string, processType: ProcessType): DeviceType {
    // Simple heuristic based on name or process type
    if (deviceCode.includes('高搅')) return DeviceType.HIGH_SPEED_MIXER;
    if (deviceCode.includes('配液')) return DeviceType.MIXING_TANK;
    if (deviceCode.includes('过滤')) return DeviceType.FILTER;
    if (processType === ProcessType.DISSOLUTION) return DeviceType.HIGH_SPEED_MIXER; // Assumption
    if (processType === ProcessType.FILTRATION) return DeviceType.FILTER;
    return DeviceType.OTHER;
}

function inferMaterialRole(name: string, _processType: ProcessType): MaterialRole {
    if (name.includes('水') || name.includes('溶剂')) return MaterialRole.SOLVENT;
    return MaterialRole.SOLUTE; // Default
}

function inferTemplate(processType: ProcessType): OperationTemplate | null {
    switch (processType) {
        case ProcessType.DISSOLUTION: return OperationTemplate.DISSOLUTION_STANDARD;
        case ProcessType.FILTRATION: return OperationTemplate.FILTRATION_AUTO;
        case ProcessType.TRANSFER: return OperationTemplate.TRANSFER_MATERIAL; // Default transfer
        case ProcessType.COMPOUNDING: return OperationTemplate.COMPOUNDING_SEQUENTIAL;
        default: return null;
    }
}

function extractTemplateConfig(subStep: SubStep): any {
    if (subStep.processType === ProcessType.DISSOLUTION && subStep.params.processType === ProcessType.DISSOLUTION) {
        return subStep.params.dissolutionParams;
    }
    // Implement other extractions
    return {};
}
