import { useRef } from 'react';
import { socketService } from '../services/socketService';
import { useCollabStore } from '../store/useCollabStore';
import { useRecipeStore } from '../store/useRecipeStore';
import { RecipeSchema } from '../types/recipe';

export function useDemoMode() {
  const { mode, setMode } = useCollabStore();
  const { nodes, edges, metadata, setNodes, setEdges, exportJSON, syncFromServer } = useRecipeStore();
  const isDemoMode = mode === 'demo';

  // 进入演示模式时保存服务器数据快照
  const serverSnapshotRef = useRef<RecipeSchema | null>(null);

  const enterDemoMode = () => {
    // 保存当前服务器数据
    serverSnapshotRef.current = {
      metadata,
      nodes,
      edges,
    };
    setMode('demo');
    socketService.emit('mode:demo');
  };

  const exitDemoMode = async () => {
    // 从服务器重新加载最新数据
    try {
      const response = await fetch('http://localhost:3001/api/recipe');
      if (response.ok) {
        const recipe = await response.json();
        syncFromServer(recipe, recipe.version || 1);
      } else {
        // 如果服务器请求失败，使用快照恢复
        if (serverSnapshotRef.current) {
          const { nodes: savedNodes, edges: savedEdges } = serverSnapshotRef.current;
          setNodes(savedNodes);
          setEdges(savedEdges);
        }
      }
    } catch (error) {
      console.error('退出演示模式时加载服务器数据失败:', error);
      // 使用快照恢复
      if (serverSnapshotRef.current) {
        const { nodes: savedNodes, edges: savedEdges } = serverSnapshotRef.current;
        setNodes(savedNodes);
        setEdges(savedEdges);
      }
    }
    serverSnapshotRef.current = null;
    setMode('view');
    socketService.emit('mode:view');
  };

  const exportDemoData = () => {
    const json = exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `demo-recipe-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return {
    isDemoMode,
    enterDemoMode,
    exitDemoMode,
    exportDemoData,
  };
}
