import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2 } from 'lucide-react';
import type { DealStage } from '@/types/sales';

const STAGE_COLORS = [
  '#3B82F6', '#8B5CF6', '#EC4899', '#EF4444', '#F59E0B',
  '#10B981', '#06B6D4', '#6366F1', '#84CC16', '#F97316',
];

interface StageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stage?: DealStage;
  maxSortOrder?: number;
}

export const StageDialog = ({ open, onOpenChange, stage, maxSortOrder = 0 }: StageDialogProps) => {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [color, setColor] = useState(STAGE_COLORS[0]);

  useEffect(() => {
    if (stage) {
      setName(stage.name);
      setColor(stage.color);
    } else {
      setName('');
      setColor(STAGE_COLORS[Math.floor(Math.random() * STAGE_COLORS.length)]);
    }
  }, [stage, open]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (stage) {
        const { error } = await supabase
          .from('deal_stages')
          .update({ name, color })
          .eq('id', stage.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('deal_stages').insert({
          name,
          color,
          sort_order: maxSortOrder + 1,
          created_by: user?.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal-stages'] });
      toast({
        title: stage ? t('stageUpdated') : t('stageCreated'),
      });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: t('error'),
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!stage) return;
      // Move deals from this stage or delete them - move deals to null isn't possible since stage_id is required
      // Delete deals in this stage first
      await supabase.from('deal_comments').delete().in(
        'deal_id',
        (await supabase.from('deals').select('id').eq('stage_id', stage.id)).data?.map(d => d.id) || []
      );
      await supabase.from('deals').delete().eq('stage_id', stage.id);
      const { error } = await supabase.from('deal_stages').delete().eq('id', stage.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal-stages'] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      toast({ title: t('stageDeleted') || 'Этап удалён' });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: t('error'), variant: 'destructive' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader className="pr-10">
          <DialogTitle>{stage ? t('editStage') : t('addStage')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{t('stageName')} *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('enterStageName')}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>{t('stageColor')}</Label>
            <div className="flex gap-2 flex-wrap">
              {STAGE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`w-8 h-8 rounded-full transition-transform ${
                    color === c ? 'ring-2 ring-offset-2 ring-primary scale-110' : ''
                  }`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-between">
            {stage && isAdmin ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="destructive" size="sm" disabled={deleteMutation.isPending}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t('delete') || 'Удалить'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('confirmDelete') || 'Подтвердите удаление'}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('deleteStageConfirm') || 'Этап и все связанные сделки будут удалены. Продолжить?'}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteMutation.mutate()}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {t('delete') || 'Удалить'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : <div />}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {stage ? t('save') : t('create')}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
