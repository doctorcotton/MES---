/**
 * 配方校验工具
 * 用于在保存前检查配方的完整性和有效性
 */
import { Process, RecipeEdge } from '../types/recipe';

/**
 * 校验结果接口
 */
export interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
}

/**
 * 校验错误接口
 */
export interface ValidationError {
    type: 'error';
    code: string;
    message: string;
    nodeId?: string;
    nodeName?: string;
}

/**
 * 校验警告接口
 */
export interface ValidationWarning {
    type: 'warning';
    code: string;
    message: string;
    nodeId?: string;
    nodeName?: string;
}

/**
 * 校验配方连线完整性
 * 检查是否有工艺段或子步骤没有连接到下游
 *
 * @param processes 工艺段列表
 * @param edges 连线列表
 * @returns 校验结果
 */
export function validateRecipeConnections(
    processes: Process[],
    edges: RecipeEdge[]
): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // 如果只有一个或零个工艺段，无需校验连接
    if (processes.length <= 1) {
        return { isValid: true, errors, warnings };
    }

    // 获取所有作为 source 的工艺段 ID
    const sourcesSet = new Set(edges.map((e) => e.source));
    // 获取所有作为 target 的工艺段 ID
    const targetsSet = new Set(edges.map((e) => e.target));

    // 检查每个工艺段的连接状态
    processes.forEach((process) => {
        const hasOutgoing = sourcesSet.has(process.id);
        const hasIncoming = targetsSet.has(process.id);

        // 完全孤立的工艺段（既没有出边也没有入边）
        if (!hasOutgoing && !hasIncoming) {
            warnings.push({
                type: 'warning',
                code: 'ISOLATED_PROCESS',
                message: `工艺段 "${process.name}" 没有任何连线，请检查是否需要连接`,
                nodeId: process.id,
                nodeName: process.name,
            });
        } else if (!hasOutgoing && hasIncoming) {
            // 有入边但没有出边：可能是终点节点，这是合法的
            // 不发出警告
        } else if (hasOutgoing && !hasIncoming) {
            // 有出边但没有入边：可能是起点节点，这是合法的
            // 不发出警告
        }
    });

    // 去重警告（基于 nodeId 和 code）
    const uniqueWarnings = warnings.filter(
        (w, index, self) =>
            index === self.findIndex((t) => t.nodeId === w.nodeId && t.code === w.code)
    );

    return {
        isValid: errors.length === 0,
        errors,
        warnings: uniqueWarnings,
    };
}

/**
 * 格式化校验结果为用户友好的消息
 *
 * @param result 校验结果
 * @returns 格式化的消息字符串
 */
export function formatValidationMessage(result: ValidationResult): string {
    const messages: string[] = [];

    if (result.errors.length > 0) {
        messages.push('❌ 错误：');
        result.errors.forEach((e) => messages.push(`  • ${e.message}`));
    }

    if (result.warnings.length > 0) {
        messages.push('⚠️ 警告：');
        result.warnings.forEach((w) => messages.push(`  • ${w.message}`));
    }

    return messages.join('\n');
}
