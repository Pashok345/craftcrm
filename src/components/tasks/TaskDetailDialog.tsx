import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Send, Paperclip, Calendar, User, Loader2, Pencil, Link2 } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Task, TaskComment, TaskAttachment, Profile, STATUS_LABELS, STATUS_COLORS, TaskLink } from '@/types/database';
import { useAuth } from '@/hooks/useAuth';
import { TaskEditDialog } from './TaskEditDialog';

interface TaskDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  onUpdate: () => void;
}

interface CommentWithUser extends TaskComment {
  profile?: Profile;
  attachments?: TaskAttachment[];
}

export const TaskDetailDialog = ({ open, onOpenChange, task, onUpdate }: TaskDetailDialogProps) => {
  const [comments, setComments] = useState<CommentWithUser[]>([]);
  const [newComment, setNewComment] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [assignees, setAssignees] = useState<{ user: Profile; role: string }[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (open && task) {
      fetchComments();
      fetchAssignees();
    }
  }, [open, task?.id]);

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

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !user || !task) return;

    setLoading(true);
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

      // Upload files
      for (const file of files) {
        // Sanitize file name - replace non-ASCII characters and spaces
        const sanitizedName = file.name
          .replace(/[^\w.-]/g, '_')
          .replace(/__+/g, '_');
        const fileName = `${task.id}/${Date.now()}-${sanitizedName}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('task-attachments')
          .upload(fileName, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('task-attachments')
          .getPublicUrl(fileName);

        await supabase.from('task_attachments').insert({
          task_id: task.id,
          comment_id: comment.id,
          file_name: file.name,
          file_url: publicUrl,
          file_type: file.type,
          uploaded_by: user.id,
        });
      }

      // Create notifications for assignees about new comment
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('name')
        .eq('user_id', user.id)
        .single();

      for (const assignee of assignees) {
        if (assignee.user.user_id !== user.id) {
          await supabase.from('notifications').insert({
            user_id: assignee.user.user_id,
            type: 'comment',
            title: 'Новый комментарий',
            message: `${userProfile?.name || 'Пользователь'} добавил комментарий к задаче "${task.title}"`,
            task_id: task.id,
          });
        }
      }

      setNewComment('');
      setFiles([]);
      fetchComments();
      toast({ title: 'Комментарий добавлен' });
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({ title: 'Ошибка при добавлении комментария', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  if (!task) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {task.title}
              <Badge className={`${STATUS_COLORS[task.status]} whitespace-nowrap`}>{STATUS_LABELS[task.status]}</Badge>
            </div>
            {user?.id === task.created_by && (
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4 mr-1" />
                Редактировать
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {task.description && (
            <p className="text-muted-foreground">{task.description}</p>
          )}

          <div className="flex flex-wrap gap-4 text-sm">
            {task.deadline && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>До {format(new Date(task.deadline), 'd MMMM yyyy', { locale: ru })}</span>
              </div>
            )}
          </div>

          {/* Links section */}
          {task.links && (task.links as TaskLink[]).length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                Ссылки:
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

          {assignees.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Участники:</h4>
              <div className="flex flex-wrap gap-2">
                {assignees.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 bg-muted rounded-full px-3 py-1">
                    <User className="h-3 w-3" />
                    <span className="text-sm">{a.user.name}</span>
                    <span className="text-xs text-muted-foreground">
                      ({a.role === 'executor' ? 'исполнитель' : 'наблюдатель'})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border-t pt-4 flex-1 flex flex-col min-h-0">
            <h4 className="text-sm font-medium mb-3">Комментарии</h4>
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-4">
                {comments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Нет комментариев
                  </p>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className="flex gap-3">
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarImage src={comment.profile?.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {comment.profile?.name?.[0]?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {comment.profile?.name || 'Пользователь'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(comment.created_at), 'd MMM HH:mm', { locale: ru })}
                          </span>
                        </div>
                        <p className="text-sm mt-1">{comment.content}</p>
                        {comment.attachments && comment.attachments.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {comment.attachments.map((att) => (
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
                            ))}
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
                <Input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Написать комментарий..."
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmitComment()}
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
                <Button onClick={handleSubmitComment} disabled={loading || !newComment.trim()}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
              {files.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {files.map((f, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {f.name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
      
      <TaskEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        task={task}
        onSuccess={() => {
          onUpdate();
          setEditOpen(false);
        }}
      />
    </Dialog>
  );
};
