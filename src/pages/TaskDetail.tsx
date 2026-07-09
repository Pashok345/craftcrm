import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { Send, Paperclip, Calendar, Loader2, Pencil, Link2, ArrowLeft, Trash2, Plus, UserPlus, CheckSquare, MoreVertical, X, Check, Files, ListChecks, LayoutGrid, GripVertical, ChevronUp, ChevronDown, CornerDownRight } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { TaskBoardsTab } from '@/components/tasks/TaskBoardsTab';
import { CommentReactions } from '@/components/comments/CommentReactions';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format } from 'date-fns';
import { ru, enUS, uk } from 'date-fns/locale';
import { Task, TaskComment, TaskAttachment, Profile, TaskLink } from '@/types/database';
import { useAuth } from '@/hooks/useAuth';
import { linkifyText } from '@/utils/linkifyText';
import { TaskEditDialog } from '@/components/tasks/TaskEditDialog';
import { BlockMenu } from '@/components/tasks/BlockMenu';
import { ShareButton } from '@/components/share/ShareButton';

import { AddAssigneeDialog } from '@/components/tasks/AddAssigneeDialog';
import { TimeTracker } from '@/components/tasks/TimeTracker';
import { TagsManager } from '@/components/tasks/TagsManager';
import { SubtasksList } from '@/components/tasks/SubtasksList';
import { TaskFilesGallery } from '@/components/tasks/TaskFilesGallery';
import { TaskDependencies } from '@/components/tasks/TaskDependencies';
import { TaskCustomization, TaskCustomizationValue } from '@/components/tasks/TaskCustomization';
import { TaskBlocksToolbar, BlockType } from '@/components/tasks/TaskBlocksToolbar';
import { TaskCustomBlocks } from '@/components/tasks/TaskCustomBlocks';
import { useLanguage } from '@/contexts/LanguageContext';
import { FileIcon, getFileIcon } from '@/components/ui/file-icon';
import { ImageThumbnail, isImageFile } from '@/components/ui/image-lightbox';
import { AttachmentImage } from '@/components/ui/attachment-image';
import { MentionInput, parseMentionedUserIds, isAIComment, stripAIMarker } from '@/components/ui/mention-input';
import { maybeInvokeCommentAI } from '@/lib/aiComment';
import { Sparkles } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface CommentWithUser extends TaskComment {
  profile?: Profile;
  attachments?: TaskAttachment[];
}

const TaskDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [task, setTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<CommentWithUser[]>([]);
  const [newComment, setNewComment] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [assignees, setAssignees] = useState<{ user: Profile; role: string }[]>([]);
  const [taskAttachments, setTaskAttachments] = useState<TaskAttachment[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [addAssigneeOpen, setAddAssigneeOpen] = useState(false);
  const [creator, setCreator] = useState<Profile | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [deleteCommentId, setDeleteCommentId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const dateLocale = language === 'en' ? enUS : language === 'uk' ? uk : ru;

  // Persisted block order for the main task tab (per user, in localStorage)
  // Standard ids: 'details', 'subtasks', 'comments', 'dependencies', 'timeTracker'
  // Custom block ids are prefixed: 'cb:<uuid>'
  const REQUIRED_BLOCKS = ['details', 'subtasks', 'comments'];
  const OPTIONAL_BLOCKS = ['dependencies', 'timeTracker'];
  const DEFAULT_BLOCK_ORDER = ['details', 'subtasks', 'comments'];
  const blockOrderStorageKey = `taskDetail.blockOrder.${user?.id || 'guest'}.${id || ''}`;
  const enabledOptionalKey = `taskDetail.enabledOptional.${user?.id || 'guest'}.${id || ''}`;

  const [blockOrder, setBlockOrder] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(`taskDetail.blockOrder.${user?.id || 'guest'}.${id || ''}`);
      if (stored) {
        const parsed: string[] = JSON.parse(stored);
        // Keep required, optional and custom (cb:*) ids
        const merged = parsed.filter(b =>
          REQUIRED_BLOCKS.includes(b) || OPTIONAL_BLOCKS.includes(b) || b.startsWith('cb:')
        );
        REQUIRED_BLOCKS.forEach(b => { if (!merged.includes(b)) merged.push(b); });
        return merged;
      }
    } catch {}
    return DEFAULT_BLOCK_ORDER;
  });

  const [enabledOptional, setEnabledOptional] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(`taskDetail.enabledOptional.${user?.id || 'guest'}.${id || ''}`);
      if (stored) return JSON.parse(stored);
    } catch {}
    return [];
  });

  // Draft block: created immediately when user picks a type from the toolbar.
  // The block appears in place with a halo + ⬆/⬇/Add/Cancel controls so the
  // user can edit it, reposition it, then confirm or discard.
  const [draftBlockId, setDraftBlockId] = useState<string | null>(null);
  const [creatingBlock, setCreatingBlock] = useState(false);


  // Inline data from TaskCustomBlocks (custom user-created blocks)
  const [customData, setCustomData] = useState<{
    blocks: Array<{ id: string; type: string; content: any }>;
    renderBody: (block: any) => React.ReactNode;
    deleteBlock: (id: string) => Promise<void>;
    moveBlock: (id: string, toIndex: number) => Promise<void>;
    startEdit: (id: string) => void;
    updateBlockStyle: (id: string, style: { bgColor?: string; borderColor?: string }) => Promise<void>;
  } | null>(null);



  // When custom blocks load/change, ensure they appear in blockOrder
  useEffect(() => {
    if (!customData) return;
    const currentCb = customData.blocks.map(b => `cb:${b.id}`);
    setBlockOrder(prev => {
      // Remove cb ids that no longer exist
      const filtered = prev.filter(b => !b.startsWith('cb:') || currentCb.includes(b));
      // Append any new cb ids that aren't yet in the order
      const missing = currentCb.filter(cb => !filtered.includes(cb));
      return missing.length ? [...filtered, ...missing] : filtered;
    });
  }, [customData?.blocks.map(b => b.id).join(',')]);

  useEffect(() => {
    try { localStorage.setItem(blockOrderStorageKey, JSON.stringify(blockOrder)); } catch {}
  }, [blockOrder, blockOrderStorageKey]);

  useEffect(() => {
    try { localStorage.setItem(enabledOptionalKey, JSON.stringify(enabledOptional)); } catch {}
  }, [enabledOptional, enabledOptionalKey]);

  const visibleBlockOrder = blockOrder.filter(b =>
    REQUIRED_BLOCKS.includes(b) || enabledOptional.includes(b) || b.startsWith('cb:')
  );

  const toggleOptionalBlock = (block: string) => {
    setEnabledOptional(prev => {
      if (prev.includes(block)) return prev.filter(b => b !== block);
      return [...prev, block];
    });
    setBlockOrder(prev => {
      if (prev.includes(block)) return prev;
      // Insert optional block before comments if present, otherwise append
      const idx = prev.indexOf('comments');
      if (idx === -1) return [...prev, block];
      return [...prev.slice(0, idx), block, ...prev.slice(idx)];
    });
  };

  const handleBlocksDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    if (result.destination.index === result.source.index) return;
    // Reorder operates on visibleBlockOrder; map back to full blockOrder
    const visible = visibleBlockOrder;
    const moved = visible[result.source.index];
    const target = visible[result.destination.index];
    setBlockOrder(prev => {
      const next = prev.filter(id => id !== moved);
      const insertAt = next.indexOf(target);
      if (insertAt === -1) next.push(moved);
      else {
        // If moving down, insert after target; otherwise insert at target's index
        const movingDown = result.destination!.index > result.source.index;
        next.splice(insertAt + (movingDown ? 1 : 0), 0, moved);
      }
      return next;
    });
  };

  const statusLabels: Record<string, string> = {
    todo: t('statusTodo'),
    in_progress: t('statusInProgress'),
    review: t('statusReview'),
    done: t('statusDone'),
  };

  const STATUS_COLORS: Record<string, string> = {
    todo: 'bg-muted text-muted-foreground',
    in_progress: 'bg-crm-warning/10 text-crm-warning',
    review: 'bg-primary/10 text-primary',
    done: 'bg-crm-success/10 text-crm-success',
  };

  useEffect(() => {
    if (id) {
      fetchTask();
    }
  }, [id]);

  useEffect(() => {
    if (task) {
      fetchComments();
      fetchAssignees();
      fetchTaskAttachments();
      fetchCreator();
    }
  }, [task?.id]);

  // Realtime: live update comments thread (e.g. AI replies)
  useEffect(() => {
    if (!task?.id) return;
    const channel = supabase
      .channel(`task-comments-${task.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_comments', filter: `task_id=eq.${task.id}` },
        () => { fetchComments(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [task?.id]);

  const fetchCreator = async () => {
    if (!task?.created_by) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', task.created_by)
      .maybeSingle();
    if (data) setCreator(data as Profile);
  };

  const fetchTask = async () => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setTask(data as unknown as Task);
    } catch (error) {
      console.error('Error fetching task:', error);
      navigate('/tasks');
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    if (!task) return;
    const { data: commentsData } = await supabase
      .from('task_comments')
      .select('*')
      .eq('task_id', task.id)
      .order('created_at', { ascending: true });

    if (commentsData) {
      const commentsWithUsers: CommentWithUser[] = [];
      for (const comment of commentsData) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', comment.user_id)
          .maybeSingle();
        
        const { data: attachments } = await supabase
          .from('task_attachments')
          .select('*')
          .eq('comment_id', comment.id);

        commentsWithUsers.push({
          ...comment,
          profile: profile as Profile,
          attachments: attachments as TaskAttachment[],
        } as CommentWithUser);
      }
      setComments(commentsWithUsers);
      // Mark comments as read for the current user
      if (user && task) {
        await supabase.from('task_comment_reads').upsert(
          { user_id: user.id, task_id: task.id, last_read_at: new Date().toISOString() },
          { onConflict: 'user_id,task_id' }
        );
      }
    }
  };

  const fetchAssignees = async () => {
    if (!task) return;
    const { data } = await supabase
      .from('task_assignees')
      .select('*')
      .eq('task_id', task.id);

    if (data) {
      const assigneesWithUsers: { user: Profile; role: string }[] = [];
      for (const assignee of data) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', assignee.user_id)
          .maybeSingle();
        if (profile) {
          assigneesWithUsers.push({ user: profile as Profile, role: assignee.role });
        }
      }
      setAssignees(assigneesWithUsers);
    }
  };

  const fetchTaskAttachments = async () => {
    if (!task) return;
    // Fetch ALL attachments for this task (both standalone and from comments)
    const { data } = await supabase
      .from('task_attachments')
      .select('*')
      .eq('task_id', task.id)
      .order('created_at', { ascending: false });

    if (data) {
      setTaskAttachments(data as TaskAttachment[]);
    }
  };

  const uploadTaskFiles = async (fileList: FileList | File[]) => {
    if (!user || !task) return;
    const filesArr = Array.from(fileList);
    if (filesArr.length === 0) return;

    setUploadingFile(true);
    try {
      for (const file of filesArr) {
        const sanitizedName = file.name
          .replace(/[^\w.-]/g, '_')
          .replace(/__+/g, '_');
        const fileName = `${task.id}/${Date.now()}-${sanitizedName}`;
        const { error: uploadError } = await supabase.storage
          .from('task-attachments')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: signedUrlData } = await supabase.storage
          .from('task-attachments')
          .createSignedUrl(fileName, 60 * 60 * 24 * 7);

        await supabase.from('task_attachments').insert({
          task_id: task.id,
          comment_id: null,
          file_name: file.name,
          file_url: signedUrlData?.signedUrl || fileName,
          file_type: file.type,
          uploaded_by: user.id,
        });
      }

      fetchTaskAttachments();
      toast({ title: t('fileUploaded') });
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({ title: t('errorUploadingFile'), variant: 'destructive' });
    } finally {
      setUploadingFile(false);
    }
  };

  const handleAddTaskFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    await uploadTaskFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmitComment = async () => {
    if ((!newComment.trim() && files.length === 0) || !user || !task) return;

    setSubmitting(true);
    try {
      const { data: comment, error } = await supabase
        .from('task_comments')
        .insert({
          task_id: task.id,
          user_id: user.id,
          content: newComment,
        })
        .select()
        .single();

      if (error) throw error;

      for (const file of files) {
        // Sanitize file name - replace non-ASCII characters and spaces
        const sanitizedName = file.name
          .replace(/[^\w.-]/g, '_')
          .replace(/__+/g, '_');
        const fileName = `${task.id}/${Date.now()}-${sanitizedName}`;
        const { error: uploadError } = await supabase.storage
          .from('task-attachments')
          .upload(fileName, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          continue;
        }

        const { data: signedUrlData } = await supabase.storage
          .from('task-attachments')
          .createSignedUrl(fileName, 60 * 60 * 24 * 7); // 7 days

        await supabase.from('task_attachments').insert({
          task_id: task.id,
          comment_id: comment.id,
          file_name: file.name,
          file_url: signedUrlData?.signedUrl || fileName,
          file_type: file.type,
          uploaded_by: user.id,
        });
      }

      // Send notifications to all assignees AND task creator except the commenter
      const { data: taskAssignees } = await supabase
        .from('task_assignees')
        .select('user_id')
        .eq('task_id', task.id);

      const { data: myProfile } = await supabase
        .from('profiles')
        .select('name')
        .eq('user_id', user.id)
        .single();
      
      // Collect all users to notify (assignees + creator)
      const usersToNotify = new Set<string>();
      
      // Add all assignees
      if (taskAssignees) {
        taskAssignees.forEach(a => usersToNotify.add(a.user_id));
      }
      
      // Add task creator
      if (task.created_by) {
        usersToNotify.add(task.created_by);
      }
      
      // Remove current user (commenter)
      usersToNotify.delete(user.id);
      
      // Send in-app notifications
      for (const userId of usersToNotify) {
        await supabase.from('notifications').insert({
          user_id: userId,
          type: 'comment',
          title: t('newCommentOnTask') || 'Новий коментар до завдання',
          message: `${myProfile?.name || t('user')}: "${newComment.slice(0, 50)}${newComment.length > 50 ? '...' : ''}"`,
          task_id: task.id,
          created_by: user.id,
        });
      }

      // Handle @mentions - send separate mention notifications
      const { data: allProfiles } = await supabase
        .from('public_profiles')
        .select('user_id, name');
      
      if (allProfiles) {
        const mentionedIds = parseMentionedUserIds(newComment, allProfiles as { user_id: string; name: string }[], user.id);
        for (const mentionedUserId of mentionedIds) {
          // Don't duplicate if already notified as assignee/creator
          if (!usersToNotify.has(mentionedUserId)) {
            await supabase.from('notifications').insert({
              user_id: mentionedUserId,
              type: 'mention',
              title: t('mentionInComment') || 'Згадка в коментарі',
              message: `${myProfile?.name || t('user')} ${t('mentionedYouInComment')}: "${newComment.slice(0, 50)}${newComment.length > 50 ? '...' : ''}"`,
              task_id: task.id,
              created_by: user.id,
            });
          }
        }
      }

      // Send email notifications to all users
      if (usersToNotify.size > 0) {
        try {
          await supabase.functions.invoke('send-comment-email', {
            body: {
              task_id: task.id,
              task_title: task.title,
              comment_text: newComment,
              commenter_name: myProfile?.name || t('user'),
              recipient_user_ids: Array.from(usersToNotify),
            },
          });
        } catch (emailError) {
          console.error('Error sending comment email:', emailError);
        }
      }

      const commentText = newComment;
      setNewComment('');
      setFiles([]);
      fetchComments();
      fetchTaskAttachments();
      toast({ title: t('commentAdded') });

      // If user mentioned @AI — ask AI to reply
      if (await maybeInvokeCommentAI(commentText, 'task', task.id)) {
        fetchComments();
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({ title: t('errorAddingComment'), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!task) return;
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', task.id);
      if (error) throw error;
      toast({ title: t('taskDeleted') });
      navigate('/tasks');
    } catch (error) {
      console.error('Error deleting task:', error);
      toast({ title: t('errorDeleting'), variant: 'destructive' });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const { error } = await supabase.from('task_comments').delete().eq('id', commentId);
      if (error) throw error;
      fetchComments();
      toast({ title: t('commentDeleted') || 'Коментар видалено' });
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast({ title: t('error'), variant: 'destructive' });
    } finally {
      setDeleteCommentId(null);
    }
  };

  const handleEditComment = async () => {
    if (!editingCommentId || !editingCommentText.trim()) return;
    try {
      const { error } = await supabase
        .from('task_comments')
        .update({ content: editingCommentText.trim() })
        .eq('id', editingCommentId);
      if (error) throw error;
      fetchComments();
      setEditingCommentId(null);
      setEditingCommentText('');
      toast({ title: t('commentUpdated') || 'Коментар оновлено' });
    } catch (error) {
      console.error('Error editing comment:', error);
      toast({ title: t('error'), variant: 'destructive' });
    }
  };

  const handleStatusChange = async (newStatus: "todo" | "in_progress" | "review" | "done") => {
    if (!task || !user) return;
    const oldStatus = task.status;
    const { error } = await supabase
      .from('tasks')
      .update({ status: newStatus })
      .eq('id', task.id);
    
    if (!error) {
      // Record status change history
      await supabase
        .from('task_status_history')
        .insert({
          task_id: task.id,
          old_status: oldStatus,
          new_status: newStatus,
          changed_by: user.id,
        });
      
      setTask({ ...task, status: newStatus });
      toast({ title: t('statusUpdated') });

      // Send email notifications about status change
      try {
        // Get assignees
        const { data: taskAssignees } = await supabase
          .from('task_assignees')
          .select('user_id')
          .eq('task_id', task.id);

        const { data: myProfile } = await supabase
          .from('profiles')
          .select('name')
          .eq('user_id', user.id)
          .single();

        // Collect all users to notify
        const usersToNotify = new Set<string>();
        if (taskAssignees) {
          taskAssignees.forEach(a => usersToNotify.add(a.user_id));
        }
        if (task.created_by) {
          usersToNotify.add(task.created_by);
        }
        usersToNotify.delete(user.id);

        if (usersToNotify.size > 0) {
          await supabase.functions.invoke('send-status-change-email', {
            body: {
              entity_type: 'task',
              entity_id: task.id,
              entity_title: task.title,
              old_status: oldStatus,
              new_status: newStatus,
              changed_by_name: myProfile?.name || t('user'),
              recipient_user_ids: Array.from(usersToNotify),
            },
          });
        }
      } catch (emailError) {
        console.error('Error sending status change email:', emailError);
      }
    }
  };

  const handleStatusToggle = async () => {
    if (!task) return;
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    await handleStatusChange(newStatus);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">{t('taskNotFound')}</p>
        <Button onClick={() => navigate('/tasks')} className="mt-4">
          {t('backToTasks')}
        </Button>
      </div>
    );
  }

  return (
    <TooltipProvider>
    <div
      className="space-y-6 animate-fade-in -m-4 md:-m-6 p-4 md:p-6 min-h-[calc(100vh-4rem)] transition-colors"
      style={task.bg_color ? { backgroundColor: task.bg_color } : undefined}
    >
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate('/tasks')} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          {t('backToTasks')}
        </Button>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleAddTaskFile}
          />
          <Button 
            variant="outline" 
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingFile}
          >
            {uploadingFile ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            {t('addFile')}
          </Button>
          <ShareButton type="task" id={task.id} title={task.title} />
          <Button variant="outline" onClick={() => navigate(`/tasks/${task.id}/edit`)}>
            <Pencil className="h-4 w-4 mr-2" />
            {t('edit')}
          </Button>
          {user?.id === task.created_by && (
            <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4 mr-2" />
              {t('delete')}
            </Button>
          )}
        </div>
      </div>




      <Tabs defaultValue="main" className="w-full">
        <TabsList className="bg-muted/60 border border-border p-1 gap-1 shadow-sm">
          <TabsTrigger value="main" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">
            <ListChecks className="h-4 w-4" />
            {t('taskTabMain')}
          </TabsTrigger>
          <TabsTrigger value="files" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">
            <Files className="h-4 w-4" />
            {t('taskTabFiles')} ({taskAttachments.length})
          </TabsTrigger>
          <TabsTrigger value="boards" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">
            <LayoutGrid className="h-4 w-4" />
            {t('taskTabBoards')}
          </TabsTrigger>
          <TabsTrigger value="design" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">
            <Sparkles className="h-4 w-4" />
            Кастомизация
          </TabsTrigger>
        </TabsList>

        <TabsContent value="main" className="mt-4 md:pl-8 md:pr-20">
          <div className="flex gap-4 items-start">
            <div className="flex-1 min-w-0">
          {(() => {
            const blocks: Record<string, JSX.Element | null> = {
              details: (
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="px-6 pt-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold text-foreground">{task.title}</h1>
              </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={handleStatusToggle}
                className="p-1 hover:bg-muted rounded transition-colors"
                title={t('changeStatus')}
              >
                <CheckSquare className={`h-6 w-6 ${task.status === 'done' ? 'text-crm-success' : 'text-muted-foreground'}`} />
              </button>
              <Select
                value={task.status}
                onValueChange={(val) => handleStatusChange(val as "todo" | "in_progress" | "review" | "done")}
              >
                <SelectTrigger className="w-auto min-w-[140px] border-0 bg-transparent">
                  <Badge className={`${STATUS_COLORS[task.status]} whitespace-nowrap`}>{statusLabels[task.status]}</Badge>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">{statusLabels.todo}</SelectItem>
                  <SelectItem value="in_progress">{statusLabels.in_progress}</SelectItem>
                  <SelectItem value="review">{statusLabels.review}</SelectItem>
                  <SelectItem value="done">{statusLabels.done}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          </div>

          <TaskHeaderCover task={task} onChanged={(url) => setTask(prev => prev ? { ...prev, bg_image_url: url } as Task : prev)} />


          <div className="px-6 pb-6 pt-6">
            {task.description && (
              <p className="text-muted-foreground mb-6 whitespace-pre-wrap">{linkifyText(task.description)}</p>
            )}
            <div className="flex flex-wrap gap-4 text-sm mb-6">

            {creator && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="font-medium">{t('createdBy')}:</span>
                <span>{creator.name}</span>
              </div>
            )}
            {task.deadline && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>{t('dueDate')}: {format(new Date(task.deadline), 'd MMMM yyyy', { locale: dateLocale })}</span>
              </div>
            )}
          </div>

          {task.links && (task.links as TaskLink[]).length > 0 && (
            <div className="space-y-2 mb-6">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                {t('links')}:
              </h4>
              <div className="flex flex-wrap gap-2">
                {(task.links as TaskLink[]).map((link, i) => (
                  <a
                    key={i}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-1 bg-muted px-2 py-1 rounded"
                  >
                    <Link2 className="h-3 w-3" />
                    {link.title}
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-6 mb-6">
            <div className="space-y-2">
              <h4 className="text-sm font-medium">{t('participants')}:</h4>
              <div className="flex items-center gap-1">
                <div className="flex -space-x-2">
                  {assignees.filter(a => a.role === 'observer').slice(0, 5).map((a, i) => (
                    <Tooltip key={i}>
                      <TooltipTrigger asChild>
                        <Avatar className="h-8 w-8 border-2 border-background cursor-pointer hover:z-10 transition-transform hover:scale-110">
                          <AvatarImage src={a.user.avatar_url || undefined} />
                          <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                            {a.user.name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{a.user.name}</p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                  {assignees.filter(a => a.role === 'observer').length > 5 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="h-8 w-8 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs font-medium cursor-pointer">
                          +{assignees.filter(a => a.role === 'observer').length - 5}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        {assignees.filter(a => a.role === 'observer').slice(5).map((a, i) => (
                          <p key={i}>{a.user.name}</p>
                        ))}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-medium">{t('executors')}:</h4>
              <div className="flex items-center gap-1">
                <div className="flex -space-x-2">
                  {assignees.filter(a => a.role === 'executor').slice(0, 5).map((a, i) => (
                    <Tooltip key={i}>
                      <TooltipTrigger asChild>
                        <Avatar className="h-8 w-8 border-2 border-background cursor-pointer hover:z-10 transition-transform hover:scale-110">
                          <AvatarImage src={a.user.avatar_url || undefined} />
                          <AvatarFallback className="text-xs bg-crm-warning text-white">
                            {a.user.name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{a.user.name}</p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                  {assignees.filter(a => a.role === 'executor').length > 5 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="h-8 w-8 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs font-medium cursor-pointer">
                          +{assignees.filter(a => a.role === 'executor').length - 5}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        {assignees.filter(a => a.role === 'executor').slice(5).map((a, i) => (
                          <p key={i}>{a.user.name}</p>
                        ))}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
            </div>
          </div>

          {user?.id === task.created_by && (
            <div className="mb-6">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    onClick={() => setAddAssigneeOpen(true)}
                  >
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t('addParticipant')}</p>
                </TooltipContent>
              </Tooltip>
            </div>
          )}

          {user && (
            <div className="mb-6">
              <TagsManager taskId={task.id} userId={user.id} />
            </div>
          )}
          </div>
        </CardContent>
      </Card>

              ),
              subtasks: user ? <SubtasksList taskId={task.id} /> : null,
              dependencies: (
                <Card>
                  <CardContent className="p-6">
                    <TaskDependencies taskId={task.id} />
                  </CardContent>
                </Card>
              ),
              timeTracker: user ? <TimeTracker taskId={task.id} userId={user.id} /> : null,
              comments: (
      <Card>
        <CardContent className="p-6">
          <h4 className="text-lg font-medium mb-4">{t('comments')}</h4>
          <ScrollArea className="h-96 pr-4">
            <div className="space-y-4">
              {comments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {t('noComments')}
                </p>
              ) : (
                comments.map((comment) => {
                  const aiReply = isAIComment(comment.content);
                  return (
                  <div key={comment.id} className={`flex gap-3 group ${aiReply ? 'rounded-lg bg-purple-500/5 border border-purple-500/20 p-2' : ''}`}>
                    <Avatar className="h-8 w-8 shrink-0">
                      {aiReply ? (
                        <AvatarFallback className="bg-purple-500 text-white">
                          <Sparkles className="h-4 w-4" />
                        </AvatarFallback>
                      ) : (
                        <>
                          <AvatarImage src={comment.profile?.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">
                            {comment.profile?.name?.[0]?.toUpperCase() || 'U'}
                          </AvatarFallback>
                        </>
                      )}
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {aiReply ? 'AI Асистент' : (comment.profile?.name || t('user'))}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(comment.created_at), 'd MMM HH:mm', { locale: dateLocale })}
                        </span>
                        {!aiReply && comment.user_id === user?.id && (
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => {
                                setEditingCommentId(comment.id);
                                setEditingCommentText(comment.content);
                              }}
                            >
                              <Pencil className="h-3 w-3 text-muted-foreground" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => setDeleteCommentId(comment.id)}
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        )}
                      </div>
                      {editingCommentId === comment.id ? (
                        <div className="mt-1 space-y-2">
                          <MentionInput
                            value={editingCommentText}
                            onChange={setEditingCommentText}
                            placeholder={t('writeComment')}
                            onSubmit={handleEditComment}
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={handleEditComment} disabled={!editingCommentText.trim()}>
                              <Check className="h-3 w-3 mr-1" />
                              {t('save')}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => { setEditingCommentId(null); setEditingCommentText(''); }}>
                              <X className="h-3 w-3 mr-1" />
                              {t('cancel')}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className={`text-sm mt-1 whitespace-pre-wrap ${aiReply ? 'text-foreground' : ''}`}>
                          {aiReply ? stripAIMarker(comment.content) : comment.content}
                        </p>
                      )}
                      {comment.attachments && comment.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {comment.attachments.map((att) => 
                            isImageFile(att.file_type, att.file_name) ? (
                              <AttachmentImage
                                key={att.id}
                                fileUrl={att.file_url}
                                fileName={att.file_name}
                              />
                            ) : (
                              <a
                                key={att.id}
                                href={att.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary hover:underline flex items-center gap-1"
                              >
                                <Paperclip className="h-3 w-3" />
                                {att.file_name}
                              </a>
                            )
                          )}
                        </div>
                      )}
                      {!aiReply && <CommentReactions commentType="task" commentId={comment.id} />}
                    </div>
                  </div>
                  );
                })
              )}
            </div>
          </ScrollArea>

          <div className="border-t pt-4 mt-4">
            <div className="flex gap-2">
              <MentionInput
                value={newComment}
                onChange={setNewComment}
                placeholder={t('writeComment')}
                onSubmit={handleSubmitComment}
                onPasteImage={(file) => {
                  setFiles(prev => [...prev, file]);
                  toast({ title: t('imagePasted') || 'Изображение добавлено из буфера', description: file.name });
                }}
              />
              <input
                type="file"
                id="file-upload"
                className="hidden"
                multiple
                onChange={handleFileSelect}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => document.getElementById('file-upload')?.click()}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <Button onClick={handleSubmitComment} disabled={submitting || (!newComment.trim() && files.length === 0)}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            {files.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {files.map((f, i) => (
                  <Badge key={i} variant="secondary" className="text-xs gap-1">
                    {f.type.startsWith('image/') ? '🖼️ ' : ''}{f.name}
                    <button onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))} className="ml-1 hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
              ),
            };

            return (
              <DragDropContext onDragEnd={handleBlocksDragEnd}>
                <Droppable droppableId="task-blocks">
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="space-y-6"
                    >
                      {(() => {
                        const draftKey = draftBlockId ? `cb:${draftBlockId}` : null;
                        const moveDraft = async (dir: -1 | 1) => {
                          if (!draftKey) return;
                          const curIdx = visibleBlockOrder.indexOf(draftKey);
                          if (curIdx === -1) return;
                          const newIdx = curIdx + dir;
                          if (newIdx < 0 || newIdx >= visibleBlockOrder.length) return;
                          // Visual reorder
                          setBlockOrder(prev => {
                            const next = prev.filter(b => b !== draftKey);
                            const visibleWithout = next.filter(b =>
                              REQUIRED_BLOCKS.includes(b) || enabledOptional.includes(b) || b.startsWith('cb:')
                            );
                            const targetId = visibleWithout[Math.min(newIdx, visibleWithout.length - 1)];
                            const insertAt = next.indexOf(targetId);
                            if (insertAt === -1) next.push(draftKey);
                            else next.splice(insertAt + (dir > 0 ? 1 : 0), 0, draftKey);
                            return next;
                          });
                          // Persist cb order: compute new index among cb blocks only
                          const newCbOrder = visibleBlockOrder
                            .filter(b => b !== draftKey && b.startsWith('cb:'));
                          let cbIndex = 0;
                          for (let i = 0; i < newIdx; i++) {
                            const at = visibleBlockOrder[i];
                            if (at && at.startsWith('cb:') && at !== draftKey) cbIndex++;
                          }
                          await customData?.moveBlock(draftBlockId!, Math.min(cbIndex, newCbOrder.length));
                        };

                        return (
                          <>

                            {visibleBlockOrder.map((blockId, index) => {
                              const isCustom = blockId.startsWith('cb:');
                              let content: React.ReactNode = null;
                              let cbRef: any = null;
                              if (isCustom) {
                                const cbId = blockId.slice(3);
                                const cb = customData?.blocks.find(b => b.id === cbId);
                                if (!cb || !customData) return null;
                                cbRef = cb;
                                content = customData.renderBody(cb);
                              } else {
                                content = blocks[blockId];
                                if (!content) return null;
                              }
                              const isOptional = OPTIONAL_BLOCKS.includes(blockId);
                              const isDraft = draftKey === blockId;
                              const cbStyle = (cbRef?.content?.__style || {}) as { bgColor?: string; borderColor?: string };
                              const wrapperInlineStyle: React.CSSProperties = isCustom
                                ? {
                                    backgroundColor: cbStyle.bgColor || undefined,
                                    border: cbStyle.borderColor ? `2px solid ${cbStyle.borderColor}` : undefined,
                                    padding: (cbStyle.bgColor || cbStyle.borderColor) ? 12 : undefined,
                                  }
                                : {};
                              return (
                                <div key={blockId}>
                                  <Draggable draggableId={blockId} index={index} isDragDisabled={isDraft}>
                                    {(prov, snapshot) => (
                                      <div
                                        ref={prov.innerRef}
                                        {...prov.draggableProps}
                                        style={{ ...prov.draggableProps.style, ...wrapperInlineStyle }}
                                        className={`relative group/block rounded-lg ${
                                          snapshot.isDragging ? 'shadow-2xl ring-2 ring-primary/40' : ''
                                        } ${isDraft ? 'ring-2 ring-primary ring-offset-2 ring-offset-background bg-primary/5 p-3' : ''}`}
                                      >

                                        {isDraft && (
                                          <div className="mb-3 flex flex-wrap items-center gap-2 px-2 py-1.5 rounded-md bg-primary/10 border border-primary/30">
                                            <span className="text-xs font-medium text-primary">
                                              Новый блок — позиция {index + 1} из {visibleBlockOrder.length}
                                            </span>
                                            <div className="ml-auto flex items-center gap-1">
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7"
                                                disabled={index === 0}
                                                onClick={() => moveDraft(-1)}
                                                title="Выше"
                                              >
                                                <ChevronUp className="h-4 w-4" />
                                              </Button>
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7"
                                                disabled={index === visibleBlockOrder.length - 1}
                                                onClick={() => moveDraft(1)}
                                                title="Ниже"
                                              >
                                                <ChevronDown className="h-4 w-4" />
                                              </Button>
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-7"
                                                onClick={async () => {
                                                  if (!draftBlockId) return;
                                                  await customData?.deleteBlock(draftBlockId);
                                                  setDraftBlockId(null);
                                                }}
                                              >
                                                Отмена
                                              </Button>
                                              <Button
                                                type="button"
                                                size="sm"
                                                className="h-7"
                                                onClick={() => setDraftBlockId(null)}
                                              >
                                                Добавить
                                              </Button>
                                            </div>
                                          </div>
                                        )}
                                        {!isDraft && (
                                          <div
                                            {...prov.dragHandleProps}
                                            className="absolute -left-7 top-3 z-10 hidden md:flex flex-col items-center justify-center cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted opacity-40 group-hover/block:opacity-100 transition-opacity"
                                            title={t('dragBlock')}
                                            aria-label="drag-block"
                                          >
                                            <GripVertical className="h-5 w-5" />
                                          </div>
                                        )}
                                        {!isDraft && (
                                          <div
                                            {...prov.dragHandleProps}
                                            className="md:hidden flex items-center justify-center gap-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground py-1 -mb-2 rounded hover:bg-muted/50"
                                            title={t('dragBlock')}
                                            aria-label="drag-block"
                                          >
                                            <div className="w-8 h-1 rounded-full bg-muted-foreground/30" />
                                          </div>
                                        )}
                                        {isOptional && !isDraft && (
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => toggleOptionalBlock(blockId)}
                                            className="absolute right-2 top-2 z-10 h-7 w-7 opacity-40 group-hover/block:opacity-100 transition-opacity"
                                            title={t('removeBlock') || 'Прибрати блок'}
                                          >
                                            <X className="h-4 w-4" />
                                          </Button>
                                        )}
                                        {isCustom && user && !isDraft && customData && (
                                          <BlockMenu
                                            canEdit
                                            bgColor={cbStyle.bgColor}
                                            borderColor={cbStyle.borderColor}
                                            onEdit={() => customData.startEdit(blockId.slice(3))}
                                            onDelete={() => customData.deleteBlock(blockId.slice(3))}
                                            onStyleChange={(s) => customData.updateBlockStyle(blockId.slice(3), s)}
                                          />
                                        )}

                                        {content}
                                      </div>
                                    )}
                                  </Draggable>
                                </div>
                              );
                            })}

                          </>
                        );
                      })()}
                      {provided.placeholder}


                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            );
          })()}
              {/* Inline data source for custom blocks (no visible UI) */}
              <TaskCustomBlocks
                taskId={task.id}
                canEdit={!!user}
                inline
                onInlineReady={setCustomData}
                registerAddHandler={(fn) => { (window as any).__taskAddBlock = fn; }}
                registerBlocksGetter={(fn) => { (window as any).__taskGetBlocks = fn; }}
              />
            </div>
            {user && (() => {
              const available = OPTIONAL_BLOCKS.filter(b => !enabledOptional.includes(b));
              const blockLabel = (b: string) =>
                b === 'dependencies' ? (t('dependencies') || 'Залежності')
                : b === 'timeTracker' ? (t('timeTracker') || 'Облік часу')
                : b;
              return (
                <TaskBlocksToolbar
                  onAdd={async (type) => {
                    if (creatingBlock || draftBlockId) return;
                    const addFn = (window as any).__taskAddBlock as
                      | ((type: BlockType, atIndex?: number) => Promise<string | null>)
                      | undefined;
                    if (!addFn) return;
                    setCreatingBlock(true);
                    try {
                      const newId = await addFn(type);
                      if (newId) {
                        setDraftBlockId(newId);
                        setTimeout(() => {
                          document.querySelector(`[data-block-id="${newId}"]`)
                            ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }, 80);
                      }
                    } finally {
                      setCreatingBlock(false);
                    }
                  }}
                  optionalBlocks={available.map(b => ({ id: b, label: blockLabel(b) }))}
                  onToggleOptional={toggleOptionalBlock}
                />

              );
            })()}

          </div>
        </TabsContent>






        <TabsContent value="files" className="mt-4">
          <Card>
            <CardContent className="p-6">
              <h4 className="text-lg font-medium mb-4 flex items-center gap-2">
                <Paperclip className="h-5 w-5" />
                {t('filesGallery')}
              </h4>
              <TaskFilesGallery
                attachments={taskAttachments}
                onUpload={uploadTaskFiles}
                uploading={uploadingFile}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="boards" className="mt-4">
          <Card>
            <CardContent className="p-6">
              <TaskBoardsTab taskId={task.id} projectId={task.project_id} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="design" className="mt-4">
          <Card>
            <CardContent className="p-6 space-y-4">
              <TaskDesignTab task={task} onSaved={(patch) => setTask(prev => prev ? { ...prev, ...patch } : prev)} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <TaskEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        task={task}
        onSuccess={() => {
          fetchTask();
          setEditOpen(false);
        }}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteTask')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteTaskConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>{t('delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteCommentId} onOpenChange={(open) => !open && setDeleteCommentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteComment') || 'Видалити коментар'}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteCommentConfirm') || 'Ви впевнені, що хочете видалити цей коментар?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteCommentId && handleDeleteComment(deleteCommentId)}>{t('delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AddAssigneeDialog
        open={addAssigneeOpen}
        onOpenChange={setAddAssigneeOpen}
        taskId={task.id}
        taskTitle={task.title}
        existingAssigneeIds={assignees.map((a) => a.user.user_id)}
        onAssigneeAdded={fetchAssignees}
      />
    </div>
    </TooltipProvider>
  );
};

export default TaskDetail;

interface TaskDesignTabProps {
  task: Task;
  onSaved: (patch: Partial<Task>) => void;
}

const TaskDesignTab = ({ task, onSaved }: TaskDesignTabProps) => {
  const { toast } = useToast();
  const [value, setValue] = useState<TaskCustomizationValue>({
    color: (task as any).color || '#3b82f6',
    bgColor: (task as any).bg_color || '',
    bgImageUrl: (task as any).bg_image_url || '',
    accentColor: (task as any).accent_color || '',
    icon: (task as any).icon || '',
    titleFont: (task as any).title_font || '',
    gradient: (task as any).gradient || '',
    headerTitle: (task as any).header_title || '',
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const patch = {
      color: value.color,
      bg_color: value.bgColor || null,
      bg_image_url: value.bgImageUrl || null,
      accent_color: value.accentColor || null,
      icon: value.icon || null,
      title_font: value.titleFont || null,
      gradient: value.gradient || null,
      header_title: value.headerTitle || null,
    } as any;
    const { error } = await supabase.from('tasks').update(patch).eq('id', task.id);
    setSaving(false);
    if (error) {
      toast({ title: 'Не удалось сохранить', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Кастомизация сохранена' });
    onSaved(patch);
  };

  return (
    <>
      <TaskCustomization value={value} onChange={setValue} previewTitle={task.title} uploadFolder={task.id} />
      <div className="flex justify-end pt-2">
        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Сохранить
        </Button>
      </div>
    </>
  );
};

interface TaskHeaderCoverProps {
  task: Task;
  onChanged: (url: string | null) => void;
}

const TaskHeaderCover = ({ task, onChanged }: TaskHeaderCoverProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const sanitized = file.name.replace(/[^\w.-]/g, '_');
      const path = `${task.id}/bg-${Date.now()}-${sanitized}`;
      const { error: upErr } = await supabase.storage.from('task-attachments').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage.from('task-attachments').createSignedUrl(path, 60 * 60 * 24 * 365);
      const url = signed?.signedUrl || null;
      if (url) {
        const { error } = await supabase.from('tasks').update({ bg_image_url: url } as any).eq('id', task.id);
        if (error) throw error;
        onChanged(url);
        toast({ title: t('coverUpdated') || 'Обложка обновлена' });
      }
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Ошибка загрузки фото', description: err?.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleRemove = async () => {
    const { error } = await supabase.from('tasks').update({ bg_image_url: null } as any).eq('id', task.id);
    if (!error) {
      onChanged(null);
      toast({ title: t('coverRemoved') || 'Обложка удалена' });
    }
  };

  if (!task.bg_image_url) {
    return (
      <div className="flex">
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
        <Button
          variant="outline"
          size="sm"
          className="gap-2 border-dashed"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
          {t('addCoverPhoto') || 'Добавить обложку'}
        </Button>
      </div>
    );
  }

  return (
    <div
      className="relative group rounded-xl overflow-hidden border shadow-md h-48 md:h-64 flex items-end"
      style={{
        backgroundImage: `linear-gradient(rgba(0,0,0,0.25), rgba(0,0,0,0.65)), url(${task.bg_image_url})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
      <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button size="sm" variant="secondary" className="gap-1" disabled={uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pencil className="h-3.5 w-3.5" />}
          {t('replaceCover') || 'Заменить'}
        </Button>
        <Button size="sm" variant="destructive" className="gap-1" onClick={handleRemove}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="p-5 md:p-8 w-full">
        <h2
          className="text-white font-bold text-2xl md:text-4xl drop-shadow-lg"
          style={task.title_font ? { fontFamily: task.title_font } : undefined}
        >
          {(task as any).header_title?.trim() || task.title}
        </h2>
      </div>
    </div>
  );
};




