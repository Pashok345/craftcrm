import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Plus, Folder, Layers, Pencil, Trash2, Check } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export interface ProcessCategory {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  sort_order: number;
}

interface Props {
  categories: ProcessCategory[];
  selectedCategoryId: string | null;
  onSelect: (id: string | null) => void;
  onChanged: () => void;
  counts: Record<string, number>;
  totalCount: number;
  uncategorizedCount: number;
}

const PRESET_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

export const ProcessCategoriesSidebar = ({
  categories,
  selectedCategoryId,
  onSelect,
  onChanged,
  counts,
  totalCount,
  uncategorizedCount,
}: Props) => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState(PRESET_COLORS[0]);

  const addCategory = async () => {
    if (!newName.trim() || !user) return;
    const { error } = await supabase.from('process_categories').insert({
      name: newName.trim(),
      color: newColor,
      created_by: user.id,
      sort_order: categories.length,
    });
    if (error) {
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
      return;
    }
    setNewName('');
    onChanged();
  };

  const saveEdit = async (id: string) => {
    if (!editName.trim()) return;
    const { error } = await supabase
      .from('process_categories')
      .update({ name: editName.trim(), color: editColor })
      .eq('id', id);
    if (error) {
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
      return;
    }
    setEditingId(null);
    onChanged();
  };

  const deleteCategory = async (id: string) => {
    const { error } = await supabase.from('process_categories').delete().eq('id', id);
    if (error) {
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
      return;
    }
    if (selectedCategoryId === id) onSelect(null);
    onChanged();
  };

  const Row = ({
    active,
    onClick,
    icon,
    label,
    count,
    color,
    children,
  }: {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: React.ReactNode;
    count: number;
    color?: string;
    children?: React.ReactNode;
  }) => (
    <div
      onClick={onClick}
      className={cn(
        'group flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer text-sm transition-colors',
        active ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
      )}
    >
      <span
        className="flex h-6 w-6 items-center justify-center rounded flex-shrink-0"
        style={color ? { backgroundColor: `${color}20`, color } : undefined}
      >
        {icon}
      </span>
      <span className="flex-1 truncate">{label}</span>
      <span className="text-xs text-muted-foreground">{count}</span>
      {children}
    </div>
  );

  return (
    <aside className="w-full md:w-64 flex-shrink-0 space-y-1">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-3 mb-2">
        {t('categories') || 'Категорії'}
      </div>

      <Row
        active={selectedCategoryId === null}
        onClick={() => onSelect(null)}
        icon={<Layers className="h-3.5 w-3.5" />}
        label={t('allProcesses') || 'Всі процеси'}
        count={totalCount}
      />

      {categories.map((cat) => (
        <div key={cat.id}>
          {editingId === cat.id ? (
            <div className="p-2 space-y-2 border rounded-md">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && saveEdit(cat.id)}
              />
              <div className="flex gap-1 flex-wrap">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setEditColor(c)}
                    className={cn(
                      'h-5 w-5 rounded-full border-2',
                      editColor === c ? 'border-foreground' : 'border-transparent'
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                  {t('cancel')}
                </Button>
                <Button size="sm" onClick={() => saveEdit(cat.id)}>
                  <Check className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ) : (
            <Row
              active={selectedCategoryId === cat.id}
              onClick={() => onSelect(cat.id)}
              icon={<Folder className="h-3.5 w-3.5" />}
              label={cat.name}
              count={counts[cat.id] || 0}
              color={cat.color}
            >
              {isAdmin && (
                <div className="opacity-0 group-hover:opacity-100 flex gap-0.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingId(cat.id);
                      setEditName(cat.name);
                      setEditColor(cat.color);
                    }}
                    className="p-1 hover:bg-background rounded"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="p-1 hover:bg-background rounded text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t('confirmDelete') || 'Підтвердіть видалення'}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t('deleteCategoryConfirm') ||
                            'Категорію буде видалено. Процеси залишаться без категорії.'}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteCategory(cat.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {t('delete') || 'Видалити'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </Row>
          )}
        </div>
      ))}

      <Row
        active={selectedCategoryId === '__uncategorized__'}
        onClick={() => onSelect('__uncategorized__')}
        icon={<Folder className="h-3.5 w-3.5" />}
        label={t('uncategorized') || 'Без категорії'}
        count={uncategorizedCount}
      />

      {isAdmin && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-start mt-2">
              <Plus className="h-4 w-4 mr-2" />
              {t('addCategory') || 'Додати категорію'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 space-y-2">
            <Input
              placeholder={t('categoryName') || 'Назва категорії'}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCategory()}
              autoFocus
            />
            <div className="flex gap-1 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  className={cn(
                    'h-6 w-6 rounded-full border-2',
                    newColor === c ? 'border-foreground' : 'border-transparent'
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <Button size="sm" className="w-full" onClick={addCategory} disabled={!newName.trim()}>
              {t('add') || 'Додати'}
            </Button>
          </PopoverContent>
        </Popover>
      )}
    </aside>
  );
};
