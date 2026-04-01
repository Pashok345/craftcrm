import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { Send, Paperclip, Calendar, Loader2, Pencil, Link2, ArrowLeft, Trash2, Plus, UserPlus, CheckSquare, MoreVertical, X, Check } from 'lucide-react';
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
import { AddAssigneeDialog } from '@/components/tasks/AddAssigneeDialog';
import { TimeTracker } from '@/components/tasks/TimeTracker';
import { TagsManager } from '@/components/tasks/TagsManager';
import { SubtasksList } from '@/components/tasks/SubtasksList';
import { useLanguage } from '@/contexts/LanguageContext';
import { FileIcon, getFileIcon } from '@/components/ui/file-icon';
import { ImageThumbnail, isImageFile } from '@/components/ui/image-lightbox';
import { MentionInput, parseMentionedUserIds } from '@/components/ui/mention-input';
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
    const { data } = await supabase
      .from('task_attachments')
      .select('*')
      .eq('task_id', task.id)
      .is('comment_id', null);
    
    if (data) {
      setTaskAttachments(data as TaskAttachment[]);
    }
  };

  const handleAddTaskFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !task) return;

    setUploadingFile(true);
    try {
      // Sanitize file name - replace non-ASCII characters and spaces
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
        .createSignedUrl(fileName, 60 * 60 * 24 * 7); // 7 days

      await supabase.from('task_attachments').insert({
        task_id: task.id,
        comment_id: null,
        file_name: file.name,
        file_url: signedUrlData?.signedUrl || fileName,
        file_type: file.type,
        uploaded_by: user.id,
      });

      fetchTaskAttachments();
      toast({ title: t('fileUploaded') });
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({ title: t('errorUploadingFile'), variant: 'destructive' });
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
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

      setNewComment('');
      setFiles([]);
      fetchComments();
      toast({ title: t('commentAdded') });
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
    <div className="space-y-6 animate-fade-in">
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
          {user?.id === task.created_by && (
            <>
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4 mr-2" />
                {t('edit')}
              </Button>
              <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-4 w-4 mr-2" />
                {t('delete')}
              </Button>
            </>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{task.title}</h1>
              {task.description && (
                <p className="text-muted-foreground mt-2 whitespace-pre-wrap">{linkifyText(task.description)}</p>
              )}
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

          {taskAttachments.length > 0 && (
            <div className="space-y-2 mb-6">
              <h4 className="text-sm font-medium">{t('attachments')}:</h4>
              <div className="flex flex-wrap gap-3">
                {taskAttachments.map((att) => (
                  <Tooltip key={att.id}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={async () => {
                          try {
                            // Fetch file and open in new tab to avoid browser blocking
                            const response = await fetch(att.file_url);
                            const blob = await response.blob();
                            const blobUrl = URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = blobUrl;
                            link.download = att.file_name;
                            // For PDFs and images, try to open in new tab
                            if (att.file_type?.includes('pdf') || att.file_type?.includes('image')) {
                              window.open(blobUrl, '_blank');
                            } else {
                              link.click();
                            }
                            // Clean up after a delay
                            setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
                          } catch (error) {
                            console.error('Error opening file:', error);
                            // Fallback to direct link
                            window.open(att.file_url, '_blank');
                          }
                        }}
                        className="flex flex-col items-center gap-1 p-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors min-w-[60px] cursor-pointer"
                      >
                        <FileIcon fileName={att.file_name} className="h-8 w-8" />
                        <span className="text-xs text-muted-foreground max-w-[60px] truncate">
                          {att.file_name.length > 8 ? att.file_name.slice(0, 6) + '...' : att.file_name}
                        </span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{att.file_name}</p>
                    </TooltipContent>
                  </Tooltip>
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

          {/* Add participant button */}
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

          {/* Tags */}
          {user && (
            <div className="mb-6">
              <TagsManager taskId={task.id} userId={user.id} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Subtasks */}
      {user && <SubtasksList taskId={task.id} />}

      {/* Time Tracker */}
      {user && (
        <TimeTracker taskId={task.id} userId={user.id} />
      )}

      <Card>
        <CardContent className="p-6">
          <h4 className="text-lg font-medium mb-4">{t('comments')}</h4>
          <ScrollArea className="max-h-96 pr-4">
            <div className="space-y-4">
              {comments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {t('noComments')}
                </p>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3 group">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={comment.profile?.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">
                        {comment.profile?.name?.[0]?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {comment.profile?.name || t('user')}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(comment.created_at), 'd MMM HH:mm', { locale: dateLocale })}
                        </span>
                        {comment.user_id === user?.id && (
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
                        <p className="text-sm mt-1">{comment.content}</p>
                      )}
                      {comment.attachments && comment.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {comment.attachments.map((att) => 
                            isImageFile(att.file_type, att.file_name) ? (
                              <ImageThumbnail
                                key={att.id}
                                src={att.file_url}
                                alt={att.file_name}
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
                    </div>
                  </div>
                ))
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
