import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import {
  DEFAULT_MATRIX,
  Permission,
  PermissionMatrix,
  hasPermission,
  resolveMatrix,
} from '@/lib/permissions';

const CACHE_KEY = 'permission_matrix_v1';

const readCache = (): PermissionMatrix => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? resolveMatrix(JSON.parse(raw)) : DEFAULT_MATRIX;
  } catch {
    return DEFAULT_MATRIX;
  }
};

/**
 * Unified role + permission access. Use this instead of ad-hoc `isAdmin` checks:
 *   const { can } = usePermissions();
 *   if (can('settings.manage')) { ... }
 */
export const usePermissions = () => {
  const { role, isAdmin, loading: roleLoading } = useUserRole();
  const [matrix, setMatrix] = useState<PermissionMatrix>(readCache);
  const [matrixLoading, setMatrixLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('system_settings')
      .select('value')
      .eq('category', 'permissions')
      .maybeSingle();
    const stored = (data?.value as Partial<PermissionMatrix>) || null;
    const resolved = resolveMatrix(stored);
    setMatrix(resolved);
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(resolved));
    } catch {}
    setMatrixLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const can = useCallback(
    (permission: Permission) => hasPermission(matrix, role, permission),
    [matrix, role]
  );

  return { can, matrix, role, isAdmin, reload: load, loading: roleLoading || matrixLoading };
};
