import { Process, RecipeEdge, ProcessType } from '../types/recipe';
import { DeviceType } from '../types/equipment';
import { MaterialRole } from '../types/material';
import { migrateSubStepToV2 } from '../utils/migration';

/**
 * 初始工艺段数据
 * 每个Process代表一个完整的工艺流程单元，包含一个合并步骤节点和多个子步骤序列
 */
export const initialProcesses: Process[] = [
  // P1工艺段：糖醇、三氯蔗糖类溶解液
  {
    id: "P1",
    name: "糖醇、三氯蔗糖类溶解液",
    description: "糖醇和三氯蔗糖的溶解工艺",
    node: {
      id: "P1",
      type: "processNode",
      label: "糖醇、三氯蔗糖类溶解液",
      subSteps: [
        {
          id: "P1-substep-1",
          order: 1,
          processType: ProcessType.DISSOLUTION,
          label: "溶解",
          deviceCode: "高搅桶1",
          ingredients: "RO水、部分赤藓糖醇、三氯蔗糖类",
          params: {
            processType: ProcessType.DISSOLUTION,
            dissolutionParams: {
              waterVolumeMode: 'fixed',
              waterVolume: { value: 1000, unit: 'L', condition: '>=' },
              waterTemp: { min: 65, max: 75, unit: '℃' },
              stirringTime: { value: 6, unit: 'min' },
              stirringRate: 'high',
              transferType: 'material'
            }
          },
          // 新增：新结构字段（手动定义或使用迁移工具）
          equipmentV2: {
            deviceCode: "高搅桶1",
            deviceType: DeviceType.HIGH_SPEED_MIXER,
            capacity: { value: 2000, unit: 'L' },
          },
          materialsV2: [
            { id: "P1-mat-1", name: "RO水", role: MaterialRole.SOLVENT },
            { id: "P1-mat-2", name: "赤藓糖醇", role: MaterialRole.SOLUTE },
            { id: "P1-mat-3", name: "三氯蔗糖", role: MaterialRole.SOLUTE },
          ],
          operationsV2: [], // 暂时留空，可以使用 migrateSubStepToV2 自动生成
          _migrated: true,
        },
        {
          id: "P1-substep-2",
          order: 2,
          processType: ProcessType.FILTRATION,
          label: "0.5μm过滤",
          deviceCode: "管道",
          ingredients: "-",
          params: {
            processType: ProcessType.FILTRATION,
            filtrationParams: {
              precision: { value: 0.5, unit: 'μm' }
            }
          }
        },
        {
          id: "P1-substep-3",
          order: 3,
          processType: ProcessType.TRANSFER,
          label: "料赶料",
          deviceCode: "高搅桶1",
          ingredients: "糖醇等物料溶完后，料赶料",
          params: {
            processType: ProcessType.TRANSFER,
            transferParams: {
              transfer_transferType: 'material'
            }
          }
        }
      ]
    }
  },

  // P2工艺段：维生素类、盐类、矿物质类溶解液
  {
    id: "P2",
    name: "维生素类、盐类、矿物质类溶解液",
    description: "维生素、盐类和矿物质的溶解工艺",
    node: {
      id: "P2",
      type: "processNode",
      label: "维生素类、盐类、矿物质类溶解液",
      subSteps: [
        {
          id: "P2-substep-1",
          order: 1,
          processType: ProcessType.DISSOLUTION,
          label: "溶解",
          deviceCode: "高搅桶2",
          ingredients: "RO水、维生素B6、食用盐、氯化钾、葡萄糖酸锌等",
          params: {
            processType: ProcessType.DISSOLUTION,
            dissolutionParams: {
              waterVolumeMode: 'fixed',
              waterVolume: { value: 800, unit: 'L', condition: '>' },
              waterTemp: { unit: '℃' }, // 常温
              stirringTime: { value: 8, unit: 'min' },
              stirringRate: 'high',
              transferType: 'material'
            }
          }
        },
        {
          id: "P2-substep-2",
          order: 2,
          processType: ProcessType.FILTRATION,
          label: "0.5μm过滤",
          deviceCode: "管道",
          ingredients: "-",
          params: {
            processType: ProcessType.FILTRATION,
            filtrationParams: {
              precision: { value: 0.5, unit: 'μm' }
            }
          }
        },
        {
          id: "P2-substep-3",
          order: 3,
          processType: ProcessType.TRANSFER,
          label: "料赶料",
          deviceCode: "高搅桶2",
          ingredients: "维生素和矿物质溶解后，料赶料",
          params: {
            processType: ProcessType.TRANSFER,
            transferParams: {
              transfer_transferType: 'material'
            }
          }
        }
      ]
    }
  },

  // P3工艺段：维生素E+部分赤藓溶解液
  {
    id: "P3",
    name: "维生素E+部分赤藓溶解液",
    description: "维生素E和部分赤藓糖醇的溶解工艺",
    node: {
      id: "P3",
      type: "processNode",
      label: "维生素E+部分赤藓溶解液",
      subSteps: [
        {
          id: "P3-substep-1",
          order: 1,
          processType: ProcessType.DISSOLUTION,
          label: "溶解",
          deviceCode: "高搅桶1",
          ingredients: "25~35℃ RO水、在维生素E中+等量赤藓糖醇手动预混 2min混匀",
          params: {
            processType: ProcessType.DISSOLUTION,
            dissolutionParams: {
              waterVolumeMode: 'fixed',
              waterVolume: { value: 800, unit: 'L', condition: '>=' },
              waterTemp: { min: 25, max: 35, unit: '℃' },
              stirringTime: { value: 8, unit: 'min' },
              stirringRate: 'high',
              transferType: 'water'
            }
          }
        },
        {
          id: "P3-substep-2",
          order: 2,
          processType: ProcessType.FILTRATION,
          label: "0.5μm过滤",
          deviceCode: "管道",
          ingredients: "-",
          params: {
            processType: ProcessType.FILTRATION,
            filtrationParams: {
              precision: { value: 0.5, unit: 'μm' }
            }
          }
        },
        {
          id: "P3-substep-3",
          order: 3,
          processType: ProcessType.TRANSFER,
          label: "水赶料",
          deviceCode: "高搅桶1",
          ingredients: "RO水 2000L分两次赶",
          params: {
            processType: ProcessType.TRANSFER,
            transferParams: {
              transfer_transferType: 'water',
              transfer_waterVolume: { value: 2000, unit: 'L' },
              cleaning: "人工清洗桶壁至无料液残留"
            }
          }
        }
      ]
    }
  },

  // P4工艺段：酸类溶解液
  {
    id: "P4",
    name: "酸类溶解液",
    description: "酸类物质的溶解工艺",
    node: {
      id: "P4",
      type: "processNode",
      label: "酸类溶解液",
      subSteps: [
        {
          id: "P4-substep-1",
          order: 1,
          processType: ProcessType.DISSOLUTION,
          label: "溶解",
          deviceCode: "高搅桶2",
          ingredients: "RO水、无水柠檬酸、柠檬酸钠类",
          params: {
            processType: ProcessType.DISSOLUTION,
            dissolutionParams: {
              waterVolumeMode: 'fixed',
              waterVolume: { value: 500, unit: 'L', condition: '>' },
              waterTemp: { unit: '℃' }, // 常温
              stirringTime: { value: 6, unit: 'min' },
              stirringRate: 'high',
              transferType: 'water'
            }
          }
        },
        {
          id: "P4-substep-2",
          order: 2,
          processType: ProcessType.FILTRATION,
          label: "0.5μm过滤",
          deviceCode: "管道",
          ingredients: "-",
          params: {
            processType: ProcessType.FILTRATION,
            filtrationParams: {
              precision: { value: 0.5, unit: 'μm' }
            }
          }
        },
        {
          id: "P4-substep-3",
          order: 3,
          processType: ProcessType.TRANSFER,
          label: "水赶料",
          deviceCode: "高搅桶2",
          ingredients: "RO水 2000L分两次赶",
          params: {
            processType: ProcessType.TRANSFER,
            transferParams: {
              transfer_transferType: 'water',
              transfer_waterVolume: { value: 2000, unit: 'L' },
              cleaning: "人工清洗桶壁至无料液残留"
            }
          }
        }
      ]
    }
  },

  // P5工艺段：香精添加
  {
    id: "P5",
    name: "香精添加",
    description: "香精添加工艺",
    node: {
      id: "P5",
      type: "processNode",
      label: "香精添加",
      subSteps: [
        {
          id: "P5-substep-1",
          order: 1,
          processType: ProcessType.FLAVOR_ADDITION,
          label: "香精添加",
          deviceCode: "人工",
          ingredients: "香精",
          params: {
            processType: ProcessType.FLAVOR_ADDITION,
            flavorAdditionParams: {
              method: "按配方投料"
            }
          }
        }
      ]
    }
  },

  // P6工艺段：调配定容
  {
    id: "P6",
    name: "调配定容",
    description: "调配和定容工艺",
    node: {
      id: "P6",
      type: "processNode",
      label: "调配定容：调配液<30℃",
      subSteps: [
        {
          id: "P6-substep-1",
          order: 1,
          processType: ProcessType.COMPOUNDING,
          label: "调配定容：调配液<30℃",
          deviceCode: "调配桶",
          ingredients: "①RO水（按调配总量的10%-20%添加）②赤藓糖醇、三氯蔗糖溶解液 ③维生素和矿物质溶解液 ④维生素E+部分赤藓溶液 ⑤酸类溶解液 ⑥调整理化，定容 ⑦依次加入香精",
          params: {
            processType: ProcessType.COMPOUNDING,
            compoundingParams: {
              additives: [
                { order: 1, type: 'rawMaterial', name: 'RO水', amount: '10%-20%' },
                { order: 2, type: 'solution', source: 'P1', name: '赤藓糖醇、三氯蔗糖溶解液' },
                { order: 3, type: 'solution', source: 'P2', name: '维生素和矿物质溶解液' },
                { order: 4, type: 'solution', source: 'P3', name: '维生素E+部分赤藓溶液' },
                { order: 5, type: 'solution', source: 'P4', name: '酸类溶解液' },
                { order: 6, type: 'rawMaterial', name: '调整理化，定容' },
                { order: 7, type: 'rawMaterial', source: 'P5', name: '香精' }
              ],
              stirringSpeed: { value: 90, unit: '%', condition: '>=' },
              compounding_stirringTime: { value: 10, unit: 'min' },
              finalTemp: { max: 30, unit: '℃' }
            }
          }
        }
      ]
    }
  },

  // P7工艺段：后处理（过滤+磁棒吸附）
  {
    id: "P7",
    name: "后处理",
    description: "最终过滤和磁棒吸附",
    node: {
      id: "P7",
      type: "processNode",
      label: "后处理",
      subSteps: [
        {
          id: "P7-substep-1",
          order: 1,
          processType: ProcessType.FILTRATION,
          label: "1μm过滤",
          deviceCode: "管道",
          ingredients: "-",
          params: {
            processType: ProcessType.FILTRATION,
            filtrationParams: {
              precision: { value: 1, unit: 'μm' }
            }
          }
        },
        {
          id: "P7-substep-2",
          order: 2,
          processType: ProcessType.MAGNETIC_ABSORPTION,
          label: "磁棒吸附",
          deviceCode: "管道",
          ingredients: "-",
          params: {
            processType: ProcessType.MAGNETIC_ABSORPTION,
            magneticAbsorptionParams: {
              purpose: '除杂'
            }
          }
        }
      ]
    }
  },

  // P8工艺段：UHT灭菌
  {
    id: "P8",
    name: "UHT灭菌",
    description: "超高温瞬时灭菌工艺",
    node: {
      id: "P8",
      type: "processNode",
      label: "UHT灭菌",
      subSteps: [
        {
          id: "P8-substep-1",
          order: 1,
          processType: ProcessType.UHT,
          label: "UHT灭菌",
          deviceCode: "UHT机",
          ingredients: "-",
          params: {
            processType: ProcessType.UHT,
            uhtParams: {
              sterilizationTemp: { value: 112, tolerance: 2, unit: '℃' },
              sterilizationTime: { value: 30, unit: 's' },
              coolingTempMax: 30
            }
          }
        }
      ]
    }
  },

  // P9工艺段：无菌罐暂存
  {
    id: "P9",
    name: "无菌罐",
    description: "无菌暂存",
    node: {
      id: "P9",
      type: "processNode",
      label: "无菌罐",
      subSteps: [
        {
          id: "P9-substep-1",
          order: 1,
          processType: ProcessType.ASEPTIC_TANK,
          label: "无菌罐",
          deviceCode: "无菌罐",
          ingredients: "-",
          params: {
            processType: ProcessType.ASEPTIC_TANK,
            asepticTankParams: {
              container: '无菌罐'
            }
          }
        }
      ]
    }
  },

  // P10工艺段：灌装
  {
    id: "P10",
    name: "灌装",
    description: "无菌灌装工艺",
    node: {
      id: "P10",
      type: "processNode",
      label: "灌装",
      subSteps: [
        {
          id: "P10-substep-1",
          order: 1,
          processType: ProcessType.FILLING,
          label: "灌装",
          deviceCode: "灌装机",
          ingredients: "-",
          params: {
            processType: ProcessType.FILLING,
            fillingParams: {
              fillingMethod: '无菌灌装'
            }
          }
        }
      ]
    }
  }
];

/**
 * 初始连线数据
 * 只保留工艺段间连线，不包含工艺段内部连线
 */
export const initialEdges: RecipeEdge[] = [
  // 各工艺段流向P6调配
  { id: "e1", source: "P1", target: "P6", type: "sequenceEdge", data: { sequenceOrder: 2 } },
  { id: "e2", source: "P2", target: "P6", type: "sequenceEdge", data: { sequenceOrder: 3 } },
  { id: "e3", source: "P3", target: "P6", type: "sequenceEdge", data: { sequenceOrder: 4 } },
  { id: "e4", source: "P4", target: "P6", type: "sequenceEdge", data: { sequenceOrder: 5 } },
  { id: "e5", source: "P5", target: "P6", type: "sequenceEdge", data: { sequenceOrder: 6 } },

  // P6调配 → P7后处理 → P8 UHT → P9无菌罐 → P10灌装
  { id: "e6", source: "P6", target: "P7", type: "sequenceEdge", data: { sequenceOrder: 1 } },
  { id: "e7", source: "P7", target: "P8", type: "sequenceEdge", data: { sequenceOrder: 1 } },
  { id: "e8", source: "P8", target: "P9", type: "sequenceEdge", data: { sequenceOrder: 1 } },
  { id: "e9", source: "P9", target: "P10", type: "sequenceEdge", data: { sequenceOrder: 1 } }
];

/**
 * 自动迁移所有未迁移的数据（开发时使用）
 */
export function autoMigrateAllProcesses(): Process[] {
  return initialProcesses.map(process => ({
    ...process,
    node: {
      ...process.node,
      subSteps: process.node.subSteps.map(migrateSubStepToV2),
    },
  }));
}
