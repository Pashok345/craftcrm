import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  MarkerType,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Play,
  UserCheck,
  FileText,
  GitBranch,
  Zap,
  Flag,
  Plus,
  Trash2,
  X,
} from 'lucide-react';

export interface StepNodeData extends Record<string, unknown> {
  label: string;
  stepType: 'start' | 'task' | 'approval' | 'condition' | 'action' | 'end';
  assigneeUserId?: string | null;
  slaHours?: number | null;
  color?: string;
  description?: string;
  conditionExpression?: string;
  actionType?: 'create_task' | 'send_email' | 'notify';
}

export interface ProcessFlow {
  nodes: Node<StepNodeData>[];
  edges: Edge[];
}

const STEP_META: Record<
  StepNodeData['stepType'],
  { label: string; color: string; icon: typeof Play }
> = {
  start: { label: 'Початок', color: '#22c55e', icon: Play },
  task: { label: 'Задача', color: '#3b82f6', icon: FileText },
  approval: { label: 'Погодження', color: '#a855f7', icon: UserCheck },
  condition: { label: 'Умова', color: '#f59e0b', icon: GitBranch },
  action: { label: 'Дія', color: '#06b6d4', icon: Zap },
  end: { label: 'Кінець', color: '#ef4444', icon: Flag },
};

function StepNode({ data, selected }: { data: StepNodeData; selected: boolean }) {
  const meta = STEP_META[data.stepType] || STEP_META.task;
  const Icon = meta.icon;
  const color = data.color || meta.color;
  return (
    <div
      className="rounded-lg border-2 bg-background shadow-sm min-w-[180px] transition-all"
      style={{
        borderColor: selected ? color : `${color}80`,
        boxShadow: selected ? `0 0 0 3px ${color}33` : undefined,
      }}
    >
      {data.stepType !== 'start' && (
        <Handle type="target" position={Position.Left} style={{ background: color }} />
      )}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-t-md text-white text-xs font-semibold"
        style={{ backgroundColor: color }}
      >
        <Icon className="h-3.5 w-3.5" />
        {meta.label}
      </div>
      <div className="px-3 py-2 text-sm font-medium">{data.label || '—'}</div>
      {data.stepType !== 'end' && (
        <Handle type="source" position={Position.Right} style={{ background: color }} />
      )}
    </div>
  );
}

const nodeTypes: NodeTypes = { step: StepNode };

interface Profile {
  user_id: string;
  name: string;
}

interface Props {
  value: ProcessFlow;
  onChange: (flow: ProcessFlow) => void;
}

export function ProcessStepBuilder({ value, onChange }: Props) {
  const { t } = useLanguage();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const initial = useMemo(() => {
    if (value?.nodes?.length) return value;
    // seed with Start node
    return {
      nodes: [
        {
          id: 'start',
          type: 'step',
          position: { x: 40, y: 100 },
          data: { label: 'Старт', stepType: 'start' as const, color: '#22c55e' },
        },
      ],
      edges: [],
    };
  }, []);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<StepNodeData>>(initial.nodes as Node<StepNodeData>[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initial.edges);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const idCounter = useRef(initial.nodes.length + 1);

  useEffect(() => {
    supabase.from('profiles').select('user_id, name').then(({ data }) => {
      if (data) setProfiles(data);
    });
  }, []);

  useEffect(() => {
    onChange({ nodes, edges });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge({ ...params, markerEnd: { type: MarkerType.ArrowClosed }, animated: false }, eds)
      ),
    [setEdges]
  );

  const addNode = (stepType: StepNodeData['stepType']) => {
    const id = `n_${Date.now()}_${idCounter.current++}`;
    const meta = STEP_META[stepType];
    const newNode: Node<StepNodeData> = {
      id,
      type: 'step',
      position: { x: 250 + Math.random() * 200, y: 100 + Math.random() * 200 },
      data: { label: meta.label, stepType, color: meta.color },
    };
    setNodes((nds) => [...nds, newNode]);
    setSelectedId(id);
  };

  const updateSelected = (patch: Partial<StepNodeData>) => {
    if (!selectedId) return;
    setNodes((nds) =>
      nds.map((n) => (n.id === selectedId ? { ...n, data: { ...n.data, ...patch } } : n))
    );
  };

  const deleteSelected = () => {
    if (!selectedId || selectedId === 'start') return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedId));
    setEdges((eds) => eds.filter((e) => e.source !== selectedId && e.target !== selectedId));
    setSelectedId(null);
  };

  const selectedNode = nodes.find((n) => n.id === selectedId);

  return (
    <div className="flex flex-col md:flex-row gap-3 h-[520px] border rounded-lg overflow-hidden bg-muted/20">
      {/* Palette */}
      <div className="md:w-44 shrink-0 border-b md:border-b-0 md:border-r bg-background p-3 space-y-2 overflow-y-auto">
        <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">
          {t('addBlock') || 'Додати блок'}
        </div>
        {(Object.keys(STEP_META) as StepNodeData['stepType'][]).filter((k) => k !== 'start').map((k) => {
          const meta = STEP_META[k];
          const Icon = meta.icon;
          return (
            <Button
              key={k}
              type="button"
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={() => addNode(k)}
            >
              <span
                className="h-2.5 w-2.5 rounded-full mr-2"
                style={{ backgroundColor: meta.color }}
              />
              <Icon className="h-3.5 w-3.5 mr-1.5" />
              {meta.label}
            </Button>
          );
        })}
      </div>

      {/* Canvas */}
      <div className="flex-1 min-w-0 relative">
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, n) => setSelectedId(n.id)}
            onPaneClick={() => setSelectedId(null)}
            nodeTypes={nodeTypes}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={16} size={1} />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable style={{ height: 80 }} />
          </ReactFlow>
        </ReactFlowProvider>
      </div>

      {/* Inspector */}
      {selectedNode && (
        <div className="md:w-72 shrink-0 border-t md:border-t-0 md:border-l bg-background p-3 space-y-3 overflow-y-auto">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase text-muted-foreground">
              {STEP_META[selectedNode.data.stepType].label}
            </div>
            <Button size="icon" variant="ghost" onClick={() => setSelectedId(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">{t('name') || 'Назва'}</Label>
            <Input
              value={selectedNode.data.label}
              onChange={(e) => updateSelected({ label: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">{t('color') || 'Колір'}</Label>
            <input
              type="color"
              value={selectedNode.data.color || STEP_META[selectedNode.data.stepType].color}
              onChange={(e) => updateSelected({ color: e.target.value })}
              className="h-9 w-full rounded border cursor-pointer"
            />
          </div>

          {(selectedNode.data.stepType === 'task' || selectedNode.data.stepType === 'approval') && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('assignee') || 'Виконавець'}</Label>
                <Select
                  value={selectedNode.data.assigneeUserId || '__none__'}
                  onValueChange={(v) => updateSelected({ assigneeUserId: v === '__none__' ? null : v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t('initiator') || 'Ініціатор запуску'}</SelectItem>
                    {profiles.map((p) => (
                      <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">SLA ({t('hours') || 'годин'})</Label>
                <Input
                  type="number"
                  min={0}
                  value={selectedNode.data.slaHours ?? ''}
                  onChange={(e) => updateSelected({ slaHours: e.target.value ? Number(e.target.value) : null })}
                />
              </div>
            </>
          )}

          {selectedNode.data.stepType === 'condition' && (
            <div className="space-y-1.5">
              <Label className="text-xs">{t('conditionExpression') || 'Умова (напр. amount > 50000)'}</Label>
              <Input
                value={selectedNode.data.conditionExpression || ''}
                onChange={(e) => updateSelected({ conditionExpression: e.target.value })}
                placeholder="amount > 50000"
              />
            </div>
          )}

          {selectedNode.data.stepType === 'action' && (
            <div className="space-y-1.5">
              <Label className="text-xs">{t('actionType') || 'Тип дії'}</Label>
              <Select
                value={selectedNode.data.actionType || 'notify'}
                onValueChange={(v) => updateSelected({ actionType: v as StepNodeData['actionType'] })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="notify">{t('sendNotification') || 'Надіслати сповіщення'}</SelectItem>
                  <SelectItem value="create_task">{t('createTaskAction') || 'Створити задачу'}</SelectItem>
                  <SelectItem value="send_email">{t('sendEmail') || 'Надіслати email'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {selectedNode.id !== 'start' && (
            <Button
              variant="destructive"
              size="sm"
              className="w-full mt-2"
              onClick={deleteSelected}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {t('delete') || 'Видалити'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
