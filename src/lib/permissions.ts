import type { AppRole } from '@/types/database';

/**
 * Single source of truth for application permissions.
 * Add a new permission here and it automatically appears in
 * Settings → Права and is enforceable via usePermissions().can(...)
 */
export const PERMISSIONS = [
  // Users & system
  'users.manage',
  'users.invite',
  'roles.manage',
  'settings.manage',
  'auditlog.view',
  // Content
  'projects.manage',
  'tasks.manageAll',
  'processes.manage',
  'processes.editAnyRun',
  'sales.manage',
  'finance.manage',
  'wiki.manage',
  'whiteboards.manage',
  'kanban.manageColumns',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** Grouping used to render the matrix in settings. */
export const PERMISSION_GROUPS: { group: string; labelKey: string; items: Permission[] }[] = [
  {
    group: 'system',
    labelKey: 'permGroupSystem',
    items: ['users.manage', 'users.invite', 'roles.manage', 'settings.manage', 'auditlog.view'],
  },
  {
    group: 'work',
    labelKey: 'permGroupWork',
    items: ['projects.manage', 'tasks.manageAll', 'kanban.manageColumns', 'whiteboards.manage'],
  },
  {
    group: 'processes',
    labelKey: 'permGroupProcesses',
    items: ['processes.manage', 'processes.editAnyRun'],
  },
  {
    group: 'business',
    labelKey: 'permGroupBusiness',
    items: ['sales.manage', 'finance.manage', 'wiki.manage'],
  },
];

export const PERMISSION_LABEL_KEYS: Record<Permission, string> = {
  'users.manage': 'permUsersManage',
  'users.invite': 'permUsersInvite',
  'roles.manage': 'permRolesManage',
  'settings.manage': 'permSettingsManage',
  'auditlog.view': 'permAuditView',
  'projects.manage': 'permProjectsManage',
  'tasks.manageAll': 'permTasksManageAll',
  'processes.manage': 'permProcessesManage',
  'processes.editAnyRun': 'permProcessesEditRun',
  'sales.manage': 'permSalesManage',
  'finance.manage': 'permFinanceManage',
  'wiki.manage': 'permWikiManage',
  'whiteboards.manage': 'permWhiteboardsManage',
  'kanban.manageColumns': 'permKanbanColumns',
};

export type PermissionMatrix = Record<AppRole, Partial<Record<Permission, boolean>>>;

/** Defaults used when nothing is configured in system settings. */
export const DEFAULT_MATRIX: PermissionMatrix = {
  admin: PERMISSIONS.reduce((acc, p) => ({ ...acc, [p]: true }), {} as Record<Permission, boolean>),
  user: {
    'users.manage': false,
    'users.invite': false,
    'roles.manage': false,
    'settings.manage': false,
    'auditlog.view': false,
    'projects.manage': true,
    'tasks.manageAll': false,
    'processes.manage': false,
    'processes.editAnyRun': false,
    'sales.manage': true,
    'finance.manage': false,
    'wiki.manage': true,
    'whiteboards.manage': true,
    'kanban.manageColumns': false,
  },
};

/** Permissions that can never be taken away from admins. */
export const ADMIN_LOCKED: Permission[] = ['roles.manage', 'settings.manage', 'users.manage'];

export const resolveMatrix = (stored?: Partial<PermissionMatrix> | null): PermissionMatrix => ({
  admin: { ...DEFAULT_MATRIX.admin, ...(stored?.admin || {}) },
  user: { ...DEFAULT_MATRIX.user, ...(stored?.user || {}) },
});

export const hasPermission = (
  matrix: PermissionMatrix,
  role: AppRole | null,
  permission: Permission
): boolean => {
  if (!role) return false;
  if (role === 'admin' && ADMIN_LOCKED.includes(permission)) return true;
  return matrix[role]?.[permission] === true;
};
