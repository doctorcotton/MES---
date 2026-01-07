import { useEffect, useRef } from 'react';
import { useRecipeStore } from '../store/useRecipeStore';
import { useCollabStore } from '../store/useCollabStore';
import { socketService } from '../services/socketService';


const SAVE_DEBOUNCE = 3000; // 3秒防抖

/**
 * 计算数据签名（用于判断是否真的发生了业务变更）
 * 只包含稳定的业务字段，排除 updatedAt 等会频繁变化的元数据
 */
function calculateDataSignature(processes: any[], edges: any[]): string {
  // processes 签名：只包含 id、子步骤 id 和顺序
  const processesSig = processes.map(p => ({
    id: p.id,
    subStepIds: p.node.subSteps.map((s: any) => s.id).join(','),
  })).sort((a, b) => a.id.localeCompare(b.id));
  
  // edges 签名：只包含 source、target、sequenceOrder
  const edgesSig = edges.map(e => ({
    source: e.source,
    target: e.target,
    sequenceOrder: e.data?.sequenceOrder || 0,
  })).sort((a, b) => {
    if (a.source !== b.source) return a.source.localeCompare(b.source);
    if (a.target !== b.target) return a.target.localeCompare(b.target);
    return a.sequenceOrder - b.sequenceOrder;
  });
  
  return JSON.stringify({
    processes: processesSig,
    edges: edgesSig,
  });
}

export function useAutoSave() {
  const { processes, edges, metadata, version, setSaving, setVersion } = useRecipeStore();
  const { mode, userId, isEditable } = useCollabStore();
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedSignatureRef = useRef<string | null>(null);
  const hasInitializedSignatureRef = useRef(false);

  useEffect(() => {
    // 只在编辑模式下自动保存
    if (mode !== 'edit' || !isEditable()) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      lastSavedSignatureRef.current = null; // 退出编辑模式时重置签名
      hasInitializedSignatureRef.current = false;
      return;
    }

    // 计算当前数据签名
    const currentSignature = calculateDataSignature(processes, edges);

    // 进入编辑模式后的第一次：只建立“基线签名”，不立即触发保存
    // 避免“我没改任何东西也在自动保存/版本递增”的体验
    if (!hasInitializedSignatureRef.current) {
      lastSavedSignatureRef.current = currentSignature;
      hasInitializedSignatureRef.current = true;
      return;
    }
    
    // 如果签名与上次一致，说明数据没有实际变化，不触发保存
    if (lastSavedSignatureRef.current === currentSignature) {
      // 清除之前的定时器（如果有）
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
          processes: processes.map(process => ({
            ...process,
            node: {
              ...process.node,
              position: undefined, // 排除position
            },
          })),
          edges,
          version,
        };

        // 获取 socketId，用于服务端排除提交者
        const socketId = socketService.getSocket()?.id || null;
        
        const response = await fetch('http://localhost:3001/api/recipe', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            socketId, // 携带 socketId，服务端用于排除提交者
            recipeData,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          console.error('保存失败:', data);
        } else {
          // 保存成功后更新版本号和签名
          const newVersion = data.recipe?.version || data.version || version;
          if (newVersion !== version) {
            console.log('[useAutoSave] 更新版本号:', { old: version, new: newVersion });
            setVersion(newVersion);
          }
          // 重要：签名不包含 version，因此这里设置为“业务数据签名”即可，避免保存循环
          lastSavedSignatureRef.current = currentSignature;
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
  }, [processes, edges, metadata, version, mode, userId, setSaving, setVersion]);
}
