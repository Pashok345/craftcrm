import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
import { Tag as TagIcon, Plus, X, Check, Trash2 } from 'lucide-react';
import { Tag } from '@/types/database';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface TagsManagerProps {
  taskId: string;
  userId: string;
}

const TAG_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', 
  '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', 
  '#6366f1', '#8b5cf6', '#a855f7', '#ec4899'
];

export const TagsManager = ({ taskId, userId }: TagsManagerProps) => {
  const { t } = useLanguage();
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [taskTagIds, setTaskTagIds] = useState<string[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [isOpen, setIsOpen] = useState(false);
  const [showNewTagForm, setShowNewTagForm] = useState(false);
  const [tagToDelete, setTagToDelete] = useState<Tag | null>(null);

  useEffect(() => {
    fetchTags();
    fetchTaskTags();
  }, [taskId]);

  const fetchTags = async () => {
    const { data } = await supabase.from('tags').select('*').order('name');
    if (data) setAllTags(data as unknown as Tag[]);
  };

  const fetchTaskTags = async () => {
    const { data } = await supabase
      .from('task_tags')
      .select('tag_id')
      .eq('task_id', taskId);
    if (data) setTaskTagIds(data.map(tt => tt.tag_id));
  };

  const createTag = async () => {
    if (!newTagName.trim()) return;

    const { data, error } = await supabase
      .from('tags')
      .insert({
        name: newTagName.trim(),
        color: newTagColor,
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      toast.error(t('error'));
      return;
    }

    setAllTags([...allTags, data as unknown as Tag]);
    setNewTagName('');
    setShowNewTagForm(false);
    toast.success(t('tagCreated'));

    // Auto-add to task
    await addTagToTask((data as unknown as Tag).id);
  };

  const addTagToTask = async (tagId: string) => {
    const { error } = await supabase
      .from('task_tags')
      .insert({ task_id: taskId, tag_id: tagId });

    if (error) {
      if (error.code === '23505') return; // Already exists
      toast.error(t('error'));
      return;
    }

    setTaskTagIds([...taskTagIds, tagId]);
  };

  const removeTagFromTask = async (tagId: string) => {
    const { error } = await supabase
      .from('task_tags')
      .delete()
      .eq('task_id', taskId)
      .eq('tag_id', tagId);

    if (!error) {
      setTaskTagIds(taskTagIds.filter(id => id !== tagId));
    }
  };

  const deleteTag = async (tag: Tag) => {
    // First remove from all tasks
    await supabase
      .from('task_tags')
      .delete()
      .eq('tag_id', tag.id);

    // Then delete the tag itself
    const { error } = await supabase
      .from('tags')
      .delete()
      .eq('id', tag.id);

    if (error) {
      toast.error(t('error'));
      return;
    }

    setAllTags(allTags.filter(t => t.id !== tag.id));
    setTaskTagIds(taskTagIds.filter(id => id !== tag.id));
    setTagToDelete(null);
    toast.success(t('tagDeleted') || 'Тег видалено');
  };

  const toggleTag = async (tagId: string) => {
    if (taskTagIds.includes(tagId)) {
      await removeTagFromTask(tagId);
    } else {
      await addTagToTask(tagId);
    }
  };

  const taskTags = allTags.filter(tag => taskTagIds.includes(tag.id));

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <TagIcon className="h-4 w-4 text-muted-foreground" />
        {taskTags.map(tag => (
          <Badge
            key={tag.id}
            style={{ backgroundColor: tag.color + '20', color: tag.color, borderColor: tag.color }}
            variant="outline"
            className="gap-1 cursor-pointer hover:opacity-80"
            onClick={() => removeTagFromTask(tag.id)}
          >
            {tag.name}
            <X className="h-3 w-3" />
          </Badge>
        ))}
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 px-2">
              <Plus className="h-4 w-4" />
              {t('addTag')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3" align="start">
            <div className="space-y-3">
              <h4 className="font-medium text-sm">{t('selectTag')}</h4>
              
              {allTags.length > 0 && (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {allTags.map(tag => (
                    <div key={tag.id} className="flex items-center justify-between group">
                      <Badge
                        style={{ backgroundColor: tag.color + '20', color: tag.color, borderColor: tag.color }}
                        variant="outline"
                        className={cn(
                          'cursor-pointer hover:opacity-80 gap-1 flex-1',
                          taskTagIds.includes(tag.id) && 'ring-2 ring-offset-1'
                        )}
                        onClick={() => toggleTag(tag.id)}
                      >
                        {taskTagIds.includes(tag.id) && <Check className="h-3 w-3" />}
                        {tag.name}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity ml-1 hover:bg-destructive/10 hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTagToDelete(tag);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t pt-3">
                {showNewTagForm ? (
                  <div className="space-y-2">
                    <Input
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      placeholder={t('tagName')}
                      className="h-8"
                      onKeyDown={(e) => e.key === 'Enter' && createTag()}
                    />
                    <div className="flex gap-1 flex-wrap">
                      {TAG_COLORS.map(color => (
                        <button
                          key={color}
                          className={cn(
                            'w-5 h-5 rounded-full border-2',
                            newTagColor === color ? 'border-foreground' : 'border-transparent'
                          )}
                          style={{ backgroundColor: color }}
                          onClick={() => setNewTagColor(color)}
                        />
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={createTag} className="flex-1 h-7">
                        {t('create')}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => setShowNewTagForm(false)}
                        className="h-7"
                      >
                        {t('cancel')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={() => setShowNewTagForm(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {t('createNewTag')}
                  </Button>
                )}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <AlertDialog open={!!tagToDelete} onOpenChange={(open) => !open && setTagToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteTag') || 'Видалити тег?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteTagConfirm') || `Тег "${tagToDelete?.name}" буде видалено з усіх задач. Цю дію неможливо скасувати.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => tagToDelete && deleteTag(tagToDelete)}>
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};