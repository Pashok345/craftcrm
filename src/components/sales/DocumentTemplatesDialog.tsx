import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Star, Trash2 } from 'lucide-react';
import type { DocumentTemplate, DocumentTemplateCompany } from '@/types/finance';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const emptyCompany: DocumentTemplateCompany = {
  name: '', tin: '', iban: '', bank: '', address: '', phone: '', email: '', director: '', footer: '',
};

export const DocumentTemplatesDialog = ({ open, onOpenChange }: Props) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<DocumentTemplate | null>(null);
  const [name, setName] = useState('');
  const [company, setCompany] = useState<DocumentTemplateCompany>(emptyCompany);
  const [isDefault, setIsDefault] = useState(false);

  const { data: templates = [] } = useQuery({
    queryKey: ['document-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('document_templates')
        .select('*')
        .order('is_default', { ascending: false });
      if (error) throw error;
      return data as unknown as DocumentTemplate[];
    },
    enabled: open,
  });

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setCompany({ ...emptyCompany, ...(editing.company || {}) });
      setIsDefault(editing.is_default);
    } else {
      setName('');
      setCompany(emptyCompany);
      setIsDefault(false);
    }
  }, [editing]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error('no user');
      const payload = {
        name: name.trim(),
        doc_type: 'invoice',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        company: company as any,
        is_default: isDefault,
      };
      if (editing) {
        const { error } = await supabase.from('document_templates').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('document_templates').insert({ ...payload, created_by: uid });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-templates'] });
      toast({ title: t('templateSaved') });
      setEditing(null);
      setName('');
      setCompany(emptyCompany);
      setIsDefault(false);
    },
    onError: (e) => toast({ title: t('error'), description: String(e), variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('document_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['document-templates'] }),
  });

  const field = (key: keyof DocumentTemplateCompany, label: string) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input value={company[key] ?? ''} onChange={(e) => setCompany((p) => ({ ...p, [key]: e.target.value }))} />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader className="pr-12">
          <DialogTitle>{t('documentTemplates')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            {templates.map((tpl) => (
              <Card key={tpl.id} className="cursor-pointer" onClick={() => setEditing(tpl)}>
                <CardContent className="p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{tpl.name}</span>
                      {tpl.is_default && <Badge variant="secondary"><Star className="h-3 w-3 mr-1" />{t('defaultTemplate')}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{tpl.company?.name}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(tpl.id); }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-medium text-sm">{editing ? t('editTemplate') : t('newTemplate')}</p>
              {editing && (
                <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
                  <Plus className="h-4 w-4 mr-1" />{t('newTemplate')}
                </Button>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('templateName')} *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {field('name', t('companyName'))}
              {field('tin', t('companyTin'))}
              {field('iban', 'IBAN')}
              {field('bank', t('bankName'))}
              {field('address', t('companyAddress'))}
              {field('phone', t('phone'))}
              {field('email', 'Email')}
              {field('director', t('signatory'))}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('documentFooter')}</Label>
              <Textarea
                rows={2}
                value={company.footer ?? ''}
                onChange={(e) => setCompany((p) => ({ ...p, footer: e.target.value }))}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
              {t('useAsDefault')}
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('close')}</Button>
          <Button disabled={!name.trim() || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            {t('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
