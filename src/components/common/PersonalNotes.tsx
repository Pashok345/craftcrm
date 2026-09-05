import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Lock, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  entityType: 'client' | 'deal' | 'task' | 'project';
  entityId: string;
  title?: string;
}

/** A private note visible only to its author. */
export const PersonalNotes = ({ entityType, entityId, title = 'Личная заметка' }: Props) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const queryKey = ['personal-note', entityType, entityId, user?.id];

  const { data: note } = useQuery({
    queryKey,
    enabled: !!user?.id && !!entityId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('personal_notes')
        .select('*')
        .eq('user_id', user!.id)
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; content: string } | null;
    },
  });

  useEffect(() => {
    setValue(note?.content ?? '');
  }, [note?.content]);

  const save = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      if (note) {
        const { error } = await supabase.from('personal_notes').update({ content: value }).eq('id', note.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('personal_notes')
          .insert({ user_id: user.id, entity_type: entityType, entity_id: entityId, content: value });
        if (error) throw error;
      }
      queryClient.invalidateQueries({ queryKey });
      toast.success('Заметка сохранена');
    } catch {
      toast.error('Не удалось сохранить заметку');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!note) return;
    await supabase.from('personal_notes').delete().eq('id', note.id);
    setValue('');
    queryClient.invalidateQueries({ queryKey });
    toast.success('Заметка удалена');
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Lock className="h-4 w-4 text-muted-foreground" />
          {title}
          <span className="text-xs font-normal text-muted-foreground">— видно только вам</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={4}
          placeholder="Запишите, что важно помнить..."
        />
        <div className="flex gap-2 justify-end">
          {note && (
            <Button variant="ghost" size="sm" onClick={remove}>
              <Trash2 className="h-4 w-4 mr-1" />
              Удалить
            </Button>
          )}
          <Button size="sm" onClick={save} disabled={saving || value === (note?.content ?? '')}>
            <Save className="h-4 w-4 mr-1" />
            Сохранить
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
