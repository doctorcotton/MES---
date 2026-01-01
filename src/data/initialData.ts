import { RecipeNode, RecipeEdge, ProcessType } from '../types/recipe';

export const initialNodes: RecipeNode[] = [
  { 
    id: "P1", 
    type: "customProcessNode", 
    position: { x: 0, y: 0 }, 
    data: { 
      processType: ProcessType.DISSOLUTION,
      label: "糖醇、三氯蔗糖类溶解", 
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
    id: "P3", 
    type: "customProcessNode", 
    position: { x: 0, y: 0 }, 
    data: { 
      processType: ProcessType.DISSOLUTION,
      label: "维生素E+部分赤藓溶解", 
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
    id: "P2", 
    type: "customProcessNode", 
    position: { x: 0, y: 0 }, 
    data: { 
      processType: ProcessType.DISSOLUTION,
      label: "维生素类、盐类、矿物质类溶解", 
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
    id: "P4", 
    type: "customProcessNode", 
    position: { x: 0, y: 0 }, 
    data: { 
      processType: ProcessType.DISSOLUTION,
      label: "酸类溶解", 
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
    id: "Filter1", 
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
    id: "Filter2", 
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
    id: "Filter3", 
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
    id: "Filter4", 
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
    id: "Tank1", 
    type: "customProcessNode", 
    position: { x: 0, y: 0 }, 
    data: { 
      processType: ProcessType.TRANSFER,
      label: "桶1料赶料", 
      deviceCode: "高搅桶1", 
      ingredients: "糖醇等物料溶完后，料赶料", 
      transferParams: {
        transferType: 'material'
      }
    } 
  },
  { 
    id: "Tank2", 
    type: "customProcessNode", 
    position: { x: 0, y: 0 }, 
    data: { 
      processType: ProcessType.TRANSFER,
      label: "桶2料赶料", 
      deviceCode: "高搅桶2", 
      ingredients: "维生素和矿物质溶解后，料赶料", 
      transferParams: {
        transferType: 'material'
      }
    } 
  },
  { 
    id: "Tank3", 
    type: "customProcessNode", 
    position: { x: 0, y: 0 }, 
    data: { 
      processType: ProcessType.TRANSFER,
      label: "桶3水赶料", 
      deviceCode: "高搅桶1", 
      ingredients: "RO水 2000L分两次赶", 
      transferParams: {
        transferType: 'water',
        waterVolume: { value: 2000, unit: 'L' },
        cleaning: "人工清洗桶壁至无料液残留"
      }
    } 
  },
  { 
    id: "Tank4", 
    type: "customProcessNode", 
    position: { x: 0, y: 0 }, 
    data: { 
      processType: ProcessType.TRANSFER,
      label: "桶4水赶料", 
      deviceCode: "高搅桶2", 
      ingredients: "RO水 2000L分两次赶", 
      transferParams: {
        transferType: 'water',
        waterVolume: { value: 2000, unit: 'L' },
        cleaning: "人工清洗桶壁至无料液残留"
      }
    } 
  },
  { 
    id: "P6", 
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
          { order: 2, type: 'solution', source: 'P1', name: '赤藓糖醇、三氯蔗糖溶解液' },
          { order: 3, type: 'solution', source: 'P2', name: '维生素和矿物质溶解液' },
          { order: 4, type: 'solution', source: 'P3', name: '维生素E+部分赤藓溶液' },
          { order: 5, type: 'solution', source: 'P4', name: '酸类溶解液' },
          { order: 6, type: 'rawMaterial', name: '调整理化，定容' },
          { order: 7, type: 'rawMaterial', source: 'P5', name: '香精' }
        ],
        stirringSpeed: { value: 90, unit: '%', condition: '>=' },
        stirringTime: { value: 10, unit: 'min' },
        finalTemp: { max: 30, unit: '℃' }
      }
    } 
  },
  { 
    id: "P5", 
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
  },
  { 
    id: "FilterFinal", 
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
    id: "MagnetBar", 
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
    id: "P7", 
    type: "customProcessNode", 
    position: { x: 0, y: 0 }, 
    data: { 
      processType: ProcessType.OTHER,
      label: "UHT灭菌", 
      deviceCode: "UHT机", 
      ingredients: "-", 
      params: "（112±2）℃，30s，冷却至30℃以下" 
    } 
  },
  { 
    id: "SterileTank", 
    type: "customProcessNode", 
    position: { x: 0, y: 0 }, 
    data: { 
      processType: ProcessType.OTHER,
      label: "无菌罐", 
      deviceCode: "无菌罐", 
      ingredients: "-", 
      params: "暂存" 
    } 
  },
  { 
    id: "P8", 
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
];

export const initialEdges: RecipeEdge[] = [
  // 第一支路：P1 → Filter1 → Tank1 → P6
  { id: "e1", source: "P1", target: "Filter1", type: "sequenceEdge", data: { sequenceOrder: 1 } },
  { id: "e4", source: "Filter1", target: "Tank1", type: "sequenceEdge", data: { sequenceOrder: 1 } },
  { id: "e6", source: "Tank1", target: "P6", type: "sequenceEdge", data: { sequenceOrder: 2 } },
  
  // 第二支路：P3 → Filter3 → Tank3 → P6
  { id: "e12", source: "P3", target: "Filter3", type: "sequenceEdge", data: { sequenceOrder: 1 } },
  { id: "e13", source: "Filter3", target: "Tank3", type: "sequenceEdge", data: { sequenceOrder: 1 } },
  { id: "e14", source: "Tank3", target: "P6", type: "sequenceEdge", data: { sequenceOrder: 4 } },
  
  // 第三支路：P2 → Filter2 → Tank2 → P6
  { id: "e3", source: "P2", target: "Filter2", type: "sequenceEdge", data: { sequenceOrder: 1 } },
  { id: "e5", source: "Filter2", target: "Tank2", type: "sequenceEdge", data: { sequenceOrder: 1 } },
  { id: "e7", source: "Tank2", target: "P6", type: "sequenceEdge", data: { sequenceOrder: 3 } },
  
  // 第四支路：P4 → Filter4 → Tank4 → P6
  { id: "e15", source: "P4", target: "Filter4", type: "sequenceEdge", data: { sequenceOrder: 1 } },
  { id: "e16", source: "Filter4", target: "Tank4", type: "sequenceEdge", data: { sequenceOrder: 1 } },
  { id: "e17", source: "Tank4", target: "P6", type: "sequenceEdge", data: { sequenceOrder: 5 } },
  
  // P5 香精添加 → P6
  { id: "e8", source: "P5", target: "P6", type: "sequenceEdge", data: { sequenceOrder: 6 } },
  
  // 后处理与灌装：P6 → FilterFinal → MagnetBar → P7 → SterileTank → P8
  { id: "e9", source: "P6", target: "FilterFinal", type: "sequenceEdge", data: { sequenceOrder: 1 } },
  { id: "e18", source: "FilterFinal", target: "MagnetBar", type: "sequenceEdge", data: { sequenceOrder: 1 } },
  { id: "e19", source: "MagnetBar", target: "P7", type: "sequenceEdge", data: { sequenceOrder: 1 } },
  { id: "e20", source: "P7", target: "SterileTank", type: "sequenceEdge", data: { sequenceOrder: 1 } },
  { id: "e11", source: "SterileTank", target: "P8", type: "sequenceEdge", data: { sequenceOrder: 1 } }
];
