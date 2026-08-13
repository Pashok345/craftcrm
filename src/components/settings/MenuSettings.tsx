import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Menu, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useMenuSettings } from '@/hooks/useMenuSettings';
import { MENU_COLORS, MENU_ICONS, getMenuIcon, type MenuOverrides } from '@/lib/menuConfig';
import { toast } from 'sonner';

export const MenuSettings = () => {
  const { t } = useLanguage();
  const { isAdmin } = useUserRole();
  const { items, overrides, save, reset } = useMenuSettings();
  const [saving, setSaving] = useState(false);

  const visibleItems = items.filter((i) => !i.adminOnly || isAdmin);

  const update = async (id: string, patch: Partial<MenuOverrides[string]>) => {
    const next: MenuOverrides = {
      ...overrides,
      [id]: { ...(overrides[id] || {}), ...patch },
    };
    setSaving(true);
    await save(next);
    setSaving(false);
  };

  const handleReset = async () => {
    await reset();
    toast.success(t('menuSettingsReset'));
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Menu className="h-5 w-5" />
            {t('menuSettingsTitle')}
          </CardTitle>
          <CardDescription>{t('menuSettingsDescription')}</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={handleReset} disabled={saving} className="gap-2 shrink-0">
          <RotateCcw className="h-4 w-4" />
          {t('menuSettingsResetAction')}
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {visibleItems.map((item) => {
          const ov = overrides[item.id] || {};
          const Icon = getMenuIcon(ov.icon || item.icon);
          const defaultLabel = t(item.labelKey);
          const hidden = ov.hidden === true;

          return (
            <div
              key={item.id}
              className={cn(
                'flex flex-wrap items-center gap-3 rounded-lg border p-3 transition-opacity',
                hidden && 'opacity-60'
              )}
            >
              <Switch
                checked={!hidden}
                onCheckedChange={(checked) => update(item.id, { hidden: !checked })}
                aria-label={defaultLabel}
              />

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon" className="shrink-0">
                    <Icon className="h-4 w-4" style={ov.color ? { color: ov.color } : undefined} />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2">
                  <div className="grid grid-cols-7 gap-1 max-h-56 overflow-y-auto">
                    {Object.entries(MENU_ICONS).map(([name, IconOption]) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => update(item.id, { icon: name })}
                        className={cn(
                          'h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted',
                          (ov.icon || item.icon) === name && 'bg-primary/10 text-primary'
                        )}
                        aria-label={name}
                      >
                        <IconOption className="h-4 w-4" />
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              <Input
                className="flex-1 min-w-[140px]"
                value={ov.label ?? ''}
                placeholder={defaultLabel}
                onChange={(e) => update(item.id, { label: e.target.value || undefined })}
              />

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => update(item.id, { color: undefined })}
                  className={cn(
                    'h-6 w-6 rounded-full border-2 bg-muted',
                    !ov.color ? 'border-foreground' : 'border-transparent'
                  )}
                  aria-label={t('menuColorDefault')}
                />
                {MENU_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => update(item.id, { color: c })}
                    className={cn(
                      'h-6 w-6 rounded-full border-2',
                      ov.color === c ? 'border-foreground' : 'border-transparent'
                    )}
                    style={{ backgroundColor: c }}
                    aria-label={c}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
