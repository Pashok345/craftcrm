import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MentionInput, parseMentionedUserIds } from '@/components/ui/mention-input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Loader2, Play, CheckCircle, XCircle, Send, Clock, Paperclip, X, FileIcon, Trash2, Pencil } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { ru, enUS, uk } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';

interface ProcessRun {
  id: string;
  process_id: string;
  field_values: Record<string, unknown>;
  status: string;
  started_by: string;
  started_at: string;
  completed_at: string | null;
}

interface Process {
  id: string;
  title: string;
  description: string | null;
}

interface Profile {
  id: string;
  user_id: string;
  name: string;
  avatar_url: string | null;
  avatar_color: string | null;
}

interface Department {
  id: string;
  name: string;
}

interface Comment {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  profile?: Profile;
  attachments?: Attachment[];
}

interface Attachment {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
}

const ProcessRunDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [run, setRun] = useState<ProcessRun | null>(null);
  const [process, setProcess] = useState<Process | null>(null);
  const [starterProfile, setStarterProfile] = useState<Profile | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [comments, setComments] = useState<Comment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [directAttachments, setDirectAttachments] = useState<Attachment[]>([]);
  const [uploadingDirect, setUploadingDirect] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editRunName, setEditRunName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const directFileInputRef = useRef<HTMLInputElement>(null);

  const dateLocale = language === 'en' ? enUS : language === 'uk' ? uk : ru;

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id]);

  // Subscribe to realtime comments
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`process-run-comments-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'process_run_comments',
          filter: `process_run_id=eq.${id}`,
        },
        async (payload) => {
          const newComment = payload.new as Comment;
          
          // Check if comment already exists (avoid duplicates)
          setComments(prev => {
            if (prev.find(c => c.id === newComment.id)) {
              return prev;
            }
            
            // If not found, fetch profile and attachments then add
            (async () => {
              const { data: profileData } = await supabase
                .from('profiles')
                .select('id, user_id, name, avatar_url, avatar_color')
                .eq('user_id', newComment.user_id)
                .maybeSingle();
              
              const { data: attachmentsData } = await supabase
                .from('process_run_attachments')
                .select('id, file_name, file_url, file_type')
                .eq('comment_id', newComment.id);

              setComments(prevInner => {
                // Double-check to avoid duplicates
                if (prevInner.find(c => c.id === newComment.id)) {
                  return prevInner;
                }
                return [...prevInner, {
                  ...newComment,
                  profile: profileData || undefined,
                  attachments: attachmentsData || [],
                }];
              });
            })();
            
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const fetchData = async () => {
    if (!id) return;
    setLoading(true);

    const [runRes, deptsRes, profilesRes] = await Promise.all([
      supabase.from('process_runs').select('*').eq('id', id).maybeSingle(),
      supabase.from('departments').select('*'),
      supabase.from('profiles').select('id, user_id, name, avatar_url, avatar_color'),
    ]);

    // Build profiles map
    if (profilesRes.data) {
      const map: Record<string, Profile> = {};
      profilesRes.data.forEach(p => {
        map[p.user_id] = p;
      });
      setProfiles(map);
    }

    if (runRes.data) {
      const runData = {
        ...runRes.data,
        field_values: runRes.data.field_values as Record<string, unknown>,
      };
      setRun(runData);

      // Fetch process
      const { data: processData } = await supabase
        .from('processes')
        .select('id, title, description')
        .eq('id', runData.process_id)
        .maybeSingle();
      if (processData) setProcess(processData);

      // Fetch starter profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, user_id, name, avatar_url, avatar_color')
        .eq('user_id', runData.started_by)
        .maybeSingle();
      if (profileData) setStarterProfile(profileData);

      // Fetch comments with profiles and attachments
      const { data: commentsData } = await supabase
        .from('process_run_comments')
        .select('*')
        .eq('process_run_id', id)
        .order('created_at', { ascending: true });

      if (commentsData) {
        // Fetch attachments for all comments
        const commentIds = commentsData.map(c => c.id);
        const { data: attachmentsData } = await supabase
          .from('process_run_attachments')
          .select('*')
          .in('comment_id', commentIds);

        const attachmentsByComment: Record<string, Attachment[]> = {};
        attachmentsData?.forEach(att => {
          if (att.comment_id) {
            if (!attachmentsByComment[att.comment_id]) {
              attachmentsByComment[att.comment_id] = [];
            }
            attachmentsByComment[att.comment_id].push(att);
          }
        });

        const commentsWithProfiles = commentsData.map(comment => ({
          ...comment,
          profile: profilesRes.data?.find(p => p.user_id === comment.user_id),
          attachments: attachmentsByComment[comment.id] || [],
        }));
        setComments(commentsWithProfiles);
      }
    }

    if (deptsRes.data) setDepartments(deptsRes.data);
    
    // Fetch direct attachments
    const { data: directAtts } = await supabase
      .from('process_run_attachments')
      .select('id, file_name, file_url, file_type')
      .eq('process_run_id', id)
      .is('comment_id', null);
    if (directAtts) setDirectAttachments(directAtts);
    
    setLoading(false);
  };

  const handleDirectFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !user || !id) return;
    
    setUploadingDirect(true);
    
    for (const file of files) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('process-attachments')
        .upload(fileName, file);

      if (uploadError) continue;

      const { data: signedUrlData } = await supabase.storage
        .from('process-attachments')
        .createSignedUrl(fileName, 60 * 60 * 24 * 7); // 7 days

      await supabase.from('process_run_attachments').insert({
        process_run_id: id,
        comment_id: null,
        file_name: file.name,
        file_url: signedUrlData?.signedUrl || fileName,
        file_type: file.type,
        uploaded_by: user.id,
      });
    }
    
    // Refetch attachments
    const { data: directAtts } = await supabase
      .from('process_run_attachments')
      .select('id, file_name, file_url, file_type')
      .eq('process_run_id', id)
      .is('comment_id', null);
    if (directAtts) setDirectAttachments(directAtts);
    
    setUploadingDirect(false);
    if (directFileInputRef.current) directFileInputRef.current.value = '';
    toast({ title: t('fileUploaded') });
  };

  const updateStatus = async (newStatus: string) => {
    if (!run || !user) return;
    
    const updateData: { status: string; completed_at?: string | null } = { status: newStatus };
    if (newStatus === 'completed' || newStatus === 'cancelled') {
      updateData.completed_at = new Date().toISOString();
    } else {
      updateData.completed_at = null;
    }

    const { error } = await supabase
      .from('process_runs')
      .update(updateData)
      .eq('id', run.id);

    if (!error) {
      setRun({ ...run, ...updateData });
      toast({ title: t('statusUpdated') });
    }
  };

  const handleDeleteRun = async () => {
    if (!run || !id) return;
    
    // Delete attachments first
    await supabase
      .from('process_run_attachments')
      .delete()
      .eq('process_run_id', id);
    
    // Delete comments
    await supabase
      .from('process_run_comments')
      .delete()
      .eq('process_run_id', id);
    
    // Delete the run
    const { error } = await supabase
      .from('process_runs')
      .delete()
      .eq('id', id);
    
    if (!error) {
      toast({ title: t('processRunDeleted') });
      navigate('/processes');
    } else {
      toast({ title: t('errorDeleting'), variant: 'destructive' });
    }
  };

  const handleEditRun = async () => {
    if (!run || !editRunName.trim()) return;
    
    const newFieldValues = {
      ...run.field_values,
      _run_name: editRunName.trim(),
    };
    
    const { error } = await supabase
      .from('process_runs')
      .update({ field_values: newFieldValues })
      .eq('id', run.id);
    
    if (!error) {
      setRun({ ...run, field_values: newFieldValues });
      setIsEditing(false);
      toast({ title: t('processRunUpdated') });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(prev => [...prev, ...files]);
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async (commentId: string): Promise<Attachment[]> => {
    if (!user || selectedFiles.length === 0) return [];
    
    const uploadedAttachments: Attachment[] = [];

    for (const file of selectedFiles) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('process-attachments')
        .upload(fileName, file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        continue;
      }

      const { data: signedUrlData } = await supabase.storage
        .from('process-attachments')
        .createSignedUrl(fileName, 60 * 60 * 24 * 7); // 7 days

      const { data: attachmentData, error: attachmentError } = await supabase
        .from('process_run_attachments')
        .insert({
          process_run_id: id,
          comment_id: commentId,
          file_name: file.name,
          file_url: signedUrlData?.signedUrl || fileName,
          file_type: file.type,
          uploaded_by: user.id,
        })
        .select()
        .single();

      if (!attachmentError && attachmentData) {
        uploadedAttachments.push(attachmentData);
      }
    }

    return uploadedAttachments;
  };

  const sendNotifications = async (commentId: string) => {
    if (!run || !user || !process) return;

    // Get all users who commented on this process run (excluding current user)
    const { data: commenters } = await supabase
      .from('process_run_comments')
      .select('user_id')
      .eq('process_run_id', run.id)
      .neq('user_id', user.id);

    // Get the process starter
    const usersToNotify = new Set<string>();
    
    if (run.started_by !== user.id) {
      usersToNotify.add(run.started_by);
    }

    commenters?.forEach(c => {
      if (c.user_id !== user.id) {
        usersToNotify.add(c.user_id);
      }
    });

    // Send notifications
    const notifications = Array.from(usersToNotify).map(userId => ({
      user_id: userId,
      type: 'process_comment',
      title: t('newCommentOnProcess') || 'Новый комментарий к процессу',
      message: `${profiles[user.id]?.name || user.email}: ${newComment.substring(0, 100)}`,
      created_by: user.id,
    }));

    if (notifications.length > 0) {
      await supabase.from('notifications').insert(notifications);
    }

    // Send mention notifications
    const allProfiles = Object.values(profiles).map(p => ({ user_id: p.user_id, name: p.name }));
    const mentionedIds = parseMentionedUserIds(newComment, allProfiles, user.id);
    const mentionNotifications = mentionedIds
      .filter(uid => !usersToNotify.has(uid))
      .map(uid => ({
        user_id: uid,
        type: 'mention',
        title: t('mentionInComment') || 'Вас упомянули в комментарии',
        message: `${profiles[user.id]?.name || user.email} ${t('mentionedYouInComment') || 'упомянул(а) вас в комментарии к процессу'}`,
        created_by: user.id,
      }));

    if (mentionNotifications.length > 0) {
      await supabase.from('notifications').insert(mentionNotifications);
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim() && selectedFiles.length === 0) return;
    if (!user || !id) return;

    setSubmitting(true);
    setUploading(selectedFiles.length > 0);

    try {
      // Create comment
      const { data: commentData, error } = await supabase
        .from('process_run_comments')
        .insert({
          process_run_id: id,
          user_id: user.id,
          content: newComment.trim() || (selectedFiles.length > 0 ? '📎 Файлы' : ''),
        })
        .select()
        .single();

      if (error) throw error;

      // Upload files if any
      let attachments: Attachment[] = [];
      if (selectedFiles.length > 0 && commentData) {
        attachments = await uploadFiles(commentData.id);
      }

      // Send notifications
      await sendNotifications(commentData.id);

      // Note: Comment will be added via realtime subscription, but we add it manually
      // in case the subscription is slow
      const newCommentWithProfile: Comment = {
        ...commentData,
        profile: profiles[user.id],
        attachments,
      };

      // Check if comment already exists (from realtime)
      setComments(prev => {
        if (prev.find(c => c.id === commentData.id)) {
          return prev;
        }
        return [...prev, newCommentWithProfile];
      });

      setNewComment('');
      setSelectedFiles([]);
      toast({ title: t('commentAdded') });
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({ title: t('errorAddingComment'), variant: 'destructive' });
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'completed':
        return { color: 'bg-green-500/10 text-green-600 border-green-500/30', icon: CheckCircle, label: t('status_completed') || 'Завершено' };
      case 'in_progress':
        return { color: 'bg-blue-500/10 text-blue-600 border-blue-500/30', icon: Play, label: t('status_in_progress') || 'В работе' };
      case 'cancelled':
        return { color: 'bg-red-500/10 text-red-600 border-red-500/30', icon: XCircle, label: t('status_cancelled') || 'Отменено' };
      default:
        return { color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30', icon: Clock, label: t('status_pending') || 'Ожидает' };
    }
  };

  const getDepartmentName = (deptId: string) => {
    const dept = departments.find(d => d.id === deptId);
    return dept?.name || deptId;
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!run || !process) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">{t('processRunNotFound')}</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/processes')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('backToProcesses')}
        </Button>
      </div>
    );
  }

  const statusConfig = getStatusConfig(run.status);
  const StatusIcon = statusConfig.icon;
  const runName = run.field_values._run_name as string || t('untitled');
  const initiatorDept = run.field_values._initiator_department as string;

  // Filter out system fields for display
  const displayFields = Object.entries(run.field_values).filter(
    ([key]) => !key.startsWith('_')
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/processes')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          {isEditing ? (
            <div className="flex items-center gap-2">
              <Input
                value={editRunName}
                onChange={(e) => setEditRunName(e.target.value)}
                className="max-w-xs"
              />
              <Button size="sm" onClick={handleEditRun}>{t('save')}</Button>
              <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>{t('cancel')}</Button>
            </div>
          ) : (
            <h1 className="text-2xl font-bold">{runName}</h1>
          )}
          <p className="text-muted-foreground">{process.title}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => { setEditRunName(runName); setIsEditing(true); }}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setShowDeleteDialog(true)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
          <Badge className={`${statusConfig.color} border`}>
            <StatusIcon className="h-3.5 w-3.5 mr-1" />
            {statusConfig.label}
          </Badge>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteProcessRun')}</AlertDialogTitle>
            <AlertDialogDescription>{t('deleteProcessRunConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRun} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Main info */}
        <div className="md:col-span-2 space-y-6">
          {/* Process info card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('processInfo')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {process.description && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">{t('description')}</p>
                  <p className="text-sm">{process.description}</p>
                </div>
              )}
              
              {initiatorDept && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">{t('initiatorDepartment')}</p>
                  <Badge variant="secondary">{getDepartmentName(initiatorDept)}</Badge>
                </div>
              )}

              {displayFields.length > 0 && (
                <div className="space-y-3 pt-2 border-t">
                  <p className="text-sm font-medium text-muted-foreground">{t('fields')}</p>
                  {displayFields.map(([key, value]) => (
                    <div key={key} className="flex justify-between items-start gap-4">
                      <span className="text-sm font-medium">{key}</span>
                      <span className="text-sm text-muted-foreground text-right">
                        {String(value) || '-'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Attachments section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('attachments')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                type="file"
                ref={directFileInputRef}
                onChange={handleDirectFileUpload}
                multiple
                className="hidden"
              />
              
              {directAttachments.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  <p className="text-sm">{t('noAttachments')}</p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {directAttachments.map((att) => (
                    <a
                      key={att.id}
                      href={att.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 bg-muted px-3 py-2 rounded-lg hover:bg-muted/80 transition-colors"
                    >
                      <Paperclip className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm max-w-[200px] truncate">{att.file_name}</span>
                    </a>
                  ))}
                </div>
              )}
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => directFileInputRef.current?.click()}
                disabled={uploadingDirect}
              >
                {uploadingDirect ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Paperclip className="h-4 w-4 mr-2" />
                )}
                {t('addFile')}
              </Button>
            </CardContent>
          </Card>

          {/* Comments section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('comments')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Comments list */}
              {comments.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  <p className="text-sm">{t('noComments')}</p>
                </div>
              ) : (
                <ScrollArea className="max-h-80">
                  <div className="space-y-4 pr-4">
                    {comments.map((comment) => (
                      <div key={comment.id} className="flex gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={comment.profile?.avatar_url || undefined} />
                          <AvatarFallback
                            className="text-xs"
                            style={{ backgroundColor: comment.profile?.avatar_color || undefined }}
                          >
                            {comment.profile ? getInitials(comment.profile.name) : '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              {comment.profile?.name || t('user')}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(comment.created_at), 'dd MMM, HH:mm', { locale: dateLocale })}
                            </span>
                          </div>
                          {comment.content && (
                            <p className="text-sm text-foreground">{comment.content}</p>
                          )}
                          {/* Attachments */}
                          {comment.attachments && comment.attachments.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {comment.attachments.map((att) => (
                                <a
                                  key={att.id}
                                  href={att.file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded hover:bg-muted/80"
                                >
                                  <FileIcon className="h-3 w-3" />
                                  {att.file_name}
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}

              {/* New comment form */}
              <div className="border-t pt-4 space-y-3">
                <MentionInput
                  variant="textarea"
                  placeholder={t('writeComment')}
                  value={newComment}
                  onChange={setNewComment}
                  disabled={submitting}
                  onSubmit={handleSubmitComment}
                />

                {/* Selected files preview */}
                {selectedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-1 bg-muted px-2 py-1 rounded text-xs"
                      >
                        <Paperclip className="h-3 w-3" />
                        <span className="max-w-[150px] truncate">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => removeSelectedFile(index)}
                          className="hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    multiple
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={submitting}
                  >
                    <Paperclip className="h-4 w-4 mr-1" />
                    {t('addFile')}
                  </Button>
                  <div className="flex-1" />
                  <Button
                    onClick={handleSubmitComment}
                    disabled={submitting || (!newComment.trim() && selectedFiles.length === 0)}
                    size="sm"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-1" />
                        {t('send') || 'Отправить'}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('status')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={run.status} onValueChange={updateStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">{t('status_pending') || 'Ожидает'}</SelectItem>
                  <SelectItem value="in_progress">{t('status_in_progress') || 'В работе'}</SelectItem>
                  <SelectItem value="completed">{t('status_completed') || 'Завершено'}</SelectItem>
                  <SelectItem value="cancelled">{t('status_cancelled') || 'Отменено'}</SelectItem>
                </SelectContent>
              </Select>

              {run.status === 'pending' && (
                <Button className="w-full" onClick={() => updateStatus('in_progress')}>
                  <Play className="h-4 w-4 mr-2" />
                  {t('takeToWork') || 'Взять в работу'}
                </Button>
              )}

              {run.status === 'in_progress' && (
                <Button className="w-full" variant="outline" onClick={() => updateStatus('completed')}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {t('markComplete') || 'Завершить'}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Info card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('info')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">{t('startedBy')}</p>
                {starterProfile && (
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={starterProfile.avatar_url || undefined} />
                      <AvatarFallback 
                        className="text-xs"
                        style={{ backgroundColor: starterProfile.avatar_color || undefined }}
                      >
                        {getInitials(starterProfile.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{starterProfile.name}</span>
                  </div>
                )}
              </div>
              
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">{t('startedAt')}</p>
                <p className="text-sm">
                  {format(new Date(run.started_at), 'dd MMM yyyy, HH:mm', { locale: dateLocale })}
                </p>
              </div>

              {run.completed_at && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">{t('completedAt')}</p>
                  <p className="text-sm">
                    {format(new Date(run.completed_at), 'dd MMM yyyy, HH:mm', { locale: dateLocale })}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ProcessRunDetail;
