import { SubStepTemplate } from '../types/processTypeConfig';
import { ProcessType } from '../types/recipe';
import { useFieldConfigStore } from '../store/useFieldConfigStore';
import { FieldInputType } from '../types/fieldConfig';
import { v4 as uuidv4 } from 'uuid';

/**
 * 从参数值推断字段输入类型
 */
function inferFieldInputType(key: string, value: any): FieldInputType {
    if (value === null || value === undefined) {
        return 'text';
    }

    // 检查是否为对象类型
    if (typeof value === 'object') {
        // 检查是否为范围类型（有 min 和 max）
        if ('min' in value && 'max' in value) {
            // 检查单位是否为 (1:X) 格式，表示料水比
            if (key.toLowerCase().includes('ratio') || key.toLowerCase().includes('比')) {
                return 'waterRatio';
            }
            return 'range';
        }

        // 检查是否为条件值类型（有 value, unit, condition）
        if ('value' in value && 'unit' in value) {
            if ('condition' in value) {
                return 'conditionValue';
            }
            return 'number';
        }

        // 检查是否为简单对象（只有 max 或 min）
        if ('max' in value || 'min' in value) {
            return 'range';
        }

        // 其他对象类型
        return 'object';
    }

    // 检查是否为数组
    if (Array.isArray(value)) {
        return 'array';
    }

    // 检查是否为数字
    if (typeof value === 'number') {
        return 'number';
    }

    // 检查是否为布尔值
    if (typeof value === 'boolean') {
        return 'select'; // 布尔值用下拉选择
    }

    // 默认为文本
    return 'text';
}

/**
 * 从参数值提取单位
 */
function extractUnit(key: string, value: any): string | undefined {
    if (typeof value === 'object' && value !== null) {
        if ('unit' in value) {
            return value.unit;
        }
    }

    // 根据字段名推断单位
    const unitMap: Record<string, string> = {
        temp: '℃',
        temperature: '℃',
        time: 'min',
        volume: 'L',
        precision: 'μm',
        speed: '%',
    };

    const lowerKey = key.toLowerCase();
    for (const [keyword, unit] of Object.entries(unitMap)) {
        if (lowerKey.includes(keyword)) {
            return unit;
        }
    }

    return undefined;
}

/**
 * 生成字段标签（从 key 转换为中文）
 */
function generateFieldLabel(key: string): string {
    const labelMap: Record<string, string> = {
        waterTemp: '水温',
        teaWaterRatio: '茶水比',
        waterRatio: '料水比',
        stirringTime: '搅拌时间',
        stirringFrequency: '搅拌频率',
        stirringRate: '搅拌速率',
        stirringSpeed: '搅拌速度',
        coolingTemp: '冷却温度',
        settlingTime: '静置时间',
        waterVolume: '水量',
        waterVolumeMode: '水量模式',
        transferType: '赶料类型',
        precision: '过滤精度',
        finalTemp: '最终温度',
        method: '添加方式',
        params: '参数描述',
    };

    return labelMap[key] || key;
}

/**
 * 检查字段是否必填
 */
function isFieldRequired(key: string, value: any): boolean {
    // 根据字段名和值判断
    const requiredFields = ['waterTemp', 'teaWaterRatio', 'stirringTime', 'precision', 'method'];
    return requiredFields.includes(key) || (value !== undefined && value !== null && value !== '');
}

/**
 * 为工艺类型自动创建字段配置
 */
export async function createFieldsForProcessType(
    processType: ProcessType,
    template: SubStepTemplate
): Promise<void> {
    const { addConfig } = useFieldConfigStore.getState();
    const params = template.defaultParams;

    // 根据 processType 确定参数对象的键名
    let paramObject: any = null;
    if ('dissolutionParams' in params) {
        paramObject = params.dissolutionParams;
    } else if ('compoundingParams' in params) {
        paramObject = params.compoundingParams;
    } else if ('filtrationParams' in params) {
        paramObject = params.filtrationParams;
    } else if ('transferParams' in params) {
        paramObject = params.transferParams;
    } else if ('flavorAdditionParams' in params) {
        paramObject = params.flavorAdditionParams;
    } else if ('extractionParams' in params) {
        paramObject = params.extractionParams;
    } else if ('params' in params) {
        // OTHER 类型
        paramObject = { params: params.params };
    } else {
        // 动态类型，尝试从 params 中提取
        paramObject = params;
    }

    if (!paramObject || typeof paramObject !== 'object') {
        console.warn(`Cannot extract params for type ${processType}`);
        return;
    }

    // 遍历参数对象，为每个字段创建配置
    const fieldConfigs: Array<{ key: string; config: any }> = [];
    let sortOrder = 0;

    for (const [key, value] of Object.entries(paramObject)) {
        // 跳过 processType 字段
        if (key === 'processType') continue;

        const inputType = inferFieldInputType(key, value);
        const unit = extractUnit(key, value);
        const label = generateFieldLabel(key);
        const required = isFieldRequired(key, value);

        // 构建字段配置
        const fieldConfig: any = {
            processType,
            key,
            label,
            inputType,
            unit,
            validation: {
                required,
            },
            sortOrder,
            isSystem: false,
            enabled: true,
        };

        // 处理特殊类型
        if (inputType === 'select' && typeof value === 'boolean') {
            fieldConfig.options = [
                { value: 'true', label: '是' },
                { value: 'false', label: '否' },
            ];
        }

        // 设置默认值
        if (value !== undefined && value !== null) {
            fieldConfig.defaultValue = value;
        }

        fieldConfigs.push({ key, config: fieldConfig });
        sortOrder++;
    }

    // 批量创建字段配置
    for (const { key, config } of fieldConfigs) {
        try {
            await addConfig({
                ...config,
                id: uuidv4(),
            });
        } catch (error) {
            console.error(`Failed to create field config for ${key}:`, error);
            // 继续创建其他字段
        }
    }
}

