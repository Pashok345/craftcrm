import {
  LayoutDashboard,
  CheckSquare,
  Calendar,
  Users,
  Folder,
  GitBranch,
  BarChart3,
  TrendingUp,
  PenSquare,
  BookOpen,
  Settings as SettingsIcon,
  ScrollText,
  Briefcase,
  Star,
  Heart,
  Flag,
  Target,
  Rocket,
  Zap,
  Bell,
  Mail,
  FileText,
  Database,
  Globe,
  Home,
  Inbox,
  Layers,
  ListChecks,
  MessageSquare,
  Package,
  PieChart,
  Shield,
  Sparkles,
  Tag,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

/** Icons a user can pick for a menu item. */
export const MENU_ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  CheckSquare,
  Calendar,
  Users,
  Folder,
  GitBranch,
  BarChart3,
  TrendingUp,
  PenSquare,
  BookOpen,
  Settings: SettingsIcon,
  ScrollText,
  Briefcase,
  Star,
  Heart,
  Flag,
  Target,
  Rocket,
  Zap,
  Bell,
  Mail,
  FileText,
  Database,
  Globe,
  Home,
  Inbox,
  Layers,
  ListChecks,
  MessageSquare,
  Package,
  PieChart,
  Shield,
  Sparkles,
  Tag,
  Wallet,
};

export interface MenuItemDef {
  id: string;
  path: string;
  labelKey: string;
  icon: string;
  adminOnly?: boolean;
}

/** Default menu definition. Order here is the default order. */
export const DEFAULT_MENU: MenuItemDef[] = [
  { id: 'dashboard', path: '/dashboard', labelKey: 'dashboard', icon: 'LayoutDashboard' },
  { id: 'projects', path: '/projects', labelKey: 'projects', icon: 'Folder' },
  { id: 'tasks', path: '/tasks', labelKey: 'tasks', icon: 'CheckSquare' },
  { id: 'processes', path: '/processes', labelKey: 'processes', icon: 'GitBranch' },
  { id: 'sales', path: '/sales', labelKey: 'sales', icon: 'TrendingUp' },
  { id: 'meetings', path: '/meetings', labelKey: 'meetings', icon: 'Calendar' },
  { id: 'whiteboards', path: '/whiteboards', labelKey: 'whiteboards', icon: 'PenSquare' },
  { id: 'wiki', path: '/wiki', labelKey: 'wiki', icon: 'BookOpen' },
  { id: 'analytics', path: '/analytics', labelKey: 'analytics', icon: 'BarChart3' },
  { id: 'users', path: '/users', labelKey: 'users', icon: 'Users' },
  { id: 'audit', path: '/audit-log', labelKey: 'auditLog', icon: 'ScrollText', adminOnly: true },
  { id: 'settings', path: '/settings', labelKey: 'settings', icon: 'Settings' },
];

export interface MenuItemOverride {
  hidden?: boolean;
  label?: string;
  icon?: string;
  color?: string;
}

export type MenuOverrides = Record<string, MenuItemOverride>;

export const MENU_PREF_KEY = 'menu_config';

/** Preset colors offered for menu items. */
export const MENU_COLORS = [
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#ef4444',
  '#f59e0b',
  '#10b981',
  '#06b6d4',
  '#64748b',
];

export const getMenuIcon = (name?: string): LucideIcon =>
  (name && MENU_ICONS[name]) || MENU_ICONS.LayoutDashboard;
