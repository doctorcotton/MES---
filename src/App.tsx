import { useEffect, useRef } from 'react';
import { Panel, Group, Separator } from 'react-resizable-panels';
import { AppLayout } from './components/layout/AppLayout';
import { RecipeTable } from './components/editor/RecipeTable';
import { RecipeFlow } from './components/graph/RecipeFlow';
import { GanttView } from './components/scheduling/GanttView';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './components/ui/tabs';
import { socketService } from './services/socketService';
import { useCollabStore } from './store/useCollabStore';
import { useSocketSync } from './hooks/useSocketSync';
import { useAutoSave } from './hooks/useAutoSave';
import { useHeartbeat } from './hooks/useHeartbeat';

function App() {
  const { setUser } = useCollabStore();
  const socketConnectedRef = useRef(false);

  // 初始化用户和Socket连接
  useEffect(() => {
    // 防止React StrictMode导致的重复连接
    if (socketConnectedRef.current) {
      return;
    }

    // 生成或获取用户ID
    let userId = localStorage.getItem('userId');
    let userName = localStorage.getItem('userName');

    if (!userId) {
      userId = `user_${Math.random().toString(36).substring(2, 10)}`;
      localStorage.setItem('userId', userId);
    }

    if (!userName) {
      const names = ['张三', '李四', '王五', '赵六', '钱七', '孙八', '周九', '吴十'];
      userName = names[Math.floor(Math.random() * names.length)] + Math.floor(Math.random() * 100);
      localStorage.setItem('userName', userName);
    }

    setUser(userId, userName);

    // 连接Socket（socketService内部会检查是否已连接）
    socketService.connect(userId, userName);
    socketConnectedRef.current = true;

    // 组件卸载时断开连接
    return () => {
      socketConnectedRef.current = false;
      socketService.disconnect();
    };
  }, [setUser]);

  // Socket同步
  useSocketSync();

  // 自动保存（编辑模式）
  useAutoSave();

  // 心跳（编辑模式）
  useHeartbeat();

  return (
    <AppLayout>
      <Group className="h-full w-full" orientation="horizontal">
        {/* Left Panel - Recipe Table */}
        <Panel defaultSize={40} minSize={20}>
          <div className="h-full w-full border-r bg-slate-50">
            <RecipeTable />
          </div>
        </Panel>

        <Separator className="w-1 bg-slate-200 hover:bg-blue-500 transition-colors cursor-col-resize" />

        {/* Right Panel - Flow Graph / Gantt View */}
        <Panel defaultSize={60} minSize={20}>
          <div className="h-full w-full bg-white flex flex-col">
            <Tabs defaultValue="flow" className="h-full flex flex-col">
              <div className="border-b px-4 pt-2">
                <TabsList>
                  <TabsTrigger value="flow">流程图</TabsTrigger>
                  <TabsTrigger value="gantt">甘特图</TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="flow" className="flex-1 overflow-hidden m-0">
                <RecipeFlow />
              </TabsContent>
              <TabsContent value="gantt" className="flex-1 overflow-hidden m-0">
                <GanttView />
              </TabsContent>
            </Tabs>
          </div>
        </Panel>
      </Group>
    </AppLayout>
  );
}

export default App;
