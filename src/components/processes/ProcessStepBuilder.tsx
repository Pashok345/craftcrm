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
  { labelKey: string; hintKey: string; color: string; icon: typeof Play }
> = {
  start:     { labelKey: 'stepTypeStart',     hintKey: 'stepHintStart',     color: '#22c55e', icon: Play },
  task:      { labelKey: 'stepTypeTask',      hintKey: 'stepHintTask',      color: '#3b82f6', icon: FileText },
  approval:  { labelKey: 'stepTypeApproval',  hintKey: 'stepHintApproval',  color: '#a855f7', icon: UserCheck },
  condition: { labelKey: 'stepTypeCondition', hintKey: 'stepHintCondition', color: '#f59e0b', icon: GitBranch },
  action:    { labelKey: 'stepTypeAction',    hintKey: 'stepHintAction',    color: '#06b6d4', icon: Zap },
  end:       { labelKey: 'stepTypeEnd',       hintKey: 'stepHintEnd',       color: '#ef4444', icon: Flag },
};

function StepNode({ data, selected }: { data: StepNodeData; selected: boolean }) {
  const meta = STEP_META[data.stepType] || STEP_META.task;
  const { t } = useLanguage();
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
        {t(meta.labelKey)}
      </div>
      <div className="px-3 py-2 text-sm font-medium">{data.label || '—'}</div>
      {data.stepType !== 'end' && (
        <Handle type="source" position={Position.Right} style={{ background: color }} />
      )}
    </div>
  );
}

const nodeTypes: NodeTypes = { step: StepNode };

interface Profile { user_id: string; name: string; }

interface Props {
  value: ProcessFlow;
  onChange: (flow: ProcessFlow) => void;
}

export function ProcessStepBuilder({ value, onChange }: Props) {
  const { t } = useLanguage();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const initial = useMemo(() => {
    if (value?.nodes?.length) return value;
    return {
      nodes: [
        {
          id: 'start',
          type: 'step',
          position: { x: 40, y: 160 },
          data: { label: t('stepTypeStart') || 'Старт', stepType: 'start' as const, color: '#22c55e' },
        },
      ],
      edges: [],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // Auto-position to the right of the last node and auto-connect from previous tip
    const anchor =
      (selectedId && nodes.find((n) => n.id === selectedId)) ||
      // last node that has no outgoing edge -> the current tip
      [...nodes].reverse().find((n) => !edges.some((e) => e.source === n.id)) ||
      nodes[nodes.length - 1];
    const pos = anchor
      ? { x: anchor.position.x + 240, y: anchor.position.y }
      : { x: 250, y: 160 };
    const newNode: Node<StepNodeData> = {
      id, type: 'step', position: pos,
      data: { label: t(meta.labelKey), stepType, color: meta.color },
    };
    setNodes((nds) => [...nds, newNode]);
    if (anchor && stepType !== 'start' && anchor.data.stepType !== 'end') {
      setEdges((eds) =>
        addEdge(
          { id: `e_${anchor.id}_${id}`, source: anchor.id, target: id, markerEnd: { type: MarkerType.ArrowClosed } },
          eds
        )
      );
    }
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
    <div className="flex flex-col gap-3 border rounded-lg overflow-hidden bg-muted/20">
      {/* Compact horizontal palette on top */}
      <div className="flex flex-wrap items-center gap-2 border-b bg-background p-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase mr-1">
          {t('addBlock')}:
        </span>
        {(Object.keys(STEP_META) as StepNodeData['stepType'][]).filter((k) => k !== 'start').map((k) => {
          const meta = STEP_META[k];
          const Icon = meta.icon;
          return (
            <Button
              key={k}
              type="button"
              variant="outline"
              size="sm"
              title={t(meta.hintKey)}
              onClick={() => addNode(k)}
              className="h-8"
            >
              <span
                className="h-2 w-2 rounded-full mr-1.5"
                style={{ backgroundColor: meta.color }}
              />
              <Icon className="h-3.5 w-3.5 mr-1" />
              {t(meta.labelKey)}
            </Button>
          );
        })}
      </div>

      <div className="flex flex-col md:flex-row gap-0 h-[520px]">
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
                {t(STEP_META[selectedNode.data.stepType].labelKey)}
              </div>
              <Button size="icon" variant="ghost" onClick={() => setSelectedId(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <p className="text-[11px] text-muted-foreground -mt-1 leading-snug">
              {t(STEP_META[selectedNode.data.stepType].hintKey)}
            </p>

            <div className="space-y-1.5">
              <Label className="text-xs">{t('stepName')}</Label>
              <Input
                value={selectedNode.data.label}
                onChange={(e) => updateSelected({ label: e.target.value })}
                placeholder={t('stepNamePlaceholder')}
              />
            </div>

            {selectedNode.data.stepType !== 'start' && selectedNode.data.stepType !== 'end' && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('stepDescription')}</Label>
                  <Textarea
                    rows={2}
                    value={selectedNode.data.description || ''}
                    onChange={(e) => updateSelected({ description: e.target.value })}
                    placeholder={t('stepDescriptionPlaceholder')}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">{t('stepRequirements')}</Label>
                  <Textarea
                    rows={2}
                    value={selectedNode.data.requirements || ''}
                    onChange={(e) => updateSelected({ requirements: e.target.value })}
                    placeholder={t('stepRequirementsPlaceholder')}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">{t('stepResult')}</Label>
                  <Textarea
                    rows={2}
                    value={selectedNode.data.resultDescription || ''}
                    onChange={(e) => updateSelected({ resultDescription: e.target.value })}
                    placeholder={t('stepResultPlaceholder')}
                  />
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">{t('processBlockColor')}</Label>
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
                  <Label className="text-xs">{t('assignee')}</Label>
                  <Select
                    value={selectedNode.data.assigneeUserId || '__none__'}
                    onValueChange={(v) => updateSelected({ assigneeUserId: v === '__none__' ? null : v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{t('initiator')}</SelectItem>
                      {profiles.map((p) => (
                        <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('deadlineHours')}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={selectedNode.data.slaHours ?? ''}
                    onChange={(e) => updateSelected({ slaHours: e.target.value ? Number(e.target.value) : null })}
                    placeholder="24"
                  />
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    {t('deadlineHoursHint')}
                  </p>
                </div>
              </>
            )}

            {selectedNode.data.stepType === 'condition' && (
              <div className="space-y-1.5">
                <Label className="text-xs">{t('conditionExpression')}</Label>
                <Input
                  value={selectedNode.data.conditionExpression || ''}
                  onChange={(e) => updateSelected({ conditionExpression: e.target.value })}
                  placeholder="amount > 50000"
                />
                <p className="text-[10px] text-muted-foreground leading-tight">
                  {t('conditionHint')}
                </p>
              </div>
            )}

            {selectedNode.data.stepType === 'action' && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('actionType')}</Label>
                  <Select
                    value={selectedNode.data.actionType || 'notify'}
                    onValueChange={(v) => updateSelected({ actionType: v as StepNodeData['actionType'] })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="notify">{t('sendNotification')}</SelectItem>
                      <SelectItem value="create_task">{t('createTaskAction')}</SelectItem>
                      <SelectItem value="send_email">{t('sendEmail')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('actionConfig')}</Label>
                  <Textarea
                    rows={2}
                    value={selectedNode.data.actionConfig || ''}
                    onChange={(e) => updateSelected({ actionConfig: e.target.value })}
                    placeholder={t('actionConfigPlaceholder')}
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
                {t('delete')}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
