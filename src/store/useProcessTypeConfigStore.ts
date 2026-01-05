import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ProcessType } from '../types/recipe';
import {
    SubStepTemplate,
    ProcessSegmentTemplate,
    DEFAULT_SUBSTEP_TEMPLATES,
    DEFAULT_PROCESS_SEGMENT_TEMPLATES,
} from '../types/processTypeConfig';

interface ProcessTypeConfigStore {
    // 子步骤模板
    subStepTemplates: Record<ProcessType, SubStepTemplate>;
    // 工艺段模板
    processSegmentTemplates: ProcessSegmentTemplate[];

    // 获取子步骤模板
    getSubStepTemplate: (type: ProcessType) => SubStepTemplate;
    // 更新子步骤模板
    updateSubStepTemplate: (type: ProcessType, updates: Partial<SubStepTemplate>) => void;

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

            getSubStepTemplate: (type) => {
                return get().subStepTemplates[type];
            },

            updateSubStepTemplate: (type, updates) => {
                set((state) => ({
                    subStepTemplates: {
                        ...state.subStepTemplates,
                        [type]: {
                            ...state.subStepTemplates[type],
                            ...updates,
                            version: state.subStepTemplates[type].version + 1,
                        },
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
                });
            },
        }),
        {
            name: 'process-type-config',
        }
    )
);
