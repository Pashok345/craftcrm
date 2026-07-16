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
import { Textarea } from '@/components/ui/textarea';

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
  requirements?: string;
  resultDescription?: string;
  conditionExpression?: string;
  actionType?: 'create_task' | 'send_email' | 'notify';
  actionConfig?: string;
}


export interface ProcessFlow {
  nodes: Node<StepNodeData>[];
  edges: Edge[];
}

const STEP_META: Record<
  StepNodeData['stepType'],
  { label: string; color: string; icon: typeof Play; hint: string }
> = {
  start: { label: 'Початок', color: '#22c55e', icon: Play, hint: 'Точка входу — з неї стартує процес.' },
  task: { label: 'Задача', color: '#3b82f6', icon: FileText, hint: 'Ручний крок: виконавець робить роботу і позначає крок завершеним.' },
  approval: { label: 'Погодження', color: '#a855f7', icon: UserCheck, hint: 'Виконавець приймає рішення: погодити / відхилити / повернути на доопрацювання.' },
  condition: { label: 'Умова', color: '#f59e0b', icon: GitBranch, hint: 'Автоматична розгалузка за формулою (напр. amount > 50000).' },
  action: { label: 'Дія', color: '#06b6d4', icon: Zap, hint: 'Автоматична дія: сповіщення, лист, створення задачі.' },
  end: { label: 'Кінець', color: '#ef4444', icon: Flag, hint: 'Завершення процесу.' },
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
              title={meta.hint}
              className="w-full justify-start h-auto py-2"
              onClick={() => addNode(k)}
            >
              <span
                className="h-2.5 w-2.5 rounded-full mr-2 shrink-0"
                style={{ backgroundColor: meta.color }}
              />
              <Icon className="h-3.5 w-3.5 mr-1.5 shrink-0" />
              <span className="text-left">
                <span className="block leading-tight">{meta.label}</span>
                <span className="block text-[10px] font-normal text-muted-foreground leading-tight mt-0.5 whitespace-normal">
                  {meta.hint}
                </span>
              </span>
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

          <p className="text-[11px] text-muted-foreground -mt-1 leading-snug">
            {STEP_META[selectedNode.data.stepType].hint}
          </p>

          <div className="space-y-1.5">
            <Label className="text-xs">{t('name') || 'Назва кроку'}</Label>
            <Input
              value={selectedNode.data.label}
              onChange={(e) => updateSelected({ label: e.target.value })}
              placeholder="Напр. Перевірити рахунок"
            />
          </div>

          {selectedNode.data.stepType !== 'start' && selectedNode.data.stepType !== 'end' && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('stepDescription') || 'Опис кроку'}</Label>
                <Textarea
                  rows={2}
                  value={selectedNode.data.description || ''}
                  onChange={(e) => updateSelected({ description: e.target.value })}
                  placeholder="Що саме потрібно зробити на цьому кроці"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">{t('stepRequirements') || 'Вимоги / вхідні дані'}</Label>
                <Textarea
                  rows={2}
                  value={selectedNode.data.requirements || ''}
                  onChange={(e) => updateSelected({ requirements: e.target.value })}
                  placeholder="Що має бути в наявності до старту кроку (файли, згоди, дані)"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">{t('stepResult') || 'Очікуваний результат'}</Label>
                <Textarea
                  rows={2}
                  value={selectedNode.data.resultDescription || ''}
                  onChange={(e) => updateSelected({ resultDescription: e.target.value })}
                  placeholder="Який результат вважається успішним завершенням кроку"
                />
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">{t('color') || 'Колір блока'}</Label>
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
                <Label className="text-xs">
                  {t('deadlineHours') || 'Термін виконання (годин)'}
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={selectedNode.data.slaHours ?? ''}
                  onChange={(e) => updateSelected({ slaHours: e.target.value ? Number(e.target.value) : null })}
                  placeholder="Напр. 24"
                />
                <p className="text-[10px] text-muted-foreground leading-tight">
                  За скільки годин крок має бути завершений після старту. Якщо час вичерпано — виконавець отримає нагадування.
                </p>
              </div>
            </>
          )}

          {selectedNode.data.stepType === 'condition' && (
            <div className="space-y-1.5">
              <Label className="text-xs">{t('conditionExpression') || 'Умова розгалуження'}</Label>
              <Input
                value={selectedNode.data.conditionExpression || ''}
                onChange={(e) => updateSelected({ conditionExpression: e.target.value })}
                placeholder="amount > 50000"
              />
              <p className="text-[10px] text-muted-foreground leading-tight">
                Формула на основі полів запуску. Якщо true — процес піде далі за схемою.
              </p>
            </div>
          )}

          {selectedNode.data.stepType === 'action' && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('actionType') || 'Тип автоматичної дії'}</Label>
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
              <div className="space-y-1.5">
                <Label className="text-xs">{t('actionConfig') || 'Параметри дії'}</Label>
                <Textarea
                  rows={2}
                  value={selectedNode.data.actionConfig || ''}
                  onChange={(e) => updateSelected({ actionConfig: e.target.value })}
                  placeholder="Текст листа / повідомлення або назва задачі"
                />
              </div>
            </>
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
