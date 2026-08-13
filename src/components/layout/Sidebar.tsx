import { NavLink } from 'react-router-dom';
import { ChevronLeft, Menu } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { useMenuSettings } from '@/hooks/useMenuSettings';
import { getMenuIcon } from '@/lib/menuConfig';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useLanguage } from '@/contexts/LanguageContext';
import { useIsMobile } from '@/hooks/use-mobile';
import logo from '@/assets/logo.png';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}

export const Sidebar = ({ collapsed, onToggle, mobileOpen = false, onMobileOpenChange }: SidebarProps) => {
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const { isAdmin } = useUserRole();
  const { items, overrides } = useMenuSettings();

  const menuItems = items
    .filter((item) => (!item.adminOnly || isAdmin) && overrides[item.id]?.hidden !== true)
    .filter((item) => item.id !== 'settings' || isAdmin)
    .map((item) => {
      const ov = overrides[item.id] || {};
      return {
        path: item.path,
        label: ov.label?.trim() || t(item.labelKey),
        color: ov.color,
        Icon: getMenuIcon(ov.icon || item.icon),
      };
    });

  const renderNav = (onClickItem?: () => void) => (
    <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
      {menuItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          onClick={onClickItem}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
              'hover:bg-muted',
              isActive
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground',
              !isMobile && collapsed && 'justify-center px-2'
            )
          }
          style={item.color ? { color: item.color } : undefined}
        >
          <item.Icon className="h-5 w-5 shrink-0" />
          {(isMobile || !collapsed) && <span>{item.label}</span>}
        </NavLink>
      ))}
    </nav>
  );

  // Mobile: render as Sheet/drawer
  if (isMobile) {
    return (
      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent side="left" className="w-64 p-0 flex flex-col">
          <div className="p-3 flex items-center justify-between border-b border-border min-h-[65px]">
            <img src={logo} alt="CraftCRM" className="h-10 object-contain" />
          </div>
          {renderNav(() => onMobileOpenChange?.(false))}
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: classic sidebar
  return (
    <aside
      className={cn(
        'h-screen bg-card border-r border-border flex flex-col transition-all duration-300 shrink-0',
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

      {renderNav()}
    </aside>
  );
};
