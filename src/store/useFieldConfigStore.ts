import { create } from 'zustand';
import { FieldConfig, ProcessType } from '../types/fieldConfig';
import { fieldConfigService } from '../services/fieldConfigService';

interface FieldConfigState {
    configs: FieldConfig[];
    isLoading: boolean;
    error: string | null;
    revision: number; // 配置版本号，用于触发布局重算

    fetchConfigs: () => Promise<void>;
    addConfig: (config: Partial<FieldConfig>) => Promise<void>;
    updateConfig: (id: string, updates: Partial<FieldConfig>) => Promise<void>;
    deleteConfig: (id: string) => Promise<void>;
    reorderConfig: (id: string, newOrder: number) => Promise<void>;
    getConfigsByProcessType: (type: ProcessType) => FieldConfig[];
    getAllConfigsByProcessType: (type: ProcessType) => FieldConfig[];
}

export const useFieldConfigStore = create<FieldConfigState>((set, get) => ({
    configs: [],
    isLoading: false,
    error: null,
    revision: 0, // 初始版本号

    fetchConfigs: async () => {
        set({ isLoading: true, error: null });
        try {
            const configs = await fieldConfigService.getAllConfigs();
            set({ configs, isLoading: false, revision: get().revision + 1 });
        } catch (error: any) {
            set({ error: error.message, isLoading: false });
        }
    },

    addConfig: async (config) => {
        set({ isLoading: true });
        try {
            await fieldConfigService.createConfig(config);
            await get().fetchConfigs(); // fetchConfigs 内部会递增 revision
        } catch (error: any) {
            set({ error: error.message, isLoading: false });
            throw error;
        }
    },

    updateConfig: async (id, updates) => {
        set({ isLoading: true });
        try {
            await fieldConfigService.updateConfig(id, updates);
            await get().fetchConfigs(); // fetchConfigs 内部会递增 revision
        } catch (error: any) {
            set({ error: error.message, isLoading: false });
            throw error;
        }
    },

    deleteConfig: async (id) => {
        set({ isLoading: true });
        try {
            await fieldConfigService.deleteConfig(id);
            await get().fetchConfigs(); // fetchConfigs 内部会递增 revision
        } catch (error: any) {
            set({ error: error.message, isLoading: false });
            throw error;
        }
    },

    reorderConfig: async (id, newOrder) => {
        // Optimistic update would be good here, but for now simple reload
        await get().updateConfig(id, { sortOrder: newOrder });
    },

    getConfigsByProcessType: (type) => {
        return get().configs
            .filter(c => c.processType === type && c.enabled)
            .sort((a, b) => a.sortOrder - b.sortOrder);
    },
    
    getAllConfigsByProcessType: (type) => {
        return get().configs
            .filter(c => c.processType === type)
            .sort((a, b) => a.sortOrder - b.sortOrder);
    }
}));
