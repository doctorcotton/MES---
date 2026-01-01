import { RecipeNode, RecipeEdge, Process, ProcessType } from '../types/recipe';

/**
 * 初始工艺段数据
 * 每个Process代表一个完整的工艺流程单元，包含多个步骤节点
 */
export const initialProcesses: Process[] = [
  // P1工艺段：糖醇、三氯蔗糖类溶解液
  {
    id: "P1",
    name: "糖醇、三氯蔗糖类溶解液",
    description: "糖醇和三氯蔗糖的溶解工艺",
    nodes: [
      {
        id: "P1-Dissolution",
        type: "customProcessNode",
        position: { x: 0, y: 0 },
        data: {
          processType: ProcessType.DISSOLUTION,
          label: "溶解",
          deviceCode: "高搅桶1",
          ingredients: "RO水、部分赤藓糖醇、三氯蔗糖类",
          dissolutionParams: {
            waterVolume: { value: 1000, unit: 'L', condition: '>=' },
            waterTemp: { min: 65, max: 75, unit: '℃' },
            stirringTime: { value: 6, unit: 'min' },
            stirringRate: 'high',
            transferType: 'material'
          }
        }
      },
      {
        id: "P1-Filter",
        type: "customProcessNode",
        position: { x: 0, y: 0 },
        data: {
          processType: ProcessType.FILTRATION,
          label: "0.5μm过滤",
          deviceCode: "管道",
          ingredients: "-",
          filtrationParams: {
            precision: { value: 0.5, unit: 'μm' }
          }
        }
      },
      {
        id: "P1-Transfer",
        type: "customProcessNode",
        position: { x: 0, y: 0 },
        data: {
          processType: ProcessType.TRANSFER,
          label: "料赶料",
          deviceCode: "高搅桶1",
          ingredients: "糖醇等物料溶完后，料赶料",
          transferParams: {
            transferType: 'material'
          }
        }
      }
    ]
  },
  
  // P2工艺段：维生素类、盐类、矿物质类溶解液
  {
    id: "P2",
    name: "维生素类、盐类、矿物质类溶解液",
    description: "维生素、盐类和矿物质的溶解工艺",
    nodes: [
      {
        id: "P2-Dissolution",
        type: "customProcessNode",
        position: { x: 0, y: 0 },
        data: {
          processType: ProcessType.DISSOLUTION,
          label: "溶解",
          deviceCode: "高搅桶2",
          ingredients: "RO水、维生素B6、食用盐、氯化钾、葡萄糖酸锌等",
          dissolutionParams: {
            waterVolume: { value: 800, unit: 'L', condition: '>' },
            waterTemp: { unit: '℃' }, // 常温
            stirringTime: { value: 8, unit: 'min' },
            stirringRate: 'high',
            transferType: 'material'
          }
        }
      },
      {
        id: "P2-Filter",
        type: "customProcessNode",
        position: { x: 0, y: 0 },
        data: {
          processType: ProcessType.FILTRATION,
          label: "0.5μm过滤",
          deviceCode: "管道",
          ingredients: "-",
          filtrationParams: {
            precision: { value: 0.5, unit: 'μm' }
          }
        }
      },
      {
        id: "P2-Transfer",
        type: "customProcessNode",
        position: { x: 0, y: 0 },
        data: {
          processType: ProcessType.TRANSFER,
          label: "料赶料",
          deviceCode: "高搅桶2",
          ingredients: "维生素和矿物质溶解后，料赶料",
          transferParams: {
            transferType: 'material'
          }
        }
      }
    ]
  },
  
  // P3工艺段：维生素E+部分赤藓溶解液
  {
    id: "P3",
    name: "维生素E+部分赤藓溶解液",
    description: "维生素E和部分赤藓糖醇的溶解工艺",
    nodes: [
      {
        id: "P3-Dissolution",
        type: "customProcessNode",
        position: { x: 0, y: 0 },
        data: {
          processType: ProcessType.DISSOLUTION,
          label: "溶解",
          deviceCode: "高搅桶1",
          ingredients: "25~35℃ RO水、在维生素E中+等量赤藓糖醇手动预混 2min混匀",
          dissolutionParams: {
            waterVolume: { value: 800, unit: 'L', condition: '>=' },
            waterTemp: { min: 25, max: 35, unit: '℃' },
            stirringTime: { value: 8, unit: 'min' },
            stirringRate: 'high',
            transferType: 'water'
          }
        }
      },
      {
        id: "P3-Filter",
        type: "customProcessNode",
        position: { x: 0, y: 0 },
        data: {
          processType: ProcessType.FILTRATION,
          label: "0.5μm过滤",
          deviceCode: "管道",
          ingredients: "-",
          filtrationParams: {
            precision: { value: 0.5, unit: 'μm' }
          }
        }
      },
      {
        id: "P3-Transfer",
        type: "customProcessNode",
        position: { x: 0, y: 0 },
        data: {
          processType: ProcessType.TRANSFER,
          label: "水赶料",
          deviceCode: "高搅桶1",
          ingredients: "RO水 2000L分两次赶",
          transferParams: {
            transferType: 'water',
            waterVolume: { value: 2000, unit: 'L' },
            cleaning: "人工清洗桶壁至无料液残留"
          }
        }
      }
    ]
  },
  
  // P4工艺段：酸类溶解液
  {
    id: "P4",
    name: "酸类溶解液",
    description: "酸类物质的溶解工艺",
    nodes: [
      {
        id: "P4-Dissolution",
        type: "customProcessNode",
        position: { x: 0, y: 0 },
        data: {
          processType: ProcessType.DISSOLUTION,
          label: "溶解",
          deviceCode: "高搅桶2",
          ingredients: "RO水、无水柠檬酸、柠檬酸钠类",
          dissolutionParams: {
            waterVolume: { value: 500, unit: 'L', condition: '>' },
            waterTemp: { unit: '℃' }, // 常温
            stirringTime: { value: 6, unit: 'min' },
            stirringRate: 'high',
            transferType: 'water'
          }
        }
      },
      {
        id: "P4-Filter",
        type: "customProcessNode",
        position: { x: 0, y: 0 },
        data: {
          processType: ProcessType.FILTRATION,
          label: "0.5μm过滤",
          deviceCode: "管道",
          ingredients: "-",
          filtrationParams: {
            precision: { value: 0.5, unit: 'μm' }
          }
        }
      },
      {
        id: "P4-Transfer",
        type: "customProcessNode",
        position: { x: 0, y: 0 },
        data: {
          processType: ProcessType.TRANSFER,
          label: "水赶料",
          deviceCode: "高搅桶2",
          ingredients: "RO水 2000L分两次赶",
          transferParams: {
            transferType: 'water',
            waterVolume: { value: 2000, unit: 'L' },
            cleaning: "人工清洗桶壁至无料液残留"
          }
        }
      }
    ]
  },
  
  // P5工艺段：香精添加
  {
    id: "P5",
    name: "香精添加",
    description: "香精添加工艺",
    nodes: [
      {
        id: "P5-FlavorAddition",
        type: "customProcessNode",
        position: { x: 0, y: 0 },
        data: {
          processType: ProcessType.FLAVOR_ADDITION,
          label: "香精添加",
          deviceCode: "人工",
          ingredients: "香精",
          flavorAdditionParams: {
            method: "按配方投料"
          }
        }
      }
    ]
  },
  
  // P6工艺段：调配定容
  {
    id: "P6",
    name: "调配定容",
    description: "调配和定容工艺",
    nodes: [
      {
        id: "P6-Compounding",
        type: "customProcessNode",
        position: { x: 0, y: 0 },
        data: {
          processType: ProcessType.COMPOUNDING,
          label: "调配定容：调配液<30℃",
          deviceCode: "调配桶",
          ingredients: "①RO水（按调配总量的10%-20%添加）②赤藓糖醇、三氯蔗糖溶解液 ③维生素和矿物质溶解液 ④维生素E+部分赤藓溶液 ⑤酸类溶解液 ⑥调整理化，定容 ⑦依次加入香精",
          compoundingParams: {
            additives: [
              { order: 1, type: 'rawMaterial', name: 'RO水', amount: '10%-20%' },
              { order: 2, type: 'solution', source: 'P1-Transfer', name: '赤藓糖醇、三氯蔗糖溶解液' },
              { order: 3, type: 'solution', source: 'P2-Transfer', name: '维生素和矿物质溶解液' },
              { order: 4, type: 'solution', source: 'P3-Transfer', name: '维生素E+部分赤藓溶液' },
              { order: 5, type: 'solution', source: 'P4-Transfer', name: '酸类溶解液' },
              { order: 6, type: 'rawMaterial', name: '调整理化，定容' },
              { order: 7, type: 'rawMaterial', source: 'P5-FlavorAddition', name: '香精' }
            ],
            stirringSpeed: { value: 90, unit: '%', condition: '>=' },
            stirringTime: { value: 10, unit: 'min' },
            finalTemp: { max: 30, unit: '℃' }
          }
        }
      }
    ]
  },
  
  // P7工艺段：UHT灭菌
  {
    id: "P7",
    name: "UHT灭菌",
    description: "超高温瞬时灭菌工艺",
    nodes: [
      {
        id: "P7-UHT",
        type: "customProcessNode",
        position: { x: 0, y: 0 },
        data: {
          processType: ProcessType.OTHER,
          label: "UHT灭菌",
          deviceCode: "UHT机",
          ingredients: "-",
          params: "（112±2）℃，30s，冷却至30℃以下"
        }
      }
    ]
  },
  
  // P8工艺段：灌装
  {
    id: "P8",
    name: "灌装",
    description: "无菌灌装工艺",
    nodes: [
      {
        id: "P8-Packaging",
        type: "customProcessNode",
        position: { x: 0, y: 0 },
        data: {
          processType: ProcessType.OTHER,
          label: "灌装",
          deviceCode: "灌装机",
          ingredients: "-",
          params: "无菌灌装"
        }
      }
    ]
  },
  
  // 后处理工艺段：最终过滤、磁棒吸附、无菌罐
  {
    id: "PostProcessing",
    name: "后处理",
    description: "最终过滤、磁棒吸附和无菌暂存",
    nodes: [
      {
        id: "PostProcessing-FilterFinal",
        type: "customProcessNode",
        position: { x: 0, y: 0 },
        data: {
          processType: ProcessType.FILTRATION,
          label: "1μm过滤",
          deviceCode: "管道",
          ingredients: "-",
          filtrationParams: {
            precision: { value: 1, unit: 'μm' }
          }
        }
      },
      {
        id: "PostProcessing-MagnetBar",
        type: "customProcessNode",
        position: { x: 0, y: 0 },
        data: {
          processType: ProcessType.OTHER,
          label: "磁棒吸附",
          deviceCode: "管道",
          ingredients: "-",
          params: "除杂"
        }
      },
      {
        id: "PostProcessing-SterileTank",
        type: "customProcessNode",
        position: { x: 0, y: 0 },
        data: {
          processType: ProcessType.OTHER,
          label: "无菌罐",
          deviceCode: "无菌罐",
          ingredients: "-",
          params: "暂存"
        }
      }
    ]
  }
];

/**
 * 初始连线数据
 * 注意：所有节点ID已更新为新格式（如 P1-Dissolution, P1-Filter 等）
 */
export const initialEdges: RecipeEdge[] = [
  // P1工艺段内部连线
  { id: "e1", source: "P1-Dissolution", target: "P1-Filter", type: "sequenceEdge", data: { sequenceOrder: 1 } },
  { id: "e2", source: "P1-Filter", target: "P1-Transfer", type: "sequenceEdge", data: { sequenceOrder: 1 } },
  
  // P2工艺段内部连线
  { id: "e3", source: "P2-Dissolution", target: "P2-Filter", type: "sequenceEdge", data: { sequenceOrder: 1 } },
  { id: "e4", source: "P2-Filter", target: "P2-Transfer", type: "sequenceEdge", data: { sequenceOrder: 1 } },
  
  // P3工艺段内部连线
  { id: "e5", source: "P3-Dissolution", target: "P3-Filter", type: "sequenceEdge", data: { sequenceOrder: 1 } },
  { id: "e6", source: "P3-Filter", target: "P3-Transfer", type: "sequenceEdge", data: { sequenceOrder: 1 } },
  
  // P4工艺段内部连线
  { id: "e7", source: "P4-Dissolution", target: "P4-Filter", type: "sequenceEdge", data: { sequenceOrder: 1 } },
  { id: "e8", source: "P4-Filter", target: "P4-Transfer", type: "sequenceEdge", data: { sequenceOrder: 1 } },
  
  // 各工艺段流向P6调配
  { id: "e9", source: "P1-Transfer", target: "P6-Compounding", type: "sequenceEdge", data: { sequenceOrder: 2 } },
  { id: "e10", source: "P2-Transfer", target: "P6-Compounding", type: "sequenceEdge", data: { sequenceOrder: 3 } },
  { id: "e11", source: "P3-Transfer", target: "P6-Compounding", type: "sequenceEdge", data: { sequenceOrder: 4 } },
  { id: "e12", source: "P4-Transfer", target: "P6-Compounding", type: "sequenceEdge", data: { sequenceOrder: 5 } },
  { id: "e13", source: "P5-FlavorAddition", target: "P6-Compounding", type: "sequenceEdge", data: { sequenceOrder: 6 } },
  
  // P6到后处理
  { id: "e14", source: "P6-Compounding", target: "PostProcessing-FilterFinal", type: "sequenceEdge", data: { sequenceOrder: 1 } },
  
  // 后处理工艺段内部连线
  { id: "e15", source: "PostProcessing-FilterFinal", target: "PostProcessing-MagnetBar", type: "sequenceEdge", data: { sequenceOrder: 1 } },
  { id: "e16", source: "PostProcessing-MagnetBar", target: "PostProcessing-SterileTank", type: "sequenceEdge", data: { sequenceOrder: 1 } },
  
  // 后处理到P7和P8
  { id: "e17", source: "PostProcessing-SterileTank", target: "P7-UHT", type: "sequenceEdge", data: { sequenceOrder: 1 } },
  { id: "e18", source: "P7-UHT", target: "P8-Packaging", type: "sequenceEdge", data: { sequenceOrder: 1 } }
];

/**
 * 向后兼容：展平的节点数组（供旧代码使用）
 * @deprecated 请使用 initialProcesses 和 flattenProcessesToNodes
 */
export const initialNodes: RecipeNode[] = initialProcesses.flatMap(process => process.nodes);
