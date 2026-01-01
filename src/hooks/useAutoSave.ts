import { useEffect, useRef } from 'react';
import { useRecipeStore } from '../store/useRecipeStore';
import { useCollabStore } from '../store/useCollabStore';
import { socketService } from '../services/socketService';

const SAVE_DEBOUNCE = 3000; // 3秒防抖

export function useAutoSave() {
  const { nodes, edges, metadata, version, setSaving } = useRecipeStore();
  const { mode, userId, isEditable } = useCollabStore();
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // 只在编辑模式下自动保存
    if (mode !== 'edit' || !isEditable()) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      return;
    }

    // 清除之前的定时器
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // 设置新的保存定时器
    saveTimeoutRef.current = setTimeout(async () => {
      if (!userId) return;

      setSaving(true);
      try {
        const recipeData = {
          metadata,
          nodes: nodes.map(({ position, ...node }) => node),
          edges,
          version,
        };

        const response = await fetch('http://localhost:3001/api/recipe', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            recipeData,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          console.error('保存失败:', error);
        }
      } catch (error) {
        console.error('保存错误:', error);
      } finally {
        setSaving(false);
      }
    }, SAVE_DEBOUNCE);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [nodes, edges, metadata, version, mode, userId, setSaving]);
}
