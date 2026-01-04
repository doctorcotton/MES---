import { QuantityValue } from './equipment';

/**
 * 物料角色
 */
export enum MaterialRole {
    SOLVENT = 'SOLVENT',                     // 溶剂
    SOLUTE = 'SOLUTE',                       // 溶质
    ADDITIVE = 'ADDITIVE',                   // 添加剂
    INTERMEDIATE = 'INTERMEDIATE',           // 中间产物
    FINAL_PRODUCT = 'FINAL_PRODUCT'          // 最终产品
}

/**
 * 物料规格
 */
export interface MaterialSpec {
    id: string;                              // 物料ID（唯一）
    name: string;                            // 物料名称
    role: MaterialRole;                      // 物料角色
    specification?: string;                  // 规格（如"食品级"）
    amount?: QuantityValue;                  // 用量
    supplier?: string;                       // 供应商
    storageConditions?: string;              // 储存条件
}
