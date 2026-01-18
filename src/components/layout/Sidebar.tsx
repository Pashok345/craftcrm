import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  CheckSquare, 
  Calendar, 
  Users,
  Folder,
  ChevronLeft,
  ChevronRight,
  Menu,
  GitBranch,
  BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import logo from '@/assets/logo.png';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export const Sidebar = ({ collapsed, onToggle }: SidebarProps) => {
  const { t } = useLanguage();
  
  const menuItems = [
    { icon: LayoutDashboard, label: t('dashboard'), path: '/dashboard' },
    { icon: Folder, label: t('projects'), path: '/projects' },
    { icon: CheckSquare, label: t('tasks'), path: '/tasks' },
    { icon: GitBranch, label: t('processes'), path: '/processes' },
    { icon: Calendar, label: t('meetings'), path: '/meetings' },
    { icon: BarChart3, label: t('analytics'), path: '/analytics' },
    { icon: Users, label: t('users'), path: '/users' },
  ];

  return (
    <aside
      className={cn(
        'h-screen bg-card border-r border-border flex flex-col transition-all duration-300',
        collapsed ? 'w-16' : 'w-52'
      )}
    >
      <div className="p-3 flex items-center justify-between border-b border-border min-h-[65px]">
        {!collapsed ? (
          <img src={logo} alt="CraftCRM" className="h-10 w-full object-contain" />
        ) : (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="mx-auto"
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}
        {!collapsed && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="shrink-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
      </div>

      <nav className="flex-1 p-2 space-y-1">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                'hover:bg-muted',
                isActive
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground',
                collapsed && 'justify-center px-2'
              )
            }
          >
            <item.icon className="h-5 w-5 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};
