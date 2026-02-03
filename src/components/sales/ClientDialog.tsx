import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { Client } from '@/types/sales';

const AVATAR_COLORS = [
  '#3B82F6', '#8B5CF6', '#EC4899', '#EF4444', '#F59E0B',
  '#10B981', '#06B6D4', '#6366F1', '#84CC16', '#F97316',
];

interface ClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: Client;
}

export const ClientDialog = ({ open, onOpenChange, client }: ClientDialogProps) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [position, setPosition] = useState('');
  const [notes, setNotes] = useState('');
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);

  useEffect(() => {
    if (client) {
      setName(client.name);
      setEmail(client.email || '');
      setPhone(client.phone || '');
      setCompany(client.company || '');
      setPosition(client.position || '');
      setNotes(client.notes || '');
      setAvatarColor(client.avatar_color || AVATAR_COLORS[0]);
    } else {
      resetForm();
    }
  }, [client, open]);

  const mutation = useMutation({
    mutationFn: async () => {
      const clientData = {
        name,
        email: email || null,
        phone: phone || null,
        company: company || null,
        position: position || null,
        notes: notes || null,
        avatar_color: avatarColor,
        created_by: user?.id,
      };

      if (client) {
        const { error } = await supabase
          .from('clients')
          .update(clientData)
          .eq('id', client.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('clients').insert(clientData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast({
        title: client ? t('clientUpdated') : t('clientCreated'),
      });
      onOpenChange(false);
      resetForm();
    },
    onError: () => {
      toast({
        title: t('error'),
        variant: 'destructive',
      });
    },
  });

  const resetForm = () => {
    setName('');
    setEmail('');
    setPhone('');
    setCompany('');
    setPosition('');
    setNotes('');
    setAvatarColor(AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader className="pr-10">
          <DialogTitle>{client ? t('editClient') : t('addClient')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{t('clientName')} *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('enterClientName')}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>{t('avatarColor')}</Label>
            <div className="flex gap-2 flex-wrap">
              {AVATAR_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`w-8 h-8 rounded-full transition-transform ${
                    avatarColor === color ? 'ring-2 ring-offset-2 ring-primary scale-110' : ''
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => setAvatarColor(color)}
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('email')}</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label>{t('phone')}</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+7 (999) 123-45-67"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('company')}</Label>
              <Input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder={t('companyName')}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('position')}</Label>
              <Input
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder={t('clientPosition')}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('notes')}</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('clientNotesPlaceholder')}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {client ? t('save') : t('create')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
