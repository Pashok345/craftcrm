import { Fragment, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePermissions } from '@/hooks/usePermissions';
import {
  ADMIN_LOCKED,
  PERMISSION_GROUPS,
  PERMISSION_LABEL_KEYS,
  Permission,
  PermissionMatrix,
  resolveMatrix,
} from '@/lib/permissions';
import type { AppRole } from '@/types/database';

const ROLES: AppRole[] = ['admin', 'user'];

export const PermissionsSettings = () => {
  const { t } = useLanguage();
  const { matrix, reload, loading } = usePermissions();
  const [draft, setDraft] = useState<PermissionMatrix>(matrix);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(matrix);
  }, [matrix]);

  const toggle = (role: AppRole, permission: Permission, value: boolean) => {
    setDraft((prev) => ({ ...prev, [role]: { ...prev[role], [permission]: value } }));
  };

  const save = async () => {
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('system_settings')
      .upsert({
        category: 'permissions',
        value: resolveMatrix(draft) as any,
        updated_by: userData.user?.id,
      });
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success(t('permissionsSaved'));
      reload();
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          {t('permissionsTitle')}
        </CardTitle>
        <CardDescription>{t('permissionsDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 font-medium">{t('permission')}</th>
                {ROLES.map((role) => (
                  <th key={role} className="py-2 px-4 font-medium text-center w-28">
                    {t(role === 'admin' ? 'roleAdmin' : 'roleUser')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSION_GROUPS.map((group) => (
                <Fragment key={group.group}>
                  <tr className="bg-muted/40">
                    <td colSpan={ROLES.length + 1} className="py-2 px-2 font-medium text-muted-foreground">
                      {t(group.labelKey)}
                    </td>
                  </tr>
                  {group.items.map((permission) => (
                    <tr key={permission} className="border-b last:border-0">
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-2">
                          <span>{t(PERMISSION_LABEL_KEYS[permission])}</span>
                          {ADMIN_LOCKED.includes(permission) && (
                            <Badge variant="outline" className="text-[10px]">
                              {t('permissionLocked')}
                            </Badge>
                          )}
                        </div>
                      </td>
                      {ROLES.map((role) => {
                        const locked = role === 'admin' && ADMIN_LOCKED.includes(permission);
                        return (
                          <td key={role} className="py-2 px-4 text-center">
                            <Switch
                              checked={locked ? true : draft[role]?.[permission] === true}
                              disabled={locked}
                              onCheckedChange={(v) => toggle(role, permission, v)}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {t('save')}
        </Button>
      </CardContent>
    </Card>
  );
};
