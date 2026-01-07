import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ProcessType, ProcessTypes } from '../types/recipe';
import {
    SubStepTemplate,
    ProcessSegmentTemplate,
    DEFAULT_SUBSTEP_TEMPLATES,
    DEFAULT_PROCESS_SEGMENT_TEMPLATES,
} from '../types/processTypeConfig';

interface ProcessTypeConfigStore {
    // 子步骤模板（改为 Partial Record 以支持动态类型）
    subStepTemplates: Partial<Record<ProcessType, SubStepTemplate>>;
    // 工艺段模板
    processSegmentTemplates: ProcessSegmentTemplate[];
    // 自定义类型名称映射
    customTypeNames: Record<string, string>;

    // 获取子步骤模板
    getSubStepTemplate: (type: ProcessType) => SubStepTemplate | undefined;
    // 更新子步骤模板
    updateSubStepTemplate: (type: ProcessType, updates: Partial<SubStepTemplate>) => void;
    // 新增子步骤类型
    addSubStepType: (type: string, template: SubStepTemplate, displayName?: string) => Promise<void>;
    // 删除子步骤类型
    removeSubStepType: (type: string) => { success: boolean; error?: string; usageLocations?: string[] };
    // 获取所有已配置的类型
    getAllSubStepTypes: () => string[];
    // 检查类型是否被使用
    isTypeInUse: (type: string) => { inUse: boolean; locations: string[] };
    // 注册自定义类型名称
    registerProcessTypeName: (type: string, name: string) => void;

    // 获取工艺段模板
    getProcessSegmentTemplate: (id: string) => ProcessSegmentTemplate | undefined;
    // 添加工艺段模板
    addProcessSegmentTemplate: (template: ProcessSegmentTemplate) => void;
    // 更新工艺段模板
    updateProcessSegmentTemplate: (id: string, updates: Partial<ProcessSegmentTemplate>) => void;
    // 删除工艺段模板
    removeProcessSegmentTemplate: (id: string) => void;

    // 重置为默认值
    resetToDefaults: () => void;
}

export const useProcessTypeConfigStore = create<ProcessTypeConfigStore>()(
    persist(
        (set, get) => ({
            subStepTemplates: { ...DEFAULT_SUBSTEP_TEMPLATES },
            processSegmentTemplates: [...DEFAULT_PROCESS_SEGMENT_TEMPLATES],
            customTypeNames: {},

            getSubStepTemplate: (type) => {
                return get().subStepTemplates[type];
            },

            updateSubStepTemplate: (type, updates) => {
                const template = get().subStepTemplates[type];
                if (!template) {
                    console.warn(`Template for type ${type} not found`);
                    return;
                }
                set((state) => ({
                    subStepTemplates: {
                        ...state.subStepTemplates,
                        [type]: {
                            ...template,
                            ...updates,
                            version: template.version + 1,
                        },
                    },
                }));
            },

            addSubStepType: async (type, template, displayName) => {
                // 检查类型是否已存在
                if (get().subStepTemplates[type]) {
                    throw new Error(`类型 ${type} 已存在`);
                }

                // 添加模板
                set((state) => ({
                    subStepTemplates: {
                        ...state.subStepTemplates,
                        [type]: template,
                    },
                    customTypeNames: displayName
                        ? { ...state.customTypeNames, [type]: displayName }
                        : state.customTypeNames,
                }));

                // 自动创建字段配置
                const { createFieldsForProcessType } = await import('../utils/createFieldsForProcessType');
                try {
                    await createFieldsForProcessType(type, template);
                } catch (error) {
                    console.error(`Failed to create fields for type ${type}:`, error);
                    // 即使字段创建失败，也保留类型模板
                }
            },

            removeSubStepType: (type) => {
                // 检查是否为系统默认类型
                const baseTypes = [
                    ProcessTypes.DISSOLUTION,
                    ProcessTypes.COMPOUNDING,
                    ProcessTypes.FILTRATION,
                    ProcessTypes.TRANSFER,
                    ProcessTypes.FLAVOR_ADDITION,
                    ProcessTypes.OTHER,
                    ProcessTypes.EXTRACTION,
                    ProcessTypes.CENTRIFUGE,
                    ProcessTypes.COOLING,
                    ProcessTypes.HOLDING,
                    ProcessTypes.MEMBRANE_FILTRATION,
                ];
                if (baseTypes.includes(type as any)) {
                    return { success: false, error: '系统默认类型不能删除' };
                }

                // 检查是否被使用
                const usageCheck = get().isTypeInUse(type);
                if (usageCheck.inUse) {
                    return {
                        success: false,
                        error: '该类型正在被使用，无法删除',
                        usageLocations: usageCheck.locations,
                    };
                }

                // 删除模板和名称
                set((state) => {
                    const newTemplates = { ...state.subStepTemplates };
                    delete newTemplates[type];
                    const newNames = { ...state.customTypeNames };
                    delete newNames[type];
                    return {
                        subStepTemplates: newTemplates,
                        customTypeNames: newNames,
                    };
                });

                return { success: true };
            },

            getAllSubStepTypes: () => {
                return Object.keys(get().subStepTemplates);
            },

            isTypeInUse: (type) => {
                // 动态导入 useRecipeStore 以避免循环依赖
                const { useRecipeStore } = require('./useRecipeStore');
                const processes = useRecipeStore.getState().processes;
                const locations: string[] = [];

                processes.forEach((process) => {
                    process.node.subSteps.forEach((subStep) => {
                        if (subStep.processType === type) {
                            locations.push(`${process.name} > ${subStep.label}`);
                        }
                    });
                });

                return {
                    inUse: locations.length > 0,
                    locations,
                };
            },

            registerProcessTypeName: (type, name) => {
                set((state) => ({
                    customTypeNames: {
                        ...state.customTypeNames,
                        [type]: name,
                    },
                }));
            },

            getProcessSegmentTemplate: (id) => {
                return get().processSegmentTemplates.find((t) => t.id === id);
            },

            addProcessSegmentTemplate: (template) => {
                set((state) => ({
                    processSegmentTemplates: [...state.processSegmentTemplates, template],
                }));
            },

            updateProcessSegmentTemplate: (id, updates) => {
                set((state) => ({
                    processSegmentTemplates: state.processSegmentTemplates.map((t) =>
                        t.id === id
                            ? { ...t, ...updates, version: t.version + 1 }
                            : t
                    ),
                }));
            },

            removeProcessSegmentTemplate: (id) => {
                set((state) => ({
                    processSegmentTemplates: state.processSegmentTemplates.filter((t) => t.id !== id),
                }));
            },

            resetToDefaults: () => {
                set({
                    subStepTemplates: { ...DEFAULT_SUBSTEP_TEMPLATES },
                    processSegmentTemplates: [...DEFAULT_PROCESS_SEGMENT_TEMPLATES],
                    customTypeNames: {},
                });
            },
        }),
        {
            name: 'process-type-config',
        }
    )
);
