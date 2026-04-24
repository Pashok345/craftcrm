import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Excalidraw, serializeAsJSON, restore } from '@excalidraw/excalidraw';
import type { AppState, BinaryFiles, ExcalidrawElement, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import '@excalidraw/excalidraw/index.css';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Users, Loader2, Save, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { WhiteboardMembersDialog } from '@/components/whiteboards/WhiteboardMembersDialog';

interface Whiteboard {
  id: string;
  title: string;
  description: string | null;
  created_by: string;
  project_id: string | null;
}

interface PresenceUser {
  user_id: string;
  name: string;
  avatar_url: string | null;
  avatar_color: string | null;
}

interface ExcalidrawSnapshot {
  type: 'excalidraw';
  version: 1;
  elements: readonly ExcalidrawElement[];
  appState: Partial<AppState>;
  files: BinaryFiles;
}

const WhiteboardDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [board, setBoard] = useState<Whiteboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [title, setTitle] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [presence, setPresence] = useState<PresenceUser[]>([]);

  const excalidrawApiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const isApplyingRemoteRef = useRef(false);
  const initialSnapshotRef = useRef<ExcalidrawSnapshot | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastLocalSavedAtRef = useRef<number>(0);

  useEffect(() => {
    if (!id) return;
    init();
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/auth');
      return;
    }
    setUserId(user.id);

    const { data: b, error } = await supabase
      .from('whiteboards')
      .select('*')
      .eq('id', id!)
      .maybeSingle();

    if (error || !b) {
      toast.error(t('whiteboardLoadError'));
      navigate('/whiteboards');
      return;
    }

    setBoard(b as any);
    setTitle((b as any).title);

    // Determine edit rights
    const isOwner = (b as any).created_by === user.id;
    let canE = isOwner;
    if (!canE) {
      const { data: m } = await supabase
        .from('whiteboard_members')
        .select('role')
        .eq('whiteboard_id', id!)
        .eq('user_id', user.id)
        .maybeSingle();
      if (m && (m as any).role === 'editor') canE = true;
      // project members are editors per RLS
      if (!canE && (b as any).project_id) {
        const { data: pm } = await supabase
          .from('project_members')
          .select('id')
          .eq('project_id', (b as any).project_id)
          .eq('user_id', user.id)
          .maybeSingle();
        if (pm) canE = true;
      }
    }
    setCanEdit(canE);

    // Load snapshot
    const { data: snap } = await supabase
      .from('whiteboard_snapshots')
      .select('snapshot, updated_at, updated_by')
      .eq('whiteboard_id', id!)
      .maybeSingle();

    const rawSnapshot = (snap as any)?.snapshot;
    if (rawSnapshot && typeof rawSnapshot === 'object') {
      if ((rawSnapshot as any).type === 'excalidraw') {
        initialSnapshotRef.current = rawSnapshot as ExcalidrawSnapshot;
      } else {
        initialSnapshotRef.current = {
          type: 'excalidraw',
          version: 1,
          elements: [],
          appState: {},
          files: {},
        };
      }
    }

    setLoading(false);

    // Setup realtime subscription for snapshot changes from others
    const channel = supabase
      .channel(`whiteboard:${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whiteboard_snapshots',
          filter: `whiteboard_id=eq.${id}`,
        },
        (payload) => {
          const newRow: any = payload.new;
          if (!newRow || !excalidrawApiRef.current) return;
          // Ignore our own writes (within 1.5s)
          if (newRow.updated_by === user.id) return;
          if (Date.now() - lastLocalSavedAtRef.current < 1500) return;
          if (!newRow.snapshot || newRow.snapshot.type !== 'excalidraw') return;
          try {
            isApplyingRemoteRef.current = true;
            excalidrawApiRef.current.updateScene({
              elements: newRow.snapshot.elements || [],
              appState: newRow.snapshot.appState || {},
              collaborators: new Map(),
              captureUpdate: 'NEVER',
            });
          } catch (e) {
            console.error('[whiteboard] failed to apply remote snapshot', e);
          } finally {
            setTimeout(() => {
              isApplyingRemoteRef.current = false;
            }, 100);
          }
        },
      )
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users: PresenceUser[] = [];
        Object.values(state).forEach((arr: any) => {
          arr.forEach((p: any) => {
            if (p.user_id !== user.id) users.push(p);
          });
        });
        // dedupe
        const map = new Map<string, PresenceUser>();
        users.forEach((u) => map.set(u.user_id, u));
        setPresence(Array.from(map.values()));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Fetch self profile for presence
          const { data: prof } = await supabase
            .from('profiles')
            .select('name, avatar_url, avatar_color')
            .eq('user_id', user.id)
            .maybeSingle();
          await channel.track({
            user_id: user.id,
            name: (prof as any)?.name || 'User',
            avatar_url: (prof as any)?.avatar_url || null,
            avatar_color: (prof as any)?.avatar_color || null,
          });
        }
      });
    channelRef.current = channel;
  };

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistSnapshot = (snapshot: ExcalidrawSnapshot) => {
    if (!id || !userId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaving(true);
    saveTimerRef.current = setTimeout(async () => {
      lastLocalSavedAtRef.current = Date.now();
      const { error } = await supabase
        .from('whiteboard_snapshots')
        .upsert(
          {
            whiteboard_id: id,
            snapshot,
            updated_by: userId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'whiteboard_id' },
        );
      await supabase.from('whiteboards').update({ updated_at: new Date().toISOString() }).eq('id', id);
      setSaving(false);
      if (error) {
        console.error('[whiteboard] save error', error);
        toast.error(t('whiteboardSaveError'));
      } else {
        setSavedAt(new Date());
      }
    }, 1500);
  };

  const handleChange = (
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    files: BinaryFiles,
  ) => {
    if (isApplyingRemoteRef.current || !canEdit) return;

    const snapshot: ExcalidrawSnapshot = {
      type: 'excalidraw',
      version: 1,
      elements,
      appState: {
        viewBackgroundColor: appState.viewBackgroundColor,
        gridSize: appState.gridSize,
        zoom: appState.zoom,
        scrollX: appState.scrollX,
        scrollY: appState.scrollY,
        theme: appState.theme,
        currentItemStrokeColor: appState.currentItemStrokeColor,
        currentItemBackgroundColor: appState.currentItemBackgroundColor,
        currentItemFillStyle: appState.currentItemFillStyle,
        currentItemStrokeWidth: appState.currentItemStrokeWidth,
        currentItemStrokeStyle: appState.currentItemStrokeStyle,
        currentItemRoughness: appState.currentItemRoughness,
        currentItemOpacity: appState.currentItemOpacity,
        currentItemFontFamily: appState.currentItemFontFamily,
        currentItemFontSize: appState.currentItemFontSize,
        currentItemTextAlign: appState.currentItemTextAlign,
        currentItemStartArrowhead: appState.currentItemStartArrowhead,
        currentItemEndArrowhead: appState.currentItemEndArrowhead,
        currentItemRoundness: appState.currentItemRoundness,
      },
      files,
    };

    persistSnapshot(snapshot);
  };

  const getInitialData = async () => {
    const snapshot = initialSnapshotRef.current;
    if (!snapshot) return null;

    try {
      return restore({
        elements: snapshot.elements || [],
        appState: snapshot.appState || {},
        files: snapshot.files || {},
      }, null, { repairBindings: true });
    } catch (e) {
      console.error('[whiteboard] failed to load initial snapshot', e);
      return null;
    }
  };

  const saveTitle = async () => {
    if (!board || !title.trim() || title === board.title) {
      setEditingTitle(false);
      setTitle(board?.title || '');
      return;
    }
    const { error } = await supabase.from('whiteboards').update({ title: title.trim() }).eq('id', board.id);
    if (error) {
      toast.error(error.message);
      setTitle(board.title);
    } else {
      setBoard({ ...board, title: title.trim() });
    }
    setEditingTitle(false);
  };

  const initials = (name?: string) =>
    (name || '?')
      .split(' ')
      .map((s) => s[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!board) return null;

  return (
    <div className="fixed inset-0 flex flex-col bg-background z-30">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Button variant="ghost" size="icon" onClick={() => navigate('/whiteboards')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          {editingTitle && canEdit ? (
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveTitle();
                if (e.key === 'Escape') {
                  setTitle(board.title);
                  setEditingTitle(false);
                }
              }}
              autoFocus
              className="h-8 max-w-xs"
            />
          ) : (
            <h1
              className={`font-semibold truncate ${canEdit ? 'cursor-pointer hover:text-primary' : ''}`}
              onClick={() => canEdit && setEditingTitle(true)}
            >
              {board.title}
            </h1>
          )}
          {!canEdit && (
            <Badge variant="secondary" className="gap-1 shrink-0">
              <Eye className="h-3 w-3" />
              {t('whiteboardReadOnly')}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Presence avatars */}
          {presence.length > 0 && (
            <div className="flex -space-x-2 mr-2">
              {presence.slice(0, 4).map((p) => (
                <Avatar key={p.user_id} className="h-7 w-7 border-2 border-background" title={p.name}>
                  {p.avatar_url ? (
                    <AvatarImage src={p.avatar_url} />
                  ) : (
                    <AvatarFallback
                      style={{ backgroundColor: p.avatar_color || undefined }}
                      className="text-xs"
                    >
                      {initials(p.name)}
                    </AvatarFallback>
                  )}
                </Avatar>
              ))}
              {presence.length > 4 && (
                <div className="h-7 w-7 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs font-medium">
                  +{presence.length - 4}
                </div>
              )}
            </div>
          )}

          {/* Save indicator */}
          <div className="hidden sm:flex items-center text-xs text-muted-foreground min-w-[80px]">
            {saving ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                {t('whiteboardSaving')}
              </>
            ) : savedAt ? (
              <>
                <Save className="h-3 w-3 mr-1 text-primary" />
                {t('whiteboardSaved')}
              </>
            ) : null}
          </div>

          <Button variant="outline" size="sm" onClick={() => setMembersOpen(true)} className="gap-1">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">{t('whiteboardMembers')}</span>
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative overflow-hidden">
        <Excalidraw
          excalidrawAPI={(api) => {
            excalidrawApiRef.current = api;
          }}
          initialData={getInitialData}
          onChange={handleChange}
          viewModeEnabled={!canEdit}
          isCollaborating={presence.length > 0}
          detectScroll={false}
          autoFocus
          handleKeyboardGlobally
          UIOptions={{
            canvasActions: {
              changeViewBackgroundColor: canEdit,
              clearCanvas: canEdit,
              export: true,
              loadScene: false,
              saveToActiveFile: false,
              saveAsImage: true,
              toggleTheme: true,
            },
          }}
        />
      </div>

      {userId && (
        <WhiteboardMembersDialog
          open={membersOpen}
          onOpenChange={setMembersOpen}
          whiteboardId={board.id}
          ownerId={board.created_by}
          currentUserId={userId}
        />
      )}
    </div>
  );
};

export default WhiteboardDetail;
